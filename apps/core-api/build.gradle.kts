plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
    alias(libs.plugins.spring.dependency.management)
    alias(libs.plugins.cyclonedx)
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
        vendor = JvmVendorSpec.ADOPTIUM
    }
}

kotlin {
    compilerOptions {
        freeCompilerArgs.add("-Xjsr305=strict")
        allWarningsAsErrors.set(true)
    }
}

dependencies {
    implementation(libs.spring.web)
    implementation(libs.spring.security)
    implementation(libs.spring.oauth2.resource.server)
    implementation(libs.spring.actuator)
    implementation(libs.spring.jdbc)
    implementation(libs.spring.validation)
    implementation(libs.jackson.kotlin)
    implementation(libs.flyway.core)
    implementation(libs.flyway.postgresql)
    implementation(libs.hapi.base)
    implementation(libs.hapi.r4)
    runtimeOnly(libs.postgresql)
    testImplementation(libs.spring.test)
    testImplementation(libs.spring.security.test)
    testImplementation(libs.jackson.yaml)
    testImplementation(libs.archunit)
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.postgresql)
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    systemProperty("user.timezone", "UTC")
}

dependencyLocking { lockAllConfigurations() }

tasks.bootJar { archiveFileName.set("core-api.jar") }
