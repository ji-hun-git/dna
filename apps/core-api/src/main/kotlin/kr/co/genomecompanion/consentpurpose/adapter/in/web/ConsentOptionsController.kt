package kr.co.genomecompanion.consentpurpose.adapter.`in`.web

import kr.co.genomecompanion.consentpurpose.api.ConsentOptionsService
import kr.co.genomecompanion.consentpurpose.api.ConsentOptionsView
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@ConditionalOnProperty(prefix = "gc.consent", name = ["enabled"], havingValue = "true")
class ConsentOptionsController(
    private val options: ConsentOptionsService,
) {
    @GetMapping("/v1/consent-options")
    @PreAuthorize("hasAuthority('SCOPE_consent:read')")
    fun current(): ConsentOptionsView = options.current()
}
