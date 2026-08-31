package kr.co.genomecompanion.identityaccount

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kr.co.genomecompanion.identityaccount.api.DataRegion
import kr.co.genomecompanion.identityaccount.api.SensitiveAction
import kr.co.genomecompanion.identityaccount.api.SensitiveActionDenial
import kr.co.genomecompanion.identityaccount.api.SensitiveActionDeniedException
import kr.co.genomecompanion.identityaccount.security.CallerPrincipalResolver
import kr.co.genomecompanion.identityaccount.security.JwtSensitiveActionAuthorizer
import kr.co.genomecompanion.identityaccount.security.StrictJwtAuthenticationConverter
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.EnumSource
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.jwt.Jwt

class SensitiveActionAuthorizerTest {
    private val now = Instant.parse("2026-08-09T00:05:00Z")
    private val authorizer = JwtSensitiveActionAuthorizer(
        CallerPrincipalResolver(),
        Clock.fixed(now, ZoneOffset.UTC),
    )

    @ParameterizedTest
    @EnumSource(SensitiveAction::class)
    fun `fresh strong KR authentication authorizes only its action scope`(action: SensitiveAction) {
        val authorization = authorizer.requireAuthorized(
            authentication(action.requiredScope, now.minusSeconds(299)),
            action,
        )
        assertThat(authorization.principal.subjectId).isEqualTo("cognito-subject-7")
        assertThat(authorization.principal.region).isEqualTo(DataRegion.KR)
        assertThat(authorization.action).isEqualTo(action)
    }

    @Test
    fun `missing scope or stale authentication is denied`() {
        val validScope = SensitiveAction.EXPORT_RECORDS.requiredScope
        listOf(
            authentication("consent:read", now.minusSeconds(60)),
            authentication(validScope, now.minusSeconds(301)),
        ).forEach { candidate ->
            assertThatThrownBy {
                authorizer.requireAuthorized(candidate, SensitiveAction.EXPORT_RECORDS)
            }.isInstanceOf(SensitiveActionDeniedException::class.java)
        }
    }

    @Test
    fun `export scope cannot authorize profile reset`() {
        val failure = assertThrows<SensitiveActionDeniedException> {
            authorizer.requireAuthorized(
                authentication("records:export", now.minusSeconds(60)),
                SensitiveAction.RESET_PROFILE,
            )
        }
        assertThat(failure.denial).isEqualTo(SensitiveActionDenial.INSUFFICIENT_ACTION_SCOPE)
    }

    @Test
    fun `unvalidated authentication type is denied`() {
        val unvalidated = UsernamePasswordAuthenticationToken("cognito-subject-7", "never-log-this")
        assertThatThrownBy {
            authorizer.requireAuthorized(unvalidated, SensitiveAction.RESET_PROFILE)
        }.isInstanceOf(SensitiveActionDeniedException::class.java)
    }

    private fun authentication(scope: String, authTime: Instant): Authentication {
        val jwt = Jwt.withTokenValue("synthetic-token-never-logged")
            .header("alg", "RS256")
            .subject("cognito-subject-7")
            .issuer("https://issuer.test.invalid")
            .audience(listOf("https://api.genome-companion.kr"))
            .claim("client_id", "synthetic-web-client")
            .issuedAt(now.minusSeconds(360))
            .expiresAt(now.plusSeconds(300))
            .claim(
                "scope",
                when (scope) {
                    "consent:read" -> "https://api.genome-companion.kr/consent.read"
                    "records:export" -> "https://api.genome-companion.kr/records.export"
                    "profile:reset" -> "https://api.genome-companion.kr/profile.reset"
                    else -> scope
                },
            )
            .claim("auth_time", authTime.epochSecond)
            .build()
        return StrictJwtAuthenticationConverter().convert(jwt)
    }
}
