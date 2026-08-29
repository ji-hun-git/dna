package kr.co.genomecompanion.foundation

import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
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


data class LocalSessionRequest(
    @field:Pattern(regexp = "^synthetic-[a-z0-9-]+$")
    val subjectId: String,
    @field:Size(min = 32, max = 256)
    val credential: String,
)


data class LocalSessionResponse(
    val sessionId: UUID,
    val csrfToken: String,
    val expiresAt: String,
)


data class ConsentResponse(
    val consentId: UUID,
    val purposeCode: String = "DOCUMENT_EXTRACTION",
    val status: String,
)


data class DocumentRequest(
    val consentId: UUID,
    @field:Pattern(regexp = "^application/pdf$")
    val mediaType: String,
    val contentLength: Long,
)


data class DocumentTicketResponse(
    val document: DocumentReceipt,
    val uploadPath: String,
)


data class CandidateConfirmationRequest(
    @field:Size(min = 1, max = 64)
    val value: String,
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
        return ResponseEntity.status(HttpStatus.CREATED)
            .header(HttpHeaders.SET_COOKIE, cookie.toString())
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(
                LocalSessionResponse(
                    sessionId = issued.sessionId,
                    csrfToken = issued.rawCsrf,
                    expiresAt = issued.expiresAt.toString(),
                ),
            )
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
            idempotencyKey = idempotencyKey,
        )
        return ResponseEntity.status(HttpStatus.CREATED)
            .cacheControlNoStore()
            .body(
                DocumentTicketResponse(
                    document = receipt,
                    uploadPath = "/api/foundation/documents/${receipt.documentId}/content",
                ),
            )
    }

    @PutMapping("/documents/{documentId}/content", consumes = [MediaType.APPLICATION_PDF_VALUE])
    fun uploadDocument(
        request: HttpServletRequest,
        @PathVariable documentId: UUID,
        @RequestBody content: ByteArray,
    ): ResponseEntity<DocumentReceipt> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.uploadDocument(request.foundationPrincipal(), documentId, content))

    @PostMapping("/documents/{documentId}/inspection")
    fun inspectDocument(
        request: HttpServletRequest,
        @PathVariable documentId: UUID,
    ): ResponseEntity<DocumentReceipt> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.inspectDocument(request.foundationPrincipal(), documentId))

    @PostMapping("/documents/{documentId}/extraction")
    fun extractCandidate(
        request: HttpServletRequest,
        @PathVariable documentId: UUID,
    ): ResponseEntity<CandidateReceipt> =
        ResponseEntity.status(HttpStatus.CREATED)
            .cacheControlNoStore()
            .body(service.extractCandidate(request.foundationPrincipal(), documentId))

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
    fun deleteProfile(request: HttpServletRequest): ResponseEntity<DeletionReceipt> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.deleteProfile(request.foundationPrincipal()))

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
