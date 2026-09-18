package kr.co.genomecompanion.foundation

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import jakarta.validation.ConstraintViolationException
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory
import org.springframework.dao.DataRetrievalFailureException
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MaxUploadSizeExceededException

/**
 * Exercises [FoundationProblemAdvice]'s framework-level mappings through a real MockMvc-dispatched HTTP
 * request to a test-only controller (`MockMvcBuilders.standaloneSetup` — no Spring context, no database,
 * none of the app's real security wiring; the advice's own `@ConditionalOnProperty` gate and the app's
 * real request pipeline are irrelevant to what these tests verify). [FoundationProblemAdvice] is
 * constructed directly, exactly as Spring would, so its `PhiSafeLogger.forClass(...)` call resolves to
 * the real `kr.co.genomecompanion.foundation.FoundationProblemAdvice` logger category, which is what
 * these tests attach a Logback `ListAppender` to.
 *
 * Covers the two cases the framework never surfaces as one of `FoundationLifecycleController`'s own
 * `@ExceptionHandler`-owned exceptions: a genuinely uncaught `Exception` (500 `internal_error`) and a
 * `DataAccessException` (503 `storage_unavailable`) — both must log the failing exception's *class name*
 * only, never its `message`, even though (as in a real Jackson/JDBC failure) that message may quote
 * request text. Also covers the two mappings added for this task's second round:
 * `ConstraintViolationException` (400 `request_invalid`) and `MaxUploadSizeExceededException` (413
 * `payload_too_large`) — neither is reachable through any current foundation endpoint (no `@Validated`
 * method-parameter validation and no multipart upload exist in this app today), so they are proven here
 * at the same MockMvc level rather than through the full lifecycle integration suite.
 *
 * 404 is intentionally out of scope: `FoundationNotFoundException`'s existing controller-local handler
 * already covers this app's only "not found" case, and a framework-level `NoResourceFoundException`
 * mapping for an unmapped foundation path is left to Task 14/7b's routing work.
 */
class FoundationProblemAdviceFailureTest {
    private val logger = LoggerFactory.getLogger(FoundationProblemAdvice::class.java) as Logger
    private val appender = ListAppender<ILoggingEvent>()
    private var previousLevel: Level? = null
    private lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        appender.start()
        previousLevel = logger.level
        logger.level = Level.TRACE
        logger.addAppender(appender)
        mockMvc = MockMvcBuilders.standaloneSetup(FailureTestSupportController())
            .setControllerAdvice(FoundationProblemAdvice())
            .build()
    }

    @AfterEach
    fun tearDown() {
        logger.detachAppender(appender)
        logger.level = previousLevel
        appender.stop()
    }

    @Test
    fun `an uncaught exception answers 500 internal_error and logs only the class name`() {
        val sentinel = "188 mg/dL SENTINEL"
        val response = mockMvc.perform(
            post("/test-support/internal-error")
                .contentType(MediaType.TEXT_PLAIN)
                .content(sentinel),
        ).andExpect(status().isInternalServerError)
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.code").value("internal_error"))
            .andReturn().response

        assertThat(response.contentAsString).isEqualTo("""{"code":"internal_error"}""")
        assertThat(response.contentAsString).doesNotContain(sentinel)

        val logged = appender.list.map { it.formattedMessage }
        assertThat(logged).anyMatch { it.contains("internal_error") && it.contains("IllegalStateException") }
        assertThat(logged.joinToString("\n")).doesNotContain(sentinel)
    }

    @Test
    fun `a storage failure answers 503 storage_unavailable and logs only the class name`() {
        val sentinel = "SECRET-BODY-VALUE-7731"
        val response = mockMvc.perform(
            post("/test-support/storage-unavailable")
                .contentType(MediaType.TEXT_PLAIN)
                .content(sentinel),
        ).andExpect(status().isServiceUnavailable)
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.code").value("storage_unavailable"))
            .andReturn().response

        assertThat(response.contentAsString).isEqualTo("""{"code":"storage_unavailable"}""")
        assertThat(response.contentAsString).doesNotContain(sentinel)

        val logged = appender.list.map { it.formattedMessage }
        assertThat(logged).anyMatch {
            it.contains("storage_unavailable") && it.contains("DataRetrievalFailureException")
        }
        assertThat(logged.joinToString("\n")).doesNotContain(sentinel)
    }

    @Test
    fun `a constraint violation answers 400 request_invalid and never echoes the value`() {
        val sentinel = "not-a-valid-value-SENTINEL"
        val response = mockMvc.perform(
            post("/test-support/constraint-violation")
                .contentType(MediaType.TEXT_PLAIN)
                .content(sentinel),
        ).andExpect(status().isBadRequest)
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.code").value("request_invalid"))
            .andReturn().response

        assertThat(response.contentAsString).isEqualTo("""{"code":"request_invalid"}""")
        assertThat(response.contentAsString).doesNotContain(sentinel)
    }

    @Test
    fun `an oversized upload answers 413 payload_too_large`() {
        val response = mockMvc.perform(post("/test-support/payload-too-large"))
            .andExpect(status().isPayloadTooLarge)
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.code").value("payload_too_large"))
            .andReturn().response

        assertThat(response.contentAsString).isEqualTo("""{"code":"payload_too_large"}""")
    }

    @RestController
    @RequestMapping("/test-support")
    private class FailureTestSupportController {
        @PostMapping("/internal-error")
        fun internalError(@RequestBody body: String): Nothing =
            throw IllegalStateException("synthetic internal failure carrying $body")

        @PostMapping("/storage-unavailable")
        fun storageUnavailable(@RequestBody body: String): Nothing =
            throw DataRetrievalFailureException("synthetic storage failure carrying $body")

        @PostMapping("/constraint-violation")
        fun constraintViolation(@RequestBody body: String): Nothing =
            throw ConstraintViolationException("synthetic constraint violation carrying $body", emptySet())

        @PostMapping("/payload-too-large")
        fun payloadTooLarge(): Nothing = throw MaxUploadSizeExceededException(1_048_576)
    }
}
