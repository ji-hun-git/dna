package kr.co.genomecompanion.foundation

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.nio.file.Files
import java.nio.file.StandardOpenOption
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


data class DocumentReceipt(
    val documentId: UUID,
    val status: String,
    val sha256: String?,
    val contentLength: Long?,
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
)


data class RecordReceipt(
    val recordId: UUID,
    val candidateId: UUID,
    val documentId: UUID,
    val label: String,
    val value: String,
    val unit: String,
    val observedOn: String,
    val confirmedAt: Instant,
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

    @Transactional
    fun requestDocument(
        principal: FoundationPrincipal,
        consentId: UUID,
        mediaType: String,
        contentLength: Long,
        idempotencyKey: String,
    ): DocumentReceipt {
        requireIdempotencyKey(idempotencyKey)
        requireActiveConsent(principal, consentId)
        val subjectHash = subjectHash(principal.subjectId)
        repository.findIdempotentResource(subjectHash, "DOCUMENT_REQUEST", idempotencyKey)?.let { existingId ->
            return documentReceipt(requireDocument(principal, existingId))
        }
        if (mediaType != "application/pdf") throw FoundationBadRequestException("pdf_required")
        if (contentLength !in 8..10_485_760) throw FoundationBadRequestException("document_size_invalid")

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
            return documentReceipt(requireDocument(principal, concurrentId))
        }
        repository.createDocument(documentId, principal.subjectId, consentId, mediaType, contentLength, now)
        audit(principal, "DOCUMENT_REQUESTED", "DOCUMENT", documentId, "SUCCESS")
        return documentReceipt(requireDocument(principal, documentId))
    }

    @Transactional
    fun uploadDocument(
        principal: FoundationPrincipal,
        documentId: UUID,
        content: ByteArray,
    ): DocumentReceipt {
        val document = requireDocument(principal, documentId)
        requireActiveConsent(principal, document.consentId)
        if (content.size.toLong() != document.expectedLength) throw FoundationBadRequestException("content_length_mismatch")
        val digest = FoundationHashing.sha256(content)

        if (document.status != "REQUESTED") {
            if (document.sha256 == digest && document.actualLength == content.size.toLong()) return documentReceipt(document)
            throw FoundationConflictException("document_already_uploaded")
        }

        val root = properties.quarantineRoot!!.toAbsolutePath().normalize()
        Files.createDirectories(root)
        val objectPath = root.resolve("$documentId.pdf").normalize()
        if (!objectPath.startsWith(root)) throw FoundationForbiddenException("object_path_denied")
        try {
            Files.write(objectPath, content, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
            TransactionSynchronizationManager.registerSynchronization(
                object : TransactionSynchronization {
                    override fun afterCompletion(status: Int) {
                        if (status != TransactionSynchronization.STATUS_COMMITTED) {
                            runCatching { Files.deleteIfExists(objectPath) }
                        }
                    }
                },
            )
            val updated = repository.markDocumentQuarantined(
                principal.subjectId,
                documentId,
                content.size.toLong(),
                digest,
                objectPath.fileName.toString(),
            )
            if (!updated) throw FoundationConflictException("document_state_changed")
        } catch (exception: Exception) {
            Files.deleteIfExists(objectPath)
            throw exception
        }
        audit(principal, "DOCUMENT_QUARANTINED", "DOCUMENT", documentId, "SUCCESS")
        return documentReceipt(requireDocument(principal, documentId))
    }

    @Transactional
    fun inspectDocument(principal: FoundationPrincipal, documentId: UUID): DocumentReceipt {
        val document = requireDocument(principal, documentId)
        requireActiveConsent(principal, document.consentId)
        if (document.status == "INSPECTED" || document.status == "REJECTED") return documentReceipt(document)
        if (document.status != "QUARANTINED") throw FoundationConflictException("document_not_quarantined")

        val content = readDocument(document)
        val digest = FoundationHashing.sha256(content)
        val hasPdfMagic = content.size >= 5 && content.copyOfRange(0, 5).contentEquals("%PDF-".toByteArray())
        val accepted = hasPdfMagic &&
            digest == document.sha256 &&
            digest in properties.allowedDocumentSha256
        repository.markDocumentInspected(principal.subjectId, documentId, accepted, Instant.now(clock))
        audit(
            principal,
            if (accepted) "DOCUMENT_INSPECTED" else "DOCUMENT_REJECTED",
            "DOCUMENT",
            documentId,
            if (accepted) "SUCCESS" else "REJECTED",
        )
        return documentReceipt(requireDocument(principal, documentId))
    }

    @Transactional
    fun extractCandidate(principal: FoundationPrincipal, documentId: UUID): CandidateReceipt {
        val document = requireDocument(principal, documentId)
        requireActiveConsent(principal, document.consentId)
        repository.findCandidateForDocument(principal.subjectId, documentId)?.let { return candidateReceipt(it) }
        if (document.status != "INSPECTED") throw FoundationConflictException("document_not_inspected")
        val candidateId = UUID.randomUUID()
        repository.createCompletedExtraction(
            jobId = UUID.randomUUID(),
            candidateId = candidateId,
            document = document,
            now = Instant.now(clock),
            sourceTextSha256 = FoundationHashing.sha256("총콜레스테롤|188|mg/dL|2026-07-28"),
        )
        audit(principal, "CANDIDATE_CREATED", "CANDIDATE", candidateId, "SUCCESS")
        return candidateReceipt(
            repository.findCandidate(principal.subjectId, candidateId)
                ?: error("candidate insert did not persist"),
        )
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
        repository.createRecordFromCandidate(recordId, candidate, confirmedValue, now)
        audit(principal, "CANDIDATE_CONFIRMED", "RECORD", recordId, "SUCCESS")
        return recordReceipt(requireRecord(principal, recordId))
    }

    @Transactional
    fun getRecord(principal: FoundationPrincipal, recordId: UUID): RecordReceipt =
        recordReceipt(requireRecord(principal, recordId))

    @Transactional
    fun listRecords(principal: FoundationPrincipal): List<RecordReceipt> =
        repository.listRecords(principal.subjectId).map(::recordReceipt)

    @Transactional
    fun revokeConsent(principal: FoundationPrincipal, consentId: UUID): UUID {
        if (!repository.consentBelongsToSubject(principal.subjectId, consentId)) {
            audit(principal, "CONSENT_ACCESS_DENIED", "CONSENT", consentId, "DENIED")
            throw FoundationNotFoundException("consent_not_found")
        }
        if (repository.revokeConsent(principal.subjectId, consentId, Instant.now(clock))) {
            audit(principal, "CONSENT_REVOKED", "CONSENT", consentId, "SUCCESS")
        }
        return consentId
    }

    @Transactional
    fun deleteProfile(principal: FoundationPrincipal): DeletionReceipt {
        val subjectHash = subjectHash(principal.subjectId)
        val objectKeys = repository.listObjectKeys(principal.subjectId)
        val root = properties.quarantineRoot!!.toAbsolutePath().normalize()
        objectKeys.forEach { objectKey ->
            val path = root.resolve(objectKey).normalize()
            if (!path.startsWith(root)) throw FoundationForbiddenException("object_path_denied")
            Files.deleteIfExists(path)
        }
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

    private fun readDocument(document: FoundationDocumentRow): ByteArray {
        val objectKey = document.objectKey ?: throw FoundationConflictException("document_object_missing")
        val root = properties.quarantineRoot!!.toAbsolutePath().normalize()
        val path = root.resolve(objectKey).normalize()
        if (!path.startsWith(root)) throw FoundationForbiddenException("object_path_denied")
        if (!Files.isRegularFile(path)) throw FoundationConflictException("document_object_missing")
        return Files.readAllBytes(path)
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
        if (!repository.isConsentActive(principal.subjectId, consentId)) {
            audit(principal, "CONSENT_REQUIRED", "CONSENT", consentId, "DENIED")
            throw FoundationForbiddenException("active_consent_required")
        }
    }

    private fun requireIdempotencyKey(idempotencyKey: String) {
        if (!idempotencyPattern.matches(idempotencyKey)) {
            throw FoundationBadRequestException("idempotency_key_invalid")
        }
    }

    private fun documentReceipt(document: FoundationDocumentRow): DocumentReceipt =
        DocumentReceipt(document.documentId, document.status, document.sha256, document.actualLength)

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
        )

    private fun recordReceipt(record: FoundationRecordRow): RecordReceipt =
        RecordReceipt(
            recordId = record.recordId,
            candidateId = record.candidateId,
            documentId = record.documentId,
            label = record.label,
            value = record.confirmedValue,
            unit = record.unit,
            observedOn = record.observedOn.toString(),
            confirmedAt = record.confirmedAt,
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
