# Open-source radar

**Review date:** 2026-08-30 · **Status vocabulary:** `ADOPTED`, `BENCHMARKED`, `EVALUATING`, `WATCHING`, `REJECTED`
**Admission rule:** repository popularity or an upstream benchmark is never enough. Code, model weights, datasets, containers, terminology, and licenses receive separate receipts.

## HAPI FHIR

| Field | Record |
|---|---|
| NAME | HAPI FHIR |
| SOURCE | <https://github.com/hapifhir/hapi-fhir> |
| DATE | Reviewed 2026-08-30 |
| VERSION | `8.10.1`, pinned in `gradle/libs.versions.toml` |
| LICENSE | Apache-2.0 for the cited repository; bundled terminology/artifacts reviewed separately |
| PURPOSE | Kotlin/JVM FHIR R4 parsing now; later governed validation/server path |
| CLAIMED CAPABILITY | FHIR Java APIs, parsers, clients, validation, and server ecosystem |
| INDEPENDENT EVIDENCE | Not yet recorded for the selected KR Core pathway |
| OUR BENCHMARK RESULT | Parsed the pinned Synthea Bundle and enabled 80 strict candidates from 99 Observations |
| SECURITY REVIEW | Parser input capped; Bundle type/entry count/identity/subject validated; no network or Spring bean in projector |
| PRIVACY REVIEW | Synthetic-only; payload not logged or persisted by the projector |
| REGULATORY IMPACT | Parsing is not KR Core/MyHealthWay conformance or clinical validation |
| INTEGRATION COST | Low in current Spring/Kotlin stack; validation/JPA operations remain substantial |
| EXIT COST | Medium because contracts are internal but models use HAPI types at the projector edge |
| STATUS | `ADOPTED` within the narrow parsing boundary |

## Synthea

| Field | Record |
|---|---|
| NAME | Synthea |
| SOURCE | <https://github.com/synthetichealth/synthea> |
| DATE | Generated and benchmarked 2026-08-30 |
| VERSION | `4.0.0`, commit `0185c09ea9d10a822c6f5f3ef9bdcbcbe960c813` |
| LICENSE | Apache-2.0 repository |
| PURPOSE | Reproducible synthetic longitudinal FHIR QA |
| CLAIMED CAPABILITY | Generates synthetic patient histories and exports FHIR R4 |
| INDEPENDENT EVIDENCE | [Walonoski et al. 2018](https://academic.oup.com/jamia/article/25/3/230/4098271); [Chen et al. 2022](https://academic.oup.com/jamiaopen/article/5/3/ooac067/6658391) report utility and material limitations |
| OUR BENCHMARK RESULT | EX-2026-08-30-01: 390 resources, 99 Observations, 80 admitted, 19 rejected |
| SECURITY REVIEW | Pinned source/tag/commit; generated outside repository; digest-gated conditional test |
| PRIVACY REVIEW | Synthetic generator only; do not combine with real identifiers |
| REGULATORY IMPACT | Cannot validate clinical claims, Korean realism, or MyHealthWay/KR Core conformance |
| INTEGRATION COST | Low for CI fixtures; medium for curated Korean edge-case packs |
| EXIT COST | Low; projector consumes FHIR JSON, not Synthea APIs |
| STATUS | `BENCHMARKED` |

## Inferno Core

| Field | Record |
|---|---|
| NAME | Inferno Core |
| SOURCE | <https://github.com/inferno-framework/inferno-core> |
| DATE | Reviewed 2026-08-30 |
| VERSION | Unpinned; no artifact admitted |
| LICENSE | Apache-2.0 repository |
| PURPOSE | Candidate executable FHIR conformance harness |
| CLAIMED CAPABILITY | Framework for running FHIR conformance tests |
| INDEPENDENT EVIDENCE | Not yet collected for KR Core/MyHealthWay use |
| OUR BENCHMARK RESULT | None |
| SECURITY REVIEW | Pending container, dependency, egress, and test-data review |
| PRIVACY REVIEW | Synthetic test traffic only if evaluated |
| REGULATORY IMPACT | Cannot replace the program's official conformity suite |
| INTEGRATION COST | Medium |
| EXIT COST | Low if kept test-only |
| STATUS | `EVALUATING` |

## PaddleOCR and Docling

| Field | Record |
|---|---|
| NAME | PaddleOCR / Docling |
| SOURCE | <https://github.com/PaddlePaddle/PaddleOCR> / <https://github.com/docling-project/docling> |
| DATE | Reviewed 2026-08-30 |
| VERSION | PaddleOCR `3.7.0` planned; Docling unpinned; no model artifact admitted |
| LICENSE | Repository licenses only; every weight/container/font/data artifact pending receipt |
| PURPOSE | Competing document-structure/OCR candidates |
| CLAIMED CAPABILITY | OCR and document conversion/parsing |
| INDEPENDENT EVIDENCE | Not yet accepted for Korean medical-result templates |
| OUR BENCHMARK RESULT | None on the frozen project corpus |
| SECURITY REVIEW | Pending offline loading, parser sandbox, archive/PDF bombs, resource caps, and zero-egress capture |
| PRIVACY REVIEW | Synthetic/redacted corpus only until explicit cloud/local consent architecture passes |
| REGULATORY IMPACT | Extraction errors can create false medical facts; all outputs remain review candidates |
| INTEGRATION COST | High due artifacts, GPU/CPU paths, template benchmarking, and abstention UX |
| EXIT COST | Medium if output schema remains vendor-neutral |
| STATUS | `EVALUATING` |

## Presidio

| Field | Record |
|---|---|
| NAME | Presidio |
| SOURCE | <https://github.com/data-privacy-stack/presidio> |
| DATE | Reviewed 2026-08-30 |
| VERSION | Unpinned |
| LICENSE | MIT repository; recognizers/models reviewed separately |
| PURPOSE | Possible defense-in-depth PII detection |
| CLAIMED CAPABILITY | PII detection and anonymization |
| INDEPENDENT EVIDENCE | No admitted Korean medical false-negative evidence |
| OUR BENCHMARK RESULT | None |
| SECURITY REVIEW | Not started |
| PRIVACY REVIEW | Must never be the sole PHI control |
| REGULATORY IMPACT | A detected/redacted label does not make health data anonymous or lawful to reuse |
| INTEGRATION COST | Medium |
| EXIT COST | Low |
| STATUS | `WATCHING` |

## MedGemma 1.5

| Field | Record |
|---|---|
| NAME | MedGemma 1.5 |
| SOURCE | <https://developers.google.com/health-ai-developer-foundations/medgemma/model-card> |
| DATE | Model card reverified 2026-08-30 |
| VERSION | 1.5 family; no weight or runtime admitted |
| LICENSE | Artifact-specific terms not yet receipted |
| PURPOSE | Candidate offline comparison for bounded medical-document field proposal—not diagnosis |
| CLAIMED CAPABILITY | Medical text/image foundation model starting point |
| INDEPENDENT EVIDENCE | No independent evidence yet for our Korean task, corpus, hardware, or safety boundary |
| OUR BENCHMARK RESULT | None |
| SECURITY REVIEW | Pending weights digest, runtime/container SBOM, zero-egress, prompt-injection, and tool-denial tests |
| PRIVACY REVIEW | Synthetic/redacted benchmark only; no provider upload |
| REGULATORY IMPACT | Publisher states task-specific validation is required and output is not for direct diagnosis/treatment/patient management |
| INTEGRATION COST | High |
| EXIT COST | Medium if output remains typed and model-independent |
| STATUS | `WATCHING` / benchmark-only candidate |

## Medplum

| Field | Record |
|---|---|
| NAME | Medplum |
| SOURCE | <https://github.com/medplum/medplum> |
| DATE | Reviewed 2026-08-30 |
| VERSION | Not admitted |
| LICENSE | Apache-2.0 repository; deployment dependencies separate |
| PURPOSE | Alternative FHIR application platform |
| CLAIMED CAPABILITY | Open-source FHIR server/application platform |
| INDEPENDENT EVIDENCE | Not required for current rejection |
| OUR BENCHMARK RESULT | None |
| SECURITY REVIEW | Not performed |
| PRIVACY REVIEW | Not performed |
| REGULATORY IMPACT | Would not remove Korean conformity/privacy work |
| INTEGRATION COST | High architectural divergence from Kotlin/Spring |
| EXIT COST | High after adoption |
| STATUS | `REJECTED` for MVP under D-018; revisit only after measured HAPI failure |
