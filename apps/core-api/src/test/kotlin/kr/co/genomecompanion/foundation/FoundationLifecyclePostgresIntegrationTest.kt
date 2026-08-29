package kr.co.genomecompanion.foundation

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID


@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "GC_TEST_POSTGRES_URL", matches = ".+")
class FoundationLifecyclePostgresIntegrationTest @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper,
    private val jdbc: JdbcTemplate,
    private val service: FoundationLifecycleService,
) {
    data class TestClient(val cookie: Cookie, val csrf: String)

    @BeforeEach
    fun resetSyntheticDatabase() {
        jdbc.execute(
            """
            TRUNCATE TABLE
                gc_audit_event,
                gc_idempotency,
                gc_deletion_request,
                gc_health_record,
                gc_candidate,
                gc_extraction_job,
                gc_document,
                gc_consent_grant,
                gc_session,
                gc_subject
            RESTART IDENTITY CASCADE
            """.trimIndent(),
        )
        Files.createDirectories(quarantineRoot)
        Files.list(quarantineRoot).use { paths -> paths.forEach(Files::deleteIfExists) }
    }

    @Test
    fun persistsAttacksRevokesAndDeletesOneSyntheticLifecycle() {
        mockMvc.perform(
            post("/api/foundation/session")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json(
                        mapOf(
                            "subjectId" to "synthetic-alice",
                            "credential" to aliceCredential,
                        ),
                    ),
                ),
        ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("origin_denied"))

        mockMvc.perform(
            post("/api/foundation/session")
                .header(HttpHeaders.ORIGIN, allowedOrigin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json(
                        mapOf(
                            "subjectId" to "synthetic-alice",
                            "credential" to "wrong-credential-value-with-32-characters",
                        ),
                    ),
                ),
        ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("local_identity_denied"))
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'LOCAL_IDENTITY_DENIED'",
                Long::class.java,
            ),
        ).isEqualTo(1)

        val alice = login("synthetic-alice")
        val bob = login("synthetic-bob")
        val aliceConsentId = grantConsent(alice)
        val bobConsentId = grantConsent(bob)

        mockMvc.perform(
            post("/api/foundation/documents")
                .cookie(alice.cookie)
                .header(HttpHeaders.ORIGIN, allowedOrigin)
                .header("Idempotency-Key", "doc-request-no-csrf")
                .contentType(MediaType.APPLICATION_JSON)
                .content(documentRequest(aliceConsentId, fixturePdf)),
        ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("csrf_denied"))

        val aliceDocumentId = requestDocument(alice, aliceConsentId, fixturePdf, "doc-request-alice")
        assertThat(requestDocument(alice, aliceConsentId, fixturePdf, "doc-request-alice"))
            .isEqualTo(aliceDocumentId)

        mutate(
            put("/api/foundation/documents/$aliceDocumentId/content")
                .contentType(MediaType.APPLICATION_PDF)
                .content(fixturePdf),
            alice,
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("QUARANTINED"))
            .andExpect(jsonPath("$.sha256").value(fixtureDigest))

        mutate(post("/api/foundation/documents/$aliceDocumentId/inspection"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("INSPECTED"))

        val candidateNode = responseJson(
            mutate(post("/api/foundation/documents/$aliceDocumentId/extraction"), alice)
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.label").value("총콜레스테롤"))
                .andReturn()
                .response
                .contentAsByteArray,
        )
        val candidateId = UUID.fromString(candidateNode["candidateId"].asText())

        read(get("/api/foundation/records"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(0))

        mutate(
            post("/api/foundation/candidates/$candidateId/confirmation")
                .header("Idempotency-Key", "confirm-alice-candidate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "190"))),
            bob,
        ).andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("candidate_not_found"))

        val recordNode = responseJson(
            mutate(
                post("/api/foundation/candidates/$candidateId/confirmation")
                    .header("Idempotency-Key", "confirm-alice-candidate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to "190"))),
                alice,
            ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.value").value("190"))
                .andReturn()
                .response
                .contentAsByteArray,
        )
        val recordId = UUID.fromString(recordNode["recordId"].asText())

        val replayedRecordNode = responseJson(
            mutate(
                post("/api/foundation/candidates/$candidateId/confirmation")
                    .header("Idempotency-Key", "confirm-alice-candidate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to "190"))),
                alice,
            ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsByteArray,
        )
        assertThat(replayedRecordNode["recordId"].asText()).isEqualTo(recordId.toString())
        assertThat(count("gc_health_record")).isEqualTo(1)

        read(get("/api/foundation/records/$recordId"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.documentId").value(aliceDocumentId.toString()))
            .andExpect(jsonPath("$.candidateId").value(candidateId.toString()))
            .andExpect(jsonPath("$.value").value("190"))

        read(get("/api/foundation/records/$recordId"), bob)
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("record_not_found"))

        mutate(post("/api/foundation/consents/$aliceConsentId/revocation"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("REVOKED"))

        mutate(
            post("/api/foundation/documents")
                .header("Idempotency-Key", "doc-request-alice")
                .contentType(MediaType.APPLICATION_JSON)
                .content(documentRequest(aliceConsentId, fixturePdf)),
            alice,
        ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("active_consent_required"))

        mutate(
            post("/api/foundation/candidates/$candidateId/confirmation")
                .header("Idempotency-Key", "confirm-after-revoke")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "191"))),
            alice,
        ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("active_consent_required"))

        val unsafePdf = "%PDF-1.7\nsynthetic-but-not-allowlisted\n".toByteArray()
        val bobDocumentId = requestDocument(bob, bobConsentId, unsafePdf, "doc-request-bob-bad")
        mutate(
            put("/api/foundation/documents/$bobDocumentId/content")
                .contentType(MediaType.APPLICATION_PDF)
                .content(unsafePdf),
            bob,
        ).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$bobDocumentId/inspection"), bob)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("REJECTED"))
        mutate(post("/api/foundation/documents/$bobDocumentId/extraction"), bob)
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("document_not_inspected"))

        val deletionNode = responseJson(
            mutate(delete("/api/foundation/profile"), alice)
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.rawHealthValuesPresentInAudit").value(false))
                .andReturn()
                .response
                .contentAsByteArray,
        )
        val deletionId = UUID.fromString(deletionNode["deletionId"].asText())
        assertThat(deletionNode["auditEventTypes"].map(JsonNode::asText))
            .contains("PROFILE_DELETED", "CONSENT_REVOKED")
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'RECORD_ACCESS_DENIED'",
                Long::class.java,
            ),
        ).isEqualTo(1)

        read(get("/api/foundation/records"), alice)
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.code").value("session_invalid"))

        assertThat(countForSubject("gc_document", "synthetic-alice")).isZero()
        assertThat(countForSubject("gc_health_record", "synthetic-alice")).isZero()
        assertThat(countForSubject("gc_session", "synthetic-alice")).isZero()
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM gc_deletion_request WHERE deletion_id = ?",
                Long::class.java,
                deletionId,
            ),
        ).isEqualTo(1)
        assertThat(
            jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM gc_audit_event
                WHERE event_type LIKE '%188%'
                   OR event_type LIKE '%190%'
                   OR resource_type LIKE '%mg/dL%'
                """.trimIndent(),
                Long::class.java,
            ),
        ).isZero()
        assertThat(Files.exists(quarantineRoot.resolve("$aliceDocumentId.pdf"))).isFalse()

        val repeatedDeletion = service.deleteProfile(
            FoundationPrincipal(
                subjectId = "synthetic-alice",
                sessionId = UUID.randomUUID(),
                sessionTokenHash = "a".repeat(64),
            ),
        )
        assertThat(repeatedDeletion.deletionId).isEqualTo(deletionId)
        assertThat(count("gc_deletion_request")).isEqualTo(1)
    }

    private fun login(subjectId: String): TestClient {
        val response = mockMvc.perform(
            post("/api/foundation/session")
                .header(HttpHeaders.ORIGIN, allowedOrigin)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json(
                        mapOf(
                            "subjectId" to subjectId,
                            "credential" to if (subjectId == "synthetic-alice") aliceCredential else bobCredential,
                        ),
                    ),
                ),
        ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.csrfToken").isNotEmpty)
            .andReturn()
            .response
        return TestClient(
            cookie = checkNotNull(response.getCookie(FOUNDATION_SESSION_COOKIE)),
            csrf = responseJson(response.contentAsByteArray)["csrfToken"].asText(),
        )
    }

    private fun grantConsent(client: TestClient): UUID {
        val response = mutate(post("/api/foundation/consents/document-extraction"), client)
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.purposeCode").value("DOCUMENT_EXTRACTION"))
            .andReturn()
            .response
        return UUID.fromString(responseJson(response.contentAsByteArray)["consentId"].asText())
    }

    private fun requestDocument(
        client: TestClient,
        consentId: UUID,
        content: ByteArray,
        idempotencyKey: String,
    ): UUID {
        val response = mutate(
            post("/api/foundation/documents")
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(documentRequest(consentId, content)),
            client,
        ).andExpect(status().isCreated)
            .andReturn()
            .response
        return UUID.fromString(
            responseJson(response.contentAsByteArray)["document"]["documentId"].asText(),
        )
    }

    private fun documentRequest(consentId: UUID, content: ByteArray): String =
        json(
            mapOf(
                "consentId" to consentId,
                "mediaType" to "application/pdf",
                "contentLength" to content.size,
            ),
        )

    private fun mutate(builder: MockHttpServletRequestBuilder, client: TestClient) =
        mockMvc.perform(
            builder
                .cookie(client.cookie)
                .header(HttpHeaders.ORIGIN, allowedOrigin)
                .header(FOUNDATION_CSRF_HEADER, client.csrf),
        )

    private fun read(builder: MockHttpServletRequestBuilder, client: TestClient) =
        mockMvc.perform(builder.cookie(client.cookie))

    private fun responseJson(bytes: ByteArray): JsonNode = objectMapper.readTree(bytes)

    private fun json(value: Any): String = objectMapper.writeValueAsString(value)

    private fun count(table: String): Long =
        jdbc.queryForObject("SELECT COUNT(*) FROM $table", Long::class.java) ?: 0L

    private fun countForSubject(table: String, subjectId: String): Long =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM $table WHERE subject_id = ?",
            Long::class.java,
            subjectId,
        ) ?: 0L

    companion object {
        private const val allowedOrigin = "http://127.0.0.1:3137"
        private const val aliceCredential = "alice-foundation-test-credential-00000001"
        private const val bobCredential = "bob-foundation-test-credential-00000000002"
        private val fixturePdf = "%PDF-1.7\nGenome Companion synthetic fixture only\n%%EOF\n".toByteArray()
        private val fixtureDigest = FoundationHashing.sha256(fixturePdf)
        private val quarantineRoot: Path = Path.of(
            System.getenv("GC_TEST_QUARANTINE_ROOT") ?: System.getProperty("java.io.tmpdir"),
        ).resolve("gc-foundation-postgres-integration").toAbsolutePath().normalize()

        @JvmStatic
        @DynamicPropertySource
        fun foundationProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url") { checkNotNull(System.getenv("GC_TEST_POSTGRES_URL")) }
            registry.add("spring.datasource.username") { "postgres" }
            registry.add("spring.datasource.password") { "" }
            registry.add("gc.foundation.enabled") { "true" }
            registry.add("gc.foundation.allowed-origin") { allowedOrigin }
            registry.add("gc.foundation.secure-cookies") { "false" }
            registry.add("gc.foundation.quarantine-root") { quarantineRoot.toString() }
            registry.add("gc.foundation.audit-pepper") {
                "foundation-integration-test-pepper-64-characters-minimum-value"
            }
            registry.add("gc.foundation.allowed-document-sha256") { fixtureDigest }
            registry.add("gc.foundation.local-identities[0].subject-id") { "synthetic-alice" }
            registry.add("gc.foundation.local-identities[0].credential-sha256") {
                FoundationHashing.sha256(aliceCredential)
            }
            registry.add("gc.foundation.local-identities[1].subject-id") { "synthetic-bob" }
            registry.add("gc.foundation.local-identities[1].credential-sha256") {
                FoundationHashing.sha256(bobCredential)
            }
        }
    }
}
