# Curated Open-Source Register

Verified: 2026-08-09. Repository activity and release signals are a point-in-time check, not a future maintenance guarantee. License labels are screening information, not legal advice; every production release still needs an SBOM and automated plus human license review.

## Adoption decision

The selected MVP core is [HAPI FHIR](https://github.com/hapifhir/hapi-fhir) 8.10.1 paired with the [HL7 Java validator](https://github.com/hapifhir/org.hl7.fhir.core), FHIR R4 4.0.1, and [`hl7.fhir.kr.core#2.0.0`](https://www.hl7korea.or.kr/fhir/krcore/STU2/downloads.html). A generic FHIR server is not automatically Korea-conformant. [Medplum](https://github.com/medplum/medplum) is not admitted to the MVP; reconsideration requires a new decision after a documented HAPI conformance, security, licensing, or operations failure.

Keep OMOP, Kubernetes, on-device ML, DICOM viewers, and raw-genomics pipelines outside the first production dependency graph.

## Medical data and AI safety

| Phase | Repository | Purpose | Language / license | Recommendation and risk |
|---|---|---|---|---|
| Selected MVP | [hapifhir/hapi-fhir](https://github.com/hapifhir/hapi-fhir) | FHIR R4 client/server and JPA persistence | Java / Apache-2.0 | HAPI 8.10.1 plus the HL7 validator and `hl7.fhir.kr.core#2.0.0`. Authorization, consent, terminology, audit, and production hardening remain our responsibility. |
| Not admitted to MVP | [medplum/medplum](https://github.com/medplum/medplum) | FHIR server, TypeScript SDK, React components, identity/workflows | TypeScript / Apache-2.0 | Retained as a future comparison reference only. It cannot enter the dependency graph without a replacement decision and independent KR Core/security proof. |
| MVP test data | [synthetichealth/synthea](https://github.com/synthetichealth/synthea) | Synthetic patient records for non-production fixtures | Java / Apache-2.0 | Use for integration tests and demos; synthetic distributions are not proof of Korean clinical performance. |
| Conditional MVP | [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | On-prem OCR, including a Korean PP-OCRv5 model | Python / Apache-2.0 | Benchmark against target hospital PDFs, scans, stamps, tables, and handwriting. OCR output never becomes clinical truth without deterministic validation and review. |
| Conditional local-only MVP | [tesseract-ocr/tesseract](https://github.com/tesseract-ocr/tesseract), [DanBloomberg/leptonica](https://github.com/DanBloomberg/leptonica), and [tesseract-ocr/tessdata_best](https://github.com/tesseract-ocr/tessdata_best) | Bundled offline Korean/English raster OCR for the explicit zero-cloud path | C++ / Apache-2.0; C / BSD-2-Clause; trained-data assets require provenance/license notice review | Pin Tesseract 5.5.2, Leptonica 1.85.0, and tessdata commit `e12c65a915945e4c28e237a9b52bc4a8f39a0cec`. Bundle only `kor.traineddata` (`sha256:f888d4038348a0c3d25151e7f452bda0d74ca275b18cab146798bcbb94084fff`) and `eng.traineddata` (`sha256:8280aed0782fe27257a68ea10fe7ef324ca0f8d85bd2fd145d1c2b560bcb66ba`); runtime downloads are forbidden. Admit a template only after 100% exact synthetic extraction and zero false admission on the unsupported corpus. PDFs remain manual-only locally in MVP. |
| Not admitted to MVP | [data-privacy-stack/presidio](https://github.com/data-privacy-stack/presidio) | PII/PHI detection, masking, image redaction | Python / MIT | Requires a separate implementation plan and Korean/hospital false-negative benchmark. The current document pipeline does not depend on it. |
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
| [flutter/flutter](https://github.com/flutter/flutter) | BSD-3-Clause | Flutter 3.44.7 / Dart 3.12+ shared iOS/Android client. Use native bridges only for platform security, file handling, and the bounded OCR/export-verification functions in the plans. Prefer React/Next.js for web/admin rather than Flutter Web. |
| [sqlcipher/sqlcipher](https://github.com/sqlcipher/sqlcipher) plus [simolus3/sqlite3.dart](https://github.com/simolus3/sqlite3.dart) | BSD-style community license; sqlite3.dart MIT | Encrypted local profile database through `sqlite3` 3.5.1's native-assets `source: sqlcipher` hook. The old `sqlcipher_flutter_libs` package is inert/EOL under sqlite3 v3 and must not be admitted. Official mobile/FIPS SQLCipher packages may be commercial. |
| [juliansteenbakker/flutter_secure_storage](https://github.com/juliansteenbakker/flutter_secure_storage) | BSD-3-Clause | Pin 11.0.0 for device-bound vault-key wrapping: Android RSA-OAEP plus AES-GCM with an isolated storage namespace; iOS Keychain with non-synchronizing, this-device-only accessibility. Disable Android backup and reject key corruption without the plugin's destructive automatic reset. |
| [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) | MIT | Future on-device inference. The runtime does not validate a model's medical safety, bias, or regulatory class. |

The locked mobile graph uses `flutter_riverpod` 3.4.2, `go_router` 17.4.0, Drift 2.34.3, `drift_dev` 2.34.5, and `build_runner` 2.16.0. The lockfile, native asset graph, licenses, and platform release artifacts remain admission evidence.

## Web, backend, and deployment

| Layer | Repository | License | Decision |
|---|---|---|---|
| Web | [vercel/next.js](https://github.com/vercel/next.js) | MIT | Next.js 16.3.0, React 19.2.8, TypeScript 5.9.2, Node 24.17.0, and pnpm 11.20.0 with the npm-published SHA-512 embedded in Corepack `packageManager`. Public comparison plus a self-hosted Korean-plane BFF/private surface; hosting defaults are not treated as PIPA controls. |
| Core API | [spring-projects/spring-boot](https://github.com/spring-projects/spring-boot) | Apache-2.0 | Spring Boot 3.5.7 Kotlin/Java modular monolith, HAPI FHIR 8.10.1, PostgreSQL 16.10. |
| Deterministic explanation worker | [fastapi/fastapi](https://github.com/fastapi/fastapi) | MIT | Python 3.12.13, FastAPI 0.141.1, Pydantic 2.13.4, pytest 9.1.1. Korea-hosted signed evidence/policy/template pipeline; no remote model adapter in MVP. |
| Consented cloud-document worker | [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), [PaddlePaddle/Paddle](https://github.com/PaddlePaddle/Paddle), [pymupdf/PyMuPDF](https://github.com/pymupdf/PyMuPDF) | Apache-2.0; Apache-2.0; AGPL/commercial terms require counsel review | PaddleOCR 3.7.0, PaddlePaddle 3.3.1, PyMuPDF 1.28.2, ClamAV, and the same FastAPI/Pydantic/pytest pins. Template-by-template benchmark, model provenance, license, malware, active-content, and abstention gates are mandatory before admission. |
| Database | [postgres/postgres](https://github.com/postgres/postgres) | PostgreSQL License | PostgreSQL 16.10 managed baseline. TLS, row-level controls, encryption, superuser isolation, audit, and backup are explicit configuration—not defaults. |
| Infrastructure as code | [opentofu/opentofu](https://github.com/opentofu/opentofu) | MPL-2.0 | OpenTofu 1.10.6 with AWS provider 6.10.0 for versioned multi-account cloud infrastructure. Protect state, review plans, and run policy checks before apply. |
| Python toolchain | [astral-sh/uv](https://github.com/astral-sh/uv/releases/tag/0.12.3) | Apache-2.0 / MIT dual license | uv 0.12.3. Foundation owns the exact official Linux x86_64, macOS arm64/x86_64, and Windows x86_64 release-asset URLs, byte sizes, and SHA-256 values in the root supply-chain lock; every workstream verifies the matching asset before extraction and may not install uv from an unhashed package-index response. |
| Observability | [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector) | Apache-2.0 | Vendor-neutral telemetry pipeline. Allowlist attributes and prohibit request/response bodies, document text, lab values, and identifiers. |
| Scale only | [kubernetes/kubernetes](https://github.com/kubernetes/kubernetes) | Apache-2.0 | Managed Kubernetes only after measured scale/team needs justify it. Not in MVP. |

## Security and software supply chain

| Repository | License | Use |
|---|---|---|
| [aquasecurity/trivy](https://github.com/aquasecurity/trivy) | Apache-2.0 | Trivy 0.66.0 for vulnerability, secret, license, IaC and container scanning plus CycloneDX/SPDX SBOM output. Own exceptions/VEX; a clean scan is not proof of safety. |
| [sigstore/cosign](https://github.com/sigstore/cosign) | Apache-2.0 | Cosign 3.0.6 for containers, binaries, SBOMs, and provenance. Pin accepted issuer and identity; use KMS/private bundles where public log metadata is unsuitable. |
| [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) | MIT | Gitleaks 8.28.0 for pre-commit and CI secret detection. It complements, not replaces, short-lived credentials and secret rotation. |
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
