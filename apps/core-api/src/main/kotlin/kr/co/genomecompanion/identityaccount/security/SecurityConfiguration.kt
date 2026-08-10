package kr.co.genomecompanion.identityaccount.security

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatusCode
import org.springframework.http.MediaType
import org.springframework.http.ProblemDetail
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.SecurityFilterChain

@Configuration
@EnableMethodSecurity
@ConditionalOnProperty(prefix = "security.oidc", name = ["enabled"], havingValue = "true")
class SecurityConfiguration(
    private val objectMapper: ObjectMapper,
    private val strictJwtAuthenticationConverter: StrictJwtAuthenticationConverter,
) {
    @Bean
    @Order(2)
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain = http
        .securityMatcher("/v1/**", "/actuator/health/**")
        .csrf { it.disable() }
        .httpBasic { it.disable() }
        .formLogin { it.disable() }
        .requestCache { it.disable() }
        .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
        .authorizeHttpRequests {
            it.requestMatchers("/actuator/health/liveness", "/actuator/health/readiness").permitAll()
                .requestMatchers("/v1/**").authenticated()
                .anyRequest().denyAll()
        }
        .oauth2ResourceServer { resource ->
            resource.jwt { it.jwtAuthenticationConverter(strictJwtAuthenticationConverter) }
            resource.authenticationEntryPoint { _, response, _ -> writeProblem(response, 401, "Unauthorized") }
        }
        .exceptionHandling {
            it.accessDeniedHandler { _, response, _ -> writeProblem(response, 403, "Forbidden") }
        }
        .build()

    private fun writeProblem(response: HttpServletResponse, status: Int, title: String) {
        response.status = status
        response.contentType = MediaType.APPLICATION_PROBLEM_JSON_VALUE
        objectMapper.writeValue(
            response.outputStream,
            ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(status), title),
        )
    }
}
