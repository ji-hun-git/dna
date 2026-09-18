package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration


class PageRenderSubprocessTest {
    @Test
    fun `renders the first page in a child JVM and reports OOM as a distinct result`() {
        val png = PageRenderSubprocess.render(SyntheticResultPdf.july)
        assertThat(png).isInstanceOfSatisfying(RenderResult.Png::class.java) {
            assertThat(it.bytes.take(8))
                .containsExactly(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
        }
        // 16 MB of heap cannot hold a 110-dpi A4 RGB raster plus PDFBox: the child dies with exit 3, never the parent.
        assertThat(PageRenderSubprocess.render(SyntheticResultPdf.july, maxHeapMb = 16, timeout = Duration.ofSeconds(60)))
            .isEqualTo(RenderResult.OutOfMemory)
    }

    @Test
    fun `a child that never answers is killed at the timeout and a non-zero exit is a retryable failure`() {
        val started = System.nanoTime()
        val timedOut = PageRenderSubprocess.render(
            SyntheticResultPdf.july,
            timeout = Duration.ofSeconds(2),
            entryPoint = "kr.co.genomecompanion.documentworker.SleepingRenderMainKt",
        )
        assertThat(timedOut).isEqualTo(RenderResult.Failed(-1))
        assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofSeconds(45))

        val exited = PageRenderSubprocess.render(
            SyntheticResultPdf.july,
            entryPoint = "kr.co.genomecompanion.documentworker.ExitingRenderMainKt",
        )
        assertThat(exited).isEqualTo(RenderResult.Failed(7))
    }
}
