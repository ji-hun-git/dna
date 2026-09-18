package kr.co.genomecompanion.foundation

import jakarta.validation.Validation
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test


class ExtractionResultRequestValidationTest {
    private val validator = Validation.buildDefaultValidatorFactory().validator

    @Test
    fun acceptsAWorkerRequestWithCandidatesAndAbstentions() {
        assertThat(validator.validate(request())).isEmpty()
        assertThat(validator.validate(request(candidates = emptyList(), abstentions = listOf(abstention())))).isEmpty()
    }

    @Test
    fun defaultsToTheNativeTextMethodAndEmptyLists() {
        val minimal = ExtractionResultRequest(
            sourceSha256 = "a".repeat(64),
            workerImageDigest = "b".repeat(64),
            generatorVersion = "document-worker-v2",
            previewPngBase64 = "x".repeat(92),
        )
        assertThat(minimal.extractionMethod).isEqualTo("native-text")
        assertThat(minimal.candidates).isEmpty()
        assertThat(minimal.abstentions).isEmpty()
    }

    @Test
    fun rejectsAnyOtherExtractionMethod() {
        assertThat(validator.validate(request(extractionMethod = "ocr"))).isNotEmpty()
    }

    @Test
    fun rejectsMalformedCandidateFields() {
        assertThat(validator.validate(request(candidates = listOf(candidate(ordinal = 0))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(label = ""))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(label = "가".repeat(81)))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(value = "abc"))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(unit = "가".repeat(33)))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(observedOn = "2026/07/28"))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(evidencePage = 21))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(sourceTextSha256 = "Z".repeat(64)))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(evidenceBox = EvidenceBox(1.2, 0.1, 0.1, 0.1)))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(evidenceBox = EvidenceBox(0.9, 0.1, 0.9, 0.1)))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(evidenceBox = EvidenceBox(0.1, 0.9, 0.1, 0.9)))))).isNotEmpty()
    }

    @Test
    fun acceptsANullOrShortOriginalLabelButRejectsOneOverEightyCharacters() {
        assertThat(validator.validate(request(candidates = listOf(candidate(originalLabel = null))))).isEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(originalLabel = "혈압"))))).isEmpty()
        assertThat(validator.validate(request(candidates = listOf(candidate(originalLabel = "가".repeat(81)))))).isNotEmpty()
        assertThat(candidate().originalLabel).isNull()
    }

    @Test
    fun acceptsExactlyTheSevenClosedAbstentionReasons() {
        for (reason in listOf("unreadable", "ambiguous_value", "ambiguous_unit", "missing_evidence", "qualified_value", "qualitative", "previous_column")) {
            assertThat(validator.validate(request(abstentions = listOf(abstention(reason = reason))))).describedAs(reason).isEmpty()
        }
        assertThat(validator.validate(request(abstentions = listOf(abstention(reason = "render_error"))))).isNotEmpty()
    }

    @Test
    fun rejectsUnknownAbstentionReasonsAndOversizedLists() {
        assertThat(validator.validate(request(abstentions = listOf(abstention(reason = "low_confidence"))))).isNotEmpty()
        assertThat(validator.validate(request(candidates = (1..101).map { candidate(ordinal = it) }))).isNotEmpty()
        assertThat(validator.validate(request(abstentions = (1..101).map { abstention() }))).isNotEmpty()
    }

    private fun request(
        extractionMethod: String = "native-text",
        candidates: List<ExtractedCandidate> = listOf(candidate()),
        abstentions: List<ExtractionAbstention> = emptyList(),
    ) = ExtractionResultRequest(
        sourceSha256 = "a".repeat(64),
        workerImageDigest = "b".repeat(64),
        generatorVersion = "document-worker-v2",
        previewPngBase64 = "x".repeat(92),
        extractionMethod = extractionMethod,
        candidates = candidates,
        abstentions = abstentions,
    )

    private fun candidate(
        ordinal: Int = 1,
        label: String = "Cholesterol",
        value: String = "188",
        unit: String = "mg/dL",
        observedOn: String = "2026-07-28",
        evidencePage: Int = 1,
        evidenceBox: EvidenceBox? = EvidenceBox(0.08, 0.1, 0.3, 0.02),
        sourceTextSha256: String = "1".repeat(64),
        referenceRangeText: String? = null,
        originalLabel: String? = null,
    ) = ExtractedCandidate(
        ordinal, label, value, unit, observedOn, evidencePage, evidenceBox, sourceTextSha256, referenceRangeText, originalLabel,
    )

    private fun abstention(reason: String = "unreadable") = ExtractionAbstention("문서 전체", reason, null)

    @Test
    fun carriesReferenceRangeTextVerbatimWithinItsShapeAndNeverInterpretsIt() {
        for (accepted in listOf(null, "70-99", "120 - 199", "<200", "≤5.6", "4.0~6.0", "70–99", "4,000-10,000")) {
            assertThat(validator.validate(request(candidates = listOf(candidate(referenceRangeText = accepted)))))
                .describedAs(accepted.toString()).isEmpty()
        }
        for (rejected in listOf("", "참고 70-99", "70-99 mg/dL", "1".repeat(41), "normal", "high")) {
            assertThat(validator.validate(request(candidates = listOf(candidate(referenceRangeText = rejected)))))
                .describedAs(rejected).isNotEmpty()
        }
        assertThat(candidate().referenceRangeText).isNull()
    }
}
