# Genome Companion Korea

Planning workspace for a Korea-first consumer health-data company. The project combines transparent, evidence-backed health-service information with a private longitudinal health companion. The initial design is deliberately narrower than a diagnostic platform and deliberately avoids copying a per-patient referral-commission model into Korean medical care.

## Current status

**Founder-approved planning. No product implementation has started.**

The founder approved all eight design decisions on 2026-08-09. The specification has been converted into a sequenced set of separate, test-first implementation plans and cross-workstream contracts. Product implementation remains gated on founder review and an explicit execution choice; production/beta additionally remains gated on Korean healthcare/privacy counsel and an MFDS intended-use classification review of the actual build.

## Strategic direction

The recommended launch wedge is:

> **A private annual-checkup and medical-record companion with transparent provider, non-covered-price, and evidence information.**

The genetic wallet remains a differentiated post-MVP module and may proceed only after its independent G0 gate. It is a device-only verifier and viewer for exact certified Korean laboratory-signed result-code tuples. Raw VCF/BAM/FASTQ, variants or alleles, scores, free-text genetic interpretation, server genetics APIs, network correction feeds, diagnosis, prescribing, and autonomous clinical agents are outside this product plan.

**Picking this up in a new session (human or Claude Code): start at [`CLAUDE.md`](CLAUDE.md).**
It gives the reading order, the current state, and the gates that must not be crossed.

## Planning artifacts

- [`CLAUDE.md`](CLAUDE.md) — resumption guide: reading order, current state, gates, working rules.
- [`docs/superpowers/specs/2026-08-08-genome-companion-program-design.md`](docs/superpowers/specs/2026-08-08-genome-companion-program-design.md) — approved design translated into the comprehensive technical/product specification.
- [`technical-architecture/open-source-register.md`](technical-architecture/open-source-register.md) — curated dependency shortlist, license posture, and adoption gates.
- [`research/sources/primary-source-register.md`](research/sources/primary-source-register.md) — authoritative source register for Korean data, standards, regulation, and security.
- [`governance/decision-log.md`](governance/decision-log.md) — decisions, assumptions, owners, and review triggers.
- [`risks/risk-register.md`](risks/risk-register.md) — initial product, technical, security, scientific, and regulatory risks.
- [`governance/founder-approval-2026-08-09.md`](governance/founder-approval-2026-08-09.md) — recorded resolution of all eight founder decision gates.
- [`governance/founder-brand-positioning-decision-proposal-2026-08-10.md`](governance/founder-brand-positioning-decision-proposal-2026-08-10.md) — unapproved category, longitudinal-model, experience-loop, and `앎 (ALM)` decision proposal derived from the later founder brief.
- [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md) — sequenced implementation roadmap and executable workstream plans.

## Workspace rules

1. User health and genetic data is never treated as ordinary analytics data.
2. Important claims require a primary source, access date, owner, and review date.
3. AI may explain verified facts; it may not create the clinical truth layer.
4. Every personalized explanation must retain source-data provenance, evidence provenance, uncertainty, and policy/template version.
5. Public aggregate/reference data and personal health data use separate ingestion paths, storage controls, and permissions.
6. No paid medical referral or success-fee workflow is built without a written Korean legal opinion.
7. No implementation phase begins until the founder reviews the indexed execution plans and explicitly selects an execution mode.

## Source materials

Original source material is preserved under `research/source-materials/`. Visual references are preserved under `product/visual-references/`.

`research/source-materials/2026-08-10-founder-brief-ko.txt` is a later founder brief (2026-08-10) covering category, brand philosophy, and naming. It is an input awaiting a decision, not an approved change to the specification.

This repository is a planning artifact, not medical advice or a formal legal opinion.
