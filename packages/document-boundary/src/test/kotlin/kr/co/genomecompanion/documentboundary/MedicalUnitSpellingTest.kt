package kr.co.genomecompanion.documentboundary

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test


class MedicalUnitSpellingTest {
    @Test
    fun `canonical spellings map to themselves and variants map to the canonical form`() {
        assertThat(MedicalUnitSpelling.canonical("mg/dL")).isEqualTo("mg/dL")
        assertThat(MedicalUnitSpelling.canonical("mg/dl")).isEqualTo("mg/dL")
        assertThat(MedicalUnitSpelling.canonical("㎎/㎗")).isEqualTo("mg/dL")
        assertThat(MedicalUnitSpelling.canonical("ng/ml")).isEqualTo("ng/mL")
        assertThat(MedicalUnitSpelling.canonical("%")).isEqualTo("%")
        assertThat(MedicalUnitSpelling.canonical("kg/m2")).isEqualTo("kg/m²")
        assertThat(MedicalUnitSpelling.canonical("uIU/mL")).isEqualTo("µIU/mL")
        assertThat(MedicalUnitSpelling.canonical("μIU/mL")).isEqualTo("µIU/mL")
        assertThat(MedicalUnitSpelling.canonical("10^3/uL")).isEqualTo("10³/µL")
        assertThat(MedicalUnitSpelling.canonical("/uL")).isEqualTo("/µL")
        assertThat(MedicalUnitSpelling.canonical("bpm")).isEqualTo("회/분")
        assertThat(MedicalUnitSpelling.canonical(" U/L ")).isEqualTo("U/L")
    }

    @Test
    fun `rejects words that are not units`() {
        assertThat(MedicalUnitSpelling.canonical("항목")).isNull()
        assertThat(MedicalUnitSpelling.canonical("190")).isNull()
        assertThat(MedicalUnitSpelling.canonical("")).isNull()
    }
}
