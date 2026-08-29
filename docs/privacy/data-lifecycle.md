# Data lifecycle

**Current authorization:** synthetic data only

| Stage | Current implementation | Evidence | Production gap |
|---|---|---|---|
| Identity | local subject-specific credential or synthetic JWT | foundation/OIDC tests | Kakao/Naver broker, recovery, step-up |
| Consent | exact purpose/category/operation grant | `gc_consent_grant` and `consent_grant` tests | approved notice/lawful-basis process |
| Collection | upload request bound to subject and purpose | lifecycle service | single-use object-store capability |
| Quarantine | generated local path and digest allowlist | browser foundation E2E | malware scan, immutable object storage |
| Inspection/extraction | deterministic synthetic-only candidate | integration test | isolated worker and admitted model artifact |
| Confirmation | candidate cannot become a record without explicit confirmation | negative and happy-path tests | visible UI wired to server state/step-up policy |
| Use | owner-scoped record list with provenance | PostgreSQL reload test | full centralized policy engine and FHIR mapping |
| Revocation | purpose becomes inactive and later processing is denied | replay-after-revoke test | connector-side revocation and race handling |
| Deletion | synthetic rows/object/sessions removed; content-free audit retained | deletion and old-session tests | queue/caches/replicas/backups/search/support coverage |
| Retention | no production schedule | none | legal/privacy approval and enforced jobs |

Deletion and security-record retention are separate operations. The current test proves only the local schema and quarantine object behavior; it does not prove deletion from backups, external processors, observability, or provider systems.

See [retention-deletion-matrix.md](retention-deletion-matrix.md) and [release readiness](../release/readiness.md).
