package kr.co.genomecompanion.foundation

import java.time.LocalDate

/**
 * Same-day points have no defined order: which one is "previous"/"last" depends on click order,
 * not exam sequence, so a signed difference computed across them would run against chronology.
 * Shared by `/changes` (ChangeSummaryProjection) and `/series` (SeriesProjection) so the two
 * read-models can't drift apart on this rule.
 */
object SameDayRule {
    /** True only when `earlier` is strictly before `later` — equal dates have no defined order. */
    fun hasDefinedOrder(earlier: LocalDate, later: LocalDate): Boolean = earlier < later
}
