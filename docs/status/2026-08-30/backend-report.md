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
| Synthetic FHIR evidence projection | strict HAPI R4 Bundle parsing into deterministic, provenance-linked quantity candidates with explicit rejection reasons | VERIFIED LOCALLY against unit/red-team fixtures and one pinned Synthea 4.0.0 patient Bundle; pure in-memory boundary only |

## Synthetic evidence-graph boundary

`SyntheticFhirEvidenceProjector` is deliberately not a Spring bean, HTTP endpoint, persistence service, network client, or AI component. It accepts only a synthetic application subject and a bounded FHIR R4 transaction/collection Bundle. The projector requires exactly one Patient; unique Bundle full URLs and Observation identities; a matching subject; final/amended/corrected status; one system+code pair; UCUM Quantity; offset-aware effective time; and a recorded `issued` time.

Accepted results remain `CANDIDATE` and retain Bundle digest, resource/version, original Bundle location, source status, generator version/commit, and import time. Unsupported or ambiguous observations produce typed rejection codes. Source narrative and notes are not projected, so embedded prompt-like text does not become an instruction.

The pinned external experiment used Synthea `4.0.0` commit `0185c09ea9d10a822c6f5f3ef9bdcbcbe960c813`. One 390-entry transaction Bundle contained 99 Observations: 80 strict quantity candidates were admitted and 19 were rejected (18 unsupported values, one ambiguous code). This is structural evidence only—not clinical accuracy, Korean realism, KR Core/MyHealthWay conformance, OCR quality, persistence, or production safety.

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
- The existing durable lifecycle still uses a deterministic fixture; the new Synthea FHIR projector is not wired to its candidate database or confirmation UI.
- No KR Core validator, MyHealthWay implementation-guide adapter, candidate correction/supersession schema, or multi-source reconciliation exists.
- No backup/restore, RPO/RTO, deletion replay for backups, production DB role design, TLS evidence, or secret manager.
- No production ingress, container image/digest, hosted CI/CD, deployment, or observability sink.
- Separate research deployment is decided but not implemented.

## Backend verdict

The backend is now a real durable synthetic foundation, not merely interfaces. It remains deliberately too small and too local for real health information. Private beta with real data is NO-GO.
