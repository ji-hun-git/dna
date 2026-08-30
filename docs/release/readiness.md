# Release readiness

The authoritative machine-readable snapshot is release/readiness.json. The executable checker is:

node scripts/release/check-readiness.mjs

It exits:

- 0 only when every blocking gate is PASS and verdict is GO.
- 1 when the file is valid but one or more blocking gates are not PASS.
- 2 when the artifact is structurally or logically invalid.

Current target: **HOSTED SYNTHETIC STAGING**. Current verdict: **NO_GO**.

The digest-bound hostile-document state machine, bounded upload capability, local trust zones, transactional job leases/retries/DLQ and separate worker artifact now exist. GitHub Actions run [33313462363](https://github.com/ji-hun-git/dna/actions/runs/33313462363) for commit `d169d95` passed the exact runtime contract, web and research tests/builds, Spring/Flyway/PostgreSQL lifecycle, browser-to-Spring-to-separate-worker lifecycle, both CodeQL analyses, Gitleaks, Trivy and CycloneDX SBOM generation. This proves the bounded synthetic CI path, not a hosted deployment. A real ClamAV run, explicit concurrent duplicate-delivery race, hosted object/IAM/queue/network controls, immutable runtime images, observability, external audit anchoring, backup/restore, deletion replay, 400-percent/screen-reader accessibility checks and hosted research-denial evidence do not yet pass.

This artifact must be updated from evidence. A dependency declaration, mock, UI state, or unit test alone cannot change a gate to PASS.
