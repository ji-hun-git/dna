package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.net.URI


class WorkerConfigurationTest {
    @Test
    fun rejectsArbitraryPlaintextNetworkDestination() {
        assertThatThrownBy {
            validConfiguration(URI.create("http://example.com"))
        }.isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun rejectsBaseUriWithCredentialsOrApplicationPath() {
        assertThatThrownBy {
            validConfiguration(URI.create("https://user@example.com/internal"))
        }.isInstanceOf(IllegalArgumentException::class.java)
    }

    private fun validConfiguration(uri: URI) = WorkerConfiguration(
        apiBaseUri = uri,
        credential = "synthetic-worker-credential-value-0001",
        workerId = "worker-test",
        clamscanPath = null,
        requiredClamAvVersion = "1.5.4",
        allowSyntheticScanner = true,
        workerImageDigest = "a".repeat(64),
        failFirstExtraction = false,
        healthPort = null,
    )
}
