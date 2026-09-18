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
    implementation(project(":packages:document-boundary"))
    implementation(libs.jackson.kotlin)
    implementation(libs.jackson.jsr310)
    implementation(libs.pdfbox)
    testImplementation(libs.junit.jupiter)
    testImplementation(libs.assertj)
    testRuntimeOnly(libs.junit.platform.launcher)
}

application {
    mainClass.set("kr.co.genomecompanion.documentworker.DocumentWorkerMainKt")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    // A synthetic stand-in for the worker credential, so PageRenderSubprocessTest can prove that the
    // render child does not inherit it. Not a secret and not used to authenticate anything.
    environment("GC_WORKER_CREDENTIAL", "synthetic-not-a-secret")
}

dependencyLocking { lockAllConfigurations() }
