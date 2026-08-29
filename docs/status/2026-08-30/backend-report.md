# Backend report

## Current executable backend

The authoritative application boundary is Kotlin/Spring Boot. Next.js remains presentation and validated same-origin forwarding only.

| Subsystem | Executable capability | Status |
|---|---|---|
| Foundation session | subject-specific local credential, opaque cookie, hashed session/CSRF, expiry/invalidation | VERIFIED LOCALLY, synthetic broker only |
| Foundation lifecycle | purpose consent, upload request, quarantine, inspection, extraction job, candidate, confirmation, record, reload, revoke, delete | VERIFIED LOCALLY with PostgreSQL/local filesystem |
| OIDC resource server | issuer/audience/client/claim validation, exact normalized scopes, 401/403 problem responses | VERIFIED LOCALLY with synthetic JWT; external issuer disabled |
| Purpose consent | durable grants, exact categories/operations, subject-scoped list, idempotent revoke outbox | VERIFIED LOCALLY with PostgreSQL |
| Workload identity | Ed25519 purpose-token issuer and signed JWKS ceremony contracts | VERIFIED LOCALLY; runtime switch disabled and no KMS |
| Audit | content-free foundation events plus separate hash-chain schema/no-mutation trigger | VERIFIED LOCALLY; no production immutable sink |
| Telemetry | correlation filter, PHI-safe logger, collector policy | VERIFIED LOCALLY; no hosted collector |
| Infrastructure | AWS Organizations account/OU/SCP module | OpenTofu tests PASS; no external apply |

## Persistence

Flyway applies three ordered migrations:

1. `V1__foundation_lifecycle.sql`
2. `V2__fnd_consent_and_outbox.sql`
3. `V3__fnd_security_audit.sql`

Local PostgreSQL 16.15 applied all three successfully. The foundation schema stores only synthetic test state in the current environment. Candidate confirmation, revocation, deletion, denial-audit persistence, and DB-enforced audit immutability have integration coverage.

## Security configuration

All sensitive runtime surfaces default off:

- `security.oidc.enabled=false`
- `gc.consent.enabled=false`
- `gc.workload-tokens.enabled=false`
- `gc.foundation.enabled=false`

Enabled OIDC configuration requires HTTPS issuer/JWKS endpoints and nonblank bounded identifiers. Foundation and OIDC use ordered, path-scoped security chains and one shared UTC clock.

## Remaining backend gaps

- No production identity broker, provider callback/token store, rate limiter, account recovery, MFA, or step-up flow.
- The visible frontend is not wired to the durable lifecycle; foundation browser E2E calls the API path directly.
- No object store, malware scanner, isolated queue/worker, real OCR/model artifact, or network sandbox.
- The deterministic candidate is a fixture, not extracted medical evidence.
- No backup/restore, RPO/RTO, deletion replay for backups, production DB role design, TLS evidence, or secret manager.
- No production ingress, container image/digest, hosted CI/CD, deployment, or observability sink.
- Separate research deployment is decided but not implemented.

## Backend verdict

The backend is now a real durable synthetic foundation, not merely interfaces. It remains deliberately too small and too local for real health information. Private beta with real data is NO-GO.
