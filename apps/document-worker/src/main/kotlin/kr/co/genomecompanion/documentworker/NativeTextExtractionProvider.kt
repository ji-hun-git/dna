package kr.co.genomecompanion.documentworker

import org.apache.pdfbox.Loader
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.pdfbox.text.TextPosition
import java.security.MessageDigest
import java.time.LocalDate
import java.util.HexFormat


data class TextBox(val x: Double, val y: Double, val width: Double, val height: Double)


data class TextLine(val page: Int, val text: String, val box: TextBox, val columnIndex: Int = 0, val previousColumn: Boolean = false)


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
    /** The printed label before a blood-pressure split (`혈압`), null for every other candidate. */
    val originalLabel: String? = null,
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
 * Two-digit years are not recognised; 재검사일, Report/Reported/Print/Printed/Issue/Issued/Generated/
 * Received Date are not exam-date labels.
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
        "(?:(?<![가-힣])(?:검사\\s*일자|검진\\s*일자|채취\\s*일자|검사일|검진일|채취일)(?![가-힣])|" +
            "(?<![A-Za-z])(?<!birth\\s{1,10})(?<!report\\s{1,10})(?<!reported\\s{1,10})(?<!print\\s{1,10})(?<!printed\\s{1,10})(?<!issue\\s{1,10})(?<!issued\\s{1,10})" +
            "(?<!generated\\s{1,10})(?<!received\\s{1,10})" +
            "(?:exam\\s+|test\\s+|collection\\s+)?date(?![A-Za-z])(?!\\s{1,10}of\\s{1,10}birth))\\s*[:：]?",
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
        val stripper = TokenCollectingStripper()
        stripper.getText(document)
        PositionalLineGrouper.group(stripper.tokens)
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
        val prepared = joinValueColumns(mergeContinuedLabels(lines))
        for (line in prepared) {
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
                        line.previousColumn ->
                            abstentions += ParsedAbstention(row.label.take(MAX_LABEL), AbstentionReason.PREVIOUS_COLUMN, line.page)
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
                            originalLabel = row.originalLabel,
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
        /** [originalLabel] is the printed label before a blood-pressure split (`혈압`), null for every other row. */
        data class Measurement(
            val label: String,
            val value: String,
            val unit: String,
            val referenceRangeText: String?,
            val originalLabel: String? = null,
        ) : RowParse
        data class Ambiguous(val label: String, val reason: AbstentionReason) : RowParse
        /** No label precedes the first numeric token (page numbers, headers): not a measurement row at all. */
        data object Skipped : RowParse
    }

    internal fun parseRow(raw: String): RowParse = parseRowAll(raw).single()
    internal fun parseRowAll(raw: String): List<RowParse> = RowGrammar.parse(raw)

    /**
     * A run of one or more lines with no numeric token, each immediately followed (same page, same
     * column, ≤ 0.03 below the previous) by another such line or finally by a measurement row: the
     * whole run collapses into one row with every label fragment prefixed onto the measurement.
     * A label wrapped across two (or more) label-only lines before the value line is handled by
     * extending the run for as long as the run's own tail keeps being label-only.
     */
    internal fun mergeContinuedLabels(lines: List<TextLine>): List<TextLine> {
        val merged = mutableListOf<TextLine>()
        var index = 0
        while (index < lines.size) {
            var end = index
            while (isLabelOnlyLine(lines[end]) && end + 1 < lines.size &&
                lines[end + 1].page == lines[end].page && lines[end + 1].columnIndex == lines[end].columnIndex &&
                lines[end + 1].box.y - lines[end].box.y in 0.0..0.03
            ) {
                end += 1
            }
            if (end > index && RowGrammar.parse(lines[end].text).any { it is RowParse.Measurement }) {
                val chain = lines.subList(index, end + 1)
                val last = chain.last()
                merged += TextLine(
                    page = chain.first().page,
                    text = chain.joinToString(" ") { it.text },
                    box = TextBox(
                        chain.minOf { it.box.x },
                        chain.first().box.y,
                        chain.maxOf { it.box.width },
                        last.box.y + last.box.height - chain.first().box.y,
                    ),
                    columnIndex = chain.first().columnIndex,
                    previousColumn = last.previousColumn,
                )
                index = end + 1
            } else {
                merged += lines[index]
                index += 1
            }
        }
        return merged
    }

    /** No numeric token anywhere, not a labelled or bare date line: a candidate label fragment for [mergeContinuedLabels]. */
    private fun isLabelOnlyLine(line: TextLine): Boolean =
        RowGrammar.tokenize(line.text).none { RowGrammar.valueToken.matches(it) } &&
            RowGrammar.parse(line.text).singleOrNull() == RowParse.Skipped &&
            !dateLabel.containsMatchIn(line.text) &&
            datePatterns.none { it.containsMatchIn(line.text) }

    private val leadingComparisonSign = Regex("^[<>≤≥].*")

    /**
     * A column-0 cell is a row's label; every cell to its right on the same baseline is either:
     *  - self-sufficient: it already carries its own label before its own number
     *    (`총콜레스테롤 188 mg/dL`, a second result panel on the same baseline) — left untouched,
     *    parsed on its own without ever touching column 0;
     *  - or a fragment of column 0's own row. When at least one trailing cell on this baseline was
     *    actually marked [TextLine.previousColumn] by a recognized header (이전/전회/직전/an earlier
     *    year), every numeric-or-signed-leading fragment starts its own joined row (so a this-time/
     *    previous-time pair of value cells stays two rows) and a bare fragment with no numeric token
     *    of its own (a unit or 참고치 cell: `mg/dL`, `70-199`) extends the row immediately to its
     *    left — the unchanged legacy wide-table layout (label | 결과 | 단위 | 참고치 as four separate
     *    columns) still joins back into one row.
     *  - Without any such recognized previous-column marking, every non-self-sufficient trailing
     *    fragment on the baseline joins into a single row (there is no header to tell two value cells
     *    apart, so a second bare value next to the first is not silently promoted to its own
     *    candidate — the row grammar's own duplicate-value guard then abstains it `ambiguous_value`,
     *    the same outcome a single physical line with two values already produced before positional
     *    column splitting existed).
     */
    internal fun joinValueColumns(lines: List<TextLine>): List<TextLine> {
        val result = mutableListOf<TextLine>()
        var index = 0
        while (index < lines.size) {
            val line = lines[index]
            if (line.columnIndex != 0) {
                result += line
                index += 1
                continue
            }
            var lookahead = index + 1
            val trailing = mutableListOf<TextLine>()
            while (lookahead < lines.size && lines[lookahead].page == line.page && lines[lookahead].columnIndex > 0 &&
                kotlin.math.abs(lines[lookahead].box.y - line.box.y) <= 0.004
            ) {
                trailing += lines[lookahead]
                lookahead += 1
            }
            if (trailing.isEmpty()) {
                result += line
                index += 1
                continue
            }
            val hasRecognizedPreviousColumn = trailing.any { it.previousColumn }
            val groups = mutableListOf<MutableList<TextLine>>()
            val standalone = mutableListOf<TextLine>()
            trailing.forEach { cell ->
                val startsValue = startsNumericOrSigned(cell.text)
                val hasOwnLabel = !startsValue && RowGrammar.parse(cell.text).any { it is RowParse.Measurement || it is RowParse.Ambiguous }
                when {
                    hasOwnLabel -> standalone += cell
                    !hasRecognizedPreviousColumn -> if (groups.isEmpty()) groups += mutableListOf(cell) else groups[0] += cell
                    startsValue || groups.isEmpty() -> groups += mutableListOf(cell)
                    else -> groups.last() += cell
                }
            }
            // Column 0 may already be a complete self-sufficient row on its own (a first result panel
            // with its own label+value+unit, next to a second panel far enough away to be its own
            // column): if nothing to its right needed to borrow its label, emit it untouched too.
            if (groups.isEmpty()) result += line
            groups.forEach { group ->
                val anchor = group.first()
                val left = minOf(line.box.x, group.minOf { it.box.x })
                val right = group.maxOf { it.box.x + it.box.width }
                result += TextLine(
                    page = line.page,
                    text = (listOf(line.text) + group.map { it.text }).joinToString(" "),
                    box = TextBox(left, minOf(line.box.y, anchor.box.y), right - left, maxOf(line.box.height, group.maxOf { it.box.height })),
                    columnIndex = anchor.columnIndex,
                    previousColumn = anchor.previousColumn,
                )
            }
            standalone.forEach { result += it }
            index = lookahead
        }
        return result
    }

    private fun startsNumericOrSigned(text: String): Boolean =
        RowGrammar.tokenize(text).firstOrNull()?.let { RowGrammar.valueToken.matches(it) || leadingComparisonSign.matches(it) } == true

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

    /** Collects one [PositionedToken] per run of non-blank glyphs, with a normalized (0..1, top-left origin) box. */
    private class TokenCollectingStripper : PDFTextStripper() {
        val tokens = mutableListOf<PositionedToken>()
        private var pageWidth = 1f
        private var pageHeight = 1f

        init { sortByPosition = true }

        override fun startPage(page: PDPage) {
            super.startPage(page)
            pageWidth = page.cropBox.width
            pageHeight = page.cropBox.height
        }

        /** One token per run of non-blank glyphs; PDFBox calls this once per word group it detects. */
        override fun writeString(text: String, textPositions: List<TextPosition>) {
            var run = mutableListOf<TextPosition>()
            fun flush() {
                if (run.isEmpty()) return
                val left = run.minOf { it.xDirAdj }
                val right = run.maxOf { it.xDirAdj + it.widthDirAdj }
                val top = run.minOf { it.yDirAdj - it.heightDir }
                val bottom = run.maxOf { it.yDirAdj }
                val x = (left / pageWidth).toDouble().coerceIn(0.0, 1.0)
                val y = (top / pageHeight).toDouble().coerceIn(0.0, 1.0)
                tokens += PositionedToken(
                    page = currentPageNo,
                    text = run.joinToString("") { it.unicode },
                    x = x,
                    y = y,
                    width = ((right - left) / pageWidth).toDouble().coerceIn(0.0, 1.0 - x),
                    height = ((bottom - top) / pageHeight).toDouble().coerceIn(0.0, 1.0 - y),
                )
                run = mutableListOf()
            }
            textPositions.forEach { position -> if (position.unicode.isBlank()) flush() else run += position }
            flush()
        }
    }
}
