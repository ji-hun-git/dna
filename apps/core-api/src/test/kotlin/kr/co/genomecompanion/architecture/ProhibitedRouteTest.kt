package kr.co.genomecompanion.architecture

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping


@SpringBootTest(
    properties = [
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
    ],
)
@ActiveProfiles("test")
class ProhibitedRouteTest(
    @param:Autowired
    @param:Qualifier("requestMappingHandlerMapping")
    private val mappings: RequestMappingHandlerMapping,
) {
    @Test
    fun `medical genomic referral and training routes are absent`() {
        val routes = mappings.handlerMethods.keys
            .flatMap { it.pathPatternsCondition?.patternValues.orEmpty() }
            .toSet()
        val prohibited = setOf(
            "/upload-genome",
            "/diagnose",
            "/prescribe",
            "/change-medication",
            "/refer-patient-for-commission",
            "/train-model-on-user-data",
        )
        assertThat(routes).noneMatch { route -> prohibited.any(route::contains) }
        assertThat(routes).noneMatch { it.startsWith("/v1/public/") }
    }
}
