# Release readiness

The authoritative machine-readable snapshot is release/readiness.json. The executable checker is:

node scripts/release/check-readiness.mjs

It exits:

- 0 only when every blocking gate is PASS and verdict is GO.
- 1 when the file is valid but one or more blocking gates are not PASS.
- 2 when the artifact is structurally or logically invalid.

Current target: **HOSTED SYNTHETIC STAGING**. Current verdict: **NO_GO**.

The digest-bound hostile-document state machine, bounded upload capability, local trust zones, transactional job leases/retries/DLQ and separate worker artifact now exist. The frontend production build and local unit suites pass. SHA-pinned GitHub CI now defines PostgreSQL/Flyway and browser/worker E2E plus CodeQL, Gitleaks, Trivy and CycloneDX gates, but no GitHub run is evidence until it actually executes. A real ClamAV run, full-stack PostgreSQL worker/browser E2E, hosted object/IAM/queue/network controls, immutable runtime images, observability, external audit anchoring, backup/restore, deletion replay and hosted research-denial evidence do not yet pass.

This artifact must be updated from evidence. A dependency declaration, mock, UI state, or unit test alone cannot change a gate to PASS.
