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
 * Deterministic catalogue of named synthetic candidate sets for foundation extraction.
 *
 * Nothing here reads document bytes. A set is chosen by *configuration*: an approved source digest
 * is bound to a set id through `gc.foundation.synthetic-documents[n]`, and unbound digests fall back
 * to [DEFAULT_SET_ID]. Neither [setIds] nor [candidatesFor] is an authorization check; the allow-list
 * of approved source digests lives upstream in `FoundationLifecycleService.requestDocument`. The sets
 * carry no diagnosis, normality, reference-range, risk, treatment, or medication meaning; the two
 * dated sets exist only so a synthetic subject can hold the same label on two dates.
 */
object SyntheticCandidateFixture {
    const val DEFAULT_SET_ID = "checkup-2026-07"

    private val catalogue: Map<String, List<SyntheticCandidate>> = mapOf(
        DEFAULT_SET_ID to LocalDate.of(2026, 7, 28).let { observed ->
            listOf(
                SyntheticCandidate(1, "총콜레스테롤", "188", "mg/dL", observed, 1),
                SyntheticCandidate(2, "당화혈색소", "5.2", "%", observed, 1),
                SyntheticCandidate(3, "비타민 D", "42", "ng/mL", observed, 1),
            )
        },
        "checkup-2026-01" to LocalDate.of(2026, 1, 15).let { observed ->
            listOf(
                SyntheticCandidate(1, "총콜레스테롤", "194", "mg/dL", observed, 1),
                SyntheticCandidate(2, "당화혈색소", "5.4", "%", observed, 1),
                SyntheticCandidate(3, "비타민 D", "45", "ng/mL", observed, 1),
            )
        },
    )

    fun setIds(): Set<String> = catalogue.keys.toSet()

    fun candidatesFor(setId: String): List<SyntheticCandidate> =
        requireNotNull(catalogue[setId]) { "unknown synthetic candidate set id" }
}
