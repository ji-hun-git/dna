# Data lifecycle

**Current authorization:** synthetic data only

| Stage | Current implementation | Evidence | Production gap |
|---|---|---|---|
| Identity | local subject-specific credential or synthetic JWT | foundation/OIDC tests | Kakao/Naver broker, recovery, step-up |
| Consent | exact purpose/category/operation grant | `gc_consent_grant` and `consent_grant` tests | approved notice/lawful-basis process |
| Collection | short-lived capability bound to subject, purpose, exact length and SHA-256 | lifecycle service and capability contract tests | hosted object-store capability and IAM evidence |
| Untrusted storage | normalized trust-zone path and digest allowlist | storage boundary and PostgreSQL integration code | independently permissioned encrypted object storage |
| Inspection/extraction | leased separate worker, PDF structure policy, scanner adapter, deterministic synthetic-only candidate | document-boundary and worker tests | real scanner run and hosted isolation evidence |
| Confirmation | candidate cannot become a record without explicit confirmation | negative and happy-path tests | visible UI wired to server state/step-up policy |
| Use | owner-scoped record list with provenance | PostgreSQL reload test | full centralized policy engine and FHIR mapping |
| Revocation | purpose becomes inactive and later processing is denied | replay-after-revoke test | connector-side revocation and race handling |
| Deletion | synthetic rows/object/sessions removed; content-free audit retained | deletion and old-session tests | queue/caches/replicas/backups/search/support coverage |
| Retention | no production schedule | none | legal/privacy approval and enforced jobs |

Deletion and security-record retention are separate operations. Current local tests and code do not prove deletion from backups, external processors, observability, or provider systems.

See [retention-deletion-matrix.md](retention-deletion-matrix.md) and [release readiness](../release/readiness.md).
