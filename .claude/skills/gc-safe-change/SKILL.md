---
name: gc-safe-change
description: Use when about to edit code, config, workflows, infra, or docs in the Genome Companion Korea repository, or when a task mentions deploy, publish, delete, registry, AWS, provider, PHI, real data, diagnosis, or release.
---

# Safe change protocol

## Overview

Every change in this repository is a synthetic-only change until a founder gate says otherwise. The protocol below is the contract from `PROJECT_GUIDE.md` section 8 with the checks that agents skip most often made explicit.

**Violating the letter of a boundary is violating the boundary.** "It is only a demo", "the data is obviously fake", and "the workflow already exists" are not exemptions.

## Before the first edit

1. `git status` is clean and you are on a `codex/<topic>` branch from `origin/main`.
2. Write one sentence: scope, files, and which boundary (guide section 6, items 1–10) the change touches. If the answer is "a hosted, registry, AWS, provider, deletion, real-data, or clinical boundary", stop and report the founder gate instead of editing.
3. Name the failing test you will write first.

## While editing

| Area | Rule |
|---|---|
| Spring (`apps/core-api`) | New routes only under `/api/foundation/**` or an ADR-approved prefix. Keep owner + consent checks in the service, not the controller. Flyway: new `V<n>__` file, never edit a shipped migration. |
| Next.js (`apps/web`) | No route handlers except `/healthz`. No auth logic, no provider tokens. Server state via `lib/foundation/client.ts` with Zod validation. Copy rules: load `gc-korean-copy`. |
| Worker (`apps/document-worker`) | No database credentials. Verify exact leased bytes. |
| Fixtures | Load `gc-synthetic-fixture` before adding any file, digest, or value. |
| Evidence documents | Load `gc-readiness-evidence` before touching `release/readiness.json` or `docs/status/**`. |
| Workflows | Pin actions by SHA; no new secrets; run `pnpm security:github-actions-policy`. |

## Before reporting

Run the gates for the area (see `AGENTS.md`), with Node `24.20.0`, pnpm `11.20.0`, Java `21`. Paste the exact command and the last lines of output into your report. Then inspect the diff for: secrets, real-looking names or identifiers, PDFs or binaries, generated files (`dist/`, `build/`, `.next/`), and edits outside your scope.

## Red flags — stop and re-read the boundary

- "I will mark the gate PASS since the code exists now"
- "The test needs Docker so I will skip writing it"
- "The demo copy can say 정상 because it is synthetic"
- "I will push straight to main to save time"
- "The workflow file proves the registry is private"

## Rationalizations

| Excuse | Reality |
|---|---|
| "It is a docs-only change" | Docs are evidence. A wrong PASS claim is a release defect. |
| "CI will catch it" | CI proves the stated contract only. It does not review intent or copy. |
| "The founder already approved the plan" | A plan approval is not authority to deploy, publish, delete, or process data. |
