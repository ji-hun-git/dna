# Release readiness

The authoritative machine-readable snapshot is release/readiness.json. The executable checker is:

node scripts/release/check-readiness.mjs

It exits:

- 0 only when every blocking gate is PASS and verdict is GO.
- 1 when the file is valid but one or more blocking gates are not PASS.
- 2 when the artifact is structurally or logically invalid.

Current target: **HOSTED SYNTHETIC STAGING**. Current verdict: **NO_GO**.

The digest-bound hostile-document state machine, bounded upload capability, local trust zones, transactional job leases/retries/DLQ and separate worker artifact now exist. GitHub Actions run [33318715896](https://github.com/ji-hun-git/dna/actions/runs/33318715896) for commit `001a030` passed the exact runtime contract, web and research tests/builds, Spring/Flyway/PostgreSQL lifecycle including a concurrent duplicate-delivery race, the real ClamAV 1.5.4 command adapter, browser-to-Spring-to-separate-worker lifecycle, both CodeQL analyses, Gitleaks, filesystem Trivy and CycloneDX generation. The same run built digest-pinned, non-root web/core/worker Linux image candidates, smoke-tested them, passed unresolved Critical/High image scans and preserved local image IDs, inspect manifests and per-image SBOMs. The scanner test uses a harmless synthetic SHA-256 signature database, so it proves the engine boundary rather than a hosted scanner or operational official-signature feed. The images are not registry-published, signed, attested or deployed. Hosted object/IAM/queue/network controls, observability, external audit anchoring, backup/restore, deletion replay, 400-percent/screen-reader accessibility checks and hosted research-denial evidence do not yet pass.

This artifact must be updated from evidence. A dependency declaration, mock, UI state, or unit test alone cannot change a gate to PASS.
