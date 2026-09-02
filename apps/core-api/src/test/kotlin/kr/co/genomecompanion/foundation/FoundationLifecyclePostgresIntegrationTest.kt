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
import org.springframework.dao.DataAccessException
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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit


@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "GC_TEST_POSTGRES_URL", matches = ".+")
class FoundationLifecyclePostgresIntegrationTest @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper,
    private val jdbc: JdbcTemplate,
    private val service: FoundationLifecycleService,
    private val workerService: DocumentWorkerBoundaryService,
) {
    data class TestClient(val cookie: Cookie, val csrf: String)
    data class TestUploadCapability(val capabilityId: UUID, val rawToken: String)

    private val uploadCapabilities = mutableMapOf<UUID, TestUploadCapability>()

    @BeforeEach
    fun resetSyntheticDatabase() {
        jdbc.execute("TRUNCATE TABLE security_audit_event")
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
        uploadCapabilities.clear()
    }

    @Test
    fun securityAuditRowsAreDatabaseEnforcedAppendOnly() {
        val eventId = UUID.fromString("00000000-0000-0000-0000-000000000501")
        jdbc.update(
            """
            INSERT INTO security_audit_event(
                event_id, event_type, actor_digest, resource_digest, purpose, outcome,
                correlation_id, occurred_at, previous_hash, event_hash
            ) VALUES (?, ?, ?, NULL, NULL, ?, ?, CURRENT_TIMESTAMP, ?, ?)
            """.trimIndent(),
            eventId,
            "SYNTHETIC_APPEND_ONLY_PROBE",
            "hmac256:${"a".repeat(64)}",
            "ALLOW",
            UUID.fromString("00000000-0000-0000-0000-000000000502"),
            "0".repeat(64),
            "b".repeat(64),
        )

        org.assertj.core.api.Assertions.assertThatThrownBy {
            jdbc.update(
                "UPDATE security_audit_event SET event_type = ? WHERE event_id = ?",
                "MUTATION_MUST_FAIL",
                eventId,
            )
        }.isInstanceOf(DataAccessException::class.java)

        assertThat(
            jdbc.queryForObject(
                "SELECT event_type FROM security_audit_event WHERE event_id = ?",
                String::class.java,
                eventId,
            ),
        ).isEqualTo("SYNTHETIC_APPEND_ONLY_PROBE")
    }

    @Test
    fun concurrentDuplicateWorkerCompletionCreatesExactlyOneResult() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "duplicate-worker-result")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice)
            .andExpect(status().isAccepted)

        val inspectionLease = checkNotNull(workerService.lease("a".repeat(64)))
        workerService.completeInspection(
            inspectionLease.jobId,
            inspectionLease.leaseToken,
            approvedInspectionRequest(),
        )
        val extractionLease = checkNotNull(workerService.lease("a".repeat(64)))
        val resultRequest = ExtractionResultRequest(
            sourceSha256 = fixtureDigest,
            workerImageDigest = "b".repeat(64),
            generatorVersion = "test-worker-v1",
            previewPngBase64 = onePixelPngBase64,
        )
        val executor = Executors.newFixedThreadPool(2)
        val ready = CountDownLatch(2)
        val start = CountDownLatch(1)

        try {
            val futures = (1..2).map {
                executor.submit<Result<WorkerResultReceipt>> {
                    ready.countDown()
                    check(start.await(5, TimeUnit.SECONDS))
                    runCatching {
                        workerService.completeExtraction(
                            extractionLease.jobId,
                            extractionLease.leaseToken,
                            resultRequest,
                        )
                    }
                }
            }
            check(ready.await(5, TimeUnit.SECONDS))
            start.countDown()
            val results = futures.map { it.get(15, TimeUnit.SECONDS) }

            assertThat(results.count { it.getOrNull()?.status == "COMPLETED" }).isEqualTo(1)
            assertThat(results.count { it.exceptionOrNull() is FoundationForbiddenException }).isEqualTo(1)
            assertThat(count("gc_extraction_job")).isEqualTo(1)
            assertThat(count("gc_candidate")).isEqualTo(3)
            assertThat(count("gc_preview_artifact")).isEqualTo(1)
            assertThat(
                jdbc.queryForObject(
                    "SELECT status FROM gc_document_job WHERE job_id = ?",
                    String::class.java,
                    extractionLease.jobId,
                ),
            ).isEqualTo("COMPLETED")
        } finally {
            start.countDown()
            executor.shutdownNow()
            check(executor.awaitTermination(5, TimeUnit.SECONDS))
        }
    }

    @Test
    fun persistsAttacksRevokesAndDeletesOneSyntheticLifecycle() {
        mockMvc.perform(get("/v1/not-mapped"))
            .andExpect(status().isUnauthorized)

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

        uploadDocument(alice, aliceDocumentId, fixturePdf)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("UPLOAD_PENDING"))
            .andExpect(jsonPath("$.sha256").value(fixtureDigest))

        mutate(post("/api/foundation/documents/$aliceDocumentId/finalization"), alice)
            .andExpect(status().isAccepted)
            .andExpect(jsonPath("$.status").value("UNTRUSTED_OBJECT"))

        runWorkerPipeline(aliceDocumentId, simulateTransientExtractionFailure = true)
        val candidateNode = responseJson(
            read(get("/api/foundation/documents/$aliceDocumentId/candidate"), alice)
                .andExpect(status().isOk)
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
            .andExpect(jsonPath("$.code").value("consent_revoked"))

        val unsafePdf = (
            "%PDF-1.7\n" +
                "synthetic-but-not-allowlisted-and-long-enough-to-reach-the-allowlist-boundary\n" +
                "%%EOF\n"
            ).toByteArray()
        mutate(
            post("/api/foundation/candidates/$candidateId/confirmation")
                .header("Idempotency-Key", "confirm-after-revoke")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "191"))),
            alice,
        ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("consent_revoked"))

        mutate(
            post("/api/foundation/documents")
                .header("Idempotency-Key", "doc-request-bob-bad")
                .contentType(MediaType.APPLICATION_JSON)
                .content(documentRequest(bobConsentId, unsafePdf)),
            bob,
        ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("synthetic_fixture_required"))

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
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$aliceDocumentId.pdf"))).isFalse()

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

    @Test
    fun failsClosedAcrossExclusionCorrectionExpiryAndObjectOwnership() {
        var alice = login("synthetic-alice")
        val bob = login("synthetic-bob")
        val aliceConsentId = grantConsent(alice)
        grantConsent(bob)

        mockMvc.perform(
            post("/api/foundation/consents/$aliceConsentId/revocation")
                .cookie(bob.cookie)
                .header(HttpHeaders.ORIGIN, allowedOrigin)
                .header(FOUNDATION_CSRF_HEADER, bob.csrf),
        ).andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("consent_not_found"))

        mockMvc.perform(
            post("/api/foundation/consents/$aliceConsentId/revocation")
                .cookie(alice.cookie)
                .header(FOUNDATION_CSRF_HEADER, alice.csrf),
        ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("origin_denied"))

        val excludedCandidate = createCandidate(alice, aliceConsentId, "exclude")
        mutate(
            post("/api/foundation/candidates/$excludedCandidate/exclusion")
                .header("Idempotency-Key", "exclude-candidate-once"),
            alice,
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("EXCLUDED"))

        mutate(
            post("/api/foundation/candidates/$excludedCandidate/exclusion")
                .header("Idempotency-Key", "exclude-candidate-once"),
            alice,
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("EXCLUDED"))

        mutate(
            post("/api/foundation/candidates/$excludedCandidate/confirmation")
                .header("Idempotency-Key", "confirm-excluded-candidate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "188"))),
            alice,
        ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("candidate_not_pending"))

        mutate(put("/api/foundation/candidates/$excludedCandidate/confirmation"), alice)
            .andExpect(status().isMethodNotAllowed)

        val candidateId = createCandidate(alice, aliceConsentId, "correct")
        val created = responseJson(
            mutate(
                post("/api/foundation/candidates/$candidateId/confirmation")
                    .header("Idempotency-Key", "confirm-before-correction")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to "188"))),
                alice,
            ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsByteArray,
        )
        val recordId = UUID.fromString(created["recordId"].asText())
        val originalVersionId = created["recordVersionId"].asText()

        read(get("/api/foundation/records").queryParam("subjectId", "synthetic-bob"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].recordId").value(recordId.toString()))

        read(get("/api/foundation/records/${UUID.randomUUID()}"), alice)
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("record_not_found"))

        mutate(
            post("/api/foundation/records/$recordId/corrections")
                .header("Idempotency-Key", "bob-cannot-correct-alice")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "189", "reason" to "합성 공격 테스트"))),
            bob,
        ).andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("record_not_found"))

        val corrected = responseJson(
            mutate(
                post("/api/foundation/records/$recordId/corrections")
                    .header("Idempotency-Key", "alice-correction-version-2")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to "189", "reason" to "합성 원문 재확인"))),
                alice,
            ).andExpect(status().isOk)
                .andExpect(jsonPath("$.value").value("189"))
                .andExpect(jsonPath("$.supersedesVersionId").value(originalVersionId))
                .andReturn()
                .response
                .contentAsByteArray,
        )
        val correctedVersionId = corrected["recordVersionId"].asText()
        assertThat(correctedVersionId).isNotEqualTo(originalVersionId)
        assertThat(count("gc_health_record_version")).isEqualTo(2)
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM gc_health_record_version WHERE record_id = ? AND status = 'CURRENT'",
                Long::class.java,
                recordId,
            ),
        ).isEqualTo(1)

        val replay = responseJson(
            mutate(
                post("/api/foundation/records/$recordId/corrections")
                    .header("Idempotency-Key", "alice-correction-version-2")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to "189", "reason" to "합성 원문 재확인"))),
                alice,
            ).andExpect(status().isOk)
                .andReturn()
                .response
                .contentAsByteArray,
        )
        assertThat(replay["recordVersionId"].asText()).isEqualTo(correctedVersionId)
        assertThat(count("gc_health_record_version")).isEqualTo(2)

        jdbc.update(
            """
            UPDATE gc_session
            SET created_at = CURRENT_TIMESTAMP - INTERVAL '2 seconds',
                expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'
            WHERE token_hash = ?
            """.trimIndent(),
            FoundationHashing.sha256(alice.cookie.value),
        )
        read(get("/api/foundation/records"), alice)
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.code").value("session_invalid"))

        alice = login("synthetic-alice")
        mutate(delete("/api/foundation/profile"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("COMPLETED"))

        mutate(
            post("/api/foundation/records/$recordId/corrections")
                .header("Idempotency-Key", "stale-correction-after-delete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "190", "reason" to "삭제 뒤 재생"))),
            alice,
        ).andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.code").value("session_invalid"))
    }

    @Test
    fun completesTheDocumentOnlyAfterEveryOrderedCandidateIsReviewed() {
        val alice = login("synthetic-alice")
        val bob = login("synthetic-bob")
        val aliceConsentId = grantConsent(alice)
        grantConsent(bob)

        val documentId = requestDocument(alice, aliceConsentId, fixturePdf, "multi-candidate-review")

        read(get("/api/foundation/documents/$documentId/candidates"), alice)
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("candidate_not_ready"))

        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice)
            .andExpect(status().isAccepted)
        runWorkerPipeline(documentId)

        assertThat(count("gc_candidate")).isEqualTo(3)

        val listed = responseJson(
            read(get("/api/foundation/documents/$documentId/candidates"), alice)
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].ordinal").value(1))
                .andExpect(jsonPath("$[0].label").value("총콜레스테롤"))
                .andExpect(jsonPath("$[0].value").value("188"))
                .andExpect(jsonPath("$[1].ordinal").value(2))
                .andExpect(jsonPath("$[1].label").value("당화혈색소"))
                .andExpect(jsonPath("$[1].value").value("5.2"))
                .andExpect(jsonPath("$[2].ordinal").value(3))
                .andExpect(jsonPath("$[2].label").value("비타민 D"))
                .andExpect(jsonPath("$[2].value").value("42"))
                .andReturn()
                .response
                .contentAsByteArray,
        )
        assertThat(listed.map { it["totalCandidates"].asInt() }).containsExactly(3, 3, 3)
        assertThat(listed.map { it["status"].asText() }).containsExactly("PENDING", "PENDING", "PENDING")
        val candidateIds = listed.map { UUID.fromString(it["candidateId"].asText()) }

        read(get("/api/foundation/documents/$documentId/candidates"), bob)
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("document_not_found"))
        read(get("/api/foundation/documents/$documentId/candidate"), bob)
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("document_not_found"))
        read(get("/api/foundation/documents/${UUID.randomUUID()}/candidates"), alice)
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("document_not_found"))

        val firstRecord = responseJson(
            mutate(
                post("/api/foundation/candidates/${candidateIds[0]}/confirmation")
                    .header("Idempotency-Key", "confirm-multi-ordinal-1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to "188"))),
                alice,
            ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsByteArray,
        )
        assertThat(documentStatus(documentId)).isEqualTo("REVIEW_REQUIRED")

        read(get("/api/foundation/documents/$documentId/candidate"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ordinal").value(2))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.totalCandidates").value(3))

        val replayedRecord = responseJson(
            mutate(
                post("/api/foundation/candidates/${candidateIds[0]}/confirmation")
                    .header("Idempotency-Key", "confirm-multi-ordinal-1-replay")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to "188"))),
                alice,
            ).andExpect(status().isCreated)
                .andReturn()
                .response
                .contentAsByteArray,
        )
        assertThat(replayedRecord["recordId"].asText()).isEqualTo(firstRecord["recordId"].asText())
        assertThat(count("gc_health_record")).isEqualTo(1)
        assertThat(documentStatus(documentId)).isEqualTo("REVIEW_REQUIRED")

        mutate(
            post("/api/foundation/candidates/${candidateIds[1]}/exclusion")
                .header("Idempotency-Key", "exclude-multi-ordinal-2"),
            alice,
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("EXCLUDED"))
            .andExpect(jsonPath("$.ordinal").value(2))
        assertThat(documentStatus(documentId)).isEqualTo("REVIEW_REQUIRED")

        read(get("/api/foundation/documents/$documentId/candidate"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ordinal").value(3))
            .andExpect(jsonPath("$.status").value("PENDING"))

        mutate(
            post("/api/foundation/candidates/${candidateIds[2]}/confirmation")
                .header("Idempotency-Key", "confirm-multi-ordinal-3")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "42"))),
            alice,
        ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.value").value("42"))
        assertThat(documentStatus(documentId)).isEqualTo("COMPLETED")

        read(get("/api/foundation/records"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(2))

        read(get("/api/foundation/documents/$documentId/candidate"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ordinal").value(1))
            .andExpect(jsonPath("$.status").value("CONFIRMED"))

        read(get("/api/foundation/documents/$documentId/candidates"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(3))
            .andExpect(jsonPath("$[0].status").value("CONFIRMED"))
            .andExpect(jsonPath("$[1].status").value("EXCLUDED"))
            .andExpect(jsonPath("$[2].status").value("CONFIRMED"))

        mutate(post("/api/foundation/consents/$aliceConsentId/revocation"), alice)
            .andExpect(status().isOk)
        read(get("/api/foundation/documents/$documentId/candidates"), alice)
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("consent_revoked"))
        read(get("/api/foundation/documents/$documentId/candidate"), alice)
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("consent_revoked"))
    }

    @Test
    fun boundDigestSelectsItsNamedCandidateSetWhileAnUnboundDigestKeepsTheDefault() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)

        val januaryCandidates =
            importSyntheticDocument(alice, consentId, januaryFixturePdf, januaryFixtureDigest, "january")
        assertThat(januaryCandidates.map { it["label"].asText() })
            .containsExactly("총콜레스테롤", "당화혈색소", "비타민 D")
        assertThat(januaryCandidates.map { it["value"].asText() }).containsExactly("194", "5.4", "45")
        assertThat(januaryCandidates.map { it["observedOn"].asText() }.distinct())
            .containsExactly("2026-01-15")
        confirmEveryCandidate(alice, januaryCandidates, "january")

        val julyCandidates =
            importSyntheticDocument(alice, consentId, fixturePdf, fixtureDigest, "july")
        assertThat(julyCandidates.map { it["label"].asText() })
            .containsExactly("총콜레스테롤", "당화혈색소", "비타민 D")
        assertThat(julyCandidates.map { it["value"].asText() }).containsExactly("188", "5.2", "42")
        assertThat(julyCandidates.map { it["observedOn"].asText() }.distinct())
            .containsExactly("2026-07-28")
        confirmEveryCandidate(alice, julyCandidates, "july")

        val records = responseJson(
            read(get("/api/foundation/records"), alice)
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.length()").value(6))
                .andReturn()
                .response
                .contentAsByteArray,
        ).toList()

        assertThat(
            records.map {
                listOf(
                    it["label"].asText(),
                    it["value"].asText(),
                    it["unit"].asText(),
                    it["observedOn"].asText(),
                ).joinToString("|")
            },
        ).containsExactlyInAnyOrder(
            "총콜레스테롤|194|mg/dL|2026-01-15",
            "당화혈색소|5.4|%|2026-01-15",
            "비타민 D|45|ng/mL|2026-01-15",
            "총콜레스테롤|188|mg/dL|2026-07-28",
            "당화혈색소|5.2|%|2026-07-28",
            "비타민 D|42|ng/mL|2026-07-28",
        )
        assertThat(records.map { it["status"].asText() }.distinct()).containsExactly("CURRENT")
        assertThat(records.map { it["documentSha256"].asText() }.distinct())
            .containsExactlyInAnyOrder(fixtureDigest, januaryFixtureDigest)
    }

    private fun importSyntheticDocument(
        client: TestClient,
        consentId: UUID,
        pdf: ByteArray,
        digest: String,
        keyPrefix: String,
    ): List<JsonNode> {
        val documentId = requestDocument(client, consentId, pdf, "$keyPrefix-document-request")
        uploadDocument(client, documentId, pdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), client)
            .andExpect(status().isAccepted)
        runWorkerPipeline(documentId, sourceSha256 = digest)
        return responseJson(
            read(get("/api/foundation/documents/$documentId/candidates"), client)
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.length()").value(3))
                .andReturn()
                .response
                .contentAsByteArray,
        ).toList()
    }

    private fun confirmEveryCandidate(
        client: TestClient,
        candidates: List<JsonNode>,
        keyPrefix: String,
    ) {
        candidates.forEach { candidate ->
            mutate(
                post("/api/foundation/candidates/${candidate["candidateId"].asText()}/confirmation")
                    .header("Idempotency-Key", "$keyPrefix-confirm-${candidate["ordinal"].asInt()}")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to candidate["value"].asText()))),
                client,
            ).andExpect(status().isCreated)
        }
    }

    private fun createCandidate(
        client: TestClient,
        consentId: UUID,
        keySuffix: String,
    ): UUID {
        val documentId = requestDocument(
            client,
            consentId,
            fixturePdf,
            "document-$keySuffix-request",
        )
        uploadDocument(client, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), client)
            .andExpect(status().isAccepted)
        runWorkerPipeline(documentId)
        val response = read(get("/api/foundation/documents/$documentId/candidate"), client)
            .andExpect(status().isOk)
            .andReturn()
            .response
        return UUID.fromString(responseJson(response.contentAsByteArray)["candidateId"].asText())
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
        val body = responseJson(response.contentAsByteArray)
        val documentId = UUID.fromString(body["document"]["documentId"].asText())
        uploadCapabilities[documentId] = TestUploadCapability(
            capabilityId = UUID.fromString(body["uploadCapability"]["capabilityId"].asText()),
            rawToken = body["uploadCapability"]["requiredHeaders"]["X-GC-Upload-Capability"].asText(),
        )
        return documentId
    }

    private fun documentRequest(consentId: UUID, content: ByteArray): String =
        json(
            mapOf(
                "consentId" to consentId,
                "mediaType" to "application/pdf",
                "contentLength" to content.size,
                "sha256" to FoundationHashing.sha256(content),
            ),
        )

    private fun uploadDocument(client: TestClient, documentId: UUID, content: ByteArray) =
        uploadCapabilities.getValue(documentId).let { capability ->
            mutate(
                put("/api/foundation/documents/$documentId/content")
                    .header("X-GC-Upload-Capability-Id", capability.capabilityId)
                    .header("X-GC-Upload-Capability", capability.rawToken)
                    .contentType(MediaType.APPLICATION_PDF)
                    .content(content),
                client,
            )
        }

    private fun runWorkerPipeline(
        documentId: UUID,
        simulateTransientExtractionFailure: Boolean = false,
        sourceSha256: String = fixtureDigest,
    ) {
        val inspectionLease = checkNotNull(workerService.lease("a".repeat(64)))
        assertThat(inspectionLease.jobType).isEqualTo("SECURITY_INSPECTION")
        assertThat(inspectionLease.jobId).isNotNull()
        workerService.completeInspection(
            inspectionLease.jobId,
            inspectionLease.leaseToken,
            approvedInspectionRequest(sourceSha256),
        )
        var extractionLease = checkNotNull(workerService.lease("a".repeat(64)))
        assertThat(extractionLease.jobType).isEqualTo("SYNTHETIC_EXTRACTION")
        if (simulateTransientExtractionFailure) {
            workerService.failJob(
                extractionLease.jobId,
                extractionLease.leaseToken,
                WorkerFailureRequest("simulated_transient_preview_failure", retryable = true),
            )
            jdbc.update(
                "UPDATE gc_document_job SET available_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE job_id = ?",
                extractionLease.jobId,
            )
            extractionLease = checkNotNull(workerService.lease("a".repeat(64)))
            assertThat(extractionLease.attempt).isEqualTo(2)
        }
        workerService.completeExtraction(
            extractionLease.jobId,
            extractionLease.leaseToken,
            ExtractionResultRequest(
                sourceSha256 = sourceSha256,
                workerImageDigest = "b".repeat(64),
                generatorVersion = "test-worker-v1",
                previewPngBase64 = onePixelPngBase64,
            ),
        )
        assertThat(
            jdbc.queryForObject(
                "SELECT status FROM gc_document WHERE document_id = ?",
                String::class.java,
                documentId,
            ),
        ).isEqualTo("REVIEW_REQUIRED")
    }

    private fun approvedInspectionRequest(sourceSha256: String = fixtureDigest) = InspectionResultRequest(
        decision = kr.co.genomecompanion.documentboundary.InspectionDecision.APPROVED,
        reason = kr.co.genomecompanion.documentboundary.InspectionReason.CLEAN,
        sourceSha256 = sourceSha256,
        identifiedMediaType = "application/pdf",
        pageCount = 1,
        indirectObjectCount = 8,
        totalImagePixels = 0,
        encrypted = false,
        activeContent = false,
        embeddedFiles = false,
        policyVersion = "pdf-security-v1",
        scannerName = "SyntheticManifestScanner",
        scannerVersion = "test-only-v1",
        signatureVersion = "allowlisted-fixture",
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

    private fun documentStatus(documentId: UUID): String? =
        jdbc.queryForObject(
            "SELECT status FROM gc_document WHERE document_id = ?",
            String::class.java,
            documentId,
        )

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
        private val fixturePdf =
            "%PDF-1.7\nGenome Companion synthetic fixture only; no real health data.\n%%EOF\n".toByteArray()
        private val fixtureDigest = FoundationHashing.sha256(fixturePdf)
        private val januaryFixturePdf =
            "%PDF-1.7\nGenome Companion synthetic fixture 2026-01 only; no real health data.\n%%EOF\n"
                .toByteArray()
        private val januaryFixtureDigest = FoundationHashing.sha256(januaryFixturePdf)
        private const val onePixelPngBase64 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        private val quarantineRoot: Path = Path.of(
            System.getenv("GC_TEST_QUARANTINE_ROOT") ?: System.getProperty("java.io.tmpdir"),
        ).resolve("gc-foundation-postgres-integration").toAbsolutePath().normalize()

        @JvmStatic
        @DynamicPropertySource
        fun foundationProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url") { checkNotNull(System.getenv("GC_TEST_POSTGRES_URL")) }
            registry.add("spring.datasource.username") { "postgres" }
            registry.add("spring.datasource.password") { "" }
            registry.add("security.oidc.enabled") { "true" }
            registry.add("security.oidc.issuer") { "https://issuer.test.invalid" }
            registry.add("security.oidc.jwk-set-uri") { "https://issuer.test.invalid/.well-known/jwks.json" }
            registry.add("security.oidc.audience") { "https://api.genome-companion.test" }
            registry.add("security.oidc.client-id") { "synthetic-web-client" }
            registry.add("gc.foundation.enabled") { "true" }
            registry.add("gc.foundation.document-boundary-enabled") { "true" }
            registry.add("gc.foundation.worker-credential-sha256") { "c".repeat(64) }
            registry.add("gc.foundation.allow-synthetic-scanner-results") { "true" }
            registry.add("gc.foundation.allowed-origin") { allowedOrigin }
            registry.add("gc.foundation.secure-cookies") { "false" }
            registry.add("gc.foundation.quarantine-root") { quarantineRoot.toString() }
            registry.add("gc.foundation.audit-pepper") {
                "foundation-integration-test-pepper-64-characters-minimum-value"
            }
            registry.add("gc.foundation.allowed-document-sha256") { "$fixtureDigest,$januaryFixtureDigest" }
            registry.add("gc.foundation.synthetic-documents[0].sha256") { januaryFixtureDigest }
            registry.add("gc.foundation.synthetic-documents[0].set-id") { "checkup-2026-01" }
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
