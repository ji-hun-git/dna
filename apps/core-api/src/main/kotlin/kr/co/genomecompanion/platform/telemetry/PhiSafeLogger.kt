package kr.co.genomecompanion.platform.telemetry

import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.util.UUID

class PhiSafeLogger(
    private val logger: Logger,
) {
    fun emit(event: TelemetryEvent, context: SafeTelemetryContext) {
        logger.info(
            "event={} correlation_id={} route_template={} status_class={} latency_ms={}",
            event.code,
            context.correlationId,
            context.routeTemplate ?: "none",
            context.statusClass ?: "none",
            context.latencyMs ?: -1,
        )
    }

    /**
     * One line for a framework-level failure the caller has no [ExceptionHandler]-specific telemetry for
     * (currently `internal_error`/`storage_unavailable` from `FoundationProblemAdvice`). [exceptionClass]
     * must be the failing exception's simple class name only — never its `message`, since the message of
     * a `DataAccessException`/generic `Exception` can itself quote request text (e.g. a JDBC driver
     * quoting a bind parameter), which is exactly the echo this line exists to avoid repeating.
     */
    fun emitFailure(event: TelemetryEvent, context: SafeTelemetryContext, exceptionClass: String, severe: Boolean) {
        val message = "event={} correlation_id={} route_template={} status_class={} latency_ms={} exception_class={}"
        if (severe) {
            logger.error(
                message,
                event.code,
                context.correlationId,
                context.routeTemplate ?: "none",
                context.statusClass ?: "none",
                context.latencyMs ?: -1,
                exceptionClass,
            )
        } else {
            logger.warn(
                message,
                event.code,
                context.correlationId,
                context.routeTemplate ?: "none",
                context.statusClass ?: "none",
                context.latencyMs ?: -1,
                exceptionClass,
            )
        }
    }

    /**
     * One line for a background (non-request) resource-scoped failure — currently only a quarantine file
     * delete that failed after a commit. [exceptionClass] must be the failing exception's simple class
     * name only, and [resourceId] a resource id (e.g. a document id) — never a path, filename, or any
     * other value that could echo request content.
     */
    fun emitResourceFailure(event: TelemetryEvent, correlationId: UUID, resourceId: UUID, exceptionClass: String) {
        logger.warn(
            "event={} correlation_id={} resource_id={} exception_class={}",
            event.code,
            correlationId,
            resourceId,
            exceptionClass,
        )
    }

    companion object {
        /** A `PhiSafeLogger` writing under [clazz]'s own logger category — kept inside this package so
         * that callers elsewhere never need their own `org.slf4j` import (`ModuleBoundaryTest
         * .loggingIsAvailableOnlyBehindPhiSafeTelemetry` forbids that outside `..platform.telemetry..`). */
        fun forClass(clazz: Class<*>): PhiSafeLogger = PhiSafeLogger(LoggerFactory.getLogger(clazz))
    }
}
