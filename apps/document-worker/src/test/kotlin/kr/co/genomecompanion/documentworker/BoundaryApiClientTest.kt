package kr.co.genomecompanion.documentworker

import com.sun.net.httpserver.HttpServer
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.net.InetSocketAddress
import java.net.URI
import java.security.MessageDigest
import java.time.Instant
import java.util.HexFormat
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference


class BoundaryApiClientTest {
    @Test
    fun `source requests octet stream and verifies the exact leased bytes`() {
        val bytes = ("%PDF-1.7\n" + "synthetic-source".repeat(8) + "\n%%EOF\n").toByteArray()
        val digest = sha256(bytes)
        val observedAccept = AtomicReference<String>()
        withSourceServer(bytes, digest) { server ->
            server.createContext(sourcePath()) { exchange ->
                observedAccept.set(exchange.requestHeaders.getFirst("Accept"))
                exchange.responseHeaders.set("Content-Type", "application/octet-stream")
                exchange.responseHeaders.set("X-GC-Source-SHA256", digest)
                exchange.sendResponseHeaders(200, bytes.size.toLong())
                exchange.responseBody.use { it.write(bytes) }
            }
        }.useClient { client, lease ->
            assertThat(client.source(lease)).containsExactly(*bytes)
            assertThat(observedAccept.get()).isEqualTo("application/octet-stream")
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
                    credential = "synthetic-worker-credential-value-0001",
                    workerId = "worker-test",
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
    }
}
