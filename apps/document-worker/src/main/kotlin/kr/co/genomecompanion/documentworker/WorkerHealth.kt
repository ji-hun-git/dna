package kr.co.genomecompanion.documentworker

import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock
import java.time.Duration
import java.time.Instant

data class HealthReport(val ready: Boolean, val code: String)

/**
 * The wall clock one iteration of the poll loop is allowed to take, phase by phase, and the
 * heartbeat bound derived from it.
 *
 * `loop-stalled` has to mean "the loop is wedged", never "this job is long". A legitimate
 * iteration is lease + source fetch + render/inspect + result POST, each with its own timeout,
 * and their sum is the longest an honest iteration can run before every phase has timed out.
 * [DocumentWorker.runOnce] refreshes the heartbeat at every one of those boundaries, so in
 * practice only a single phase ever has to fit inside the bound; the sum plus [MARGIN] is the
 * conservative form of the same bound, and it still trips well inside a supervisor's own
 * readiness grace period.
 *
 * Each HTTP phase can take its connect timeout *and then* its request timeout: `HttpRequest.timeout`
 * is a response timeout that only starts once `HttpClient.connectTimeout` has produced a connection,
 * so a black-holed host costs [CONNECT] before the phase's own budget begins. The formula names that
 * cost rather than hiding it in the margin:
 *
 * MAX_HEARTBEAT_AGE = (LEASE + CONNECT) + (SOURCE + CONNECT) + PROCESS + (RESULT + CONNECT) + MARGIN
 *                   = (10 + 5) + (20 + 5) + 60 + (20 + 5) + 30 = 155 s
 *
 * Each constant mirrors the timeout actually configured at that phase: `BoundaryApiClient`'s client
 * connect timeout (5 s), `BoundaryApiClient.lease` (10 s), `BoundaryApiClient.source` (20 s),
 * `PageRenderSubprocess.render`'s default wall clock (60 s, which also covers `ClamAvCommandScanner`'s
 * shorter 30 s scan, and which has no connect phase because it is a subprocess), and the result POST
 * (20 s). Change a timeout there and change it here.
 */
object WorkerLoopBudget {
    /** `BoundaryApiClient`'s HttpClient connect timeout, paid once by every HTTP phase before its own timeout starts. */
    val CONNECT: Duration = Duration.ofSeconds(5)

    val LEASE: Duration = Duration.ofSeconds(10)
    val SOURCE: Duration = Duration.ofSeconds(20)
    val PROCESS: Duration = Duration.ofSeconds(60)
    val RESULT: Duration = Duration.ofSeconds(20)

    /** Room for process scheduling, GC pauses and the health poll interval itself. */
    val MARGIN: Duration = Duration.ofSeconds(30)

    val MAX_HEARTBEAT_AGE: Duration =
        (LEASE + CONNECT) + (SOURCE + CONNECT) + PROCESS + (RESULT + CONNECT) + MARGIN
}

/**
 * Which of [WorkerHealth.check]'s phases raised, carried out to the /healthz error boundary.
 *
 * The endpoint answers from a closed code set (Task 19's image-smoke depends on it), so every thrown
 * check collapses to `scan-unavailable` on the wire. That is right for a supervisor and misleading for
 * an operator: a heartbeat clock that raised is not a scanner problem. The phase travels in the log line
 * instead. The cause's *message* never does -- it can quote a signature path or a core URL.
 */
class HealthCheckFailure(val phase: String, override val cause: Throwable) : RuntimeException(phase, cause)

/** Real checks in a fixed order; the first failure names the reason. `signatureDir == null` means the synthetic scanner (tests/e2e only). */
class WorkerHealth(
    private val coreProbe: () -> Boolean,
    private val signatureDir: Path?,
    private val maxSignatureAge: Duration = Duration.ofDays(7),
    private val loopHeartbeat: () -> Instant,
    private val clock: Clock,
    private val maxHeartbeatAge: Duration = WorkerLoopBudget.MAX_HEARTBEAT_AGE,
) {
    fun check(): HealthReport {
        if (!inPhase("core") { runCatching { coreProbe() }.getOrDefault(false) }) {
            return HealthReport(false, "core-unreachable")
        }
        if (signatureDir != null) {
            val failure = inPhase("signatures") {
                val main = firstExisting(signatureDir, "main.cvd", "main.cld")
                val daily = firstExisting(signatureDir, "daily.cvd", "daily.cld")
                when {
                    main == null || daily == null -> "scan-unavailable"
                    else -> {
                        val newest = listOf(main, daily).maxOf { Files.getLastModifiedTime(it).toInstant() }
                        if (Duration.between(newest, Instant.now(clock)) > maxSignatureAge) "signatures-stale" else null
                    }
                }
            }
            if (failure != null) return HealthReport(false, failure)
        }
        val stalled = inPhase("loop") { Duration.between(loopHeartbeat(), Instant.now(clock)) > maxHeartbeatAge }
        if (stalled) return HealthReport(false, "loop-stalled")
        return HealthReport(true, "ready")
    }

    /** Names the phase a raising check was in, so the endpoint's single `scan-unavailable` code is still diagnosable. */
    private fun <T> inPhase(phase: String, body: () -> T): T =
        try {
            body()
        } catch (failure: HealthCheckFailure) {
            throw failure
        } catch (exception: Exception) {
            throw HealthCheckFailure(phase, exception)
        }

    private fun firstExisting(dir: Path, vararg names: String): Path? = names.map(dir::resolve).firstOrNull { Files.isRegularFile(it) }
}
