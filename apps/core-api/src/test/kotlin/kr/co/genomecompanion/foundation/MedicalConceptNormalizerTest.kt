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
        val labels = listOf("Cholesterol" to "mg/dL", "HbA1c" to "%", "Vitamin D" to "ng/mL")
            .map { (label, unit) -> normalizer.normalize(candidate(label = label, unit = unit)).label }
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

    @Test
    fun keepsTheResultSheetLabelBesideTheDisplayLabel() {
        val normalized = normalizer.normalize(candidate(label = "Cholesterol"))
        assertThat(normalized.label).isEqualTo("총콜레스테롤")
        assertThat(normalized.originalLabel).isEqualTo("Cholesterol")
        assertThat(normalizer.normalize(candidate(label = "알 수 없는 항목")).originalLabel).isEqualTo("알 수 없는 항목")
    }

    @Test
    fun attachesNoConceptWhenTheUnitIsNotOneTheConceptAccepts() {
        val mismatched = normalizer.normalize(candidate(label = "UA", value = "1.2", unit = "g/dL"))
        assertThat(mismatched.conceptCode).isNull()
        assertThat(mismatched.label).isEqualTo("UA")
        assertThat(mismatched.originalLabel).isEqualTo("UA")
        assertThat(mismatched.unit).isEqualTo("g/dL")

        val unknownUnit = normalizer.normalize(candidate(label = "Cholesterol", unit = "foo/bar"))
        assertThat(unknownUnit.conceptCode).isNull()
        assertThat(unknownUnit.label).isEqualTo("Cholesterol")

        val accepted = normalizer.normalize(candidate(label = "UA", value = "5.1", unit = "mg/dl"))
        assertThat(accepted.conceptCode).isEqualTo("uric-acid")
        assertThat(accepted.label).isEqualTo("요산")
        assertThat(normalizer.normalize(candidate(label = "Hb", value = "140", unit = "g/L")).conceptCode).isEqualTo("hemoglobin")
    }

    @Test
    fun sendsABroadLabelToTheGenericConcept() {
        val glucose = normalizer.normalize(candidate(label = "혈당", value = "95"))
        assertThat(glucose.conceptCode).isEqualTo("glucose")
        assertThat(glucose.label).isEqualTo("혈당")
        assertThat(normalizer.normalize(candidate(label = "hs-CRP", value = "0.1", unit = "mg/L")).conceptCode).isEqualTo("hs-crp")
        assertThat(normalizer.normalize(candidate(label = "Bilirubin", value = "0.8")).conceptCode).isEqualTo("bilirubin")
        assertThat(normalizer.normalize(candidate(label = "GFR", value = "90", unit = "mL/min/1.73m2")).conceptCode).isEqualTo("gfr")
        assertThat(normalizer.normalize(candidate(label = "공복혈당", value = "95")).conceptCode).isEqualTo("fasting-glucose")
    }

    private fun candidate(
        label: String = "Cholesterol",
        value: String = "188",
        unit: String = "mg/dL",
        observedOn: String = "2026-07-28",
    ) = ExtractedCandidate(1, label, value, unit, observedOn, 1, EvidenceBox(0.08, 0.1, 0.3, 0.02), "1".repeat(64))
}
