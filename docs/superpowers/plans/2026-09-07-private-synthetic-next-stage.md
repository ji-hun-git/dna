# Next stage: private synthetic staging and observed product validation

Date: 2026-09-07 (Asia/Seoul). Status: **planning initiated; N1 implementation not started**.
2026-09-08 maintenance: this branch also carries the existing Tomcat 10.1.59 fix
and loaded-runtime regression from PR #5 to address its own failing CI baseline.
This does not incorporate the product rebuild or satisfy N0 review.
Target: `HOSTED_SYNTHETIC_STAGING`. Release remains **NO_GO**.

## 1. Outcome and authority

Build the operational boundary around the source-backed record journey, while validating
whether people can actually use it. Preserve the current four-route frame and visual system.
Do not start another redesign, general-purpose agent framework, or live medical model integration.

This is a task-level supplement to the [roadmap](../../roadmap/2026-09-02-roadmap.md),
not a replacement for the [project guide](../../../PROJECT_GUIDE.md), accepted governance,
or the [release gates](../../../release/readiness.json). Proposed architecture below needs
review before implementation. Planning does not authorize AWS access, provisioning, publication,
deployment, package deletion, external accounts, participant recruitment, or PHI processing.

Original planning scope: planning Markdown and index links only. It describes future storage,
queue, privacy and release boundaries without changing any of them. No behavioral test is
applicable to this documentation change; every implementation slice below names its first test.

## 2. Exact starting point

| Item | Evidence / limit |
|---|---|
| Planning branch base | `origin/main` at `4210af750aeb826635f58fb72d776e52652b044b` |
| Product dependency | [PR #5](https://github.com/ji-hun-git/dna/pull/5), head `4157a4eef798b9222bbc5904fdd38e9227cb1aea`; OPEN, REVIEW_REQUIRED at this review |
| Product CI | [Run 34091779577](https://github.com/ji-hun-git/dna/actions/runs/34091779577): seven required jobs succeeded at that head; not approval or deployment |
| Product detail | [Rebuild ledger at that revision](https://github.com/ji-hun-git/dna/blob/4157a4eef798b9222bbc5904fdd38e9227cb1aea/docs/revision/ASTRA_PRODUCT_REBUILD.md) |
| Cloud baseline | [Unapplied foundation](../../operations/synthetic-staging-foundation.md); no account-backed plan or apply evidence |
| Runtime storage | Concrete `FoundationDocumentStorage` uses filesystem zones; not an interchangeable S3 adapter yet |
| Runtime jobs | Spring/PostgreSQL leases and worker HTTP boundary; not an SQS runtime |
| Extraction | Fixed digest-selected synthetic candidates, not a real document parser or OCR accuracy result |
| Identity | PR #5 synthetic bootstrap is bounded and session-scoped; no account recovery or months-later return proof |

This plan is deliberately on a separate branch from PR #5. Do not duplicate its code or
discard it. Merge this plan and PR #5 only through independent review and green required CI.
Reconcile the final merged SHA before starting dependent implementation. A newer commit or
failed scan supersedes the evidence above; old published images remain stop-ship.

## 3. Execution board

Owners below are responsibilities, not claims that people or agents have been assigned.

| Order | Slice / owner | Dependency | Current state |
|---|---|---|---|
| N0 | Reconcile reviewed baseline / maintainer | Independent PR review | Waiting for PR #5 review; plan can be reviewed separately |
| N1 | Storage contract and local parity / backend | N0 | Next local implementation slice |
| N2 | S3 adapter and version-aware deletion / backend | N1, reviewed boundary decision | Planned; no AWS call required for local contracts |
| N3 | Durable outbox and SQS transport / backend | N1, reviewed queue contract | Planned; local/CI synthetic tests first |
| N4 | Hosted topology and publication design / platform + security reviewer | N2/N3 contracts | Planned, inert code only after review |
| N5 | Account-backed plan and private registry proof / founder + platform | N2–N4, non-secret inputs | External gate; separate plan/apply/publish approvals |
| N6 | Private hosted synthetic lifecycle / platform | N5, deployed-boundary approval | External gate |
| N7 | Recovery, deletion replay, audit and isolation / platform + independent reviewer | N6 | Planned; no release without runtime evidence |
| U1 | Actual zoom, screen reader and observed tasks / product + accessibility reviewer | PR #5 available locally | Can proceed independently of AWS after its review |
| N8 | Release evidence review / founder + named reviewers | N7 + U1 + all remaining blocking gates | NO_GO until every required gate has evidence |

Do not turn this ordering into a release date. External approvals and failed probes determine
the schedule. Each slice is one reviewable PR; split further if it cannot be reviewed coherently.

## 4. N0–N1: first local development package

Re-read the nearest `AGENTS.md`, safe-change and readiness skills, and ADR-001. After PR #5
lands, branch from the then-current `origin/main`; do not merge it yourself to unblock work.

Files to inspect: `FoundationDocumentStorage.kt`, `FoundationDocumentStorageTest.kt`,
`DocumentWorkerBoundary.kt`, their repository callers under `apps/core-api`, and
`packages/document-boundary/.../DocumentBoundaryContracts.kt`.

First red test: concurrent different-byte writes to the same object key must never overwrite
the winner or return success for the loser. Add a shared storage contract suite covering
identical replay, exact source digest, preview validation, invalid keys, missing objects and
idempotent deletion. Record current failures honestly before refactoring.

Extract a narrow storage port and retain a local implementation behind it. Keep Spring's
owner/consent/state checks and existing HTTP response behavior intact. Preserve the synthetic
digest allowlist. Fail startup for an unknown storage mode; never fall back from a failed hosted
mode to local disk. Do not add an AWS SDK or cloud calls in N1.

Exit: existing JVM tests plus the contract suite and browser lifecycle pass on the reviewed
product baseline. No Next API routes, database credentials in the worker, or new user-facing
claims. Rollback: revert the port refactor; N1 must not require a schema migration.

## 5. N2: exact-version S3 storage and deletion

Proposed contract, not implemented: keep object zone, key, provider version ID, byte length
and content SHA-256 distinct. The current locally generated `version` is not an S3 version ID.
Use a new Flyway migration if durable version metadata is required; do not rewrite shipped SQL.

First red tests: simultaneous writes cannot replace accepted bytes; a source version changed
between inspection and promotion cannot be admitted; a forged digest fails closed; partial
deletion failure cannot produce a completed deletion receipt.

Implement bounded reads/writes, exact-version retrieval, immutable destination semantics,
explicit checksums and fail-closed timeouts. Reuse safe-PNG validation. Preserve authorization
in Spring; object metadata supplied by a worker or browser is not authority. Avoid browser
access to untrusted PDFs or generic presigned bucket access.

Deletion must account for current and noncurrent source/preview versions, retries, in-flight
jobs, and orphaned writes. Tombstones prevent delayed upload/promotion from recreating deleted
records. Do not describe a delete marker or eventual lifecycle expiry as verified erasure.
Define a narrow deletion identity and reconciliation policy before widening IAM: the current
core policy lacks version deletion/listing permissions. Retention exceptions remain explicit.

Use fake-client contract and local integration tests first; label emulator limitations.
Live wrong-key/KMS/zone/version denial and version-erasure probes belong to N6/N7.
Rollback: stop intake/processing, retain tombstones, roll back only compatible code; never
silently switch an existing hosted dataset to filesystem mode or delete infrastructure.

AWS documents conditional writes and their version/delete-marker behavior; these controls
support, but do not replace, the application tombstone and exact-byte checks.
[S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html).

## 6. N3: queue transport without a second source of truth

Proposed design: PostgreSQL remains authoritative for lifecycle, consent, ownership, attempts,
lease expiry and completion. Commit a minimal outbox notification in the same transaction as
job creation. Publish only committed rows, retry with bounds, and reconcile stranded work.
The SQS message contains a schema version and opaque job/event IDs, not document bytes,
extracted values, credentials, capability URLs or a reusable lease token.

Keep the current mediated worker path: the worker requests an exact job lease from Spring,
then obtains only the leased bytes via the authenticated boundary. SQS delivery alone grants
no access. Add a job-specific lease operation rather than consuming one message while leasing
an unrelated job. Remove unused broad source-bucket/preview permissions from the proposed
worker role after review; its current bucket-wide grants cannot prove per-job isolation.

First red tests: crash after DB commit/before send; crash after send/before outbox acknowledgement;
duplicate and out-of-order delivery; competing workers; expired/revoked/deleted ownership;
completion persisted but queue acknowledgement lost; poison or oversized messages.

Exactly one canonical completion must survive retries; do not claim exactly-once delivery.
Document when to acknowledge, renew visibility and stop retrying. Reconcile SQS redrive limits
with DB attempts and lease TTL; the current 180-second visibility / three receives are not a
validated runtime timing policy. Queue outages must leave pending work recoverable and visible.
Worker still receives no database credential. DLQ inspection/redrive requires a scoped operator.

Exit: fault-injection contracts plus PostgreSQL concurrency tests; N6 adds real SQS evidence.
Rollback: pause consumers/publisher, keep outbox rows and jobs, then resume a reviewed compatible
transport without creating two unsynchronized lease authorities.
[AWS outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
and [SQS delivery contract](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html).

## 7. N4–N6: reviewed infrastructure to private hosted proof

N4 produces a reviewed topology ADR, inert IaC, tests and runbook, not a running service.
Cover Seoul VPC/subnets, ingress TLS and exact origin, private core/worker/database, controlled
egress and AWS endpoints, task versus execution roles, managed secret injection/rotation,
payload-free logs/alerts, separate state/backup/anchor permissions, and independently isolated
research runtime. Inspect existing `infra/modules/synthetic-staging` rather than duplicate it.
Define a controlled ClamAV signature-update path and freshness failure policy; do not grant
arbitrary worker internet access to make updates work.

Preserve Spring session/CSRF authority at the proxy. Hosted synthetic entry must be restricted
to approved testers, retain synthetic-only intake, and have bounded resource consumption and
a stop switch. Do not place reusable access secrets in browser code or query strings.

Publication design: build fresh reviewed images, scan them, generate and verify provenance
and SBOM against the exact source/workflow/digest, and prove authenticated pull plus anonymous
manifest/layer denial. Test the chosen signature/attestation transport on private ECR; do not
assume the existing GHCR attestation workflow transfers unchanged. Denial evidence needs an
authenticated positive control so a network failure cannot masquerade as privacy.
[ECR authentication](https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html).

N5 starts only with the [founder input checklist](../../operations/2026-09-07-next-stage-founder-inputs.md)
and explicit permission to use the approved short-lived identity. Capture the account, region,
commit, plan hash, reviewer and resource/cost inventory. Protect plan/state artifacts; do not
commit their raw contents. No apply during plan review. Apply, registry publication and hosted
deployment require their own named authorization. Keep GHCR publication paused; no old-image
promotion and no package cleanup inferred from this plan.

N6 evidence: authorized tester completes both synthetic documents through TLS; session,
CSRF/proxy/origin behavior is correct; unauthorized callers and unrelated worker jobs/objects
are denied; research identity cannot reach the health plane; scanner feed is operational;
alerts deliver without payloads. Record deployed digests and exact probe outputs securely.
On failure, stop new intake and quarantine work; revert to a previously verified digest only
when migration-compatible. If none exists, keep the service unavailable. No blanket destroy.

## 8. N7 and U1: prove recovery and usefulness

Recovery tests must restore into an isolated environment, replay tombstones newer than the
backup before serving requests, and prove deleted records/source versions are not resurrected.
Reconcile unfinished jobs and object versions. Exercise separately permissioned external audit
checkpoints, failed-write alerts and mismatch detection. Define RPO/RTO targets with the owner
before the exercise; report measured results rather than inventing achieved targets.

U1 preserves the current frame. First verify actual browser 200%/400% zoom, keyboard-only review,
focus after dialogs and validation errors, and a real screen reader through consent, source
review, correction, records, questions and deletion. Viewport reflow and axe are not substitutes.
Record browser/OS/assistive-tech versions and defects. Fix observed blockers with regression tests.

Proposed initial observed study: five participants, generated examples only, no real documents
or health details. Recruitment/recording needs a separate consented arrangement. Ask each to
confirm/correct/exclude, reopen the source, compare dates, find three questions and explain the
app's limits. Record task completion, assistance, errors, source recall and mistaken clinical
interpretations without external analytics. Any critical access/deletion misunderstanding or
clinical-certainty interpretation blocks the pilot until addressed and retested. Five sessions
are formative evidence, not market validation; prior positive interviews are not task results.

## 9. Definition of done and evidence mapping

| Package | Release gates it can supply evidence for, not automatically pass |
|---|---|
| N2 + N6 | `real_object_storage_trust_separation` |
| N3 + N6 | `hosted_queue_and_worker_isolation` |
| N5/N6 | `production_runtime_images_and_supply_chain`, `known_vulnerability_coverage` |
| N6 | `managed_secrets_and_workload_identity`, `hosted_observability_phi_safe`, `hosted_tls_proxy_and_browser_e2e` |
| N7 | `backup_restore_and_deletion_replay`, `external_audit_anchor`, `hosted_research_runtime_denial` |
| U1 | `accessibility_critical_workflow_smoke` |
| Independent external review | `privacy_regulatory_review`; code cannot satisfy it |

Re-run the entire readiness checker after evidence review, including existing PASS gates.
Store date, exact SHA/image digest, target, command, redacted result, reviewer and limitations
for each new claim. Neither this plan nor local CI changes a hosted gate. No readiness file is
modified by this planning package.

## 10. Deliberately next, but not in this wave

- Recoverable identity and account-link/recovery abuse cases before any long-term retention claim.
- Signed export with bounded archive verification and revocation/deletion semantics.
- Real parser/OCR evaluation on newly generated, rights-cleared test documents, with ground truth,
  abstention and source boxes; never silently replace the fixed-catalogue disclosure.
- Kakao/Naver identity, then formal MyHealthWay sandbox: independent privacy/intended-use and
  provider gates; identity consent does not grant health access. No secrets needed now.
- DataON/AIDA and public-data competition work stays in its separate runtime and reviewed plan;
  do not mix consumer records into research data or infer permission to submit externally.
- Clinical claims, real PHI, genetics, referrals, payments and autonomous clinical agents remain out.

## 11. Execution handoff

Use the [next-stage kickoff prompt](2026-09-07-next-stage-kickoff-prompt.md). The first code PR
is **N1 only**. Complete its red/green tests, review and evidence before growing scope.
For every code PR run `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, and the
area gates in AGENTS.md with pinned tools. Do not bypass a failing CI or independent review.

## 12. Planning-package validation

Local validation on 2026-09-07, using the pinned Node 24.20.0 binary from the workspace runtime:

```text
node scripts/security/check-runtime-policy.mjs
runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3

node scripts/release/check-readiness.mjs --validate-only
release-readiness: NO_GO 12 blocking gate(s) are not PASS
exit 0: valid snapshot, not release approval

git diff --check
exit 0: no whitespace errors

New plan Markdown relative links: PASS
```

This branch does not contain PR #5's runtime fixes or refreshed evidence documents yet.
No application tests were rerun locally for the original Markdown-only package. Its own CI result
must be checked on the planning PR; the product CI in section 2 is a different revision.
