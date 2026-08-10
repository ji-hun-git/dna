package kr.co.genomecompanion.documentintake.api

import java.net.URI
import java.time.Instant
import java.util.UUID
import kr.co.genomecompanion.consentpurpose.api.DocumentUploadConsentAuthorization


data class AuthorizedDocumentRequest(
    val authorization: DocumentUploadConsentAuthorization,
    val mediaType: String,
    val contentLength: Long,
)


data class UploadTicket(
    val documentId: UUID,
    val uploadUri: URI,
    val expiresAt: Instant,
)


fun interface DocumentIntakePort {
    fun requestUpload(request: AuthorizedDocumentRequest): UploadTicket
}
