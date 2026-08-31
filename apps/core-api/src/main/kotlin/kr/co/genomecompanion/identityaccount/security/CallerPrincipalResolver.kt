package kr.co.genomecompanion.identityaccount.security

import kr.co.genomecompanion.identityaccount.api.CallerPrincipal
import kr.co.genomecompanion.identityaccount.api.DataRegion
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component

@Component
class CallerPrincipalResolver {
    fun resolve(authentication: Authentication): CallerPrincipal {
        val token = (authentication as? JwtAuthenticationToken)?.token
            ?: throw AccessDeniedException("verified JWT required")
        val subject = token.claims["sub"] as? String ?: throw AccessDeniedException("invalid subject")
        val scopes = authentication.authorities.map { authority ->
            if (!authority.authority.startsWith("SCOPE_")) {
                throw AccessDeniedException("unsupported authority")
            }
            authority.authority.removePrefix("SCOPE_")
        }.toSet()
        return CallerPrincipal(subject, scopes, DataRegion.KR)
    }
}
