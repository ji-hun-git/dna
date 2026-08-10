plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.spring) apply false
    alias(libs.plugins.spring.boot) apply false
    alias(libs.plugins.spring.dependency.management) apply false
    alias(libs.plugins.cyclonedx) apply false
}

allprojects {
    group = "kr.co.genomecompanion"
    version = "0.1.0-SNAPSHOT"
}
