package kr.co.genomecompanion.consentpurpose.application

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Clock
import java.util.Base64
import kr.co.genomecompanion.consentpurpose.api.ConsentOperation
import kr.co.genomecompanion.consentpurpose.api.ConsentPurpose
import kr.co.genomecompanion.consentpurpose.api.ExplanationPurposeTokenRequest
import kr.co.genomecompanion.consentpurpose.api.PurposeAccessRequest
import kr.co.genomecompanion.consentpurpose.api.PurposeAuthorizer
import kr.co.genomecompanion.consentpurpose.api.SubjectPseudonymizer
import kr.co.genomecompanion.identityaccount.workload.OpaqueSubjectRef
import kr.co.genomecompanion.identityaccount.workload.SignedJwt
import kr.co.genomecompanion.identityaccount.workload.WorkerPurpose
import kr.co.genomecompanion.identityaccount.workload.WorkloadTokenIssuer

fun interface OpaqueSubjectRefFactory {
    fun fromSubjectId(subjectId: String): OpaqueSubjectRef
}

class ConsentBoundPurposeTokenAdapter(
    private val authorizer: PurposeAuthorizer,
    private val tokenIssuer: WorkloadTokenIssuer,
    private val subjectRefs: OpaqueSubjectRefFactory,
    private val clock: Clock,
) {
    fun issue(request: ExplanationPurposeTokenRequest): SignedJwt {
        authorizer.requireAllowed(
            PurposeAccessRequest(
                request.caller, request.consentId, ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
                request.dataCategory, ConsentOperation.EXPLAIN, clock.instant(),
            ),
        )
        return tokenIssuer.issuePurposeToken(
            subjectRefs.fromSubjectId(request.caller.subjectId), request.jti,
            WorkerPurpose.PERSONAL_RECORD_EXPLANATION,
        )
    }
}

class HmacOpaqueSubjectRefFactory(
    private val pseudonymizer: SubjectPseudonymizer,
) : OpaqueSubjectRefFactory {
    override fun fromSubjectId(subjectId: String): OpaqueSubjectRef {
        val hmacDigest = pseudonymizer.digest(subjectId)
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest("explanation-worker:personal_record_explanation:$hmacDigest".toByteArray(StandardCharsets.US_ASCII))
        return OpaqueSubjectRef("sub_${Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)}")
    }
}
