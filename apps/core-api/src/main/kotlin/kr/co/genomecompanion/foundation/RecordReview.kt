package kr.co.genomecompanion.foundation

/**
 * The single rule for whether a record's review history counts as "corrected", shared by
 * `RecordReceipt.reviewDecision` and `HealthEvent.corrected` (plan decision 7). Sticky: once a
 * correction has happened — evidenced by a supersedes chain, a value that differs from the
 * original, or a corrected exam date — it stays `CORRECTED` even if a later correction happens to
 * land back on the original value.
 */
object RecordReview {
    fun isCorrected(record: FoundationRecordRow): Boolean =
        record.supersedesVersionId != null || record.currentValue != record.originalValue || record.originalObservedOn != null
}
