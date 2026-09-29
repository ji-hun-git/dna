# Upload confirmation and portable records

Evidence date: 2026-09-29. Base: `e603732`; branch: `codex/upload-product-flow`.

## Result

The existing server-backed synthetic product now separates selecting a PDF from sending it. The person reviews the filename, size and purpose, can cancel without an intake request, and explicitly starts the upload. This screen does not redact identifiers or authorize real documents. The records page offers a CSV download, visit preparation/printing and a route back to add another result sheet.

## Local evidence

Pinned Node 24.20.0, pnpm 11.20.0, Java 21. The browser test uses a newly created dedicated loopback PostgreSQL 16.14 database, not a pre-existing application database.

| Command | Result |
|---|---|
| `pnpm --dir apps/web exec vitest run --pool=threads --maxWorkers=2 --reporter=verbose` | 59 files, 437 tests passed |
| `pnpm --dir apps/web build` | Optimized build and TypeScript passed |
| `pnpm security:runtime-policy` | PASS, pinned runtimes |
| `pnpm auth-security:gate` | PASS |
| `pnpm release:readiness:validate` | Valid snapshot; NO_GO, 12 blocking gates remain |
| `gradlew.bat --no-daemon :apps:core-api:classes :apps:document-worker:classes` | BUILD SUCCESSFUL |
| `pnpm foundation:e2e` | 3 passed (2.2m): two documents, reload persistence, source review, actual CSV download, consent revocation/deletion, 200%/400% equivalent keyboard viewports |

Local logs are in `C:/gc-synthetic-test/upload-product-*.log`. The default fork-based full test run stalled on this Windows machine; the complete suite passed using two thread workers. Initial browser execution caught an incorrect new test expectation: the real empty active-document response is `{}`, not `{document:null}`. The assertion now checks the real 200/empty-object contract. The other two browser cases passed in that run.

The final browser run also checked horizontal fit at seven widths (320–1920px), including the new upload confirmation. The 390px upload-confirmation and records screenshots were visually inspected. These are local browser results, not a real screen-reader or hosted-environment audit. The complete JVM test suite was not repeated because no JVM implementation changed; the real browser lifecycle ran against Spring and the separate worker.

## Findings addressed

- U1: file selection previously immediately requested upload. Selection and cancellation now remain in browser state; the server still enforces consent and the synthetic digest allowlist.
- U2: record export required finding the data-control screen and consuming JSON/FHIR. A CSV projection of CURRENT confirmed records is available on the records page, including original value/date, review decision and source identifiers. Superseded records and excluded candidates are not exported. Text is quoted and formula-leading cells are prefixed for spreadsheet safety.
- U3: an intake failure before a document receipt left no direct retry path. The error screen now links back to file selection.
- U4: the local run guide incorrectly described fixed worker values. It now states the existing PDF text-layer extraction behavior and the new upload step.

## Readiness interpretation

No deployment, provider activation, production identity, personal data processing, OCR, clinical interpretation, or identifier-redaction claim is made. Synthetic scanner substitution and the non-recoverable demo session remain limitations. No release gate was upgraded. The local demonstration uses separate test and demo databases so the lifecycle test's synthetic deletion does not remove the user's demonstration records.

## Next sequence

Review this incremental PR against `codex/pdf-depth-rejection`, preserving the existing stacked changes. Complete hosted synthetic readiness and the separately specified identity, pre-upload data handling and legal review before enabling actual personal documents. Private registry/cloud/provider decisions remain external gates.
