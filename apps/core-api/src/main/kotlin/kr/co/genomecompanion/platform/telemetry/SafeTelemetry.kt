package kr.co.genomecompanion.platform.telemetry

import java.util.UUID

enum class TelemetryEvent(val code: String) {
    HTTP_REQUEST_COMPLETED("http_request_completed"),
    AUTHENTICATION_DENIED("authentication_denied"),
    AUTHORIZATION_DENIED("authorization_denied"),
    CONSENT_GRANTED("consent_granted"),
    CONSENT_REVOKED("consent_revoked"),
    DELETION_COMPLETED("deletion_completed"),
    INTERNAL_ERROR("internal_error"),
    STORAGE_UNAVAILABLE("storage_unavailable"),
    QUARANTINE_FILE_DELETE_FAILED("quarantine_file_delete_failed"),

    // Lifecycle state changes (Task 21). One code per state change the foundation service commits;
    // the line carries the code, the route template and a truncated subject hash, never a value.
    SESSION_CREATED("session_created"),
    SESSION_ENDED("session_ended"),
    DOCUMENT_REQUESTED("document_requested"),
    DOCUMENT_UPLOADED("document_uploaded"),
    DOCUMENT_FINALIZED("document_finalized"),
    DOCUMENT_TERMINATED("document_terminated"),
    CANDIDATE_CONFIRMED("candidate_confirmed"),
    CANDIDATE_EXCLUDED("candidate_excluded"),
    RECORD_CORRECTED("record_corrected"),
    EXPORT_COMPLETED("export_completed"),
    WORKER_JOB_LEASED("worker_job_leased"),
    WORKER_JOB_COMPLETED("worker_job_completed"),
    WORKER_JOB_FAILED("worker_job_failed"),

    /**
     * A lifecycle line was dropped because its context failed [PhiSafeLogger]'s own validation. Emitted
     * instead of the rejected line, carrying only the event code that was attempted — never the
     * offending route template or hash, since a value that failed the charset check is exactly the
     * value that must not be written down.
     */
    TELEMETRY_CONTEXT_REJECTED("telemetry_context_rejected"),
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
