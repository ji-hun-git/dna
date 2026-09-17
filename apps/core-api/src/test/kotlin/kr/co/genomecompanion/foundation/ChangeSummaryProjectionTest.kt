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
    ) = FoundationRecordRow(
        recordId = UUID.randomUUID(),
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
    fun carriesNoInterpretationFields() {
        val itemFields = ChangeItem::class.java.declaredFields.map { it.name }
        val summaryFields = ChangeSummary::class.java.declaredFields.map { it.name }
        assertThat(itemFields + summaryFields)
            .doesNotContain("difference", "delta", "direction", "trend", "referenceRange", "flag", "normal", "abnormal", "risk")
    }
}
