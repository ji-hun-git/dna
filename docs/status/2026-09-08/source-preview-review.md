# Source preview review correction

## Evidence date and revision

2026-09-08, Asia/Seoul. Reviewed product base: `4157a4eef798b9222bbc5904fdd38e9227cb1aea`.
Results below apply to the accompanying source-preview correction.

## Executive result

Fixed a confirmed review-flow defect: confirmation and correction were enabled
before the source image loaded, including immediately after retrying a failed load.
Hosted release remains NO_GO. This targeted review is not a GitHub approval.

## Evidence

Two new `candidate-review.test.tsx` regressions failed on the reviewed base with
`Received element is not disabled`. After the correction, the complete web suite
passed: 37 files, 158 tests. Node 24.20.0 and pnpm 11.20.0 were invoked explicitly
from the cached npm runtime; the desktop's default pnpm wrapper uses older versions.

```text
pnpm --dir apps/web test
Test Files 37 passed (37)
Tests 158 passed (158)
pnpm --dir apps/web build
Compiled successfully; TypeScript and static generation completed
node scripts/security/check-runtime-policy.mjs
runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3
node apps/web/scripts/check-auth-security.mts
auth-security-gate: PASS
node scripts/release/check-readiness.mjs --validate-only
release-readiness: NO_GO 12 blocking gate(s) are not PASS
git diff --check
exit 0
```

The build and tests exited zero. Runtime/browser lifecycle on the new remote head
must be checked in CI; it was not rerun against a local database this turn.

## Findings

- P2: The former guard checked only URL presence and a prior error. A slow request
  left confirmation enabled before any source was available. Retry also immediately
  re-enabled confirmation. Both are now blocked until the image load event.
- Source changes clear the loaded/error state, while candidates sharing the same
  loaded source retain it. Exclusion remains available without a source image.

## Readiness interpretation

This proves the loading-state contract, not that a person inspected the image,
clinical validity, actual screen-reader usability, or hosted readiness. No release
gate was changed.

## Changes made

CandidateReview tracks source readiness and guards both confirmation paths.
Component tests reproduce initial-load and retry failures; integrated tests model
successful image loading before making source-confirmation decisions.

## Next safe sequence

Require green CI on the updated PR #5 and independent approval. PR #6 separately
carries the Tomcat dependency fix so its planning baseline can be reviewed.
N1 storage implementation remains dependent on reviewed and merged product code.

## Founder-only actions

Independent reviewer approval is still required by protected main. No external
account or secret is needed for these corrections.
