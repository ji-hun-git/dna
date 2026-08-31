package kr.co.genomecompanion.audit.api

import java.time.Instant
import java.util.UUID

enum class SecurityAuditType { CONSENT_CHANGED, AUTHORIZATION_DECISION, DELETION_CHANGED, PRIVILEGED_ACCESS }
enum class AuditOutcome { ALLOWED, DENIED, SUCCEEDED, FAILED }
enum class AuditFailure { GAP, ORDER, HASH_MISMATCH }

data class NewSecurityAuditEvent(
    val eventId: UUID,
    val eventType: SecurityAuditType,
    val actorDigest: String,
    val resourceDigest: String?,
    val purpose: String?,
    val outcome: AuditOutcome,
    val correlationId: UUID,
    val occurredAt: Instant,
) {
    init {
        require(actorDigest.matches(Regex("^hmac256:[0-9a-f]{64}$")))
        require(resourceDigest == null || resourceDigest.matches(Regex("^hmac256:[0-9a-f]{64}$")))
        require(purpose == null || purpose.matches(Regex("^[a-z0-9_]{1,64}$")))
    }
}

data class StoredSecurityAuditEvent(
    val sequence: Long,
    val event: NewSecurityAuditEvent,
    val previousHash: String,
    val eventHash: String,
)

data class AuditVerification(
    val valid: Boolean,
    val reason: AuditFailure?,
    val verifiedCount: Int,
)

fun interface SecurityAuditAppender {
    fun append(event: NewSecurityAuditEvent): StoredSecurityAuditEvent
}
