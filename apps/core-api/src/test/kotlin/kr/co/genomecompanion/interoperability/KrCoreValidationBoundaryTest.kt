package kr.co.genomecompanion.interoperability

import ca.uhn.fhir.context.FhirContext
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class KrCoreValidationBoundaryTest {
    private val boundary = KrCoreValidationBoundary(FhirContext.forR4Cached())

    @Test
    fun `pins the official package and keeps conformance verdicts separate`() {
        val result = boundary.validateLaboratoryObservation(validObservation)

        assertThat(result.packageCoordinate).isEqualTo("hl7.fhir.kr.core#2.0.0")
        assertThat(result.packageSha256).isEqualTo(
            "14e0eeff8458d728258094c8234dbfc8e5efa590a55a44b14ee910d0fae2b868",
        )
        assertThat(result.fhirStructural).isEqualTo(ValidationVerdict.VALID)
        assertThat(result.krCore).isEqualTo(ValidationVerdict.VALID)
        assertThat(result.importPolicy).isEqualTo(ImportPolicyVerdict.SUPPORTED_SYNTHETIC_VALIDATION_ONLY)
        assertThat(result.myHealthWayConformance).isEqualTo("NOT_IMPLEMENTED")
        assertThat(result.clinicalCorrectness).isEqualTo("NOT_ASSERTED")
    }

    @Test
    fun `rejects a missing mandatory observation status without evaluating KR Core`() {
        val result = boundary.validateLaboratoryObservation(validObservation.replace("\"status\":\"final\",", ""))

        assertThat(result.fhirStructural).isEqualTo(ValidationVerdict.INVALID)
        assertThat(result.krCore).isEqualTo(ValidationVerdict.NOT_EVALUATED)
        assertThat(result.importPolicy).isEqualTo(ImportPolicyVerdict.UNSUPPORTED)
        assertThat(result.issues).isNotEmpty
    }

    @Test
    fun `does not let valid base FHIR without an explicit KR Core profile enter the import policy`() {
        val result = boundary.validateLaboratoryObservation(
            validObservation.replace(
                "\"meta\":{\"profile\":[\"${KrCoreValidationBoundary.LABORATORY_OBSERVATION_PROFILE}\"]},",
                "",
            ),
        )

        assertThat(result.fhirStructural).isEqualTo(ValidationVerdict.VALID)
        assertThat(result.importPolicy).isEqualTo(ImportPolicyVerdict.UNSUPPORTED)
    }

    @Test
    fun `fails closed on malformed input and returns no raw validation payload`() {
        val result = boundary.validateLaboratoryObservation("{\"resourceType\":\"Observation\",\"valueString\":")

        assertThat(result.fhirStructural).isEqualTo(ValidationVerdict.INVALID)
        assertThat(result.krCore).isEqualTo(ValidationVerdict.NOT_EVALUATED)
        assertThat(result.issues).isEmpty()
    }

    private val validObservation =
        """{"resourceType":"Observation","id":"synthetic-krcore-lab-01","meta":{"profile":["${KrCoreValidationBoundary.LABORATORY_OBSERVATION_PROFILE}"]},"status":"final","category":[{"coding":[{"system":"http://terminology.hl7.org/CodeSystem/observation-category","code":"laboratory","display":"Laboratory"}]}],"code":{"coding":[{"system":"http://www.hl7korea.or.kr/CodeSystem/hira-edi-procedure","code":"D0571017","display":"합성 검사"},{"system":"http://loinc.org","code":"15061-5","display":"Erythropoietin"}]},"subject":{"reference":"Patient/synthetic-patient"},"effectiveDateTime":"2026-08-30T09:00:00+09:00","issued":"2026-08-30T10:00:00+09:00","valueQuantity":{"value":12.3,"unit":"mIU/mL","system":"http://unitsofmeasure.org","code":"m[IU]/mL"}}"""
}
