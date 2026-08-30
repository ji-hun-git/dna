package kr.co.genomecompanion.interoperability

import ca.uhn.fhir.context.FhirContext
import ca.uhn.fhir.context.support.DefaultProfileValidationSupport
import ca.uhn.fhir.validation.FhirValidator
import ca.uhn.fhir.validation.ResultSeverityEnum
import ca.uhn.fhir.validation.ValidationOptions
import org.hl7.fhir.common.hapi.validation.support.CommonCodeSystemsTerminologyService
import org.hl7.fhir.common.hapi.validation.support.InMemoryTerminologyServerValidationSupport
import org.hl7.fhir.common.hapi.validation.support.NpmPackageValidationSupport
import org.hl7.fhir.common.hapi.validation.support.SnapshotGeneratingValidationSupport
import org.hl7.fhir.common.hapi.validation.support.ValidationSupportChain
import org.hl7.fhir.common.hapi.validation.validator.FhirInstanceValidator
import org.hl7.fhir.r4.model.Resource
import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.util.HexFormat

enum class ValidationVerdict { VALID, INVALID, NOT_EVALUATED }
enum class ImportPolicyVerdict { SUPPORTED_SYNTHETIC_VALIDATION_ONLY, UNSUPPORTED }

data class SafeValidationIssue(
    val severity: String,
    val messageId: String?,
    val location: String?,
)

data class KrCoreBoundaryResult(
    val fhirStructural: ValidationVerdict,
    val krCore: ValidationVerdict,
    val importPolicy: ImportPolicyVerdict,
    val myHealthWayConformance: String = "NOT_IMPLEMENTED",
    val clinicalCorrectness: String = "NOT_ASSERTED",
    val packageCoordinate: String = KrCoreValidationBoundary.PACKAGE_COORDINATE,
    val packageSha256: String = KrCoreValidationBoundary.PACKAGE_SHA256,
    val validatorRuntime: String = KrCoreValidationBoundary.VALIDATOR_RUNTIME,
    val issues: List<SafeValidationIssue> = emptyList(),
)

/**
 * Offline-only KR Core validation boundary.
 *
 * Passing this boundary does not persist a record and does not imply MyHealthWay
 * conformance or clinical correctness. The package is vendored and hash-checked;
 * this class never downloads profiles or terminology at runtime.
 */
@Component
class KrCoreValidationBoundary(private val fhirContext: FhirContext) {
    private val baseValidator: FhirValidator
    private val krCoreValidator: FhirValidator

    init {
        verifyVendoredPackage()

        baseValidator = validator(
            ValidationSupportChain(
                DefaultProfileValidationSupport(fhirContext),
                CommonCodeSystemsTerminologyService(fhirContext),
                InMemoryTerminologyServerValidationSupport(fhirContext),
            ),
        )

        val npmPackage = NpmPackageValidationSupport(fhirContext).apply {
            loadPackageFromClasspath("classpath:$PACKAGE_RESOURCE")
        }
        krCoreValidator = validator(
            ValidationSupportChain(
                npmPackage,
                DefaultProfileValidationSupport(fhirContext),
                CommonCodeSystemsTerminologyService(fhirContext),
                InMemoryTerminologyServerValidationSupport(fhirContext),
                SnapshotGeneratingValidationSupport(fhirContext),
            ),
        )
    }

    fun validateLaboratoryObservation(rawJson: String): KrCoreBoundaryResult {
        val parsed = try {
            fhirContext.newJsonParser().parseResource(rawJson) as Resource
        } catch (_: RuntimeException) {
            return KrCoreBoundaryResult(
                fhirStructural = ValidationVerdict.INVALID,
                krCore = ValidationVerdict.NOT_EVALUATED,
                importPolicy = ImportPolicyVerdict.UNSUPPORTED,
            )
        }

        val baseResource = parsed.copy().also { it.meta.profile.clear() }
        val structural = baseValidator.validateWithResult(baseResource)
        if (!structural.isSuccessful) {
            return KrCoreBoundaryResult(
                fhirStructural = ValidationVerdict.INVALID,
                krCore = ValidationVerdict.NOT_EVALUATED,
                importPolicy = ImportPolicyVerdict.UNSUPPORTED,
                issues = safeIssues(structural.messages),
            )
        }

        val krCore = krCoreValidator.validateWithResult(
            parsed,
            ValidationOptions().addProfile(LABORATORY_OBSERVATION_PROFILE),
        )
        val profileDeclared = parsed.meta.profile.any { it.value == LABORATORY_OBSERVATION_PROFILE }
        return KrCoreBoundaryResult(
            fhirStructural = ValidationVerdict.VALID,
            krCore = if (krCore.isSuccessful) ValidationVerdict.VALID else ValidationVerdict.INVALID,
            importPolicy = if (krCore.isSuccessful && profileDeclared) {
                ImportPolicyVerdict.SUPPORTED_SYNTHETIC_VALIDATION_ONLY
            } else {
                ImportPolicyVerdict.UNSUPPORTED
            },
            issues = safeIssues(krCore.messages),
        )
    }

    private fun validator(chain: ValidationSupportChain): FhirValidator = fhirContext.newValidator().apply {
        registerValidatorModule(
            FhirInstanceValidator(chain).apply {
                isAnyExtensionsAllowed = false
                isErrorForUnknownProfiles = true
            },
        )
    }

    private fun verifyVendoredPackage() {
        val bytes = checkNotNull(javaClass.classLoader.getResourceAsStream(PACKAGE_RESOURCE)) {
            "Pinned KR Core package is missing"
        }.use { it.readAllBytes() }
        check(bytes.size.toLong() == PACKAGE_BYTES) { "Pinned KR Core package length mismatch" }
        val digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes))
        check(digest == PACKAGE_SHA256) { "Pinned KR Core package digest mismatch" }
    }

    private fun safeIssues(messages: List<ca.uhn.fhir.validation.SingleValidationMessage>) = messages
        .asSequence()
        .filter { it.severity == ResultSeverityEnum.ERROR || it.severity == ResultSeverityEnum.FATAL }
        .take(MAX_ISSUES)
        .map {
            SafeValidationIssue(
                severity = it.severity.name,
                messageId = it.messageId?.take(MAX_FIELD_LENGTH),
                location = it.locationString?.take(MAX_FIELD_LENGTH),
            )
        }
        .toList()

    companion object {
        const val PACKAGE_COORDINATE = "hl7.fhir.kr.core#2.0.0"
        const val PACKAGE_SHA256 = "14e0eeff8458d728258094c8234dbfc8e5efa590a55a44b14ee910d0fae2b868"
        const val PACKAGE_BYTES = 756_913L
        const val VALIDATOR_RUNTIME = "HAPI_FHIR_8.10.1_FHIR_R4_4.0.1"
        const val LABORATORY_OBSERVATION_PROFILE =
            "http://www.hl7korea.or.kr/fhir/krcore/StructureDefinition/krcore-observation-laboratory-result"
        private const val PACKAGE_RESOURCE = "fhir-packages/hl7.fhir.kr.core-2.0.0.tgz"
        private const val MAX_ISSUES = 50
        private const val MAX_FIELD_LENGTH = 240
    }
}
