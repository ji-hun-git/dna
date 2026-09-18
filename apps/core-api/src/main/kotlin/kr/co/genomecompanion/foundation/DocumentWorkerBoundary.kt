package kr.co.genomecompanion.foundation

import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.Valid
import jakarta.validation.constraints.AssertTrue
import jakarta.validation.constraints.DecimalMax
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import kr.co.genomecompanion.documentboundary.InspectionDecision
import kr.co.genomecompanion.documentboundary.InspectionReason
import kr.co.genomecompanion.documentboundary.InspectionReport
import kr.co.genomecompanion.documentboundary.StorageTrustZone
import kr.co.genomecompanion.documentboundary.WorkerIdentity
import kr.co.genomecompanion.platform.telemetry.CorrelationFilter
import kr.co.genomecompanion.platform.telemetry.PhiSafeLogger
import kr.co.genomecompanion.platform.telemetry.SafeTelemetryContext
import kr.co.genomecompanion.platform.telemetry.TelemetryEvent
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.filter.OncePerRequestFilter
import java.nio.charset.StandardCharsets
import java.time.Clock
import java.time.Instant
import java.util.Base64
import java.util.UUID


private const val WORKER_ID_HASH_ATTRIBUTE = "gc.document.worker.id-hash"
private const val WORKER_CREDENTIAL_HEADER = "X-GC-Worker-Credential"
private const val WORKER_ID_HEADER = "X-GC-Worker-Id"
private const val WORKER_ID_MAC_HEADER = "X-GC-Worker-Id-Mac"
private const val JOB_LEASE_HEADER = "X-GC-Job-Lease"

// Route *templates* for the worker-boundary log lines: constants, never a request URI.
private const val LEASE_ROUTE = "/internal/document-boundary/jobs/lease"
private const val INSPECTION_RESULT_ROUTE = "/internal/document-boundary/jobs/{jobId}/inspection-result"
private const val EXTRACTION_RESULT_ROUTE = "/internal/document-boundary/jobs/{jobId}/extraction-result"
private const val FAILURE_ROUTE = "/internal/document-boundary/jobs/{jobId}/failure"


data class WorkerLeaseResponse(
    val jobId: UUID,
    val jobType: String,
    val attempt: Int,
    val maxAttempts: Int,
    val leaseToken: String,
    val leaseExpiresAt: Instant,
    val sourcePath: String,
    val sourceSha256: String,
    val sourceLength: Long,
    val sourceZone: StorageTrustZone,
    val documentStateVersion: Long,
)


data class InspectionResultRequest(
    val decision: InspectionDecision,
    val reason: InspectionReason,
    @field:Pattern(regexp = "^[0-9a-f]{64}$")
    val sourceSha256: String,
    @field:Size(max = 80)
    val identifiedMediaType: String?,
    val pageCount: Int?,
    val indirectObjectCount: Int?,
    val totalImagePixels: Long?,
    val encrypted: Boolean?,
    val activeContent: Boolean?,
    val embeddedFiles: Boolean?,
    @field:Pattern(regexp = "^[A-Za-z0-9._:-]{1,64}$")
    val policyVersion: String,
    @field:Pattern(regexp = "^[A-Za-z0-9._ -]{1,80}$")
    val scannerName: String,
    @field:Pattern(regexp = "^[A-Za-z0-9._:-]{1,80}$")
    val scannerVersion: String,
    @field:Pattern(regexp = "^[A-Za-z0-9._: -]{1,120}$")
    val signatureVersion: String,
)


data class EvidenceBox(
    @field:DecimalMin("0.0") @field:DecimalMax("1.0")
    val x: Double,
    @field:DecimalMin("0.0") @field:DecimalMax("1.0")
    val y: Double,
    @field:DecimalMin("0.0") @field:DecimalMax("1.0")
    val width: Double,
    @field:DecimalMin("0.0") @field:DecimalMax("1.0")
    val height: Double,
) {
    @get:AssertTrue(message = "evidence box exceeds the page horizontally")
    @get:JsonIgnore
    val isWithinPageHorizontally: Boolean
        get() = x + width <= 1.0

    @get:AssertTrue(message = "evidence box exceeds the page vertically")
    @get:JsonIgnore
    val isWithinPageVertically: Boolean
        get() = y + height <= 1.0
}


/**
 * One row the worker read from the text layer. Raw label and unit; core normalizes. The
 * reference-range text is carried verbatim and never interpreted: it is stored and exported only.
 */
data class ExtractedCandidate(
    @field:Min(1) @field:Max(100)
    val ordinal: Int,
    @field:Size(min = 1, max = 80)
    val label: String,
    @field:Pattern(regexp = "^-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$") @field:Size(max = 64)
    val value: String,
    @field:Size(min = 1, max = 32)
    val unit: String,
    @field:Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$")
    val observedOn: String,
    @field:Min(1) @field:Max(20)
    val evidencePage: Int,
    @field:Valid
    val evidenceBox: EvidenceBox?,
    @field:Pattern(regexp = "^[0-9a-f]{64}$")
    val sourceTextSha256: String,
    @field:Size(max = 40) @field:Pattern(regexp = "^[0-9.,\\s\\-~–<>≤≥]{1,40}$")
    val referenceRangeText: String? = null,
    /** The printed label before a worker-side split (blood pressure's `혈압`), verbatim; null when
     * the row was not split. `min = 1`: a blank string is not a valid label and must be rejected
     * here (400) rather than reach the V11 `CHECK (original_label IS NULL OR char_length(...)
     * BETWEEN 1 AND 80)` constraint as a raw SQL failure (F8). */
    @field:Size(min = 1, max = 80)
    val originalLabel: String? = null,
)


/** Why a row (or the whole document) produced no candidate. Visible to the person, never hidden. */
data class ExtractionAbstention(
    @field:Size(min = 1, max = 80)
    val label: String,
    @field:Pattern(regexp = "^(unreadable|ambiguous_value|ambiguous_unit|missing_evidence|qualified_value|qualitative|previous_column)$")
    val reason: String,
    @field:Min(1) @field:Max(20)
    val evidencePage: Int? = null,
)


data class ExtractionResultRequest(
    @field:Pattern(regexp = "^[0-9a-f]{64}$")
    val sourceSha256: String,
    @field:Pattern(regexp = "^[0-9a-f]{64}$")
    val workerImageDigest: String,
    @field:Pattern(regexp = "^[A-Za-z0-9._:-]{1,80}$")
    val generatorVersion: String,
    @field:Size(min = 92, max = 2_796_204)
    val previewPngBase64: String,
    @field:Pattern(regexp = "^native-text$")
    val extractionMethod: String = "native-text",
    @field:Valid @field:Size(max = 100)
    val candidates: List<ExtractedCandidate> = emptyList(),
    @field:Valid @field:Size(max = 100)
    val abstentions: List<ExtractionAbstention> = emptyList(),
)


data class WorkerFailureRequest(
    @field:Pattern(regexp = "^[a-z0-9_]{3,80}$")
    val code: String,
    val retryable: Boolean,
)


data class WorkerResultReceipt(
    val jobId: UUID,
    val status: String,
)


@Service
@ConditionalOnProperty(
    prefix = "gc.foundation",
    name = ["enabled", "document-boundary-enabled"],
    havingValue = "true",
)
class DocumentWorkerBoundaryService(
    private val repository: FoundationRepository,
    private val storage: FoundationDocumentStorage,
    private val properties: FoundationProperties,
    private val normalizer: MedicalConceptNormalizer,
    private val clock: Clock,
    private val logging: FoundationLogging,
) {
    @Transactional
    fun lease(workerIdHash: String): WorkerLeaseResponse? {
        val rawLease = FoundationHashing.randomToken()
        val now = Instant.now(clock)
        val job = repository.leaseNextDocumentJob(
            workerIdHash = workerIdHash,
            leaseTokenHash = FoundationHashing.sha256(rawLease),
            now = now,
            leaseExpiresAt = now.plus(properties.workerLeaseTtl),
        ) ?: return null
        // No subject hash on the worker boundary: a job belongs to a document, and tying a worker line
        // to a person is neither needed to operate the queue nor safe to write down.
        logging.event(TelemetryEvent.WORKER_JOB_LEASED, LEASE_ROUTE, null)
        return WorkerLeaseResponse(
            jobId = job.jobId,
            jobType = job.jobType,
            attempt = job.attempt,
            maxAttempts = job.maxAttempts,
            leaseToken = rawLease,
            leaseExpiresAt = job.leaseExpiresAt,
            sourcePath = "/internal/document-boundary/jobs/${job.jobId}/source",
            sourceSha256 = job.sourceSha256,
            sourceLength = job.sourceLength,
            sourceZone = sourceZone(job),
            documentStateVersion = job.documentStateVersion,
        )
    }

    @Transactional(readOnly = true)
    fun readLeasedSource(jobId: UUID, rawLease: String): Pair<DocumentJobRow, ByteArray> {
        val now = Instant.now(clock)
        val job = repository.findLeasedJob(jobId, FoundationHashing.sha256(rawLease), now)
            ?: throw FoundationForbiddenException("worker_job_lease_invalid")
        val bytes = storage.read(sourceZone(job), job.sourceObjectKey)
        if (
            bytes.size.toLong() != job.sourceLength ||
            !FoundationHashing.constantTimeHexEquals(FoundationHashing.sha256(bytes), job.sourceSha256)
        ) {
            throw FoundationConflictException("worker_source_digest_mismatch")
        }
        return job to bytes
    }

    @Transactional
    fun completeInspection(jobId: UUID, rawLease: String, request: InspectionResultRequest): WorkerResultReceipt {
        val now = Instant.now(clock)
        val job = requireLeasedJob(jobId, rawLease, now, "SECURITY_INSPECTION")
        if (!FoundationHashing.constantTimeHexEquals(request.sourceSha256, job.sourceSha256)) {
            return failAndLog(job, "inspection_digest_mismatch", retryable = false, now, INSPECTION_RESULT_ROUTE)
        }
        if (
            request.decision == InspectionDecision.RETRYABLE_FAILURE &&
            request.reason != InspectionReason.SCANNER_UNAVAILABLE
        ) {
            return failAndLog(job, "inspection_result_invalid", retryable = false, now, INSPECTION_RESULT_ROUTE)
        }
        if (request.decision == InspectionDecision.RETRYABLE_FAILURE) {
            // The reason is one of our own enum constants, not a worker-supplied message.
            val receipt = failAndLog(job, request.reason.name.lowercase(), retryable = true, now, INSPECTION_RESULT_ROUTE)
            audit(job, "DOCUMENT_INSPECTION_RETRY", "REJECTED", now)
            return receipt
        }
        if (request.decision == InspectionDecision.APPROVED && request.reason != InspectionReason.CLEAN) {
            return failAndLog(job, "inspection_result_invalid", retryable = false, now, INSPECTION_RESULT_ROUTE)
        }
        if (
            request.decision == InspectionDecision.REJECTED &&
            request.reason in setOf(InspectionReason.CLEAN, InspectionReason.SCANNER_UNAVAILABLE)
        ) {
            return failAndLog(job, "inspection_result_invalid", retryable = false, now, INSPECTION_RESULT_ROUTE)
        }
        val approvedScanner = when (request.scannerName) {
            "ClamAV" -> request.scannerVersion == properties.requiredClamAvVersion
            "SyntheticManifestScanner" ->
                properties.allowSyntheticScannerResults && request.scannerVersion == "test-only-v1"
            else -> false
        }
        if (request.decision == InspectionDecision.APPROVED && !approvedScanner) {
            return failAndLog(job, "unapproved_scanner", retryable = false, now, INSPECTION_RESULT_ROUTE)
        }
        if (
            request.decision == InspectionDecision.APPROVED &&
            request.policyVersion != "pdf-security-v1"
        ) {
            return failAndLog(job, "inspection_policy_mismatch", retryable = false, now, INSPECTION_RESULT_ROUTE)
        }
        if (
            request.decision == InspectionDecision.APPROVED &&
            (
                request.identifiedMediaType != "application/pdf" ||
                    request.pageCount !in 1..20 ||
                    request.indirectObjectCount !in 1..20_000 ||
                    request.totalImagePixels !in 0L..50_000_000L ||
                    request.encrypted != false ||
                    request.activeContent != false ||
                    request.embeddedFiles != false
            )
        ) {
            return failAndLog(job, "inspection_evidence_invalid", retryable = false, now, INSPECTION_RESULT_ROUTE)
        }
        val bytes = storage.read(StorageTrustZone.UNTRUSTED, job.sourceObjectKey)
        if (
            bytes.size.toLong() != job.sourceLength ||
            !FoundationHashing.constantTimeHexEquals(FoundationHashing.sha256(bytes), job.sourceSha256)
        ) {
            return failAndLog(job, "inspection_source_changed", retryable = false, now, INSPECTION_RESULT_ROUTE)
        }
        val report = InspectionReport(
            decision = request.decision,
            reason = request.reason,
            sourceSha256 = request.sourceSha256,
            identifiedMediaType = request.identifiedMediaType,
            pageCount = request.pageCount,
            indirectObjectCount = request.indirectObjectCount,
            totalImagePixels = request.totalImagePixels,
            encrypted = request.encrypted,
            activeContent = request.activeContent,
            embeddedFiles = request.embeddedFiles,
            policyVersion = request.policyVersion,
            scannerName = request.scannerName,
            scannerVersion = request.scannerVersion,
            signatureVersion = request.signatureVersion,
        )
        val promoted = if (request.decision == InspectionDecision.APPROVED) {
            storage.promote(job.documentId, job.sourceSha256, job.sourceObjectKey)
        } else {
            null
        }
        registerRollbackDelete(promoted, StorageTrustZone.APPROVED_SOURCE)
        repository.markInspectionCompleted(
            job = job,
            report = report,
            inspectionId = UUID.randomUUID(),
            promotionId = promoted?.let { UUID.randomUUID() },
            approvedObjectKey = promoted?.descriptor?.objectKey,
            extractionJobId = promoted?.let { UUID.randomUUID() },
            now = now,
        )
        audit(
            job,
            if (request.decision == InspectionDecision.APPROVED) {
                "DOCUMENT_SECURITY_APPROVED"
            } else {
                "DOCUMENT_SECURITY_REJECTED"
            },
            if (request.decision == InspectionDecision.APPROVED) "SUCCESS" else "REJECTED",
            now,
        )
        logging.event(TelemetryEvent.WORKER_JOB_COMPLETED, INSPECTION_RESULT_ROUTE, null)
        return WorkerResultReceipt(jobId, "COMPLETED")
    }

    @Transactional
    fun completeExtraction(jobId: UUID, rawLease: String, request: ExtractionResultRequest): WorkerResultReceipt {
        val now = Instant.now(clock)
        val job = requireLeasedJob(jobId, rawLease, now, "SYNTHETIC_EXTRACTION")
        if (!FoundationHashing.constantTimeHexEquals(request.sourceSha256, job.sourceSha256)) {
            return failAndLog(job, "extraction_digest_mismatch", retryable = false, now, EXTRACTION_RESULT_ROUTE)
        }
        val source = storage.read(StorageTrustZone.APPROVED_SOURCE, job.sourceObjectKey)
        if (
            source.size.toLong() != job.sourceLength ||
            !FoundationHashing.constantTimeHexEquals(FoundationHashing.sha256(source), job.sourceSha256)
        ) {
            return failAndLog(job, "approved_source_changed", retryable = false, now, EXTRACTION_RESULT_ROUTE)
        }
        val ordinals = request.candidates.map { it.ordinal }
        val candidates = runCatching {
            require(ordinals.distinct().size == ordinals.size) { "duplicate ordinal" }
            request.candidates.sortedBy { it.ordinal }.map(normalizer::normalize)
        }.getOrElse {
            return failAndLog(job, "extraction_candidates_invalid", retryable = false, now, EXTRACTION_RESULT_ROUTE)
        }
        val previewBytes = runCatching { Base64.getDecoder().decode(request.previewPngBase64) }
            .getOrElse {
                return failAndLog(job, "preview_base64_invalid", retryable = false, now, EXTRACTION_RESULT_ROUTE)
            }
        val preview = runCatching { storage.putDerivedPreview(job.documentId, job.sourceSha256, previewBytes) }
            .getOrElse {
                return failAndLog(job, "preview_artifact_invalid", retryable = false, now, EXTRACTION_RESULT_ROUTE)
            }
        registerRollbackDelete(preview, StorageTrustZone.DERIVED_SAFE_ARTIFACT)
        repository.markExtractionCompleted(
            workerJob = job,
            extractionJobId = UUID.randomUUID(),
            previewId = UUID.randomUUID(),
            previewObjectKey = preview.descriptor.objectKey,
            previewSha256 = preview.descriptor.sha256,
            workerImageDigest = request.workerImageDigest,
            generatorVersion = request.generatorVersion,
            now = now,
            candidates = candidates,
            abstentions = request.abstentions,
        )
        // Count only: the audit row names the extraction job, never a value.
        audit(job, if (candidates.isEmpty()) "EXTRACTION_NO_CANDIDATES" else "EXTRACTION_CANDIDATES_CREATED", "SUCCESS", now)
        logging.event(TelemetryEvent.WORKER_JOB_COMPLETED, EXTRACTION_RESULT_ROUTE, null)
        return WorkerResultReceipt(jobId, "COMPLETED")
    }

    @Transactional
    fun failJob(jobId: UUID, rawLease: String, request: WorkerFailureRequest): WorkerResultReceipt {
        val now = Instant.now(clock)
        val job = repository.lockLeasedJob(jobId, FoundationHashing.sha256(rawLease), now)
            ?: throw FoundationForbiddenException("worker_job_lease_invalid")
        // `request.code` comes from the worker and is validated by `WorkerFailureRequest`, but it is not
        // ours, so it is written to the job row (which is not a log) and never to the log line.
        repository.markJobFailed(job, request.code, request.retryable, now)
        audit(job, "DOCUMENT_JOB_FAILED", "REJECTED", now)
        logging.failure(TelemetryEvent.WORKER_JOB_FAILED, FAILURE_ROUTE, "worker_reported_failure")
        val retryScheduled = request.retryable && job.attempt < job.maxAttempts
        return WorkerResultReceipt(jobId, if (retryScheduled) "RETRY_SCHEDULED" else "DEAD_LETTER")
    }

    /**
     * Every server-side dead-letter: mark the job failed **and** say so on one line.
     *
     * Before this existed each of the fourteen validation failures in `completeInspection`/
     * `completeExtraction` marked the job failed and returned silently, so only a worker-reported
     * failure (`failJob`) ever produced a `worker_job_failed` line — exactly inverting the operational
     * need, since a dead letter the server decided on is the one a human has to explain. The line
     * carries the same safe context as `failJob`'s (event code, route template, no subject hash, plus
     * the correlation id `logback-spring.xml` prints from the MDC) and, in addition, [reasonCode]:
     * always a constant from this file or one of our own enum names, never a worker message.
     */
    private fun failAndLog(
        job: DocumentJobRow,
        reasonCode: String,
        retryable: Boolean,
        now: Instant,
        routeTemplate: String,
    ): WorkerResultReceipt {
        repository.markJobFailed(job, reasonCode, retryable, now)
        logging.failure(TelemetryEvent.WORKER_JOB_FAILED, routeTemplate, reasonCode)
        val retryScheduled = retryable && job.attempt < job.maxAttempts
        return WorkerResultReceipt(job.jobId, if (retryScheduled) "RETRY_SCHEDULED" else "DEAD_LETTER")
    }

    private fun requireLeasedJob(
        jobId: UUID,
        rawLease: String,
        now: Instant,
        expectedType: String,
    ): DocumentJobRow {
        val job = repository.lockLeasedJob(jobId, FoundationHashing.sha256(rawLease), now)
            ?: throw FoundationForbiddenException("worker_job_lease_invalid")
        if (job.jobType != expectedType) throw FoundationConflictException("worker_job_type_mismatch")
        return job
    }

    private fun sourceZone(job: DocumentJobRow): StorageTrustZone =
        if (job.jobType == "SECURITY_INSPECTION") {
            StorageTrustZone.UNTRUSTED
        } else {
            StorageTrustZone.APPROVED_SOURCE
        }

    private fun registerRollbackDelete(write: StoredObjectWrite?, zone: StorageTrustZone) {
        if (write?.createdNew != true) return
        TransactionSynchronizationManager.registerSynchronization(
            object : TransactionSynchronization {
                override fun afterCompletion(status: Int) {
                    if (status != TransactionSynchronization.STATUS_COMMITTED) {
                        runCatching { storage.deleteAll(listOf(zone to write.descriptor.objectKey)) }
                    }
                }
            },
        )
    }

    private fun audit(job: DocumentJobRow, eventType: String, outcome: String, now: Instant) {
        repository.insertAudit(
            subjectHash = FoundationHashing.sha256("${properties.auditPepper}:${job.subjectId}"),
            actorSessionHash = null,
            eventType = eventType,
            resourceType = "DOCUMENT_JOB",
            resourceId = job.jobId,
            outcome = outcome,
            now = now,
        )
    }
}


@RestController
@RequestMapping("/internal/document-boundary")
@ConditionalOnProperty(
    prefix = "gc.foundation",
    name = ["enabled", "document-boundary-enabled"],
    havingValue = "true",
)
class DocumentWorkerBoundaryController(
    private val service: DocumentWorkerBoundaryService,
) {
    @PostMapping("/jobs/lease")
    fun lease(request: HttpServletRequest): ResponseEntity<WorkerLeaseResponse> {
        val workerIdHash = request.getAttribute(WORKER_ID_HASH_ATTRIBUTE) as? String
            ?: throw FoundationForbiddenException("worker_identity_missing")
        val lease = service.lease(workerIdHash) ?: return ResponseEntity.noContent().build()
        return ResponseEntity.ok().cacheControlNoStore().body(lease)
    }

    @GetMapping("/jobs/{jobId}/source", produces = [MediaType.APPLICATION_OCTET_STREAM_VALUE])
    fun source(
        @PathVariable jobId: UUID,
        @RequestHeader(JOB_LEASE_HEADER) rawLease: String,
    ): ResponseEntity<ByteArray> {
        val (job, bytes) = service.readLeasedSource(jobId, rawLease)
        return ResponseEntity.ok()
            .cacheControlNoStore()
            .header("X-Content-Type-Options", "nosniff")
            .header("X-GC-Source-SHA256", job.sourceSha256)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=untrusted-document.bin")
            .body(bytes)
    }

    @PostMapping("/jobs/{jobId}/inspection-result")
    fun inspectionResult(
        @PathVariable jobId: UUID,
        @RequestHeader(JOB_LEASE_HEADER) rawLease: String,
        @Valid @RequestBody body: InspectionResultRequest,
    ): ResponseEntity<WorkerResultReceipt> =
        ResponseEntity.ok().cacheControlNoStore().body(service.completeInspection(jobId, rawLease, body))

    @PostMapping("/jobs/{jobId}/extraction-result")
    fun extractionResult(
        @PathVariable jobId: UUID,
        @RequestHeader(JOB_LEASE_HEADER) rawLease: String,
        @Valid @RequestBody body: ExtractionResultRequest,
    ): ResponseEntity<WorkerResultReceipt> =
        ResponseEntity.ok().cacheControlNoStore().body(service.completeExtraction(jobId, rawLease, body))

    @PostMapping("/jobs/{jobId}/failure")
    fun failure(
        @PathVariable jobId: UUID,
        @RequestHeader(JOB_LEASE_HEADER) rawLease: String,
        @Valid @RequestBody body: WorkerFailureRequest,
    ): ResponseEntity<WorkerResultReceipt> =
        ResponseEntity.ok().cacheControlNoStore().body(service.failJob(jobId, rawLease, body))

    @ExceptionHandler(
        FoundationBadRequestException::class,
        FoundationForbiddenException::class,
        FoundationConflictException::class,
        FoundationUnprocessableException::class,
        FoundationRateLimitedException::class,
    )
    fun problem(exception: RuntimeException): ResponseEntity<ApiProblem> {
        val status = when (exception) {
            is FoundationBadRequestException -> HttpStatus.BAD_REQUEST
            is FoundationForbiddenException -> HttpStatus.FORBIDDEN
            is FoundationUnprocessableException -> HttpStatus.UNPROCESSABLE_ENTITY
            is FoundationRateLimitedException -> HttpStatus.TOO_MANY_REQUESTS
            else -> HttpStatus.CONFLICT
        }
        return ResponseEntity.status(status)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .cacheControlNoStore()
            .body(ApiProblem(exception.message ?: "worker_request_failed"))
    }
}


@Configuration
@ConditionalOnProperty(
    prefix = "gc.foundation",
    name = ["enabled", "document-boundary-enabled"],
    havingValue = "true",
)
class DocumentWorkerSecurityConfiguration {
    @Bean
    @Order(0)
    fun documentWorkerSecurityFilterChain(
        http: HttpSecurity,
        documentWorkerCredentialFilter: DocumentWorkerCredentialFilter,
    ): SecurityFilterChain = http
        .securityMatcher("/internal/document-boundary/**")
        // This is a stateless, non-browser worker API. A worker credential and
        // per-job lease capability authenticate every operation; no cookie is accepted.
        .csrf { it.disable() }
        .cors { it.disable() }
        .httpBasic { it.disable() }
        .formLogin { it.disable() }
        .logout { it.disable() }
        .requestCache { it.disable() }
        .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
        .authorizeHttpRequests { it.anyRequest().permitAll() }
        .addFilterBefore(documentWorkerCredentialFilter, AnonymousAuthenticationFilter::class.java)
        .build()
}


@Component
@ConditionalOnProperty(
    prefix = "gc.foundation",
    name = ["enabled", "document-boundary-enabled"],
    havingValue = "true",
)
class DocumentWorkerCredentialFilter(
    private val properties: FoundationProperties,
    clock: Clock,
) : OncePerRequestFilter() {
    private val workerIdPattern = Regex("^[A-Za-z0-9._:-]{3,80}$")
    private val phiSafeLogger = PhiSafeLogger.forClass(DocumentWorkerCredentialFilter::class.java)

    /**
     * Per-worker-id budget, keyed by the *hashed* worker id so the raw id never becomes a map key an
     * operator could read out of a heap dump. It is deliberately the same mechanism the session
     * limiter uses (see [TokenBucketWindow]) rather than a second copy of the eviction rules.
     */
    private val workerBuckets = TokenBucketWindow(clock) { properties.workerRateLimitPerMinute }

    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        !request.requestURI.startsWith("/internal/document-boundary/")

    /**
     * Three checks, in this order, and the order is the point:
     *
     * 1. **Credential.** A caller that cannot present the shared credential is not a worker at all.
     * 2. **Identity proof.** `X-GC-Worker-Id-Mac` must be HMAC-SHA256(key = sha256(credential),
     *    message = workerId) — see [WorkerIdentity]. Without it the worker id is a self-asserted
     *    header, so any credential holder could claim any id, spend another worker's budget, and
     *    scatter that id through the audit trail.
     * 3. **Rate limit.** Only now is a request counted against the worker's bucket: counting before
     *    step 1 or 2 would let an unauthenticated caller exhaust a *real* worker's budget by simply
     *    naming it — a denial of service handed over for free.
     *
     * A denial logs one structured line with no credential, no MAC, and no worker id in it; the raw
     * header values exist only as locals here.
     */
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val rawCredential = request.getHeader(WORKER_CREDENTIAL_HEADER).orEmpty()
        val workerId = request.getHeader(WORKER_ID_HEADER).orEmpty()
        if (
            rawCredential.length !in 32..256 ||
            !workerIdPattern.matches(workerId) ||
            !FoundationHashing.constantTimeHexEquals(
                FoundationHashing.sha256(rawCredential),
                properties.workerCredentialSha256,
            )
        ) {
            deny(response, HttpServletResponse.SC_FORBIDDEN, "worker_identity_denied")
            return
        }
        val presentedMac = request.getHeader(WORKER_ID_MAC_HEADER).orEmpty()
        if (
            !FoundationHashing.constantTimeHexEquals(
                presentedMac,
                WorkerIdentity.macFromCredentialDigest(properties.workerCredentialSha256, workerId),
            )
        ) {
            phiSafeLogger.emit(TelemetryEvent.AUTHENTICATION_DENIED, denialContext())
            deny(response, HttpServletResponse.SC_FORBIDDEN, "worker_identity_denied")
            return
        }
        val workerIdHash = FoundationHashing.sha256(workerId)
        if (!workerBuckets.tryAcquire(workerIdHash)) {
            response.setHeader(HttpHeaders.RETRY_AFTER, "60")
            deny(response, HttpStatus.TOO_MANY_REQUESTS.value(), "rate_limited")
            return
        }
        request.setAttribute(WORKER_ID_HASH_ATTRIBUTE, workerIdHash)
        filterChain.doFilter(request, response)
    }

    private fun deny(response: HttpServletResponse, status: Int, code: String) {
        response.status = status
        response.contentType = MediaType.APPLICATION_PROBLEM_JSON_VALUE
        response.characterEncoding = StandardCharsets.UTF_8.name()
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
        response.writer.write("{\"code\":\"$code\"}")
    }

    /** No handler has been chosen this early in the chain, so the route template is the fixed prefix
     * this filter guards rather than a request-derived path. */
    private fun denialContext(): SafeTelemetryContext = SafeTelemetryContext(
        correlationId = CorrelationFilter.currentCorrelationId() ?: UUID.randomUUID(),
        routeTemplate = "/internal/document-boundary",
        statusClass = "4xx",
        latencyMs = null,
    )
}


private fun ResponseEntity.BodyBuilder.cacheControlNoStore(): ResponseEntity.BodyBuilder =
    header(HttpHeaders.CACHE_CONTROL, "no-store")
