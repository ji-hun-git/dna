# Durable synthetic foundation iteration

## A. Repository truth

At commit 54e1e93 the dependency emergency was fixed and the Spring-owned trust boundary was decided, but Spring still had no application controller, migration, repository, persistent session, or health-record lifecycle. The browser experience remained synthetic React memory. No Docker or local PostgreSQL installation existed.

## B. Decisions made

1. Keep foundation mode disabled by default.
2. Use PostgreSQL 16.15 and Flyway rather than substituting H2.
3. Use a local synthetic identity credential broker only for this foundation; Kakao/Naver remain disabled.
4. Admit only an explicitly allowlisted synthetic PDF digest.
5. Keep Next as a same-origin forwarding/UI layer; Spring owns every security and data rule.
6. Persist denial audits in a separate transaction so the rejected request cannot erase its evidence.

## C. Changes

- Added a PostgreSQL schema for synthetic subjects, opaque sessions, purpose consent, documents, jobs, candidates, records, idempotency, deletion receipts, and safe audit events.
- Added exact Origin, opaque cookie session, CSRF, subject credential, owner, active-consent, state-transition, digest, and idempotency enforcement.
- Added quarantine write and rollback cleanup, deterministic inspection, a fixed synthetic candidate, explicit confirmation, durable reload, revocation, data/object deletion, and old-session invalidation.
- Added a browser same-origin path and a separate browser/PostgreSQL Playwright configuration.
- Added a real release-readiness JSON artifact and fail-closed checker.
- Added implementation and threat-model evidence.

## D. Security attack results

The tests denied wrong Origin, wrong credential, missing CSRF, cross-subject confirmation/read, revoked-consent replay, confirmation bypass, unallowlisted PDF extraction, and deleted-session replay. Duplicate request/confirmation and deletion remained idempotent.

The attack loop found and fixed three real defects:

1. denial audit failed inside a read-only transaction;
2. denial audit rolled back with the rejected request;
3. signed-byte hex encoding produced a non-standard Kotlin SHA-256 representation that disagreed with Node.

## E. Verification

| Check | Result |
|---|---|
| PostgreSQL version | 16.15, 64-bit |
| Flyway schema history | V1 foundation lifecycle, success |
| Spring full tests with PostgreSQL variables | PASS |
| Kotlin standard SHA-256 vector | PASS |
| Browser foundation E2E | PASS 1/1 |
| Web unit/component/contract tests | PASS 24 files, 86 tests |
| Next production build | PASS, 8 static pages |
| Existing Korean UX E2E | PASS 6/6 |
| Post-deletion browser sessions | 0 active |
| Post-deletion browser health records | 0 retained |
| Audit health value check | 0 raw fixture values found |
| Release readiness | EXPECTED NO_GO |

## F. Current architecture

Executable locally:

Browser
→ Next same-origin rewrite
→ Spring foundation filter/controller/service/repository
→ PostgreSQL 16.15 and Flyway
→ local quarantine directory
→ deterministic allowlisted synthetic candidate

This is a monolithic foundation path. There is no real OAuth provider, ingress, production container, object store, worker, queue, malware scanner, model runtime, backup, or production observability.

## G. Remaining external gates

- Kakao and Naver application registration, redirect URIs, credentials, provider review, and conformance.
- MyHealthWay organization/designation, testbed, conformity, vulnerability evidence, and production approval.
- Live public-health data rights and provider approval.
- Privacy/legal review, intended-use approval, MFDS applicability decision, independent security review, and real-data authorization.
- DataON/AIDA rights and competition requirements in a separated research deployment.

## H. Remaining blockers

### Critical

- No known unresolved Critical installed production JavaScript dependency at this checkpoint.

### High

- Local quarantine is not separately credentialed object storage and inspection is not an isolated worker.
- No production image/digest, synthetic staging deployment, secret manager, DB role model, TLS evidence, backup/restore, rate limiting, or incident evidence.
- The user-visible UI is not yet wired to this foundation flow; the browser E2E uses same-origin fetch.
- Research evidence remains physically inside the web application build.
- Privacy, regulatory, and real-data approvals are absent.

### Medium

- No hosted SAST, secret, container, IaC, license, SBOM signing, or build provenance pipeline.
- No malware/parser fuzzing, concurrency/stress test, production CSP validation, DAST, or manual accessibility audit.
- Local deletion is synchronous and does not model backup/legal retention workflows.

### Low

- The PostgreSQL test instance is manually provisioned because Docker/Testcontainers is unavailable on this workstation.

## I. Release verdict

**PRIVATE BETA NO-GO**

The repository now contains the first durable browser-to-database synthetic foundation and credible negative tests. It remains a local foundation, not a production-shaped private-beta environment, and real PHI is still prohibited.
