# Wave 2B — MedGemma 1.5 local synthetic evaluation, labelled-date handling, date correction and benchmark determinism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The worker only accepts a labelled exam date (label anywhere in the line) and abstains for the whole document when labelled dates disagree; a person can correct the exam date of a candidate during review and the record keeps both dates; the benchmark corpus is byte-reproducible with a digest-bearing `corpusId`, gains a birth-date-first document and a `render-pages` CLI; and a manual, local-only script sends the rendered pages to MedGemma 1.5 on Ollama (`127.0.0.1:11434`), scores the model with the same evaluator as the parser and writes a side-by-side evidence report.

**Architecture:** Spring stays the authority. Worker: `NativeTextExtractionProvider.resolveObservedOn` returns `Missing | Found | Conflicting`; conflict yields one document-level `ambiguous_value` abstention and zero candidates. Core: V8 adds `gc_health_record.original_observed_on`; `POST /candidates/{id}/confirmation` takes an optional `observedOn`; `RecordReceipt` exposes `originalObservedOn` and `reviewDecision = CORRECTED` when value or date differs; audit rows carry no date. Web: `CandidateReview` gains a "검사일 수정" form (same pattern as value correction), records show "사용자가 검사일을 수정함 · 원래 YYYY. M. D.". Benchmark: fixed PDFBox document id/info dates, `corpusId = synthetic-ko-checkup-r2-<pdf digest 16 hex>`, `render-pages` (PDFBox `PDFRenderer`, 150 dpi) and `export-concepts` CLIs. Experiment: `apps/web/lib/medical-ai/medgemma-experiment.ts` (pure functions: protocol constants + digest, Ollama client pinned to `127.0.0.1:11434`, row → `medical-document-run.v1` mapping with page-level box), `medgemma-report.ts` (side-by-side renderer via `compareMedicalDocumentPipelines`, per-document/per-field breakdown), `apps/web/scripts/medgemma-local-experiment.mts` (manual runner, not in CI). Model output never enters product code.

**Tech Stack:** Kotlin 2.3.21 / Java 21 / Gradle 8.14.3 (`./gradlew.bat`), PDFBox 3.0.8, Spring Boot 3.5.16 + JdbcTemplate + Flyway + Bean Validation, JUnit 5 + AssertJ; Next 16.3.3 / React 19 / zod 4 / vitest + Testing Library + msw + jest-axe / Playwright; pnpm 11.20.0, Node 24.20.0; Ollama 0.34.1 with `medgemma1.5:latest` (model id `433252621ab1…`, blob `sha256-a051c2bd4ab8d5b7f4df8eec344f2fdd603efb2d098da799dc16c95e9e8bc838`, gemma3 4.3B Q4_K_M, vision); Pretendard-Regular.ttf (OFL) from `apps/web/node_modules/pretendard`.

Spec: `docs/superpowers/specs/2026-09-17-wave2b-medgemma-eval-and-date-handling-design.md`. Approval: `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md`. Handoff context: `docs/implementation/medical-document-runner.md` (only condition 1 is met; 2–7 stay open).

## Global Constraints

- Toolchain: Node `24.20.0`, pnpm `11.20.0`, Java `21`. In every Git Bash shell first run `export PATH="$HOME/.gc-node24:$PATH"`. Gradle is `./gradlew.bat` from the repository root `C:/Users/Jason/Documents/genome-companion-korea-ux` (no whitespace in the path).
- Embedded PostgreSQL 16 (trust auth, port 5432) holds synthetic rows only. Env-gated JVM tests need `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'` and Gradle needs `cleanTest` before `test` to re-run them. `pnpm foundation:e2e` needs `export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'` in addition.
- Branch: everything goes on `codex/wave5-medgemma-eval-and-dates` (already checked out in this worktree). Never push to `main`. The PR is deferred (Task 12 ends with local gates only).
- Model output never enters product code: core, worker and web runtimes call no model. The experiment is a manual CLI (`pnpm medical-ai:medgemma-experiment`), never a CI step and never a gate; thresholds are reported, not interpreted as pass/fail. `release/readiness.json` and the "OCR·의료 AI 비활성" statement do not change.
- The experiment script talks only to `http://127.0.0.1:11434` (local Ollama); it deletes `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` from its own environment and refuses any other origin. Synthetic documents only; no real PHI, no real document.
- The prompt asks the model only to transcribe label, value, unit, labelled exam date and page; it forbids diagnosis, normal/abnormal, reference ranges, risk, treatment. Any `referenceRange` (or any other extra key) the model returns is dropped before the run JSON is written; run JSON never contains `referenceRange`.
- Model run JSON and raw model replies stay under `apps/web/build/medgemma/` (gitignored `build/`). Only the summary report (`docs/status/2026-09-17/medgemma-local-experiment.md`) is committed. Never commit a PDF or PNG.
- Evidence localization for the model run is reported as "측정 불가 (페이지 전체 박스)": the model gets no box, so the run uses the whole-page box `(0,0,1,1)`; the evaluator still computes IoU but the report greys that column out.
- Worker date rule: only a labelled date counts (`검사일`, `검진일`, `채취일`, `검사 일자`, `검진 일자`, `채취 일자`, `Date`, `Exam date`, `Test date`, `Collection date`; case-insensitive; label anywhere in the line; the date is the first date after the label). A bare date is never used. Two or more distinct labelled dates → one document-level abstention `("문서 전체", ambiguous_value)` and zero candidates. No labelled date → every recognised row is `missing_evidence` (existing rule). The two demo PDFs carry `Date:` and keep parsing.
- Date correction is a user confirmation of what the document says, not clinical validation. Accepted range `1900-01-01`..today (Asia/Seoul). Audit rows never contain a date value or a health value.
- No diagnosis, normal/abnormal, reference range, trend, risk, treatment, medication or model inference anywhere in code or copy (PROJECT_GUIDE §6). Korean user-facing copy; never render raw server enums; forbidden terms in `apps/web/tests/korean-ux-copy.test.ts` apply to every component. Exact new copy (spec §5): form label "검사일 수정", help "결과지에 적힌 검사일과 다르면 고쳐 주세요. 값의 의미는 판단하지 않아요.", record sentence "사용자가 검사일을 수정함 · 원래 2026. 1. 15." (date via `formatKoreanDate`), document-level date conflict "검사일이 둘 이상이라 확실하지 않음".
- Benchmark output stays under `packages/korean-checkup-benchmark/build/corpus` (gitignored). `pnpm medical-ai:native-text-gate` must keep F1 = 1 (25 documents after Task 3).
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Gates before finishing: `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `pnpm web:test`, `pnpm --dir apps/web build`, `pnpm auth-security:gate`, `pnpm security:github-actions-policy`, `./gradlew.bat cleanTest test --no-daemon` with `GC_TEST_POSTGRES_URL`, `pnpm medical-ai:native-text-gate`, `pnpm foundation:e2e`.

---

## File map

| Path | Responsibility |
|---|---|
| `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt` (modify) | `DateResolution`, `resolveObservedOn`, label-anywhere regex, first-date-after-label, document-level `ambiguousDate` outcome |
| `apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProviderTest.kt` (modify) | labelled-only, mid-line label, birth-date-first, same date twice, conflicting dates |
| `apps/web/lib/format/status-labels.ts` (modify) | `documentDateConflictLabel`, `describeAbstention`, `describeReviewDecision`, `labelReviewOutcome` |
| `apps/web/lib/format/observed-on.ts` (create) | `localIsoDate`, `isCorrectableObservedOn` |
| `apps/web/components/integrated/IntegratedHealthExperience.tsx` (modify) | `describeAbstention` on the zero-candidate screen; `confirmCandidate(value, observedOn?)`; `labelReviewOutcome` in the saved list |
| `apps/web/components/integrated/CandidateReview.tsx` (modify) | "검사일 수정" form; `onConfirm(value, observedOn?)` |
| `apps/web/components/integrated/IntegratedRecords.tsx` (modify) | `describeReviewDecision(record)` sentence |
| `apps/web/lib/foundation/client.ts` (modify) | `recordSchema.originalObservedOn`; `confirmCandidate(candidateId, value, idempotencyKey, observedOn?)` |
| `apps/web/tests/fixtures/foundation.ts`, `tests/integrated-review-loop.test.tsx`, `tests/candidate-review.test.tsx`, `tests/integrated-records-grouping.test.tsx`, `tests/korean-ux-copy.test.ts`, `tests/status-labels.test.ts`, `stories/VisitPreparation.stories.tsx` (modify); `tests/abstention-copy.test.ts`, `tests/observed-on.test.ts` (create) | web unit tests and fixtures |
| `apps/web/e2e/foundation-lifecycle.spec.ts` (modify) | one date correction in the browser lifecycle |
| `apps/core-api/src/main/resources/db/migration/V8__record_original_observed_on.sql` (create) | `gc_health_record.original_observed_on DATE NULL` + check |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt` (modify) | `CandidateConfirmationRequest.observedOn` |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt` (modify) | `confirmCandidate(..., confirmedObservedOn)`, `resolveConfirmedObservedOn`, `RecordReceipt.originalObservedOn`, decision rule |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt` (modify) | row field, projection, `createRecordFromCandidate(observedOn)` |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/HealthEventProjection.kt` (modify) | `corrected` includes the date |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt` (modify) | date-correction lifecycle test |
| `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/CheckupCorpusGenerator.kt` (modify) | `Variant.birthDateFirst`, `BIRTH_DATE_VARIANT`, `pinnedDocument()` |
| `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/CorpusWriter.kt` (modify) | `corpusId` from the PDF digest |
| `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/PageRenderer.kt` (create) | `render-pages` implementation |
| `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/BenchmarkMain.kt` (modify) | `render-pages`, `export-concepts` subcommands |
| `packages/korean-checkup-benchmark/src/test/kotlin/kr/co/genomecompanion/benchmark/{CheckupCorpusGeneratorTest,NativeTextRunnerTest}.kt` (modify), `PageRendererTest.kt` (create) | 25 documents, determinism, renderer |
| `apps/web/lib/medical-ai/medgemma-experiment.ts` (create) | protocol constants + digest, Ollama client (origin lock), model reply schema, catalogue normalization, row → run mapping |
| `apps/web/lib/medical-ai/medgemma-report.ts` (create) | breakdown + markdown renderer |
| `apps/web/tests/medgemma-experiment.test.ts`, `apps/web/tests/medgemma-report.test.ts` (create) | unit tests with a mocked `fetch` |
| `apps/web/scripts/medgemma-local-experiment.mts` (create) | manual runner |
| `apps/web/scripts/native-text-gate.mts`, `.github/workflows/ci.yml` (modify) | review minors |
| `package.json`, `apps/web/package.json` (modify) | `medical-ai:medgemma-experiment` |
| `docs/status/2026-09-17/medgemma-local-experiment.md`, `docs/status/2026-09-17/wave2b.md` (create); `docs/status/2026-09-16/wave2a-native-text.md`, `docs/revision/ASTRA_PRODUCT_REBUILD.md` §28, `docs/roadmap/2026-09-02-roadmap.md`, `PROJECT_GUIDE.md` §2 (modify) | evidence and ledger |

---

### Task 1: Worker — labelled-date-only, label anywhere, conflicting dates abstain

**Files:**
- Modify: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt:49-53,71,88-90,161-172`
- Test: `apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProviderTest.kt`

**Interfaces:**
- Consumes: existing `parse(lines)`, `ParsedAbstention`, `AbstentionReason`, `DOCUMENT_LABEL = "문서 전체"`.
- Produces: `internal sealed interface DateResolution { Missing; Found(date: LocalDate); Conflicting(dates: List<LocalDate>, evidencePage: Int) }`, `internal fun resolveObservedOn(lines: List<TextLine>): DateResolution`. A conflicting document yields `ExtractionOutcome(candidates = [], abstentions = [ParsedAbstention("문서 전체", AMBIGUOUS_VALUE, <page of first labelled line>)], observedOn = null)`. Task 2 renders that abstention; Task 3's benchmark document relies on the mid-line label rule.

- [ ] **Step 1: Add the failing tests**

Append inside `class NativeTextExtractionProviderTest` (before `private fun lines(vararg texts: String)`):

```kotlin
    @Test
    fun `ignores a bare date when no labelled date exists`() {
        val outcome = NativeTextExtractionProvider.parse(lines("발급 2026-09-01", "AST 24 U/L"))

        assertThat(outcome.observedOn).isNull()
        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(ParsedAbstention("AST", AbstentionReason.MISSING_EVIDENCE, 1))
    }

    @Test
    fun `finds the labelled date anywhere in a two-column line and skips a birth date printed first`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("생년월일: 1987-03-14", "수검자 합성-6 검사일: 2026-01-20", "AST 24 U/L"),
        )

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 1, 20))
        assertThat(outcome.candidates.single().observedOn).isEqualTo(LocalDate.of(2026, 1, 20))
        assertThat(outcome.abstentions).isEmpty()
    }

    @Test
    fun `takes the first date after the label, not an earlier date on the same line`() {
        val outcome = NativeTextExtractionProvider.parse(lines("발급 2026-09-01 Exam date 2026.07.28", "AST 24 U/L"))

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
    }

    @Test
    fun `accepts the same labelled date printed twice`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일 2026-07-28", "채취일: 2026년 7월 28일", "AST 24 U/L"),
        )

        assertThat(outcome.observedOn).isEqualTo(LocalDate.of(2026, 7, 28))
        assertThat(outcome.candidates).hasSize(1)
    }

    @Test
    fun `abstains for the whole document with zero candidates when labelled dates disagree`() {
        val outcome = NativeTextExtractionProvider.parse(
            lines("검사일 2026-07-28", "채취일 2026-07-27", "AST 24 U/L", "ALT 19 U/L"),
        )

        assertThat(outcome.observedOn).isNull()
        assertThat(outcome.candidates).isEmpty()
        assertThat(outcome.abstentions).containsExactly(
            ParsedAbstention(NativeTextExtractionProvider.DOCUMENT_LABEL, AbstentionReason.AMBIGUOUS_VALUE, 1),
        )
    }

    @Test
    fun `does not treat a word that merely contains date letters as a label`() {
        val outcome = NativeTextExtractionProvider.parse(lines("Update 2026-09-01", "AST 24 U/L"))

        assertThat(outcome.observedOn).isNull()
    }
```

- [ ] **Step 2: Run the worker tests to see the new ones fail**

Run:
```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :apps:document-worker:cleanTest :apps:document-worker:test --no-daemon --tests "kr.co.genomecompanion.documentworker.NativeTextExtractionProviderTest"
```
Expected: `BUILD FAILED` with at least `ignores a bare date when no labelled date exists() FAILED`, `abstains for the whole document with zero candidates when labelled dates disagree() FAILED`, `does not treat a word that merely contains date letters as a label() FAILED` (the current parser falls back to the first bare date).

- [ ] **Step 3: Implement the resolution**

In `NativeTextExtractionProvider.kt` replace the KDoc (lines 49–53) with:

```kotlin
/**
 * Deterministic text-layer parser. No OCR, no model, no network: PDFBox yields positioned lines,
 * a row grammar yields `label value unit`, and the document date comes only from a labelled date
 * (검사일/검진일/채취일/Date…, label anywhere in the line, first date after the label). A bare date is
 * never used; two different labelled dates make the whole document ambiguous.
 * Labels stay raw (core normalizes); reference-range text on a row is only excluded from the value.
 */
```

Replace line 71 (`private val dateLabel = …`) with:

```kotlin
    private val dateLabel = Regex(
        "(?:검사\\s*일자|검진\\s*일자|채취\\s*일자|검사일|검진일|채취일|" +
            "(?<![A-Za-z])(?:exam\\s+|test\\s+|collection\\s+)?date(?![A-Za-z]))\\s*[:：]?",
        RegexOption.IGNORE_CASE,
    )
```

Replace lines 88–90 (`internal fun parse(lines…` through `val observedOn = findObservedOn(lines)`) with:

```kotlin
    internal fun parse(lines: List<TextLine>): ExtractionOutcome {
        if (lines.isEmpty()) return unreadable()
        val observedOn = when (val resolution = resolveObservedOn(lines)) {
            is DateResolution.Conflicting -> return ambiguousDate(resolution.evidencePage)
            is DateResolution.Found -> resolution.date
            DateResolution.Missing -> null
        }
```

Replace `findObservedOn` and `dateIn` (lines 161–172) with:

```kotlin
    internal sealed interface DateResolution {
        data object Missing : DateResolution
        data class Found(val date: LocalDate) : DateResolution
        data class Conflicting(val dates: List<LocalDate>, val evidencePage: Int) : DateResolution
    }

    /** Every `(label, date-after-label)` pair in the document; only their distinct dates decide. */
    internal fun resolveObservedOn(lines: List<TextLine>): DateResolution {
        val labelled = lines.flatMap { line ->
            dateLabel.findAll(line.text).mapNotNull { match ->
                dateIn(line.text.substring(match.range.last + 1))?.let { date -> date to line.page }
            }.toList()
        }
        val distinct = labelled.map { it.first }.distinct()
        return when (distinct.size) {
            0 -> DateResolution.Missing
            1 -> DateResolution.Found(distinct.single())
            else -> DateResolution.Conflicting(distinct, labelled.first().second)
        }
    }

    /** The earliest date in [text] across the three spellings, or null. */
    private fun dateIn(text: String): LocalDate? =
        datePatterns.mapNotNull { it.find(text) }.minByOrNull { it.range.first }?.let { match ->
            runCatching {
                LocalDate.of(match.groupValues[1].toInt(), match.groupValues[2].toInt(), match.groupValues[3].toInt())
            }.getOrNull()
        }

    private fun ambiguousDate(evidencePage: Int) = ExtractionOutcome(
        candidates = emptyList(),
        abstentions = listOf(ParsedAbstention(DOCUMENT_LABEL, AbstentionReason.AMBIGUOUS_VALUE, evidencePage)),
        observedOn = null,
    )
```

- [ ] **Step 4: Run the worker tests**

Run the same Gradle command as Step 2.
Expected: `BUILD SUCCESSFUL`; all `NativeTextExtractionProviderTest` tests pass, including the two demo-PDF tests (they carry `Date:`) and `prefers a labelled date over an earlier bare date and accepts dotted dates`.

- [ ] **Step 5: Run the benchmark tests (the corpus prints only labelled dates, so they must still pass)**

Run:
```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :packages:korean-checkup-benchmark:cleanTest :packages:korean-checkup-benchmark:test --no-daemon
```
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProviderTest.kt && git commit -m "feat(worker): accept only labelled exam dates, label anywhere in the line; conflicting dates abstain for the whole document

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 2: Web — copy for the document-level date conflict

**Files:**
- Modify: `apps/web/lib/format/status-labels.ts` (append after `labelAbstentionReason`)
- Modify: `apps/web/components/integrated/IntegratedHealthExperience.tsx:19,525`
- Create: `apps/web/tests/abstention-copy.test.ts`
- Modify: `apps/web/tests/korean-ux-copy.test.ts` (inside the `describe`)

**Interfaces:**
- Consumes: `FoundationAbstention` from `@/lib/foundation/client` (fields `label`, `reason`, `evidencePage?`).
- Produces: `export const documentDateConflictLabel = "검사일이 둘 이상이라 확실하지 않음"`; `export function describeAbstention(abstention: Pick<FoundationAbstention, "label" | "reason">): string`.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/abstention-copy.test.ts`:
```ts
import { expect, it } from "vitest";
import { describeAbstention, documentDateConflictLabel } from "@/lib/format/status-labels";

it("names the document-level date conflict in Korean and keeps the reason map for every other row", () => {
  expect(documentDateConflictLabel).toBe("검사일이 둘 이상이라 확실하지 않음");
  expect(describeAbstention({ label: "문서 전체", reason: "ambiguous_value" })).toBe("검사일이 둘 이상이라 확실하지 않음");
  expect(describeAbstention({ label: "문서 전체", reason: "unreadable" })).toBe("글자 정보를 읽을 수 없음");
  expect(describeAbstention({ label: "LDL 콜레스테롤", reason: "ambiguous_value" })).toBe("값이 여러 개로 읽힘");
  expect(describeAbstention({ label: "AST", reason: "missing_evidence" })).toBe("검사일을 찾지 못함");
});
```

Add to the `describe` in `apps/web/tests/korean-ux-copy.test.ts` (after the `"tells the reviewer …"` test):
```ts
  it("describes a document whose labelled dates disagree without a raw reason code", () => {
    expect(source("lib/format/status-labels.ts")).toContain("검사일이 둘 이상이라 확실하지 않음");
    expect(source("components/integrated/IntegratedHealthExperience.tsx")).toContain("describeAbstention(item)");
    expect(source("components/integrated/IntegratedHealthExperience.tsx")).not.toContain("labelAbstentionReason(item.reason)");
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/abstention-copy.test.ts tests/korean-ux-copy.test.ts`
Expected: FAIL — `abstention-copy.test.ts` cannot resolve `describeAbstention`; the copy scan fails on the missing `describeAbstention(item)`.

- [ ] **Step 3: Implement**

Append to `apps/web/lib/format/status-labels.ts`:
```ts
/** The worker reports two different labelled dates as one document-level ambiguous_value abstention. */
export const documentDateConflictLabel = "검사일이 둘 이상이라 확실하지 않음";

export function describeAbstention(abstention: Pick<FoundationAbstention, "label" | "reason">) {
  if (abstention.label === "문서 전체" && abstention.reason === "ambiguous_value") return documentDateConflictLabel;
  return labelAbstentionReason(abstention.reason);
}
```

In `apps/web/components/integrated/IntegratedHealthExperience.tsx` change the import at line 19 from `labelAbstentionReason,` to `describeAbstention,` (keep the other imported names) and line 525 from `<span>{labelAbstentionReason(item.reason)}</span>` to `<span>{describeAbstention(item)}</span>`.

- [ ] **Step 4: Run the tests**

Run the Step 2 command.
Expected: `Test Files 2 passed (2)`.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/web/lib/format/status-labels.ts apps/web/components/integrated/IntegratedHealthExperience.tsx apps/web/tests/abstention-copy.test.ts apps/web/tests/korean-ux-copy.test.ts && git commit -m "feat(web): name the document-level exam-date conflict in Korean

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Benchmark — birth-date-first document (25 documents)

**Files:**
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/CheckupCorpusGenerator.kt:31-40,91-92,113-120,293-302`
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/CorpusWriter.kt:54`
- Test: `packages/korean-checkup-benchmark/src/test/kotlin/kr/co/genomecompanion/benchmark/CheckupCorpusGeneratorTest.kt`, `NativeTextRunnerTest.kt`

**Interfaces:**
- Produces: `Variant.birthDateFirst: Boolean = false`; `CheckupCorpusGenerator.BIRTH_DATE_VARIANT` (index 6, Korean labels, ISO date, range column); `CheckupCorpusGenerator.BIRTH_DATE = "1987-03-14"`; `DATES[6] = "2026-01-20"`; `generateAll()` returns 25 documents, the last being `synthetic-hospital-two-column-v6`. Tasks 4, 8 and 10 count 25 documents / 31 pages.

- [ ] **Step 1: Write the failing tests**

In `CheckupCorpusGeneratorTest.kt` change `assertThat(documents).hasSize(24)` to `hasSize(25)` and `.isEqualTo(24L)` to `.isEqualTo(25L)`. Append to the `is deterministic for a fixed seed and covers the variant axes` test (before its closing brace):
```kotlin
        val birthDateFirst = generator.generate(Layout.HOSPITAL_TWO_COLUMN, CheckupCorpusGenerator.BIRTH_DATE_VARIANT)
        assertThat(birthDateFirst.documentId).isEqualTo("synthetic-hospital-two-column-v6")
        assertThat(birthDateFirst.observedOn).isEqualTo("2026-01-20")
        val printed = NativeTextExtractionProvider.extractLines(birthDateFirst.bytes).map { it.text }
        assertThat(printed).contains("생년월일: 1987-03-14")
        assertThat(printed.indexOfFirst { it.startsWith("생년월일") })
            .isLessThan(printed.indexOfFirst { it.startsWith("수검자 합성-6") && it.endsWith("검사일: 2026-01-20") })
        val parsedBirthDateFirst = NativeTextExtractionProvider.extract(birthDateFirst.bytes)
        assertThat(parsedBirthDateFirst.observedOn).isEqualTo(java.time.LocalDate.of(2026, 1, 20))
        assertThat(parsedBirthDateFirst.candidates).hasSize(8)
        assertThat(CorpusWriter.gold(birthDateFirst).expectedMeasurements.map { it.observedAt }).containsOnly("2026-01-20")
        assertThat(generator.generateAll().last().documentId).isEqualTo("synthetic-hospital-two-column-v6")
```
In `NativeTextRunnerTest.kt` change `assertThat(runs).hasSize(24)` to `hasSize(25)` and append before `val json = …`:
```kotlin
        val birthDateFirst = runs.first { it.documentId == "synthetic-hospital-two-column-v6" }
        assertThat(birthDateFirst.candidates.map { it.observedAt }).containsOnly("2026-01-20")
        assertThat(birthDateFirst.abstentions).isEmpty()
```

- [ ] **Step 2: Run the benchmark tests to see them fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :packages:korean-checkup-benchmark:cleanTest :packages:korean-checkup-benchmark:test --no-daemon`
Expected: compilation error `Unresolved reference: BIRTH_DATE_VARIANT`.

- [ ] **Step 3: Implement**

`CheckupCorpusGenerator.kt` — `Variant` gains a defaulted field:
```kotlin
data class Variant(
    val index: Int,
    val englishLabels: Boolean,
    val lowercaseUnits: Boolean,
    val extraDecimal: Boolean,
    val dateStyle: DateStyle,
    val rangeColumn: Boolean,
    val rangeSeparator: String,
    val thousandsComma: Boolean,
    /** Print a 생년월일 line first and the labelled 검사일 later, mid-line (first-date mistakes are scored). */
    val birthDateFirst: Boolean = false,
)
```
`generateAll()`:
```kotlin
    fun generateAll(): List<GeneratedDocument> =
        Layout.entries.flatMap { layout -> VARIANTS.map { variant -> generate(layout, variant) } } +
            generate(Layout.HOSPITAL_TWO_COLUMN, BIRTH_DATE_VARIANT)
```
The `Layout.HOSPITAL_TWO_COLUMN` branch of `generate`:
```kotlin
                Layout.HOSPITAL_TWO_COLUMN -> Canvas(document, font, 1).use { canvas ->
                    canvas.line(listOf(56f to "혈액검사 결과 (합성 예시)"), 14f)
                    when {
                        variant.birthDateFirst -> {
                            canvas.line(listOf(56f to "생년월일: $BIRTH_DATE"))
                            canvas.line(listOf(56f to "수검자 합성-${variant.index}", 320f to dateLine(isoDate, variant.dateStyle)))
                        }
                        !omitDate -> canvas.line(listOf(56f to dateLine(isoDate, variant.dateStyle)))
                    }
                    canvas.skip()
                    canvas.line(listOf(56f to "검사항목", 320f to "결과"))
                    canvas.rule()
                    HOSPITAL_ROWS.forEach { rows += twoColumnRow(canvas, it, variant, random) }
                }
```
Companion object: `DATES` becomes `listOf("2026-07-28", "2026-06-18", "2026-05-09", "2026-04-21", "2026-03-12", "2026-02-03", "2026-01-20")`; add after `VARIANTS`:
```kotlin
        const val BIRTH_DATE = "1987-03-14"

        val BIRTH_DATE_VARIANT = Variant(
            6, englishLabels = false, lowercaseUnits = false, extraDecimal = false, dateStyle = DateStyle.ISO,
            rangeColumn = true, rangeSeparator = "-", thousandsComma = false, birthDateFirst = true,
        )
```
`CorpusWriter.kt` line 54 description becomes:
```kotlin
    val description: String = "합성 한국 검진 결과지 4 레이아웃 × 6 변형 + 생년월일 선행 1종 (25종, 1종은 텍스트 레이어 없는 스캔, 1종은 무날짜). PDFBox 텍스트 레이어 파서 채점용. 실제 데이터 없음.",
```

- [ ] **Step 4: Run the benchmark tests**

Run the Step 2 command. Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Run the gate**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm medical-ai:native-text-gate`
Expected: JSON with `"documentCount": 25`, `"expectedMeasurementCount": 190`, `"fieldF1": 1`, `"requiredAbstentionRecall": 1`, `"hallucinationRate": 0`, `"passed": true`; exit 0.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add packages/korean-checkup-benchmark && git commit -m "feat(benchmark): birth-date-first document scores the first-date mistake (25 documents)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Benchmark — byte-deterministic PDFs and a digest-bearing `corpusId`

**Files:**
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/CheckupCorpusGenerator.kt` (imports, `generate`, `imageOnly`, companion)
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/CorpusWriter.kt:50-71`
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/BenchmarkMain.kt:17-22`
- Test: `packages/korean-checkup-benchmark/src/test/kotlin/kr/co/genomecompanion/benchmark/CheckupCorpusGeneratorTest.kt`

**Interfaces:**
- Produces: `CorpusWriter.pdfDigest(documents: List<GeneratedDocument>): String` (64-hex sha256 over the lines `"<documentId> <sha256(pdf)>"` joined by `"\n"`, in corpus order) and `CorpusWriter.corpusId(documents) = "synthetic-ko-checkup-r2-" + pdfDigest.take(16)`; `Corpus.corpusId` is required. `CheckupCorpusGenerator.FIXED_DOCUMENT_ID = 20260917L`, `fixedTimestamp()`. Task 10 recomputes the same PDF digest in TypeScript and checks it against `corpusId`.

- [ ] **Step 1: Write the failing test**

Append to `CheckupCorpusGeneratorTest`:
```kotlin
    @Test
    fun `writes byte-identical PDFs and the same corpus id across two generations`(@TempDir first: Path, @TempDir second: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        val a = CorpusWriter.write(CheckupCorpusGenerator(font).generateAll(), first)
        val b = CorpusWriter.write(CheckupCorpusGenerator(font).generateAll(), second)

        val pdfs = Files.list(first).use { paths -> paths.filter { it.toString().endsWith(".pdf") }.toList() }
        assertThat(pdfs).hasSize(25)
        pdfs.forEach { pdf ->
            val bytes = Files.readAllBytes(pdf)
            assertThat(bytes).describedAs(pdf.fileName.toString()).isEqualTo(Files.readAllBytes(second.resolve(pdf.fileName)))
            assertThat(String(bytes, Charsets.ISO_8859_1)).describedAs(pdf.fileName.toString()).doesNotContain("/Metadata")
        }
        assertThat(Files.readAllBytes(first.resolve("corpus.json"))).isEqualTo(Files.readAllBytes(second.resolve("corpus.json")))
        assertThat(a.corpusId).isEqualTo(b.corpusId).matches("synthetic-ko-checkup-r2-[0-9a-f]{16}")
        assertThat(a.corpusId).endsWith(CorpusWriter.pdfDigest(CheckupCorpusGenerator(font).generateAll()).take(16))
    }
```
Also change the existing assertion `assertThat(corpus.corpusId).isEqualTo("synthetic-ko-checkup-r1")` to `assertThat(corpus.corpusId).matches("synthetic-ko-checkup-r2-[0-9a-f]{16}")`.

- [ ] **Step 2: Run the test to see it fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :packages:korean-checkup-benchmark:cleanTest :packages:korean-checkup-benchmark:test --no-daemon --tests "kr.co.genomecompanion.benchmark.CheckupCorpusGeneratorTest"`
Expected: compilation error `Unresolved reference: pdfDigest`.

- [ ] **Step 3: Pin the PDF identity and derive the corpus id**

`CheckupCorpusGenerator.kt` — add imports `org.apache.pdfbox.pdmodel.PDDocumentInformation`, `java.util.Calendar`, `java.util.GregorianCalendar`, `java.util.TimeZone`. Replace `PDDocument().use { document ->` in `generate` and in `imageOnly` with `pinnedDocument().use { document ->`. Add inside the class (before `private fun tableHeader`):
```kotlin
    /**
     * PDFBox otherwise derives the trailer /ID from the wall clock and stamps creation time, so the
     * same seed would give different bytes. No XMP metadata stream is written at all.
     */
    private fun pinnedDocument(): PDDocument = PDDocument().apply {
        documentId = FIXED_DOCUMENT_ID
        documentInformation = PDDocumentInformation().apply {
            producer = "korean-checkup-benchmark"
            creationDate = fixedTimestamp()
            modificationDate = fixedTimestamp()
        }
    }
```
Companion object additions:
```kotlin
        const val FIXED_DOCUMENT_ID = 20260917L

        fun fixedTimestamp(): Calendar = GregorianCalendar(TimeZone.getTimeZone("UTC")).apply {
            clear()
            set(2026, Calendar.SEPTEMBER, 17, 0, 0, 0)
        }
```
`CorpusWriter.kt` — `Corpus` requires the id:
```kotlin
data class Corpus(
    val documents: List<GoldDocument>,
    val corpusId: String,
    val schemaVersion: String = "medical-document-corpus.v1",
    val description: String = "합성 한국 검진 결과지 4 레이아웃 × 6 변형 + 생년월일 선행 1종 (25종, 1종은 텍스트 레이어 없는 스캔, 1종은 무날짜). PDFBox 텍스트 레이어 파서 채점용. 실제 데이터 없음.",
    val syntheticOnly: Boolean = true,
)
```
and the writer:
```kotlin
object CorpusWriter {
    const val CORPUS_ID_PREFIX = "synthetic-ko-checkup-r2-"

    /** sha256 over `"<documentId> <sha256(pdf bytes)>"` lines in corpus order. Recomputed by the TypeScript scripts. */
    fun pdfDigest(documents: List<GeneratedDocument>): String =
        BenchmarkJson.sha256(documents.joinToString("\n") { "${it.documentId} ${BenchmarkJson.sha256(it.bytes)}" })

    fun corpusId(documents: List<GeneratedDocument>): String = CORPUS_ID_PREFIX + pdfDigest(documents).take(16)

    fun write(documents: List<GeneratedDocument>, out: Path): Corpus {
        Files.createDirectories(out)
        val corpus = Corpus(
            documents = documents.map { generated ->
                Files.write(out.resolve("${generated.documentId}.pdf"), generated.bytes)
                gold(generated)
            },
            corpusId = corpusId(documents),
        )
        BenchmarkJson.mapper.writerWithDefaultPrettyPrinter().writeValue(out.resolve("corpus.json").toFile(), corpus)
        return corpus
    }
```
(`gold` stays unchanged.) `BenchmarkMain.kt` `generate` branch prints the id:
```kotlin
            println("generated ${corpus.documents.size} synthetic documents into $out (corpusId ${corpus.corpusId})")
```

- [ ] **Step 4: Run the benchmark tests**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :packages:korean-checkup-benchmark:cleanTest :packages:korean-checkup-benchmark:test --no-daemon`
Expected: `BUILD SUCCESSFUL`. If `writes byte-identical PDFs…` fails on a PDF diff, diff the two files with `cmp -l` — the only permitted cause is an unpinned PDFBox field; fix `pinnedDocument()`, never relax the test.

- [ ] **Step 5: Run the gate twice and compare the corpus id**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm medical-ai:native-text-gate | grep corpusId && pnpm medical-ai:native-text-gate | grep corpusId`
Expected: two identical lines `"corpusId": "synthetic-ko-checkup-r2-<16 hex>"`; both runs exit 0.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add packages/korean-checkup-benchmark && git commit -m "feat(benchmark): byte-deterministic PDFs; corpusId carries the PDF digest

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 5: Core — optional `observedOn` on candidate confirmation (V8, receipts, audit)

**Files:**
- Create: `apps/core-api/src/main/resources/db/migration/V8__record_original_observed_on.sql`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt:75-78,269-285`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt:76-96,116,420-454,663-683`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt:108-125,193-210,239-250,1168-1232`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/HealthEventProjection.kt:55`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `createCandidate(client, consentId, keySuffix)`, `login`, `grantConsent`, `mutate`, `read`, `responseJson`, `json`, `jdbc` from the integration test; `clock` in the service.
- Produces: request body `{ "value": string, "observedOn"?: "YYYY-MM-DD" }` on `POST /api/foundation/candidates/{id}/confirmation`; 400 `observed_on_invalid` (unparseable calendar date) / `observed_on_out_of_range` (before 1900-01-01 or after today in Asia/Seoul); `RecordReceipt.originalObservedOn: String` (always present; equals `observedOn` when not corrected); `reviewDecision = "CORRECTED"` when value or date differs; audit `CANDIDATE_CORRECTED` for either change; `FoundationRecordRow.originalObservedOn: LocalDate? = null`; `FoundationLifecycleService.confirmCandidate(principal, candidateId, confirmedValue, idempotencyKey, confirmedObservedOn: String? = null)`; `FoundationRepository.createRecordFromCandidate(recordId, versionId, candidate, confirmedValue, now, observedOn: LocalDate = candidate.observedOn)`. Task 6 consumes the receipt field and body key.

- [ ] **Step 1: Write the failing PostgreSQL test**

Append to `FoundationLifecyclePostgresIntegrationTest` (before `private fun importSyntheticDocument`):
```kotlin
    @Test
    fun storesAConfirmedExamDateKeepsTheParserDateAndAuditsNoDateValue() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "date-correction")

        fun confirmation(key: String, body: Map<String, String>) =
            post("/api/foundation/candidates/$candidateId/confirmation")
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(body))

        mutate(confirmation("confirm-date-bad-shape", mapOf("value" to "188", "observedOn" to "28-07-2026")), alice)
            .andExpect(status().isBadRequest)
        mutate(confirmation("confirm-date-impossible", mapOf("value" to "188", "observedOn" to "2026-02-30")), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("observed_on_invalid"))
        mutate(confirmation("confirm-date-future", mapOf("value" to "188", "observedOn" to "2999-01-01")), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("observed_on_out_of_range"))
        mutate(confirmation("confirm-date-too-early", mapOf("value" to "188", "observedOn" to "1899-12-31")), alice)
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("observed_on_out_of_range"))
        assertThat(count("gc_health_record")).isEqualTo(0)

        val record = responseJson(
            mutate(confirmation("confirm-date-corrected", mapOf("value" to "188", "observedOn" to "2026-07-27")), alice)
                .andExpect(status().isCreated)
                .andExpect(jsonPath("$.reviewDecision").value("CORRECTED"))
                .andExpect(jsonPath("$.value").value("188"))
                .andExpect(jsonPath("$.originalValue").value("188"))
                .andExpect(jsonPath("$.observedOn").value("2026-07-27"))
                .andExpect(jsonPath("$.originalObservedOn").value("2026-07-28"))
                .andReturn().response.contentAsByteArray,
        )
        val recordId = record["recordId"].asText()
        assertThat(jdbc.queryForObject("SELECT observed_on::text FROM gc_health_record", String::class.java)).isEqualTo("2026-07-27")
        assertThat(jdbc.queryForObject("SELECT original_observed_on::text FROM gc_health_record", String::class.java)).isEqualTo("2026-07-28")
        assertThat(
            jdbc.queryForObject("SELECT observed_on::text FROM gc_candidate WHERE candidate_id = ?", String::class.java, candidateId),
        ).isEqualTo("2026-07-28")
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'CANDIDATE_CORRECTED'", Long::class.java),
        ).isEqualTo(1L)
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event a WHERE a::text LIKE '%2026-07-27%' OR a::text LIKE '%2026-07-28%'", Long::class.java),
        ).isEqualTo(0L)

        read(get("/api/foundation/records/$recordId"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.reviewDecision").value("CORRECTED"))
            .andExpect(jsonPath("$.originalObservedOn").value("2026-07-28"))
        read(get("/api/foundation/health-events"), alice)
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].observedOn").value("2026-07-27"))
            .andExpect(jsonPath("$[0].corrected").value(true))

        val sameDateCandidate = createCandidate(alice, consentId, "date-unchanged")
        mutate(
            post("/api/foundation/candidates/$sameDateCandidate/confirmation")
                .header("Idempotency-Key", "confirm-date-unchanged")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "188", "observedOn" to "2026-07-28"))),
            alice,
        ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.reviewDecision").value("CONFIRMED"))
            .andExpect(jsonPath("$.observedOn").value("2026-07-28"))
            .andExpect(jsonPath("$.originalObservedOn").value("2026-07-28"))
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_health_record WHERE original_observed_on IS NULL", Long::class.java),
        ).isEqualTo(1L)
    }
```

- [ ] **Step 2: Run it to see it fail**

Run:
```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon --tests "kr.co.genomecompanion.foundation.FoundationLifecyclePostgresIntegrationTest.storesAConfirmedExamDateKeepsTheParserDateAndAuditsNoDateValue"
```
Expected: FAIL at `jsonPath("$.code").value("observed_on_invalid")` (today the unknown key is ignored and the record is created with the parser date).

- [ ] **Step 3: Migration V8**

`apps/core-api/src/main/resources/db/migration/V8__record_original_observed_on.sql`:
```sql
-- Wave 2B: a person may confirm that the document states a different exam date than the parser
-- proposed. observed_on keeps the confirmed date; the parser's date is kept here (NULL = unchanged).
-- The candidate row keeps its own observed_on untouched. Audit rows never carry either date.
ALTER TABLE gc_health_record
    ADD COLUMN original_observed_on DATE,
    ADD CONSTRAINT gc_health_record_original_observed_on_differs CHECK (
        original_observed_on IS NULL OR original_observed_on <> observed_on
    );
```

- [ ] **Step 4: Controller request**

```kotlin
data class CandidateConfirmationRequest(
    @field:Size(min = 1, max = 64)
    val value: String,
    /** Optional ISO date the person confirms the document states; null keeps the candidate's date. */
    @field:Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$")
    val observedOn: String? = null,
)
```
In `confirmCandidate` (controller) pass the new argument:
```kotlin
                service.confirmCandidate(
                    request.foundationPrincipal(),
                    candidateId,
                    body.value,
                    idempotencyKey,
                    body.observedOn,
                ),
```

- [ ] **Step 5: Repository**

`FoundationRecordRow` gains a defaulted field after `observedOn`:
```kotlin
    val observedOn: LocalDate,
    val originalObservedOn: LocalDate? = null,
```
`recordMapper` reads it after `observedOn`:
```kotlin
            originalObservedOn = result.getObject("original_observed_on", LocalDate::class.java),
```
`recordProjection` selects it: change `r.unit, r.observed_on, v.changed_at AS confirmed_at, v.correction_reason,` to `r.unit, r.observed_on, r.original_observed_on, v.changed_at AS confirmed_at, v.correction_reason,`.

`createRecordFromCandidate`:
```kotlin
    fun createRecordFromCandidate(
        recordId: UUID,
        versionId: UUID,
        candidate: FoundationCandidateRow,
        confirmedValue: String,
        now: Instant,
        observedOn: LocalDate = candidate.observedOn,
    ) {
```
and its `gc_health_record` insert:
```kotlin
        jdbc.update(
            """
            INSERT INTO gc_health_record(
                record_id, candidate_id, document_id, subject_id, label, confirmed_value,
                unit, observed_on, original_observed_on, confirmed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            recordId,
            candidate.candidateId,
            candidate.documentId,
            candidate.subjectId,
            candidate.label,
            confirmedValue,
            candidate.unit,
            observedOn,
            if (observedOn == candidate.observedOn) null else candidate.observedOn,
            now.atOffset(ZoneOffset.UTC),
        )
```

- [ ] **Step 6: Service**

Add imports `java.time.LocalDate`, `java.time.ZoneId`. `RecordReceipt` gains `val originalObservedOn: String,` right after `val observedOn: String,`. Next to `confirmedValuePattern` (line 116) add:
```kotlin
    private val seoul: ZoneId = ZoneId.of("Asia/Seoul")
    private val earliestObservedOn: LocalDate = LocalDate.of(1900, 1, 1)
```
`confirmCandidate` becomes:
```kotlin
    @Transactional
    fun confirmCandidate(
        principal: FoundationPrincipal,
        candidateId: UUID,
        confirmedValue: String,
        idempotencyKey: String,
        confirmedObservedOn: String? = null,
    ): RecordReceipt {
        requireIdempotencyKey(idempotencyKey)
        if (!confirmedValuePattern.matches(confirmedValue)) throw FoundationBadRequestException("confirmed_value_invalid")
        val requestedObservedOn = confirmedObservedOn?.let(::parseConfirmedObservedOn)
        val candidate = requireCandidate(principal, candidateId)
        val document = requireDocument(principal, candidate.documentId)
        requireActiveConsent(principal, document.consentId)
        repository.findRecordForCandidate(principal.subjectId, candidateId)?.let { return recordReceipt(it) }
        if (candidate.status != "PENDING") throw FoundationConflictException("candidate_not_pending")
        val observedOn = requestedObservedOn ?: candidate.observedOn

        val subjectHash = subjectHash(principal.subjectId)
        repository.findIdempotentResource(subjectHash, "CANDIDATE_CONFIRM", idempotencyKey)?.let { recordId ->
            return recordReceipt(requireRecord(principal, recordId))
        }
        val recordId = UUID.randomUUID()
        val now = Instant.now(clock)
        if (!repository.insertIdempotency(subjectHash, "CANDIDATE_CONFIRM", idempotencyKey, recordId, now)) {
            val concurrentId = repository.findIdempotentResource(subjectHash, "CANDIDATE_CONFIRM", idempotencyKey)
                ?: throw FoundationConflictException("idempotency_conflict")
            return recordReceipt(requireRecord(principal, concurrentId))
        }
        repository.createRecordFromCandidate(recordId, UUID.randomUUID(), candidate, confirmedValue, now, observedOn)
        val unchanged = confirmedValue == candidate.candidateValue && observedOn == candidate.observedOn
        audit(principal, if (unchanged) "CANDIDATE_CONFIRMED" else "CANDIDATE_CORRECTED", "RECORD", recordId, "SUCCESS")
        return recordReceipt(requireRecord(principal, recordId))
    }

    /** A date the person says the document states. Shape is bean-validated; calendar validity and range are checked here. */
    private fun parseConfirmedObservedOn(raw: String): LocalDate {
        val parsed = runCatching { LocalDate.parse(raw) }.getOrElse { throw FoundationBadRequestException("observed_on_invalid") }
        val today = LocalDate.ofInstant(Instant.now(clock), seoul)
        if (parsed.isBefore(earliestObservedOn) || parsed.isAfter(today)) throw FoundationBadRequestException("observed_on_out_of_range")
        return parsed
    }
```
`recordReceipt` changes two lines:
```kotlin
            reviewDecision = if (record.currentValue == record.originalValue && record.originalObservedOn == null) "CONFIRMED" else "CORRECTED",
            …
            observedOn = record.observedOn.toString(),
            originalObservedOn = (record.originalObservedOn ?: record.observedOn).toString(),
```

- [ ] **Step 7: Health events**

`HealthEventProjection.kt` line 55:
```kotlin
                    corrected = record.currentValue != record.originalValue || record.originalObservedOn != null,
```

- [ ] **Step 8: Run the whole JVM suite with PostgreSQL**

Run:
```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat cleanTest test --no-daemon
```
Expected: `BUILD SUCCESSFUL`; the new test passes; `HealthEventProjectionTest` still compiles (the new row field is defaulted); Flyway applies V8 on the embedded database.

- [ ] **Step 9: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/core-api && git commit -m "feat(core-api): confirm a candidate with a corrected exam date; keep the parser date; audit without the date

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 6: Web — "검사일 수정" form, record sentence, schema, copy scan

**Files:**
- Create: `apps/web/lib/format/observed-on.ts`, `apps/web/tests/observed-on.test.ts`
- Modify: `apps/web/lib/foundation/client.ts:111-125,396-408`
- Modify: `apps/web/lib/format/status-labels.ts` (append)
- Modify: `apps/web/components/integrated/CandidateReview.tsx`
- Modify: `apps/web/components/integrated/IntegratedHealthExperience.tsx:22,324-339,493,557`
- Modify: `apps/web/components/integrated/IntegratedRecords.tsx:164`
- Modify: `apps/web/tests/fixtures/foundation.ts:79`, `apps/web/tests/integrated-review-loop.test.tsx:39-62,309-325`, `apps/web/stories/VisitPreparation.stories.tsx:18`
- Test: `apps/web/tests/candidate-review.test.tsx`, `apps/web/tests/integrated-records-grouping.test.tsx`, `apps/web/tests/status-labels.test.ts`, `apps/web/tests/korean-ux-copy.test.ts`

**Interfaces:**
- Consumes: `RecordReceipt.originalObservedOn` and body key `observedOn` from Task 5; `formatKoreanDate`.
- Produces: `recordSchema.originalObservedOn: z.string().date()` (required → `FoundationRecord.originalObservedOn: string`); `client.confirmCandidate(candidateId, value, idempotencyKey, observedOn?: string)`; `CandidateReviewProps.onConfirm: (value: string, observedOn?: string) => void`; `localIsoDate(now?: Date): string`; `isCorrectableObservedOn(value: string, today: string): boolean`; `describeReviewDecision(record)` (records screen sentence); `labelReviewOutcome(record)` (short label: "원문과 같음" | "값을 수정함" | "검사일을 수정함" | "값과 검사일을 수정함"). Task 7 drives the form in the browser.

- [ ] **Step 1: Failing tests — date helpers, labels, review form, records sentence, copy scan**

`apps/web/tests/observed-on.test.ts`:
```ts
import { expect, it } from "vitest";
import { isCorrectableObservedOn, localIsoDate } from "@/lib/format/observed-on";

it("formats the local calendar date, not the UTC one", () => {
  expect(localIsoDate(new Date(2026, 8, 17, 0, 30))).toBe("2026-09-17");
  expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
});

it("accepts only a real calendar date between 1900-01-01 and today", () => {
  const today = "2026-09-17";
  expect(isCorrectableObservedOn("2026-07-27", today)).toBe(true);
  expect(isCorrectableObservedOn("1900-01-01", today)).toBe(true);
  expect(isCorrectableObservedOn(today, today)).toBe(true);
  expect(isCorrectableObservedOn("2026-09-18", today)).toBe(false);
  expect(isCorrectableObservedOn("1899-12-31", today)).toBe(false);
  expect(isCorrectableObservedOn("2026-02-30", today)).toBe(false);
  expect(isCorrectableObservedOn("27-07-2026", today)).toBe(false);
  expect(isCorrectableObservedOn("", today)).toBe(false);
});
```

Append to `apps/web/tests/status-labels.test.ts` (add `describeReviewDecision, labelReviewOutcome` to its import list and `syntheticRecord` from `./fixtures/foundation`):
```ts
describe("review decision sentences", () => {
  it("says which part the person corrected and shows the original date in Korean", () => {
    const untouched = syntheticRecord();
    const value = syntheticRecord({ value: "190", reviewDecision: "CORRECTED" });
    const date = syntheticRecord({ observedOn: "2026-07-27", originalObservedOn: "2026-07-28", reviewDecision: "CORRECTED" });
    const both = syntheticRecord({ value: "190", observedOn: "2026-07-27", originalObservedOn: "2026-07-28", reviewDecision: "CORRECTED" });
    expect(describeReviewDecision(untouched)).toBe("사용자가 원문과 같다고 확인함");
    expect(describeReviewDecision(value)).toBe("사용자가 값을 수정함");
    expect(describeReviewDecision(date)).toBe("사용자가 검사일을 수정함 · 원래 2026. 7. 28.");
    expect(describeReviewDecision(both)).toBe("사용자가 값과 검사일을 수정함 · 원래 2026. 7. 28.");
    expect(labelReviewOutcome(untouched)).toBe("원문과 같음");
    expect(labelReviewOutcome(value)).toBe("값을 수정함");
    expect(labelReviewOutcome(date)).toBe("검사일을 수정함");
    expect(labelReviewOutcome(both)).toBe("값과 검사일을 수정함");
  });
});
```

Append to `apps/web/tests/candidate-review.test.tsx`:
```tsx
it("sends a corrected exam date with the untouched value", async () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "검사일 수정" }));
  expect(screen.getByText("결과지에 적힌 검사일과 다르면 고쳐 주세요. 값의 의미는 판단하지 않아요.")).toBeVisible();
  const input = screen.getByLabelText("검사일 수정");
  expect(input).toHaveValue("2026-07-28");
  fireEvent.change(input, { target: { value: "2026-07-27" } });
  await userEvent.click(screen.getByRole("button", { name: "수정한 검사일 확인" }));

  expect(props.onConfirm).toHaveBeenCalledWith("188", "2026-07-27");
});

it("refuses a future or pre-1900 exam date and keeps the value untouched", async () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "검사일 수정" }));
  const input = screen.getByLabelText("검사일 수정");
  fireEvent.change(input, { target: { value: "2999-01-01" } });
  expect(screen.getByRole("button", { name: "수정한 검사일 확인" })).toBeDisabled();
  fireEvent.change(input, { target: { value: "1899-12-31" } });
  expect(screen.getByRole("button", { name: "수정한 검사일 확인" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.getByRole("button", { name: "검사일 수정" })).toBeVisible();
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it("does not offer the date form until the source image is visible", () => {
  render(<CandidateReview {...reviewProps()} />);
  expect(screen.getByRole("button", { name: "검사일 수정" })).toBeDisabled();
  fireEvent.load(screen.getByRole("img"));
  expect(screen.getByRole("button", { name: "검사일 수정" })).toBeEnabled();
});
```

Append to `apps/web/tests/integrated-records-grouping.test.tsx`:
```tsx
it("says the person corrected the exam date and shows the original date", async () => {
  server.use(http.get("/api/foundation/records", () => HttpResponse.json([
    syntheticRecord({ observedOn: "2026-07-27", originalObservedOn: "2026-07-28", reviewDecision: "CORRECTED" }),
  ])));
  render(<IntegratedRecords />);

  expect(await screen.findByText("사용자가 검사일을 수정함 · 원래 2026. 7. 28.")).toBeVisible();
  expect(screen.queryByText("사용자가 값을 수정함")).toBeNull();
  expect(screen.queryByText("CORRECTED")).toBeNull();
});
```

Add to the `describe` in `apps/web/tests/korean-ux-copy.test.ts`:
```ts
  it("asks for the exam date correction without judging the value", () => {
    const review = source("components/integrated/CandidateReview.tsx");
    expect(review).toContain("검사일 수정");
    expect(review).toContain("결과지에 적힌 검사일과 다르면 고쳐 주세요. 값의 의미는 판단하지 않아요.");
    expect(source("lib/format/status-labels.ts")).toContain("사용자가 검사일을 수정함 · 원래 ");
    expect(source("components/integrated/IntegratedRecords.tsx")).toContain("describeReviewDecision(record)");
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/observed-on.test.ts tests/status-labels.test.ts tests/candidate-review.test.tsx tests/integrated-records-grouping.test.tsx tests/korean-ux-copy.test.ts`
Expected: FAIL — missing module `@/lib/format/observed-on`, missing exports, no button named "검사일 수정".

- [ ] **Step 3: Date helpers**

`apps/web/lib/format/observed-on.ts`:
```ts
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;

export const earliestCorrectableObservedOn = "1900-01-01";

/** The calendar date where the person is (device clock), as YYYY-MM-DD. */
export function localIsoDate(now: Date = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** A real calendar date the person may confirm as the exam date: 1900-01-01 .. today. */
export function isCorrectableObservedOn(value: string, today: string) {
  const match = isoDate.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const roundTrips = date.toISOString().slice(0, 10) === value;
  return roundTrips && value >= earliestCorrectableObservedOn && value <= today;
}
```

- [ ] **Step 4: Client schema and call**

`apps/web/lib/foundation/client.ts` — in `recordSchema` add after `observedOn: z.string().date(),`:
```ts
  // The parser's date; equals observedOn unless the person corrected the exam date on review.
  originalObservedOn: z.string().date(),
```
Replace `confirmCandidate`:
```ts
    confirmCandidate: async (candidateId: string, value: string, idempotencyKey: string, observedOn?: string) => request(
      `/api/foundation/candidates/${requireUuid(candidateId)}/confirmation`,
      recordSchema,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requireIdempotencyKey(idempotencyKey),
        },
        body: JSON.stringify(confirmationBodySchema.parse({ value, observedOn })),
      },
      true,
    ),
```
and add near `idempotencyKeySchema` (line 4):
```ts
const confirmationBodySchema = z.object({ value: z.string().min(1).max(64), observedOn: z.string().date().optional() }).strict();
```

- [ ] **Step 5: Labels**

Append to `apps/web/lib/format/status-labels.ts` (add `import { formatKoreanDate } from "@/lib/format/korean-date";` at the top):
```ts
type ReviewedRecord = Pick<FoundationRecord, "reviewDecision" | "value" | "originalValue" | "observedOn" | "originalObservedOn">;

function correctedParts(record: ReviewedRecord) {
  return {
    value: record.reviewDecision === "CORRECTED" && record.value !== record.originalValue,
    date: record.reviewDecision === "CORRECTED" && record.observedOn !== record.originalObservedOn,
  };
}

/** Short outcome for the review summary list. */
export function labelReviewOutcome(record: ReviewedRecord) {
  const { value, date } = correctedParts(record);
  if (value && date) return "값과 검사일을 수정함";
  if (date) return "검사일을 수정함";
  if (value || record.reviewDecision === "CORRECTED") return "값을 수정함";
  return "원문과 같음";
}

/** Full sentence for the records screen; the original date is shown so the correction stays inspectable. */
export function describeReviewDecision(record: ReviewedRecord) {
  const { value, date } = correctedParts(record);
  const original = ` · 원래 ${formatKoreanDate(record.originalObservedOn)}`;
  if (value && date) return `사용자가 값과 검사일을 수정함${original}`;
  if (date) return `사용자가 검사일을 수정함${original}`;
  if (value || record.reviewDecision === "CORRECTED") return "사용자가 값을 수정함";
  return "사용자가 원문과 같다고 확인함";
}
```

- [ ] **Step 6: CandidateReview**

Replace the props type and the component body as follows (imports gain `import { isCorrectableObservedOn, localIsoDate } from "@/lib/format/observed-on";`):
```tsx
type CandidateReviewProps = {
  candidate: FoundationCandidate;
  previewUrl?: string;
  busy: boolean;
  errorMessage: string;
  onConfirm: (value: string, observedOn?: string) => void;
  onExclude: () => void;
  onBack: () => void;
  onClose: () => void;
};
```
State additions after `const [draftValue, setDraftValue] = useState(candidate.value);`:
```tsx
  const [dateCorrectionMode, setDateCorrectionMode] = useState(false);
  const [draftObservedOn, setDraftObservedOn] = useState(candidate.observedOn);
  const today = localIsoDate();
  const draftDateValid = isCorrectableObservedOn(draftObservedOn, today);
```
The reset block becomes:
```tsx
  if (reviewedCandidateId !== candidate.candidateId) {
    setReviewedCandidateId(candidate.candidateId);
    setDraftValue(candidate.value);
    setDraftObservedOn(candidate.observedOn);
    setCorrectionMode(false);
    setDateCorrectionMode(false);
  }
```
The 검사일 row of the `<dl>` becomes:
```tsx
              <div>
                <dt>검사일</dt>
                <dd>
                  {formatKoreanDate(candidate.observedOn)}
                  {!correctionMode && !dateCorrectionMode && (
                    <button type="button" className="gc-import__action gc-import__action--text" onClick={() => setDateCorrectionMode(true)} disabled={busy || !previewReady}>검사일 수정</button>
                  )}
                </dd>
              </div>
```
Between the value-correction `<form>` and the action bar insert the date form, so the block reads `{correctionMode ? (<form …값 수정…/>) : dateCorrectionMode ? (<form …/>) : (<div …/>)}`:
```tsx
          ) : dateCorrectionMode ? (
            <form
              className="gc-integrated-correction gc-review-decision-bar"
              onSubmit={(event) => { event.preventDefault(); if (!busy && previewReady && draftDateValid) onConfirm(candidate.value, draftObservedOn); }}
            >
              <label htmlFor="integrated-candidate-observed-on">검사일 수정</label>
              <p id="integrated-candidate-observed-on-help">결과지에 적힌 검사일과 다르면 고쳐 주세요. 값의 의미는 판단하지 않아요.</p>
              <input
                id="integrated-candidate-observed-on"
                type="date"
                value={draftObservedOn}
                min="1900-01-01"
                max={today}
                onChange={(event) => setDraftObservedOn(event.target.value)}
                aria-describedby="integrated-candidate-observed-on-help"
                autoFocus
                disabled={busy}
                required
              />
              <div className="gc-integrated-actions">
                <button type="button" onClick={() => { setDateCorrectionMode(false); setDraftObservedOn(candidate.observedOn); }}>취소</button>
                <button type="submit" disabled={busy || !previewReady || !draftDateValid}>{busy ? "저장 중" : "수정한 검사일 확인"}</button>
              </div>
            </form>
          ) : (
```
The value form's `onSubmit` sends only the value (unchanged): `onConfirm(draftValue.trim())`.

- [ ] **Step 7: Container and records**

`IntegratedHealthExperience.tsx`: the import list (line 22) replaces `labelReviewDecision,` with `labelReviewOutcome,`; `confirmCandidate` becomes:
```tsx
  const confirmCandidate = async (value: string, observedOn?: string) => {
    if (!activeCandidate) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const record = await client.confirmCandidate(activeCandidate.candidateId, value, newIdempotencyKey("confirm"), observedOn);
```
(rest of the function unchanged); line 493 becomes `onConfirm={(value, observedOn) => void confirmCandidate(value, observedOn)}`; line 557 becomes `<span>{labelReviewOutcome(record)}</span>`.

`IntegratedRecords.tsx`: import `describeReviewDecision` from `@/lib/format/status-labels` (keep `labelRecordStatus`) and line 164 becomes:
```tsx
                        <div className={styles.historySource}><strong>{record.label}</strong><span>예시 데이터</span><span>{describeReviewDecision(record)}</span></div>
```

- [ ] **Step 8: Fixtures and stories (strict schema needs the field everywhere a record is spelled out)**

- `apps/web/tests/fixtures/foundation.ts` `syntheticRecord`: after `observedOn: "2026-07-28",` add `originalObservedOn: "2026-07-28",`.
- `apps/web/tests/integrated-review-loop.test.tsx` confirmation handler: read `observedOn` too and fill both fields:
```ts
    const { value, observedOn } = await request.json() as { value: string; observedOn?: string };
    …
      reviewDecision: value === target.value && (!observedOn || observedOn === target.observedOn) ? "CONFIRMED" : "CORRECTED",
      label: target.label,
      value,
      originalValue: target.value,
      unit: target.unit,
      observedOn: observedOn ?? target.observedOn,
      originalObservedOn: target.observedOn,
```
  and in the literal at line ~320 add `originalObservedOn: "2026-07-28",` after `observedOn: "2026-07-28",`.
- `apps/web/stories/VisitPreparation.stories.tsx` `baseRecord`: add `originalObservedOn: "2026-07-28",` after `observedOn: "2026-07-28",`.

- [ ] **Step 9: Run the web suite and the type check**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: `Test Files 45 passed (45)` (43 existing + `abstention-copy` + `observed-on`; the Task 9/10 files do not exist yet), `tsc` prints nothing.

- [ ] **Step 10: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/web && git commit -m "feat(web): correct the exam date on review; records show the original date

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Browser lifecycle — one exam-date correction

**Files:**
- Modify: `apps/web/e2e/foundation-lifecycle.spec.ts:217-227,242-243`

**Interfaces:**
- Consumes: Task 6 form (button "검사일 수정", label "검사일 수정", submit "수정한 검사일 확인"), Task 5 endpoint, `labelReviewOutcome`, `describeReviewDecision`.

- [ ] **Step 1: Extend the spec**

Replace line 218 (`await page.getByRole("button", { name: "확인: 원문과 같아요" }).click();`, the confirmation of the second candidate `5.2`) with:
```ts
  await page.getByRole("button", { name: "검사일 수정" }).click();
  await expect(page.getByText("결과지에 적힌 검사일과 다르면 고쳐 주세요. 값의 의미는 판단하지 않아요.")).toBeVisible();
  await page.getByLabel("검사일 수정").fill("2026-07-27");
  await page.getByRole("button", { name: "수정한 검사일 확인" }).click();
```
After line 226 (`await expect(page.getByText("값을 수정함", { exact: true })).toBeVisible();`) add:
```ts
  await expect(page.getByText("검사일을 수정함", { exact: true })).toBeVisible();
```
After line 243 (`…filter({hasText: "비타민 D"})).toHaveCount(0);`) add:
```ts
  await expect(page.getByTestId("durable-record").filter({ hasText: "당화혈색소" }))
    .toContainText("사용자가 검사일을 수정함 · 원래 2026. 7. 28.");
  await expect(page.locator(".gc-records-group").filter({ hasText: "2026. 7. 27." })).toHaveCount(1);
```
The HbA1c record now forms its own `2026. 7. 27.` group; the later assertions on the `2026. 7. 28.` group (총콜레스테롤) and the record count `5` are unaffected.

- [ ] **Step 2: Run the lifecycle**

Run:
```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine' && pnpm foundation:e2e
```
Expected: `3 passed`. If a group-count assertion elsewhere in the spec fails because of the new `2026. 7. 27.` group, update that count by exactly one and note it in the commit message.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/web/e2e/foundation-lifecycle.spec.ts && git commit -m "test(e2e): correct one exam date during review and see it on the records screen

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 8: Benchmark — `render-pages` and `export-concepts` CLIs

**Files:**
- Create: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/PageRenderer.kt`
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/BenchmarkMain.kt`
- Test: `packages/korean-checkup-benchmark/src/test/kotlin/kr/co/genomecompanion/benchmark/PageRendererTest.kt` (create)

**Interfaces:**
- Consumes: `CorpusIndex` (NativeTextRunner.kt), `MedicalConceptCatalogue.entries`.
- Produces: `object PageRenderer { const val DPI = 150f; fun render(corpusDir: Path, out: Path): List<Path> }` writing `<documentId>-p<N>.png` (N is 1-based); CLI `render-pages --corpus <dir> --out <dir>`; CLI `export-concepts --out <file.json>` writing `[{"conceptCode","displayKo","aliases":[…]}]`. Task 10 reads both outputs.

- [ ] **Step 1: Write the failing test**

`PageRendererTest.kt`:
```kotlin
package kr.co.genomecompanion.benchmark

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import javax.imageio.ImageIO


class PageRendererTest {
    private val font: Path = BenchmarkFont.path()

    @Test
    fun `renders one 150 dpi PNG per page named by document id and page number`(@TempDir corpus: Path, @TempDir out: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        CorpusWriter.write(CheckupCorpusGenerator(font).generateAll(), corpus)

        val pages = PageRenderer.render(corpus, out)

        // 25 documents; the six two-page documents contribute a second page each.
        assertThat(pages).hasSize(31)
        assertThat(pages.map { it.fileName.toString() }).contains("synthetic-nhis-table-v0-p1.png", "synthetic-two-page-v0-p2.png", "synthetic-hospital-two-column-v6-p1.png")
        assertThat(pages.map { it.fileName.toString() }).doesNotContain("synthetic-nhis-table-v0-p2.png")
        val image = ImageIO.read(out.resolve("synthetic-two-page-v0-p2.png").toFile())
        assertThat(image.width).isEqualTo(1240)
        assertThat(image.height).isEqualTo(1754)
    }
}
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :packages:korean-checkup-benchmark:cleanTest :packages:korean-checkup-benchmark:test --no-daemon --tests "kr.co.genomecompanion.benchmark.PageRendererTest"`
Expected: compilation error `Unresolved reference: PageRenderer`.

- [ ] **Step 3: Implement**

`PageRenderer.kt`:
```kotlin
package kr.co.genomecompanion.benchmark

import com.fasterxml.jackson.module.kotlin.readValue
import org.apache.pdfbox.Loader
import org.apache.pdfbox.rendering.ImageType
import org.apache.pdfbox.rendering.PDFRenderer
import java.nio.file.Files
import java.nio.file.Path
import javax.imageio.ImageIO


/**
 * Rasterizes every page of a generated corpus to PNG so a vision model can be shown the same
 * synthetic documents the parser reads. Output stays under build/; nothing here touches product code.
 */
object PageRenderer {
    const val DPI = 150f

    fun render(corpusDir: Path, out: Path): List<Path> {
        Files.createDirectories(out)
        val index: CorpusIndex = BenchmarkJson.mapper.readValue(corpusDir.resolve("corpus.json").toFile())
        return index.documents.flatMap { document ->
            Loader.loadPDF(corpusDir.resolve("${document.documentId}.pdf").toFile()).use { pdf ->
                val renderer = PDFRenderer(pdf)
                (0 until pdf.numberOfPages).map { pageIndex ->
                    val image = renderer.renderImageWithDPI(pageIndex, DPI, ImageType.RGB)
                    val target = out.resolve("${document.documentId}-p${pageIndex + 1}.png")
                    check(ImageIO.write(image, "png", target.toFile())) { "no PNG writer for $target" }
                    target
                }
            }
        }
    }
}
```
`BenchmarkMain.kt` — add the import `kr.co.genomecompanion.documentboundary.MedicalConceptCatalogue`, two branches before `else ->`, and the usage string:
```kotlin
        "render-pages" -> {
            val corpusDir = Path.of(options.getValue("--corpus"))
            val out = Path.of(options.getValue("--out"))
            val pages = PageRenderer.render(corpusDir, out)
            println("rendered ${pages.size} pages at ${PageRenderer.DPI} dpi into $out")
        }
        "export-concepts" -> {
            val out = Path.of(options.getValue("--out"))
            val concepts = MedicalConceptCatalogue.entries.map {
                mapOf("conceptCode" to it.conceptCode, "displayKo" to it.displayKo, "aliases" to it.aliases)
            }
            BenchmarkJson.mapper.writerWithDefaultPrettyPrinter().writeValue(out.toFile(), concepts)
            println("wrote ${concepts.size} concepts to $out")
        }
        else -> {
            System.err.println(
                "usage: generate --out <dir> --font <Pretendard-Regular.ttf> | run-native-text --corpus <dir> --out <runs.json>" +
                    " | render-pages --corpus <dir> --out <dir> | export-concepts --out <concepts.json>",
            )
            exitProcess(2)
        }
```
Update the KDoc on `main` to list the two new subcommands in one sentence each: `render-pages` writes `<documentId>-p<N>.png` at 150 dpi; `export-concepts` writes the shared alias dictionary as JSON for the TypeScript experiment script.

- [ ] **Step 4: Run the benchmark tests**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :packages:korean-checkup-benchmark:cleanTest :packages:korean-checkup-benchmark:test --no-daemon`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Run the CLIs once by hand**

Run:
```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && ./gradlew.bat :packages:korean-checkup-benchmark:run --no-daemon -q "--args=render-pages --corpus C:/Users/Jason/Documents/genome-companion-korea-ux/packages/korean-checkup-benchmark/build/corpus --out C:/Users/Jason/Documents/genome-companion-korea-ux/packages/korean-checkup-benchmark/build/corpus/pages" && ./gradlew.bat :packages:korean-checkup-benchmark:run --no-daemon -q "--args=export-concepts --out C:/Users/Jason/Documents/genome-companion-korea-ux/packages/korean-checkup-benchmark/build/corpus/concepts.json" && ls packages/korean-checkup-benchmark/build/corpus/pages | wc -l
```
Expected: `rendered 31 pages at 150.0 dpi into …/pages`, `wrote 38 concepts to …/concepts.json`, `31`.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add packages/korean-checkup-benchmark && git commit -m "feat(benchmark): render-pages (PDFBox 150 dpi PNG) and export-concepts CLIs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 9: Experiment library — protocol, local-only Ollama client, row → run mapping

**Files:**
- Create: `apps/web/lib/medical-ai/medgemma-experiment.ts`
- Test: `apps/web/tests/medgemma-experiment.test.ts` (create)

**Interfaces:**
- Consumes: `medicalDocumentRunSchema`, `medicalDocumentCorpusSchema`, `MedicalDocumentRun` from `./contracts.ts`.
- Produces (all exported):
  - `OLLAMA_ORIGIN = "http://127.0.0.1:11434"`, `MODEL_TAG = "medgemma1.5:latest"`, `PIPELINE_ID = "ollama-medgemma-1.5-4b-page-image"`, `PAGE_BOX = { x: 0, y: 0, width: 1, height: 1 }`.
  - `EXPERIMENT_PROTOCOL` (frozen object: model, prompts, `format` JSON schema, options, think, keepAlive, documentTimeoutMs, dpi) and `protocolDigest(): string` (64 hex).
  - `assertLocalOllamaUrl(url: string): void` — throws unless the URL starts with `OLLAMA_ORIGIN + "/"`.
  - `type ChatFetch = (input: string, init?: RequestInit) => Promise<Response>`.
  - `describeOllamaModel(fetchImpl): Promise<{ version: string; modelDigest: string; blobSha256: string }>`.
  - `askModelForPage(input: { documentId: string; page: number; pngBase64: string }, deps: { fetchImpl: ChatFetch; timeoutMs: number }): Promise<ModelPageResult>`.
  - `runDocument(input: { documentId: string; pages: { page: number; pngBase64: string }[] }, deps: { fetchImpl: ChatFetch; documentTimeoutMs?: number; now?: () => number }): Promise<DocumentOutcome>` where `DocumentOutcome = { documentId; status: "ok" | "unreadable"; failure?: string; pages: ModelPageResult[]; durationMs: number }`.
  - `type ConceptCatalogue = { conceptCode: string; displayKo: string; aliases: string[] }[]`, `aliasKey(label)`, `conceptCodeFor(label, catalogue): string | undefined`.
  - `toModelRun(input: { gold: { documentId; documentSha256; documentType }; outcome: DocumentOutcome; catalogue; createdAt: string; models: { layout: PinnedModel; semantic: PinnedModel } }): MedicalDocumentRun`.
  - `sha256Hex(text: string): string`, `pdfDigest(entries: { documentId: string; bytes: Uint8Array }[]): string` (same rule as `CorpusWriter.pdfDigest`).

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/medgemma-experiment.test.ts`:
```ts
// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  EXPERIMENT_PROTOCOL,
  OLLAMA_ORIGIN,
  PAGE_BOX,
  PIPELINE_ID,
  aliasKey,
  askModelForPage,
  assertLocalOllamaUrl,
  conceptCodeFor,
  describeOllamaModel,
  pdfDigest,
  protocolDigest,
  runDocument,
  toModelRun,
  type ChatFetch,
  type ConceptCatalogue,
} from "@/lib/medical-ai/medgemma-experiment";
import { medicalDocumentRunSchema } from "@/lib/medical-ai/contracts";

const catalogue: ConceptCatalogue = [
  { conceptCode: "total-cholesterol", displayKo: "총콜레스테롤", aliases: ["콜레스테롤", "Total Cholesterol", "Cholesterol"] },
  { conceptCode: "hba1c", displayKo: "당화혈색소", aliases: ["HbA1c"] },
];

const models = {
  layout: { modelId: "pdfbox-render-150dpi", artifactSha256: `sha256:${"1".repeat(64)}`, executionMode: "offline-pinned" as const },
  semantic: { modelId: "medgemma1.5@ollama:433252621ab1", artifactSha256: `sha256:${"a".repeat(64)}`, executionMode: "offline-pinned" as const },
};

const gold = { documentId: "synthetic-nhis-table-v0", documentSha256: `sha256:${"d".repeat(64)}`, documentType: "health-screening-lab-report" as const };

function chatReply(content: unknown, status = 200): Response {
  return new Response(JSON.stringify({ model: "medgemma1.5:latest", message: { role: "assistant", content: JSON.stringify(content) }, done: true, eval_count: 12 }), { status, headers: { "content-type": "application/json" } });
}

describe("protocol", () => {
  it("pins the prompt, schema and parameters and hashes them", () => {
    expect(EXPERIMENT_PROTOCOL.model).toBe("medgemma1.5:latest");
    expect(EXPERIMENT_PROTOCOL.think).toBe(false);
    expect(EXPERIMENT_PROTOCOL.options.temperature).toBe(0);
    expect(EXPERIMENT_PROTOCOL.documentTimeoutMs).toBe(180_000);
    expect(EXPERIMENT_PROTOCOL.systemPrompt).toContain("판단하지");
    expect(EXPERIMENT_PROTOCOL.systemPrompt).not.toMatch(/진단해|정상인지|위험도를 평가/);
    expect(protocolDigest()).toBe(createHash("sha256").update(JSON.stringify(EXPERIMENT_PROTOCOL)).digest("hex"));
    expect(Object.isFrozen(EXPERIMENT_PROTOCOL)).toBe(true);
  });

  it("refuses any origin other than the local Ollama server", () => {
    expect(() => assertLocalOllamaUrl(`${OLLAMA_ORIGIN}/api/chat`)).not.toThrow();
    expect(() => assertLocalOllamaUrl("http://localhost:11434/api/chat")).toThrow(/127\.0\.0\.1:11434/);
    expect(() => assertLocalOllamaUrl("https://ollama.example.com/api/chat")).toThrow();
    expect(() => assertLocalOllamaUrl("http://127.0.0.1:11434.example.com/api/chat")).toThrow();
  });
});

describe("Ollama client", () => {
  it("sends one page image with the pinned protocol and parses the reply", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fetchImpl: ChatFetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return chatReply({ observedOn: "2026-07-28", rows: [{ label: "총콜레스테롤", value: "188", unit: "mg/dL", referenceRange: "150-199", page: 1 }], abstentions: [] });
    };

    const result = await askModelForPage({ documentId: gold.documentId, page: 1, pngBase64: "iVBORw0KGgo=" }, { fetchImpl, timeoutMs: 5_000 });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://127.0.0.1:11434/api/chat");
    expect(calls[0].body).toMatchObject({ model: "medgemma1.5:latest", stream: false, think: false, keep_alive: EXPERIMENT_PROTOCOL.keepAlive, format: EXPERIMENT_PROTOCOL.format, options: EXPERIMENT_PROTOCOL.options });
    const messages = calls[0].body.messages as { role: string; content: string; images?: string[] }[];
    expect(messages[0]).toEqual({ role: "system", content: EXPERIMENT_PROTOCOL.systemPrompt });
    expect(messages[1].images).toEqual(["iVBORw0KGgo="]);
    expect(result.observedOn).toBe("2026-07-28");
    expect(result.rows).toEqual([{ label: "총콜레스테롤", value: "188", unit: "mg/dL", observedOn: undefined }]);
    expect(JSON.stringify(result.rows)).not.toContain("referenceRange");
  });

  it("reads the version, model digest and blob digest from the local server", async () => {
    const fetchImpl: ChatFetch = async (url) => {
      if (url.endsWith("/api/version")) return Response.json({ version: "0.34.1" });
      if (url.endsWith("/api/tags")) return Response.json({ models: [{ name: "medgemma1.5:latest", digest: "433252621ab154668b5d8be6aff6c1b771bacba045e46e6193da8d6ad1630f2c" }] });
      if (url.endsWith("/api/show")) return Response.json({ modelfile: `# Modelfile\nFROM C:\\Users\\x\\.ollama\\models\\blobs\\sha256-${"a".repeat(64)}\n` });
      throw new Error(`unexpected ${url}`);
    };
    await expect(describeOllamaModel(fetchImpl)).resolves.toEqual({ version: "0.34.1", modelDigest: "433252621ab154668b5d8be6aff6c1b771bacba045e46e6193da8d6ad1630f2c", blobSha256: "a".repeat(64) });
  });

  it("fails the model lookup when the tag is missing", async () => {
    const fetchImpl: ChatFetch = async (url) => url.endsWith("/api/version") ? Response.json({ version: "0.34.1" }) : Response.json({ models: [] });
    await expect(describeOllamaModel(fetchImpl)).rejects.toThrow(/medgemma1\.5:latest/);
  });
});

describe("runDocument", () => {
  it("merges pages in order and reuses the first page-level date for later pages", async () => {
    const fetchImpl: ChatFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: { images?: string[] }[] };
      return body.messages[1].images?.[0] === "p1"
        ? chatReply({ observedOn: "2026-07-28", rows: [], abstentions: [] })
        : chatReply({ observedOn: "", rows: [{ label: "HbA1c", value: "5.2", unit: "%" }], abstentions: [{ label: "LDL", reason: "ambiguous_value" }] });
    });
    const outcome = await runDocument({ documentId: gold.documentId, pages: [{ page: 1, pngBase64: "p1" }, { page: 2, pngBase64: "p2" }] }, { fetchImpl });
    expect(outcome.status).toBe("ok");
    expect(outcome.pages.map((page) => page.page)).toEqual([1, 2]);
    const run = toModelRun({ gold, outcome, catalogue, createdAt: "2026-09-17T09:00:00Z", models });
    expect(run.candidates).toEqual([{
      semanticRole: "measurement", fieldId: "hba1c", label: "HbA1c", value: "5.2", unit: "%", observedAt: "2026-07-28", confidence: 1,
      evidence: { page: 2, blockId: "block-row-01", box: PAGE_BOX, sourceTextSha256: `sha256:${createHash("sha256").update("HbA1c 5.2 %").digest("hex")}` },
    }]);
    expect(run.abstentions).toEqual([{ fieldId: "ldl", label: "LDL", reason: "ambiguous_value" }]);
  });

  it("marks the whole document unreadable on a timeout, an HTTP error or unparseable JSON", async () => {
    const hang: ChatFetch = (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    const timedOut = await runDocument({ documentId: gold.documentId, pages: [{ page: 1, pngBase64: "p1" }] }, { fetchImpl: hang, documentTimeoutMs: 20 });
    expect(timedOut.status).toBe("unreadable");
    expect(timedOut.failure).toMatch(/abort|timeout/i);

    const failing: ChatFetch = async () => new Response("busy", { status: 503 });
    expect((await runDocument({ documentId: gold.documentId, pages: [{ page: 1, pngBase64: "p1" }] }, { fetchImpl: failing })).status).toBe("unreadable");

    const garbage: ChatFetch = async () => new Response(JSON.stringify({ message: { content: "not json" } }), { status: 200 });
    const outcome = await runDocument({ documentId: gold.documentId, pages: [{ page: 1, pngBase64: "p1" }] }, { fetchImpl: garbage });
    expect(outcome.status).toBe("unreadable");
    const run = toModelRun({ gold, outcome, catalogue, createdAt: "2026-09-17T09:00:00Z", models });
    expect(run.candidates).toEqual([]);
    expect(run.abstentions).toEqual([{ fieldId: "document", label: "문서 전체", reason: "unreadable" }]);
  });
});

describe("toModelRun", () => {
  const page = (rows: unknown[], abstentions: unknown[] = [], observedOn = "2026-07-28") =>
    ({ page: 1, observedOn, rows: rows as never, abstentions: abstentions as never, rawContent: "", durationMs: 1 });
  const outcomeWith = (rows: unknown[], abstentions: unknown[] = [], observedOn = "2026-07-28") =>
    ({ documentId: gold.documentId, status: "ok" as const, pages: [page(rows, abstentions, observedOn)], durationMs: 1 });

  it("normalizes labels through the catalogue aliases and keeps the printed label", () => {
    expect(aliasKey(" Total Cholesterol: ")).toBe("totalcholesterol");
    expect(conceptCodeFor("총 콜레스테롤", catalogue)).toBe("total-cholesterol");
    expect(conceptCodeFor("cholesterol：", catalogue)).toBe("total-cholesterol");
    expect(conceptCodeFor("알 수 없는 항목", catalogue)).toBeUndefined();
    const run = toModelRun({ gold, outcome: outcomeWith([{ label: "Total Cholesterol", value: "188", unit: "mg/dL" }, { label: "총콜레스테롤", value: "189", unit: "mg/dL" }, { label: "???", value: "1", unit: "x" }]), catalogue, createdAt: "2026-09-17T09:00:00Z", models });
    expect(run.candidates.map((candidate) => [candidate.fieldId, candidate.label])).toEqual([["total-cholesterol", "Total Cholesterol"], ["total-cholesterol-2", "총콜레스테롤"], ["unknown-3", "???"]]);
    expect(run.pipelineId).toBe(PIPELINE_ID);
    expect(run.runId).toBe("run-medgemma-nhis-table-v0");
    expect(run.documentSha256).toBe(gold.documentSha256);
    expect(medicalDocumentRunSchema.safeParse(run).success).toBe(true);
  });

  it("turns rows without a date, an empty value or unit, or over-long fields into abstentions", () => {
    const run = toModelRun({
      gold,
      outcome: outcomeWith([
        { label: "HbA1c", value: "5.2", unit: "%", observedOn: "2026-07-27" },
        { label: "Cholesterol", value: "188", unit: "mg/dL" },
        { label: "Empty", value: "", unit: "mg/dL" },
        { label: "NoUnit", value: "7", unit: " " },
        { label: "x".repeat(81), value: "1", unit: "u" },
      ], [{ label: "Blurry", reason: "not-a-reason" }], ""),
      catalogue, createdAt: "2026-09-17T09:00:00Z", models,
    });
    expect(run.candidates.map((candidate) => [candidate.fieldId, candidate.observedAt])).toEqual([["hba1c", "2026-07-27"]]);
    expect(run.abstentions).toEqual([
      { fieldId: "total-cholesterol", label: "Cholesterol", reason: "missing_evidence" },
      { fieldId: "empty", label: "Empty", reason: "ambiguous_value" },
      { fieldId: "nounit", label: "NoUnit", reason: "ambiguous_unit" },
      { fieldId: "x".repeat(80), label: "x".repeat(80), reason: "unreadable" },
      { fieldId: "blurry", label: "Blurry", reason: "unreadable" },
    ]);
    expect(JSON.stringify(run)).not.toContain("referenceRange");
  });

  it("computes the PDF digest the way the Kotlin corpus writer does", () => {
    const entries = [{ documentId: "synthetic-a", bytes: new TextEncoder().encode("A") }, { documentId: "synthetic-b", bytes: new TextEncoder().encode("B") }];
    const expected = createHash("sha256").update(entries.map((entry) => `${entry.documentId} ${createHash("sha256").update(entry.bytes).digest("hex")}`).join("\n")).digest("hex");
    expect(pdfDigest(entries)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/medgemma-experiment.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/medical-ai/medgemma-experiment"`.

- [ ] **Step 3: Implement the library**

`apps/web/lib/medical-ai/medgemma-experiment.ts`:
```ts
/**
 * Bounded local MedGemma experiment (founder approval 2026-09-16). Pure functions used by
 * scripts/medgemma-local-experiment.mts. Nothing here is imported by product code: the model
 * proposes transcriptions of synthetic pages that are scored and reported, never stored as records.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { medicalDocumentRunSchema, type MedicalDocumentRun } from "./contracts.ts";

export const OLLAMA_ORIGIN = "http://127.0.0.1:11434";
export const MODEL_TAG = "medgemma1.5:latest";
export const PIPELINE_ID = "ollama-medgemma-1.5-4b-page-image";
export const DOCUMENT_LABEL = "문서 전체";
/** The model returns no box, so every candidate cites the whole page; localization is not measurable. */
export const PAGE_BOX = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });

const ABSTENTION_REASONS = ["unreadable", "ambiguous_value", "ambiguous_unit", "missing_evidence"] as const;
type AbstentionReason = (typeof ABSTENTION_REASONS)[number];

/** JSON Schema handed to Ollama's `format`. Only transcription fields; no interpretation field exists. */
const MODEL_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    observedOn: { type: "string", description: "검사일·검진일·채취일·Date 라벨이 붙은 날짜만 YYYY-MM-DD. 없으면 빈 문자열." },
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          unit: { type: "string" },
          observedOn: { type: "string" },
          page: { type: "integer" },
        },
        required: ["label", "value", "unit"],
      },
    },
    abstentions: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, reason: { type: "string", enum: [...ABSTENTION_REASONS] } },
        required: ["label", "reason"],
      },
    },
  },
  required: ["observedOn", "rows", "abstentions"],
} as const;

export const EXPERIMENT_PROTOCOL = Object.freeze({
  model: MODEL_TAG,
  systemPrompt: [
    "너는 한국어 건강검진 결과지 페이지 이미지를 그대로 옮겨 적는 필사 도구다.",
    "보이는 검사 항목마다 항목 이름(label), 결과 값(value), 단위(unit)를 인쇄된 글자 그대로 적는다. 값을 계산하거나 단위를 바꾸지 않는다.",
    "페이지에 검사일·검진일·채취일·Date 라벨이 붙은 날짜가 보이면 observedOn에 YYYY-MM-DD로 적고, 없으면 빈 문자열로 둔다. 생년월일·발급일 같은 다른 날짜는 검사일로 쓰지 않는다.",
    "판단하지 않는다: 정상/비정상, 참고치, 위험, 진단, 치료, 해석을 어떤 필드에도 쓰지 않는다. 참고치 열은 옮겨 적지 않는다.",
    "읽을 수 없거나 값이 둘 이상이거나 단위가 불분명한 항목은 rows에 넣지 말고 abstentions에 label과 reason(unreadable, ambiguous_value, ambiguous_unit, missing_evidence)으로 적는다.",
    "페이지에 없는 항목을 지어내지 않는다. 항목이 하나도 없으면 rows를 빈 배열로 둔다.",
    "주어진 JSON 스키마에 맞는 JSON만 출력한다.",
  ].join("\n"),
  userPrompt: "이 페이지에 인쇄된 검사 항목·값·단위와 라벨이 붙은 검사일을 그대로 옮겨 적어 주세요.",
  format: MODEL_RESPONSE_JSON_SCHEMA,
  think: false,
  keepAlive: "10m",
  options: Object.freeze({ temperature: 0, seed: 7, num_predict: 2048 }),
  documentTimeoutMs: 180_000,
  dpi: 150,
});

export function sha256Hex(input: string | Uint8Array) {
  return createHash("sha256").update(input).digest("hex");
}

export function protocolDigest() {
  return sha256Hex(JSON.stringify(EXPERIMENT_PROTOCOL));
}

/** Same rule as CorpusWriter.pdfDigest: sha256 over "<documentId> <sha256(pdf)>" lines joined by "\n". */
export function pdfDigest(entries: readonly { documentId: string; bytes: Uint8Array }[]) {
  return sha256Hex(entries.map((entry) => `${entry.documentId} ${sha256Hex(entry.bytes)}`).join("\n"));
}

export type ChatFetch = (input: string, init?: RequestInit) => Promise<Response>;

export function assertLocalOllamaUrl(url: string) {
  if (!url.startsWith(`${OLLAMA_ORIGIN}/`)) throw new Error(`refusing to contact ${url}: only ${OLLAMA_ORIGIN} is allowed`);
}

async function localJson<T>(fetchImpl: ChatFetch, path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const url = `${OLLAMA_ORIGIN}${path}`;
  assertLocalOllamaUrl(url);
  const response = await fetchImpl(url, init);
  if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  return schema.parse(await response.json());
}

export async function describeOllamaModel(fetchImpl: ChatFetch) {
  const { version } = await localJson(fetchImpl, "/api/version", z.looseObject({ version: z.string() }));
  const tags = await localJson(fetchImpl, "/api/tags", z.looseObject({ models: z.array(z.looseObject({ name: z.string(), digest: z.string() })) }));
  const model = tags.models.find((entry) => entry.name === MODEL_TAG);
  if (!model) throw new Error(`${MODEL_TAG} is not pulled on the local Ollama server`);
  const show = await localJson(fetchImpl, "/api/show", z.looseObject({ modelfile: z.string() }), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL_TAG }),
  });
  const blob = /sha256[-:]([0-9a-f]{64})/.exec(show.modelfile);
  if (!blob) throw new Error("the Ollama modelfile names no sha256 blob");
  return { version, modelDigest: model.digest, blobSha256: blob[1] };
}

const modelRowSchema = z.looseObject({ label: z.string(), value: z.string(), unit: z.string(), observedOn: z.string().optional() });
const modelAbstentionSchema = z.looseObject({ label: z.string(), reason: z.string() });
export const modelPageResponseSchema = z.looseObject({
  observedOn: z.string().default(""),
  rows: z.array(modelRowSchema).default([]),
  abstentions: z.array(modelAbstentionSchema).default([]),
});
const chatResponseSchema = z.looseObject({ message: z.looseObject({ content: z.string() }) });

export type ModelRow = { label: string; value: string; unit: string; observedOn?: string };
export type ModelAbstention = { label: string; reason: string };
export type ModelPageResult = { page: number; observedOn: string; rows: ModelRow[]; abstentions: ModelAbstention[]; rawContent: string; durationMs: number };

/** One `/api/chat` call for one page image. Every extra key the model emits (e.g. referenceRange) is dropped here. */
export async function askModelForPage(
  input: { documentId: string; page: number; pngBase64: string },
  deps: { fetchImpl: ChatFetch; timeoutMs: number },
): Promise<ModelPageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  const started = Date.now();
  try {
    const url = `${OLLAMA_ORIGIN}/api/chat`;
    assertLocalOllamaUrl(url);
    const response = await deps.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: EXPERIMENT_PROTOCOL.model,
        stream: false,
        think: EXPERIMENT_PROTOCOL.think,
        keep_alive: EXPERIMENT_PROTOCOL.keepAlive,
        format: EXPERIMENT_PROTOCOL.format,
        options: EXPERIMENT_PROTOCOL.options,
        messages: [
          { role: "system", content: EXPERIMENT_PROTOCOL.systemPrompt },
          { role: "user", content: EXPERIMENT_PROTOCOL.userPrompt, images: [input.pngBase64] },
        ],
      }),
    });
    if (!response.ok) throw new Error(`/api/chat responded ${response.status} for ${input.documentId} p${input.page}`);
    const rawContent = chatResponseSchema.parse(await response.json()).message.content;
    const parsed = modelPageResponseSchema.parse(JSON.parse(rawContent));
    return {
      page: input.page,
      observedOn: parsed.observedOn.trim(),
      rows: parsed.rows.map((row) => ({ label: row.label, value: row.value, unit: row.unit, observedOn: row.observedOn })),
      abstentions: parsed.abstentions.map((abstention) => ({ label: abstention.label, reason: abstention.reason })),
      rawContent,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export type DocumentOutcome = { documentId: string; status: "ok" | "unreadable"; failure?: string; pages: ModelPageResult[]; durationMs: number };

/** One call per page within one document budget; any failure makes the whole document unreadable. */
export async function runDocument(
  input: { documentId: string; pages: readonly { page: number; pngBase64: string }[] },
  deps: { fetchImpl: ChatFetch; documentTimeoutMs?: number; now?: () => number },
): Promise<DocumentOutcome> {
  const now = deps.now ?? Date.now;
  const started = now();
  const deadline = started + (deps.documentTimeoutMs ?? EXPERIMENT_PROTOCOL.documentTimeoutMs);
  const pages: ModelPageResult[] = [];
  for (const page of [...input.pages].sort((a, b) => a.page - b.page)) {
    const remaining = deadline - now();
    if (remaining <= 0) return { documentId: input.documentId, status: "unreadable", failure: "document timeout before page " + page.page, pages, durationMs: now() - started };
    try {
      pages.push(await askModelForPage({ documentId: input.documentId, page: page.page, pngBase64: page.pngBase64 }, { fetchImpl: deps.fetchImpl, timeoutMs: remaining }));
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return { documentId: input.documentId, status: "unreadable", failure: message, pages, durationMs: now() - started };
    }
  }
  return { documentId: input.documentId, status: "ok", pages, durationMs: now() - started };
}

export type ConceptCatalogue = readonly { conceptCode: string; displayKo: string; aliases: readonly string[] }[];

/** Mirror of MedicalConceptCatalogue.aliasKey: NFC, trim, drop trailing colons, lowercase, remove whitespace. */
export function aliasKey(label: string) {
  return label.normalize("NFC").trim().replace(/[:：]+$/, "").toLowerCase().replace(/\s+/g, "");
}

export function conceptCodeFor(label: string, catalogue: ConceptCatalogue) {
  const key = aliasKey(label);
  return catalogue.find((concept) => [concept.displayKo, ...concept.aliases].some((alias) => aliasKey(alias) === key))?.conceptCode;
}

function slug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function uniqueFieldId(base: string, used: Set<string>) {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}-${suffix++}`;
  used.add(candidate);
  return candidate;
}

function fieldIdFor(label: string, index: number, catalogue: ConceptCatalogue, used: Set<string>) {
  const base = label === DOCUMENT_LABEL ? "document" : conceptCodeFor(label, catalogue) ?? (slug(label) || `unknown-${index}`);
  return uniqueFieldId(base, used);
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const LIMITS = { label: 80, value: 64, unit: 32, rows: 100 };

export type PinnedModel = { modelId: string; artifactSha256: string; executionMode: "offline-pinned" };

export function toModelRun(input: {
  gold: { documentId: string; documentSha256: string; documentType: "health-screening-lab-report" | "public-health-lab-report" };
  outcome: DocumentOutcome;
  catalogue: ConceptCatalogue;
  createdAt: string;
  models: { layout: PinnedModel; semantic: PinnedModel };
}): MedicalDocumentRun {
  const used = new Set<string>();
  const candidates: MedicalDocumentRun["candidates"] = [];
  const abstentions: MedicalDocumentRun["abstentions"] = [];
  const abstain = (label: string, index: number, reason: AbstentionReason) => {
    if (abstentions.length >= LIMITS.rows) return;
    const shown = label.trim().slice(0, LIMITS.label) || DOCUMENT_LABEL;
    abstentions.push({ fieldId: fieldIdFor(shown, index, input.catalogue, used), label: shown, reason });
  };

  if (input.outcome.status !== "ok") {
    abstain(DOCUMENT_LABEL, 1, "unreadable");
  } else {
    const documentObservedOn = input.outcome.pages.map((page) => page.observedOn).find((date) => isoDate.test(date));
    let index = 0;
    for (const page of input.outcome.pages) {
      for (const row of page.rows) {
        index += 1;
        const label = row.label.trim();
        const value = row.value.trim();
        const unit = row.unit.trim();
        const rowDate = row.observedOn?.trim();
        const observedAt = rowDate && isoDate.test(rowDate) ? rowDate : documentObservedOn;
        if (label.length > LIMITS.label || value.length > LIMITS.value || unit.length > LIMITS.unit || label.length === 0) {
          abstain(label, index, "unreadable");
        } else if (value.length === 0) {
          abstain(label, index, "ambiguous_value");
        } else if (unit.length === 0) {
          abstain(label, index, "ambiguous_unit");
        } else if (!observedAt) {
          abstain(label, index, "missing_evidence");
        } else if (candidates.length < LIMITS.rows) {
          candidates.push({
            semanticRole: "measurement",
            fieldId: fieldIdFor(label, index, input.catalogue, used),
            label,
            value,
            unit,
            observedAt,
            confidence: 1,
            evidence: {
              page: page.page,
              blockId: `block-row-${String(candidates.length + 1).padStart(2, "0")}`,
              box: { ...PAGE_BOX },
              sourceTextSha256: `sha256:${sha256Hex(`${label} ${value} ${unit}`)}`,
            },
          });
        }
      }
      for (const abstention of page.abstentions) {
        index += 1;
        const reason = (ABSTENTION_REASONS as readonly string[]).includes(abstention.reason) ? abstention.reason as AbstentionReason : "unreadable";
        abstain(abstention.label, index, reason);
      }
    }
  }

  return medicalDocumentRunSchema.parse({
    schemaVersion: "medical-document-run.v1",
    pipelineId: PIPELINE_ID,
    runId: `run-medgemma-${input.gold.documentId.replace(/^synthetic-/, "")}`,
    documentId: input.gold.documentId,
    documentSha256: input.gold.documentSha256,
    documentType: input.gold.documentType,
    language: "ko-KR",
    synthetic: true,
    createdAt: input.createdAt,
    models: input.models,
    candidates,
    abstentions,
  });
}
```

- [ ] **Step 4: Run the tests**

Run the Step 2 command. Expected: `Test Files 1 passed (1)`, 10 tests passed.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/web/lib/medical-ai/medgemma-experiment.ts apps/web/tests/medgemma-experiment.test.ts && git commit -m "feat(medical-ai): local-only MedGemma experiment library (pinned protocol, Ollama client, run mapping)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 10: Report renderer, manual runner script, root script

**Files:**
- Create: `apps/web/lib/medical-ai/medgemma-report.ts`, `apps/web/tests/medgemma-report.test.ts`
- Create: `apps/web/scripts/medgemma-local-experiment.mts`
- Modify: `apps/web/package.json:12`, `package.json:23`

**Interfaces:**
- Consumes: `compareMedicalDocumentPipelines`, `evaluateMedicalDocumentPipeline`, schemas from `contracts.ts`; everything exported by Task 9; Task 8 CLIs; Task 4 `corpusId`.
- Produces: `breakdownByDocument(corpusInput, runsInput): DocumentBreakdown[]`; `renderMedgemmaExperimentReport(input: ReportInput): string`; script `pnpm medical-ai:medgemma-experiment [--report <path>]` writing `apps/web/build/medgemma/{medgemma-runs.json,summary.json,raw/*.json}` and the markdown report (default `docs/status/2026-09-17/medgemma-local-experiment.md`).

- [ ] **Step 1: Write the failing renderer tests**

`apps/web/tests/medgemma-report.test.ts`:
```ts
// @vitest-environment node
import { expect, it } from "vitest";
import { breakdownByDocument, renderMedgemmaExperimentReport } from "@/lib/medical-ai/medgemma-report";
import corpus from "./fixtures/medical-ai/synthetic-korean-lab.corpus.json";
import referenceRuns from "./fixtures/medical-ai/paddle-medgemma.reference-runs.json";
import unsafeRuns from "./fixtures/medical-ai/unsafe-general-vlm.runs.json";

it("breaks every expected field down into exact, wrong, missing or hallucinated per document", () => {
  const exact = breakdownByDocument(corpus, referenceRuns);
  expect(exact.map((document) => document.exact)).toEqual(exact.map((document) => document.expected));
  expect(exact.flatMap((document) => document.fields).every((field) => field.outcome === "정확")).toBe(true);

  const unsafe = breakdownByDocument(corpus, unsafeRuns);
  expect(unsafe.reduce((sum, document) => sum + document.hallucinated, 0)).toBe(1);
  expect(unsafe.flatMap((document) => document.fields).some((field) => field.outcome === "오답" || field.outcome === "누락")).toBe(true);
  expect(unsafe.flatMap((document) => document.fields).some((field) => field.outcome === "환각")).toBe(true);
});

it("renders the side-by-side report with the model localization column marked not measurable and no threshold verdict for the model", () => {
  const markdown = renderMedgemmaExperimentReport({
    generatedAt: "2026-09-17",
    corpus,
    pipelines: [
      { label: "pdfbox-native-text", runs: referenceRuns, evidenceMeasurable: true, gated: true },
      { label: "ollama-medgemma-1.5-4b-page-image", runs: unsafeRuns, evidenceMeasurable: false, gated: false },
    ],
    environment: [["Ollama", "0.34.1"], ["Model", "medgemma1.5:latest (433252621ab1…)"], ["Corpus", "synthetic-ko-checkup-r2-0123456789abcdef"]],
    documentOutcomes: [{ documentId: corpus.documents[0].documentId, status: "ok", durationMs: 1234 }, { documentId: corpus.documents[1].documentId, status: "unreadable", failure: "AbortError: timeout", durationMs: 180000 }],
  });
  expect(markdown).toContain("# MedGemma 1.5 local synthetic experiment — synthetic-ko-lab-v1 (2026-09-17)");
  expect(markdown).toContain("| Metric | pdfbox-native-text | ollama-medgemma-1.5-4b-page-image |");
  expect(markdown).toContain("측정 불가 (페이지 전체 박스)");
  expect(markdown).toContain("| Gate | PASS | 게이트 아님 (evidence only) |");
  expect(markdown).toContain("| Ollama | 0.34.1 |");
  expect(markdown).toContain("AbortError: timeout");
  expect(markdown).toContain("## 문서별");
  expect(markdown).toContain("## 항목별");
  expect(markdown).toContain("Not a clinical, regulatory or production-accuracy claim");
  expect(markdown).not.toMatch(/diagnos|정상\b|비정상/);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec vitest run tests/medgemma-report.test.ts`
Expected: FAIL — cannot resolve `@/lib/medical-ai/medgemma-report`.

- [ ] **Step 3: Implement the renderer**

`apps/web/lib/medical-ai/medgemma-report.ts`:
```ts
import { medicalDocumentCorpusSchema, medicalDocumentRunSchema } from "./contracts.ts";
import { compareMedicalDocumentPipelines, type MedicalDocumentSyntheticContractRegression } from "./evaluation.ts";

export type FieldOutcome = { fieldId: string; label: string; expected: string; actual: string; outcome: "정확" | "오답" | "누락" | "환각" };
export type DocumentBreakdown = {
  documentId: string; expected: number; exact: number; wrong: number; missing: number; hallucinated: number;
  abstentionsRequired: number; abstentionsMet: number; fields: FieldOutcome[];
};

function shown(field: { value: string; unit: string; observedAt: string }) {
  return `${field.value} ${field.unit} @ ${field.observedAt}`;
}

/** Per-document, per-field outcome using the evaluator's exact-field rule (label, value, unit, observedAt). */
export function breakdownByDocument(corpusInput: unknown, runsInput: readonly unknown[]): DocumentBreakdown[] {
  const corpus = medicalDocumentCorpusSchema.parse(corpusInput);
  const runs = new Map(runsInput.map((run) => medicalDocumentRunSchema.parse(run)).map((run) => [run.documentId, run]));
  return corpus.documents.map((document) => {
    const run = runs.get(document.documentId);
    const candidates = run?.candidates ?? [];
    const byId = new Map(candidates.map((candidate) => [candidate.fieldId, candidate]));
    const fields: FieldOutcome[] = document.expectedMeasurements.map((expected) => {
      const actual = byId.get(expected.fieldId);
      if (!actual) return { fieldId: expected.fieldId, label: expected.label, expected: shown(expected), actual: "—", outcome: "누락" };
      const exact = actual.label === expected.label && actual.value === expected.value && actual.unit === expected.unit && actual.observedAt === expected.observedAt;
      return { fieldId: expected.fieldId, label: expected.label, expected: shown(expected), actual: `${actual.label}: ${shown(actual)}`, outcome: exact ? "정확" : "오답" };
    });
    const expectedIds = new Set(document.expectedMeasurements.map((field) => field.fieldId));
    for (const candidate of candidates) {
      if (!expectedIds.has(candidate.fieldId)) fields.push({ fieldId: candidate.fieldId, label: candidate.label, expected: "—", actual: `${candidate.label}: ${shown(candidate)}`, outcome: "환각" });
    }
    const abstentionsMet = document.requiredAbstentions.filter((required) => {
      const actual = run?.abstentions.find((item) => item.fieldId === required.fieldId);
      return !!actual && required.acceptedReasons.includes(actual.reason);
    }).length;
    return {
      documentId: document.documentId,
      expected: document.expectedMeasurements.length,
      exact: fields.filter((field) => field.outcome === "정확").length,
      wrong: fields.filter((field) => field.outcome === "오답").length,
      missing: fields.filter((field) => field.outcome === "누락").length,
      hallucinated: fields.filter((field) => field.outcome === "환각").length,
      abstentionsRequired: document.requiredAbstentions.length,
      abstentionsMet,
      fields,
    };
  });
}

export type ReportPipeline = { label: string; runs: readonly unknown[]; evidenceMeasurable: boolean; gated: boolean };
export type ReportInput = {
  generatedAt: string;
  corpus: unknown;
  pipelines: readonly ReportPipeline[];
  environment: readonly (readonly [string, string])[];
  documentOutcomes: readonly { documentId: string; status: string; failure?: string; durationMs: number }[];
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function metricRow(name: string, reports: { pipeline: ReportPipeline; report: MedicalDocumentSyntheticContractRegression }[], cell: (entry: { pipeline: ReportPipeline; report: MedicalDocumentSyntheticContractRegression }) => string) {
  return `| ${name} | ${reports.map(cell).join(" | ")} |`;
}

/** Markdown evidence for docs/status/<date>/medgemma-local-experiment.md. Metrics only; no interpretation of the values. */
export function renderMedgemmaExperimentReport(input: ReportInput) {
  const corpus = medicalDocumentCorpusSchema.parse(input.corpus);
  const compared = compareMedicalDocumentPipelines(input.corpus, input.pipelines.map(({ label, runs }) => ({ label, runs })));
  const reports = input.pipelines.map((pipeline) => ({ pipeline, report: compared.find((entry) => entry.label === pipeline.label)!.report }));
  const header = `| Metric | ${reports.map((entry) => entry.pipeline.label).join(" | ")} |`;
  const divider = `|---|${reports.map(() => "---").join("|")}|`;
  const lines = [
    `# MedGemma 1.5 local synthetic experiment — ${corpus.corpusId} (${input.generatedAt})`,
    "",
    "Bounded local evaluation approved in `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md`. The model saw only synthetic page images rendered from the generated corpus and was asked to transcribe label, value, unit and the labelled exam date; it was told not to judge anything. Its output never entered product code and is not stored as a record. Not a clinical, regulatory or production-accuracy claim (`synthetic-contract-regression-only`). Thresholds are shown for the parser gate only; for the model they are evidence, not a verdict.",
    "",
    "## 실행 환경",
    "",
    "| Pin | Value |",
    "|---|---|",
    ...input.environment.map(([key, value]) => `| ${key} | ${value} |`),
    "",
    "## 나란히 (same corpus, same evaluator)",
    "",
    header,
    divider,
    metricRow("Documents", reports, (entry) => String(entry.report.metrics.documentCount)),
    metricRow("Expected measurements", reports, (entry) => String(entry.report.metrics.expectedMeasurementCount)),
    metricRow("Returned measurements", reports, (entry) => String(entry.report.metrics.returnedMeasurementCount)),
    metricRow("Exact measurements", reports, (entry) => String(entry.report.metrics.exactMeasurementCount)),
    metricRow("Field precision", reports, (entry) => percent(entry.report.metrics.fieldPrecision)),
    metricRow("Field recall", reports, (entry) => percent(entry.report.metrics.fieldRecall)),
    metricRow("Field F1", reports, (entry) => percent(entry.report.metrics.fieldF1)),
    metricRow("Critical value exact", reports, (entry) => percent(entry.report.metrics.criticalValueExactRate)),
    metricRow("Evidence localization (IoU ≥ 0.8)", reports, (entry) => entry.pipeline.evidenceMeasurable ? percent(entry.report.metrics.evidenceLocalizationRate) : "측정 불가 (페이지 전체 박스)"),
    metricRow("Required abstention recall", reports, (entry) => percent(entry.report.metrics.requiredAbstentionRecall)),
    metricRow("Hallucinated measurements", reports, (entry) => `${entry.report.metrics.hallucinatedMeasurementCount} (${percent(entry.report.metrics.hallucinationRate)})`),
    metricRow("Gate", reports, (entry) => entry.pipeline.gated ? (entry.report.gate.passed ? "PASS" : `FAIL: ${entry.report.gate.failures.join(", ")}`) : "게이트 아님 (evidence only)"),
    "",
    "Delta rows are read left to right; the model column is descriptive. Evidence localization cannot be measured for the model because it returns no box (every candidate cites the whole page).",
    "",
  ];
  const breakdowns = reports.map((entry) => ({ entry, byDocument: breakdownByDocument(input.corpus, entry.pipeline.runs) }));
  lines.push("## 문서별", "", `| Document | ${reports.map((entry) => `${entry.pipeline.label} 정확/기대 · 오답 · 누락 · 환각 · 보류`).join(" | ")} | 모델 실행 |`, `|---|${reports.map(() => "---").join("|")}|---|`);
  for (const document of corpus.documents) {
    const cells = breakdowns.map(({ byDocument }) => {
      const row = byDocument.find((item) => item.documentId === document.documentId)!;
      return `${row.exact}/${row.expected} · ${row.wrong} · ${row.missing} · ${row.hallucinated} · ${row.abstentionsMet}/${row.abstentionsRequired}`;
    });
    const outcome = input.documentOutcomes.find((item) => item.documentId === document.documentId);
    const status = outcome ? `${outcome.status} (${Math.round(outcome.durationMs / 1000)} s)${outcome.failure ? ` — ${outcome.failure}` : ""}` : "—";
    lines.push(`| ${document.documentId} | ${cells.join(" | ")} | ${status} |`);
  }
  lines.push("", "## 항목별", "");
  for (const { entry, byDocument } of breakdowns) {
    lines.push(`### ${entry.pipeline.label}`, "", "| Document | Field | Expected | Returned | Outcome |", "|---|---|---|---|---|");
    for (const document of byDocument) {
      for (const field of document.fields) lines.push(`| ${document.documentId} | ${field.fieldId} (${field.label}) | ${field.expected} | ${field.actual} | ${field.outcome} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run the renderer tests**

Run the Step 2 command. Expected: `Test Files 1 passed (1)`.

- [ ] **Step 5: Write the runner script**

`apps/web/scripts/medgemma-local-experiment.mts`:
```ts
/**
 * Manual, local-only MedGemma 1.5 experiment over the synthetic Korean checkup corpus.
 * Not a CI step, not a gate. Talks only to http://127.0.0.1:11434. Run JSON stays under build/;
 * only the markdown summary is meant to be committed (docs/status/2026-09-17/medgemma-local-experiment.md).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { medicalDocumentCorpusSchema } from "../lib/medical-ai/contracts.ts";
import {
  EXPERIMENT_PROTOCOL,
  MODEL_TAG,
  OLLAMA_ORIGIN,
  PIPELINE_ID,
  describeOllamaModel,
  pdfDigest,
  protocolDigest,
  runDocument,
  sha256Hex,
  toModelRun,
  type ChatFetch,
  type ConceptCatalogue,
} from "../lib/medical-ai/medgemma-experiment.ts";
import { renderMedgemmaExperimentReport } from "../lib/medical-ai/medgemma-report.ts";

for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete process.env[key];

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const repository = resolve(webRoot, "../..");
const font = resolve(webRoot, "node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf");
const corpusDir = resolve(repository, "packages/korean-checkup-benchmark/build/corpus");
const pagesDir = resolve(corpusDir, "pages");
const conceptsPath = resolve(corpusDir, "concepts.json");
const nativeRunsPath = resolve(corpusDir, "native-text-runs.json");
const outDir = resolve(webRoot, "build/medgemma");
const rawDir = resolve(outDir, "raw");

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function gradle(args: string[]) {
  const result = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", ".\\gradlew.bat", ...args], { cwd: repository, stdio: "inherit", windowsHide: true })
    : spawnSync("./gradlew", args, { cwd: repository, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`gradle ${args.join(" ")} failed with status ${result.status}${result.error ? `: ${result.error.message}` : ""}`);
}

function output(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: repository, encoding: "utf8", windowsHide: true, timeout: 10_000 });
  return result.status === 0 ? result.stdout.trim() : "unavailable";
}

const localFetch: ChatFetch = (url, init) => {
  if (!url.startsWith(`${OLLAMA_ORIGIN}/`)) throw new Error(`refusing ${url}`);
  return fetch(url, init);
};

if (!existsSync(font)) throw new Error(`Pretendard font not found at ${font}; run pnpm install first.`);
if (/\s/.test(repository)) throw new Error("The repository path must not contain whitespace (Gradle --args splits on spaces).");
const startedAt = new Date().toISOString();
mkdirSync(rawDir, { recursive: true });
gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=generate --out ${corpusDir} --font ${font}`]);
gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=run-native-text --corpus ${corpusDir} --out ${nativeRunsPath}`]);
gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=render-pages --corpus ${corpusDir} --out ${pagesDir}`]);
gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=export-concepts --out ${conceptsPath}`]);

const corpusJsonBytes = readFileSync(resolve(corpusDir, "corpus.json"));
const corpus = medicalDocumentCorpusSchema.parse(JSON.parse(corpusJsonBytes.toString("utf8")));
const nativeRuns = JSON.parse(readFileSync(nativeRunsPath, "utf8")) as unknown[];
const catalogue = JSON.parse(readFileSync(conceptsPath, "utf8")) as ConceptCatalogue;
const pdfs = corpus.documents.map((document) => ({ documentId: document.documentId, bytes: readFileSync(resolve(corpusDir, `${document.documentId}.pdf`)) }));
const corpusPdfDigest = pdfDigest(pdfs);
if (!corpus.corpusId.endsWith(corpusPdfDigest.slice(0, 16))) throw new Error(`corpus.json corpusId ${corpus.corpusId} does not match the PDF digest ${corpusPdfDigest}`);
const corpusJsonSha256 = sha256Hex(corpusJsonBytes);
const corpusDigest = sha256Hex(`${corpusPdfDigest}\n${corpusJsonSha256}`);

const model = await describeOllamaModel(localFetch);
const models = {
  layout: { modelId: "pdfbox-render-150dpi", artifactSha256: "", executionMode: "offline-pinned" as const },
  semantic: { modelId: `medgemma1.5@ollama:${model.modelDigest.slice(0, 12)}`, artifactSha256: `sha256:${model.blobSha256}`, executionMode: "offline-pinned" as const },
};

const modelRuns: unknown[] = [];
const documentOutcomes: { documentId: string; status: string; failure?: string; durationMs: number }[] = [];
for (const document of corpus.documents) {
  const pageFiles = readdirSync(pagesDir).filter((name) => name.startsWith(`${document.documentId}-p`) && name.endsWith(".png")).sort();
  const pages = pageFiles.map((name) => {
    const bytes = readFileSync(resolve(pagesDir, name));
    return { page: Number(/-p(\d+)\.png$/.exec(name)![1]), pngBase64: bytes.toString("base64"), sha256: sha256Hex(bytes) };
  });
  const layoutDigest = sha256Hex(pages.map((page) => page.sha256).join("\n"));
  process.stderr.write(`${document.documentId}: ${pages.length} page(s)\n`);
  const outcome = await runDocument({ documentId: document.documentId, pages }, { fetchImpl: localFetch });
  for (const page of outcome.pages) writeFileSync(resolve(rawDir, `${document.documentId}-p${page.page}.json`), page.rawContent);
  documentOutcomes.push({ documentId: document.documentId, status: outcome.status, failure: outcome.failure, durationMs: outcome.durationMs });
  process.stderr.write(`  ${outcome.status} in ${Math.round(outcome.durationMs / 1000)} s${outcome.failure ? ` — ${outcome.failure}` : ""}\n`);
  modelRuns.push(toModelRun({
    gold: document, outcome, catalogue, createdAt: new Date().toISOString(),
    models: { ...models, layout: { ...models.layout, artifactSha256: `sha256:${layoutDigest}` } },
  }));
}
writeFileSync(resolve(outDir, "medgemma-runs.json"), `${JSON.stringify(modelRuns, null, 2)}\n`);

const finishedAt = new Date().toISOString();
const environment: [string, string][] = [
  ["Run window", `${startedAt} → ${finishedAt}`],
  ["Ollama", `${model.version} at ${OLLAMA_ORIGIN}`],
  ["Model", `${MODEL_TAG} · id ${model.modelDigest} · blob sha256:${model.blobSha256}`],
  ["Protocol digest (prompt, schema, options)", protocolDigest()],
  ["Options", `think=${EXPERIMENT_PROTOCOL.think}, temperature=${EXPERIMENT_PROTOCOL.options.temperature}, seed=${EXPERIMENT_PROTOCOL.options.seed}, num_predict=${EXPERIMENT_PROTOCOL.options.num_predict}, keep_alive=${EXPERIMENT_PROTOCOL.keepAlive}, document timeout ${EXPERIMENT_PROTOCOL.documentTimeoutMs / 1000} s`],
  ["Page rendering", `PDFBox 3.0.8 PDFRenderer ${EXPERIMENT_PROTOCOL.dpi} dpi PNG, one /api/chat call per page`],
  ["GPU / driver", output("nvidia-smi", ["--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"])],
  ["Node", process.version],
  ["Corpus", `${corpus.corpusId} (${corpus.documents.length} documents)`],
  ["Corpus digest (sha256 of PDF digest + corpus.json sha256)", corpusDigest],
  ["corpus.json sha256", corpusJsonSha256],
  ["Script commit", output("git", ["rev-parse", "HEAD"])],
  ["Run JSON", "apps/web/build/medgemma/medgemma-runs.json (not committed)"],
];
const report = renderMedgemmaExperimentReport({
  generatedAt: finishedAt.slice(0, 10),
  corpus,
  pipelines: [
    { label: "pdfbox-native-text", runs: nativeRuns, evidenceMeasurable: true, gated: true },
    { label: PIPELINE_ID, runs: modelRuns, evidenceMeasurable: false, gated: false },
  ],
  environment,
  documentOutcomes,
});
const reportPath = resolve(argument("--report") ?? resolve(repository, "docs/status/2026-09-17/medgemma-local-experiment.md"));
mkdirSync(resolve(reportPath, ".."), { recursive: true });
writeFileSync(reportPath, `${report}\n`);
writeFileSync(resolve(outDir, "summary.json"), `${JSON.stringify({ environment, documentOutcomes }, null, 2)}\n`);
process.stdout.write(`report written to ${reportPath}\n`);
```

- [ ] **Step 6: Register the script (not in CI)**

`apps/web/package.json` after line 12 (`"medical-ai:native-text-gate": …`):
```json
    "medical-ai:medgemma-experiment": "node scripts/medgemma-local-experiment.mts",
```
Root `package.json` after line 23:
```json
    "medical-ai:medgemma-experiment": "pnpm --filter @gc/web medical-ai:medgemma-experiment",
```
Do not add a CI step.

- [ ] **Step 7: Type-check and run the web suite**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm web:test`
Expected: `tsc` prints nothing; `Test Files 47 passed (47)`.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/web/lib/medical-ai/medgemma-report.ts apps/web/tests/medgemma-report.test.ts apps/web/scripts/medgemma-local-experiment.mts apps/web/package.json package.json && git commit -m "feat(medical-ai): manual medgemma-experiment runner and side-by-side report renderer (not a CI gate)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Review minors — `gradle()` error message, CI step comment

**Files:**
- Modify: `apps/web/scripts/native-text-gate.mts:24`
- Modify: `.github/workflows/ci.yml:132-133`

- [ ] **Step 1: Print the spawn error**

Line 24 of `native-text-gate.mts` becomes:
```ts
  if (result.status !== 0) throw new Error(`gradle ${args.join(" ")} failed with status ${result.status}${result.error ? `: ${result.error.message}` : ""}`);
```

- [ ] **Step 2: Document why the gate step has no `if:`**

Above `- name: Score the native-text parser on the generated synthetic Korean checkup corpus` insert:
```yaml
      # No `if:` on purpose: the parser gate runs on every push and PR after the JVM tests. The
      # MedGemma experiment (pnpm medical-ai:medgemma-experiment) is deliberately absent from CI —
      # it needs a local GPU and the pulled model and is evidence, not a gate.
```

- [ ] **Step 3: Verify**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm security:github-actions-policy && pnpm medical-ai:native-text-gate | grep '"passed"'`
Expected: `github-actions-policy: PASS` and `"passed": true`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add apps/web/scripts/native-text-gate.mts .github/workflows/ci.yml && git commit -m "chore: surface gradle spawn errors in the native-text gate; explain the unconditional CI step

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 12: Run the experiment, write the evidence, run every gate (PR deferred)

**Files:**
- Create: `docs/status/2026-09-17/medgemma-local-experiment.md` (written by the script, then reviewed), `docs/status/2026-09-17/wave2b.md`
- Modify: `docs/status/2026-09-16/wave2a-native-text.md` (last paragraph), `docs/revision/ASTRA_PRODUCT_REBUILD.md:346`, `docs/roadmap/2026-09-02-roadmap.md:19`, `PROJECT_GUIDE.md:66`

**Interfaces:**
- Consumes: `pnpm medical-ai:medgemma-experiment` (Task 10), every earlier task.

- [ ] **Step 1: Check the local Ollama server before spending GPU time**

Run: `curl -s http://127.0.0.1:11434/api/version && curl -s http://127.0.0.1:11434/api/tags | grep -o '"name":"medgemma1.5:latest"'`
Expected: `{"version":"0.34.1"}` and `"name":"medgemma1.5:latest"`. If either is missing, stop: the experiment needs the founder-approved local model and cannot be substituted.

- [ ] **Step 2: Run the experiment (about 10–20 minutes; cold model load ≈ 26 s)**

Run:
```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && export PATH="$HOME/.gc-node24:$PATH" && pnpm medical-ai:medgemma-experiment 2>&1 | tee apps/web/build/medgemma/console.log
```
Expected: 25 lines `synthetic-…: N page(s)` each followed by `ok in … s` (or `unreadable … — <failure>`), then `report written to …/docs/status/2026-09-17/medgemma-local-experiment.md`; exit 0. Confirm nothing left the machine: the script only builds URLs from `OLLAMA_ORIGIN` (Task 9 test) — no other check is possible or needed.

- [ ] **Step 3: Review the generated report**

Open `docs/status/2026-09-17/medgemma-local-experiment.md` and check: the environment table has every pin from `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md` (Ollama version, model tag/id/blob, script commit, corpus id + digest, run window, GPU/driver); the model's evidence-localization cell reads `측정 불가 (페이지 전체 박스)`; the model gate cell reads `게이트 아님 (evidence only)`; the parser column reads `PASS`; no `referenceRange` string appears (`grep -c referenceRange docs/status/2026-09-17/medgemma-local-experiment.md` → `0`). Do not edit numbers. Append this section at the end of the file by hand:
```markdown
## 한계

- 합성 페이지 이미지 25장짜리 결과지 31쪽에 대한 1회 실행이다. 실제 결과지·실제 스캔·실 PHI는 사용하지 않았다.
- 모델은 박스를 주지 않으므로 evidence localization은 측정하지 않았다. 페이지 단위 박스는 채점기 입력 형식을 맞추기 위한 것이다.
- 모델 출력은 `apps/web/build/medgemma/`에만 있고 저장소에 커밋하지 않는다. 제품 코드 경로(core·worker·web 런타임)는 모델을 호출하지 않는다.
- 이 문서는 handoff 조건 1(약관 수락)만 충족한 bounded local experiment의 증거이며, 조건 2–7(아티팩트 영수증·검토된 OCI 이미지·서명 승인·재해시 런처·샌드박스 실행·digest 결합 admission)은 열려 있다. `release/readiness.json`과 "OCR·의료 AI 비활성" 문구는 바뀌지 않는다.
- 진단·정상/비정상·참고치·위험·치료에 대한 주장은 없다.
```

- [ ] **Step 4: Write the wave evidence**

`docs/status/2026-09-17/wave2b.md`:
```markdown
# Wave 2B evidence — MedGemma 1.5 local synthetic experiment, labelled exam dates, date correction, benchmark determinism (2026-09-17)

Branch `codex/wave5-medgemma-eval-and-dates`. Synthetic only. Release remains NO_GO; no readiness gate or verdict changed. PR deferred.

## What exists now
- **Worker date rule.** Only a labelled date (검사일/검진일/채취일/검사 일자/검진 일자/채취 일자/Date/Exam date/Test date/Collection date, label anywhere in the line, first date after the label) is the document date. A bare date is never used. Two different labelled dates make the whole document one `ambiguous_value` abstention (`문서 전체`) with zero candidates; the review screen names it "검사일이 둘 이상이라 확실하지 않음". No labelled date → every recognised row is `missing_evidence` (unchanged). The two demo PDFs carry `Date:` and parse as before.
- **Date correction.** `POST /api/foundation/candidates/{id}/confirmation` accepts an optional `observedOn` (ISO date, 1900-01-01..today Asia/Seoul; 400 `observed_on_invalid` / `observed_on_out_of_range`). V8 adds `gc_health_record.original_observed_on`; the candidate row keeps its own date. `RecordReceipt.originalObservedOn` is always present; `reviewDecision = CORRECTED` when the value or the date differs; `HealthEvent.corrected` follows. Audit stays `CANDIDATE_CONFIRMED`/`CANDIDATE_CORRECTED` with no date and no value. The review card has a "검사일 수정" form (`type=date`, future and pre-1900 refused); the records screen shows "사용자가 검사일을 수정함 · 원래 YYYY. M. D.". This is a confirmation of what the document says, not clinical validation.
- **Benchmark R2.** 25 documents (4 layouts × 6 variants + `synthetic-hospital-two-column-v6`, which prints 생년월일 before a mid-line labelled 검사일). PDF bytes are deterministic (fixed PDFBox document id and info dates, no XMP; proven by a two-generation byte test). `corpusId = synthetic-ko-checkup-r2-<first 16 hex of sha256 over "<documentId> <sha256(pdf)>" lines>`. New CLIs `render-pages` (PDFBox 150 dpi PNG per page, 31 pages) and `export-concepts`.
- **MedGemma experiment.** `pnpm medical-ai:medgemma-experiment` (manual, not in CI) renders the corpus, sends each page to the local Ollama `medgemma1.5:latest` with a pinned transcription-only prompt, JSON-schema `format`, `think:false`, temperature 0, one call per page, 180 s per document, maps rows to `medical-document-run.v1` with the whole-page box and catalogue aliases, drops any `referenceRange`, scores parser and model with the same `evaluateMedicalDocumentPipeline`, and writes `docs/status/2026-09-17/medgemma-local-experiment.md`. Run JSON stays under `apps/web/build/medgemma/`. Model output never enters product code.

## Evidence (local, 2026-09-17)
| Gate | Result |
|---|---|
| runtime-policy | <paste the one-line output> |
| readiness validate | <paste; the verdict must still be NO_GO> |
| github-actions-policy | <paste> |
| web:test | <paste `Test Files … passed`> |
| web build / tsc --noEmit | <paste> |
| auth-security gate | <paste> |
| gradlew cleanTest test (embedded PostgreSQL) | <paste `BUILD SUCCESSFUL in …`; tests/skipped/failures from the XML> |
| medical-ai:native-text-gate | <paste documentCount 25, fieldF1, requiredAbstentionRecall, hallucinationRate, passed, corpusId> |
| foundation:e2e | <paste `N passed`> |
| medical-ai:medgemma-experiment | <paste the model column of the side-by-side table: exact/expected, F1, hallucinations, abstention recall, documents unreadable> — evidence only, see `medgemma-local-experiment.md` |

## Limits
No hosted run. One local execution of one quantized model on 31 synthetic pages; no real layout, scan or PHI was measured. Evidence localization for the model is not measurable. Handoff conditions 2–7 in `docs/implementation/medical-document-runner.md` remain open. Nothing here is a diagnosis, normality, reference-range, trend or risk claim.
```
Replace every `<paste …>` with the real command output captured in Step 6 before committing; a row without real output is a plan failure.

- [ ] **Step 5: Ledger, roadmap, guide, wave 2A pointer**

- `docs/revision/ASTRA_PRODUCT_REBUILD.md` — add after the M11 row (line 346):
```markdown
| M12 라벨 검사일 · 검사일 정정 · 벤치마크 R2 · MedGemma 로컬 실험 | implemented locally; worker uses labelled dates only, review can correct the exam date (V8 `original_observed_on`), benchmark is byte-deterministic with 25 documents, MedGemma 1.5 scored locally as evidence only (not a gate, not in product code); see `docs/status/2026-09-17/wave2b.md` |
```
- `docs/roadmap/2026-09-02-roadmap.md` — add after the A9 row (line 19):
```markdown
| A10 | Labelled-date-only parsing with document-level date conflict, exam-date correction on review, benchmark R2 (deterministic bytes, digest corpusId, birth-date-first document, page renderer), bounded local MedGemma 1.5 evaluation as evidence (handoff 2–7 still open) | `docs/status/2026-09-17/wave2b.md`, `docs/status/2026-09-17/medgemma-local-experiment.md` | implemented locally |
```
- `PROJECT_GUIDE.md` §2, the "Medical AI/OCR" row: append one sentence to the existing cell: ` A bounded local MedGemma 1.5 experiment (Ollama, synthetic pages only, manual script) was scored with the same evaluator as evidence only; its output is not in product code (`docs/status/2026-09-17/medgemma-local-experiment.md`).`
- `docs/status/2026-09-16/wave2a-native-text.md` — replace the last paragraph (`검사일은 라벨(…)이 있는 줄을 우선하고 …`) with:
```markdown
검사일 규칙은 Wave 2B에서 바뀌었다: 라벨 없는 날짜는 쓰지 않고, 라벨은 줄 안 어디든 인정하며, 라벨 날짜가 서로 다르면 문서 단위 abstention이다. 검토 화면에서 검사일을 정정할 수 있다. 벤치마크는 25개 문서(R2)가 됐다. `docs/status/2026-09-17/wave2b.md` 참조.
```

- [ ] **Step 6: Run every gate and capture the outputs**

Run (each command separately so the output is attributable):
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
Expected: `runtime-policy: PASS …`; `release-readiness: NO_GO …` (exit 0, verdict unchanged); `github-actions-policy: PASS`; `Test Files 47 passed (47)`; Next build completes; `tsc` silent; `auth-security-gate: PASS`; `BUILD SUCCESSFUL`; gate JSON with `"documentCount": 25` and `"passed": true`; `3 passed`; `git status` shows only the files of this task (plus the pre-existing untracked `apps/web/next-env.d.ts` change, which stays out of the commit). Paste the outputs into `wave2b.md` Step 4.

- [ ] **Step 7: Inspect the diff for anything that must not be committed**

Run: `cd /c/Users/Jason/Documents/genome-companion-korea-ux && git status --short && git diff --cached --stat && git ls-files --others --exclude-standard | grep -E '\.(pdf|png|json)$' ; echo "exit $?"`
Expected: no PDF/PNG and no run JSON under `apps/web/build/` or `packages/korean-checkup-benchmark/build/` are untracked-and-committable (the grep prints nothing; `build/` is gitignored). `docs/status/2026-09-17/medgemma-local-experiment.md` contains no `referenceRange`.

- [ ] **Step 8: Commit the evidence (no PR)**

```bash
cd /c/Users/Jason/Documents/genome-companion-korea-ux && git add docs/status/2026-09-17/medgemma-local-experiment.md docs/status/2026-09-17/wave2b.md docs/status/2026-09-16/wave2a-native-text.md docs/revision/ASTRA_PRODUCT_REBUILD.md docs/roadmap/2026-09-02-roadmap.md PROJECT_GUIDE.md && git commit -m "docs: Wave 2B evidence — MedGemma local experiment report, labelled dates, date correction, benchmark R2

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Stop here. Do not push and do not open a PR; the founder decides when the branch goes up.

---

## Self-review

**Spec coverage.** §1 boundaries → Global Constraints, Tasks 9/10 (origin lock, proxy env deleted, run JSON under `build/`, referenceRange dropped), Task 12 (readiness untouched). §2 experiment → Task 8 (`render-pages`, `<documentId>-p<N>.png`), Task 9 (`/api/chat`, `think:false`, temperature 0, `format`, `keep_alive`, per-page call, 180 s per document, unreadable on failure, page box, `sourceTextSha256` of the row string, pinned `models`, alias normalization), Task 10 (same evaluator + `compareMedicalDocumentPipelines`, per-document/per-field table, environment pins, protocol digest, manual script not in CI). §3 worker → Task 1 (+ copy in Task 2); benchmark → Task 3; core → Task 5; web → Task 6/7. §4 determinism + corpus digest → Task 4 (see note below); minors → Task 11. §5 copy → Tasks 2 and 6 verbatim. §6 tests → each task's tests; evidence docs, ledger §28, roadmap, guide §2 → Task 12. §7 out of scope → nothing added.

**Adjusted requirement (spec §4).** The spec defines the corpus digest as "sha256 of all PDF sha256s + corpus.json sha256" *and* wants it inside `corpus.json` as `corpusId`. A digest that includes `corpus.json` cannot be stored inside `corpus.json`. Resolution: `corpusId` carries the PDF digest (Task 4, sha256 over `"<documentId> <sha256(pdf)>"` lines, first 16 hex); the full digest `sha256(pdfDigest + "\n" + corpus.json sha256)` is computed by the experiment script and recorded in the report and `wave2b.md` (Task 10/12). The gate report already prints `corpusId`.

**Placeholder scan.** The only `<paste …>` markers are in Task 12's evidence table and are explicitly required to be replaced with captured output before the commit.

**Type consistency.** `confirmCandidate(principal, candidateId, confirmedValue, idempotencyKey, confirmedObservedOn: String? = null)` (Task 5) ↔ controller passes `body.observedOn` (Task 5) ↔ web `confirmCandidate(candidateId, value, idempotencyKey, observedOn?)` (Task 6) ↔ `onConfirm(value, observedOn?)` (Task 6/7). `RecordReceipt.originalObservedOn: String` ↔ `recordSchema.originalObservedOn: z.string().date()`. `DateResolution.Conflicting(dates, evidencePage)` used only inside Task 1. `CorpusWriter.pdfDigest` ↔ TS `pdfDigest` (Task 9 test pins the rule; Task 10 script checks `corpusId` against it). `PageRenderer.render` ↔ CLI `render-pages` ↔ script. `ConceptCatalogue` JSON shape `{conceptCode, displayKo, aliases}` ↔ `export-concepts`. `DocumentOutcome`/`ModelPageResult` produced by `runDocument` and consumed by `toModelRun` and the report's `documentOutcomes`. `ReportPipeline{label, runs, evidenceMeasurable, gated}` used identically in the test and the script.
