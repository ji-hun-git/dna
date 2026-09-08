# App navigation refinement from the 사실로 reference

## Evidence date and revision

2026-09-08, Asia/Seoul. Base `915bf9477bbf8b9a8fdf5be55ff23c855ac9f175`,
`codex/unified-health-product`. Local results below apply to the accompanying diff,
not to a deployed service.

## Executive result

Kept the four routes, font stack, monochrome tokens, desktop frame and Spring-owned
state. Added original decorative line icons beside written navigation labels, a
56px mobile / 48px desktop minimum target height, and a clearer mobile brand/status
bar. A newly expanded 320px browser check caught an existing non-wrapping connection
notice; it now wraps without hiding its limitation. The reference project was read-only.

## Live evidence table

| Evidence | Result / limitation |
|---|---|
| Base CI | [34189476677](https://github.com/ji-hun-git/dna/actions/runs/34189476677) and [34189473338](https://github.com/ji-hun-git/dna/actions/runs/34189473338) succeeded at the exact base above; not CI evidence for this new diff |
| Independent review | PR [#5](https://github.com/ji-hun-git/dna/pull/5) and [#6](https://github.com/ji-hun-git/dna/pull/6) remained OPEN / REVIEW_REQUIRED at inspection |
| Test-first evidence | New shell regression failed because the base had no icons: 1 failed / 3 passed |
| Local web tests | 37 files / 163 tests passed |
| Production build | Next 16.3.3, TypeScript, 9/9 static pages passed after correcting a test-only unsupported Testing Library option |
| Browser | Final full local rerun: 3 passed (1.5m), including the seven-size matrix and 200/400-percent-equivalent keyboard workflows |
| Policy | Runtime policy, auth-security and readiness validation exited 0; NO_GO, 12 blocking gates not PASS |

Commands use pinned Node 24.20.0, pnpm 11.20.0 and Java 21:

```text
apps/web: node node_modules/vitest/vitest.mjs run tests/integrated-shell.test.tsx --maxWorkers=2
Test Files 1 failed (1); Tests 1 failed | 3 passed (4) -- red phase
apps/web: node node_modules/vitest/vitest.mjs run --maxWorkers=2
Test Files 37 passed (37); Tests 163 passed (163)
apps/web: node node_modules/next/dist/bin/next build
Compiled successfully; Finished TypeScript; static pages 9/9
root: node scripts/security/check-runtime-policy.mjs
runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3
root: node apps/web/scripts/check-auth-security.mts
auth-security-gate: PASS
root: node scripts/release/check-readiness.mjs --validate-only
release-readiness: NO_GO 12 blocking gate(s) are not PASS; exit 0
apps/web: node node_modules/@playwright/test/cli.js test --config playwright.foundation.config.ts
First run: 1 failed / 2 passed (1.6m); connections notice overflow at 320px
Final full rerun: 3 passed (1.5m)
```

The first production build rejected `exact` in a Testing Library `getByRole` call.
Removed that unsupported option; the supplied string name already matches exactly.
The browser failure was a real narrow-layout issue, not a timeout to increase: the
connection notice had `white-space: nowrap`. The original no-overflow assertion and
all seven viewport sizes remain. No broad overflow clipping or text truncation was added.

Visual inspection covered the new 390px and 1280px home, 390px records and the corrected
320px connection notice. The final run produced 57 PNG captures under the ignored
`apps/web/test-results/foundation-lifecycle-visib-2b75e-tes-the-synthetic-lifecycle/`.
The loopback test servers and disposable PostgreSQL were stopped afterward. Only the
generated Next development type-path changes were restored; no user data was removed.

## Findings ranked

- P2, fixed: the full connection limitation extended beyond a 320px viewport. It now
  wraps, while its icon cannot shrink into illegibility.
- Product improvement: written routes remain the accessible names, decorative SVGs
  cannot receive focus, and current location uses weight and surface as well as color.
- Still open: actual device safe-area behavior, browser zoom and screen-reader task
  checks, and observed usability. Screenshots and component axe checks do not settle them.

## Readiness interpretation

No gate changed. This is local synthetic browser evidence only, with the existing
synthetic scanner substitute. Not native-device qualification, medical-AI/OCR evidence,
account recovery, offline storage, a hosted staging pass or PHI authorization.

## Changes made by this work

- `IntegratedShell.tsx`: existing routes and labels, original 24px line drawings.
- `globals.css`: scoped navigation/header refinement and responsive notice wrapping.
- Shell unit test: decorative SVG contract and one current destination.
- Existing browser lifecycle: seven sizes (320–1920px), font-ready captures, icon/label
  bounds and target heights, and keyboard navigation through all four destinations.
- [Design rationale and next steps](../../reviews/2026-09-08-sasillo-design-direction.md).

No reference-project file, dependency, backend API, session rule, provider state,
registry or cloud infrastructure was changed. No screenshot/document binary is committed.

## Next safe sequence

Review this PR #5 maintenance diff and its exact-head CI. Obtain independent review
and reconcile the merged baseline before N1 storage-port/concurrent-write work.
N2 S3 exact-version storage/deletion and N3 outbox/SQS contracts follow that boundary.
Private ECR, hosted synthetic infrastructure and operational probes require the later
explicit approvals and runtime evidence. Do not merge or disable protection to unblock work.

## Founder-only actions

Arrange the independent PR review now. No API secret, real result, app-store account or
provider key is needed for this UI work. At the account-backed infrastructure-plan gate,
provide only non-secret AWS account/OIDC/state-bucket identifiers through the established
checklist. Plan, apply, publish and deploy approvals remain separate.
