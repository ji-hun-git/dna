package kr.co.genomecompanion.foundation

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonUnwrapped
import kr.co.genomecompanion.documentboundary.BoundedUploadCapability
import kr.co.genomecompanion.documentboundary.MedicalConcept
import kr.co.genomecompanion.documentboundary.StorageTrustZone
import kr.co.genomecompanion.platform.telemetry.TelemetryEvent
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID


class FoundationBadRequestException(val code: String) : RuntimeException(code)
class FoundationForbiddenException(val code: String) : RuntimeException(code)
class FoundationNotFoundException(val code: String) : RuntimeException(code)
class FoundationConflictException(val code: String) : RuntimeException(code)
class FoundationUnprocessableException(val code: String) : RuntimeException(code)
class FoundationRateLimitedException(val code: String = "rate_limited", val retryAfterSeconds: Long = 60) : RuntimeException(code)

/**
 * The person's own data set is larger than one response may carry. Distinct from
 * [RequestBodyLimitFilter]'s `payload_too_large` (an oversized *request*): this one refuses to *build*
 * a response — an export or a whole-history aggregate — so a single call can never be made to read
 * unbounded rows, and the paged endpoints stay the only way through a large history.
 */
class FoundationPayloadCapException(val code: String = "payload_cap_exceeded") : RuntimeException(code)

/** Largest page `/records` and `/health-events` will serve, and the default when `limit` is absent. */
const val MAX_PAGE_LIMIT = 200

/** Whole-history reads (both exports, `/changes`, `/series`) refuse above these sizes. */
const val MAX_EXPORT_RECORDS = 5_000L
const val MAX_EXPORT_DOCUMENTS = 200L


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

/** One purpose as the person sees it. NOT_GRANTED rows have no id and no instants. */
data class ConsentReceipt(
    val consentId: UUID?,
    val purposeCode: String,
    val status: String,
    val policyVersion: String,
    val grantedAt: Instant?,
    val revokedAt: Instant?,
)


data class DocumentReceipt(
    val documentId: UUID,
    val status: String,
    val sha256: String?,
    val contentLength: Long?,
    val stateVersion: Long,
    val failureCode: String?,
    val previewAvailable: Boolean,
    val abstentions: List<ExtractionAbstention> = emptyList(),
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
    val ordinal: Int,
    val totalCandidates: Int,
    val label: String,
    val value: String,
    val unit: String,
    val observedOn: String,
    val evidencePage: Int,
    val sourceTextSha256: String,
    val documentSha256: String,
    val conceptCode: String?,
    val evidenceBox: EvidenceBox?,
    val sourceType: String = "DOCUMENT_TEXT_LAYER",
    val extractionMethod: String = "native-text",
    val createdAt: Instant,
    val originalLabel: String? = null,
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
    val originalObservedOn: String,
    val confirmedAt: Instant,
    val correctionReason: String?,
    val evidencePage: Int,
    val sourceTextSha256: String,
    val documentSha256: String,
    val conceptCode: String?,
    val originalLabel: String? = null,
)


data class DeletionReceipt(
    val deletionId: UUID,
    val status: String,
    val auditEventTypes: List<String>,
    val rawHealthValuesPresentInAudit: Boolean,
)

/** One source document of the export: id, exam date when all its events share one, status, abstentions, event count. */
data class ExportedDocument(
    val documentId: UUID,
    val observedOn: String?,
    val status: String,
    val abstentions: List<ExtractionAbstention>,
    val eventCount: Int,
)

/**
 * A HealthEvent plus the document's own reference-range text. The text appears only here, in the
 * person's own file, exactly as printed; it is never displayed, compared or interpreted.
 */
data class ExportedHealthEvent(
    @get:JsonUnwrapped val event: HealthEvent,
    @get:JsonInclude(JsonInclude.Include.ALWAYS)
    val referenceRangeText: String?,
)

/**
 * The person's own events as one file. Same read-model as GET /health-events plus the verbatim range text.
 * v3 adds `originalLabel`.
 */
data class HealthEventExport(
    val schemaVersion: String = "alm-health-events-export.v3",
    val exportedAt: Instant,
    val subjectKind: String = "synthetic",
    val events: List<ExportedHealthEvent>,
    val documents: List<ExportedDocument>,
)

/**
 * The export body plus the filename computed from the same instant as `exportedAt`, so the
 * `Content-Disposition` date and the JSON's own `exportedAt` can never disagree about which
 * side of midnight the export happened on.
 */
data class HealthEventExportEnvelope(
    val filename: String,
    val export: HealthEventExport,
)

/** One page of `/records` plus the cursor for the next one (`null` when this page is the last). */
data class RecordPage(val items: List<RecordReceipt>, val nextAfter: UUID?)

/** One page of `/health-events`; the cursor is a *record* cursor, so both endpoints share it. */
data class HealthEventPage(val items: List<HealthEvent>, val nextAfter: UUID?)


@Service
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationLifecycleService(
    private val repository: FoundationRepository,
    private val documentStorage: FoundationDocumentStorage,
    private val properties: FoundationProperties,
    private val clock: Clock,
    private val conceptSource: MedicalConceptSource,
    private val rateLimiter: SessionRateLimiter,
    private val logging: FoundationLogging,
) {
    private val subjectPattern = Regex("^synthetic-[a-z0-9-]+$")
    private val idempotencyPattern = Regex("^[A-Za-z0-9._:-]{8,80}$")
    private val confirmedValuePattern = Regex(CONFIRMED_VALUE_PATTERN)
    private val seoul: ZoneId = ZoneId.of("Asia/Seoul")
    private val earliestObservedOn: LocalDate = LocalDate.of(1900, 1, 1)
    private val idempotencyTtl: Duration = Duration.ofHours(24)

    /** The seed-only concept table, read once per process: LOINC code, export flag and canonical unit. */
    private val conceptByCode: Map<String, MedicalConcept> by lazy {
        conceptSource.concepts().associateBy { it.conceptCode }
    }

    @Transactional
    fun createSession(subjectId: String, credential: String, clientIp: String): IssuedFoundationSession {
        if (!subjectPattern.matches(subjectId)) throw FoundationBadRequestException("synthetic_subject_required")
        val subjectKey = subjectHash(subjectId)
        if (rateLimiter.isLocked(subjectKey, clientIp)) {
            throw FoundationRateLimitedException("login_locked", properties.sessionFailureLockDuration.seconds)
        }
        if (!rateLimiter.tryAcquire(subjectKey, clientIp)) throw FoundationRateLimitedException()
        val expectedCredentialHash = properties.localIdentities
            .firstOrNull { identity -> identity.subjectId == subjectId }
            ?.credentialSha256
        if (expectedCredentialHash == null) {
            // Unknown subject: count it toward the lock, write nothing — an audit row would record
            // an attacker-chosen subject hash for a name nobody configured.
            rateLimiter.recordFailure(subjectKey, clientIp)
            throw FoundationForbiddenException("local_identity_denied")
        }
        if (!FoundationHashing.constantTimeHexEquals(FoundationHashing.sha256(credential), expectedCredentialHash)) {
            rateLimiter.recordFailure(subjectKey, clientIp)
            repository.insertDeniedAudit(
                subjectHash = subjectKey,
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
        rateLimiter.recordSuccess(subjectKey, clientIp)
        return issueSession(subjectId, now, "/api/foundation/session")
    }

    /**
     * Ends exactly the calling session server-side. Expiring the cookies alone would leave a stolen
     * token usable for the rest of its TTL, so the row is revoked and `findActiveSession` stops
     * matching it.
     */
    @Transactional
    fun logout(principal: FoundationPrincipal) {
        if (repository.revokeSession(principal.sessionId, Instant.now(clock))) {
            audit(principal, "SESSION_ENDED", "SESSION", principal.sessionId, "SUCCESS")
            logging.event(TelemetryEvent.SESSION_ENDED, "/api/foundation/session/logout", subjectHash(principal.subjectId))
        }
    }

    @Transactional
    fun bootstrapDemo(): Pair<String, IssuedFoundationSession> {
        if (!properties.demoBootstrapEnabled) throw FoundationForbiddenException("demo_bootstrap_disabled")
        val now = Instant.now(clock)
        when (repository.reserveDemoBootstrap(now)) {
            DemoBootstrapBudget.CAPACITY_EXHAUSTED -> throw FoundationForbiddenException("demo_capacity_exhausted")
            DemoBootstrapBudget.RATE_LIMITED -> throw FoundationRateLimitedException()
            DemoBootstrapBudget.AVAILABLE -> Unit
        }
        // No caller-chosen identity, reusable credential, implicit consent, or shared demo account.
        val subjectId = "synthetic-demo-${UUID.randomUUID()}"
        check(repository.ensureActiveSyntheticSubject(subjectId, now))
        return subjectId to issueSession(subjectId, now, "/api/foundation/demo-session")
    }

    private fun issueSession(subjectId: String, now: Instant, routeTemplate: String): IssuedFoundationSession {
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
        logging.event(TelemetryEvent.SESSION_CREATED, routeTemplate, subjectHash(subjectId))
        return IssuedFoundationSession(sessionId, rawToken, rawCsrf, expiresAt)
    }

    @Transactional
    fun grantDocumentConsent(principal: FoundationPrincipal): UUID =
        checkNotNull(grantConsent(principal, ConsentPurpose.DOCUMENT_EXTRACTION, idempotencyKey = null).consentId)

    @Transactional(readOnly = true)
    fun getDocumentConsent(principal: FoundationPrincipal): DocumentConsentReceipt {
        val consent = repository.findLatestConsent(principal.subjectId, ConsentPurpose.DOCUMENT_EXTRACTION)
        return DocumentConsentReceipt(
            consentId = consent?.consentId,
            status = consent?.status ?: "NOT_GRANTED",
        )
    }

    /**
     * Grants one purpose. An ACTIVE row for the same purpose is returned as-is (no second row, no second
     * audit); a replayed Idempotency-Key returns the row it created even after revocation.
     */
    @Transactional
    fun grantConsent(principal: FoundationPrincipal, purposeCode: String, idempotencyKey: String?): ConsentReceipt {
        if (!ConsentPurpose.isValid(purposeCode)) throw FoundationBadRequestException("consent_purpose_invalid")
        idempotencyKey?.let(::requireIdempotencyKey)
        val subjectHash = subjectHash(principal.subjectId)
        val operation = consentGrantOperation(purposeCode)
        if (idempotencyKey != null) {
            // The key is unique per subject+operation, so a different purpose never collides in storage;
            // but a client that reuses the same key across purposes is almost certainly a bug, so reject
            // it explicitly instead of silently minting a second, unrelated consent under the same key.
            repository.findConsentGrantOperationForKey(subjectHash, idempotencyKey)?.let { existingOperation ->
                if (existingOperation != operation) throw FoundationConflictException("idempotency_key_reused")
            }
        }
        repository.findActiveConsent(principal.subjectId, purposeCode)?.let { activeId ->
            return consentReceipt(checkNotNull(repository.findConsent(principal.subjectId, activeId)))
        }
        val consentId = UUID.randomUUID()
        val now = Instant.now(clock)
        if (idempotencyKey != null) {
            replayOrClaim(subjectHash, operation, idempotencyKey, consentId, requestHash(operation, purposeCode), now)?.let { existingId ->
                return consentReceipt(
                    repository.findConsent(principal.subjectId, existingId)
                        ?: throw FoundationConflictException("idempotency_resource_missing"),
                )
            }
        }
        repository.grantConsent(consentId, principal.subjectId, purposeCode, ConsentPurpose.policyVersion(purposeCode), now)
        audit(principal, "CONSENT_GRANTED", "CONSENT", consentId, "SUCCESS", purposeCode)
        logging.event(TelemetryEvent.CONSENT_GRANTED, "/api/foundation/consents/{purposeCode}", subjectHash)
        return consentReceipt(checkNotNull(repository.findConsent(principal.subjectId, consentId)))
    }

    /** Idempotency operation scoped by purpose, so a replayed key for one purpose never returns another's receipt. */
    private fun consentGrantOperation(purposeCode: String): String = "CONSENT_GRANT:$purposeCode"

    /** The three fixed purposes in fixed order (NOT_GRANTED when absent), then every PROJECT purpose that exists. */
    @Transactional(readOnly = true)
    fun listConsents(principal: FoundationPrincipal): List<ConsentReceipt> {
        val latest = repository.listLatestConsents(principal.subjectId).associateBy { it.purposeCode }
        val fixed = ConsentPurpose.FIXED_ORDER.map { purposeCode ->
            latest[purposeCode]?.let(::consentReceipt) ?: ConsentReceipt(
                consentId = null,
                purposeCode = purposeCode,
                status = "NOT_GRANTED",
                policyVersion = ConsentPurpose.policyVersion(purposeCode),
                grantedAt = null,
                revokedAt = null,
            )
        }
        val projects = latest.keys
            .filter { it.startsWith(ConsentPurpose.PROJECT_PREFIX) }
            .sorted()
            .map { consentReceipt(latest.getValue(it)) }
        return fixed + projects
    }

    private fun consentReceipt(row: FoundationConsentRow): ConsentReceipt =
        ConsentReceipt(
            consentId = row.consentId,
            purposeCode = row.purposeCode,
            status = row.status,
            policyVersion = row.policyVersion,
            grantedAt = row.grantedAt,
            revokedAt = row.revokedAt,
        )

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
        if (mediaType != "application/pdf") throw FoundationBadRequestException("pdf_required")
        if (contentLength !in 64..10_485_760) throw FoundationBadRequestException("document_size_invalid")
        if (!expectedSha256.matches(Regex("^[0-9a-f]{64}$"))) {
            throw FoundationBadRequestException("document_digest_invalid")
        }
        if (expectedSha256 !in properties.allowedDocumentSha256) {
            throw FoundationBadRequestException("synthetic_fixture_required")
        }

        val subjectHash = subjectHash(principal.subjectId)
        val documentId = UUID.randomUUID()
        val now = Instant.now(clock)
        val requestSha256 = requestHash("DOCUMENT_REQUEST", "", "$consentId|$mediaType|$contentLength|$expectedSha256")
        replayOrClaim(subjectHash, "DOCUMENT_REQUEST", idempotencyKey, documentId, requestSha256, now)?.let { existingId ->
            val existing = requireDocument(principal, existingId)
            if (existing.status != "UPLOAD_PENDING") throw FoundationConflictException("document_intake_already_finalized")
            return issueDocumentTicket(existing)
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
        logging.event(TelemetryEvent.DOCUMENT_REQUESTED, "/api/foundation/documents", subjectHash)
        return issueDocumentTicket(requireDocument(principal, documentId))
    }

    @Transactional
    fun uploadDocument(
        principal: FoundationPrincipal,
        documentId: UUID,
        capabilityId: UUID,
        rawCapability: String,
        content: java.io.InputStream,
        declaredLength: Long,
    ): DocumentReceipt {
        val document = repository.lockDocument(principal.subjectId, documentId)
            ?: deniedNotFound(principal, "DOCUMENT_ACCESS_DENIED", "DOCUMENT", documentId, "document_not_found")
        requireActiveConsent(principal, document.consentId)
        val capability = repository.findActiveUploadCapability(
            capabilityId,
            documentId,
            FoundationHashing.sha256(rawCapability),
            Instant.now(clock),
        ) ?: throw FoundationForbiddenException("upload_capability_invalid")
        if (declaredLength != capability.expectedLength || declaredLength != document.expectedLength) {
            throw FoundationBadRequestException("content_length_mismatch")
        }
        // Streams straight to disk (never buffers the whole body): verifies exact length and digest
        // against the capability's expectations as it writes, throwing content_length_mismatch /
        // content_digest_mismatch without ever holding the full content in memory.
        val stored = documentStorage.putUntrusted(documentId, content, declaredLength, capability.expectedSha256)
        val digest = stored.descriptor.sha256
        if (document.status != "UPLOAD_PENDING") {
            if (document.sha256 == digest && document.actualLength == stored.descriptor.size) return documentReceipt(document)
            throw FoundationConflictException("document_already_uploaded")
        }
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
                stored.descriptor.size,
                digest,
                stored.descriptor.objectKey,
            )
            if (!updated) throw FoundationConflictException("document_state_changed")
        } catch (exception: Exception) {
            throw exception
        }
        audit(principal, "UNTRUSTED_OBJECT_RECEIVED", "DOCUMENT", documentId, "SUCCESS")
        logging.event(
            TelemetryEvent.DOCUMENT_UPLOADED,
            "/api/foundation/documents/{documentId}/content",
            subjectHash(principal.subjectId),
        )
        return documentReceipt(requireDocument(principal, documentId))
    }

    @Transactional
    fun finalizeDocument(principal: FoundationPrincipal, documentId: UUID): DocumentReceipt {
        val document = repository.lockDocument(principal.subjectId, documentId)
            ?: deniedNotFound(principal, "DOCUMENT_ACCESS_DENIED", "DOCUMENT", documentId, "document_not_found")
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
        logging.event(
            TelemetryEvent.DOCUMENT_FINALIZED,
            "/api/foundation/documents/{documentId}/finalization",
            subjectHash(principal.subjectId),
        )
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
    fun listCandidatesForDocument(principal: FoundationPrincipal, documentId: UUID): List<CandidateReceipt> {
        val document = requireDocument(principal, documentId)
        requireActiveConsent(principal, document.consentId)
        val candidates = repository.listCandidatesForDocument(principal.subjectId, documentId)
        if (candidates.isEmpty()) throw FoundationNotFoundException("candidate_not_ready")
        return candidates.map(::candidateReceipt)
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
        val candidate = repository.lockCandidate(principal.subjectId, candidateId)
            ?: deniedNotFound(principal, "CANDIDATE_ACCESS_DENIED", "CANDIDATE", candidateId, "candidate_not_found")
        val document = requireDocument(principal, candidate.documentId)
        requireActiveConsent(principal, document.consentId)
        if (candidate.status == "EXCLUDED") return candidateReceipt(candidate)
        if (candidate.status != "PENDING") throw FoundationConflictException("candidate_not_pending")

        val subjectHash = subjectHash(principal.subjectId)
        val now = Instant.now(clock)
        replayOrClaim(subjectHash, "CANDIDATE_EXCLUDE", idempotencyKey, candidateId, requestHash("CANDIDATE_EXCLUDE", candidateId.toString()), now)?.let { existingId ->
            return candidateReceipt(requireCandidate(principal, existingId))
        }
        if (!repository.excludeCandidate(principal.subjectId, candidateId, now)) {
            throw FoundationConflictException("candidate_state_changed")
        }
        audit(principal, "CANDIDATE_EXCLUDED", "CANDIDATE", candidateId, "SUCCESS")
        logging.event(TelemetryEvent.CANDIDATE_EXCLUDED, "/api/foundation/candidates/{candidateId}/exclusion", subjectHash)
        return candidateReceipt(requireCandidate(principal, candidateId))
    }

    @Transactional
    fun confirmCandidate(
        principal: FoundationPrincipal,
        candidateId: UUID,
        confirmedValue: String,
        idempotencyKey: String,
        confirmedObservedOn: String? = null,
    ): RecordReceipt {
        requireIdempotencyKey(idempotencyKey)
        if (!confirmedValuePattern.matches(confirmedValue)) throw FoundationBadRequestException("confirmed_value_invalid")
        val requestedObservedOn = confirmedObservedOn?.let(::parseConfirmedObservedOn)
        val candidate = repository.lockCandidate(principal.subjectId, candidateId)
            ?: deniedNotFound(principal, "CANDIDATE_ACCESS_DENIED", "CANDIDATE", candidateId, "candidate_not_found")
        val document = requireDocument(principal, candidate.documentId)
        requireActiveConsent(principal, document.consentId)

        val subjectHash = subjectHash(principal.subjectId)
        val now = Instant.now(clock)
        val requestSha256 = requestHash("CANDIDATE_CONFIRM", candidateId.toString(), "$confirmedValue|${confirmedObservedOn.orEmpty()}")
        // A mismatched replay must 422 even when the candidate already has a record, so this check runs
        // before any status-based short-circuit below could otherwise silently answer it. A live claim for
        // *this exact key* is a genuine replay and returns the record it created; a different, new key
        // hitting a candidate that is no longer PENDING is not a replay, so it falls through to the status
        // checks below and 409s like any other racing or duplicate request.
        requireNoMismatch(subjectHash, "CANDIDATE_CONFIRM", idempotencyKey, requestSha256, now)?.let {
            return recordReceipt(requireRecord(principal, it))
        }
        if (candidate.status == "EXCLUDED") throw FoundationConflictException("candidate_not_pending")
        if (candidate.status != "PENDING") throw FoundationConflictException("candidate_state_changed")
        val observedOn = requestedObservedOn ?: candidate.observedOn

        val recordId = UUID.randomUUID()
        replayOrClaim(subjectHash, "CANDIDATE_CONFIRM", idempotencyKey, recordId, requestSha256, now)?.let {
            return recordReceipt(requireRecord(principal, it))
        }
        if (!repository.createRecordFromCandidate(recordId, UUID.randomUUID(), candidate, confirmedValue, now, observedOn)) {
            throw FoundationConflictException("candidate_state_changed")
        }
        val unchanged = confirmedValue == candidate.candidateValue && observedOn == candidate.observedOn
        audit(principal, if (unchanged) "CANDIDATE_CONFIRMED" else "CANDIDATE_CORRECTED", "RECORD", recordId, "SUCCESS")
        // One code for both audit shapes: whether the person kept or edited the extracted value is
        // exactly the kind of content this line must not carry.
        logging.event(TelemetryEvent.CANDIDATE_CONFIRMED, "/api/foundation/candidates/{candidateId}/confirmation", subjectHash)
        return recordReceipt(requireRecord(principal, recordId))
    }

    /** A date the person says the document states. Shape is bean-validated; calendar validity and range are checked here. */
    private fun parseConfirmedObservedOn(raw: String): LocalDate {
        val parsed = runCatching { LocalDate.parse(raw) }.getOrElse { throw FoundationBadRequestException("observed_on_invalid") }
        val today = LocalDate.ofInstant(Instant.now(clock), seoul)
        if (parsed.isBefore(earliestObservedOn) || parsed.isAfter(today)) throw FoundationBadRequestException("observed_on_out_of_range")
        return parsed
    }

    @Transactional
    fun getRecord(principal: FoundationPrincipal, recordId: UUID): RecordReceipt =
        recordReceipt(requireRecord(principal, recordId))

    @Transactional
    fun listRecords(principal: FoundationPrincipal): List<RecordReceipt> =
        repository.listRecords(principal.subjectId).map(::recordReceipt)

    @Transactional
    fun listHealthEvents(principal: FoundationPrincipal): List<HealthEvent> =
        HealthEventProjection.project(
            repository.listRecords(principal.subjectId),
            repository.listDocumentIdsWithPreview(principal.subjectId),
        )

    /** One page of records in the single read-model order; see [FoundationRepository.listRecordsPage]. */
    @Transactional
    fun listRecordsPage(principal: FoundationPrincipal, after: UUID?, limit: Int): RecordPage {
        val rows = repository.listRecordsPage(principal.subjectId, after, limit)
        val page = rows.take(limit)
        return RecordPage(
            items = page.map(::recordReceipt),
            nextAfter = if (rows.size > limit) page.last().recordVersionId else null,
        )
    }

    /**
     * One page of health events over the same record cursor. [HealthEventProjection.project] sorts a
     * page by `observedOn, concept, confirmedAt`, so events are ordered *within* a page while the page
     * boundaries follow record order; the OpenAPI document states this explicitly.
     */
    @Transactional
    fun listHealthEventsPage(principal: FoundationPrincipal, after: UUID?, limit: Int): HealthEventPage {
        val rows = repository.listRecordsPage(principal.subjectId, after, limit)
        val page = rows.take(limit)
        return HealthEventPage(
            items = HealthEventProjection.project(page, repository.listDocumentIdsWithPreview(principal.subjectId)),
            nextAfter = if (rows.size > limit) page.last().recordVersionId else null,
        )
    }

    /**
     * Every endpoint that reads a person's whole history at once (both exports and both aggregates)
     * refuses above this size rather than building an unbounded response. The paged `/records` and
     * `/health-events` remain available at any size.
     */
    private fun requireBelowExportCap(principal: FoundationPrincipal) {
        if (repository.countCurrentRecords(principal.subjectId) > MAX_EXPORT_RECORDS ||
            repository.countDocuments(principal.subjectId) > MAX_EXPORT_DOCUMENTS
        ) {
            throw FoundationPayloadCapException()
        }
    }

    @Transactional(readOnly = true)
    fun getChangeSummary(principal: FoundationPrincipal): ChangeSummary {
        requireBelowExportCap(principal)
        return ChangeSummaryProjection.project(
            repository.listRecords(principal.subjectId),
            repository.listDocumentCompletions(principal.subjectId),
        )
    }

    /** The person's CURRENT values per item and unit in exam-date order. Read-only: no audit row, no range text. */
    @Transactional(readOnly = true)
    fun getSeries(principal: FoundationPrincipal): SeriesResponse {
        requireBelowExportCap(principal)
        return SeriesProjection.project(repository.listRecords(principal.subjectId))
    }

    @Transactional
    fun exportHealthEvents(principal: FoundationPrincipal): HealthEventExportEnvelope {
        requireBelowExportCap(principal)
        val now = Instant.now(clock)
        val records = repository.listRecords(principal.subjectId)
        val rangeByVersion = records.associate { it.recordVersionId to it.referenceRangeText }
        val events = HealthEventProjection.project(records, repository.listDocumentIdsWithPreview(principal.subjectId))
            .map { ExportedHealthEvent(event = it, referenceRangeText = rangeByVersion[it.eventId]) }
        // Every COMPLETED document (even one whose candidates were all excluded) plus every document
        // that has events, once each, sorted by id text so the file is the same on every call.
        val documentIds = (
            repository.listDocumentCompletions(principal.subjectId).map { it.documentId } +
                events.map { it.event.source.documentId }
            ).distinct().sortedBy { it.toString() }
        val documents = documentIds.map { documentId ->
            val document = requireDocument(principal, documentId)
            val own = events.filter { it.event.source.documentId == documentId }
            ExportedDocument(
                documentId = documentId,
                observedOn = own.map { it.event.observedOn }.distinct().singleOrNull(),
                status = document.status,
                abstentions = repository.findExtractionAbstentions(principal.subjectId, documentId),
                eventCount = own.size,
            )
        }
        // The audit row says that an export happened. It carries no count, no value and no date.
        audit(principal, "HEALTH_EVENTS_EXPORTED", "EXPORT", null, "SUCCESS")
        logging.event(TelemetryEvent.EXPORT_COMPLETED, "/api/foundation/health-events/export", subjectHash(principal.subjectId))
        val filename = "alm-health-events-${LocalDate.ofInstant(now, seoul).format(DateTimeFormatter.BASIC_ISO_DATE)}.json"
        return HealthEventExportEnvelope(
            filename = filename,
            export = HealthEventExport(exportedAt = now, events = events, documents = documents),
        )
    }

    @Transactional
    fun exportHealthEventsAsFhir(principal: FoundationPrincipal): FhirExportEnvelope {
        requireBelowExportCap(principal)
        val now = Instant.now(clock)
        val bundle = FhirObservationMapper.bundle(repository.listRecords(principal.subjectId), conceptByCode, now)
        // Same event as the JSON export; the format is a value-free resource-type code. No count, value or date.
        audit(principal, "HEALTH_EVENTS_EXPORTED", "EXPORT_FHIR", null, "SUCCESS")
        logging.event(
            TelemetryEvent.EXPORT_COMPLETED,
            "/api/foundation/health-events/export/fhir",
            subjectHash(principal.subjectId),
        )
        val filename = "alm-health-events-${LocalDate.ofInstant(now, seoul).format(DateTimeFormatter.BASIC_ISO_DATE)}.fhir.json"
        return FhirExportEnvelope(filename = filename, bundle = bundle)
    }

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
        // The version this correction targets is fixed by this early, unlocked read (the optimistic-
        // concurrency basis of the request), not by a fresher value read after the lock below: once this
        // request has decided which version it is superseding, a racing correction that reaches the atomic
        // UPDATE first must make this one 409, not silently rebase onto the winner's new CURRENT version.
        val current = requireRecord(principal, recordId)
        val candidate = requireCandidate(principal, current.candidateId)
        val document = requireDocument(principal, candidate.documentId)
        requireActiveConsent(principal, document.consentId)
        // Locks the row so a concurrent correction serializes here rather than racing unguarded to the
        // final UPDATE; the lock itself grants no fresher data used for this call's own decision above.
        repository.lockRecord(principal.subjectId, recordId)
            ?: deniedNotFound(principal, "RECORD_ACCESS_DENIED", "RECORD", recordId, "record_not_found")

        val subjectHash = subjectHash(principal.subjectId)
        val newVersionId = UUID.randomUUID()
        val now = Instant.now(clock)
        replayOrClaim(
            subjectHash,
            "RECORD_CORRECT",
            idempotencyKey,
            newVersionId,
            requestHash("RECORD_CORRECT", recordId.toString(), "$correctedValue|$normalizedReason"),
            now,
        )?.let { existingVersionId ->
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
        logging.event(TelemetryEvent.RECORD_CORRECTED, "/api/foundation/records/{recordId}/corrections", subjectHash)
        return recordReceipt(requireRecord(principal, recordId))
    }

    @Transactional
    fun revokeConsent(principal: FoundationPrincipal, consentId: UUID): ConsentReceipt {
        val consent = repository.findConsent(principal.subjectId, consentId)
        if (consent == null) {
            audit(principal, "CONSENT_ACCESS_DENIED", "CONSENT", consentId, "DENIED")
            throw FoundationNotFoundException("consent_not_found")
        }
        val now = Instant.now(clock)
        if (repository.revokeConsent(principal.subjectId, consentId, now)) {
            // Only DOCUMENT_EXTRACTION documents reference a consent; research/project purposes terminate nothing.
            val terminated = repository.terminateDocumentsForRevokedConsent(principal.subjectId, consentId, now)
            val revocationRoute = "/api/foundation/consents/{consentId}/revocation"
            val revokerHash = subjectHash(principal.subjectId)
            terminated.forEach {
                audit(principal, "DOCUMENT_TERMINATED_BY_REVOCATION", "DOCUMENT", it.documentId, "SUCCESS")
                logging.event(TelemetryEvent.DOCUMENT_TERMINATED, revocationRoute, revokerHash)
            }
            audit(principal, "CONSENT_REVOKED", "CONSENT", consentId, "SUCCESS", consent.purposeCode)
            logging.event(TelemetryEvent.CONSENT_REVOKED, revocationRoute, revokerHash)
            if (terminated.any { it.objectKeys.isNotEmpty() }) {
                fun deleteTerminatedFiles() {
                    // Best effort: a key that still fails after FoundationDocumentStorage.deleteAll's own
                    // per-item retry-free attempt is an orphan the Task 22 janitor removes later; deleteAll
                    // itself logs every such failure (event, correlation id, document id, exception class).
                    val failedKeys = runCatching { documentStorage.deleteAll(terminated.flatMap { it.objectKeys }) }
                        .getOrElse { terminated.flatMap { it.objectKeys } }
                        .toSet()
                    // The preview row must only be deleted once its file is confirmed gone (deleted here,
                    // or already absent — both are "not in failedKeys"); a failed file delete leaves the
                    // row in place so the janitor can retry against it. See
                    // FoundationRepository.deletePreviewArtifactIfExists's contract doc.
                    terminated.forEach { document ->
                        val previewKey = document.objectKeys.firstOrNull { it.first == StorageTrustZone.DERIVED_SAFE_ARTIFACT }
                        if (previewKey == null || previewKey !in failedKeys) {
                            runCatching { repository.deletePreviewArtifactIfExists(document.documentId) }
                        }
                    }
                }
                // registerSynchronization throws IllegalStateException when no transaction
                // synchronization is active (e.g. this service invoked directly, bypassing the
                // @Transactional proxy). Guard it: with no commit to wait for, there is nothing
                // wrong with deleting the files right now instead, with the same logging.
                if (TransactionSynchronizationManager.isSynchronizationActive()) {
                    TransactionSynchronizationManager.registerSynchronization(
                        object : TransactionSynchronization {
                            override fun afterCommit() = deleteTerminatedFiles()
                        },
                    )
                } else {
                    deleteTerminatedFiles()
                }
            }
        }
        return consentReceipt(checkNotNull(repository.findConsent(principal.subjectId, consentId)))
    }

    @Transactional
    fun deleteProfile(principal: FoundationPrincipal): DeletionReceipt {
        val subjectHash = subjectHash(principal.subjectId)
        val objectKeys = repository.listObjectKeys(principal.subjectId)
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
        logging.event(TelemetryEvent.DELETION_COMPLETED, "/api/foundation/profile", subjectHash)
        if (objectKeys.isNotEmpty()) {
            fun deleteProfileFiles() {
                // Rows are gone; a file that cannot be removed now is an orphan the Task 22
                // janitor sweeps. deleteAll already retries every key past a failing one and
                // logs each failure (event, correlation id, document id, exception class only).
                runCatching { documentStorage.deleteAll(objectKeys) }
            }
            // Same guard as revokeConsent above: outside an active transaction synchronization
            // there is no commit to defer to, so the deletion runs immediately instead of letting
            // registerSynchronization throw.
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(
                    object : TransactionSynchronization {
                        override fun afterCommit() = deleteProfileFiles()
                    },
                )
            } else {
                deleteProfileFiles()
            }
        }
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

    private fun requestHash(operation: String, targetId: String, body: String = ""): String =
        FoundationHashing.sha256("$operation|$targetId|$body")

    /** Replay → the stored resource; different target/body under the same key → 422. Returns null when this request owns the key. */
    private fun replayOrClaim(subjectHash: String, operation: String, key: String, resourceId: UUID, requestSha256: String, now: Instant): UUID? =
        when (val claim = repository.claimIdempotency(subjectHash, operation, key, resourceId, requestSha256, now, now.plus(idempotencyTtl))) {
            IdempotencyClaim.Inserted -> null
            is IdempotencyClaim.Existing -> {
                if (claim.requestSha256 != null && claim.requestSha256 != requestSha256) throw FoundationUnprocessableException("idempotency_key_mismatch")
                claim.resourceId
            }
        }

    /**
     * Checks a still-live claim for this key against the current request's hash (422 on mismatch), and
     * returns the resource id it already claimed when this exact key was used before (a genuine replay),
     * or null when the key is new. This is what lets a resource-level short-circuit (e.g. "this candidate
     * already has a record") answer only a genuine same-key replay, not any new key that happens to arrive
     * after the resource's state has moved on.
     */
    private fun requireNoMismatch(subjectHash: String, operation: String, key: String, requestSha256: String, now: Instant): UUID? {
        val existing = repository.peekIdempotency(subjectHash, operation, key, now) ?: return null
        if (existing.requestSha256 != null && existing.requestSha256 != requestSha256) throw FoundationUnprocessableException("idempotency_key_mismatch")
        return existing.resourceId
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
            abstentions = if (document.status == "REVIEW_REQUIRED" || document.status == "COMPLETED") {
                repository.findExtractionAbstentions(document.subjectId, document.documentId)
            } else {
                emptyList()
            },
        )

    private fun candidateReceipt(candidate: FoundationCandidateRow): CandidateReceipt =
        CandidateReceipt(
            candidateId = candidate.candidateId,
            documentId = candidate.documentId,
            status = candidate.status,
            ordinal = candidate.ordinal,
            totalCandidates = candidate.totalCandidates,
            label = candidate.label,
            value = candidate.candidateValue,
            unit = candidate.unit,
            observedOn = candidate.observedOn.toString(),
            evidencePage = candidate.evidencePage,
            sourceTextSha256 = candidate.sourceTextSha256,
            documentSha256 = candidate.documentSha256,
            conceptCode = candidate.conceptCode,
            evidenceBox = candidate.evidenceBox,
            createdAt = candidate.createdAt,
            originalLabel = candidate.originalLabel,
        )

    private fun recordReceipt(record: FoundationRecordRow): RecordReceipt =
        RecordReceipt(
            recordId = record.recordId,
            recordVersionId = record.recordVersionId,
            supersedesVersionId = record.supersedesVersionId,
            candidateId = record.candidateId,
            documentId = record.documentId,
            status = record.status,
            reviewDecision = if (RecordReview.isCorrected(record)) "CORRECTED" else "CONFIRMED",
            label = record.label,
            value = record.currentValue,
            originalValue = record.originalValue,
            unit = record.unit,
            observedOn = record.observedOn.toString(),
            originalObservedOn = (record.originalObservedOn ?: record.observedOn).toString(),
            confirmedAt = record.versionChangedAt,
            correctionReason = record.correctionReason,
            evidencePage = record.evidencePage,
            sourceTextSha256 = record.sourceTextSha256,
            documentSha256 = record.documentSha256,
            conceptCode = record.conceptCode,
            originalLabel = record.originalLabel,
        )

    private fun subjectHash(subjectId: String): String =
        FoundationHashing.sha256("${properties.auditPepper}:$subjectId")

    private fun audit(
        principal: FoundationPrincipal,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
        purposeCode: String? = null,
    ) {
        audit(principal.subjectId, principal.sessionTokenHash, eventType, resourceType, resourceId, outcome, purposeCode)
    }

    private fun audit(
        subjectId: String,
        sessionHash: String?,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
        purposeCode: String? = null,
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
                purposeCode,
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
