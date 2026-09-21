package kr.co.genomecompanion.foundation

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.ResultActions
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.web.servlet.HandlerMapping
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID

/**
 * `docs/api/foundation-openapi.yaml` is hand-written, and this test is the only reason it can be
 * trusted. It checks the document against the running application from both ends:
 *
 *  1. **Route parity, both directions.** Every foundation mapping the live
 *     `RequestMappingHandlerMapping` knows about must appear in `paths` under the same template and
 *     the same HTTP method, and every documented operation must have a live mapping. A route added
 *     to a controller without being documented fails here; so does documentation of a route that was
 *     renamed or deleted (no dead documentation).
 *
 *  2. **Response parity, against real bodies.** One full synthetic lifecycle — sign in, consent,
 *     upload, worker pipeline, review, confirm, correct, exclude, page, aggregate, export both ways,
 *     revoke, delete, demo session, sign out — is driven over MockMvc, and every response it
 *     produces is validated against the documented schema for its path, method and status:
 *     `required` ⊆ actual keys ⊆ `properties`, recursively through nested objects and arrays, and no
 *     member carries `null` unless its schema says `nullable: true`. Every problem `code` observed on
 *     a 4xx/5xx must be listed in `components.x-error-codes`, and its status in that operation's
 *     `x-error-statuses`. Finally every documented path must have been exercised at least once, so
 *     the document cannot describe a response nobody has ever seen.
 *
 * The schemas themselves are compared *structurally*, not for prose: the point is that the field
 * sets, the requiredness and the nullability in the document are the ones the application really
 * produces.
 */
@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "GC_TEST_POSTGRES_URL", matches = ".+")
class FoundationOpenApiContractTest @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper,
    private val jdbc: JdbcTemplate,
    private val workerService: DocumentWorkerBoundaryService,
    @param:Qualifier("requestMappingHandlerMapping")
    private val mappings: RequestMappingHandlerMapping,
) {
    private data class TestClient(val cookie: Cookie, val csrf: String)

    /** One real exchange: the route template it matched, the status it answered, and its body. */
    private data class Exchange(
        val method: String,
        val template: String,
        val status: Int,
        val contentType: String?,
        val body: ByteArray,
    )

    private val exchanges = mutableListOf<Exchange>()

    @BeforeEach
    fun resetSyntheticDatabase() {
        exchanges.clear()
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
    }

    // ---------------------------------------------------------------- 1. route parity

    @Test
    fun everyFoundationRouteIsDocumentedAndEveryDocumentedOperationExists() {
        val live = mappings.handlerMethods.keys
            .flatMap { info ->
                val patterns = info.pathPatternsCondition?.patternValues.orEmpty()
                    .filter { it.startsWith("/api/foundation") }
                val methods = info.methodsCondition.methods.map { it.name.lowercase() }
                patterns.flatMap { pattern -> methods.map { method -> "$method $pattern" } }
            }
            .toSet()
        val documented = documentedOperations()

        assertThat(live)
            .describedAs("routes the controller serves that docs/api/foundation-openapi.yaml does not document")
            .isSubsetOf(documented)
        assertThat(documented)
            .describedAs("operations documented in docs/api/foundation-openapi.yaml with no live mapping")
            .isSubsetOf(live)
    }

    // ---------------------------------------------------------------- 2. response parity

    @Test
    fun everyResponseOfAFullLifecycleMatchesItsDocumentedSchema() {
        driveTheWholeLifecycle()

        val observedCodes = mutableSetOf<String>()
        exchanges.forEach { exchange ->
            val operation = operationFor(exchange)
            val response = responseFor(operation, exchange)
            if (exchange.status >= 400) {
                val statuses = operation.path("x-error-statuses").map { it.asInt() }
                assertThat(statuses)
                    .describedAs("${exchange.method} ${exchange.template} answered ${exchange.status}, which x-error-statuses omits")
                    .contains(exchange.status)
                observedCodes += objectMapper.readTree(exchange.body).path("code").asText()
            }
            val schema = jsonSchemaOf(response) ?: return@forEach
            validate(schema, objectMapper.readTree(exchange.body), "${exchange.method} ${exchange.template} ${exchange.status}")
        }

        val vocabulary = document.path("components").path("x-error-codes").map { it.asText() }
        assertThat(observedCodes)
            .describedAs("problem codes the lifecycle produced that components.x-error-codes does not list")
            .isSubsetOf(vocabulary)
        assertThat(observedCodes).isNotEmpty()

        assertThat(exchanges.map { it.template }.toSet())
            .describedAs("documented paths this lifecycle never exercised (dead documentation)")
            .containsAll(document.path("paths").fieldNames().asSequence().toList())
    }

    // ---------------------------------------------------------------- the lifecycle

    @Suppress("LongMethod")
    private fun driveTheWholeLifecycle() {
        val alice = login()
        read(get("/api/foundation/session"), alice, "/api/foundation/session", 200)
        read(get("/api/foundation/consents"), alice, "/api/foundation/consents", 200)
        read(
            get("/api/foundation/consents/document-extraction"),
            alice,
            "/api/foundation/consents/document-extraction",
            200,
        )
        val consentId = UUID.fromString(
            bodyOf(
                mutate(
                    post("/api/foundation/consents/document-extraction"),
                    alice,
                    "/api/foundation/consents/document-extraction",
                    201,
                ),
            )["consentId"].asText(),
        )
        mutate(
            post("/api/foundation/consents/${ConsentPurpose.RESEARCH_USE}").header("Idempotency-Key", "contract-research-use"),
            alice,
            "/api/foundation/consents/{purposeCode}",
            201,
        )

        val ticket = bodyOf(
            mutate(
                post("/api/foundation/documents")
                    .header("Idempotency-Key", "contract-document")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            mapOf(
                                "consentId" to consentId,
                                "mediaType" to "application/pdf",
                                "contentLength" to fixturePdf.size,
                                "sha256" to fixtureDigest,
                            ),
                        ),
                    ),
                alice,
                "/api/foundation/documents",
                201,
            ),
        )
        val documentId = UUID.fromString(ticket["document"]["documentId"].asText())
        mutate(
            put("/api/foundation/documents/$documentId/content")
                .header("X-GC-Upload-Capability-Id", ticket["uploadCapability"]["capabilityId"].asText())
                .header("X-GC-Upload-Capability", ticket["uploadCapability"]["requiredHeaders"]["X-GC-Upload-Capability"].asText())
                .contentType(MediaType.APPLICATION_PDF)
                .content(fixturePdf),
            alice,
            "/api/foundation/documents/{documentId}/content",
            200,
        )
        read(get("/api/foundation/documents/active"), alice, "/api/foundation/documents/active", 200)
        mutate(
            post("/api/foundation/documents/$documentId/finalization"),
            alice,
            "/api/foundation/documents/{documentId}/finalization",
            202,
        )
        runWorkerPipeline(documentId)

        read(get("/api/foundation/documents/$documentId"), alice, "/api/foundation/documents/{documentId}", 200)
        read(
            get("/api/foundation/documents/$documentId/preview"),
            alice,
            "/api/foundation/documents/{documentId}/preview",
            200,
        )
        read(
            get("/api/foundation/documents/$documentId/candidate"),
            alice,
            "/api/foundation/documents/{documentId}/candidate",
            200,
        )
        val candidates = bodyOf(
            read(
                get("/api/foundation/documents/$documentId/candidates"),
                alice,
                "/api/foundation/documents/{documentId}/candidates",
                200,
            ),
        ).toList()
        read(
            get("/api/foundation/candidates/${candidates[0]["candidateId"].asText()}"),
            alice,
            "/api/foundation/candidates/{candidateId}",
            200,
        )
        val recordId = UUID.fromString(
            bodyOf(
                mutate(
                    post("/api/foundation/candidates/${candidates[0]["candidateId"].asText()}/confirmation")
                        .header("Idempotency-Key", "contract-confirm-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mapOf("value" to candidates[0]["value"].asText()))),
                    alice,
                    "/api/foundation/candidates/{candidateId}/confirmation",
                    201,
                ),
            )["recordId"].asText(),
        )
        mutate(
            post("/api/foundation/candidates/${candidates[1]["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", "contract-confirm-2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(mapOf("value" to candidates[1]["value"].asText()))),
            alice,
            "/api/foundation/candidates/{candidateId}/confirmation",
            201,
        )
        mutate(
            post("/api/foundation/candidates/${candidates[2]["candidateId"].asText()}/exclusion")
                .header("Idempotency-Key", "contract-exclude-3"),
            alice,
            "/api/foundation/candidates/{candidateId}/exclusion",
            200,
        )

        read(get("/api/foundation/records/$recordId"), alice, "/api/foundation/records/{recordId}", 200)
        mutate(
            post("/api/foundation/records/$recordId/corrections")
                .header("Idempotency-Key", "contract-correct-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(mapOf("value" to "191", "reason" to "본인이 확인한 값"))),
            alice,
            "/api/foundation/records/{recordId}/corrections",
            200,
        )

        read(get("/api/foundation/records"), alice, "/api/foundation/records", 200)
        read(get("/api/foundation/records").param("limit", "1"), alice, "/api/foundation/records", 200)
        read(get("/api/foundation/health-events"), alice, "/api/foundation/health-events", 200)
        read(get("/api/foundation/health-events").param("limit", "1"), alice, "/api/foundation/health-events", 200)
        read(get("/api/foundation/changes"), alice, "/api/foundation/changes", 200)
        read(get("/api/foundation/series"), alice, "/api/foundation/series", 200)
        read(get("/api/foundation/health-events/export"), alice, "/api/foundation/health-events/export", 200)
        read(
            get("/api/foundation/health-events/export/fhir"),
            alice,
            "/api/foundation/health-events/export/fhir",
            200,
        )

        // Refusals: every documented error shape, produced for real rather than asserted about.
        read(get("/api/foundation/records").param("limit", "201"), alice, "/api/foundation/records", 400)
        read(get("/api/foundation/records").param("after", "not-a-uuid"), alice, "/api/foundation/records", 400)
        capture(mockMvc.perform(get("/api/foundation/records")), "/api/foundation/records", 401)
        capture(
            mockMvc.perform(
                post("/api/foundation/consents/document-extraction")
                    .cookie(alice.cookie)
                    .header(HttpHeaders.ORIGIN, FoundationTestProperties.ALLOWED_ORIGIN)
                    .header(FOUNDATION_CSRF_HEADER, alice.csrf),
            ),
            "/api/foundation/consents/document-extraction",
            403,
        )
        capture(
            mockMvc.perform(get("/api/foundation/documents/${UUID.randomUUID()}").cookie(alice.cookie)),
            "/api/foundation/documents/{documentId}",
            404,
        )

        mutate(
            post("/api/foundation/consents/$consentId/revocation"),
            alice,
            "/api/foundation/consents/{consentId}/revocation",
            200,
        )
        mutate(delete("/api/foundation/profile"), alice, "/api/foundation/profile", 200)

        val demo = capture(
            mockMvc.perform(
                post("/api/foundation/demo-session")
                    .header(HttpHeaders.ORIGIN, FoundationTestProperties.ALLOWED_ORIGIN)
                    .header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE),
            ),
            "/api/foundation/demo-session",
            201,
        )
        val demoClient = clientOf(demo)
        mutate(post("/api/foundation/session/logout"), demoClient, "/api/foundation/session/logout", 204)
    }

    private fun runWorkerPipeline(documentId: UUID) {
        val inspection = checkNotNull(workerService.lease("a".repeat(64)))
        workerService.completeInspection(
            inspection.jobId,
            inspection.leaseToken,
            InspectionResultRequest(
                decision = kr.co.genomecompanion.documentboundary.InspectionDecision.APPROVED,
                reason = kr.co.genomecompanion.documentboundary.InspectionReason.CLEAN,
                sourceSha256 = fixtureDigest,
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
            ),
        )
        val extraction = checkNotNull(workerService.lease("a".repeat(64)))
        workerService.completeExtraction(
            extraction.jobId,
            extraction.leaseToken,
            ExtractionResultRequest(
                sourceSha256 = fixtureDigest,
                workerImageDigest = "b".repeat(64),
                generatorVersion = "test-worker-v1",
                previewPngBase64 = FoundationTestProperties.ONE_PIXEL_PNG_BASE64,
                candidates = listOf(
                    ExtractedCandidate(1, "Cholesterol", "188", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64), "120-199"),
                    ExtractedCandidate(2, "HbA1c", "5.2", "%", "2026-07-28", 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64)),
                    ExtractedCandidate(3, "Vitamin D", "42", "ng/mL", "2026-07-28", 1, EvidenceBox(0.08, 0.18, 0.25, 0.02), "3".repeat(64)),
                ),
                abstentions = listOf(ExtractionAbstention("RBC", "ambiguous_unit", 1)),
            ),
        )
        assertThat(
            jdbc.queryForObject("SELECT status FROM gc_document WHERE document_id = ?", String::class.java, documentId),
        ).isEqualTo("REVIEW_REQUIRED")
    }

    // ---------------------------------------------------------------- document lookups

    private fun documentedOperations(): Set<String> {
        val paths = document.path("paths")
        return paths.fieldNames().asSequence().flatMap { path ->
            paths.path(path).fieldNames().asSequence()
                .filter { it != "parameters" }
                .map { method -> "$method $path" }
        }.toSet()
    }

    private fun operationFor(exchange: Exchange): JsonNode {
        val path = document.path("paths").path(exchange.template)
        assertThat(path.isMissingNode || path.isNull)
            .describedAs("docs/api/foundation-openapi.yaml has no path ${exchange.template}")
            .isFalse()
        val operation = path.path(exchange.method)
        assertThat(operation.isMissingNode)
            .describedAs("docs/api/foundation-openapi.yaml has no ${exchange.method} for ${exchange.template}")
            .isFalse()
        return operation
    }

    /** The documented response for this status, falling back to `default` as OpenAPI prescribes. */
    private fun responseFor(operation: JsonNode, exchange: Exchange): JsonNode {
        val responses = operation.path("responses")
        val byStatus = responses.path(exchange.status.toString())
        val chosen = if (byStatus.isMissingNode) responses.path("default") else byStatus
        assertThat(chosen.isMissingNode)
            .describedAs("${exchange.method} ${exchange.template} answered ${exchange.status}, which is documented neither directly nor by `default`")
            .isFalse()
        return resolve(chosen)
    }

    /**
     * The JSON schema of a documented response, or null when this response carries no JSON body
     * (a 204, or the PNG preview) and there is therefore nothing to compare field by field.
     */
    private fun jsonSchemaOf(response: JsonNode): JsonNode? {
        val content = response.path("content")
        if (content.isMissingNode) return null
        val mediaType = content.fieldNames().asSequence().firstOrNull { it.contains("json") } ?: return null
        return content.path(mediaType).path("schema").takeUnless { it.isMissingNode }
    }

    private fun resolve(schema: JsonNode): JsonNode {
        val reference = schema.path("\$ref").asText("")
        if (reference.isEmpty()) return schema
        return resolve(document.at(reference.removePrefix("#")))
    }

    /**
     * Structural comparison of one real body against its documented schema: `required` ⊆ keys ⊆
     * `properties`, recursively, and `null` only where `nullable: true` says so. A schema with no
     * `properties` (an open map such as `requiredHeaders`) documents no members, so there is nothing
     * to compare and the subtree is left alone.
     */
    private fun validate(schema: JsonNode, value: JsonNode, where: String) {
        val resolved = resolve(schema)
        when {
            value.isArray -> {
                val items = resolved.path("items")
                if (!items.isMissingNode) {
                    value.forEachIndexed { index, element -> validate(items, element, "$where[$index]") }
                }
            }
            value.isObject -> {
                val properties = resolved.path("properties")
                if (properties.isMissingNode) return
                val documented = properties.fieldNames().asSequence().toSet()
                val actual = value.fieldNames().asSequence().toSet()
                assertThat(actual).describedAs("$where: members the document does not list").isSubsetOf(documented)
                assertThat(actual)
                    .describedAs("$where: members the document marks required")
                    .containsAll(resolved.path("required").map { it.asText() })
                actual.forEach { name ->
                    val member = value.path(name)
                    if (member.isNull) {
                        assertThat(resolve(properties.path(name)).path("nullable").asBoolean(false))
                            .describedAs("$where.$name is null, but the document does not mark it nullable")
                            .isTrue()
                    } else {
                        validate(properties.path(name), member, "$where.$name")
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------- HTTP helpers

    private fun login(): TestClient = clientOf(
        capture(
            mockMvc.perform(
                post("/api/foundation/session")
                    .header(HttpHeaders.ORIGIN, FoundationTestProperties.ALLOWED_ORIGIN)
                    .header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            mapOf(
                                "subjectId" to "synthetic-alice",
                                "credential" to FoundationTestProperties.ALICE_CREDENTIAL,
                            ),
                        ),
                    ),
            ),
            "/api/foundation/session",
            201,
        ),
    )

    private fun clientOf(exchange: Exchange): TestClient {
        // The cookie is not on the recorded Exchange (which is deliberately only what the contract
        // describes), so re-read it from the response the capture came from.
        val session = checkNotNull(lastCookies[FOUNDATION_SESSION_COOKIE]) { "no session cookie was set" }
        return TestClient(cookie = session, csrf = bodyOf(exchange)["csrfToken"].asText())
    }

    private fun read(
        builder: MockHttpServletRequestBuilder,
        client: TestClient,
        template: String,
        expectedStatus: Int,
    ): Exchange = capture(mockMvc.perform(builder.cookie(client.cookie)), template, expectedStatus)

    private fun mutate(
        builder: MockHttpServletRequestBuilder,
        client: TestClient,
        template: String,
        expectedStatus: Int,
    ): Exchange = capture(
        mockMvc.perform(
            builder
                .cookie(client.cookie)
                .header(HttpHeaders.ORIGIN, FoundationTestProperties.ALLOWED_ORIGIN)
                .header(FOUNDATION_CSRF_HEADER, client.csrf)
                .header(FOUNDATION_REQUESTED_WITH_HEADER, FOUNDATION_REQUESTED_WITH_VALUE),
        ),
        template,
        expectedStatus,
    )

    private val lastCookies = mutableMapOf<String, Cookie>()

    private fun capture(
        actions: ResultActions,
        template: String,
        expectedStatus: Int,
    ): Exchange {
        val result = actions.andReturn()
        val response = result.response
        val method = checkNotNull(result.request.method).lowercase()
        assertThat(response.status)
            .describedAs("$method $template — unexpected status; body was ${response.contentAsString}")
            .isEqualTo(expectedStatus)
        // When a handler ran, Spring recorded the template it matched: the document and the test can
        // then never disagree about which route a call actually reached.
        (result.request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE) as? String)?.let { matched ->
            assertThat(matched).describedAs("route template for $method").isEqualTo(template)
        }
        response.cookies.forEach { cookie -> if (cookie.maxAge != 0) lastCookies[cookie.name] = cookie }
        val exchange = Exchange(method, template, response.status, response.contentType, response.contentAsByteArray)
        exchanges += exchange
        return exchange
    }

    private fun bodyOf(exchange: Exchange): JsonNode = objectMapper.readTree(exchange.body)

    companion object {
        private val fixturePdf = FoundationTestProperties.fixturePdf
        private val fixtureDigest = FoundationTestProperties.fixtureDigest
        private val quarantineRoot: Path = FoundationTestProperties.quarantineRoot("gc-foundation-openapi-contract")

        private val document: JsonNode = ObjectMapper(YAMLFactory()).readTree(
            Path.of("../..").toAbsolutePath().normalize().resolve("docs/api/foundation-openapi.yaml").toFile(),
        )

        @JvmStatic
        @DynamicPropertySource
        fun foundationProperties(registry: DynamicPropertyRegistry) {
            FoundationTestProperties.register(registry, quarantineRoot)
        }
    }
}
