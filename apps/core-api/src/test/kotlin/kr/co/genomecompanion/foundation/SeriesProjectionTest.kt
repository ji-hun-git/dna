package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class SeriesProjectionTest {
    private val document = UUID.fromString("11111111-1111-4111-8111-111111111111")

    private fun row(
        label: String,
        value: String,
        observedOn: String,
        unit: String = "mg/dL",
        conceptCode: String? = "total-cholesterol",
        status: String = "CURRENT",
        confirmedAt: String = "2026-08-01T00:00:00Z",
        recordId: UUID = UUID.randomUUID(),
        originalLabel: String? = null,
    ) = FoundationRecordRow(
        recordId = recordId,
        recordVersionId = UUID.randomUUID(),
        supersedesVersionId = null,
        candidateId = UUID.randomUUID(),
        documentId = document,
        subjectId = "synthetic-jason",
        status = status,
        label = label,
        currentValue = value,
        originalValue = value,
        unit = unit,
        observedOn = LocalDate.parse(observedOn),
        versionChangedAt = Instant.parse(confirmedAt),
        correctionReason = null,
        evidencePage = 1,
        sourceTextSha256 = "b".repeat(64),
        documentSha256 = "a".repeat(64),
        conceptCode = conceptCode,
        referenceRangeText = "120-199",
        originalLabel = originalLabel,
    )

    @Test
    fun keepsEachPointsOwnResultSheetLabelInsideOneSeries() {
        val january = row("총콜레스테롤", "194", "2026-01-15", originalLabel = "T-Chol")
        val july = row("총콜레스테롤", "190", "2026-07-28", originalLabel = "Cholesterol")
        val series = SeriesProjection.project(listOf(july, january)).series.single()
        assertThat(series.concept).isEqualTo("총콜레스테롤")
        assertThat(series.points.map { it.originalLabel }).containsExactly("T-Chol", "Cholesterol")
    }

    @Test
    fun groupsByConceptAndUnitSortsSeriesByLabelThenUnitAndPointsInTimeOrder() {
        val july = row("총콜레스테롤", "188", "2026-07-28")
        val january = row("총콜레스테롤", "194", "2026-01-15")
        val otherUnit = row("총콜레스테롤", "4.9", "2026-03-01", unit = "mmol/L")
        val hba1c = row("당화혈색소", "5.2", "2026-07-28", unit = "%", conceptCode = "hba1c")
        val superseded = row("총콜레스테롤", "999", "2026-02-01", status = "SUPERSEDED")

        val response = SeriesProjection.project(listOf(july, otherUnit, hba1c, superseded, january))

        assertThat(response.series.map { it.concept to it.unit })
            .containsExactly("당화혈색소" to "%", "총콜레스테롤" to "mg/dL", "총콜레스테롤" to "mmol/L")
        val cholesterol = response.series[1]
        assertThat(cholesterol.conceptCode).isEqualTo("total-cholesterol")
        assertThat(cholesterol.points).containsExactly(
            SeriesPoint(january.recordVersionId, "194", "2026-01-15", document),
            SeriesPoint(july.recordVersionId, "188", "2026-07-28", document),
        )
        assertThat(response.toString()).doesNotContain("999", "120-199")
    }

    @Test
    fun ordersTwoPointsOfTheSameDayByConfirmationInstantThenRecordIdText() {
        val idA = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
        val idB = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
        val late = row("총콜레스테롤", "3", "2026-07-28", confirmedAt = "2026-08-02T00:00:00Z")
        val tieB = row("총콜레스테롤", "2", "2026-07-28", recordId = idB)
        val tieA = row("총콜레스테롤", "1", "2026-07-28", recordId = idA)

        val series = SeriesProjection.project(listOf(late, tieB, tieA)).series.single()

        assertThat(series.points.map { it.value }).containsExactly("1", "2", "3")
        // Same date: which point is "last" depends on confirmation order, so no difference is printed.
        assertThat(series.derived.lastDifference).isNull()
        assertThat(series.derived.per30Days).isNull()
        assertThat(series.derived.meanOfLast3).isEqualTo("2.0")
    }

    @Test
    fun aSameDayDifferenceIsOmittedRegardlessOfWhichConfirmationCameSecond() {
        val idA = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
        val idB = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
        val first = row("총콜레스테롤", "1", "2026-07-28", confirmedAt = "2026-08-01T00:00:00Z", recordId = idA)
        val second = row("총콜레스테롤", "2", "2026-07-28", confirmedAt = "2026-08-02T00:00:00Z", recordId = idB)

        val orderA = SeriesProjection.project(listOf(first, second)).series.single().derived
        val orderB = SeriesProjection.project(listOf(second, first)).series.single().derived

        assertThat(orderA).isEqualTo(orderB)
        assertThat(orderA.lastDifference).isNull()
        assertThat(orderA.per30Days).isNull()
    }

    @Test
    fun per30DaysIsOmittedUnderThirtyDaysAndComputedAtExactlyThirty() {
        val oneDay = SeriesProjection.project(
            listOf(row("총콜레스테롤", "10", "2026-01-01"), row("총콜레스테롤", "11", "2026-01-02")),
        ).series.single()
        assertThat(oneDay.derived.per30Days).isNull()

        val twentyNineDays = SeriesProjection.project(
            listOf(row("총콜레스테롤", "10", "2026-01-01"), row("총콜레스테롤", "11", "2026-01-30")),
        ).series.single()
        assertThat(twentyNineDays.derived.per30Days).isNull()

        // 30 days: +1 / 30 × 30 = +1.0.
        val thirtyDays = SeriesProjection.project(
            listOf(row("총콜레스테롤", "10", "2026-01-01"), row("총콜레스테롤", "11", "2026-01-31")),
        ).series.single()
        assertThat(thirtyDays.derived.per30Days).isEqualTo("+1.0")
    }

    @Test
    fun matchesAnUncodedRecordToItsCodedSelfByNormalizedLabel() {
        val coded = row("총콜레스테롤", "194", "2026-01-15")
        val uncoded = row(" 총콜레스테롤 ", "188", "2026-07-28", conceptCode = null)

        val series = SeriesProjection.project(listOf(uncoded, coded)).series.single()

        assertThat(series.points).hasSize(2)
        assertThat(series.conceptCode).isEqualTo("total-cholesterol")
        assertThat(series.concept).isEqualTo(" 총콜레스테롤 ")
    }

    @Test
    fun derivesNothingFromOnePointAndTheDifferenceAndThirtyDayScalingFromTwo() {
        val single = SeriesProjection.project(listOf(row("총콜레스테롤", "194", "2026-01-15"))).series.single()
        assertThat(single.derived).isEqualTo(SeriesDerived(null, null, null))

        // 2026-01-15 → 2026-07-28 is 194 days: -6 / 194 × 30 = -0.9278… → -0.9 (scale 0 + 1).
        val two = SeriesProjection.project(
            listOf(row("총콜레스테롤", "188", "2026-07-28"), row("총콜레스테롤", "194", "2026-01-15")),
        ).series.single()
        assertThat(two.derived).isEqualTo(SeriesDerived(ChangeDelta("-6", "-3.1"), "-0.9", null))
    }

    @Test
    fun meanOfTheLastThreeUsesOnlyTheLastThreeAtOneMoreDecimalThanTheInputs() {
        val series = SeriesProjection.project(
            listOf(
                row("총콜레스테롤", "500", "2025-01-15"),
                row("총콜레스테롤", "194", "2026-01-15"),
                row("총콜레스테롤", "188", "2026-04-15"),
                row("총콜레스테롤", "192", "2026-07-28"),
            ),
        ).series.single()
        assertThat(series.derived.meanOfLast3).isEqualTo("191.3")

        val decimals = SeriesProjection.project(
            listOf(
                row("당화혈색소", "5.4", "2026-01-15", unit = "%", conceptCode = "hba1c"),
                row("당화혈색소", "5.25", "2026-04-15", unit = "%", conceptCode = "hba1c"),
                row("당화혈색소", "5.2", "2026-07-28", unit = "%", conceptCode = "hba1c"),
            ),
        ).series.single()
        assertThat(decimals.derived.meanOfLast3).isEqualTo("5.283")
    }

    @Test
    fun aPercentUnitKeepsTheAbsoluteDifferenceOnlyAndStillScalesToThirtyDays() {
        val series = SeriesProjection.project(
            listOf(
                row("당화혈색소", "5.4", "2026-01-15", unit = "%", conceptCode = "hba1c"),
                row("당화혈색소", "5.2", "2026-07-28", unit = "%", conceptCode = "hba1c"),
            ),
        ).series.single()
        assertThat(series.derived.lastDifference).isEqualTo(ChangeDelta("-0.2", null))
        assertThat(series.derived.per30Days).isEqualTo("-0.03")
    }

    @Test
    fun roundsHalfEvenKeepsZeroUnsignedAndOmitsEverythingForANonNumericValue() {
        // 2026-01-01 → 2026-05-01 is 120 days: +1 / 120 × 30 = 0.25 → HALF_EVEN → +0.2 (HALF_UP would say +0.3).
        val tie = SeriesProjection.project(
            listOf(row("총콜레스테롤", "10", "2026-01-01"), row("총콜레스테롤", "11", "2026-05-01")),
        ).series.single()
        assertThat(tie.derived.per30Days).isEqualTo("+0.2")

        val zero = SeriesProjection.project(
            listOf(row("총콜레스테롤", "10", "2026-01-01"), row("총콜레스테롤", "10", "2026-05-01")),
        ).series.single()
        assertThat(zero.derived.lastDifference).isEqualTo(ChangeDelta("0", "0.0"))
        assertThat(zero.derived.per30Days).isEqualTo("0.0")

        val text = SeriesProjection.project(
            listOf(
                row("요단백", "1", "2026-01-01", unit = "mg/dL", conceptCode = null),
                row("요단백", "2", "2026-03-01", unit = "mg/dL", conceptCode = null),
                row("요단백", "음성", "2026-05-01", unit = "mg/dL", conceptCode = null),
            ),
        ).series.single()
        assertThat(text.derived).isEqualTo(SeriesDerived(null, null, null))
        assertThat(text.points.map { it.value }).containsExactly("1", "2", "음성")
    }

    @Test
    fun aNonTransitiveChainOfMatchesStillFormsOneSeriesRegardlessOfInputOrder() {
        // A and B match by label (both uncoded); B and C match by concept code; A and C match
        // neither way (A is uncoded, C's code makes conceptsMatch compare labels, and "Chol" != "TC").
        // conceptsMatch is therefore not transitive, so the grouping must be connected components,
        // not "does it match the first row of an existing group".
        val a = row("Chol", "1", "2026-01-01", conceptCode = null)
        val b = row("Chol", "2", "2026-02-01", conceptCode = "total-cholesterol")
        val c = row("TC", "3", "2026-03-01", conceptCode = "total-cholesterol")

        val forward = SeriesProjection.project(listOf(a, b, c))
        val shuffled = SeriesProjection.project(listOf(c, a, b))

        assertThat(forward.series).hasSize(1)
        assertThat(forward.series.single().points.map { it.value }).containsExactly("1", "2", "3")
        assertThat(forward).isEqualTo(shuffled)
    }

    @Test
    fun theResultDoesNotDependOnInputOrder() {
        val rows = listOf(
            row("총콜레스테롤", "194", "2026-01-15"),
            row("총콜레스테롤", "188", "2026-07-28"),
            row("당화혈색소", "5.2", "2026-07-28", unit = "%", conceptCode = "hba1c"),
            row("비타민 D", "45", "2026-01-15", unit = "ng/mL", conceptCode = "vitamin-d"),
        )
        assertThat(SeriesProjection.project(rows.reversed())).isEqualTo(SeriesProjection.project(rows))
        assertThat(SeriesProjection.project(emptyList())).isEqualTo(SeriesResponse(emptyList()))
    }
}
