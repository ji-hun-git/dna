# Wave 7 — 백엔드 경화: 침묵하지 않는 추출, 계약 정합, 동시성·보안·운영 (디자인, 2026-09-18)

상태: founder 지시 "perfecting the backend first"(2026-09-18) + 적대적 백엔드 리뷰(2026-09-18, fable) + founder 결정 3건(아래). 게이트: 없음 — 리뷰가 지목한 세 계약 변경은 founder가 2026-09-18 대화에서 결정했고 이 문서가 그 기록이다(값 문법·동의 철회 의미·픽스처 정책). 실제 PHI·호스팅·레지스트리·AWS·provider는 계속 범위 밖. 저장소 authority: `PROJECT_GUIDE.md` §6–8, `AGENTS.md`, `.claude/skills/gc-safe-change`, `gc-synthetic-fixture`, `gc-readiness-evidence`.

## 0. 한 문장

파서가 무엇을 버렸는지 사람이 항상 볼 수 있게 하고(침묵 금지), 사람이 확인하는 값의 문법을 파서가 낼 수 있는 값과 일치시키며, 멱등키·동시성·동의 철회·삭제의 의미를 정확히 만들고, 요청 크기·세션·감사 폭주·PDF 검사의 구멍을 막고, 로그·헬스·마이그레이션 재생·게이트가 "진짜로 실패할 수 있게" 만든다.

## 1. founder 결정 (2026-09-18)

1. **값 계약**: 확인·수정 요청의 값 문법을 워커 문법과 일치시킨다 — 음수, 천 단위 쉼표, 소수 자릿수 제한 없음(최대 64자), 원문 그대로 저장. 계산은 이미 `BigDecimal`(쉼표 제거)이다.
2. **동의 철회**: `DOCUMENT_EXTRACTION` 철회 시 REVIEW_REQUIRED·처리 중 문서를 모두 종료(`TERMINATED_BY_REVOCATION`)하고 격리 파일을 지운다. 재동의 후에는 새로 올려야 한다. 확정된 기록은 삭제 요청 전까지 유지된다(기존 의미).
3. **픽스처 정책**: 실제 한국 검진 레이아웃(공단 일반검진 결과통보서, 병원 양식)의 **구조만** 본뜬 합성 문서를 벤치마크에 추가한다. 값·이름·기관명·주소·서식 문구는 합성이며, 기대 결과는 사람이 손으로 적는다(`gc-synthetic-fixture` 규칙 준수, 실제 문서 파일 사용 금지).

## 2. 침묵하지 않는 추출 (worker)

- 원칙: 한 줄에서 라벨과 숫자스러운 토큰이 보였는데 후보를 만들지 못하면 반드시 abstention(사유 포함). `return null`로 조용히 버리는 경로 0개(테스트로 증명: 파서의 모든 조기 반환에 대응하는 abstention 케이스).
- 새 문법: 값-앞-라벨(`120 mg/dL 혈당`), 줄바꿈 라벨(다음 줄로 이어진 라벨), `<`·`≤`·`>` 값(`<0.3 mg/L` → 값 `<0.3`이 아니라 abstention `qualified_value`, 사유에 원문), 붙은 단위(`5.6%`, `188mg/dL`), 혈압 `120/80 mmHg`(수축기·이완기 두 후보로 분리, 각 `systolic-blood-pressure`/`diastolic-blood-pressure`; 원문 라벨 `혈압` 보존), 정성 결과(`음성`/`양성`/`정상`/`이상`)는 abstention `qualitative`(값은 저장하지 않음).
- 같은 기준선 다중 컬럼: `PDFTextStripper` 대신 위치 기반 토큰 그룹화(x-gap 임계) 후 컬럼별 행 재구성; 이전 결과 컬럼(`이전`, `전회`, 연도 헤더)은 별도 문서 시기로 만들지 않고 abstention `previous_column`으로 표시.
- 날짜: `재검사일` 같은 합성어 배제(한글 좌우 lookaround), 영어 `date`는 `report`/`print`/`issue` 앞말이 있으면 문서 날짜 후보에서 제외, 두 자리 연도 지원 안 함(명시).
- 새 abstention 사유는 경계 DTO의 패턴에 추가(`ExtractionAbstention.reason`), 웹 카피에 한국어 문장 매핑.

## 3. 값 계약 (core)

- `CandidateConfirmationRequest.value`·`RecordCorrectionRequest.value` 패턴 = 워커 `ExtractedCandidate.value` 패턴, `@Size(max=64)`. 저장은 원문(쉼표 포함). 모든 계산·비교는 기존 `parse()`(쉼표 제거)로.
- 통합 테스트: `250,000 /µL` 확정, `-2 mmol/L` 확정, `1.234 µIU/mL` 수정, 초과 길이 400.

## 4. 멱등성·동시성·상태

- `gc_idempotency`에 `resource_id`, `request_sha256`, `expires_at`(24h) 추가(V13). 같은 키 + 다른 리소스/요청 해시 → `422 idempotency_key_mismatch`; 만료 키는 새 요청으로 처리; 삭제·만료 시 정리(재니터 §7).
- 확정·제외·수정·문서 요청 경로는 대상 행을 `SELECT … FOR UPDATE`로 잠근 뒤 상태 검사; 상태가 바뀌었으면 `409 candidate_state_changed`/`record_state_changed`. `check(it == 1)` 전부 제거.
- 모든 프레임워크 예외(JSON 파싱, 누락 헤더, UUID 아님, 잠금 충돌)는 `problem+json` 형태의 기존 오류 분류로 매핑, `Cache-Control: no-store`, 요청 본문 값이 로그·응답에 나오지 않음(테스트).
- `/changes`와 `/series`의 같은 날 규칙 일치(`/changes`도 같은 날 previous면 `delta` 생략).
- 기록 목록·export 정렬은 `observedOn`, `confirmedAt`(정정으로 순서가 바뀌지 않음).
- `reviewDecision`은 정정 이력이 있으면 값이 원래로 돌아와도 `CORRECTED` 유지.
- 삭제: DB 트랜잭션 먼저(행 표시), 커밋 후 파일 삭제, 실패 시 재시도 큐(재니터가 고아 파일·고아 행을 정리); `gc_idempotency`·`gc_session`·`gc_upload_capability`까지 삭제.

## 5. 보안

- 요청 본문 상한: JSON 256 KB(필터), 워커 결과 페이로드 2 MB(미리보기 PNG 별도 상한), 업로드 PUT은 스트리밍 저장(메모리 버퍼 금지) + 10 MB.
- `POST /session`: 주체별·IP별 토큰 버킷(분당 10) + 실패 5회 후 15분 잠금; 알 수 없는 주체는 감사 행을 남기지 않고 카운터만 증가(주체 해시 남기지 않음); 데모 정원은 **활성 주체 수** 기준(삭제·만료 시 반환).
- 세션: `POST /session/logout`(쿠키 삭제·행 종료), 확정 성공 시 세션 id 회전 없음(고정 30분 유지) 대신 슬라이딩 만료 없이 하드 만료 + 재로그인 안내; `SameSite=Strict`, `HttpOnly`, `Secure`(운영 프로파일), CSRF는 상태 변경 POST에 `X-Requested-With`+ Origin 검사.
- 워커 신뢰: 워커 id를 시크릿에서 파생한 HMAC으로 검증(자기 주장 금지), `/internal/**` 분당 한도, 페이로드 재생 방지(job id + lease token 일회성).
- `server.forward-headers-strategy`는 신뢰 프록시 목록이 있을 때만(`application-hosted.yml`), 기본 `none`; 사용하지 않는 actuator 노출 제거, actuator 경로를 security matcher에 포함.
- PDF 검사: 페이지 `/AA`, 주석 `/A`(JavaScript·Launch·URI·GoToR), FileAttachment, 중첩 Form XObject·패턴·인라인 이미지 픽셀 합산(재귀, 깊이 제한), 암호화 PDF·XFA는 거부; 렌더는 메모리 상한 서브프로세스(`-Xmx`)에서, OOM은 `render-error` abstention; `hasUnexpectedTrailingData` O(n) 구현.
- CI: Trivy `ignore-unfixed: false`(Critical만 차단), 이미지 스모크(core-api·worker 컨테이너 기동 → `/healthz` 200 → 종료).
- GHCR 익명 pull stop-ship은 founder 게이트로 유지(코드 변경 없음, evidence에 재기록).

## 6. API 계약

- `docs/api/foundation-openapi.yaml`(수기 작성, 테스트가 실제 응답과 대조: 필드 집합·nullability·오류 코드) — 새 스펙 생성기 의존성 없음.
- 캡: `/records`·`/health-events`·`/series`·`/changes`·export는 주체당 문서 200·기록 5,000 상한에서 `413 payload_cap_exceeded`가 아니라 커서 페이지네이션(`?after=`)을 `/records`·`/health-events`에 추가; export는 상한 초과 시 명시적 오류.
- nullability 규칙 문서화: 응답은 `non_null`(생략), export만 `ALWAYS`(명시 null) — OpenAPI에 기재.
- 시간: 모든 instant UTC ISO-8601, `observedOn` 날짜 문자열, 파일명 날짜는 `exportedAt`을 KST로 변환한 같은 instant(불일치 불가) — 테스트.

## 7. 운영

- 로그: `PhiSafeLogger`를 실제로 사용(요청 id·주체 해시·이벤트 코드만; 값·라벨·파일명 금지 — 로그 캡처 테스트로 증명), 워커도 동일 포맷.
- 워커 헬스: core 도달 가능·ClamAV 시그니처 존재·나이 ≤ 7일·작업 루프 살아있음을 실제로 검사; 실패 시 503과 사유 코드. 이미지에 `freshclam` 1회 실행 + 시그니처 나이 정책(오프라인 빌드 시 `scan-unavailable` 사유로 정직하게 실패).
- 재니터(스케줄): 만료 세션·업로드 능력·멱등키·고아 격리 파일 정리; `QUEUED` 24시간 초과 작업을 `FAILED_TERMINAL(reason=stale)`로 종료하고 문서를 사람에게 보이는 상태로.
- 워커 루프: `OutOfMemoryError`를 삼키지 않음(프로세스 종료 → 재시작), 지수 백오프, graceful shutdown.
- 마이그레이션 재생 테스트: V1..Vn-1 적용 → 대표 행 삽입(후보 2개/문서 등) → Vn 적용이 CI에서 실행; `GC_TEST_POSTGRES_URL`을 Gradle 테스트 입력으로 선언(`cleanTest` 의식 제거).
- 웹 클라이언트 fetch 타임아웃(`AbortSignal.timeout`)과 한국어 오류.

## 8. 정직성

- 감사 값 누출 단언을 실제 행 텍스트 검사로 교체(모든 텍스트 컬럼, 값·라벨·날짜 부재), `gc_audit_event`에 append-only 트리거(V13) 추가 후 readiness의 anchor 문구를 실제 테이블로 수정.
- `conceptAccuracy`는 리포트에서 "러너·골드 일치"로 이름 바꾸고, 새 손 라벨 픽스처(§9)의 `handLabelledAccuracy`를 별도 지표로.
- readiness evidence의 run id를 최신 CI로 갱신(수치는 실제 출력만).

## 9. 벤치마크: 손 라벨 레이아웃 픽스처

- `packages/korean-checkup-benchmark/fixtures/hand-labelled/`: 공단 일반검진 결과통보서형(2단, 판정 컬럼, 이전 결과 컬럼, 혈압 120/80, 신체계측·혈액·소변 섹션, 머리글·바닥글 날짜), 병원 종합검진형(항목·결과·단위·참고치 4열, 페이지 넘김 라벨, `<` 값, 붙은 단위), 스캔+보이지 않는 OCR 층형(텍스트 층을 신뢰하면 안 되는 케이스 → 문서 abstention 기대). 내용은 합성, 기대 결과는 사람이 `expected.json`에 손으로(후보·abstention·사유·개념 코드) — 생성 코드가 만들지 않는다.
- 게이트: 기존 지표 유지 + `handLabelledAccuracy`(후보 정확도·abstention 정확도) 보고; 초기 임계는 측정 후 evidence에 기록하고 그 값을 회귀 하한으로 고정(100%를 가장하지 않음).

## 10. 테스트·증거

- 각 절 단위·통합 테스트(동시성은 2스레드 실제 경쟁), 로그 캡처 테스트, 마이그레이션 재생 CI 잡, 이미지 스모크 잡, `docs/status/2026-09-18/wave7.md`, readiness anchor 문구 수정(verdict NO_GO 불변), `docs/api/foundation-openapi.yaml`. 브랜치 `codex/wave13-backend-hardening`(PR #15 위 stacked). 큰 범위이므로 두 PR로 나눠도 됨(7a: §2–§4·§9, 7b: §5–§8).

## 11. 범위 밖

실제 문서·PHI, 호스팅, GHCR 권한 변경, provider 연결, OCR/모델 추출(게이트 (e)), 프론트엔드 재설계(Wave 6, 보류).
