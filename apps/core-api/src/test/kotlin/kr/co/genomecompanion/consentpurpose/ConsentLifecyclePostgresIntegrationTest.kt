package kr.co.genomecompanion.consentpurpose

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.Base64


@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "GC_TEST_POSTGRES_URL", matches = ".+")
class ConsentLifecyclePostgresIntegrationTest @Autowired constructor(
    private val mockMvc: MockMvc,
    private val mapper: ObjectMapper,
    private val jdbc: JdbcTemplate,
) {
    @BeforeEach
    fun resetConsentDatabase() {
        jdbc.execute("TRUNCATE TABLE platform_outbox, consent_grant")
    }

    @Test
    fun `jwt caller grants reads and idempotently revokes durable purpose consent`() {
        mockMvc.perform(
            post("/v1/consents")
                .with(caller("synthetic-alice", "consent:read"))
                .contentType("application/json")
                .content(mapper.writeValueAsBytes(command())),
        ).andExpect(status().isForbidden)

        val grant = mockMvc.perform(
            post("/v1/consents")
                .with(caller("synthetic-alice", "consent:write"))
                .contentType("application/json")
                .content(mapper.writeValueAsBytes(command())),
        ).andExpect(status().isOk)
            .andReturn()
            .response
            .contentAsByteArray
            .let(mapper::readTree)

        val consentId = grant.requiredText("consentId")
        assertThat(grant.requiredText("signatureReceipt")).matches("^sha256:[0-9a-f]{64}$")

        val aliceList = mockMvc.perform(
            get("/v1/consents").with(caller("synthetic-alice", "consent:read")),
        ).andExpect(status().isOk)
            .andReturn()
            .response
            .contentAsByteArray
            .let(mapper::readTree)
        assertThat(aliceList.size()).isEqualTo(1)

        val bobList = mockMvc.perform(
            get("/v1/consents").with(caller("synthetic-bob", "consent:read")),
        ).andExpect(status().isOk)
            .andReturn()
            .response
            .contentAsByteArray
            .let(mapper::readTree)
        assertThat(bobList.size()).isZero()

        mockMvc.perform(
            delete("/v1/consents/{consentId}", consentId)
                .with(caller("synthetic-bob", "consent:write")),
        ).andExpect(status().isNotFound)

        repeat(2) {
            mockMvc.perform(
                delete("/v1/consents/{consentId}", consentId)
                    .with(caller("synthetic-alice", "consent:write")),
            ).andExpect(status().isOk)
        }

        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM consent_grant WHERE consent_id = CAST(? AS uuid) AND revoked_at IS NOT NULL",
                Long::class.java,
                consentId,
            ),
        ).isEqualTo(1)
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM platform_outbox WHERE event_type = 'consent.revoked.v1'",
                Long::class.java,
            ),
        ).isEqualTo(1)
    }

    private fun caller(subject: String, scope: String) = jwt()
        .jwt { token ->
            token.subject(subject)
            token.audience(listOf("https://api.genome-companion.test"))
            token.issuer("https://issuer.test.invalid")
            token.claim("client_id", "synthetic-web-client")
            token.claim("scope", "https://api.genome-companion.test/${scope.replace(':', '.')}")
            token.claim("auth_time", 1_786_233_600L)
        }
        .authorities(SimpleGrantedAuthority("SCOPE_$scope"))

    private fun command(): Map<String, Any?> = linkedMapOf(
        "purpose" to "BUILD_PERSONAL_LAB_TIMELINE",
        "sources" to listOf("USER_UPLOAD"),
        "dataCategories" to listOf("LAB_REPORT"),
        "operations" to listOf("COLLECT", "EXPLAIN"),
        "recipients" to listOf("genome-companion-korea"),
        "processorSetVersion" to "kr-core-2026-08",
        "noticeVersion" to "privacy-notice-ko-v1",
        "expiresAt" to null,
    )

    private fun JsonNode.requiredText(name: String): String =
        get(name)?.asText()?.takeIf(String::isNotBlank) ?: error("missing $name")

    companion object {
        @JvmStatic
        @DynamicPropertySource
        fun consentProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url") { checkNotNull(System.getenv("GC_TEST_POSTGRES_URL")) }
            registry.add("spring.datasource.username") { System.getenv("GC_TEST_POSTGRES_USERNAME") ?: "postgres" }
            registry.add("spring.datasource.password") { System.getenv("GC_TEST_POSTGRES_PASSWORD") ?: "" }
            registry.add("security.oidc.enabled") { "true" }
            registry.add("security.oidc.issuer") { "https://issuer.test.invalid" }
            registry.add("security.oidc.jwk-set-uri") { "https://issuer.test.invalid/.well-known/jwks.json" }
            registry.add("security.oidc.audience") { "https://api.genome-companion.test" }
            registry.add("security.oidc.client-id") { "synthetic-web-client" }
            registry.add("gc.consent.enabled") { "true" }
            registry.add("SUBJECT_PSEUDONYM_HMAC_B64") {
                Base64.getEncoder().encodeToString(ByteArray(32) { 7 })
            }
        }
    }
}
