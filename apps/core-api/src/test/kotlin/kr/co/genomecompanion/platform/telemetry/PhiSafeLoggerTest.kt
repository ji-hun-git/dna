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
