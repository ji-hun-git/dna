package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.test.context.ActiveProfiles


/**
 * The hosted profile is the only place Secure cookies and proxy-aware client IPs are turned on;
 * the default profile a developer or the synthetic e2e runs must never trust a forwarded header.
 */
@SpringBootTest(
    properties = [
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
        "GC_TRUSTED_PROXIES=10.0.0.0/8",
    ],
)
@ActiveProfiles("test", "hosted")
class HostedProfileConfigurationTest(@param:Autowired private val environment: Environment) {
    @Test
    fun `hosted profile turns on secure cookies and trusted-proxy forwarding`() {
        assertThat(environment.getProperty("gc.foundation.secure-cookies")).isEqualTo("true")
        assertThat(environment.getProperty("server.forward-headers-strategy")).isEqualTo("framework")
        assertThat(environment.getProperty("server.tomcat.remoteip.trusted-proxies")).isEqualTo("10.0.0.0/8")
        assertThat(environment.getProperty("management.endpoints.web.exposure.include")).isEqualTo("health")
    }
}
