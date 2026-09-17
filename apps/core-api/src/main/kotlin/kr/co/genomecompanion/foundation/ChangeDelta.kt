package kr.co.genomecompanion.foundation

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * The arithmetic difference between this time's value and the previous value of the same item
 * in the same unit, as signed numbers in text. Subtraction and division only: no direction word,
 * colour, arrow, threshold or meaning is attached anywhere
 * (governance/intended-use-decision-reference-range-and-delta-2026-09-17.md, item (b)).
 */
data class ChangeDelta(
    /** `latest − previous` at the larger scale of the two inputs, sign explicit (`"+12"`, `"-6"`, `"-0.3"`, `"0"`). */
    val absolute: String,
    /** `absolute / previous × 100`, HALF_EVEN to one decimal, sign explicit; null when `previous` is zero or negative (a percent of a non-positive base could contradict the absolute sign). */
    val percent: String?,
)

object ChangeDeltaCalculator {
    private val hundred = BigDecimal(100)

    /** Null when either value is not a plain number (after removing thousands commas). */
    fun compute(latest: String, previous: String): ChangeDelta? {
        val latestNumber = parse(latest) ?: return null
        val previousNumber = parse(previous) ?: return null
        val absolute = latestNumber.subtract(previousNumber)
            .setScale(maxOf(latestNumber.scale(), previousNumber.scale()), RoundingMode.UNNECESSARY)
        val percent = if (previousNumber.signum() <= 0) {
            null
        } else {
            absolute.multiply(hundred).divide(previousNumber, 1, RoundingMode.HALF_EVEN)
        }
        return ChangeDelta(absolute = signed(absolute), percent = percent?.let(::signed))
    }

    internal fun parse(raw: String): BigDecimal? {
        val text = raw.replace(",", "").trim()
        if (!Regex("^-?\\d+(\\.\\d+)?$").matches(text)) return null
        return runCatching { BigDecimal(text) }.getOrNull()
    }

    internal fun signed(value: BigDecimal): String =
        if (value.signum() > 0) "+" + value.toPlainString() else value.toPlainString()
}
