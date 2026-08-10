package kr.co.genomecompanion.consentpurpose

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kr.co.genomecompanion.consentpurpose.api.ConsentDeniedException
import kr.co.genomecompanion.consentpurpose.api.ConsentOperation
import kr.co.genomecompanion.consentpurpose.api.ConsentNotFoundException
import kr.co.genomecompanion.consentpurpose.api.ConsentPurpose
import kr.co.genomecompanion.consentpurpose.api.ConsentRepository
import kr.co.genomecompanion.consentpurpose.api.DataCategory
import kr.co.genomecompanion.consentpurpose.api.DataSource
import kr.co.genomecompanion.consentpurpose.api.DocumentUploadConsentRequest
import kr.co.genomecompanion.consentpurpose.api.GrantConsentCommand
import kr.co.genomecompanion.consentpurpose.api.PurposeAccessRequest
import kr.co.genomecompanion.consentpurpose.api.SubjectPseudonymizer
import kr.co.genomecompanion.consentpurpose.application.ConsentApplicationService
import kr.co.genomecompanion.consentpurpose.application.ConsentReceiptSigner
import kr.co.genomecompanion.consentpurpose.application.DualGrantDocumentUploadConsentGate
import kr.co.genomecompanion.consentpurpose.domain.ConsentGrant
import kr.co.genomecompanion.identityaccount.api.CallerPrincipal
import kr.co.genomecompanion.platform.outbox.OutboxEvent
import kr.co.genomecompanion.platform.outbox.OutboxRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class ConsentApplicationServiceTest {
    private val clock = Clock.fixed(Instant.parse("2026-08-09T00:00:00Z"), ZoneOffset.UTC)
    private val repository = InMemoryConsentRepository()
    private val outbox = InMemoryOutboxRepository()
    private val service = ConsentApplicationService(
        repository,
        outbox,
        ConsentReceiptSigner(),
        SubjectPseudonymizer { "hmac256:" + "a".repeat(64) },
        clock,
    )
    private val uploadGate = DualGrantDocumentUploadConsentGate(service)
    private val caller = CallerPrincipal("subject-17", setOf("consent:write"))

    @Test
    fun `timeline grant authorizes only exact collection and explanation`() {
        val view = service.grant(caller, timelineCommand())
        assertThat(service.requireAllowed(request(view.consentId, ConsentOperation.COLLECT)).allowed).isTrue()
        assertThat(service.requireAllowed(request(view.consentId, ConsentOperation.EXPLAIN)).allowed).isTrue()
        assertThatThrownBy {
            service.requireAllowed(request(view.consentId, ConsentOperation.RETAIN))
        }.isInstanceOf(ConsentDeniedException::class.java)
        assertThatThrownBy {
            service.grant(caller, timelineCommand().copy(operations = setOf(ConsentOperation.COLLECT)))
        }.isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `document upload requires distinct active timeline and cloud grants`() {
        val timeline = service.grant(caller, timelineCommand())
        assertThatThrownBy {
            uploadGate.requireAllowed(DocumentUploadConsentRequest(caller, timeline.consentId, timeline.consentId, DataCategory.LAB_REPORT, clock.instant()))
        }.isInstanceOf(ConsentDeniedException::class.java)
        val cloud = service.grant(caller, cloudCommand())
        val authorization = uploadGate.requireAllowed(
            DocumentUploadConsentRequest(caller, timeline.consentId, cloud.consentId, DataCategory.LAB_REPORT, clock.instant()),
        )
        assertThat(authorization.timelineConsentId).isEqualTo(timeline.consentId)
        assertThat(authorization.cloudConsentId).isEqualTo(cloud.consentId)
        assertThat(authorization.subjectId).isEqualTo(caller.subjectId)
    }

    @Test
    fun `revocation is idempotent and creates one durable event`() {
        val granted = service.grant(caller, timelineCommand())
        val first = service.revoke(caller, granted.consentId)
        val second = service.revoke(caller, granted.consentId)
        assertThat(first.revokedAt).isEqualTo(second.revokedAt)
        assertThat(outbox.events("consent.revoked.v1")).hasSize(1)
        assertThatThrownBy { service.requireAllowed(request(granted.consentId, ConsentOperation.COLLECT)) }
            .isInstanceOf(ConsentDeniedException::class.java)
    }

    @Test
    fun `another subject cannot list authorize or revoke the receipt`() {
        val granted = service.grant(caller, timelineCommand())
        val other = CallerPrincipal("subject-18", setOf("consent:read", "consent:write"))
        assertThat(service.list(other)).isEmpty()
        assertThatThrownBy {
            service.requireAllowed(request(granted.consentId, ConsentOperation.COLLECT).copy(caller = other))
        }.isInstanceOf(ConsentDeniedException::class.java)
        assertThatThrownBy { service.revoke(other, granted.consentId) }
            .isInstanceOf(ConsentNotFoundException::class.java)
    }

    @Test
    fun `receipt is stable for set order and changes when a covered field changes`() {
        val grant = ConsentGrant(
            UUID.fromString("00000000-0000-0000-0000-000000000031"), "subject-17", "hmac256:" + "a".repeat(64),
            ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE, setOf(DataSource.USER_UPLOAD),
            linkedSetOf(DataCategory.MEDICAL_RECORD, DataCategory.LAB_REPORT),
            linkedSetOf(ConsentOperation.EXPLAIN, ConsentOperation.COLLECT), setOf("genome-companion-korea"),
            kr.co.genomecompanion.identityaccount.api.DataRegion.KR, "kr-core-2026-08", "privacy-notice-ko-v1",
            clock.instant(), null, null, "",
        )
        val signer = ConsentReceiptSigner()
        val first = signer.sign(grant)
        val reordered = signer.sign(
            grant.copy(
                dataCategories = linkedSetOf(DataCategory.LAB_REPORT, DataCategory.MEDICAL_RECORD),
                operations = linkedSetOf(ConsentOperation.COLLECT, ConsentOperation.EXPLAIN),
            ),
        )
        assertThat(reordered).isEqualTo(first)
        assertThat(signer.sign(grant.copy(noticeVersion = "privacy-notice-ko-v2"))).isNotEqualTo(first)
        assertThat(signer.sign(grant.copy(revokedAt = clock.instant()))).isNotEqualTo(first)
    }

    private fun request(consentId: UUID, operation: ConsentOperation) = PurposeAccessRequest(
        caller, consentId, ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
        DataCategory.LAB_REPORT, operation, clock.instant(),
    )

    private fun timelineCommand() = GrantConsentCommand(
        ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
        setOf(DataSource.USER_UPLOAD), setOf(DataCategory.LAB_REPORT),
        setOf(ConsentOperation.COLLECT, ConsentOperation.EXPLAIN),
        setOf("genome-companion-korea"), "kr-core-2026-08", "privacy-notice-ko-v1", null,
    )

    private fun cloudCommand() = GrantConsentCommand(
        ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
        setOf(DataSource.USER_UPLOAD), setOf(DataCategory.LAB_REPORT),
        setOf(ConsentOperation.COLLECT, ConsentOperation.EXTRACT, ConsentOperation.NORMALIZE),
        setOf("genome-companion-korea"), "kr-processors-2026-08", "privacy-notice-ko-v1",
        Instant.parse("2026-08-10T00:00:00Z"),
    )

    private class InMemoryConsentRepository : ConsentRepository {
        private val rows = linkedMapOf<UUID, ConsentGrant>()
        override fun insert(grant: ConsentGrant) = grant.also { rows[it.consentId] = it }
        override fun save(grant: ConsentGrant) = grant.also { rows[it.consentId] = it }
        override fun findByIdForSubject(consentId: UUID, subjectId: String) = rows[consentId]?.takeIf { it.subjectId == subjectId }
        override fun listBySubject(subjectId: String) = rows.values.filter { it.subjectId == subjectId }
    }

    private class InMemoryOutboxRepository : OutboxRepository {
        private val rows = linkedMapOf<UUID, OutboxEvent>()
        override fun insert(event: OutboxEvent) = rows.putIfAbsent(event.eventId, event) == null
        fun events(type: String) = rows.values.filter { it.eventType == type }
    }
}
