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
 * Nothing here reads document bytes: the approved source digest only gates the call. The set
 * carries no diagnosis, normality, reference-range, risk, treatment, or medication meaning.
 */
object SyntheticCandidateFixture {
    private val approvedDigestShape = Regex("^[0-9a-f]{64}$")
    private val observed: LocalDate = LocalDate.of(2026, 7, 28)

    private val set = listOf(
        SyntheticCandidate(1, "총콜레스테롤", "188", "mg/dL", observed, 1),
        SyntheticCandidate(2, "당화혈색소", "6.1", "%", observed, 1),
        SyntheticCandidate(3, "비타민 D", "31", "ng/mL", observed, 1),
    )

    fun candidatesFor(sourceSha256: String): List<SyntheticCandidate> {
        require(approvedDigestShape.matches(sourceSha256)) { "approved source digest required" }
        return set
    }
}
