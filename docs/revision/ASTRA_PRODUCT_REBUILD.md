# 앎 — product rebuild evidence ledger

Evidence date: 2026-09-07, Asia/Seoul. Baseline `4210af7`. Working branch:
`codex/unified-health-product`. This is a live work ledger, not a release approval.

## 1. Executive Verdict

LOCAL UNIFICATION IMPLEMENTED; broader rebuild IN PROGRESS. Hosted synthetic staging remains **NO_GO**. No PHI, provider account,
paid inference, or production activation is part of this change.

## 2. Product Thesis

Fragmented result documents become source-verifiable, user-confirmed longitudinal
records that support better conversations at the next visit. Provenance,
confirmation, continuity and preparation are the product; diagnosis is not.

## 3. Verified Baseline

- Correct repository: `ji-hun-git/dna`, Genome Companion Korea UX worktree, not buup.
- Clean main at `4210af7` before branching. Seven current main check-runs report success.
- Actual default root opened locally: static 17-record summary, in-memory review,
  unrelated historical records, no primary preparation destination.
- Spring/PostgreSQL and a separate document worker already implement a synthetic
  lifecycle. Existing browser test covers two dated candidate sets, decisions,
  reload, revocation and profile deletion. Re-executed successfully on this branch; see §23.
- GitHub main protection GET returned 404 at baseline; subsequently enabled under the
  user's explicit instruction (§21).

## 4. Current Split Architecture

| Hypothesis | Baseline | Evidence |
|---|---|---|
| A: default memory product | CONFIRMED | `app/page.tsx` flag branch |
| B: demo decisions are not server records | CONFIRMED | `HealthExperience` local state vs foundation client |
| C: default Prepare disconnected | CONFIRMED | `PrepareConceptNotice` branch |
| D: parallel data controls | CONFIRMED | `DataControlCenter` vs `IntegratedDataControl` |
| E: technical entry | CONFIRMED | subject/credential form in integrated home |
| F: duplicate features | CONFIRMED | four route-level mode branches |

All six baseline defects are repaired at the primary route boundary in this branch.
Prototype source files remain for isolated stories/tests, not as a second routed product.

## 5. Target Unified Architecture

PostgreSQL owns durable state. Spring owns identity, consent, transitions, records,
provenance and deletion. Next presents validated server responses. The isolated
worker receives bounded jobs. Research retains its separate runtime. No Next API
mutation handler or model credential will be introduced.

## 6. Core User Journey

Explicit synthetic bootstrap → consent → allowlisted PDF → candidate/source review
→ confirm/correct/exclude → durable records → dated comparison → visit questions.
Session restoration must recover pending work; no static substitution on errors.

## 7. Health Data Domain Model

Existing domain distinguishes documents, candidates, decisions and versioned records.
`CURRENT`/`SUPERSEDED` describes record versions; `CONFIRMED`/`CORRECTED` describes
user action. Neither is clinical validation. FHIR/KR Core conformance and
MyHealthWay authorization are independent, unproven claims.

## 8. Provenance Model

Document digest → candidate digest/page/method → explicit decision → current record
version → deterministic comparison/question. Existing previews are synthetic
derivatives, not OCR evidence. An inspectable digest is not proof of extraction
accuracy. Missing source must remain visibly unavailable, never silently replaced.

## 9. Import Pipeline

Digest allowlist → bounded upload → untrusted storage → inspection → approved bytes
→ leased worker → synthetic preview/candidates → review. The existing fixture
catalogue is selected by digest, not parsed from PDF content. Native-text parsing,
OCR and model extraction are future providers and must not inherit a PASS claim.

## 10. Confirmation Lifecycle

Spring remains transition authority. Idempotency keys and pending-state checks must
protect retries. Correcting a stored record creates a new version. Exclusion must
never create a record. User confirmation means “the document says this”, not “this
is medically correct”. Current fixture review needs an adjacent limitation.

## 11. Longitudinal Records

Reuse the existing date/document grouping and same-label/unit two-date comparison.
Never interpret increasing/decreasing values as good/bad. Use actual current
versions and exclude superseded or excluded values from derived views.

## 12. Visit Preparation

Target: at most three deterministic, neutral questions total, with source record
IDs and dates. Repeated generic questions per record are the baseline defect.
Printing is browser-mediated; no “saved” claim without persistent storage.
Implemented in `apps/web/lib/records/visit-questions.ts`: group CURRENT versions by
exact label and unit, choose latest and previous distinct dates, cap three topics;
source record links resolve to the same records page. No clinical priority ranking.

## 13. Astra / AI Architecture

No model endpoint or API model ID is inferred from this prompt's title. Production
inference is disabled. Preserve schema-first, provider-neutral extraction contracts;
document content is untrusted evidence, never policy or tool authority. Current
health truth is structured data, not chat memory or vector retrieval. Model failure
must leave committed records untouched. Future routing: native text/parser first,
OCR for images, bounded model calls only for unresolved ambiguity.

## 14. Privacy

Use generated synthetic bytes only. Do not send record content to analytics, model
services, logs or external screenshot services. Profile deletion must remove
document/candidate/record derivatives and revoke sessions; hosted backup replay is
still unverified. No promise of complete backup deletion is justified.

## 15. Security

New bootstrap must be opt-in, exact-origin checked, randomly owner-isolated,
rate/budget bounded in the database, and must not grant processing consent.
Existing session-bound CSRF and ownership checks remain mandatory afterwards.
Review uses React-escaped text and same-origin approved preview URLs. No authentication secret in
client bundles or browser storage. Bootstrap is disabled by default, provisions a
random owner and no consent, and caps the database at 20 demo subjects per rolling
minute and 1,000 demo subjects over its lifetime, including deleted subjects. This
is a local abuse budget, not a hosted DDoS defense or user-recoverable account.
Rate exhaustion returns 429/Retry-After; lifetime capacity exhaustion returns a
distinct operator-action failure without promising that waiting will solve it. Audit is hash-chained/tamper-evident, not immutable.

## 16. Frontend Architecture

Retain Pretendard, mono evidence typography, monochrome surfaces and existing tokens.
Retire route-level memory truth; retain isolated prototype stories only where useful.
No new component library dependency is required.

Design reference inspection (2026-09-07):

- [Beautiful UI](https://www.beautifului.dev/): composable information/control patterns;
  do not import AI-chat identity into the health record.
- [UI Skills](https://www.ui-skills.com/): evidence-based UI evaluation as reference;
  no wholesale skill installation or conflicting style mandate.
- [Amicro](https://amicro.vercel.app/): small action feedback, not looping decoration.
- [Efferd](https://efferd.com/): restrained auth composition; keep existing primitives.
- [Movin](https://movin.design/): motion reference gallery, not a dependency.
- Aesthetic Cards: exact intended project could not be identified reliably from the
  name. Do not attribute unrelated card libraries to it.
- [shadcn/ui](https://ui.shadcn.com/docs): composability and predictable primitives,
  not a requirement to replace the existing visual system.

## 17. Navigation

One primary menu: 홈 / 기록 / 진료 준비 / 데이터. Connections belong under Data;
public provider exploration is a secondary public-information lab. Focused import
steps may use back/close controls but must return to this same application.

## 18. Korean UX Writing

Use direct 해요체. Replace technical IDs and backend names in normal UI. Review asks
“결과지에 이렇게 적혀 있나요?” with adjacent synthetic limitation. Every value needs
a nearby “예시 데이터” marker. Do not imply live providers or medical interpretation.

## 19. Accessibility

QA inventory: keyboard focus, labelled forms, errors, reduced motion, 44px controls,
source disclosure, pending/save states, all four destinations, zoom/reflow. Automated
axe is useful but not a real screen-reader pass.

## 20. Mobile QA

Required viewports: 390×844, 430×932, 768×1024, 1280×720, 1440×900, 1920×1080.
Capture initial entry, review, correction, populated records and preparation.
Check horizontal overflow, sticky controls, focus and source readability separately.
Current status: the real loopback stack produced 43 screenshots: seven states × six
viewports, plus mobile correction. Browser assertions verify horizontal overflow and
all three review actions' visible bounds and minimum 44px dimensions. Visual review
found and corrected the mobile action grid, entry CTA styling and oversized record
headings. The post-correction matrix and production build passed again (§23).
200%- and 400%-equivalent keyboard reflow (640px/320px for a 1280px viewport) pass.
These are viewport reflow tests, not an actual browser zoom or real screen-reader test.

## 21. Release Architecture

Hosted runtime is not deployed. Existing Seoul IaC is an unapplied foundation, not a
working service. Exact account/OIDC/state identifiers and reviewed cloud plan remain
necessary. Do not delete existing public packages or accept public deployment by
implication. Private ECR is the intended deployment destination; provisioning and
anonymous-denial verification remain required.

Documentation correction identified: the claim that `github.token` necessarily
inherits a public repository's package visibility is unsupported. GitHub distinguishes
access permissions from package visibility and documents default private visibility.
[Official container-registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
Observed public availability remains a stop-ship independent of that unknown cause.

GitHub changes verified on 2026-09-07:

- Main now requires one approving PR review, dismisses stale approvals, requires all
  seven existing CI job contexts against an up-to-date branch, enforces admins,
  requires conversation resolution, and prohibits force-push/deletion.
- `publish-runtime-images.yml` (workflow 346395046) reports `disabled_manually`.
- No image deletion, acceptance of public deployment, ECR apply or provider change.

## 22. Implemented Changes

- Four primary routes always render the same integrated lifecycle. No UI feature
  flag, memory-demo fallback or static record substitution remains in those routes.
- `POST /api/foundation/demo-session`: opt-in Spring-owned origin-bound bootstrap,
  HttpOnly SameSite session, existing session-bound CSRF thereafter, durable budget.
- Browser-generated, clearly marked January/July example PDFs contain the values
  shown in review. Digest allowlisting remains authoritative; the backend still
  selects a fixed catalogue, not OCR/parsing. Manual allowlisted selection remains.
- Pending review resumes after reload or close/reopen. Home source links lead to
  the durable record's approved preview; the old separate EvidenceLens is no
  longer a routed business path.
- Review has focus handoff, inspectable/collapsible approved preview, correction,
  exclusion, sticky mobile actions, and missing-preview confirmation denial.
- Records retain versioned correction lineage, same-unit date comparison and source
  PNG retrieval with explicit failure/retry; no raw untrusted PDF route is introduced.
- Preparation builds at most three fixed questions from those exact current records.
  Source values/dates are compact, technical confirmation metadata is disclosed.
- Four-destination mobile navigation; connections and public provider lab are
  secondary Data destinations. Consent revocation/deletion still use actual receipts.
- Existing fonts/tokens retained. No additional design dependency or model SDK.
- `pnpm dev:synthetic` launches the real local stack against an explicitly designated
  loopback synthetic PostgreSQL database. Isolated child environment allowlists keep
  provider/research/model settings out; worker/web do not receive database credentials.
  It refuses occupied ports and does not delete/reset a database. Windows startup,
  proxied bootstrap 201, empty records 200, deletion 200/COMPLETED and shutdown with
  all three listener ports closed were observed. [Run instructions](../operations/local-development.md).

Not implemented: authenticated cross-session return, live document parsing/OCR,
model execution, hosted storage/queue adapters, account-backed deployment, or real
personal-data access. This is not a completed commercial MVP.

## 23. Test Evidence

Local 2026-09-07 evidence: Node 24.20.0, pnpm 11.20.0, Java 21, PostgreSQL 16.14.

| Check | Result and scope |
|---|---|
| Baseline web | 145 tests passed before changes |
| Red/green | Bootstrap route, unfinished review resume, lifetime budget and local-runner specifications failed before their implementation and passed afterwards |
| Updated web | 156 tests / 37 files passed |
| JVM | XML reports: 94 cases, 91 passed / 3 skipped / 0 failures / 0 errors; unchanged worker/boundary tasks were UP-TO-DATE |
| Browser | 3 passed against separate Spring/worker/Next: two dated documents, all review decisions, corrected lineage, first-document-only Prepare, source PNG, reload, revocation and deletion, 200%/400%-equivalent keyboard reflow |
| Viewports | Final 43 screenshots: seven states × six sizes + mobile correction; no horizontal overflow, all three review buttons at least 44px and inside viewport |
| Production build | Final Next 16.3.3 build compiled/typechecked and generated 9/9 static pages |
| Policy | Runtime, Actions, auth-security and readiness validation pass; release remains NO_GO with 12 unresolved blocking gates |
| Branch CI | Consult exact-head PR checks / [branch workflow](https://github.com/ji-hun-git/dna/actions/workflows/ci.yml?query=branch%3Acodex%2Funified-health-product). This file records local runs; historical main checks do not verify this branch |

Skipped cases: Docker-backed cases in `ConsentJdbcRepositoryTest` and
`SyntheticFhirEvidenceProjectorTest`, and `ClamAvCommandScannerIntegrationTest`
(no local scanner binary). CI must execute its own PostgreSQL/scanner/container matrix.

Commands actually run using the pinned Node executable, with working directories
shown below; the workstation's global runtime was not used:

```text
apps/web: node node_modules/vitest/vitest.mjs run --maxWorkers=2
  Test Files 37 passed; Tests 156 passed
root: gradlew.bat test --no-daemon (GC_TEST_POSTGRES_URL set to disposable PostgreSQL)
  BUILD SUCCESSFUL; XML reports: 94 tests, 3 skipped, 0 failures/errors
apps/web: node node_modules/@playwright/test/cli.js test --config playwright.foundation.config.ts
  3 passed (1.5m)
apps/web: node node_modules/next/dist/bin/next build
  Compiled successfully; Finished TypeScript; Generated 9/9 static pages
root: node scripts/security/check-runtime-policy.mjs
  runtime-policy: PASS node=24.20.0 pnpm=11.20.0 next=16.3.3
root: node scripts/security/check-github-actions.mjs
  github-actions-policy: PASS
root: node apps/web/scripts/check-auth-security.mts
  auth-security-gate: PASS
root: node scripts/release/check-readiness.mjs --validate-only
  NO_GO 12 blocking gate(s) are not PASS; valid snapshot, exit 0
root: node scripts/release/check-readiness.mjs
  NO_GO 12 blocking gate(s) are not PASS; exit 1 expected
```

Local PostgreSQL is disposable synthetic-only, not a hosted database. Browser runs
inject synthetic scanner results and fail first extraction to exercise retry; they
do not prove a live ClamAV engine. No blanket security/accessibility pass is claimed.

## 24. Product Metrics

No external tracking enabled. Research protocol: ask participants to add a synthetic
document, decide three values, locate the source, compare dates, prepare questions,
and explain whether the app judged their health. Record time to first confirmed
record, assistance/errors, source recall, boundary understanding and second-document
intent. Positive interview feedback is not observed task success or willingness to pay.
Monetization hypotheses: repeated visit preparation and longitudinal organization;
no billing, family feature or paid referral implementation in this rebuild.

## 25. Trust Debt

| ID | Debt | Status |
|---|---|---|
| T1 | default demo and durable app diverge | fixed at primary routes; regression guard added |
| T2 | technical credentials as front door | fixed for bounded synthetic entry; no recoverable account yet |
| T3 | synthetic preview can be mistaken for extracted source | local example labels and fixed-catalogue disclosure; extraction accuracy still unproven |
| T4 | repeated preparation questions | fixed: max three, exact current sources |
| T5 | shared shell missing in secondary routes/mobile | fixed; actual zoom/screen reader remain open |
| T6 | registry root-cause assertion unsupported | guide corrected; cause unknown, publishing paused |
| T7 | hosted privacy/security operational evidence missing | blocked on target infrastructure |

Claim register: “사용자 확인” = explicit decision only; “예시 데이터” = generated
catalogue only; “삭제 완료” = actual server response, not backup erasure; “연결” = zero
live external providers; “출처” = digest/page plus labelled synthetic derivative;
“진료 준비” = grounded fixed questions, not advice. No blanket “안전하게 저장” claim.

## 26. Kill List

KEEP server lifecycle, worker boundary, provenance, tokens. MERGE route entrypoints.
SIMPLIFY repeated task heroes and technical detail. DEMOTE provider explorer.
REMOVE reachable memory-only business lifecycle. DEFER diagnosis, family accounts,
payments, live connectors and generative clinical answers.

## 27. Remaining Blockers

Cloud account/OIDC/private state identifiers, reviewed infrastructure plan and actual
deployment; private registry denial proof; hosted IAM/queue/log/backup/anchor probes;
independent PR review; actual browser zoom and real screen-reader testing; observed user research. Secrets
must be supplied through approved secret stores, never chat. Real PHI remains prohibited.

## 28. Roadmap

| Milestone | State / next evidence |
|---|---|
| M1 unified entry / bounded bootstrap | implemented locally |
| M2 same-record preparation | implemented locally; no generative inference |
| M3 unified navigation | implemented locally |
| M4 mobile review | browser matrix + 200%/400%-equivalent keyboard; actual zoom/screen reader pending |
| M5 inspectable provenance | approved PNG and version lineage implemented; no OCR-accuracy claim |
| M6 provider-neutral extraction | existing contracts only; real provider/parser execution deferred, not complete |
| M7 data controls | existing durable consent/deletion retained; backup replay and export unverified/not implemented |
| M8 release evidence | main protected, publishing paused; private ECR/hosted runtime blocked |
| M9 observed validation | protocol only; no participant outcome or payment evidence |

Next highest-leverage work is the private synthetic hosting boundary, not another
visual redesign. Obtain non-secret account/OIDC/state identifiers, build and test
S3/SQS runtime adapters, review the account-backed plan, then apply only within a
confirmed target and validate denial/TLS/restore/deletion probes. Independently,
run observed synthetic task sessions and actual browser zoom/screen-reader checks.

Cross-session identity is also required before claiming “come back months later.”
The current 30-minute default synthetic session cannot be recovered after expiration
or cookie loss; a new bootstrap creates a different owner. Durable storage within
that identity does not establish long-term consumer retention.

Do not declare the major milestone complete while hosted operational gates remain open.
