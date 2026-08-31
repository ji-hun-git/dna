package kr.co.genomecompanion.documentworker

import kr.co.genomecompanion.documentboundary.InspectionDecision
import kr.co.genomecompanion.documentboundary.InspectionReason
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.junit.jupiter.api.io.TempDir
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.util.HexFormat


@EnabledIfEnvironmentVariable(named = "GC_TEST_CLAMSCAN_PATH", matches = ".+")
class ClamAvCommandScannerIntegrationTest {
    @TempDir
    lateinit var temporaryDirectory: Path

    @Test
    fun executesPinnedEngineAndDistinguishesCleanFromSyntheticMarker() {
        val binaryPrefix = byteArrayOf(0, 1, 2, 3, 0x7f, 0x80.toByte(), 0xff.toByte())
        val marker = binaryPrefix + "Genome Companion synthetic scanner marker; no health data"
            .toByteArray(StandardCharsets.UTF_8)
        val clean = binaryPrefix + "Genome Companion clean scanner payload; no health data"
            .toByteArray(StandardCharsets.UTF_8)
        val database = temporaryDirectory.resolve("gc-synthetic-test.hsb")
        Files.writeString(
            database,
            "${sha256(marker)}:${marker.size}:GC.Test.SyntheticMarker\n",
            StandardCharsets.UTF_8,
        )
        val scanner = ClamAvCommandScanner(
            executable = Path.of(System.getenv().getValue("GC_TEST_CLAMSCAN_PATH")),
            requiredVersion = "1.5.4",
            database = database,
        )

        val cleanResult = scanner.scan(clean)
        assertThat(cleanResult.decision).isEqualTo(InspectionDecision.APPROVED)
        assertThat(cleanResult.reason).isEqualTo(InspectionReason.CLEAN)
        assertThat(cleanResult.scannerName).isEqualTo("ClamAV")
        assertThat(cleanResult.scannerVersion).isEqualTo("1.5.4")
        assertThat(cleanResult.signatureVersion).isNotBlank()

        val detectedResult = scanner.scan(marker)
        assertThat(detectedResult.decision).isEqualTo(InspectionDecision.REJECTED)
        assertThat(detectedResult.reason).isEqualTo(InspectionReason.MALWARE_DETECTED)
        assertThat(detectedResult.scannerName).isEqualTo("ClamAV")
        assertThat(detectedResult.scannerVersion).isEqualTo("1.5.4")
        assertThat(detectedResult.signatureVersion).isEqualTo(cleanResult.signatureVersion)
    }

    private fun sha256(bytes: ByteArray): String = HexFormat.of().formatHex(
        MessageDigest.getInstance("SHA-256").digest(bytes),
    )
}
