package kr.co.genomecompanion.foundation

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.temporal.ChronoUnit
import java.util.UUID

/** One confirmed value in a series. `eventId` is the CURRENT record version, as in HealthEvent. */
data class SeriesPoint(
    val eventId: UUID,
    val value: String,
    val observedOn: String,
    val documentId: UUID,
    /** The item name this point's result sheet printed; lets the person see that one series was written differently. */
    val originalLabel: String? = null,
)

/**
 * Plain arithmetic on the person's own values, always in time order
 * (governance/intended-use-decision-measurement-history-2026-09-17.md). Each member is null —
 * and therefore omitted from the JSON — when it cannot be computed. No direction, no meaning.
 */
data class SeriesDerived(
    /** `ChangeDeltaCalculator.compute(last, previous)`; percent dropped for a `%` unit. */
    val lastDifference: ChangeDelta? = null,
    /** `absolute / days × 30`, HALF_EVEN, one more decimal than the inputs, sign explicit, zero unsigned. */
    val per30Days: String? = null,
    /** Arithmetic mean of the last three values, HALF_EVEN, one more decimal than the inputs. */
    val meanOfLast3: String? = null,
)

data class MeasurementSeries(
    val conceptCode: String?,
    val concept: String,
    val unit: String,
    val points: List<SeriesPoint>,
    val derived: SeriesDerived,
)

data class SeriesResponse(val series: List<MeasurementSeries>)

object SeriesProjection {
    private val thirty = BigDecimal(30)
    private val three = BigDecimal(3)
    private val chronological = compareBy<FoundationRecordRow> { it.observedOn }
        .thenBy { it.versionChangedAt }
        .thenBy { it.recordId.toString() }

    /**
     * A series is a connected component of CURRENT records under "same concept
     * ([ChangeSummaryProjection.conceptsMatch]) and same unit". Components, not first-match
     * grouping, because conceptsMatch is not transitive; the input is put in a canonical order
     * first so the result is a function of the record set, not of its order. No unit conversion.
     */
    fun project(records: List<FoundationRecordRow>): SeriesResponse {
        val current = records
            .filter { it.status == "CURRENT" }
            .sortedWith(compareBy<FoundationRecordRow> { it.documentId.toString() }.thenBy { it.recordId.toString() })
        val parent = IntArray(current.size) { it }
        fun find(index: Int): Int {
            var root = index
            while (parent[root] != root) root = parent[root]
            return root
        }
        for (i in current.indices) {
            for (j in i + 1 until current.size) {
                if (current[i].unit == current[j].unit && ChangeSummaryProjection.conceptsMatch(current[i], current[j])) {
                    val rootI = find(i)
                    val rootJ = find(j)
                    if (rootI != rootJ) parent[rootI] = rootJ
                }
            }
        }
        val series = current.indices
            .groupBy { find(it) }
            .values
            .map { members -> toSeries(members.map { current[it] }.sortedWith(chronological)) }
        return SeriesResponse(
            series.sortedWith(
                compareBy<MeasurementSeries> { it.concept }.thenBy { it.unit }.thenBy { it.points.first().eventId.toString() },
            ),
        )
    }

    private fun toSeries(rows: List<FoundationRecordRow>): MeasurementSeries {
        val last = rows.last()
        return MeasurementSeries(
            conceptCode = rows.lastOrNull { it.conceptCode != null }?.conceptCode,
            concept = last.label,
            unit = last.unit,
            points = rows.map { SeriesPoint(it.recordVersionId, it.currentValue, it.observedOn.toString(), it.documentId, it.originalLabel) },
            derived = derive(rows),
        )
    }

    private fun derive(rows: List<FoundationRecordRow>): SeriesDerived {
        if (rows.size < 2) return SeriesDerived()
        val last = rows[rows.size - 1]
        val previous = rows[rows.size - 2]
        // Same-day points have no defined order (shared SameDayRule): which is "last" depends on
        // click order, so the difference (and, transitively, per30Days) is omitted rather than
        // sign-flipping.
        val lastDifference = if (SameDayRule.hasDefinedOrder(previous.observedOn, last.observedOn)) {
            ChangeDeltaCalculator.compute(last.currentValue, previous.currentValue)
                ?.let { delta -> if (last.unit.trim() == "%") delta.copy(percent = null) else delta }
        } else {
            null
        }
        return SeriesDerived(
            lastDifference = lastDifference,
            per30Days = per30Days(last, previous),
            meanOfLast3 = meanOfLast3(rows),
        )
    }

    private fun per30Days(last: FoundationRecordRow, previous: FoundationRecordRow): String? {
        val lastNumber = ChangeDeltaCalculator.parse(last.currentValue) ?: return null
        val previousNumber = ChangeDeltaCalculator.parse(previous.currentValue) ?: return null
        val days = ChronoUnit.DAYS.between(previous.observedOn, last.observedOn)
        // Under 30 days, "per 30 days" would extrapolate a figure nobody measured; only ever
        // interpolate between two points that already span at least that gap.
        if (days < 30L) return null
        val scale = maxOf(lastNumber.scale(), previousNumber.scale()) + 1
        return ChangeDeltaCalculator.signed(
            lastNumber.subtract(previousNumber).multiply(thirty).divide(BigDecimal(days), scale, RoundingMode.HALF_EVEN),
        )
    }

    private fun meanOfLast3(rows: List<FoundationRecordRow>): String? {
        if (rows.size < 3) return null
        val values = rows.takeLast(3).map { ChangeDeltaCalculator.parse(it.currentValue) ?: return null }
        val scale = values.maxOf { it.scale() } + 1
        return values.reduce(BigDecimal::add).divide(three, scale, RoundingMode.HALF_EVEN).toPlainString()
    }
}
