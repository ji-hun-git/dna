# Wave 2C — What-changed API, consent purposes (V9) and HealthEvent export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a person confirms a new 결과지, the server states deterministically which values arrived and what the previous value of the same item was (no judgement); consent is stored per purpose (service, research use, research contact, per project) with research consent never gating anything; and a person can download their own HealthEvents as one JSON file straight from the core.

**Architecture:** Spring stays the authority. Core: a pure `ChangeSummaryProjection` over CURRENT record rows plus document completion instants behind `GET /api/foundation/changes`; V9 relaxes the `gc_consent_grant` purpose CHECK and adds an optional `purpose_code` to `gc_audit_event`, `GET /api/foundation/consents` lists the three fixed purposes (plus existing `PROJECT:*` rows) and `POST /api/foundation/consents/{purposeCode}` grants idempotently, while every lifecycle check keeps reading only `DOCUMENT_EXTRACTION`; `GET /api/foundation/health-events/export` returns the owner's events and documents as an `attachment`. Web: strict zod schemas, a `RecentChanges` home section, a four-row consent section and an export link in 데이터 관리 that opens the core URL directly (`<a download>`); no Next.js API route, token or authorization rule.

**Tech Stack:** Kotlin 2.3.21 / Java 21 / Gradle 8.14.3 (`./gradlew.bat`), Spring Boot 3.5.16 + JdbcTemplate + Flyway + Bean Validation, JUnit 5 + AssertJ + MockMvc; Next 16.3.3 / React 19 / zod 4 / vitest + Testing Library + msw / Playwright 1.62; pnpm 11.20.0, Node 24.20.0; embedded PostgreSQL 16 for the gated JVM tests and the browser lifecycle.

Spec: `docs/superpowers/specs/2026-09-17-wave2c-changes-consent-export-design.md` (founder-approved 2026-09-17). Authority: `PROJECT_GUIDE.md` §6, `AGENTS.md`. Previous wave: `docs/superpowers/plans/2026-09-17-wave2b-medgemma-eval-and-dates.md`, evidence `docs/status/2026-09-17/wave2b.md`.

## Global Constraints

- Toolchain: Node `24.20.0`, pnpm `11.20.0`, Java `21`. In every Git Bash shell first run `export PATH="$HOME/.gc-node24:$PATH"`. Gradle is `./gradlew.bat` from the repository root `C:/Users/Jason/Documents/genome-companion-korea-ux` (no whitespace in the path).
- Embedded PostgreSQL 16 (trust auth, port 5432) holds synthetic rows only. Env-gated JVM tests need `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'` and Gradle needs `cleanTest` before `test` to re-run them. `pnpm foundation:e2e` needs `export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'` in addition.
- Branch: everything goes on `codex/wave6-changes-consent-export` (already checked out in this worktree). Never push to `main`. The PR is deferred (Task 9 ends with local gates only). The pre-existing uncommitted change to `apps/web/next-env.d.ts` is Next's own rewrite and is never staged.
- Judgement-free (spec §1): What-changed lists values only. No difference, ratio, direction, colour, arrow, reference range, trend or risk in code, JSON or copy. A unit mismatch yields `previous = null`; no unit conversion.
- Next.js gains no API route, provider token or authorization rule (spec §1, `AGENTS.md`). The export is the browser opening the core URL `/api/foundation/health-events/export` through the existing `/api/:path*` rewrite with the same cookie, session and owner check.
- Research consent is stored only (spec §1, §3). No research pipeline and no contact channel exist; the UI states that a per-project consent will be asked again before any use. Research consent is never a precondition of any feature; every lifecycle check keeps reading `DOCUMENT_EXTRACTION` only, and the PostgreSQL test in Task 3 proves the full lifecycle succeeds with research consent absent and revoked. The `consentpurpose` module is untouched; consent extends the foundation table (V9).
- `release/readiness.json` and readiness gates do not change. Synthetic data only. Audit rows carry no value and no date; the new consent audit rows carry the purpose code and nothing else; the export audit row carries no count and no value.
- Korean user-facing copy; never render a raw server enum; forbidden terms in `apps/web/tests/korean-ux-copy.test.ts` apply to every component. Exact copy (spec §2–§4): "최근 변화"; "새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요."; row titles 서비스 제공(결과지 처리) · 연구 활용 · 연구 연락 · 프로젝트별; "가명처리 후 연구에 쓰는 것에 대한 선택. 지금은 진행 중인 연구가 없어요."; "적합한 연구가 있을 때 참여 제안을 받을지. 지금은 연락 채널이 없어요."; "프로젝트가 생기면 여기서 개별로 물어요."; "연구 동의 없이도 모든 기능을 쓸 수 있어요."; "내 기록 내보내기(JSON)"; "브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요."; "내보낼 기록이 없어요".
- Consent purpose codes: `DOCUMENT_EXTRACTION | RESEARCH_USE | RESEARCH_CONTACT | PROJECT:[a-z0-9-]{1,40}`. Policy versions: `foundation-v1` (existing), `research-consent-policy.v1`, `research-contact-policy.v1`, `project-consent-policy.v1`. The unique index `gc_consent_one_active_purpose_idx` (one ACTIVE row per subject and purpose) stays.
- Export contract: `Content-Type: application/json`, `Content-Disposition: attachment; filename="alm-health-events-<YYYYMMDD>.json"` (date in Asia/Seoul), `Cache-Control: no-store`; body `{ schemaVersion: "alm-health-events-export.v1", exportedAt, subjectKind: "synthetic", events: HealthEvent[], documents: [{documentId, observedOn?, status, abstentions}] }`; no `referenceRange` key anywhere; audit `HEALTH_EVENTS_EXPORTED`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Gates before finishing: `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `pnpm web:test`, `pnpm --dir apps/web build`, `pnpm auth-security:gate`, `pnpm security:github-actions-policy`, `./gradlew.bat cleanTest test --no-daemon` with `GC_TEST_POSTGRES_URL`, `pnpm medical-ai:native-text-gate`, `pnpm foundation:e2e`.

---

## File map

| Path | Responsibility |
|---|---|
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjection.kt` (create) | `DocumentCompletionRow`, `ChangeDocument`, `ChangeValue`, `ChangeItem`, `ChangeSummary`, pure `ChangeSummaryProjection.project` |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjectionTest.kt` (create) | latest-document selection, previous by concept code else label, unit mismatch, new concepts, unchanged count, empty, no interpretation fields |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ConsentPurpose.kt` (create) | purpose constants, pattern, fixed order, policy versions |
| `apps/core-api/src/main/resources/db/migration/V9__consent_purposes.sql` (create) | relaxed purpose CHECK; `gc_audit_event.purpose_code` |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt` (modify) | `listDocumentCompletions`; per-purpose consent rows (`grantConsent`, `findActiveConsent`, `findLatestConsent`, `listLatestConsents`, `findConsent`); audit `purposeCode` |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt` (modify) | `getChangeSummary`; `ConsentReceipt`, `grantConsent`, `listConsents`, `revokeConsent` returning the purpose; `ExportedDocument`, `HealthEventExport`, `exportHealthEvents`, `exportFilename` |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt` (modify) | `GET /changes`, `GET /consents`, `POST /consents/{purposeCode}`, revocation purpose, `GET /health-events/export` |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt` (modify) | changes, consent invariants, export tests |
| `apps/web/lib/foundation/client.ts` (modify) | `changeSummarySchema`/`getChanges`; `consentPurposeSchema`/`getConsents`/`grantConsent`; widened `consentSchema.purposeCode` |
| `apps/web/components/integrated/RecentChanges.tsx` (create) | "최근 변화" section |
| `apps/web/components/integrated/IntegratedHealthExperience.tsx` (modify) | fetch changes in `loadProductTruth`; render `RecentChanges` on the home view |
| `apps/web/components/integrated/IntegratedDataControl.tsx` (modify) | four consent rows, export link |
| `apps/web/tests/recent-changes.test.tsx` (create); `tests/foundation-client.test.ts`, `tests/integrated-review-loop.test.tsx`, `tests/integrated-data-control.test.tsx`, `tests/korean-ux-copy.test.ts` (modify) | web unit tests and the copy scan |
| `apps/web/e2e/foundation-lifecycle.spec.ts` (modify) | 최근 변화 after two documents; research consent grant→revoke with the lifecycle continuing; export headers and download event |
| `docs/status/2026-09-17/wave2c.md` (create); `docs/revision/ASTRA_PRODUCT_REBUILD.md` §28, `docs/roadmap/2026-09-02-roadmap.md`, `PROJECT_GUIDE.md` §2 (modify) | evidence and ledger |

---

### Task 1: Core — `ChangeSummaryProjection` (pure) with unit tests

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjection.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjectionTest.kt`

**Interfaces:**
- Consumes: `FoundationRecordRow` (`FoundationRepository.kt:108-128`: `recordVersionId`, `documentId`, `status`, `label`, `currentValue`, `unit`, `observedOn: LocalDate`, `confirmedAt`, `conceptCode`).
- Produces: `data class DocumentCompletionRow(documentId: UUID, completedAt: Instant)`; `data class ChangeDocument(documentId, observedOn: String, completedAt: Instant, eventCount: Int)`; `data class ChangeValue(eventId: UUID, value: String, observedOn: String)`; `data class ChangeItem(conceptCode: String?, concept: String, unit: String, latest: ChangeValue, previous: ChangeValue?)`; `data class ChangeSummary(latestDocument: ChangeDocument?, items: List<ChangeItem>, newConcepts: List<String>, unchangedCount: Int)`; `ChangeSummaryProjection.project(records: List<FoundationRecordRow>, documents: List<DocumentCompletionRow>): ChangeSummary`. Task 2 serves it; Task 5 mirrors it in zod.

Rules (spec §2): only `CURRENT` rows count. `latestDocument` is the document with the greatest `completedAt` among documents that still have at least one CURRENT record (ties broken by `documentId` text so the answer is the same on every call). For each CURRENT record of that document, `previous` is the CURRENT record from any *other* document with the same concept key — `conceptCode` when present, otherwise the label — that has the latest `observedOn` (ties by `confirmedAt`); if that record's unit differs, `previous` is `null` (no conversion, no older same-unit fallback). `newConcepts` are the labels of items without `previous`. `unchangedCount` is the number of concept keys present in other documents but absent from the latest one.

- [ ] **Step 1: Write the failing tests**

Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjectionTest.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class ChangeSummaryProjectionTest {
    private val januaryDocument = UUID.fromString("11111111-1111-4111-8111-111111111111")
    private val aprilDocument = UUID.fromString("22222222-2222-4222-8222-222222222222")
    private val julyDocument = UUID.fromString("33333333-3333-4333-8333-333333333333")

    private fun completed(documentId: UUID, at: String) = DocumentCompletionRow(documentId, Instant.parse(at))

    private fun row(
        label: String,
        value: String,
        observedOn: LocalDate,
        documentId: UUID,
        unit: String = "mg/dL",
        conceptCode: String? = "total-cholesterol",
        status: String = "CURRENT",
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
        originalValue = value,
        unit = unit,
        observedOn = observedOn,
        confirmedAt = confirmedAt,
        correctionReason = null,
        evidencePage = 1,
        sourceTextSha256 = "b".repeat(64),
        documentSha256 = "a".repeat(64),
        conceptCode = conceptCode,
    )

    @Test
    fun returnsAnEmptySummaryWithoutACompletedDocumentThatStillHasCurrentRecords() {
        assertThat(ChangeSummaryProjection.project(emptyList(), emptyList()))
            .isEqualTo(ChangeSummary(null, emptyList(), emptyList(), 0))
        val superseded = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument, status = "SUPERSEDED")
        assertThat(ChangeSummaryProjection.project(listOf(superseded), listOf(completed(julyDocument, "2026-07-28T10:00:00Z"))).latestDocument)
            .isNull()
        val orphan = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument)
        assertThat(ChangeSummaryProjection.project(listOf(orphan), emptyList()).items).isEmpty()
    }

    @Test
    fun picksTheMostRecentlyCompletedDocumentThatStillHasCurrentRecords() {
        val records = listOf(
            row("총콜레스테롤", "194", LocalDate.of(2026, 1, 15), januaryDocument),
            row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument),
            row("당화혈색소", "5.2", LocalDate.of(2026, 7, 28), julyDocument, unit = "%", conceptCode = "hba1c"),
        )
        val documents = listOf(
            completed(januaryDocument, "2026-07-01T00:00:00Z"),
            completed(julyDocument, "2026-07-28T10:00:00Z"),
            completed(aprilDocument, "2026-08-01T00:00:00Z"),
        )

        val summary = ChangeSummaryProjection.project(records, documents)

        val latest = checkNotNull(summary.latestDocument)
        assertThat(latest.documentId).isEqualTo(julyDocument)
        assertThat(latest.completedAt).isEqualTo(Instant.parse("2026-07-28T10:00:00Z"))
        assertThat(latest.observedOn).isEqualTo("2026-07-28")
        assertThat(latest.eventCount).isEqualTo(2)
        assertThat(summary.items.map { it.concept }).containsExactly("당화혈색소", "총콜레스테롤")
    }

    @Test
    fun pairsEachItemWithTheLatestObservedValueOfTheSameConceptFromOtherDocuments() {
        val january = row("총콜레스테롤", "194", LocalDate.of(2026, 1, 15), januaryDocument)
        val april = row("총콜레스테롤", "190", LocalDate.of(2026, 4, 10), aprilDocument)
        val july = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument)
        val documents = listOf(
            completed(aprilDocument, "2026-04-11T00:00:00Z"),
            completed(januaryDocument, "2026-05-01T00:00:00Z"),
            completed(julyDocument, "2026-07-28T10:00:00Z"),
        )

        val item = ChangeSummaryProjection.project(listOf(january, april, july), documents).items.single()

        assertThat(item.conceptCode).isEqualTo("total-cholesterol")
        assertThat(item.unit).isEqualTo("mg/dL")
        assertThat(item.latest).isEqualTo(ChangeValue(july.recordVersionId, "188", "2026-07-28"))
        assertThat(item.previous).isEqualTo(ChangeValue(april.recordVersionId, "190", "2026-04-10"))
    }

    @Test
    fun fallsBackToTheLabelWhenTheConceptCodeIsMissing() {
        val earlier = row("알 수 없는 항목", "7", LocalDate.of(2026, 1, 15), januaryDocument, conceptCode = null)
        val other = row("다른 항목", "9", LocalDate.of(2026, 1, 15), januaryDocument, conceptCode = null)
        val latest = row("알 수 없는 항목", "8", LocalDate.of(2026, 7, 28), julyDocument, conceptCode = null)
        val documents = listOf(completed(januaryDocument, "2026-02-01T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val summary = ChangeSummaryProjection.project(listOf(earlier, other, latest), documents)

        assertThat(summary.items.single().previous).isEqualTo(ChangeValue(earlier.recordVersionId, "7", "2026-01-15"))
        assertThat(summary.items.single().conceptCode).isNull()
        assertThat(summary.unchangedCount).isEqualTo(1)
    }

    @Test
    fun leavesPreviousNullWhenTheUnitDiffersInsteadOfConverting() {
        val mmol = row("총콜레스테롤", "5.0", LocalDate.of(2026, 1, 15), januaryDocument, unit = "mmol/L")
        val mg = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument, unit = "mg/dL")
        val documents = listOf(completed(januaryDocument, "2026-02-01T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val summary = ChangeSummaryProjection.project(listOf(mmol, mg), documents)

        assertThat(summary.items.single().previous).isNull()
        assertThat(summary.newConcepts).containsExactly("총콜레스테롤")
        assertThat(summary.unchangedCount).isZero()
    }

    @Test
    fun listsNewConceptsAndCountsConceptsMissingFromTheLatestDocument() {
        val records = listOf(
            row("총콜레스테롤", "194", LocalDate.of(2026, 1, 15), januaryDocument),
            row("당화혈색소", "5.4", LocalDate.of(2026, 1, 15), januaryDocument, unit = "%", conceptCode = "hba1c"),
            row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument),
            row("비타민 D", "42", LocalDate.of(2026, 7, 28), julyDocument, unit = "ng/mL", conceptCode = "vitamin-d"),
        )
        val documents = listOf(completed(januaryDocument, "2026-02-01T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val summary = ChangeSummaryProjection.project(records, documents)

        assertThat(summary.items.map { it.concept to (it.previous?.value) })
            .containsExactly("비타민 D" to null, "총콜레스테롤" to "194")
        assertThat(summary.newConcepts).containsExactly("비타민 D")
        assertThat(summary.unchangedCount).isEqualTo(1)
    }

    @Test
    fun carriesNoInterpretationFields() {
        val itemFields = ChangeItem::class.java.declaredFields.map { it.name }
        val summaryFields = ChangeSummary::class.java.declaredFields.map { it.name }
        assertThat(itemFields + summaryFields)
            .doesNotContain("difference", "delta", "direction", "trend", "referenceRange", "flag", "normal", "abnormal", "risk")
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.ChangeSummaryProjectionTest"`
Expected: `BUILD FAILED` with a Kotlin compilation error `Unresolved reference: DocumentCompletionRow` (and `ChangeSummaryProjection`).

- [ ] **Step 3: Write the projection**

Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjection.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import java.time.Instant
import java.util.UUID

/** One document the server marked COMPLETED, with the instant it did so. */
data class DocumentCompletionRow(
    val documentId: UUID,
    val completedAt: Instant,
)

/** The document whose values are "this time". `observedOn` is the latest exam date among its current records. */
data class ChangeDocument(
    val documentId: UUID,
    val observedOn: String,
    val completedAt: Instant,
    val eventCount: Int,
)

/** One dated value exactly as confirmed. `eventId` is the CURRENT record version, as in HealthEvent. */
data class ChangeValue(
    val eventId: UUID,
    val value: String,
    val observedOn: String,
)

/**
 * This time's value beside the previous value of the same item. Two values and
 * nothing else: no difference, no direction, no range, no judgement.
 */
data class ChangeItem(
    val conceptCode: String?,
    val concept: String,
    val unit: String,
    val latest: ChangeValue,
    val previous: ChangeValue?,
)

data class ChangeSummary(
    val latestDocument: ChangeDocument?,
    val items: List<ChangeItem>,
    val newConcepts: List<String>,
    val unchangedCount: Int,
)

object ChangeSummaryProjection {
    val EMPTY = ChangeSummary(latestDocument = null, items = emptyList(), newConcepts = emptyList(), unchangedCount = 0)

    fun project(records: List<FoundationRecordRow>, documents: List<DocumentCompletionRow>): ChangeSummary {
        val current = records.filter { it.status == "CURRENT" }
        val documentIdsWithRecords = current.map { it.documentId }.toSet()
        val latestDocument = documents
            .filter { it.documentId in documentIdsWithRecords }
            .maxWithOrNull(compareBy<DocumentCompletionRow> { it.completedAt }.thenBy { it.documentId.toString() })
            ?: return EMPTY
        val latestRecords = current.filter { it.documentId == latestDocument.documentId }
        val otherRecords = current.filter { it.documentId != latestDocument.documentId }

        val items = latestRecords
            .sortedWith(compareBy<FoundationRecordRow> { it.label }.thenBy { it.confirmedAt })
            .map { record ->
                // The latest observation of the same concept in any other document. A different
                // unit is not converted: the item is shown alone and counted as new.
                val previous = otherRecords
                    .filter { conceptKey(it) == conceptKey(record) }
                    .maxWithOrNull(compareBy<FoundationRecordRow> { it.observedOn }.thenBy { it.confirmedAt })
                    ?.takeIf { it.unit == record.unit }
                ChangeItem(
                    conceptCode = record.conceptCode,
                    concept = record.label,
                    unit = record.unit,
                    latest = ChangeValue(record.recordVersionId, record.currentValue, record.observedOn.toString()),
                    previous = previous?.let { ChangeValue(it.recordVersionId, it.currentValue, it.observedOn.toString()) },
                )
            }
        val latestKeys = latestRecords.map(::conceptKey).toSet()
        val unchangedCount = otherRecords.map(::conceptKey).toSet().count { it !in latestKeys }

        return ChangeSummary(
            latestDocument = ChangeDocument(
                documentId = latestDocument.documentId,
                observedOn = latestRecords.maxOf { it.observedOn }.toString(),
                completedAt = latestDocument.completedAt,
                eventCount = latestRecords.size,
            ),
            items = items,
            newConcepts = items.filter { it.previous == null }.map { it.concept },
            unchangedCount = unchangedCount,
        )
    }

    /** Same concept code, or the same label when the label matched no catalogue entry. A key, not a meaning. */
    private fun conceptKey(record: FoundationRecordRow): String =
        record.conceptCode?.let { "code:$it" } ?: "label:${record.label}"
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.ChangeSummaryProjectionTest"`
Expected: `BUILD SUCCESSFUL`; 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjection.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjectionTest.kt && git commit -m "feat(core): pure ChangeSummaryProjection — latest document values beside the previous value of the same concept, no judgement

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Core — `GET /api/foundation/changes`

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt:1122-1134` (add after `listDocumentIdsWithPreview`)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt:475-480` (add after `listHealthEvents`)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt:316-320` (add after `listHealthEvents`)
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt` (add a test before `private fun importSyntheticDocument`)

**Interfaces:**
- Consumes: `ChangeSummaryProjection.project(records, documents)` and `DocumentCompletionRow` (Task 1); `repository.listRecords(subjectId)` (CURRENT rows); test helpers `login`, `grantConsent`, `importSyntheticDocument`, `confirmEveryCandidate`, `read`, `responseJson`.
- Produces: `FoundationRepository.listDocumentCompletions(subjectId: String): List<DocumentCompletionRow>`; `FoundationLifecycleService.getChangeSummary(principal): ChangeSummary`; `GET /api/foundation/changes` → `ChangeSummary` JSON with `Cache-Control: no-store` (Jackson `non_null` omits `latestDocument` and `previous` when null — Task 5's zod uses `.nullable().optional()`).

- [ ] **Step 1: Write the failing PostgreSQL test**

Insert into `FoundationLifecyclePostgresIntegrationTest.kt` immediately before `private fun importSyntheticDocument(`:

```kotlin
    @Test
    fun changesListTheLatestDocumentValuesBesideThePreviousValueOfTheSameConcept() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)

        read(get("/api/foundation/changes"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.latestDocument").doesNotExist())
            .andExpect(jsonPath("$.items.length()").value(0))
            .andExpect(jsonPath("$.newConcepts.length()").value(0))
            .andExpect(jsonPath("$.unchangedCount").value(0))

        val january = importSyntheticDocument(alice, consentId, januaryFixturePdf, januaryFixtureDigest, "changes-january")
        confirmEveryCandidate(alice, january, "changes-january")
        val firstOnly = responseJson(
            read(get("/api/foundation/changes"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )
        assertThat(firstOnly["latestDocument"]["documentId"].asText()).isEqualTo(january[0]["documentId"].asText())
        assertThat(firstOnly["latestDocument"]["observedOn"].asText()).isEqualTo("2026-01-15")
        assertThat(firstOnly["latestDocument"]["eventCount"].asInt()).isEqualTo(3)
        assertThat(firstOnly["items"].map { it.has("previous") }).containsExactly(false, false, false)
        assertThat(firstOnly["newConcepts"].map(JsonNode::asText)).containsExactlyInAnyOrder("총콜레스테롤", "당화혈색소", "비타민 D")

        val july = importSyntheticDocument(alice, consentId, fixturePdf, fixtureDigest, "changes-july")
        confirmEveryCandidate(alice, july, "changes-july")

        val summary = responseJson(
            read(get("/api/foundation/changes"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )
        assertThat(summary["latestDocument"]["documentId"].asText()).isEqualTo(july[0]["documentId"].asText())
        assertThat(summary["latestDocument"]["observedOn"].asText()).isEqualTo("2026-07-28")
        assertThat(summary["latestDocument"]["eventCount"].asInt()).isEqualTo(3)
        val byConcept = summary["items"].associateBy { it["concept"].asText() }
        assertThat(byConcept.keys).containsExactlyInAnyOrder("총콜레스테롤", "당화혈색소", "비타민 D")
        assertThat(byConcept.getValue("총콜레스테롤")["conceptCode"].asText()).isEqualTo("total-cholesterol")
        assertThat(byConcept.getValue("총콜레스테롤")["unit"].asText()).isEqualTo("mg/dL")
        assertThat(byConcept.getValue("총콜레스테롤")["latest"]["value"].asText()).isEqualTo("188")
        assertThat(byConcept.getValue("총콜레스테롤")["latest"]["observedOn"].asText()).isEqualTo("2026-07-28")
        assertThat(byConcept.getValue("총콜레스테롤")["previous"]["value"].asText()).isEqualTo("194")
        assertThat(byConcept.getValue("총콜레스테롤")["previous"]["observedOn"].asText()).isEqualTo("2026-01-15")
        assertThat(byConcept.getValue("당화혈색소")["previous"]["value"].asText()).isEqualTo("5.4")
        assertThat(byConcept.getValue("비타민 D")["previous"]["value"].asText()).isEqualTo("45")
        assertThat(summary["newConcepts"].size()).isZero()
        assertThat(summary["unchangedCount"].asInt()).isZero()
        assertThat(summary.toString()).doesNotContain("referenceRange", "difference", "direction", "trend")

        val bob = login("synthetic-bob")
        read(get("/api/foundation/changes"), bob)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.latestDocument").doesNotExist())
            .andExpect(jsonPath("$.items.length()").value(0))

        mockMvc.perform(get("/api/foundation/changes")).andExpect(status().isUnauthorized)
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest"`
Expected: `BUILD FAILED`; `changesListTheLatestDocumentValuesBesideThePreviousValueOfTheSameConcept() FAILED` at the first `status().isOk` (the unmapped path returns 404 through the foundation filter chain). Every other test in the class still passes.

- [ ] **Step 3: Add the repository query**

In `FoundationRepository.kt`, after `listDocumentIdsWithPreview` (ends at line 1134), add:

```kotlin
    /** Documents of this owner that the server has marked COMPLETED (a completion instant exists). */
    fun listDocumentCompletions(subjectId: String): List<DocumentCompletionRow> =
        jdbc.query(
            """
            SELECT document_id, completed_at
            FROM gc_document
            WHERE subject_id = ? AND completed_at IS NOT NULL
            """.trimIndent(),
            RowMapper { result, _ ->
                DocumentCompletionRow(
                    documentId = result.getObject("document_id", UUID::class.java),
                    completedAt = result.getObject("completed_at", OffsetDateTime::class.java).toInstant(),
                )
            },
            subjectId,
        )
```

- [ ] **Step 4: Add the service method and the endpoint**

In `FoundationLifecycleService.kt`, after `listHealthEvents` (line 480), add:

```kotlin
    @Transactional(readOnly = true)
    fun getChangeSummary(principal: FoundationPrincipal): ChangeSummary =
        ChangeSummaryProjection.project(
            repository.listRecords(principal.subjectId),
            repository.listDocumentCompletions(principal.subjectId),
        )
```

In `FoundationLifecycleController.kt`, after `listHealthEvents` (line 320), add:

```kotlin
    @GetMapping("/changes")
    fun getChanges(request: HttpServletRequest): ResponseEntity<ChangeSummary> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.getChangeSummary(request.foundationPrincipal()))
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest"`
Expected: `BUILD SUCCESSFUL`; the new test and all existing tests in the class pass.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt && git commit -m "feat(core): GET /api/foundation/changes — owner-isolated what-changed summary over CURRENT records

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Core — V9 consent purposes, `GET /consents`, `POST /consents/{purposeCode}`, purpose-coded audit

**Files:**
- Create: `apps/core-api/src/main/resources/db/migration/V9__consent_purposes.sql`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ConsentPurpose.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt:32-35,326-370,399-405,1350-1399`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt:32-35,182-198,536-548,700-738`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt:47-51,156-170,350-359`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `gc_consent_grant` (V1 lines 21-39), `gc_audit_event` (V1 lines 131-146), `gc_idempotency`; `requireIdempotencyKey`, `subjectHash`, `audit` in the service.
- Produces: `object ConsentPurpose { DOCUMENT_EXTRACTION, RESEARCH_USE, RESEARCH_CONTACT, PROJECT_PREFIX = "PROJECT:", FIXED_ORDER, isValid(code), policyVersion(code) }`; `FoundationConsentRow(consentId, purposeCode, status, policyVersion, grantedAt, revokedAt)`; repository `grantConsent(consentId, subjectId, purposeCode, policyVersion, now)`, `findActiveConsent(subjectId, purposeCode): UUID?`, `findLatestConsent(subjectId, purposeCode)`, `listLatestConsents(subjectId)`, `findConsent(subjectId, consentId)`, `insertAudit(..., purposeCode: String? = null)`; service `data class ConsentReceipt(consentId: UUID?, purposeCode: String, status: String, policyVersion: String, grantedAt: Instant?, revokedAt: Instant?)`, `grantConsent(principal, purposeCode, idempotencyKey: String?): ConsentReceipt`, `listConsents(principal): List<ConsentReceipt>`, `revokeConsent(principal, consentId): ConsentReceipt`; endpoints `GET /api/foundation/consents` → `List<ConsentReceipt>` (fixed order DOCUMENT_EXTRACTION, RESEARCH_USE, RESEARCH_CONTACT, then existing `PROJECT:*` sorted), `POST /api/foundation/consents/{purposeCode}` with `Idempotency-Key` → 201 `ConsentReceipt`, 400 `consent_purpose_invalid`; `POST /consents/{consentId}/revocation` now returns the real `purposeCode`. The existing `GET/POST /consents/document-extraction` and their `ConsentResponse` shape do not change. `findConsentStatus`/`isConsentActive` keep their `purpose_code = 'DOCUMENT_EXTRACTION'` filter — that is the mechanism that makes research consent unable to gate or open anything. Task 6 mirrors `ConsentReceipt` in zod.

- [ ] **Step 1: Write the failing PostgreSQL test**

Insert into `FoundationLifecyclePostgresIntegrationTest.kt` immediately before `private fun importSyntheticDocument(`:

```kotlin
    @Test
    fun researchConsentsAreStoredPerPurposeAndNeverGateTheLifecycle() {
        val alice = login("synthetic-alice")
        val bob = login("synthetic-bob")

        val initial = responseJson(
            read(get("/api/foundation/consents"), alice)
                .andExpect(status().isOk)
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().response.contentAsByteArray,
        )
        assertThat(initial.map { it["purposeCode"].asText() }).containsExactly("DOCUMENT_EXTRACTION", "RESEARCH_USE", "RESEARCH_CONTACT")
        assertThat(initial.map { it["status"].asText() }).containsExactly("NOT_GRANTED", "NOT_GRANTED", "NOT_GRANTED")
        assertThat(initial.map { it["policyVersion"].asText() })
            .containsExactly("foundation-v1", "research-consent-policy.v1", "research-contact-policy.v1")
        assertThat(initial.map { it.has("consentId") }).containsExactly(false, false, false)

        val researchUse = responseJson(
            mutate(post("/api/foundation/consents/RESEARCH_USE").header("Idempotency-Key", "research-use-grant-1"), alice)
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.purposeCode").value("RESEARCH_USE"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.policyVersion").value("research-consent-policy.v1"))
                .andExpect(jsonPath("$.grantedAt").isNotEmpty)
                .andExpect(jsonPath("$.revokedAt").doesNotExist())
                .andReturn().response.contentAsByteArray,
        )
        val researchUseId = UUID.fromString(researchUse["consentId"].asText())
        mutate(post("/api/foundation/consents/RESEARCH_USE").header("Idempotency-Key", "research-use-grant-1"), alice)
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.consentId").value(researchUseId.toString()))
        mutate(post("/api/foundation/consents/RESEARCH_USE").header("Idempotency-Key", "research-use-grant-2"), alice)
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.consentId").value(researchUseId.toString()))
        assertThat(countForSubject("gc_consent_grant", "synthetic-alice")).isEqualTo(1)

        // A research consent is not a document consent: it cannot open the lifecycle.
        mutate(
            post("/api/foundation/documents")
                .header("Idempotency-Key", "doc-with-research-consent")
                .contentType(MediaType.APPLICATION_JSON)
                .content(documentRequest(researchUseId, fixturePdf)),
            alice,
        ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("active_consent_required"))

        // The whole lifecycle runs while the other research purpose is absent and this one is later revoked.
        val documentConsentId = grantConsent(alice)
        val candidates = importSyntheticDocument(alice, documentConsentId, fixturePdf, fixtureDigest, "research-invariant")
        confirmEveryCandidate(alice, candidates, "research-invariant")
        read(get("/api/foundation/records"), alice).andExpect(status().isOk).andExpect(jsonPath("$.length()").value(3))

        mutate(post("/api/foundation/consents/$researchUseId/revocation"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.purposeCode").value("RESEARCH_USE"))
            .andExpect(jsonPath("$.status").value("REVOKED"))
        val afterRevoke = responseJson(
            read(get("/api/foundation/consents"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )
        assertThat(afterRevoke.map { "${it["purposeCode"].asText()}=${it["status"].asText()}" })
            .containsExactly("DOCUMENT_EXTRACTION=ACTIVE", "RESEARCH_USE=REVOKED", "RESEARCH_CONTACT=NOT_GRANTED")
        assertThat(afterRevoke[1]["revokedAt"].asText()).isNotEmpty()
        assertThat(afterRevoke[0]["consentId"].asText()).isEqualTo(documentConsentId.toString())
        read(get("/api/foundation/documents/${candidates[0]["documentId"].asText()}/candidates"), alice)
            .andExpect(status().isOk)
        read(get("/api/foundation/health-events"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(3))
        read(get("/api/foundation/changes"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.latestDocument.eventCount").value(3))

        // PROJECT purposes: the prefix and shape are validated; a granted one is listed after the fixed three.
        mutate(post("/api/foundation/consents/STUDY-1").header("Idempotency-Key", "project-no-prefix"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("consent_purpose_invalid"))
        mutate(post("/api/foundation/consents/PROJECT:Demo_Study").header("Idempotency-Key", "project-bad-shape"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("consent_purpose_invalid"))
        mutate(post("/api/foundation/consents/PROJECT:${"a".repeat(41)}").header("Idempotency-Key", "project-too-long"), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("consent_purpose_invalid"))
        mutate(post("/api/foundation/consents/PROJECT:demo-study-1").header("Idempotency-Key", "project-grant-1"), alice)
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.purposeCode").value("PROJECT:demo-study-1"))
            .andExpect(jsonPath("$.policyVersion").value("project-consent-policy.v1"))
        val withProject = responseJson(
            read(get("/api/foundation/consents"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )
        assertThat(withProject.map { it["purposeCode"].asText() })
            .containsExactly("DOCUMENT_EXTRACTION", "RESEARCH_USE", "RESEARCH_CONTACT", "PROJECT:demo-study-1")

        // Owner isolation: bob neither sees nor revokes alice's consents.
        val bobList = responseJson(
            read(get("/api/foundation/consents"), bob).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )
        assertThat(bobList.map { it["status"].asText() }).containsExactly("NOT_GRANTED", "NOT_GRANTED", "NOT_GRANTED")
        mutate(post("/api/foundation/consents/$researchUseId/revocation"), bob)
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("consent_not_found"))
        mockMvc.perform(get("/api/foundation/consents")).andExpect(status().isUnauthorized)

        // Audit rows name the purpose and nothing else.
        assertThat(
            jdbc.queryForList(
                "SELECT purpose_code FROM gc_audit_event WHERE event_type = 'CONSENT_GRANTED' ORDER BY audit_sequence",
                String::class.java,
            ),
        ).containsExactly("RESEARCH_USE", "DOCUMENT_EXTRACTION", "PROJECT:demo-study-1")
        assertThat(
            jdbc.queryForList("SELECT purpose_code FROM gc_audit_event WHERE event_type = 'CONSENT_REVOKED'", String::class.java),
        ).containsExactly("RESEARCH_USE")
        assertThat(
            jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM gc_audit_event
                WHERE event_type LIKE '%policy%' OR resource_type LIKE '%policy%' OR purpose_code LIKE '%policy%'
                   OR event_type LIKE '%188%' OR resource_type LIKE '%mg/dL%'
                """.trimIndent(),
                Long::class.java,
            ),
        ).isZero()

        // Deletion removes every purpose row; nothing research-related was ever a condition.
        mutate(delete("/api/foundation/profile"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("COMPLETED"))
            .andExpect(jsonPath("$.rawHealthValuesPresentInAudit").value(false))
        assertThat(countForSubject("gc_consent_grant", "synthetic-alice")).isZero()
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest"`
Expected: `BUILD FAILED`; `researchConsentsAreStoredPerPurposeAndNeverGateTheLifecycle() FAILED` at the first `status().isOk` on `GET /api/foundation/consents` (unmapped → 404).

- [ ] **Step 3: Write V9 and `ConsentPurpose`**

Create `apps/core-api/src/main/resources/db/migration/V9__consent_purposes.sql`:

```sql
-- Wave 2C: consent is stored per purpose. The research and project purposes are recorded so the
-- person can see and withdraw them; nothing in the document lifecycle reads them. One ACTIVE row
-- per (subject, purpose) is still enforced by gc_consent_one_active_purpose_idx. Audit rows may
-- carry the purpose code and nothing else (no value, no date, no policy text).
ALTER TABLE gc_consent_grant DROP CONSTRAINT gc_consent_purpose;
ALTER TABLE gc_consent_grant
    ADD CONSTRAINT gc_consent_purpose CHECK (
        purpose_code ~ '^(DOCUMENT_EXTRACTION|RESEARCH_USE|RESEARCH_CONTACT|PROJECT:[a-z0-9-]{1,40})$'
    );

ALTER TABLE gc_audit_event
    ADD COLUMN purpose_code VARCHAR(48),
    ADD CONSTRAINT gc_audit_purpose_shape CHECK (
        purpose_code IS NULL
        OR purpose_code ~ '^(DOCUMENT_EXTRACTION|RESEARCH_USE|RESEARCH_CONTACT|PROJECT:[a-z0-9-]{1,40})$'
    );
```

Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ConsentPurpose.kt`:

```kotlin
package kr.co.genomecompanion.foundation

/**
 * The purposes a person can consent to, one row each in gc_consent_grant.
 *
 * Only DOCUMENT_EXTRACTION is ever read by the lifecycle (see FoundationRepository.findConsentStatus).
 * RESEARCH_USE, RESEARCH_CONTACT and PROJECT:* are stored so the person can see and withdraw them;
 * no server behaviour depends on them. There is no research pipeline and no contact channel.
 */
object ConsentPurpose {
    const val DOCUMENT_EXTRACTION = "DOCUMENT_EXTRACTION"
    const val RESEARCH_USE = "RESEARCH_USE"
    const val RESEARCH_CONTACT = "RESEARCH_CONTACT"
    const val PROJECT_PREFIX = "PROJECT:"

    /** The fixed purposes in the order the list endpoint reports them. PROJECT purposes follow, sorted. */
    val FIXED_ORDER: List<String> = listOf(DOCUMENT_EXTRACTION, RESEARCH_USE, RESEARCH_CONTACT)

    private val pattern = Regex("^(DOCUMENT_EXTRACTION|RESEARCH_USE|RESEARCH_CONTACT|PROJECT:[a-z0-9-]{1,40})$")

    fun isValid(purposeCode: String): Boolean = pattern.matches(purposeCode)

    fun policyVersion(purposeCode: String): String = when {
        purposeCode == DOCUMENT_EXTRACTION -> "foundation-v1"
        purposeCode == RESEARCH_USE -> "research-consent-policy.v1"
        purposeCode == RESEARCH_CONTACT -> "research-contact-policy.v1"
        isValid(purposeCode) && purposeCode.startsWith(PROJECT_PREFIX) -> "project-consent-policy.v1"
        else -> throw FoundationBadRequestException("consent_purpose_invalid")
    }
}
```

- [ ] **Step 4: Update the repository**

In `FoundationRepository.kt` replace `FoundationConsentRow` (lines 32-35) with:

```kotlin
data class FoundationConsentRow(
    val consentId: UUID,
    val purposeCode: String,
    val status: String,
    val policyVersion: String,
    val grantedAt: Instant,
    val revokedAt: Instant?,
)
```

Inside the class, after `private val sessionMapper = RowMapper { ... }` (ends line 145), add:

```kotlin
    private val consentMapper = RowMapper { result, _ ->
        FoundationConsentRow(
            consentId = result.getObject("consent_id", UUID::class.java),
            purposeCode = result.getString("purpose_code"),
            status = result.getString("status"),
            policyVersion = result.getString("policy_version"),
            grantedAt = result.getObject("granted_at", OffsetDateTime::class.java).toInstant(),
            revokedAt = result.getObject("revoked_at", OffsetDateTime::class.java)?.toInstant(),
        )
    }
```

Replace `grantConsent`, `findActiveConsent` and `findLatestConsent` (lines 326-370) with:

```kotlin
    fun grantConsent(consentId: UUID, subjectId: String, purposeCode: String, policyVersion: String, now: Instant) {
        jdbc.update(
            """
            INSERT INTO gc_consent_grant(
                consent_id, subject_id, purpose_code, status, policy_version, granted_at
            ) VALUES (?, ?, ?, 'ACTIVE', ?, ?)
            """.trimIndent(),
            consentId,
            subjectId,
            purposeCode,
            policyVersion,
            now.atOffset(ZoneOffset.UTC),
        )
    }

    fun findActiveConsent(subjectId: String, purposeCode: String): UUID? =
        jdbc.query(
            """
            SELECT consent_id
            FROM gc_consent_grant
            WHERE subject_id = ? AND purpose_code = ? AND status = 'ACTIVE'
            """.trimIndent(),
            RowMapper { result, _ -> result.getObject("consent_id", UUID::class.java) },
            subjectId,
            purposeCode,
        ).firstOrNull()

    private val consentProjection =
        "SELECT consent_id, purpose_code, status, policy_version, granted_at, revoked_at FROM gc_consent_grant"

    fun findLatestConsent(subjectId: String, purposeCode: String): FoundationConsentRow? =
        jdbc.query(
            """
            $consentProjection
            WHERE subject_id = ? AND purpose_code = ?
            ORDER BY granted_at DESC, consent_id DESC
            LIMIT 1
            """.trimIndent(),
            consentMapper,
            subjectId,
            purposeCode,
        ).firstOrNull()

    /** The most recent row of every purpose this owner ever consented to. */
    fun listLatestConsents(subjectId: String): List<FoundationConsentRow> =
        jdbc.query(
            """
            SELECT DISTINCT ON (purpose_code)
                   consent_id, purpose_code, status, policy_version, granted_at, revoked_at
            FROM gc_consent_grant
            WHERE subject_id = ?
            ORDER BY purpose_code, granted_at DESC, consent_id DESC
            """.trimIndent(),
            consentMapper,
            subjectId,
        )

    fun findConsent(subjectId: String, consentId: UUID): FoundationConsentRow? =
        jdbc.query(
            "$consentProjection WHERE subject_id = ? AND consent_id = ?",
            consentMapper,
            subjectId,
            consentId,
        ).firstOrNull()
```

Add this comment line directly above `fun findConsentStatus(` (line 372) and leave `findConsentStatus` and `isConsentActive` otherwise unchanged:

```kotlin
    /** Document intake and review read only the DOCUMENT_EXTRACTION purpose. A research or project
     * consent id therefore resolves to null here and is refused as `active_consent_required`. */
```

Delete `consentBelongsToSubject` (lines 399-405); Task 3 Step 5 replaces its only caller.

Replace `insertAudit`, `insertDeniedAudit` and `doInsertAudit` (lines 1350-1399) with:

```kotlin
    fun insertAudit(
        subjectHash: String,
        actorSessionHash: String?,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
        now: Instant,
        purposeCode: String? = null,
    ) {
        doInsertAudit(subjectHash, actorSessionHash, eventType, resourceType, resourceId, outcome, now, purposeCode)
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun insertDeniedAudit(
        subjectHash: String,
        actorSessionHash: String?,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        now: Instant,
    ) {
        doInsertAudit(subjectHash, actorSessionHash, eventType, resourceType, resourceId, "DENIED", now, null)
    }

    private fun doInsertAudit(
        subjectHash: String,
        actorSessionHash: String?,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
        now: Instant,
        purposeCode: String?,
    ) {
        jdbc.update(
            """
            INSERT INTO gc_audit_event(
                event_id, subject_hash, actor_session_hash, event_type, resource_type,
                resource_id, outcome, occurred_at, purpose_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            UUID.randomUUID(),
            subjectHash,
            actorSessionHash,
            eventType,
            resourceType,
            resourceId,
            outcome,
            now.atOffset(ZoneOffset.UTC),
            purposeCode,
        )
    }
```

- [ ] **Step 5: Update the service**

In `FoundationLifecycleService.kt` add after `DocumentConsentReceipt` (line 35):

```kotlin
/** One purpose as the person sees it. NOT_GRANTED rows have no id and no instants. */
data class ConsentReceipt(
    val consentId: UUID?,
    val purposeCode: String,
    val status: String,
    val policyVersion: String,
    val grantedAt: Instant?,
    val revokedAt: Instant?,
)
```

Replace `grantDocumentConsent` and `getDocumentConsent` (lines 182-198) with:

```kotlin
    @Transactional
    fun grantDocumentConsent(principal: FoundationPrincipal): UUID =
        checkNotNull(grantConsent(principal, ConsentPurpose.DOCUMENT_EXTRACTION, idempotencyKey = null).consentId)

    @Transactional(readOnly = true)
    fun getDocumentConsent(principal: FoundationPrincipal): DocumentConsentReceipt {
        val consent = repository.findLatestConsent(principal.subjectId, ConsentPurpose.DOCUMENT_EXTRACTION)
        return DocumentConsentReceipt(
            consentId = consent?.consentId,
            status = consent?.status ?: "NOT_GRANTED",
        )
    }

    /**
     * Grants one purpose. An ACTIVE row for the same purpose is returned as-is (no second row, no second
     * audit); a replayed Idempotency-Key returns the row it created even after revocation.
     */
    @Transactional
    fun grantConsent(principal: FoundationPrincipal, purposeCode: String, idempotencyKey: String?): ConsentReceipt {
        if (!ConsentPurpose.isValid(purposeCode)) throw FoundationBadRequestException("consent_purpose_invalid")
        idempotencyKey?.let(::requireIdempotencyKey)
        val subjectHash = subjectHash(principal.subjectId)
        if (idempotencyKey != null) {
            repository.findIdempotentResource(subjectHash, "CONSENT_GRANT", idempotencyKey)?.let { existingId ->
                return consentReceipt(
                    repository.findConsent(principal.subjectId, existingId)
                        ?: throw FoundationConflictException("idempotency_resource_missing"),
                )
            }
        }
        repository.findActiveConsent(principal.subjectId, purposeCode)?.let { activeId ->
            return consentReceipt(checkNotNull(repository.findConsent(principal.subjectId, activeId)))
        }
        val consentId = UUID.randomUUID()
        val now = Instant.now(clock)
        if (idempotencyKey != null &&
            !repository.insertIdempotency(subjectHash, "CONSENT_GRANT", idempotencyKey, consentId, now)
        ) {
            val concurrentId = repository.findIdempotentResource(subjectHash, "CONSENT_GRANT", idempotencyKey)
                ?: throw FoundationConflictException("idempotency_conflict")
            return consentReceipt(
                repository.findConsent(principal.subjectId, concurrentId)
                    ?: throw FoundationConflictException("idempotency_resource_missing"),
            )
        }
        repository.grantConsent(consentId, principal.subjectId, purposeCode, ConsentPurpose.policyVersion(purposeCode), now)
        audit(principal, "CONSENT_GRANTED", "CONSENT", consentId, "SUCCESS", purposeCode)
        return consentReceipt(checkNotNull(repository.findConsent(principal.subjectId, consentId)))
    }

    /** The three fixed purposes in fixed order (NOT_GRANTED when absent), then every PROJECT purpose that exists. */
    @Transactional(readOnly = true)
    fun listConsents(principal: FoundationPrincipal): List<ConsentReceipt> {
        val latest = repository.listLatestConsents(principal.subjectId).associateBy { it.purposeCode }
        val fixed = ConsentPurpose.FIXED_ORDER.map { purposeCode ->
            latest[purposeCode]?.let(::consentReceipt) ?: ConsentReceipt(
                consentId = null,
                purposeCode = purposeCode,
                status = "NOT_GRANTED",
                policyVersion = ConsentPurpose.policyVersion(purposeCode),
                grantedAt = null,
                revokedAt = null,
            )
        }
        val projects = latest.keys
            .filter { it.startsWith(ConsentPurpose.PROJECT_PREFIX) }
            .sorted()
            .map { consentReceipt(latest.getValue(it)) }
        return fixed + projects
    }

    private fun consentReceipt(row: FoundationConsentRow): ConsentReceipt =
        ConsentReceipt(
            consentId = row.consentId,
            purposeCode = row.purposeCode,
            status = row.status,
            policyVersion = row.policyVersion,
            grantedAt = row.grantedAt,
            revokedAt = row.revokedAt,
        )
```

Replace `revokeConsent` (lines 536-548) with:

```kotlin
    @Transactional
    fun revokeConsent(principal: FoundationPrincipal, consentId: UUID): ConsentReceipt {
        val consent = repository.findConsent(principal.subjectId, consentId)
        if (consent == null) {
            audit(principal, "CONSENT_ACCESS_DENIED", "CONSENT", consentId, "DENIED")
            throw FoundationNotFoundException("consent_not_found")
        }
        val now = Instant.now(clock)
        if (repository.revokeConsent(principal.subjectId, consentId, now)) {
            // No document ever references a research or project consent, so this is a no-op for them.
            repository.terminateDocumentJobsForRevokedConsent(principal.subjectId, consentId, now)
            audit(principal, "CONSENT_REVOKED", "CONSENT", consentId, "SUCCESS", consent.purposeCode)
        }
        return consentReceipt(checkNotNull(repository.findConsent(principal.subjectId, consentId)))
    }
```

Replace the two private `audit` functions (lines 700-738) with:

```kotlin
    private fun audit(
        principal: FoundationPrincipal,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
        purposeCode: String? = null,
    ) {
        audit(principal.subjectId, principal.sessionTokenHash, eventType, resourceType, resourceId, outcome, purposeCode)
    }

    private fun audit(
        subjectId: String,
        sessionHash: String?,
        eventType: String,
        resourceType: String,
        resourceId: UUID?,
        outcome: String,
        purposeCode: String? = null,
    ) {
        if (outcome == "DENIED") {
            repository.insertDeniedAudit(
                subjectHash(subjectId),
                sessionHash,
                eventType,
                resourceType,
                resourceId,
                Instant.now(clock),
            )
        } else {
            repository.insertAudit(
                subjectHash(subjectId),
                sessionHash,
                eventType,
                resourceType,
                resourceId,
                outcome,
                Instant.now(clock),
                purposeCode,
            )
        }
    }
```

- [ ] **Step 6: Update the controller**

In `FoundationLifecycleController.kt`, replace `revokeConsent` (lines 350-359) with:

```kotlin
    @PostMapping("/consents/{consentId}/revocation")
    fun revokeConsent(
        request: HttpServletRequest,
        @PathVariable consentId: UUID,
    ): ResponseEntity<ConsentResponse> {
        val revoked = service.revokeConsent(request.foundationPrincipal(), consentId)
        return ResponseEntity.ok()
            .cacheControlNoStore()
            .body(ConsentResponse(consentId = consentId, purposeCode = revoked.purposeCode, status = "REVOKED"))
    }
```

After `grantDocumentConsent` (line 170) add:

```kotlin
    @GetMapping("/consents")
    fun listConsents(request: HttpServletRequest): ResponseEntity<List<ConsentReceipt>> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.listConsents(request.foundationPrincipal()))

    /** The literal `/consents/document-extraction` mapping above wins over this variable for that path. */
    @PostMapping("/consents/{purposeCode}")
    fun grantConsent(
        request: HttpServletRequest,
        @PathVariable purposeCode: String,
        @RequestHeader("Idempotency-Key") idempotencyKey: String,
    ): ResponseEntity<ConsentReceipt> =
        ResponseEntity.status(HttpStatus.CREATED)
            .cacheControlNoStore()
            .body(service.grantConsent(request.foundationPrincipal(), purposeCode, idempotencyKey))
```

- [ ] **Step 7: Run the whole core test task to verify it passes**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon`
Expected: `BUILD SUCCESSFUL`; Flyway applies V9 on the test database; `researchConsentsAreStoredPerPurposeAndNeverGateTheLifecycle` passes; every existing test passes (in particular `persistsAttacksRevokesAndDeletesOneSyntheticLifecycle`, whose `auditEventTypes` still contain `CONSENT_REVOKED`, and `demoBootstrapIsOriginBoundOwnerIsolatedAndDoesNotGrantConsent`). If the run reports `Unresolved reference: consentBelongsToSubject`, a caller was missed — the only caller was `revokeConsent`.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/core-api/src/main/resources/db/migration/V9__consent_purposes.sql apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ConsentPurpose.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt && git commit -m "feat(core): V9 consent purposes — per-purpose grant/list/revoke; research consent stored only and never a lifecycle condition

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Core — `GET /api/foundation/health-events/export`

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt` (imports; after `DeletionReceipt`; after `getChangeSummary`)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt` (after `getChanges`)
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `listHealthEvents(principal)` (`HealthEvent`, `HealthEventSource.documentId`), `requireDocument`, `repository.findExtractionAbstentions(subjectId, documentId)`, `ExtractionAbstention` (`DocumentWorkerBoundary.kt:141`), `audit`, `clock`, `seoul`.
- Produces: `data class ExportedDocument(documentId: UUID, observedOn: String?, status: String, abstentions: List<ExtractionAbstention>)`; `data class HealthEventExport(schemaVersion = "alm-health-events-export.v1", exportedAt: Instant, subjectKind = "synthetic", events: List<HealthEvent>, documents: List<ExportedDocument>)`; `exportHealthEvents(principal): HealthEventExport`; `exportFilename(): String` = `alm-health-events-<yyyyMMdd Asia/Seoul>.json`; endpoint `GET /api/foundation/health-events/export`. Task 7 links to it; Task 8 checks the headers in the browser.

- [ ] **Step 1: Write the failing PostgreSQL test**

Insert into `FoundationLifecyclePostgresIntegrationTest.kt` immediately before `private fun importSyntheticDocument(`:

```kotlin
    @Test
    fun exportsTheOwnersHealthEventsAsAJsonAttachmentWithoutRangesAndAuditsNoValue() {
        mockMvc.perform(get("/api/foundation/health-events/export")).andExpect(status().isUnauthorized)
        val alice = login("synthetic-alice")
        val bob = login("synthetic-bob")

        val empty = read(get("/api/foundation/health-events/export"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.schemaVersion").value("alm-health-events-export.v1"))
            .andExpect(jsonPath("$.events.length()").value(0))
            .andExpect(jsonPath("$.documents.length()").value(0))
            .andReturn().response
        assertThat(empty.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .matches("attachment; filename=\"alm-health-events-\\d{8}\\.json\"")

        val consentId = grantConsent(alice)
        val candidates = importSyntheticDocument(alice, consentId, fixturePdf, fixtureDigest, "export")
        confirmEveryCandidate(alice, candidates, "export")
        val documentId = candidates[0]["documentId"].asText()

        val response = read(get("/api/foundation/health-events/export"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(jsonPath("$.schemaVersion").value("alm-health-events-export.v1"))
            .andExpect(jsonPath("$.subjectKind").value("synthetic"))
            .andExpect(jsonPath("$.exportedAt").isNotEmpty)
            .andExpect(jsonPath("$.events.length()").value(3))
            .andExpect(jsonPath("$.events[0].source.documentId").value(documentId))
            .andExpect(jsonPath("$.documents.length()").value(1))
            .andExpect(jsonPath("$.documents[0].documentId").value(documentId))
            .andExpect(jsonPath("$.documents[0].observedOn").value("2026-07-28"))
            .andExpect(jsonPath("$.documents[0].status").value("COMPLETED"))
            .andExpect(jsonPath("$.documents[0].abstentions.length()").value(0))
            .andReturn().response
        assertThat(response.contentType).startsWith("application/json")
        assertThat(response.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .matches("attachment; filename=\"alm-health-events-\\d{8}\\.json\"")
        assertThat(response.contentAsString).doesNotContain("referenceRange", "trend", "direction", "normal", "risk")
        assertThat(responseJson(response.contentAsByteArray)["events"].map { it["value"].asText() })
            .containsExactlyInAnyOrder("188", "5.2", "42")

        read(get("/api/foundation/health-events/export"), bob)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.events.length()").value(0))
            .andExpect(jsonPath("$.documents.length()").value(0))

        assertThat(
            jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM gc_audit_event
                WHERE event_type = 'HEALTH_EVENTS_EXPORTED' AND resource_type = 'EXPORT'
                  AND resource_id IS NULL AND purpose_code IS NULL AND outcome = 'SUCCESS'
                """.trimIndent(),
                Long::class.java,
            ),
        ).isEqualTo(3L)
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM gc_audit_event WHERE event_type LIKE '%188%' OR resource_type LIKE '%mg/dL%' OR event_type LIKE '%3%'",
                Long::class.java,
            ),
        ).isZero()
    }
```

Also, in `researchConsentsAreStoredPerPurposeAndNeverGateTheLifecycle` (Task 3), directly after the `read(get("/api/foundation/changes"), alice)` block, add the export step so the invariant covers 부트스트랩→업로드→검토→기록→export→삭제:

```kotlin
        read(get("/api/foundation/health-events/export"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.events.length()").value(3))
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest"`
Expected: `BUILD FAILED`; `exportsTheOwnersHealthEventsAsAJsonAttachmentWithoutRangesAndAuditsNoValue() FAILED` and `researchConsentsAreStoredPerPurposeAndNeverGateTheLifecycle() FAILED`, both at `status().isOk` on the export path (404 today).

- [ ] **Step 3: Add the export to the service**

In `FoundationLifecycleService.kt` add the import `import java.time.format.DateTimeFormatter` next to the other `java.time` imports. After `DeletionReceipt` (line 106) add:

```kotlin
/** One source document of the export: id, exam date when all its events share one, status and abstentions. */
data class ExportedDocument(
    val documentId: UUID,
    val observedOn: String?,
    val status: String,
    val abstentions: List<ExtractionAbstention>,
)

/** The person's own events as one file. Same read-model as GET /health-events; no range, no judgement. */
data class HealthEventExport(
    val schemaVersion: String = "alm-health-events-export.v1",
    val exportedAt: Instant,
    val subjectKind: String = "synthetic",
    val events: List<HealthEvent>,
    val documents: List<ExportedDocument>,
)
```

After `getChangeSummary` add:

```kotlin
    @Transactional
    fun exportHealthEvents(principal: FoundationPrincipal): HealthEventExport {
        val events = listHealthEvents(principal)
        val documents = events
            .map { it.source.documentId }
            .distinct()
            .sortedBy { it.toString() }
            .map { documentId ->
                val document = requireDocument(principal, documentId)
                val dates = events.filter { it.source.documentId == documentId }.map { it.observedOn }.distinct()
                ExportedDocument(
                    documentId = documentId,
                    observedOn = dates.singleOrNull(),
                    status = document.status,
                    abstentions = repository.findExtractionAbstentions(principal.subjectId, documentId),
                )
            }
        // The audit row says that an export happened. It carries no count, no value and no date.
        audit(principal, "HEALTH_EVENTS_EXPORTED", "EXPORT", null, "SUCCESS")
        return HealthEventExport(exportedAt = Instant.now(clock), events = events, documents = documents)
    }

    fun exportFilename(): String =
        "alm-health-events-${LocalDate.ofInstant(Instant.now(clock), seoul).format(DateTimeFormatter.BASIC_ISO_DATE)}.json"
```

- [ ] **Step 4: Add the endpoint**

In `FoundationLifecycleController.kt`, after `getChanges` add:

```kotlin
    @GetMapping("/health-events/export", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun exportHealthEvents(request: HttpServletRequest): ResponseEntity<HealthEventExport> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"${service.exportFilename()}\"")
            .body(service.exportHealthEvents(request.foundationPrincipal()))
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon`
Expected: `BUILD SUCCESSFUL`; both tests pass; no other test changes.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt && git commit -m "feat(core): GET /api/foundation/health-events/export — owner's events and documents as a JSON attachment, audited without values

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Web — `getChanges()` and the "최근 변화" home section

**Files:**
- Modify: `apps/web/lib/foundation/client.ts:135-178,419`
- Create: `apps/web/components/integrated/RecentChanges.tsx`
- Modify: `apps/web/components/integrated/IntegratedHealthExperience.tsx:6-15,80-120,596-605`
- Create: `apps/web/tests/recent-changes.test.tsx`
- Modify: `apps/web/tests/foundation-client.test.ts`, `apps/web/tests/integrated-review-loop.test.tsx:13-85`, `apps/web/tests/korean-ux-copy.test.ts:6-30,122-126`

**Interfaces:**
- Consumes: `GET /api/foundation/changes` JSON from Task 2 (`latestDocument` and `previous` omitted when null); `formatKoreanDate` (`lib/format/korean-date.ts`); CSS classes `gc-health-home__overview`, `gc-health-home__section-heading`, `gc-records-comparison__note`, `gc-review-saved` (all exist in `apps/web/app/globals.css`).
- Produces: `changeSummarySchema` (strict), `export type ChangeSummary`, `export type ChangeItem`, `client.getChanges(): Promise<ChangeSummary>`; `RecentChanges({ changes }: { changes: ChangeSummary })` renders `null` when there is no `latestDocument` or no items; each item is `<li data-testid="change-item">` with the exact text `"{concept} · 이번 {YYYY. M. D.} {value} {unit} · 이전 {YYYY. M. D.} {value} {unit}"` or `"{concept} · 이번 … · 이전 값 없음"`. Task 8 asserts those strings in the browser.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/recent-changes.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { RecentChanges } from "@/components/integrated/RecentChanges";
import type { ChangeSummary } from "@/lib/foundation/client";

const summary: ChangeSummary = {
  latestDocument: {
    documentId: "e64ddaae-a326-4f23-88a9-05ac59a48625",
    observedOn: "2026-07-28",
    completedAt: "2026-07-28T09:20:00Z",
    eventCount: 2,
  },
  items: [
    {
      conceptCode: "total-cholesterol",
      concept: "총콜레스테롤",
      unit: "mg/dL",
      latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
      previous: { eventId: "9c3e4f50-6172-4c8d-ae9f-1a2b3c4d5e60", value: "194", observedOn: "2026-01-15" },
    },
    {
      conceptCode: "vitamin-d",
      concept: "비타민 D",
      unit: "ng/mL",
      latest: { eventId: "ad4f5061-7283-4d9e-bfa0-2b3c4d5e6f70", value: "42", observedOn: "2026-07-28" },
      previous: null,
    },
  ],
  newConcepts: ["비타민 D"],
  unchangedCount: 1,
};

afterEach(cleanup);

it("states this time's value and the previous value of each item side by side without judging", () => {
  render(<RecentChanges changes={summary} />);

  expect(screen.getByRole("heading", { name: "최근 변화" })).toBeVisible();
  expect(screen.getByText("새 결과지 · 2026. 7. 28.")).toBeVisible();
  expect(screen.getByText("새 기록 2개")).toBeVisible();
  expect(screen.getByText("새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요.")).toBeVisible();
  expect(screen.getAllByTestId("change-item").map((item) => item.textContent)).toEqual([
    "총콜레스테롤 · 이번 2026. 7. 28. 188 mg/dL · 이전 2026. 1. 15. 194 mg/dL",
    "비타민 D · 이번 2026. 7. 28. 42 ng/mL · 이전 값 없음",
  ]);
  expect(screen.getByText("새로 추가된 항목: 비타민 D")).toBeVisible();
  expect(document.body.textContent).not.toMatch(/→|↑|↓|증가|감소|상승|하락|정상|비정상|위험/);
});

it("renders nothing without a latest document or without items", () => {
  const empty = render(<RecentChanges changes={{ items: [], newConcepts: [], unchangedCount: 0 }} />);
  expect(empty.container).toBeEmptyDOMElement();
  cleanup();
  const noItems = render(<RecentChanges changes={{ ...summary, items: [], newConcepts: [] }} />);
  expect(noItems.container).toBeEmptyDOMElement();
});
```

Append to the `describe("foundation same-origin client", ...)` block in `apps/web/tests/foundation-client.test.ts` (before its closing `});`):

```ts
  it("accepts a change summary whose null members are omitted and refuses a judgement field", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ items: [], newConcepts: [], unchangedCount: 0 }));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getChanges()).resolves.toEqual({ items: [], newConcepts: [], unchangedCount: 0 });
    expect(fetcher).toHaveBeenCalledWith("/api/foundation/changes", expect.objectContaining({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }));

    const judging = createFoundationClient({
      fetcher: vi.fn(async () => jsonResponse({
        items: [{
          concept: "총콜레스테롤",
          unit: "mg/dL",
          latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
          direction: "down",
        }],
        newConcepts: [],
        unchangedCount: 0,
      })),
      readCsrfToken: () => "csrf-value",
    });
    await expect(judging.getChanges()).rejects.toMatchObject({ code: "invalid_server_response" });
  });
```

In `apps/web/tests/integrated-review-loop.test.tsx`: change the type import on line 7 to `import type { ChangeSummary, FoundationCandidate, FoundationRecord } from "@/lib/foundation/client";`, add after line 11 (`let records ...`):

```ts
let changes: ChangeSummary = { items: [], newConcepts: [], unchangedCount: 0 };
```

add this handler inside `setupServer(` after the `records` handler (line 25):

```ts
  http.get("/api/foundation/changes", () => HttpResponse.json(changes)),
```

add `changes = { items: [], newConcepts: [], unchangedCount: 0 };` inside `beforeEach` after `records = [];`, and append this test at the end of the file:

```tsx
it("shows 최근 변화 on the home screen only when the server reports items", async () => {
  server.use(http.get("/api/foundation/documents/active", () => HttpResponse.json({})));
  render(<IntegratedHealthExperience />);
  expect(await screen.findByRole("heading", { name: "아직 저장된 기록이 없어요" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "최근 변화" })).toBeNull();
  cleanup();

  changes = {
    latestDocument: {
      documentId: syntheticDocumentId,
      observedOn: "2026-07-28",
      completedAt: "2026-07-28T09:20:00Z",
      eventCount: 1,
    },
    items: [{
      conceptCode: "total-cholesterol",
      concept: "총콜레스테롤",
      unit: "mg/dL",
      latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
      previous: { eventId: "9c3e4f50-6172-4c8d-ae9f-1a2b3c4d5e60", value: "194", observedOn: "2026-01-15" },
    }],
    newConcepts: [],
    unchangedCount: 0,
  };
  render(<IntegratedHealthExperience />);
  expect(await screen.findByRole("heading", { name: "최근 변화" })).toBeVisible();
  expect(screen.getByTestId("change-item")).toHaveTextContent(
    "총콜레스테롤 · 이번 2026. 7. 28. 188 mg/dL · 이전 2026. 1. 15. 194 mg/dL",
  );
});
```

In `apps/web/tests/korean-ux-copy.test.ts` add `"components/integrated/RecentChanges.tsx",` to `userFacingFiles` after the `RecordComparison.tsx` entry, and add this test after `describes a document whose labelled dates disagree…`:

```ts
  it("describes the recent changes as two values without a judgement", () => {
    const recent = source("components/integrated/RecentChanges.tsx");
    expect(recent).toContain("최근 변화");
    expect(recent).toContain("새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요.");
    expect(recent).not.toContain("→");
    expect(source("components/integrated/IntegratedHealthExperience.tsx")).toContain("<RecentChanges changes={changes} />");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/recent-changes.test.tsx tests/foundation-client.test.ts tests/integrated-review-loop.test.tsx tests/korean-ux-copy.test.ts`
Expected: FAIL — `recent-changes.test.tsx` cannot resolve `@/components/integrated/RecentChanges`; `foundation-client.test.ts` fails with `client.getChanges is not a function`; the copy scan fails on the missing file; the review-loop home test fails on the missing heading.

- [ ] **Step 3: Add the schema and the client method**

In `apps/web/lib/foundation/client.ts`, after `healthEventSchema` (line 159) add:

```ts
const changeValueSchema = z.object({
  eventId: uuidSchema,
  value: z.string().min(1).max(64),
  observedOn: z.string().date(),
}).strict();

// This time's value beside the previous value of the same item. `.strict()` is
// the boundary: a server that starts sending a difference, a direction or a
// range fails validation here. `previous` is omitted when the server has none.
const changeItemSchema = z.object({
  conceptCode: conceptCodeSchema.nullable().optional(),
  concept: z.string().min(1).max(80),
  unit: z.string().min(1).max(32),
  latest: changeValueSchema,
  previous: changeValueSchema.nullable().optional(),
}).strict();

const changeSummarySchema = z.object({
  // Omitted while the person has no completed document with current records.
  latestDocument: z.object({
    documentId: uuidSchema,
    observedOn: z.string().date(),
    completedAt: z.string().datetime({ offset: true }),
    eventCount: z.number().int().nonnegative(),
  }).strict().nullable().optional(),
  items: z.array(changeItemSchema).max(500),
  newConcepts: z.array(z.string().min(1).max(80)).max(500),
  unchangedCount: z.number().int().nonnegative(),
}).strict();
```

After `export type HealthEvent = ...` (line 177) add:

```ts
export type ChangeSummary = z.infer<typeof changeSummarySchema>;
export type ChangeItem = z.infer<typeof changeItemSchema>;
```

After the `getHealthEvents` entry (line 419) add:

```ts
    getChanges: () => request("/api/foundation/changes", changeSummarySchema, { method: "GET" }),
```

- [ ] **Step 4: Create `RecentChanges` and render it on the home view**

Create `apps/web/components/integrated/RecentChanges.tsx`:

```tsx
import type { ChangeSummary } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";

type RecentChangesProps = {
  changes: ChangeSummary;
};

function datedValue(point: { observedOn: string; value: string }, unit: string) {
  return `${formatKoreanDate(point.observedOn)} ${point.value} ${unit}`;
}

/**
 * Each line is one string so the rendered text is exactly what the tests and the
 * Playwright assertions expect. Two values side by side; no arrow, no direction.
 */
function changeLine(item: ChangeSummary["items"][number]) {
  const latest = `${item.concept} · 이번 ${datedValue(item.latest, item.unit)}`;
  return item.previous ? `${latest} · 이전 ${datedValue(item.previous, item.unit)}` : `${latest} · 이전 값 없음`;
}

/** The latest 결과지's values beside the previous value of the same item. Hidden when there is nothing to list. */
export function RecentChanges({ changes }: RecentChangesProps) {
  const latest = changes.latestDocument;
  if (!latest || changes.items.length === 0) return null;
  return (
    <section className="gc-health-home__overview" aria-labelledby="recent-changes-title">
      <div className="gc-health-home__section-heading">
        <div><p>{`새 결과지 · ${formatKoreanDate(latest.observedOn)}`}</p><h2 id="recent-changes-title">최근 변화</h2></div>
        <span>{`새 기록 ${latest.eventCount}개`}</span>
      </div>
      <p className="gc-records-comparison__note">새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요.</p>
      <ul className="gc-review-saved" aria-label="항목별 이번 값과 이전 값">
        {changes.items.map((item) => (
          <li key={item.latest.eventId} data-testid="change-item">{changeLine(item)}</li>
        ))}
      </ul>
      {changes.newConcepts.length > 0 && <p>{`새로 추가된 항목: ${changes.newConcepts.join(", ")}`}</p>}
    </section>
  );
}
```

In `apps/web/components/integrated/IntegratedHealthExperience.tsx`:

1. Add `import { RecentChanges } from "@/components/integrated/RecentChanges";` after the `IntegratedShell` import (line 5), and add `type ChangeSummary,` to the `@/lib/foundation/client` import list (before `type FoundationCandidate,`).
2. After `const [records, setRecords] = useState<FoundationRecord[]>([]);` (line 86) add `const [changes, setChanges] = useState<ChangeSummary>();`.
3. Replace the start of `loadProductTruth` (lines 98-104) with:

```tsx
    const [loadedConsent, loadedRecords, activity, loadedChanges] = await Promise.all([
      client.getDocumentConsent(),
      client.getRecords(),
      client.getActiveDocument(),
      client.getChanges(),
    ]);
    setConsent(loadedConsent);
    setRecords(loadedRecords);
    setChanges(loadedChanges);
```

4. In the home view, directly after the closing `</section>` of `gc-health-home__overview` (line 604) and before the `gc-health-home__privacy` section, add:

```tsx
          {changes && <RecentChanges changes={changes} />}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/recent-changes.test.tsx tests/foundation-client.test.ts tests/integrated-review-loop.test.tsx tests/korean-ux-copy.test.ts && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: `Test Files 4 passed (4)`; `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/web/lib/foundation/client.ts apps/web/components/integrated/RecentChanges.tsx apps/web/components/integrated/IntegratedHealthExperience.tsx apps/web/tests/recent-changes.test.tsx apps/web/tests/foundation-client.test.ts apps/web/tests/integrated-review-loop.test.tsx apps/web/tests/korean-ux-copy.test.ts && git commit -m "feat(web): 최근 변화 — home lists the latest 결과지 values beside the previous value, strictly validated, no judgement

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Web — consent list client and the four-row 데이터 관리 consent section

**Files:**
- Modify: `apps/web/lib/foundation/client.ts:32-38,170-178,325-335,438-443`
- Modify: `apps/web/components/integrated/IntegratedDataControl.tsx` (whole file)
- Modify: `apps/web/tests/integrated-data-control.test.tsx` (whole file), `apps/web/tests/korean-ux-copy.test.ts`
- Modify: `apps/web/e2e/foundation-lifecycle.spec.ts:372,462` (button names only; Task 8 adds the flows)

**Interfaces:**
- Consumes: `GET /api/foundation/consents`, `POST /api/foundation/consents/{purposeCode}` (`Idempotency-Key`), `POST /consents/{consentId}/revocation` (Task 3); `labelConsentStatus` (`lib/format/status-labels.ts`); CSS `gc-data-control__purpose-list`, `gc-data-control__purpose-index`, `gc-data-control__purpose-copy`, `gc-data-control__purpose-lock`, `article[data-status="active"|"revoked"]`.
- Produces: `consentPurposeCodeSchema`, `consentPurposeSchema` (strict), `export type FoundationConsentPurpose`, `client.getConsents()`, `client.grantConsent(purposeCode, idempotencyKey)`; `consentSchema.purposeCode` widened from the literal to the purpose regex (`revokeConsent` returns the real purpose now). `IntegratedDataControl` renders `<article data-purpose="DOCUMENT_EXTRACTION|RESEARCH_USE|RESEARCH_CONTACT|PROJECT">`; button names are `"결과지 처리 동의" | "결과지 처리 동의 철회" | "연구 활용 동의" | "연구 활용 동의 철회" | "연구 연락 동의" | "연구 연락 동의 철회"` and, per project row, `"<name> 동의 철회"`. Task 7 adds the export section to the same component; Task 8 drives these buttons.

- [ ] **Step 1: Write the failing tests**

Replace `apps/web/tests/integrated-data-control.test.tsx` with:

```tsx
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { IntegratedDataControl } from "@/components/integrated/IntegratedDataControl";

type PurposeCode = "DOCUMENT_EXTRACTION" | "RESEARCH_USE" | "RESEARCH_CONTACT";
type ConsentState = { consentId?: string; status: "NOT_GRANTED" | "ACTIVE" | "REVOKED" };

const documentConsentId = "89116f1a-2026-457e-8942-409ff8f8fc4f";
const policyVersions: Record<PurposeCode, string> = {
  DOCUMENT_EXTRACTION: "foundation-v1",
  RESEARCH_USE: "research-consent-policy.v1",
  RESEARCH_CONTACT: "research-contact-policy.v1",
};
let consents: Record<PurposeCode, ConsentState>;
let grantHeaders: Array<string | null> = [];
let revokedIds: string[] = [];

function row(purposeCode: PurposeCode) {
  const state = consents[purposeCode];
  return {
    consentId: state.consentId,
    purposeCode,
    status: state.status,
    policyVersion: policyVersions[purposeCode],
    grantedAt: state.consentId ? "2026-07-28T09:00:00Z" : undefined,
    revokedAt: state.status === "REVOKED" ? "2026-07-28T10:00:00Z" : undefined,
  };
}

const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json({
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b",
    subjectId: "synthetic-jason",
    status: "AUTHENTICATED",
    expiresAt: "2026-07-28T23:00:00Z",
  })),
  http.get("/api/foundation/consents", () => HttpResponse.json(
    (["DOCUMENT_EXTRACTION", "RESEARCH_USE", "RESEARCH_CONTACT"] as const).map(row),
  )),
  http.post("/api/foundation/consents/:purposeCode", ({ params, request }) => {
    const purposeCode = decodeURIComponent(String(params.purposeCode)) as PurposeCode;
    grantHeaders.push(request.headers.get("Idempotency-Key"));
    consents[purposeCode] = { consentId: crypto.randomUUID(), status: "ACTIVE" };
    return HttpResponse.json(row(purposeCode), { status: 201 });
  }),
  http.post("/api/foundation/consents/:consentId/revocation", ({ params }) => {
    const consentId = String(params.consentId);
    revokedIds.push(consentId);
    const purposeCode = (Object.keys(consents) as PurposeCode[]).find((code) => consents[code].consentId === consentId)!;
    consents[purposeCode] = { consentId, status: "REVOKED" };
    return HttpResponse.json({ consentId, purposeCode, status: "REVOKED" });
  }),
  http.get("/api/foundation/health-events", () => HttpResponse.json([])),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  consents = {
    DOCUMENT_EXTRACTION: { consentId: documentConsentId, status: "ACTIVE" },
    RESEARCH_USE: { status: "NOT_GRANTED" },
    RESEARCH_CONTACT: { status: "NOT_GRANTED" },
  };
  grantHeaders = [];
  revokedIds = [];
  document.cookie = "GC_CSRF=synthetic-data-control-csrf-value";
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

function purposeRow(purpose: string) {
  return within(document.querySelector(`article[data-purpose='${purpose}']`) as HTMLElement);
}

it("lists the four purposes in Korean with the fixed sentences and no raw enum", async () => {
  render(<IntegratedDataControl />);

  expect(await screen.findByRole("heading", { name: "서비스 제공(결과지 처리)" })).toBeVisible();
  for (const title of ["연구 활용", "연구 연락", "프로젝트별"]) {
    expect(screen.getByRole("heading", { name: title })).toBeVisible();
  }
  expect(screen.getByText("연구 동의 없이도 모든 기능을 쓸 수 있어요.", { exact: false })).toBeVisible();
  expect(screen.getByText("가명처리 후 연구에 쓰는 것에 대한 선택. 지금은 진행 중인 연구가 없어요.")).toBeVisible();
  expect(screen.getByText("적합한 연구가 있을 때 참여 제안을 받을지. 지금은 연락 채널이 없어요.")).toBeVisible();
  expect(screen.getByText("프로젝트가 생기면 여기서 개별로 물어요.")).toBeVisible();
  expect(purposeRow("DOCUMENT_EXTRACTION").getByText("동의함")).toBeVisible();
  expect(purposeRow("RESEARCH_USE").getByText("동의 전")).toBeVisible();
  expect(purposeRow("RESEARCH_CONTACT").getByText("동의 전")).toBeVisible();
  expect(screen.getByRole("button", { name: "결과지 처리 동의 철회" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "연구 활용 동의" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "연구 연락 동의" })).toBeEnabled();
  expect(screen.queryByText("ACTIVE")).toBeNull();
  expect(screen.queryByText("NOT_GRANTED")).toBeNull();
  expect(screen.queryByText("RESEARCH_USE")).toBeNull();
});

it("grants and revokes a research consent without touching the document consent", async () => {
  render(<IntegratedDataControl />);
  await screen.findByRole("button", { name: "연구 활용 동의" });

  await userEvent.click(screen.getByRole("button", { name: "연구 활용 동의" }));

  expect(await screen.findByRole("button", { name: "연구 활용 동의 철회" })).toBeEnabled();
  expect(purposeRow("RESEARCH_USE").getByText("동의함")).toBeVisible();
  expect(purposeRow("DOCUMENT_EXTRACTION").getByText("동의함")).toBeVisible();
  expect(purposeRow("RESEARCH_CONTACT").getByText("동의 전")).toBeVisible();
  expect(grantHeaders).toHaveLength(1);
  expect(grantHeaders[0]).toMatch(/^consent-[0-9a-f-]{36}$/);
  expect(screen.getByText("연구 활용 동의를 서버에 기록했어요.")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "연구 활용 동의 철회" }));

  await waitFor(() => expect(purposeRow("RESEARCH_USE").getByText("철회함")).toBeVisible());
  expect(revokedIds).toEqual([consents.RESEARCH_USE.consentId]);
  expect(purposeRow("DOCUMENT_EXTRACTION").getByText("동의함")).toBeVisible();
  expect(screen.getByRole("button", { name: "결과지 처리 동의 철회" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "연구 활용 동의" })).toBeEnabled();
  expect(screen.queryByText("REVOKED")).toBeNull();
});

it("revokes the document consent from its own labelled button", async () => {
  render(<IntegratedDataControl />);

  await userEvent.click(await screen.findByRole("button", { name: "결과지 처리 동의 철회" }));

  await waitFor(() => expect(screen.getAllByText("철회함")).toHaveLength(2));
  expect(revokedIds).toEqual([documentConsentId]);
  expect(document.querySelector("article[data-purpose='DOCUMENT_EXTRACTION']")).toHaveAttribute("data-status", "revoked");
  expect(screen.getByText("결과지 처리 동의를 서버에서 철회했어요.")).toBeVisible();
  expect(screen.getByRole("button", { name: "결과지 처리 동의" })).toBeEnabled();
});

it("names a consent the server has never granted in Korean", async () => {
  consents.DOCUMENT_EXTRACTION = { status: "NOT_GRANTED" };

  render(<IntegratedDataControl />);

  await waitFor(() => expect(screen.getAllByText("동의 전")).toHaveLength(4));
  expect(screen.queryByText("NOT_GRANTED")).toBeNull();
  expect(document.querySelector("article[data-purpose='DOCUMENT_EXTRACTION']")).toHaveAttribute("data-status", "revoked");
});
```

Append to `apps/web/tests/foundation-client.test.ts` inside the `describe` block:

```ts
  it("reads the consent list, grants a purpose with an idempotency key and refuses an unknown purpose", async () => {
    const list = [
      { purposeCode: "DOCUMENT_EXTRACTION", status: "NOT_GRANTED", policyVersion: "foundation-v1" },
      { consentId: "89116f1a-2026-457e-8942-409ff8f8fc4f", purposeCode: "RESEARCH_USE", status: "ACTIVE", policyVersion: "research-consent-policy.v1", grantedAt: "2026-07-28T09:00:00Z" },
      { purposeCode: "RESEARCH_CONTACT", status: "NOT_GRANTED", policyVersion: "research-contact-policy.v1" },
    ];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? jsonResponse(list[1], 201)
      : jsonResponse(list));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getConsents()).resolves.toHaveLength(3);
    await expect(client.grantConsent("RESEARCH_USE", "consent-000000000001")).resolves.toMatchObject({ status: "ACTIVE" });
    const [path, request] = fetcher.mock.calls[1] as unknown as [string, RequestInit];
    expect(path).toBe("/api/foundation/consents/RESEARCH_USE");
    expect(new Headers(request.headers).get("Idempotency-Key")).toBe("consent-000000000001");
    expect(new Headers(request.headers).get("X-GC-CSRF")).toBe("csrf-value");
    await expect(client.grantConsent("STUDY-1", "consent-000000000002")).rejects.toMatchObject({ code: "validation_error" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
```

In `apps/web/tests/korean-ux-copy.test.ts` add after the recent-changes test from Task 5:

```ts
  it("states that research consent is optional, stored only, and asked again per project", () => {
    const control = source("components/integrated/IntegratedDataControl.tsx");
    for (const sentence of [
      "연구 동의 없이도 모든 기능을 쓸 수 있어요.",
      "실제 활용 전에는 프로젝트별 동의를 다시 물어요.",
      "가명처리 후 연구에 쓰는 것에 대한 선택. 지금은 진행 중인 연구가 없어요.",
      "적합한 연구가 있을 때 참여 제안을 받을지. 지금은 연락 채널이 없어요.",
      "프로젝트가 생기면 여기서 개별로 물어요.",
    ]) {
      expect(control, `data control lacks: ${sentence}`).toContain(sentence);
    }
    expect(control).not.toContain("{consent.status}");
    expect(control).not.toContain("{status}</strong>");
  });
```

In `apps/web/e2e/foundation-lifecycle.spec.ts` change line 372 `await page.getByRole("button", { name: "동의 철회" }).click();` to `await page.getByRole("button", { name: "결과지 처리 동의 철회", exact: true }).click();` and line 462 `await page.getByRole("button", { name: "동의 철회" }).focus();` to `await page.getByRole("button", { name: "결과지 처리 동의 철회", exact: true }).focus();`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/integrated-data-control.test.tsx tests/foundation-client.test.ts tests/korean-ux-copy.test.ts`
Expected: FAIL — the data-control tests fail with an msw `onUnhandledRequest` error for `GET /api/foundation/consents/document-extraction` (the component still calls the single-consent endpoint); `client.getConsents is not a function`; the copy scan misses every sentence.

- [ ] **Step 3: Extend the client**

In `apps/web/lib/foundation/client.ts`:

1. Add after `const conceptCodeSchema = ...` (line 6):

```ts
// One consent row per purpose. Research purposes are stored only; nothing in the product depends on them.
const consentPurposeCodeSchema = z.string().regex(/^(DOCUMENT_EXTRACTION|RESEARCH_USE|RESEARCH_CONTACT|PROJECT:[a-z0-9-]{1,40})$/);
```

2. In `consentSchema` (lines 32-38) replace `purposeCode: z.literal("DOCUMENT_EXTRACTION"),` with `purposeCode: consentPurposeCodeSchema,`.

3. After `consentSchema` add:

```ts
const consentPurposeSchema = z.object({
  consentId: uuidSchema.nullable().optional(),
  purposeCode: consentPurposeCodeSchema,
  status: z.enum(["NOT_GRANTED", "ACTIVE", "REVOKED"]),
  policyVersion: z.string().min(1).max(40),
  grantedAt: z.string().datetime({ offset: true }).nullable().optional(),
  revokedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();
```

4. After `export type FoundationConsent = ...` add `export type FoundationConsentPurpose = z.infer<typeof consentPurposeSchema>;`.

5. Inside `createFoundationClient`, after `requireIdempotencyKey` add:

```ts
  function requirePurposeCode(value: string) {
    const parsed = consentPurposeCodeSchema.safeParse(value);
    if (!parsed.success) throw new FoundationClientError("validation_error", 0);
    return parsed.data;
  }
```

6. After the `grantDocumentConsent` entry (line 335) add:

```ts
    getConsents: () => request("/api/foundation/consents", z.array(consentPurposeSchema).max(50), { method: "GET" }),
    grantConsent: async (purposeCode: string, idempotencyKey: string) => request(
      `/api/foundation/consents/${encodeURIComponent(requirePurposeCode(purposeCode))}`,
      consentPurposeSchema,
      { method: "POST", headers: { "Idempotency-Key": requireIdempotencyKey(idempotencyKey) } },
      true,
    ),
```

`revokeConsent` keeps `consentSchema` (now accepting any purpose code).

- [ ] **Step 4: Rewrite the consent section of `IntegratedDataControl`**

Replace `apps/web/components/integrated/IntegratedDataControl.tsx` with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createFoundationClient,
  type FoundationConsentPurpose,
  type FoundationDeletion,
  type FoundationSession,
} from "@/lib/foundation/client";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { describeFoundationError } from "@/lib/foundation/messages";
import { labelConsentStatus } from "@/lib/format/status-labels";

type FixedPurposeCode = "DOCUMENT_EXTRACTION" | "RESEARCH_USE" | "RESEARCH_CONTACT";

type ConsentRowCopy = {
  purposeCode: FixedPurposeCode;
  title: string;
  short: string;
  description: string;
  purpose: string;
};

/** The three fixed purposes in the order the server lists them. The sentences are fixed by the Wave 2C design. */
const consentRows: ConsentRowCopy[] = [
  {
    purposeCode: "DOCUMENT_EXTRACTION",
    title: "서비스 제공(결과지 처리)",
    short: "결과지 처리",
    description: "허용된 합성 PDF에 대해 문서 요청, 논리 격리, 검사, 합성 후보 확인을 허용합니다. 철회하면 새 결과지를 처리하지 않아요.",
    purpose: "결과지 항목 확인",
  },
  {
    purposeCode: "RESEARCH_USE",
    title: "연구 활용",
    short: "연구 활용",
    description: "가명처리 후 연구에 쓰는 것에 대한 선택. 지금은 진행 중인 연구가 없어요.",
    purpose: "연구 활용 · 현재 없음",
  },
  {
    purposeCode: "RESEARCH_CONTACT",
    title: "연구 연락",
    short: "연구 연락",
    description: "적합한 연구가 있을 때 참여 제안을 받을지. 지금은 연락 채널이 없어요.",
    purpose: "참여 제안 연락 · 현재 없음",
  },
];

const projectPrefix = "PROJECT:";

function newIdempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function IntegratedDataControl() {
  const client = useMemo(() => createFoundationClient(), []);
  const [session, setSession] = useState<FoundationSession>();
  const [consents, setConsents] = useState<FoundationConsentPurpose[]>([]);
  const [deletion, setDeletion] = useState<FoundationDeletion>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviewingDeletion, setReviewingDeletion] = useState(false);
  const [confirmedDeletion, setConfirmedDeletion] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [loadedSession, loadedConsents] = await Promise.all([
          client.getSession(),
          client.getConsents(),
        ]);
        if (active) {
          setSession(loadedSession);
          setConsents(loadedConsents);
        }
      } catch (error) {
        if (active) setErrorMessage(describeFoundationError(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [client]);

  const consentFor = (purposeCode: string) => consents.find((item) => item.purposeCode === purposeCode);
  const documentConsentStatus = consentFor("DOCUMENT_EXTRACTION")?.status ?? "NOT_GRANTED";
  const projectConsents = consents.filter((item) => item.purposeCode.startsWith(projectPrefix));

  // Every consent change re-reads the server list, so the four rows always show what the server holds.
  const grantConsent = async (purposeCode: string, short: string) => {
    setBusy(true);
    setErrorMessage("");
    setActionMessage("");
    try {
      await client.grantConsent(purposeCode, newIdempotencyKey("consent"));
      setConsents(await client.getConsents());
      setActionMessage(`${short} 동의를 서버에 기록했어요.`);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  const revokeConsent = async (consentId: string, short: string) => {
    setBusy(true);
    setErrorMessage("");
    setActionMessage("");
    try {
      await client.revokeConsent(consentId);
      setConsents(await client.getConsents());
      setActionMessage(`${short} 동의를 서버에서 철회했어요.`);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteProfile = async () => {
    if (!confirmedDeletion) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const completed = await client.deleteProfile();
      setDeletion(completed);
      setSession(undefined);
      setConsents([]);
      setReviewingDeletion(false);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IntegratedShell current="data-control" status="예시 데이터로 체험 중">
      <main className="gc-data-control">
        <div className="gc-data-control__shell">
          <section className="gc-data-control__hero" aria-labelledby="integrated-data-title">
            <div><p>동의와 보관 상태</p><h1 id="integrated-data-title">내 데이터</h1></div>
            <div className="gc-data-control__hero-copy"><p>목적별 동의를 확인하고, 체험 중 만든 기록을 삭제할 수 있어요.</p><strong>예시 데이터 전용 · 실제 개인정보 없음</strong></div>
          </section>
          <div className="gc-integrated-actions"><a href="/connections">연결 상태 확인</a><a href="/providers">공공정보 실험실</a></div>

          {loading && <p role="status">서버에서 동의 상태를 확인하고 있어요.</p>}
          {actionMessage && <p role="status" aria-live="polite">{actionMessage}</p>}
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage} {!session && <a href="/">홈에서 다시 로그인</a>}</p>}

          {!loading && session && (
            <>
              <section className="gc-data-control__summary" aria-label="현재 서버 데이터 상태">
                <article><span>체험 상태</span><strong>활성</strong><p>이 브라우저에서 체험 중</p></article>
                <article><span>결과지 처리 동의</span><strong>{labelConsentStatus(documentConsentStatus)}</strong><p>예시 결과지 항목 확인</p></article>
                <article><span>외부 연결</span><strong>0</strong><p>카카오·네이버·MyHealthWay 비활성화</p><a href="/connections">외부 연결 상태</a></article>
              </section>

              <section className="gc-data-control__purposes" aria-labelledby="server-consent-title">
                <header>
                  <div><p>현재 동의 상태</p><h2 id="server-consent-title">목적별 동의</h2></div>
                  <p>연구 동의 없이도 모든 기능을 쓸 수 있어요. 연구 동의는 저장만 되고, 실제 활용 전에는 프로젝트별 동의를 다시 물어요.</p>
                </header>
                <div className="gc-data-control__purpose-list">
                  {consentRows.map((row, index) => {
                    const consent = consentFor(row.purposeCode);
                    const status = consent?.status ?? "NOT_GRANTED";
                    return (
                      <article key={row.purposeCode} data-purpose={row.purposeCode} data-status={status === "ACTIVE" ? "active" : "revoked"}>
                        <span className="gc-data-control__purpose-index">{String(index + 1).padStart(2, "0")}</span>
                        <div className="gc-data-control__purpose-copy">
                          <div><h3>{row.title}</h3><strong>{labelConsentStatus(status)}</strong></div>
                          <p>{row.description}</p>
                          <dl><div><dt>사용 목적</dt><dd>{row.purpose}</dd></div><div><dt>실제 외부 제공</dt><dd>없음</dd></div></dl>
                        </div>
                        {status === "ACTIVE" && consent?.consentId
                          ? <button type="button" onClick={() => void revokeConsent(consent.consentId!, row.short)} disabled={busy}>{`${row.short} 동의 철회`}</button>
                          : <button type="button" onClick={() => void grantConsent(row.purposeCode, row.short)} disabled={busy}>{`${row.short} 동의`}</button>}
                      </article>
                    );
                  })}
                  <article data-purpose="PROJECT" data-status={projectConsents.some((item) => item.status === "ACTIVE") ? "active" : "revoked"}>
                    <span className="gc-data-control__purpose-index">04</span>
                    <div className="gc-data-control__purpose-copy">
                      <div><h3>프로젝트별</h3><strong>{projectConsents.length === 0 ? "아직 없음" : `${projectConsents.filter((item) => item.status === "ACTIVE").length}개 동의함`}</strong></div>
                      <p>프로젝트가 생기면 여기서 개별로 물어요.</p>
                      {projectConsents.length > 0 && (
                        <ul className="gc-review-saved" aria-label="프로젝트별 동의">
                          {projectConsents.map((item) => {
                            const name = item.purposeCode.slice(projectPrefix.length);
                            return (
                              <li key={item.purposeCode}>
                                <strong>{name}</strong>
                                <span>{labelConsentStatus(item.status)}</span>
                                {item.status === "ACTIVE" && item.consentId && (
                                  <button type="button" onClick={() => void revokeConsent(item.consentId!, name)} disabled={busy}>{`${name} 동의 철회`}</button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <span className="gc-data-control__purpose-lock">지금은 물어볼 프로젝트가 없어요</span>
                  </article>
                </div>
              </section>

              <section className="gc-data-control__danger" aria-labelledby="server-delete-title">
                <div><p>체험 데이터</p><h2 id="server-delete-title">계정과 데이터 모두 삭제</h2><span>결과지와 확인한 기록을 삭제하고 이 체험을 끝내요.</span></div>
                <button type="button" onClick={() => setReviewingDeletion(true)} disabled={busy}>삭제 요청 검토</button>
              </section>

              {reviewingDeletion && (
                <section className="gc-integrated-auth" aria-labelledby="delete-confirm-title">
                  <p>삭제 확인</p>
                  <h2 id="delete-confirm-title">합성 프로필을 삭제할까요?</h2>
                  <p>세션, 동의, 문서, 후보와 기록이 삭제되고 현재 세션도 끝납니다. 감사 이벤트에는 건강 수치를 남기지 않습니다.</p>
                  <label><input type="checkbox" checked={confirmedDeletion} onChange={(event) => setConfirmedDeletion(event.target.checked)} /> 위 내용을 확인했습니다</label>
                  <div className="gc-integrated-actions"><button type="button" onClick={() => { setReviewingDeletion(false); setConfirmedDeletion(false); }}>취소</button><button type="button" onClick={() => void deleteProfile()} disabled={!confirmedDeletion || busy}>{busy ? "삭제 상태 확인 중" : "서버에 삭제 요청"}</button></div>
                </section>
              )}
            </>
          )}

          {deletion?.status === "COMPLETED" && (
            <section className="gc-integrated-auth" aria-labelledby="delete-complete-title" role="status">
              <p>서버 완료 상태</p>
              <h2 id="delete-complete-title">삭제가 완료됐어요</h2>
              <p>체험 데이터가 삭제됐고 이 브라우저의 체험도 끝났어요.</p>
              <dl className="gc-integrated-facts"><div><dt>삭제 ID</dt><dd><code>{deletion.deletionId}</code></dd></div><div><dt>감사에 건강 수치</dt><dd>{deletion.rawHealthValuesPresentInAudit ? "발견됨 · 중단 필요" : "없음"}</dd></div></dl>
              <div className="gc-integrated-actions"><a href="/">홈으로 돌아가기</a></div>
            </section>
          )}
        </div>
      </main>
    </IntegratedShell>
  );
}
```

The `http.get("/api/foundation/health-events", ...)` handler in the test file is unused until Task 7; msw only errors on *unhandled* requests, so an extra handler is harmless.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/integrated-data-control.test.tsx tests/foundation-client.test.ts tests/korean-ux-copy.test.ts tests/integrated-review-loop.test.tsx && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: `Test Files 4 passed (4)`; `tsc` prints nothing. (`integrated-review-loop` still passes: the home consent flow keeps `getDocumentConsent`.)

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/web/lib/foundation/client.ts apps/web/components/integrated/IntegratedDataControl.tsx apps/web/tests/integrated-data-control.test.tsx apps/web/tests/foundation-client.test.ts apps/web/tests/korean-ux-copy.test.ts apps/web/e2e/foundation-lifecycle.spec.ts && git commit -m "feat(web): 데이터 관리 lists four consent purposes with fixed Korean copy; research consent is optional and stored only

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Web — "내 기록 내보내기(JSON)" link in 데이터 관리

**Files:**
- Modify: `apps/web/components/integrated/IntegratedDataControl.tsx` (imports, load effect, a new section before `gc-data-control__danger`)
- Modify: `apps/web/tests/integrated-data-control.test.tsx`, `apps/web/tests/korean-ux-copy.test.ts`

**Interfaces:**
- Consumes: `client.getHealthEvents()` (existing) for the count; `GET /api/foundation/health-events/export` (Task 4) opened by the browser via `<a href="/api/foundation/health-events/export" download>`; the Next `/api/:path*` rewrite; `HealthEvent` type; `syntheticHealthEvent` fixture (`tests/fixtures/foundation.ts`).
- Produces: a section with heading "내 기록 내보내기", link name "내 기록 내보내기(JSON)" (only when at least one event exists), help "브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요.", and when there are no events a disabled button with the same name plus "내보낼 기록이 없어요". Task 8 clicks the link and awaits the download event.

- [ ] **Step 1: Write the failing tests**

In `apps/web/tests/integrated-data-control.test.tsx` add `import { syntheticHealthEvent } from "./fixtures/foundation";` after the component import, add `let events: ReturnType<typeof syntheticHealthEvent>[] = [];` after `let revokedIds ...`, change the health-events handler to `http.get("/api/foundation/health-events", () => HttpResponse.json(events)),`, add `events = [];` in `beforeEach`, and append:

```tsx
it("offers the export link that opens the core URL directly when there are events", async () => {
  events = [syntheticHealthEvent(), syntheticHealthEvent({ eventId: "9c3e4f50-6172-4c8d-ae9f-1a2b3c4d5e60", concept: "비타민 D", value: "42", unit: "ng/mL" })];

  render(<IntegratedDataControl />);

  const link = await screen.findByRole("link", { name: "내 기록 내보내기(JSON)" });
  expect(link).toHaveAttribute("href", "/api/foundation/health-events/export");
  expect(link).toHaveAttribute("download");
  expect(screen.getByText("브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요.")).toBeVisible();
  expect(screen.queryByText("내보낼 기록이 없어요")).toBeNull();
});

it("disables the export and says so when there is nothing to export", async () => {
  render(<IntegratedDataControl />);

  expect(await screen.findByRole("button", { name: "내 기록 내보내기(JSON)" })).toBeDisabled();
  expect(screen.getByText("내보낼 기록이 없어요")).toBeVisible();
  expect(screen.queryByRole("link", { name: "내 기록 내보내기(JSON)" })).toBeNull();
});
```

In `apps/web/tests/korean-ux-copy.test.ts` add after the research-consent copy test:

```ts
  it("explains the export as a browser download with no server copy", () => {
    const control = source("components/integrated/IntegratedDataControl.tsx");
    expect(control).toContain('href="/api/foundation/health-events/export"');
    expect(control).toContain("내 기록 내보내기(JSON)");
    expect(control).toContain("브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요.");
    expect(control).toContain("내보낼 기록이 없어요");
    expect(control).not.toContain("/api/export");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/integrated-data-control.test.tsx tests/korean-ux-copy.test.ts`
Expected: FAIL — `Unable to find role="link" and name "내 기록 내보내기(JSON)"`, the disabled-button test fails the same way, and the copy scan misses the href.

- [ ] **Step 3: Add the export section**

In `apps/web/components/integrated/IntegratedDataControl.tsx`:

1. Add `type HealthEvent,` to the `@/lib/foundation/client` import list (after `type FoundationSession,`).
2. After `const [consents, setConsents] = ...` add `const [events, setEvents] = useState<HealthEvent[]>([]);`.
3. In the load effect, replace the `Promise.all` with three reads:

```tsx
        const [loadedSession, loadedConsents, loadedEvents] = await Promise.all([
          client.getSession(),
          client.getConsents(),
          client.getHealthEvents(),
        ]);
        if (active) {
          setSession(loadedSession);
          setConsents(loadedConsents);
          setEvents(loadedEvents);
        }
```

4. In `deleteProfile`, after `setConsents([]);` add `setEvents([]);`.
5. Change the hero sentence to `목적별 동의를 확인하고, 내 기록을 파일로 내보내거나, 체험 중 만든 기록을 삭제할 수 있어요.`
6. Insert this section between the consent `</section>` and the `gc-data-control__danger` section:

```tsx
              <section className="gc-integrated-auth" aria-labelledby="server-export-title">
                <p>내 기록</p>
                <h2 id="server-export-title">내 기록 내보내기</h2>
                <p>브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요.</p>
                <div className="gc-integrated-actions">
                  {events.length > 0
                    ? <a className="gc-button gc-button--weak" href="/api/foundation/health-events/export" download>내 기록 내보내기(JSON)</a>
                    : <button type="button" disabled>내 기록 내보내기(JSON)</button>}
                </div>
                {events.length === 0 && <p className="gc-integrated-empty">내보낼 기록이 없어요</p>}
              </section>
```

The bare `download` attribute lets the core's `Content-Disposition` filename (`alm-health-events-<YYYYMMDD>.json`) name the file; the browser fetches the core URL with the same cookie and the server's owner check decides what is returned.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/integrated-data-control.test.tsx tests/korean-ux-copy.test.ts && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm web:test`
Expected: `Test Files 2 passed (2)`; `tsc` silent; the full run prints `Test Files 49 passed (49)` (48 before this wave + `recent-changes.test.tsx`; if the count differs, every file must still report passed).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/web/components/integrated/IntegratedDataControl.tsx apps/web/tests/integrated-data-control.test.tsx apps/web/tests/korean-ux-copy.test.ts && git commit -m "feat(web): 내 기록 내보내기(JSON) — direct core download link in 데이터 관리, disabled with copy when there is nothing to export

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Browser lifecycle — 최근 변화, research consent grant→revoke, export headers and download

**Files:**
- Modify: `apps/web/e2e/foundation-lifecycle.spec.ts:304-309,366-373`

**Interfaces:**
- Consumes: `browserApi(page, path, options)` (spec lines 109-132), `page.request` (shares the browser context's cookies; `baseURL` is the web origin, `playwright.foundation.config.ts:93`), the exact item strings from Task 5, the button names from Task 6, the link name from Task 7. In this lifecycle the second document is 1월 (values 194 / 5.4 / 45 on 2026-01-15) and it completes last, so it is the `latestDocument`; the July values are 190 (corrected), 5.2 on 2026-07-27 (date corrected) and 비타민 D excluded.
- Produces: assertions only.

- [ ] **Step 1: Add the 최근 변화 check after the second document**

Replace lines 307-309 (`await page.getByRole("link", { name: "저장된 기록 보기" }).click();` … `toHaveCount(5);`) with:

```ts
  // Wave 2C: the home lists the latest 결과지's values beside the previous value of the same item.
  // The January document completed last, so it is "이번"; July is "이전". No arrow, no judgement.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "최근 변화" })).toBeVisible();
  await expect(page.getByText("새 결과지 · 2026. 1. 15.")).toBeVisible();
  await expect(page.getByText("새 기록 3개")).toBeVisible();
  await expect(page.getByText("새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요.")).toBeVisible();
  await expect(page.getByTestId("change-item")).toHaveCount(3);
  await expect(page.getByTestId("change-item").filter({ hasText: "총콜레스테롤" }))
    .toHaveText("총콜레스테롤 · 이번 2026. 1. 15. 194 mg/dL · 이전 2026. 7. 28. 190 mg/dL");
  await expect(page.getByTestId("change-item").filter({ hasText: "당화혈색소" }))
    .toHaveText("당화혈색소 · 이번 2026. 1. 15. 5.4 % · 이전 2026. 7. 27. 5.2 %");
  await expect(page.getByTestId("change-item").filter({ hasText: "비타민 D" }))
    .toHaveText("비타민 D · 이번 2026. 1. 15. 45 ng/mL · 이전 값 없음");
  await expect(page.getByText("새로 추가된 항목: 비타민 D")).toBeVisible();
  const changes = await browserApi(page, "/api/foundation/changes");
  expect(changes.status).toBe(200);
  expect(JSON.stringify(changes.body)).not.toMatch(/referenceRange|difference|direction|trend/);

  await page.goto("/records");
  await expect(page.getByTestId("durable-record")).toHaveCount(5);
```

- [ ] **Step 2: Add the research-consent and export flow on 데이터 관리**

Replace lines 366-373 (from `await page.goto("/data-control");` through `await expect(page.getByText("철회함", { exact: true }).first()).toBeVisible();`) with:

```ts
  await page.goto("/data-control");
  await expect(page.getByRole("heading", { name: "서비스 제공(결과지 처리)" })).toBeVisible();
  await expect(page.getByText("연구 동의 없이도 모든 기능을 쓸 수 있어요.", { exact: false })).toBeVisible();
  const documentRow = page.locator("article[data-purpose='DOCUMENT_EXTRACTION']");
  const researchRow = page.locator("article[data-purpose='RESEARCH_USE']");
  await expect(documentRow).toContainText("동의함");
  await expect(researchRow).toContainText("동의 전");

  // Research consent is stored only: granting and revoking it changes nothing else.
  await page.getByRole("button", { name: "연구 활용 동의", exact: true }).click();
  await expect(researchRow).toContainText("동의함");
  await expect(documentRow).toContainText("동의함");
  const consentsAfterGrant = await browserApi(page, "/api/foundation/consents");
  expect(consentsAfterGrant.status).toBe(200);
  expect(consentsAfterGrant.body).toMatchObject([
    { purposeCode: "DOCUMENT_EXTRACTION", status: "ACTIVE" },
    { purposeCode: "RESEARCH_USE", status: "ACTIVE", policyVersion: "research-consent-policy.v1" },
    { purposeCode: "RESEARCH_CONTACT", status: "NOT_GRANTED" },
  ]);
  await page.getByRole("button", { name: "연구 활용 동의 철회", exact: true }).click();
  await expect(researchRow).toContainText("철회함");
  await expect(documentRow).toContainText("동의함");
  const eventsAfterResearchRevoke = await browserApi(page, "/api/foundation/health-events");
  expect(eventsAfterResearchRevoke.status).toBe(200);
  expect(eventsAfterResearchRevoke.body).toHaveLength(5);

  // Export: the browser opens the core URL directly; the core's headers name the file.
  await expect(page.getByText("브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요.")).toBeVisible();
  const exportResponse = await page.request.get("/api/foundation/health-events/export");
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["content-type"]).toMatch(/^application\/json/);
  expect(exportResponse.headers()["content-disposition"]).toMatch(/^attachment; filename="alm-health-events-\d{8}\.json"$/);
  expect(exportResponse.headers()["cache-control"]).toBe("no-store");
  const exported = await exportResponse.json() as { schemaVersion: string; subjectKind: string; events: unknown[]; documents: unknown[] };
  expect(exported.schemaVersion).toBe("alm-health-events-export.v1");
  expect(exported.subjectKind).toBe("synthetic");
  expect(exported.events).toHaveLength(5);
  expect(exported.documents).toHaveLength(2);
  expect(JSON.stringify(exported)).not.toContain("referenceRange");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "내 기록 내보내기(JSON)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^alm-health-events-\d{8}\.json$/);

  const consentId = await page.locator("body").evaluate(async () => {
    const response = await fetch("/api/foundation/consents/document-extraction", { credentials: "include", cache: "no-store" });
    return String((await response.json()).consentId);
  });
  await page.getByRole("button", { name: "결과지 처리 동의 철회", exact: true }).click();
  await expect(documentRow).toContainText("철회함");
```

The following existing lines (`const blockedAfterRevocation = …` through the deletion and reload) stay as they are; Task 6 already renamed the button on line 462 in the zoom test.

- [ ] **Step 3: Run the browser lifecycle**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine' && pnpm foundation:e2e`
Expected: `3 passed` (the long lifecycle plus the two zoom variants). If the 최근 변화 assertion fails on the document order, check `gc_document.completed_at` for the two documents — the January document must be the later completion; the item strings are otherwise fixed by Task 5.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/web/e2e/foundation-lifecycle.spec.ts && git commit -m "test(e2e): 최근 변화 after two documents, research consent grant→revoke with the lifecycle continuing, export headers and download

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Gates, evidence document and ledger rows (PR deferred)

**Files:**
- Create: `docs/status/2026-09-17/wave2c.md`
- Modify: `docs/revision/ASTRA_PRODUCT_REBUILD.md:347` (add M13 after M12), `docs/roadmap/2026-09-02-roadmap.md:20` (add A11 after A10), `PROJECT_GUIDE.md:58` (the "Core API" row)

**Interfaces:**
- Consumes: gate outputs from the commands below.
- Produces: the evidence document and one sentence per ledger. `release/readiness.json` is not touched.

- [ ] **Step 1: Run every gate and capture the output**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'
pnpm security:runtime-policy
pnpm release:readiness:validate
pnpm security:github-actions-policy
pnpm web:test
pnpm --dir apps/web build
pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json
pnpm auth-security:gate
./gradlew.bat cleanTest test --no-daemon
pnpm medical-ai:native-text-gate
pnpm foundation:e2e
git status --short
```
Expected: `runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3`; `release-readiness: NO_GO 12 blocking gate(s) are not PASS` (exit 0, verdict unchanged); `github-actions-policy: PASS`; `Test Files 49 passed (49)`; Next build completes with all routes generated; `tsc` silent; `auth-security-gate: PASS`; `BUILD SUCCESSFUL` (aggregate across suites: the 4 new PostgreSQL tests + 7 projection tests added to the previous 142/3 skipped, 0 failures); native-text gate JSON with `"documentCount": 25` and `"passed": true`; `3 passed`; `git status` shows only the pre-existing untracked `apps/web/next-env.d.ts` change.

- [ ] **Step 2: Write the evidence document**

Create `docs/status/2026-09-17/wave2c.md` and replace every `<paste …>` with the captured output before committing:

```markdown
# Wave 2C evidence — What-changed API, consent purposes (V9), HealthEvent export (2026-09-17)

Branch `codex/wave6-changes-consent-export`. Synthetic only. Release remains NO_GO; no readiness gate or verdict changed. PR deferred.

## What exists now
- **What-changed.** `GET /api/foundation/changes` (owner-isolated, `Cache-Control: no-store`) returns `latestDocument` (the most recently completed document that still has CURRENT records), `items` (each CURRENT value of that document beside the latest-observed CURRENT value of the same concept code — or the same label when no code — from any other document; a different unit yields `previous = null`, no conversion), `newConcepts` and `unchangedCount`. Pure `ChangeSummaryProjection` with unit tests; no difference, direction, range, trend or judgement in the JSON or the copy. The home shows "최근 변화" with "새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요." and hides the section when there is nothing to list. The client-side two-date comparison on /records is unchanged.
- **Consent purposes (V9).** `gc_consent_grant.purpose_code` accepts `DOCUMENT_EXTRACTION | RESEARCH_USE | RESEARCH_CONTACT | PROJECT:[a-z0-9-]{1,40}`; one ACTIVE row per (subject, purpose) is still enforced. `GET /api/foundation/consents` lists the three fixed purposes in fixed order (NOT_GRANTED when absent) then existing PROJECT purposes; `POST /api/foundation/consents/{purposeCode}` grants with an Idempotency-Key and returns the existing ACTIVE row unchanged; revocation stays `POST /consents/{consentId}/revocation` and now reports the real purpose. Every lifecycle check still reads only DOCUMENT_EXTRACTION: a research consent id cannot open a document (`active_consent_required`), and the PostgreSQL test runs bootstrap → upload → review → records → export → deletion with research consent absent and then revoked. Audit rows `CONSENT_GRANTED`/`CONSENT_REVOKED` carry the purpose code in the new `gc_audit_event.purpose_code` column and nothing else. 데이터 관리 shows four rows with the fixed sentences and "연구 동의 없이도 모든 기능을 쓸 수 있어요."; there is no research pipeline and no contact channel, and a per-project consent will be asked again before any use. The `consentpurpose` module is untouched.
- **Export.** `GET /api/foundation/health-events/export` returns `{ schemaVersion: "alm-health-events-export.v1", exportedAt, subjectKind: "synthetic", events, documents[{documentId, observedOn?, status, abstentions}] }` as `application/json` with `Content-Disposition: attachment; filename="alm-health-events-<YYYYMMDD>.json"`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`; no `referenceRange` key; audit `HEALTH_EVENTS_EXPORTED` with no count and no value. 데이터 관리 links to the core URL directly (`<a download>`), disabled with "내보낼 기록이 없어요" when there are no events. Next.js gained no API route.

## Evidence (local, 2026-09-17)
| Gate | Result |
|---|---|
| runtime-policy | `<paste runtime-policy line>` |
| readiness validate | `<paste release-readiness line>` (exit 0; verdict unchanged) |
| github-actions-policy | `<paste line>` |
| web:test | `<paste Test Files / Tests lines>` |
| web build / tsc --noEmit | `<paste build summary>`; `tsc` produced no output |
| auth-security gate | `<paste line>` |
| gradlew cleanTest test (embedded PostgreSQL) | `<paste BUILD SUCCESSFUL line and the aggregated test/skipped/failure counts>` |
| medical-ai:native-text-gate | `<paste documentCount, fieldF1, passed, corpusId>` |
| foundation:e2e | `<paste N passed (time)>` |

## Limits
No hosted run. The what-changed list is a deterministic pairing of stored values; it computes no difference and makes no claim about direction or meaning. Research and project consents are records only: nothing reads them, no research pipeline exists, no contact is ever sent, and the copy says a per-project consent will be asked again. The export is the person's own synthetic events as one JSON file; it is not an interoperability format (no CSV/FHIR) and contains no reference range. Nothing here is a diagnosis, normality, reference-range, trend or risk claim. Readiness is unchanged.
```

- [ ] **Step 3: Add the ledger rows**

In `docs/revision/ASTRA_PRODUCT_REBUILD.md`, after the M12 row (line 347) add:

```markdown
| M13 최근 변화 API · 목적별 동의(V9) · 기록 내보내기 | implemented locally; `GET /changes` pairs the latest document's values with the previous value of the same concept without judgement, consent is stored per purpose with research consent never a lifecycle condition, `GET /health-events/export` downloads the person's events directly from the core; see `docs/status/2026-09-17/wave2c.md` |
```

In `docs/roadmap/2026-09-02-roadmap.md`, after the A10 row (line 20) add:

```markdown
| A11 | What-changed API + home "최근 변화" (values side by side, no judgement), consent purposes V9 (service / research use / research contact / per project; research consent stored only, never a condition), HealthEvent JSON export as a direct core download | `docs/status/2026-09-17/wave2c.md` | implemented locally |
```

In `PROJECT_GUIDE.md` §2, change the "Core API" row (line 58) to:

```markdown
| Core API | Spring/Kotlin authority for sessions, CSRF/origin checks, consent, lifecycle, provenance, audit, and deletion in the synthetic foundation. Since Wave 2C it also serves the judgement-free what-changed summary, per-purpose consent (research consent stored only, never a condition) and the person's own HealthEvent export (`docs/status/2026-09-17/wave2c.md`) |
```

- [ ] **Step 4: Inspect the diff for anything that must not be committed**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && git status --short && git diff --stat && git ls-files --others --exclude-standard | grep -E '\.(pdf|png|json)$' ; echo "exit $?" && grep -n "referenceRange" docs/status/2026-09-17/wave2c.md`
Expected: only the four documentation files are modified/untracked (plus the pre-existing `apps/web/next-env.d.ts`, which stays unstaged); the PDF/PNG/JSON grep prints nothing (`exit 1`); the `referenceRange` grep hits only the sentence stating that the export has no such key.

- [ ] **Step 5: Commit the evidence (no PR)**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add docs/status/2026-09-17/wave2c.md docs/revision/ASTRA_PRODUCT_REBUILD.md docs/roadmap/2026-09-02-roadmap.md PROJECT_GUIDE.md && git commit -m "docs: Wave 2C evidence — what-changed API, consent purposes V9, HealthEvent export

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Stop here. Do not push and do not open a PR; the founder decides when the branch goes up.

---

## Self-review

**Spec coverage.** §0/§1 boundaries → Global Constraints; judgement-free values only → Tasks 1, 5 (tests assert no arrow/direction words and `.strict()` refuses extra keys), 8; no Next.js route → Task 7 (`<a href download>` to the core URL) and the copy test forbidding `/api/export`; research consent stored only and never a condition → Task 3 (`findConsentStatus` keeps the DOCUMENT_EXTRACTION filter; the invariant test runs the whole lifecycle with research consent absent then revoked, including export via Task 4) and Task 6 copy; readiness untouched → Task 9; audit without values/dates → Tasks 3 and 4 tests. §2 endpoint, response shape, rules, pure function, unit tests, home section and copy, hide when empty, `.strict()` → Tasks 1, 2, 5. §3 V9 CHECK, unique index kept, policy versions, `GET /consents` order, `POST /consents/{purposeCode}` with Idempotency-Key and same receipt when ACTIVE, revocation via the existing endpoint, document-extraction endpoints unchanged, PostgreSQL invariants (lifecycle with research consent absent/revoked, grant/revoke isolation, PROJECT prefix validation, audit with purpose code only), four-row UI with the exact sentences → Tasks 3 and 6. §4 export headers, body, no reference range, audit, link and copy, disabled state → Tasks 4, 7. §5 copy scan → Tasks 5, 6, 7. §6 Kotlin unit, PostgreSQL integration, zod/component tests, e2e (최근 변화 after two documents; research consent grant→revoke then lifecycle continues; export headers + download event), gates, evidence doc, ledger/roadmap/guide sentences → Tasks 1–9. §7 out of scope → nothing added (no CSV/FHIR, no project creation UI, no difference computation, no design change).

**Adjusted requirement (spec §3 audit).** "감사 이벤트에 목적 코드만": `gc_audit_event` had no column that could hold a purpose code without overloading `resource_type` (VARCHAR(40), too short for `PROJECT:` + 40). V9 adds a nullable, CHECK-constrained `purpose_code` column; the audit row still carries no value, date or policy text.

**Adjusted requirement (spec §2 previous rule).** "같은 단위의 … 가장 늦은 것 … 단위가 다르면 previous = null" is implemented as: take the latest observed record of the same concept from other documents, then null it if its unit differs — no fallback to an older same-unit record, so a unit change is surfaced rather than papered over.

**Placeholder scan.** The only `<paste …>` markers are in Task 9's evidence table and must be replaced with captured output before the commit.

**Type consistency.** `DocumentCompletionRow(documentId, completedAt)` produced by `listDocumentCompletions` (Task 2) and consumed by `ChangeSummaryProjection.project(records, documents)` (Task 1). `ChangeSummary{latestDocument?, items[ChangeItem{conceptCode?, concept, unit, latest: ChangeValue, previous?: ChangeValue}], newConcepts, unchangedCount}` ↔ `changeSummarySchema` (Task 5, `latestDocument`/`previous` `.nullable().optional()` because Jackson `non_null` omits them) ↔ `RecentChanges` item text ↔ Task 8 strings. `ConsentReceipt{consentId?, purposeCode, status, policyVersion, grantedAt?, revokedAt?}` (Task 3) ↔ `consentPurposeSchema` (Task 6) ↔ msw rows in the data-control test ↔ `toMatchObject` in Task 8. `grantConsent(principal, purposeCode, idempotencyKey: String?)` is called with `null` by `grantDocumentConsent` and with the header by the controller; the web `grantConsent(purposeCode, idempotencyKey)` always sends the header. `revokeConsent` now returns `ConsentReceipt` in the service, and the controller maps it to the unchanged `ConsentResponse` with the real `purposeCode`; the web `consentSchema.purposeCode` is widened accordingly. `HealthEventExport{schemaVersion, exportedAt, subjectKind, events, documents[ExportedDocument]}` (Task 4) ↔ the browser assertions in Task 8. Button names `"결과지 처리 동의 철회"` etc. are produced by `` `${row.short} 동의 철회` `` (Task 6) and used verbatim in the data-control test and the e2e (Tasks 6, 8).
