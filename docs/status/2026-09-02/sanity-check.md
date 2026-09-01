# Current-project sanity check

**Evidence date:** 2026-09-02 (Asia/Seoul)
**Repository:** `ji-hun-git/dna`
**Audited main revision:** `937361c5ee995174bcce7648957a02b430bdf450`
**Release target:** `HOSTED_SYNTHETIC_STAGING`
**Verdict:** **NO_GO**

## Executive result

The repository is the correct Genome Companion Korea project. No `buup` or `corridor` project
contamination was found. The implementation is a production-shaped synthetic foundation, not a
planning-only repository, but hosted staging, AWS runtime resources, PHI processing, external
providers, and clinical AI remain unavailable.

Main CI and the first protected runtime publication both succeeded. The audit found one stop-ship:
all three GHCR packages accept anonymous pulls even though the approved operational intent was
private packages.

## Live evidence

| Evidence | Result |
|---|---|
| PR #1 | Merged as `937361c5ee995174bcce7648957a02b430bdf450` |
| Main CI | [33367429797](https://github.com/ji-hun-git/dna/actions/runs/33367429797), success |
| Protected publication | [33370021596](https://github.com/ji-hun-git/dna/actions/runs/33370021596), three of three jobs successful |
| Protected environment | Required reviewer `ji-hun-git`; `main` only; administrator bypass disabled |
| Web digest | `sha256:eab9f101a06acd92ff2307bedc57b96d5362d4020d8bcb6539ecadb44ac2d4e8` |
| Core API digest | `sha256:ee41c46e5417638a032be0006c95db17688c2635d68847cd7be9a024abdbe950` |
| Worker digest | `sha256:689180cae9c6ed3994ae7bbc49e04bb9d4c6392bb2a58138369b7dd3a30b6c2c` |
| Anonymous pull probe | HTTP 200 for every digest; packages are public |
| AWS account-backed plan/apply | Not performed |
| Hosted application deployment | Not performed |
| Provider or PHI activation | Disabled |

Evidence artifacts preserved by the publication run include each runtime's registry manifest,
CycloneDX SBOM, Cosign verification, and SLSA/SBOM attestation verification. Links are indexed in
the root `PROJECT_GUIDE.md`.

## Findings

### SC-001 — STOP-SHIP: runtime packages are public

The workflow and operations plan intended private GHCR packages. An unauthenticated token request
followed by a manifest HEAD request returned HTTP 200 for all three exact digests. GitHub's package
documentation states that once a package is public it cannot be changed back to private.

Impact is constrained because the source repository is already public, CI secret scanning passed,
the artifacts contain synthetic-only code, and no deployment or PHI occurred. It still violates the
explicit distribution policy and makes the current digests ineligible for deployment.

Required decision: explicitly authorize deletion and controlled private republishing under new or
reset package identities, or move the deployable artifact to the private AWS ECR boundary. Deletion
is destructive and was not performed during this audit.

### SC-002 — stale project-state documentation

`README.md`, `CLAUDE.md`, and several operations/readiness documents still described the repository
as planning-only or the publication workflow as unexecuted. This branch replaces the resumption
entry point with `PROJECT_GUIDE.md` and updates the active operations/release documents. Dated
2026-08-30 reports remain unchanged as historical evidence.

### SC-003 — local Node executable differs from repository policy

The repository pins Node `24.20.0`. The previously observed global Node was `22.23.1`, and the
bundled workspace runtime was `24.19.0`. CI used the exact pinned version and passed. Local release
commands must use `24.20.0`; the policy must not be weakened to match a workstation.

## Readiness interpretation

The machine snapshot remains `NO_GO`. Successful publication upgrades the evidence from “workflow
defined” to “digests signed and attested,” but the visibility failure prevents the runtime
supply-chain gate from becoming PASS. Hosted storage, hosted queue/worker isolation, managed
runtime identity, hosted observability, TLS/browser E2E, backup/restore, external audit anchoring,
hosted research denial, accessibility completion, and privacy/regulatory review remain open.

## Changes made by this audit

- Added a repository-wide human/agent guide at `PROJECT_GUIDE.md`.
- Added a reusable takeover prompt at `SANITY_CHECK_PROMPT.md`.
- Replaced stale resumption text and linked the new guide from the root README.
- Updated active release, registry, runtime-image, CI, architecture, and staging documentation.
- Updated `release/readiness.json` evidence without converting unproven hosted gates to PASS.

No application code, package visibility, package contents, AWS resource, provider account, secret,
deployment, or data-processing state was changed by this documentation audit.

## Next safe sequence

1. Obtain an explicit founder decision for the public-package stop-ship.
2. Apply the approved delete/republish or private-ECR remediation and verify anonymous pull denial.
3. Re-run exact digest signature, provenance, SBOM, and vulnerability verification.
4. Implement S3/SQS runtime adapters and the hosted network boundary.
5. Perform a reviewed AWS account-backed plan, followed by a separately approved apply.
6. Complete the remaining hosted synthetic-staging readiness gates before any provider or real-data
   work.
