package kr.co.genomecompanion.audit

import java.time.Instant
import java.util.UUID
import kr.co.genomecompanion.audit.api.AuditFailure
import kr.co.genomecompanion.audit.api.AuditOutcome
import kr.co.genomecompanion.audit.api.NewSecurityAuditEvent
import kr.co.genomecompanion.audit.api.SecurityAuditType
import kr.co.genomecompanion.audit.application.AuditChainHasher
import kr.co.genomecompanion.audit.application.AuditChainVerifier
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class AuditChainTest {
    private val hasher = AuditChainHasher()
    private val verifier = AuditChainVerifier(hasher)

    @Test
    fun `verification detects mutation deletion and reordering`() {
        val chain = hasher.seal(listOf(newEvent(1), newEvent(2)))
        assertThat(verifier.verify(chain).valid).isTrue()
        assertThat(verifier.verify(chain.drop(1)).reason).isEqualTo(AuditFailure.GAP)
        assertThat(verifier.verify(chain.reversed()).reason).isEqualTo(AuditFailure.ORDER)
        val mutated = chain.toMutableList().also {
            it[1] = it[1].copy(event = it[1].event.copy(outcome = AuditOutcome.DENIED))
        }
        assertThat(verifier.verify(mutated).reason).isEqualTo(AuditFailure.HASH_MISMATCH)
    }

    private fun newEvent(number: Int) = NewSecurityAuditEvent(
        UUID.nameUUIDFromBytes("audit-$number".toByteArray()), SecurityAuditType.CONSENT_CHANGED,
        "hmac256:" + number.toString().padStart(64, '0'), null, "build_personal_lab_timeline",
        AuditOutcome.ALLOWED, UUID.nameUUIDFromBytes("correlation-$number".toByteArray()),
        Instant.parse("2026-08-09T00:00:0${number}Z"),
    )
}
