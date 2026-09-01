# Project sanity-check initiation prompt

Copy the prompt below into a new engineering session. It is designed for a human reviewer or an AI
agent taking over Genome Companion Korea without inventing progress or crossing a safety gate.

```text
You are taking over the Genome Companion Korea repository at
https://github.com/ji-hun-git/dna.

Your first task is a current-state sanity check. Do not implement product features, deploy,
delete cloud resources, change external accounts, process real health data, or request secrets
until the audit is complete and the required authority is explicit.

Read, in order:
1. PROJECT_GUIDE.md
2. release/readiness.json
3. docs/release/readiness.md
4. docs/architecture/ADR-001-application-trust-boundary.md
5. docs/operations/attested-runtime-registry.md
6. docs/operations/synthetic-staging-foundation.md
7. the nearest AGENTS.md for any area you inspect

Then perform an evidence-first audit:

A. Identity and repository integrity
- Confirm the exact repository, branch, HEAD, origin/main, remotes, and worktree status.
- Search for contamination from unrelated projects, especially “buup” and “corridor”.
- Preserve all unrelated or pre-existing user changes.

B. Current GitHub state
- Inspect open PRs and the exact main-branch CI run for the current SHA.
- Count failed, pending, and successful checks; do not summarize a partial run as green.
- Inspect the synthetic-staging-registry environment: required reviewer, main-only branch policy,
  self-review setting, and administrator-bypass setting.

C. Runtime supply chain
- Find the latest publication run and its exact source SHA.
- Extract registry repository digests from the preserved evidence artifacts.
- Verify the recorded Cosign identity, SLSA provenance, CycloneDX SBOM attestation, and registry
  Critical/High vulnerability result for each runtime.
- Perform an anonymous pull probe for every GHCR digest. If a package intended to be private is
  anonymously pullable, report STOP-SHIP immediately. Do not delete or republish it without an
  explicit destructive-action approval.

D. Application and data boundaries
- Verify that Spring remains the session/authorization/consent/record authority and Next remains
  presentation/same-origin forwarding only.
- Verify the separate document-worker and research runtimes.
- Confirm that Kakao, Naver, MyHealthWay, NHIS/HIRA, real OCR/medical AI, diagnosis, and real-PHI
  paths remain disabled.
- Search for secrets, real medical files, new public routes, unsafe logs, or provider tokens.

E. Infrastructure truth
- Distinguish OpenTofu code/test evidence from account-backed plan, apply, and runtime evidence.
- Verify whether S3/SQS/ECS/RDS/TLS/WAF/DNS/backup/audit-anchor resources actually exist before
  claiming hosted staging.
- Never request or print AWS access keys. Use only short-lived approved identity when authorized.

F. Reproducibility and release truth
- Confirm Node 24.20.0, pnpm 11.20.0, Java 21, OpenTofu 1.10.6, and provider locks.
- Run the registered policy/readiness validators with the exact pinned runtime.
- Treat a valid NO_GO readiness document as truthful validation, not release approval.
- Compare README, resumption guides, operations docs, dated reports, and readiness evidence for
  contradictions. Dated docs are historical snapshots.

Hard boundaries:
- Synthetic fixtures and rights-reviewed public metadata only.
- No PHI, credentials, tokens, certificates, private keys, real PDFs/DICOM/CSV/DNA files, or
  secret values in chat, Git, issues, screenshots, or logs.
- AI/OCR output is candidate-only and requires explicit human confirmation.
- No diagnostic, normality, risk, treatment, medication, or autonomous clinical claim.
- No external mutation until the audit identifies the exact target, risk, rollback, and authority.
- A file, workflow, IaC resource, test, or UI is not proof that an external system is live.

Required output:
1. Executive verdict: correct project or mixed project; GO/NO_GO; current stage.
2. Evidence table with exact commit SHAs, run URLs, digests, attestation URLs, and dates.
3. PASS/PARTIAL/FAIL/DISABLED/EXTERNAL_GATE summary from release/readiness.json.
4. Contradictions or stale claims, with file and line references.
5. Security/privacy stop-ships ranked by urgency.
6. What changed during the audit, if anything.
7. The next safe engineering sequence.
8. A separate list of actions only the founder/external account owner can perform.

Lead with facts. Mark every inference. If evidence is missing, say “not verified”; do not guess.
```

## Short form

Use this when the full prompt has already been adopted by the team:

```text
Run the Genome Companion Korea sanity check from SANITY_CHECK_PROMPT.md. Start read-only,
validate PROJECT_GUIDE.md against live Git/GitHub/registry/readiness evidence, preserve the
synthetic-only and non-diagnostic boundaries, report contradictions before changing anything,
and finish with the exact next safe step and founder-only action list.
```
