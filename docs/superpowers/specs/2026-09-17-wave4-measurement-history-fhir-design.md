# Wave 4 — 측정 이력(시계열) · FHIR export · PR #5 F-3 · Wave 3 minor · 새 시각 언어 파일럿 (디자인, 2026-09-17)

상태: founder 승인(2026-09-17 대화). 게이트 문서: `governance/intended-use-decision-measurement-history-2026-09-17.md`(항목 (c), "숫자 + 단순 그래프"), `governance/intended-use-decision-reference-range-and-delta-addendum-2026-09-17.md`(FHIR export의 참고치 원문). 기준: `PHI_MASTER_PRODUCT_DOCUMENT.md` §8, §23, §27, §11–13. 저장소 authority: `PROJECT_GUIDE.md` §6, `AGENTS.md`.

## 0. 한 문장

같은 항목의 확인된 값을 검사일 순서로 모아 표·세 가지 계산값·본인 값만의 그래프로 보여주되 방향·의미·예측은 말하지 않고, 본인 기록을 FHIR R4 Bundle로도 내려받게 하며, PR #5의 F-3과 Wave 3 잔여 minor를 닫고, 새 시각 언어(점 격자·리본·주석 카드·픽셀 숫자)를 측정 이력 화면 하나에서 시험한다.

## 1. 경계 (변하지 않는 것)

- 참고치 밴드·임계값·목표·집단 비교 없음. 회귀선·추세선·값을 만들어내는 보간·기울기 라벨·예측 없음.
- 색·굵기·아이콘·모션은 값의 의미를 나르지 않는다(색은 시리즈 식별 또는 시간 위치만).
- 방향·속도·의미 서술 문장 없음. 카피 스캔 금지어(상승/하락/증가/감소 포함) 유지, `빨라`·`느려`·`좋아`·`나빠`·`추세` 추가.
- 참고치 원문은 화면과 다른 응답에 없음. JSON export와 FHIR export에만.
- Next.js에 API 라우트·토큰·권한 없음. readiness 무변경. 합성 데이터만. 감사 이벤트에 값·날짜 없음. Jackson `fail-on-unknown-properties`·`non_null` 전역 설정 유지.
- 두 결정 문서가 브랜치 첫 커밋이어야 한다.

## 2. Series API

- `GET /api/foundation/series` (owner 격리, `Cache-Control: no-store`). CURRENT 레코드만.
- 응답:
  ```json
  { "series": [
      { "conceptCode": "total-cholesterol", "concept": "총콜레스테롤", "unit": "mg/dL",
        "points": [ { "eventId": "…", "value": "194", "observedOn": "2026-01-15", "documentId": "…" } ],
        "derived": { "lastDifference": { "absolute": "-6", "percent": "-3.1" },
                     "per30Days": "-0.9", "meanOfLast3": "191.3" } } ] }
  ```
  `conceptCode`·`derived`의 각 키는 계산할 수 없으면 생략(`non_null`).
- 그룹: `ChangeSummaryProjection.conceptsMatch`와 같은 규칙(같은 `concept_code`, 없으면 같은 라벨) **그리고** 같은 단위. 단위가 다르면 별도 시리즈(환산 없음). 시리즈 정렬: 라벨, 단위. 점 정렬: `observedOn`, `confirmedAt`, `recordId` 문자열.
- `derived`(순수 함수 `SeriesProjection`, 모두 시간 순서로 계산):
  - `lastDifference`: 마지막 두 점에 `ChangeDeltaCalculator.compute(last, previous)` — Wave 3의 좁힌 규칙 그대로(percent는 previous > 0이고 단위가 `%`가 아닐 때만). 점이 2개 미만이면 생략.
  - `per30Days`: 마지막 두 점의 `absolute / 날짜차(일) × 30`, `HALF_EVEN`, scale = 두 입력 중 큰 scale + 1, 부호 명시, 0은 부호 없음. 날짜가 같거나 파싱 불가면 생략.
  - `meanOfLast3`: 마지막 세 값의 산술평균, `HALF_EVEN`, scale = 세 입력 중 큰 scale + 1, 부호 없음(음수면 `-`). 점이 3개 미만이거나 하나라도 파싱 불가면 생략.
- 단위 테스트: 그룹·정렬·같은 날 두 점·단위 분리·각 계산의 경계. PostgreSQL 통합 테스트: owner 격리, 정정 후 CURRENT만, 응답에 `reference` 키·값 없음.

## 3. 화면 — 측정 이력 (`/my-data/history`)

- 진입: 내 데이터 상단 링크 "측정 이력", 근거 drawer의 "이 항목의 측정 이력 보기"(해당 시리즈로 스크롤·포커스). 전역 내비게이션은 두 목적지 그대로.
- 시각 언어(파일럿, 이 화면에만; CSS module 토큰으로 격리): 따뜻한 밝은 회색 바탕 + 점 격자, 시리즈마다 리본(바깥 띠 + 점선 중심선), 측정점은 사각 앵커, 선택 시 지시선으로 연결된 주석 카드(값·단위·검사일·"출처 보기" 링크), 큰 값은 픽셀/모노 숫자, 제목은 세리프. 색은 시리즈 식별용이며 값과 무관. 라임 계열은 채움 전용(본문 글자색 금지, AA 대비 유지).
- 그래프 규칙: y축은 그 시리즈 자신의 최소~최대(점이 1개거나 모두 같으면 가운데 수평), 점 사이는 직선 구간(값을 만들어내는 곡선 보간 금지; 리본의 시각적 굵기는 고정), 축 눈금은 실제 검사일만. 문장: "점은 확인한 값이고, 점 사이의 선은 값이 아니에요. 선의 모양이 건강 상태를 뜻하지 않아요."
- 계산값 표시: "마지막 두 값의 차이", "30일로 환산한 차이", "최근 3회 평균" — 숫자와 단위만, 색·화살표 없음. 설명: "뺄셈과 나눗셈으로만 계산했어요. 의미는 판단하지 않아요."
- 같은 숫자의 표(검사일·값·단위·출처)가 각 시리즈 아래에 있고, SVG는 `role="img"` + 요약 `aria-label`, 앵커는 키보드 포커스 가능. 점이 1개인 시리즈는 표만. 빈 상태·오류 상태·재시도. `prefers-reduced-motion`이면 모션 없음. 320px에서 가로 스크롤 없음(`minmax(0,1fr)`, `min-width:0`, 표 래퍼).
- zod `.strict()`. **이 화면 구현은 목업에 대한 founder 승인 뒤에 시작한다**(백엔드·다른 작업은 병행).

## 4. FHIR export

- `GET /api/foundation/health-events/export/fhir`: owner 격리; `Content-Type: application/fhir+json`; `Content-Disposition: attachment; filename="alm-health-events-<YYYYMMDD>.fhir.json"`; `no-store`, `nosniff`.
- 본문: `Bundle`(`type: "collection"`, `timestamp`, `meta.tag` = `{system: "https://alm.example/fhir/tag", code: "synthetic"}`), entry마다 `Observation`: `id` = eventId, `status: "final"`, `category` laboratory, `code` = `{coding: [{system: "http://loinc.org", code}] (개념표에 LOINC가 있을 때만), text: 라벨}`, `effectiveDateTime` = 검사일(`YYYY-MM-DD`), `valueQuantity` = `{value: 숫자, unit}`(값이 숫자로 파싱되지 않으면 `valueString`), `referenceRange: [{text}]`(원문이 있을 때만, low/high 없음), 정정된 기록은 `note: [{text: "본인이 값을 수정함"}]`. `interpretation`·`subject`·`performer` 없음.
- 의존성 추가 없음(직접 만든 DTO). 테스트: 구조 규칙(필수 필드, LOINC 유무, `interpretation` 부재, 참고치 text만), owner 격리, 헤더, 감사 `HEALTH_EVENTS_EXPORTED`(형식 구분이 필요하면 값 없는 코드 컬럼만).
- Web: 데이터 관리에 두 번째 링크 "내 기록 내보내기(FHIR)", 도움말 "다른 건강기록 도구가 읽을 수 있는 형식이에요." 0건이면 비활성.

## 5. PR #5 F-3

- 대상 브랜치 `codex/unified-health-product`(PR #5). 임시 worktree에서 작업·푸시. 거부된 bootstrap(서버가 거절한 경우)이 "복원 실패"로 보이던 것을 고유 문구와 다음 행동으로 분리. 근거: `docs/reviews/2026-09-16-pr5-qa-review.md` F-3. 그 브랜치의 web 테스트·tsc 통과, PR #5에 코멘트.

## 6. Wave 3 minor

- 한 행의 참고치가 둘이면(`70-99 100-200`) 공백 하나로 이어 원문 그대로 보존(40자 이하일 때; 넘으면 null). 테스트.
- MedGemma side-by-side 리포트에 `referenceRangeAccuracy` 행 추가.
- `cellArrived` 클래스는 `animationend`에서 제거(같은 마운트에서 재생 반복 없음). 테스트.

## 7. 테스트·증거

- 위 각 절의 테스트 + e2e: 두 문서 확인 후 `/my-data/history`에 시리즈·세 계산값·표, 화면 어디에도 참고치 없음, FHIR 다운로드 헤더와 `referenceRange.text`, 320px 매트릭스.
- 게이트 전부 + `docs/status/2026-09-17/wave4.md` + AGENTS/guide/roadmap 한 문장. readiness 무변경. 브랜치 `codex/wave8-measurement-history-fhir`(PR #11 위 stacked).

## 8. 범위 밖

방향 서술(Level 1), 회귀·예측, 참고치 표시·밴드, 앱 전체 리스킨, 설명 템플릿(d), 모델 provider(e), FHIR 가져오기, Patient 리소스.
