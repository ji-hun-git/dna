package kr.co.genomecompanion.documentworker

import org.apache.pdfbox.Loader
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.pdfbox.text.TextPosition
import java.security.MessageDigest
import java.time.LocalDate
import java.util.HexFormat


data class TextBox(val x: Double, val y: Double, val width: Double, val height: Double)


data class TextLine(val page: Int, val text: String, val box: TextBox)


enum class AbstentionReason(val code: String) {
    UNREADABLE("unreadable"),
    AMBIGUOUS_VALUE("ambiguous_value"),
    AMBIGUOUS_UNIT("ambiguous_unit"),
    MISSING_EVIDENCE("missing_evidence"),
    /** `<0.3`, `≤5.6`, `>60`: the printed number carries a comparison sign, so it is not stored as a value. */
    QUALIFIED_VALUE("qualified_value"),
    /** `음성`, `양성`, `정상`, `이상`: a printed judgement word, never a value; nothing is stored. */
    QUALITATIVE("qualitative"),
    /** A value that sits in a previous-result column (`이전`, `전회`, an earlier year header). */
    PREVIOUS_COLUMN("previous_column");

    companion object {
        val CODES: List<String> = entries.map { it.code }
    }
}


data class ParsedCandidate(
    val ordinal: Int,
    val label: String,
    val value: String,
    val unit: String,
    val observedOn: LocalDate,
    val evidencePage: Int,
    val evidenceBox: TextBox,
    val sourceTextSha256: String,
    /** The range body printed on the same row (`70-99`, `<200`, `≤5.6`), verbatim, or null. Never interpreted. */
    val referenceRangeText: String? = null,
)


data class ParsedAbstention(val label: String, val reason: AbstentionReason, val evidencePage: Int?)


data class ExtractionOutcome(
    val candidates: List<ParsedCandidate>,
    val abstentions: List<ParsedAbstention>,
    val observedOn: LocalDate?,
)


/**
 * Deterministic text-layer parser. No OCR, no model, no network: PDFBox yields positioned lines,
 * a row grammar yields `label value unit`, and the document date comes only from a labelled date
 * (검사일/검진일/채취일/Date…, label anywhere in the line, first date after the label). A bare date is
 * never used; two different labelled dates make the whole document ambiguous.
 * Labels stay raw (core normalizes). Reference-range text on a row is excluded from the value and
 * carried verbatim as `referenceRangeText` (range body only — two bodies on one row joined by one
 * space — at most 40 characters, else null) so the person's
 * own export can keep it; the worker never compares a value against it.
 */
object NativeTextExtractionProvider {
    const val METHOD = "native-text"
    const val DOCUMENT_LABEL = "문서 전체"
    const val UNREADABLE_ROWS_LABEL = "결과지"
    private const val MAX_CANDIDATES = 100
    private const val MAX_ABSTENTIONS = 100
    private const val MAX_LABEL = 80
    private const val MAX_VALUE = 64
    private const val MAX_UNIT = 32

    private val dateLabel = Regex(
        "(?:(?:검사\\s*일자|검진\\s*일자|채취\\s*일자|검사일|검진일|채취일)(?![가-힣])|" +
            "(?<![A-Za-z])(?<!birth\\s{1,10})(?:exam\\s+|test\\s+|collection\\s+)?date(?![A-Za-z])" +
            "(?!\\s{1,10}of\\s{1,10}birth))\\s*[:：]?",
        RegexOption.IGNORE_CASE,
    )
    private val datePatterns = listOf(
        Regex("(\\d{4})-(\\d{2})-(\\d{2})"),
        Regex("(\\d{4})\\.(\\d{1,2})\\.(\\d{1,2})"),
        Regex("(\\d{4})년\\s*(\\d{1,2})월\\s*(\\d{1,2})일"),
    )

    fun extract(pdf: ByteArray): ExtractionOutcome =
        runCatching { parse(extractLines(pdf)) }.getOrElse { unreadable() }

    fun extractLines(pdf: ByteArray): List<TextLine> = Loader.loadPDF(pdf).use { document ->
        require(document.numberOfPages in 1..20) { "page count out of bounds" }
        val stripper = LineCollectingStripper()
        stripper.getText(document)
        stripper.lines.toList()
    }

    internal fun parse(lines: List<TextLine>): ExtractionOutcome {
        if (lines.isEmpty()) return unreadable()
        val observedOn = when (val resolution = resolveObservedOn(lines)) {
            is DateResolution.Conflicting -> return ambiguousDate(resolution.evidencePage)
            is DateResolution.Found -> resolution.date
            DateResolution.Missing -> null
        }
        val candidates = mutableListOf<ParsedCandidate>()
        val abstentions = mutableListOf<ParsedAbstention>()
        for (line in lines) {
            for (row in parseRowAll(line.text)) {
                when (row) {
                    RowParse.Skipped -> continue
                    is RowParse.Ambiguous -> {
                        val reason = if (observedOn == null) AbstentionReason.MISSING_EVIDENCE else row.reason
                        abstentions += ParsedAbstention(row.label.take(MAX_LABEL), reason, line.page)
                    }
                    is RowParse.Measurement -> when {
                        observedOn == null ->
                            abstentions += ParsedAbstention(row.label.take(MAX_LABEL), AbstentionReason.MISSING_EVIDENCE, line.page)
                        row.label.length > MAX_LABEL || row.value.length > MAX_VALUE || row.unit.length > MAX_UNIT ->
                            abstentions += ParsedAbstention(row.label.take(MAX_LABEL), AbstentionReason.UNREADABLE, line.page)
                        candidates.size >= MAX_CANDIDATES -> continue
                        else -> candidates += ParsedCandidate(
                            ordinal = candidates.size + 1,
                            label = row.label,
                            value = row.value,
                            unit = row.unit,
                            observedOn = observedOn,
                            evidencePage = line.page,
                            evidenceBox = line.box,
                            sourceTextSha256 = sha256(line.text.trim()),
                            referenceRangeText = row.referenceRangeText,
                        )
                    }
                }
            }
        }
        if (candidates.isEmpty() && abstentions.isEmpty()) {
            // Text was readable but nothing on the page matched the row grammar (prose-only pages,
            // headers/footers, etc). Say so explicitly rather than completing silently as if the
            // document were a blank/zero-candidate scan.
            return ExtractionOutcome(
                candidates = emptyList(),
                abstentions = listOf(ParsedAbstention(UNREADABLE_ROWS_LABEL, AbstentionReason.UNREADABLE, 1)),
                observedOn = observedOn,
            )
        }
        return ExtractionOutcome(candidates.toList(), abstentions.take(MAX_ABSTENTIONS), observedOn)
    }

    internal sealed interface RowParse {
        data class Measurement(val label: String, val value: String, val unit: String, val referenceRangeText: String?) : RowParse
        data class Ambiguous(val label: String, val reason: AbstentionReason) : RowParse
        /** No label precedes the first numeric token (page numbers, headers): not a measurement row at all. */
        data object Skipped : RowParse
    }

    internal fun parseRow(raw: String): RowParse = parseRowAll(raw).single()
    internal fun parseRowAll(raw: String): List<RowParse> = RowGrammar.parse(raw)

    internal sealed interface DateResolution {
        data object Missing : DateResolution
        data class Found(val date: LocalDate) : DateResolution
        data class Conflicting(val dates: List<LocalDate>, val evidencePage: Int) : DateResolution
    }

    /** Every `(label, date-after-label)` pair in the document; only their distinct dates decide. */
    internal fun resolveObservedOn(lines: List<TextLine>): DateResolution {
        val labelled = lines.flatMap { line ->
            dateLabel.findAll(line.text).mapNotNull { match ->
                dateIn(line.text.substring(match.range.last + 1))?.let { date -> date to line.page }
            }.toList()
        }
        val distinct = labelled.map { it.first }.distinct()
        return when (distinct.size) {
            0 -> DateResolution.Missing
            1 -> DateResolution.Found(distinct.single())
            else -> DateResolution.Conflicting(distinct, labelled.first().second)
        }
    }

    /** The earliest date in [text] across the three spellings, or null. */
    private fun dateIn(text: String): LocalDate? =
        datePatterns.mapNotNull { it.find(text) }.minByOrNull { it.range.first }?.let { match ->
            runCatching {
                LocalDate.of(match.groupValues[1].toInt(), match.groupValues[2].toInt(), match.groupValues[3].toInt())
            }.getOrNull()
        }

    private fun ambiguousDate(evidencePage: Int) = ExtractionOutcome(
        candidates = emptyList(),
        abstentions = listOf(ParsedAbstention(DOCUMENT_LABEL, AbstentionReason.AMBIGUOUS_VALUE, evidencePage)),
        observedOn = null,
    )

    private fun unreadable() = ExtractionOutcome(
        candidates = emptyList(),
        abstentions = listOf(ParsedAbstention(DOCUMENT_LABEL, AbstentionReason.UNREADABLE, null)),
        observedOn = null,
    )

    private fun sha256(text: String): String =
        HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)))

    /** Collects one [TextLine] per stripper line with a normalized (0..1, top-left origin) box. */
    private class LineCollectingStripper : PDFTextStripper() {
        val lines = mutableListOf<TextLine>()
        private val buffer = StringBuilder()
        private val positions = mutableListOf<TextPosition>()
        private var pageWidth = 1f
        private var pageHeight = 1f

        init {
            sortByPosition = true
        }

        override fun startPage(page: PDPage) {
            super.startPage(page)
            pageWidth = page.cropBox.width
            pageHeight = page.cropBox.height
        }

        override fun writeString(text: String, textPositions: List<TextPosition>) {
            buffer.append(text)
            positions += textPositions
        }

        override fun writeWordSeparator() {
            buffer.append(' ')
        }

        override fun writeLineSeparator() {
            flush()
        }

        override fun endPage(page: PDPage) {
            flush()
            super.endPage(page)
        }

        private fun flush() {
            val text = buffer.toString().trim()
            if (text.isNotEmpty() && positions.isNotEmpty()) {
                val left = positions.minOf { it.xDirAdj }
                val right = positions.maxOf { it.xDirAdj + it.widthDirAdj }
                val top = positions.minOf { it.yDirAdj - it.heightDir }
                val bottom = positions.maxOf { it.yDirAdj }
                val x = clamp(left / pageWidth)
                val y = clamp(top / pageHeight)
                lines += TextLine(
                    page = currentPageNo,
                    text = text,
                    box = TextBox(x, y, clamp((right - left) / pageWidth, 1.0 - x), clamp((bottom - top) / pageHeight, 1.0 - y)),
                )
            }
            buffer.clear()
            positions.clear()
        }

        private fun clamp(value: Float, max: Double = 1.0): Double = value.toDouble().coerceIn(0.0, max)
    }
}
