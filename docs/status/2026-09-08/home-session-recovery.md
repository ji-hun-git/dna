# Home restoration without replacement demo bootstrap

## Evidence date and revision

2026-09-08, Asia/Seoul. Base `00c421de857de1c8d1c335ebc1a63e3b21b73c91`,
`codex/unified-health-product`; local checks apply to this accompanying diff.

## Executive result

Home initialization no longer treats an unavailable session/record/candidate read as
an invitation to create a new demo identity. A separate presentation-only restore-error
state offers a read retry. It does not authorize access: Spring still decides whether
the session is authenticated. Explicit unauthenticated/expired responses retain the
existing entry path and its non-recoverable demo limitation.

If bootstrap succeeds but the subsequent read fails, retry checks the current session
instead of repeating the bootstrap POST. Even an ambiguous failed bootstrap response
goes through a session read before another new-demo action is offered.

## Live evidence table

| Evidence | Observed result / limit |
|---|---|
| PR #5 at inspection | OPEN / REVIEW_REQUIRED at the exact base above |
| Base CI | [34191514177](https://github.com/ji-hun-git/dna/actions/runs/34191514177) and [34191518629](https://github.com/ji-hun-git/dna/actions/runs/34191518629) completed successfully during this work; not new-diff evidence |
| First red run | Integrated review suite: 3 failed / 11 passed; three read failures exposed the new-demo button |
| Full web suite | 37 files / 173 tests passed |
| Production build | Next 16.3.3 compiled, TypeScript completed, 9/9 static pages |
| Browser | 3 passed (1.6m), including the same-session outage recovery and both equivalent-viewport keyboard workflows |
| Policy | Runtime, auth-security and readiness validation exit 0; NO_GO, 12 blocking gates not PASS |

Commands use pinned Node 24.20.0, pnpm 11.20.0 and Java 21:

```text
apps/web: node node_modules/vitest/vitest.mjs run tests/integrated-review-loop.test.tsx --maxWorkers=2
Tests 3 failed | 11 passed (14) -- red phase
apps/web: node node_modules/vitest/vitest.mjs run --maxWorkers=2
Test Files 37 passed (37); Tests 173 passed (173)
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

The 390px restore-error capture was visually inspected; the recovery action and full
error text were visible. This is a browser capture, not physical-device testing.
Loopback test servers and disposable PostgreSQL were stopped afterward. Generated
Next development type paths were restored; no document/image binary is committed.

## Findings ranked

- P1, fixed for restoration: `FoundationLifecycleService.bootstrapDemo` generates a
  new synthetic subject and the controller issues new cookies. Presenting that action
  after an unrelated read outage could disconnect the browser from its existing demo
  history. The original records are not thereby proven deleted; the problem is lost
  access from the replacement session.
- Still open: genuine session expiry/cookie loss remains non-recoverable. This change
  is transient read recovery, not account recovery or extended session lifetime.

## Readiness interpretation

No backend authorization, cookie, storage, PHI, provider, hosted or release gate changed.
Synthetic scanner responses in local browser tests are not hosted malware-feed evidence.
The design remains explicitly unapproved and deferred; no stylesheet or font changed.

## Changes made

Updated the integrated home presentation and five unit cases: failures in three reads,
successful bootstrap followed by read failure, and explicit session expiry. Added a
browser outage/recovery step that compares the server session before/after recovery and
continues the existing two-document persisted lifecycle. No new data fixture bytes.

## Next safe sequence

Review the exact-head PR and CI, then reconcile the independently reviewed merged
baseline before N1 storage-port/concurrent-write implementation. Continue existing
S3/SQS and private synthetic staging gates in order; do not bypass review to proceed.

## Founder-only actions

Independent PR review remains needed. No API key or real result is needed for this
maintenance. AWS plan identifiers, publication, deployment and real-data activation
remain separate future gates. Current work does not grant those approvals.
