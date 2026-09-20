package kr.co.genomecompanion.foundation

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/**
 * In-memory limiter for POST /session: a per-key bucket of N attempts per minute and a lock after
 * five failures. Keys are a subject hash and a client IP; neither is logged. Per process only — a
 * hosted deployment with several replicas needs a shared store (recorded as a hosted gate).
 *
 * The bucket half lives in [TokenBucketWindow], shared with the worker boundary's per-worker-id
 * budget; this class keeps only what is specific to sessions — the failure counter and its lock.
 *
 * Idle eviction: attacker-controlled keys (arbitrary subject IDs, spoofable-ish IPs) must not grow
 * these maps without bound. [TokenBucketWindow] sweeps its own idle buckets at most once a minute and
 * calls [sweepFailures] on the same schedule, from both the acquire and the failure path, so a caller
 * that only ever fails still ages out both maps. A failure entry is only evicted once any lock it
 * holds has expired, so an active lock is never shortened by a sweep.
 */
@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class SessionRateLimiter(private val properties: FoundationProperties, private val clock: Clock) {
    private class Failures(var count: Int, var lockedUntil: Instant?, var lastFailureAt: Instant)

    private val buckets = TokenBucketWindow(clock) { properties.sessionRateLimitPerMinute }
    private val failures = ConcurrentHashMap<String, Failures>()

    fun tryAcquire(subjectKey: String, ipKey: String): Boolean = acquire("s:$subjectKey") and acquire("i:$ipKey")

    fun isLocked(subjectKey: String, ipKey: String): Boolean = locked("s:$subjectKey") || locked("i:$ipKey")

    fun recordFailure(subjectKey: String, ipKey: String) { fail("s:$subjectKey"); fail("i:$ipKey") }

    fun recordSuccess(subjectKey: String, ipKey: String) { failures.remove("s:$subjectKey"); failures.remove("i:$ipKey") }

    fun clear() { buckets.clear(); failures.clear() }

    /** Total tracked keys across both maps — for tests to assert eviction actually shrinks state. */
    internal fun trackedKeys(): Int = buckets.size() + failures.size

    private fun acquire(key: String): Boolean = buckets.tryAcquire(key, ::sweepFailures)

    private fun locked(key: String): Boolean {
        val until = failures[key]?.lockedUntil ?: return false
        if (until.isAfter(Instant.now(clock))) return true
        failures.remove(key)
        return false
    }

    private fun fail(key: String) {
        val now = Instant.now(clock)
        buckets.maybeSweep(now, ::sweepFailures)
        failures.compute(key) { _, existing ->
            val state = existing ?: Failures(0, null, now)
            state.count += 1
            state.lastFailureAt = now
            if (state.count >= properties.sessionFailureLockThreshold) { state.lockedUntil = now.plus(properties.sessionFailureLockDuration); state.count = 0 }
            state
        }
    }

    /** Drops failure entries whose lock (if any) has expired and whose last failure is older than the
     * lock window itself. Never shortens an active lock. */
    private fun sweepFailures(now: Instant) {
        failures.entries.removeIf { (_, state) ->
            val lockExpired = state.lockedUntil == null || !state.lockedUntil!!.isAfter(now)
            lockExpired && Duration.between(state.lastFailureAt, now) >= properties.sessionFailureLockDuration
        }
    }
}
