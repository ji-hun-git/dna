# Durable synthetic foundation lifecycle

## Status

**VERIFIED LOCALLY** against PostgreSQL 16.15 with synthetic allowlisted fixtures.

This is not a real-data beta, production upload pipeline, medical model, or external-provider integration. Foundation mode is disabled by default.

## Executable path

Browser
→ same-origin Next rewrite
→ Spring foundation API
→ opaque cookie session and CSRF/origin enforcement
→ PostgreSQL/Flyway
→ local quarantine directory
→ digest-allowlisted deterministic synthetic extraction
→ pending candidate
→ explicit confirmation
→ durable record and provenance fields
→ consent revocation
→ data/object deletion
→ session invalidation and content-free audit evidence

Next forwards the local /api path only when GC_CORE_API_ORIGIN is set. It does not own sessions, provider tokens, authorization, consent, or health-record rules.

## Default safety state

- gc.foundation.enabled is false.
- No database URL, quarantine path, audit pepper, synthetic identity, or document digest is committed.
- Startup fails when foundation mode is enabled without an HTTPS/loopback origin, 32-character audit pepper, explicit synthetic identity credential hashes, quarantine root, and allowlisted SHA-256 document digest.
- Session cookies default to Secure, HttpOnly, SameSite=Strict, and /api path scope.
- Only application/pdf requests between 8 bytes and 10 MiB are admitted.
- Inspection accepts only PDF magic bytes whose SHA-256 is in the configured synthetic fixture allowlist.
- OCR/model-like output is a PENDING candidate and cannot become a record without the confirmation endpoint.
- Health values and source content are absent from gc_audit_event by schema and API design.

## Local PostgreSQL verification

The verified local database was PostgreSQL 16.15, the current supported 16.x patch on 2026-08-30. The Windows x64 archive was obtained through the PostgreSQL Windows download page’s EDB binary link. The downloaded archive SHA-256 was:

25E6FCDFB8CAEC38691BF461125E7564508760666F7B8E5DC6A5F0818F58F81E

Required test environment:

| Variable | Purpose |
|---|---|
| GC_TEST_POSTGRES_URL | Dedicated synthetic test database JDBC URL |
| GC_TEST_QUARANTINE_ROOT | Dedicated emptyable test quarantine directory |

Run:

- gradlew.bat :apps:core-api:test
- pnpm foundation:e2e

The Kotlin integration test is disabled when GC_TEST_POSTGRES_URL is absent. The browser foundation config fails immediately when either required test variable is absent.

## Implemented attack checks

- Missing or wrong Origin at local login.
- Wrong local synthetic identity credential.
- Missing CSRF token.
- Cross-subject candidate confirmation and record read.
- Duplicate document request and confirmation idempotency.
- Confirmation bypass check: record list remains empty while candidate is pending.
- Revoked consent with a replayed old idempotency key.
- Non-allowlisted PDF rejection and extraction denial.
- Reload from durable PostgreSQL state.
- Old-session denial after deletion.
- Repeated deletion returns one durable deletion ID.
- Deleted object, document, record, and session absence.
- Safe denial audit committed independently of the rejected transaction.
- Cross-runtime SHA-256 standard vector.

## Known limitations

- Quarantine is local filesystem, not separately credentialed object storage.
- Inspection and deterministic extraction run synchronously in Spring; there is no malware scanner, queue, or network-isolated worker.
- The only extraction output is a fixed synthetic fixture candidate. It is not OCR or medical-model evidence.
- Local identity is a synthetic credential broker, not Kakao, Naver, OIDC, or production MFA.
- PostgreSQL roles, TLS, row-level security, backup/restore, production audit storage, KMS, observability, rate limits, and deployed ingress are not implemented.
- The existing product UI is unchanged; the browser foundation E2E verifies the browser/server lifecycle through same-origin fetch, not a finalized user-visible workflow.

