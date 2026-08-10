package kr.co.genomecompanion.identityaccount.security

import java.net.URI
import kr.co.genomecompanion.identityaccount.api.SensitiveActionAssuranceRequirement
import kr.co.genomecompanion.identityaccount.api.SensitiveActionDeniedException
import org.springframework.http.CacheControl
import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class SensitiveActionProblemHandler {
    @ExceptionHandler(SensitiveActionDeniedException::class)
    fun handle(exception: SensitiveActionDeniedException): ResponseEntity<ProblemDetail> {
        val problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.FORBIDDEN,
            "Sensitive action requirements are not satisfied.",
        )
        problem.type = URI.create("https://api.genome-companion.kr/problems/sensitive-action")
        problem.title = "Sensitive action not authorized"
        problem.setProperty("code", exception.denial.code)
        problem.setProperty("assurance", SensitiveActionAssuranceRequirement.forAction(exception.action))
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .cacheControl(CacheControl.noStore())
            .body(problem)
    }
}
