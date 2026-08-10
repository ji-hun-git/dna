package kr.co.genomecompanion.architecture

import com.tngtech.archunit.junit.AnalyzeClasses
import com.tngtech.archunit.junit.ArchTest
import com.tngtech.archunit.core.importer.ImportOption
import com.tngtech.archunit.lang.ArchRule
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses


@AnalyzeClasses(packages = ["kr.co.genomecompanion"], importOptions = [ImportOption.DoNotIncludeTests::class])
class ModuleBoundaryTest {
    @ArchTest
    val sensitiveActionAuthorizationCannotLogTokens: ArchRule = noClasses()
        .that().haveSimpleName("JwtSensitiveActionAuthorizer")
        .should().dependOnClassesThat().resideInAnyPackage(
            "org.slf4j..",
            "org.apache.logging..",
            "java.util.logging..",
        )
        .allowEmptyShould(true)

    @ArchTest
    val publicDataCannotReadPersonalModules: ArchRule = noClasses()
        .that().resideInAPackage("..publicdata..")
        .should().dependOnClassesThat().resideInAnyPackage(
            "..identityaccount..",
            "..healthrecord..",
            "..documentintake..",
            "..consentpurpose..",
            "..exportdeletion..",
        )
        .allowEmptyShould(true)

    @ArchTest
    val moduleInternalsAreNotImportedAcrossModules: ArchRule = noClasses()
        .that().resideInAPackage("kr.co.genomecompanion.(*)..")
        .should().dependOnClassesThat().resideInAPackage("kr.co.genomecompanion.(*)..adapter..")
}
