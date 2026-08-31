package kr.co.genomecompanion.platform.outbox

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

@Repository
@ConditionalOnProperty(prefix = "gc.consent", name = ["enabled"], havingValue = "true")
class OutboxJdbcRepository(
    private val jdbc: JdbcTemplate,
) : OutboxRepository {
    override fun insert(event: OutboxEvent): Boolean = jdbc.update(
        """insert into platform_outbox(event_id,event_type,aggregate_id,payload,occurred_at)
            values (?,?,?,cast(? as jsonb),?) on conflict (event_id) do nothing""".trimIndent(),
        event.eventId, event.eventType, event.aggregateId, event.payload, java.sql.Timestamp.from(event.occurredAt),
    ) == 1
}
