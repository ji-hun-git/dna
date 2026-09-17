package kr.co.genomecompanion.foundation

import java.text.Normalizer
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
 * This time's value beside the previous value of the same item, plus — when both parse as numbers —
 * their arithmetic difference. No direction, no range, no judgement.
 */
data class ChangeItem(
    val conceptCode: String?,
    val concept: String,
    val unit: String,
    val latest: ChangeValue,
    val previous: ChangeValue?,
    /** Null when there is no previous value in the same unit or a value is not numeric. */
    val delta: ChangeDelta? = null,
)

data class ChangeSummary(
    val latestDocument: ChangeDocument?,
    /** Ordered by label using plain String (UTF-16) comparison via `compareBy { it.concept }` — not a Korean-locale `Collator`. */
    val items: List<ChangeItem>,
    val newConcepts: List<String>,
    val unchangedCount: Int,
)

object ChangeSummaryProjection {
    /** The result when no completed document still has current records. Same shape as any real summary: an absent latest document, no items, nothing new, nothing unchanged. */
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

        // Sorted by label using plain String ordering (Kotlin's natural/UTF-16 comparison via
        // compareBy), not a Korean-locale Collator. Two labels that a Collator would treat as
        // equivalent (e.g. differing only in trailing whitespace before trimming elsewhere) may
        // therefore sort differently than a human reader expects.
        val items = latestRecords
            .sortedWith(compareBy<FoundationRecordRow> { it.label }.thenBy { it.confirmedAt }.thenBy { it.recordId.toString() })
            .map { record ->
                // The latest observation of the same concept in any other document. A different
                // unit is not converted: the item is shown alone and counted as new. Ties on
                // observedOn and confirmedAt are broken by documentId text, then recordId text,
                // so the choice never depends on input order.
                val previous = otherRecords
                    .filter { conceptsMatch(it, record) }
                    .maxWithOrNull(
                        compareBy<FoundationRecordRow> { it.observedOn }
                            .thenBy { it.confirmedAt }
                            .thenBy { it.documentId.toString() }
                            .thenBy { it.recordId.toString() },
                    )
                    ?.takeIf { it.unit == record.unit }
                ChangeItem(
                    conceptCode = record.conceptCode,
                    concept = record.label,
                    unit = record.unit,
                    latest = ChangeValue(record.recordVersionId, record.currentValue, record.observedOn.toString()),
                    previous = previous?.let { ChangeValue(it.recordVersionId, it.currentValue, it.observedOn.toString()) },
                    // Only when the previous value is not later in time than the latest one: a
                    // signed difference computed against an out-of-order previous document would
                    // run against chronology. Both values and dates stay listed either way.
                    delta = previous
                        ?.takeIf { it.observedOn <= record.observedOn }
                        ?.let { ChangeDeltaCalculator.compute(record.currentValue, it.currentValue) }
                        ?.let { delta -> if (record.unit.trim() == "%") delta.copy(percent = null) else delta },
                )
            }
        // conceptsMatch is not transitive (a record can gain/lose its code between documents),
        // so "unchanged" concepts among otherRecords are computed as connected components under
        // conceptsMatch, not as a first-representative-wins grouping. Canonicalizing the input
        // order before grouping, and using components instead of first-match, makes the result a
        // pure function of the input set rather than of otherRecords' input order.
        val canonicalOtherRecords = otherRecords.sortedWith(
            compareBy<FoundationRecordRow> { it.documentId.toString() }.thenBy { it.recordId.toString() },
        )
        val componentOf = IntArray(canonicalOtherRecords.size) { it }
        fun find(index: Int): Int {
            var root = index
            while (componentOf[root] != root) root = componentOf[root]
            var current = index
            while (componentOf[current] != root) {
                val next = componentOf[current]
                componentOf[current] = root
                current = next
            }
            return root
        }
        fun union(a: Int, b: Int) {
            val rootA = find(a)
            val rootB = find(b)
            if (rootA != rootB) componentOf[rootA] = rootB
        }
        for (i in canonicalOtherRecords.indices) {
            for (j in i + 1 until canonicalOtherRecords.size) {
                if (conceptsMatch(canonicalOtherRecords[i], canonicalOtherRecords[j])) {
                    union(i, j)
                }
            }
        }
        val components = canonicalOtherRecords.indices.groupBy { find(it) }
        val unchangedCount = components.values.count { memberIndices ->
            memberIndices.none { index -> latestRecords.any { conceptsMatch(it, canonicalOtherRecords[index]) } }
        }

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

    /**
     * Two records are the same concept when both carry a concept code and the codes are equal,
     * or when at least one lacks a code and their labels are equal once trimmed and Unicode
     * NFC-normalized. A record that gained or lost its concept code between documents still
     * matches its earlier/later self by label, instead of silently becoming "new".
     */
    internal fun conceptsMatch(a: FoundationRecordRow, b: FoundationRecordRow): Boolean {
        val codeA = a.conceptCode
        val codeB = b.conceptCode
        return if (codeA != null && codeB != null) {
            codeA == codeB
        } else {
            normalizeLabel(a.label) == normalizeLabel(b.label)
        }
    }

    private fun normalizeLabel(label: String): String = Normalizer.normalize(label.trim(), Normalizer.Form.NFC)
}
