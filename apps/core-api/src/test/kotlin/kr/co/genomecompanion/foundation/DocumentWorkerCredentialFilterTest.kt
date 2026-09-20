package kr.co.genomecompanion.foundation

import jakarta.servlet.FilterChain
import kr.co.genomecompanion.documentboundary.WorkerIdentity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/**
 * The integration test proves the happy path and the MAC rejection over real HTTP; this unit test
 * pins the two properties that only the *ordering* inside the filter can give, and that a 100000-per
 * -minute test profile could never surface: the 429 itself, and the fact that an unauthenticated
 * caller cannot spend a real worker's budget by simply naming it.
 */
class DocumentWorkerCredentialFilterTest {
    private class MutableClock(var now: Instant) : Clock() {
        override fun getZone() = ZoneOffset.UTC
        override fun withZone(zone: java.time.ZoneId) = this
        override fun instant() = now
    }

    private val credential = "worker-credential-for-filter-unit-test-0001"
    private val workerId = "unit-test-worker"

    private fun filter(clock: Clock, limit: Int) = DocumentWorkerCredentialFilter(
        FoundationProperties(
            workerCredentialSha256 = FoundationHashing.sha256(credential),
            workerRateLimitPerMinute = limit,
        ),
        clock,
    )

    private fun request(credentialHeader: String = credential, mac: String? = WorkerIdentity.mac(credential, workerId)) =
        MockHttpServletRequest("POST", "/internal/document-boundary/jobs/lease").apply {
            requestURI = "/internal/document-boundary/jobs/lease"
            addHeader("X-GC-Worker-Credential", credentialHeader)
            addHeader("X-GC-Worker-Id", workerId)
            if (mac != null) addHeader("X-GC-Worker-Id-Mac", mac)
        }

    private fun run(filter: DocumentWorkerCredentialFilter, request: MockHttpServletRequest): Pair<MockHttpServletResponse, FilterChain> {
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()
        filter.doFilter(request, response, chain)
        return response to chain
    }

    @Test
    fun `a second request in the same minute is rate limited with a retry hint`() {
        val subject = filter(MutableClock(Instant.parse("2026-09-18T00:00:00Z")), limit = 1)
        val (first, firstChain) = run(subject, request())
        assertThat(first.status).isEqualTo(200)
        assertThat((firstChain as MockFilterChain).request).isNotNull()

        val (second, _) = run(subject, request())
        assertThat(second.status).isEqualTo(429)
        assertThat(second.contentAsString).isEqualTo("""{"code":"rate_limited"}""")
        assertThat(second.getHeader("Retry-After")).isEqualTo("60")
        assertThat(second.getHeader("Cache-Control")).isEqualTo("no-store")
    }

    @Test
    fun `a window that has rolled over refills the worker budget`() {
        val clock = MutableClock(Instant.parse("2026-09-18T00:00:00Z"))
        val subject = filter(clock, limit = 1)
        assertThat(run(subject, request()).first.status).isEqualTo(200)
        clock.now = clock.now.plusSeconds(61)
        assertThat(run(subject, request()).first.status).isEqualTo(200)
    }

    @Test
    fun `a rejected credential or MAC never spends the named worker's budget`() {
        val subject = filter(MutableClock(Instant.parse("2026-09-18T00:00:00Z")), limit = 1)
        // Both denials name a real worker id; if either were counted first, an unauthenticated caller
        // could exhaust that worker's whole minute and the legitimate request below would 429.
        val (wrongCredential, _) = run(subject, request(credentialHeader = "some-other-credential-value-000000000001"))
        assertThat(wrongCredential.status).isEqualTo(403)
        assertThat(wrongCredential.contentAsString).isEqualTo("""{"code":"worker_identity_denied"}""")
        val (wrongMac, _) = run(subject, request(mac = "0".repeat(64)))
        assertThat(wrongMac.status).isEqualTo(403)
        assertThat(wrongMac.contentAsString).isEqualTo("""{"code":"worker_identity_denied"}""")

        assertThat(run(subject, request()).first.status).isEqualTo(200)
    }
}
