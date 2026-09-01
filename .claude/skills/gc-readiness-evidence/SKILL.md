---
name: gc-readiness-evidence
description: Use when editing release/readiness.json, docs/release/readiness.md, docs/status/**, PROJECT_GUIDE.md status tables, or any sentence that claims something passed, is deployed, is private, is signed, or is verified.
---

# Readiness and evidence updates

## Overview

`release/readiness.json` is the machine truth for the release verdict. It is validated by `scripts/release/check-readiness.mjs` and must only move on runtime evidence from the named target. This skill is the difference between "the code exists" and "the gate passed".

## Evidence hierarchy (from the guide, section 4)

1. Live immutable evidence: exact commit SHA, GitHub run URL, registry digest, attestation URL, hosted denial probe output.
2. `release/readiness.json` validated by the checker.
3. `PROJECT_GUIDE.md` and current operations/architecture documents.
4. Accepted ADRs and governance decisions.
5. Dated `docs/status/<date>/` reports — history, never current truth.
6. Plans and proposals — intent only.

A dependency, UI mock, IaC resource, workflow file, test double, or passing unit test is not evidence that an external system is live.

## Editing `release/readiness.json`

- Change a gate's `status` only with a run URL, digest, or probe you can paste into `evidence`.
- Allowed statuses: `PASS`, `PARTIAL`, `FAIL`, `DISABLED`, `EXTERNAL_GATE`. Blocking gates stay blocking.
- Keep `evaluatedAt` as the date of the evidence review.
- Run `pnpm release:readiness:validate` (must exit 0) and `pnpm release:readiness` (expected non-zero while `NO_GO`). Paste both outputs into the report.
- Never edit the checker to make the file pass.

## Writing a dated status report

Path `docs/status/YYYY-MM-DD/<topic>.md`. Sections in order: evidence date and revision; executive result; live evidence table (SHA, run, digest, URL); findings ranked with IDs; readiness interpretation; changes made by this audit; next safe sequence; founder-only actions. Use "not verified" where evidence is missing. Do not restate the whole guide.

## Phrases to avoid

"should now be", "is effectively", "will pass once", "verified by design", "the workflow ensures". Replace each with the evidence or with "not verified".

## Quick check before reporting

- Every PASS sentence has a URL, SHA, digest, or probe next to it.
- Every hosted or real-data claim is `FAIL`, `DISABLED`, or `EXTERNAL_GATE` unless the hosted target produced the evidence.
- The guide's "Current truth at a glance" table matches the JSON.
