package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.time.LocalDate


class SyntheticCandidateFixtureTest {
    @Test
    fun catalogueExposesBothNamedSyntheticSets() {
        assertThat(SyntheticCandidateFixture.DEFAULT_SET_ID).isEqualTo("checkup-2026-07")
        assertThat(SyntheticCandidateFixture.setIds())
            .containsExactlyInAnyOrder("checkup-2026-07", "checkup-2026-01")
    }

    @Test
    fun defaultSetKeepsTheOrderedThreeCandidateValues() {
        val set = SyntheticCandidateFixture.candidatesFor(SyntheticCandidateFixture.DEFAULT_SET_ID)

        assertThat(set.map { it.ordinal }).containsExactly(1, 2, 3)
        assertThat(set.map { it.label }).containsExactly("총콜레스테롤", "당화혈색소", "비타민 D")
        assertThat(set.map { it.value }).containsExactly("188", "5.2", "42")
        assertThat(set.map { it.unit }).containsExactly("mg/dL", "%", "ng/mL")
        assertThat(set[0].sourceTextSha256)
            .isEqualTo(FoundationHashing.sha256("총콜레스테롤|188|mg/dL|2026-07-28"))
        assertThat(set.all { it.observedOn == LocalDate.of(2026, 7, 28) && it.evidencePage == 1 }).isTrue()
    }

    @Test
    fun januarySetCarriesItsOwnOrderedValuesAndObservationDate() {
        val set = SyntheticCandidateFixture.candidatesFor("checkup-2026-01")

        assertThat(set.map { it.ordinal }).containsExactly(1, 2, 3)
        assertThat(set.map { it.label }).containsExactly("총콜레스테롤", "당화혈색소", "비타민 D")
        assertThat(set.map { it.value }).containsExactly("194", "5.4", "45")
        assertThat(set.map { it.unit }).containsExactly("mg/dL", "%", "ng/mL")
        assertThat(set[0].sourceTextSha256)
            .isEqualTo(FoundationHashing.sha256("총콜레스테롤|194|mg/dL|2026-01-15"))
        assertThat(set.all { it.observedOn == LocalDate.of(2026, 1, 15) && it.evidencePage == 1 }).isTrue()
    }

    @Test
    fun everySetIdInTheCatalogueResolvesToAnOrderedSet() {
        SyntheticCandidateFixture.setIds().forEach { setId ->
            assertThat(SyntheticCandidateFixture.candidatesFor(setId).map { it.ordinal })
                .containsExactly(1, 2, 3)
        }
    }

    @Test
    fun rejectsAnUnknownSetId() {
        assertThatThrownBy { SyntheticCandidateFixture.candidatesFor("checkup-1999-01") }
            .isInstanceOf(IllegalArgumentException::class.java)
        assertThatThrownBy { SyntheticCandidateFixture.candidatesFor("a".repeat(64)) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }
}
