# Personal Record and FHIR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Korea-first personal-record vertical slice to the shared core API: explicit purpose-bound document processing, hostile-file quarantine, user-reviewed extraction, HAPI-backed FHIR R4/KR Core 2.0.0 records, a deterministic health timeline, the exact verified-fact packet required by the AI safety slice, export, and deletion with restore-tombstone replay.

**Architecture:** Extend the foundation’s Kotlin/Spring modular monolith in `apps/core-api`; do not create another API application. Foundation identity, consent, workload tokens, safe telemetry, audit, outbox, deletion orchestration, and restore gates remain authoritative. A private Python worker receives only task-scoped object references, turns accepted documents into inert page images, and returns encrypted OCR candidate artifacts. The core API requires an explicit decision for every candidate before HAPI validation and canonical storage. Source disposal is a required workflow transition: delete every source copy by default, or retain exactly one KMS-encrypted copy under a separate native foundation retention consent.

**Tech Stack:** Consume the foundation pins unchanged: Java 21, Kotlin 2.2.20, Spring Boot 3.5.7, Gradle 8.14.3, PostgreSQL 16.10, and HAPI FHIR 8.10.1. Add HAPI JPA/validation modules on the same HAPI version, HL7 FHIR R4 4.0.1, KR Core `hl7.fhir.kr.core#2.0.0`, AWS SDK v2 through the foundation version catalog, Python 3.12.13, FastAPI 0.141.1, Pydantic 2.13.4, PaddleOCR 3.7.0, PaddlePaddle 3.3.1, PyMuPDF 1.28.2, ClamAV, pytest 9.1.1, and Testcontainers.

## Global Constraints

- Execute the foundation plan through its deletion/restore tasks first. This plan consumes its code; it does not recreate it.
- Do not replace or re-scaffold `settings.gradle.kts`, root `build.gradle.kts`, the Gradle wrapper, `apps/core-api`, base `application.yml`, CI workflows, or foundation migrations V1–V19. Task 10 may replace only the no-op lines between the foundation’s exact REC CI markers.
- Use the allocated REC Flyway namespace V200–V219 only. This plan uses V200–V203.
- Consume `kr.co.genomecompanion.identityaccount.api.CallerPrincipal`, `kr.co.genomecompanion.consentpurpose.api` contracts, `kr.co.genomecompanion.identityaccount.workload` contracts, and `kr.co.genomecompanion.exportdeletion.api` contracts by import. Do not define local substitutes.
- Use the foundation’s native consent matrix exactly: `BUILD_PERSONAL_LAB_TIMELINE` permits only `COLLECT|EXPLAIN`; `PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD` permits only `COLLECT|EXTRACT|NORMALIZE`; `RETAIN_VERIFIED_SOURCE` permits only `RETAIN`. All use `DataSource.USER_UPLOAD` and an explicitly granted `DataCategory.LAB_REPORT|MEDICAL_RECORD`.
- Absence of a retention grant means false. The API never creates, infers, bundles, or preselects retention consent. Revoking retention consent deletes only retained sources; revoking cloud-processing consent cancels and deletes only cloud workflows/artifacts; the foundation’s scoped deletion mapping is authoritative.
- Derive subject identity only from `CallerPrincipal`. No personal endpoint accepts `subjectId` in a body, path, or query.
- Use only synthetic adult data in tests, fixtures, screenshots, local services, and CI.
- Treat file names, bytes, PDF objects, OCR strings, user corrections, FHIR narratives, and imported values as hostile data. No untrusted string becomes an instruction, log template, metric label, span attribute, object key, exception message, or URL parameter.
- Keep PHI out of ordinary logs, traces, metrics, crash reports, analytics, support tools, notifications, object-event envelopes, and URLs. Use the foundation `PhiSafeLogger`, `SafeTelemetry`, and pseudonymous audit contracts; do not add a second logger abstraction.
- Treat explanation questions as PHI. The consumer route and private worker client never log, trace, meter, persist, enqueue, or place the question, selected values, fact IDs, packet body, or worker response in an error.
- Do not create embeddings from personal documents, OCR candidates, FHIR resources, timeline values, exports, or fact packets. Personal-record code cannot import a vector-store or embedding client.
- Export and profile reset consume the foundation `SensitiveActionAuthorizer`; do not add a REC reauthentication, OTP, passkey, deletion-challenge, or raw-JWT parser.
- OCR output is always a candidate. Confidence orders the review screen only; it never verifies a field.
- Do not guess a value, date, unit, range, code, method, organization, or interpretation. Preserve source text. Add UCUM or a clinical code only after an exact reviewed mapping.
- Do not create a `Condition`, diagnosis, medication change, treatment instruction, risk score, or clinical recommendation from extraction.
- Do not expose a FHIR REST endpoint to the consumer. HAPI DAOs and validator are internal application adapters behind subject/purpose authorization.
- Original server-side bytes live only in quarantine or the explicit retention bucket. OCR receives sanitized PNG pages, never an original PDF/image object.
- Default disposition is immediate deletion after verified extraction. “Immediate” means the first delete runs in the same workflow after canonical commit, with no grace-period queue. `TIMELINE_READY` is impossible until all required absence checks pass.
- Optional retention is fixed at 365 days for this MVP slice, uses a dedicated KMS key, remains user-revocable, and never uses Object Lock.
- MyHealthWay is a disabled post-MVP adapter seam. There is no credential, network call, callback, import route, testbed simulator, scraping path, or launch dependency.
- Raw genomes and genetic profiles remain outside this plan and outside the MVP dependency graph.
- Production document processing is blocked until FND owns the inert REC worker runtime and protected release shell described in Task 10: immutable ECR repository, zero-desired-count ECS service/task-definition family, least-privilege execution/task roles, private listener/service identity, no-NAT endpoint-only network, Object-Lock evidence prefix, post-marker image verifier, and digest-only deployment authority. REC may build evidence inside the marker but may not create or mutate that infrastructure.
- `EvidenceRecallClientCertificateAuthorizer` may trust only exact-version FND projections: trust-bundle secret ARN, VersionId, and SHA-256 plus current CRL bucket, key, VersionId, and SHA-256. No `AWSCURRENT`, bucket listing, caller path, ambient trust store, stale cached CRL, or digest-only-without-bytes validation is authoritative.

---

## Foundation Contracts Consumed Verbatim

The compatibility test in Task 1 must compile against these foundation-owned definitions:

```kotlin
CallerPrincipal(subjectId: String, scopes: Set<String>, region: DataRegion)

SensitiveActionAuthorizer.requireAuthorized(
    authentication: Authentication,
    action: SensitiveAction,
): SensitiveActionAuthorization
SensitiveAction.EXPORT_RECORDS
SensitiveAction.RESET_PROFILE

PurposeAuthorizer.requireAllowed(
    PurposeAccessRequest(
        caller = caller,
        consentId = consentId,
        purpose = ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
        dataCategory = DataCategory.LAB_REPORT,
        operation = ConsentOperation.COLLECT,
        at = clock.instant(),
    )
): ConsentAuthorization

ConsentService.grant(caller, command)
ConsentService.list(caller)
ConsentService.revoke(caller, consentId)

WorkloadTokenIssuer.issuePurposeToken(
    subject = OpaqueSubjectRef("sub_AAAAAAAAAAAAAAAAAAAAAA"),
    jti = packetId,
    purpose = WorkerPurpose.PERSONAL_RECORD_EXPLANATION,
)

WorkloadTokenIssuer.issueServiceToken(): SignedJwt
OpaqueSubjectRefFactory.fromSubjectId(caller.subjectId): OpaqueSubjectRef
ConsentBoundPurposeTokenAdapter.issue(
    ExplanationPurposeTokenRequest(
        caller = caller,
        consentId = consentId,
        dataCategory = DataCategory.LAB_REPORT,
        jti = packetId,
    )
): SignedJwt

ProfileDeletionPort.requestDeletion(
    ProfileDeletionCommand(subjectId = caller.subjectId, sourceEventId = sourceEventId)
): UUID

SubjectDataEraser.erase(
    subject: DeletionSubject,
    scope: DeletionScope,
    requestId: UUID,
): DeletionEvidence

ConsentScope(consentId: UUID, purpose: ConsentPurpose) : DeletionScope
ProfileScope : DeletionScope

DeletionService.request(command: DeletionCommand): DeletionRequest
DeletionService.run(requestId: UUID): DeletionReceipt
DeletionReason.CONSENT_REVOKED
DeletionReason.PROFILE_RESET
```

The durable revocation event is `consent.revoked.v1`. Consume the foundation’s `DeletionCommand`, sealed `DeletionScope`, `ConsentScope`, and `ProfileScope` payload and routing rather than parsing an informal JSON string.

REC registers three foundation `SubjectDataEraser` implementations:

| eraserId | DeletionTarget category | Responsibility |
|---|---|---|
| `personal-records` | `WORKFLOW_STATE` | REC jobs, candidate pointers, provenance indexes, timeline/export metadata |
| `document-objects` | `USER_OBJECTS` | quarantine, sanitized pages, candidate artifacts, retained source, export archives |
| `hapi-fhir` | `USER_OBJECTS` | exact subject-indexed HAPI resources and all their prior/deleted versions |

Multiple erasers may share a target. Each `DeletionEvidence` returns the same unique `eraserId`; no deletion enum extension is allowed.

## Pinned FHIR Artifacts

| Artifact | Exact pin | Admission rule |
|---|---|---|
| HAPI FHIR | 8.10.1 in the foundation version catalog | HAPI JPA, R4 structures, and validator must resolve to one version. |
| FHIR | R4 4.0.1 | `FhirContext.forR4Cached()` only. |
| KR Core | [hl7.fhir.kr.core#2.0.0](https://www.hl7korea.or.kr/fhir/krcore/STU2/downloads.html) | Vendored package SHA-256 `1fe401130118affca4a2e52e991521ccfaebfb64f4fab5a1ce583ddb54c8a719`. |
| Independent validator | [org.hl7.fhir.core CLI 6.10.1](https://github.com/hapifhir/org.hl7.fhir.core/releases/tag/6.10.1) | Download outside Git; JAR SHA-256 `e1b75e86c32d6ea02708027d4bd462e4f853f842579e217bf1b4f5c26b733738`. |
| Lab Observation profile | `http://www.hl7korea.or.kr/fhir/krcore/StructureDefinition/krcore-observation-laboratory-result` | Required on every supported lab Observation. |
| Lab report profile | `http://www.hl7korea.or.kr/fhir/krcore/StructureDefinition/krcore-diagnosticreport-laboratory-results` | Required when report-level metadata is emitted. |

HAPI is selected; Medplum is not evaluated, deployed, mirrored, or used as a second truth store.

## Workflow States and Hard Invariants

```text
UPLOAD_TICKET_ISSUED
  -> QUARANTINED
  -> SCANNING
  -> REJECTED
     or SANITIZED
  -> UNSUPPORTED
     or EXTRACTED_REVIEW_REQUIRED
  -> VERIFIED_FHIR_PENDING
  -> VERIFIED_SOURCE_DISPOSITION_PENDING
  -> TIMELINE_READY

Any pre-ready state
  -> CONSENT_REVOKED_PURGE_PENDING
  -> PURGED
```

1. `QUARANTINED` is the only state that references original cloud bytes.
2. Malware scan precedes parser/open/render.
3. OCR reads only inert raster pages.
4. Candidate event envelopes contain opaque artifact references and counts, not OCR text.
5. Every candidate ID has exactly one `Confirm` or `Reject` decision before mapping.
6. A transaction commits only when base R4 and each declared KR Core profile have zero fatal/error issues.
7. `VERIFIED_SOURCE_DISPOSITION_PENDING` means FHIR committed but the timeline remains hidden.
8. `TIMELINE_READY` implies source disposition and temporary-artifact absence were verified.
9. Late callbacks carrying a revoked consent/version cannot promote state and trigger scoped purge.
10. Deletion completes only when all three REC eraser IDs have durable foundation evidence; restored services remain unready until foundation tombstone replay invokes them again.

## Exact File Map

```text
.github/workflows/
  ci.yml                                                  # modify: REC marker block only
  release.yml                                             # modify only after FND adds BEGIN/END REC DOCUMENT WORKER RELEASE STEPS
gradle/
  libs.versions.toml                                      # modify: add HAPI JPA/validation, AWS S3, JSON Schema aliases; keep all pins
apps/core-api/
  build.gradle.kts                                       # modify: append REC dependencies only
  src/main/resources/
    fhir/
      hl7.fhir.kr.core-2.0.0.tgz
      SHA256SUMS
    db/migration/
      V200__rec_document_workflow.sql
      V201__rec_source_timeline_export.sql
      V202__rec_fhir_resource_index.sql
      V203__rec_explanation_recall_index.sql
  src/main/kotlin/kr/co/genomecompanion/personalrecord/
    api/
      PersonalRecordContracts.kt
      DocumentWorkerContracts.kt
      VerifiedFactPacketProducer.kt
    domain/
      DocumentJob.kt
      ExtractionReview.kt
      SourceDisposition.kt
      TimelineItem.kt
    application/
      DocumentIntakeService.kt
      DocumentReviewService.kt
      SourceDispositionService.kt
      TimelineService.kt
      VerifiedFactPacketProjector.kt
      RecordExplanationService.kt
      EvidenceRecallRegistryInstaller.kt
      EvidenceRecallDeliveryService.kt
      PersonalRecordExportService.kt
      RecordExportAttestationSigner.kt
    adapter/in/web/
      PersonalRecordController.kt
      EvidenceRecallInternalController.kt
      EvidenceRecallClientCertificateAuthorizer.kt
    adapter/out/jdbc/
      DocumentJdbcRepository.kt
      ProvenanceJdbcRepository.kt
      ExportJdbcRepository.kt
      ExplanationReceiptJdbcRepository.kt
      EvidenceRecallJdbcRepository.kt
    adapter/out/fhir/
      KrCoreProfiles.kt
      KrCoreValidationSupport.kt
      KrCoreLabMapper.kt
      HapiCanonicalRecordStore.kt
    adapter/out/object/
      S3DocumentObjectStore.kt
    adapter/out/kms/
      KmsRecordExportAttestationSigner.kt
    adapter/out/worker/
      DocumentWorkerClient.kt
      ExplanationWorkerClient.kt
      ExplanationRecallHandler.kt
    adapter/out/deletion/
      PersonalRecordsEraser.kt
      DocumentObjectsEraser.kt
      HapiFhirEraser.kt
    adapter/out/foundation/
      FoundationDocumentIntakeAdapter.kt
      FoundationHealthRecordQueryAdapter.kt
    source/
      PersonalRecordSourceAdapter.kt
      MyHealthWayCapability.kt
    config/
      PersonalRecordProperties.kt
      PersonalRecordConfiguration.kt
      EvidenceRecallTrustMaterialConfiguration.kt
  src/test/kotlin/kr/co/genomecompanion/personalrecord/
    FoundationContractCompatibilityTest.kt
    DocumentWorkerContractSchemaTest.kt
    PersonalRecordArchitectureTest.kt
    DocumentWorkflowRepositoryTest.kt
    DocumentIntakeServiceTest.kt
    PersonalRecordControllerBoundaryTest.kt
    WorkerContractTest.kt
    DocumentReviewServiceTest.kt
    KrCoreValidationTest.kt
    HapiCanonicalRecordStoreTest.kt
    SourceDispositionServiceTest.kt
    TimelineServiceTest.kt
    VerifiedFactPacketProjectorTest.kt
    RecordExplanationControllerTest.kt
    ExplanationWorkerClientTest.kt
    ExplanationRecallTest.kt
    EvidenceRecallContractTest.kt
    EvidenceRecallInternalControllerTest.kt
    EvidenceRecallClientCertificateAuthorizerTest.kt
    PersonalRecordSensitiveActionControllerTest.kt
    PersonalRecordExportServiceTest.kt
    RecordExportAttestationSignerTest.kt
    PersonalRecordDeletionTest.kt
    MyHealthWayCapabilityTest.kt
    PersonalRecordJourneyTest.kt
    support/
      SyntheticPersonalRecords.kt
      PersonalRecordIntegrationEnvironment.kt

packages/contracts/
  openapi/
    personal-record-v1.yaml
    document-worker-internal-v1.yaml
    evidence-recall-internal-v1.yaml
  jsonschema/
    document-worker-v1.schema.json
    rec-document-worker-image-handoff.schema.json
    fact-packet.schema.json
    record-export-attestation.schema.json
    record-export-key-registry.schema.json
    signed-evidence-recall-notice.schema.json              # AI-owned, consumed unchanged
    signed-evidence-recall-key-registry.schema.json        # AI-owned, consumed unchanged
    evidence-recall-registry-installation.schema.json      # AI-owned, consumed unchanged
    evidence-recall-ack.schema.json                        # AI-owned, consumed unchanged
  fixtures/
    document-worker-request.valid.json
    document-worker-upload-ticket-request.valid.json
    document-worker-upload-ticket-response.valid.json
    document-worker-result.valid.json
    fact-packet.valid.json
    rec-document-worker-image-handoff.valid.json
    evidence-recall-shared.valid.json                      # AI-owned golden cross-language fixture

governance/cryptographic/
  record-export-attestation-keys.json
scripts/release/
  build_record_export_key_registry.py
  verify_record_export_key_registry.py
  rec_document_worker_release.py
  test_rec_document_worker_release.py

workers/document-processing/
  pyproject.toml
  uv.lock
  Dockerfile
  Dockerfile.dockerignore
  app/
    __init__.py
    contracts.py
    safe_logging.py
    malware.py
    pdf_safety.py
    rasterize.py
    ocr.py
    extract.py
    object_store.py
    pipeline.py
    main.py
  tests/
    conftest.py
    test_malware_gate.py
    test_pdf_safety.py
    test_ocr_extraction.py
    test_offline_assets.py
    test_pipeline.py
    test_phi_safe_logging.py
    fixtures/
      synthetic-supported-checkup.pdf
      synthetic-supported-checkup-page.png
      unsupported-layout.pdf
  scripts/
    record_model_manifest.py
    vendor_offline_assets.py
    benchmark_supported_templates.py
  model-manifest.json

deploy/local/
  personal-record.compose.yml
  hapi-test.properties

tools/fhir-validator/
  fetch-validator.ps1
  validate-krcore.ps1

ops/restore/
  test_replay_deletion_tombstones.py                    # modify: add REC eraser replay case
```

## REC Public Contracts

Place these types in `PersonalRecordContracts.kt`. They import foundation types and never wrap or duplicate them.

```kotlin
package kr.co.genomecompanion.personalrecord.api

import com.fasterxml.jackson.annotation.JsonValue
import kr.co.genomecompanion.identityaccount.api.CallerPrincipal
import kr.co.genomecompanion.consentpurpose.api.DataCategory
import java.math.BigDecimal
import java.net.URI
import java.time.Instant
import java.time.OffsetDateTime
import java.util.UUID

enum class DeclaredMediaType { PDF, PNG, JPEG }
enum class SourceRetentionChoice { DELETE_AFTER_VERIFICATION, RETAIN_ENCRYPTED_365_DAYS }
enum class VerificationStatus(@get:JsonValue val wireValue: String) {
    USER_VERIFIED("user_verified"),
}

data class VerifiedRecord(
    val factId: UUID,
    val code: String,
    val displayKo: String,
    val value: String,
    val unit: String,
    val effectiveAt: Instant,
    val sourceRef: String,
    val confidence: String,
    val verificationStatus: VerificationStatus,
    val sourceAvailable: Boolean,
) {
    init {
        require(CanonicalMedicalDecimal.isValue(value))
        require(CanonicalMedicalDecimal.isConfidence(confidence))
    }
}

data class VerifiedTimeline(
    val records: List<VerifiedRecord>,
    val generatedAt: Instant,
)

data class BeginUploadRequest(
    val timelineConsentId: UUID,
    val cloudProcessingConsentId: UUID,
    val retentionConsentId: UUID?,
    val dataCategory: DataCategory,
    val declaredMediaType: DeclaredMediaType,
    val declaredBytes: Long,
    val declaredSha256: String,
    val retentionChoice: SourceRetentionChoice = SourceRetentionChoice.DELETE_AFTER_VERIFICATION,
)

data class BeginUploadCommand(
    val caller: CallerPrincipal,
    val timelineConsentId: UUID,
    val cloudProcessingConsentId: UUID,
    val retentionConsentId: UUID?,
    val dataCategory: DataCategory,
    val declaredMediaType: DeclaredMediaType,
    val declaredBytes: Long,
    val declaredSha256: String,
    val retentionChoice: SourceRetentionChoice,
)

data class PersonalRecordUploadTicket(
    val documentId: UUID,
    val uploadUri: URI,
    val requiredHeaders: Map<String, String>,
    val expiresAt: Instant,
    val maximumBytes: Long,
)

data class CompleteDocumentUploadRequest(
    val versionId: String,
    val checksumSha256: String,
)

enum class DocumentStatusState(@get:JsonValue val wireValue: String) {
    UPLOAD_TICKET_ISSUED("upload_ticket_issued"),
    QUARANTINED("quarantined"),
    SCANNING("scanning"),
    REJECTED("rejected"),
    SANITIZED("sanitized"),
    UNSUPPORTED("unsupported"),
    EXTRACTED_REVIEW_REQUIRED("extracted_review_required"),
    VERIFIED_FHIR_PENDING("verified_fhir_pending"),
    VERIFIED_SOURCE_DISPOSITION_PENDING("verified_source_disposition_pending"),
    TIMELINE_READY("timeline_ready"),
    CONSENT_REVOKED_PURGE_PENDING("consent_revoked_purge_pending"),
    PURGED("purged"),
}

enum class DocumentFailureCode(@get:JsonValue val wireValue: String) {
    MALWARE_DETECTED("malware_detected"),
    UNSUPPORTED_MEDIA("unsupported_media"),
    ACTIVE_CONTENT("active_content"),
    ENCRYPTED_DOCUMENT("encrypted_document"),
    PAGE_LIMIT("page_limit"),
    PIXEL_LIMIT("pixel_limit"),
    PROCESSING_TIMEOUT("processing_timeout"),
    PROCESSING_FAILED("processing_failed"),
}

data class DocumentStatusResponse(
    val documentId: UUID,
    val state: DocumentStatusState,
    val revision: Long,
    val updatedAt: Instant,
    val failureCode: DocumentFailureCode?,
) {
    init {
        require(revision >= 0)
        require((state in setOf(DocumentStatusState.REJECTED, DocumentStatusState.UNSUPPORTED)) == (failureCode != null))
    }
}

data class BoundingBox(val x0: Int, val y0: Int, val x1: Int, val y1: Int)

data class OcrCandidate(
    val candidateId: UUID,
    val page: Int,
    val boundingBox: BoundingBox,
    val labelText: String,
    val valueText: String,
    val unitText: String?,
    val referenceRangeText: String?,
    val effectiveDateText: String?,
    val confidence: BigDecimal,
)

data class DocumentReviewResponse(
    val documentId: UUID,
    val revision: Long,
    val candidates: List<OcrCandidate>,
) {
    init {
        require(revision >= 0)
        require(candidates.isNotEmpty() && candidates.size <= 200)
        require(candidates.map(OcrCandidate::candidateId).distinct().size == candidates.size)
    }
}

sealed interface FieldDecision {
    val candidateId: UUID

    data class Confirm(
        override val candidateId: UUID,
        val displayKo: String,
        val value: String,
        val unit: String?,
        val referenceRangeText: String?,
        val effectiveAt: OffsetDateTime,
    ) : FieldDecision

    data class Reject(override val candidateId: UUID) : FieldDecision
}

data class ConfirmExtractionCommand(
    val caller: CallerPrincipal,
    val documentId: UUID,
    val timelineConsentId: UUID,
    val expectedRevision: Long,
    val decisions: List<FieldDecision>,
)

data class ConfirmExtractionRequest(
    val timelineConsentId: UUID,
    val expectedRevision: Long,
    val decisions: List<FieldDecision>,
)

data class CreateRecordExplanationRequest(
    val timelineConsentId: UUID,
    val factIds: List<UUID>,
    val userQuestion: String,
) {
    init {
        require(factIds.size in 1..20 && factIds.distinct().size == factIds.size)
        require(userQuestion.length in 1..500 && userQuestion.isNotBlank())
    }
}

enum class RecordExplanationRecallState(@get:JsonValue val wireValue: String) {
    ACTIVE("active"),
    BANNER("banner"),
    REGENERATE("regenerate"),
    SUPPRESS("suppress"),
}

data class RecordExplanationRecallStatusResponse(
    val state: RecordExplanationRecallState,
)

data class CreatePersonalRecordExportRequest(
    val idempotencyKey: UUID,
    val includeRetainedSource: Boolean = false,
)

data class CreatePersonalRecordExportResponse(
    val exportId: UUID,
    val status: String = "accepted",
)

enum class RecordExportState(@get:JsonValue val wireValue: String) {
    ACCEPTED("accepted"), BUILDING("building"), READY("ready"),
    REDEEMED("redeemed"), EXPIRED("expired"), FAILED("failed"),
}

data class RecordExportStatusResponse(
    val exportId: UUID,
    val state: RecordExportState,
    val expiresAt: Instant?,
    val downloadTicket: String?,
    val archiveSha256: String?,
    val manifestSha256: String?,
    val attestationKeyId: String?,
    val failureCode: String?,
)

data class RedeemRecordExportRequest(val downloadTicket: String)

enum class RecordSourceDisposition(@get:JsonValue val wireValue: String) {
    DELETED_AFTER_VERIFICATION("deleted_after_verification"),
    RETAINED_ENCRYPTED("retained_encrypted"),
    DELETION_PENDING("deletion_pending"),
}

data class RecordSourceView(
    val sourceRef: String,
    val dataCategory: DataCategory,
    val disposition: RecordSourceDisposition,
    val sourceAvailable: Boolean,
    val retentionConsentId: UUID?,
    val retentionExpiresAt: Instant?,
    val dispositionReceipt: String,
)

data class RecordSourceListResponse(
    val sources: List<RecordSourceView>,
    val generatedAt: Instant,
)

data class ResetPersonalRecordProfileRequest(
    val idempotencyKey: UUID,
    val confirmationPhrase: String,
)

data class ResetPersonalRecordProfileResponse(
    val deletionRequestId: UUID,
    val status: String = "accepted",
)

object CanonicalMedicalDecimal {
    private val VALUE = Regex("^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$")
    private val CONFIDENCE = Regex("^(?:0(?:\\.[0-9]+)?|1(?:\\.0+)?)$")
    fun isValue(value: String): Boolean = value.length <= 96 && VALUE.matches(value) && value != "-0" && !Regex("^-0\\.0+$").matches(value)
    fun isConfidence(value: String): Boolean = value.length <= 32 && CONFIDENCE.matches(value)
    fun parseForCalculation(value: String): BigDecimal = requireNotNull(value.takeIf(::isValue)) { "invalid canonical decimal" }.toBigDecimal()
}
```

`declaredSha256` and `checksumSha256` are the same canonical lowercase `sha256:<64hex>` value computed over the browser's local bytes before a ticket request. `PersonalRecordUploadTicket.requiredHeaders` is an exact additional-properties-false map with lowercase keys `content-type`, `if-none-match`, `x-amz-checksum-sha256`, `x-amz-server-side-encryption`, and `x-amz-server-side-encryption-aws-kms-key-id`; `if-none-match` is exactly `*`, and the checksum header is the base64 encoding of the 32 checksum bytes represented by `declaredSha256`. `BeginUploadRequest` is the public additional-properties-false request body and has no caller, subject, document ID, filename, key, or bucket. `BeginUploadCommand` is internal-only: `PersonalRecordController` resolves the authenticated `CallerPrincipal` from the foundation security context and copies the validated public fields into the command; Jackson/OpenAPI cannot deserialize or expose the command. The completion request carries no filename, object key, subject, bucket, or caller-selected metadata.

Place this producer port in `VerifiedFactPacketProducer.kt`; it reuses the foundation opaque type and deliberately has no `FactPacket` DTO:

```kotlin
package kr.co.genomecompanion.personalrecord.api

import com.fasterxml.jackson.databind.JsonNode
import kr.co.genomecompanion.consentpurpose.api.DataCategory
import kr.co.genomecompanion.identityaccount.api.CallerPrincipal
import kr.co.genomecompanion.identityaccount.workload.OpaqueSubjectRef
import java.time.Instant
import java.util.UUID

data class VerifiedFactPacketRequest(
    val caller: CallerPrincipal,
    val timelineConsentId: UUID,
    val dataCategory: DataCategory,
    val packetId: UUID,
    val opaqueSubjectRef: OpaqueSubjectRef,
    val requestedAt: Instant,
    val selectedFactIds: List<UUID>,
)

fun interface VerifiedFactPacketProducer {
    fun produce(request: VerifiedFactPacketRequest): JsonNode
}
```

Canonical-store and lifecycle ports are internal:

```kotlin
interface CanonicalRecordStore {
    fun validate(resource: org.hl7.fhir.r4.model.Resource, profile: String): ConformanceReport
    fun transact(subjectId: String, bundle: org.hl7.fhir.r4.model.Bundle, idempotencyKey: UUID): StoredTransaction
    fun observations(subjectId: String): List<org.hl7.fhir.r4.model.Observation>
    fun exportBundle(subjectId: String): org.hl7.fhir.r4.model.Bundle
    fun deleteAndExpunge(subjectId: String, requestId: UUID): Set<String>
}

interface DocumentObjectStore {
    fun issueQuarantineUpload(documentId: UUID, mediaType: DeclaredMediaType, bytes: Long, declaredSha256: String): PersonalRecordUploadTicket
    fun headQuarantine(documentId: UUID, versionId: String, expectedSha256: String): ObjectMetadata
    fun retainEncrypted(sourceRef: String, documentId: UUID, expiresAt: Instant): RetainedObject
    fun verifyKmsEncrypted(ref: String, expectedSha256: String): Boolean
    fun deleteAndVerifyAbsent(ref: String)
    fun deleteAll(subjectId: String, requestId: UUID): Set<String>
}
```

The API routes are exactly:

```text
POST /v1/documents/upload-ticket
POST /v1/documents/{documentId}/upload-complete
GET  /v1/documents/{documentId}/status
GET  /v1/documents/{documentId}/review
POST /v1/documents/{documentId}/confirm-fields
GET  /v1/records/timeline
GET  /v1/records/{resourceType}/{id}
POST /v1/records/explanations
GET  /v1/records/explanations/{responseId}/status
POST /v1/exports
GET  /v1/exports/{exportId}
POST /v1/exports/{exportId}/download
POST /v1/profile/reset
GET  /v1/record-sources
```

There is no `/fhir`, `/diagnose`, `/prescribe`, `/upload-genome`, or MyHealthWay connect/import route.

Freeze these OpenAPI `operationId` values; compatibility tests reject deletion, renaming, or duplication:

| Route | operationId | Success response DTO |
|---|---|---|
| `POST /v1/documents/upload-ticket` | `createDocumentUploadTicket` | `PersonalRecordUploadTicket` |
| `POST /v1/documents/{documentId}/upload-complete` | `completeDocumentUpload` | `DocumentStatusResponse` |
| `GET /v1/documents/{documentId}/status` | `getDocumentStatus` | `DocumentStatusResponse` |
| `GET /v1/documents/{documentId}/review` | `getDocumentReview` | `DocumentReviewResponse` |
| `POST /v1/documents/{documentId}/confirm-fields` | `confirmDocumentFields` | `DocumentStatusResponse` |
| `GET /v1/records/timeline` | `getRecordTimeline` | `VerifiedTimeline` |
| `GET /v1/records/{resourceType}/{id}` | `getRecord` | `VerifiedRecord` |
| `POST /v1/records/explanations` | `requestRecordExplanation` | shared `ExplanationResponse` |
| `GET /v1/records/explanations/{responseId}/status` | `getRecordExplanationStatus` | `RecordExplanationRecallStatusResponse` |
| `POST /v1/exports` | `createRecordExport` | `CreatePersonalRecordExportResponse` |
| `GET /v1/exports/{exportId}` | `getRecordExport` | `RecordExportStatusResponse` |
| `POST /v1/exports/{exportId}/download` | `downloadRecordExport` | `application/zip` after `RedeemRecordExportRequest` |
| `POST /v1/profile/reset` | `resetProfile` | `ResetPersonalRecordProfileResponse` |
| `GET /v1/record-sources` | `getRecordSources` | `RecordSourceListResponse` |

`createDocumentUploadTicket` accepts only the additional-properties-false `BeginUploadRequest` fields above, including `declaredSha256`; the controller derives `caller` exclusively from the authenticated principal and copies every validated request field into `BeginUploadCommand`. `completeDocumentUpload` accepts only `CompleteDocumentUploadRequest {versionId,checksumSha256}`. Only `checksumSha256` must byte-equal the stored pre-upload declaration. `versionId` must be the nonempty value returned by S3 after the browser PUT; core uses the ticket's server-stored bucket/key plus that caller-returned VersionId for an exact-VersionId HEAD and accepts it only when size, media type, checksum, SSE-KMS key, and create-only object identity all match before any worker transition. It never compares VersionId to a value allegedly known before upload and never falls back to current/unversioned HEAD. `PersonalRecordUploadTicket` never returns a key or bucket and its five required headers are byte-derived only from the validated media type, declared bytes/checksum, fixed quarantine KMS key, and create-only condition.

`confirmDocumentFields` accepts only additional-properties-false `ConfirmExtractionRequest {timelineConsentId,expectedRevision,decisions}`. It accepts neither `caller` nor `documentId` in JSON. `PersonalRecordController` derives the caller from the authenticated principal, obtains `documentId` only from the validated UUIDv4 path, rejects any body alias/additional property attempting either value, and copies the validated request fields into internal `ConfirmExtractionCommand`. `DocumentReviewService` consumes only that internal command and still rechecks owner, timeline consent, expected revision, and the complete decision set; no request DTO is trusted as an identity or ownership source.

---

### Task 1: Bind to the foundation and publish shared schemas

**Files:**

- Modify: `gradle/libs.versions.toml`
- Modify: `apps/core-api/build.gradle.kts`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/api/PersonalRecordContracts.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/api/DocumentWorkerContracts.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/api/VerifiedFactPacketProducer.kt`
- Create: `packages/contracts/openapi/personal-record-v1.yaml`
- Create: `packages/contracts/openapi/document-worker-internal-v1.yaml`
- Create: `packages/contracts/jsonschema/document-worker-v1.schema.json`
- Create: `packages/contracts/fixtures/document-worker-request.valid.json`
- Create: `packages/contracts/fixtures/document-worker-upload-ticket-request.valid.json`
- Create: `packages/contracts/fixtures/document-worker-upload-ticket-response.valid.json`
- Create: `packages/contracts/fixtures/document-worker-result.valid.json`
- Create: `packages/contracts/jsonschema/fact-packet.schema.json`
- Create: `packages/contracts/fixtures/fact-packet.valid.json`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/FoundationContractCompatibilityTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/DocumentWorkerContractSchemaTest.kt`

**Interfaces:**

- Consumes: foundation `CallerPrincipal`, `SensitiveActionAuthorizer`, `SensitiveAction`, `PurposeAuthorizer`, `ConsentService`, `OpaqueSubjectRef`, `WorkloadTokenIssuer`, `ProfileDeletionPort`, `DeletionService`, `SubjectDataEraser`, `DeletionReason`, `DeletionScope`, `ConsentScope`, `ProfileScope`, and fixed version catalog.
- Produces: REC commands, OpenAPI, exact `DocumentWorkerRequest`/`DocumentWorkerResult` DTOs and strict document-worker request/result schemas/fixtures, and the one canonical fact-packet schema consumed by the AI plan.

- [ ] **Step 1: Write the compatibility and schema tests first.**

```kotlin
@Test
fun `REC compiles against native foundation purposes`() {
    assertThat(ConsentPurpose.entries).contains(
        ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
        ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
        ConsentPurpose.RETAIN_VERIFIED_SOURCE,
    )
    assertThat(ConsentOperation.entries).contains(ConsentOperation.RETAIN)
    assertThat(DataSource.entries).containsExactly(DataSource.USER_UPLOAD)
    assertThat(SensitiveAction.entries).containsExactlyInAnyOrder(
        SensitiveAction.EXPORT_RECORDS,
        SensitiveAction.RESET_PROFILE,
    )
    assertThat(DeletionTarget.entries).contains(
        DeletionTarget.USER_OBJECTS,
        DeletionTarget.WORKFLOW_STATE,
    )
    val scoped: DeletionScope = ConsentScope(
        UUID.fromString("00000000-0000-4000-8000-000000000011"),
        ConsentPurpose.RETAIN_VERIFIED_SOURCE,
    )
    assertThat(scoped).isInstanceOf(ConsentScope::class.java)
}
```

Load `fact-packet.schema.json` with a JSON Schema validator and validate the committed fixture. Add a negative fixture in the test body with `subjectRef="usr_bad"` and assert the error points to `/subjectRef`. `DocumentWorkerContractSchemaTest` independently loads the worker schema plus all four fixtures and performs the request/ticket/result mutation matrix below.

Before Task 3, freeze `document-worker-v1.schema.json` as a Draft 2020-12 `oneOf` contract for four message DTOs, with `$defs` and `additionalProperties:false` at every object. Every signature object is exactly `{alg:"ES256",kid,issuer,audience,value}`; `kid` is one exact FND KMS key ARN, `value` is base64url without padding, and the signer converts KMS `ECDSA_SHA_256` DER to the 64-byte JOSE `R||S` form before encoding. Each signature covers RFC 8785 canonical JSON of its whole message omitting only the signature field.

`DocumentWorkerRequest` has exactly `{schemaVersion:"document-worker-request.v1",workflowId,authorizationDecisionDigest,issuedAt,expiresAt,nonce,source,destinationAuthorization,templateId,templateVersion,authorizationSignature}`. `workflowId` is UUID; `authorizationDecisionDigest` and checksums are lowercase `sha256:`; `issuedAt`/`expiresAt` are UTC `Z`, with `issuedAt-30s <= now <= expiresAt`, `expiresAt-issuedAt <= 300s`, and no future skew beyond 30 seconds; `nonce` is exactly 43 base64url characters. `source` is exactly `{bucket,key,versionId,method:"GET",url,maxBytes,sha256}` with a nonempty exact S3 VersionId and `maxBytes` in `1..20971520`. `destinationAuthorization` is exactly `{bucket,key,method:"PUT",maxBytes,kmsKeyId,ifNoneMatch:"*"}` with a core-created unique key and `maxBytes` in `1..50331648`; it intentionally has no URL, output length, or output checksum because those do not exist before processing. `authorizationDecisionDigest` binds the durable allow decision's workflow, consent/purpose/category/operation, source exact version/digest/cap, destination key/method/max/KMS/create-only condition, template/version, issued/expiry, and nonce without disclosing consent or subject. `authorizationSignature` requires `issuer="urn:genome-companion:core:document-worker-authorizer"`, `audience="urn:genome-companion:document-worker"`, and the sole FND-pinned genesis core-authorization `kid`; every other, candidate, or previous key is rejected.

After processing, `DocumentWorkerUploadTicketRequest` is exactly `{schemaVersion:"document-worker-upload-ticket-request.v1",workflowId,nonce,issuedAt,expiresAt,destination,workerSignature}` where `destination` is exactly `{bucket,key,method:"PUT",contentLength,checksumSha256,kmsKeyId,ifNoneMatch:"*"}` and length is `1..destinationAuthorization.maxBytes`. It requires `issuer="urn:genome-companion:document-worker"`, `audience="urn:genome-companion:core:document-worker-upload-ticket"`, the worker-result signing `kid`, the same 30-second/five-minute time rules, and byte equality to the initial destination authorization. Core rechecks the durable consent/purpose decision and unchanged workflow/nonce/request digest, then returns `DocumentWorkerUploadTicketResponse` exactly `{schemaVersion:"document-worker-upload-ticket-response.v1",workflowId,nonce,issuedAt,expiresAt,upload,authorizationSignature}`. `upload` is the same destination plus `url`; response expiry is at most five minutes, and its core signature uses audience `urn:genome-companion:document-worker-upload-ticket`. No response exists after consent revocation, conflicting request digest, replayed nonce, cap mismatch, or prior different ticket.

`DocumentWorkerResult` has exactly `{schemaVersion:"document-worker-result.v1",workflowId,nonce,issuedAt,outcome,destination,candidateCount,rejectionCode,resultSignature}`. `outcome` is `COMPLETED|REJECTED`; `destination` is null for rejection or exactly `{bucket,key,versionId,checksumSha256,contentLength}` and must echo the ticket plus S3's returned `x-amz-version-id`; `candidateCount` is `0..200`; `rejectionCode` is nullable and, only for `REJECTED`, one of `EXPIRED|REPLAYED|AUTH_INVALID|SOURCE_MISMATCH|SOURCE_TOO_LARGE|CHECKSUM_MISMATCH|MALWARE|UNSAFE_PDF|UNSUPPORTED_MEDIA|UNSUPPORTED_TEMPLATE|DESTINATION_CONFLICT|OUTPUT_MISMATCH|INTERNAL_FAILURE`. Its signature uses worker issuer, audience `urn:genome-companion:core:document-worker-result`, and the worker-result key. Kotlin DTOs and Python models use these exact names/types; the client signature is `fun submit(request: DocumentWorkerRequest): DocumentWorkerResult`, never `(workflowId, JsonNode)` or `sanitizedWorkerRequest/result` placeholders.

FND owns two purpose-specific asymmetric KMS `ECC_NIST_P256` `SIGN_VERIFY` keys: `rec_document_core_authorization_signing_key_arn` and `rec_document_worker_result_signing_key_arn`. Core alone gets `kms:Sign`/`ECDSA_SHA_256` on the first and worker alone gets it on the second; neither gets decrypt, data-key, key administration, the other Sign action, or caller-selected algorithm/key. A one-shot FND publisher alone exact-`GetPublicKey`s those two genesis keys, validates their spec/usage, writes each strict canonical Secrets Manager JWK `{kty:"EC",crv:"P-256",x,y,use:"sig",alg:"ES256",kid}` at one immutable version, records ARN/VersionId/`sha256:` digest, and then loses GetPublicKey/write permission. Core signs only through `REC_DOCUMENT_CORE_AUTH_SIGNING_KEY_ARN`; worker signs only through `REC_DOCUMENT_WORKER_RESULT_SIGNING_KEY_ARN`, using `MessageType=DIGEST` and `ECDSA_SHA_256`. Worker receives only the core public JWK tuple; core receives only the worker public JWK tuple. Execution roles inject the exact VersionId, runtime verifies digest/JWK coordinates and `kid`, and task roles need no secret read or GetPublicKey. This milestone deliberately rejects candidate/previous tuples, signer changes, and publisher-role recreation: disable/revocation fails readiness closed, and no REC signing-key replacement is authorized until a separately approved `rec-document-signing-key-rotation` plan adds and tests the dual-verifier rollout, signer switch, cross-direction probes, rollback, and retirement ceremony.

`document-worker-internal-v1.yaml` freezes core-to-worker `POST /internal/v1/document-jobs` / operationId `processDocumentJob` and worker-to-core `POST /internal/v1/document-jobs/{workflowId}/upload-ticket` / operationId `createDocumentWorkerUploadTicket`; both are JSON-only, request/response body maximum 65,536 bytes, return no redirect, and reference the exact four schema branches without inline duplicate DTOs. Every other worker/core internal method/path is 404. SG/mTLS provides transport only, not job authorization. Before source URL use, worker verifies the core signature/JWK digest, decision digest, issued/expiry/skew, exact Seoul S3 host, and nonce replay state. It exact-VersionId GETs and streams within the source cap, then computes output length/checksum before requesting a ticket. It verifies the returned core signature and bound ticket before create-only PUT. S3 assigns the PUT VersionId; worker captures `x-amz-version-id` and signs it into the result. Core verifies worker signature/JWK digest and the bound workflow/nonce/result, then exact-version HEAD and bounded GET verifies returned bucket/key/VersionId/length/checksum before transition. Stable retries return the byte-identical signed ticket/result; same workflow/nonce with a different digest, a different existing destination, or response-loss ambiguity fails `DESTINATION_CONFLICT`. No `ListBucket`, current-version GET/HEAD, caller-discovered VersionId, second write, or prebound PUT VersionId is allowed. Schema/route tests validate both operationIds and all four fixtures and mutate every field, key/kid/alg/issuer/audience, public-JWK version/digest, cap, time, signature, replay, consent race, returned VersionId, response-loss retry, and additional property before Task 3 can start.

The OpenAPI compatibility test also locks all 14 operation IDs in the route ledger; the exact additional-properties-false `BeginUploadRequest` fields `timelineConsentId,cloudProcessingConsentId,retentionConsentId,dataCategory,declaredMediaType,declaredBytes,declaredSha256,retentionChoice`; the exact additional-properties-false `ConfirmExtractionRequest` fields `timelineConsentId,expectedRevision,decisions`; and rejection of public `caller`, `documentId`, subject, filename, key, or bucket aliases. It also locks canonical string schemas for `VerifiedRecord.value/confidence`; exact `DocumentStatusResponse` fields `documentId,state,revision,updatedAt,failureCode`, its complete state/failure enums and conditional failure-code invariant; exact `DocumentReviewResponse` fields `documentId,revision,candidates`, candidate bounds/uniqueness, and the complete `OcrCandidate` shape; exact `RecordExportStatusResponse`, `RedeemRecordExportRequest`, `RecordSourceView`, and `RecordSourceListResponse` required/nullable/enum fields; the RFC 9457 `export_too_large` 413 response on `createRecordExport`; and `application/zip` plus required numeric `Content-Length` (`maximum: 50331648`) and required case-insensitive `X-GC-Archive-SHA256` response header matching `^sha256:[0-9a-f]{64}$` on `downloadRecordExport`. It rejects a missing, duplicate, comma-folded, mixed-case-duplicate, malformed, or status-mismatched digest header before body commitment; a `number` wire for either medical decimal; an arbitrary document/export failure code; an empty or 201-candidate review; a download ticket outside `^[A-Za-z0-9_-]{43}$`; a digest outside the frozen pattern; or an additional property. Export `failureCode` is nullable and, when present, is the single literal `export_failed`; no internal exception or source path crosses either status contract.

- [ ] **Step 2: Run and verify RED.**

Run:

```powershell
.\gradlew.bat --no-daemon :apps:core-api:test --tests "*FoundationContractCompatibilityTest" --tests "*DocumentWorkerContractSchemaTest"
```

Expected: compilation fails for absent REC contracts or either schema test fails because the schema/fixtures/strict worker DTOs are absent. If the native foundation purpose constants are absent, return to the foundation plan and implement its revised consent task before proceeding.

- [ ] **Step 3: Add only focused dependencies and exact schemas.**

Append HAPI JPA/validation, AWS S3, and JSON Schema validator aliases to the existing version catalog. Reuse `hapi=8.10.1`; do not alter foundation versions, plugins, repositories, toolchains, bootJar, or test configuration.

`fact-packet.schema.json` is authoritative and has `additionalProperties=false`. Its exact required wire fields are:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.genome-companion.kr/fact-packet.schema.json",
  "title": "VerifiedRecordFactPacket",
  "type": "object",
  "additionalProperties": false,
  "required": ["packetId", "subjectRef", "purpose", "requestedAt", "facts"],
  "properties": {
    "packetId": { "type": "string", "format": "uuid" },
    "subjectRef": { "type": "string", "pattern": "^sub_[A-Za-z0-9_-]{22,64}$" },
    "purpose": { "const": "explain_verified_record" },
    "requestedAt": { "type": "string", "format": "date-time" },
    "facts": {
      "type": "array",
      "minItems": 1,
      "maxItems": 50,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["factId", "code", "displayKo", "value", "unit", "effectiveAt", "sourceRef", "confidence", "verificationStatus"],
        "properties": {
          "factId": { "type": "string", "format": "uuid" },
          "code": { "type": "string", "pattern": "^[A-Za-z][A-Za-z0-9+.-]*://[^|\\s]{1,40}\\|[^|\\s]{1,23}$", "maxLength": 64 },
          "displayKo": { "type": "string", "minLength": 1, "maxLength": 120 },
          "value": { "type": "number" },
          "unit": { "type": "string", "minLength": 1, "maxLength": 32 },
          "effectiveAt": { "type": "string", "format": "date-time" },
          "sourceRef": { "type": "string", "pattern": "^src_[A-Za-z0-9_-]{16,64}$" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "verificationStatus": { "const": "user_verified" }
        }
      }
    }
  }
}
```

Commit this exact synthetic fixture as `fact-packet.valid.json`:

```json
{
  "packetId": "00000000-0000-4000-8000-000000000021",
  "subjectRef": "sub_AAAAAAAAAAAAAAAAAAAAAA",
  "purpose": "explain_verified_record",
  "requestedAt": "2026-08-09T00:00:00Z",
  "facts": [
    {
      "factId": "00000000-0000-4000-8000-000000000022",
      "code": "http://loinc.org|2345-7",
      "displayKo": "합성 혈당",
      "value": 5.1,
      "unit": "mmol/L",
      "effectiveAt": "2026-08-08T09:00:00Z",
      "sourceRef": "src_AAAAAAAAAAAAAAAAAAAAAA",
      "confidence": 1.0,
      "verificationStatus": "user_verified"
    }
  ]
}
```

The code syntax is frozen as canonical `system|code`, never a bare code. The shared cross-workstream test feeds this exact `http://loinc.org|2345-7` + `mmol/L` fixture to AI's governed evidence selector and requires an explicit supported-claim or intentional abstention result; a spelling mismatch between REC and AI cannot silently become “no evidence.” Do not hand-write another `FactPacket` DTO. `VerifiedFactPacketProducer` returns a Jackson `JsonNode` validated against this schema; the AI slice consumes the same file.

- [ ] **Step 4: Re-run and verify GREEN.**

Expected: the compatibility test passes, the fact-packet fixture and all four strict worker fixtures pass, every worker request/ticket/result/signature/replay/version mutation fails, invalid subject prefix fails, and Gradle reports one HAPI version.

- [ ] **Step 5: Commit.**

```powershell
git add gradle/libs.versions.toml apps/core-api/build.gradle.kts apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/api apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/FoundationContractCompatibilityTest.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/DocumentWorkerContractSchemaTest.kt packages/contracts
git commit -m "feat: define personal record contracts"
```

### Task 2: Implement the persistent state machine and PHI-safe boundaries

**Files:**

- Create: `apps/core-api/src/main/resources/db/migration/V200__rec_document_workflow.sql`
- Create: `apps/core-api/src/main/resources/db/migration/V201__rec_source_timeline_export.sql`
- Create: `apps/core-api/src/main/resources/db/migration/V202__rec_fhir_resource_index.sql`
- Create: `apps/core-api/src/main/resources/db/migration/V203__rec_explanation_recall_index.sql`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/domain/DocumentJob.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/domain/ExtractionReview.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/domain/SourceDisposition.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/domain/TimelineItem.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/jdbc/DocumentJdbcRepository.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/jdbc/ProvenanceJdbcRepository.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/jdbc/ExportJdbcRepository.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/jdbc/ExplanationReceiptJdbcRepository.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/jdbc/EvidenceRecallJdbcRepository.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/config/PersonalRecordProperties.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/config/PersonalRecordConfiguration.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/DocumentWorkflowRepositoryTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/PersonalRecordArchitectureTest.kt`

**Interfaces:**

- Consumes: PostgreSQL 16.10, foundation transaction/outbox, `PhiSafeLogger`, `SafeTelemetry`, `Clock`.
- Produces: optimistic `DocumentJob` transitions, provenance/resource index, source disposition, export state, minimal explanation recall index, monotonic public recall-registry anchor, and durable PHI-free recall acknowledgements.

- [ ] **Step 1: Write failing state, migration, and architecture tests.**

Test legal transitions and reject every skipped/reversed transition. Use a real PostgreSQL Testcontainer to prove migrations start after V19 and create:

- `rec_document_job` with no original filename;
- `rec_verified_source_field` with FHIR ref/page/bounding box but no duplicate clinical value;
- `rec_source_disposition`;
- `rec_export_job`;
- `rec_subject_resource_index`.
- `rec_explanation_receipt` with response UUID, opaque subject ref, evidence-pack ID/version, disposition, and created time; it has no mutable recall pointer, question, value, fact ID, claim, citation text, raw fact, packet, or response body column. Recall presentation is derived from the append-only notice table at the injected clock.
- `rec_evidence_recall_registry` plus a singleton anchor containing only a signed public-key registry, sequence, digest, and timestamps;
- `rec_evidence_recall_notice` containing only notice/digest/pack/action/effective time/affected count/processed time needed to reconstruct the frozen PHI-free acknowledgement; it has no reason code, subject, response, question, value, claim, source, or content column.

Extend architecture rules so personal-record domain/application packages cannot depend on SLF4J, Logback, OpenTelemetry builders, Micrometer tag builders, vector stores, embedding clients, controllers, S3, or HAPI DAOs.

```kotlin
@Test
fun `timeline ready cannot bypass source disposition`() {
    val job = syntheticJob(state = DocumentState.VERIFIED_FHIR_PENDING)

    assertThatThrownBy { job.transitionTo(DocumentState.TIMELINE_READY) }
        .isInstanceOf(IllegalDocumentTransition::class.java)
}
```

- [ ] **Step 2: Run and verify RED.**

```powershell
.\gradlew.bat --no-daemon :apps:core-api:test --tests "*DocumentWorkflowRepositoryTest" --tests "*PersonalRecordArchitectureTest"
```

Expected: compilation failure for absent domain/repositories.

- [ ] **Step 3: Implement the minimum state aggregate and JDBC compare-and-set.**

```kotlin
enum class DocumentState {
    UPLOAD_TICKET_ISSUED,
    QUARANTINED,
    SCANNING,
    REJECTED,
    SANITIZED,
    UNSUPPORTED,
    EXTRACTED_REVIEW_REQUIRED,
    VERIFIED_FHIR_PENDING,
    VERIFIED_SOURCE_DISPOSITION_PENDING,
    TIMELINE_READY,
    CONSENT_REVOKED_PURGE_PENDING,
    PURGED,
}

fun DocumentJob.transitionTo(next: DocumentState): DocumentJob {
    if (next !in allowedTransitions.getValue(state)) throw IllegalDocumentTransition(state, next)
    return copy(state = next, revision = revision + 1)
}
```

`V203__rec_explanation_recall_index.sql` is exact and intentionally cannot hold content:

```sql
create table rec_explanation_receipt (
    response_id uuid primary key,
    subject_ref varchar(68) not null check (subject_ref ~ '^sub_[A-Za-z0-9_-]{22,64}$'),
    evidence_pack_id varchar(128) not null,
    evidence_pack_version varchar(64) not null,
    disposition varchar(24) not null check (
        disposition in ('released', 'abstained', 'emergency_route', 'blocked')
    ),
    created_at timestamptz not null
);

create index rec_explanation_receipt_subject_response_idx
    on rec_explanation_receipt (subject_ref, response_id);
create index rec_explanation_receipt_pack_idx
    on rec_explanation_receipt (evidence_pack_id, evidence_pack_version);

create table rec_evidence_recall_registry (
    sequence bigint primary key check (sequence >= 0),
    registry_digest varchar(71) not null unique check (
        registry_digest ~ '^sha256:[0-9a-f]{64}$'
    ),
    signed_registry_json jsonb not null,
    accepted_at timestamptz not null,
    unique (sequence, registry_digest)
);

create table rec_evidence_recall_anchor (
    singleton boolean primary key default true check (singleton),
    current_sequence bigint not null check (current_sequence >= 0),
    current_digest varchar(71) not null check (
        current_digest ~ '^sha256:[0-9a-f]{64}$'
    ),
    updated_at timestamptz not null,
    foreign key (current_sequence, current_digest)
        references rec_evidence_recall_registry (sequence, registry_digest)
);

create table rec_evidence_recall_notice (
    notice_id uuid primary key,
    notice_sha256 varchar(71) not null unique check (
        notice_sha256 ~ '^sha256:[0-9a-f]{64}$'
    ),
    registry_sequence bigint not null check (registry_sequence >= 0),
    registry_digest varchar(71) not null check (
        registry_digest ~ '^sha256:[0-9a-f]{64}$'
    ),
    evidence_pack_id varchar(128) not null,
    evidence_pack_version varchar(64) not null,
    action varchar(16) not null check (action in ('banner', 'regenerate', 'suppress')),
    effective_at timestamptz not null,
    affected_count bigint not null check (affected_count >= 0),
    processed_at timestamptz not null,
    foreign key (registry_sequence, registry_digest)
        references rec_evidence_recall_registry (sequence, registry_digest)
);
```

Repositories update with `where document_id=? and subject_id=? and revision=?`. Store object references as opaque internal IDs. Keep PostgreSQL statement/bind logging disabled through the foundation configuration; add no personal-record logging override.

- [ ] **Step 4: Re-run and verify GREEN.**

Expected: migrations apply V200–V203 after foundation migrations, the recall receipt/registry/notice tables reject prohibited content columns and malformed/negative digests or counts, transition and optimistic-lock tests pass, and architecture reports no prohibited dependency.

- [ ] **Step 5: Commit.**

```powershell
git add apps/core-api/src/main/resources/db/migration/V20* apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord
git commit -m "feat: add personal record workflow state"
```

### Task 3: Quarantine and neutralize hostile cloud uploads

**Files:**

- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/DocumentIntakeService.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/object/S3DocumentObjectStore.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/worker/DocumentWorkerClient.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/foundation/FoundationDocumentIntakeAdapter.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/in/web/PersonalRecordController.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/DocumentIntakeServiceTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/PersonalRecordControllerBoundaryTest.kt`
- Create: `workers/document-processing/pyproject.toml`
- Create: `workers/document-processing/uv.lock`
- Create: `workers/document-processing/Dockerfile`
- Create: `workers/document-processing/Dockerfile.dockerignore`
- Create: `workers/document-processing/app/contracts.py`
- Create: `workers/document-processing/app/safe_logging.py`
- Create: `workers/document-processing/app/malware.py`
- Create: `workers/document-processing/app/pdf_safety.py`
- Create: `workers/document-processing/app/rasterize.py`
- Create: `workers/document-processing/app/object_store.py`
- Create: `workers/document-processing/app/pipeline.py`
- Create: `workers/document-processing/app/main.py`
- Create: `workers/document-processing/tests/test_malware_gate.py`
- Create: `workers/document-processing/tests/test_pdf_safety.py`
- Create: `workers/document-processing/tests/test_pipeline.py`
- Create: `workers/document-processing/tests/test_phi_safe_logging.py`
- Create: `deploy/local/personal-record.compose.yml`

**Interfaces:**

- Consumes: `BeginUploadCommand`; foundation `PurposeAuthorizer`; quarantine object metadata; task-scoped worker identity; FND's Python 3.12.13 `run_locked_uv.py` interface and digest-pinned Python runtime base.
- Produces: quarantine upload ticket; sanitized raster artifact; metadata-only scan result or fixed rejection code; frozen worker dependency graph and non-root runtime image recipe later released only through Task 10.

- [ ] **Step 1: Write failing consent/intake and hostile-file tests.**

Core tests prove:

- timeline consent requires `BUILD_PERSONAL_LAB_TIMELINE` plus the command’s exact category and `COLLECT`;
- cloud upload separately requires `PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD` plus the same category and `COLLECT`; worker submission rechecks the same grant with `EXTRACT`;
- the resolved grants are `DataSource.USER_UPLOAD`; parameterized tests cover `LAB_REPORT` and `MEDICAL_RECORD` without cross-category reuse;
- retention consent is not requested when choice is delete;
- no request/body/schema field accepts a filename or subject;
- PDF/PNG/JPEG only, 1 byte through 20 MiB, five-minute ticket, and canonical locally computed `declaredSha256`;
- the presigned PUT fixes opaque key, exact method/content range/type/checksum, quarantine bucket, KMS headers, and `If-None-Match:*`; bucket policy requires `s3:if-none-match` and a second/concurrent write fails `412|409` without creating another version;
- upload completion requires the browser-captured nonempty `x-amz-version-id` plus the same checksum and re-HEADs that exact VersionId for size/type/checksum/KMS metadata;
- revoked cloud consent deletes the object and submits no worker job;
- duplicate byte-identical completion submits one stable workflow ID, while missing/null/foreign VersionId, checksum or byte mutation, duplicate checksum, current/unversioned HEAD, and a different completion replay fail.
- `PersonalRecordControllerBoundaryTest` posts a body with no caller to `createDocumentUploadTicket`, injects authenticated principal A, and captures an internal command whose caller is exactly A and whose remaining fields equal the request; adding `caller`, `documentId`, subject, filename, key, or bucket returns the same fixed 400 before service invocation;

Worker tests generate malware and active PDFs in temporary directories and prove scan order, MIME sniffing, rejection of encrypted PDFs, JavaScript/OpenAction/Launch/EmbeddedFile/XFA/RichMedia, over 30 pages, over 150 million raster pixels, and over 20 seconds.

```python
def test_malware_stops_before_pdf_parser(pipeline, malware_bytes, inspector):
    result = pipeline.process_bytes(synthetic_request(), malware_bytes)
    assert result.outcome == "REJECTED_MALWARE"
    assert inspector.calls == 0
```

- [ ] **Step 2: Run and verify RED.**

```powershell
.\gradlew.bat --no-daemon :apps:core-api:test --tests "*DocumentIntakeServiceTest" --tests "*PersonalRecordControllerBoundaryTest"
python scripts/ci/run_locked_uv.py -- sync --project workers/document-processing --frozen --all-groups
python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen pytest workers/document-processing/tests/test_malware_gate.py workers/document-processing/tests/test_pdf_safety.py workers/document-processing/tests/test_pipeline.py -q
```

Expected: missing intake/worker types and the absent public-request-to-authenticated-command controller projection fail compilation/import.

- [ ] **Step 3: Implement the smallest quarantine and raster pipeline.**

```kotlin
fun begin(command: BeginUploadCommand): PersonalRecordUploadTicket {
    purposeAuthorizer.requireAllowed(
        PurposeAccessRequest(
            command.caller,
            command.timelineConsentId,
            ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
            command.dataCategory,
            ConsentOperation.COLLECT,
            clock.instant(),
        ),
    )
    purposeAuthorizer.requireAllowed(
        PurposeAccessRequest(
            command.caller,
            command.cloudProcessingConsentId,
            ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
            command.dataCategory,
            ConsentOperation.COLLECT,
            clock.instant(),
        ),
    )
    if (command.retentionChoice == SourceRetentionChoice.RETAIN_ENCRYPTED_365_DAYS) {
        purposeAuthorizer.requireAllowed(
            PurposeAccessRequest(
                command.caller,
                requireNotNull(command.retentionConsentId),
                ConsentPurpose.RETAIN_VERIFIED_SOURCE,
                command.dataCategory,
                ConsentOperation.RETAIN,
                clock.instant(),
            ),
        )
    } else {
        require(command.retentionConsentId == null)
    }
    val job = jobs.create(command)
    return objects.issueQuarantineUpload(
        job.documentId,
        command.declaredMediaType,
        command.declaredBytes,
        command.declaredSha256,
    )
}
```

After upload completion byte-compares `CompleteDocumentUploadRequest.checksumSha256` with the stored declaration and exact-VersionId HEAD-verifies the browser-returned version, re-authorize immediately before worker submission with the stored cloud consent:

```kotlin
purposeAuthorizer.requireAllowed(
    PurposeAccessRequest(
        command.caller,
        job.cloudProcessingConsentId,
        ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
        job.dataCategory,
        ConsentOperation.EXTRACT,
        clock.instant(),
    ),
)
worker.submit(documentWorkerRequestFor(job))
```

The worker order is `integrity -> ClamAV -> magic-byte MIME -> active-content inspection -> bounded inert PNG rendering`. It runs as non-root with read-only root filesystem, tmpfs work directory, no public port, no general internet route, and no database credential. Events carry workflow/document IDs, opaque artifact refs, template/version, count, and fixed outcome only.

`pyproject.toml` requires exactly Python `==3.12.13`; `uv.lock` locks every direct/transitive production and test dependency with hashes and is generated only by the FND-pinned uv tool. CI and the Docker builder use only `run_locked_uv.py ... --frozen`; raw `pip install`, unconstrained extras, VCS/path dependencies outside this worker, and runtime/model downloads are prohibited. `Dockerfile` uses a digest-pinned Linux/amd64 builder and the same FND Python runtime digest, copies only the frozen virtual environment, worker application, admitted model assets/manifest, and ClamAV runtime/database snapshot, removes SUID/SGID bits, sets `USER 65532:65532`, and fixes the exec-form service entrypoint. Its final stage has no package-manager/network download, shell-form startup, tests, compiler, or credential.

- [ ] **Step 4: Re-run and verify GREEN.**

Expected: core intake and controller-boundary tests pass; caller is derived only from authentication, document ID only from the path, hostile inputs reject before OCR, clean synthetic PDF yields inert PNGs, temporary files disappear, and the PHI sentinel is absent from stdout/stderr/log capture.

- [ ] **Step 5: Commit.**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord workers/document-processing deploy/local
git commit -m "feat: quarantine hostile medical documents"
```

### Task 4: Extract candidates and require complete user review

**Files:**

- Create: `workers/document-processing/app/ocr.py`
- Create: `workers/document-processing/app/extract.py`
- Create: `workers/document-processing/tests/test_ocr_extraction.py`
- Create: `workers/document-processing/tests/fixtures/synthetic-supported-checkup.pdf`
- Create: `workers/document-processing/tests/fixtures/synthetic-supported-checkup-page.png`
- Create: `workers/document-processing/tests/fixtures/unsupported-layout.pdf`
- Create: `workers/document-processing/scripts/record_model_manifest.py`
- Create: `workers/document-processing/scripts/vendor_offline_assets.py`
- Create: `workers/document-processing/scripts/benchmark_supported_templates.py`
- Create: `workers/document-processing/model-manifest.json`
- Create: `workers/document-processing/tests/test_offline_assets.py`
- Modify: `workers/document-processing/Dockerfile`
- Modify: `workers/document-processing/Dockerfile.dockerignore`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/DocumentReviewService.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/in/web/PersonalRecordController.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/WorkerContractTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/DocumentReviewServiceTest.kt`
- Modify: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/PersonalRecordControllerBoundaryTest.kt`
- Modify: `packages/contracts/jsonschema/document-worker-v1.schema.json`
- Modify: `packages/contracts/openapi/personal-record-v1.yaml`

**Interfaces:**

- Consumes: sanitized PNG artifact; exact locked official Paddle model and ClamAV database coordinates; exact template/version; `ConfirmExtractionCommand`.
- Produces: immutable offline asset directory and manifest; an image that starts and processes with network denied; encrypted candidate artifact; `EXTRACTED_REVIEW_REQUIRED`; complete confirmed/rejected decision set.

- [ ] **Step 1: Write failing extraction, contract, and review tests.**

Prove:

- OCR accepts PNG paths only;
- supported synthetic template returns hand-checked label/value/unit/date/range and bounding boxes;
- unsupported layout returns `UNSUPPORTED_TEMPLATE` with zero candidates;
- low confidence remains a review candidate;
- event envelope excludes OCR strings;
- Python output and Kotlin input both reject additional properties;
- review GET is owner/consent scoped;
- every candidate appears exactly once in the submission;
- duplicate/unknown/missing/stale-revision decisions reject the entire command;
- rejected values never reach normalization;
- no user-confirmed string enters logs/errors.
- the controller boundary test posts exact `ConfirmExtractionRequest` to `/v1/documents/{documentId}/confirm-fields`, proves the internal command receives the authenticated principal and validated path UUID, and rejects body-supplied `caller`, `documentId`, a mismatched path alias, or any additional property before `DocumentReviewService`;
- `model-manifest.json` is a strict, canonical, `additionalProperties:false` lock with exactly six entries: `PP-OCRv5_mobile_det_infer.tar`, `korean_PP-OCRv5_mobile_rec_infer.tar`, `PP-LCNet_x1_0_doc_ori_infer.tar`, `main.cvd`, `daily.cvd`, and `bytecode.cvd`. Each entry has exact `name`, official HTTPS `url`, lowercase SHA-256, positive byte `size`, SPDX `license`, upstream version/database timestamp, and immutable destination path; hashes/sizes may not be zero, repeated, wildcarded, `latest`, or placeholders.
- `vendor_offline_assets.py` contains the same closed official host/path allowlist, requires exactly `--manifest` and `--destination` plus the sole optional flag `--verify-only`, refuses redirects/HTTP/proxies/credentials, streams each response under its locked cap, verifies size and SHA-256 before atomic rename, rejects symlinks/path escape/extra files, emits no URL query or bytes, and uses `--verify-only` without network. Tests use a local fixture transport and mutate URL/host/name/hash/size/license/version/redirect/truncation/extra file.
- the Dockerfile is extended, not recreated: the builder `COPY`s only the verified `vendor/models/**`, `vendor/clamav/**`, and canonical manifest; the final image contains those read-only paths, sets Paddle and ClamAV to local-only mode, and has no downloader/package manager or writable database path. With `--network none`, startup verifies all six files and their manifest, `clamscan --database=/opt/gc/clamav` succeeds on the synthetic clean/malware fixtures, OCR loads all three model paths, and packet capture remains empty.

```kotlin
@Test
fun `review rejects an incomplete decision set`() {
    val artifact = syntheticArtifact(candidateCount = 2)
    val command = syntheticConfirmCommand(decisions = listOf(confirm(artifact.candidates.first())))

    assertThatThrownBy { service.confirm(command) }
        .isInstanceOf(ReviewSetMismatch::class.java)
}
```

- [ ] **Step 2: Run and verify RED.**

```powershell
workers/document-processing/.venv/Scripts/python.exe -m pytest workers/document-processing/tests/test_ocr_extraction.py -q
workers/document-processing/.venv/Scripts/python.exe -m pytest workers/document-processing/tests/test_offline_assets.py -q
.\gradlew.bat --no-daemon :apps:core-api:test --tests "*WorkerContractTest" --tests "*DocumentReviewServiceTest" --tests "*PersonalRecordControllerBoundaryTest"
```

Expected: missing OCR/extractor/review types, the absent confirm-request controller projection, and the absent six-asset lock/vendor/Docker offline contract fail.

- [ ] **Step 3: Implement review-only extraction.**

```kotlin
private fun requireCompleteReview(
    candidates: List<OcrCandidate>,
    decisions: List<FieldDecision>,
) {
    val expected = candidates.map { it.candidateId }.toSet()
    val actual = decisions.map { it.candidateId }
    if (actual.size != actual.toSet().size || actual.toSet() != expected) throw ReviewSetMismatch()
}
```

`record_model_manifest.py` is not a free-form recorder: it canonicalizes only the six constants in `vendor_offline_assets.py`, requires their concrete non-placeholder hashes/sizes/licenses/versions, and refuses an already-existing different lock. Run `python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen python workers/document-processing/scripts/vendor_offline_assets.py --manifest workers/document-processing/model-manifest.json --destination workers/document-processing/vendor`, then immediately repeat with `--verify-only`; CI/release uses the same command before any Docker build and never resolves a model/database coordinate from PaddleOCR or ClamAV at runtime. PaddleOCR runs from the resulting read-only local paths. Startup fails on a missing/mismatched/extra asset and never downloads. Enable a template only when its release set has 100% numeric/date/unit exact match, every unsupported layout abstains, ClamAV loads the locked three-database snapshot, and network capture is zero. A failed gate disables that template.

Extend `PersonalRecordController` only with the `ConfirmExtractionRequest` boundary frozen above: authenticated principal and path UUID are server-owned inputs, the request contributes only timeline consent, expected revision, and decisions, and the controller copies those five sources into `ConfirmExtractionCommand` before invoking `DocumentReviewService`.

- [ ] **Step 4: Re-run and verify GREEN.**

Expected: asset-lock/vendor/Docker offline tests pass; all six concrete assets verify before build; the image starts with `--network none`; OCR golden test and benchmark pass; unsupported layout abstains; the confirm controller derives caller/path identity only from trusted server inputs; core requires a complete one-decision-per-candidate set; no candidate is represented as verified before confirmation.

- [ ] **Step 5: Commit.**

```powershell
git add workers/document-processing packages/contracts apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord
git commit -m "feat: add user-reviewed OCR extraction"
```

### Task 5: Validate FHIR R4/KR Core and commit through HAPI JPA

**Files:**

- Create: `apps/core-api/src/main/resources/fhir/hl7.fhir.kr.core-2.0.0.tgz`
- Create: `apps/core-api/src/main/resources/fhir/SHA256SUMS`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/fhir/KrCoreProfiles.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/fhir/KrCoreValidationSupport.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/fhir/KrCoreLabMapper.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/fhir/HapiCanonicalRecordStore.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/foundation/FoundationHealthRecordQueryAdapter.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/KrCoreValidationTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/HapiCanonicalRecordStoreTest.kt`
- Create: `tools/fhir-validator/fetch-validator.ps1`
- Create: `tools/fhir-validator/validate-krcore.ps1`
- Create: `deploy/local/hapi-test.properties`

**Interfaces:**

- Consumes: complete confirmed decision set, HAPI `FhirContext`, `DaoRegistry`, R4 `IFhirSystemDao<Bundle, Meta>`, vendored KR Core package.
- Produces: validated `DocumentReference`, `DiagnosticReport`, `Observation`, `Provenance` transaction and exact subject-resource index.

- [ ] **Step 1: Write failing validator, mapping, transaction, and idempotency tests.**

Use the real KR package and HAPI JPA with PostgreSQL Testcontainers. Test:

- package digest;
- valid synthetic lab Observation has zero error/fatal issues;
- missing laboratory category fails at `Observation.category`;
- invalid resource is never written;
- confirmed source label/value/unit/range/date are preserved;
- unknown unit remains display-only with no guessed UCUM system/code;
- unknown clinical code remains `code.text`;
- only source-reported interpretation is retained;
- no `Condition` class is emitted;
- transaction replay with the same document/review revision leaves one logical version;
- mapping/commit rechecks the stored `PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD` grant with `NORMALIZE`; a late revocation rejects and purges without a HAPI write;
- consumer application exposes no `/fhir` route.

```kotlin
@Test
fun `unknown source unit is preserved without a guessed code`() {
    val observation = mapper.observation(syntheticConfirmedField(unit = "원문단위"))
    assertThat(observation.valueQuantity.unit).isEqualTo("원문단위")
    assertThat(observation.valueQuantity.system).isNull()
    assertThat(observation.valueQuantity.code).isNull()
}
```

- [ ] **Step 2: Run and verify RED.**

```powershell
.\gradlew.bat --no-daemon :apps:core-api:test --tests "*KrCoreValidationTest" --tests "*HapiCanonicalRecordStoreTest"
```

Expected: missing validator/mapper/store types fail.

- [ ] **Step 3: Implement package validation and internal HAPI transaction.**

Before mapping any confirmed value, re-authorize the cloud normalization operation using the document job’s stored category and consent ID:

```kotlin
purposeAuthorizer.requireAllowed(
    PurposeAccessRequest(
        confirmedReview.caller,
        confirmedReview.cloudProcessingConsentId,
        ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
        confirmedReview.dataCategory,
        ConsentOperation.NORMALIZE,
        clock.instant(),
    ),
)
```

```kotlin
val npm = NpmPackageValidationSupport(fhirContext).apply {
    loadPackageFromClasspath("classpath:fhir/hl7.fhir.kr.core-2.0.0.tgz")
}
val support = ValidationSupportChain(
    npm,
    DefaultProfileValidationSupport(fhirContext),
    CommonCodeSystemsTerminologyService(fhirContext),
    InMemoryTerminologyServerValidationSupport(fhirContext),
)
val validator = fhirContext.newValidator().apply {
    registerValidatorModule(FhirInstanceValidator(support))
}
```

Map stable UUID logical IDs from document/candidate IDs. The `DocumentReference` stores digest and deletion/retention state but never Binary/data. `Provenance` targets every resource and records parser/template/mapping versions plus user verification. Validate each declared profile, then call:

```kotlin
val stored = systemDao.transaction(SystemRequestDetails(), transactionBundle)
```

Record every returned type/id/version in `rec_subject_resource_index`. HAPI JPA is an internal DAO configuration; no `RestfulServer` servlet is registered.

The independent script runs validator CLI 6.10.1 with `-version 4.0.1`, the vendored package, the KR lab profile, and `-tx n/a`; it requires zero errors for valid and a category error for invalid.

- [ ] **Step 4: Re-run and verify GREEN.**

Expected: both HAPI and independent validator agree; one idempotent transaction is stored; only confirmed fields appear; `/fhir` remains unmapped.

- [ ] **Step 5: Commit.**

```powershell
git add apps/core-api/src/main/resources/fhir apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord tools/fhir-validator deploy/local/hapi-test.properties
git commit -m "feat: store validated KR Core records"
```

### Task 6: Enforce immediate deletion or explicit encrypted retention

**Files:**

- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/SourceDispositionService.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/object/S3DocumentObjectStore.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/SourceDispositionServiceTest.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/DocumentReviewService.kt`
- Modify: `packages/contracts/openapi/personal-record-v1.yaml`

**Interfaces:**

- Consumes: committed FHIR transaction, retention choice, optional retention consent ID, current `PurposeAuthorizer`, quarantine/temp refs.
- Produces: verified deleted/retained receipt and only then `TIMELINE_READY`.

- [ ] **Step 1: Write failing source-lifecycle tests.**

Prove:

- default confirmation immediately deletes quarantine, sanitized pages, and candidate artifact;
- every deletion is followed by absence verification;
- deletion failure leaves `VERIFIED_SOURCE_DISPOSITION_PENDING`;
- retry treats already-absent objects as success;
- retention fails without separate `RETAIN_VERIFIED_SOURCE/LAB_REPORT/RETAIN` authorization;
- encrypted copy has the same digest, dedicated KMS key, a 365-day expiry, and no Object Lock before quarantine is deleted;
- failed copy/encryption verification never deletes the only source copy;
- retention revocation deletes only the retained source through foundation scoped deletion;
- the receipt contains no filename, OCR string, value, unit, subject ID, bucket, or key.

```kotlin
@Test
fun `timeline is unavailable until every default source copy is absent`() {
    objects.failNextAbsenceCheck()
    assertThatThrownBy { service.dispose(syntheticVerifiedDocument()) }
    assertThat(jobs.get(documentId).state)
        .isEqualTo(DocumentState.VERIFIED_SOURCE_DISPOSITION_PENDING)
}
```

- [ ] **Step 2: Run and verify RED.**

```powershell
.\gradlew.bat --no-daemon :apps:core-api:test --tests "*SourceDispositionServiceTest"
```

Expected: the new source-disposition service and the existing Task 3 `S3DocumentObjectStore` retention/delete/absence extensions are missing, so the named behavior fails.

- [ ] **Step 3: Implement ordered disposition.**

```kotlin
fun dispose(document: VerifiedDocument): SourceDispositionReceipt =
    when (document.retentionChoice) {
        SourceRetentionChoice.DELETE_AFTER_VERIFICATION ->
            deleteAllAndVerify(document)
        SourceRetentionChoice.RETAIN_ENCRYPTED_365_DAYS -> {
            purposeAuthorizer.requireAllowed(
                PurposeAccessRequest(
                    document.caller,
                    requireNotNull(document.retentionConsentId),
                    ConsentPurpose.RETAIN_VERIFIED_SOURCE,
                    document.dataCategory,
                    ConsentOperation.RETAIN,
                    clock.instant(),
                ),
            )
            retainThenDeleteTemporaryCopies(
                document,
                clock.instant().plus(365, java.time.temporal.ChronoUnit.DAYS),
            )
        }
    }.also { receipt ->
        dispositions.save(receipt)
        jobs.markTimelineReady(document.documentId, receipt.completedAt)
    }
```

S3 retention uses SSE-KMS with the dedicated retention key, checksum metadata, opaque key, and lifecycle expiry. HEAD must confirm encryption/key/digest and Object Lock absence. Default mode has no grace queue. Remove `DocumentReference.content.attachment.url` after deletion; retain digest/provenance and a source-unavailable state.

- [ ] **Step 4: Re-run and verify GREEN.**

Expected: default mode leaves zero objects before ready; opt-in leaves exactly one verified encrypted object; revocation deletes only that retained source; failures never expose timeline.

- [ ] **Step 5: Commit.**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord packages/contracts/openapi/personal-record-v1.yaml
git commit -m "feat: enforce medical source disposition"
```

### Task 7: Build the health timeline and exact verified-fact packet

**Files:**

- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/TimelineService.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/VerifiedFactPacketProjector.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/RecordExplanationService.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/worker/ExplanationWorkerClient.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/worker/ExplanationRecallHandler.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/EvidenceRecallRegistryInstaller.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/EvidenceRecallDeliveryService.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/in/web/EvidenceRecallInternalController.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/in/web/EvidenceRecallClientCertificateAuthorizer.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/config/EvidenceRecallTrustMaterialConfiguration.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/TimelineServiceTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/VerifiedFactPacketProjectorTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/RecordExplanationControllerTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/ExplanationWorkerClientTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/ExplanationRecallTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/EvidenceRecallContractTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/EvidenceRecallInternalControllerTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/EvidenceRecallClientCertificateAuthorizerTest.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/in/web/PersonalRecordController.kt`
- Modify: `packages/contracts/openapi/personal-record-v1.yaml`
- Create: `packages/contracts/openapi/evidence-recall-internal-v1.yaml`

**Interfaces:**

- Consumes: ready HAPI Observations and provenance/disposition metadata; foundation `ConsentService`, `PurposeAuthorizer`, `OpaqueSubjectRefFactory`, `ConsentBoundPurposeTokenAdapter`, `ExplanationPurposeTokenRequest`, and `WorkloadTokenIssuer`; FND's exact `private_service_trust_bundle_secret_arn`, `private_service_trust_bundle_secret_version_id`, `private_service_trust_bundle_sha256`, `recall_client_crl_bucket_name`, `recall_client_crl_key`, `recall_client_crl_version_id`, and `recall_client_crl_sha256` outputs, dedicated REC listener, ALB-produced URL-encoded leaf-certificate header, and exact client URI SAN; AI-owned `explanation-request.schema.json`, `explanation-response.schema.json`, `signed-evidence-recall-notice.schema.json`, `signed-evidence-recall-key-registry.schema.json`, `evidence-recall-registry-installation.schema.json`, `evidence-recall-ack.schema.json`, and golden `packages/contracts/fixtures/evidence-recall-shared.valid.json`.
- Produces: exact `GET /v1/records/timeline -> VerifiedTimeline`; exact `POST /v1/records/explanations` body `CreateRecordExplanationRequest` and shared response `ExplanationResponse`; exact `GET /v1/records/explanations/{responseId}/status -> RecordExplanationRecallStatusResponse`; schema-valid selected-fact packet; private worker request with bound service/purpose tokens; minimal recall index; and three mTLS-only internal operations: `PUT /internal/v1/evidence-recall/registry` (`installEvidenceRecallKeyRegistry`), `PUT /internal/v1/evidence-recall/notices/{noticeId}` (`applyEvidenceRecallNotice`), and `GET /internal/v1/evidence-recall/notices/{noticeId}/ack` (`getEvidenceRecallAck`).

`VerifiedRecord.value` and `VerifiedRecord.confidence` are canonical decimal **strings** on every UI/export wire to preserve `BigDecimal` exactly across JavaScript and Dart. OpenAPI fixes `value` to pattern `^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$`, length 1..96, and rejects negative zero; `confidence` uses `^(?:0(?:\.[0-9]+)?|1(?:\.0+)?)$`, length 1..32. The projector calls `toPlainString()` only after normalizing scale without rounding. The internal AI `FactPacket.facts[].value` remains a JSON number: `VerifiedFactPacketProjector` reparses the already validated string with `CanonicalMedicalDecimal.parseForCalculation` and Jackson writes a plain finite number with `WRITE_BIGDECIMAL_AS_PLAIN`. Contract tests prove exact round trips for large magnitude, 30 fractional digits, `0`, `0.0`, and negative fractions through Kotlin → OpenAPI client → generated Dart without IEEE-754 conversion.

The UX-facing names are normative:

```text
CreateRecordExplanationRequest {
  timelineConsentId: UUID
  factIds: UUID[1..20], unique
  userQuestion: string[1..500]
}

ExplanationResponse {                         # AI-owned shared schema; do not duplicate
  requestId: UUID
  disposition: released|abstained|emergency_route|blocked
  claims: ExplanationClaim[]
  versions: VersionSet {
    generator: string
    policy: string
    evidencePackId: string
    evidencePackVersion: string
  }
  routeMessage: string|null
}

RecordExplanationRecallStatusResponse {
  state: active|banner|regenerate|suppress
}
```

`personal-record-v1.yaml` references the shared `ExplanationResponse` schema. It rejects additional request properties and has no `subjectId`, raw source, locale, prompt, model, URL, tool, or genomic field.

- [ ] **Step 1: Write failing timeline, projection, controller, and private-client tests.**

Timeline tests prove chronological source effective time, stable tie ordering, source availability, no inferred high/low, and discontinuities for unit/method/range changes. A label alone never joins trends; only an exact reviewed mapping ID can.

Fact-packet tests assert exact camelCase names/types and literals:

```kotlin
assertThat(packet.at("/packetId").isTextual).isTrue()
assertThat(packet.at("/subjectRef").asText()).matches("^sub_[A-Za-z0-9_-]{22,64}$")
assertThat(packet.at("/purpose").asText()).isEqualTo("explain_verified_record")
assertThat(packet.at("/facts/0/value").isNumber).isTrue()
assertThat(packet.at("/facts/0/verificationStatus").asText()).isEqualTo("user_verified")
schema.validate(packet)
```

Also prove:

- only `TIMELINE_READY`, user-confirmed, numeric, exact-code-mapped facts with a non-guessed unit are eligible;
- `factId` and `sourceRef` are opaque, not a FHIR URL or document key;
- `displayKo` is the confirmed Korean display;
- `confidence` is mapping confidence for a reviewed deterministic mapping, never OCR confidence;
- unsupported facts are omitted with a safe count-only result;
- an active `BUILD_PERSONAL_LAB_TIMELINE` authorization for the request’s exact category and `EXPLAIN` operation is required, with tests for both foundation categories;
- no raw document, OCR text, narrative, name, account ID, or consent receipt appears.

Controller/client tests prove:

- the authenticated `CallerPrincipal` is the only source of subject identity;
- the service authorizes the caller-owned consent’s granted categories for `EXPLAIN` before any fact selection query;
- request validation rejects zero or 21 fact IDs, duplicates, blank/501-character questions, and additional fields;
- IDs owned by another subject and owned-but-unverified IDs receive the same fixed `facts_not_available` response and never call the worker;
- the packet contains exactly the requested, owned, `user_verified` facts in request order and no raw source;
- `packetId` is server-created; `OpaqueSubjectRefFactory` receives only `caller.subjectId`;
- `ConsentBoundPurposeTokenAdapter` receives the same `packetId` as `jti`, caller, timeline consent, and selected fact category;
- `WorkloadTokenIssuer.issueServiceToken()` is called once; the private request uses `Authorization: Bearer ${serviceToken.compact}` and `X-Purpose-Token: ${purposeToken.compact}`, never a consumer token;
- worker `ExplanationRequest.requestId` is server-created, `locale="ko-KR"`, `consentPurpose="personal_record_explanation"`, and `packet.packetId` matches the token `jti`;
- connect timeout is two seconds, response timeout is ten seconds, there is no automatic retry, and timeout/non-2xx/invalid response maps to fixed `explanation_unavailable` with no partial body;
- captured logs, traces, metrics, exceptions, URLs, and audit metadata contain none of the question, values, fact IDs, subject ref, packet, token, or response.
- a valid worker response persists exactly `responseId=response.requestId`, opaque subject ref, `evidencePackId`, `evidencePackVersion`, disposition, and created time before release; an index-write failure releases no response;
- the receipt row persists no question, value, fact ID, claim text, citation, raw fact, packet, or full response;
- `SignedEvidenceRecallNotice` verifies Ed25519 over RFC 8785 canonical notice bytes with the active anchored `purpose=notice` registry key; the separate `purpose=release` key never verifies a notice, and a bad key/signature/schema changes no row;
- the shared root-pinned registry verifies Ed25519 over `GC-EVIDENCE-RECALL-KEY-REGISTRY-V1\0 || RFC8785(registry)`; a lower sequence, same-sequence/different-digest, duplicate/reused/wrong-purpose key, unknown root, malformed lifecycle, or first-seen material under a retired/revoked key fails closed;
- registry and notice full-envelope digests match the exact shared RFC 8785 domains; first observation under a retired/revoked/out-of-window notice key fails, while an exact notice digest durably anchored while its key was active remains effective history and may be carried byte-identically after retirement or revocation; mutation never inherits that exception;
- a verified notice selects only the exact evidence-pack ID/version, persists once in the append-only notice table, counts matching receipts transactionally, and is idempotent by `noticeId`; it never overwrites a receipt or another notice;
- registry install, notice application, affected-count persistence, receipt updates, and acknowledgement recovery survive retries/restarts; an ambiguous lost PUT response is recovered only by the exact GET ack and never by applying changed bytes;
- the private controller rejects a missing/duplicate/oversized/malformed ALB leaf header, spoofed client header, wrong chain/SAN/EKU/serial/validity/revocation, body over 64 KiB registry or 16 KiB notice, GET body, path/body UUID mismatch, and every non-allowlisted method/path before domain work;
- the status route derives the opaque ref from the authenticated subject, returns no cross-subject existence oracle, and returns only `{state}`;

```kotlin
mockMvc.post("/v1/records/explanations") {
    principal(syntheticCallerJwt(subject = "subject-a"))
    contentType = MediaType.APPLICATION_JSON
    content = requestSelecting(factOwnedBy("subject-b"))
}.andExpect {
    status { isNotFound() }
    jsonPath("$.code") { value("facts_not_available") }
}
verifyNoInteractions(explanationWorkerClient)
```

- [ ] **Step 2: Run and verify RED.**

```powershell
    .\gradlew.bat --no-daemon :apps:core-api:test --tests "*TimelineServiceTest" --tests "*VerifiedFactPacketProjectorTest" --tests "*RecordExplanationControllerTest" --tests "*ExplanationWorkerClientTest" --tests "*ExplanationRecallTest" --tests "*EvidenceRecallContractTest" --tests "*EvidenceRecallInternalControllerTest" --tests "*EvidenceRecallClientCertificateAuthorizerTest"
```

Expected: missing timeline/projector/service/client types and route fail compilation or mapping assertions.

- [ ] **Step 3: Implement deterministic timeline, selected-fact projection, and the bounded private call.**

```kotlin
override fun produce(request: VerifiedFactPacketRequest): JsonNode {
    purposeAuthorizer.requireAllowed(
        PurposeAccessRequest(
            request.caller,
            request.timelineConsentId,
            ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
            request.dataCategory,
            ConsentOperation.EXPLAIN,
            clock.instant(),
        ),
    )
    val eligibleById = canonicalStore.observations(request.caller.subjectId)
        .filter(eligibility::isVerifiedNumericMappedFact)
        .map(wireMapper::toSchemaFact)
        .associateBy { UUID.fromString(it.get("factId").asText()) }
    val facts = request.selectedFactIds.map { factId ->
        eligibleById[factId] ?: throw FactsNotAvailable()
    }
    val packetId = request.packetId
    val payload = wireMapper.packet(packetId, request.opaqueSubjectRef, request.requestedAt, facts)
    schemaValidator.requireValid(payload)
    return payload
}
```

The route service obtains subject/category metadata from a subject-scoped selection query before token issuance. Mixed-category selections fail with `facts_not_available`; this keeps the foundation’s single-category `ExplanationPurposeTokenRequest` exact.

```kotlin
fun explain(
    caller: CallerPrincipal,
    body: CreateRecordExplanationRequest,
): ExplanationResponse {
    val grantedCategories = consentService.list(caller)
        .singleOrNull {
            it.consentId == body.timelineConsentId &&
                it.purpose == ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE
        }
        ?.dataCategories
        ?: throw ExplanationConsentDenied()
    grantedCategories.forEach { category ->
        purposeAuthorizer.requireAllowed(
            PurposeAccessRequest(
                caller,
                body.timelineConsentId,
                ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
                category,
                ConsentOperation.EXPLAIN,
                clock.instant(),
            ),
        )
    }
    val selection = selections.requireOwnedVerifiedSingleCategory(caller.subjectId, body.factIds)
    if (selection.dataCategory !in grantedCategories) throw ExplanationConsentDenied()
    val packetId = uuidGenerator.next()
    val subjectRef = opaqueSubjectRefs.fromSubjectId(caller.subjectId)
    val purposeToken = consentBoundPurposeTokens.issue(
        ExplanationPurposeTokenRequest(
            caller = caller,
            consentId = body.timelineConsentId,
            dataCategory = selection.dataCategory,
            jti = packetId,
        ),
    )
    val packet = factPackets.produce(
        VerifiedFactPacketRequest(
            caller = caller,
            timelineConsentId = body.timelineConsentId,
            dataCategory = selection.dataCategory,
            packetId = packetId,
            opaqueSubjectRef = subjectRef,
            requestedAt = clock.instant(),
            selectedFactIds = body.factIds,
        ),
    )
    val workerRequest = explanationWire.request(
        requestId = uuidGenerator.next(),
        packet = packet,
        locale = "ko-KR",
        userQuestion = body.userQuestion,
        consentPurpose = "personal_record_explanation",
    )
    explanationRequestSchema.requireValid(workerRequest)
    val response = explanationWorker.explain(
        request = workerRequest,
        serviceToken = workloadTokenIssuer.issueServiceToken(),
        purposeToken = purposeToken,
    )
    explanationReceipts.insertMinimal(
        responseId = response.requestId,
        subjectRef = subjectRef,
        evidencePackId = response.versions.evidencePackId,
        evidencePackVersion = response.versions.evidencePackVersion,
        disposition = response.disposition,
        createdAt = clock.instant(),
    )
    return response
}
```

`ExplanationWorkerClient` calls only the private allowlisted `/v1/explanations` service URL, validates a 200 body against `explanation-response.schema.json`, and returns the shared generated `ExplanationResponse`. It never logs request/response bodies or headers. It fails closed on timeout, schema failure, redirect, or any non-200 status. `RecordExplanationService` receives the deployment-pinned active evidence-pack ID/version, checks the durable recall index before worker I/O, and checks the returned pack ID/version again inside the receipt transaction; an effective matching notice blocks release even if the recall arrives during the call.

`evidence-recall-internal-v1.yaml` is separate from the consumer `personal-record-v1.yaml`, references the AI-owned shared JSON Schemas without copying them, and freezes exactly:

```text
PUT /internal/v1/evidence-recall/registry
  operationId: installEvidenceRecallKeyRegistry
  request: SignedEvidenceRecallKeyRegistry
  200: EvidenceRecallRegistryInstallation { sequence, registryDigest, state:"ready" }

PUT /internal/v1/evidence-recall/notices/{noticeId}
  operationId: applyEvidenceRecallNotice
  request: SignedEvidenceRecallNotice
  200: EvidenceRecallAck

GET /internal/v1/evidence-recall/notices/{noticeId}/ack
  operationId: getEvidenceRecallAck
  200: EvidenceRecallAck
```

Every request body is required `application/json`; the path value is UUIDv4 and must equal the signed body notice ID; 400/403/404/409/503 responses use fixed no-detail bodies. `EvidenceRecallRegistryInstallation` is exactly `{sequence,registryDigest,state:"ready"}`. `EvidenceRecallAck` is exactly `{noticeId,registrySequence,registryDigest,noticeSha256,action,effectiveAt,affectedCount,processedAt}`. `registryDigest` is lowercase `sha256:` of RFC 8785 canonical UTF-8 bytes of the complete `{registry,signatureBase64Url}` envelope. `noticeSha256` uses the same domain over the complete `{notice,signatureBase64Url}` envelope.

`EvidenceRecallTrustMaterialConfiguration` has seven mandatory production properties mapped byte-for-byte from fixed task environment variables: `REC_RECALL_TRUST_BUNDLE_SECRET_ARN`, `REC_RECALL_TRUST_BUNDLE_VERSION_ID`, `REC_RECALL_TRUST_BUNDLE_SHA256`, `REC_RECALL_CRL_BUCKET_NAME`, `REC_RECALL_CRL_KEY`, `REC_RECALL_CRL_VERSION_ID`, and `REC_RECALL_CRL_SHA256`. ARN/bucket/key cannot be a URI assembled by the application; VersionIds are 32..1024 visible ASCII without `/`, CR/LF, or whitespace; both digests match lowercase `sha256:[0-9a-f]{64}`. Startup calls `SecretsManager:GetSecretValue` with the exact ARN **and VersionId**, requires the service-bounded secret value to be at most 65,536 UTF-8 bytes before PEM decoding/copy, and calls `S3:GetObject` with the exact bucket/key/versionId, caps the DER CRL at 256 KiB through a counted stream, and compares both SHA-256 values before parse. It rejects `AWSCURRENT`, omitted/substituted VersionId, redirect, bucket listing, another key/region, malformed/duplicate PEM objects, an unpinned root, indirect/unknown critical extension, CRL issuer/AKI/signature mismatch, stale/future `thisUpdate`, absent/past `nextUpdate`, or `nextUpdate` more than 24 hours away. The immutable verified pair is published only after both objects pass together; readiness turns false at `nextUpdate` and there is no last-known-good fallback or background mutable lookup. FND rotation deploys a new task definition with a new complete seven-value tuple before retiring the prior CRL.

Required cross-owner FND amendment (REC must not implement it): preserve the existing `private_service_trust_bundle_secret_arn`, `private_service_trust_bundle_secret_version_id`, and `private_service_trust_bundle_sha256` outputs; add exact outputs `recall_client_crl_bucket_name`, `recall_client_crl_key`, and `recall_client_crl_version_id` alongside the existing `recall_client_crl_sha256`; project those seven values into the personal core task under the fixed `REC_RECALL_*` names above; and grant its task role only `secretsmanager:GetSecretValue` on that one secret, `s3:GetObjectVersion` on that one key with the exact VersionId condition, and context-bound KMS decrypt for those two objects. FND rendered-task/IAM tests must reject `AWSCURRENT`, unversioned `s3:GetObject`, `s3:ListBucket`, wildcard resource/version, another region/object/secret, any write, or caller/environment override of the snapshot values.

`EvidenceRecallClientCertificateAuthorizer` accepts the certificate identity only on the dedicated internal listener. It requires one ALB-produced URL-encoded `X-Amzn-Mtls-Clientcert-Leaf` value no larger than 8 KiB, rejects duplicate/comma-folded/control/noncanonical encoding, parses exactly one X.509v3 leaf, rebuilds its chain against only the verified exact-VersionId FND trust bundle, checks only the paired exact-VersionId current CRL, P-256 signature, `digitalSignature`, `clientAuth`, validity, and the sole URI SAN `spiffe://genome-companion.kr/kr-prod/ai-recall-ack-probe`, and rejects any DNS/email/IP/extra URI SAN. It compares ALB serial/validity summaries to the parsed leaf but never authorizes from those strings. The internal ALB SG/listener is the only network source; a direct core call, public API route, forwarded consumer JWT, or caller-supplied mTLS header cannot reach or satisfy the controller.

`EvidenceRecallClientCertificateAuthorizerTest` uses local synthetic P-256 roots/leaves/CRLs and fake exact-version clients. It proves the exact seven-value tuple and successful chain, then mutates ARN, each VersionId, both digests, bucket/key/region, size 64 KiB + 1 and 256 KiB + 1, `AWSCURRENT`, PEM/DER structure, issuer/AKI/signature, revoked serial, CRL times, leaf signature/key usage/EKU/SAN/time, folded header, and ALB summaries. It asserts no authorization and no domain call for every mutation, no fallback after readiness expiry, and no PHI/PEM/object coordinate in logs or errors. IAM/rendered-task tests require `secretsmanager:GetSecretValue` only on the exact trust ARN, `s3:GetObjectVersion` only on the exact CRL object plus VersionId condition, necessary context-bound KMS decrypt only, and deny `ListBucket`, unversioned `GetObject`, another secret/object, and any write.

`EvidenceRecallRegistryInstaller` strict-loads at most 64 KiB, schema-validates before key use, pins the deployment root ID/PEM digest, and verifies the root signature over `GC-EVIDENCE-RECALL-KEY-REGISTRY-V1\0 || RFC8785(registry)`. It validates exact key fields, canonical base64url, unique IDs/material, purpose prefixes, times, and lifecycle transitions. A lower sequence returns fixed 409. Same sequence/same full-envelope digest returns the original ready receipt; same sequence/different digest returns fixed 409. A higher valid registry, its exact signed envelope/key rows, and singleton `(sequence,digest)` anchor commit atomically in the shared REC PostgreSQL control schema. `state="ready"` means that serializable commit is durable and is therefore cluster-authoritative; it does **not** claim one load-balanced response polled every task. Every notice install, explanation pre/post check, and status read obtains the authoritative registry tuple/key row from that shared database inside its transaction. No task-local registry cache, startup preload, timer, or per-node acknowledgement may authorize key use, so task scaling/replacement cannot create a mixed trust epoch. Retirement or revocation blocks every first-seen notice digest under that key but never removes or weakens an exact notice digest anchored while the key was active. Restart, scale-up, task-replacement, and higher-release tests prove every node observes the committed tuple on its first affected transaction, the anchored warning/suppression remains effective, a byte-identical historic notice remains verifiable, and the exactly one new notice plus new release signature use active purpose-specific keys. Mutation under the retired/revoked key fails, so rollback cannot silently reactivate content.

`EvidenceRecallDeliveryService` strict-loads at most 16 KiB, requires the path/body UUID match, computes the canonical full-envelope digest, selects only a `purpose=notice` key from the anchored registry, verifies Ed25519 over RFC 8785 canonical `notice`, and applies first-observation lifecycle rules. In one serializable transaction it uses `noticeId` plus full-envelope digest for idempotency, inserts one append-only PHI-free notice row, counts exact pack ID/version receipts without updating them, and returns the durable ack. Same ID/same digest returns the byte-identical ack; same ID/different digest is 409. The receipt's pack ID/version plus **all** matching notice rows are authoritative: at every explanation pre/post check and status read, filter `effective_at <= injectedClock.instant()`, then choose `suppress > regenerate > banner`, with lexicographic notice UUID as the stable tie-break within one action. If no notice is effective, state is `active`. A future notice is durably scheduled but cannot overwrite or hide a currently effective banner/regenerate/suppress state; an already-effective notice blocks before its ack is returned. No `reasonCode`, subject ref, response ID, question, value, claim, citation, or envelope is persisted or emitted. GET reconstructs only the stored ack and returns fixed 404 when absent. Registry-only partial success is safe/retryable; notice success with a lost response is recovered by GET; an AI activation failure leaves REC's effective block or future schedule intact. Correction uses a new signed notice ID included in exactly one higher-sequence AI recall release; a higher key-registry sequence is required only when key lifecycle changes. No delete or state rollback is allowed. Tests cover current-banner plus future-suppress before/at/after the instant, reverse delivery order, equal-time precedence/tie-break, restart, and concurrent status reads.

The mandatory promotion order is: publish the signed higher registry immutably; atomically install it in REC's shared control database and require the exact cluster-authoritative sequence/digest ready receipt; require every AI worker ready on the same registry; deliver the exact signed notice to REC; verify PUT and GET acknowledgements are byte-identical; only then allow the AI two-phase publisher to activate that exact recall release; drain the maximum cache/notice window before retiring a predecessor. The golden shared fixture runs through both Python and Kotlin verifiers. Tests interrupt after each step and prove retry convergence, no double count, no mixed REC trust epoch after scale/restart, no weakened action, no subject leakage, and no AI activation before the durable REC ack.

`GET /v1/records/explanations/{responseId}/status` derives the caller’s opaque ref, reads the matching receipt, and returns only `RecordExplanationRecallStatusResponse.state`; absent and cross-subject UUIDs produce the same 404.

Do not introduce a second `FactPacket` class. The shared JSON Schema is the wire authority for REC and AI.

- [ ] **Step 4: Re-run and verify GREEN.**

Expected: exact timeline/explanation/status routes pass; valid packet matches the shared fixture/schema; cross-subject and unverified selections fail identically; the service token identifies core API and the purpose token binds the opaque subject plus packet UUID; timeout/index failure fails closed; both Kotlin and Python accept the same golden registry/notice/ack and reject every mutation; the three mTLS-only operations implement monotonic install, idempotent application, durable ack recovery, and REC-before-AI activation; signed recall state surfaces without stored content; no raw source or sensitive capture reaches the worker or telemetry.

- [ ] **Step 5: Commit.**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord packages/contracts
git commit -m "feat: expose bounded verified-record explanations"
```

### Task 8: Export a deterministic user-controlled archive

**Files:**

- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/PersonalRecordExportService.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/application/RecordExportAttestationSigner.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/kms/KmsRecordExportAttestationSigner.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/PersonalRecordExportServiceTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/RecordExportAttestationSignerTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/PersonalRecordSensitiveActionControllerTest.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/in/web/PersonalRecordController.kt`
- Modify: `packages/contracts/openapi/personal-record-v1.yaml`
- Create: `packages/contracts/jsonschema/record-export-attestation.schema.json`
- Create: `packages/contracts/jsonschema/record-export-key-registry.schema.json`
- Create: `governance/cryptographic/record-export-attestation-keys.json`
- Create: `scripts/release/build_record_export_key_registry.py`
- Create: `scripts/release/verify_record_export_key_registry.py`

**Interfaces:**

- Consumes: validated Spring `Authentication`; foundation `SensitiveActionAuthorizer` with `SensitiveAction.EXPORT_RECORDS` (exact qualified scope mapped by FND, `auth_time` age at most five minutes, and the release-attested MFA-required local Cognito pool rather than a fabricated `amr`); `CreatePersonalRecordExportRequest`; current FHIR Bundle, timeline, consent receipts, source-disposition receipts, optional retained source with active retention authorization; FND `record-export-attestation` KMS P-256 key and its release-pinned public JWK registry.
- Produces: `CreatePersonalRecordExportResponse`; exact `RecordExportStatusResponse`; KMS-encrypted deterministic six-or-seven-file ZIP; detached provenance through `manifest-attestation.jws`; manifest/archive digests; single-use 15-minute download ticket through `downloadRecordExport`; required `X-GC-Archive-SHA256` response metadata; expiry deletion evidence; fixed per-entry and 48 MiB archive limits.

- [ ] **Step 1: Write failing export tests.**

Prove:

- `CreatePersonalRecordExportRequest` has exactly `idempotencyKey` and optional `includeRetainedSource=false`, with no subject or confirmation nonce;
- fresh `SensitiveAction.EXPORT_RECORDS` authorization is required at request and immediately before ticket publication; stale 301-second auth, missing qualified `records.export`, and `profile.reset`-only scope fail. The test never invents `amr`; a separate FND OpenTofu/integration gate proves the issuer pool is MFA-required, TOTP-only, and local-user-only;
- replaying the same subject/idempotency UUID returns the same export ID and creates one archive; the same key with a changed inclusion flag returns fixed `idempotency_conflict`;
- archive has exactly six flat regular entries when `includeRetainedSource=false`: `manifest.json`, `manifest-attestation.jws`, `fhir-r4-bundle.json`, `timeline.json`, `consents.json`, and `source-dispositions.json`. It has exactly one additional `retained-source.bin` entry only when the request opts in, the source still exists, and `RETAIN_VERIFIED_SOURCE` remains active; the disposition JSON carries its reviewed media type, byte length, and digest, never its original filename;
- manifest records FHIR 4.0.1, KR Core package, exporter version, generated time, and SHA-256/length of each of the four required payload entries plus optional `retained-source.bin`; it never lists itself or the attestation. `rec_export_job` stores the manifest digest and whole-archive digest;
- `manifest-attestation.jws` has protected header exactly `{alg:"ES256",kid,typ:"GC-RECORD-EXPORT-ATTESTATION+JWS"}` and a strict payload exactly `{schemaVersion:"record-export-attestation.v1",exportId,manifestSha256,issuedAt,expiresAt,keyId}`. `keyId` equals protected `kid`; times are offset-aware UTC; `expiresAt-issuedAt=900s`; `manifestSha256` is `sha256:` plus 64 lowercase hex;
- KMS `Sign(ECDSA_SHA_256)` receives the RFC 7515 ASCII signing input. The adapter strictly DER-decodes `(r,s)`, rejects out-of-range/non-minimal integers, normalizes `s` to low-S, and emits the 64-byte raw `r||s` required by ES256 compact JWS. Tests verify with the P-256 JWK, reject high-S/noncanonical/invalid-length signatures, mutate every payload/header field, and use a fixed golden fixture consumed by UX;
- the registry schema is additional-properties false and contains `schemaVersion:"record-export-key-registry.v1"`, monotonic `registryVersion`, `generatedAt`, `registryDigest`, and unique entries `{kid,kty:"EC",crv:"P-256",x,y,status:"current"|"retired"|"revoked",notBefore,notAfter,revokedAt}`. `registryDigest` is non-self-referential: `sha256:` of RFC 8785 canonical UTF-8 for exactly `{schemaVersion,registryVersion,generatedAt,entries}`, excluding `registryDigest`. Fixed-vector tests mutate every covered field, reject same-version/different-digest equivocation and lower versions, and prove recomputation. Exactly one key is current; retired keys verify only attestations issued inside their window; revoked keys verify none. The release builder reads KMS `GetPublicKey`, byte-compares it to the JWK, rejects version/digest rollback or same-version equivocation, and emits the digest pinned into the signed web/mobile release provenance;
- deleted sources are represented truthfully and never recreated;
- retained sources are excluded by default and included only with explicit request plus still-active retention authorization;
- exact uncompressed entry caps are `fhir-r4-bundle.json<=16 MiB`, `timeline.json<=8 MiB`, `consents.json<=2 MiB`, `source-dispositions.json<=1 MiB`, `retained-source.bin<=20 MiB`, `manifest.json<=64 KiB`, and `manifest-attestation.jws<=4 KiB`; all ZIP metadata plus entries must be at most `48 MiB` (`50,331,648` bytes). Inputs are length-checked before allocation and counted while streaming. A preflight overflow returns RFC 9457 HTTP 413 with stable code `export_too_large` and creates no job/object; an overflow caused by a post-acceptance race moves the job to `failed` with only `export_failed`;
- archive object uses KMS encryption, ticket contains only opaque ID/token, `POST /v1/exports/{exportId}/download` accepts the generated `RedeemRecordExportRequest`, performs an atomic single-use transition, returns `application/zip` with exact `Content-Length<=50,331,648` and exactly one `X-GC-Archive-SHA256: sha256:<64 lowercase hex>` header equal to the ready-status archive digest, and object/ticket expire and delete at 15 minutes. Header names are compared case-insensitively; absent, duplicate, comma-folded, malformed, or mismatched metadata and a missing/mismatched stored length fail before ticket redemption/body commit and never return a partial success;
- state-dependent status is exact: `accepted|building` has all nullable delivery/digest/key fields null; `ready` has `expiresAt`, 43-character base64url `downloadTicket`, manifest/archive SHA-256, and `attestationKeyId`; `redeemed|expired` exposes no ticket; `failed` exposes only fixed `failureCode=export_failed`. Cross-subject/unknown IDs are indistinguishable 404s;
- no archive byte/value/name appears in logs or access URL.

Freeze the attestation payload schema exactly; application tests add the 900-second cross-field invariant and protected-header equality that JSON Schema cannot express:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.genome-companion.kr/record-export-attestation.schema.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "exportId", "manifestSha256", "issuedAt", "expiresAt", "keyId"],
  "properties": {
    "schemaVersion": { "const": "record-export-attestation.v1" },
    "exportId": { "type": "string", "format": "uuid" },
    "manifestSha256": { "type": "string", "pattern": "^sha256:[0-9a-f]{64}$" },
    "issuedAt": { "type": "string", "format": "date-time" },
    "expiresAt": { "type": "string", "format": "date-time" },
    "keyId": { "type": "string", "pattern": "^[A-Za-z0-9_-]{8,64}$" }
  }
}
```

`record-export-key-registry.schema.json` similarly freezes the exact registry/digest-domain fields already listed, P-256 base64url coordinates of 43 characters, unique `kid`, one current entry, and status-dependent time fields; the builder and Kotlin/Dart consumers all validate the same file and fixed vector.

- [ ] **Step 2: Run and verify RED.**

```powershell
.\gradlew.bat --no-daemon :apps:core-api:test --tests "*PersonalRecordExportServiceTest" --tests "*RecordExportAttestationSignerTest" --tests "*PersonalRecordSensitiveActionControllerTest"
```

Expected: missing export service fails.

- [ ] **Step 3: Implement deterministic ZIP construction.**

Authorize through the foundation port and use its returned principal; never parse the JWT or accept a subject in the body:

```kotlin
fun createExport(
    authentication: Authentication,
    body: CreatePersonalRecordExportRequest,
): CreatePersonalRecordExportResponse {
    val authorization = sensitiveActions.requireAuthorized(
        authentication,
        SensitiveAction.EXPORT_RECORDS,
    )
    val prepared = exports.prepare(authorization.principal, body)
    sensitiveActions.requireAuthorized(authentication, SensitiveAction.EXPORT_RECORDS)
    return exports.publish(prepared)
}
```

Sort entry names, serialize UTF-8 canonical JSON through per-entry counting sinks, hash exact entry bytes, and use fixed-time STORED entries so compression metadata cannot vary. Do not assemble the archive in a `ByteArrayOutputStream`: spool each already-capped canonical payload into the encrypted job workspace, precompute length/CRC/digest, then stream the ZIP once through a `CountingOutputStream` plus `DigestOutputStream` directly to the KMS-encrypted object writer. Abort and delete the incomplete object before the counter can exceed `MAX_ARCHIVE_BYTES`:

```kotlin
private fun writeDeterministicZip(
    payloads: SortedMap<String, CappedPayload>,
    generatedAt: Instant,
    encryptedObjectWriter: OutputStream,
): ArchiveReceipt {
    val archiveDigest = MessageDigest.getInstance("SHA-256")
    val counted = MaxBytesOutputStream(
        DigestOutputStream(encryptedObjectWriter, archiveDigest),
        MAX_ARCHIVE_BYTES,
    )
    ZipOutputStream(counted, Charsets.UTF_8).use { zip ->
        payloads.forEach { (name, payload) ->
            require(payload.length <= ENTRY_LIMITS.getValue(name))
            val entry = ZipEntry(name).apply {
                method = ZipEntry.STORED
                size = payload.length
                compressedSize = size
                crc = payload.crc32
                timeLocal = LocalDateTime.ofInstant(generatedAt, ZoneOffset.UTC)
            }
            zip.putNextEntry(entry)
            payload.openStream().use { it.copyToCapped(zip, payload.length) }
            zip.closeEntry()
        }
    }
    return ArchiveReceipt(counted.count, "sha256:${archiveDigest.digest().toHex()}")
}
```

Build `manifest.json` after hashing the four canonical payloads and optional retained-source entry, hash the exact manifest bytes, ask `RecordExportAttestationSigner` for the compact ES256 JWS over that digest, then add both trust files to the sorted map. The six-or-seven-entry archive is authenticated through the signed manifest graph; the JWS does not attempt the impossible circular operation of signing the ZIP that contains itself. The streaming writer hashes the finished ZIP separately for the server receipt/status. Complete the encrypted object before issuing a ticket, and delete any multipart/temp artifact on cap, digest, authorization, or I/O failure. Recheck authorization immediately before publishing the ticket. Store only object reference, byte length, manifest/archive digest, signing `kid`, state, and expiry in `rec_export_job`; never store a ticket plaintext.

`RecordExportAttestationSigner` accepts only the typed payload, canonicalizes its JSON with RFC 8785, checks the current registry window, invokes the KMS adapter, and self-verifies the finished compact JWS against the pinned current JWK before return. The public-key registry is not downloaded at runtime by the offline mobile app: its exact digest and keys are generated into the code-signed app candidate. Rotation is publish-new-key/app-release first, wait until the minimum supported mobile build trusts both keys, switch the KMS alias, retain the old public key as `retired` for its issuance window, then disable signing and eventually schedule key deletion. Emergency `revoked` status ships in a new signed app release and rejects all matching archives; no archive-supplied key can extend trust.

- [ ] **Step 4: Re-run and verify GREEN.**

Expected: sensitive-action negative cases fail closed; idempotent replay creates one archive; fixed-clock manifest, JWS, and archive fixtures are stable; the app-consumable P-256 registry verifies the golden archive and rejects mutation/rollback/equivocation/revocation; six-versus-seven entry source inclusion obeys both explicit gates; every boundary byte vector, preflight 413, streaming overflow cleanup, exact `Content-Length`, status/redeem contract, one-time transition, and expiry deletion test passes.

- [ ] **Step 5: Commit.**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord packages/contracts/openapi/personal-record-v1.yaml packages/contracts/jsonschema/record-export-attestation.schema.json packages/contracts/jsonschema/record-export-key-registry.schema.json governance/cryptographic/record-export-attestation-keys.json scripts/release
git commit -m "feat: export personal health records"
```

### Task 9: Register scoped erasers and prove restore-tombstone replay

**Files:**

- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/deletion/PersonalRecordsEraser.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/deletion/DocumentObjectsEraser.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/out/deletion/HapiFhirEraser.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/PersonalRecordDeletionTest.kt`
- Modify: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/PersonalRecordSensitiveActionControllerTest.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/adapter/in/web/PersonalRecordController.kt`
- Modify: `ops/restore/test_replay_deletion_tombstones.py`
- Modify: `packages/contracts/openapi/personal-record-v1.yaml`

**Interfaces:**

- Consumes: validated Spring `Authentication`; foundation `SensitiveActionAuthorizer` with `SensitiveAction.RESET_PROFILE` (`profile:reset`, fresh strong authentication), scoped `DeletionService`, `DeletionCommand`, `DeletionReason`, `DeletionScope`, `ConsentScope`, `ProfileScope`, `SubjectDataEraser`, `DeletionEvidence`, `ProfileDeletionPort`, tombstone replay/readiness gate; exact `ResetPersonalRecordProfileRequest`.
- Produces: exact `ResetPersonalRecordProfileResponse`; evidence for eraser IDs `personal-records`, `document-objects`, `hapi-fhir`; idempotent reset request; post-restore re-erasure proof.

- [ ] **Step 1: Write failing eraser, reset, and restore tests.**

Prove:

- Spring registers exactly the three unique eraser IDs and expected target categories;
- each `DeletionEvidence.eraserId` equals its handler ID;
- personal-record eraser deletes subject REC rows without deleting foundation consent/tombstone;
- personal-record eraser deletes subject-bound explanation receipt/recall rows for timeline revocation and profile reset, without touching them for cloud-processing or retention revocation;
- object eraser removes quarantine/sanitized/candidate/retained/export objects and verifies absence;
- HAPI eraser enumerates only `rec_subject_resource_index`, DELETEs exact instances, calls instance-level expunge with deleted resources and old versions, and verifies read plus `_history` absence;
- retry skips already-absent data safely;
- reset body has exactly `idempotencyKey` and `confirmationPhrase`, with the phrase exactly `내 데이터 영구 삭제` and no subject;
- reset requires `SensitiveAction.RESET_PROFILE`; stale 301-second auth, missing qualified `profile.reset`, or `records.export`-only scope fails. FND—not REC—proves the issuer is local-user-only and MFA-required;
- a wrong, trimmed, normalized-differently, or case-altered phrase fails with fixed `reset_confirmation_invalid` and never calls deletion;
- profile reset calls `ProfileDeletionPort` with the authorized principal’s subject and the body idempotency UUID as `sourceEventId`, never a local deletion orchestrator;
- replaying the same subject/idempotency UUID returns the same deletion request ID and invokes foundation deletion once;
- scoped retention revocation selects only retained-source deletion;
- scoped cloud revocation cancels/purges only unfinished cloud jobs/artifacts;
- timeline/profile reset selects all REC erasers;
- foundation restore simulation resurrects REC/HAPI rows, then tombstone replay invokes all required REC erasers before readiness;
- another synthetic subject remains intact.

```kotlin
@Component
class HapiFhirEraser(
    private val canonicalStore: CanonicalRecordStore,
    private val clock: Clock,
) : SubjectDataEraser {
    override val eraserId = "hapi-fhir"
    override val target = DeletionTarget.USER_OBJECTS

    override fun erase(
        subject: DeletionSubject,
        scope: DeletionScope,
        requestId: UUID,
    ): DeletionEvidence {
        val refs = when (scope) {
            ProfileScope -> canonicalStore.deleteAndExpunge(subject.subjectId, requestId)
            is ConsentScope -> when (scope.purpose) {
                ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE ->
                    canonicalStore.deleteAndExpunge(subject.subjectId, requestId)
                ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
                ConsentPurpose.RETAIN_VERIFIED_SOURCE -> emptySet()
            }
        }
        val digestInput = "$eraserId:$requestId:${refs.size}".toByteArray(Charsets.UTF_8)
        val digest = java.util.HexFormat.of().formatHex(
            java.security.MessageDigest.getInstance("SHA-256").digest(digestInput),
        )
        return DeletionEvidence(eraserId, target, clock.instant(), "sha256:$digest")
    }
}
```

- [ ] **Step 2: Run and verify RED.**

```powershell
.\gradlew.bat --no-daemon :apps:core-api:test --tests "*PersonalRecordDeletionTest"
python -m unittest ops.restore.test_replay_deletion_tombstones -v
```

Expected: missing erasers/REC replay case fail.

- [ ] **Step 3: Implement the three adapters and foundation request mapping.**

Authorize before checking the typed phrase, never echo the phrase, and let foundation own idempotency through `sourceEventId`:

```kotlin
fun resetProfile(
    authentication: Authentication,
    body: ResetPersonalRecordProfileRequest,
): ResetPersonalRecordProfileResponse {
    val authorization = sensitiveActions.requireAuthorized(
        authentication,
        SensitiveAction.RESET_PROFILE,
    )
    if (body.confirmationPhrase != "내 데이터 영구 삭제") throw ResetConfirmationInvalid()
    val requestId = profileDeletionPort.requestDeletion(
        ProfileDeletionCommand(
            subjectId = authorization.principal.subjectId,
            sourceEventId = body.idempotencyKey,
        ),
    )
    return ResetPersonalRecordProfileResponse(requestId)
}
```

Implement this exact scope matrix; every eraser has an explicit branch for both sealed scope variants:

| Scope | `personal-records` | `document-objects` | `hapi-fhir` |
|---|---|---|---|
| `ConsentScope(BUILD_PERSONAL_LAB_TIMELINE)` | delete timeline/workflow/export and explanation-receipt metadata but retain the separately authorized source ledger | delete derived/export objects but leave a retained source to its own consent scope | delete and expunge indexed FHIR resources |
| `ConsentScope(PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD)` | cancel unfinished cloud workflows | delete quarantine, sanitized, and candidate artifacts for those workflows | count-only no-op evidence |
| `ConsentScope(RETAIN_VERIFIED_SOURCE)` | mark the retained-source disposition revoked and remove its object pointer only | delete retained source objects only | count-only no-op evidence |
| `ProfileScope` | delete all subject REC rows | delete all subject REC objects | delete and expunge indexed FHIR resources |

For each HAPI ref:

```kotlin
dao.delete(id, SystemRequestDetails())
dao.expunge(
    id,
    ExpungeOptions()
        .setExpungeDeletedResources(true)
        .setExpungeOldVersions(true)
        .setExpungeEverything(false),
    SystemRequestDetails(),
)
```

Global expunge is prohibited. Return count/digest-only evidence. Do not create a REC tombstone table or alternate deletion state machine; foundation V3 and restore scripts own those.

- [ ] **Step 4: Re-run and verify GREEN.**

Expected: stale/weak/wrong-action/wrong-phrase reset cases fail closed; replay returns one request; all three evidence records are durable; HAPI history is absent; scoped revocations affect only their allocated data; restored traffic remains unready until REC erasers finish.

- [ ] **Step 5: Commit.**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord ops/restore/test_replay_deletion_tombstones.py packages/contracts/openapi/personal-record-v1.yaml
git commit -m "feat: erase and re-delete personal records"
```

### Task 10: Keep MyHealthWay post-MVP and prove the full synthetic journey

**Files:**

- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/source/PersonalRecordSourceAdapter.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord/source/MyHealthWayCapability.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/MyHealthWayCapabilityTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/PersonalRecordJourneyTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/support/SyntheticPersonalRecords.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord/support/PersonalRecordIntegrationEnvironment.kt`
- Modify: `deploy/local/personal-record.compose.yml`
- Modify: `.github/workflows/ci.yml` between `BEGIN/END REC WORKSTREAM STEPS` only
- Create: `packages/contracts/jsonschema/rec-document-worker-image-handoff.schema.json`
- Create: `packages/contracts/fixtures/rec-document-worker-image-handoff.valid.json`
- Create: `scripts/release/rec_document_worker_release.py`
- Create: `scripts/release/test_rec_document_worker_release.py`
- Consume unchanged from FND: `tooling/fnd-workstream-release/pyproject.toml`, `tooling/fnd-workstream-release/uv.lock`, `scripts/ci/run_locked_uv.py`, and `scripts/release/fnd_workstream_aws.py`
- Modify only after the FND prerequisite lands: `.github/workflows/release.yml` between `BEGIN/END REC DOCUMENT WORKER RELEASE STEPS`

**Interfaces:**

- Consumes: capability query; all REC/foundation ports with synthetic PostgreSQL, HAPI, object store, ClamAV, and worker; foundation-owned CI REC markers and `PR_BASE_SHA`; and, only after the FND prerequisite, the protected `rec_document_worker_release` shell/marker, signed-tag verifier, locked Buildx/BuildKit/frontend/Python base, security-tool/Cosign 3.0.6 installers and trusted root, immutable ECR repository, Object-Lock evidence prefix, least-privilege release role, inert ECS worker service/task/roles/network, and FND post-marker verifier/deployment authority.
- Produces: disabled MyHealthWay descriptor; complete consent-to-restore acceptance evidence; REC-only CI extension with migration-range enforcement; one scanned/SBOM-bound keyless-signed immutable document-worker image; strict `rec-document-worker-image-handoff.v1`; and only `rec_document_worker_image_digest` plus its handoff coordinate for the FND verifier. REC produces no repository, role, service, listener, network, state machine, or direct deployment mutation.

- [ ] **Step 1: Write failing seam and end-to-end tests.**

MyHealthWay test requires:

```kotlin
assertThat(capability.source).isEqualTo("MY_HEALTHWAY")
assertThat(capability.enabled).isFalse()
assertThat(capability.phase).isEqualTo("POST_MVP")
assertThat(capability.reasonCode)
    .isEqualTo("FORMAL_ONBOARDING_AND_CONFORMITY_REQUIRED")
```

It also proves no MyHealthWay adapter bean, client property, secret, route, host, token, callback, or network call exists. The future `PersonalRecordSourceAdapter` accepts a FHIR R4 Bundle only after formal source authorization and sends it through the same canonical validator.

The journey:

1. grant separate timeline and KR-cloud processing consents; omit retention;
2. upload the supported synthetic PDF to quarantine;
3. scan, inert-render, OCR, fetch review, confirm one field and reject the rest;
4. pass HAPI R4/KR Core validation and store only confirmed resources;
5. delete source/temp objects before `TIMELINE_READY`;
6. read deterministic timeline with `sourceAvailable=false`;
7. call the consumer explanation route, verify exact selected packet plus both bound tokens, persist the minimal receipt, apply a synthetic valid signed recall notice, and observe recall status;
8. use fresh `EXPORT_RECORDS` step-up plus an idempotency UUID, replay it, redeem the one-use ticket, verify the default exact six-file ES256-attested archive against the release-pinned P-256 registry, verify no source file is included, then exercise the separately authorized seven-file retained-source fixture and all size boundaries;
9. use fresh `RESET_PROFILE` step-up, exact Korean phrase, and an idempotency UUID; replay it through foundation deletion;
10. assert REC rows/objects/HAPI history/recall receipts absent, restore the pre-delete snapshot, replay foundation tombstones, and assert absence again;
11. capture logs/traces/metrics/URLs/events/worker output and assert synthetic sentinel/value/question/raw FHIR are absent;
12. assert no vector/embedding dependency or call exists.

- [ ] **Step 2: Run and verify RED.**

```powershell
.\gradlew.bat --no-daemon :apps:core-api:test --tests "*MyHealthWayCapabilityTest" --tests "*PersonalRecordJourneyTest"
```

Expected: seam or first unwired journey invariant fails for its named reason.

- [ ] **Step 3: Add only the disabled descriptor and required adapter wiring.**

```kotlin
data class SourceCapability(
    val source: String,
    val enabled: Boolean,
    val phase: String,
    val reasonCode: String,
)

fun myHealthWayCapability() = SourceCapability(
    source = "MY_HEALTHWAY",
    enabled = false,
    phase = "POST_MVP",
    reasonCode = "FORMAL_ONBOARDING_AND_CONFORMITY_REQUIRED",
)
```

Wire existing REC adapters; add no explanation model, vector service, additional template, public FHIR route, or MyHealthWay connection.

Replace only the foundation no-op lines inside the exact marker pair; preserve the markers and every byte outside them:

```yaml
# BEGIN REC WORKSTREAM STEPS
- name: REC migration ownership
  run: python scripts/ci/verify_migration_ranges.py --owner REC --base "$PR_BASE_SHA"
- name: REC core and contract tests
  run: ./gradlew --no-daemon :apps:core-api:test
- name: REC document worker tests
  run: |
    python scripts/ci/run_locked_uv.py -- sync --project workers/document-processing --frozen --all-groups
    python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen python workers/document-processing/scripts/vendor_offline_assets.py --manifest workers/document-processing/model-manifest.json --destination workers/document-processing/vendor
    python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen python workers/document-processing/scripts/vendor_offline_assets.py --manifest workers/document-processing/model-manifest.json --destination workers/document-processing/vendor --verify-only
    python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen pytest workers/document-processing/tests -q
    python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen mypy workers/document-processing/app
    python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen ruff check workers/document-processing
- name: REC schemas FHIR and restore tests
  run: |
    ./gradlew --no-daemon :apps:core-api:test --tests "*FoundationContractCompatibilityTest" --tests "*WorkerContractTest" --tests "*RecordExplanationControllerTest"
    pwsh -File tools/fhir-validator/validate-krcore.ps1
    python -m unittest ops.restore.test_replay_deletion_tombstones -v
# END REC WORKSTREAM STEPS
```

Run `git diff --unified=0 "$PR_BASE_SHA" -- .github/workflows/ci.yml` in CI review and fail the PR if any changed line is outside the REC marker pair. Do not create another workflow, job, reusable workflow, or action.

- [ ] **Step 4: Run the complete verification gate.**

```powershell
.\gradlew.bat --no-daemon :apps:core-api:clean :apps:core-api:test
python scripts/ci/run_locked_uv.py -- sync --project workers/document-processing --frozen --all-groups
python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen python workers/document-processing/scripts/vendor_offline_assets.py --manifest workers/document-processing/model-manifest.json --destination workers/document-processing/vendor
python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen python workers/document-processing/scripts/vendor_offline_assets.py --manifest workers/document-processing/model-manifest.json --destination workers/document-processing/vendor --verify-only
python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen pytest workers/document-processing/tests -q
python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen mypy workers/document-processing/app
python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen ruff check workers/document-processing
powershell -File tools/fhir-validator/validate-krcore.ps1
python -m unittest ops.restore.test_replay_deletion_tombstones -v
python scripts/ci/verify_migration_ranges.py --owner REC --base "$env:PR_BASE_SHA"
```

Expected:

- Gradle succeeds with foundation plus REC unit, architecture, PostgreSQL, HAPI, object, deletion, restore, and journey tests.
- Pytest passes; mypy and ruff exit 0.
- HAPI and independent validator accept valid KR Core fixtures and reject the missing-category fixture.
- `TIMELINE_READY` occurs only after verified source disposition.
- Fact packet has the exact shared schema fields/types and `sub_` opaque subject pattern.
- All three deletion eraser IDs return evidence and replay before restore readiness.
- Explanation receipt storage is content-free; signed recall status applies by exact pack ID/version and is deleted by `personal-records`.
- Sensitive export/reset gates reject stale, weak, wrong-action, wrong-phrase, and conflicting replay cases.
- The foundation CI workflow differs only inside REC markers and the REC migration-range command passes.
- Captures contain no PHI sentinel, OCR text, personal FHIR JSON, source bytes, object keys, or values.
- No MyHealthWay network path and no personal vector/embedding path exists.

- [ ] **Step 5: Populate the protected FND worker-release marker and hand off an independently verified digest.**

This step is blocked until FND adds the inert runtime, signing-key seam, and protected shell. FND creates an immutable-tag ECR repository; an ECS service at desired count zero; digest-placeholder task definition; private TLS listener/service identity; execution role limited to ECR pull, exact log group/server-identity VersionId, and exact core-public-JWK VersionId injection; a task role limited to `kms:Sign`/`ECDSA_SHA_256` on the one worker-result key and no S3/database/personal API/Secrets Manager/data-key/decrypt permission; and security groups with no public IP/NAT/default route. Core signs the initial five-minute request containing an exact-VersionId source GET plus only the destination key/max/KMS/create-only authorization. After processing determines bytes, the worker signs a bounded upload-ticket request; core rechecks durable authorization and returns the signed at-most-five-minute PUT URL bound to the computed content-length/checksum. A destination VersionId is never prebound: S3 assigns it after the create-only write, worker captures `x-amz-version-id` in its signed result, and core exact-version HEAD plus bounded GET verifies it before transition. The worker authenticates/replay- and expiry-checks each envelope before URL parsing/use, validates HTTPS and the exact Seoul S3 host/bucket/key/source-version/method/caps, never follows a redirect, chooses a URL, or logs/persists it, and relies on destination create-only semantics as the cross-task replay fence. Runtime ingress is TLS only from the core task security group; SG/TLS is transport, never job authorization. Runtime egress is DNS, the Seoul S3 gateway prefix for presigned object transfer, and the KMS interface endpoint restricted to `Sign` on the worker key; launch-only ECR API/DKR, Secrets Manager, and Logs endpoints attach under the execution-role bootstrap path. It has no internet, arbitrary CIDR, decrypt/data-key permission, metadata-v1, ECS Exec, shell override, or public listener. FND's digest-only deployment authority registers the approved task revision with the fixed key/JWK coordinates, applies non-root/read-only-root/drop-ALL/ephemeral-storage limits, raises desired count to two across AZs only after image verification, waits for private health, and rolls back or restores zero without accepting task family/role/SG/command/key/configuration from REC.

Write `test_rec_document_worker_release.py` first for the strict schema, self-digest, uv/six-asset-manifest/runtime/build/provenance bindings, conditional Object-Lock writes, exact-VersionId reads, four-output emission, Dockerfile/offline-image policy, exact FND boto3/botocore versions, and every rejection below. Run `python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen python -m unittest scripts.release.test_rec_document_worker_release -v`; RED is the missing schema, Dockerfile hardening/offline-asset contract, release module, or locked-client binding. Do not populate the FND marker until this named RED is observed.

The FND-owned `.github/workflows/release.yml` job is exactly `rec_document_worker_release`, uses protected `production-kr`, `permissions: {contents: read, id-token: write}`, signed annotated-tag checkout with `persist-credentials:false`, FND AWS credentials, and exactly one `# BEGIN REC DOCUMENT WORKER RELEASE STEPS` / `# END REC DOCUMENT WORKER RELEASE STEPS` pair. Before the marker it projects only exact snapshot values `REC_DOCUMENT_WORKER_REPOSITORY_URL`, `REC_DOCUMENT_WORKER_RELEASE_EVIDENCE_BUCKET`, `REC_DOCUMENT_WORKER_RELEASE_EVIDENCE_PREFIX`, `REC_DOCUMENT_WORKER_BUILDX_BUILDER`, `REC_DOCUMENT_WORKER_PYTHON_RUNTIME_IMAGE`, `FOUNDATION_OUTPUTS_SNAPSHOT_JSON`, and `SIGNED_RELEASE_TAG_VERIFICATION_JSON`; the runtime image is an immutable Linux/amd64 repository@digest byte-equal to the FND Python-base lock. It installs FND's sole frozen `tooling/fnd-workstream-release` client, and every ECR/S3-capable command runs only through `python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen python ...`. The REC release role can push only this repository and conditional Object-Lock-write/exact-version-read only this evidence prefix; it cannot update ECS, IAM, networking, repository policy, Terraform, or mutable tags.

`rec-document-worker-image-handoff.schema.json` has `additionalProperties:false` and exactly `{schemaVersion:"rec-document-worker-image-handoff.v1",sourceSha,signedTag,tagVerificationSha256,repository,imageDigest,pythonRuntimeImageDigest,buildxSha256,buildkitImageDigest,dockerfileFrontendDigest,uvLockSha256,modelManifestSha256,sbom:{key,versionId,sha256},provenance:{key,versionId,sha256},signatureBundle:{key,versionId,sha256},attestationBundle:{key,versionId,sha256},cosignVersion:"v3.0.6",createdAt,handoffSha256}`. `modelManifestSha256` binds the canonical closed six-entry Paddle/ClamAV lock; provenance and image-policy verification require every locked path/hash/size to equal the files copied into the final image. Digests are lowercase `sha256:`, the image is immutable repository plus digest, coordinates require exact VersionIds, and the self-digest covers RFC 8785 canonical JSON omitting only itself. `rec_document_worker_release.py` strict-loads duplicate-free JSON and has exactly `image-digest`, `build-provenance`, `build-handoff`, `verify-handoff`, and `upload-evidence` subcommands. Its AWS-capable modes import only the exact boto3/botocore versions locked by FND's `tooling/fnd-workstream-release`; raw `aws`, `aws.exe`, `s3api`, ambient boto modules, and unwrapped invocations are rejected. `image-digest` exact-fetches the just-pushed SHA tag with `ecr:BatchGetImage`, requires one Linux/amd64 OCI manifest, and cross-checks its config/layer/build metadata before returning the registry digest. The module rejects unknown fields/options, mutable image/tag, unbound uv/model/runtime/builder lock, path/symlink escape, missing VersionId/Object Lock result, prefix escape, or newline/control output. It never signs, pushes, assumes a role, or deploys; only `upload-evidence` uses pinned boto3 to write content-addressed objects with `IfNoneMatch="*"`, checksum SHA-256, and Object Lock to the projected prefix, exact-version re-reads all objects, and appends exactly `rec_document_worker_image_digest`, `rec_document_worker_handoff_key`, `rec_document_worker_handoff_version_id`, and `rec_document_worker_handoff_sha256` to the supplied `GITHUB_OUTPUT`. Fake-botocore tests assert SDK versions and reject an ambient client, repository/bucket/prefix escape, mutable read, response overflow, or missing Object-Lock/VersionId.

Replace only the marker no-op with:

```yaml
      # BEGIN REC DOCUMENT WORKER RELEASE STEPS
      - name: REC document worker verify, build, scan, push, sign, and hand off
        id: rec_document_worker_handoff
        shell: bash
        env:
          DOCKER_CONFIG: ${{ runner.temp }}/rec-document-worker-docker
        run: |
          set -Eeuo pipefail
          trap 'docker logout "${REC_DOCUMENT_WORKER_REPOSITORY_URL%%/*}" >/dev/null 2>&1 || true; rm -rf -- "$DOCKER_CONFIG"' EXIT
          test "$GITHUB_SHA" = "$(git rev-parse 'HEAD^{commit}')"
          test -n "$REC_DOCUMENT_WORKER_REPOSITORY_URL"
          test -n "$REC_DOCUMENT_WORKER_RELEASE_EVIDENCE_BUCKET"
          test -n "$REC_DOCUMENT_WORKER_RELEASE_EVIDENCE_PREFIX"
          test -n "$REC_DOCUMENT_WORKER_PYTHON_RUNTIME_IMAGE"
          python scripts/ci/run_locked_uv.py -- sync --project workers/document-processing --frozen --all-groups
          python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen pytest workers/document-processing/tests -q
          python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen mypy workers/document-processing/app
          python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen ruff check workers/document-processing
          python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen \
            python workers/document-processing/scripts/vendor_offline_assets.py \
            --manifest workers/document-processing/model-manifest.json \
            --destination workers/document-processing/vendor
          python scripts/ci/run_locked_uv.py -- run --project workers/document-processing --frozen \
            python workers/document-processing/scripts/vendor_offline_assets.py \
            --manifest workers/document-processing/model-manifest.json \
            --destination workers/document-processing/vendor --verify-only
          bash scripts/ci/install_security_tools.sh
          python scripts/ci/install_buildx.py --destination build/tools/docker-cli-plugins
          export DOCKER_CLI_PLUGIN_EXTRA_DIRS="$GITHUB_WORKSPACE/build/tools/docker-cli-plugins"
          test "$(build/tools/docker-cli-plugins/docker-buildx version | awk '{print $2}')" = "v0.20.1"
          python scripts/ci/install_cosign.py --destination build/tools/cosign
          COSIGN="$GITHUB_WORKSPACE/build/tools/cosign/cosign"
          test "$($COSIGN version --json | python -c 'import json,sys; print(json.load(sys.stdin)["gitVersion"])')" = "v3.0.6"
          build/tools/security/gitleaks detect --source . --no-banner --redact --exit-code 1
          build/tools/security/trivy fs --exit-code 1 --severity HIGH,CRITICAL --scanners vuln,secret,misconfig workers/document-processing
          mkdir -p "$DOCKER_CONFIG" build/release/rec-document-worker
          python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen \
            python scripts/release/fnd_workstream_aws.py ecr-login \
            --repository "$REC_DOCUMENT_WORKER_REPOSITORY_URL" --docker-config "$DOCKER_CONFIG"
          SOURCE_TAG="$(git describe --tags --exact-match --match 'v[0-9]*.[0-9]*.[0-9]*')"
          IMAGE_TAG="${REC_DOCUMENT_WORKER_REPOSITORY_URL}:${GITHUB_SHA}"
          docker buildx build --builder "$REC_DOCUMENT_WORKER_BUILDX_BUILDER" --platform linux/amd64 \
            --file workers/document-processing/Dockerfile --provenance=false --sbom=false \
            --build-arg "REC_DOCUMENT_WORKER_PYTHON_RUNTIME_IMAGE=$REC_DOCUMENT_WORKER_PYTHON_RUNTIME_IMAGE" \
            --metadata-file build/release/rec-document-worker/build-metadata.json \
            --tag "$IMAGE_TAG" --load workers/document-processing
          build/tools/security/trivy image --exit-code 1 --severity HIGH,CRITICAL "$IMAGE_TAG"
          build/tools/security/trivy image --format cyclonedx --output build/release/rec-document-worker/sbom.cdx.json "$IMAGE_TAG"
          docker push "$IMAGE_TAG"
          IMAGE_DIGEST="$(python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen \
            python scripts/release/rec_document_worker_release.py image-digest \
            --metadata build/release/rec-document-worker/build-metadata.json \
            --repository "$REC_DOCUMENT_WORKER_REPOSITORY_URL" --tag "$GITHUB_SHA" --region ap-northeast-2)"
          IMAGE_REF="${REC_DOCUMENT_WORKER_REPOSITORY_URL}@${IMAGE_DIGEST}"
          python scripts/release/rec_document_worker_release.py build-provenance \
            --image "$IMAGE_REF" --source-sha "$GITHUB_SHA" --signed-tag "$SOURCE_TAG" \
            --foundation-snapshot "$FOUNDATION_OUTPUTS_SNAPSHOT_JSON" \
            --build-metadata build/release/rec-document-worker/build-metadata.json \
            --uv-lock workers/document-processing/uv.lock \
            --model-manifest workers/document-processing/model-manifest.json \
            --sbom build/release/rec-document-worker/sbom.cdx.json \
            --output build/release/rec-document-worker/provenance.json
          "$COSIGN" sign --yes --bundle build/release/rec-document-worker/signature.bundle.json \
            --new-bundle-format=true --use-signing-config=true "$IMAGE_REF"
          "$COSIGN" attest --yes --bundle build/release/rec-document-worker/attestation.bundle.json \
            --new-bundle-format=true --use-signing-config=true --type slsaprovenance \
            --predicate build/release/rec-document-worker/provenance.json "$IMAGE_REF"
          python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen \
            python scripts/release/rec_document_worker_release.py upload-evidence \
            --bucket "$REC_DOCUMENT_WORKER_RELEASE_EVIDENCE_BUCKET" \
            --prefix "$REC_DOCUMENT_WORKER_RELEASE_EVIDENCE_PREFIX" \
            --source-sha "$GITHUB_SHA" --signed-tag "$SOURCE_TAG" \
            --repository "$REC_DOCUMENT_WORKER_REPOSITORY_URL" --image-digest "$IMAGE_DIGEST" \
            --foundation-snapshot "$FOUNDATION_OUTPUTS_SNAPSHOT_JSON" \
            --tag-verification "$SIGNED_RELEASE_TAG_VERIFICATION_JSON" \
            --uv-lock workers/document-processing/uv.lock \
            --model-manifest workers/document-processing/model-manifest.json \
            --sbom build/release/rec-document-worker/sbom.cdx.json \
            --provenance build/release/rec-document-worker/provenance.json \
            --signature-bundle build/release/rec-document-worker/signature.bundle.json \
            --attestation-bundle build/release/rec-document-worker/attestation.bundle.json \
            --handoff build/release/rec-document-worker/handoff.json \
            --github-output "$GITHUB_OUTPUT"
      # END REC DOCUMENT WORKER RELEASE STEPS
```

After the marker, FND exact-fetches the handoff and four nested evidence objects, compares source/tag/repository/runtime/build/lock fields to its protected snapshot, and uses only `/opt/gc/bin/cosign`. It requires exact version `v3.0.6`, then runs `verify --offline=true --new-bundle-format=true --trusted-root /opt/gc/sigstore/trusted_root.json` and `verify-attestation --offline=true --new-bundle-format=true --trusted-root /opt/gc/sigstore/trusted_root.json --type slsaprovenance` for the immutable digest and issuer `https://token.actions.githubusercontent.com`. The exact certificate identity is `"https://github.com/" + snapshot.outputs.release_repository_owner + "/" + snapshot.outputs.release_repository_name + "/.github/workflows/release.yml@refs/tags/" + signedTagVerification.tag`. No PATH Cosign, online verification, legacy bundle, regex identity, caller root/owner/repository/tag, or mutable ref is accepted. Only after independent OCI-referrer/evidence equality and cryptographic/provenance verification may FND pass `rec_document_worker_image_digest` to its deployment authority.

Run the handoff tests in the full gate:

```powershell
python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen python -m unittest scripts.release.test_rec_document_worker_release -v
```

Expected GREEN: all field/coordinate/tool-lock mutations fail, a release-role simulation cannot call ECS/IAM/Terraform, the task-role/IAM/network render tests enforce the matrix above, and only the FND post-marker verifier can cause a digest deployment.

- [ ] **Step 6: Perform the mutation check.**

Temporarily make each mutation, run its focused test, confirm failure, and revert it:

- skip cloud-processing consent;
- default retention to true;
- move malware scan after PDF parsing;
- mark an OCR candidate verified;
- omit a candidate review decision;
- remove KR Core profile/category;
- guess an unknown unit/code;
- mark timeline ready before source deletion;
- use OCR confidence in a fact packet;
- emit `usr_` instead of `sub_`;
- include a source without explicit retention/export gates;
- omit HAPI old-version expunge;
- skip one REC eraser during restore;
- enable MyHealthWay;
- add a health value to logs or vector input.
- accept a bad recall signature or store a question/claim in the recall index;
- accept stale export/reset authentication or bypass FND's MFA-required issuer deployment gate;
- accept a wrong reset phrase or duplicate an idempotent side effect;
- move a CI command outside the REC marker pair or add a V199/V220 migration.

Expected: at least one named test fails for every mutation.

- [ ] **Step 7: Commit.**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/personalrecord apps/core-api/src/test/kotlin/kr/co/genomecompanion/personalrecord deploy/local workers/document-processing packages/contracts/jsonschema/rec-document-worker-image-handoff.schema.json packages/contracts/fixtures/rec-document-worker-image-handoff.valid.json scripts/release/rec_document_worker_release.py scripts/release/test_rec_document_worker_release.py .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "test: prove personal record FHIR lifecycle"
```

## Execution Checkpoints

After Tasks 1–2, review foundation compatibility, native consent scopes, migration allocation, exact AI fact schema, and PHI-safe dependency rules.

After Tasks 3–4, review quarantine policies, worker sandbox, OCR model/license manifest, supported-template benchmark, Korean review behavior, and consent-revocation cancellation.

After Tasks 5–7, review HAPI internal-only posture, validator parity, source-faithful mapping, immediate disposal, timeline discontinuities, explanation token binding, minimal recall storage, signed-notice behavior, and fact-packet semantics with interoperability, privacy, and clinical owners.

After Tasks 8–10, run sensitive-action/export/deletion/restore exercises, REC-marker CI review, security testing, log/network capture review, and founder release-gate review. Passing engineering tests does not waive counsel, MFDS, privacy, clinical, accessibility, or production-security approval.

## Definition of Done

- The shared foundation remains the only identity, consent, workload-token, telemetry, deletion, and restore authority.
- REC migrations use only V200–V203, and REC edits only its foundation CI marker block.
- Timeline, cloud processing, and retention use separate native purpose grants; retention is absent/default false.
- `DocumentStatusResponse` and `DocumentReviewResponse` are frozen public contracts with exact state/failure/candidate invariants and no internal error/path leakage.
- Hostile original bytes remain quarantined, are scanned before parsing, and OCR sees inert rasters only.
- Every candidate has one explicit user decision; only confirmed facts reach HAPI.
- HAPI 8.10.1, FHIR R4 4.0.1, and KR Core 2.0.0 validation pass with pinned artifacts and independent parity.
- Default source deletion is verified before timeline readiness; encrypted retention requires a current separate grant and is reversible.
- Timeline is chronological, source-faithful, discontinuity-aware, and non-diagnostic.
- REC emits the exact shared fact-packet schema and foundation `sub_` opaque reference; no conflicting packet type exists.
- The authenticated explanation route sends only selected owned verified facts with service/purpose token binding, stores no content, and surfaces verified recall state from the minimal receipt index.
- Export is deterministic, encrypted, short-lived, and truthful about unavailable sources.
- Export and reset use foundation sensitive-action authorization, exact DTOs, and subject-scoped idempotency; reset additionally requires `내 데이터 영구 삭제` exactly.
- Foundation deletion records all three REC eraser IDs, expunges HAPI history, and replays them before restored readiness.
- MyHealthWay remains disabled/post-MVP.
- The internal recall authorizer exact-VersionId loads and digest-verifies the FND trust bundle and current CRL, fails readiness at CRL expiry, and cannot fall back to ambient/mutable/stale trust.
- The protected FND REC worker shell emits a scanned, SBOM/provenance-bound, Cosign v3.0.6 new-format signed immutable digest handoff; only FND's offline verifier and digest-only deployment authority can activate the least-privilege no-NAT worker service.
- PHI never appears in logs, telemetry, URLs, event envelopes, vector stores, or captured outbound traffic.
- All focused red/green cycles, full suites, and mutation checks pass with pristine output.
