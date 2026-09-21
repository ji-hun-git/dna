package kr.co.genomecompanion.documentworker

import java.io.ByteArrayOutputStream
import java.nio.file.Path
import java.time.Duration
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference


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
 *
 * The child's environment is cleared and only the few variables a JVM needs in order to start are
 * copied back, so the worker's own secrets — `GC_WORKER_CREDENTIAL` above all — never reach a process
 * that parses attacker-controlled bytes. `JAVA_TOOL_OPTIONS` and `_JAVA_OPTIONS` are deliberately not
 * copied: they would let ambient configuration re-open the heap cap this class exists to impose.
 *
 * The PDF is written to the child on a daemon thread rather than inline, because a child that never
 * drains stdin would otherwise block the worker forever once the pipe buffer filled — before
 * [Process.waitFor] and therefore outside the timeout.
 */
object PageRenderSubprocess {
    private const val RENDER_MAIN = "kr.co.genomecompanion.documentworker.RenderMainKt"
    private const val MAX_PNG_BYTES = 2_097_152
    private const val TIMED_OUT = -1
    private const val UNUSABLE_OUTPUT = -2
    private const val JOIN_MILLIS = 5_000L
    private const val REAP_MILLIS = 5_000L

    /** Everything a JVM needs to start on Windows or Linux, and nothing else. */
    private val PASSTHROUGH_ENVIRONMENT = listOf("PATH", "SystemRoot", "TEMP", "TMP", "TMPDIR")

    internal const val stdinThreadName = "gc-render-stdin"
    internal const val stdoutThreadName = "gc-render-stdout"

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
        val builder = ProcessBuilder(command)
            .redirectErrorStream(false)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
        builder.environment().clear()
        // getenv(name) uses Windows' case-insensitive lookup; getenv()'s Map can contain "Path"
        // rather than "PATH". Keep the allowlist narrow without dropping that OS variable.
        PASSTHROUGH_ENVIRONMENT.forEach { key -> System.getenv(key)?.let { builder.environment()[key] = it } }
        val process = builder.start()

        // The buffer is owned by the reader thread; the parent only reads it after joining that thread,
        // so the write and the read are ordered by Thread.join's happens-before.
        val captured = AtomicReference(ByteArray(0))
        // An Error inside either thread -- OutOfMemoryError or StackOverflowError in *this* JVM -- is
        // not a pipe accident. runCatching would swallow it and the thread would end normally, so the
        // reader would publish a short buffer and render() would return a plausible-looking PNG or a
        // retryable Failed out of a JVM whose heap is already gone. Record the first one and rethrow it
        // from render() after the join, where the worker loop's Exception-only catch lets it halt the
        // process. IOExceptions stay swallowed: a broken pipe is the normal end of a killed child.
        val threadError = AtomicReference<Throwable?>(null)
        val reader = Thread({
            val buffer = ByteArrayOutputStream()
            runCatching { process.inputStream.use { buffer.write(it.readNBytes(MAX_PNG_BYTES + 1)) } }
                .onFailure { if (it is Error) threadError.compareAndSet(null, it) }
            captured.set(buffer.toByteArray())
        }, stdoutThreadName).also { it.isDaemon = true; it.start() }
        val writer = Thread({
            runCatching { process.outputStream.use { it.write(pdf) } }
                .onFailure { if (it is Error) threadError.compareAndSet(null, it) }
        }, stdinThreadName).also { it.isDaemon = true; it.start() }

        try {
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                return RenderResult.Failed(TIMED_OUT)
            }
            writer.join(JOIN_MILLIS)
            reader.join(JOIN_MILLIS)
            val output = if (reader.isAlive) ByteArray(0) else captured.get()
            val exitCode = process.exitValue()
            return when {
                exitCode == 0 && output.size in 67..MAX_PNG_BYTES -> RenderResult.Png(output)
                exitCode == 0 -> RenderResult.Failed(UNUSABLE_OUTPUT)
                // The child's own handler and HotSpot's -XX:+ExitOnOutOfMemoryError both exit with 3.
                exitCode == 3 -> RenderResult.OutOfMemory
                else -> RenderResult.Failed(exitCode)
            }
        } catch (interrupted: InterruptedException) {
            Thread.currentThread().interrupt()
            throw interrupted
        } finally {
            // Cancellation can interrupt waitFor or join, not just expire the render timeout.
            // Every exit owns the child cleanup; otherwise an interrupted worker abandons a JVM
            // that can retain document bytes and keep both pipe threads blocked.
            stopAndJoin(process, writer, reader)
            threadError.get()?.let { throw it }
        }
    }

    private fun stopAndJoin(process: Process, writer: Thread, reader: Thread) {
        var interrupted = Thread.interrupted()
        val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(REAP_MILLIS + 2 * JOIN_MILLIS)
        fun await(alive: () -> Boolean, wait: (Long) -> Unit) {
            while (alive()) {
                val remaining = deadline - System.nanoTime()
                if (remaining <= 0) return
                try {
                    wait(remaining)
                } catch (_: InterruptedException) {
                    // Repeated cancellation must neither skip cleanup nor extend its deadline.
                    interrupted = true
                }
            }
        }
        try {
            if (process.isAlive) process.destroyForcibly()
            await({ process.isAlive }) { process.waitFor(it, TimeUnit.NANOSECONDS) }
            await({ writer.isAlive }) { TimeUnit.NANOSECONDS.timedJoin(writer, it) }
            await({ reader.isAlive }) { TimeUnit.NANOSECONDS.timedJoin(reader, it) }
        } finally {
            if (interrupted) Thread.currentThread().interrupt()
        }
    }
}
