package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.platform.telemetry.PhiSafeLogger
import kr.co.genomecompanion.platform.telemetry.TelemetryEvent
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

/**
 * The only logger the foundation package uses: an event code, a route template and a truncated subject
 * hash — plus the correlation id that `logback-spring.xml` prints from the MDC on every line.
 *
 * Nothing else may be passed. A candidate label, a value, an exam date, a file name, an original text or
 * a full digest is PHI or PHI-adjacent, and a log line is the one place in this system that is copied to
 * an operator's terminal, a CI artifact and a log shipper without a consent check in front of it.
 * `FoundationLifecyclePostgresIntegrationTest.aFullLifecycleLogsNoValueLabelFilenameOrDate` runs a whole
 * lifecycle with a root-logger appender attached and fails if any of those ever reaches a log line.
 *
 * The class writes through [PhiSafeLogger] rather than an `org.slf4j` logger of its own, because
 * `ModuleBoundaryTest.loggingIsAvailableOnlyBehindPhiSafeTelemetry` forbids any dependency on
 * `org.slf4j` outside `..platform.telemetry..` — including the `MDC` and `LoggerFactory` a hand-rolled
 * version of this class would need.
 */
@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationLogging {
    private val logger = PhiSafeLogger.forCategory("kr.co.genomecompanion.foundation")

    /**
     * @param routeTemplate the mapping template of the request that caused the state change — a constant
     *   from the call site, never a request URI (a URI carries ids and could carry a file name).
     * @param subjectHash a peppered SHA-256 of the subject id, truncated here to its first 12 hex
     *   characters; `null` for a state change that belongs to no subject (the worker boundary).
     */
    fun event(event: TelemetryEvent, routeTemplate: String?, subjectHash: String?) {
        logger.emitLifecycle(event, routeTemplate, subjectHash?.take(12))
    }

    /**
     * A failed state change, plus the server's own reason code for it.
     *
     * @param reasonCode a constant from this codebase (or an enum name of ours) describing *why* the
     *   server rejected the work — never a worker-supplied message, an exception message or any text
     *   derived from a document.
     */
    fun failure(event: TelemetryEvent, routeTemplate: String?, reasonCode: String) {
        logger.emitLifecycleFailure(event, routeTemplate, reasonCode)
    }

    /**
     * One line per completed janitor sweep, carrying the six counts as integers and nothing else — no
     * subject, no route, no key and no path. `.part` files are their own field, not part of
     * `orphan_files`: they are a different failure (an upload that died mid-stream, not a row/file
     * divergence) and an operator watching for one should not have it hidden inside the other.
     */
    fun janitorSweep(report: JanitorReport) {
        logger.emitJanitorSweep(
            TelemetryEvent.JANITOR_SWEEP,
            sessions = report.sessions,
            capabilities = report.capabilities,
            idempotency = report.idempotencyKeys,
            orphanFiles = report.orphanFiles,
            partFiles = report.partFiles,
            staleJobs = report.staleJobs,
        )
    }

    /**
     * One janitor category failed; the rest of that sweep still ran. [category] is one of
     * [FoundationJanitor]'s own constants and [exceptionClass] the failing exception's simple class
     * name — never its message, which for an I/O failure is a path and for a JDBC failure can be a
     * bind parameter.
     */
    fun janitorCategoryFailed(category: String, exceptionClass: String) {
        logger.emitCategoryFailure(TelemetryEvent.JANITOR_CATEGORY_FAILED, category, exceptionClass)
    }
}
