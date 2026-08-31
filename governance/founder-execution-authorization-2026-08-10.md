# Founder Execution Authorization — 2026-08-10

**Approver:** Founder

**Approval statement:** The founder affirmed the final-direction recommendation and instructed the project to proceed with actual development, design, and implementation.

## Approved direction

The founder approves [`founder-final-direction-recommendation-2026-08-10.md`](founder-final-direction-recommendation-2026-08-10.md) with these binding interpretations:

- `앎` is the Korean-first consumer-brand direction; public adoption remains conditional on trademark, app-store, domain, language, accessibility, privacy, advertising, and intended-use clearance.
- The company is a Korea-first longitudinal personal health intelligence company.
- The defining product object is a source-verifiable, user-correctable Health History beginning with multi-year Korean health-checkup and common laboratory records.
- Provider and non-covered-price information supports the journey but does not define the company.
- General medical chat, diagnosis, treatment, prevention-efficacy claims, wet-lab ownership, continuous monitoring, and genetics do not define the MVP.
- `Genome Companion` and `gc-*` remain the technical identifiers until the public-brand migration gate passes.

## Selected execution mode

The founder selects **dependency-ordered, checkpointed local implementation**:

1. work in an isolated Git worktree on `codex/*` branches;
2. execute one indexed plan task at a time, beginning with FND Task 1;
3. use the plan's RED → minimal implementation → GREEN → commit cycle;
4. preserve cross-workstream interfaces and stop at every named checkpoint;
5. use only clearly marked synthetic fixtures until a separate personal-data study authorization exists;
6. design and implementation may proceed together, but visual work may not weaken provenance, accessibility, consent, privacy, or intended-use controls;
7. install and use reviewed development/design/QA/security skills where they respect the approved plans and repository boundaries.

## This authorization permits

- local application and test implementation;
- local UI/design-system work using synthetic content;
- dependency-lock, supply-chain, security, accessibility, and test tooling required by the indexed plans;
- local commits on isolated implementation branches;
- local development services containing synthetic data only.

## This authorization does not permit

- production, beta, preview, or public deployment;
- cloud or other external-account creation or mutation;
- procurement, paid API use, or binding third-party contracts;
- collection, upload, processing, or migration of real personal health information;
- recruiting or running a personal-data pilot without a separately approved protocol, consent, counsel/privacy review, and study environment;
- public adoption of `앎`, domain purchase, app-store reservation, trademark filing, or package/infrastructure renaming;
- weakening the approved medical, genetic, referral, privacy, model-access, or data-residency boundaries;
- pushing a branch or opening a pull request unless the founder separately requests the external GitHub action.

## Initial execution instruction

Begin with `docs/superpowers/plans/2026-08-09-platform-foundation-security.md` Task 1, **Bootstrap the pinned monorepo build**. Do not skip ahead to feature work or deployment. After Task 1 reaches GREEN and is committed, report the exact verification evidence before starting Task 2.
