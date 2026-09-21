package kr.co.genomecompanion.documentboundary

import org.apache.pdfbox.Loader
import org.apache.pdfbox.contentstream.PDFStreamEngine
import org.apache.pdfbox.contentstream.operator.DrawObject
import org.apache.pdfbox.contentstream.operator.Operator
import org.apache.pdfbox.contentstream.operator.OperatorName
import org.apache.pdfbox.contentstream.operator.state.Concatenate
import org.apache.pdfbox.contentstream.operator.state.Restore
import org.apache.pdfbox.contentstream.operator.state.Save
import org.apache.pdfbox.contentstream.operator.state.SetGraphicsStateParameters
import org.apache.pdfbox.contentstream.operator.state.SetMatrix
import org.apache.pdfbox.cos.COSBase
import org.apache.pdfbox.cos.COSDictionary
import org.apache.pdfbox.cos.COSName
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDResources
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject
import org.apache.pdfbox.pdmodel.graphics.image.PDInlineImage
import org.apache.pdfbox.pdmodel.graphics.pattern.PDTilingPattern
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotation
import java.security.MessageDigest
import java.util.Collections
import java.util.IdentityHashMap


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
        val catalog = document.documentCatalog
        val xfa = catalog.acroForm?.cosObject?.containsKey(COSName.XFA) == true
        val annotationActive = document.pages.any { page ->
            page.cosObject.containsKey(COSName.AA) || annotations(page).any { annotation ->
                val action = annotation.cosObject.getDictionaryObject(COSName.A) as? COSDictionary
                action?.getNameAsString(COSName.S) in DANGEROUS_ACTIONS || annotation.cosObject.containsKey(COSName.AA)
            }
        }
        val attachmentAnnotation = document.pages.any { page ->
            annotations(page).any { annotation -> annotation.subtype == "FileAttachment" }
        }
        val embeddedFiles = catalog.names?.embeddedFiles != null || attachmentAnnotation
        val activeContent = catalog.openAction != null ||
            catalog.names?.javaScript != null ||
            catalog.acroForm != null ||
            catalog.cosObject.containsKey(COSName.AA) ||
            annotationActive
        val imageCounter = ImagePixelCounter(policy.maxNestingDepth)
        val totalImagePixels = imageCounter.count(document)

        val reason = when {
            encrypted -> InspectionReason.ENCRYPTED_PDF
            xfa -> InspectionReason.XFA_FORM
            pageCount !in 1..policy.maxPages -> InspectionReason.PAGE_LIMIT_EXCEEDED
            objectCount > policy.maxIndirectObjects -> InspectionReason.OBJECT_LIMIT_EXCEEDED
            imageCounter.depthExceeded || totalImagePixels > policy.maxImagePixels ->
                InspectionReason.IMAGE_COMPLEXITY_EXCEEDED
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

    /** Annotation parsing is attacker-controlled; one broken entry must not hide the rest of the page. */
    private fun annotations(page: PDPage): List<PDAnnotation> =
        runCatching { page.annotations }.getOrDefault(emptyList())

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

    /**
     * One pass over the bytes. The previous version copied a fresh array at every offset and rebuilt a
     * `Set` for every trailing byte, which is quadratic: a 10 MB upload - the size the policy allows -
     * could hold the inspector for minutes without any malformed content at all.
     */
    private fun hasUnexpectedTrailingData(bytes: ByteArray): Boolean {
        val marker = EOF_MARKER
        var lastMarker = -1
        var index = 0
        while (index <= bytes.size - marker.size) {
            if (bytes[index] == marker[0] && bytes.regionMatches(index, marker)) {
                lastMarker = index
                index += marker.size
            } else {
                index += 1
            }
        }
        if (lastMarker < 0) return true
        for (position in lastMarker + marker.size until bytes.size) {
            if (bytes[position].toInt().toChar() !in EOF_PADDING) return true
        }
        return false
    }

    private fun ByteArray.regionMatches(offset: Int, other: ByteArray): Boolean {
        for (index in other.indices) if (this[offset + index] != other[index]) return false
        return true
    }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256")
            .digest(bytes)
            .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }

    private companion object {
        private val DANGEROUS_ACTIONS = setOf("JavaScript", "Launch", "URI", "GoToR")
        private val EOF_MARKER = "%%EOF".toByteArray()
        private val EOF_PADDING = charArrayOf(' ', '\t', '\r', '\n', '\u0000')
    }
}


/**
 * Counts unique resource-image pixels and visited inline images. This is not a bound on repeated
 * rendering work. A hostile document can hide images behind forms or tiling patterns, so crossing
 * the traversal limit rejects the document instead of approving a partial count.
 *
 * Resource depths are memoized by identity. A shared resource reached along a deeper path must be
 * checked again; remembering only its first visit would let that path bypass the nesting limit.
 */
private class ImagePixelCounter(private val maxDepth: Int) : PDFStreamEngine() {
    private val countedImages: MutableSet<COSBase> = Collections.newSetFromMap(IdentityHashMap())
    private val walkedResourceDepths = IdentityHashMap<COSBase, Int>()
    private val renderedFormDepths = IdentityHashMap<COSBase, IdentityHashMap<COSBase?, Int>>()
    private var total = 0L
    private var formDepth = 0
    var depthExceeded = false
        private set

    init {
        addOperator(Concatenate(this))
        addOperator(DrawObject(this))
        addOperator(SetGraphicsStateParameters(this))
        addOperator(Save(this))
        addOperator(Restore(this))
        addOperator(SetMatrix(this))
    }

    fun count(document: PDDocument): Long {
        document.pages.forEach { page ->
            runCatching { processPage(page) }
            walk(runCatching { page.resources }.getOrNull(), 0)
        }
        return total
    }

    /** Inline images carry their size in the operator's own parameters and never appear in resources. */
    override fun processOperator(operator: Operator, operands: MutableList<COSBase>) {
        if (operator.name == OperatorName.BEGIN_INLINE_IMAGE) {
            val image = operator.imageParameters?.let { parameters ->
                runCatching { PDInlineImage(parameters, operator.imageData ?: ByteArray(0), resources) }.getOrNull()
            }
            if (image != null) add(image.width.toLong(), image.height.toLong())
        }
        super.processOperator(operator, operands)
    }

    override fun showForm(form: PDFormXObject) {
        if (formDepth >= maxDepth) {
            depthExceeded = true
            return
        }
        // Resource-less forms inherit the caller's resources: identical form bytes can expand to
        // different children on another page or inside another form.
        val context = resources?.cosObject
        val depths = renderedFormDepths.getOrPut(form.cosObject) { IdentityHashMap() }
        if ((depths[context] ?: -1) >= formDepth) return
        depths[context] = formDepth
        formDepth += 1
        try {
            super.showForm(form)
        } finally {
            formDepth -= 1
        }
    }

    private fun walk(resources: PDResources?, depth: Int) {
        if (depth > maxDepth) {
            depthExceeded = true
            return
        }
        if (resources == null) return
        if ((walkedResourceDepths[resources.cosObject] ?: -1) >= depth) return
        walkedResourceDepths[resources.cosObject] = depth
        resources.xObjectNames.forEach { name ->
            when (val xobject = runCatching { resources.getXObject(name) }.getOrNull()) {
                is PDImageXObject ->
                    if (countedImages.add(xobject.cosObject)) add(xobject.width.toLong(), xobject.height.toLong())
                is PDFormXObject ->
                    walk(runCatching { xobject.resources }.getOrNull(), depth + 1)
                else -> Unit
            }
        }
        resources.patternNames.forEach { name ->
            val pattern = runCatching { resources.getPattern(name) }.getOrNull()
            if (pattern is PDTilingPattern) {
                walk(runCatching { pattern.resources }.getOrNull(), depth + 1)
            }
        }
    }

    private fun add(width: Long, height: Long) {
        total = Math.addExact(total, Math.multiplyExact(width, height))
    }
}
