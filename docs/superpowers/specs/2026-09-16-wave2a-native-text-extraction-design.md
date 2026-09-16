# Wave 2A — 결정론적 문서 추출 · 개념 정규화 · 한국 검진 벤치마크 (디자인, 2026-09-16)

상태: founder 승인(대화 중). 기준: `PHI_MASTER_PRODUCT_DOCUMENT.md` §3.3, §7, §22(모델 없이 결정론적 단계만), §45, §47 R1. 저장소 authority: `PROJECT_GUIDE.md` §1 허용 claim("출처 기반 문서 정보를 정리하고 추출 후보를 사람이 명시적으로 확인하도록 제시"), §6.

## 0. 한 문장

worker가 PDF 텍스트를 실제로 읽어 한국 검진 결과지의 항목·값·단위·검사일을 근거와 함께 후보로 만들고, core는 고정 카탈로그 대신 그 후보를 저장하며, 별칭 사전으로 개념을 정규화하고, 합성 한국어 결과지 벤치마크로 파서를 채점한다. 모델도 네트워크도 없다.

## 1. 경계 (변하지 않는 것)

- 후보는 사람이 확인하기 전까지 기록이 아니다. 기존 확인/정정/제외 흐름, provenance(문서 digest·페이지·원문 해시), 감사, 삭제는 그대로.
- 진단·정상/비정상·reference range 저장·추세·위험·치료·약물·모델 추론 없음. 파서가 참조 범위 문자열을 마주쳐도 저장하지 않는다(벤치마크 run JSON에는 채점용으로 실을 수 있으나 core로 보내지 않음).
- 이미지 OCR 없음: 텍스트 레이어가 없는 PDF는 `abstentions[]`로 "읽을 수 없음"을 명시하고 후보 0개로 완료한다. 빈 결과를 성공처럼 꾸미지 않는다.
- Next.js는 API 라우트·토큰·권한 규칙을 얻지 않는다. readiness 게이트·verdict 변경 없음. `provider_and_real_data_activation`의 "OCR·의료 AI 비활성" 문구는 유지(텍스트 파싱은 OCR이 아니며 모델이 아님)하고 evidence 문서에 그 구분을 명시한다.
- 합성 데이터만. 벤치마크 PDF는 생성기가 만든다.

## 2. Worker — `NativeTextExtractionProvider`

- 위치: `apps/document-worker` (PDFBox 이미 의존). `PDFTextStripper`를 확장해 줄 단위 텍스트와 각 줄의 위치(페이지, 정규화 bbox 0..1)를 얻는다.
- 문서 단위 검사일: `Date:`/`검사일`/`검진일`/`채취일` 뒤의 날짜, 또는 문서 내 첫 ISO/점 표기 날짜(`2026-07-28`, `2026.07.28`, `2026년 7월 28일`). 없으면 모든 후보를 `missing_evidence` 사유의 abstention으로 낸다(날짜 없는 값은 기록이 될 수 없음).
- 행 파서: `라벨 [:|：|\t|공백2+] 값 [단위]` — 값은 `-?\d+(\.\d+)?`(천 단위 콤마 허용), 단위는 허용 목록(`mg/dL`, `%`, `ng/mL`, `mmHg`, `kg`, `cm`, `kg/m²`, `U/L`, `IU/L`, `g/dL`, `10³/µL`, `mL/min/1.73m²`, `mmol/L`, `μIU/mL`, `mg/L` 등)과 표기 변형(`mg/dl`, `㎎/㎗`, `ng/ml`). 라벨은 개념 사전(§4)에 별칭이 있으면 정식 라벨로, 없으면 원문 그대로. 값이 둘 이상 매치되거나 단위가 모호하면 abstention(`ambiguous_value`/`ambiguous_unit`).
- 참조 범위 텍스트(예: `120–199`)가 같은 줄에 있으면 값 파싱에서 제외만 하고 어디에도 싣지 않는다.
- 후보 최대 100개, 라벨 80자·값 64자·단위 32자(기존 DB 제약과 동일). 원문 해시 = 해당 줄 원문(trim) sha256.
- 경계 API: `extraction-result` 요청에 `candidates[]`와 `abstentions[]`를 추가한다(아래). 미리보기 PNG는 그대로.

## 3. Core — 계약과 저장

- `ExtractionResultRequest` 확장: `candidates: List<ExtractedCandidate>`(0..100), `abstentions: List<ExtractionAbstention>`(0..100), `extractionMethod: "native-text"`. 각 후보: `ordinal`, `label`, `value`, `unit`, `observedOn`, `evidencePage`, `evidenceBox{x,y,width,height}`(0..1), `sourceTextSha256`, `conceptCode?`. 검증은 Bean Validation + 결정론적 검사(날짜 형식, digest 형태, 중복 ordinal 금지).
- `completeExtraction`은 요청의 후보를 저장한다. `SyntheticCandidateFixture`, `FoundationProperties.syntheticDocuments`(digest→set 바인딩), 관련 env(`GC_FOUNDATION_SYNTHETIC_DOCUMENTS_*`)와 테스트를 제거한다. 후보 0개면 문서는 `REVIEW_REQUIRED`가 아니라 `COMPLETED`(확인할 것 없음)로 가며 UI는 "읽을 수 있는 항목이 없어요"와 abstention 사유를 보여준다(카피는 §7).
- 마이그레이션 V7: `gc_candidate`에 `extraction_method VARCHAR(32) NOT NULL DEFAULT 'native-text'`, `evidence_box_x/y/w/h NUMERIC(6,5) NULL`, `concept_code VARCHAR(64) NULL`; `gc_health_record_version`에 `concept_code VARCHAR(64) NULL`; `gc_extraction_job`에 `abstentions JSONB NOT NULL DEFAULT '[]'`.
- 감사 이벤트 이름 `SYNTHETIC_CANDIDATE_CREATED` → `EXTRACTION_CANDIDATES_CREATED`(건수 포함, 값 없음).

## 4. 개념 정규화

- `gc_medical_concept`(V7 시드): `concept_code`(예: `total-cholesterol`), `display_ko`, `loinc_code`(있을 때), `canonical_unit`, `aliases`(JSONB 배열, 한/영/약어, 대소문자·공백 무시 비교). 약 40개: 총콜레스테롤, LDL/HDL 콜레스테롤, 중성지방, 공복혈당, 당화혈색소, AST, ALT, γ-GTP, ALP, 총빌리루빈, 알부민, BUN, 크레아티닌, eGFR, 요산, 혈색소, 적혈구, 백혈구, 혈소판, 요단백, 요당, 수축기/이완기 혈압, 맥박, 키, 체중, BMI, 허리둘레, 비타민 D, TSH, free T4, CRP, 페리틴, 나트륨, 칼륨, 칼슘, 총단백. 참조 범위 없음.
- 정규화는 worker가 아니라 core에서(단일 authority): 저장 시 라벨 별칭 매칭 → `concept_code`, 단위 표기 통일(`mg/dl`→`mg/dL`). 수치 환산 없음. 별칭 없음 → `concept_code = null`, 라벨 원문 유지.
- `HealthEvent`에 `conceptCode: String?` 추가(zod: `z.string().regex(/^[a-z0-9-]+$/).nullable()`), `/my-data` 검색은 concept_code로도 정확 매치. 표시 라벨은 그대로 `concept`(정식 한글 라벨).

## 5. 벤치마크 R1

- 새 Gradle 모듈 `packages/korean-checkup-benchmark`(Kotlin, PDFBox): `generate --out <dir> --font <Pretendard-Regular.ttf>` 로 PDF 24종 + `corpus.json`(기존 `medicalDocumentCorpusSchema` 형식, 실제 sha256, 근거 bbox는 배치 좌표에서 계산) 생성. 레이아웃 4종 × 6 변형: 국가건강검진 결과통보서식 표(항목/결과/단위/참고치 4열), 병원 혈액검사 2열, 검진센터 요약 목록, 2페이지 검사지(라벨은 2쪽). 변형 축: 한글/영문 라벨, 단위 표기, 소수 자리, 날짜 형식, 콤마 천 단위, 참조 범위 열 유무. 값은 난수 시드 고정(재현 가능). 한 종은 텍스트 레이어 없는 이미지 PDF(스캔 흉내)로 두어 abstention을 채점한다.
- 파서 실행: `packages/korean-checkup-benchmark` 의 `run-native-text --corpus <dir>` 이 worker의 provider를 호출해 `medical-document-run.v1` JSON을 낸다(`models.layout = {modelId:"pdfbox-native-text", artifactSha256: <worker jar 또는 provider 클래스 digest>, executionMode:"offline-pinned"}`, `models.semantic` 동일 값). 참조 범위는 gold와 같은 형식으로 run에만 싣는다.
- 채점: `pnpm medical-ai:native-text-gate` → 생성·실행·`evaluateMedicalDocumentPipeline`. 통과 기준: 텍스트 레이어 문서에서 field F1 = 1, critical value exact = 1, evidence IoU 통과율 = 1, 환각 0, 필수 abstention recall = 1. 리포트를 `docs/status/<날짜>/native-text-benchmark.md`에 기록. CI 통합 잡에 추가.
- 폰트: `node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf`(OFL). CI는 pnpm install 후 존재.

## 6. 데모 문서·러너·e2e

- 두 데모 PDF(`buildSyntheticResultPdf`)는 파서가 읽는다: `Date: 2026-07-28`, `Cholesterol: 188 mg/dL`, `HbA1c: 5.2 %`, `Vitamin D: 42 ng/mL` → 별칭으로 총콜레스테롤/당화혈색소/비타민 D. 값·순서(파서는 문서 순서 = ordinal)가 기존 e2e/브라우저 시나리오와 같으므로 시나리오 변경 없음. `synthetic-local.mts`와 Playwright 설정에서 set 바인딩 env 제거, digest allowlist는 유지.
- e2e에 추가: 후보 검토 화면에서 "서버가 미리 정한 예시 값" 문구가 사라지고 "결과지 텍스트에서 읽은 값 · 문자 인식 아님"으로 바뀐 것을 확인; 근거 페이지·bbox 표시.

## 7. 카피(한국어)

- 후보 화면 안내: "결과지의 글자 정보에서 읽은 값이에요. 이미지를 판독한 결과가 아니며, 확인하기 전까지 기록이 아니에요."
- 후보 0개: "이 결과지에서 읽을 수 있는 항목이 없었어요. 글자 정보가 없는 파일(사진·스캔)은 아직 읽지 못해요." + abstention 사유 목록(라벨, 사유 한글화).
- 기존 카피 스캔 목록·claim register 갱신: "예시 데이터"는 유지(문서 자체가 합성).

## 8. 테스트·증거

- Worker: 파서 단위 테스트(라벨/값/단위/날짜/abstention 케이스, 데모 PDF 두 개), 렌더+추출 통합.
- Core: DTO 검증 테스트, `completeExtraction` PostgreSQL 통합(후보 저장, 0개 완료, 정규화 concept_code, 감사 이벤트), HealthEvent conceptCode.
- Web: zod 스키마 확장, 후보 화면 카피/abstention 표시, `/my-data` concept 검색.
- 벤치마크 게이트 + 기존 AGENTS.md 게이트 전부 + 브라우저 라이프사이클 + 6 뷰포트. `docs/status/<날짜>/wave2a-native-text.md`, ledger §28, roadmap A9, PROJECT_GUIDE §2 한 문장. readiness 무변경.

## 9. 범위 밖

이미지 OCR, 모델 추론(MedGemma 로컬 실험은 Wave 2B), reference range 저장, 단위 수치 환산, What-changed API·동의 분리·export(Wave 2B), 디자인 변경.
