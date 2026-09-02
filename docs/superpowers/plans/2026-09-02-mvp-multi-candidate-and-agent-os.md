# MVP multi-candidate review, visit preparation, and agent operating system — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hard-coded extraction candidate with an ordered synthetic candidate set reviewed one by one, add a grouped record view and a printable visit-preparation page, and ship the repository's Claude Code operating layer (AGENTS.md, skills, agents) plus the review and roadmap documents.

**Architecture:** Spring stays the authority: a `SyntheticCandidateFixture` supplies the ordered set at extraction completion, `gc_candidate.ordinal` orders it, and the document completes only when no candidate is pending. Next.js consumes a new list endpoint and keeps all state server-owned. The agent layer is documentation plus `.claude/` files; it changes no runtime behaviour.

**Tech Stack:** Kotlin 2 / Spring Boot 3 / Flyway / PostgreSQL 18 (Testcontainers or `GC_TEST_POSTGRES_URL` in CI); Next.js 16.3.3 / React 19 / Zod 4 / Vitest 4 / MSW 2 / Playwright 1.62; pnpm 11.20.0; Node 24.20.0; Java 21.

Spec: `docs/superpowers/specs/2026-09-02-mvp-multi-candidate-and-agent-os-design.md`.

## Global Constraints

- Synthetic fixtures only. No real PDFs, PHI, credentials, or provider calls. Candidate values are fixtures, never parsed from bytes.
- No diagnosis, normality, reference range, risk, treatment, medication, trend judgement, or alert. User copy must not imply clinical interpretation.
- Spring owns sessions, CSRF, consent, documents, candidates, records, audit, deletion. Next.js adds no API route handler and no authorization logic.
- New Spring routes only under `/api/foundation/**`. `ProhibitedRouteTest` must stay green.
- Toolchain is exact: Node `24.20.0`, pnpm `11.20.0`, Java `21`. Do not weaken `scripts/security/check-runtime-policy.mjs`.
- Korean user-facing copy: direct, plain, respectful. Dates via `formatKoreanDate`. The forbidden-term list in `apps/web/tests/korean-ux-copy.test.ts` applies to every user-facing component (`fixture`, `PHI`, `SYNTHETIC`, real institution names, and the rest).
- Candidate set (ordinal, label, value, unit, observedOn, evidencePage): (1, 총콜레스테롤, 188, mg/dL, 2026-07-28, 1), (2, 당화혈색소, 5.2, %, 2026-07-28, 1), (3, 비타민 D, 42, ng/mL, 2026-07-28, 1). `sourceTextSha256 = sha256("label|value|unit|observedOn")`. Ordinals 2 and 3: values moved off clinical cutoffs after safety review.
- Visit-preparation questions, verbatim: "이 값은 어떤 검사에서 나온 건가요?", "지난 결과와 비교해 설명해 주실 수 있나요?", "다시 확인이 필요하다면 언제가 좋을까요?". Note, verbatim: "이 목록은 질문을 준비하기 위한 것이에요. 값의 의미나 건강 상태를 판단하지 않아요."
- `release/readiness.json` gate statuses do not change in this plan.
- Implementers do not commit; the controller commits per task after review. Implementers run the gates named in their task and report exact output.

---

## File map

| Area | Files |
|---|---|
| Backend | Create `apps/core-api/src/main/resources/db/migration/V6__multi_candidate_review.sql`, `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/SyntheticCandidateFixture.kt`. Modify `FoundationRepository.kt`, `DocumentWorkerBoundary.kt`, `FoundationLifecycleService.kt`, `FoundationLifecycleController.kt`, `FoundationLifecyclePostgresIntegrationTest.kt`. Create `SyntheticCandidateFixtureTest.kt`. |
| Frontend | Modify `apps/web/lib/foundation/client.ts`, `components/integrated/IntegratedHealthExperience.tsx`, `components/integrated/IntegratedRecords.tsx`, `app/globals.css`, `tests/korean-ux-copy.test.ts`, `e2e/foundation-lifecycle.spec.ts`. Create `components/integrated/CandidateReview.tsx`, `components/integrated/VisitPreparation.tsx`, `app/prepare/page.tsx`, `tests/candidate-review.test.tsx`, `tests/integrated-review-loop.test.tsx`, `tests/visit-preparation.test.tsx`, `tests/integrated-records-grouping.test.tsx`. |
| Design | Create `docs/design/2026-09-02-design-direction.md`, `components/integrated/IntegratedShell.tsx`, `stories/CandidateReview.stories.tsx`, `stories/VisitPreparation.stories.tsx`. Modify integrated components to use the shell, `globals.css` print and polish rules. |
| Agent OS | Create `AGENTS.md`, `.claude/skills/{gc-sanity-check,gc-safe-change,gc-korean-copy,gc-readiness-evidence,gc-synthetic-fixture}/SKILL.md`, `.claude/agents/{gc-backend-engineer,gc-frontend-engineer,gc-design-reviewer,gc-safety-reviewer,gc-evidence-auditor}.md`. Modify `CLAUDE.md`. |
| Docs | Create `docs/reviews/2026-09-02-project-review.md`, `docs/roadmap/2026-09-02-roadmap.md`. Modify `PROJECT_GUIDE.md`, `README.md`, `docs/superpowers/plans/README.md`, `docs/product/intended-use-matrix.md`. |

---

### Task 1: Backend multi-candidate extraction and completion rule

**Files:**
- Create: `apps/core-api/src/main/resources/db/migration/V6__multi_candidate_review.sql`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/SyntheticCandidateFixture.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/SyntheticCandidateFixtureTest.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt` (`markExtractionCompleted` ~L834, `findCandidateForDocument` ~L966, `excludeCandidate` ~L1018, `createRecordFromCandidate` ~L1047, `candidateMapper`, `FoundationCandidateRow`)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/DocumentWorkerBoundary.kt` (`completeExtraction` ~L284)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt` (`CandidateReceipt` ~L55-70, `getCandidateForDocument` ~L321, add `listCandidatesForDocument`, `candidateReceipt` ~L597)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt` (add `GET /documents/{documentId}/candidates` next to the singular route ~L230)
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Produces `SyntheticCandidateFixture.candidatesFor(sourceSha256: String): List<SyntheticCandidate>` where `data class SyntheticCandidate(val ordinal: Int, val label: String, val value: String, val unit: String, val observedOn: LocalDate, val evidencePage: Int) { val sourceTextSha256: String }`.
- Produces `CandidateReceipt` with two new fields `ordinal: Int` and `totalCandidates: Int` (both positive), serialised as JSON numbers.
- Produces `GET /api/foundation/documents/{documentId}/candidates` → `200 [CandidateReceipt...]` ordered by ordinal, all statuses; `404 candidate_not_ready` when the document has no candidates; owner and active-consent checks identical to the singular route.
- Keeps `GET /api/foundation/documents/{documentId}/candidate` → lowest-ordinal PENDING candidate, else lowest-ordinal candidate.

- [ ] **Step 1: Migration**

```sql
-- V6__multi_candidate_review.sql
ALTER TABLE gc_candidate ADD COLUMN ordinal INTEGER NOT NULL DEFAULT 1;
ALTER TABLE gc_candidate ADD CONSTRAINT gc_candidate_ordinal CHECK (ordinal > 0);
CREATE UNIQUE INDEX gc_candidate_document_ordinal_idx ON gc_candidate(document_id, ordinal);
```

- [ ] **Step 2: Failing unit test for the fixture**

```kotlin
class SyntheticCandidateFixtureTest {
    @Test
    fun `every approved digest yields the ordered three-candidate set`() {
        val set = SyntheticCandidateFixture.candidatesFor("a".repeat(64))
        assertThat(set.map { it.ordinal }).containsExactly(1, 2, 3)
        assertThat(set.map { it.label }).containsExactly("총콜레스테롤", "당화혈색소", "비타민 D")
        assertThat(set[0].sourceTextSha256).isEqualTo(FoundationHashing.sha256("총콜레스테롤|188|mg/dL|2026-07-28"))
        assertThat(set.all { it.observedOn == LocalDate.of(2026, 7, 28) && it.evidencePage == 1 }).isTrue()
    }
}
```

Run: `.\gradlew.bat :apps:core-api:test --tests "*SyntheticCandidateFixtureTest*" --no-daemon` → FAIL (unresolved reference).

- [ ] **Step 3: Fixture**

```kotlin
package kr.co.genomecompanion.foundation

import java.time.LocalDate

data class SyntheticCandidate(
    val ordinal: Int,
    val label: String,
    val value: String,
    val unit: String,
    val observedOn: LocalDate,
    val evidencePage: Int,
) {
    val sourceTextSha256: String get() = FoundationHashing.sha256("$label|$value|$unit|$observedOn")
}

/** Deterministic synthetic candidate set. Nothing here reads document bytes. */
object SyntheticCandidateFixture {
    private val observed = LocalDate.of(2026, 7, 28)
    private val set = listOf(
        SyntheticCandidate(1, "총콜레스테롤", "188", "mg/dL", observed, 1),
        SyntheticCandidate(2, "당화혈색소", "5.2", "%", observed, 1),
        SyntheticCandidate(3, "비타민 D", "42", "ng/mL", observed, 1),
    )

    fun candidatesFor(sourceSha256: String): List<SyntheticCandidate> {
        require(sourceSha256.matches(Regex("^[0-9a-f]{64}$"))) { "approved source digest required" }
        return set
    }
}
```

Run the same test → PASS.

- [ ] **Step 4: Repository changes**

`FoundationCandidateRow` gains `ordinal: Int` and `totalCandidates: Int`. `candidateMapper` reads `c.ordinal` and a correlated `(SELECT COUNT(*) FROM gc_candidate t WHERE t.document_id = c.document_id) AS total_candidates`; add both columns to every candidate SELECT.

`markExtractionCompleted(workerJob, extractionJobId, previewId, previewObjectKey, previewSha256, workerImageDigest, generatorVersion, now, candidates: List<SyntheticCandidate>)` — drop the `candidateId` and `sourceTextSha256` parameters; insert one `gc_candidate` row per element with `UUID.randomUUID()`, `ordinal`, label, value, unit, observed_on, evidence_page, source_text_sha256.

`findCandidateForDocument` ordering: `ORDER BY CASE WHEN c.status = 'PENDING' THEN 0 ELSE 1 END, c.ordinal LIMIT 1`.

New `listCandidatesForDocument(subjectId, documentId): List<FoundationCandidateRow>` with `ORDER BY c.ordinal`.

Completion guard in both `excludeCandidate` and `createRecordFromCandidate` (replace the two existing `UPDATE gc_document ... SET status = 'COMPLETED'` statements):

```sql
UPDATE gc_document d SET status = 'COMPLETED', completed_at = ?, state_version = state_version + 1, updated_at = ?
WHERE d.document_id = ? AND d.subject_id = ? AND d.status = 'REVIEW_REQUIRED'
  AND NOT EXISTS (SELECT 1 FROM gc_candidate c WHERE c.document_id = d.document_id AND c.status = 'PENDING')
```

- [ ] **Step 5: Boundary, service, controller**

`DocumentWorkerBoundary.completeExtraction`: replace the hard-coded `sourceTextSha256` with `SyntheticCandidateFixture.candidatesFor(job.sourceSha256)` passed to `markExtractionCompleted`; keep the `SYNTHETIC_CANDIDATE_CREATED` audit event (one per document is fine).

`CandidateReceipt`: add `val ordinal: Int` and `val totalCandidates: Int`; populate in `candidateReceipt(...)`.

Service: `fun listCandidatesForDocument(principal, documentId): List<CandidateReceipt>` with the same `requireDocument` + `requireActiveConsent` sequence as `getCandidateForDocument`; throw `FoundationNotFoundException("candidate_not_ready")` for an empty list.

Controller:

```kotlin
@GetMapping("/documents/{documentId}/candidates")
fun listCandidatesForDocument(@PathVariable documentId: UUID, request: HttpServletRequest): ResponseEntity<List<CandidateReceipt>> =
    ResponseEntity.ok().cacheControlNoStore().body(service.listCandidatesForDocument(request.foundationPrincipal(), documentId))
```

- [ ] **Step 6: Integration test updates** (`FoundationLifecyclePostgresIntegrationTest`)

Update existing assertions: `count("gc_candidate")` after one extraction is `3`; the concurrent duplicate-delivery race still yields exactly one `COMPLETED` job and exactly `3` candidates. Add cases:

- after confirming ordinal 1 the document status is still `REVIEW_REQUIRED`; `GET .../candidate` now returns ordinal 2; after excluding ordinal 2 and confirming ordinal 3 the status is `COMPLETED` and `/records` has two entries;
- `GET .../candidates` returns three items ordered 1..3 with `totalCandidates == 3`, and returns `404 candidate_not_found`/`403` for a different subject exactly as the singular route does;
- a second confirmation attempt on an already-confirmed candidate returns the existing record (idempotent path) and does not change document status.

The helper `createCandidate` (~L548) must keep working; it can return the first candidate id.

- [ ] **Step 7: Run gates**

```powershell
.\gradlew.bat test --no-daemon
```
Expected locally: BUILD SUCCESSFUL (PostgreSQL-backed classes skip without Docker/`GC_TEST_POSTGRES_URL`; state this in the report). CI runs them.

---

### Task 2: Frontend review loop, grouped records, visit preparation

**Files:**
- Modify: `apps/web/lib/foundation/client.ts` (`candidateSchema` ~L72-86; add `getCandidatesForDocument`)
- Create: `apps/web/components/integrated/CandidateReview.tsx`
- Modify: `apps/web/components/integrated/IntegratedHealthExperience.tsx`
- Modify: `apps/web/components/integrated/IntegratedRecords.tsx`
- Create: `apps/web/components/integrated/VisitPreparation.tsx`, `apps/web/app/prepare/page.tsx`
- Modify: `apps/web/app/globals.css` (review progress, grouping, prepare, `@media print`)
- Modify: `apps/web/tests/korean-ux-copy.test.ts` (add the four integrated components and `VisitPreparation` to `userFacingFiles`; assert the note text)
- Create tests listed in the file map. Modify `apps/web/e2e/foundation-lifecycle.spec.ts`.

**Interfaces:**
- Consumes Task 1's `CandidateReceipt` (`ordinal`, `totalCandidates`) and `GET /api/foundation/documents/{id}/candidates`.
- Produces `CandidateReview` props: `{ candidate: FoundationCandidate; previewUrl?: string; busy: boolean; errorMessage: string; onConfirm(value: string): void; onExclude(): void; onBack(): void; onClose(): void }`. Progress is rendered from `candidate.ordinal` / `candidate.totalCandidates` as `"{ordinal} / {totalCandidates}"` inside an element with `aria-label="검토 진행"`.
- Produces `VisitPreparation` props: `{ records: FoundationRecord[]; loading: boolean; errorMessage: string; onPrint(): void }` and the exported constant `visitQuestions: readonly string[]` (the three verbatim questions).

- [ ] **Step 1: Client** — `candidateSchema` adds `ordinal: z.number().int().positive(), totalCandidates: z.number().int().positive()`; `getCandidatesForDocument(documentId)` performs `GET /api/foundation/documents/${documentId}/candidates` through the same `request` helper and validates with `z.array(candidateSchema)`. Update `tests/foundation-client.test.ts` MSW fixtures to include both fields (existing candidate fixtures must add `ordinal: 1, totalCandidates: 1`).

- [ ] **Step 2: `CandidateReview`** — extract the current review JSX from `IntegratedHealthExperience` (the `view === "review"` branch) into a presentational component. Copy stays the same except the eyebrow becomes `3. 출처부터 확인 · {ordinal} / {totalCandidates}` and the correction input keeps `pattern="[0-9]{1,4}([.][0-9]{1,2})?"`. Test (`tests/candidate-review.test.tsx`): renders progress `2 / 3`, calls `onConfirm("188")` on "원문과 같아요", calls `onExclude` on "이 항목 빼기", and passes axe.

- [ ] **Step 3: Review loop** — in `IntegratedHealthExperience` replace the single `candidate` state with `candidates: FoundationCandidate[]`; derive `activeCandidate = candidates.find(c => c.status === "PENDING")`. When the document reaches `REVIEW_REQUIRED` (poll or restore) load the list. After `confirmCandidate`/`excludeCandidate` mark the item in local state, then: if another PENDING candidate exists stay in `view === "review"`; else `setView("complete")`. The completion screen shows `저장 {saved}개 · 제외 {excluded}개` and links `/records` and `/prepare`. Test (`tests/integrated-review-loop.test.tsx`, MSW): a document with three candidates walks confirm → correct → exclude and reaches the completion view with `저장 2개 · 제외 1개`; reload with ordinal 1 already CONFIRMED starts at ordinal 2.

- [ ] **Step 4: Records grouping** — in `IntegratedRecords` group current records by `observedOn` (newest first) then by `documentSha256`; each group is a `<section aria-labelledby>` with heading `{formatKoreanDate(observedOn)} · 결과지 {shortDigest}` and the per-record list inside. Keep `data-testid="durable-record"` on each record item and the existing correction form. Test (`tests/integrated-records-grouping.test.tsx`): three records across two dates render two groups in newest-first order.

- [ ] **Step 5: Visit preparation** — `VisitPreparation` renders a heading `다음 진료에서 물어볼 것`, the verbatim note, one `<article>` per record with label, value + unit, `formatKoreanDate(observedOn)`, `{evidencePage}쪽`, short digest, decision text, and the three questions as a `<ul>`. Empty state: `아직 확인한 기록이 없어요` with a link to `/`. `onPrint` button label `인쇄하기`. `app/prepare/page.tsx` mirrors `records/page.tsx`: integrated → a client wrapper that loads `client.getRecords()` and calls `window.print`; otherwise a short concept notice `아직 서버 기록과 연결되지 않은 화면이에요`. Test (`tests/visit-preparation.test.tsx`): renders two records with three questions each, the note, empty state, axe passes.

- [ ] **Step 6: Copy guard and print CSS** — add the new components to `userFacingFiles`; add `@media print { .gc-health-home__appbar, .gc-prepare__actions { display: none } }` and basic layout for `.gc-prepare`, `.gc-review-progress`, `.gc-records-group`.

- [ ] **Step 7: Playwright** — in `foundation-lifecycle.spec.ts` first test: after the review heading appears, expect `1 / 3`; correct to `190`; expect `2 / 3` and `5.2`; click `원문과 같아요`; expect `3 / 3` and `42`; click `이 항목 빼기`; expect heading `건강 기록에 저장했어요` is replaced by the completion heading (use `저장 2개 · 제외 1개`); navigate to `/records`, expect two `durable-record` items; navigate to `/prepare`, expect two articles and the note. Keep the revoke/delete flow unchanged.

- [ ] **Step 8: Gates**

```powershell
pnpm web:test
pnpm --dir apps/web build
pnpm auth-security:gate
```
Expected: all pass. Report exact test counts.

---

### Task 3: Design direction and polish

**Files:**
- Create: `docs/design/2026-09-02-design-direction.md`
- Create: `apps/web/components/integrated/IntegratedShell.tsx`
- Create: `apps/web/stories/CandidateReview.stories.tsx`, `apps/web/stories/VisitPreparation.stories.tsx`
- Modify: integrated components to use `IntegratedShell`; `apps/web/app/globals.css`

**Interfaces:**
- `IntegratedShell` props: `{ current: "home" | "records" | "prepare" | "data-control"; status?: string; children: ReactNode }`; renders the brand link `앎`, nav `홈 / 기록 / 진료 준비 / 데이터 관리` with `aria-current="page"` on `current`, and an optional status pill.

- [ ] **Step 1: Direction doc** — record the token system, type, spacing, status colours, where the integrated screens duplicate header markup, contrast/target-size findings, and the component inventory. Under 600 words.
- [ ] **Step 2: Shell** — replace the duplicated `<header>` blocks in `IntegratedHealthExperience` home view, `IntegratedRecords`, `IntegratedDataControl`, and the prepare wrapper. Existing tests that query the nav (`getByRole("navigation", { name: "주요 메뉴" })`) must keep passing.
- [ ] **Step 3: Polish** — review progress pill, completion summary, records group header, prepare article and print layout; 44px targets; visible focus rings from `--gc-color-focus-ring`. No new dependencies.
- [ ] **Step 4: Stories** — one story per state (pending, correcting, last-of-three; records/empty for prepare).
- [ ] **Step 5: Gates** — `pnpm web:test`, `pnpm --dir apps/web build`, `pnpm --dir apps/web build-storybook` (report if Storybook build is too slow locally and why).

---

### Task 4: Agent operating system

**Files:** `AGENTS.md`, `CLAUDE.md`, `.claude/skills/*/SKILL.md`, `.claude/agents/*.md`.

- [ ] **Step 1:** `AGENTS.md` under 400 words: read order, boundaries (section 6 of the guide, condensed), change protocol (section 8), local gates by area, founder-only inputs, skill index.
- [ ] **Step 2:** Skills with frontmatter `name` and `description` (description starts with "Use when"), each under 500 words, each pointing at the exact repository commands and files.
- [ ] **Step 3:** Agent definitions with frontmatter `name`, `description`, `tools`, `model`; body states file ownership, required skills, gates to run, report contract.
- [ ] **Step 4:** Baseline-versus-skill check for `gc-safe-change` and `gc-korean-copy` with a fresh subagent each; record the result in the review document.

---

### Task 5: Review, roadmap, and guide updates

**Files:** `docs/reviews/2026-09-02-project-review.md`, `docs/roadmap/2026-09-02-roadmap.md`, `PROJECT_GUIDE.md`, `README.md`, `docs/superpowers/plans/README.md`, `docs/product/intended-use-matrix.md`.

- [ ] Write the review (strengths, findings ranked, evidence links), the roadmap (tracks A–D with exit evidence), and thread links through the guide, README, plan index, and intended-use matrix (new row: visit-preparation questions, boundary "neutral fixed questions, no interpretation", status VERIFIED SYNTHETIC ONLY once tests pass).

---

### Task 6: Integration, review, CI

- [ ] Run all local gates with the pinned toolchain; commit per task; push `codex/mvp-multi-candidate-and-agent-os`; open the PR; wait for `genome-companion-ci`; fix failures with a fix subagent; final whole-branch review; merge only on green.
