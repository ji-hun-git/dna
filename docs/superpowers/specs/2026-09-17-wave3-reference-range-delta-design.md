# Wave 3 — 참고치 원본 보존 · 결정론적 차이 · export 보강 · MedGemma num_ctx · 내 데이터 minor (디자인, 2026-09-17)

상태: founder 승인(2026-09-17 대화). 게이트 문서: `governance/intended-use-decision-reference-range-and-delta-2026-09-17.md`(항목 (a)(b)). 기준: `PHI_MASTER_PRODUCT_DOCUMENT.md` "절대 보존해야 하는 것", §23(추세 계산은 LLM에 맡기지 않음 — 이번 wave는 차이 계산까지만), 2026-09-16 스펙 §5. 저장소 authority: `PROJECT_GUIDE.md` §6, `AGENTS.md`.

## 0. 한 문장

결과지에 적힌 참고치 원문을 버리지 않고 저장·내보내되 어디에도 보여주거나 비교하지 않고, 최근 변화에 두 값의 뺄셈 결과만 숫자로 덧붙이며, export가 완료된 모든 문서를 나열하고, MedGemma 실험을 `num_ctx 8192`로 한 번 더 기록하고, 내 데이터의 남은 minor를 닫는다.

## 1. 경계 (변하지 않는 것)

- 참고치는 저장·export만. 후보/기록/health-events/changes 응답과 화면에 없음(테스트: 직렬화된 JSON에 대소문자 무관 `reference`를 포함하는 키가 없음). 비교·판단·색 없음.
- 차이는 뺄셈·나눗셈 결과 숫자만. 방향 어휘(상승/하락/증가/감소/높/낮), 화살표, 색, 임계값 없음. 카피 스캔 목록에 방향 어휘 추가.
- Next.js에 API 라우트·토큰·권한 없음. readiness 무변경. 합성 데이터만. 감사 이벤트에 값·날짜 없음.
- 결정 문서가 브랜치에 먼저 커밋되어야 (a)(b) 코드가 들어간다.

## 2. (a) 참고치 원본 보존

- Worker `NativeTextExtractionProvider`: 이미 `rangeText`로 매칭해 값에서 제외하던 행의 참고치 토큰을 `ParsedCandidate.referenceRangeText: String?`로 보존(trim, 최대 40자). 라벨 접두("참고치:", "기준치" 등)와 괄호는 벗기고 범위 본문만(예 `70-99`, `<200`, `≤5.6`, `4.0~6.0`, `120 - 199`). 매칭이 없으면 null. 값·단위 파싱 결과는 바뀌지 않는다(기존 벤치마크 F1=1 유지).
- 경계 DTO `ExtractedCandidate.referenceRangeText: String?` — `@Size(max=40)`, `@Pattern("^[0-9.,\\s\\-~–<>≤≥]{1,40}$")`. 문서 주석 "No reference range"를 "reference-range text is carried verbatim and never interpreted"로 고친다.
- Core V10 `V10__reference_range_text.sql`: `gc_candidate.reference_range_text VARCHAR(40)`, `gc_health_record_version.reference_range_text VARCHAR(40)`, 같은 shape CHECK. 확정 시 후보의 값을 그대로 기록 버전에 복사; 정정(correction)은 새 버전에 그대로 이어받고 바꿀 수 없다(요청 필드 없음).
- 저장소 행(`FoundationCandidateRow`, `FoundationRecordRow`)에 `referenceRangeText` 추가. 컨트롤러 DTO(후보 목록, 기록, health-events, changes)에는 **추가하지 않는다**. 통합 테스트: 네 응답의 JSON 문자열에 대소문자 무관 `reference`가 없음을 단언.
- Export: `events[].referenceRangeText: String | null` 추가, `schemaVersion`을 `alm-health-events-export.v2`로. 통합 테스트: 참고치가 있는 후보를 확정하면 export에 원문 그대로 등장.
- 벤치마크: `GoldMeasurement.expectedReferenceRangeText: String?`(참고치 컬럼 variant일 때 렌더된 문자열, 아니면 null). `NativeTextRunner` 출력에 `referenceRangeAccuracy`(매칭된 필드 중 참고치 텍스트 일치 비율)를 추가하고 `native-text-gate`가 `1`을 요구. `corpusId`는 PDF 바이트가 바뀌지 않으므로 유지되어야 하며, 바뀌면 evidence에 새 digest를 기록한다.
- **(최종 리뷰 후 좁힌 규칙, 2026-09-17)** 범위 본문은 비교 부호(`<>≤≥`)가 있거나 두 숫자 사이에 구분자(`-`, `–`, `~`)가 있을 때만 `referenceRangeText`로 남는다. 이전-결과 컬럼처럼 구분자·부호 없는 순수 숫자 하나는 범위가 아니므로 `null`이다(값·단위 파싱과 후보 여부는 바뀌지 않는다). 40자를 넘는 범위 본문은 절대 잘라내지 않고 `null`로 남는다(방금 전 `.take(40)`이 하던 잘림 대신).

## 3. (b) 결정론적 차이

- `ChangeItem.delta: ChangeDelta?` — `data class ChangeDelta(val absolute: String, val percent: String?)`. `previous`가 있고(이미 같은 단위) 두 값이 `BigDecimal`로 파싱될 때만 계산, 아니면 null. `absolute = latest − previous`를 두 입력 중 큰 scale로, 부호 명시(`"+12"`, `"-6"`, `"-0.3"`, `"0"`). `percent = absolute / previous × 100`을 `HALF_EVEN` 소수 1자리, `previous == 0`이면 null, 부호 명시(`"-3.1"`, `"+2.0"`, `"0.0"`). 천 단위 쉼표 값(`1,234`)은 쉼표 제거 후 파싱.
- 단위 테스트: 정수·소수·음수·0 previous·쉼표·파싱 불가(null).
- Web: `RecentChanges` 항목에 한 줄 `두 값의 차이: -6 mg/dL (-3.1%)`(percent null이면 괄호 생략, delta null이면 줄 없음). zod `.strict()`에 `delta` 추가. 색·아이콘 없음. 카피 스캔에 상승/하락/증가/감소 추가(기존 화면 카피에 이 단어가 있으면 그 카피를 바꾼다).
- **(최종 리뷰 후 좁힌 규칙, 2026-09-17)** `percent`는 `previous > 0`이고 항목의 단위가 `%`가 아닐 때만 계산한다: previous가 0이거나 음수면 부호가 절대값과 모순될 수 있어 `null`(기존에는 `previous == 0`일 때만 null이었다); 단위가 `%`인 항목은 percent-of-percent 숫자를 절대 보여주지 않도록 `absolute`만 남기고 `percent`는 항상 생략한다. 또한 `delta`는 previous의 관측일이 latest의 관측일보다 늦지 않을 때만 계산한다(`previous.observedOn <= latest.observedOn`); 더 늦은 이전 값과 비교하면 부호가 시간 순서에 어긋나므로, 그 경우 `delta` 키 자체를 생략한다(두 값과 두 날짜는 그대로 남는다).

## 4. Export 문서 목록

- `documents` = owner의 COMPLETED 문서 전부(이벤트 유무 무관)와 이벤트가 있는 문서의 합집합, documentId 문자열 정렬. 각 항목 `{documentId, observedOn?, status, abstentions, eventCount}`. v2 bump는 §2와 공유. 통합 테스트: 후보 전부 제외한 완료 문서가 `eventCount 0`으로 나열.

## 5. MedGemma `num_ctx 8192` 재실험 (증거만)

- `EXPERIMENT_PROTOCOL.options`에 `num_ctx: 8192` 추가(프로토콜 digest 변경). 로컬 수동 실행 `pnpm medical-ai:medgemma-experiment`(CI 아님). 결과를 `docs/status/2026-09-17/medgemma-local-experiment.md`에 "Run 3 (num_ctx 8192)" 섹션으로, pins를 approval note에 세 번째 블록으로 기록: unreadable 수, done_reason 분포, F1, hallucination, VRAM 오프로드 여부(`ollama ps`). 결론 문장은 관찰만(원인 단정 금지).

## 6. 내 데이터 minor

- `HealthEvent`에 `originalValue: String`, `correctionReason: String?`, `originalObservedOn: String?`(V8 값) 추가 → `/my-data` 근거 drawer에 "수정 이력" 블록(원래 값·이유·원래 검사일; 수정이 없으면 "수정 없음"). zod 갱신, export v2에도 포함.
- `SourcePreview`가 `page` prop을 실제로 사용(해당 페이지 렌더/링크). 테스트 1개.
- 빈 상태·오류 상태에서 jest-axe 실행(테스트 2개).
- 새로 도착한 셀 1회 페이드/스케일 애니메이션(CSS, `prefers-reduced-motion: reduce`면 없음). 테스트: reduced-motion 시 클래스 미부여.

## 7. 테스트·증거

- Kotlin 단위(delta, projection), PostgreSQL 통합(참고치 저장·복사·정정 이어받기·응답 부재·export v2·문서 목록), worker 단위(참고치 토큰 보존 + 기존 파싱 불변), 벤치마크 게이트, zod/컴포넌트 테스트, e2e: 참고치 있는 합성 PDF 확정 후 export에 원문 포함·화면에 없음, 최근 변화에 차이 한 줄.
- 게이트 전부 + `docs/status/2026-09-17/wave3.md` + roadmap/guide/AGENTS 한 문장. readiness 무변경. 브랜치 `codex/wave7-reference-range-delta`(PR #10 위 stacked).

## 8. 범위 밖

참고치 표시·비교, 추세 서술(c), 설명 템플릿(d), 모델 provider(e), CSV/FHIR, 디자인 변경, 예측.
