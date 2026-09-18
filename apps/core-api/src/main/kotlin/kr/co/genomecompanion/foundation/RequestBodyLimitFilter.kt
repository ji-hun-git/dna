package kr.co.genomecompanion.foundation

import jakarta.servlet.FilterChain
import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.io.IOException

/**
 * Rejects a declared or actual request body above the route's cap with `413 payload_too_large` before
 * any handler — and before Jackson — reads it. `Content-Length` above the limit is rejected immediately;
 * a chunked body with no declared length is bounded as it is read by wrapping the servlet input stream.
 *
 * The upload PUT (`/api/foundation/documents/{id}/content`) gets the larger 10 MB cap because it is
 * streamed straight to disk by [FoundationDocumentStorage.putUntrusted] and never buffered in full; every
 * other route under `/api/foundation` is JSON with the 256 KB cap; routes under `/internal/document-boundary`
 * (the worker result callback) get the worker cap, sized for its 2 MB result payload plus the base64 preview.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class RequestBodyLimitFilter : OncePerRequestFilter() {
    companion object {
        const val JSON_LIMIT = 262_144L
        const val UPLOAD_LIMIT = 10_485_760L
        const val WORKER_LIMIT = 4_893_356L
        private val uploadPath = Regex("^/api/foundation/documents/[0-9a-f-]{36}/content$")
    }

    /** Thrown by [BoundedServletInputStream] when a chunked (or otherwise mis-declared) body exceeds its
     * cap while being read. Jackson/Spring wrap this in [org.springframework.http.converter.HttpMessageNotReadableException],
     * so [FoundationProblemAdvice.unreadable] must check the cause chain for it before answering the plain 400. */
    class BodyTooLargeException : IOException("payload_too_large")

    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        !(request.requestURI.startsWith("/api/foundation") || request.requestURI.startsWith("/internal/document-boundary"))

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        val limit = when {
            request.requestURI.startsWith("/internal/document-boundary") -> WORKER_LIMIT
            request.method == "PUT" && uploadPath.matches(request.requestURI) -> UPLOAD_LIMIT
            else -> JSON_LIMIT
        }
        if (request.contentLengthLong > limit) return reject(response)
        val bounded = object : HttpServletRequestWrapper(request) {
            override fun getInputStream(): ServletInputStream = BoundedServletInputStream(request.inputStream, limit)
        }
        try {
            filterChain.doFilter(bounded, response)
        } catch (exception: Exception) {
            if (generateSequence<Throwable>(exception) { it.cause }.any { it is BodyTooLargeException } && !response.isCommitted) {
                reject(response)
            } else {
                throw exception
            }
        }
    }

    private fun reject(response: HttpServletResponse) =
        writeProblemResponse(response, HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE, "payload_too_large")

    private class BoundedServletInputStream(
        private val delegate: ServletInputStream,
        private val limit: Long,
    ) : ServletInputStream() {
        private var consumed = 0L

        override fun read(): Int = delegate.read().also { if (it >= 0) count(1) }

        override fun read(b: ByteArray, off: Int, len: Int): Int =
            delegate.read(b, off, len).also { if (it > 0) count(it.toLong()) }

        private fun count(bytes: Long) {
            consumed += bytes
            if (consumed > limit) throw BodyTooLargeException()
        }

        override fun isFinished(): Boolean = delegate.isFinished
        override fun isReady(): Boolean = delegate.isReady
        override fun setReadListener(listener: ReadListener?) = delegate.setReadListener(listener)
        override fun available(): Int = delegate.available()
        override fun close() = delegate.close()
    }
}
