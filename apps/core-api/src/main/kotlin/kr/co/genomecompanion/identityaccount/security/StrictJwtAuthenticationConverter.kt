package kr.co.genomecompanion.identityaccount.security

import org.springframework.core.convert.converter.Converter
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.core.OAuth2AuthenticationException
import org.springframework.security.oauth2.server.resource.BearerTokenErrors
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.stereotype.Component

@Component
class StrictJwtAuthenticationConverter : Converter<Jwt, AbstractAuthenticationToken> {
    private val scopeMap = mapOf(
        "https://api.genome-companion.kr/consent.read" to "SCOPE_consent:read",
        "https://api.genome-companion.kr/consent.write" to "SCOPE_consent:write",
        "https://api.genome-companion.kr/records.export" to "SCOPE_records:export",
        "https://api.genome-companion.kr/profile.reset" to "SCOPE_profile:reset",
    )
    private val nonAuthorityScopes = setOf("openid")

    override fun convert(jwt: Jwt): AbstractAuthenticationToken {
        val subject = jwt.claims["sub"] as? String ?: invalidToken()
        val rawScope = jwt.claims["scope"] as? String ?: invalidToken()
        val presented = rawScope.split(' ').filter(String::isNotBlank)
        if (
            subject.isBlank() || presented.size != presented.toSet().size ||
            presented.any { it !in scopeMap && it !in nonAuthorityScopes }
        ) {
            invalidToken()
        }
        return JwtAuthenticationToken(
            jwt,
            presented.mapNotNull(scopeMap::get).map(::SimpleGrantedAuthority),
            subject,
        )
    }

    private fun invalidToken(): Nothing = throw OAuth2AuthenticationException(
        BearerTokenErrors.invalidToken("invalid claim shape"),
    )
}
