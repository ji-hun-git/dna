# Intended-use matrix

- **Status:** Foundation boundary; founder/regulatory approval required before expansion
- **Reviewed:** 2026-08-30
- **Environment:** synthetic local development only

## Product claim boundary

The product may organize user-provided health-document information, expose source/provenance, let a user confirm or correct extracted candidates, show user-confirmed history, and later retrieve records through separately approved connectors. It does not diagnose, classify clinical normality, recommend care or medication, predict disease, or turn AI output into a clinical fact without human confirmation.

| Capability | Boundary | Current status | Executable evidence |
|---|---|---|---|
| Accept a local synthetic PDF for UX review | File signature/size UX check only; no server security claim | DEMO ONLY | `apps/web/tests/health-experience.test.tsx`, Playwright Korean experience suite |
| Produce measurement candidates | Candidate only, synthetic fixtures, no clinical truth claim | CONTRACT ONLY | strict `medicalDocumentRunSchema`; `medical-document-synthetic-contract-regression.v1` |
| Confirm or correct a candidate | Explicit per-item user action required before demo save | DEMO ONLY | `apps/web/tests/record-import-concept.test.tsx`, `health-experience.test.tsx` |
| Show source and history | Provenance-shaped UI using synthetic records | DEMO ONLY | `apps/web/tests/evidence-lens.test.tsx`, `health-timeline.test.tsx` |
| Persist a confirmed record | Must preserve source, decision, actor, and time | NOT IMPLEMENTED | no database/migration/repository exists |
| Retrieve external health records | Separate app identity, consent, provider authorization, and approval gates | DISABLED / EXTERNAL GATE | connections UI and provider contracts only |
| Diagnose or assign a disease | Prohibited | NOT IMPLEMENTED BY DESIGN | strict schema rejects extra diagnosis fields; Spring prohibited-route test |
| Label normal/abnormal | Prohibited | NOT IMPLEMENTED BY DESIGN | strict schema rejects `normality`; UI says it does not judge health state |
| Recommend treatment or medication | Prohibited | NOT IMPLEMENTED BY DESIGN | runner manifest requires treatment recommendations to be forbidden; prohibited-route test |
| Predict disease/risk | Prohibited without a new independently approved intended use | NOT IMPLEMENTED BY DESIGN | no route or output contract permits it |
| Train on user health data | Prohibited during foundation work | NOT IMPLEMENTED BY DESIGN | `/train-model-on-user-data` is prohibited by architecture test |

## Non-negotiable acceptance rules

1. Every model/OCR output remains a candidate until an explicit human decision.
2. Unreviewed or abstained fields cannot appear as confirmed records.
3. Output contracts reject diagnosis-like, normality, and unreviewed extra keys.
4. UI copy must identify synthetic/demo state and must not imply clinical validation.
5. Real PHI, uncontrolled patient documents, and third-party AI transmission remain prohibited.
6. Expanding this matrix requires a new product, privacy, security, legal, and—where applicable—MFDS decision; a model or API key alone cannot change it.

## Test mapping and gaps

| Rule | Present test | Gap that blocks beta |
|---|---|---|
| Candidate-only schema | `apps/web/tests/medical-document-evaluation.test.ts` | No server/database state transition constraint |
| Human confirmation UI | `apps/web/tests/health-experience.test.tsx` | React memory only; reload loses state |
| Non-diagnostic language | `apps/web/tests/korean-ux-copy.test.ts`, `evidence-lens.test.tsx` | No reviewed production claim inventory |
| Prohibited backend routes | `apps/core-api/.../ProhibitedRouteTest.kt` | No backend application routes exist yet |
| Synthetic-only corpus | `medicalDocumentCorpusSchema` requires `syntheticOnly: true` | No controlled real-world evaluation protocol |

Passing these tests proves the stated local contract only. It is not medical-model accuracy evidence, regulatory clearance, or permission to process real health data.
