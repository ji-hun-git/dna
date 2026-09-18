package kr.co.genomecompanion.documentworker

import kotlin.math.abs

/** One glyph run with a normalized (0..1, top-left origin) box. */
data class PositionedToken(val page: Int, val text: String, val x: Double, val y: Double, val width: Double, val height: Double)

/**
 * Groups positioned tokens into lines per page: same baseline (|Δy| ≤ yTolerance), then a new
 * column wherever the horizontal gap to the previous token exceeds xGap. The first baseline with
 * two or more columns is the header row; a header that reads `이전`/`전회`/`직전` or a four-digit
 * year earlier than the largest year header marks every later line in that column `previousColumn`.
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
                if (!headerSeen && columns.size >= 2) {
                    headerSeen = true
                    val texts = columns.map { column -> column.joinToString(" ") { it.text } }
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
