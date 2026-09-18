package kr.co.genomecompanion.documentworker

import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock
import java.time.Duration
import java.time.Instant

data class HealthReport(val ready: Boolean, val code: String)

/** Real checks in a fixed order; the first failure names the reason. `signatureDir == null` means the synthetic scanner (tests/e2e only). */
class WorkerHealth(
    private val coreProbe: () -> Boolean,
    private val signatureDir: Path?,
    private val maxSignatureAge: Duration = Duration.ofDays(7),
    private val loopHeartbeat: () -> Instant,
    private val clock: Clock,
    private val maxHeartbeatAge: Duration = Duration.ofSeconds(120),
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
