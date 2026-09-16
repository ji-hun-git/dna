plugins {
    alias(libs.plugins.kotlin.jvm)
    application
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
        vendor = JvmVendorSpec.ADOPTIUM
    }
}

kotlin {
    compilerOptions {
        allWarningsAsErrors.set(true)
    }
}

dependencies {
    implementation(project(":apps:document-worker"))
    implementation(project(":packages:document-boundary"))
    implementation(libs.pdfbox)
    implementation(libs.jackson.kotlin)
    testImplementation(libs.junit.jupiter)
    testImplementation(libs.assertj)
    testRuntimeOnly(libs.junit.platform.launcher)
}

application {
    mainClass.set("kr.co.genomecompanion.benchmark.BenchmarkMainKt")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    systemProperty("user.timezone", "UTC")
}

dependencyLocking { lockAllConfigurations() }
