package kr.co.genomecompanion.identityaccount.security

import jakarta.validation.constraints.NotBlank
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.validation.annotation.Validated

@ConfigurationProperties("security.oidc")
@Validated
data class OidcProperties(
    @field:NotBlank val issuer: String,
    @field:NotBlank val jwkSetUri: String,
    @field:NotBlank val audience: String,
    @field:NotBlank val clientId: String,
)
