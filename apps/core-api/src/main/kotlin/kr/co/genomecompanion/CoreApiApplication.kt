package kr.co.genomecompanion

import ca.uhn.fhir.context.FhirContext
import org.springframework.boot.autoconfigure.AutoConfigurationExcludeFilter
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.context.TypeExcludeFilter
import org.springframework.boot.runApplication
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.ComponentScan
import org.springframework.context.annotation.FilterType


@SpringBootApplication
@ConfigurationPropertiesScan
@ComponentScan(
    basePackages = ["kr.co.genomecompanion"],
    excludeFilters = [
        ComponentScan.Filter(type = FilterType.CUSTOM, classes = [TypeExcludeFilter::class]),
        ComponentScan.Filter(type = FilterType.CUSTOM, classes = [AutoConfigurationExcludeFilter::class]),
        ComponentScan.Filter(
            type = FilterType.REGEX,
            pattern = ["kr\\.co\\.genomecompanion\\.publicdata(?:\\..*)?"],
        ),
    ],
)
class CoreApiApplication {
    @Bean
    fun fhirContext(): FhirContext = FhirContext.forR4Cached()
}


fun main(args: Array<String>) {
    runApplication<CoreApiApplication>(*args)
}
