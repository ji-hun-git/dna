package kr.co.genomecompanion.foundation

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.dao.CannotAcquireLockException
import org.springframework.dao.DataAccessException
import org.springframework.dao.PessimisticLockingFailureException
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.stereotype.Component
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.web.HttpRequestMethodNotSupportedException
import org.springframework.web.bind.MissingRequestHeaderException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.servlet.HandlerExceptionResolver
import org.springframework.web.servlet.ModelAndView

/**
 * Every failure the framework raises before or around a foundation controller becomes the same
 * `{"code":"…"}` problem the controllers emit. The exception's own message is never read, logged, or
 * placed in the response: Spring's own messages (in particular Jackson's parse-failure message) quote
 * the offending request text verbatim, and that text may be a health value. Only the exception's class
 * name is ever logged.
 *
 * Controller-local `@ExceptionHandler` methods (e.g. `FoundationLifecycleController.handleBadRequest`)
 * take precedence over this advice for the exceptions they already own (`FoundationBadRequestException`
 * and friends), so this class only needs to cover exceptions the framework itself raises: malformed
 * bodies, missing headers, unparsable path variables, unsupported media types/methods, and storage-layer
 * failures that never reach a controller's own handler.
 *
 * Deliberately does not log here: `ModuleBoundaryTest.loggingIsAvailableOnlyBehindPhiSafeTelemetry`
 * forbids any `org.slf4j` dependency outside `..platform.telemetry..`, and this task's scope is the
 * response shape, not the logging pipeline (Task 21 wires structured `PhiSafeLogger` events for the
 * whole request lifecycle, including these failures). Not logging here is strictly safer than the
 * alternative the brief's own literal pseudocode raised: `DataAccessException`/`Exception` messages
 * can themselves quote request text, so a log line built from `exception.message` would repeat the
 * very echo this task exists to remove; the exception's class name alone is enough for anyone reading
 * raw stdout to correlate.
 */
@RestControllerAdvice(basePackages = ["kr.co.genomecompanion.foundation"])
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationProblemAdvice {

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadable(): ResponseEntity<ApiProblem> = problem(HttpStatus.BAD_REQUEST, "request_body_invalid")

    @ExceptionHandler(MissingRequestHeaderException::class)
    fun missingHeader(): ResponseEntity<ApiProblem> = problem(HttpStatus.BAD_REQUEST, "request_header_missing")

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun pathMismatch(): ResponseEntity<ApiProblem> = problem(HttpStatus.BAD_REQUEST, "request_path_invalid")

    @ExceptionHandler(HttpMediaTypeNotSupportedException::class)
    fun mediaType(): ResponseEntity<ApiProblem> = problem(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "media_type_unsupported")

    @ExceptionHandler(HttpRequestMethodNotSupportedException::class)
    fun method(): ResponseEntity<ApiProblem> = problem(HttpStatus.METHOD_NOT_ALLOWED, "method_not_allowed")

    // PessimisticLockingFailureException is the superclass of the deprecated DeadlockLoserDataAccessException,
    // so listing it alone already covers a deadlock loser without referencing the deprecated type.
    @ExceptionHandler(CannotAcquireLockException::class, PessimisticLockingFailureException::class)
    fun lock(): ResponseEntity<ApiProblem> = problem(HttpStatus.CONFLICT, "lock_conflict")

    @ExceptionHandler(DataAccessException::class)
    fun storage(): ResponseEntity<ApiProblem> = problem(HttpStatus.SERVICE_UNAVAILABLE, "storage_unavailable")

    @ExceptionHandler(Exception::class)
    fun unexpected(): ResponseEntity<ApiProblem> = problem(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error")

    private fun problem(status: HttpStatus, code: String): ResponseEntity<ApiProblem> =
        ResponseEntity.status(status)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(ApiProblem(code))
}

/**
 * `HttpRequestMethodNotSupportedException` (a plain PUT/DELETE/etc. against a path that only maps other
 * verbs) is thrown by `RequestMappingInfoHandlerMapping` while it is still looking for a handler, before
 * any `HandlerMethod` is chosen — so at the point [FoundationProblemAdvice.method] would run, the
 * exception-resolution machinery has no handler to test the advice's `basePackages` restriction against
 * (`ControllerAdviceBean.isApplicableToBeanType(null)` is false for any *restricted* advice) and the
 * request falls straight through to Spring's `DefaultHandlerExceptionResolver`, which answers with the
 * framework's bare `{}` body and lets Spring Security's `HeaderWriterFilter` write its own default
 * `Cache-Control: no-cache, no-store, max-age=0, must-revalidate` instead of this task's `no-store`.
 *
 * This resolver is registered without any `basePackages`/`assignableTypes` restriction (so it is asked
 * about every exception, including the handler-less ones) and instead scopes itself by request path,
 * matching this app's two foundation route prefixes directly. `@Order(HIGHEST_PRECEDENCE)` makes it run
 * before the built-in exception-resolver composite (`WebMvcConfigurationSupport` registers that at order
 * `0`), so it claims `HttpRequestMethodNotSupportedException` first; returning `null` for every other
 * exception, or for a path outside the two prefixes, hands resolution straight back to the normal chain
 * (`FoundationProblemAdvice`'s own `@ExceptionHandler` methods, then the framework defaults), so nothing
 * else in this file or in other modules' controllers changes behavior.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationMethodNotSupportedResolver : HandlerExceptionResolver {
    override fun resolveException(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any?,
        exception: Exception,
    ): ModelAndView? {
        if (exception !is HttpRequestMethodNotSupportedException) return null
        val path = request.requestURI
        if (!path.startsWith("/api/foundation/") && !path.startsWith("/internal/document-boundary/")) return null
        response.status = HttpStatus.METHOD_NOT_ALLOWED.value()
        response.contentType = MediaType.APPLICATION_PROBLEM_JSON_VALUE
        response.characterEncoding = "UTF-8"
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
        response.writer.write("""{"code":"method_not_allowed"}""")
        return ModelAndView()
    }
}
