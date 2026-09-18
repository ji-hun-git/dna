package kr.co.genomecompanion.foundation

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/**
 * In-memory limiter for POST /session: a per-key bucket of N attempts per minute and a lock after
 * five failures. Keys are a subject hash and a client IP; neither is logged. Per process only — a
 * hosted deployment with several replicas needs a shared store (recorded as a hosted gate).
 */
@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class SessionRateLimiter(private val properties: FoundationProperties, private val clock: Clock) {
    private class Bucket(var windowStart: Instant, var count: Int)
    private class Failures(var count: Int, var lockedUntil: Instant?)

    private val buckets = ConcurrentHashMap<String, Bucket>()
    private val failures = ConcurrentHashMap<String, Failures>()

    fun tryAcquire(subjectKey: String, ipKey: String): Boolean = acquire("s:$subjectKey") and acquire("i:$ipKey")

    fun isLocked(subjectKey: String, ipKey: String): Boolean = locked("s:$subjectKey") || locked("i:$ipKey")

    fun recordFailure(subjectKey: String, ipKey: String) { fail("s:$subjectKey"); fail("i:$ipKey") }

    fun recordSuccess(subjectKey: String, ipKey: String) { failures.remove("s:$subjectKey"); failures.remove("i:$ipKey") }

    fun clear() { buckets.clear(); failures.clear() }

    private fun acquire(key: String): Boolean {
        val now = Instant.now(clock)
        var allowed = false
        buckets.compute(key) { _, existing ->
            val bucket = existing?.takeIf { it.windowStart.plusSeconds(60).isAfter(now) } ?: Bucket(now, 0)
            if (bucket.count < properties.sessionRateLimitPerMinute) { bucket.count += 1; allowed = true }
            bucket
        }
        return allowed
    }

    private fun locked(key: String): Boolean {
        val until = failures[key]?.lockedUntil ?: return false
        if (until.isAfter(Instant.now(clock))) return true
        failures.remove(key)
        return false
    }

    private fun fail(key: String) {
        val now = Instant.now(clock)
        failures.compute(key) { _, existing ->
            val state = existing ?: Failures(0, null)
            state.count += 1
            if (state.count >= properties.sessionFailureLockThreshold) { state.lockedUntil = now.plus(properties.sessionFailureLockDuration); state.count = 0 }
            state
        }
    }
}
