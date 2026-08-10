package kr.co.genomecompanion.consentpurpose.application

import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.net.URI
import java.security.MessageDigest
import java.time.Instant
import java.util.HexFormat
import java.util.LinkedHashMap
import kr.co.genomecompanion.consentpurpose.api.ConsentOptionsService
import kr.co.genomecompanion.consentpurpose.api.ConsentOptionsView
import kr.co.genomecompanion.identityaccount.api.DataRegion
import org.springframework.stereotype.Component

@Component
class ReleasePinnedConsentOptionsService(
    private val resourceName: String = "/consent/consent-options-v1.json",
) : ConsentOptionsService {
    private val view: ConsentOptionsView by lazy(::load)
    override fun current(): ConsentOptionsView = view

    private fun load(): ConsentOptionsView {
        val mapper = ObjectMapper().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
        val bytes = requireNotNull(javaClass.getResourceAsStream(resourceName)) { "missing consent options" }.readAllBytes()
        val root = mapper.readTree(bytes)
        val expectedFields = setOf(
            "processorSetVersion", "noticeVersion", "recipients", "region",
            "cloudProcessingMaxHours", "retentionMaxDays", "noticeUrl", "effectiveAt", "configurationDigest",
        )
        require(root.fieldNames().asSequence().toSet() == expectedFields) { "invalid consent options fields" }
        val digest = digest(mapper, root)
        require(root["configurationDigest"].asText() == digest) { "consent options digest mismatch" }
        val recipients = root["recipients"].map(JsonNode::asText).toSet()
        require(recipients == setOf("genome-companion-korea"))
        require(root["region"].asText() == "KR")
        require(root["cloudProcessingMaxHours"].asInt() == 24)
        require(root["retentionMaxDays"].asInt() == 365)
        val notice = URI.create(root["noticeUrl"].asText())
        require(notice.scheme == "https")
        return ConsentOptionsView(
            root["processorSetVersion"].asText(), root["noticeVersion"].asText(), recipients,
            DataRegion.KR, 24, 365, notice, Instant.parse(root["effectiveAt"].asText()), digest,
        )
    }

    private fun digest(mapper: ObjectMapper, root: JsonNode): String {
        val canonical = LinkedHashMap<String, Any>().apply {
            put("processorSetVersion", root["processorSetVersion"].asText())
            put("noticeVersion", root["noticeVersion"].asText())
            put("recipients", root["recipients"].map(JsonNode::asText).sorted())
            put("region", root["region"].asText())
            put("cloudProcessingMaxHours", root["cloudProcessingMaxHours"].asInt())
            put("retentionMaxDays", root["retentionMaxDays"].asInt())
            put("noticeUrl", root["noticeUrl"].asText())
            put("effectiveAt", root["effectiveAt"].asText())
        }
        return "sha256:" + HexFormat.of().formatHex(
            MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(canonical)),
        )
    }
}
