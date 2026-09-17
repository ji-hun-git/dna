# Records read recovery and app-interface review

## Evidence date and revision

2026-09-08, Asia/Seoul. Base `dc417df3adac1569008f33e1056ff4aea22fc6df`,
`codex/unified-health-product`. Local results apply to the accompanying correction.

## Executive result

Records read failures now offer an in-place read retry instead of universally sending
the person home to sign in. An expired session still asks for sign-in. Correction writes
are not replayed by the new control. No backend authority, storage, session lifetime,
route structure or app installation behavior changed.

## Live evidence table

| Evidence | Result / limitation |
|---|---|
| Prior head CI | [Run 34188700687](https://github.com/ji-hun-git/dna/actions/runs/34188700687) succeeded for the base above; not evidence for this new diff |
| Red test | A one-time 503 read failure incorrectly displayed the sign-in link; new regression failed on the base |
| Local green | 37 web test files / 162 tests passed; includes read recovery and expired-session behavior |
| Build | Next 16.3.3 production build, TypeScript and 9/9 static pages passed |
| Final local browser run | Three scenarios passed in 1.4 minutes, including injected read outage and recovery against Spring/PostgreSQL |
| Policy checks | Runtime policy, auth-security and readiness schema validation passed; verdict remains NO_GO with 12 blocking gates not PASS |

The first browser attempt passed both equivalent-viewport keyboard scenarios but failed
the full lifecycle assertion because a global `role=alert` query also matched Next's
route announcer. The assertion was scoped to the app's `main` region; no application
behavior or success condition was weakened.
The second attempt rendered records rather than an error. A one-shot 503 can hit a
discarded development StrictMode read, leaving the active read successful. The test now holds the
read outage until the error is visible, removes the interception, then requires the
explicit retry to recover real server records. This avoids relying on request count.

Commands, with pinned Node 24.20.0:

```text
apps/web: node node_modules/vitest/vitest.mjs run tests/integrated-records-grouping.test.tsx --maxWorkers=2
Tests 1 failed | 7 passed (8) -- red phase
apps/web: node node_modules/vitest/vitest.mjs run --maxWorkers=2
Test Files 37 passed (37); Tests 162 passed (162)
apps/web: node node_modules/next/dist/bin/next build
Compiled successfully; TypeScript complete; static pages 9/9
root: node scripts/security/check-runtime-policy.mjs
runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3
root: node apps/web/scripts/check-auth-security.mts
auth-security-gate: PASS
root: node scripts/release/check-readiness.mjs --validate-only
release-readiness: NO_GO 12 blocking gate(s) are not PASS; exit 0
apps/web: node node_modules/@playwright/test/cli.js test --config playwright.foundation.config.ts
3 passed (1.4m) -- final run
```

The browser run used the existing disposable synthetic-only loopback PostgreSQL and
generated examples. Its database was stopped afterward. Generated Next development
type-path changes were restored; no generated document/image is committed. Browser
scanner responses remain synthetic substitutes, not hosted malware-feed evidence.

## Findings ranked

- P2: a transient read failure had no in-place recovery and incorrectly prompted a new
  login, particularly confusing in a non-recoverable synthetic demo session. Fixed with
  a user-triggered GET retry that rechecks the current server session.
- Product recommendation: app-centered mobile UX using the current web stack first;
  native delivery only after validated device-specific needs and separate architecture
  review. See the [app-interface comparison](../../reviews/2026-09-08-app-interface-direction.md).

## Readiness interpretation

No gate was upgraded. PWA installability, native devices, offline storage, actual zoom,
screen readers, hosted runtime and PHI remain unverified or disabled as applicable.

## Changes made

Updated `IntegratedRecords`, two component tests and the existing browser lifecycle
with a bounded 503 outage followed by recovery against the real local records endpoint.
Added the product-interface recommendation with official platform references.

## Next safe sequence

Check exact-head CI and obtain independent PR review. The next storage-port slice still
requires the merged baseline. A PWA/native migration was evaluated, not executed.

## Founder-only actions

No API key, app-store account, health data or new cloud input is needed for this change.
Independent review is still required; the later AWS and provider gates remain unchanged.
