# Consistent product experience

## Evidence date and revision

2026-09-29. Local working tree on `codex/consistent-product-experience`, based on upload-product revision `e41ebcd83636fb11875979212e389a385d37b9f4`. Final commit and hosted CI evidence are recorded in the accompanying pull request.

## Executive result

Unified the live product frame, navigation and visual foundations. The home no longer compresses actions into a narrow dark column; records, history, preparation and data management share the same light canvas and controls. Local functional and responsive checks passed. Public release readiness is unchanged.

## Live evidence table

| Check | Observed result | Evidence |
| --- | --- | --- |
| Regression first | 4 expected failures, 7 passes before implementation | Local `C:/gc-synthetic-test/consistent-ux-red.log` |
| Web tests | 438 tests across 59 files passed | `pnpm --dir apps/web exec vitest run --pool=threads --maxWorkers=2`; local `consistent-ux-web-tests.log` |
| Production build | Build and TypeScript passed | `pnpm --dir apps/web build`; local `consistent-ux-build.log` |
| Browser lifecycle | 3 tests passed in 1.8 minutes | `pnpm foundation:e2e`; local `consistent-ux-e2e-final.log` |
| Responsive checks | 320, 390, 430, 768, 1280, 1440 and 1920 widths; four navigation destinations and shared canvas checked | Foundation lifecycle spec and generated screenshots |
| Visual review | Desktop home and mobile home, records, history, preparation and data management inspected | Local Playwright screenshots under `apps/web/test-results` |
| Policy checks | Runtime policy and auth security gate passed; readiness validation remained valid with 12 blockers | Local command output from this audit |
| Public hosting / real-data operation | Not verified | No release gate changed |

Log basenames above resolve under `C:/gc-synthetic-test/`. Local artifacts are not immutable hosted evidence. CI status must be read from the pull request.

## Ranked findings

- UX-01 (high, fixed): home used a separate dark theme and narrow three-column layout, causing cramped Korean controls and inconsistent contrast.
- UX-02 (high, fixed): preparation was absent from primary navigation, while record views used scattered links. Four stable destinations and a shared record-view navigation now expose these tasks.
- UX-03 (medium, fixed): history, records and management used different page surfaces, typography and widths. Shared tokens now govern the live product frame.
- UX-04 (medium, fixed): the empty record overview sent users toward data management for an upload action located on home. Copy and the direct link now point home.

## Readiness interpretation

This is synthetic-product UI evidence, not legal clearance or public launch approval. Existing `NO_GO` with 12 blocking gates remains authoritative. Keyboard tests at equivalent constrained viewport sizes do not establish real screen-reader or browser-zoom certification.

## Changes made by this audit

Added `app/product.css` and a maintained product UI contract. Consolidated shell navigation, selected states, page headings, readable controls and responsive layout. Removed obsolete home-only dark styling. Preserved source confirmation, graph semantics, Spring authority, consent and deletion behavior. Updated assertions to cover the new four-item navigation; an initial browser run caught one remaining two-item assertion, which was corrected before all three tests passed.

## Next safe sequence

Push the scoped change as a stacked pull request, inspect hosted CI, and keep the local synthetic demo available for product review. Extend the same contract when adding screens. Use separate evidence before changing release or real-data gates.

## Founder-only actions

None required for this UI change. Existing external release gates remain outside this audit.
