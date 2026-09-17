# Wave 5 — 개념 정확도 (결과지 표기 보존 · 별칭 정리 · 단위 가드 · LOINC 감사 · 카탈로그 확장) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep and show the item name exactly as the result sheet printed it, remove every alias that is broader than its concept, attach a concept only when the unit is one the concept accepts, export a LOINC code only when a public loinc.org read confirms it is no more specific than the label, add the common Korean check-up numeric items, and prove all of it on the synthetic benchmark.

**Architecture:** The alias dictionary stays in two copies bound by an equality test: `MedicalConceptCatalogue` (Kotlin, `packages/document-boundary`) and the `gc_medical_concept` seed (V7 + new forward-only V11). `MedicalConcept` gains `acceptedUnits` and `loincExport`; one function `MedicalConcept.accepts(unit)` is the unit guard used by both core's `MedicalConceptNormalizer` and the benchmark runner. The worker already sends the raw label; core now stores it as `original_label` on the candidate, copies it to the record version at confirmation, inherits it on correction, and returns it (`originalLabel`) on receipts, HealthEvent, SeriesPoint, export v3 and as FHIR `code.text`. The FHIR mapper reads `loincExport` from the concept data instead of a hard-coded list. The web adds one optional strict zod key and one conditional line "결과지 표기: …".

**Tech Stack:** Kotlin 2.3.21 / Java 21 / Gradle 8.14.3 (`./gradlew.bat`), Spring Boot 3.5.16 + JdbcTemplate + Flyway, JUnit 5 + AssertJ + MockMvc, PDFBox; Next 16.3.3 / React 19 / zod 4 / vitest + Testing Library + jest-axe + msw / Playwright 1.62; pnpm 11.20.0, Node 24.20.0; embedded PostgreSQL 16 for gated JVM tests and the browser lifecycle.

Spec: `docs/superpowers/specs/2026-09-17-wave5-concept-accuracy-design.md` (founder-approved 2026-09-17; no gate document — every item narrows a claim or preserves document text). Authority: `PROJECT_GUIDE.md` §6, `AGENTS.md`. Previous wave: `docs/superpowers/plans/2026-09-17-wave4-measurement-history-fhir.md`, evidence `docs/status/2026-09-17/wave4.md` (final-review item I4/F4 is what this wave resolves).

## Global Constraints

- Toolchain: Node `24.20.0`, pnpm `11.20.0`, Java `21`. In every Git Bash shell first run `export PATH="$HOME/.gc-node24:$PATH"`. Gradle is `./gradlew.bat` from the repository root `C:/Users/Jason/Documents/genome-companion-korea-ux`. Core PostgreSQL tests: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'` then `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon` (`cleanTest` is required to re-run them). Other JVM modules: `./gradlew.bat :packages:document-boundary:test :apps:document-worker:test :packages:korean-checkup-benchmark:test --no-daemon`. Web: `pnpm web:test`, `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`, `pnpm medical-ai:native-text-gate`. Browser: additionally `export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'`, then `pnpm foundation:e2e`.
- Branch: `codex/wave10-concept-accuracy`, stacked on `codex/wave9-history-screen`. Never push to `main`. Never stage `apps/web/next-env.d.ts`. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Boundary (spec §1): no diagnosis, normal/abnormal, reference-range display, direction, meaning or forecast. The forbidden list in `apps/web/tests/korean-ux-copy.test.ts` stays as it is and runs over every new user-facing file. Reference-range text appears only in the two exports. Qualitative results (음성/양성/미량 …) stay out of scope and keep abstaining. **Existing rows are never re-normalised** (their raw label was never stored).
- Next.js gains no API route, token or authorization rule. `release/readiness.json` unchanged. Synthetic data only. Audit rows carry no value, date or label. Jackson `fail-on-unknown-properties: true` and `default-property-inclusion: non_null` stay global: the server omits null keys, so every new zod key is `.optional()` (not nullable) inside a `.strict()` object, every schema change updates `apps/web/tests/fixtures/foundation.ts`, and an unknown request field (for example `originalLabel` on a correction) returns 400.
- The existing reference-range leak assertions (no `reference` key, no `120-199` value) on candidates, records, record detail, health-events, changes and series must keep passing. `originalLabel` **is** allowed in those responses (it is document text the person already sees). No test label may contain a range or the digits `120-199`.
- V11 file name: `V11__concept_accuracy.sql`. Columns exactly: `gc_candidate.original_label VARCHAR(80)`, `gc_health_record_version.original_label VARCHAR(80)` (nullable; existing rows stay NULL), `gc_medical_concept.accepted_units JSONB NOT NULL DEFAULT '[]'`, `gc_medical_concept.loinc_export BOOLEAN NOT NULL DEFAULT TRUE`. Forward-only and safe on a populated database: nullable columns or defaults, alias `UPDATE`s keyed by `concept_code`, plain `INSERT`s for new concept codes (V7–V10 use no `ON CONFLICT`; `gc_medical_concept` is seed-only and the FK on `concept_code` guarantees no new code can already exist).
- **Flyway checksum:** `gc_test` is a persistent local database. Finish V11 before the first core test run. If V11 must change after it was applied locally, undo it in `gc_test` only, then re-run: `DELETE FROM flyway_schema_history WHERE version = '11'; ALTER TABLE gc_candidate DROP COLUMN original_label; ALTER TABLE gc_health_record_version DROP COLUMN original_label; ALTER TABLE gc_medical_concept DROP COLUMN accepted_units, DROP COLUMN loinc_export;` plus `UPDATE`s restoring the five V7 alias arrays and `DELETE FROM gc_medical_concept WHERE concept_code IN (<the V11 inserts>)` after truncating `gc_candidate`/`gc_health_record` (synthetic test data only). Never edit V7–V10.
- Alias rule (spec §3): an alias is never broader than its concept. Exact alias sets: `glucose` (혈당): `Glucose`, `Blood Glucose`, `혈당(Glucose)`; `fasting-glucose`: `Fasting Glucose`, `FBS`, `FPG`, `식전혈당` (the spec's `공복혈당`/`공복 혈당` are the display name under `aliasKey`, see decision 1); `postprandial-glucose` (식후혈당): `식후 2시간 혈당`, `PP2`, `2hr PP`, `Postprandial Glucose`; `bilirubin` (빌리루빈): `Bilirubin`; `total-bilirubin`: `Total Bilirubin`, `T-Bil`; `direct-bilirubin` (직접빌리루빈): `Direct Bilirubin`, `D-Bil`; `hs-crp` (고감도 CRP): `hs-CRP`, `hsCRP`, `고감도 C-반응단백`; `crp` loses `hs-CRP`; `gfr` (사구체여과율): `GFR`; `egfr`: `e-GFR`, `estimated GFR`, `추정 사구체여과율`, `신사구체여과율(e-GFR)`.
- Invariants (tests): no alias key belongs to two concepts; no one-character entry in any `aliases` list (existing `K` is removed from `potassium`); every concept has a non-empty `acceptedUnits` whose first element is its canonical unit, so every two-letter alias is unit-guarded; the broad labels `혈당`, `Glucose`, `Bilirubin`, `hs-CRP`, `GFR`, `사구체여과율` resolve to the generic concepts.
- Unit guard (spec §4): a label that matches a concept keeps the concept only when `MedicalUnitSpelling.canonical(unit)` is in that concept's `accepted_units`; otherwise `conceptCode = null` and `label` stays the raw label (same path as "no concept"). No conversion, no silent substitution. Accepted-unit examples verbatim from the spec: glucose family `["mg/dL","mmol/L"]`, cholesterol family `["mg/dL","mmol/L"]`, creatinine `["mg/dL","µmol/L"]`, hemoglobin `["g/dL","g/L"]`, everything else canonical only unless the table in Task 2 lists more.
- LOINC (spec §5): `loinc_export = FALSE` at least for `ldl-cholesterol` (13457-7 is a calculation), `vitamin-d` (1989-3 is D3), `egfr` (62238-1 is one formula). `fasting-glucose`, `crp`, `total-bilirubin` return to `TRUE` (their labels are now specific) unless the audit says otherwise. Generic concepts (`glucose`, `bilirubin`, `gfr`) have no LOINC. The audit reads public pages `https://loinc.org/<code>/` only — no login, no download, no terms acceptance — and **never fills a name from memory**. A code that could not be fetched or whose name does not fit ships as `loinc_code = NULL` (new concepts) or `loinc_export = FALSE` with the reason (existing concepts).
- Export: JSON `schemaVersion` = `alm-health-events-export.v3` with `events[].originalLabel`. FHIR `code.text = originalLabel ?: label`; `code.coding` only when the concept's `loincExport` is true (data-driven; the hard-coded four-concept list from commit `2af31e2` is deleted); `category` stays omitted for vitals/body measurements and uncoded events.
- Web copy, exact: `결과지 표기: {원문}` (only when it differs from the shown name) and, in the evidence drawer only, `이 기록은 결과지 표기를 보존하기 전에 저장됐어요.` when the event has no `originalLabel`.
- CI renders with Linux fonts: every new UI line gets `min-width:0` and `overflow-wrap:anywhere`; tables stay inside their scrolling wrapper; the e2e `captureMatrix` fails on any 320px horizontal overflow.
- Benchmark (spec §7): `fieldF1 = 1`, `referenceRangeAccuracy = 1` stay; new `conceptAccuracy = 1`. The `corpusId` changes because PDFs are added. It is pinned by value nowhere in code (tests match `synthetic-ko-checkup-r2-[0-9a-f]{16}`); the value `synthetic-ko-checkup-r2-e6befc286ae6ce1d` in `docs/status/2026-09-17/{wave2b,wave2c,wave3,wave4,medgemma-local-experiment}.md` and in `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md` is **historical and stays untouched**; the new id is recorded in `docs/status/2026-09-17/wave5.md`, and one sentence saying Runs 1–3 used the previous corpus is added to the experiment document and the governance note.
- Intermediate red states that are by design: after Task 2 the core test `medicalConceptSeedMatchesTheSharedCatalogue` is red until Task 3; `pnpm foundation:e2e` is red from Task 4 until Task 7 (strict web schema, `code.text`, export v3). Every other command named in a task must be green at that task's commit.
- Gates before finishing (Task 8): `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `pnpm web:test`, `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`, `pnpm --dir apps/web build`, `pnpm auth-security:gate`, `pnpm security:github-actions-policy`, `./gradlew.bat cleanTest test --no-daemon` with `GC_TEST_POSTGRES_URL`, `pnpm medical-ai:native-text-gate`, `pnpm foundation:e2e`.

### Decisions this plan makes where the spec is silent

1. `aliasKey` removes whitespace and case, and the catalogue refuses duplicate keys even inside one concept, so a spec alias that collapses onto the display name (`공복혈당`, `공복 혈당`, `혈당`, `eGFR`) is covered by `displayKo` and is not stored in `aliases`.
2. "No one-letter alias" applies to `aliases`. The existing display name `키` (height) stays, because renaming it would rename existing series; it is unit-guarded (`cm`). New concepts whose natural Korean name is one character get a longer display name: `인(P)`, `혈청철`.
3. The e2e fixture PDF is Helvetica/ASCII, so it cannot carry `혈당`. The January fixture gains the ASCII broad label `Glucose: 92 mg/dL`; the browser test checks "혈당" plus "결과지 표기: Glucose" on review and then **excludes** that candidate so no downstream count changes. "Same name → no line" is proven in vitest and, with a Korean `혈당` row, in the core integration test and the benchmark.
4. The seeded LOINC codes are tied to the canonical unit's property (mass/volume), so FHIR `code.coding` is emitted only when `loincExport` is true **and** the record's unit equals the concept's canonical unit (a `mmol/L` cholesterol never gets the mass/volume code).
5. `conceptAccuracy` = matched candidates whose gold carries an expectation, where the expectation is either `expectedConceptCode` or `expectedNoConcept: true` (needed for the unit-mismatch rows; Jackson omits nulls so "no concept" needs its own key). A run candidate carries `conceptCode?`. `fieldId` stays label-only so rows keep their identity.
6. For an existing concept that fails the audit the code stays in the table with `loinc_export = FALSE` (the task brief's rule); only new concepts ship `loinc_code = NULL`.
7. `MedicalConcept`'s two new constructor parameters have defaults (`acceptedUnits = listOf(canonicalUnit)`, `loincExport = false`) only so core compiles between Task 2 and Task 3.
8. 측정 이력 table: a column `결과지 표기` appears only in a series where at least one point's `originalLabel` differs from the series name; a cell is empty when that point's label is the same or absent.
9. New unit spellings needed by the new items: `fL`, `pg`, `mm/hr`, `µg/dL`, `µU/mL`, `U/mL`, `IU/mL`, `µmol/L`, `g/L` (+ variants `ug/dl`, `uu/ml`, `mm/h`, `umol/l`). `white-blood-cells` and `platelets` also accept `/µL` (the benchmark already prints WBC in `/uL`).

---

## File map

| Path | Responsibility |
|---|---|
| `docs/status/2026-09-17/loinc-audit.md` (create) | audit evidence + the final value table Tasks 2–3 consume |
| `packages/document-boundary/.../MedicalConceptCatalogue.kt`, `MedicalUnitSpelling.kt` + tests (modify) | 69 concepts, `acceptedUnits`, `loincExport`, `accepts`, `resolve`, invariants |
| `apps/core-api/src/main/resources/db/migration/V11__concept_accuracy.sql` (create) | columns + seed updates/inserts |
| `apps/core-api/.../foundation/MedicalConceptNormalizer.kt`, `FoundationRepository.kt` (modify) | unit guard, `originalLabel` stored / copied / inherited |
| `apps/core-api/.../foundation/{FoundationLifecycleService,HealthEventProjection,SeriesProjection,FhirExport}.kt` (modify) | `originalLabel` in responses, export v3, data-driven LOINC |
| core tests `MedicalConceptNormalizerTest`, `HealthEventProjectionTest`, `SeriesProjectionTest`, `FhirObservationMapperTest`, `FoundationLifecyclePostgresIntegrationTest` (modify) | |
| `packages/korean-checkup-benchmark/.../{CheckupCorpusGenerator,CorpusWriter,NativeTextRunner,BenchmarkMain}.kt` + tests (modify) | `extended-panel` layout, gold/run concept keys |
| `apps/web/lib/medical-ai/{contracts,evaluation,native-text-report}.ts` + tests (modify) | `conceptAccuracy` |
| `apps/web/lib/format/original-label.ts` (create), `apps/web/lib/foundation/client.ts`, `apps/web/tests/fixtures/foundation.ts`, `CandidateReview.tsx`, `IntegratedRecords.tsx`, `EvidenceDrawer.tsx`, `components/my-data/history/MeasurementHistory.tsx`, CSS, tests (modify) | "결과지 표기" |
| `apps/web/lib/foundation/synthetic-document.ts`, `apps/web/tests/synthetic-document.test.ts`, `apps/web/e2e/foundation-lifecycle.spec.ts` (modify) | e2e |
| `docs/status/2026-09-17/wave5.md` (create); `AGENTS.md`, `PROJECT_GUIDE.md`, `docs/roadmap/2026-09-02-roadmap.md`, `docs/status/2026-09-17/medgemma-local-experiment.md`, `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md` (modify) | evidence and ledger |

---

### Task 1: LOINC audit (evidence file and the final value table)

**Files:**
- Create: `docs/status/2026-09-17/loinc-audit.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the section `## Final values` of `loinc-audit.md` — one row per concept: `concept_code | loinc_code (final, or NULL) | loinc_export (TRUE/FALSE)`. Tasks 2 and 3 copy these two values per concept and nothing else from this file.

Rules (apply in this order, write the rule id in the 사유 column):
- **R0** generic concepts `glucose`, `bilirubin`, `gfr`: no code, `NULL`/`FALSE`, not fetched.
- **R1** page not readable without login, download or accepting terms, or the fetch failed: new concept → `NULL`/`FALSE`; existing concept → keep code, `FALSE`. Write "not fetched" in the name column. Never type a name you did not read on the page.
- **R2** the fetched Long Common Name names a different analyte than the concept: same outcome as R1, 사유 "name mismatch".
- **R3** the name is more specific than every label of the concept in method, formula, timing or specimen handling (examples of wording that triggers it: "by calculation", "by … method", "creatinine-based formula (MDRD)", "25-hydroxyvitamin D3", "by Test strip", "--2 hours post …" when the concept's labels do not say so): keep code, `FALSE`. `ldl-cholesterol`, `vitamin-d`, `egfr` are `FALSE` whatever the page says (spec §5).
- **R4** otherwise `TRUE`. The specimen words "in Serum or Plasma", "in Blood", "in Serum, Plasma or Blood" are accepted for blood-panel concepts, and "[Mass/volume]"-style property words are accepted because Task 4 only emits a code when the record is in the canonical unit.

Candidate list. Existing 38 (codes as seeded by V7): total-cholesterol 2093-3, ldl-cholesterol 13457-7, hdl-cholesterol 2085-9, triglycerides 2571-8, fasting-glucose 1558-6, hba1c 4548-4, ast 1920-8, alt 1742-6, gamma-gtp 2324-2, alp 6768-6, total-bilirubin 1975-2, albumin 1751-7, bun 3094-0, creatinine 2160-0, egfr 62238-1, uric-acid 3084-1, hemoglobin 718-7, red-blood-cells 789-8, white-blood-cells 6690-2, platelets 777-3, urine-protein 5804-0, urine-glucose 5792-7, systolic-blood-pressure 8480-6, diastolic-blood-pressure 8462-4, pulse 8867-4, height 8302-2, weight 29463-7, bmi 39156-5, waist-circumference 8280-0, vitamin-d 1989-3, tsh 3016-3, free-t4 3024-7, crp 1988-5, ferritin 2276-4, sodium 2951-2, potassium 2823-3, calcium 17861-6, total-protein 2885-2.

New concepts — **proposed, unverified** (a proposal is only a URL to read; it has no standing until the page confirms it): postprandial-glucose 1521-4, direct-bilirubin 1968-7, hs-crp 30522-7, hematocrit 4544-3, mcv 787-2, mch 785-6, mchc 786-4, chloride 2075-0, phosphorus 2777-1, magnesium 19123-9, iron 2498-4, tibc 2500-7, vitamin-b12 2132-9, folate 2284-8, esr 30341-2, ldh 2532-0, amylase 1798-8, ck 2157-6, free-t3 3051-0, t3 3053-6, non-hdl-cholesterol 43396-1, insulin 20448-7, afp 1834-1, cea 2039-6, psa 2857-1, ca19-9 24108-3, ca125 10334-1, rf 11572-5.

- [ ] **Step 1: Create the evidence file skeleton**

```markdown
# LOINC audit — Wave 5 (2026-09-17)

Method: each code's public page `https://loinc.org/<code>/` was read (HTTP GET, no login, no download, no terms acceptance). The Long Common Name is copied exactly as the page showed it on the date given. Nothing in this table was filled from memory; a page that could not be read says "not fetched". Rules R0–R4 are defined in `docs/superpowers/plans/2026-09-17-wave5-concept-accuracy.md` Task 1. LOINC is informational metadata here: it is never used for matching and never implies a meaning.

| concept_code | loinc_code | Long Common Name (as fetched) | URL | 확인일 | loinc_export | 사유 |
|---|---|---|---|---|---|---|

## Final values

| concept_code | loinc_code | loinc_export |
|---|---|---|
```

- [ ] **Step 2: Fetch every candidate page and fill one row per concept (69 rows: 38 + 28 + 3 generic)**

For each `<code>` run a plain read of `https://loinc.org/<code>/` (WebFetch tool asking only for "the exact Long Common Name shown on the page", or `curl -sL https://loinc.org/<code>/ | grep -i -m1 -A2 "Long Common Name"`). If the response is a login wall, a consent/terms interstitial or an error, do not click through: apply R1. Copy the name character for character.

- [ ] **Step 3: Apply R0–R4 and fill `## Final values`**

Expected shape: `ldl-cholesterol | 13457-7 | FALSE`, `vitamin-d | 1989-3 | FALSE`, `egfr | 62238-1 | FALSE`, `glucose | NULL | FALSE`, `bilirubin | NULL | FALSE`, `gfr | NULL | FALSE`; every other row decided by the rules. Self-check: `grep -c "^| [a-z0-9-]* |" docs/status/2026-09-17/loinc-audit.md` prints `138` (69 rows in each table).

- [ ] **Step 4: Commit**

```bash
git add docs/status/2026-09-17/loinc-audit.md
git commit -m "docs: Wave 5 LOINC audit — names read from public loinc.org pages, export flags decided

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 2: Kotlin catalogue — narrowed aliases, generic concepts, accepted units, `loincExport`, new numeric concepts, invariants

**Files:**
- Modify: `packages/document-boundary/src/main/kotlin/kr/co/genomecompanion/documentboundary/MedicalConceptCatalogue.kt`
- Modify: `packages/document-boundary/src/main/kotlin/kr/co/genomecompanion/documentboundary/MedicalUnitSpelling.kt`
- Test: `packages/document-boundary/src/test/kotlin/kr/co/genomecompanion/documentboundary/MedicalConceptCatalogueTest.kt`, `MedicalUnitSpellingTest.kt`

**Interfaces:**
- Consumes: `docs/status/2026-09-17/loinc-audit.md` § Final values (Task 1).
- Produces: `data class MedicalConcept(conceptCode: String, displayKo: String, loincCode: String?, canonicalUnit: String, aliases: List<String>, acceptedUnits: List<String> = listOf(canonicalUnit), loincExport: Boolean = false)`, `fun MedicalConcept.accepts(unit: String): Boolean`, `MedicalConceptCatalogue.resolve(label: String, unit: String): MedicalConcept?` (alias match **and** unit guard); `find`, `byCode`, `aliasKey`, `entries` unchanged in signature. 69 entries.

Known red state after this task: core's PostgreSQL test `medicalConceptSeedMatchesTheSharedCatalogue` (closed by Task 3). Do not run core tests as this task's gate.

- [ ] **Step 1: Extend the unit-spelling test and replace the catalogue test**

In `MedicalUnitSpellingTest.kt` add inside the first test:

```kotlin
        assertThat(MedicalUnitSpelling.canonical("fl")).isEqualTo("fL")
        assertThat(MedicalUnitSpelling.canonical("pg")).isEqualTo("pg")
        assertThat(MedicalUnitSpelling.canonical("mm/h")).isEqualTo("mm/hr")
        assertThat(MedicalUnitSpelling.canonical("ug/dL")).isEqualTo("µg/dL")
        assertThat(MedicalUnitSpelling.canonical("μg/dL")).isEqualTo("µg/dL")
        assertThat(MedicalUnitSpelling.canonical("uU/mL")).isEqualTo("µU/mL")
        assertThat(MedicalUnitSpelling.canonical("u/ml")).isEqualTo("U/mL")
        assertThat(MedicalUnitSpelling.canonical("iu/ml")).isEqualTo("IU/mL")
        assertThat(MedicalUnitSpelling.canonical("umol/L")).isEqualTo("µmol/L")
        assertThat(MedicalUnitSpelling.canonical("g/l")).isEqualTo("g/L")
```

Replace `MedicalConceptCatalogueTest.kt` with:

```kotlin
package kr.co.genomecompanion.documentboundary

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test


class MedicalConceptCatalogueTest {
    @Test
    fun `holds sixty-nine concepts with unique codes and alias keys that belong to one concept only`() {
        val codes = MedicalConceptCatalogue.entries.map { it.conceptCode }
        assertThat(codes).hasSize(69).doesNotHaveDuplicates()
        assertThat(codes).contains(
            "glucose", "fasting-glucose", "postprandial-glucose", "bilirubin", "total-bilirubin", "direct-bilirubin",
            "crp", "hs-crp", "gfr", "egfr", "hematocrit", "mcv", "mch", "mchc", "chloride", "phosphorus", "magnesium",
            "iron", "tibc", "vitamin-b12", "folate", "esr", "ldh", "amylase", "ck", "free-t3", "t3",
            "non-hdl-cholesterol", "insulin", "afp", "cea", "psa", "ca19-9", "ca125", "rf",
        )
        val keys = MedicalConceptCatalogue.entries.flatMap { concept ->
            (listOf(concept.displayKo) + concept.aliases).map(MedicalConceptCatalogue::aliasKey)
        }
        assertThat(keys).doesNotHaveDuplicates()
    }

    @Test
    fun `has no one-character alias and unit-guards every concept`() {
        MedicalConceptCatalogue.entries.forEach { concept ->
            assertThat(concept.aliases.map(MedicalConceptCatalogue::aliasKey)).describedAs(concept.conceptCode).allMatch { it.length >= 2 }
            assertThat(concept.acceptedUnits).describedAs(concept.conceptCode).isNotEmpty().doesNotHaveDuplicates()
            assertThat(concept.acceptedUnits.first()).describedAs(concept.conceptCode).isEqualTo(concept.canonicalUnit)
            assertThat(concept.acceptedUnits).describedAs(concept.conceptCode).allMatch { MedicalUnitSpelling.canonical(it) == it }
        }
        assertThat(MedicalConceptCatalogue.find("K")).isNull()
    }

    @Test
    fun `sends a broad label to the generic concept and a specific label to the specific one`() {
        fun code(label: String) = MedicalConceptCatalogue.find(label)?.conceptCode
        assertThat(listOf("혈당", "Glucose", "Blood Glucose", "혈당(Glucose)").map(::code)).containsOnly("glucose")
        assertThat(listOf("공복혈당", "공복 혈당", "Fasting Glucose", "FBS", "FPG", "식전혈당").map(::code)).containsOnly("fasting-glucose")
        assertThat(listOf("식후혈당", "식후 2시간 혈당", "PP2", "2hr PP").map(::code)).containsOnly("postprandial-glucose")
        assertThat(code("Bilirubin")).isEqualTo("bilirubin")
        assertThat(listOf("총빌리루빈", "Total Bilirubin", "T-Bil").map(::code)).containsOnly("total-bilirubin")
        assertThat(listOf("Direct Bilirubin", "D-Bil").map(::code)).containsOnly("direct-bilirubin")
        assertThat(listOf("hs-CRP", "hsCRP", "고감도 C-반응단백").map(::code)).containsOnly("hs-crp")
        assertThat(listOf("CRP", "C-반응단백").map(::code)).containsOnly("crp")
        assertThat(listOf("GFR", "사구체여과율").map(::code)).containsOnly("gfr")
        assertThat(listOf("eGFR", "e-GFR", "estimated GFR", "추정 사구체여과율", "신사구체여과율(e-GFR)").map(::code)).containsOnly("egfr")
    }

    @Test
    fun `keeps generic concepts uncoded and the three over-specific codes unexported`() {
        listOf("glucose", "bilirubin", "gfr").forEach { code ->
            val concept = checkNotNull(MedicalConceptCatalogue.byCode(code))
            assertThat(concept.loincCode).describedAs(code).isNull()
            assertThat(concept.loincExport).describedAs(code).isFalse()
        }
        listOf("ldl-cholesterol", "vitamin-d", "egfr").forEach { code ->
            assertThat(checkNotNull(MedicalConceptCatalogue.byCode(code)).loincExport).describedAs(code).isFalse()
        }
        assertThat(MedicalConceptCatalogue.entries.filter { it.loincExport }).allMatch { it.loincCode != null }
        assertThatThrownBy { MedicalConcept("x-y", "엑스", null, "mg/dL", listOf("XY"), listOf("mg/dL"), loincExport = true) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `resolves a label only when the unit is one the concept accepts`() {
        assertThat(MedicalConceptCatalogue.resolve("UA", "mg/dl")?.conceptCode).isEqualTo("uric-acid")
        assertThat(MedicalConceptCatalogue.resolve("UA", "g/dL")).isNull()
        assertThat(MedicalConceptCatalogue.resolve("UA", "foo")).isNull()
        assertThat(MedicalConceptCatalogue.resolve("Glucose", "mmol/L")?.conceptCode).isEqualTo("glucose")
        assertThat(MedicalConceptCatalogue.resolve("WBC", "/uL")?.conceptCode).isEqualTo("white-blood-cells")
        assertThat(MedicalConceptCatalogue.resolve("Hb", "g/L")?.conceptCode).isEqualTo("hemoglobin")
        assertThat(MedicalConceptCatalogue.resolve("CK", "mg/dL")).isNull()
    }

    @Test
    fun `matches the demo document labels case and whitespace insensitively`() {
        assertThat(MedicalConceptCatalogue.find("Cholesterol")?.displayKo).isEqualTo("총콜레스테롤")
        assertThat(MedicalConceptCatalogue.find("hba1c:")?.conceptCode).isEqualTo("hba1c")
        assertThat(MedicalConceptCatalogue.find(" vitamin d ")?.conceptCode).isEqualTo("vitamin-d")
        assertThat(MedicalConceptCatalogue.find("총 콜레스테롤")?.conceptCode).isEqualTo("total-cholesterol")
        assertThat(MedicalConceptCatalogue.find("CA 19-9")?.conceptCode).isEqualTo("ca19-9")
        assertThat(MedicalConceptCatalogue.find("알 수 없는 항목")).isNull()
        assertThat(MedicalConceptCatalogue.byCode("free-t4")?.displayKo).isEqualTo("free T4")
    }

    @Test
    fun `carries no interpretation fields`() {
        val fields = MedicalConcept::class.java.declaredFields.map { it.name }
        assertThat(fields).containsExactlyInAnyOrder(
            "conceptCode", "displayKo", "loincCode", "canonicalUnit", "aliases", "acceptedUnits", "loincExport",
        )
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew.bat :packages:document-boundary:test --no-daemon`
Expected: compilation FAILS (`acceptedUnits`, `loincExport`, `resolve` unresolved).

- [ ] **Step 3: Add the unit spellings**

In `MedicalUnitSpelling.kt` extend the two collections (copy the micro sign `µ` U+00B5 from the existing `"µIU/mL"` literal; do not type a Greek mu):

```kotlin
    private val canonicalSpellings = listOf(
        "mg/dL", "%", "ng/mL", "ng/dL", "mmHg", "kg", "cm", "kg/m²", "U/L", "IU/L", "g/dL", "10³/µL", "10⁶/µL",
        "/µL", "mL/min/1.73m²", "mmol/L", "µIU/mL", "mg/L", "회/분", "pg/mL", "mEq/L",
        "fL", "pg", "mm/hr", "µg/dL", "µU/mL", "U/mL", "IU/mL", "µmol/L", "g/L",
    )
```

and append to `variants`: `"ug/dl" to "µg/dL", "uu/ml" to "µU/mL", "mm/h" to "mm/hr", "umol/l" to "µmol/L",`.

- [ ] **Step 4: Rewrite the data class and the catalogue**

`MedicalConcept` becomes:

```kotlin
data class MedicalConcept(
    val conceptCode: String,
    val displayKo: String,
    val loincCode: String?,
    val canonicalUnit: String,
    val aliases: List<String>,
    /** Canonical spellings a row may carry for this concept; the first is [canonicalUnit]. Spelling only, never a conversion. */
    val acceptedUnits: List<String> = listOf(canonicalUnit),
    /** True only when a public loinc.org read showed the code is no more specific than the labels (docs/status/2026-09-17/loinc-audit.md). */
    val loincExport: Boolean = false,
) {
    init {
        require(conceptCode.matches(Regex("^[a-z0-9-]{1,64}$"))) { "concept code shape: $conceptCode" }
        require(displayKo.length in 1..80) { "display label length: $conceptCode" }
        require(canonicalUnit.length in 1..32) { "canonical unit length: $conceptCode" }
        require(aliases.isNotEmpty()) { "at least one alias: $conceptCode" }
        require(acceptedUnits.firstOrNull() == canonicalUnit) { "accepted units start with the canonical unit: $conceptCode" }
        require(acceptedUnits.distinct().size == acceptedUnits.size) { "duplicate accepted unit: $conceptCode" }
        require(acceptedUnits.all { MedicalUnitSpelling.canonical(it) == it }) { "accepted units are canonical spellings: $conceptCode" }
        require(!loincExport || loincCode != null) { "loincExport needs a code: $conceptCode" }
    }

    /** The unit guard: true when the row's unit, after spelling unification, is one this concept accepts. */
    fun accepts(unit: String): Boolean = MedicalUnitSpelling.canonical(unit) in acceptedUnits
}
```

In `object MedicalConceptCatalogue` replace `entries`, the `byAlias` builder and the `concept` helper, and add `resolve`. The `loinc`/`export` arguments below are the proposal; **before committing, replace those two values on every line with that concept's row in `loinc-audit.md` § Final values** (`NULL` → `null`, `TRUE`/`FALSE` → `true`/`false`). Nothing else on a line may change.

```kotlin
    private val mgDl = listOf("mg/dL")
    private val mgDlMmol = listOf("mg/dL", "mmol/L")
    private val uL = listOf("U/L", "IU/L")
    private val ngMl = listOf("ng/mL")

    val entries: List<MedicalConcept> = listOf(
        concept("total-cholesterol", "총콜레스테롤", "2093-3", true, mgDlMmol, "콜레스테롤", "Total Cholesterol", "Cholesterol", "T-Chol", "TC"),
        concept("ldl-cholesterol", "LDL 콜레스테롤", "13457-7", false, mgDlMmol, "LDL-C", "LDL", "LDL Cholesterol", "저밀도 콜레스테롤"),
        concept("hdl-cholesterol", "HDL 콜레스테롤", "2085-9", true, mgDlMmol, "HDL-C", "HDL", "HDL Cholesterol", "고밀도 콜레스테롤"),
        concept("triglycerides", "중성지방", "2571-8", true, mgDlMmol, "Triglycerides", "Triglyceride", "TG"),
        concept("fasting-glucose", "공복혈당", "1558-6", true, mgDlMmol, "Fasting Glucose", "FBS", "FPG", "식전혈당"),
        concept("hba1c", "당화혈색소", "4548-4", true, listOf("%"), "HbA1c", "Hemoglobin A1c", "A1c"),
        concept("ast", "AST", "1920-8", true, uL, "AST(GOT)", "GOT", "SGOT", "Aspartate Aminotransferase"),
        concept("alt", "ALT", "1742-6", true, uL, "ALT(GPT)", "GPT", "SGPT", "Alanine Aminotransferase"),
        concept("gamma-gtp", "γ-GTP", "2324-2", true, uL, "감마지티피", "r-GTP", "GGT", "Gamma GT", "γ-GT", "gamma-GTP"),
        concept("alp", "ALP", "6768-6", true, uL, "Alkaline Phosphatase", "알칼리포스파타제"),
        concept("total-bilirubin", "총빌리루빈", "1975-2", true, mgDl, "Total Bilirubin", "T-Bil"),
        concept("albumin", "알부민", "1751-7", true, listOf("g/dL"), "Albumin", "Alb"),
        concept("bun", "BUN", "3094-0", true, mgDl, "혈중요소질소", "Blood Urea Nitrogen", "Urea Nitrogen"),
        concept("creatinine", "크레아티닌", "2160-0", true, listOf("mg/dL", "µmol/L"), "Creatinine", "Cr", "Creat"),
        concept("egfr", "eGFR", "62238-1", false, listOf("mL/min/1.73m²"), "e-GFR", "estimated GFR", "추정 사구체여과율", "신사구체여과율(e-GFR)"),
        concept("uric-acid", "요산", "3084-1", true, mgDl, "Uric Acid", "UA"),
        concept("hemoglobin", "혈색소", "718-7", true, listOf("g/dL", "g/L"), "헤모글로빈", "Hemoglobin", "Hb", "Hgb"),
        concept("red-blood-cells", "적혈구", "789-8", true, listOf("10⁶/µL"), "적혈구수", "RBC", "Red Blood Cell"),
        concept("white-blood-cells", "백혈구", "6690-2", true, listOf("10³/µL", "/µL"), "백혈구수", "WBC", "White Blood Cell"),
        concept("platelets", "혈소판", "777-3", true, listOf("10³/µL", "/µL"), "혈소판수", "Platelet", "Platelets", "PLT"),
        concept("urine-protein", "요단백", "5804-0", true, mgDl, "Urine Protein", "Proteinuria"),
        concept("urine-glucose", "요당", "5792-7", true, mgDl, "Urine Glucose", "Glycosuria"),
        concept("systolic-blood-pressure", "수축기 혈압", "8480-6", true, listOf("mmHg"), "최고혈압", "Systolic", "Systolic Blood Pressure", "SBP"),
        concept("diastolic-blood-pressure", "이완기 혈압", "8462-4", true, listOf("mmHg"), "최저혈압", "Diastolic", "Diastolic Blood Pressure", "DBP"),
        concept("pulse", "맥박", "8867-4", true, listOf("회/분"), "맥박수", "심박수", "Pulse", "Heart Rate", "HR"),
        concept("height", "키", "8302-2", true, listOf("cm"), "신장", "Height"),
        concept("weight", "체중", "29463-7", true, listOf("kg"), "몸무게", "Weight", "Body Weight"),
        concept("bmi", "BMI", "39156-5", true, listOf("kg/m²"), "체질량지수", "Body Mass Index"),
        concept("waist-circumference", "허리둘레", "8280-0", true, listOf("cm"), "Waist", "Waist Circumference", "WC"),
        concept("vitamin-d", "비타민 D", "1989-3", false, ngMl, "Vitamin D", "25-OH Vitamin D", "25(OH)D", "Vit D"),
        concept("tsh", "TSH", "3016-3", true, listOf("µIU/mL"), "갑상선자극호르몬", "Thyroid Stimulating Hormone"),
        concept("free-t4", "free T4", "3024-7", true, listOf("ng/dL"), "FT4", "유리 티록신"),
        concept("crp", "CRP", "1988-5", true, listOf("mg/L", "mg/dL"), "C-반응단백", "C-Reactive Protein"),
        concept("ferritin", "페리틴", "2276-4", true, ngMl, "Ferritin"),
        concept("sodium", "나트륨", "2951-2", true, listOf("mmol/L", "mEq/L"), "Sodium", "Na"),
        concept("potassium", "칼륨", "2823-3", true, listOf("mmol/L", "mEq/L"), "Potassium"),
        concept("calcium", "칼슘", "17861-6", true, mgDl, "Calcium", "Ca"),
        concept("total-protein", "총단백", "2885-2", true, listOf("g/dL"), "Total Protein", "TP"),
        // Wave 5: generic concepts for labels that do not say which specific test they are. No LOINC.
        concept("glucose", "혈당", null, false, mgDlMmol, "Glucose", "Blood Glucose", "혈당(Glucose)"),
        concept("bilirubin", "빌리루빈", null, false, mgDl, "Bilirubin"),
        concept("gfr", "사구체여과율", null, false, listOf("mL/min/1.73m²"), "GFR"),
        // Wave 5: specific siblings split out of the old broad aliases.
        concept("postprandial-glucose", "식후혈당", "1521-4", true, mgDlMmol, "식후 2시간 혈당", "PP2", "2hr PP", "Postprandial Glucose"),
        concept("direct-bilirubin", "직접빌리루빈", "1968-7", true, mgDl, "Direct Bilirubin", "D-Bil"),
        concept("hs-crp", "고감도 CRP", "30522-7", true, listOf("mg/L", "mg/dL"), "hs-CRP", "hsCRP", "고감도 C-반응단백"),
        // Wave 5: numeric check-up items.
        concept("hematocrit", "헤마토크릿", "4544-3", true, listOf("%"), "Hematocrit", "Hct", "적혈구용적률"),
        concept("mcv", "MCV", "787-2", true, listOf("fL"), "평균적혈구용적", "Mean Corpuscular Volume"),
        concept("mch", "MCH", "785-6", true, listOf("pg"), "평균적혈구혈색소", "Mean Corpuscular Hemoglobin"),
        concept("mchc", "MCHC", "786-4", true, listOf("g/dL", "%"), "평균적혈구혈색소농도", "Mean Corpuscular Hemoglobin Concentration"),
        concept("chloride", "염소", "2075-0", true, listOf("mmol/L", "mEq/L"), "Chloride", "Cl", "클로라이드"),
        concept("phosphorus", "인(P)", "2777-1", true, mgDl, "Phosphorus", "Inorganic Phosphorus", "무기인", "IP"),
        concept("magnesium", "마그네슘", "19123-9", true, listOf("mg/dL", "mmol/L", "mEq/L"), "Magnesium", "Mg"),
        concept("iron", "혈청철", "2498-4", true, listOf("µg/dL"), "Iron", "Serum Iron", "Fe", "철(Fe)"),
        concept("tibc", "TIBC", "2500-7", true, listOf("µg/dL"), "총철결합능", "Total Iron Binding Capacity"),
        concept("vitamin-b12", "비타민 B12", "2132-9", true, listOf("pg/mL"), "Vitamin B12", "Vit B12", "Cobalamin"),
        concept("folate", "엽산", "2284-8", true, ngMl, "Folate", "Folic Acid"),
        concept("esr", "ESR", "30341-2", true, listOf("mm/hr"), "적혈구침강속도", "Erythrocyte Sedimentation Rate"),
        concept("ldh", "LDH", "2532-0", true, uL, "젖산탈수소효소", "Lactate Dehydrogenase", "LD"),
        concept("amylase", "아밀라아제", "1798-8", true, uL, "Amylase", "아밀라제"),
        concept("ck", "CK", "2157-6", true, uL, "크레아틴키나아제", "Creatine Kinase", "CPK"),
        concept("free-t3", "free T3", "3051-0", true, listOf("pg/mL"), "FT3", "유리 T3"),
        concept("t3", "T3", "3053-6", true, listOf("ng/dL", "ng/mL"), "Total T3", "Triiodothyronine"),
        concept("non-hdl-cholesterol", "non-HDL 콜레스테롤", "43396-1", true, mgDlMmol, "Non-HDL Cholesterol", "Non-HDL", "Non-HDL-C"),
        concept("insulin", "인슐린", "20448-7", true, listOf("µU/mL", "µIU/mL"), "Insulin"),
        concept("afp", "AFP", "1834-1", true, listOf("ng/mL", "IU/mL"), "알파태아단백", "Alpha-Fetoprotein", "α-FP"),
        concept("cea", "CEA", "2039-6", true, ngMl, "암태아성항원", "Carcinoembryonic Antigen"),
        concept("psa", "PSA", "2857-1", true, ngMl, "전립선특이항원", "Prostate Specific Antigen"),
        concept("ca19-9", "CA19-9", "24108-3", true, listOf("U/mL"), "CA-19-9", "Carbohydrate Antigen 19-9"),
        concept("ca125", "CA125", "10334-1", true, listOf("U/mL"), "CA-125", "Cancer Antigen 125"),
        concept("rf", "RF", "11572-5", true, listOf("IU/mL", "U/mL"), "류마티스인자", "Rheumatoid Factor"),
    )

    private val byAlias: Map<String, MedicalConcept> = buildMap {
        this@MedicalConceptCatalogue.entries.forEach { medicalConcept ->
            medicalConcept.aliases.forEach { alias ->
                require(aliasKey(alias).length >= 2) { "one-character alias '$alias' for ${medicalConcept.conceptCode}" }
            }
            (listOf(medicalConcept.displayKo) + medicalConcept.aliases).forEach { alias ->
                val key = aliasKey(alias)
                require(put(key, medicalConcept) == null) { "duplicate alias key '$key' for ${medicalConcept.conceptCode}" }
            }
        }
    }

    /** Alias match plus the unit guard. Core applies the same rule to the persisted seed. */
    fun resolve(label: String, unit: String): MedicalConcept? = find(label)?.takeIf { it.accepts(unit) }

    private fun concept(code: String, displayKo: String, loinc: String?, export: Boolean, units: List<String>, vararg aliases: String) =
        MedicalConcept(code, displayKo, loinc, units.first(), aliases.toList(), units, export && loinc != null)
```

The four `private val` unit lists must be declared **above** `entries` (Kotlin initialises object properties in order). Also change the object's KDoc sentence "Core seeds `gc_medical_concept` from V7 SQL" to "Core seeds `gc_medical_concept` from V7 + V11 SQL".

- [ ] **Step 5: Run the three modules**

Run: `./gradlew.bat :packages:document-boundary:test :apps:document-worker:test :packages:korean-checkup-benchmark:test --no-daemon`
Expected: `BUILD SUCCESSFUL`. If a duplicate-key `require` fires, the message names the key: remove the later alias (never a display name) and mirror that in Task 3's SQL.

- [ ] **Step 6: Confirm the benchmark gate is unchanged**

Run: `pnpm medical-ai:native-text-gate`
Expected: `"fieldF1": 1`, `"passed": true`, `corpusId` still `synthetic-ko-checkup-r2-e6befc286ae6ce1d` (no PDF changed yet).

- [ ] **Step 7: Commit**

```bash
git add packages/document-boundary
git commit -m "feat(boundary): aliases never broader than the concept, generic concepts, accepted units, loincExport, 25 numeric items

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Core V11, seed = catalogue, unit guard in the normalizer, `original_label` stored / copied / inherited

**Files:**
- Create: `apps/core-api/src/main/resources/db/migration/V11__concept_accuracy.sql`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/MedicalConceptNormalizer.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt` (`FoundationCandidateRow`, `FoundationRecordRow`, `candidateMapper`, `recordMapper`, `candidateProjection`, `recordProjection`, `markExtractionCompleted`, `createRecordFromCandidate`, `correctRecord`)
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/MedicalConceptNormalizerTest.kt`, `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `MedicalConcept(…, acceptedUnits, loincExport)`, `MedicalConcept.accepts(unit)`, `MedicalConceptCatalogue.entries` (Task 2); `loinc-audit.md` § Final values (Task 1).
- Produces: `NormalizedCandidate.originalLabel: String` (always the worker's raw label); `FoundationCandidateRow.originalLabel: String? = null`, `FoundationRecordRow.originalLabel: String? = null` (last constructor parameter of each, so the named-argument test builders keep compiling); `JdbcMedicalConceptSource.concepts()` returns `acceptedUnits` and `loincExport` from the table. Responses do **not** change in this task (Task 4).

Worker check (spec §8, "worker 불변"): `NativeTextExtractionProvider.parse` builds `ParsedCandidate(label = row.label, …)` where `row.label` is the joined tokens before the value — the raw label. No worker change.

- [ ] **Step 1: Write the failing normalizer tests**

Append to `MedicalConceptNormalizerTest.kt` (the `candidate(...)` helper already exists):

```kotlin
    @Test
    fun keepsTheResultSheetLabelBesideTheDisplayLabel() {
        val normalized = normalizer.normalize(candidate(label = "Cholesterol"))
        assertThat(normalized.label).isEqualTo("총콜레스테롤")
        assertThat(normalized.originalLabel).isEqualTo("Cholesterol")
        assertThat(normalizer.normalize(candidate(label = "알 수 없는 항목")).originalLabel).isEqualTo("알 수 없는 항목")
    }

    @Test
    fun attachesNoConceptWhenTheUnitIsNotOneTheConceptAccepts() {
        val mismatched = normalizer.normalize(candidate(label = "UA", value = "1.2", unit = "g/dL"))
        assertThat(mismatched.conceptCode).isNull()
        assertThat(mismatched.label).isEqualTo("UA")
        assertThat(mismatched.originalLabel).isEqualTo("UA")
        assertThat(mismatched.unit).isEqualTo("g/dL")

        val unknownUnit = normalizer.normalize(candidate(label = "Cholesterol", unit = "foo/bar"))
        assertThat(unknownUnit.conceptCode).isNull()
        assertThat(unknownUnit.label).isEqualTo("Cholesterol")

        val accepted = normalizer.normalize(candidate(label = "UA", value = "5.1", unit = "mg/dl"))
        assertThat(accepted.conceptCode).isEqualTo("uric-acid")
        assertThat(accepted.label).isEqualTo("요산")
        assertThat(normalizer.normalize(candidate(label = "Hb", value = "140", unit = "g/L")).conceptCode).isEqualTo("hemoglobin")
    }

    @Test
    fun sendsABroadLabelToTheGenericConcept() {
        val glucose = normalizer.normalize(candidate(label = "혈당", value = "95"))
        assertThat(glucose.conceptCode).isEqualTo("glucose")
        assertThat(glucose.label).isEqualTo("혈당")
        assertThat(normalizer.normalize(candidate(label = "hs-CRP", value = "0.1", unit = "mg/L")).conceptCode).isEqualTo("hs-crp")
        assertThat(normalizer.normalize(candidate(label = "Bilirubin", value = "0.8")).conceptCode).isEqualTo("bilirubin")
        assertThat(normalizer.normalize(candidate(label = "GFR", value = "90", unit = "mL/min/1.73m2")).conceptCode).isEqualTo("gfr")
        assertThat(normalizer.normalize(candidate(label = "공복혈당", value = "95")).conceptCode).isEqualTo("fasting-glucose")
    }
```

The existing test `leavesUnknownLabelsAndUnitsUntouchedWithoutAConceptCode` stays valid as written.

- [ ] **Step 2: Write the failing integration test**

Add to `FoundationLifecyclePostgresIntegrationTest.kt` (next to `storesTheReferenceRangeTextCopiesItToTheRecordVersionAndKeepsItOutOfEveryResponse`):

```kotlin
    @Test
    fun storesTheResultSheetLabelCopiesItAtConfirmationInheritsItOnCorrectionAndGuardsTheUnit() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "original-label-request")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = listOf(
                ExtractedCandidate(1, "Cholesterol", "188", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64)),
                ExtractedCandidate(2, "혈당", "95", "mg/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64)),
                ExtractedCandidate(3, "UA", "1.2", "g/dL", "2026-07-28", 1, EvidenceBox(0.08, 0.18, 0.25, 0.02), "3".repeat(64)),
            ),
        )
        assertThat(
            jdbc.queryForList("SELECT label || '|' || original_label || '|' || COALESCE(concept_code, '-') FROM gc_candidate ORDER BY ordinal", String::class.java),
        ).containsExactly("총콜레스테롤|Cholesterol|total-cholesterol", "혈당|혈당|glucose", "UA|UA|-")

        val candidates = responseJson(
            read(get("/api/foundation/documents/$documentId/candidates"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).toList()
        confirmEveryCandidate(alice, candidates, "original-label")
        assertThat(
            jdbc.queryForList(
                """
                SELECT v.original_label FROM gc_health_record_version v
                JOIN gc_health_record r ON r.record_id = v.record_id
                JOIN gc_candidate c ON c.candidate_id = r.candidate_id
                WHERE v.status = 'CURRENT' ORDER BY c.ordinal
                """.trimIndent(),
                String::class.java,
            ),
        ).containsExactly("Cholesterol", "혈당", "UA")

        val recordId = responseJson(
            read(get("/api/foundation/records"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        ).single { it["label"].asText() == "총콜레스테롤" }["recordId"].asText()
        // The label is never client-writable: the strict Jackson posture rejects the unknown field.
        mutate(
            post("/api/foundation/records/$recordId/corrections")
                .header("Idempotency-Key", "original-label-correction-rejected")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "191", "reason" to "합성 원문 재확인", "originalLabel" to "LDL"))),
            alice,
        ).andExpect(status().isBadRequest)
        mutate(
            post("/api/foundation/records/$recordId/corrections")
                .header("Idempotency-Key", "original-label-correction-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "191", "reason" to "합성 원문 재확인"))),
            alice,
        ).andExpect(status().isOk)
        assertThat(
            jdbc.queryForList(
                "SELECT original_label FROM gc_health_record_version WHERE record_id = ?::uuid ORDER BY changed_at",
                String::class.java,
                recordId,
            ),
        ).containsExactly("Cholesterol", "Cholesterol")
        // Audit rows never carry the label.
        assertThat(
            jdbc.queryForList(
                "SELECT event_type || ' ' || resource_type || ' ' || COALESCE(purpose_code, '') || ' ' || outcome FROM gc_audit_event",
                String::class.java,
            ),
        ).noneMatch { it.contains("Cholesterol") || it.contains("혈당") }
    }

    @Test
    fun existingRowsKeepANullResultSheetLabel() {
        assertThat(
            jdbc.queryForObject(
                "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'gc_health_record_version' AND column_name = 'original_label'",
                String::class.java,
            ),
        ).isEqualTo("YES")
        assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM gc_medical_concept WHERE jsonb_array_length(accepted_units) = 0", Long::class.java),
        ).isZero()
    }
```

`medicalConceptSeedMatchesTheSharedCatalogue` stays exactly as written: `MedicalConcept` is a data class, so its equality now also compares `acceptedUnits` and `loincExport` (code, display name, aliases, unit, LOINC were already compared).

- [ ] **Step 3: Run to verify it fails**

Run: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' && ./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon`
Expected: compilation FAILS on `originalLabel`.

- [ ] **Step 4: Write V11**

Create `V11__concept_accuracy.sql`. Copy every `µ`, `³`, `⁶`, `²` from V7 (they must be byte-identical to the Kotlin literals; the equality test catches a Greek mu). **`loinc_code` and `loinc_export` of every row come from `loinc-audit.md` § Final values** — the values below are the proposal and must be replaced where the audit differs, exactly as Task 2 did in Kotlin (add further `UPDATE … SET loinc_export = FALSE` lines for any other existing concept the audit turned off).

```sql
-- Wave 5 (concept accuracy). Forward-only and safe on a populated database: new columns are nullable
-- or defaulted, seed changes are UPDATEs keyed by concept_code plus INSERTs of new codes. Existing
-- candidate and record rows are NOT re-normalised: their raw label was never stored, so they keep the
-- concept they were given and a NULL original_label.
-- original_label is the item name exactly as the result sheet printed it (document text the person
-- already sees). It is copied to the record version at confirmation and inherited by corrections;
-- no request can write it and no audit row carries it.
ALTER TABLE gc_candidate
    ADD COLUMN original_label VARCHAR(80),
    ADD CONSTRAINT gc_candidate_original_label_length CHECK (original_label IS NULL OR char_length(original_label) BETWEEN 1 AND 80);

ALTER TABLE gc_health_record_version
    ADD COLUMN original_label VARCHAR(80),
    ADD CONSTRAINT gc_health_record_version_original_label_length CHECK (original_label IS NULL OR char_length(original_label) BETWEEN 1 AND 80);

-- accepted_units: canonical spellings a row may carry for the concept (first = canonical_unit). A label
-- whose unit is not listed gets no concept. Spelling only; never a conversion factor.
-- loinc_export: FALSE when the code is more specific than the labels (docs/status/2026-09-17/loinc-audit.md).
ALTER TABLE gc_medical_concept
    ADD COLUMN accepted_units JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN loinc_export BOOLEAN NOT NULL DEFAULT TRUE,
    ADD CONSTRAINT gc_medical_concept_accepted_units_array CHECK (jsonb_typeof(accepted_units) = 'array');

UPDATE gc_medical_concept SET accepted_units = jsonb_build_array(canonical_unit);
UPDATE gc_medical_concept SET accepted_units = '["mg/dL","mmol/L"]'
    WHERE concept_code IN ('total-cholesterol', 'ldl-cholesterol', 'hdl-cholesterol', 'triglycerides', 'fasting-glucose');
UPDATE gc_medical_concept SET accepted_units = '["U/L","IU/L"]' WHERE concept_code IN ('ast', 'alt', 'gamma-gtp', 'alp');
UPDATE gc_medical_concept SET accepted_units = '["mg/dL","µmol/L"]' WHERE concept_code = 'creatinine';
UPDATE gc_medical_concept SET accepted_units = '["g/dL","g/L"]' WHERE concept_code = 'hemoglobin';
UPDATE gc_medical_concept SET accepted_units = '["10³/µL","/µL"]' WHERE concept_code IN ('white-blood-cells', 'platelets');
UPDATE gc_medical_concept SET accepted_units = '["mg/L","mg/dL"]' WHERE concept_code = 'crp';
UPDATE gc_medical_concept SET accepted_units = '["mmol/L","mEq/L"]' WHERE concept_code IN ('sodium', 'potassium');

-- An alias is never broader than its concept. The broad labels move to the generic concepts below.
UPDATE gc_medical_concept SET aliases = '["Fasting Glucose","FBS","FPG","식전혈당"]' WHERE concept_code = 'fasting-glucose';
UPDATE gc_medical_concept SET aliases = '["Total Bilirubin","T-Bil"]' WHERE concept_code = 'total-bilirubin';
UPDATE gc_medical_concept SET aliases = '["C-반응단백","C-Reactive Protein"]' WHERE concept_code = 'crp';
UPDATE gc_medical_concept SET aliases = '["e-GFR","estimated GFR","추정 사구체여과율","신사구체여과율(e-GFR)"]' WHERE concept_code = 'egfr';
UPDATE gc_medical_concept SET aliases = '["Potassium"]' WHERE concept_code = 'potassium';

UPDATE gc_medical_concept SET loinc_export = FALSE WHERE concept_code IN ('ldl-cholesterol', 'vitamin-d', 'egfr');

INSERT INTO gc_medical_concept (concept_code, display_ko, loinc_code, canonical_unit, aliases, accepted_units, loinc_export) VALUES
    ('glucose', '혈당', NULL, 'mg/dL', '["Glucose","Blood Glucose","혈당(Glucose)"]', '["mg/dL","mmol/L"]', FALSE),
    ('bilirubin', '빌리루빈', NULL, 'mg/dL', '["Bilirubin"]', '["mg/dL"]', FALSE),
    ('gfr', '사구체여과율', NULL, 'mL/min/1.73m²', '["GFR"]', '["mL/min/1.73m²"]', FALSE),
    ('postprandial-glucose', '식후혈당', '1521-4', 'mg/dL', '["식후 2시간 혈당","PP2","2hr PP","Postprandial Glucose"]', '["mg/dL","mmol/L"]', TRUE),
    ('direct-bilirubin', '직접빌리루빈', '1968-7', 'mg/dL', '["Direct Bilirubin","D-Bil"]', '["mg/dL"]', TRUE),
    ('hs-crp', '고감도 CRP', '30522-7', 'mg/L', '["hs-CRP","hsCRP","고감도 C-반응단백"]', '["mg/L","mg/dL"]', TRUE),
    ('hematocrit', '헤마토크릿', '4544-3', '%', '["Hematocrit","Hct","적혈구용적률"]', '["%"]', TRUE),
    ('mcv', 'MCV', '787-2', 'fL', '["평균적혈구용적","Mean Corpuscular Volume"]', '["fL"]', TRUE),
    ('mch', 'MCH', '785-6', 'pg', '["평균적혈구혈색소","Mean Corpuscular Hemoglobin"]', '["pg"]', TRUE),
    ('mchc', 'MCHC', '786-4', 'g/dL', '["평균적혈구혈색소농도","Mean Corpuscular Hemoglobin Concentration"]', '["g/dL","%"]', TRUE),
    ('chloride', '염소', '2075-0', 'mmol/L', '["Chloride","Cl","클로라이드"]', '["mmol/L","mEq/L"]', TRUE),
    ('phosphorus', '인(P)', '2777-1', 'mg/dL', '["Phosphorus","Inorganic Phosphorus","무기인","IP"]', '["mg/dL"]', TRUE),
    ('magnesium', '마그네슘', '19123-9', 'mg/dL', '["Magnesium","Mg"]', '["mg/dL","mmol/L","mEq/L"]', TRUE),
    ('iron', '혈청철', '2498-4', 'µg/dL', '["Iron","Serum Iron","Fe","철(Fe)"]', '["µg/dL"]', TRUE),
    ('tibc', 'TIBC', '2500-7', 'µg/dL', '["총철결합능","Total Iron Binding Capacity"]', '["µg/dL"]', TRUE),
    ('vitamin-b12', '비타민 B12', '2132-9', 'pg/mL', '["Vitamin B12","Vit B12","Cobalamin"]', '["pg/mL"]', TRUE),
    ('folate', '엽산', '2284-8', 'ng/mL', '["Folate","Folic Acid"]', '["ng/mL"]', TRUE),
    ('esr', 'ESR', '30341-2', 'mm/hr', '["적혈구침강속도","Erythrocyte Sedimentation Rate"]', '["mm/hr"]', TRUE),
    ('ldh', 'LDH', '2532-0', 'U/L', '["젖산탈수소효소","Lactate Dehydrogenase","LD"]', '["U/L","IU/L"]', TRUE),
    ('amylase', '아밀라아제', '1798-8', 'U/L', '["Amylase","아밀라제"]', '["U/L","IU/L"]', TRUE),
    ('ck', 'CK', '2157-6', 'U/L', '["크레아틴키나아제","Creatine Kinase","CPK"]', '["U/L","IU/L"]', TRUE),
    ('free-t3', 'free T3', '3051-0', 'pg/mL', '["FT3","유리 T3"]', '["pg/mL"]', TRUE),
    ('t3', 'T3', '3053-6', 'ng/dL', '["Total T3","Triiodothyronine"]', '["ng/dL","ng/mL"]', TRUE),
    ('non-hdl-cholesterol', 'non-HDL 콜레스테롤', '43396-1', 'mg/dL', '["Non-HDL Cholesterol","Non-HDL","Non-HDL-C"]', '["mg/dL","mmol/L"]', TRUE),
    ('insulin', '인슐린', '20448-7', 'µU/mL', '["Insulin"]', '["µU/mL","µIU/mL"]', TRUE),
    ('afp', 'AFP', '1834-1', 'ng/mL', '["알파태아단백","Alpha-Fetoprotein","α-FP"]', '["ng/mL","IU/mL"]', TRUE),
    ('cea', 'CEA', '2039-6', 'ng/mL', '["암태아성항원","Carcinoembryonic Antigen"]', '["ng/mL"]', TRUE),
    ('psa', 'PSA', '2857-1', 'ng/mL', '["전립선특이항원","Prostate Specific Antigen"]', '["ng/mL"]', TRUE),
    ('ca19-9', 'CA19-9', '24108-3', 'U/mL', '["CA-19-9","Carbohydrate Antigen 19-9"]', '["U/mL"]', TRUE),
    ('ca125', 'CA125', '10334-1', 'U/mL', '["CA-125","Cancer Antigen 125"]', '["U/mL"]', TRUE),
    ('rf', 'RF', '11572-5', 'IU/mL', '["류마티스인자","Rheumatoid Factor"]', '["IU/mL","U/mL"]', TRUE);

ALTER TABLE gc_medical_concept
    ADD CONSTRAINT gc_medical_concept_loinc_export_needs_code CHECK (loinc_export = FALSE OR loinc_code IS NOT NULL);
```

A new concept the audit left without a code is written `NULL, …, FALSE` (the final CHECK enforces it).

- [ ] **Step 5: Normalizer — read the new columns, guard the unit, keep the raw label**

In `MedicalConceptNormalizer.kt`:

```kotlin
data class NormalizedCandidate(
    val ordinal: Int,
    val label: String,
    val value: String,
    val unit: String,
    val observedOn: LocalDate,
    val evidencePage: Int,
    val evidenceBox: EvidenceBox?,
    val sourceTextSha256: String,
    val conceptCode: String?,
    /** Verbatim from the worker; stored on the candidate and copied to the record version, never shown or compared. */
    val referenceRangeText: String? = null,
    /** The item name exactly as the result sheet printed it. Document text, stored and returned as it is. */
    val originalLabel: String = label,
)
```

`JdbcMedicalConceptSource.concepts()`:

```kotlin
    override fun concepts(): List<MedicalConcept> = jdbc.query(
        """
        SELECT concept_code, display_ko, loinc_code, canonical_unit, aliases::text AS aliases,
               accepted_units::text AS accepted_units, loinc_export
        FROM gc_medical_concept ORDER BY concept_code
        """.trimIndent(),
    ) { result, _ ->
        MedicalConcept(
            conceptCode = result.getString("concept_code"),
            displayKo = result.getString("display_ko"),
            loincCode = result.getString("loinc_code"),
            canonicalUnit = result.getString("canonical_unit"),
            aliases = json.readValue<List<String>>(result.getString("aliases")),
            acceptedUnits = json.readValue<List<String>>(result.getString("accepted_units")),
            loincExport = result.getBoolean("loinc_export"),
        )
    }
```

`normalize` (update the class KDoc: "Alias match **and accepted unit** → concept code and display label; … A label whose unit the concept does not accept keeps the raw label and `conceptCode = null`, exactly like an unknown label."):

```kotlin
    fun normalize(candidate: ExtractedCandidate): NormalizedCandidate {
        val concept = index[MedicalConceptCatalogue.aliasKey(candidate.label)]?.takeIf { it.accepts(candidate.unit) }
        return NormalizedCandidate(
            ordinal = candidate.ordinal,
            label = concept?.displayKo ?: candidate.label,
            value = candidate.value,
            unit = MedicalUnitSpelling.canonical(candidate.unit) ?: candidate.unit,
            observedOn = LocalDate.parse(candidate.observedOn),
            evidencePage = candidate.evidencePage,
            evidenceBox = candidate.evidenceBox,
            sourceTextSha256 = candidate.sourceTextSha256,
            conceptCode = concept?.conceptCode,
            referenceRangeText = candidate.referenceRangeText,
            originalLabel = candidate.label,
        )
    }
```

Also change the comment "Reads the V7 seed." to "Reads the V7 + V11 seed.".

- [ ] **Step 6: Repository — rows, mappers, projections, three writes**

In `FoundationRepository.kt`:

1. Add as the **last** parameter of `FoundationCandidateRow` and of `FoundationRecordRow`:
```kotlin
    /** The item name as the result sheet printed it; NULL for rows stored before V11. */
    val originalLabel: String? = null,
```
2. `candidateMapper`: add `originalLabel = result.getString("original_label"),` after `referenceRangeText`. `recordMapper`: the same line.
3. `candidateProjection`: change `c.concept_code, c.reference_range_text,` to `c.concept_code, c.reference_range_text, c.original_label,`. `recordProjection`: change `v.concept_code, v.reference_range_text` to `v.concept_code, v.reference_range_text, v.original_label`.
4. `markExtractionCompleted` candidate insert: column list ends `…, concept_code, reference_range_text, original_label`, the `VALUES` list gains one more `?`, and the argument list ends `candidate.conceptCode, candidate.referenceRangeText, candidate.originalLabel,`.
5. `createRecordFromCandidate` version insert: column list ends `…, concept_code, reference_range_text, original_label`, `VALUES (?, ?, ?, 'CURRENT', ?, NULL, NULL, ?, ?, ?, ?)`, arguments end `candidate.conceptCode, candidate.referenceRangeText, candidate.originalLabel,`.
6. `correctRecord` version insert: column list ends `…, concept_code, reference_range_text, original_label`, the `VALUES` tail becomes
```sql
                (SELECT concept_code FROM gc_health_record_version WHERE version_id = ?),
                (SELECT reference_range_text FROM gc_health_record_version WHERE version_id = ?),
                (SELECT original_label FROM gc_health_record_version WHERE version_id = ?))
```
and one more `previousVersionId,` is appended to the arguments (three in a row).

- [ ] **Step 7: Run core tests**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon`
Expected: `BUILD SUCCESSFUL`, including `medicalConceptSeedMatchesTheSharedCatalogue`. When that test fails, AssertJ prints the differing `MedicalConcept`; fix the SQL (then apply the Flyway-checksum recipe from Global Constraints), never the test.

- [ ] **Step 8: Commit**

```bash
git add apps/core-api/src/main/resources/db/migration/V11__concept_accuracy.sql apps/core-api/src/main/kotlin apps/core-api/src/test/kotlin
git commit -m "feat(core): V11 — result-sheet label kept, aliases narrowed, accepted units guard the concept, loinc_export

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Core responses — `originalLabel` on receipts, HealthEvent and SeriesPoint; export v3; FHIR `code.text` and data-driven `loincExport`

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt` (`CandidateReceipt`, `RecordReceipt`, `HealthEventExport`, `loincByConceptCode`, `exportHealthEventsAsFhir`, `candidateReceipt`, `recordReceipt`)
- Modify: `.../foundation/HealthEventProjection.kt`, `.../foundation/SeriesProjection.kt`, `.../foundation/FhirExport.kt`
- Test: `HealthEventProjectionTest.kt`, `SeriesProjectionTest.kt`, `FhirObservationMapperTest.kt`, `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `FoundationCandidateRow.originalLabel`, `FoundationRecordRow.originalLabel`, `MedicalConcept.loincExport`, `MedicalConcept.canonicalUnit` (Tasks 2–3).
- Produces (JSON, null omitted): `CandidateReceipt.originalLabel?`, `RecordReceipt.originalLabel?`, `HealthEvent.originalLabel?`, `SeriesPoint.originalLabel?` — each a `String?` declared as the **last** property; export `schemaVersion = "alm-health-events-export.v3"` (events carry `originalLabel` through the unwrapped `HealthEvent`); `FhirObservationMapper.bundle(records: List<FoundationRecordRow>, concepts: Map<String, MedicalConcept>, now: Instant): FhirBundle` (second parameter changed from `Map<String, String>`); FHIR `code.text = originalLabel ?: label`.

Known red state after this task: `pnpm foundation:e2e` (strict web schema, `code.text`, v3) until Task 7.

- [ ] **Step 1: Write the failing unit tests**

In each of the three unit tests' `row(...)` builder add a parameter `originalLabel: String? = null` and pass `originalLabel = originalLabel,` to `FoundationRecordRow`.

`HealthEventProjectionTest.kt`, new test:

```kotlin
    @Test
    fun carriesTheResultSheetLabelAndOmitsItForRowsStoredBeforeItWasKept() {
        val kept = row(label = "총콜레스테롤", value = "188", observedOn = LocalDate.of(2026, 7, 28), originalLabel = "Cholesterol")
        val old = row(label = "당화혈색소", value = "5.2", observedOn = LocalDate.of(2026, 7, 28), conceptCode = "hba1c")
        val events = HealthEventProjection.project(listOf(kept, old), setOf(docWithPreview)).associateBy { it.concept }
        assertThat(events.getValue("총콜레스테롤").originalLabel).isEqualTo("Cholesterol")
        assertThat(events.getValue("당화혈색소").originalLabel).isNull()
    }
```

`SeriesProjectionTest.kt`, new test:

```kotlin
    @Test
    fun keepsEachPointsOwnResultSheetLabelInsideOneSeries() {
        val january = row("총콜레스테롤", "194", "2026-01-15", originalLabel = "T-Chol")
        val july = row("총콜레스테롤", "190", "2026-07-28", originalLabel = "Cholesterol")
        val series = SeriesProjection.project(listOf(july, january)).series.single()
        assertThat(series.concept).isEqualTo("총콜레스테롤")
        assertThat(series.points.map { it.originalLabel }).containsExactly("T-Chol", "Cholesterol")
    }
```

`FhirObservationMapperTest.kt`: add `import kr.co.genomecompanion.documentboundary.MedicalConcept`, replace the `loinc` property and the F4 test, and change the expected `code` of `mapsACorrectedCodedNumericRecordWithItsRangeTextVerbatim` (its `row(...)` call gains `originalLabel = "Cholesterol"`):

```kotlin
    private fun concept(code: String, loinc: String?, export: Boolean, unit: String = "mg/dL") =
        MedicalConcept(code, code, loinc, unit, listOf(code.uppercase()), listOf(unit), export)

    private val loinc = mapOf("total-cholesterol" to concept("total-cholesterol", "2093-3", true))
```

```kotlin
        assertThat(observation.code).isEqualTo(FhirCodeableConcept(listOf(FhirCoding("http://loinc.org", "2093-3")), "Cholesterol"))
```

```kotlin
    @Test
    fun emitsLoincCodingOnlyWhenTheConceptDataAllowsItAndTheUnitIsCanonicalAndKeepsTheResultSheetLabelAsText() {
        val concepts = mapOf(
            "total-cholesterol" to concept("total-cholesterol", "2093-3", true),
            "ldl-cholesterol" to concept("ldl-cholesterol", "13457-7", false),
            "glucose" to concept("glucose", null, false),
            "fasting-glucose" to concept("fasting-glucose", "1558-6", true),
        )
        val ldl = row(label = "LDL 콜레스테롤", value = "110", conceptCode = "ldl-cholesterol", originalLabel = "LDL-C")
        val glucose = row(label = "혈당", value = "95", conceptCode = "glucose", originalLabel = "혈당")
        val fasting = row(label = "공복혈당", value = "92", conceptCode = "fasting-glucose", originalLabel = "FBS")
        val molar = row(label = "총콜레스테롤", value = "4.9", unit = "mmol/L", originalLabel = "TC")
        val old = row(label = "총콜레스테롤", value = "190")
        val byText = FhirObservationMapper.bundle(listOf(ldl, glucose, fasting, molar, old), concepts, now)
            .entry!!.map { it.resource }.associateBy { it.code.text }

        assertThat(byText.getValue("LDL-C").code.coding).isNull()
        assertThat(byText.getValue("혈당").code.coding).isNull()
        assertThat(byText.getValue("FBS").code.coding).containsExactly(FhirCoding("http://loinc.org", "1558-6"))
        assertThat(byText.getValue("TC").code.coding).isNull()
        // A row stored before V11 has no result-sheet label: the display label is the text.
        assertThat(byText.getValue("총콜레스테롤").code.coding).containsExactly(FhirCoding("http://loinc.org", "2093-3"))
    }
```

Delete `omitsLoincCodingForAliasOverspecifiedConceptsButKeepsTextAndKeepsCodingElsewhere`. Every other `bundle(..., loinc, now)` call compiles unchanged because `loinc` kept its name.

- [ ] **Step 2: Update the integration tests (failing)**

In `FoundationLifecyclePostgresIntegrationTest.kt`:
1. Replace all four `"alm-health-events-export.v2"` with `"alm-health-events-export.v3"`.
2. In `exportsTheOwnersEventsAsAFhirBundleWithRangeTextOnlyAndAuditsNoValue` the map is keyed by `code.text`, which is now the result-sheet label: change `containsExactlyInAnyOrder("총콜레스테롤", "당화혈색소", "비타민 D")` to `containsExactlyInAnyOrder("Cholesterol", "HbA1c", "Vitamin D")`, `observations.getValue("총콜레스테롤")` to `observations.getValue("Cholesterol")`, `observations.getValue("당화혈색소")` to `observations.getValue("HbA1c")`, and add after the `hba1c` assertions:
```kotlin
        // vitamin-d's code names D3 specifically: the concept data keeps it out of the export.
        assertThat(observations.getValue("Vitamin D")["code"].has("coding")).isFalse()
```
3. In `storesTheWorkerCandidatesWithNormalizedLabelsUnitsConceptCodesAndEvidence` add after the `listed[1]["label"]` assertion:
```kotlin
        assertThat(listed[0]["originalLabel"].asText()).isEqualTo("Cholesterol")
        assertThat(listed[1]["originalLabel"].asText()).isEqualTo("알 수 없는 항목")
```
and chain `.andExpect(jsonPath("$.originalLabel").value("Cholesterol"))` onto that test's confirmation.
4. In `healthEventsProjectCurrentRecordsWithSourceAndPreviewFlag` add `assertThat(event["originalLabel"].asText()).isEqualTo("Cholesterol")`.
5. In `seriesListCurrentValuesInTimeOrderWithThreeComputedNumbersAndNoRangeText` add, where the parsed series body is available (name the variable as that test does):
```kotlin
        assertThat(seriesBody["series"].flatMap { it["points"] }.map { it["originalLabel"].asText() }).containsOnly("Cholesterol", "HbA1c", "Vitamin D")
```
6. In `exportV2CarriesTheReferenceRangeTextTheCorrectionHistoryAndEveryCompletedDocument` rename the function to `exportV3Carries…` and add, on the parsed export body (name as in that test): `assertThat(export["events"].map { it["originalLabel"].asText() }).contains("Cholesterol")`.
7. In Task 3's new test `storesTheResultSheetLabel…`, append before the audit assertion:
```kotlin
        val fhir = responseJson(
            read(get("/api/foundation/health-events/export/fhir"), alice).andExpect(status().isOk).andReturn().response.contentAsByteArray,
        )["entry"].map { it["resource"] }.associateBy { it["code"]["text"].asText() }
        assertThat(fhir.keys).containsExactlyInAnyOrder("Cholesterol", "혈당", "UA")
        assertThat(fhir.getValue("혈당")["code"].has("coding")).isFalse()
        assertThat(fhir.getValue("UA")["code"].has("coding")).isFalse()
        assertThat(fhir.getValue("UA").has("category")).isFalse()
```
If the audit turned `total-cholesterol` or `hba1c` off, change that test's two `coding` assertions to `has("coding")).isFalse()` and say so in the task report. The leak loops (`doesNotContain("reference")`, `doesNotContain("120-199")`) are not touched and must still pass.

- [ ] **Step 3: Run to verify it fails**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon`
Expected: compilation FAILS (`originalLabel` on `HealthEvent`/`SeriesPoint`, `bundle` parameter type).

- [ ] **Step 4: Implement**

`HealthEventProjection.kt` — add as the **last** property of `HealthEvent` (after `source`; the default keeps any other constructor call compiling):
```kotlin
    /** The item name as the result sheet printed it (V11); null — omitted — for rows stored before it was kept. */
    val originalLabel: String? = null,
```
and in `project`: `originalLabel = record.originalLabel,` after the `source = HealthEventSource(…)` argument. Update the class KDoc: add "`originalLabel` is document text, not a meaning."

`SeriesProjection.kt`:
```kotlin
data class SeriesPoint(
    val eventId: UUID,
    val value: String,
    val observedOn: String,
    val documentId: UUID,
    /** The item name this point's result sheet printed; lets the person see that one series was written differently. */
    val originalLabel: String? = null,
)
```
and `points = rows.map { SeriesPoint(it.recordVersionId, it.currentValue, it.observedOn.toString(), it.documentId, it.originalLabel) },`.

`FoundationLifecycleService.kt`:
- `CandidateReceipt`: add last `val originalLabel: String? = null,`; `candidateReceipt(...)`: `originalLabel = candidate.originalLabel,`.
- `RecordReceipt`: add last `val originalLabel: String? = null,`; `recordReceipt(...)`: `originalLabel = record.originalLabel,`.
- `HealthEventExport.schemaVersion` default → `"alm-health-events-export.v3"`; its KDoc gains "v3 adds `originalLabel`."
- Replace `loincByConceptCode` with
```kotlin
    /** The seed-only concept table, read once per process: LOINC code, export flag and canonical unit. */
    private val conceptByCode: Map<String, MedicalConcept> by lazy {
        conceptSource.concepts().associateBy { it.conceptCode }
    }
```
(import `kr.co.genomecompanion.documentboundary.MedicalConcept`) and pass `conceptByCode` to `FhirObservationMapper.bundle`.

`FhirExport.kt`: delete `aliasOverspecifiedConceptCodes` and its KDoc; import `kr.co.genomecompanion.documentboundary.MedicalConcept`; change both signatures' second parameter to `concepts: Map<String, MedicalConcept>`; in `observation`:
```kotlin
        val conceptCode = record.conceptCode
        // Data-driven (gc_medical_concept.loinc_export, docs/status/2026-09-17/loinc-audit.md): a code is emitted
        // only when the audit found it no more specific than the labels, and only for a value in the concept's
        // canonical unit — the seeded codes are tied to that unit's property (mass/volume, not moles/volume).
        val loinc = conceptCode?.let(concepts::get)
            ?.takeIf { it.loincExport && record.unit == it.canonicalUnit }
            ?.loincCode
```
and `code = FhirCodeableConcept(loinc?.let { listOf(FhirCoding(LOINC_SYSTEM, it)) }, record.originalLabel ?: record.label),`. `nonLaboratoryConceptCodes` and the `category` rule stay exactly as they are.

- [ ] **Step 5: Run core tests**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --no-daemon`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add apps/core-api/src
git commit -m "feat(core): originalLabel in receipts, events, series and export v3; FHIR code.text is the sheet's label, LOINC by concept data

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Benchmark — `extended-panel` documents, `conceptAccuracy` in evaluator / report / gate, new `corpusId`

**Files:**
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/{CheckupCorpusGenerator,CorpusWriter,NativeTextRunner,BenchmarkMain}.kt`
- Modify: `packages/korean-checkup-benchmark/src/test/kotlin/kr/co/genomecompanion/benchmark/{CheckupCorpusGeneratorTest,NativeTextRunnerTest}.kt`
- Modify: `apps/web/lib/medical-ai/{contracts,evaluation,native-text-report}.ts`; tests `apps/web/tests/{medical-document-evaluation,native-text-report,medgemma-report}.test.ts`
- Modify: `docs/status/2026-09-17/medgemma-local-experiment.md`, `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md` (one sentence each)

**Interfaces:**
- Consumes: `MedicalConceptCatalogue.resolve(label, unit)`, the 69-entry catalogue (Task 2).
- Produces: `Layout.EXTENDED_PANEL("extended-panel", "health-screening-lab-report")`; `RowSpec.expectNoConcept: Boolean = false`; `GoldMeasurement.expectedConceptCode: String?`, `GoldMeasurement.expectedNoConcept: Boolean?` (only ever `true` or absent); `RunCandidate.conceptCode: String?`; TS metric `conceptAccuracy`, threshold `conceptAccuracy: 1`, failure code `concept_accuracy_below_threshold`. 31 documents (5 layouts × 6 variants + the birth-date variant, which stays last).

`corpusId` pins: no code pins the hex value (the two Kotlin tests match `synthetic-ko-checkup-r2-[0-9a-f]{16}` and `medgemma-report.test.ts` uses a placeholder id). `docs/status/2026-09-17/{wave2b,wave2c,wave3,wave4}.md`, the body of `medgemma-local-experiment.md` and the three "Pins recorded" blocks of the governance note describe past runs on `synthetic-ko-checkup-r2-e6befc286ae6ce1d` and **are not edited**. The new id is printed by the gate in Step 8 and recorded in Task 8's `wave5.md`.

- [ ] **Step 1: Write the failing Kotlin tests**

`CheckupCorpusGeneratorTest.kt`: rename the first test to `` `generates thirty-one documents whose gold the native-text parser reproduces exactly` `` and change `hasSize(25)` → `hasSize(31)`, `isEqualTo(25L)` → `isEqualTo(31L)`, and in the byte-identical test `assertThat(pdfs).hasSize(25)` → `hasSize(31)`. Add:

```kotlin
    @Test
    fun `extended panel prints broad labels, new items and unit-mismatched rows with the concept the catalogue rule gives`() {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        val generator = CheckupCorpusGenerator(font)
        val english = generator.generate(Layout.EXTENDED_PANEL, CheckupCorpusGenerator.VARIANTS[1])
        val korean = generator.generate(Layout.EXTENDED_PANEL, CheckupCorpusGenerator.VARIANTS[2])
        assertThat(english.documentId).isEqualTo("synthetic-extended-panel-v1")
        assertThat(english.rows.map { it.label }).contains("Glucose", "hs-CRP", "Bilirubin", "GFR", "UA", "Hb", "MCV", "CA19-9", "RF")
        assertThat(korean.rows.map { it.label }).contains("혈당", "고감도 CRP", "빌리루빈", "사구체여과율", "요산", "혈색소", "인(P)", "혈청철")
        assertThat(english.rows.filter { it.page == 1 }).hasSize(CheckupCorpusGenerator.BROAD_LABEL_ROWS.size)
        assertThat(english.rows.filter { it.page == 2 }).hasSize(CheckupCorpusGenerator.EXTENDED_ROWS.size)

        val gold = CorpusWriter.gold(korean).expectedMeasurements.associateBy { it.label }
        assertThat(gold.getValue("혈당").expectedConceptCode).isEqualTo("glucose")
        assertThat(gold.getValue("사구체여과율").expectedConceptCode).isEqualTo("gfr")
        assertThat(gold.getValue("요산").expectedConceptCode).isNull()
        assertThat(gold.getValue("요산").expectedNoConcept).isTrue()
        assertThat(gold.getValue("혈당").expectedNoConcept).isNull()

        // Every printed row, in every document, agrees with the shared rule: alias match and accepted unit.
        generator.generateAll().forEach { document ->
            document.rows.forEach { row ->
                val expected = if (row.spec.expectNoConcept) null else row.spec.conceptCode
                assertThat(kr.co.genomecompanion.documentboundary.MedicalConceptCatalogue.resolve(row.label, row.unit)?.conceptCode)
                    .describedAs("${document.documentId} ${row.label} ${row.unit}")
                    .isEqualTo(expected)
            }
        }
        assertThat(generator.generateAll().last().documentId).isEqualTo("synthetic-hospital-two-column-v6")
    }
```

`NativeTextRunnerTest.kt`: `hasSize(25)` → `hasSize(31)`, and add before the final `json` assertions:

```kotlin
        assertThat(run.candidates.map { it.conceptCode }).containsExactly(
            "total-cholesterol", "ldl-cholesterol", "hdl-cholesterol", "triglycerides",
            "fasting-glucose", "hba1c", "hemoglobin", "creatinine",
        )
        val extended = runs.first { it.documentId == "synthetic-extended-panel-v0" }
        val byLabel = extended.candidates.associateBy { it.label }
        assertThat(byLabel.getValue("혈당").conceptCode).isEqualTo("glucose")
        assertThat(byLabel.getValue("빌리루빈").conceptCode).isEqualTo("bilirubin")
        assertThat(byLabel.getValue("요산").fieldId).isEqualTo("uric-acid")
        assertThat(byLabel.getValue("요산").conceptCode).isNull()
        assertThat(byLabel.getValue("혈색소").conceptCode).isNull()
        assertThat(extended.abstentions).isEmpty()
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew.bat :packages:korean-checkup-benchmark:test --no-daemon`
Expected: compilation FAILS (`EXTENDED_PANEL`, `expectedConceptCode`, `conceptCode`).

- [ ] **Step 3: Generator**

`CheckupCorpusGenerator.kt`:
- `enum class Layout` gains a last entry `EXTENDED_PANEL("extended-panel", "health-screening-lab-report"),` (last, so every existing document keeps its `Random(layout.ordinal * 100 + variant.index)` seed and its bytes).
- `RowSpec` gains a last parameter with KDoc:
```kotlin
    /** True for a row whose unit the labelled concept does not accept: gold expects no concept. `conceptCode` is still the row's field id. */
    val expectNoConcept: Boolean = false,
```
- In `generate`'s `when (layout)` add:
```kotlin
                Layout.EXTENDED_PANEL -> {
                    Canvas(document, font, 1).use { canvas ->
                        canvas.line(listOf(56f to "종합검진 추가 항목 (합성 예시)"), 14f)
                        if (!omitDate) canvas.line(listOf(56f to dateLine(isoDate, variant.dateStyle)))
                        canvas.skip()
                        tableHeader(canvas, variant)
                        BROAD_LABEL_ROWS.forEach { rows += tableRow(canvas, it, variant, random) }
                    }
                    Canvas(document, font, 2).use { canvas ->
                        tableHeader(canvas, variant)
                        EXTENDED_ROWS.forEach { rows += tableRow(canvas, it, variant, random) }
                    }
                }
```
- In the companion object add (ASCII unit spellings on purpose — the existing corpus prints `kg/m2`, `/uL`, `uIU/mL` the same way; Korean labels come from `displayKo`):
```kotlin
        /** Labels that do not say which specific test they are (→ generic concept), their specific siblings, and two unit mismatches (→ no concept). */
        val BROAD_LABEL_ROWS = listOf(
            RowSpec("glucose", "Glucose", "mg/dL", "mg/dl", 80.0, 140.0, 0),
            RowSpec("postprandial-glucose", "PP2", "mg/dL", "mg/dl", 90.0, 139.0, 0),
            RowSpec("hs-crp", "hs-CRP", "mg/L", "mg/l", 0.1, 0.9, 2),
            RowSpec("bilirubin", "Bilirubin", "mg/dL", "mg/dl", 0.3, 1.1, 1),
            RowSpec("direct-bilirubin", "D-Bil", "mg/dL", "mg/dl", 0.1, 0.3, 1),
            RowSpec("gfr", "GFR", "mL/min/1.73m2", "ml/min/1.73m2", 75.0, 110.0, 0),
            RowSpec("uric-acid", "UA", "g/dL", "g/dl", 1.0, 2.0, 1, koreanLabelOverride = "요산", expectNoConcept = true),
            RowSpec("hemoglobin", "Hb", "mg/dL", "mg/dl", 12.0, 16.0, 1, koreanLabelOverride = "혈색소", expectNoConcept = true),
        )

        val EXTENDED_ROWS = listOf(
            RowSpec("hematocrit", "Hematocrit", "%", "%", 36.0, 48.0, 1),
            RowSpec("mcv", "MCV", "fL", "fl", 82.0, 98.0, 1),
            RowSpec("mch", "MCH", "pg", "pg", 27.0, 33.0, 1),
            RowSpec("mchc", "MCHC", "g/dL", "g/dl", 32.0, 36.0, 1),
            RowSpec("chloride", "Chloride", "mmol/L", "mmol/l", 98.0, 107.0, 0),
            RowSpec("phosphorus", "Phosphorus", "mg/dL", "mg/dl", 2.5, 4.5, 1),
            RowSpec("magnesium", "Magnesium", "mg/dL", "mg/dl", 1.8, 2.4, 1),
            RowSpec("iron", "Iron", "ug/dL", "ug/dl", 60.0, 160.0, 0),
            RowSpec("tibc", "TIBC", "ug/dL", "ug/dl", 250.0, 400.0, 0),
            RowSpec("vitamin-b12", "Vitamin B12", "pg/mL", "pg/ml", 300.0, 900.0, 0),
            RowSpec("folate", "Folate", "ng/mL", "ng/ml", 4.0, 15.0, 1),
            RowSpec("esr", "ESR", "mm/hr", "mm/hr", 2.0, 15.0, 0),
            RowSpec("ldh", "LDH", "U/L", "u/l", 140.0, 250.0, 0),
            RowSpec("amylase", "Amylase", "U/L", "u/l", 30.0, 100.0, 0),
            RowSpec("ck", "CK", "U/L", "u/l", 50.0, 180.0, 0),
            RowSpec("free-t3", "FT3", "pg/mL", "pg/ml", 2.3, 4.0, 2),
            RowSpec("t3", "T3", "ng/dL", "ng/dl", 80.0, 180.0, 0),
            RowSpec("non-hdl-cholesterol", "Non-HDL Cholesterol", "mg/dL", "mg/dl", 90.0, 150.0, 0),
            RowSpec("insulin", "Insulin", "uU/mL", "uu/ml", 3.0, 15.0, 1),
            RowSpec("afp", "AFP", "ng/mL", "ng/ml", 1.0, 7.0, 1),
            RowSpec("cea", "CEA", "ng/mL", "ng/ml", 0.5, 4.0, 1),
            RowSpec("psa", "PSA", "ng/mL", "ng/ml", 0.3, 3.0, 2),
            RowSpec("ca19-9", "CA19-9", "U/mL", "u/ml", 5.0, 30.0, 1),
            RowSpec("ca125", "CA125", "U/mL", "u/ml", 5.0, 30.0, 1),
            RowSpec("rf", "RF", "IU/mL", "iu/ml", 3.0, 13.0, 1),
        )
```

- [ ] **Step 4: Gold and run records**

`CorpusWriter.kt` — `GoldMeasurement` gains two last properties, and `gold()` fills them:
```kotlin
    /** The concept core's rule (alias match + accepted unit) must give this row; absent when [expectedNoConcept]. */
    val expectedConceptCode: String? = null,
    /** True when the rule must give no concept (the unit is not one the labelled concept accepts). Never false. */
    val expectedNoConcept: Boolean? = null,
```
```kotlin
                    expectedReferenceRangeText = row.referenceRangeText,
                    expectedConceptCode = if (row.spec.expectNoConcept) null else row.spec.conceptCode,
                    expectedNoConcept = if (row.spec.expectNoConcept) true else null,
```
Change `Corpus.description` to `"합성 한국 검진 결과지 5 레이아웃 × 6 변형 + 생년월일 선행 1종 (31종, 1종은 텍스트 레이어 없는 스캔, 1종은 무날짜; extended-panel은 넓은 라벨·신규 항목·단위 불일치 행). PDFBox 텍스트 레이어 파서 채점용. 실제 데이터 없음."`.

`NativeTextRunner.kt` — `RunCandidate` gains a last property `val conceptCode: String? = null,` with KDoc "Core's rule computed from the Kotlin copy of the dictionary (alias match + accepted unit); the seed-equality test binds the copy to core." and `toCandidate` passes `conceptCode = MedicalConceptCatalogue.resolve(candidate.label, candidate.unit)?.conceptCode,`. `fieldIdFor` is unchanged (label-only, so a unit-mismatched row keeps its identity). `BenchmarkMain.kt`: in the KDoc replace "the 24-document synthetic corpus" with "the 31-document synthetic corpus".

- [ ] **Step 5: Run the Kotlin tests**

Run: `./gradlew.bat :packages:korean-checkup-benchmark:test --no-daemon`
Expected: `BUILD SUCCESSFUL`. If a new row does not parse back exactly (label/value/unit/box), change that **corpus row's** label or unit spelling to one the unchanged worker grammar reads; do not change `NativeTextExtractionProvider` in this wave, and name the row in the task report.

- [ ] **Step 6: Write the failing TypeScript tests**

`apps/web/tests/medical-document-evaluation.test.ts`, new test:

```ts
it("scores the concept code against gold, counts an expected no-concept row, and fails the gate when it drifts", () => {
  const baseline = evaluateMedicalDocumentPipeline(corpus, referenceRuns);
  expect(baseline.metrics.conceptAccuracy).toBe(1);
  expect(baseline.gate.thresholds.conceptAccuracy).toBe(1);

  const gold = structuredClone(corpus) as unknown as { documents: Array<{ documentId: string; expectedMeasurements: Array<Record<string, unknown>> }> };
  const runs = structuredClone(referenceRuns) as unknown as Array<{ documentId: string; candidates: Array<Record<string, unknown>> }>;
  const run = runs[0];
  const [first, second] = run.candidates;
  const fields = gold.documents.find((document) => document.documentId === run.documentId)!.expectedMeasurements;
  fields.find((field) => field.fieldId === first.fieldId)!.expectedConceptCode = "glucose";
  fields.find((field) => field.fieldId === second.fieldId)!.expectedNoConcept = true;
  first.conceptCode = "glucose";
  const matching = evaluateMedicalDocumentPipeline(gold, runs);
  expect(matching.metrics.conceptAccuracy).toBe(1);
  expect(matching.gate.passed).toBe(true);

  first.conceptCode = "fasting-glucose";
  const drifted = evaluateMedicalDocumentPipeline(gold, runs);
  expect(drifted.metrics.conceptAccuracy).toBe(0.5);
  expect(drifted.metrics.fieldF1).toBe(1);
  expect(drifted.gate.failures).toEqual(["concept_accuracy_below_threshold"]);

  first.conceptCode = "glucose";
  second.conceptCode = "uric-acid";
  expect(evaluateMedicalDocumentPipeline(gold, runs).gate.failures).toEqual(["concept_accuracy_below_threshold"]);
});
```

`apps/web/tests/native-text-report.test.ts`: add `conceptAccuracy: 1,` to `metrics` and to `thresholds`, and two expectations: `expect(markdown).toContain("| Concept code per the alias and unit rule | 100.0% |");` and `expect(markdown).toContain("concept code = 1");`.

- [ ] **Step 7: Evaluator, contracts, report**

`contracts.ts`:
```ts
const conceptCodeSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);
```
add `conceptCode: conceptCodeSchema.optional(),` to `extractedMeasurementSchema` (after `referenceRangeText`), and
```ts
export const expectedMeasurementSchema = extractedMeasurementSchema
  .omit({ confidence: true, referenceRangeText: true, conceptCode: true })
  .extend({
    expectedReferenceRangeText: referenceRangeTextSchema.optional(),
    expectedConceptCode: conceptCodeSchema.optional(),
    expectedNoConcept: z.literal(true).optional(),
  });
```

`evaluation.ts`: add `conceptAccuracy: number;` to `MedicalDocumentGateThresholds` and to `metrics`, `conceptAccuracy: 1,` to `candidateAdmissionThresholds`, two counters `let conceptExpectedCount = 0; let conceptMatchCount = 0;`, inside the matched-candidate branch right after the reference-range line:
```ts
      if (expected.expectedNoConcept || expected.expectedConceptCode !== undefined) {
        conceptExpectedCount += 1;
        const wanted = expected.expectedNoConcept ? null : expected.expectedConceptCode ?? null;
        if ((candidate.conceptCode ?? null) === wanted) conceptMatchCount += 1;
      }
```
then `const conceptAccuracy = ratio(conceptMatchCount, conceptExpectedCount);`, `if (conceptAccuracy < thresholds.conceptAccuracy) failures.push("concept_accuracy_below_threshold");` (after the reference-range check) and `conceptAccuracy,` in the returned `metrics`.

`native-text-report.ts`: after the reference-range row add `` `| Concept code per the alias and unit rule | ${percent(m.conceptAccuracy)} |`, `` and end the thresholds sentence with `…, reference-range text = 1, concept code = 1.`

Then run `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`: every typed report literal it names (at least `tests/medgemma-report.test.ts`) gets `conceptAccuracy: 1` in `metrics` and in `thresholds`. `medgemma-report.ts` gains no row (MedGemma runs carry no concept code; re-running is out of scope).

- [ ] **Step 8: Run web tests and the gate**

Run: `pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm medical-ai:native-text-gate`
Expected: vitest green; gate prints `"documentCount": 31`, `"fieldF1": 1`, `"referenceRangeAccuracy": 1`, `"conceptAccuracy": 1`, `"passed": true` and a **new** `"corpusId": "synthetic-ko-checkup-r2-<16 hex>"`. Run the gate twice; the id must be identical. Copy it for Step 9 and for Task 8.

- [ ] **Step 9: One sentence in the experiment document and in the governance note**

In `docs/status/2026-09-17/medgemma-local-experiment.md`, directly under the first paragraph, and in `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md`, as a new last paragraph, add (with the id from Step 8):

```markdown
Note (Wave 5, 2026-09-17): Runs 1–3 used the previous corpus `synthetic-ko-checkup-r2-e6befc286ae6ce1d` (25 documents); the current generator produces `<new corpusId>` (31 documents, `extended-panel` added) and MedGemma has not been re-run on it.
```
Nothing else in either file changes.

- [ ] **Step 10: Commit**

```bash
git add packages/korean-checkup-benchmark apps/web/lib/medical-ai apps/web/tests docs/status/2026-09-17/medgemma-local-experiment.md governance/founder-medgemma-local-evaluation-approval-2026-09-16.md
git commit -m "feat(benchmark): extended-panel documents and conceptAccuracy = 1 in the native-text gate

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Web — strict `originalLabel`, fixtures, "결과지 표기" on review, records, evidence drawer and the 측정 이력 table, copy scan

**Files:**
- Create: `apps/web/lib/format/original-label.ts`, `apps/web/tests/original-label.test.ts`
- Modify: `apps/web/lib/foundation/client.ts` (`candidateSchema`, `recordSchema`, `healthEventSchema`, `seriesPointSchema`), `apps/web/tests/fixtures/foundation.ts`
- Modify: `apps/web/components/integrated/CandidateReview.tsx`, `apps/web/components/integrated/IntegratedRecords.tsx`, `apps/web/components/my-data/EvidenceDrawer.tsx`, `apps/web/components/my-data/history/MeasurementHistory.tsx`
- Modify: `apps/web/app/globals.css`, `apps/web/components/records/HealthTimeline.module.css`
- Test: `apps/web/tests/{foundation-client.test.ts,candidate-review.test.tsx,integrated-records-grouping.test.tsx,evidence-drawer.test.tsx,measurement-history.test.tsx,korean-ux-copy.test.ts}`

**Interfaces:**
- Consumes: server keys `originalLabel?` on candidate, record, health event and series point (Task 4); the 측정 이력 screen as landed on `codex/wave9-history-screen` — per `.superpowers/sdd/task-7-brief.md`: component `MeasurementHistory`, one `<table className={styles.table} aria-label={`${item.concept} 측정 이력`}>` per series inside `<div className={styles.tableWrap}>`, header `검사일 · 값 · 단위 · 출처`, one `<tr key={point.eventId}>` per point, test id `history-series`, fixture `syntheticSeries()`.
- Produces: `originalLabelLine(originalLabel: string | null | undefined, shownLabel: string): string | null` (returns `결과지 표기: <원문>` or `null`), `ORIGINAL_LABEL_NOT_KEPT` (the drawer sentence); test ids `original-label` (review, records, drawer).

**Read first:** `apps/web/AGENTS.md`, then the landed `apps/web/components/my-data/history/MeasurementHistory.tsx`, `History.module.css` and `apps/web/tests/measurement-history.test.tsx`. That screen was written while this plan was being written; where its landed markup differs from the interface above, keep the rule (decision 8) and adapt the selectors.

- [ ] **Step 1: Write the failing helper test**

`apps/web/tests/original-label.test.ts`:

```ts
import { expect, it } from "vitest";
import { ORIGINAL_LABEL_NOT_KEPT, originalLabelLine } from "@/lib/format/original-label";

it("prints the result-sheet label only when it differs from the shown name", () => {
  expect(originalLabelLine("Cholesterol", "총콜레스테롤")).toBe("결과지 표기: Cholesterol");
  expect(originalLabelLine("공복 혈당", "공복혈당")).toBe("결과지 표기: 공복 혈당");
  expect(originalLabelLine("혈당", "혈당")).toBeNull();
  expect(originalLabelLine(" 혈당 ", "혈당")).toBeNull();
  expect(originalLabelLine(undefined, "혈당")).toBeNull();
  expect(originalLabelLine(null, "혈당")).toBeNull();
  expect(ORIGINAL_LABEL_NOT_KEPT).toBe("이 기록은 결과지 표기를 보존하기 전에 저장됐어요.");
});
```

- [ ] **Step 2: Write the failing schema and component tests**

`foundation-client.test.ts` — inside "reads health events and rejects interpretation fields" add:
```ts
    const labelled = createFoundationClient({ fetcher: vi.fn(async () => jsonResponse([syntheticHealthEvent({ originalLabel: "Cholesterol" })])), readCsrfToken: () => "csrf-value" });
    await expect(labelled.getHealthEvents()).resolves.toMatchObject([{ originalLabel: "Cholesterol" }]);
    const { originalLabel: _omitted, ...preV11 } = syntheticHealthEvent();
    const older = createFoundationClient({ fetcher: vi.fn(async () => jsonResponse([preV11])), readCsrfToken: () => "csrf-value" });
    await expect(older.getHealthEvents()).resolves.toHaveLength(1);
    for (const broken of [{ originalLabel: null }, { originalLabel: "" }, { originalLabel: "가".repeat(81) }]) {
      const rejecting = createFoundationClient({ fetcher: vi.fn(async () => jsonResponse([{ ...syntheticHealthEvent(), ...broken }])), readCsrfToken: () => "csrf-value" });
      await expect(rejecting.getHealthEvents()).rejects.toThrow();
    }
```
and in the series test add to the `broken` list `{ ...base, points: [{ ...base.points[0], originalLabel: null }] },` plus, before the loop, `expect(loaded.series[2].points.map((point) => point.originalLabel)).toEqual(["Cholesterol", "Cholesterol"]);`.

`candidate-review.test.tsx`:
```tsx
it("shows the result-sheet label under the normalized name only when they differ", () => {
  const { rerender } = render(<CandidateReview {...reviewProps()} />);
  expect(screen.getByRole("heading", { level: 2, name: "총콜레스테롤" })).toBeVisible();
  expect(screen.getByTestId("original-label")).toHaveTextContent("결과지 표기: Cholesterol");
  rerender(<CandidateReview {...reviewProps()} candidate={{ ...syntheticCandidates[0], label: "혈당", conceptCode: "glucose", originalLabel: "혈당" }} />);
  expect(screen.queryByTestId("original-label")).toBeNull();
  const { originalLabel: _none, ...preV11 } = syntheticCandidates[0];
  rerender(<CandidateReview {...reviewProps()} candidate={preV11} />);
  expect(screen.queryByTestId("original-label")).toBeNull();
});
```

`evidence-drawer.test.tsx`:
```tsx
it("shows the result-sheet label when it differs, nothing when it is the same, and says so when it was never kept", () => {
  const { rerender } = render(<EvidenceDrawer event={syntheticHealthEvent()} onClose={() => {}} />);
  expect(screen.getByTestId("original-label")).toHaveTextContent("결과지 표기: Cholesterol");
  rerender(<EvidenceDrawer event={syntheticHealthEvent({ concept: "혈당", conceptCode: "glucose", originalLabel: "혈당" })} onClose={() => {}} />);
  expect(screen.queryByTestId("original-label")).toBeNull();
  expect(screen.queryByText("이 기록은 결과지 표기를 보존하기 전에 저장됐어요.")).toBeNull();
  const { originalLabel: _none, ...preV11 } = syntheticHealthEvent();
  rerender(<EvidenceDrawer event={preV11} onClose={() => {}} />);
  expect(screen.queryByTestId("original-label")).toBeNull();
  expect(screen.getByText("이 기록은 결과지 표기를 보존하기 전에 저장됐어요.")).toBeVisible();
});
```

`integrated-records-grouping.test.tsx` — in the `records` array give the first record `originalLabel: "Cholesterol"`, the second `originalLabel: "당화혈색소"`, leave the third without one (spread `syntheticRecord(...)` and delete the key: `(({ originalLabel: _n, ...rest }) => rest)(syntheticRecord({...}))`), and add:
```tsx
it("prints the result-sheet label beside a record only when it differs from the shown name", async () => {
  render(<IntegratedRecords />);
  const items = await screen.findAllByTestId("durable-record");
  const lines = items.map((item) => item.querySelector('[data-testid="original-label"]')?.textContent ?? null);
  expect(lines).toContain("결과지 표기: Cholesterol");
  expect(lines.filter((line) => line !== null)).toHaveLength(1);
});
```

`measurement-history.test.tsx` — the fixture now carries labels, so update the pinned rows of the first test and add one test:
```tsx
  expect(rows.map((row) => row.textContent)).toEqual([
    "검사일값단위결과지 표기출처",
    "2026. 1. 15.194mg/dLCholesterol출처 보기",
    "2026. 7. 28.190mg/dLCholesterol출처 보기",
  ]);
```
```tsx
it("adds the 결과지 표기 column only to a series where a label differs, and leaves a same-name cell empty", async () => {
  const data = syntheticSeries();
  data.series[1].points[0].originalLabel = "비타민 D";
  data.series[2].points[0].originalLabel = "총콜레스테롤";
  server.use(http.get("/api/foundation/series", () => HttpResponse.json(data)));
  render(<MeasurementHistory />);
  const sections = await screen.findAllByTestId("history-series");
  expect(within(sections[1]).queryByRole("columnheader", { name: "결과지 표기" })).toBeNull();
  const rows = within(within(sections[2]).getByRole("table", { name: "총콜레스테롤 측정 이력" })).getAllByRole("row");
  expect(rows.map((row) => row.textContent)).toEqual([
    "검사일값단위결과지 표기출처",
    "2026. 1. 15.194mg/dL출처 보기",
    "2026. 7. 28.190mg/dLCholesterol출처 보기",
  ]);
});
```

`korean-ux-copy.test.ts` — add to `userFacingFiles` (keep any entry the history-screen task already added): `"components/my-data/history/MeasurementHistory.tsx"`, `"components/my-data/history/HistoryGraph.tsx"`, `"lib/format/original-label.ts"`; and one test:
```ts
  it("names the result-sheet label without judging it", () => {
    const helper = source("lib/format/original-label.ts");
    expect(helper).toContain("결과지 표기: ");
    expect(helper).toContain("이 기록은 결과지 표기를 보존하기 전에 저장됐어요.");
    for (const path of ["components/integrated/CandidateReview.tsx", "components/integrated/IntegratedRecords.tsx", "components/my-data/EvidenceDrawer.tsx", "components/my-data/history/MeasurementHistory.tsx"]) {
      expect(source(path), `${path} does not use the shared helper`).toContain("originalLabelLine(");
    }
  });
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm web:test`
Expected: FAIL — `@/lib/format/original-label` not found; strict schemas reject `originalLabel`.

- [ ] **Step 4: Helper, schemas, fixtures**

`apps/web/lib/format/original-label.ts`:
```ts
/** The sentence the evidence drawer shows for a record stored before the result-sheet label was kept. */
export const ORIGINAL_LABEL_NOT_KEPT = "이 기록은 결과지 표기를 보존하기 전에 저장됐어요.";

/**
 * "결과지 표기: <원문>" when the result sheet printed the item under another name than the one shown,
 * otherwise null. Document text only: no comparison of values, no meaning.
 */
export function originalLabelLine(originalLabel: string | null | undefined, shownLabel: string): string | null {
  if (!originalLabel) return null;
  return originalLabel.trim() === shownLabel.trim() ? null : `결과지 표기: ${originalLabel}`;
}
```

`client.ts` — next to `conceptCodeSchema`:
```ts
// The item name exactly as the result sheet printed it. The server omits the key for rows stored
// before it was kept (Jackson non_null), so it is optional and never null.
const originalLabelSchema = z.string().min(1).max(80);
```
and add `originalLabel: originalLabelSchema.optional(),` as the last key of `candidateSchema`, `recordSchema`, `healthEventSchema` (after `source`) and `seriesPointSchema`. Every object stays `.strict()`.

`tests/fixtures/foundation.ts` — add `originalLabel: "Cholesterol"` to the first candidate, `"HbA1c"` to the second, `"Vitamin D"` to the third; `originalLabel: "Cholesterol"` to `syntheticRecord` and `syntheticHealthEvent` (before `...overrides`); and to every series point: `"HbA1c"` (both 당화혈색소 points), `"Vitamin D"`, `"Cholesterol"` (both 총콜레스테롤 points). No fixture label contains a range.

- [ ] **Step 5: Components**

`CandidateReview.tsx` — import `{ originalLabelLine } from "@/lib/format/original-label"`; directly under `<h2>{candidate.label}</h2>`:
```tsx
            {originalLabelLine(candidate.originalLabel, candidate.label) && (
              <p className="gc-import__candidate-original" data-testid="original-label">{originalLabelLine(candidate.originalLabel, candidate.label)}</p>
            )}
```
`app/globals.css`, after `.gc-import__candidate-source`:
```css
.gc-import__candidate-original { margin: 0 0 8px; min-width: 0; overflow-wrap: anywhere; font-size: 0.875rem; color: var(--gc-color-text-secondary, #555); }
```

`IntegratedRecords.tsx` — same import; inside `<div className={styles.historySource}>` after `<strong>{record.label}</strong>`:
```tsx
{originalLabelLine(record.originalLabel, record.label) && <span className={styles.historyOriginal} data-testid="original-label">{originalLabelLine(record.originalLabel, record.label)}</span>}
```
`HealthTimeline.module.css`, after `.historySource span`: `.historySource { min-width: 0; }` and `.historyOriginal { min-width: 0; overflow-wrap: anywhere; }`.

`EvidenceDrawer.tsx` — import both names; as the first rows of the `<dl>` (the drawer already has `min-width: 0; overflow-wrap: anywhere`):
```tsx
        {originalLabelLine(event.originalLabel, event.concept) && (
          <><dt>결과지</dt><dd data-testid="original-label">{originalLabelLine(event.originalLabel, event.concept)}</dd></>
        )}
        {!event.originalLabel && <><dt>결과지</dt><dd>{ORIGINAL_LABEL_NOT_KEPT}</dd></>}
```

`MeasurementHistory.tsx` — same import; per series compute
```tsx
const showsOriginalLabel = item.points.some((point) => originalLabelLine(point.originalLabel, item.concept) !== null);
```
add `{showsOriginalLabel && <th scope="col">결과지 표기</th>}` between the `단위` and `출처` headers, and in each row between the unit cell and the source cell:
```tsx
{showsOriginalLabel && <td className={styles.originalLabel}>{originalLabelLine(point.originalLabel, item.concept) ? point.originalLabel : ""}</td>}
```
(the header names the column, so the cell holds the label alone). `History.module.css`: `.originalLabel { min-width: 0; overflow-wrap: anywhere; }`. The table stays inside `.tableWrap`.

- [ ] **Step 6: Run**

Run: `pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`
Expected: all green (unused destructured `_omitted`/`_none`/`_n` names follow the repo's underscore convention; if eslint in `web:test` objects, use `delete copy.originalLabel` on a spread copy instead).

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib apps/web/components apps/web/app/globals.css apps/web/tests
git commit -m "feat(web): strict originalLabel and the 결과지 표기 line on review, records, evidence and history

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Browser lifecycle — broad label on review, 결과지 표기, FHIR `code.text`, export v3

**Files:**
- Modify: `apps/web/lib/foundation/synthetic-document.ts`, `apps/web/tests/synthetic-document.test.ts`
- Modify: `apps/web/e2e/foundation-lifecycle.spec.ts`

**Interfaces:**
- Consumes: everything above. The fixture digests are computed from `buildSyntheticResultPdf` at start-up by both `apps/web/playwright.foundation.config.ts` and `apps/web/scripts/synthetic-local.mts` (`GC_ALLOWED_DOCUMENT_SHA256`), so a changed fixture is allow-listed automatically; no digest is written down anywhere.
- Produces: January fixture with a fourth line `Glucose: 92 mg/dL`.

The fixture is a hand-built PDF with a Helvetica Type1 font and an ASCII content stream whose `/Length` is `content.length`; it cannot carry Hangul (decision 3). Read the landed spec file first — the history-screen task added steps to it.

- [ ] **Step 1: Fixture unit test (failing)**

In `synthetic-document.test.ts` change the January list to `["Cholesterol: 194 mg/dL", "HbA1c: 5.4 %", "Vitamin D: 45 ng/mL", "Glucose: 92 mg/dL", "2026-01-15"]` and add `expect(july).not.toContain("Glucose");`.

Run: `pnpm web:test -- synthetic-document` → FAIL.

- [ ] **Step 2: Fixture**

In `buildSyntheticResultPdf` append `"Glucose: 92 mg/dL"` as the last element of the `2026-01` lines only. Run the same command → PASS.

- [ ] **Step 3: e2e edits**

Find the January review with `grep -n '"1 / 3"\|"2 / 3"\|"3 / 3"' apps/web/e2e/foundation-lifecycle.spec.ts`: the second block of the first test (after the second upload, currently lines ≈322–330) is January. In that block only, change `"1 / 3"`, `"2 / 3"`, `"3 / 3"` to `"1 / 4"`, `"2 / 4"`, `"3 / 4"` and, after the third January confirmation, add:

```ts
  // Wave 5: a broad label goes to the generic concept, and the sheet's own word stays visible.
  await expect(page.getByLabel("검토 진행")).toHaveText("4 / 4");
  await expect(page.getByRole("heading", { level: 2, name: "혈당", exact: true })).toBeVisible();
  await expect(page.getByTestId("original-label")).toHaveText("결과지 표기: Glucose");
  await expect(page.getByRole("heading", { level: 2, name: "공복혈당" })).toHaveCount(0);
```
then exclude that candidate with the same clicks the July block uses to exclude 비타민 D (copy them; do not confirm it). Excluding keeps every later count (records 5, cells 5, FHIR entries 5, changes 3, questions) unchanged. Check the other two tests with `grep -n "FIXTURE_2" apps/web/e2e/*.ts`; if one reviews the January document, apply the same `/ 4` change and exclusion there.

In the first July review (the `"1 / 3"` at ≈line 192) add: `await expect(page.getByTestId("original-label")).toHaveText("결과지 표기: Cholesterol");`.

Where the test opens the evidence drawer for 총콜레스테롤 on `/my-data` (search `근거`), add: `await expect(page.getByTestId("original-label")).toHaveText("결과지 표기: Cholesterol");`. On `/records` add: `await expect(page.getByTestId("durable-record").filter({ hasText: "총콜레스테롤" }).first().getByTestId("original-label")).toHaveText("결과지 표기: Cholesterol");`. If the landed spec visits `/my-data/history`, add there: `await expect(page.getByRole("table", { name: "총콜레스테롤 측정 이력" }).getByRole("columnheader", { name: "결과지 표기" })).toBeVisible();`.

Export block: `"alm-health-events-export.v2"` → `"alm-health-events-export.v3"`, add `originalLabel?: string` to the `events` element type and
```ts
  expect(exported.events.map((event) => event.originalLabel).sort()).toEqual(["Cholesterol", "Cholesterol", "HbA1c", "HbA1c", "Vitamin D"]);
```
FHIR block: in the `toMatchObject` change `text: "총콜레스테롤"` to `text: "Cholesterol"` (if the audit turned `total-cholesterol` off, drop the `coding` member from that expectation), and add
```ts
  expect(fhirBundle.entry.map((entry) => entry.resource.code.text).sort()).toEqual(["Cholesterol", "Cholesterol", "HbA1c", "HbA1c", "Vitamin D"]);
```
(extend the local `fhirBundle` type with `code: { text: string; coding?: unknown[] }` if it lacks it). The existing `120-199` and `reference` leak assertions stay.

- [ ] **Step 4: Run**

Run: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine' && pnpm foundation:e2e`
Expected: `3 passed`, including the 320px `captureMatrix` (no horizontal overflow from the new line). Then `git checkout -- apps/web/next-env.d.ts` if the run touched it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/foundation/synthetic-document.ts apps/web/tests/synthetic-document.test.ts apps/web/e2e/foundation-lifecycle.spec.ts
git commit -m "test(e2e): broad label lands on 혈당 with its 결과지 표기, FHIR code.text is the sheet's label, export v3

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Gates, evidence, ledger

**Files:**
- Create: `docs/status/2026-09-17/wave5.md`
- Modify: `AGENTS.md`, `PROJECT_GUIDE.md`, `docs/roadmap/2026-09-02-roadmap.md`

**Interfaces:**
- Consumes: all tasks; the new `corpusId` from Task 5 Step 8; `loinc-audit.md`.
- Produces: evidence only. `release/readiness.json` is not touched.

- [ ] **Step 1: Run every gate and keep the output lines**

```bash
export PATH="$HOME/.gc-node24:$PATH"
export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test' GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'
pnpm security:runtime-policy && pnpm release:readiness:validate && pnpm security:github-actions-policy && pnpm auth-security:gate
pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm --dir apps/web build
./gradlew.bat cleanTest test --no-daemon
pnpm medical-ai:native-text-gate
pnpm foundation:e2e
git diff --quiet "$(git merge-base HEAD origin/codex/wave9-history-screen)" -- release/readiness.json && echo "readiness unchanged"
git checkout -- apps/web/next-env.d.ts
```
Expected: `runtime-policy: PASS …`, `release-readiness: NO_GO …` (exit 0, verdict unchanged), `github-actions-policy: PASS`, `auth-security-gate: PASS`, vitest all passed, tsc silent, `Compiled successfully`, `BUILD SUCCESSFUL`, gate `"fieldF1": 1`, `"referenceRangeAccuracy": 1`, `"conceptAccuracy": 1`, `"passed": true`, `3 passed`, `readiness unchanged`.

- [ ] **Step 2: Write `docs/status/2026-09-17/wave5.md`**

Same shape as `wave4.md`, in this order, with the real numbers from Step 1 (test counts from the Gradle/vitest output, never estimated):

```markdown
# Wave 5 evidence — concept accuracy (2026-09-17)

Branch `codex/wave10-concept-accuracy` (stacked on `codex/wave9-history-screen`). Synthetic only. Release remains NO_GO; no readiness gate or verdict changed. No gate document: every item narrows a claim or preserves document text (spec `docs/superpowers/specs/2026-09-17-wave5-concept-accuracy-design.md`).

## What exists now
- **결과지 표기.** V11 `original_label` on the candidate and the record version: written from the worker's raw label, copied at confirmation, inherited by corrections, never client-writable (an `originalLabel` field on a correction is a 400), absent from audit rows. Returned as `originalLabel` on candidates, records, health events and series points; JSON export `alm-health-events-export.v3`; FHIR `code.text` is the sheet's label (display label for rows stored before V11). Rows stored before V11 keep NULL and were not re-normalised.
- **Aliases.** <the alias moves of Global Constraints, one line>; `K` removed; 69 concepts; invariants tested (no shared key, no one-character alias, broad labels → generic concepts).
- **Unit guard.** A label keeps its concept only when the unit is in `accepted_units`; otherwise no concept and the raw label.
- **LOINC.** `loinc_export` read from data; FALSE for <list from loinc-audit.md>; NULL code for <list>; code emitted only in the canonical unit. Evidence: `docs/status/2026-09-17/loinc-audit.md`.
- **Benchmark.** 31 documents; `corpusId` `<new id>` (previous `synthetic-ko-checkup-r2-e6befc286ae6ce1d`, 25 documents; MedGemma Runs 1–3 used the previous corpus and were not re-run); `conceptAccuracy` added to the gate.
- **Web.** "결과지 표기: …" on review, records, evidence drawer and the 측정 이력 table, only when it differs; the drawer says when a record predates it.

## Evidence (local, 2026-09-17)
| Gate | Result |
|---|---|
<one row per command of Step 1 with its output line>

## Limits
No hosted run. LOINC names were read from public pages on one day and are informational metadata only; codes that could not be read are not exported. Existing records keep the concept they were given before the aliases were narrowed (for example a row printed as "혈당" and stored as 공복혈당 stays so, and still shares a series with it). Qualitative results still abstain. No unit conversion: the same item in two units is two series. MedGemma was not re-run on the new corpus. The e2e fixture is ASCII, so the Korean "혈당" path is proven in the core integration test and the benchmark, and the browser proves it with "Glucose". <any corpus row changed in Task 5 Step 5; any e2e deviation>.
```
Replace every `<…>` with the real content before committing; no angle-bracket text may remain (`grep -n "<" docs/status/2026-09-17/wave5.md` shows only none or code).

- [ ] **Step 3: One sentence each**

- `AGENTS.md`, end of the second "Boundaries that end a task" bullet's parenthesis, add: ` An alias is never broader than its concept, a concept is attached only for an accepted unit, and a LOINC code is exported only when `gc_medical_concept.loinc_export` is true (`docs/status/2026-09-17/wave5.md`).`
- `PROJECT_GUIDE.md`, §3 "Core API" table row, append: ` Since Wave 5 it keeps the result sheet's own item name beside the normalized one, guards concepts by accepted unit, and exports LOINC only where the audit allows (`docs/status/2026-09-17/wave5.md`, `docs/status/2026-09-17/loinc-audit.md`).`
- `docs/roadmap/2026-09-02-roadmap.md`: add one row under the last `A…` row with the next free id, in that table's column layout: `Concept accuracy: result-sheet label kept (V11), aliases never broader than the concept, unit guard, LOINC audit with data-driven export, 31 numeric/generic concepts added, benchmark conceptAccuracy = 1` | `docs/status/2026-09-17/wave5.md` | and the same status wording the neighbouring implemented rows use.

- [ ] **Step 4: Inspect and commit**

`git status --short` shows only the three ledger files and `wave5.md` (no `next-env.d.ts`, `test-results`, `build/`). `git diff` contains no secret and no real data.

```bash
git add docs/status/2026-09-17/wave5.md AGENTS.md PROJECT_GUIDE.md docs/roadmap/2026-09-02-roadmap.md
git commit -m "docs: Wave 5 evidence — concept accuracy, LOINC audit, new corpus id

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage.** §1 → Global Constraints. §2 → Task 3 (V11 columns, store/copy/inherit, 400), Task 4 (receipts, HealthEvent, SeriesPoint, export v3, FHIR `code.text`), Task 6 (four screens, drawer sentence, zod + fixtures). §3 → Task 2 (aliases, generic concepts, invariants), Task 3 (seed + the existing equality test, which now compares all seven fields). §4 → Task 2 (`accepts`), Task 3 (normalizer + `UA 1.2 g/dL` unit and integration tests). §5 → Task 1 (audit), Tasks 2–3 (values), Task 4 (data-driven mapper). §6 → Task 2/3 (25 items, two-letter aliases unit-guarded, one-letter aliases refused). §7 → Task 5. §8 → each task's tests, Task 7 (e2e), Task 8 (gates, evidence, ledger). §9 → nothing planned for it.

**Placeholders.** The only data not fixed in this document is what the spec forbids fixing in advance: the LOINC values (Task 1 produces them; Tasks 2–3 say exactly which two arguments/columns they replace) and the new `corpusId` (Task 5 Step 8 prints it). `wave5.md`'s angle-bracket slots are outputs of Step 1 and are checked empty before commit.

**Type consistency.** `MedicalConcept(…, acceptedUnits, loincExport)`, `accepts(unit)`, `resolve(label, unit)` (Task 2) are what Tasks 3, 4, 5 call. `originalLabel` is `String` on `NormalizedCandidate`, `String?` on both repository rows and on the four response types, `originalLabelSchema.optional()` on the four zod objects, and `original_label` in SQL. `FhirObservationMapper.bundle(records, concepts: Map<String, MedicalConcept>, now)` is used identically in the service and the unit test. Gold `expectedConceptCode` / `expectedNoConcept` and run `conceptCode` have the same names in Kotlin, zod and the evaluator. Test id `original-label` is the one used by Tasks 6 and 7.
