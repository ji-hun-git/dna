# Release readiness

The authoritative machine-readable snapshot is release/readiness.json. The executable checker is:

node scripts/release/check-readiness.mjs

It exits:

- 0 only when every blocking gate is PASS and verdict is GO.
- 1 when the file is valid but one or more blocking gates are not PASS.
- 2 when the artifact is structurally or logically invalid.

Current target: **HOSTED SYNTHETIC STAGING**. Current verdict: **NO_GO**. Latest evidence review: **2026-09-07**.

The digest-bound hostile-document state machine, bounded upload capability, local trust zones, transactional job leases/retries/DLQ and separate worker artifact exist. Main run [33367429797](https://github.com/ji-hun-git/dna/actions/runs/33367429797) for commit `937361c5ee995174bcce7648957a02b430bdf450` passed the exact runtime contract, web and research tests/builds, Spring/Flyway/PostgreSQL lifecycle, real ClamAV adapter test, browser-to-Spring-to-worker lifecycle, both CodeQL analyses, Gitleaks, Trivy, CycloneDX and OpenTofu checks.

Protected publication run [33370021596](https://github.com/ji-hun-git/dna/actions/runs/33370021596) published the web, core API and document-worker images by immutable registry digest, passed registry Critical/High scans, and verified keyless Cosign signatures plus SLSA provenance and CycloneDX attestations. The `synthetic-staging-registry` environment is `main`-only, requires founder review and disallows administrator bypass.

The runtime-image gate remains PARTIAL because a 2026-09-02 anonymous manifest probe returned HTTP 200 for all three GHCR packages even though the intended policy was private. These digests are stop-ship. GitHub documents that public packages cannot be converted back to private, so deletion/republication or migration to private ECR requires an explicit founder decision. No package was deleted during the audit. On 2026-09-07 the founder's rebuild request
selected a private-ECR direction: GHCR publication is now disabled on GitHub and main
requires strict CI plus one approving PR review, enforced for admins. Private ECR is
not provisioned. These repository controls do not resolve the registry stop-ship.

The [unified-product rebuild ledger](../revision/ASTRA_PRODUCT_REBUILD.md) records
new local web/JVM/browser evidence, including 200%/400%-equivalent viewport keyboard
reflow. This is not a real screen-reader or actual browser-zoom pass, and does not
upgrade any hosted gate.

The AWS Seoul OpenTofu foundation remains unapplied. No hosted object/IAM/queue/network control, observability probe, external audit anchor, backup/restore, deletion replay, actual browser-zoom/screen-reader accessibility check, hosted research-denial evidence, application deployment, provider connection, or PHI processing passes yet. The scanner evidence remains an engine boundary rather than a hosted scanner with an operational official-signature feed.

This artifact must be updated from evidence. A dependency declaration, mock, UI state, or unit test alone cannot change a gate to PASS.
