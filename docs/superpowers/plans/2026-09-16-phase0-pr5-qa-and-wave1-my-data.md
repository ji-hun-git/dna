# Phase 0 (PR #5 QA) + Wave 1 (HealthEvent read-model + Living Cell 캔버스) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run PR #5 for real and leave a QA review, then add a `health-events` read-model and a `/my-data` living-cell timeline whose every cell is one confirmed CURRENT record, inside the current safety boundary.

**Architecture:** Spring stays the authority: a pure Kotlin projection turns existing `FoundationRecordRow`s into `HealthEvent`s and one new GET endpoint exposes them. Next.js adds a `/my-data` route with a pure-SVG cell canvas, exact search, an evidence drawer that reuses `SourcePreview`, and a table alternative. Navigation collapses to 나의 데이터 / 데이터 관리.

**Tech Stack:** Kotlin 21 / Spring Boot / JdbcTemplate / JUnit 5 + AssertJ; Next 16.3.3 / React / zod / vitest + Testing Library + msw + jest-axe / Playwright; pnpm 11.20.0, Node 24.20.0.

Spec: `docs/superpowers/specs/2026-09-16-phi-qa-and-gap-plan-design.md`

## Global Constraints

- Toolchain: Node `24.20.0`, pnpm `11.20.0`, Java `21`. Local pinned toolchain lives in `~/.gc-node24`; run `export PATH="$HOME/.gc-node24:$PATH"` in every Git Bash shell first.
- Local PostgreSQL 16 is the embedded one started by `node start-pg.mjs` in the scratchpad `pg` folder (trust auth, port 5432, databases `gc_synthetic_demo` and `gc_test`). It holds synthetic rows only.
- Never commit real PDFs, identifiers, credentials, or PHI. Only the generated synthetic fixtures.
- No diagnosis, normal/abnormal, reference range, trend arrow, risk, treatment, medication, or model inference anywhere in code or copy (PROJECT_GUIDE §6). A cell shows `concept`, `value`, `unit`, `observedOn`, source. Nothing else.
- Next.js gains no API route, token, or authorization rule. It only calls `/api/foundation/*` through the existing rewrite.
- Copy rules: Korean user-facing text; never render raw server enums (`CURRENT`, `CONFIRMED`, `CORRECTED`); forbidden terms in `apps/web/tests/korean-ux-copy.test.ts` apply to every new component; no "안전하게 저장" style claims.
- Keep the existing monochrome Pretendard / IBM Plex Mono light theme and `--gc-*` tokens. The PHI near-black theme is a separate design decision, not part of this wave.
- Accessibility: every cell is keyboard reachable with an accessible name; state is never colour-only; `prefers-reduced-motion` disables movement; the same data is available as a table.
- Branching: Phase 0 fixes go on `codex/unified-health-product` as separate commits. Wave 1 goes on `codex/wave3-my-data-living-cells` branched from `codex/unified-health-product`. Never push to `main`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Gates before any PR: `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `pnpm web:test`, `pnpm --dir apps/web build`, `pnpm auth-security:gate`, `./gradlew.bat test --no-daemon`.

---

# Phase 0 — PR #5 QA review

### Task 0.1: Run every automated gate on the PR #5 head

**Files:**
- Create: `docs/reviews/2026-09-16-pr5-qa-review.md` (started here, finished in Task 0.3)

- [ ] **Step 1: Check out the PR branch and confirm the head**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux
git checkout codex/unified-health-product
git log -1 --format='%H %s'
```
Expected: `4157a4eef798b9222bbc5904fdd38e9227cb1aea Pin Tomcat 10.1.59 ...` (the head cited in the PR body).

- [ ] **Step 2: Run the web and policy gates**

```bash
export PATH="$HOME/.gc-node24:$PATH"
pnpm security:runtime-policy
pnpm release:readiness:validate
pnpm web:test 2>&1 | tail -15
pnpm --dir apps/web build 2>&1 | tail -8
pnpm auth-security:gate 2>&1 | tail -5
```
Expected: `runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3`; readiness validate exit 0; vitest `Test Files 37 passed`, `Tests 156 passed`; Next build finishes without type errors; auth gate PASS. Record the exact counts.

- [ ] **Step 3: Run the JVM suite with the embedded PostgreSQL so the Docker-skipped classes run**

```bash
export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'
./gradlew.bat test --no-daemon 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL`. Then count results:
```bash
find apps packages -path '*/build/test-results/test/*.xml' | xargs grep -ho 'tests="[0-9]*" skipped="[0-9]*" failures="[0-9]*" errors="[0-9]*"' | awk -F'"' '{t+=$2;s+=$4;f+=$6;e+=$8} END {print "tests",t,"skipped",s,"failures",f,"errors",e}'
```
Expected: failures 0, errors 0, skipped count lower than the PR body's 3 (the Postgres classes now run). Record it.

- [ ] **Step 4: Start the review document with the gate table**

Create `docs/reviews/2026-09-16-pr5-qa-review.md`:
```markdown
# PR #5 QA review — 2026-09-16

Reviewer: Claude (QA/FDE session), on request of the founder. Head reviewed: `4157a4eef798b9222bbc5904fdd38e9227cb1aea`.
Scope: local execution on Windows 11 with the pinned toolchain and an embedded synthetic PostgreSQL 16. Not a hosted-system, clinical, or regulatory claim.

## 1. Automated gates (local)

| Gate | Result |
|---|---|
| `pnpm security:runtime-policy` | (fill from Step 2) |
| `pnpm release:readiness:validate` | (fill) |
| `pnpm web:test` | (fill: files / tests) |
| `pnpm --dir apps/web build` | (fill) |
| `pnpm auth-security:gate` | (fill) |
| `./gradlew.bat test` with `GC_TEST_POSTGRES_URL` | (fill: tests / skipped / failures) |

## 2. Browser scenarios
(Task 0.2)

## 3. Findings
(Task 0.2)

## 4. Accessibility
(Task 0.2)

## 5. Korean copy against the claim register
(Task 0.2)

## 6. Code review notes
(Task 0.2)

## 7. Merge recommendation
(Task 0.3)
```
Fill the table cells in this task with the real outputs before moving on.

- [ ] **Step 5: Commit the partial review on the PR branch**

```bash
git add docs/reviews/2026-09-16-pr5-qa-review.md
git commit -m "docs: start PR #5 QA review with local gate results

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 0.2: Drive the real synthetic product in the browser

**Files:**
- Modify: `docs/reviews/2026-09-16-pr5-qa-review.md` (sections 2–6)
- Create: `docs/reviews/2026-09-16-pr5-qa-screenshots/*.png` (only synthetic screens)

- [ ] **Step 1: Start the runner**

In PowerShell (the runner is documented for PowerShell):
```powershell
$env:PATH = "$HOME\.gc-node24;$env:PATH"
$env:GC_LOCAL_SYNTHETIC_ONLY = 'yes'
$env:GC_LOCAL_POSTGRES_URL = 'jdbc:postgresql://127.0.0.1:5432/gc_synthetic_demo'
$env:GC_LOCAL_QUARANTINE_ROOT = 'C:/gc-synthetic-demo/quarantine'
pnpm dev:synthetic
```
Expected: the runner prints ready and `http://127.0.0.1:3138` responds. Ports 8087/8091/3138 must be free.

- [ ] **Step 2: Scenario A — first document, full review**

In the built-in browser at `http://127.0.0.1:3138`, using `read_page` after each step:
1. 체험 시작 → expect the shell nav 홈/기록/진료 준비/데이터 and a status pill 예시 데이터.
2. 결과지 추가 → grant processing consent → 7월 예시 결과지로 시작.
3. Wait for review; expect three candidates (총콜레스테롤 188 mg/dL, 당화혈색소 5.2 %, 비타민 D 42 ng/mL) and an approved source PNG.
4. 확인 the first, 값 수정 the second to `5.3` with a reason, 제외 the third.
5. 기록: expect two current records, the corrected one showing both original and current value; 진료 준비: expect at most three questions, each linking to a record.
Note every deviation as a finding with exact reproduction steps.

- [ ] **Step 3: Scenario B — second document, comparison, persistence**

1. 결과지 추가 → 1월 예시 결과지 → confirm all three.
2. 기록: expect the dated side-by-side comparison for 총콜레스테롤 and 비타민 D; 당화혈색소 must still compare (same unit `%`).
3. Reload the page: records persist. Open a source link from 진료 준비: it lands on the same records page and the record is present.

- [ ] **Step 4: Scenario C — revocation and deletion**

1. 데이터 → revoke document-extraction consent → expect the upload path to be blocked with Korean copy, records still readable.
2. 삭제 → expect the server response to be reported as completed, then `/records` shows the signed-out or empty state, and a fresh 체험 시작 creates a different owner (records empty).

- [ ] **Step 5: Accessibility pass on each screen**

For 홈, review, 기록, 진료 준비, 데이터:
- Keyboard only: Tab order reaches every control; focus ring visible; Enter/Space activate; no trap.
- `resize_window` to 320×720, 390×844, 768×1024, 1280×720, 1920×1080; assert no horizontal scroll via `javascript_tool`: `document.documentElement.scrollWidth <= window.innerWidth`.
- `resize_window` with `colorScheme: "dark"` once to confirm nothing becomes unreadable (the app is light-only; note if it ignores the scheme, that is acceptable).
- Check that meaning is never colour-only: corrected vs confirmed, consent granted vs revoked.
- Take one screenshot per screen at 390×844 and 1280×720 into `docs/reviews/2026-09-16-pr5-qa-screenshots/`.

- [ ] **Step 6: Korean copy against the claim register**

Compare visible copy with the register in `docs/revision/ASTRA_PRODUCT_REBUILD.md` §25: "사용자 확인", "예시 데이터", "삭제 완료", "연결", "출처", "진료 준비". Flag any sentence that implies extraction accuracy, safety, long-term storage, or health judgement. Flag any raw enum on screen.

- [ ] **Step 7: Code review (correctness only) of the PR diff**

```bash
git diff origin/main..codex/unified-health-product -- apps/core-api apps/web/lib apps/web/components | wc -l
```
Read the Kotlin diff in `FoundationLifecycleService.kt`, `FoundationLifecycleController.kt`, `FoundationSecurity.kt`, and the web diff in `lib/foundation/client.ts`, `components/integrated/*`. Look for: owner checks on every new read, idempotency on every new write, budget counters that survive restart, error paths that could leak a raw enum or stack, and tests that assert the behaviour rather than the mock. Write each observation with file:line.

- [ ] **Step 8: Write sections 2–6 of the review document**

Each finding uses this shape:
```markdown
### F-n. <title>  — severity: blocker | major | minor | note — boundary: yes/no
Repro: <numbered steps>
Observed: <what happened>
Expected: <what the spec/copy register says>
Suggested fix: <one sentence or "none, informational">
```
Commit:
```bash
git add docs/reviews/2026-09-16-pr5-qa-review.md docs/reviews/2026-09-16-pr5-qa-screenshots
git commit -m "docs: PR #5 browser scenarios, accessibility and copy findings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 0.3: Fix the small findings, write the recommendation, post to the PR

**Files:**
- Modify: files named by minor findings only
- Modify: `docs/reviews/2026-09-16-pr5-qa-review.md` §7

- [ ] **Step 1: For each `minor` finding with a one-line fix, write the failing test first, fix, rerun**

Use the existing test file nearest the component (for example `apps/web/tests/integrated-records-grouping.test.tsx` for records copy). Run `pnpm web:test` after each fix. One commit per finding: `fix(web): <finding id> <title>`.
Findings rated `major`/`blocker` are not fixed here; they are listed for the founder.

- [ ] **Step 2: Write §7 merge recommendation**

State one of: `merge as is`, `merge after listed fixes`, `do not merge`, with the reasons tied to finding IDs. State explicitly: the PR author cannot approve their own PR under the current protection rule, so merge needs a second reviewer account or a founder decision on the rule.

- [ ] **Step 3: Push and comment**

```bash
git push -u origin codex/unified-health-product
gh pr comment 5 --body-file docs/reviews/2026-09-16-pr5-qa-review.md
```
Expected: comment URL printed. CI reruns on the new head; wait for `genome-companion-ci` and record the run ID in §1.

---

# Wave 1 — HealthEvent read-model + /my-data living cells

Branch:
```bash
git checkout codex/unified-health-product
git checkout -b codex/wave3-my-data-living-cells
```

## File map

Backend (`apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/`):
- Create `HealthEventProjection.kt` — DTOs + pure projection from `FoundationRecordRow` (Task 1).
- Modify `FoundationRepository.kt` — `listDocumentIdsWithPreview(subjectId)` (Task 2).
- Modify `FoundationLifecycleService.kt` — `listHealthEvents(principal)` (Task 2).
- Modify `FoundationLifecycleController.kt` — `GET /health-events` (Task 2).
- Test `src/test/kotlin/kr/co/genomecompanion/foundation/HealthEventProjectionTest.kt` (Task 1), `FoundationLifecyclePostgresIntegrationTest.kt` (Task 2).

Web (`apps/web/`):
- Modify `lib/foundation/client.ts` — `healthEventSchema`, `HealthEvent`, `getHealthEvents` (Task 3).
- Create `lib/my-data/cell-layout.ts` — time scale, lane packing, state priority (Task 4).
- Create `lib/my-data/search-events.ts` — exact search (Task 5).
- Create `components/my-data/LivingCellCanvas.tsx`, `components/my-data/CellTooltip.tsx` (Task 6).
- Create `components/my-data/EvidenceDrawer.tsx` (Task 7).
- Create `components/my-data/HealthEventTable.tsx`, `components/my-data/MyData.tsx`, `app/my-data/page.tsx`, `components/my-data/MyData.module.css` (Task 8).
- Modify `components/integrated/IntegratedShell.tsx`, `IntegratedRecords.tsx`, `VisitPreparation.tsx`, `IntegratedDataControl.tsx`, `IntegratedHealthExperience.tsx`, `tests/integrated-shell.test.tsx`, `e2e/foundation-lifecycle.spec.ts`, `tests/korean-ux-copy.test.ts` (Task 9).
- Modify `e2e/foundation-lifecycle.spec.ts` (Task 10).
- Create `docs/status/2026-09-16/wave1-my-data.md` (Task 11).

---

### Task 1: `HealthEventProjection` (pure Kotlin)

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/HealthEventProjection.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/HealthEventProjectionTest.kt`

**Interfaces:**
- Consumes: `FoundationRecordRow` (existing, `FoundationRepository.kt:104`).
- Produces: `data class HealthEventSource(documentId: UUID, page: Int, documentSha256: String, sourceTextSha256: String, previewAvailable: Boolean)`; `data class HealthEvent(eventId: UUID, recordId: UUID, domain: String, concept: String, value: String, unit: String, observedOn: String, verification: String, corrected: Boolean, confirmedAt: Instant, source: HealthEventSource)`; `object HealthEventProjection { fun project(records: List<FoundationRecordRow>, previewDocumentIds: Set<UUID>): List<HealthEvent> }`.

- [ ] **Step 1: Write the failing test**

```kotlin
package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class HealthEventProjectionTest {
    private val docWithPreview = UUID.fromString("11111111-1111-4111-8111-111111111111")
    private val docWithoutPreview = UUID.fromString("22222222-2222-4222-8222-222222222222")

    private fun row(
        label: String,
        value: String,
        original: String = value,
        observedOn: LocalDate,
        status: String = "CURRENT",
        documentId: UUID = docWithPreview,
        confirmedAt: Instant = Instant.parse("2026-07-28T09:10:00Z"),
    ) = FoundationRecordRow(
        recordId = UUID.randomUUID(),
        recordVersionId = UUID.randomUUID(),
        supersedesVersionId = null,
        candidateId = UUID.randomUUID(),
        documentId = documentId,
        subjectId = "synthetic-jason",
        status = status,
        label = label,
        currentValue = value,
        originalValue = original,
        unit = "mg/dL",
        observedOn = observedOn,
        confirmedAt = confirmedAt,
        correctionReason = if (original == value) null else "원문 재확인",
        evidencePage = 1,
        sourceTextSha256 = "b".repeat(64),
        documentSha256 = "a".repeat(64),
    )

    @Test
    fun projectsOnlyCurrentVersionsAsLabEventsOrderedByDateThenConcept() {
        val later = row("총콜레스테롤", "194", observedOn = LocalDate.of(2026, 7, 28))
        val earlier = row("비타민 D", "45", observedOn = LocalDate.of(2026, 1, 15))
        val superseded = row("총콜레스테롤", "188", observedOn = LocalDate.of(2026, 7, 28), status = "SUPERSEDED")

        val events = HealthEventProjection.project(listOf(later, superseded, earlier), setOf(docWithPreview))

        assertThat(events.map { it.concept }).containsExactly("비타민 D", "총콜레스테롤")
        assertThat(events.map { it.eventId }).containsExactly(earlier.recordVersionId, later.recordVersionId)
        assertThat(events.all { it.domain == "lab" }).isTrue()
        assertThat(events[0].observedOn).isEqualTo("2026-01-15")
    }

    @Test
    fun marksCorrectedValuesAndKeepsBothVerifiedWhenPreviewExists() {
        val corrected = row("당화혈색소", "5.3", original = "5.2", observedOn = LocalDate.of(2026, 7, 28))

        val event = HealthEventProjection.project(listOf(corrected), setOf(docWithPreview)).single()

        assertThat(event.corrected).isTrue()
        assertThat(event.verification).isEqualTo("verified")
        assertThat(event.value).isEqualTo("5.3")
        assertThat(event.source.previewAvailable).isTrue()
        assertThat(event.source.page).isEqualTo(1)
    }

    @Test
    fun marksUncertainWhenTheSourcePreviewIsMissing() {
        val orphan = row("비타민 D", "42", observedOn = LocalDate.of(2026, 7, 28), documentId = docWithoutPreview)

        val event = HealthEventProjection.project(listOf(orphan), setOf(docWithPreview)).single()

        assertThat(event.verification).isEqualTo("uncertain")
        assertThat(event.source.previewAvailable).isFalse()
    }

    @Test
    fun carriesNoInterpretationFields() {
        val fields = HealthEvent::class.java.declaredFields.map { it.name }
        assertThat(fields).doesNotContain("referenceRange", "trend", "direction", "flag", "normal", "abnormal", "risk")
    }
}
```

- [ ] **Step 2: Run it to see it fail**

```bash
./gradlew.bat :apps:core-api:test --tests 'kr.co.genomecompanion.foundation.HealthEventProjectionTest' --no-daemon 2>&1 | tail -15
```
Expected: compilation error `Unresolved reference: HealthEventProjection`.

- [ ] **Step 3: Implement**

```kotlin
package kr.co.genomecompanion.foundation

import java.time.Instant
import java.util.UUID

/** Where one event came from. A digest and a page, never the document bytes. */
data class HealthEventSource(
    val documentId: UUID,
    val page: Int,
    val documentSha256: String,
    val sourceTextSha256: String,
    val previewAvailable: Boolean,
)

/**
 * One confirmed value as one event. This is a read-model over CURRENT record
 * versions: no new storage, no reference range, no direction, no judgement.
 */
data class HealthEvent(
    val eventId: UUID,
    val recordId: UUID,
    val domain: String,
    val concept: String,
    val value: String,
    val unit: String,
    val observedOn: String,
    val verification: String,
    val corrected: Boolean,
    val confirmedAt: Instant,
    val source: HealthEventSource,
)

object HealthEventProjection {
    const val DOMAIN_LAB = "lab"
    const val VERIFIED = "verified"
    const val UNCERTAIN = "uncertain"

    fun project(records: List<FoundationRecordRow>, previewDocumentIds: Set<UUID>): List<HealthEvent> =
        records
            .filter { it.status == "CURRENT" }
            .map { record ->
                val previewAvailable = record.documentId in previewDocumentIds
                HealthEvent(
                    eventId = record.recordVersionId,
                    recordId = record.recordId,
                    domain = DOMAIN_LAB,
                    concept = record.label,
                    value = record.currentValue,
                    unit = record.unit,
                    observedOn = record.observedOn.toString(),
                    verification = if (previewAvailable) VERIFIED else UNCERTAIN,
                    corrected = record.currentValue != record.originalValue,
                    confirmedAt = record.confirmedAt,
                    source = HealthEventSource(
                        documentId = record.documentId,
                        page = record.evidencePage,
                        documentSha256 = record.documentSha256,
                        sourceTextSha256 = record.sourceTextSha256,
                        previewAvailable = previewAvailable,
                    ),
                )
            }
            .sortedWith(compareBy<HealthEvent> { it.observedOn }.thenBy { it.concept }.thenBy { it.confirmedAt })
}
```

- [ ] **Step 4: Run the test**

Same command as Step 2. Expected: `BUILD SUCCESSFUL`, 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/HealthEventProjection.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/HealthEventProjectionTest.kt
git commit -m "feat(core): project CURRENT record versions as HealthEvents

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 2: `GET /api/foundation/health-events`

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt` (after `findPreviewArtifact`, ~line 1060)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt` (after `listRecords`, line 459)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt` (after `listRecords`, line 310)
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `HealthEventProjection.project`, `FoundationPrincipal`, `request.foundationPrincipal()` (existing extension).
- Produces: `FoundationRepository.listDocumentIdsWithPreview(subjectId: String): Set<UUID>`; `FoundationLifecycleService.listHealthEvents(principal): List<HealthEvent>`; HTTP `GET /api/foundation/health-events` → `200 [HealthEvent]`, `Cache-Control: no-store`, same auth as `/records`.

- [ ] **Step 1: Write the failing integration test**

Open `FoundationLifecyclePostgresIntegrationTest.kt`, find the existing test that confirms a candidate and then calls `GET /api/foundation/records` (search for `"/api/foundation/records"`). Add a sibling test following the same session/CSRF helper usage in that file:

```kotlin
@Test
fun healthEventsProjectCurrentRecordsWithSourceAndPreviewFlag() {
    val session = bootstrapSession()                       // same helper the records test uses
    val document = uploadDefaultSyntheticDocument(session) // same helper the records test uses
    val candidates = candidatesFor(session, document)
    confirm(session, candidates[0])
    exclude(session, candidates[2])

    val response = mockMvc.get("/api/foundation/health-events") { withSession(session) }
        .andExpect { status { isOk() } }
        .andExpect { header { string("Cache-Control", "no-store") } }
        .andReturn()

    val events = objectMapper.readTree(response.response.contentAsString)
    assertThat(events).hasSize(1)
    val event = events[0]
    assertThat(event["concept"].asText()).isEqualTo("총콜레스테롤")
    assertThat(event["value"].asText()).isEqualTo("188")
    assertThat(event["unit"].asText()).isEqualTo("mg/dL")
    assertThat(event["observedOn"].asText()).isEqualTo("2026-07-28")
    assertThat(event["domain"].asText()).isEqualTo("lab")
    assertThat(event["verification"].asText()).isEqualTo("verified")
    assertThat(event["corrected"].asBoolean()).isFalse()
    assertThat(event["source"]["previewAvailable"].asBoolean()).isTrue()
    assertThat(event["source"]["page"].asInt()).isEqualTo(1)
    assertThat(event.fieldNames().asSequence().toList()).doesNotContain("referenceRange", "trend")
}

@Test
fun healthEventsAreOwnerIsolated() {
    val owner = bootstrapSession()
    val document = uploadDefaultSyntheticDocument(owner)
    confirm(owner, candidatesFor(owner, document)[0])
    val other = bootstrapSession()

    mockMvc.get("/api/foundation/health-events") { withSession(other) }
        .andExpect { status { isOk() } }
        .andExpect { content { json("[]") } }
}

@Test
fun healthEventsRequireASession() {
    mockMvc.get("/api/foundation/health-events").andExpect { status { isUnauthorized() } }
}
```
Replace the helper names (`bootstrapSession`, `uploadDefaultSyntheticDocument`, `candidatesFor`, `confirm`, `exclude`, `withSession`) with the exact helper names already defined in that test class; do not invent new helpers.

- [ ] **Step 2: Run it to see it fail**

```bash
export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'
./gradlew.bat :apps:core-api:test --tests 'kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest' --no-daemon 2>&1 | tail -15
```
Expected: the three new tests fail with HTTP 404 (or 405) on `/api/foundation/health-events`.

- [ ] **Step 3: Repository query**

Add to `FoundationRepository` right after `findPreviewArtifact`:
```kotlin
    /** Documents of this owner whose approved preview is still bound to the stored digest. */
    fun listDocumentIdsWithPreview(subjectId: String): Set<UUID> =
        jdbc.query(
            """
            SELECT d.document_id
            FROM gc_document d
            JOIN gc_preview_artifact p ON p.document_id = d.document_id
            WHERE d.subject_id = ?
              AND d.status IN ('REVIEW_REQUIRED', 'COMPLETED')
              AND d.preview_object_key = p.object_key AND d.sha256 = p.source_sha256
            """.trimIndent(),
            RowMapper { result, _ -> result.getObject("document_id", UUID::class.java) },
            subjectId,
        ).toSet()
```

- [ ] **Step 4: Service and controller**

Service, after `listRecords`:
```kotlin
    @Transactional
    fun listHealthEvents(principal: FoundationPrincipal): List<HealthEvent> =
        HealthEventProjection.project(
            repository.listRecords(principal.subjectId),
            repository.listDocumentIdsWithPreview(principal.subjectId),
        )
```
Controller, after `listRecords`:
```kotlin
    @GetMapping("/health-events")
    fun listHealthEvents(request: HttpServletRequest): ResponseEntity<List<HealthEvent>> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.listHealthEvents(request.foundationPrincipal()))
```
If `FoundationSecurity.kt` keeps an explicit allowlist of GET paths under `/api/foundation`, add `/api/foundation/health-events` next to `/api/foundation/records` with the same rule (search for `"/api/foundation/records"` in that file).

- [ ] **Step 5: Run the integration test and the whole suite**

```bash
./gradlew.bat :apps:core-api:test --tests 'kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest' --no-daemon 2>&1 | tail -8
./gradlew.bat test --no-daemon 2>&1 | tail -5
```
Expected: `BUILD SUCCESSFUL`, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add apps/core-api
git commit -m "feat(core): expose owner-scoped health-events read-model

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 3: Web client `getHealthEvents`

**Files:**
- Modify: `apps/web/lib/foundation/client.ts` (schema block ends line 119; methods near line 366)
- Modify: `apps/web/tests/fixtures/foundation.ts` (append `syntheticHealthEvent`)
- Test: `apps/web/tests/foundation-client.test.ts`

**Interfaces:**
- Produces: `export type HealthEvent = z.infer<typeof healthEventSchema>` with fields exactly as Task 1; `client.getHealthEvents(): Promise<HealthEvent[]>`; fixture `syntheticHealthEvent(overrides?: Partial<HealthEvent>): HealthEvent`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/foundation-client.test.ts`, following the msw pattern already used in that file:
```ts
it("reads health events and rejects interpretation fields", async () => {
  server.use(http.get("/api/foundation/health-events", () => HttpResponse.json([syntheticHealthEvent()])));
  const client = createFoundationClient();
  const events = await client.getHealthEvents();
  expect(events).toHaveLength(1);
  expect(events[0].concept).toBe("총콜레스테롤");
  expect(events[0].source.previewAvailable).toBe(true);

  server.use(http.get("/api/foundation/health-events", () => HttpResponse.json([
    { ...syntheticHealthEvent(), referenceRange: { high: 130 } },
  ])));
  await expect(client.getHealthEvents()).rejects.toThrow();
});
```
And add to `tests/fixtures/foundation.ts`:
```ts
import type { HealthEvent } from "@/lib/foundation/client";

export function syntheticHealthEvent(overrides: Partial<HealthEvent> = {}): HealthEvent {
  return {
    eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50",
    recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c40",
    domain: "lab",
    concept: "총콜레스테롤",
    value: "188",
    unit: "mg/dL",
    observedOn: "2026-07-28",
    verification: "verified",
    corrected: false,
    confirmedAt: "2026-07-28T09:10:00Z",
    source: {
      documentId,
      page: 1,
      documentSha256,
      sourceTextSha256: "b".repeat(64),
      previewAvailable: true,
    },
    ...overrides,
  };
}
```

- [ ] **Step 2: Run to see it fail**

```bash
export PATH="$HOME/.gc-node24:$PATH"
pnpm --filter @gc/web test -- tests/foundation-client.test.ts 2>&1 | tail -12
```
Expected: TypeScript/runtime error `getHealthEvents is not a function`.

- [ ] **Step 3: Implement the schema and method**

In `client.ts` after `recordSchema`:
```ts
const healthEventSourceSchema = z.object({
  documentId: uuidSchema,
  page: z.number().int().positive(),
  documentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  sourceTextSha256: z.string().regex(/^[0-9a-f]{64}$/),
  previewAvailable: z.boolean(),
}).strict();

// A read-model over current records. `.strict()` is the boundary: a server
// that starts sending a reference range or a direction fails validation here.
const healthEventSchema = z.object({
  eventId: uuidSchema,
  recordId: uuidSchema,
  domain: z.enum(["lab"]),
  concept: z.string().min(1).max(80),
  value: z.string().min(1).max(64),
  unit: z.string().min(1).max(32),
  observedOn: z.string().date(),
  verification: z.enum(["verified", "uncertain"]),
  corrected: z.boolean(),
  confirmedAt: z.string().datetime({ offset: true }),
  source: healthEventSourceSchema,
}).strict();
```
Export the type next to the others: `export type HealthEvent = z.infer<typeof healthEventSchema>;`
Add the method next to `getRecords`:
```ts
    getHealthEvents: () => request("/api/foundation/health-events", z.array(healthEventSchema), { method: "GET" }),
```

- [ ] **Step 4: Run the test**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/foundation/client.ts apps/web/tests/fixtures/foundation.ts apps/web/tests/foundation-client.test.ts
git commit -m "feat(web): validate and fetch health events

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 4: Cell layout (time scale, lanes, state priority)

**Files:**
- Create: `apps/web/lib/my-data/cell-layout.ts`
- Test: `apps/web/tests/cell-layout.test.ts`

**Interfaces:**
- Produces:
```ts
export type CellState = "idle" | "new" | "query-related" | "selected";
export type TimeScale = { start: string; end: string; x(observedOn: string): number; ticks: Array<{ label: string; x: number }> };
export type CellLayout = { eventId: string; x: number; y: number; size: number; state: CellState; uncertain: boolean; corrected: boolean; ariaLabel: string };
export function buildTimeScale(dates: string[], width: number, padding: number): TimeScale;
export function layoutCells(events: HealthEvent[], options: { width: number; cellSize: number; gap: number; padding: number; selectedId?: string; matchedIds?: Set<string> | null; newIds?: Set<string> }): { cells: CellLayout[]; scale: TimeScale; height: number };
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildTimeScale, layoutCells } from "@/lib/my-data/cell-layout";
import { syntheticHealthEvent } from "./fixtures/foundation";

const jan = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51", observedOn: "2026-01-15", value: "194" });
const jul = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d52", observedOn: "2026-07-28" });
const julB = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d53", observedOn: "2026-07-28", concept: "당화혈색소", value: "5.2", unit: "%" });

describe("buildTimeScale", () => {
  it("maps the earliest date to the left padding and the latest to the right edge", () => {
    const scale = buildTimeScale(["2026-07-28", "2026-01-15"], 400, 20);
    expect(scale.start).toBe("2026-01-15");
    expect(scale.end).toBe("2026-07-28");
    expect(scale.x("2026-01-15")).toBe(20);
    expect(scale.x("2026-07-28")).toBe(380);
    expect(scale.ticks.map((tick) => tick.label)).toEqual(["2026. 1.", "2026. 7."]);
  });

  it("centres a single date and gives one tick", () => {
    const scale = buildTimeScale(["2026-07-28"], 400, 20);
    expect(scale.x("2026-07-28")).toBe(200);
    expect(scale.ticks).toHaveLength(1);
  });
});

describe("layoutCells", () => {
  it("stacks same-day events upward and keeps one x per date", () => {
    const { cells } = layoutCells([jul, julB, jan], { width: 400, cellSize: 10, gap: 2, padding: 20 });
    const byId = new Map(cells.map((cell) => [cell.eventId, cell]));
    expect(byId.get(jul.eventId)!.x).toBe(byId.get(julB.eventId)!.x);
    expect(byId.get(jul.eventId)!.y - byId.get(julB.eventId)!.y).toBe(12);
    expect(byId.get(jan.eventId)!.x).toBeLessThan(byId.get(jul.eventId)!.x);
  });

  it("applies selected > query-related > new > idle and keeps uncertainty separate", () => {
    const uncertain = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d54", verification: "uncertain", source: { ...jul.source, previewAvailable: false } });
    const { cells } = layoutCells([jul, julB, uncertain], {
      width: 400, cellSize: 10, gap: 2, padding: 20,
      selectedId: jul.eventId,
      matchedIds: new Set([jul.eventId, julB.eventId]),
      newIds: new Set([julB.eventId, uncertain.eventId]),
    });
    const state = Object.fromEntries(cells.map((cell) => [cell.eventId, cell.state]));
    expect(state[jul.eventId]).toBe("selected");
    expect(state[julB.eventId]).toBe("query-related");
    expect(state[uncertain.eventId]).toBe("new");
    expect(cells.find((cell) => cell.eventId === uncertain.eventId)!.uncertain).toBe(true);
  });

  it("writes an accessible name with concept, value, unit and Korean date", () => {
    const { cells } = layoutCells([jan], { width: 400, cellSize: 10, gap: 2, padding: 20 });
    expect(cells[0].ariaLabel).toBe("총콜레스테롤 194 mg/dL, 2026. 1. 15.");
  });

  it("returns a height that fits the tallest day stack", () => {
    const { height } = layoutCells([jul, julB], { width: 400, cellSize: 10, gap: 2, padding: 20 });
    expect(height).toBe(20 + 2 * 12 + 20);
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
pnpm --filter @gc/web test -- tests/cell-layout.test.ts 2>&1 | tail -8
```
Expected: `Failed to resolve import "@/lib/my-data/cell-layout"`.

- [ ] **Step 3: Implement**

```ts
import type { HealthEvent } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";

export type CellState = "idle" | "new" | "query-related" | "selected";

export type TimeScale = {
  start: string;
  end: string;
  x(observedOn: string): number;
  ticks: Array<{ label: string; x: number }>;
};

export type CellLayout = {
  eventId: string;
  x: number;
  y: number;
  size: number;
  state: CellState;
  uncertain: boolean;
  corrected: boolean;
  ariaLabel: string;
};

function dayNumber(isoDate: string) {
  return Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10))) / 86_400_000;
}

function monthLabel(isoDate: string) {
  return `${isoDate.slice(0, 4)}. ${Number(isoDate.slice(5, 7))}.`;
}

/** Linear day scale. Only coordinates: no smoothing, no interpolation of values. */
export function buildTimeScale(dates: string[], width: number, padding: number): TimeScale {
  const sorted = [...new Set(dates)].sort();
  const start = sorted[0] ?? "";
  const end = sorted[sorted.length - 1] ?? start;
  const span = dayNumber(end) - dayNumber(start);
  const inner = width - padding * 2;
  const x = (observedOn: string) => span === 0
    ? width / 2
    : padding + ((dayNumber(observedOn) - dayNumber(start)) / span) * inner;
  const months = [...new Set(sorted.map((date) => date.slice(0, 7)))];
  const ticks = months.map((month) => {
    const first = sorted.find((date) => date.startsWith(month))!;
    return { label: monthLabel(first), x: x(first) };
  });
  return { start, end, x, ticks };
}

type LayoutOptions = {
  width: number;
  cellSize: number;
  gap: number;
  padding: number;
  selectedId?: string;
  matchedIds?: Set<string> | null;
  newIds?: Set<string>;
};

function stateFor(eventId: string, options: LayoutOptions): CellState {
  if (options.selectedId === eventId) return "selected";
  if (options.matchedIds?.has(eventId)) return "query-related";
  if (options.newIds?.has(eventId)) return "new";
  return "idle";
}

/**
 * One rect per event. Same-day events stack upward in concept order so the
 * picture is stable across renders. Nothing here reads the value as a number.
 */
export function layoutCells(events: HealthEvent[], options: LayoutOptions) {
  const scale = buildTimeScale(events.map((event) => event.observedOn), options.width, options.padding);
  const step = options.cellSize + options.gap;
  const byDay = new Map<string, HealthEvent[]>();
  for (const event of events) {
    const stack = byDay.get(event.observedOn);
    if (stack) stack.push(event);
    else byDay.set(event.observedOn, [event]);
  }
  let tallest = 0;
  for (const stack of byDay.values()) {
    stack.sort((left, right) => left.concept.localeCompare(right.concept, "ko") || left.confirmedAt.localeCompare(right.confirmedAt));
    tallest = Math.max(tallest, stack.length);
  }
  const height = options.padding * 2 + tallest * step;
  const baseline = height - options.padding - options.cellSize;
  const cells: CellLayout[] = [];
  for (const [observedOn, stack] of byDay) {
    stack.forEach((event, index) => {
      cells.push({
        eventId: event.eventId,
        x: scale.x(observedOn) - options.cellSize / 2,
        y: baseline - index * step,
        size: options.cellSize,
        state: stateFor(event.eventId, options),
        uncertain: event.verification === "uncertain",
        corrected: event.corrected,
        ariaLabel: `${event.concept} ${event.value} ${event.unit}, ${formatKoreanDate(event.observedOn)}`,
      });
    });
  }
  return { cells, scale, height };
}
```
Note on the stacking test: index 0 is the concept that sorts first in Korean; `당화혈색소` sorts before `총콜레스테롤`, so `julB` (당화혈색소) is at the baseline and `jul` is 12px above it. The test expects `jul.y - julB.y === 12`; since upward means smaller y, change that assertion to `expect(byId.get(julB.eventId)!.y - byId.get(jul.eventId)!.y).toBe(12);` before running.

- [ ] **Step 4: Run the test**

Same command. Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/my-data/cell-layout.ts apps/web/tests/cell-layout.test.ts
git commit -m "feat(web): lay out health events as dated cells

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 5: Exact search over events

**Files:**
- Create: `apps/web/lib/my-data/search-events.ts`
- Test: `apps/web/tests/search-events.test.ts`

**Interfaces:**
- Produces: `export function searchEvents(events: HealthEvent[], query: string): { matchedIds: Set<string> | null; count: number }` — `null` means no filter (empty query).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { searchEvents } from "@/lib/my-data/search-events";
import { syntheticHealthEvent } from "./fixtures/foundation";

const chol = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51" });
const a1c = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d52", concept: "당화혈색소", unit: "%" });

describe("searchEvents", () => {
  it("returns no filter for an empty or whitespace query", () => {
    expect(searchEvents([chol, a1c], "")).toEqual({ matchedIds: null, count: 2 });
    expect(searchEvents([chol, a1c], "   ")).toEqual({ matchedIds: null, count: 2 });
  });

  it("matches the concept exactly after trimming and unicode normalisation", () => {
    const result = searchEvents([chol, a1c], " 총콜레스테롤 ".normalize("NFD"));
    expect([...result.matchedIds!]).toEqual([chol.eventId]);
    expect(result.count).toBe(1);
  });

  it("reports zero matches instead of falling back to everything", () => {
    expect(searchEvents([chol, a1c], "LDL")).toEqual({ matchedIds: new Set(), count: 0 });
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
pnpm --filter @gc/web test -- tests/search-events.test.ts 2>&1 | tail -6
```
Expected: import resolution failure.

- [ ] **Step 3: Implement**

```ts
import type { HealthEvent } from "@/lib/foundation/client";

function normalise(text: string) {
  return text.normalize("NFC").trim().toLocaleLowerCase("ko");
}

/**
 * Exact search only. A query is a concept name; it either names events or it
 * names none. There is no fuzzy match and no natural-language path in this wave.
 */
export function searchEvents(events: HealthEvent[], query: string) {
  const needle = normalise(query);
  if (!needle) return { matchedIds: null, count: events.length };
  const matchedIds = new Set(events.filter((event) => normalise(event.concept) === needle).map((event) => event.eventId));
  return { matchedIds, count: matchedIds.size };
}
```

- [ ] **Step 4: Run the test**

Same command. Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/my-data/search-events.ts apps/web/tests/search-events.test.ts
git commit -m "feat(web): exact concept search over health events

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 6: `LivingCellCanvas` + `CellTooltip`

**Files:**
- Create: `apps/web/components/my-data/LivingCellCanvas.tsx`
- Create: `apps/web/components/my-data/CellTooltip.tsx`
- Create: `apps/web/components/my-data/MyData.module.css`
- Test: `apps/web/tests/living-cell-canvas.test.tsx`

**Interfaces:**
- Consumes: `layoutCells`, `CellLayout`, `HealthEvent`.
- Produces: `<LivingCellCanvas events selectedId matchedIds newIds onSelect(eventId: string) width? />`; `<CellTooltip event />`.

- [ ] **Step 1: Write the failing test**

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it, vi } from "vitest";
import { LivingCellCanvas } from "@/components/my-data/LivingCellCanvas";
import { syntheticHealthEvent } from "./fixtures/foundation";

afterEach(cleanup);

const jan = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51", observedOn: "2026-01-15", value: "194" });
const jul = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d52" });
const shaky = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d53", concept: "비타민 D", unit: "ng/mL", value: "42", verification: "uncertain", source: { ...jul.source, previewAvailable: false } });

it("renders one focusable, named cell per event and nothing decorative", async () => {
  const { container } = render(<LivingCellCanvas events={[jan, jul, shaky]} matchedIds={null} newIds={new Set()} onSelect={() => {}} />);
  const figure = screen.getByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
  const cells = within(figure).getAllByRole("button");
  expect(cells).toHaveLength(3);
  expect(cells.map((cell) => cell.getAttribute("aria-label"))).toContain("총콜레스테롤 194 mg/dL, 2026. 1. 15.");
  expect(container.querySelectorAll("rect[data-cell]")).toHaveLength(3);
  expect(await axe(container)).toHaveNoViolations();
});

it("marks selection, query match and uncertainty with data attributes, not colour alone", () => {
  render(<LivingCellCanvas events={[jan, jul, shaky]} selectedId={jul.eventId} matchedIds={new Set([jan.eventId])} newIds={new Set()} onSelect={() => {}} />);
  const selected = screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL, 2026. 7. 28." });
  expect(selected).toHaveAttribute("aria-pressed", "true");
  expect(selected).toHaveAttribute("data-state", "selected");
  expect(screen.getByRole("button", { name: "총콜레스테롤 194 mg/dL, 2026. 1. 15." })).toHaveAttribute("data-state", "query-related");
  const uncertain = screen.getByRole("button", { name: "비타민 D 42 ng/mL, 2026. 7. 28. (출처 미리보기 없음)" });
  expect(uncertain).toHaveAttribute("data-uncertain", "true");
  expect(uncertain.querySelector("[data-hatch]")).not.toBeNull();
});

it("selects with click and with Enter, and shows the tooltip for the hovered cell", async () => {
  const onSelect = vi.fn();
  render(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={new Set()} onSelect={onSelect} />);
  const cell = screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL, 2026. 7. 28." });
  await userEvent.click(cell);
  expect(onSelect).toHaveBeenCalledWith(jul.eventId);
  cell.focus();
  await userEvent.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledTimes(2);
  await userEvent.hover(cell);
  expect(screen.getByRole("tooltip")).toHaveTextContent("총콜레스테롤");
  expect(screen.getByRole("tooltip")).toHaveTextContent("188 mg/dL");
  expect(screen.getByRole("tooltip")).toHaveTextContent("2026. 7. 28.");
});

it("draws one axis tick per month present in the data", () => {
  render(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={new Set()} onSelect={() => {}} />);
  expect(screen.getByText("2026. 1.")).toBeInTheDocument();
  expect(screen.getByText("2026. 7.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to see it fail**

```bash
pnpm --filter @gc/web test -- tests/living-cell-canvas.test.tsx 2>&1 | tail -6
```
Expected: import resolution failure.

- [ ] **Step 3: Implement `CellTooltip.tsx`**

```tsx
import type { HealthEvent } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";
import styles from "@/components/my-data/MyData.module.css";

/** First-level detail only: item, date, value. Source and history live in the drawer. */
export function CellTooltip({ event, x, y }: { event: HealthEvent; x: number; y: number }) {
  return (
    <div role="tooltip" id={`cell-tip-${event.eventId}`} className={styles.tooltip} style={{ left: x, top: y }}>
      <strong>{event.concept}</strong>
      <span>{event.value} {event.unit}</span>
      <span>{formatKoreanDate(event.observedOn)}</span>
    </div>
  );
}
```

- [ ] **Step 4: Implement `LivingCellCanvas.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import type { HealthEvent } from "@/lib/foundation/client";
import { layoutCells } from "@/lib/my-data/cell-layout";
import { CellTooltip } from "@/components/my-data/CellTooltip";
import styles from "@/components/my-data/MyData.module.css";

type LivingCellCanvasProps = {
  events: HealthEvent[];
  selectedId?: string;
  matchedIds: Set<string> | null;
  newIds: Set<string>;
  onSelect: (eventId: string) => void;
  width?: number;
};

const CELL = 10;
const GAP = 3;
const PADDING = 24;

/**
 * Pure SVG. Every rect is one CURRENT record; there is no decorative rect.
 * State is carried in data attributes and patterns so it survives without colour.
 */
export function LivingCellCanvas({ events, selectedId, matchedIds, newIds, onSelect, width = 720 }: LivingCellCanvasProps) {
  const [hoveredId, setHoveredId] = useState<string>();
  const { cells, scale, height } = useMemo(
    () => layoutCells(events, { width, cellSize: CELL, gap: GAP, padding: PADDING, selectedId, matchedIds, newIds }),
    [events, width, selectedId, matchedIds, newIds],
  );
  const byId = useMemo(() => new Map(events.map((event) => [event.eventId, event])), [events]);
  const hovered = hoveredId ? byId.get(hoveredId) : undefined;
  const hoveredCell = hovered ? cells.find((cell) => cell.eventId === hovered.eventId) : undefined;
  const dimmed = matchedIds !== null;

  return (
    <figure className={styles.canvasWrap} aria-label="나의 데이터: 한 칸이 하나의 기록">
      <svg
        className={styles.canvas}
        viewBox={`0 0 ${width} ${height + 28}`}
        width="100%"
        role="group"
        aria-label={`${events.length}개의 기록, ${scale.start ? `${scale.start}부터 ${scale.end}까지` : "기간 없음"}`}
      >
        <defs>
          <pattern id="gc-cell-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1.2" />
          </pattern>
        </defs>
        <g className={styles.axis} aria-hidden="true">
          <line x1={PADDING} x2={width - PADDING} y1={height + 6} y2={height + 6} />
          {scale.ticks.map((tick) => (
            <text key={tick.label} x={tick.x} y={height + 22} textAnchor="middle">{tick.label}</text>
          ))}
        </g>
        {cells.map((cell) => {
          const dim = dimmed && cell.state === "idle";
          const label = cell.uncertain ? `${cell.ariaLabel} (출처 미리보기 없음)` : cell.ariaLabel;
          return (
            <g
              key={cell.eventId}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={cell.state === "selected"}
              aria-describedby={hoveredId === cell.eventId ? `cell-tip-${cell.eventId}` : undefined}
              data-state={cell.state}
              data-uncertain={cell.uncertain ? "true" : undefined}
              data-corrected={cell.corrected ? "true" : undefined}
              data-dim={dim ? "true" : undefined}
              className={styles.cell}
              onClick={() => onSelect(cell.eventId)}
              onKeyDown={(keyboard) => {
                if (keyboard.key === "Enter" || keyboard.key === " ") {
                  keyboard.preventDefault();
                  onSelect(cell.eventId);
                }
              }}
              onMouseEnter={() => setHoveredId(cell.eventId)}
              onMouseLeave={() => setHoveredId(undefined)}
              onFocus={() => setHoveredId(cell.eventId)}
              onBlur={() => setHoveredId(undefined)}
            >
              <rect data-cell="" x={cell.x} y={cell.y} width={cell.size} height={cell.size} rx="1.5" />
              {cell.uncertain ? (
                <rect data-hatch="" x={cell.x} y={cell.y} width={cell.size} height={cell.size} rx="1.5" fill="url(#gc-cell-hatch)" />
              ) : null}
              {cell.corrected ? (
                <circle data-corrected-mark="" cx={cell.x + cell.size} cy={cell.y} r="2" />
              ) : null}
            </g>
          );
        })}
      </svg>
      {hovered && hoveredCell ? (
        <CellTooltip event={hovered} x={(hoveredCell.x / width) * 100} y={hoveredCell.y} />
      ) : null}
      <figcaption className={styles.caption}>한 칸 = 확인한 기록 하나. 값의 의미나 변화의 방향은 판단하지 않아요.</figcaption>
    </figure>
  );
}
```
Note: `CellTooltip` receives `x` as a percentage; set `left: ${x}%` in the tooltip style: change the tooltip's `style` to `{{ left: `${x}%`, top: y }}`.

- [ ] **Step 5: Create `MyData.module.css`**

```css
.page { min-height: 100vh; background: var(--gc-color-surface-canvas); color: var(--gc-color-text-primary); }
.shell { max-width: 1120px; margin: 0 auto; padding: var(--gc-space-6) var(--gc-space-4) var(--gc-space-10); }
.hero { display: grid; gap: var(--gc-space-2); margin-bottom: var(--gc-space-6); }
.hero h1 { font-size: 28px; line-height: 1.25; margin: 0; }
.hero p { margin: 0; color: var(--gc-color-text-secondary); }

.canvasWrap { position: relative; margin: 0; border: 1px solid var(--gc-color-line-subtle); border-radius: 8px; background: var(--gc-color-surface-raised); padding: var(--gc-space-3); }
.canvas { display: block; width: 100%; height: auto; overflow: visible; }
.axis line { stroke: var(--gc-color-line-strong); stroke-width: 1; }
.axis text { fill: var(--gc-color-text-tertiary); font: 12px var(--gc-type-mono); }

.cell { cursor: pointer; color: var(--gc-color-brand-primary); transition: transform 160ms ease, opacity 160ms ease; }
.cell rect[data-cell] { fill: var(--gc-color-surface-soft); stroke: var(--gc-color-line-strong); stroke-width: 1; }
.cell[data-state="new"] rect[data-cell] { fill: var(--gc-color-surface-raised); stroke: var(--gc-color-brand-primary); stroke-width: 1.5; }
.cell[data-state="query-related"] rect[data-cell] { fill: var(--gc-color-brand-primary); stroke: var(--gc-color-brand-primary); }
.cell[data-state="selected"] rect[data-cell] { fill: var(--gc-color-brand-deep); stroke: var(--gc-color-focus-ring); stroke-width: 2; }
.cell[data-dim="true"] { opacity: 0.28; }
.cell circle[data-corrected-mark] { fill: var(--gc-color-status-warning); }
.cell:focus-visible { outline: none; }
.cell:focus-visible rect[data-cell] { stroke: var(--gc-color-focus-ring); stroke-width: 2.5; }

.tooltip { position: absolute; transform: translate(-50%, -110%); display: grid; gap: 2px; padding: 6px 10px; border-radius: 6px; background: var(--gc-color-surface-inverse); color: var(--gc-color-text-inverse); font: 13px var(--gc-type-mono); pointer-events: none; white-space: nowrap; }
.caption { margin-top: var(--gc-space-2); color: var(--gc-color-text-tertiary); font-size: 13px; }

.search { display: grid; gap: var(--gc-space-2); margin: var(--gc-space-6) 0; }
.search input { min-height: 48px; padding: 0 var(--gc-space-4); border: 1px solid var(--gc-color-line-strong); border-radius: 8px; font: 16px var(--gc-type-sans); background: var(--gc-color-surface-raised); }
.search input:focus-visible { outline: 3px solid var(--gc-color-focus-ring); outline-offset: 2px; }

.table { width: 100%; border-collapse: collapse; font-size: 15px; }
.table th, .table td { text-align: left; padding: var(--gc-space-2) var(--gc-space-3); border-bottom: 1px solid var(--gc-color-line-subtle); }
.table td.num { font-family: var(--gc-type-mono); text-align: right; }
.table tr[aria-selected="true"] td { background: var(--gc-color-surface-soft); }

.drawer { border: 1px solid var(--gc-color-line-subtle); border-radius: 8px; background: var(--gc-color-surface-raised); padding: var(--gc-space-4); margin-top: var(--gc-space-4); display: grid; gap: var(--gc-space-3); }
.drawer dl { display: grid; grid-template-columns: max-content 1fr; gap: var(--gc-space-1) var(--gc-space-4); margin: 0; }
.drawer dt { color: var(--gc-color-text-tertiary); }
.drawer dd { margin: 0; font-family: var(--gc-type-mono); overflow-wrap: anywhere; }
.secondary { display: flex; flex-wrap: wrap; gap: var(--gc-space-3); margin-top: var(--gc-space-6); }
.secondary a { min-height: 44px; display: inline-flex; align-items: center; padding: 0 var(--gc-space-4); border: 1px solid var(--gc-color-line-strong); border-radius: 8px; color: inherit; text-decoration: none; }

@media (prefers-reduced-motion: reduce) {
  .cell { transition: none; }
}
```

- [ ] **Step 6: Run the test**

Same command. Expected: 4 pass, axe clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/my-data apps/web/tests/living-cell-canvas.test.tsx
git commit -m "feat(web): living cell canvas with accessible, patterned cell states

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 7: `EvidenceDrawer`

**Files:**
- Create: `apps/web/components/my-data/EvidenceDrawer.tsx`
- Test: `apps/web/tests/evidence-drawer.test.tsx`

**Interfaces:**
- Consumes: `SourcePreview({ documentId, page })`, `shortDigest` (`lib/format/short-digest.ts`), `formatKoreanDate`, `formatKoreanDateTime`.
- Produces: `<EvidenceDrawer event onClose />` rendered as `<section aria-labelledby>` with a close button named `근거 닫기`.

- [ ] **Step 1: Write the failing test**

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { EvidenceDrawer } from "@/components/my-data/EvidenceDrawer";
import { syntheticHealthEvent } from "./fixtures/foundation";

afterEach(cleanup);

it("shows source, page, digests and confirmation time for a verified event", () => {
  render(<EvidenceDrawer event={syntheticHealthEvent()} onClose={() => {}} />);
  const region = screen.getByRole("region", { name: "총콜레스테롤 근거" });
  expect(region).toHaveTextContent("188 mg/dL");
  expect(region).toHaveTextContent("2026. 7. 28.");
  expect(region).toHaveTextContent("1쪽");
  expect(region).toHaveTextContent("직접 확인한 값");
  expect(screen.getByRole("img", { name: /출처/ })).toBeInTheDocument();
});

it("explains a missing preview instead of hiding it, and names a corrected value", () => {
  const event = syntheticHealthEvent({ verification: "uncertain", corrected: true, source: { ...syntheticHealthEvent().source, previewAvailable: false } });
  render(<EvidenceDrawer event={event} onClose={() => {}} />);
  expect(screen.getByText("출처 미리보기를 지금은 볼 수 없어요. 값은 그대로 두고, 출처 상태만 표시해요.")).toBeVisible();
  expect(screen.getByText("직접 수정한 값")).toBeVisible();
  expect(screen.queryByRole("img")).toBeNull();
});

it("closes from the button", async () => {
  const onClose = vi.fn();
  render(<EvidenceDrawer event={syntheticHealthEvent()} onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "근거 닫기" }));
  expect(onClose).toHaveBeenCalled();
});
```
Before running, open `components/integrated/SourcePreview.tsx` and confirm the `<img>` alt text contains `출처`; if it does not, change the first test's `getByRole("img", { name: /출처/ })` to the actual alt pattern used there.

- [ ] **Step 2: Run to see it fail**

```bash
pnpm --filter @gc/web test -- tests/evidence-drawer.test.tsx 2>&1 | tail -6
```

- [ ] **Step 3: Implement**

```tsx
"use client";

import type { HealthEvent } from "@/lib/foundation/client";
import { SourcePreview } from "@/components/integrated/SourcePreview";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/format/korean-date";
import { shortDigest } from "@/lib/format/short-digest";
import styles from "@/components/my-data/MyData.module.css";

/**
 * Second-level detail for one cell. Every line here is a stored fact or a
 * stored status; the drawer never adds a comparison or a meaning.
 */
export function EvidenceDrawer({ event, onClose }: { event: HealthEvent; onClose: () => void }) {
  const titleId = `evidence-${event.eventId}`;
  return (
    <section className={styles.drawer} aria-labelledby={titleId}>
      <header>
        <h2 id={titleId}>{event.concept} 근거</h2>
        <button type="button" onClick={onClose}>근거 닫기</button>
      </header>
      <dl>
        <dt>값</dt><dd>{event.value} {event.unit}</dd>
        <dt>검사일</dt><dd>{formatKoreanDate(event.observedOn)}</dd>
        <dt>확인</dt><dd>{event.corrected ? "직접 수정한 값" : "직접 확인한 값"} · {formatKoreanDateTime(event.confirmedAt)}</dd>
        <dt>출처 위치</dt><dd>{event.source.page}쪽</dd>
        <dt>문서</dt><dd>{shortDigest(event.source.documentSha256)}</dd>
        <dt>원문</dt><dd>{shortDigest(event.source.sourceTextSha256)}</dd>
      </dl>
      {event.source.previewAvailable
        ? <SourcePreview documentId={event.source.documentId} page={event.source.page} />
        : <p role="status">출처 미리보기를 지금은 볼 수 없어요. 값은 그대로 두고, 출처 상태만 표시해요.</p>}
      <p><a href={`/records#record-${event.recordId}`}>기록 목록에서 이 값 보기</a></p>
    </section>
  );
}
```
If `formatKoreanDateTime` does not accept an ISO instant with `Z`, pass `event.confirmedAt.slice(0, 16).replace("T", " ")` instead (the existing `IntegratedRecords` shows how it formats `confirmedAt`; copy that call).

- [ ] **Step 4: Run the test**

Same command. Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/my-data/EvidenceDrawer.tsx apps/web/tests/evidence-drawer.test.tsx
git commit -m "feat(web): evidence drawer for one health event

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 8: `/my-data` page: `MyData`, `HealthEventTable`, route

**Files:**
- Create: `apps/web/components/my-data/HealthEventTable.tsx`
- Create: `apps/web/components/my-data/MyData.tsx`
- Create: `apps/web/app/my-data/page.tsx`
- Modify: `apps/web/tests/korean-ux-copy.test.ts` (add the three new components to `userFacingFiles`)
- Test: `apps/web/tests/my-data.test.tsx`

**Interfaces:**
- Consumes: `createFoundationClient().getSession()/getHealthEvents()`, `describeFoundationError`, `foundationShellState`, `IntegratedShell` (Task 9 adds `"my-data"` to `IntegratedRoute`; until then pass `current="records"` and switch in Task 9), `LivingCellCanvas`, `EvidenceDrawer`, `searchEvents`.
- Produces: page at `/my-data`.

- [ ] **Step 1: Write the failing test**

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { MyData } from "@/components/my-data/MyData";
import { syntheticHealthEvent } from "./fixtures/foundation";

const events = [
  syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51", observedOn: "2026-01-15", value: "194" }),
  syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d52" }),
  syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d53", concept: "당화혈색소", value: "5.2", unit: "%" }),
];

const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json({
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b", subjectId: "synthetic-jason", status: "AUTHENTICATED", expiresAt: "2026-08-30T08:30:00Z",
  })),
  http.get("/api/foundation/health-events", () => HttpResponse.json(events)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => { cleanup(); server.resetHandlers(); });

it("loads events into cells and a table, and opens the drawer from either", async () => {
  const { container } = render(<MyData />);
  const figure = await screen.findByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
  expect(within(figure).getAllByRole("button")).toHaveLength(3);
  const table = screen.getByRole("table", { name: "기록 목록" });
  expect(within(table).getAllByRole("row")).toHaveLength(4);
  await userEvent.click(within(figure).getByRole("button", { name: "총콜레스테롤 194 mg/dL, 2026. 1. 15." }));
  expect(screen.getByRole("region", { name: "총콜레스테롤 근거" })).toHaveTextContent("194 mg/dL");
  await userEvent.click(screen.getByRole("button", { name: "근거 닫기" }));
  expect(screen.queryByRole("region", { name: "총콜레스테롤 근거" })).toBeNull();
  await userEvent.click(within(table).getByRole("button", { name: "당화혈색소 5.2 %, 2026. 7. 28. 근거 보기" }));
  expect(screen.getByRole("region", { name: "당화혈색소 근거" })).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});

it("filters by exact concept and says so, including zero results", async () => {
  render(<MyData />);
  await screen.findByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
  const input = screen.getByRole("searchbox", { name: "내 데이터에서 항목 찾기" });
  await userEvent.type(input, "총콜레스테롤");
  expect(screen.getByRole("status", { name: "검색 결과" })).toHaveTextContent("총콜레스테롤 기록 2개");
  expect(screen.getByRole("button", { name: "당화혈색소 5.2 %, 2026. 7. 28." })).toHaveAttribute("data-dim", "true");
  await userEvent.clear(input);
  await userEvent.type(input, "LDL");
  expect(screen.getByRole("status", { name: "검색 결과" })).toHaveTextContent("LDL 기록이 없어요");
});

it("shows the empty state and the server error state honestly", async () => {
  server.use(http.get("/api/foundation/health-events", () => HttpResponse.json([])));
  const { unmount } = render(<MyData />);
  expect(await screen.findByText("아직 확인한 기록이 없어요. 데이터 관리에서 결과지를 추가하면 여기에 한 칸씩 쌓여요.")).toBeVisible();
  unmount();
  server.use(http.get("/api/foundation/health-events", () => HttpResponse.json({ code: "INTERNAL" }, { status: 500 })));
  render(<MyData />);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
});
```

- [ ] **Step 2: Run to see it fail**

```bash
pnpm --filter @gc/web test -- tests/my-data.test.tsx 2>&1 | tail -6
```

- [ ] **Step 3: Implement `HealthEventTable.tsx`**

```tsx
import type { HealthEvent } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";
import styles from "@/components/my-data/MyData.module.css";

type HealthEventTableProps = {
  events: HealthEvent[];
  selectedId?: string;
  matchedIds: Set<string> | null;
  onSelect: (eventId: string) => void;
};

/** The same events as the canvas, as a table. This is the accessible equivalent, not a summary. */
export function HealthEventTable({ events, selectedId, matchedIds, onSelect }: HealthEventTableProps) {
  const visible = matchedIds ? events.filter((event) => matchedIds.has(event.eventId)) : events;
  return (
    <table className={styles.table} aria-label="기록 목록">
      <thead>
        <tr><th scope="col">항목</th><th scope="col">값</th><th scope="col">검사일</th><th scope="col">확인</th><th scope="col">근거</th></tr>
      </thead>
      <tbody>
        {visible.map((event) => (
          <tr key={event.eventId} aria-selected={event.eventId === selectedId}>
            <th scope="row">{event.concept}</th>
            <td className="num">{event.value} {event.unit}</td>
            <td>{formatKoreanDate(event.observedOn)}</td>
            <td>{event.corrected ? "직접 수정" : "직접 확인"}{event.verification === "uncertain" ? " · 출처 미리보기 없음" : ""}</td>
            <td>
              <button type="button" onClick={() => onSelect(event.eventId)}
                aria-label={`${event.concept} ${event.value} ${event.unit}, ${formatKoreanDate(event.observedOn)} 근거 보기`}>
                근거 보기
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Implement `MyData.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createFoundationClient, type HealthEvent } from "@/lib/foundation/client";
import { describeFoundationError, foundationShellState } from "@/lib/foundation/messages";
import { searchEvents } from "@/lib/my-data/search-events";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { LivingCellCanvas } from "@/components/my-data/LivingCellCanvas";
import { EvidenceDrawer } from "@/components/my-data/EvidenceDrawer";
import { HealthEventTable } from "@/components/my-data/HealthEventTable";
import styles from "@/components/my-data/MyData.module.css";

function needsSignIn(error: unknown) {
  const state = foundationShellState(error);
  return state === "UNAUTHENTICATED" || state === "SESSION_EXPIRED";
}

export function MyData() {
  const client = useMemo(() => createFoundationClient(), []);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorAction, setErrorAction] = useState<"retry-read" | "sign-in">();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage("");
    setErrorAction(undefined);
    void (async () => {
      try {
        await client.getSession();
        const loaded = await client.getHealthEvents();
        if (active) setEvents(loaded);
      } catch (error) {
        if (active) {
          setErrorMessage(describeFoundationError(error));
          setErrorAction(needsSignIn(error) ? "sign-in" : "retry-read");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [client, loadAttempt]);

  const search = useMemo(() => searchEvents(events, query), [events, query]);
  const selected = selectedId ? events.find((event) => event.eventId === selectedId) : undefined;
  const trimmed = query.trim();
  const searchStatus = !trimmed ? "" : search.count === 0 ? `${trimmed} 기록이 없어요.` : `${trimmed} 기록 ${search.count}개`;

  return (
    <IntegratedShell current="my-data" status="예시 데이터">
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.hero} aria-labelledby="my-data-title">
            <p>직접 확인한 기록을 시간 순서로</p>
            <h1 id="my-data-title">나의 데이터</h1>
            <p>한 칸이 확인한 기록 하나예요. 칸을 고르면 값과 출처를 볼 수 있어요. 값의 의미나 변화의 방향은 판단하지 않아요.</p>
          </section>

          {loading && <p role="status" aria-live="polite">서버에서 기록을 불러오고 있어요.</p>}
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}{" "}
            {errorAction === "sign-in" && <a href="/">홈에서 다시 시작</a>}
            {errorAction === "retry-read" && <button type="button" disabled={loading} onClick={() => setLoadAttempt((attempt) => attempt + 1)}>다시 불러오기</button>}
          </p>}

          {!loading && !errorMessage && events.length === 0 && (
            <p>아직 확인한 기록이 없어요. 데이터 관리에서 결과지를 추가하면 여기에 한 칸씩 쌓여요.</p>
          )}

          {events.length > 0 && (
            <>
              <LivingCellCanvas
                events={events}
                selectedId={selectedId}
                matchedIds={search.matchedIds}
                newIds={new Set()}
                onSelect={(eventId) => setSelectedId((current) => current === eventId ? undefined : eventId)}
              />

              <form className={styles.search} role="search" onSubmit={(submit) => submit.preventDefault()}>
                <label htmlFor="my-data-search">내 데이터에서 항목 찾기</label>
                <input id="my-data-search" type="search" value={query} onChange={(change) => setQuery(change.target.value)}
                  placeholder="예: 총콜레스테롤" autoComplete="off" />
                <p role="status" aria-label="검색 결과" aria-live="polite">{searchStatus}</p>
              </form>

              {selected && <EvidenceDrawer event={selected} onClose={() => setSelectedId(undefined)} />}

              <HealthEventTable events={events} selectedId={selectedId} matchedIds={search.matchedIds} onSelect={setSelectedId} />
            </>
          )}

          <nav className={styles.secondary} aria-label="나의 데이터 더 보기">
            <a href="/records">기록 목록과 날짜별 비교</a>
            <a href="/prepare">진료 준비 질문</a>
          </nav>
        </div>
      </main>
    </IntegratedShell>
  );
}
```
Until Task 9 lands, `current="my-data"` will not type-check; do Task 9 Step 3 (the `IntegratedRoute` union change) first if the executor is running this task standalone.

- [ ] **Step 5: Route and copy-scan registration**

`apps/web/app/my-data/page.tsx`:
```tsx
import type { Metadata } from "next";
import { MyData } from "@/components/my-data/MyData";

export const metadata: Metadata = {
  title: "나의 데이터",
  description: "직접 확인한 기록을 한 칸씩 시간 순서로 보고, 값과 출처를 확인하는 화면",
};

export default function MyDataPage() {
  return <MyData />;
}
```
In `tests/korean-ux-copy.test.ts`, add to `userFacingFiles`:
```ts
  "components/my-data/MyData.tsx",
  "components/my-data/LivingCellCanvas.tsx",
  "components/my-data/EvidenceDrawer.tsx",
  "components/my-data/HealthEventTable.tsx",
  "components/my-data/CellTooltip.tsx",
```
and add to the "states the ... limits in direct Korean" test:
```ts
    expect(source("components/my-data/MyData.tsx")).toContain("값의 의미나 변화의 방향은 판단하지 않아요.");
```

- [ ] **Step 6: Run the tests and the build**

```bash
pnpm web:test 2>&1 | tail -8
pnpm --dir apps/web build 2>&1 | tail -5
```
Expected: all files pass; build lists `/my-data`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/my-data apps/web/app/my-data apps/web/tests/my-data.test.tsx apps/web/tests/korean-ux-copy.test.ts
git commit -m "feat(web): /my-data page with living cells, exact search, evidence drawer and table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 9: Navigation: 나의 데이터 / 데이터 관리

**Files:**
- Modify: `apps/web/components/integrated/IntegratedShell.tsx:5-25`
- Modify: `apps/web/components/integrated/IntegratedRecords.tsx` (`current="records"` stays; shell maps it), `VisitPreparation.tsx`, `IntegratedDataControl.tsx`, `IntegratedHealthExperience.tsx` (add a link to `/my-data` after bootstrap)
- Modify: `apps/web/tests/integrated-shell.test.tsx`, `apps/web/e2e/foundation-lifecycle.spec.ts:19` (nav label list), `apps/web/tests/unified-product.test.tsx` if it asserts nav labels

**Interfaces:**
- Produces: `IntegratedRoute = "home" | "my-data" | "records" | "prepare" | "data-control"`; the nav renders two links `나의 데이터 → /my-data`, `데이터 관리 → /data-control`; `records`/`prepare`/`my-data` mark 나의 데이터 as current; `data-control` marks 데이터 관리; `home` marks none.

- [ ] **Step 1: Update the shell test first**

Replace the first and third tests in `tests/integrated-shell.test.tsx`:
```tsx
it("offers two destinations and marks the group the current screen belongs to", () => {
  render(<IntegratedShell current="prepare"><main>본문</main></IntegratedShell>);
  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  expect(within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["나의 데이터", "/my-data"],
    ["데이터 관리", "/data-control"],
  ]);
  expect(within(nav).getByRole("link", { name: "나의 데이터" })).toHaveAttribute("aria-current", "page");
  expect(within(nav).getByRole("link", { name: "데이터 관리" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("link", { name: "앎 건강 홈" })).toHaveAttribute("href", "/");
});

it("marks nothing current on the entry screen", () => {
  render(<IntegratedShell current="home"><main>본문</main></IntegratedShell>);
  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
});
```
In the icon test, replace the label list with `["나의 데이터", "데이터 관리"]`.

- [ ] **Step 2: Run to see it fail**

```bash
pnpm --filter @gc/web test -- tests/integrated-shell.test.tsx 2>&1 | tail -6
```

- [ ] **Step 3: Implement in `IntegratedShell.tsx`**

```tsx
export type IntegratedRoute = "home" | "my-data" | "records" | "prepare" | "data-control";

type NavKey = "my-data" | "data-control";

// Two destinations: everything a person looks at, and everything a person
// manages. Records and preparation are sections of the first.
const routes: ReadonlyArray<{ key: NavKey; href: string; label: string }> = [
  { key: "my-data", href: "/my-data", label: "나의 데이터" },
  { key: "data-control", href: "/data-control", label: "데이터 관리" },
];

const navGroup: Record<IntegratedRoute, NavKey | null> = {
  home: null,
  "my-data": "my-data",
  records: "my-data",
  prepare: "my-data",
  "data-control": "data-control",
};

const routeIconPaths: Record<NavKey, string> = {
  "my-data": "M4 18h16M6 14h2v4H6zM10 10h2v8h-2zM14 12h2v6h-2zM18 6h2v12h-2z",
  "data-control": "M4 6h5m4 0h7M4 12h9m4 0h3M4 18h3m4 0h9M9 4v4m4 2v4m-6 2v4",
};
```
and in the JSX: `aria-current={route.key === navGroup[current] ? "page" : undefined}`.

- [ ] **Step 4: Update the e2e nav expectations and the entry screen**

In `e2e/foundation-lifecycle.spec.ts` line 19 replace `["홈", "기록", "진료 준비", "데이터"]` with `["나의 데이터", "데이터 관리"]`. Search the file for other occurrences of `"진료 준비"` used as a nav link (`nav.getByRole("link", { name: "진료 준비" })`) and change them to navigate via `page.goto("/prepare")` instead. In `IntegratedHealthExperience.tsx`, wherever the post-review success copy links to `/records`, add a sibling link `<a href="/my-data">나의 데이터에서 한 칸씩 보기</a>`.

- [ ] **Step 5: Run all web tests and the build**

```bash
pnpm web:test 2>&1 | tail -8
pnpm --dir apps/web build 2>&1 | tail -4
```
Expected: pass. Fix any test that still asserts the old four labels (grep `"진료 준비"` in `tests/`).

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): two-destination navigation (나의 데이터 / 데이터 관리)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 10: Browser lifecycle: new cells after review, drawer opens the source

**Files:**
- Modify: `apps/web/e2e/foundation-lifecycle.spec.ts`

- [ ] **Step 1: Add the assertions after the existing "records persist after reload" step**

Locate the step that reloads `/records` and asserts persisted records. Immediately after it add:
```ts
    await page.goto("/my-data");
    const figure = page.getByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
    await expect(figure).toBeVisible();
    const cells = figure.getByRole("button");
    await expect(cells).toHaveCount(expectedCurrentRecordCount);
    await expect(page.getByRole("table", { name: "기록 목록" }).getByRole("row")).toHaveCount(expectedCurrentRecordCount + 1);
    await cells.first().click();
    const drawer = page.getByRole("region", { name: /근거$/ });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("img")).toBeVisible();
    await page.getByRole("searchbox", { name: "내 데이터에서 항목 찾기" }).fill("총콜레스테롤");
    await expect(page.getByRole("status", { name: "검색 결과" })).toContainText("총콜레스테롤 기록");
    await captureMatrix(page, testInfo, "my-data");
```
Set `expectedCurrentRecordCount` to the variable the spec already uses for the number of CURRENT records at that point (search for the `/records` count assertion and reuse its number or variable). Add `"my-data"` handling to `captureMatrix` only if it switches on `state` for control-size assertions: for `state === "my-data"`, assert the search input's bounding box height ≥ 44.

- [ ] **Step 2: Run the browser lifecycle locally**

```bash
export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'
export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'
pnpm foundation:e2e 2>&1 | tail -20
```
Expected: all scenarios pass; screenshots for `my-data` appear in `apps/web/test-results`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/foundation-lifecycle.spec.ts
git commit -m "test(e2e): my-data cells, drawer and search in the browser lifecycle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 11: Evidence document, ledger row, PR

**Files:**
- Create: `docs/status/2026-09-16/wave1-my-data.md`
- Modify: `docs/revision/ASTRA_PRODUCT_REBUILD.md` §28 (add row `M10 나의 데이터 living cells`)
- Modify: `docs/roadmap/2026-09-02-roadmap.md` Track A (add `A8 HealthEvent read-model + living cells | implemented locally`)
- Modify: `PROJECT_GUIDE.md` §2 "Korean consumer web" row (one sentence: `/my-data` renders one cell per CURRENT record with exact search and an evidence drawer)

- [ ] **Step 1: Run every gate and capture the numbers**

```bash
pnpm security:runtime-policy && pnpm release:readiness:validate && pnpm web:test 2>&1 | tail -4 && pnpm --dir apps/web build 2>&1 | tail -3 && pnpm auth-security:gate 2>&1 | tail -2 && ./gradlew.bat test --no-daemon 2>&1 | tail -3
```

- [ ] **Step 2: Write `docs/status/2026-09-16/wave1-my-data.md`**

```markdown
# Wave 1 evidence — /my-data living cells (2026-09-16)

Branch `codex/wave3-my-data-living-cells` on top of PR #5 head. Synthetic only. Release remains NO_GO; no gate changes.

## What exists now
- `GET /api/foundation/health-events`: owner-scoped projection of CURRENT record versions. Fields: eventId, recordId, domain(lab), concept, value, unit, observedOn, verification(verified|uncertain), corrected, confirmedAt, source{documentId,page,documentSha256,sourceTextSha256,previewAvailable}. No reference range, no direction.
- `/my-data`: one SVG rect per event, month ticks, exact concept search, evidence drawer reusing the approved PNG preview, table equivalent, two-destination navigation.

## Evidence
| Gate | Result |
|---|---|
| runtime-policy | (paste) |
| readiness validate | (paste) |
| web:test | (files / tests) |
| web build | (paste) |
| auth-security gate | (paste) |
| gradlew test (embedded PostgreSQL) | (tests / skipped / failures) |
| foundation:e2e | (scenarios; screenshot folder) |

## Limits
No hosted run, no real screen reader, no real browser zoom, no user research. The `uncertain` state reflects preview availability only; it is not an extraction-accuracy claim.
```
Paste the real outputs.

- [ ] **Step 3: Commit, push, open the PR**

```bash
git add docs PROJECT_GUIDE.md
git commit -m "docs: wave 1 my-data evidence, ledger and roadmap rows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin codex/wave3-my-data-living-cells
gh pr create --base codex/unified-health-product --title "Wave 1: HealthEvent read-model and /my-data living cells" --body-file docs/status/2026-09-16/wave1-my-data.md
```
Base the PR on `codex/unified-health-product` while PR #5 is open; retarget to `main` after PR #5 merges. Append the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)` to the PR body.

---

## Self-review against the spec

- §2 Phase 0: Tasks 0.1–0.3 cover gates, three scenarios, six viewports, keyboard, reduced motion (Task 0.2 Step 5 covers viewports and keyboard; add a `prefers-reduced-motion` emulation check via `page.emulateMedia` only in Task 10, and via the DevTools rendering panel note in Task 0.2 if the built-in browser cannot emulate it: record "not emulated" honestly).
- §3 backend fields, verification rule, owner isolation: Tasks 1–2. Cross-check: `corrected` is a separate boolean, `verification` is `verified|uncertain` (Task 1 DTO, Task 3 schema, Task 4 layout, Task 7 drawer all agree).
- §3 frontend: canvas (Task 6), tooltip (Task 6), drawer (Task 7), exact search with zero-state (Tasks 5, 8), state priority and non-colour patterns (Tasks 4, 6), reduced motion (Task 6 CSS), table alternative (Task 8), keyboard (Task 6), navigation (Task 9), redirects: existing URLs stay live so no redirect is needed; the spec's "기존 URL은 redirect" is satisfied by keeping `/records`, `/prepare`, `/connections`, `/providers`, `/data-control` unchanged.
- §3 tests: vitest (4, 5, 6, 7, 8, 9), Kotlin (1, 2), Playwright (10), copy scan (8), axe (6, 8), screenshots (10).
- §6 uncertainty: hatch + label suffix + drawer status (6, 7, 8).
- §7 evidence: Task 11.
- Types: `HealthEvent` field names identical in Kotlin (Task 1), zod (Task 3), fixture (Task 3), and consumers (4–8). `searchEvents` returns `{ matchedIds, count }` in Task 5 and is consumed that way in Task 8. `layoutCells` option names in Task 4 match the call in Task 6.
