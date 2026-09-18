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


/** One hand-typed row of [CheckupCorpusGeneratorTest.handWrittenConceptTable]. */
private data class ConceptExpectation(val label: String, val unit: String, val expected: String?)


class CheckupCorpusGeneratorTest {
    private val font: Path = BenchmarkFont.path()

    @Test
    fun `generates thirty-one documents whose gold the native-text parser reproduces exactly`(@TempDir out: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        val documents = CheckupCorpusGenerator(font).generateAll()
        val corpus = CorpusWriter.write(documents, out)

        assertThat(documents).hasSize(31)
        assertThat(documents.map { it.documentId }).doesNotHaveDuplicates()
        assertThat(Files.list(out).use { paths -> paths.filter { it.toString().endsWith(".pdf") }.count() }).isEqualTo(31L)
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
                assertThat(actual.referenceRangeText)
                    .describedAs("${gold.documentId} ${expected.label} reference range")
                    .isEqualTo(expected.expectedReferenceRangeText)
            }
            gold.requiredAbstentions.forEach { required ->
                assertThat(outcome.abstentions.map { it.label to it.reason.code })
                    .describedAs(gold.documentId)
                    .contains(required.label to required.acceptedReasons.first())
            }
        }

        val rangedGold = corpus.documents.flatMap { it.expectedMeasurements }.filter { it.expectedReferenceRangeText != null }
        assertThat(rangedGold).isNotEmpty()
        assertThat(rangedGold.map { it.expectedReferenceRangeText!! }).allMatch { Regex("^[0-9.,\\s\\-~–<>≤≥]{1,40}$").matches(it) }
        assertThat(corpus.documents.first { it.documentId == "synthetic-nhis-table-v0" }.expectedMeasurements.map { it.expectedReferenceRangeText })
            .containsOnlyNulls()
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
        // The subject line and its same-baseline exam-date cell are now two positional columns
        // (label at x=56, date at x=320; PositionalLineGrouper splits them, NativeTextExtractionProvider.parse
        // rejoins them later) rather than one pre-joined physical line, so this checks the date cell directly.
        val printed = NativeTextExtractionProvider.extractLines(birthDateFirst.bytes).map { it.text }
        assertThat(printed).contains("생년월일: 1987-03-14")
        assertThat(printed.indexOfFirst { it.startsWith("생년월일") })
            .isLessThan(printed.indexOfFirst { it.startsWith("검사일: 2026-01-20") })
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
        assertThat(pdfs).hasSize(31)
        pdfs.forEach { pdf ->
            val bytes = Files.readAllBytes(pdf)
            assertThat(bytes).describedAs(pdf.fileName.toString()).isEqualTo(Files.readAllBytes(second.resolve(pdf.fileName)))
            assertThat(String(bytes, Charsets.ISO_8859_1)).describedAs(pdf.fileName.toString()).doesNotContain("/Metadata")
        }
        assertThat(Files.readAllBytes(first.resolve("corpus.json"))).isEqualTo(Files.readAllBytes(second.resolve("corpus.json")))
        assertThat(a.corpusId).isEqualTo(b.corpusId).matches("synthetic-ko-checkup-r2-[0-9a-f]{16}")
        assertThat(a.corpusId).endsWith(CorpusWriter.pdfDigest(CheckupCorpusGenerator(font).generateAll()).take(16))
    }

    @Test
    fun `extended panel prints broad labels, new items and unit-mismatched rows with the concept the catalogue rule gives`() {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        val generator = CheckupCorpusGenerator(font)
        val english = generator.generate(Layout.EXTENDED_PANEL, CheckupCorpusGenerator.VARIANTS[1])
        val korean = generator.generate(Layout.EXTENDED_PANEL, CheckupCorpusGenerator.VARIANTS[2])
        assertThat(english.documentId).isEqualTo("synthetic-extended-panel-v1")
        assertThat(english.rows.map { it.label }).contains("Glucose", "hs-CRP", "Bilirubin", "GFR", "UA", "Hb", "MCV", "CA19-9", "RF")
        assertThat(korean.rows.map { it.label }).contains("혈당", "고감도 CRP", "빌리루빈", "사구체여과율", "요산", "혈색소", "인(P)", "혈청철")
        assertThat(english.rows.filter { it.page == 1 }).hasSize(CheckupCorpusGenerator.BROAD_LABEL_ROWS.size)
        assertThat(english.rows.filter { it.page == 2 }).hasSize(CheckupCorpusGenerator.EXTENDED_ROWS.size)

        val gold = CorpusWriter.gold(korean).expectedMeasurements.associateBy { it.label }
        assertThat(gold.getValue("혈당").expectedConceptCode).isEqualTo("glucose")
        assertThat(gold.getValue("사구체여과율").expectedConceptCode).isEqualTo("gfr")
        assertThat(gold.getValue("요산").expectedConceptCode).isNull()
        assertThat(gold.getValue("요산").expectedNoConcept).isTrue()
        assertThat(gold.getValue("혈당").expectedNoConcept).isNull()

        // NOTE (review fix, Wave 5 Task 5 Fix 1): this test used to close with a loop asserting
        // `measurement.expectedConceptCode == MedicalConceptCatalogue.resolve(row.label, row.unit)?.conceptCode`
        // for every generated row. That is tautological: `CorpusWriter.gold()` computes
        // `expectedConceptCode` by calling that exact same `resolve(row.label, row.unit)`, so the assertion
        // was `f(x) == f(x)` — it could never fail, and reverting the catalogue's removal of the bare
        // "Glucose" alias (fix 210eda6) would not have been caught by it. The hand-written concept table
        // in `handWrittenConceptTable` (typed independently of any code path, never computed) below
        // supersedes it: it anchors gold against literal, human-checked expectations instead of the
        // pipeline's own rule.
        assertThat(generator.generateAll().last().documentId).isEqualTo("synthetic-hospital-two-column-v6")
    }

    /**
     * Hand-typed, never computed: printed label + unit → the concept code the catalogue must resolve to,
     * or `null` for "no concept". Verified by hand against
     * `packages/document-boundary/.../MedicalConceptCatalogue.kt` at the time this table was written.
     * If a catalogue change makes an entry here wrong, the fix is to change the catalogue (or, with review,
     * this table) — never to make the table agree by construction.
     */
    private val handWrittenConceptTable = listOf(
        ConceptExpectation("혈당", "mg/dL", "glucose"),
        ConceptExpectation("Glucose", "mg/dL", null),
        ConceptExpectation("GLU", "mg/dL", null),
        ConceptExpectation("Blood Glucose", "mg/dL", "glucose"),
        ConceptExpectation("공복혈당", "mg/dL", "fasting-glucose"),
        ConceptExpectation("FBS", "mg/dL", "fasting-glucose"),
        ConceptExpectation("hs-CRP", "mg/L", "hs-crp"),
        ConceptExpectation("CRP", "mg/L", "crp"),
        ConceptExpectation("Bilirubin", "mg/dL", "bilirubin"),
        ConceptExpectation("빌리루빈", "mg/dL", "bilirubin"),
        ConceptExpectation("T-Bil", "mg/dL", "total-bilirubin"),
        ConceptExpectation("GFR", "mL/min/1.73m²", "gfr"),
        ConceptExpectation("사구체여과율", "mL/min/1.73m²", "gfr"),
        ConceptExpectation("eGFR", "mL/min/1.73m²", "egfr"),
        ConceptExpectation("Cholesterol", "mg/dL", "total-cholesterol"),
        ConceptExpectation("Cholesterol", "mmol/L", "total-cholesterol"),
        ConceptExpectation("UA", "g/dL", null),
        ConceptExpectation("요산", "g/dL", null),
        ConceptExpectation("Hb", "mg/dL", null),
        ConceptExpectation("혈색소", "mg/dL", null),
        ConceptExpectation("MCV", "fL", "mcv"),
        ConceptExpectation("CA19-9", "U/mL", "ca19-9"),
        ConceptExpectation("RF", "IU/mL", "rf"),
    )

    @Test
    fun `hand-written concept table anchors gold against expectations no code path computed`() {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")

        // The table itself, checked directly against the catalogue — independent of the generator entirely.
        handWrittenConceptTable.forEach { row ->
            assertThat(kr.co.genomecompanion.documentboundary.MedicalConceptCatalogue.resolve(row.label, row.unit)?.conceptCode)
                .describedAs("${row.label} ${row.unit}")
                .isEqualTo(row.expected)
        }

        val byLabel = handWrittenConceptTable.associateBy { it.label }
        val generator = CheckupCorpusGenerator(font)
        val extendedPanelDocuments = generator.generateAll().filter { it.layout == Layout.EXTENDED_PANEL && it.observedOn != null }
        assertThat(extendedPanelDocuments).isNotEmpty()

        // (a) Every extended-panel row whose printed label the table covers: gold agrees with the table.
        extendedPanelDocuments.forEach { document ->
            val gold = CorpusWriter.gold(document).expectedMeasurements.associateBy { it.label }
            document.rows.forEach { row ->
                val expectation = byLabel[row.label] ?: return@forEach
                val measurement = gold.getValue(row.label)
                assertThat(measurement.expectedConceptCode)
                    .describedAs("${document.documentId} ${row.label} ${row.unit}")
                    .isEqualTo(expectation.expected)
                assertThat(measurement.expectedNoConcept)
                    .describedAs("${document.documentId} ${row.label} ${row.unit}")
                    .isEqualTo(if (expectation.expected == null) true else null)
            }
        }

        // (b) Every extended-panel row that is a broad concept (no LOINC, deliberately generic: glucose,
        // bilirubin, gfr) or a deliberate unit mismatch (expectNoConcept), in whichever language it printed
        // in, has its printed label in the table — nothing broad or mismatched is left unchecked.
        val broadConceptCodes = setOf("glucose", "bilirubin", "gfr")
        val printedBroadOrMismatchedLabels = extendedPanelDocuments.flatMap { it.rows }
            .filter { it.spec.conceptCode in broadConceptCodes || it.spec.expectNoConcept }
            .map { it.label }
            .toSet()
        assertThat(printedBroadOrMismatchedLabels).isNotEmpty()
        assertThat(byLabel.keys).containsAll(printedBroadOrMismatchedLabels)
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
