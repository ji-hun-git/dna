# Wave 2C — What-changed API · 동의 목적 분리 · HealthEvent Export (디자인, 2026-09-17)

상태: founder 승인(2026-09-17 대화). 기준: `PHI_MASTER_PRODUCT_DOCUMENT.md` §31.1(What Changed), §33(동의 분리 A/B/C/D), §10.2(데이터 관리: Export). 저장소 authority: `PROJECT_GUIDE.md` §6, `AGENTS.md`. 스펙 2026-09-16 §4의 백엔드 항목을 구체화한다.

## 0. 한 문장

새 결과지를 확인하고 나면 "무엇이 새로 들어왔고, 같은 항목의 직전 값은 무엇이었는지"를 서버가 결정론적으로 알려주고, 동의를 서비스 제공·연구 활용·연구 연락·프로젝트별로 분리해 저장하되 연구 동의는 어떤 서비스 동작의 조건도 아니며, 본인의 HealthEvent를 JSON으로 내보낼 수 있다.

## 1. 경계 (변하지 않는 것)

- 판단 없음: What-changed는 값을 나열만 한다(차이·비율·방향·색·화살표 없음). reference range·추세·위험 없음.
- Next.js는 API 라우트·토큰·권한 규칙을 얻지 않는다. export 다운로드는 core의 URL을 브라우저가 직접 여는 방식(같은 쿠키·세션·owner 검사).
- 연구 동의는 저장만 된다. 현재 연구 파이프라인·연락 채널은 없고, 실제 활용 전에는 프로젝트별 동의를 다시 묻는다는 사실을 UI 카피에 명시한다. 연구 동의는 서비스 이용의 필수조건이 아니다(테스트로 증명).
- readiness 무변경. 합성 데이터만. 감사 이벤트에 값·날짜 없음.

## 2. What-changed API

- `GET /api/foundation/changes` (owner 격리, `Cache-Control: no-store`). 계산 기준: CURRENT 레코드 버전만.
- 응답:
  ```json
  {
    "latestDocument": { "documentId": "...", "observedOn": "2026-07-28", "completedAt": "...", "eventCount": 3 } | null,
    "items": [
      { "conceptCode": "total-cholesterol" | null, "concept": "총콜레스테롤", "unit": "mg/dL",
        "latest": { "eventId": "...", "value": "188", "observedOn": "2026-07-28" },
        "previous": { "eventId": "...", "value": "194", "observedOn": "2026-01-15" } | null }
    ],
    "newConcepts": ["비타민 D"],
    "unchangedCount": 0
  }
  ```
- 규칙: `latestDocument` = 가장 최근 `completed_at`의 문서 중 CURRENT 레코드가 1개 이상인 것. `items` = 그 문서의 CURRENT 레코드 각각에 대해, 같은 `concept_code`(없으면 같은 라벨)·같은 단위의 다른 문서 CURRENT 레코드 중 `observed_on`이 가장 늦은 것을 `previous`로. 단위가 다르면 `previous = null`(환산 안 함). `newConcepts` = `previous`가 없는 항목 라벨. `unchangedCount` = 이전 문서들에 있고 이번 문서에 없는 항목 수(정보성). 문서가 없으면 `latestDocument = null`, 빈 배열.
- Kotlin: 순수 함수 `ChangeSummaryProjection.project(records: List<FoundationRecordRow>, documents: List<...>)` + 단위 테스트; 엔드포인트는 기존 `listRecords`와 같은 보안 경로.
- Web: 홈(`IntegratedHealthExperience` 홈 뷰)에 "최근 변화" 섹션: 새 결과지 날짜, "새 기록 N개", 항목별 `이전 값 → 이번 값`이 아니라 두 값을 나란히(날짜 포함), 새로 추가된 항목 목록. 카피: "새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요." 0건이면 섹션 숨김. zod `.strict()`.

## 3. 동의 목적 분리 (V9)

- V9: `gc_consent_grant` CHECK를 `purpose_code ~ '^(DOCUMENT_EXTRACTION|RESEARCH_USE|RESEARCH_CONTACT|PROJECT:[a-z0-9-]{1,40})$'`로 완화. 기존 유니크 인덱스(subject, purpose)는 유지(활성 1건). `policy_version`은 목적별 상수(`research-consent-policy.v1` 등).
- 엔드포인트: `GET /api/foundation/consents` → `[{purposeCode, status, consentId|null, grantedAt|null, revokedAt|null, policyVersion}]` (4종 고정 순서, PROJECT 동의는 있는 것만). `POST /api/foundation/consents/{purposeCode}` (Idempotency-Key; 이미 ACTIVE면 같은 receipt). 철회는 기존 `POST /consents/{consentId}/revocation`. `DOCUMENT_EXTRACTION`의 기존 엔드포인트는 그대로 두고 새 목록 API가 포함한다.
- 불변식 테스트(PostgreSQL): 연구 동의가 없거나 철회된 상태에서 부트스트랩→업로드→검토→기록→export→삭제 전체가 성공; 연구 동의 부여/철회가 다른 목적 상태를 바꾸지 않음; PROJECT 동의는 `PROJECT:` 접두 검증; 감사 이벤트 `CONSENT_GRANTED`/`CONSENT_REVOKED`에 목적 코드만.
- Web: 데이터 관리 화면의 동의 섹션을 4행으로. 행: 서비스 제공(결과지 처리) — 기존 동작; 연구 활용 — "가명처리 후 연구에 쓰는 것에 대한 선택. 지금은 진행 중인 연구가 없어요."; 연구 연락 — "적합한 연구가 있을 때 참여 제안을 받을지. 지금은 연락 채널이 없어요."; 프로젝트별 — "프로젝트가 생기면 여기서 개별로 물어요." 각 행에 동의/철회 버튼과 상태(한글 라벨, 색상 외 텍스트). 연구 동의가 서비스 필수가 아님을 문장으로: "연구 동의 없이도 모든 기능을 쓸 수 있어요."

## 4. Export

- `GET /api/foundation/health-events/export`: owner 격리; `Content-Type: application/json`, `Content-Disposition: attachment; filename="alm-health-events-<YYYYMMDD>.json"`; 본문 `{ schemaVersion: "alm-health-events-export.v1", exportedAt, subjectKind: "synthetic", events: HealthEvent[], documents: [{documentId, observedOn?, status, abstentions}] }`. reference range 없음. 감사 `HEALTH_EVENTS_EXPORTED`(건수·값 없음).
- Web: 데이터 관리 "내 기록 내보내기(JSON)" 링크(`<a href="/api/foundation/health-events/export" download>`), 도움말 "브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요." 0건이면 비활성 + "내보낼 기록이 없어요".

## 5. 카피(한국어)

위 문장들을 그대로. 판단 어휘·raw enum 금지. 카피 스캔 목록 갱신.

## 6. 테스트·증거

- Kotlin 단위(ChangeSummaryProjection), PostgreSQL 통합(changes, consents 불변식, export 헤더·본문·감사), zod/컴포넌트 테스트(홈 섹션, 동의 4행, export 링크), e2e: 두 문서 후 홈 "최근 변화" 항목 확인, 연구 동의 부여→철회 후 라이프사이클 지속, export 응답 헤더 확인(다운로드 이벤트).
- 게이트 전부 + `docs/status/2026-09-17/wave2c.md` + ledger/roadmap/guide 한 문장. readiness 무변경.

## 7. 범위 밖

연구 파이프라인·연락 실제 발송, 프로젝트 생성 UI, export 형식 다양화(CSV/FHIR), What-changed의 차이 계산·추세, 디자인 변경.
