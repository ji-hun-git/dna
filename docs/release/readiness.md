# Release readiness

The authoritative machine-readable snapshot is release/readiness.json. The executable checker is:

node scripts/release/check-readiness.mjs

It exits:

- 0 only when every blocking gate is PASS and verdict is GO.
- 1 when the file is valid but one or more blocking gates are not PASS.
- 2 when the artifact is structurally or logically invalid.

Current target: **HOSTED SYNTHETIC STAGING**. Current verdict: **NO_GO**.

The digest-bound hostile-document state machine, bounded upload capability, local trust zones, transactional job leases/retries/DLQ and separate worker artifact now exist. GitHub Actions run [33315069682](https://github.com/ji-hun-git/dna/actions/runs/33315069682) for commit `1037e50` passed the exact runtime contract, web and research tests/builds, Spring/Flyway/PostgreSQL lifecycle including a concurrent duplicate-delivery race, the real ClamAV 1.5.4 command adapter, browser-to-Spring-to-separate-worker lifecycle, both CodeQL analyses, Gitleaks, Trivy and CycloneDX SBOM generation. The scanner test uses a harmless synthetic SHA-256 signature database, so it proves the engine boundary rather than a hosted scanner or operational official-signature feed. Hosted object/IAM/queue/network controls, immutable runtime images, observability, external audit anchoring, backup/restore, deletion replay, 400-percent/screen-reader accessibility checks and hosted research-denial evidence do not yet pass.

This artifact must be updated from evidence. A dependency declaration, mock, UI state, or unit test alone cannot change a gate to PASS.
