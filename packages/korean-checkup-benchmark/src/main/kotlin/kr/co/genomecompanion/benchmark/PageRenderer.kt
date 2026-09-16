package kr.co.genomecompanion.benchmark

import com.fasterxml.jackson.module.kotlin.readValue
import org.apache.pdfbox.Loader
import org.apache.pdfbox.rendering.ImageType
import org.apache.pdfbox.rendering.PDFRenderer
import java.nio.file.Files
import java.nio.file.Path
import javax.imageio.ImageIO


/**
 * Rasterizes every page of a generated corpus to PNG so a vision model can be shown the same
 * synthetic documents the parser reads. Output stays under build/; nothing here touches product code.
 */
object PageRenderer {
    const val DPI = 150f

    fun render(corpusDir: Path, out: Path): List<Path> {
        Files.createDirectories(out)
        val index: CorpusIndex = BenchmarkJson.mapper.readValue(corpusDir.resolve("corpus.json").toFile())
        return index.documents.flatMap { document ->
            Loader.loadPDF(corpusDir.resolve("${document.documentId}.pdf").toFile()).use { pdf ->
                val renderer = PDFRenderer(pdf)
                (0 until pdf.numberOfPages).map { pageIndex ->
                    val image = renderer.renderImageWithDPI(pageIndex, DPI, ImageType.RGB)
                    val target = out.resolve("${document.documentId}-p${pageIndex + 1}.png")
                    check(ImageIO.write(image, "png", target.toFile())) { "no PNG writer for $target" }
                    target
                }
            }
        }
    }
}
