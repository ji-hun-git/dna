package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.documentboundary.InspectionDecision
import kr.co.genomecompanion.documentboundary.InspectionReport
import kr.co.genomecompanion.documentboundary.StorageTrustZone
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
    val expectedSha256: String?,
    val actualLength: Long?,
    val sha256: String?,
    val objectKey: String?,
    val approvedObjectKey: String?,
    val previewObjectKey: String?,
    val stateVersion: Long,
    val failureCode: String?,
)


data class UploadCapabilityRow(
    val capabilityId: UUID,
    val documentId: UUID,
    val expectedLength: Long,
    val expectedSha256: String,
    val expiresAt: Instant,
)


data class DocumentJobRow(
    val jobId: UUID,
    val documentId: UUID,
    val subjectId: String,
    val jobType: String,
    val attempt: Int,
    val maxAttempts: Int,
    val leaseTokenHash: String,
    val leaseExpiresAt: Instant,
    val sourceObjectKey: String,
    val sourceSha256: String,
    val sourceLength: Long,
    val documentStateVersion: Long,
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


data class PreviewArtifactRow(
    val objectKey: String,
    val sourceSha256: String,
    val previewSha256: String,
    val generatorVersion: String,
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
            expectedSha256 = result.getString("expected_sha256"),
            actualLength = result.getObject("actual_length", java.lang.Long::class.java)?.toLong(),
            sha256 = result.getString("sha256"),
            objectKey = result.getString("object_key"),
            approvedObjectKey = result.getString("approved_object_key"),
            previewObjectKey = result.getString("preview_object_key"),
            stateVersion = result.getLong("state_version"),
            failureCode = result.getString("failure_code"),
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

    fun terminateDocumentJobsForRevokedConsent(subjectId: String, consentId: UUID, now: Instant) {
        jdbc.update(
            """
            UPDATE gc_document_job j
            SET status = 'DEAD_LETTER', failure_code = 'consent_revoked',
                lease_token_hash = NULL, lease_expires_at = NULL, worker_id_hash = NULL, updated_at = ?
            FROM gc_document d
            WHERE d.document_id = j.document_id AND d.subject_id = ? AND d.consent_id = ?
              AND j.status IN ('QUEUED', 'LEASED', 'FAILED_RETRYABLE')
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            subjectId,
            consentId,
        )
        jdbc.update(
            """
            UPDATE gc_document
            SET status = 'FAILED_TERMINAL', failure_code = 'consent_revoked',
                state_version = state_version + 1, updated_at = ?
            WHERE subject_id = ? AND consent_id = ? AND status IN (
                'UPLOAD_PENDING', 'UNTRUSTED_OBJECT', 'SECURITY_INSPECTION', 'SECURITY_APPROVED',
                'EXTRACTION_QUEUED', 'EXTRACTION_RUNNING', 'FAILED_RETRYABLE'
            )
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            subjectId,
            consentId,
        )
        jdbc.update(
            """
            UPDATE gc_upload_capability c SET revoked_at = COALESCE(c.revoked_at, ?)
            FROM gc_document d
            WHERE d.document_id = c.document_id AND d.subject_id = ? AND d.consent_id = ?
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            subjectId,
            consentId,
        )
    }

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
        expectedSha256: String,
        now: Instant,
    ) {
        jdbc.update(
            """
            INSERT INTO gc_document(
                document_id, subject_id, consent_id, status, media_type, expected_length,
                expected_sha256, created_at, updated_at
            ) VALUES (?, ?, ?, 'UPLOAD_PENDING', ?, ?, ?, ?, ?)
            """.trimIndent(),
            documentId,
            subjectId,
            consentId,
            mediaType,
            expectedLength,
            expectedSha256,
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
        )
    }

    fun findDocument(subjectId: String, documentId: UUID): FoundationDocumentRow? =
        jdbc.query(
            """
            SELECT document_id, subject_id, consent_id, status, expected_length, expected_sha256,
                   actual_length, sha256, object_key, approved_object_key, preview_object_key,
                   state_version, failure_code
            FROM gc_document
            WHERE subject_id = ? AND document_id = ?
            """.trimIndent(),
            documentMapper,
            subjectId,
            documentId,
        ).firstOrNull()

    fun findLatestActiveDocument(subjectId: String): FoundationDocumentRow? =
        jdbc.query(
            """
            SELECT document_id, subject_id, consent_id, status, expected_length, expected_sha256,
                   actual_length, sha256, object_key, approved_object_key, preview_object_key,
                   state_version, failure_code
            FROM gc_document
            WHERE subject_id = ? AND status NOT IN (
                'COMPLETED', 'SECURITY_REJECTED', 'FAILED_TERMINAL', 'DELETED'
            )
            ORDER BY created_at DESC
            LIMIT 1
            """.trimIndent(),
            documentMapper,
            subjectId,
        ).firstOrNull()

    fun rotateUploadCapability(
        capabilityId: UUID,
        documentId: UUID,
        tokenHash: String,
        expectedLength: Long,
        expectedSha256: String,
        issuedAt: Instant,
        expiresAt: Instant,
    ) {
        jdbc.update(
            "UPDATE gc_upload_capability SET revoked_at = ? WHERE document_id = ? AND revoked_at IS NULL",
            issuedAt.atOffset(ZoneOffset.UTC),
            documentId,
        )
        jdbc.update(
            """
            INSERT INTO gc_upload_capability(
                capability_id, document_id, token_hash, expected_length, expected_sha256,
                issued_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            capabilityId,
            documentId,
            tokenHash,
            expectedLength,
            expectedSha256,
            issuedAt.atOffset(ZoneOffset.UTC),
            expiresAt.atOffset(ZoneOffset.UTC),
        )
    }

    fun findActiveUploadCapability(
        capabilityId: UUID,
        documentId: UUID,
        tokenHash: String,
        now: Instant,
    ): UploadCapabilityRow? =
        jdbc.query(
            """
            SELECT capability_id, document_id, expected_length, expected_sha256, expires_at
            FROM gc_upload_capability
            WHERE capability_id = ? AND document_id = ? AND token_hash = ?
              AND revoked_at IS NULL AND expires_at > ?
            """.trimIndent(),
            RowMapper { result, _ ->
                UploadCapabilityRow(
                    capabilityId = result.getObject("capability_id", UUID::class.java),
                    documentId = result.getObject("document_id", UUID::class.java),
                    expectedLength = result.getLong("expected_length"),
                    expectedSha256 = result.getString("expected_sha256"),
                    expiresAt = result.getObject("expires_at", OffsetDateTime::class.java).toInstant(),
                )
            },
            capabilityId,
            documentId,
            tokenHash,
            now.atOffset(ZoneOffset.UTC),
        ).firstOrNull()

    fun markDocumentUploaded(
        subjectId: String,
        documentId: UUID,
        actualLength: Long,
        sha256: String,
        objectKey: String,
    ): Boolean =
        jdbc.update(
            """
            UPDATE gc_document
            SET actual_length = ?, sha256 = ?, object_key = ?, state_version = state_version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE document_id = ? AND subject_id = ? AND status = 'UPLOAD_PENDING'
              AND (sha256 IS NULL OR sha256 = ?)
            """.trimIndent(),
            actualLength,
            sha256,
            objectKey,
            documentId,
            subjectId,
            sha256,
        ) == 1

    fun finalizeDocumentAndQueueInspection(
        subjectId: String,
        documentId: UUID,
        jobId: UUID,
        now: Instant,
    ): Boolean {
        val updated = jdbc.update(
            """
            UPDATE gc_document
            SET status = 'UNTRUSTED_OBJECT', finalized_at = ?, updated_at = ?,
                state_version = state_version + 1
            WHERE document_id = ? AND subject_id = ? AND status = 'UPLOAD_PENDING'
              AND actual_length = expected_length
              AND sha256 = expected_sha256
              AND object_key IS NOT NULL
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
            documentId,
            subjectId,
        )
        if (updated != 1) return false
        jdbc.update(
            """
            INSERT INTO gc_document_job(
                job_id, document_id, job_type, status, attempt, max_attempts,
                available_at, created_at, updated_at
            ) VALUES (?, ?, 'SECURITY_INSPECTION', 'QUEUED', 0, 3, ?, ?, ?)
            """.trimIndent(),
            jobId,
            documentId,
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
        )
        jdbc.update(
            "UPDATE gc_upload_capability SET revoked_at = ? WHERE document_id = ? AND revoked_at IS NULL",
            now.atOffset(ZoneOffset.UTC),
            documentId,
        )
        return true
    }

    @Transactional
    fun leaseNextDocumentJob(
        workerIdHash: String,
        leaseTokenHash: String,
        now: Instant,
        leaseExpiresAt: Instant,
    ): DocumentJobRow? {
        jdbc.update(
            """
            UPDATE gc_document d
            SET status = 'FAILED_TERMINAL', failure_code = 'worker_lease_expired',
                state_version = state_version + 1, updated_at = ?
            WHERE EXISTS (
                SELECT 1 FROM gc_document_job j
                WHERE j.document_id = d.document_id AND j.status = 'LEASED'
                  AND j.lease_expires_at <= ? AND j.attempt >= j.max_attempts
            )
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
        )
        jdbc.update(
            """
            UPDATE gc_document_job
            SET status = 'DEAD_LETTER', failure_code = 'worker_lease_expired',
                lease_token_hash = NULL, lease_expires_at = NULL, worker_id_hash = NULL,
                updated_at = ?
            WHERE status = 'LEASED' AND lease_expires_at <= ? AND attempt >= max_attempts
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
        )
        val jobId = jdbc.query(
            """
            SELECT j.job_id
            FROM gc_document_job j
            JOIN gc_document d ON d.document_id = j.document_id
            JOIN gc_consent_grant c ON c.consent_id = d.consent_id AND c.status = 'ACTIVE'
            WHERE j.attempt < j.max_attempts
              AND (
                (j.status IN ('QUEUED', 'FAILED_RETRYABLE') AND j.available_at <= ?)
                OR (j.status = 'LEASED' AND j.lease_expires_at <= ?)
              )
              AND (
                (j.job_type = 'SECURITY_INSPECTION' AND d.status IN (
                    'UNTRUSTED_OBJECT', 'SECURITY_INSPECTION', 'FAILED_RETRYABLE'
                ))
                OR
                (j.job_type = 'SYNTHETIC_EXTRACTION' AND d.status IN (
                    'EXTRACTION_QUEUED', 'EXTRACTION_RUNNING', 'FAILED_RETRYABLE'
                ))
              )
            ORDER BY j.available_at, j.created_at
            FOR UPDATE OF j SKIP LOCKED
            LIMIT 1
            """.trimIndent(),
            RowMapper { result, _ -> result.getObject("job_id", UUID::class.java) },
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
        ).firstOrNull() ?: return null
        val updated = jdbc.update(
            """
            UPDATE gc_document_job
            SET status = 'LEASED', attempt = attempt + 1, lease_token_hash = ?,
                lease_expires_at = ?, worker_id_hash = ?, failure_code = NULL, updated_at = ?
            WHERE job_id = ?
            """.trimIndent(),
            leaseTokenHash,
            leaseExpiresAt.atOffset(ZoneOffset.UTC),
            workerIdHash,
            now.atOffset(ZoneOffset.UTC),
            jobId,
        )
        check(updated == 1) { "leased document job disappeared" }
        jdbc.update(
            """
            UPDATE gc_document d
            SET status = CASE j.job_type
                    WHEN 'SECURITY_INSPECTION' THEN 'SECURITY_INSPECTION'
                    ELSE 'EXTRACTION_RUNNING'
                END,
                failure_code = NULL, state_version = state_version + 1, updated_at = ?
            FROM gc_document_job j
            WHERE j.job_id = ? AND d.document_id = j.document_id
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            jobId,
        )
        return queryLeasedJob(jobId, leaseTokenHash, now, lock = false)
    }

    fun lockLeasedJob(jobId: UUID, leaseTokenHash: String, now: Instant): DocumentJobRow? =
        queryLeasedJob(jobId, leaseTokenHash, now, lock = true)

    fun findLeasedJob(jobId: UUID, leaseTokenHash: String, now: Instant): DocumentJobRow? =
        queryLeasedJob(jobId, leaseTokenHash, now, lock = false)

    fun markInspectionCompleted(
        job: DocumentJobRow,
        report: InspectionReport,
        inspectionId: UUID,
        promotionId: UUID?,
        approvedObjectKey: String?,
        extractionJobId: UUID?,
        now: Instant,
    ) {
        jdbc.update(
            """
            INSERT INTO gc_document_inspection(
                inspection_id, job_id, document_id, source_sha256, source_length,
                decision, reason, identified_media_type, page_count, indirect_object_count,
                total_image_pixels, encrypted, active_content, embedded_files,
                policy_version, scanner_name, scanner_version, signature_version, inspected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            inspectionId,
            job.jobId,
            job.documentId,
            report.sourceSha256,
            job.sourceLength,
            report.decision.name,
            report.reason.name,
            report.identifiedMediaType,
            report.pageCount,
            report.indirectObjectCount,
            report.totalImagePixels,
            report.encrypted,
            report.activeContent,
            report.embeddedFiles,
            report.policyVersion,
            report.scannerName,
            report.scannerVersion,
            report.signatureVersion,
            now.atOffset(ZoneOffset.UTC),
        )
        if (report.decision == InspectionDecision.APPROVED) {
            require(promotionId != null && approvedObjectKey != null && extractionJobId != null)
            jdbc.update(
                """
                INSERT INTO gc_source_promotion(
                    promotion_id, document_id, inspection_id, source_sha256,
                    untrusted_object_key, approved_object_key, promoted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """.trimIndent(),
                promotionId,
                job.documentId,
                inspectionId,
                report.sourceSha256,
                job.sourceObjectKey,
                approvedObjectKey,
                now.atOffset(ZoneOffset.UTC),
            )
            jdbc.update(
                """
                UPDATE gc_document
                SET status = 'EXTRACTION_QUEUED', approved_object_key = ?, approved_at = ?,
                    failure_code = NULL, state_version = state_version + 1, updated_at = ?
                WHERE document_id = ? AND status = 'SECURITY_INSPECTION' AND sha256 = ?
                """.trimIndent(),
                approvedObjectKey,
                now.atOffset(ZoneOffset.UTC),
                now.atOffset(ZoneOffset.UTC),
                job.documentId,
                report.sourceSha256,
            ).also { check(it == 1) { "document inspection state changed" } }
            jdbc.update(
                """
                INSERT INTO gc_document_job(
                    job_id, document_id, job_type, status, attempt, max_attempts,
                    available_at, created_at, updated_at
                ) VALUES (?, ?, 'SYNTHETIC_EXTRACTION', 'QUEUED', 0, 3, ?, ?, ?)
                """.trimIndent(),
                extractionJobId,
                job.documentId,
                now.atOffset(ZoneOffset.UTC),
                now.atOffset(ZoneOffset.UTC),
                now.atOffset(ZoneOffset.UTC),
            )
        } else {
            jdbc.update(
                """
                UPDATE gc_document
                SET status = 'SECURITY_REJECTED', failure_code = ?, inspected_at = ?,
                    state_version = state_version + 1, updated_at = ?
                WHERE document_id = ? AND status = 'SECURITY_INSPECTION'
                """.trimIndent(),
                report.reason.name.lowercase(),
                now.atOffset(ZoneOffset.UTC),
                now.atOffset(ZoneOffset.UTC),
                job.documentId,
            ).also { check(it == 1) { "document inspection state changed" } }
        }
        completeJob(job.jobId, now)
    }

    fun markJobFailed(job: DocumentJobRow, failureCode: String, retryable: Boolean, now: Instant) {
        val retry = retryable && job.attempt < job.maxAttempts
        val jobStatus = if (retry) "FAILED_RETRYABLE" else "DEAD_LETTER"
        val documentStatus = if (retry) "FAILED_RETRYABLE" else "FAILED_TERMINAL"
        val delaySeconds = minOf(60L, 1L shl minOf(job.attempt, 6))
        jdbc.update(
            """
            UPDATE gc_document_job
            SET status = ?, failure_code = ?, available_at = ?, lease_token_hash = NULL,
                lease_expires_at = NULL, worker_id_hash = NULL, updated_at = ?
            WHERE job_id = ? AND status = 'LEASED'
            """.trimIndent(),
            jobStatus,
            failureCode,
            now.plusSeconds(delaySeconds).atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
            job.jobId,
        ).also { check(it == 1) { "document job lease changed" } }
        jdbc.update(
            """
            UPDATE gc_document
            SET status = ?, failure_code = ?, state_version = state_version + 1, updated_at = ?
            WHERE document_id = ?
            """.trimIndent(),
            documentStatus,
            failureCode,
            now.atOffset(ZoneOffset.UTC),
            job.documentId,
        )
    }

    fun markExtractionCompleted(
        workerJob: DocumentJobRow,
        extractionJobId: UUID,
        candidateId: UUID,
        previewId: UUID,
        previewObjectKey: String,
        previewSha256: String,
        workerImageDigest: String,
        generatorVersion: String,
        now: Instant,
        sourceTextSha256: String,
    ) {
        jdbc.update(
            """
            INSERT INTO gc_extraction_job(
                job_id, document_id, subject_id, status, created_at, finished_at,
                worker_job_id, source_sha256, worker_image_digest, generator_version, attempt
            ) VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            extractionJobId,
            workerJob.documentId,
            workerJob.subjectId,
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
            workerJob.jobId,
            workerJob.sourceSha256,
            workerImageDigest,
            generatorVersion,
            workerJob.attempt,
        )
        jdbc.update(
            """
            INSERT INTO gc_candidate(
                candidate_id, job_id, document_id, subject_id, status, label, candidate_value,
                unit, observed_on, evidence_page, source_text_sha256, created_at
            ) VALUES (?, ?, ?, ?, 'PENDING', '총콜레스테롤', '188', 'mg/dL', DATE '2026-07-28', 1, ?, ?)
            """.trimIndent(),
            candidateId,
            extractionJobId,
            workerJob.documentId,
            workerJob.subjectId,
            sourceTextSha256,
            now.atOffset(ZoneOffset.UTC),
        )
        jdbc.update(
            """
            INSERT INTO gc_preview_artifact(
                preview_id, document_id, source_sha256, preview_sha256,
                object_key, media_type, generator_version, generated_at
            ) VALUES (?, ?, ?, ?, ?, 'image/png', ?, ?)
            """.trimIndent(),
            previewId,
            workerJob.documentId,
            workerJob.sourceSha256,
            previewSha256,
            previewObjectKey,
            generatorVersion,
            now.atOffset(ZoneOffset.UTC),
        )
        jdbc.update(
            """
            UPDATE gc_document
            SET status = 'REVIEW_REQUIRED', preview_object_key = ?, failure_code = NULL,
                state_version = state_version + 1, updated_at = ?
            WHERE document_id = ? AND status = 'EXTRACTION_RUNNING' AND sha256 = ?
            """.trimIndent(),
            previewObjectKey,
            now.atOffset(ZoneOffset.UTC),
            workerJob.documentId,
            workerJob.sourceSha256,
        ).also { check(it == 1) { "document extraction state changed" } }
        completeJob(workerJob.jobId, now)
    }

    private fun completeJob(jobId: UUID, now: Instant) {
        jdbc.update(
            """
            UPDATE gc_document_job
            SET status = 'COMPLETED', completed_at = ?, lease_token_hash = NULL,
                lease_expires_at = NULL, worker_id_hash = NULL, failure_code = NULL, updated_at = ?
            WHERE job_id = ? AND status = 'LEASED'
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
            jobId,
        ).also { check(it == 1) { "document job lease changed" } }
    }

    private fun queryLeasedJob(
        jobId: UUID,
        leaseTokenHash: String,
        now: Instant,
        lock: Boolean,
    ): DocumentJobRow? {
        val lockClause = if (lock) "FOR UPDATE OF j" else ""
        return jdbc.query(
            """
            SELECT j.job_id, j.document_id, d.subject_id, j.job_type, j.attempt, j.max_attempts,
                   j.lease_token_hash, j.lease_expires_at,
                   CASE WHEN j.job_type = 'SECURITY_INSPECTION'
                        THEN d.object_key ELSE d.approved_object_key END AS source_object_key,
                   d.sha256 AS source_sha256, d.actual_length AS source_length,
                   d.state_version AS document_state_version
            FROM gc_document_job j
            JOIN gc_document d ON d.document_id = j.document_id
            JOIN gc_consent_grant c ON c.consent_id = d.consent_id AND c.status = 'ACTIVE'
            WHERE j.job_id = ? AND j.status = 'LEASED' AND j.lease_token_hash = ?
              AND j.lease_expires_at > ?
            $lockClause
            """.trimIndent(),
            RowMapper { result, _ ->
                DocumentJobRow(
                    jobId = result.getObject("job_id", UUID::class.java),
                    documentId = result.getObject("document_id", UUID::class.java),
                    subjectId = result.getString("subject_id"),
                    jobType = result.getString("job_type"),
                    attempt = result.getInt("attempt"),
                    maxAttempts = result.getInt("max_attempts"),
                    leaseTokenHash = result.getString("lease_token_hash"),
                    leaseExpiresAt = result.getObject("lease_expires_at", OffsetDateTime::class.java).toInstant(),
                    sourceObjectKey = result.getString("source_object_key"),
                    sourceSha256 = result.getString("source_sha256"),
                    sourceLength = result.getLong("source_length"),
                    documentStateVersion = result.getLong("document_state_version"),
                )
            },
            jobId,
            leaseTokenHash,
            now.atOffset(ZoneOffset.UTC),
        ).firstOrNull()
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

    fun findPreviewArtifact(subjectId: String, documentId: UUID): PreviewArtifactRow? =
        jdbc.query(
            """
            SELECT p.object_key, p.source_sha256, p.preview_sha256, p.generator_version
            FROM gc_preview_artifact p
            JOIN gc_document d ON d.document_id = p.document_id
            WHERE d.subject_id = ? AND d.document_id = ?
              AND d.status IN ('REVIEW_REQUIRED', 'COMPLETED')
              AND d.preview_object_key = p.object_key AND d.sha256 = p.source_sha256
            """.trimIndent(),
            RowMapper { result, _ ->
                PreviewArtifactRow(
                    objectKey = result.getString("object_key"),
                    sourceSha256 = result.getString("source_sha256"),
                    previewSha256 = result.getString("preview_sha256"),
                    generatorVersion = result.getString("generator_version"),
                )
            },
            subjectId,
            documentId,
        ).firstOrNull()

    fun excludeCandidate(subjectId: String, candidateId: UUID, now: Instant): Boolean {
        val updated = jdbc.update(
            """
            UPDATE gc_candidate
            SET status = 'EXCLUDED', excluded_at = ?
            WHERE candidate_id = ? AND subject_id = ? AND status = 'PENDING'
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            candidateId,
            subjectId,
        )
        if (updated == 1) {
            jdbc.update(
                """
                UPDATE gc_document d SET status = 'COMPLETED', completed_at = ?,
                    state_version = state_version + 1, updated_at = ?
                FROM gc_candidate c
                WHERE c.candidate_id = ? AND c.document_id = d.document_id
                  AND d.subject_id = ? AND d.status = 'REVIEW_REQUIRED'
                """.trimIndent(),
                now.atOffset(ZoneOffset.UTC),
                now.atOffset(ZoneOffset.UTC),
                candidateId,
                subjectId,
            )
        }
        return updated == 1
    }

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
        jdbc.update(
            """
            UPDATE gc_document
            SET status = 'COMPLETED', completed_at = ?, state_version = state_version + 1, updated_at = ?
            WHERE document_id = ? AND subject_id = ? AND status = 'REVIEW_REQUIRED'
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
            candidate.documentId,
            candidate.subjectId,
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

    fun listObjectKeys(subjectId: String): List<Pair<StorageTrustZone, String>> =
        jdbc.query(
            """
            SELECT object_key, approved_object_key, preview_object_key
            FROM gc_document WHERE subject_id = ?
            """.trimIndent(),
            RowMapper { result, _ ->
                listOfNotNull(
                    result.getString("object_key")?.let { StorageTrustZone.UNTRUSTED to it },
                    result.getString("approved_object_key")?.let { StorageTrustZone.APPROVED_SOURCE to it },
                    result.getString("preview_object_key")?.let { StorageTrustZone.DERIVED_SAFE_ARTIFACT to it },
                )
            },
            subjectId,
        ).flatten()

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
