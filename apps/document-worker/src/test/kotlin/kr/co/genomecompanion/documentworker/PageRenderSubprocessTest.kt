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
        // 8 MB of heap cannot hold a 110-dpi letter-size RGB raster plus PDFBox: the child dies with
        // exit 3, never the parent. 8 MB is the launcher's own floor and a JVM still starts there, so
        // this leaves no room for a lazier renderer to sneak under the cap.
        assertThat(PageRenderSubprocess.render(SyntheticResultPdf.july, maxHeapMb = 8, timeout = Duration.ofSeconds(60)))
            .isEqualTo(RenderResult.OutOfMemory)
    }

    @Test
    fun `a child that never answers is killed at the timeout and a non-zero exit is a retryable failure`() {
        // More than 1 MiB, so the write blocks once the OS pipe buffer fills: if the launcher wrote
        // stdin inline it would hang here forever against a child that never reads.
        val largerThanThePipeBuffer = SyntheticResultPdf.july + ByteArray(1_400_000) { '%'.code.toByte() }
        assertThat(largerThanThePipeBuffer.size).isGreaterThan(1_048_576)

        val started = System.nanoTime()
        val timedOut = PageRenderSubprocess.render(
            largerThanThePipeBuffer,
            timeout = Duration.ofSeconds(2),
            entryPoint = "kr.co.genomecompanion.documentworker.SleepingRenderMainKt",
        )
        val elapsed = Duration.ofNanos(System.nanoTime() - started)
        assertThat(timedOut).isEqualTo(RenderResult.Failed(-1))
        assertThat(elapsed).isLessThan(Duration.ofSeconds(45))
        assertThat(liveLauncherThreads()).isEmpty()

        val exited = PageRenderSubprocess.render(
            SyntheticResultPdf.july,
            entryPoint = "kr.co.genomecompanion.documentworker.ExitingRenderMainKt",
        )
        assertThat(exited).isEqualTo(RenderResult.Failed(7))
        assertThat(liveLauncherThreads()).isEmpty()
    }

    @Test
    fun `the child is given a cleared environment and never sees the worker credential`() {
        // The Gradle test task sets this in the parent (a synthetic value); a child that inherited the
        // parent environment wholesale would see it too.
        assertThat(System.getenv("GC_WORKER_CREDENTIAL")).isNotBlank()

        val probed = PageRenderSubprocess.render(
            SyntheticResultPdf.july,
            entryPoint = "kr.co.genomecompanion.documentworker.EnvProbeRenderMainKt",
        )
        assertThat(probed).isInstanceOf(RenderResult.Png::class.java)
        val childKeys = String((probed as RenderResult.Png).bytes, Charsets.UTF_8)
            .lines()
            .filter { it.isNotBlank() && !it.startsWith("#") }

        assertThat(childKeys).isNotEmpty()
        assertThat(childKeys).noneMatch { it.uppercase().startsWith("GC_") }
        assertThat(childKeys).doesNotContain("GC_WORKER_CREDENTIAL")
        // Ambient JVM options would let the caller's environment re-open the heap cap.
        assertThat(childKeys.map { it.uppercase() }).doesNotContain("JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS")
        // …and the child still started, which it could not have done without a usable PATH.
        assertThat(childKeys.map { it.uppercase() }).contains("PATH")
    }

    private fun liveLauncherThreads(): List<String> {
        val names = setOf(PageRenderSubprocess.stdinThreadName, PageRenderSubprocess.stdoutThreadName)
        return Thread.getAllStackTraces().keys.filter { it.isAlive && it.name in names }.map { it.name }
    }
}
