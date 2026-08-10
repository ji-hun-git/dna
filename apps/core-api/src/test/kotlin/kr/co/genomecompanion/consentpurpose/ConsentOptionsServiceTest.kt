package kr.co.genomecompanion.consentpurpose

import kr.co.genomecompanion.consentpurpose.application.ReleasePinnedConsentOptionsService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ConsentOptionsServiceTest {
    @Test
    fun `release-pinned options are Korean subject-free and digest verified`() {
        val options = ReleasePinnedConsentOptionsService().current()
        assertThat(options.recipients).containsExactly("genome-companion-korea")
        assertThat(options.region.name).isEqualTo("KR")
        assertThat(options.cloudProcessingMaxHours).isEqualTo(24)
        assertThat(options.retentionMaxDays).isEqualTo(365)
        assertThat(options.noticeUrl.scheme).isEqualTo("https")
        assertThat(options.configurationDigest).matches("^sha256:[0-9a-f]{64}$")
    }
}
