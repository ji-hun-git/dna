# Genome Companion Korea

Korean-first consumer health-data product and engineering workspace. The project combines transparent, evidence-backed health-service information with a private longitudinal health companion. The product is deliberately narrower than a diagnostic platform and deliberately avoids copying a per-patient referral-commission model into Korean medical care.

## Current status

**Production-shaped synthetic foundation. Hosted staging and personal-data processing remain `NO_GO`.**

The repository now contains a Korean-first Next.js product, a Spring/Kotlin core API, a separate document worker, PostgreSQL/Flyway lifecycle evidence, a separate DataON/AIDA research runtime, CI security gates, attested runtime-image publication, and an unapplied AWS Seoul synthetic-staging foundation. The current release target is `HOSTED_SYNTHETIC_STAGING`; `release/readiness.json` remains `NO_GO`.

The first protected image publication succeeded for all three runtimes, but a 2026-09-02 audit found that the GHCR packages permit anonymous pulls even though the intended policy was private. These images are stop-ship and must not be deployed. Hosted AWS resources, Kakao/Naver/MyHealthWay integration, real medical AI, and real personal-health-data processing remain unavailable.

**New contributors and agents: read [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) first.** It is the current operating guide, evidence index, safety boundary, setup guide, and release sequence. Use [`SANITY_CHECK_PROMPT.md`](SANITY_CHECK_PROMPT.md) to initiate a fresh takeover audit.

## Strategic direction

The recommended launch wedge is:

> **A private annual-checkup and medical-record companion with transparent provider, non-covered-price, and evidence information.**

The genetic wallet remains a differentiated post-MVP module and may proceed only after its independent G0 gate. It is a device-only verifier and viewer for exact certified Korean laboratory-signed result-code tuples. Raw VCF/BAM/FASTQ, variants or alleles, scores, free-text genetic interpretation, server genetics APIs, network correction feeds, diagnosis, prescribing, and autonomous clinical agents are outside this product plan.

**Picking this up in a new session:** start at [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md).
`CLAUDE.md` remains as a compatibility pointer for older sessions.

## Planning artifacts

- [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) — canonical current-state, development, safety, and release guide.
- [`SANITY_CHECK_PROMPT.md`](SANITY_CHECK_PROMPT.md) — reusable evidence-first takeover prompt.
- [`docs/status/2026-09-02/sanity-check.md`](docs/status/2026-09-02/sanity-check.md) — latest dated audit and stop-ship finding.
- [`CLAUDE.md`](CLAUDE.md) — compatibility pointer to the canonical guide.
- [`docs/superpowers/specs/2026-08-08-genome-companion-program-design.md`](docs/superpowers/specs/2026-08-08-genome-companion-program-design.md) — approved design translated into the comprehensive technical/product specification.
- [`technical-architecture/open-source-register.md`](technical-architecture/open-source-register.md) — curated dependency shortlist, license posture, and adoption gates.
- [`research/sources/primary-source-register.md`](research/sources/primary-source-register.md) — authoritative source register for Korean data, standards, regulation, and security.
- [`governance/decision-log.md`](governance/decision-log.md) — decisions, assumptions, owners, and review triggers.
- [`risks/risk-register.md`](risks/risk-register.md) — initial product, technical, security, scientific, and regulatory risks.
- [`governance/founder-approval-2026-08-09.md`](governance/founder-approval-2026-08-09.md) — recorded resolution of all eight founder decision gates.
- [`governance/founder-brand-positioning-decision-proposal-2026-08-10.md`](governance/founder-brand-positioning-decision-proposal-2026-08-10.md) — unapproved category, longitudinal-model, experience-loop, and `앎 (ALM)` decision proposal derived from the later founder brief.
- [`governance/founder-final-direction-recommendation-2026-08-10.md`](governance/founder-final-direction-recommendation-2026-08-10.md) — founder-approved synthesis of the conversation, current competitor/category evidence, and the `앎`/Health History direction; public-brand clearance remains pending.
- [`governance/founder-execution-authorization-2026-08-10.md`](governance/founder-execution-authorization-2026-08-10.md) — founder approval of the `앎`/Health History direction and the bounded local execution mode.
- [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md) — sequenced implementation roadmap and executable workstream plans.

## Workspace rules

1. User health and genetic data is never treated as ordinary analytics data.
2. Important claims require a primary source, access date, owner, and review date.
3. AI may explain verified facts; it may not create the clinical truth layer.
4. Every personalized explanation must retain source-data provenance, evidence provenance, uncertainty, and policy/template version.
5. Public aggregate/reference data and personal health data use separate ingestion paths, storage controls, and permissions.
6. No paid medical referral or success-fee workflow is built without a written Korean legal opinion.
7. No external, destructive, provider, PHI, clinical-claim, or deployment gate is crossed without the exact authority and runtime evidence required by `PROJECT_GUIDE.md` and `release/readiness.json`.

## Source materials

Original source material is preserved under `research/source-materials/`. Visual references are preserved under `product/visual-references/`.

`research/source-materials/2026-08-10-founder-brief-ko.txt` is a later founder brief (2026-08-10) covering category, brand philosophy, and naming. It is an input awaiting a decision, not an approved change to the specification.

This repository is a product-engineering workspace, not medical advice or a formal legal opinion.
