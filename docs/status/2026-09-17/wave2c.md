# Wave 2C evidence — What-changed API, consent purposes (V9), HealthEvent export (2026-09-17)

Branch `codex/wave6-changes-consent-export`. Synthetic only. Release remains NO_GO; no readiness gate or verdict changed. PR deferred.

## What exists now
- **What-changed.** `GET /api/foundation/changes` (owner-isolated, `Cache-Control: no-store`) returns `latestDocument` (the most recently completed document that still has CURRENT records), `items` (each CURRENT value of that document beside the latest-observed CURRENT value of the same concept code — or the same label when no code — from any other document; a different unit yields `previous = null`, no conversion), `newConcepts` and `unchangedCount`. Pure `ChangeSummaryProjection` with unit tests; no difference, direction, range, trend or judgement in the JSON or the copy. The home shows "최근 변화" with "새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요." and hides the section when there is nothing to list. The client-side two-date comparison on /records is unchanged.
- **Consent purposes (V9).** `gc_consent_grant.purpose_code` accepts `DOCUMENT_EXTRACTION | RESEARCH_USE | RESEARCH_CONTACT | PROJECT:[a-z0-9-]{1,40}`; one ACTIVE row per (subject, purpose) is still enforced. `GET /api/foundation/consents` lists the three fixed purposes in fixed order (NOT_GRANTED when absent) then existing PROJECT purposes; `POST /api/foundation/consents/{purposeCode}` grants with an Idempotency-Key and returns the existing ACTIVE row unchanged; revocation stays `POST /consents/{consentId}/revocation` and now reports the real purpose. Every lifecycle check still reads only DOCUMENT_EXTRACTION: a research consent id cannot open a document (`active_consent_required`), and the PostgreSQL test runs bootstrap → upload → review → records → export → deletion with research consent absent and then revoked — this is the invariant that proves research consent is a stored preference and never a lifecycle condition. Audit rows `CONSENT_GRANTED`/`CONSENT_REVOKED` carry the purpose code in the new `gc_audit_event.purpose_code` column and nothing else. 데이터 관리 shows four rows with the fixed sentences and "연구 동의 없이도 모든 기능을 쓸 수 있어요."; there is no research pipeline and no contact channel, and a per-project consent will be asked again before any use. The `consentpurpose` module is untouched.
- **Export.** `GET /api/foundation/health-events/export` returns `{ schemaVersion: "alm-health-events-export.v1", exportedAt, subjectKind: "synthetic", events, documents[{documentId, observedOn?, status, abstentions}] }` as `application/json` with `Content-Disposition: attachment; filename="alm-health-events-<YYYYMMDD>.json"`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`; no `referenceRange` key; audit `HEALTH_EVENTS_EXPORTED` with no count and no value. 데이터 관리 links to the core URL directly (`<a download>`), disabled with "내보낼 기록이 없어요" when there are no events. Next.js gained no API route.

## Evidence (local, 2026-09-17)
| Gate | Result |
|---|---|
| runtime-policy | `runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3` |
| readiness validate | `release-readiness: NO_GO 12 blocking gate(s) are not PASS` (exit 0; verdict unchanged) |
| github-actions-policy | `github-actions-policy: PASS` |
| web:test | `Test Files  49 passed (49)` / `Tests  284 passed (284)` |
| web build / tsc --noEmit | Next.js 16.3.3 production build compiled successfully; all 9 app routes generated (`/`, `/_not-found`, `/connections`, `/data-control`, `/healthz`, `/my-data`, `/prepare`, `/providers`, `/records`) plus the Proxy middleware; `tsc --noEmit` produced no output (exit 0) |
| auth-security gate | `auth-security-gate: PASS` |
| gradlew cleanTest test (embedded PostgreSQL) | `BUILD SUCCESSFUL in 1m 8s` (23 actionable tasks: 8 executed, 15 up-to-date); aggregated across all four JUnit suites (core-api, document-worker, document-boundary, korean-checkup-benchmark): 160 tests, 0 failures, 0 errors, 3 skipped |
| medical-ai:native-text-gate | `"documentCount": 25`, `"fieldF1": 1`, `"passed": true`, `"corpusId": "synthetic-ko-checkup-r2-e6befc286ae6ce1d"` |
| foundation:e2e | `3 passed (1.3m)` |

## Limits
No hosted run. The what-changed list is a deterministic pairing of stored values; it computes no difference and makes no claim about direction or meaning. Research and project consents are records only: nothing reads them, no research pipeline exists, no contact is ever sent, and the copy says a per-project consent will be asked again. The export is the person's own synthetic events as one JSON file; it is not an interoperability format (no CSV/FHIR) and contains no reference range. Nothing here is a diagnosis, normality, reference-range, trend or risk claim. Readiness is unchanged.
