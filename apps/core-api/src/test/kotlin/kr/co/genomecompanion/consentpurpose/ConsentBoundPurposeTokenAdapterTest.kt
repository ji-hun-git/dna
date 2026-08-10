package kr.co.genomecompanion.consentpurpose

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kr.co.genomecompanion.consentpurpose.api.ConsentAuthorization
import kr.co.genomecompanion.consentpurpose.api.ConsentOperation
import kr.co.genomecompanion.consentpurpose.api.DataCategory
import kr.co.genomecompanion.consentpurpose.api.ExplanationPurposeTokenRequest
import kr.co.genomecompanion.consentpurpose.api.PurposeAccessRequest
import kr.co.genomecompanion.consentpurpose.api.PurposeAuthorizer
import kr.co.genomecompanion.consentpurpose.application.ConsentBoundPurposeTokenAdapter
import kr.co.genomecompanion.consentpurpose.application.OpaqueSubjectRefFactory
import kr.co.genomecompanion.identityaccount.api.CallerPrincipal
import kr.co.genomecompanion.identityaccount.api.DataRegion
import kr.co.genomecompanion.identityaccount.workload.OpaqueSubjectRef
import kr.co.genomecompanion.identityaccount.workload.SignedJwt
import kr.co.genomecompanion.identityaccount.workload.WorkerPurpose
import kr.co.genomecompanion.identityaccount.workload.WorkloadTokenIssuer
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ConsentBoundPurposeTokenAdapterTest {
    @Test
    fun `active explain consent is translated to the exact AI purpose-token contract`() {
        val caller = CallerPrincipal("cognito-subject-7", setOf("explanation:request"))
        val consentId = UUID.fromString("00000000-0000-0000-0000-000000000020")
        val jti = UUID.fromString("00000000-0000-0000-0000-000000000021")
        val requests = mutableListOf<PurposeAccessRequest>()
        val issuer = RecordingWorkloadTokenIssuer()
        val adapter = ConsentBoundPurposeTokenAdapter(
            PurposeAuthorizer { request ->
                requests += request
                ConsentAuthorization(true, request.consentId, request.caller.subjectId, DataRegion.KR, request.purpose)
            },
            issuer,
            OpaqueSubjectRefFactory { OpaqueSubjectRef("sub_AAAAAAAAAAAAAAAAAAAAAA") },
            Clock.fixed(Instant.parse("2026-08-09T00:00:00Z"), ZoneOffset.UTC),
        )
        assertThat(adapter.issue(ExplanationPurposeTokenRequest(caller, consentId, DataCategory.LAB_REPORT, jti)).compact)
            .isEqualTo("signed-purpose-token")
        assertThat(requests.single().operation).isEqualTo(ConsentOperation.EXPLAIN)
        assertThat(issuer.lastPurpose).isEqualTo(WorkerPurpose.PERSONAL_RECORD_EXPLANATION)
        assertThat(issuer.lastJti).isEqualTo(jti)
    }

    private class RecordingWorkloadTokenIssuer : WorkloadTokenIssuer {
        var lastJti: UUID? = null
        var lastPurpose: WorkerPurpose? = null
        override fun issueServiceToken() = SignedJwt("signed-service-token")
        override fun issuePurposeToken(subject: OpaqueSubjectRef, jti: UUID, purpose: WorkerPurpose): SignedJwt {
            require(subject == OpaqueSubjectRef("sub_AAAAAAAAAAAAAAAAAAAAAA"))
            lastJti = jti
            lastPurpose = purpose
            return SignedJwt("signed-purpose-token")
        }
    }
}
