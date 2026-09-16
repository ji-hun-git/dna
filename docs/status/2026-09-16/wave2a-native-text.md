# Wave 2A evidence — native-text extraction, concept normalization, Korean checkup benchmark (2026-09-16)

Branch `codex/wave4-native-text-extraction`. Synthetic only. Release remains NO_GO; no readiness gate or verdict changed.

## What exists now
- The document worker reads the PDF **text layer** with PDFBox (`NativeTextExtractionProvider`): one candidate per `label value unit` row with page, normalized box and the SHA-256 of the source line; the document date from `검사일/검진일/채취일/Date` or the first ISO/dotted/Korean date. Rows without a date, with two values, or with an unknown unit become visible abstentions. A PDF without a text layer completes with zero candidates and one `unreadable` abstention.
- This is **not OCR and not a model**: no image is interpreted, no network is used, no weights exist. The `provider_and_real_data_activation` gate's "OCR·의료 AI 비활성" statement stays true.
- Core stores exactly the worker's candidates (`extraction-result` request, Bean-validated, ≤ 100 rows). `SyntheticCandidateFixture` and `gc.foundation.synthetic-documents` are gone. Labels are normalized in core through `gc_medical_concept` (38 concepts, alias match, unit spelling unified, no value conversion); unknown labels keep `conceptCode = null`. `HealthEvent.conceptCode` is exposed and `/my-data` search matches it exactly.
- Audit: `EXTRACTION_CANDIDATES_CREATED` / `EXTRACTION_NO_CANDIDATES` (counts only, never values).
- Benchmark R1: `packages/korean-checkup-benchmark` generates 24 synthetic PDFs (4 layouts × 6 variants, one image-only scan, one undated, one ambiguous row) plus `corpus.json`; `pnpm medical-ai:native-text-gate` scores the parser with the existing `evaluateMedicalDocumentPipeline` thresholds. Report: `docs/status/2026-09-16/native-text-benchmark.md`.
- Reference-range text printed in the synthetic PDFs is only there for the parser to ignore; it is never persisted, never sent to core, and not present in gold or run JSON.

## Evidence (local, 2026-09-16)
| Gate | Result |
|---|---|
| runtime-policy | `runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3` |
| readiness validate | `release-readiness: NO_GO 12 blocking gate(s) are not PASS` (exit 0; unchanged verdict) |
| github-actions-policy | `github-actions-policy: PASS` |
| web:test | `Test Files 43 passed (43), Tests 215 passed (215)` |
| web build | Next.js 16.3.3 build succeeded; routes include `○ /my-data` |
| auth-security gate | `auth-security-gate: PASS` |
| gradlew cleanTest test (embedded PostgreSQL) | `BUILD SUCCESSFUL in 1m 2s`; aggregated XML: tests 126, skipped 3, failures 0, errors 0 |
| medical-ai:native-text-gate | `documentCount 24, fieldF1 1, criticalValueExactRate 1, evidenceLocalizationRate 1, requiredAbstentionRecall 1, hallucinationRate 0, passed true` |
| foundation:e2e | `3 passed (1.4m)` (review screen shows text-layer copy, evidence page and box; two dated documents; 200 %/400 % keyboard viewports) |

## Limits
No hosted run. The demo documents are two generated PDFs; the benchmark documents are generated too — no real checkup layout was measured. The parser reads only text layers it can position; rotated pages, multi-line labels and image scans are abstentions, not results. Concept aliases and LOINC codes are a dictionary, not a clinical mapping decision; the founder verifies them before any non-synthetic use. Nothing here is a diagnosis, normality, reference-range, trend or risk claim.
