package kr.co.genomecompanion.consentpurpose

import kr.co.genomecompanion.consentpurpose.adapter.`in`.web.ConsentController
import kr.co.genomecompanion.consentpurpose.api.GrantConsentCommand
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.security.access.prepost.PreAuthorize

class ConsentControllerTest {
    @Test
    fun `public grant request has no caller-controlled subject field`() {
        assertThat(GrantConsentCommand::class.java.declaredFields.map { it.name })
            .doesNotContain("subjectId", "caller", "region")
    }

    @Test
    fun `controller methods bind exact normalized scopes`() {
        val methods = ConsentController::class.java.declaredMethods.associateBy { it.name }
        assertThat(methods.getValue("grant").getAnnotation(PreAuthorize::class.java).value)
            .isEqualTo("hasAuthority('SCOPE_consent:write')")
        assertThat(methods.getValue("list").getAnnotation(PreAuthorize::class.java).value)
            .isEqualTo("hasAuthority('SCOPE_consent:read')")
        assertThat(methods.getValue("revoke").getAnnotation(PreAuthorize::class.java).value)
            .isEqualTo("hasAuthority('SCOPE_consent:write')")
    }
}
