package kr.co.genomecompanion.platform.telemetry

import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory
import org.slf4j.MDC
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse

class PhiSafeLoggerTest {
    private val testLogger = LoggerFactory.getLogger("phi-safe-test") as ch.qos.logback.classic.Logger
    private val phiSafeLogger = PhiSafeLogger(testLogger)

    @Test
    fun `logger emits fixed event and safe context without sensitive values`() {
        val appender = ListAppender<ILoggingEvent>().also { it.start() }
        testLogger.addAppender(appender)
        try {
            phiSafeLogger.emit(
                TelemetryEvent.CONSENT_GRANTED,
                SafeTelemetryContext(
                    UUID.fromString("00000000-0000-0000-0000-000000000017"),
                    "/v1/consents", "2xx", 12,
                ),
            )
            val rendered = appender.list.joinToString("\n") { it.formattedMessage + it.mdcPropertyMap }
            assertThat(rendered).contains("consent_granted", "/v1/consents", "2xx")
            assertThat(rendered).doesNotContain("subject-17", "홍길동", "LDL", "140 mg/dL", "Bearer")
        } finally {
            testLogger.detachAppender(appender)
        }
    }

    @Test
    fun `emitFailure logs the exception class but never a request value`() {
        val appender = ListAppender<ILoggingEvent>().also { it.start() }
        testLogger.addAppender(appender)
        try {
            phiSafeLogger.emitFailure(
                TelemetryEvent.INTERNAL_ERROR,
                SafeTelemetryContext(
                    UUID.fromString("00000000-0000-0000-0000-000000000099"),
                    "/api/foundation/candidates/{candidateId}/confirmation", "5xx", null,
                ),
                "IllegalStateException",
                severe = true,
            )
            val rendered = appender.list.joinToString("\n") { it.formattedMessage + it.mdcPropertyMap }
            assertThat(rendered).contains("internal_error", "IllegalStateException", "5xx")
            assertThat(rendered).doesNotContain("188 mg/dL SENTINEL", "SECRET-BODY-VALUE-7731", "subject-17")
        } finally {
            testLogger.detachAppender(appender)
        }
    }

    /**
     * Every `emitLifecycle`/`emitLifecycleFailure` caller logs from inside a `@Transactional` service
     * method, *after* the repository write. Throwing on a bad context would therefore roll back a state
     * change the person already completed — the logger would be deciding what the system did. So a
     * violation drops the line and says `telemetry_context_rejected`, naming only the event code that
     * was attempted: the offending route template or hash is exactly the string that must not be
     * written down.
     */
    @Test
    fun `a rejected lifecycle context drops the line and reports the violation instead of throwing`() {
        val appender = ListAppender<ILoggingEvent>().also { it.start() }
        testLogger.addAppender(appender)
        try {
            phiSafeLogger.emitLifecycle(TelemetryEvent.RECORD_CORRECTED, "/api/foundation/records/188 mg/dL", "abc")
            phiSafeLogger.emitLifecycle(TelemetryEvent.SESSION_CREATED, "/api/foundation/session", "synthetic-alice")
            phiSafeLogger.emitLifecycleFailure(TelemetryEvent.WORKER_JOB_FAILED, "/internal/x", "Cholesterol 188 not parsed")
            // The safe cases still log normally.
            phiSafeLogger.emitLifecycle(TelemetryEvent.SESSION_CREATED, "/api/foundation/session", "0f1e2d3c4b5a")
            phiSafeLogger.emitLifecycleFailure(
                TelemetryEvent.WORKER_JOB_FAILED,
                "/internal/document-boundary/jobs/{jobId}/inspection-result",
                "inspection_digest_mismatch",
            )

            val rendered = appender.list.map { it.formattedMessage }
            assertThat(rendered.filter { it.startsWith("event=telemetry_context_rejected") }).containsExactly(
                "event=telemetry_context_rejected attempted_event=record_corrected",
                "event=telemetry_context_rejected attempted_event=session_created",
                "event=telemetry_context_rejected attempted_event=worker_job_failed",
            )
            assertThat(rendered).contains(
                "event=session_created route_template=/api/foundation/session subject_hash=0f1e2d3c4b5a",
                "event=worker_job_failed route_template=/internal/document-boundary/jobs/{jobId}/inspection-result " +
                    "subject_hash=none reason_code=inspection_digest_mismatch",
            )
            assertThat(rendered.joinToString("\n")).doesNotContain("188", "Cholesterol", "synthetic-alice", "mg/dL")
        } finally {
            testLogger.detachAppender(appender)
        }
    }

    @Test
    fun `correlation filter accepts only UUID and copies no other header to MDC`() {
        val request = MockHttpServletRequest().apply {
            addHeader("X-Correlation-ID", "not-a-uuid")
            addHeader("Authorization", "Bearer never-copy")
            addHeader("X-Subject", "subject-17")
        }
        val response = MockHttpServletResponse()
        var observed: String? = null
        CorrelationFilter().doFilter(request, response) { _, _ ->
            observed = MDC.get("correlation_id")
            assertThat(MDC.getCopyOfContextMap().keys).containsExactly("correlation_id")
        }
        assertThat(UUID.fromString(requireNotNull(observed))).isNotNull()
        assertThat(response.getHeader("X-Correlation-ID")).isEqualTo(observed)
        assertThat(MDC.get("correlation_id")).isNull()
    }
}
