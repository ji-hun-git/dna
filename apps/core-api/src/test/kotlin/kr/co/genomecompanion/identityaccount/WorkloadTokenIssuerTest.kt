package kr.co.genomecompanion.identityaccount

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.nio.charset.StandardCharsets
import java.security.KeyPairGenerator
import java.security.Signature
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.Base64
import java.util.UUID
import kr.co.genomecompanion.identityaccount.workload.Ed25519WorkloadTokenIssuer
import kr.co.genomecompanion.identityaccount.workload.OpaqueSubjectRef
import kr.co.genomecompanion.identityaccount.workload.SignedJwt
import kr.co.genomecompanion.identityaccount.workload.WorkerPurpose
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class WorkloadTokenIssuerTest {
    private val mapper = ObjectMapper()
    private val keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
    private val clock = Clock.fixed(Instant.parse("2026-08-09T00:00:00Z"), ZoneOffset.UTC)
    private val issuer = Ed25519WorkloadTokenIssuer("purpose-2026-08", keyPair.private, mapper, clock)

    @Test
    fun `service token has only the worker service claims and a valid Ed25519 signature`() {
        val token = issuer.issueServiceToken()
        val claims = claims(token)
        assertThat(verify(token)).isTrue()
        assertThat(claims["iss"].asText()).isEqualTo("genome-companion-core-api")
        assertThat(claims["aud"].asText()).isEqualTo("explanation-worker")
        assertThat(claims["sub"].asText()).isEqualTo("core-api")
        assertThat(claims["exp"].asLong() - claims["iat"].asLong()).isEqualTo(120)
        assertThat(claims.has("jti")).isFalse()
        assertThat(claims.has("purpose")).isFalse()
    }

    @Test
    fun `purpose token uses an opaque subject and the exact explanation purpose`() {
        val token = issuer.issuePurposeToken(
            OpaqueSubjectRef("sub_AAAAAAAAAAAAAAAAAAAAAA"),
            UUID.fromString("00000000-0000-0000-0000-000000000019"),
            WorkerPurpose.PERSONAL_RECORD_EXPLANATION,
        )
        val claims = claims(token)
        assertThat(verify(token)).isTrue()
        assertThat(claims["sub"].asText()).isEqualTo("sub_AAAAAAAAAAAAAAAAAAAAAA")
        assertThat(claims["jti"].asText()).isEqualTo("00000000-0000-0000-0000-000000000019")
        assertThat(claims["purpose"].asText()).isEqualTo("personal_record_explanation")
        assertThat(claims.toString()).doesNotContain("cognito-subject", "subject-17")
    }

    private fun claims(token: SignedJwt): JsonNode =
        mapper.readTree(Base64.getUrlDecoder().decode(token.compact.split('.')[1]))

    private fun verify(token: SignedJwt): Boolean {
        val parts = token.compact.split('.')
        return Signature.getInstance("Ed25519").run {
            initVerify(keyPair.public)
            update("${parts[0]}.${parts[1]}".toByteArray(StandardCharsets.US_ASCII))
            verify(Base64.getUrlDecoder().decode(parts[2]))
        }
    }
}
