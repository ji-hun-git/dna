package kr.co.genomecompanion.documentworker

import java.io.ByteArrayOutputStream
import java.nio.file.Path
import java.time.Duration
import java.util.concurrent.TimeUnit


sealed interface RenderResult {
    data class Png(val bytes: ByteArray) : RenderResult {
        override fun equals(other: Any?): Boolean = this === other || (other is Png && bytes.contentEquals(other.bytes))

        override fun hashCode(): Int = bytes.contentHashCode()
    }

    data object OutOfMemory : RenderResult

    data class Failed(val exitCode: Int) : RenderResult
}


/**
 * Renders the first page in a child JVM with a hard `-Xmx` and a wall-clock timeout, so a hostile
 * page can only exhaust the child. The child runs the same JVM and the same classpath as this
 * process; its stderr is discarded rather than captured, and its stdout is read into a buffer capped
 * at the preview size limit, so neither document bytes nor parser messages can reach a log or grow
 * the worker's heap. A timeout is resolved with [Process.destroyForcibly].
 */
object PageRenderSubprocess {
    private const val RENDER_MAIN = "kr.co.genomecompanion.documentworker.RenderMainKt"
    private const val MAX_PNG_BYTES = 2_097_152
    private const val TIMED_OUT = -1
    private const val UNUSABLE_OUTPUT = -2

    fun render(
        pdf: ByteArray,
        maxHeapMb: Int = 384,
        timeout: Duration = Duration.ofSeconds(60),
        entryPoint: String = RENDER_MAIN,
    ): RenderResult {
        require(maxHeapMb in 8..4_096)
        require(timeout.toMillis() in 1_000..600_000)
        val java = Path.of(System.getProperty("java.home"), "bin", "java").toString()
        val command = listOf(
            java,
            "-Xmx${maxHeapMb}m",
            "-XX:+ExitOnOutOfMemoryError",
            "-Djava.awt.headless=true",
            "-cp",
            System.getProperty("java.class.path"),
            entryPoint,
        )
        val process = ProcessBuilder(command)
            .redirectErrorStream(false)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start()
        val output = ByteArrayOutputStream()
        val reader = Thread {
            runCatching { process.inputStream.use { output.write(it.readNBytes(MAX_PNG_BYTES + 1)) } }
        }.also { it.isDaemon = true; it.start() }
        runCatching { process.outputStream.use { it.write(pdf) } }
        if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
            process.destroyForcibly()
            return RenderResult.Failed(TIMED_OUT)
        }
        reader.join(5_000)
        val exitCode = process.exitValue()
        return when {
            exitCode == 0 && output.size() in 67..MAX_PNG_BYTES -> RenderResult.Png(output.toByteArray())
            exitCode == 0 -> RenderResult.Failed(UNUSABLE_OUTPUT)
            // The child's own handler and HotSpot's -XX:+ExitOnOutOfMemoryError both exit with 3.
            exitCode == 3 -> RenderResult.OutOfMemory
            else -> RenderResult.Failed(exitCode)
        }
    }
}
