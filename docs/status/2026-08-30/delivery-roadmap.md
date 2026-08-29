# Delivery roadmap from the current codebase

The next milestone should be a thin, secure, synthetic vertical slice. Adding more disconnected mock screens or interfaces will not materially improve product readiness.

## P0 — Make one real local vertical slice

| Order | Work | Completion evidence |
|---:|---|---|
| 1 | Fix test isolation and the design-token line-height mismatch | Default E2E cannot attach to another app; token consumer test passes |
| 2 | Implement account, purpose, consent, document, record, audit, and deletion schemas with Flyway/PostgreSQL | Migrations, constraints, rollback policy, and Testcontainers tests pass |
| 3 | Implement object- and purpose-level authorization in the Spring core | Cross-user, cross-purpose, revoked-consent, replay, and enumeration tests fail closed |
| 4 | Implement synthetic document upload ticket, quarantine state, digest receipt, and review-candidate persistence | End-to-end test proves no unreviewed candidate becomes a record |
| 5 | Expose the minimum Spring endpoints and a narrow Next BFF adapter | Contract tests cover validation, auth, idempotency, errors, and redaction |
| 6 | Replace the home/import/data-control in-memory state with the synthetic backend | Reload preserves authorized state; revoke/delete effects are durable and auditable |

No real personal data is needed to complete this milestone.

## P0 — Establish production security foundations

- Korea-region environment and data-flow decision approved by privacy/security owners.
- Secret manager, workload identity, encrypted database/object storage, and deny-by-default egress.
- Opaque rotating application sessions, CSRF/origin controls, one-time OAuth transaction store, edge/app rate limiting, and redacted security events.
- CI with type/test/build, SAST, SCA, secret, IaC, license, container, and SBOM/provenance gates.
- Backup/restore, deletion tombstone, session kill, incident, and key/provider rotation drills.
- Legal/privacy and MFDS intended-use review of the actual implemented flow.

## P1 — Activate external connections one at a time

1. Kakao test application and exact callback path.
2. Naver test application and pre-service review path.
3. Public healthcare reference dataset adapters with source, freshness, recall, and schema-drift controls.
4. DataON metadata-only server connector after key/IP approval.
5. AIDA metadata-only server connector after account and per-resource rights approval.
6. MyHealthWay only after every formal onboarding and conformity gate; it is not a launch dependency.

Each connector needs its own kill switch, exact egress allowlist, quota/error behavior, synthetic conformance suite, and user-facing degraded state before the next connector is started.

## P1 — Medical document candidate pipeline

- Admit exact OCR/model/container artifacts only after license, provenance, vulnerability, and content-manifest review.
- Run network-free, digest-bound inference in the reviewed isolated runner.
- Build a representative Korean document corpus without using uncontrolled real patient documents.
- Require source localization, units, confidence, abstention, and candidate-by-candidate user confirmation.
- Keep diagnosis, normal/abnormal classification, treatment, medication, and automatic record creation prohibited.

## P1 — Frontend completion

- Authenticated shell and recent-auth linking/unlinking UX.
- Real loading, retry, timeout, stale, partial, revoked, and provider-outage states.
- Durable consent, export, deletion, and job-status experiences.
- Manual accessibility audit and supported device/browser matrix.
- Visual-regression suite anchored to the approved design references.
- Split page-owned CSS and document component/token ownership.

## P2 — Beta and release evidence

- Threat model, privacy impact assessment, data retention schedule, and subprocessor map.
- Independent penetration test and remediation evidence.
- Performance/load budgets and recovery objectives.
- Support and incident runbooks that prohibit PHI in ordinary tickets/logs.
- Staged synthetic-data release, monitored rollback, and explicit founder/security/privacy/regulatory sign-off.

## Definition of the next demonstrable milestone

The milestone is complete when a synthetic user can authenticate through the local broker substitute, grant one purpose-specific consent, upload one synthetic PDF through quarantine, review one candidate, save one provenance-bound record, reload it, revoke the consent, and verify the corresponding durable audit/deletion behavior—while all negative authorization and security tests pass.

