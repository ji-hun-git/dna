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
import org.apache.pdfbox.Loader
import org.apache.pdfbox.rendering.ImageType
import org.apache.pdfbox.rendering.PDFRenderer
import java.io.ByteArrayOutputStream
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
import java.util.concurrent.TimeUnit
import javax.imageio.ImageIO


private const val WORKER_VERSION = "document-worker-v1"
private const val MAX_SOURCE_BYTES = 10_485_760
private const val MAX_RESPONSE_BYTES = 3_000_000


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
        fun fromEnvironment(environment: Map<String, String> = System.getenv()): WorkerConfiguration =
            WorkerConfiguration(
                apiBaseUri = URI.create(environment.getValue("GC_WORKER_API_BASE_URL")),
                credential = environment.getValue("GC_WORKER_CREDENTIAL"),
                workerId = environment.getOrDefault("GC_WORKER_ID", "document-worker-local"),
                clamscanPath = environment["GC_WORKER_CLAMSCAN_PATH"]?.let(Path::of),
                requiredClamAvVersion = environment.getOrDefault("GC_WORKER_CLAMAV_VERSION", "1.5.4"),
                allowSyntheticScanner = environment["GC_WORKER_ALLOW_SYNTHETIC_SCANNER"] == "true",
                workerImageDigest = environment.getValue("GC_WORKER_IMAGE_DIGEST"),
                failFirstExtraction = environment["GC_WORKER_FAIL_FIRST_EXTRACTION"] == "true",
                healthPort = environment["GC_WORKER_HEALTH_PORT"]?.toInt(),
            )

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
) {
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

    fun extractionResult(lease: WorkerLease, preview: ByteArray) {
        postJson(
            lease,
            "extraction-result",
            mapOf(
                "sourceSha256" to lease.sourceSha256,
                "workerImageDigest" to configuration.workerImageDigest,
                "generatorVersion" to WORKER_VERSION,
                "previewPngBase64" to Base64.getEncoder().encodeToString(preview),
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

    private fun authenticatedBuilder(uri: URI): HttpRequest.Builder = HttpRequest.newBuilder(uri)
        .header("X-GC-Worker-Credential", configuration.credential)
        .header("X-GC-Worker-Id", configuration.workerId)
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
        if (database != null && !Files.isRegularFile(database)) return unavailable("database-missing")
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
                ?: database?.let { "sha256:${sha256File(it)}" }
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

    private fun sha256File(path: Path): String {
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

    private data class ClamAvVersion(val engine: String, val signatures: String)
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
) {
    private val transientFailures = mutableSetOf<String>()

    fun runOnce(): Boolean {
        val lease = client.lease() ?: return false
        val source = client.source(lease)
        when (lease.jobType) {
            "SECURITY_INSPECTION" -> client.inspectionResult(
                lease,
                inspector.inspect(source, lease.sourceSha256),
            )
            "SYNTHETIC_EXTRACTION" -> {
                if (configuration.failFirstExtraction && transientFailures.add(lease.jobId)) {
                    client.failure(lease, "simulated_transient_preview_failure", retryable = true)
                } else {
                    runCatching { renderFirstPage(source) }
                        .onSuccess { client.extractionResult(lease, it) }
                        .onFailure { client.failure(lease, "preview_generation_failed", retryable = true) }
                }
            }
            else -> client.failure(lease, "unsupported_job_type", retryable = false)
        }
        return true
    }

    private fun renderFirstPage(source: ByteArray): ByteArray = Loader.loadPDF(source).use { document ->
        require(document.numberOfPages in 1..20)
        val image = PDFRenderer(document).renderImageWithDPI(0, 110f, ImageType.RGB)
        require(image.width.toLong() * image.height.toLong() <= 20_000_000)
        ByteArrayOutputStream().use { output ->
            check(ImageIO.write(image, "png", output))
            output.toByteArray().also { require(it.size in 67..2_097_152) }
        }
    }
}


fun main(args: Array<String>) {
    val configuration = WorkerConfiguration.fromEnvironment()
    val scanner = configuration.clamscanPath
        ?.let { ClamAvCommandScanner(it, configuration.requiredClamAvVersion) }
        ?: SyntheticManifestScanner()
    val worker = DocumentWorker(
        configuration,
        BoundaryApiClient(configuration),
        PdfSecurityInspector(policy = PdfInspectionPolicy(), malwareScanner = scanner),
    )
    configuration.healthPort?.let(::startLoopbackHealthServer)
    if (args.contains("--once")) {
        worker.runOnce()
        return
    }
    while (true) {
        val processed = runCatching { worker.runOnce() }.getOrDefault(false)
        if (!processed) Thread.sleep(1_000)
    }
}


private fun configuredObjectMapper(): ObjectMapper = jacksonObjectMapper()
    .registerModule(JavaTimeModule())


private fun startLoopbackHealthServer(port: Int) {
    val server = HttpServer.create(InetSocketAddress("127.0.0.1", port), 0)
    server.createContext("/healthz") { exchange ->
        val body = "ready".toByteArray(StandardCharsets.UTF_8)
        exchange.responseHeaders.set("Content-Type", "text/plain; charset=utf-8")
        exchange.responseHeaders.set("Cache-Control", "no-store")
        exchange.sendResponseHeaders(200, body.size.toLong())
        exchange.responseBody.use { it.write(body) }
    }
    server.start()
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
