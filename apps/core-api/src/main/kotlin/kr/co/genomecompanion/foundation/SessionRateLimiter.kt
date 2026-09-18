package kr.co.genomecompanion.foundation

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

/**
 * In-memory limiter for POST /session: a per-key bucket of N attempts per minute and a lock after
 * five failures. Keys are a subject hash and a client IP; neither is logged. Per process only — a
 * hosted deployment with several replicas needs a shared store (recorded as a hosted gate).
 *
 * Idle eviction: attacker-controlled keys (arbitrary subject IDs, spoofable-ish IPs) must not grow
 * these maps without bound. On each `acquire`/`fail` call, at most once per [SWEEP_INTERVAL], a
 * sweep drops bucket entries that are both idle (untouched) longer than [BUCKET_IDLE_TTL] and
 * failure entries whose lock (if any) has expired and whose last failure is older than the lock
 * window itself. A bucket idle longer than its own 60-second window is, by construction, already
 * conceptually "full" — the next `acquire` for that key would allocate a fresh `Bucket(now, 0)`
 * regardless, so evicting it early never refills tokens early. A failure entry is only evicted once
 * any lock it holds has expired, so an active lock is never shortened by a sweep.
 */
@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class SessionRateLimiter(private val properties: FoundationProperties, private val clock: Clock) {
    private class Bucket(var windowStart: Instant, var count: Int, var lastTouch: Instant)
    private class Failures(var count: Int, var lockedUntil: Instant?, var lastFailureAt: Instant)

    private companion object {
        val BUCKET_IDLE_TTL: Duration = Duration.ofMinutes(1)
        val SWEEP_INTERVAL: Duration = Duration.ofMinutes(1)
    }

    private val buckets = ConcurrentHashMap<String, Bucket>()
    private val failures = ConcurrentHashMap<String, Failures>()
    private val lastSweep = AtomicReference(Instant.EPOCH)

    fun tryAcquire(subjectKey: String, ipKey: String): Boolean = acquire("s:$subjectKey") and acquire("i:$ipKey")

    fun isLocked(subjectKey: String, ipKey: String): Boolean = locked("s:$subjectKey") || locked("i:$ipKey")

    fun recordFailure(subjectKey: String, ipKey: String) { fail("s:$subjectKey"); fail("i:$ipKey") }

    fun recordSuccess(subjectKey: String, ipKey: String) { failures.remove("s:$subjectKey"); failures.remove("i:$ipKey") }

    fun clear() { buckets.clear(); failures.clear() }

    /** Total tracked keys across both maps — for tests to assert eviction actually shrinks state. */
    internal fun trackedKeys(): Int = buckets.size + failures.size

    private fun acquire(key: String): Boolean {
        val now = Instant.now(clock)
        maybeSweep(now)
        var allowed = false
        buckets.compute(key) { _, existing ->
            val bucket = existing?.takeIf { it.windowStart.plusSeconds(60).isAfter(now) } ?: Bucket(now, 0, now)
            if (bucket.count < properties.sessionRateLimitPerMinute) { bucket.count += 1; allowed = true }
            bucket.lastTouch = now
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
        maybeSweep(now)
        failures.compute(key) { _, existing ->
            val state = existing ?: Failures(0, null, now)
            state.count += 1
            state.lastFailureAt = now
            if (state.count >= properties.sessionFailureLockThreshold) { state.lockedUntil = now.plus(properties.sessionFailureLockDuration); state.count = 0 }
            state
        }
    }

    /** At most once per [SWEEP_INTERVAL], drop idle bucket/failure entries. Never shortens an active lock or refills a bucket early. */
    private fun maybeSweep(now: Instant) {
        val previous = lastSweep.get()
        if (Duration.between(previous, now) < SWEEP_INTERVAL) return
        if (!lastSweep.compareAndSet(previous, now)) return

        buckets.entries.removeIf { (_, bucket) -> Duration.between(bucket.lastTouch, now) >= BUCKET_IDLE_TTL }
        failures.entries.removeIf { (_, state) ->
            val lockExpired = state.lockedUntil == null || !state.lockedUntil!!.isAfter(now)
            lockExpired && Duration.between(state.lastFailureAt, now) >= properties.sessionFailureLockDuration
        }
    }
}
