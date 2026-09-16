# Wave 1 evidence — /my-data living cells (2026-09-16)

Branch `codex/wave3-my-data-living-cells` on top of PR #5 head. Synthetic only. Release remains NO_GO; no gate changes.

## What exists now
- `GET /api/foundation/health-events`: owner-scoped projection of CURRENT record versions. Fields: eventId, recordId, domain(lab), concept, value, unit, observedOn, verification(verified|uncertain), corrected, confirmedAt, source{documentId,page,documentSha256,sourceTextSha256,previewAvailable}. No reference range, no direction.
- `/my-data`: one SVG rect per event, month ticks, exact concept search, evidence drawer reusing the approved PNG preview, table equivalent, two-destination navigation.

## Evidence
| Gate | Result |
|---|---|
| runtime-policy | `runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3` |
| readiness validate | exit 0; `release-readiness: NO_GO 12 blocking gate(s) are not PASS` (unchanged verdict, no gate results modified by this task) |
| web:test | 42 files passed (42), 203 tests passed (203) |
| web build | Next.js 16.3.3 (Turbopack) build succeeded; route list includes `○ /my-data` alongside `/`, `/connections`, `/data-control`, `/healthz`, `/prepare`, `/providers`, `/records` |
| auth-security gate | `auth-security-gate: PASS` |
| gradlew test (embedded PostgreSQL) | 102 tests, 3 skipped, 0 failures, 0 errors (aggregated from all `build/test-results/test/*.xml`; `cleanTest test --no-daemon` against `jdbc:postgresql://127.0.0.1:5432/gc_test`) |
| foundation:e2e | 3/3 scenarios passed in 1.2m (Task 10 report: `foundation-lifecycle.spec.ts` visible/persist/revoke/delete lifecycle plus 200%/400%-equivalent keyboard-operable viewports); six-viewport screenshots (320x720–1920x1080) under `apps/web/test-results/foundation-lifecycle-visib-2b75e-tes-the-synthetic-lifecycle/` |

## Limits
No hosted run, no real screen reader, no real browser zoom, no user research. The `uncertain` state reflects preview availability only; it is not an extraction-accuracy claim.

## CI evidence (2026-09-16, later the same day)

- PR #7 head `15cda78`: [run 35077628831](https://github.com/ji-hun-git/dna/actions/runs/35077628831) passed all required jobs, including the browser-to-Spring-to-worker lifecycle with the `/my-data` step at seven viewports.
- Base PR #5 head `89a8b73`: [run 35075564272](https://github.com/ji-hun-git/dna/actions/runs/35075564272) passed after two remediations that were not caused by either PR: `sharp` pinned to 0.35.4 via a `pnpm-workspace.yaml` override (GHSA-rgj7-g3m4-5g8c) and Debian security updates applied in the web runtime image (libpcre2 CVE-2026-86145; the pinned node base image predates the fix).
- Three CI-only failures on `/my-data` at 320px were real layout defects invisible on Windows font metrics: the five-column table, and then the search input's intrinsic width. Both are fixed structurally (scrolling table wrapper; container-bounded search grid), and the lifecycle assertion now names overflowing elements on failure.

