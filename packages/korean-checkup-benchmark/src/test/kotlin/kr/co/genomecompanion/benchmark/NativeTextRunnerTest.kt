package kr.co.genomecompanion.benchmark

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Locale


class NativeTextRunnerTest {
    private val font: Path = BenchmarkFont.path()

    @Test
    fun `writes one medical-document-run v1 record per corpus document`(@TempDir out: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        CorpusWriter.write(CheckupCorpusGenerator(font).generateAll(), out)

        val runs = NativeTextRunner.run(out, OffsetDateTime.of(2026, 9, 16, 9, 0, 0, 0, ZoneOffset.UTC))

        assertThat(runs).hasSize(25)
        val run = runs.first { it.documentId == "synthetic-nhis-table-v0" }
        assertThat(run.schemaVersion).isEqualTo("medical-document-run.v1")
        assertThat(run.pipelineId).isEqualTo("pdfbox-native-text")
        assertThat(run.runId).isEqualTo("run-native-text-nhis-table-v0")
        assertThat(run.documentSha256).matches("sha256:[0-9a-f]{64}")
        assertThat(run.documentType).isEqualTo("health-screening-lab-report")
        assertThat(run.language).isEqualTo("ko-KR")
        assertThat(run.synthetic).isTrue()
        assertThat(run.createdAt).isEqualTo("2026-09-16T09:00:00Z")
        assertThat(run.models.layout.modelId).isEqualTo("pdfbox-native-text")
        assertThat(run.models.layout.executionMode).isEqualTo("offline-pinned")
        assertThat(run.models.layout.artifactSha256).matches("sha256:[0-9a-f]{64}")
        assertThat(run.models.semantic).isEqualTo(run.models.layout)
        assertThat(run.candidates).hasSize(8)
        assertThat(run.candidates.map { it.fieldId }).containsExactly(
            "total-cholesterol", "ldl-cholesterol", "hdl-cholesterol", "triglycerides",
            "fasting-glucose", "hba1c", "hemoglobin", "creatinine",
        )
        assertThat(run.candidates.map { it.evidence.blockId })
            .containsExactlyElementsOf((1..8).map { String.format(Locale.ROOT, "block-row-%02d", it) })
        assertThat(run.candidates.map { it.confidence }).containsOnly(1.0)
        assertThat(run.candidates.map { it.observedAt }).containsOnly("2026-07-28")

        val scan = runs.first { it.documentId == "synthetic-nhis-table-v5" }
        assertThat(scan.candidates).isEmpty()
        assertThat(scan.abstentions.map { it.fieldId to it.reason }).containsExactly("document" to "unreadable")

        val undated = runs.first { it.documentId == "synthetic-hospital-two-column-v4" }
        assertThat(undated.candidates).isEmpty()
        assertThat(undated.abstentions.map { it.reason }).containsOnly("missing_evidence")
        assertThat(undated.abstentions.map { it.fieldId }).contains("ast", "alt", "gamma-gtp")

        val birthDateFirst = runs.first { it.documentId == "synthetic-hospital-two-column-v6" }
        assertThat(birthDateFirst.candidates.map { it.observedAt }).containsOnly("2026-01-20")
        assertThat(birthDateFirst.abstentions).isEmpty()

        val ranged = runs.first { it.documentId == "synthetic-nhis-table-v1" }
        assertThat(ranged.candidates.map { it.referenceRangeText }).containsExactly(
            "150-199", "70-129", "45-70", "60-149", "80-99", "4.8-5.6", "12.5-15.5", "0.60-1.10",
        )
        assertThat(runs.first { it.documentId == "synthetic-center-summary-v5" }.candidates.map { it.referenceRangeText })
            .contains("155.0~180.0")
        assertThat(BenchmarkJson.mapper.writeValueAsString(ranged)).contains("\"referenceRangeText\":\"150-199\"")
        assertThat(run.candidates.map { it.referenceRangeText }).containsOnlyNulls()

        val json = BenchmarkJson.mapper.writeValueAsString(run)
        assertThat(json).doesNotContain("referenceRange").doesNotContain("null")
    }
}
