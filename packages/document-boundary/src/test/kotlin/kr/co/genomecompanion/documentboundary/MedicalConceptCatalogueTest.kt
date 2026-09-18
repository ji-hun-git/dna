package kr.co.genomecompanion.documentboundary

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test


class MedicalConceptCatalogueTest {
    @Test
    fun `holds sixty-nine concepts with unique codes and alias keys that belong to one concept only`() {
        val codes = MedicalConceptCatalogue.entries.map { it.conceptCode }
        assertThat(codes).hasSize(69).doesNotHaveDuplicates()
        assertThat(codes).contains(
            "glucose", "fasting-glucose", "postprandial-glucose", "bilirubin", "total-bilirubin", "direct-bilirubin",
            "crp", "hs-crp", "gfr", "egfr", "hematocrit", "mcv", "mch", "mchc", "chloride", "phosphorus", "magnesium",
            "iron", "tibc", "vitamin-b12", "folate", "esr", "ldh", "amylase", "ck", "free-t3", "t3",
            "non-hdl-cholesterol", "insulin", "afp", "cea", "psa", "ca19-9", "ca125", "rf",
        )
        val keys = MedicalConceptCatalogue.entries.flatMap { concept ->
            (listOf(concept.displayKo) + concept.aliases).map(MedicalConceptCatalogue::aliasKey)
        }
        assertThat(keys).doesNotHaveDuplicates()
    }

    @Test
    fun `has no one-character alias and unit-guards every concept`() {
        MedicalConceptCatalogue.entries.forEach { concept ->
            assertThat(concept.aliases.map(MedicalConceptCatalogue::aliasKey)).describedAs(concept.conceptCode).allMatch { it.length >= 2 }
            assertThat(concept.acceptedUnits).describedAs(concept.conceptCode).isNotEmpty().doesNotHaveDuplicates()
            assertThat(concept.acceptedUnits.first()).describedAs(concept.conceptCode).isEqualTo(concept.canonicalUnit)
            assertThat(concept.acceptedUnits).describedAs(concept.conceptCode).allMatch { MedicalUnitSpelling.canonical(it) == it }
        }
        assertThat(MedicalConceptCatalogue.find("K")).isNull()
    }

    @Test
    fun `sends a broad label to the generic concept and a specific label to the specific one`() {
        fun code(label: String) = MedicalConceptCatalogue.find(label)?.conceptCode
        assertThat(listOf("혈당", "Blood Glucose", "혈당(Glucose)", "Serum Glucose", "Plasma Glucose").map(::code)).containsOnly("glucose")
        // A bare "Glucose"/"GLU" label does not state the specimen (the same word appears in urine
        // sections of a result sheet), so it must resolve to no concept rather than the generic blood
        // glucose concept; the raw label is kept downstream. See coordinator review, Fix 1.
        assertThat(MedicalConceptCatalogue.find("Glucose")).isNull()
        assertThat(MedicalConceptCatalogue.find("glucose:")).isNull()
        assertThat(MedicalConceptCatalogue.find("GLU")).isNull()
        assertThat(MedicalConceptCatalogue.find("Urine Glucose")?.conceptCode).isEqualTo("urine-glucose")
        // A bare "Protein" label is equally specimen-ambiguous; no concept claims it either.
        assertThat(MedicalConceptCatalogue.find("Protein")).isNull()
        assertThat(listOf("공복혈당", "공복 혈당", "Fasting Glucose", "FBS", "FPG", "식전혈당").map(::code)).containsOnly("fasting-glucose")
        assertThat(listOf("식후혈당", "식후 2시간 혈당", "PP2", "2hr PP").map(::code)).containsOnly("postprandial-glucose")
        assertThat(code("Bilirubin")).isEqualTo("bilirubin")
        assertThat(listOf("총빌리루빈", "Total Bilirubin", "T-Bil").map(::code)).containsOnly("total-bilirubin")
        assertThat(listOf("Direct Bilirubin", "D-Bil").map(::code)).containsOnly("direct-bilirubin")
        assertThat(listOf("hs-CRP", "hsCRP", "고감도 C-반응단백").map(::code)).containsOnly("hs-crp")
        assertThat(listOf("CRP", "C-반응단백").map(::code)).containsOnly("crp")
        assertThat(listOf("GFR", "사구체여과율").map(::code)).containsOnly("gfr")
        assertThat(listOf("eGFR", "e-GFR", "estimated GFR", "추정 사구체여과율", "신사구체여과율(e-GFR)").map(::code)).containsOnly("egfr")
    }

    @Test
    fun `keeps generic concepts uncoded and the three over-specific codes unexported`() {
        listOf("glucose", "bilirubin", "gfr").forEach { code ->
            val concept = checkNotNull(MedicalConceptCatalogue.byCode(code))
            assertThat(concept.loincCode).describedAs(code).isNull()
            assertThat(concept.loincExport).describedAs(code).isFalse()
        }
        // Per the loinc-audit.md Final values (source of truth): ldl-cholesterol was re-coded to a
        // method-free LOINC (2089-1) and is exported; waist-circumference's code (site + method
        // specific) is not. The unexported trio is egfr, vitamin-d, waist-circumference.
        listOf("egfr", "vitamin-d", "waist-circumference").forEach { code ->
            assertThat(checkNotNull(MedicalConceptCatalogue.byCode(code)).loincExport).describedAs(code).isFalse()
        }
        assertThat(checkNotNull(MedicalConceptCatalogue.byCode("ldl-cholesterol")).loincExport).isTrue()
        assertThat(MedicalConceptCatalogue.entries.filter { it.loincExport }).allMatch { it.loincCode != null }
        assertThatThrownBy { MedicalConcept("x-y", "엑스", null, "mg/dL", listOf("XY"), listOf("mg/dL"), loincExport = true) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `resolves a label only when the unit is one the concept accepts`() {
        assertThat(MedicalConceptCatalogue.resolve("UA", "mg/dl")?.conceptCode).isEqualTo("uric-acid")
        assertThat(MedicalConceptCatalogue.resolve("UA", "g/dL")).isNull()
        assertThat(MedicalConceptCatalogue.resolve("UA", "foo")).isNull()
        assertThat(MedicalConceptCatalogue.resolve("Blood Glucose", "mmol/L")?.conceptCode).isEqualTo("glucose")
        // Bare "Glucose" resolves to no concept regardless of unit, per Fix 1 (specimen-ambiguous).
        assertThat(MedicalConceptCatalogue.resolve("Glucose", "mmol/L")).isNull()
        assertThat(MedicalConceptCatalogue.resolve("WBC", "/uL")?.conceptCode).isEqualTo("white-blood-cells")
        assertThat(MedicalConceptCatalogue.resolve("Hb", "g/L")?.conceptCode).isEqualTo("hemoglobin")
        assertThat(MedicalConceptCatalogue.resolve("CK", "mg/dL")).isNull()
    }

    @Test
    fun `matches the demo document labels case and whitespace insensitively`() {
        assertThat(MedicalConceptCatalogue.find("Cholesterol")?.displayKo).isEqualTo("총콜레스테롤")
        assertThat(MedicalConceptCatalogue.find("hba1c:")?.conceptCode).isEqualTo("hba1c")
        assertThat(MedicalConceptCatalogue.find(" vitamin d ")?.conceptCode).isEqualTo("vitamin-d")
        assertThat(MedicalConceptCatalogue.find("총 콜레스테롤")?.conceptCode).isEqualTo("total-cholesterol")
        assertThat(MedicalConceptCatalogue.find("CA 19-9")?.conceptCode).isEqualTo("ca19-9")
        assertThat(MedicalConceptCatalogue.find("알 수 없는 항목")).isNull()
        assertThat(MedicalConceptCatalogue.byCode("free-t4")?.displayKo).isEqualTo("free T4")
    }

    @Test
    fun `the blood-pressure split labels resolve to the two pressure concepts`() {
        assertThat(MedicalConceptCatalogue.resolve("혈압(수축기)", "mmHg")?.conceptCode).isEqualTo("systolic-blood-pressure")
        assertThat(MedicalConceptCatalogue.resolve("혈압(이완기)", "mmHg")?.conceptCode).isEqualTo("diastolic-blood-pressure")
        assertThat(MedicalConceptCatalogue.find("혈압")).isNull()
    }

    @Test
    fun `carries no interpretation fields`() {
        val fields = MedicalConcept::class.java.declaredFields.map { it.name }
        assertThat(fields).containsExactlyInAnyOrder(
            "conceptCode", "displayKo", "loincCode", "canonicalUnit", "aliases", "acceptedUnits", "loincExport",
        )
    }
}
