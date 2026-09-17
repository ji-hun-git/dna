package kr.co.genomecompanion.foundation

import java.time.Instant
import java.util.UUID

/** One document the server marked COMPLETED, with the instant it did so. */
data class DocumentCompletionRow(
    val documentId: UUID,
    val completedAt: Instant,
)

/** The document whose values are "this time". `observedOn` is the latest exam date among its current records. */
data class ChangeDocument(
    val documentId: UUID,
    val observedOn: String,
    val completedAt: Instant,
    val eventCount: Int,
)

/** One dated value exactly as confirmed. `eventId` is the CURRENT record version, as in HealthEvent. */
data class ChangeValue(
    val eventId: UUID,
    val value: String,
    val observedOn: String,
)

/**
 * This time's value beside the previous value of the same item. Two values and
 * nothing else: no difference, no direction, no range, no judgement.
 */
data class ChangeItem(
    val conceptCode: String?,
    val concept: String,
    val unit: String,
    val latest: ChangeValue,
    val previous: ChangeValue?,
)

data class ChangeSummary(
    val latestDocument: ChangeDocument?,
    val items: List<ChangeItem>,
    val newConcepts: List<String>,
    val unchangedCount: Int,
)

object ChangeSummaryProjection {
    val EMPTY = ChangeSummary(latestDocument = null, items = emptyList(), newConcepts = emptyList(), unchangedCount = 0)

    fun project(records: List<FoundationRecordRow>, documents: List<DocumentCompletionRow>): ChangeSummary {
        val current = records.filter { it.status == "CURRENT" }
        val documentIdsWithRecords = current.map { it.documentId }.toSet()
        val latestDocument = documents
            .filter { it.documentId in documentIdsWithRecords }
            .maxWithOrNull(compareBy<DocumentCompletionRow> { it.completedAt }.thenBy { it.documentId.toString() })
            ?: return EMPTY
        val latestRecords = current.filter { it.documentId == latestDocument.documentId }
        val otherRecords = current.filter { it.documentId != latestDocument.documentId }

        val items = latestRecords
            .sortedWith(compareBy<FoundationRecordRow> { it.label }.thenBy { it.confirmedAt })
            .map { record ->
                // The latest observation of the same concept in any other document. A different
                // unit is not converted: the item is shown alone and counted as new.
                val previous = otherRecords
                    .filter { conceptKey(it) == conceptKey(record) }
                    .maxWithOrNull(compareBy<FoundationRecordRow> { it.observedOn }.thenBy { it.confirmedAt })
                    ?.takeIf { it.unit == record.unit }
                ChangeItem(
                    conceptCode = record.conceptCode,
                    concept = record.label,
                    unit = record.unit,
                    latest = ChangeValue(record.recordVersionId, record.currentValue, record.observedOn.toString()),
                    previous = previous?.let { ChangeValue(it.recordVersionId, it.currentValue, it.observedOn.toString()) },
                )
            }
        val latestKeys = latestRecords.map(::conceptKey).toSet()
        val unchangedCount = otherRecords.map(::conceptKey).toSet().count { it !in latestKeys }

        return ChangeSummary(
            latestDocument = ChangeDocument(
                documentId = latestDocument.documentId,
                observedOn = latestRecords.maxOf { it.observedOn }.toString(),
                completedAt = latestDocument.completedAt,
                eventCount = latestRecords.size,
            ),
            items = items,
            newConcepts = items.filter { it.previous == null }.map { it.concept },
            unchangedCount = unchangedCount,
        )
    }

    /** Same concept code, or the same label when the label matched no catalogue entry. A key, not a meaning. */
    private fun conceptKey(record: FoundationRecordRow): String =
        record.conceptCode?.let { "code:$it" } ?: "label:${record.label}"
}
