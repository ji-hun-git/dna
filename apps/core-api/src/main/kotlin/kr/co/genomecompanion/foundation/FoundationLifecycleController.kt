package kr.co.genomecompanion.foundation

import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import kr.co.genomecompanion.documentboundary.BoundedUploadCapability
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.validation.BindException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID
import java.time.Duration


data class LocalSessionRequest(
    @field:Pattern(regexp = "^synthetic-[a-z0-9-]+$")
    val subjectId: String,
    @field:Size(min = 32, max = 256)
    val credential: String,
)


data class LocalSessionResponse(
    val sessionId: UUID,
    val subjectId: String,
    val status: String = "AUTHENTICATED",
    val expiresAt: String,
    val csrfToken: String? = null,
)


data class ConsentResponse(
    val consentId: UUID?,
    val purposeCode: String = "DOCUMENT_EXTRACTION",
    val status: String,
)


data class DocumentRequest(
    val consentId: UUID,
    @field:Pattern(regexp = "^application/pdf$")
    val mediaType: String,
    val contentLength: Long,
    @field:Pattern(regexp = "^[0-9a-f]{64}$")
    val sha256: String,
)


data class DocumentTicketResponse(
    val document: DocumentReceipt,
    val uploadCapability: BoundedUploadCapability,
)


data class DocumentActivityResponse(
    val document: DocumentReceipt?,
)


data class CandidateConfirmationRequest(
    @field:Size(min = 1, max = 64)
    val value: String,
)


data class RecordCorrectionRequest(
    @field:Size(min = 1, max = 64)
    val value: String,
    @field:Size(min = 1, max = 200)
    val reason: String,
)


data class ApiProblem(val code: String)


@RestController
@RequestMapping("/api/foundation")
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationLifecycleController(
    private val service: FoundationLifecycleService,
    private val properties: FoundationProperties,
) {
    @PostMapping("/session")
    fun createSession(@Valid @RequestBody request: LocalSessionRequest): ResponseEntity<LocalSessionResponse> {
        val issued = service.createSession(request.subjectId, request.credential)
        val cookie = ResponseCookie.from(FOUNDATION_SESSION_COOKIE, issued.rawToken)
            .httpOnly(true)
            .secure(properties.secureCookies)
            .sameSite("Strict")
            .path("/api")
            .maxAge(properties.sessionTtl)
            .build()
        val csrfCookie = ResponseCookie.from(FOUNDATION_CSRF_COOKIE, issued.rawCsrf)
            .httpOnly(false)
            .secure(properties.secureCookies)
            .sameSite("Strict")
            .path("/")
            .maxAge(properties.sessionTtl)
            .build()
        return ResponseEntity.status(HttpStatus.CREATED)
            .header(HttpHeaders.SET_COOKIE, cookie.toString(), csrfCookie.toString())
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(
                LocalSessionResponse(
                    sessionId = issued.sessionId,
                    subjectId = request.subjectId,
                    expiresAt = issued.expiresAt.toString(),
                    csrfToken = issued.rawCsrf,
                ),
            )
    }

    @GetMapping("/session")
    fun getSession(request: HttpServletRequest): ResponseEntity<LocalSessionResponse> {
        val principal = request.foundationPrincipal()
        return ResponseEntity.ok()
            .cacheControlNoStore()
            .body(
                LocalSessionResponse(
                    sessionId = principal.sessionId,
                    subjectId = principal.subjectId,
                    expiresAt = principal.expiresAt.toString(),
                ),
            )
    }

    @GetMapping("/consents/document-extraction")
    fun getDocumentConsent(request: HttpServletRequest): ResponseEntity<ConsentResponse> {
        val consent = service.getDocumentConsent(request.foundationPrincipal())
        return ResponseEntity.ok()
            .cacheControlNoStore()
            .body(ConsentResponse(consentId = consent.consentId, status = consent.status))
    }

    @PostMapping("/consents/document-extraction")
    fun grantDocumentConsent(request: HttpServletRequest): ResponseEntity<ConsentResponse> {
        val consentId = service.grantDocumentConsent(request.foundationPrincipal())
        return ResponseEntity.status(HttpStatus.CREATED)
            .cacheControlNoStore()
            .body(ConsentResponse(consentId = consentId, status = "ACTIVE"))
    }

    @PostMapping("/documents")
    fun requestDocument(
        request: HttpServletRequest,
        @Valid @RequestBody body: DocumentRequest,
        @RequestHeader("Idempotency-Key") idempotencyKey: String,
    ): ResponseEntity<DocumentTicketResponse> {
        val receipt = service.requestDocument(
            principal = request.foundationPrincipal(),
            consentId = body.consentId,
            mediaType = body.mediaType,
            contentLength = body.contentLength,
            expectedSha256 = body.sha256,
            idempotencyKey = idempotencyKey,
        )
        return ResponseEntity.status(HttpStatus.CREATED)
            .cacheControlNoStore()
            .body(
                DocumentTicketResponse(
                    document = receipt.document,
                    uploadCapability = receipt.uploadCapability,
                ),
            )
    }

    @PutMapping("/documents/{documentId}/content", consumes = [MediaType.APPLICATION_PDF_VALUE])
    fun uploadDocument(
        request: HttpServletRequest,
        @PathVariable documentId: UUID,
        @RequestHeader("X-GC-Upload-Capability-Id") capabilityId: UUID,
        @RequestHeader("X-GC-Upload-Capability") rawCapability: String,
    ): ResponseEntity<DocumentReceipt> {
        if (request.contentLengthLong > 10_485_760) throw FoundationBadRequestException("document_size_invalid")
        val content = request.inputStream.readNBytes(10_485_761)
        if (content.size > 10_485_760) throw FoundationBadRequestException("document_size_invalid")
        return ResponseEntity.ok()
            .cacheControlNoStore()
            .body(
                service.uploadDocument(
                    request.foundationPrincipal(),
                    documentId,
                    capabilityId,
                    rawCapability,
                    content,
                ),
            )
    }

    @PostMapping("/documents/{documentId}/finalization")
    fun finalizeDocument(
        request: HttpServletRequest,
        @PathVariable documentId: UUID,
    ): ResponseEntity<DocumentReceipt> =
        ResponseEntity.accepted()
            .cacheControlNoStore()
            .body(service.finalizeDocument(request.foundationPrincipal(), documentId))

    @GetMapping("/documents/{documentId}")
    fun getDocument(
        request: HttpServletRequest,
        @PathVariable documentId: UUID,
    ): ResponseEntity<DocumentReceipt> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.getDocument(request.foundationPrincipal(), documentId))

    @GetMapping("/documents/active")
    fun getActiveDocument(request: HttpServletRequest): ResponseEntity<DocumentActivityResponse> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(DocumentActivityResponse(service.getActiveDocument(request.foundationPrincipal())))

    @GetMapping("/documents/{documentId}/candidate")
    fun getCandidateForDocument(
        request: HttpServletRequest,
        @PathVariable documentId: UUID,
    ): ResponseEntity<CandidateReceipt> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.getCandidateForDocument(request.foundationPrincipal(), documentId))

    @GetMapping("/documents/{documentId}/candidates")
    fun listCandidatesForDocument(
        request: HttpServletRequest,
        @PathVariable documentId: UUID,
    ): ResponseEntity<List<CandidateReceipt>> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.listCandidatesForDocument(request.foundationPrincipal(), documentId))

    @GetMapping("/documents/{documentId}/preview", produces = [MediaType.IMAGE_PNG_VALUE])
    fun getDocumentPreview(
        request: HttpServletRequest,
        @PathVariable documentId: UUID,
    ): ResponseEntity<ByteArray> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=approved-synthetic-preview.png")
            .body(service.getDocumentPreview(request.foundationPrincipal(), documentId))

    @PostMapping("/candidates/{candidateId}/confirmation")
    fun confirmCandidate(
        request: HttpServletRequest,
        @PathVariable candidateId: UUID,
        @Valid @RequestBody body: CandidateConfirmationRequest,
        @RequestHeader("Idempotency-Key") idempotencyKey: String,
    ): ResponseEntity<RecordReceipt> =
        ResponseEntity.status(HttpStatus.CREATED)
            .cacheControlNoStore()
            .body(
                service.confirmCandidate(
                    request.foundationPrincipal(),
                    candidateId,
                    body.value,
                    idempotencyKey,
                ),
            )

    @GetMapping("/candidates/{candidateId}")
    fun getCandidate(
        request: HttpServletRequest,
        @PathVariable candidateId: UUID,
    ): ResponseEntity<CandidateReceipt> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.getCandidate(request.foundationPrincipal(), candidateId))

    @PostMapping("/candidates/{candidateId}/exclusion")
    fun excludeCandidate(
        request: HttpServletRequest,
        @PathVariable candidateId: UUID,
        @RequestHeader("Idempotency-Key") idempotencyKey: String,
    ): ResponseEntity<CandidateReceipt> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.excludeCandidate(request.foundationPrincipal(), candidateId, idempotencyKey))

    @GetMapping("/records")
    fun listRecords(request: HttpServletRequest): ResponseEntity<List<RecordReceipt>> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.listRecords(request.foundationPrincipal()))

    @GetMapping("/records/{recordId}")
    fun getRecord(
        request: HttpServletRequest,
        @PathVariable recordId: UUID,
    ): ResponseEntity<RecordReceipt> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.getRecord(request.foundationPrincipal(), recordId))

    @PostMapping("/records/{recordId}/corrections")
    fun correctRecord(
        request: HttpServletRequest,
        @PathVariable recordId: UUID,
        @Valid @RequestBody body: RecordCorrectionRequest,
        @RequestHeader("Idempotency-Key") idempotencyKey: String,
    ): ResponseEntity<RecordReceipt> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(
                service.correctRecord(
                    request.foundationPrincipal(),
                    recordId,
                    body.value,
                    body.reason,
                    idempotencyKey,
                ),
            )

    @PostMapping("/consents/{consentId}/revocation")
    fun revokeConsent(
        request: HttpServletRequest,
        @PathVariable consentId: UUID,
    ): ResponseEntity<ConsentResponse> {
        service.revokeConsent(request.foundationPrincipal(), consentId)
        return ResponseEntity.ok()
            .cacheControlNoStore()
            .body(ConsentResponse(consentId = consentId, status = "REVOKED"))
    }

    @DeleteMapping("/profile")
    fun deleteProfile(request: HttpServletRequest): ResponseEntity<DeletionReceipt> {
        val receipt = service.deleteProfile(request.foundationPrincipal())
        val expiredSession = ResponseCookie.from(FOUNDATION_SESSION_COOKIE, "")
            .httpOnly(true)
            .secure(properties.secureCookies)
            .sameSite("Strict")
            .path("/api")
            .maxAge(Duration.ZERO)
            .build()
        val expiredCsrf = ResponseCookie.from(FOUNDATION_CSRF_COOKIE, "")
            .httpOnly(false)
            .secure(properties.secureCookies)
            .sameSite("Strict")
            .path("/")
            .maxAge(Duration.ZERO)
            .build()
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, expiredSession.toString(), expiredCsrf.toString())
            .cacheControlNoStore()
            .body(receipt)
    }

    @ExceptionHandler(FoundationBadRequestException::class)
    fun handleBadRequest(exception: FoundationBadRequestException): ResponseEntity<ApiProblem> =
        problem(HttpStatus.BAD_REQUEST, exception.code)

    @ExceptionHandler(FoundationForbiddenException::class)
    fun handleForbidden(exception: FoundationForbiddenException): ResponseEntity<ApiProblem> =
        problem(HttpStatus.FORBIDDEN, exception.code)

    @ExceptionHandler(FoundationNotFoundException::class)
    fun handleNotFound(exception: FoundationNotFoundException): ResponseEntity<ApiProblem> =
        problem(HttpStatus.NOT_FOUND, exception.code)

    @ExceptionHandler(FoundationConflictException::class)
    fun handleConflict(exception: FoundationConflictException): ResponseEntity<ApiProblem> =
        problem(HttpStatus.CONFLICT, exception.code)

    @ExceptionHandler(MethodArgumentNotValidException::class, BindException::class)
    fun handleValidation(): ResponseEntity<ApiProblem> =
        problem(HttpStatus.BAD_REQUEST, "request_invalid")

    private fun problem(status: HttpStatus, code: String): ResponseEntity<ApiProblem> =
        ResponseEntity.status(status)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .cacheControlNoStore()
            .body(ApiProblem(code))
}


private fun HttpServletRequest.foundationPrincipal(): FoundationPrincipal =
    getAttribute(FOUNDATION_PRINCIPAL_ATTRIBUTE) as? FoundationPrincipal
        ?: throw FoundationForbiddenException("foundation_principal_missing")


private fun ResponseEntity.BodyBuilder.cacheControlNoStore(): ResponseEntity.BodyBuilder =
    header(HttpHeaders.CACHE_CONTROL, "no-store")
