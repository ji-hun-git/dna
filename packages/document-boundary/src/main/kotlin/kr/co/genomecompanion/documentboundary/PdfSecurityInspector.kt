package kr.co.genomecompanion.documentboundary

import org.apache.pdfbox.Loader
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException
import org.apache.pdfbox.cos.COSName
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject
import java.security.MessageDigest


class PdfSecurityInspector(
    private val policy: PdfInspectionPolicy,
    private val malwareScanner: MalwareScanner,
) {
    fun inspect(bytes: ByteArray, expectedSha256: String): InspectionReport {
        val digest = sha256(bytes)
        if (bytes.size.toLong() !in policy.minBytes..policy.maxBytes) {
            return rejected(InspectionReason.SIZE_OUT_OF_RANGE, digest)
        }
        if (!MessageDigest.isEqual(digest.toByteArray(), expectedSha256.toByteArray())) {
            return rejected(InspectionReason.DIGEST_MISMATCH, digest)
        }
        if (!bytes.copyOfRange(0, 5).contentEquals("%PDF-".toByteArray())) {
            return rejected(InspectionReason.MEDIA_TYPE_MISMATCH, digest)
        }
        if (hasUnexpectedTrailingData(bytes)) {
            return rejected(InspectionReason.TRAILING_DATA, digest)
        }

        val malware = malwareScanner.scan(bytes)
        if (malware.decision != InspectionDecision.APPROVED) {
            return scannerDecision(digest, malware)
        }

        return try {
            Loader.loadPDF(bytes).use { document -> inspectParsed(document, digest, malware) }
        } catch (_: InvalidPasswordException) {
            rejected(InspectionReason.ENCRYPTED_PDF, digest, malware)
        } catch (_: Exception) {
            rejected(InspectionReason.MALFORMED_PDF, digest, malware)
        }
    }

    private fun inspectParsed(
        document: PDDocument,
        digest: String,
        malware: MalwareScanResult,
    ): InspectionReport {
        val pageCount = document.numberOfPages
        val objectCount = document.document.xrefTable.size
        val encrypted = document.isEncrypted
        val embeddedFiles = document.documentCatalog.names?.embeddedFiles != null
        val activeContent = document.documentCatalog.openAction != null ||
            document.documentCatalog.names?.javaScript != null ||
            document.documentCatalog.acroForm != null ||
            document.documentCatalog.cosObject.containsKey(COSName.AA)
        val totalImagePixels = totalImagePixels(document)

        val reason = when {
            encrypted -> InspectionReason.ENCRYPTED_PDF
            pageCount !in 1..policy.maxPages -> InspectionReason.PAGE_LIMIT_EXCEEDED
            objectCount > policy.maxIndirectObjects -> InspectionReason.OBJECT_LIMIT_EXCEEDED
            totalImagePixels > policy.maxImagePixels -> InspectionReason.IMAGE_COMPLEXITY_EXCEEDED
            embeddedFiles -> InspectionReason.EMBEDDED_FILE
            activeContent -> InspectionReason.ACTIVE_CONTENT
            else -> InspectionReason.CLEAN
        }
        return InspectionReport(
            decision = if (reason == InspectionReason.CLEAN) InspectionDecision.APPROVED else InspectionDecision.REJECTED,
            reason = reason,
            sourceSha256 = digest,
            identifiedMediaType = "application/pdf",
            pageCount = pageCount,
            indirectObjectCount = objectCount,
            totalImagePixels = totalImagePixels,
            encrypted = encrypted,
            activeContent = activeContent,
            embeddedFiles = embeddedFiles,
            policyVersion = policy.policyVersion,
            scannerName = malware.scannerName,
            scannerVersion = malware.scannerVersion,
            signatureVersion = malware.signatureVersion,
        )
    }

    private fun totalImagePixels(document: PDDocument): Long {
        var total = 0L
        document.pages.forEach { page ->
            page.resources?.xObjectNames?.forEach { name ->
                val image = runCatching { page.resources.getXObject(name) }.getOrNull() as? PDImageXObject
                if (image != null) {
                    total = Math.addExact(total, Math.multiplyExact(image.width.toLong(), image.height.toLong()))
                }
            }
        }
        return total
    }

    private fun scannerDecision(digest: String, malware: MalwareScanResult): InspectionReport =
        InspectionReport(
            decision = malware.decision,
            reason = malware.reason,
            sourceSha256 = digest,
            identifiedMediaType = null,
            pageCount = null,
            indirectObjectCount = null,
            totalImagePixels = null,
            encrypted = null,
            activeContent = null,
            embeddedFiles = null,
            policyVersion = policy.policyVersion,
            scannerName = malware.scannerName,
            scannerVersion = malware.scannerVersion,
            signatureVersion = malware.signatureVersion,
        )

    private fun rejected(
        reason: InspectionReason,
        digest: String,
        malware: MalwareScanResult = MalwareScanResult(
            InspectionDecision.REJECTED,
            reason,
            "NOT_RUN",
            "NOT_RUN",
            "NOT_RUN",
        ),
    ): InspectionReport = scannerDecision(digest, malware.copy(decision = InspectionDecision.REJECTED, reason = reason))

    private fun hasUnexpectedTrailingData(bytes: ByteArray): Boolean {
        val marker = "%%EOF".toByteArray()
        var markerStart = -1
        for (index in 0..bytes.size - marker.size) {
            if (bytes.copyOfRange(index, index + marker.size).contentEquals(marker)) markerStart = index
        }
        if (markerStart < 0) return true
        return bytes.copyOfRange(markerStart + marker.size, bytes.size)
            .any { byte -> byte.toInt().toChar() !in setOf(' ', '\t', '\r', '\n', '\u0000') }
    }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256")
            .digest(bytes)
            .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
}
