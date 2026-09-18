package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class ChangeSummaryProjectionTest {
    private val januaryDocument = UUID.fromString("11111111-1111-4111-8111-111111111111")
    private val aprilDocument = UUID.fromString("22222222-2222-4222-8222-222222222222")
    private val julyDocument = UUID.fromString("33333333-3333-4333-8333-333333333333")

    private fun completed(documentId: UUID, at: String) = DocumentCompletionRow(documentId, Instant.parse(at))

    private fun row(
        label: String,
        value: String,
        observedOn: LocalDate,
        documentId: UUID,
        unit: String = "mg/dL",
        conceptCode: String? = "total-cholesterol",
        status: String = "CURRENT",
        confirmedAt: Instant = Instant.parse("2026-07-28T09:10:00Z"),
        versionChangedAt: Instant = confirmedAt,
        recordId: UUID = UUID.randomUUID(),
    ) = FoundationRecordRow(
        recordId = recordId,
        recordVersionId = UUID.randomUUID(),
        supersedesVersionId = null,
        candidateId = UUID.randomUUID(),
        documentId = documentId,
        subjectId = "synthetic-jason",
        status = status,
        label = label,
        currentValue = value,
        originalValue = value,
        unit = unit,
        observedOn = observedOn,
        versionChangedAt = versionChangedAt,
        confirmedAt = confirmedAt,
        correctionReason = null,
        evidencePage = 1,
        sourceTextSha256 = "b".repeat(64),
        documentSha256 = "a".repeat(64),
        conceptCode = conceptCode,
    )

    @Test
    fun returnsAnEmptySummaryWithoutACompletedDocumentThatStillHasCurrentRecords() {
        assertThat(ChangeSummaryProjection.project(emptyList(), emptyList()))
            .isEqualTo(ChangeSummary(null, emptyList(), emptyList(), 0))
        val superseded = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument, status = "SUPERSEDED")
        assertThat(ChangeSummaryProjection.project(listOf(superseded), listOf(completed(julyDocument, "2026-07-28T10:00:00Z"))).latestDocument)
            .isNull()
        val orphan = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument)
        assertThat(ChangeSummaryProjection.project(listOf(orphan), emptyList()).items).isEmpty()
    }

    @Test
    fun picksTheMostRecentlyCompletedDocumentThatStillHasCurrentRecords() {
        val records = listOf(
            row("총콜레스테롤", "194", LocalDate.of(2026, 1, 15), januaryDocument),
            row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument),
            row("당화혈색소", "5.2", LocalDate.of(2026, 7, 28), julyDocument, unit = "%", conceptCode = "hba1c"),
        )
        val documents = listOf(
            completed(januaryDocument, "2026-07-01T00:00:00Z"),
            completed(julyDocument, "2026-07-28T10:00:00Z"),
            completed(aprilDocument, "2026-08-01T00:00:00Z"),
        )

        val summary = ChangeSummaryProjection.project(records, documents)

        val latest = checkNotNull(summary.latestDocument)
        assertThat(latest.documentId).isEqualTo(julyDocument)
        assertThat(latest.completedAt).isEqualTo(Instant.parse("2026-07-28T10:00:00Z"))
        assertThat(latest.observedOn).isEqualTo("2026-07-28")
        assertThat(latest.eventCount).isEqualTo(2)
        assertThat(summary.items.map { it.concept }).containsExactly("당화혈색소", "총콜레스테롤")
    }

    @Test
    fun pairsEachItemWithTheLatestObservedValueOfTheSameConceptFromOtherDocuments() {
        val january = row("총콜레스테롤", "194", LocalDate.of(2026, 1, 15), januaryDocument)
        val april = row("총콜레스테롤", "190", LocalDate.of(2026, 4, 10), aprilDocument)
        val july = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument)
        val documents = listOf(
            completed(aprilDocument, "2026-04-11T00:00:00Z"),
            completed(januaryDocument, "2026-05-01T00:00:00Z"),
            completed(julyDocument, "2026-07-28T10:00:00Z"),
        )

        val item = ChangeSummaryProjection.project(listOf(january, april, july), documents).items.single()

        assertThat(item.conceptCode).isEqualTo("total-cholesterol")
        assertThat(item.unit).isEqualTo("mg/dL")
        assertThat(item.latest).isEqualTo(ChangeValue(july.recordVersionId, "188", "2026-07-28"))
        assertThat(item.previous).isEqualTo(ChangeValue(april.recordVersionId, "190", "2026-04-10"))
    }

    @Test
    fun fallsBackToTheLabelWhenTheConceptCodeIsMissing() {
        val earlier = row("알 수 없는 항목", "7", LocalDate.of(2026, 1, 15), januaryDocument, conceptCode = null)
        val other = row("다른 항목", "9", LocalDate.of(2026, 1, 15), januaryDocument, conceptCode = null)
        val latest = row("알 수 없는 항목", "8", LocalDate.of(2026, 7, 28), julyDocument, conceptCode = null)
        val documents = listOf(completed(januaryDocument, "2026-02-01T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val summary = ChangeSummaryProjection.project(listOf(earlier, other, latest), documents)

        assertThat(summary.items.single().previous).isEqualTo(ChangeValue(earlier.recordVersionId, "7", "2026-01-15"))
        assertThat(summary.items.single().conceptCode).isNull()
        assertThat(summary.unchangedCount).isEqualTo(1)
    }

    @Test
    fun leavesPreviousNullWhenTheUnitDiffersInsteadOfConverting() {
        val mmol = row("총콜레스테롤", "5.0", LocalDate.of(2026, 1, 15), januaryDocument, unit = "mmol/L")
        val mg = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument, unit = "mg/dL")
        val documents = listOf(completed(januaryDocument, "2026-02-01T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val summary = ChangeSummaryProjection.project(listOf(mmol, mg), documents)

        assertThat(summary.items.single().previous).isNull()
        assertThat(summary.newConcepts).containsExactly("총콜레스테롤")
        assertThat(summary.unchangedCount).isZero()
    }

    @Test
    fun listsNewConceptsAndCountsConceptsMissingFromTheLatestDocument() {
        val records = listOf(
            row("총콜레스테롤", "194", LocalDate.of(2026, 1, 15), januaryDocument),
            row("당화혈색소", "5.4", LocalDate.of(2026, 1, 15), januaryDocument, unit = "%", conceptCode = "hba1c"),
            row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument),
            row("비타민 D", "42", LocalDate.of(2026, 7, 28), julyDocument, unit = "ng/mL", conceptCode = "vitamin-d"),
        )
        val documents = listOf(completed(januaryDocument, "2026-02-01T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val summary = ChangeSummaryProjection.project(records, documents)

        assertThat(summary.items.map { it.concept to (it.previous?.value) })
            .containsExactly("비타민 D" to null, "총콜레스테롤" to "194")
        assertThat(summary.newConcepts).containsExactly("비타민 D")
        assertThat(summary.unchangedCount).isEqualTo(1)
    }

    @Test
    fun breaksATieOnObservedOnAndConfirmedAtByDocumentIdTextRegardlessOfInputOrder() {
        val latestDocument = UUID.fromString("44444444-4444-4444-8444-444444444444")
        val tiedObservedOn = LocalDate.of(2026, 1, 15)
        val tiedConfirmedAt = Instant.parse("2026-01-16T00:00:00Z")
        val latest = row("총콜레스테롤", "150", LocalDate.of(2026, 7, 28), latestDocument)
        // aprilDocument's UUID text ("22222222-...") is lexicographically greater than
        // januaryDocument's ("11111111-..."), so it must win the tie regardless of input order.
        val fromJanuaryDoc = row(
            "총콜레스테롤", "190", tiedObservedOn, januaryDocument,
            confirmedAt = tiedConfirmedAt,
        )
        val fromAprilDoc = row(
            "총콜레스테롤", "191", tiedObservedOn, aprilDocument,
            confirmedAt = tiedConfirmedAt,
        )
        val documents = listOf(
            completed(latestDocument, "2026-07-28T10:00:00Z"),
            completed(januaryDocument, "2026-02-01T00:00:00Z"),
            completed(aprilDocument, "2026-04-11T00:00:00Z"),
        )

        val forwardOrder = ChangeSummaryProjection.project(listOf(latest, fromJanuaryDoc, fromAprilDoc), documents)
        val reverseOrder = ChangeSummaryProjection.project(listOf(latest, fromAprilDoc, fromJanuaryDoc), documents)

        assertThat(forwardOrder.items.single().previous)
            .isEqualTo(ChangeValue(fromAprilDoc.recordVersionId, "191", tiedObservedOn.toString()))
        assertThat(reverseOrder.items.single().previous)
            .isEqualTo(ChangeValue(fromAprilDoc.recordVersionId, "191", tiedObservedOn.toString()))
    }

    @Test
    fun breaksALatestDocumentTieOnCompletedAtByDocumentIdText() {
        // Existing rule: verified here alongside the previous-value tie-break above.
        val records = listOf(
            row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument),
            row("총콜레스테롤", "190", LocalDate.of(2026, 7, 28), aprilDocument),
        )
        val tiedCompletedAt = "2026-07-28T10:00:00Z"
        val documents = listOf(
            completed(julyDocument, tiedCompletedAt),
            completed(aprilDocument, tiedCompletedAt),
        )

        val summary = ChangeSummaryProjection.project(records, documents)

        // julyDocument ("33333333-...") is lexicographically greater than aprilDocument ("22222222-...").
        assertThat(checkNotNull(summary.latestDocument).documentId).isEqualTo(julyDocument)
    }

    @Test
    fun pairsRecordsWhenTheLatestGainedAConceptCodeTheEarlierOneLacked() {
        val earlier = row("당화혈색소", "5.4", LocalDate.of(2026, 1, 15), januaryDocument, unit = "%", conceptCode = null)
        val latest = row("당화혈색소", "5.2", LocalDate.of(2026, 7, 28), julyDocument, unit = "%", conceptCode = "hba1c")
        val documents = listOf(completed(januaryDocument, "2026-02-01T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val summary = ChangeSummaryProjection.project(listOf(earlier, latest), documents)

        assertThat(summary.items.single().previous).isEqualTo(ChangeValue(earlier.recordVersionId, "5.4", "2026-01-15"))
        assertThat(summary.unchangedCount).isZero()
    }

    @Test
    fun pairsRecordsWhenTheLatestLostItsConceptCodeButTheLabelStillMatches() {
        val earlier = row("당화혈색소", "5.4", LocalDate.of(2026, 1, 15), januaryDocument, unit = "%", conceptCode = "hba1c")
        val latest = row("당화혈색소", "5.2", LocalDate.of(2026, 7, 28), julyDocument, unit = "%", conceptCode = null)
        val documents = listOf(completed(januaryDocument, "2026-02-01T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val summary = ChangeSummaryProjection.project(listOf(earlier, latest), documents)

        assertThat(summary.items.single().previous).isEqualTo(ChangeValue(earlier.recordVersionId, "5.4", "2026-01-15"))
        assertThat(summary.unchangedCount).isZero()
    }

    @Test
    fun doesNotPairRecordsWithDifferentLabelsAndNoConceptCodes() {
        val earlier = row("항목 A", "1", LocalDate.of(2026, 1, 15), januaryDocument, unit = "unit", conceptCode = null)
        val latest = row("항목 B", "2", LocalDate.of(2026, 7, 28), julyDocument, unit = "unit", conceptCode = null)
        val documents = listOf(completed(januaryDocument, "2026-02-01T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val summary = ChangeSummaryProjection.project(listOf(earlier, latest), documents)

        assertThat(summary.items.single().previous).isNull()
        assertThat(summary.unchangedCount).isEqualTo(1)
    }

    @Test
    fun countsATransitiveConceptChainAsOneUnchangedGroupRegardlessOfInputOrder() {
        // A has no code, matches B by label. B and C share a code. A and C, taken alone, match
        // neither by code (A has none) nor by label ("미확인 항목" != "다른 표기") — only the chain
        // A~B~C (as connected components under conceptsMatch) makes them one group.
        val latestDocument = UUID.fromString("55555555-5555-4555-8555-555555555555")
        val recA = row("미확인 항목", "1", LocalDate.of(2026, 1, 15), januaryDocument, unit = "unit", conceptCode = null)
        val recB = row("미확인 항목", "2", LocalDate.of(2026, 4, 10), aprilDocument, unit = "unit", conceptCode = "shared-code")
        val recC = row("다른 표기", "3", LocalDate.of(2026, 7, 1), julyDocument, unit = "unit", conceptCode = "shared-code")
        val unrelatedLatest = row("총콜레스테롤", "150", LocalDate.of(2026, 8, 1), latestDocument)
        val documents = listOf(
            completed(januaryDocument, "2026-02-01T00:00:00Z"),
            completed(aprilDocument, "2026-04-11T00:00:00Z"),
            completed(julyDocument, "2026-07-02T00:00:00Z"),
            completed(latestDocument, "2026-08-01T10:00:00Z"),
        )

        val forwardOrder = ChangeSummaryProjection.project(listOf(recA, recB, recC, unrelatedLatest), documents)
        val reverseOrder = ChangeSummaryProjection.project(listOf(unrelatedLatest, recC, recB, recA), documents)

        assertThat(forwardOrder.unchangedCount).isEqualTo(1)
        assertThat(reverseOrder.unchangedCount).isEqualTo(1)
    }

    @Test
    fun excludesATransitiveConceptChainFromUnchangedWhenTheLatestDocumentMatchesAnyMemberOfIt() {
        val latestDocument = UUID.fromString("55555555-5555-4555-8555-555555555555")
        val recA = row("미확인 항목", "1", LocalDate.of(2026, 1, 15), januaryDocument, unit = "unit", conceptCode = null)
        val recB = row("미확인 항목", "2", LocalDate.of(2026, 4, 10), aprilDocument, unit = "unit", conceptCode = "shared-code")
        val recC = row("다른 표기", "3", LocalDate.of(2026, 7, 1), julyDocument, unit = "unit", conceptCode = "shared-code")
        // Matches recA by label and recB/recC by code, so it links to the whole component.
        val latest = row("미확인 항목", "4", LocalDate.of(2026, 8, 1), latestDocument, unit = "unit", conceptCode = "shared-code")
        val documents = listOf(
            completed(januaryDocument, "2026-02-01T00:00:00Z"),
            completed(aprilDocument, "2026-04-11T00:00:00Z"),
            completed(julyDocument, "2026-07-02T00:00:00Z"),
            completed(latestDocument, "2026-08-01T10:00:00Z"),
        )

        val summary = ChangeSummaryProjection.project(listOf(recA, recB, recC, latest), documents)

        assertThat(summary.unchangedCount).isZero()
    }

    @Test
    fun breaksAnItemsOrderTieOnLabelAndConfirmedAtByRecordIdTextRegardlessOfInputOrder() {
        // Two CURRENT records of the latest document share both label and confirmedAt (e.g. two
        // panel entries filed under the same display label), so compareBy { label }.thenBy {
        // confirmedAt } alone cannot order them deterministically; recordId text must decide.
        val latestDocument = UUID.fromString("66666666-6666-4666-8666-666666666666")
        val tiedConfirmedAt = Instant.parse("2026-08-01T09:00:00Z")
        val recordWithLowerId = row(
            "총콜레스테롤", "150", LocalDate.of(2026, 8, 1), latestDocument,
            conceptCode = "total-cholesterol-a",
            confirmedAt = tiedConfirmedAt,
            recordId = UUID.fromString("00000000-0000-4000-8000-000000000001"),
        )
        val recordWithHigherId = row(
            "총콜레스테롤", "151", LocalDate.of(2026, 8, 1), latestDocument,
            conceptCode = "total-cholesterol-b",
            confirmedAt = tiedConfirmedAt,
            recordId = UUID.fromString("00000000-0000-4000-8000-000000000002"),
        )
        val documents = listOf(completed(latestDocument, "2026-08-01T10:00:00Z"))

        val forwardOrder = ChangeSummaryProjection.project(listOf(recordWithLowerId, recordWithHigherId), documents)
        val reverseOrder = ChangeSummaryProjection.project(listOf(recordWithHigherId, recordWithLowerId), documents)

        assertThat(forwardOrder.items.map { it.conceptCode })
            .containsExactly("total-cholesterol-a", "total-cholesterol-b")
        assertThat(reverseOrder.items.map { it.conceptCode })
            .containsExactly("total-cholesterol-a", "total-cholesterol-b")
    }

    @Test
    fun ordersItemsAndPicksThePreviousValueByTheImmutableConfirmedAtNotByAVersionChangedAtACorrectionBumps() {
        // A correction on one of two same-label items in the latest document bumps only its
        // versionChangedAt far into the future; confirmed_at never moves. Both the items list and
        // the "previous value" pick (which also breaks ties on this instant) must stay ordered by
        // confirmedAt (F4), or a correction would silently reorder the change summary.
        val latestDocument = UUID.fromString("77777777-7777-4777-8777-777777777777")
        val correctedButConfirmedFirst = row(
            "총콜레스테롤", "150", LocalDate.of(2026, 8, 1), latestDocument,
            conceptCode = "total-cholesterol-a",
            confirmedAt = Instant.parse("2026-08-01T09:00:00Z"),
            versionChangedAt = Instant.parse("2026-09-19T12:00:00Z"),
        )
        val neverCorrectedButConfirmedSecond = row(
            "총콜레스테롤", "151", LocalDate.of(2026, 8, 1), latestDocument,
            conceptCode = "total-cholesterol-b",
            confirmedAt = Instant.parse("2026-08-01T09:05:00Z"),
            versionChangedAt = Instant.parse("2026-08-01T09:05:00Z"),
        )
        val documents = listOf(completed(latestDocument, "2026-08-01T10:00:00Z"))

        val summary = ChangeSummaryProjection.project(listOf(neverCorrectedButConfirmedSecond, correctedButConfirmedFirst), documents)

        assertThat(summary.items.map { it.conceptCode })
            .containsExactly("total-cholesterol-a", "total-cholesterol-b")
    }

    @Test
    fun carriesNoInterpretationFields() {
        val itemFields = ChangeItem::class.java.declaredFields.map { it.name }
        val summaryFields = ChangeSummary::class.java.declaredFields.map { it.name }
        assertThat(itemFields + summaryFields)
            .doesNotContain("direction", "trend", "referenceRange", "referenceRangeText", "flag", "normal", "abnormal", "risk", "arrow", "colour")
        assertThat(itemFields).contains("delta")
    }

    @Test
    fun attachesTheSignedDifferenceOnlyWhenAPreviousValueExists() {
        val january = row("총콜레스테롤", "194", LocalDate.of(2026, 1, 15), januaryDocument)
        val july = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument)
        val vitaminD = row("비타민 D", "42", LocalDate.of(2026, 7, 28), julyDocument, unit = "ng/mL", conceptCode = "vitamin-d")
        val documents = listOf(completed(januaryDocument, "2026-01-16T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val items = ChangeSummaryProjection.project(listOf(january, july, vitaminD), documents).items.associateBy { it.concept }

        assertThat(items.getValue("총콜레스테롤").delta).isEqualTo(ChangeDelta("-6", "-3.1"))
        assertThat(items.getValue("비타민 D").previous).isNull()
        assertThat(items.getValue("비타민 D").delta).isNull()
    }

    @Test
    fun leavesTheDeltaNullWhenTheUnitDiffersOrAValueIsNotNumeric() {
        val januaryOtherUnit = row("총콜레스테롤", "5.0", LocalDate.of(2026, 1, 15), januaryDocument, unit = "mmol/L")
        val julyText = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument)
        val januaryNonNumeric = row(
            "요산", "trace", LocalDate.of(2026, 1, 15), januaryDocument,
            unit = "mg/dL", conceptCode = "uric-acid",
        )
        val julyNonNumericPair = row(
            "요산", "5.1", LocalDate.of(2026, 7, 28), julyDocument,
            unit = "mg/dL", conceptCode = "uric-acid",
        )
        val documents = listOf(completed(januaryDocument, "2026-01-16T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val items = ChangeSummaryProjection.project(
            listOf(januaryOtherUnit, julyText, januaryNonNumeric, julyNonNumericPair),
            documents,
        ).items.associateBy { it.concept }

        val unitDiffers = items.getValue("총콜레스테롤")
        assertThat(unitDiffers.previous).isNull()
        assertThat(unitDiffers.delta).isNull()

        val nonNumericValue = items.getValue("요산")
        assertThat(nonNumericValue.previous?.value).isEqualTo("trace")
        assertThat(nonNumericValue.delta).isNull()
    }

    @Test
    fun omitsThePercentButKeepsTheAbsoluteDeltaWhenTheItemsUnitIsAPercent() {
        val january = row(
            "당화혈색소", "5.6", LocalDate.of(2026, 1, 15), januaryDocument,
            unit = "%", conceptCode = "hba1c",
        )
        val july = row(
            "당화혈색소", "5.8", LocalDate.of(2026, 7, 28), julyDocument,
            unit = "%", conceptCode = "hba1c",
        )
        val documents = listOf(completed(januaryDocument, "2026-01-16T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val item = ChangeSummaryProjection.project(listOf(january, july), documents).items.single()

        assertThat(item.delta).isEqualTo(ChangeDelta("+0.2", null))
    }

    @Test
    fun omitsTheDeltaWhenThePreviousDateIsLaterThanTheLatestDateButKeepsBothValues() {
        // Which document is "latest" is decided by completedAt, independently of each record's own
        // observedOn: here the earlier-completed document's record carries a later exam date.
        val laterDatedPrevious = row(
            "총콜레스테롤", "194", LocalDate.of(2026, 8, 1), januaryDocument,
        )
        val earlierDatedLatest = row(
            "총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument,
        )
        val documents = listOf(completed(januaryDocument, "2026-01-16T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val item = ChangeSummaryProjection.project(listOf(laterDatedPrevious, earlierDatedLatest), documents).items.single()

        assertThat(item.previous).isNotNull()
        assertThat(item.delta).isNull()
    }

    @Test
    fun omitsTheDeltaWhenThePreviousDateEqualsTheLatestDateLikeSeriesDoes() {
        // Same-day points have no defined order (see SeriesProjection): /changes omits the delta
        // here exactly as /series omits lastDifference, while both values stay listed.
        val previous = row("총콜레스테롤", "194", LocalDate.of(2026, 7, 28), januaryDocument)
        val latest = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument)
        val documents = listOf(completed(januaryDocument, "2026-01-16T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val item = ChangeSummaryProjection.project(listOf(previous, latest), documents).items.single()

        assertThat(item.previous?.value).isEqualTo("194")
        assertThat(item.delta).isNull()
    }

    @Test
    fun `a previous value observed on the same day lists both values but omits the delta like series does`() {
        val today = LocalDate.of(2026, 7, 28)
        val previous = row("총콜레스테롤", "190", today, januaryDocument, confirmedAt = Instant.parse("2026-07-28T01:00:00Z"))
        val latest = row("총콜레스테롤", "188", today, julyDocument, confirmedAt = Instant.parse("2026-07-28T02:00:00Z"))
        val summary = ChangeSummaryProjection.project(
            listOf(previous, latest),
            listOf(completed(januaryDocument, "2026-07-28T01:00:00Z"), completed(julyDocument, "2026-07-28T02:00:00Z")),
        )
        val item = summary.items.single()
        assertThat(item.previous?.value).isEqualTo("190")
        assertThat(item.delta).isNull()
    }
}
