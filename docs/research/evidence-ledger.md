# Evidence ledger

**Evidence date:** 2026-08-30 (Asia/Seoul) · **Scope:** product, architecture, data, model, safety, and experiment claims
**Rule:** a claim is usable only to the strength stated here; absence of evidence remains `UNKNOWN`.

## Claim classes

- `SOURCE-VERIFIED`: a current primary source directly supports the statement.
- `MEASURED-LOCALLY`: a reproducible repository or workstation experiment supports only the recorded result.
- `DECIDED`: an approved product/architecture choice, not an empirical fact.
- `WATCHING`: credible but not admitted to the product.
- `UNKNOWN`: not established; user-facing copy and code must not imply it.
- `REJECTED`: explicitly excluded from the current product boundary.

## Active claims

| ID | Claim | Evidence and date | Class | Allowed product consequence | Review trigger |
|---|---|---|---|---|---|
| EV-001 | MyHealthWay is an official consented personal-health exchange route with clinical/public query APIs, dynamic consent, authentication support, and FHIR-based data. | [MyHealthWay API](https://myhealthway.go.kr/portal/index?page=Individual%2FPortal%2FMediMyData%2FMydataApi), reverified 2026-08-30 | `SOURCE-VERIFIED` | Keep a disabled personal-data adapter contract and plan formal onboarding. | Page, implementation guide, or designation policy changes. |
| EV-002 | MyHealthWay utilization-service developers must pass designation/onboarding and the published testbed/conformity path before production transition. | [Designation](https://myhealthway.go.kr/portal/index?page=Organization%2FPortal%2FPortalFunction%2FOrFunctionPerScreeing), [testbed](https://tb.myhealthway.go.kr/portal/index?page=MediMyData%2FTestbedManual), reverified 2026-08-30 | `SOURCE-VERIFIED` | Never label an API key, mock adapter, or local test as government connectivity. | Formal approval or new guide received. |
| EV-003 | The public MyHealthWay pages do not establish the proposed one-time snapshot import, local retention, and disconnect behavior. | Public API/data-type/designation/testbed pages reviewed 2026-08-30 | `UNKNOWN` | Do not promise this behavior; turn it into an onboarding question and conformance test. | Approved implementation guide or written program answer obtained. |
| EV-004 | Current MyHealthWay public material lists 12 FHIR data items, including Patient, Organization, Condition, MedicationRequest, Observation, ImagingStudy, DiagnosticReport, Procedure, AllergyIntolerance, and DocumentReference. | [Official data types](https://www.myhealthway.go.kr/portal/index?page=Individual%2FPortal%2FMediMyData%2FMydataType), reverified 2026-08-30 | `SOURCE-VERIFIED` | Model adapters around explicit versioned FHIR resources; do not assume every institution supplies every item. | Approved implementation guide conflicts or page changes. |
| EV-005 | FHIR R4 Observation distinguishes clinically relevant `effective[x]` from `issued`; Observation is not the diagnosis resource. | [HL7 Observation](https://hl7.org/fhir/R4/observation.html), reverified 2026-08-30 | `SOURCE-VERIFIED` | Preserve both times, reject ambiguous time, and avoid inferring diagnoses from measurements. | Canonical model/version changes. |
| EV-006 | FHIR Provenance records the entities and processes involved in producing or influencing a target resource and complements AuditEvent. | [HL7 Provenance](https://hl7.org/fhir/R4/provenance.html), reverified 2026-08-30 | `SOURCE-VERIFIED` | Keep source/version/location/digest/transformation metadata distinct from access audit. | Provenance model changes. |
| EV-007 | Synthea 4.0.0 generates synthetic longitudinal records and exports FHIR R4. | [Repository](https://github.com/synthetichealth/synthea), [release](https://github.com/synthetichealth/synthea/releases/tag/v4.0.0), reverified 2026-08-30 | `SOURCE-VERIFIED` | Use as structural synthetic QA only. | New pinned release evaluated. |
| EV-008 | One pinned Synthea 4.0.0 transaction Bundle contained 390 resources and 99 Observations; the strict local projector admitted 80 quantity candidates and rejected 19 (18 unsupported values, one ambiguous code). | Experiment EX-2026-08-30-01; SHA-256 `f8285f2265a82a8dc71697aa25b9e3cfd92be089cff7528906df2b15b3c6ba74`; 2026-08-30 | `MEASURED-LOCALLY` | The candidate projection contract is executable against one real upstream synthetic artifact. | Projector, dependency, generator, or fixture changes. |
| EV-009 | EV-008 does not establish clinical accuracy, Korean-population realism, KR Core conformance, MyHealthWay conformance, OCR quality, or production safety. | Experiment limitations plus Synthea peer-reviewed limitations; 2026-08-30 | `MEASURED-LOCALLY` | Keep every output synthetic and `CANDIDATE`; prohibit production claims. | Each omitted property gets its own benchmark. |
| EV-010 | HIRA dataset 15021027 and MFDS dataset 15059486 are public medication reference routes, not evidence of an individual's prescription, dispensing, adherence, or response. | [HIRA ingredient API](https://www.data.go.kr/data/15021027/openapi.do), [MFDS DUR API](https://www.data.go.kr/data/15059486/openapi.do), reverified 2026-08-30 | `SOURCE-VERIFIED` | Join only as clearly labeled reference context after source/license review; never create personal facts. | Schema, license, or intended-use changes. |
| EV-011 | MedGemma is a development foundation model whose publisher requires task-specific validation and disallows treating its outputs as direct diagnosis/treatment/patient-management decisions. | [Official model card](https://developers.google.com/health-ai-developer-foundations/medgemma/model-card), reverified 2026-08-30 | `WATCHING` | Benchmark offline only after a governed task definition; no “best medical AI” or clinical deployment claim. | New model card/artifact and independent benchmark. |
| EV-012 | The assistant cannot write canonical medical facts; it may propose candidate facts or explanations that retain source and uncertainty. | D-006 and D-034, 2026-08-30 | `DECIDED` | Enforce typed candidate output and a deterministic/human confirmation boundary. | New founder, safety, or regulatory approval. |
| EV-013 | Public/reference data and personal health data remain separate network, identity, storage, logging, and lifecycle planes. | D-009, reaffirmed 2026-08-30 | `DECIDED` | Never use public-data credentials as personal-data access or mix the records silently. | Boundary may be strengthened, never removed. |

## Claim admission checklist

Before a claim enters UI copy, code comments, an investor deck, a competition submission, or a release note:

1. Give it an `EV-*` identifier or link to an already admitted claim.
2. Record source owner, direct URL, access date, version/schema, and license where relevant.
3. Separate upstream/vendor claims from our measurements.
4. State what the evidence does **not** establish.
5. Bind derived values to source records, transform version, and uncertainty.
6. Reject “best,” “accurate,” “secure,” “compliant,” “real-time,” or “AI-powered” without a defined comparator and dated evidence.
