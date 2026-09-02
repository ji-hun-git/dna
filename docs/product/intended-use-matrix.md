# Intended-use matrix

- **Status:** Foundation boundary; founder/regulatory approval required before expansion
- **Reviewed:** 2026-09-02 (visit-preparation row added by the multi-candidate wave)
- **Environment:** synthetic local/CI evidence only; no hosted application deployment

## Product claim boundary

The product may organize user-provided health-document information, expose source/provenance, let a user confirm or correct extracted candidates, show user-confirmed history, and later retrieve records through separately approved connectors. It does not diagnose, classify clinical normality, recommend care or medication, predict disease, or turn AI output into a clinical fact without human confirmation.

| Capability | Boundary | Current status | Executable evidence |
|---|---|---|---|
| Accept an allowlisted synthetic PDF | Bounded capability, exact length/digest, hostile-document state machine; no real-document authorization | VERIFIED SYNTHETIC ONLY | Spring/PostgreSQL lifecycle and browser-to-worker CI evidence |
| Produce measurement candidates | Candidate only, synthetic fixtures, no clinical truth claim | VERIFIED SYNTHETIC CONTRACT | strict output schema, worker lifecycle and synthetic regression corpus |
| Confirm or correct a candidate | Explicit per-item human action required before record promotion | VERIFIED SYNTHETIC ONLY | candidate confirmation-bypass and PostgreSQL lifecycle tests |
| Show source and history | Source page/digest and provenance retained for synthetic records | VERIFIED SYNTHETIC ONLY | evidence UI tests plus reload from PostgreSQL lifecycle |
| Persist a confirmed record | Preserve source, decision, actor, time and owner scope | VERIFIED SYNTHETIC ONLY | Flyway schema, JDBC lifecycle, reload/revocation/deletion integration tests |
| Prepare questions for a professional | Fixed, neutral, source-linked question set attached to user-confirmed records; no interpretation, threshold, or advice | VERIFIED SYNTHETIC ONLY (CI run 33576825427 on 33e6ac8: web tests, PostgreSQL lifecycle, browser lifecycle) | `apps/web/tests/visit-preparation.test.tsx`, copy scan, `foundation-lifecycle.spec.ts` |
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
| Candidate-only schema | web medical-document evaluation plus Spring hostile-document lifecycle | No hosted OCR/model evaluation or real-document authorization |
| Human confirmation UI | browser-to-Spring lifecycle and PostgreSQL confirmation-bypass tests | No hosted lifecycle or support/recovery path |
| Non-diagnostic language | `apps/web/tests/korean-ux-copy.test.ts`, `evidence-lens.test.tsx` | No final counsel/MFDS-reviewed production claim inventory |
| Prohibited backend routes | `apps/core-api/.../ProhibitedRouteTest.kt` | Must be repeated against hosted ingress after deployment |
| Synthetic-only corpus | `medicalDocumentCorpusSchema` requires `syntheticOnly: true` | No controlled real-world evaluation protocol |

Passing these tests proves the stated synthetic local/CI contract only. It is not medical-model accuracy evidence, regulatory clearance, hosted readiness, or permission to process real health data.
