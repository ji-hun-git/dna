package kr.co.genomecompanion.foundation

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.core.annotation.Order
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Clock
import java.time.Instant
import java.util.Base64
import java.util.UUID


const val FOUNDATION_PRINCIPAL_ATTRIBUTE = "gc.foundation.principal"
const val FOUNDATION_SESSION_COOKIE = "GC_SESSION"
const val FOUNDATION_CSRF_COOKIE = "GC_CSRF"
const val FOUNDATION_CSRF_HEADER = "X-GC-CSRF"


data class FoundationPrincipal(
    val subjectId: String,
    val sessionId: UUID,
    val sessionTokenHash: String,
    val expiresAt: Instant = Instant.EPOCH,
)


object FoundationHashing {
    private val secureRandom = SecureRandom()

    fun randomToken(): String {
        val bytes = ByteArray(32)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun sha256(value: String): String = sha256(value.toByteArray(StandardCharsets.UTF_8))

    fun sha256(value: ByteArray): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value)
            .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }

    fun constantTimeHexEquals(first: String, second: String): Boolean =
        MessageDigest.isEqual(
            first.toByteArray(StandardCharsets.US_ASCII),
            second.toByteArray(StandardCharsets.US_ASCII),
        )
}


@Configuration
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationSecurityConfiguration(
    private val properties: FoundationProperties,
) {
    init {
        properties.validateEnabledConfiguration()
    }

    @Bean
    @Order(1)
    fun foundationSecurityFilterChain(
        http: HttpSecurity,
        foundationSessionFilter: FoundationSessionFilter,
    ): SecurityFilterChain =
        http
            .securityMatcher("/api/foundation/**", "/actuator/health/**")
            .csrf { csrf -> csrf.disable() }
            .cors { cors -> cors.disable() }
            .httpBasic { basic -> basic.disable() }
            .formLogin { form -> form.disable() }
            .logout { logout -> logout.disable() }
            .requestCache { cache -> cache.disable() }
            .sessionManagement { sessions -> sessions.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { requests ->
                requests
                    .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**").permitAll()
                    .requestMatchers("/api/foundation/**").permitAll()
                    .anyRequest().denyAll()
            }
            .addFilterBefore(foundationSessionFilter, AnonymousAuthenticationFilter::class.java)
            .build()
}


@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationSessionFilter(
    private val repository: FoundationRepository,
    private val properties: FoundationProperties,
    private val clock: Clock,
) : OncePerRequestFilter() {
    private val stateChangingMethods = setOf("POST", "PUT", "PATCH", "DELETE")

    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        !request.requestURI.startsWith("/api/foundation")

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (request.requestURI == "/api/foundation/session" && request.method == "POST") {
            if (!originAllowed(request)) {
                reject(response, HttpServletResponse.SC_FORBIDDEN, "origin_denied")
                return
            }
            filterChain.doFilter(request, response)
            return
        }

        val rawToken = request.cookies
            ?.firstOrNull { cookie -> cookie.name == FOUNDATION_SESSION_COOKIE }
            ?.value
        if (rawToken.isNullOrBlank()) {
            reject(response, HttpServletResponse.SC_UNAUTHORIZED, "session_required")
            return
        }

        val tokenHash = FoundationHashing.sha256(rawToken)
        val session = repository.findActiveSession(tokenHash, Instant.now(clock))
        if (session == null) {
            reject(response, HttpServletResponse.SC_UNAUTHORIZED, "session_invalid")
            return
        }

        if (request.method in stateChangingMethods) {
            if (!originAllowed(request)) {
                repository.insertDeniedAudit(
                    subjectHash = subjectHash(session.subjectId),
                    actorSessionHash = session.tokenHash,
                    eventType = "REQUEST_ORIGIN_DENIED",
                    resourceType = "REQUEST",
                    resourceId = null,
                    now = Instant.now(clock),
                )
                reject(response, HttpServletResponse.SC_FORBIDDEN, "origin_denied")
                return
            }
            val presentedCsrfHash = FoundationHashing.sha256(request.getHeader(FOUNDATION_CSRF_HEADER).orEmpty())
            if (!FoundationHashing.constantTimeHexEquals(presentedCsrfHash, session.csrfHash)) {
                repository.insertDeniedAudit(
                    subjectHash = subjectHash(session.subjectId),
                    actorSessionHash = session.tokenHash,
                    eventType = "REQUEST_CSRF_DENIED",
                    resourceType = "REQUEST",
                    resourceId = null,
                    now = Instant.now(clock),
                )
                reject(response, HttpServletResponse.SC_FORBIDDEN, "csrf_denied")
                return
            }
        }

        request.setAttribute(
            FOUNDATION_PRINCIPAL_ATTRIBUTE,
            FoundationPrincipal(
                subjectId = session.subjectId,
                sessionId = session.sessionId,
                sessionTokenHash = session.tokenHash,
                expiresAt = session.expiresAt,
            ),
        )
        filterChain.doFilter(request, response)
    }

    private fun originAllowed(request: HttpServletRequest): Boolean =
        request.getHeader("Origin") == properties.allowedOrigin

    private fun subjectHash(subjectId: String): String =
        FoundationHashing.sha256("${properties.auditPepper}:$subjectId")

    private fun reject(response: HttpServletResponse, status: Int, code: String) {
        response.status = status
        response.contentType = "application/problem+json"
        response.characterEncoding = StandardCharsets.UTF_8.name()
        response.setHeader("Cache-Control", "no-store")
        response.writer.write("""{"code":"$code"}""")
    }
}
