# Attested runtime registry

**Evidence review:** 2026-09-02
**Publication state:** executed successfully
**Deployment state:** not deployed
**Operational verdict:** **STOP-SHIP — unintended public package visibility**

`.github/workflows/publish-runtime-images.yml` is the manual publication path for the web, core API,
and document-worker images. It is bound to the protected GitHub environment
`synthetic-staging-registry`.

## Executed publication

Source revision: `937361c5ee995174bcce7648957a02b430bdf450` on `main`.

- Exact main CI: [33367429797](https://github.com/ji-hun-git/dna/actions/runs/33367429797) — success.
- Publication: [33370021596](https://github.com/ji-hun-git/dna/actions/runs/33370021596) — all three matrix jobs succeeded.
- Environment: required reviewer `ji-hun-git`; only `main`; administrator bypass disabled.

The run accepted only the exact current `main` SHA, required successful push CI for the same SHA,
checked out the immutable revision without persisted Git credentials, published only the
`sha-<commit>` tag, scanned the exact registry digest, signed it with keyless Cosign, produced SLSA
provenance and CycloneDX SBOM attestations, and verified the workflow identity, source SHA, source
ref, signature and predicates before uploading evidence.

| Runtime | Registry digest | Provenance | SBOM attestation |
|---|---|---|---|
| Web | `sha256:eab9f101a06acd92ff2307bedc57b96d5362d4020d8bcb6539ecadb44ac2d4e8` | [44075574](https://github.com/ji-hun-git/dna/attestations/44075574) | [44075583](https://github.com/ji-hun-git/dna/attestations/44075583) |
| Core API | `sha256:ee41c46e5417638a032be0006c95db17688c2635d68847cd7be9a024abdbe950` | [44075845](https://github.com/ji-hun-git/dna/attestations/44075845) | [44075863](https://github.com/ji-hun-git/dna/attestations/44075863) |
| Document worker | `sha256:689180cae9c6ed3994ae7bbc49e04bb9d4c6392bb2a58138369b7dd3a30b6c2c` | [44075825](https://github.com/ji-hun-git/dna/attestations/44075825) | [44075836](https://github.com/ji-hun-git/dna/attestations/44075836) |

## Visibility stop-ship

An anonymous GHCR token plus manifest HEAD request returned HTTP 200 for every exact digest on
2026-09-02. The packages are therefore publicly pullable. This conflicts with the explicit private
package requirement.

GitHub's [package visibility documentation](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility)
states that once a package is public it cannot be changed back to private. A safe remediation must
therefore be chosen explicitly:

1. authorize deletion of the three packages, remove the automatic public-repository inheritance
   path, and republish under verified private package identities; or
2. retire these GHCR coordinates and publish deployable artifacts only to the private AWS ECR
   boundary after an approved account-backed plan/apply.

Package deletion is destructive. It was not performed during the sanity audit. Do not dispatch the
publication workflow again and do not deploy any listed digest until remediation is approved,
executed, and an anonymous pull-denial probe passes.

## Publication contract

- Accept only an exact lowercase 40-character commit equal to the current `main` revision.
- Require a successful `genome-companion-ci` push run for that same revision.
- Publish no mutable deployment tag such as `latest`.
- Treat `repository@sha256:digest` as the only possible deployable coordinate.
- Fail on unresolved Critical/High registry-image vulnerabilities.
- Use GitHub OIDC, not a stored signing key.
- Verify exact workflow identity, source revision/ref, signature, SLSA provenance, and CycloneDX
  SBOM attestation.
- Require a private-visibility proof before a future artifact becomes deployment eligible.

## Not authorized by publication

Successful publication is supply-chain evidence only. It does not authorize AWS deployment, public
ingress, real documents, PHI, medical-AI inference, or Kakao, Naver, MyHealthWay, NHIS, or HIRA
credentials.
