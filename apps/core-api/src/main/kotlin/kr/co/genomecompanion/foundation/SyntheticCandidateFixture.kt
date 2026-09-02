package kr.co.genomecompanion.foundation

import java.time.LocalDate


data class SyntheticCandidate(
    val ordinal: Int,
    val label: String,
    val value: String,
    val unit: String,
    val observedOn: LocalDate,
    val evidencePage: Int,
) {
    val sourceTextSha256: String = FoundationHashing.sha256("$label|$value|$unit|$observedOn")
}


/**
 * Deterministic synthetic candidate set for foundation extraction.
 *
 * Nothing here reads document bytes. [candidatesFor] only checks that the argument has the *shape*
 * of a sha256 source digest; it is not an authorization check. The allow-list of approved source
 * digests lives upstream in `FoundationLifecycleService.requestDocument`. The set carries no
 * diagnosis, normality, reference-range, risk, treatment, or medication meaning.
 */
object SyntheticCandidateFixture {
    private val sourceDigestShape = Regex("^[0-9a-f]{64}$")
    private val observed: LocalDate = LocalDate.of(2026, 7, 28)

    private val set = listOf(
        SyntheticCandidate(1, "총콜레스테롤", "188", "mg/dL", observed, 1),
        SyntheticCandidate(2, "당화혈색소", "5.2", "%", observed, 1),
        SyntheticCandidate(3, "비타민 D", "42", "ng/mL", observed, 1),
    )

    fun candidatesFor(sourceSha256: String): List<SyntheticCandidate> {
        require(sourceDigestShape.matches(sourceSha256)) { "source digest shape required" }
        return set
    }
}
