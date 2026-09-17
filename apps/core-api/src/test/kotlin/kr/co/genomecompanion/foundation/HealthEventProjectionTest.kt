package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class HealthEventProjectionTest {
    private val docWithPreview = UUID.fromString("11111111-1111-4111-8111-111111111111")
    private val docWithoutPreview = UUID.fromString("22222222-2222-4222-8222-222222222222")

    private fun row(
        label: String,
        value: String,
        original: String = value,
        observedOn: LocalDate,
        originalObservedOn: LocalDate? = null,
        status: String = "CURRENT",
        documentId: UUID = docWithPreview,
        confirmedAt: Instant = Instant.parse("2026-07-28T09:10:00Z"),
        conceptCode: String? = "total-cholesterol",
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
        originalValue = original,
        unit = "mg/dL",
        observedOn = observedOn,
        originalObservedOn = originalObservedOn,
        confirmedAt = confirmedAt,
        correctionReason = if (original == value) null else "원문 재확인",
        evidencePage = 1,
        sourceTextSha256 = "b".repeat(64),
        documentSha256 = "a".repeat(64),
        conceptCode = conceptCode,
    )

    @Test
    fun projectsOnlyCurrentVersionsAsLabEventsOrderedByDateThenConcept() {
        val later = row("총콜레스테롤", "194", observedOn = LocalDate.of(2026, 7, 28))
        val earlier = row("비타민 D", "45", observedOn = LocalDate.of(2026, 1, 15))
        val superseded = row("총콜레스테롤", "188", observedOn = LocalDate.of(2026, 7, 28), status = "SUPERSEDED")

        val events = HealthEventProjection.project(listOf(later, superseded, earlier), setOf(docWithPreview))

        assertThat(events.map { it.concept }).containsExactly("비타민 D", "총콜레스테롤")
        assertThat(events.map { it.eventId }).containsExactly(earlier.recordVersionId, later.recordVersionId)
        assertThat(events.all { it.domain == "lab" }).isTrue()
        assertThat(events[0].observedOn).isEqualTo("2026-01-15")
    }

    @Test
    fun marksCorrectedValuesAndKeepsBothVerifiedWhenPreviewExists() {
        val corrected = row("당화혈색소", "5.3", original = "5.2", observedOn = LocalDate.of(2026, 7, 28))

        val event = HealthEventProjection.project(listOf(corrected), setOf(docWithPreview)).single()

        assertThat(event.corrected).isTrue()
        assertThat(event.verification).isEqualTo("verified")
        assertThat(event.value).isEqualTo("5.3")
        assertThat(event.originalValue).isEqualTo("5.2")
        assertThat(event.correctionReason).isEqualTo("원문 재확인")
        assertThat(event.originalObservedOn).isNull()
        assertThat(event.source.previewAvailable).isTrue()
        assertThat(event.source.page).isEqualTo(1)
    }

    @Test
    fun carriesTheParserDateOnlyWhenTheExamDateWasCorrected() {
        val dateCorrected = row("당화혈색소", "5.2", observedOn = LocalDate.of(2026, 7, 27), originalObservedOn = LocalDate.of(2026, 7, 28))
        val untouched = row("총콜레스테롤", "188", observedOn = LocalDate.of(2026, 7, 28))

        val events = HealthEventProjection.project(listOf(dateCorrected, untouched), setOf(docWithPreview))

        val corrected = events.single { it.concept == "당화혈색소" }
        assertThat(corrected.corrected).isTrue()
        assertThat(corrected.originalObservedOn).isEqualTo("2026-07-28")
        assertThat(corrected.originalValue).isEqualTo("5.2")
        assertThat(corrected.correctionReason).isNull()
        val plain = events.single { it.concept == "총콜레스테롤" }
        assertThat(plain.corrected).isFalse()
        assertThat(plain.originalValue).isEqualTo("188")
        assertThat(plain.originalObservedOn).isNull()
        assertThat(plain.correctionReason).isNull()
        assertThat(HealthEvent::class.java.declaredFields.map { it.name }).doesNotContain("referenceRangeText", "referenceRange")
    }

    @Test
    fun marksUncertainWhenTheSourcePreviewIsMissing() {
        val orphan = row("비타민 D", "42", observedOn = LocalDate.of(2026, 7, 28), documentId = docWithoutPreview)

        val event = HealthEventProjection.project(listOf(orphan), setOf(docWithPreview)).single()

        assertThat(event.verification).isEqualTo("uncertain")
        assertThat(event.source.previewAvailable).isFalse()
    }

    @Test
    fun carriesNoInterpretationFields() {
        val fields = HealthEvent::class.java.declaredFields.map { it.name }
        assertThat(fields).doesNotContain("referenceRange", "trend", "direction", "flag", "normal", "abnormal", "risk")
    }

    @Test
    fun carriesTheConceptCodeOfTheCurrentVersionAndAllowsNull() {
        val coded = row("총콜레스테롤", "188", observedOn = LocalDate.of(2026, 7, 28))
        val uncoded = row("알 수 없는 항목", "7", observedOn = LocalDate.of(2026, 7, 28), conceptCode = null)

        val events = HealthEventProjection.project(listOf(coded, uncoded), setOf(docWithPreview))

        assertThat(events.map { it.conceptCode }).containsExactly(null, "total-cholesterol")
        assertThat(events.map { it.concept }).containsExactly("알 수 없는 항목", "총콜레스테롤")
    }
}
