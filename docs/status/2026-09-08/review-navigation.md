# Review navigation regression correction

## Evidence date and revision

2026-09-08, Asia/Seoul. Product base `d96766fd4bdfef0f3fb580fc5c2d518314f1affd`,
branch `codex/unified-health-product`. Results below apply to the accompanying correction.

## Executive result

Fixed a reproducible navigation dead end: returning from candidate review to processing
left no direct resume action, and a second Back opened a replacement document picker.
Processing now offers resume when a pending candidate exists; Back returns home without
discarding the active document. Excluded/confirmed decisions and candidate position persist.
This is maintenance of the pending product PR, not execution of the merge-gated N1 plan.

## Live evidence

| Item | Evidence and limitation |
|---|---|
| PR #5 before this correction | [Run 34187649818](https://github.com/ji-hun-git/dna/actions/runs/34187649818), seven required jobs succeeded at the base above; still REVIEW_REQUIRED |
| PR #6 | Head `1757238ee8ddddec34eaafcf2ffeed1d9bb6e006`, [run 34187598816](https://github.com/ji-hun-git/dna/actions/runs/34187598816), seven required jobs succeeded; still REVIEW_REQUIRED |
| Red regression | Two new integrated review tests failed on the base: resume button absent; replacement picker unexpectedly present |
| Green regression | Complete local web suite: 37 files, 160 tests passed |
| Production build | Next 16.3.3 build, TypeScript and 9/9 static pages completed |
| Local browser lifecycle | Three Playwright scenarios passed (2.7 minutes): full two-document lifecycle with the new navigation regression, plus 200%/400%-equivalent keyboard viewports |

Commands used the pinned Node 24.20.0 binary (paths below relative to their named directory):

```text
apps/web: node node_modules/vitest/vitest.mjs run tests/integrated-review-loop.test.tsx --maxWorkers=2
Tests 2 failed | 8 passed (10) -- before correction

apps/web: node node_modules/vitest/vitest.mjs run --maxWorkers=2
Test Files 37 passed (37)
Tests 160 passed (160)

apps/web: node node_modules/next/dist/bin/next build
Compiled successfully; TypeScript complete; static pages 9/9

root: node scripts/security/check-runtime-policy.mjs
runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3
root: node apps/web/scripts/check-auth-security.mts
auth-security-gate: PASS
root: node scripts/release/check-readiness.mjs --validate-only
NO_GO 12 blocking gate(s) are not PASS; valid snapshot, exit 0

apps/web: node node_modules/@playwright/test/cli.js test --config playwright.foundation.config.ts
3 passed (2.7m)
```

Browser verification used disposable loopback PostgreSQL and the existing synthetic-only
scanner/test configuration. It does not prove live malware-feed operation, actual browser
zoom or screen-reader usability. The database was stopped after verification; the generated
Next development type-path change was restored and is not part of the commit.

## Findings

- P2: `REVIEW_REQUIRED` is not a pollable state. Navigating back to processing therefore
  could not automatically return the person to their pending review. An explicit resume
  action fixes this without changing server state or restarting extraction.
- P2: processing Back opened the source picker even with an active document. Returning
  home preserves the existing unfinished-document entry instead of inviting a new upload.

## Readiness interpretation

No release gate changed. No actual browser zoom, screen-reader, hosted storage/queue,
provider, medical-model or PHI readiness is claimed. CI at the new head must be checked
separately; the older green runs above do not verify this correction.

## Changes made

Two component-navigation changes, two integration regressions, and a browser regression
that leaves/re-enters review after the first correction, retaining position 2/3.
Existing generated examples are reused unchanged; no new data, dependencies or API routes.

## Next safe sequence

Verify the new PR #5 head in CI and obtain independent review of both PRs. N1 storage
port/concurrency work remains dependent on the reviewed, merged baseline. No self-approval,
merge, or branch-protection bypass was attempted.

## Founder-only actions

Independent PR approval is the immediate dependency. AWS non-production account ID,
same-account OIDC provider ARN and private Seoul state-bucket details are needed only
at the later account-backed plan gate. No keys, real documents or provider secrets needed now.
