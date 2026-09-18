package kr.co.genomecompanion.documentworker

import org.apache.pdfbox.Loader
import org.apache.pdfbox.rendering.ImageType
import org.apache.pdfbox.rendering.PDFRenderer
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import kotlin.system.exitProcess


/**
 * Child-JVM entry: PDF on stdin, PNG on stdout. Exit 3 = out of memory, 4 = render failure.
 *
 * Nothing derived from the document is ever written to stderr or to a log: the only channel out of
 * this process is the PNG on stdout and the exit code. A hostile page can therefore cost at most one
 * child JVM, bounded by the parent's `-Xmx` and wall-clock timeout.
 */
fun main() {
    val source = System.`in`.readNBytes(10_485_761)
    try {
        val png = Loader.loadPDF(source).use { document ->
            require(document.numberOfPages in 1..20)
            val image = PDFRenderer(document).renderImageWithDPI(0, 110f, ImageType.RGB)
            require(image.width.toLong() * image.height.toLong() <= 20_000_000)
            ByteArrayOutputStream().use { output ->
                check(ImageIO.write(image, "png", output))
                output.toByteArray()
            }
        }
        require(png.size in 67..2_097_152)
        System.out.write(png)
        System.out.flush()
        exitProcess(0)
    } catch (_: OutOfMemoryError) {
        exitProcess(3)
    } catch (_: Throwable) {
        exitProcess(4)
    }
}
