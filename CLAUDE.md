# CLAUDE.md — how to pick this project up

이 저장소는 **코드가 아직 한 줄도 없는 기획 저장소**입니다. 승인된 설계와 실행 계획만
들어 있고, 구현은 창업자의 실행 모드 선택 이후에 시작합니다. 새 세션은 아래 순서대로
읽으면 맥락이 복원됩니다.

This repository is a **planning workspace with no implementation yet**. There is no build,
no test suite, no dependency manifest, and no application code. Everything here is a
reviewed document. Do not "fix" that by scaffolding an app — implementation is gated
(see [Gates](#gates)).

## Read in this order

1. [`README.md`](README.md) — what the product is and what it deliberately is not.
2. [`docs/superpowers/specs/2026-08-08-genome-companion-program-design.md`](docs/superpowers/specs/2026-08-08-genome-companion-program-design.md)
   — the approved program and technical design. The single source of truth for scope.
3. [`governance/founder-approval-2026-08-09.md`](governance/founder-approval-2026-08-09.md)
   — the eight decisions the founder approved, and exactly what that approval does *not* authorize.
4. [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md) — the roadmap:
   six workstreams (FND, PUB, REC, AI, UX, GEN), their dependency order, waves, and checkpoints C0–C6/G0.
5. [`governance/decision-log.md`](governance/decision-log.md) — D-001…D-029, each with a revisit trigger.
6. [`risks/risk-register.md`](risks/risk-register.md) and
   [`research/sources/primary-source-register.md`](research/sources/primary-source-register.md).

Depth on any single workstream lives in its plan file under `docs/superpowers/plans/`.
Those are long (1.4k–6.2k lines); read the one you are working on, not all six.

## Current state

- **Design: approved** (2026-08-09, all eight gates).
- **Plans: written and reviewable, none executed.** Every workstream row in the roadmap
  says "Plan-ready; not executed".
- **Implementation: not started, and not authorized to start.**
- **Open input, decision proposal prepared but not approved:** [`research/source-materials/2026-08-10-founder-brief-ko.txt`](research/source-materials/2026-08-10-founder-brief-ko.txt)
  (2026-08-10, Korean). It reframes category/brand — *AI-native Preventive Health*,
  product = *Personal Health Intelligence*, core asset = *Longitudinal Personal Health Model*,
  Collect → Connect → Know, and proposes the service name **앎 (ALM)** with
  "Health is knowledge of oneself" as the brand line. D-030/D-031 and
  [`governance/founder-brand-positioning-decision-proposal-2026-08-10.md`](governance/founder-brand-positioning-decision-proposal-2026-08-10.md)
  now isolate the decisions and retained boundaries. **The proposal is not approval:** the
  spec, D-016, product plans, workstream status, and implementation gate remain unchanged.

## Gates — do not cross these without a written approval in `governance/`

- No implementation phase begins until the founder reviews the indexed plans and explicitly
  selects an execution mode (D-021).
- No real personal health data, ever, in this repository or in any lower environment.
  Synthetic fixtures only, marked `SYNTHETIC`.
- No paid medical referral or success-fee workflow without a written Korean legal opinion (D-005).
- Genetics (GEN) stays blocked behind a signed G0 envelope; device-only, certified-result
  tuples only — never raw VCF/BAM/FASTQ, variants, scores, or a server genetics API (D-007).
- Production/beta additionally requires Korean healthcare/privacy counsel and an MFDS
  intended-use classification of the actual build.
- Anything on the scope-change list in the roadmap needs a **new spec and plan**, not an
  extra task bolted onto an existing one.

## Working rules for a session here

- Every important claim needs a primary source, access date, owner, and review date;
  add it to the primary-source register.
- Any change to medical claims, personal-data flow, AI tool access, storage geography,
  referral mechanics, or a launch safety boundary **must add a row to the decision log**
  with owner, evidence link, approval date, and rollback trigger.
- Korean-first for user-facing copy; the planning documents themselves are in English.
- When execution does begin: isolated worktree, one plan task at a time, red/green test
  cycle, commit per task, and stop at every named checkpoint.

## Repository shape

Tracked content is documents only. Several top-level directories
(`business-model/`, `competitors/`, `customer-niches/`, `market-sizing/`, `mvp/`,
`pricing/`, `privacy-security/`, `regulatory/`, `reports/`, `experiments/`,
`go-to-market/`, `dna-analysis/`, `medical-record-analysis/`) exist locally as empty
placeholders and therefore do not appear on GitHub. Create them with real content when
there is real content to put in them.

`.gitignore` blocks genomic and clinical file types (`*.vcf`, `*.bam`, `*.fastq`, `*.dcm`)
and `private-data/`, `user-data/`, `uploads/`, `exports/`. **This repository is public** —
keep it that way only as long as nothing personal enters it.
