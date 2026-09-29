# Record workflow review

## Evidence date and revision

2026-09-29. Branch `codex/record-workflow-review`, based on `60d42f9`. Final revision and CI results are attached to the associated pull request.

## Executive result

Found and fixed a frontend/backend contract defect: Spring returns at most 200 records per request, in ascending date order, with `X-GC-Next-After` for continuation. The web client ignored that header, silently omitting later pages, including the newest results. Both records and health-event consumers now load every page before exposing the collection.

Continued the product work by linking home results directly to their source records and removing repeated home explanations and the unavailable external-connection count.

## Live evidence table

| Check | Result | Evidence |
| --- | --- | --- |
| Pagination regression first | Five expected failures | `workflow-red.log` |
| Home source-link regression first | One expected failure; pagination tests passed | `workflow-home-red.log` |
| Web suite | 449 passed, 61 files | `pnpm web:test`; `workflow-web.log` |
| Production build | Passed | `pnpm --dir apps/web build`; `workflow-build.log` |
| Browser lifecycle | 3 passed, including real-API two-item pagination through Next | `pnpm foundation:e2e`; `workflow-e2e.log` |
| Visual review | Home desktop and mobile captures inspected | Seven-width foundation screenshot matrix |
| Fresh API and worker tests | 312 passed, 3 skipped, zero failures/errors | `gradlew.bat :apps:core-api:test :apps:document-worker:test --rerun-tasks --no-daemon`; `workflow-jvm-fresh.log`; JUnit XML |
| Runtime/auth policies | Passed | `pnpm security:runtime-policy`; `pnpm auth-security:gate` |
| Readiness validation | NO_GO, 12 blockers unchanged | `workflow-readiness.log` |

Logs are local under `C:/gc-synthetic-test/`. API totals: 229 tests, 2 skipped. Worker totals: 86 tests, 1 skipped. Local skips are the Docker-only legacy consent repository test, external Synthea bundle test and pinned ClamAV engine test. The 59-test PostgreSQL foundation lifecycle suite ran without skips. CI provides the external-tool checks; local results alone do not prove those integrations.

## Ranked findings

- RECORD-01 (high, fixed): client ignored backend pagination. Lists, counts, CSV inputs and visit questions could omit results after the first page. Continuation tokens are now UUID-validated, cycles and empty intermediate pages are rejected, and failures do not return a partial collection. Reads stop with an explicit error after 100 pages rather than silently truncating or looping forever.
- RECORD-02 (medium, fixed): home results were plain text, requiring a second search for the source. Each saved result now links to the existing focusable record/source detail.
- RECORD-03 (medium, addressed): repeated explanations and an unavailable connection count competed with the record task. These were removed while retaining the synthetic-data notice, source review and consent controls.
- RECORD-04 (test timing, addressed): CI run `36544285572` checked history-heading focus immediately after rows appeared, before the passive focus effect necessarily completed. The assertion now waits for the same required focus state; product behavior is unchanged.

## Readiness interpretation

This was a focused record-workflow review, not a whole-repository proof of correctness. Backend cursor ownership, ordering, correction ownership/consent checks and their regression tests were inspected. No backend code change was justified by this review. Real medical documents, hosting and clinical use remain outside the authorized scope.

## Changes made by this audit

Added bounded pagination to the shared web client, regression tests for continuation/failure behavior, a real-API browser scenario with two-item pages, direct home source links and a smaller home information hierarchy. No provider activation, database migration or release gate changes.

## Next safe sequence

Require green CI, then continue usability review of finding a named result and comparing dates. A passing test suite does not establish that the wording or navigation is intuitive.

## Founder-only actions

None for these local fixes. Existing release gates are unchanged.
