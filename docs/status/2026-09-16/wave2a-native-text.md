# Wave 2A evidence — native-text extraction, concept normalization, Korean checkup benchmark (2026-09-16)

Branch `codex/wave4-native-text-extraction`. Synthetic only. Release remains NO_GO; no readiness gate or verdict changed.

## What exists now
- The document worker reads the PDF **text layer** with PDFBox (`NativeTextExtractionProvider`): one candidate per `label value unit` row with page, normalized box and the SHA-256 of the source line; the document date from `검사일/검진일/채취일/Date` or the first ISO/dotted/Korean date. Rows without a date, with two values, with an unknown unit, or with a value but no unit token at all (missing or unrecognised, e.g. non-Latin) become visible `ambiguous_unit`/`ambiguous_value` abstentions instead of vanishing. A PDF without a text layer completes with zero candidates and one `unreadable` abstention; a PDF whose text layer is readable but yields zero candidates **and** zero abstentions (prose-only pages) also completes with one document-level `unreadable` abstention (label `결과지`), so a text-layer file never looks like an empty scan.
- This is **not OCR and not a model**: no image is interpreted, no network is used, no weights exist. The `provider_and_real_data_activation` gate's "OCR·의료 AI 비활성" statement stays true.
- Core stores exactly the worker's candidates (`extraction-result` request, Bean-validated, ≤ 100 rows). `SyntheticCandidateFixture` and `gc.foundation.synthetic-documents` are gone. Labels are normalized in core through `gc_medical_concept` (38 concepts, alias match, unit spelling unified, no value conversion); unknown labels keep `conceptCode = null`. `HealthEvent.conceptCode` is exposed and `/my-data` search matches it exactly.
- Audit: 두 가지 이벤트 유형(EXTRACTION_CANDIDATES_CREATED / EXTRACTION_NO_CANDIDATES)으로 건수 유무만 구분하며 값은 기록하지 않는다. Rows themselves carry only the event type, resource and job id — no candidate count and no extracted value.
- Benchmark R1: `packages/korean-checkup-benchmark` generates 24 synthetic PDFs (4 layouts × 6 variants, one image-only scan, one undated, one ambiguous row) plus `corpus.json`; `pnpm medical-ai:native-text-gate` scores the parser with the existing `evaluateMedicalDocumentPipeline` thresholds. Report: `docs/status/2026-09-16/native-text-benchmark.md`.
- Reference-range text printed in the synthetic PDFs is only there for the parser to ignore; it is never persisted, never sent to core, and not present in gold or run JSON.

## Evidence (local, 2026-09-16, final-fix pass)
| Gate | Result |
|---|---|
| runtime-policy | `runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3` |
| readiness validate | `release-readiness: NO_GO 12 blocking gate(s) are not PASS` (exit 0; unchanged verdict) |
| github-actions-policy | `github-actions-policy: PASS` |
| web:test | `Test Files 43 passed (43), Tests 217 passed (217)` |
| web build / tsc --noEmit | `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json` clean, no errors |
| auth-security gate | `auth-security-gate: PASS` |
| gradlew cleanTest test (embedded PostgreSQL) | `BUILD SUCCESSFUL in 1m 2s`; aggregated XML: tests 128, skipped 3, failures 0, errors 0 |
| medical-ai:native-text-gate | `documentCount 24, fieldF1 1, criticalValueExactRate 1, evidenceLocalizationRate 1, requiredAbstentionRecall 1, hallucinationRate 0, passed true` (unchanged by the I1 fix — no benchmark document exercised the value-with-no-unit or prose-only-page path) |
| foundation:e2e | `3 passed (1.3m)` (review screen shows text-layer copy, evidence page and box; two dated documents; 200 %/400 % keyboard viewports) |

## Limits
No hosted run. The demo documents are two generated PDFs; the benchmark documents are generated too — no real checkup layout was measured. The parser reads only text layers it can position; rotated pages, multi-line labels and image scans are abstentions, not results. Concept aliases and LOINC codes are a dictionary, not a clinical mapping decision; the founder verifies them before any non-synthetic use. Nothing here is a diagnosis, normality, reference-range, trend or risk claim.

검사일 규칙은 Wave 2B에서 바뀌었다: 라벨 없는 날짜는 쓰지 않고, 라벨은 줄 안 어디든 인정하며, 라벨 날짜가 서로 다르면 문서 단위 abstention이다. 검토 화면에서 검사일을 정정할 수 있다. 벤치마크는 25개 문서(R2)가 됐다. `docs/status/2026-09-17/wave2b.md` 참조.
