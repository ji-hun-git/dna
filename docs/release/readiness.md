# Release readiness

The authoritative machine-readable snapshot is release/readiness.json. The executable checker is:

node scripts/release/check-readiness.mjs

It exits:

- 0 only when every blocking gate is PASS and verdict is GO.
- 1 when the file is valid but one or more blocking gates are not PASS.
- 2 when the artifact is structurally or logically invalid.

Current verdict: **NO_GO for a real-data private beta**.

Local dependency, durable synthetic lifecycle, authorization-negative, session invalidation, consent revocation, and synthetic deletion checks pass. Production image, isolated worker, production audit/provenance, backup/restore, hosted DevSecOps, and privacy/regulatory gates do not.

This artifact must be updated from evidence. A dependency declaration, mock, UI state, or unit test alone cannot change a gate to PASS.
