# MedGemma 1.5 local synthetic experiment — synthetic-ko-checkup-r2-e6befc286ae6ce1d (2026-09-17)

Bounded local evaluation approved in `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md`. The model saw only synthetic page images rendered from the generated corpus and was asked to transcribe label, value, unit and the labelled exam date; it was told not to judge anything. Its output never entered product code and is not stored as a record. Not a clinical, regulatory or production-accuracy claim (`synthetic-contract-regression-only`). Thresholds are shown for the parser gate only; for the model they are evidence, not a verdict.

## 실행 환경

| Pin | Value |
|---|---|
| Run window | 2026-09-16T20:48:28.971Z → 2026-09-16T20:55:47.334Z |
| Ollama | 0.34.1 at http://127.0.0.1:11434 |
| Model | medgemma1.5:latest · id 433252621ab154668b5d8be6aff6c1b771bacba045e46e6193da8d6ad1630f2c · blob sha256:a051c2bd4ab8d5b7f4df8eec344f2fdd603efb2d098da799dc16c95e9e8bc838 |
| Protocol digest (prompt, schema, options) | ef3941ccee441a2a6f2579bef6919728b041343136b9b48716ba9614f0672cff |
| Options | think=false, temperature=0, seed=7, num_predict=4096, keep_alive=10m, document timeout 180 s |
| Page rendering | PDFBox 3.0.8 PDFRenderer 150 dpi PNG, one /api/chat call per page |
| GPU / driver | NVIDIA GeForce RTX 3070, 610.74, 8192 MiB |
| Node | v24.20.0 |
| Corpus | synthetic-ko-checkup-r2-e6befc286ae6ce1d (25 documents) |
| Corpus digest (sha256 of PDF digest + corpus.json sha256) | 862e7b6ff503e8bc2dd14f24e3cdc97a669dd9fb4bc4e3b9d56790fdcf39a921 |
| corpus.json sha256 | e67d9edbd693bd507d4c7906dc266f28d37b2b1903dd0adc7e0d13d136b432be |
| Script commit | 9f6ff7d3bbd3c563c622217bba073c880673d5fb |
| done_reason on failed documents | length=9 |
| Run JSON | apps/web/build/medgemma/medgemma-runs.json (not committed) |

## 나란히 (same corpus, same evaluator)

| Metric | pdfbox-native-text | ollama-medgemma-1.5-4b-page-image |
|---|---|---|
| Documents | 25 | 25 |
| Expected measurements | 190 | 190 |
| Returned measurements | 190 | 123 |
| Exact measurements | 190 | 89 |
| Field precision | 100.0% | 72.4% |
| Field recall | 100.0% | 46.8% |
| Field F1 | 100.0% | 56.9% |
| Critical value exact | 100.0% | 47.9% |
| Evidence localization (IoU ≥ 0.8) | 100.0% | 측정 불가 (페이지 전체 박스) |
| Required abstention recall | 100.0% | 40.0% |
| Hallucinated measurements | 0 (0.0%) | 21 (17.1%) |
| Gate | PASS | 게이트 아님 (evidence only) |

Delta rows are read left to right; the model column is descriptive. Evidence localization cannot be measured for the model because it returns no box (every candidate cites the whole page).

## 문서별

| Document | pdfbox-native-text 정확/기대 · 오답 · 누락 · 환각 · 보류 | ollama-medgemma-1.5-4b-page-image 정확/기대 · 오답 · 누락 · 환각 · 보류 | 모델 실행 |
|---|---|---|---|
| synthetic-nhis-table-v0 | 8/8 · 0 · 0 · 0 · 0/0 | 7/8 · 0 · 1 · 1 · 0/0 | ok (4 s) |
| synthetic-nhis-table-v1 | 8/8 · 0 · 0 · 0 · 0/0 | 8/8 · 0 · 0 · 0 · 0/0 | ok (3 s) |
| synthetic-nhis-table-v2 | 8/8 · 0 · 0 · 0 · 0/0 | 7/8 · 0 · 1 · 1 · 0/0 | ok (4 s) |
| synthetic-nhis-table-v3 | 8/8 · 0 · 0 · 0 · 0/0 | 8/8 · 0 · 0 · 0 · 0/0 | ok (4 s) |
| synthetic-nhis-table-v4 | 8/8 · 0 · 0 · 0 · 0/0 | 7/8 · 0 · 1 · 1 · 0/0 | ok (4 s) |
| synthetic-nhis-table-v5 | 0/0 · 0 · 0 · 0 · 1/1 | 0/0 · 0 · 0 · 0 · 0/1 | unreadable (36 s) — ModelPageParseError: failed to parse model JSON for synthetic-nhis-table-v5 p1: Unexpected end of JSON input |
| synthetic-hospital-two-column-v0 | 8/8 · 0 · 0 · 0 · 0/0 | 0/8 · 0 · 8 · 0 · 0/0 | unreadable (36 s) — ModelPageParseError: failed to parse model JSON for synthetic-hospital-two-column-v0 p1: Expected property name or '}' in JSON at position 7751 (line 474 column 6) |
| synthetic-hospital-two-column-v1 | 8/8 · 0 · 0 · 0 · 0/0 | 0/8 · 0 · 8 · 8 · 0/0 | ok (3 s) |
| synthetic-hospital-two-column-v2 | 8/8 · 0 · 0 · 0 · 0/0 | 0/8 · 0 · 8 · 0 · 0/0 | unreadable (36 s) — ModelPageParseError: failed to parse model JSON for synthetic-hospital-two-column-v2 p1: Unterminated string in JSON at position 5693 (line 471 column 15) |
| synthetic-hospital-two-column-v3 | 8/8 · 0 · 0 · 0 · 0/0 | 8/8 · 0 · 0 · 0 · 0/0 | ok (3 s) |
| synthetic-hospital-two-column-v4 | 0/0 · 0 · 0 · 0 · 8/8 | 0/0 · 0 · 0 · 0 · 4/8 | ok (3 s) |
| synthetic-hospital-two-column-v5 | 8/8 · 0 · 0 · 0 · 0/0 | 0/8 · 0 · 8 · 0 · 0/0 | unreadable (36 s) — ModelPageParseError: failed to parse model JSON for synthetic-hospital-two-column-v5 p1: Expected ',' or '}' after property value in JSON at position 6193 (line 562 column 13) |
| synthetic-center-summary-v0 | 8/8 · 0 · 0 · 0 · 0/0 | 5/8 · 1 · 2 · 2 · 0/0 | ok (3 s) |
| synthetic-center-summary-v1 | 8/8 · 0 · 0 · 0 · 0/0 | 0/8 · 8 · 0 · 0 · 0/0 | ok (3 s) |
| synthetic-center-summary-v2 | 8/8 · 0 · 0 · 0 · 0/0 | 4/8 · 1 · 3 · 3 · 0/0 | ok (3 s) |
| synthetic-center-summary-v3 | 8/8 · 0 · 0 · 0 · 1/1 | 8/8 · 0 · 0 · 1 · 0/1 | ok (4 s) |
| synthetic-center-summary-v4 | 8/8 · 0 · 0 · 0 · 0/0 | 6/8 · 0 · 2 · 2 · 0/0 | ok (3 s) |
| synthetic-center-summary-v5 | 8/8 · 0 · 0 · 0 · 0/0 | 5/8 · 1 · 2 · 2 · 0/0 | ok (3 s) |
| synthetic-two-page-v0 | 9/9 · 0 · 0 · 0 · 0/0 | 0/9 · 0 · 9 · 0 · 0/0 | unreadable (36 s) — ModelPageParseError: failed to parse model JSON for synthetic-two-page-v0 p1: Unterminated string in JSON at position 7897 (line 512 column 12) |
| synthetic-two-page-v1 | 9/9 · 0 · 0 · 0 · 0/0 | 0/9 · 0 · 9 · 0 · 0/0 | unreadable (36 s) — ModelPageParseError: failed to parse model JSON for synthetic-two-page-v1 p1: Expected double-quoted property name in JSON at position 7890 (line 512 column 1) |
| synthetic-two-page-v2 | 9/9 · 0 · 0 · 0 · 0/0 | 0/9 · 0 · 9 · 0 · 0/0 | unreadable (35 s) — ModelPageParseError: failed to parse model JSON for synthetic-two-page-v2 p1: Unterminated string in JSON at position 6094 (line 516 column 11) |
| synthetic-two-page-v3 | 9/9 · 0 · 0 · 0 · 0/0 | 0/9 · 0 · 9 · 0 · 0/0 | unreadable (36 s) — ModelPageParseError: failed to parse model JSON for synthetic-two-page-v3 p1: Unterminated string in JSON at position 7879 (line 515 column 8) |
| synthetic-two-page-v4 | 9/9 · 0 · 0 · 0 · 0/0 | 8/9 · 1 · 0 · 0 · 0/0 | ok (6 s) |
| synthetic-two-page-v5 | 9/9 · 0 · 0 · 0 · 0/0 | 8/9 · 1 · 0 · 0 · 0/0 | ok (6 s) |
| synthetic-hospital-two-column-v6 | 8/8 · 0 · 0 · 0 · 0/0 | 0/8 · 0 · 8 · 0 · 0/0 | unreadable (36 s) — ModelPageParseError: failed to parse model JSON for synthetic-hospital-two-column-v6 p1: Unterminated string in JSON at position 7916 (line 525 column 21) |

## 항목별

### pdfbox-native-text

| Document | Field | Expected | Returned | Outcome |
|---|---|---|---|---|
| synthetic-nhis-table-v0 | total-cholesterol (총콜레스테롤) | 177 mg/dL @ 2026-07-28 | 총콜레스테롤: 177 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | ldl-cholesterol (LDL 콜레스테롤) | 120 mg/dL @ 2026-07-28 | LDL 콜레스테롤: 120 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | hdl-cholesterol (HDL 콜레스테롤) | 61 mg/dL @ 2026-07-28 | HDL 콜레스테롤: 61 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | triglycerides (중성지방) | 61 mg/dL @ 2026-07-28 | 중성지방: 61 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | fasting-glucose (공복혈당) | 86 mg/dL @ 2026-07-28 | 공복혈당: 86 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | hba1c (당화혈색소) | 4.8 % @ 2026-07-28 | 당화혈색소: 4.8 % @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | hemoglobin (혈색소) | 14.1 g/dL @ 2026-07-28 | 혈색소: 14.1 g/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | creatinine (크레아티닌) | 0.95 mg/dL @ 2026-07-28 | 크레아티닌: 0.95 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v1 | total-cholesterol (Total Cholesterol) | 157 mg/dL @ 2026-06-18 | Total Cholesterol: 157 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | ldl-cholesterol (LDL Cholesterol) | 122 mg/dL @ 2026-06-18 | LDL Cholesterol: 122 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | hdl-cholesterol (HDL Cholesterol) | 67 mg/dL @ 2026-06-18 | HDL Cholesterol: 67 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | triglycerides (Triglycerides) | 146 mg/dL @ 2026-06-18 | Triglycerides: 146 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | fasting-glucose (Fasting Glucose) | 81 mg/dL @ 2026-06-18 | Fasting Glucose: 81 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | hba1c (HbA1c) | 5.0 % @ 2026-06-18 | HbA1c: 5.0 % @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | hemoglobin (Hemoglobin) | 14.9 g/dL @ 2026-06-18 | Hemoglobin: 14.9 g/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | creatinine (Creatinine) | 0.96 mg/dL @ 2026-06-18 | Creatinine: 0.96 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v2 | total-cholesterol (총콜레스테롤) | 191 mg/dl @ 2026-05-09 | 총콜레스테롤: 191 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | ldl-cholesterol (LDL 콜레스테롤) | 124 mg/dl @ 2026-05-09 | LDL 콜레스테롤: 124 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | hdl-cholesterol (HDL 콜레스테롤) | 47 mg/dl @ 2026-05-09 | HDL 콜레스테롤: 47 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | triglycerides (중성지방) | 62 mg/dl @ 2026-05-09 | 중성지방: 62 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | fasting-glucose (공복혈당) | 97 mg/dl @ 2026-05-09 | 공복혈당: 97 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | hba1c (당화혈색소) | 5.4 % @ 2026-05-09 | 당화혈색소: 5.4 % @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | hemoglobin (혈색소) | 12.9 g/dl @ 2026-05-09 | 혈색소: 12.9 g/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | creatinine (크레아티닌) | 0.95 mg/dl @ 2026-05-09 | 크레아티닌: 0.95 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v3 | total-cholesterol (Total Cholesterol) | 174.8 mg/dL @ 2026-04-21 | Total Cholesterol: 174.8 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | ldl-cholesterol (LDL Cholesterol) | 125.5 mg/dL @ 2026-04-21 | LDL Cholesterol: 125.5 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | hdl-cholesterol (HDL Cholesterol) | 56.7 mg/dL @ 2026-04-21 | HDL Cholesterol: 56.7 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | triglycerides (Triglycerides) | 146.4 mg/dL @ 2026-04-21 | Triglycerides: 146.4 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | fasting-glucose (Fasting Glucose) | 92.5 mg/dL @ 2026-04-21 | Fasting Glucose: 92.5 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | hba1c (HbA1c) | 5.56 % @ 2026-04-21 | HbA1c: 5.56 % @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | hemoglobin (Hemoglobin) | 13.80 g/dL @ 2026-04-21 | Hemoglobin: 13.80 g/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | creatinine (Creatinine) | 0.929 mg/dL @ 2026-04-21 | Creatinine: 0.929 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v4 | total-cholesterol (총콜레스테롤) | 152 mg/dL @ 2026-03-12 | 총콜레스테롤: 152 mg/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | ldl-cholesterol (LDL 콜레스테롤) | 111 mg/dL @ 2026-03-12 | LDL 콜레스테롤: 111 mg/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | hdl-cholesterol (HDL 콜레스테롤) | 59 mg/dL @ 2026-03-12 | HDL 콜레스테롤: 59 mg/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | triglycerides (중성지방) | 75 mg/dL @ 2026-03-12 | 중성지방: 75 mg/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | fasting-glucose (공복혈당) | 98 mg/dL @ 2026-03-12 | 공복혈당: 98 mg/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | hba1c (당화혈색소) | 5.2 % @ 2026-03-12 | 당화혈색소: 5.2 % @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | hemoglobin (혈색소) | 12.8 g/dL @ 2026-03-12 | 혈색소: 12.8 g/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | creatinine (크레아티닌) | 0.72 mg/dL @ 2026-03-12 | 크레아티닌: 0.72 mg/dL @ 2026-03-12 | 정확 |
| synthetic-hospital-two-column-v0 | ast (AST) | 34 U/L @ 2026-07-28 | AST: 34 U/L @ 2026-07-28 | 정확 |
| synthetic-hospital-two-column-v0 | alt (ALT) | 23 U/L @ 2026-07-28 | ALT: 23 U/L @ 2026-07-28 | 정확 |
| synthetic-hospital-two-column-v0 | gamma-gtp (감마지티피) | 29 U/L @ 2026-07-28 | 감마지티피: 29 U/L @ 2026-07-28 | 정확 |
| synthetic-hospital-two-column-v0 | alp (ALP) | 41 U/L @ 2026-07-28 | ALP: 41 U/L @ 2026-07-28 | 정확 |
| synthetic-hospital-two-column-v0 | total-bilirubin (총빌리루빈) | 1.1 mg/dL @ 2026-07-28 | 총빌리루빈: 1.1 mg/dL @ 2026-07-28 | 정확 |
| synthetic-hospital-two-column-v0 | albumin (알부민) | 4.2 g/dL @ 2026-07-28 | 알부민: 4.2 g/dL @ 2026-07-28 | 정확 |
| synthetic-hospital-two-column-v0 | bun (BUN) | 16 mg/dL @ 2026-07-28 | BUN: 16 mg/dL @ 2026-07-28 | 정확 |
| synthetic-hospital-two-column-v0 | uric-acid (요산) | 5.0 mg/dL @ 2026-07-28 | 요산: 5.0 mg/dL @ 2026-07-28 | 정확 |
| synthetic-hospital-two-column-v1 | ast (AST) | 22 U/L @ 2026-06-18 | AST: 22 U/L @ 2026-06-18 | 정확 |
| synthetic-hospital-two-column-v1 | alt (ALT) | 22 U/L @ 2026-06-18 | ALT: 22 U/L @ 2026-06-18 | 정확 |
| synthetic-hospital-two-column-v1 | gamma-gtp (GGT) | 44 U/L @ 2026-06-18 | GGT: 44 U/L @ 2026-06-18 | 정확 |
| synthetic-hospital-two-column-v1 | alp (ALP) | 108 U/L @ 2026-06-18 | ALP: 108 U/L @ 2026-06-18 | 정확 |
| synthetic-hospital-two-column-v1 | total-bilirubin (Total Bilirubin) | 0.9 mg/dL @ 2026-06-18 | Total Bilirubin: 0.9 mg/dL @ 2026-06-18 | 정확 |
| synthetic-hospital-two-column-v1 | albumin (Albumin) | 3.9 g/dL @ 2026-06-18 | Albumin: 3.9 g/dL @ 2026-06-18 | 정확 |
| synthetic-hospital-two-column-v1 | bun (BUN) | 19 mg/dL @ 2026-06-18 | BUN: 19 mg/dL @ 2026-06-18 | 정확 |
| synthetic-hospital-two-column-v1 | uric-acid (Uric Acid) | 4.8 mg/dL @ 2026-06-18 | Uric Acid: 4.8 mg/dL @ 2026-06-18 | 정확 |
| synthetic-hospital-two-column-v2 | ast (AST) | 29 u/l @ 2026-05-09 | AST: 29 u/l @ 2026-05-09 | 정확 |
| synthetic-hospital-two-column-v2 | alt (ALT) | 18 u/l @ 2026-05-09 | ALT: 18 u/l @ 2026-05-09 | 정확 |
| synthetic-hospital-two-column-v2 | gamma-gtp (감마지티피) | 18 u/l @ 2026-05-09 | 감마지티피: 18 u/l @ 2026-05-09 | 정확 |
| synthetic-hospital-two-column-v2 | alp (ALP) | 41 u/l @ 2026-05-09 | ALP: 41 u/l @ 2026-05-09 | 정확 |
| synthetic-hospital-two-column-v2 | total-bilirubin (총빌리루빈) | 0.5 mg/dl @ 2026-05-09 | 총빌리루빈: 0.5 mg/dl @ 2026-05-09 | 정확 |
| synthetic-hospital-two-column-v2 | albumin (알부민) | 4.9 g/dl @ 2026-05-09 | 알부민: 4.9 g/dl @ 2026-05-09 | 정확 |
| synthetic-hospital-two-column-v2 | bun (BUN) | 9 mg/dl @ 2026-05-09 | BUN: 9 mg/dl @ 2026-05-09 | 정확 |
| synthetic-hospital-two-column-v2 | uric-acid (요산) | 4.9 mg/dl @ 2026-05-09 | 요산: 4.9 mg/dl @ 2026-05-09 | 정확 |
| synthetic-hospital-two-column-v3 | ast (AST) | 15.4 U/L @ 2026-04-21 | AST: 15.4 U/L @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | alt (ALT) | 17.2 U/L @ 2026-04-21 | ALT: 17.2 U/L @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | gamma-gtp (GGT) | 22.6 U/L @ 2026-04-21 | GGT: 22.6 U/L @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | alp (ALP) | 107.5 U/L @ 2026-04-21 | ALP: 107.5 U/L @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | total-bilirubin (Total Bilirubin) | 0.33 mg/dL @ 2026-04-21 | Total Bilirubin: 0.33 mg/dL @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | albumin (Albumin) | 4.60 g/dL @ 2026-04-21 | Albumin: 4.60 g/dL @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | bun (BUN) | 11.4 mg/dL @ 2026-04-21 | BUN: 11.4 mg/dL @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | uric-acid (Uric Acid) | 5.18 mg/dL @ 2026-04-21 | Uric Acid: 5.18 mg/dL @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v5 | ast (AST) | 34 U/L @ 2026-02-03 | AST: 34 U/L @ 2026-02-03 | 정확 |
| synthetic-hospital-two-column-v5 | alt (ALT) | 30 U/L @ 2026-02-03 | ALT: 30 U/L @ 2026-02-03 | 정확 |
| synthetic-hospital-two-column-v5 | gamma-gtp (감마지티피) | 42 U/L @ 2026-02-03 | 감마지티피: 42 U/L @ 2026-02-03 | 정확 |
| synthetic-hospital-two-column-v5 | alp (ALP) | 81 U/L @ 2026-02-03 | ALP: 81 U/L @ 2026-02-03 | 정확 |
| synthetic-hospital-two-column-v5 | total-bilirubin (총빌리루빈) | 0.6 mg/dL @ 2026-02-03 | 총빌리루빈: 0.6 mg/dL @ 2026-02-03 | 정확 |
| synthetic-hospital-two-column-v5 | albumin (알부민) | 4.4 g/dL @ 2026-02-03 | 알부민: 4.4 g/dL @ 2026-02-03 | 정확 |
| synthetic-hospital-two-column-v5 | bun (BUN) | 20 mg/dL @ 2026-02-03 | BUN: 20 mg/dL @ 2026-02-03 | 정확 |
| synthetic-hospital-two-column-v5 | uric-acid (요산) | 6.1 mg/dL @ 2026-02-03 | 요산: 6.1 mg/dL @ 2026-02-03 | 정확 |
| synthetic-center-summary-v0 | height (키) | 160.4 cm @ 2026-07-28 | 키: 160.4 cm @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | weight (체중) | 77.6 kg @ 2026-07-28 | 체중: 77.6 kg @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | bmi (BMI) | 20.3 kg/m2 @ 2026-07-28 | BMI: 20.3 kg/m2 @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | waist-circumference (허리둘레) | 85 cm @ 2026-07-28 | 허리둘레: 85 cm @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | systolic-blood-pressure (수축기 혈압) | 107 mmHg @ 2026-07-28 | 수축기 혈압: 107 mmHg @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | diastolic-blood-pressure (이완기 혈압) | 67 mmHg @ 2026-07-28 | 이완기 혈압: 67 mmHg @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | pulse (맥박) | 81 bpm @ 2026-07-28 | 맥박: 81 bpm @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | white-blood-cells (백혈구) | 7300 /uL @ 2026-07-28 | 백혈구: 7300 /uL @ 2026-07-28 | 정확 |
| synthetic-center-summary-v1 | height (Height) | 170.7 cm @ 2026-06-18 | Height: 170.7 cm @ 2026-06-18 | 정확 |
| synthetic-center-summary-v1 | weight (Weight) | 76.7 kg @ 2026-06-18 | Weight: 76.7 kg @ 2026-06-18 | 정확 |
| synthetic-center-summary-v1 | bmi (BMI) | 20.5 kg/m2 @ 2026-06-18 | BMI: 20.5 kg/m2 @ 2026-06-18 | 정확 |
| synthetic-center-summary-v1 | waist-circumference (Waist) | 72 cm @ 2026-06-18 | Waist: 72 cm @ 2026-06-18 | 정확 |
| synthetic-center-summary-v1 | systolic-blood-pressure (Systolic) | 112 mmHg @ 2026-06-18 | Systolic: 112 mmHg @ 2026-06-18 | 정확 |
| synthetic-center-summary-v1 | diastolic-blood-pressure (Diastolic) | 70 mmHg @ 2026-06-18 | Diastolic: 70 mmHg @ 2026-06-18 | 정확 |
| synthetic-center-summary-v1 | pulse (Pulse) | 76 bpm @ 2026-06-18 | Pulse: 76 bpm @ 2026-06-18 | 정확 |
| synthetic-center-summary-v1 | white-blood-cells (WBC) | 7600 /uL @ 2026-06-18 | WBC: 7600 /uL @ 2026-06-18 | 정확 |
| synthetic-center-summary-v2 | height (키) | 165.6 cm @ 2026-05-09 | 키: 165.6 cm @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | weight (체중) | 75.7 kg @ 2026-05-09 | 체중: 75.7 kg @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | bmi (BMI) | 22.2 kg/m2 @ 2026-05-09 | BMI: 22.2 kg/m2 @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | waist-circumference (허리둘레) | 85 cm @ 2026-05-09 | 허리둘레: 85 cm @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | systolic-blood-pressure (수축기 혈압) | 118 mmhg @ 2026-05-09 | 수축기 혈압: 118 mmhg @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | diastolic-blood-pressure (이완기 혈압) | 75 mmhg @ 2026-05-09 | 이완기 혈압: 75 mmhg @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | pulse (맥박) | 72 bpm @ 2026-05-09 | 맥박: 72 bpm @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | white-blood-cells (백혈구) | 7400 /ul @ 2026-05-09 | 백혈구: 7400 /ul @ 2026-05-09 | 정확 |
| synthetic-center-summary-v3 | height (Height) | 174.14 cm @ 2026-04-21 | Height: 174.14 cm @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | weight (Weight) | 74.88 kg @ 2026-04-21 | Weight: 74.88 kg @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | bmi (BMI) | 24.13 kg/m2 @ 2026-04-21 | BMI: 24.13 kg/m2 @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | waist-circumference (Waist) | 72.6 cm @ 2026-04-21 | Waist: 72.6 cm @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | systolic-blood-pressure (Systolic) | 123.1 mmHg @ 2026-04-21 | Systolic: 123.1 mmHg @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | diastolic-blood-pressure (Diastolic) | 79.1 mmHg @ 2026-04-21 | Diastolic: 79.1 mmHg @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | pulse (Pulse) | 65.7 bpm @ 2026-04-21 | Pulse: 65.7 bpm @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | white-blood-cells (WBC) | 7100 /uL @ 2026-04-21 | WBC: 7100 /uL @ 2026-04-21 | 정확 |
| synthetic-center-summary-v4 | height (키) | 173.3 cm @ 2026-03-12 | 키: 173.3 cm @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | weight (체중) | 67.0 kg @ 2026-03-12 | 체중: 67.0 kg @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | bmi (BMI) | 19.4 kg/m2 @ 2026-03-12 | BMI: 19.4 kg/m2 @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | waist-circumference (허리둘레) | 88 cm @ 2026-03-12 | 허리둘레: 88 cm @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | systolic-blood-pressure (수축기 혈압) | 119 mmHg @ 2026-03-12 | 수축기 혈압: 119 mmHg @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | diastolic-blood-pressure (이완기 혈압) | 74 mmHg @ 2026-03-12 | 이완기 혈압: 74 mmHg @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | pulse (맥박) | 68 bpm @ 2026-03-12 | 맥박: 68 bpm @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | white-blood-cells (백혈구) | 5,000 /uL @ 2026-03-12 | 백혈구: 5,000 /uL @ 2026-03-12 | 정확 |
| synthetic-center-summary-v5 | height (키) | 157.0 cm @ 2026-02-03 | 키: 157.0 cm @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | weight (체중) | 66.0 kg @ 2026-02-03 | 체중: 66.0 kg @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | bmi (BMI) | 21.3 kg/m2 @ 2026-02-03 | BMI: 21.3 kg/m2 @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | waist-circumference (허리둘레) | 71 cm @ 2026-02-03 | 허리둘레: 71 cm @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | systolic-blood-pressure (수축기 혈압) | 124 mmHg @ 2026-02-03 | 수축기 혈압: 124 mmHg @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | diastolic-blood-pressure (이완기 혈압) | 77 mmHg @ 2026-02-03 | 이완기 혈압: 77 mmHg @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | pulse (맥박) | 60 bpm @ 2026-02-03 | 맥박: 60 bpm @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | white-blood-cells (백혈구) | 4,800 /uL @ 2026-02-03 | 백혈구: 4,800 /uL @ 2026-02-03 | 정확 |
| synthetic-two-page-v0 | vitamin-d (비타민 D) | 49 ng/mL @ 2026-07-28 | 비타민 D: 49 ng/mL @ 2026-07-28 | 정확 |
| synthetic-two-page-v0 | tsh (TSH) | 3.03 uIU/mL @ 2026-07-28 | TSH: 3.03 uIU/mL @ 2026-07-28 | 정확 |
| synthetic-two-page-v0 | free-t4 (free T4) | 1.44 ng/dL @ 2026-07-28 | free T4: 1.44 ng/dL @ 2026-07-28 | 정확 |
| synthetic-two-page-v0 | crp (CRP) | 0.13 mg/L @ 2026-07-28 | CRP: 0.13 mg/L @ 2026-07-28 | 정확 |
| synthetic-two-page-v0 | ferritin (페리틴) | 149 ng/mL @ 2026-07-28 | 페리틴: 149 ng/mL @ 2026-07-28 | 정확 |
| synthetic-two-page-v0 | sodium (나트륨) | 141 mmol/L @ 2026-07-28 | 나트륨: 141 mmol/L @ 2026-07-28 | 정확 |
| synthetic-two-page-v0 | potassium (칼륨) | 4.4 mmol/L @ 2026-07-28 | 칼륨: 4.4 mmol/L @ 2026-07-28 | 정확 |
| synthetic-two-page-v0 | calcium (칼슘) | 9.4 mg/dL @ 2026-07-28 | 칼슘: 9.4 mg/dL @ 2026-07-28 | 정확 |
| synthetic-two-page-v0 | total-protein (총단백) | 6.7 g/dL @ 2026-07-28 | 총단백: 6.7 g/dL @ 2026-07-28 | 정확 |
| synthetic-two-page-v1 | vitamin-d (Vitamin D) | 37 ng/mL @ 2026-06-18 | Vitamin D: 37 ng/mL @ 2026-06-18 | 정확 |
| synthetic-two-page-v1 | tsh (TSH) | 3.12 uIU/mL @ 2026-06-18 | TSH: 3.12 uIU/mL @ 2026-06-18 | 정확 |
| synthetic-two-page-v1 | free-t4 (Free T4) | 1.42 ng/dL @ 2026-06-18 | Free T4: 1.42 ng/dL @ 2026-06-18 | 정확 |
| synthetic-two-page-v1 | crp (CRP) | 0.37 mg/L @ 2026-06-18 | CRP: 0.37 mg/L @ 2026-06-18 | 정확 |
| synthetic-two-page-v1 | ferritin (Ferritin) | 120 ng/mL @ 2026-06-18 | Ferritin: 120 ng/mL @ 2026-06-18 | 정확 |
| synthetic-two-page-v1 | sodium (Sodium) | 143 mmol/L @ 2026-06-18 | Sodium: 143 mmol/L @ 2026-06-18 | 정확 |
| synthetic-two-page-v1 | potassium (Potassium) | 4.7 mmol/L @ 2026-06-18 | Potassium: 4.7 mmol/L @ 2026-06-18 | 정확 |
| synthetic-two-page-v1 | calcium (Calcium) | 9.3 mg/dL @ 2026-06-18 | Calcium: 9.3 mg/dL @ 2026-06-18 | 정확 |
| synthetic-two-page-v1 | total-protein (Total Protein) | 7.7 g/dL @ 2026-06-18 | Total Protein: 7.7 g/dL @ 2026-06-18 | 정확 |
| synthetic-two-page-v2 | vitamin-d (비타민 D) | 53 ng/ml @ 2026-05-09 | 비타민 D: 53 ng/ml @ 2026-05-09 | 정확 |
| synthetic-two-page-v2 | tsh (TSH) | 3.20 uiu/ml @ 2026-05-09 | TSH: 3.20 uiu/ml @ 2026-05-09 | 정확 |
| synthetic-two-page-v2 | free-t4 (free T4) | 1.20 ng/dl @ 2026-05-09 | free T4: 1.20 ng/dl @ 2026-05-09 | 정확 |
| synthetic-two-page-v2 | crp (CRP) | 0.14 mg/l @ 2026-05-09 | CRP: 0.14 mg/l @ 2026-05-09 | 정확 |
| synthetic-two-page-v2 | ferritin (페리틴) | 66 ng/ml @ 2026-05-09 | 페리틴: 66 ng/ml @ 2026-05-09 | 정확 |
| synthetic-two-page-v2 | sodium (나트륨) | 137 mmol/l @ 2026-05-09 | 나트륨: 137 mmol/l @ 2026-05-09 | 정확 |
| synthetic-two-page-v2 | potassium (칼륨) | 3.7 mmol/l @ 2026-05-09 | 칼륨: 3.7 mmol/l @ 2026-05-09 | 정확 |
| synthetic-two-page-v2 | calcium (칼슘) | 9.3 mg/dl @ 2026-05-09 | 칼슘: 9.3 mg/dl @ 2026-05-09 | 정확 |
| synthetic-two-page-v2 | total-protein (총단백) | 7.5 g/dl @ 2026-05-09 | 총단백: 7.5 g/dl @ 2026-05-09 | 정확 |
| synthetic-two-page-v3 | vitamin-d (Vitamin D) | 42.7 ng/mL @ 2026-04-21 | Vitamin D: 42.7 ng/mL @ 2026-04-21 | 정확 |
| synthetic-two-page-v3 | tsh (TSH) | 3.291 uIU/mL @ 2026-04-21 | TSH: 3.291 uIU/mL @ 2026-04-21 | 정확 |
| synthetic-two-page-v3 | free-t4 (Free T4) | 0.954 ng/dL @ 2026-04-21 | Free T4: 0.954 ng/dL @ 2026-04-21 | 정확 |
| synthetic-two-page-v3 | crp (CRP) | 0.377 mg/L @ 2026-04-21 | CRP: 0.377 mg/L @ 2026-04-21 | 정확 |
| synthetic-two-page-v3 | ferritin (Ferritin) | 35.6 ng/mL @ 2026-04-21 | Ferritin: 35.6 ng/mL @ 2026-04-21 | 정확 |
| synthetic-two-page-v3 | sodium (Sodium) | 138.7 mmol/L @ 2026-04-21 | Sodium: 138.7 mmol/L @ 2026-04-21 | 정확 |
| synthetic-two-page-v3 | potassium (Potassium) | 4.03 mmol/L @ 2026-04-21 | Potassium: 4.03 mmol/L @ 2026-04-21 | 정확 |
| synthetic-two-page-v3 | calcium (Calcium) | 9.40 mg/dL @ 2026-04-21 | Calcium: 9.40 mg/dL @ 2026-04-21 | 정확 |
| synthetic-two-page-v3 | total-protein (Total Protein) | 6.93 g/dL @ 2026-04-21 | Total Protein: 6.93 g/dL @ 2026-04-21 | 정확 |
| synthetic-two-page-v4 | vitamin-d (비타민 D) | 47 ng/mL @ 2026-03-12 | 비타민 D: 47 ng/mL @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | tsh (TSH) | 2.06 uIU/mL @ 2026-03-12 | TSH: 2.06 uIU/mL @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | free-t4 (free T4) | 1.36 ng/dL @ 2026-03-12 | free T4: 1.36 ng/dL @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | crp (CRP) | 0.20 mg/L @ 2026-03-12 | CRP: 0.20 mg/L @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | ferritin (페리틴) | 87 ng/mL @ 2026-03-12 | 페리틴: 87 ng/mL @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | sodium (나트륨) | 139 mmol/L @ 2026-03-12 | 나트륨: 139 mmol/L @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | potassium (칼륨) | 4.6 mmol/L @ 2026-03-12 | 칼륨: 4.6 mmol/L @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | calcium (칼슘) | 9.5 mg/dL @ 2026-03-12 | 칼슘: 9.5 mg/dL @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | total-protein (총단백) | 7.1 g/dL @ 2026-03-12 | 총단백: 7.1 g/dL @ 2026-03-12 | 정확 |
| synthetic-two-page-v5 | vitamin-d (비타민 D) | 34 ng/mL @ 2026-02-03 | 비타민 D: 34 ng/mL @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | tsh (TSH) | 2.13 uIU/mL @ 2026-02-03 | TSH: 2.13 uIU/mL @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | free-t4 (free T4) | 1.52 ng/dL @ 2026-02-03 | free T4: 1.52 ng/dL @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | crp (CRP) | 0.29 mg/L @ 2026-02-03 | CRP: 0.29 mg/L @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | ferritin (페리틴) | 57 ng/mL @ 2026-02-03 | 페리틴: 57 ng/mL @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | sodium (나트륨) | 138 mmol/L @ 2026-02-03 | 나트륨: 138 mmol/L @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | potassium (칼륨) | 4.3 mmol/L @ 2026-02-03 | 칼륨: 4.3 mmol/L @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | calcium (칼슘) | 9.5 mg/dL @ 2026-02-03 | 칼슘: 9.5 mg/dL @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | total-protein (총단백) | 7.3 g/dL @ 2026-02-03 | 총단백: 7.3 g/dL @ 2026-02-03 | 정확 |
| synthetic-hospital-two-column-v6 | ast (AST) | 15 U/L @ 2026-01-20 | AST: 15 U/L @ 2026-01-20 | 정확 |
| synthetic-hospital-two-column-v6 | alt (ALT) | 10 U/L @ 2026-01-20 | ALT: 10 U/L @ 2026-01-20 | 정확 |
| synthetic-hospital-two-column-v6 | gamma-gtp (감마지티피) | 20 U/L @ 2026-01-20 | 감마지티피: 20 U/L @ 2026-01-20 | 정확 |
| synthetic-hospital-two-column-v6 | alp (ALP) | 68 U/L @ 2026-01-20 | ALP: 68 U/L @ 2026-01-20 | 정확 |
| synthetic-hospital-two-column-v6 | total-bilirubin (총빌리루빈) | 0.8 mg/dL @ 2026-01-20 | 총빌리루빈: 0.8 mg/dL @ 2026-01-20 | 정확 |
| synthetic-hospital-two-column-v6 | albumin (알부민) | 4.3 g/dL @ 2026-01-20 | 알부민: 4.3 g/dL @ 2026-01-20 | 정확 |
| synthetic-hospital-two-column-v6 | bun (BUN) | 9 mg/dL @ 2026-01-20 | BUN: 9 mg/dL @ 2026-01-20 | 정확 |
| synthetic-hospital-two-column-v6 | uric-acid (요산) | 6.2 mg/dL @ 2026-01-20 | 요산: 6.2 mg/dL @ 2026-01-20 | 정확 |

### ollama-medgemma-1.5-4b-page-image

| Document | Field | Expected | Returned | Outcome |
|---|---|---|---|---|
| synthetic-nhis-table-v0 | total-cholesterol (총콜레스테롤) | 177 mg/dL @ 2026-07-28 | 총콜레스테롤: 177 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | ldl-cholesterol (LDL 콜레스테롤) | 120 mg/dL @ 2026-07-28 | LDL 콜레스테롤: 120 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | hdl-cholesterol (HDL 콜레스테롤) | 61 mg/dL @ 2026-07-28 | HDL 콜레스테롤: 61 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | triglycerides (중성지방) | 61 mg/dL @ 2026-07-28 | 중성지방: 61 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | fasting-glucose (공복혈당) | 86 mg/dL @ 2026-07-28 | — | 누락 |
| synthetic-nhis-table-v0 | hba1c (당화혈색소) | 4.8 % @ 2026-07-28 | 당화혈색소: 4.8 % @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | hemoglobin (혈색소) | 14.1 g/dL @ 2026-07-28 | 혈색소: 14.1 g/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | creatinine (크레아티닌) | 0.95 mg/dL @ 2026-07-28 | 크레아티닌: 0.95 mg/dL @ 2026-07-28 | 정확 |
| synthetic-nhis-table-v0 | unknown-5 (경혈혈색소) | — | 경혈혈색소: 86 mg/dL @ 2026-07-28 | 환각 |
| synthetic-nhis-table-v1 | total-cholesterol (Total Cholesterol) | 157 mg/dL @ 2026-06-18 | Total Cholesterol: 157 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | ldl-cholesterol (LDL Cholesterol) | 122 mg/dL @ 2026-06-18 | LDL Cholesterol: 122 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | hdl-cholesterol (HDL Cholesterol) | 67 mg/dL @ 2026-06-18 | HDL Cholesterol: 67 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | triglycerides (Triglycerides) | 146 mg/dL @ 2026-06-18 | Triglycerides: 146 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | fasting-glucose (Fasting Glucose) | 81 mg/dL @ 2026-06-18 | Fasting Glucose: 81 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | hba1c (HbA1c) | 5.0 % @ 2026-06-18 | HbA1c: 5.0 % @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | hemoglobin (Hemoglobin) | 14.9 g/dL @ 2026-06-18 | Hemoglobin: 14.9 g/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v1 | creatinine (Creatinine) | 0.96 mg/dL @ 2026-06-18 | Creatinine: 0.96 mg/dL @ 2026-06-18 | 정확 |
| synthetic-nhis-table-v2 | total-cholesterol (총콜레스테롤) | 191 mg/dl @ 2026-05-09 | 총콜레스테롤: 191 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | ldl-cholesterol (LDL 콜레스테롤) | 124 mg/dl @ 2026-05-09 | LDL 콜레스테롤: 124 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | hdl-cholesterol (HDL 콜레스테롤) | 47 mg/dl @ 2026-05-09 | HDL 콜레스테롤: 47 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | triglycerides (중성지방) | 62 mg/dl @ 2026-05-09 | 중성지방: 62 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | fasting-glucose (공복혈당) | 97 mg/dl @ 2026-05-09 | — | 누락 |
| synthetic-nhis-table-v2 | hba1c (당화혈색소) | 5.4 % @ 2026-05-09 | 당화혈색소: 5.4 % @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | hemoglobin (혈색소) | 12.9 g/dl @ 2026-05-09 | 혈색소: 12.9 g/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | creatinine (크레아티닌) | 0.95 mg/dl @ 2026-05-09 | 크레아티닌: 0.95 mg/dl @ 2026-05-09 | 정확 |
| synthetic-nhis-table-v2 | unknown-5 (국화혈색소) | — | 국화혈색소: 97 mg/dl @ 2026-05-09 | 환각 |
| synthetic-nhis-table-v3 | total-cholesterol (Total Cholesterol) | 174.8 mg/dL @ 2026-04-21 | Total Cholesterol: 174.8 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | ldl-cholesterol (LDL Cholesterol) | 125.5 mg/dL @ 2026-04-21 | LDL Cholesterol: 125.5 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | hdl-cholesterol (HDL Cholesterol) | 56.7 mg/dL @ 2026-04-21 | HDL Cholesterol: 56.7 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | triglycerides (Triglycerides) | 146.4 mg/dL @ 2026-04-21 | Triglycerides: 146.4 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | fasting-glucose (Fasting Glucose) | 92.5 mg/dL @ 2026-04-21 | Fasting Glucose: 92.5 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | hba1c (HbA1c) | 5.56 % @ 2026-04-21 | HbA1c: 5.56 % @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | hemoglobin (Hemoglobin) | 13.80 g/dL @ 2026-04-21 | Hemoglobin: 13.80 g/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v3 | creatinine (Creatinine) | 0.929 mg/dL @ 2026-04-21 | Creatinine: 0.929 mg/dL @ 2026-04-21 | 정확 |
| synthetic-nhis-table-v4 | total-cholesterol (총콜레스테롤) | 152 mg/dL @ 2026-03-12 | 총콜레스테롤: 152 mg/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | ldl-cholesterol (LDL 콜레스테롤) | 111 mg/dL @ 2026-03-12 | LDL 콜레스테롤: 111 mg/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | hdl-cholesterol (HDL 콜레스테롤) | 59 mg/dL @ 2026-03-12 | HDL 콜레스테롤: 59 mg/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | triglycerides (중성지방) | 75 mg/dL @ 2026-03-12 | 중성지방: 75 mg/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | fasting-glucose (공복혈당) | 98 mg/dL @ 2026-03-12 | — | 누락 |
| synthetic-nhis-table-v4 | hba1c (당화혈색소) | 5.2 % @ 2026-03-12 | 당화혈색소: 5.2 % @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | hemoglobin (혈색소) | 12.8 g/dL @ 2026-03-12 | 혈색소: 12.8 g/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | creatinine (크레아티닌) | 0.72 mg/dL @ 2026-03-12 | 크레아티닌: 0.72 mg/dL @ 2026-03-12 | 정확 |
| synthetic-nhis-table-v4 | unknown-5 (경혈당) | — | 경혈당: 98 mg/dL @ 2026-03-12 | 환각 |
| synthetic-hospital-two-column-v0 | ast (AST) | 34 U/L @ 2026-07-28 | — | 누락 |
| synthetic-hospital-two-column-v0 | alt (ALT) | 23 U/L @ 2026-07-28 | — | 누락 |
| synthetic-hospital-two-column-v0 | gamma-gtp (감마지티피) | 29 U/L @ 2026-07-28 | — | 누락 |
| synthetic-hospital-two-column-v0 | alp (ALP) | 41 U/L @ 2026-07-28 | — | 누락 |
| synthetic-hospital-two-column-v0 | total-bilirubin (총빌리루빈) | 1.1 mg/dL @ 2026-07-28 | — | 누락 |
| synthetic-hospital-two-column-v0 | albumin (알부민) | 4.2 g/dL @ 2026-07-28 | — | 누락 |
| synthetic-hospital-two-column-v0 | bun (BUN) | 16 mg/dL @ 2026-07-28 | — | 누락 |
| synthetic-hospital-two-column-v0 | uric-acid (요산) | 5.0 mg/dL @ 2026-07-28 | — | 누락 |
| synthetic-hospital-two-column-v1 | ast (AST) | 22 U/L @ 2026-06-18 | — | 누락 |
| synthetic-hospital-two-column-v1 | alt (ALT) | 22 U/L @ 2026-06-18 | — | 누락 |
| synthetic-hospital-two-column-v1 | gamma-gtp (GGT) | 44 U/L @ 2026-06-18 | — | 누락 |
| synthetic-hospital-two-column-v1 | alp (ALP) | 108 U/L @ 2026-06-18 | — | 누락 |
| synthetic-hospital-two-column-v1 | total-bilirubin (Total Bilirubin) | 0.9 mg/dL @ 2026-06-18 | — | 누락 |
| synthetic-hospital-two-column-v1 | albumin (Albumin) | 3.9 g/dL @ 2026-06-18 | — | 누락 |
| synthetic-hospital-two-column-v1 | bun (BUN) | 19 mg/dL @ 2026-06-18 | — | 누락 |
| synthetic-hospital-two-column-v1 | uric-acid (Uric Acid) | 4.8 mg/dL @ 2026-06-18 | — | 누락 |
| synthetic-hospital-two-column-v1 | unknown-1 (검사 항목) | — | 검사 항목: AST U/L @ 2022-06-18 | 환각 |
| synthetic-hospital-two-column-v1 | unknown-2 (검사 항목) | — | 검사 항목: ALT U/L @ 2022-06-18 | 환각 |
| synthetic-hospital-two-column-v1 | unknown-3 (검사 항목) | — | 검사 항목: GGT U/L @ 2022-06-18 | 환각 |
| synthetic-hospital-two-column-v1 | unknown-4 (검사 항목) | — | 검사 항목: ALP U/L @ 2022-06-18 | 환각 |
| synthetic-hospital-two-column-v1 | unknown-5 (검사 항목) | — | 검사 항목: Total Bilirubin mg/dL @ 2022-06-18 | 환각 |
| synthetic-hospital-two-column-v1 | unknown-6 (검사 항목) | — | 검사 항목: Albumin g/dL @ 2022-06-18 | 환각 |
| synthetic-hospital-two-column-v1 | unknown-7 (검사 항목) | — | 검사 항목: BUN mg/dL @ 2022-06-18 | 환각 |
| synthetic-hospital-two-column-v1 | unknown-8 (검사 항목) | — | 검사 항목: Uric Acid mg/dL @ 2022-06-18 | 환각 |
| synthetic-hospital-two-column-v2 | ast (AST) | 29 u/l @ 2026-05-09 | — | 누락 |
| synthetic-hospital-two-column-v2 | alt (ALT) | 18 u/l @ 2026-05-09 | — | 누락 |
| synthetic-hospital-two-column-v2 | gamma-gtp (감마지티피) | 18 u/l @ 2026-05-09 | — | 누락 |
| synthetic-hospital-two-column-v2 | alp (ALP) | 41 u/l @ 2026-05-09 | — | 누락 |
| synthetic-hospital-two-column-v2 | total-bilirubin (총빌리루빈) | 0.5 mg/dl @ 2026-05-09 | — | 누락 |
| synthetic-hospital-two-column-v2 | albumin (알부민) | 4.9 g/dl @ 2026-05-09 | — | 누락 |
| synthetic-hospital-two-column-v2 | bun (BUN) | 9 mg/dl @ 2026-05-09 | — | 누락 |
| synthetic-hospital-two-column-v2 | uric-acid (요산) | 4.9 mg/dl @ 2026-05-09 | — | 누락 |
| synthetic-hospital-two-column-v3 | ast (AST) | 15.4 U/L @ 2026-04-21 | AST: 15.4 U/L @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | alt (ALT) | 17.2 U/L @ 2026-04-21 | ALT: 17.2 U/L @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | gamma-gtp (GGT) | 22.6 U/L @ 2026-04-21 | GGT: 22.6 U/L @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | alp (ALP) | 107.5 U/L @ 2026-04-21 | ALP: 107.5 U/L @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | total-bilirubin (Total Bilirubin) | 0.33 mg/dL @ 2026-04-21 | Total Bilirubin: 0.33 mg/dL @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | albumin (Albumin) | 4.60 g/dL @ 2026-04-21 | Albumin: 4.60 g/dL @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | bun (BUN) | 11.4 mg/dL @ 2026-04-21 | BUN: 11.4 mg/dL @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v3 | uric-acid (Uric Acid) | 5.18 mg/dL @ 2026-04-21 | Uric Acid: 5.18 mg/dL @ 2026-04-21 | 정확 |
| synthetic-hospital-two-column-v5 | ast (AST) | 34 U/L @ 2026-02-03 | — | 누락 |
| synthetic-hospital-two-column-v5 | alt (ALT) | 30 U/L @ 2026-02-03 | — | 누락 |
| synthetic-hospital-two-column-v5 | gamma-gtp (감마지티피) | 42 U/L @ 2026-02-03 | — | 누락 |
| synthetic-hospital-two-column-v5 | alp (ALP) | 81 U/L @ 2026-02-03 | — | 누락 |
| synthetic-hospital-two-column-v5 | total-bilirubin (총빌리루빈) | 0.6 mg/dL @ 2026-02-03 | — | 누락 |
| synthetic-hospital-two-column-v5 | albumin (알부민) | 4.4 g/dL @ 2026-02-03 | — | 누락 |
| synthetic-hospital-two-column-v5 | bun (BUN) | 20 mg/dL @ 2026-02-03 | — | 누락 |
| synthetic-hospital-two-column-v5 | uric-acid (요산) | 6.1 mg/dL @ 2026-02-03 | — | 누락 |
| synthetic-center-summary-v0 | height (키) | 160.4 cm @ 2026-07-28 | 키: 160.4 cm @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | weight (체중) | 77.6 kg @ 2026-07-28 | 체중: 77.6 kg @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | bmi (BMI) | 20.3 kg/m2 @ 2026-07-28 | BMI: 20.3 kg/m2 @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | waist-circumference (허리둘레) | 85 cm @ 2026-07-28 | 허리둘레: 85 cm @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | systolic-blood-pressure (수축기 혈압) | 107 mmHg @ 2026-07-28 | — | 누락 |
| synthetic-center-summary-v0 | diastolic-blood-pressure (이완기 혈압) | 67 mmHg @ 2026-07-28 | — | 누락 |
| synthetic-center-summary-v0 | pulse (맥박) | 81 bpm @ 2026-07-28 | 맥박: 81 bpm @ 2026-07-28 | 정확 |
| synthetic-center-summary-v0 | white-blood-cells (백혈구) | 7300 /uL @ 2026-07-28 | 백혈구: 7300 u/L @ 2026-07-28 | 오답 |
| synthetic-center-summary-v0 | unknown-5 (수축 혈압) | — | 수축 혈압: 107 mmHg @ 2026-07-28 | 환각 |
| synthetic-center-summary-v0 | unknown-6 (이완 혈압) | — | 이완 혈압: 67 mmHg @ 2026-07-28 | 환각 |
| synthetic-center-summary-v1 | height (Height) | 170.7 cm @ 2026-06-18 | Height: 170.7 cm @ 2022-06-18 | 오답 |
| synthetic-center-summary-v1 | weight (Weight) | 76.7 kg @ 2026-06-18 | Weight: 76.7 kg @ 2022-06-18 | 오답 |
| synthetic-center-summary-v1 | bmi (BMI) | 20.5 kg/m2 @ 2026-06-18 | BMI: 20.5 kg/m2 @ 2022-06-18 | 오답 |
| synthetic-center-summary-v1 | waist-circumference (Waist) | 72 cm @ 2026-06-18 | Waist: 72 cm @ 2022-06-18 | 오답 |
| synthetic-center-summary-v1 | systolic-blood-pressure (Systolic) | 112 mmHg @ 2026-06-18 | Systolic: 112 mmHg @ 2022-06-18 | 오답 |
| synthetic-center-summary-v1 | diastolic-blood-pressure (Diastolic) | 70 mmHg @ 2026-06-18 | Diastolic: 70 mmHg @ 2022-06-18 | 오답 |
| synthetic-center-summary-v1 | pulse (Pulse) | 76 bpm @ 2026-06-18 | Pulse: 76 bpm @ 2022-06-18 | 오답 |
| synthetic-center-summary-v1 | white-blood-cells (WBC) | 7600 /uL @ 2026-06-18 | WBC: 7600 ul @ 2022-06-18 | 오답 |
| synthetic-center-summary-v2 | height (키) | 165.6 cm @ 2026-05-09 | 키: 165.6 cm @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | weight (체중) | 75.7 kg @ 2026-05-09 | 체중: 75.7 kg @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | bmi (BMI) | 22.2 kg/m2 @ 2026-05-09 | BMI: 22.2 kg/m2 @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | waist-circumference (허리둘레) | 85 cm @ 2026-05-09 | 허리둘레: 85 cm @ 2026-05-09 | 정확 |
| synthetic-center-summary-v2 | systolic-blood-pressure (수축기 혈압) | 118 mmhg @ 2026-05-09 | — | 누락 |
| synthetic-center-summary-v2 | diastolic-blood-pressure (이완기 혈압) | 75 mmhg @ 2026-05-09 | — | 누락 |
| synthetic-center-summary-v2 | pulse (맥박) | 72 bpm @ 2026-05-09 | — | 누락 |
| synthetic-center-summary-v2 | white-blood-cells (백혈구) | 7400 /ul @ 2026-05-09 | 백혈구: 72 bpm @ 2026-05-09 | 오답 |
| synthetic-center-summary-v2 | unknown-5 (수축혈압) | — | 수축혈압: 118 mmHg @ 2026-05-09 | 환각 |
| synthetic-center-summary-v2 | unknown-6 (이완혈압) | — | 이완혈압: 75 mmHg @ 2026-05-09 | 환각 |
| synthetic-center-summary-v2 | white-blood-cells-2 (백혈구) | — | 백혈구: 7400 u/l @ 2026-05-09 | 환각 |
| synthetic-center-summary-v3 | height (Height) | 174.14 cm @ 2026-04-21 | Height: 174.14 cm @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | weight (Weight) | 74.88 kg @ 2026-04-21 | Weight: 74.88 kg @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | bmi (BMI) | 24.13 kg/m2 @ 2026-04-21 | BMI: 24.13 kg/m2 @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | waist-circumference (Waist) | 72.6 cm @ 2026-04-21 | Waist: 72.6 cm @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | systolic-blood-pressure (Systolic) | 123.1 mmHg @ 2026-04-21 | Systolic: 123.1 mmHg @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | diastolic-blood-pressure (Diastolic) | 79.1 mmHg @ 2026-04-21 | Diastolic: 79.1 mmHg @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | pulse (Pulse) | 65.7 bpm @ 2026-04-21 | Pulse: 65.7 bpm @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | white-blood-cells (WBC) | 7100 /uL @ 2026-04-21 | WBC: 7100 /uL @ 2026-04-21 | 정확 |
| synthetic-center-summary-v3 | ldl-cholesterol (LDL Cholesterol) | — | LDL Cholesterol: 110 mg/dL @ 2026-04-21 | 환각 |
| synthetic-center-summary-v4 | height (키) | 173.3 cm @ 2026-03-12 | 키: 173.3 cm @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | weight (체중) | 67.0 kg @ 2026-03-12 | 체중: 67.0 kg @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | bmi (BMI) | 19.4 kg/m2 @ 2026-03-12 | BMI: 19.4 kg/m2 @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | waist-circumference (허리둘레) | 88 cm @ 2026-03-12 | 허리둘레: 88 cm @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | systolic-blood-pressure (수축기 혈압) | 119 mmHg @ 2026-03-12 | — | 누락 |
| synthetic-center-summary-v4 | diastolic-blood-pressure (이완기 혈압) | 74 mmHg @ 2026-03-12 | — | 누락 |
| synthetic-center-summary-v4 | pulse (맥박) | 68 bpm @ 2026-03-12 | 맥박: 68 bpm @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | white-blood-cells (백혈구) | 5,000 /uL @ 2026-03-12 | 백혈구: 5,000 /uL @ 2026-03-12 | 정확 |
| synthetic-center-summary-v4 | unknown-5 (수축혈압) | — | 수축혈압: 119 mmHg @ 2026-03-12 | 환각 |
| synthetic-center-summary-v4 | unknown-6 (이완혈압) | — | 이완혈압: 74 mmHg @ 2026-03-12 | 환각 |
| synthetic-center-summary-v5 | height (키) | 157.0 cm @ 2026-02-03 | 키: 157.0 cm @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | weight (체중) | 66.0 kg @ 2026-02-03 | 체중: 66.0 kg @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | bmi (BMI) | 21.3 kg/m2 @ 2026-02-03 | BMI: 21.3 kg/m2 @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | waist-circumference (허리둘레) | 71 cm @ 2026-02-03 | 허리둘레: 71 cm @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | systolic-blood-pressure (수축기 혈압) | 124 mmHg @ 2026-02-03 | — | 누락 |
| synthetic-center-summary-v5 | diastolic-blood-pressure (이완기 혈압) | 77 mmHg @ 2026-02-03 | — | 누락 |
| synthetic-center-summary-v5 | pulse (맥박) | 60 bpm @ 2026-02-03 | 맥박: 60 bpm @ 2026-02-03 | 정확 |
| synthetic-center-summary-v5 | white-blood-cells (백혈구) | 4,800 /uL @ 2026-02-03 | 백혈구: 4,800 /UL @ 2026-02-03 | 오답 |
| synthetic-center-summary-v5 | unknown-5 (수축혈압) | — | 수축혈압: 124 mmHg @ 2026-02-03 | 환각 |
| synthetic-center-summary-v5 | unknown-6 (이완혈압) | — | 이완혈압: 77 mmHg @ 2026-02-03 | 환각 |
| synthetic-two-page-v0 | vitamin-d (비타민 D) | 49 ng/mL @ 2026-07-28 | — | 누락 |
| synthetic-two-page-v0 | tsh (TSH) | 3.03 uIU/mL @ 2026-07-28 | — | 누락 |
| synthetic-two-page-v0 | free-t4 (free T4) | 1.44 ng/dL @ 2026-07-28 | — | 누락 |
| synthetic-two-page-v0 | crp (CRP) | 0.13 mg/L @ 2026-07-28 | — | 누락 |
| synthetic-two-page-v0 | ferritin (페리틴) | 149 ng/mL @ 2026-07-28 | — | 누락 |
| synthetic-two-page-v0 | sodium (나트륨) | 141 mmol/L @ 2026-07-28 | — | 누락 |
| synthetic-two-page-v0 | potassium (칼륨) | 4.4 mmol/L @ 2026-07-28 | — | 누락 |
| synthetic-two-page-v0 | calcium (칼슘) | 9.4 mg/dL @ 2026-07-28 | — | 누락 |
| synthetic-two-page-v0 | total-protein (총단백) | 6.7 g/dL @ 2026-07-28 | — | 누락 |
| synthetic-two-page-v1 | vitamin-d (Vitamin D) | 37 ng/mL @ 2026-06-18 | — | 누락 |
| synthetic-two-page-v1 | tsh (TSH) | 3.12 uIU/mL @ 2026-06-18 | — | 누락 |
| synthetic-two-page-v1 | free-t4 (Free T4) | 1.42 ng/dL @ 2026-06-18 | — | 누락 |
| synthetic-two-page-v1 | crp (CRP) | 0.37 mg/L @ 2026-06-18 | — | 누락 |
| synthetic-two-page-v1 | ferritin (Ferritin) | 120 ng/mL @ 2026-06-18 | — | 누락 |
| synthetic-two-page-v1 | sodium (Sodium) | 143 mmol/L @ 2026-06-18 | — | 누락 |
| synthetic-two-page-v1 | potassium (Potassium) | 4.7 mmol/L @ 2026-06-18 | — | 누락 |
| synthetic-two-page-v1 | calcium (Calcium) | 9.3 mg/dL @ 2026-06-18 | — | 누락 |
| synthetic-two-page-v1 | total-protein (Total Protein) | 7.7 g/dL @ 2026-06-18 | — | 누락 |
| synthetic-two-page-v2 | vitamin-d (비타민 D) | 53 ng/ml @ 2026-05-09 | — | 누락 |
| synthetic-two-page-v2 | tsh (TSH) | 3.20 uiu/ml @ 2026-05-09 | — | 누락 |
| synthetic-two-page-v2 | free-t4 (free T4) | 1.20 ng/dl @ 2026-05-09 | — | 누락 |
| synthetic-two-page-v2 | crp (CRP) | 0.14 mg/l @ 2026-05-09 | — | 누락 |
| synthetic-two-page-v2 | ferritin (페리틴) | 66 ng/ml @ 2026-05-09 | — | 누락 |
| synthetic-two-page-v2 | sodium (나트륨) | 137 mmol/l @ 2026-05-09 | — | 누락 |
| synthetic-two-page-v2 | potassium (칼륨) | 3.7 mmol/l @ 2026-05-09 | — | 누락 |
| synthetic-two-page-v2 | calcium (칼슘) | 9.3 mg/dl @ 2026-05-09 | — | 누락 |
| synthetic-two-page-v2 | total-protein (총단백) | 7.5 g/dl @ 2026-05-09 | — | 누락 |
| synthetic-two-page-v3 | vitamin-d (Vitamin D) | 42.7 ng/mL @ 2026-04-21 | — | 누락 |
| synthetic-two-page-v3 | tsh (TSH) | 3.291 uIU/mL @ 2026-04-21 | — | 누락 |
| synthetic-two-page-v3 | free-t4 (Free T4) | 0.954 ng/dL @ 2026-04-21 | — | 누락 |
| synthetic-two-page-v3 | crp (CRP) | 0.377 mg/L @ 2026-04-21 | — | 누락 |
| synthetic-two-page-v3 | ferritin (Ferritin) | 35.6 ng/mL @ 2026-04-21 | — | 누락 |
| synthetic-two-page-v3 | sodium (Sodium) | 138.7 mmol/L @ 2026-04-21 | — | 누락 |
| synthetic-two-page-v3 | potassium (Potassium) | 4.03 mmol/L @ 2026-04-21 | — | 누락 |
| synthetic-two-page-v3 | calcium (Calcium) | 9.40 mg/dL @ 2026-04-21 | — | 누락 |
| synthetic-two-page-v3 | total-protein (Total Protein) | 6.93 g/dL @ 2026-04-21 | — | 누락 |
| synthetic-two-page-v4 | vitamin-d (비타민 D) | 47 ng/mL @ 2026-03-12 | 비타민 D: 47 ng/mL @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | tsh (TSH) | 2.06 uIU/mL @ 2026-03-12 | TSH: 2.06 uIU/mL @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | free-t4 (free T4) | 1.36 ng/dL @ 2026-03-12 | Free T4: 1.36 ng/dL @ 2026-03-12 | 오답 |
| synthetic-two-page-v4 | crp (CRP) | 0.20 mg/L @ 2026-03-12 | CRP: 0.20 mg/L @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | ferritin (페리틴) | 87 ng/mL @ 2026-03-12 | 페리틴: 87 ng/mL @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | sodium (나트륨) | 139 mmol/L @ 2026-03-12 | 나트륨: 139 mmol/L @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | potassium (칼륨) | 4.6 mmol/L @ 2026-03-12 | 칼륨: 4.6 mmol/L @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | calcium (칼슘) | 9.5 mg/dL @ 2026-03-12 | 칼슘: 9.5 mg/dL @ 2026-03-12 | 정확 |
| synthetic-two-page-v4 | total-protein (총단백) | 7.1 g/dL @ 2026-03-12 | 총단백: 7.1 g/dL @ 2026-03-12 | 정확 |
| synthetic-two-page-v5 | vitamin-d (비타민 D) | 34 ng/mL @ 2026-02-03 | 비타민 D: 34 ng/mL @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | tsh (TSH) | 2.13 uIU/mL @ 2026-02-03 | TSH: 2.13 uIU/mL @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | free-t4 (free T4) | 1.52 ng/dL @ 2026-02-03 | Free T4: 1.52 ng/dL @ 2026-02-03 | 오답 |
| synthetic-two-page-v5 | crp (CRP) | 0.29 mg/L @ 2026-02-03 | CRP: 0.29 mg/L @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | ferritin (페리틴) | 57 ng/mL @ 2026-02-03 | 페리틴: 57 ng/mL @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | sodium (나트륨) | 138 mmol/L @ 2026-02-03 | 나트륨: 138 mmol/L @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | potassium (칼륨) | 4.3 mmol/L @ 2026-02-03 | 칼륨: 4.3 mmol/L @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | calcium (칼슘) | 9.5 mg/dL @ 2026-02-03 | 칼슘: 9.5 mg/dL @ 2026-02-03 | 정확 |
| synthetic-two-page-v5 | total-protein (총단백) | 7.3 g/dL @ 2026-02-03 | 총단백: 7.3 g/dL @ 2026-02-03 | 정확 |
| synthetic-hospital-two-column-v6 | ast (AST) | 15 U/L @ 2026-01-20 | — | 누락 |
| synthetic-hospital-two-column-v6 | alt (ALT) | 10 U/L @ 2026-01-20 | — | 누락 |
| synthetic-hospital-two-column-v6 | gamma-gtp (감마지티피) | 20 U/L @ 2026-01-20 | — | 누락 |
| synthetic-hospital-two-column-v6 | alp (ALP) | 68 U/L @ 2026-01-20 | — | 누락 |
| synthetic-hospital-two-column-v6 | total-bilirubin (총빌리루빈) | 0.8 mg/dL @ 2026-01-20 | — | 누락 |
| synthetic-hospital-two-column-v6 | albumin (알부민) | 4.3 g/dL @ 2026-01-20 | — | 누락 |
| synthetic-hospital-two-column-v6 | bun (BUN) | 9 mg/dL @ 2026-01-20 | — | 누락 |
| synthetic-hospital-two-column-v6 | uric-acid (요산) | 6.2 mg/dL @ 2026-01-20 | — | 누락 |


## Run 3 (num_ctx 8192)

같은 코퍼스, 같은 채점기, 같은 프롬프트·스키마·시드. 바뀐 것은 `num_ctx: 8192`(이전 실행은 Ollama 기본값) 하나이며, 프로토콜 digest가 그에 따라 바뀌었다. 증거 전용이며 게이트가 아니다.

| Pin | Value |
|---|---|
| Run window | 2026-09-17T06:08:57.490Z → 2026-09-17T06:16:39.881Z |
| Protocol digest (prompt, schema, options) | f50c1ba2d46ea9771335bf8be68d7238a7aabbb8eb6f14c35a9e8bce934f0528 |
| Options | think=false, temperature=0, seed=7, num_predict=4096, num_ctx=8192, keep_alive=10m, document timeout 180 s |
| Model | medgemma1.5:latest · id 433252621ab154668b5d8be6aff6c1b771bacba045e46e6193da8d6ad1630f2c · blob sha256:a051c2bd4ab8d5b7f4df8eec344f2fdd603efb2d098da799dc16c95e9e8bc838 |
| Ollama | 0.34.1 at http://127.0.0.1:11434 |
| GPU / driver / `ollama ps` PROCESSOR | NVIDIA GeForce RTX 3070, driver 610.74, 8192 MiB · `100% GPU` (`ollama ps` also reported CONTEXT 8192) |
| Corpus | synthetic-ko-checkup-r2-e6befc286ae6ce1d (25 documents); corpus.json sha256 587b72d04cf35f8ae1d90be0e2101ade8ce84cd3f2bec9e333b7e7186bdcf241 (gold gained `expectedReferenceRangeText` this wave; PDF bytes unchanged; corpus digest sha256 of PDF digest + corpus.json sha256 changed to 7249f8c349d040c6ca83d6e1cf35b30e30a6d4765360a5c2df3bb7e98cfc40dc accordingly) |
| Script commit | 1c28787a24abaa2e4979f6454b0941242ca253bf |
| Unreadable documents | 7 |
| done_reason on failed documents | length=7 |
| Full report (not committed) | apps/web/build/medgemma/medgemma-local-experiment-run3.md |

| Metric (model column) | Run 2 (num_predict 4096) | Run 3 (num_ctx 8192) |
|---|---|---|
| Field F1 | 56.9% | 61.3% |
| Required abstention recall | 40.0% | 40.0% |
| Hallucinated measurements | 21 (17.1%) | 14 (10.5%) |
| Unreadable documents | 9 (done_reason length=9) | 7 (done_reason length=7) |

관찰: 미해독 문서 수는 9에서 7로 바뀌었고 done_reason 분포는 두 실행 모두 전부 `length`였다. Field F1은 56.9%에서 61.3%로, 환각 측정치는 21건(17.1%)에서 14건(10.5%)으로 바뀌었고 required abstention recall은 40.0%로 동일했다. 실패한 문서들의 eval_count는 이번 실행에서도 상한(4096)에 도달했다 — num_ctx를 8192로 올린 뒤에도 num_predict 상한 자체는 동일하게 소진되었다는 뜻이며, 이 수치가 num_ctx 변경의 원인 효과를 증명하지는 않는다. `referenceRangeAccuracy`는 이 실행의 medgemma-experiment 보고서(나란히 표)에는 나타나지 않았다 — 채점기 내부에는 필드가 존재하지만 이 보고서 렌더러는 두 파이프라인 열 어디에도 그 값을 인쇄하지 않았으므로 관측치가 없다. 실행 중 `ollama ps`는 `100% GPU`를 보고했다.

## 한계

- Run 3(num_ctx 8192)은 컨텍스트 길이 하나만 바꾼 1회 실행이다. 위 표의 수치 변화는 관찰일 뿐 원인을 증명하지 않으며, 세 실행 모두 evidence only이고 게이트가 아니다.
- 합성 페이지 이미지 25장짜리 결과지 31쪽에 대한 1회 실행이다. 실제 결과지·실제 스캔·실 PHI는 사용하지 않았다. 결과는 "이 프로토콜(고정된 프롬프트·스키마·옵션) 아래의 MedGemma 1.5"를 측정한 것이지, 모델 일반의 성능 주장이 아니다.
- 이전 실행(2026-09-16, num_predict=2048)의 미해독 문서 9개(문서별 표 기준)는 2048-토큰 상한과 시점이 맞아떨어질 뿐, 원인이 그것이라고 증명되지는 않았다. 이번 실행은 num_predict를 4096으로 올리고 "군더더기 공백·반복 없이 간결하게"라는 문장을 시스템 프롬프트에 추가했다. 그 결과 미해독 문서는 9개로, done_reason은 전부 `length`였고(관측된 eval_count는 대부분 3494 부근으로 4096에 못 미쳤다) — 즉 num_predict 자체보다 이미지 토큰을 포함한 컨텍스트 예산이 실질적인 병목이었을 가능성이 있다. 실패한 각 페이지의 원문 응답은 `apps/web/build/medgemma/raw/<documentId>-failed.json`에 보존했다(저장소에는 커밋하지 않음).
- 런너 실패(타임아웃·HTTP 오류·JSON 파싱 실패)는 채점기에서 `fieldId: "runner-failure"`로만 기록되며, 골드의 문서 단위 필수 보류(`fieldId: "document"`)와 절대 일치하지 않는다 — required-abstention-recall 지표는 런너가 고장 났을 때를 모델이 옳게 인식한 것으로 절대 인정하지 않는다.
- 모델이 옮겨 적은 `unit` 필드에 원문의 참고치 구간(예: "U/L (15-35)")이 그대로 섞여 들어오는 경우가 있어, 채점 전에 워커의 `rangeText` 규칙과 같은 방식으로 후행 구간 텍스트를 제거한다(`stripUnitRange`). 단위 자체만 있는 값(예: "%")은 그대로 둔다.
- 모델은 박스를 주지 않으므로 evidence localization은 측정하지 않았다. 페이지 단위 박스는 채점기 입력 형식을 맞추기 위한 것이다.
- 모델 출력은 `apps/web/build/medgemma/`에만 있고 저장소에 커밋하지 않는다. 제품 코드 경로(core·worker·web 런타임)는 모델을 호출하지 않는다.
- 이 문서는 handoff 조건 1(약관 수락)만 충족한 bounded local experiment의 증거이며, 조건 2–7(아티팩트 영수증·검토된 OCI 이미지·서명 승인·재해시 런처·샌드박스 실행·digest 결합 admission)은 열려 있다. `release/readiness.json`과 "OCR·의료 AI 비활성" 문구는 바뀌지 않는다.
- 진단·정상/비정상·참고치·위험·치료에 대한 주장은 없다.
- 이전 실행(2026-09-16, num_predict=2048) 대비 참고: field F1 50.2% → 56.9%, required abstention recall 10.0% → 40.0%, hallucinated measurements 32(26.4%) → 21(17.1%). 두 실행 모두 evidence only이며 게이트가 아니다.
