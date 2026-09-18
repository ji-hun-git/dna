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

    @Test
    fun `idle sweep evicts stale keys but never shortens an active lock or an unexpired bucket`() {
        val clock = MutableClock(Instant.parse("2026-09-18T00:00:00Z"))
        val limiter = SessionRateLimiter(properties(10), clock)

        // Warm-up call: the very first acquire ever always runs a (no-op, maps empty) sweep and
        // anchors the internal "last swept at" clock to t=0, so later timings below are exact.
        limiter.tryAcquire("warm-up", "10.0.0.1")

        clock.now = clock.now.plus(Duration.ofSeconds(1))
        // A bucket that will go idle (never touched again) and must be swept away.
        limiter.tryAcquire("idle-subject", "10.0.0.9")

        clock.now = clock.now.plus(Duration.ofSeconds(19)) // t = 20s
        // A bucket that is only partially drained; it will be touched again below and must survive.
        limiter.tryAcquire("active-subject", "10.0.0.8")
        // Lock "locked-subject" for fifteen minutes; this must survive any number of sweeps.
        repeat(5) { limiter.recordFailure("locked-subject", "10.0.0.7") }
        assertThat(limiter.isLocked("locked-subject", "10.0.0.7")).isTrue()

        // warm-up(2) + idle-subject(2) buckets, active-subject(2) bucket, locked-subject(2) failures.
        val trackedAfterSetup = limiter.trackedKeys()
        assertThat(trackedAfterSetup).isEqualTo(8)

        // Touch "active-subject" again well inside the 1-minute idle TTL, so its last-touch moves
        // forward while "idle-subject", "warm-up" and "locked-subject" are left untouched.
        clock.now = clock.now.plus(Duration.ofSeconds(35)) // t = 55s
        assertThat(limiter.tryAcquire("active-subject", "10.0.0.8")).isTrue()

        // Advance so a sweep becomes due (>= 1 minute since the warm-up sweep at t=0), while
        // "active-subject" (last touched at t=55s) is still well within its own idle TTL, and its
        // 60-second rate-limit window (started at t=20s) has not yet naturally rolled over either.
        clock.now = clock.now.plus(Duration.ofSeconds(6)) // t = 61s
        limiter.recordFailure("trigger-sweep", "10.0.0.100") // any acquire/fail call runs the sweep

        // "warm-up" (idle 61s) and "idle-subject" (idle 60s) were evicted; "trigger-sweep" added
        // two fresh failure entries; "active-subject" and "locked-subject" were untouched by the
        // sweep: 8 - 4 evicted + 2 added = 6.
        assertThat(limiter.trackedKeys()).isEqualTo(6)

        // The still-recently-touched "active-subject" bucket was not reset by the sweep: it had
        // already used 2 of its 10 tokens (t=20s, t=55s), so exactly 8 more succeed before its
        // window (valid until t=80s) is exhausted — never a full fresh 10.
        repeat(8) { assertThat(limiter.tryAcquire("active-subject", "10.0.0.8")).isTrue() }
        assertThat(limiter.tryAcquire("active-subject", "10.0.0.8")).isFalse()

        // The active lock survived the sweep untouched: still locked well before 15 minutes pass.
        assertThat(limiter.isLocked("locked-subject", "10.0.0.7")).isTrue()
    }
}
