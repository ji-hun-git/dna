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
}
