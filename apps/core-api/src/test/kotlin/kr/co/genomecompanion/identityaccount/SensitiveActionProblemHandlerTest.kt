package kr.co.genomecompanion.identityaccount

import kr.co.genomecompanion.identityaccount.api.SensitiveAction
import kr.co.genomecompanion.identityaccount.api.SensitiveActionAssuranceRequirement
import kr.co.genomecompanion.identityaccount.api.SensitiveActionDenial
import kr.co.genomecompanion.identityaccount.api.SensitiveActionDeniedException
import kr.co.genomecompanion.identityaccount.security.SensitiveActionProblemHandler
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SensitiveActionProblemHandlerTest {
    @Test
    fun `recent authentication denial returns stable assurance without token material`() {
        val response = SensitiveActionProblemHandler().handle(
            SensitiveActionDeniedException(
                SensitiveAction.RESET_PROFILE,
                SensitiveActionDenial.RECENT_AUTHENTICATION_REQUIRED,
            ),
        )
        val problem = requireNotNull(response.body)
        val assurance = problem.properties?.get("assurance") as SensitiveActionAssuranceRequirement

        assertThat(response.statusCode.value()).isEqualTo(403)
        assertThat(response.headers.cacheControl).isEqualTo("no-store")
        assertThat(problem.type.toString()).isEqualTo("https://api.genome-companion.kr/problems/sensitive-action")
        assertThat(problem.properties).containsEntry("code", "recent_authentication_required")
        assertThat(assurance.action).isEqualTo(SensitiveAction.RESET_PROFILE)
        assertThat(assurance.requiredScope).isEqualTo("profile:reset")
        assertThat(assurance.maxAuthAgeSeconds).isEqualTo(300)
        assertThat(assurance.assurancePolicy).isEqualTo("cognito_mfa_required_pool")
        assertThat(problem.toString()).doesNotContain("synthetic-token", "cognito-subject")
    }
}
