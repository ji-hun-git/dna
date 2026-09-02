# MVP step: multi-candidate review, visit preparation, and the agent operating system

**Status:** Design baseline for the 2026-09-02 implementation wave
**Date:** 2026-09-02 (Asia/Seoul)
**Scope:** synthetic-only product work plus repository tooling. No new external, provider, PHI, hosted, or clinical authority is requested or implied.
**Safety envelope:** every boundary in `PROJECT_GUIDE.md` section 6 stays in force. Nothing here diagnoses, labels normality, predicts risk, or touches real data.

## 1. Problem

The 2026-09-02 sanity check found a production-shaped synthetic foundation with strong security and evidence discipline. The product itself, however, still does one thing: for every allow-listed synthetic PDF, extraction inserts exactly one hard-coded candidate (`총콜레스테롤 188 mg/dL 2026-07-28`, see `DocumentWorkerBoundary.completeExtraction`). A user can confirm, correct, or exclude that one value and then see it on a one-column record list.

That is not the approved MVP journey. The program design (section 2.2) requires:

- several extracted fields per document, each confirmed individually;
- a timeline that shows several analytes and what changed over time;
- a source-linked visit-preparation summary the user can take to a professional.

The repository also has no agent-facing operating system beyond prose: no root `AGENTS.md`, no reusable skills, no agent definitions, and no enforced branch protection on `main`.

## 2. Goals

1. A synthetic document produces a small, deterministic, ordered set of candidates. The user reviews each one in turn and the document completes only when every candidate has a decision.
2. The record view shows several analytes grouped by observation date and document, with the existing provenance and version details intact.
3. A visit-preparation page turns confirmed records into a printable, source-linked list of neutral questions. It never interprets a value.
4. The repository ships a Claude Code operating layer: root `AGENTS.md`, project skills under `.claude/skills/`, and agent definitions under `.claude/agents/` that encode the safety boundaries and the change protocol.
5. Documentation reflects the above and the reviewed roadmap.

## 3. Non-goals

- Real OCR, model inference, or any parsing of uploaded PDF bytes. The candidate set is a fixture keyed to the allow-listed digest.
- Reference ranges, normal/abnormal labels, trend judgements, alerts, or advice of any kind.
- New routes on the Spring API outside `/api/foundation/**`.
- Any change to `release/readiness.json` gate statuses. Evidence text may be refreshed only from real runs.
- Any deployment, registry, AWS, or provider action.

## 4. Backend design (`apps/core-api`)

### 4.1 Candidate set

`SyntheticCandidateFixture` (new, `foundation` package) returns an ordered list for an approved source digest. The first release ships one set, applied to every allow-listed digest:

| ordinal | label | value | unit | observedOn | evidencePage |
|---:|---|---|---|---|---:|
| 1 | 총콜레스테롤 | 188 | mg/dL | 2026-07-28 | 1 |
| 2 | 당화혈색소 | 5.2 | % | 2026-07-28 | 1 |
| 3 | 비타민 D | 42 | ng/mL | 2026-07-28 | 1 |

Ordinal 1 is unchanged from today so the existing browser and PostgreSQL evidence keeps its meaning. `sourceTextSha256` is `sha256("label|value|unit|observedOn")` per candidate, as today.

### 4.2 Schema (Flyway `V6__multi_candidate_review.sql`)

- `ALTER TABLE gc_candidate ADD COLUMN ordinal INTEGER NOT NULL DEFAULT 1;`
- `ALTER TABLE gc_candidate ADD CONSTRAINT gc_candidate_ordinal CHECK (ordinal > 0);`
- `CREATE UNIQUE INDEX gc_candidate_document_ordinal_idx ON gc_candidate(document_id, ordinal);`

Existing rows keep ordinal 1.

### 4.3 State machine change

Today a document moves `REVIEW_REQUIRED -> COMPLETED` on the first confirmation or exclusion. New rule: the transition happens only when no `PENDING` candidate remains for that document. Both `createRecordFromCandidate` and `excludeCandidate` in `FoundationRepository` apply the same guarded update:

```sql
UPDATE gc_document d SET status = 'COMPLETED', completed_at = ?, state_version = state_version + 1, updated_at = ?
WHERE d.document_id = ? AND d.subject_id = ? AND d.status = 'REVIEW_REQUIRED'
  AND NOT EXISTS (SELECT 1 FROM gc_candidate c WHERE c.document_id = d.document_id AND c.status = 'PENDING')
```

`markExtractionCompleted` accepts the candidate list and inserts one row per candidate inside the same transaction. Consent revocation and profile deletion already cascade through `gc_candidate`; no change.

### 4.4 API

- `GET /api/foundation/documents/{documentId}/candidates` (new): ordered list of `CandidateReceipt`, all statuses. Requires owner and active consent, same as the singular endpoint.
- `GET /api/foundation/documents/{documentId}/candidate` (kept): returns the lowest-ordinal `PENDING` candidate; if none is pending, the lowest-ordinal candidate. Behaviour for a single-candidate document is unchanged.
- `CandidateReceipt` gains `ordinal` and `totalCandidates` (both positive integers).
- Confirmation, exclusion, record, correction, revocation, and deletion endpoints are unchanged.

### 4.5 Tests

- `FoundationLifecyclePostgresIntegrationTest`: extraction inserts three candidates; document stays `REVIEW_REQUIRED` after the first decision and becomes `COMPLETED` after the third; the `candidates` list endpoint is owner-scoped; the singular endpoint advances to the next pending candidate; the duplicate-delivery race still yields exactly one extraction and exactly three candidates.
- `ProhibitedRouteTest` and `ModuleBoundaryTest` stay green.
- OpenAPI contract test, if it covers foundation routes, is updated; otherwise no change.

## 5. Frontend design (`apps/web`, integrated synthetic UI only)

### 5.1 Client (`lib/foundation/client.ts`)

- `candidateSchema` adds `ordinal` and `totalCandidates`.
- `getCandidatesForDocument(documentId)` returns `FoundationCandidate[]` validated with `z.array(candidateSchema)`.

### 5.2 Review loop (`components/integrated/IntegratedHealthExperience.tsx`)

- On `REVIEW_REQUIRED`, load the candidate list; the active candidate is the lowest-ordinal `PENDING` entry.
- The review screen shows progress (`2 / 3`), the candidate, and the same three actions. After a decision the next pending candidate is shown without leaving the review view. When none remain, the completion screen summarises saved and excluded counts and links to `/records` and `/prepare`.
- Reload during review restores the loop from server state (already the pattern for the single candidate).
- The component is over 500 lines. Split the review screen into `components/integrated/CandidateReview.tsx` (presentational, props in, callbacks out) so it can be tested and given stories without the shell.

### 5.3 Records (`components/integrated/IntegratedRecords.tsx`)

- Group current records by `observedOn`, then by `documentSha256`. Within a group list every analyte with value, unit, and decision. Existing details (versions, digests, correction form) stay per record.
- No comparison, arrows, or colour that implies better or worse.

### 5.4 Visit preparation (`app/prepare/page.tsx`, `components/integrated/VisitPreparation.tsx`)

- Loads current records. For each record, prints label, value, unit, observation date, source page, short document digest, and decision.
- Attaches the same fixed, neutral question set to every record. Wording is decided here so agents do not invent clinical language:
  - 이 값은 어떤 검사에서 나온 건가요?
  - 지난 결과와 비교해 설명해 주실 수 있나요?
  - 다시 확인이 필요하다면 언제가 좋을까요?
- A visible note: "이 목록은 질문을 준비하기 위한 것이에요. 값의 의미나 건강 상태를 판단하지 않아요."
- A print button that calls `window.print()`; a print stylesheet hides navigation.
- Empty state links back to the home import flow.
- The page respects the same `GC_INTEGRATED_SYNTHETIC_UI` switch as the other integrated routes; in the concept mode it renders the concept placeholder that states the page is not connected.

### 5.5 Tests

- Vitest with MSW: review loop advances through three candidates and completes; reload restores the second candidate; records grouping; visit preparation renders records, questions, and the note, and passes axe.
- `korean-ux-copy.test.ts`: add the new user-facing components to the forbidden-term scan, and assert the visit-preparation note.
- Playwright `foundation-lifecycle.spec.ts`: confirm ordinal 1 as `190` (correction), confirm ordinal 2 as is, exclude ordinal 3; records shows two entries; `/prepare` lists two items; the rest of the revoke/delete flow is unchanged.

## 6. Design pass

A design agent produces `docs/design/2026-09-02-design-direction.md`: what the current visual system is (tokens, Pretendard/IBM Plex Mono, zinc palette, teal verified state), where the integrated screens drift from it, and a component inventory. It then applies a bounded polish: one shared `IntegratedShell` header/nav used by every integrated route, review progress and completion styling, records grouping styling, visit-preparation and print styles, Storybook stories for `CandidateReview` and `VisitPreparation`. No new dependencies. Axe and keyboard checks stay green at 200 percent.

## 7. Agent operating system

- Root `AGENTS.md`: the short operating contract (read order, boundaries, change protocol, gates, what needs founder authority). `CLAUDE.md` keeps pointing to `PROJECT_GUIDE.md` and adds a pointer to `AGENTS.md` and the skills.
- `.claude/skills/`:
  - `gc-sanity-check`: run the evidence-first audit from `SANITY_CHECK_PROMPT.md` and write a dated status report.
  - `gc-safe-change`: the ten-step change protocol, boundary checklist, and which local gates to run for each area.
  - `gc-korean-copy`: Korean user-facing copy rules, forbidden terms, tone, date format, non-diagnostic phrasing.
  - `gc-readiness-evidence`: how to update `release/readiness.json` and dated status reports from evidence only.
  - `gc-synthetic-fixture`: how to add or change synthetic fixtures and digests without ever touching real data.
- `.claude/agents/`: `gc-backend-engineer`, `gc-frontend-engineer`, `gc-design-reviewer`, `gc-safety-reviewer`, `gc-evidence-auditor`. Each names its file ownership, the skills it must load, and the gates it must run before reporting.
- Skills follow the `superpowers:writing-skills` structure and are validated with `skill-creator`'s quick checks where available.

## 8. Documentation updates

- `docs/reviews/2026-09-02-project-review.md`: the independent review and critique.
- `docs/roadmap/2026-09-02-roadmap.md`: the reviewed roadmap (value track, release ladder with the GHCR root cause, business validation, agent operating system).
- `PROJECT_GUIDE.md`: link the review, roadmap, `AGENTS.md`, and skills; refresh section 2 and 9 wording for the multi-candidate step; add the GHCR root cause to the stop-ship notice.
- `README.md` and `docs/superpowers/plans/README.md`: link the new documents and mark stale execution-status wording.
- `docs/product/intended-use-matrix.md`: add the visit-preparation capability row with its boundary.

## 9. Error handling

- Candidate list not ready: `404 candidate_not_ready`, UI shows the processing view and keeps polling.
- A decision on a non-pending candidate: `409 candidate_not_pending`, UI reloads the list and continues.
- Concurrent decisions from two tabs: idempotency and the `NOT EXISTS` guard make the completion transition exactly once.
- Visit preparation with a session error falls back to the same shell states as records.

## 10. Verification before merge

Local with the pinned toolchain: `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `pnpm web:test`, `pnpm research:test`, `pnpm --dir apps/web build`, `.\gradlew.bat test`. PostgreSQL-backed integration and the browser lifecycle run in CI; the PR is merged only on a green `genome-companion-ci` run. No readiness gate changes status because of this work.
