# Founder Approval Record — 2026-08-09

**Approver:** Founder

**Approval statement:** “approve all eight”

**Scope of approval:** The eight decisions in Section 20 of the program and technical design are approved with the interpretations below. This approval authorizes implementation planning. It does not authorize product implementation, production deployment, external account changes, procurement, collection of personal health information, or a regulated launch.

## Resolved decisions

| # | Resolution | Binding implementation constraint |
|---|---|---|
| 1 | Checkup/record companion is the lead wedge. | Certified genetics stays optional and behind separate lab, regulatory, scientific, and security gates. |
| 2 | Consumer-paid and fixed-fee software/information revenue is the baseline. | No patient-, booking-, conversion-, or success-based medical compensation without written Korean counsel approval. |
| 3 | A consented hybrid document pipeline is approved. | Prefer on-device processing; cloud processing is Korea-region, quarantined, purpose-bound, explicit-consent only, and removable through local-only mode. |
| 4 | HAPI FHIR is selected. | Use FHIR R4, KR Core 2.0.0, terminology pinning, and conformance tests; do not schedule a Medplum selection proof for MVP. |
| 5 | MyHealthWay is post-MVP. | Build a disabled adapter contract only; launch cannot depend on external onboarding. |
| 6 | Immediate post-verification deletion is the source-document default. | Encrypted retention is opt-in, reversible, visible, and covered by deletion/backup-tombstone tests. |
| 7 | The personal-data plane is Korea-only. | A future US plane is separate; no replication of Korean user records into it. |
| 8 | Midnight Evidence Ledger is the approved visual direction. | Korean readability, WCAG accessibility, usability, reduced-motion, and non-color-only semantics are release gates. |

## Unchanged external gates

- Korean healthcare, privacy, consumer, advertising/referral, and lab counsel must approve the actual flows and commercial terms.
- MFDS intended-use classification must be assessed against the implemented copy, screens, data transformations, rules, and model behavior.
- Government-source terms, attribution, permitted uses, and access approvals remain dataset-specific.
- A public beta still requires every release gate in Section 18 of the design specification.

## Traceability

- Design baseline: [`../docs/superpowers/specs/2026-08-08-genome-companion-program-design.md`](../docs/superpowers/specs/2026-08-08-genome-companion-program-design.md)
- Decision log: [`decision-log.md`](decision-log.md)
- Risk register: [`../risks/risk-register.md`](../risks/risk-register.md)
