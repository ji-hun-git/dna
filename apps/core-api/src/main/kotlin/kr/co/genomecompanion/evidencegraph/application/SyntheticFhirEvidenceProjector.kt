package kr.co.genomecompanion.evidencegraph.application

import ca.uhn.fhir.context.FhirContext
import ca.uhn.fhir.parser.DataFormatException
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import kr.co.genomecompanion.evidencegraph.api.EvidenceClass
import kr.co.genomecompanion.evidencegraph.api.EvidenceCode
import kr.co.genomecompanion.evidencegraph.api.EvidenceGraphCandidate
import kr.co.genomecompanion.evidencegraph.api.EvidenceKind
import kr.co.genomecompanion.evidencegraph.api.EvidenceProvenance
import kr.co.genomecompanion.evidencegraph.api.EvidenceQuantity
import kr.co.genomecompanion.evidencegraph.api.ProjectionFailureCode
import kr.co.genomecompanion.evidencegraph.api.ProjectionRejection
import kr.co.genomecompanion.evidencegraph.api.ProjectionRejectionCode
import kr.co.genomecompanion.evidencegraph.api.SyntheticFhirBundleRequest
import kr.co.genomecompanion.evidencegraph.api.SyntheticFhirProjection
import kr.co.genomecompanion.evidencegraph.api.SyntheticFhirProjectionException
import kr.co.genomecompanion.evidencegraph.api.VerificationStatus
import org.hl7.fhir.r4.model.Bundle
import org.hl7.fhir.r4.model.DateTimeType
import org.hl7.fhir.r4.model.Observation
import org.hl7.fhir.r4.model.Patient
import org.hl7.fhir.r4.model.Quantity


class SyntheticFhirEvidenceProjector(
    private val fhirContext: FhirContext,
) {
    fun project(request: SyntheticFhirBundleRequest): SyntheticFhirProjection {
        validateRequest(request)
        val payloadBytes = request.payload.toByteArray(StandardCharsets.UTF_8)
        val bundle = parseBundle(request.payload)
        validateBundleShape(bundle)

        val patientAliases = patientAliases(bundle)
        validateUniqueResourceIdentities(bundle)

        val bundleSha256 = sha256(payloadBytes)
        val candidates = mutableListOf<EvidenceGraphCandidate>()
        val rejections = mutableListOf<ProjectionRejection>()
        bundle.entry.forEachIndexed { index, entry ->
            val observation = entry.resource as? Observation ?: return@forEachIndexed
            when (
                val result = projectObservation(
                    request,
                    bundleSha256,
                    index,
                    entry.fullUrl,
                    observation,
                    patientAliases,
                )
            ) {
                is ObservationProjection.Accepted -> candidates += result.candidate
                is ObservationProjection.Rejected -> rejections += result.rejection
            }
        }

        val ignored = bundle.entry
            .mapNotNull { it.resource?.fhirType() }
            .filterNot { it == "Observation" }
            .groupingBy { it }
            .eachCount()
            .toSortedMap()

        return SyntheticFhirProjection(
            bundleSha256 = bundleSha256,
            candidates = candidates.toList(),
            rejections = rejections.toList(),
            ignoredResourceCounts = ignored,
        )
    }

    private fun validateRequest(request: SyntheticFhirBundleRequest) {
        failUnless(SYNTHETIC_SUBJECT.matches(request.subjectId), ProjectionFailureCode.NON_SYNTHETIC_SUBJECT)
        failUnless(GENERATOR_VERSION.matches(request.generatorVersion), ProjectionFailureCode.INVALID_GENERATOR_VERSION)
        failUnless(GIT_COMMIT.matches(request.generatorCommit), ProjectionFailureCode.INVALID_GENERATOR_COMMIT)
        failUnless(request.payload.isNotBlank(), ProjectionFailureCode.EMPTY_PAYLOAD)
        failUnless(
            request.payload.toByteArray(StandardCharsets.UTF_8).size <= MAX_PAYLOAD_BYTES,
            ProjectionFailureCode.PAYLOAD_TOO_LARGE,
        )
    }

    private fun parseBundle(payload: String): Bundle = try {
        fhirContext.newJsonParser().parseResource(Bundle::class.java, payload)
    } catch (_: DataFormatException) {
        fail(ProjectionFailureCode.INVALID_FHIR_JSON)
    }

    private fun validateBundleShape(bundle: Bundle) {
        failUnless(
            bundle.type == Bundle.BundleType.TRANSACTION || bundle.type == Bundle.BundleType.COLLECTION,
            ProjectionFailureCode.UNSUPPORTED_BUNDLE_TYPE,
        )
        failUnless(bundle.entry.size <= MAX_ENTRIES, ProjectionFailureCode.ENTRY_LIMIT_EXCEEDED)
    }

    private fun patientAliases(bundle: Bundle): Set<String> {
        val patients = bundle.entry.mapNotNull { entry ->
            val patient = entry.resource as? Patient ?: return@mapNotNull null
            val id = normalizedLogicalId(patient.idElement.idPart)
                ?: fail(ProjectionFailureCode.AMBIGUOUS_BUNDLE_SUBJECT)
            PatientIdentity(
                id = id,
                fullUrl = entry.fullUrl?.takeIf { it.isNotBlank() },
            )
        }
        failUnless(patients.size == 1, ProjectionFailureCode.AMBIGUOUS_BUNDLE_SUBJECT)
        val patient = patients.single()
        return buildSet {
            add(patient.id)
            add("Patient/${patient.id}")
            patient.fullUrl?.let { fullUrl ->
                add(fullUrl)
                normalizedLogicalId(fullUrl)?.let { normalized ->
                    add(normalized)
                    add("Patient/$normalized")
                }
            }
        }
    }

    private fun validateUniqueResourceIdentities(bundle: Bundle) {
        val fullUrls = bundle.entry.mapNotNull { it.fullUrl?.takeIf(String::isNotBlank) }
        failUnless(fullUrls.distinct().size == fullUrls.size, ProjectionFailureCode.DUPLICATE_RESOURCE_IDENTITY)

        val observationEntries = bundle.entry.filter { it.resource is Observation }
        val identities = observationEntries.mapNotNull { entry ->
            val observation = entry.resource as Observation
            val id = normalizedLogicalId(observation.idElement.idPart) ?: return@mapNotNull null
            val version = observation.meta.versionId?.takeIf { it.isNotBlank() }
            "Observation/$id/_history/${version ?: UNVERSIONED}"
        }
        failUnless(identities.distinct().size == identities.size, ProjectionFailureCode.DUPLICATE_RESOURCE_IDENTITY)
    }

    private fun projectObservation(
        request: SyntheticFhirBundleRequest,
        bundleSha256: String,
        entryIndex: Int,
        fullUrl: String?,
        observation: Observation,
        patientAliases: Set<String>,
    ): ObservationProjection {
        val location = "Bundle.entry[$entryIndex].resource"
        val id = normalizedLogicalId(fullUrl) ?: normalizedLogicalId(observation.idElement.idPart)
            ?: return rejected(null, location, ProjectionRejectionCode.MISSING_RESOURCE_ID)
        val version = observation.meta.versionId?.takeIf { it.isNotBlank() }
        val resourceRef = if (version == null) "Observation/$id" else "Observation/$id/_history/$version"
        val subjectRef = observation.subject.reference?.takeIf { it.isNotBlank() }
        val subjectIdPart = observation.subject.referenceElement.idPart?.takeIf { it.isNotBlank() }
        if (subjectRef !in patientAliases && subjectIdPart !in patientAliases) {
            return rejected(resourceRef, location, ProjectionRejectionCode.SUBJECT_MISMATCH)
        }
        if (observation.status !in ALLOWED_STATUSES) {
            return rejected(resourceRef, location, ProjectionRejectionCode.UNSUPPORTED_STATUS)
        }

        val codings = observation.code.coding.filter { it.hasSystem() && it.hasCode() }
        if (codings.isEmpty()) return rejected(resourceRef, location, ProjectionRejectionCode.MISSING_CODE)
        if (codings.size != 1) return rejected(resourceRef, location, ProjectionRejectionCode.AMBIGUOUS_CODE)
        val coding = codings.single()

        val quantity = observation.value as? Quantity
            ?: return rejected(resourceRef, location, ProjectionRejectionCode.UNSUPPORTED_VALUE)
        if (
            !quantity.hasValue() ||
            quantity.system != UCUM_SYSTEM ||
            !quantity.hasCode() ||
            !quantity.hasUnit()
        ) {
            return rejected(resourceRef, location, ProjectionRejectionCode.UNSUPPORTED_UNIT)
        }

        val effective = observation.effective as? DateTimeType
            ?: return rejected(resourceRef, location, ProjectionRejectionCode.AMBIGUOUS_EFFECTIVE_TIME)
        val effectiveAt = parseOffsetAwareInstant(effective.valueAsString)
            ?: return rejected(resourceRef, location, ProjectionRejectionCode.AMBIGUOUS_EFFECTIVE_TIME)
        val recordedAt = observation.issued?.toInstant()
            ?: return rejected(resourceRef, location, ProjectionRejectionCode.MISSING_RECORDED_TIME)

        val evidenceCode = EvidenceCode(
            system = coding.system,
            code = coding.code,
            display = coding.display?.takeIf { it.isNotBlank() },
        )
        val evidenceQuantity = EvidenceQuantity(
            value = quantity.value.stripTrailingZeros().toPlainString(),
            system = quantity.system,
            code = quantity.code,
            display = quantity.unit,
        )
        val candidateId = "sha256:" + sha256(
            listOf(
                bundleSha256,
                resourceRef,
                evidenceCode.system,
                evidenceCode.code,
                effective.valueAsString,
                evidenceQuantity.value,
                evidenceQuantity.system,
                evidenceQuantity.code,
            ).joinToString(CANDIDATE_SEPARATOR).toByteArray(StandardCharsets.UTF_8),
        )

        return ObservationProjection.Accepted(
            EvidenceGraphCandidate(
                candidateId = candidateId,
                subjectId = request.subjectId,
                kind = EvidenceKind.MEASUREMENT,
                evidenceClass = EvidenceClass.SYNTHETIC_SOURCE_RECORDED,
                verificationStatus = VerificationStatus.CANDIDATE,
                code = evidenceCode,
                quantity = evidenceQuantity,
                effectiveAt = effectiveAt,
                recordedAt = recordedAt,
                sourceStatus = observation.status.toCode(),
                provenance = EvidenceProvenance(
                    sourceType = SOURCE_TYPE,
                    bundleSha256 = bundleSha256,
                    resourceRef = resourceRef,
                    resourceVersion = version,
                    originalLocation = location,
                    generatorVersion = request.generatorVersion,
                    generatorCommit = request.generatorCommit,
                    importedAt = request.importedAt,
                ),
            ),
        )
    }

    private fun parseOffsetAwareInstant(value: String?): Instant? {
        if (value.isNullOrBlank() || !OFFSET_AWARE_TIMESTAMP.matches(value)) return null
        return try {
            OffsetDateTime.parse(value).toInstant()
        } catch (_: DateTimeParseException) {
            null
        }
    }

    private fun normalizedLogicalId(value: String?): String? {
        val candidate = value?.takeIf { it.isNotBlank() } ?: return null
        if (candidate.startsWith(URN_UUID_PREFIX)) return candidate.removePrefix(URN_UUID_PREFIX)
        return candidate.substringAfterLast('/').takeIf { it.isNotBlank() }
    }

    private fun rejected(
        resourceRef: String?,
        originalLocation: String,
        code: ProjectionRejectionCode,
    ) = ObservationProjection.Rejected(ProjectionRejection(resourceRef, originalLocation, code))

    private fun failUnless(condition: Boolean, code: ProjectionFailureCode) {
        if (!condition) fail(code)
    }

    private fun fail(code: ProjectionFailureCode): Nothing = throw SyntheticFhirProjectionException(code)

    private fun sha256(value: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(value)
        .joinToString("") { "%02x".format(it) }

    private data class PatientIdentity(
        val id: String,
        val fullUrl: String?,
    )

    private sealed interface ObservationProjection {
        data class Accepted(val candidate: EvidenceGraphCandidate) : ObservationProjection
        data class Rejected(val rejection: ProjectionRejection) : ObservationProjection
    }

    private companion object {
        const val MAX_PAYLOAD_BYTES = 16 * 1024 * 1024
        const val MAX_ENTRIES = 10_000
        const val UCUM_SYSTEM = "http://unitsofmeasure.org"
        const val SOURCE_TYPE = "SYNTHEA_FHIR_R4"
        const val UNVERSIONED = "unversioned"
        const val URN_UUID_PREFIX = "urn:uuid:"
        const val CANDIDATE_SEPARATOR = "\u001f"
        val SYNTHETIC_SUBJECT = Regex("^synthetic-[a-z0-9-]{1,70}$")
        val GENERATOR_VERSION = Regex("^[0-9]+\\.[0-9]+\\.[0-9]+$")
        val GIT_COMMIT = Regex("^[0-9a-f]{40}$")
        val OFFSET_AWARE_TIMESTAMP = Regex("^.+T.+(?:Z|[+-][0-9]{2}:[0-9]{2})$")
        val ALLOWED_STATUSES = setOf(
            Observation.ObservationStatus.FINAL,
            Observation.ObservationStatus.AMENDED,
            Observation.ObservationStatus.CORRECTED,
        )
    }
}
