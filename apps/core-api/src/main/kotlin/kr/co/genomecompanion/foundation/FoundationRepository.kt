package kr.co.genomecompanion.foundation

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID


data class FoundationSessionRow(
    val sessionId: UUID,
    val subjectId: String,
    val tokenHash: String,
    val csrfHash: String,
    val expiresAt: Instant,
)


data class FoundationConsentRow(
    val consentId: UUID,
    val status: String,
)


data class FoundationDocumentRow(
    val documentId: UUID,
    val subjectId: String,
    val consentId: UUID,
    val status: String,
    val expectedLength: Long,
    val actualLength: Long?,
    val sha256: String?,
    val objectKey: String?,
)


data class FoundationCandidateRow(
    val candidateId: UUID,
    val documentId: UUID,
    val subjectId: String,
    val status: String,
    val label: String,
    val candidateValue: String,
    val unit: String,
    val observedOn: LocalDate,
    val evidencePage: Int,
    val sourceTextSha256: String,
    val documentSha256: String,
    val createdAt: Instant,
)


data class FoundationRecordRow(
    val recordId: UUID,
    val recordVersionId: UUID,
    val supersedesVersionId: UUID?,
    val candidateId: UUID,
    val documentId: UUID,
    val subjectId: String,
    val status: String,
    val label: String,
    val currentValue: String,
    val originalValue: String,
    val unit: String,
    val observedOn: LocalDate,
    val confirmedAt: Instant,
    val correctionReason: String?,
    val evidencePage: Int,
    val sourceTextSha256: String,
    val documentSha256: String,
)


@Repository
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationRepository(
    private val jdbc: JdbcTemplate,
) {
    private val sessionMapper = RowMapper { result, _ ->
        FoundationSessionRow(
            sessionId = result.getObject("session_id", UUID::class.java),
            subjectId = result.getString("subject_id"),
            tokenHash = result.getString("token_hash"),
            csrfHash = result.getString("csrf_hash"),
            expiresAt = result.getObject("expires_at", OffsetDateTime::class.java).toInstant(),
        )
    }

    private val documentMapper = RowMapper { result, _ ->
        FoundationDocumentRow(
            documentId = result.getObject("document_id", UUID::class.java),
            subjectId = result.getString("subject_id"),
            consentId = result.getObject("consent_id", UUID::class.java),
            status = result.getString("status"),
            expectedLength = result.getLong("expected_length"),
            actualLength = result.getObject("actual_length", java.lang.Long::class.java)?.toLong(),
            sha256 = result.getString("sha256"),
            objectKey = result.getString("object_key"),
        )
    }

    private val candidateMapper = RowMapper { result, _ ->
        FoundationCandidateRow(
            candidateId = result.getObject("candidate_id", UUID::class.java),
            documentId = result.getObject("document_id", UUID::class.java),
            subjectId = result.getString("subject_id"),
            status = result.getString("status"),
            label = result.getString("label"),
            candidateValue = result.getString("candidate_value"),
            unit = result.getString("unit"),
            observedOn = result.getObject("observed_on", LocalDate::class.java),
            evidencePage = result.getInt("evidence_page"),
            sourceTextSha256 = result.getString("source_text_sha256"),
            documentSha256 = result.getString("document_sha256"),
            createdAt = result.getObject("candidate_created_at", OffsetDateTime::class.java).toInstant(),
        )
    }

    private val recordMapper = RowMapper { result, _ ->
        FoundationRecordRow(
            recordId = result.getObject("record_id", UUID::class.java),
            recordVersionId = result.getObject("record_version_id", UUID::class.java),
            supersedesVersionId = result.getObject("supersedes_version_id", UUID::class.java),
            candidateId = result.getObject("candidate_id", UUID::class.java),
            documentId = result.getObject("document_id", UUID::class.java),
            subjectId = result.getString("subject_id"),
            status = result.getString("version_status"),
            label = result.getString("label"),
            currentValue = result.getString("current_value"),
            originalValue = result.getString("original_value"),
            unit = result.getString("unit"),
            observedOn = result.getObject("observed_on", LocalDate::class.java),
            confirmedAt = result.getObject("confirmed_at", OffsetDateTime::class.java).toInstant(),
            correctionReason = result.getString("correction_reason"),
            evidencePage = result.getInt("evidence_page"),
            sourceTextSha256 = result.getString("source_text_sha256"),
            documentSha256 = result.getString("document_sha256"),
        )
    }

    private val recordProjection =
        """
        SELECT r.record_id, v.version_id AS record_version_id, v.supersedes_version_id,
               r.candidate_id, r.document_id, r.subject_id, v.status AS version_status,
               r.label, v.value AS current_value, c.candidate_value AS original_value,
               r.unit, r.observed_on, v.changed_at AS confirmed_at, v.correction_reason,
               c.evidence_page, c.source_text_sha256, d.sha256 AS document_sha256
        FROM gc_health_record r
        JOIN gc_health_record_version v ON v.record_id = r.record_id
        JOIN gc_candidate c ON c.candidate_id = r.candidate_id AND c.subject_id = r.subject_id
        JOIN gc_document d ON d.document_id = r.document_id AND d.subject_id = r.subject_id
        """.trimIndent()

    fun ensureActiveSyntheticSubject(subjectId: String, now: Instant): Boolean {
        jdbc.update(
            """
            INSERT INTO gc_subject(subject_id, created_at)
            VALUES (?, ?)
            ON CONFLICT (subject_id) DO NOTHING
            """.trimIndent(),
            subjectId,
            now.atOffset(ZoneOffset.UTC),
        )
        return jdbc.queryForObject(
            "SELECT COUNT(*) FROM gc_subject WHERE subject_id = ? AND deleted_at IS NULL",
            Long::class.java,
            subjectId,
        ) == 1L
    }

    fun createSession(
        sessionId: UUID,
        subjectId: String,
        tokenHash: String,
        csrfHash: String,
        now: Instant,
        expiresAt: Instant,
    ) {
        jdbc.update(
            """
            INSERT INTO gc_session(session_id, token_hash, csrf_hash, subject_id, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            sessionId,
            tokenHash,
            csrfHash,
            subjectId,
            now.atOffset(ZoneOffset.UTC),
            expiresAt.atOffset(ZoneOffset.UTC),
        )
    }

    fun findActiveSession(tokenHash: String, now: Instant): FoundationSessionRow? =
        jdbc.query(
            """
            SELECT session_id, subject_id, token_hash, csrf_hash, expires_at
            FROM gc_session
            WHERE token_hash = ?
              AND revoked_at IS NULL
              AND expires_at > ?
            """.trimIndent(),
            sessionMapper,
            tokenHash,
            now.atOffset(ZoneOffset.UTC),
        ).firstOrNull()

    fun grantConsent(consentId: UUID, subjectId: String, policyVersion: String, now: Instant) {
        jdbc.update(
            """
            INSERT INTO gc_consent_grant(
                consent_id, subject_id, purpose_code, status, policy_version, granted_at
            ) VALUES (?, ?, 'DOCUMENT_EXTRACTION', 'ACTIVE', ?, ?)
            """.trimIndent(),
            consentId,
            subjectId,
            policyVersion,
            now.atOffset(ZoneOffset.UTC),
        )
    }

    fun findActiveConsent(subjectId: String): UUID? =
        jdbc.query(
            """
            SELECT consent_id
            FROM gc_consent_grant
            WHERE subject_id = ?
              AND purpose_code = 'DOCUMENT_EXTRACTION'
              AND status = 'ACTIVE'
            """.trimIndent(),
            RowMapper { result, _ -> result.getObject("consent_id", UUID::class.java) },
            subjectId,
        ).firstOrNull()

    fun findLatestConsent(subjectId: String): FoundationConsentRow? =
        jdbc.query(
            """
            SELECT consent_id, status
            FROM gc_consent_grant
            WHERE subject_id = ?
              AND purpose_code = 'DOCUMENT_EXTRACTION'
            ORDER BY granted_at DESC, consent_id DESC
            LIMIT 1
            """.trimIndent(),
            RowMapper { result, _ ->
                FoundationConsentRow(
                    consentId = result.getObject("consent_id", UUID::class.java),
                    status = result.getString("status"),
                )
            },
            subjectId,
        ).firstOrNull()

    fun findConsentStatus(subjectId: String, consentId: UUID): String? =
        jdbc.query(
            """
            SELECT status
            FROM gc_consent_grant
            WHERE consent_id = ? AND subject_id = ? AND purpose_code = 'DOCUMENT_EXTRACTION'
            """.trimIndent(),
            RowMapper { result, _ -> result.getString("status") },
            consentId,
            subjectId,
        ).firstOrNull()

    fun isConsentActive(subjectId: String, consentId: UUID): Boolean =
        jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM gc_consent_grant
            WHERE consent_id = ?
              AND subject_id = ?
              AND purpose_code = 'DOCUMENT_EXTRACTION'
              AND status = 'ACTIVE'
            """.trimIndent(),
            Long::class.java,
            consentId,
            subjectId,
        ) == 1L

    fun consentBelongsToSubject(subjectId: String, consentId: UUID): Boolean =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM gc_consent_grant WHERE consent_id = ? AND subject_id = ?",
            Long::class.java,
            consentId,
            subjectId,
        ) == 1L

    fun revokeConsent(subjectId: String, consentId: UUID, now: Instant): Boolean =
        jdbc.update(
            """
            UPDATE gc_consent_grant
            SET status = 'REVOKED', revoked_at = ?
            WHERE consent_id = ? AND subject_id = ? AND status = 'ACTIVE'
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            consentId,
            subjectId,
        ) == 1

    fun insertIdempotency(
        subjectHash: String,
        operation: String,
        idempotencyKey: String,
        resourceId: UUID,
        now: Instant,
    ): Boolean =
        jdbc.update(
            """
            INSERT INTO gc_idempotency(subject_hash, operation, idempotency_key, resource_id, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (subject_hash, operation, idempotency_key) DO NOTHING
            """.trimIndent(),
            subjectHash,
            operation,
            idempotencyKey,
            resourceId,
            now.atOffset(ZoneOffset.UTC),
        ) == 1

    fun findIdempotentResource(subjectHash: String, operation: String, idempotencyKey: String): UUID? =
        jdbc.query(
            """
            SELECT resource_id
            FROM gc_idempotency
            WHERE subject_hash = ? AND operation = ? AND idempotency_key = ?
            """.trimIndent(),
            RowMapper { result, _ -> result.getObject("resource_id", UUID::class.java) },
            subjectHash,
            operation,
            idempotencyKey,
        ).firstOrNull()

    fun createDocument(
        documentId: UUID,
        subjectId: String,
        consentId: UUID,
        mediaType: String,
        expectedLength: Long,
        now: Instant,
    ) {
        jdbc.update(
            """
            INSERT INTO gc_document(
                document_id, subject_id, consent_id, status, media_type, expected_length, created_at
            ) VALUES (?, ?, ?, 'REQUESTED', ?, ?, ?)
            """.trimIndent(),
            documentId,
            subjectId,
            consentId,
            mediaType,
            expectedLength,
            now.atOffset(ZoneOffset.UTC),
        )
    }

    fun findDocument(subjectId: String, documentId: UUID): FoundationDocumentRow? =
        jdbc.query(
            """
            SELECT document_id, subject_id, consent_id, status, expected_length, actual_length, sha256, object_key
            FROM gc_document
            WHERE subject_id = ? AND document_id = ?
            """.trimIndent(),
            documentMapper,
            subjectId,
            documentId,
        ).firstOrNull()

    fun markDocumentQuarantined(
        subjectId: String,
        documentId: UUID,
        actualLength: Long,
        sha256: String,
        objectKey: String,
    ): Boolean =
        jdbc.update(
            """
            UPDATE gc_document
            SET status = 'QUARANTINED', actual_length = ?, sha256 = ?, object_key = ?
            WHERE document_id = ? AND subject_id = ? AND status = 'REQUESTED'
            """.trimIndent(),
            actualLength,
            sha256,
            objectKey,
            documentId,
            subjectId,
        ) == 1

    fun markDocumentInspected(subjectId: String, documentId: UUID, accepted: Boolean, now: Instant): Boolean =
        jdbc.update(
            """
            UPDATE gc_document
            SET status = ?, inspected_at = ?
            WHERE document_id = ? AND subject_id = ? AND status = 'QUARANTINED'
            """.trimIndent(),
            if (accepted) "INSPECTED" else "REJECTED",
            now.atOffset(ZoneOffset.UTC),
            documentId,
            subjectId,
        ) == 1

    fun createCompletedExtraction(
        jobId: UUID,
        candidateId: UUID,
        document: FoundationDocumentRow,
        now: Instant,
        sourceTextSha256: String,
    ) {
        jdbc.update(
            """
            INSERT INTO gc_extraction_job(job_id, document_id, subject_id, status, created_at, finished_at)
            VALUES (?, ?, ?, 'COMPLETED', ?, ?)
            """.trimIndent(),
            jobId,
            document.documentId,
            document.subjectId,
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
        )
        jdbc.update(
            """
            INSERT INTO gc_candidate(
                candidate_id, job_id, document_id, subject_id, status, label, candidate_value,
                unit, observed_on, evidence_page, source_text_sha256, created_at
            ) VALUES (?, ?, ?, ?, 'PENDING', '총콜레스테롤', '188', 'mg/dL', DATE '2026-07-28', 1, ?, ?)
            """.trimIndent(),
            candidateId,
            jobId,
            document.documentId,
            document.subjectId,
            sourceTextSha256,
            now.atOffset(ZoneOffset.UTC),
        )
    }

    fun findCandidateForDocument(subjectId: String, documentId: UUID): FoundationCandidateRow? =
        jdbc.query(
            """
            SELECT c.candidate_id, c.document_id, c.subject_id, c.status, c.label, c.candidate_value, c.unit,
                   c.observed_on, c.evidence_page, c.source_text_sha256,
                   d.sha256 AS document_sha256, c.created_at AS candidate_created_at
            FROM gc_candidate c
            JOIN gc_document d ON d.document_id = c.document_id AND d.subject_id = c.subject_id
            WHERE c.subject_id = ? AND c.document_id = ?
            """.trimIndent(),
            candidateMapper,
            subjectId,
            documentId,
        ).firstOrNull()

    fun findCandidate(subjectId: String, candidateId: UUID): FoundationCandidateRow? =
        jdbc.query(
            """
            SELECT c.candidate_id, c.document_id, c.subject_id, c.status, c.label, c.candidate_value, c.unit,
                   c.observed_on, c.evidence_page, c.source_text_sha256,
                   d.sha256 AS document_sha256, c.created_at AS candidate_created_at
            FROM gc_candidate c
            JOIN gc_document d ON d.document_id = c.document_id AND d.subject_id = c.subject_id
            WHERE c.subject_id = ? AND c.candidate_id = ?
            """.trimIndent(),
            candidateMapper,
            subjectId,
            candidateId,
        ).firstOrNull()

    fun excludeCandidate(subjectId: String, candidateId: UUID, now: Instant): Boolean =
        jdbc.update(
            """
            UPDATE gc_candidate
            SET status = 'EXCLUDED', excluded_at = ?
            WHERE candidate_id = ? AND subject_id = ? AND status = 'PENDING'
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            candidateId,
            subjectId,
        ) == 1

    fun createRecordFromCandidate(
        recordId: UUID,
        versionId: UUID,
        candidate: FoundationCandidateRow,
        confirmedValue: String,
        now: Instant,
    ) {
        val updated = jdbc.update(
            """
            UPDATE gc_candidate
            SET status = 'CONFIRMED', confirmed_at = ?
            WHERE candidate_id = ? AND subject_id = ? AND status = 'PENDING'
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            candidate.candidateId,
            candidate.subjectId,
        )
        check(updated == 1) { "candidate state changed during confirmation" }
        jdbc.update(
            """
            INSERT INTO gc_health_record(
                record_id, candidate_id, document_id, subject_id, label, confirmed_value,
                unit, observed_on, confirmed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            recordId,
            candidate.candidateId,
            candidate.documentId,
            candidate.subjectId,
            candidate.label,
            confirmedValue,
            candidate.unit,
            candidate.observedOn,
            now.atOffset(ZoneOffset.UTC),
        )
        jdbc.update(
            """
            INSERT INTO gc_health_record_version(
                version_id, record_id, subject_id, status, value,
                supersedes_version_id, correction_reason, changed_at
            ) VALUES (?, ?, ?, 'CURRENT', ?, NULL, NULL, ?)
            """.trimIndent(),
            versionId,
            recordId,
            candidate.subjectId,
            confirmedValue,
            now.atOffset(ZoneOffset.UTC),
        )
    }

    fun findRecordForCandidate(subjectId: String, candidateId: UUID): FoundationRecordRow? =
        jdbc.query(
            "$recordProjection WHERE r.subject_id = ? AND r.candidate_id = ? AND v.status = 'CURRENT'",
            recordMapper,
            subjectId,
            candidateId,
        ).firstOrNull()

    fun findRecord(subjectId: String, recordId: UUID): FoundationRecordRow? =
        jdbc.query(
            "$recordProjection WHERE r.subject_id = ? AND r.record_id = ? AND v.status = 'CURRENT'",
            recordMapper,
            subjectId,
            recordId,
        ).firstOrNull()

    fun findRecordVersion(subjectId: String, versionId: UUID): FoundationRecordRow? =
        jdbc.query(
            "$recordProjection WHERE r.subject_id = ? AND v.version_id = ?",
            recordMapper,
            subjectId,
            versionId,
        ).firstOrNull()

    fun listRecords(subjectId: String): List<FoundationRecordRow> =
        jdbc.query(
            "$recordProjection WHERE r.subject_id = ? AND v.status = 'CURRENT' ORDER BY v.changed_at, r.record_id",
            recordMapper,
            subjectId,
        )

    fun correctRecord(
        subjectId: String,
        recordId: UUID,
        previousVersionId: UUID,
        newVersionId: UUID,
        value: String,
        reason: String,
        now: Instant,
    ): Boolean {
        val superseded = jdbc.update(
            """
            UPDATE gc_health_record_version
            SET status = 'SUPERSEDED'
            WHERE version_id = ? AND record_id = ? AND subject_id = ? AND status = 'CURRENT'
            """.trimIndent(),
            previousVersionId,
            recordId,
            subjectId,
        )
        if (superseded != 1) return false
        jdbc.update(
            """
            INSERT INTO gc_health_record_version(
                version_id, record_id, subject_id, status, value,
                supersedes_version_id, correction_reason, changed_at
            ) VALUES (?, ?, ?, 'CURRENT', ?, ?, ?, ?)
            """.trimIndent(),
            newVersionId,
            recordId,
            subjectId,
            value,
            previousVersionId,
            reason,
            now.atOffset(ZoneOffset.UTC),
        )
        return true
    }

    fun listObjectKeys(subjectId: String): List<String> =
        jdbc.query(
            "SELECT object_key FROM gc_document WHERE subject_id = ? AND object_key IS NOT NULL",
            RowMapper { result, _ -> result.getString("object_key") },
            subjectId,
        )

    fun completeDeletion(subjectId: String, subjectHash: String, deletionId: UUID, now: Instant): UUID {
        jdbc.update(
            """
            INSERT INTO gc_deletion_request(deletion_id, subject_hash, status, requested_at, completed_at)
            VALUES (?, ?, 'COMPLETED', ?, ?)
            ON CONFLICT (subject_hash) DO NOTHING
            """.trimIndent(),
            deletionId,
            subjectHash,
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
        )
        val durableId = jdbc.query(
            "SELECT deletion_id FROM gc_deletion_request WHERE subject_hash = ?",
            RowMapper { result, _ -> result.getObject("deletion_id", UUID::class.java) },
            subjectHash,
        ).single()
        jdbc.update("DELETE FROM gc_document WHERE subject_id = ?", subjectId)
        jdbc.update("DELETE FROM gc_consent_grant WHERE subject_id = ?", subjectId)
        jdbc.update("DELETE FROM gc_session WHERE subject_id = ?", subjectId)
        jdbc.update("UPDATE gc_subject SET deleted_at = ? WHERE subject_id = ?", now.atOffset(ZoneOffset.UTC), subjectId)
        return durableId
    }

    fun insertAudit(
        subjectHash: String,
        actorSessionHash: String?,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
        now: Instant,
    ) {
        doInsertAudit(subjectHash, actorSessionHash, eventType, resourceType, resourceId, outcome, now)
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun insertDeniedAudit(
        subjectHash: String,
        actorSessionHash: String?,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        now: Instant,
    ) {
        doInsertAudit(subjectHash, actorSessionHash, eventType, resourceType, resourceId, "DENIED", now)
    }

    private fun doInsertAudit(
        subjectHash: String,
        actorSessionHash: String?,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
        now: Instant,
    ) {
        jdbc.update(
            """
            INSERT INTO gc_audit_event(
                event_id, subject_hash, actor_session_hash, event_type, resource_type,
                resource_id, outcome, occurred_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            UUID.randomUUID(),
            subjectHash,
            actorSessionHash,
            eventType,
            resourceType,
            resourceId,
            outcome,
            now.atOffset(ZoneOffset.UTC),
        )
    }

    fun listAuditEventTypes(subjectHash: String): List<String> =
        jdbc.query(
            """
            SELECT event_type
            FROM gc_audit_event
            WHERE subject_hash = ?
            ORDER BY audit_sequence
            """.trimIndent(),
            RowMapper { result, _ -> result.getString("event_type") },
            subjectHash,
        )

    fun countRawHealthValuesInAudit(): Long =
        jdbc.queryForObject(
            """
            SELECT COUNT(*)
            FROM gc_audit_event
            WHERE event_type LIKE '%188%'
               OR event_type LIKE '%190%'
               OR resource_type LIKE '%mg/dL%'
            """.trimIndent(),
            Long::class.java,
        ) ?: 0L
}
