package kr.co.genomecompanion.benchmark

import com.fasterxml.jackson.databind.JsonNode
import kr.co.genomecompanion.documentworker.NativeTextExtractionProvider
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path


class HandLabelledFixturesTest {
    private val font: Path = BenchmarkFont.path()

    @Test
    fun `draws three synthetic layouts, marks them synthetic and is byte-deterministic`(@TempDir first: Path, @TempDir second: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        assertThat(HandLabelledFixtures.ids).containsExactly("synthetic-hand-nhis-notice", "synthetic-hand-hospital-four-column", "synthetic-hand-scan-with-invisible-text")
        val a = HandLabelledFixtures.writeAll(first, font)
        val b = HandLabelledFixtures.writeAll(second, font)
        assertThat(a.corpusId).matches("synthetic-ko-hand-labelled-[0-9a-f]{16}").isEqualTo(b.corpusId)
        HandLabelledFixtures.ids.forEach { id ->
            val bytes = Files.readAllBytes(first.resolve("$id.pdf"))
            assertThat(String(bytes, 0, 40, Charsets.ISO_8859_1)).contains("%GC-SYNTHETIC-ONLY")
            assertThat(bytes).containsExactly(*Files.readAllBytes(second.resolve("$id.pdf")))
        }
    }

    @Test
    fun `every expectation file is hand-typed, well-formed and names only closed reasons`() {
        HandLabelledFixtures.ids.forEach { id ->
            val expected: JsonNode = HandLabelledFixtures.expectation(id)
            assertThat(expected["schemaVersion"].asText()).isEqualTo("hand-labelled-expectation.v1")
            assertThat(expected["documentId"].asText()).isEqualTo(id)
            expected["abstentions"].forEach { assertThat(it["reason"].asText()).isIn(kr.co.genomecompanion.documentworker.AbstentionReason.CODES) }
            expected["candidates"].forEach { assertThat(it["value"].asText()).matches("^-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$") }
        }
    }

    @Test
    fun `reports the parser's agreement with the hand-typed expectations without asserting perfection`(@TempDir out: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        HandLabelledFixtures.writeAll(out, font)
        val runs = HandLabelledRunner.run(out)
        assertThat(runs.map { it.documentId }).containsExactlyElementsOf(HandLabelledFixtures.ids)
        val scan = runs.first { it.documentId == "synthetic-hand-scan-with-invisible-text" }
        assertThat(scan.candidates).isEmpty()
        assertThat(scan.abstentions.map { it.reason }).containsExactly("unreadable")
        val notice = runs.first { it.documentId == "synthetic-hand-nhis-notice" }
        // Printed for the evidence file; the TypeScript gate pins the floor. This test only pins the invariant that nothing hallucinated.
        val expectedLabels = HandLabelledFixtures.expectation("synthetic-hand-nhis-notice")["candidates"].map { it["label"].asText() }
        assertThat(notice.candidates.map { it.label }).allMatch { it in expectedLabels }
        println("hand-labelled nhis-notice candidates=${notice.candidates.size}/${expectedLabels.size} abstentions=${notice.abstentions.map { it.reason }}")
    }
}
