# Wave 3 evidence — reference-range preservation, deterministic differences, export v2, MedGemma num_ctx, 내 데이터 minors (2026-09-17)

Branch `codex/wave7-reference-range-delta` (stacked on PR #10). Synthetic only. Release remains NO_GO; no readiness gate or verdict changed. Gate document for items (a)(b): `governance/intended-use-decision-reference-range-and-delta-2026-09-17.md`, committed before any (a)(b) code.

## What exists now
- **(a) Reference-range text, stored and exported only.** The worker keeps the range body printed on a row (`ParsedCandidate.referenceRangeText`, ≤ 40 characters, digits/separators/comparison signs, label and brackets stripped); the boundary DTO validates the same shape; V10 stores it on `gc_candidate.reference_range_text` and copies it to `gc_health_record_version.reference_range_text` at confirmation; a correction inherits it and no request field can change it. It is returned by no API except `GET /api/foundation/health-events/export` and appears on no screen. PostgreSQL test: the candidate list, records, health-events and changes bodies contain no key matching `reference` (case-insensitive); the Playwright lifecycle asserts `120-199` is absent from the review, home, records and 내 데이터 screens and present once in the export. Value/unit parsing is unchanged: native-text gate F1 = 1, `referenceRangeAccuracy` = 1 on the same `corpusId`.
- **(b) Deterministic differences.** `ChangeItem.delta = { absolute, percent }` from `ChangeDeltaCalculator` (BigDecimal subtraction at the larger input scale; percent of the previous value HALF_EVEN to one decimal; null when the previous value is zero, the unit differs or a value is not numeric). The home line reads `두 값의 차이: -6 mg/dL (-3.1%)`; no direction word, arrow, colour or threshold, and the copy scan now forbids 상승/하락/증가/감소 in every user-facing file.
- **Export v2.** `schemaVersion: alm-health-events-export.v2`; `events[]` = HealthEvent + `referenceRangeText` + `originalValue`/`correctionReason`/`originalObservedOn`; `documents[]` = every COMPLETED document of the owner plus every document with events, sorted by id, each with `eventCount` (a fully excluded document lists with `eventCount 0`). Headers, filename and the count-free audit row are unchanged.
- **내 데이터 minors.** The evidence drawer shows 수정 이력 (원래 값 · 이유 · 원래 검사일, or 수정 없음); `SourcePreview` states which page the value came from and that the image is the first page; jest-axe passes on the empty and the error state; a cell that arrives after a reload plays one fade/scale animation, none under `prefers-reduced-motion: reduce`.
- **MedGemma Run 3.** Protocol option `num_ctx: 8192` (new digest `f50c1ba2d46ea9771335bf8be68d7238a7aabbb8eb6f14c35a9e8bce934f0528`); results recorded as observations in `docs/status/2026-09-17/medgemma-local-experiment.md` §Run 3 and the third pins block of the approval note. Observed: unreadable 7/25 (was 9), F1 61.3% (was 56.9%), hallucination 10.5% (was 17.1%), all 7 remaining unreadable cases show `done_reason=length` at `eval_count=4096`, 100% GPU; n=1, no cause claimed. `native-text-report.ts` does print `referenceRangeAccuracy` (added in commit `dd396d7`, before this wave's final review); the MedGemma side-by-side renderer (`medgemma-report.ts`) is the one that still lacks that row — a Run 3 evidence gap noted here, not fixed in this wave.

## Evidence (local, 2026-09-17 — final whole-branch review, F1–F8)
| Gate | Result |
|---|---|
| gradlew cleanTest test (embedded PostgreSQL) | `BUILD SUCCESSFUL in 1m 34s` (23 actionable tasks: 11 executed, 12 up-to-date); core-api 130 tests, 0 failures, 0 errors, 2 skipped; document-worker 34 tests, 0 failures, 0 errors, 1 skipped; document-boundary 13 tests, 0 failures, 0 errors; korean-checkup-benchmark 5 tests, 0 failures, 0 errors |
| web:test | `Test Files  50 passed (50)` / `Tests  307 passed (307)` |
| tsc --noEmit | no output (exit 0) |
| medical-ai:native-text-gate | `"corpusId": "synthetic-ko-checkup-r2-e6befc286ae6ce1d"` (unchanged), `"fieldF1": 1`, `"referenceRangeAccuracy": 1`, `"passed": true` |
| foundation:e2e | `3 passed (1.2m)` |
| `git diff --quiet 6467ce7 -- release/readiness.json` | exit 0 (byte-identical to base) |

Copy scan is included in the `web:test` run above (`tests/korean-ux-copy.test.ts` among the 50 files). `git status --short` after all gates and after restoring `apps/web/next-env.d.ts` shows only the source/test/doc files touched by F1–F8 (no `next-env.d.ts`, `test-results`, or `build/`).

## Limits
No hosted run. The reference-range text is document text preserved for the person's own file; the product neither shows it nor relates any value to it, and the founder's regulatory judgement covers synthetic staging only — any display, comparison, trend or direction language needs a new decision and a regulatory review before real personal health information is processed. The difference is arithmetic on two stored values and carries no meaning. Following the final whole-branch review, the worker-level gaps this wave's tests previously left unexercised are now closed: a bare trailing number is no longer mistaken for a range (F1), an en-dash separator is exercised and kept verbatim, and the 40-character boundary now yields `null` instead of a truncated fragment (F2) — see "최종 리뷰 후 좁힌 점" below. A second range appearing on the same row is still dropped rather than captured (unchanged, out of scope). The MedGemma run is evidence only (handoff conditions 2–7 open); its numbers are observations from n=1, not causes. `native-text-report.ts` does surface `referenceRangeAccuracy` in its printed output; the MedGemma side-by-side renderer (`medgemma-report.ts`) does not. Readiness is unchanged.

## 최종 리뷰 후 좁힌 점

Every item below makes the product narrower than the 2026-09-17 intended-use decision permits; none widens it.

- **F1** A bare trailing number (e.g. a previous-result column) is no longer kept as `referenceRangeText`; only a body with a comparison sign or a two-number separator counts as a range.
- **F2** A range body longer than 40 characters is now `null` instead of silently truncated to a cut fragment.
- **F3** `percent` is `null` whenever the previous value is zero or negative, not only when it is exactly zero, so the percent sign can never contradict the absolute sign.
- **F4** A `%`-unit item's what-changed line now shows only the absolute difference; the percent is never emitted for a percent-of-a-percent number.
- **F5** The what-changed delta is omitted whenever the previous value's observed date is later than the latest value's, so a signed difference never runs against chronology; both values and dates still show.
- **F6** The audit-leak assertions that could never fail (matching against enum-shaped columns that never carry a value) are replaced with checks over the audit row's real text columns and with value-based `doesNotContain` checks on every affected response body.
- **F7** The 내 데이터 canvas now discloses when declumping has moved a cell off its raw time-scale position, with a caption naming that a cell's date should be confirmed by selecting it.
