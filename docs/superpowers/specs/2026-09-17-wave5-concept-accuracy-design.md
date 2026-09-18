# Wave 5 — 개념 정확도: 결과지 표기 보존 · 별칭 정리 · 단위 가드 · LOINC 감사 · 카탈로그 확장 (디자인, 2026-09-17)

상태: founder 승인(2026-09-17 대화, "승인, 스펙→플랜→실행"). 게이트 없음 — 모든 항목이 주장을 좁히거나 원문을 보존한다. 기준: `PHI_MASTER_PRODUCT_DOCUMENT.md` "절대 보존해야 하는 것", §7(Canonical Health Event), §27(FHIR). 근거: Wave 4 최종 리뷰 I4(별칭이 문서가 말하지 않은 것을 주장)와 이번 카탈로그 점검. 저장소 authority: `PROJECT_GUIDE.md` §6, `AGENTS.md`.

## 0. 한 문장

결과지에 적힌 항목 이름을 버리지 않고 보존해 보여주고, 별칭이 개념보다 넓은 매핑을 없애며, 단위가 맞지 않으면 개념을 붙이지 않고, LOINC 코드를 공개 원문과 대조해 라벨보다 구체적인 코드는 내보내지 않으며, 한국 검진에 흔한 수치 항목을 늘리고, 이 모두를 합성 벤치마크로 증명한다.

## 1. 경계 (변하지 않는 것)

- 진단·정상/비정상·참고치 표시·방향·의미·예측 없음. 기존 금지어 스캔 유지. 참고치 원문은 두 export에만.
- Next.js에 API 라우트·토큰·권한 없음. readiness 무변경. 합성 데이터만. 감사 이벤트에 값·날짜·라벨 없음. Jackson `fail-on-unknown-properties`·`non_null` 유지.
- 정성 결과(음성/양성/미량 등)는 범위 밖이며 계속 abstain 한다.
- 기존 행을 다시 정규화하지 않는다(원문 라벨이 저장된 적이 없어 정직하게 되돌릴 수 없다).

## 2. 결과지 표기 보존 (V11)

- 현재 `MedicalConceptNormalizer.normalize`는 개념이 맞으면 `label`을 `displayKo`로 **바꾸고** 원문 라벨은 버린다(해시만 남는다).
- V11 `V11__concept_accuracy.sql`: `gc_candidate.original_label VARCHAR(80)`, `gc_health_record_version.original_label VARCHAR(80)`(nullable; 기존 행은 NULL). 추출 저장 시 worker가 보낸 raw 라벨을 그대로 기록, 확정 시 기록 버전에 복사, 정정 시 이어받음(요청 필드 없음, 보내면 400).
- `NormalizedCandidate.originalLabel`, 저장소 행 두 개, `CandidateReceipt`·`RecordReceipt`·`HealthEvent`에 `originalLabel: String?`(이것은 문서의 글자이므로 응답에 포함한다). `SeriesPoint`에도 포함(같은 시리즈 안에서 표기가 달랐음을 볼 수 있게).
- JSON export `events[].originalLabel`(schema `alm-health-events-export.v3`), FHIR `code.text` = `originalLabel ?: label`.
- Web: 검토 화면·내 기록·내 데이터 drawer·측정 이력 표에 "결과지 표기: {원문}"(정규화 이름과 다를 때만). 없는 옛 기록은 drawer에 "이 기록은 결과지 표기를 보존하기 전에 저장됐어요." zod `.strict()` + fixtures.

## 3. 별칭 규칙: 별칭은 개념보다 넓을 수 없다

- V11에서 `gc_medical_concept.aliases`를 갱신하고 새 개념을 추가:
  - `glucose`(혈당; 별칭 `혈당`,`Glucose`,`Blood Glucose`,`혈당(Glucose)`), `fasting-glucose`는 `공복혈당`,`Fasting Glucose`,`FBS`,`FPG`,`공복 혈당`,`식전혈당`만, 새 `postprandial-glucose`(식후혈당; `식후 2시간 혈당`,`PP2`,`2hr PP`,`Postprandial Glucose`).
  - `bilirubin`(빌리루빈; `Bilirubin`), `total-bilirubin`은 `총빌리루빈`,`Total Bilirubin`,`T-Bil`, 새 `direct-bilirubin`(직접빌리루빈; `Direct Bilirubin`,`D-Bil`).
  - `hs-crp`(고감도 CRP; `hs-CRP`,`hsCRP`,`고감도 C-반응단백`), `crp`에서 `hs-CRP` 제거.
  - `gfr`(사구체여과율; `GFR`), `egfr`는 `eGFR`,`e-GFR`,`estimated GFR`,`추정 사구체여과율`,`신사구체여과율(e-GFR)`.
- `packages/document-boundary/MedicalConceptCatalogue.kt`(Kotlin 사본)와 V11 시드는 같은 내용이어야 하며, 기존의 일치 테스트가 있으면 갱신하고 없으면 추가한다(코드·표시명·별칭·단위·LOINC·`loincExport` 전부 비교).
- 불변식 테스트: 어떤 별칭 키도 두 개념에 속하지 않는다; 위 "넓은 라벨" 목록은 각각 generic 개념으로 간다.

## 4. 단위 가드

- `gc_medical_concept.accepted_units JSONB NOT NULL DEFAULT '[]'`(V11에서 각 개념에 `[canonical_unit, …대체 단위]` 채움; 예: glucose 계열 `["mg/dL","mmol/L"]`, 콜레스테롤 계열 `["mg/dL","mmol/L"]`, creatinine `["mg/dL","µmol/L"]`, hemoglobin `["g/dL","g/L"]`, 나머지는 canonical만).
- `normalize`: 라벨이 개념에 맞아도 `MedicalUnitSpelling.canonical(unit)`이 `accepted_units`에 없으면 `conceptCode = null`, `label`은 raw 라벨 그대로. 조용한 대체 없음: 이 경우는 기존 "개념 없음"과 같은 경로이며 검토 화면은 raw 라벨을 보여준다. 단위 테스트 + 통합 테스트(`UA 1.2 g/dL` 같은 행).

## 5. LOINC 감사

- `gc_medical_concept.loinc_export BOOLEAN NOT NULL DEFAULT TRUE`. FHIR 매퍼는 하드코딩 목록(`fasting-glucose`,`crp`,`total-bilirubin`,`egfr`) 대신 이 플래그를 읽는다. `false` 대상: 코드가 라벨보다 방법·검체·공식에 구체적인 개념 — 최소 `ldl-cholesterol`(13457-7은 계산식), `vitamin-d`(1989-3은 D3), `egfr`(62238-1은 특정 공식), 그리고 감사에서 드러나는 것. 별칭 정리 뒤 `fasting-glucose`·`crp`·`total-bilirubin`은 라벨이 구체적이므로 `true`로 돌아온다. generic 개념(`glucose`,`bilirubin`,`gfr`)은 LOINC 없음.
- 증거 파일 `docs/status/2026-09-17/loinc-audit.md`: 모든 개념(기존 38 + 신규)에 대해 `concept_code | loinc_code | loinc.org에서 읽은 Long Common Name | URL | 확인일 | loinc_export | 사유`. 공개 페이지(`https://loinc.org/<code>/`)를 **읽기만** 한다(로그인·다운로드·약관 수락 없음). 읽지 못했거나 이름이 개념과 맞지 않는 코드는 `loinc_code = NULL`로 내보낸다. 이름을 기억에 의존해 채우지 않는다.

## 6. 카탈로그 확장 (수치 항목만)

- 후보(감사 통과한 것만 LOINC 포함): hematocrit, MCV, MCH, MCHC, chloride, phosphorus, magnesium, iron, TIBC, vitamin B12, folate, ESR, LDH, amylase, CK, free T3, T3, HDL 외 non-HDL cholesterol, insulin, AFP, CEA, PSA, CA19-9, CA125, RF. 각 개념에 표시명·별칭(넓지 않게)·canonical/accepted units.
- 두 글자 별칭 충돌 점검(예: `CK`, `Fe`, `Mg`, `P`, `Cl`): 한 글자 별칭 금지, 두 글자 별칭은 단위 가드가 있어야만 허용.

## 7. 벤치마크

- `packages/korean-checkup-benchmark`: 넓은 라벨(`혈당`,`Glucose`,`hs-CRP`,`Bilirubin`,`GFR`)과 신규 항목, 단위 불일치 행을 쓰는 합성 결과지 variant 추가. gold는 generic 개념/개념 없음을 기대. `native-text-gate`는 `fieldF1=1`, `referenceRangeAccuracy=1` 유지 + 개념 코드 일치율 `conceptAccuracy=1`(gold에 기대 개념 코드가 있는 필드 중 일치 비율) 추가. 개념 매핑은 core 쪽 규칙이므로 runner는 `MedicalConceptCatalogue`(Kotlin 사본)로 계산하고, 사본=시드 일치 테스트가 둘을 묶는다.
- `corpusId`가 바뀐다: 새 digest를 evidence에 기록하고, MedGemma Run 1–3이 옛 corpus 기준임을 실험 문서에 한 줄로 명시(재실험은 범위 밖).

## 8. 테스트·증거

- Kotlin 단위(normalizer 가드·별칭 불변식·사본=시드), PostgreSQL 통합(V11, original_label 저장·복사·이어받기·400, 응답 포함, export v3, FHIR code.text·loinc_export), worker 불변(파서는 raw 라벨을 이미 보낸다 — 확인), 벤치마크 게이트, web zod/컴포넌트/카피 스캔, e2e: 합성 PDF 한 줄을 `혈당`으로 두어 검토 화면에 "혈당"·확정 후 drawer에 "결과지 표기" 없음(같으므로) / `Cholesterol` 행은 "결과지 표기: Cholesterol" 표시, FHIR `code.text`가 원문.
- 게이트 전부 + `docs/status/2026-09-17/wave5.md` + loinc-audit.md + AGENTS/guide/roadmap 한 문장. readiness 무변경. 브랜치 `codex/wave10-concept-accuracy`(측정 이력 화면 브랜치 `codex/wave9-history-screen` 위 stacked).

## 9. 범위 밖

정성 결과, 단위 환산, 기존 행 재정규화, MedGemma 재실험, 참고치·방향 표시, 새 화면, 디자인 리스킨 확대.
