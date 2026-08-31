package kr.co.genomecompanion.identityaccount.security

import java.net.URI
import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties("security.oidc")
data class OidcProperties(
    val issuer: String,
    val jwkSetUri: String,
    val audience: String,
    val clientId: String,
) {
    fun validateEnabledConfiguration() {
        val issuerUri = URI.create(issuer)
        val jwkUri = URI.create(jwkSetUri)
        require(issuerUri.scheme == "https" && issuerUri.host != null && issuerUri.userInfo == null)
        require(issuerUri.query == null && issuerUri.fragment == null)
        require(jwkUri.scheme == "https" && jwkUri.host != null && jwkUri.userInfo == null)
        require(jwkUri.fragment == null)
        require(audience.isNotBlank() && audience.none(Char::isWhitespace))
        require(clientId.isNotBlank() && clientId.none(Char::isWhitespace))
    }
}
