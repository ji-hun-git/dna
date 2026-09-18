package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset


class SessionRateLimiterTest {
    private class MutableClock(var now: Instant) : Clock() {
        override fun getZone() = ZoneOffset.UTC
        override fun withZone(zone: java.time.ZoneId) = this
        override fun instant() = now
    }

    private fun properties(limit: Int = 10) = FoundationProperties(sessionRateLimitPerMinute = limit)

    @Test
    fun `allows ten attempts per minute per key and refills after a minute`() {
        val clock = MutableClock(Instant.parse("2026-09-18T00:00:00Z"))
        val limiter = SessionRateLimiter(properties(), clock)
        repeat(10) { assertThat(limiter.tryAcquire("subject-a", "10.0.0.1")).isTrue() }
        assertThat(limiter.tryAcquire("subject-a", "10.0.0.1")).isFalse()
        assertThat(limiter.tryAcquire("subject-b", "10.0.0.2")).isTrue()
        // The IP bucket is shared: subject-b from the same IP as subject-a is already exhausted.
        assertThat(limiter.tryAcquire("subject-b", "10.0.0.1")).isFalse()
        clock.now = clock.now.plus(Duration.ofMinutes(1))
        assertThat(limiter.tryAcquire("subject-a", "10.0.0.1")).isTrue()
    }

    @Test
    fun `locks a key for fifteen minutes after five failures and clears on success`() {
        val clock = MutableClock(Instant.parse("2026-09-18T00:00:00Z"))
        val limiter = SessionRateLimiter(properties(1000), clock)
        repeat(4) { limiter.recordFailure("subject-a", "10.0.0.1") }
        assertThat(limiter.isLocked("subject-a", "10.0.0.1")).isFalse()
        limiter.recordFailure("subject-a", "10.0.0.1")
        assertThat(limiter.isLocked("subject-a", "10.0.0.1")).isTrue()
        assertThat(limiter.isLocked("subject-a", "10.0.0.9")).isTrue()   // subject key locked
        assertThat(limiter.isLocked("subject-z", "10.0.0.1")).isTrue()   // ip key locked
        clock.now = clock.now.plus(Duration.ofMinutes(15))
        assertThat(limiter.isLocked("subject-a", "10.0.0.1")).isFalse()
        limiter.recordFailure("subject-a", "10.0.0.1")
        limiter.recordSuccess("subject-a", "10.0.0.1")
        repeat(4) { limiter.recordFailure("subject-a", "10.0.0.1") }
        assertThat(limiter.isLocked("subject-a", "10.0.0.1")).isFalse()
    }
}
