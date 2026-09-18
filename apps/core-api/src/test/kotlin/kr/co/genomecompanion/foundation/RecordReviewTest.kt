package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class RecordReviewTest {
    private fun row(
        currentValue: String,
        originalValue: String,
        originalObservedOn: LocalDate? = null,
        supersedesVersionId: UUID? = null,
    ) = FoundationRecordRow(
        recordId = UUID.randomUUID(),
        recordVersionId = UUID.randomUUID(),
        supersedesVersionId = supersedesVersionId,
        candidateId = UUID.randomUUID(),
        documentId = UUID.randomUUID(),
        subjectId = "synthetic-jason",
        status = "CURRENT",
        label = "총콜레스테롤",
        currentValue = currentValue,
        originalValue = originalValue,
        unit = "mg/dL",
        observedOn = LocalDate.of(2026, 7, 28),
        originalObservedOn = originalObservedOn,
        versionChangedAt = Instant.parse("2026-07-28T09:10:00Z"),
        correctionReason = null,
        evidencePage = 1,
        sourceTextSha256 = "b".repeat(64),
        documentSha256 = "a".repeat(64),
        conceptCode = "total-cholesterol",
    )

    @Test
    fun isNotCorrectedWhenNothingEverChanged() {
        val record = row(currentValue = "188", originalValue = "188")
        assertThat(RecordReview.isCorrected(record)).isFalse()
    }

    @Test
    fun isCorrectedWhenTheCurrentValueDiffersFromTheOriginal() {
        val record = row(currentValue = "190", originalValue = "188")
        assertThat(RecordReview.isCorrected(record)).isTrue()
    }

    @Test
    fun isCorrectedWhenTheExamDateWasCorrected() {
        val record = row(currentValue = "188", originalValue = "188", originalObservedOn = LocalDate.of(2026, 7, 29))
        assertThat(RecordReview.isCorrected(record)).isTrue()
    }

    @Test
    fun staysCorrectedWhenACorrectionRestoresTheOriginalValue() {
        // Two corrections that land back on the original value (e.g. 188 -> 195 -> 188) still
        // leave a supersedesVersionId trail: a correction happened, so CORRECTED must stick even
        // though currentValue == originalValue and originalObservedOn is null.
        val record = row(currentValue = "188", originalValue = "188", supersedesVersionId = UUID.randomUUID())
        assertThat(RecordReview.isCorrected(record)).isTrue()
    }
}
