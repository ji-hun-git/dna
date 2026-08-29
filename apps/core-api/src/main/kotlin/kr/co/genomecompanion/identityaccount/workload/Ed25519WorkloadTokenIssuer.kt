package kr.co.genomecompanion.identityaccount.workload

import com.fasterxml.jackson.databind.ObjectMapper
import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec
import java.time.Clock
import java.util.Base64
import java.util.LinkedHashMap
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile

object Ed25519PrivateKeyDecoder {
    fun fromPkcs8Base64(encoded: String): PrivateKey = KeyFactory.getInstance("Ed25519")
        .generatePrivate(PKCS8EncodedKeySpec(Base64.getDecoder().decode(encoded)))
}

class Ed25519WorkloadTokenIssuer(
    private val keyId: String,
    private val privateKey: PrivateKey,
    private val mapper: ObjectMapper,
    private val clock: Clock,
) : WorkloadTokenIssuer {
    companion object {
        private const val ISSUER = "genome-companion-core-api"
        private const val AUDIENCE = "explanation-worker"
        private const val LIFETIME_SECONDS = 120L
    }

    override fun issueServiceToken(): SignedJwt = sign(
        linkedMapOf(
            "iss" to ISSUER,
            "aud" to AUDIENCE,
            "sub" to "core-api",
        ),
    )

    override fun issuePurposeToken(
        subject: OpaqueSubjectRef,
        jti: java.util.UUID,
        purpose: WorkerPurpose,
    ): SignedJwt = sign(
        linkedMapOf(
            "iss" to ISSUER,
            "aud" to AUDIENCE,
            "sub" to subject.value,
            "jti" to jti.toString(),
            "purpose" to purpose.claimValue,
        ),
    )

    private fun sign(baseClaims: LinkedHashMap<String, Any>): SignedJwt {
        val issuedAt = clock.instant().epochSecond
        val claims = LinkedHashMap(baseClaims).apply {
            put("iat", issuedAt)
            put("exp", issuedAt + LIFETIME_SECONDS)
        }
        val header = linkedMapOf("alg" to "EdDSA", "kid" to keyId, "typ" to "JWT")
        val encoder = Base64.getUrlEncoder().withoutPadding()
        val signingInput = listOf(header, claims)
            .joinToString(".") { encoder.encodeToString(mapper.writeValueAsBytes(it)) }
        val signature = Signature.getInstance("Ed25519").run {
            initSign(privateKey)
            update(signingInput.toByteArray(StandardCharsets.US_ASCII))
            sign()
        }
        return SignedJwt("$signingInput.${encoder.encodeToString(signature)}")
    }
}

@Configuration
@Profile("!test")
@ConditionalOnProperty(prefix = "gc.workload-tokens", name = ["enabled"], havingValue = "true")
class WorkloadTokenConfiguration {
    @Bean
    fun workloadTokenIssuer(
        @Value("\${WORKLOAD_TOKEN_KEY_ID}") keyId: String,
        @Value("\${WORKLOAD_TOKEN_PRIVATE_PKCS8_B64}") privateKey: String,
        mapper: ObjectMapper,
        clock: Clock,
    ): WorkloadTokenIssuer = Ed25519WorkloadTokenIssuer(
        keyId,
        Ed25519PrivateKeyDecoder.fromPkcs8Base64(privateKey),
        mapper,
        clock,
    )
}
