package kr.co.genomecompanion.documentworker

import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock
import java.time.Duration
import java.time.Instant

data class HealthReport(val ready: Boolean, val code: String)

/**
 * The wall clock one iteration of the poll loop is allowed to take, phase by phase, and the
 * heartbeat bound derived from it.
 *
 * `loop-stalled` has to mean "the loop is wedged", never "this job is long". A legitimate
 * iteration is lease + source fetch + render/inspect + result POST, each with its own timeout,
 * and their sum is the longest an honest iteration can run before every phase has timed out.
 * [DocumentWorker.runOnce] refreshes the heartbeat at every one of those boundaries, so in
 * practice only a single phase ever has to fit inside the bound; the sum plus [MARGIN] is the
 * conservative form of the same bound, and it still trips well inside a supervisor's own
 * readiness grace period.
 *
 * MAX_HEARTBEAT_AGE = LEASE + SOURCE + PROCESS + RESULT + MARGIN = 10 + 20 + 60 + 20 + 30 = 140 s
 *
 * Each constant mirrors the timeout actually configured at that phase: `BoundaryApiClient.lease`
 * (10 s), `BoundaryApiClient.source` (20 s), `PageRenderSubprocess.render`'s default wall clock
 * (60 s, which also covers `ClamAvCommandScanner`'s shorter 30 s scan), and the result POST
 * (20 s). Change a timeout there and change it here.
 */
object WorkerLoopBudget {
    val LEASE: Duration = Duration.ofSeconds(10)
    val SOURCE: Duration = Duration.ofSeconds(20)
    val PROCESS: Duration = Duration.ofSeconds(60)
    val RESULT: Duration = Duration.ofSeconds(20)

    /** Room for process scheduling, GC pauses and the health poll interval itself. */
    val MARGIN: Duration = Duration.ofSeconds(30)

    val MAX_HEARTBEAT_AGE: Duration = LEASE + SOURCE + PROCESS + RESULT + MARGIN
}

/** Real checks in a fixed order; the first failure names the reason. `signatureDir == null` means the synthetic scanner (tests/e2e only). */
class WorkerHealth(
    private val coreProbe: () -> Boolean,
    private val signatureDir: Path?,
    private val maxSignatureAge: Duration = Duration.ofDays(7),
    private val loopHeartbeat: () -> Instant,
    private val clock: Clock,
    private val maxHeartbeatAge: Duration = WorkerLoopBudget.MAX_HEARTBEAT_AGE,
) {
    fun check(): HealthReport {
        if (!runCatching { coreProbe() }.getOrDefault(false)) return HealthReport(false, "core-unreachable")
        if (signatureDir != null) {
            val main = firstExisting(signatureDir, "main.cvd", "main.cld")
            val daily = firstExisting(signatureDir, "daily.cvd", "daily.cld")
            if (main == null || daily == null) return HealthReport(false, "scan-unavailable")
            val newest = listOf(main, daily).maxOf { Files.getLastModifiedTime(it).toInstant() }
            if (Duration.between(newest, Instant.now(clock)) > maxSignatureAge) return HealthReport(false, "signatures-stale")
        }
        if (Duration.between(loopHeartbeat(), Instant.now(clock)) > maxHeartbeatAge) return HealthReport(false, "loop-stalled")
        return HealthReport(true, "ready")
    }

    private fun firstExisting(dir: Path, vararg names: String): Path? = names.map(dir::resolve).firstOrNull { Files.isRegularFile(it) }
}
