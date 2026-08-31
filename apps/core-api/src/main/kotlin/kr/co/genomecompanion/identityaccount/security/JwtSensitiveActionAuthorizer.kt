package kr.co.genomecompanion.identityaccount.security

import java.time.Clock
import java.time.Duration
import java.time.Instant
import kr.co.genomecompanion.identityaccount.api.DataRegion
import kr.co.genomecompanion.identityaccount.api.SensitiveAction
import kr.co.genomecompanion.identityaccount.api.SensitiveActionAuthorization
import kr.co.genomecompanion.identityaccount.api.SensitiveActionAuthorizer
import kr.co.genomecompanion.identityaccount.api.SensitiveActionDenial
import kr.co.genomecompanion.identityaccount.api.SensitiveActionDeniedException
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component

@Component
class JwtSensitiveActionAuthorizer(
    private val principalResolver: CallerPrincipalResolver,
    private val clock: Clock,
) : SensitiveActionAuthorizer {
    companion object {
        private val MAX_AGE = Duration.ofMinutes(5)
        private const val ASSURANCE_POLICY = "cognito_mfa_required_pool"
    }

    override fun requireAuthorized(
        authentication: Authentication,
        action: SensitiveAction,
    ): SensitiveActionAuthorization {
        val jwtAuthentication = authentication as? JwtAuthenticationToken
            ?: denied(action, SensitiveActionDenial.SENSITIVE_ACTION_DENIED)
        if (!jwtAuthentication.isAuthenticated) {
            denied(action, SensitiveActionDenial.SENSITIVE_ACTION_DENIED)
        }
        val principal = try {
            principalResolver.resolve(jwtAuthentication)
        } catch (_: RuntimeException) {
            denied(action, SensitiveActionDenial.SENSITIVE_ACTION_DENIED)
        }
        if (principal.subjectId.isBlank() || principal.region != DataRegion.KR) {
            denied(action, SensitiveActionDenial.SENSITIVE_ACTION_DENIED)
        }
        if (action.requiredScope !in principal.scopes) {
            denied(action, SensitiveActionDenial.INSUFFICIENT_ACTION_SCOPE)
        }

        val authTime = when (val claim = jwtAuthentication.token.claims["auth_time"]) {
            is Instant -> claim
            is Number -> Instant.ofEpochSecond(claim.toLong())
            else -> denied(action, SensitiveActionDenial.RECENT_AUTHENTICATION_REQUIRED)
        }
        val age = Duration.between(authTime, clock.instant())
        if (age.isNegative || age > MAX_AGE) {
            denied(action, SensitiveActionDenial.RECENT_AUTHENTICATION_REQUIRED)
        }
        return SensitiveActionAuthorization(principal, action, authTime, ASSURANCE_POLICY)
    }

    private fun denied(action: SensitiveAction, denial: SensitiveActionDenial): Nothing =
        throw SensitiveActionDeniedException(action, denial)
}
