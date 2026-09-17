package kr.co.genomecompanion.foundation

import java.time.Instant
import java.util.UUID

/** Where one event came from. A digest and a page, never the document bytes. */
data class HealthEventSource(
    val documentId: UUID,
    val page: Int,
    val documentSha256: String,
    val sourceTextSha256: String,
    val previewAvailable: Boolean,
)

/**
 * One confirmed value as one event. This is a read-model over CURRENT record
 * versions: no new storage, no reference range, no direction, no judgement.
 */
data class HealthEvent(
    val eventId: UUID,
    val recordId: UUID,
    val domain: String,
    val concept: String,
    val value: String,
    val unit: String,
    val observedOn: String,
    val verification: String,
    val corrected: Boolean,
    val confirmedAt: Instant,
    val source: HealthEventSource,
)

object HealthEventProjection {
    const val DOMAIN_LAB = "lab"
    const val VERIFIED = "verified"
    const val UNCERTAIN = "uncertain"

    fun project(records: List<FoundationRecordRow>, previewDocumentIds: Set<UUID>): List<HealthEvent> =
        records
            .filter { it.status == "CURRENT" }
            .map { record ->
                val previewAvailable = record.documentId in previewDocumentIds
                HealthEvent(
                    eventId = record.recordVersionId,
                    recordId = record.recordId,
                    domain = DOMAIN_LAB,
                    concept = record.label,
                    value = record.currentValue,
                    unit = record.unit,
                    observedOn = record.observedOn.toString(),
                    verification = if (previewAvailable) VERIFIED else UNCERTAIN,
                    corrected = record.currentValue != record.originalValue,
                    confirmedAt = record.confirmedAt,
                    source = HealthEventSource(
                        documentId = record.documentId,
                        page = record.evidencePage,
                        documentSha256 = record.documentSha256,
                        sourceTextSha256 = record.sourceTextSha256,
                        previewAvailable = previewAvailable,
                    ),
                )
            }
            .sortedWith(compareBy<HealthEvent> { it.observedOn }.thenBy { it.concept }.thenBy { it.confirmedAt })
}
