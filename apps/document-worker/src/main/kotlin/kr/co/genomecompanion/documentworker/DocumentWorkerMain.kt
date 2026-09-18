package kr.co.genomecompanion.documentworker

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.sun.net.httpserver.HttpServer
import kr.co.genomecompanion.documentboundary.InspectionDecision
import kr.co.genomecompanion.documentboundary.InspectionReason
import kr.co.genomecompanion.documentboundary.InspectionReport
import kr.co.genomecompanion.documentboundary.MalwareScanResult
import kr.co.genomecompanion.documentboundary.MalwareScanner
import kr.co.genomecompanion.documentboundary.PdfSecurityInspector
import kr.co.genomecompanion.documentboundary.PdfInspectionPolicy
import kr.co.genomecompanion.documentboundary.WorkerIdentity
import java.net.URI
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.HexFormat
import java.time.Clock
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference


private const val WORKER_VERSION = "document-worker-v2"
private const val MAX_SOURCE_BYTES = 10_485_760
private const val MAX_RESPONSE_BYTES = 3_000_000

// Mirrors PageRenderSubprocess's own private UNUSABLE_OUTPUT exit code: an exception starting or
// running the render subprocess is not a different failure from an unusable render, it is just an
// earlier place for the same one to happen.
private const val UNUSABLE_RENDER_OUTCOME = -2


data class WorkerConfiguration(
    val apiBaseUri: URI,
    val credential: String,
    val workerId: String,
    val clamscanPath: Path?,
    val requiredClamAvVersion: String,
    val allowSyntheticScanner: Boolean,
    val workerImageDigest: String,
    val failFirstExtraction: Boolean,
    val healthPort: Int?,
    val signatureDir: Path? = null,
) {
    init {
        require(apiBaseUri.userInfo == null && apiBaseUri.query == null && apiBaseUri.fragment == null)
        require(apiBaseUri.path.isNullOrEmpty() || apiBaseUri.path == "/")
        require(apiBaseUri.scheme == "https" || isLoopbackHttp(apiBaseUri))
        require(credential.length in 32..256)
        require(workerId.matches(Regex("^[A-Za-z0-9._:-]{3,80}$")))
        require(workerImageDigest.matches(Regex("^[0-9a-f]{64}$")))
        require(requiredClamAvVersion.matches(Regex("^[0-9]+[.][0-9]+[.][0-9]+$")))
        require(clamscanPath != null || allowSyntheticScanner) {
            "ClamAV path is required unless the explicit local synthetic scanner flag is enabled"
        }
        require(healthPort == null || healthPort in 1024..65535)
    }

    companion object {
        fun fromEnvironment(environment: Map<String, String> = System.getenv()): WorkerConfiguration {
            val clamscanPath = environment["GC_WORKER_CLAMSCAN_PATH"]?.let(Path::of)
            return WorkerConfiguration(
                apiBaseUri = URI.create(environment.getValue("GC_WORKER_API_BASE_URL")),
                credential = environment.getValue("GC_WORKER_CREDENTIAL"),
                workerId = environment.getOrDefault("GC_WORKER_ID", "document-worker-local"),
                clamscanPath = clamscanPath,
                requiredClamAvVersion = environment.getOrDefault("GC_WORKER_CLAMAV_VERSION", "1.5.4"),
                allowSyntheticScanner = environment["GC_WORKER_ALLOW_SYNTHETIC_SCANNER"] == "true",
                workerImageDigest = environment.getValue("GC_WORKER_IMAGE_DIGEST"),
                failFirstExtraction = environment["GC_WORKER_FAIL_FIRST_EXTRACTION"] == "true",
                healthPort = environment["GC_WORKER_HEALTH_PORT"]?.toInt(),
                // Only a real ClamAV worker has signatures to check; with the synthetic scanner there is
                // no signature directory and /healthz skips the signature checks entirely.
                signatureDir = environment["GC_WORKER_SIGNATURE_DIR"]?.let(Path::of)
                    ?: clamscanPath?.let { DEFAULT_SIGNATURE_DIR },
            )
        }

        private val DEFAULT_SIGNATURE_DIR: Path = Path.of("/usr/local/share/clamav")

        private fun isLoopbackHttp(uri: URI): Boolean =
            uri.scheme == "http" && uri.host in setOf("127.0.0.1", "localhost", "::1")
    }
}


data class WorkerLease(
    val jobId: String,
    val jobType: String,
    val attempt: Int,
    val maxAttempts: Int,
    val leaseToken: String,
    val leaseExpiresAt: Instant,
    val sourcePath: String,
    val sourceSha256: String,
    val sourceLength: Long,
    val sourceZone: String,
    val documentStateVersion: Long,
) {
    init {
        require(runCatching { java.util.UUID.fromString(jobId) }.isSuccess)
        require(jobType in setOf("SECURITY_INSPECTION", "SYNTHETIC_EXTRACTION"))
        require(attempt in 1..maxAttempts && maxAttempts in 1..10)
        require(leaseToken.length in 32..256)
        require(sourcePath == "/internal/document-boundary/jobs/$jobId/source")
        require(sourceSha256.matches(Regex("^[0-9a-f]{64}$")))
        require(sourceLength in 64..MAX_SOURCE_BYTES)
        require(sourceZone in setOf("UNTRUSTED", "APPROVED_SOURCE"))
        require(documentStateVersion >= 0)
    }
}


class BoundaryApiClient(
    private val configuration: WorkerConfiguration,
    private val objectMapper: ObjectMapper = configuredObjectMapper(),
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .followRedirects(HttpClient.Redirect.NEVER)
        .build(),
    /**
     * The probe gets its own client so its budget is its own. Sharing the job client meant inheriting a
     * 5 s connect timeout, which a 2 s request timeout cannot shorten when the host is black-holed rather
     * than refusing: the probe then outlived the readiness poll that asked for it and probes queued behind
     * each other. 1 s to connect and 2 s end to end keeps a /healthz answer inside ~3 s in the worst case,
     * and keeps probe traffic out of the connection pool the job requests use.
     */
    private val probeClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(1))
        .followRedirects(HttpClient.Redirect.NEVER)
        .build(),
) {
    /**
     * Liveness of the core API, for /healthz only: no credential, no job state, and a 2 s budget so a
     * health poll cannot hang behind a lease request. A refused connection is an answer ("no"), not a
     * failure, so the transport exception is folded into `false` here.
     */
    fun probe(): Boolean = runCatching {
        val request = HttpRequest.newBuilder(configuration.apiBaseUri.resolve("/actuator/health"))
            .timeout(Duration.ofSeconds(2))
            .GET()
            .build()
        probeClient.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() == 200
    }.getOrDefault(false)

    fun lease(): WorkerLease? {
        val response = send(
            HttpRequest.newBuilder(resolve("/internal/document-boundary/jobs/lease"))
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build(),
        )
        if (response.statusCode() == 204) return null
        requireSuccess(response)
        return objectMapper.readValue(response.body())
    }

    fun source(lease: WorkerLease): ByteArray {
        require(lease.sourcePath == "/internal/document-boundary/jobs/${lease.jobId}/source")
        require(lease.sourceLength in 64..MAX_SOURCE_BYTES)
        val request = authenticatedBuilder(resolve(lease.sourcePath))
            .setHeader("Accept", "application/octet-stream")
            .header("X-GC-Job-Lease", lease.leaseToken)
            .timeout(Duration.ofSeconds(20))
            .GET()
            .build()
        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream())
        if (response.statusCode() !in 200..299) error("worker source request failed: ${response.statusCode()}")
        val mediaType = response.headers().firstValue("Content-Type").orElse("")
            .substringBefore(';').trim().lowercase()
        if (mediaType != "application/octet-stream") error("worker source media type mismatch")
        val bytes = response.body().use { it.readNBytes(MAX_SOURCE_BYTES + 1) }
        if (bytes.size > MAX_SOURCE_BYTES || bytes.size.toLong() != lease.sourceLength) {
            error("worker source length mismatch")
        }
        val advertisedDigest = response.headers().firstValue("X-GC-Source-SHA256").orElse("")
        val actualDigest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes))
        if (advertisedDigest != lease.sourceSha256 || actualDigest != lease.sourceSha256) {
            error("worker source digest mismatch")
        }
        return bytes
    }

    fun inspectionResult(lease: WorkerLease, report: InspectionReport) {
        postJson(
            lease,
            "inspection-result",
            mapOf(
                "decision" to report.decision.name,
                "reason" to report.reason.name,
                "sourceSha256" to report.sourceSha256,
                "identifiedMediaType" to report.identifiedMediaType,
                "pageCount" to report.pageCount,
                "indirectObjectCount" to report.indirectObjectCount,
                "totalImagePixels" to report.totalImagePixels,
                "encrypted" to report.encrypted,
                "activeContent" to report.activeContent,
                "embeddedFiles" to report.embeddedFiles,
                "policyVersion" to report.policyVersion,
                "scannerName" to report.scannerName,
                "scannerVersion" to report.scannerVersion,
                "signatureVersion" to report.signatureVersion,
            ),
        )
    }

    fun extractionResult(lease: WorkerLease, preview: ByteArray, outcome: ExtractionOutcome) {
        postJson(
            lease,
            "extraction-result",
            mapOf(
                "sourceSha256" to lease.sourceSha256,
                "workerImageDigest" to configuration.workerImageDigest,
                "generatorVersion" to WORKER_VERSION,
                "extractionMethod" to NativeTextExtractionProvider.METHOD,
                "previewPngBase64" to Base64.getEncoder().encodeToString(preview),
                "candidates" to outcome.candidates.map { candidate ->
                    mapOf(
                        "ordinal" to candidate.ordinal,
                        "label" to candidate.label,
                        "value" to candidate.value,
                        "unit" to candidate.unit,
                        "observedOn" to candidate.observedOn.toString(),
                        "evidencePage" to candidate.evidencePage,
                        "evidenceBox" to mapOf(
                            "x" to candidate.evidenceBox.x,
                            "y" to candidate.evidenceBox.y,
                            "width" to candidate.evidenceBox.width,
                            "height" to candidate.evidenceBox.height,
                        ),
                        "sourceTextSha256" to candidate.sourceTextSha256,
                        "referenceRangeText" to candidate.referenceRangeText,
                        "originalLabel" to candidate.originalLabel,
                    )
                },
                "abstentions" to outcome.abstentions.map { abstention ->
                    mapOf(
                        "label" to abstention.label,
                        "reason" to abstention.reason.code,
                        "evidencePage" to abstention.evidencePage,
                    )
                },
            ),
        )
    }

    fun failure(lease: WorkerLease, code: String, retryable: Boolean) {
        require(code.matches(Regex("^[a-z0-9_]{3,80}$")))
        postJson(lease, "failure", mapOf("code" to code, "retryable" to retryable))
    }

    private fun postJson(lease: WorkerLease, operation: String, body: Any) {
        val path = "/internal/document-boundary/jobs/${lease.jobId}/$operation"
        val request = authenticatedBuilder(resolve(path))
            .header("X-GC-Job-Lease", lease.leaseToken)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(20))
            .POST(HttpRequest.BodyPublishers.ofByteArray(objectMapper.writeValueAsBytes(body)))
            .build()
        requireSuccess(httpClient.send(request, boundedStringBodyHandler()))
    }

    private fun send(request: HttpRequest): HttpResponse<String> =
        httpClient.send(authenticatedCopy(request), boundedStringBodyHandler())

    private fun authenticatedCopy(request: HttpRequest): HttpRequest {
        val builder = authenticatedBuilder(request.uri())
            .timeout(request.timeout().orElse(Duration.ofSeconds(10)))
            .method(request.method(), request.bodyPublisher().orElse(HttpRequest.BodyPublishers.noBody()))
        request.headers().map().forEach { (name, values) -> values.forEach { builder.header(name, it) } }
        return builder.build()
    }

    /** Derived once: the MAC is a pure function of the credential and worker id, both fixed for the
     * process lifetime, and re-deriving it per request would hash the credential on every call. */
    private val workerIdMac: String = WorkerIdentity.mac(configuration.credential, configuration.workerId)

    private fun authenticatedBuilder(uri: URI): HttpRequest.Builder = HttpRequest.newBuilder(uri)
        .header("X-GC-Worker-Credential", configuration.credential)
        .header("X-GC-Worker-Id", configuration.workerId)
        // Proof that this process holds the credential *and* owns the id it claims; core verifies it
        // against the credential digest it stores. See WorkerIdentity for why the digest is the key.
        .header("X-GC-Worker-Id-Mac", workerIdMac)
        .header("Accept", "application/json")

    private fun resolve(path: String): URI {
        require(path.matches(Regex("^/internal/document-boundary/[A-Za-z0-9/_-]+$")))
        val resolved = configuration.apiBaseUri.resolve(path)
        require(resolved.scheme == configuration.apiBaseUri.scheme && resolved.authority == configuration.apiBaseUri.authority)
        return resolved
    }

    private fun requireSuccess(response: HttpResponse<String>) {
        if (response.statusCode() !in 200..299) error("worker API request failed: ${response.statusCode()}")
    }
}


class ClamAvCommandScanner(
    private val executable: Path,
    private val requiredVersion: String,
    private val database: Path? = null,
    private val timeout: Duration = Duration.ofSeconds(30),
) : MalwareScanner {
    override fun scan(bytes: ByteArray): MalwareScanResult {
        if (!Files.isRegularFile(executable)) return unavailable("executable-missing")
        // The image points this at the signature *directory*; clamscan's --database takes either a
        // directory of CVDs or a single database file, so accept both.
        if (database != null && !Files.isRegularFile(database) && !Files.isDirectory(database)) {
            return unavailable("database-missing")
        }
        val version = readVersion() ?: return unavailable("version-unavailable")
        if (version.engine != requiredVersion) return unavailable("version-mismatch")
        val command = mutableListOf(executable.toString(), "--no-summary", "--stdout")
        database?.let { command += "--database=${it.toAbsolutePath().normalize()}" }
        command += "-"
        val process = runCatching {
            ProcessBuilder(command)
                .redirectErrorStream(true)
                .start()
        }.getOrElse { return unavailable("process-start-failed") }
        return try {
            process.outputStream.use { it.write(bytes) }
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly()
                return unavailable("scan-timeout")
            }
            val output = process.inputStream.readNBytes(32_768).toString(StandardCharsets.UTF_8)
            when (process.exitValue()) {
                0 -> MalwareScanResult(
                    InspectionDecision.APPROVED,
                    InspectionReason.CLEAN,
                    "ClamAV",
                    version.engine,
                    version.signatures,
                )
                1 -> MalwareScanResult(
                    InspectionDecision.REJECTED,
                    InspectionReason.MALWARE_DETECTED,
                    "ClamAV",
                    version.engine,
                    version.signatures,
                )
                else -> unavailable("scan-error-${output.length}")
            }
        } finally {
            process.destroy()
        }
    }

    private fun readVersion(): ClamAvVersion? {
        val command = mutableListOf(executable.toString(), "--version")
        database?.let { command += "--database=${it.toAbsolutePath().normalize()}" }
        val process = runCatching {
            ProcessBuilder(command).redirectErrorStream(true).start()
        }.getOrNull() ?: return null
        return try {
            if (!process.waitFor(5, TimeUnit.SECONDS) || process.exitValue() != 0) return null
            val output = process.inputStream.readNBytes(4096).toString(StandardCharsets.UTF_8).trim()
            val match = Regex("^ClamAV ([0-9]+[.][0-9]+[.][0-9]+)(?:/(.+))?$")
                .matchEntire(output.lineSequence().firstOrNull() ?: return null) ?: return null
            val signatureVersion = match.groupValues[2].takeIf(String::isNotBlank)?.take(120)
                ?: database?.let { "sha256:${sha256Database(it)}" }
                ?: return null
            ClamAvVersion(match.groupValues[1], signatureVersion)
        } finally {
            process.destroyForcibly()
        }
    }

    private fun unavailable(signature: String) = MalwareScanResult(
        InspectionDecision.RETRYABLE_FAILURE,
        InspectionReason.SCANNER_UNAVAILABLE,
        "ClamAV",
        "unavailable",
        signature,
    )

    private data class ClamAvVersion(val engine: String, val signatures: String)
}


/**
 * A signature directory has no single digest of its own, so fold its files' digests into one. The
 * fold is over the sorted paths, so the result is the same whatever order the filesystem lists them
 * in; a regular file is just its own digest.
 */
internal fun sha256Database(path: Path): String {
    if (Files.isRegularFile(path)) return sha256File(path)
    val digest = MessageDigest.getInstance("SHA-256")
    Files.list(path).use { entries ->
        entries.filter(Files::isRegularFile).sorted().forEach {
            digest.update(sha256File(it).toByteArray(StandardCharsets.UTF_8))
        }
    }
    return HexFormat.of().formatHex(digest.digest())
}

internal fun sha256File(path: Path): String {
    val digest = MessageDigest.getInstance("SHA-256")
    Files.newInputStream(path).use { input ->
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            digest.update(buffer, 0, read)
        }
    }
    return HexFormat.of().formatHex(digest.digest())
}


class SyntheticManifestScanner : MalwareScanner {
    override fun scan(bytes: ByteArray): MalwareScanResult = MalwareScanResult(
        decision = InspectionDecision.APPROVED,
        reason = InspectionReason.CLEAN,
        scannerName = "SyntheticManifestScanner",
        scannerVersion = "test-only-v1",
        signatureVersion = "allowlisted-digest-only:${bytes.size}",
    )
}


class DocumentWorker(
    private val configuration: WorkerConfiguration,
    private val client: BoundaryApiClient,
    private val inspector: PdfSecurityInspector,
    /**
     * Called at every phase boundary of an iteration. The loop's heartbeat is what /healthz reads to
     * decide `loop-stalled`, and a heartbeat set once per iteration cannot tell a wedged loop from a
     * slow but honest job: lease, fetch, a 60 s render and the result POST legitimately add up past a
     * two-minute bound. Ticking here means a phase that is still making progress keeps the worker
     * ready, while a phase that has genuinely hung still ages the heartbeat out.
     */
    private val heartbeat: () -> Unit = {},
) {
    private val transientFailures = mutableSetOf<String>()

    fun runOnce(): Boolean {
        // An empty lease is the idle case and is not logged: the loop polls once a second, so a line
        // per empty poll would be a line per second of nothing happening.
        val lease = client.lease() ?: return false
        heartbeat()
        WorkerLog.emit("job_leased", lease.jobId)
        val source = client.source(lease)
        heartbeat()
        when (lease.jobType) {
            "SECURITY_INSPECTION" -> {
                val report = inspector.inspect(source, lease.sourceSha256)
                heartbeat()
                client.inspectionResult(lease, report)
                heartbeat()
                WorkerLog.emit("job_completed", lease.jobId)
            }
            "SYNTHETIC_EXTRACTION" -> {
                if (configuration.failFirstExtraction && transientFailures.add(lease.jobId)) {
                    client.failure(lease, "simulated_transient_preview_failure", retryable = true)
                    WorkerLog.emit("job_failed", lease.jobId, "simulated_transient_preview_failure")
                } else {
                    // Rendering is the one step that runs attacker-shaped bytes through a decoder, so it
                    // runs in a child JVM: a page that exhausts the heap costs that child, not the worker.
                    // Starting that child JVM can itself throw (e.g. an IOException from
                    // ProcessBuilder.start()) before render() ever returns a RenderResult; without this
                    // catch that exception would escape runOnce, and the caller's own runCatching around
                    // runOnce() would swallow it silently -- the job posts no failure and just sits until
                    // its lease expires. Route it to the same retryable outcome as the subprocess's own
                    // unusable-output failure (class-only, no message content, to keep the same content
                    // discipline as PageRenderSubprocess itself).
                    val rendered = runCatching { PageRenderSubprocess.render(source) }
                        .getOrElse { RenderResult.Failed(UNUSABLE_RENDER_OUTCOME) }
                    heartbeat()
                    when (rendered) {
                        is RenderResult.Png -> {
                            client.extractionResult(lease, rendered.bytes, NativeTextExtractionProvider.extract(source))
                            heartbeat()
                            WorkerLog.emit("job_completed", lease.jobId)
                        }
                        RenderResult.OutOfMemory -> {
                            client.failure(lease, "render_error", retryable = false)
                            WorkerLog.emit("job_failed", lease.jobId, "render_error")
                        }
                        is RenderResult.Failed -> {
                            client.failure(lease, "preview_generation_failed", retryable = true)
                            WorkerLog.emit("job_failed", lease.jobId, "preview_generation_failed")
                        }
                    }
                }
            }
            else -> {
                client.failure(lease, "unsupported_job_type", retryable = false)
                WorkerLog.emit("job_failed", lease.jobId, "unsupported_job_type")
            }
        }
        return true
    }
}


fun main(args: Array<String>) {
    val configuration = WorkerConfiguration.fromEnvironment()
    val scanner = configuration.clamscanPath
        ?.let { ClamAvCommandScanner(it, configuration.requiredClamAvVersion, configuration.signatureDir) }
        ?: SyntheticManifestScanner()
    val client = BoundaryApiClient(configuration)
    val heartbeat = AtomicReference(Instant.now())
    val worker = DocumentWorker(
        configuration,
        client,
        PdfSecurityInspector(policy = PdfInspectionPolicy(), malwareScanner = scanner),
        heartbeat = { heartbeat.set(Instant.now()) },
    )
    val health = WorkerHealth(
        coreProbe = client::probe,
        signatureDir = configuration.signatureDir,
        loopHeartbeat = heartbeat::get,
        clock = Clock.systemUTC(),
    )
    configuration.healthPort?.let { startLoopbackHealthServer(it, health::check) }
    if (args.contains("--once")) {
        worker.runOnce()
        return
    }
    val running = AtomicBoolean(true)
    val fatal = AtomicReference<Throwable?>(null)
    // Guards the one window in which an interrupt is welcome. The shutdown hook only interrupts while
    // `sleeping` is true and it holds this lock, so the interrupt can land on the backoff sleep and
    // nowhere else -- never on a leased job's HTTP call, which an interrupt would tear in half.
    val sleepLock = Any()
    var sleeping = false
    val loop = Thread {
        var failures = 0
        while (running.get()) {
            heartbeat.set(Instant.now())
            val processed = try {
                worker.runOnce().also { failures = 0 }
            } catch (exception: Exception) {
                // Exception, never Throwable: an OutOfMemoryError or any other VirtualMachineError has to
                // leave this loop and end the process so the supervisor restarts it with a fresh heap.
                // Catching one would leave a poisoned JVM leasing jobs it can never finish.
                failures += 1
                // The exception's class name only: its message can quote a file name, a URL or a page of a
                // person's document. An anonymous class has an empty simple name, so fall back to a constant
                // rather than letting WorkerLog's own `require` turn a logged loop error into a crash.
                val code = exception.javaClass.simpleName.lowercase().filter { it.isLetterOrDigit() }.take(80)
                WorkerLog.emit("loop_error", null, if (code.length < 3) "unknown_error" else code)
                false
            }
            // Idle polling stays at a second; consecutive errors back off 1, 2, 4 ... 30 s so a core that is
            // down is not asked for work once a second until it comes back. The first failure waits 1 s,
            // not 2: the exponent counts the failures *before* this one.
            if (!processed) {
                val exponent = minOf(maxOf(failures - 1, 0), 5)
                val backoffMillis = minOf(30_000L, 1_000L shl exponent)
                try {
                    synchronized(sleepLock) { sleeping = running.get() }
                    if (sleeping) Thread.sleep(backoffMillis)
                } catch (_: InterruptedException) {
                    // Shutdown, not failure: end the wait now and let the `while (running)` check exit.
                } finally {
                    synchronized(sleepLock) {
                        sleeping = false
                        // Clear a flag set just after the sleep returned, so it cannot reach the next job.
                        Thread.interrupted()
                    }
                }
            }
        }
    }.also {
        it.name = "document-worker-loop"
        // Without this an OutOfMemoryError would be printed and main would still exit 0: a container that
        // has quietly stopped taking work instead of restarting. [haltOnFatalLoopError] makes the exit
        // non-zero, and makes it actually happen.
        it.setUncaughtExceptionHandler { _, throwable -> fatal.set(throwable) }
        it.start()
    }
    // SIGTERM must not tear a leased job in half: stop polling, then let the in-flight iteration finish.
    Runtime.getRuntime().addShutdownHook(
        Thread {
            running.set(false)
            // Without the interrupt SIGTERM waits out a backoff that is already up to 30 s long, which is
            // the whole join budget spent doing nothing. Interrupting only while the loop is inside its
            // sleep keeps an in-flight job untouched: it finishes, then the loop sees `running == false`.
            synchronized(sleepLock) { if (sleeping) loop.interrupt() }
            loop.join(30_000)
            WorkerLog.emit("shutdown_complete", null)
        },
    )
    loop.join()
    fatal.get()?.let { haltOnFatalLoopError(it) }
}


/**
 * End the process after the loop thread has died of an `Error`, and make sure it actually ends.
 *
 * Rethrowing out of `main` is not enough. The JDK `HttpServer` behind /healthz runs a non-daemon
 * `HTTP-Dispatcher` thread -- it inherits daemon status from whichever thread created it, which is
 * `main` -- so once `main` unwinds the JVM still has a live non-daemon thread and never exits. The
 * container then sits there forever, answering `503 loop-stalled` and taking no work, which is
 * exactly the state the fatal path exists to escape. `halt` skips shutdown hooks deliberately: the
 * loop thread is already dead, so the hook's `join` has nothing to wait for, and after an
 * OutOfMemoryError we do not want to run more Kotlin than we must.
 *
 * This deliberately does not call `server.stop(0)` first: `HttpServer.stop` joins its
 * `HTTP-Dispatcher` thread with no bound, so a wedged dispatcher would block the halt that exists
 * to escape exactly that kind of wedge. `Runtime.halt` tears the whole JVM down regardless, so the
 * health server's socket closes with it -- there is nothing `stop(0)` would still buy here.
 *
 * The stack trace goes to stderr in full. A `VirtualMachineError`'s trace is JDK and worker frames --
 * no document bytes, no file name, no job content -- so it is the one place the worker prints more
 * than a [WorkerLog] code, and an operator needs it to tell an OOM from a `StackOverflowError`.
 */
internal fun haltOnFatalLoopError(
    fatal: Throwable,
    stderr: java.io.PrintStream = System.err,
    exit: (Int) -> Unit = { Runtime.getRuntime().halt(it) },
) {
    runCatching { fatal.printStackTrace(stderr); stderr.flush() }
    exit(1)
}


private fun configuredObjectMapper(): ObjectMapper = jacksonObjectMapper()
    .registerModule(JavaTimeModule())


/**
 * @param port the loopback port to bind, or `0` to let the OS choose a free one -- the caller reads the
 * actual port back from the returned server's `address.port`. Production always passes
 * `GC_WORKER_HEALTH_PORT`, which `WorkerConfiguration` still requires to be an explicit 1024..65535;
 * `0` exists so a test does not have to reserve a port with `ServerSocket(0)` and then rebind it, a
 * window in which CI can hand the port to something else.
 */
internal fun startLoopbackHealthServer(port: Int, check: () -> HealthReport): HttpServer {
    // Loopback only: this is a supervisor's readiness probe, not a service. The image-smoke container runs
    // in the host network namespace, so the probe reaches it there without exposing it to anything else.
    val server = HttpServer.create(InetSocketAddress("127.0.0.1", port), 0)
    // A null executor runs every request on HttpServer's single dispatcher thread, so one probe waiting on
    // the core blocks the next one behind it. Two daemon threads: enough that a slow probe and the poll
    // that follows it do not serialise, few enough that /healthz can never become a work queue.
    server.executor = Executors.newFixedThreadPool(2) { runnable ->
        Thread(runnable, "document-worker-healthz").apply { isDaemon = true }
    }
    server.createContext("/healthz") { exchange ->
        // Fail closed. A check that throws -- a signature file deleted between two calls, a probe that
        // raises rather than returns -- must read as "not ready", never as a 500 the supervisor may treat
        // as a transport blip. Class name only in the log, for the same reason WorkerLog exists at all.
        val report = try {
            check()
        } catch (exception: Exception) {
            WorkerLog.emit("health_check_error", null, healthCheckErrorCode(exception))
            HealthReport(false, "scan-unavailable")
        }
        val body = report.code.toByteArray(StandardCharsets.UTF_8)
        exchange.responseHeaders.set("Content-Type", "text/plain; charset=utf-8")
        exchange.responseHeaders.set("Cache-Control", "no-store")
        exchange.sendResponseHeaders(if (report.ready) 200 else 503, body.size.toLong())
        exchange.responseBody.use { it.write(body) }
    }
    server.start()
    return server
}


/**
 * `<phase>_<exception class>`, e.g. `signatures_nosuchfileexception`.
 *
 * The wire code set stays closed (`scan-unavailable` for anything that throws) because Task 19's
 * image-smoke matches on it, so this log line is the only thing that tells an operator a raising
 * heartbeat clock from a missing signature file. Class name only, never the message: a
 * `NoSuchFileException`'s message is the path it could not find.
 */
internal fun healthCheckErrorCode(exception: Exception): String {
    val phase = (exception as? HealthCheckFailure)?.phase ?: "unknown"
    val cause = (exception as? HealthCheckFailure)?.cause ?: exception
    val name = cause.javaClass.simpleName.lowercase().filter { it.isLetterOrDigit() }
    return "${phase}_${if (name.length < 3) "unknown_error" else name}".take(80)
}


private fun boundedStringBodyHandler(): HttpResponse.BodyHandler<String> =
    HttpResponse.BodyHandlers.ofInputStream().let { delegate ->
        HttpResponse.BodyHandler { responseInfo ->
            val downstream = delegate.apply(responseInfo)
            HttpResponse.BodySubscribers.mapping(downstream) { input ->
                input.use {
                    val bytes = it.readNBytes(MAX_RESPONSE_BYTES + 1)
                    if (bytes.size > MAX_RESPONSE_BYTES) error("worker API response exceeded limit")
                    bytes.toString(StandardCharsets.UTF_8)
                }
            }
        }
    }
