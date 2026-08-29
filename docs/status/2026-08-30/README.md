# Current frontend and backend report set

**Audit date:** 2026-08-30 (Asia/Seoul)  
**Audited code commit:** `0605518d100e9af9f33375b7d5831c712022f50a`  
**Branch:** `codex/dataon-aida-evidence-agent`  
**Scope:** tracked application code in `apps/web`, `apps/core-api`, `packages/design-tokens`, and their tests and operational contracts

This folder reports what the repository can do now. It does not treat an implementation plan, dependency declaration, UI mock, or passing synthetic test as a live production capability.

## Reports

1. [Frontend report](frontend-report.md) — routes, user journeys, design system, browser behavior, accessibility, and frontend gaps.
2. [Backend and server-logic report](backend-report.md) — Spring core API, TypeScript server-only modules, persistence, and missing production services.
3. [Security and integrations report](security-and-integrations-report.md) — implemented safeguards, contract-only integrations, external approvals, and security gaps.
4. [Verification and release-readiness report](verification-and-release-report.md) — commands run against this snapshot, results, limitations, and release verdict.
5. [Delivery roadmap](delivery-roadmap.md) — the shortest evidence-based path from the current prototype to an authorized private beta.
6. [Production-foundation stop-ship iteration](production-foundation-stop-ship-iteration.md) — dependency remediation, trust-boundary decision, adversarial results, and the current NO-GO verdict after commit 0605518.

## Status language

| Label | Meaning |
|---|---|
| **Verified locally** | Executable code exists and passed the listed local checks. |
| **Demo only** | The interface works with synthetic or in-memory state, but no production data or persistence exists. |
| **Contract only** | Types, policies, and tests exist, but no request handler, network client, infrastructure, or external account is connected. |
| **External gate** | Provider approval, credentials, legal review, procurement, or another authorized external action is still required. |
| **Not implemented** | The necessary runtime path is absent from tracked code. |

## Executive summary

| Area | Current truth | User-ready now? |
|---|---|---:|
| Web experience | Six polished Korean-first routes, responsive interactions, local document validation, provenance views, and explicit demo boundaries | **Yes, as a synthetic local prototype only** |
| Design system | Pretendard Variable, IBM Plex Mono, generated cross-platform tokens, neutral shadcn-like surfaces, and Toss-influenced Korean hierarchy | **Yes, locally** |
| Personal health records | Synthetic in-memory records and review flows | **No** |
| Spring core API | Bootable architecture skeleton with three port interfaces and FHIR R4 context | **No** |
| Next.js backend | Security, model-runner, and research-data libraries exist; zero API route handlers exist | **No** |
| Database and storage | Dependencies are declared, but there are no migrations, repositories, schemas, or deployed stores | **No** |
| Kakao/Naver login | OIDC contracts and cryptographic transaction tests exist; UI is disabled and no callback/token exchange route exists | **No — external registration and backend work required** |
| MyHealthWay | A deny-by-default contract and five approval gates exist | **No — formally disabled** |
| Public HIRA/NHIS-style information | Strict synthetic provider and price fixtures | **No live data** |
| DataON/AIDA agent | Offline public-metadata ranking, rights registry, drift detection, and evaluation gate | **Yes, as an offline research prototype only** |
| Medical document AI | Synthetic evaluation and digest-bound offline/OCI admission contracts | **No real model inference or OCR runtime** |
| Deployment | No tracked CI workflow, production container manifest, environment configuration, or deployed service | **No** |

## Overall verdict

The repository is a credible, well-tested product prototype and safety-contract workspace. It is not yet a functioning health-data service. The frontend demonstrates the intended experience truthfully; the backend is still an architecture and safety skeleton. Production, beta use, real identity accounts, external API calls, and personal health information processing are not ready and remain unauthorized.

## Existing detailed plans and handoffs

These reports summarize current code. Detailed future designs remain in:

- [`docs/superpowers/plans/README.md`](../../superpowers/plans/README.md)
- [`docs/superpowers/plans/2026-08-12-identity-health-access-antihack.md`](../../superpowers/plans/2026-08-12-identity-health-access-antihack.md)
- [`docs/implementation/medical-document-runner.md`](../../implementation/medical-document-runner.md)
- [`docs/operations/research-data-external-setup.md`](../../operations/research-data-external-setup.md)
- [`risks/risk-register.md`](../../../risks/risk-register.md)
