package kr.co.genomecompanion.documentboundary

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test


class WorkerIdentityTest {
    @Test
    fun `mac is deterministic, credential-bound and never the credential itself`() {
        val credential = "browser-document-worker-credential-000000000001"
        val mac = WorkerIdentity.mac(credential, "playwright-document-worker")
        assertThat(mac).matches("^[0-9a-f]{64}$").isEqualTo(WorkerIdentity.mac(credential, "playwright-document-worker"))
        assertThat(mac).isNotEqualTo(WorkerIdentity.mac(credential, "other-worker"))
        assertThat(mac).isNotEqualTo(WorkerIdentity.mac(credential + "x", "playwright-document-worker"))
        assertThat(WorkerIdentity.macFromCredentialDigest(WorkerIdentity.credentialDigest(credential), "playwright-document-worker")).isEqualTo(mac)
    }
}
