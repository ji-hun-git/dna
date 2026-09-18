package kr.co.genomecompanion.documentboundary

import org.apache.pdfbox.cos.COSDictionary
import org.apache.pdfbox.cos.COSName
import org.apache.pdfbox.cos.COSStream
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.PDResources
import org.apache.pdfbox.pdmodel.PDDocumentNameDictionary
import org.apache.pdfbox.pdmodel.common.PDRectangle
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory
import org.apache.pdfbox.pdmodel.graphics.image.PDInlineImage
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationFileAttachment
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm
import org.apache.pdfbox.pdmodel.common.filespecification.PDComplexFileSpecification
import org.apache.pdfbox.pdmodel.common.filespecification.PDEmbeddedFile
import org.apache.pdfbox.pdmodel.encryption.AccessPermission
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy
import org.apache.pdfbox.pdmodel.PDEmbeddedFilesNameTreeNode
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.io.ByteArrayInputStream
import java.security.MessageDigest


class PdfSecurityInspectorTest {
    private val cleanScanner = MalwareScanner {
        MalwareScanResult(
            InspectionDecision.APPROVED,
            InspectionReason.CLEAN,
            "ClamAV",
            "1.5.4",
            "synthetic-test-signatures",
        )
    }

    private val inspector = PdfSecurityInspector(PdfInspectionPolicy(), cleanScanner)

    @Test
    fun `approves only parsed digest-bound inactive pdf bytes`() {
        val bytes = pdf()
        val report = PdfSecurityInspector(PdfInspectionPolicy(), cleanScanner).inspect(bytes, sha256(bytes))

        assertThat(report.decision).isEqualTo(InspectionDecision.APPROVED)
        assertThat(report.reason).isEqualTo(InspectionReason.CLEAN)
        assertThat(report.pageCount).isEqualTo(1)
        assertThat(report.sourceSha256).isEqualTo(sha256(bytes))
    }

    @Test
    fun `rejects mismatched digest before scanner or parser trust`() {
        val bytes = pdf()
        val report = PdfSecurityInspector(PdfInspectionPolicy(), cleanScanner).inspect(bytes, "0".repeat(64))

        assertThat(report.decision).isEqualTo(InspectionDecision.REJECTED)
        assertThat(report.reason).isEqualTo(InspectionReason.DIGEST_MISMATCH)
        assertThat(report.scannerName).isEqualTo("NOT_RUN")
    }

    @Test
    fun `rejects active catalog actions`() {
        val bytes = pdf(withOpenAction = true)
        val report = PdfSecurityInspector(PdfInspectionPolicy(), cleanScanner).inspect(bytes, sha256(bytes))

        assertThat(report.decision).isEqualTo(InspectionDecision.REJECTED)
        assertThat(report.reason).isEqualTo(InspectionReason.ACTIVE_CONTENT)
    }

    @Test
    fun `scanner outage is retryable and never approved`() {
        val bytes = pdf()
        val unavailable = MalwareScanner {
            MalwareScanResult(
                InspectionDecision.RETRYABLE_FAILURE,
                InspectionReason.SCANNER_UNAVAILABLE,
                "ClamAV",
                "1.5.4",
                "unavailable",
            )
        }
        val report = PdfSecurityInspector(PdfInspectionPolicy(), unavailable).inspect(bytes, sha256(bytes))

        assertThat(report.decision).isEqualTo(InspectionDecision.RETRYABLE_FAILURE)
        assertThat(report.reason).isEqualTo(InspectionReason.SCANNER_UNAVAILABLE)
    }

    @Test
    fun `rejects bytes appended after final eof marker`() {
        val bytes = pdf() + "<script>synthetic</script>".toByteArray()
        val report = PdfSecurityInspector(PdfInspectionPolicy(), cleanScanner).inspect(bytes, sha256(bytes))

        assertThat(report.reason).isEqualTo(InspectionReason.TRAILING_DATA)
    }

    @Test
    fun `rejects encrypted pdf without attempting extraction`() {
        val output = ByteArrayOutputStream()
        PDDocument().use { document ->
            document.addPage(PDPage())
            document.protect(StandardProtectionPolicy("owner-test", "user-test", AccessPermission()))
            document.save(output)
        }
        val bytes = output.toByteArray()

        val report = PdfSecurityInspector(PdfInspectionPolicy(), cleanScanner).inspect(bytes, sha256(bytes))

        assertThat(report.decision).isEqualTo(InspectionDecision.REJECTED)
        assertThat(report.reason).isEqualTo(InspectionReason.ENCRYPTED_PDF)
    }

    @Test
    fun `rejects embedded file name trees`() {
        val output = ByteArrayOutputStream()
        PDDocument().use { document ->
            document.addPage(PDPage())
            val embedded = PDEmbeddedFile(document, ByteArrayInputStream("synthetic".toByteArray()))
            val specification = PDComplexFileSpecification()
            specification.file = "synthetic.txt"
            specification.embeddedFile = embedded
            val tree = PDEmbeddedFilesNameTreeNode()
            tree.names = mapOf("synthetic.txt" to specification)
            val names = PDDocumentNameDictionary(document.documentCatalog)
            names.embeddedFiles = tree
            document.documentCatalog.names = names
            document.save(output)
        }
        val bytes = output.toByteArray()

        val report = PdfSecurityInspector(PdfInspectionPolicy(), cleanScanner).inspect(bytes, sha256(bytes))

        assertThat(report.reason).isEqualTo(InspectionReason.EMBEDDED_FILE)
    }

    @Test
    fun `rejects page count above policy`() {
        val bytes = pdf(pageCount = 3)
        val report = PdfSecurityInspector(PdfInspectionPolicy(maxPages = 2), cleanScanner)
            .inspect(bytes, sha256(bytes))

        assertThat(report.reason).isEqualTo(InspectionReason.PAGE_LIMIT_EXCEEDED)
    }

    @Test
    fun `rejects page additional actions, dangerous annotation actions and file attachments`() {
        val pageAa = pdf { _, page -> page.cosObject.setItem(COSName.AA, COSDictionary()) }
        assertThat(inspector.inspect(pageAa, sha256(pageAa)).reason).isEqualTo(InspectionReason.ACTIVE_CONTENT)
        for (subtype in listOf("JavaScript", "Launch", "URI", "GoToR")) {
            val bytes = pdf { _, page ->
                val annotation = PDAnnotationLink()
                val action = COSDictionary().apply { setName(COSName.S, subtype) }
                annotation.cosObject.setItem(COSName.A, action)
                page.annotations = listOf(annotation)
            }
            assertThat(inspector.inspect(bytes, sha256(bytes)).reason)
                .describedAs(subtype)
                .isEqualTo(InspectionReason.ACTIVE_CONTENT)
        }
        val attachment = pdf { _, page -> page.annotations = listOf(PDAnnotationFileAttachment()) }
        assertThat(inspector.inspect(attachment, sha256(attachment)).reason).isEqualTo(InspectionReason.EMBEDDED_FILE)
    }

    @Test
    fun `rejects XFA and encrypted documents even with an empty user password`() {
        val xfa = pdf { document, _ ->
            document.documentCatalog.acroForm = PDAcroForm(document).also { it.cosObject.setItem(COSName.XFA, COSStream()) }
        }
        assertThat(inspector.inspect(xfa, sha256(xfa)).reason).isEqualTo(InspectionReason.XFA_FORM)
        val encrypted = pdf(encryptWithEmptyUserPassword = true) { _, _ -> }
        assertThat(inspector.inspect(encrypted, sha256(encrypted)).reason).isEqualTo(InspectionReason.ENCRYPTED_PDF)
    }

    @Test
    fun `sums image pixels through nested form xobjects, patterns and inline images with a depth limit`() {
        val nested = pdf { document, page ->
            val image = LosslessFactory.createFromImage(document, BufferedImage(2000, 2000, BufferedImage.TYPE_INT_RGB))
            val form = PDFormXObject(document).apply {
                bBox = PDRectangle(0f, 0f, 10f, 10f)
                resources = PDResources().also { it.put(COSName.getPDFName("Im0"), image) }
            }
            form.resources.put(COSName.getPDFName("Self"), form)
            page.resources = PDResources().also { it.put(COSName.getPDFName("Fx0"), form) }
            PDPageContentStream(document, page).use { it.drawForm(form) }
        }
        val report = inspector.inspect(nested, sha256(nested))
        assertThat(report.totalImagePixels).isEqualTo(4_000_000L)

        val inline = pdf { document, page ->
            PDPageContentStream(document, page).use { stream ->
                val parameters = COSDictionary().apply {
                    setInt(COSName.W, 300)
                    setInt(COSName.H, 200)
                    setInt(COSName.BPC, 8)
                    setName(COSName.CS, "RGB")
                }
                stream.drawImage(PDInlineImage(parameters, ByteArray(300 * 200 * 3), page.resources), 0f, 0f)
            }
        }
        assertThat(inspector.inspect(inline, sha256(inline)).totalImagePixels).isEqualTo(60_000L)
    }

    @Test
    fun `stops counting images below the nesting depth cap`() {
        val deep = pdf { document, page ->
            val image = LosslessFactory.createFromImage(document, BufferedImage(2000, 2000, BufferedImage.TYPE_INT_RGB))
            val inner = PDFormXObject(document).apply {
                bBox = PDRectangle(0f, 0f, 10f, 10f)
                resources = PDResources().also { it.put(COSName.getPDFName("Im0"), image) }
            }
            val outer = PDFormXObject(document).apply {
                bBox = PDRectangle(0f, 0f, 10f, 10f)
                resources = PDResources().also { it.put(COSName.getPDFName("Fx1"), inner) }
            }
            page.resources = PDResources().also { it.put(COSName.getPDFName("Fx0"), outer) }
        }
        assertThat(PdfSecurityInspector(PdfInspectionPolicy(), cleanScanner).inspect(deep, sha256(deep)).totalImagePixels)
            .isEqualTo(4_000_000L)
        assertThat(
            PdfSecurityInspector(PdfInspectionPolicy(maxNestingDepth = 1), cleanScanner)
                .inspect(deep, sha256(deep)).totalImagePixels,
        ).isEqualTo(0L)
    }

    @Test
    fun `trailing-data detection is linear and still accepts whitespace after EOF`() {
        val big = ByteArray(9_000_000) { ' '.code.toByte() }
        val ok = "%PDF-1.7\n%%EOF\n".toByteArray() + big
        val started = System.nanoTime()
        inspector.inspect(ok, sha256(ok))
        assertThat(java.time.Duration.ofNanos(System.nanoTime() - started)).isLessThan(java.time.Duration.ofSeconds(2))
        val bad = ("%PDF-1.7\n" + " ".repeat(64) + "%%EOF\nX").toByteArray()
        assertThat(inspector.inspect(bad, sha256(bad)).reason).isEqualTo(InspectionReason.TRAILING_DATA)
    }

    private fun pdf(
        encryptWithEmptyUserPassword: Boolean = false,
        block: (PDDocument, PDPage) -> Unit,
    ): ByteArray {
        val output = ByteArrayOutputStream()
        PDDocument().use { document ->
            val page = PDPage()
            document.addPage(page)
            block(document, page)
            if (encryptWithEmptyUserPassword) {
                document.protect(StandardProtectionPolicy("owner-synthetic", "", AccessPermission()))
            }
            document.save(output)
        }
        return output.toByteArray()
    }

    private fun pdf(withOpenAction: Boolean = false, pageCount: Int = 1): ByteArray {
        val output = ByteArrayOutputStream()
        PDDocument().use { document ->
            repeat(pageCount) { document.addPage(PDPage()) }
            if (withOpenAction) {
                document.documentCatalog.openAction = org.apache.pdfbox.pdmodel.interactive.action.PDActionJavaScript(
                    "app.alert('synthetic')",
                )
            }
            document.save(output)
        }
        return output.toByteArray()
    }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes)
            .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
}
