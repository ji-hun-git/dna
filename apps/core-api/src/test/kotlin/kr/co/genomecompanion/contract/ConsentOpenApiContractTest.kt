package kr.co.genomecompanion.contract

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import java.nio.file.Path
import kr.co.genomecompanion.consentpurpose.api.ConsentOperation
import kr.co.genomecompanion.consentpurpose.api.ConsentPurpose
import kr.co.genomecompanion.consentpurpose.api.DataCategory
import kr.co.genomecompanion.consentpurpose.api.DataSource
import kr.co.genomecompanion.identityaccount.api.SensitiveAction
import kr.co.genomecompanion.identityaccount.api.SensitiveActionDenial
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ConsentOpenApiContractTest {
    private val repository = Path.of("../..").toAbsolutePath().normalize()
    private val api = ObjectMapper(YAMLFactory()).registerKotlinModule().readTree(
        repository.resolve("packages/contracts/openapi/consent-api-v1.yaml").toFile(),
    )

    @Test
    fun `consent operation ids and scopes are stable for generated clients`() {
        assertThat(api.path("openapi").asText()).isEqualTo("3.1.0")
        assertThat(api.at("/paths/~1v1~1consents/post/operationId").asText()).isEqualTo("grantConsent")
        assertThat(api.at("/paths/~1v1~1consents/get/operationId").asText()).isEqualTo("listConsents")
        assertThat(api.at("/paths/~1v1~1consents~1{consentId}/delete/operationId").asText()).isEqualTo("revokeConsent")
        assertThat(strings("/paths/~1v1~1consents/post/security/0/oauth2")).containsExactly("consent:write")
        assertThat(strings("/paths/~1v1~1consents/get/security/0/oauth2")).containsExactly("consent:read")
        assertThat(api.at("/paths/~1v1~1consent-options/get/operationId").asText()).isEqualTo("getConsentOptions")
    }

    @Test
    fun `schemas match native enums request response and receipt`() {
        assertThat(strings("/components/schemas/ConsentPurpose/enum"))
            .containsExactlyElementsOf(ConsentPurpose.entries.map { it.name })
        assertThat(strings("/components/schemas/ConsentOperation/enum"))
            .containsExactlyElementsOf(ConsentOperation.entries.map { it.name })
        assertThat(strings("/components/schemas/DataCategory/enum"))
            .containsExactlyElementsOf(DataCategory.entries.map { it.name })
        assertThat(strings("/components/schemas/DataSource/enum"))
            .containsExactlyElementsOf(DataSource.entries.map { it.name })
        assertThat(strings("/components/schemas/GrantConsentRequest/required")).containsExactlyInAnyOrder(
            "purpose", "sources", "dataCategories", "operations", "recipients",
            "processorSetVersion", "noticeVersion", "expiresAt",
        )
        assertThat(api.at("/components/schemas/ConsentView/properties/signatureReceipt/pattern").asText())
            .isEqualTo("^sha256:[0-9a-f]{64}$")
    }

    @Test
    fun `sensitive action assurance remains machine readable`() {
        assertThat(strings("/components/schemas/SensitiveAction/enum"))
            .containsExactlyElementsOf(SensitiveAction.entries.map { it.name })
        assertThat(api.at("/components/schemas/SensitiveActionAssuranceRequirement/properties/maxAuthAgeSeconds/const").asLong())
            .isEqualTo(300)
        assertThat(strings("/components/schemas/SensitiveActionProblem/properties/code/enum"))
            .containsExactlyElementsOf(SensitiveActionDenial.entries.map { it.code })
        assertThat(api.at("/components/responses/RecentSensitiveActionRequired/x-http-status").asInt()).isEqualTo(403)
    }

    private fun strings(pointer: String): List<String> = api.at(pointer).map { it.asText() }
}
