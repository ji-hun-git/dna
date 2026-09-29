# Plain Korean product copy

## Evidence date and revision

2026-09-29. Working tree on `codex/plain-korean-product-copy`, based on `f97135f671baf13f1b6e129e61da50d0d79cbece`. The associated pull request records the final commit and CI results.

## Executive result

Replaced slogans, internal processing vocabulary and inconsistent action names across the live product with direct Korean. The copy names actual tasks and explains limits where they affect the user. This is a wording revision; document processing, consent, storage and deletion behavior are unchanged.

## Live evidence table

| Check | Result | Evidence |
| --- | --- | --- |
| Regression first | Expected failure on retired phrases | `plain-copy-red.log` |
| Web tests | 443 passed in 60 files | `pnpm web:test`; `plain-copy-web-final.log` |
| Production build | Passed | `pnpm --dir apps/web build`; `plain-copy-build.log` |
| Browser lifecycle | 3 passed, 1.6m | `pnpm foundation:e2e`; `plain-copy-e2e.log` |
| Policy | Runtime policy, auth-security and readiness validation passed | Local command output |
| Release verdict | NO_GO, 12 blocking gates unchanged | `plain-copy-readiness.log`; unchanged `release/readiness.json` |
| Visual inspection | Entry mobile, home desktop, review at 320px, preparation mobile and data management desktop | Foundation screenshot matrix under `apps/web/test-results` |
| Hosted operation | Not verified | No deployment performed |

Log names resolve under `C:/gc-synthetic-test/`. Local logs are not immutable CI evidence. Browser coverage includes seven widths and equivalent 200/400-percent constrained viewports; it is not a real screen-reader audit. The home heading received a small word-wrap adjustment after the matrix captured that page.

## Ranked findings

- COPY-01 (high, addressed): slogans obscured the task. Home and empty states now name records, adding a result sheet and questions for a visit.
- COPY-02 (high, addressed): processing screens exposed internal security vocabulary. Plain state descriptions now accompany the preserved technical status details.
- COPY-03 (medium, addressed): export copy could imply existing records were removed. It now distinguishes the downloaded file, temporary export copy and existing records.
- COPY-04 (medium, addressed): optional research consent and deletion needed clearer consequences. The copy describes current consent-only storage, later study consent, deletion scope and irreversibility.
- COPY-05 (medium, addressed): source, revisions and actions had inconsistent names. These now use a documented vocabulary; accessible names and browser assertions match.

## Readiness interpretation

Copy and local synthetic workflow evidence only. No real-data, clinical, external-provider or hosted-release gate is upgraded.

## Changes made by this audit

Updated live component text, shared errors, fixed clinician-question templates, metadata and accessibility names. Added a regression against retired slogans and jargon, retained capability-limit assertions, and documented the product vocabulary in `docs/design/korean-product-copy.md`.

## Next safe sequence

Require green CI for the stacked pull request and use the copy guide for subsequent product changes.

## Founder-only actions

None for this local copy revision. Existing public-release gates remain separate.
