# Integrated security-foundation iteration

## A. Repository truth

The current UI branch already contained the durable synthetic lifecycle. A separate branch descending from the same API skeleton contained four unmerged commits for OIDC, purpose consent, PHI-safe audit/telemetry, and AWS organization guardrails. Merging that branch wholesale would have deleted the later web product tree.

## B. Decisions made

- Preserve the current UI and cherry-pick the four backend/infrastructure commits in order.
- Keep Spring as the single public application authority.
- Make OIDC, consent, workload tokens, and foundation explicit disabled-by-default surfaces.
- Sequence Flyway migrations V1/V2/V3.
- Treat the infrastructure as OpenTofu 1.10.6, as proven by its lockfile and official release, not HashiCorp Terraform.

## C. Changes

- Integrated strict JWT/OIDC validation and Ed25519 workload identity contracts.
- Integrated durable purpose consent, outbox, hash-chain audit, PHI-safe telemetry and AWS organization SCPs.
- Added ordered path-scoped Spring security chains and one shared clock.
- Added fail-closed HTTPS OIDC configuration validation only when enabled.
- Added actual PostgreSQL consent/API/outbox and audit-immutability tests.
- Added the missing system, privacy, security, operations, quality and release evidence documents.

## D. Security attack results

The integrated system rejected wrong JWT scope, cross-subject consent access, BOLA, Origin/CSRF failures, revoked consent, invalid digest, confirmation bypass, old-session replay, duplicate critical actions, and database audit mutation. Two startup hazards were found and fixed: unconditional optional-bean creation and unconditional validation of disabled OIDC settings.

## E. Verification

See [verification-and-release-report.md](verification-and-release-report.md). PostgreSQL, browser E2E, web tests/build/Storybook, Python security-policy tests and OpenTofu tests passed locally.

## F. Current architecture

Executable now: browser UI and same-origin rewrite, Spring session/OIDC/consent/lifecycle authority, PostgreSQL migrations, local allowlisted quarantine, deterministic candidate/confirmation, safe audit, and local AWS policy tests.

## G. Remaining external gates

Kakao, Naver, MyHealthWay, public-health datasets, DataON/AIDA accounts/rights, privacy/legal/MFDS decisions, cloud accounts, domains and production secrets remain external gates or disabled.

## H. Remaining blockers

- Critical: none known in the locally audited dependency set.
- High: no production image/environment; no hostile-file worker; no backup/restore; no hosted DevSecOps; no privacy/regulatory authorization; visible UI not wired to durable lifecycle.
- Medium: no production audit sink, secret manager/rotation drill, manual accessibility, supported-browser matrix, performance/DoS evidence, or separated research deployment.
- Low: Storybook bundle-size warning and remaining CSS ownership debt.

## I. Release verdict

**PRIVATE BETA NO-GO**
