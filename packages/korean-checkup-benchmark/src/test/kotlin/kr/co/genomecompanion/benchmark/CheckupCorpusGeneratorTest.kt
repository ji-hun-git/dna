package kr.co.genomecompanion.benchmark

import kr.co.genomecompanion.documentworker.AbstentionReason
import kr.co.genomecompanion.documentworker.NativeTextExtractionProvider
import kr.co.genomecompanion.documentworker.TextBox
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import kotlin.math.max
import kotlin.math.min


class CheckupCorpusGeneratorTest {
    private val font: Path = BenchmarkFont.path()

    @Test
    fun `generates twenty-four documents whose gold the native-text parser reproduces exactly`(@TempDir out: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        val documents = CheckupCorpusGenerator(font).generateAll()
        val corpus = CorpusWriter.write(documents, out)

        assertThat(documents).hasSize(25)
        assertThat(documents.map { it.documentId }).doesNotHaveDuplicates()
        assertThat(Files.list(out).use { paths -> paths.filter { it.toString().endsWith(".pdf") }.count() }).isEqualTo(25L)
        assertThat(Files.exists(out.resolve("corpus.json"))).isTrue()
        assertThat(documents.count { it.imageOnly }).isEqualTo(1)
        assertThat(corpus.corpusId).matches("synthetic-ko-checkup-r2-[0-9a-f]{16}")
        assertThat(corpus.documents.sumOf { it.expectedMeasurements.size })
            .isEqualTo(documents.filter { !it.imageOnly && it.observedOn != null }.sumOf { it.rows.size })

        corpus.documents.zip(documents).forEach { (gold, generated) ->
            val outcome = NativeTextExtractionProvider.extract(generated.bytes)
            assertThat(outcome.candidates.map { listOf(it.label, it.value, it.unit, it.observedOn.toString()) })
                .describedAs(gold.documentId)
                .containsExactlyElementsOf(gold.expectedMeasurements.map { listOf(it.label, it.value, it.unit, it.observedAt) })
            gold.expectedMeasurements.zip(outcome.candidates).forEach { (expected, actual) ->
                assertThat(actual.evidencePage).describedAs(gold.documentId).isEqualTo(expected.evidence.page)
                assertThat("sha256:" + actual.sourceTextSha256)
                    .describedAs("${gold.documentId} ${expected.label}")
                    .isEqualTo(expected.evidence.sourceTextSha256)
                assertThat(iou(expected.evidence.box, actual.evidenceBox))
                    .describedAs("${gold.documentId} ${expected.label}")
                    .isGreaterThanOrEqualTo(0.8)
            }
            gold.requiredAbstentions.forEach { required ->
                assertThat(outcome.abstentions.map { it.label to it.reason.code })
                    .describedAs(gold.documentId)
                    .contains(required.label to required.acceptedReasons.first())
            }
        }
    }

    @Test
    fun `is deterministic for a fixed seed and covers the variant axes`() {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        val generator = CheckupCorpusGenerator(font)
        val first = generator.generate(Layout.NHIS_TABLE, CheckupCorpusGenerator.VARIANTS[1])
        val second = CheckupCorpusGenerator(font).generate(Layout.NHIS_TABLE, CheckupCorpusGenerator.VARIANTS[1])
        assertThat(first.rows.map { it.value }).isEqualTo(second.rows.map { it.value })
        assertThat(first.rows.map { it.label }).contains("Total Cholesterol")
        assertThat(first.rows.first().text).matches("Total Cholesterol \\d+ mg/dL 150-199")

        val korean = generator.generate(Layout.NHIS_TABLE, CheckupCorpusGenerator.VARIANTS[2])
        assertThat(korean.rows.map { it.label }).contains("총콜레스테롤")
        assertThat(korean.rows.map { it.unit }).contains("mg/dl")

        val decimals = generator.generate(Layout.NHIS_TABLE, CheckupCorpusGenerator.VARIANTS[3])
        assertThat(decimals.rows.first().value).matches("\\d+\\.\\d")

        val comma = generator.generate(Layout.CENTER_SUMMARY, CheckupCorpusGenerator.VARIANTS[4])
        assertThat(comma.rows.last().value).matches("\\d{1,2},\\d{3}")

        val tilde = generator.generate(Layout.TWO_PAGE, CheckupCorpusGenerator.VARIANTS[5])
        assertThat(tilde.rows.first().text).contains("~")
        assertThat(tilde.rows.map { it.page }).containsOnly(2)

        val undated = generator.generate(Layout.HOSPITAL_TWO_COLUMN, CheckupCorpusGenerator.VARIANTS[4])
        assertThat(undated.observedOn).isNull()
        assertThat(CorpusWriter.gold(undated).expectedMeasurements).isEmpty()
        assertThat(CorpusWriter.gold(undated).requiredAbstentions.map { it.acceptedReasons }).containsOnly(listOf("missing_evidence"))

        val ambiguous = generator.generate(Layout.CENTER_SUMMARY, CheckupCorpusGenerator.VARIANTS[3])
        assertThat(CorpusWriter.gold(ambiguous).requiredAbstentions)
            .containsExactly(GoldAbstention("ldl-cholesterol", "LDL Cholesterol", listOf("ambiguous_value")))

        val scan = generator.generate(Layout.NHIS_TABLE, CheckupCorpusGenerator.VARIANTS[5])
        assertThat(scan.imageOnly).isTrue()
        assertThat(NativeTextExtractionProvider.extract(scan.bytes).abstentions.single().reason).isEqualTo(AbstentionReason.UNREADABLE)
        assertThat(CorpusWriter.gold(scan).requiredAbstentions)
            .containsExactly(GoldAbstention("document", "문서 전체", listOf("unreadable")))

        val birthDateFirst = generator.generate(Layout.HOSPITAL_TWO_COLUMN, CheckupCorpusGenerator.BIRTH_DATE_VARIANT)
        assertThat(birthDateFirst.documentId).isEqualTo("synthetic-hospital-two-column-v6")
        assertThat(birthDateFirst.observedOn).isEqualTo("2026-01-20")
        val printed = NativeTextExtractionProvider.extractLines(birthDateFirst.bytes).map { it.text }
        assertThat(printed).contains("생년월일: 1987-03-14")
        assertThat(printed.indexOfFirst { it.startsWith("생년월일") })
            .isLessThan(printed.indexOfFirst { it.startsWith("수검자 합성-6") && it.endsWith("검사일: 2026-01-20") })
        val parsedBirthDateFirst = NativeTextExtractionProvider.extract(birthDateFirst.bytes)
        assertThat(parsedBirthDateFirst.observedOn).isEqualTo(java.time.LocalDate.of(2026, 1, 20))
        assertThat(parsedBirthDateFirst.candidates).hasSize(8)
        assertThat(CorpusWriter.gold(birthDateFirst).expectedMeasurements.map { it.observedAt }).containsOnly("2026-01-20")
        assertThat(generator.generateAll().last().documentId).isEqualTo("synthetic-hospital-two-column-v6")
    }

    @Test
    fun `writes byte-identical PDFs and the same corpus id across two generations`(@TempDir first: Path, @TempDir second: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        val a = CorpusWriter.write(CheckupCorpusGenerator(font).generateAll(), first)
        val b = CorpusWriter.write(CheckupCorpusGenerator(font).generateAll(), second)

        val pdfs = Files.list(first).use { paths -> paths.filter { it.toString().endsWith(".pdf") }.toList() }
        assertThat(pdfs).hasSize(25)
        pdfs.forEach { pdf ->
            val bytes = Files.readAllBytes(pdf)
            assertThat(bytes).describedAs(pdf.fileName.toString()).isEqualTo(Files.readAllBytes(second.resolve(pdf.fileName)))
            assertThat(String(bytes, Charsets.ISO_8859_1)).describedAs(pdf.fileName.toString()).doesNotContain("/Metadata")
        }
        assertThat(Files.readAllBytes(first.resolve("corpus.json"))).isEqualTo(Files.readAllBytes(second.resolve("corpus.json")))
        assertThat(a.corpusId).isEqualTo(b.corpusId).matches("synthetic-ko-checkup-r2-[0-9a-f]{16}")
        assertThat(a.corpusId).endsWith(CorpusWriter.pdfDigest(CheckupCorpusGenerator(font).generateAll()).take(16))
    }

    private fun iou(expected: Box, actual: TextBox): Double {
        val left = max(expected.x, actual.x)
        val top = max(expected.y, actual.y)
        val right = min(expected.x + expected.width, actual.x + actual.width)
        val bottom = min(expected.y + expected.height, actual.y + actual.height)
        val intersection = max(0.0, right - left) * max(0.0, bottom - top)
        val union = expected.width * expected.height + actual.width * actual.height - intersection
        return if (union == 0.0) 0.0 else intersection / union
    }
}
