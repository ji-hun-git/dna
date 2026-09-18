package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.test.context.ActiveProfiles


@SpringBootTest(
    properties = [
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
    ],
)
@ActiveProfiles("test")
class DefaultProfileConfigurationTest(@param:Autowired private val environment: Environment) {
    @Test
    fun `default profile ignores forwarded headers and exposes only health`() {
        assertThat(environment.getProperty("server.forward-headers-strategy")).isEqualTo("none")
        assertThat(environment.getProperty("server.tomcat.remoteip.trusted-proxies")).isNull()
        assertThat(environment.getProperty("management.endpoints.web.exposure.include")).isEqualTo("health")
    }
}
