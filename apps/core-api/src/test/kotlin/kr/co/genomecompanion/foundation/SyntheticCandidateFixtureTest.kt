package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.time.LocalDate


class SyntheticCandidateFixtureTest {
    @Test
    fun everyApprovedDigestYieldsTheOrderedThreeCandidateSet() {
        val set = SyntheticCandidateFixture.candidatesFor("a".repeat(64))

        assertThat(set.map { it.ordinal }).containsExactly(1, 2, 3)
        assertThat(set.map { it.label }).containsExactly("총콜레스테롤", "당화혈색소", "비타민 D")
        assertThat(set.map { it.value }).containsExactly("188", "5.2", "42")
        assertThat(set.map { it.unit }).containsExactly("mg/dL", "%", "ng/mL")
        assertThat(set[0].sourceTextSha256)
            .isEqualTo(FoundationHashing.sha256("총콜레스테롤|188|mg/dL|2026-07-28"))
        assertThat(set.all { it.observedOn == LocalDate.of(2026, 7, 28) && it.evidencePage == 1 }).isTrue()
    }

    @Test
    fun rejectsAMalformedSourceDigest() {
        assertThatThrownBy { SyntheticCandidateFixture.candidatesFor("not-a-digest") }
            .isInstanceOf(IllegalArgumentException::class.java)
    }
}
