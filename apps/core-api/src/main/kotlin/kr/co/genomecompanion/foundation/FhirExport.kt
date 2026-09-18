package kr.co.genomecompanion.foundation

import com.fasterxml.jackson.core.JsonGenerator
import com.fasterxml.jackson.databind.JsonSerializer
import com.fasterxml.jackson.databind.SerializerProvider
import com.fasterxml.jackson.databind.annotation.JsonSerialize
import kr.co.genomecompanion.documentboundary.MedicalConcept
import java.math.BigDecimal
import java.time.Instant
import java.time.temporal.ChronoUnit

/*
 * Hand-written FHIR R4 shapes for the person's own export: no FHIR library, only the members this
 * export emits. There is deliberately no `interpretation`, `subject` or `performer`, and a reference
 * range is text only — never low/high, never compared with a value
 * (governance/intended-use-decision-reference-range-and-delta-addendum-2026-09-17.md).
 * Null members are omitted by the global Jackson `non_null` setting.
 */
data class FhirCoding(val system: String, val code: String)

data class FhirCodeableConcept(val coding: List<FhirCoding>?, val text: String?)

/**
 * Serializes a `BigDecimal` as a plain JSON number, never exponent notation (e.g. `1.2E-6`) and
 * never a stripped form (e.g. `1E+3`), while keeping its scale (`5.20` stays `5.20`). Scoped to this
 * one field only — the global Jackson config is untouched, so no other response in the app changes.
 */
class PlainBigDecimalSerializer : JsonSerializer<BigDecimal>() {
    override fun serialize(value: BigDecimal, gen: JsonGenerator, serializers: SerializerProvider) {
        gen.writeNumber(value.toPlainString())
    }
}

data class FhirQuantity(
    @field:JsonSerialize(using = PlainBigDecimalSerializer::class)
    val value: BigDecimal,
    val unit: String,
)

data class FhirReferenceRange(val text: String)

data class FhirAnnotation(val text: String)

data class FhirMeta(val tag: List<FhirCoding>)

data class FhirObservation(
    val resourceType: String = "Observation",
    val id: String,
    val status: String = "final",
    val meta: FhirMeta,
    /** Omitted (never an empty array — FHIR does not allow one) for concepts this catalogue cannot
     * substantiate as laboratory results (vitals such as blood pressure, pulse, height, weight, BMI,
     * waist circumference) and for events with no concept code at all. Never `vital-signs`: that would
     * claim a profile this export does not satisfy. */
    val category: List<FhirCodeableConcept>?,
    val code: FhirCodeableConcept,
    val effectiveDateTime: String,
    val valueQuantity: FhirQuantity?,
    val valueString: String?,
    val referenceRange: List<FhirReferenceRange>?,
    val note: List<FhirAnnotation>?,
)

data class FhirBundleEntry(val resource: FhirObservation)

data class FhirBundle(
    val resourceType: String = "Bundle",
    val type: String = "collection",
    val timestamp: Instant,
    val meta: FhirMeta,
    /** Omitted when empty: FHIR does not allow an empty array. */
    val entry: List<FhirBundleEntry>?,
)

/** The Bundle plus the filename computed from the same instant as `timestamp`. */
data class FhirExportEnvelope(val filename: String, val bundle: FhirBundle)

object FhirObservationMapper {
    const val LOINC_SYSTEM = "http://loinc.org"
    const val CATEGORY_SYSTEM = "http://terminology.hl7.org/CodeSystem/observation-category"
    const val TAG_SYSTEM = "https://alm.example/fhir/tag"
    const val CORRECTED_NOTE = "본인이 값을 수정함"

    private val laboratory = listOf(FhirCodeableConcept(listOf(FhirCoding(CATEGORY_SYSTEM, "laboratory")), null))

    /** Vital-sign concepts in the catalogue: not laboratory results, and this export does not
     * satisfy the `vital-signs` profile, so `category` is omitted for them entirely. */
    private val nonLaboratoryConceptCodes = setOf(
        "systolic-blood-pressure",
        "diastolic-blood-pressure",
        "pulse",
        "height",
        "weight",
        "bmi",
        "waist-circumference",
    )

    private val synthetic = FhirCoding(TAG_SYSTEM, "synthetic")
    private val personConfirmedFromDocument = FhirCoding(TAG_SYSTEM, "person-confirmed-from-document")
    private val observationTags = FhirMeta(listOf(synthetic, personConfirmedFromDocument))

    fun bundle(records: List<FoundationRecordRow>, concepts: Map<String, MedicalConcept>, now: Instant): FhirBundle {
        // observedOn, confirmedAt, recordId — the same shape as /records, /health-events and the
        // JSON export, not the concept label, so a correction can't reorder this file either.
        val entries = records
            .filter { it.status == "CURRENT" }
            .sortedWith(
                compareBy<FoundationRecordRow> { it.observedOn }
                    .thenBy { it.confirmedAt }
                    .thenBy { it.recordId.toString() },
            )
            .map { FhirBundleEntry(observation(it, concepts)) }
        return FhirBundle(
            timestamp = now.truncatedTo(ChronoUnit.MILLIS),
            meta = FhirMeta(listOf(synthetic)),
            entry = entries.ifEmpty { null },
        )
    }

    private fun observation(record: FoundationRecordRow, concepts: Map<String, MedicalConcept>): FhirObservation {
        val conceptCode = record.conceptCode
        // Data-driven (gc_medical_concept.loinc_export, docs/status/2026-09-17/loinc-audit.md): a code is emitted
        // only when the audit found it no more specific than the labels, only for a value in the concept's
        // canonical unit — the seeded codes are tied to that unit's property (mass/volume, not moles/volume) —
        // and only when the sheet's own label is known (record.originalLabel != null). A row stored before V11
        // has no original_label and may carry a concept code an alias narrowed since; without this guard such a
        // row would regain a LOINC coding it was explicitly denied before.
        val loinc = conceptCode?.let(concepts::get)
            ?.takeIf { it.loincExport && record.unit == it.canonicalUnit && record.originalLabel != null }
            ?.loincCode
        val number = ChangeDeltaCalculator.parse(record.currentValue)
        val category = when {
            conceptCode == null || conceptCode in nonLaboratoryConceptCodes -> null
            else -> laboratory
        }
        return FhirObservation(
            id = record.recordVersionId.toString(),
            meta = observationTags,
            category = category,
            code = FhirCodeableConcept(loinc?.let { listOf(FhirCoding(LOINC_SYSTEM, it)) }, record.originalLabel ?: record.label),
            effectiveDateTime = record.observedOn.toString(),
            valueQuantity = number?.let { FhirQuantity(it, record.unit) },
            valueString = if (number == null) record.currentValue else null,
            // Verbatim document text. Never parsed into low/high, never compared with the value.
            referenceRange = record.referenceRangeText?.let { listOf(FhirReferenceRange(it)) },
            note = if (record.currentValue != record.originalValue) listOf(FhirAnnotation(CORRECTED_NOTE)) else null,
        )
    }
}
