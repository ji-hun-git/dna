package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ChangeDeltaTest {
    @Test
    fun subtractsIntegersWithAnExplicitSignAndOneDecimalPercent() {
        assertThat(ChangeDeltaCalculator.compute("188", "194")).isEqualTo(ChangeDelta("-6", "-3.1"))
        assertThat(ChangeDeltaCalculator.compute("206", "194")).isEqualTo(ChangeDelta("+12", "+6.2"))
        assertThat(ChangeDeltaCalculator.compute("194", "194")).isEqualTo(ChangeDelta("0", "0.0"))
    }

    @Test
    fun keepsTheLargerScaleOfTheTwoInputs() {
        assertThat(ChangeDeltaCalculator.compute("5.4", "5.2")).isEqualTo(ChangeDelta("+0.2", "+3.8"))
        assertThat(ChangeDeltaCalculator.compute("5.2", "5.5")).isEqualTo(ChangeDelta("-0.3", "-5.5"))
        assertThat(ChangeDeltaCalculator.compute("10", "2.50")).isEqualTo(ChangeDelta("+7.50", "+300.0"))
        assertThat(ChangeDeltaCalculator.compute("5.2", "5.2")).isEqualTo(ChangeDelta("0.0", "0.0"))
    }

    @Test
    fun roundsThePercentHalfEven() {
        // 0.25 % exactly: HALF_EVEN keeps 0.2, HALF_UP would give 0.3.
        assertThat(ChangeDeltaCalculator.compute("100.25", "100")).isEqualTo(ChangeDelta("+0.25", "+0.2"))
        assertThat(ChangeDeltaCalculator.compute("100.35", "100")).isEqualTo(ChangeDelta("+0.35", "+0.4"))
    }

    @Test
    fun handlesNegativeValues() {
        // The previous value is negative, so a percent-of-previous would run against the sign of
        // the absolute difference (+1 here); percent stays null whenever previous <= 0.
        assertThat(ChangeDeltaCalculator.compute("-3", "-4")).isEqualTo(ChangeDelta("+1", null))
        assertThat(ChangeDeltaCalculator.compute("-5", "2")).isEqualTo(ChangeDelta("-7", "-350.0"))
    }

    @Test
    fun leavesPercentNullWhenThePreviousValueIsZeroOrNegative() {
        assertThat(ChangeDeltaCalculator.compute("12", "0")).isEqualTo(ChangeDelta("+12", null))
        assertThat(ChangeDeltaCalculator.compute("0.0", "0")).isEqualTo(ChangeDelta("0.0", null))
        assertThat(ChangeDeltaCalculator.compute("-1", "-4")).isEqualTo(ChangeDelta("+3", null))
    }

    @Test
    fun stripsThousandsCommasBeforeParsing() {
        assertThat(ChangeDeltaCalculator.compute("1,234", "1,200")).isEqualTo(ChangeDelta("+34", "+2.8"))
        assertThat(ChangeDeltaCalculator.compute("6,200", "6,800")).isEqualTo(ChangeDelta("-600", "-8.8"))
    }

    @Test
    fun returnsNullWhenEitherValueIsNotANumber() {
        assertThat(ChangeDeltaCalculator.compute("abc", "1")).isNull()
        assertThat(ChangeDeltaCalculator.compute("1", "")).isNull()
        assertThat(ChangeDeltaCalculator.compute("1.2.3", "1")).isNull()
        assertThat(ChangeDeltaCalculator.compute("양성", "음성")).isNull()
        // A lab result recorded as a qualitative reading rather than a number: no delta at all.
        assertThat(ChangeDeltaCalculator.compute("trace", "0.1")).isNull()
    }

    @Test
    fun carriesNoInterpretationFields() {
        assertThat(ChangeDelta::class.java.declaredFields.map { it.name })
            .containsExactlyInAnyOrder("absolute", "percent")
    }
}
