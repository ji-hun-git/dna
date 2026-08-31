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

    afterEvaluate {
        configurations.configureEach {
            resolutionStrategy.force(
                "org.bouncycastle:bcpg-jdk18on:${libs.versions.bouncycastle.get()}",
                "org.bouncycastle:bcpkix-jdk18on:${libs.versions.bouncycastle.get()}",
                "org.bouncycastle:bcprov-jdk18on:${libs.versions.bouncycastle.get()}",
                "org.bouncycastle:bcutil-jdk18on:${libs.versions.bouncycastle.get()}",
            )
        }
    }
}
