package kr.co.genomecompanion.documentworker

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.sun.net.httpserver.HttpServer
import kr.co.genomecompanion.documentboundary.WorkerIdentity
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.net.InetSocketAddress
import java.net.URI
import java.security.MessageDigest
import java.time.Instant
import java.time.LocalDate
import java.util.HexFormat
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference


class BoundaryApiClientTest {
    @Test
    fun `source requests octet stream and verifies the exact leased bytes`() {
        val bytes = ("%PDF-1.7\n" + "synthetic-source".repeat(8) + "\n%%EOF\n").toByteArray()
        val digest = sha256(bytes)
        val observedAccept = AtomicReference<String>()
        val observedWorkerIdMac = AtomicReference<String>()
        withSourceServer(bytes, digest) { server ->
            server.createContext(sourcePath()) { exchange ->
                observedAccept.set(exchange.requestHeaders.getFirst("Accept"))
                observedWorkerIdMac.set(exchange.requestHeaders.getFirst("X-GC-Worker-Id-Mac"))
                exchange.responseHeaders.set("Content-Type", "application/octet-stream")
                exchange.responseHeaders.set("X-GC-Source-SHA256", digest)
                exchange.sendResponseHeaders(200, bytes.size.toLong())
                exchange.responseBody.use { it.write(bytes) }
            }
        }.useClient { client, lease ->
            assertThat(client.source(lease)).containsExactly(*bytes)
            assertThat(observedAccept.get()).isEqualTo("application/octet-stream")
            // The worker proves its id with an HMAC keyed by sha256(credential); the raw credential
            // never keys anything the core can replay, and the core holds only the digest.
            assertThat(observedWorkerIdMac.get())
                .isEqualTo(WorkerIdentity.mac(TEST_WORKER_CREDENTIAL, TEST_WORKER_ID))
        }
    }

    @Test
    fun `source rejects bytes that do not match the leased digest`() {
        val expected = ("%PDF-1.7\n" + "expected-source".repeat(8) + "\n%%EOF\n").toByteArray()
        val modified = expected.copyOf().also { it[it.lastIndex - 2] = 'X'.code.toByte() }
        val digest = sha256(expected)
        withSourceServer(modified, digest) { server ->
            server.createContext(sourcePath()) { exchange ->
                exchange.responseHeaders.set("Content-Type", "application/octet-stream")
                exchange.responseHeaders.set("X-GC-Source-SHA256", digest)
                exchange.sendResponseHeaders(200, modified.size.toLong())
                exchange.responseBody.use { it.write(modified) }
            }
        }.useClient { client, lease ->
            assertThatThrownBy { client.source(lease) }
                .hasMessage("worker source digest mismatch")
        }
    }

    @Test
    fun `extraction result carries the parsed candidates and abstentions beside the preview`() {
        val bytes = ("%PDF-1.7\n" + "synthetic-source".repeat(8) + "\n%%EOF\n").toByteArray()
        val digest = sha256(bytes)
        val observedBody = AtomicReference<String>()
        withSourceServer(bytes, digest) { server ->
            server.createContext("/internal/document-boundary/jobs/$JOB_ID/extraction-result") { exchange ->
                observedBody.set(exchange.requestBody.readAllBytes().toString(Charsets.UTF_8))
                exchange.responseHeaders.set("Content-Type", "application/json")
                val response = """{"jobId":"$JOB_ID","status":"COMPLETED"}""".toByteArray()
                exchange.sendResponseHeaders(200, response.size.toLong())
                exchange.responseBody.use { it.write(response) }
            }
        }.useClient { client, lease ->
            val outcome = ExtractionOutcome(
                candidates = listOf(
                    ParsedCandidate(1, "Cholesterol", "188", "mg/dL", LocalDate.of(2026, 7, 28), 1, TextBox(0.08, 0.1, 0.3, 0.02), "1".repeat(64), "120-199"),
                ),
                abstentions = listOf(
                    ParsedAbstention("LDL", AbstentionReason.AMBIGUOUS_VALUE, 1),
                    ParsedAbstention("문서 전체", AbstentionReason.UNREADABLE, null),
                ),
                observedOn = LocalDate.of(2026, 7, 28),
            )

            client.extractionResult(lease, byteArrayOf(1, 2, 3), outcome)

            val body = jacksonObjectMapper().readTree(observedBody.get())
            assertThat(body["sourceSha256"].asText()).isEqualTo(digest)
            assertThat(body["generatorVersion"].asText()).isEqualTo("document-worker-v2")
            assertThat(body["extractionMethod"].asText()).isEqualTo("native-text")
            assertThat(body["previewPngBase64"].asText()).isEqualTo("AQID")
            assertThat(body["candidates"]).hasSize(1)
            val candidate = body["candidates"][0]
            assertThat(candidate["ordinal"].asInt()).isEqualTo(1)
            assertThat(candidate["label"].asText()).isEqualTo("Cholesterol")
            assertThat(candidate["value"].asText()).isEqualTo("188")
            assertThat(candidate["unit"].asText()).isEqualTo("mg/dL")
            assertThat(candidate["observedOn"].asText()).isEqualTo("2026-07-28")
            assertThat(candidate["evidencePage"].asInt()).isEqualTo(1)
            assertThat(candidate["evidenceBox"]["x"].asDouble()).isEqualTo(0.08)
            assertThat(candidate["evidenceBox"]["height"].asDouble()).isEqualTo(0.02)
            assertThat(candidate["sourceTextSha256"].asText()).isEqualTo("1".repeat(64))
            assertThat(candidate["referenceRangeText"].asText()).isEqualTo("120-199")
            assertThat(candidate.fieldNames().asSequence().toList()).doesNotContain("referenceRange", "conceptCode")
            assertThat(body["abstentions"].map { it["reason"].asText() }).containsExactly("ambiguous_value", "unreadable")
            assertThat(body["abstentions"][0]["label"].asText()).isEqualTo("LDL")
            assertThat(body["abstentions"][0]["evidencePage"].asInt()).isEqualTo(1)
            assertThat(body["abstentions"][1]["evidencePage"].isNull).isTrue()
        }
    }

    private fun withSourceServer(
        bytes: ByteArray,
        digest: String,
        configure: (HttpServer) -> Unit,
    ): SourceServer {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        configure(server)
        server.start()
        return SourceServer(server, bytes, digest)
    }

    private fun sourcePath() = "/internal/document-boundary/jobs/$JOB_ID/source"

    private fun sha256(bytes: ByteArray): String =
        HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes))

    private data class SourceServer(
        val server: HttpServer,
        val bytes: ByteArray,
        val digest: String,
    ) {
        fun useClient(assertions: (BoundaryApiClient, WorkerLease) -> Unit) {
            try {
                val configuration = WorkerConfiguration(
                    apiBaseUri = URI.create("http://127.0.0.1:${server.address.port}"),
                    credential = TEST_WORKER_CREDENTIAL,
                    workerId = TEST_WORKER_ID,
                    clamscanPath = null,
                    requiredClamAvVersion = "1.5.4",
                    allowSyntheticScanner = true,
                    workerImageDigest = "a".repeat(64),
                    failFirstExtraction = false,
                    healthPort = null,
                )
                assertions(
                    BoundaryApiClient(configuration),
                    WorkerLease(
                        jobId = JOB_ID.toString(),
                        jobType = "SECURITY_INSPECTION",
                        attempt = 1,
                        maxAttempts = 3,
                        leaseToken = "synthetic-lease-token-value-00000001",
                        leaseExpiresAt = Instant.parse("2026-08-30T13:30:00Z"),
                        sourcePath = "/internal/document-boundary/jobs/$JOB_ID/source",
                        sourceSha256 = digest,
                        sourceLength = bytes.size.toLong(),
                        sourceZone = "UNTRUSTED",
                        documentStateVersion = 2,
                    ),
                )
            } finally {
                server.stop(0)
            }
        }
    }

    companion object {
        private val JOB_ID: UUID = UUID.fromString("7f547322-3a10-41fb-a1ad-6e75f16567cc")
        private const val TEST_WORKER_CREDENTIAL = "synthetic-worker-credential-value-0001"
        private const val TEST_WORKER_ID = "worker-test"
    }
}
