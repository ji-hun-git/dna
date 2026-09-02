# Wave 2: digest-keyed synthetic document sets, records across dates, Korean status labels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a synthetic user import two different synthetic result documents from two dates, see their confirmed values grouped by date with a plain "what changed" list, and see Korean labels instead of raw server enums everywhere in the integrated UI. Roadmap items A4 (first half), A5 (lite), and the A3 enum note.

**Architecture:** Spring keeps a small named catalogue of synthetic candidate sets; configuration binds an approved source digest to a set id (relaxed binding, indexed list, like `local-identities`). Unbound digests fall back to the default set so existing evidence keeps its meaning. The web app derives comparisons purely from confirmed records already returned by `GET /records`; no new API. Enum-to-Korean mapping is one shared module in `apps/web/lib/format/`.

**Tech Stack:** unchanged (Kotlin/Spring Boot/Flyway/PostgreSQL 18; Next.js 16.3.3/React 19/Zod 4/Vitest 4/MSW 2/Playwright 1.62; Node 24.20.0; pnpm 11.20.0; Java 21).

## Global Constraints

- Synthetic fixtures only; candidate values are fixtures keyed to allow-listed digests, never parsed from bytes. No real data, no PHI.
- No diagnosis, normality, reference range, risk, treatment, medication, trend judgement, arrow-colouring, or alert. The comparison view states two dated values side by side in plain Korean and nothing else.
- Spring authority unchanged; no Next.js route handlers; new Spring routes: none.
- Fixture values sit away from published clinical cutoffs (repository skill `gc-synthetic-fixture` rule 6).
- Korean copy rules (`.claude/skills/gc-korean-copy/SKILL.md`); forbidden-term scan must pass for every integrated component.
- Toolchain exact: Node `24.20.0`, pnpm `11.20.0`, Java `21`. Implementers do not commit; the controller commits.
- Catalogue (set id → ordered candidates; all evidencePage 1):
  - `checkup-2026-07` (default, unchanged from today): (1, 총콜레스테롤, 188, mg/dL, 2026-07-28), (2, 당화혈색소, 5.2, %, 2026-07-28), (3, 비타민 D, 42, ng/mL, 2026-07-28)
  - `checkup-2026-01`: (1, 총콜레스테롤, 194, mg/dL, 2026-01-15), (2, 당화혈색소, 5.4, %, 2026-01-15), (3, 비타민 D, 38, ng/mL, 2026-01-15)
- Korean label map (single source of truth, `apps/web/lib/format/status-labels.ts`):
  - candidate status: `PENDING` → `확인 대기`, `CONFIRMED` → `확인함`, `EXCLUDED` → `제외함`
  - consent status: `NOT_GRANTED` → `동의 전`, `ACTIVE` → `동의함`, `REVOKED` → `철회함`
  - record status: `CURRENT` → `현재 값`, `SUPERSEDED` → `이전 값`
  - review decision: `CONFIRMED` → `원문과 같음`, `CORRECTED` → `값을 수정함`
  - document status: reuse `processingCopy` sentences already in `IntegratedHealthExperience.tsx`; the raw status word may remain inside a `<code>` element labelled `서버 상태 코드`.

---

### Task 1: Backend — named synthetic document sets bound by digest

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/SyntheticCandidateFixture.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationProperties.kt`
- Modify: `apps/core-api/src/main/resources/application.yml` (document the new list under `gc.foundation`)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/DocumentWorkerBoundary.kt` (`completeExtraction` resolves the set through properties)
- Modify: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/SyntheticCandidateFixtureTest.kt`
- Modify: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- `data class SyntheticDocumentBinding(val sha256: String = "", val setId: String = "")` in `FoundationProperties`; `val syntheticDocuments: List<SyntheticDocumentBinding> = emptyList()`; validation: each `sha256` matches `^[0-9a-f]{64}$` and is in `allowedDocumentSha256`; each `setId` exists in the catalogue; digests unique.
- `SyntheticCandidateFixture.setIds(): Set<String>`; `SyntheticCandidateFixture.candidatesFor(setId: String): List<SyntheticCandidate>` (throws `IllegalArgumentException` for unknown id); `const val DEFAULT_SET_ID = "checkup-2026-07"`.
- `FoundationProperties.candidateSetFor(sourceSha256: String): String` returns the bound set id or `DEFAULT_SET_ID`.
- Relaxed binding names: `gc.foundation.synthetic-documents[0].sha256`, `gc.foundation.synthetic-documents[0].set-id` (env `GC_FOUNDATION_SYNTHETIC_DOCUMENTS_0_SHA256`, `..._0_SET_ID`).

- [ ] Unit tests first: catalogue has both ids; default set unchanged (assert ordinal 1 digest equals `sha256("총콜레스테롤|188|mg/dL|2026-07-28")`); `checkup-2026-01` values as listed; unknown id throws; properties validation rejects an unknown set id and a digest missing from the allow-list; unbound digest resolves to the default.
- [ ] Implementation as in Interfaces. `completeExtraction`: `val candidates = runCatching { SyntheticCandidateFixture.candidatesFor(properties.candidateSetFor(job.sourceSha256)) }...` keeping the existing dead-letter fallback.
- [ ] Integration test: register a second fixture digest bound to `checkup-2026-01`; run the pipeline for both documents for one subject; assert `/records` returns the 2026-01 and 2026-07 values with the right `observedOn`; assert the unbound digest still yields the default set.
- [ ] Gates: `./gradlew.bat test --no-daemon` (PostgreSQL classes skip locally; `compileTestKotlin` must pass).

---

### Task 2: Frontend — comparison list, Korean status labels, second-document E2E

**Files:**
- Create: `apps/web/lib/format/status-labels.ts` with the map above and `labelCandidateStatus`, `labelConsentStatus`, `labelRecordStatus`, `labelReviewDecision` (typed against the client's enums; unknown values fall back to the raw string).
- Create: `apps/web/lib/records/compare-records.ts` exporting `compareRecords(records: FoundationRecord[]): RecordComparison[]` where `RecordComparison = { label: string; unit: string; earlier: { observedOn: string; value: string }; later: { observedOn: string; value: string } }`, built from `CURRENT` records only, one entry per label that has values on at least two distinct `observedOn` dates (earliest and latest), sorted by label. No numeric interpretation.
- Create: `apps/web/components/integrated/RecordComparison.tsx` (presentational): heading `날짜별로 본 내 기록`, sentence `같은 항목의 두 날짜 값을 그대로 나란히 둔 목록이에요. 변화의 의미는 판단하지 않아요.`, one `<li>` per comparison rendering `{label} · {earlier date} {earlier value} {unit} → {later date} {later value} {unit}` using `formatKoreanDate`; empty state `두 날짜 이상 확인한 항목이 아직 없어요.`
- Modify: `apps/web/components/integrated/IntegratedRecords.tsx` (render `RecordComparison` above the groups when at least one comparison exists; replace `{record.status}` with `labelRecordStatus`).
- Modify: `apps/web/components/integrated/CandidateReview.tsx` (`{candidate.status}` → `labelCandidateStatus`), `IntegratedHealthExperience.tsx` (consent status, `latest.status`, `record.reviewDecision`, document status in processing view → sentence plus `<code aria-label="서버 상태 코드">`), `IntegratedDataControl.tsx` (consent status strings; keep `data-status` attributes), `VisitPreparation.tsx` (decision text if it prints the enum).
- Modify: `apps/web/tests/korean-ux-copy.test.ts` (add `RecordComparison.tsx`; add the forbidden visible enums `"CORRECTED"`, `"REVOKED"`, `"NOT_GRANTED"` to a new assertion that scans the integrated components for `>{...status}` style raw rendering — implement as: no integrated component source contains `{candidate.status}`, `{consent?.status ?? "NOT_GRANTED"}`, `{record.status}`, `{record.reviewDecision}`, `{latest.status}`).
- Modify: `apps/web/e2e/foundation-lifecycle.spec.ts` and `apps/web/playwright.foundation.config.ts`: build a second synthetic PDF (`buildSyntheticPdf("Genome Companion synthetic fixture 2026-01")` with a parameter for the text so digests differ), pass both digests in `GC_ALLOWED_DOCUMENT_SHA256` (comma-separated) and bind the second to `checkup-2026-01` via `GC_FOUNDATION_SYNTHETIC_DOCUMENTS_0_SHA256` / `GC_FOUNDATION_SYNTHETIC_DOCUMENTS_0_SET_ID`; expose `GC_BROWSER_FIXTURE_2_BASE64`. In the first test, after completing the first document (2 saved, 1 excluded), start `결과지 추가` again, upload fixture 2, confirm all three, then on `/records` expect two group headings (`2026. 7. 28.` and `2026. 1. 15.`) and the comparison list containing `총콜레스테롤` with `194` and `190`; `/prepare` shows five articles. Replace the `ACTIVE` / `REVOKED` / `CORRECTED` exact-text assertions with `동의함` / `철회함` / `값을 수정함`. Raise the test timeout to 150 s.
- Tests: `tests/status-labels.test.ts`, `tests/compare-records.test.ts` (two dates → one comparison; one date → none; corrected values use the current value), `tests/record-comparison.test.tsx` (renders list, empty state, axe), update existing tests whose assertions used enums.
- [ ] Gates: `pnpm web:test`, `pnpm --dir apps/web build`, `pnpm auth-security:gate`.

---

### Task 3: Docs

- `docs/roadmap/2026-09-02-roadmap.md`: A4 → `this wave (first document set; more types later)`, A5 → `this wave (lite)`, A3 note about enums → done.
- `docs/product/intended-use-matrix.md`: add row "Show two dated values of the same item side by side" with boundary "no interpretation, no colour or arrow semantics, user-confirmed values only".
- `.claude/skills/gc-synthetic-fixture/SKILL.md`: rule 4 now points at the catalogue and the `synthetic-documents` binding.
- `PROJECT_GUIDE.md` §2 consumer web row: mention two-date comparison, cite the CI run once known.
