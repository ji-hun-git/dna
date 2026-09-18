package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.boot.context.properties.bind.Binder
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource
import java.nio.file.Path


class FoundationPropertiesTest {
    @Test
    fun demoBootstrapIsDisabledByDefaultAndCannotSilentlyReplaceIdentityConfiguration() {
        assertThat(FoundationProperties().demoBootstrapEnabled).isFalse()
        assertThatThrownBy { properties().copy(localIdentities = emptyList()).validateEnabledConfiguration() }
            .isInstanceOf(IllegalArgumentException::class.java)
        assertThatCode {
            properties().copy(localIdentities = emptyList(), demoBootstrapEnabled = true).validateEnabledConfiguration()
        }.doesNotThrowAnyException()
    }

    @Test
    fun acceptsAValidConfigurationWithoutAnyCandidateBinding() {
        assertThatCode { properties().validateEnabledConfiguration() }.doesNotThrowAnyException()
    }

    @Test
    fun rejectsOutOfRangeSessionLimiterConfiguration() {
        assertThatThrownBy { properties().copy(sessionRateLimitPerMinute = 0).validateEnabledConfiguration() }
            .isInstanceOf(IllegalArgumentException::class.java)
        assertThatThrownBy { properties().copy(sessionFailureLockThreshold = 0).validateEnabledConfiguration() }
            .isInstanceOf(IllegalArgumentException::class.java)
        assertThatThrownBy {
            properties().copy(sessionFailureLockDuration = java.time.Duration.ofSeconds(1)).validateEnabledConfiguration()
        }.isInstanceOf(IllegalArgumentException::class.java)
        assertThatThrownBy { properties().copy(workerRateLimitPerMinute = 0).validateEnabledConfiguration() }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun relaxedBindingMapsTheAllowListWithoutASyntheticDocumentBinding() {
        val source = MapConfigurationPropertySource(
            mapOf("gc.foundation.allowed-document-sha256" to "$firstDigest,$secondDigest"),
        )
        val bound = Binder(source).bind("gc.foundation", FoundationProperties::class.java).get()

        assertThat(bound.allowedDocumentSha256).containsExactlyInAnyOrder(firstDigest, secondDigest)
        assertThat(FoundationProperties::class.java.declaredFields.map { it.name }).doesNotContain("syntheticDocuments")
    }

    private fun properties() = FoundationProperties(
        enabled = true,
        allowedOrigin = "http://127.0.0.1:3137",
        quarantineRoot = Path.of(System.getProperty("java.io.tmpdir")).resolve("gc-foundation-properties-test"),
        auditPepper = "foundation-properties-test-pepper-64-characters-minimum-value",
        allowedDocumentSha256 = setOf(firstDigest, secondDigest),
        localIdentities = listOf(LocalSyntheticIdentity("synthetic-alice", "d".repeat(64))),
    )

    private companion object {
        private val firstDigest = "a".repeat(64)
        private val secondDigest = "b".repeat(64)
    }
}
