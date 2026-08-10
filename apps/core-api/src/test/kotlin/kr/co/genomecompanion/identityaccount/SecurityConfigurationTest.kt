package kr.co.genomecompanion.identityaccount

import java.time.Instant
import kr.co.genomecompanion.identityaccount.security.AudienceValidator
import kr.co.genomecompanion.identityaccount.security.CallerPrincipalResolver
import kr.co.genomecompanion.identityaccount.security.ClientIdValidator
import kr.co.genomecompanion.identityaccount.security.CognitoClaimShapeValidator
import kr.co.genomecompanion.identityaccount.security.StrictJwtAuthenticationConverter
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.core.OAuth2AuthenticationException
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest(
    properties = [
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
    ],
)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityConfigurationTest(
    @param:Autowired private val mvc: MockMvc,
) {
    @Test
    fun `readiness is public but all v1 routes require a bearer token`() {
        mvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk)
        mvc.perform(get("/v1/not-mapped")).andExpect(status().isUnauthorized)
    }

    @Test
    fun `resource audience validator rejects a token for another API`() {
        val token = Jwt.withTokenValue("synthetic-token")
            .header("alg", "none")
            .subject("cognito-subject-7")
            .audience(listOf("https://other-api.invalid"))
            .issuer("https://issuer.test.invalid")
            .issuedAt(Instant.parse("2026-08-09T00:00:00Z"))
            .expiresAt(Instant.parse("2026-08-09T00:05:00Z"))
            .build()
        assertThat(AudienceValidator("https://api.genome-companion.kr").validate(token).hasErrors()).isTrue()
    }

    @Test
    fun `verified token reaches routing without exposing its subject`() {
        mvc.perform(
            get("/v1/not-mapped").with(
                jwt().jwt {
                    it.subject("cognito-subject-7")
                    it.audience(listOf("https://api.genome-companion.kr"))
                    it.claim("client_id", "synthetic-web-client")
                    it.claim("scope", "https://api.genome-companion.kr/consent.read")
                    it.claim("auth_time", 1_786_233_600L)
                    it.issuer("https://issuer.test.invalid")
                },
            ),
        ).andExpect(status().isNotFound)
    }

    @Test
    fun `strict converter and principal resolver derive one shared normalized scope set`() {
        val token = token()
        assertThat(AudienceValidator(API_AUDIENCE).validate(token).hasErrors()).isFalse()
        assertThat(ClientIdValidator(CLIENT_ID).validate(token).hasErrors()).isFalse()
        assertThat(CognitoClaimShapeValidator().validate(token).hasErrors()).isFalse()

        val authentication = StrictJwtAuthenticationConverter().convert(token)
        assertThat(authentication.authorities.map { it.authority })
            .containsExactly("SCOPE_consent:read")
        assertThat(CallerPrincipalResolver().resolve(authentication).scopes)
            .containsExactly("consent:read")
    }

    @Test
    fun `wrong claim shapes fail closed without becoming authorities`() {
        assertThat(AudienceValidator(API_AUDIENCE).validate(token(audience = listOf(API_AUDIENCE, "https://other.invalid"))).hasErrors())
            .isTrue()
        assertThat(ClientIdValidator(CLIENT_ID).validate(token(clientId = listOf(CLIENT_ID))).hasErrors()).isTrue()
        val malformedClaims = listOf(
            token(subject = ""),
            token(scope = listOf("https://api.genome-companion.kr/consent.read")),
            token(scope = "https://api.genome-companion.kr/consent.read https://api.genome-companion.kr/consent.read"),
            token(scope = "consent:read"),
            token(scope = "https://api.genome-companion.kr/unknown"),
            token(authTime = true),
            token(authTime = "1786233600"),
        )
        malformedClaims.forEach { malformed ->
            assertThat(CognitoClaimShapeValidator().validate(malformed).hasErrors()).isTrue()
        }
        malformedClaims.take(5).forEach { malformed ->
            assertThatThrownBy { StrictJwtAuthenticationConverter().convert(malformed) }
                .isInstanceOf(OAuth2AuthenticationException::class.java)
        }
    }

    private fun token(
        audience: List<String> = listOf(API_AUDIENCE),
        subject: String = "cognito-subject-7",
        clientId: Any = CLIENT_ID,
        scope: Any = "https://api.genome-companion.kr/consent.read",
        authTime: Any = 1_786_233_600L,
    ): Jwt = Jwt.withTokenValue("synthetic-token-never-logged")
        .header("alg", "RS256")
        .subject(subject)
        .audience(audience)
        .issuer("https://issuer.test.invalid")
        .issuedAt(Instant.parse("2026-08-09T00:00:00Z"))
        .expiresAt(Instant.parse("2026-08-09T00:05:00Z"))
        .claim("client_id", clientId)
        .claim("scope", scope)
        .claim("auth_time", authTime)
        .build()

    companion object {
        private const val API_AUDIENCE = "https://api.genome-companion.kr"
        private const val CLIENT_ID = "synthetic-web-client"
    }
}
