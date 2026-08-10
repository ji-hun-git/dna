package kr.co.genomecompanion.audit.application

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.HexFormat
import kr.co.genomecompanion.audit.api.AuditFailure
import kr.co.genomecompanion.audit.api.AuditVerification
import kr.co.genomecompanion.audit.api.NewSecurityAuditEvent
import kr.co.genomecompanion.audit.api.StoredSecurityAuditEvent

class AuditChainHasher {
    companion object { const val GENESIS = "0000000000000000000000000000000000000000000000000000000000000000" }

    fun seal(events: List<NewSecurityAuditEvent>): List<StoredSecurityAuditEvent> {
        var previous = GENESIS
        return events.mapIndexed { index, event ->
            val sequence = index.toLong() + 1
            val eventHash = hash(sequence, event, previous)
            StoredSecurityAuditEvent(sequence, event, previous, eventHash).also { previous = eventHash }
        }
    }

    fun hash(sequence: Long, event: NewSecurityAuditEvent, previousHash: String): String {
        require(previousHash.matches(Regex("^[0-9a-f]{64}$")))
        val canonical = listOf(
            sequence.toString(), event.eventId.toString(), event.eventType.name,
            event.actorDigest, event.resourceDigest.orEmpty(), event.purpose.orEmpty(),
            event.outcome.name, event.correlationId.toString(), event.occurredAt.toString(), previousHash,
        ).joinToString("\u001f")
        return HexFormat.of().formatHex(
            MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(StandardCharsets.UTF_8)),
        )
    }
}

class AuditChainVerifier(
    private val hasher: AuditChainHasher,
) {
    fun verify(events: List<StoredSecurityAuditEvent>): AuditVerification {
        if (events.map { it.sequence } != events.map { it.sequence }.sorted()) {
            return AuditVerification(false, AuditFailure.ORDER, 0)
        }
        var previous = AuditChainHasher.GENESIS
        events.forEachIndexed { index, stored ->
            if (stored.sequence != index.toLong() + 1) {
                return AuditVerification(false, AuditFailure.GAP, index)
            }
            val expected = hasher.hash(stored.sequence, stored.event, previous)
            if (stored.previousHash != previous || stored.eventHash != expected) {
                return AuditVerification(false, AuditFailure.HASH_MISMATCH, index)
            }
            previous = stored.eventHash
        }
        return AuditVerification(true, null, events.size)
    }
}
