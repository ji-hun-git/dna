package kr.co.genomecompanion

import ca.uhn.fhir.context.FhirContext
import ca.uhn.fhir.context.FhirVersionEnum
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.ComponentScan
import org.springframework.test.context.ActiveProfiles


@SpringBootTest(
    properties = [
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
    ],
)
@ActiveProfiles("test")
class ApplicationSmokeTest(
    @param:Autowired private val fhirContext: FhirContext,
) {
    @Test
    fun `application exposes exactly an R4 FHIR context`() {
        assertThat(fhirContext.version.version).isEqualTo(FhirVersionEnum.R4)
    }

    @Test
    fun `personal bootstrap permanently excludes the PUB package`() {
        val scan = CoreApiApplication::class.java.getAnnotation(ComponentScan::class.java)
        val excludedPatterns = scan.excludeFilters.flatMap { it.pattern.asList() }
        assertThat(excludedPatterns)
            .containsExactly("kr\\.co\\.genomecompanion\\.publicdata(?:\\..*)?")
    }
}
