# Genome Companion Korea — project guide

**Start here.** This is the human- and agent-readable operating guide for the repository.

**Last evidence review:** 2026-09-02 (Asia/Seoul)
**Repository:** `ji-hun-git/dna`
**Current release target:** `HOSTED_SYNTHETIC_STAGING`
**Current release verdict:** **NO_GO**
**Data authorization:** synthetic fixtures and rights-reviewed public metadata only

> Stop-ship notice: the first three GHCR runtime packages were published successfully and
> cryptographically verified, but an anonymous-pull probe shows that all three packages are
> public. The intended policy was private. GitHub documents that a public package cannot be
> changed back to private; deletion and controlled republishing therefore require a separate,
> explicit founder decision. Do not deploy these images or dispatch the publication workflow
> again until that decision is recorded.
>
> Root cause (2026-09-02 review): `publish-runtime-images.yml` logs in to GHCR with the
> repository's own `github.token`, so the packages are linked to this public repository and
> inherit its visibility. Republishing the same way would make them public again. The remedy
> options are recorded in `docs/reviews/2026-09-02-project-review.md` finding F-2.

## 1. What this product is

Genome Companion Korea is a Korean-first private health-history companion. The launch wedge is
an annual-checkup and medical-record companion that helps a person collect records, inspect the
source of each value, confirm extracted candidates, and understand a longitudinal history.

The current permitted product claim is deliberately narrow:

> Organize source-backed health-document information and present extraction candidates for
> explicit human confirmation.

The product does **not** diagnose, label a result as normal or abnormal, predict disease, recommend
treatment or medication, prescribe, or turn model output into a clinical fact automatically.

The genetic-wallet concept is post-MVP and remains behind its independent G0 gate. Raw
VCF/BAM/FASTQ, variants, scores, free-text genetic interpretation, and a server-side genetics API
remain outside the approved foundation.

## 2. Current truth at a glance

| Area | Evidence-backed status |
|---|---|
| Product and program design | Founder-approved direction; public brand clearance remains separate |
| Korean consumer web | Implemented and tested with synthetic/demo content; integrated flow reviews an ordered three-candidate synthetic set per document, groups records by date and document, lists two dated values of the same item side by side without interpretation, shows Korean status labels instead of server enums, and prints neutral visit-preparation questions (2026-09-02 waves 1 and 2); CI evidence run 33576825427 (33e6ac8) and main run 33592526743 (merge 07d77fe) |
| Core API | Spring/Kotlin authority for sessions, CSRF/origin checks, consent, lifecycle, provenance, audit, and deletion in the synthetic foundation |
| Durable store | PostgreSQL/Flyway lifecycle verified in CI with synthetic data |
| Hostile-document boundary | Digest-bound upload, quarantine/approval states, ClamAV contract, separate worker artifact, retry/DLQ behavior, and safe-preview boundary verified in CI |
| Research app | Separate DataON/AIDA public-metadata runtime; hosted isolation is not deployed |
| Runtime supply chain | Three immutable GHCR digests built, scanned, signed, and attested; package visibility is an unresolved stop-ship because anonymous pull is currently allowed |
| AWS foundation | OpenTofu code and tests exist for Seoul synthetic staging; no account-backed plan or apply has occurred |
| Hosted staging | Not deployed |
| Kakao/Naver/MyHealthWay/NHIS/HIRA | Disabled; no live provider credentials or personal-record retrieval |
| Medical AI/OCR | Synthetic evaluation and isolated-runner contracts only; no production inference or PHI authorization |
| Real personal health data | Prohibited |
| Release | `NO_GO`; see `release/readiness.json` |

Passing tests proves only the stated synthetic contract. It is not clinical validation, regulatory
clearance, legal approval, or authorization to process personal health information.

## 3. Architecture and ownership

```text
Browser
  |
  | Korean-first presentation and same-origin requests
  v
Next.js web (apps/web)
  |
  | presentation only; no provider tokens or independent PHI authority
  v
Spring core API (apps/core-api)
  |                 |                         |
  v                 v                         v
PostgreSQL      hostile-document state     isolated document-worker artifact
                and trust-zone contracts   (apps/document-worker)

Separate runtime: apps/research-web
  -> public/research metadata only
  -> no PHI-plane credentials

Future hosted boundary (defined, not applied):
  AWS Seoul KMS + S3 trust zones + SQS/DLQ + ECR + scoped workload identities
```

Authoritative responsibility:

| Responsibility | Owner |
|---|---|
| Browser rendering and interaction | `apps/web` |
| Session, CSRF/origin enforcement, authorization, consent, records, provenance, audit, deletion | `apps/core-api` |
| Hostile document inspection/extraction execution | `apps/document-worker` behind narrow contracts |
| Public DataON/AIDA evidence exploration | `apps/research-web`, isolated from the health-data plane |
| Shared document-boundary contracts | `packages/document-boundary` |
| Design primitives | `packages/design-tokens` |
| Hosted synthetic foundation definition | `infra/modules/synthetic-staging` and `infra/live/synthetic-staging` |

Spring is the application authority. Next.js must not grow a second authorization system, retain
provider tokens, or become an independent health-data backend.

## 4. Evidence hierarchy

When documents disagree, use this order:

1. Live, immutable evidence: exact Git commit, GitHub run, registry digest, attestation, or hosted
   denial probe.
2. `release/readiness.json`, validated by `scripts/release/check-readiness.mjs`.
3. This guide and current operations/architecture documents.
4. Accepted ADRs and approved governance decisions.
5. Dated reports under `docs/status/`; these are historical snapshots, not current truth.
6. Plans and proposals; they describe intended work and never prove execution.

A dependency declaration, UI mock, Terraform/OpenTofu resource, test double, or workflow file is not
evidence that an external system is live.

## 5. Verified supply-chain evidence

Source revision: `937361c5ee995174bcce7648957a02b430bdf450` on `main`.

- Main CI: [run 33367429797](https://github.com/ji-hun-git/dna/actions/runs/33367429797) — success.
- Protected publication: [run 33370021596](https://github.com/ji-hun-git/dna/actions/runs/33370021596) — all three jobs succeeded.
- Environment: `synthetic-staging-registry`, `main` only, required reviewer `ji-hun-git`, administrator bypass disabled.

| Runtime | Immutable registry coordinate | Provenance | SBOM |
|---|---|---|---|
| Web | `ghcr.io/ji-hun-git/dna-web@sha256:eab9f101a06acd92ff2307bedc57b96d5362d4020d8bcb6539ecadb44ac2d4e8` | [44075574](https://github.com/ji-hun-git/dna/attestations/44075574) | [44075583](https://github.com/ji-hun-git/dna/attestations/44075583) |
| Core API | `ghcr.io/ji-hun-git/dna-core-api@sha256:ee41c46e5417638a032be0006c95db17688c2635d68847cd7be9a024abdbe950` | [44075845](https://github.com/ji-hun-git/dna/attestations/44075845) | [44075863](https://github.com/ji-hun-git/dna/attestations/44075863) |
| Document worker | `ghcr.io/ji-hun-git/dna-document-worker@sha256:689180cae9c6ed3994ae7bbc49e04bb9d4c6392bb2a58138369b7dd3a30b6c2c` | [44075825](https://github.com/ji-hun-git/dna/attestations/44075825) | [44075836](https://github.com/ji-hun-git/dna/attestations/44075836) |

The publication run verified exact workflow identity, `main` source SHA, SLSA provenance,
CycloneDX SBOM attestations, Cosign keyless signatures, and unresolved Critical/High registry-image
scans. These coordinates are supply-chain evidence only and are **not approved deployment inputs**
while the visibility stop-ship remains open.

## 6. Non-negotiable safety boundaries

1. Never commit or upload real PDFs, DICOM, CSV, DNA results, identifiers, credentials, tokens,
   certificates, or PHI.
2. Use only clearly marked synthetic fixtures and rights-reviewed public metadata.
3. Never send user health data to a third-party AI service during foundation work.
4. AI/OCR output remains a candidate until an explicit human decision; abstention and uncertainty
   must remain visible.
5. Do not add diagnosis, normality, risk prediction, treatment, medication, or autonomous clinical
   actions without a new intended-use decision and regulatory review.
6. Kakao/Naver login is identity only. It never substitutes for health-data provision consent,
   application processing consent, or MyHealthWay authorization.
7. Keep the personal-health runtime and research/public-data runtime separate in credentials,
   storage, logs, network policy, and deployment identity.
8. Do not deploy a tag. Use only a reviewed `repository@sha256:digest` after its evidence and
   environment approval are verified.
9. No paid medical-referral or success-fee workflow without a written Korean legal opinion.
10. No hosted or real-data claim may move to PASS without runtime evidence from the named target.

## 7. Toolchain

Exact versions are policy, not suggestions:

| Tool | Version |
|---|---|
| Node.js | `24.20.0` |
| pnpm | `11.20.0` |
| Java | `21` |
| OpenTofu | `1.10.6` |
| AWS provider | `6.10.0` |
| Next.js | `16.3.3` |

The current Windows machine may have a different global Node version. Use an exact-version manager
or the same pinned runtime as CI; do not weaken `scripts/security/check-runtime-policy.mjs`.

Basic setup:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm security:runtime-policy
pnpm security:github-actions-policy
pnpm release:readiness:validate
```

`release:readiness:validate` checks that the snapshot is truthful and internally consistent. The
normal `pnpm release:readiness` command is expected to exit non-zero while the verdict is `NO_GO`.

Useful local gates:

```powershell
pnpm web:test
pnpm research:test
pnpm research:build
pnpm auth-security:gate
pnpm medical-ai:synthetic-contract-gate
.\gradlew.bat test
```

The full PostgreSQL, ClamAV, container, browser, CodeQL, Trivy, Gitleaks, SBOM, and OpenTofu matrix
is defined in `.github/workflows/ci.yml`. Do not claim the complete matrix passed from a partial
local run.

## 8. How to make a change

1. Start from the current `origin/main` in a `codex/` branch or isolated worktree.
2. Read this guide, the relevant ADR/operation document, and the nearest `AGENTS.md`.
3. State the exact scope and which safety boundary it touches.
4. Add or update a failing test for behavioral work.
5. Implement the smallest coherent change.
6. Run proportionate local checks with the pinned toolchain.
7. Update evidence documents; do not convert intent into a PASS claim.
8. Inspect the diff for secrets, real data, generated artifacts, and unrelated user changes.
9. Push a reviewable commit and require green CI.
10. Stop at any external, destructive, legal, PHI, provider, or release gate that needs new authority.

For user-facing Korean copy, prefer direct, plain, respectful Korean. Do not imply certainty,
clinical judgment, or automatic interpretation.

## 9. Release ladder

The safe order from here is:

1. Resolve the public-GHCR stop-ship with a founder-approved private-ECR migration (recommended),
   PAT-based private republish, or an explicit accept-public decision; then protect `main`
   (required PR and CI, no force-push). See the roadmap, Track B.
2. Add production S3/SQS runtime adapters and the hosted network boundary.
3. Obtain only the non-secret identifiers needed for a reviewed AWS account-backed OpenTofu plan.
4. Review the plan; authorize apply separately.
5. Deploy synthetic-only staging with TLS, workload identity, managed secrets, observability, and
   hosted denial probes.
6. Exercise backup/restore, deletion replay, external audit anchoring, and hosted research-runtime
   denial.
7. Complete 400% zoom and real screen-reader checks.
8. Re-evaluate `release/readiness.json`. Hosted synthetic staging remains blocked until every
   blocking gate is PASS.
9. Only after legal/privacy/MFDS review and separate founder authorization, prepare provider
   sandbox adapters. Real PHI activation remains a later independent decision.

## 10. Founder-only or external inputs

Not needed for ordinary product work:

- real health data;
- Kakao/Naver client secrets;
- MyHealthWay credentials or certificates;
- AWS access keys;
- model-provider API keys.

Needed only at the corresponding gate:

- explicit decision for deletion/republication of the three public GHCR packages;
- dedicated AWS non-production account ID;
- same-account GitHub OIDC provider ARN;
- separately bootstrapped private Seoul state bucket and lock policy;
- later, provider application metadata, approved callbacks, contract receipts, and Secret Manager
  coordinates—never secret values in chat or Git.

See `docs/operations/founder-real-data-and-provider-activation.md` for the complete future checklist.

## 11. Where to go next

- Agent operating contract: [`AGENTS.md`](AGENTS.md); project skills in `.claude/skills/`; agent roles in `.claude/agents/`
- Independent review and critique: [`docs/reviews/2026-09-02-project-review.md`](docs/reviews/2026-09-02-project-review.md)
- Reviewed roadmap (sequencing authority): [`docs/roadmap/2026-09-02-roadmap.md`](docs/roadmap/2026-09-02-roadmap.md)
- Current wave spec: [`docs/superpowers/specs/2026-09-02-mvp-multi-candidate-and-agent-os-design.md`](docs/superpowers/specs/2026-09-02-mvp-multi-candidate-and-agent-os-design.md)
- Reusable takeover/audit prompt: [`SANITY_CHECK_PROMPT.md`](SANITY_CHECK_PROMPT.md)
- Latest sanity report: [`docs/status/2026-09-02/sanity-check.md`](docs/status/2026-09-02/sanity-check.md)
- Machine release truth: [`release/readiness.json`](release/readiness.json)
- Release explanation: [`docs/release/readiness.md`](docs/release/readiness.md)
- Architecture decision: [`docs/architecture/ADR-001-application-trust-boundary.md`](docs/architecture/ADR-001-application-trust-boundary.md)
- Runtime publication: [`docs/operations/attested-runtime-registry.md`](docs/operations/attested-runtime-registry.md)
- Synthetic AWS foundation: [`docs/operations/synthetic-staging-foundation.md`](docs/operations/synthetic-staging-foundation.md)
- Founder/provider checklist: [`docs/operations/founder-real-data-and-provider-activation.md`](docs/operations/founder-real-data-and-provider-activation.md)
- Approved program design: [`docs/superpowers/specs/2026-08-08-genome-companion-program-design.md`](docs/superpowers/specs/2026-08-08-genome-companion-program-design.md)

This repository and its documentation are not medical advice or a formal legal opinion.
