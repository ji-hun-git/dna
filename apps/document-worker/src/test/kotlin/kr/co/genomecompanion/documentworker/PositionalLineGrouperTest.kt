package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test


class PositionalLineGrouperTest {
    private fun token(text: String, x: Double, y: Double, page: Int = 1) = PositionedToken(page, text, x, y, 0.02 * text.length, 0.012)

    @Test
    fun `tokens on one baseline separated by a wide x gap become two lines with column indexes`() {
        val lines = PositionalLineGrouper.group(
            listOf(
                token("혈당", 0.05, 0.20), token("95", 0.15, 0.20), token("mg/dL", 0.19, 0.20),
                token("총콜레스테롤", 0.55, 0.20), token("188", 0.70, 0.20), token("mg/dL", 0.74, 0.20),
            ),
        )
        assertThat(lines.map { it.text to it.columnIndex }).containsExactly("혈당 95 mg/dL" to 0, "총콜레스테롤 188 mg/dL" to 1)
    }

    @Test
    fun `tokens closer than the gap stay one line and a small baseline drift is tolerated`() {
        val lines = PositionalLineGrouper.group(listOf(token("HbA1c", 0.05, 0.300), token("5.4", 0.12, 0.302), token("%", 0.16, 0.301)))
        assertThat(lines.map { it.text }).containsExactly("HbA1c 5.4 %")
        assertThat(lines.single().box.x).isEqualTo(0.05)
    }

    @Test
    fun `a column whose header says 이전 or 전회 or an earlier year marks its later lines as previous`() {
        val lines = PositionalLineGrouper.group(
            listOf(
                token("항목", 0.05, 0.10), token("이번", 0.30, 0.10), token("이전", 0.55, 0.10),
                token("혈당", 0.05, 0.14), token("95", 0.30, 0.14), token("mg/dL", 0.34, 0.14), token("101", 0.55, 0.14), token("mg/dL", 0.59, 0.14),
            ),
        )
        assertThat(lines.map { Triple(it.text, it.columnIndex, it.previousColumn) }).containsExactly(
            Triple("항목", 0, false), Triple("이번", 1, false), Triple("이전", 2, false),
            Triple("혈당", 0, false), Triple("95 mg/dL", 1, false), Triple("101 mg/dL", 2, true),
        )
        val years = PositionalLineGrouper.group(listOf(token("항목", 0.05, 0.10), token("2026", 0.30, 0.10), token("2025", 0.55, 0.10), token("혈당", 0.05, 0.14), token("95 mg/dL", 0.30, 0.14), token("101 mg/dL", 0.55, 0.14)))
        assertThat(years.last().previousColumn).isTrue()
        assertThat(years[4].previousColumn).isFalse()
    }

    @Test
    fun `a data row with two value cells and no header words is never mistaken for a header`() {
        val lines = PositionalLineGrouper.group(
            listOf(
                token("총콜레스테롤", 0.05, 0.20), token("194", 0.30, 0.20), token("mg/dL", 0.34, 0.20),
                token("201", 0.55, 0.20), token("mg/dL", 0.59, 0.20),
            ),
        )
        assertThat(lines.map { it.previousColumn }).containsOnly(false)
    }

    @Test
    fun `a genuine header is still recognized even after an earlier baseline happened to have multiple columns`() {
        val lines = PositionalLineGrouper.group(
            listOf(
                token("총콜레스테롤", 0.05, 0.10), token("194", 0.30, 0.10), token("mg/dL", 0.34, 0.10), token("201", 0.55, 0.10), token("mg/dL", 0.59, 0.10),
                token("항목", 0.05, 0.14), token("이번", 0.30, 0.14), token("이전", 0.55, 0.14),
                token("혈당", 0.05, 0.18), token("95", 0.30, 0.18), token("mg/dL", 0.34, 0.18), token("101", 0.55, 0.18), token("mg/dL", 0.59, 0.18),
            ),
        )
        assertThat(lines.last().previousColumn).isTrue()
        assertThat(lines[lines.size - 2].previousColumn).isFalse()
    }
}
