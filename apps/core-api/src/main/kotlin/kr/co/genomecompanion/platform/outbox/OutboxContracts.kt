package kr.co.genomecompanion.platform.outbox

import java.time.Instant
import java.util.UUID

data class OutboxEvent(
    val eventId: UUID,
    val eventType: String,
    val aggregateId: UUID,
    val payload: String,
    val occurredAt: Instant,
)

fun interface OutboxRepository {
    fun insert(event: OutboxEvent): Boolean
}
