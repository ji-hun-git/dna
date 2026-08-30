package kr.co.genomecompanion.documentboundary

import java.time.Instant
import java.util.UUID


enum class DocumentState {
    UPLOAD_PENDING,
    UNTRUSTED_OBJECT,
    SECURITY_INSPECTION,
    SECURITY_REJECTED,
    SECURITY_APPROVED,
    EXTRACTION_QUEUED,
    EXTRACTION_RUNNING,
    REVIEW_REQUIRED,
    COMPLETED,
    DELETION_PENDING,
    DELETED,
    FAILED_RETRYABLE,
    FAILED_TERMINAL,
}


enum class StorageTrustZone {
    UNTRUSTED,
    APPROVED_SOURCE,
    DERIVED_SAFE_ARTIFACT,
}


enum class DocumentJobType {
    SECURITY_INSPECTION,
    SYNTHETIC_EXTRACTION,
}


enum class JobState {
    QUEUED,
    LEASED,
    COMPLETED,
    FAILED_RETRYABLE,
    FAILED_TERMINAL,
    DEAD_LETTER,
}


enum class InspectionDecision {
    APPROVED,
    REJECTED,
    RETRYABLE_FAILURE,
}


enum class InspectionReason {
    CLEAN,
    SIZE_OUT_OF_RANGE,
    DIGEST_MISMATCH,
    MEDIA_TYPE_MISMATCH,
    MALFORMED_PDF,
    ENCRYPTED_PDF,
    PAGE_LIMIT_EXCEEDED,
    OBJECT_LIMIT_EXCEEDED,
    IMAGE_COMPLEXITY_EXCEEDED,
    EMBEDDED_FILE,
    ACTIVE_CONTENT,
    TRAILING_DATA,
    MALWARE_DETECTED,
    SCANNER_UNAVAILABLE,
}


data class ObjectDescriptor(
    val zone: StorageTrustZone,
    val objectKey: String,
    val version: String,
    val size: Long,
    val sha256: String,
)


data class BoundedUploadCapability(
    val capabilityId: UUID,
    val method: String,
    val uploadPath: String,
    val expiresAt: Instant,
    val expectedLength: Long,
    val expectedSha256: String,
    val requiredHeaders: Map<String, String>,
    val replaySemantics: String = "REUSABLE_BEFORE_FINALIZATION_UNTIL_EXPIRY_SAME_OBJECT_SAME_BYTES_ONLY",
)


data class MalwareScanResult(
    val decision: InspectionDecision,
    val reason: InspectionReason,
    val scannerName: String,
    val scannerVersion: String,
    val signatureVersion: String,
)


fun interface MalwareScanner {
    fun scan(bytes: ByteArray): MalwareScanResult
}


data class PdfInspectionPolicy(
    val minBytes: Long = 64,
    val maxBytes: Long = 10_485_760,
    val maxPages: Int = 20,
    val maxIndirectObjects: Int = 20_000,
    val maxImagePixels: Long = 50_000_000,
    val policyVersion: String = "pdf-security-v1",
)


data class InspectionReport(
    val decision: InspectionDecision,
    val reason: InspectionReason,
    val sourceSha256: String,
    val identifiedMediaType: String?,
    val pageCount: Int?,
    val indirectObjectCount: Int?,
    val totalImagePixels: Long?,
    val encrypted: Boolean?,
    val activeContent: Boolean?,
    val embeddedFiles: Boolean?,
    val policyVersion: String,
    val scannerName: String,
    val scannerVersion: String,
    val signatureVersion: String,
)
