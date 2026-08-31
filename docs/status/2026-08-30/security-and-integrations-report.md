# Security and integrations report

## Enforced locally

- Next 16.3.3, Node 24.20.0, and pnpm 11.20.0 exact runtime policy.
- Spring-only application/session/authorization authority; no browser provider tokens.
- Opaque hashed sessions, exact Origin, CSRF, owner-scoped JDBC and purpose checks.
- Strict JWT issuer/audience/client/claim validation and method scopes.
- Purpose consent with durable revoke/outbox.
- Candidate confirmation and provenance before record creation.
- Safe denial audit that survives rejected transactions.
- Hash-chain audit model and PostgreSQL trigger rejecting update/delete.
- PHI-safe logger/collector policy tests.
- OpenTofu-tested AWS account, OU, Seoul-region and security-tamper guardrails.

## Adversarial results

Wrong Origin/credential, missing CSRF, cross-user candidate/record access, wrong scope, cross-subject consent access, revoked consent, idempotent replay, rejected digest, confirmation bypass, old-session replay, and audit-row mutation all fail closed in local synthetic tests.

These results do not substitute for production DAST, a penetration test, rate-limit/DoS testing, parser sandbox testing, provider conformance, or operational incident exercises.

## Integration matrix

| Integration | Current code/evidence | Live state | Decision |
|---|---|---|---|
| Kakao | browser contract and strict Spring OIDC boundary | no app/account/callback/token exchange | EXTERNAL GATE / DISABLED |
| Naver | browser contract and strict Spring OIDC boundary | no app/review/callback/token exchange | EXTERNAL GATE / DISABLED |
| MyHealthWay | deny-by-default contract and planning package | no designation/testbed/conformity | EXTERNAL GATE / DISABLED |
| Public health data | synthetic schema/UX | no production dataset adapter | DISABLED |
| DataON/AIDA | offline metadata/rights/evaluation prototype | no approved live key/account/egress | separate research deployment required |
| OCR/medical model | digest-bound contracts and synthetic regression | no admitted weights/container/worker | NOT IMPLEMENTED |
| AWS | organization/SCP code and local OpenTofu tests | no AWS account mutation | NOT APPLIED |

Secrets must never enter Markdown, Git, browser variables, screenshots, logs, or chat. External credentials are founder/operator actions to perform later through approved provider consoles and a future secret manager.

## Security verdict

Local enforcement is materially stronger, but production controls remain incomplete. No real identity, connector, document, or PHI processing is authorized.
