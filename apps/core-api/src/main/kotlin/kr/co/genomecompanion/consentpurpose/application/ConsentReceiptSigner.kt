package kr.co.genomecompanion.consentpurpose.application

import com.fasterxml.jackson.databind.ObjectMapper
import java.security.MessageDigest
import java.util.Base64
import java.util.HexFormat
import java.util.LinkedHashMap
import kr.co.genomecompanion.consentpurpose.domain.ConsentGrant
import org.springframework.stereotype.Component
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Profile
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kr.co.genomecompanion.consentpurpose.api.SubjectPseudonymizer

@Component
class ConsentReceiptSigner(
    private val mapper: ObjectMapper = ObjectMapper(),
) {
    fun sign(grant: ConsentGrant): String {
        val receipt = LinkedHashMap<String, Any?>().apply {
            put("consentId", grant.consentId.toString())
            put("subjectDigest", grant.subjectDigest)
            put("purpose", grant.purpose.name)
            put("sources", grant.sources.map { it.name }.sorted())
            put("dataCategories", grant.dataCategories.map { it.name }.sorted())
            put("operations", grant.operations.map { it.name }.sorted())
            put("recipients", grant.recipients.sorted())
            put("processorSetVersion", grant.processorSetVersion)
            put("noticeVersion", grant.noticeVersion)
            put("region", grant.region.name)
            put("grantedAt", grant.grantedAt.toString())
            put("expiresAt", grant.expiresAt?.toString())
            put("revokedAt", grant.revokedAt?.toString())
        }
        val digest = MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(receipt))
        return "sha256:" + HexFormat.of().formatHex(digest)
    }
}

@Component
@Profile("!test")
class HmacSubjectPseudonymizer(
    @Value("\${SUBJECT_PSEUDONYM_HMAC_B64}") encodedKey: String,
) : SubjectPseudonymizer {
    private val key = SecretKeySpec(Base64.getDecoder().decode(encodedKey), "HmacSHA256")

    override fun digest(subjectId: String): String {
        require(subjectId.isNotBlank())
        val digest = Mac.getInstance("HmacSHA256").run {
            init(key)
            doFinal(subjectId.toByteArray(Charsets.UTF_8))
        }
        return "hmac256:" + HexFormat.of().formatHex(digest)
    }
}
