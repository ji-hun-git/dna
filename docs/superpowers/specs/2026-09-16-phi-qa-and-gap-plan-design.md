# PHI 방향 QA + 프론트/백엔드 갭 플랜 — 디자인 (2026-09-16)

상태: founder 승인(대화 중) · 기준 문서: `PHI_MASTER_PRODUCT_DOCUMENT.md`(2026-09, 외부 파일) · 저장소 authority: `PROJECT_GUIDE.md`

## 0. 한 문장

PR #5를 실제로 실행해 QA 리뷰를 남기고, 그 위에서 PHI 문서가 말하는 "한 칸 = 하나의 데이터" 살아 있는 건강 타임라인을 현재 안전 경계 안에서 wave 단위로 구현한다. 경계를 넘는 항목은 founder의 intended-use 결정 뒤에만 코드에 들어간다.

## 1. 역할

- QA: PR #5(`codex/unified-health-product`)를 로컬 Spring + worker + Next 러너로 띄워 브라우저 시나리오를 직접 수행. 결함·접근성·한국어 카피·경계 위반을 `docs/reviews/2026-09-16-pr5-qa-review.md`와 PR 코멘트로 남긴다. 머지와 보호 규칙 조정은 founder 결정(작성자 본인 승인은 GitHub이 막음).
- FDE: main(PR #5 포함) 위에 wave별 `codex/*` 브랜치. 각 wave는 백엔드 read-model → 프론트 → 테스트 → 브라우저 증거를 관통. 릴리스 verdict와 readiness 게이트는 손대지 않는다.

## 2. Phase 0 — PR #5 QA 리뷰

툴체인: scratch에 Node 24.20.0 + pnpm 11.20.0 shim, Java 21(설치됨). Docker 없음: PostgreSQL JVM 클래스는 CI 결과 인용.

실행 항목:
1. `pnpm web:test`, `pnpm --dir apps/web build`, `pnpm auth-security:gate`, `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `.\gradlew.bat test --no-daemon`
2. `pnpm dev:synthetic`으로 러너 기동 → 내장 브라우저로 시나리오: 부트스트랩 → 동의 → 두 문서 업로드 → 후보 검토(확정/정정/제외) → 기록 비교 → 준비 질문 → 출처 PNG → 새로고침 → 동의 철회 → 삭제
3. 뷰포트 6종 + 키보드만 조작 + 200% 확대 등가 + `prefers-reduced-motion`

리뷰 문서 구조: 결함(재현·심각도·경계 위반 여부), 접근성, 한국어 카피(claim register 대조), 코드 리뷰(정확성), 머지 권고. 작고 되돌릴 수 있는 수정은 PR #5 브랜치에 별도 커밋, 큰 것은 finding.

## 3. Wave 1 — HealthEvent read-model + Living Cell 캔버스 (경계 내)

### 백엔드
- `GET /api/foundation/health-events`: 새 테이블 없음. CURRENT 레코드 버전을 투영.
- 필드: `eventId`(=recordVersionId), `recordId`, `domain`(현재 `lab` 고정), `concept`(=label), `value`, `unit`, `observedOn`, `source{documentId, page, documentSha256, sourceTextSha256, previewAvailable}`, `verification`(`CONFIRMED`→`verified`, `CORRECTED`→`verified`+`corrected: true`, 미리보기 없음→`uncertain`), `confirmedAt`.
- 기존 owner 검사·세션·CSRF·감사 그대로. Kotlin 테스트: SUPERSEDED·제외 항목 제외, owner 격리.

### 프론트
- `/my-data`(나의 데이터): `LivingCellCanvas`(순수 SVG `<rect>`, x=시간 scale, y=domain lane + 밀도 패킹, D3 scale은 좌표만), `TimelineAxis`, `CellTooltip`(항목·날짜·값), `EvidenceDrawer`(출처·페이지·다이제스트·버전 이력, 기존 `SourcePreview` 재사용), 단일 인풋(**정확 검색만**: 라벨 일치 셀 강조, 나머지 dim, 0건 명시).
- 셀 상태: idle / hover / selected / query-related / new / uncertain. 우선순위 `selected > query-related > new > idle`. 색상 외 테두리·해칭으로도 구분. `prefers-reduced-motion` 시 이동 애니메이션 없음.
- 대체 뷰: 같은 이벤트를 표/목록으로. 키보드로 셀 순회 가능, 각 셀에 접근 가능한 이름.
- 네비: "나의 데이터 / 데이터 관리" 2개. records·prepare는 나의 데이터 하위 섹션, connections·providers·data-control은 데이터 관리 하위. 기존 URL은 redirect.

### 테스트
vitest(투영 타입·scale·검색 필터·상태 우선순위), Kotlin(read-model), Playwright(업로드 후 새 셀 등장 → 클릭 → drawer), 한국어 카피 스캔 확장, axe, 뷰포트 스크린샷.

## 4. Wave 2 — 변화·동의·내보내기 (경계 내)

- What changed: 업로드 직후 새 이벤트 수, 같은 항목·단위의 이전 값 나열. 판단·화살표·색 없음. `compare-records` 확장.
- Consent Center: 서비스 제공 / 연구 활용 / 연구 연락 / 프로젝트별 동의 분리. `consentpurpose` 모듈에 purpose 추가. 연구 동의는 서비스 필수조건이 아님을 UI와 테스트로 보장. 철회 상태 기록.
- Export: 본인 HealthEvent JSON, 서버 생성, 브라우저 매개 다운로드. "저장됨" 문구 없음.
- 접근성: 실제 확대·스크린리더 점검 절차와 결과를 evidence로.

## 5. Wave 3 — 게이트 뒤 항목

각 항목은 `governance/intended-use-decision-<항목>.md`(founder 승인, 규제 검토 필요 여부 명시) 없이는 코드에 들어가지 않는다. 순서:
(a) 원본 reference range 보존만(candidate 스키마 + 마이그레이션, 표시 없음) →
(b) 결정론적 변화량·백분율 계산 →
(c) 추세 서술("최근 N회 연속 상승 관찰") →
(d) 확정 사실 위 설명 템플릿(A7, 100% hard-boundary eval) →
(e) 모델/OCR 추출 provider(기존 medical-ai eval 게이트).
LLM 자유 응답, 위험 예측, DNA, 제3자 AI 전송은 이 플랜 밖.

## 6. 불확실성·오류

미리보기 없음, 단위 불일치, 정정 이력은 `uncertain` 상태와 drawer 문구로 노출. 조용한 대체값 금지. API 실패 시 빈 캔버스 대신 명시적 오류와 재시도.

## 7. 증거

각 wave: AGENTS.md 게이트 전부 + 6 뷰포트 스크린샷 + `docs/status/<날짜>/` 증거 문서 + `codex/*` PR. readiness 업그레이드 없음.

## 8. 범위 밖

호스팅, 실 provider 연결, LLM 설명, DNA/VCF, DICOM, 위험 점수, 실제 PHI.
