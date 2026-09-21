package kr.co.genomecompanion.foundation

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.Cookie
import kr.co.genomecompanion.documentboundary.WorkerIdentity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
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
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
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

    @Autowired
    private lateinit var conceptSource: JdbcMedicalConceptSource

    @Autowired
    private lateinit var repository: FoundationRepository

    @Autowired
    private lateinit var documentStorage: FoundationDocumentStorage

    @Autowired
    private lateinit var foundationProperties: FoundationProperties

    @Autowired
    private lateinit var clock: java.time.Clock

    @Autowired
    private lateinit var sessionRateLimiter: SessionRateLimiter

    @Autowired
    private lateinit var janitor: FoundationJanitor

    private val uploadCapabilities = mutableMapOf<UUID, TestUploadCapability>()

    private val faultyDocumentStorage: FaultInjectingFoundationDocumentStorage
        get() = documentStorage as FaultInjectingFoundationDocumentStorage

    @TestConfiguration
    class PreviewDeleteFaultInjectionConfig {
        // @Primary so this replaces the real FoundationDocumentStorage bean for every test in this class;
        // see FaultInjectingFoundationDocumentStorage for why (a platform-independent, deterministic
        // stand-in for the filesystem-permission fault injection that CI's root-executed Linux runner
        // silently defeats).
        @Bean
        @Primary
        fun documentStorage(properties: FoundationProperties): FoundationDocumentStorage =
            FaultInjectingFoundationDocumentStorage(properties)
    }

    @BeforeEach
    fun resetSyntheticDatabase() {
        sessionRateLimiter.clear()
        faultyDocumentStorage.reset()
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
        // The quarantine root outlives a single test, but the database does not: leaving a previous
        // test's files on disk would make every one of them an orphan to the janitor (nothing points
        // at them after the TRUNCATE above), so disk and database are reset together.
        Files.createDirectories(quarantineRoot)
        Files.walk(quarantineRoot).use { paths ->
            paths.filter(Files::isRegularFile).forEach(Files::delete)
        }
        uploadCapabilities.clear()
    }

    @Test
    fun demoBootstrapIsOriginBoundOwnerIsolatedAndDoesNotGrantConsent() {
        mockMvc.perform(post("/api/foundation/demo-session"))
            .andExpect(status().isForbidden)
        mockMvc.perform(post("/api/foundation/demo-session").header(HttpHeaders.ORIGIN, "https://attacker.invalid"))
            .andExpect(status().isForbidden)
        val first = mockMvc.perform(post("/api/foundation/demo-session").header(HttpHeaders.ORIGIN, allowedOrigin).header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE))
            .andExpect(status().isCreated).andReturn().response
        val second = mockMvc.perform(post("/api/foundation/demo-session").header(HttpHeaders.ORIGIN, allowedOrigin).header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE))
            .andExpect(status().isCreated).andReturn().response
        val firstBody = responseJson(first.contentAsByteArray)
        assertThat(firstBody["subjectId"].asText()).startsWith("synthetic-demo-")
        assertThat(firstBody["subjectId"].asText()).isNotEqualTo(responseJson(second.contentAsByteArray)["subjectId"].asText())
        val cookie = checkNotNull(first.getCookie(FOUNDATION_SESSION_COOKIE))
        assertThat(cookie.isHttpOnly).isTrue()
        mockMvc.perform(get("/api/foundation/records").cookie(cookie))
            .andExpect(status().isOk).andExpect(jsonPath("$.length()").value(0))
        mockMvc.perform(get("/api/foundation/consents/document-extraction").cookie(cookie))
            .andExpect(status().isOk).andExpect(jsonPath("$.status").value("NOT_GRANTED"))
        mockMvc.perform(post("/api/foundation/consents/document-extraction").cookie(cookie)
            .header(HttpHeaders.ORIGIN, allowedOrigin))
            .andExpect(status().isForbidden)
        assertThat(count("gc_subject")).isEqualTo(2)
    }

    @Test
    fun demoBootstrapHasDurableGlobalProvisioningBudget() {
        repeat(20) {
            mockMvc.perform(post("/api/foundation/demo-session").header(HttpHeaders.ORIGIN, allowedOrigin).header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE))
                .andExpect(status().isCreated)
        }
        mockMvc.perform(post("/api/foundation/demo-session").header(HttpHeaders.ORIGIN, allowedOrigin).header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE))
            .andExpect(status().isTooManyRequests)
        assertThat(count("gc_subject")).isEqualTo(20)
    }

    @Test
    fun demoCapacityCountsActiveSubjectsAndReturnsOnDeletion() {
        jdbc.execute("""
            INSERT INTO gc_subject(subject_id, created_at, deleted_at)
            SELECT 'synthetic-demo-retired-' || n, CURRENT_TIMESTAMP - INTERVAL '1 day', NULL
            FROM generate_series(1, 1000) AS n
        """.trimIndent())
        val response = mockMvc.perform(post("/api/foundation/demo-session").header(HttpHeaders.ORIGIN, allowedOrigin).header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("demo_capacity_exhausted"))
            .andReturn().response
        assertThat(response.getHeader("Retry-After")).isNull()
        assertThat(count("gc_subject")).isEqualTo(1000)

        jdbc.update("UPDATE gc_subject SET deleted_at = CURRENT_TIMESTAMP WHERE subject_id = 'synthetic-demo-retired-1'")
        mockMvc.perform(post("/api/foundation/demo-session").header(HttpHeaders.ORIGIN, allowedOrigin).header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE))
            .andExpect(status().isCreated)
    }

    @Test
    fun fiveWrongCredentialsLockTheSubjectAndAnUnknownSubjectLeavesNoAuditRow() {
        // The unknown-subject probe runs from a different client IP: the IP bucket is shared
        // across subjects (any five failures from one IP lock that IP, by design), so sharing it
        // with bob's five attempts below would lock bob's IP one attempt early on an unrelated
        // probe. Isolating the IPs keeps this test about the subject-level lock it names.
        fun attempt(subject: String, credential: String, remoteAddr: String = "127.0.0.1") = mockMvc.perform(
            post("/api/foundation/session").header(HttpHeaders.ORIGIN, allowedOrigin)
                .header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("subjectId" to subject, "credential" to credential)))
                .with { request -> request.remoteAddr = remoteAddr; request },
        )
        attempt("synthetic-nobody", "definitely-not-a-configured-credential-000", remoteAddr = "203.0.113.5")
            .andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("local_identity_denied"))
        assertThat(count("gc_audit_event")).isZero()
        repeat(5) { attempt("synthetic-bob", "wrong-credential-value-with-32-characters").andExpect(status().isForbidden) }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'LOCAL_IDENTITY_DENIED'", Long::class.java)).isEqualTo(5L)
        attempt("synthetic-bob", bobCredential).andExpect(status().isTooManyRequests).andExpect(jsonPath("$.code").value("login_locked"))
            .andExpect(header().string("Retry-After", "900"))
        sessionRateLimiter.clear()
        attempt("synthetic-bob", bobCredential).andExpect(status().isCreated)
    }

    @Test
    fun forwardedForHeaderDoesNotMoveTheLoginLockOffTheRealSocketAddress() {
        // application.yml pins server.forward-headers-strategy to none, so no ForwardedHeaderFilter
        // rewrites remoteAddr: a client cannot rotate X-Forwarded-For to escape its own IP bucket.
        // Each attempt uses a different unknown subject, so only the shared client-IP bucket can
        // produce the lock: if X-Forwarded-For still decided the key, six rotating values would
        // each get their own fresh bucket and nothing would ever lock.
        fun probe(subject: String, forwardedFor: String) = mockMvc.perform(
            post("/api/foundation/session")
                .header(HttpHeaders.ORIGIN, allowedOrigin)
                .header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE)
                .header("X-Forwarded-For", forwardedFor)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json(
                        mapOf(
                            "subjectId" to subject,
                            "credential" to "wrong-credential-value-with-32-characters",
                        ),
                    ),
                )
                .with { request -> request.remoteAddr = "198.51.100.7"; request },
        )
        repeat(5) { index ->
            probe("synthetic-forwarded-probe-$index", "203.0.113.${index + 10}")
                .andExpect(status().isForbidden)
                .andExpect(jsonPath("$.code").value("local_identity_denied"))
        }
        probe("synthetic-forwarded-probe-last", "203.0.113.99")
            .andExpect(status().isTooManyRequests)
            .andExpect(jsonPath("$.code").value("login_locked"))
    }

    @Test
    fun stateChangesNeedTheRequestedWithHeaderAndLogoutEndsTheSessionWithoutSliding() {
        val alice = login("synthetic-alice")
        mockMvc.perform(
            post("/api/foundation/consents/document-extraction").cookie(alice.cookie)
                .header(HttpHeaders.ORIGIN, allowedOrigin).header(FOUNDATION_CSRF_HEADER, alice.csrf),
        )
            .andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("requested_with_denied"))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
        mockMvc.perform(
            post("/api/foundation/consents/document-extraction").cookie(alice.cookie)
                .header(HttpHeaders.ORIGIN, allowedOrigin).header(FOUNDATION_CSRF_HEADER, alice.csrf)
                .header("X-Requested-With", "XMLHttpRequest"),
        )
            .andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("requested_with_denied"))
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'REQUEST_REQUESTED_WITH_DENIED'",
                Long::class.java,
            ),
        ).isEqualTo(2L)
        grantConsent(alice)
        val expiresBefore = jdbc.queryForObject(
            "SELECT expires_at FROM gc_session WHERE subject_id = 'synthetic-alice'",
            java.time.OffsetDateTime::class.java,
        )
        read(get("/api/foundation/session"), alice).andExpect(status().isOk)
        assertThat(
            jdbc.queryForObject(
                "SELECT expires_at FROM gc_session WHERE subject_id = 'synthetic-alice'",
                java.time.OffsetDateTime::class.java,
            ),
        ).isEqualTo(expiresBefore)
        val logout = mutate(post("/api/foundation/session/logout"), alice)
            .andExpect(status().isNoContent).andReturn().response
        assertThat(logout.getCookie(FOUNDATION_SESSION_COOKIE)!!.maxAge).isZero()
        assertThat(logout.getCookie(FOUNDATION_CSRF_COOKIE)!!.maxAge).isZero()
        assertThat(logout.getHeaders(HttpHeaders.SET_COOKIE)).allMatch { it.contains("SameSite=Strict") }
        assertThat(logout.getHeaders(HttpHeaders.SET_COOKIE)).noneMatch { it.contains("Secure") }
        read(get("/api/foundation/session"), alice)
            .andExpect(status().isUnauthorized).andExpect(jsonPath("$.code").value("session_invalid"))
        assertThat(
            jdbc.queryForObject(
                "SELECT revoked_at IS NOT NULL FROM gc_session WHERE subject_id = 'synthetic-alice'",
                Boolean::class.java,
            ),
        ).isTrue()
        mockMvc.perform(get("/actuator/prometheus")).andExpect(status().isNotFound)
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk)
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
        // The V3 trigger fires `before update or delete`; UPDATE alone only proves half of it, and
        // `release/readiness.json`'s external_audit_anchor evidence claims both. DELETE is the half
        // that matters most for an append-only claim, so it is asserted here rather than inferred
        // from the trigger definition. (The gc_audit_event equivalent already asserts both.)
        org.assertj.core.api.Assertions.assertThatThrownBy {
            jdbc.update("DELETE FROM security_audit_event WHERE event_id = ?", eventId)
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
    fun obsoleteInspectionPolicyCannotPromoteSource() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "synthetic-obsolete-policy")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice)
            .andExpect(status().isAccepted)
        val lease = checkNotNull(workerService.lease("a".repeat(64)))
        val receipt = workerService.completeInspection(
            lease.jobId,
            lease.leaseToken,
            approvedInspectionRequest().copy(policyVersion = "pdf-security-v1"),
        )
        assertThat(receipt.status).isEqualTo("DEAD_LETTER")
        assertThat(jdbc.queryForObject(
            "SELECT approved_object_key FROM gc_document WHERE document_id = ?",
            String::class.java,
            documentId,
        )).isNull()
        assertThat(workerService.lease("a".repeat(64))).isNull()
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
            candidates = julyCandidates,
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
                .header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE)
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
        assertThat(auditRowsContaining("2026-07-28")).isEmpty()
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
                .header(FOUNDATION_CSRF_HEADER, bob.csrf)
                .header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE),
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

        mutate(
            post("/api/foundation/candidates/${candidateIds[0]}/confirmation")
                .header("Idempotency-Key", "confirm-multi-ordinal-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "188"))),
            alice,
        ).andExpect(status().isCreated)
        assertThat(documentStatus(documentId)).isEqualTo("REVIEW_REQUIRED")

        read(get("/api/foundation/documents/$documentId/candidate"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ordinal").value(2))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.totalCandidates").value(3))

        // A different (non-matching) Idempotency-Key against an already-CONFIRMED candidate is not a
        // replay: the row's locked state has genuinely changed under this request, so it is a 409, not a
        // silent success. Only a matching key (the same-key replay case exercised elsewhere in this class)
        // returns the original record.
        mutate(
            post("/api/foundation/candidates/${candidateIds[0]}/confirmation")
                .header("Idempotency-Key", "confirm-multi-ordinal-1-not-a-replay")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "188"))),
            alice,
        ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("candidate_state_changed"))
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
    fun revokingDocumentExtractionTerminatesReviewAndInFlightDocumentsAndDeletesTheirFiles() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val reviewing = requestDocument(alice, consentId, fixturePdf, "revoke-review")
        uploadDocument(alice, reviewing, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$reviewing/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(reviewing)
        val confirmed = importSyntheticDocument(alice, consentId, januaryFixturePdf, januaryFixtureDigest, "revoke-done")
        confirmEveryCandidate(alice, confirmed, "revoke-done")
        val inFlight = requestDocument(alice, consentId, fixturePdf, "revoke-inflight")
        uploadDocument(alice, inFlight, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$inFlight/finalization"), alice).andExpect(status().isAccepted)
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$reviewing.pdf"))).isTrue()

        mutate(post("/api/foundation/consents/$consentId/revocation"), alice).andExpect(status().isOk)

        assertThat(documentStatus(reviewing)).isEqualTo("TERMINATED_BY_REVOCATION")
        assertThat(documentStatus(inFlight)).isEqualTo("TERMINATED_BY_REVOCATION")
        assertThat(documentStatus(confirmed.first()["documentId"].asText().let(UUID::fromString))).isEqualTo("COMPLETED")
        assertThat(jdbc.queryForList("SELECT status FROM gc_document_job WHERE document_id IN (?, ?)", String::class.java, reviewing, inFlight)).allMatch { it in setOf("DEAD_LETTER", "COMPLETED") }
        assertThat(jdbc.queryForObject("SELECT failure_code FROM gc_document WHERE document_id = ?", String::class.java, reviewing)).isEqualTo("consent_revoked")
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$reviewing.pdf"))).isFalse()
        assertThat(Files.list(quarantineRoot.resolve("approved_source")).filter { it.fileName.toString().startsWith(reviewing.toString()) }.count()).isZero()
        assertThat(Files.list(quarantineRoot.resolve("derived_safe_artifact")).filter { it.fileName.toString().startsWith(reviewing.toString()) }.count()).isZero()
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$inFlight.pdf"))).isFalse()
        // The preview file delete succeeded (asserted above), so reviewing's gc_preview_artifact row is gone
        // too — the row must never outlive a confirmed-deleted file (see deletePreviewArtifactIfExists's
        // contract). The still-COMPLETED January document's own preview row is untouched by revocation.
        assertThat(count("gc_preview_artifact")).isEqualTo(1)
        // The person can still see the terminated document and its status; candidates are no longer reachable.
        read(get("/api/foundation/documents/$reviewing"), alice).andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("TERMINATED_BY_REVOCATION")).andExpect(jsonPath("$.previewAvailable").value(false))
        read(get("/api/foundation/documents/$reviewing/candidates"), alice).andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("consent_revoked"))
        read(get("/api/foundation/records"), alice).andExpect(jsonPath("$.length()").value(3))
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'DOCUMENT_TERMINATED_BY_REVOCATION'", Long::class.java)).isEqualTo(2L)
        // Re-consent: a new grant works, the terminated documents stay terminated, a new upload is required.
        val newConsent = grantConsent(alice)
        assertThat(newConsent).isNotEqualTo(consentId)
        assertThat(documentStatus(reviewing)).isEqualTo("TERMINATED_BY_REVOCATION")
    }

    @Test
    fun revocationRacingWorkerCompletionNeverDeadlocksAndAlwaysEndsTerminatedNotCompletedWithReadableCandidates() {
        // Before F5, terminateDocumentsForRevokedConsent locked gc_document then gc_document_job,
        // while every worker completion path (via requireLeasedJob's lockLeasedJob, `FOR UPDATE OF
        // j`) locks gc_document_job then gc_document — a lock-order cycle that Postgres's deadlock
        // detector could abort either side of. After F5 both paths lock jobs before documents, so
        // this race must resolve without either thread ever seeing a deadlock, and — because this
        // fixture's extraction always yields non-empty candidates (REVIEW_REQUIRED, itself still a
        // terminable status) — revocation must always eventually re-catch and terminate the
        // document, regardless of which thread's transaction commits first.
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "f5-race-document")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        val inspectionLease = checkNotNull(workerService.lease("a".repeat(64)))
        workerService.completeInspection(inspectionLease.jobId, inspectionLease.leaseToken, approvedInspectionRequest())
        val extractionLease = checkNotNull(workerService.lease("a".repeat(64)))
        val resultRequest = ExtractionResultRequest(
            sourceSha256 = fixtureDigest,
            workerImageDigest = "b".repeat(64),
            generatorVersion = "test-worker-v1",
            previewPngBase64 = onePixelPngBase64,
            candidates = julyCandidates,
        )

        val results = race(2) { index ->
            if (index == 0) {
                workerService.completeExtraction(extractionLease.jobId, extractionLease.leaseToken, resultRequest)
            } else {
                service.revokeConsent(FoundationPrincipal("synthetic-alice", UUID.randomUUID(), "a".repeat(64)), consentId)
            }
        }

        // Neither side ever observes a Postgres deadlock/lock-timeout abort.
        assertThat(results.mapNotNull { it.exceptionOrNull() }).noneMatch { it is DataAccessException }
        // The worker either completed cleanly before revocation caught the document, or lost its
        // lease to revocation's dead-letter (an ordinary domain exception, not a deadlock).
        assertThat(results[0].exceptionOrNull()).matches { it == null || it is FoundationForbiddenException }
        // Revocation itself never fails.
        assertThat(results[1].isSuccess).isTrue()
        assertThat(documentStatus(documentId)).isEqualTo("TERMINATED_BY_REVOCATION")
        read(get("/api/foundation/documents/$documentId/candidates"), alice)
            .andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("consent_revoked"))
    }

    @Test
    fun deletingTheProfileRemovesAPreviewFileOrphanedByAFailedRevocationDelete() {
        // Revocation nulls gc_document.preview_object_key but deliberately keeps the
        // gc_preview_artifact row when the file delete itself fails (see the janitor-retry test
        // above). Before F6, deleteProfile's listObjectKeys read only gc_document's own three
        // columns, so once that column is null it never saw this key again — the file (and, after
        // this same deletion cascades gc_preview_artifact away, even the row a janitor could have
        // used to find it) would be orphaned forever. listObjectKeys must also see it via a
        // gc_preview_artifact left join.
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val reviewing = requestDocument(alice, consentId, fixturePdf, "f6-orphan-preview")
        uploadDocument(alice, reviewing, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$reviewing/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(reviewing)
        val previewPath = Files.list(quarantineRoot.resolve("derived_safe_artifact"))
            .filter { it.fileName.toString().startsWith(reviewing.toString()) }
            .findFirst()
            .orElseThrow()
        // Fault injection through the storage seam (see FaultInjectingFoundationDocumentStorage), not a
        // filesystem permission trick: a read-only bit is silently ignored by CI's root-executed Linux
        // runner, so that trick would never actually fail here.
        faultyDocumentStorage.failNextDeleteOf(previewPath.fileName.toString())
        mutate(post("/api/foundation/consents/$consentId/revocation"), alice).andExpect(status().isOk)
        assertThat(documentStatus(reviewing)).isEqualTo("TERMINATED_BY_REVOCATION")
        assertThat(
            jdbc.queryForObject("SELECT preview_object_key FROM gc_document WHERE document_id = ?", String::class.java, reviewing),
        ).isNull()
        assertThat(count("gc_preview_artifact")).isEqualTo(1)
        assertThat(Files.exists(previewPath)).isTrue()

        mutate(delete("/api/foundation/profile"), alice).andExpect(status().isOk)

        assertThat(Files.exists(previewPath)).isFalse()
    }

    @Test
    fun revokeConsentAndDeleteProfileDeleteFilesImmediatelyWhenCalledOutsideATransaction() {
        // Both revokeConsent and deleteProfile defer their file deletes to an afterCommit
        // TransactionSynchronization, which throws IllegalStateException if no transaction
        // synchronization is active. Bypass the @Transactional Spring proxy by constructing a raw
        // instance of the service directly (reusing the real, autowired repository/storage/clock),
        // so there genuinely is no active transaction — the guard must fall back to deleting the
        // files immediately instead of throwing (F7).
        val rawService = FoundationLifecycleService(repository, documentStorage, foundationProperties, clock, conceptSource, sessionRateLimiter, FoundationLogging())
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val untrusted = requestDocument(alice, consentId, fixturePdf, "f7-revoke-untrusted")
        uploadDocument(alice, untrusted, fixturePdf).andExpect(status().isOk)
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$untrusted.pdf"))).isTrue()
        val principal = FoundationPrincipal(subjectId = "synthetic-alice", sessionId = UUID.randomUUID(), sessionTokenHash = "a".repeat(64))

        val receipt = rawService.revokeConsent(principal, consentId)

        assertThat(receipt.status).isEqualTo("REVOKED")
        assertThat(documentStatus(untrusted)).isEqualTo("TERMINATED_BY_REVOCATION")
        // Deleted synchronously, inline — not deferred to a commit that will never come.
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$untrusted.pdf"))).isFalse()

        val secondUntrusted = requestDocument(alice, grantConsent(alice), fixturePdf, "f7-delete-untrusted")
        uploadDocument(alice, secondUntrusted, fixturePdf).andExpect(status().isOk)
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$secondUntrusted.pdf"))).isTrue()

        val deletionReceipt = rawService.deleteProfile(principal)

        assertThat(deletionReceipt.status).isEqualTo("COMPLETED")
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$secondUntrusted.pdf"))).isFalse()
    }

    @Test
    fun aFailedPreviewFileDeleteLeavesItsRowForTheJanitorAndASuccessfulOneRemovesIt() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val reviewing = requestDocument(alice, consentId, fixturePdf, "revoke-preview-review")
        uploadDocument(alice, reviewing, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$reviewing/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(reviewing)
        assertThat(count("gc_preview_artifact")).isEqualTo(1)
        val previewPath = Files.list(quarantineRoot.resolve("derived_safe_artifact"))
            .filter { it.fileName.toString().startsWith(reviewing.toString()) }
            .findFirst()
            .orElseThrow()
        // Fault injection through the storage seam (see FaultInjectingFoundationDocumentStorage), not a
        // filesystem permission trick: a read-only bit is silently ignored by CI's root-executed Linux
        // runner, so the after-commit hook's Files.deleteIfExists would never actually fail there. The
        // fault-injecting storage throws a genuine IOException for this one object key on its next
        // delete attempt instead, deterministically, on every platform.
        faultyDocumentStorage.failNextDeleteOf(previewPath.fileName.toString())

        mutate(post("/api/foundation/consents/$consentId/revocation"), alice).andExpect(status().isOk)

        assertThat(documentStatus(reviewing)).isEqualTo("TERMINATED_BY_REVOCATION")
        // The file delete failed, so the row must still be here for the Task 22 janitor to retry against.
        assertThat(Files.exists(previewPath)).isTrue()
        assertThat(count("gc_preview_artifact")).isEqualTo(1)

        // Simulating the janitor's later retry: once the file is actually gone, the row is safe to remove.
        Files.delete(previewPath)
        repository.deletePreviewArtifactIfExists(reviewing)
        assertThat(count("gc_preview_artifact")).isZero()
    }

    @Test
    fun reGrantingConsentAfterRevocationRequiresAFreshUploadAndTheNewDocumentReviewsNormally() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val terminated = requestDocument(alice, consentId, fixturePdf, "regrant-terminated")
        uploadDocument(alice, terminated, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$terminated/finalization"), alice).andExpect(status().isAccepted)

        mutate(post("/api/foundation/consents/$consentId/revocation"), alice).andExpect(status().isOk)
        assertThat(documentStatus(terminated)).isEqualTo("TERMINATED_BY_REVOCATION")

        val newConsent = grantConsent(alice)
        assertThat(newConsent).isNotEqualTo(consentId)
        // findLatestActiveDocument excludes TERMINATED_BY_REVOCATION, so re-consent alone never resumes it.
        read(get("/api/foundation/documents/active"), alice).andExpect(status().isOk)
            .andExpect(jsonPath("$.document").doesNotExist())

        val freshDocument = requestDocument(alice, newConsent, fixturePdf, "regrant-fresh")
        assertThat(freshDocument).isNotEqualTo(terminated)
        uploadDocument(alice, freshDocument, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$freshDocument/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(freshDocument)
        val candidateId = UUID.fromString(
            responseJson(
                read(get("/api/foundation/documents/$freshDocument/candidate"), alice)
                    .andExpect(status().isOk)
                    .andExpect(jsonPath("$.status").value("PENDING"))
                    .andReturn()
                    .response
                    .contentAsByteArray,
            )["candidateId"].asText(),
        )
        mutate(
            post("/api/foundation/candidates/$candidateId/confirmation")
                .header("Idempotency-Key", "regrant-fresh-confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "188"))),
            alice,
        ).andExpect(status().isCreated)
        assertThat(documentStatus(terminated)).isEqualTo("TERMINATED_BY_REVOCATION")
    }

    @Test
    fun deletionCommitsTheRowsBeforeTouchingFilesAndClearsIdempotencySessionAndCapabilityRows() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "delete-order")
        mutate(post("/api/foundation/candidates/$candidateId/confirmation").header("Idempotency-Key", "delete-order-confirm")
            .contentType(MediaType.APPLICATION_JSON).content(json(mapOf("value" to "188"))), alice).andExpect(status().isCreated)
        val subjectHash = FoundationHashing.sha256("foundation-integration-test-pepper-64-characters-minimum-value:synthetic-alice")
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_idempotency WHERE subject_hash = ?", Long::class.java, subjectHash)).isGreaterThan(0L)
        val keys = jdbc.queryForList("SELECT object_key FROM gc_document WHERE subject_id = 'synthetic-alice'", String::class.java)
        // Make the file deletion impossible to perform inside the transaction: lock the file by making the untrusted directory read-only is not
        // portable, so instead observe ordering through the audit sequence: PROFILE_DELETED is written in the same transaction
        // and must exist even when a file is already gone.
        keys.forEach { Files.deleteIfExists(quarantineRoot.resolve("untrusted").resolve(it)) }
        mutate(delete("/api/foundation/profile"), alice).andExpect(status().isOk).andExpect(jsonPath("$.status").value("COMPLETED"))
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_idempotency WHERE subject_hash = ?", Long::class.java, subjectHash)).isZero()
        assertThat(countForSubject("gc_session", "synthetic-alice")).isZero()
        assertThat(count("gc_upload_capability")).isZero()
        assertThat(countForSubject("gc_document", "synthetic-alice")).isZero()
        assertThat(jdbc.queryForObject("SELECT deleted_at IS NOT NULL FROM gc_subject WHERE subject_id = 'synthetic-alice'", Boolean::class.java)).isTrue()
    }

    @Test
    fun aFileDeletionFailureAfterCommitDoesNotUndoTheDeletion() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "delete-orphan-request")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(documentId)
        // Filter by this test's own document id: the quarantine directory is not cleared between test
        // methods (only the database is truncated in @BeforeEach), so other tests' approved files persist.
        val approved = Files.list(quarantineRoot.resolve("approved_source"))
            .filter { it.fileName.toString().startsWith(documentId.toString()) }
            .findFirst()
            .orElseThrow()
        // Replace the approved file with a directory of the same name: deleteIfExists throws DirectoryNotEmptyException.
        Files.delete(approved)
        Files.createDirectories(approved.resolve("keep"))
        mutate(delete("/api/foundation/profile"), alice).andExpect(status().isOk)
        assertThat(countForSubject("gc_document", "synthetic-alice")).isZero()
        assertThat(Files.isDirectory(approved)).isTrue() // orphan left for the janitor (Task 23)
        Files.delete(approved.resolve("keep")); Files.delete(approved)
    }

    @Test
    fun theWorkerRequestDecidesTheCandidatesOfEachDocumentNotConfiguration() {
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

    @Test
    fun storesTheWorkerCandidatesWithNormalizedLabelsUnitsConceptCodesAndEvidence() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "native-text-candidates")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = listOf(
                ExtractedCandidate(1, "Cholesterol", "188", "mg/dl", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64)),
                ExtractedCandidate(2, "알 수 없는 항목", "7", "mg/dL", "2026-07-28", 2, null, "2".repeat(64)),
            ),
            abstentions = listOf(ExtractionAbstention("LDL", "ambiguous_value", 1)),
        )

        val listed = responseJson(
            read(get("/api/foundation/documents/$documentId/candidates"), alice)
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.length()").value(2))
                .andReturn().response.contentAsByteArray,
        ).toList()
        assertThat(listed[0]["label"].asText()).isEqualTo("총콜레스테롤")
        assertThat(listed[0]["conceptCode"].asText()).isEqualTo("total-cholesterol")
        assertThat(listed[0]["unit"].asText()).isEqualTo("mg/dL")
        assertThat(listed[0]["value"].asText()).isEqualTo("188")
        assertThat(listed[0]["evidencePage"].asInt()).isEqualTo(1)
        assertThat(listed[0]["evidenceBox"]["x"].asDouble()).isEqualTo(0.08)
        assertThat(listed[0]["evidenceBox"]["height"].asDouble()).isEqualTo(0.02)
        assertThat(listed[0]["sourceType"].asText()).isEqualTo("DOCUMENT_TEXT_LAYER")
        assertThat(listed[0]["extractionMethod"].asText()).isEqualTo("native-text")
        assertThat(listed[0]["sourceTextSha256"].asText()).isEqualTo("1".repeat(64))
        assertThat(listed[1]["label"].asText()).isEqualTo("알 수 없는 항목")
        assertThat(listed[0]["originalLabel"].asText()).isEqualTo("Cholesterol")
        assertThat(listed[1]["originalLabel"].asText()).isEqualTo("알 수 없는 항목")
        assertThat(listed[1].hasNonNull("conceptCode")).isFalse()
        assertThat(listed[1].hasNonNull("evidenceBox")).isFalse()
        assertThat(listed[1]["evidencePage"].asInt()).isEqualTo(2)
        assertThat(listed.flatMap { it.fieldNames().asSequence().toList() }).doesNotContain("referenceRange")

        read(get("/api/foundation/documents/$documentId"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("REVIEW_REQUIRED"))
            .andExpect(jsonPath("$.abstentions.length()").value(1))
            .andExpect(jsonPath("$.abstentions[0].label").value("LDL"))
            .andExpect(jsonPath("$.abstentions[0].reason").value("ambiguous_value"))
            .andExpect(jsonPath("$.abstentions[0].evidencePage").value(1))

        mutate(
            post("/api/foundation/candidates/${listed[0]["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", "confirm-native-text-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "188"))),
            alice,
        ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.conceptCode").value("total-cholesterol"))
            .andExpect(jsonPath("$.label").value("총콜레스테롤"))
            .andExpect(jsonPath("$.originalLabel").value("Cholesterol"))
        assertThat(
            jdbc.queryForObject("SELECT concept_code FROM gc_health_record_version WHERE status = 'CURRENT'", String::class.java),
        ).isEqualTo("total-cholesterol")
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'EXTRACTION_CANDIDATES_CREATED'", Long::class.java),
        ).isEqualTo(1L)
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'SYNTHETIC_CANDIDATE_CREATED'", Long::class.java),
        ).isEqualTo(0L)
    }

    @Test
    fun zeroCandidatesCompleteTheDocumentAndKeepTheAbstentionsVisible() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "zero-candidate-document")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = emptyList(),
            abstentions = listOf(ExtractionAbstention("문서 전체", "unreadable", null)),
            expectedStatus = "COMPLETED",
        )

        assertThat(count("gc_candidate")).isZero()
        assertThat(count("gc_preview_artifact")).isEqualTo(1)
        read(get("/api/foundation/documents/$documentId"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("COMPLETED"))
            .andExpect(jsonPath("$.previewAvailable").value(true))
            .andExpect(jsonPath("$.abstentions.length()").value(1))
            .andExpect(jsonPath("$.abstentions[0].label").value("문서 전체"))
            .andExpect(jsonPath("$.abstentions[0].reason").value("unreadable"))
        assertThat(
            jdbc.queryForObject("SELECT completed_at IS NOT NULL FROM gc_document WHERE document_id = ?", Boolean::class.java, documentId),
        ).isTrue()
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'EXTRACTION_NO_CANDIDATES'", Long::class.java),
        ).isEqualTo(1L)
        read(get("/api/foundation/records"), alice).andExpect(status().isOk).andExpect(jsonPath("$.length()").value(0))
    }

    @Test
    fun duplicateOrdinalsOrImpossibleDatesDeadLetterTheExtractionJob() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "invalid-candidates-document")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        val inspectionLease = checkNotNull(workerService.lease("a".repeat(64)))
        workerService.completeInspection(inspectionLease.jobId, inspectionLease.leaseToken, approvedInspectionRequest())
        val extractionLease = checkNotNull(workerService.lease("a".repeat(64)))

        val receipt = workerService.completeExtraction(
            extractionLease.jobId,
            extractionLease.leaseToken,
            ExtractionResultRequest(
                sourceSha256 = fixtureDigest,
                workerImageDigest = "b".repeat(64),
                generatorVersion = "test-worker-v1",
                previewPngBase64 = onePixelPngBase64,
                candidates = listOf(julyCandidates[0], julyCandidates[1].copy(ordinal = 1)),
            ),
        )

        assertThat(receipt.status).isEqualTo("DEAD_LETTER")
        assertThat(count("gc_candidate")).isZero()
        assertThat(
            jdbc.queryForObject("SELECT failure_code FROM gc_document_job WHERE job_id = ?", String::class.java, extractionLease.jobId),
        ).isEqualTo("extraction_candidates_invalid")
    }

    @Test
    fun medicalConceptSeedMatchesTheSharedCatalogue() {
        assertThat(conceptSource.concepts())
            .containsExactlyInAnyOrderElementsOf(kr.co.genomecompanion.documentboundary.MedicalConceptCatalogue.entries)
    }

    @Test
    fun healthEventsProjectCurrentRecordsWithSourceAndPreviewFlag() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "health-events-document")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice)
            .andExpect(status().isAccepted)
        runWorkerPipeline(documentId)

        val candidates = responseJson(
            read(get("/api/foundation/documents/$documentId/candidates"), alice)
                .andExpect(status().isOk)
                .andReturn()
                .response
                .contentAsByteArray,
        ).toList()

        mutate(
            post("/api/foundation/candidates/${candidates[0]["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", "health-events-confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to candidates[0]["value"].asText()))),
            alice,
        ).andExpect(status().isCreated)

        mutate(
            post("/api/foundation/candidates/${candidates[2]["candidateId"].asText()}/exclusion")
                .header("Idempotency-Key", "health-events-exclude"),
            alice,
        ).andExpect(status().isOk)

        val response = read(get("/api/foundation/health-events"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andReturn()
            .response

        val events = responseJson(response.contentAsByteArray)
        assertThat(events).hasSize(1)
        val event = events[0]
        assertThat(event["concept"].asText()).isEqualTo("총콜레스테롤")
        assertThat(event["originalLabel"].asText()).isEqualTo("Cholesterol")
        assertThat(event["value"].asText()).isEqualTo("188")
        assertThat(event["unit"].asText()).isEqualTo("mg/dL")
        assertThat(event["observedOn"].asText()).isEqualTo("2026-07-28")
        assertThat(event["domain"].asText()).isEqualTo("lab")
        assertThat(event["verification"].asText()).isEqualTo("verified")
        assertThat(event["corrected"].asBoolean()).isFalse()
        assertThat(event["source"]["previewAvailable"].asBoolean()).isTrue()
        assertThat(event["source"]["page"].asInt()).isEqualTo(1)
        assertThat(event["conceptCode"].asText()).isEqualTo("total-cholesterol")
        assertThat(event.fieldNames().asSequence().toList()).doesNotContain("referenceRange", "trend")
    }

    @Test
    fun healthEventsAreOwnerIsolated() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "health-events-owner-isolation")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice)
            .andExpect(status().isAccepted)
        runWorkerPipeline(documentId)
        val candidateId = responseJson(
            read(get("/api/foundation/documents/$documentId/candidate"), alice)
                .andExpect(status().isOk)
                .andReturn()
                .response
                .contentAsByteArray,
        )["candidateId"].asText()
        mutate(
            post("/api/foundation/candidates/$candidateId/confirmation")
                .header("Idempotency-Key", "health-events-owner-isolation-confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "188"))),
            alice,
        ).andExpect(status().isCreated)

        val bob = login("synthetic-bob")
        read(get("/api/foundation/health-events"), bob)
            .andExpect(status().isOk)
            .andExpect(content().json("[]"))
    }

    @Test
    fun healthEventsRequireASession() {
        mockMvc.perform(get("/api/foundation/health-events"))
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun confirmsAndCorrectsValuesInTheWorkerGrammarAndStoresThemVerbatim() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "value-grammar-request")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = listOf(
                ExtractedCandidate(1, "혈소판", "250,000", "/µL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64)),
                ExtractedCandidate(2, "Base Excess", "-2", "mmol/L", "2026-07-28", 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64)),
                ExtractedCandidate(3, "TSH", "1.23", "µIU/mL", "2026-07-28", 1, EvidenceBox(0.08, 0.18, 0.25, 0.02), "3".repeat(64)),
            ),
        )
        val candidates = responseJson(read(get("/api/foundation/documents/$documentId/candidates"), alice).andReturn().response.contentAsByteArray).toList()
        fun confirm(index: Int, value: String, key: String) = mutate(
            post("/api/foundation/candidates/${candidates[index]["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(json(mapOf("value" to value))),
            alice,
        )
        confirm(0, "250,000", "grammar-confirm-1").andExpect(status().isCreated)
            .andExpect(jsonPath("$.value").value("250,000")).andExpect(jsonPath("$.reviewDecision").value("CONFIRMED"))
        confirm(1, "-2", "grammar-confirm-2").andExpect(status().isCreated)
            .andExpect(jsonPath("$.value").value("-2")).andExpect(jsonPath("$.unit").value("mmol/L"))
        val tsh = responseJson(confirm(2, "1.23", "grammar-confirm-3").andExpect(status().isCreated).andReturn().response.contentAsByteArray)
        mutate(
            post("/api/foundation/records/${tsh["recordId"].asText()}/corrections")
                .header("Idempotency-Key", "grammar-correct-3").contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "1.234", "reason" to "결과지에 소수 셋째 자리까지 적혀 있음"))),
            alice,
        ).andExpect(status().isOk).andExpect(jsonPath("$.value").value("1.234")).andExpect(jsonPath("$.reviewDecision").value("CORRECTED"))
        mutate(
            post("/api/foundation/records/${tsh["recordId"].asText()}/corrections")
                .header("Idempotency-Key", "grammar-correct-long").contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "1." + "2".repeat(63), "reason" to "too long"))),
            alice,
        ).andExpect(status().isBadRequest).andExpect(jsonPath("$.code").value("request_invalid"))
        for (bad in listOf("1,00", "abc", "1.", "+5", "1 000")) {
            confirm(0, bad, "grammar-bad-$bad".replace(Regex("[^A-Za-z0-9._:-]"), "_")).andExpect(status().isBadRequest)
        }
        assertThat(jdbc.queryForObject("SELECT confirmed_value FROM gc_health_record WHERE label = '혈소판'", String::class.java)).isEqualTo("250,000")
        // Arithmetic still removes commas: /series meanOfLast3 etc. are unaffected; the delta of 250,000 vs itself is 0.
        assertThat(ChangeDeltaCalculator.compute("250,000", "249,000")?.absolute).isEqualTo("+1000")
    }

    @Test
    fun storesAConfirmedExamDateKeepsTheParserDateAndAuditsNoDateValue() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "date-correction")

        fun confirmation(key: String, body: Map<String, String>) =
            post("/api/foundation/candidates/$candidateId/confirmation")
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body))

        mutate(confirmation("confirm-date-bad-shape", mapOf("value" to "188", "observedOn" to "28-07-2026")), alice)
            .andExpect(status().isBadRequest)
        mutate(confirmation("confirm-date-impossible", mapOf("value" to "188", "observedOn" to "2026-02-30")), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("observed_on_invalid"))
        mutate(confirmation("confirm-date-future", mapOf("value" to "188", "observedOn" to "2999-01-01")), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("observed_on_out_of_range"))
        mutate(confirmation("confirm-date-too-early", mapOf("value" to "188", "observedOn" to "1899-12-31")), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("observed_on_out_of_range"))
        assertThat(count("gc_health_record")).isEqualTo(0)

        val record = responseJson(
            mutate(confirmation("confirm-date-corrected", mapOf("value" to "188", "observedOn" to "2026-07-27")), alice)
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.reviewDecision").value("CORRECTED"))
                .andExpect(jsonPath("$.value").value("188"))
                .andExpect(jsonPath("$.originalValue").value("188"))
                .andExpect(jsonPath("$.observedOn").value("2026-07-27"))
                .andExpect(jsonPath("$.originalObservedOn").value("2026-07-28"))
                .andReturn().response.contentAsByteArray,
        )
        val recordId = record["recordId"].asText()
        assertThat(jdbc.queryForObject("SELECT observed_on::text FROM gc_health_record", String::class.java)).isEqualTo("2026-07-27")
        assertThat(jdbc.queryForObject("SELECT original_observed_on::text FROM gc_health_record", String::class.java)).isEqualTo("2026-07-28")
        assertThat(
            jdbc.queryForObject("SELECT observed_on::text FROM gc_candidate WHERE candidate_id = ?", String::class.java, candidateId),
        ).isEqualTo("2026-07-28")
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'CANDIDATE_CORRECTED'", Long::class.java),
        ).isEqualTo(1L)
        assertThat(auditRowsContaining("2026-07-27", "2026-07-28")).isEmpty()

        read(get("/api/foundation/records/$recordId"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.reviewDecision").value("CORRECTED"))
            .andExpect(jsonPath("$.originalObservedOn").value("2026-07-28"))
        read(get("/api/foundation/health-events"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].observedOn").value("2026-07-27"))
            .andExpect(jsonPath("$[0].corrected").value(true))

        val sameDateCandidate = createCandidate(alice, consentId, "date-unchanged")
        mutate(
            post("/api/foundation/candidates/$sameDateCandidate/confirmation")
                .header("Idempotency-Key", "confirm-date-unchanged")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "188", "observedOn" to "2026-07-28"))),
            alice,
        ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.reviewDecision").value("CONFIRMED"))
            .andExpect(jsonPath("$.observedOn").value("2026-07-28"))
            .andExpect(jsonPath("$.originalObservedOn").value("2026-07-28"))
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_health_record WHERE original_observed_on IS NULL", Long::class.java),
        ).isEqualTo(1L)
    }

    @Test
    fun changesListTheLatestDocumentValuesBesideThePreviousValueOfTheSameConcept() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)

        read(get("/api/foundation/changes"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.latestDocument").doesNotExist())
            .andExpect(jsonPath("$.items.length()").value(0))
            .andExpect(jsonPath("$.newConcepts.length()").value(0))
            .andExpect(jsonPath("$.unchangedCount").value(0))

        val january = importSyntheticDocument(alice, consentId, januaryFixturePdf, januaryFixtureDigest, "changes-january")
        confirmEveryCandidate(alice, january, "changes-january")
        val firstOnly = responseJson(
            read(get("/api/foundation/changes"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )
        assertThat(firstOnly["latestDocument"]["documentId"].asText()).isEqualTo(january[0]["documentId"].asText())
        assertThat(firstOnly["latestDocument"]["observedOn"].asText()).isEqualTo("2026-01-15")
        assertThat(firstOnly["latestDocument"]["eventCount"].asInt()).isEqualTo(3)
        assertThat(firstOnly["items"].map { it.has("previous") }).containsExactly(false, false, false)
        assertThat(firstOnly["newConcepts"].map(JsonNode::asText)).containsExactlyInAnyOrder("총콜레스테롤", "당화혈색소", "비타민 D")

        val july = importSyntheticDocument(alice, consentId, fixturePdf, fixtureDigest, "changes-july")
        confirmEveryCandidate(alice, july, "changes-july")

        val summary = responseJson(
            read(get("/api/foundation/changes"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )
        assertThat(summary["latestDocument"]["documentId"].asText()).isEqualTo(july[0]["documentId"].asText())
        assertThat(summary["latestDocument"]["observedOn"].asText()).isEqualTo("2026-07-28")
        assertThat(summary["latestDocument"]["eventCount"].asInt()).isEqualTo(3)
        val byConcept = summary["items"].associateBy { it["concept"].asText() }
        assertThat(byConcept.keys).containsExactlyInAnyOrder("총콜레스테롤", "당화혈색소", "비타민 D")
        assertThat(byConcept.getValue("총콜레스테롤")["conceptCode"].asText()).isEqualTo("total-cholesterol")
        assertThat(byConcept.getValue("총콜레스테롤")["unit"].asText()).isEqualTo("mg/dL")
        assertThat(byConcept.getValue("총콜레스테롤")["latest"]["value"].asText()).isEqualTo("188")
        assertThat(byConcept.getValue("총콜레스테롤")["latest"]["observedOn"].asText()).isEqualTo("2026-07-28")
        assertThat(byConcept.getValue("총콜레스테롤")["previous"]["value"].asText()).isEqualTo("194")
        assertThat(byConcept.getValue("총콜레스테롤")["previous"]["observedOn"].asText()).isEqualTo("2026-01-15")
        assertThat(byConcept.getValue("당화혈색소")["previous"]["value"].asText()).isEqualTo("5.4")
        assertThat(byConcept.getValue("비타민 D")["previous"]["value"].asText()).isEqualTo("45")
        // Upload order here is chronological (January's exam date is before July's), so the delta
        // is present for every item that has a previous value.
        assertThat(byConcept.getValue("총콜레스테롤")["delta"]["absolute"].asText()).isEqualTo("-6")
        assertThat(byConcept.getValue("총콜레스테롤")["delta"]["percent"].asText()).isEqualTo("-3.1")
        // 당화혈색소 is a %-unit item (F4): the absolute difference is kept, the percent is omitted
        // entirely so a "percent of a percent" number never appears.
        assertThat(byConcept.getValue("당화혈색소")["delta"]["absolute"].asText()).isEqualTo("-0.2")
        assertThat(byConcept.getValue("당화혈색소")["delta"].has("percent")).isFalse()
        assertThat(byConcept.getValue("비타민 D")["delta"]["absolute"].asText()).isEqualTo("-3")
        assertThat(byConcept.getValue("비타민 D")["delta"]["percent"].asText()).isEqualTo("-6.7")
        assertThat(firstOnly["items"].map { it.has("delta") }).containsExactly(false, false, false)
        assertThat(summary["newConcepts"].size()).isZero()
        assertThat(summary["unchangedCount"].asInt()).isZero()
        assertThat(summary.toString().lowercase()).doesNotContain("reference", "direction", "trend", "arrow")

        val bob = login("synthetic-bob")
        read(get("/api/foundation/changes"), bob)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.latestDocument").doesNotExist())
            .andExpect(jsonPath("$.items.length()").value(0))

        mockMvc.perform(get("/api/foundation/changes")).andExpect(status().isUnauthorized)
    }

    @Test
    fun recordOrderFollowsExamDateThenConfirmationAndACorrectionBackToTheOriginalStaysCorrected() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val july = importSyntheticDocument(alice, consentId, fixturePdf, fixtureDigest, "order-july")
        confirmEveryCandidate(alice, july, "order-july")
        val january = importSyntheticDocument(alice, consentId, januaryFixturePdf, januaryFixtureDigest, "order-jan")
        confirmEveryCandidate(alice, january, "order-jan")
        val before = responseJson(read(get("/api/foundation/records"), alice).andReturn().response.contentAsByteArray).map { it["observedOn"].asText() }
        assertThat(before).isSorted()
        assertThat(before.first()).isEqualTo("2026-01-15")
        val recordId = responseJson(read(get("/api/foundation/records"), alice).andReturn().response.contentAsByteArray).first()["recordId"].asText()
        fun correct(value: String, key: String) = mutate(
            post("/api/foundation/records/$recordId/corrections").header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to value, "reason" to "정정 $key"))),
            alice,
        ).andExpect(status().isOk)
        correct("195", "order-correct-1")
        correct("194", "order-correct-2")
        read(get("/api/foundation/records/$recordId"), alice)
            .andExpect(jsonPath("$.value").value("194"))
            .andExpect(jsonPath("$.originalValue").value("194"))
            .andExpect(jsonPath("$.reviewDecision").value("CORRECTED"))
        val after = responseJson(read(get("/api/foundation/records"), alice).andReturn().response.contentAsByteArray)
        assertThat(after.map { it["observedOn"].asText() }).isEqualTo(before)
        assertThat(after.first()["recordId"].asText()).isEqualTo(recordId)
        // health-events, series and the FHIR export all order on the record's own immutable
        // observedOn/confirmed_at/recordId, exactly like /records above — a correction bumps only
        // the mutable version_changed_at (still surfaced as the API's own `confirmedAt` field on
        // each event), so it can never reorder any of these five read models relative to one
        // another or relative to /records.
        val healthEvents = responseJson(read(get("/api/foundation/health-events"), alice).andReturn().response.contentAsByteArray)
        assertThat(healthEvents.map { it["recordId"].asText() }).isEqualTo(after.map { it["recordId"].asText() })
        val correctedEvent = healthEvents.single { it["recordId"].asText() == recordId }
        assertThat(correctedEvent["corrected"].asBoolean()).isTrue()
    }

    @Test
    fun seriesListCurrentValuesInTimeOrderWithThreeComputedNumbersAndNoRangeText() {
        mockMvc.perform(get("/api/foundation/series")).andExpect(status().isUnauthorized)
        val alice = login("synthetic-alice")
        val bob = login("synthetic-bob")
        val consentId = grantConsent(alice)

        read(get("/api/foundation/series"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.series.length()").value(0))

        // July is uploaded first, January second: the series is ordered by exam date, not upload order.
        val july = importJulyWithRange(alice, consentId, "series-july")
        confirmEveryCandidate(alice, july, "series-july")
        val january = importSyntheticDocument(alice, consentId, januaryFixturePdf, januaryFixtureDigest, "series-january")
        confirmEveryCandidate(alice, january, "series-january")

        val records = responseJson(
            read(get("/api/foundation/records"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).toList()
        val julyCholesterol = records.single { it["label"].asText() == "총콜레스테롤" && it["observedOn"].asText() == "2026-07-28" }
        mutate(
            post("/api/foundation/records/${julyCholesterol["recordId"].asText()}/corrections")
                .header("Idempotency-Key", "series-correction-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "190", "reason" to "합성 원문 재확인"))),
            alice,
        ).andExpect(status().isOk)

        val response = read(get("/api/foundation/series"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andReturn().response
        val series = responseJson(response.contentAsByteArray)["series"].toList()
        assertThat(series.map { it["concept"].asText() }).containsExactly("당화혈색소", "비타민 D", "총콜레스테롤")
        assertThat(series.map { it["unit"].asText() }).containsExactly("%", "ng/mL", "mg/dL")
        assertThat(series.map { it["conceptCode"].asText() }).containsExactly("hba1c", "vitamin-d", "total-cholesterol")
        assertThat(series.flatMap { it["points"] }.map { it["originalLabel"].asText() }).containsOnly("Cholesterol", "HbA1c", "Vitamin D")

        val cholesterol = series[2]
        // CURRENT only: the superseded 188 is gone, the corrected 190 is the point.
        assertThat(cholesterol["points"].map { it["value"].asText() }).containsExactly("194", "190")
        assertThat(cholesterol["points"].map { it["observedOn"].asText() }).containsExactly("2026-01-15", "2026-07-28")
        assertThat(cholesterol["points"][0]["documentId"].asText()).isEqualTo(january[0]["documentId"].asText())
        assertThat(cholesterol["points"][1]["documentId"].asText()).isEqualTo(july[0]["documentId"].asText())
        assertThat(cholesterol["points"][0].fieldNames().asSequence().toList())
            .containsExactlyInAnyOrder("eventId", "value", "observedOn", "documentId", "originalLabel")
        // 194 days apart: -4, -4/194 = -2.1 %, -4/194×30 = -0.6.
        assertThat(cholesterol["derived"]["lastDifference"]["absolute"].asText()).isEqualTo("-4")
        assertThat(cholesterol["derived"]["lastDifference"]["percent"].asText()).isEqualTo("-2.1")
        assertThat(cholesterol["derived"]["per30Days"].asText()).isEqualTo("-0.6")
        assertThat(cholesterol["derived"].has("meanOfLast3")).isFalse()

        val hba1c = series[0]
        assertThat(hba1c["derived"]["lastDifference"]["absolute"].asText()).isEqualTo("-0.2")
        assertThat(hba1c["derived"]["lastDifference"].has("percent")).isFalse()
        assertThat(hba1c["derived"]["per30Days"].asText()).isEqualTo("-0.03")

        val vitaminD = series[1]
        assertThat(vitaminD["derived"]["lastDifference"]["absolute"].asText()).isEqualTo("-3")
        assertThat(vitaminD["derived"]["lastDifference"]["percent"].asText()).isEqualTo("-6.7")
        assertThat(vitaminD["derived"]["per30Days"].asText()).isEqualTo("-0.5")

        // Every point is a CURRENT HealthEvent of the same owner.
        val eventIds = responseJson(
            read(get("/api/foundation/health-events"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).map { it["eventId"].asText() }
        assertThat(series.flatMap { item -> item["points"].map { it["eventId"].asText() } })
            .containsExactlyInAnyOrderElementsOf(eventIds)

        // The printed range is stored (export only) and appears nowhere in this response.
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_health_record_version WHERE reference_range_text = '120-199'", Long::class.java))
            .isGreaterThan(0L)
        assertThat(response.contentAsString.lowercase()).doesNotContain("reference", "120-199", "direction", "trend", "slope", "forecast")

        read(get("/api/foundation/series"), bob)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.series.length()").value(0))
    }

    @Test
    fun consentIdempotencyKeysAreScopedPerPurposeAndRejectCrossPurposeReuse() {
        val alice = login("synthetic-alice")

        // Same key, same purpose: replay returns the same receipt, no second row.
        val first = responseJson(
            mutate(post("/api/foundation/consents/RESEARCH_USE").header("Idempotency-Key", "shared-key-1"), alice)
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.purposeCode").value("RESEARCH_USE"))
                .andReturn().response.contentAsByteArray,
        )
        val researchUseId = UUID.fromString(first["consentId"].asText())
        mutate(post("/api/foundation/consents/RESEARCH_USE").header("Idempotency-Key", "shared-key-1"), alice)
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.consentId").value(researchUseId.toString()))
            .andExpect(jsonPath("$.purposeCode").value("RESEARCH_USE"))

        // Same key, different purpose: rejected rather than replaying the other purpose's receipt.
        mutate(post("/api/foundation/consents/PROJECT:study1").header("Idempotency-Key", "shared-key-1"), alice)
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("idempotency_key_reused"))
        assertThat(countForSubject("gc_consent_grant", "synthetic-alice")).isEqualTo(1)

        // The project purpose can still be granted under its own key.
        mutate(post("/api/foundation/consents/PROJECT:study1").header("Idempotency-Key", "shared-key-2"), alice)
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.purposeCode").value("PROJECT:study1"))
        assertThat(countForSubject("gc_consent_grant", "synthetic-alice")).isEqualTo(2)
    }

    @Test
    fun theSameIdempotencyKeyWithAnotherTargetOrBodyIsRejectedWith422AndExpiresAfter24Hours() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val first = createCandidate(alice, consentId, "idem-a")
        val second = createCandidate(alice, consentId, "idem-b")
        fun confirm(candidateId: UUID, value: String) = mutate(
            post("/api/foundation/candidates/$candidateId/confirmation").header("Idempotency-Key", "shared-key-0001")
                .contentType(MediaType.APPLICATION_JSON).content(json(mapOf("value" to value))),
            alice,
        )
        val record = responseJson(confirm(first, "188").andExpect(status().isCreated).andReturn().response.contentAsByteArray)
        confirm(first, "188").andExpect(status().isCreated).andExpect(jsonPath("$.recordId").value(record["recordId"].asText()))
        confirm(first, "189").andExpect(status().isUnprocessableEntity).andExpect(jsonPath("$.code").value("idempotency_key_mismatch"))
        confirm(second, "188").andExpect(status().isUnprocessableEntity).andExpect(jsonPath("$.code").value("idempotency_key_mismatch"))
        assertThat(count("gc_health_record")).isEqualTo(1)
        jdbc.update("UPDATE gc_idempotency SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'")
        // Expired: the key is free again, and the second candidate can now be confirmed under it.
        confirm(second, "188").andExpect(status().isCreated)
        assertThat(count("gc_health_record")).isEqualTo(2)
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_idempotency WHERE request_sha256 IS NOT NULL AND expires_at > CURRENT_TIMESTAMP", Long::class.java)).isEqualTo(1L)
    }

    @Test
    fun auditRowsAreAppendOnlyAtTheDatabase() {
        val alice = login("synthetic-alice")
        grantConsent(alice)
        org.assertj.core.api.Assertions.assertThatThrownBy { jdbc.update("DELETE FROM gc_audit_event") }.isInstanceOf(DataAccessException::class.java)
        org.assertj.core.api.Assertions.assertThatThrownBy { jdbc.update("UPDATE gc_audit_event SET outcome = 'DENIED'") }.isInstanceOf(DataAccessException::class.java)
        assertThat(count("gc_audit_event")).isGreaterThanOrEqualTo(2)
    }

    @Test
    fun researchConsentsAreStoredPerPurposeAndNeverGateTheLifecycle() {
        val alice = login("synthetic-alice")
        val bob = login("synthetic-bob")

        val initial = responseJson(
            read(get("/api/foundation/consents"), alice)
                .andExpect(status().isOk)
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().response.contentAsByteArray,
        )
        assertThat(initial.map { it["purposeCode"].asText() }).containsExactly("DOCUMENT_EXTRACTION", "RESEARCH_USE", "RESEARCH_CONTACT")
        assertThat(initial.map { it["status"].asText() }).containsExactly("NOT_GRANTED", "NOT_GRANTED", "NOT_GRANTED")
        assertThat(initial.map { it["policyVersion"].asText() })
            .containsExactly("foundation-v1", "research-consent-policy.v1", "research-contact-policy.v1")
        assertThat(initial.map { it.has("consentId") }).containsExactly(false, false, false)

        val researchUse = responseJson(
            mutate(post("/api/foundation/consents/RESEARCH_USE").header("Idempotency-Key", "research-use-grant-1"), alice)
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.purposeCode").value("RESEARCH_USE"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.policyVersion").value("research-consent-policy.v1"))
                .andExpect(jsonPath("$.grantedAt").isNotEmpty)
                .andExpect(jsonPath("$.revokedAt").doesNotExist())
                .andReturn().response.contentAsByteArray,
        )
        val researchUseId = UUID.fromString(researchUse["consentId"].asText())
        mutate(post("/api/foundation/consents/RESEARCH_USE").header("Idempotency-Key", "research-use-grant-1"), alice)
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.consentId").value(researchUseId.toString()))
        mutate(post("/api/foundation/consents/RESEARCH_USE").header("Idempotency-Key", "research-use-grant-2"), alice)
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.consentId").value(researchUseId.toString()))
        assertThat(countForSubject("gc_consent_grant", "synthetic-alice")).isEqualTo(1)

        // A research consent is not a document consent: it cannot open the lifecycle.
        mutate(
            post("/api/foundation/documents")
                .header("Idempotency-Key", "doc-with-research-consent")
                .contentType(MediaType.APPLICATION_JSON)
                .content(documentRequest(researchUseId, fixturePdf)),
            alice,
        ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("active_consent_required"))

        // The whole lifecycle runs while the other research purpose is absent and this one is later revoked.
        val documentConsentId = grantConsent(alice)
        val candidates = importSyntheticDocument(alice, documentConsentId, fixturePdf, fixtureDigest, "research-invariant")
        confirmEveryCandidate(alice, candidates, "research-invariant")
        read(get("/api/foundation/records"), alice).andExpect(status().isOk).andExpect(jsonPath("$.length()").value(3))

        mutate(post("/api/foundation/consents/$researchUseId/revocation"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.purposeCode").value("RESEARCH_USE"))
            .andExpect(jsonPath("$.status").value("REVOKED"))
        val afterRevoke = responseJson(
            read(get("/api/foundation/consents"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )
        assertThat(afterRevoke.map { "${it["purposeCode"].asText()}=${it["status"].asText()}" })
            .containsExactly("DOCUMENT_EXTRACTION=ACTIVE", "RESEARCH_USE=REVOKED", "RESEARCH_CONTACT=NOT_GRANTED")
        assertThat(afterRevoke[1]["revokedAt"].asText()).isNotEmpty()
        assertThat(afterRevoke[0]["consentId"].asText()).isEqualTo(documentConsentId.toString())
        read(get("/api/foundation/documents/${candidates[0]["documentId"].asText()}/candidates"), alice)
            .andExpect(status().isOk)

        // The lifecycle keeps working after the research revoke: importing and fully confirming a
        // second document is unaffected, proving the revoked purpose never gated it.
        val januaryAfterRevoke = importSyntheticDocument(
            alice,
            documentConsentId,
            januaryFixturePdf,
            januaryFixtureDigest,
            "research-invariant-after-revoke",
        )
        confirmEveryCandidate(alice, januaryAfterRevoke, "research-invariant-after-revoke")

        read(get("/api/foundation/health-events"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(6))
        read(get("/api/foundation/changes"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.latestDocument.eventCount").value(3))
        read(get("/api/foundation/health-events/export"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.events.length()").value(6))

        // PROJECT purposes: the prefix and shape are validated; a granted one is listed after the fixed three.
        mutate(post("/api/foundation/consents/STUDY-1").header("Idempotency-Key", "project-no-prefix"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("consent_purpose_invalid"))
        mutate(post("/api/foundation/consents/PROJECT:Demo_Study").header("Idempotency-Key", "project-bad-shape"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("consent_purpose_invalid"))
        mutate(post("/api/foundation/consents/PROJECT:${"a".repeat(41)}").header("Idempotency-Key", "project-too-long"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("consent_purpose_invalid"))
        mutate(post("/api/foundation/consents/PROJECT:demo-study-1").header("Idempotency-Key", "project-grant-1"), alice)
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.purposeCode").value("PROJECT:demo-study-1"))
            .andExpect(jsonPath("$.policyVersion").value("project-consent-policy.v1"))
        val withProject = responseJson(
            read(get("/api/foundation/consents"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )
        assertThat(withProject.map { it["purposeCode"].asText() })
            .containsExactly("DOCUMENT_EXTRACTION", "RESEARCH_USE", "RESEARCH_CONTACT", "PROJECT:demo-study-1")

        // Owner isolation: bob neither sees nor revokes alice's consents.
        val bobList = responseJson(
            read(get("/api/foundation/consents"), bob).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )
        assertThat(bobList.map { it["status"].asText() }).containsExactly("NOT_GRANTED", "NOT_GRANTED", "NOT_GRANTED")
        mutate(post("/api/foundation/consents/$researchUseId/revocation"), bob)
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("consent_not_found"))
        mockMvc.perform(get("/api/foundation/consents")).andExpect(status().isUnauthorized)

        // Audit rows name the purpose and nothing else.
        assertThat(
            jdbc.queryForList(
                "SELECT purpose_code FROM gc_audit_event WHERE event_type = 'CONSENT_GRANTED' ORDER BY audit_sequence",
                String::class.java,
            ),
        ).containsExactly("RESEARCH_USE", "DOCUMENT_EXTRACTION", "PROJECT:demo-study-1")
        assertThat(
            jdbc.queryForList("SELECT purpose_code FROM gc_audit_event WHERE event_type = 'CONSENT_REVOKED'", String::class.java),
        ).containsExactly("RESEARCH_USE")
        assertThat(
            jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM gc_audit_event
                WHERE event_type LIKE '%policy%' OR resource_type LIKE '%policy%' OR purpose_code LIKE '%policy%'
                   OR event_type LIKE '%188%' OR resource_type LIKE '%mg/dL%'
                """.trimIndent(),
                Long::class.java,
            ),
        ).isZero()

        // Deletion removes every purpose row; nothing research-related was ever a condition.
        mutate(delete("/api/foundation/profile"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("COMPLETED"))
            .andExpect(jsonPath("$.rawHealthValuesPresentInAudit").value(false))
        assertThat(countForSubject("gc_consent_grant", "synthetic-alice")).isZero()
    }

    @Test
    fun exportsTheOwnersHealthEventsAsAJsonAttachmentWithoutRangesAndAuditsNoValue() {
        mockMvc.perform(get("/api/foundation/health-events/export")).andExpect(status().isUnauthorized)
        val alice = login("synthetic-alice")
        val bob = login("synthetic-bob")

        val empty = read(get("/api/foundation/health-events/export"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.schemaVersion").value("alm-health-events-export.v3"))
            .andExpect(jsonPath("$.events.length()").value(0))
            .andExpect(jsonPath("$.documents.length()").value(0))
            .andReturn().response
        assertThat(empty.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .matches("attachment; filename=\"alm-health-events-\\d{8}\\.json\"")

        val consentId = grantConsent(alice)
        val candidates = importSyntheticDocument(alice, consentId, fixturePdf, fixtureDigest, "export")
        confirmEveryCandidate(alice, candidates, "export")
        val documentId = candidates[0]["documentId"].asText()

        val response = read(get("/api/foundation/health-events/export"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(jsonPath("$.schemaVersion").value("alm-health-events-export.v3"))
            .andExpect(jsonPath("$.subjectKind").value("synthetic"))
            .andExpect(jsonPath("$.exportedAt").isNotEmpty)
            .andExpect(jsonPath("$.events.length()").value(3))
            .andExpect(jsonPath("$.events[0].source.documentId").value(documentId))
            .andExpect(jsonPath("$.documents.length()").value(1))
            .andExpect(jsonPath("$.documents[0].documentId").value(documentId))
            .andExpect(jsonPath("$.documents[0].observedOn").value("2026-07-28"))
            .andExpect(jsonPath("$.documents[0].status").value("COMPLETED"))
            .andExpect(jsonPath("$.documents[0].abstentions.length()").value(0))
            .andExpect(jsonPath("$.documents[0].eventCount").value(3))
            .andReturn().response
        assertThat(response.contentType).startsWith("application/json")
        assertThat(response.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .matches("attachment; filename=\"alm-health-events-\\d{8}\\.json\"")
        // The export is the one place referenceRangeText legitimately appears; none of these
        // candidates printed a range, so the key is always present but always null.
        assertThat(response.contentAsString).doesNotContain("trend", "direction", "normal", "risk")
        val exportedEvents = responseJson(response.contentAsByteArray)["events"]
        assertThat(exportedEvents.map { it["value"].asText() })
            .containsExactlyInAnyOrder("188", "5.2", "42")
        assertThat(exportedEvents.all { it.has("referenceRangeText") && it["referenceRangeText"].isNull }).isTrue()

        read(get("/api/foundation/health-events/export"), bob)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.events.length()").value(0))
            .andExpect(jsonPath("$.documents.length()").value(0))

        assertThat(
            jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM gc_audit_event
                WHERE event_type = 'HEALTH_EVENTS_EXPORTED' AND resource_type = 'EXPORT'
                  AND resource_id IS NULL AND purpose_code IS NULL AND outcome = 'SUCCESS'
                """.trimIndent(),
                Long::class.java,
            ),
        ).isEqualTo(3L)
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM gc_audit_event WHERE event_type LIKE '%188%' OR resource_type LIKE '%mg/dL%' OR event_type LIKE '%3%'",
                Long::class.java,
            ),
        ).isZero()
    }

    @Test
    fun storesTheReferenceRangeTextCopiesItToTheRecordVersionAndKeepsItOutOfEveryResponse() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "reference-range-request")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = listOf(
                ExtractedCandidate(1, "Cholesterol", "188", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64), "120-199"),
                ExtractedCandidate(2, "HbA1c", "5.2", "%", "2026-07-28", 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64), null),
            ),
        )
        assertThat(
            jdbc.queryForList("SELECT reference_range_text FROM gc_candidate ORDER BY ordinal", String::class.java),
        ).containsExactly("120-199", null)

        val candidatesResponse = read(get("/api/foundation/documents/$documentId/candidates"), alice)
            .andExpect(status().isOk).andReturn().response.contentAsString
        assertThat(candidatesResponse.lowercase()).doesNotContain("reference")
        val candidates = responseJson(candidatesResponse.toByteArray()).toList()

        // A confirm-time correction of the value keeps the document's own range text unchanged.
        mutate(
            post("/api/foundation/candidates/${candidates[0]["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", "reference-range-confirm-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "190"))),
            alice,
        ).andExpect(status().isCreated)
        mutate(
            post("/api/foundation/candidates/${candidates[1]["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", "reference-range-confirm-2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "5.2"))),
            alice,
        ).andExpect(status().isCreated)
        assertThat(
            jdbc.queryForList(
                """
                SELECT v.reference_range_text FROM gc_health_record_version v
                JOIN gc_health_record r ON r.record_id = v.record_id
                JOIN gc_candidate c ON c.candidate_id = r.candidate_id
                WHERE v.status = 'CURRENT' ORDER BY c.ordinal
                """.trimIndent(),
                String::class.java,
            ),
        ).containsExactly("120-199", null)

        val records = responseJson(
            read(get("/api/foundation/records"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).toList()
        val correctedRecordId = records.single { it["label"].asText() == "총콜레스테롤" }["recordId"].asText()

        // A correction request carrying an unrecognized referenceRangeText field is rejected outright:
        // the field is never client-writable, and the strict Jackson posture (fail-on-unknown-properties)
        // rejects it rather than silently dropping it.
        mutate(
            post("/api/foundation/records/$correctedRecordId/corrections")
                .header("Idempotency-Key", "reference-range-correction-rejected")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "191", "reason" to "합성 원문 재확인", "referenceRangeText" to "1-2"))),
            alice,
        ).andExpect(status().isBadRequest)
        assertThat(
            jdbc.queryForList(
                "SELECT reference_range_text FROM gc_health_record_version WHERE record_id = ?::uuid ORDER BY changed_at",
                String::class.java,
                correctedRecordId,
            ),
        ).containsExactly("120-199")

        // Correction inherits the range text; a client cannot change it because no request field exists.
        mutate(
            post("/api/foundation/records/$correctedRecordId/corrections")
                .header("Idempotency-Key", "reference-range-correction-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "191", "reason" to "합성 원문 재확인"))),
            alice,
        ).andExpect(status().isOk)
        assertThat(
            jdbc.queryForList(
                "SELECT reference_range_text FROM gc_health_record_version WHERE record_id = ?::uuid ORDER BY changed_at",
                String::class.java,
                correctedRecordId,
            ),
        ).containsExactly("120-199", "120-199")

        for (path in listOf(
            "/api/foundation/documents/$documentId/candidates",
            "/api/foundation/records",
            "/api/foundation/health-events",
            "/api/foundation/changes",
            "/api/foundation/records/$correctedRecordId",
        )) {
            val body = read(get(path), alice).andExpect(status().isOk).andReturn().response.contentAsString
            assertThat(body.lowercase()).describedAs(path).doesNotContain("reference")
            // The key check above can pass even if the range text leaked under a different field
            // name; a value-based check catches that regardless of key.
            assertThat(body).describedAs(path).doesNotContain("120-199")
        }
        // The original query here (`event_type LIKE '%120%' OR resource_type LIKE '%199%'`) can
        // never match: those columns hold fixed enum-like strings (e.g. "CANDIDATE_CONFIRMED"),
        // never a value or range digit. Check the audit row's own textual columns instead, for
        // both the printed range and the confirmed correction value.
        assertThat(
            jdbc.queryForList(
                """
                SELECT event_type || ' ' || resource_type || ' ' || COALESCE(purpose_code, '') || ' ' || outcome
                FROM gc_audit_event
                """.trimIndent(),
                String::class.java,
            ),
        ).noneMatch { it.contains("120-199") || it.contains("191") }
    }

    @Test
    fun storesTheResultSheetLabelCopiesItAtConfirmationInheritsItOnCorrectionAndGuardsTheUnit() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "original-label-request")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = listOf(
                ExtractedCandidate(1, "Cholesterol", "188", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64)),
                ExtractedCandidate(2, "혈당", "95", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64)),
                ExtractedCandidate(3, "UA", "1.2", "g/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.18, 0.25, 0.02), "3".repeat(64)),
            ),
        )
        assertThat(
            jdbc.queryForList("SELECT label || '|' || original_label || '|' || COALESCE(concept_code, '-') FROM gc_candidate ORDER BY ordinal", String::class.java),
        ).containsExactly("총콜레스테롤|Cholesterol|total-cholesterol", "혈당|혈당|glucose", "UA|UA|-")

        val candidates = responseJson(
            read(get("/api/foundation/documents/$documentId/candidates"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).toList()
        confirmEveryCandidate(alice, candidates, "original-label")
        assertThat(
            jdbc.queryForList(
                """
                SELECT v.original_label FROM gc_health_record_version v
                JOIN gc_health_record r ON r.record_id = v.record_id
                JOIN gc_candidate c ON c.candidate_id = r.candidate_id
                WHERE v.status = 'CURRENT' ORDER BY c.ordinal
                """.trimIndent(),
                String::class.java,
            ),
        ).containsExactly("Cholesterol", "혈당", "UA")

        val recordId = responseJson(
            read(get("/api/foundation/records"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).single { it["label"].asText() == "총콜레스테롤" }["recordId"].asText()
        // The label is never client-writable: the strict Jackson posture rejects the unknown field.
        mutate(
            post("/api/foundation/records/$recordId/corrections")
                .header("Idempotency-Key", "original-label-correction-rejected")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "191", "reason" to "합성 원문 재확인", "originalLabel" to "LDL"))),
            alice,
        ).andExpect(status().isBadRequest)
        mutate(
            post("/api/foundation/records/$recordId/corrections")
                .header("Idempotency-Key", "original-label-correction-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "191", "reason" to "합성 원문 재확인"))),
            alice,
        ).andExpect(status().isOk)
        assertThat(
            jdbc.queryForList(
                "SELECT original_label FROM gc_health_record_version WHERE record_id = ?::uuid ORDER BY changed_at",
                String::class.java,
                recordId,
            ),
        ).containsExactly("Cholesterol", "Cholesterol")
        val fhir = responseJson(
            read(get("/api/foundation/health-events/export/fhir"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )["entry"].map { it["resource"] }.associateBy { it["code"]["text"].asText() }
        assertThat(fhir.keys).containsExactlyInAnyOrder("Cholesterol", "혈당", "UA")
        assertThat(fhir.getValue("혈당")["code"].has("coding")).isFalse()
        assertThat(fhir.getValue("UA")["code"].has("coding")).isFalse()
        assertThat(fhir.getValue("UA").has("category")).isFalse()
        // Audit rows never carry the label.
        assertThat(
            jdbc.queryForList(
                "SELECT event_type || ' ' || resource_type || ' ' || COALESCE(purpose_code, '') || ' ' || outcome FROM gc_audit_event",
                String::class.java,
            ),
        ).noneMatch { it.contains("Cholesterol") || it.contains("혈당") }
    }

    /**
     * The FHIR `loincExport`/unit-guard behaviour end to end through the REAL seeded
     * `gc_medical_concept` table (V11), not a hand-built map: this is the concept data the audit
     * (docs/status/2026-09-17/loinc-audit.md § Final values) actually produced.
     */
    @Test
    fun exportsFhirCodingFromTheRealSeededConceptTableForEveryAuditedCase() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "loinc-audit-request")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = listOf(
                ExtractedCandidate(1, "CRP", "0.2", "mg/L", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.20, 0.02), "1".repeat(64)),
                ExtractedCandidate(2, "T-Bil", "0.8", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64)),
                ExtractedCandidate(3, "FBS", "92", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.18, 0.20, 0.02), "3".repeat(64)),
                ExtractedCandidate(4, "LDL-C", "110", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.22, 0.20, 0.02), "4".repeat(64)),
                ExtractedCandidate(5, "e-GFR", "90", "mL/min/1.73m²", "2026-07-28", 1, EvidenceBox(0.08, 0.26, 0.20, 0.02), "5".repeat(64)),
                ExtractedCandidate(6, "Vitamin D", "42", "ng/mL", "2026-07-28", 1, EvidenceBox(0.08, 0.30, 0.20, 0.02), "6".repeat(64)),
                ExtractedCandidate(7, "Waist", "82", "cm", "2026-07-28", 1, EvidenceBox(0.08, 0.34, 0.20, 0.02), "7".repeat(64)),
                ExtractedCandidate(8, "혈당", "95", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.38, 0.20, 0.02), "8".repeat(64)),
                ExtractedCandidate(9, "Cholesterol", "4.9", "mmol/L", "2026-07-28", 1, EvidenceBox(0.08, 0.42, 0.20, 0.02), "9".repeat(64)),
            ),
        )
        val candidates = responseJson(
            read(get("/api/foundation/documents/$documentId/candidates"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).toList()
        confirmEveryCandidate(alice, candidates, "loinc-audit")

        val fhir = responseJson(
            read(get("/api/foundation/health-events/export/fhir"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )["entry"].map { it["resource"] }.associateBy { it["code"]["text"].asText() }
        assertThat(fhir.keys).containsExactlyInAnyOrder(
            "CRP", "T-Bil", "FBS", "LDL-C", "e-GFR", "Vitamin D", "Waist", "혈당", "Cholesterol",
        )

        // Codes the audit found no more specific than the label: coding present with the exact audited code.
        assertThat(fhir.getValue("CRP")["code"]["coding"].single()["code"].asText()).isEqualTo("1988-5")
        assertThat(fhir.getValue("T-Bil")["code"]["coding"].single()["code"].asText()).isEqualTo("1975-2")
        assertThat(fhir.getValue("FBS")["code"]["coding"].single()["code"].asText()).isEqualTo("1558-6")
        assertThat(fhir.getValue("LDL-C")["code"]["coding"].single()["code"].asText()).isEqualTo("2089-1")

        // Codes the audit found more specific than the label (method/site/formula), or no concept
        // code at all, or a value not in the concept's canonical unit: coding absent.
        assertThat(fhir.getValue("e-GFR")["code"].has("coding")).isFalse()
        assertThat(fhir.getValue("Vitamin D")["code"].has("coding")).isFalse()
        assertThat(fhir.getValue("Waist")["code"].has("coding")).isFalse()
        assertThat(fhir.getValue("혈당")["code"].has("coding")).isFalse()
        assertThat(fhir.getValue("Cholesterol")["code"].has("coding")).isFalse()

        // category: omitted only for the body-measurement concept, laboratory for every coded/uncoded lab item.
        assertThat(fhir.getValue("Waist").has("category")).isFalse()
        assertThat(fhir.getValue("CRP")["category"].single()["coding"].single()["code"].asText()).isEqualTo("laboratory")
        assertThat(fhir.getValue("T-Bil")["category"].single()["coding"].single()["code"].asText()).isEqualTo("laboratory")
        assertThat(fhir.getValue("FBS")["category"].single()["coding"].single()["code"].asText()).isEqualTo("laboratory")
        assertThat(fhir.getValue("LDL-C")["category"].single()["coding"].single()["code"].asText()).isEqualTo("laboratory")
        assertThat(fhir.getValue("e-GFR")["category"].single()["coding"].single()["code"].asText()).isEqualTo("laboratory")
        assertThat(fhir.getValue("Vitamin D")["category"].single()["coding"].single()["code"].asText()).isEqualTo("laboratory")
        assertThat(fhir.getValue("혈당")["category"].single()["coding"].single()["code"].asText()).isEqualTo("laboratory")
        assertThat(fhir.getValue("Cholesterol")["category"].single()["coding"].single()["code"].asText()).isEqualTo("laboratory")

        // code.text is each row's own sheet label (verified above by keying the map on code.text
        // itself): none of the normalized display labels ("총빌리루빈", "공복혈당" ...) appear instead.
        assertThat(fhir.keys).doesNotContain("총빌리루빈", "공복혈당", "LDL 콜레스테롤", "eGFR", "비타민 D", "허리둘레", "총콜레스테롤")
    }

    @Test
    fun existingRowsKeepANullResultSheetLabel() {
        assertThat(
            jdbc.queryForObject(
                "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'gc_health_record_version' AND column_name = 'original_label'",
                String::class.java,
            ),
        ).isEqualTo("YES")
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_medical_concept WHERE jsonb_array_length(accepted_units) = 0", Long::class.java),
        ).isZero()
    }

    @Test
    fun exportV3CarriesTheReferenceRangeTextTheCorrectionHistoryAndEveryCompletedDocument() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)

        // Document 1: one candidate with a printed range; its value is corrected at confirmation.
        val rangedDocument = requestDocument(alice, consentId, fixturePdf, "export-v2-ranged")
        uploadDocument(alice, rangedDocument, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$rangedDocument/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            rangedDocument,
            candidates = listOf(
                ExtractedCandidate(1, "Cholesterol", "188", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64), "120-199"),
            ),
        )
        val ranged = responseJson(
            read(get("/api/foundation/documents/$rangedDocument/candidates"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).single()
        mutate(
            post("/api/foundation/candidates/${ranged["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", "export-v2-confirm-ranged")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "190", "observedOn" to "2026-07-27"))),
            alice,
        ).andExpect(status().isCreated)

        // Document 2: every candidate excluded — COMPLETED with zero events.
        val excludedDocument = requestDocument(alice, consentId, januaryFixturePdf, "export-v2-excluded")
        uploadDocument(alice, excludedDocument, januaryFixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$excludedDocument/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(excludedDocument, sourceSha256 = januaryFixtureDigest, candidates = januaryCandidates)
        responseJson(
            read(get("/api/foundation/documents/$excludedDocument/candidates"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).forEach { candidate ->
            mutate(
                post("/api/foundation/candidates/${candidate["candidateId"].asText()}/exclusion")
                    .header("Idempotency-Key", "export-v2-exclude-${candidate["ordinal"].asInt()}"),
                alice,
            ).andExpect(status().isOk)
        }
        assertThat(documentStatus(excludedDocument)).isEqualTo("COMPLETED")

        // Document 3: one candidate with no printed range at all, confirmed as-is.
        val noRangeDocument = requestDocument(alice, consentId, fixturePdf, "export-v2-no-range")
        uploadDocument(alice, noRangeDocument, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$noRangeDocument/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            noRangeDocument,
            candidates = listOf(
                ExtractedCandidate(1, "Cholesterol", "188", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "2".repeat(64)),
            ),
        )
        val noRange = responseJson(
            read(get("/api/foundation/documents/$noRangeDocument/candidates"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).single()
        mutate(
            post("/api/foundation/candidates/${noRange["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", "export-v2-confirm-no-range")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "188"))),
            alice,
        ).andExpect(status().isCreated)

        val export = responseJson(
            read(get("/api/foundation/health-events/export"), alice)
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.schemaVersion").value("alm-health-events-export.v3"))
                .andExpect(jsonPath("$.events.length()").value(2))
                .andExpect(jsonPath("$.documents.length()").value(3))
                .andReturn().response.contentAsByteArray,
        )
        assertThat(export["events"].map { it["originalLabel"].asText() }).contains("Cholesterol")
        val event = export["events"].single { it["source"]["documentId"].asText() == rangedDocument.toString() }
        assertThat(event["value"].asText()).isEqualTo("190")
        assertThat(event["originalValue"].asText()).isEqualTo("188")
        assertThat(event["observedOn"].asText()).isEqualTo("2026-07-27")
        assertThat(event["originalObservedOn"].asText()).isEqualTo("2026-07-28")
        assertThat(event["corrected"].asBoolean()).isTrue()
        assertThat(event.has("correctionReason")).isFalse()
        assertThat(event["referenceRangeText"].asText()).isEqualTo("120-199")
        assertThat(event["source"]["documentId"].asText()).isEqualTo(rangedDocument.toString())
        val noRangeEvent = export["events"].single { it["source"]["documentId"].asText() == noRangeDocument.toString() }
        assertThat(noRangeEvent.has("referenceRangeText")).isTrue()
        assertThat(noRangeEvent["referenceRangeText"].isNull).isTrue()
        val documents = export["documents"].associateBy { it["documentId"].asText() }
        assertThat(documents.keys).containsExactlyElementsOf(listOf(rangedDocument, excludedDocument, noRangeDocument).map { it.toString() }.sorted())
        assertThat(export["documents"].map { it["documentId"].asText() }).isSorted()
        assertThat(documents.getValue(rangedDocument.toString())["eventCount"].asInt()).isEqualTo(1)
        assertThat(documents.getValue(rangedDocument.toString())["observedOn"].asText()).isEqualTo("2026-07-27")
        assertThat(documents.getValue(excludedDocument.toString())["eventCount"].asInt()).isZero()
        assertThat(documents.getValue(excludedDocument.toString())["status"].asText()).isEqualTo("COMPLETED")
        assertThat(documents.getValue(excludedDocument.toString()).has("observedOn")).isFalse()

        // The same record is served to the product without the range.
        val healthEvents = read(get("/api/foundation/health-events"), alice).andExpect(status().isOk).andReturn().response.contentAsString
        assertThat(healthEvents.lowercase()).doesNotContain("reference")
        assertThat(responseJson(healthEvents.toByteArray()).map { it["originalValue"].asText() }).contains("188")
    }

    @Test
    fun exportsTheOwnersEventsAsAFhirBundleWithRangeTextOnlyAndAuditsNoValue() {
        mockMvc.perform(get("/api/foundation/health-events/export/fhir")).andExpect(status().isUnauthorized)
        val alice = login("synthetic-alice")
        val bob = login("synthetic-bob")

        val empty = read(get("/api/foundation/health-events/export/fhir"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.resourceType").value("Bundle"))
            .andExpect(jsonPath("$.type").value("collection"))
            .andExpect(jsonPath("$.entry").doesNotExist())
            .andReturn().response
        assertThat(empty.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .matches("attachment; filename=\"alm-health-events-\\d{8}\\.fhir\\.json\"")

        val consentId = grantConsent(alice)
        val july = importJulyWithRange(alice, consentId, "fhir-july")
        // 총콜레스테롤 is corrected at confirmation (188 → 190); the other two are confirmed as read.
        july.forEach { candidate ->
            val value = if (candidate["ordinal"].asInt() == 1) "190" else candidate["value"].asText()
            mutate(
                post("/api/foundation/candidates/${candidate["candidateId"].asText()}/confirmation")
                    .header("Idempotency-Key", "fhir-july-confirm-${candidate["ordinal"].asInt()}")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to value))),
                alice,
            ).andExpect(status().isCreated)
        }

        val response = read(get("/api/foundation/health-events/export/fhir"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andReturn().response
        assertThat(response.contentType).startsWith("application/fhir+json")
        assertThat(response.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .matches("attachment; filename=\"alm-health-events-\\d{8}\\.fhir\\.json\"")
        val bundle = responseJson(response.contentAsByteArray)
        assertThat(bundle["resourceType"].asText()).isEqualTo("Bundle")
        assertThat(bundle["type"].asText()).isEqualTo("collection")
        assertThat(bundle["timestamp"].asText()).matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z")
        assertThat(bundle["meta"]["tag"].single()["system"].asText()).isEqualTo("https://alm.example/fhir/tag")
        assertThat(bundle["meta"]["tag"].single()["code"].asText()).isEqualTo("synthetic")

        val observations = bundle["entry"].map { it["resource"] }.associateBy { it["code"]["text"].asText() }
        assertThat(observations.keys).containsExactlyInAnyOrder("Cholesterol", "HbA1c", "Vitamin D")
        val eventIds = responseJson(
            read(get("/api/foundation/health-events"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).map { it["eventId"].asText() }
        assertThat(observations.values.map { it["id"].asText() }).containsExactlyInAnyOrderElementsOf(eventIds)

        val cholesterol = observations.getValue("Cholesterol")
        assertThat(cholesterol["resourceType"].asText()).isEqualTo("Observation")
        assertThat(cholesterol["status"].asText()).isEqualTo("final")
        assertThat(cholesterol["category"].single()["coding"].single()["code"].asText()).isEqualTo("laboratory")
        assertThat(cholesterol["code"]["coding"].single()["system"].asText()).isEqualTo("http://loinc.org")
        assertThat(cholesterol["code"]["coding"].single()["code"].asText()).isEqualTo("2093-3")
        assertThat(cholesterol["effectiveDateTime"].asText()).isEqualTo("2026-07-28")
        assertThat(cholesterol["valueQuantity"]["value"].isNumber).isTrue()
        assertThat(cholesterol["valueQuantity"]["value"].decimalValue()).isEqualByComparingTo("190")
        assertThat(cholesterol["valueQuantity"]["unit"].asText()).isEqualTo("mg/dL")
        assertThat(cholesterol["referenceRange"].single().fieldNames().asSequence().toList()).containsExactly("text")
        assertThat(cholesterol["referenceRange"].single()["text"].asText()).isEqualTo("120-199")
        assertThat(cholesterol["note"].single()["text"].asText()).isEqualTo("본인이 값을 수정함")

        val hba1c = observations.getValue("HbA1c")
        assertThat(hba1c["code"]["coding"].single()["code"].asText()).isEqualTo("4548-4")
        assertThat(hba1c["valueQuantity"]["value"].decimalValue()).isEqualByComparingTo("5.2")
        assertThat(hba1c.has("referenceRange")).isFalse()
        assertThat(hba1c.has("note")).isFalse()
        // vitamin-d's code names D3 specifically: the concept data keeps it out of the export.
        assertThat(observations.getValue("Vitamin D")["code"].has("coding")).isFalse()
        assertThat(response.contentAsString).doesNotContain("interpretation", "subject", "performer", "\"low\"", "\"high\"", "valueString")
        // Every valueQuantity is a plain JSON number, never exponent notation.
        assertThat(response.contentAsString).doesNotContainPattern("\"value\":[0-9.]*[eE][+-]?[0-9]")
        assertThat(hba1c["valueQuantity"]["value"].toString()).isEqualTo("5.2")

        read(get("/api/foundation/health-events/export/fhir"), bob)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.entry").doesNotExist())

        // The JSON export is untouched: same schema, same filename shape, its own audit resource type.
        val jsonExport = read(get("/api/foundation/health-events/export"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.schemaVersion").value("alm-health-events-export.v3"))
            .andReturn().response
        assertThat(jsonExport.contentType).startsWith("application/json")
        assertThat(jsonExport.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .matches("attachment; filename=\"alm-health-events-\\d{8}\\.json\"")

        fun auditCount(resourceType: String) = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM gc_audit_event
            WHERE event_type = 'HEALTH_EVENTS_EXPORTED' AND resource_type = ?
              AND resource_id IS NULL AND purpose_code IS NULL AND outcome = 'SUCCESS'
            """.trimIndent(),
            Long::class.java,
            resourceType,
        )
        assertThat(auditCount("EXPORT_FHIR")).isEqualTo(3L)
        assertThat(auditCount("EXPORT")).isEqualTo(1L)
        // No value, count or date in any text column of the export audit rows.
        val exportAuditText = jdbc.queryForList(
            """
            SELECT event_type || ' ' || resource_type || ' ' || COALESCE(purpose_code, '')
            FROM gc_audit_event WHERE event_type = 'HEALTH_EVENTS_EXPORTED'
            """.trimIndent(),
            String::class.java,
        )
        assertThat(exportAuditText).hasSize(4).allSatisfy { line ->
            assertThat(line).doesNotContainPattern("\\d").doesNotContain("mg/dL", "120-199")
        }
    }

    @Test
    fun twoThreadsConfirmingOneCandidateProduceExactlyOneRecordAndOneConflict() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "race-confirm")
        val principal = FoundationPrincipal("synthetic-alice", UUID.randomUUID(), alice.cookie.value.let(FoundationHashing::sha256))
        val results = race(2) { index ->
            service.confirmCandidate(principal, candidateId, "188", "race-confirm-key-$index")
        }
        assertThat(results.count { it.isSuccess }).isEqualTo(1)
        assertThat(results.mapNotNull { it.exceptionOrNull() }).singleElement().isInstanceOfSatisfying(FoundationConflictException::class.java) {
            assertThat(it.code).isEqualTo("candidate_state_changed")
        }
        assertThat(count("gc_health_record")).isEqualTo(1)
        assertThat(count("gc_health_record_version")).isEqualTo(1)
        assertThat(jdbc.queryForObject("SELECT status FROM gc_candidate WHERE candidate_id = ?", String::class.java, candidateId)).isEqualTo("CONFIRMED")
    }

    @Test
    fun confirmAndExcludeRacingOnOneCandidateLeaveExactlyOneOutcome() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "race-mixed")
        val principal = FoundationPrincipal("synthetic-alice", UUID.randomUUID(), FoundationHashing.sha256(alice.cookie.value))
        val results = race(2) { index ->
            if (index == 0) service.confirmCandidate(principal, candidateId, "188", "race-mixed-confirm") else service.excludeCandidate(principal, candidateId, "race-mixed-exclude")
        }
        assertThat(results.count { it.isSuccess }).isEqualTo(1)
        val status = jdbc.queryForObject("SELECT status FROM gc_candidate WHERE candidate_id = ?", String::class.java, candidateId)
        assertThat(status).isIn("CONFIRMED", "EXCLUDED")
        assertThat(count("gc_health_record")).isEqualTo(if (status == "CONFIRMED") 1L else 0L)
        val failure = results.mapNotNull { it.exceptionOrNull() }.single() as FoundationConflictException
        assertThat(failure.code).isIn("candidate_state_changed", "candidate_not_pending")
    }

    @Test
    fun twoThreadsCorrectingOneRecordProduceExactlyOneNewVersion() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        // Warms the two worker threads' own connection-pool and JIT paths through this exact call shape on a
        // throwaway record first, then removes every row it created: this test's timing window (two threads
        // truly overlapping on one record) is tight enough that a cold pooled connection or a not-yet-JIT'ed
        // correctRecord() path on either thread's first-ever call can by itself decide the race.
        val warmupPrincipal = FoundationPrincipal("synthetic-alice", UUID.randomUUID(), FoundationHashing.sha256(alice.cookie.value))
        val warmupCandidateId = createCandidate(alice, consentId, "race-correct-warmup")
        val warmupRecordId = service.confirmCandidate(warmupPrincipal, warmupCandidateId, "1", "race-correct-warmup-confirm").recordId
        race(2) { index -> service.correctRecord(warmupPrincipal, warmupRecordId, "2$index", "warmup $index", "race-correct-warmup-key-$index") }
        jdbc.update("DELETE FROM gc_health_record_version WHERE record_id = ?", warmupRecordId)
        jdbc.update("DELETE FROM gc_health_record WHERE record_id = ?", warmupRecordId)
        jdbc.update("DELETE FROM gc_candidate WHERE candidate_id = ?", warmupCandidateId)

        val candidateId = createCandidate(alice, consentId, "race-correct")
        val principal = FoundationPrincipal("synthetic-alice", UUID.randomUUID(), FoundationHashing.sha256(alice.cookie.value))
        val recordId = service.confirmCandidate(principal, candidateId, "188", "race-correct-confirm").recordId
        val results = race(2) { index ->
            service.correctRecord(principal, recordId, "19$index", "race $index", "race-correct-key-$index")
        }
        assertThat(results.count { it.isSuccess }).isEqualTo(1)
        assertThat((results.mapNotNull { it.exceptionOrNull() }.single() as FoundationConflictException).code).isEqualTo("record_state_changed")
        assertThat(count("gc_health_record_version")).isEqualTo(2)
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_health_record_version WHERE status = 'CURRENT'", Long::class.java)).isEqualTo(1L)
    }

    @Test
    fun frameworkFailuresAreProblemJsonWithNoStoreAndNeverEchoTheRequest() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "problem-shape")
        val secret = "SECRET-BODY-VALUE-7731"
        fun expectProblem(builder: MockHttpServletRequestBuilder, status: Int, code: String) {
            val response = mutate(builder, alice).andExpect(status().`is`(status))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value(code))
                .andReturn().response
            assertThat(response.contentAsString).isEqualTo("""{"code":"$code"}""")
            assertThat(response.contentAsString).doesNotContain(secret)
        }
        val confirmation = "/api/foundation/candidates/$candidateId/confirmation"
        expectProblem(post(confirmation).header("Idempotency-Key", "problem-json-1").contentType(MediaType.APPLICATION_JSON).content("{\"value\": \"$secret"), 400, "request_body_invalid")
        expectProblem(post(confirmation).header("Idempotency-Key", "problem-json-2").contentType(MediaType.APPLICATION_JSON).content("{\"value\":\"188\",\"extra\":\"$secret\"}"), 400, "request_body_invalid")
        expectProblem(post(confirmation).contentType(MediaType.APPLICATION_JSON).content("{\"value\":\"188\"}"), 400, "request_header_missing")
        expectProblem(post("/api/foundation/candidates/not-a-uuid-$secret/confirmation").header("Idempotency-Key", "problem-json-3").contentType(MediaType.APPLICATION_JSON).content("{\"value\":\"188\"}"), 400, "request_path_invalid")
        expectProblem(post(confirmation).header("Idempotency-Key", "problem-json-4").contentType(MediaType.TEXT_PLAIN).content(secret), 415, "media_type_unsupported")
        expectProblem(put("/api/foundation/candidates/$candidateId/confirmation").contentType(MediaType.APPLICATION_JSON).content("{}"), 405, "method_not_allowed")
        assertThat(count("gc_health_record")).isZero()
    }

    @Test
    fun malformedJsonNeverEchoesTheSentinelInResponseOrLog() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "problem-log-shape")
        val sentinel = "188 mg/dL SENTINEL"

        val watchedLoggers = listOf(
            "org.springframework.web",
            "kr.co.genomecompanion.foundation",
            "org.springframework.web.servlet.handler.HandlerExceptionResolver",
        ).map { LoggerFactory.getLogger(it) as Logger }
        val appender = ListAppender<ILoggingEvent>()
        appender.start()
        val previousLevels = watchedLoggers.map { it.level }
        watchedLoggers.forEach {
            it.addAppender(appender)
            it.level = Level.TRACE
        }
        try {
            val response = mutate(
                post("/api/foundation/candidates/$candidateId/confirmation")
                    .header("Idempotency-Key", "problem-log-json-1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"value\": \"$sentinel"),
                alice,
            ).andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.code").value("request_body_invalid"))
                .andReturn().response
            assertThat(response.contentAsString).doesNotContain(sentinel)
            assertThat(response.contentAsString).doesNotContain("188")

            val loggedMessages = appender.list.map { it.formattedMessage + it.throwableProxy?.message.orEmpty() }
            assertThat(loggedMessages).noneMatch { it.contains(sentinel) || it.contains("188") }
        } finally {
            watchedLoggers.forEachIndexed { index, logger ->
                logger.detachAppender(appender)
                logger.level = previousLevels[index]
            }
            appender.stop()
        }
    }

    @Test
    fun oversizedBodiesAre413BeforeAnyHandlerRuns() {
        val alice = login("synthetic-alice")
        val big = "{\"value\":\"" + "1".repeat(262_144) + "\"}"
        mutate(post("/api/foundation/candidates/${UUID.randomUUID()}/confirmation").header("Idempotency-Key", "too-big-json")
            .contentType(MediaType.APPLICATION_JSON).content(big), alice)
            .andExpect(status().isPayloadTooLarge).andExpect(jsonPath("$.code").value("payload_too_large"))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "too-big-upload")
        val capability = uploadCapabilities.getValue(documentId)
        mutate(put("/api/foundation/documents/$documentId/content").header("X-GC-Upload-Capability-Id", capability.capabilityId)
            .header("X-GC-Upload-Capability", capability.rawToken).contentType(MediaType.APPLICATION_PDF).content(ByteArray(10_485_761)), alice)
            .andExpect(status().isPayloadTooLarge)
        assertThat(count("gc_audit_event")).isGreaterThan(0)
    }

    @Test
    fun uploadIsStreamedToDiskAndVerifiedWithoutAHeapCopy() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "stream-upload")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        assertThat(Files.list(quarantineRoot.resolve("untrusted")).filter { it.toString().endsWith(".part") }.count()).isZero()
        assertThat(Files.readAllBytes(quarantineRoot.resolve("untrusted").resolve("$documentId.pdf"))).containsExactly(*fixturePdf)
        // Wrong bytes of the right length: rejected, and no partial file survives.
        val other = requestDocument(alice, consentId, januaryFixturePdf, "stream-upload-2")
        val capability = uploadCapabilities.getValue(other)
        mutate(put("/api/foundation/documents/$other/content").header("X-GC-Upload-Capability-Id", capability.capabilityId)
            .header("X-GC-Upload-Capability", capability.rawToken).contentType(MediaType.APPLICATION_PDF)
            .content(ByteArray(januaryFixturePdf.size) { 'x'.code.toByte() }), alice)
            .andExpect(status().isBadRequest).andExpect(jsonPath("$.code").value("content_digest_mismatch"))
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$other.pdf"))).isFalse()
        assertThat(Files.list(quarantineRoot.resolve("untrusted")).filter { it.toString().endsWith(".part") }.count()).isZero()
    }

    /** Starts [threads] callables on one latch against the real database and returns their results in submission order. */
    /**
     * The page boundary is a keyset, not an offset: page one plus page two plus page three is exactly
     * the whole list, in the same order, with no row repeated and none skipped, and `X-GC-Next-After`
     * is present only while more rows follow. The same cursor drives `/health-events`, because both
     * read the one record order. `limit` outside 1..200 and a malformed cursor are refused in the
     * product's own error shape rather than silently clamped.
     */
    @Test
    fun recordsAndHealthEventsPaginateWithAnAfterCursorAndTheWholeHistoryReadsRefuseAboveTheCap() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        repeat(3) { round ->
            confirmEveryCandidate(
                alice,
                importSyntheticDocument(alice, consentId, fixturePdf, fixtureDigest, "page-$round"),
                "page-$round",
            )
        }

        val page1 = read(get("/api/foundation/records").param("limit", "4"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(4))
            .andReturn()
            .response
        val next = checkNotNull(page1.getHeader(NEXT_AFTER_HEADER))
        assertThat(next).isEqualTo(responseJson(page1.contentAsByteArray).last()["recordVersionId"].asText())

        val page2 = read(get("/api/foundation/records").param("limit", "4").param("after", next), alice)
            .andExpect(status().isOk)
            .andReturn()
            .response
        assertThat(responseJson(page2.contentAsByteArray)).hasSize(4)
        val lastAfter = checkNotNull(page2.getHeader(NEXT_AFTER_HEADER))
        val page3 = read(get("/api/foundation/records").param("limit", "4").param("after", lastAfter), alice)
            .andExpect(status().isOk)
            .andReturn()
            .response
        assertThat(responseJson(page3.contentAsByteArray)).hasSize(1)
        assertThat(page3.getHeader(NEXT_AFTER_HEADER)).isNull()

        val whole = responseJson(read(get("/api/foundation/records"), alice).andReturn().response.contentAsByteArray)
            .map { it["recordVersionId"].asText() }
        assertThat(
            listOf(page1, page2, page3).flatMap { page ->
                responseJson(page.contentAsByteArray).map { it["recordVersionId"].asText() }
            },
        ).isEqualTo(whole)

        read(get("/api/foundation/health-events").param("limit", "4").param("after", next), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(4))
        // A cursor that is not this subject's own is an empty page, never a window into other rows.
        read(get("/api/foundation/health-events").param("after", UUID.randomUUID().toString()), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(0))

        // Bob's own, real recordVersionId is just as much "not this subject's own" as a random UUID:
        // Alice gets an empty page and no next-cursor header, never a peek at Bob's row.
        val bob = login("synthetic-bob")
        val bobConsentId = grantConsent(bob)
        confirmEveryCandidate(bob, importSyntheticDocument(bob, bobConsentId, fixturePdf, fixtureDigest, "bob-page"), "bob-page")
        val bobRecordVersionId = responseJson(
            read(get("/api/foundation/records"), bob).andReturn().response.contentAsByteArray,
        ).first()["recordVersionId"].asText()
        val aliceWithBobCursor = read(get("/api/foundation/records").param("after", bobRecordVersionId), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(0))
            .andReturn()
            .response
        assertThat(aliceWithBobCursor.getHeader(NEXT_AFTER_HEADER)).isNull()

        // `limit` is one code, `request_invalid`, for every way it can be wrong: non-numeric,
        // overflowing Int, zero, negative or above the cap — never Spring's own type-mismatch
        // `request_path_invalid`, which a raw `Int?` binding would otherwise surface for the first two.
        read(get("/api/foundation/records").param("limit", "abc"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("request_invalid"))
        read(get("/api/foundation/records").param("limit", "2147483648"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("request_invalid"))
        read(get("/api/foundation/records").param("limit", "201"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("request_invalid"))
        read(get("/api/foundation/records").param("limit", "0"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("request_invalid"))
        read(get("/api/foundation/health-events").param("limit", "abc"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("request_invalid"))
        read(get("/api/foundation/health-events").param("limit", "2147483648"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("request_invalid"))
        read(get("/api/foundation/records").param("after", "not-a-uuid"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("request_path_invalid"))

        // 9 real records plus 4,992 synthetic ones is 5,001 CURRENT versions: one past the cap. The
        // rows are inserted as extra CANDIDATES on the same job first, so gc_health_record's UNIQUE
        // candidate_id holds throughout and no constraint has to be dropped. Every value is the
        // digit 1 and every label is `cap-<n>`: nothing here resembles a measurement.
        val candidateId = jdbc.queryForObject(
            "SELECT candidate_id FROM gc_candidate WHERE subject_id = ? ORDER BY candidate_id LIMIT 1",
            UUID::class.java,
            "synthetic-alice",
        )
        jdbc.update(
            """
            INSERT INTO gc_candidate(
                candidate_id, job_id, document_id, subject_id, status, label, candidate_value, unit,
                observed_on, evidence_page, source_text_sha256, created_at, ordinal, confirmed_at)
            SELECT gen_random_uuid(), c.job_id, c.document_id, c.subject_id, 'CONFIRMED',
                   'cap-' || n, '1', 'mg/dL', c.observed_on, 1, repeat('a', 64),
                   CURRENT_TIMESTAMP, 1000 + n, CURRENT_TIMESTAMP
            FROM gc_candidate c, generate_series(1, 4992) AS n
            WHERE c.candidate_id = ?
            """.trimIndent(),
            candidateId,
        )
        jdbc.update(
            """
            INSERT INTO gc_health_record(
                record_id, candidate_id, document_id, subject_id, label, confirmed_value, unit,
                observed_on, confirmed_at)
            SELECT gen_random_uuid(), c.candidate_id, c.document_id, c.subject_id, c.label,
                   c.candidate_value, c.unit, c.observed_on, CURRENT_TIMESTAMP
            FROM gc_candidate c
            WHERE c.subject_id = ? AND c.label LIKE 'cap-%'
            """.trimIndent(),
            "synthetic-alice",
        )
        jdbc.update(
            """
            INSERT INTO gc_health_record_version(version_id, record_id, subject_id, status, value, changed_at)
            SELECT gen_random_uuid(), r.record_id, r.subject_id, 'CURRENT', r.confirmed_value, CURRENT_TIMESTAMP
            FROM gc_health_record r
            WHERE r.subject_id = ? AND r.label LIKE 'cap-%'
            """.trimIndent(),
            "synthetic-alice",
        )
        assertThat(repository.countCurrentRecords("synthetic-alice")).isEqualTo(5_001L)

        read(get("/api/foundation/health-events/export"), alice)
            .andExpect(status().isPayloadTooLarge)
            .andExpect(jsonPath("$.code").value("payload_cap_exceeded"))
        read(get("/api/foundation/health-events/export/fhir"), alice)
            .andExpect(status().isPayloadTooLarge)
            .andExpect(jsonPath("$.code").value("payload_cap_exceeded"))
        read(get("/api/foundation/changes"), alice)
            .andExpect(status().isPayloadTooLarge)
            .andExpect(jsonPath("$.code").value("payload_cap_exceeded"))
        read(get("/api/foundation/series"), alice)
            .andExpect(status().isPayloadTooLarge)
            .andExpect(jsonPath("$.code").value("payload_cap_exceeded"))
        // The paged reads stay available at any size: the cap bounds one response, not the data.
        read(get("/api/foundation/records").param("limit", "10"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(10))
    }

    /**
     * The filename and `exportedAt` come from one instant, so they cannot disagree about which side
     * of midnight in Asia/Seoul the export happened on. The expected filename is derived from the
     * body the server just returned, so this needs no clock control and cannot itself drift.
     */
    @Test
    fun exportFilenameAndExportedAtComeFromOneInstantInSeoulTime() {
        val alice = login("synthetic-alice")
        grantConsent(alice)
        val response = read(get("/api/foundation/health-events/export"), alice)
            .andExpect(status().isOk)
            .andReturn()
            .response
        val exportedAt = java.time.Instant.parse(responseJson(response.contentAsByteArray)["exportedAt"].asText())
        assertThat(responseJson(response.contentAsByteArray)["exportedAt"].asText()).endsWith("Z")
        assertThat(response.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .isEqualTo("attachment; filename=\"alm-health-events-${seoulDate(exportedAt)}.json\"")

        val fhir = read(get("/api/foundation/health-events/export/fhir"), alice)
            .andExpect(status().isOk)
            .andReturn()
            .response
        val timestamp = java.time.Instant.parse(responseJson(fhir.contentAsByteArray)["timestamp"].asText())
        assertThat(fhir.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .isEqualTo("attachment; filename=\"alm-health-events-${seoulDate(timestamp)}.fhir.json\"")
    }

    /**
     * PHI-safe logging as a property, not a habit: one whole lifecycle (session, consent, document,
     * candidates, confirmation, correction, export, revocation, deletion), a server-decided worker dead
     * letter and a malformed-body failure run with a `ListAppender` on the *root* logger **with the root
     * level lowered to TRACE**, so a category that inherits the root level — the foundation service, the
     * worker boundary, the JDBC template, the driver, Spring's own internals — is captured at every
     * level it can speak at, not only at INFO, and nothing a person uploaded or typed may appear in any
     * of it.
     *
     * Two categories are *not* widened by this, and deliberately so: `logback-spring.xml` pins
     * `org.springframework.web` to WARN and `org.apache.pdfbox` to ERROR, and an explicit level on a
     * logger wins over the root's. Those two pins are themselves the control for those categories (a
     * `spring.mvc.log-request-details`-style body echo and PDFBox's parse warnings), so the capture
     * below proves the pins hold rather than re-proving what they exclude. `org.springframework.jdbc`
     * is pinned to INFO for the same reason: at TRACE, `StatementCreatorUtils` prints every bind
     * parameter — i.e. every value, label and exam date — so the pin, not this test's filtering, is what
     * keeps a value out of a log line when someone raises a level in an incident.
     */
    @Test
    fun aFullLifecycleLogsNoValueLabelFilenameOrDate() {
        val root = LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME) as Logger
        val appender = ListAppender<ILoggingEvent>().also { it.start(); root.addAppender(it) }
        val originalRootLevel = root.level
        root.level = ch.qos.logback.classic.Level.TRACE
        val stdout = java.io.ByteArrayOutputStream()
        val originalOut = System.out
        System.setOut(java.io.PrintStream(stdout, true, Charsets.UTF_8))
        try {
            val alice = login("synthetic-alice")
            val consentId = grantConsent(alice)
            val candidates = importJulyWithRange(alice, consentId, "log-capture")
            confirmEveryCandidate(alice, candidates, "log-capture")
            // A server-decided dead letter too: the worker reports a digest that is not the one the
            // core stored, so `completeInspection` fails the job itself. That path marks the job failed
            // without the worker ever calling `/failure`, and it must still say `worker_job_failed`.
            val deadLettered = requestDocument(alice, consentId, fixturePdf, "log-capture-dead-letter")
            uploadDocument(alice, deadLettered, fixturePdf).andExpect(status().isOk)
            mutate(post("/api/foundation/documents/$deadLettered/finalization"), alice).andExpect(status().isAccepted)
            val staleLease = checkNotNull(workerService.lease("a".repeat(64)))
            assertThat(
                workerService.completeInspection(
                    staleLease.jobId,
                    staleLease.leaseToken,
                    approvedInspectionRequest("f".repeat(64)),
                ).status,
            ).isEqualTo("DEAD_LETTER")
            val recordId = responseJson(read(get("/api/foundation/records"), alice).andReturn().response.contentAsByteArray)
                .first()["recordId"].asText()
            mutate(
                post("/api/foundation/records/$recordId/corrections")
                    .header("Idempotency-Key", "log-capture-correct")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to "190", "reason" to "결과지에 190으로 적혀 있음"))),
                alice,
            ).andExpect(status().isOk)
            read(get("/api/foundation/health-events/export"), alice).andExpect(status().isOk)
            mutate(post("/api/foundation/consents/$consentId/revocation"), alice).andExpect(status().isOk)
            mutate(delete("/api/foundation/profile"), alice).andExpect(status().isOk)
            // A failure path too: malformed JSON with a value-looking payload.
            mockMvc.perform(
                post("/api/foundation/session")
                    .header(HttpHeaders.ORIGIN, allowedOrigin)
                    .header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"subjectId\":\"synthetic-alice\",\"credential\":\"188 mg/dL Cholesterol"),
            ).andExpect(status().isBadRequest)
        } finally {
            System.setOut(originalOut)
            root.level = originalRootLevel
            root.detachAppender(appender)
            appender.stop()
        }
        // Console lines carry `logback-spring.xml`'s prefix (an instant, a level, a logger name and the
        // correlation id). None of it is request-derived, and all of it is full of incidental digits — a
        // millisecond field alone reads as "5.2" roughly every other line — so the prefix is stripped and
        // the assertions below run against what the code actually chose to say. A line that does *not*
        // match the prefix (a stray println, a stack trace) is kept whole and asserted on in full.
        val consolePrefix = Regex("""^\d{4}-\d{2}-\d{2}T[0-9:.]+Z level=\S+ logger=\S+ correlation_id=\S+ """)
        val lines = appender.list.map { it.formattedMessage + it.throwableProxy?.message.orEmpty() } +
            stdout.toString(Charsets.UTF_8).lines().map { it.replace(consolePrefix, "") }
        assertThat(lines).isNotEmpty()
        assertThat(lines.count { it.contains("event=") }).isGreaterThanOrEqualTo(8)
        // The server-decided dead letter says so, with its own reason code and nothing else.
        assertThat(lines.filter { it.contains("event=worker_job_failed") })
            .describedAs("worker_job_failed lines")
            .anyMatch { it.contains("reason_code=inspection_digest_mismatch") }
        // Masked for the digit-only probes ("188", "42", "190") only, because a long hex token hits one
        // of them by coincidence: the truncated `subject_hash` (a different `AUDIT_PEPPER` would
        // otherwise red this test without a leak), Java's own `Object.toString()` identity hash
        // (`PatternValidator@42ea42ba`), and a server-generated UUID — at TRACE, Spring Security and the
        // test dispatcher echo the request *path*, and `.../documents/166f73f7-ec07-423e-…/content`
        // contains "42" about a third of the time. None of the three is derived from anything a person
        // typed or uploaded, and a leaked value would have to land inside one of those exact token
        // shapes to hide here. Every non-numeric forbidden string is still matched against the whole
        // line, masks and all.
        val opaqueIdentifiers = Regex(
            "subject_hash=[0-9a-f]{1,12}" +
                "|@[0-9a-f]{6,16}\\b" +
                "|\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b",
        )
        for (
            forbidden in listOf(
                "188", "5.2", "42", "190", "Cholesterol", "HbA1c", "Vitamin D", "2026-07-28", "120-199",
                ".pdf", ".png", "synthetic-alice", "결과지에 190으로",
            )
        ) {
            val haystack = if (forbidden.all { it.isDigit() }) {
                lines.map { it.replace(opaqueIdentifiers, "<opaque>") }
            } else {
                lines
            }
            assertThat(haystack.filter { it.contains(forbidden) })
                .describedAs("log lines containing '$forbidden'").isEmpty()
        }
    }

    private fun seoulDate(instant: java.time.Instant): String =
        java.time.LocalDate.ofInstant(instant, java.time.ZoneId.of("Asia/Seoul"))
            .format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE)

    private fun <T> race(threads: Int, action: (Int) -> T): List<Result<T>> {
        val executor = Executors.newFixedThreadPool(threads)
        val ready = CountDownLatch(threads)
        val start = CountDownLatch(1)
        try {
            val futures = (0 until threads).map { index ->
                executor.submit<Result<T>> {
                    ready.countDown()
                    check(start.await(5, TimeUnit.SECONDS))
                    runCatching { action(index) }
                }
            }
            check(ready.await(5, TimeUnit.SECONDS))
            start.countDown()
            return futures.map { it.get(15, TimeUnit.SECONDS) }
        } finally {
            start.countDown()
            executor.shutdownNow()
            check(executor.awaitTermination(5, TimeUnit.SECONDS))
        }
    }

    /** The July document whose first row prints the range `120-199` (stored, exported only). */
    private fun importJulyWithRange(client: TestClient, consentId: UUID, keyPrefix: String): List<JsonNode> {
        val documentId = requestDocument(client, consentId, fixturePdf, "$keyPrefix-document-request")
        uploadDocument(client, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), client).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = listOf(
                ExtractedCandidate(1, "Cholesterol", "188", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64), "120-199"),
                ExtractedCandidate(2, "HbA1c", "5.2", "%", "2026-07-28", 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64), null),
                ExtractedCandidate(3, "Vitamin D", "42", "ng/mL", "2026-07-28", 1, EvidenceBox(0.08, 0.18, 0.25, 0.02), "3".repeat(64), null),
            ),
        )
        return responseJson(
            read(get("/api/foundation/documents/$documentId/candidates"), client)
                .andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).toList()
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
        runWorkerPipeline(
            documentId,
            sourceSha256 = digest,
            candidates = if (digest == januaryFixtureDigest) januaryCandidates else julyCandidates,
        )
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

    /**
     * The worker's id is only as trustworthy as its proof: a shared credential alone lets any holder
     * claim any worker id (and so any per-worker budget or audit attribution), so the worker boundary
     * requires `X-GC-Worker-Id-Mac` = HMAC-SHA256(key = sha256(credential), message = workerId). Core
     * stores only the credential digest, so it can verify without ever holding the raw secret.
     *
     * The same test pins one-shot lease semantics end to end over HTTP: the *identical* completion
     * request replayed byte for byte (same job, same lease token, same body) is rejected, and exactly
     * one inspection row exists — a retry storm or a duplicated worker can never double-write.
     */
    @Test
    fun workerIdentityMustBeProvenByHmacAndACompletedLeaseCannotBeReplayed() {
        fun lease(workerId: String, mac: String?) = mockMvc.perform(
            post("/internal/document-boundary/jobs/lease")
                .header("X-GC-Worker-Credential", workerCredential)
                .header("X-GC-Worker-Id", workerId)
                .let { if (mac == null) it else it.header("X-GC-Worker-Id-Mac", mac) },
        )
        lease("worker-a", null)
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("worker_identity_denied"))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
        lease("worker-a", "0".repeat(64))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("worker_identity_denied"))
        // A MAC that is valid, but for a different worker id, must not authenticate "worker-a".
        lease("worker-a", WorkerIdentity.mac(workerCredential, "worker-b"))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("worker_identity_denied"))
        lease("worker-a", WorkerIdentity.mac(workerCredential, "worker-a"))
            .andExpect(status().isNoContent)

        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "replay-lease")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)

        val leased = responseJson(
            lease("worker-a", WorkerIdentity.mac(workerCredential, "worker-a"))
                .andExpect(status().isOk)
                .andReturn()
                .response
                .contentAsByteArray,
        )
        assertThat(leased["jobType"].asText()).isEqualTo("SECURITY_INSPECTION")
        val jobId = leased["jobId"].asText()
        val leaseToken = leased["leaseToken"].asText()
        // Rebuilt, never reused: two requests that are identical on the wire, not two different requests.
        fun completeInspection() = mockMvc.perform(
            post("/internal/document-boundary/jobs/$jobId/inspection-result")
                .header("X-GC-Worker-Credential", workerCredential)
                .header("X-GC-Worker-Id", "worker-a")
                .header("X-GC-Worker-Id-Mac", WorkerIdentity.mac(workerCredential, "worker-a"))
                .header("X-GC-Job-Lease", leaseToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(approvedInspectionRequest())),
        )
        completeInspection().andExpect(status().isOk)
        completeInspection()
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("worker_job_lease_invalid"))
        assertThat(count("gc_document_inspection")).isEqualTo(1)
    }

    /**
     * The janitor is the one place that removes what nothing else will: sessions past their expiry or
     * already revoked, upload capabilities past their expiry, idempotency claims past their 24h TTL,
     * quarantine files no database row points at any more (the retry path for a delete that failed
     * after commit), and jobs that were queued and never leased.
     *
     * Every category is asserted in both directions. A second subject holds one live row of each kind —
     * an unexpired session, an unexpired upload capability, an idempotency claim inside its TTL and a
     * job queued a moment ago — and the counts after the sweep are exact, because a sweep that deleted
     * far too much would satisfy a "the dead row is gone" assertion just as well as a correct one.
     *
     * Files are asserted in both directions too, and the age threshold is the second half of that: an
     * unknown file that is *fresh* survives (its row may simply not have committed yet — the worker
     * writes an approved PDF and its preview to storage before `markInspectionCompleted` commits),
     * while the same file backdated past the in-flight window is swept.
     *
     * The sweep is idempotent by construction — the last sweep here finds nothing — and it never runs
     * on its own during the suite: `gc.foundation.janitor-interval` is `PT24H` under test, so the only
     * sweeps are the explicit ones.
     */
    @Test
    fun theJanitorSweepsExpiredRowsOrphanFilesAndStaleQueuedJobs() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "janitor-doc")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        // The live half: a second subject with one row of every swept kind, none of them dead. Nothing
        // below ages any of these, and the sweep must leave every one of them exactly where it is.
        val bob = login("synthetic-bob")
        val bobConsentId = grantConsent(bob)
        val bobDocumentId = requestDocument(bob, bobConsentId, fixturePdf, "janitor-live-doc")
        uploadDocument(bob, bobDocumentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$bobDocumentId/finalization"), bob).andExpect(status().isAccepted)

        // A second document whose job a worker already holds a live lease on: the stale-job UPDATE only
        // touches 'QUEUED' and 'FAILED_RETRYABLE', so an old LEASED row -- a worker actually holding it
        // -- must survive the sweep even when it is far older than the 24h threshold. Lease expiry, not
        // age, is what reclaims a leased job, and that is a different code path entirely, so the row is
        // put straight into 'LEASED' shape rather than raced through the real lease-next endpoint.
        val carolDocumentId = requestDocument(bob, bobConsentId, fixturePdf, "janitor-leased-doc")
        uploadDocument(bob, carolDocumentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$carolDocumentId/finalization"), bob).andExpect(status().isAccepted)
        assertThat(
            jdbc.update(
                "UPDATE gc_document_job SET status = 'LEASED', lease_token_hash = ?, worker_id_hash = ?," +
                    " lease_expires_at = CURRENT_TIMESTAMP + INTERVAL '1 hour'," +
                    " created_at = CURRENT_TIMESTAMP - INTERVAL '25 hours' WHERE document_id = ?",
                "a".repeat(64),
                "b".repeat(64),
                carolDocumentId,
            ),
        ).isEqualTo(1)

        // created_at moves with it: gc_session_expiry checks expires_at > created_at.
        assertThat(
            jdbc.update(
                "UPDATE gc_session SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'," +
                    " created_at = CURRENT_TIMESTAMP - INTERVAL '2 minute' WHERE subject_id = ?",
                "synthetic-alice",
            ),
        ).isEqualTo(1)
        assertThat(
            jdbc.update(
                "UPDATE gc_upload_capability SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'," +
                    " issued_at = CURRENT_TIMESTAMP - INTERVAL '2 minute' WHERE document_id = ?",
                documentId,
            ),
        ).isEqualTo(1)
        assertThat(
            jdbc.update(
                "UPDATE gc_idempotency SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'" +
                    " WHERE idempotency_key = 'janitor-doc'",
            ),
        ).isEqualTo(1)
        assertThat(
            jdbc.update(
                "UPDATE gc_document_job SET created_at = CURRENT_TIMESTAMP - INTERVAL '25 hours' WHERE document_id = ?",
                documentId,
            ),
        ).isEqualTo(1)
        val liveIdempotencyKeys = count("gc_idempotency") - 1
        assertThat(liveIdempotencyKeys).isPositive()

        // A settled orphan is swept; an unknown file written moments ago is not, because the row that
        // will point at it may still be mid-commit. Same for part files, stale versus in-flight.
        val orphan = quarantineRoot.resolve("untrusted").resolve("${UUID.randomUUID()}.pdf")
        Files.writeString(orphan, "%PDF-1.7\norphan synthetic\n%%EOF\n")
        backdateBeyondTheInFlightWindow(orphan)
        val freshOrphan = quarantineRoot.resolve("untrusted").resolve("${UUID.randomUUID()}.pdf")
        Files.writeString(freshOrphan, "%PDF-1.7\njust-written synthetic\n%%EOF\n")
        val freshPart = quarantineRoot.resolve("untrusted").resolve("${UUID.randomUUID()}.pdf.part")
        Files.writeString(freshPart, "%PDF-1.7\nin-flight synthetic\n")
        val stalePart = quarantineRoot.resolve("untrusted").resolve("${UUID.randomUUID()}.pdf.part")
        Files.writeString(stalePart, "%PDF-1.7\nabandoned synthetic\n")
        backdateBeyondTheInFlightWindow(stalePart)

        val swept = captureFoundationLogs { janitor.sweep() }

        assertThat(swept.value).isEqualTo(JanitorReport(1, 1, 1, 1, 1, 1))
        // The sweep line carries all six counts as integers, part files in their own field.
        assertThat(swept.lines).contains(
            "event=janitor_sweep sessions=1 capabilities=1 idempotency=1 orphan_files=1 part_files=1 stale_jobs=1",
        )

        // Swept: the settled orphan, the abandoned part file, alice's rows and her stale job.
        assertThat(Files.exists(orphan)).isFalse()
        assertThat(Files.exists(stalePart)).isFalse()
        assertThat(documentStatus(documentId)).isEqualTo("FAILED_TERMINAL")
        assertThat(
            jdbc.queryForObject(
                "SELECT failure_code FROM gc_document WHERE document_id = ?",
                String::class.java,
                documentId,
            ),
        ).isEqualTo("stale")
        assertThat(
            jdbc.queryForObject(
                "SELECT status FROM gc_document_job WHERE document_id = ?",
                String::class.java,
                documentId,
            ),
        ).isEqualTo("FAILED_TERMINAL")
        read(get("/api/foundation/records"), alice).andExpect(status().isUnauthorized)

        // Kept: every live row, and every file something still points at or that is still too young.
        assertThat(Files.exists(freshOrphan)).isTrue()
        assertThat(Files.exists(freshPart)).isTrue()
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$documentId.pdf"))).isTrue()
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$bobDocumentId.pdf"))).isTrue()
        assertThat(count("gc_session")).isEqualTo(1)
        assertThat(countForSubject("gc_session", "synthetic-bob")).isEqualTo(1)
        // Two live capabilities now: bob's own document plus the second one made for the LEASED-job
        // fixture above, neither of them expired.
        assertThat(count("gc_upload_capability")).isEqualTo(2)
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM gc_upload_capability WHERE document_id = ?",
                Long::class.java,
                bobDocumentId,
            ),
        ).isEqualTo(1)
        assertThat(count("gc_idempotency")).isEqualTo(liveIdempotencyKeys)
        assertThat(
            jdbc.queryForObject(
                "SELECT status FROM gc_document_job WHERE document_id = ?",
                String::class.java,
                bobDocumentId,
            ),
        ).isEqualTo("QUEUED")
        assertThat(documentStatus(bobDocumentId)).isNotEqualTo("FAILED_TERMINAL")
        read(get("/api/foundation/records"), bob).andExpect(status().isOk)
        // Carol's job is LEASED and 25h old, yet the stale-job sweep only ever touches QUEUED and
        // FAILED_RETRYABLE rows -- a worker holding the lease is untouched by age alone.
        assertThat(
            jdbc.queryForObject(
                "SELECT status FROM gc_document_job WHERE document_id = ?",
                String::class.java,
                carolDocumentId,
            ),
        ).isEqualTo("LEASED")
        assertThat(documentStatus(carolDocumentId)).isNotEqualTo("FAILED_TERMINAL")

        // The file that survived only because it was young is swept once it has settled — the same file,
        // the same sweep, nothing but its age changed.
        backdateBeyondTheInFlightWindow(freshOrphan)
        assertThat(janitor.sweep()).isEqualTo(JanitorReport(0, 0, 0, 1, 0, 0))
        assertThat(Files.exists(freshOrphan)).isFalse()

        Files.delete(freshPart)
        assertThat(janitor.sweep()).isEqualTo(JanitorReport(0, 0, 0, 0, 0, 0))
    }

    /**
     * A sweep is five independent categories, not one transaction. When one of them throws — here the
     * quarantine listing, injected through the storage seam because a read-only bit is not portable
     * (CI runs as root) — the other four must still run to completion, the failure must be logged as
     * `janitor_category_failed` with the category name and the exception's *class* only, and the next
     * sweep must pick up what the failed category left behind. The alternative, a sweep that abandons
     * everything after the first error, means one unreadable directory quietly stops sessions expiring.
     */
    @Test
    fun aFailedJanitorCategoryIsLoggedAndLeavesTheOtherCategoriesRunning() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "janitor-isolation")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        jdbc.update(
            "UPDATE gc_session SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'," +
                " created_at = CURRENT_TIMESTAMP - INTERVAL '2 minute'",
        )
        jdbc.update(
            "UPDATE gc_upload_capability SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'," +
                " issued_at = CURRENT_TIMESTAMP - INTERVAL '2 minute'",
        )
        jdbc.update("UPDATE gc_idempotency SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'")
        jdbc.update("UPDATE gc_document_job SET created_at = CURRENT_TIMESTAMP - INTERVAL '25 hours'")
        val orphan = quarantineRoot.resolve("untrusted").resolve("${UUID.randomUUID()}.pdf")
        Files.writeString(orphan, "%PDF-1.7\norphan synthetic\n%%EOF\n")
        backdateBeyondTheInFlightWindow(orphan)
        faultyDocumentStorage.failNextListObjectKeys()

        val swept = captureFoundationLogs { janitor.sweep() }

        // Four categories ran; the file category contributed zero and touched nothing.
        assertThat(swept.value).isEqualTo(JanitorReport(1, 1, 1, 0, 0, 1))
        assertThat(Files.exists(orphan)).isTrue()
        assertThat(swept.lines).contains("event=janitor_category_failed category=files exception_class=IOException")
        assertThat(swept.lines).contains(
            "event=janitor_sweep sessions=1 capabilities=1 idempotency=1 orphan_files=0 part_files=0 stale_jobs=1",
        )
        // The exception's message names a path in production; only its class name may be written down.
        assertThat(swept.lines).noneMatch { it.contains("synthetic-injected-list-failure") }
        assertThat(count("gc_session")).isZero()

        // Nothing is lost: the next sweep collects what the failed category could not.
        assertThat(janitor.sweep()).isEqualTo(JanitorReport(0, 0, 0, 1, 0, 0))
        assertThat(Files.exists(orphan)).isFalse()
    }

    /** Ages [path] past the janitor's one-hour in-flight grace, so a sweep may consider it settled. */
    private fun backdateBeyondTheInFlightWindow(path: Path) {
        Files.setLastModifiedTime(
            path,
            java.nio.file.attribute.FileTime.from(java.time.Instant.now(clock).minusSeconds(7_200)),
        )
    }

    private class CapturedSweep<T>(val value: T, val lines: List<String>)

    /** Runs [block] with a `ListAppender` on the foundation's own logger category, so a test can assert
     * the exact shape of the lines the sweep chose to write. */
    private fun <T> captureFoundationLogs(block: () -> T): CapturedSweep<T> {
        val logger = LoggerFactory.getLogger("kr.co.genomecompanion.foundation") as Logger
        val appender = ListAppender<ILoggingEvent>().also { it.start() }
        val previousLevel = logger.level
        logger.addAppender(appender)
        logger.level = Level.TRACE
        try {
            val value = block()
            return CapturedSweep(value, appender.list.map { it.formattedMessage })
        } finally {
            logger.detachAppender(appender)
            logger.level = previousLevel
            appender.stop()
        }
    }

    /** A document still waiting for its upload owns its untrusted key even before the row records it:
     * a sweep racing the upload's atomic move must never delete the file it just landed. */
    @Test
    fun theJanitorLeavesAnUploadPendingDocumentsFileAlone() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "janitor-pending")
        val landed = quarantineRoot.resolve("untrusted").resolve("$documentId.pdf")
        Files.createDirectories(landed.parent)
        Files.write(landed, fixturePdf)
        // Past the one-hour in-flight grace: without the UPLOAD_PENDING reservation this file would
        // read as a settled orphan, so a zero orphan count here proves the reservation, not the grace
        // period that the other janitor test already covers on its own.
        backdateBeyondTheInFlightWindow(landed)
        assertThat(
            jdbc.queryForObject("SELECT object_key FROM gc_document WHERE document_id = ?", String::class.java, documentId),
        ).isNull()

        assertThat(janitor.sweep().orphanFiles).isZero()

        assertThat(Files.exists(landed)).isTrue()
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
    }

    private fun login(subjectId: String): TestClient {
        val response = mockMvc.perform(
            post("/api/foundation/session")
                .header(HttpHeaders.ORIGIN, allowedOrigin)
                .header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE)
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
        candidates: List<ExtractedCandidate> = julyCandidates,
        abstentions: List<ExtractionAbstention> = emptyList(),
        expectedStatus: String = "REVIEW_REQUIRED",
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
                candidates = candidates,
                abstentions = abstentions,
            ),
        )
        assertThat(
            jdbc.queryForObject(
                "SELECT status FROM gc_document WHERE document_id = ?",
                String::class.java,
                documentId,
            ),
        ).isEqualTo(expectedStatus)
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
        policyVersion = "pdf-security-v2",
        scannerName = "SyntheticManifestScanner",
        scannerVersion = "test-only-v1",
        signatureVersion = "allowlisted-fixture",
    )

    private fun mutate(builder: MockHttpServletRequestBuilder, client: TestClient) =
        mockMvc.perform(
            builder
                .cookie(client.cookie)
                .header(HttpHeaders.ORIGIN, allowedOrigin)
                .header(FOUNDATION_CSRF_HEADER, client.csrf)
                .header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE),
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

    @Test
    fun `audit leak needles are matched as literal text and never as regular expression syntax`() {
        // countRawHealthValuesInAudit joins its needles into one POSIX alternation, so anything not
        // escaped is read as syntax by PostgreSQL: `HbA1c (%)` compiles to a group that matches the
        // different text `HbA1c %`, and a lone `(` does not compile at all and throws instead of
        // finding nothing. Both make the receipt field lie about what is in the audit trail.
        jdbc.update(
            """
            INSERT INTO gc_audit_event(event_id, subject_hash, event_type, resource_type, outcome, occurred_at)
            VALUES (?, ?, ?, ?, 'SUCCESS', ?)
            """.trimIndent(),
            UUID.randomUUID(),
            "c".repeat(64),
            "PROBE_HbA1c (%)",
            "PROBE",
            java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC),
        )

        // Present in the row exactly as written, parentheses and percent sign included.
        assertThat(repository.countRawHealthValuesInAudit(listOf("PROBE_HbA1c (%)"))).isEqualTo(1)
        // What the old escape would have matched in its place is not in the row at all.
        assertThat(repository.countRawHealthValuesInAudit(listOf("PROBE_HbA1c %"))).isZero()
        // An unbalanced metacharacter is a needle, not a syntax error.
        assertThat(repository.countRawHealthValuesInAudit(listOf("PROBE_HbA1c ("))).isEqualTo(1)
        // ...and a needle that contains `|` is one literal, not two alternatives.
        assertThat(repository.countRawHealthValuesInAudit(listOf("PROBE|NOT_A_REAL_EVENT"))).isZero()
    }

    private fun count(table: String): Long =
        jdbc.queryForObject("SELECT COUNT(*) FROM $table", Long::class.java) ?: 0L

    /**
     * Every audit row whose content contains one of the synthetic lifecycle's own health values,
     * labels, unit, reference range or filename extensions, plus any [extraNeedles] (the exam dates
     * the calling test actually used). The haystack is the whole row as JSON text rather than the
     * three columns this check used to name, minus the opaque identifier and bookkeeping columns —
     * see [FoundationRepository.AUDIT_CONTENT_TEXT] for which six and why. The rows themselves are
     * returned, not a count, so a failure names the leak instead of just asserting a number.
     */
    private fun auditRowsContaining(vararg extraNeedles: String): List<String> {
        fun matching(needles: List<String>): List<String> = jdbc.queryForList(
            "SELECT ${FoundationRepository.AUDIT_CONTENT_TEXT} FROM gc_audit_event a " +
                "WHERE ${FoundationRepository.AUDIT_CONTENT_TEXT} ~ ?",
            String::class.java,
            needles.joinToString("|") { FoundationRepository.escapePosixRegexLiteral(it) },
        )
        // Positive control: an all-zero result only means something if the haystack can match at
        // all. `outcome` is one of the searched columns and 'SUCCESS' is in it on every lifecycle,
        // so this proves the query reaches the content columns rather than passing vacuously.
        assertThat(matching(listOf("SUCCESS"))).describedAs("audit-leak query positive control").isNotEmpty()
        return matching(
            listOf("188", "5.2", "42", "190", "Cholesterol", "HbA1c", "Vitamin D", "120-199", ".pdf", ".png") +
                extraNeedles,
        )
    }

    private fun countForSubject(table: String, subjectId: String): Long =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM $table WHERE subject_id = ?",
            Long::class.java,
            subjectId,
        ) ?: 0L

    companion object {
        // Every value below lives in FoundationTestProperties so this test and
        // FoundationOpenApiContractTest cannot drift into describing two different applications.
        private const val allowedOrigin = FoundationTestProperties.ALLOWED_ORIGIN
        private const val aliceCredential = FoundationTestProperties.ALICE_CREDENTIAL
        private const val bobCredential = FoundationTestProperties.BOB_CREDENTIAL
        private const val workerCredential = FoundationTestProperties.WORKER_CREDENTIAL
        private val fixturePdf = FoundationTestProperties.fixturePdf
        private val fixtureDigest = FoundationTestProperties.fixtureDigest
        private val januaryFixturePdf = FoundationTestProperties.januaryFixturePdf
        private val januaryFixtureDigest = FoundationTestProperties.januaryFixtureDigest
        private fun demoCandidates(observedOn: String, values: List<String>) = listOf(
            ExtractedCandidate(1, "Cholesterol", values[0], "mg/dL", observedOn, 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64)),
            ExtractedCandidate(2, "HbA1c", values[1], "%", observedOn, 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64)),
            ExtractedCandidate(3, "Vitamin D", values[2], "ng/mL", observedOn, 1, EvidenceBox(0.08, 0.18, 0.25, 0.02), "3".repeat(64)),
        )
        private val julyCandidates = demoCandidates("2026-07-28", listOf("188", "5.2", "42"))
        private val januaryCandidates = demoCandidates("2026-01-15", listOf("194", "5.4", "45"))
        private const val onePixelPngBase64 = FoundationTestProperties.ONE_PIXEL_PNG_BASE64
        private val quarantineRoot: Path =
            FoundationTestProperties.quarantineRoot("gc-foundation-postgres-integration")

        @JvmStatic
        @DynamicPropertySource
        fun foundationProperties(registry: DynamicPropertyRegistry) {
            FoundationTestProperties.register(registry, quarantineRoot)
        }
    }
}
