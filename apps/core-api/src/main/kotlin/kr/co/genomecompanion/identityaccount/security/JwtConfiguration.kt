package kr.co.genomecompanion.identityaccount.security

import java.time.Clock
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder

@Configuration
@EnableConfigurationProperties(OidcProperties::class)
@ConditionalOnProperty(prefix = "security.oidc", name = ["enabled"], havingValue = "true")
class JwtConfiguration {
    @Bean
    fun utcClock(): Clock = Clock.systemUTC()

    @Bean
    fun jwtDecoder(properties: OidcProperties): JwtDecoder {
        val decoder = NimbusJwtDecoder.withJwkSetUri(properties.jwkSetUri).build()
        decoder.setJwtValidator(
            DelegatingOAuth2TokenValidator(
                JwtValidators.createDefaultWithIssuer(properties.issuer),
                AudienceValidator(properties.audience),
                ClientIdValidator(properties.clientId),
                CognitoClaimShapeValidator(),
            ),
        )
        return decoder
    }
}
