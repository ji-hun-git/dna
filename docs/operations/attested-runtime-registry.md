# Attested runtime registry

**Current state:** implemented and locally policy-checked, but not yet executed. The GitHub environment `synthetic-staging-registry` exists, requires founder review, and allows only `main`. No registry digest, signature, SBOM attestation, or provenance attestation exists until the workflow runs successfully from `main`.

`.github/workflows/publish-runtime-images.yml` is the only publication path for the web, core API, and document-worker images. It is deliberately manual and bound to the protected GitHub environment `synthetic-staging-registry`.

## Publication contract

- Accept only an exact lowercase 40-character commit that is also the current `main` revision.
- Require a successful `genome-companion-ci` push run for that same revision.
- Check out the immutable revision without persisting Git credentials.
- Publish only `sha-<commit>` tags to `ghcr.io/ji-hun-git/dna-{web,core-api,document-worker}`; `latest` and other mutable deployment tags are prohibited.
- Treat `repository@sha256:digest` as the only deployable coordinate.
- Fail on unresolved Critical/High registry-image vulnerabilities.
- Use GitHub OIDC, not a stored signing key, for a Cosign signature and GitHub SLSA provenance and CycloneDX SBOM attestations.
- Verify the exact workflow identity, source revision, source ref, predicate types, signature, and both attestations before preserving evidence.

All external actions are pinned by commit SHA. The job has no cloud credential or provider credential. Its token permissions are scoped to reading the prior Actions result and writing GitHub packages and attestations.

## Founder action — only after this change is on `main`

1. Keep all three GHCR packages private. Do not make them public.
2. In the `synthetic-staging-registry` GitHub environment, approve only the exact `main` SHA whose CI run is green.
3. Dispatch `publish-attested-runtime-images` with that exact SHA.
4. Do not copy a tag into deployment configuration. Copy the verified `ghcr.io/...@sha256:...` coordinate from the evidence artifact.

Publication must not be approved if the source SHA, CI SHA, or intended candidate differs. GitHub currently reports that repository administrators may bypass the environment rules; turn off **Allow administrators to bypass configured protection rules** in the environment settings before the first publication.

## Not authorized by publication

A successful publication is supply-chain evidence only. It does not authorize AWS deployment, public ingress, real documents, PHI, medical-AI inference, or Kakao, Naver, MyHealthWay, NHIS, or HIRA credentials.
