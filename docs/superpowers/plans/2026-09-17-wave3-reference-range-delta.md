# Wave 3 — Reference-range preservation, deterministic differences, export v2, MedGemma num_ctx, 내 데이터 minors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the reference-range text printed on a result-sheet row verbatim (stored on the candidate, copied to the record version, returned only in the person's own export — never displayed, never compared), append the signed arithmetic difference of two values to "최근 변화", list every COMPLETED document in the export, record one more MedGemma run at `num_ctx 8192`, and close the remaining 내 데이터 minors.

**Architecture:** The worker's row grammar already recognises reference-range text (`rangeText`) to exclude it from the value; it now also carries the range body as `ParsedCandidate.referenceRangeText`. Core V10 adds `reference_range_text VARCHAR(40)` to `gc_candidate` and `gc_health_record_version`; confirmation copies it, correction inherits it, and no controller DTO exposes it — only `GET /api/foundation/health-events/export` (schema `alm-health-events-export.v2`) carries it. A pure `ChangeDeltaCalculator` (BigDecimal subtraction/division, signed strings) attaches `delta` to `ChangeItem`; the web renders one judgement-free line. The benchmark gold gains `expectedReferenceRangeText`, runs gain `referenceRangeText`, and the TypeScript evaluator adds `referenceRangeAccuracy` with threshold 1. MedGemma's protocol adds `num_ctx: 8192` (digest changes) and the run is executed manually as evidence only.

**Tech Stack:** Kotlin 2.3.21 / Java 21 / Gradle 8.14.3 (`./gradlew.bat`), Spring Boot 3.5.16 + JdbcTemplate + Flyway + Bean Validation, JUnit 5 + AssertJ + MockMvc, PDFBox; Next 16.3.3 / React 19 / zod 4 / vitest + Testing Library + jest-axe + msw / Playwright 1.62; pnpm 11.20.0, Node 24.20.0; embedded PostgreSQL 16 for the gated JVM tests and the browser lifecycle; Ollama (local only) for the manual MedGemma run.

Spec: `docs/superpowers/specs/2026-09-17-wave3-reference-range-delta-design.md` (founder-approved 2026-09-17). Gate document (items (a)(b)): `governance/intended-use-decision-reference-range-and-delta-2026-09-17.md` — already committed on this branch (HEAD `42b80d9`), which is the precondition for (a)(b) code. Authority: `PROJECT_GUIDE.md` §6, `AGENTS.md`. Previous wave: `docs/superpowers/plans/2026-09-17-wave2c-changes-consent-export.md`, evidence `docs/status/2026-09-17/wave2c.md`.

## Global Constraints

- Toolchain: Node `24.20.0`, pnpm `11.20.0`, Java `21`. In every Git Bash shell first run `export PATH="$HOME/.gc-node24:$PATH"`. Gradle is `./gradlew.bat` from the repository root `C:/Users/Jason/Documents/genome-companion-korea-ux` (no whitespace in the path). Worker tests: `./gradlew.bat :apps:document-worker:test --no-daemon`. Benchmark tests: `./gradlew.bat :packages:korean-checkup-benchmark:test --no-daemon` (skipped when Pretendard is missing; run `pnpm install` first). Core PostgreSQL tests: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'` then `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon` (`cleanTest` is required to re-run them). Web: `pnpm web:test`, `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`, `pnpm medical-ai:native-text-gate`. Browser: `export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'` in addition to `GC_TEST_POSTGRES_URL`, then `pnpm foundation:e2e`.
- Branch: everything goes on `codex/wave7-reference-range-delta` (already checked out in this worktree, stacked on PR #10). Never push to `main`. The pre-existing uncommitted change to `apps/web/next-env.d.ts` is Next's own rewrite and is never staged.
- Boundary (spec §1): reference-range text is stored and exported only. It is absent from the candidate list, records, health-events and changes responses and from every screen — test: the serialized JSON of those four responses contains no key matching `reference` case-insensitively. No comparison, no judgement, no colour.
- Boundary (spec §1, §3): the difference is a number from subtraction/division only. No direction word (상승/하락/증가/감소/높/낮), arrow, colour or threshold anywhere. `apps/web/tests/korean-ux-copy.test.ts` forbidden-term list gains `상승`, `하락`, `증가`, `감소`.
- Next.js gains no API route, token or authorization rule. `release/readiness.json` unchanged. Synthetic data only. Audit rows carry no value and no date.
- Worker (spec §2): `ParsedCandidate.referenceRangeText: String?` — trimmed, at most 40 characters, label prefix ("참고치:", "기준치" …) and brackets stripped, range body only (`70-99`, `<200`, `≤5.6`, `4.0~6.0`, `120 - 199`); `null` when no range matched. Value and unit parsing results do not change (benchmark F1 = 1 stays).
- Boundary DTO (spec §2): `ExtractedCandidate.referenceRangeText: String?` with `@Size(max = 40)` and `@Pattern("^[0-9.,\\s\\-~–<>≤≥]{1,40}$")`; its doc comment says "reference-range text is carried verbatim and never interpreted" instead of "No reference range".
- Core V10 (spec §2): `V10__reference_range_text.sql` adds `gc_candidate.reference_range_text VARCHAR(40)` and `gc_health_record_version.reference_range_text VARCHAR(40)` with the same shape CHECK. Confirmation copies the candidate's value into the record version; correction inherits it into the new version and cannot change it (no request field). `FoundationCandidateRow` and `FoundationRecordRow` gain `referenceRangeText`; controller DTOs do **not**.
- Export (spec §2, §4): `schemaVersion` becomes `alm-health-events-export.v2`; `events[].referenceRangeText: String | null`; `documents` = the union of every COMPLETED document of the owner (with or without events) and every document that has events, sorted by `documentId` string; each item is `{documentId, observedOn?, status, abstentions, eventCount}`; `events[]` also carries `originalValue`, `correctionReason`, `originalObservedOn` (spec §6). Headers, filename and audit row are unchanged from Wave 2C.
- Benchmark (spec §2): `GoldMeasurement.expectedReferenceRangeText: String?` (the rendered range string for range-column variants, else null); runs carry `referenceRangeText`; `referenceRangeAccuracy` = share of matched fields whose reference-range text equals the gold; `native-text-gate` requires `1`. `corpusId` must stay `synthetic-ko-checkup-r2-e6befc286ae6ce1d` (PDF bytes unchanged); if it changes, the evidence document records the new digest.
- Delta (spec §3): `data class ChangeDelta(val absolute: String, val percent: String?)`, `ChangeItem.delta: ChangeDelta?`. Computed only when `previous` exists (same unit already guaranteed) and both values parse as `BigDecimal`; otherwise null. `absolute = latest − previous` at the larger scale of the two inputs, sign explicit (`"+12"`, `"-6"`, `"-0.3"`, `"0"`). `percent = absolute / previous × 100`, `HALF_EVEN` to one decimal, null when `previous == 0`, sign explicit (`"-3.1"`, `"+2.0"`, `"0.0"`). Thousands commas (`1,234`) are removed before parsing.
- Web (spec §3): the "최근 변화" item gets one line `두 값의 차이: -6 mg/dL (-3.1%)` — parentheses omitted when `percent` is null, no line when `delta` is null. zod `.strict()` gains `delta`. No colour, no icon.
- MedGemma (spec §5): `EXPERIMENT_PROTOCOL.options` gains `num_ctx: 8192` (protocol digest changes). Manual local run `pnpm medical-ai:medgemma-experiment` (not CI). Results go into `docs/status/2026-09-17/medgemma-local-experiment.md` as a section "Run 3 (num_ctx 8192)" and into the approval note `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md` as a third pins block: unreadable count, done_reason distribution, F1, hallucination, VRAM offload (`ollama ps`). Conclusion sentences are observations only — no cause claims.
- 내 데이터 (spec §6): `HealthEvent` gains `originalValue: String`, `correctionReason: String?`, `originalObservedOn: String?` (the V8 value, null when unchanged); the evidence drawer shows a "수정 이력" block (원래 값 · 이유 · 원래 검사일; "수정 없음" when nothing was corrected). `SourcePreview` actually uses its `page` prop (one test). jest-axe runs on the empty and the error state (two tests). A newly arrived cell plays one fade/scale animation (CSS), none under `prefers-reduced-motion: reduce` (test: the class is not applied).
- Exact user-facing copy introduced by this wave: `두 값의 차이:`; `수정 이력`; `수정 없음`; `원래 값`; `이유:`; `원래 검사일`; `값은 {page}쪽에 있어요. 미리보기는 결과지의 첫 페이지만 보여드려요.`. Korean only; no raw server enum.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Gates before finishing (Task 10): `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `pnpm web:test`, `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`, `pnpm --dir apps/web build`, `pnpm auth-security:gate`, `pnpm security:github-actions-policy`, `./gradlew.bat cleanTest test --no-daemon` with `GC_TEST_POSTGRES_URL`, `pnpm medical-ai:native-text-gate`, `pnpm foundation:e2e`.

---

## File map

| Path | Responsibility |
|---|---|
| `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt` (modify) | `ParsedCandidate.referenceRangeText`, `RowParse.Measurement.referenceRangeText`, `referenceRangeBody` extraction |
| `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/DocumentWorkerMain.kt` (modify) | sends `referenceRangeText` in the extraction-result body |
| `apps/document-worker/src/test/kotlin/.../NativeTextExtractionProviderTest.kt`, `BoundaryApiClientTest.kt` (modify) | worker unit tests |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/DocumentWorkerBoundary.kt` (modify) | `ExtractedCandidate.referenceRangeText` with `@Size`/`@Pattern` |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/MedicalConceptNormalizer.kt` (modify) | `NormalizedCandidate.referenceRangeText` pass-through |
| `apps/core-api/src/main/resources/db/migration/V10__reference_range_text.sql` (create) | two columns + shape CHECKs |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt` (modify) | rows, mappers, projections, insert on extraction, copy on confirm, inherit on correction |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/HealthEventProjection.kt` (modify) | `originalValue`, `correctionReason`, `originalObservedOn` on `HealthEvent` |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt` (modify) | `ExportedHealthEvent`, `ExportedDocument.eventCount`, export v2 |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeDelta.kt` (create) | `ChangeDelta`, `ChangeDeltaCalculator` |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjection.kt` (modify) | `ChangeItem.delta` |
| `apps/core-api/src/test/kotlin/.../{ChangeDeltaTest (create), ChangeSummaryProjectionTest, HealthEventProjectionTest, ExtractionResultRequestValidationTest, FoundationLifecyclePostgresIntegrationTest}.kt` | core tests |
| `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/{CheckupCorpusGenerator,CorpusWriter,NativeTextRunner}.kt` (modify) | `PlacedRow.referenceRangeText`, `GoldMeasurement.expectedReferenceRangeText`, `RunCandidate.referenceRangeText` |
| `packages/korean-checkup-benchmark/src/test/kotlin/.../{CheckupCorpusGeneratorTest,NativeTextRunnerTest}.kt` (modify) | benchmark tests |
| `apps/web/lib/medical-ai/{contracts,evaluation,native-text-report}.ts` (modify) | zod fields, `referenceRangeAccuracy` metric and threshold, report row |
| `apps/web/tests/{medical-document-evaluation,native-text-report}.test.ts` (modify) | evaluator tests |
| `apps/web/lib/foundation/client.ts` (modify) | zod: `delta`, `originalValue`, `correctionReason`, `originalObservedOn` |
| `apps/web/components/integrated/RecentChanges.tsx` (modify) | `두 값의 차이` line |
| `apps/web/components/integrated/SourcePreview.tsx` (modify) | uses `page` |
| `apps/web/components/my-data/{EvidenceDrawer,LivingCellCanvas,MyData}.tsx`, `MyData.module.css`, `apps/web/lib/my-data/reduced-motion.ts` (create) | 수정 이력 block, arrival animation, `newIds` |
| `apps/web/tests/{recent-changes,evidence-drawer,living-cell-canvas,my-data}.test.tsx`, `source-preview.test.tsx` (create), `foundation-client.test.ts`, `korean-ux-copy.test.ts`, `fixtures/foundation.ts`, `synthetic-document.test.ts` | web tests |
| `apps/web/lib/foundation/synthetic-document.ts`, `apps/web/e2e/foundation-lifecycle.spec.ts` (modify) | July fixture row with `120-199`; e2e assertions |
| `apps/web/lib/medical-ai/medgemma-experiment.ts`, `apps/web/scripts/medgemma-local-experiment.mts`, `apps/web/tests/medgemma-experiment.test.ts` (modify) | `num_ctx: 8192` |
| `docs/status/2026-09-17/medgemma-local-experiment.md`, `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md` (modify) | Run 3 evidence and pins |
| `docs/status/2026-09-17/wave3.md` (create); `AGENTS.md`, `PROJECT_GUIDE.md`, `docs/roadmap/2026-09-02-roadmap.md` (modify) | evidence and ledger |

---

### Task 1: Worker keeps `referenceRangeText`; boundary DTO accepts it verbatim

**Files:**
- Modify: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt:27-36,49-70,111-127,143-170`
- Modify: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/DocumentWorkerMain.kt:192-207`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/DocumentWorkerBoundary.kt:119-137`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/MedicalConceptNormalizer.kt:15-25,72-84`
- Test: `apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProviderTest.kt`
- Test: `apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/BoundaryApiClientTest.kt:57-102`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ExtractionResultRequestValidationTest.kt`

**Interfaces:**
- Consumes: `rangeText` regex (`NativeTextExtractionProvider.kt:67-70`), `RowParse.Measurement`, `ExtractedCandidate`, `NormalizedCandidate`.
- Produces: `ParsedCandidate.referenceRangeText: String? = null` (last constructor parameter, default null so positional callers keep compiling); `ExtractedCandidate.referenceRangeText: String? = null` (last parameter); `NormalizedCandidate.referenceRangeText: String? = null`. Task 2 stores `NormalizedCandidate.referenceRangeText`; Task 4 reads `ParsedCandidate.referenceRangeText`.

- [ ] **Step 1: Write the failing worker tests**

In `NativeTextExtractionProviderTest.kt` replace the test `keeps reference range text out of the value and hashes the trimmed source line` with:

```kotlin
    @Test
    fun `keeps reference range text out of the value and hashes the trimmed source line`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일 2026-07-28", "  Fasting Glucose 96 mg/dL 70-99 mg/dL  "),
        )

        val candidate = outcome.candidates.single()
        assertThat(candidate.value).isEqualTo("96")
        assertThat(candidate.unit).isEqualTo("mg/dL")
        assertThat(candidate.referenceRangeText).isEqualTo("70-99")
        assertThat(candidate.sourceTextSha256).isEqualTo(sha256("Fasting Glucose 96 mg/dL 70-99 mg/dL"))
    }

    @Test
    fun `preserves the reference range body without label brackets or unit and leaves it null when absent`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines(
                "검사일 2026-07-28",
                "총콜레스테롤 188 mg/dl 120-199",
                "백혈구 6,200 /uL (참고 4,000-10,000)",
                "· 당화혈색소 5.2 % (참고 4.0~5.6)",
                "요산 5.1 mg/dL 참고치: ≤7.0",
                "AST 22 U/L (15 - 35)",
                "LDL 콜레스테롤 110 mg/dL <130",
                "크레아티닌 0.9 mg/dL",
            ),
        )

        assertThat(outcome.abstentions).isEmpty()
        assertThat(outcome.candidates.map { it.value }).containsExactly("188", "6,200", "5.2", "5.1", "22", "110", "0.9")
        assertThat(outcome.candidates.map { it.unit }).containsExactly("mg/dl", "/uL", "%", "mg/dL", "U/L", "mg/dL", "mg/dL")
        assertThat(outcome.candidates.map { it.referenceRangeText })
            .containsExactly("120-199", "4,000-10,000", "4.0~5.6", "≤7.0", "15 - 35", "<130", null)
        assertThat(outcome.candidates.mapNotNull { it.referenceRangeText })
            .allMatch { Regex("^[0-9.,\\s\\-~–<>≤≥]{1,40}$").matches(it) }
    }
```

In `BoundaryApiClientTest.kt` change the `ParsedCandidate(...)` inside the test `extraction result carries the parsed candidates and abstentions beside the preview` to carry a range, and assert it is sent:

```kotlin
                    ParsedCandidate(1, "Cholesterol", "188", "mg/dL", LocalDate.of(2026, 7, 28), 1, TextBox(0.08, 0.1, 0.3, 0.02), "1".repeat(64), "120-199"),
```

and after `assertThat(candidate["sourceTextSha256"].asText()).isEqualTo("1".repeat(64))` add:

```kotlin
            assertThat(candidate["referenceRangeText"].asText()).isEqualTo("120-199")
```

(The existing `doesNotContain("referenceRange", "conceptCode")` compares whole field names and stays true.)

- [ ] **Step 2: Run the worker tests to verify they fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :apps:document-worker:test --no-daemon`
Expected: compilation error `Unresolved reference 'referenceRangeText'` / `Too many arguments for ParsedCandidate`.

- [ ] **Step 3: Implement in the worker**

In `NativeTextExtractionProvider.kt` replace `ParsedCandidate` (lines 27-36) with:

```kotlin
data class ParsedCandidate(
    val ordinal: Int,
    val label: String,
    val value: String,
    val unit: String,
    val observedOn: LocalDate,
    val evidencePage: Int,
    val evidenceBox: TextBox,
    val sourceTextSha256: String,
    /** The range body printed on the same row (`70-99`, `<200`, `≤5.6`), verbatim, or null. Never interpreted. */
    val referenceRangeText: String? = null,
)
```

Replace the last sentence of the object's doc comment (`Labels stay raw (core normalizes); reference-range text on a row is only excluded from the value.`) with:

```kotlin
 * Labels stay raw (core normalizes). Reference-range text on a row is excluded from the value and
 * carried verbatim as `referenceRangeText` (range body only, at most 40 characters) so the person's
 * own export can keep it; the worker never compares a value against it.
```

Add next to the other `private const val`s at the top of the object:

```kotlin
    private const val MAX_REFERENCE_RANGE = 40
```

After the `rangeText` regex (line 70) add:

```kotlin
    /** The range body inside a matched [rangeText]: optional comparison sign, number, optional separator and second number. */
    private val rangeBody = Regex("[<>≤≥]?\\s*\\d[\\d,]*(?:\\.\\d+)?(?:\\s*[-–~]\\s*\\d[\\d,]*(?:\\.\\d+)?)?")
```

Change `RowParse.Measurement` to:

```kotlin
        data class Measurement(val label: String, val value: String, val unit: String, val referenceRangeText: String?) : RowParse
```

Replace the end of `parseRow` (from `val rest = tokens.drop(valueIndex + 2)` to the closing `return RowParse.Measurement(label, value, unit)`) with:

```kotlin
        val rest = tokens.drop(valueIndex + 2)
        val restText = rest.joinToString(" ")
        val restIsRange = rest.isNotEmpty() && rangeText.matches(restText)
        if (rest.isNotEmpty() && !restIsRange && rest.any { valueToken.matches(it) }) {
            return RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE)
        }
        val referenceRangeText = if (restIsRange) rangeBody.find(restText)?.value?.trim()?.take(MAX_REFERENCE_RANGE) else null
        return RowParse.Measurement(label, value, unit, referenceRangeText)
```

In `parse`, in the `else -> candidates += ParsedCandidate(` block add after `sourceTextSha256 = sha256(line.text.trim()),`:

```kotlin
                        referenceRangeText = row.referenceRangeText,
```

In `DocumentWorkerMain.kt` inside the `"candidates" to outcome.candidates.map { candidate -> mapOf(` block add after `"sourceTextSha256" to candidate.sourceTextSha256,`:

```kotlin
                        "referenceRangeText" to candidate.referenceRangeText,
```

- [ ] **Step 4: Run the worker tests to verify they pass**

Run: `./gradlew.bat :apps:document-worker:test --no-daemon`
Expected: `BUILD SUCCESSFUL`; every `NativeTextExtractionProviderTest` and `BoundaryApiClientTest` test passes (existing parsing tests unchanged).

- [ ] **Step 5: Write the failing boundary validation test**

In `ExtractionResultRequestValidationTest.kt` add to `candidate(...)` a last parameter `referenceRangeText: String? = null` and pass it as the last constructor argument:

```kotlin
    private fun candidate(
        ordinal: Int = 1,
        label: String = "Cholesterol",
        value: String = "188",
        unit: String = "mg/dL",
        observedOn: String = "2026-07-28",
        evidencePage: Int = 1,
        evidenceBox: EvidenceBox? = EvidenceBox(0.08, 0.1, 0.3, 0.02),
        sourceTextSha256: String = "1".repeat(64),
        referenceRangeText: String? = null,
    ) = ExtractedCandidate(ordinal, label, value, unit, observedOn, evidencePage, evidenceBox, sourceTextSha256, referenceRangeText)
```

Add the test:

```kotlin
    @Test
    fun carriesReferenceRangeTextVerbatimWithinItsShapeAndNeverInterpretsIt() {
        for (accepted in listOf(null, "70-99", "120 - 199", "<200", "≤5.6", "4.0~6.0", "70–99", "4,000-10,000")) {
            assertThat(validator.validate(request(candidates = listOf(candidate(referenceRangeText = accepted)))))
                .describedAs(accepted.toString()).isEmpty()
        }
        for (rejected in listOf("", "참고 70-99", "70-99 mg/dL", "1".repeat(41), "normal", "high")) {
            assertThat(validator.validate(request(candidates = listOf(candidate(referenceRangeText = rejected)))))
                .describedAs(rejected).isNotEmpty()
        }
        assertThat(candidate().referenceRangeText).isNull()
    }
```

- [ ] **Step 6: Run it to verify it fails**

Run: `./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.ExtractionResultRequestValidationTest"`
Expected: compilation error `Too many arguments for ExtractedCandidate`.

- [ ] **Step 7: Extend the DTO and the normalizer**

In `DocumentWorkerBoundary.kt` replace the `ExtractedCandidate` declaration (lines 119-137) with:

```kotlin
/**
 * One row the worker read from the text layer. Raw label and unit; core normalizes. The
 * reference-range text is carried verbatim and never interpreted: it is stored and exported only.
 */
data class ExtractedCandidate(
    @field:Min(1) @field:Max(100)
    val ordinal: Int,
    @field:Size(min = 1, max = 80)
    val label: String,
    @field:Pattern(regexp = "^-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$") @field:Size(max = 64)
    val value: String,
    @field:Size(min = 1, max = 32)
    val unit: String,
    @field:Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$")
    val observedOn: String,
    @field:Min(1) @field:Max(20)
    val evidencePage: Int,
    @field:Valid
    val evidenceBox: EvidenceBox?,
    @field:Pattern(regexp = "^[0-9a-f]{64}$")
    val sourceTextSha256: String,
    @field:Size(max = 40) @field:Pattern(regexp = "^[0-9.,\\s\\-~–<>≤≥]{1,40}$")
    val referenceRangeText: String? = null,
)
```

In `MedicalConceptNormalizer.kt` add to `NormalizedCandidate` after `val conceptCode: String?,`:

```kotlin
    /** Verbatim from the worker; stored on the candidate and copied to the record version, never shown or compared. */
    val referenceRangeText: String? = null,
```

and in `normalize(...)` after `conceptCode = concept?.conceptCode,` add:

```kotlin
            referenceRangeText = candidate.referenceRangeText,
```

- [ ] **Step 8: Run the validation and normalizer tests**

Run: `./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.ExtractionResultRequestValidationTest" --tests "kr.co.genomecompanion.foundation.MedicalConceptNormalizerTest"`
Expected: `BUILD SUCCESSFUL`, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/document-worker/src apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/DocumentWorkerBoundary.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/MedicalConceptNormalizer.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ExtractionResultRequestValidationTest.kt
git commit -m "feat(worker): carry the row's reference-range text verbatim as referenceRangeText

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 2: Core — V10, repository rows, copy on confirmation, inherit on correction, no `reference` key in any response

**Files:**
- Create: `apps/core-api/src/main/resources/db/migration/V10__reference_range_text.sql`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt:84-101,112-132,180-230,233-266,977-1002,1252-1281,1332-1366`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `NormalizedCandidate.referenceRangeText` (Task 1); `gc_candidate`, `gc_health_record_version` (V1/V4/V7).
- Produces: `FoundationCandidateRow.referenceRangeText: String? = null` and `FoundationRecordRow.referenceRangeText: String? = null` (both last parameters with defaults so the projection-test constructors keep compiling); repository `markExtractionCompleted` stores it, `createRecordFromCandidate` copies it into the record version, `correctRecord` inherits it. Task 3 reads `FoundationRecordRow.referenceRangeText` for the export. `CandidateReceipt`, `RecordReceipt`, `HealthEvent`, `ChangeSummary` do **not** gain the field.

- [ ] **Step 1: Write the failing PostgreSQL test**

Insert into `FoundationLifecyclePostgresIntegrationTest.kt` immediately before `private fun importSyntheticDocument(`:

```kotlin
    @Test
    fun storesTheReferenceRangeTextCopiesItToTheRecordVersionAndKeepsItOutOfEveryResponse() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "reference-range-request")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = listOf(
                ExtractedCandidate(1, "Cholesterol", "188", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64), "120-199"),
                ExtractedCandidate(2, "HbA1c", "5.2", "%", "2026-07-28", 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64), null),
            ),
        )
        assertThat(
            jdbc.queryForList("SELECT reference_range_text FROM gc_candidate ORDER BY ordinal", String::class.java),
        ).containsExactly("120-199", null)

        val candidatesResponse = read(get("/api/foundation/documents/$documentId/candidates"), alice)
            .andExpect(status().isOk).andReturn().response.contentAsString
        assertThat(candidatesResponse.lowercase()).doesNotContain("reference")
        val candidates = responseJson(candidatesResponse.toByteArray()).toList()

        // A confirm-time correction of the value keeps the document's own range text unchanged.
        mutate(
            post("/api/foundation/candidates/${candidates[0]["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", "reference-range-confirm-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "190"))),
            alice,
        ).andExpect(status().isCreated)
        mutate(
            post("/api/foundation/candidates/${candidates[1]["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", "reference-range-confirm-2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "5.2"))),
            alice,
        ).andExpect(status().isCreated)
        assertThat(
            jdbc.queryForList(
                """
                SELECT v.reference_range_text FROM gc_health_record_version v
                JOIN gc_health_record r ON r.record_id = v.record_id
                JOIN gc_candidate c ON c.candidate_id = r.candidate_id
                WHERE v.status = 'CURRENT' ORDER BY c.ordinal
                """.trimIndent(),
                String::class.java,
            ),
        ).containsExactly("120-199", null)

        val records = responseJson(
            read(get("/api/foundation/records"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).toList()
        val correctedRecordId = records.single { it["label"].asText() == "총콜레스테롤" }["recordId"].asText()

        // Correction inherits the range text; a client cannot change it because no request field exists.
        mutate(
            post("/api/foundation/records/$correctedRecordId/corrections")
                .header("Idempotency-Key", "reference-range-correction-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "191", "reason" to "합성 원문 재확인", "referenceRangeText" to "1-2"))),
            alice,
        ).andExpect(status().isCreated)
        assertThat(
            jdbc.queryForList(
                "SELECT reference_range_text FROM gc_health_record_version WHERE record_id = ?::uuid ORDER BY changed_at",
                String::class.java,
                correctedRecordId,
            ),
        ).containsExactly("120-199", "120-199")

        for (path in listOf("/api/foundation/records", "/api/foundation/health-events", "/api/foundation/changes", "/api/foundation/records/$correctedRecordId")) {
            val body = read(get(path), alice).andExpect(status().isOk).andReturn().response.contentAsString
            assertThat(body.lowercase()).describedAs(path).doesNotContain("reference")
        }
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event WHERE event_type LIKE '%120%' OR resource_type LIKE '%199%'", Long::class.java),
        ).isZero()
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest"`
Expected: `storesTheReferenceRangeTextCopiesItToTheRecordVersionAndKeepsItOutOfEveryResponse() FAILED` with `BadSqlGrammarException` (`column "reference_range_text" does not exist`).

- [ ] **Step 3: Write V10**

Create `apps/core-api/src/main/resources/db/migration/V10__reference_range_text.sql`:

```sql
-- Wave 3 (a): the reference-range text printed on a result-sheet row is kept verbatim so the person's
-- own export can carry it (governance/intended-use-decision-reference-range-and-delta-2026-09-17.md).
-- Range body only: digits, separators and comparison signs, at most 40 characters. It is never
-- returned by the candidate, records, health-events or changes APIs, never displayed, never compared
-- against a value and never used to derive a state. Confirmation copies it to the record version;
-- a correction inherits it and cannot change it.
ALTER TABLE gc_candidate
    ADD COLUMN reference_range_text VARCHAR(40),
    ADD CONSTRAINT gc_candidate_reference_range_shape CHECK (
        reference_range_text IS NULL OR reference_range_text ~ '^[0-9.,[:space:]~<>≤≥–-]{1,40}$'
    );

ALTER TABLE gc_health_record_version
    ADD COLUMN reference_range_text VARCHAR(40),
    ADD CONSTRAINT gc_health_record_version_reference_range_shape CHECK (
        reference_range_text IS NULL OR reference_range_text ~ '^[0-9.,[:space:]~<>≤≥–-]{1,40}$'
    );
```

- [ ] **Step 4: Update the repository**

In `FoundationRepository.kt` add as the last parameter of `FoundationCandidateRow` (after `val createdAt: Instant,`):

```kotlin
    /** Verbatim document text; never returned by an API other than the export. */
    val referenceRangeText: String? = null,
```

and as the last parameter of `FoundationRecordRow` (after `val conceptCode: String?,`):

```kotlin
    /** Copied from the candidate at confirmation, inherited by every correction. Export only. */
    val referenceRangeText: String? = null,
```

In `candidateMapper` add after `createdAt = ...,`:

```kotlin
            referenceRangeText = result.getString("reference_range_text"),
```

In `recordMapper` add after `conceptCode = result.getString("concept_code"),`:

```kotlin
            referenceRangeText = result.getString("reference_range_text"),
```

In `candidateProjection` change the line `c.observed_on, c.evidence_page, c.source_text_sha256, c.concept_code,` to:

```kotlin
               c.observed_on, c.evidence_page, c.source_text_sha256, c.concept_code, c.reference_range_text,
```

In `recordProjection` change the line `c.evidence_page, c.source_text_sha256, d.sha256 AS document_sha256, v.concept_code` to:

```kotlin
               c.evidence_page, c.source_text_sha256, d.sha256 AS document_sha256, v.concept_code, v.reference_range_text
```

In `markExtractionCompleted` replace the candidate INSERT statement and its parameters with:

```kotlin
            jdbc.update(
                """
                INSERT INTO gc_candidate(
                    candidate_id, job_id, document_id, subject_id, status, ordinal, label, candidate_value,
                    unit, observed_on, evidence_page, source_text_sha256, created_at, extraction_method,
                    evidence_box_x, evidence_box_y, evidence_box_w, evidence_box_h, concept_code, reference_range_text
                ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, 'native-text', ?, ?, ?, ?, ?, ?)
                """.trimIndent(),
                UUID.randomUUID(),
                extractionJobId,
                workerJob.documentId,
                workerJob.subjectId,
                candidate.ordinal,
                candidate.label,
                candidate.value,
                candidate.unit,
                candidate.observedOn,
                candidate.evidencePage,
                candidate.sourceTextSha256,
                now.atOffset(ZoneOffset.UTC),
                candidate.evidenceBox?.x,
                candidate.evidenceBox?.y,
                candidate.evidenceBox?.width,
                candidate.evidenceBox?.height,
                candidate.conceptCode,
                candidate.referenceRangeText,
            )
```

In `createRecordFromCandidate` replace the `gc_health_record_version` INSERT with:

```kotlin
        jdbc.update(
            """
            INSERT INTO gc_health_record_version(
                version_id, record_id, subject_id, status, value,
                supersedes_version_id, correction_reason, changed_at, concept_code, reference_range_text
            ) VALUES (?, ?, ?, 'CURRENT', ?, NULL, NULL, ?, ?, ?)
            """.trimIndent(),
            versionId,
            recordId,
            candidate.subjectId,
            confirmedValue,
            now.atOffset(ZoneOffset.UTC),
            candidate.conceptCode,
            candidate.referenceRangeText,
        )
```

In `correctRecord` replace the INSERT with:

```kotlin
        jdbc.update(
            """
            INSERT INTO gc_health_record_version(
                version_id, record_id, subject_id, status, value,
                supersedes_version_id, correction_reason, changed_at, concept_code, reference_range_text
            ) VALUES (?, ?, ?, 'CURRENT', ?, ?, ?, ?,
                (SELECT concept_code FROM gc_health_record_version WHERE version_id = ?),
                (SELECT reference_range_text FROM gc_health_record_version WHERE version_id = ?))
            """.trimIndent(),
            newVersionId,
            recordId,
            subjectId,
            value,
            previousVersionId,
            reason,
            now.atOffset(ZoneOffset.UTC),
            previousVersionId,
            previousVersionId,
        )
```

Do not touch `FoundationLifecycleService.candidateReceipt`/`recordReceipt`, `HealthEventProjection` or `ChangeSummaryProjection` in this task: the rows carry the field, the receipts do not.

- [ ] **Step 5: Run the core suite to verify it passes**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon` (with `GC_TEST_POSTGRES_URL` exported)
Expected: `BUILD SUCCESSFUL`; the new test and every existing test pass (Flyway applies V10 on the truncated synthetic database).

- [ ] **Step 6: Commit**

```bash
git add apps/core-api/src/main/resources/db/migration/V10__reference_range_text.sql apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt
git commit -m "feat(core-api): V10 reference_range_text on candidate and record version, copied on confirm, inherited on correction, absent from every response

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 3: Core — export v2 (`referenceRangeText`, every COMPLETED document with `eventCount`) and `HealthEvent` correction fields

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/HealthEventProjection.kt:20-33,40-67`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt:119-135,601-626`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/HealthEventProjectionTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt` (the existing `exportsTheOwnersHealthEventsAsAJsonAttachmentWithoutRangesAndAuditsNoValue` plus one new test)

**Interfaces:**
- Consumes: `FoundationRecordRow.referenceRangeText`, `originalValue`, `correctionReason`, `originalObservedOn` (Task 2 / V8); `repository.listDocumentCompletions(subjectId)` (`FoundationRepository.kt:1182-1197`), `repository.findExtractionAbstentions`, `requireDocument`.
- Produces: `HealthEvent` gains `originalValue: String`, `correctionReason: String?`, `originalObservedOn: String?` (serialized under Jackson `non_null`, so the two nullable ones are omitted when null); `data class ExportedHealthEvent(@get:JsonUnwrapped val event: HealthEvent, val referenceRangeText: String?)` (flattened JSON: every HealthEvent key plus `referenceRangeText`); `ExportedDocument(documentId, observedOn, status, abstentions, eventCount: Int)`; `HealthEventExport.schemaVersion = "alm-health-events-export.v2"`, `events: List<ExportedHealthEvent>`. Task 7 mirrors the three HealthEvent fields in zod; Task 8 asserts the export shape in the browser.

- [ ] **Step 1: Write the failing projection test**

In `HealthEventProjectionTest.kt` add a parameter `originalObservedOn: LocalDate? = null` to `row(...)` (after `observedOn`) and pass `originalObservedOn = originalObservedOn` to the `FoundationRecordRow(...)` constructor (after `observedOn = observedOn,`). Then replace the test `marksCorrectedValuesAndKeepsBothVerifiedWhenPreviewExists` with:

```kotlin
    @Test
    fun marksCorrectedValuesAndKeepsBothVerifiedWhenPreviewExists() {
        val corrected = row("당화혈색소", "5.3", original = "5.2", observedOn = LocalDate.of(2026, 7, 28))

        val event = HealthEventProjection.project(listOf(corrected), setOf(docWithPreview)).single()

        assertThat(event.corrected).isTrue()
        assertThat(event.verification).isEqualTo("verified")
        assertThat(event.value).isEqualTo("5.3")
        assertThat(event.originalValue).isEqualTo("5.2")
        assertThat(event.correctionReason).isEqualTo("원문 재확인")
        assertThat(event.originalObservedOn).isNull()
        assertThat(event.source.previewAvailable).isTrue()
        assertThat(event.source.page).isEqualTo(1)
    }

    @Test
    fun carriesTheParserDateOnlyWhenTheExamDateWasCorrected() {
        val dateCorrected = row("당화혈색소", "5.2", observedOn = LocalDate.of(2026, 7, 27), originalObservedOn = LocalDate.of(2026, 7, 28))
        val untouched = row("총콜레스테롤", "188", observedOn = LocalDate.of(2026, 7, 28))

        val events = HealthEventProjection.project(listOf(dateCorrected, untouched), setOf(docWithPreview))

        val corrected = events.single { it.concept == "당화혈색소" }
        assertThat(corrected.corrected).isTrue()
        assertThat(corrected.originalObservedOn).isEqualTo("2026-07-28")
        assertThat(corrected.originalValue).isEqualTo("5.2")
        assertThat(corrected.correctionReason).isNull()
        val plain = events.single { it.concept == "총콜레스테롤" }
        assertThat(plain.corrected).isFalse()
        assertThat(plain.originalValue).isEqualTo("188")
        assertThat(plain.originalObservedOn).isNull()
        assertThat(plain.correctionReason).isNull()
        assertThat(HealthEvent::class.java.declaredFields.map { it.name }).doesNotContain("referenceRangeText", "referenceRange")
    }
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.HealthEventProjectionTest"`
Expected: compilation error `Unresolved reference 'originalValue'`.

- [ ] **Step 3: Extend `HealthEvent`**

In `HealthEventProjection.kt` replace the `HealthEvent` data class with:

```kotlin
/**
 * One confirmed value as one event. This is a read-model over CURRENT record
 * versions: no reference range, no direction, no judgement; `conceptCode` is
 * a dictionary key, not a meaning. `originalValue`/`correctionReason`/`originalObservedOn`
 * are the person's own correction history (the parser's value and date), nothing derived.
 */
data class HealthEvent(
    val eventId: UUID,
    val recordId: UUID,
    val domain: String,
    val concept: String,
    val conceptCode: String?,
    val value: String,
    val unit: String,
    val observedOn: String,
    val verification: String,
    val corrected: Boolean,
    val confirmedAt: Instant,
    val originalValue: String,
    val correctionReason: String?,
    /** The parser's exam date when the person corrected it on review (V8); null when unchanged. */
    val originalObservedOn: String?,
    val source: HealthEventSource,
)
```

and in `project(...)` add after `confirmedAt = record.confirmedAt,`:

```kotlin
                    originalValue = record.originalValue,
                    correctionReason = record.correctionReason,
                    originalObservedOn = record.originalObservedOn?.toString(),
```

- [ ] **Step 4: Run the projection tests**

Run: `./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.HealthEventProjectionTest"`
Expected: `BUILD SUCCESSFUL`, 6 tests pass.

- [ ] **Step 5: Write the failing export integration test**

In `FoundationLifecyclePostgresIntegrationTest.kt` change every `"alm-health-events-export.v1"` in `exportsTheOwnersHealthEventsAsAJsonAttachmentWithoutRangesAndAuditsNoValue` to `"alm-health-events-export.v2"`, and add `.andExpect(jsonPath("$.documents[0].eventCount").value(3))` right after `.andExpect(jsonPath("$.documents[0].abstentions.length()").value(0))`. Then insert immediately before `private fun importSyntheticDocument(`:

```kotlin
    @Test
    fun exportV2CarriesTheReferenceRangeTextTheCorrectionHistoryAndEveryCompletedDocument() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)

        // Document 1: one candidate with a printed range; its value is corrected at confirmation.
        val rangedDocument = requestDocument(alice, consentId, fixturePdf, "export-v2-ranged")
        uploadDocument(alice, rangedDocument, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$rangedDocument/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            rangedDocument,
            candidates = listOf(
                ExtractedCandidate(1, "Cholesterol", "188", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64), "120-199"),
            ),
        )
        val ranged = responseJson(
            read(get("/api/foundation/documents/$rangedDocument/candidates"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).single()
        mutate(
            post("/api/foundation/candidates/${ranged["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", "export-v2-confirm-ranged")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "190", "observedOn" to "2026-07-27"))),
            alice,
        ).andExpect(status().isCreated)

        // Document 2: every candidate excluded — COMPLETED with zero events.
        val excludedDocument = requestDocument(alice, consentId, januaryFixturePdf, "export-v2-excluded")
        uploadDocument(alice, excludedDocument, januaryFixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$excludedDocument/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(excludedDocument, sourceSha256 = januaryFixtureDigest, candidates = januaryCandidates)
        responseJson(
            read(get("/api/foundation/documents/$excludedDocument/candidates"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).forEach { candidate ->
            mutate(post("/api/foundation/candidates/${candidate["candidateId"].asText()}/exclusion"), alice).andExpect(status().isOk)
        }
        assertThat(documentStatus(excludedDocument)).isEqualTo("COMPLETED")

        val export = responseJson(
            read(get("/api/foundation/health-events/export"), alice)
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.schemaVersion").value("alm-health-events-export.v2"))
                .andExpect(jsonPath("$.events.length()").value(1))
                .andExpect(jsonPath("$.documents.length()").value(2))
                .andReturn().response.contentAsByteArray,
        )
        val event = export["events"].single()
        assertThat(event["value"].asText()).isEqualTo("190")
        assertThat(event["originalValue"].asText()).isEqualTo("188")
        assertThat(event["observedOn"].asText()).isEqualTo("2026-07-27")
        assertThat(event["originalObservedOn"].asText()).isEqualTo("2026-07-28")
        assertThat(event["corrected"].asBoolean()).isTrue()
        assertThat(event.has("correctionReason")).isFalse()
        assertThat(event["referenceRangeText"].asText()).isEqualTo("120-199")
        assertThat(event["source"]["documentId"].asText()).isEqualTo(rangedDocument.toString())
        val documents = export["documents"].associateBy { it["documentId"].asText() }
        assertThat(documents.keys).containsExactlyElementsOf(listOf(rangedDocument, excludedDocument).map { it.toString() }.sorted())
        assertThat(export["documents"].map { it["documentId"].asText() }).isSorted()
        assertThat(documents.getValue(rangedDocument.toString())["eventCount"].asInt()).isEqualTo(1)
        assertThat(documents.getValue(rangedDocument.toString())["observedOn"].asText()).isEqualTo("2026-07-27")
        assertThat(documents.getValue(excludedDocument.toString())["eventCount"].asInt()).isZero()
        assertThat(documents.getValue(excludedDocument.toString())["status"].asText()).isEqualTo("COMPLETED")
        assertThat(documents.getValue(excludedDocument.toString()).has("observedOn")).isFalse()

        // The same record is served to the product without the range.
        val healthEvents = read(get("/api/foundation/health-events"), alice).andExpect(status().isOk).andReturn().response.contentAsString
        assertThat(healthEvents.lowercase()).doesNotContain("reference")
        assertThat(responseJson(healthEvents.toByteArray()).single()["originalValue"].asText()).isEqualTo("188")
    }
```

- [ ] **Step 6: Run the two export tests to verify they fail**

Run: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest"`
Expected: both export tests FAIL on `$.schemaVersion` (`alm-health-events-export.v1` ≠ `v2`).

- [ ] **Step 7: Implement export v2**

In `FoundationLifecycleService.kt` add `import com.fasterxml.jackson.annotation.JsonUnwrapped` and replace `ExportedDocument` and `HealthEventExport` (lines 119-135) with:

```kotlin
/** One source document of the export: id, exam date when all its events share one, status, abstentions, event count. */
data class ExportedDocument(
    val documentId: UUID,
    val observedOn: String?,
    val status: String,
    val abstentions: List<ExtractionAbstention>,
    val eventCount: Int,
)

/**
 * A HealthEvent plus the document's own reference-range text. The text appears only here, in the
 * person's own file, exactly as printed; it is never displayed, compared or interpreted.
 */
data class ExportedHealthEvent(
    @get:JsonUnwrapped val event: HealthEvent,
    val referenceRangeText: String?,
)

/** The person's own events as one file. Same read-model as GET /health-events plus the verbatim range text. */
data class HealthEventExport(
    val schemaVersion: String = "alm-health-events-export.v2",
    val exportedAt: Instant,
    val subjectKind: String = "synthetic",
    val events: List<ExportedHealthEvent>,
    val documents: List<ExportedDocument>,
)
```

Replace `exportHealthEvents` with:

```kotlin
    @Transactional
    fun exportHealthEvents(principal: FoundationPrincipal): HealthEventExportEnvelope {
        val now = Instant.now(clock)
        val records = repository.listRecords(principal.subjectId)
        val rangeByVersion = records.associate { it.recordVersionId to it.referenceRangeText }
        val events = HealthEventProjection.project(records, repository.listDocumentIdsWithPreview(principal.subjectId))
            .map { ExportedHealthEvent(event = it, referenceRangeText = rangeByVersion[it.eventId]) }
        // Every COMPLETED document (even one whose candidates were all excluded) plus every document
        // that has events, once each, sorted by id text so the file is the same on every call.
        val documentIds = (
            repository.listDocumentCompletions(principal.subjectId).map { it.documentId } +
                events.map { it.event.source.documentId }
            ).distinct().sortedBy { it.toString() }
        val documents = documentIds.map { documentId ->
            val document = requireDocument(principal, documentId)
            val own = events.filter { it.event.source.documentId == documentId }
            ExportedDocument(
                documentId = documentId,
                observedOn = own.map { it.event.observedOn }.distinct().singleOrNull(),
                status = document.status,
                abstentions = repository.findExtractionAbstentions(principal.subjectId, documentId),
                eventCount = own.size,
            )
        }
        // The audit row says that an export happened. It carries no count, no value and no date.
        audit(principal, "HEALTH_EVENTS_EXPORTED", "EXPORT", null, "SUCCESS")
        val filename = "alm-health-events-${LocalDate.ofInstant(now, seoul).format(DateTimeFormatter.BASIC_ISO_DATE)}.json"
        return HealthEventExportEnvelope(
            filename = filename,
            export = HealthEventExport(exportedAt = now, events = events, documents = documents),
        )
    }
```

The controller (`exportHealthEvents`, `ResponseEntity<HealthEventExport>`) does not change.

- [ ] **Step 8: Run the core suite to verify it passes**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon` (with `GC_TEST_POSTGRES_URL`)
Expected: `BUILD SUCCESSFUL`. If `@get:JsonUnwrapped` were not honoured the new test would fail at `event["value"]` (nested under `event`); in that case replace `@get:JsonUnwrapped` with `@field:JsonUnwrapped @get:JsonUnwrapped` — do not fall back to nesting.

- [ ] **Step 9: Commit**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/HealthEventProjection.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/HealthEventProjectionTest.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt
git commit -m "feat(core-api): export v2 with verbatim referenceRangeText, every COMPLETED document with eventCount, and correction history on HealthEvent

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 4: Benchmark — gold `expectedReferenceRangeText`, run `referenceRangeText`, `referenceRangeAccuracy` gate

**Files:**
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/CheckupCorpusGenerator.kt:73-81,191-220`
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/CorpusWriter.kt:25-33,82-101`
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/NativeTextRunner.kt:28-37,103-115`
- Modify: `apps/web/lib/medical-ai/contracts.ts:22-34`
- Modify: `apps/web/lib/medical-ai/evaluation.ts:8-49,100-180`
- Modify: `apps/web/lib/medical-ai/native-text-report.ts`
- Test: `packages/korean-checkup-benchmark/src/test/kotlin/kr/co/genomecompanion/benchmark/{CheckupCorpusGeneratorTest,NativeTextRunnerTest}.kt`
- Test: `apps/web/tests/{medical-document-evaluation,native-text-report}.test.ts`

**Interfaces:**
- Consumes: `ParsedCandidate.referenceRangeText` (Task 1); private `rangeText(spec, variant)` in the generator (`CheckupCorpusGenerator.kt:236-239`).
- Produces: `PlacedRow.referenceRangeText: String?`; `GoldMeasurement.expectedReferenceRangeText: String? = null` (JSON key `expectedReferenceRangeText`, omitted when null); `RunCandidate.referenceRangeText: String? = null`; zod `extractedMeasurementSchema.referenceRangeText?`, `expectedMeasurementSchema.expectedReferenceRangeText?`; `MedicalDocumentGateThresholds.referenceRangeAccuracy = 1`; metric `metrics.referenceRangeAccuracy`; failure code `reference_range_accuracy_below_threshold`. Task 9's MedGemma runs still validate (the field is optional).

- [ ] **Step 1: Write the failing Kotlin benchmark tests**

In `CheckupCorpusGeneratorTest.kt`, inside the `gold.expectedMeasurements.zip(outcome.candidates).forEach { (expected, actual) ->` loop, add after the IoU assertion:

```kotlin
                assertThat(actual.referenceRangeText)
                    .describedAs("${gold.documentId} ${expected.label} reference range")
                    .isEqualTo(expected.expectedReferenceRangeText)
```

and after the loop over `corpus.documents.zip(documents)` add:

```kotlin
        val rangedGold = corpus.documents.flatMap { it.expectedMeasurements }.filter { it.expectedReferenceRangeText != null }
        assertThat(rangedGold).isNotEmpty()
        assertThat(rangedGold.map { it.expectedReferenceRangeText!! }).allMatch { Regex("^[0-9.,\\s\\-~–<>≤≥]{1,40}$").matches(it) }
        assertThat(corpus.documents.first { it.documentId == "synthetic-nhis-table-v0" }.expectedMeasurements.map { it.expectedReferenceRangeText })
            .containsOnlyNulls()
```

In `NativeTextRunnerTest.kt` add before `val json = BenchmarkJson.mapper.writeValueAsString(run)`:

```kotlin
        val ranged = runs.first { it.documentId == "synthetic-nhis-table-v1" }
        assertThat(ranged.candidates.map { it.referenceRangeText }).containsExactly(
            "150-199", "70-129", "45-70", "60-149", "80-99", "4.8-5.6", "12.5-15.5", "0.60-1.10",
        )
        assertThat(runs.first { it.documentId == "synthetic-center-summary-v5" }.candidates.map { it.referenceRangeText })
            .contains("155.0~180.0")
        assertThat(BenchmarkJson.mapper.writeValueAsString(ranged)).contains("\"referenceRangeText\":\"150-199\"")
        assertThat(run.candidates.map { it.referenceRangeText }).containsOnlyNulls()
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :packages:korean-checkup-benchmark:test --no-daemon`
Expected: compilation error `Unresolved reference 'expectedReferenceRangeText'` / `'referenceRangeText'`.

- [ ] **Step 3: Implement in the benchmark package**

In `CheckupCorpusGenerator.kt` replace `PlacedRow` with:

```kotlin
data class PlacedRow(
    val spec: RowSpec,
    val label: String,
    val value: String,
    val unit: String,
    val page: Int,
    val text: String,
    val box: Box,
    /** The 참고치 column text exactly as rendered, or null when the variant prints none. Corpus text only. */
    val referenceRangeText: String?,
)
```

In `tableRow` replace the `return PlacedRow(...)` line with:

```kotlin
        val range = if (variant.rangeColumn) rangeText(spec, variant) else null
        return PlacedRow(spec, label, value, unit, canvas.pageNumber, columns.joinToString(" ") { it.second }, box, range)
```

In `twoColumnRow` replace the `return PlacedRow(...)` line with:

```kotlin
        return PlacedRow(spec, label, value, unit, canvas.pageNumber, "$label $result", box, if (variant.rangeColumn) rangeText(spec, variant) else null)
```

In `summaryRow` replace the `return PlacedRow(...)` line with:

```kotlin
        return PlacedRow(spec, label, value, unit, canvas.pageNumber, text, box, if (variant.rangeColumn) rangeText(spec, variant) else null)
```

In `CorpusWriter.kt` replace `GoldMeasurement` with:

```kotlin
data class GoldMeasurement(
    val fieldId: String,
    val label: String,
    val value: String,
    val unit: String,
    val observedAt: String,
    val evidence: GoldEvidence,
    val semanticRole: String = "measurement",
    /** The rendered 참고치 text the parser must carry verbatim; null when the variant prints none. Never a clinical range. */
    val expectedReferenceRangeText: String? = null,
)
```

and in `gold(...)` add after the `evidence = GoldEvidence(...)` argument:

```kotlin
                    expectedReferenceRangeText = row.referenceRangeText,
```

Update the doc comment on `CorpusWriter` from `No reference range is written.` to `The rendered 참고치 text is written as expectedReferenceRangeText (corpus text, never a clinical range).`

In `NativeTextRunner.kt` replace `RunCandidate` with:

```kotlin
data class RunCandidate(
    val fieldId: String,
    val label: String,
    val value: String,
    val unit: String,
    val observedAt: String,
    val evidence: RunEvidence,
    val semanticRole: String = "measurement",
    val confidence: Double = 1.0,
    val referenceRangeText: String? = null,
)
```

and in `toCandidate` add after the `evidence = RunEvidence(...)` argument:

```kotlin
        referenceRangeText = candidate.referenceRangeText,
```

- [ ] **Step 4: Run the benchmark tests to verify they pass**

Run: `./gradlew.bat :packages:korean-checkup-benchmark:test --no-daemon`
Expected: `BUILD SUCCESSFUL`; `writes byte-identical PDFs and the same corpus id across two generations` still passes (PDF bytes unchanged).

- [ ] **Step 5: Write the failing evaluator tests**

In `apps/web/tests/medical-document-evaluation.test.ts` append:

```ts
it("scores reference-range text carried verbatim and fails the gate when it drifts", () => {
  const baseline = evaluateMedicalDocumentPipeline(corpus, referenceRuns);
  expect(baseline.metrics.referenceRangeAccuracy).toBe(1);
  expect(baseline.gate.thresholds.referenceRangeAccuracy).toBe(1);

  const goldWithRange = structuredClone(corpus) as unknown as { documents: Array<{ documentId: string; expectedMeasurements: Array<Record<string, unknown>> }> };
  const runsWithRange = structuredClone(referenceRuns) as unknown as Array<{ documentId: string; candidates: Array<Record<string, unknown>> }>;
  const firstRun = runsWithRange[0];
  const firstCandidate = firstRun.candidates[0];
  const goldDocument = goldWithRange.documents.find((document) => document.documentId === firstRun.documentId)!;
  const goldField = goldDocument.expectedMeasurements.find((field) => field.fieldId === firstCandidate.fieldId)!;
  goldField.expectedReferenceRangeText = "70-99";
  firstCandidate.referenceRangeText = "70-99";
  const matching = evaluateMedicalDocumentPipeline(goldWithRange, runsWithRange);
  expect(matching.metrics.referenceRangeAccuracy).toBe(1);
  expect(matching.metrics.fieldF1).toBe(1);
  expect(matching.gate.passed).toBe(true);

  firstCandidate.referenceRangeText = "70-100";
  const drifted = evaluateMedicalDocumentPipeline(goldWithRange, runsWithRange);
  expect(drifted.metrics.referenceRangeAccuracy).toBeLessThan(1);
  expect(drifted.metrics.fieldF1).toBe(1);
  expect(drifted.gate.passed).toBe(false);
  expect(drifted.gate.failures).toEqual(["reference_range_accuracy_below_threshold"]);

  delete firstCandidate.referenceRangeText;
  const missing = evaluateMedicalDocumentPipeline(goldWithRange, runsWithRange);
  expect(missing.metrics.referenceRangeAccuracy).toBeLessThan(1);
  expect(missing.gate.failures).toEqual(["reference_range_accuracy_below_threshold"]);
});

it("rejects reference-range text that is not a bare range body", () => {
  const run = structuredClone(referenceRuns[0]) as unknown as { candidates: Array<Record<string, unknown>> };
  run.candidates[0].referenceRangeText = "normal 70-99";
  expect(medicalDocumentRunSchema.safeParse(run).success).toBe(false);
  run.candidates[0].referenceRangeText = "≤5.6";
  expect(medicalDocumentRunSchema.safeParse(run).success).toBe(true);
  const gold = structuredClone(corpus.documents[0]) as unknown as { expectedMeasurements: Array<Record<string, unknown>> };
  gold.expectedMeasurements[0].referenceRangeText = "70-99";
  expect(medicalDocumentGoldSchema.safeParse(gold).success).toBe(false);
  gold.expectedMeasurements[0] = { ...gold.expectedMeasurements[0], expectedReferenceRangeText: "70-99" };
  delete gold.expectedMeasurements[0].referenceRangeText;
  expect(medicalDocumentGoldSchema.safeParse(gold).success).toBe(true);
});
```

In `apps/web/tests/native-text-report.test.ts` add `referenceRangeAccuracy: 1,` after `hallucinationRate: 0,` inside `metrics`, add `referenceRangeAccuracy: 1` to the `thresholds` object, and add to the test body:

```ts
  expect(markdown).toContain("| Reference-range text carried verbatim | 100.0% |");
  expect(markdown).toContain("reference-range text = 1");
```

- [ ] **Step 6: Run the web tests to verify they fail**

Run: `export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/medical-document-evaluation.test.ts tests/native-text-report.test.ts`
Expected: FAIL — `referenceRangeAccuracy` is `undefined`; the schema test fails because `referenceRangeText` is an unknown key under `strictObject`.

- [ ] **Step 7: Implement contracts, evaluator and report**

In `apps/web/lib/medical-ai/contracts.ts` add after `const dateSchema = ...`:

```ts
/** A printed range body carried verbatim: digits, separators and comparison signs only. Never interpreted. */
const referenceRangeTextSchema = z.string().regex(/^[0-9.,\s\-~–<>≤≥]{1,40}$/);
```

Replace `extractedMeasurementSchema` and `expectedMeasurementSchema` with:

```ts
export const extractedMeasurementSchema = z.strictObject({
  semanticRole: z.literal("measurement"),
  fieldId: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(64),
  unit: z.string().min(1).max(32),
  observedAt: dateSchema,
  referenceRange: z.string().min(1).max(80).optional(),
  referenceRangeText: referenceRangeTextSchema.optional(),
  confidence: z.number().min(0).max(1),
  evidence: evidenceLocationSchema,
});

export const expectedMeasurementSchema = extractedMeasurementSchema
  .omit({ confidence: true, referenceRangeText: true })
  .extend({ expectedReferenceRangeText: referenceRangeTextSchema.optional() });
```

In `apps/web/lib/medical-ai/evaluation.ts`:

Add `referenceRangeAccuracy: number;` to `MedicalDocumentGateThresholds` and `referenceRangeAccuracy: 1,` to `candidateAdmissionThresholds`. Add `referenceRangeAccuracy: number;` to `metrics` in `MedicalDocumentSyntheticContractRegression` (after `hallucinationRate: number;`).

Add two counters after `let correctAbstentionCount = 0;`:

```ts
  let matchedMeasurementCount = 0;
  let referenceRangeMatchCount = 0;
```

Inside the `for (const candidate of run.candidates)` loop, after `if (!expected) { ... continue; }` add:

```ts
      matchedMeasurementCount += 1;
      if ((expected.expectedReferenceRangeText ?? null) === (candidate.referenceRangeText ?? null)) referenceRangeMatchCount += 1;
```

After `const hallucinationRate = ...` add:

```ts
  const referenceRangeAccuracy = ratio(referenceRangeMatchCount, matchedMeasurementCount);
```

After the `hallucinationRate > thresholds.hallucinationRate` failure line add:

```ts
  if (referenceRangeAccuracy < thresholds.referenceRangeAccuracy) failures.push("reference_range_accuracy_below_threshold");
```

and add `referenceRangeAccuracy,` to the returned `metrics` after `hallucinationRate,`.

In `apps/web/lib/medical-ai/native-text-report.ts` add after the `Hallucinated measurements` row:

```ts
    `| Reference-range text carried verbatim | ${percent(m.referenceRangeAccuracy)} |`,
```

and change the thresholds sentence to:

```ts
    "Thresholds: field F1 = 1, critical value exact = 1, evidence localization = 1, hallucination = 0, required abstention recall = 1, reference-range text = 1.",
```

- [ ] **Step 8: Run the web tests and the type check**

Run: `pnpm --dir apps/web exec vitest run tests/medical-document-evaluation.test.ts tests/native-text-report.test.ts tests/medgemma-experiment.test.ts && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: all tests pass; `tsc` prints nothing. If `tsc` reports a missing `referenceRangeAccuracy` in another literal of type `MedicalDocumentSyntheticContractRegression` (for example in `apps/web/lib/medical-ai/medgemma-report.ts` or a test fixture), add `referenceRangeAccuracy: 1` there — the metric is a required field of the report type.

- [ ] **Step 9: Run the native-text gate**

Run: `pnpm medical-ai:native-text-gate`
Expected: JSON report with `"corpusId": "synthetic-ko-checkup-r2-e6befc286ae6ce1d"`, `"fieldF1": 1`, `"referenceRangeAccuracy": 1`, `"passed": true`, exit code 0. If `corpusId` differs, stop: the PDF bytes changed (they must not — only `corpus.json` may change); find and revert the byte change before continuing. Record the printed `corpusId` for Task 10.

- [ ] **Step 10: Commit**

```bash
git add packages/korean-checkup-benchmark/src apps/web/lib/medical-ai/contracts.ts apps/web/lib/medical-ai/evaluation.ts apps/web/lib/medical-ai/native-text-report.ts apps/web/tests/medical-document-evaluation.test.ts apps/web/tests/native-text-report.test.ts
git commit -m "feat(benchmark): gold expectedReferenceRangeText, run referenceRangeText and a referenceRangeAccuracy gate at 1

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 5: Core — `ChangeDelta` in the projection and the changes API

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeDelta.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjection.kt:28-38,66-89`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ChangeDeltaTest.kt` (create)
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjectionTest.kt:306-312`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt:1093-1147`

**Interfaces:**
- Consumes: `ChangeItem`, `ChangeValue`, `FoundationRecordRow.currentValue`.
- Produces: `data class ChangeDelta(val absolute: String, val percent: String?)`; `object ChangeDeltaCalculator { fun compute(latest: String, previous: String): ChangeDelta? }`; `ChangeItem.delta: ChangeDelta?` (last parameter, JSON key `delta`, omitted when null under `non_null`). Task 6 mirrors it in zod. The existing `carriesNoInterpretationFields` test lists `"difference"` and `"delta"` as forbidden field names; the spec now authorises `delta`, so those two words leave that list (direction/trend/referenceRange/flag/normal/abnormal/risk stay).

- [ ] **Step 1: Write the failing unit tests**

Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ChangeDeltaTest.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ChangeDeltaTest {
    @Test
    fun subtractsIntegersWithAnExplicitSignAndOneDecimalPercent() {
        assertThat(ChangeDeltaCalculator.compute("188", "194")).isEqualTo(ChangeDelta("-6", "-3.1"))
        assertThat(ChangeDeltaCalculator.compute("206", "194")).isEqualTo(ChangeDelta("+12", "+6.2"))
        assertThat(ChangeDeltaCalculator.compute("194", "194")).isEqualTo(ChangeDelta("0", "0.0"))
    }

    @Test
    fun keepsTheLargerScaleOfTheTwoInputs() {
        assertThat(ChangeDeltaCalculator.compute("5.4", "5.2")).isEqualTo(ChangeDelta("+0.2", "+3.8"))
        assertThat(ChangeDeltaCalculator.compute("5.2", "5.5")).isEqualTo(ChangeDelta("-0.3", "-5.5"))
        assertThat(ChangeDeltaCalculator.compute("10", "2.50")).isEqualTo(ChangeDelta("+7.50", "+300.0"))
        assertThat(ChangeDeltaCalculator.compute("5.2", "5.2")).isEqualTo(ChangeDelta("0.0", "0.0"))
    }

    @Test
    fun roundsThePercentHalfEven() {
        // 0.25 % exactly: HALF_EVEN keeps 0.2, HALF_UP would give 0.3.
        assertThat(ChangeDeltaCalculator.compute("100.25", "100")).isEqualTo(ChangeDelta("+0.25", "+0.2"))
        assertThat(ChangeDeltaCalculator.compute("100.35", "100")).isEqualTo(ChangeDelta("+0.35", "+0.4"))
    }

    @Test
    fun handlesNegativeValues() {
        assertThat(ChangeDeltaCalculator.compute("-3", "-4")).isEqualTo(ChangeDelta("+1", "-25.0"))
        assertThat(ChangeDeltaCalculator.compute("-5", "2")).isEqualTo(ChangeDelta("-7", "-350.0"))
    }

    @Test
    fun leavesPercentNullWhenThePreviousValueIsZero() {
        assertThat(ChangeDeltaCalculator.compute("12", "0")).isEqualTo(ChangeDelta("+12", null))
        assertThat(ChangeDeltaCalculator.compute("0.0", "0")).isEqualTo(ChangeDelta("0.0", null))
    }

    @Test
    fun stripsThousandsCommasBeforeParsing() {
        assertThat(ChangeDeltaCalculator.compute("1,234", "1,200")).isEqualTo(ChangeDelta("+34", "+2.8"))
        assertThat(ChangeDeltaCalculator.compute("6,200", "6,800")).isEqualTo(ChangeDelta("-600", "-8.8"))
    }

    @Test
    fun returnsNullWhenEitherValueIsNotANumber() {
        assertThat(ChangeDeltaCalculator.compute("abc", "1")).isNull()
        assertThat(ChangeDeltaCalculator.compute("1", "")).isNull()
        assertThat(ChangeDeltaCalculator.compute("1.2.3", "1")).isNull()
        assertThat(ChangeDeltaCalculator.compute("양성", "음성")).isNull()
    }

    @Test
    fun carriesNoInterpretationFields() {
        assertThat(ChangeDelta::class.java.declaredFields.map { it.name })
            .containsExactlyInAnyOrder("absolute", "percent")
    }
}
```

In `ChangeSummaryProjectionTest.kt` replace `carriesNoInterpretationFields` with:

```kotlin
    @Test
    fun carriesNoInterpretationFields() {
        val itemFields = ChangeItem::class.java.declaredFields.map { it.name }
        val summaryFields = ChangeSummary::class.java.declaredFields.map { it.name }
        assertThat(itemFields + summaryFields)
            .doesNotContain("direction", "trend", "referenceRange", "referenceRangeText", "flag", "normal", "abnormal", "risk", "arrow", "colour")
        assertThat(itemFields).contains("delta")
    }

    @Test
    fun attachesTheSignedDifferenceOnlyWhenAPreviousValueExists() {
        val january = row("총콜레스테롤", "194", LocalDate.of(2026, 1, 15), januaryDocument)
        val july = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument)
        val vitaminD = row("비타민 D", "42", LocalDate.of(2026, 7, 28), julyDocument, unit = "ng/mL", conceptCode = "vitamin-d")
        val documents = listOf(completed(januaryDocument, "2026-01-16T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val items = ChangeSummaryProjection.project(listOf(january, july, vitaminD), documents).items.associateBy { it.concept }

        assertThat(items.getValue("총콜레스테롤").delta).isEqualTo(ChangeDelta("-6", "-3.1"))
        assertThat(items.getValue("비타민 D").previous).isNull()
        assertThat(items.getValue("비타민 D").delta).isNull()
    }

    @Test
    fun leavesTheDeltaNullWhenTheUnitDiffersOrAValueIsNotNumeric() {
        val januaryOtherUnit = row("총콜레스테롤", "5.0", LocalDate.of(2026, 1, 15), januaryDocument, unit = "mmol/L")
        val julyText = row("총콜레스테롤", "188", LocalDate.of(2026, 7, 28), julyDocument)
        val documents = listOf(completed(januaryDocument, "2026-01-16T00:00:00Z"), completed(julyDocument, "2026-07-28T10:00:00Z"))

        val item = ChangeSummaryProjection.project(listOf(januaryOtherUnit, julyText), documents).items.single()

        assertThat(item.previous).isNull()
        assertThat(item.delta).isNull()
    }
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.ChangeDeltaTest" --tests "kr.co.genomecompanion.foundation.ChangeSummaryProjectionTest"`
Expected: compilation error `Unresolved reference 'ChangeDeltaCalculator'` / `'delta'`.

- [ ] **Step 3: Implement `ChangeDelta` and wire it into the projection**

Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeDelta.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * The arithmetic difference between this time's value and the previous value of the same item
 * in the same unit, as signed numbers in text. Subtraction and division only: no direction word,
 * colour, arrow, threshold or meaning is attached anywhere
 * (governance/intended-use-decision-reference-range-and-delta-2026-09-17.md, item (b)).
 */
data class ChangeDelta(
    /** `latest − previous` at the larger scale of the two inputs, sign explicit (`"+12"`, `"-6"`, `"-0.3"`, `"0"`). */
    val absolute: String,
    /** `absolute / previous × 100`, HALF_EVEN to one decimal, sign explicit; null when `previous` is zero. */
    val percent: String?,
)

object ChangeDeltaCalculator {
    private val hundred = BigDecimal(100)

    /** Null when either value is not a plain number (after removing thousands commas). */
    fun compute(latest: String, previous: String): ChangeDelta? {
        val latestNumber = parse(latest) ?: return null
        val previousNumber = parse(previous) ?: return null
        val absolute = latestNumber.subtract(previousNumber)
            .setScale(maxOf(latestNumber.scale(), previousNumber.scale()), RoundingMode.UNNECESSARY)
        val percent = if (previousNumber.signum() == 0) {
            null
        } else {
            absolute.multiply(hundred).divide(previousNumber, 1, RoundingMode.HALF_EVEN)
        }
        return ChangeDelta(absolute = signed(absolute), percent = percent?.let(::signed))
    }

    private fun parse(raw: String): BigDecimal? {
        val text = raw.replace(",", "").trim()
        if (!Regex("^-?\\d+(\\.\\d+)?$").matches(text)) return null
        return runCatching { BigDecimal(text) }.getOrNull()
    }

    private fun signed(value: BigDecimal): String =
        if (value.signum() > 0) "+" + value.toPlainString() else value.toPlainString()
}
```

In `ChangeSummaryProjection.kt` replace `ChangeItem` with:

```kotlin
/**
 * This time's value beside the previous value of the same item, plus — when both parse as numbers —
 * their arithmetic difference. No direction, no range, no judgement.
 */
data class ChangeItem(
    val conceptCode: String?,
    val concept: String,
    val unit: String,
    val latest: ChangeValue,
    val previous: ChangeValue?,
    /** Null when there is no previous value in the same unit or a value is not numeric. */
    val delta: ChangeDelta? = null,
)
```

and in `project(...)` replace the `ChangeItem(...)` construction with:

```kotlin
                ChangeItem(
                    conceptCode = record.conceptCode,
                    concept = record.label,
                    unit = record.unit,
                    latest = ChangeValue(record.recordVersionId, record.currentValue, record.observedOn.toString()),
                    previous = previous?.let { ChangeValue(it.recordVersionId, it.currentValue, it.observedOn.toString()) },
                    delta = previous?.let { ChangeDeltaCalculator.compute(record.currentValue, it.currentValue) },
                )
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `./gradlew.bat :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.ChangeDeltaTest" --tests "kr.co.genomecompanion.foundation.ChangeSummaryProjectionTest"`
Expected: `BUILD SUCCESSFUL`, all pass.

- [ ] **Step 5: Extend the changes integration test**

In `changesListTheLatestDocumentValuesBesideThePreviousValueOfTheSameConcept` add after `assertThat(byConcept.getValue("비타민 D")["previous"]["value"].asText()).isEqualTo("45")`:

```kotlin
        assertThat(byConcept.getValue("총콜레스테롤")["delta"]["absolute"].asText()).isEqualTo("-6")
        assertThat(byConcept.getValue("총콜레스테롤")["delta"]["percent"].asText()).isEqualTo("-3.1")
        assertThat(byConcept.getValue("당화혈색소")["delta"]["absolute"].asText()).isEqualTo("-0.2")
        assertThat(byConcept.getValue("당화혈색소")["delta"]["percent"].asText()).isEqualTo("-3.7")
        assertThat(byConcept.getValue("비타민 D")["delta"]["absolute"].asText()).isEqualTo("-3")
        assertThat(byConcept.getValue("비타민 D")["delta"]["percent"].asText()).isEqualTo("-6.7")
        assertThat(firstOnly["items"].map { it.has("delta") }).containsExactly(false, false, false)
```

Change the existing line `assertThat(summary.toString()).doesNotContain("referenceRange", "difference", "direction", "trend")` to:

```kotlin
        assertThat(summary.toString().lowercase()).doesNotContain("reference", "direction", "trend", "arrow")
```

- [ ] **Step 6: Run the PostgreSQL test**

Run: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest"`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 7: Commit**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeDelta.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjection.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ChangeDeltaTest.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjectionTest.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt
git commit -m "feat(core-api): signed arithmetic ChangeDelta on each what-changed item with a previous value

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 6: Web — zod `delta`, the "두 값의 차이" line in 최근 변화, direction words in the copy scan

**Files:**
- Modify: `apps/web/lib/foundation/client.ts:179-188`
- Modify: `apps/web/components/integrated/RecentChanges.tsx`
- Test: `apps/web/tests/recent-changes.test.tsx`
- Test: `apps/web/tests/foundation-client.test.ts:258-284`
- Test: `apps/web/tests/korean-ux-copy.test.ts:28-54,123-129`

**Interfaces:**
- Consumes: server `ChangeItem.delta` (Task 5): `{ absolute: string; percent?: string | null }`.
- Produces: zod `changeDeltaSchema` and `changeItemSchema.delta: changeDeltaSchema.nullable().optional()`; `ChangeItem["delta"]` type; DOM: each `<li>` now holds `<div data-testid="change-item">` (unchanged text) and, when present, `<div data-testid="change-delta">두 값의 차이: {absolute} {unit} ({percent}%)</div>`. Task 8 asserts `change-delta` in the browser.

- [ ] **Step 1: Write the failing web tests**

In `apps/web/tests/recent-changes.test.tsx` add `delta: { absolute: "-6", percent: "-3.1" },` to the first item of `summary` (after `previous: {...}`), and append:

```ts
it("states the arithmetic difference as a signed number with no direction, colour or icon", () => {
  render(<RecentChanges changes={summary} />);

  const deltas = screen.getAllByTestId("change-delta");
  expect(deltas.map((line) => line.textContent)).toEqual(["두 값의 차이: -6 mg/dL (-3.1%)"]);
  expect(screen.getAllByTestId("change-item").map((item) => item.textContent)).toEqual([
    "총콜레스테롤 · 이번 2026. 7. 28. 188 mg/dL · 이전 2026. 1. 15. 194 mg/dL",
    "비타민 D · 이번 2026. 7. 28. 42 ng/mL · 이전 값 없음",
  ]);
  expect(deltas[0].querySelector("svg, img, [style]")).toBeNull();
  expect(document.body.textContent).not.toMatch(/→|↑|↓|▲|▼|증가|감소|상승|하락|높|낮|정상|비정상|위험/);
});

it("omits the percentage when the previous value was zero and the whole line when there is no delta", () => {
  const zeroPrevious: ChangeSummary = {
    ...summary,
    items: [
      { ...summary.items[0], delta: { absolute: "+12", percent: null } },
      { ...summary.items[1] },
    ],
  };
  render(<RecentChanges changes={zeroPrevious} />);
  expect(screen.getAllByTestId("change-delta").map((line) => line.textContent)).toEqual(["두 값의 차이: +12 mg/dL"]);
});
```

In `apps/web/tests/foundation-client.test.ts`, inside `accepts a change summary whose null members are omitted and refuses a judgement field`, add before `const judging = ...`:

```ts
    const withDelta = createFoundationClient({
      fetcher: vi.fn(async () => jsonResponse({
        items: [{
          concept: "총콜레스테롤",
          unit: "mg/dL",
          latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
          previous: { eventId: "9c3e4f50-6172-4c8d-ae9f-1a2b3c4d5e60", value: "194", observedOn: "2026-01-15" },
          delta: { absolute: "-6", percent: "-3.1" },
        }],
        newConcepts: [],
        unchangedCount: 0,
      })),
      readCsrfToken: () => "csrf-value",
    });
    await expect(withDelta.getChanges()).resolves.toMatchObject({ items: [{ delta: { absolute: "-6", percent: "-3.1" } }] });

    const deltaWithDirection = createFoundationClient({
      fetcher: vi.fn(async () => jsonResponse({
        items: [{
          concept: "총콜레스테롤",
          unit: "mg/dL",
          latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
          previous: { eventId: "9c3e4f50-6172-4c8d-ae9f-1a2b3c4d5e60", value: "194", observedOn: "2026-01-15" },
          delta: { absolute: "-6", percent: "-3.1", direction: "down" },
        }],
        newConcepts: [],
        unchangedCount: 0,
      })),
      readCsrfToken: () => "csrf-value",
    });
    await expect(deltaWithDirection.getChanges()).rejects.toMatchObject({ code: "invalid_server_response" });
```

In `apps/web/tests/korean-ux-copy.test.ts` add to `forbiddenUserTerms` (after `"강남세브란스",`):

```ts
  // Direction words: the product states two values and their arithmetic difference, never a trend.
  "상승",
  "하락",
  "증가",
  "감소",
```

and in the test `describes the recent changes as two values without a judgement` add:

```ts
    expect(recent).toContain("두 값의 차이:");
    expect(recent).not.toMatch(/[↑↓▲▼]/);
    expect(recent).not.toContain("color");
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/recent-changes.test.tsx tests/foundation-client.test.ts tests/korean-ux-copy.test.ts`
Expected: `recent-changes` fails (`change-delta` not found, and a type error on `delta` if run under tsc); `foundation-client` fails because `delta` is an unknown key under `.strict()`; `korean-ux-copy` fails on `두 값의 차이:`.

- [ ] **Step 3: Implement**

In `apps/web/lib/foundation/client.ts` replace `changeItemSchema` with:

```ts
// The arithmetic difference between the two values: signed numbers in text, nothing else.
// `.strict()` is the boundary: a direction, colour or threshold key fails validation here.
const changeDeltaSchema = z.object({
  absolute: z.string().regex(/^[+-]?\d+(\.\d+)?$/),
  percent: z.string().regex(/^[+-]?\d+\.\d$/).nullable().optional(),
}).strict();

// This time's value beside the previous value of the same item, plus their arithmetic
// difference when both are numbers. `.strict()` is the boundary: a server that starts
// sending a direction or a range fails validation here. `previous`/`delta` are omitted
// when the server has none.
const changeItemSchema = z.object({
  conceptCode: conceptCodeSchema.nullable().optional(),
  concept: z.string().min(1).max(80),
  unit: z.string().min(1).max(32),
  latest: changeValueSchema,
  previous: changeValueSchema.nullable().optional(),
  delta: changeDeltaSchema.nullable().optional(),
}).strict();
```

Replace `apps/web/components/integrated/RecentChanges.tsx` with:

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

/** The subtraction result as the server computed it: a signed number, the unit, and the percent of the previous value. */
function deltaLine(item: ChangeSummary["items"][number]) {
  if (!item.delta) return null;
  const percent = item.delta.percent == null ? "" : ` (${item.delta.percent}%)`;
  return `두 값의 차이: ${item.delta.absolute} ${item.unit}${percent}`;
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
        {changes.items.map((item) => {
          const delta = deltaLine(item);
          return (
            <li key={item.latest.eventId}>
              <div data-testid="change-item">{changeLine(item)}</div>
              {delta && <div data-testid="change-delta">{delta}</div>}
            </li>
          );
        })}
      </ul>
      {changes.newConcepts.length > 0 && <p>{`이전 값이 없는 항목: ${changes.newConcepts.join(", ")}`}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Run the web tests and type check**

Run: `pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: every test file passes (including `integrated-review-loop.test.tsx`, whose `change-item` assertion is unchanged) and `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/foundation/client.ts apps/web/components/integrated/RecentChanges.tsx apps/web/tests/recent-changes.test.tsx apps/web/tests/foundation-client.test.ts apps/web/tests/korean-ux-copy.test.ts
git commit -m "feat(web): 두 값의 차이 line on 최근 변화 from the server's signed delta; direction words join the copy scan

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 7: Web 내 데이터 minors — correction history in the drawer, `SourcePreview` uses `page`, axe on empty/error, arrival animation with reduced-motion

**Files:**
- Modify: `apps/web/lib/foundation/client.ts:157-171`
- Modify: `apps/web/tests/fixtures/foundation.ts:93-115`
- Modify: `apps/web/components/my-data/EvidenceDrawer.tsx:42-49`
- Modify: `apps/web/components/integrated/SourcePreview.tsx`
- Create: `apps/web/lib/my-data/reduced-motion.ts`
- Modify: `apps/web/components/my-data/LivingCellCanvas.tsx:1-32,59-87`
- Modify: `apps/web/components/my-data/MyData.tsx:18-28,46-66,94-99`
- Modify: `apps/web/components/my-data/MyData.module.css:12-21,65-67`
- Test: `apps/web/tests/evidence-drawer.test.tsx`, `apps/web/tests/source-preview.test.tsx` (create), `apps/web/tests/my-data.test.tsx:61-70`, `apps/web/tests/living-cell-canvas.test.tsx`

**Interfaces:**
- Consumes: server `HealthEvent.originalValue`, `correctionReason?`, `originalObservedOn?` (Task 3); `CellLayout.state === "new"` from `layoutCells` (`apps/web/lib/my-data/cell-layout.ts:60-65`).
- Produces: zod `healthEventSchema` gains `originalValue: string`, `correctionReason?: string | null`, `originalObservedOn?: string | null`; `usePrefersReducedMotion(): boolean`; `LivingCellCanvas` marks a `state === "new"` cell with `data-arrived="true"` and the CSS-module class `cellArrived` unless reduced motion is preferred; `MyData` computes `newIds` = events present in this load and absent from the previous successful load (first load: none); `SourcePreview` renders `data-page` and page-aware alt/caption; drawer `수정 이력` row. Task 8 asserts the drawer text in the browser.

- [ ] **Step 1: Write the failing tests**

In `apps/web/tests/fixtures/foundation.ts` add `originalValue: "188",` right after `unit: "mg/dL",` in `syntheticHealthEvent` (the zod type will require it).

In `apps/web/tests/evidence-drawer.test.tsx` replace the second test with:

```tsx
it("explains a missing preview instead of hiding it, and lists the correction history for a corrected value", () => {
  const event = syntheticHealthEvent({
    verification: "uncertain",
    corrected: true,
    value: "190",
    originalValue: "188",
    correctionReason: "원문 재확인",
    observedOn: "2026-07-27",
    originalObservedOn: "2026-07-28",
    source: { ...syntheticHealthEvent().source, previewAvailable: false },
  });
  render(<EvidenceDrawer event={event} onClose={() => {}} />);
  expect(screen.getByText("출처 미리보기를 지금은 볼 수 없어요. 값은 그대로 두고, 출처 상태만 표시해요.")).toBeVisible();
  expect(screen.getByText("직접 수정한 값")).toBeVisible();
  expect(screen.queryByRole("img")).toBeNull();
  const history = screen.getByText("수정 이력").nextElementSibling;
  expect(history).toHaveTextContent("원래 값 188 mg/dL · 이유: 원문 재확인 · 원래 검사일 2026. 7. 28.");
  expect(document.body.textContent).not.toMatch(/증가|감소|상승|하락|정상|비정상/);
});

it("says 수정 없음 when nothing was corrected, and lists only the date when only the exam date changed", () => {
  render(<EvidenceDrawer event={syntheticHealthEvent()} onClose={() => {}} />);
  expect(screen.getByText("수정 이력").nextElementSibling).toHaveTextContent("수정 없음");
  cleanup();
  const dateOnly = syntheticHealthEvent({ corrected: true, observedOn: "2026-07-27", originalObservedOn: "2026-07-28" });
  render(<EvidenceDrawer event={dateOnly} onClose={() => {}} />);
  expect(screen.getByText("수정 이력").nextElementSibling).toHaveTextContent("원래 검사일 2026. 7. 28.");
  expect(screen.getByText("수정 이력").nextElementSibling).not.toHaveTextContent("원래 값");
});
```

Create `apps/web/tests/source-preview.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SourcePreview } from "@/components/integrated/SourcePreview";

afterEach(cleanup);

it("names the page the value came from and says the preview shows the first page", () => {
  const { container } = render(<SourcePreview documentId="e64ddaae-a326-4f23-88a9-05ac59a48625" page={2} />);
  expect(container.querySelector("figure")).toHaveAttribute("data-page", "2");
  expect(screen.getByRole("img", { name: "예시 결과지 첫 페이지 미리보기 (값은 2쪽)" })).toHaveAttribute(
    "src",
    "/api/foundation/documents/e64ddaae-a326-4f23-88a9-05ac59a48625/preview",
  );
  expect(screen.getByText(/값은 2쪽에 있어요\. 미리보기는 결과지의 첫 페이지만 보여드려요\./)).toBeVisible();
  cleanup();
  render(<SourcePreview documentId="e64ddaae-a326-4f23-88a9-05ac59a48625" page={1} />);
  expect(screen.getByRole("img", { name: "예시 결과지 1쪽 미리보기" })).toBeVisible();
  expect(screen.queryByText(/첫 페이지만 보여드려요/)).toBeNull();
});
```

In `apps/web/tests/my-data.test.tsx` replace `shows the empty state and the server error state honestly` with:

```tsx
it("shows the empty state and the server error state honestly, both without accessibility violations", async () => {
  server.use(http.get("/api/foundation/health-events", () => HttpResponse.json([])));
  const empty = render(<MyData />);
  expect(await screen.findByText("아직 확인한 기록이 없어요. 데이터 관리에서 결과지를 추가하면 여기에 한 칸씩 쌓여요.")).toBeVisible();
  expect(await axe(empty.container)).toHaveNoViolations();
  empty.unmount();
  server.use(http.get("/api/foundation/health-events", () => HttpResponse.json({ code: "INTERNAL" }, { status: 500 })));
  const failed = render(<MyData />);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
  expect(await axe(failed.container)).toHaveNoViolations();
});
```

In `apps/web/tests/living-cell-canvas.test.tsx` append (the file already imports `vi` from vitest):

```tsx
function stubReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

it("plays the arrival animation once for a new cell and not under prefers-reduced-motion", () => {
  stubReducedMotion(false);
  const animated = render(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={new Set([jul.eventId])} onSelect={() => {}} />);
  const newCell = screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL, 2026. 7. 28." });
  expect(newCell).toHaveAttribute("data-state", "new");
  expect(newCell).toHaveAttribute("data-arrived", "true");
  expect(newCell.getAttribute("class")).toMatch(/cellArrived/);
  expect(screen.getByRole("button", { name: "총콜레스테롤 194 mg/dL, 2026. 1. 15." })).not.toHaveAttribute("data-arrived");
  animated.unmount();

  stubReducedMotion(true);
  render(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={new Set([jul.eventId])} onSelect={() => {}} />);
  const still = screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL, 2026. 7. 28." });
  expect(still).toHaveAttribute("data-state", "new");
  expect(still).not.toHaveAttribute("data-arrived");
  expect(still.getAttribute("class")).not.toMatch(/cellArrived/);
  // @ts-expect-error jsdom has no matchMedia; remove the stub so other tests see the default.
  delete window.matchMedia;
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/evidence-drawer.test.tsx tests/source-preview.test.tsx tests/my-data.test.tsx tests/living-cell-canvas.test.tsx`
Expected: drawer tests fail (`수정 이력` not found); source-preview fails (no `data-page`); living-cell-canvas fails (no `data-arrived`); the my-data axe test may already pass — that is fine, it stays as the regression guard.

- [ ] **Step 3: Implement zod, fixture type, drawer, preview**

In `apps/web/lib/foundation/client.ts` replace `healthEventSchema` with:

```ts
// A read-model over current records. `.strict()` is the boundary: a server
// that starts sending a reference range or a direction fails validation here.
// `originalValue`/`correctionReason`/`originalObservedOn` are the person's own
// correction history (the parser's value and date), nothing derived.
const healthEventSchema = z.object({
  eventId: uuidSchema,
  recordId: uuidSchema,
  domain: z.enum(["lab"]),
  concept: z.string().min(1).max(80),
  // Dictionary key from the alias catalogue (null/omitted when the label matched nothing).
  conceptCode: conceptCodeSchema.nullable().optional(),
  value: z.string().min(1).max(64),
  unit: z.string().min(1).max(32),
  observedOn: z.string().date(),
  verification: z.enum(["verified", "uncertain"]),
  corrected: z.boolean(),
  confirmedAt: z.string().datetime({ offset: true }),
  originalValue: z.string().min(1).max(64),
  correctionReason: z.string().min(1).max(200).nullable().optional(),
  // The parser's exam date when the person corrected it on review; omitted when unchanged.
  originalObservedOn: z.string().date().nullable().optional(),
  source: healthEventSourceSchema,
}).strict();
```

In `apps/web/components/my-data/EvidenceDrawer.tsx` add above the component:

```tsx
/** Stored facts only: the parser's value, the person's stated reason, the parser's date. No comparison. */
function correctionHistory(event: HealthEvent) {
  if (!event.corrected) return "수정 없음";
  const parts: string[] = [];
  if (event.originalValue !== event.value) parts.push(`원래 값 ${event.originalValue} ${event.unit}`);
  if (event.correctionReason) parts.push(`이유: ${event.correctionReason}`);
  if (event.originalObservedOn) parts.push(`원래 검사일 ${formatKoreanDate(event.originalObservedOn)}`);
  return parts.length > 0 ? parts.join(" · ") : "수정 없음";
}
```

and inside the `<dl>` add after the `확인` row:

```tsx
        <dt>수정 이력</dt><dd>{correctionHistory(event)}</dd>
```

Replace `apps/web/components/integrated/SourcePreview.tsx` with:

```tsx
"use client";

import { useState } from "react";

/**
 * No raw-document embedding. The server authorizes and serves one PNG derivative — the first page.
 * `page` is the page the value was read from; when it is not the first page the caption says so
 * instead of pretending the image is that page.
 */
export function SourcePreview({ documentId, page = 1 }: { documentId: string; page?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p role="status">원문 미리보기를 불러오지 못했어요. 기록은 바뀌지 않았어요. <button type="button" onClick={() => setFailed(false)}>다시 불러오기</button></p>;
  const firstPage = page === 1;
  return <figure className="gc-source-preview" data-page={page}>
    <img src={`/api/foundation/documents/${encodeURIComponent(documentId)}/preview`}
      alt={firstPage ? "예시 결과지 1쪽 미리보기" : `예시 결과지 첫 페이지 미리보기 (값은 ${page}쪽)`} loading="lazy" onError={() => setFailed(true)} />
    <figcaption>
      {firstPage
        ? "예시 데이터 · 업로드한 결과지의 첫 페이지를 이미지로 보여드려요. "
        : `예시 데이터 · 값은 ${page}쪽에 있어요. 미리보기는 결과지의 첫 페이지만 보여드려요. `}
      항목은 결과지의 글자 정보에서 읽은 값이며, 이미지를 판독한 결과가 아니에요.
    </figcaption>
  </figure>;
}
```

- [ ] **Step 4: Implement the arrival animation and `newIds`**

Create `apps/web/lib/my-data/reduced-motion.ts`:

```ts
import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the person asked the OS/browser for reduced motion. False during SSR and before the first effect. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(QUERY);
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
```

In `apps/web/components/my-data/LivingCellCanvas.tsx` add the import `import { usePrefersReducedMotion } from "@/lib/my-data/reduced-motion";`, add `const reducedMotion = usePrefersReducedMotion();` right after `const [focusedId, setFocusedId] = useState<string>();`, and inside the `cells.map` change the `<g` element's attributes: replace `className={styles.cell}` with

```tsx
              className={arrived ? `${styles.cell} ${styles.cellArrived}` : styles.cell}
              data-arrived={arrived ? "true" : undefined}
```

and add `const arrived = cell.state === "new" && !reducedMotion;` next to `const dim = ...`.

In `apps/web/components/my-data/MyData.module.css` add after the `.cell:focus-visible rect[data-cell]` rule:

```css
@keyframes gc-cell-arrive {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 1; transform: scale(1); }
}
.cellArrived { animation: gc-cell-arrive 420ms ease-out 1 both; transform-box: fill-box; transform-origin: center; }
```

and extend the reduced-motion block to:

```css
@media (prefers-reduced-motion: reduce) {
  .cell { transition: none; }
  .cellArrived { animation: none; }
}
```

In `apps/web/components/my-data/MyData.tsx` add after `const [selectedId, setSelectedId] = useState<string>();`:

```tsx
  const [newIds, setNewIds] = useState<Set<string>>(NO_NEW_IDS);
  // Ids seen in the previous successful load; null until the first load so nothing animates on arrival at the page.
  const seenIdsRef = useRef<Set<string> | null>(null);
```

replace `if (active) setEvents(loaded);` with:

```tsx
        if (active) {
          const ids = new Set(loaded.map((event) => event.eventId));
          const seen = seenIdsRef.current;
          setNewIds(seen ? new Set([...ids].filter((id) => !seen.has(id))) : NO_NEW_IDS);
          seenIdsRef.current = ids;
          setEvents(loaded);
        }
```

and change `newIds={NO_NEW_IDS}` to `newIds={newIds}`.

- [ ] **Step 5: Run the web tests and type check**

Run: `pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: all pass; `tsc` prints nothing. `korean-ux-copy.test.ts` still passes for `SourcePreview.tsx` and `EvidenceDrawer.tsx` (no forbidden term, no raw enum).

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/foundation/client.ts apps/web/tests/fixtures/foundation.ts apps/web/components/my-data apps/web/components/integrated/SourcePreview.tsx apps/web/lib/my-data/reduced-motion.ts apps/web/tests/evidence-drawer.test.tsx apps/web/tests/source-preview.test.tsx apps/web/tests/my-data.test.tsx apps/web/tests/living-cell-canvas.test.tsx
git commit -m "feat(web): 수정 이력 in the evidence drawer, page-aware source preview, axe on empty/error, reduced-motion-aware cell arrival

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 8: Browser lifecycle — range text in the export and nowhere on screen; 두 값의 차이 lines; 수정 이력 in the drawer

**Files:**
- Modify: `apps/web/lib/foundation/synthetic-document.ts:6-8`
- Modify: `apps/web/tests/synthetic-document.test.ts`
- Modify: `apps/web/e2e/foundation-lifecycle.spec.ts:336-350,355-367,418-433`

**Interfaces:**
- Consumes: the July synthetic PDF (allow-listed by digest at config time in `playwright.foundation.config.ts`, so a byte change needs no other edit); `change-delta` test ids (Task 6); drawer `수정 이력` (Task 7); export v2 (Task 3).
- Produces: the July fixture row `Cholesterol: 188 mg/dL 120-199` (the worker reads label `Cholesterol`, value `188`, unit `mg/dL`, referenceRangeText `120-199`); browser assertions listed below. Values in this flow: July 총콜레스테롤 corrected to 190 at review, January 194 → delta `+4 mg/dL (+2.1%)`; 당화혈색소 5.2 → 5.4 → `+0.2 % (+3.8%)`; 비타민 D excluded in July → no delta.

- [ ] **Step 1: Change the July fixture and its unit test**

In `apps/web/lib/foundation/synthetic-document.ts` change the July line `"Cholesterol: 188 mg/dL"` to `"Cholesterol: 188 mg/dL 120-199"` (the January lines stay as they are). In `apps/web/tests/synthetic-document.test.ts` change `"Cholesterol: 188 mg/dL"` in the July list to `"Cholesterol: 188 mg/dL 120-199"` and add after the loops:

```ts
  expect(january).not.toContain("120-199");
```

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/synthetic-document.test.ts`
Expected: PASS.

- [ ] **Step 2: Extend the e2e assertions**

In `apps/web/e2e/foundation-lifecycle.spec.ts`:

(a) Right after the review of the first document (after `await expect(page.getByText("검사일을 수정함", { exact: true })).toBeVisible();`) add:

```ts
  // Wave 3 (a): the printed range is stored, never shown. Not on the review screen, not on the summary.
  await expect(page.getByText("120-199")).toHaveCount(0);
```

(b) In the "Wave 2C" block, after `await expect(page.getByText("이전 값이 없는 항목: 비타민 D")).toBeVisible();` add:

```ts
  // Wave 3 (b): the arithmetic difference as a signed number; nothing else.
  await expect(page.getByTestId("change-delta")).toHaveCount(2);
  await expect(page.getByTestId("change-item").filter({ hasText: "총콜레스테롤" }).locator("..").getByTestId("change-delta"))
    .toHaveText("두 값의 차이: +4 mg/dL (+2.1%)");
  await expect(page.getByTestId("change-item").filter({ hasText: "당화혈색소" }).locator("..").getByTestId("change-delta"))
    .toHaveText("두 값의 차이: +0.2 % (+3.8%)");
  await expect(page.getByTestId("change-item").filter({ hasText: "비타민 D" }).locator("..").getByTestId("change-delta")).toHaveCount(0);
  await expect(page.getByText("120-199")).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(/→|↑|↓|증가|감소|상승|하락/);
```

and change the line `expect(JSON.stringify(changes.body)).not.toMatch(/referenceRange|difference|direction|trend/);` to:

```ts
  expect(JSON.stringify(changes.body).toLowerCase()).not.toMatch(/reference|direction|trend/);
  expect(JSON.stringify(changes.body)).toContain('"delta":{"absolute":"+4","percent":"+2.1"}');
```

(c) In the `/records` step (`await page.goto("/records"); await expect(page.getByTestId("durable-record")).toHaveCount(5);`) add:

```ts
  await expect(page.getByText("120-199")).toHaveCount(0);
```

(d) In the `/my-data` block, after `await expect(drawer.getByRole("img")).toBeVisible();` add:

```ts
  await expect(page.getByText("120-199")).toHaveCount(0);
  // The July 총콜레스테롤 was corrected at review (188 → 190): the drawer lists the original value only.
  await page.getByRole("button", { name: "근거 닫기" }).click();
  await figure.getByRole("button", { name: "총콜레스테롤 190 mg/dL, 2026. 7. 28." }).click();
  const correctedDrawer = page.getByRole("region", { name: "총콜레스테롤 근거" });
  await expect(correctedDrawer).toContainText("수정 이력");
  await expect(correctedDrawer).toContainText("원래 값 188 mg/dL");
  await expect(correctedDrawer).not.toContainText("120-199");
  await page.getByRole("button", { name: "근거 닫기" }).click();
  // The date-corrected 당화혈색소 lists the parser's date only.
  await figure.getByRole("button", { name: "당화혈색소 5.2 %, 2026. 7. 27." }).click();
  await expect(page.getByRole("region", { name: "당화혈색소 근거" })).toContainText("원래 검사일 2026. 7. 28.");
  await page.getByRole("button", { name: "근거 닫기" }).click();
  // An untouched record says so.
  await figure.getByRole("button", { name: "비타민 D 45 ng/mL, 2026. 1. 15." }).click();
  await expect(page.getByRole("region", { name: "비타민 D 근거" })).toContainText("수정 없음");
  await page.getByRole("button", { name: "근거 닫기" }).click();
```

(e) In the export block replace from `const exported = await exportResponse.json() as {...};` through `expect(JSON.stringify(exported)).not.toContain("referenceRange");` with:

```ts
  const exported = await exportResponse.json() as {
    schemaVersion: string;
    subjectKind: string;
    events: Array<{ value: string; originalValue: string; referenceRangeText?: string; originalObservedOn?: string }>;
    documents: Array<{ documentId: string; status: string; eventCount: number }>;
  };
  expect(exported.schemaVersion).toBe("alm-health-events-export.v2");
  expect(exported.subjectKind).toBe("synthetic");
  expect(exported.events).toHaveLength(5);
  expect(exported.documents).toHaveLength(2);
  expect(exported.documents.map((document) => document.eventCount).sort()).toEqual([2, 3]);
  expect(exported.documents.map((document) => document.documentId)).toEqual([...exported.documents.map((document) => document.documentId)].sort());
  // Wave 3 (a): the export — and only the export — carries the document's own range text verbatim.
  const ranged = exported.events.filter((event) => event.referenceRangeText);
  expect(ranged).toHaveLength(1);
  expect(ranged[0]).toMatchObject({ value: "190", originalValue: "188", referenceRangeText: "120-199" });
  expect(exported.events.filter((event) => event.originalObservedOn)).toHaveLength(1);
  expect(JSON.stringify(eventsAfterBothDocuments.body).toLowerCase()).not.toContain("reference");
```

- [ ] **Step 3: Run the browser lifecycle**

Run: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine' && pnpm foundation:e2e`
Expected: `3 passed`. If the 최근 변화 delta texts differ, compare against the server JSON printed by `changes.body` — the numbers come from `ChangeDeltaCalculator`, the web only formats them.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/foundation/synthetic-document.ts apps/web/tests/synthetic-document.test.ts apps/web/e2e/foundation-lifecycle.spec.ts
git commit -m "test(e2e): range text only in export v2, 두 값의 차이 lines on the home, 수정 이력 in the drawer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 9: MedGemma — `num_ctx 8192` protocol change, manual Run 3, evidence sections

**Files:**
- Modify: `apps/web/lib/medical-ai/medgemma-experiment.ts:75`
- Modify: `apps/web/scripts/medgemma-local-experiment.mts:181`
- Test: `apps/web/tests/medgemma-experiment.test.ts:43-52`
- Modify (evidence, after the manual run): `docs/status/2026-09-17/medgemma-local-experiment.md`, `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md`

**Interfaces:**
- Consumes: `EXPERIMENT_PROTOCOL` (frozen), `protocolDigest()`, the script's `--report` argument (`resolveReportPath`), `apps/web/build/medgemma/{medgemma-runs.json,summary.json,raw/}` outputs.
- Produces: `EXPERIMENT_PROTOCOL.options = { temperature: 0, seed: 7, num_predict: 4096, num_ctx: 8192 }`; a new protocol digest (recorded, not hard-coded anywhere); the "Run 3 (num_ctx 8192)" section and the third pins block. No product code path calls the model.

- [ ] **Step 1: Write the failing protocol test**

In `apps/web/tests/medgemma-experiment.test.ts`, in `pins the prompt, schema and parameters and hashes them`, add after `expect(EXPERIMENT_PROTOCOL.options.temperature).toBe(0);`:

```ts
    expect(EXPERIMENT_PROTOCOL.options.num_predict).toBe(4096);
    expect(EXPERIMENT_PROTOCOL.options.num_ctx).toBe(8192);
    expect(Object.isFrozen(EXPERIMENT_PROTOCOL.options)).toBe(true);
```

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/medgemma-experiment.test.ts`
Expected: FAIL — `num_ctx` is `undefined` (and a TypeScript error under `tsc` because the key does not exist on the frozen literal).

- [ ] **Step 2: Change the protocol and the report's Options line**

In `apps/web/lib/medical-ai/medgemma-experiment.ts` change line 75 to:

```ts
  options: Object.freeze({ temperature: 0, seed: 7, num_predict: 4096, num_ctx: 8192 }),
```

In `apps/web/scripts/medgemma-local-experiment.mts` change the `["Options", ...]` entry to:

```ts
    ["Options", `think=${EXPERIMENT_PROTOCOL.think}, temperature=${EXPERIMENT_PROTOCOL.options.temperature}, seed=${EXPERIMENT_PROTOCOL.options.seed}, num_predict=${EXPERIMENT_PROTOCOL.options.num_predict}, num_ctx=${EXPERIMENT_PROTOCOL.options.num_ctx}, keep_alive=${EXPERIMENT_PROTOCOL.keepAlive}, document timeout ${EXPERIMENT_PROTOCOL.documentTimeoutMs / 1000} s`],
```

Run: `pnpm --dir apps/web exec vitest run tests/medgemma-experiment.test.ts && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: PASS; `tsc` prints nothing.

- [ ] **Step 3: Commit the protocol change (separately from the evidence)**

```bash
git add apps/web/lib/medical-ai/medgemma-experiment.ts apps/web/scripts/medgemma-local-experiment.mts apps/web/tests/medgemma-experiment.test.ts
git commit -m "chore(medical-ai): MedGemma experiment protocol adds num_ctx 8192 (digest changes)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 4: Run the experiment locally (manual, not CI)**

Preconditions: Ollama running at `http://127.0.0.1:11434` with `medgemma1.5:latest` pulled (`ollama list`), `pnpm install` done (Pretendard font), no other GPU load. The script writes its default report to `docs/status/<today>/medgemma-local-experiment.md`, which would overwrite Run 2's document — so always pass `--report`. From the repository root:

```bash
export PATH="$HOME/.gc-node24:$PATH"
ollama list | grep medgemma1.5
pnpm medical-ai:medgemma-experiment --report C:/Users/Jason/Documents/genome-companion-korea-ux/apps/web/build/medgemma/medgemma-local-experiment-run3.md
```

While the run is in progress (it takes roughly 5–8 minutes for 31 pages; Run 2 took 7 min 18 s) open a second shell and capture the memory placement once:

```bash
ollama ps > C:/Users/Jason/Documents/genome-companion-korea-ux/apps/web/build/medgemma/ollama-ps-run3.txt; cat C:/Users/Jason/Documents/genome-companion-korea-ux/apps/web/build/medgemma/ollama-ps-run3.txt
```

`ollama ps` prints `NAME  ID  SIZE  PROCESSOR  UNTIL`; the PROCESSOR column is the VRAM-offload fact to record verbatim (e.g. `100% GPU` or `18%/82% CPU/GPU`). If the run finishes before you capture it, rerun `ollama ps` within the 10-minute `keep_alive` window — the placement is the same.

After the run, collect from `apps/web/build/medgemma/medgemma-local-experiment-run3.md` (the "실행 환경" table and the "나란히"/"문서별" tables) and from `apps/web/build/medgemma/summary.json`:
- Run window, Ollama version, model id/blob, the new **protocol digest**, Options line (must show `num_ctx=8192`), GPU/driver, Node, corpus id `synthetic-ko-checkup-r2-e6befc286ae6ce1d`, corpus digest, corpus.json sha256 (changes in this wave because gold gained `expectedReferenceRangeText` — record the new value), script commit (the SHA of the Step 3 commit).
- Unreadable-document count (rows whose outcome is `unreadable` in the 문서별 table) and the `done_reason` distribution (the "done_reason on failed documents" row, e.g. `length=9` or `stop=2, length=3`).
- The model column of the 나란히 table: field F1, required abstention recall, hallucinated measurements (count and rate), critical value exact.
- `ollama ps` PROCESSOR column.

Nothing under `apps/web/build/` is committed.

- [ ] **Step 5: Record Run 3 in the evidence document**

Append to `docs/status/2026-09-17/medgemma-local-experiment.md` (before `## 한계`) a new section, filling every `<…>` from Step 4:

```markdown
## Run 3 (num_ctx 8192)

같은 코퍼스, 같은 채점기, 같은 프롬프트·스키마·시드. 바뀐 것은 `num_ctx: 8192`(이전 실행은 Ollama 기본값) 하나이며, 프로토콜 digest가 그에 따라 바뀌었다. 증거 전용이며 게이트가 아니다.

| Pin | Value |
|---|---|
| Run window | <start> → <end> |
| Protocol digest (prompt, schema, options) | <digest> |
| Options | think=false, temperature=0, seed=7, num_predict=4096, num_ctx=8192, keep_alive=10m, document timeout 180 s |
| Model | medgemma1.5:latest · id <id> · blob sha256:<blob> |
| Ollama | <version> at http://127.0.0.1:11434 |
| GPU / driver / `ollama ps` PROCESSOR | <name>, <driver>, <MiB> · `<PROCESSOR column verbatim>` |
| Corpus | synthetic-ko-checkup-r2-e6befc286ae6ce1d (25 documents); corpus.json sha256 <sha> (gold gained `expectedReferenceRangeText` this wave; PDF bytes unchanged) |
| Script commit | <sha of the protocol commit> |
| Unreadable documents | <n> |
| done_reason on failed documents | <distribution> |
| Full report (not committed) | apps/web/build/medgemma/medgemma-local-experiment-run3.md |

| Metric (model column) | Run 2 (num_predict 4096) | Run 3 (num_ctx 8192) |
|---|---|---|
| Field F1 | 56.9% | <value> |
| Required abstention recall | 40.0% | <value> |
| Hallucinated measurements | 21 (17.1%) | <count> (<rate>) |
| Unreadable documents | 9 (done_reason length=9) | <n> (<distribution>) |

관찰: <one or two sentences that state only what the numbers show — e.g. "미해독 문서 수는 9에서 <n>으로 바뀌었고 done_reason 분포는 <…>였다." Do not attribute the change to a cause; do not say the context budget "was" the bottleneck.> 실행 중 `ollama ps`는 `<PROCESSOR>`를 보고했다.
```

In the `## 한계` list append one bullet:

```markdown
- Run 3(num_ctx 8192)은 컨텍스트 길이 하나만 바꾼 1회 실행이다. 위 표의 수치 변화는 관찰일 뿐 원인을 증명하지 않으며, 세 실행 모두 evidence only이고 게이트가 아니다.
```

Append to `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md` after the "Pins recorded (re-run of 2026-09-17, current)" block a third block (and change that block's heading to `## Pins recorded (re-run of 2026-09-17, num_predict 4096)`):

```markdown
## Pins recorded (run 3 of 2026-09-17, num_ctx 8192, current)

- Ollama: `<version>` at `http://127.0.0.1:11434`.
- Model: `medgemma1.5:latest` · id `<id>` · blob `sha256:<blob>`.
- Evaluation script commit: `<sha>` (branch `codex/wave7-reference-range-delta`).
- Corpus commit: same script commit (corpus is generated on the fly, not stored in git).
- Corpus id / digest: `synthetic-ko-checkup-r2-e6befc286ae6ce1d` (25 documents); corpus digest `<corpus digest>`; corpus.json sha256 `<sha>` (gold gained `expectedReferenceRangeText`; PDF bytes unchanged).
- Run window: `<start>` → `<end>` (UTC).
- Protocol digest (prompt, schema, options): `<digest>`; options `num_predict=4096`, `num_ctx=8192` (added), prompt unchanged from run 2.
- GPU / driver: `<name>`, driver `<driver>`, `<MiB>`; `ollama ps` PROCESSOR `<verbatim>`.
- Observed: unreadable documents `<n>` (done_reason `<distribution>`), field F1 `<value>`, hallucinated measurements `<count> (<rate>)`. Observation only; no cause is claimed.
- Full report: `docs/status/2026-09-17/medgemma-local-experiment.md` §Run 3.
```

- [ ] **Step 6: Verify nothing generated is staged, then commit the evidence**

```bash
git status --short   # must show only the two documents; apps/web/build is ignored
git add docs/status/2026-09-17/medgemma-local-experiment.md governance/founder-medgemma-local-evaluation-approval-2026-09-16.md
git commit -m "docs: MedGemma local experiment run 3 (num_ctx 8192) — pins and observations only

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

If Ollama or the model is unavailable on this machine, stop after Step 3, leave Step 4–6 unchecked, and say so in `docs/status/2026-09-17/wave3.md` (Task 10) under Limits: "Run 3 not executed: <reason>". Never fabricate a run.

### Task 10: Gates, evidence document `wave3.md`, one-line ledger amendments

**Files:**
- Create: `docs/status/2026-09-17/wave3.md`
- Modify: `AGENTS.md:15`
- Modify: `PROJECT_GUIDE.md:58,155-156`
- Modify: `docs/roadmap/2026-09-02-roadmap.md:21` (append row A12)

**Interfaces:**
- Consumes: every earlier task's commits; the gate outputs below.
- Produces: the evidence document and the three ledger lines the governance note authorises (`governance/intended-use-decision-reference-range-and-delta-2026-09-17.md` "Rule amendments this decision authorises"). `release/readiness.json` is not touched.

- [ ] **Step 1: Run every gate and keep the exact output lines**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux
export PATH="$HOME/.gc-node24:$PATH"
export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'
export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'
pnpm security:runtime-policy
pnpm release:readiness:validate
pnpm security:github-actions-policy
pnpm web:test
pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json
pnpm --dir apps/web build
pnpm auth-security:gate
./gradlew.bat cleanTest test --no-daemon
pnpm medical-ai:native-text-gate
pnpm foundation:e2e
```

Expected: `runtime-policy: PASS`, `release-readiness: NO_GO ...` (exit 0, verdict unchanged), `github-actions-policy: PASS`, vitest `Test Files N passed`, empty `tsc` output, Next build success, `auth-security-gate: PASS`, `BUILD SUCCESSFUL` with the core-api count (Wave 2C had 113 tests; this wave adds `ChangeDeltaTest` (8) and three integration/projection tests), native-text-gate JSON with `"referenceRangeAccuracy": 1`, `"passed": true`, `"corpusId": "synthetic-ko-checkup-r2-e6befc286ae6ce1d"`, and `3 passed` from Playwright. Copy the exact lines into the table below. `git status --short` must show only `apps/web/next-env.d.ts` (never staged).

- [ ] **Step 2: Write the evidence document**

Create `docs/status/2026-09-17/wave3.md` (replace every `<…>` with the recorded output):

```markdown
# Wave 3 evidence — reference-range preservation, deterministic differences, export v2, MedGemma num_ctx, 내 데이터 minors (2026-09-17)

Branch `codex/wave7-reference-range-delta` (stacked on PR #10). Synthetic only. Release remains NO_GO; no readiness gate or verdict changed. Gate document for items (a)(b): `governance/intended-use-decision-reference-range-and-delta-2026-09-17.md`, committed before any (a)(b) code.

## What exists now
- **(a) Reference-range text, stored and exported only.** The worker keeps the range body printed on a row (`ParsedCandidate.referenceRangeText`, ≤ 40 characters, digits/separators/comparison signs, label and brackets stripped); the boundary DTO validates the same shape; V10 stores it on `gc_candidate.reference_range_text` and copies it to `gc_health_record_version.reference_range_text` at confirmation; a correction inherits it and no request field can change it. It is returned by no API except `GET /api/foundation/health-events/export` and appears on no screen. PostgreSQL test: the candidate list, records, health-events and changes bodies contain no key matching `reference` (case-insensitive); the Playwright lifecycle asserts `120-199` is absent from the review, home, records and 내 데이터 screens and present once in the export. Value/unit parsing is unchanged: native-text gate F1 = 1, `referenceRangeAccuracy` = 1 on the same `corpusId`.
- **(b) Deterministic differences.** `ChangeItem.delta = { absolute, percent }` from `ChangeDeltaCalculator` (BigDecimal subtraction at the larger input scale; percent of the previous value HALF_EVEN to one decimal; null when the previous value is zero, the unit differs or a value is not numeric). The home line reads `두 값의 차이: -6 mg/dL (-3.1%)`; no direction word, arrow, colour or threshold, and the copy scan now forbids 상승/하락/증가/감소 in every user-facing file.
- **Export v2.** `schemaVersion: alm-health-events-export.v2`; `events[]` = HealthEvent + `referenceRangeText` + `originalValue`/`correctionReason`/`originalObservedOn`; `documents[]` = every COMPLETED document of the owner plus every document with events, sorted by id, each with `eventCount` (a fully excluded document lists with `eventCount 0`). Headers, filename and the count-free audit row are unchanged.
- **내 데이터 minors.** The evidence drawer shows 수정 이력 (원래 값 · 이유 · 원래 검사일, or 수정 없음); `SourcePreview` states which page the value came from and that the image is the first page; jest-axe passes on the empty and the error state; a cell that arrives after a reload plays one fade/scale animation, none under `prefers-reduced-motion: reduce`.
- **MedGemma Run 3.** Protocol option `num_ctx: 8192` (new digest `<digest>`); results recorded as observations in `docs/status/2026-09-17/medgemma-local-experiment.md` §Run 3 and the third pins block of the approval note. <or: "Run 3 not executed: <reason>.">

## Evidence (local, 2026-09-17)
| Gate | Result |
|---|---|
| runtime-policy | `<line>` |
| readiness validate | `<line>` (exit 0; verdict unchanged) |
| github-actions-policy | `<line>` |
| web:test | `<Test Files … / Tests …>` |
| tsc --noEmit | no output (exit 0) |
| web build | `<line>` |
| auth-security gate | `<line>` |
| gradlew cleanTest test (embedded PostgreSQL) | `<BUILD SUCCESSFUL …>`; core-api `<n>` tests, worker `<n>`, benchmark `<n>` |
| medical-ai:native-text-gate | `"corpusId": "<id>"`, `"fieldF1": 1`, `"referenceRangeAccuracy": 1`, `"passed": true` |
| foundation:e2e | `<n passed (…)>` |

## Limits
No hosted run. The reference-range text is document text preserved for the person's own file; the product neither shows it nor relates any value to it, and the founder's regulatory judgement covers synthetic staging only — any display, comparison, trend or direction language needs a new decision and a regulatory review. The difference is arithmetic on two stored values and carries no meaning. The MedGemma run is evidence only (handoff conditions 2–7 open); its numbers are observations, not causes. Readiness is unchanged.
```

- [ ] **Step 3: The three ledger lines**

`AGENTS.md` line 15 becomes:

```markdown
- Diagnosis, normal/abnormal, reference ranges in UI copy, comparisons or derived states, risk, treatment, medication, alerts, or autonomous clinical action in code or copy: stop. (Storing and exporting a document's own reference-range text verbatim is permitted by `governance/intended-use-decision-reference-range-and-delta-2026-09-17.md`; nothing else about ranges is.)
```

`PROJECT_GUIDE.md` §6 rule 5 becomes:

```markdown
5. Do not add diagnosis, normality, risk prediction, treatment, medication, or autonomous clinical
   actions without a new intended-use decision and regulatory review (latest decision:
   `governance/intended-use-decision-reference-range-and-delta-2026-09-17.md` — verbatim
   reference-range preservation and arithmetic value differences only).
```

`PROJECT_GUIDE.md` §2 "Core API" row: append to the cell, before its closing `|`:

```markdown
 Since Wave 3 it also keeps a row's printed reference-range text for the person's own export only and attaches a signed arithmetic difference to each what-changed item (`docs/status/2026-09-17/wave3.md`).
```

`docs/roadmap/2026-09-02-roadmap.md`: append after row A11:

```markdown
| A12 | Reference-range text preserved verbatim (worker → V10 → export v2 only; never displayed or compared), signed arithmetic difference on 최근 변화, export lists every COMPLETED document with `eventCount`, MedGemma run 3 at `num_ctx 8192` as evidence, 내 데이터 minors (수정 이력, page-aware preview, axe on empty/error, reduced-motion-aware arrival) | `docs/status/2026-09-17/wave3.md` | implemented locally |
```

- [ ] **Step 4: Copy scan and final check**

Run: `pnpm --dir apps/web exec vitest run tests/korean-ux-copy.test.ts && git status --short`
Expected: PASS; only `apps/web/next-env.d.ts` unstaged.

- [ ] **Step 5: Commit (PR deferred, local gates only)**

```bash
git add docs/status/2026-09-17/wave3.md AGENTS.md PROJECT_GUIDE.md docs/roadmap/2026-09-02-roadmap.md
git commit -m "docs: Wave 3 evidence — reference-range preservation, deterministic differences, export v2, MedGemma num_ctx, 내 데이터 minors

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** §1 boundaries → Global Constraints, Task 2 (no `reference` key test), Task 6 (copy scan), Task 8 (screens). §2 worker/DTO → Task 1; V10, rows, copy on confirm, inherit on correction, no DTO field → Task 2; export `referenceRangeText` + v2 → Task 3; benchmark gold/`referenceRangeAccuracy`/gate/corpusId → Task 4. §3 delta rules, unit tests (integer, decimal, negative, zero previous, comma, unparsable) → Task 5; web line, zod, copy scan → Task 6. §4 document list with `eventCount`, excluded-document test → Task 3. §5 `num_ctx 8192`, manual run, Run 3 section, pins block, observation-only wording → Task 9. §6 HealthEvent fields + drawer, `SourcePreview` page (one test), axe empty/error (two tests), arrival animation with reduced-motion test → Task 7. §7 tests and evidence, roadmap/guide/AGENTS lines, readiness unchanged → Tasks 8 and 10. §8 out of scope: nothing here displays or compares a range, narrates a trend, or adds a provider.

**Placeholders.** The only `<…>` markers are in Task 9 Step 5 and Task 10 Step 2, where the value is a measured output the implementer records after running the command named in the same step.

**Type consistency.** `referenceRangeText` is the name on `ParsedCandidate`, `ExtractedCandidate`, `NormalizedCandidate`, `FoundationCandidateRow`, `FoundationRecordRow`, `ExportedHealthEvent`, `RunCandidate` and the zod `extractedMeasurementSchema`; the gold side is `expectedReferenceRangeText` on `GoldMeasurement` and `expectedMeasurementSchema`. `ChangeDelta(absolute, percent)` / `ChangeDeltaCalculator.compute(latest, previous)` are used identically in Tasks 5, 6 and 8. `HealthEvent.originalValue/correctionReason/originalObservedOn` match between Task 3 (Kotlin), Task 7 (zod, fixture, drawer) and Task 8 (browser). `ExportedDocument.eventCount` matches Tasks 3 and 8. Test ids `change-item`/`change-delta` match Tasks 6 and 8.

**Resolved ambiguities** (spec wording → decision): "NativeTextRunner 출력에 referenceRangeAccuracy" → runs carry per-candidate `referenceRangeText`; the metric lives in the only scorer (`evaluation.ts`) and its report. "`SourcePreview`가 `page`를 실제로 사용" → the core serves one first-page PNG, so the component names the page and says the image is the first page (no new endpoint). `originalObservedOn` = V8 value, i.e. null when the date was not corrected. The existing `carriesNoInterpretationFields` test forbade the field name `delta`; the spec now authorises it, so `difference`/`delta` leave that list. Newly arrived cells = ids absent from the previous successful load in the same mounted page (none on first load).
