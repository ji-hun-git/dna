package kr.co.genomecompanion.documentintake.api

import java.net.URI
import java.time.Instant
import java.util.UUID


data class AuthorizedDocumentRequest(
    val subjectId: String,
    val timelineConsentId: UUID,
    val cloudConsentId: UUID,
    val mediaType: String,
    val contentLength: Long,
) {
    init {
        require(timelineConsentId != cloudConsentId)
    }
}


data class UploadTicket(
    val documentId: UUID,
    val uploadUri: URI,
    val expiresAt: Instant,
)


fun interface DocumentIntakePort {
    fun requestUpload(request: AuthorizedDocumentRequest): UploadTicket
}
