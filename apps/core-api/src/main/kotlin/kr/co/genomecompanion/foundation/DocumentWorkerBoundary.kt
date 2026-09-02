package kr.co.genomecompanion.foundation

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.Valid
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import kr.co.genomecompanion.documentboundary.InspectionDecision
import kr.co.genomecompanion.documentboundary.InspectionReason
import kr.co.genomecompanion.documentboundary.InspectionReport
import kr.co.genomecompanion.documentboundary.StorageTrustZone
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
private const val JOB_LEASE_HEADER = "X-GC-Job-Lease"


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


data class ExtractionResultRequest(
    @field:Pattern(regexp = "^[0-9a-f]{64}$")
    val sourceSha256: String,
    @field:Pattern(regexp = "^[0-9a-f]{64}$")
    val workerImageDigest: String,
    @field:Pattern(regexp = "^[A-Za-z0-9._:-]{1,80}$")
    val generatorVersion: String,
    @field:Size(min = 92, max = 2_796_204)
    val previewPngBase64: String,
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
    private val clock: Clock,
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
            repository.markJobFailed(job, "inspection_digest_mismatch", retryable = false, now)
            return WorkerResultReceipt(jobId, "DEAD_LETTER")
        }
        if (
            request.decision == InspectionDecision.RETRYABLE_FAILURE &&
            request.reason != InspectionReason.SCANNER_UNAVAILABLE
        ) {
            repository.markJobFailed(job, "inspection_result_invalid", retryable = false, now)
            return WorkerResultReceipt(jobId, "DEAD_LETTER")
        }
        if (request.decision == InspectionDecision.RETRYABLE_FAILURE) {
            repository.markJobFailed(job, request.reason.name.lowercase(), retryable = true, now)
            audit(job, "DOCUMENT_INSPECTION_RETRY", "REJECTED", now)
            return WorkerResultReceipt(jobId, if (job.attempt < job.maxAttempts) "RETRY_SCHEDULED" else "DEAD_LETTER")
        }
        if (request.decision == InspectionDecision.APPROVED && request.reason != InspectionReason.CLEAN) {
            repository.markJobFailed(job, "inspection_result_invalid", retryable = false, now)
            return WorkerResultReceipt(jobId, "DEAD_LETTER")
        }
        if (
            request.decision == InspectionDecision.REJECTED &&
            request.reason in setOf(InspectionReason.CLEAN, InspectionReason.SCANNER_UNAVAILABLE)
        ) {
            repository.markJobFailed(job, "inspection_result_invalid", retryable = false, now)
            return WorkerResultReceipt(jobId, "DEAD_LETTER")
        }
        val approvedScanner = when (request.scannerName) {
            "ClamAV" -> request.scannerVersion == properties.requiredClamAvVersion
            "SyntheticManifestScanner" ->
                properties.allowSyntheticScannerResults && request.scannerVersion == "test-only-v1"
            else -> false
        }
        if (request.decision == InspectionDecision.APPROVED && !approvedScanner) {
            repository.markJobFailed(job, "unapproved_scanner", retryable = false, now)
            return WorkerResultReceipt(jobId, "DEAD_LETTER")
        }
        if (
            request.decision == InspectionDecision.APPROVED &&
            request.policyVersion != "pdf-security-v1"
        ) {
            repository.markJobFailed(job, "inspection_policy_mismatch", retryable = false, now)
            return WorkerResultReceipt(jobId, "DEAD_LETTER")
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
            repository.markJobFailed(job, "inspection_evidence_invalid", retryable = false, now)
            return WorkerResultReceipt(jobId, "DEAD_LETTER")
        }
        val bytes = storage.read(StorageTrustZone.UNTRUSTED, job.sourceObjectKey)
        if (
            bytes.size.toLong() != job.sourceLength ||
            !FoundationHashing.constantTimeHexEquals(FoundationHashing.sha256(bytes), job.sourceSha256)
        ) {
            repository.markJobFailed(job, "inspection_source_changed", retryable = false, now)
            return WorkerResultReceipt(jobId, "DEAD_LETTER")
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
        return WorkerResultReceipt(jobId, "COMPLETED")
    }

    @Transactional
    fun completeExtraction(jobId: UUID, rawLease: String, request: ExtractionResultRequest): WorkerResultReceipt {
        val now = Instant.now(clock)
        val job = requireLeasedJob(jobId, rawLease, now, "SYNTHETIC_EXTRACTION")
        if (!FoundationHashing.constantTimeHexEquals(request.sourceSha256, job.sourceSha256)) {
            repository.markJobFailed(job, "extraction_digest_mismatch", retryable = false, now)
            return WorkerResultReceipt(jobId, "DEAD_LETTER")
        }
        val source = storage.read(StorageTrustZone.APPROVED_SOURCE, job.sourceObjectKey)
        if (
            source.size.toLong() != job.sourceLength ||
            !FoundationHashing.constantTimeHexEquals(FoundationHashing.sha256(source), job.sourceSha256)
        ) {
            repository.markJobFailed(job, "approved_source_changed", retryable = false, now)
            return WorkerResultReceipt(jobId, "DEAD_LETTER")
        }
        val previewBytes = runCatching { Base64.getDecoder().decode(request.previewPngBase64) }
            .getOrElse {
                repository.markJobFailed(job, "preview_base64_invalid", retryable = false, now)
                return WorkerResultReceipt(jobId, "DEAD_LETTER")
            }
        val preview = runCatching { storage.putDerivedPreview(job.documentId, job.sourceSha256, previewBytes) }
            .getOrElse {
                repository.markJobFailed(job, "preview_artifact_invalid", retryable = false, now)
                return WorkerResultReceipt(jobId, "DEAD_LETTER")
            }
        val candidates = runCatching {
            SyntheticCandidateFixture.candidatesFor(properties.candidateSetFor(job.sourceSha256))
        }
            .getOrElse {
                repository.markJobFailed(job, "synthetic_candidate_set_unavailable", retryable = false, now)
                return WorkerResultReceipt(jobId, "DEAD_LETTER")
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
        )
        audit(job, "SYNTHETIC_CANDIDATE_CREATED", "SUCCESS", now)
        return WorkerResultReceipt(jobId, "COMPLETED")
    }

    @Transactional
    fun failJob(jobId: UUID, rawLease: String, request: WorkerFailureRequest): WorkerResultReceipt {
        val now = Instant.now(clock)
        val job = repository.lockLeasedJob(jobId, FoundationHashing.sha256(rawLease), now)
            ?: throw FoundationForbiddenException("worker_job_lease_invalid")
        repository.markJobFailed(job, request.code, request.retryable, now)
        audit(job, "DOCUMENT_JOB_FAILED", "REJECTED", now)
        val retryScheduled = request.retryable && job.attempt < job.maxAttempts
        return WorkerResultReceipt(jobId, if (retryScheduled) "RETRY_SCHEDULED" else "DEAD_LETTER")
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
    )
    fun problem(exception: RuntimeException): ResponseEntity<ApiProblem> {
        val status = when (exception) {
            is FoundationBadRequestException -> HttpStatus.BAD_REQUEST
            is FoundationForbiddenException -> HttpStatus.FORBIDDEN
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
) : OncePerRequestFilter() {
    private val workerIdPattern = Regex("^[A-Za-z0-9._:-]{3,80}$")

    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        !request.requestURI.startsWith("/internal/document-boundary/")

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
            response.status = HttpServletResponse.SC_FORBIDDEN
            response.contentType = MediaType.APPLICATION_PROBLEM_JSON_VALUE
            response.characterEncoding = StandardCharsets.UTF_8.name()
            response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
            response.writer.write("{\"code\":\"worker_identity_denied\"}")
            return
        }
        request.setAttribute(WORKER_ID_HASH_ATTRIBUTE, FoundationHashing.sha256(workerId))
        filterChain.doFilter(request, response)
    }
}


private fun ResponseEntity.BodyBuilder.cacheControlNoStore(): ResponseEntity.BodyBuilder =
    header(HttpHeaders.CACHE_CONTROL, "no-store")
