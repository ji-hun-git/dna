package kr.co.genomecompanion.identityaccount.workload

import java.util.UUID

@JvmInline
value class SignedJwt(val compact: String)

@JvmInline
value class OpaqueSubjectRef(val value: String) {
    init {
        require(value.matches(Regex("^sub_[A-Za-z0-9_-]{22,64}$")))
    }
}

enum class WorkerPurpose(val claimValue: String) {
    PERSONAL_RECORD_EXPLANATION("personal_record_explanation"),
}

interface WorkloadTokenIssuer {
    fun issueServiceToken(): SignedJwt
    fun issuePurposeToken(subject: OpaqueSubjectRef, jti: UUID, purpose: WorkerPurpose): SignedJwt
}
