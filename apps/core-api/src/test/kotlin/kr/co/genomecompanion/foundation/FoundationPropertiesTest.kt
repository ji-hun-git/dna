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
    fun anUnboundDigestResolvesToTheDefaultCandidateSet() {
        val properties = properties()

        assertThat(properties.candidateSetFor(secondDigest))
            .isEqualTo(SyntheticCandidateFixture.DEFAULT_SET_ID)
        assertThat(properties().copy(syntheticDocuments = emptyList()).candidateSetFor(firstDigest))
            .isEqualTo(SyntheticCandidateFixture.DEFAULT_SET_ID)
    }

    @Test
    fun relaxedBindingMapsTheIndexedSyntheticDocumentList() {
        val source = MapConfigurationPropertySource(
            mapOf(
                "gc.foundation.synthetic-documents[0].sha256" to firstDigest,
                "gc.foundation.synthetic-documents[0].set-id" to "checkup-2026-01",
                "gc.foundation.allowed-document-sha256" to "$firstDigest,$secondDigest",
            ),
        )
        val bound = Binder(source).bind("gc.foundation", FoundationProperties::class.java).get()

        assertThat(bound.syntheticDocuments).containsExactly(SyntheticDocumentBinding(firstDigest, "checkup-2026-01"))
        assertThat(bound.allowedDocumentSha256).containsExactlyInAnyOrder(firstDigest, secondDigest)
        assertThat(bound.candidateSetFor(firstDigest)).isEqualTo("checkup-2026-01")
        assertThat(bound.candidateSetFor(secondDigest)).isEqualTo(SyntheticCandidateFixture.DEFAULT_SET_ID)
    }

    @Test
    fun aBoundDigestResolvesToItsNamedCandidateSet() {
        assertThat(properties().candidateSetFor(firstDigest)).isEqualTo("checkup-2026-01")
    }

    @Test
    fun acceptsAValidSyntheticDocumentBinding() {
        assertThatCode { properties().validateEnabledConfiguration() }.doesNotThrowAnyException()
    }

    @Test
    fun rejectsABindingWhoseSetIdIsNotInTheCatalogue() {
        val properties = properties(
            bindings = listOf(SyntheticDocumentBinding(firstDigest, "checkup-1999-01")),
        )

        assertThatThrownBy { properties.validateEnabledConfiguration() }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("candidate set")
    }

    @Test
    fun rejectsABindingWhoseDigestIsNotAllowListed() {
        val properties = properties(
            bindings = listOf(SyntheticDocumentBinding(thirdDigest, "checkup-2026-01")),
        )

        assertThatThrownBy { properties.validateEnabledConfiguration() }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("allow")
    }

    @Test
    fun rejectsAMalformedBindingDigest() {
        val properties = properties(
            bindings = listOf(SyntheticDocumentBinding("NOT-A-DIGEST", "checkup-2026-01")),
        )

        assertThatThrownBy { properties.validateEnabledConfiguration() }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun rejectsTwoBindingsForTheSameDigest() {
        val properties = properties(
            bindings = listOf(
                SyntheticDocumentBinding(firstDigest, "checkup-2026-01"),
                SyntheticDocumentBinding(firstDigest, "checkup-2026-07"),
            ),
        )

        assertThatThrownBy { properties.validateEnabledConfiguration() }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("unique")
    }

    private fun properties(
        bindings: List<SyntheticDocumentBinding> = listOf(
            SyntheticDocumentBinding(firstDigest, "checkup-2026-01"),
        ),
    ) = FoundationProperties(
        enabled = true,
        allowedOrigin = "http://127.0.0.1:3137",
        quarantineRoot = Path.of(System.getProperty("java.io.tmpdir")).resolve("gc-foundation-properties-test"),
        auditPepper = "foundation-properties-test-pepper-64-characters-minimum-value",
        allowedDocumentSha256 = setOf(firstDigest, secondDigest),
        localIdentities = listOf(LocalSyntheticIdentity("synthetic-alice", "d".repeat(64))),
        syntheticDocuments = bindings,
    )

    private companion object {
        private val firstDigest = "a".repeat(64)
        private val secondDigest = "b".repeat(64)
        private val thirdDigest = "c".repeat(64)
    }
}
