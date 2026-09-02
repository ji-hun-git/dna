package kr.co.genomecompanion.foundation

import org.springframework.boot.context.properties.ConfigurationProperties
import java.nio.file.Path
import java.time.Duration


data class LocalSyntheticIdentity(
    val subjectId: String = "",
    val credentialSha256: String = "",
)


/**
 * Binds one approved synthetic source digest to one named set in [SyntheticCandidateFixture].
 *
 * This is a fixture-selection binding only. It never authorizes a document, and it never means the
 * bytes were parsed: the allow-list still decides which digests may be uploaded at all.
 */
data class SyntheticDocumentBinding(
    val sha256: String = "",
    val setId: String = "",
)


@ConfigurationProperties("gc.foundation")
data class FoundationProperties(
    val enabled: Boolean = false,
    val allowedOrigin: String = "",
    val secureCookies: Boolean = true,
    val sessionTtl: Duration = Duration.ofMinutes(30),
    val documentBoundaryEnabled: Boolean = false,
    val uploadCapabilityTtl: Duration = Duration.ofMinutes(5),
    val workerLeaseTtl: Duration = Duration.ofMinutes(2),
    val workerCredentialSha256: String = "",
    val allowSyntheticScannerResults: Boolean = false,
    val requiredClamAvVersion: String = "1.5.4",
    val quarantineRoot: Path? = null,
    val auditPepper: String = "",
    val allowedDocumentSha256: Set<String> = emptySet(),
    val localIdentities: List<LocalSyntheticIdentity> = emptyList(),
    val syntheticDocuments: List<SyntheticDocumentBinding> = emptyList(),
) {
    /**
     * Resolves the synthetic candidate set id bound to [sourceSha256], or the default set when the
     * digest carries no explicit binding. Configuration, not document content, decides this.
     */
    fun candidateSetFor(sourceSha256: String): String =
        syntheticDocuments.firstOrNull { it.sha256 == sourceSha256 }?.setId
            ?: SyntheticCandidateFixture.DEFAULT_SET_ID

    fun validateEnabledConfiguration() {
        if (!enabled) return
        require(allowedOrigin.startsWith("https://") || allowedOrigin.startsWith("http://127.0.0.1:")) {
            "foundation allowed origin must be HTTPS or loopback"
        }
        require(quarantineRoot != null) { "foundation quarantine root is required" }
        require(auditPepper.length >= 32) { "foundation audit pepper must contain at least 32 characters" }
        require(allowedDocumentSha256.isNotEmpty()) { "foundation requires an allowlist of synthetic document digests" }
        require(allowedDocumentSha256.all { it.matches(Regex("^[0-9a-f]{64}$")) }) {
            "foundation document digests must be lowercase SHA-256"
        }
        require(syntheticDocuments.all { it.sha256.matches(Regex("^[0-9a-f]{64}$")) }) {
            "foundation synthetic document bindings must use a lowercase SHA-256 digest"
        }
        require(syntheticDocuments.all { it.sha256 in allowedDocumentSha256 }) {
            "foundation synthetic document bindings must reference an allow-listed document digest"
        }
        require(syntheticDocuments.all { it.setId in SyntheticCandidateFixture.setIds() }) {
            "foundation synthetic document bindings must reference a known synthetic candidate set id"
        }
        require(
            syntheticDocuments.map(SyntheticDocumentBinding::sha256).distinct().size == syntheticDocuments.size,
        ) { "foundation synthetic document bindings must be unique per document digest" }
        require(uploadCapabilityTtl in Duration.ofMinutes(1)..Duration.ofMinutes(15)) {
            "foundation upload capability TTL must be between one and fifteen minutes"
        }
        require(workerLeaseTtl in Duration.ofSeconds(30)..Duration.ofMinutes(10)) {
            "foundation worker lease TTL must be between thirty seconds and ten minutes"
        }
        if (documentBoundaryEnabled) {
            require(workerCredentialSha256.matches(Regex("^[0-9a-f]{64}$"))) {
                "foundation document worker requires a SHA-256 credential"
            }
            require(requiredClamAvVersion.matches(Regex("^[0-9]+[.][0-9]+[.][0-9]+$"))) {
                "foundation required ClamAV version must be exact"
            }
        }
        require(localIdentities.isNotEmpty()) { "foundation requires explicit local synthetic identities" }
        require(localIdentities.map(LocalSyntheticIdentity::subjectId).distinct().size == localIdentities.size) {
            "foundation local synthetic subjects must be unique"
        }
        require(
            localIdentities.all { identity ->
                identity.subjectId.matches(Regex("^synthetic-[a-z0-9-]+$")) &&
                    identity.credentialSha256.matches(Regex("^[0-9a-f]{64}$"))
            },
        ) { "foundation local identities require a synthetic subject and SHA-256 credential" }
    }
}
