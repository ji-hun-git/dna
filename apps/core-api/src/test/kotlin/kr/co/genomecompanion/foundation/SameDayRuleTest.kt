package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.LocalDate

class SameDayRuleTest {
    @Test
    fun hasDefinedOrderWhenTheEarlierDateIsStrictlyBeforeTheLaterDate() {
        assertThat(SameDayRule.hasDefinedOrder(LocalDate.of(2026, 1, 15), LocalDate.of(2026, 7, 28))).isTrue()
    }

    @Test
    fun hasNoDefinedOrderWhenTheTwoDatesAreEqual() {
        val day = LocalDate.of(2026, 7, 28)
        assertThat(SameDayRule.hasDefinedOrder(day, day)).isFalse()
    }

    @Test
    fun hasNoDefinedOrderWhenTheFirstArgumentIsLaterThanTheSecond() {
        // Strict semantics: the helper does not sort its arguments, so a caller that passes them
        // reversed does not get a defined order either.
        assertThat(SameDayRule.hasDefinedOrder(LocalDate.of(2026, 7, 28), LocalDate.of(2026, 1, 15))).isFalse()
    }
}
