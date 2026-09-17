# PR #5 QA review — 2026-09-16

Reviewer: Claude (QA/FDE session) at the founder's request. Head reviewed: `549fcc1b40b8d59583ce71b8b2e7047f812d55f3` ("Restore failed home reads without replacing demo sessions"), newer than the `4157a4ee…` head cited in the PR body.
Scope: local execution on Windows 11 with the pinned toolchain (Node 24.20.0, pnpm 11.20.0, Java 21) and an embedded synthetic-only PostgreSQL 16 (`embedded-postgres` npm binary, trust auth, loopback). Real Spring + separate worker + Next dev via `pnpm dev:synthetic`, driven from the Claude desktop built-in browser with the accessibility tree and page text as the primary oracle. Not a hosted-system, clinical, or regulatory claim. Release stays NO_GO; no gate changes.

## 1. Automated gates (local)

| Gate | Result |
|---|---|
| `pnpm security:runtime-policy` | PASS node=24.20.0 pnpm=11.20.0 next=16.3.3 |
| `pnpm release:readiness:validate` | valid; verdict NO_GO, 12 blocking gates (expected) |
| `pnpm web:test` | 37 files, 173 tests passed (PR body says 156; later commits added tests) |
| `pnpm --dir apps/web build` | passed; 8 routes, proxy middleware |
| `pnpm auth-security:gate` | PASS |
| `./gradlew.bat cleanTest test` with `GC_TEST_POSTGRES_URL` (embedded PostgreSQL) | 95 tests, 3 skipped, 0 failures, 0 errors. `FoundationLifecyclePostgresIntegrationTest` ran for real: 9/9 passed. Still skipped: `ConsentJdbcRepositoryTest` (Testcontainers, needs Docker), `SyntheticFhirEvidenceProjectorTest` (needs `GC_SYNTHEA_FHIR_BUNDLE`), `ClamAvCommandScannerIntegrationTest` (CI-only engine) |

Gate results after the fixes in §7 are recorded at the end of that section.

## 2. Browser scenarios (all passed unless a finding is cited)

**A. First sheet, full review.** 체험 시작 → 결과지 추가 → purpose consent (state 동의 전 → 동의함) → 7월 예시 결과지 → three ordered candidates (총콜레스테롤 188 mg/dL, 당화혈색소 5.2 %, 비타민 D 42 ng/mL), approved PNG preview with digest and "서버가 미리 정한 예시 값" disclosure → 확인 / 값 수정 to 5.3 / 제외 → completion "저장 2개 · 제외 1개". 기록 shows 2 current records; the corrected one shows 5.3 % with "사용자가 값을 수정함" and the original 5.2 % inside 출처와 버전. 진료 준비 shows 2 questions, each with a source link.

**B. Second sheet, comparison, persistence.** 결과지 추가 (consent remembered, no second prompt) → 1월 예시 → three confirmations → 기록 shows 5 current records in two dated groups; 날짜별로 본 내 기록 lists 당화혈색소 (5.4 % / 5.3 %) and 총콜레스테롤 (194 / 188 mg/dL); 비타민 D correctly has no pair (July value was excluded). Reload keeps everything. 진료 준비 shows exactly 3 questions, two-date questions first, links `/records#record-<id>` resolve to existing elements. See F-1 for what happens after the click.

**C. Revocation and deletion.** 데이터 → 동의 철회 → status 철회함, "현재 허용되지 않음"; 결과지 추가 from home re-opens the purpose consent with state 철회함 (no upload without re-consent). 삭제 요청 검토 → checkbox (properly labelled "위 내용을 확인했습니다") gates 서버에 삭제 요청 → "삭제가 완료됐어요", deletion ID shown, "감사에 건강 수치 없음". Afterwards /records and /data-control show the signed-out state and a new 체험 시작 creates a different owner with no records.

**Mobile/overflow.** At 375×812: no horizontal overflow on /, /records, /data-control; nav links 85×56 px; 체험 시작 51 px tall. One `prefers-reduced-motion` rule is present in the stylesheet. Wider matrix (320–1920) is asserted by the Playwright lifecycle in CI; not re-run here.

## 3. Findings

### F-1. Source links never reach their record — severity: major — boundary: no
Repro: 진료 준비 → "이 질문의 출처 보기" (href `/records#record-<uuid>`).
Observed: `/records` opens at the top (target 5,143 px below the fold, `scrollY` 0, nothing focused, details closed). Cause: the list renders after `getRecords()` resolves, so the browser's native hash jump fires against an empty page; `IntegratedRecords.tsx` has no hash handling.
Expected: the linked record is in view, its 출처와 버전 open, focus on it.
Fix: **applied in this review** (commit on this branch): `useEffect` after load scrolls to, opens and focuses the target; `li` gets `tabIndex={-1}`; test added.

### F-2. Confirmation time rendered as a raw ISO instant — severity: minor — boundary: no
Repro: 기록 → 출처와 버전 보기 → 확인 시각.
Observed: `2026-09-16T06:52:59.605506Z`. `formatKoreanDateTime` only accepts `YYYY-MM-DD[ T]HH:mm`, so a server instant passes through untouched (also in `EvidenceLens.tsx`). Same pattern the copy test says must not reach the screen.
Fix: **applied** — instants are formatted as Asia/Seoul local time (`2026. 9. 16. 15:52`); test added.

### F-3. A refused bootstrap is shown as "restore failed" and its reason is wiped — severity: major — boundary: no
File: `apps/web/components/integrated/IntegratedHealthExperience.tsx:203-208`. `signIn` maps every error to `RESTORE_FAILED`. For 429 `rate_limited`, 403 `demo_capacity_exhausted`, 403 `demo_bootstrap_disabled`, 403 `origin_denied` the user sees "체험 상태를 불러오지 못했어요" whose only action re-reads the session (401) and clears the message, returning to 체험 시작 with no explanation. The dedicated Korean strings in `messages.ts` are effectively unreachable. Not reproduced live (would need 21 bootstraps in a minute); confirmed by code reading.
Suggested fix: branch on the bootstrap call's problem code and stay on the entry screen with the message. Left for the PR author.

### F-4. Runner orphans children on SIGHUP (POSIX) — severity: minor — boundary: no
`apps/web/scripts/synthetic-local.mts:65-78`: children are `detached`; only SIGINT/SIGTERM are handled, so a closed terminal leaves 8087/8091/3138 running and the next run fails at `assertFree`. Ctrl+C is fine. Windows behaviour not affected.

### F-5. `POST /demo-session` is not idempotent — severity: minor / by design — boundary: no
A client retry after a lost response creates a second `synthetic-demo-*` subject and consumes two slots of both budgets; the first subject counts against lifetime capacity forever. The web client avoids re-posting, so only non-UI callers are affected. Worth one sentence in `local-development.md`.

### F-6. Missing-preview state is a dead end — severity: minor — boundary: no
`CandidateReview.tsx:98-100`: with `previewAvailable: false` the copy says "확인을 잠시 멈추고 다시 불러와 주세요" but there is no reload control and the parent never re-reads; only 제외 works until the person leaves and returns. The "no blind confirm" rule is right; the instruction is unactionable.

### F-7. Documentation claims two PostgreSQL test classes run with `GC_TEST_POSTGRES_URL` — severity: minor (docs) — boundary: no
`docs/operations/local-development.md` lists `ConsentJdbcRepositoryTest` and `SyntheticFhirEvidenceProjectorTest` as runnable with the URL. The first is `@Testcontainers(disabledWithoutDocker = true)`, the second is gated on `GC_SYNTHEA_FHIR_BUNDLE`. Also: Gradle serves a cached "success" for `test` when only environment variables change; `cleanTest` is required to actually execute the PostgreSQL class.

### F-8. Notes (no action required to merge)
- `handleRateLimited` returns `application/json` rather than `application/problem+json` (`FoundationLifecycleController.kt:390-395`).
- Budget count `LIKE 'synthetic-demo-%'` also counts operator-configured local identities with that prefix.
- Focus does not move into the 삭제 확인 section when it opens; it stays on 삭제 요청 검토.
- Tests that assert source text or force `<details open>` instead of behaviour: `visit-preparation.test.tsx:63`, `unified-product.test.tsx:5-12`; `run()` in the runner has no test.

## 4. Accessibility
- Keyboard: every control reached in the flows above is a native button/link/summary/checkbox; `summary` elements are focusable (tabIndex 0); the delete confirmation checkbox has an associated label.
- Non-colour meaning: 확인/수정 state is written ("사용자가 값을 수정함"); consent state is written (동의함/철회함); the comparison list uses text only.
- Reduced motion: one media rule present; no motion observed in these flows.
- Not done here: real screen reader, real browser zoom (the PR's 200%/400% claim is keyboard-reflow only), colour-scheme dark (app is light-only by design).
- F-1 was the one accessibility defect with user impact; fixed.

## 5. Korean copy against the claim register
- "예시 데이터" is used consistently for the data label. But engineering vocabulary still reaches the screen: "허용된 합성 PDF", "합성 결과지 후보 확인", "논리 격리", "적대적 입력으로 격리", "통합 합성 제품 상태", "신뢰하지 않는 보안 구역", "공공정보 실험실". These are accurate but read as internal terms; the register's own word is 예시. Suggest a follow-up copy pass (not blocking).
- Post-deletion and expired states say "로그인이 필요해요… 홈에서 다시 로그인" although the product has no login; the action is 체험 시작. Minor.
- Empty records: "아직 저장된 합성 기록이 없어요. 홈에서 허용된 합성 PDF를 확인해 주세요." same issue.
- The comparison row uses "→" between the two dates. It reads as chronological, not as a judgement, but a screen reader announces "arrow"; consider "·" or "그리고".
- No diagnosis, normality, risk, or advice wording was found anywhere in the flows. Disclosures ("값의 의미나 건강 상태를 판단하지 않아요", "실제 문자 인식 결과가 아닙니다") appear where the register requires them.

## 6. Code review notes (correctness)
Verified as sound: owner isolation on every new read/write; budget durability (advisory lock inside the transaction, soft-delete keeps counts, restart-safe); Origin check and opt-in flag on `/demo-session`; cookie flags; no raw exception text to the browser (`include-message: never`); all server enums pass through Korean labels; no memory/demo fallback on any route; runner forwards no DB/provider/model credentials to web or worker and binds loopback only; PDF digests deterministic and allowlisted; Tomcat 10.1.59 pinned and asserted. Defects found are F-3 to F-6 and F-8 above.

## 7. Merge recommendation
**Merge after fixes**: F-1 and F-2 are fixed on this branch by this review (two commits, tests included). F-3 should be fixed before merge because it hides the very budget messages the PR introduces; it is a contained change in one component. F-4 to F-8 can follow in a small PR.

Process blocker: `main` requires one approving review and the PR author (`ji-hun-git`) cannot approve their own PR, so merging needs either a second GitHub account with write access or a founder decision on the protection rule. This review does not constitute a GitHub approval.

Gates after the review fixes (commits `dd1da64`, `a791f9f`): `pnpm web:test` 37 files / 174 tests passed; `tsc --noEmit` clean; `pnpm auth-security:gate` PASS. F-1 and F-2 were re-verified in the running product: after following a 진료 준비 source link, the linked record was in the viewport, focused, its 출처와 버전 open, and 확인 시각 read `2026. 9. 16. 16:01`.
