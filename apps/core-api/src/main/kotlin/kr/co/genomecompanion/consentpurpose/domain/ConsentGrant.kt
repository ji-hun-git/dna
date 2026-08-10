package kr.co.genomecompanion.consentpurpose.domain

import java.time.Duration
import java.time.Instant
import java.util.UUID
import kr.co.genomecompanion.consentpurpose.api.ConsentDeniedException
import kr.co.genomecompanion.consentpurpose.api.ConsentOperation
import kr.co.genomecompanion.consentpurpose.api.ConsentPurpose
import kr.co.genomecompanion.consentpurpose.api.DataCategory
import kr.co.genomecompanion.consentpurpose.api.DataSource
import kr.co.genomecompanion.consentpurpose.api.GrantConsentCommand
import kr.co.genomecompanion.consentpurpose.api.PurposeAccessRequest
import kr.co.genomecompanion.identityaccount.api.DataRegion

data class ConsentGrant(
    val consentId: UUID,
    val subjectId: String,
    val subjectDigest: String,
    val purpose: ConsentPurpose,
    val sources: Set<DataSource>,
    val dataCategories: Set<DataCategory>,
    val operations: Set<ConsentOperation>,
    val recipients: Set<String>,
    val region: DataRegion,
    val processorSetVersion: String,
    val noticeVersion: String,
    val grantedAt: Instant,
    val expiresAt: Instant?,
    val revokedAt: Instant?,
    val signatureReceipt: String,
) {
    fun authorize(request: PurposeAccessRequest) {
        if (
            request.caller.subjectId != subjectId || region != DataRegion.KR ||
            request.purpose != purpose || request.dataCategory !in dataCategories ||
            request.operation !in operations || revokedAt != null ||
            (expiresAt != null && request.at >= expiresAt)
        ) {
            throw ConsentDeniedException()
        }
    }
}

object ConsentGrantPolicy {
    private val exactOperations = mapOf(
        ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE to setOf(ConsentOperation.COLLECT, ConsentOperation.EXPLAIN),
        ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD to setOf(
            ConsentOperation.COLLECT,
            ConsentOperation.EXTRACT,
            ConsentOperation.NORMALIZE,
        ),
        ConsentPurpose.RETAIN_VERIFIED_SOURCE to setOf(ConsentOperation.RETAIN),
    )

    fun requireValid(command: GrantConsentCommand, now: Instant) {
        require(command.operations == exactOperations.getValue(command.purpose)) {
            "operations do not match the selected consent purpose"
        }
        require(command.sources == setOf(DataSource.USER_UPLOAD))
        require(command.dataCategories.isNotEmpty())
        require(command.recipients == setOf("genome-companion-korea"))
        require(command.processorSetVersion.length in 8..32)
        require(command.noticeVersion.length in 8..64)
        when (command.purpose) {
            ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE -> require(command.expiresAt == null)
            ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD -> {
                require(command.processorSetVersion.startsWith("kr-processors-"))
                require(command.expiresAt != null && command.expiresAt > now && command.expiresAt <= now.plus(Duration.ofHours(24)))
            }
            ConsentPurpose.RETAIN_VERIFIED_SOURCE -> {
                require(command.expiresAt != null && command.expiresAt > now && command.expiresAt <= now.plus(Duration.ofDays(365)))
            }
        }
    }
}
