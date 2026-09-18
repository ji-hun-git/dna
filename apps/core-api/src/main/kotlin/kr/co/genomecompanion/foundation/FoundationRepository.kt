package kr.co.genomecompanion.foundation

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import kr.co.genomecompanion.documentboundary.InspectionDecision
import kr.co.genomecompanion.documentboundary.InspectionReport
import kr.co.genomecompanion.documentboundary.StorageTrustZone
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.jdbc.datasource.DataSourceUtils
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


enum class DemoBootstrapBudget { AVAILABLE, RATE_LIMITED, CAPACITY_EXHAUSTED }

sealed interface IdempotencyClaim {
    data object Inserted : IdempotencyClaim
    data class Existing(val resourceId: UUID, val requestSha256: String?) : IdempotencyClaim
}

data class TerminatedDocument(val documentId: UUID, val objectKeys: List<Pair<StorageTrustZone, String>>)

data class FoundationSessionRow(
    val sessionId: UUID,
    val subjectId: String,
    val tokenHash: String,
    val csrfHash: String,
    val expiresAt: Instant,
)


data class FoundationConsentRow(
    val consentId: UUID,
    val purposeCode: String,
    val status: String,
    val policyVersion: String,
    val grantedAt: Instant,
    val revokedAt: Instant?,
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
    val ordinal: Int,
    val totalCandidates: Int,
    val label: String,
    val candidateValue: String,
    val unit: String,
    val observedOn: LocalDate,
    val evidencePage: Int,
    val sourceTextSha256: String,
    val documentSha256: String,
    val conceptCode: String?,
    val evidenceBox: EvidenceBox?,
    val createdAt: Instant,
    /** Verbatim document text; never returned by an API other than the export. */
    val referenceRangeText: String? = null,
    /** The item name as the result sheet printed it; NULL for rows stored before V11. */
    val originalLabel: String? = null,
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
    val originalObservedOn: LocalDate? = null,
    /** `v.changed_at` of the CURRENT version: mutable — a correction sets this to the correction
     * instant. Never confuse with [confirmedAt], the immutable `r.confirmed_at` used to order
     * every read model (`/records`, health events, series, the FHIR export and the change
     * summary). */
    val versionChangedAt: Instant,
    /** `r.confirmed_at`: set once, at first confirmation, never touched by a later correction.
     * The one instant every read model orders on, so a correction can shuffle same-day ties but
     * never reorders records across an `observedOn` boundary, and never differs between models.
     * Defaults to [versionChangedAt] only so pre-existing test constructions that never model a
     * correction (and therefore never need the two instants to differ) keep compiling unchanged;
     * the mapper below always supplies the real `r.confirmed_at` explicitly. */
    val confirmedAt: Instant = versionChangedAt,
    val correctionReason: String?,
    val evidencePage: Int,
    val sourceTextSha256: String,
    val documentSha256: String,
    val conceptCode: String?,
    /** Copied from the candidate at confirmation, inherited by every correction. Export only. */
    val referenceRangeText: String? = null,
    /** The item name as the result sheet printed it; NULL for rows stored before V11. */
    val originalLabel: String? = null,
)


@Repository
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationRepository(
    private val jdbc: JdbcTemplate,
    private val objectMapper: ObjectMapper,
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

    private val consentMapper = RowMapper { result, _ ->
        FoundationConsentRow(
            consentId = result.getObject("consent_id", UUID::class.java),
            purposeCode = result.getString("purpose_code"),
            status = result.getString("status"),
            policyVersion = result.getString("policy_version"),
            grantedAt = result.getObject("granted_at", OffsetDateTime::class.java).toInstant(),
            revokedAt = result.getObject("revoked_at", OffsetDateTime::class.java)?.toInstant(),
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
            actualLength = result.getObject("actual_length", Long::class.javaObjectType),
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
            ordinal = result.getInt("ordinal"),
            totalCandidates = result.getInt("total_candidates"),
            label = result.getString("label"),
            candidateValue = result.getString("candidate_value"),
            unit = result.getString("unit"),
            observedOn = result.getObject("observed_on", LocalDate::class.java),
            evidencePage = result.getInt("evidence_page"),
            sourceTextSha256 = result.getString("source_text_sha256"),
            documentSha256 = result.getString("document_sha256"),
            conceptCode = result.getString("concept_code"),
            evidenceBox = result.getBigDecimal("evidence_box_x")?.let { x ->
                EvidenceBox(
                    x = x.toDouble(),
                    y = result.getBigDecimal("evidence_box_y").toDouble(),
                    width = result.getBigDecimal("evidence_box_w").toDouble(),
                    height = result.getBigDecimal("evidence_box_h").toDouble(),
                )
            },
            createdAt = result.getObject("candidate_created_at", OffsetDateTime::class.java).toInstant(),
            referenceRangeText = result.getString("reference_range_text"),
            originalLabel = result.getString("original_label"),
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
            originalObservedOn = result.getObject("original_observed_on", LocalDate::class.java),
            versionChangedAt = result.getObject("version_changed_at", OffsetDateTime::class.java).toInstant(),
            confirmedAt = result.getObject("confirmed_at", OffsetDateTime::class.java).toInstant(),
            correctionReason = result.getString("correction_reason"),
            evidencePage = result.getInt("evidence_page"),
            sourceTextSha256 = result.getString("source_text_sha256"),
            documentSha256 = result.getString("document_sha256"),
            conceptCode = result.getString("concept_code"),
            referenceRangeText = result.getString("reference_range_text"),
            originalLabel = result.getString("original_label"),
        )
    }

    private val abstentionJson = objectMapper

    private val candidateProjection =
        """
        SELECT c.candidate_id, c.document_id, c.subject_id, c.status, c.ordinal,
               (SELECT COUNT(*) FROM gc_candidate t WHERE t.document_id = c.document_id AND t.subject_id = c.subject_id) AS total_candidates,
               c.label, c.candidate_value, c.unit,
               c.observed_on, c.evidence_page, c.source_text_sha256, c.concept_code, c.reference_range_text, c.original_label,
               c.evidence_box_x, c.evidence_box_y, c.evidence_box_w, c.evidence_box_h,
               d.sha256 AS document_sha256, c.created_at AS candidate_created_at
        FROM gc_candidate c
        JOIN gc_document d ON d.document_id = c.document_id AND d.subject_id = c.subject_id
        """.trimIndent()

    /** A preview artifact counts as approved-and-current only while the document has reached
     * REVIEW_REQUIRED/COMPLETED and both the preview's object key and source digest still match
     * the document's current values. Both preview-lookup queries below must share this exact
     * predicate so they cannot drift apart. */
    private val approvedPreviewJoin =
        """
        d.status IN ('REVIEW_REQUIRED', 'COMPLETED')
          AND d.preview_object_key = p.object_key AND d.sha256 = p.source_sha256
        """.trimIndent()

    private val recordProjection =
        """
        SELECT r.record_id, v.version_id AS record_version_id, v.supersedes_version_id,
               r.candidate_id, r.document_id, r.subject_id, v.status AS version_status,
               r.label, v.value AS current_value, c.candidate_value AS original_value,
               r.unit, r.observed_on, r.original_observed_on, v.changed_at AS version_changed_at,
               r.confirmed_at AS confirmed_at, v.correction_reason,
               c.evidence_page, c.source_text_sha256, d.sha256 AS document_sha256, v.concept_code, v.reference_range_text, v.original_label
        FROM gc_health_record r
        JOIN gc_health_record_version v ON v.record_id = r.record_id
        JOIN gc_candidate c ON c.candidate_id = r.candidate_id AND c.subject_id = r.subject_id
        JOIN gc_document d ON d.document_id = r.document_id AND d.subject_id = r.subject_id
        """.trimIndent()

    /** Transaction-scoped lock makes the cap durable and serial across API replicas/restarts.
     * Capacity is active subjects: deletion and expiry return it. The 20-per-minute creation rate
     * still counts deleted rows so deletion cannot reset the per-minute budget.
     */
    fun reserveDemoBootstrap(now: Instant): DemoBootstrapBudget {
        jdbc.execute("SELECT pg_advisory_xact_lock(714220910)")
        val total = jdbc.queryForObject(
            "SELECT COUNT(*) FROM gc_subject WHERE subject_id LIKE 'synthetic-demo-%' AND deleted_at IS NULL",
            Long::class.java,
        ) ?: 0L
        val recent = jdbc.queryForObject(
            "SELECT COUNT(*) FROM gc_subject WHERE subject_id LIKE 'synthetic-demo-%' AND created_at > ?",
            Long::class.java, now.minusSeconds(60).atOffset(ZoneOffset.UTC),
        ) ?: 0L
        return when {
            total >= 1000 -> DemoBootstrapBudget.CAPACITY_EXHAUSTED
            recent >= 20 -> DemoBootstrapBudget.RATE_LIMITED
            else -> DemoBootstrapBudget.AVAILABLE
        }
    }

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

    /** True exactly once per session: the row was live and this call is the one that ended it. */
    fun revokeSession(sessionId: UUID, now: Instant): Boolean =
        jdbc.update(
            "UPDATE gc_session SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL",
            now.atOffset(ZoneOffset.UTC),
            sessionId,
        ) == 1

    /**
     * Janitor sweep (Task 23): a session row is dead either way — `findActiveSession` requires both
     * `revoked_at IS NULL` and a future `expires_at`, so neither kind can authenticate anything again
     * and keeping them only grows the table. Deleted by predicate with no explicit row lock and in its
     * own short transaction, so it can never sit between the target-row and idempotency locks that the
     * lifecycle paths take (see [lockDocument]) and deadlock against them.
     */
    @Transactional
    fun deleteExpiredSessions(now: Instant): Int =
        jdbc.update(
            "DELETE FROM gc_session WHERE expires_at <= ? OR revoked_at IS NOT NULL",
            now.atOffset(ZoneOffset.UTC),
        )

    /** Janitor sweep: an expired capability can no longer be presented ([findActiveUploadCapability]
     * requires `expires_at > now`), revoked or not. */
    @Transactional
    fun deleteExpiredUploadCapabilities(now: Instant): Int =
        jdbc.update(
            "DELETE FROM gc_upload_capability WHERE expires_at <= ?",
            now.atOffset(ZoneOffset.UTC),
        )

    fun grantConsent(consentId: UUID, subjectId: String, purposeCode: String, policyVersion: String, now: Instant) {
        jdbc.update(
            """
            INSERT INTO gc_consent_grant(
                consent_id, subject_id, purpose_code, status, policy_version, granted_at
            ) VALUES (?, ?, ?, 'ACTIVE', ?, ?)
            """.trimIndent(),
            consentId,
            subjectId,
            purposeCode,
            policyVersion,
            now.atOffset(ZoneOffset.UTC),
        )
    }

    fun findActiveConsent(subjectId: String, purposeCode: String): UUID? =
        jdbc.query(
            """
            SELECT consent_id
            FROM gc_consent_grant
            WHERE subject_id = ? AND purpose_code = ? AND status = 'ACTIVE'
            """.trimIndent(),
            RowMapper { result, _ -> result.getObject("consent_id", UUID::class.java) },
            subjectId,
            purposeCode,
        ).firstOrNull()

    private val consentProjection =
        "SELECT consent_id, purpose_code, status, policy_version, granted_at, revoked_at FROM gc_consent_grant"

    fun findLatestConsent(subjectId: String, purposeCode: String): FoundationConsentRow? =
        jdbc.query(
            """
            $consentProjection
            WHERE subject_id = ? AND purpose_code = ?
            ORDER BY granted_at DESC, consent_id DESC
            LIMIT 1
            """.trimIndent(),
            consentMapper,
            subjectId,
            purposeCode,
        ).firstOrNull()

    /** The most recent row of every purpose this owner ever consented to. */
    fun listLatestConsents(subjectId: String): List<FoundationConsentRow> =
        jdbc.query(
            """
            SELECT DISTINCT ON (purpose_code)
                   consent_id, purpose_code, status, policy_version, granted_at, revoked_at
            FROM gc_consent_grant
            WHERE subject_id = ?
            ORDER BY purpose_code, granted_at DESC, consent_id DESC
            """.trimIndent(),
            consentMapper,
            subjectId,
        )

    fun findConsent(subjectId: String, consentId: UUID): FoundationConsentRow? =
        jdbc.query(
            "$consentProjection WHERE subject_id = ? AND consent_id = ?",
            consentMapper,
            subjectId,
            consentId,
        ).firstOrNull()

    /** Document intake and review read only the DOCUMENT_EXTRACTION purpose. A research or project
     * consent id therefore resolves to null here and is refused as `active_consent_required`. */
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

    private val terminableDocumentStatuses = """(
        'UPLOAD_PENDING', 'UNTRUSTED_OBJECT', 'SECURITY_INSPECTION', 'SECURITY_APPROVED',
        'EXTRACTION_QUEUED', 'EXTRACTION_RUNNING', 'REVIEW_REQUIRED', 'FAILED_RETRYABLE'
    )""".trimIndent()

    /**
     * Founder decision 2026-09-18: revocation ends every document that has not been reviewed to
     * completion. Returns the object keys to delete after commit.
     *
     * Lock order: `gc_document_job` rows are located and locked (`FOR UPDATE`) *before* the
     * `gc_document` update below acquires its own row locks — the same order every worker
     * completion path uses (`DocumentWorkerBoundary.requireLeasedJob` calls `lockLeasedJob`
     * — `FOR UPDATE OF j` — before `markInspectionCompleted`/`markExtractionCompleted`/
     * `markJobFailed` update `gc_document`). Locking documents first here (the previous order)
     * could deadlock against a worker transaction doing job-then-document in the opposite order.
     * See [lockDocument]'s KDoc for the full picture across every path.
     */
    fun terminateDocumentsForRevokedConsent(subjectId: String, consentId: UUID, now: Instant): List<TerminatedDocument> {
        val candidateIds = jdbc.query(
            "SELECT document_id FROM gc_document WHERE subject_id = ? AND consent_id = ? AND status IN $terminableDocumentStatuses",
            { result, _ -> result.getObject("document_id", UUID::class.java) },
            subjectId, consentId,
        )
        if (candidateIds.isEmpty()) return emptyList()
        val connection = DataSourceUtils.getConnection(checkNotNull(jdbc.dataSource))
        val candidateIdsArray = connection.createArrayOf("uuid", candidateIds.toTypedArray())
        // Lock every in-flight job for these documents before touching gc_document at all — a
        // worker mid-completion holds this same job row locked until its own transaction commits
        // or rolls back, so this blocks (never deadlocks) until that resolves.
        jdbc.query(
            "SELECT job_id FROM gc_document_job WHERE document_id = ANY(?) FOR UPDATE",
            { _, _ -> Unit },
            candidateIdsArray,
        )
        jdbc.update(
            """
            UPDATE gc_document_job SET status = 'DEAD_LETTER', failure_code = 'consent_revoked',
                lease_token_hash = NULL, lease_expires_at = NULL, worker_id_hash = NULL, updated_at = ?
            WHERE document_id = ANY(?) AND status IN ('QUEUED', 'LEASED', 'FAILED_RETRYABLE')
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC), candidateIdsArray,
        )
        val terminated = jdbc.query(
            """
            UPDATE gc_document
            SET status = 'TERMINATED_BY_REVOCATION', failure_code = 'consent_revoked',
                preview_object_key = NULL, state_version = state_version + 1, updated_at = ?
            WHERE subject_id = ? AND consent_id = ? AND status IN $terminableDocumentStatuses
            -- The gc_preview_artifact row is read here but intentionally NOT deleted in this transaction:
            -- its file is only deleted after this transaction commits (FoundationLifecycleService.revokeConsent's
            -- afterCommit hook), and the row itself must outlive that file until the delete is confirmed. If the
            -- file delete fails, the row is deliberately left behind so it still points at an orphaned file that
            -- the Task 22 janitor can find and retry — see deletePreviewArtifactIfExists below.
            RETURNING document_id, object_key, approved_object_key,
                      (SELECT object_key FROM gc_preview_artifact p WHERE p.document_id = gc_document.document_id) AS preview_key
            """.trimIndent(),
            RowMapper { result, _ ->
                TerminatedDocument(
                    documentId = result.getObject("document_id", UUID::class.java),
                    objectKeys = listOfNotNull(
                        result.getString("object_key")?.let { StorageTrustZone.UNTRUSTED to it },
                        result.getString("approved_object_key")?.let { StorageTrustZone.APPROVED_SOURCE to it },
                        result.getString("preview_key")?.let { StorageTrustZone.DERIVED_SAFE_ARTIFACT to it },
                    ),
                )
            },
            now.atOffset(ZoneOffset.UTC), subjectId, consentId,
        )
        if (terminated.isEmpty()) return emptyList()
        val ids = terminated.map { it.documentId }.toTypedArray()
        val idsArray = connection.createArrayOf("uuid", ids)
        jdbc.update("UPDATE gc_upload_capability SET revoked_at = COALESCE(revoked_at, ?) WHERE document_id = ANY(?)", now.atOffset(ZoneOffset.UTC), idsArray)
        return terminated
    }

    /**
     * Contract: call this only after the preview file itself has been confirmed deleted (or was already
     * absent) — never before, and never unconditionally alongside the file delete. A file-delete failure
     * must leave this row in place, still pointing at the orphaned file, so the Task 22 janitor can find
     * and retry it later; deleting the row first (or regardless of the file outcome) would orphan the file
     * with nothing left pointing at it. See `FoundationLifecycleService.revokeConsent`'s afterCommit hook,
     * the only caller.
     */
    fun deletePreviewArtifactIfExists(documentId: UUID) {
        jdbc.update("DELETE FROM gc_preview_artifact WHERE document_id = ?", documentId)
    }

    /** Insert-or-read in one statement so two racing requests see one winner. Expired rows are replaced. */
    fun claimIdempotency(
        subjectHash: String,
        operation: String,
        idempotencyKey: String,
        resourceId: UUID,
        requestSha256: String,
        now: Instant,
        expiresAt: Instant,
    ): IdempotencyClaim {
        val row = jdbc.query(
            """
            INSERT INTO gc_idempotency(subject_hash, operation, idempotency_key, resource_id, request_sha256, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (subject_hash, operation, idempotency_key) DO UPDATE
                SET resource_id = EXCLUDED.resource_id, request_sha256 = EXCLUDED.request_sha256,
                    created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at
                WHERE gc_idempotency.expires_at <= EXCLUDED.created_at
            RETURNING resource_id, request_sha256, (xmax = 0) AS inserted
            """.trimIndent(),
            RowMapper { result, _ ->
                Triple(result.getObject("resource_id", UUID::class.java), result.getString("request_sha256"), result.getBoolean("inserted"))
            },
            subjectHash, operation, idempotencyKey, resourceId, requestSha256,
            now.atOffset(ZoneOffset.UTC), expiresAt.atOffset(ZoneOffset.UTC),
        ).firstOrNull()
        if (row != null && (row.third || row.first == resourceId)) return IdempotencyClaim.Inserted
        val existing = row ?: jdbc.query(
            "SELECT resource_id, request_sha256 FROM gc_idempotency WHERE subject_hash = ? AND operation = ? AND idempotency_key = ?",
            RowMapper { result, _ -> Triple(result.getObject("resource_id", UUID::class.java), result.getString("request_sha256"), false) },
            subjectHash, operation, idempotencyKey,
        ).first()
        return IdempotencyClaim.Existing(existing.first, existing.second)
    }

    /**
     * Read-only lookup of a still-live claim for this key, without claiming anything. Used where a resource-level
     * short-circuit (e.g. "this candidate already has a record") would otherwise bypass the mismatch check.
     */
    fun peekIdempotency(subjectHash: String, operation: String, idempotencyKey: String, now: Instant): IdempotencyClaim.Existing? =
        jdbc.query(
            "SELECT resource_id, request_sha256 FROM gc_idempotency WHERE subject_hash = ? AND operation = ? AND idempotency_key = ? AND expires_at > ?",
            RowMapper { result, _ -> IdempotencyClaim.Existing(result.getObject("resource_id", UUID::class.java), result.getString("request_sha256")) },
            subjectHash, operation, idempotencyKey, now.atOffset(ZoneOffset.UTC),
        ).firstOrNull()

    fun deleteExpiredIdempotency(now: Instant): Int =
        jdbc.update("DELETE FROM gc_idempotency WHERE expires_at <= ?", now.atOffset(ZoneOffset.UTC))

    fun deleteIdempotencyForSubject(subjectHash: String): Int =
        jdbc.update("DELETE FROM gc_idempotency WHERE subject_hash = ?", subjectHash)

    /**
     * The CONSENT_GRANT:<purpose> operation already stored under this subject+key, regardless of purpose.
     * Used to detect a key reused across different consent purposes, since the operation is purpose-scoped
     * and a plain equality lookup would otherwise miss the collision entirely.
     */
    fun findConsentGrantOperationForKey(subjectHash: String, idempotencyKey: String): String? =
        jdbc.query(
            """
            SELECT operation
            FROM gc_idempotency
            WHERE subject_hash = ? AND idempotency_key = ? AND operation LIKE 'CONSENT_GRANT:%'
            """.trimIndent(),
            RowMapper { result, _ -> result.getString("operation") },
            subjectHash,
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

    /**
     * Locks the document row before any status check. Lock order across every path that reaches
     * this repository, none of which can cycle against any other because each falls into exactly
     * one of these two disjoint groups and no path ever mixes them:
     *
     * 1. **Confirm, exclude, correct, and the document-request/upload path**: at most one target
     *    row of `gc_candidate` ([lockCandidate], confirm/exclude), `gc_health_record`
     *    ([lockRecord], correct), or `gc_document` (this method, the document-request/upload path)
     *    is locked first — never more than one of these three tables in the same transaction —
     *    then the idempotency claim (Task 7's `gc_idempotency INSERT ... ON CONFLICT`). None of
     *    these paths ever locks `gc_document_job`.
     * 2. **Revocation and every worker completion path**: `gc_document_job` rows are located and
     *    locked (`FOR UPDATE`) *before* any `gc_document` row lock in the same transaction —
     *    `DocumentWorkerBoundary.requireLeasedJob` calls `lockLeasedJob` (`FOR UPDATE OF j`) before
     *    `markInspectionCompleted`/`markExtractionCompleted`/`markJobFailed` update `gc_document`;
     *    [terminateDocumentsForRevokedConsent] (F5) locks the affected jobs the same way before its
     *    own `gc_document` update. Neither of these two paths ever locks `gc_candidate`,
     *    `gc_health_record`, or the idempotency table.
     *
     * Because group 1 never touches `gc_document_job` and group 2 never touches
     * `gc_candidate`/`gc_health_record`/`gc_idempotency`, and within group 2 both members agree on
     * job-before-document, no two of these transactions can ever hold a lock the other is waiting
     * for while waiting on a lock the other holds — the necessary condition for a deadlock.
     * `deleteProfile`'s bulk deletion locks no single target row from either group (it deletes
     * every row for the subject across tables without a prior per-row `SELECT ... FOR UPDATE`), so
     * it cannot enter either cycle either.
     */
    fun lockDocument(subjectId: String, documentId: UUID): FoundationDocumentRow? {
        jdbc.query("SELECT document_id FROM gc_document WHERE document_id = ? AND subject_id = ? FOR UPDATE", { _, _ -> Unit }, documentId, subjectId)
        return findDocument(subjectId, documentId)
    }

    fun findLatestActiveDocument(subjectId: String): FoundationDocumentRow? =
        jdbc.query(
            """
            SELECT document_id, subject_id, consent_id, status, expected_length, expected_sha256,
                   actual_length, sha256, object_key, approved_object_key, preview_object_key,
                   state_version, failure_code
            FROM gc_document
            WHERE subject_id = ? AND status NOT IN (
                'COMPLETED', 'SECURITY_REJECTED', 'FAILED_TERMINAL', 'DELETED', 'TERMINATED_BY_REVOCATION'
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
        previewId: UUID,
        previewObjectKey: String,
        previewSha256: String,
        workerImageDigest: String,
        generatorVersion: String,
        now: Instant,
        candidates: List<NormalizedCandidate>,
        abstentions: List<ExtractionAbstention>,
    ) {
        jdbc.update(
            """
            INSERT INTO gc_extraction_job(
                job_id, document_id, subject_id, status, created_at, finished_at,
                worker_job_id, source_sha256, worker_image_digest, generator_version, attempt, abstentions
            ) VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
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
            abstentionJson.writeValueAsString(abstentions),
        )
        candidates.forEach { candidate ->
            jdbc.update(
                """
                INSERT INTO gc_candidate(
                    candidate_id, job_id, document_id, subject_id, status, ordinal, label, candidate_value,
                    unit, observed_on, evidence_page, source_text_sha256, created_at, extraction_method,
                    evidence_box_x, evidence_box_y, evidence_box_w, evidence_box_h, concept_code, reference_range_text, original_label
                ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, 'native-text', ?, ?, ?, ?, ?, ?, ?)
                """.trimIndent(),
                UUID.randomUUID(),
                extractionJobId,
                workerJob.documentId,
                workerJob.subjectId,
                candidate.ordinal,
                candidate.label,
                candidate.value,
                candidate.unit,
                candidate.observedOn,
                candidate.evidencePage,
                candidate.sourceTextSha256,
                now.atOffset(ZoneOffset.UTC),
                candidate.evidenceBox?.x,
                candidate.evidenceBox?.y,
                candidate.evidenceBox?.width,
                candidate.evidenceBox?.height,
                candidate.conceptCode,
                candidate.referenceRangeText,
                candidate.originalLabel,
            )
        }
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
        val nextStatus = if (candidates.isEmpty()) "COMPLETED" else "REVIEW_REQUIRED"
        jdbc.update(
            """
            UPDATE gc_document
            SET status = ?, preview_object_key = ?, failure_code = NULL,
                completed_at = CASE WHEN ? = 'COMPLETED' THEN ? ELSE completed_at END,
                state_version = state_version + 1, updated_at = ?
            WHERE document_id = ? AND status = 'EXTRACTION_RUNNING' AND sha256 = ?
            """.trimIndent(),
            nextStatus,
            previewObjectKey,
            nextStatus,
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
            workerJob.documentId,
            workerJob.sourceSha256,
        ).also { check(it == 1) { "document extraction state changed" } }
        completeJob(workerJob.jobId, now)
    }

    fun findExtractionAbstentions(subjectId: String, documentId: UUID): List<ExtractionAbstention> =
        jdbc.query(
            """
            SELECT j.abstentions::text AS abstentions
            FROM gc_extraction_job j
            WHERE j.subject_id = ? AND j.document_id = ? AND j.status = 'COMPLETED'
            """.trimIndent(),
            RowMapper { result, _ -> abstentionJson.readValue<List<ExtractionAbstention>>(result.getString("abstentions")) },
            subjectId,
            documentId,
        ).firstOrNull() ?: emptyList()

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
            $candidateProjection
            WHERE c.subject_id = ? AND c.document_id = ?
            ORDER BY CASE WHEN c.status = 'PENDING' THEN 0 ELSE 1 END, c.ordinal
            LIMIT 1
            """.trimIndent(),
            candidateMapper,
            subjectId,
            documentId,
        ).firstOrNull()

    fun listCandidatesForDocument(subjectId: String, documentId: UUID): List<FoundationCandidateRow> =
        jdbc.query(
            """
            $candidateProjection
            WHERE c.subject_id = ? AND c.document_id = ?
            ORDER BY c.ordinal
            """.trimIndent(),
            candidateMapper,
            subjectId,
            documentId,
        )

    fun findCandidate(subjectId: String, candidateId: UUID): FoundationCandidateRow? =
        jdbc.query(
            """
            $candidateProjection
            WHERE c.subject_id = ? AND c.candidate_id = ?
            """.trimIndent(),
            candidateMapper,
            subjectId,
            candidateId,
        ).firstOrNull()

    /** Locks the candidate row before any status check. See [lockDocument] for the shared lock-order comment. */
    fun lockCandidate(subjectId: String, candidateId: UUID): FoundationCandidateRow? {
        jdbc.query("SELECT candidate_id FROM gc_candidate WHERE candidate_id = ? AND subject_id = ? FOR UPDATE", { _, _ -> Unit }, candidateId, subjectId)
        return findCandidate(subjectId, candidateId)
    }

    fun findPreviewArtifact(subjectId: String, documentId: UUID): PreviewArtifactRow? =
        jdbc.query(
            """
            SELECT p.object_key, p.source_sha256, p.preview_sha256, p.generator_version
            FROM gc_preview_artifact p
            JOIN gc_document d ON d.document_id = p.document_id
            WHERE d.subject_id = ? AND d.document_id = ?
              AND $approvedPreviewJoin
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

    /** Documents of this owner whose approved preview is still bound to the stored digest. */
    fun listDocumentIdsWithPreview(subjectId: String): Set<UUID> =
        jdbc.query(
            """
            SELECT d.document_id
            FROM gc_document d
            JOIN gc_preview_artifact p ON p.document_id = d.document_id
            WHERE d.subject_id = ?
              AND $approvedPreviewJoin
            """.trimIndent(),
            RowMapper { result, _ -> result.getObject("document_id", UUID::class.java) },
            subjectId,
        ).toSet()

    /** Documents of this owner that the server has marked COMPLETED (a completion instant exists). */
    fun listDocumentCompletions(subjectId: String): List<DocumentCompletionRow> =
        jdbc.query(
            """
            SELECT document_id, completed_at
            FROM gc_document
            WHERE subject_id = ? AND completed_at IS NOT NULL
            """.trimIndent(),
            RowMapper { result, _ ->
                DocumentCompletionRow(
                    documentId = result.getObject("document_id", UUID::class.java),
                    completedAt = result.getObject("completed_at", OffsetDateTime::class.java).toInstant(),
                )
            },
            subjectId,
        )

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
                  AND NOT EXISTS (
                      SELECT 1 FROM gc_candidate p
                      WHERE p.document_id = d.document_id AND p.subject_id = d.subject_id
                        AND p.status = 'PENDING'
                  )
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
        observedOn: LocalDate = candidate.observedOn,
    ): Boolean {
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
        if (updated != 1) return false
        jdbc.update(
            """
            INSERT INTO gc_health_record(
                record_id, candidate_id, document_id, subject_id, label, confirmed_value,
                unit, observed_on, original_observed_on, confirmed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            recordId,
            candidate.candidateId,
            candidate.documentId,
            candidate.subjectId,
            candidate.label,
            confirmedValue,
            candidate.unit,
            observedOn,
            if (observedOn == candidate.observedOn) null else candidate.observedOn,
            now.atOffset(ZoneOffset.UTC),
        )
        jdbc.update(
            """
            INSERT INTO gc_health_record_version(
                version_id, record_id, subject_id, status, value,
                supersedes_version_id, correction_reason, changed_at, concept_code, reference_range_text, original_label
            ) VALUES (?, ?, ?, 'CURRENT', ?, NULL, NULL, ?, ?, ?, ?)
            """.trimIndent(),
            versionId,
            recordId,
            candidate.subjectId,
            confirmedValue,
            now.atOffset(ZoneOffset.UTC),
            candidate.conceptCode,
            candidate.referenceRangeText,
            candidate.originalLabel,
        )
        jdbc.update(
            """
            UPDATE gc_document d
            SET status = 'COMPLETED', completed_at = ?, state_version = state_version + 1, updated_at = ?
            WHERE d.document_id = ? AND d.subject_id = ? AND d.status = 'REVIEW_REQUIRED'
              AND NOT EXISTS (
                  SELECT 1 FROM gc_candidate c
                  WHERE c.document_id = d.document_id AND c.subject_id = d.subject_id
                    AND c.status = 'PENDING'
              )
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            now.atOffset(ZoneOffset.UTC),
            candidate.documentId,
            candidate.subjectId,
        )
        return true
    }

    fun findRecord(subjectId: String, recordId: UUID): FoundationRecordRow? =
        jdbc.query(
            "$recordProjection WHERE r.subject_id = ? AND r.record_id = ? AND v.status = 'CURRENT'",
            recordMapper,
            subjectId,
            recordId,
        ).firstOrNull()

    /** Locks the record row before any status check. See [lockDocument] for the shared lock-order comment. */
    fun lockRecord(subjectId: String, recordId: UUID): FoundationRecordRow? {
        jdbc.query("SELECT record_id FROM gc_health_record WHERE record_id = ? AND subject_id = ? FOR UPDATE", { _, _ -> Unit }, recordId, subjectId)
        return findRecord(subjectId, recordId)
    }

    fun findRecordVersion(subjectId: String, versionId: UUID): FoundationRecordRow? =
        jdbc.query(
            "$recordProjection WHERE r.subject_id = ? AND v.version_id = ?",
            recordMapper,
            subjectId,
            versionId,
        ).firstOrNull()

    // Ordered by exam date, then by the record's own immutable confirmed_at (set once when the
    // candidate was confirmed): a later correction only ever touches v.changed_at on a new
    // gc_health_record_version row, never r.confirmed_at, so /records and the JSON export that
    // reads it never reorder because of a correction.
    fun listRecords(subjectId: String): List<FoundationRecordRow> =
        jdbc.query(
            "$recordProjection WHERE r.subject_id = ? AND v.status = 'CURRENT' ORDER BY r.observed_on, r.confirmed_at, r.record_id",
            recordMapper,
            subjectId,
        )

    /**
     * One keyset page of [listRecords]'s exact order — `(observed_on, confirmed_at, record_id)`.
     * `afterVersionId` is the CURRENT version id of the last row the caller already holds; the row it
     * names is looked up **within the subject**, so a version id belonging to somebody else (or to a
     * deleted row) yields an empty page rather than a window into another person's records. The query
     * asks for `limit + 1` rows so the caller can tell whether a further page exists without a second
     * round trip and without a COUNT. PostgreSQL row-wise comparison `(a,b,c) > (x,y,z)` is exactly the
     * lexicographic "strictly after" of that ORDER BY, so a page boundary can neither skip nor repeat a
     * row even when many records share an exam date and an instant.
     */
    fun listRecordsPage(subjectId: String, afterVersionId: UUID?, limit: Int): List<FoundationRecordRow> {
        if (afterVersionId == null) {
            return jdbc.query(
                """
                $recordProjection
                WHERE r.subject_id = ? AND v.status = 'CURRENT'
                ORDER BY r.observed_on, r.confirmed_at, r.record_id
                LIMIT ?
                """.trimIndent(),
                recordMapper,
                subjectId,
                limit + 1,
            )
        }
        val cursor = findRecordVersion(subjectId, afterVersionId) ?: return emptyList()
        return jdbc.query(
            """
            $recordProjection
            WHERE r.subject_id = ? AND v.status = 'CURRENT'
              AND (r.observed_on, r.confirmed_at, r.record_id)
                  > (CAST(? AS DATE), CAST(? AS TIMESTAMPTZ), CAST(? AS UUID))
            ORDER BY r.observed_on, r.confirmed_at, r.record_id
            LIMIT ?
            """.trimIndent(),
            recordMapper,
            subjectId,
            cursor.observedOn,
            cursor.confirmedAt.atOffset(ZoneOffset.UTC),
            cursor.recordId,
            limit + 1,
        )
    }

    /** CURRENT record versions this subject owns: the export/aggregate cap counts rows, never values. */
    fun countCurrentRecords(subjectId: String): Long =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM gc_health_record_version WHERE subject_id = ? AND status = 'CURRENT'",
            Long::class.java,
            subjectId,
        ) ?: 0L

    /** Documents this subject owns, in any state: the second half of the export cap. */
    fun countDocuments(subjectId: String): Long =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM gc_document WHERE subject_id = ?",
            Long::class.java,
            subjectId,
        ) ?: 0L

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
                supersedes_version_id, correction_reason, changed_at, concept_code, reference_range_text, original_label
            ) VALUES (?, ?, ?, 'CURRENT', ?, ?, ?, ?,
                (SELECT concept_code FROM gc_health_record_version WHERE version_id = ?),
                (SELECT reference_range_text FROM gc_health_record_version WHERE version_id = ?),
                (SELECT original_label FROM gc_health_record_version WHERE version_id = ?))
            """.trimIndent(),
            newVersionId,
            recordId,
            subjectId,
            value,
            previousVersionId,
            reason,
            now.atOffset(ZoneOffset.UTC),
            previousVersionId,
            previousVersionId,
            previousVersionId,
        )
        return true
    }

    /**
     * Every object key deletion must remove for the subject. `gc_document`'s own three columns are
     * not the whole story: revocation nulls `gc_document.preview_object_key` but deliberately
     * leaves the `gc_preview_artifact` row behind when the preview file's own delete failed (see
     * [deletePreviewArtifactIfExists]'s contract), so that row's `object_key` is the only remaining
     * pointer to that orphaned file. Left-joining it here (distinct, non-null — `gc_preview_artifact`
     * is at most one row per document, so no fan-out) means a later full-profile deletion still
     * finds and removes it instead of leaving it behind forever (F6).
     */
    fun listObjectKeys(subjectId: String): List<Pair<StorageTrustZone, String>> =
        jdbc.query(
            """
            SELECT d.object_key, d.approved_object_key, d.preview_object_key, p.object_key AS orphaned_preview_object_key
            FROM gc_document d
            LEFT JOIN gc_preview_artifact p ON p.document_id = d.document_id
            WHERE d.subject_id = ?
            """.trimIndent(),
            RowMapper { result, _ ->
                listOfNotNull(
                    result.getString("object_key")?.let { StorageTrustZone.UNTRUSTED to it },
                    result.getString("approved_object_key")?.let { StorageTrustZone.APPROVED_SOURCE to it },
                    result.getString("preview_object_key")?.let { StorageTrustZone.DERIVED_SAFE_ARTIFACT to it },
                    result.getString("orphaned_preview_object_key")?.let { StorageTrustZone.DERIVED_SAFE_ARTIFACT to it },
                )
            },
            subjectId,
        ).flatten().distinct()

    /**
     * Every object key any row still points at, across all subjects — the janitor's definition of
     * "not an orphan". It is deliberately a superset of [listObjectKeys]:
     *
     * - `gc_document`'s three key columns and the `gc_preview_artifact` row that can outlive
     *   `preview_object_key` (see [deletePreviewArtifactIfExists]).
     * - the *reserved* untrusted key of every `UPLOAD_PENDING` document. That file lands on disk
     *   (an atomic move out of `<key>.part`) a moment before `markDocumentUploaded` records
     *   `object_key`, so a sweep running inside that window would otherwise delete a perfectly live
     *   upload. Reserving the key for the pending state only — not for every document ever created —
     *   keeps the retry path intact: once a document is terminated or its key cleared, a file left
     *   behind by a failed post-commit delete is an orphan again and gets swept.
     */
    fun listKnownObjectKeys(): Set<Pair<StorageTrustZone, String>> =
        jdbc.query(
            """
            SELECT 'UNTRUSTED' AS zone, object_key AS key FROM gc_document WHERE object_key IS NOT NULL
            UNION
            SELECT 'APPROVED_SOURCE', approved_object_key FROM gc_document WHERE approved_object_key IS NOT NULL
            UNION
            SELECT 'DERIVED_SAFE_ARTIFACT', preview_object_key FROM gc_document WHERE preview_object_key IS NOT NULL
            UNION
            SELECT 'DERIVED_SAFE_ARTIFACT', object_key FROM gc_preview_artifact
            UNION
            SELECT 'UNTRUSTED', document_id || '.pdf' FROM gc_document WHERE status = 'UPLOAD_PENDING'
            """.trimIndent(),
            RowMapper { result, _ ->
                StorageTrustZone.valueOf(result.getString("zone")) to result.getString("key")
            },
        ).toSet()

    /**
     * Janitor sweep: a job that was queued (or left retryable) and never picked up before [olderThan]
     * is never going to be — its document would otherwise wait forever in a non-terminal state with no
     * worker coming. Both statements run in one short transaction in the same order every worker path
     * uses — job rows first, then documents ([terminateDocumentsForRevokedConsent]'s KDoc) — and take
     * no explicit row locks, so a worker completing mid-sweep blocks rather than deadlocks.
     *
     * Leased jobs are untouched (a worker holds them; lease expiry is [leaseNextDocumentJob]'s job) and
     * so are terminal ones. The document update skips documents that already reached a terminal or
     * completed state, so a sweep can never walk a finished document backwards.
     */
    @Transactional
    fun failStaleQueuedJobs(olderThan: Instant, now: Instant): List<UUID> {
        val staleDocumentIds = jdbc.query(
            """
            UPDATE gc_document_job
            SET status = 'FAILED_TERMINAL', failure_code = 'stale',
                lease_token_hash = NULL, lease_expires_at = NULL, worker_id_hash = NULL, updated_at = ?
            WHERE status IN ('QUEUED', 'FAILED_RETRYABLE') AND created_at < ?
            RETURNING document_id
            """.trimIndent(),
            RowMapper { result, _ -> result.getObject("document_id", UUID::class.java) },
            now.atOffset(ZoneOffset.UTC),
            olderThan.atOffset(ZoneOffset.UTC),
        ).distinct()
        if (staleDocumentIds.isEmpty()) return emptyList()
        val placeholders = staleDocumentIds.joinToString(", ") { "?" }
        jdbc.update(
            """
            UPDATE gc_document
            SET status = 'FAILED_TERMINAL', failure_code = 'stale',
                state_version = state_version + 1, updated_at = ?
            WHERE document_id IN ($placeholders)
              AND status NOT IN ('COMPLETED', 'DELETED', 'DELETION_PENDING', 'FAILED_TERMINAL', 'TERMINATED_BY_REVOCATION')
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC),
            *staleDocumentIds.toTypedArray(),
        )
        return staleDocumentIds
    }

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
        jdbc.update(
            """
            DELETE FROM gc_upload_capability c
            USING gc_document d
            WHERE d.document_id = c.document_id AND d.subject_id = ?
            """.trimIndent(),
            subjectId,
        )
        jdbc.update("DELETE FROM gc_document WHERE subject_id = ?", subjectId)
        jdbc.update("DELETE FROM gc_consent_grant WHERE subject_id = ?", subjectId)
        jdbc.update("DELETE FROM gc_session WHERE subject_id = ?", subjectId)
        deleteIdempotencyForSubject(subjectHash)
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
        purposeCode: String? = null,
    ) {
        doInsertAudit(subjectHash, actorSessionHash, eventType, resourceType, resourceId, outcome, now, purposeCode)
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
        doInsertAudit(subjectHash, actorSessionHash, eventType, resourceType, resourceId, "DENIED", now, null)
    }

    private fun doInsertAudit(
        subjectHash: String,
        actorSessionHash: String?,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
        now: Instant,
        purposeCode: String?,
    ) {
        jdbc.update(
            """
            INSERT INTO gc_audit_event(
                event_id, subject_hash, actor_session_hash, event_type, resource_type,
                resource_id, outcome, occurred_at, purpose_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            UUID.randomUUID(),
            subjectHash,
            actorSessionHash,
            eventType,
            resourceType,
            resourceId,
            outcome,
            now.atOffset(ZoneOffset.UTC),
            purposeCode,
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
