package kr.co.genomecompanion.benchmark

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import javax.imageio.ImageIO


class PageRendererTest {
    private val font: Path = BenchmarkFont.path()

    @Test
    fun `renders one 150 dpi PNG per page named by document id and page number`(@TempDir corpus: Path, @TempDir out: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        CorpusWriter.write(CheckupCorpusGenerator(font).generateAll(), corpus)

        val pages = PageRenderer.render(corpus, out)

        // 31 documents; the twelve two-page documents (two-page × 6, extended-panel × 6) each contribute a second page.
        assertThat(pages).hasSize(43)
        assertThat(pages.map { it.fileName.toString() }).contains("synthetic-nhis-table-v0-p1.png", "synthetic-two-page-v0-p2.png", "synthetic-hospital-two-column-v6-p1.png")
        assertThat(pages.map { it.fileName.toString() }).doesNotContain("synthetic-nhis-table-v0-p2.png")
        val image = ImageIO.read(out.resolve("synthetic-two-page-v0-p2.png").toFile())
        assertThat(image.width).isEqualTo(1240)
        // A4 (595.276pt x 841.89pt) at 150 dpi: PDFBox 3.0.8's PDFRenderer truncates rather than
        // rounds (841.89 * 150 / 72 = 1753.94px), so the deterministic output height is 1753, not
        // the rounded 1754.
        assertThat(image.height).isEqualTo(1753)
    }
}
