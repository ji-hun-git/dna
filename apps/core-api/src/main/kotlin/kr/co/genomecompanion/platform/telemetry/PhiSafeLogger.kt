package kr.co.genomecompanion.platform.telemetry

import org.slf4j.Logger

class PhiSafeLogger(
    private val logger: Logger,
) {
    fun emit(event: TelemetryEvent, context: SafeTelemetryContext) {
        logger.info(
            "event={} correlation_id={} route_template={} status_class={} latency_ms={}",
            event.code,
            context.correlationId,
            context.routeTemplate ?: "none",
            context.statusClass ?: "none",
            context.latencyMs ?: -1,
        )
    }
}
