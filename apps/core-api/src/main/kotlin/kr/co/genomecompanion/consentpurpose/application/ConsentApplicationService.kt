package kr.co.genomecompanion.consentpurpose.application

import com.fasterxml.jackson.databind.ObjectMapper
import java.time.Clock
import java.util.UUID
import kr.co.genomecompanion.consentpurpose.api.ConsentAuthorization
import kr.co.genomecompanion.consentpurpose.api.ConsentDeniedException
import kr.co.genomecompanion.consentpurpose.api.ConsentOptionsService
import kr.co.genomecompanion.consentpurpose.api.ConsentNotFoundException
import kr.co.genomecompanion.consentpurpose.api.ConsentRepository
import kr.co.genomecompanion.consentpurpose.api.ConsentService
import kr.co.genomecompanion.consentpurpose.api.ConsentView
import kr.co.genomecompanion.consentpurpose.api.GrantConsentCommand
import kr.co.genomecompanion.consentpurpose.api.PurposeAccessRequest
import kr.co.genomecompanion.consentpurpose.api.PurposeAuthorizer
import kr.co.genomecompanion.consentpurpose.api.SubjectPseudonymizer
import kr.co.genomecompanion.consentpurpose.domain.ConsentGrant
import kr.co.genomecompanion.consentpurpose.domain.ConsentGrantPolicy
import kr.co.genomecompanion.identityaccount.api.CallerPrincipal
import kr.co.genomecompanion.identityaccount.api.DataRegion
import kr.co.genomecompanion.platform.outbox.OutboxEvent
import kr.co.genomecompanion.platform.outbox.OutboxRepository
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@ConditionalOnProperty(prefix = "gc.consent", name = ["enabled"], havingValue = "true")
class ConsentApplicationService(
    private val repository: ConsentRepository,
    private val outbox: OutboxRepository,
    private val receiptSigner: ConsentReceiptSigner,
    private val pseudonymizer: SubjectPseudonymizer,
    private val clock: Clock,
    private val options: ConsentOptionsService = ReleasePinnedConsentOptionsService(),
) : ConsentService, PurposeAuthorizer {
    @Transactional
    override fun grant(caller: CallerPrincipal, command: GrantConsentCommand): ConsentView {
        val now = clock.instant()
        val current = options.current()
        ConsentGrantPolicy.requireValid(command, now)
        require(command.noticeVersion == current.noticeVersion)
        require(command.recipients == current.recipients)
        require(command.processorSetVersion == expectedProcessorVersion(command, current.processorSetVersion))
        val unsigned = ConsentGrant(
            UUID.randomUUID(), caller.subjectId, pseudonymizer.digest(caller.subjectId), command.purpose,
            command.sources, command.dataCategories, command.operations, command.recipients, DataRegion.KR,
            command.processorSetVersion, command.noticeVersion, now, command.expiresAt, null, "",
        )
        return repository.insert(unsigned.copy(signatureReceipt = receiptSigner.sign(unsigned))).toView()
    }

    override fun list(caller: CallerPrincipal): List<ConsentView> =
        repository.listBySubject(caller.subjectId).map { it.toView() }

    @Transactional
    override fun revoke(caller: CallerPrincipal, consentId: UUID): ConsentView {
        val existing = repository.findByIdForSubject(consentId, caller.subjectId) ?: throw ConsentNotFoundException()
        if (existing.revokedAt != null) return existing.toView()
        val revoked = existing.copy(revokedAt = clock.instant(), signatureReceipt = "")
        val saved = repository.save(revoked.copy(signatureReceipt = receiptSigner.sign(revoked)))
        val eventId = UUID.nameUUIDFromBytes("consent.revoked.v1:$consentId".toByteArray())
        val payload = ObjectMapper().writeValueAsString(
            linkedMapOf(
                "schemaVersion" to "consent.revoked.v1",
                "consent_id" to consentId.toString(),
                "subject_id" to caller.subjectId,
                "purpose" to existing.purpose.name,
                "occurred_at" to saved.revokedAt.toString(),
            ),
        )
        outbox.insert(OutboxEvent(eventId, "consent.revoked.v1", consentId, payload, requireNotNull(saved.revokedAt)))
        return saved.toView()
    }

    override fun requireAllowed(request: PurposeAccessRequest): ConsentAuthorization {
        val grant = repository.findByIdForSubject(request.consentId, request.caller.subjectId)
            ?: throw ConsentDeniedException()
        grant.authorize(request)
        return ConsentAuthorization(true, grant.consentId, grant.subjectId, grant.region, grant.purpose)
    }

    private fun expectedProcessorVersion(command: GrantConsentCommand, defaultVersion: String): String =
        when (command.purpose) {
            kr.co.genomecompanion.consentpurpose.api.ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE -> "kr-core-2026-08"
            kr.co.genomecompanion.consentpurpose.api.ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD -> defaultVersion
            kr.co.genomecompanion.consentpurpose.api.ConsentPurpose.RETAIN_VERIFIED_SOURCE -> "kr-storage-2026-08"
        }

    private fun ConsentGrant.toView() = ConsentView(
        consentId, purpose, sources, dataCategories, operations, recipients,
        processorSetVersion, noticeVersion, region, grantedAt, expiresAt, revokedAt, signatureReceipt,
    )
}

class DualGrantDocumentUploadConsentGate(
    private val purposeAuthorizer: PurposeAuthorizer,
) : kr.co.genomecompanion.consentpurpose.api.DocumentUploadConsentGate {
    override fun requireAllowed(request: kr.co.genomecompanion.consentpurpose.api.DocumentUploadConsentRequest): kr.co.genomecompanion.consentpurpose.api.DocumentUploadConsentAuthorization {
        if (request.timelineConsentId == request.cloudConsentId) throw ConsentDeniedException()
        val timeline = purposeAuthorizer.requireAllowed(
            PurposeAccessRequest(request.caller, request.timelineConsentId, kr.co.genomecompanion.consentpurpose.api.ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE, request.dataCategory, kr.co.genomecompanion.consentpurpose.api.ConsentOperation.COLLECT, request.at),
        )
        val cloud = purposeAuthorizer.requireAllowed(
            PurposeAccessRequest(request.caller, request.cloudConsentId, kr.co.genomecompanion.consentpurpose.api.ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD, request.dataCategory, kr.co.genomecompanion.consentpurpose.api.ConsentOperation.COLLECT, request.at),
        )
        if (timeline.subjectId != cloud.subjectId || timeline.region != DataRegion.KR || cloud.region != DataRegion.KR) {
            throw ConsentDeniedException()
        }
        return kr.co.genomecompanion.consentpurpose.api.DocumentUploadConsentAuthorization(
            timeline.subjectId, request.timelineConsentId, request.cloudConsentId, request.dataCategory, DataRegion.KR,
        )
    }
}
