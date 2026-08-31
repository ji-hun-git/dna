package kr.co.genomecompanion.documentboundary

import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDDocumentNameDictionary
import org.apache.pdfbox.pdmodel.common.filespecification.PDComplexFileSpecification
import org.apache.pdfbox.pdmodel.common.filespecification.PDEmbeddedFile
import org.apache.pdfbox.pdmodel.encryption.AccessPermission
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy
import org.apache.pdfbox.pdmodel.PDEmbeddedFilesNameTreeNode
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
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
