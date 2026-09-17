package kr.co.genomecompanion.foundation

import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class FhirObservationMapperTest {
    private val now = Instant.parse("2026-09-17T01:02:03.456789Z")
    private val loinc = mapOf("total-cholesterol" to "2093-3")

    private fun row(
        label: String = "총콜레스테롤",
        value: String = "190",
        originalValue: String = value,
        unit: String = "mg/dL",
        observedOn: String = "2026-07-28",
        conceptCode: String? = "total-cholesterol",
        referenceRangeText: String? = null,
        status: String = "CURRENT",
        originalObservedOn: LocalDate? = null,
    ) = FoundationRecordRow(
        recordId = UUID.randomUUID(),
        recordVersionId = UUID.randomUUID(),
        supersedesVersionId = null,
        candidateId = UUID.randomUUID(),
        documentId = UUID.randomUUID(),
        subjectId = "synthetic-jason",
        status = status,
        label = label,
        currentValue = value,
        originalValue = originalValue,
        unit = unit,
        observedOn = LocalDate.parse(observedOn),
        originalObservedOn = originalObservedOn,
        confirmedAt = Instant.parse("2026-08-01T00:00:00Z"),
        correctionReason = null,
        evidencePage = 1,
        sourceTextSha256 = "b".repeat(64),
        documentSha256 = "a".repeat(64),
        conceptCode = conceptCode,
        referenceRangeText = referenceRangeText,
    )

    @Test
    fun buildsASyntheticCollectionBundleAndOmitsEntryWhenThereIsNothing() {
        val empty = FhirObservationMapper.bundle(emptyList(), loinc, now)
        assertThat(empty.resourceType).isEqualTo("Bundle")
        assertThat(empty.type).isEqualTo("collection")
        assertThat(empty.timestamp).isEqualTo(Instant.parse("2026-09-17T01:02:03.456Z"))
        assertThat(empty.meta.tag).containsExactly(FhirCoding("https://alm.example/fhir/tag", "synthetic"))
        assertThat(empty.entry).isNull()
    }

    @Test
    fun mapsACorrectedCodedNumericRecordWithItsRangeTextVerbatim() {
        val record = row(originalValue = "188", referenceRangeText = "120-199")
        val observation = FhirObservationMapper.bundle(listOf(record), loinc, now).entry!!.single().resource

        assertThat(observation.resourceType).isEqualTo("Observation")
        assertThat(observation.id).isEqualTo(record.recordVersionId.toString())
        assertThat(observation.status).isEqualTo("final")
        assertThat(observation.category).containsExactly(
            FhirCodeableConcept(listOf(FhirCoding("http://terminology.hl7.org/CodeSystem/observation-category", "laboratory")), null),
        )
        assertThat(observation.code).isEqualTo(FhirCodeableConcept(listOf(FhirCoding("http://loinc.org", "2093-3")), "총콜레스테롤"))
        assertThat(observation.effectiveDateTime).isEqualTo("2026-07-28")
        assertThat(observation.valueQuantity).isEqualTo(FhirQuantity(BigDecimal("190"), "mg/dL"))
        assertThat(observation.valueString).isNull()
        assertThat(observation.referenceRange).containsExactly(FhirReferenceRange("120-199"))
        assertThat(observation.note).containsExactly(FhirAnnotation("본인이 값을 수정함"))
        assertThat(observation.meta.tag).containsExactly(
            FhirCoding("https://alm.example/fhir/tag", "synthetic"),
            FhirCoding("https://alm.example/fhir/tag", "person-confirmed-from-document"),
        )
    }

    @Test
    fun omitsCategoryForVitalSignConceptsAndForUncodedEventsButKeepsLaboratoryForLabConcepts() {
        val bloodPressure = row(label = "수축기 혈압", value = "120", unit = "mmHg", conceptCode = "systolic-blood-pressure")
        val pulse = row(label = "맥박", value = "70", unit = "회/분", conceptCode = "pulse")
        val weight = row(label = "체중", value = "65", unit = "kg", conceptCode = "weight")
        val uncoded = row(label = "요단백", value = "1", unit = "mg/dL", conceptCode = null)
        val lab = row(label = "총콜레스테롤", value = "190")
        val byLabel = FhirObservationMapper.bundle(listOf(bloodPressure, pulse, weight, uncoded, lab), loinc, now)
            .entry!!.map { it.resource }.associateBy { it.code.text }

        assertThat(byLabel.getValue("수축기 혈압").category).isNull()
        assertThat(byLabel.getValue("맥박").category).isNull()
        assertThat(byLabel.getValue("체중").category).isNull()
        assertThat(byLabel.getValue("요단백").category).isNull()
        assertThat(byLabel.getValue("총콜레스테롤").category).containsExactly(
            FhirCodeableConcept(listOf(FhirCoding("http://terminology.hl7.org/CodeSystem/observation-category", "laboratory")), null),
        )
        val json = ObjectMapper().findAndRegisterModules().writeValueAsString(byLabel.getValue("수축기 혈압"))
        assertThat(json).doesNotContain("\"category\":[]", "vital-signs")
    }

    @Test
    fun omitsLoincCodingForAliasOverspecifiedConceptsButKeepsTextAndKeepsCodingElsewhere() {
        val overspecified = mapOf(
            "fasting-glucose" to "1558-6",
            "crp" to "1988-5",
            "total-bilirubin" to "1975-2",
            "egfr" to "62238-1",
            "total-cholesterol" to "2093-3",
        )
        val glucose = row(label = "혈당", value = "95", unit = "mg/dL", conceptCode = "fasting-glucose")
        val crp = row(label = "hs-CRP", value = "0.1", unit = "mg/L", conceptCode = "crp")
        val bilirubin = row(label = "Bilirubin", value = "0.8", unit = "mg/dL", conceptCode = "total-bilirubin")
        val gfr = row(label = "GFR", value = "90", unit = "mL/min/1.73m²", conceptCode = "egfr")
        val cholesterol = row(label = "총콜레스테롤", value = "190")
        val bundle = FhirObservationMapper.bundle(listOf(glucose, crp, bilirubin, gfr, cholesterol), overspecified, now)
        val byLabel = bundle.entry!!.map { it.resource }.associateBy { it.code.text }

        assertThat(byLabel.getValue("혈당").code.coding).isNull()
        assertThat(byLabel.getValue("hs-CRP").code.coding).isNull()
        assertThat(byLabel.getValue("Bilirubin").code.coding).isNull()
        assertThat(byLabel.getValue("GFR").code.coding).isNull()
        assertThat(byLabel.getValue("총콜레스테롤").code.coding).containsExactly(FhirCoding("http://loinc.org", "2093-3"))
    }

    @Test
    fun omitsCodingRangeAndNoteWhenAbsentAndFallsBackToValueStringForNonNumericText() {
        val uncoded = row(label = "요단백", value = "음성", conceptCode = null)
        val unknownCode = row(label = "비타민 D", value = "6,200", unit = "ng/mL", conceptCode = "vitamin-d")
        val dateOnly = row(label = "당화혈색소", value = "5.20", unit = "%", conceptCode = null, originalObservedOn = LocalDate.parse("2026-07-27"))
        val byLabel = FhirObservationMapper.bundle(listOf(uncoded, unknownCode, dateOnly), loinc, now)
            .entry!!.map { it.resource }.associateBy { it.code.text }

        val text = byLabel.getValue("요단백")
        assertThat(text.code.coding).isNull()
        assertThat(text.valueQuantity).isNull()
        assertThat(text.valueString).isEqualTo("음성")
        assertThat(text.referenceRange).isNull()
        assertThat(text.note).isNull()

        assertThat(byLabel.getValue("비타민 D").code.coding).isNull()
        assertThat(byLabel.getValue("비타민 D").valueQuantity).isEqualTo(FhirQuantity(BigDecimal("6200"), "ng/mL"))
        // Scale is kept (5.20 stays 5.20); a date-only correction has no "value" note.
        assertThat(byLabel.getValue("당화혈색소").valueQuantity).isEqualTo(FhirQuantity(BigDecimal("5.20"), "%"))
        assertThat(byLabel.getValue("당화혈색소").note).isNull()
    }

    @Test
    fun listsCurrentRecordsOnlyInADeterministicOrderAndHasNoInterpretationSubjectOrPerformer() {
        val january = row(value = "194", observedOn = "2026-01-15")
        val july = row(value = "190")
        val superseded = row(value = "188", status = "SUPERSEDED")
        val bundle = FhirObservationMapper.bundle(listOf(july, superseded, january), loinc, now)

        assertThat(bundle.entry!!.map { it.resource.id })
            .containsExactly(january.recordVersionId.toString(), july.recordVersionId.toString())
        assertThat(FhirObservationMapper.bundle(listOf(january, superseded, july), loinc, now)).isEqualTo(bundle)
        val fields = FhirObservation::class.java.declaredFields.map { it.name }
        assertThat(fields).doesNotContain("interpretation", "subject", "performer")
        assertThat(FhirReferenceRange::class.java.declaredFields.map { it.name }).containsExactly("text")
    }

    @Test
    fun keepsValueQuantityAsAPlainJsonNumberAtEveryScaleWhenSerialized() {
        val mapper = ObjectMapper().findAndRegisterModules()
        val tiny = row(label = "tiny", value = "0.00000012", unit = "mg/dL", conceptCode = null)
        val scaled = row(label = "scaled", value = "5.20", unit = "%", conceptCode = null)
        val commas = row(label = "commas", value = "1,234", unit = "ng/mL", conceptCode = null)
        val whole = row(label = "whole", value = "1000", unit = "mg/dL", conceptCode = null)
        val bundle = FhirObservationMapper.bundle(listOf(tiny, scaled, commas, whole), loinc, now)

        val json = mapper.writeValueAsString(bundle)
        assertThat(json).contains(""""value":0.00000012""")
        assertThat(json).contains(""""value":5.20""")
        assertThat(json).contains(""""value":1234""")
        assertThat(json).contains(""""value":1000""")
        assertThat(json).doesNotContainPattern("\"value\":[0-9.]*[eE][+-]?[0-9]")
    }
}
