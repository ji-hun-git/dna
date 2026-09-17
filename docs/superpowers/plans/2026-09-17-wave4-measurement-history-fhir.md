# Wave 4 — 측정 이력(series), FHIR export, PR #5 F-3, Wave 3 minors, visual-language pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect the person's confirmed values of the same item in exam-date order (table, three computed numbers, a plain graph of their own values — no direction, meaning or forecast), let them download their records as a FHIR R4 Bundle, close PR #5 finding F-3 and the Wave 3 minors, and pilot the new visual language on the one 측정 이력 screen.

**Architecture:** A pure `SeriesProjection` groups CURRENT record rows by the `ChangeSummaryProjection.conceptsMatch` rule **and** unit, orders points in time, and derives three numbers with `BigDecimal` arithmetic; `GET /api/foundation/series` serves it. A pure `FhirObservationMapper` turns the same rows into hand-written Bundle/Observation DTOs (no new dependency) served by `GET /api/foundation/health-events/export/fhir`. The web adds a strict zod `getSeries()`, a second export link, and `/my-data/history` whose geometry lives in a pure, unit-tested `history-layout.ts`; the screen's visual tokens are isolated in one CSS module and come from the founder-approved mockup notes.

**Tech Stack:** Kotlin 2.3.21 / Java 21 / Gradle 8.14.3 (`./gradlew.bat`), Spring Boot 3.5.16 + JdbcTemplate + Flyway, JUnit 5 + AssertJ + MockMvc, PDFBox; Next 16.3.3 / React 19 / zod 4 / vitest + Testing Library + jest-axe + msw / Playwright 1.62; pnpm 11.20.0, Node 24.20.0; embedded PostgreSQL 16 for gated JVM tests and the browser lifecycle.

Spec: `docs/superpowers/specs/2026-09-17-wave4-measurement-history-fhir-design.md` (founder-approved 2026-09-17). Gate documents: `governance/intended-use-decision-measurement-history-2026-09-17.md` (item (c), "숫자 + 단순 그래프") and `governance/intended-use-decision-reference-range-and-delta-addendum-2026-09-17.md` (FHIR `referenceRange.text`) — both already committed as the branch's first commit (`4e363ca`), which is the precondition for this code. Authority: `PROJECT_GUIDE.md` §6, `AGENTS.md`. Previous wave: `docs/superpowers/plans/2026-09-17-wave3-reference-range-delta.md`, evidence `docs/status/2026-09-17/wave3.md`.

## Global Constraints

- Toolchain: Node `24.20.0`, pnpm `11.20.0`, Java `21`. In every Git Bash shell first run `export PATH="$HOME/.gc-node24:$PATH"`. Gradle is `./gradlew.bat` from the repository root `C:/Users/Jason/Documents/genome-companion-korea-ux`. Core PostgreSQL tests: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'` then `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon` (`cleanTest` is required to re-run them). Worker: `./gradlew.bat :apps:document-worker:test --no-daemon`. Web: `pnpm web:test`, `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`, `pnpm medical-ai:native-text-gate`. Browser: additionally `export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'`, then `pnpm foundation:e2e`.
- Branch: everything except Task 6 goes on `codex/wave8-measurement-history-fhir` (this worktree, stacked on PR #11). Task 6 works only on `codex/unified-health-product` in a temporary worktree. Never push to `main`. Never stage `apps/web/next-env.d.ts`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Boundary (spec §1): no reference band, threshold, target or population comparison. No regression line, trend line, value-inventing interpolation, slope label or forecast. Colour, width, icon and motion carry no meaning about a value (colour identifies a series or a position in time only). No sentence about direction, speed or meaning.
- Copy scan (spec §1): the forbidden list in `apps/web/tests/korean-ux-copy.test.ts` keeps `상승`, `하락`, `증가`, `감소` and gains `빨라`, `느려`, `좋아`, `나빠`, `추세`.
- Reference-range text appears on no screen and in no response except the JSON export and the FHIR export.
- Next.js gains no API route, token or authorization rule. `release/readiness.json` unchanged. Synthetic data only. Audit rows carry no value, no count and no date. Jackson `fail-on-unknown-properties: true` and `default-property-inclusion: non_null` stay global: the server omits null keys, so every optional zod key is `.optional()` inside a `.strict()` object, and every schema change updates `apps/web/tests/fixtures/foundation.ts`.
- Series API (spec §2): `GET /api/foundation/series`, owner-isolated, `Cache-Control: no-store`, CURRENT records only. Response `{ "series": [ { "conceptCode"?, "concept", "unit", "points": [ { "eventId", "value", "observedOn", "documentId" } ], "derived": { "lastDifference"?: { "absolute", "percent"? }, "per30Days"?, "meanOfLast3"? } } ] }`. Group: same rule as `ChangeSummaryProjection.conceptsMatch` (same `concept_code`, otherwise same label) **and** same unit; different units are separate series (no conversion). Series order: label, unit. Point order: `observedOn`, `confirmedAt`, `recordId` string.
- Derived numbers (spec §2), always in time order: `lastDifference` = `ChangeDeltaCalculator.compute(last, previous)` with Wave 3's narrowed rules (percent only when previous > 0 and the unit is not `%`), omitted under 2 points. `per30Days` = `absolute / days × 30`, `HALF_EVEN`, scale = larger input scale + 1, sign explicit, zero unsigned; omitted when the two dates are equal. `meanOfLast3` = arithmetic mean of the last three values, `HALF_EVEN`, scale = largest input scale + 1, no plus sign; omitted under 3 points or when any value is not numeric.
- Screen (spec §3): route `/my-data/history`; entries "측정 이력" (top of 내 데이터) and "이 항목의 측정 이력 보기" (evidence drawer); global navigation keeps its two destinations. y-axis = that series' own min–max (one point or all equal → horizontal middle); straight segments only; ribbon thickness fixed; axis ticks only at real exam dates. Exact copy: `점은 확인한 값이고, 점 사이의 선은 값이 아니에요. 선의 모양이 건강 상태를 뜻하지 않아요.`; `마지막 두 값의 차이`; `30일로 환산한 차이`; `최근 3회 평균`; `뺄셈과 나눗셈으로만 계산했어요. 의미는 판단하지 않아요.`. SVG `role="img"` + summary `aria-label`; anchors keyboard-focusable; one-point series = table only; empty, error and retry states; no motion under `prefers-reduced-motion`; lime is fill-only (never text), AA contrast kept.
- CI renders with Linux fonts: every new layout uses `minmax(0,1fr)` / `min-width:0` / a scrolling table wrapper / `overflow-wrap:anywhere`; the e2e `captureMatrix` fails on any 320px horizontal overflow.
- FHIR export (spec §4): `GET /api/foundation/health-events/export/fhir`; `Content-Type: application/fhir+json`; `Content-Disposition: attachment; filename="alm-health-events-<YYYYMMDD>.fhir.json"`; `no-store`, `nosniff`. `Bundle` `type: "collection"`, `timestamp`, `meta.tag = [{system: "https://alm.example/fhir/tag", code: "synthetic"}]`. Each `Observation`: `id` = eventId, `status: "final"`, `category` laboratory, `code = {coding: [{system: "http://loinc.org", code}] (only when the concept table has a LOINC), text: label}`, `effectiveDateTime` = `YYYY-MM-DD`, `valueQuantity = {value: number, unit}` (or `valueString` when not numeric), `referenceRange: [{text}]` (only when text exists; no low/high), `note: [{text: "본인이 값을 수정함"}]` on a corrected record. No `interpretation`, `subject`, `performer`. No new dependency. Audit `HEALTH_EVENTS_EXPORTED`. The existing JSON export's filename, headers and audit row do not change.
- Web export copy: link `내 기록 내보내기(FHIR)`, help `다른 건강기록 도구가 읽을 수 있는 형식이에요.`; disabled at 0 events.
- e2e upload order stays July first, then January. `/changes` therefore omits `delta` there, while `/series` is time-ordered and **does** carry `lastDifference`. Expected e2e values (July 총콜레스테롤 corrected 188→190 on 2026-07-28, 당화혈색소 5.2 re-dated 2026-07-27, 비타민 D July excluded; January 194 / 5.4 / 45 on 2026-01-15): 총콜레스테롤 `-4 mg/dL (-2.1%)`, `-0.6 mg/dL`; 당화혈색소 `-0.2 %`, `-0.03 %`; 비타민 D one point, nothing derived. Series order on screen: 당화혈색소, 비타민 D, 총콜레스테롤.
- Gates before finishing (Task 9): `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `pnpm web:test`, `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`, `pnpm --dir apps/web build`, `pnpm auth-security:gate`, `pnpm security:github-actions-policy`, `./gradlew.bat cleanTest test --no-daemon` with `GC_TEST_POSTGRES_URL`, `pnpm medical-ai:native-text-gate`, `pnpm foundation:e2e`.

### Decisions this plan makes where the spec is silent

1. `conceptsMatch` is not transitive, so a series is a connected component under "conceptsMatch and equal unit". The series' `concept`/`unit` come from its latest point; `conceptCode` is the latest non-null code in the series.
2. `derived` is always present; with nothing computable it serialises as `{}`.
3. The FHIR audit row is `event_type = HEALTH_EVENTS_EXPORTED`, `resource_type = EXPORT_FHIR` (`gc_audit_event.event_type`/`resource_type` have no CHECK constraint; `purpose_code` does, so it is not used). No migration.
4. The FHIR `note` is emitted only when the value differs from the parser's value (its text says "값"); a date-only correction has no note.
5. An empty Bundle omits `entry` (FHIR forbids empty arrays); `Bundle.timestamp` is truncated to milliseconds.
6. `SeriesPoint` has no `recordId`, so "출처 보기" links to `/my-data#event-<eventId>` and 내 데이터 opens that event's evidence drawer from the hash. The drawer's history link is `/my-data/history#event-<eventId>`.
7. Graph x positions are proportional to the exam date; points that would overlap are nudged apart and the screen says so (same disclosure pattern as Wave 3 F7).
8. Two ranges on one row are kept only when the row already parses as a measurement today (no row changes between measurement and abstention).

---

## File map

| Path | Responsibility |
|---|---|
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/SeriesProjection.kt` (create) | series DTOs, grouping, ordering, three derived numbers |
| `.../foundation/ChangeDelta.kt`, `ChangeSummaryProjection.kt` (modify) | `parse`/`signed`/`conceptsMatch` become `internal` |
| `.../foundation/FhirExport.kt` (create) | Bundle/Observation DTOs, `FhirObservationMapper` |
| `.../foundation/FoundationLifecycleService.kt`, `FoundationLifecycleController.kt` (modify) | `getSeries`, `exportHealthEventsAsFhir`, two GET mappings |
| `apps/core-api/src/test/kotlin/.../foundation/{SeriesProjectionTest,FhirObservationMapperTest}.kt` (create), `FoundationLifecyclePostgresIntegrationTest.kt` (modify) | core tests |
| `apps/document-worker/.../NativeTextExtractionProvider.kt` + its test (modify) | two ranges on a row |
| `apps/web/lib/foundation/client.ts`, `apps/web/tests/{foundation-client.test.ts,fixtures/foundation.ts}` (modify) | zod series schema, `getSeries()` |
| `apps/web/components/integrated/IntegratedDataControl.tsx`, `apps/web/tests/{integrated-data-control.test.tsx,korean-ux-copy.test.ts}` (modify) | FHIR link, copy scan |
| `apps/web/lib/medical-ai/medgemma-report.ts`, `apps/web/tests/medgemma-report.test.ts` (modify) | `referenceRangeAccuracy` row |
| `apps/web/components/my-data/LivingCellCanvas.tsx`, `apps/web/tests/living-cell-canvas.test.tsx` (modify) | `cellArrived` cleared on `animationend` |
| `apps/web/lib/my-data/history-layout.ts`, `apps/web/tests/history-layout.test.ts` (create) | pure graph geometry |
| `apps/web/components/my-data/history/{MeasurementHistory,HistoryGraph}.tsx`, `History.module.css`, `apps/web/app/my-data/history/page.tsx` (create) | the screen |
| `apps/web/components/my-data/{MyData,EvidenceDrawer}.tsx`, `apps/web/tests/{my-data,evidence-drawer,measurement-history}.test.tsx` (modify/create) | entries, hash selection, screen tests |
| `apps/web/e2e/foundation-lifecycle.spec.ts` (modify) | history, series, FHIR assertions |
| `docs/status/2026-09-17/wave4.md` (create); `AGENTS.md`, `PROJECT_GUIDE.md`, `docs/roadmap/2026-09-02-roadmap.md` (modify) | evidence and ledger |
| (other branch) `apps/web/components/integrated/IntegratedHealthExperience.tsx`, `apps/web/lib/foundation/messages.ts`, tests | PR #5 F-3 |

---

### Task 1: Pure `SeriesProjection` with the three derived numbers

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/SeriesProjection.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeDelta.kt` (`parse`, `signed`: `private` → `internal`)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjection.kt` (`conceptsMatch`: `private` → `internal`)
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/SeriesProjectionTest.kt`

**Interfaces:**
- Consumes: `FoundationRecordRow`, `ChangeDelta`, `ChangeDeltaCalculator.compute(latest: String, previous: String): ChangeDelta?`.
- Produces: `data class SeriesPoint(eventId: UUID, value: String, observedOn: String, documentId: UUID)`, `data class SeriesDerived(lastDifference: ChangeDelta?, per30Days: String?, meanOfLast3: String?)`, `data class MeasurementSeries(conceptCode: String?, concept: String, unit: String, points: List<SeriesPoint>, derived: SeriesDerived)`, `data class SeriesResponse(series: List<MeasurementSeries>)`, `SeriesProjection.project(records: List<FoundationRecordRow>): SeriesResponse`; `internal fun ChangeDeltaCalculator.parse(raw: String): BigDecimal?` (Task 3 uses it), `internal fun ChangeDeltaCalculator.signed(value: BigDecimal): String`.

- [ ] **Step 1: Write the failing test**

Create `SeriesProjectionTest.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class SeriesProjectionTest {
    private val document = UUID.fromString("11111111-1111-4111-8111-111111111111")

    private fun row(
        label: String,
        value: String,
        observedOn: String,
        unit: String = "mg/dL",
        conceptCode: String? = "total-cholesterol",
        status: String = "CURRENT",
        confirmedAt: String = "2026-08-01T00:00:00Z",
        recordId: UUID = UUID.randomUUID(),
    ) = FoundationRecordRow(
        recordId = recordId,
        recordVersionId = UUID.randomUUID(),
        supersedesVersionId = null,
        candidateId = UUID.randomUUID(),
        documentId = document,
        subjectId = "synthetic-jason",
        status = status,
        label = label,
        currentValue = value,
        originalValue = value,
        unit = unit,
        observedOn = LocalDate.parse(observedOn),
        confirmedAt = Instant.parse(confirmedAt),
        correctionReason = null,
        evidencePage = 1,
        sourceTextSha256 = "b".repeat(64),
        documentSha256 = "a".repeat(64),
        conceptCode = conceptCode,
        referenceRangeText = "120-199",
    )

    @Test
    fun groupsByConceptAndUnitSortsSeriesByLabelThenUnitAndPointsInTimeOrder() {
        val july = row("총콜레스테롤", "188", "2026-07-28")
        val january = row("총콜레스테롤", "194", "2026-01-15")
        val otherUnit = row("총콜레스테롤", "4.9", "2026-03-01", unit = "mmol/L")
        val hba1c = row("당화혈색소", "5.2", "2026-07-28", unit = "%", conceptCode = "hba1c")
        val superseded = row("총콜레스테롤", "999", "2026-02-01", status = "SUPERSEDED")

        val response = SeriesProjection.project(listOf(july, otherUnit, hba1c, superseded, january))

        assertThat(response.series.map { it.concept to it.unit })
            .containsExactly("당화혈색소" to "%", "총콜레스테롤" to "mg/dL", "총콜레스테롤" to "mmol/L")
        val cholesterol = response.series[1]
        assertThat(cholesterol.conceptCode).isEqualTo("total-cholesterol")
        assertThat(cholesterol.points).containsExactly(
            SeriesPoint(january.recordVersionId, "194", "2026-01-15", document),
            SeriesPoint(july.recordVersionId, "188", "2026-07-28", document),
        )
        assertThat(response.toString()).doesNotContain("999", "120-199")
    }

    @Test
    fun ordersTwoPointsOfTheSameDayByConfirmationInstantThenRecordIdText() {
        val idA = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
        val idB = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
        val late = row("총콜레스테롤", "3", "2026-07-28", confirmedAt = "2026-08-02T00:00:00Z")
        val tieB = row("총콜레스테롤", "2", "2026-07-28", recordId = idB)
        val tieA = row("총콜레스테롤", "1", "2026-07-28", recordId = idA)

        val series = SeriesProjection.project(listOf(late, tieB, tieA)).series.single()

        assertThat(series.points.map { it.value }).containsExactly("1", "2", "3")
        // Same date: the difference is still arithmetic on the last two, but nothing is scaled to 30 days.
        assertThat(series.derived.lastDifference).isEqualTo(ChangeDelta("+1", "+50.0"))
        assertThat(series.derived.per30Days).isNull()
        assertThat(series.derived.meanOfLast3).isEqualTo("2.0")
    }

    @Test
    fun matchesAnUncodedRecordToItsCodedSelfByNormalizedLabel() {
        val coded = row("총콜레스테롤", "194", "2026-01-15")
        val uncoded = row(" 총콜레스테롤 ", "188", "2026-07-28", conceptCode = null)

        val series = SeriesProjection.project(listOf(uncoded, coded)).series.single()

        assertThat(series.points).hasSize(2)
        assertThat(series.conceptCode).isEqualTo("total-cholesterol")
        assertThat(series.concept).isEqualTo(" 총콜레스테롤 ")
    }

    @Test
    fun derivesNothingFromOnePointAndTheDifferenceAndThirtyDayScalingFromTwo() {
        val single = SeriesProjection.project(listOf(row("총콜레스테롤", "194", "2026-01-15"))).series.single()
        assertThat(single.derived).isEqualTo(SeriesDerived(null, null, null))

        // 2026-01-15 → 2026-07-28 is 194 days: -6 / 194 × 30 = -0.9278… → -0.9 (scale 0 + 1).
        val two = SeriesProjection.project(
            listOf(row("총콜레스테롤", "188", "2026-07-28"), row("총콜레스테롤", "194", "2026-01-15")),
        ).series.single()
        assertThat(two.derived).isEqualTo(SeriesDerived(ChangeDelta("-6", "-3.1"), "-0.9", null))
    }

    @Test
    fun meanOfTheLastThreeUsesOnlyTheLastThreeAtOneMoreDecimalThanTheInputs() {
        val series = SeriesProjection.project(
            listOf(
                row("총콜레스테롤", "500", "2025-01-15"),
                row("총콜레스테롤", "194", "2026-01-15"),
                row("총콜레스테롤", "188", "2026-04-15"),
                row("총콜레스테롤", "192", "2026-07-28"),
            ),
        ).series.single()
        assertThat(series.derived.meanOfLast3).isEqualTo("191.3")

        val decimals = SeriesProjection.project(
            listOf(
                row("당화혈색소", "5.4", "2026-01-15", unit = "%", conceptCode = "hba1c"),
                row("당화혈색소", "5.25", "2026-04-15", unit = "%", conceptCode = "hba1c"),
                row("당화혈색소", "5.2", "2026-07-28", unit = "%", conceptCode = "hba1c"),
            ),
        ).series.single()
        assertThat(decimals.derived.meanOfLast3).isEqualTo("5.283")
    }

    @Test
    fun aPercentUnitKeepsTheAbsoluteDifferenceOnlyAndStillScalesToThirtyDays() {
        val series = SeriesProjection.project(
            listOf(
                row("당화혈색소", "5.4", "2026-01-15", unit = "%", conceptCode = "hba1c"),
                row("당화혈색소", "5.2", "2026-07-28", unit = "%", conceptCode = "hba1c"),
            ),
        ).series.single()
        assertThat(series.derived.lastDifference).isEqualTo(ChangeDelta("-0.2", null))
        assertThat(series.derived.per30Days).isEqualTo("-0.03")
    }

    @Test
    fun roundsHalfEvenKeepsZeroUnsignedAndOmitsEverythingForANonNumericValue() {
        // 2026-01-01 → 2026-05-01 is 120 days: +1 / 120 × 30 = 0.25 → HALF_EVEN → +0.2 (HALF_UP would say +0.3).
        val tie = SeriesProjection.project(
            listOf(row("총콜레스테롤", "10", "2026-01-01"), row("총콜레스테롤", "11", "2026-05-01")),
        ).series.single()
        assertThat(tie.derived.per30Days).isEqualTo("+0.2")

        val zero = SeriesProjection.project(
            listOf(row("총콜레스테롤", "10", "2026-01-01"), row("총콜레스테롤", "10", "2026-05-01")),
        ).series.single()
        assertThat(zero.derived.lastDifference).isEqualTo(ChangeDelta("0", "0.0"))
        assertThat(zero.derived.per30Days).isEqualTo("0.0")

        val text = SeriesProjection.project(
            listOf(
                row("요단백", "1", "2026-01-01", unit = "mg/dL", conceptCode = null),
                row("요단백", "2", "2026-03-01", unit = "mg/dL", conceptCode = null),
                row("요단백", "음성", "2026-05-01", unit = "mg/dL", conceptCode = null),
            ),
        ).series.single()
        assertThat(text.derived).isEqualTo(SeriesDerived(null, null, null))
        assertThat(text.points.map { it.value }).containsExactly("1", "2", "음성")
    }

    @Test
    fun theResultDoesNotDependOnInputOrder() {
        val rows = listOf(
            row("총콜레스테롤", "194", "2026-01-15"),
            row("총콜레스테롤", "188", "2026-07-28"),
            row("당화혈색소", "5.2", "2026-07-28", unit = "%", conceptCode = "hba1c"),
            row("비타민 D", "45", "2026-01-15", unit = "ng/mL", conceptCode = "vitamin-d"),
        )
        assertThat(SeriesProjection.project(rows.reversed())).isEqualTo(SeriesProjection.project(rows))
        assertThat(SeriesProjection.project(emptyList())).isEqualTo(SeriesResponse(emptyList()))
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.SeriesProjectionTest"`
Expected: compilation error `Unresolved reference 'SeriesProjection'`.

- [ ] **Step 3: Open the two helpers and write the projection**

In `ChangeDelta.kt` change `private fun parse(raw: String): BigDecimal?` to `internal fun parse(raw: String): BigDecimal?` and `private fun signed(value: BigDecimal): String` to `internal fun signed(value: BigDecimal): String`. In `ChangeSummaryProjection.kt` change `private fun conceptsMatch(` to `internal fun conceptsMatch(`. Nothing else in those files changes.

Create `SeriesProjection.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.temporal.ChronoUnit
import java.util.UUID

/** One confirmed value in a series. `eventId` is the CURRENT record version, as in HealthEvent. */
data class SeriesPoint(
    val eventId: UUID,
    val value: String,
    val observedOn: String,
    val documentId: UUID,
)

/**
 * Plain arithmetic on the person's own values, always in time order
 * (governance/intended-use-decision-measurement-history-2026-09-17.md). Each member is null —
 * and therefore omitted from the JSON — when it cannot be computed. No direction, no meaning.
 */
data class SeriesDerived(
    /** `ChangeDeltaCalculator.compute(last, previous)`; percent dropped for a `%` unit. */
    val lastDifference: ChangeDelta? = null,
    /** `absolute / days × 30`, HALF_EVEN, one more decimal than the inputs, sign explicit, zero unsigned. */
    val per30Days: String? = null,
    /** Arithmetic mean of the last three values, HALF_EVEN, one more decimal than the inputs. */
    val meanOfLast3: String? = null,
)

data class MeasurementSeries(
    val conceptCode: String?,
    val concept: String,
    val unit: String,
    val points: List<SeriesPoint>,
    val derived: SeriesDerived,
)

data class SeriesResponse(val series: List<MeasurementSeries>)

object SeriesProjection {
    private val thirty = BigDecimal(30)
    private val three = BigDecimal(3)
    private val chronological = compareBy<FoundationRecordRow> { it.observedOn }
        .thenBy { it.confirmedAt }
        .thenBy { it.recordId.toString() }

    /**
     * A series is a connected component of CURRENT records under "same concept
     * ([ChangeSummaryProjection.conceptsMatch]) and same unit". Components, not first-match
     * grouping, because conceptsMatch is not transitive; the input is put in a canonical order
     * first so the result is a function of the record set, not of its order. No unit conversion.
     */
    fun project(records: List<FoundationRecordRow>): SeriesResponse {
        val current = records
            .filter { it.status == "CURRENT" }
            .sortedWith(compareBy<FoundationRecordRow> { it.documentId.toString() }.thenBy { it.recordId.toString() })
        val parent = IntArray(current.size) { it }
        fun find(index: Int): Int {
            var root = index
            while (parent[root] != root) root = parent[root]
            return root
        }
        for (i in current.indices) {
            for (j in i + 1 until current.size) {
                if (current[i].unit == current[j].unit && ChangeSummaryProjection.conceptsMatch(current[i], current[j])) {
                    val rootI = find(i)
                    val rootJ = find(j)
                    if (rootI != rootJ) parent[rootI] = rootJ
                }
            }
        }
        val series = current.indices
            .groupBy { find(it) }
            .values
            .map { members -> toSeries(members.map { current[it] }.sortedWith(chronological)) }
        return SeriesResponse(
            series.sortedWith(
                compareBy<MeasurementSeries> { it.concept }.thenBy { it.unit }.thenBy { it.points.first().eventId.toString() },
            ),
        )
    }

    private fun toSeries(rows: List<FoundationRecordRow>): MeasurementSeries {
        val last = rows.last()
        return MeasurementSeries(
            conceptCode = rows.lastOrNull { it.conceptCode != null }?.conceptCode,
            concept = last.label,
            unit = last.unit,
            points = rows.map { SeriesPoint(it.recordVersionId, it.currentValue, it.observedOn.toString(), it.documentId) },
            derived = derive(rows),
        )
    }

    private fun derive(rows: List<FoundationRecordRow>): SeriesDerived {
        if (rows.size < 2) return SeriesDerived()
        val last = rows[rows.size - 1]
        val previous = rows[rows.size - 2]
        val lastDifference = ChangeDeltaCalculator.compute(last.currentValue, previous.currentValue)
            ?.let { delta -> if (last.unit.trim() == "%") delta.copy(percent = null) else delta }
        return SeriesDerived(
            lastDifference = lastDifference,
            per30Days = per30Days(last, previous),
            meanOfLast3 = meanOfLast3(rows),
        )
    }

    private fun per30Days(last: FoundationRecordRow, previous: FoundationRecordRow): String? {
        val lastNumber = ChangeDeltaCalculator.parse(last.currentValue) ?: return null
        val previousNumber = ChangeDeltaCalculator.parse(previous.currentValue) ?: return null
        val days = ChronoUnit.DAYS.between(previous.observedOn, last.observedOn)
        if (days <= 0L) return null
        val scale = maxOf(lastNumber.scale(), previousNumber.scale()) + 1
        return ChangeDeltaCalculator.signed(
            lastNumber.subtract(previousNumber).multiply(thirty).divide(BigDecimal(days), scale, RoundingMode.HALF_EVEN),
        )
    }

    private fun meanOfLast3(rows: List<FoundationRecordRow>): String? {
        if (rows.size < 3) return null
        val values = rows.takeLast(3).map { ChangeDeltaCalculator.parse(it.currentValue) ?: return null }
        val scale = values.maxOf { it.scale() } + 1
        return values.reduce(BigDecimal::add).divide(three, scale, RoundingMode.HALF_EVEN).toPlainString()
    }
}
```

(`observedOn` is a `LocalDate` on the row, so the spec's "date cannot be parsed" case cannot occur here; equal dates are the only omission.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.SeriesProjectionTest" --tests "kr.co.genomecompanion.foundation.ChangeDeltaTest" --tests "kr.co.genomecompanion.foundation.ChangeSummaryProjectionTest"`
Expected: `BUILD SUCCESSFUL`, 8 new tests pass, the two existing classes unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/SeriesProjection.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeDelta.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjection.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/SeriesProjectionTest.kt
git commit -m "feat(core): pure measurement-series projection with three computed numbers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `GET /api/foundation/series`

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt` (next to `getChangeSummary`, ~line 606)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt` (next to `getChanges`, ~line 339)
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `SeriesProjection.project(records: List<FoundationRecordRow>): SeriesResponse` (Task 1), `repository.listRecords(subjectId)`.
- Produces: `FoundationLifecycleService.getSeries(principal: FoundationPrincipal): SeriesResponse`; HTTP `GET /api/foundation/series`; test helper `importJulyWithRange(client, consentId, keyPrefix): List<JsonNode>` (Task 3 reuses it).

- [ ] **Step 1: Write the failing PostgreSQL test**

In `FoundationLifecyclePostgresIntegrationTest.kt` add this helper next to `importSyntheticDocument`:

```kotlin
    /** The July document whose first row prints the range `120-199` (stored, exported only). */
    private fun importJulyWithRange(client: TestClient, consentId: UUID, keyPrefix: String): List<JsonNode> {
        val documentId = requestDocument(client, consentId, fixturePdf, "$keyPrefix-document-request")
        uploadDocument(client, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), client).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = listOf(
                ExtractedCandidate(1, "Cholesterol", "188", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64), "120-199"),
                ExtractedCandidate(2, "HbA1c", "5.2", "%", "2026-07-28", 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64), null),
                ExtractedCandidate(3, "Vitamin D", "42", "ng/mL", "2026-07-28", 1, EvidenceBox(0.08, 0.18, 0.25, 0.02), "3".repeat(64), null),
            ),
        )
        return responseJson(
            read(get("/api/foundation/documents/$documentId/candidates"), client)
                .andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).toList()
    }
```

and this test after `changesListTheLatestDocumentValuesBesideThePreviousValueOfTheSameConcept`:

```kotlin
    @Test
    fun seriesListCurrentValuesInTimeOrderWithThreeComputedNumbersAndNoRangeText() {
        mockMvc.perform(get("/api/foundation/series")).andExpect(status().isUnauthorized)
        val alice = login("synthetic-alice")
        val bob = login("synthetic-bob")
        val consentId = grantConsent(alice)

        read(get("/api/foundation/series"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.series.length()").value(0))

        // July is uploaded first, January second: the series is ordered by exam date, not upload order.
        val july = importJulyWithRange(alice, consentId, "series-july")
        confirmEveryCandidate(alice, july, "series-july")
        val january = importSyntheticDocument(alice, consentId, januaryFixturePdf, januaryFixtureDigest, "series-january")
        confirmEveryCandidate(alice, january, "series-january")

        val records = responseJson(
            read(get("/api/foundation/records"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).toList()
        val julyCholesterol = records.single { it["label"].asText() == "총콜레스테롤" && it["observedOn"].asText() == "2026-07-28" }
        mutate(
            post("/api/foundation/records/${julyCholesterol["recordId"].asText()}/corrections")
                .header("Idempotency-Key", "series-correction-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "190", "reason" to "합성 원문 재확인"))),
            alice,
        ).andExpect(status().isOk)

        val response = read(get("/api/foundation/series"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andReturn().response
        val series = responseJson(response.contentAsByteArray)["series"].toList()
        assertThat(series.map { it["concept"].asText() }).containsExactly("당화혈색소", "비타민 D", "총콜레스테롤")
        assertThat(series.map { it["unit"].asText() }).containsExactly("%", "ng/mL", "mg/dL")
        assertThat(series.map { it["conceptCode"].asText() }).containsExactly("hba1c", "vitamin-d", "total-cholesterol")

        val cholesterol = series[2]
        // CURRENT only: the superseded 188 is gone, the corrected 190 is the point.
        assertThat(cholesterol["points"].map { it["value"].asText() }).containsExactly("194", "190")
        assertThat(cholesterol["points"].map { it["observedOn"].asText() }).containsExactly("2026-01-15", "2026-07-28")
        assertThat(cholesterol["points"][0]["documentId"].asText()).isEqualTo(january[0]["documentId"].asText())
        assertThat(cholesterol["points"][1]["documentId"].asText()).isEqualTo(july[0]["documentId"].asText())
        assertThat(cholesterol["points"][0].fieldNames().asSequence().toList())
            .containsExactlyInAnyOrder("eventId", "value", "observedOn", "documentId")
        // 194 days apart: -4, -4/194 = -2.1 %, -4/194×30 = -0.6.
        assertThat(cholesterol["derived"]["lastDifference"]["absolute"].asText()).isEqualTo("-4")
        assertThat(cholesterol["derived"]["lastDifference"]["percent"].asText()).isEqualTo("-2.1")
        assertThat(cholesterol["derived"]["per30Days"].asText()).isEqualTo("-0.6")
        assertThat(cholesterol["derived"].has("meanOfLast3")).isFalse()

        val hba1c = series[0]
        assertThat(hba1c["derived"]["lastDifference"]["absolute"].asText()).isEqualTo("-0.2")
        assertThat(hba1c["derived"]["lastDifference"].has("percent")).isFalse()
        assertThat(hba1c["derived"]["per30Days"].asText()).isEqualTo("-0.03")

        val vitaminD = series[1]
        assertThat(vitaminD["derived"]["lastDifference"]["absolute"].asText()).isEqualTo("-3")
        assertThat(vitaminD["derived"]["lastDifference"]["percent"].asText()).isEqualTo("-6.7")
        assertThat(vitaminD["derived"]["per30Days"].asText()).isEqualTo("-0.5")

        // Every point is a CURRENT HealthEvent of the same owner.
        val eventIds = responseJson(
            read(get("/api/foundation/health-events"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).map { it["eventId"].asText() }
        assertThat(series.flatMap { item -> item["points"].map { it["eventId"].asText() } })
            .containsExactlyInAnyOrderElementsOf(eventIds)

        // The printed range is stored (export only) and appears nowhere in this response.
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_health_record_version WHERE reference_range_text = '120-199'", Long::class.java))
            .isGreaterThan(0L)
        assertThat(response.contentAsString.lowercase()).doesNotContain("reference", "120-199", "direction", "trend", "slope", "forecast")

        read(get("/api/foundation/series"), bob)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.series.length()").value(0))
    }
```

- [ ] **Step 2: Run it to verify it fails**

Run: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest"`
Expected: `seriesListCurrentValues…` FAILS — the first authenticated read returns 404 instead of 200 (the unauthenticated 401 already passes because the session filter covers the whole prefix). If the 401 assertion is the one that fails, stop and read the foundation session filter's path mapping before going on.

- [ ] **Step 3: Implement the endpoint**

In `FoundationLifecycleService.kt` after `getChangeSummary` add:

```kotlin
    /** The person's CURRENT values per item and unit in exam-date order. Read-only: no audit row, no range text. */
    @Transactional(readOnly = true)
    fun getSeries(principal: FoundationPrincipal): SeriesResponse =
        SeriesProjection.project(repository.listRecords(principal.subjectId))
```

In `FoundationLifecycleController.kt` after `getChanges` add:

```kotlin
    @GetMapping("/series")
    fun getSeries(request: HttpServletRequest): ResponseEntity<SeriesResponse> =
        ResponseEntity.ok()
            .cacheControlNoStore()
            .body(service.getSeries(request.foundationPrincipal()))
```

- [ ] **Step 4: Run the test class to verify it passes**

Run the Step 2 command. Expected: `BUILD SUCCESSFUL`; every test of the class passes (if they are all *skipped*, `GC_TEST_POSTGRES_URL` is not exported).

- [ ] **Step 5: Commit**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt
git commit -m "feat(core): GET /api/foundation/series (owner-isolated, CURRENT only, no range text)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: FHIR R4 export (`GET /api/foundation/health-events/export/fhir`)

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FhirExport.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt` (constructor ~line 162; after `exportHealthEvents` ~line 645)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt` (after `exportHealthEvents` ~line 354)
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FhirObservationMapperTest.kt` (create), `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `FoundationRecordRow` (incl. `referenceRangeText`, `originalValue`), `ChangeDeltaCalculator.parse(raw: String): BigDecimal?` (made `internal` in Task 1), `MedicalConceptSource.concepts(): List<MedicalConcept>` (`loincCode: String?`), test helper `importJulyWithRange` (Task 2).
- Produces: `FhirObservationMapper.bundle(records: List<FoundationRecordRow>, loincByConceptCode: Map<String, String>, now: Instant): FhirBundle`; `data class FhirExportEnvelope(filename: String, bundle: FhirBundle)`; `FoundationLifecycleService.exportHealthEventsAsFhir(principal): FhirExportEnvelope`; the HTTP endpoint with the headers in Global Constraints; audit row `HEALTH_EVENTS_EXPORTED` / `EXPORT_FHIR`.

- [ ] **Step 1: Write the failing mapper test**

Create `FhirObservationMapperTest.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class FhirObservationMapperTest {
    private val now = Instant.parse("2026-09-17T01:02:03.456789Z")
    private val loinc = mapOf("total-cholesterol" to "2093-3")

    private fun row(
        label: String = "총콜레스테롤",
        value: String = "190",
        originalValue: String = value,
        unit: String = "mg/dL",
        observedOn: String = "2026-07-28",
        conceptCode: String? = "total-cholesterol",
        referenceRangeText: String? = null,
        status: String = "CURRENT",
        originalObservedOn: LocalDate? = null,
    ) = FoundationRecordRow(
        recordId = UUID.randomUUID(),
        recordVersionId = UUID.randomUUID(),
        supersedesVersionId = null,
        candidateId = UUID.randomUUID(),
        documentId = UUID.randomUUID(),
        subjectId = "synthetic-jason",
        status = status,
        label = label,
        currentValue = value,
        originalValue = originalValue,
        unit = unit,
        observedOn = LocalDate.parse(observedOn),
        originalObservedOn = originalObservedOn,
        confirmedAt = Instant.parse("2026-08-01T00:00:00Z"),
        correctionReason = null,
        evidencePage = 1,
        sourceTextSha256 = "b".repeat(64),
        documentSha256 = "a".repeat(64),
        conceptCode = conceptCode,
        referenceRangeText = referenceRangeText,
    )

    @Test
    fun buildsASyntheticCollectionBundleAndOmitsEntryWhenThereIsNothing() {
        val empty = FhirObservationMapper.bundle(emptyList(), loinc, now)
        assertThat(empty.resourceType).isEqualTo("Bundle")
        assertThat(empty.type).isEqualTo("collection")
        assertThat(empty.timestamp).isEqualTo(Instant.parse("2026-09-17T01:02:03.456Z"))
        assertThat(empty.meta.tag).containsExactly(FhirCoding("https://alm.example/fhir/tag", "synthetic"))
        assertThat(empty.entry).isNull()
    }

    @Test
    fun mapsACorrectedCodedNumericRecordWithItsRangeTextVerbatim() {
        val record = row(originalValue = "188", referenceRangeText = "120-199")
        val observation = FhirObservationMapper.bundle(listOf(record), loinc, now).entry!!.single().resource

        assertThat(observation.resourceType).isEqualTo("Observation")
        assertThat(observation.id).isEqualTo(record.recordVersionId.toString())
        assertThat(observation.status).isEqualTo("final")
        assertThat(observation.category).containsExactly(
            FhirCodeableConcept(listOf(FhirCoding("http://terminology.hl7.org/CodeSystem/observation-category", "laboratory")), null),
        )
        assertThat(observation.code).isEqualTo(FhirCodeableConcept(listOf(FhirCoding("http://loinc.org", "2093-3")), "총콜레스테롤"))
        assertThat(observation.effectiveDateTime).isEqualTo("2026-07-28")
        assertThat(observation.valueQuantity).isEqualTo(FhirQuantity(BigDecimal("190"), "mg/dL"))
        assertThat(observation.valueString).isNull()
        assertThat(observation.referenceRange).containsExactly(FhirReferenceRange("120-199"))
        assertThat(observation.note).containsExactly(FhirAnnotation("본인이 값을 수정함"))
    }

    @Test
    fun omitsCodingRangeAndNoteWhenAbsentAndFallsBackToValueStringForNonNumericText() {
        val uncoded = row(label = "요단백", value = "음성", conceptCode = null)
        val unknownCode = row(label = "비타민 D", value = "6,200", unit = "ng/mL", conceptCode = "vitamin-d")
        val dateOnly = row(label = "당화혈색소", value = "5.20", unit = "%", conceptCode = null, originalObservedOn = LocalDate.parse("2026-07-27"))
        val byLabel = FhirObservationMapper.bundle(listOf(uncoded, unknownCode, dateOnly), loinc, now)
            .entry!!.map { it.resource }.associateBy { it.code.text }

        val text = byLabel.getValue("요단백")
        assertThat(text.code.coding).isNull()
        assertThat(text.valueQuantity).isNull()
        assertThat(text.valueString).isEqualTo("음성")
        assertThat(text.referenceRange).isNull()
        assertThat(text.note).isNull()

        assertThat(byLabel.getValue("비타민 D").code.coding).isNull()
        assertThat(byLabel.getValue("비타민 D").valueQuantity).isEqualTo(FhirQuantity(BigDecimal("6200"), "ng/mL"))
        // Scale is kept (5.20 stays 5.20); a date-only correction has no "value" note.
        assertThat(byLabel.getValue("당화혈색소").valueQuantity).isEqualTo(FhirQuantity(BigDecimal("5.20"), "%"))
        assertThat(byLabel.getValue("당화혈색소").note).isNull()
    }

    @Test
    fun listsCurrentRecordsOnlyInADeterministicOrderAndHasNoInterpretationSubjectOrPerformer() {
        val january = row(value = "194", observedOn = "2026-01-15")
        val july = row(value = "190")
        val superseded = row(value = "188", status = "SUPERSEDED")
        val bundle = FhirObservationMapper.bundle(listOf(july, superseded, january), loinc, now)

        assertThat(bundle.entry!!.map { it.resource.id })
            .containsExactly(january.recordVersionId.toString(), july.recordVersionId.toString())
        assertThat(FhirObservationMapper.bundle(listOf(january, superseded, july), loinc, now)).isEqualTo(bundle)
        val fields = FhirObservation::class.java.declaredFields.map { it.name }
        assertThat(fields).doesNotContain("interpretation", "subject", "performer")
        assertThat(FhirReferenceRange::class.java.declaredFields.map { it.name }).containsExactly("text")
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FhirObservationMapperTest"`
Expected: compilation error `Unresolved reference 'FhirObservationMapper'`.

- [ ] **Step 3: Write the DTOs and the mapper**

Create `FhirExport.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import java.math.BigDecimal
import java.time.Instant
import java.time.temporal.ChronoUnit

/*
 * Hand-written FHIR R4 shapes for the person's own export: no FHIR library, only the members this
 * export emits. There is deliberately no `interpretation`, `subject` or `performer`, and a reference
 * range is text only — never low/high, never compared with a value
 * (governance/intended-use-decision-reference-range-and-delta-addendum-2026-09-17.md).
 * Null members are omitted by the global Jackson `non_null` setting.
 */
data class FhirCoding(val system: String, val code: String)

data class FhirCodeableConcept(val coding: List<FhirCoding>?, val text: String?)

data class FhirQuantity(val value: BigDecimal, val unit: String)

data class FhirReferenceRange(val text: String)

data class FhirAnnotation(val text: String)

data class FhirMeta(val tag: List<FhirCoding>)

data class FhirObservation(
    val resourceType: String = "Observation",
    val id: String,
    val status: String = "final",
    val category: List<FhirCodeableConcept>,
    val code: FhirCodeableConcept,
    val effectiveDateTime: String,
    val valueQuantity: FhirQuantity?,
    val valueString: String?,
    val referenceRange: List<FhirReferenceRange>?,
    val note: List<FhirAnnotation>?,
)

data class FhirBundleEntry(val resource: FhirObservation)

data class FhirBundle(
    val resourceType: String = "Bundle",
    val type: String = "collection",
    val timestamp: Instant,
    val meta: FhirMeta,
    /** Omitted when empty: FHIR does not allow an empty array. */
    val entry: List<FhirBundleEntry>?,
)

/** The Bundle plus the filename computed from the same instant as `timestamp`. */
data class FhirExportEnvelope(val filename: String, val bundle: FhirBundle)

object FhirObservationMapper {
    const val LOINC_SYSTEM = "http://loinc.org"
    const val CATEGORY_SYSTEM = "http://terminology.hl7.org/CodeSystem/observation-category"
    const val TAG_SYSTEM = "https://alm.example/fhir/tag"
    const val CORRECTED_NOTE = "본인이 값을 수정함"

    private val laboratory = listOf(FhirCodeableConcept(listOf(FhirCoding(CATEGORY_SYSTEM, "laboratory")), null))

    fun bundle(records: List<FoundationRecordRow>, loincByConceptCode: Map<String, String>, now: Instant): FhirBundle {
        val entries = records
            .filter { it.status == "CURRENT" }
            .sortedWith(
                compareBy<FoundationRecordRow> { it.observedOn }
                    .thenBy { it.label }
                    .thenBy { it.confirmedAt }
                    .thenBy { it.recordId.toString() },
            )
            .map { FhirBundleEntry(observation(it, loincByConceptCode)) }
        return FhirBundle(
            timestamp = now.truncatedTo(ChronoUnit.MILLIS),
            meta = FhirMeta(listOf(FhirCoding(TAG_SYSTEM, "synthetic"))),
            entry = entries.ifEmpty { null },
        )
    }

    private fun observation(record: FoundationRecordRow, loincByConceptCode: Map<String, String>): FhirObservation {
        val loinc = record.conceptCode?.let(loincByConceptCode::get)
        val number = ChangeDeltaCalculator.parse(record.currentValue)
        return FhirObservation(
            id = record.recordVersionId.toString(),
            category = laboratory,
            code = FhirCodeableConcept(loinc?.let { listOf(FhirCoding(LOINC_SYSTEM, it)) }, record.label),
            effectiveDateTime = record.observedOn.toString(),
            valueQuantity = number?.let { FhirQuantity(it, record.unit) },
            valueString = if (number == null) record.currentValue else null,
            // Verbatim document text. Never parsed into low/high, never compared with the value.
            referenceRange = record.referenceRangeText?.let { listOf(FhirReferenceRange(it)) },
            note = if (record.currentValue != record.originalValue) listOf(FhirAnnotation(CORRECTED_NOTE)) else null,
        )
    }
}
```

- [ ] **Step 4: Run the mapper test to verify it passes**

Run the Step 2 command. Expected: `BUILD SUCCESSFUL`, 4 tests pass. (In the ordering test the two rows share label and `confirmedAt`; the order is decided by `observedOn`.)

- [ ] **Step 5: Write the failing PostgreSQL test**

Add to `FoundationLifecyclePostgresIntegrationTest.kt` after `exportV2CarriesTheReferenceRangeText…` (the helper `importJulyWithRange` comes from Task 2 Step 1; if it is missing, add it exactly as written there):

```kotlin
    @Test
    fun exportsTheOwnersEventsAsAFhirBundleWithRangeTextOnlyAndAuditsNoValue() {
        mockMvc.perform(get("/api/foundation/health-events/export/fhir")).andExpect(status().isUnauthorized)
        val alice = login("synthetic-alice")
        val bob = login("synthetic-bob")

        val empty = read(get("/api/foundation/health-events/export/fhir"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.resourceType").value("Bundle"))
            .andExpect(jsonPath("$.type").value("collection"))
            .andExpect(jsonPath("$.entry").doesNotExist())
            .andReturn().response
        assertThat(empty.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .matches("attachment; filename=\"alm-health-events-\\d{8}\\.fhir\\.json\"")

        val consentId = grantConsent(alice)
        val july = importJulyWithRange(alice, consentId, "fhir-july")
        // 총콜레스테롤 is corrected at confirmation (188 → 190); the other two are confirmed as read.
        july.forEach { candidate ->
            val value = if (candidate["ordinal"].asInt() == 1) "190" else candidate["value"].asText()
            mutate(
                post("/api/foundation/candidates/${candidate["candidateId"].asText()}/confirmation")
                    .header("Idempotency-Key", "fhir-july-confirm-${candidate["ordinal"].asInt()}")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(mapOf("value" to value))),
                alice,
            ).andExpect(status().isCreated)
        }

        val response = read(get("/api/foundation/health-events/export/fhir"), alice)
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andReturn().response
        assertThat(response.contentType).startsWith("application/fhir+json")
        assertThat(response.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .matches("attachment; filename=\"alm-health-events-\\d{8}\\.fhir\\.json\"")
        val bundle = responseJson(response.contentAsByteArray)
        assertThat(bundle["resourceType"].asText()).isEqualTo("Bundle")
        assertThat(bundle["type"].asText()).isEqualTo("collection")
        assertThat(bundle["timestamp"].asText()).matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z")
        assertThat(bundle["meta"]["tag"].single()["system"].asText()).isEqualTo("https://alm.example/fhir/tag")
        assertThat(bundle["meta"]["tag"].single()["code"].asText()).isEqualTo("synthetic")

        val observations = bundle["entry"].map { it["resource"] }.associateBy { it["code"]["text"].asText() }
        assertThat(observations.keys).containsExactlyInAnyOrder("총콜레스테롤", "당화혈색소", "비타민 D")
        val eventIds = responseJson(
            read(get("/api/foundation/health-events"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).map { it["eventId"].asText() }
        assertThat(observations.values.map { it["id"].asText() }).containsExactlyInAnyOrderElementsOf(eventIds)

        val cholesterol = observations.getValue("총콜레스테롤")
        assertThat(cholesterol["resourceType"].asText()).isEqualTo("Observation")
        assertThat(cholesterol["status"].asText()).isEqualTo("final")
        assertThat(cholesterol["category"].single()["coding"].single()["code"].asText()).isEqualTo("laboratory")
        assertThat(cholesterol["code"]["coding"].single()["system"].asText()).isEqualTo("http://loinc.org")
        assertThat(cholesterol["code"]["coding"].single()["code"].asText()).isEqualTo("2093-3")
        assertThat(cholesterol["effectiveDateTime"].asText()).isEqualTo("2026-07-28")
        assertThat(cholesterol["valueQuantity"]["value"].isNumber).isTrue()
        assertThat(cholesterol["valueQuantity"]["value"].decimalValue()).isEqualByComparingTo("190")
        assertThat(cholesterol["valueQuantity"]["unit"].asText()).isEqualTo("mg/dL")
        assertThat(cholesterol["referenceRange"].single().fieldNames().asSequence().toList()).containsExactly("text")
        assertThat(cholesterol["referenceRange"].single()["text"].asText()).isEqualTo("120-199")
        assertThat(cholesterol["note"].single()["text"].asText()).isEqualTo("본인이 값을 수정함")

        val hba1c = observations.getValue("당화혈색소")
        assertThat(hba1c["code"]["coding"].single()["code"].asText()).isEqualTo("4548-4")
        assertThat(hba1c["valueQuantity"]["value"].decimalValue()).isEqualByComparingTo("5.2")
        assertThat(hba1c.has("referenceRange")).isFalse()
        assertThat(hba1c.has("note")).isFalse()
        assertThat(response.contentAsString).doesNotContain("interpretation", "subject", "performer", "\"low\"", "\"high\"", "valueString")

        read(get("/api/foundation/health-events/export/fhir"), bob)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.entry").doesNotExist())

        // The JSON export is untouched: same schema, same filename shape, its own audit resource type.
        val jsonExport = read(get("/api/foundation/health-events/export"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.schemaVersion").value("alm-health-events-export.v2"))
            .andReturn().response
        assertThat(jsonExport.contentType).startsWith("application/json")
        assertThat(jsonExport.getHeader(HttpHeaders.CONTENT_DISPOSITION))
            .matches("attachment; filename=\"alm-health-events-\\d{8}\\.json\"")

        fun auditCount(resourceType: String) = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM gc_audit_event
            WHERE event_type = 'HEALTH_EVENTS_EXPORTED' AND resource_type = ?
              AND resource_id IS NULL AND purpose_code IS NULL AND outcome = 'SUCCESS'
            """.trimIndent(),
            Long::class.java,
            resourceType,
        )
        assertThat(auditCount("EXPORT_FHIR")).isEqualTo(3L)
        assertThat(auditCount("EXPORT")).isEqualTo(1L)
        // No value, count or date in any text column of the export audit rows.
        val exportAuditText = jdbc.queryForList(
            """
            SELECT event_type || ' ' || resource_type || ' ' || COALESCE(purpose_code, '')
            FROM gc_audit_event WHERE event_type = 'HEALTH_EVENTS_EXPORTED'
            """.trimIndent(),
            String::class.java,
        )
        assertThat(exportAuditText).hasSize(4).allSatisfy { line ->
            assertThat(line).doesNotContainPattern("\\d").doesNotContain("mg/dL", "120-199")
        }
    }
```

- [ ] **Step 6: Run it to verify it fails**

Run: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest"`
Expected: the new test FAILS at the first authenticated read (404, or 200 from the JSON export mapping is impossible because the path differs).

- [ ] **Step 7: Implement service and controller**

In `FoundationLifecycleService.kt` add a constructor parameter after `clock`:

```kotlin
    private val conceptSource: MedicalConceptSource,
```

add below `earliestObservedOn`:

```kotlin
    /** Informational LOINC codes from the seed-only concept table, read once per process. */
    private val loincByConceptCode: Map<String, String> by lazy {
        conceptSource.concepts().mapNotNull { concept -> concept.loincCode?.let { concept.conceptCode to it } }.toMap()
    }
```

and after `exportHealthEvents` add:

```kotlin
    @Transactional
    fun exportHealthEventsAsFhir(principal: FoundationPrincipal): FhirExportEnvelope {
        val now = Instant.now(clock)
        val bundle = FhirObservationMapper.bundle(repository.listRecords(principal.subjectId), loincByConceptCode, now)
        // Same event as the JSON export; the format is a value-free resource-type code. No count, value or date.
        audit(principal, "HEALTH_EVENTS_EXPORTED", "EXPORT_FHIR", null, "SUCCESS")
        val filename = "alm-health-events-${LocalDate.ofInstant(now, seoul).format(DateTimeFormatter.BASIC_ISO_DATE)}.fhir.json"
        return FhirExportEnvelope(filename = filename, bundle = bundle)
    }
```

(`JdbcMedicalConceptSource` is already a `@Component` under the same `gc.foundation.enabled` condition, so Spring wires it; no test constructs the service by hand. `gc_audit_event.resource_type` is `VARCHAR(40)` with no CHECK, so no migration is needed.)

In `FoundationLifecycleController.kt` after `exportHealthEvents` add:

```kotlin
    @GetMapping("/health-events/export/fhir", produces = ["application/fhir+json"])
    fun exportHealthEventsAsFhir(request: HttpServletRequest): ResponseEntity<FhirBundle> {
        val envelope = service.exportHealthEventsAsFhir(request.foundationPrincipal())
        return ResponseEntity.ok()
            .cacheControlNoStore()
            .contentType(MediaType.parseMediaType("application/fhir+json"))
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"${envelope.filename}\"")
            .body(envelope.bundle)
    }
```

(Spring's Jackson converter already writes `application/*+json`; no converter configuration is needed.)

- [ ] **Step 8: Run the whole core module**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon` (with `GC_TEST_POSTGRES_URL` exported).
Expected: `BUILD SUCCESSFUL`; the existing `exportsTheOwnersHealthEventsAsAJsonAttachment…` and `exportV2…` tests pass unchanged.

- [ ] **Step 9: Commit**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FhirExport.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FhirObservationMapperTest.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt
git commit -m "feat(core): FHIR R4 Bundle export of the person's own events (range text only, no interpretation)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Web — strict `getSeries()`, FHIR link in 데이터 관리, copy-scan additions

**Files:**
- Modify: `apps/web/lib/foundation/client.ts` (schemas after `changeSummarySchema` ~line 214; types ~line 236; client method next to `getChanges` ~line 491)
- Modify: `apps/web/tests/fixtures/foundation.ts` (append)
- Modify: `apps/web/components/integrated/IntegratedDataControl.tsx:229-239`
- Test: `apps/web/tests/foundation-client.test.ts`, `apps/web/tests/integrated-data-control.test.tsx`, `apps/web/tests/korean-ux-copy.test.ts`

**Interfaces:**
- Consumes: `GET /api/foundation/series` (Task 2), `GET /api/foundation/health-events/export/fhir` (Task 3).
- Produces: `client.getSeries(): Promise<SeriesResponse>`; exported types `SeriesResponse`, `MeasurementSeries` (`{ conceptCode?: string; concept: string; unit: string; points: { eventId; value; observedOn; documentId }[]; derived: { lastDifference?: { absolute: string; percent?: string | null }; per30Days?: string; meanOfLast3?: string } }`); fixture `syntheticSeries(): SeriesResponse` (Task 7 uses all three).

- [ ] **Step 1: Write the failing client test**

In `apps/web/tests/foundation-client.test.ts` change the fixture import to `import { syntheticHealthEvent, syntheticSeries } from "./fixtures/foundation";` and add inside the `describe`:

```ts
  it("reads the measurement series with omitted derived keys and refuses a direction, a range or a null", async () => {
    const fetcher = vi.fn(async () => jsonResponse(syntheticSeries()));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    const loaded = await client.getSeries();
    expect(loaded.series.map((item) => item.concept)).toEqual(["당화혈색소", "비타민 D", "총콜레스테롤"]);
    expect(loaded.series[2].derived).toEqual({ lastDifference: { absolute: "-4", percent: "-2.1" }, per30Days: "-0.6" });
    expect(loaded.series[1].derived).toEqual({});
    expect(fetcher).toHaveBeenCalledWith("/api/foundation/series", expect.objectContaining({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }));

    const base = syntheticSeries().series[2];
    for (const broken of [
      { ...base, direction: "down" },
      { ...base, referenceRangeText: "120-199" },
      { ...base, derived: { ...base.derived, slope: "-0.02" } },
      { ...base, derived: { ...base.derived, meanOfLast3: null } },
      { ...base, derived: { ...base.derived, per30Days: "-0.6 mg/dL" } },
      { ...base, points: [{ ...base.points[0], recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c40" }] },
      { ...base, points: [] },
    ]) {
      const rejecting = createFoundationClient({ fetcher: vi.fn(async () => jsonResponse({ series: [broken] })), readCsrfToken: () => "csrf-value" });
      await expect(rejecting.getSeries()).rejects.toMatchObject({ code: "invalid_server_response" });
    }
  });
```

Append to `apps/web/tests/fixtures/foundation.ts` (change its first line to `import type { FoundationCandidate, FoundationRecord, HealthEvent, SeriesResponse } from "@/lib/foundation/client";`):

```ts
const januaryDocumentId = "f75eebbf-b437-4034-99ba-16bd6ab59736";

/**
 * What GET /api/foundation/series returns after the e2e lifecycle: July uploaded first
 * (총콜레스테롤 corrected to 190, 당화혈색소 re-dated to 07-27, 비타민 D excluded), January second.
 * Null members are omitted exactly as the server omits them (Jackson non_null).
 */
export function syntheticSeries(): SeriesResponse {
  return {
    series: [
      {
        conceptCode: "hba1c",
        concept: "당화혈색소",
        unit: "%",
        points: [
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d61", value: "5.4", observedOn: "2026-01-15", documentId: januaryDocumentId },
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d62", value: "5.2", observedOn: "2026-07-27", documentId },
        ],
        derived: { lastDifference: { absolute: "-0.2" }, per30Days: "-0.03" },
      },
      {
        conceptCode: "vitamin-d",
        concept: "비타민 D",
        unit: "ng/mL",
        points: [
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d63", value: "45", observedOn: "2026-01-15", documentId: januaryDocumentId },
        ],
        derived: {},
      },
      {
        conceptCode: "total-cholesterol",
        concept: "총콜레스테롤",
        unit: "mg/dL",
        points: [
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d64", value: "194", observedOn: "2026-01-15", documentId: januaryDocumentId },
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d65", value: "190", observedOn: "2026-07-28", documentId },
        ],
        derived: { lastDifference: { absolute: "-4", percent: "-2.1" }, per30Days: "-0.6" },
      },
    ],
  };
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/foundation-client.test.ts`
Expected: FAIL — `client.getSeries is not a function` (and tsc would report `SeriesResponse` is not exported).

- [ ] **Step 3: Add the schemas, types and method**

In `apps/web/lib/foundation/client.ts` after `changeSummarySchema` add:

```ts
// One confirmed value in a series. No recordId, no range, no judgement: `.strict()` is the boundary.
const seriesPointSchema = z.object({
  eventId: uuidSchema,
  value: z.string().min(1).max(64),
  observedOn: z.string().date(),
  documentId: uuidSchema,
}).strict();

// Three numbers from subtraction and division, in time order. The server omits a key it cannot
// compute (Jackson non_null), so every key is optional and none is nullable; a slope, direction
// or forecast key fails validation here.
const seriesDerivedSchema = z.object({
  lastDifference: changeDeltaSchema.optional(),
  per30Days: z.string().regex(/^[+-]?\d+\.\d+$/).optional(),
  meanOfLast3: z.string().regex(/^-?\d+\.\d+$/).optional(),
}).strict();

const measurementSeriesSchema = z.object({
  conceptCode: conceptCodeSchema.optional(),
  concept: z.string().min(1).max(80),
  unit: z.string().min(1).max(32),
  points: z.array(seriesPointSchema).min(1).max(500),
  derived: seriesDerivedSchema,
}).strict();

const seriesResponseSchema = z.object({ series: z.array(measurementSeriesSchema).max(500) }).strict();
```

after `export type ChangeItem = …` add:

```ts
export type SeriesResponse = z.infer<typeof seriesResponseSchema>;
export type MeasurementSeries = z.infer<typeof measurementSeriesSchema>;
```

and after the `getChanges:` line add:

```ts
    getSeries: () => request("/api/foundation/series", seriesResponseSchema, { method: "GET" }),
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --dir apps/web exec vitest run tests/foundation-client.test.ts && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: all tests pass; tsc prints nothing.

- [ ] **Step 5: Write the failing export-link and copy tests**

In `apps/web/tests/integrated-data-control.test.tsx` add after `disables the export and says so when there is nothing to export`:

```tsx
it("offers a second export link in FHIR form with its one-line explanation", async () => {
  events = [syntheticHealthEvent()];

  render(<IntegratedDataControl />);

  const link = await screen.findByRole("link", { name: "내 기록 내보내기(FHIR)" });
  expect(link).toHaveAttribute("href", "/api/foundation/health-events/export/fhir");
  expect(link).toHaveAttribute("download");
  expect(screen.getByText("다른 건강기록 도구가 읽을 수 있는 형식이에요.")).toBeVisible();
  expect(screen.getByRole("link", { name: "내 기록 내보내기(JSON)" })).toHaveAttribute("href", "/api/foundation/health-events/export");
});

it("disables the FHIR export too when there is nothing to export", async () => {
  render(<IntegratedDataControl />);

  expect(await screen.findByRole("button", { name: "내 기록 내보내기(FHIR)" })).toBeDisabled();
  expect(screen.queryByRole("link", { name: "내 기록 내보내기(FHIR)" })).toBeNull();
});
```

In `apps/web/tests/korean-ux-copy.test.ts` replace the end of `forbiddenUserTerms`:

```ts
  // Direction words: the product states two values and their arithmetic difference, never a trend.
  "상승",
  "하락",
  "증가",
  "감소",
  // Wave 4: no speed, no good/bad, no trend — the history screen shows values and arithmetic only.
  "빨라",
  "느려",
  "좋아",
  "나빠",
  "추세",
] as const;
```

and in the test `explains the export as a browser download with no server copy` add before `expect(control).not.toContain("/api/export");`:

```ts
    expect(control).toContain('href="/api/foundation/health-events/export/fhir"');
    expect(control).toContain("내 기록 내보내기(FHIR)");
    expect(control).toContain("다른 건강기록 도구가 읽을 수 있는 형식이에요.");
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm --dir apps/web exec vitest run tests/integrated-data-control.test.tsx tests/korean-ux-copy.test.ts`
Expected: the two new data-control tests and the export copy test FAIL (no FHIR link). The forbidden-term cases pass already (no listed file contains the five new words — verified by grep when this plan was written); if one fails, reword that file's sentence instead of removing the term.

- [ ] **Step 7: Add the link**

In `IntegratedDataControl.tsx` replace the `<div className="gc-integrated-actions">…</div>` inside the `server-export-title` section with:

```tsx
                <div className="gc-integrated-actions">
                  {events.length > 0
                    ? <a className="gc-button gc-button--weak" href="/api/foundation/health-events/export" download>내 기록 내보내기(JSON)</a>
                    : <button type="button" disabled>내 기록 내보내기(JSON)</button>}
                  {events.length > 0
                    ? <a className="gc-button gc-button--weak" href="/api/foundation/health-events/export/fhir" download>내 기록 내보내기(FHIR)</a>
                    : <button type="button" disabled>내 기록 내보내기(FHIR)</button>}
                </div>
                <p>다른 건강기록 도구가 읽을 수 있는 형식이에요.</p>
```

(`.gc-integrated-actions` is already `display:flex; flex-wrap:wrap`, so the second control wraps at 320px; the e2e matrix on `/data-control` checks it in Task 8.)

- [ ] **Step 8: Run the web suite and tsc**

Run: `pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: every file passes; tsc prints nothing.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/foundation/client.ts apps/web/tests/fixtures/foundation.ts apps/web/tests/foundation-client.test.ts apps/web/components/integrated/IntegratedDataControl.tsx apps/web/tests/integrated-data-control.test.tsx apps/web/tests/korean-ux-copy.test.ts
git commit -m "feat(web): strict series client, FHIR export link, five more forbidden direction words

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Wave 3 minors — two ranges on a row, MedGemma report row, `cellArrived` cleared on `animationend`

**Files:**
- Modify: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt` (end of `parseRow`, ~lines 174-183)
- Test: `apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProviderTest.kt`
- Modify: `apps/web/lib/medical-ai/medgemma-report.ts` (metric rows, after `Hallucinated measurements`)
- Test: `apps/web/tests/medgemma-report.test.ts`
- Modify: `apps/web/components/my-data/LivingCellCanvas.tsx`
- Test: `apps/web/tests/living-cell-canvas.test.tsx`

**Interfaces:**
- Consumes: `rangeText`, `rangeBody`, `rangeBoundaryMarker`, `MAX_REFERENCE_RANGE` (existing private members); `report.metrics.referenceRangeAccuracy` (exists in `evaluation.ts`).
- Produces: no new public name. `ParsedCandidate.referenceRangeText` may now be two range bodies joined by one space (still matches `^[0-9.,\s\-~–<>≤≥]{1,40}$`).

- [ ] **Step 1: Write the failing worker test**

Add to `NativeTextExtractionProviderTest.kt` after `never truncates a reference range body…`:

```kotlin
    @Test
    fun `keeps two ranges printed on one row verbatim joined by one space, or nothing when that exceeds forty characters`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines(
                "검사일 2026-07-28",
                "혈당 95 mg/dL 70-99 100-200",
                "총콜레스테롤 188 mg/dL 120-199   200-239",
                "요산 5.1 mg/dL 1000000000-2000000000 3000000000-4000000000",
                "AST 22 U/L 15-35 40",
            ),
        )

        assertThat(outcome.abstentions).isEmpty()
        assertThat(outcome.candidates.map { it.value }).containsExactly("95", "188", "5.1", "22")
        assertThat(outcome.candidates.map { it.unit }).containsExactly("mg/dL", "mg/dL", "mg/dL", "U/L")
        assertThat(outcome.candidates.map { it.referenceRangeText })
            .containsExactly("70-99 100-200", "120-199 200-239", null, "15-35")
        assertThat(outcome.candidates.mapNotNull { it.referenceRangeText })
            .allMatch { Regex("^[0-9.,\\s\\-~–<>≤≥]{1,40}$").matches(it) }
    }
```

(Row 3 joins to 43 characters → `null`, never a cut fragment. Row 4's trailing bare `40` is not a range, so the single-range rule still yields `15-35`. If row 4 abstains on the current grammar instead of parsing — check by running the test — delete that row and its three expectations rather than changing which rows parse: value/unit parsing must not change.)

- [ ] **Step 2: Run it to verify it fails**

Run: `./gradlew.bat :apps:document-worker:test --no-daemon --tests "kr.co.genomecompanion.documentworker.NativeTextExtractionProviderTest"`
Expected: FAIL — actual `["70-99", "120-199", "1000000000-2000000000", "15-35"]`.

- [ ] **Step 3: Implement**

In `parseRow` replace

```kotlin
        val rangeBodyMatch = if (restIsRange) rangeBody.find(restText)?.value?.trim() else null
```

with

```kotlin
        // Two ranges on one row ("70-99 100-200") are both document text: keep them verbatim, joined
        // by one space. Only when the row already parses as a measurement (restIsRange), only when
        // both bodies really bound a value and nothing else is left over; otherwise the single rule.
        val bodies = if (restIsRange) rangeBody.findAll(restText).map { it.value.trim() }.toList() else emptyList()
        val twoRanges = bodies.size == 2 &&
            bodies.all { rangeBoundaryMarker.containsMatchIn(it) } &&
            bodies.fold(restText) { remaining, body -> remaining.replaceFirst(body, "") }.isBlank()
        val rangeBodyMatch = if (twoRanges) bodies.joinToString(" ") else bodies.firstOrNull()
```

The following `referenceRangeText = rangeBodyMatch?.takeIf { it.length <= MAX_REFERENCE_RANGE && rangeBoundaryMarker.containsMatchIn(it) }` stays as it is (it supplies the 40-character rule for the joined text). Update the object's doc comment sentence `(range body only, at most 40 characters)` to `(range body only — two bodies on one row joined by one space — at most 40 characters, else null)`.

- [ ] **Step 4: Run the worker tests and the parser gate**

Run: `./gradlew.bat :apps:document-worker:test --no-daemon && export PATH="$HOME/.gc-node24:$PATH" && pnpm medical-ai:native-text-gate`
Expected: `BUILD SUCCESSFUL`; gate prints `"fieldF1": 1`, `"referenceRangeAccuracy": 1`, `"passed": true`, `corpusId` unchanged (`synthetic-ko-checkup-r2-e6befc286ae6ce1d`).

- [ ] **Step 5: Commit**

```bash
git add apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProviderTest.kt
git commit -m "fix(worker): keep two reference ranges on one row verbatim (null past 40 characters)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 6: Write the failing report test**

In `apps/web/tests/medgemma-report.test.ts`, in `renders the side-by-side report…` add after the `| Gate | PASS | …` expectation:

```ts
  expect(markdown).toMatch(/\| Reference-range text carried verbatim \| \d+\.\d% \| \d+\.\d% \|/);
```

- [ ] **Step 7: Run it to verify it fails, then implement**

Run: `pnpm --dir apps/web exec vitest run tests/medgemma-report.test.ts` — Expected: FAIL (row missing).

In `apps/web/lib/medical-ai/medgemma-report.ts` add after the `metricRow("Hallucinated measurements", …)` line:

```ts
    metricRow("Reference-range text carried verbatim", reports, (entry) => percent(entry.report.metrics.referenceRangeAccuracy)),
```

Run the same command — Expected: PASS.

- [ ] **Step 8: Write the failing animation test**

In `apps/web/tests/living-cell-canvas.test.tsx` add after `plays the arrival animation once…` (it uses that file's existing `stubReducedMotion` helper and `fireEvent` import):

```tsx
it("drops the arrival class when the animation ends and never replays it in the same mount", () => {
  stubReducedMotion(false);
  const newIds = new Set([jul.eventId]);
  const view = render(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={newIds} onSelect={() => {}} />);
  const name = "총콜레스테롤 188 mg/dL, 2026. 7. 28.";
  expect(screen.getByRole("button", { name }).getAttribute("class")).toMatch(/cellArrived/);

  fireEvent.animationEnd(screen.getByRole("button", { name }));
  expect(screen.getByRole("button", { name }).getAttribute("class")).not.toMatch(/cellArrived/);
  expect(screen.getByRole("button", { name })).not.toHaveAttribute("data-arrived");
  // Still the new cell (state is data, not animation).
  expect(screen.getByRole("button", { name })).toHaveAttribute("data-state", "new");

  view.rerender(<LivingCellCanvas events={[jan, jul]} matchedIds={new Set([jan.eventId])} newIds={newIds} onSelect={() => {}} />);
  view.rerender(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={newIds} onSelect={() => {}} />);
  expect(screen.getByRole("button", { name }).getAttribute("class")).not.toMatch(/cellArrived/);
  // @ts-expect-error jsdom has no matchMedia; remove the stub so other tests see the default.
  delete window.matchMedia;
});
```

- [ ] **Step 9: Run it to verify it fails, then implement**

Run: `pnpm --dir apps/web exec vitest run tests/living-cell-canvas.test.tsx` — Expected: FAIL (class still present after `animationend`).

In `LivingCellCanvas.tsx` add next to the other `useState` calls:

```tsx
  // Cells whose one arrival animation already finished in this mount; they never get the class again.
  const [settledIds, setSettledIds] = useState<ReadonlySet<string>>(() => new Set());
```

change the `arrived` line to:

```tsx
          const arrived = cell.state === "new" && !reducedMotion && !settledIds.has(cell.eventId);
```

and add to the `<g>` props (after `onBlur`):

```tsx
              onAnimationEnd={arrived ? () => setSettledIds((current) => new Set(current).add(cell.eventId)) : undefined}
```

Run the same command — Expected: all tests in the file pass, including the existing arrival test.

- [ ] **Step 10: Run the web suite and commit**

Run: `pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json` — Expected: all pass, tsc silent.

```bash
git add apps/web/lib/medical-ai/medgemma-report.ts apps/web/tests/medgemma-report.test.ts apps/web/components/my-data/LivingCellCanvas.tsx apps/web/tests/living-cell-canvas.test.tsx
git commit -m "fix(web): referenceRangeAccuracy row in the MedGemma report; arrival class cleared on animationend

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: PR #5 finding F-3 — a refused bootstrap is not "restore failed" (other branch, temporary worktree)

This task never touches `codex/wave8-measurement-history-fhir` or this worktree's files. It works on `codex/unified-health-product` (verified with `gh pr view 5 --json headRefName` → `codex/unified-health-product`, PR open) in a temporary worktree, pushes there, comments on PR #5, and removes the worktree. Evidence: `docs/reviews/2026-09-16-pr5-qa-review.md` §F-3 (on that branch).

**Files (all inside `C:/Users/Jason/Documents/gc-pr5-f3`):**
- Modify: `apps/web/lib/foundation/messages.ts`
- Modify: `apps/web/components/integrated/IntegratedHealthExperience.tsx` (`signIn` ~lines 192-210; entry screen ~line 372)
- Test: `apps/web/tests/foundation-messages.test.ts`, `apps/web/tests/integrated-review-loop.test.tsx`

**Interfaces:**
- Consumes (that branch): `FoundationClientError(code, status, problemCode?)`, `client.bootstrapDemo()`, `describeFoundationError(error)`; server refusals `429 rate_limited`, `403 demo_capacity_exhausted`, `403 demo_bootstrap_disabled`, `403 origin_denied`.
- Produces: `describeRefusedBootstrap(error: unknown): { message: string; nextAction: string } | undefined` in `messages.ts`.

- [ ] **Step 1: Create the worktree and install**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux
gh pr view 5 --json headRefName,state   # expect codex/unified-health-product, OPEN
git fetch origin codex/unified-health-product
git worktree add ../gc-pr5-f3 codex/unified-health-product
cd ../gc-pr5-f3
git merge --ff-only origin/codex/unified-health-product
export PATH="$HOME/.gc-node24:$PATH"
pnpm install --frozen-lockfile
```

A fresh worktree has no `node_modules`; `pnpm install` is required before any test or tsc there. If `git worktree add` says the branch is already checked out elsewhere, stop and report BLOCKED (do not use `--force`). If `--ff-only` fails, stop and report BLOCKED.

- [ ] **Step 2: Write the failing tests**

Append to `apps/web/tests/foundation-messages.test.ts` (extend its import to `import { describeFoundationError, describeRefusedBootstrap } from "@/lib/foundation/messages";`):

```ts
it("gives every refused bootstrap its own sentence and its own next action", () => {
  const refusals = [
    new FoundationClientError("rate_limited", 429, "rate_limited"),
    new FoundationClientError("forbidden", 403, "demo_capacity_exhausted"),
    new FoundationClientError("forbidden", 403, "demo_bootstrap_disabled"),
    new FoundationClientError("forbidden", 403, "origin_denied"),
  ].map((error) => describeRefusedBootstrap(error));

  expect(refusals).toEqual([
    { message: "체험 시작 요청이 너무 많아요.", nextAction: "1분쯤 뒤에 체험 시작을 다시 눌러 주세요." },
    { message: "체험 공간이 가득 찼어요. 운영자가 확인한 뒤 다시 시작할 수 있어요.", nextAction: "기다려도 자리가 생기지 않아요. 운영자에게 알려 주세요." },
    { message: "이 환경에서는 체험 시작이 열려 있지 않아요.", nextAction: "이 환경의 운영자에게 체험 시작을 열어 달라고 요청해 주세요." },
    { message: "이 주소에서는 체험을 시작할 수 없어요.", nextAction: "안내받은 주소로 다시 열어 주세요." },
  ]);
  expect(new Set(refusals.map((refusal) => refusal?.message)).size).toBe(4);
});

it("does not call a failure a refusal unless the server refused the bootstrap itself", () => {
  expect(describeRefusedBootstrap(new FoundationClientError("forbidden", 403, "something_new")))
    .toEqual({ message: "체험 시작이 거절됐어요.", nextAction: "페이지를 새로 고친 뒤 다시 시도해 주세요." });
  expect(describeRefusedBootstrap(new FoundationClientError("retryable_dependency_failure", 503, "retryable_dependency_failure"))).toBeUndefined();
  expect(describeRefusedBootstrap(new FoundationClientError("internal_error", 500))).toBeUndefined();
  expect(describeRefusedBootstrap(new FoundationClientError("network_unavailable", 0))).toBeUndefined();
  expect(describeRefusedBootstrap(new Error("boom"))).toBeUndefined();
});
```

Add to `apps/web/tests/integrated-review-loop.test.tsx` after `does not bootstrap twice when the first bootstrap succeeds but its following read fails`:

```tsx
it.each([
  [429, "rate_limited", "체험 시작 요청이 너무 많아요.", "1분쯤 뒤에 체험 시작을 다시 눌러 주세요."],
  [403, "demo_capacity_exhausted", "체험 공간이 가득 찼어요.", "운영자에게 알려 주세요."],
  [403, "demo_bootstrap_disabled", "이 환경에서는 체험 시작이 열려 있지 않아요.", "체험 시작을 열어 달라고 요청해 주세요."],
  [403, "origin_denied", "이 주소에서는 체험을 시작할 수 없어요.", "안내받은 주소로 다시 열어 주세요."],
] as const)("keeps a refused bootstrap (%i %s) on the entry screen with its own reason and next action", async (status, code, message, nextAction) => {
  const bootstrap = vi.fn(() => HttpResponse.json({ code }, { status }));
  server.use(
    http.get("/api/foundation/session", () => HttpResponse.json({ code: "session_required" }, { status: 401 })),
    http.post("/api/foundation/demo-session", bootstrap),
  );
  render(<IntegratedHealthExperience />);
  await userEvent.click(await screen.findByRole("button", { name: "체험 시작" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(message);
  expect(alert).toHaveTextContent(nextAction);
  // Not a failed restoration: no "restore failed" heading, no re-check action, and the entry stays.
  expect(screen.queryByRole("heading", { name: "체험 상태를 불러오지 못했어요" })).toBeNull();
  expect(screen.queryByRole("button", { name: "체험 상태 다시 확인" })).toBeNull();
  expect(screen.getByRole("button", { name: "체험 시작" })).toBeEnabled();
  expect(bootstrap).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Run them to verify they fail**

Run (in `../gc-pr5-f3`): `pnpm --dir apps/web exec vitest run tests/foundation-messages.test.ts tests/integrated-review-loop.test.tsx`
Expected: FAIL — `describeRefusedBootstrap` is not exported; the four component cases find the heading "체험 상태를 불러오지 못했어요".

- [ ] **Step 4: Implement**

Append to `apps/web/lib/foundation/messages.ts`:

```ts
export type RefusedBootstrap = { message: string; nextAction: string };

/**
 * A bootstrap the server itself refused (403/429). No session was issued, so this is not a failed
 * restoration: the person stays on the entry screen with the reason and what to do next.
 * Anything else (5xx, network, a later read) returns undefined and keeps the restore path.
 */
export function describeRefusedBootstrap(error: unknown): RefusedBootstrap | undefined {
  if (!(error instanceof FoundationClientError)) return undefined;
  if (error.status !== 403 && error.status !== 429) return undefined;
  switch (error.problemCode) {
    case "rate_limited":
      return { message: "체험 시작 요청이 너무 많아요.", nextAction: "1분쯤 뒤에 체험 시작을 다시 눌러 주세요." };
    case "demo_capacity_exhausted":
      return { message: "체험 공간이 가득 찼어요. 운영자가 확인한 뒤 다시 시작할 수 있어요.", nextAction: "기다려도 자리가 생기지 않아요. 운영자에게 알려 주세요." };
    case "demo_bootstrap_disabled":
      return { message: "이 환경에서는 체험 시작이 열려 있지 않아요.", nextAction: "이 환경의 운영자에게 체험 시작을 열어 달라고 요청해 주세요." };
    case "origin_denied":
      return { message: "이 주소에서는 체험을 시작할 수 없어요.", nextAction: "안내받은 주소로 다시 열어 주세요." };
    default:
      return { message: "체험 시작이 거절됐어요.", nextAction: "페이지를 새로 고친 뒤 다시 시도해 주세요." };
  }
}
```

In `IntegratedHealthExperience.tsx`:

1. Change the messages import to `import { describeFoundationError, describeRefusedBootstrap, foundationShellState, type RefusedBootstrap } from "@/lib/foundation/messages";`.
2. Next to `const [errorMessage, setErrorMessage] = useState("");` add `const [bootstrapRefusal, setBootstrapRefusal] = useState<RefusedBootstrap>();`.
3. Replace `signIn` with:

```tsx
  const signIn = async () => {
    setBusy(true);
    setErrorMessage("");
    setBootstrapRefusal(undefined);
    try {
      let issued;
      try {
        issued = await client.bootstrapDemo();
      } catch (error) {
        // The server refused the bootstrap itself: nothing was issued, nothing to restore.
        // Stay on the entry screen and say why and what to do next (PR #5 review F-3).
        const refusal = describeRefusedBootstrap(error);
        if (!refusal) throw error;
        setBootstrapRefusal(refusal);
        return;
      }
      setSession(issued);
      await loadProductTruth();
      setShellState("AUTHENTICATED");
      setView("home");
    } catch (error) {
      // A bootstrap response may have set cookies before a later read failed.
      // Re-read the current session before offering another bootstrap attempt.
      setShellState("RESTORE_FAILED");
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };
```

4. On the entry screen (the `synthetic-login-title` section) add directly above its `{errorMessage && …}` line:

```tsx
          {bootstrapRefusal && (
            <div className="gc-integrated-error" role="alert">
              <p>{bootstrapRefusal.message}</p>
              <p>{bootstrapRefusal.nextAction}</p>
            </div>
          )}
```

5. In `initialize`, add `setBootstrapRefusal(undefined);` right after its `setErrorMessage("");`.

- [ ] **Step 5: Run that branch's web tests and tsc**

Run (in `../gc-pr5-f3`): `pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: every file passes (the review recorded 37 files / 174 tests; now 174 + 6); tsc prints nothing. The three existing restoration tests (`retries failed restoration…`, `does not bootstrap twice…`, `offers a new demo only after…`) pass unchanged — a 500 or a failed later read is still `RESTORE_FAILED`. If that branch's `korean-ux-copy.test.ts` flags a new sentence, reword the sentence, not the test.

- [ ] **Step 6: Commit, push, comment, remove the worktree**

```bash
cd /c/Users/Jason/Documents/gc-pr5-f3
git status --short          # only the four files above; never next-env.d.ts
git add apps/web/lib/foundation/messages.ts apps/web/components/integrated/IntegratedHealthExperience.tsx apps/web/tests/foundation-messages.test.ts apps/web/tests/integrated-review-loop.test.tsx
git commit -m "fix(web): a refused demo bootstrap stays on the entry screen with its own reason and next action (QA review F-3)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin codex/unified-health-product
gh pr comment 5 --body "QA review F-3 fixed in $(git rev-parse --short HEAD): a bootstrap the server refuses (429 rate_limited, 403 demo_capacity_exhausted / demo_bootstrap_disabled / origin_denied) now stays on the entry screen with its own sentence and next action instead of the 'restore failed' screen; 5xx, network and later-read failures keep the restore path. Tests: foundation-messages (2), integrated-review-loop (4). Local: pnpm web:test and tsc --noEmit pass on this branch."
cd /c/Users/Jason/Documents/genome-companion-korea-ux
git worktree remove ../gc-pr5-f3
git worktree list           # gc-pr5-f3 is gone
git status --short          # this worktree is unchanged by Task 6
```

If `git checkout -- apps/web/next-env.d.ts` is needed in the temporary worktree before `git worktree remove` accepts it, run it there; never `--force` the removal with other uncommitted files present.

---

### Task 7: 측정 이력 screen (`/my-data/history`) — gated on the approved mockup

**Files:**
- Create: `apps/web/lib/my-data/history-layout.ts`, `apps/web/tests/history-layout.test.ts`
- Create: `apps/web/components/my-data/history/HistoryGraph.tsx`, `apps/web/components/my-data/history/MeasurementHistory.tsx`, `apps/web/components/my-data/history/History.module.css`
- Create: `apps/web/app/my-data/history/page.tsx`
- Create: `apps/web/tests/measurement-history.test.tsx`
- Modify: `apps/web/components/my-data/MyData.tsx` (entry link; open the drawer from `#event-<id>`), `apps/web/components/my-data/EvidenceDrawer.tsx` (history link)
- Modify: `apps/web/tests/my-data.test.tsx`, `apps/web/tests/evidence-drawer.test.tsx`, `apps/web/tests/korean-ux-copy.test.ts`

**Interfaces:**
- Consumes: `client.getSeries()`, types `SeriesResponse`/`MeasurementSeries`, fixture `syntheticSeries()` (Task 4); `IntegratedShell` (`current="my-data"`), `formatKoreanDate`, `describeFoundationError`, `foundationShellState`.
- Produces: `layoutHistory(points, options): HistoryLayout`, `parseHistoryValue(raw): number | null`, `HISTORY_LAYOUT_DEFAULTS`; components `MeasurementHistory`, `HistoryGraph`; route `/my-data/history`; hash contracts `/my-data/history#event-<eventId>` (focus that series) and `/my-data#event-<eventId>` (open that event's evidence drawer). Test ids used by Task 8: `history-series`, `derived-last-difference`, `derived-per-30-days`, `derived-mean-of-last-3`, `history-adjusted-notice`.

- [ ] **Step 1: Read the approved mockup notes**

Read the approved mockup notes at `.superpowers/sdd/wave4-mockup-decision.md`; if that file does not exist, stop and report NEEDS_CONTEXT. The founder approves a mockup before this screen is built (spec §3). From the notes take **only visual tokens**: background and dot-grid colours, the series palette, ribbon band/centre-line widths and dash, anchor size, card radius/shadow, title (serif) and number (pixel/mono) font stacks. Everything else in this task — scales, segments, anchors, table, a11y, states, copy — is fixed by this plan and the spec; if the notes contradict a Global Constraint (a band, a curve, a colour that depends on a value, a direction word, lime text), stop and report NEEDS_CONTEXT instead of following them. If the notes name a font that is not already bundled in `apps/web`, do not add a network font: keep the fallback stack below and say so in the task report. Also read `apps/web/AGENTS.md` and, before creating the route file, `node_modules/next/dist/docs/` for the page-file convention; mirror `apps/web/app/my-data/page.tsx` exactly.

- [ ] **Step 2: Write the failing geometry tests**

Create `apps/web/tests/history-layout.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { HISTORY_LAYOUT_DEFAULTS, layoutHistory, parseHistoryValue, type HistoryPointInput } from "@/lib/my-data/history-layout";

const point = (index: number, value: string, observedOn: string): HistoryPointInput => ({
  eventId: `8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c${String(4000 + index)}`, value, observedOn,
});
const at = (width: number) => ({ ...HISTORY_LAYOUT_DEFAULTS, width });
const three = [point(1, "194", "2026-01-15"), point(2, "188", "2026-04-15"), point(3, "190", "2026-07-28")];
const crowded = [point(1, "5.4", "2026-01-15"), point(2, "5.2", "2026-07-27"), point(3, "5.3", "2026-07-28")];
const monthly = Array.from({ length: 12 }, (_, index) => point(index, String(180 + index), `2026-${String(index + 1).padStart(2, "0")}-10`));
const daily = Array.from({ length: 14 }, (_, index) => point(index, String(100 + (index % 3)), `2026-07-${String(index + 1).padStart(2, "0")}`));

describe("history layout", () => {
  it("parses plain numbers and thousands commas, nothing else", () => {
    expect(parseHistoryValue("194")).toBe(194);
    expect(parseHistoryValue("6,200")).toBe(6200);
    expect(parseHistoryValue("-0.5")).toBe(-0.5);
    expect(parseHistoryValue("음성")).toBeNull();
    expect(parseHistoryValue("1e3")).toBeNull();
  });

  it("scales y to the series' own minimum and maximum only", () => {
    const layout = layoutHistory(three, at(720));
    const { height, paddingY } = HISTORY_LAYOUT_DEFAULTS;
    expect(layout.drawable).toBe(true);
    expect(layout.flat).toBe(false);
    expect([layout.min, layout.max]).toEqual([188, 194]);
    expect(layout.anchors.map((anchor) => anchor.value)).toEqual(["194", "188", "190"]);
    expect(layout.anchors[0].y).toBe(paddingY);                    // own maximum at the top
    expect(layout.anchors[1].y).toBe(height - paddingY);           // own minimum at the bottom
    expect(layout.anchors[2].y).toBeCloseTo(paddingY + ((194 - 190) / 6) * (height - 2 * paddingY), 1);
  });

  it("draws a flat middle line when every value is equal and nothing for fewer than two numeric points", () => {
    const flat = layoutHistory([point(1, "5.2", "2026-01-15"), point(2, "5.2", "2026-07-28")], at(375));
    expect(flat.flat).toBe(true);
    expect(new Set(flat.anchors.map((anchor) => anchor.y))).toEqual(new Set([HISTORY_LAYOUT_DEFAULTS.height / 2]));

    for (const points of [[], [point(1, "194", "2026-01-15")], [point(1, "194", "2026-01-15"), point(2, "음성", "2026-07-28")]]) {
      const none = layoutHistory(points, at(375));
      expect(none).toMatchObject({ drawable: false, anchors: [], segments: [], ticks: [], path: "", adjusted: false, min: null, max: null });
    }
    // A non-numeric point is left out of the graph; the numeric ones still draw.
    expect(layoutHistory([...three, point(4, "음성", "2026-08-01")], at(720)).anchors).toHaveLength(3);
  });

  it("joins neighbouring anchors with straight segments only", () => {
    const layout = layoutHistory(three, at(720));
    expect(layout.segments).toHaveLength(2);
    layout.segments.forEach((segment, index) => {
      expect([segment.x1, segment.y1]).toEqual([layout.anchors[index].x, layout.anchors[index].y]);
      expect([segment.x2, segment.y2]).toEqual([layout.anchors[index + 1].x, layout.anchors[index + 1].y]);
    });
    expect(layout.path).toMatch(/^M-?[\d.]+,-?[\d.]+( L-?[\d.]+,-?[\d.]+)+$/);
    expect(layout.path).not.toMatch(/[CQSTAcqsta]/);
  });

  it.each([320, 375, 1280])("keeps every anchor's hit box inside the %ipx drawing and apart from its neighbours", (width) => {
    for (const points of [three, crowded, monthly, daily]) {
      const layout = layoutHistory(points, at(width));
      const half = HISTORY_LAYOUT_DEFAULTS.hitSize / 2;
      for (const anchor of layout.anchors) {
        expect(anchor.x - half).toBeGreaterThanOrEqual(0);
        expect(anchor.x + half).toBeLessThanOrEqual(width);
        expect(anchor.y - half).toBeGreaterThanOrEqual(0);
        expect(anchor.y + half).toBeLessThanOrEqual(HISTORY_LAYOUT_DEFAULTS.height);
      }
      const xs = layout.anchors.map((anchor) => anchor.x);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
      const inner = width - 2 * HISTORY_LAYOUT_DEFAULTS.paddingX;
      if ((points.length - 1) * HISTORY_LAYOUT_DEFAULTS.minGap <= inner) {
        for (let index = 1; index < xs.length; index += 1) expect(xs[index] - xs[index - 1]).toBeGreaterThanOrEqual(HISTORY_LAYOUT_DEFAULTS.minGap - 0.01);
      }
    }
  });

  it("places x by exam date and says when it had to nudge a point", () => {
    const wide = layoutHistory(three, at(1280));
    const { paddingX } = HISTORY_LAYOUT_DEFAULTS;
    expect(wide.adjusted).toBe(false);
    expect(wide.anchors[0].x).toBe(paddingX);
    expect(wide.anchors[2].x).toBe(1280 - paddingX);
    // 2026-01-15 → 04-15 is 90 of 194 days.
    expect(wide.anchors[1].x).toBeCloseTo(paddingX + (90 / 194) * (1280 - 2 * paddingX), 1);

    expect(layoutHistory(crowded, at(320)).adjusted).toBe(true);   // 07-27 and 07-28 would overlap
    const sameDay = layoutHistory([point(1, "1", "2026-07-28"), point(2, "2", "2026-07-28")], at(320));
    expect(sameDay.adjusted).toBe(true);
    expect(sameDay.anchors[1].x).toBeGreaterThan(sameDay.anchors[0].x);
  });

  it("puts axis ticks only at real exam dates and always labels the first and the last", () => {
    const layout = layoutHistory(monthly, at(320));
    expect(layout.ticks.map((tick) => tick.observedOn)).toEqual(monthly.map((item) => item.observedOn));
    expect(layout.ticks[0].labelled).toBe(true);
    expect(layout.ticks[layout.ticks.length - 1].labelled).toBe(true);
    const labelled = layout.ticks.filter((tick) => tick.labelled).map((tick) => tick.x);
    for (let index = 1; index < labelled.length; index += 1) expect(labelled[index] - labelled[index - 1]).toBeGreaterThanOrEqual(HISTORY_LAYOUT_DEFAULTS.minLabelGap);
    const sameDay = layoutHistory([point(1, "1", "2026-07-28"), point(2, "2", "2026-07-28")], at(320));
    expect(sameDay.ticks).toHaveLength(1);
  });

  it("is deterministic and independent of input order", () => {
    expect(layoutHistory(crowded, at(320))).toEqual(layoutHistory(crowded, at(320)));
    expect(layoutHistory([...monthly].reverse(), at(375))).toEqual(layoutHistory(monthly, at(375)));
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/history-layout.test.ts`
Expected: FAIL — cannot resolve `@/lib/my-data/history-layout`.

- [ ] **Step 4: Write `history-layout.ts`**

Create `apps/web/lib/my-data/history-layout.ts`:

```ts
/**
 * Pure geometry for the 측정 이력 graph. The person's own values only: y spans the series' own
 * minimum and maximum, neighbouring points are joined by straight segments (no curve, no fit, no
 * value is invented between points), x follows the exam date, ticks sit only at real exam dates.
 * Nothing here knows a range, a threshold or a direction.
 */
export type HistoryPointInput = { eventId: string; value: string; observedOn: string };

export type HistoryLayoutOptions = {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  /** Visible square anchor edge. */
  anchorSize: number;
  /** Transparent pointer/keyboard target edge around an anchor. */
  hitSize: number;
  /** Minimum distance between neighbouring anchor centres before a point is nudged. */
  minGap: number;
  /** Minimum distance between two labelled ticks. */
  minLabelGap: number;
};

export const HISTORY_LAYOUT_DEFAULTS: Omit<HistoryLayoutOptions, "width"> = {
  height: 180,
  paddingX: 28,
  paddingY: 24,
  anchorSize: 12,
  hitSize: 24,
  minGap: 26,
  minLabelGap: 72,
};

export type HistoryAnchor = { eventId: string; x: number; y: number; value: string; observedOn: string };
export type HistorySegment = { x1: number; y1: number; x2: number; y2: number };
export type HistoryTick = { x: number; observedOn: string; labelled: boolean };
export type HistoryLayout = {
  drawable: boolean;
  flat: boolean;
  adjusted: boolean;
  min: number | null;
  max: number | null;
  anchors: HistoryAnchor[];
  segments: HistorySegment[];
  ticks: HistoryTick[];
  /** `M x,y L x,y …` — move and line commands only. */
  path: string;
};

const NUMERIC = /^-?\d+(\.\d+)?$/;
const NOTHING: HistoryLayout = { drawable: false, flat: false, adjusted: false, min: null, max: null, anchors: [], segments: [], ticks: [], path: "" };

export function parseHistoryValue(raw: string): number | null {
  const text = raw.replace(/,/g, "").trim();
  return NUMERIC.test(text) ? Number(text) : null;
}

function dayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function layoutHistory(points: readonly HistoryPointInput[], options: HistoryLayoutOptions): HistoryLayout {
  const numeric = points
    .map((point, index) => ({ point, index, number: parseHistoryValue(point.value) }))
    .filter((entry): entry is { point: HistoryPointInput; index: number; number: number } => entry.number !== null)
    // Time order; equal dates keep a stable, input-independent order by event id.
    .sort((a, b) => a.point.observedOn.localeCompare(b.point.observedOn) || a.point.eventId.localeCompare(b.point.eventId));
  if (numeric.length < 2) return NOTHING;

  const { width, height, paddingX, paddingY, minGap, minLabelGap } = options;
  const left = paddingX;
  const right = width - paddingX;
  const innerWidth = Math.max(0, right - left);
  const top = paddingY;
  const innerHeight = Math.max(0, height - 2 * paddingY);
  const count = numeric.length;

  const values = numeric.map((entry) => entry.number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = min === max;

  const days = numeric.map((entry) => dayNumber(entry.point.observedOn));
  const span = days[count - 1] - days[0];
  const even = numeric.map((_, index) => left + (index / (count - 1)) * innerWidth);
  const byDate = span > 0 ? days.map((day) => left + ((day - days[0]) / span) * innerWidth) : even;
  let xs = [...byDate];
  if ((count - 1) * minGap > innerWidth) {
    xs = even; // cannot keep every point apart: even spacing in time order
  } else {
    for (let index = 1; index < count; index += 1) xs[index] = Math.max(xs[index], xs[index - 1] + minGap);
    if (xs[count - 1] > right) {
      xs[count - 1] = right;
      for (let index = count - 2; index >= 0; index -= 1) xs[index] = Math.min(xs[index], xs[index + 1] - minGap);
    }
  }
  const adjusted = span === 0 || xs.some((x, index) => Math.abs(x - byDate[index]) > 0.5);

  const anchors: HistoryAnchor[] = numeric.map((entry, index) => ({
    eventId: entry.point.eventId,
    x: round2(xs[index]),
    y: round2(flat ? height / 2 : top + ((max - entry.number) / (max - min)) * innerHeight),
    value: entry.point.value,
    observedOn: entry.point.observedOn,
  }));
  const segments: HistorySegment[] = anchors.slice(1).map((anchor, index) => ({
    x1: anchors[index].x, y1: anchors[index].y, x2: anchor.x, y2: anchor.y,
  }));
  const path = anchors.map((anchor, index) => `${index === 0 ? "M" : "L"}${anchor.x},${anchor.y}`).join(" ");

  // One tick per real exam date, at the first anchor of that date. Labels are thinned, never invented.
  const firstOfDate = anchors.filter((anchor, index) => index === 0 || anchors[index - 1].observedOn !== anchor.observedOn);
  const lastX = firstOfDate[firstOfDate.length - 1].x;
  let previousLabelX = Number.NEGATIVE_INFINITY;
  const ticks: HistoryTick[] = firstOfDate.map((anchor, index) => {
    const isEdge = index === 0 || index === firstOfDate.length - 1;
    const fits = anchor.x - previousLabelX >= minLabelGap && lastX - anchor.x >= minLabelGap;
    // The first and the last real date are always labelled; one in between only when it clears both neighbours.
    const labelled = isEdge || fits;
    if (labelled) previousLabelX = anchor.x;
    return { x: anchor.x, observedOn: anchor.observedOn, labelled };
  });

  return { drawable: true, flat, adjusted, min, max, anchors, segments, ticks, path };
}
```

- [ ] **Step 5: Run the geometry tests to verify they pass**

Run: `pnpm --dir apps/web exec vitest run tests/history-layout.test.ts`
Expected: 10 tests pass (7 `it` blocks plus the `it.each` over three widths).

- [ ] **Step 6: Commit the geometry**

```bash
git add apps/web/lib/my-data/history-layout.ts apps/web/tests/history-layout.test.ts
git commit -m "feat(web): pure geometry for the measurement-history graph (own min/max, straight segments, real-date ticks)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 7: Write the failing screen tests**

Create `apps/web/tests/measurement-history.test.tsx`:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { MeasurementHistory } from "@/components/my-data/history/MeasurementHistory";
import { syntheticSeries } from "./fixtures/foundation";

const session = { sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b", subjectId: "synthetic-jason", status: "AUTHENTICATED", expiresAt: "2026-08-30T08:30:00Z" };
const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json(session)),
  http.get("/api/foundation/series", () => HttpResponse.json(syntheticSeries())),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => { cleanup(); server.resetHandlers(); window.location.hash = ""; });

it("lists every series with its three computed numbers as text and the same numbers as a table", async () => {
  const { container } = render(<MeasurementHistory />);
  const sections = await screen.findAllByTestId("history-series");
  expect(sections.map((section) => within(section).getByRole("heading", { level: 2 }).textContent)).toEqual(["당화혈색소", "비타민 D", "총콜레스테롤"]);

  const cholesterol = within(sections[2]);
  expect(cholesterol.getByTestId("derived-last-difference")).toHaveTextContent(/^-4 mg\/dL \(-2\.1%\)$/);
  expect(cholesterol.getByTestId("derived-per-30-days")).toHaveTextContent(/^-0\.6 mg\/dL$/);
  expect(cholesterol.getByTestId("derived-mean-of-last-3")).toHaveTextContent(/^계산할 수 없어요$/);
  const rows = within(cholesterol.getByRole("table", { name: "총콜레스테롤 측정 이력" })).getAllByRole("row");
  expect(rows.map((row) => row.textContent)).toEqual([
    "검사일값단위출처",
    "2026. 1. 15.194mg/dL출처 보기",
    "2026. 7. 28.190mg/dL출처 보기",
  ]);
  expect(cholesterol.getByRole("link", { name: "총콜레스테롤 190 mg/dL, 2026. 7. 28. 출처 보기" }))
    .toHaveAttribute("href", "/my-data#event-8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d65");

  // A %-unit series has no percent of a percent.
  expect(within(sections[0]).getByTestId("derived-last-difference")).toHaveTextContent(/^-0\.2 %$/);
  expect(within(sections[0]).getByTestId("derived-per-30-days")).toHaveTextContent(/^-0\.03 %$/);

  expect(screen.getByText("점은 확인한 값이고, 점 사이의 선은 값이 아니에요. 선의 모양이 건강 상태를 뜻하지 않아요.")).toBeVisible();
  expect(screen.getByText("뺄셈과 나눗셈으로만 계산했어요. 의미는 판단하지 않아요.")).toBeVisible();
  for (const term of ["마지막 두 값의 차이", "30일로 환산한 차이", "최근 3회 평균"]) expect(cholesterol.getByText(term)).toBeVisible();
  expect(container.textContent).not.toMatch(/120-199|참고치|상승|하락|증가|감소|빨라|느려|좋아|나빠|추세|→|↑|↓/);
  expect(await axe(container)).toHaveNoViolations();
});

it("draws one labelled image per series with two or more points, with focusable anchors and straight lines only", async () => {
  const { container } = render(<MeasurementHistory />);
  const sections = await screen.findAllByTestId("history-series");

  const graph = within(sections[2]).getByRole("img", { name: "총콜레스테롤 mg/dL, 측정 2회, 2026. 1. 15.부터 2026. 7. 28.까지. 같은 값이 아래 표에 있어요." });
  expect(graph.tagName.toLowerCase()).toBe("svg");
  const anchors = within(sections[2]).getAllByRole("button", { name: /^총콜레스테롤 \d+ mg\/dL, / });
  expect(anchors.map((anchor) => anchor.getAttribute("aria-label"))).toEqual(["총콜레스테롤 194 mg/dL, 2026. 1. 15.", "총콜레스테롤 190 mg/dL, 2026. 7. 28."]);
  anchors.forEach((anchor) => expect(anchor).toHaveAttribute("tabindex", "0"));
  const paths = [...sections[2].querySelectorAll("path[data-ribbon]")];
  expect(paths.length).toBeGreaterThan(0);
  paths.forEach((path) => expect(path.getAttribute("d")).toMatch(/^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+)+$/));
  expect(container.querySelector("[data-band], [data-threshold], [data-trend]")).toBeNull();

  // One point: the table only, and it says why.
  expect(within(sections[1]).queryByRole("img")).toBeNull();
  expect(within(sections[1]).getByText("값이 하나라서 그래프 없이 표로만 보여드려요.")).toBeVisible();
  expect(within(sections[1]).getByRole("table", { name: "비타민 D 측정 이력" })).toBeVisible();
});

it("opens an annotation card for the chosen anchor by click and by keyboard, and closes it again", async () => {
  render(<MeasurementHistory />);
  const section = within((await screen.findAllByTestId("history-series"))[2]);
  const anchor = section.getByRole("button", { name: "총콜레스테롤 190 mg/dL, 2026. 7. 28." });

  await userEvent.click(anchor);
  expect(anchor).toHaveAttribute("aria-pressed", "true");
  const card = section.getByRole("group", { name: "선택한 측정값" });
  expect(card).toHaveTextContent("190 mg/dL");
  expect(card).toHaveTextContent("2026. 7. 28.");
  expect(within(card).getByRole("link", { name: "출처 보기" })).toHaveAttribute("href", "/my-data#event-8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d65");

  await userEvent.click(anchor);
  expect(section.queryByRole("group", { name: "선택한 측정값" })).toBeNull();
  anchor.focus();
  await userEvent.keyboard("{Enter}");
  expect(section.getByRole("group", { name: "선택한 측정값" })).toBeVisible();
  await userEvent.keyboard(" ");
  expect(section.queryByRole("group", { name: "선택한 측정값" })).toBeNull();
});

it("focuses the series that holds the event named in the hash", async () => {
  window.location.hash = "#event-8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d62";
  render(<MeasurementHistory />);
  await screen.findAllByTestId("history-series");
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toHaveFocus();
});

it("says so when there is nothing yet, and passes axe", async () => {
  server.use(http.get("/api/foundation/series", () => HttpResponse.json({ series: [] })));
  const { container } = render(<MeasurementHistory />);
  expect(await screen.findByText("아직 확인한 기록이 없어요. 결과지를 추가해 값을 확인하면 여기에 항목별로 모여요.")).toBeVisible();
  expect(screen.queryByTestId("history-series")).toBeNull();
  expect(await axe(container)).toHaveNoViolations();
});

it("shows a retryable error, recovers on retry, and sends an expired session home", async () => {
  let unavailable = true;
  server.use(http.get("/api/foundation/series", () => unavailable
    ? HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 503 })
    : HttpResponse.json(syntheticSeries())));
  const { container } = render(<MeasurementHistory />);
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 응답하지 않아요");
  expect(await axe(container)).toHaveNoViolations();
  unavailable = false;
  await userEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
  expect(await screen.findAllByTestId("history-series")).toHaveLength(3);
  expect(screen.queryByRole("alert")).toBeNull();

  cleanup();
  server.use(http.get("/api/foundation/session", () => HttpResponse.json({ code: "session_invalid" }, { status: 401 })));
  render(<MeasurementHistory />);
  expect(await screen.findByRole("link", { name: "홈에서 다시 로그인" })).toHaveAttribute("href", "/");
});

it("rejects a server that starts sending a direction instead of showing it", async () => {
  const broken = syntheticSeries();
  server.use(http.get("/api/foundation/series", () => HttpResponse.json({ series: [{ ...broken.series[2], direction: "down" }] })));
  render(<MeasurementHistory />);
  expect(await screen.findByRole("alert")).toHaveTextContent("서버 응답 형식을 확인할 수 없어");
  expect(screen.queryByTestId("history-series")).toBeNull();
});
```

In `apps/web/tests/my-data.test.tsx` add:

```tsx
it("links to the measurement history and opens the evidence drawer named in the hash", async () => {
  window.location.hash = "#event-8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d53";
  render(<MyData />);
  await screen.findByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
  expect(screen.getByRole("link", { name: "측정 이력" })).toHaveAttribute("href", "/my-data/history");
  expect(await screen.findByRole("region", { name: "당화혈색소 근거" })).toBeVisible();
  window.location.hash = "";
});
```

In `apps/web/tests/evidence-drawer.test.tsx` add (reuse that file's existing render helper/imports; `syntheticHealthEvent()`'s id is `8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50`):

```tsx
it("links to the measurement history of this item", () => {
  render(<EvidenceDrawer event={syntheticHealthEvent()} onClose={() => {}} />);
  expect(screen.getByRole("link", { name: "이 항목의 측정 이력 보기" }))
    .toHaveAttribute("href", "/my-data/history#event-8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50");
});
```

In `apps/web/tests/korean-ux-copy.test.ts` add to `userFacingFiles` after `"components/my-data/HealthEventTable.tsx",`:

```ts
  "components/my-data/history/MeasurementHistory.tsx",
  "components/my-data/history/HistoryGraph.tsx",
```

and add this test inside the `describe`:

```ts
  it("states on the history screen that the line is not data and that nothing is judged", () => {
    const history = source("components/my-data/history/MeasurementHistory.tsx");
    const graph = source("components/my-data/history/HistoryGraph.tsx");
    expect(graph).toContain("점은 확인한 값이고, 점 사이의 선은 값이 아니에요. 선의 모양이 건강 상태를 뜻하지 않아요.");
    expect(history).toContain("뺄셈과 나눗셈으로만 계산했어요. 의미는 판단하지 않아요.");
    for (const term of ["마지막 두 값의 차이", "30일로 환산한 차이", "최근 3회 평균"]) expect(history).toContain(term);
    for (const file of [history, graph]) {
      expect(file).not.toMatch(/[↑↓▲▼→]/);
      expect(file).not.toMatch(/referenceRange|참고치|기준치/);
    }
    // Colour identifies a series by its position in the list, never by a value.
    expect(graph).not.toMatch(/value\s*[<>]=?|delta|percent/);
  });
```

- [ ] **Step 8: Run them to verify they fail**

Run: `pnpm --dir apps/web exec vitest run tests/measurement-history.test.tsx tests/my-data.test.tsx tests/evidence-drawer.test.tsx tests/korean-ux-copy.test.ts`
Expected: FAIL — the two component files do not exist; the 내 데이터 link and the drawer link are missing.

- [ ] **Step 9: Write the graph component**

Create `apps/web/components/my-data/history/HistoryGraph.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MeasurementSeries } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { HISTORY_LAYOUT_DEFAULTS, layoutHistory } from "@/lib/my-data/history-layout";
import styles from "@/components/my-data/history/History.module.css";

/** The drawing is laid out at the container's real width so anchors keep their size on a phone. */
function useContainerWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => {
      const measured = Math.floor(element.getBoundingClientRect().width);
      if (measured > 0) setWidth(measured);
    };
    measure();
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

type HistoryGraphProps = {
  series: MeasurementSeries;
  /** Position of the series in the list. It picks the identifying colour and nothing else. */
  seriesIndex: number;
};

/**
 * The person's own values: square anchors at the confirmed values, straight segments between
 * neighbours, y from this series' own minimum to its own maximum. The ribbon (outer band plus a
 * dashed centre line) is the same straight path stroked twice at fixed widths.
 */
export function HistoryGraph({ series, seriesIndex }: HistoryGraphProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(wrapRef);
  const [selectedId, setSelectedId] = useState<string>();
  const layout = useMemo(() => layoutHistory(series.points, { ...HISTORY_LAYOUT_DEFAULTS, width }), [series.points, width]);
  const { height, anchorSize, hitSize } = HISTORY_LAYOUT_DEFAULTS;
  const selected = layout.anchors.find((anchor) => anchor.eventId === selectedId);
  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  const toggle = (eventId: string) => setSelectedId((current) => (current === eventId ? undefined : eventId));

  return (
    <div ref={wrapRef} className={styles.graphWrap} data-series-colour={(seriesIndex % 4) + 1}>
      {layout.drawable ? (
        <>
          <svg
            className={styles.graph}
            role="img"
            aria-label={`${series.concept} ${series.unit}, 측정 ${series.points.length}회, ${formatKoreanDate(first.observedOn)}부터 ${formatKoreanDate(last.observedOn)}까지. 같은 값이 아래 표에 있어요.`}
            viewBox={`0 0 ${width} ${height + 24}`}
            width={width}
            height={height + 24}
          >
            <path data-ribbon="band" className={styles.ribbonBand} d={layout.path} />
            <path data-ribbon="centre" className={styles.ribbonCentre} d={layout.path} />
            <g className={styles.ticks} aria-hidden="true">
              {layout.ticks.map((tick) => (
                <g key={tick.observedOn}>
                  <line x1={tick.x} x2={tick.x} y1={height - 6} y2={height} />
                  {tick.labelled ? (
                    <text x={tick.x} y={height + 16} textAnchor={tick.x < width / 3 ? "start" : tick.x > (width * 2) / 3 ? "end" : "middle"}>
                      {formatKoreanDate(tick.observedOn)}
                    </text>
                  ) : null}
                </g>
              ))}
            </g>
            {selected ? <line data-leader="" className={styles.leader} x1={selected.x} x2={selected.x} y1={selected.y} y2={height + 24} /> : null}
            {layout.anchors.map((anchor) => (
              <g
                key={anchor.eventId}
                role="button"
                tabIndex={0}
                aria-label={`${series.concept} ${anchor.value} ${series.unit}, ${formatKoreanDate(anchor.observedOn)}`}
                aria-pressed={anchor.eventId === selectedId}
                className={styles.anchor}
                onClick={() => toggle(anchor.eventId)}
                onKeyDown={(keyboard) => {
                  if (keyboard.key === "Enter" || keyboard.key === " ") {
                    keyboard.preventDefault();
                    toggle(anchor.eventId);
                  }
                }}
              >
                <rect data-hit="" x={anchor.x - hitSize / 2} y={anchor.y - hitSize / 2} width={hitSize} height={hitSize} />
                <rect data-anchor="" x={anchor.x - anchorSize / 2} y={anchor.y - anchorSize / 2} width={anchorSize} height={anchorSize} />
              </g>
            ))}
          </svg>
          {selected ? (
            <div role="group" aria-label="선택한 측정값" className={styles.card}>
              <strong className={styles.cardNumber}>{selected.value} {series.unit}</strong>
              <span>{formatKoreanDate(selected.observedOn)}</span>
              <a href={`/my-data#event-${selected.eventId}`}>출처 보기</a>
            </div>
          ) : null}
          <p className={styles.note}>점은 확인한 값이고, 점 사이의 선은 값이 아니에요. 선의 모양이 건강 상태를 뜻하지 않아요.</p>
          {layout.adjusted ? (
            <p className={styles.note} data-testid="history-adjusted-notice">점이 겹치지 않도록 위치를 조금 옮겼어요. 정확한 검사일은 아래 표에서 확인해 주세요.</p>
          ) : null}
        </>
      ) : (
        <p className={styles.note}>{series.points.length === 1 ? "값이 하나라서 그래프 없이 표로만 보여드려요." : "숫자가 아닌 값이 있어 그래프 없이 표로만 보여드려요."}</p>
      )}
    </div>
  );
}
```

(The copy-scan regex in Step 7 forbids the identifiers `delta`/`percent` and any `value <`/`value >` comparison in this file on purpose: the graph must not be able to branch on a value. `tick.x < width / 3` compares a position, not a value, and does not match.)

- [ ] **Step 10: Write the screen component, the route and the CSS module**

Create `apps/web/components/my-data/history/MeasurementHistory.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createFoundationClient, type MeasurementSeries } from "@/lib/foundation/client";
import { describeFoundationError, foundationShellState } from "@/lib/foundation/messages";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { HistoryGraph } from "@/components/my-data/history/HistoryGraph";
import styles from "@/components/my-data/history/History.module.css";

const NOT_COMPUTABLE = "계산할 수 없어요";

function needsSignIn(error: unknown) {
  const state = foundationShellState(error);
  return state === "UNAUTHENTICATED" || state === "SESSION_EXPIRED";
}

/** The server's strings with the unit appended. Nothing is recomputed, rounded or coloured here. */
function lastDifferenceText(series: MeasurementSeries) {
  const difference = series.derived.lastDifference;
  if (!difference) return NOT_COMPUTABLE;
  return `${difference.absolute} ${series.unit}${difference.percent == null ? "" : ` (${difference.percent}%)`}`;
}

function withUnit(text: string | undefined, unit: string) {
  return text === undefined ? NOT_COMPUTABLE : `${text} ${unit}`;
}

export function MeasurementHistory() {
  const client = useMemo(() => createFoundationClient(), []);
  const [series, setSeries] = useState<MeasurementSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorAction, setErrorAction] = useState<"retry-read" | "sign-in">();
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage("");
    setErrorAction(undefined);
    void (async () => {
      try {
        await client.getSession();
        const loaded = await client.getSeries();
        if (active) setSeries(loaded.series);
      } catch (error) {
        if (active) {
          setSeries([]);
          setErrorMessage(describeFoundationError(error));
          setErrorAction(needsSignIn(error) ? "sign-in" : "retry-read");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [client, loadAttempt]);

  // Arriving from an evidence drawer: move to the series that holds that event.
  useEffect(() => {
    if (series.length === 0 || typeof window === "undefined") return;
    const match = /^#event-([0-9a-f-]{36})$/.exec(window.location.hash);
    if (!match) return;
    const index = series.findIndex((item) => item.points.some((point) => point.eventId === match[1]));
    if (index < 0) return;
    const heading = document.getElementById(`history-series-title-${index}`);
    if (heading && typeof heading.scrollIntoView === "function") heading.scrollIntoView({ block: "start" });
    heading?.focus();
  }, [series]);

  return (
    <IntegratedShell current="my-data" status="예시 데이터">
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.hero} aria-labelledby="history-title">
            <p><a href="/my-data">나의 데이터로 돌아가기</a></p>
            <h1 id="history-title">측정 이력</h1>
            <p>같은 항목의 확인한 값을 검사일 순서로 모았어요. 값의 의미나 변화의 방향은 판단하지 않아요.</p>
            <p>뺄셈과 나눗셈으로만 계산했어요. 의미는 판단하지 않아요.</p>
          </section>

          {loading && <p role="status" aria-live="polite">서버에서 측정 이력을 불러오고 있어요.</p>}
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}{" "}
            {errorAction === "sign-in" && <a href="/">홈에서 다시 로그인</a>}
            {errorAction === "retry-read" && <button type="button" disabled={loading} onClick={() => setLoadAttempt((attempt) => attempt + 1)}>다시 불러오기</button>}
          </p>}
          {!loading && !errorMessage && series.length === 0 && (
            <p>아직 확인한 기록이 없어요. 결과지를 추가해 값을 확인하면 여기에 항목별로 모여요.</p>
          )}

          {series.map((item, index) => (
            <section key={`${item.conceptCode ?? item.concept}|${item.unit}`} className={styles.series} data-testid="history-series" aria-labelledby={`history-series-title-${index}`}>
              <header className={styles.seriesHeader}>
                <h2 id={`history-series-title-${index}`} tabIndex={-1}>{item.concept}</h2>
                <span className={styles.unit}>{item.unit}</span>
              </header>

              <HistoryGraph series={item} seriesIndex={index} />

              <dl className={styles.derived}>
                <div><dt>마지막 두 값의 차이</dt><dd data-testid="derived-last-difference">{lastDifferenceText(item)}</dd></div>
                <div><dt>30일로 환산한 차이</dt><dd data-testid="derived-per-30-days">{withUnit(item.derived.per30Days, item.unit)}</dd></div>
                <div><dt>최근 3회 평균</dt><dd data-testid="derived-mean-of-last-3">{withUnit(item.derived.meanOfLast3, item.unit)}</dd></div>
              </dl>

              <div className={styles.tableWrap}>
                <table className={styles.table} aria-label={`${item.concept} 측정 이력`}>
                  <thead><tr><th scope="col">검사일</th><th scope="col">값</th><th scope="col">단위</th><th scope="col">출처</th></tr></thead>
                  <tbody>
                    {item.points.map((point) => (
                      <tr key={point.eventId}>
                        <th scope="row">{formatKoreanDate(point.observedOn)}</th>
                        <td className={styles.number}>{point.value}</td>
                        <td>{item.unit}</td>
                        <td><a href={`/my-data#event-${point.eventId}`} aria-label={`${item.concept} ${point.value} ${item.unit}, ${formatKoreanDate(point.observedOn)} 출처 보기`}>출처 보기</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </main>
    </IntegratedShell>
  );
}
```

Create `apps/web/app/my-data/history/page.tsx`:

```tsx
import type { Metadata } from "next";
import { MeasurementHistory } from "@/components/my-data/history/MeasurementHistory";

export const metadata: Metadata = {
  title: "측정 이력",
  description: "같은 항목의 확인한 값을 검사일 순서로 모아 표와 그래프로 보는 화면",
};

export default function MeasurementHistoryPage() {
  return <MeasurementHistory />;
}
```

Create `apps/web/components/my-data/history/History.module.css`. The **token block** is the only place a colour or font appears; replace its right-hand values with the ones in `.superpowers/sdd/wave4-mockup-decision.md` (the values below are the fallback when the notes leave a token open). Every rule below the block is layout and must stay as written:

```css
/* Visual-language pilot, this screen only. Tokens are scoped to .page so nothing leaks into the app. */
.page {
  --hist-bg: #f3f1ec;                 /* warm light grey */
  --hist-grid-dot: #cfcac0;
  --hist-ink: var(--gc-color-text-primary);
  --hist-ink-soft: var(--gc-color-text-secondary);
  --hist-card: var(--gc-color-surface-raised);
  --hist-line: var(--gc-color-line-strong);
  --hist-series-1: #3d5a80;           /* series identity only — never a value */
  --hist-series-2: #7a5c3e;
  --hist-series-3: #4f6f52;
  --hist-series-4: #6b4f7a;
  --hist-fill-accent: #d7f26b;        /* lime: fills only, never text */
  --hist-ribbon-band: 10px;           /* fixed thickness: carries no meaning */
  --hist-ribbon-centre: 1.5px;
  --hist-font-title: Georgia, "Noto Serif KR", serif;
  --hist-font-number: var(--gc-type-mono);

  min-height: 100vh;
  color: var(--hist-ink);
  background-color: var(--hist-bg);
  background-image: radial-gradient(var(--hist-grid-dot) 1px, transparent 1px);
  background-size: 16px 16px;
}
.shell { max-width: 1120px; margin: 0 auto; padding: var(--gc-space-6) var(--gc-space-4) var(--gc-space-10); display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gc-space-6); min-width: 0; }
.hero { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gc-space-2); min-width: 0; overflow-wrap: anywhere; }
.hero h1 { margin: 0; font: 400 32px/1.2 var(--hist-font-title); }
.hero p { margin: 0; color: var(--hist-ink-soft); }
.hero a { color: inherit; min-height: 44px; display: inline-flex; align-items: center; }

.series { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gc-space-3); min-width: 0; padding: var(--gc-space-4); border: 1px solid var(--hist-line); border-radius: 8px; background: var(--hist-card); overflow-wrap: anywhere; }
.seriesHeader { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gc-space-2); min-width: 0; }
.seriesHeader h2 { margin: 0; font: 400 22px/1.3 var(--hist-font-title); }
.seriesHeader h2:focus-visible { outline: 3px solid var(--gc-color-focus-ring); outline-offset: 2px; }
.unit { color: var(--hist-ink-soft); font-family: var(--hist-font-number); }

.graphWrap { width: 100%; min-width: 0; max-width: 100%; overflow: hidden; color: var(--hist-series-1); }
.graphWrap[data-series-colour="2"] { color: var(--hist-series-2); }
.graphWrap[data-series-colour="3"] { color: var(--hist-series-3); }
.graphWrap[data-series-colour="4"] { color: var(--hist-series-4); }
.graph { display: block; max-width: 100%; height: auto; }
.ribbonBand { fill: none; stroke: currentColor; stroke-opacity: 0.22; stroke-width: var(--hist-ribbon-band); stroke-linecap: square; stroke-linejoin: miter; }
.ribbonCentre { fill: none; stroke: currentColor; stroke-width: var(--hist-ribbon-centre); stroke-dasharray: 3 3; }
.ticks line { stroke: var(--hist-line); stroke-width: 1; }
.ticks text { fill: var(--hist-ink-soft); font: 12px var(--hist-font-number); }
.leader { stroke: var(--hist-ink); stroke-width: 1; stroke-dasharray: 2 2; }
.anchor { cursor: pointer; }
.anchor rect[data-hit] { fill: transparent; }
.anchor rect[data-anchor] { fill: var(--hist-card); stroke: currentColor; stroke-width: 2; }
.anchor[aria-pressed="true"] rect[data-anchor] { fill: var(--hist-fill-accent); stroke: var(--hist-ink); }
.anchor:focus-visible { outline: none; }
.anchor:focus-visible rect[data-anchor] { stroke: var(--gc-color-focus-ring); stroke-width: 3; }

.card { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gc-space-2) var(--gc-space-4); min-width: 0; margin-top: var(--gc-space-1); padding: var(--gc-space-3); border: 1px solid var(--hist-ink); border-radius: 6px; background: var(--hist-card); color: var(--hist-ink); overflow-wrap: anywhere; }
.cardNumber { font: 700 22px/1.2 var(--hist-font-number); }
.card a, .table a { color: var(--hist-ink); min-height: 44px; display: inline-flex; align-items: center; }
.note { margin: var(--gc-space-2) 0 0; color: var(--hist-ink-soft); font-size: 13px; min-width: 0; overflow-wrap: anywhere; }

.derived { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: var(--gc-space-3); margin: 0; min-width: 0; }
.derived div { min-width: 0; }
.derived dt { color: var(--hist-ink-soft); font-size: 13px; }
.derived dd { margin: 0; font: 700 20px/1.3 var(--hist-font-number); color: var(--hist-ink); overflow-wrap: anywhere; }

/* Four columns may not fit a 320px phone under Linux fonts; the wrapper scrolls so the document never does. */
.tableWrap { width: 100%; max-width: 100%; min-width: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.table { width: 100%; border-collapse: collapse; font-size: 15px; }
.table th, .table td { text-align: left; padding: var(--gc-space-2) var(--gc-space-3); border-bottom: 1px solid var(--hist-line); font-weight: 400; }
.table .number { font-family: var(--hist-font-number); text-align: right; }

/* The pilot has no animation. Any transition the mockup notes ask for goes inside this query only. */
@media (prefers-reduced-motion: no-preference) {
  .anchor rect[data-anchor] { transition: none; }
}
```

Rules for applying the mockup notes: derived numbers, card and table text use `--hist-ink` (never a series colour and never `--hist-fill-accent`); check each `--hist-series-*` against `--hist-card` for at least 3:1 (graphical object) and `--hist-ink`/`--hist-ink-soft` against `--hist-bg` and `--hist-card` for at least 4.5:1, and record the ratios in the task report.

- [ ] **Step 11: Add the two entries and the hash selection**

In `apps/web/components/my-data/MyData.tsx`:

1. After the hero `<section>` closing tag add:

```tsx
          <nav className={styles.secondary} aria-label="나의 데이터 다른 보기">
            <a href="/my-data/history">측정 이력</a>
          </nav>
```

2. Directly under the existing loading `useEffect` (the one that calls `client.getHealthEvents()`) add:

```tsx
  // Arriving from 측정 이력 "출처 보기": open that event's evidence drawer.
  useEffect(() => {
    if (events.length === 0 || typeof window === "undefined") return;
    const match = /^#event-([0-9a-f-]{36})$/.exec(window.location.hash);
    if (match && events.some((event) => event.eventId === match[1])) setSelectedId(match[1]);
  }, [events]);
```

In `apps/web/components/my-data/EvidenceDrawer.tsx` add after the `기록 목록에서 이 값 보기` paragraph:

```tsx
      <p><a href={`/my-data/history#event-${event.eventId}`}>이 항목의 측정 이력 보기</a></p>
```

- [ ] **Step 12: Run the web suite, tsc and the build**

Run: `pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm --dir apps/web build && git checkout -- apps/web/next-env.d.ts`
Expected: every test file passes (including the 7 new screen tests, the new 내 데이터/drawer/copy tests and all existing `my-data` tests); tsc silent; the build lists the route `/my-data/history`. If jest-axe reports `nested-interactive` or an SVG role problem, fix the markup (not the test): anchors must stay `role="button"` with `tabIndex={0}` inside the `role="img"` SVG only if axe accepts it — if it does not, change the SVG to `role="group"` with the same `aria-label` **and** add a visually hidden `<p>` with that summary, then update the test's `getByRole("img", …)` to `getByRole("group", …)` and note the deviation from the spec's `role="img"` in the task report.

- [ ] **Step 13: Commit**

```bash
git add apps/web/components/my-data/history apps/web/app/my-data/history apps/web/components/my-data/MyData.tsx apps/web/components/my-data/EvidenceDrawer.tsx apps/web/tests/measurement-history.test.tsx apps/web/tests/my-data.test.tsx apps/web/tests/evidence-drawer.test.tsx apps/web/tests/korean-ux-copy.test.ts
git status --short   # next-env.d.ts must not be staged
git commit -m "feat(web): 측정 이력 screen — own-scale straight-line graph, three computed numbers, equal table, visual-language pilot

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Browser lifecycle additions (series, 측정 이력, FHIR download, 320px matrix)

**Files:**
- Modify: `apps/web/e2e/foundation-lifecycle.spec.ts` (inside `visible Korean product persists reloads revokes and deletes the synthetic lifecycle`: after `await captureMatrix(page, info, "my-data");` ~line 405, and after the JSON download block ~line 489)

**Interfaces:**
- Consumes: the spec's existing `browserApi(page, path)`, `captureMatrix(page, info, state)`; test ids and hash contracts from Task 7; endpoints from Tasks 2-3. State at the insertion point: July uploaded first (총콜레스테롤 corrected 188→190 on 2026-07-28, 당화혈색소 5.2 re-dated to 2026-07-27, 비타민 D excluded), January second (194 / 5.4 / 45 on 2026-01-15) — 5 events.
- Produces: nothing for later tasks.

Do **not** change the upload order (July, then January): the Wave 2C consent ordering and the Wave 3 `change-delta` absence both depend on it.

- [ ] **Step 1: Add the history and series assertions**

Insert directly after `await captureMatrix(page, info, "my-data");`:

```ts
  // Wave 4: 측정 이력. /changes omits delta here because the upload order runs against the exam
  // dates, but /series is always in time order, so its lastDifference IS present.
  const seriesResponse = await browserApi(page, "/api/foundation/series");
  expect(seriesResponse.status).toBe(200);
  expect(JSON.stringify(seriesResponse.body).toLowerCase()).not.toMatch(/reference|120-199|direction|trend|slope|forecast/);
  const seriesList = (seriesResponse.body as unknown as {
    series: Array<{ concept: string; unit: string; points: Array<{ value: string; observedOn: string }>; derived: { lastDifference?: { absolute: string; percent?: string }; per30Days?: string; meanOfLast3?: string } }>;
  }).series;
  expect(seriesList.map((item) => item.concept)).toEqual(["당화혈색소", "비타민 D", "총콜레스테롤"]);
  expect(seriesList[2].points.map((point) => `${point.observedOn} ${point.value}`)).toEqual(["2026-01-15 194", "2026-07-28 190"]);
  // 194 days: 190 − 194 = -4; -4 / 194 = -2.1 %; -4 / 194 × 30 = -0.6.
  expect(seriesList[2].derived).toEqual({ lastDifference: { absolute: "-4", percent: "-2.1" }, per30Days: "-0.6" });
  // 193 days (07-27): -0.2; no percent for a % unit; -0.2 / 193 × 30 = -0.03.
  expect(seriesList[0].points.map((point) => `${point.observedOn} ${point.value}`)).toEqual(["2026-01-15 5.4", "2026-07-27 5.2"]);
  expect(seriesList[0].derived).toEqual({ lastDifference: { absolute: "-0.2" }, per30Days: "-0.03" });
  expect(seriesList[1].points).toHaveLength(1);
  expect(seriesList[1].derived).toEqual({});

  await page.getByRole("searchbox", { name: "내 데이터에서 항목 찾기" }).fill("");
  await page.getByRole("link", { name: "측정 이력", exact: true }).click();
  await expect(page).toHaveURL(/\/my-data\/history$/);
  await expect(page.getByRole("heading", { level: 1, name: "측정 이력" })).toBeVisible();
  await expect(page.getByText("점은 확인한 값이고, 점 사이의 선은 값이 아니에요. 선의 모양이 건강 상태를 뜻하지 않아요.").first()).toBeVisible();
  await expect(page.getByText("뺄셈과 나눗셈으로만 계산했어요. 의미는 판단하지 않아요.")).toBeVisible();
  const historySeries = page.getByTestId("history-series");
  await expect(historySeries).toHaveCount(3);
  const cholesterolHistory = historySeries.filter({ hasText: "총콜레스테롤" });
  await expect(cholesterolHistory.getByTestId("derived-last-difference")).toHaveText("-4 mg/dL (-2.1%)");
  await expect(cholesterolHistory.getByTestId("derived-per-30-days")).toHaveText("-0.6 mg/dL");
  await expect(cholesterolHistory.getByTestId("derived-mean-of-last-3")).toHaveText("계산할 수 없어요");
  await expect(cholesterolHistory.getByRole("table", { name: "총콜레스테롤 측정 이력" }).getByRole("row")).toHaveCount(2 + 1);
  const hba1cHistory = historySeries.filter({ hasText: "당화혈색소" });
  await expect(hba1cHistory.getByTestId("derived-last-difference")).toHaveText("-0.2 %");
  await expect(hba1cHistory.getByTestId("derived-per-30-days")).toHaveText("-0.03 %");
  const vitaminHistory = historySeries.filter({ hasText: "비타민 D" });
  await expect(vitaminHistory.getByText("값이 하나라서 그래프 없이 표로만 보여드려요.")).toBeVisible();
  await expect(vitaminHistory.locator("svg")).toHaveCount(0);
  await expect(vitaminHistory.getByRole("table", { name: "비타민 D 측정 이력" }).getByRole("row")).toHaveCount(1 + 1);

  // Keyboard: an anchor is a focusable button; Enter opens the annotation card with its source link.
  const julyAnchor = cholesterolHistory.getByRole("button", { name: "총콜레스테롤 190 mg/dL, 2026. 7. 28." });
  await julyAnchor.focus();
  await page.keyboard.press("Enter");
  const annotation = cholesterolHistory.getByRole("group", { name: "선택한 측정값" });
  await expect(annotation).toContainText("190 mg/dL");
  await expect(annotation.getByRole("link", { name: "출처 보기" })).toHaveAttribute("href", /^\/my-data#event-[0-9a-f-]{36}$/);

  // No range, no direction, no arrow anywhere on the screen.
  await expect(page.getByText("120-199")).toHaveCount(0);
  expect(await page.content()).not.toContain("120-199");
  expect(await page.locator("main").innerText()).not.toMatch(/→|↑|↓|증가|감소|상승|하락|빨라|느려|좋아|나빠|추세|참고치/);
  await captureMatrix(page, info, "my-data-history");

  // 출처 보기 lands on 내 데이터 with that event's evidence drawer open; the drawer links back.
  await page.setViewportSize({ width: 390, height: 844 });
  await annotation.getByRole("link", { name: "출처 보기" }).click();
  await expect(page).toHaveURL(/\/my-data#event-[0-9a-f-]{36}$/);
  const historyDrawer = page.getByRole("region", { name: "총콜레스테롤 근거" });
  await expect(historyDrawer).toContainText("원래 값 188 mg/dL");
  await historyDrawer.getByRole("link", { name: "이 항목의 측정 이력 보기" }).click();
  await expect(page).toHaveURL(/\/my-data\/history#event-[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 2, name: "총콜레스테롤" })).toBeFocused();
```

(`captureMatrix` leaves the last viewport of its list active; the explicit `setViewportSize` restores the size the rest of the test was written for. `captureMatrix` expects exactly one `aria-current="page"` nav item for any state other than `home`/`entry`; the history screen passes because `IntegratedShell current="my-data"`. If the annotation card is gone after `captureMatrix` resized the page — the graph re-lays out but keeps `selectedId`, so it should not be — re-open it with the same focus + Enter before the click.)

- [ ] **Step 2: Add the FHIR assertions**

Insert directly after `expect(download.suggestedFilename()).toMatch(/^alm-health-events-\d{8}\.json$/);`:

```ts
  // Wave 4: the same records as a FHIR R4 Bundle. The JSON export above is unchanged.
  await expect(page.getByText("다른 건강기록 도구가 읽을 수 있는 형식이에요.")).toBeVisible();
  const fhirResponse = await page.request.get("/api/foundation/health-events/export/fhir");
  expect(fhirResponse.status()).toBe(200);
  expect(fhirResponse.headers()["content-type"]).toMatch(/^application\/fhir\+json/);
  expect(fhirResponse.headers()["content-disposition"]).toMatch(/^attachment; filename="alm-health-events-\d{8}\.fhir\.json"$/);
  expect(fhirResponse.headers()["cache-control"]).toBe("no-store");
  expect(fhirResponse.headers()["x-content-type-options"]).toBe("nosniff");
  const fhirText = await fhirResponse.text();
  expect(fhirText).not.toMatch(/interpretation|"subject"|"performer"|"low"|"high"/);
  const fhirBundle = JSON.parse(fhirText) as {
    resourceType: string; type: string; meta: { tag: Array<{ system: string; code: string }> };
    entry: Array<{ resource: {
      resourceType: string; id: string; status: string; effectiveDateTime: string;
      code: { coding?: Array<{ system: string; code: string }>; text: string };
      valueQuantity?: { value: number; unit: string }; referenceRange?: Array<{ text: string }>; note?: Array<{ text: string }>;
    } }>;
  };
  expect(fhirBundle.resourceType).toBe("Bundle");
  expect(fhirBundle.type).toBe("collection");
  expect(fhirBundle.meta.tag).toEqual([{ system: "https://alm.example/fhir/tag", code: "synthetic" }]);
  expect(fhirBundle.entry).toHaveLength(5);
  expect(fhirBundle.entry.every((entry) => entry.resource.resourceType === "Observation" && entry.resource.status === "final")).toBe(true);
  const fhirRanged = fhirBundle.entry.filter((entry) => entry.resource.referenceRange);
  expect(fhirRanged).toHaveLength(1);
  expect(fhirRanged[0].resource).toMatchObject({
    code: { coding: [{ system: "http://loinc.org", code: "2093-3" }], text: "총콜레스테롤" },
    effectiveDateTime: "2026-07-28",
    valueQuantity: { value: 190, unit: "mg/dL" },
    referenceRange: [{ text: "120-199" }],
    note: [{ text: "본인이 값을 수정함" }],
  });
  // The date-only correction (당화혈색소) carries no value note.
  expect(fhirBundle.entry.filter((entry) => entry.resource.note)).toHaveLength(1);
  const [fhirDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "내 기록 내보내기(FHIR)" }).click(),
  ]);
  expect(fhirDownload.suggestedFilename()).toMatch(/^alm-health-events-\d{8}\.fhir\.json$/);
```

- [ ] **Step 3: Run the browser lifecycle**

```bash
export PATH="$HOME/.gc-node24:$PATH"
export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'
export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'
pnpm foundation:e2e
git checkout -- apps/web/next-env.d.ts
```

Expected: `3 passed`. A failure named `my-data-history at 320x720 overflows horizontally` lists the offending element's class: fix it in `History.module.css` with `min-width: 0` / `minmax(0, 1fr)` / `overflow-wrap: anywhere` on that element (never by hiding content or changing the test). `data-control at 320x720` must still pass with the second export control.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/foundation-lifecycle.spec.ts
git commit -m "test(e2e): measurement history, time-ordered series numbers, FHIR download, 320px matrix

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Gates, evidence, one-line ledger amendments

**Files:**
- Create: `docs/status/2026-09-17/wave4.md`
- Modify: `AGENTS.md` (the "Diagnosis, normal/abnormal…" boundary bullet), `PROJECT_GUIDE.md` (§3 Core API row; §6 rule 5), `docs/roadmap/2026-09-02-roadmap.md` (row after `A12`)

**Interfaces:**
- Consumes: every earlier task's result. Produces: the evidence document.

- [ ] **Step 1: Run every gate and keep the output**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux
export PATH="$HOME/.gc-node24:$PATH"
export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'
export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'
pnpm security:runtime-policy
pnpm release:readiness:validate
pnpm web:test
pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json
pnpm --dir apps/web build
pnpm auth-security:gate
pnpm security:github-actions-policy
./gradlew.bat cleanTest test --no-daemon
pnpm medical-ai:native-text-gate
pnpm foundation:e2e
git checkout -- apps/web/next-env.d.ts
git diff --quiet "$(git merge-base HEAD origin/codex/wave7-reference-range-delta)" -- release/readiness.json && echo "readiness unchanged"
git log --reverse --format='%h %s' "$(git merge-base HEAD origin/codex/wave7-reference-range-delta)"..HEAD | head -1
```

Expected: every command exits 0; `readiness unchanged` prints; the first commit of the branch is `4e363ca docs: Wave 4 intended-use decision …` (the two decision documents precede all code). If `origin/codex/wave7-reference-range-delta` is not the PR #11 head, find the base with `gh pr view 11 --json headRefName` and use that ref. Any failing gate: fix the cause in its task's files with a test, re-run, and only then continue.

- [ ] **Step 2: Write the evidence document**

Create `docs/status/2026-09-17/wave4.md` with this content, replacing each `‹…›` with the literal output line from Step 1 (counts, durations). Do not round, summarise or upgrade a result; if a gate was not run, write "not run" and why.

```markdown
# Wave 4 evidence — 측정 이력, FHIR export, PR #5 F-3, Wave 3 minors, visual-language pilot (2026-09-17)

Branch `codex/wave8-measurement-history-fhir` (stacked on PR #11). Synthetic only. Release remains NO_GO; no readiness gate or verdict changed. Gate documents, committed before any code of this wave: `governance/intended-use-decision-measurement-history-2026-09-17.md` (item (c), "숫자 + 단순 그래프") and `governance/intended-use-decision-reference-range-and-delta-addendum-2026-09-17.md` (FHIR `referenceRange.text`).

## What exists now
- **Series API.** `GET /api/foundation/series` (owner-isolated, `no-store`, CURRENT only): one series per concept (same `concept_code`, else same label — connected components, because that rule is not transitive) and unit, points ordered by exam date, confirmation instant and record id. `derived` carries three numbers from subtraction and division, always in time order: `lastDifference` (the Wave 3 calculator and its narrowed rules), `per30Days` (HALF_EVEN, one more decimal than the inputs, omitted for equal dates), `meanOfLast3` (HALF_EVEN, one more decimal, omitted under three numeric values). No reference-range key or text, no direction.
- **측정 이력 (`/my-data/history`).** Reached from 내 데이터 ("측정 이력") and the evidence drawer ("이 항목의 측정 이력 보기"); the global navigation still has two destinations. Per series: the three numbers as text with the unit (no colour, no arrow), a graph of the person's own values (y from the series' own minimum to its own maximum, flat middle line when all values are equal, straight segments only, fixed ribbon thickness, ticks only at real exam dates, keyboard-focusable square anchors with an annotation card linking to the source) and the same values as a table. A one-point series is a table only. The screen states that the line between two points is not data. Geometry is a pure, unit-tested module (`apps/web/lib/my-data/history-layout.ts`); when two points would overlap they are nudged apart and the screen says so. Visual tokens are scoped to one CSS module (pilot; the rest of the app is unchanged) and follow `.superpowers/sdd/wave4-mockup-decision.md`.
- **FHIR export.** `GET /api/foundation/health-events/export/fhir`: `application/fhir+json`, `attachment; filename="alm-health-events-<YYYYMMDD>.fhir.json"`, `no-store`, `nosniff`. A `collection` Bundle tagged `synthetic`; one `Observation` per CURRENT record with LOINC coding when the concept table has one, `valueQuantity` (or `valueString`), `referenceRange[0].text` verbatim when the document printed one (no low/high), and `note` "본인이 값을 수정함" when the value was corrected. No `interpretation`, `subject` or `performer`; no new dependency. Audit: `HEALTH_EVENTS_EXPORTED` with resource type `EXPORT_FHIR` — no value, count or date. The JSON export is unchanged. 데이터 관리 has the second link "내 기록 내보내기(FHIR)".
- **Wave 3 minors.** Two ranges on one row are kept verbatim joined by one space (null past 40 characters); the MedGemma side-by-side report prints `referenceRangeAccuracy`; the arrival class is removed on `animationend`.
- **PR #5 F-3** (branch `codex/unified-health-product`, commit ‹sha›): a bootstrap the server refuses stays on the entry screen with its own reason and next action. Not part of this branch.
- **Copy scan.** Forbidden list gains 빨라, 느려, 좋아, 나빠, 추세 and covers the two new components.

## Evidence (local, 2026-09-17)
| Gate | Result |
|---|---|
| security:runtime-policy | ‹line› |
| release:readiness:validate | ‹line› |
| web:test | ‹Test Files … / Tests …› |
| tsc --noEmit | ‹no output (exit 0)› |
| apps/web build | ‹route list includes /my-data/history› |
| auth-security:gate | ‹line› |
| security:github-actions-policy | ‹line› |
| gradlew cleanTest test (embedded PostgreSQL) | ‹BUILD SUCCESSFUL …; per-module test counts, failures, skipped› |
| medical-ai:native-text-gate | ‹corpusId, fieldF1, referenceRangeAccuracy, passed› |
| foundation:e2e | ‹N passed (duration)› |
| readiness diff against the branch base | ‹exit 0› |

## Limits
No hosted run. The three numbers are arithmetic on values the person confirmed; they carry no meaning, and the graph shows only those values on their own scale — no band, threshold, fitted line, forecast or direction language exists, and adding any needs a new intended-use decision and a regulatory review before real personal health information is processed. The FHIR file is a hand-written subset (no Patient resource, no UCUM coding, not validated against a profile); FHIR import is out of scope. The visual language is a pilot on one screen. Readiness is unchanged.
```

After writing, search the file for `‹` and confirm none remains.

- [ ] **Step 3: Amend the three ledgers (one sentence each)**

`AGENTS.md` — in the bullet that starts `- Diagnosis, normal/abnormal, reference ranges in UI copy`, append inside the closing parenthesis, after `nothing else about ranges is.`:

```
 A person's own values in time order, three arithmetic numbers and a plain own-scale graph are permitted by `governance/intended-use-decision-measurement-history-2026-09-17.md`; bands, fitted lines, forecasts and direction words are not.
```

`PROJECT_GUIDE.md` §3, Core API row — append after the sentence ending `(`docs/status/2026-09-17/wave3.md`).`:

```
 Since Wave 4 it also serves the person's measurement series with three computed numbers and a FHIR R4 Bundle export (`docs/status/2026-09-17/wave4.md`).
```

`PROJECT_GUIDE.md` §6 rule 5 — replace `(latest decision:` … `arithmetic value differences only).` with:

```
   (latest decisions: `governance/intended-use-decision-reference-range-and-delta-2026-09-17.md`
   with its FHIR addendum — verbatim reference-range preservation and arithmetic value
   differences only — and `governance/intended-use-decision-measurement-history-2026-09-17.md` —
   measurement history, three computed numbers and a plain graph of the person's own values only).
```

`docs/roadmap/2026-09-02-roadmap.md` — add after the `| A12 |` row:

```
| A13 | Measurement history: `GET /api/foundation/series` (three computed numbers, time-ordered), `/my-data/history` (own-scale straight-line graph + equal table, visual-language pilot), FHIR R4 Bundle export with `referenceRange.text` only, Wave 3 minors, PR #5 F-3 on its own branch | `docs/status/2026-09-17/wave4.md` | implemented locally |
```

- [ ] **Step 4: Re-run the two document-sensitive gates and commit**

Run: `pnpm security:runtime-policy && pnpm release:readiness:validate` — Expected: both pass.

```bash
git status --short     # only the four documents; never next-env.d.ts, test-results or build output
git add docs/status/2026-09-17/wave4.md AGENTS.md PROJECT_GUIDE.md docs/roadmap/2026-09-02-roadmap.md
git commit -m "docs: Wave 4 evidence — measurement history, FHIR export, Wave 3 minors, PR #5 F-3

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Do not push or open a PR in this task; the session owner decides when (branch stays stacked on PR #11).

---

## Self-Review (run when the plan was written)

**Spec coverage.** §1 boundaries → Global Constraints, enforced by tests in Tasks 2 (no `reference` in `/series`), 4 (strict zod, forbidden words), 7 (copy test, no band/threshold nodes, no value-dependent branch in the graph), 8 (screen text); "decision documents first" → Task 9 Step 1 check. §2 → Tasks 1-2 (grouping, ordering, same-day points, unit split, each derived boundary; owner isolation, CURRENT after correction, no range text). §3 → Task 7 (gated on the mockup notes; geometry in `history-layout.ts` with own min/max, flat line, straight segments, bounds at 320/375/1280, determinism; table, `role="img"` summary, focusable anchors, one-point series, empty/error/retry, reduced motion, 320px rules, strict zod from Task 4) and Task 8 matrix. §4 → Task 3 (DTOs, structure rules, headers, isolation, audit) and Task 4 (link, help text, disabled at 0). §5 → Task 6. §6 → Task 5 (three minors, each with a test). §7 → Tasks 8-9. §8 out of scope: nothing in the plan adds direction text, regression, range display, reskin, templates, providers, FHIR import or a Patient resource.

**Placeholder scan.** The only deliberately open values are the CSS token block of Task 7 (filled from the founder's mockup notes, with working fallbacks written out) and the `‹…›` cells of the evidence table (literal gate output, with a check that none remains).

**Type consistency.** `SeriesPoint`/`SeriesDerived`/`MeasurementSeries`/`SeriesResponse` (Task 1) = JSON asserted in Task 2 = zod schema and `syntheticSeries()` in Task 4 = props in Task 7 = e2e expectations in Task 8. `ChangeDeltaCalculator.parse` is made `internal` in Task 1 and used in Tasks 1 and 3. `importJulyWithRange` is defined in Task 2 and reused in Task 3. Test ids `history-series`, `derived-last-difference`, `derived-per-30-days`, `derived-mean-of-last-3` and the hashes `/my-data#event-<id>`, `/my-data/history#event-<id>` are identical in Tasks 7 and 8. Audit resource type `EXPORT_FHIR` is identical in Task 3's service and test. Expected numbers: unit test 188 vs 194 → `-6`, `-3.1`, `-0.9`; PostgreSQL and e2e 190 vs 194 → `-4`, `-2.1`, `-0.6`; 당화혈색소 → `-0.2`, no percent, `-0.03` (193 or 194 days both round to `-0.03`); 비타민 D (PostgreSQL only) → `-3`, `-6.7`, `-0.5`.
