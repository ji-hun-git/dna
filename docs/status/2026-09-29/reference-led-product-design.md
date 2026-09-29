# Reference-led product design

## Evidence date and revision

2026-09-29. Working tree on `codex/reference-led-product-design`, based on `533e4e6c6109fcf74583abfcb6a71cf9b7c0a076`. Final revision and CI are recorded in the associated pull request.

## Executive result

Rebuilt the live home around a record ledger and actual record counts, removed the decorative trajectory and invented profile from the live composition, and introduced a shared desktop navigation rail with a restrained record-book visual direction. Apple Health and Oura official product screenshots were visually inspected; Toss's live typography documentation informed the text hierarchy. This is a functional implementation, not a design mockup. Visual approval by the user is not established by tests.

## Live evidence table

| Check | Result | Evidence |
| --- | --- | --- |
| Regression first | 2 expected failures, 2 passes | `C:/gc-synthetic-test/reference-design-red.log` |
| Web tests | 440 passed, 59 files, 97.21s | `pnpm --dir apps/web exec vitest run --pool=threads --maxWorkers=2`; `reference-design-web.log` |
| Build and TypeScript | Passed | `pnpm --dir apps/web build`; `reference-design-build.log` |
| Browser lifecycle | 3 passed, 2.4m | `pnpm foundation:e2e`; `reference-design-e2e.log` |
| Policy | Runtime policy and auth-security gate passed; readiness validation remained NO_GO with 12 blockers | Local command outputs, unchanged release/readiness.json |
| Visual review | Entry/home desktop and mobile, records desktop, preparation mobile, data overview mobile, data management desktop | Generated foundation lifecycle captures under apps/web/test-results |
| Hosted operation | Not verified | No hosting or release action |

All log basenames above resolve under `C:/gc-synthetic-test/`. Local evidence is not immutable CI evidence. Browser tests retain the seven-width matrix, 48px desktop / 56px mobile navigation target checks, overflow detection, shared-surface checks, and the original synthetic lifecycle.

## Ranked findings

- DESIGN-01 (high, addressed): previous consistency pass standardized colors without establishing hierarchy. The actual record task now occupies the primary position.
- DESIGN-02 (high, addressed): decorative visualization and invented demographics consumed the home. Authenticated records and counts now come only from current server records; signed-out sample rows are explicitly labelled.
- DESIGN-03 (medium, addressed): navigation competed with the page. A stable rail on desktop and bottom destinations on mobile preserve spatial orientation.
- DESIGN-04 (medium, addressed): design choices lacked a reference trail. The reference study records inspected primary sources and the specific principles adopted.

## Readiness interpretation

UI and synthetic lifecycle evidence only. Public hosting, clinical functionality, real-data authorization and accessibility certification are not established. Keyboard checks use equivalent constrained viewports, not actual browser zoom or a real screen reader. Release gates are unchanged.

## Changes made by this audit

Added RecordWorkspace, rebuilt entry/home composition, revised the shared palette/type/navigation and the product UI contract, and added the reference study. Retained data confirmation, source viewing, export, preparation and deletion behavior. Existing visualization components remain available outside the live home.

## Next safe sequence

Push a stacked pull request, require green CI, and review the local product visually with the user. Apply the documented direction to subsequent screen changes.

## Founder-only actions

None for this local UI revision. Existing public-release gates remain separate.
