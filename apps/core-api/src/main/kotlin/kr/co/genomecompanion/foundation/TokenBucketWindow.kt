package kr.co.genomecompanion.foundation

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

/**
 * One fixed-window token bucket per key, with the idle eviction every caller of it needs.
 *
 * Extracted from [SessionRateLimiter] when a second caller appeared ([DocumentWorkerCredentialFilter]'s
 * per-worker-id budget): the *policy* differs between callers (which key, which limit, what else is
 * tracked alongside), but the bucket and sweep *mechanics* are identical, and a copy of the eviction
 * rules is exactly the kind of duplicate that drifts silently. [limitPerMinute] is a lambda, not a
 * number, so a caller reads its own live property on every acquire rather than snapshotting it at
 * construction.
 *
 * Keys are attacker-influenced (arbitrary subject ids, spoofable-ish IPs, worker ids presented in a
 * header), so the map must not grow without bound: at most once per [SWEEP_INTERVAL] an acquire drops
 * every bucket untouched for at least [BUCKET_IDLE_TTL]. A bucket idle longer than its own 60-second
 * window is by construction already "full" — the next acquire for that key would allocate a fresh
 * `Bucket(now, 0)` anyway — so evicting it early never refills tokens early.
 *
 * [alsoSweep] lets an owner evict its own companion state (e.g. [SessionRateLimiter]'s failure/lock
 * entries) on the same once-a-minute schedule and from the same call sites, so that a caller which
 * only ever records failures still gets both maps swept. Per process only.
 */
class TokenBucketWindow(
    private val clock: Clock,
    private val limitPerMinute: () -> Int,
) {
    private class Bucket(var windowStart: Instant, var count: Int, var lastTouch: Instant)

    private companion object {
        val BUCKET_IDLE_TTL: Duration = Duration.ofMinutes(1)
        val SWEEP_INTERVAL: Duration = Duration.ofMinutes(1)
    }

    private val buckets = ConcurrentHashMap<String, Bucket>()
    private val lastSweep = AtomicReference(Instant.EPOCH)

    /** Spends one token for [key], sweeping first. False once the key's per-minute limit is reached. */
    fun tryAcquire(key: String, alsoSweep: (Instant) -> Unit = {}): Boolean {
        val now = Instant.now(clock)
        maybeSweep(now, alsoSweep)
        var allowed = false
        buckets.compute(key) { _, existing ->
            val bucket = existing?.takeIf { it.windowStart.plusSeconds(60).isAfter(now) } ?: Bucket(now, 0, now)
            if (bucket.count < limitPerMinute()) {
                bucket.count += 1
                allowed = true
            }
            bucket.lastTouch = now
            bucket
        }
        return allowed
    }

    /** Runs the once-per-[SWEEP_INTERVAL] eviction without spending a token, for owners whose other
     * entry points (e.g. recording a failure) must keep the sweep schedule alive. */
    fun maybeSweep(now: Instant, alsoSweep: (Instant) -> Unit = {}) {
        val previous = lastSweep.get()
        if (Duration.between(previous, now) < SWEEP_INTERVAL) return
        if (!lastSweep.compareAndSet(previous, now)) return
        buckets.entries.removeIf { (_, bucket) -> Duration.between(bucket.lastTouch, now) >= BUCKET_IDLE_TTL }
        alsoSweep(now)
    }

    fun clear() {
        buckets.clear()
    }

    /** Tracked keys — for tests to assert eviction actually shrinks state. */
    internal fun size(): Int = buckets.size
}
