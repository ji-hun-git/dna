package kr.co.genomecompanion.consentpurpose.api

import java.net.URI
import java.time.Instant
import java.util.UUID
import kr.co.genomecompanion.consentpurpose.domain.ConsentGrant
import kr.co.genomecompanion.identityaccount.api.CallerPrincipal
import kr.co.genomecompanion.identityaccount.api.DataRegion
import org.springframework.security.access.AccessDeniedException
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ResponseStatus

enum class ConsentPurpose {
    BUILD_PERSONAL_LAB_TIMELINE,
    PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
    RETAIN_VERIFIED_SOURCE,
}

enum class DataSource { USER_UPLOAD }
enum class DataCategory { LAB_REPORT, MEDICAL_RECORD }
enum class ConsentOperation { COLLECT, EXTRACT, NORMALIZE, EXPLAIN, RETAIN }

class ConsentDeniedException : AccessDeniedException("consent denied")

@ResponseStatus(HttpStatus.NOT_FOUND)
class ConsentNotFoundException : RuntimeException("consent not found")

fun interface SubjectPseudonymizer {
    fun digest(subjectId: String): String
}

interface ConsentRepository {
    fun insert(grant: ConsentGrant): ConsentGrant
    fun save(grant: ConsentGrant): ConsentGrant
    fun findByIdForSubject(consentId: UUID, subjectId: String): ConsentGrant?
    fun listBySubject(subjectId: String): List<ConsentGrant>
}

data class GrantConsentCommand(
    val purpose: ConsentPurpose,
    val sources: Set<DataSource>,
    val dataCategories: Set<DataCategory>,
    val operations: Set<ConsentOperation>,
    val recipients: Set<String>,
    val processorSetVersion: String,
    val noticeVersion: String,
    val expiresAt: Instant?,
)

data class PurposeAccessRequest(
    val caller: CallerPrincipal,
    val consentId: UUID,
    val purpose: ConsentPurpose,
    val dataCategory: DataCategory,
    val operation: ConsentOperation,
    val at: Instant,
)

data class ConsentAuthorization(
    val allowed: Boolean,
    val consentId: UUID,
    val subjectId: String,
    val region: DataRegion,
    val purpose: ConsentPurpose,
)

data class ConsentView(
    val consentId: UUID,
    val purpose: ConsentPurpose,
    val sources: Set<DataSource>,
    val dataCategories: Set<DataCategory>,
    val operations: Set<ConsentOperation>,
    val recipients: Set<String>,
    val processorSetVersion: String,
    val noticeVersion: String,
    val region: DataRegion,
    val grantedAt: Instant,
    val expiresAt: Instant?,
    val revokedAt: Instant?,
    val signatureReceipt: String,
)

data class ConsentOptionsView(
    val processorSetVersion: String,
    val noticeVersion: String,
    val recipients: Set<String>,
    val region: DataRegion,
    val cloudProcessingMaxHours: Int,
    val retentionMaxDays: Int,
    val noticeUrl: URI,
    val effectiveAt: Instant,
    val configurationDigest: String,
)

fun interface ConsentOptionsService {
    fun current(): ConsentOptionsView
}

interface ConsentService {
    fun grant(caller: CallerPrincipal, command: GrantConsentCommand): ConsentView
    fun list(caller: CallerPrincipal): List<ConsentView>
    fun revoke(caller: CallerPrincipal, consentId: UUID): ConsentView
}

fun interface PurposeAuthorizer {
    fun requireAllowed(request: PurposeAccessRequest): ConsentAuthorization
}

data class DocumentUploadConsentRequest(
    val caller: CallerPrincipal,
    val timelineConsentId: UUID,
    val cloudConsentId: UUID,
    val dataCategory: DataCategory,
    val at: Instant,
)

data class DocumentUploadConsentAuthorization(
    val subjectId: String,
    val timelineConsentId: UUID,
    val cloudConsentId: UUID,
    val dataCategory: DataCategory,
    val region: DataRegion,
)

fun interface DocumentUploadConsentGate {
    fun requireAllowed(request: DocumentUploadConsentRequest): DocumentUploadConsentAuthorization
}

data class ExplanationPurposeTokenRequest(
    val caller: CallerPrincipal,
    val consentId: UUID,
    val dataCategory: DataCategory,
    val jti: UUID,
)
