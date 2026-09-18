package kr.co.genomecompanion.foundation

import org.springframework.test.context.DynamicPropertyRegistry
import java.nio.file.Path

/**
 * The one PostgreSQL-backed foundation test configuration, shared by every `@SpringBootTest` that
 * drives a real lifecycle over HTTP ([FoundationLifecyclePostgresIntegrationTest] and
 * [FoundationOpenApiContractTest]).
 *
 * It exists so the two cannot drift: a contract test that documented a route under a *different*
 * origin, credential, digest allow-list or demo-bootstrap setting from the one the lifecycle test
 * exercises would be documenting a second, imaginary application. Every value here is synthetic —
 * the credentials are fixed strings for two fixture subjects that exist only in test configuration,
 * and the "PDFs" are a few dozen bytes of ASCII that say so in their own text.
 */
object FoundationTestProperties {
    const val ALLOWED_ORIGIN = "http://127.0.0.1:3137"
    const val ALICE_CREDENTIAL = "alice-foundation-test-credential-00000001"
    const val BOB_CREDENTIAL = "bob-foundation-test-credential-00000000002"
    const val WORKER_CREDENTIAL = "worker-credential-for-integration-test-0001"
    const val AUDIT_PEPPER = "foundation-integration-test-pepper-64-characters-minimum-value"

    /** A one-pixel PNG: the smallest artifact that is a *real* PNG, so nothing under test is faked. */
    const val ONE_PIXEL_PNG_BASE64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

    val fixturePdf: ByteArray =
        "%PDF-1.7\nGenome Companion synthetic fixture only; no real health data.\n%%EOF\n".toByteArray()
    val fixtureDigest: String = FoundationHashing.sha256(fixturePdf)

    val januaryFixturePdf: ByteArray =
        "%PDF-1.7\nGenome Companion synthetic fixture 2026-01 only; no real health data.\n%%EOF\n".toByteArray()
    val januaryFixtureDigest: String = FoundationHashing.sha256(januaryFixturePdf)

    /** A per-test-class directory under the OS temp root (or `GC_TEST_QUARANTINE_ROOT` in CI). */
    fun quarantineRoot(name: String): Path = Path.of(
        System.getenv("GC_TEST_QUARANTINE_ROOT") ?: System.getProperty("java.io.tmpdir"),
    ).resolve(name).toAbsolutePath().normalize()

    fun register(registry: DynamicPropertyRegistry, quarantineRoot: Path) {
        registry.add("spring.datasource.url") { checkNotNull(System.getenv("GC_TEST_POSTGRES_URL")) }
        registry.add("spring.datasource.username") { "postgres" }
        registry.add("spring.datasource.password") { "" }
        // The concurrency (race) tests genuinely need 2+ live connections at once; the pool otherwise
        // grows lazily and a fresh second connection's one-time setup cost can itself decide an
        // otherwise-tight two-thread race.
        registry.add("spring.datasource.hikari.minimum-idle") { "4" }
        registry.add("spring.datasource.hikari.maximum-pool-size") { "8" }
        registry.add("security.oidc.enabled") { "true" }
        registry.add("security.oidc.issuer") { "https://issuer.test.invalid" }
        registry.add("security.oidc.jwk-set-uri") { "https://issuer.test.invalid/.well-known/jwks.json" }
        registry.add("security.oidc.audience") { "https://api.genome-companion.test" }
        registry.add("security.oidc.client-id") { "synthetic-web-client" }
        registry.add("gc.foundation.enabled") { "true" }
        registry.add("gc.foundation.demo-bootstrap-enabled") { "true" }
        registry.add("gc.foundation.document-boundary-enabled") { "true" }
        registry.add("gc.foundation.worker-credential-sha256") { FoundationHashing.sha256(WORKER_CREDENTIAL) }
        registry.add("gc.foundation.allow-synthetic-scanner-results") { "true" }
        registry.add("gc.foundation.allowed-origin") { ALLOWED_ORIGIN }
        registry.add("gc.foundation.secure-cookies") { "false" }
        registry.add("gc.foundation.quarantine-root") { quarantineRoot.toString() }
        registry.add("gc.foundation.audit-pepper") { AUDIT_PEPPER }
        registry.add("gc.foundation.allowed-document-sha256") { "$fixtureDigest,$januaryFixtureDigest" }
        registry.add("gc.foundation.session-rate-limit-per-minute") { "10000" }
        registry.add("gc.foundation.worker-rate-limit-per-minute") { "100000" }
        registry.add("gc.foundation.local-identities[0].subject-id") { "synthetic-alice" }
        registry.add("gc.foundation.local-identities[0].credential-sha256") { FoundationHashing.sha256(ALICE_CREDENTIAL) }
        registry.add("gc.foundation.local-identities[1].subject-id") { "synthetic-bob" }
        registry.add("gc.foundation.local-identities[1].credential-sha256") { FoundationHashing.sha256(BOB_CREDENTIAL) }
    }
}
