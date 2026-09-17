# Visit preparation read recovery

## Evidence date and revision

2026-09-08, Asia/Seoul. Base `8184992b1d0e2d3b49561d9250291cb5126b04e2`,
`codex/unified-health-product`; local checks apply to the accompanying diff.

## Executive result

Temporary read failures on `/prepare` now offer an explicit in-place retry instead
of always asking for sign-in. Every attempt checks the server session first. Session
expiry from either endpoint still asks for sign-in. Questions and the app's print
button remain absent while loading or failed; a failed read is not an empty history.
No write replay, new endpoint, automatic retry, auth policy, font or CSS change.

## Live evidence table

| Evidence | Observed result |
|---|---|
| Exact base CI | [34190555224](https://github.com/ji-hun-git/dna/actions/runs/34190555224) and [34190552557](https://github.com/ji-hun-git/dna/actions/runs/34190552557) succeeded; not CI evidence for this new diff |
| PR #5 | OPEN / REVIEW_REQUIRED at inspection; not merged |
| Test-first | Visit suite: 2 failed / 7 passed before implementation; wrong sign-in link and missing retry reproduced |
| Web suite | 37 files / 168 tests passed |
| Build | Next 16.3.3 compiled; TypeScript complete; 9/9 static pages |
| Browser | 3 passed (1.6m): injected outage/recovery, durable synthetic lifecycle and both equivalent-viewport keyboard workflows |
| Policy | Runtime, auth-security and readiness validation exited 0; NO_GO remains, 12 blocking gates not PASS |

Commands with pinned Node 24.20.0 / pnpm 11.20.0 / Java 21:

```text
apps/web: node node_modules/vitest/vitest.mjs run tests/visit-preparation.test.tsx --maxWorkers=2
Tests 2 failed | 7 passed (9) -- red phase
apps/web: node node_modules/vitest/vitest.mjs run --maxWorkers=2
Test Files 37 passed (37); Tests 168 passed (168)
apps/web: node node_modules/next/dist/bin/next build
Compiled successfully; Finished TypeScript; static pages 9/9
root: node scripts/security/check-runtime-policy.mjs
runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3
root: node apps/web/scripts/check-auth-security.mts
auth-security-gate: PASS
root: node scripts/release/check-readiness.mjs --validate-only
release-readiness: NO_GO 12 blocking gate(s) are not PASS; exit 0
apps/web: node node_modules/@playwright/test/cli.js test --config playwright.foundation.config.ts
3 passed (1.6m)
```

The generated-example browser run used the disposable loopback PostgreSQL database
and existing synthetic scanner substitute. Test servers and PostgreSQL were stopped
afterward; generated Next development type-path changes were restored. No generated
document or screenshot binary is committed.

## Findings ranked

- P2, fixed: transient visit-sheet reads incorrectly prompted login with no in-place
  recovery. Regression also checks expiry during retry prevents another records GET.
- Design remains open: the user explicitly requested further revision and deferred
  visual work. The reference-design document now records that it is not final approval.

## Readiness interpretation

Synthetic-only local evidence. No hosted, PHI, provider, native-device, clinical,
actual-zoom or screen-reader gate changed. Existing unapproved runtime artifacts
remain stop-ship. Successful local tests do not resolve independent review.

## Changes made

Updated `VisitPreparation.tsx`, its unit suite, and the existing browser lifecycle.
The browser regression holds a 503 outage until the error is visible, removes it,
then requires the user-triggered retry to load real loopback Spring records.
Unit tests also cover expiry after session lookup and hiding stale supplied values.
Recorded the user's deferred design revision without changing visual styles.

## Next safe sequence

Obtain independent review and merge the reviewed baseline before the planned N1
storage-port/concurrent-write slice. Then implement version-aware S3 and outbox/SQS
contracts under their existing review gates. Design revision remains separate open
work, not declared finished by this reliability correction.

## Founder-only actions

Independent PR review is the current external dependency. API keys and real result
files are not needed. Later AWS plan identifiers and apply/publish/deploy approvals
remain separate, as do provider and real-data authorization.
