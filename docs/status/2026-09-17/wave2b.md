# Wave 2B evidence — MedGemma 1.5 local synthetic experiment, labelled exam dates, date correction, benchmark determinism (2026-09-17)

Branch `codex/wave5-medgemma-eval-and-dates`. Synthetic only. Release remains NO_GO; no readiness gate or verdict changed. PR deferred.

## What exists now
- **Worker date rule.** Only a labelled date (검사일/검진일/채취일/검사 일자/검진 일자/채취 일자/Date/Exam date/Test date/Collection date, label anywhere in the line, first date after the label) is the document date. A bare date is never used. Two different labelled dates make the whole document one `ambiguous_value` abstention (`문서 전체`) with zero candidates; the review screen names it "검사일이 둘 이상이라 확실하지 않음". No labelled date → every recognised row is `missing_evidence` (unchanged). The two demo PDFs carry `Date:` and parse as before.
- **Date correction.** `POST /api/foundation/candidates/{id}/confirmation` accepts an optional `observedOn` (ISO date, 1900-01-01..today Asia/Seoul; 400 `observed_on_invalid` / `observed_on_out_of_range`). V8 adds `gc_health_record.original_observed_on`; the candidate row keeps its own date. `RecordReceipt.originalObservedOn` is always present; `reviewDecision = CORRECTED` when the value or the date differs; `HealthEvent.corrected` follows. Audit stays `CANDIDATE_CONFIRMED`/`CANDIDATE_CORRECTED` with no date and no value. The review card has a "검사일 수정" form (`type=date`, future and pre-1900 refused); the records screen shows "사용자가 검사일을 수정함 · 원래 YYYY. M. D.". This is a confirmation of what the document says, not clinical validation.
- **Benchmark R2.** 25 documents (4 layouts × 6 variants + `synthetic-hospital-two-column-v6`, which prints 생년월일 before a mid-line labelled 검사일). PDF bytes are deterministic (fixed PDFBox document id and info dates, no XMP; proven by a two-generation byte test). `corpusId = synthetic-ko-checkup-r2-<first 16 hex of sha256 over "<documentId> <sha256(pdf)>" lines>`. New CLIs `render-pages` (PDFBox 150 dpi PNG per page, 31 pages) and `export-concepts`.
- **MedGemma experiment.** `pnpm medical-ai:medgemma-experiment` (manual, not in CI) renders the corpus, sends each page to the local Ollama `medgemma1.5:latest` with a pinned transcription-only prompt, JSON-schema `format`, `think:false`, temperature 0, one call per page, 180 s per document, maps rows to `medical-document-run.v1` with the whole-page box and catalogue aliases, drops any `referenceRange`, scores parser and model with the same `evaluateMedicalDocumentPipeline`, and writes `docs/status/2026-09-17/medgemma-local-experiment.md`. Run JSON stays under `apps/web/build/medgemma/`. Model output never enters product code.

## Evidence (local, 2026-09-17)
| Gate | Result |
|---|---|
| runtime-policy | `runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3` |
| readiness validate | `release-readiness: NO_GO 12 blocking gate(s) are not PASS` (exit 0; verdict unchanged from prior wave) |
| github-actions-policy | `github-actions-policy: PASS` |
| web:test | `Test Files  48 passed (48)` / `Tests  262 passed (262)` |
| web build / tsc --noEmit | `next build` compiled successfully, TypeScript finished, all 9 routes generated; `tsc --noEmit -p tsconfig.json` produced no output (clean) |
| auth-security gate | `auth-security-gate: PASS` |
| gradlew cleanTest test (embedded PostgreSQL) | `BUILD SUCCESSFUL in 1m 16s`; aggregated XML across 36 suites: tests 140, skipped 3, failures 0, errors 0 |
| medical-ai:native-text-gate | `documentCount 25, fieldF1 1, criticalValueExactRate 1, evidenceLocalizationRate 1, requiredAbstentionRecall 1, hallucinationRate 0, passed true, corpusId synthetic-ko-checkup-r2-e6befc286ae6ce1d` |
| foundation:e2e | `3 passed (1.4m)` |
| medical-ai:medgemma-experiment | model column vs parser (same 25-document corpus, same evaluator): exact/expected 78/190 (parser 190/190); field F1 50.2% (parser 100.0%); hallucinated measurements 32 (26.4%) (parser 0, 0.0%); required abstention recall 10.0% (parser 100.0%); 8 of 25 documents unreadable (model JSON output truncated/malformed at the 2048-token cap, mostly the 2-page documents) — evidence only, see `medgemma-local-experiment.md` |

## Limits
No hosted run. One local execution of one quantized model on 31 synthetic pages; no real layout, scan or PHI was measured. Evidence localization for the model is not measurable. Handoff conditions 2–7 in `docs/implementation/medical-document-runner.md` remain open. Nothing here is a diagnosis, normality, reference-range, trend or risk claim.
