package kr.co.genomecompanion.audit.adapter.out.jdbc

import java.util.UUID
import kr.co.genomecompanion.audit.api.NewSecurityAuditEvent
import kr.co.genomecompanion.audit.api.SecurityAuditAppender
import kr.co.genomecompanion.audit.api.StoredSecurityAuditEvent
import kr.co.genomecompanion.audit.application.AuditChainHasher
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

@Repository
@ConditionalOnBean(JdbcTemplate::class)
class AuditJdbcRepository(
    private val jdbc: JdbcTemplate,
    private val hasher: AuditChainHasher = AuditChainHasher(),
) : SecurityAuditAppender {
    @Transactional
    override fun append(event: NewSecurityAuditEvent): StoredSecurityAuditEvent {
        val previous = jdbc.query(
            "select sequence,event_hash from security_audit_event order by sequence desc limit 1 for update",
        ) { row, _ -> row.getLong("sequence") to row.getString("event_hash") }.singleOrNull()
        val sequence = jdbc.queryForObject(
            "select nextval(pg_get_serial_sequence('security_audit_event','sequence'))",
            Long::class.java,
        ) ?: error("audit sequence unavailable")
        check(previous == null || sequence > previous.first) { "audit sequence did not advance" }
        val previousHash = previous?.second ?: AuditChainHasher.GENESIS
        val eventHash = hasher.hash(sequence, event, previousHash)
        jdbc.update(
            """insert into security_audit_event
                (sequence,event_id,event_type,actor_digest,resource_digest,purpose,outcome,correlation_id,occurred_at,previous_hash,event_hash)
                overriding system value values (?,?,?,?,?,?,?,?,?,?,?)""".trimIndent(),
            sequence, event.eventId, event.eventType.name, event.actorDigest, event.resourceDigest,
            event.purpose, event.outcome.name, event.correlationId, java.sql.Timestamp.from(event.occurredAt),
            previousHash, eventHash,
        )
        return StoredSecurityAuditEvent(sequence, event, previousHash, eventHash)
    }

    fun findAll(): List<StoredSecurityAuditEvent> = jdbc.query(
        "select * from security_audit_event order by sequence",
    ) { row, _ ->
        StoredSecurityAuditEvent(
            row.getLong("sequence"),
            NewSecurityAuditEvent(
                row.getObject("event_id", UUID::class.java),
                kr.co.genomecompanion.audit.api.SecurityAuditType.valueOf(row.getString("event_type")),
                row.getString("actor_digest"), row.getString("resource_digest"), row.getString("purpose"),
                kr.co.genomecompanion.audit.api.AuditOutcome.valueOf(row.getString("outcome")),
                row.getObject("correlation_id", UUID::class.java), row.getTimestamp("occurred_at").toInstant(),
            ),
            row.getString("previous_hash"), row.getString("event_hash"),
        )
    }
}
