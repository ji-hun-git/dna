package kr.co.genomecompanion.architecture

import com.tngtech.archunit.junit.AnalyzeClasses
import com.tngtech.archunit.junit.ArchTest
import com.tngtech.archunit.lang.ArchRule
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses


@AnalyzeClasses(packages = ["kr.co.genomecompanion"])
class ModuleBoundaryTest {
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
