package kr.co.genomecompanion.evidencegraph.api

import java.time.Instant


enum class EvidenceKind {
    MEASUREMENT,
}


enum class EvidenceClass {
    SYNTHETIC_SOURCE_RECORDED,
}


enum class VerificationStatus {
    CANDIDATE,
}


data class EvidenceCode(
    val system: String,
    val code: String,
    val display: String?,
)


data class EvidenceQuantity(
    val value: String,
    val system: String,
    val code: String,
    val display: String,
)


data class EvidenceProvenance(
    val sourceType: String,
    val bundleSha256: String,
    val resourceRef: String,
    val resourceVersion: String?,
    val originalLocation: String,
    val generatorVersion: String,
    val generatorCommit: String,
    val importedAt: Instant,
)


data class EvidenceGraphCandidate(
    val candidateId: String,
    val subjectId: String,
    val kind: EvidenceKind,
    val evidenceClass: EvidenceClass,
    val verificationStatus: VerificationStatus,
    val code: EvidenceCode,
    val quantity: EvidenceQuantity,
    val effectiveAt: Instant,
    val recordedAt: Instant,
    val sourceStatus: String,
    val provenance: EvidenceProvenance,
)


enum class ProjectionRejectionCode {
    MISSING_RESOURCE_ID,
    SUBJECT_MISMATCH,
    UNSUPPORTED_STATUS,
    MISSING_CODE,
    AMBIGUOUS_CODE,
    UNSUPPORTED_VALUE,
    UNSUPPORTED_UNIT,
    AMBIGUOUS_EFFECTIVE_TIME,
    MISSING_RECORDED_TIME,
}


data class ProjectionRejection(
    val resourceRef: String?,
    val originalLocation: String,
    val code: ProjectionRejectionCode,
)


data class SyntheticFhirProjection(
    val bundleSha256: String,
    val candidates: List<EvidenceGraphCandidate>,
    val rejections: List<ProjectionRejection>,
    val ignoredResourceCounts: Map<String, Int>,
)


data class SyntheticFhirBundleRequest(
    val subjectId: String,
    val payload: String,
    val generatorVersion: String,
    val generatorCommit: String,
    val importedAt: Instant,
)


enum class ProjectionFailureCode {
    NON_SYNTHETIC_SUBJECT,
    INVALID_GENERATOR_VERSION,
    INVALID_GENERATOR_COMMIT,
    EMPTY_PAYLOAD,
    PAYLOAD_TOO_LARGE,
    INVALID_FHIR_JSON,
    UNSUPPORTED_BUNDLE_TYPE,
    ENTRY_LIMIT_EXCEEDED,
    AMBIGUOUS_BUNDLE_SUBJECT,
    DUPLICATE_RESOURCE_IDENTITY,
}


class SyntheticFhirProjectionException(
    val code: ProjectionFailureCode,
) : RuntimeException(code.name)
