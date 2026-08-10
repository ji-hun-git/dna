package kr.co.genomecompanion.identityaccount.api

import java.time.Instant
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.Authentication

enum class SensitiveAction(val requiredScope: String) {
    EXPORT_RECORDS("records:export"),
    RESET_PROFILE("profile:reset"),
}

data class SensitiveActionAuthorization(
    val principal: CallerPrincipal,
    val action: SensitiveAction,
    val authenticatedAt: Instant,
    val assurancePolicy: String,
)

data class SensitiveActionAssuranceRequirement(
    val action: SensitiveAction,
    val requiredScope: String,
    val maxAuthAgeSeconds: Long,
    val assurancePolicy: String,
    val region: DataRegion,
) {
    companion object {
        fun forAction(action: SensitiveAction) = SensitiveActionAssuranceRequirement(
            action = action,
            requiredScope = action.requiredScope,
            maxAuthAgeSeconds = 300,
            assurancePolicy = "cognito_mfa_required_pool",
            region = DataRegion.KR,
        )
    }
}

enum class SensitiveActionDenial(val code: String) {
    RECENT_AUTHENTICATION_REQUIRED("recent_authentication_required"),
    INSUFFICIENT_ACTION_SCOPE("insufficient_action_scope"),
    SENSITIVE_ACTION_DENIED("sensitive_action_denied"),
}

fun interface SensitiveActionAuthorizer {
    fun requireAuthorized(
        authentication: Authentication,
        action: SensitiveAction,
    ): SensitiveActionAuthorization
}

class SensitiveActionDeniedException(
    val action: SensitiveAction,
    val denial: SensitiveActionDenial,
) : AccessDeniedException("sensitive action denied")
