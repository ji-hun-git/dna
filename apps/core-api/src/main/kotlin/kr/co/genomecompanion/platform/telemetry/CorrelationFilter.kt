package kr.co.genomecompanion.platform.telemetry

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import java.util.UUID
import org.slf4j.MDC
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class CorrelationFilter : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val correlationId = request.getHeader("X-Correlation-ID")
            ?.let { runCatching { UUID.fromString(it) }.getOrNull() }
            ?: UUID.randomUUID()
        MDC.put("correlation_id", correlationId.toString())
        response.setHeader("X-Correlation-ID", correlationId.toString())
        try {
            filterChain.doFilter(request, response)
        } finally {
            MDC.remove("correlation_id")
        }
    }
}
