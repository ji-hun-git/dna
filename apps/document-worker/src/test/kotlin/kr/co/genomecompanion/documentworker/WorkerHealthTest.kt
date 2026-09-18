package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.net.ServerSocket
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.FileTime
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset


class WorkerHealthTest {
    private val now = Instant.parse("2026-09-18T10:00:00Z")
    private val clock = Clock.fixed(now, ZoneOffset.UTC)

    @Test
    fun `reports the first failing check in order and ready when all pass`(@TempDir signatures: Path) {
        var core = false
        var heartbeat = now.minusSeconds(600)
        val health = WorkerHealth(coreProbe = { core }, signatureDir = signatures, loopHeartbeat = { heartbeat }, clock = clock)
        assertThat(health.check()).isEqualTo(HealthReport(false, "core-unreachable"))
        core = true
        assertThat(health.check()).isEqualTo(HealthReport(false, "scan-unavailable"))
        Files.writeString(signatures.resolve("main.cvd"), "x"); Files.writeString(signatures.resolve("daily.cld"), "x")
        Files.setLastModifiedTime(signatures.resolve("daily.cld"), FileTime.from(now.minus(Duration.ofDays(8))))
        Files.setLastModifiedTime(signatures.resolve("main.cvd"), FileTime.from(now.minus(Duration.ofDays(30))))
        assertThat(health.check()).isEqualTo(HealthReport(false, "signatures-stale"))
        Files.setLastModifiedTime(signatures.resolve("daily.cld"), FileTime.from(now.minus(Duration.ofDays(1))))
        assertThat(health.check()).isEqualTo(HealthReport(false, "loop-stalled"))
        heartbeat = now.minusSeconds(5)
        assertThat(health.check()).isEqualTo(HealthReport(true, "ready"))
    }

    @Test
    fun `a synthetic-scanner worker without a signature directory skips the signature checks`() {
        val health = WorkerHealth(coreProbe = { true }, signatureDir = null, loopHeartbeat = { now }, clock = clock)
        assertThat(health.check()).isEqualTo(HealthReport(true, "ready"))
    }

    /**
     * A long job is not a stalled loop. One iteration can legitimately spend lease + source + render +
     * result POST, and the bound is that sum plus a margin, so a job still inside its own timeouts stays
     * ready while a loop that has genuinely stopped ticking does not.
     */
    @Test
    fun `the heartbeat bound clears a legitimately long job and still trips on a stalled loop`() {
        val bound = WorkerLoopBudget.MAX_HEARTBEAT_AGE
        val phases = WorkerLoopBudget.LEASE + WorkerLoopBudget.SOURCE + WorkerLoopBudget.PROCESS + WorkerLoopBudget.RESULT
        // Each of the three HTTP phases can also spend a full connect timeout before its own request
        // timeout starts, so the honest worst case is 125 s and the bound has to clear that, not 105 s.
        val connects = WorkerLoopBudget.CONNECT.multipliedBy(3)
        assertThat(bound)
            .isEqualTo(Duration.ofSeconds(155))
            .isGreaterThan(phases + connects)
        assertThat(phases + connects).isEqualTo(Duration.ofSeconds(125))

        var heartbeat = now.minus(bound).plusSeconds(1)
        val health = WorkerHealth(coreProbe = { true }, signatureDir = null, loopHeartbeat = { heartbeat }, clock = clock)
        assertThat(health.check()).isEqualTo(HealthReport(true, "ready"))

        heartbeat = now.minus(bound).minusSeconds(1)
        assertThat(health.check()).isEqualTo(HealthReport(false, "loop-stalled"))
    }

    /**
     * The probe's own client, not the job client's 5 s connect timeout: a core that accepts the
     * connection and then says nothing has to be answered `core-unreachable` inside the readiness poll
     * that asked, or probes queue behind each other.
     */
    @Test
    fun `a core that accepts and never answers is core-unreachable within three seconds`() {
        ServerSocket(0, 1, java.net.InetAddress.getLoopbackAddress()).use { blackHole ->
            val configuration = WorkerConfiguration(
                apiBaseUri = URI.create("http://127.0.0.1:${blackHole.localPort}"),
                credential = "synthetic-worker-credential-value-0001",
                workerId = "worker-test",
                clamscanPath = null,
                requiredClamAvVersion = "1.5.4",
                allowSyntheticScanner = true,
                workerImageDigest = "a".repeat(64),
                failFirstExtraction = false,
                healthPort = null,
            )
            val health = WorkerHealth(
                coreProbe = BoundaryApiClient(configuration)::probe,
                signatureDir = null,
                loopHeartbeat = { now },
                clock = clock,
            )
            val startedAt = System.nanoTime()
            assertThat(health.check()).isEqualTo(HealthReport(false, "core-unreachable"))
            assertThat(Duration.ofNanos(System.nanoTime() - startedAt)).isLessThan(Duration.ofSeconds(3))
        }
    }

    /**
     * Fail closed: a check that throws is "not ready", never a 500 a supervisor could read as a blip.
     * The wire code stays in the closed set Task 19 matches on, so the *phase* has to reach the operator
     * through the log line instead -- `scan-unavailable` for a raising heartbeat clock would send them to
     * the wrong subsystem.
     */
    @Test
    fun `the health endpoint answers 503 scan-unavailable and logs the failing phase when the check throws`() {
        val failure = HealthCheckFailure("signatures", java.nio.file.NoSuchFileException("signature"))
        // Port 0: the OS picks, and the server keeps it. Reserving one with ServerSocket(0) and rebinding
        // leaves a window in which CI can hand the same port to something else.
        val server = startLoopbackHealthServer(0) { throw failure }
        val port = server.address.port
        val captured = java.io.ByteArrayOutputStream()
        val realOut = System.out
        try {
            System.setOut(java.io.PrintStream(captured, true, Charsets.UTF_8))
            val response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://127.0.0.1:$port/healthz"))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build(),
                HttpResponse.BodyHandlers.ofString(),
            )
            System.setOut(realOut)
            assertThat(port).isGreaterThan(0)
            assertThat(response.statusCode()).isEqualTo(503)
            assertThat(response.body()).isEqualTo("scan-unavailable")
            assertThat(response.headers().firstValue("Cache-Control")).hasValue("no-store")
            assertThat(captured.toString(Charsets.UTF_8))
                .contains("event=health_check_error job_id=none code=signatures_nosuchfileexception")
        } finally {
            System.setOut(realOut)
            server.stop(0)
        }
    }

    /** The phase marker is set where the check raises, not guessed at the boundary. */
    @Test
    fun `a check that raises is reported with the phase it raised in`() {
        val health = WorkerHealth(
            coreProbe = { true },
            signatureDir = null,
            loopHeartbeat = { throw IllegalStateException("clock") },
            clock = clock,
        )
        val thrown = org.junit.jupiter.api.assertThrows<HealthCheckFailure> { health.check() }
        assertThat(thrown.phase).isEqualTo("loop")
        assertThat(healthCheckErrorCode(thrown)).isEqualTo("loop_illegalstateexception")
    }

    /**
     * A fatal Error in the loop thread has to end the process, and rethrowing out of `main` does not:
     * HttpServer's HTTP-Dispatcher thread is non-daemon (it inherits that from `main`), so the JVM stays
     * up with a dead loop. Tested through the exit seam rather than by forking a JVM.
     */
    @Test
    fun `a fatal loop error stops the health server and halts with exit code 1`() {
        val server = startLoopbackHealthServer(0) { HealthReport(true, "ready") }
        val port = server.address.port
        val exits = mutableListOf<Int>()
        val trace = java.io.ByteArrayOutputStream()
        haltOnFatalLoopError(
            OutOfMemoryError("synthetic"),
            server,
            java.io.PrintStream(trace, true, Charsets.UTF_8),
        ) { exits.add(it) }

        assertThat(exits).containsExactly(1)
        assertThat(trace.toString(Charsets.UTF_8)).contains("OutOfMemoryError")
        // stop(0) really unbound the port, so nothing is left listening once we halt.
        assertThat(runCatching { ServerSocket(port, 1, java.net.InetAddress.getLoopbackAddress()).close() }.isSuccess)
            .isTrue()
    }

    /** A null health server (GC_WORKER_HEALTH_PORT unset) must not stop the halt. */
    @Test
    fun `a fatal loop error halts even when no health server was started`() {
        val exits = mutableListOf<Int>()
        haltOnFatalLoopError(
            StackOverflowError(),
            null,
            java.io.PrintStream(java.io.ByteArrayOutputStream(), true, Charsets.UTF_8),
        ) { exits.add(it) }
        assertThat(exits).containsExactly(1)
    }
}
