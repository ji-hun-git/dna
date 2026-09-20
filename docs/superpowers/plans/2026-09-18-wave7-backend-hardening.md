# Wave 7 — 백엔드 경화 (침묵하지 않는 추출 · 값 계약 · 멱등성/동시성 · 보안 · 운영 · 정직성) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the parser say what it dropped (never `return null` on a labelled numeric row), make the value grammar a person may confirm equal to the grammar the worker can produce, make idempotency keys, row locks, consent revocation and deletion mean exactly one thing each, close the request-size/session/audit-flood/PDF holes, and make logs, health, migration replay and gates able to fail for real — split into PR 7a (parser, value contract, idempotency/concurrency/state, hand-labelled fixtures) and PR 7b (security, API contract, operability, honesty).

**Architecture:** The worker's `NativeTextExtractionProvider` grows a positional token grouper (x-gap columns) in front of the existing row grammar and a closed set of seven abstention reasons; every early return of `parseRow` maps to a reason. Core replaces the four-digit confirmed-value regex with the worker's `ExtractedCandidate.value` pattern, adds `request_sha256`/`expires_at` to `gc_idempotency` (V13), takes `SELECT … FOR UPDATE` on the candidate/record/document row before every state check, terminates documents on `DOCUMENT_EXTRACTION` revocation (`TERMINATED_BY_REVOCATION`), and commits deletion before touching files. 7b adds a body-size filter, a session limiter, `POST /session/logout`, an `X-Requested-With` CSRF header, HMAC worker ids, a hardened `PdfSecurityInspector` with a bounded render subprocess, cursor pagination, a hand-written OpenAPI file checked by a test, `PhiSafeLogger` usage proven by a log-capture test, a janitor, a migration-replay CI job and an image-smoke CI job.

**Tech Stack:** Kotlin 2.3.21 / Java 21 / Gradle 8.14.3 (`./gradlew.bat`), Spring Boot 3.5.16 + JdbcTemplate + Flyway, JUnit 5 + AssertJ + MockMvc, PDFBox 3.0.8, Logback; Next 16.3.3 / React 19 / zod 4 / vitest / Playwright 1.62; pnpm 11.20.0, Node 24.20.0; PostgreSQL 16 (`gc_test`) for gated JVM tests and the browser lifecycle; GitHub Actions pinned by SHA.

Spec: `docs/superpowers/specs/2026-09-18-wave7-backend-hardening-design.md` (founder decisions §1 are binding). Authority: `PROJECT_GUIDE.md` §6–8, `AGENTS.md`, `.claude/skills/gc-safe-change`, `gc-synthetic-fixture`, `gc-readiness-evidence`, `gc-korean-copy`. Previous wave: `docs/superpowers/plans/2026-09-17-wave5-concept-accuracy.md`, evidence `docs/status/2026-09-17/wave5.md`.

## Global Constraints

- Toolchain: Node `24.20.0`, pnpm `11.20.0`, Java `21`. In every Git Bash shell first run `export PATH="$HOME/.gc-node24:$PATH"`. Gradle is `./gradlew.bat` from the repository root `C:/Users/Jason/Documents/genome-companion-korea-ux`. Core PostgreSQL tests: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'` then `./gradlew.bat :apps:core-api:test --no-daemon` (Task 24 declares `GC_TEST_POSTGRES_URL` and `GC_TEST_QUARANTINE_ROOT` as Gradle test inputs, so `cleanTest` is no longer required: changing either variable re-runs the task). Other JVM modules: `./gradlew.bat :apps:document-worker:test :packages:document-boundary:test :packages:korean-checkup-benchmark:test --no-daemon`. Web: `pnpm web:test`, `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`, `pnpm medical-ai:native-text-gate`. Browser: additionally `export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'`, then `pnpm foundation:e2e`. After any workflow change: `pnpm security:github-actions-policy` (every `uses:` pinned to a 40-hex SHA with a `# vN` annotation).
- Branch: `codex/wave13-backend-hardening` (HEAD `4c4208c`, stacked on `codex/wave11-alive-home`). Never push to `main`. Never stage `apps/web/next-env.d.ts` (restore it with `git checkout -- apps/web/next-env.d.ts` after `next build`/`next dev`). Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Two PRs.** Tasks 1–13 are PR 7a (spec §2, §3, §4, §9); Tasks 14–26 are PR 7b (spec §5, §6, §7, §8). The PR boundary marker sits before Task 14. 7b is stacked on 7a. Every command named in a task must be green at that task's commit unless the task names a by-design red state.
- Founder decision 1 (value contract): `CandidateConfirmationRequest.value` and `RecordCorrectionRequest.value` accept exactly the worker grammar `^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$` with `@Size(min = 1, max = 64)` — negatives, thousands commas, unlimited decimals, at most 64 characters — and the value is stored verbatim (commas kept). All arithmetic keeps using `ChangeDeltaCalculator.parse` (commas removed). Integration cases verbatim from the spec: `250,000 /µL` confirmed, `-2 mmol/L` confirmed, `1.234 µIU/mL` corrected, a 65-character value → 400 `request_invalid`.
- Founder decision 2 (revocation): revoking `DOCUMENT_EXTRACTION` moves every document of that consent in `REVIEW_REQUIRED`, `UPLOAD_PENDING`, `UNTRUSTED_OBJECT`, `SECURITY_INSPECTION`, `SECURITY_APPROVED`, `EXTRACTION_QUEUED`, `EXTRACTION_RUNNING` or `FAILED_RETRYABLE` to the new terminal status `TERMINATED_BY_REVOCATION` (visible to the person; web copy `동의를 철회해서 결과지 처리를 종료했어요. 다시 동의한 뒤 새로 올려 주세요.`), dead-letters its jobs with `failure_code = 'consent_revoked'`, and deletes its quarantine files (untrusted, approved, preview) after commit. Re-consent requires a new upload. `COMPLETED` documents and confirmed records stay until deletion (unchanged).
- Founder decision 3 (fixtures): layout-faithful synthetic fixtures are generated **in code** under `packages/korean-checkup-benchmark` (never a committed PDF), carry `%GC-SYNTHETIC-ONLY`, use no real names, institutions, addresses or phone numbers (addresses end with `합성 주소`, institutions start with `예시`), unremarkable values, and their expectations are typed by hand in `expected.json` files that no code path generates (`gc-synthetic-fixture` rules 1–6).
- Jackson stays global `default-property-inclusion: non_null` and `fail-on-unknown-properties: true`; only `ExportedHealthEvent.referenceRangeText` keeps `@JsonInclude(ALWAYS)`. Every new response key is `.optional()` inside a `.strict()` zod object; every new request field returns 400 when unknown.
- Flyway is forward-only: new files only (`V13__wave7_idempotency_status_audit.sql` in Task 7; no other migration in this wave), never edit V1–V12. Each migration must be safe on a populated database (nullable columns, defaults, `UPDATE`s keyed by primary key). Task 24 adds a CI job that applies V1..V12, seeds representative rows (a subject, a consent, a document, two candidates, one record with two versions, one idempotency row, one audit row) and then applies V13.
- **Flyway checksum:** `gc_test` is persistent. Finish V13 before the first core test run of Task 7. If V13 must change after it was applied locally: `DELETE FROM flyway_schema_history WHERE version = '13'; ALTER TABLE gc_idempotency DROP COLUMN request_sha256, DROP COLUMN expires_at; ALTER TABLE gc_document DROP CONSTRAINT gc_document_status; ALTER TABLE gc_document ADD CONSTRAINT gc_document_status CHECK (status IN ('UPLOAD_PENDING','UNTRUSTED_OBJECT','SECURITY_INSPECTION','SECURITY_REJECTED','SECURITY_APPROVED','EXTRACTION_QUEUED','EXTRACTION_RUNNING','REVIEW_REQUIRED','COMPLETED','DELETION_PENDING','DELETED','FAILED_RETRYABLE','FAILED_TERMINAL')); DROP TRIGGER IF EXISTS gc_audit_event_append_only ON gc_audit_event; DROP FUNCTION IF EXISTS reject_gc_audit_event_mutation();` (synthetic test data only).
- Benchmark gate stays `fieldF1 = 1`, `referenceRangeAccuracy = 1`, `conceptAccuracy = 1` on the current corpus `corpusId synthetic-ko-checkup-r2-50ed23041bb4af1d`. This wave does not change `CheckupCorpusGenerator`, so the id must not change; if a task's gate output shows a different id, stop and find the accidental generator change. The hand-labelled fixtures form a **separate** corpus (`synthetic-ko-hand-labelled-<16 hex>`) scored by the new `handLabelledAccuracy` metric; its first measured value is recorded in `docs/status/2026-09-18/wave7.md` and pinned as the regression floor in `apps/web/lib/medical-ai/evaluation.ts` (never pretend 100 %).
- Abstention reasons are a closed set of exactly seven codes: `unreadable`, `ambiguous_value`, `ambiguous_unit`, `missing_evidence`, `qualified_value`, `qualitative`, `previous_column`. Every place that lists them must list all seven: worker `AbstentionReason`, core `ExtractionAbstention.reason` pattern, web `extractionAbstentionSchema`, web `abstentionReasonLabels`, `apps/web/lib/medical-ai/contracts.ts`, `apps/web/tests/fixtures/foundation.ts`. Korean sentences (exact): `qualified_value` → `부등호가 붙은 값이라 숫자로 확정하지 않음`, `qualitative` → `음성·양성 같은 판정 결과라 값으로 저장하지 않음`, `previous_column` → `이전 결과 칸의 값이라 이번 결과지 값으로 쓰지 않음`.
- Blood pressure: `120/80 mmHg` on a row labelled `혈압` becomes two candidates with labels `혈압(수축기)` and `혈압(이완기)` (both resolve in the catalogue to `systolic-blood-pressure` / `diastolic-blood-pressure` once Task 2 adds these two aliases) and `originalLabel` stays the printed `혈압` on both.
- Concurrency tests are real: two threads on one candidate/record against the embedded PostgreSQL through `FoundationLifecycleService`, `CountDownLatch`-started, never mocked (pattern: `concurrentDuplicateWorkerCompletionCreatesExactlyOneResult`).
- Security values (spec §5, verbatim): JSON body cap 256 KB (`262_144` bytes) on `/api/foundation/**`; worker result payload 2 MB plus the preview's own cap (whole-body cap on `/internal/document-boundary/**` = `2_097_152 + 2_796_204 = 4_893_356` bytes; the preview keeps `@Size(max = 2_796_204)`); upload PUT is streamed to disk, never buffered, 10 MB (`10_485_760`). `POST /session`: token bucket per subject and per client IP of 10 per minute, lock for 15 minutes after 5 failures; an unknown subject writes no audit row and no subject hash. Demo capacity counts **active** subjects (`deleted_at IS NULL`). Test-profile values that the integration test and `pnpm foundation:e2e` never trip: `gc.foundation.session-rate-limit-per-minute=10000`, `gc.foundation.worker-rate-limit-per-minute=100000`; the 5-failure lock is exercised by a dedicated test with a fresh subject and cleared in `@BeforeEach`.
- Cookies: `SameSite=Strict`, `HttpOnly` (session), `Secure` only when `gc.foundation.secure-cookies=true`, which `application-hosted.yml` sets; the test registry and `playwright.foundation.config.ts` keep `false` so `http://127.0.0.1` works. CSRF on every state-changing request = exact `Origin` + `X-GC-CSRF` (unchanged) + new `X-Requested-With: GC-Foundation`; the web client sends the new header in the same task (Task 16) so the e2e stays green.
- `server.forward-headers-strategy` is `none` in `application.yml`; `application-hosted.yml` sets `framework` with `server.tomcat.remoteip.trusted-proxies`. Actuator exposure is `health` only; `/actuator/health/**` stays inside the foundation security matcher.
- Time: every instant is UTC ISO-8601 (`Instant`), `observedOn` is a date string, export filenames use `exportedAt` converted to `Asia/Seoul` — the same `Instant` object, asserted by test.
- Caps (spec §6): 200 documents and 5,000 records per subject; `/records` and `/health-events` gain cursor pagination `?after=<eventId>` with page size 200 and response header `X-GC-Next-After`; export returns `413 payload_cap_exceeded` above the cap. Janitor (spec §7): expired sessions, upload capabilities, idempotency keys (24 h), orphan quarantine files, `QUEUED` jobs older than 24 h → `FAILED_TERMINAL` with `failure_code = 'stale'` and the document `FAILED_TERMINAL` with `failure_code = 'stale'`.
- Logging: only `PhiSafeLogger` lines (`event=… correlation_id=… route_template=… status_class=… latency_ms=…`) plus request id and subject hash; never a value, label, filename, date or reason text. A log-capture test runs a full lifecycle and asserts none of `188`, `5.2`, `42`, `Cholesterol`, `HbA1c`, `Vitamin D`, `2026-07-28`, `.pdf`, `.png` appears.
- Readiness: `release/readiness.json` verdict stays `NO_GO`; only the `external_audit_anchor` evidence sentence changes (Task 26) and `evaluatedAt` moves to the review date; `pnpm release:readiness:validate` must exit 0. GHCR anonymous-pull stop-ship is founder-gated and unchanged.
- Gates before finishing each PR: `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `pnpm web:test`, `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`, `pnpm --dir apps/web build`, `pnpm auth-security:gate`, `pnpm security:github-actions-policy`, `./gradlew.bat test --no-daemon` with `GC_TEST_POSTGRES_URL`, `pnpm medical-ai:native-text-gate`, `pnpm foundation:e2e`.

### Decisions this plan makes where the spec is silent

1. `gc_idempotency.resource_id` already exists (V1); V13 adds only `request_sha256 CHAR(64)` and `expires_at TIMESTAMPTZ`. `request_sha256` is SHA-256 over the canonical string `"<operation>|<resource path id>|<request body or empty>"` computed in the service.
2. A `POST /session` that fails validation (`400`) does not count as a failure; only `403 local_identity_denied` counts toward the 5-failure lock. The lock and bucket keys are `sha256(pepper:subjectId)` and the client IP from `HttpServletRequest.remoteAddr` (no `X-Forwarded-For` unless the hosted profile enables `framework` forwarding).
3. The worker id is proven with `X-GC-Worker-Id-Mac = HMAC-SHA256(key = sha256(rawCredential) as UTF-8 hex, message = workerId)` — both sides can compute `sha256(rawCredential)` and core never learns the raw credential.
4. A render OOM cannot become an abstention row because `ExtractionResultRequest` requires a real preview; the worker posts `failure(code = "render_error", retryable = false)` instead, the document becomes `FAILED_TERMINAL` with `failure_code = render_error`, and the web shows `미리보기를 만들다 메모리 한도를 넘어 처리를 중단했어요.` — the person sees the reason, which is the spec's intent.
5. Pagination cursor: `after` is the `eventId` (record version UUID) of the last item of the previous page; items are ordered by `observedOn, confirmedAt, recordId` (Task 10's order); the header `X-GC-Next-After` carries the last item's `eventId` when a further page exists and is absent otherwise. The web client keeps reading page one only (no UI change in this wave; the fixtures never exceed 200).
6. The migration-replay job seeds rows with plain SQL in the workflow (no Kotlin), so it cannot depend on code that V13 changes.
7. `reviewDecision` is `CORRECTED` when `supersedesVersionId != null` **or** `currentValue != originalValue` **or** `originalObservedOn != null`; HealthEvent `corrected` uses the same rule.
8. The hand-labelled corpus lives in `packages/korean-checkup-benchmark/fixtures/hand-labelled/<documentId>/expected.json` (hand-typed) and `HandLabelledFixtures.kt` (draws the PDF bytes); `BenchmarkMain` gains `generate-hand-labelled --out <dir> --font <ttf>` and the gate script scores it with `evaluateHandLabelled`.
9. Log capture uses Logback's `ListAppender` attached to the root logger for the duration of one integration test; the worker logs through `java.util.logging`-free `WorkerLog.emit(event, jobId)` writing `event=<code> job_id=<uuid>` to stdout, tested by capturing `System.out`.

---

## File map

| Path | Responsibility |
|---|---|
| `apps/document-worker/.../NativeTextExtractionProvider.kt` (+ new `PositionalLineGrouper.kt`, `RowGrammar.kt`) and `NativeTextExtractionProviderTest.kt`, new `RowGrammarTest.kt`, `PositionalLineGrouperTest.kt` | seven abstention reasons, no silent drop, value-before-label, attached units, qualified/qualitative rows, blood pressure split, continued labels, x-gap columns, previous column, date rules |
| `packages/document-boundary/.../MedicalConceptCatalogue.kt` + test | aliases `혈압(수축기)`, `혈압(이완기)` |
| `apps/core-api/.../foundation/DocumentWorkerBoundary.kt`, `FoundationLifecycleController.kt`, `FoundationLifecycleService.kt`, `FoundationRepository.kt` | reason pattern, value pattern, idempotency hash/expiry, `FOR UPDATE`, 409/422 codes, revocation termination, deletion order, same-day rule, ordering, `CORRECTED` rule |
| `apps/core-api/src/main/resources/db/migration/V13__wave7_idempotency_status_audit.sql` | `request_sha256`, `expires_at`, `TERMINATED_BY_REVOCATION`, `gc_audit_event` append-only trigger |
| `apps/core-api/.../foundation/FoundationProblemAdvice.kt` (new) | framework exceptions → `problem+json`, `Cache-Control: no-store`, no body echo |
| `apps/web/lib/foundation/client.ts`, `lib/format/status-labels.ts`, `components/integrated/IntegratedHealthExperience.tsx`, `tests/fixtures/foundation.ts`, `tests/abstention-copy.test.ts`, `lib/medical-ai/{contracts,evaluation,native-text-report}.ts`, `scripts/native-text-gate.mts` | reasons, statuses, copy, timeout, `X-Requested-With`, `handLabelledAccuracy` |
| `packages/korean-checkup-benchmark/fixtures/hand-labelled/**/expected.json`, `.../benchmark/HandLabelledFixtures.kt`, `HandLabelledRunner.kt`, `BenchmarkMain.kt` + tests | §9 |
| 7b: `apps/core-api/.../foundation/{RequestBodyLimitFilter,SessionRateLimiter,FoundationJanitor,FoundationLogging}.kt`, `FoundationSecurity.kt`, `FoundationProperties.kt`, `application.yml`, new `application-hosted.yml`, `docs/api/foundation-openapi.yaml`, `FoundationOpenApiContractTest.kt` | §5–§7 |
| 7b: `packages/document-boundary/.../PdfSecurityInspector.kt`, `apps/document-worker/.../{DocumentWorkerMain,PageRenderSubprocess,WorkerHealth,WorkerLog}.kt`, `apps/document-worker/Dockerfile`, `.github/workflows/ci.yml`, `apps/core-api/build.gradle.kts` | PDF hardening, health, loop, freshclam, CI jobs |
| 7b: `release/readiness.json`, `docs/release/readiness.md`, `docs/status/2026-09-18/wave7.md`, `AGENTS.md`, `PROJECT_GUIDE.md` | §8 |

---

### Task 1: Worker — seven abstention reasons and no silent drop on a labelled numeric row

**Files:**
- Modify: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt`
- Test: `apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProviderTest.kt`

**Interfaces:**
- Consumes: existing `NativeTextExtractionProvider.parseRow(raw: String): RowParse?`, `RowParse.Measurement`, `RowParse.Ambiguous`.
- Produces: `enum class AbstentionReason { UNREADABLE, AMBIGUOUS_VALUE, AMBIGUOUS_UNIT, MISSING_EVIDENCE, QUALIFIED_VALUE, QUALITATIVE, PREVIOUS_COLUMN }` with `code` strings `unreadable`, `ambiguous_value`, `ambiguous_unit`, `missing_evidence`, `qualified_value`, `qualitative`, `previous_column`; `RowParse.Skipped` (a row with no label before its first numeric token, e.g. a page number) replaces `null`; `parseRow` returns non-null `RowParse` always. `AbstentionReason.CODES: List<String>` (the seven codes in this order) for later tasks.

- [ ] **Step 1: Write the failing tests**

Append to `NativeTextExtractionProviderTest.kt` (inside the class):

```kotlin
    @Test
    fun `the abstention reason set is exactly the seven closed codes`() {
        assertThat(AbstentionReason.CODES).containsExactly(
            "unreadable", "ambiguous_value", "ambiguous_unit", "missing_evidence",
            "qualified_value", "qualitative", "previous_column",
        )
    }

    @Test
    fun `every row that shows a label and a numeric token either becomes a candidate or an abstention`() {
        val rows = listOf(
            "혈당 95 mg/dL",            // measurement
            "혈당 95",                  // no unit → ambiguous_unit
            "혈당 95 100",              // two numbers, no unit → ambiguous_value
            "혈당 95 120-199",          // bare range right after the value → ambiguous_unit, never dropped
            "혈당 95 mg/dL 100 mg/dL",  // two values → ambiguous_value
        )
        val outcome = NativeTextExtractionProvider.parse(lines(listOf("검사일: 2026-07-28") + rows))
        assertThat(outcome.candidates).hasSize(1)
        assertThat(outcome.abstentions.map { it.reason.code })
            .containsExactly("ambiguous_unit", "ambiguous_value", "ambiguous_unit", "ambiguous_value")
    }

    @Test
    fun `a row whose first numeric token has no label before it is skipped, not abstained`() {
        assertThat(NativeTextExtractionProvider.parseRow("3")).isEqualTo(NativeTextExtractionProvider.RowParse.Skipped)
        assertThat(NativeTextExtractionProvider.parseRow("- 2 -")).isEqualTo(NativeTextExtractionProvider.RowParse.Skipped)
        assertThat(NativeTextExtractionProvider.parseRow("예시 검진센터")).isEqualTo(NativeTextExtractionProvider.RowParse.Skipped)
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./gradlew.bat :apps:document-worker:test --tests '*NativeTextExtractionProviderTest*' --no-daemon`
Expected: compilation FAILS — `Unresolved reference: CODES`, `Unresolved reference: Skipped`.

- [ ] **Step 3: Implement**

In `NativeTextExtractionProvider.kt` replace the enum and the `RowParse` hierarchy and the two `return null` sites:

```kotlin
enum class AbstentionReason(val code: String) {
    UNREADABLE("unreadable"),
    AMBIGUOUS_VALUE("ambiguous_value"),
    AMBIGUOUS_UNIT("ambiguous_unit"),
    MISSING_EVIDENCE("missing_evidence"),
    /** `<0.3`, `≤5.6`, `>60`: the printed number carries a comparison sign, so it is not stored as a value. */
    QUALIFIED_VALUE("qualified_value"),
    /** `음성`, `양성`, `정상`, `이상`: a printed judgement word, never a value; nothing is stored. */
    QUALITATIVE("qualitative"),
    /** A value that sits in a previous-result column (`이전`, `전회`, an earlier year header). */
    PREVIOUS_COLUMN("previous_column");

    companion object {
        val CODES: List<String> = entries.map { it.code }
    }
}
```

```kotlin
    internal sealed interface RowParse {
        data class Measurement(val label: String, val value: String, val unit: String, val referenceRangeText: String?) : RowParse
        data class Ambiguous(val label: String, val reason: AbstentionReason) : RowParse
        /** No label precedes the first numeric token (page numbers, headers): not a measurement row at all. */
        data object Skipped : RowParse
    }

    internal fun parseRow(raw: String): RowParse {
        val text = raw.replace(separators, " ").trim().replace(leadingBullets, "").trim()
        val tokens = text.split(Regex("\\s+")).filter { it.isNotEmpty() }
        val valueIndex = tokens.indexOfFirst { valueToken.matches(it) }
        if (valueIndex < 1) return RowParse.Skipped
        val label = tokens.subList(0, valueIndex).joinToString(" ")
        val value = tokens[valueIndex]
        val unitToken = tokens.getOrNull(valueIndex + 1)
        val unit = when {
            unitToken == null -> return RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_UNIT)
            MedicalUnitSpelling.canonical(unitToken) != null -> unitToken
            valueToken.matches(unitToken) -> return RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE)
            // A bare range right after the value ("120-199") with no unit word: the row showed a label
            // and a number, so it is reported as ambiguous_unit instead of being dropped silently.
            else -> return RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_UNIT)
        }
        // ... rest of the function unchanged ...
```

In `parse`, replace `null -> continue` with `RowParse.Skipped -> continue`.

- [ ] **Step 4: Run the worker and benchmark tests**

Run: `./gradlew.bat :apps:document-worker:test :packages:korean-checkup-benchmark:test --no-daemon`
Expected: `BUILD SUCCESSFUL`. If `CheckupCorpusGeneratorTest` fails because a generated row that previously vanished now abstains, the corpus row was wrong before — inspect it; the gate in Step 5 is the authority.

- [ ] **Step 5: Run the benchmark gate**

Run: `export PATH="$HOME/.gc-node24:$PATH"; pnpm medical-ai:native-text-gate`
Expected: `"corpusId": "synthetic-ko-checkup-r2-50ed23041bb4af1d"`, `"fieldF1": 1`, `"referenceRangeAccuracy": 1`, `"conceptAccuracy": 1`, `"gate": { "passed": true, "failures": [] }`.

- [ ] **Step 6: Commit**

```bash
git add apps/document-worker
git commit -m "feat(worker): closed set of seven abstention reasons; no labelled numeric row is dropped silently

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 2: Worker row grammar — value-before-label, attached units, qualified values, qualitative results, blood pressure split

**Files:**
- Create: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/RowGrammar.kt`
- Modify: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt`
- Modify: `packages/document-boundary/src/main/kotlin/kr/co/genomecompanion/documentboundary/MedicalConceptCatalogue.kt` (two aliases)
- Test: `apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/RowGrammarTest.kt` (create), `NativeTextExtractionProviderTest.kt`, `packages/document-boundary/src/test/kotlin/kr/co/genomecompanion/documentboundary/MedicalConceptCatalogueTest.kt`

**Interfaces:**
- Consumes: `AbstentionReason`, `RowParse` (Task 1), `MedicalUnitSpelling.canonical(unit): String?`.
- Produces: `object RowGrammar { val valueToken: Regex; fun tokenize(text: String): List<String>; fun parse(raw: String): List<RowParse> }` — one printed row may yield **several** `RowParse` values (blood pressure yields two `Measurement`s). `NativeTextExtractionProvider.parseRow(raw): RowParse` stays for single-result rows and `parseRowAll(raw): List<RowParse>` is what `parse()` iterates. Catalogue: `systolic-blood-pressure` gains alias `혈압(수축기)`, `diastolic-blood-pressure` gains `혈압(이완기)`.

Known red state after this task: core's PostgreSQL test `medicalConceptSeedMatchesTheSharedCatalogue` (the seed lacks the two aliases) until Task 7's V13 adds them. Do not run core tests as this task's gate.

- [ ] **Step 1: Write the failing tests**

Create `RowGrammarTest.kt`:

```kotlin
package kr.co.genomecompanion.documentworker

import kr.co.genomecompanion.documentworker.NativeTextExtractionProvider.RowParse
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test


class RowGrammarTest {
    @Test
    fun `splits a unit glued to its number`() {
        assertThat(RowGrammar.tokenize("HbA1c 5.6%")).containsExactly("HbA1c", "5.6", "%")
        assertThat(RowGrammar.tokenize("혈당 188mg/dL")).containsExactly("혈당", "188", "mg/dL")
        assertThat(RowGrammar.tokenize("백혈구 6,200/µL")).containsExactly("백혈구", "6,200", "/µL")
        assertThat(RowGrammar.tokenize("120-199")).containsExactly("120-199")
        assertThat(RowGrammar.tokenize("2026년")).containsExactly("2026년")
    }

    @Test
    fun `reads a value printed before its label`() {
        assertThat(RowGrammar.parse("120 mg/dL 혈당"))
            .containsExactly(RowParse.Measurement("혈당", "120", "mg/dL", null))
        assertThat(RowGrammar.parse("5.4 % 당화혈색소 (4.0-6.0)"))
            .containsExactly(RowParse.Measurement("당화혈색소", "5.4", "%", "4.0-6.0"))
    }

    @Test
    fun `abstains qualified_value for a comparison-signed number and keeps the printed text in the label`() {
        assertThat(RowGrammar.parse("hs-CRP <0.3 mg/L"))
            .containsExactly(RowParse.Ambiguous("hs-CRP (<0.3 mg/L)", AbstentionReason.QUALIFIED_VALUE))
        assertThat(RowGrammar.parse("eGFR ≥60 mL/min/1.73m²"))
            .containsExactly(RowParse.Ambiguous("eGFR (≥60 mL/min/1.73m²)", AbstentionReason.QUALIFIED_VALUE))
        assertThat(RowGrammar.parse("CRP < 0.5 mg/dL"))
            .containsExactly(RowParse.Ambiguous("CRP (< 0.5 mg/dL)", AbstentionReason.QUALIFIED_VALUE))
    }

    @Test
    fun `abstains qualitative for a judgement word and stores no value`() {
        for (word in listOf("음성", "양성", "정상", "이상")) {
            assertThat(RowGrammar.parse("요단백 $word")).containsExactly(RowParse.Ambiguous("요단백", AbstentionReason.QUALITATIVE))
        }
        assertThat(RowGrammar.parse("B형간염 표면항원 음성 (음성)"))
            .containsExactly(RowParse.Ambiguous("B형간염 표면항원", AbstentionReason.QUALITATIVE))
    }

    @Test
    fun `splits blood pressure into a systolic and a diastolic candidate`() {
        assertThat(RowGrammar.parse("혈압 120/80 mmHg")).containsExactly(
            RowParse.Measurement("혈압(수축기)", "120", "mmHg", null),
            RowParse.Measurement("혈압(이완기)", "80", "mmHg", null),
        )
        assertThat(RowGrammar.parse("Blood Pressure 118/76 mmHg 90-120/60-80")).containsExactly(
            RowParse.Measurement("Blood Pressure(수축기)", "118", "mmHg", "90-120"),
            RowParse.Measurement("Blood Pressure(이완기)", "76", "mmHg", "60-80"),
        )
        assertThat(RowGrammar.parse("비율 3/4 %")).containsExactly(RowParse.Ambiguous("비율", AbstentionReason.AMBIGUOUS_VALUE))
    }

    @Test
    fun `plain rows still parse exactly as before`() {
        assertThat(RowGrammar.parse("Cholesterol: 188 mg/dL 120-199"))
            .containsExactly(RowParse.Measurement("Cholesterol", "188", "mg/dL", "120-199"))
        assertThat(RowGrammar.parse("· 혈색소 14.1 g/dL (참고 12.0-16.0)"))
            .containsExactly(RowParse.Measurement("혈색소", "14.1", "g/dL", "12.0-16.0"))
        assertThat(RowGrammar.parse("페이지 2")).containsExactly(RowParse.Skipped)
    }
}
```

In `MedicalConceptCatalogueTest.kt` add:

```kotlin
    @Test
    fun `the blood-pressure split labels resolve to the two pressure concepts`() {
        assertThat(MedicalConceptCatalogue.resolve("혈압(수축기)", "mmHg")?.conceptCode).isEqualTo("systolic-blood-pressure")
        assertThat(MedicalConceptCatalogue.resolve("혈압(이완기)", "mmHg")?.conceptCode).isEqualTo("diastolic-blood-pressure")
        assertThat(MedicalConceptCatalogue.find("혈압")).isNull()
    }
```

Add to `NativeTextExtractionProviderTest.kt`:

```kotlin
    @Test
    fun `a blood pressure row yields two ordered candidates that keep one hash and one box`() {
        val outcome = NativeTextExtractionProvider.parse(lines("검사일: 2026-07-28", "혈압 120/80 mmHg", "맥박 64 회/분"))
        assertThat(outcome.candidates.map { Triple(it.ordinal, it.label, it.value) }).containsExactly(
            Triple(1, "혈압(수축기)", "120"), Triple(2, "혈압(이완기)", "80"), Triple(3, "맥박", "64"),
        )
        assertThat(outcome.candidates[0].sourceTextSha256).isEqualTo(outcome.candidates[1].sourceTextSha256)
        assertThat(outcome.candidates[0].evidenceBox).isEqualTo(outcome.candidates[1].evidenceBox)
        assertThat(outcome.abstentions).isEmpty()
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./gradlew.bat :apps:document-worker:test --tests '*RowGrammarTest*' --no-daemon`
Expected: compilation FAILS — `Unresolved reference: RowGrammar`.

- [ ] **Step 3: Implement `RowGrammar.kt`**

```kotlin
package kr.co.genomecompanion.documentworker

import kr.co.genomecompanion.documentboundary.MedicalUnitSpelling
import kr.co.genomecompanion.documentworker.NativeTextExtractionProvider.RowParse

/**
 * Row grammar of the text-layer parser: zero or more [RowParse] per printed row. Every row that
 * shows a label and a numeric-looking token yields a Measurement or an Ambiguous with a reason;
 * only rows with no label before the first number are Skipped. Labels stay raw (core normalizes).
 * Nothing here interprets a value.
 */
object RowGrammar {
    private const val MAX_REFERENCE_RANGE = 40
    private const val MAX_LABEL = 80
    internal val valueToken = Regex("^-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$")
    private val qualifiedToken = Regex("^[<>≤≥]\\s*-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$")
    private val comparisonSign = Regex("^[<>≤≥]$")
    private val pressurePair = Regex("^(\\d{2,3})/(\\d{2,3})$")
    private val pressureRangePair = Regex("^(\\d{2,3}-\\d{2,3})/(\\d{2,3}-\\d{2,3})$")
    private val qualitativeWords = setOf("음성", "양성", "정상", "이상", "negative", "positive")
    private val separators = Regex("[:：\\t]")
    private val leadingBullets = Regex("^[·•\\-*]+\\s*")
    /** A number followed directly by a unit spelling: `5.6%`, `188mg/dL`, `6,200/µL`. Never `120-199`, never `2026년`. */
    private val gluedUnit = Regex("^(-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?)([%/A-Za-zµ][^\\s]*)$")
    private val rangeText = Regex(
        "^\\(?\\s*(?:참고치?|기준치?|정상\\s*범위|reference|ref\\.?)?\\s*[:：]?\\s*[<>≤≥]?\\s*" +
            "\\d[\\d,]*(?:\\.\\d+)?(?:\\s*[-–~]\\s*\\d[\\d,]*(?:\\.\\d+)?)?\\s*[^\\s()]*\\s*\\)?$",
    )
    private val rangeBody = Regex("[<>≤≥]?\\s*\\d[\\d,]*(?:\\.\\d+)?(?:\\s*[-–~]\\s*\\d[\\d,]*(?:\\.\\d+)?)?")
    private val rangeBoundaryMarker = Regex("[<>≤≥]|\\d\\s*[-–~]\\s*\\d")

    fun tokenize(text: String): List<String> =
        text.replace(separators, " ").trim().replace(leadingBullets, "").trim()
            .split(Regex("\\s+")).filter { it.isNotEmpty() }
            .flatMap { token ->
                val glued = gluedUnit.matchEntire(token)
                if (glued != null && MedicalUnitSpelling.canonical(glued.groupValues[2]) != null) {
                    listOf(glued.groupValues[1], glued.groupValues[2])
                } else {
                    listOf(token)
                }
            }

    fun parse(raw: String): List<RowParse> {
        val tokens = tokenize(raw)
        val numericIndex = tokens.indexOfFirst { isNumericLike(it) }
        if (numericIndex < 0) return qualitativeOrSkipped(tokens)
        if (numericIndex == 0) return valueFirst(tokens)
        val label = tokens.subList(0, numericIndex).joinToString(" ")
        val value = tokens[numericIndex]
        val unitToken = tokens.getOrNull(numericIndex + 1)
        val signed = qualifiedToken.matches(value) ||
            (comparisonSign.matches(value) && unitToken != null && valueToken.matches(unitToken))
        if (signed) {
            val printed = tokens.drop(numericIndex).joinToString(" ")
            return listOf(RowParse.Ambiguous("$label ($printed)".take(MAX_LABEL), AbstentionReason.QUALIFIED_VALUE))
        }
        pressurePair.matchEntire(value)?.let { pair ->
            if (unitToken != null && MedicalUnitSpelling.canonical(unitToken) == "mmHg") {
                val ranges = tokens.drop(numericIndex + 2).singleOrNull()?.let { pressureRangePair.matchEntire(it) }
                return listOf(
                    RowParse.Measurement("$label(수축기)", pair.groupValues[1], unitToken, ranges?.groupValues?.get(1)),
                    RowParse.Measurement("$label(이완기)", pair.groupValues[2], unitToken, ranges?.groupValues?.get(2)),
                )
            }
            return listOf(RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE))
        }
        if (!valueToken.matches(value)) return listOf(RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE))
        val unit = when {
            unitToken == null -> return listOf(RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_UNIT))
            MedicalUnitSpelling.canonical(unitToken) != null -> unitToken
            valueToken.matches(unitToken) -> return listOf(RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE))
            else -> return listOf(RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_UNIT))
        }
        return listOf(finish(label, value, unit, tokens.drop(numericIndex + 2)))
    }

    /** `120 mg/dL 혈당`: number, unit, then the label up to the next range or number. */
    private fun valueFirst(tokens: List<String>): List<RowParse> {
        val value = tokens[0]
        if (!valueToken.matches(value)) return listOf(RowParse.Skipped)
        val unit = tokens.getOrNull(1)?.takeIf { MedicalUnitSpelling.canonical(it) != null } ?: return listOf(RowParse.Skipped)
        val rest = tokens.drop(2)
        val labelEnd = rest.indexOfFirst { rangeText.matches(it) || isNumericLike(it) }.let { if (it < 0) rest.size else it }
        val label = rest.take(labelEnd).joinToString(" ")
        if (label.isEmpty()) return listOf(RowParse.Skipped)
        return listOf(finish(label, value, unit, rest.drop(labelEnd)))
    }

    private fun isNumericLike(token: String): Boolean =
        valueToken.matches(token) || qualifiedToken.matches(token) || pressurePair.matches(token) || comparisonSign.matches(token)

    private fun qualitativeOrSkipped(tokens: List<String>): List<RowParse> {
        val index = tokens.indexOfFirst { it.trim('(', ')') in qualitativeWords }
        if (index < 1) return listOf(RowParse.Skipped)
        return listOf(RowParse.Ambiguous(tokens.subList(0, index).joinToString(" ").take(MAX_LABEL), AbstentionReason.QUALITATIVE))
    }

    /** Tail rule (unchanged from Wave 3): leftovers are one/two range bodies or a second value (ambiguous). */
    private fun finish(label: String, value: String, unit: String, rest: List<String>): RowParse {
        val restText = rest.joinToString(" ")
        val restIsRange = rest.isNotEmpty() && rangeText.matches(restText)
        if (rest.isNotEmpty() && !restIsRange && rest.any { valueToken.matches(it) }) {
            return RowParse.Ambiguous(label, AbstentionReason.AMBIGUOUS_VALUE)
        }
        val bodies = if (restIsRange) rangeBody.findAll(restText).map { it.value.trim() }.toList() else emptyList()
        val twoRanges = bodies.size == 2 &&
            bodies.all { rangeBoundaryMarker.containsMatchIn(it) } &&
            bodies.fold(restText) { remaining, body -> remaining.replaceFirst(body, "") }.isBlank()
        val rangeBodyMatch = if (twoRanges) bodies.joinToString(" ") else bodies.firstOrNull()
        val referenceRangeText = rangeBodyMatch?.takeIf { it.length <= MAX_REFERENCE_RANGE && rangeBoundaryMarker.containsMatchIn(it) }
        return RowParse.Measurement(label, value, unit, referenceRangeText)
    }
}
```

In `NativeTextExtractionProvider.kt`: delete the private regexes now owned by `RowGrammar` (`valueToken`, `rangeText`, `rangeBody`, `rangeBoundaryMarker`, `separators`, `leadingBullets`) and the body of `parseRow`; write

```kotlin
    internal fun parseRow(raw: String): RowParse = parseRowAll(raw).single()
    internal fun parseRowAll(raw: String): List<RowParse> = RowGrammar.parse(raw)
```

and in `parse` iterate `for (row in parseRowAll(line.text))` with the same `when` body. `sourceTextSha256 = sha256(line.text.trim())` and `evidenceBox = line.box` are per line, so both pressure candidates share them.

In `MedicalConceptCatalogue.kt` append `"혈압(수축기)"` to the alias list of `systolic-blood-pressure` and `"혈압(이완기)"` to `diastolic-blood-pressure`.

- [ ] **Step 4: Run the tests and the gate**

Run: `./gradlew.bat :apps:document-worker:test :packages:document-boundary:test :packages:korean-checkup-benchmark:test --no-daemon`
Expected: `BUILD SUCCESSFUL`. Then `pnpm medical-ai:native-text-gate` → `"corpusId": "synthetic-ko-checkup-r2-50ed23041bb4af1d"`, `passed: true`.

- [ ] **Step 5: Commit**

```bash
git add apps/document-worker packages/document-boundary
git commit -m "feat(worker): row grammar with value-before-label, glued units, qualified and qualitative rows, blood-pressure split

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 3: Worker — positional column grouping, continued labels, previous-result column

**Files:**
- Create: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/PositionalLineGrouper.kt`
- Modify: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt`
- Test: `apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/PositionalLineGrouperTest.kt` (create), `NativeTextExtractionProviderTest.kt`

**Interfaces:**
- Consumes: PDFBox `TextPosition`, `TextLine`, `TextBox`, `RowGrammar` (Task 2).
- Produces: `data class PositionedToken(val page: Int, val text: String, val x: Double, val y: Double, val width: Double, val height: Double)`; `object PositionalLineGrouper { fun group(tokens: List<PositionedToken>, xGap: Double = 0.06, yTolerance: Double = 0.004): List<TextLine> }`; `TextLine` gains `val columnIndex: Int = 0` and `val previousColumn: Boolean = false`; `NativeTextExtractionProvider.mergeContinuedLabels(lines): List<TextLine>` (internal).

- [ ] **Step 1: Write the failing tests**

Create `PositionalLineGrouperTest.kt`:

```kotlin
package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test


class PositionalLineGrouperTest {
    private fun token(text: String, x: Double, y: Double, page: Int = 1) = PositionedToken(page, text, x, y, 0.02 * text.length, 0.012)

    @Test
    fun `tokens on one baseline separated by a wide x gap become two lines with column indexes`() {
        val lines = PositionalLineGrouper.group(
            listOf(
                token("혈당", 0.05, 0.20), token("95", 0.15, 0.20), token("mg/dL", 0.19, 0.20),
                token("총콜레스테롤", 0.55, 0.20), token("188", 0.70, 0.20), token("mg/dL", 0.74, 0.20),
            ),
        )
        assertThat(lines.map { it.text to it.columnIndex }).containsExactly("혈당 95 mg/dL" to 0, "총콜레스테롤 188 mg/dL" to 1)
    }

    @Test
    fun `tokens closer than the gap stay one line and a small baseline drift is tolerated`() {
        val lines = PositionalLineGrouper.group(listOf(token("HbA1c", 0.05, 0.300), token("5.4", 0.12, 0.302), token("%", 0.16, 0.301)))
        assertThat(lines.map { it.text }).containsExactly("HbA1c 5.4 %")
        assertThat(lines.single().box.x).isEqualTo(0.05)
    }

    @Test
    fun `a column whose header says 이전 or 전회 or an earlier year marks its later lines as previous`() {
        val lines = PositionalLineGrouper.group(
            listOf(
                token("항목", 0.05, 0.10), token("이번", 0.30, 0.10), token("이전", 0.55, 0.10),
                token("혈당", 0.05, 0.14), token("95", 0.30, 0.14), token("mg/dL", 0.34, 0.14), token("101", 0.55, 0.14), token("mg/dL", 0.59, 0.14),
            ),
        )
        assertThat(lines.map { Triple(it.text, it.columnIndex, it.previousColumn) }).containsExactly(
            Triple("항목", 0, false), Triple("이번", 1, false), Triple("이전", 2, false),
            Triple("혈당", 0, false), Triple("95 mg/dL", 1, false), Triple("101 mg/dL", 2, true),
        )
        val years = PositionalLineGrouper.group(listOf(token("항목", 0.05, 0.10), token("2026", 0.30, 0.10), token("2025", 0.55, 0.10), token("혈당", 0.05, 0.14), token("95 mg/dL", 0.30, 0.14), token("101 mg/dL", 0.55, 0.14)))
        assertThat(years.last().previousColumn).isTrue()
        assertThat(years[4].previousColumn).isFalse()
    }
}
```

Add to `NativeTextExtractionProviderTest.kt`:

```kotlin
    @Test
    fun `a label on its own line continues onto the next line of the same column`() {
        val outcome = NativeTextExtractionProvider.parse(
            listOf(
                positioned("검사일: 2026-07-28", y = 0.05),
                positioned("저밀도", y = 0.20),
                positioned("콜레스테롤 110 mg/dL", y = 0.22),
                positioned("HbA1c 5.4 %", y = 0.24),
            ),
        )
        assertThat(outcome.candidates.map { it.label to it.value }).containsExactly("저밀도 콜레스테롤" to "110", "HbA1c" to "5.4")
        assertThat(outcome.candidates[0].sourceTextSha256).isEqualTo(sha256Of("저밀도 콜레스테롤 110 mg/dL"))
        assertThat(outcome.candidates[0].evidenceBox.y).isEqualTo(0.20)
    }

    @Test
    fun `a table with a previous-result column yields this-time candidates and previous_column abstentions`() {
        val outcome = NativeTextExtractionProvider.parse(
            listOf(
                positioned("검사일: 2026-07-28", y = 0.05),
                positioned("항목", y = 0.10, column = 0), positioned("이번", y = 0.10, column = 1), positioned("이전", y = 0.10, column = 2),
                positioned("혈당", y = 0.14, column = 0), positioned("95 mg/dL", y = 0.14, column = 1), positioned("101 mg/dL", y = 0.14, column = 2, previous = true),
            ),
        )
        assertThat(outcome.candidates.map { it.label to it.value }).containsExactly("혈당" to "95")
        assertThat(outcome.abstentions.map { it.label to it.reason }).containsExactly("혈당" to AbstentionReason.PREVIOUS_COLUMN)
    }

    private fun positioned(text: String, y: Double, column: Int = 0, previous: Boolean = false, page: Int = 1) =
        TextLine(page, text, TextBox(0.05 + column * 0.3, y, 0.25, 0.012), column, previous)

    private fun sha256Of(text: String) = java.util.HexFormat.of().formatHex(
        java.security.MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8)),
    )
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `./gradlew.bat :apps:document-worker:test --tests '*PositionalLineGrouperTest*' --no-daemon`
Expected: compilation FAILS — `Unresolved reference: PositionedToken`.

- [ ] **Step 3: Implement**

`PositionalLineGrouper.kt`:

```kotlin
package kr.co.genomecompanion.documentworker

import kotlin.math.abs

/** One glyph run with a normalized (0..1, top-left origin) box. */
data class PositionedToken(val page: Int, val text: String, val x: Double, val y: Double, val width: Double, val height: Double)

/**
 * Groups positioned tokens into lines per page: same baseline (|Δy| ≤ yTolerance), then a new
 * column wherever the horizontal gap to the previous token exceeds xGap. The first baseline with
 * two or more columns is the header row; a header that reads `이전`/`전회`/`직전` or a four-digit
 * year earlier than the largest year header marks every later line in that column `previousColumn`.
 */
object PositionalLineGrouper {
    private val previousHeader = Regex("^(이전|전회|직전)(\\s*결과)?$")
    private val yearHeader = Regex("^(\\d{4})(년)?$")

    fun group(tokens: List<PositionedToken>, xGap: Double = 0.06, yTolerance: Double = 0.004): List<TextLine> {
        val lines = mutableListOf<TextLine>()
        tokens.groupBy { it.page }.toSortedMap().forEach { (page, pageTokens) ->
            val baselines = mutableListOf<MutableList<PositionedToken>>()
            pageTokens.sortedWith(compareBy({ it.y }, { it.x })).forEach { token ->
                val row = baselines.lastOrNull()?.takeIf { abs(it.first().y - token.y) <= yTolerance }
                if (row == null) baselines += mutableListOf(token) else row += token
            }
            val previousColumns = mutableSetOf<Int>()
            var headerSeen = false
            baselines.forEach { row ->
                val columns = mutableListOf<MutableList<PositionedToken>>()
                row.sortedBy { it.x }.forEach { token ->
                    val last = columns.lastOrNull()?.last()
                    if (last == null || token.x - (last.x + last.width) > xGap) columns += mutableListOf(token) else columns.last() += token
                }
                if (!headerSeen && columns.size >= 2) {
                    headerSeen = true
                    val texts = columns.map { column -> column.joinToString(" ") { it.text } }
                    val years = texts.mapNotNull { yearHeader.matchEntire(it)?.groupValues?.get(1)?.toInt() }
                    texts.forEachIndexed { index, text ->
                        val year = yearHeader.matchEntire(text)?.groupValues?.get(1)?.toInt()
                        if (previousHeader.matches(text) || (year != null && years.size >= 2 && year < years.max())) previousColumns += index
                    }
                    columns.forEachIndexed { index, column -> lines += toLine(page, column, index, previous = false) }
                } else {
                    columns.forEachIndexed { index, column -> lines += toLine(page, column, index, previous = index in previousColumns) }
                }
            }
        }
        return lines
    }

    private fun toLine(page: Int, column: List<PositionedToken>, index: Int, previous: Boolean): TextLine {
        val left = column.minOf { it.x }
        val right = column.maxOf { it.x + it.width }
        val top = column.minOf { it.y }
        val bottom = column.maxOf { it.y + it.height }
        return TextLine(
            page = page,
            text = column.joinToString(" ") { it.text }.trim(),
            box = TextBox(left, top, (right - left).coerceIn(0.0, 1.0 - left), (bottom - top).coerceIn(0.0, 1.0 - top)),
            columnIndex = index,
            previousColumn = previous,
        )
    }
}
```

In `NativeTextExtractionProvider.kt`:

```kotlin
data class TextLine(val page: Int, val text: String, val box: TextBox, val columnIndex: Int = 0, val previousColumn: Boolean = false)
```

Replace `LineCollectingStripper` with `TokenCollectingStripper`:

```kotlin
    private class TokenCollectingStripper : PDFTextStripper() {
        val tokens = mutableListOf<PositionedToken>()
        private var pageWidth = 1f
        private var pageHeight = 1f

        init { sortByPosition = true }

        override fun startPage(page: PDPage) {
            super.startPage(page)
            pageWidth = page.cropBox.width
            pageHeight = page.cropBox.height
        }

        /** One token per run of non-blank glyphs; PDFBox calls this once per word group it detects. */
        override fun writeString(text: String, textPositions: List<TextPosition>) {
            var run = mutableListOf<TextPosition>()
            fun flush() {
                if (run.isEmpty()) return
                val left = run.minOf { it.xDirAdj }
                val right = run.maxOf { it.xDirAdj + it.widthDirAdj }
                val top = run.minOf { it.yDirAdj - it.heightDir }
                val bottom = run.maxOf { it.yDirAdj }
                val x = (left / pageWidth).toDouble().coerceIn(0.0, 1.0)
                val y = (top / pageHeight).toDouble().coerceIn(0.0, 1.0)
                tokens += PositionedToken(
                    page = currentPageNo,
                    text = run.joinToString("") { it.unicode },
                    x = x,
                    y = y,
                    width = ((right - left) / pageWidth).toDouble().coerceIn(0.0, 1.0 - x),
                    height = ((bottom - top) / pageHeight).toDouble().coerceIn(0.0, 1.0 - y),
                )
                run = mutableListOf()
            }
            textPositions.forEach { position -> if (position.unicode.isBlank()) flush() else run += position }
            flush()
        }
    }
```

`extractLines` becomes:

```kotlin
    fun extractLines(pdf: ByteArray): List<TextLine> = Loader.loadPDF(pdf).use { document ->
        require(document.numberOfPages in 1..20) { "page count out of bounds" }
        val stripper = TokenCollectingStripper()
        stripper.getText(document)
        PositionalLineGrouper.group(stripper.tokens)
    }
```

In `parse`, first `val prepared = joinValueColumns(mergeContinuedLabels(lines))` and iterate `prepared`:

```kotlin
    /** A line with no numeric token whose next line (same page, same column, ≤ 0.03 below) is a measurement row: one row with the label prefixed. */
    internal fun mergeContinuedLabels(lines: List<TextLine>): List<TextLine> {
        val merged = mutableListOf<TextLine>()
        var index = 0
        while (index < lines.size) {
            val line = lines[index]
            val next = lines.getOrNull(index + 1)
            val labelOnly = RowGrammar.tokenize(line.text).none { RowGrammar.valueToken.matches(it) } &&
                RowGrammar.parse(line.text).singleOrNull() == RowParse.Skipped &&
                !dateLabel.containsMatchIn(line.text)
            if (labelOnly && next != null && next.page == line.page && next.columnIndex == line.columnIndex &&
                next.box.y - line.box.y in 0.0..0.03 && RowGrammar.parse(next.text).any { it is RowParse.Measurement }
            ) {
                merged += TextLine(
                    page = line.page,
                    text = line.text + " " + next.text,
                    box = TextBox(minOf(line.box.x, next.box.x), line.box.y, maxOf(line.box.width, next.box.width), next.box.y + next.box.height - line.box.y),
                    columnIndex = line.columnIndex,
                    previousColumn = next.previousColumn,
                )
                index += 2
            } else {
                merged += line
                index += 1
            }
        }
        return merged
    }

    /** A value-only column cell (`95 mg/dL`) takes the label of column 0 on the same baseline; the row box is the union of both cells. */
    internal fun joinValueColumns(lines: List<TextLine>): List<TextLine> = lines.map { line ->
        val startsNumeric = RowGrammar.tokenize(line.text).firstOrNull()?.let { RowGrammar.valueToken.matches(it) || it.matches(Regex("^[<>≤≥].*")) } == true
        if (line.columnIndex == 0 || !startsNumeric) return@map line
        val labelCell = lines.firstOrNull { it.page == line.page && it.columnIndex == 0 && kotlin.math.abs(it.box.y - line.box.y) <= 0.004 }
            ?: return@map line
        TextLine(
            page = line.page,
            text = labelCell.text + " " + line.text,
            box = TextBox(labelCell.box.x, minOf(labelCell.box.y, line.box.y), line.box.x + line.box.width - labelCell.box.x, maxOf(labelCell.box.height, line.box.height)),
            columnIndex = line.columnIndex,
            previousColumn = line.previousColumn,
        )
    }
```

and in the row loop, when `line.previousColumn` is true every `RowParse.Measurement` it yields becomes `abstentions += ParsedAbstention(row.label.take(MAX_LABEL), AbstentionReason.PREVIOUS_COLUMN, line.page)` instead of a candidate. A label-only column-0 cell that was consumed by `joinValueColumns` still sits in the list as a `Skipped` row; that is fine because `Skipped` never abstains.

- [ ] **Step 4: Run the tests**

Run: `./gradlew.bat :apps:document-worker:test :packages:korean-checkup-benchmark:test --no-daemon`
Expected: `BUILD SUCCESSFUL`. The corpus's `hospital-two-column` layout prints the label at x = 56 pt and `value unit (range)` at x = 320 pt on one baseline; with `xGap = 0.06` (35 pt on A4) it becomes two cells that `joinValueColumns` re-joins, and `CheckupCorpusGeneratorTest` proves the joined text, hash and box (IoU ≥ 0.8) still match gold.

- [ ] **Step 5: Run the gate**

Run: `pnpm medical-ai:native-text-gate`
Expected: `"corpusId": "synthetic-ko-checkup-r2-50ed23041bb4af1d"`, `"fieldF1": 1`, `"evidenceLocalizationRate": 1`, `"passed": true`.

- [ ] **Step 6: Commit**

```bash
git add apps/document-worker
git commit -m "feat(worker): positional column grouping, continued labels and previous-column abstentions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 4: Worker — date label rules (Korean compounds, English report/print/issue dates, no two-digit years)

**Files:**
- Modify: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProvider.kt` (`dateLabel`)
- Test: `apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/NativeTextExtractionProviderTest.kt`

**Interfaces:**
- Consumes: `resolveObservedOn(lines): DateResolution`.
- Produces: unchanged signatures; `dateLabel` gains a Korean left lookbehind and English negative lookbehinds for `report`, `print`, `printed`, `issue`, `issued`.

- [ ] **Step 1: Write the failing tests**

```kotlin
    @Test
    fun `a Korean compound that ends with the exam-date label is not a date label`() {
        assertThat(NativeTextExtractionProvider.resolveObservedOn(lines("재검사일: 2026-08-30", "혈당 95 mg/dL")))
            .isEqualTo(NativeTextExtractionProvider.DateResolution.Missing)
        assertThat(NativeTextExtractionProvider.resolveObservedOn(lines("예약검진일 2026-08-30", "검사일 2026-07-28")))
            .isEqualTo(NativeTextExtractionProvider.DateResolution.Found(java.time.LocalDate.of(2026, 7, 28)))
    }

    @Test
    fun `an English date preceded by report, print or issue is not the exam date`() {
        for (prefix in listOf("Report Date", "Print Date", "Printed Date", "Issue Date", "Issued date")) {
            assertThat(NativeTextExtractionProvider.resolveObservedOn(lines("$prefix: 2026-08-30")))
                .describedAs(prefix).isEqualTo(NativeTextExtractionProvider.DateResolution.Missing)
        }
        assertThat(NativeTextExtractionProvider.resolveObservedOn(lines("Report Date: 2026-08-30", "Exam Date: 2026-07-28")))
            .isEqualTo(NativeTextExtractionProvider.DateResolution.Found(java.time.LocalDate.of(2026, 7, 28)))
    }

    @Test
    fun `two-digit years are not dates`() {
        assertThat(NativeTextExtractionProvider.resolveObservedOn(lines("검사일: 26-07-28", "검사일 26.7.28")))
            .isEqualTo(NativeTextExtractionProvider.DateResolution.Missing)
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew.bat :apps:document-worker:test --tests '*NativeTextExtractionProviderTest*' --no-daemon`
Expected: FAIL — the first test finds `2026-08-30` behind `재검사일`; the second finds `2026-08-30` behind `Report Date`.

- [ ] **Step 3: Implement**

```kotlin
    private val dateLabel = Regex(
        "(?:(?<![가-힣])(?:검사\\s*일자|검진\\s*일자|채취\\s*일자|검사일|검진일|채취일)(?![가-힣])|" +
            "(?<![A-Za-z])(?<!birth\\s{1,10})(?<!report\\s{1,10})(?<!print\\s{1,10})(?<!printed\\s{1,10})(?<!issue\\s{1,10})(?<!issued\\s{1,10})" +
            "(?:exam\\s+|test\\s+|collection\\s+)?date(?![A-Za-z])(?!\\s{1,10}of\\s{1,10}birth))\\s*[:：]?",
        RegexOption.IGNORE_CASE,
    )
```

Two-digit years were never recognised (`datePatterns` require `\d{4}`); the third test states it. Add to the object's KDoc: "two-digit years are not recognised; `재검사일`, `Report/Print/Issue Date` are not exam-date labels".

- [ ] **Step 4: Run tests and gate**

Run: `./gradlew.bat :apps:document-worker:test :packages:korean-checkup-benchmark:test --no-daemon` → `BUILD SUCCESSFUL`; `pnpm medical-ai:native-text-gate` → unchanged corpus id, `passed: true`.

- [ ] **Step 5: Commit**

```bash
git add apps/document-worker
git commit -m "fix(worker): exclude Korean compounds and report/print/issue dates from the exam-date label

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 5: Core DTO pattern, web schema, Korean copy and fixtures for the seven abstention reasons

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/DocumentWorkerBoundary.kt:139-146` (`ExtractionAbstention.reason`)
- Modify: `apps/web/lib/foundation/client.ts:23-27`, `apps/web/lib/format/status-labels.ts:63-68`, `apps/web/lib/medical-ai/contracts.ts:45-50`, `apps/web/tests/fixtures/foundation.ts`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/ExtractionResultRequestValidationTest.kt`, `apps/web/tests/abstention-copy.test.ts`, `apps/web/tests/korean-ux-copy.test.ts`

**Interfaces:**
- Consumes: `AbstentionReason.CODES` (Task 1).
- Produces: core regex `^(unreadable|ambiguous_value|ambiguous_unit|missing_evidence|qualified_value|qualitative|previous_column)$`; web `FoundationAbstention["reason"]` union of the same seven; `abstentionReasonLabels` with the three new sentences; fixture export `syntheticAbstentions: FoundationAbstention[]`.

- [ ] **Step 1: Write the failing tests**

Core (`ExtractionResultRequestValidationTest.kt`):

```kotlin
    @Test
    fun acceptsExactlyTheSevenClosedAbstentionReasons() {
        for (reason in listOf("unreadable", "ambiguous_value", "ambiguous_unit", "missing_evidence", "qualified_value", "qualitative", "previous_column")) {
            assertThat(validator.validate(request(abstentions = listOf(abstention(reason = reason))))).describedAs(reason).isEmpty()
        }
        assertThat(validator.validate(request(abstentions = listOf(abstention(reason = "render_error"))))).isNotEmpty()
    }
```

Web (`apps/web/tests/abstention-copy.test.ts`, replace the file):

```ts
import { expect, it } from "vitest";
import { abstentionReasonLabels, describeAbstention, documentDateConflictLabel } from "@/lib/format/status-labels";
import { syntheticAbstentions } from "./fixtures/foundation";

it("names the document-level date conflict in Korean and keeps the reason map for every other row", () => {
  expect(documentDateConflictLabel).toBe("검사일이 둘 이상이라 확실하지 않음");
  expect(describeAbstention({ label: "문서 전체", reason: "ambiguous_value" })).toBe("검사일이 둘 이상이라 확실하지 않음");
  expect(describeAbstention({ label: "문서 전체", reason: "unreadable" })).toBe("글자 정보를 읽을 수 없음");
  expect(describeAbstention({ label: "LDL 콜레스테롤", reason: "ambiguous_value" })).toBe("값이 여러 개로 읽힘");
  expect(describeAbstention({ label: "AST", reason: "missing_evidence" })).toBe("검사일을 찾지 못함");
});

it("has one Korean sentence for each of the seven closed reasons", () => {
  expect(Object.keys(abstentionReasonLabels).sort()).toEqual([
    "ambiguous_unit", "ambiguous_value", "missing_evidence", "previous_column", "qualified_value", "qualitative", "unreadable",
  ]);
  expect(describeAbstention({ label: "hs-CRP (<0.3 mg/L)", reason: "qualified_value" })).toBe("부등호가 붙은 값이라 숫자로 확정하지 않음");
  expect(describeAbstention({ label: "요단백", reason: "qualitative" })).toBe("음성·양성 같은 판정 결과라 값으로 저장하지 않음");
  expect(describeAbstention({ label: "혈당", reason: "previous_column" })).toBe("이전 결과 칸의 값이라 이번 결과지 값으로 쓰지 않음");
  for (const abstention of syntheticAbstentions) expect(describeAbstention(abstention)).not.toBe(abstention.reason);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew.bat :apps:core-api:test --tests '*ExtractionResultRequestValidationTest*' --no-daemon` → FAIL on `qualified_value`. Run: `pnpm web:test -- abstention-copy` → FAIL (`syntheticAbstentions` is not exported; keys differ).

- [ ] **Step 3: Implement**

`DocumentWorkerBoundary.kt`:

```kotlin
data class ExtractionAbstention(
    @field:Size(min = 1, max = 80)
    val label: String,
    @field:Pattern(regexp = "^(unreadable|ambiguous_value|ambiguous_unit|missing_evidence|qualified_value|qualitative|previous_column)$")
    val reason: String,
    @field:Min(1) @field:Max(20)
    val evidencePage: Int? = null,
)
```

`client.ts`:

```ts
const extractionAbstentionSchema = z.object({
  label: z.string().min(1).max(80),
  reason: z.enum(["unreadable", "ambiguous_value", "ambiguous_unit", "missing_evidence", "qualified_value", "qualitative", "previous_column"]),
  evidencePage: z.number().int().positive().nullable().optional(),
}).strict();
```

`status-labels.ts`:

```ts
export const abstentionReasonLabels: Record<FoundationAbstention["reason"], string> = {
  unreadable: "글자 정보를 읽을 수 없음",
  ambiguous_value: "값이 여러 개로 읽힘",
  ambiguous_unit: "단위를 확정할 수 없음",
  missing_evidence: "검사일을 찾지 못함",
  qualified_value: "부등호가 붙은 값이라 숫자로 확정하지 않음",
  qualitative: "음성·양성 같은 판정 결과라 값으로 저장하지 않음",
  previous_column: "이전 결과 칸의 값이라 이번 결과지 값으로 쓰지 않음",
};
```

`contracts.ts` (both `extractionAbstentionSchema.reason` and, through `.shape.reason`, the gold `acceptedReasons`):

```ts
  reason: z.enum(["unreadable", "ambiguous_value", "ambiguous_unit", "missing_evidence", "qualified_value", "qualitative", "previous_column"]),
```

`tests/fixtures/foundation.ts` (append; import `FoundationAbstention` from `@/lib/foundation/client`):

```ts
export const syntheticAbstentions: FoundationAbstention[] = [
  { label: "hs-CRP (<0.3 mg/L)", reason: "qualified_value", evidencePage: 1 },
  { label: "요단백", reason: "qualitative", evidencePage: 1 },
  { label: "혈당", reason: "previous_column", evidencePage: 1 },
  { label: "문서 전체", reason: "unreadable" },
];
```

`korean-ux-copy.test.ts`: in the test `describes a document whose labelled dates disagree without a raw reason code` add
`expect(source("lib/format/status-labels.ts")).toContain("부등호가 붙은 값이라 숫자로 확정하지 않음");` and the other two sentences.

- [ ] **Step 4: Run tests**

Run: `./gradlew.bat :apps:core-api:test --tests '*ExtractionResultRequestValidationTest*' --no-daemon` → PASS. `pnpm web:test` → all files pass. `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/DocumentWorkerBoundary.kt apps/core-api/src/test apps/web/lib apps/web/tests
git commit -m "feat: seven closed abstention reasons across core DTO, web schema, Korean copy and fixtures

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 6: Value contract — confirmation and correction accept the worker value grammar, stored verbatim

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleController.kt:73-87`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt:177` (`confirmedValuePattern`)
- Modify: `apps/web/components/integrated/CandidateReview.tsx:161`, `apps/web/components/integrated/IntegratedRecords.tsx:182` (`pattern`)
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationLifecyclePostgresIntegrationTest.kt`, `apps/web/tests/integrated-review-loop.test.tsx`

**Interfaces:**
- Consumes: `ChangeDeltaCalculator.parse` (commas removed) — unchanged.
- Produces: `const val CONFIRMED_VALUE_PATTERN = "^-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$"` in `FoundationLifecycleController.kt` (top level), used by both request DTOs and by the service; web `pattern="-?([0-9]{1,3}(,[0-9]{3})+|[0-9]+)([.][0-9]+)?"` and `maxLength={64}` on both inputs.

- [ ] **Step 1: Write the failing integration test**

```kotlin
    @Test
    fun confirmsAndCorrectsValuesInTheWorkerGrammarAndStoresThemVerbatim() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "value-grammar-request")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(
            documentId,
            candidates = listOf(
                ExtractedCandidate(1, "혈소판", "250,000", "/µL", "2026-07-28", 1, EvidenceBox(0.08, 0.10, 0.30, 0.02), "1".repeat(64)),
                ExtractedCandidate(2, "Base Excess", "-2", "mmol/L", "2026-07-28", 1, EvidenceBox(0.08, 0.14, 0.20, 0.02), "2".repeat(64)),
                ExtractedCandidate(3, "TSH", "1.23", "µIU/mL", "2026-07-28", 1, EvidenceBox(0.08, 0.18, 0.25, 0.02), "3".repeat(64)),
            ),
        )
        val candidates = responseJson(read(get("/api/foundation/documents/$documentId/candidates"), alice).andReturn().response.contentAsByteArray).toList()
        fun confirm(index: Int, value: String, key: String) = mutate(
            post("/api/foundation/candidates/${candidates[index]["candidateId"].asText()}/confirmation")
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(json(mapOf("value" to value))),
            alice,
        )
        confirm(0, "250,000", "grammar-confirm-1").andExpect(status().isCreated)
            .andExpect(jsonPath("$.value").value("250,000")).andExpect(jsonPath("$.reviewDecision").value("CONFIRMED"))
        confirm(1, "-2", "grammar-confirm-2").andExpect(status().isCreated)
            .andExpect(jsonPath("$.value").value("-2")).andExpect(jsonPath("$.unit").value("mmol/L"))
        val tsh = responseJson(confirm(2, "1.23", "grammar-confirm-3").andExpect(status().isCreated).andReturn().response.contentAsByteArray)
        mutate(
            post("/api/foundation/records/${tsh["recordId"].asText()}/corrections")
                .header("Idempotency-Key", "grammar-correct-3").contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "1.234", "reason" to "결과지에 소수 셋째 자리까지 적혀 있음"))),
            alice,
        ).andExpect(status().isOk).andExpect(jsonPath("$.value").value("1.234")).andExpect(jsonPath("$.reviewDecision").value("CORRECTED"))
        mutate(
            post("/api/foundation/records/${tsh["recordId"].asText()}/corrections")
                .header("Idempotency-Key", "grammar-correct-long").contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "1." + "2".repeat(63), "reason" to "too long"))),
            alice,
        ).andExpect(status().isBadRequest).andExpect(jsonPath("$.code").value("request_invalid"))
        for (bad in listOf("1,00", "abc", "1.", "+5", "1 000")) {
            confirm(0, bad, "grammar-bad-$bad".replace(Regex("[^A-Za-z0-9._:-]"), "_")).andExpect(status().isBadRequest)
        }
        assertThat(jdbc.queryForObject("SELECT confirmed_value FROM gc_health_record WHERE label = '혈소판'", String::class.java)).isEqualTo("250,000")
        // Arithmetic still removes commas: /series meanOfLast3 etc. are unaffected; the delta of 250,000 vs itself is 0.
        assertThat(ChangeDeltaCalculator.compute("250,000", "249,000")?.absolute).isEqualTo("+1000")
    }
```

`apps/web/tests/integrated-review-loop.test.tsx`: add one assertion that the review input accepts `250,000` (`fireEvent.change(input, { target: { value: "250,000" } })`, then the confirm button is enabled and the request body carries `"value":"250,000"` through the msw handler).

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --tests '*FoundationLifecyclePostgresIntegrationTest.confirmsAndCorrects*' --no-daemon`
Expected: FAIL — `250,000` → 400 `confirmed_value_invalid`.

- [ ] **Step 3: Implement**

Controller:

```kotlin
/** Founder decision 2026-09-18: the value a person confirms or corrects uses exactly the worker grammar. */
const val CONFIRMED_VALUE_PATTERN = "^-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$"

data class CandidateConfirmationRequest(
    @field:Size(min = 1, max = 64)
    @field:Pattern(regexp = CONFIRMED_VALUE_PATTERN)
    val value: String,
    @field:Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$")
    val observedOn: String? = null,
)

data class RecordCorrectionRequest(
    @field:Size(min = 1, max = 64)
    @field:Pattern(regexp = CONFIRMED_VALUE_PATTERN)
    val value: String,
    @field:Size(min = 1, max = 200)
    val reason: String,
)
```

Service: `private val confirmedValuePattern = Regex(CONFIRMED_VALUE_PATTERN)` (kept as defence in depth; `confirmed_value_invalid` remains for service-level callers). Web inputs: `pattern="-?([0-9]{1,3}(,[0-9]{3})+|[0-9]+)([.][0-9]+)?" maxLength={64}` in both components.

- [ ] **Step 4: Run tests**

Run: the integration test class → PASS; `pnpm web:test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api apps/web/components apps/web/tests
git commit -m "feat(core): confirmation and correction values use the worker grammar and are stored verbatim

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 7: V13 migration and idempotency semantics (request hash, 24 h expiry, 422 mismatch)

**Files:**
- Create: `apps/core-api/src/main/resources/db/migration/V13__wave7_idempotency_status_audit.sql`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt:499-535`, `FoundationLifecycleService.kt` (every `insertIdempotency`/`findIdempotentResource` call), `FoundationLifecycleController.kt` (new exception handler)
- Modify: `packages/document-boundary/.../DocumentBoundaryContracts.kt` (`DocumentState.TERMINATED_BY_REVOCATION`)
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `FoundationHashing.sha256(String)`.
- Produces: `class FoundationUnprocessableException(val code: String) : RuntimeException(code)` → HTTP 422; `FoundationRepository.claimIdempotency(subjectHash, operation, idempotencyKey, resourceId, requestSha256, now, expiresAt): IdempotencyClaim` where `sealed interface IdempotencyClaim { data object Inserted; data class Existing(val resourceId: UUID, val requestSha256: String?) }`; `FoundationRepository.deleteExpiredIdempotency(now): Int`; `FoundationRepository.deleteIdempotencyForSubject(subjectHash)`; service helper `requestHash(operation, targetId, body): String`. V13 also ships the `TERMINATED_BY_REVOCATION` status (used by Task 11), the audit trigger (used by Task 26) and the two catalogue aliases (Task 2).

- [ ] **Step 1: Write V13**

```sql
-- Wave 7. Forward-only and safe on a populated database: nullable columns, one status added to a
-- CHECK, alias UPDATEs keyed by concept_code, and a trigger that only rejects future UPDATE/DELETE.

-- §4 idempotency: the same key with a different target or a different body is a client bug (422),
-- and a key older than 24 h is a new request. Existing rows keep NULL hash (never mismatch) and
-- expire 24 h after their created_at.
ALTER TABLE gc_idempotency
    ADD COLUMN request_sha256 CHAR(64),
    ADD COLUMN expires_at TIMESTAMPTZ,
    ADD CONSTRAINT gc_idempotency_request_digest_shape CHECK (request_sha256 IS NULL OR request_sha256 ~ '^[0-9a-f]{64}$');
UPDATE gc_idempotency SET expires_at = created_at + INTERVAL '24 hours' WHERE expires_at IS NULL;
ALTER TABLE gc_idempotency ALTER COLUMN expires_at SET NOT NULL;
CREATE INDEX gc_idempotency_expires_idx ON gc_idempotency(expires_at);

-- §1 founder decision 2: revoking DOCUMENT_EXTRACTION terminates in-flight and review documents.
ALTER TABLE gc_document DROP CONSTRAINT gc_document_status;
ALTER TABLE gc_document
    ADD CONSTRAINT gc_document_status CHECK (status IN (
        'UPLOAD_PENDING', 'UNTRUSTED_OBJECT', 'SECURITY_INSPECTION',
        'SECURITY_REJECTED', 'SECURITY_APPROVED', 'EXTRACTION_QUEUED',
        'EXTRACTION_RUNNING', 'REVIEW_REQUIRED', 'COMPLETED',
        'DELETION_PENDING', 'DELETED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL',
        'TERMINATED_BY_REVOCATION'
    ));

-- §8 honesty: gc_audit_event is append-only at the database, like security_audit_event (V3).
CREATE FUNCTION reject_gc_audit_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'gc_audit_event rows are append-only';
END;
$$;
CREATE TRIGGER gc_audit_event_append_only
    BEFORE UPDATE OR DELETE ON gc_audit_event
    FOR EACH ROW EXECUTE FUNCTION reject_gc_audit_event_mutation();

-- §2 blood pressure split labels (mirrors MedicalConceptCatalogue; the seed-equality test binds them).
UPDATE gc_medical_concept SET aliases = '["최고혈압","Systolic","Systolic Blood Pressure","SBP","혈압(수축기)"]' WHERE concept_code = 'systolic-blood-pressure';
UPDATE gc_medical_concept SET aliases = '["최저혈압","Diastolic","Diastolic Blood Pressure","DBP","혈압(이완기)"]' WHERE concept_code = 'diastolic-blood-pressure';
```

Before writing the two alias arrays, print the current seed with `psql "$GC_TEST_POSTGRES_URL" -c "SELECT concept_code, aliases FROM gc_medical_concept WHERE concept_code LIKE '%blood-pressure'"` (or read V11's `UPDATE` for those codes) and copy the existing array **exactly** plus the new alias at the end, in the same order as the Kotlin catalogue.

- [ ] **Step 2: Write the failing integration tests**

```kotlin
    @Test
    fun theSameIdempotencyKeyWithAnotherTargetOrBodyIsRejectedWith422AndExpiresAfter24Hours() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val first = createCandidate(alice, consentId, "idem-a")
        val second = createCandidate(alice, consentId, "idem-b")
        fun confirm(candidateId: UUID, value: String) = mutate(
            post("/api/foundation/candidates/$candidateId/confirmation").header("Idempotency-Key", "shared-key-0001")
                .contentType(MediaType.APPLICATION_JSON).content(json(mapOf("value" to value))),
            alice,
        )
        val record = responseJson(confirm(first, "188").andExpect(status().isCreated).andReturn().response.contentAsByteArray)
        confirm(first, "188").andExpect(status().isCreated).andExpect(jsonPath("$.recordId").value(record["recordId"].asText()))
        confirm(first, "189").andExpect(status().isUnprocessableEntity).andExpect(jsonPath("$.code").value("idempotency_key_mismatch"))
        confirm(second, "188").andExpect(status().isUnprocessableEntity).andExpect(jsonPath("$.code").value("idempotency_key_mismatch"))
        assertThat(count("gc_health_record")).isEqualTo(1)
        jdbc.update("UPDATE gc_idempotency SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'")
        // Expired: the key is free again, and the second candidate can now be confirmed under it.
        confirm(second, "188").andExpect(status().isCreated)
        assertThat(count("gc_health_record")).isEqualTo(2)
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_idempotency WHERE request_sha256 IS NOT NULL AND expires_at > CURRENT_TIMESTAMP", Long::class.java)).isEqualTo(1L)
    }

    @Test
    fun auditRowsAreAppendOnlyAtTheDatabase() {
        val alice = login("synthetic-alice")
        grantConsent(alice)
        org.assertj.core.api.Assertions.assertThatThrownBy { jdbc.update("DELETE FROM gc_audit_event") }.isInstanceOf(DataAccessException::class.java)
        org.assertj.core.api.Assertions.assertThatThrownBy { jdbc.update("UPDATE gc_audit_event SET outcome = 'DENIED'") }.isInstanceOf(DataAccessException::class.java)
        assertThat(count("gc_audit_event")).isGreaterThanOrEqualTo(2)
    }
```

- [ ] **Step 3: Run to verify failure**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --tests '*FoundationLifecyclePostgresIntegrationTest*' --no-daemon`
Expected: Flyway applies V13 (`Successfully applied 1 migration`); `medicalConceptSeedMatchesTheSharedCatalogue` → PASS again; `theSameIdempotencyKey…` → FAIL (`confirm(first, "189")` returns 201, not 422).

- [ ] **Step 4: Implement**

Repository (replace `insertIdempotency`/`findIdempotentResource`; keep `findConsentGrantOperationForKey`):

```kotlin
sealed interface IdempotencyClaim {
    data object Inserted : IdempotencyClaim
    data class Existing(val resourceId: UUID, val requestSha256: String?) : IdempotencyClaim
}

    /** Insert-or-read in one statement so two racing requests see one winner. Expired rows are replaced. */
    fun claimIdempotency(
        subjectHash: String,
        operation: String,
        idempotencyKey: String,
        resourceId: UUID,
        requestSha256: String,
        now: Instant,
        expiresAt: Instant,
    ): IdempotencyClaim {
        val row = jdbc.query(
            """
            INSERT INTO gc_idempotency(subject_hash, operation, idempotency_key, resource_id, request_sha256, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (subject_hash, operation, idempotency_key) DO UPDATE
                SET resource_id = EXCLUDED.resource_id, request_sha256 = EXCLUDED.request_sha256,
                    created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at
                WHERE gc_idempotency.expires_at <= EXCLUDED.created_at
            RETURNING resource_id, request_sha256, (xmax = 0) AS inserted
            """.trimIndent(),
            RowMapper { result, _ ->
                Triple(result.getObject("resource_id", UUID::class.java), result.getString("request_sha256"), result.getBoolean("inserted"))
            },
            subjectHash, operation, idempotencyKey, resourceId, requestSha256,
            now.atOffset(ZoneOffset.UTC), expiresAt.atOffset(ZoneOffset.UTC),
        ).firstOrNull()
        if (row != null && (row.third || row.first == resourceId)) return IdempotencyClaim.Inserted
        val existing = row ?: jdbc.query(
            "SELECT resource_id, request_sha256 FROM gc_idempotency WHERE subject_hash = ? AND operation = ? AND idempotency_key = ?",
            RowMapper { result, _ -> Triple(result.getObject("resource_id", UUID::class.java), result.getString("request_sha256"), false) },
            subjectHash, operation, idempotencyKey,
        ).first()
        return IdempotencyClaim.Existing(existing.first, existing.second)
    }

    fun findIdempotentResource(subjectHash: String, operation: String, idempotencyKey: String, now: Instant): UUID? =
        jdbc.query(
            "SELECT resource_id FROM gc_idempotency WHERE subject_hash = ? AND operation = ? AND idempotency_key = ? AND expires_at > ?",
            RowMapper { result, _ -> result.getObject("resource_id", UUID::class.java) },
            subjectHash, operation, idempotencyKey, now.atOffset(ZoneOffset.UTC),
        ).firstOrNull()

    fun deleteExpiredIdempotency(now: Instant): Int =
        jdbc.update("DELETE FROM gc_idempotency WHERE expires_at <= ?", now.atOffset(ZoneOffset.UTC))

    fun deleteIdempotencyForSubject(subjectHash: String): Int =
        jdbc.update("DELETE FROM gc_idempotency WHERE subject_hash = ?", subjectHash)
```

(`ON CONFLICT … DO UPDATE … WHERE` returns no row when the conflicting row is unexpired, hence the fallback `SELECT`; `xmax = 0` is true for a fresh insert.)

Service: add `private val idempotencyTtl: Duration = Duration.ofHours(24)` and

```kotlin
    private fun requestHash(operation: String, targetId: String, body: String = ""): String =
        FoundationHashing.sha256("$operation|$targetId|$body")

    /** Replay → the stored resource; different target/body under the same key → 422. Returns null when this request owns the key. */
    private fun replayOrClaim(subjectHash: String, operation: String, key: String, resourceId: UUID, requestSha256: String, now: Instant): UUID? =
        when (val claim = repository.claimIdempotency(subjectHash, operation, key, resourceId, requestSha256, now, now.plus(idempotencyTtl))) {
            IdempotencyClaim.Inserted -> null
            is IdempotencyClaim.Existing -> {
                if (claim.requestSha256 != null && claim.requestSha256 != requestSha256) throw FoundationUnprocessableException("idempotency_key_mismatch")
                claim.resourceId
            }
        }
```

and rewrite each operation: `confirmCandidate` → `replayOrClaim(subjectHash, "CANDIDATE_CONFIRM", key, recordId, requestHash("CANDIDATE_CONFIRM", candidateId.toString(), "$confirmedValue|${confirmedObservedOn.orEmpty()}"), now)?.let { return recordReceipt(requireRecord(principal, it)) }`; `excludeCandidate` → body `""`, target candidateId; `correctRecord` → target recordId, body `"$correctedValue|$normalizedReason"`; `requestDocument` → target `""`, body `"$consentId|$mediaType|$contentLength|$expectedSha256"`; `grantConsent` (keyed) → target purposeCode. Delete the now-unused two-step `findIdempotentResource` + `insertIdempotency` sequences (the pre-check `findIdempotentResource` stays only where a replay must be answered *before* the state check, i.e. `confirmCandidate`'s `findRecordForCandidate` line is unchanged). Add `class FoundationUnprocessableException(val code: String) : RuntimeException(code)` next to the other exceptions and

```kotlin
    @ExceptionHandler(FoundationUnprocessableException::class)
    fun handleUnprocessable(exception: FoundationUnprocessableException): ResponseEntity<ApiProblem> =
        problem(HttpStatus.UNPROCESSABLE_ENTITY, exception.code)
```

in the controller. Add `TERMINATED_BY_REVOCATION` to `DocumentState` in `DocumentBoundaryContracts.kt`. Web: add `"TERMINATED_BY_REVOCATION"` to `documentSchema.status` in `client.ts` and the label `TERMINATED_BY_REVOCATION: "동의를 철회해서 결과지 처리를 종료했어요. 다시 동의한 뒤 새로 올려 주세요."` to the status map in `IntegratedHealthExperience.tsx:55-70` (the map is `Record<FoundationDocument["status"], string>`, so `tsc` fails until both are added); `mapProblem` gains `if (code === "idempotency_key_mismatch") return "conflict";`.

- [ ] **Step 5: Run tests**

Run: core integration class → PASS (including the consent idempotency tests, which now hash `purposeCode`); `pnpm web:test`; `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`.

- [ ] **Step 6: Commit**

```bash
git add apps/core-api packages/document-boundary apps/web/lib apps/web/components
git commit -m "feat(core): V13 idempotency request hash and 24h expiry, 422 idempotency_key_mismatch, TERMINATED_BY_REVOCATION status, append-only audit trigger

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 8: Row locks before state checks, no `check(it == 1)` on request paths, real two-thread races

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt` (`createRecordFromCandidate`, new lock helpers)
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLifecycleService.kt` (`confirmCandidate`, `excludeCandidate`, `correctRecord`, `requestDocument`, `uploadDocument`, `finalizeDocument`)
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `IdempotencyClaim`, `replayOrClaim` (Task 7).
- Produces: `FoundationRepository.lockCandidate(subjectId, candidateId): FoundationCandidateRow?`, `lockRecord(subjectId, recordId): FoundationRecordRow?`, `lockDocument(subjectId, documentId): FoundationDocumentRow?` (each runs `SELECT <pk> FROM <table> WHERE <pk> = ? AND subject_id = ? FOR UPDATE` then re-reads the projection); `createRecordFromCandidate(...)`: `Boolean` (false when the candidate was no longer `PENDING`). Error codes: `409 candidate_state_changed`, `409 record_state_changed`, `409 document_state_changed`. Worker-side `check(it == 1)` calls in `markInspectionCompleted`, `markJobFailed`, `markExtractionCompleted`, `completeJob`, `leaseNextDocumentJob` stay: they run under `lockLeasedJob` (`FOR UPDATE OF j`) and a violated check there is a real invariant break, not a request race.

- [ ] **Step 1: Write the failing race tests**

```kotlin
    @Test
    fun twoThreadsConfirmingOneCandidateProduceExactlyOneRecordAndOneConflict() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "race-confirm")
        val principal = FoundationPrincipal("synthetic-alice", UUID.randomUUID(), alice.cookie.value.let(FoundationHashing::sha256))
        val results = race(2) { index ->
            service.confirmCandidate(principal, candidateId, "188", "race-confirm-key-$index")
        }
        assertThat(results.count { it.isSuccess }).isEqualTo(1)
        assertThat(results.mapNotNull { it.exceptionOrNull() }).singleElement().isInstanceOfSatisfying(FoundationConflictException::class.java) {
            assertThat(it.code).isEqualTo("candidate_state_changed")
        }
        assertThat(count("gc_health_record")).isEqualTo(1)
        assertThat(count("gc_health_record_version")).isEqualTo(1)
        assertThat(jdbc.queryForObject("SELECT status FROM gc_candidate WHERE candidate_id = ?", String::class.java, candidateId)).isEqualTo("CONFIRMED")
    }

    @Test
    fun confirmAndExcludeRacingOnOneCandidateLeaveExactlyOneOutcome() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "race-mixed")
        val principal = FoundationPrincipal("synthetic-alice", UUID.randomUUID(), FoundationHashing.sha256(alice.cookie.value))
        val results = race(2) { index ->
            if (index == 0) service.confirmCandidate(principal, candidateId, "188", "race-mixed-confirm") else service.excludeCandidate(principal, candidateId, "race-mixed-exclude")
        }
        assertThat(results.count { it.isSuccess }).isEqualTo(1)
        val status = jdbc.queryForObject("SELECT status FROM gc_candidate WHERE candidate_id = ?", String::class.java, candidateId)
        assertThat(status).isIn("CONFIRMED", "EXCLUDED")
        assertThat(count("gc_health_record")).isEqualTo(if (status == "CONFIRMED") 1L else 0L)
        val failure = results.mapNotNull { it.exceptionOrNull() }.single() as FoundationConflictException
        assertThat(failure.code).isIn("candidate_state_changed", "candidate_not_pending")
    }

    @Test
    fun twoThreadsCorrectingOneRecordProduceExactlyOneNewVersion() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "race-correct")
        val principal = FoundationPrincipal("synthetic-alice", UUID.randomUUID(), FoundationHashing.sha256(alice.cookie.value))
        val recordId = service.confirmCandidate(principal, candidateId, "188", "race-correct-confirm").recordId
        val results = race(2) { index ->
            service.correctRecord(principal, recordId, "19$index", "race $index", "race-correct-key-$index")
        }
        assertThat(results.count { it.isSuccess }).isEqualTo(1)
        assertThat((results.mapNotNull { it.exceptionOrNull() }.single() as FoundationConflictException).code).isEqualTo("record_state_changed")
        assertThat(count("gc_health_record_version")).isEqualTo(2)
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_health_record_version WHERE status = 'CURRENT'", Long::class.java)).isEqualTo(1L)
    }

    /** Starts [threads] callables on one latch against the real database and returns their results in submission order. */
    private fun <T> race(threads: Int, action: (Int) -> T): List<Result<T>> {
        val executor = Executors.newFixedThreadPool(threads)
        val ready = CountDownLatch(threads)
        val start = CountDownLatch(1)
        try {
            val futures = (0 until threads).map { index ->
                executor.submit<Result<T>> {
                    ready.countDown()
                    check(start.await(5, TimeUnit.SECONDS))
                    runCatching { action(index) }
                }
            }
            check(ready.await(5, TimeUnit.SECONDS))
            start.countDown()
            return futures.map { it.get(15, TimeUnit.SECONDS) }
        } finally {
            start.countDown()
            executor.shutdownNow()
            check(executor.awaitTermination(5, TimeUnit.SECONDS))
        }
    }
```

Also add a regression for the old `check`: `grep -n "check(updated == 1) { \"candidate state changed during confirmation\" }" apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationRepository.kt` must print nothing after Step 3 (a `IllegalStateException` would have become a 500).

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --tests '*FoundationLifecyclePostgresIntegrationTest.twoThreads*' --tests '*confirmAndExclude*' --no-daemon`
Expected: FAIL — the loser throws `IllegalStateException("candidate state changed during confirmation")` (or both succeed against a stale read), not `FoundationConflictException`.

- [ ] **Step 3: Implement**

Repository:

```kotlin
    fun lockCandidate(subjectId: String, candidateId: UUID): FoundationCandidateRow? {
        jdbc.query("SELECT candidate_id FROM gc_candidate WHERE candidate_id = ? AND subject_id = ? FOR UPDATE", { _, _ -> Unit }, candidateId, subjectId)
        return findCandidate(subjectId, candidateId)
    }

    fun lockRecord(subjectId: String, recordId: UUID): FoundationRecordRow? {
        jdbc.query("SELECT record_id FROM gc_health_record WHERE record_id = ? AND subject_id = ? FOR UPDATE", { _, _ -> Unit }, recordId, subjectId)
        return findRecord(subjectId, recordId)
    }

    fun lockDocument(subjectId: String, documentId: UUID): FoundationDocumentRow? {
        jdbc.query("SELECT document_id FROM gc_document WHERE document_id = ? AND subject_id = ? FOR UPDATE", { _, _ -> Unit }, documentId, subjectId)
        return findDocument(subjectId, documentId)
    }
```

`createRecordFromCandidate` returns `Boolean`: replace `check(updated == 1) { … }` with `if (updated != 1) return false` and end with `return true`.

Service — `confirmCandidate` after `requireIdempotencyKey` and the pattern check:

```kotlin
        val candidate = repository.lockCandidate(principal.subjectId, candidateId)
            ?: deniedNotFound(principal, "CANDIDATE_ACCESS_DENIED", "CANDIDATE", candidateId, "candidate_not_found")
        val document = requireDocument(principal, candidate.documentId)
        requireActiveConsent(principal, document.consentId)
        repository.findRecordForCandidate(principal.subjectId, candidateId)?.let { return recordReceipt(it) }
        if (candidate.status != "PENDING") throw FoundationConflictException("candidate_not_pending")
        // … idempotency (Task 7) …
        if (!repository.createRecordFromCandidate(recordId, UUID.randomUUID(), candidate, confirmedValue, now, observedOn)) {
            throw FoundationConflictException("candidate_state_changed")
        }
```

`excludeCandidate`: `val candidate = repository.lockCandidate(...) ?: deniedNotFound(...)` before the status checks (the existing `if (!repository.excludeCandidate(...)) throw FoundationConflictException("candidate_state_changed")` stays). `correctRecord`: `val current = repository.lockRecord(principal.subjectId, recordId) ?: deniedNotFound(principal, "RECORD_ACCESS_DENIED", "RECORD", recordId, "record_not_found")`. `uploadDocument` and `finalizeDocument`: `val document = repository.lockDocument(...) ?: deniedNotFound(...)`. `requestDocument` has no target row; its idempotency claim (Task 7) is the serialisation point.

Because the row is locked before the status is read, the second thread of each race observes the first thread's committed state (`CONFIRMED`/`EXCLUDED`/`SUPERSEDED`) and fails on the explicit status check; the update-count checks remain as the last line of defence and now map to 409.

- [ ] **Step 4: Run the class**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --tests '*FoundationLifecyclePostgresIntegrationTest*' --no-daemon` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api
git commit -m "fix(core): lock the target row before every state check; request races end in 409, never in IllegalStateException

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 9: Every framework exception becomes `problem+json` with `Cache-Control: no-store` and no body echo

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationProblemAdvice.kt`
- Modify: `apps/core-api/src/main/resources/application.yml` (`spring.mvc.problemdetails.enabled: false` stays absent; add `server.error.whitelabel.enabled: false`)
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `ApiProblem`, the exception classes.
- Produces: `@RestControllerAdvice(basePackages = ["kr.co.genomecompanion.foundation"]) class FoundationProblemAdvice` mapping `HttpMessageNotReadableException` → 400 `request_body_invalid`, `MissingRequestHeaderException` → 400 `request_header_missing`, `MethodArgumentTypeMismatchException` → 400 `request_path_invalid`, `HttpMediaTypeNotSupportedException` → 415 `media_type_unsupported`, `HttpRequestMethodNotSupportedException` → 405 `method_not_allowed`, `CannotAcquireLockException`/`PessimisticLockingFailureException`/`DeadlockLoserDataAccessException` → 409 `lock_conflict`, `DataAccessException` → 503 `storage_unavailable`, `Exception` → 500 `internal_error`. Every response has `Content-Type: application/problem+json`, `Cache-Control: no-store`, body exactly `{"code":"…"}`.

- [ ] **Step 1: Write the failing test**

```kotlin
    @Test
    fun frameworkFailuresAreProblemJsonWithNoStoreAndNeverEchoTheRequest() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "problem-shape")
        val secret = "SECRET-BODY-VALUE-7731"
        fun expectProblem(builder: MockHttpServletRequestBuilder, status: Int, code: String) {
            val response = mutate(builder, alice).andExpect(status().`is`(status))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value(code))
                .andReturn().response
            assertThat(response.contentAsString).isEqualTo("""{"code":"$code"}""")
            assertThat(response.contentAsString).doesNotContain(secret)
        }
        val confirmation = "/api/foundation/candidates/$candidateId/confirmation"
        expectProblem(post(confirmation).header("Idempotency-Key", "problem-json-1").contentType(MediaType.APPLICATION_JSON).content("{\"value\": \"$secret"), 400, "request_body_invalid")
        expectProblem(post(confirmation).header("Idempotency-Key", "problem-json-2").contentType(MediaType.APPLICATION_JSON).content("{\"value\":\"188\",\"extra\":\"$secret\"}"), 400, "request_body_invalid")
        expectProblem(post(confirmation).contentType(MediaType.APPLICATION_JSON).content("{\"value\":\"188\"}"), 400, "request_header_missing")
        expectProblem(post("/api/foundation/candidates/not-a-uuid-$secret/confirmation").header("Idempotency-Key", "problem-json-3").contentType(MediaType.APPLICATION_JSON).content("{\"value\":\"188\"}"), 400, "request_path_invalid")
        expectProblem(post(confirmation).header("Idempotency-Key", "problem-json-4").contentType(MediaType.TEXT_PLAIN).content(secret), 415, "media_type_unsupported")
        expectProblem(put("/api/foundation/candidates/$candidateId/confirmation").contentType(MediaType.APPLICATION_JSON).content("{}"), 405, "method_not_allowed")
        assertThat(count("gc_health_record")).isZero()
    }
```

- [ ] **Step 2: Run to verify failure**

Run: the single test. Expected: FAIL — malformed JSON currently returns Spring's default 400 body without `code`.

- [ ] **Step 3: Implement**

```kotlin
package kr.co.genomecompanion.foundation

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.dao.CannotAcquireLockException
import org.springframework.dao.DataAccessException
import org.springframework.dao.DeadlockLoserDataAccessException
import org.springframework.dao.PessimisticLockingFailureException
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.web.HttpRequestMethodNotSupportedException
import org.springframework.web.bind.MissingRequestHeaderException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException

/**
 * Every failure the framework raises before or around a foundation controller becomes the same
 * `{"code":"…"}` problem the controllers emit. The message of the exception is never written:
 * Spring's messages quote the offending request text, and that text may be a health value.
 */
@RestControllerAdvice(basePackages = ["kr.co.genomecompanion.foundation"])
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationProblemAdvice {
    private val log = LoggerFactory.getLogger(FoundationProblemAdvice::class.java)

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadable(): ResponseEntity<ApiProblem> = problem(HttpStatus.BAD_REQUEST, "request_body_invalid")

    @ExceptionHandler(MissingRequestHeaderException::class)
    fun missingHeader(): ResponseEntity<ApiProblem> = problem(HttpStatus.BAD_REQUEST, "request_header_missing")

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun pathMismatch(): ResponseEntity<ApiProblem> = problem(HttpStatus.BAD_REQUEST, "request_path_invalid")

    @ExceptionHandler(HttpMediaTypeNotSupportedException::class)
    fun mediaType(): ResponseEntity<ApiProblem> = problem(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "media_type_unsupported")

    @ExceptionHandler(HttpRequestMethodNotSupportedException::class)
    fun method(): ResponseEntity<ApiProblem> = problem(HttpStatus.METHOD_NOT_ALLOWED, "method_not_allowed")

    @ExceptionHandler(CannotAcquireLockException::class, PessimisticLockingFailureException::class, DeadlockLoserDataAccessException::class)
    fun lock(): ResponseEntity<ApiProblem> = problem(HttpStatus.CONFLICT, "lock_conflict")

    @ExceptionHandler(DataAccessException::class)
    fun storage(exception: DataAccessException): ResponseEntity<ApiProblem> {
        log.warn("event=storage_unavailable exception_class={}", exception.javaClass.simpleName)
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "storage_unavailable")
    }

    @ExceptionHandler(Exception::class)
    fun unexpected(exception: Exception): ResponseEntity<ApiProblem> {
        log.error("event=internal_error exception_class={}", exception.javaClass.simpleName)
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error")
    }

    private fun problem(status: HttpStatus, code: String): ResponseEntity<ApiProblem> =
        ResponseEntity.status(status)
            .contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(ApiProblem(code))
}
```

The controller-local handlers (`FoundationBadRequestException` etc.) keep precedence because `@ExceptionHandler` methods on the controller win over advice. `Exception::class` in the advice would also swallow the foundation exceptions for the worker controller only if it lacked its own handler — it has one; add `FoundationUnprocessableException` and `FoundationRateLimitedException` handlers to `DocumentWorkerBoundaryController.problem` for completeness (7b's worker rate limit needs the latter).

- [ ] **Step 4: Run the class** → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api
git commit -m "fix(core): framework failures answer problem+json with no-store and never echo request text

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 10: `/changes` same-day rule, ordering by `observedOn, confirmedAt`, sticky `CORRECTED`

**Files:**
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/ChangeSummaryProjection.kt:83-87`, `FoundationRepository.kt:1341-1346` (`listRecords` ORDER BY), `FoundationLifecycleService.kt:876` (`reviewDecision`), `HealthEventProjection.kt:57`
- Test: `ChangeSummaryProjectionTest.kt`, `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `FoundationRecordRow.supersedesVersionId`.
- Produces: `listRecords` ordered by `r.observed_on, v.changed_at, r.record_id`; `ChangeItem.delta` omitted when `previous.observedOn == latest.observedOn`; `reviewDecision`/`corrected` = `supersedesVersionId != null || currentValue != originalValue || originalObservedOn != null`.

- [ ] **Step 1: Write the failing tests**

`ChangeSummaryProjectionTest.kt`:

```kotlin
    @Test
    fun `a previous value observed on the same day lists both values but omits the delta like series does`() {
        val today = LocalDate.of(2026, 7, 28)
        val previous = record(documentId = docA, label = "총콜레스테롤", value = "190", observedOn = today, confirmedAt = Instant.parse("2026-07-28T01:00:00Z"))
        val latest = record(documentId = docB, label = "총콜레스테롤", value = "188", observedOn = today, confirmedAt = Instant.parse("2026-07-28T02:00:00Z"))
        val summary = ChangeSummaryProjection.project(listOf(previous, latest), listOf(completion(docA, "2026-07-28T01:00:00Z"), completion(docB, "2026-07-28T02:00:00Z")))
        val item = summary.items.single()
        assertThat(item.previous?.value).isEqualTo("190")
        assertThat(item.delta).isNull()
    }
```

(use the file's existing `record(...)`/`completion(...)` helpers; if their parameter names differ, adapt the call, not the helper.)

Integration:

```kotlin
    @Test
    fun recordOrderFollowsExamDateThenConfirmationAndACorrectionBackToTheOriginalStaysCorrected() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val july = importSyntheticDocument(alice, consentId, fixturePdf, fixtureDigest, "order-july")
        confirmEveryCandidate(alice, july, "order-july")
        val january = importSyntheticDocument(alice, consentId, januaryFixturePdf, januaryFixtureDigest, "order-jan")
        confirmEveryCandidate(alice, january, "order-jan")
        val before = responseJson(read(get("/api/foundation/records"), alice).andReturn().response.contentAsByteArray).map { it["observedOn"].asText() }
        assertThat(before).isSorted()
        assertThat(before.first()).isEqualTo("2026-01-15")
        val recordId = responseJson(read(get("/api/foundation/records"), alice).andReturn().response.contentAsByteArray).first()["recordId"].asText()
        fun correct(value: String, key: String) = mutate(
            post("/api/foundation/records/$recordId/corrections").header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to value, "reason" to "정정 $key"))),
            alice,
        ).andExpect(status().isOk)
        correct("195", "order-correct-1")
        correct("194", "order-correct-2")
        read(get("/api/foundation/records/$recordId"), alice)
            .andExpect(jsonPath("$.value").value("194"))
            .andExpect(jsonPath("$.originalValue").value("194"))
            .andExpect(jsonPath("$.reviewDecision").value("CORRECTED"))
        val after = responseJson(read(get("/api/foundation/records"), alice).andReturn().response.contentAsByteArray)
        assertThat(after.map { it["observedOn"].asText() }).isEqualTo(before)
        assertThat(after.first()["recordId"].asText()).isEqualTo(recordId)
        read(get("/api/foundation/health-events"), alice).andExpect(jsonPath("$[0].corrected").value(true))
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `./gradlew.bat :apps:core-api:cleanTest :apps:core-api:test --tests '*ChangeSummaryProjectionTest*' --tests '*recordOrderFollows*' --no-daemon`
Expected: FAIL — `delta` is `{"absolute":"-2",…}`; after the second correction the record moves to the end (ordered by `changed_at`) and `reviewDecision` is `CONFIRMED`.

- [ ] **Step 3: Implement**

`ChangeSummaryProjection`: `delta = previous?.takeIf { it.observedOn < record.observedOn }?.let { … }` (strictly earlier; same day omitted; the comment explains: "same-day points have no defined order — series omits too").
`FoundationRepository.listRecords`: `ORDER BY r.observed_on, v.changed_at, r.record_id`.
Service `recordReceipt`:

```kotlin
            reviewDecision = if (isCorrected(record)) "CORRECTED" else "CONFIRMED",
```

with `internal fun isCorrected(record: FoundationRecordRow): Boolean = record.supersedesVersionId != null || record.currentValue != record.originalValue || record.originalObservedOn != null` in a small `object RecordReview` (new file `RecordReview.kt`) and `HealthEventProjection` using `corrected = RecordReview.isCorrected(record)`.

Existing tests that assert order after corrections (`healthEventsProjectCurrentRecordsWithSourceAndPreviewFlag`, `exportV3…`) may list events in a different order now; update their expectations to `observedOn, concept, confirmedAt` — the `HealthEventProjection` sort is unchanged, only `/records` moved.

- [ ] **Step 4: Run** the core class and `ChangeSummaryProjectionTest`, `SeriesProjectionTest`, `HealthEventProjectionTest` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api
git commit -m "fix(core): same-day rule shared by /changes and /series, exam-date ordering, sticky CORRECTED

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 11: Consent revocation terminates review and in-flight documents and deletes their quarantine files

**Files:**
- Modify: `FoundationRepository.kt:459-497` (`terminateDocumentJobsForRevokedConsent`), `FoundationLifecycleService.kt:727-741` (`revokeConsent`)
- Modify: `apps/web/e2e/foundation-lifecycle.spec.ts` (one assertion), `apps/web/tests/korean-ux-copy.test.ts`
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `TERMINATED_BY_REVOCATION` (V13, Task 7), `FoundationDocumentStorage.deleteAll`.
- Produces: `FoundationRepository.terminateDocumentsForRevokedConsent(subjectId, consentId, now): List<Pair<StorageTrustZone, String>>` (returns the object keys of every terminated document), `revokeConsent` deletes those files in an `afterCommit` synchronization; audit event `DOCUMENT_TERMINATED_BY_REVOCATION` per document (resource id = documentId, no other field).

- [ ] **Step 1: Write the failing test**

```kotlin
    @Test
    fun revokingDocumentExtractionTerminatesReviewAndInFlightDocumentsAndDeletesTheirFiles() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val reviewing = requestDocument(alice, consentId, fixturePdf, "revoke-review")
        uploadDocument(alice, reviewing, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$reviewing/finalization"), alice).andExpect(status().isAccepted)
        runWorkerPipeline(reviewing)
        val confirmed = importSyntheticDocument(alice, consentId, januaryFixturePdf, januaryFixtureDigest, "revoke-done")
        confirmEveryCandidate(alice, confirmed, "revoke-done")
        val inFlight = requestDocument(alice, consentId, fixturePdf, "revoke-inflight")
        uploadDocument(alice, inFlight, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$inFlight/finalization"), alice).andExpect(status().isAccepted)
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$reviewing.pdf"))).isTrue()

        mutate(post("/api/foundation/consents/$consentId/revocation"), alice).andExpect(status().isOk)

        assertThat(documentStatus(reviewing)).isEqualTo("TERMINATED_BY_REVOCATION")
        assertThat(documentStatus(inFlight)).isEqualTo("TERMINATED_BY_REVOCATION")
        assertThat(documentStatus(confirmed.first()["documentId"].asText().let(UUID::fromString))).isEqualTo("COMPLETED")
        assertThat(jdbc.queryForList("SELECT status FROM gc_document_job WHERE document_id IN (?, ?)", String::class.java, reviewing, inFlight)).allMatch { it in setOf("DEAD_LETTER", "COMPLETED") }
        assertThat(jdbc.queryForObject("SELECT failure_code FROM gc_document WHERE document_id = ?", String::class.java, reviewing)).isEqualTo("consent_revoked")
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$reviewing.pdf"))).isFalse()
        assertThat(Files.list(quarantineRoot.resolve("approved_source")).filter { it.fileName.toString().startsWith(reviewing.toString()) }.count()).isZero()
        assertThat(Files.list(quarantineRoot.resolve("derived_safe_artifact")).filter { it.fileName.toString().startsWith(reviewing.toString()) }.count()).isZero()
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$inFlight.pdf"))).isFalse()
        // The person can still see the terminated document and its status; candidates are no longer reachable.
        read(get("/api/foundation/documents/$reviewing"), alice).andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("TERMINATED_BY_REVOCATION")).andExpect(jsonPath("$.previewAvailable").value(false))
        read(get("/api/foundation/documents/$reviewing/candidates"), alice).andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("consent_revoked"))
        read(get("/api/foundation/records"), alice).andExpect(jsonPath("$.length()").value(3))
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'DOCUMENT_TERMINATED_BY_REVOCATION'", Long::class.java)).isEqualTo(2L)
        // Re-consent: a new grant works, the terminated documents stay terminated, a new upload is required.
        val newConsent = grantConsent(alice)
        assertThat(newConsent).isNotEqualTo(consentId)
        assertThat(documentStatus(reviewing)).isEqualTo("TERMINATED_BY_REVOCATION")
    }
```

- [ ] **Step 2: Run to verify failure** — the reviewing document stays `REVIEW_REQUIRED` and its file exists.

- [ ] **Step 3: Implement**

Repository (replace `terminateDocumentJobsForRevokedConsent`):

```kotlin
    /** Founder decision 2026-09-18: revocation ends every document that has not been reviewed to completion. Returns the object keys to delete after commit. */
    fun terminateDocumentsForRevokedConsent(subjectId: String, consentId: UUID, now: Instant): List<TerminatedDocument> {
        val terminated = jdbc.query(
            """
            UPDATE gc_document
            SET status = 'TERMINATED_BY_REVOCATION', failure_code = 'consent_revoked',
                preview_object_key = NULL, state_version = state_version + 1, updated_at = ?
            WHERE subject_id = ? AND consent_id = ? AND status IN (
                'UPLOAD_PENDING', 'UNTRUSTED_OBJECT', 'SECURITY_INSPECTION', 'SECURITY_APPROVED',
                'EXTRACTION_QUEUED', 'EXTRACTION_RUNNING', 'REVIEW_REQUIRED', 'FAILED_RETRYABLE'
            )
            RETURNING document_id, object_key, approved_object_key,
                      (SELECT object_key FROM gc_preview_artifact p WHERE p.document_id = gc_document.document_id) AS preview_key
            """.trimIndent(),
            RowMapper { result, _ ->
                TerminatedDocument(
                    documentId = result.getObject("document_id", UUID::class.java),
                    objectKeys = listOfNotNull(
                        result.getString("object_key")?.let { StorageTrustZone.UNTRUSTED to it },
                        result.getString("approved_object_key")?.let { StorageTrustZone.APPROVED_SOURCE to it },
                        result.getString("preview_key")?.let { StorageTrustZone.DERIVED_SAFE_ARTIFACT to it },
                    ),
                )
            },
            now.atOffset(ZoneOffset.UTC), subjectId, consentId,
        )
        if (terminated.isEmpty()) return emptyList()
        val ids = terminated.map { it.documentId }.toTypedArray()
        jdbc.update(
            """
            UPDATE gc_document_job SET status = 'DEAD_LETTER', failure_code = 'consent_revoked',
                lease_token_hash = NULL, lease_expires_at = NULL, worker_id_hash = NULL, updated_at = ?
            WHERE document_id = ANY(?) AND status IN ('QUEUED', 'LEASED', 'FAILED_RETRYABLE')
            """.trimIndent(),
            now.atOffset(ZoneOffset.UTC), jdbc.dataSource!!.connection.use { it.createArrayOf("uuid", ids) },
        )
        jdbc.update("UPDATE gc_upload_capability SET revoked_at = COALESCE(revoked_at, ?) WHERE document_id = ANY(?)", now.atOffset(ZoneOffset.UTC), jdbc.dataSource!!.connection.use { it.createArrayOf("uuid", ids) })
        jdbc.update("DELETE FROM gc_preview_artifact WHERE document_id = ANY(?)", jdbc.dataSource!!.connection.use { it.createArrayOf("uuid", ids) })
        return terminated
    }

data class TerminatedDocument(val documentId: UUID, val objectKeys: List<Pair<StorageTrustZone, String>>)
```

(Put `TerminatedDocument` with the other row classes at the top of the file. Use `DataSourceUtils.getConnection(dataSource)` instead of `dataSource.connection` so the array is created on the transaction's connection: `org.springframework.jdbc.datasource.DataSourceUtils`. The candidate rows stay `PENDING` in the table but are unreachable: every candidate read path calls `requireActiveConsent`.)

Service:

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
            // Only DOCUMENT_EXTRACTION documents reference a consent; research/project purposes terminate nothing.
            val terminated = repository.terminateDocumentsForRevokedConsent(principal.subjectId, consentId, now)
            terminated.forEach { audit(principal, "DOCUMENT_TERMINATED_BY_REVOCATION", "DOCUMENT", it.documentId, "SUCCESS") }
            audit(principal, "CONSENT_REVOKED", "CONSENT", consentId, "SUCCESS", consent.purposeCode)
            val keys = terminated.flatMap { it.objectKeys }
            if (keys.isNotEmpty()) {
                TransactionSynchronizationManager.registerSynchronization(
                    object : TransactionSynchronization {
                        override fun afterCommit() {
                            // Best effort: a file that survives here is an orphan the janitor (Task 23) removes.
                            runCatching { documentStorage.deleteAll(keys) }
                        }
                    },
                )
            }
        }
        return consentReceipt(checkNotNull(repository.findConsent(principal.subjectId, consentId)))
    }
```

`documentReceipt` already returns `previewAvailable = previewObjectKey != null` (now NULL). `findLatestActiveDocument`'s status filter: add `TERMINATED_BY_REVOCATION` to whatever terminal set it excludes so the web's `documents/active` does not resume a terminated document — read the query at `FoundationRepository.kt:590-605` and treat the new status exactly like `FAILED_TERMINAL`.

e2e: after `await expect(documentRow).toContainText("철회함");` the second document in the browser test is already `COMPLETED`, so nothing terminates; add no new browser step. `korean-ux-copy.test.ts`: assert `IntegratedHealthExperience.tsx` contains `동의를 철회해서 결과지 처리를 종료했어요. 다시 동의한 뒤 새로 올려 주세요.` and add `TERMINATED_BY_REVOCATION` to the `SECURITY_REJECTED || FAILED_TERMINAL` "다른 합성 PDF 선택" condition at line 518.

- [ ] **Step 4: Run** the core class, `pnpm web:test`, `tsc` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api apps/web
git commit -m "feat(core): DOCUMENT_EXTRACTION revocation terminates review and in-flight documents and deletes their quarantine files

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 12: Deletion order — commit the tombstone first, delete files after commit, clear idempotency/session/capability rows

**Files:**
- Modify: `FoundationLifecycleService.kt:743-770` (`deleteProfile`), `FoundationRepository.kt:1408-1430` (`completeDeletion`)
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `deleteIdempotencyForSubject` (Task 7), `listObjectKeys`.
- Produces: `completeDeletion` also runs `DELETE FROM gc_idempotency WHERE subject_hash = ?`, `DELETE FROM gc_upload_capability c USING gc_document d WHERE d.document_id = c.document_id AND d.subject_id = ?` (before the document delete so the cascade order is explicit), `DELETE FROM gc_session`; file deletion happens in `afterCommit`; the receipt is unchanged.

- [ ] **Step 1: Write the failing test**

```kotlin
    @Test
    fun deletionCommitsTheRowsBeforeTouchingFilesAndClearsIdempotencySessionAndCapabilityRows() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val candidateId = createCandidate(alice, consentId, "delete-order")
        mutate(post("/api/foundation/candidates/$candidateId/confirmation").header("Idempotency-Key", "delete-order-confirm")
            .contentType(MediaType.APPLICATION_JSON).content(json(mapOf("value" to "188"))), alice).andExpect(status().isCreated)
        val subjectHash = FoundationHashing.sha256("foundation-integration-test-pepper-64-characters-minimum-value:synthetic-alice")
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_idempotency WHERE subject_hash = ?", Long::class.java, subjectHash)).isGreaterThan(0L)
        val keys = jdbc.queryForList("SELECT object_key FROM gc_document WHERE subject_id = 'synthetic-alice'", String::class.java)
        // Make the file deletion impossible to perform inside the transaction: lock the file by making the untrusted directory read-only is not
        // portable, so instead observe ordering through the audit sequence: PROFILE_DELETED is written in the same transaction
        // and must exist even when a file is already gone.
        keys.forEach { Files.deleteIfExists(quarantineRoot.resolve("untrusted").resolve(it)) }
        mutate(delete("/api/foundation/profile"), alice).andExpect(status().isOk).andExpect(jsonPath("$.status").value("COMPLETED"))
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_idempotency WHERE subject_hash = ?", Long::class.java, subjectHash)).isZero()
        assertThat(countForSubject("gc_session", "synthetic-alice")).isZero()
        assertThat(count("gc_upload_capability")).isZero()
        assertThat(countForSubject("gc_document", "synthetic-alice")).isZero()
        assertThat(jdbc.queryForObject("SELECT deleted_at IS NOT NULL FROM gc_subject WHERE subject_id = 'synthetic-alice'", Boolean::class.java)).isTrue()
    }

    @Test
    fun aFileDeletionFailureAfterCommitDoesNotUndoTheDeletion() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        createCandidate(alice, consentId, "delete-orphan")
        val approved = Files.list(quarantineRoot.resolve("approved_source")).toList().single()
        // Replace the approved file with a directory of the same name: deleteIfExists throws DirectoryNotEmptyException.
        Files.delete(approved)
        Files.createDirectories(approved.resolve("keep"))
        mutate(delete("/api/foundation/profile"), alice).andExpect(status().isOk)
        assertThat(countForSubject("gc_document", "synthetic-alice")).isZero()
        assertThat(Files.isDirectory(approved)).isTrue() // orphan left for the janitor (Task 23)
        Files.delete(approved.resolve("keep")); Files.delete(approved)
    }
```

- [ ] **Step 2: Run to verify failure** — the second test returns 500 (`deleteAll` throws before the transaction commits); the first leaves idempotency rows.

- [ ] **Step 3: Implement**

Service:

```kotlin
    @Transactional
    fun deleteProfile(principal: FoundationPrincipal): DeletionReceipt {
        val subjectHash = subjectHash(principal.subjectId)
        val objectKeys = repository.listObjectKeys(principal.subjectId)
        audit(principal, "PROFILE_DELETION_REQUESTED", "PROFILE", null, "SUCCESS")
        val deletionId = repository.completeDeletion(principal.subjectId, subjectHash, UUID.randomUUID(), Instant.now(clock))
        repository.insertAudit(subjectHash, null, "PROFILE_DELETED", "PROFILE", deletionId, "SUCCESS", Instant.now(clock))
        if (objectKeys.isNotEmpty()) {
            TransactionSynchronizationManager.registerSynchronization(
                object : TransactionSynchronization {
                    override fun afterCommit() {
                        // Rows are gone; a file that cannot be removed now is an orphan the janitor sweeps.
                        objectKeys.forEach { key -> runCatching { documentStorage.deleteAll(listOf(key)) } }
                    }
                },
            )
        }
        return DeletionReceipt(
            deletionId = deletionId,
            status = "COMPLETED",
            auditEventTypes = repository.listAuditEventTypes(subjectHash),
            rawHealthValuesPresentInAudit = repository.countRawHealthValuesInAudit() > 0,
        )
    }
```

Repository `completeDeletion`: after the `SELECT deletion_id` add, in this order, `DELETE FROM gc_upload_capability c USING gc_document d WHERE d.document_id = c.document_id AND d.subject_id = ?`, the existing `gc_document`/`gc_consent_grant`/`gc_session` deletes, then `DELETE FROM gc_idempotency WHERE subject_hash = ?`, then the `gc_subject` update. `FoundationDocumentStorage.deleteAll` stays `Files.deleteIfExists` per key (it throws on a directory, which the test relies on).

- [ ] **Step 4: Run** the core class → PASS (the existing lifecycle test's `Files.exists(... untrusted ...)).isFalse()` still holds because `afterCommit` runs inside `mockMvc.perform`).

- [ ] **Step 5: Commit**

```bash
git add apps/core-api
git commit -m "fix(core): deletion commits rows first and removes files after commit; clears idempotency, session and capability rows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 13: Hand-labelled layout fixtures and the `handLabelledAccuracy` metric (spec §9)

**Files:**
- Create: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/HandLabelledFixtures.kt`, `HandLabelledRunner.kt`
- Create: `packages/korean-checkup-benchmark/fixtures/hand-labelled/synthetic-hand-nhis-notice/expected.json`, `.../synthetic-hand-hospital-four-column/expected.json`, `.../synthetic-hand-scan-with-invisible-text/expected.json`, `.../README.md`
- Modify: `packages/korean-checkup-benchmark/src/main/kotlin/kr/co/genomecompanion/benchmark/BenchmarkMain.kt`
- Modify: `apps/web/lib/medical-ai/evaluation.ts`, `apps/web/lib/medical-ai/native-text-report.ts`, `apps/web/scripts/native-text-gate.mts`
- Test: `packages/korean-checkup-benchmark/src/test/kotlin/kr/co/genomecompanion/benchmark/HandLabelledFixturesTest.kt` (create), `apps/web/tests/medical-ai-evaluation.test.ts` (existing evaluation test file — if its name differs, add to the file that imports `evaluateMedicalDocumentPipeline`)

**Interfaces:**
- Consumes: `NativeTextExtractionProvider.extract`, `MedicalConceptCatalogue.resolve`, `BenchmarkJson`, `CheckupCorpusGenerator.Companion.fixedTimestamp()`/`FIXED_DOCUMENT_ID`.
- Produces: `object HandLabelledFixtures { val ids: List<String>; fun draw(id: String, font: Path): ByteArray; fun writeAll(out: Path, font: Path): HandLabelledCorpus }` where `data class HandLabelledCorpus(val corpusId: String, val documents: List<HandLabelledDocument>)`, `data class HandLabelledDocument(val documentId: String, val documentSha256: String, val expected: JsonNode)`; `HandLabelledRunner.run(corpusDir): List<NativeTextRun>` (same `medical-document-run.v1` shape); `evaluateHandLabelled(expectedInput, runsInput): HandLabelledReport` in `evaluation.ts` with `{ corpusId, candidateAccuracy, abstentionAccuracy, handLabelledAccuracy, expectedCandidates, matchedCandidates, expectedAbstentions, matchedAbstentions }`; new CLI verb `generate-hand-labelled --out <dir> --font <ttf>`; gate script prints the report and fails below `handLabelledFloor` (a constant in `evaluation.ts`, set in Step 6).

`expected.json` shape (hand-typed, `schemaVersion: "hand-labelled-expectation.v1"`):

```json
{
  "schemaVersion": "hand-labelled-expectation.v1",
  "documentId": "synthetic-hand-nhis-notice",
  "layout": "공단 일반검진 결과통보서형 (2단, 판정 컬럼, 이전 결과 컬럼, 혈압 120/80, 신체계측·혈액·소변 섹션, 머리글·바닥글 날짜)",
  "observedOn": "2026-05-12",
  "candidates": [
    { "label": "신장", "value": "171.2", "unit": "cm", "conceptCode": "height" },
    { "label": "체중", "value": "66.4", "unit": "kg", "conceptCode": "weight" },
    { "label": "혈압(수축기)", "value": "118", "unit": "mmHg", "conceptCode": "systolic-blood-pressure" },
    { "label": "혈압(이완기)", "value": "76", "unit": "mmHg", "conceptCode": "diastolic-blood-pressure" },
    { "label": "혈색소", "value": "14.1", "unit": "g/dL", "conceptCode": "hemoglobin" },
    { "label": "공복혈당", "value": "94", "unit": "mg/dL", "conceptCode": "fasting-glucose" },
    { "label": "총콜레스테롤", "value": "183", "unit": "mg/dL", "conceptCode": "total-cholesterol" },
    { "label": "크레아티닌", "value": "0.9", "unit": "mg/dL", "conceptCode": "creatinine" }
  ],
  "abstentions": [
    { "label": "요단백", "reason": "qualitative" },
    { "label": "혈색소", "reason": "previous_column" },
    { "label": "공복혈당", "reason": "previous_column" },
    { "label": "총콜레스테롤", "reason": "previous_column" }
  ]
}
```

The other two follow the same shape: `synthetic-hand-hospital-four-column` (`항목·결과·단위·참고치` four columns, a page break with the label `총빌리루빈` at the bottom of page 1 continuing to `0.8 mg/dL 0.2-1.2` on page 2, `hs-CRP <0.3 mg/L` → `qualified_value`, glued unit `HbA1c 5.6%`, values chosen unremarkable) and `synthetic-hand-scan-with-invisible-text` (a full-page image plus an invisible text layer in render mode 3 that reads `혈당 999 mg/dL` — the expectation is `candidates: []` and `abstentions: [{ "label": "문서 전체", "reason": "unreadable" }]`; the parser must not trust an invisible text layer). Every text line the fixtures draw is synthetic: institution `예시 건강검진기관`, address `서울특별시 합성 주소`, no name, no phone, no registration number; the PDF starts with `%PDF-1.7\n%GC-SYNTHETIC-ONLY`.

- [ ] **Step 1: Write the expectation files by hand**

Create the three `expected.json` files as above (type them; the `HandLabelledFixturesTest` in Step 2 is the check that the drawn document actually prints what the expectation says). Create `fixtures/hand-labelled/README.md`:

```markdown
# Hand-labelled layout fixtures

Synthetic documents whose layout copies the structure of common Korean check-up sheets and whose
expectations were typed by hand. No file here came from a real document; every value, name and
institution is synthetic (`gc-synthetic-fixture`). The PDF bytes are drawn by
`HandLabelledFixtures.kt` at test/gate time and are never committed. `expected.json` is the
authority for the score `handLabelledAccuracy`; no code generates it.
```

- [ ] **Step 2: Write the failing test**

```kotlin
package kr.co.genomecompanion.benchmark

import com.fasterxml.jackson.databind.JsonNode
import kr.co.genomecompanion.documentworker.NativeTextExtractionProvider
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path


class HandLabelledFixturesTest {
    private val font: Path = BenchmarkFont.path()

    @Test
    fun `draws three synthetic layouts, marks them synthetic and is byte-deterministic`(@TempDir first: Path, @TempDir second: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        assertThat(HandLabelledFixtures.ids).containsExactly("synthetic-hand-nhis-notice", "synthetic-hand-hospital-four-column", "synthetic-hand-scan-with-invisible-text")
        val a = HandLabelledFixtures.writeAll(first, font)
        val b = HandLabelledFixtures.writeAll(second, font)
        assertThat(a.corpusId).matches("synthetic-ko-hand-labelled-[0-9a-f]{16}").isEqualTo(b.corpusId)
        HandLabelledFixtures.ids.forEach { id ->
            val bytes = Files.readAllBytes(first.resolve("$id.pdf"))
            assertThat(String(bytes, 0, 40, Charsets.ISO_8859_1)).contains("%GC-SYNTHETIC-ONLY")
            assertThat(bytes).containsExactly(*Files.readAllBytes(second.resolve("$id.pdf")))
        }
    }

    @Test
    fun `every expectation file is hand-typed, well-formed and names only closed reasons`() {
        HandLabelledFixtures.ids.forEach { id ->
            val expected: JsonNode = HandLabelledFixtures.expectation(id)
            assertThat(expected["schemaVersion"].asText()).isEqualTo("hand-labelled-expectation.v1")
            assertThat(expected["documentId"].asText()).isEqualTo(id)
            expected["abstentions"].forEach { assertThat(it["reason"].asText()).isIn(kr.co.genomecompanion.documentworker.AbstentionReason.CODES) }
            expected["candidates"].forEach { assertThat(it["value"].asText()).matches("^-?(\\d{1,3}(,\\d{3})+|\\d+)(\\.\\d+)?$") }
        }
    }

    @Test
    fun `reports the parser's agreement with the hand-typed expectations without asserting perfection`(@TempDir out: Path) {
        assumeTrue(Files.exists(font), "Pretendard font missing; run pnpm install first")
        HandLabelledFixtures.writeAll(out, font)
        val runs = HandLabelledRunner.run(out)
        assertThat(runs.map { it.documentId }).containsExactlyElementsOf(HandLabelledFixtures.ids)
        val scan = runs.first { it.documentId == "synthetic-hand-scan-with-invisible-text" }
        assertThat(scan.candidates).isEmpty()
        assertThat(scan.abstentions.map { it.reason }).containsExactly("unreadable")
        val notice = runs.first { it.documentId == "synthetic-hand-nhis-notice" }
        // Printed for the evidence file; the TypeScript gate pins the floor. This test only pins the invariant that nothing hallucinated.
        val expectedLabels = HandLabelledFixtures.expectation("synthetic-hand-nhis-notice")["candidates"].map { it["label"].asText() }
        assertThat(notice.candidates.map { it.label }).allMatch { it in expectedLabels }
        println("hand-labelled nhis-notice candidates=${notice.candidates.size}/${expectedLabels.size} abstentions=${notice.abstentions.map { it.reason }}")
    }
}
```

- [ ] **Step 3: Run to verify failure**

Run: `./gradlew.bat :packages:korean-checkup-benchmark:test --tests '*HandLabelledFixturesTest*' --no-daemon` → compilation FAILS (`HandLabelledFixtures` missing).

- [ ] **Step 4: Implement**

`HandLabelledFixtures.kt` (drawing with PDFBox exactly like `CheckupCorpusGenerator`'s pinned document and `Canvas`; reuse `CheckupCorpusGenerator.fixedTimestamp()` and `FIXED_DOCUMENT_ID`):

```kotlin
package kr.co.genomecompanion.benchmark

import com.fasterxml.jackson.databind.JsonNode
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.PDDocumentInformation
import org.apache.pdfbox.pdmodel.PDPage
import org.apache.pdfbox.pdmodel.PDPageContentStream
import org.apache.pdfbox.pdmodel.common.PDRectangle
import org.apache.pdfbox.pdmodel.font.PDFont
import org.apache.pdfbox.pdmodel.font.PDType0Font
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory
import org.apache.pdfbox.pdmodel.graphics.state.RenderingMode
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path

data class HandLabelledDocument(val documentId: String, val documentSha256: String, val expected: JsonNode)
data class HandLabelledCorpus(val corpusId: String, val documents: List<HandLabelledDocument>)

/**
 * Layout-faithful synthetic fixtures (founder decision 3, 2026-09-18): the STRUCTURE of common
 * Korean check-up sheets, drawn in code with synthetic content only. Expectations live in
 * fixtures/hand-labelled/<id>/expected.json and are typed by hand — never generated here.
 */
object HandLabelledFixtures {
    const val CORPUS_ID_PREFIX = "synthetic-ko-hand-labelled-"
    val ids = listOf("synthetic-hand-nhis-notice", "synthetic-hand-hospital-four-column", "synthetic-hand-scan-with-invisible-text")
    private val fixturesRoot: Path = Path.of(System.getenv("GC_HAND_LABELLED_ROOT") ?: "fixtures/hand-labelled")

    fun expectation(id: String): JsonNode = BenchmarkJson.mapper.readTree(fixturesRoot.resolve(id).resolve("expected.json").toFile())

    fun draw(id: String, font: Path): ByteArray = when (id) {
        "synthetic-hand-nhis-notice" -> nhisNotice(font)
        "synthetic-hand-hospital-four-column" -> hospitalFourColumn(font)
        "synthetic-hand-scan-with-invisible-text" -> scanWithInvisibleText(font)
        else -> error("unknown fixture $id")
    }

    fun writeAll(out: Path, font: Path): HandLabelledCorpus {
        Files.createDirectories(out)
        val documents = ids.map { id ->
            val bytes = draw(id, font)
            Files.write(out.resolve("$id.pdf"), bytes)
            HandLabelledDocument(id, "sha256:" + BenchmarkJson.sha256(bytes), expectation(id))
        }
        val corpus = HandLabelledCorpus(
            corpusId = CORPUS_ID_PREFIX + BenchmarkJson.sha256(documents.joinToString("\n") { "${it.documentId} ${it.documentSha256}" }).take(16),
            documents = documents,
        )
        BenchmarkJson.mapper.writerWithDefaultPrettyPrinter().writeValue(out.resolve("hand-labelled.json").toFile(), corpus)
        return corpus
    }

    private fun pinned(): PDDocument = PDDocument().apply {
        documentId = CheckupCorpusGenerator.FIXED_DOCUMENT_ID
        documentInformation = PDDocumentInformation().apply {
            producer = "korean-checkup-benchmark hand-labelled"
            creationDate = CheckupCorpusGenerator.fixedTimestamp()
            modificationDate = CheckupCorpusGenerator.fixedTimestamp()
        }
    }

    private fun save(document: PDDocument): ByteArray {
        val raw = ByteArrayOutputStream().also { document.save(it) }.toByteArray()
        // Insert the synthetic marker comment right after the header line, as the browser fixture does.
        val header = "%PDF-1.7\n".toByteArray(Charsets.ISO_8859_1)
        val marker = "%GC-SYNTHETIC-ONLY\n".toByteArray(Charsets.ISO_8859_1)
        val newline = raw.indexOf('\n'.code.toByte())
        return raw.copyOfRange(0, newline + 1) + marker + raw.copyOfRange(newline + 1, raw.size)
    }

    private class Sheet(document: PDDocument, val font: PDFont) {
        var page: PDPage = PDPage(PDRectangle.A4).also { document.addPage(it) }
        private val document = document
        var stream = PDPageContentStream(document, page)
        var cursor = page.mediaBox.height - 56f

        fun text(columns: List<Pair<Float, String>>, size: Float = 10.5f, mode: RenderingMode = RenderingMode.FILL) {
            columns.forEach { (x, value) ->
                stream.beginText(); stream.setFont(font, size); stream.setRenderingMode(mode)
                stream.newLineAtOffset(x, cursor); stream.showText(value); stream.endText()
            }
            cursor -= 20f
        }

        fun rule() { stream.setStrokingColor(Color.GRAY); stream.moveTo(48f, cursor + 6f); stream.lineTo(page.mediaBox.width - 48f, cursor + 6f); stream.stroke() }

        fun newPage() {
            stream.close()
            page = PDPage(PDRectangle.A4).also { document.addPage(it) }
            stream = PDPageContentStream(document, page)
            cursor = page.mediaBox.height - 56f
        }

        fun close() = stream.close()
    }

    /** 공단 일반검진 결과통보서형: header date, 2-column body (this time / previous), 판정 column, sections, footer date. */
    private fun nhisNotice(font: Path): ByteArray = pinned().use { document ->
        val sheet = Sheet(document, PDType0Font.load(document, font.toFile()))
        sheet.text(listOf(48f to "일반건강검진 결과통보서 (예시 · 합성)"), 14f)
        sheet.text(listOf(48f to "검진기관 예시 건강검진기관", 330f to "검진일 2026년 5월 12일"))
        sheet.text(listOf(48f to "주소 서울특별시 합성 주소"))
        sheet.rule()
        sheet.text(listOf(48f to "[신체계측]"))
        sheet.text(listOf(48f to "항목", 200f to "이번 결과", 330f to "이전 결과", 460f to "판정"))
        sheet.text(listOf(48f to "신장", 200f to "171.2 cm", 330f to "170.9 cm"))
        sheet.text(listOf(48f to "체중", 200f to "66.4 kg", 330f to "67.0 kg"))
        sheet.text(listOf(48f to "혈압", 200f to "118/76 mmHg", 330f to "121/79 mmHg"))
        sheet.text(listOf(48f to "[혈액검사]"))
        sheet.text(listOf(48f to "혈색소", 200f to "14.1 g/dL", 330f to "14.3 g/dL"))
        sheet.text(listOf(48f to "공복혈당", 200f to "94 mg/dL", 330f to "97 mg/dL"))
        sheet.text(listOf(48f to "총콜레스테롤", 200f to "183 mg/dL", 330f to "179 mg/dL"))
        sheet.text(listOf(48f to "크레아티닌", 200f to "0.9 mg/dL"))
        sheet.text(listOf(48f to "[소변검사]"))
        sheet.text(listOf(48f to "요단백", 200f to "음성", 330f to "음성"))
        sheet.rule()
        sheet.text(listOf(48f to "발행일 2026-05-19", 330f to "예시 건강검진기관 · 합성 문서"), 9f)
        sheet.close()
        save(document)
    }

    /** 병원 종합검진형: 항목·결과·단위·참고치, a label at the page bottom continued on page 2, `<` value, glued unit. */
    private fun hospitalFourColumn(font: Path): ByteArray = pinned().use { document ->
        val sheet = Sheet(document, PDType0Font.load(document, font.toFile()))
        sheet.text(listOf(48f to "종합검진 결과표 (예시 · 합성)"), 14f)
        sheet.text(listOf(48f to "Report Date: 2026-06-20", 330f to "검사일: 2026-06-18"))
        sheet.rule()
        sheet.text(listOf(48f to "항목", 260f to "결과", 340f to "단위", 420f to "참고치"))
        sheet.text(listOf(48f to "AST", 260f to "23", 340f to "U/L", 420f to "0-40"))
        sheet.text(listOf(48f to "ALT", 260f to "19", 340f to "U/L", 420f to "0-41"))
        sheet.text(listOf(48f to "HbA1c", 260f to "5.6%", 420f to "4.0-6.0"))
        sheet.text(listOf(48f to "hs-CRP", 260f to "<0.3", 340f to "mg/L", 420f to "0-3"))
        sheet.text(listOf(48f to "총단백", 260f to "7.1", 340f to "g/dL", 420f to "6.4-8.3"))
        sheet.text(listOf(48f to "총빌리루빈"))
        sheet.newPage()
        sheet.text(listOf(260f to "0.8", 340f to "mg/dL", 420f to "0.2-1.2"))
        sheet.text(listOf(48f to "요산", 260f to "5.1", 340f to "mg/dL", 420f to "3.0-7.0"))
        sheet.close()
        save(document)
    }

    /** Scan + invisible OCR layer: a picture of a sheet with render-mode-3 text nobody can see. The parser must abstain. */
    private fun scanWithInvisibleText(font: Path): ByteArray = pinned().use { document ->
        val page = PDPage(PDRectangle.A4).also { document.addPage(it) }
        val image = BufferedImage(1240, 1754, BufferedImage.TYPE_INT_RGB)
        val graphics = image.createGraphics()
        graphics.color = Color.WHITE; graphics.fillRect(0, 0, image.width, image.height)
        graphics.color = Color.DARK_GRAY; graphics.drawString("SYNTHETIC SCAN - NO REAL DATA", 120, 160)
        repeat(10) { row -> graphics.drawRect(120, 260 + row * 90, 1000, 60) }
        graphics.dispose()
        PDPageContentStream(document, page).use { stream ->
            stream.drawImage(LosslessFactory.createFromImage(document, image), 0f, 0f, page.mediaBox.width, page.mediaBox.height)
            val pdfFont = PDType0Font.load(document, font.toFile())
            stream.beginText(); stream.setFont(pdfFont, 10f); stream.setRenderingMode(RenderingMode.NEITHER)
            stream.newLineAtOffset(60f, 700f); stream.showText("검사일 2026-04-02"); stream.endText()
            stream.beginText(); stream.setFont(pdfFont, 10f); stream.setRenderingMode(RenderingMode.NEITHER)
            stream.newLineAtOffset(60f, 680f); stream.showText("혈당 999 mg/dL"); stream.endText()
        }
        save(document)
    }
}
```

For the invisible layer to be treated as unreadable, `TokenCollectingStripper.writeString` (Task 3) must skip glyphs whose `TextPosition.textMatrix`-independent rendering mode is invisible — PDFBox exposes it as `graphicsState.textState.renderingMode` during `processTextPosition`; override `processTextPosition(text)` in the stripper and drop the position when `getGraphicsState().getTextState().getRenderingMode() == RenderingMode.NEITHER`. With no visible tokens the document yields `unreadable` (`문서 전체`), which is exactly the expectation.

`HandLabelledRunner.kt`: identical to `NativeTextRunner.run` but reads `hand-labelled.json`, uses `runId = "run-native-text-" + id.removePrefix("synthetic-")` and `documentType = "health-screening-lab-report"`; factor the per-document mapping of `NativeTextRunner` into an `internal fun NativeTextRunner.toRun(documentId, documentType, bytes, stamp, model): NativeTextRun` and call it from both.

`BenchmarkMain.kt`: add

```kotlin
        "generate-hand-labelled" -> {
            val out = Path.of(options.getValue("--out"))
            val font = Path.of(options.getValue("--font"))
            val corpus = HandLabelledFixtures.writeAll(out, font)
            println("generated ${corpus.documents.size} hand-labelled synthetic documents into $out (corpusId ${corpus.corpusId})")
        }
        "run-hand-labelled" -> {
            val corpusDir = Path.of(options.getValue("--corpus"))
            val out = Path.of(options.getValue("--out"))
            BenchmarkJson.mapper.writerWithDefaultPrettyPrinter().writeValue(out.toFile(), HandLabelledRunner.run(corpusDir))
        }
```

and the usage line. Because the CLI runs with `--project-dir` from the repository root, `fixturesRoot` must resolve against the module: in `build.gradle.kts` of the benchmark add `tasks.named<JavaExec>("run") { systemProperty("gc.handLabelledRoot", projectDir.resolve("fixtures/hand-labelled").absolutePath) }` and `tasks.withType<Test> { systemProperty("gc.handLabelledRoot", projectDir.resolve("fixtures/hand-labelled").absolutePath) }`, and read `System.getProperty("gc.handLabelledRoot")` first in `fixturesRoot`.

`evaluation.ts` — append:

```ts
export const handLabelledExpectationSchema = z.strictObject({
  schemaVersion: z.literal("hand-labelled-expectation.v1"),
  documentId: z.string().regex(/^synthetic-hand-[a-z0-9-]+$/),
  layout: z.string().min(1).max(240),
  observedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  candidates: z.array(z.strictObject({ label: z.string().min(1).max(80), value: z.string().min(1).max(64), unit: z.string().min(1).max(32), conceptCode: z.string().regex(/^[a-z0-9-]{1,64}$/).nullable().optional() })).max(100),
  abstentions: z.array(z.strictObject({ label: z.string().min(1).max(80), reason: extractionAbstentionSchema.shape.reason })).max(100),
});

export const handLabelledCorpusSchema = z.strictObject({
  corpusId: z.string().regex(/^synthetic-ko-hand-labelled-[0-9a-f]{16}$/),
  documents: z.array(z.strictObject({ documentId: z.string(), documentSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/), expected: handLabelledExpectationSchema })).min(1),
});

export type HandLabelledReport = {
  schemaVersion: "hand-labelled-report.v1";
  corpusId: string;
  expectedCandidates: number;
  matchedCandidates: number;
  expectedAbstentions: number;
  matchedAbstentions: number;
  hallucinatedCandidates: number;
  candidateAccuracy: number;
  abstentionAccuracy: number;
  handLabelledAccuracy: number;
  floor: number;
  passed: boolean;
};

/** Regression floor: the first measured value from docs/status/2026-09-18/wave7.md, never rounded up. */
export const handLabelledFloor = 0;

export function evaluateHandLabelled(corpusInput: unknown, runsInput: readonly unknown[], floor = handLabelledFloor): HandLabelledReport {
  const corpus = handLabelledCorpusSchema.parse(corpusInput);
  const runs = runsInput.map((run) => medicalDocumentRunSchema.parse(run));
  let expectedCandidates = 0; let matchedCandidates = 0; let expectedAbstentions = 0; let matchedAbstentions = 0; let hallucinated = 0;
  for (const document of corpus.documents) {
    const run = runs.find((candidate) => candidate.documentId === document.documentId);
    if (!run) throw new Error(`missing run for ${document.documentId}`);
    if (run.documentSha256 !== document.documentSha256) throw new Error(`document binding mismatch for ${document.documentId}`);
    const expected = document.expected;
    expectedCandidates += expected.candidates.length;
    expectedAbstentions += expected.abstentions.length;
    for (const candidate of expected.candidates) {
      const hit = run.candidates.find((actual) => actual.label === candidate.label && actual.value === candidate.value && actual.unit === candidate.unit
        && (expected.observedOn === null || actual.observedAt === expected.observedOn)
        && (candidate.conceptCode === undefined || (actual.conceptCode ?? null) === candidate.conceptCode));
      if (hit) matchedCandidates += 1;
    }
    for (const actual of run.candidates) {
      if (!expected.candidates.some((candidate) => candidate.label === actual.label && candidate.value === actual.value && candidate.unit === actual.unit)) hallucinated += 1;
    }
    for (const abstention of expected.abstentions) {
      if (run.abstentions.some((actual) => actual.label === abstention.label && actual.reason === abstention.reason)) matchedAbstentions += 1;
    }
  }
  const candidateAccuracy = ratio(matchedCandidates, expectedCandidates);
  const abstentionAccuracy = ratio(matchedAbstentions, expectedAbstentions);
  const handLabelledAccuracy = ratio(matchedCandidates + matchedAbstentions, expectedCandidates + expectedAbstentions);
  return {
    schemaVersion: "hand-labelled-report.v1", corpusId: corpus.corpusId, expectedCandidates, matchedCandidates, expectedAbstentions, matchedAbstentions,
    hallucinatedCandidates: hallucinated, candidateAccuracy, abstentionAccuracy, handLabelledAccuracy, floor,
    passed: handLabelledAccuracy >= floor && hallucinated === 0,
  };
}
```

(`import { z } from "zod"` and `extractionAbstentionSchema` from `./contracts.ts`.) `native-text-report.ts` gains a second table titled `## Hand-labelled layouts — <corpusId>` with the eight numbers and the floor, and renames the row `Concept code per the alias and unit rule` to `Concept code: runner and gold agree (both from the catalogue rule)`. `native-text-gate.mts`: after the existing gate, run `generate-hand-labelled --out <corpusDir>/hand-labelled --font <font>` and `run-hand-labelled --corpus <that dir> --out <that dir>/runs.json`, call `evaluateHandLabelled`, print it, and set `process.exitCode = 1` when `!report.passed`. Add a vitest case in the evaluation test file that scores a two-document in-memory corpus (one all-matched, one half-matched) and expects `handLabelledAccuracy` of `0.75` and `passed` false when `floor = 0.8`.

- [ ] **Step 5: Run**

`./gradlew.bat :packages:korean-checkup-benchmark:test --no-daemon` → PASS (note the printed `hand-labelled nhis-notice candidates=…`). `pnpm web:test` → PASS. `pnpm medical-ai:native-text-gate` → the first block unchanged (`synthetic-ko-checkup-r2-50ed23041bb4af1d`, `passed: true`), then the hand-labelled JSON with its `handLabelledAccuracy`.

- [ ] **Step 6: Pin the floor to the measured value**

Copy the printed `handLabelledAccuracy` (for example `0.8571428571428571`) into `handLabelledFloor` in `evaluation.ts` **exactly** (never rounded up) and into `docs/status/2026-09-18/wave7.md` (Task 26 creates the file; create it now with only the heading `# Wave 7 evidence — backend hardening (2026-09-18)` and the line `hand-labelled corpus <corpusId>: handLabelledAccuracy = <value> (candidates m/n, abstentions m/n) — regression floor`). Re-run the gate → `passed: true`.

- [ ] **Step 7: Commit**

```bash
git add packages/korean-checkup-benchmark apps/web/lib apps/web/scripts apps/web/tests docs/status/2026-09-18/wave7.md
git commit -m "feat(benchmark): hand-labelled layout fixtures scored by handLabelledAccuracy with a measured regression floor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**End of PR 7a.** Run every gate in Global Constraints, write the 7a section of `docs/status/2026-09-18/wave7.md` (evidence table with the exact last lines of each command), open PR `codex/wave13-backend-hardening` → `codex/wave11-alive-home` titled `Wave 7a — parser honesty, value contract, idempotency/concurrency/state, hand-labelled fixtures`.

---

## ══════════ PR boundary: Tasks 14–26 are PR 7b (spec §5–§8), branch `codex/wave13b-backend-hardening` stacked on 7a ══════════

Create the branch from the 7a head: `git switch -c codex/wave13b-backend-hardening`. Every 7b command runs with the 7a code present.

---
### Task 14: Request-body caps and streamed upload

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/RequestBodyLimitFilter.kt`
- Modify: `FoundationLifecycleController.kt:200-222` (`uploadDocument`), `FoundationLifecycleService.kt:393-450` (`uploadDocument`), `FoundationDocumentStorage.kt` (`putUntrusted` streaming overload)
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`, `FoundationDocumentStorageTest.kt`

**Interfaces:**
- Consumes: `FoundationHashing.sha256(ByteArray)`.
- Produces: `RequestBodyLimitFilter` (`OncePerRequestFilter`, `@Order(Ordered.HIGHEST_PRECEDENCE + 10)`) rejecting `Content-Length > limit` or a chunked body that exceeds the limit while being read, with `413 {"code":"payload_too_large"}` — limit `262_144` for `/api/foundation/**` except the upload PUT (`/api/foundation/documents/{id}/content`, limit `10_485_760`), `4_893_356` for `/internal/document-boundary/**`; `FoundationDocumentStorage.putUntrusted(documentId: UUID, content: InputStream, expectedLength: Long, expectedSha256: String): StoredObjectWrite` streams to `<key>.part` with a `DigestInputStream`, verifies length and digest, then atomically moves to `<key>` (or compares to an existing file byte-by-byte through streams); the service's `uploadDocument(principal, documentId, capabilityId, rawCapability, content: InputStream, declaredLength: Long)`.

- [ ] **Step 1: Write the failing tests**

Integration:

```kotlin
    @Test
    fun oversizedBodiesAre413BeforeAnyHandlerRuns() {
        val alice = login("synthetic-alice")
        val big = "{\"value\":\"" + "1".repeat(262_144) + "\"}"
        mutate(post("/api/foundation/candidates/${UUID.randomUUID()}/confirmation").header("Idempotency-Key", "too-big-json")
            .contentType(MediaType.APPLICATION_JSON).content(big), alice)
            .andExpect(status().isPayloadTooLarge).andExpect(jsonPath("$.code").value("payload_too_large"))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "too-big-upload")
        val capability = uploadCapabilities.getValue(documentId)
        mutate(put("/api/foundation/documents/$documentId/content").header("X-GC-Upload-Capability-Id", capability.capabilityId)
            .header("X-GC-Upload-Capability", capability.rawToken).contentType(MediaType.APPLICATION_PDF).content(ByteArray(10_485_761)), alice)
            .andExpect(status().isPayloadTooLarge)
        assertThat(count("gc_audit_event")).isGreaterThan(0)
    }

    @Test
    fun uploadIsStreamedToDiskAndVerifiedWithoutAHeapCopy() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "stream-upload")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        assertThat(Files.list(quarantineRoot.resolve("untrusted")).filter { it.toString().endsWith(".part") }.count()).isZero()
        assertThat(Files.readAllBytes(quarantineRoot.resolve("untrusted").resolve("$documentId.pdf"))).containsExactly(*fixturePdf)
        // Wrong bytes of the right length: rejected, and no partial file survives.
        val other = requestDocument(alice, consentId, januaryFixturePdf, "stream-upload-2")
        val capability = uploadCapabilities.getValue(other)
        mutate(put("/api/foundation/documents/$other/content").header("X-GC-Upload-Capability-Id", capability.capabilityId)
            .header("X-GC-Upload-Capability", capability.rawToken).contentType(MediaType.APPLICATION_PDF)
            .content(ByteArray(januaryFixturePdf.size) { 'x'.code.toByte() }), alice)
            .andExpect(status().isBadRequest).andExpect(jsonPath("$.code").value("content_digest_mismatch"))
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$other.pdf"))).isFalse()
        assertThat(Files.list(quarantineRoot.resolve("untrusted")).filter { it.toString().endsWith(".part") }.count()).isZero()
    }
```

`FoundationDocumentStorageTest.kt`:

```kotlin
    @Test
    fun `streams an upload into place and removes the part file on a digest mismatch`() {
        val storage = FoundationDocumentStorage(properties(root))
        val bytes = "%PDF-1.7\nsynthetic stream fixture\n%%EOF\n".toByteArray()
        val id = UUID.randomUUID()
        val stored = storage.putUntrusted(id, bytes.inputStream(), bytes.size.toLong(), FoundationHashing.sha256(bytes))
        assertThat(stored.createdNew).isTrue()
        assertThat(Files.readAllBytes(root.resolve("untrusted").resolve("$id.pdf"))).containsExactly(*bytes)
        val other = UUID.randomUUID()
        assertThatThrownBy { storage.putUntrusted(other, bytes.inputStream(), bytes.size.toLong(), "0".repeat(64)) }
            .isInstanceOf(FoundationBadRequestException::class.java).hasMessage("content_digest_mismatch")
        assertThat(Files.exists(root.resolve("untrusted").resolve("$other.pdf"))).isFalse()
        assertThat(Files.exists(root.resolve("untrusted").resolve("$other.pdf.part"))).isFalse()
    }
```

(reuse the file's existing `properties(root)` helper; if it has another name, use that one.)

- [ ] **Step 2: Run to verify failure** — the JSON case returns 400 `request_body_invalid`/`request_invalid`, not 413; the storage overload does not compile.

- [ ] **Step 3: Implement**

`RequestBodyLimitFilter.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import jakarta.servlet.FilterChain
import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.io.IOException
import java.nio.charset.StandardCharsets

/** Rejects a declared or actual body above the route's cap with 413 before any handler reads it. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class RequestBodyLimitFilter : OncePerRequestFilter() {
    companion object {
        const val JSON_LIMIT = 262_144L
        const val UPLOAD_LIMIT = 10_485_760L
        const val WORKER_LIMIT = 4_893_356L
        private val uploadPath = Regex("^/api/foundation/documents/[0-9a-f-]{36}/content$")
    }

    class BodyTooLargeException : IOException("payload_too_large")

    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        !(request.requestURI.startsWith("/api/foundation") || request.requestURI.startsWith("/internal/document-boundary"))

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        val limit = when {
            request.requestURI.startsWith("/internal/document-boundary") -> WORKER_LIMIT
            request.method == "PUT" && uploadPath.matches(request.requestURI) -> UPLOAD_LIMIT
            else -> JSON_LIMIT
        }
        if (request.contentLengthLong > limit) return reject(response)
        val bounded = object : HttpServletRequestWrapper(request) {
            override fun getInputStream(): ServletInputStream = BoundedServletInputStream(request.inputStream, limit)
        }
        try {
            filterChain.doFilter(bounded, response)
        } catch (exception: Exception) {
            if (generateSequence<Throwable>(exception) { it.cause }.any { it is BodyTooLargeException } && !response.isCommitted) reject(response) else throw exception
        }
    }

    private fun reject(response: HttpServletResponse) {
        response.reset()
        response.status = 413
        response.contentType = MediaType.APPLICATION_PROBLEM_JSON_VALUE
        response.characterEncoding = StandardCharsets.UTF_8.name()
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
        response.writer.write("""{"code":"payload_too_large"}""")
    }

    private class BoundedServletInputStream(private val delegate: ServletInputStream, private val limit: Long) : ServletInputStream() {
        private var consumed = 0L
        override fun read(): Int = delegate.read().also { if (it >= 0) count(1) }
        override fun read(b: ByteArray, off: Int, len: Int): Int = delegate.read(b, off, len).also { if (it > 0) count(it.toLong()) }
        private fun count(bytes: Long) { consumed += bytes; if (consumed > limit) throw BodyTooLargeException() }
        override fun isFinished(): Boolean = delegate.isFinished
        override fun isReady(): Boolean = delegate.isReady
        override fun setReadListener(listener: ReadListener?) = delegate.setReadListener(listener)
        override fun available(): Int = delegate.available()
        override fun close() = delegate.close()
    }
}
```

Spring wraps a reading `IOException` into `HttpMessageNotReadableException` (caught by the advice as 400) — so `FoundationProblemAdvice.unreadable` must first check the cause chain for `BodyTooLargeException` and answer 413 `payload_too_large`; add that branch.

Controller `uploadDocument`: drop the `readNBytes` buffer:

```kotlin
        val declaredLength = request.contentLengthLong
        if (declaredLength !in 64..10_485_760) throw FoundationBadRequestException("document_size_invalid")
        return ResponseEntity.ok().cacheControlNoStore()
            .body(service.uploadDocument(request.foundationPrincipal(), documentId, capabilityId, rawCapability, request.inputStream, declaredLength))
```

Service `uploadDocument(…, content: InputStream, declaredLength: Long)`: checks `declaredLength == capability.expectedLength && declaredLength == document.expectedLength` (else `content_length_mismatch`), then `val stored = documentStorage.putUntrusted(documentId, content, declaredLength, capability.expectedSha256)` — the storage throws `content_length_mismatch`/`content_digest_mismatch`; the replay branch (`document.status != "UPLOAD_PENDING"`) compares `stored.descriptor.sha256` to `document.sha256`.

Storage:

```kotlin
    fun putUntrusted(documentId: UUID, content: InputStream, expectedLength: Long, expectedSha256: String): StoredObjectWrite {
        val key = "$documentId.pdf"
        val path = resolve(StorageTrustZone.UNTRUSTED, key)
        Files.createDirectories(path.parent)
        val part = path.resolveSibling("$key.part")
        val digest = MessageDigest.getInstance("SHA-256")
        var written = 0L
        try {
            Files.newOutputStream(part, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE).use { output ->
                val buffer = ByteArray(65_536)
                while (true) {
                    val read = content.read(buffer)
                    if (read < 0) break
                    written += read
                    if (written > expectedLength) throw FoundationBadRequestException("content_length_mismatch")
                    digest.update(buffer, 0, read)
                    output.write(buffer, 0, read)
                }
            }
            if (written != expectedLength) throw FoundationBadRequestException("content_length_mismatch")
            val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
            if (!FoundationHashing.constantTimeHexEquals(actual, expectedSha256)) throw FoundationBadRequestException("content_digest_mismatch")
            if (Files.exists(path)) {
                if (!sameBytes(path, part)) throw FoundationConflictException("upload_overwrite_denied")
                return StoredObjectWrite(ObjectDescriptor(StorageTrustZone.UNTRUSTED, key, FoundationHashing.sha256("UNTRUSTED:$key:$actual"), written, actual), createdNew = false)
            }
            Files.move(part, path, StandardCopyOption.ATOMIC_MOVE)
            return StoredObjectWrite(ObjectDescriptor(StorageTrustZone.UNTRUSTED, key, FoundationHashing.sha256("UNTRUSTED:$key:$actual"), written, actual), createdNew = true)
        } finally {
            Files.deleteIfExists(part)
        }
    }

    private fun sameBytes(a: Path, b: Path): Boolean = Files.mismatch(a, b) == -1L
```

Keep the old `putUntrusted(documentId, ByteArray)` delegating to the stream version (`content.inputStream(), content.size.toLong(), FoundationHashing.sha256(content)`) because the storage test and no other caller uses it — then delete it if `grep -rn "putUntrusted(" apps/core-api/src` shows only the stream call sites.

- [ ] **Step 4: Run** the core class and `FoundationDocumentStorageTest` → PASS; `pnpm foundation:e2e` → `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api
git commit -m "feat(core): 256 KB JSON and 4.9 MB worker body caps, streamed 10 MB upload without a heap copy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 15: Session limiter — per-subject/IP token bucket, 5-failure lock, silent unknown subjects, active-subject demo capacity

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/SessionRateLimiter.kt`
- Modify: `FoundationProperties.kt`, `FoundationLifecycleController.kt` (`createSession`), `FoundationLifecycleService.kt:186-211`, `FoundationRepository.kt:284-298` (`reserveDemoBootstrap`), `application.yml`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/SessionRateLimiterTest.kt` (create), `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `Clock`.
- Produces: `FoundationProperties.sessionRateLimitPerMinute: Int = 10`, `sessionFailureLockThreshold: Int = 5`, `sessionFailureLockDuration: Duration = Duration.ofMinutes(15)`; `class SessionRateLimiter(properties, clock) { fun tryAcquire(subjectKey: String, ipKey: String): Boolean; fun isLocked(subjectKey, ipKey): Boolean; fun recordFailure(subjectKey, ipKey); fun recordSuccess(subjectKey, ipKey); fun clear() }` (in-memory `ConcurrentHashMap`, per-process — the hosted profile must document that a shared store is a later gate); `createSession(subjectId, credential, clientIp)`; error `429 rate_limited` (existing handler) and `429 login_locked` (new `FoundationRateLimitedException(code)`); `reserveDemoBootstrap` counts `deleted_at IS NULL` for capacity.

- [ ] **Step 1: Write the failing tests**

`SessionRateLimiterTest.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset


class SessionRateLimiterTest {
    private class MutableClock(var now: Instant) : Clock() {
        override fun getZone() = ZoneOffset.UTC
        override fun withZone(zone: java.time.ZoneId) = this
        override fun instant() = now
    }

    private fun properties(limit: Int = 10) = FoundationProperties(sessionRateLimitPerMinute = limit)

    @Test
    fun `allows ten attempts per minute per key and refills after a minute`() {
        val clock = MutableClock(Instant.parse("2026-09-18T00:00:00Z"))
        val limiter = SessionRateLimiter(properties(), clock)
        repeat(10) { assertThat(limiter.tryAcquire("subject-a", "10.0.0.1")).isTrue() }
        assertThat(limiter.tryAcquire("subject-a", "10.0.0.1")).isFalse()
        assertThat(limiter.tryAcquire("subject-b", "10.0.0.2")).isTrue()
        // The IP bucket is shared: subject-b from the same IP as subject-a is already exhausted.
        assertThat(limiter.tryAcquire("subject-b", "10.0.0.1")).isFalse()
        clock.now = clock.now.plus(Duration.ofMinutes(1))
        assertThat(limiter.tryAcquire("subject-a", "10.0.0.1")).isTrue()
    }

    @Test
    fun `locks a key for fifteen minutes after five failures and clears on success`() {
        val clock = MutableClock(Instant.parse("2026-09-18T00:00:00Z"))
        val limiter = SessionRateLimiter(properties(1000), clock)
        repeat(4) { limiter.recordFailure("subject-a", "10.0.0.1") }
        assertThat(limiter.isLocked("subject-a", "10.0.0.1")).isFalse()
        limiter.recordFailure("subject-a", "10.0.0.1")
        assertThat(limiter.isLocked("subject-a", "10.0.0.1")).isTrue()
        assertThat(limiter.isLocked("subject-a", "10.0.0.9")).isTrue()   // subject key locked
        assertThat(limiter.isLocked("subject-z", "10.0.0.1")).isTrue()   // ip key locked
        clock.now = clock.now.plus(Duration.ofMinutes(15))
        assertThat(limiter.isLocked("subject-a", "10.0.0.1")).isFalse()
        limiter.recordFailure("subject-a", "10.0.0.1")
        limiter.recordSuccess("subject-a", "10.0.0.1")
        repeat(4) { limiter.recordFailure("subject-a", "10.0.0.1") }
        assertThat(limiter.isLocked("subject-a", "10.0.0.1")).isFalse()
    }
}
```

Integration:

```kotlin
    @Test
    fun fiveWrongCredentialsLockTheSubjectAndAnUnknownSubjectLeavesNoAuditRow() {
        fun attempt(subject: String, credential: String) = mockMvc.perform(
            post("/api/foundation/session").header(HttpHeaders.ORIGIN, allowedOrigin).contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("subjectId" to subject, "credential" to credential))),
        )
        attempt("synthetic-nobody", "definitely-not-a-configured-credential-000").andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("local_identity_denied"))
        assertThat(count("gc_audit_event")).isZero()
        repeat(5) { attempt("synthetic-bob", "wrong-credential-value-with-32-characters").andExpect(status().isForbidden) }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM gc_audit_event WHERE event_type = 'LOCAL_IDENTITY_DENIED'", Long::class.java)).isEqualTo(5L)
        attempt("synthetic-bob", bobCredential).andExpect(status().isTooManyRequests).andExpect(jsonPath("$.code").value("login_locked"))
            .andExpect(header().string("Retry-After", "900"))
        sessionRateLimiter.clear()
        attempt("synthetic-bob", bobCredential).andExpect(status().isCreated)
    }
```

Add `@Autowired private lateinit var sessionRateLimiter: SessionRateLimiter` and `sessionRateLimiter.clear()` in `@BeforeEach`; add `registry.add("gc.foundation.session-rate-limit-per-minute") { "10000" }` to the registry. Change `exhaustedDemoCapacityDoesNotPromiseThatWaitingWillRecoverIt`: the 1000 inserted subjects must be **active** (`deleted_at NULL`) to exhaust capacity; add a second assertion that after `UPDATE gc_subject SET deleted_at = CURRENT_TIMESTAMP WHERE subject_id = 'synthetic-demo-retired-1'` the next demo-session is 201 (capacity returned). Rename the test `demoCapacityCountsActiveSubjectsAndReturnsOnDeletion`.

- [ ] **Step 2: Run to verify failure** — `SessionRateLimiterTest` does not compile; the integration test finds an audit row for `synthetic-nobody`.

- [ ] **Step 3: Implement**

`SessionRateLimiter.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/**
 * In-memory limiter for POST /session: a per-key bucket of N attempts per minute and a lock after
 * five failures. Keys are a subject hash and a client IP; neither is logged. Per process only — a
 * hosted deployment with several replicas needs a shared store (recorded as a hosted gate).
 */
@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class SessionRateLimiter(private val properties: FoundationProperties, private val clock: Clock) {
    private class Bucket(var windowStart: Instant, var count: Int)
    private class Failures(var count: Int, var lockedUntil: Instant?)

    private val buckets = ConcurrentHashMap<String, Bucket>()
    private val failures = ConcurrentHashMap<String, Failures>()

    fun tryAcquire(subjectKey: String, ipKey: String): Boolean = acquire("s:$subjectKey") and acquire("i:$ipKey")

    fun isLocked(subjectKey: String, ipKey: String): Boolean = locked("s:$subjectKey") || locked("i:$ipKey")

    fun recordFailure(subjectKey: String, ipKey: String) { fail("s:$subjectKey"); fail("i:$ipKey") }

    fun recordSuccess(subjectKey: String, ipKey: String) { failures.remove("s:$subjectKey"); failures.remove("i:$ipKey") }

    fun clear() { buckets.clear(); failures.clear() }

    private fun acquire(key: String): Boolean {
        val now = Instant.now(clock)
        var allowed = false
        buckets.compute(key) { _, existing ->
            val bucket = existing?.takeIf { it.windowStart.plusSeconds(60).isAfter(now) } ?: Bucket(now, 0)
            if (bucket.count < properties.sessionRateLimitPerMinute) { bucket.count += 1; allowed = true }
            bucket
        }
        return allowed
    }

    private fun locked(key: String): Boolean {
        val until = failures[key]?.lockedUntil ?: return false
        if (until.isAfter(Instant.now(clock))) return true
        failures.remove(key)
        return false
    }

    private fun fail(key: String) {
        val now = Instant.now(clock)
        failures.compute(key) { _, existing ->
            val state = existing ?: Failures(0, null)
            state.count += 1
            if (state.count >= properties.sessionFailureLockThreshold) { state.lockedUntil = now.plus(properties.sessionFailureLockDuration); state.count = 0 }
            state
        }
    }
}
```

`FoundationProperties`: add `val sessionRateLimitPerMinute: Int = 10`, `val sessionFailureLockThreshold: Int = 5`, `val sessionFailureLockDuration: Duration = Duration.ofMinutes(15)`, `val workerRateLimitPerMinute: Int = 600` (Task 17) with `require(sessionRateLimitPerMinute in 1..100_000)` etc. in `validateEnabledConfiguration`. `application.yml`: `session-rate-limit-per-minute: ${GC_SESSION_RATE_LIMIT_PER_MINUTE:10}`, `worker-rate-limit-per-minute: ${GC_WORKER_RATE_LIMIT_PER_MINUTE:600}`. `playwright.foundation.config.ts` core env: `GC_SESSION_RATE_LIMIT_PER_MINUTE: "10000"`, `GC_WORKER_RATE_LIMIT_PER_MINUTE: "100000"`.

`FoundationRateLimitedException(val code: String = "rate_limited", val retryAfterSeconds: Long = 60)`; the controller handler uses both fields. Controller `createSession(@Valid @RequestBody request, http: HttpServletRequest)` passes `http.remoteAddr`. Service:

```kotlin
    @Transactional
    fun createSession(subjectId: String, credential: String, clientIp: String): IssuedFoundationSession {
        if (!subjectPattern.matches(subjectId)) throw FoundationBadRequestException("synthetic_subject_required")
        val subjectKey = subjectHash(subjectId)
        if (rateLimiter.isLocked(subjectKey, clientIp)) throw FoundationRateLimitedException("login_locked", properties.sessionFailureLockDuration.seconds)
        if (!rateLimiter.tryAcquire(subjectKey, clientIp)) throw FoundationRateLimitedException()
        val expectedCredentialHash = properties.localIdentities.firstOrNull { it.subjectId == subjectId }?.credentialSha256
        if (expectedCredentialHash == null) {
            // Unknown subject: count it, write nothing — an audit row would record a name nobody configured.
            rateLimiter.recordFailure(subjectKey, clientIp)
            throw FoundationForbiddenException("local_identity_denied")
        }
        if (!FoundationHashing.constantTimeHexEquals(FoundationHashing.sha256(credential), expectedCredentialHash)) {
            rateLimiter.recordFailure(subjectKey, clientIp)
            repository.insertDeniedAudit(subjectKey, null, "LOCAL_IDENTITY_DENIED", "SESSION", null, Instant.now(clock))
            throw FoundationForbiddenException("local_identity_denied")
        }
        val now = Instant.now(clock)
        if (!repository.ensureActiveSyntheticSubject(subjectId, now)) throw FoundationForbiddenException("subject_deleted")
        rateLimiter.recordSuccess(subjectKey, clientIp)
        return issueSession(subjectId, now)
    }
```

(inject `private val rateLimiter: SessionRateLimiter` into the service constructor). `reserveDemoBootstrap`: `total` counts `WHERE subject_id LIKE 'synthetic-demo-%' AND deleted_at IS NULL`; update its KDoc: "capacity is active subjects; deletion and expiry return it; the 20-per-minute creation rate still counts deleted rows so deletion cannot reset the per-minute budget".

- [ ] **Step 4: Run** `SessionRateLimiterTest`, the core class, `FoundationPropertiesTest` → PASS; `pnpm foundation:e2e` → `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api apps/web/playwright.foundation.config.ts
git commit -m "feat(core): session token bucket and failure lock, silent unknown subjects, demo capacity by active subjects

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 16: Session lifecycle and CSRF — logout, hard expiry, `X-Requested-With`, hosted profile, actuator exposure

**Files:**
- Modify: `FoundationLifecycleController.kt` (new `POST /session/logout`), `FoundationSecurity.kt:117-165` (filter), `FoundationRepository.kt` (`revokeSession`), `application.yml`
- Create: `apps/core-api/src/main/resources/application-hosted.yml`
- Modify: `apps/web/lib/foundation/client.ts:353-366` (header), `apps/web/e2e/foundation-lifecycle.spec.ts:118-123` (`browserApi` helper header), `apps/web/tests/foundation-client.test.ts`
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`, `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/HostedProfileConfigurationTest.kt` (create)

**Interfaces:**
- Consumes: `FoundationSessionFilter`, `FOUNDATION_CSRF_HEADER`.
- Produces: `const val FOUNDATION_REQUESTED_WITH_HEADER = "X-Requested-With"`, `const val FOUNDATION_REQUESTED_WITH_VALUE = "GC-Foundation"`; `POST /api/foundation/session/logout` → `204` with both cookies expired and the `gc_session` row `revoked_at` set; `FoundationRepository.revokeSession(sessionId, now): Boolean`; `findActiveSession` also requires `revoked_at IS NULL` (verify it does; add if not); 403 `requested_with_denied` when the header is absent or different on a state-changing request; `application-hosted.yml` with `gc.foundation.secure-cookies: true`, `server.forward-headers-strategy: framework`, `server.tomcat.remoteip.trusted-proxies: ${GC_TRUSTED_PROXIES}`; `application.yml` with `forward-headers-strategy: none` and `management.endpoints.web.exposure.include: health`.

- [ ] **Step 1: Write the failing tests**

Integration:

```kotlin
    @Test
    fun stateChangesNeedTheRequestedWithHeaderAndLogoutEndsTheSessionWithoutSliding() {
        val alice = login("synthetic-alice")
        mockMvc.perform(post("/api/foundation/consents/document-extraction").cookie(alice.cookie)
            .header(HttpHeaders.ORIGIN, allowedOrigin).header(FOUNDATION_CSRF_HEADER, alice.csrf))
            .andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("requested_with_denied"))
        mockMvc.perform(post("/api/foundation/consents/document-extraction").cookie(alice.cookie)
            .header(HttpHeaders.ORIGIN, allowedOrigin).header(FOUNDATION_CSRF_HEADER, alice.csrf).header("X-Requested-With", "XMLHttpRequest"))
            .andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("requested_with_denied"))
        grantConsent(alice)
        val expiresBefore = jdbc.queryForObject("SELECT expires_at FROM gc_session WHERE subject_id = 'synthetic-alice'", java.time.OffsetDateTime::class.java)
        read(get("/api/foundation/session"), alice).andExpect(status().isOk)
        assertThat(jdbc.queryForObject("SELECT expires_at FROM gc_session WHERE subject_id = 'synthetic-alice'", java.time.OffsetDateTime::class.java)).isEqualTo(expiresBefore)
        val logout = mutate(post("/api/foundation/session/logout"), alice).andExpect(status().isNoContent).andReturn().response
        assertThat(logout.getCookie(FOUNDATION_SESSION_COOKIE)!!.maxAge).isZero()
        assertThat(logout.getCookie(FOUNDATION_CSRF_COOKIE)!!.maxAge).isZero()
        assertThat(logout.getHeaders(HttpHeaders.SET_COOKIE)).allMatch { it.contains("SameSite=Strict") }
        assertThat(logout.getHeaders(HttpHeaders.SET_COOKIE)).noneMatch { it.contains("Secure") }
        read(get("/api/foundation/session"), alice).andExpect(status().isUnauthorized).andExpect(jsonPath("$.code").value("session_invalid"))
        assertThat(jdbc.queryForObject("SELECT revoked_at IS NOT NULL FROM gc_session WHERE subject_id = 'synthetic-alice'", Boolean::class.java)).isTrue()
        mockMvc.perform(get("/actuator/prometheus")).andExpect(status().isNotFound)
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk)
    }
```

`HostedProfileConfigurationTest.kt` (no database):

```kotlin
package kr.co.genomecompanion.foundation

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.test.context.ActiveProfiles


@SpringBootTest(
    properties = [
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
        "GC_TRUSTED_PROXIES=10.0.0.0/8",
    ],
)
@ActiveProfiles("test", "hosted")
class HostedProfileConfigurationTest(@param:Autowired private val environment: Environment) {
    @Test
    fun `hosted profile turns on secure cookies and trusted-proxy forwarding; default profile does neither`() {
        assertThat(environment.getProperty("gc.foundation.secure-cookies")).isEqualTo("true")
        assertThat(environment.getProperty("server.forward-headers-strategy")).isEqualTo("framework")
        assertThat(environment.getProperty("server.tomcat.remoteip.trusted-proxies")).isEqualTo("10.0.0.0/8")
        assertThat(environment.getProperty("management.endpoints.web.exposure.include")).isEqualTo("health")
    }
}
```

and a sibling `DefaultProfileConfigurationTest` with `@ActiveProfiles("test")` asserting `server.forward-headers-strategy == "none"`.

Web (`foundation-client.test.ts` line 72 area): `expect(new Headers(request?.headers).get("X-Requested-With")).toBe("GC-Foundation");` in both places that assert the CSRF header.

- [ ] **Step 2: Run to verify failure** — the request without the header is 201; `/actuator/prometheus` is 200 (or 401); the web test fails on the header.

- [ ] **Step 3: Implement**

`FoundationSecurity.kt`: add the constants; inside the `stateChangingMethods` block after the CSRF check:

```kotlin
            if (request.getHeader(FOUNDATION_REQUESTED_WITH_HEADER) != FOUNDATION_REQUESTED_WITH_VALUE) {
                repository.insertDeniedAudit(subjectHash(session.subjectId), session.tokenHash, "REQUEST_REQUESTED_WITH_DENIED", "REQUEST", null, Instant.now(clock))
                reject(response, HttpServletResponse.SC_FORBIDDEN, "requested_with_denied")
                return
            }
```

Also require it on `POST /session` and `/demo-session` (before the origin check passes control): those two requests have no session, so only the header is checked there (no audit row). `findActiveSession`'s SQL: add `AND revoked_at IS NULL` if absent.

Controller:

```kotlin
    @PostMapping("/session/logout")
    fun logout(request: HttpServletRequest): ResponseEntity<Void> {
        service.logout(request.foundationPrincipal())
        return ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, expiredCookie(FOUNDATION_SESSION_COOKIE, "/api", httpOnly = true).toString(), expiredCookie(FOUNDATION_CSRF_COOKIE, "/", httpOnly = false).toString())
            .cacheControlNoStore()
            .build()
    }

    private fun expiredCookie(name: String, path: String, httpOnly: Boolean): ResponseCookie =
        ResponseCookie.from(name, "").httpOnly(httpOnly).secure(properties.secureCookies).sameSite("Strict").path(path).maxAge(Duration.ZERO).build()
```

(and use `expiredCookie` in `deleteProfile` too). Service:

```kotlin
    @Transactional
    fun logout(principal: FoundationPrincipal) {
        if (repository.revokeSession(principal.sessionId, Instant.now(clock))) audit(principal, "SESSION_ENDED", "SESSION", principal.sessionId, "SUCCESS")
    }
```

Repository: `fun revokeSession(sessionId: UUID, now: Instant): Boolean = jdbc.update("UPDATE gc_session SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL", now.atOffset(ZoneOffset.UTC), sessionId) == 1`.

`application.yml`: `server.forward-headers-strategy: none`; `management.endpoints.web.exposure.include: health`. `application-hosted.yml`:

```yaml
server:
  forward-headers-strategy: framework
  tomcat:
    remoteip:
      trusted-proxies: ${GC_TRUSTED_PROXIES}
gc:
  foundation:
    secure-cookies: true
```

Web `client.ts` `request()`: `if (mutation) { … headers.set("X-Requested-With", "GC-Foundation"); }`. e2e `browserApi` helper (line 121): `headers.set("X-Requested-With", "GC-Foundation");` next to the CSRF line. `mapProblem`: `requested_with_denied` → `forbidden` (already covered by the 403 fallback; add it to the explicit list for clarity). Web copy for logout is out of scope (no button; the endpoint exists for the hosted profile and the e2e does not call it).

- [ ] **Step 4: Run** the core class, the two profile tests, `pnpm web:test`, `pnpm auth-security:gate`, `pnpm foundation:e2e` → all green.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api apps/web/lib apps/web/e2e apps/web/tests
git commit -m "feat(core): logout endpoint, X-Requested-With CSRF header, hosted profile for Secure cookies and proxies, health-only actuator

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 17: Worker trust — HMAC-proven worker id, `/internal/**` rate limit, one-shot lease replay test

**Files:**
- Modify: `DocumentWorkerBoundary.kt:560-611` (`DocumentWorkerCredentialFilter`), `FoundationProperties.kt` (`workerRateLimitPerMinute`, added in Task 15), `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/DocumentWorkerMain.kt:263-270` (`authenticatedBuilder`)
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`, `apps/document-worker/src/test/kotlin/kr/co/genomecompanion/documentworker/BoundaryApiClientTest.kt`

**Interfaces:**
- Consumes: `FoundationHashing.sha256`, `javax.crypto.Mac`.
- Produces: header `X-GC-Worker-Id-Mac` = lowercase hex `HMAC-SHA256(key = sha256(rawCredential).toByteArray(US_ASCII), message = workerId.toByteArray(UTF_8))`, computed by `WorkerIdentity.mac(credential: String, workerId: String): String` (new `object` in `packages/document-boundary/.../WorkerIdentity.kt` so both sides share one implementation); core rejects a missing/invalid MAC with 403 `worker_identity_denied`; per-worker-id bucket of `workerRateLimitPerMinute` (default 600) → 429 `rate_limited`, test profile 100000.

- [ ] **Step 1: Write the failing tests**

`packages/document-boundary/src/test/kotlin/.../WorkerIdentityTest.kt`:

```kotlin
package kr.co.genomecompanion.documentboundary

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test


class WorkerIdentityTest {
    @Test
    fun `mac is deterministic, credential-bound and never the credential itself`() {
        val credential = "browser-document-worker-credential-000000000001"
        val mac = WorkerIdentity.mac(credential, "playwright-document-worker")
        assertThat(mac).matches("^[0-9a-f]{64}$").isEqualTo(WorkerIdentity.mac(credential, "playwright-document-worker"))
        assertThat(mac).isNotEqualTo(WorkerIdentity.mac(credential, "other-worker"))
        assertThat(mac).isNotEqualTo(WorkerIdentity.mac(credential + "x", "playwright-document-worker"))
        assertThat(WorkerIdentity.macFromCredentialDigest(WorkerIdentity.credentialDigest(credential), "playwright-document-worker")).isEqualTo(mac)
    }
}
```

Integration:

```kotlin
    @Test
    fun workerIdentityMustBeProvenByHmacAndACompletedLeaseCannotBeReplayed() {
        val credential = "worker-credential-for-integration-test-0001"
        // The registry pins worker-credential-sha256 to sha256(credential) — see Step 3.
        fun lease(workerId: String, mac: String?) = mockMvc.perform(
            post("/internal/document-boundary/jobs/lease").header("X-GC-Worker-Credential", credential).header("X-GC-Worker-Id", workerId)
                .let { if (mac == null) it else it.header("X-GC-Worker-Id-Mac", mac) },
        )
        lease("worker-a", null).andExpect(status().isForbidden).andExpect(jsonPath("$.code").value("worker_identity_denied"))
        lease("worker-a", "0".repeat(64)).andExpect(status().isForbidden)
        lease("worker-a", kr.co.genomecompanion.documentboundary.WorkerIdentity.mac(credential, "worker-b")).andExpect(status().isForbidden)
        lease("worker-a", kr.co.genomecompanion.documentboundary.WorkerIdentity.mac(credential, "worker-a")).andExpect(status().isNoContent)

        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "replay-lease")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        val inspection = checkNotNull(workerService.lease("a".repeat(64)))
        workerService.completeInspection(inspection.jobId, inspection.leaseToken, approvedInspectionRequest())
        org.assertj.core.api.Assertions.assertThatThrownBy { workerService.completeInspection(inspection.jobId, inspection.leaseToken, approvedInspectionRequest()) }
            .isInstanceOf(FoundationForbiddenException::class.java).hasMessage("worker_job_lease_invalid")
        assertThat(count("gc_document_inspection")).isEqualTo(1)
    }
```

`BoundaryApiClientTest.kt`: in the existing `source requests octet stream…` test capture `exchange.requestHeaders.getFirst("X-GC-Worker-Id-Mac")` and assert it equals `WorkerIdentity.mac(<the test credential>, <the test worker id>)`.

- [ ] **Step 2: Run to verify failure** — `WorkerIdentity` missing; the lease without MAC returns 204.

- [ ] **Step 3: Implement**

`packages/document-boundary/.../WorkerIdentity.kt`:

```kotlin
package kr.co.genomecompanion.documentboundary

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/** The worker proves its id with an HMAC keyed by sha256(credential): core holds only that digest and can verify without the raw secret. */
object WorkerIdentity {
    fun credentialDigest(credential: String): String =
        MessageDigest.getInstance("SHA-256").digest(credential.toByteArray(StandardCharsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 0xff) }

    fun mac(credential: String, workerId: String): String = macFromCredentialDigest(credentialDigest(credential), workerId)

    fun macFromCredentialDigest(credentialDigestHex: String, workerId: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(credentialDigestHex.toByteArray(StandardCharsets.US_ASCII), "HmacSHA256"))
        return mac.doFinal(workerId.toByteArray(StandardCharsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }
}
```

`DocumentWorkerCredentialFilter`: read `X-GC-Worker-Id-Mac`; after the credential check, `if (!FoundationHashing.constantTimeHexEquals(presentedMac, WorkerIdentity.macFromCredentialDigest(properties.workerCredentialSha256, workerId))) → 403 worker_identity_denied`. Then the bucket: a `ConcurrentHashMap<String, Pair<Instant, Int>>` keyed by the worker id hash, window 60 s, limit `properties.workerRateLimitPerMinute`; over the limit → 429 `{"code":"rate_limited"}` with `Retry-After: 60` written the same way as the 403. Worker `authenticatedBuilder` adds `.header("X-GC-Worker-Id-Mac", WorkerIdentity.mac(configuration.credential, configuration.workerId))`. Test registry: replace `registry.add("gc.foundation.worker-credential-sha256") { "c".repeat(64) }` with `{ FoundationHashing.sha256("worker-credential-for-integration-test-0001") }` and add `registry.add("gc.foundation.worker-rate-limit-per-minute") { "100000" }`. The one-shot lease semantics already hold (`lockLeasedJob` requires `status = 'LEASED'`); the test pins them.

- [ ] **Step 4: Run** boundary tests, worker tests, the core class, `pnpm foundation:e2e` → green.

- [ ] **Step 5: Commit**

```bash
git add packages/document-boundary apps/document-worker apps/core-api
git commit -m "feat(worker-boundary): HMAC-proven worker id, per-worker rate limit, pinned one-shot lease replay

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 18: PDF inspection hardening and a memory-bounded render subprocess

**Files:**
- Modify: `packages/document-boundary/src/main/kotlin/kr/co/genomecompanion/documentboundary/PdfSecurityInspector.kt`, `DocumentBoundaryContracts.kt` (`InspectionReason.XFA_FORM`, `PdfInspectionPolicy.maxNestingDepth = 8`)
- Create: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/PageRenderSubprocess.kt`, `RenderMain.kt`
- Modify: `DocumentWorkerMain.kt` (`DocumentWorker.runOnce`, `renderFirstPage`), `apps/web/components/integrated/IntegratedHealthExperience.tsx` (failure-code sentence)
- Test: `packages/document-boundary/src/test/kotlin/.../PdfSecurityInspectorTest.kt`, `apps/document-worker/src/test/kotlin/.../PageRenderSubprocessTest.kt` (create)

**Interfaces:**
- Consumes: PDFBox `PDDocument`, `PDPage.actions`, `PDAnnotation`, `PDFormXObject`, `PDTilingPattern`, `PDInlineImage`.
- Produces: `PdfSecurityInspector` rejects `ACTIVE_CONTENT` for page `/AA`, annotation `/A` of subtype `JavaScript`, `Launch`, `URI`, `GoToR`, and `EMBEDDED_FILE` for `FileAttachment` annotations; `XFA_FORM` when `acroForm.xfa != null`; `ENCRYPTED_PDF` when `isEncrypted` even with an empty user password; `totalImagePixels` sums images recursively through form XObjects and tiling patterns (depth ≤ `maxNestingDepth`, cycles broken by identity set) plus inline images (`PDInlineImage` found by a `PDFStreamEngine` subclass); `hasUnexpectedTrailingData` runs in one pass. `PageRenderSubprocess.render(pdf: ByteArray, maxHeapMb: Int = 384, timeout: Duration = Duration.ofSeconds(60)): RenderResult` where `sealed interface RenderResult { data class Png(val bytes: ByteArray); data object OutOfMemory; data class Failed(val exitCode: Int) }`; `RenderMain` (Kotlin `main`) reads the PDF on stdin, writes the PNG to stdout, exits 3 on `OutOfMemoryError`; the worker posts `failure("render_error", retryable = false)` on `OutOfMemory` and `failure("preview_generation_failed", retryable = true)` on `Failed`.

- [ ] **Step 1: Write the failing tests**

`PdfSecurityInspectorTest.kt` (add; build PDFs with PDFBox in the test the way the file already does):

```kotlin
    @Test
    fun `rejects page additional actions, dangerous annotation actions and file attachments`() {
        val pageAa = pdf { document, page -> page.cosObject.setItem(COSName.AA, COSDictionary()) }
        assertThat(inspector.inspect(pageAa, sha(pageAa)).reason).isEqualTo(InspectionReason.ACTIVE_CONTENT)
        for (subtype in listOf("JavaScript", "Launch", "URI", "GoToR")) {
            val bytes = pdf { document, page ->
                val annotation = PDAnnotationLink()
                val action = COSDictionary().apply { setName(COSName.S, subtype) }
                annotation.cosObject.setItem(COSName.A, action)
                page.annotations = listOf(annotation)
            }
            assertThat(inspector.inspect(bytes, sha(bytes)).reason).describedAs(subtype).isEqualTo(InspectionReason.ACTIVE_CONTENT)
        }
        val attachment = pdf { document, page ->
            val annotation = PDAnnotationFileAttachment()
            page.annotations = listOf(annotation)
        }
        assertThat(inspector.inspect(attachment, sha(attachment)).reason).isEqualTo(InspectionReason.EMBEDDED_FILE)
    }

    @Test
    fun `rejects XFA and encrypted documents even with an empty user password`() {
        val xfa = pdf { document, _ -> document.documentCatalog.acroForm = PDAcroForm(document).also { it.cosObject.setItem(COSName.XFA, COSStream()) } }
        assertThat(inspector.inspect(xfa, sha(xfa)).reason).isEqualTo(InspectionReason.XFA_FORM)
        val encrypted = pdf(encryptWithEmptyUserPassword = true) { _, _ -> }
        assertThat(inspector.inspect(encrypted, sha(encrypted)).reason).isEqualTo(InspectionReason.ENCRYPTED_PDF)
    }

    @Test
    fun `sums image pixels through nested form xobjects, patterns and inline images with a depth limit`() {
        val nested = pdf { document, page ->
            // form XObject containing a 2000x2000 image, drawn from the page; a self-referencing form for the cycle guard
            val image = LosslessFactory.createFromImage(document, BufferedImage(2000, 2000, BufferedImage.TYPE_INT_RGB))
            val form = PDFormXObject(document).apply { bBox = PDRectangle(0f, 0f, 10f, 10f); resources = PDResources().also { it.put(COSName.getPDFName("Im0"), image) } }
            form.resources.put(COSName.getPDFName("Self"), form)
            page.resources = PDResources().also { it.put(COSName.getPDFName("Fx0"), form) }
            PDPageContentStream(document, page).use { it.drawForm(form) }
        }
        val report = inspector.inspect(nested, sha(nested))
        assertThat(report.totalImagePixels).isEqualTo(4_000_000L)
        val inline = pdf { document, page ->
            PDPageContentStream(document, page).use { stream ->
                stream.drawImage(PDInlineImage(COSDictionary().apply { setInt(COSName.W, 300); setInt(COSName.H, 200); setInt(COSName.BPC, 8); setName(COSName.CS, "RGB") }, ByteArray(300 * 200 * 3), page.resources), 0f, 0f)
            }
        }
        assertThat(inspector.inspect(inline, sha(inline)).totalImagePixels).isEqualTo(60_000L)
    }

    @Test
    fun `trailing-data detection is linear and still accepts whitespace after EOF`() {
        val big = ByteArray(9_000_000) { ' '.code.toByte() }
        val ok = "%PDF-1.7\n%%EOF\n".toByteArray() + big
        val started = System.nanoTime()
        inspector.inspect(ok, sha(ok))
        assertThat(java.time.Duration.ofNanos(System.nanoTime() - started)).isLessThan(java.time.Duration.ofSeconds(2))
        val bad = "%PDF-1.7\n%%EOF\nX".toByteArray()
        assertThat(inspector.inspect(bad, sha(bad)).reason).isEqualTo(InspectionReason.TRAILING_DATA)
    }
```

`PageRenderSubprocessTest.kt`:

```kotlin
package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration


class PageRenderSubprocessTest {
    @Test
    fun `renders the first page in a child JVM and reports OOM as a distinct result`() {
        val png = PageRenderSubprocess.render(SyntheticResultPdf.july)
        assertThat(png).isInstanceOfSatisfying(RenderResult.Png::class.java) { assertThat(it.bytes.take(8)).containsExactly(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) }
        // 16 MB of heap cannot hold a 110-dpi A4 RGB raster plus PDFBox: the child dies with exit 3, never the parent.
        assertThat(PageRenderSubprocess.render(SyntheticResultPdf.july, maxHeapMb = 16, timeout = Duration.ofSeconds(60))).isEqualTo(RenderResult.OutOfMemory)
    }
}
```

- [ ] **Step 2: Run to verify failure** — new reasons/classes missing; the `/AA` page and annotation cases return `CLEAN`.

- [ ] **Step 3: Implement**

`PdfSecurityInspector.inspectParsed`:

```kotlin
        val catalog = document.documentCatalog
        val xfa = catalog.acroForm?.cosObject?.containsKey(COSName.XFA) == true
        val annotationActive = document.pages.any { page ->
            page.cosObject.containsKey(COSName.AA) || page.annotations.any { annotation ->
                val action = annotation.cosObject.getDictionaryObject(COSName.A) as? COSDictionary
                action?.getNameAsString(COSName.S) in setOf("JavaScript", "Launch", "URI", "GoToR") || annotation.cosObject.containsKey(COSName.AA)
            }
        }
        val attachmentAnnotation = document.pages.any { page -> page.annotations.any { it.subtype == "FileAttachment" } }
        val embeddedFiles = catalog.names?.embeddedFiles != null || attachmentAnnotation
        val activeContent = catalog.openAction != null || catalog.names?.javaScript != null || catalog.acroForm != null ||
            catalog.cosObject.containsKey(COSName.AA) || annotationActive
        val totalImagePixels = ImagePixelCounter(policy.maxNestingDepth).count(document)
        val reason = when {
            encrypted -> InspectionReason.ENCRYPTED_PDF
            xfa -> InspectionReason.XFA_FORM
            pageCount !in 1..policy.maxPages -> InspectionReason.PAGE_LIMIT_EXCEEDED
            objectCount > policy.maxIndirectObjects -> InspectionReason.OBJECT_LIMIT_EXCEEDED
            totalImagePixels > policy.maxImagePixels -> InspectionReason.IMAGE_COMPLEXITY_EXCEEDED
            embeddedFiles -> InspectionReason.EMBEDDED_FILE
            activeContent -> InspectionReason.ACTIVE_CONTENT
            else -> InspectionReason.CLEAN
        }
```

`ImagePixelCounter` (private class in the same file): a `PDFStreamEngine` subclass that registers the standard operators (`addOperator(Concatenate(this))`, `DrawObject(this)`, `SetGraphicsStateParameters`, `Save`, `Restore`, `SetMatrix`, and `BeginInlineImage`), overrides `processOperator` to add `width*height` for `PDInlineImage`, and overrides `showForm(form)` to recurse only while `depth < max` and the form's `cosObject` is not in an `IdentityHashMap`-backed visited set; for each page it also walks `resources.xObjectNames` (images counted once per distinct `COSStream` identity) and `resources.patternNames` (tiling patterns' resources walked with the same guard). Sum with `Math.addExact`.

`hasUnexpectedTrailingData` (single pass):

```kotlin
    private fun hasUnexpectedTrailingData(bytes: ByteArray): Boolean {
        val marker = "%%EOF".toByteArray()
        var lastMarker = -1
        var index = 0
        while (index <= bytes.size - marker.size) {
            if (bytes[index] == marker[0] && bytes.regionMatches(index, marker)) { lastMarker = index; index += marker.size } else index += 1
        }
        if (lastMarker < 0) return true
        for (i in lastMarker + marker.size until bytes.size) {
            val c = bytes[i].toInt().toChar()
            if (c != ' ' && c != '\t' && c != '\r' && c != '\n' && c != '\u0000') return true
        }
        return false
    }

    private fun ByteArray.regionMatches(offset: Int, other: ByteArray): Boolean {
        for (i in other.indices) if (this[offset + i] != other[i]) return false
        return true
    }
```

Encrypted with an empty user password: PDFBox opens it, `document.isEncrypted` is true → the existing `encrypted ->` branch already catches it (the test proves the order). Add `XFA_FORM` to `InspectionReason` (also to the worker/web nothing — `InspectionReason` is only stored in `gc_document_inspection.reason VARCHAR(80)`).

`RenderMain.kt`:

```kotlin
package kr.co.genomecompanion.documentworker

import org.apache.pdfbox.Loader
import org.apache.pdfbox.rendering.ImageType
import org.apache.pdfbox.rendering.PDFRenderer
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import kotlin.system.exitProcess

/** Child-JVM entry: PDF on stdin, PNG on stdout. Exit 3 = out of memory, 4 = render failure. Never logs bytes. */
fun main() {
    val source = System.`in`.readNBytes(10_485_761)
    try {
        val png = Loader.loadPDF(source).use { document ->
            require(document.numberOfPages in 1..20)
            val image = PDFRenderer(document).renderImageWithDPI(0, 110f, ImageType.RGB)
            require(image.width.toLong() * image.height.toLong() <= 20_000_000)
            ByteArrayOutputStream().use { output -> check(ImageIO.write(image, "png", output)); output.toByteArray() }
        }
        require(png.size in 67..2_097_152)
        System.out.write(png); System.out.flush()
        exitProcess(0)
    } catch (_: OutOfMemoryError) {
        exitProcess(3)
    } catch (_: Throwable) {
        exitProcess(4)
    }
}
```

`PageRenderSubprocess.kt`:

```kotlin
package kr.co.genomecompanion.documentworker

import java.nio.file.Path
import java.time.Duration
import java.util.concurrent.TimeUnit

sealed interface RenderResult {
    data class Png(val bytes: ByteArray) : RenderResult
    data object OutOfMemory : RenderResult
    data class Failed(val exitCode: Int) : RenderResult
}

/** Renders in a child JVM with a hard -Xmx so a hostile page can only kill the child. Same classpath as this process. */
object PageRenderSubprocess {
    fun render(pdf: ByteArray, maxHeapMb: Int = 384, timeout: Duration = Duration.ofSeconds(60)): RenderResult {
        val java = Path.of(System.getProperty("java.home"), "bin", "java").toString()
        val command = listOf(java, "-Xmx${maxHeapMb}m", "-XX:+ExitOnOutOfMemoryError", "-Djava.awt.headless=true", "-cp", System.getProperty("java.class.path"), "kr.co.genomecompanion.documentworker.RenderMainKt")
        val process = ProcessBuilder(command).redirectErrorStream(false).redirectError(ProcessBuilder.Redirect.DISCARD).start()
        val output = java.io.ByteArrayOutputStream()
        val reader = Thread { process.inputStream.use { it.copyTo(output) } }.also { it.isDaemon = true; it.start() }
        process.outputStream.use { it.write(pdf) }
        if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) { process.destroyForcibly(); return RenderResult.Failed(-1) }
        reader.join(5_000)
        return when (process.exitValue()) {
            0 -> RenderResult.Png(output.toByteArray())
            3 -> RenderResult.OutOfMemory
            else -> RenderResult.Failed(process.exitValue())
        }
    }
}
```

(`-XX:+ExitOnOutOfMemoryError` makes an OOM that escapes the catch block exit with HotSpot's code 3, the same code `RenderMain` uses, so the `when` needs only the one branch; verify with the 16 MB test.) `DocumentWorker.runOnce` extraction branch:

```kotlin
                    when (val rendered = PageRenderSubprocess.render(source)) {
                        is RenderResult.Png -> client.extractionResult(lease, rendered.bytes, NativeTextExtractionProvider.extract(source))
                        RenderResult.OutOfMemory -> client.failure(lease, "render_error", retryable = false)
                        is RenderResult.Failed -> client.failure(lease, "preview_generation_failed", retryable = true)
                    }
```

Delete the in-process `renderFirstPage`. Web: `IntegratedHealthExperience.tsx` shows, when `document.failureCode === "render_error"`, the sentence `미리보기를 만들다 메모리 한도를 넘어 처리를 중단했어요.` under the `FAILED_TERMINAL` label (add the string to `korean-ux-copy.test.ts`).

- [ ] **Step 4: Run** boundary tests, worker tests (the subprocess test needs the test classpath — it is `System.getProperty("java.class.path")`, which Gradle sets), `pnpm web:test`, `pnpm foundation:e2e` (the e2e still renders through the subprocess; confirm the worker log shows no exception).

- [ ] **Step 5: Commit**

```bash
git add packages/document-boundary apps/document-worker apps/web
git commit -m "feat(document-boundary): page/annotation actions, attachments, XFA, nested image pixels, linear trailing scan; render in a bounded child JVM

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 19: CI — Trivy blocks unfixed Critical findings; image-smoke job boots both containers to `/healthz`

**Files:**
- Modify: `.github/workflows/ci.yml` (`runtime-images` job Trivy steps; new `image-smoke` job)
- Test: `pnpm security:github-actions-policy`; the workflow itself (green run URL goes into `docs/status/2026-09-18/wave7.md`)

**Interfaces:**
- Consumes: the images `genome-companion/core-api:<sha>` and `genome-companion/document-worker:<sha>` built in `runtime-images`; the worker `/healthz` contract from Task 22 (`GC_WORKER_HEALTH_PORT`, 200 `ready` or 503 with a reason code).
- Produces: job `image-smoke` (`needs: runtime-images`) that rebuilds each image (artifacts are not shared between jobs), starts a `postgres:18.6-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2` service, runs core-api with `--network host` and `GC_DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/postgres`, polls `http://127.0.0.1:8080/actuator/health` for 200 within 90 s, runs document-worker with `--network host`, `GC_WORKER_API_BASE_URL=http://127.0.0.1:8080`, `GC_WORKER_CREDENTIAL=smoke-credential-with-at-least-32-chars-000`, `GC_WORKER_IMAGE_DIGEST=<64 hex of the image id>`, `GC_WORKER_HEALTH_PORT=8091`, polls `http://127.0.0.1:8091/healthz` for 200 within 60 s, then stops both.

- [ ] **Step 1: Edit the Trivy blocking step**

In `runtime-images`, the step `Fail on unresolved Critical or High image vulnerabilities` becomes `Fail on Critical image vulnerabilities, fixed or not` with `severity: CRITICAL` and `ignore-unfixed: false`; add a second, non-blocking step `Report High image vulnerabilities (informational)` with `severity: HIGH`, `ignore-unfixed: false`, `exit-code: "0"`. Keep the SBOM step as it is. Leave `supply-chain`'s filesystem scan unchanged (spec §5 names images only).

- [ ] **Step 2: Add the smoke job**

```yaml
  image-smoke:
    name: runtime image smoke (core-api + document-worker boot to /healthz)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: runtime-images
    permissions:
      contents: read
    services:
      postgres:
        image: postgres:18.6-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2
        env:
          POSTGRES_HOST_AUTH_METHOD: trust
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10
    env:
      DOCKER_BUILDKIT: "1"
    steps:
      - name: Checkout immutable revision
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - name: Build core-api and document-worker images
        run: |
          docker build --pull --platform linux/amd64 --file apps/core-api/Dockerfile --tag gc-smoke/core-api .
          docker build --pull --platform linux/amd64 --file apps/document-worker/Dockerfile --tag gc-smoke/document-worker .
      - name: Boot core-api against the service database and wait for /actuator/health
        run: |
          docker run --detach --name gc-core --network host \
            --env GC_DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/postgres \
            --env GC_DATABASE_USERNAME=postgres --env GC_DATABASE_PASSWORD= \
            gc-smoke/core-api
          for attempt in $(seq 1 45); do
            if curl --fail --silent http://127.0.0.1:8080/actuator/health | grep -q '"UP"'; then echo "core-api UP after ${attempt} polls"; exit 0; fi
            sleep 2
          done
          docker logs gc-core | tail -n 100
          exit 1
      - name: Boot document-worker against core-api and wait for /healthz
        run: |
          image_id="$(docker image inspect --format '{{.Id}}' gc-smoke/document-worker | sed 's/^sha256://')"
          docker run --detach --name gc-worker --network host \
            --env GC_WORKER_API_BASE_URL=http://127.0.0.1:8080 \
            --env GC_WORKER_CREDENTIAL=smoke-credential-with-at-least-32-chars-000 \
            --env GC_WORKER_ID=ci-smoke-worker \
            --env GC_WORKER_IMAGE_DIGEST="${image_id}" \
            --env GC_WORKER_HEALTH_PORT=8091 \
            gc-smoke/document-worker
          for attempt in $(seq 1 30); do
            body="$(curl --silent --write-out ' HTTP_%{http_code}' http://127.0.0.1:8091/healthz || true)"
            case "${body}" in
              *HTTP_200) echo "worker ready after ${attempt} polls: ${body}"; exit 0 ;;
            esac
            sleep 2
          done
          echo "worker health never reached 200; last body: ${body}"
          docker logs gc-worker | tail -n 100
          exit 1
      - name: Stop containers
        if: ${{ always() }}
        run: docker rm --force gc-core gc-worker || true
```

Core boots with `gc.foundation.enabled=false` (the default), so no foundation configuration is needed; Flyway migrates the empty service database (that is the second place, after Task 24, where V1..V13 run on CI). The worker's `/healthz` (Task 22) returns 200 only when core is reachable, the ClamAV signatures exist and are ≤ 7 days old, and the loop is alive — the Dockerfile's `freshclam` run (Task 22) is what makes this green; an offline build makes this step fail honestly.

- [ ] **Step 3: Validate the policy**

Run: `pnpm security:github-actions-policy` → `github-actions-policy: PASS`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: block unfixed Critical image findings; smoke-boot core-api and document-worker to /healthz

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 20: API contract — hand-written OpenAPI checked by a test, cursor pagination, caps, time rule

**Files:**
- Create: `docs/api/foundation-openapi.yaml`, `apps/core-api/src/test/kotlin/kr/co/genomecompanion/foundation/FoundationOpenApiContractTest.kt`
- Modify: `FoundationLifecycleController.kt` (`listRecords`, `listHealthEvents`, exports), `FoundationLifecycleService.kt`, `FoundationRepository.kt` (`listRecords(subjectId, after, limit)`, `countRecords`, `countDocuments`), `apps/web/lib/foundation/client.ts` (no shape change; `getRecords`/`getHealthEvents` keep page one)
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: Task 10's order `observed_on, changed_at, record_id`; `jackson-dataformat-yaml` (test dependency present).
- Produces: `GET /records?after=<eventId>&limit=<1..200>` and `GET /health-events?after=&limit=` (default 200, cap 200) with response header `X-GC-Next-After: <eventId>` when more rows follow; `413 payload_cap_exceeded` from both exports when the subject has more than 5,000 current records or more than 200 documents; `FoundationRepository.listRecordsPage(subjectId, afterVersionId: UUID?, limit: Int): List<FoundationRecordRow>` (keyset: rows strictly after the cursor row in the order above); `docs/api/foundation-openapi.yaml` (OpenAPI 3.1, hand-written) listing every path, its response fields with `required` arrays and every `code` value each path can return; the contract test walks every `paths.*.responses.<status>.content.application/json.schema` and checks each real response captured in the lifecycle against it (field set equality: required ⊆ actual keys ⊆ properties; nullability: a property marked `nullable: false` is never `null`) and that every problem `code` the test observed is listed in `components.x-error-codes`.

Nullability rule, stated verbatim in the YAML `info.description`: "Responses omit null members (Jackson non_null); only the export marks `referenceRangeText` ALWAYS (explicit null). Instants are UTC ISO-8601; `observedOn` is a date string; export filenames use `exportedAt` in Asia/Seoul."

- [ ] **Step 1: Write the failing tests**

Integration additions:

```kotlin
    @Test
    fun recordsAndHealthEventsPaginateWithAnAfterCursorAndTheExportRefusesAboveTheCap() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        repeat(3) { round -> confirmEveryCandidate(alice, importSyntheticDocument(alice, consentId, fixturePdf, fixtureDigest, "page-$round"), "page-$round") }
        val page1 = read(get("/api/foundation/records").param("limit", "4"), alice).andExpect(status().isOk).andExpect(jsonPath("$.length()").value(4)).andReturn().response
        val next = checkNotNull(page1.getHeader("X-GC-Next-After"))
        assertThat(next).isEqualTo(responseJson(page1.contentAsByteArray).last()["recordVersionId"].asText())
        val page2 = read(get("/api/foundation/records").param("limit", "4").param("after", next), alice).andExpect(status().isOk).andReturn().response
        assertThat(responseJson(page2.contentAsByteArray)).hasSize(5)
        assertThat(page2.getHeader("X-GC-Next-After")).isNull()
        val all = responseJson(read(get("/api/foundation/records"), alice).andReturn().response.contentAsByteArray).map { it["recordVersionId"].asText() }
        assertThat(responseJson(page1.contentAsByteArray).map { it["recordVersionId"].asText() } + responseJson(page2.contentAsByteArray).map { it["recordVersionId"].asText() }).isEqualTo(all)
        read(get("/api/foundation/health-events").param("limit", "4").param("after", next), alice).andExpect(status().isOk).andExpect(jsonPath("$.length()").value(5))
        read(get("/api/foundation/records").param("limit", "201"), alice).andExpect(status().isBadRequest).andExpect(jsonPath("$.code").value("request_invalid"))
        read(get("/api/foundation/records").param("after", "not-a-uuid"), alice).andExpect(status().isBadRequest).andExpect(jsonPath("$.code").value("request_path_invalid"))
        // Cap: 5,001 current record versions → export refuses. Insert synthetic rows directly (values are digits only).
        val candidateId = jdbc.queryForObject("SELECT candidate_id FROM gc_candidate LIMIT 1", UUID::class.java)
        jdbc.update(
            """
            INSERT INTO gc_health_record(record_id, candidate_id, document_id, subject_id, label, confirmed_value, unit, observed_on, confirmed_at)
            SELECT gen_random_uuid(), ?, document_id, subject_id, 'cap-' || n, '1', 'mg/dL', observed_on, CURRENT_TIMESTAMP
            FROM gc_candidate, generate_series(1, 4992) AS n WHERE candidate_id = ?
            """.trimIndent(), candidateId, candidateId,
        )
        jdbc.update("ALTER TABLE gc_health_record DROP CONSTRAINT IF EXISTS gc_health_record_candidate_id_key")
        jdbc.update("INSERT INTO gc_health_record_version(version_id, record_id, subject_id, status, value, changed_at) SELECT gen_random_uuid(), record_id, subject_id, 'CURRENT', '1', CURRENT_TIMESTAMP FROM gc_health_record r WHERE label LIKE 'cap-%'")
        read(get("/api/foundation/health-events/export"), alice).andExpect(status().isPayloadTooLarge).andExpect(jsonPath("$.code").value("payload_cap_exceeded"))
        read(get("/api/foundation/health-events/export/fhir"), alice).andExpect(status().isPayloadTooLarge)
    }
```

(`gc_health_record.candidate_id` is UNIQUE; the test drops that constraint on the persistent test database only after the rows are in — put the `ALTER TABLE … DROP CONSTRAINT` **before** the insert, and re-add it in `@BeforeEach` with `ALTER TABLE gc_health_record ADD CONSTRAINT gc_health_record_candidate_id_key UNIQUE (candidate_id)` guarded by `IF NOT EXISTS` via a `DO $$ … $$` block. Simpler and safer: insert 4,992 extra **candidates** first (`gc_candidate` rows with distinct ordinals on a new synthetic extraction job), then one record per candidate. Use that path; the constraint stays.)

```kotlin
    @Test
    fun exportFilenameAndExportedAtComeFromOneInstantInSeoulTime() {
        val alice = login("synthetic-alice")
        grantConsent(alice)
        val response = read(get("/api/foundation/health-events/export"), alice).andExpect(status().isOk).andReturn().response
        val exportedAt = Instant.parse(responseJson(response.contentAsByteArray)["exportedAt"].asText())
        val expectedDate = java.time.LocalDate.ofInstant(exportedAt, java.time.ZoneId.of("Asia/Seoul")).format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE)
        assertThat(response.getHeader(HttpHeaders.CONTENT_DISPOSITION)).isEqualTo("attachment; filename=\"alm-health-events-$expectedDate.json\"")
        assertThat(responseJson(response.contentAsByteArray)["exportedAt"].asText()).endsWith("Z")
    }
```

(Because `exportedAt` and the filename come from one `now` (the envelope, Wave 4), this test pins it; it needs no clock control.)

`FoundationOpenApiContractTest.kt`: a `@SpringBootTest` PostgreSQL test (same registry as the lifecycle test — extract the registry into a shared `FoundationTestProperties` object used by both) that runs one lifecycle (login, consent, document, worker pipeline, confirm, correct, changes, series, health-events, export, FHIR export, revoke, delete) collecting `(method, pathTemplate, status, bodyJson)` for every call, then loads `docs/api/foundation-openapi.yaml` with `ObjectMapper(YAMLFactory())` and asserts, for each captured call: the path template exists; the status exists under `responses`; the body's key set is a subset of `schema.properties` keys (resolving `$ref` into `components.schemas`) and a superset of `required`; no key whose schema has `nullable: false` (the default) carries `null`; and that `components.x-error-codes` contains every `code` observed on a 4xx/5xx. It also asserts the inverse: every `paths` entry in the YAML was hit at least once (no dead documentation).

- [ ] **Step 2: Run to verify failure** — the YAML does not exist; `limit`/`after` are ignored.

- [ ] **Step 3: Implement**

Repository:

```kotlin
    /** Keyset page in (observed_on, changed_at, record_id) order; `after` is the CURRENT version id of the last row seen. */
    fun listRecordsPage(subjectId: String, afterVersionId: UUID?, limit: Int): List<FoundationRecordRow> {
        val cursor = afterVersionId?.let { findRecordVersion(subjectId, it) }
        if (afterVersionId != null && cursor == null) return emptyList()
        return jdbc.query(
            """
            $recordProjection
            WHERE r.subject_id = ? AND v.status = 'CURRENT'
              AND (? IS NULL OR (r.observed_on, v.changed_at, r.record_id::text) > (?, ?, ?))
            ORDER BY r.observed_on, v.changed_at, r.record_id
            LIMIT ?
            """.trimIndent(),
            recordMapper,
            subjectId, cursor?.recordId, cursor?.observedOn, cursor?.confirmedAt?.atOffset(ZoneOffset.UTC), cursor?.recordId?.toString(), limit + 1,
        )
    }

    fun countCurrentRecords(subjectId: String): Long = jdbc.queryForObject("SELECT COUNT(*) FROM gc_health_record_version WHERE subject_id = ? AND status = 'CURRENT'", Long::class.java, subjectId) ?: 0L

    fun countDocuments(subjectId: String): Long = jdbc.queryForObject("SELECT COUNT(*) FROM gc_document WHERE subject_id = ?", Long::class.java, subjectId) ?: 0L
```

(the `? IS NULL` parameter needs an explicit type: bind `cursor?.recordId` as `UUID` via `jdbc.query(sql, mapper, *args)` with `SqlParameterValue(Types.OTHER, …)` if PostgreSQL reports "could not determine data type"; row comparison `(a,b,c) > (x,y,z)` is PostgreSQL's row-wise comparison, and `record_id::text` ordering matches `ORDER BY r.record_id` only if both use text — change the `ORDER BY` in `listRecords` (Task 10) and here to `r.record_id::text` so they agree.)

Service:

```kotlin
    data class RecordPage(val items: List<RecordReceipt>, val nextAfter: UUID?)

    @Transactional
    fun listRecordsPage(principal: FoundationPrincipal, after: UUID?, limit: Int): RecordPage {
        val rows = repository.listRecordsPage(principal.subjectId, after, limit)
        val page = rows.take(limit)
        return RecordPage(page.map(::recordReceipt), if (rows.size > limit) page.last().recordVersionId else null)
    }

    data class HealthEventPage(val items: List<HealthEvent>, val nextAfter: UUID?)

    @Transactional
    fun listHealthEventsPage(principal: FoundationPrincipal, after: UUID?, limit: Int): HealthEventPage {
        val rows = repository.listRecordsPage(principal.subjectId, after, limit)
        val page = rows.take(limit)
        val events = HealthEventProjection.project(page, repository.listDocumentIdsWithPreview(principal.subjectId))
        return HealthEventPage(events, if (rows.size > limit) page.last().recordVersionId else null)
    }

    private fun requireBelowExportCap(principal: FoundationPrincipal) {
        if (repository.countCurrentRecords(principal.subjectId) > 5_000 || repository.countDocuments(principal.subjectId) > 200) {
            throw FoundationPayloadCapException("payload_cap_exceeded")
        }
    }
```

(`class FoundationPayloadCapException(val code: String) : RuntimeException(code)` → controller handler 413.) `HealthEventProjection.project` sorts by `observedOn, concept, confirmedAt` — inside one page that is fine; the page boundaries follow record order, which the OpenAPI text states. Both export methods call `requireBelowExportCap` first. Controller:

```kotlin
    @GetMapping("/records")
    fun listRecords(
        request: HttpServletRequest,
        @RequestParam(required = false) after: UUID?,
        @RequestParam(defaultValue = "200") @Min(1) @Max(200) limit: Int,
    ): ResponseEntity<List<RecordReceipt>> {
        val page = service.listRecordsPage(request.foundationPrincipal(), after, limit)
        val builder = ResponseEntity.ok().cacheControlNoStore()
        page.nextAfter?.let { builder.header("X-GC-Next-After", it.toString()) }
        return builder.body(page.items)
    }
```

(same for `/health-events`; add `@Validated` on the controller class so `@Min/@Max` on parameters raise `ConstraintViolationException`, mapped to 400 `request_invalid` by a new handler next to `handleValidation`.) `/changes` and `/series` keep reading all rows (they are aggregates) but are bounded by the same 5,000-record cap: `getChangeSummary`/`getSeries` call `requireBelowExportCap` too (spec §6 lists them). The web client keeps `getRecords()`/`getHealthEvents()` unchanged (page one, 200).

Write `docs/api/foundation-openapi.yaml` by hand: `openapi: 3.1.0`, `info` with the nullability/time paragraph, `paths` for every controller mapping (session, demo-session, session/logout, consents…, documents…, candidates…, records, records/{id}, records/{id}/corrections, health-events, health-events/export, health-events/export/fhir, changes, series, consents/{id}/revocation, profile), each with request bodies, parameters (`after`, `limit`, `Idempotency-Key`, `X-GC-CSRF`, `X-Requested-With`), responses with `$ref` schemas, and `components.schemas` transcribed from the Kotlin data classes (`required` = non-nullable Kotlin members; `nullable: true` only on members that Jackson can emit as null — none except `ExportedHealthEvent.referenceRangeText`); `components.x-error-codes` listing every `code` string in the controllers, the filter, the advice and Tasks 7–20 (`idempotency_key_mismatch`, `candidate_state_changed`, `record_state_changed`, `document_state_changed`, `request_body_invalid`, `request_header_missing`, `request_path_invalid`, `media_type_unsupported`, `method_not_allowed`, `lock_conflict`, `storage_unavailable`, `payload_too_large`, `payload_cap_exceeded`, `login_locked`, `requested_with_denied`, `worker_identity_denied`, …).

- [ ] **Step 4: Run** the core classes, `pnpm web:test`, `pnpm foundation:e2e` → green.

- [ ] **Step 5: Commit**

```bash
git add docs/api apps/core-api
git commit -m "feat(api): hand-written OpenAPI checked against live responses, cursor pagination, export caps, one-instant filename rule

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 21: PHI-safe logging proven by a log-capture test (core and worker)

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationLogging.kt`, `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/WorkerLog.kt`
- Modify: `FoundationLifecycleService.kt`, `DocumentWorkerBoundary.kt` (emit an event code per state change), `FoundationProblemAdvice.kt` (already event-only), `DocumentWorkerMain.kt` (loop logging), `logback-spring.xml` (`%msg` only — unchanged pattern, but set `<logger name="org.springframework.web" level="WARN"/>`, `<logger name="org.apache.pdfbox" level="ERROR"/>`)
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`, `apps/document-worker/src/test/kotlin/.../WorkerLogTest.kt` (create)

**Interfaces:**
- Consumes: `PhiSafeLogger`, `TelemetryEvent`, `SafeTelemetryContext`, MDC `correlation_id`.
- Produces: `TelemetryEvent` gains `SESSION_CREATED("session_created")`, `SESSION_ENDED("session_ended")`, `DOCUMENT_REQUESTED`, `DOCUMENT_UPLOADED`, `DOCUMENT_FINALIZED`, `DOCUMENT_TERMINATED`, `CANDIDATE_CONFIRMED`, `CANDIDATE_EXCLUDED`, `RECORD_CORRECTED`, `EXPORT_COMPLETED`, `WORKER_JOB_LEASED`, `WORKER_JOB_COMPLETED`, `WORKER_JOB_FAILED`; `@Component class FoundationLogging(clock) { fun event(event: TelemetryEvent, routeTemplate: String?, subjectHash: String?) }` writing through `PhiSafeLogger` plus `subject_hash=<first 12 hex>` (a pepper-hashed id, never the subject id); worker `object WorkerLog { fun emit(event: String, jobId: String?, code: String? = null) }` printing `event=<event> job_id=<uuid or none> code=<code or none>` to stdout — no filename, no page text.

- [ ] **Step 1: Write the failing tests**

Integration:

```kotlin
    @Test
    fun aFullLifecycleLogsNoValueLabelFilenameOrDate() {
        val root = org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME) as ch.qos.logback.classic.Logger
        val appender = ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>().also { it.start(); root.addAppender(it) }
        val stdout = java.io.ByteArrayOutputStream()
        val originalOut = System.out
        System.setOut(java.io.PrintStream(stdout, true, Charsets.UTF_8))
        try {
            val alice = login("synthetic-alice")
            val consentId = grantConsent(alice)
            val candidates = importJulyWithRange(alice, consentId, "log-capture")
            confirmEveryCandidate(alice, candidates, "log-capture")
            val recordId = responseJson(read(get("/api/foundation/records"), alice).andReturn().response.contentAsByteArray).first()["recordId"].asText()
            mutate(post("/api/foundation/records/$recordId/corrections").header("Idempotency-Key", "log-capture-correct").contentType(MediaType.APPLICATION_JSON)
                .content(json(mapOf("value" to "190", "reason" to "결과지에 190으로 적혀 있음"))), alice).andExpect(status().isOk)
            read(get("/api/foundation/health-events/export"), alice).andExpect(status().isOk)
            mutate(post("/api/foundation/consents/$consentId/revocation"), alice).andExpect(status().isOk)
            mutate(delete("/api/foundation/profile"), alice).andExpect(status().isOk)
            // A failure path too: malformed JSON with a value-looking payload.
            mockMvc.perform(post("/api/foundation/session").header(HttpHeaders.ORIGIN, allowedOrigin).header("X-Requested-With", "GC-Foundation")
                .contentType(MediaType.APPLICATION_JSON).content("{\"subjectId\":\"synthetic-alice\",\"credential\":\"188 mg/dL Cholesterol"))
                .andExpect(status().isBadRequest)
        } finally {
            System.setOut(originalOut)
            root.detachAppender(appender)
        }
        val lines = appender.list.map { it.formattedMessage } + stdout.toString(Charsets.UTF_8).lines()
        assertThat(lines).isNotEmpty()
        assertThat(lines.count { it.contains("event=") }).isGreaterThanOrEqualTo(8)
        for (forbidden in listOf("188", "5.2", "42", "190", "Cholesterol", "HbA1c", "Vitamin D", "2026-07-28", "120-199", ".pdf", ".png", "synthetic-alice", "결과지에 190으로")) {
            assertThat(lines.filter { it.contains(forbidden) }).describedAs("log lines containing '$forbidden'").isEmpty()
        }
    }
```

`WorkerLogTest.kt`:

```kotlin
package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.io.ByteArrayOutputStream
import java.io.PrintStream


class WorkerLogTest {
    @Test
    fun `emits only the event code, job id and failure code`() {
        val out = ByteArrayOutputStream()
        val original = System.out
        System.setOut(PrintStream(out, true, Charsets.UTF_8))
        try {
            WorkerLog.emit("job_failed", "6f2b7f3e-9c7b-4d3a-9b0e-1a2b3c4d5e6f", "render_error")
            WorkerLog.emit("lease_empty", null)
        } finally { System.setOut(original) }
        assertThat(out.toString(Charsets.UTF_8).lines().filter { it.isNotBlank() }).containsExactly(
            "event=job_failed job_id=6f2b7f3e-9c7b-4d3a-9b0e-1a2b3c4d5e6f code=render_error",
            "event=lease_empty job_id=none code=none",
        )
    }
}
```

- [ ] **Step 2: Run to verify failure** — the capture finds fewer than 8 `event=` lines (the service logs nothing today); `WorkerLog` missing. If Spring's request logging prints the body (it must not: `spring.mvc.log-request-details: false` is set), the forbidden assertions fail first — fix the logger levels in `logback-spring.xml`.

- [ ] **Step 3: Implement**

`FoundationLogging.kt`:

```kotlin
package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.platform.telemetry.PhiSafeLogger
import kr.co.genomecompanion.platform.telemetry.SafeTelemetryContext
import kr.co.genomecompanion.platform.telemetry.TelemetryEvent
import org.slf4j.LoggerFactory
import org.slf4j.MDC
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.util.UUID

/** The only logger the foundation package uses: an event code, the correlation id, a route template and a truncated subject hash. */
@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationLogging {
    private val logger = PhiSafeLogger(LoggerFactory.getLogger("kr.co.genomecompanion.foundation"))

    fun event(event: TelemetryEvent, routeTemplate: String?, subjectHash: String?) {
        val correlation = MDC.get("correlation_id")?.let { runCatching { UUID.fromString(it) }.getOrNull() } ?: UUID(0, 0)
        MDC.put("subject_hash", subjectHash?.take(12) ?: "none")
        try {
            logger.emit(event, SafeTelemetryContext(correlation, routeTemplate, null, null))
        } finally {
            MDC.remove("subject_hash")
        }
    }
}
```

`logback-spring.xml` pattern adds ` subject_hash=%X{subject_hash:-none}`. In `FoundationLifecycleService`, after each `audit(...)` of a state change call `logging.event(TelemetryEvent.X, "/api/foundation/<template>", subjectHash(principal.subjectId))` (session created/ended, consent granted/revoked, document requested/uploaded/finalized/terminated, candidate confirmed/excluded, record corrected, export completed, deletion completed); `DocumentWorkerBoundaryService` logs `WORKER_JOB_LEASED/COMPLETED/FAILED` with `subjectHash = null`. Never pass anything else. `WorkerLog.kt`:

```kotlin
package kr.co.genomecompanion.documentworker

/** Stdout only. Event code, job id, failure code — nothing from a document. */
object WorkerLog {
    fun emit(event: String, jobId: String?, code: String? = null) {
        require(event.matches(Regex("^[a-z_]{3,40}$")))
        require(code == null || code.matches(Regex("^[a-z0-9_-]{3,80}$")))
        println("event=$event job_id=${jobId ?: "none"} code=${code ?: "none"}")
    }
}
```

`DocumentWorker.runOnce` calls `WorkerLog.emit("job_leased", lease.jobId)`, `"job_completed"`, `"job_failed", lease.jobId, code`; `main`'s loop logs `loop_error` with the exception class name as the code (`exception.javaClass.simpleName.lowercase().take(80)`) and nothing else.

- [ ] **Step 4: Run** the core class and worker tests → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core-api apps/document-worker
git commit -m "feat: PhiSafeLogger events for every lifecycle step, worker stdout events, log capture proves no value/label/filename/date

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 22: Worker health that can fail, `freshclam` in the image, loop that does not swallow OOM

**Files:**
- Create: `apps/document-worker/src/main/kotlin/kr/co/genomecompanion/documentworker/WorkerHealth.kt`
- Modify: `DocumentWorkerMain.kt` (`main`, `startLoopbackHealthServer`, `ClamAvCommandScanner`), `apps/document-worker/Dockerfile`
- Test: `apps/document-worker/src/test/kotlin/.../WorkerHealthTest.kt` (create)

**Interfaces:**
- Consumes: `BoundaryApiClient`, `WorkerConfiguration.clamscanPath`, `Clock`.
- Produces: `class WorkerHealth(coreProbe: () -> Boolean, signatureDir: Path?, maxSignatureAge: Duration = Duration.ofDays(7), loopHeartbeat: () -> Instant, clock: Clock) { fun check(): HealthReport }` with `data class HealthReport(val ready: Boolean, val code: String)` — codes `ready`, `core-unreachable`, `scan-unavailable` (no `main.cvd`/`main.cld` and `daily.cvd`/`daily.cld` in the signature dir), `signatures-stale` (newest signature file older than 7 days), `loop-stalled` (heartbeat older than 120 s), evaluated in that order; `/healthz` answers `200 ready` or `503 <code>`; `BoundaryApiClient.probe(): Boolean` (GET `/actuator/health` on the core origin, 2 s timeout, no auth header); the loop updates a `heartbeat` `AtomicReference<Instant>` each iteration, backs off `1 s, 2 s, 4 s … 30 s` on consecutive errors, catches `Exception` only (never `Throwable`/`OutOfMemoryError`), and a JVM shutdown hook finishes the in-flight job before exit (`Runtime.getRuntime().addShutdownHook`, join up to 30 s). The Dockerfile runs `freshclam` once at build time with a pinned `freshclam.conf` (`DatabaseMirror database.clamav.net`, `DatabaseDirectory /usr/local/share/clamav`) and copies the signatures into the runtime stage; when the build has no network, `freshclam` fails the build unless `--build-arg GC_ALLOW_OFFLINE_SIGNATURES=true` is given, in which case the image has no signatures and `/healthz` says `scan-unavailable`.

- [ ] **Step 1: Write the failing test**

```kotlin
package kr.co.genomecompanion.documentworker

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.FileTime
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset


class WorkerHealthTest {
    private val now = Instant.parse("2026-09-18T10:00:00Z")
    private val clock = Clock.fixed(now, ZoneOffset.UTC)

    @Test
    fun `reports the first failing check in order and ready when all pass`(@TempDir signatures: Path) {
        var core = false
        var heartbeat = now.minusSeconds(600)
        val health = WorkerHealth(coreProbe = { core }, signatureDir = signatures, loopHeartbeat = { heartbeat }, clock = clock)
        assertThat(health.check()).isEqualTo(HealthReport(false, "core-unreachable"))
        core = true
        assertThat(health.check()).isEqualTo(HealthReport(false, "scan-unavailable"))
        Files.writeString(signatures.resolve("main.cvd"), "x"); Files.writeString(signatures.resolve("daily.cld"), "x")
        Files.setLastModifiedTime(signatures.resolve("daily.cld"), FileTime.from(now.minus(Duration.ofDays(8))))
        Files.setLastModifiedTime(signatures.resolve("main.cvd"), FileTime.from(now.minus(Duration.ofDays(30))))
        assertThat(health.check()).isEqualTo(HealthReport(false, "signatures-stale"))
        Files.setLastModifiedTime(signatures.resolve("daily.cld"), FileTime.from(now.minus(Duration.ofDays(1))))
        assertThat(health.check()).isEqualTo(HealthReport(false, "loop-stalled"))
        heartbeat = now.minusSeconds(5)
        assertThat(health.check()).isEqualTo(HealthReport(true, "ready"))
    }

    @Test
    fun `a synthetic-scanner worker without a signature directory skips the signature checks`() {
        val health = WorkerHealth(coreProbe = { true }, signatureDir = null, loopHeartbeat = { now }, clock = clock)
        assertThat(health.check()).isEqualTo(HealthReport(true, "ready"))
    }
}
```

- [ ] **Step 2: Run to verify failure** — compilation error.

- [ ] **Step 3: Implement**

```kotlin
package kr.co.genomecompanion.documentworker

import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock
import java.time.Duration
import java.time.Instant

data class HealthReport(val ready: Boolean, val code: String)

/** Real checks in a fixed order; the first failure names the reason. `signatureDir == null` means the synthetic scanner (tests/e2e only). */
class WorkerHealth(
    private val coreProbe: () -> Boolean,
    private val signatureDir: Path?,
    private val maxSignatureAge: Duration = Duration.ofDays(7),
    private val loopHeartbeat: () -> Instant,
    private val clock: Clock,
    private val maxHeartbeatAge: Duration = Duration.ofSeconds(120),
) {
    fun check(): HealthReport {
        if (!runCatching { coreProbe() }.getOrDefault(false)) return HealthReport(false, "core-unreachable")
        if (signatureDir != null) {
            val main = firstExisting(signatureDir, "main.cvd", "main.cld")
            val daily = firstExisting(signatureDir, "daily.cvd", "daily.cld")
            if (main == null || daily == null) return HealthReport(false, "scan-unavailable")
            val newest = listOf(main, daily).maxOf { Files.getLastModifiedTime(it).toInstant() }
            if (Duration.between(newest, Instant.now(clock)) > maxSignatureAge) return HealthReport(false, "signatures-stale")
        }
        if (Duration.between(loopHeartbeat(), Instant.now(clock)) > maxHeartbeatAge) return HealthReport(false, "loop-stalled")
        return HealthReport(true, "ready")
    }

    private fun firstExisting(dir: Path, vararg names: String): Path? = names.map(dir::resolve).firstOrNull { Files.isRegularFile(it) }
}
```

`DocumentWorkerMain.kt`: `WorkerConfiguration` gains `signatureDir: Path?` from `GC_WORKER_SIGNATURE_DIR` (default `/usr/local/share/clamav` when `clamscanPath != null`, else null); `ClamAvCommandScanner` receives `database = signatureDir` so `clamscan --database=` and `--version` use the image's signature directory; `BoundaryApiClient.probe()` sends `GET <base>/actuator/health` with a 2 s timeout and returns `statusCode() == 200`; `startLoopbackHealthServer(port, health: WorkerHealth)` writes `200 ready` / `503 <code>` (`text/plain`, `Cache-Control: no-store`); `main`:

```kotlin
fun main(args: Array<String>) {
    val configuration = WorkerConfiguration.fromEnvironment()
    val scanner = configuration.clamscanPath?.let { ClamAvCommandScanner(it, configuration.requiredClamAvVersion, configuration.signatureDir) } ?: SyntheticManifestScanner()
    val client = BoundaryApiClient(configuration)
    val worker = DocumentWorker(configuration, client, PdfSecurityInspector(policy = PdfInspectionPolicy(), malwareScanner = scanner))
    val heartbeat = AtomicReference(Instant.now())
    val health = WorkerHealth(coreProbe = client::probe, signatureDir = configuration.signatureDir, loopHeartbeat = heartbeat::get, clock = Clock.systemUTC())
    configuration.healthPort?.let { startLoopbackHealthServer(it, health) }
    if (args.contains("--once")) { worker.runOnce(); return }
    val running = AtomicBoolean(true)
    val loop = Thread {
        var failures = 0
        while (running.get()) {
            heartbeat.set(Instant.now())
            val processed = try {
                worker.runOnce().also { failures = 0 }
            } catch (exception: Exception) {
                // Exception only: an OutOfMemoryError or other Error must end the process so the supervisor restarts it.
                failures += 1
                WorkerLog.emit("loop_error", null, exception.javaClass.simpleName.lowercase().take(80))
                false
            }
            if (!processed) Thread.sleep(minOf(30_000L, 1_000L shl minOf(failures, 5)))
        }
    }.also { it.name = "document-worker-loop"; it.start() }
    Runtime.getRuntime().addShutdownHook(Thread { running.set(false); loop.join(30_000); WorkerLog.emit("shutdown_complete", null) })
    loop.join()
}
```

Dockerfile (worker), in the `clamav` stage after the `dpkg-deb --extract`:

```dockerfile
ARG GC_ALLOW_OFFLINE_SIGNATURES=false
RUN printf 'DatabaseMirror database.clamav.net\nDatabaseDirectory /opt/clamav/share\nLogVerbose no\n' > /opt/clamav/freshclam.conf \
    && mkdir --parents /opt/clamav/share \
    && ( LD_LIBRARY_PATH=/opt/clamav/usr/local/lib64:/opt/clamav/usr/local/lib CVD_CERTS_DIR=/opt/clamav/usr/local/etc/certs \
         /opt/clamav/usr/local/bin/freshclam --config-file=/opt/clamav/freshclam.conf --stdout \
         || { [ "$GC_ALLOW_OFFLINE_SIGNATURES" = "true" ] && echo "offline build: no signatures; /healthz will report scan-unavailable"; } )
```

and in the runtime stage `COPY --from=clamav --chown=10001:10001 /opt/clamav/share/ /usr/local/share/clamav/` plus `ENV GC_WORKER_SIGNATURE_DIR=/usr/local/share/clamav`. (The `[ … ] && echo` returns non-zero when the arg is false, which fails the build — the intended behaviour.)

- [ ] **Step 4: Run** worker tests → PASS; `pnpm foundation:e2e` → `3 passed` (Playwright waits on `/healthz`; with the synthetic scanner `signatureDir` is null so the check passes as soon as core answers). `docker build --file apps/document-worker/Dockerfile .` locally is optional (Docker is not on this machine per the guide); CI's `image-smoke` job (Task 19) is the evidence.

- [ ] **Step 5: Commit**

```bash
git add apps/document-worker
git commit -m "feat(worker): real health checks (core, signatures, age, loop), freshclam in the image, loop backoff and graceful shutdown that never swallow OOM

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 23: Janitor — expired sessions/capabilities/idempotency keys, orphan quarantine files, stale queued jobs

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/FoundationJanitor.kt`
- Modify: `FoundationRepository.kt` (five sweep queries), `CoreApiApplication.kt` (`@EnableScheduling`), `application.yml` (`gc.foundation.janitor-interval: 5m`), `FoundationProperties.kt`
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: `deleteExpiredIdempotency` (Task 7), `FoundationDocumentStorage`, `Clock`.
- Produces: `@Component class FoundationJanitor(repository, storage, properties, clock, logging) { @Scheduled(fixedDelayString = "\${gc.foundation.janitor-interval:5m}") fun sweep(): JanitorReport }` with `data class JanitorReport(val sessions: Int, val capabilities: Int, val idempotencyKeys: Int, val orphanFiles: Int, val staleJobs: Int)`; repository: `deleteExpiredSessions(now)`, `deleteExpiredUploadCapabilities(now)`, `listKnownObjectKeys(): Set<Pair<StorageTrustZone, String>>`, `failStaleQueuedJobs(olderThan: Instant, now): List<UUID>` (jobs `QUEUED`/`FAILED_RETRYABLE` with `created_at < olderThan` → `FAILED_TERMINAL`, `failure_code = 'stale'`; their documents → `FAILED_TERMINAL`, `failure_code = 'stale'`, `state_version + 1`); storage: `listObjectKeys(): List<Pair<StorageTrustZone, String>>`. The janitor is a `@Scheduled` bean only when `gc.foundation.enabled`; tests call `sweep()` directly; each sweep logs one `TelemetryEvent.JANITOR_SWEEP` event.

- [ ] **Step 1: Write the failing test**

```kotlin
    @Test
    fun theJanitorSweepsExpiredRowsOrphanFilesAndStaleQueuedJobs() {
        val alice = login("synthetic-alice")
        val consentId = grantConsent(alice)
        val documentId = requestDocument(alice, consentId, fixturePdf, "janitor-doc")
        uploadDocument(alice, documentId, fixturePdf).andExpect(status().isOk)
        mutate(post("/api/foundation/documents/$documentId/finalization"), alice).andExpect(status().isAccepted)
        jdbc.update("UPDATE gc_session SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'")
        jdbc.update("UPDATE gc_upload_capability SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute', issued_at = CURRENT_TIMESTAMP - INTERVAL '2 minute'")
        jdbc.update("UPDATE gc_idempotency SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'")
        jdbc.update("UPDATE gc_document_job SET created_at = CURRENT_TIMESTAMP - INTERVAL '25 hours'")
        val orphan = quarantineRoot.resolve("untrusted").resolve("${UUID.randomUUID()}.pdf")
        Files.writeString(orphan, "%PDF-1.7\norphan synthetic\n%%EOF\n")
        val report = janitor.sweep()
        assertThat(report.sessions).isEqualTo(1)
        assertThat(report.capabilities).isEqualTo(1)
        assertThat(report.idempotencyKeys).isEqualTo(1)
        assertThat(report.orphanFiles).isEqualTo(1)
        assertThat(report.staleJobs).isEqualTo(1)
        assertThat(Files.exists(orphan)).isFalse()
        assertThat(Files.exists(quarantineRoot.resolve("untrusted").resolve("$documentId.pdf"))).isTrue()
        assertThat(documentStatus(documentId)).isEqualTo("FAILED_TERMINAL")
        assertThat(jdbc.queryForObject("SELECT failure_code FROM gc_document WHERE document_id = ?", String::class.java, documentId)).isEqualTo("stale")
        assertThat(count("gc_session")).isZero()
        read(get("/api/foundation/records"), alice).andExpect(status().isUnauthorized)
        assertThat(janitor.sweep()).isEqualTo(JanitorReport(0, 0, 0, 0, 0))
    }
```

(`@Autowired private lateinit var janitor: FoundationJanitor`.)

- [ ] **Step 2: Run to verify failure** — compilation error.

- [ ] **Step 3: Implement**

```kotlin
package kr.co.genomecompanion.foundation

import kr.co.genomecompanion.platform.telemetry.TelemetryEvent
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Duration
import java.time.Instant

data class JanitorReport(val sessions: Int, val capabilities: Int, val idempotencyKeys: Int, val orphanFiles: Int, val staleJobs: Int)

/** Periodic cleanup of everything that expires or can be orphaned. Idempotent; a second sweep finds nothing. */
@Component
@ConditionalOnProperty(prefix = "gc.foundation", name = ["enabled"], havingValue = "true")
class FoundationJanitor(
    private val repository: FoundationRepository,
    private val storage: FoundationDocumentStorage,
    private val clock: Clock,
    private val logging: FoundationLogging,
) {
    @Scheduled(fixedDelayString = "\${gc.foundation.janitor-interval:5m}")
    @Transactional
    fun sweep(): JanitorReport {
        val now = Instant.now(clock)
        val sessions = repository.deleteExpiredSessions(now)
        val capabilities = repository.deleteExpiredUploadCapabilities(now)
        val keys = repository.deleteExpiredIdempotency(now)
        val staleJobs = repository.failStaleQueuedJobs(now.minus(Duration.ofHours(24)), now).size
        val known = repository.listKnownObjectKeys()
        val orphans = storage.listObjectKeys().filter { it !in known }
        storage.deleteAll(orphans)
        logging.event(TelemetryEvent.JANITOR_SWEEP, null, null)
        return JanitorReport(sessions, capabilities, keys, orphans.size, staleJobs)
    }
}
```

Repository queries: `DELETE FROM gc_session WHERE expires_at <= ? OR revoked_at IS NOT NULL`; `DELETE FROM gc_upload_capability WHERE expires_at <= ?`; `listKnownObjectKeys` = union of `gc_document.object_key/approved_object_key` and `gc_preview_artifact.object_key` with their zones; `failStaleQueuedJobs` as two `UPDATE … RETURNING document_id` statements guarded by `status IN ('QUEUED','FAILED_RETRYABLE') AND created_at < ?`. Storage `listObjectKeys()` walks the three zone directories (files matching the object-key regex only; `.part` files older than one hour are orphans too). Add `TelemetryEvent.JANITOR_SWEEP("janitor_sweep")`. `@EnableScheduling` on `CoreApiApplication`; `spring.task.scheduling.pool.size: 1`.

Orphan files that the janitor removes are the retry path for Tasks 11 and 12 (a file that survived `afterCommit`).

- [ ] **Step 4: Run** the core class → PASS; `pnpm foundation:e2e` → `3 passed` (the schedule fires every 5 minutes and touches nothing live).

- [ ] **Step 5: Commit**

```bash
git add apps/core-api
git commit -m "feat(core): scheduled janitor for expired sessions, capabilities, idempotency keys, orphan files and stale jobs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 24: Migration-replay CI job and `GC_TEST_POSTGRES_URL` as a Gradle test input

**Files:**
- Modify: `.github/workflows/ci.yml` (new job `migration-replay`), `apps/core-api/build.gradle.kts`
- Test: the workflow run; locally `./gradlew.bat :apps:core-api:test --no-daemon` twice (second run re-executes the PostgreSQL class only when the variable changed)

**Interfaces:**
- Consumes: Flyway CLI is not installed; the job uses the application jar with `spring.flyway.target`.
- Produces: job `migration-replay` (`needs: []`, same postgres service) that (1) runs `./gradlew :apps:core-api:bootJar`, (2) starts the jar with `SPRING_FLYWAY_TARGET=12`, `GC_DATABASE_URL`, and `--spring.main.web-application-type=none --spring.main.lifecycle.timeout-per-shutdown-phase=1s` via a tiny runner flag `--gc.migrate-only=true` (an `ApplicationRunner` that exits after Flyway ran), (3) seeds rows with `psql`, (4) runs the jar again with `SPRING_FLYWAY_TARGET=latest`, (5) asserts with `psql` that the seeded rows survived, the idempotency row got `expires_at = created_at + 24h`, the audit trigger rejects an `UPDATE`, and the two aliases are present; the Gradle test task declares `inputs.property("gcTestPostgresUrl", System.getenv("GC_TEST_POSTGRES_URL") ?: "")` so `cleanTest` is no longer needed.

- [ ] **Step 1: Gradle inputs**

`apps/core-api/build.gradle.kts`:

```kotlin
tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    systemProperty("user.timezone", "UTC")
    // The PostgreSQL classes are gated by this variable; declaring it as an input re-runs them when it changes
    // and skips them when nothing changed — no more `cleanTest` ritual.
    inputs.property("gcTestPostgresUrl", System.getenv("GC_TEST_POSTGRES_URL") ?: "")
    inputs.property("gcTestQuarantineRoot", System.getenv("GC_TEST_QUARANTINE_ROOT") ?: "")
}
```

Verify: run `./gradlew.bat :apps:core-api:test --no-daemon` with the variable set (tests run), again (up-to-date), then with `GC_TEST_POSTGRES_URL=` unset (tests re-run, PostgreSQL classes skipped). Update Global Constraints' first bullet and `AGENTS.md`'s JVM row to drop `cleanTest`.

- [ ] **Step 2: Migrate-only runner**

`apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/MigrateOnlyRunner.kt`:

```kotlin
package kr.co.genomecompanion.platform

import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.SpringApplication
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.stereotype.Component
import kotlin.system.exitProcess

/** `--gc.migrate-only=true`: Flyway has already run when this executes; stop the context and exit 0. Used by the CI replay job. */
@Component
@ConditionalOnProperty(name = ["gc.migrate-only"], havingValue = "true")
class MigrateOnlyRunner(private val context: ConfigurableApplicationContext) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        val code = SpringApplication.exit(context, { 0 })
        exitProcess(code)
    }
}
```

- [ ] **Step 3: The job**

```yaml
  migration-replay:
    name: Flyway replay V1..V12 + seeded rows + V13
    runs-on: ubuntu-latest
    timeout-minutes: 25
    permissions:
      contents: read
    services:
      postgres:
        image: postgres:18.6-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2
        env:
          POSTGRES_HOST_AUTH_METHOD: trust
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10
    env:
      GC_DATABASE_URL: jdbc:postgresql://127.0.0.1:5432/postgres
      GC_DATABASE_USERNAME: postgres
      GC_DATABASE_PASSWORD: ""
      PGHOST: 127.0.0.1
      PGUSER: postgres
    steps:
      - name: Checkout immutable revision
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - name: Install Java toolchain
        uses: actions/setup-java@03ad4de0992f5dab5e18fcb136590ce7c4a0ac95 # v5.6.0
        with:
          distribution: temurin
          java-version: "21"
      - name: Configure Gradle
        uses: gradle/actions/setup-gradle@9c971963bec38e04b3d30dcc455b5382be2fdbfb # v6.3.0
      - name: Build the core-api jar
        run: ./gradlew :apps:core-api:bootJar --no-daemon
      - name: Apply V1..V12 only
        run: java -jar apps/core-api/build/libs/core-api.jar --spring.main.web-application-type=none --gc.migrate-only=true --spring.flyway.target=12
      - name: Seed representative rows on the V12 schema
        run: |
          psql -v ON_ERROR_STOP=1 <<'SQL'
          INSERT INTO gc_subject(subject_id, created_at) VALUES ('synthetic-replay', now());
          INSERT INTO gc_consent_grant(consent_id, subject_id, purpose_code, status, policy_version, granted_at)
            VALUES ('00000000-0000-0000-0000-0000000000c1', 'synthetic-replay', 'DOCUMENT_EXTRACTION', 'ACTIVE', 'v1', now());
          INSERT INTO gc_document(document_id, subject_id, consent_id, status, media_type, expected_length, created_at, expected_sha256, state_version, updated_at)
            VALUES ('00000000-0000-0000-0000-0000000000d1', 'synthetic-replay', '00000000-0000-0000-0000-0000000000c1', 'REVIEW_REQUIRED', 'application/pdf', 128, now(), repeat('a', 64), 3, now());
          INSERT INTO gc_extraction_job(job_id, document_id, subject_id, status, created_at, attempt) VALUES ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'synthetic-replay', 'COMPLETED', now(), 1);
          INSERT INTO gc_candidate(candidate_id, job_id, document_id, subject_id, status, ordinal, label, candidate_value, unit, observed_on, evidence_page, source_text_sha256, created_at, confirmed_at)
            VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'synthetic-replay', 'CONFIRMED', 1, 'replay-a', '1', 'mg/dL', '2026-07-28', 1, repeat('1', 64), now(), now()),
                   ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'synthetic-replay', 'PENDING', 2, 'replay-b', '2', 'mg/dL', '2026-07-28', 1, repeat('2', 64), now(), NULL);
          INSERT INTO gc_health_record(record_id, candidate_id, document_id, subject_id, label, confirmed_value, unit, observed_on, confirmed_at)
            VALUES ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'synthetic-replay', 'replay-a', '1', 'mg/dL', '2026-07-28', now());
          INSERT INTO gc_health_record_version(version_id, record_id, subject_id, status, value, supersedes_version_id, correction_reason, changed_at)
            VALUES ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1', 'synthetic-replay', 'SUPERSEDED', '1', NULL, NULL, now() - interval '1 minute'),
                   ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1', 'synthetic-replay', 'CURRENT', '3', '00000000-0000-0000-0000-0000000000b1', 'replay correction', now());
          INSERT INTO gc_idempotency(subject_hash, operation, idempotency_key, resource_id, created_at) VALUES (repeat('c', 64), 'CANDIDATE_CONFIRM', 'replay-key-0001', '00000000-0000-0000-0000-0000000000f1', now() - interval '1 hour');
          INSERT INTO gc_audit_event(event_id, subject_hash, actor_session_hash, event_type, resource_type, resource_id, outcome, occurred_at)
            VALUES ('00000000-0000-0000-0000-0000000000ae', repeat('c', 64), NULL, 'CANDIDATE_CONFIRMED', 'RECORD', '00000000-0000-0000-0000-0000000000f1', 'SUCCESS', now());
          SQL
      - name: Apply V13 on the populated schema
        run: java -jar apps/core-api/build/libs/core-api.jar --spring.main.web-application-type=none --gc.migrate-only=true
      - name: Assert the seeded rows survived and the new rules hold
        run: |
          psql -v ON_ERROR_STOP=1 <<'SQL'
          SELECT CASE WHEN (SELECT COUNT(*) FROM gc_candidate) = 2 THEN 1 ELSE 1/0 END;
          SELECT CASE WHEN (SELECT COUNT(*) FROM gc_health_record_version WHERE status = 'CURRENT') = 1 THEN 1 ELSE 1/0 END;
          SELECT CASE WHEN (SELECT expires_at = created_at + interval '24 hours' FROM gc_idempotency) THEN 1 ELSE 1/0 END;
          SELECT CASE WHEN (SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1) = '13' THEN 1 ELSE 1/0 END;
          SELECT CASE WHEN (SELECT aliases ? '혈압(수축기)' FROM gc_medical_concept WHERE concept_code = 'systolic-blood-pressure') THEN 1 ELSE 1/0 END;
          UPDATE gc_document SET status = 'TERMINATED_BY_REVOCATION' WHERE document_id = '00000000-0000-0000-0000-0000000000d1';
          DO $$ BEGIN
            BEGIN
              UPDATE gc_audit_event SET outcome = 'DENIED';
              RAISE EXCEPTION 'audit update must have been rejected';
            EXCEPTION WHEN OTHERS THEN
              IF SQLERRM NOT LIKE '%append-only%' THEN RAISE; END IF;
            END;
          END $$;
          SQL
```

(`spring.flyway.target=12` is honoured by Spring Boot's Flyway auto-configuration; the second run without a target applies everything after 12.)

- [ ] **Step 4: Validate the policy and commit**

`pnpm security:github-actions-policy` → PASS.

```bash
git add .github/workflows/ci.yml apps/core-api/build.gradle.kts apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/MigrateOnlyRunner.kt AGENTS.md
git commit -m "ci: replay V1..V12, seed rows, apply V13; declare GC_TEST_POSTGRES_URL as a Gradle test input

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 25: Web client fetch timeout and its Korean error

**Files:**
- Modify: `apps/web/lib/foundation/client.ts:353-376`, the component that renders `FoundationClientError` codes in Korean (grep `network_unavailable` under `apps/web/components` — one map; add the new code there)
- Test: `apps/web/tests/foundation-client.test.ts`, `apps/web/tests/korean-ux-copy.test.ts`

**Interfaces:**
- Consumes: `AbortSignal.timeout` (Node 24 and every supported browser).
- Produces: `FoundationErrorCode` gains `"request_timeout"`; `request()` passes `signal: AbortSignal.timeout(timeoutMs)` where `timeoutMs` is `20_000` for uploads (`PUT`) and `10_000` otherwise; an `AbortError`/`TimeoutError` rejection becomes `FoundationClientError("request_timeout", 0)`; Korean copy `서버 응답이 늦어져 요청을 멈췄어요. 잠시 후 다시 시도해 주세요.`; `createFoundationClient` accepts `timeouts?: { requestMs: number; uploadMs: number }` for tests.

- [ ] **Step 1: Write the failing tests**

```ts
it("aborts a request that exceeds the timeout and reports request_timeout", async () => {
  const fetcher = vi.fn((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  }));
  const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value", timeouts: { requestMs: 20, uploadMs: 20 } });
  await expect(client.getSession()).rejects.toMatchObject({ code: "request_timeout", status: 0 });
  const [, init] = fetcher.mock.calls[0] as unknown as [unknown, RequestInit];
  expect(init.signal).toBeInstanceOf(AbortSignal);
});
```

And in `korean-ux-copy.test.ts`: the error-map file contains `서버 응답이 늦어져 요청을 멈췄어요. 잠시 후 다시 시도해 주세요.`.

- [ ] **Step 2: Run to verify failure** — `timeouts` is not an option; the promise never settles (vitest times out).

- [ ] **Step 3: Implement**

```ts
type FoundationClientOptions = {
  fetcher?: Fetcher;
  readCsrfToken?: () => string | null;
  timeouts?: { requestMs: number; uploadMs: number };
};

const defaultTimeouts = { requestMs: 10_000, uploadMs: 20_000 };
```

In `request()`:

```ts
    const timeouts = options.timeouts ?? defaultTimeouts;
    const signal = AbortSignal.timeout(init.method === "PUT" ? timeouts.uploadMs : timeouts.requestMs);
    let response: Response;
    try {
      response = await fetcher(path, { ...init, headers, credentials: "include", cache: "no-store", redirect: "error", signal });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new FoundationClientError("request_timeout", 0);
      throw new FoundationClientError("network_unavailable", 0);
    }
```

Add `| "request_timeout"` to `FoundationErrorCode` and the Korean sentence to the component error map.

- [ ] **Step 4: Run** `pnpm web:test`, `tsc`, `pnpm foundation:e2e` → green.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): fetch timeouts with AbortSignal.timeout and a Korean request_timeout message

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 26: Honesty — audit-leak assertion over every text column, readiness anchor wording, report naming, evidence

**Files:**
- Modify: `FoundationRepository.kt:1498-1509` (`countRawHealthValuesInAudit`), `FoundationLifecyclePostgresIntegrationTest.kt` (existing leak assertions), `release/readiness.json` (`external_audit_anchor.evidence`, `evaluatedAt`), `docs/release/readiness.md`, `docs/status/2026-09-18/wave7.md`, `AGENTS.md`, `PROJECT_GUIDE.md` §2 table row for the audit anchor if one exists
- Test: `FoundationLifecyclePostgresIntegrationTest.kt`

**Interfaces:**
- Consumes: the V13 trigger (Task 7), `handLabelledAccuracy` (Task 13), Task 19/24 run URLs.
- Produces: `countRawHealthValuesInAudit(forbidden: List<String>): Long` counting rows whose `row_to_json(a)::text` contains any forbidden string; the service passes the fixed list `listOf("mg/dL", "g/dL", "%", "2026-")` plus nothing subject-specific (the receipt field `rawHealthValuesPresentInAudit` keeps its meaning: "does any audit row contain a unit or a date"); the integration test asserts `SELECT COUNT(*) FROM gc_audit_event a WHERE row_to_json(a)::text ~ '(188|5\.2|42|190|Cholesterol|HbA1c|Vitamin D|2026-07-28|120-199|\.pdf|\.png)'` is 0 after a full lifecycle.

- [ ] **Step 1: Replace the leak assertions**

In `persistsAttacksRevokesAndDeletesOneSyntheticLifecycle` and `storesAConfirmedExamDate…` replace the `event_type LIKE '%188%' …` queries with the `row_to_json(a)::text ~ '…'` form above (every text column, not three). Repository:

```kotlin
    fun countRawHealthValuesInAudit(forbidden: List<String>): Long =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM gc_audit_event a WHERE row_to_json(a)::text ~ ?",
            Long::class.java,
            forbidden.joinToString("|") { Regex.escape(it).removePrefix("\\Q").removeSuffix("\\E").replace(".", "\\.") },
        ) ?: 0L
```

(build the alternation by escaping `.` only; the fixed list has no other metacharacters). Service: `rawHealthValuesPresentInAudit = repository.countRawHealthValuesInAudit(listOf("mg/dL", "g/dL", "mmol/L", "2026-")) > 0`.

- [ ] **Step 2: Run** the core class → PASS.

- [ ] **Step 3: Readiness anchor wording**

`release/readiness.json` → `external_audit_anchor.evidence`: `"gc_audit_event and security_audit_event are append-only at the database (V3 and V13 triggers; PostgreSQL integration tests reject UPDATE and DELETE), but no separately permissioned external chain-head checkpoint has been exercised"`; `evaluatedAt` → `"2026-09-18"`. `docs/release/readiness.md`: change the sentence about the mutation guard to name both tables and keep "no external anchor". Verdict and every other gate untouched. Run `pnpm release:readiness:validate` → exit 0, `release-readiness: NO_GO 12 blocking gate(s) are not PASS`.

- [ ] **Step 4: Evidence file**

Complete `docs/status/2026-09-18/wave7.md` in the `gc-readiness-evidence` order: evidence date and revision (7a and 7b heads); executive result; live evidence table — every gate command with its last lines, the `native-text-gate` corpus ids and metrics (`conceptAccuracy` described as "runner and gold agree" and `handLabelledAccuracy` with its floor), the `genome-companion-ci` run URL for the 7b head with the `image-smoke` and `migration-replay` jobs green, the Trivy step names; findings (what remains: per-process limiter, no hosted run, subprocess render tested with one fixture only); readiness interpretation (`NO_GO` unchanged; only the anchor sentence changed); changes made; next safe sequence; founder-only actions (GHCR stop-ship unchanged). Use "not verified" wherever a URL is missing. Update `AGENTS.md` JVM gate row (no `cleanTest`) and the "Boundaries" paragraph with one clause: "confirmation values follow the worker grammar; `DOCUMENT_EXTRACTION` revocation terminates unfinished documents (`docs/status/2026-09-18/wave7.md`)".

- [ ] **Step 5: Final gates and commit**

Run every gate in Global Constraints and paste their last lines into the evidence file. Then:

```bash
git add apps/core-api release/readiness.json docs/release/readiness.md docs/status/2026-09-18/wave7.md AGENTS.md PROJECT_GUIDE.md
git commit -m "docs(evidence): audit-leak check over every column, append-only anchor wording, Wave 7 evidence

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Open PR `codex/wave13b-backend-hardening` → `codex/wave13-backend-hardening` titled `Wave 7b — security, API contract, operability, honesty`, body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Self-review

**Spec coverage.** §1 decision 1 → Task 6; decision 2 → Tasks 7 (status), 11; decision 3 → Task 13. §2: silent drop → Task 1; new grammar (value-before-label, continued label, `<`/`≤`/`>`, glued units, blood pressure, qualitative) → Tasks 2–3; multi-column/previous column → Task 3; dates → Task 4; DTO pattern and Korean copy → Task 5. §3 → Task 6 (all four spec cases). §4: idempotency columns/422/expiry/cleanup → Tasks 7, 23; `FOR UPDATE` and `check(it == 1)` → Task 8; framework exceptions/no-store/no echo → Task 9; same-day rule, ordering, sticky `CORRECTED` → Task 10; deletion order and table set → Task 12. §5: body caps and streaming → Task 14; session limits/lock/silent unknown/active capacity → Task 15; logout, hard expiry, cookie flags, CSRF header → Task 16; worker HMAC/rate limit/replay → Task 17; forward headers/actuator → Task 16; PDF hardening and render subprocess → Task 18; Trivy and smoke → Task 19; GHCR → unchanged, restated in Task 26. §6: OpenAPI + test, pagination, caps, nullability text, time rule → Task 20. §7: logging → Task 21; worker health/freshclam/loop → Task 22; janitor → Task 23; migration replay + Gradle input → Task 24; web timeout → Task 25. §8: audit assertion, trigger (V13 in Task 7), readiness wording, report rename, run ids → Task 26 (rename in Task 13's report change). §9 → Task 13. §10: concurrency two-thread → Task 8; log capture → Task 21; CI jobs → Tasks 19, 24; status doc and OpenAPI → Tasks 20, 26; two PRs → boundary before Task 14.

**Placeholder scan.** No "TBD/TODO/similar to Task N". Two deliberately open values exist by spec design and are pinned at execution time, not left blank: `handLabelledFloor` (Task 13 Step 6 copies the measured number) and the CI run URLs (Task 26 writes "not verified" until the run exists).

**Type consistency.** `RowParse.Skipped` (Task 1) is used by Tasks 2–3 and `RowGrammar.valueToken` is `internal val` (Task 2) read by Task 3's `mergeContinuedLabels`/`joinValueColumns`. `IdempotencyClaim`/`replayOrClaim` (Task 7) are used by Task 8; `FoundationUnprocessableException` (Task 7) and `FoundationPayloadCapException` (Task 20) both get controller handlers; `FoundationRateLimitedException(code, retryAfterSeconds)` is redefined in Task 15 and used by Task 17's 429. `TelemetryEvent.JANITOR_SWEEP` (Task 23) is added to the enum Task 21 extends. `WorkerLog.emit(event, jobId, code)` (Task 21) is what Task 22's loop calls. `TerminatedDocument`/`terminateDocumentsForRevokedConsent` (Task 11) replace the old `terminateDocumentJobsForRevokedConsent`. `listRecordsPage` (Task 20) and `listRecords` (Task 10) share the `r.record_id::text` order. `WorkerConfiguration.signatureDir` (Task 22) is passed to `ClamAvCommandScanner`'s existing `database` parameter.
