package kr.co.genomecompanion.benchmark

import com.fasterxml.jackson.databind.JsonNode
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDDocumentInformation
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.common.PDRectangle
import org.apache.pdfbox.pdmodel.font.PDFont
import org.apache.pdfbox.pdmodel.font.PDType0Font
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory
import org.apache.pdfbox.pdmodel.graphics.state.RenderingMode
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path

data class HandLabelledDocument(val documentId: String, val documentSha256: String, val expected: JsonNode)
data class HandLabelledCorpus(val corpusId: String, val documents: List<HandLabelledDocument>)

/**
 * Layout-faithful synthetic fixtures (founder decision 3, 2026-09-18): the STRUCTURE of common
 * Korean check-up sheets, drawn in code with synthetic content only. Expectations live in
 * fixtures/hand-labelled/<id>/expected.json and are typed by hand — never generated here.
 */
object HandLabelledFixtures {
    const val CORPUS_ID_PREFIX = "synthetic-ko-hand-labelled-"
    val ids = listOf("synthetic-hand-nhis-notice", "synthetic-hand-hospital-four-column", "synthetic-hand-scan-with-invisible-text")
    private val fixturesRoot: Path = Path.of(
        System.getProperty("gc.handLabelledRoot") ?: System.getenv("GC_HAND_LABELLED_ROOT") ?: "fixtures/hand-labelled",
    )

    fun expectation(id: String): JsonNode = BenchmarkJson.mapper.readTree(fixturesRoot.resolve(id).resolve("expected.json").toFile())

    fun draw(id: String, font: Path): ByteArray = when (id) {
        "synthetic-hand-nhis-notice" -> nhisNotice(font)
        "synthetic-hand-hospital-four-column" -> hospitalFourColumn(font)
        "synthetic-hand-scan-with-invisible-text" -> scanWithInvisibleText(font)
        else -> error("unknown fixture $id")
    }

    fun writeAll(out: Path, font: Path): HandLabelledCorpus {
        Files.createDirectories(out)
        val documents = ids.map { id ->
            val bytes = draw(id, font)
            Files.write(out.resolve("$id.pdf"), bytes)
            HandLabelledDocument(id, "sha256:" + BenchmarkJson.sha256(bytes), expectation(id))
        }
        val corpus = HandLabelledCorpus(
            corpusId = CORPUS_ID_PREFIX + BenchmarkJson.sha256(documents.joinToString("\n") { "${it.documentId} ${it.documentSha256}" }).take(16),
            documents = documents,
        )
        BenchmarkJson.mapper.writerWithDefaultPrettyPrinter().writeValue(out.resolve("hand-labelled.json").toFile(), corpus)
        return corpus
    }

    private fun pinned(): PDDocument = PDDocument().apply {
        documentId = CheckupCorpusGenerator.FIXED_DOCUMENT_ID
        documentInformation = PDDocumentInformation().apply {
            producer = "korean-checkup-benchmark hand-labelled"
            creationDate = CheckupCorpusGenerator.fixedTimestamp()
            modificationDate = CheckupCorpusGenerator.fixedTimestamp()
        }
    }

    private fun save(document: PDDocument): ByteArray {
        val raw = ByteArrayOutputStream().also { document.save(it) }.toByteArray()
        // Insert the synthetic marker comment right after the header line, as the browser fixture does.
        val header = "%PDF-1.7\n".toByteArray(Charsets.ISO_8859_1)
        val marker = "%GC-SYNTHETIC-ONLY\n".toByteArray(Charsets.ISO_8859_1)
        val newline = raw.indexOf(header.last())
        return raw.copyOfRange(0, newline + 1) + marker + raw.copyOfRange(newline + 1, raw.size)
    }

    private class Sheet(private val document: PDDocument, val font: PDFont) {
        var page: PDPage = PDPage(PDRectangle.A4).also { document.addPage(it) }
        var stream = PDPageContentStream(document, page)
        var cursor = page.mediaBox.height - 56f

        fun text(columns: List<Pair<Float, String>>, size: Float = 10.5f, mode: RenderingMode = RenderingMode.FILL) {
            columns.forEach { (x, value) ->
                stream.beginText(); stream.setFont(font, size); stream.setRenderingMode(mode)
                stream.newLineAtOffset(x, cursor); stream.showText(value); stream.endText()
            }
            cursor -= 20f
        }

        fun rule() { stream.setStrokingColor(Color.GRAY); stream.moveTo(48f, cursor + 6f); stream.lineTo(page.mediaBox.width - 48f, cursor + 6f); stream.stroke() }

        fun newPage() {
            stream.close()
            page = PDPage(PDRectangle.A4).also { document.addPage(it) }
            stream = PDPageContentStream(document, page)
            cursor = page.mediaBox.height - 56f
        }

        fun close() = stream.close()
    }

    /** 공단 일반검진 결과통보서형: header date, 2-column body (this time / previous), 판정 column, sections, footer date. */
    private fun nhisNotice(font: Path): ByteArray = pinned().use { document ->
        val sheet = Sheet(document, PDType0Font.load(document, font.toFile()))
        sheet.text(listOf(48f to "일반건강검진 결과통보서 (예시 · 합성)"), 14f)
        sheet.text(listOf(48f to "검진기관 예시 건강검진기관", 330f to "검진일 2026년 5월 12일"))
        sheet.text(listOf(48f to "주소 서울특별시 합성 주소"))
        sheet.rule()
        sheet.text(listOf(48f to "[신체계측]"))
        sheet.text(listOf(48f to "항목", 200f to "이번 결과", 330f to "이전 결과", 460f to "판정"))
        sheet.text(listOf(48f to "신장", 200f to "171.2 cm", 330f to "170.9 cm"))
        sheet.text(listOf(48f to "체중", 200f to "66.4 kg", 330f to "67.0 kg"))
        sheet.text(listOf(48f to "혈압", 200f to "118/76 mmHg", 330f to "121/79 mmHg"))
        sheet.text(listOf(48f to "[혈액검사]"))
        sheet.text(listOf(48f to "혈색소", 200f to "14.1 g/dL", 330f to "14.3 g/dL"))
        sheet.text(listOf(48f to "공복혈당", 200f to "94 mg/dL", 330f to "97 mg/dL"))
        sheet.text(listOf(48f to "총콜레스테롤", 200f to "183 mg/dL", 330f to "179 mg/dL"))
        sheet.text(listOf(48f to "크레아티닌", 200f to "0.9 mg/dL"))
        sheet.text(listOf(48f to "[소변검사]"))
        sheet.text(listOf(48f to "요단백", 200f to "음성", 330f to "음성"))
        sheet.rule()
        sheet.text(listOf(48f to "발행일 2026-05-19", 330f to "예시 건강검진기관 · 합성 문서"), 9f)
        sheet.close()
        save(document)
    }

    /** 병원 종합검진형: 항목·결과·단위·참고치, a label at the page bottom continued on page 2, `<` value, glued unit. */
    private fun hospitalFourColumn(font: Path): ByteArray = pinned().use { document ->
        val sheet = Sheet(document, PDType0Font.load(document, font.toFile()))
        sheet.text(listOf(48f to "종합검진 결과표 (예시 · 합성)"), 14f)
        sheet.text(listOf(48f to "Report Date: 2026-06-20", 330f to "검사일: 2026-06-18"))
        sheet.rule()
        sheet.text(listOf(48f to "항목", 260f to "결과", 340f to "단위", 420f to "참고치"))
        sheet.text(listOf(48f to "AST", 260f to "23", 340f to "U/L", 420f to "0-40"))
        sheet.text(listOf(48f to "ALT", 260f to "19", 340f to "U/L", 420f to "0-41"))
        sheet.text(listOf(48f to "HbA1c", 260f to "5.6%", 420f to "4.0-6.0"))
        sheet.text(listOf(48f to "hs-CRP", 260f to "<0.3", 340f to "mg/L", 420f to "0-3"))
        sheet.text(listOf(48f to "총단백", 260f to "7.1", 340f to "g/dL", 420f to "6.4-8.3"))
        sheet.text(listOf(48f to "총빌리루빈"))
        sheet.newPage()
        sheet.text(listOf(260f to "0.8", 340f to "mg/dL", 420f to "0.2-1.2"))
        sheet.text(listOf(48f to "요산", 260f to "5.1", 340f to "mg/dL", 420f to "3.0-7.0"))
        sheet.close()
        save(document)
    }

    /** Scan + invisible OCR layer: a picture of a sheet with render-mode-3 text nobody can see. The parser must abstain. */
    private fun scanWithInvisibleText(font: Path): ByteArray = pinned().use { document ->
        val page = PDPage(PDRectangle.A4).also { document.addPage(it) }
        val image = BufferedImage(1240, 1754, BufferedImage.TYPE_INT_RGB)
        val graphics = image.createGraphics()
        graphics.color = Color.WHITE; graphics.fillRect(0, 0, image.width, image.height)
        graphics.color = Color.DARK_GRAY; graphics.drawString("SYNTHETIC SCAN - NO REAL DATA", 120, 160)
        repeat(10) { row -> graphics.drawRect(120, 260 + row * 90, 1000, 60) }
        graphics.dispose()
        PDPageContentStream(document, page).use { stream ->
            stream.drawImage(LosslessFactory.createFromImage(document, image), 0f, 0f, page.mediaBox.width, page.mediaBox.height)
            val pdfFont = PDType0Font.load(document, font.toFile())
            stream.beginText(); stream.setFont(pdfFont, 10f); stream.setRenderingMode(RenderingMode.NEITHER)
            stream.newLineAtOffset(60f, 700f); stream.showText("검사일 2026-04-02"); stream.endText()
            stream.beginText(); stream.setFont(pdfFont, 10f); stream.setRenderingMode(RenderingMode.NEITHER)
            stream.newLineAtOffset(60f, 680f); stream.showText("혈당 999 mg/dL"); stream.endText()
        }
        save(document)
    }
}
