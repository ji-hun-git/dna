package kr.co.genomecompanion.healthrecord.api

import java.time.Instant


data class HealthRecordSummary(
    val resourceId: String,
    val resourceType: String,
    val sourceDocumentId: String,
    val recordedAt: Instant,
)


fun interface HealthRecordQuery {
    fun findBySubjectAndId(subjectId: String, resourceId: String): HealthRecordSummary?
}
