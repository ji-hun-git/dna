package kr.co.genomecompanion.platform.telemetry

import java.util.UUID

enum class TelemetryEvent(val code: String) {
    HTTP_REQUEST_COMPLETED("http_request_completed"),
    AUTHENTICATION_DENIED("authentication_denied"),
    AUTHORIZATION_DENIED("authorization_denied"),
    CONSENT_GRANTED("consent_granted"),
    CONSENT_REVOKED("consent_revoked"),
    DELETION_COMPLETED("deletion_completed"),
}

data class SafeTelemetryContext(
    val correlationId: UUID,
    val routeTemplate: String?,
    val statusClass: String?,
    val latencyMs: Long?,
) {
    init {
        require(routeTemplate == null || routeTemplate.matches(Regex("^/[A-Za-z0-9_/{}/-]{1,127}$")))
        require(statusClass == null || statusClass.matches(Regex("^[1-5]xx$")))
        require(latencyMs == null || latencyMs >= 0)
    }
}
