package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.documentboundary.BoundedUploadCapability
import kr.co.genomecompanion.documentboundary.StorageTrustZone
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.time.Clock
import java.time.Instant
import java.util.UUID


class FoundationBadRequestException(val code: String) : RuntimeException(code)
class FoundationForbiddenException(val code: String) : RuntimeException(code)
class FoundationNotFoundException(val code: String) : RuntimeException(code)
class FoundationConflictException(val code: String) : RuntimeException(code)


data class IssuedFoundationSession(
    val sessionId: UUID,
    val rawToken: String,
    val rawCsrf: String,
    val expiresAt: Instant,
)


data class DocumentConsentReceipt(
    val consentId: UUID?,
    val status: String,
)


data class DocumentReceipt(
    val documentId: UUID,
    val status: String,
    val sha256: String?,
    val contentLength: Long?,
    val stateVersion: Long,
    val failureCode: String?,
    val previewAvailable: Boolean,
    val quarantineBoundary: String = "HOSTILE_DOCUMENT_TRUST_ZONE",
)


data class IssuedDocumentTicket(
    val document: DocumentReceipt,
    val uploadCapability: BoundedUploadCapability,
)


data class CandidateReceipt(
    val candidateId: UUID,
    val documentId: UUID,
    val status: String,
    val label: String,
    val value: String,
    val unit: String,
    val observedOn: String,
    val evidencePage: Int,
    val sourceTextSha256: String,
    val documentSha256: String,
    val sourceType: String = "SYNTHETIC_FIXED_FIXTURE",
    val extractionMethod: String = "DETERMINISTIC_FOUNDATION_FIXTURE",
    val createdAt: Instant,
)


data class RecordReceipt(
    val recordId: UUID,
    val recordVersionId: UUID,
    val supersedesVersionId: UUID?,
    val candidateId: UUID,
    val documentId: UUID,
    val status: String,
    val reviewDecision: String,
    val label: String,
    val value: String,
    val originalValue: String,
    val unit: String,
    val observedOn: String,
    val confirmedAt: Instant,
    val correctionReason: String?,
    val evidencePage: Int,
    val sourceTextSha256: String,
    val documentSha256: String,
)


data class DeletionReceipt(
    val deletionId: UUID,
    val status: String,
    val auditEventTypes: List<String>,
    val rawHealthValuesPresentInAudit: Boolean,
)


@Service
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationLifecycleService(
    private val repository: FoundationRepository,
    private val documentStorage: FoundationDocumentStorage,
    private val properties: FoundationProperties,
    private val clock: Clock,
) {
    private val subjectPattern = Regex("^synthetic-[a-z0-9-]+$")
    private val idempotencyPattern = Regex("^[A-Za-z0-9._:-]{8,80}$")
    private val confirmedValuePattern = Regex("^[0-9]{1,4}(?:\\.[0-9]{1,2})?$")

    @Transactional
    fun createSession(subjectId: String, credential: String): IssuedFoundationSession {
        if (!subjectPattern.matches(subjectId)) throw FoundationBadRequestException("synthetic_subject_required")
        val expectedCredentialHash = properties.localIdentities
            .firstOrNull { identity -> identity.subjectId == subjectId }
            ?.credentialSha256
        if (
            expectedCredentialHash == null ||
            !FoundationHashing.constantTimeHexEquals(FoundationHashing.sha256(credential), expectedCredentialHash)
        ) {
            repository.insertDeniedAudit(
                subjectHash = subjectHash(subjectId),
                actorSessionHash = null,
                eventType = "LOCAL_IDENTITY_DENIED",
                resourceType = "SESSION",
                resourceId = null,
                now = Instant.now(clock),
            )
            throw FoundationForbiddenException("local_identity_denied")
        }
        val now = Instant.now(clock)
        if (!repository.ensureActiveSyntheticSubject(subjectId, now)) {
            throw FoundationForbiddenException("subject_deleted")
        }
        val rawToken = FoundationHashing.randomToken()
        val rawCsrf = FoundationHashing.randomToken()
        val sessionId = UUID.randomUUID()
        val expiresAt = now.plus(properties.sessionTtl)
        repository.createSession(
            sessionId = sessionId,
            subjectId = subjectId,
            tokenHash = FoundationHashing.sha256(rawToken),
            csrfHash = FoundationHashing.sha256(rawCsrf),
            now = now,
            expiresAt = expiresAt,
        )
        audit(subjectId, FoundationHashing.sha256(rawToken), "SESSION_CREATED", "SESSION", sessionId, "SUCCESS")
        return IssuedFoundationSession(sessionId, rawToken, rawCsrf, expiresAt)
    }

    @Transactional
    fun grantDocumentConsent(principal: FoundationPrincipal): UUID {
        repository.findActiveConsent(principal.subjectId)?.let { return it }
        val consentId = UUID.randomUUID()
        repository.grantConsent(consentId, principal.subjectId, "foundation-v1", Instant.now(clock))
        audit(principal, "CONSENT_GRANTED", "CONSENT", consentId, "SUCCESS")
        return consentId
    }

    @Transactional(readOnly = true)
    fun getDocumentConsent(principal: FoundationPrincipal): DocumentConsentReceipt {
        val consent = repository.findLatestConsent(principal.subjectId)
        return DocumentConsentReceipt(
            consentId = consent?.consentId,
            status = consent?.status ?: "NOT_GRANTED",
        )
    }

    @Transactional
    fun requestDocument(
        principal: FoundationPrincipal,
        consentId: UUID,
        mediaType: String,
        contentLength: Long,
        expectedSha256: String,
        idempotencyKey: String,
    ): IssuedDocumentTicket {
        requireIdempotencyKey(idempotencyKey)
        requireActiveConsent(principal, consentId)
        val subjectHash = subjectHash(principal.subjectId)
        repository.findIdempotentResource(subjectHash, "DOCUMENT_REQUEST", idempotencyKey)?.let { existingId ->
            val existing = requireDocument(principal, existingId)
            if (existing.status != "UPLOAD_PENDING") throw FoundationConflictException("document_intake_already_finalized")
            return issueDocumentTicket(existing)
        }
        if (mediaType != "application/pdf") throw FoundationBadRequestException("pdf_required")
        if (contentLength !in 64..10_485_760) throw FoundationBadRequestException("document_size_invalid")
        if (!expectedSha256.matches(Regex("^[0-9a-f]{64}$"))) {
            throw FoundationBadRequestException("document_digest_invalid")
        }
        if (expectedSha256 !in properties.allowedDocumentSha256) {
            throw FoundationBadRequestException("synthetic_fixture_required")
        }

        val documentId = UUID.randomUUID()
        val now = Instant.now(clock)
        val inserted = repository.insertIdempotency(
            subjectHash,
            "DOCUMENT_REQUEST",
            idempotencyKey,
            documentId,
            now,
        )
        if (!inserted) {
            val concurrentId = repository.findIdempotentResource(subjectHash, "DOCUMENT_REQUEST", idempotencyKey)
                ?: throw FoundationConflictException("idempotency_conflict")
            val concurrent = requireDocument(principal, concurrentId)
            if (concurrent.status != "UPLOAD_PENDING") {
                throw FoundationConflictException("document_intake_already_finalized")
            }
            return issueDocumentTicket(concurrent)
        }
        repository.createDocument(
            documentId,
            principal.subjectId,
            consentId,
            mediaType,
            contentLength,
            expectedSha256,
            now,
        )
        audit(principal, "DOCUMENT_REQUESTED", "DOCUMENT", documentId, "SUCCESS")
        return issueDocumentTicket(requireDocument(principal, documentId))
    }

    @Transactional
    fun uploadDocument(
        principal: FoundationPrincipal,
        documentId: UUID,
        capabilityId: UUID,
        rawCapability: String,
        content: ByteArray,
    ): DocumentReceipt {
        val document = requireDocument(principal, documentId)
        requireActiveConsent(principal, document.consentId)
        val capability = repository.findActiveUploadCapability(
            capabilityId,
            documentId,
            FoundationHashing.sha256(rawCapability),
            Instant.now(clock),
        ) ?: throw FoundationForbiddenException("upload_capability_invalid")
        if (content.size.toLong() != capability.expectedLength || content.size.toLong() != document.expectedLength) {
            throw FoundationBadRequestException("content_length_mismatch")
        }
        val digest = FoundationHashing.sha256(content)
        if (!FoundationHashing.constantTimeHexEquals(digest, capability.expectedSha256)) {
            throw FoundationBadRequestException("content_digest_mismatch")
        }
        if (document.status != "UPLOAD_PENDING") {
            if (document.sha256 == digest && document.actualLength == content.size.toLong()) return documentReceipt(document)
            throw FoundationConflictException("document_already_uploaded")
        }
        val stored = documentStorage.putUntrusted(documentId, content)
        try {
            if (stored.createdNew) {
                TransactionSynchronizationManager.registerSynchronization(
                    object : TransactionSynchronization {
                        override fun afterCompletion(status: Int) {
                            if (status != TransactionSynchronization.STATUS_COMMITTED) {
                                runCatching {
                                    documentStorage.deleteAll(
                                        listOf(StorageTrustZone.UNTRUSTED to stored.descriptor.objectKey),
                                    )
                                }
                            }
                        }
                    },
                )
            }
            val updated = repository.markDocumentUploaded(
                principal.subjectId,
                documentId,
                content.size.toLong(),
                digest,
                stored.descriptor.objectKey,
            )
            if (!updated) throw FoundationConflictException("document_state_changed")
        } catch (exception: Exception) {
            throw exception
        }
        audit(principal, "UNTRUSTED_OBJECT_RECEIVED", "DOCUMENT", documentId, "SUCCESS")
        return documentReceipt(requireDocument(principal, documentId))
    }

    @Transactional
    fun finalizeDocument(principal: FoundationPrincipal, documentId: UUID): DocumentReceipt {
        val document = requireDocument(principal, documentId)
        requireActiveConsent(principal, document.consentId)
        if (document.status != "UPLOAD_PENDING") return documentReceipt(document)
        val objectKey = document.objectKey ?: throw FoundationConflictException("document_upload_incomplete")
        val expectedSha256 = document.expectedSha256 ?: throw FoundationConflictException("document_digest_missing")
        val bytes = documentStorage.read(StorageTrustZone.UNTRUSTED, objectKey)
        if (
            bytes.size.toLong() != document.expectedLength ||
            !FoundationHashing.constantTimeHexEquals(FoundationHashing.sha256(bytes), expectedSha256)
        ) {
            throw FoundationConflictException("finalization_metadata_mismatch")
        }
        if (!repository.finalizeDocumentAndQueueInspection(
                principal.subjectId,
                documentId,
                UUID.randomUUID(),
                Instant.now(clock),
            )
        ) {
            throw FoundationConflictException("document_state_changed")
        }
        audit(principal, "DOCUMENT_FINALIZED", "DOCUMENT", documentId, "SUCCESS")
        return documentReceipt(requireDocument(principal, documentId))
    }

    @Transactional(readOnly = true)
    fun getDocument(principal: FoundationPrincipal, documentId: UUID): DocumentReceipt =
        documentReceipt(requireDocument(principal, documentId))

    @Transactional(readOnly = true)
    fun getActiveDocument(principal: FoundationPrincipal): DocumentReceipt? =
        repository.findLatestActiveDocument(principal.subjectId)?.let(::documentReceipt)

    @Transactional(readOnly = true)
    fun getCandidateForDocument(principal: FoundationPrincipal, documentId: UUID): CandidateReceipt {
        val document = requireDocument(principal, documentId)
        requireActiveConsent(principal, document.consentId)
        return repository.findCandidateForDocument(principal.subjectId, documentId)
            ?.let(::candidateReceipt)
            ?: throw FoundationNotFoundException("candidate_not_ready")
    }

    @Transactional(readOnly = true)
    fun getDocumentPreview(principal: FoundationPrincipal, documentId: UUID): ByteArray {
        val document = requireDocument(principal, documentId)
        requireActiveConsent(principal, document.consentId)
        val artifact = repository.findPreviewArtifact(principal.subjectId, documentId)
            ?: throw FoundationNotFoundException("preview_not_ready")
        val bytes = runCatching {
            documentStorage.read(StorageTrustZone.DERIVED_SAFE_ARTIFACT, artifact.objectKey)
        }.getOrElse { throw FoundationNotFoundException("preview_not_ready") }
        if (!FoundationHashing.constantTimeHexEquals(FoundationHashing.sha256(bytes), artifact.previewSha256)) {
            throw FoundationConflictException("preview_digest_mismatch")
        }
        return bytes
    }

    @Transactional(readOnly = true)
    fun getCandidate(principal: FoundationPrincipal, candidateId: UUID): CandidateReceipt =
        candidateReceipt(requireCandidate(principal, candidateId))

    @Transactional
    fun excludeCandidate(
        principal: FoundationPrincipal,
        candidateId: UUID,
        idempotencyKey: String,
    ): CandidateReceipt {
        requireIdempotencyKey(idempotencyKey)
        val candidate = requireCandidate(principal, candidateId)
        val document = requireDocument(principal, candidate.documentId)
        requireActiveConsent(principal, document.consentId)
        if (candidate.status == "EXCLUDED") return candidateReceipt(candidate)
        if (candidate.status != "PENDING") throw FoundationConflictException("candidate_not_pending")

        val subjectHash = subjectHash(principal.subjectId)
        repository.findIdempotentResource(subjectHash, "CANDIDATE_EXCLUDE", idempotencyKey)?.let { existingId ->
            return candidateReceipt(requireCandidate(principal, existingId))
        }
        if (!repository.insertIdempotency(
                subjectHash,
                "CANDIDATE_EXCLUDE",
                idempotencyKey,
                candidateId,
                Instant.now(clock),
            )
        ) {
            val existingId = repository.findIdempotentResource(subjectHash, "CANDIDATE_EXCLUDE", idempotencyKey)
                ?: throw FoundationConflictException("idempotency_conflict")
            return candidateReceipt(requireCandidate(principal, existingId))
        }
        if (!repository.excludeCandidate(principal.subjectId, candidateId, Instant.now(clock))) {
            throw FoundationConflictException("candidate_state_changed")
        }
        audit(principal, "CANDIDATE_EXCLUDED", "CANDIDATE", candidateId, "SUCCESS")
        return candidateReceipt(requireCandidate(principal, candidateId))
    }

    @Transactional
    fun confirmCandidate(
        principal: FoundationPrincipal,
        candidateId: UUID,
        confirmedValue: String,
        idempotencyKey: String,
    ): RecordReceipt {
        requireIdempotencyKey(idempotencyKey)
        if (!confirmedValuePattern.matches(confirmedValue)) throw FoundationBadRequestException("confirmed_value_invalid")
        val candidate = requireCandidate(principal, candidateId)
        val document = requireDocument(principal, candidate.documentId)
        requireActiveConsent(principal, document.consentId)
        repository.findRecordForCandidate(principal.subjectId, candidateId)?.let { return recordReceipt(it) }
        if (candidate.status != "PENDING") throw FoundationConflictException("candidate_not_pending")

        val subjectHash = subjectHash(principal.subjectId)
        repository.findIdempotentResource(subjectHash, "CANDIDATE_CONFIRM", idempotencyKey)?.let { recordId ->
            return recordReceipt(requireRecord(principal, recordId))
        }
        val recordId = UUID.randomUUID()
        val now = Instant.now(clock)
        if (!repository.insertIdempotency(subjectHash, "CANDIDATE_CONFIRM", idempotencyKey, recordId, now)) {
            val concurrentId = repository.findIdempotentResource(subjectHash, "CANDIDATE_CONFIRM", idempotencyKey)
                ?: throw FoundationConflictException("idempotency_conflict")
            return recordReceipt(requireRecord(principal, concurrentId))
        }
        repository.createRecordFromCandidate(recordId, UUID.randomUUID(), candidate, confirmedValue, now)
        audit(
            principal,
            if (confirmedValue == candidate.candidateValue) "CANDIDATE_CONFIRMED" else "CANDIDATE_CORRECTED",
            "RECORD",
            recordId,
            "SUCCESS",
        )
        return recordReceipt(requireRecord(principal, recordId))
    }

    @Transactional
    fun getRecord(principal: FoundationPrincipal, recordId: UUID): RecordReceipt =
        recordReceipt(requireRecord(principal, recordId))

    @Transactional
    fun listRecords(principal: FoundationPrincipal): List<RecordReceipt> =
        repository.listRecords(principal.subjectId).map(::recordReceipt)

    @Transactional
    fun correctRecord(
        principal: FoundationPrincipal,
        recordId: UUID,
        correctedValue: String,
        reason: String,
        idempotencyKey: String,
    ): RecordReceipt {
        requireIdempotencyKey(idempotencyKey)
        if (!confirmedValuePattern.matches(correctedValue)) {
            throw FoundationBadRequestException("confirmed_value_invalid")
        }
        val normalizedReason = reason.trim()
        if (normalizedReason.isEmpty() || normalizedReason.length > 200) {
            throw FoundationBadRequestException("correction_reason_invalid")
        }
        val current = requireRecord(principal, recordId)
        val candidate = requireCandidate(principal, current.candidateId)
        val document = requireDocument(principal, candidate.documentId)
        requireActiveConsent(principal, document.consentId)

        val subjectHash = subjectHash(principal.subjectId)
        repository.findIdempotentResource(subjectHash, "RECORD_CORRECT", idempotencyKey)?.let { versionId ->
            return recordReceipt(
                repository.findRecordVersion(principal.subjectId, versionId)
                    ?: throw FoundationConflictException("idempotency_resource_missing"),
            )
        }
        val newVersionId = UUID.randomUUID()
        val now = Instant.now(clock)
        if (!repository.insertIdempotency(subjectHash, "RECORD_CORRECT", idempotencyKey, newVersionId, now)) {
            val existingVersionId = repository.findIdempotentResource(subjectHash, "RECORD_CORRECT", idempotencyKey)
                ?: throw FoundationConflictException("idempotency_conflict")
            return recordReceipt(
                repository.findRecordVersion(principal.subjectId, existingVersionId)
                    ?: throw FoundationConflictException("idempotency_resource_missing"),
            )
        }
        if (!repository.correctRecord(
                principal.subjectId,
                recordId,
                current.recordVersionId,
                newVersionId,
                correctedValue,
                normalizedReason,
                now,
            )
        ) {
            throw FoundationConflictException("record_state_changed")
        }
        audit(principal, "RECORD_CORRECTED", "RECORD", recordId, "SUCCESS")
        return recordReceipt(requireRecord(principal, recordId))
    }

    @Transactional
    fun revokeConsent(principal: FoundationPrincipal, consentId: UUID): UUID {
        if (!repository.consentBelongsToSubject(principal.subjectId, consentId)) {
            audit(principal, "CONSENT_ACCESS_DENIED", "CONSENT", consentId, "DENIED")
            throw FoundationNotFoundException("consent_not_found")
        }
        val now = Instant.now(clock)
        if (repository.revokeConsent(principal.subjectId, consentId, now)) {
            repository.terminateDocumentJobsForRevokedConsent(principal.subjectId, consentId, now)
            audit(principal, "CONSENT_REVOKED", "CONSENT", consentId, "SUCCESS")
        }
        return consentId
    }

    @Transactional
    fun deleteProfile(principal: FoundationPrincipal): DeletionReceipt {
        val subjectHash = subjectHash(principal.subjectId)
        val objectKeys = repository.listObjectKeys(principal.subjectId)
        documentStorage.deleteAll(objectKeys)
        audit(principal, "PROFILE_DELETION_REQUESTED", "PROFILE", null, "SUCCESS")
        val deletionId = repository.completeDeletion(
            principal.subjectId,
            subjectHash,
            UUID.randomUUID(),
            Instant.now(clock),
        )
        repository.insertAudit(
            subjectHash,
            null,
            "PROFILE_DELETED",
            "PROFILE",
            deletionId,
            "SUCCESS",
            Instant.now(clock),
        )
        return DeletionReceipt(
            deletionId = deletionId,
            status = "COMPLETED",
            auditEventTypes = repository.listAuditEventTypes(subjectHash),
            rawHealthValuesPresentInAudit = repository.countRawHealthValuesInAudit() > 0,
        )
    }

    private fun requireDocument(principal: FoundationPrincipal, documentId: UUID): FoundationDocumentRow =
        repository.findDocument(principal.subjectId, documentId)
            ?: deniedNotFound(principal, "DOCUMENT_ACCESS_DENIED", "DOCUMENT", documentId, "document_not_found")

    private fun requireCandidate(principal: FoundationPrincipal, candidateId: UUID): FoundationCandidateRow =
        repository.findCandidate(principal.subjectId, candidateId)
            ?: deniedNotFound(principal, "CANDIDATE_ACCESS_DENIED", "CANDIDATE", candidateId, "candidate_not_found")

    private fun requireRecord(principal: FoundationPrincipal, recordId: UUID): FoundationRecordRow =
        repository.findRecord(principal.subjectId, recordId)
            ?: deniedNotFound(principal, "RECORD_ACCESS_DENIED", "RECORD", recordId, "record_not_found")

    private fun requireActiveConsent(principal: FoundationPrincipal, consentId: UUID) {
        val status = repository.findConsentStatus(principal.subjectId, consentId)
        if (status != "ACTIVE") {
            audit(principal, "CONSENT_REQUIRED", "CONSENT", consentId, "DENIED")
            throw FoundationForbiddenException(if (status == "REVOKED") "consent_revoked" else "active_consent_required")
        }
    }

    private fun requireIdempotencyKey(idempotencyKey: String) {
        if (!idempotencyPattern.matches(idempotencyKey)) {
            throw FoundationBadRequestException("idempotency_key_invalid")
        }
    }

    private fun issueDocumentTicket(document: FoundationDocumentRow): IssuedDocumentTicket {
        val expectedSha256 = document.expectedSha256
            ?: throw FoundationConflictException("document_digest_missing")
        val rawCapability = FoundationHashing.randomToken()
        val capabilityId = UUID.randomUUID()
        val issuedAt = Instant.now(clock)
        val expiresAt = issuedAt.plus(properties.uploadCapabilityTtl)
        repository.rotateUploadCapability(
            capabilityId = capabilityId,
            documentId = document.documentId,
            tokenHash = FoundationHashing.sha256(rawCapability),
            expectedLength = document.expectedLength,
            expectedSha256 = expectedSha256,
            issuedAt = issuedAt,
            expiresAt = expiresAt,
        )
        return IssuedDocumentTicket(
            document = documentReceipt(document),
            uploadCapability = BoundedUploadCapability(
                capabilityId = capabilityId,
                method = "PUT",
                uploadPath = "/api/foundation/documents/${document.documentId}/content",
                expiresAt = expiresAt,
                expectedLength = document.expectedLength,
                expectedSha256 = expectedSha256,
                requiredHeaders = mapOf(
                    "Content-Type" to "application/pdf",
                    "X-GC-Upload-Capability-Id" to capabilityId.toString(),
                    "X-GC-Upload-Capability" to rawCapability,
                ),
            ),
        )
    }

    private fun documentReceipt(document: FoundationDocumentRow): DocumentReceipt =
        DocumentReceipt(
            documentId = document.documentId,
            status = document.status,
            sha256 = document.sha256,
            contentLength = document.actualLength,
            stateVersion = document.stateVersion,
            failureCode = document.failureCode,
            previewAvailable = document.previewObjectKey != null,
        )

    private fun candidateReceipt(candidate: FoundationCandidateRow): CandidateReceipt =
        CandidateReceipt(
            candidateId = candidate.candidateId,
            documentId = candidate.documentId,
            status = candidate.status,
            label = candidate.label,
            value = candidate.candidateValue,
            unit = candidate.unit,
            observedOn = candidate.observedOn.toString(),
            evidencePage = candidate.evidencePage,
            sourceTextSha256 = candidate.sourceTextSha256,
            documentSha256 = candidate.documentSha256,
            createdAt = candidate.createdAt,
        )

    private fun recordReceipt(record: FoundationRecordRow): RecordReceipt =
        RecordReceipt(
            recordId = record.recordId,
            recordVersionId = record.recordVersionId,
            supersedesVersionId = record.supersedesVersionId,
            candidateId = record.candidateId,
            documentId = record.documentId,
            status = record.status,
            reviewDecision = if (record.currentValue == record.originalValue) "CONFIRMED" else "CORRECTED",
            label = record.label,
            value = record.currentValue,
            originalValue = record.originalValue,
            unit = record.unit,
            observedOn = record.observedOn.toString(),
            confirmedAt = record.confirmedAt,
            correctionReason = record.correctionReason,
            evidencePage = record.evidencePage,
            sourceTextSha256 = record.sourceTextSha256,
            documentSha256 = record.documentSha256,
        )

    private fun subjectHash(subjectId: String): String =
        FoundationHashing.sha256("${properties.auditPepper}:$subjectId")

    private fun audit(
        principal: FoundationPrincipal,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
    ) {
        audit(principal.subjectId, principal.sessionTokenHash, eventType, resourceType, resourceId, outcome)
    }

    private fun audit(
        subjectId: String,
        sessionHash: String?,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
    ) {
        if (outcome == "DENIED") {
            repository.insertDeniedAudit(
                subjectHash(subjectId),
                sessionHash,
                eventType,
                resourceType,
                resourceId,
                Instant.now(clock),
            )
        } else {
            repository.insertAudit(
                subjectHash(subjectId),
                sessionHash,
                eventType,
                resourceType,
                resourceId,
                outcome,
                Instant.now(clock),
            )
        }
    }

    private fun <T> deniedNotFound(
        principal: FoundationPrincipal,
        eventType: String,
        resourceType: String,
        resourceId: UUID,
        code: String,
    ): T {
        audit(principal, eventType, resourceType, resourceId, "DENIED")
        throw FoundationNotFoundException(code)
    }
}
