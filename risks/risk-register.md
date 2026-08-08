# Initial Risk Register

Last updated: 2026-08-08 (Asia/Seoul)

Scales: likelihood and impact are `Low`, `Medium`, `High`, or `Critical`. Residual risk is the target after listed controls, not a guarantee.

| ID | Risk | Likelihood | Impact | Required controls / gate | Residual target | Owner |
|---|---|---:|---:|---|---:|---|
| R-001 | The product crosses into diagnosis, treatment, prognosis, medication advice, or regulated clinical decision support. | High | Critical | Intended-use registry; copy and screenshot review; MFDS opinion; deterministic risk tiers; hard safety blocks. | Medium | Founder + regulatory lead |
| R-002 | Ajungdang-style commissions become prohibited profit-driven patient referral/intermediation. | High | Critical | No per-patient/success fee baseline; neutral comparison rules; fixed consumer/SaaS revenue; Korean counsel review. | Low | Founder + counsel |
| R-003 | Sensitive/genetic data leaks through analytics, crash logs, support tools, URLs, or notifications. | Medium | Critical | No ad SDKs; allowlisted telemetry schema; outbound traffic tests; DLP; redaction; support attachment controls. | Low | Security lead |
| R-004 | A remote LLM retains, trains on, or transfers identifiable Korean health data. | Medium | Critical | Local/private processing first; data minimization; processor/DPA review; training/retention disabled; cross-border basis; egress policy. | Low | Privacy + AI leads |
| R-005 | OCR/parser error changes a lab value, unit, medication, or genetic result. | Medium | Critical | Template-specific deterministic parser; unit/range checks; source overlay; confidence/abstention; user verification; clinical fixtures. | Low | Data/clinical leads |
| R-006 | LLM explanation hallucinates or overstates evidence. | High | High | Verified fact packet; curated retrieval; structured output; claim-level citations; post-generation policy gate; abstention; clinician evals. | Medium | AI safety lead |
| R-007 | Public government API data is stale, schema-shifted, revoked, mislicensed, or mistaken for patient-level truth. | High | High | Per-source adapters; immutable snapshots; version/lineage; schema contracts; freshness SLAs; license register; public/personal boundary. | Low | Data platform lead |
| R-008 | Identity or authorization flaw exposes another user's records. | Medium | Critical | OIDC/PKCE; object- and field-level authorization; tenant/purpose/consent ABAC; negative authorization tests; short-lived tokens. | Low | Platform security lead |
| R-009 | Compromised dependency or CI pipeline ships malicious code. | Medium | Critical | Pinning; SCA/SAST/secret/IaC scans; SBOM; signed provenance/artifacts; OIDC CI credentials; two-person release approval. | Low | AppSec lead |
| R-010 | Centralized raw genomic storage creates catastrophic breach impact. | Medium | Critical | On-device vault; no raw-genome API; platform-secured keys; encrypted local DB; backup exclusion; reset-to-zero flow. | Low | Mobile/privacy leads |
| R-011 | Cloud region is mistaken for full Korean residency while a subprocessor, support path, backup, or telemetry moves data abroad. | Medium | Critical | Full data-transfer map; subprocessors; regional service review; access logs; support constraints; separate consent where required. | Low | Privacy lead |
| R-012 | Immutable audit/backup data conflicts with deletion duties. | Medium | High | No medical content in immutable logs; pseudonymous IDs; narrow retention; crypto-shredding; backup expiry; deletion tombstones on restore. | Low | Privacy + security leads |
| R-013 | Ransomware or operator error destroys production and backups. | Medium | Critical | Cross-account immutable backup; separate keys/admin; PITR; quarterly restore tests; documented RPO/RTO; incident exercises. | Low | SRE/security leads |
| R-014 | Insider or stolen administrator session accesses sensitive records. | Medium | Critical | Phishing-resistant MFA; JIT access; session recording; purpose-based approvals; two-person break-glass; continuous audit. | Low | Security lead |
| R-015 | Product falsely claims “E2EE” or “tamper-proof,” damaging trust and creating legal exposure. | Medium | High | Claim registry; architecture-to-copy review; precise encryption language; external security review. | Low | Product + security leads |
| R-016 | Korean terminology mappings (KCD/EDI/local lab codes to LOINC/SNOMED/UCUM) are wrong or unlicensed. | High | High | Versioned terminology service; human mapping review; confidence; local-code preservation; license checks; no silent mapping. | Medium | Clinical informatics lead |
| R-017 | Model/evidence performs poorly for Korean populations or presents non-Korean genomic evidence as universal. | High | High | Population-applicability field; subgroup evaluation; evidence grading; explicit limitations; no novel polygenic scores in MVP. | Medium | Scientific lead |
| R-018 | DNA-first product has weak repeat usage and support-heavy unit economics. | High | High | Wedge tournament; willingness-to-pay tests; certified-lab quotes; annual checkup/record companion; cohort retention gates. | Medium | Founder/growth lead |
| R-019 | A health emergency is delayed by an explanatory assistant. | Medium | Critical | Symptom/emergency detection; deterministic emergency response; do not assess severity; show Korean emergency resources; audit safety recall. | Low | Clinical safety lead |
| R-020 | Open-source copyleft or terminology license obligations contaminate distribution or planned SaaS use. | Medium | High | SPDX/SBOM/license policy; legal review of AGPL/non-code data licenses; allowlist; component isolation; no unreviewed model/data weights. | Low | Engineering + counsel |

## Release rule

No risk with `Critical` impact may ship without a named owner, evidence that the required control works, a rollback/kill-switch procedure, and explicit acceptance by the founder plus the relevant clinical, privacy, security, or regulatory reviewer.
