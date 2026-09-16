package kr.co.genomecompanion.documentworker

import kr.co.genomecompanion.documentboundary.MedicalUnitSpelling
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
)


data class ParsedAbstention(val label: String, val reason: AbstentionReason, val evidencePage: Int?)


data class ExtractionOutcome(
    val candidates: List<ParsedCandidate>,
    val abstentions: List<ParsedAbstention>,
    val observedOn: LocalDate?,
)


/**
 * Deterministic text-layer parser. No OCR, no model, no network: PDFBox yields positioned lines,
 * a row grammar yields `label value unit`, and the document date comes from a labelled or first date.
 * Labels stay raw (core normalizes); reference-range text on a row is only excluded from the value.
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

    private val valueToken = Regex("^-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$")
    private val rangeText = Regex(
        "^\\(?\\s*(?:참고치?|기준치?|정상\\s*범위|reference|ref\\.?)?\\s*[:：]?\\s*[<>≤≥]?\\s*" +
            "\\d[\\d,]*(?:\\.\\d+)?(?:\\s*[-–~]\\s*\\d[\\d,]*(?:\\.\\d+)?)?\\s*[^\\s()]*\\s*\\)?$",
    )
    private val separators = Regex("[:：\\t]")
    private val leadingBullets = Regex("^[·•\\-*]+\\s*")
    private val dateLabel = Regex("^(검사일|검진일|채취일|검사\\s*일자|Date)\\s*[:：]?", RegexOption.IGNORE_CASE)
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
        val observedOn = findObservedOn(lines)
        val candidates = mutableListOf<ParsedCandidate>()
        val abstentions = mutableListOf<ParsedAbstention>()
        for (line in lines) {
            when (val row = parseRow(line.text)) {
                null -> continue
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
                    )
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
        data class Measurement(val label: String, val value: String, val unit: String) : RowParse
        data class Ambiguous(val label: String, val reason: AbstentionReason) : RowParse
    }

    internal fun parseRow(raw: String): RowParse? {
        val text = raw.replace(separators, " ").trim().replace(leadingBullets, "").trim()
        val tokens = text.split(Regex("\\s+")).filter { it.isNotEmpty() }
        val valueIndex = tokens.indexOfFirst { valueToken.matches(it) }
        if (valueIndex < 1) return null
        val label = tokens.subList(0, valueIndex).joinToString(" ")
        val value = tokens[valueIndex]
        val unitToken = tokens.getOrNull(valueIndex + 1)
        val unit = when {
            unitToken == null -> return RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_UNIT)
            MedicalUnitSpelling.canonical(unitToken) != null -> unitToken
            valueToken.matches(unitToken) -> return RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE)
            // A bare range right after the value (e.g. "120-199") with no unit word at all is not a
            // measurement row we can label ambiguous-unit about; leave it unrecognised, as before.
            rangeText.matches(unitToken) -> return null
            else -> return RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_UNIT)
        }
        val rest = tokens.drop(valueIndex + 2)
        if (rest.isNotEmpty() && !rangeText.matches(rest.joinToString(" ")) && rest.any { valueToken.matches(it) }) {
            return RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE)
        }
        return RowParse.Measurement(label, value, unit)
    }

    private fun findObservedOn(lines: List<TextLine>): LocalDate? {
        val labelled = lines.filter { dateLabel.containsMatchIn(it.text.trim()) }
        return (labelled + lines).firstNotNullOfOrNull { dateIn(it.text) }
    }

    private fun dateIn(text: String): LocalDate? = datePatterns.firstNotNullOfOrNull { pattern ->
        pattern.find(text)?.let { match ->
            runCatching {
                LocalDate.of(match.groupValues[1].toInt(), match.groupValues[2].toInt(), match.groupValues[3].toInt())
            }.getOrNull()
        }
    }

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
