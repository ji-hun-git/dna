package kr.co.genomecompanion.documentboundary

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test


class MedicalConceptCatalogueTest {
    @Test
    fun `holds the thirty-eight concepts of the spec with unique codes and alias keys`() {
        val codes = MedicalConceptCatalogue.entries.map { it.conceptCode }
        assertThat(codes).hasSize(38).doesNotHaveDuplicates()
        assertThat(codes).contains(
            "total-cholesterol", "ldl-cholesterol", "hdl-cholesterol", "triglycerides", "fasting-glucose", "hba1c",
            "ast", "alt", "gamma-gtp", "alp", "total-bilirubin", "albumin", "bun", "creatinine", "egfr", "uric-acid",
            "hemoglobin", "red-blood-cells", "white-blood-cells", "platelets", "urine-protein", "urine-glucose",
            "systolic-blood-pressure", "diastolic-blood-pressure", "pulse", "height", "weight", "bmi",
            "waist-circumference", "vitamin-d", "tsh", "free-t4", "crp", "ferritin", "sodium", "potassium",
            "calcium", "total-protein",
        )
        val keys = MedicalConceptCatalogue.entries.flatMap { concept ->
            (listOf(concept.displayKo) + concept.aliases).map(MedicalConceptCatalogue::aliasKey)
        }
        assertThat(keys).doesNotHaveDuplicates()
    }

    @Test
    fun `matches the demo document labels case and whitespace insensitively`() {
        assertThat(MedicalConceptCatalogue.find("Cholesterol")?.displayKo).isEqualTo("총콜레스테롤")
        assertThat(MedicalConceptCatalogue.find("hba1c:")?.conceptCode).isEqualTo("hba1c")
        assertThat(MedicalConceptCatalogue.find(" vitamin d ")?.conceptCode).isEqualTo("vitamin-d")
        assertThat(MedicalConceptCatalogue.find("총 콜레스테롤")?.conceptCode).isEqualTo("total-cholesterol")
        assertThat(MedicalConceptCatalogue.find("알 수 없는 항목")).isNull()
        assertThat(MedicalConceptCatalogue.byCode("free-t4")?.displayKo).isEqualTo("free T4")
    }

    @Test
    fun `carries no interpretation fields`() {
        val fields = MedicalConcept::class.java.declaredFields.map { it.name }
        assertThat(fields).containsExactlyInAnyOrder("conceptCode", "displayKo", "loincCode", "canonicalUnit", "aliases")
    }
}
