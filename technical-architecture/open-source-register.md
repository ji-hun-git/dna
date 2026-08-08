# Curated Open-Source Register

Verified: 2026-08-08. Repository activity and release signals are a point-in-time check, not a future maintenance guarantee. License labels are screening information, not legal advice; every production release still needs an SBOM and automated plus human license review.

## Adoption decision

Choose **one** FHIR core:

- **Recommended:** [HAPI FHIR](https://github.com/hapifhir/hapi-fhir) for a standards/interoperability-first platform, paired with the [HL7 Java validator](https://github.com/hapifhir/org.hl7.fhir.core).
- **Alternative:** [Medplum](https://github.com/medplum/medplum) for a faster application-first path.

Do not operate both as competing sources of truth. Whichever is chosen must load and validate against [KR Core 2.0.0](https://www.hl7korea.or.kr/fhir/krcore/STU2/downloads.html); a generic FHIR server is not automatically Korea-conformant.

Keep OMOP, Kubernetes, on-device ML, DICOM viewers, and raw-genomics pipelines outside the first production dependency graph.

## Medical data and AI safety

| Phase | Repository | Purpose | Language / license | Recommendation and risk |
|---|---|---|---|---|
| MVP, choose one | [hapifhir/hapi-fhir](https://github.com/hapifhir/hapi-fhir) | FHIR R4 client/server and JPA persistence | Java / Apache-2.0 | Recommended core. HAPI 8.10.1 was released 2026-07-22. Authorization, consent, terminology, audit, and production hardening remain our responsibility. |
| MVP alternative | [medplum/medplum](https://github.com/medplum/medplum) | FHIR server, TypeScript SDK, React components, identity/workflows | TypeScript / Apache-2.0 | Faster app-first option. Prove KR Core conformance independently and separate OSS capability from hosted/enterprise features. |
| MVP test data | [synthetichealth/synthea](https://github.com/synthetichealth/synthea) | Synthetic patient records for non-production fixtures | Java / Apache-2.0 | Use for integration tests and demos; synthetic distributions are not proof of Korean clinical performance. |
| Conditional MVP | [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | On-prem OCR, including a Korean PP-OCRv5 model | Python / Apache-2.0 | Benchmark against target hospital PDFs, scans, stamps, tables, and handwriting. OCR output never becomes clinical truth without deterministic validation and review. |
| MVP privacy layer | [data-privacy-stack/presidio](https://github.com/data-privacy-stack/presidio) | PII/PHI detection, masking, image redaction | Python / MIT | Add Korean and hospital-specific recognizers; measured false-negative rate is mandatory. It is not the only privacy control. |
| Future imaging | [pydicom/pydicom](https://github.com/pydicom/pydicom) and [OHIF/Viewers](https://github.com/OHIF/Viewers) | DICOM parsing and browser viewing | Python / MIT; TypeScript / MIT | Future clinician-reviewed imaging workflow only. Pixel redaction does not remove metadata; a viewer is not a diagnostic clearance. |
| Future analytics | [OHDSI/CommonDataModel](https://github.com/OHDSI/CommonDataModel) | OMOP CDM for derived analytics/research | R/SQL/HTML; specification states CC BY-SA 4.0 | Use only in a separate de-identified/consented analytical warehouse, not as transactional truth. Vocabulary and share-alike licensing need legal review. |
| Future terminology/NLP | [allenai/scispacy](https://github.com/allenai/scispacy) and [CogStack/MedCAT](https://github.com/CogStack/MedCAT) | Biomedical NLP and concept annotation | Python; Apache-2.0 | English-heavy baselines. Do not assume Korean clinical performance; train/evaluate on authorized Korean corpora and keep deterministic terminology review. |

## Genomics — future or research-only

| Phase | Repository | Purpose | Language / license | Gate |
|---|---|---|---|---|
| Future representation | [ga4gh/vrs-python](https://github.com/ga4gh/vrs-python) | Normalize and identify genetic variation | Python / Apache-2.0 | A representation layer, not interpretation. Requires governed reference sequences/transcripts and version pinning. |
| Research utilities | [biopython/biopython](https://github.com/biopython/biopython) and [pysam-developers/pysam](https://github.com/pysam-developers/pysam) | Sequence formats and HTS file access | Python / permissive project licenses | Isolated research only until raw-genomics and clinical-validation paths are approved. |
| Research pipeline | [nf-core/sarek](https://github.com/nf-core/sarek) | Reproducible WGS/WES/targeted variant calling | Nextflow / MIT for pipeline | Never an MVP app dependency. Pin every container/reference; review bundled tool licenses; require laboratory and clinical validation for any medical use. |

The MVP deliberately excludes VCF/BAM/FASTQ upload, novel polygenic scores, pharmacogenomic treatment advice, and generative interpretation of raw variants.

## UI/UX and visualization

| Surface | Repository | License | Use |
|---|---|---|---|
| Public/editorial web | [shadcn-ui/ui](https://github.com/shadcn-ui/ui), [radix-ui/primitives](https://github.com/radix-ui/primitives), [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | MIT | Best fit for the requested custom “Midnight Evidence Ledger” rather than a generic medical template. Radix supplies accessible primitives; copied shadcn components become owned source that must be maintained. |
| Component governance | [storybookjs/storybook](https://github.com/storybookjs/storybook) | MIT | Document states, evidence chips, safety boundaries, Korean typography, dark/light contrast, and visual regression tests. |
| Admin/reviewer portal | [mui/material-ui](https://github.com/mui/material-ui) | MIT core; MUI X Pro/Premium separate | Efficient dense operations UI with Korean localization. Keep it out of the consumer brand surface unless fully themed. |
| Quantitative graphics | [apache/echarts](https://github.com/apache/echarts) | Apache-2.0 | Dot/unit grids, trends, and comparison charts. ARIA must be enabled; every critical chart needs a table/text equivalent. |

No chart is a diagnostic display by default. Color cannot be the only carrier of meaning, and red/green must not label genes or health states as morally “bad/good.”

## Cross-platform application

| Repository | License | Use and caution |
|---|---|---|
| [flutter/flutter](https://github.com/flutter/flutter) | BSD-3-Clause | Shared iOS/Android client. Use native bridges only for platform security, file handling, and on-device inference. Prefer React/Next.js for web/admin rather than Flutter Web. |
| [sqlcipher/sqlcipher](https://github.com/sqlcipher/sqlcipher) | BSD-style community license | Encrypted local profile database. Keys remain in iOS Keychain/Secure Enclave or Android Keystore/StrongBox. Official mobile/FIPS packages may be commercial. |
| [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) | MIT | Future on-device inference. The runtime does not validate a model's medical safety, bias, or regulatory class. |

Recommended application companions at implementation planning time: Riverpod for predictable state, `go_router` for navigation, and Drift for typed SQLite access, each pinned and license-reviewed before adoption.

## Web, backend, and deployment

| Layer | Repository | License | Decision |
|---|---|---|---|
| Web | [vercel/next.js](https://github.com/vercel/next.js) | MIT | Public content, comparison experience, user portal, and admin shell. Self-host the authenticated health surface in the Korean data plane; do not assume a hosting platform's defaults meet PIPA boundaries. |
| Core API | [spring-projects/spring-boot](https://github.com/spring-projects/spring-boot) | Apache-2.0 | Kotlin/Java modular monolith, aligned with HAPI FHIR. Use a currently supported release and patch SLA. |
| AI/document workers | [fastapi/fastapi](https://github.com/fastapi/fastapi) | MIT | Small typed Python services for OCR/NLP/model adapters, isolated from the public API and denied broad data/network access. |
| Database | [postgres/postgres](https://github.com/postgres/postgres) | PostgreSQL License | Managed PostgreSQL/Aurora baseline. TLS, row-level controls, encryption, superuser isolation, audit, and backup are explicit configuration—not defaults. |
| Infrastructure as code | [opentofu/opentofu](https://github.com/opentofu/opentofu) | MPL-2.0 | Versioned multi-account cloud infrastructure. Protect state, review plans, and run policy checks before apply. |
| Observability | [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | Apache-2.0 | Vendor-neutral telemetry pipeline. Allowlist attributes and prohibit request/response bodies, document text, lab values, and identifiers. |
| Scale only | [kubernetes/kubernetes](https://github.com/kubernetes/kubernetes) | Apache-2.0 | Managed Kubernetes only after measured scale/team needs justify it. Not in MVP. |

## Security and software supply chain

| Repository | License | Use |
|---|---|---|
| [aquasecurity/trivy](https://github.com/aquasecurity/trivy) | Apache-2.0 | Vulnerability, secret, license, IaC and container scanning plus CycloneDX/SPDX SBOM output. Own exceptions/VEX; a clean scan is not proof of safety. |
| [sigstore/cosign](https://github.com/sigstore/cosign) | Apache-2.0 | Sign containers, binaries, SBOMs, and provenance. Pin accepted issuer and identity; use KMS/private bundles where public log metadata is unsuitable. |
| [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) | MIT | Pre-commit and CI secret detection. It complements, not replaces, short-lived credentials and secret rotation. |
| [open-policy-agent/opa](https://github.com/open-policy-agent/opa) | Apache-2.0 | Versioned deny-by-default policy decisions for deployment and later cross-service access. OPA is not an enforcement point by itself. |
| [zaproxy/zaproxy](https://github.com/zaproxy/zaproxy) | Apache-2.0 | Authenticated DAST against staging with synthetic data. |
| [prowler-cloud/prowler](https://github.com/prowler-cloud/prowler) | Apache-2.0 | Cloud security posture and compliance evidence. Review mappings; scanner output is not certification. |

## Dependency admission gate

A new library, model, terminology pack, dataset, or hosted service cannot enter production until the owner records:

1. exact version/digest and upstream URL;
2. license and commercial-use obligations for code, weights, training data, and bundled assets;
3. maintenance/security policy and last meaningful release;
4. data it can read, emit, log, or transmit;
5. threat model and least-privilege sandbox;
6. failure/rollback path;
7. SBOM entry, signature/provenance status, and patch owner;
8. Korean-language, accessibility, clinical, privacy, and performance validation relevant to its role.
