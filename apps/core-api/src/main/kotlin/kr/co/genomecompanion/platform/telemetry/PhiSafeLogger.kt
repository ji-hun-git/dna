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
     * One line per committed lifecycle state change: the event code, the route template that produced it
     * and a truncated, peppered subject hash. Deliberately narrower than [emit]:
     *
     *  - no correlation id in the *message*. `logback-spring.xml` already prints
     *    `correlation_id=%X{correlation_id:-none}` from the MDC on every line, so the id is still there
     *    for an operator; repeating the raw UUID inside the message would add 32 attacker-uncontrolled
     *    hex characters per line, which any "this substring never appears in a log" assertion (see
     *    `FoundationLifecyclePostgresIntegrationTest.aFullLifecycleLogsNoValueLabelFilenameOrDate`) would
     *    then trip over by coincidence rather than by a real leak.
     *  - [subjectHash] is a prefix of a peppered SHA-256 of the subject id, never the subject id itself,
     *    and is length-capped and charset-checked here so a caller cannot smuggle text through it.
     *
     * A context that fails either check **drops the line** and emits [TelemetryEvent
     * .TELEMETRY_CONTEXT_REJECTED] instead; it does not throw. Every caller logs from inside a
     * `@Transactional` service method *after* the repository write, so throwing here would roll back a
     * state change the user already completed — a logging defect must never change what the system did.
     */
    fun emitLifecycle(event: TelemetryEvent, routeTemplate: String?, subjectHash: String?) {
        if (!isSafeRouteTemplate(routeTemplate) || !isSafeSubjectHash(subjectHash)) {
            emitContextRejected(event)
            return
        }
        logger.info(
            "event={} route_template={} subject_hash={}",
            event.code,
            routeTemplate ?: "none",
            subjectHash ?: "none",
        )
    }

    /**
     * [emitLifecycle] for a state change that failed, plus the *server's own* reason code for the
     * failure (a compile-time constant or an enum name from this codebase — never a worker-supplied or
     * exception-supplied message, which could quote document text). Charset-checked like the rest, and
     * dropped rather than thrown on a violation for the same transactional reason.
     */
    fun emitLifecycleFailure(event: TelemetryEvent, routeTemplate: String?, reasonCode: String) {
        if (!isSafeRouteTemplate(routeTemplate) || !reasonCode.matches(REASON_CODE_PATTERN)) {
            emitContextRejected(event)
            return
        }
        logger.info(
            "event={} route_template={} subject_hash={} reason_code={}",
            event.code,
            routeTemplate ?: "none",
            "none",
            reasonCode,
        )
    }

    private fun isSafeRouteTemplate(routeTemplate: String?): Boolean =
        routeTemplate == null || routeTemplate.matches(ROUTE_TEMPLATE_PATTERN)

    private fun isSafeSubjectHash(subjectHash: String?): Boolean =
        subjectHash == null || subjectHash.matches(SUBJECT_HASH_PATTERN)

    private fun emitContextRejected(attempted: TelemetryEvent) {
        logger.warn(
            "event={} attempted_event={}",
            TelemetryEvent.TELEMETRY_CONTEXT_REJECTED.code,
            attempted.code,
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
        private val ROUTE_TEMPLATE_PATTERN = Regex("^/[A-Za-z0-9_/{}-]{1,127}$")
        private val SUBJECT_HASH_PATTERN = Regex("^[0-9a-f]{1,12}$")
        private val REASON_CODE_PATTERN = Regex("^[a-z0-9_]{3,64}$")

        /** A `PhiSafeLogger` writing under the named category, for the one caller that logs for a whole
         * package rather than for a single class. Kept here so that caller needs no `org.slf4j` import. */
        fun forCategory(category: String): PhiSafeLogger = PhiSafeLogger(LoggerFactory.getLogger(category))

        /** A `PhiSafeLogger` writing under [clazz]'s own logger category — kept inside this package so
         * that callers elsewhere never need their own `org.slf4j` import (`ModuleBoundaryTest
         * .loggingIsAvailableOnlyBehindPhiSafeTelemetry` forbids that outside `..platform.telemetry..`). */
        fun forClass(clazz: Class<*>): PhiSafeLogger = PhiSafeLogger(LoggerFactory.getLogger(clazz))
    }
}
