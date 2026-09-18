package kr.co.genomecompanion.documentworker

import kr.co.genomecompanion.documentboundary.MedicalUnitSpelling
import kotlin.math.abs

/** One glyph run with a normalized (0..1, top-left origin) box. */
data class PositionedToken(val page: Int, val text: String, val x: Double, val y: Double, val width: Double, val height: Double)

/**
 * Groups positioned tokens into lines per page: same baseline (|Δy| ≤ yTolerance), then a new
 * column wherever the horizontal gap to the previous token exceeds xGap. The first baseline with
 * two or more columns that actually reads like a header — at least one cell says `이전`/`전회`/
 * `직전`/a year, and no cell already looks like a printed value-unit pair — is the header row; a
 * cell that reads `이전`/`전회`/`직전` or a four-digit year earlier than the largest year header
 * marks every later line in that column `previousColumn`. A multi-column baseline that does not
 * carry a header word/year (or that already looks like data, e.g. two "185 mg/dL"-shaped cells) is
 * just an ordinary data row: it is never mistaken for the header, so a data row is never treated as
 * establishing previous-result columns for itself or for anything after it.
 */
object PositionalLineGrouper {
    private val previousHeader = Regex("^(이전|전회|직전)(\\s*결과)?$")
    private val yearHeader = Regex("^(\\d{4})(년)?$")

    fun group(tokens: List<PositionedToken>, xGap: Double = 0.06, yTolerance: Double = 0.004): List<TextLine> {
        val lines = mutableListOf<TextLine>()
        tokens.groupBy { it.page }.toSortedMap().forEach { (page, pageTokens) ->
            val baselines = mutableListOf<MutableList<PositionedToken>>()
            pageTokens.sortedWith(compareBy({ it.y }, { it.x })).forEach { token ->
                val row = baselines.lastOrNull()?.takeIf { abs(it.first().y - token.y) <= yTolerance }
                if (row == null) baselines += mutableListOf(token) else row += token
            }
            val previousColumns = mutableSetOf<Int>()
            var headerSeen = false
            baselines.forEach { row ->
                val columns = mutableListOf<MutableList<PositionedToken>>()
                row.sortedBy { it.x }.forEach { token ->
                    val last = columns.lastOrNull()?.last()
                    if (last == null || token.x - (last.x + last.width) > xGap) columns += mutableListOf(token) else columns.last() += token
                }
                val texts = columns.map { column -> column.joinToString(" ") { it.text } }
                val looksLikeHeader = !headerSeen && columns.size >= 2 &&
                    texts.any { previousHeader.matches(it) || yearHeader.matchEntire(it) != null } &&
                    texts.none { hasNumericUnitPair(it) }
                if (looksLikeHeader) {
                    headerSeen = true
                    val years = texts.mapNotNull { yearHeader.matchEntire(it)?.groupValues?.get(1)?.toInt() }
                    texts.forEachIndexed { index, text ->
                        val year = yearHeader.matchEntire(text)?.groupValues?.get(1)?.toInt()
                        if (previousHeader.matches(text) || (year != null && years.size >= 2 && year < years.max())) previousColumns += index
                    }
                    columns.forEachIndexed { index, column -> lines += toLine(page, column, index, previous = false) }
                } else {
                    columns.forEachIndexed { index, column -> lines += toLine(page, column, index, previous = index in previousColumns) }
                }
            }
        }
        return lines
    }

    /** A number immediately followed by a recognized unit spelling (`194 mg/dL`): a printed data cell, never a header cell. */
    private fun hasNumericUnitPair(text: String): Boolean =
        RowGrammar.tokenize(text).zipWithNext().any { (value, unit) -> RowGrammar.valueToken.matches(value) && MedicalUnitSpelling.canonical(unit) != null }

    private fun toLine(page: Int, column: List<PositionedToken>, index: Int, previous: Boolean): TextLine {
        val left = column.minOf { it.x }
        val right = column.maxOf { it.x + it.width }
        val top = column.minOf { it.y }
        val bottom = column.maxOf { it.y + it.height }
        return TextLine(
            page = page,
            text = column.joinToString(" ") { it.text }.trim(),
            box = TextBox(left, top, (right - left).coerceIn(0.0, 1.0 - left), (bottom - top).coerceIn(0.0, 1.0 - top)),
            columnIndex = index,
            previousColumn = previous,
        )
    }
}
