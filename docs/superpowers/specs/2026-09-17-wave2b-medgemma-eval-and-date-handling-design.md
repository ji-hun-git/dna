# Wave 2B — MedGemma 1.5 로컬 합성 평가 · 검사일 처리 강화 · 벤치마크 마무리 (디자인, 2026-09-17)

상태: founder 승인(2026-09-17 대화; 범위 "A 트랙만"). 기준: `PHI_MASTER_PRODUCT_DOCUMENT.md` §22(MedGemma는 추출 후보 제안에만), §45(평가), §46(모델 교체 가능), §47 R1. 승인 기록: `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md`. 저장소 authority: `PROJECT_GUIDE.md` §6, `docs/implementation/medical-document-runner.md`(7단계 handoff — 이 wave는 조건 1만 충족된 "bounded local experiment"이며 2–7은 열린 채로 둔다).

## 0. 한 문장

Wave 2A 벤치마크(24개 합성 한국어 결과지)를 로컬 Ollama의 MedGemma 1.5에 페이지 이미지로 넣어 같은 채점기로 결정론적 파서와 나란히 평가하고 그 결과를 evidence로만 남긴다. 동시에 파서의 검사일 처리를 정직하게 만들고(라벨 없는 날짜는 쓰지 않음), 검토 화면에서 검사일을 정정할 수 있게 하며, 벤치마크 PDF를 바이트 단위로 재현 가능하게 한다.

## 1. 경계 (변하지 않는 것)

- 모델 출력은 제품 코드 경로에 들어가지 않는다. 실험 스크립트는 `apps/web/scripts/` 아래 CLI이며 core·worker·web 런타임은 모델을 호출하지 않는다. `provider_and_real_data_activation`의 "OCR·의료 AI 비활성"은 사실로 유지된다. readiness 무변경.
- 합성 문서만. 네트워크는 `http://127.0.0.1:11434`(로컬 Ollama)만 허용; 스크립트는 다른 호스트로 요청하지 않으며 프록시 env를 무시한다. 실 PHI·실 문서 금지.
- 모델에게 진단·정상/비정상·치료·위험을 묻지 않는다. 프롬프트는 "항목·값·단위·검사일·페이지 위치를 그대로 옮겨 적어라, 판단하지 말라"로 고정하고 스키마(`format`)로 출력 형태를 강제한다. 모델이 낸 reference range는 채점 전에 버린다(run JSON에 싣지 않음).
- 결과는 `docs/status/2026-09-17/medgemma-local-experiment.md`와 `apps/web/tests/fixtures/medical-ai/`의 **run JSON 재현 파일이 아닌** 요약표만. 모델 run JSON은 `build/`에만 둔다(합성이지만 모델 출력물을 저장소에 커밋하지 않는다).
- 검사일 정정도 "사용자가 문서에 그렇게 적혀 있다고 확인한 것"이지 임상 검증이 아니다.

## 2. MedGemma 로컬 실험

- 입력: `packages/korean-checkup-benchmark` `generate`로 만든 corpus(PDF 24 + corpus.json). 새 CLI `render-pages --corpus <dir> --out <dir>`(같은 모듈, PDFBox `PDFRenderer` 150 dpi PNG, 페이지별 파일명 `<documentId>-p<N>.png`).
- 실행: `apps/web/scripts/medgemma-local-experiment.mts` — 문서별로 페이지 PNG(base64)를 Ollama `/api/chat`에 `model: medgemma1.5`, `think: false`, `temperature 0`, `format`(JSON Schema: `rows[]{label,value,unit,observedOn?,page}` + `abstentions[]{label,reason}`), `keep_alive`로 보낸다. 시스템 프롬프트: 옮겨 적기만, 판단 금지, 못 읽으면 abstain. 페이지당 1회 호출, 문서당 병합. 실패/타임아웃(문서당 최대 180 s)은 문서 단위 `unreadable`로 기록.
- 매핑: 모델 rows → `medical-document-run.v1` candidates. `evidence.box`는 모델이 주지 않으므로 페이지 전체 박스(0,0,1,1)를 넣고 **evidence localization 지표는 이 실험에서 "측정 불가"로 표기**한다(채점기는 IoU를 계산하지만 리포트에서 해당 열을 회색 처리). `sourceTextSha256`은 모델 원문 행 문자열의 해시. `models.semantic = {modelId: "medgemma1.5@ollama:<digest>", artifactSha256: <ollama blob digest>, executionMode: "offline-pinned"}`, `models.layout = {modelId: "pdfbox-render-150dpi", …}`. 라벨 정규화는 채점 전에 `MedicalConceptCatalogue` 별칭으로 정식 라벨화(파서와 동일 조건).
- 채점: 기존 `evaluateMedicalDocumentPipeline`로 파서 run과 모델 run을 각각 채점하고 `compareMedicalDocumentPipelines`로 나란히. 리포트: 문서별·항목별 정확/오답/누락/환각 표, 파서 대비 델타, 실행 환경 핀(Ollama 버전, 모델 digest, GPU, 드라이버, corpus digest, 스크립트 commit).
- 게이트 아님: 실험은 `pnpm medical-ai:medgemma-experiment`로 수동 실행하며 CI에 넣지 않는다(GPU·모델 없음). 문턱값을 통과 여부로 해석하지 않고 evidence로만 기록한다.
- 재현성: 실험 스크립트는 프롬프트·스키마·파라미터를 파일로 고정하고 그 digest를 리포트에 적는다.

## 3. 검사일 처리 강화

- Worker: 라벨(검사일/검진일/채취일/검사 일자/Date/Exam date 등 허용 목록)이 붙은 날짜만 문서 검사일로 인정. 라벨 없는 날짜는 쓰지 않는다. 라벨 검색은 줄 시작이 아니라 줄 안 어디든(다열 PDF 대응). 라벨 날짜가 둘 이상이고 서로 다르면 `ambiguous_value` 사유의 문서 단위 abstention 하나 + 후보 0개(날짜가 모호하면 모든 값이 모호). 라벨 날짜가 없으면 인식된 모든 행은 `missing_evidence`(기존 규칙).
- 벤치마크: 생성기의 변형 축에 "라벨 없는 날짜만 있는 문서" 1종(기존 `hospital-two-column v4`가 무날짜; 여기에 "생년월일이 먼저 나오고 검사일 라벨이 뒤에 있는" 문서 1종을 추가해 첫-날짜 오류를 채점)을 넣고 gold를 갱신. 게이트는 여전히 F1 = 1이어야 한다.
- Core: 후보 확인 요청에 선택적 `observedOn`(ISO 날짜) 추가. 제공되면 기록의 `observed_on`은 그 값으로 저장되고, 후보의 원래 날짜는 `original_observed_on`(V8 컬럼)에 남는다. `reviewDecision`은 값 또는 날짜가 바뀌었으면 `CORRECTED`. 감사 이벤트에 날짜 값은 남기지 않는다(값과 같은 규칙).
- Web: 후보 카드에 검사일 정정 폼(값 정정과 같은 패턴, `type=date`, 미래 날짜·1900 이전 거부), 기록 화면에 "검사일을 수정함 · 원래 YYYY. M. D." 표시. 카피는 "결과지에 적힌 검사일과 다르면 고쳐 주세요" 톤, 판단 없음.

## 4. 벤치마크 마무리

- PDF 바이트 결정성: 생성기가 PDFBox 문서 ID·생성/수정 시각·XMP를 고정 값으로 설정해 같은 시드에서 같은 바이트가 나오게 하고, 테스트로 두 번 생성한 바이트가 같음을 증명. corpus digest(모든 PDF sha256 + corpus.json sha256의 sha256)를 `corpus.json`의 `corpusId`와 리포트에 기록.
- 최종 리뷰 minor: `gradle()` 실패 시 `result.error` 메시지 출력; CI 게이트 스텝에 `if:` 주석.

## 5. 카피(한국어)

- 검사일 정정 폼 라벨 "검사일 수정", 도움말 "결과지에 적힌 검사일과 다르면 고쳐 주세요. 값의 의미는 판단하지 않아요."
- 기록 화면 "사용자가 검사일을 수정함 · 원래 2026. 1. 15."
- 모호한 날짜 abstention 사유 한글: "검사일이 둘 이상이라 확실하지 않음"(기존 `ambiguous_value` 라벨 재사용 가능하면 재사용).

## 6. 테스트·증거

- Worker 단위: 라벨 날짜 우선/라벨 없음/다열/복수 상이 날짜; 데모 PDF 둘은 `Date:` 라벨이 있어 그대로.
- Core PostgreSQL: 날짜 정정 저장·원본 보존·reviewDecision·감사; 유효성(형식, 범위).
- Web: 정정 폼, 기록 표시, 카피 스캔; e2e에 날짜 정정 1회 추가.
- 벤치마크: 게이트 F1 = 1 유지(새 문서 포함), 바이트 결정성 테스트.
- 실험: 실제 실행 결과 리포트 + `docs/status/2026-09-17/wave2b.md` 증거, ledger §28, roadmap, PROJECT_GUIDE §2 한 문장. readiness 무변경.

## 7. 범위 밖

What-changed API, 동의 목적 분리, export(Wave 2C); 모델 출력의 제품 반영; OCI 런너·서명 승인(handoff 2–7); 이미지 OCR 제품화; reference range 저장; 디자인 변경.
