package kr.co.genomecompanion.foundation

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.ConstraintViolationException
import kr.co.genomecompanion.platform.telemetry.CorrelationFilter
import kr.co.genomecompanion.platform.telemetry.PhiSafeLogger
import kr.co.genomecompanion.platform.telemetry.SafeTelemetryContext
import kr.co.genomecompanion.platform.telemetry.TelemetryEvent
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
import org.springframework.web.multipart.MaxUploadSizeExceededException
import org.springframework.web.servlet.HandlerExceptionResolver
import org.springframework.web.servlet.HandlerMapping
import org.springframework.web.servlet.ModelAndView
import java.util.UUID

/**
 * Every failure the framework raises before or around a foundation controller becomes the same
 * `{"code":"…"}` problem the controllers emit. The exception's own message is never read, placed in the
 * response, or logged: Spring's own messages (in particular Jackson's parse-failure message) quote the
 * offending request text verbatim, and that text may be a health value. Only the exception's *class name*
 * is ever logged, and only for the two cases ([storage], [unexpected]) that indicate a real, unplanned
 * failure worth an operator's attention — the structured `PhiSafeLogger`/`TelemetryEvent` path already
 * established in `kr.co.genomecompanion.platform.telemetry`, never a raw `org.slf4j` logger of this
 * class's own (`ModuleBoundaryTest.loggingIsAvailableOnlyBehindPhiSafeTelemetry` forbids that outside
 * `..platform.telemetry..`).
 *
 * Controller-local `@ExceptionHandler` methods (e.g. `FoundationLifecycleController.handleBadRequest`)
 * take precedence over this advice for the exceptions they already own (`FoundationBadRequestException`
 * and friends), so this class only needs to cover exceptions the framework itself raises: malformed
 * bodies, missing headers, unparsable path variables/parameters, unsupported media types, oversized
 * uploads, and storage-layer failures that never reach a controller's own handler.
 *
 * `HttpRequestMethodNotSupportedException` (wrong HTTP verb) is deliberately **not** handled here — see
 * [FoundationMethodNotSupportedResolver] for why an `@ExceptionHandler` in this class can never run for
 * it, and why a separate mechanism exists instead.
 *
 * 404 (`FoundationNotFoundException`'s `@ExceptionHandler` on the controller already covers today's only
 * "not found" case) is unaffected by this task; a framework-level `NoHandlerFoundException`/`NoResource
 * FoundException` mapping for an unmapped foundation path is left to Task 14/7b's static-asset and
 * routing work, which is the wave's next foundation-adjacent task after this one.
 */
@RestControllerAdvice(basePackages = ["kr.co.genomecompanion.foundation"])
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationProblemAdvice {
    private val phiSafeLogger = PhiSafeLogger.forClass(FoundationProblemAdvice::class.java)

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadable(): ResponseEntity<ApiProblem> = problem(HttpStatus.BAD_REQUEST, "request_body_invalid")

    @ExceptionHandler(MissingRequestHeaderException::class)
    fun missingHeader(): ResponseEntity<ApiProblem> = problem(HttpStatus.BAD_REQUEST, "request_header_missing")

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun pathMismatch(): ResponseEntity<ApiProblem> = problem(HttpStatus.BAD_REQUEST, "request_path_invalid")

    @ExceptionHandler(ConstraintViolationException::class)
    fun constraintViolation(): ResponseEntity<ApiProblem> = problem(HttpStatus.BAD_REQUEST, "request_invalid")

    @ExceptionHandler(HttpMediaTypeNotSupportedException::class)
    fun mediaType(): ResponseEntity<ApiProblem> = problem(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "media_type_unsupported")

    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun payloadTooLarge(): ResponseEntity<ApiProblem> = problem(HttpStatus.PAYLOAD_TOO_LARGE, "payload_too_large")

    // PessimisticLockingFailureException is the superclass of the deprecated DeadlockLoserDataAccessException,
    // so listing it alone already covers a deadlock loser without referencing the deprecated type.
    @ExceptionHandler(CannotAcquireLockException::class, PessimisticLockingFailureException::class)
    fun lock(): ResponseEntity<ApiProblem> = problem(HttpStatus.CONFLICT, "lock_conflict")

    @ExceptionHandler(DataAccessException::class)
    fun storage(exception: DataAccessException, request: HttpServletRequest): ResponseEntity<ApiProblem> {
        logFailure(TelemetryEvent.STORAGE_UNAVAILABLE, request, exception, severe = false)
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "storage_unavailable")
    }

    @ExceptionHandler(Exception::class)
    fun unexpected(exception: Exception, request: HttpServletRequest): ResponseEntity<ApiProblem> {
        logFailure(TelemetryEvent.INTERNAL_ERROR, request, exception, severe = true)
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error")
    }

    /** Exactly one structured line: event code, correlation id, route template, status class, and the
     * exception's *class name* only — never [Throwable.message], which can itself quote request text. */
    private fun logFailure(event: TelemetryEvent, request: HttpServletRequest, exception: Exception, severe: Boolean) {
        val context = SafeTelemetryContext(
            correlationId = CorrelationFilter.currentCorrelationId() ?: UUID.randomUUID(),
            routeTemplate = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE) as? String
                ?: "/unmatched",
            statusClass = "5xx",
            latencyMs = null,
        )
        phiSafeLogger.emitFailure(event, context, exception.javaClass.simpleName, severe)
    }

    private fun problem(status: HttpStatus, code: String): ResponseEntity<ApiProblem> =
        ResponseEntity.status(status)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(ApiProblem(code))
}

/**
 * `HttpRequestMethodNotSupportedException` (a plain PUT/DELETE/etc. against a path that only maps other
 * verbs) is thrown by `RequestMappingInfoHandlerMapping` while it is still looking for a handler, before
 * any `HandlerMethod` is chosen — so at the point an `@ExceptionHandler` in [FoundationProblemAdvice]
 * would run, the exception-resolution machinery has no handler to test that advice's `basePackages`
 * restriction against (`ControllerAdviceBean.isApplicableToBeanType(null)` is false for any *restricted*
 * advice — confirmed by decompiling `ExceptionHandlerExceptionResolver`/`ControllerAdviceBean`/
 * `HandlerTypePredicate` from `spring-webmvc`/`spring-web`), so the request falls straight through to
 * Spring's `DefaultHandlerExceptionResolver`, which answers with the framework's bare `{}` body and lets
 * Spring Security's `HeaderWriterFilter` write its own default `Cache-Control: no-cache, no-store,
 * max-age=0, must-revalidate` instead of this task's `no-store`. This is why `FoundationProblemAdvice`
 * itself has no `method()`/`HttpRequestMethodNotSupportedException` handler at all: an unreachable
 * `@ExceptionHandler` there would be dead code that looks load-bearing.
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
