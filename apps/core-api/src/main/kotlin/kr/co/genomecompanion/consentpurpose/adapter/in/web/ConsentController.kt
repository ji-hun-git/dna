package kr.co.genomecompanion.consentpurpose.adapter.`in`.web

import jakarta.validation.Valid
import java.util.UUID
import kr.co.genomecompanion.consentpurpose.api.ConsentService
import kr.co.genomecompanion.consentpurpose.api.ConsentView
import kr.co.genomecompanion.consentpurpose.api.GrantConsentCommand
import kr.co.genomecompanion.identityaccount.security.CallerPrincipalResolver
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/v1/consents")
@ConditionalOnProperty(prefix = "gc.consent", name = ["enabled"], havingValue = "true")
@Profile("!test")
class ConsentController(
    private val service: ConsentService,
    private val principals: CallerPrincipalResolver,
) {
    @PostMapping
    @PreAuthorize("hasAuthority('SCOPE_consent:write')")
    fun grant(authentication: Authentication, @Valid @RequestBody command: GrantConsentCommand): ConsentView =
        service.grant(principals.resolve(authentication), command)

    @GetMapping
    @PreAuthorize("hasAuthority('SCOPE_consent:read')")
    fun list(authentication: Authentication): List<ConsentView> =
        service.list(principals.resolve(authentication))

    @DeleteMapping("/{consentId}")
    @PreAuthorize("hasAuthority('SCOPE_consent:write')")
    fun revoke(authentication: Authentication, @PathVariable consentId: UUID): ConsentView =
        service.revoke(principals.resolve(authentication), consentId)
}
