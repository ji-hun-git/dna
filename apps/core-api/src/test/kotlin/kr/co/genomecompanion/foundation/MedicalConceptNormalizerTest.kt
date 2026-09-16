package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.documentboundary.MedicalConceptCatalogue
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.time.format.DateTimeParseException


class MedicalConceptNormalizerTest {
    private val normalizer = MedicalConceptNormalizer(MedicalConceptSource { MedicalConceptCatalogue.entries })

    @Test
    fun mapsAnAliasToTheDisplayLabelAndConceptCodeAndUnifiesUnitSpelling() {
        val normalized = normalizer.normalize(candidate(label = "Cholesterol", unit = "mg/dl"))

        assertThat(normalized.label).isEqualTo("총콜레스테롤")
        assertThat(normalized.conceptCode).isEqualTo("total-cholesterol")
        assertThat(normalized.unit).isEqualTo("mg/dL")
        assertThat(normalized.value).isEqualTo("188")
        assertThat(normalized.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
        assertThat(normalized.evidenceBox).isEqualTo(EvidenceBox(0.08, 0.1, 0.3, 0.02))
        assertThat(normalized.sourceTextSha256).isEqualTo("1".repeat(64))
    }

    @Test
    fun keepsTheDemoDocumentOrderAndLabelsOfTheRetiredFixture() {
        val labels = listOf("Cholesterol", "HbA1c", "Vitamin D").map { normalizer.normalize(candidate(label = it)).label }
        assertThat(labels).containsExactly("총콜레스테롤", "당화혈색소", "비타민 D")
    }

    @Test
    fun leavesUnknownLabelsAndUnitsUntouchedWithoutAConceptCode() {
        val normalized = normalizer.normalize(candidate(label = "알 수 없는 항목", unit = "foo/bar"))

        assertThat(normalized.label).isEqualTo("알 수 없는 항목")
        assertThat(normalized.conceptCode).isNull()
        assertThat(normalized.unit).isEqualTo("foo/bar")
    }

    @Test
    fun neverConvertsAValue() {
        assertThat(normalizer.normalize(candidate(value = "6,200", unit = "/uL")).value).isEqualTo("6,200")
    }

    @Test
    fun rejectsAnImpossibleDate() {
        assertThatThrownBy { normalizer.normalize(candidate(observedOn = "2026-13-40")) }
            .isInstanceOf(DateTimeParseException::class.java)
    }

    private fun candidate(
        label: String = "Cholesterol",
        value: String = "188",
        unit: String = "mg/dL",
        observedOn: String = "2026-07-28",
    ) = ExtractedCandidate(1, label, value, unit, observedOn, 1, EvidenceBox(0.08, 0.1, 0.3, 0.02), "1".repeat(64))
}
