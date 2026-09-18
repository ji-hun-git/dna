package kr.co.genomecompanion.documentworker

import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.common.PDRectangle
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.time.LocalDate
import java.util.HexFormat


class NativeTextExtractionProviderTest {
    @Test
    fun `reads the July demo document in document order with page and box evidence`() {
        val outcome = NativeTextExtractionProvider.extract(SyntheticResultPdf.july)

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
        assertThat(outcome.abstentions).isEmpty()
        assertThat(outcome.candidates.map { it.ordinal }).containsExactly(1, 2, 3)
        assertThat(outcome.candidates.map { it.label }).containsExactly("Cholesterol", "HbA1c", "Vitamin D")
        assertThat(outcome.candidates.map { it.value }).containsExactly("188", "5.2", "42")
        assertThat(outcome.candidates.map { it.unit }).containsExactly("mg/dL", "%", "ng/mL")
        assertThat(outcome.candidates.map { it.evidencePage }).containsOnly(1)
        outcome.candidates.forEach { candidate ->
            assertThat(candidate.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
            assertThat(candidate.evidenceBox.x).isBetween(0.0, 1.0)
            assertThat(candidate.evidenceBox.y).isBetween(0.0, 1.0)
            assertThat(candidate.evidenceBox.width).isBetween(0.01, 1.0)
            assertThat(candidate.evidenceBox.height).isBetween(0.001, 1.0)
            assertThat(candidate.evidenceBox.x + candidate.evidenceBox.width).isLessThanOrEqualTo(1.0)
            assertThat(candidate.evidenceBox.y + candidate.evidenceBox.height).isLessThanOrEqualTo(1.0)
        }
        assertThat(outcome.candidates.map { it.evidenceBox.y }).isSorted()
        assertThat(outcome.candidates[0].sourceTextSha256).isEqualTo(sha256("Cholesterol: 188 mg/dL"))
    }

    @Test
    fun `reads the January demo document with its own date and values`() {
        val outcome = NativeTextExtractionProvider.extract(SyntheticResultPdf.january)

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 1, 15))
        assertThat(outcome.candidates.map { it.value }).containsExactly("194", "5.4", "45")
        assertThat(outcome.candidates.map { it.label }).containsExactly("Cholesterol", "HbA1c", "Vitamin D")
    }

    @Test
    fun `abstains for the whole document when the PDF has no text layer`() {
        val outcome = NativeTextExtractionProvider.extract(imageOnlyPdf())

        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.observedOn).isNull()
        assertThat(outcome.abstentions).containsExactly(
            ParsedAbstention(NativeTextExtractionProvider.DOCUMENT_LABEL, AbstentionReason.UNREADABLE, null),
        )
    }

    @Test
    fun `abstains for the whole document when the bytes are not a PDF`() {
        val outcome = NativeTextExtractionProvider.extract("not a pdf".toByteArray())

        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions.single().reason).isEqualTo(AbstentionReason.UNREADABLE)
    }

    @Test
    fun `parses Korean labels dotted and Korean dates comma thousands and unit variants`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines(
                "검진일 2026년 5월 9일",
                "총콜레스테롤 188 mg/dl 120-199",
                "백혈구 6,200 /uL (참고 4,000-10,000)",
                "· 당화혈색소 5.2 % (참고 4.0~5.6)",
                "페이지 2쪽",
            ),
        )

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 5, 9))
        assertThat(outcome.abstentions).isEmpty()
        assertThat(outcome.candidates.map { it.label }).containsExactly("총콜레스테롤", "백혈구", "당화혈색소")
        assertThat(outcome.candidates.map { it.value }).containsExactly("188", "6,200", "5.2")
        assertThat(outcome.candidates.map { it.unit }).containsExactly("mg/dl", "/uL", "%")
        assertThat(outcome.candidates.map { it.evidencePage }).containsOnly(1)
    }

    @Test
    fun `prefers a labelled date over an earlier bare date and accepts dotted dates`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("발급 2026-09-01", "Date: 2026.07.28", "Cholesterol 188 mg/dL"),
        )

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
    }

    @Test
    fun `turns every measurement into a missing_evidence abstention when no date exists`() {
        val outcome = NativeTextExtractionProvider.parse(lines("AST 24 U/L", "ALT 19 U/L"))

        assertThat(outcome.observedOn).isNull()
        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(
            ParsedAbstention("AST", AbstentionReason.MISSING_EVIDENCE, 1),
            ParsedAbstention("ALT", AbstentionReason.MISSING_EVIDENCE, 1),
        )
    }

    @Test
    fun `folds ambiguous rows into missing_evidence abstentions when the document has no date`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("LDL 콜레스테롤 110 115 mg/dL", "AST 24 U/L"),
        )

        assertThat(outcome.observedOn).isNull()
        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(
            ParsedAbstention("LDL 콜레스테롤", AbstentionReason.MISSING_EVIDENCE, 1),
            ParsedAbstention("AST", AbstentionReason.MISSING_EVIDENCE, 1),
        )
    }

    @Test
    fun `abstains on ambiguous values and units and skips lines that are not measurements`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines(
                "검사일: 2026-07-28",
                "LDL 콜레스테롤 110 115 mg/dL",
                "요산 5.1 foo",
                "수검자 합성-001",
                "항목 결과 단위 참고치",
                "총 3 항목",
            ),
        )

        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(
            ParsedAbstention("LDL 콜레스테롤", AbstentionReason.AMBIGUOUS_VALUE, 1),
            ParsedAbstention("요산", AbstentionReason.AMBIGUOUS_UNIT, 1),
            // "총 3 항목" ("3 items total") has a label+value shape but no recognised unit; it must
            // surface as an abstention rather than vanish, same as any other unit-less row (I1).
            ParsedAbstention("총", AbstentionReason.AMBIGUOUS_UNIT, 1),
        )
    }

    @Test
    fun `keeps reference range text out of the value and hashes the trimmed source line`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일 2026-07-28", "  Fasting Glucose 96 mg/dL 70-99 mg/dL  "),
        )

        val candidate = outcome.candidates.single()
        assertThat(candidate.value).isEqualTo("96")
        assertThat(candidate.unit).isEqualTo("mg/dL")
        assertThat(candidate.referenceRangeText).isEqualTo("70-99")
        assertThat(candidate.sourceTextSha256).isEqualTo(sha256("Fasting Glucose 96 mg/dL 70-99 mg/dL"))
    }

    @Test
    fun `preserves the reference range body without label brackets or unit and leaves it null when absent`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines(
                "검사일 2026-07-28",
                "총콜레스테롤 188 mg/dl 120-199",
                "백혈구 6,200 /uL (참고 4,000-10,000)",
                "· 당화혈색소 5.2 % (참고 4.0~5.6)",
                "요산 5.1 mg/dL 참고치: ≤7.0",
                "AST 22 U/L (15 - 35)",
                "LDL 콜레스테롤 110 mg/dL <130",
                "크레아티닌 0.9 mg/dL",
            ),
        )

        assertThat(outcome.abstentions).isEmpty()
        assertThat(outcome.candidates.map { it.value }).containsExactly("188", "6,200", "5.2", "5.1", "22", "110", "0.9")
        assertThat(outcome.candidates.map { it.unit }).containsExactly("mg/dl", "/uL", "%", "mg/dL", "U/L", "mg/dL", "mg/dL")
        assertThat(outcome.candidates.map { it.referenceRangeText })
            .containsExactly("120-199", "4,000-10,000", "4.0~5.6", "≤7.0", "15 - 35", "<130", null)
        assertThat(outcome.candidates.mapNotNull { it.referenceRangeText })
            .allMatch { Regex("^[0-9.,\\s\\-~–<>≤≥]{1,40}$").matches(it) }
    }

    @Test
    fun `a bare trailing number is not a reference range but the row still parses unchanged`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일 2026-07-28", "혈당 95 mg/dL 101"),
        )

        val candidate = outcome.candidates.single()
        assertThat(candidate.value).isEqualTo("95")
        assertThat(candidate.unit).isEqualTo("mg/dL")
        assertThat(candidate.referenceRangeText).isNull()
    }

    @Test
    fun `keeps a range body with an en dash separator verbatim`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일 2026-07-28", "백혈구 6,200 /uL 15–35"),
        )

        assertThat(outcome.candidates.single().referenceRangeText).isEqualTo("15–35")
    }

    @Test
    fun `never truncates a reference range body, it is null instead when longer than forty characters`() {
        val longRange = "1000000000-2000000000000000000000000000000000"
        assertThat(longRange.length).isGreaterThan(40)
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일 2026-07-28", "혈당 95 mg/dL $longRange"),
        )

        val candidate = outcome.candidates.single()
        assertThat(candidate.value).isEqualTo("95")
        assertThat(candidate.unit).isEqualTo("mg/dL")
        assertThat(candidate.referenceRangeText).isNull()
    }

    @Test
    fun `keeps two ranges printed on one row verbatim joined by one space, or nothing when that exceeds forty characters`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines(
                "검사일 2026-07-28",
                "혈당 95 mg/dL 70-99 100-200",
                "총콜레스테롤 188 mg/dL 120-199   200-239",
                "요산 5.1 mg/dL 1000000000-2000000000 3000000000-4000000000",
                "AST 22 U/L 15-35 40",
            ),
        )

        assertThat(outcome.abstentions).isEmpty()
        assertThat(outcome.candidates.map { it.value }).containsExactly("95", "188", "5.1", "22")
        assertThat(outcome.candidates.map { it.unit }).containsExactly("mg/dL", "mg/dL", "mg/dL", "U/L")
        assertThat(outcome.candidates.map { it.referenceRangeText })
            .containsExactly("70-99 100-200", "120-199 200-239", null, "15-35")
        assertThat(outcome.candidates.mapNotNull { it.referenceRangeText })
            .allMatch { Regex("^[0-9.,\\s\\-~–<>≤≥]{1,40}$").matches(it) }
    }

    @Test
    fun `caps candidates at one hundred and marks over-long fields unreadable`() {
        val many = (1..105).map { "항목$it $it mg/dL" }
        val outcome = NativeTextExtractionProvider.parse(lines(listOf("검사일 2026-07-28") + many))
        assertThat(outcome.candidates).hasSize(100)
        assertThat(outcome.candidates.last().ordinal).isEqualTo(100)

        val longLabel = "가".repeat(81)
        val overLong = NativeTextExtractionProvider.parse(lines("검사일 2026-07-28", "$longLabel 5 mg/dL"))
        assertThat(overLong.candidates).isEmpty()
        assertThat(overLong.abstentions.single().reason).isEqualTo(AbstentionReason.UNREADABLE)
        assertThat(overLong.abstentions.single().label).hasSize(80)
    }

    @Test
    fun `abstains ambiguous_unit instead of dropping a value with no unit token at all`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("Date: 2026-07-28", "총콜레스테롤 188"),
        )

        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(
            ParsedAbstention("총콜레스테롤", AbstentionReason.AMBIGUOUS_UNIT, 1),
        )
    }

    @Test
    fun `emits a document-level unreadable abstention when a text-layer page yields zero rows`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("Date: 2026-07-28", "수검자 합성-001", "항목 결과 단위 참고치"),
        )

        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(
            ParsedAbstention(NativeTextExtractionProvider.UNREADABLE_ROWS_LABEL, AbstentionReason.UNREADABLE, 1),
        )
    }

    @Test
    fun `ignores a bare date when no labelled date exists`() {
        val outcome = NativeTextExtractionProvider.parse(lines("발급 2026-09-01", "AST 24 U/L"))

        assertThat(outcome.observedOn).isNull()
        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(ParsedAbstention("AST", AbstentionReason.MISSING_EVIDENCE, 1))
    }

    @Test
    fun `finds the labelled date anywhere in a two-column line and skips a birth date printed first`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("생년월일: 1987-03-14", "수검자 합성-6 검사일: 2026-01-20", "AST 24 U/L"),
        )

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 1, 20))
        assertThat(outcome.candidates.single().observedOn).isEqualTo(LocalDate.of(2026, 1, 20))
        assertThat(outcome.abstentions).isEmpty()
    }

    @Test
    fun `takes the first date after the label, not an earlier date on the same line`() {
        val outcome = NativeTextExtractionProvider.parse(lines("발급 2026-09-01 Exam date 2026.07.28", "AST 24 U/L"))

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
    }

    @Test
    fun `accepts the same labelled date printed twice`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일 2026-07-28", "채취일: 2026년 7월 28일", "AST 24 U/L"),
        )

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
        assertThat(outcome.candidates).hasSize(1)
    }

    @Test
    fun `abstains for the whole document with zero candidates when labelled dates disagree`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일 2026-07-28", "채취일 2026-07-27", "AST 24 U/L", "ALT 19 U/L"),
        )

        assertThat(outcome.observedOn).isNull()
        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(
            ParsedAbstention(NativeTextExtractionProvider.DOCUMENT_LABEL, AbstentionReason.AMBIGUOUS_VALUE, 1),
        )
    }

    @Test
    fun `does not treat a word that merely contains date letters as a label`() {
        val outcome = NativeTextExtractionProvider.parse(lines("Update 2026-09-01", "AST 24 U/L"))

        assertThat(outcome.observedOn).isNull()
    }

    @Test
    fun `ignores a Korean compound word that merely starts with the exam-date label`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일정: 2026-01-01 확인", "검사일: 2026-07-28", "AST 24 U/L"),
        )

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
        assertThat(outcome.abstentions).isEmpty()
    }

    @Test
    fun `prefers the exam-date label over a reception-date label on another line`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("접수일: 2026-07-01", "검사일: 2026-07-28", "AST 24 U/L"),
        )

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
    }

    @Test
    fun `treats a serial-number label ending in 일련번호 as missing evidence, not an exam date`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일련번호 2026-03-03-0001", "AST 24 U/L"),
        )

        assertThat(outcome.observedOn).isNull()
        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(ParsedAbstention("AST", AbstentionReason.MISSING_EVIDENCE, 1))
    }

    @Test
    fun `does not treat English date of birth as an exam-date label`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("Date of birth: 1987-03-14", "Exam date: 2026-07-28", "AST 24 U/L"),
        )

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
        assertThat(outcome.abstentions).isEmpty()
    }

    @Test
    fun `does not treat English birth date as an exam-date label`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("Birth date: 1987-03-14", "AST 24 U/L"),
        )

        assertThat(outcome.observedOn).isNull()
        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(ParsedAbstention("AST", AbstentionReason.MISSING_EVIDENCE, 1))
    }

    @Test
    fun `the abstention reason set is exactly the seven closed codes`() {
        assertThat(AbstentionReason.CODES).containsExactly(
            "unreadable", "ambiguous_value", "ambiguous_unit", "missing_evidence",
            "qualified_value", "qualitative", "previous_column",
        )
    }

    @Test
    fun `every row that shows a label and a numeric token either becomes a candidate or an abstention`() {
        val rows = listOf(
            "혈당 95 mg/dL",            // measurement
            "혈당 95",                  // no unit → ambiguous_unit
            "혈당 95 100",              // two numbers, no unit → ambiguous_value
            "혈당 95 120-199",          // bare range right after the value → ambiguous_unit, never dropped
            "혈당 95 mg/dL 100 mg/dL",  // two values → ambiguous_value
        )
        val outcome = NativeTextExtractionProvider.parse(lines(listOf("검사일: 2026-07-28") + rows))
        assertThat(outcome.candidates).hasSize(1)
        assertThat(outcome.abstentions.map { it.reason.code })
            .containsExactly("ambiguous_unit", "ambiguous_value", "ambiguous_unit", "ambiguous_value")
    }

    @Test
    fun `a row whose first numeric token has no label before it is skipped, not abstained`() {
        assertThat(NativeTextExtractionProvider.parseRow("3")).isEqualTo(NativeTextExtractionProvider.RowParse.Skipped)
        assertThat(NativeTextExtractionProvider.parseRow("- 2 -")).isEqualTo(NativeTextExtractionProvider.RowParse.Skipped)
        assertThat(NativeTextExtractionProvider.parseRow("예시 검진센터")).isEqualTo(NativeTextExtractionProvider.RowParse.Skipped)
    }

    private fun lines(vararg texts: String): List<TextLine> = lines(texts.toList())

    private fun lines(texts: List<String>): List<TextLine> =
        texts.mapIndexed { index, text -> TextLine(1, text, TextBox(0.1, 0.1 + index * 0.002, 0.5, 0.0015)) }

    private fun imageOnlyPdf(): ByteArray = PDDocument().use { document ->
        val page = PDPage(PDRectangle.A4)
        document.addPage(page)
        val image = BufferedImage(200, 280, BufferedImage.TYPE_INT_RGB)
        val graphics = image.createGraphics()
        graphics.color = Color.WHITE
        graphics.fillRect(0, 0, 200, 280)
        graphics.color = Color.GRAY
        graphics.drawString("SYNTHETIC SCAN", 20, 40)
        graphics.dispose()
        PDPageContentStream(document, page).use { stream ->
            stream.drawImage(LosslessFactory.createFromImage(document, image), 0f, 0f, page.mediaBox.width, page.mediaBox.height)
        }
        ByteArrayOutputStream().also { document.save(it) }.toByteArray()
    }

    private fun sha256(text: String): String =
        HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)))
}
