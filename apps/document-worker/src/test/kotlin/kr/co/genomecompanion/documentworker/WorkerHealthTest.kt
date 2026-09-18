package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.FileTime
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset


class WorkerHealthTest {
    private val now = Instant.parse("2026-09-18T10:00:00Z")
    private val clock = Clock.fixed(now, ZoneOffset.UTC)

    @Test
    fun `reports the first failing check in order and ready when all pass`(@TempDir signatures: Path) {
        var core = false
        var heartbeat = now.minusSeconds(600)
        val health = WorkerHealth(coreProbe = { core }, signatureDir = signatures, loopHeartbeat = { heartbeat }, clock = clock)
        assertThat(health.check()).isEqualTo(HealthReport(false, "core-unreachable"))
        core = true
        assertThat(health.check()).isEqualTo(HealthReport(false, "scan-unavailable"))
        Files.writeString(signatures.resolve("main.cvd"), "x"); Files.writeString(signatures.resolve("daily.cld"), "x")
        Files.setLastModifiedTime(signatures.resolve("daily.cld"), FileTime.from(now.minus(Duration.ofDays(8))))
        Files.setLastModifiedTime(signatures.resolve("main.cvd"), FileTime.from(now.minus(Duration.ofDays(30))))
        assertThat(health.check()).isEqualTo(HealthReport(false, "signatures-stale"))
        Files.setLastModifiedTime(signatures.resolve("daily.cld"), FileTime.from(now.minus(Duration.ofDays(1))))
        assertThat(health.check()).isEqualTo(HealthReport(false, "loop-stalled"))
        heartbeat = now.minusSeconds(5)
        assertThat(health.check()).isEqualTo(HealthReport(true, "ready"))
    }

    @Test
    fun `a synthetic-scanner worker without a signature directory skips the signature checks`() {
        val health = WorkerHealth(coreProbe = { true }, signatureDir = null, loopHeartbeat = { now }, clock = clock)
        assertThat(health.check()).isEqualTo(HealthReport(true, "ready"))
    }
}
