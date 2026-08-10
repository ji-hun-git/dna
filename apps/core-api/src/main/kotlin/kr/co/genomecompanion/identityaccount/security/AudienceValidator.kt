package kr.co.genomecompanion.identityaccount.security

import java.time.Instant
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.Jwt

class AudienceValidator(private val audience: String) : OAuth2TokenValidator<Jwt> {
    override fun validate(token: Jwt): OAuth2TokenValidatorResult =
        if (token.audience == listOf(audience)) OAuth2TokenValidatorResult.success()
        else OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "invalid audience", null))
}

class ClientIdValidator(private val clientId: String) : OAuth2TokenValidator<Jwt> {
    override fun validate(token: Jwt): OAuth2TokenValidatorResult =
        if (token.claims["client_id"] is String && token.claims["client_id"] == clientId) {
            OAuth2TokenValidatorResult.success()
        } else {
            OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "invalid client", null))
        }
}

class CognitoClaimShapeValidator : OAuth2TokenValidator<Jwt> {
    private val allowedScopes = setOf(
        "openid",
        "https://api.genome-companion.kr/consent.read",
        "https://api.genome-companion.kr/consent.write",
        "https://api.genome-companion.kr/records.export",
        "https://api.genome-companion.kr/profile.reset",
    )

    override fun validate(token: Jwt): OAuth2TokenValidatorResult {
        val subject = token.claims["sub"] as? String
        val rawScope = token.claims["scope"] as? String
        val authTime = token.claims["auth_time"]
        val scopes = rawScope?.split(' ')?.filter(String::isNotBlank).orEmpty()
        val valid = !subject.isNullOrBlank() && !rawScope.isNullOrBlank() &&
            (authTime is Number || authTime is Instant) &&
            scopes.size == scopes.toSet().size && scopes.all(allowedScopes::contains)
        return if (valid) {
            OAuth2TokenValidatorResult.success()
        } else {
            OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "invalid claim shape", null))
        }
    }
}
