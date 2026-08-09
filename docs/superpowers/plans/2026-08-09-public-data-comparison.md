# Public Data Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public-only Korean health-source vertical slice that acquires approved official HIRA, MOHW, and KDCA data, preserves immutable provenance through bronze/silver/gold, detects and quarantines drift, publishes freshness- and recall-aware comparisons, and proves its UX handoff through contract tests and an isolated Korean-first fixture explorer.

**Architecture:** The FND-owned Kotlin/Spring Boot modular monolith supplies the pinned build, dependency contract, and CI foundation. This plan adds only the `publicdata` module: connector governance, official-source acquisition, provenance, normalization, publication, comparison, freshness, and recall. Production C0 runs a distinct `PublicDataApplication`/`publicDataBootJar` from the same pinned project; its component scan includes only `kr.co.genomecompanion.publicdata`, its config name is only `application-publicdata`, and its runtime identity receives only the dedicated public datasource, Flyway, S3, KMS, and operator-OIDC settings. It does not load the FND personal entry point, beans, routes, configuration, database credentials, storage credentials, or logs. PostgreSQL stores append-only public metadata and normalized records; S3-compatible content-addressed storage holds immutable bronze payloads. The API publishes exact OpenAPI provider-directory, non-covered-item-discovery, and non-covered-price contracts for the separately owned production UX, while an isolated nonproduction Next.js explorer under `tools/public-data-preview/` proves contract/evidence states without touching `apps/web/**`.

**Tech Stack:** FND compatibility contract: Java 21, Kotlin 2.2.20, Spring Boot 3.5.7, Gradle 8.14.3, HAPI FHIR 8.10.1, PostgreSQL 16.10, Flyway, JUnit 5, AssertJ, Testcontainers 1.21.3, and ArchUnit 1.4.1. PUB adds AWS SDK for Java v2 2.49.6, Jackson XML/YAML, and an isolated Node.js 24 LTS / Next.js 16.3.0 / TypeScript / Tailwind CSS / Vitest / Testing Library / Playwright / axe-core preview tool.

## Global Constraints

- FND must land first. This plan consumes, and must not recreate or overwrite, root `settings.gradle.kts`, root `build.gradle.kts`, `gradle/libs.versions.toml`, the Gradle 8.14.3 wrapper, `CoreApiApplication.kt`, base `application.yml`, base `application-test.yml`, or the CI/release foundation. The sole core-build edit is the additive PUB script application described below.
- Shared core pins are immutable in this workstream: Java 21, Kotlin 2.2.20, Spring Boot 3.5.7, Gradle 8.14.3, HAPI FHIR 8.10.1, PostgreSQL 16.10, Testcontainers 1.21.3, and ArchUnit 1.4.1. A version change requires the separate reviewed root dependency process.
- PUB owns Flyway versions `V100` through `V119`. Its first and only migration in this plan is exactly `V100__public_reference_schema.sql`; it must not use FND's `V1`-`V19` or REC's `V200`-`V219` ranges.
- Build integration is additive: create `apps/core-api/publicdata-dependencies.gradle.kts`, then add exactly one `apply(from = "publicdata-dependencies.gradle.kts")` line to the FND-owned core build. Runtime configuration lives in `application-publicdata.yml`; the base `application.yml` is untouched. CI is added only inside FND's stable `PUB` extension marker in `.github/workflows/ci.yml`.
- C0 production is fail-closed: build and deploy only `publicDataBootJar`; start only `PublicDataApplication`; set `spring.config.name=application-publicdata`; use a dedicated `publicDataSource` and PUB Flyway history; inject a C0-only S3/KMS/deployment identity; and inject no FND personal datasource, bucket, KMS, Cognito, consent, document, record, or genome credential. `PublicDataIsolationStartupTest` must prove personal beans are absent and representative personal routes return 404. If that test cannot pass, production is blocked and a separately reviewed FND-pinned Gradle deployment module must be created before release—there is no shared-credential fallback.
- This plan implements only the C0 public-reference plane. It creates no account, consent, document, health-record, FHIR, genome, or personalization capability.
- Public-reference storage, database schema, application package, credentials, logs, metrics, and deployment identity remain separate from every present or future personal-data plane.
- An adapter may fetch only a registered official Open API endpoint or an explicitly approved official file URL. It must never crawl or parse an agency website when an official API or file exists.
- `canonicalUrl` documents the official catalog page; `endpoint` is the only fetchable URI. Catalog HTML is never an ingestion input.
- Government keys stay in server-side secret storage. They never appear in source control, browser code, URLs returned to users, logs, metrics, request fingerprints, snapshots, or error bodies.
- Dataset-level license, third-party-rights, operational approval, allowed use, source cadence, and product freshness policy are mandatory registry fields. Agency-wide license assumptions are prohibited.
- Public Nuri Type 2 and Type 4 are not publishable in a commercial product. Type 3 is denied until an unmodified-serving design and review are recorded. Type 1 with third-party rights remains development-only until explicit production approval is committed.
- HIRA `15001698` starts as `DEVELOPMENT_ONLY`; its adapter and fixtures are implemented, but production publication remains blocked until operational approval and third-party-rights review are recorded.
- HIRA `15001700` is the only price source in this slice. It starts as `DEVELOPMENT_ONLY` despite automatic API approval because its own Type 1/third-party-rights release review must be recorded. `curAmt` is published only as the amount present in that source row and is never relabeled as a quote, final bill, market price, provider quality, or recommendation; users are told to confirm the current amount with the institution.
- Non-covered-item discovery is derived only from the active signed HIRA `15001700` facts. It returns official `npayCd`/`npayKorNm` pairs, deterministically deduplicated by code and ordered by the official item name then code; it performs no synonym expansion, popularity scoring, recommendation, or ranking. Conflicting official names for one code quarantine the source run rather than choosing a label.
- MOHW `15098823` and KDCA `15084296` start as the production-eligible sources because their official catalog records state unrestricted use; release still requires the committed source-owner review fields in the registry.
- The Type 4 KDCA infectious-disease dataset `15139178` is represented only as a negative policy fixture proving that commercial publication is denied.
- Bronze payloads, silver record versions, gold fact versions, manifests, quarantine events, source-state events, and recall events are append-only. Only the active-manifest pointer is mutable, and every pointer change has an immutable event.
- A schema, license, content-type, count, identity-key, date, or freshness uncertainty fails closed: retain bronze, append a quarantine event, publish nothing new, and continue serving only the last non-recalled signed manifest within its stale window.
- Public facts retain agency, dataset ID, canonical URL, source period, publication time when supplied, retrieval time, bronze checksum, schema hash, transform version, license snapshot, attribution, comparability class, and caveats.
- HIRA encrypted institution identifiers are source-local record keys. They are hashed before public fact IDs are formed and are never treated as person identifiers or cross-agency join keys.
- Provider rows are filtered and sorted, never scored as “best.” MOHW aggregate counts are context and are never represented as current capacity. KDCA vaccination-condition codes are reference content and are never converted into personalized advice.
- Source freshness policies in this plan are internal product SLOs, not claims that an agency guarantees that cadence.
- Tests use synthetic fixtures modeled on documented fields. Routine tests make no live government calls. A live smoke test is opt-in and skipped unless a development key is supplied.
- This plan must not create or modify `apps/web/**`; the product/UX implementation plan owns that tree and consumes the OpenAPI `ComparisonPage`, `NonCoveredItemPage`, and `NonCoveredPricePage` contracts.
- The internal preview collects only public filters (`regionCode`, `providerType`, `page`, `size`). It has no login, free-text health input, analytics identifier, ad SDK, upload, or personal API call and cannot be deployed as the production consumer surface.
- All commits are small and use only the files named in their task. Run the stated failing test before implementation, then the passing test, then commit.
- Every C0 operator token is accepted only when signature, exact issuer, exact single audience, exact authorized party/client ID, `token_use=access`, expiry, and one allowlisted qualified operator scope all pass. Issuer-only JWT validation is prohibited.
- Every public comparison/fact response uses `Cache-Control: no-store, max-age=0` and `Pragma: no-cache`; no intermediary or browser may reuse a pre-recall response. Recall tests exercise the real headers before and after rollback.
- Official-source response bodies are streamed through a 32 MiB hard cap before allocation and before bronze persistence. Missing/invalid/oversized `Content-Length`, chunked overflow, decompression, or retry cannot bypass the same counted-byte limit.
- Production remains disabled until FND owns a protected `pub_release` job/marker, public ECR shell, release role, evidence bucket prefix, and digest-only deployment input. PUB may populate only that marker and may never create its own role, repository, deployment authority, or workflow.

---

## Source decisions for this slice

| Connector | Official catalog | Fetch endpoint | Initial release state | Product role |
|---|---|---|---|---|
| `hira.hospital-directory.v1` | [HIRA hospital information, dataset 15001698](https://www.data.go.kr/data/15001698/openapi.do) | `https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList` | `DEVELOPMENT_ONLY` | Provider directory fields; the official record says XML, Type 1 attribution, third-party rights, development auto-approval, and operational review. |
| `hira.non-covered-price.v1` | [HIRA non-covered treatment-cost information, dataset 15001700](https://www.data.go.kr/data/15001700/openapi.do) | `https://apis.data.go.kr/B551182/nonPaymentDamtInfoService/getNonPaymentItemHospDtlList` | `DEVELOPMENT_ONLY` pending a connector-specific rights approval reference | Source-faithful official item-code/name discovery and hospital/item/current-amount rows for the lead comparison wedge. The official record documents XML, free use, Type 1 attribution with third-party rights, development and production auto-approval, a 2026-01-14 modification date, and the request/response fields used below. |
| `mohw.facility-counts.v1` | [MOHW hospital and clinic counts, dataset 15098823](https://www.data.go.kr/data/15098823/openapi.do) | `https://apis.data.go.kr/1352000/ODMS_STAT_14/callStat14Api` | `PRODUCTION_APPROVED` after committed owner review | Annual regional context; the official record documents JSON/XML, 2015–2024 coverage, and unrestricted use. |
| `kdca.vaccination-condition-codes.v1` | [KDCA vaccination-condition information, dataset 15084296](https://www.data.go.kr/data/15084296/openapi.do) | `https://apis.data.go.kr/1790387/vcninfo/getCondVcnCd` | `PRODUCTION_APPROVED` after committed owner review | Public reference codes only; the official record documents XML and unrestricted use. |
| Policy-denial fixture | [KDCA notifiable-disease occurrence, dataset 15139178](https://www.data.go.kr/data/15139178/openapi.do) | No runtime connector | `DISABLED` | Proves Public Nuri Type 4 cannot enter commercial gold/publication. |

## Exact file map

### Foundation inputs and additive integration

- Consume without modification `settings.gradle.kts`, root `build.gradle.kts`, `gradle/libs.versions.toml`, `gradlew`, `gradlew.bat`, and `gradle/wrapper/**` — the FND-owned Java 21 / Kotlin 2.2.20 / Spring Boot 3.5.7 / Gradle 8.14.3 build contract.
- Consume without modification `apps/core-api/src/main/kotlin/kr/co/genomecompanion/CoreApiApplication.kt`, `apps/core-api/src/main/resources/application.yml`, and `apps/core-api/src/test/resources/application-test.yml` — the FND-owned personal-plane entry point/configuration; the C0 process never loads them.
- Create `apps/core-api/publicdata-dependencies.gradle.kts` — only PUB-specific Jackson XML/YAML, AWS S3/KMS, and LocalStack dependencies plus the `live-source` test exclusion.
- Modify `apps/core-api/build.gradle.kts` — append only `apply(from = "publicdata-dependencies.gradle.kts")`; preserve every FND plugin, pin, dependency, compiler option, and task.
- Create `scripts/ci/public_data_acceptance.ps1` — deterministic backend, OpenAPI, preview, migration-range, no-scraping, and no-personal-plane checks.
- Modify `.github/workflows/ci.yml` — insert only the PUB acceptance step at FND's stable `PUB` extension marker; do not create a second workflow or change foundation permissions/actions/jobs.

### Kotlin public-data application

- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/PublicDataModuleConfiguration.kt` — `publicdata`-profile module configuration used only by the C0 entry point.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/PublicDataApplication.kt` — C0-only entry point scanning only the public-data package and forcing config name `application-publicdata`.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config/PublicDataPersistenceConfiguration.kt` — validated dedicated public datasource/JDBC/Flyway beans; Flyway reads only `classpath:db/publicdata-migration`.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config/PublicDataAwsConfiguration.kt` — C0-only Seoul S3/KMS/Secrets Manager clients and validated bucket/key/secret properties.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/boundary/PublicPlaneBoundary.kt` — explicit C0 plane marker.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/registry/ConnectorDefinition.kt` — connector, access, license, approval, and freshness types.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/registry/ConnectorRegistry.kt` — YAML loader and lookup port.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/registry/PublicationPolicy.kt` — acquisition and publication gates.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/acquire/OfficialSourceTransport.kt` — official request/response and secret ports.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/acquire/DataGoKrTransport.kt` — allowlisted HTTPS client with redaction and content-type enforcement.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/acquire/SecretsManagerSecretResolver.kt` — resolve the single allowlisted data.go.kr key from the C0 Secrets Manager identity without caching/logging plaintext.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/acquire/AcquisitionCoordinator.kt` — fetch-then-bronze orchestration.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/ProvenanceModels.kt` — bronze, silver, gold, manifest, event, and lineage value types.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/Digests.kt` — lower-case SHA-256 helpers for bytes and UTF-8 text.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/ImmutablePayloadStore.kt` — content-addressed bronze object port.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/S3ImmutablePayloadStore.kt` — S3-compatible implementation using conditional create semantics.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/PublicDataRepositories.kt` — append/query repository ports.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/JdbcPublicDataRepositories.kt` — PostgreSQL implementations.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/SourceAdapter.kt` — paged source adapter contract.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/SourceParsing.kt` — exact XML element/text/map/date helpers and parse exceptions shared by source adapters.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/SecureXml.kt` — XXE-disabled XML parsing.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraHospitalDirectoryAdapter.kt` — HIRA request, parse, and source-faithful record mapping.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraNonCoveredPriceAdapter.kt` — HIRA dataset 15001700 provider/item/current-amount request, parse, and source-faithful mapping.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/mohw/MohwFacilityCountAdapter.kt` — MOHW JSON request, parse, and aggregate mapping.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/kdca/KdcaVaccinationConditionAdapter.kt` — KDCA XML request, parse, and reference mapping.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/validation/SchemaContract.kt` — required/allowed fields and validation outcomes.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/validation/SchemaContractLoader.kt` — strict classpath JSON contract loader used by production wiring and tests.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/validation/SchemaValidator.kt` — page/batch schema, count, duplicate-key, and official-code/name consistency validation.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/validation/QuarantineService.kt` — immutable quarantine and source-state events.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/pipeline/PublicIngestionPipeline.kt` — acquire, validate, silver, gold, publish state machine.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish/PublicFact.kt` — public fact and comparability contract.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish/PublicFactMappers.kt` — HIRA, MOHW, and KDCA fact mappers.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/JdbcHiraProviderKeyCatalog.kt` — recover server-only HIRA request keys by joining the signed active directory manifest to silver; never return them through an API.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish/ManifestSigner.kt` — signing port and local Ed25519 verifier.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish/KmsManifestSigner.kt` — AWS KMS asymmetric signing implementation.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish/PublicationService.kt` — append-only gold/manifest write and atomic active-pointer switch.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison/ComparisonModels.kt` — API request/response DTOs.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison/ComparisonService.kt` — active-fact filtering, neutral ordering, and context assembly.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison/PublicCursorCodec.kt` — opaque active-publication cursor slicing shared by item discovery and price results.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison/PublicComparisonController.kt` — public comparison and fact endpoints.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/SourceOperations.kt` — freshness state, recall commands, and results.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/FreshnessMonitor.kt` — scheduled evaluation and metrics.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/RecallService.kt` — append recall and roll back or disable.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/InternalRecallController.kt` — scoped operator endpoint.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/PublicIngestionScheduler.kt` — approved recurring ingestion and adapter lookup.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/InternalIngestionController.kt` — scoped manual ingestion endpoint.
- Create `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config/SecurityConfiguration.kt` — public read and scoped internal recall rules.
- Create `apps/core-api/src/main/resources/application-publicdata.yml` — additive public schema, secret references, object bucket, and scheduler configuration loaded only by the `publicdata` profile.
- Create `apps/core-api/src/main/resources/connectors/public-connectors.yml` — the four governed runtime connector records.
- Create `apps/core-api/src/main/resources/schemas/hira-hospital-directory-v1.json` — HIRA field contract.
- Create `apps/core-api/src/main/resources/schemas/hira-non-covered-price-v1.json` — HIRA `ykiho`, provider, item, effective-date, `curAmt`, and official code/name consistency contract.
- Create `apps/core-api/src/main/resources/schemas/mohw-facility-counts-v1.json` — MOHW field contract.
- Create `apps/core-api/src/main/resources/schemas/kdca-vaccination-condition-codes-v1.json` — KDCA field contract.
- Create `apps/core-api/src/main/resources/db/publicdata-migration/V100__public_reference_schema.sql` — isolated append-only C0 schema in PUB's allocated migration range and isolated Flyway location.
- Create `apps/core-api/src/main/resources/openapi/public-comparison.yaml` — public and internal HTTP contracts.
- Create `apps/core-api/Dockerfile.publicdata` and `apps/core-api/Dockerfile.publicdata.dockerignore` — reproducible non-root image containing only `public-data-api.jar` and the public-data configuration/resources.
- Create `packages/contracts/jsonschema/public-data-image-handoff.schema.json` and `packages/contracts/fixtures/public-data-image-handoff.valid.json` — exact protected image-release handoff.
- Create `scripts/release/public_data_image_release.py` and `scripts/release/test_public_data_image_release.py` — strict image metadata/provenance/handoff builder and verifier; it never signs, pushes, assumes a role, or deploys.

### Kotlin tests and synthetic source fixtures

- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/boundary/PublicPlaneArchitectureTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/boundary/PublicDataIsolationStartupTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/registry/ConnectorRegistryTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/registry/PublicationPolicyTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/provenance/ImmutableProvenanceIntegrationTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/acquire/DataGoKrTransportTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/acquire/SecretsManagerSecretResolverTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/acquire/AcquisitionCoordinatorTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/SecureXmlTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraHospitalDirectoryAdapterTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraHospitalDirectoryLiveSmokeTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraNonCoveredPriceAdapterTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraNonCoveredPriceLiveSmokeTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/mohw/MohwFacilityCountAdapterTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/kdca/KdcaVaccinationConditionAdapterTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/validation/SchemaDriftQuarantineIntegrationTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/publish/PublicationServiceIntegrationTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/comparison/PublicComparisonControllerTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/operations/FreshnessAndRecallIntegrationTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/config/PublicDataJwtValidationTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/pipeline/PublicComparisonSliceIntegrationTest.kt`.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/SourceTestFixtures.kt` — deterministic connector definitions, acquired/stored payloads, fixture resources, schema contracts, and request builders.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/PublicationTestFixtures.kt` — approved test-only HIRA definitions, mapped batches, fixed manifest signer/verifier, Type 4 denial fixture, and published manifests.
- Create `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/ComparisonTestFixtures.kt` — exact provider/item-discovery/price DTO fixtures, recall JSON, connector freshness fixture, and in-memory official fixture source.
- Create `apps/core-api/src/test/resources/application-publicdata-test.yml` — PUB-only synthetic overrides loaded as the `test` profile of config name `application-publicdata`; FND's `application-test.yml` is untouched and not loaded.
- Create `apps/core-api/src/test/resources/fixtures/hira/hospital-page-1.xml` and `hospital-page-2.xml`.
- Create `apps/core-api/src/test/resources/fixtures/hira/hospital-renamed-field.xml`.
- Create `apps/core-api/src/test/resources/fixtures/hira/non-covered-price-page.xml`.
- Create `apps/core-api/src/test/resources/fixtures/hira/non-covered-price-invalid-amount.xml`.
- Create `apps/core-api/src/test/resources/fixtures/hira/non-covered-price-conflicting-item-name.xml`.
- Create `apps/core-api/src/test/resources/fixtures/mohw/facility-counts-2024.json`.
- Create `apps/core-api/src/test/resources/fixtures/mohw/facility-counts-invalid-total.json`.
- Create `apps/core-api/src/test/resources/fixtures/kdca/vaccination-condition-codes.xml`.
- Create `apps/core-api/src/test/resources/fixtures/kdca/vaccination-condition-codes-doctype.xml`.

### Isolated public-data fixture explorer

- Create `tools/public-data-preview/package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, and `.env.example` from the pinned Next.js scaffold.
- Create `tools/public-data-preview/vitest.config.ts`, `tools/public-data-preview/vitest.setup.ts`, and `tools/public-data-preview/playwright.config.ts`.
- Create `tools/public-data-preview/src/generated/public-comparison.ts` — generated from the public OpenAPI document and therefore containing `ComparisonPage`, `NonCoveredItemPage`, and `NonCoveredPricePage`; the isolated explorer consumes only `ComparisonPage`.
- Create `tools/public-data-preview/src/app/layout.tsx` — internal explorer metadata and page shell.
- Create `tools/public-data-preview/src/app/globals.css` — Midnight Evidence Ledger tokens and accessible states.
- Create `tools/public-data-preview/src/app/compare/page.tsx` — server-rendered contract explorer.
- Create `tools/public-data-preview/src/components/ComparisonFilters.tsx` — allowlisted public filters.
- Create `tools/public-data-preview/src/components/ProviderComparisonTable.tsx` — neutral accessible table.
- Create `tools/public-data-preview/src/components/SourceMasthead.tsx` — agency, dataset, period, retrieval, and attribution.
- Create `tools/public-data-preview/src/components/FreshnessBanner.tsx` — fresh, stale, expired, quarantined, and recall states in text and color.
- Create `tools/public-data-preview/src/components/ProvenanceDetails.tsx` — fact-level lineage and caveats.
- Create `tools/public-data-preview/src/components/RegionalContext.tsx` — annual MOHW context with a non-capacity caveat.
- Create `tools/public-data-preview/src/lib/publicComparison.ts` — typed server-only API client consuming generated `ComparisonPage`.
- Create `tools/public-data-preview/src/lib/publicComparison.test.ts`.
- Create `tools/public-data-preview/src/components/ProviderComparisonTable.test.tsx`.
- Create `tools/public-data-preview/e2e/provider-comparison.spec.ts`.
- Create `tools/public-data-preview/e2e/fixtures/provider-comparison.json`.
- Create `tools/public-data-preview/e2e/mock-api.mjs` — local public-API fixture server for server-rendered explorer tests.

### Operations documentation produced by implementation

- Create `docs/runbooks/public-data-ingestion.md` — exact acquisition, quarantine, freshness, rollback, and key-rotation commands.
- Create `docs/runbooks/public-data-recall.md` — scoped recall procedure, evidence capture, verification, and restoration rules.

## Interface ledger

The following names and signatures are fixed for all tasks. Later tasks consume them exactly as written.

```kotlin
@JvmInline value class ConnectorId(val value: String)

enum class Agency { HIRA, MOHW, KDCA }
enum class AccessMethod { OFFICIAL_OPEN_API, OFFICIAL_FILE }
enum class SourceFormat { XML, JSON, CSV, ZIP }
enum class LicenseClass { UNRESTRICTED, PUBLIC_NURI_0, PUBLIC_NURI_1, PUBLIC_NURI_2, PUBLIC_NURI_3, PUBLIC_NURI_4 }
enum class ReleaseStatus { DEVELOPMENT_ONLY, PRODUCTION_APPROVED, DISABLED }

data class FreshnessPolicy(
    val freshFor: Duration,
    val serveStaleFor: Duration,
)

data class ConnectorDefinition(
    val connectorId: ConnectorId,
    val agency: Agency,
    val datasetId: String,
    val canonicalUrl: URI,
    val accessMethod: AccessMethod,
    val endpoint: URI,
    val authParameter: String,
    val secretRef: String,
    val format: SourceFormat,
    val releaseStatus: ReleaseStatus,
    val licenseClass: LicenseClass,
    val thirdPartyRights: Boolean,
    val thirdPartyRightsApprovalRef: String?,
    val licenseReviewedBy: String,
    val licenseReviewedAt: LocalDate,
    val attribution: String,
    val permittedUses: Set<String>,
    val prohibitedUses: Set<String>,
    val allowedHosts: Set<String>,
    val freshnessPolicy: FreshnessPolicy,
)

interface ConnectorRegistry {
    fun get(connectorId: ConnectorId): ConnectorDefinition
    fun all(): List<ConnectorDefinition>
}

interface PublicationPolicy {
    fun requireAcquisitionAllowed(definition: ConnectorDefinition)
    fun requirePublicationAllowed(definition: ConnectorDefinition)
}
```

```kotlin
data class OfficialApiRequest(
    val connectorId: ConnectorId,
    val uri: URI,
    val query: Map<String, String>,
    val accept: SourceFormat,
)

data class AcquiredPayload(
    val connectorId: ConnectorId,
    val sourceUri: URI,
    val requestFingerprint: String,
    val contentType: String,
    val bytes: ByteArray,
    val retrievedAt: Instant,
    val responseHeaders: Map<String, String>,
)

fun interface SecretResolver {
    fun resolve(secretRef: String): String
}

fun interface OfficialSourceTransport {
    fun get(definition: ConnectorDefinition, request: OfficialApiRequest): AcquiredPayload
}
```

```kotlin
data class BronzeSnapshot(
    val snapshotId: UUID,
    val connectorId: ConnectorId,
    val objectKey: String,
    val sha256: String,
    val requestFingerprint: String,
    val contentType: String,
    val responseHeaders: Map<String, String>,
    val retrievedAt: Instant,
)

data class StoredPayload(
    val snapshot: BronzeSnapshot,
    val bytes: ByteArray,
)

interface ImmutablePayloadStore {
    fun put(payload: AcquiredPayload): StoredPayload
    fun read(snapshot: BronzeSnapshot): ByteArray
}

interface AcquisitionCoordinator {
    fun acquire(definition: ConnectorDefinition, request: OfficialApiRequest): StoredPayload
}
```

```kotlin
data class SilverRecordVersion(
    val silverId: UUID,
    val connectorId: ConnectorId,
    val sourceKeyHash: String,
    val bronzeSnapshotId: UUID,
    val original: JsonNode,
    val normalized: JsonNode,
    val sourcePublishedAt: Instant?,
    val retrievedAt: Instant,
    val schemaHash: String,
    val transformVersion: String,
    val createdAt: Instant,
)

data class QuarantineEvent(
    val eventId: UUID,
    val connectorId: ConnectorId,
    val snapshotId: UUID,
    val schemaHash: String,
    val reasons: List<String>,
    val occurredAt: Instant,
)

data class SourceStateEvent(
    val eventId: UUID,
    val connectorId: ConnectorId,
    val status: SourceStatus,
    val sourceAsOf: Instant?,
    val retrievedAt: Instant?,
    val noticeKo: String,
    val occurredAt: Instant,
)

data class RecallEvent(
    val eventId: UUID,
    val connectorId: ConnectorId,
    val publicationId: UUID,
    val reasonCode: String,
    val reasonKo: String,
    val requestedBy: String,
    val effectiveAt: Instant,
    val occurredAt: Instant,
)

interface BronzeRepository {
    fun insertOrFind(snapshot: BronzeSnapshot): BronzeSnapshot
}

interface PublicDataRepositories : BronzeRepository {
    fun appendSilver(records: List<SilverRecordVersion>)
    fun appendGold(facts: List<PublicFact>)
    fun appendManifest(manifest: PublicationManifest)
    fun appendQuarantine(event: QuarantineEvent)
    fun appendSourceState(event: SourceStateEvent)
    fun appendRecall(event: RecallEvent)
    fun switchActivePublication(connectorId: ConnectorId, publicationId: UUID, reason: String, at: Instant)
    fun clearActivePublication(connectorId: ConnectorId, reason: String, at: Instant)
    fun activePublication(connectorId: ConnectorId): PublicationManifest?
    fun requireServeableActiveManifest(connectorId: ConnectorId): PublicationManifest
    fun previousNonRecalledManifest(connectorId: ConnectorId, publicationId: UUID): PublicationManifest?
    fun manifest(publicationId: UUID): PublicationManifest?
    fun isRecalled(publicationId: UUID): Boolean
    fun facts(publicationId: UUID, subjectType: String): List<PublicFact>
    fun activeFacts(connectorId: ConnectorId, subjectType: String): List<PublicFact>
    fun requireActiveFact(factId: String): PublicFact
    fun latestSourceState(connectorId: ConnectorId): SourceStateEvent?
    fun latestSuccessfulRetrieval(connectorId: ConnectorId): Instant?
    fun publicationRetrieval(publicationId: UUID): Instant?
}
```

```kotlin
interface SourceRecord {
    val sourceKey: String
    val original: Map<String, String?>
}

data class ParsedPage<R : SourceRecord>(
    val records: List<R>,
    val pageNumber: Int,
    val pageSize: Int,
    val totalCount: Int,
    val observedFields: Set<String>,
    val sourcePublishedAt: Instant?,
)

interface SourceAdapter<R : SourceRecord> {
    val connectorId: ConnectorId
    val schemaContract: SchemaContract
    fun initialRequests(definition: ConnectorDefinition): Sequence<OfficialApiRequest>
    fun nextRequest(
        definition: ConnectorDefinition,
        previousRequest: OfficialApiRequest,
        page: ParsedPage<R>,
    ): OfficialApiRequest?
    fun parse(payload: StoredPayload): ParsedPage<R>
}

interface HiraProviderKeyCatalog {
    fun approvedEncryptedProviderKeys(): Sequence<String>
}

class SourceParseException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)
```

```kotlin
data class SchemaContract(
    val connectorId: ConnectorId,
    val version: String,
    val requiredFields: Set<String>,
    val allowedFields: Set<String>,
    val identityFields: Set<String>,
    val consistencyRules: List<ConsistencyRule> = emptyList(),
)

data class ConsistencyRule(
    val keyField: String,
    val valueField: String,
    val reasonCode: String,
)

sealed interface ValidationOutcome {
    data class Accepted(val schemaHash: String) : ValidationOutcome
    data class Quarantined(val schemaHash: String, val reasons: List<String>) : ValidationOutcome
}

interface SchemaValidator {
    fun validate(page: ParsedPage<out SourceRecord>, contract: SchemaContract): ValidationOutcome
    fun validateBatch(
        pages: List<ParsedPage<out SourceRecord>>,
        contract: SchemaContract,
    ): ValidationOutcome
}
```

```kotlin
data class SourceLicenseSnapshot(
    val licenseClass: LicenseClass,
    val thirdPartyRights: Boolean,
    val thirdPartyRightsApprovalRef: String?,
    val reviewedBy: String,
    val reviewedAt: LocalDate,
    val permittedUses: Set<String>,
    val prohibitedUses: Set<String>,
)

data class SourceProvenance(
    val agency: Agency,
    val datasetId: String,
    val canonicalUrl: URI,
    val sourcePeriod: String,
    val publishedAt: Instant?,
    val retrievedAt: Instant,
    val bronzeSha256: String,
    val license: SourceLicenseSnapshot,
    val attribution: String,
)

enum class Comparability {
    DIRECTORY_FIELDS_ONLY,
    NON_COVERED_PRICE_SAME_ITEM_AND_EFFECTIVE_PERIOD_ONLY,
    SAME_PERIOD_AND_DEFINITION_ONLY,
    REFERENCE_ONLY,
}

data class PublicFact(
    val factId: String,
    val connectorId: ConnectorId,
    val subjectType: String,
    val sourceKeyHash: String,
    val source: SourceProvenance,
    val original: JsonNode,
    val normalized: JsonNode,
    val comparability: Comparability,
    val caveats: List<String>,
    val transformVersion: String,
    val schemaHash: String,
)

data class PublicationManifest(
    val publicationId: UUID,
    val connectorId: ConnectorId,
    val factIds: List<String>,
    val createdAt: Instant,
    val digest: String,
    val signature: String,
    val signingKeyId: String,
)

interface ManifestSigner {
    fun sign(canonicalManifest: ByteArray): SignatureEnvelope
}

interface ManifestVerifier {
    fun requireValid(manifest: PublicationManifest)
}

data class SignatureEnvelope(val value: String, val keyId: String, val algorithm: String)
```

```kotlin
enum class SourceStatus { FRESH, STALE, EXPIRED, QUARANTINED, RECALLED, DISABLED }

data class SourceAvailability(
    val connectorId: ConnectorId,
    val status: SourceStatus,
    val sourceAsOf: Instant?,
    val retrievedAt: Instant?,
    val evaluatedAt: Instant,
    val noticeKo: String,
)

data class ProviderComparisonQuery(
    val regionCode: String?,
    val providerType: String?,
    val page: Int,
    val size: Int,
)

enum class NonCoveredPriceSort { PROVIDER_NAME, AMOUNT_ASC, AMOUNT_DESC }

data class NonCoveredPriceQuery(
    val itemCode: String,
    val regionCode: String?,
    val providerType: String?,
    val sort: NonCoveredPriceSort,
    val cursor: String?,
    val size: Int,
)

data class NonCoveredItemQuery(
    val query: String,
    val cursor: String?,
    val size: Int,
)

interface ComparisonService {
    fun compareProviders(query: ProviderComparisonQuery): ComparisonPage
    fun listNonCoveredItems(query: NonCoveredItemQuery): NonCoveredItemPage
    fun compareNonCoveredPrices(query: NonCoveredPriceQuery): NonCoveredPricePage
    fun fact(factId: String): PublicFactResponse
}

enum class RecallReasonCode {
    SOURCE_CORRECTION, SCHEMA_ERROR, MAPPING_ERROR, LICENSE_CHANGE, SECURITY_EVENT,
}

data class RecallRequest(
    @field:NotBlank val connectorId: String,
    val publicationId: UUID,
    val reasonCode: RecallReasonCode,
    @field:Size(min = 10, max = 500) val reasonKo: String,
    val effectiveAt: Instant,
) {
    fun toCommand(requestedBy: String): RecallCommand = RecallCommand(
        connectorId = ConnectorId(connectorId),
        publicationId = publicationId,
        reasonCode = reasonCode.name,
        reasonKo = reasonKo,
        requestedBy = requestedBy,
        effectiveAt = effectiveAt,
    )
}

data class RecallCommand(
    val connectorId: ConnectorId,
    val publicationId: UUID,
    val reasonCode: String,
    val reasonKo: String,
    val requestedBy: String,
    val effectiveAt: Instant,
)

data class RecallResult(
    val recalledPublicationId: UUID,
    val replacementPublicationId: UUID?,
    val occurredAt: Instant,
)

interface RecallService {
    fun recall(command: RecallCommand): RecallResult
}
```

---

### Task 1: Verify the FND baseline and attach the public-data module additively

**Files:**
- Consume unchanged: `settings.gradle.kts`
- Consume unchanged: `build.gradle.kts`
- Consume unchanged: `gradle/libs.versions.toml`
- Consume unchanged: `gradlew`
- Consume unchanged: `gradlew.bat`
- Consume unchanged: `gradle/wrapper/gradle-wrapper.jar`
- Consume unchanged: `gradle/wrapper/gradle-wrapper.properties`
- Modify additively: `apps/core-api/build.gradle.kts`
- Create: `apps/core-api/publicdata-dependencies.gradle.kts`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/PublicDataApplication.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/PublicDataModuleConfiguration.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/boundary/PublicPlaneBoundary.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/boundary/PublicPlaneArchitectureTest.kt`

**Interfaces:**
- Consumes: the completed FND Task 1/2 baseline, including `CoreApiApplication`, Java 21, Kotlin 2.2.20, Spring Boot 3.5.7, Gradle 8.14.3, HAPI FHIR 8.10.1, PostgreSQL 16.10, ArchUnit 1.4.1, and Testcontainers 1.21.3.
- Produces: a distinct `publicDataBootJar`/`PublicDataApplication` whose component scan and config name are C0-only; `PublicDataModuleConfiguration`; `PublicPlaneBoundary(classification: String = "C0_PUBLIC")`; PUB-only dependencies; no root-version mutation and no change to FND's `bootJar`.

- [ ] **Step 1: Prove the FND compatibility baseline before touching a file**

Run from the repository root after the FND plan has completed Task 2:

```powershell
.\gradlew.bat --version
.\gradlew.bat :apps:core-api:dependencyInsight --dependency kotlin-stdlib --configuration runtimeClasspath
.\gradlew.bat :apps:core-api:dependencyInsight --dependency spring-boot --configuration runtimeClasspath
.\gradlew.bat :apps:core-api:dependencyInsight --dependency hapi-fhir-base --configuration runtimeClasspath
rg -n 'distributionUrl=.*gradle-8\.14\.3-bin\.zip' gradle/wrapper/gradle-wrapper.properties
rg -n 'kotlin = "2\.2\.20"|spring-boot = "3\.5\.7"|hapi-fhir = "8\.10\.1"|testcontainers = "1\.21\.3"|archunit = "1\.4\.1"' gradle/libs.versions.toml
```

Expected: Gradle reports 8.14.3 on Java 21; dependency insight resolves Kotlin 2.2.20, Spring Boot 3.5.7, and HAPI FHIR 8.10.1; all five catalog-pin matches print. Stop execution if any result differs. PUB does not regenerate the wrapper, change root plugins, create another `SpringBootApplication`, or replace the core build.

- [ ] **Step 2: Write the failing application and boundary tests**

Create `PublicPlaneArchitectureTest.kt`:

```kotlin
package kr.co.genomecompanion.publicdata.boundary

import com.tngtech.archunit.core.domain.JavaClasses
import com.tngtech.archunit.core.importer.ClassFileImporter
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class PublicPlaneArchitectureTest {
    private val classes: JavaClasses = ClassFileImporter()
        .importPackages("kr.co.genomecompanion.publicdata")

    @Test
    fun `public boundary identifies only C0 data`() {
        assertThat(PublicPlaneBoundary().classification).isEqualTo("C0_PUBLIC")
    }

    @Test
    fun `public code cannot depend on personal planes or scraping libraries`() {
        noClasses().that().resideInAPackage("..publicdata..")
            .should().dependOnClassesThat().resideInAnyPackage(
                "..identityaccount..", "..consentpurpose..", "..healthrecord..", "..documentintake..",
                "..exportdeletion..", "..genome..", "org.jsoup..", "org.openqa.selenium..",
                "com.microsoft.playwright..",
            ).check(classes)
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.PublicPlaneArchitectureTest" --info
```

Expected: compilation fails with `Unresolved reference 'PublicPlaneBoundary'`; no root or FND-owned file has changed.

- [ ] **Step 4: Add only the PUB dependency fragment, module configuration, and boundary marker**

Create `apps/core-api/publicdata-dependencies.gradle.kts`:

```kotlin
dependencies {
    add("implementation", platform("software.amazon.awssdk:bom:2.49.6"))
    add("implementation", "com.fasterxml.jackson.dataformat:jackson-dataformat-xml")
    add("implementation", "com.fasterxml.jackson.dataformat:jackson-dataformat-yaml")
    add("implementation", "software.amazon.awssdk:s3")
    add("implementation", "software.amazon.awssdk:kms")
    add("implementation", "software.amazon.awssdk:secretsmanager")
    add("testImplementation", "org.testcontainers:localstack:1.21.3")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform { excludeTags("live-source") }
}

tasks.register<org.springframework.boot.gradle.tasks.bundling.BootJar>("publicDataBootJar") {
    group = "build"
    description = "Build the isolated C0 public-data API"
    mainClass.set("kr.co.genomecompanion.publicdata.PublicDataApplicationKt")
    archiveFileName.set("public-data-api.jar")
    classpath = sourceSets["main"].runtimeClasspath
}
```

Append exactly this line to the bottom of FND's existing `apps/core-api/build.gradle.kts`; do not reorder or replace any existing content:

```kotlin
apply(from = "publicdata-dependencies.gradle.kts")
```

Create `PublicDataApplication.kt`:

```kotlin
package kr.co.genomecompanion.publicdata

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration
import org.springframework.boot.builder.SpringApplicationBuilder

@SpringBootApplication(
    scanBasePackageClasses = [PublicDataModuleConfiguration::class],
    exclude = [FlywayAutoConfiguration::class],
)
class PublicDataApplication

fun main(args: Array<String>) {
    SpringApplicationBuilder(PublicDataApplication::class.java)
        .profiles("publicdata")
        .properties(mapOf("spring.config.name" to "application-publicdata"))
        .run(*args)
}
```

Create `PublicDataModuleConfiguration.kt`:

```kotlin
package kr.co.genomecompanion.publicdata

import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile

@Configuration(proxyBeanMethods = false)
@Profile("publicdata")
class PublicDataModuleConfiguration
```

Create `PublicPlaneBoundary.kt`:

```kotlin
package kr.co.genomecompanion.publicdata.boundary

data class PublicPlaneBoundary(val classification: String = "C0_PUBLIC")
```

- [ ] **Step 5: Run the boundary test, dependency proof, and FND application compilation**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.PublicPlaneArchitectureTest"
.\gradlew.bat :apps:core-api:dependencyInsight --dependency jackson-dataformat-xml --configuration runtimeClasspath
.\gradlew.bat :apps:core-api:dependencyInsight --dependency hapi-fhir-base --configuration runtimeClasspath
.\gradlew.bat :apps:core-api:bootJar :apps:core-api:publicDataBootJar
```

Expected: every command reports `BUILD SUCCESSFUL`; two architecture tests pass; Jackson XML is present; HAPI remains exactly 8.10.1; FND's `core-api.jar` and PUB's `public-data-api.jar` both exist with distinct main classes; `git diff -- settings.gradle.kts build.gradle.kts gradle gradlew gradlew.bat apps/core-api/src/main/resources/application.yml .github/workflows/ci.yml` is empty.

- [ ] **Step 6: Commit the additive module seam**

```powershell
git add apps/core-api/build.gradle.kts apps/core-api/publicdata-dependencies.gradle.kts apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/PublicDataApplication.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/PublicDataModuleConfiguration.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/boundary/PublicPlaneBoundary.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/boundary/PublicPlaneArchitectureTest.kt
git commit -m "build(pub): attach public data module"
```

---

### Task 2: Implement the governed connector registry and publication policy

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/registry/ConnectorDefinition.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/registry/ConnectorRegistry.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/registry/PublicationPolicy.kt`
- Create: `apps/core-api/src/main/resources/connectors/public-connectors.yml`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/registry/ConnectorRegistryTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/registry/PublicationPolicyTest.kt`

**Interfaces:**
- Consumes: `PublicPlaneBoundary`; Jackson YAML support from Task 1's PUB-only dependency fragment.
- Produces: `ConnectorId`, `ConnectorDefinition`, `ConnectorRegistry.get`, `ConnectorRegistry.all`, `PublicationPolicy.requireAcquisitionAllowed`, and `PublicationPolicy.requirePublicationAllowed` exactly as defined in the interface ledger.

- [ ] **Step 1: Write failing registry and policy tests**

Create `ConnectorRegistryTest.kt`:

```kotlin
package kr.co.genomecompanion.publicdata.registry

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.core.io.ClassPathResource

class ConnectorRegistryTest {
    private val registry = YamlConnectorRegistry(ClassPathResource("connectors/public-connectors.yml"))

    @Test
    fun `loads only governed official API connectors`() {
        assertThat(registry.all().map { it.connectorId.value }).containsExactly(
            "hira.hospital-directory.v1",
            "hira.non-covered-price.v1",
            "kdca.vaccination-condition-codes.v1",
            "mohw.facility-counts.v1",
        )
        assertThat(registry.all()).allSatisfy { connector ->
            assertThat(connector.accessMethod).isEqualTo(AccessMethod.OFFICIAL_OPEN_API)
            assertThat(connector.endpoint.scheme).isEqualTo("https")
            assertThat(connector.endpoint.host).isIn(connector.allowedHosts)
            assertThat(connector.endpoint.path).doesNotEndWith(".do")
            assertThat(connector.canonicalUrl.host).isEqualTo("www.data.go.kr")
            assertThat(connector.licenseReviewedBy).isNotBlank()
        }
    }

    @Test
    fun `keeps both HIRA connectors development only until their own rights reviews`() {
        val hiras = listOf(
            registry.get(ConnectorId("hira.hospital-directory.v1")),
            registry.get(ConnectorId("hira.non-covered-price.v1")),
        )
        assertThat(hiras).allSatisfy { hira ->
            assertThat(hira.releaseStatus).isEqualTo(ReleaseStatus.DEVELOPMENT_ONLY)
            assertThat(hira.thirdPartyRights).isTrue()
            assertThat(hira.thirdPartyRightsApprovalRef).isNull()
        }
    }
}
```

Create `PublicationPolicyTest.kt`:

```kotlin
package kr.co.genomecompanion.publicdata.registry

import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.net.URI
import java.time.Duration
import java.time.LocalDate

class PublicationPolicyTest {
    private val policy = DefaultPublicationPolicy()

    @Test
    fun `denies HIRA publication while development only`() {
        val hira = approvedShape(ReleaseStatus.DEVELOPMENT_ONLY, LicenseClass.PUBLIC_NURI_1, true)
        assertThatThrownBy { policy.requirePublicationAllowed(hira) }
            .isInstanceOf(PublicationDenied::class.java)
            .hasMessageContaining("PRODUCTION_APPROVED")
    }

    @Test
    fun `denies commercial publication for public nuri type four`() {
        val kdcaTypeFour = approvedShape(ReleaseStatus.PRODUCTION_APPROVED, LicenseClass.PUBLIC_NURI_4, false)
        assertThatThrownBy { policy.requirePublicationAllowed(kdcaTypeFour) }
            .isInstanceOf(PublicationDenied::class.java)
            .hasMessageContaining("PUBLIC_NURI_4")
    }

    @Test
    fun `requires a review reference when third party rights are present`() {
        val unreviewed = approvedShape(
            ReleaseStatus.PRODUCTION_APPROVED, LicenseClass.PUBLIC_NURI_1, true,
        )
        assertThatThrownBy { policy.requirePublicationAllowed(unreviewed) }
            .isInstanceOf(PublicationDenied::class.java)
            .hasMessageContaining("approval reference")
        assertThatCode {
            policy.requirePublicationAllowed(unreviewed.copy(
                thirdPartyRightsApprovalRef = "test-rights-review-2026-08-09",
            ))
        }.doesNotThrowAnyException()
    }

    private fun approvedShape(status: ReleaseStatus, license: LicenseClass, thirdPartyRights: Boolean) =
        ConnectorDefinition(
            connectorId = ConnectorId("policy.fixture.v1"),
            agency = Agency.KDCA,
            datasetId = "15139178",
            canonicalUrl = URI("https://www.data.go.kr/data/15139178/openapi.do"),
            accessMethod = AccessMethod.OFFICIAL_OPEN_API,
            endpoint = URI("https://apis.data.go.kr/fixture/not-runtime"),
            authParameter = "serviceKey",
            secretRef = "DATA_GO_KR_SERVICE_KEY",
            format = SourceFormat.JSON,
            releaseStatus = status,
            licenseClass = license,
            thirdPartyRights = thirdPartyRights,
            thirdPartyRightsApprovalRef = null,
            licenseReviewedBy = "data-platform-owner",
            licenseReviewedAt = LocalDate.parse("2026-08-09"),
            attribution = "질병관리청",
            permittedUses = setOf("public_reference"),
            prohibitedUses = setOf("personalization"),
            allowedHosts = setOf("apis.data.go.kr"),
            freshnessPolicy = FreshnessPolicy(Duration.ofDays(1), Duration.ofDays(7)),
        )
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.ConnectorRegistryTest" --tests "*.PublicationPolicyTest"
```

Expected: compilation fails because `YamlConnectorRegistry`, `DefaultPublicationPolicy`, and registry types do not exist.

- [ ] **Step 3: Add the registry types, loader, and policy**

Implement the ledger types in `ConnectorDefinition.kt`. In `ConnectorRegistry.kt`, map the YAML through Jackson and validate every record before exposing it:

```kotlin
class YamlConnectorRegistry(resource: Resource) : ConnectorRegistry {
    private val values: Map<ConnectorId, ConnectorDefinition> =
        ObjectMapper(YAMLFactory()).registerKotlinModule()
            .readValue<ConnectorFile>(resource.inputStream)
            .connectors.map(::toDefinition)
            .onEach(::validate)
            .associateBy { it.connectorId }

    override fun get(connectorId: ConnectorId): ConnectorDefinition =
        values[connectorId] ?: throw UnknownConnector(connectorId.value)

    override fun all(): List<ConnectorDefinition> = values.values.sortedBy { it.connectorId.value }

    private fun validate(value: ConnectorDefinition) {
        require(value.accessMethod in setOf(AccessMethod.OFFICIAL_OPEN_API, AccessMethod.OFFICIAL_FILE))
        require(value.endpoint.scheme == "https")
        require(value.endpoint.host in value.allowedHosts)
        require(!value.endpoint.path.endsWith(".do")) { "Catalog HTML is not fetchable" }
        require(value.canonicalUrl.host == "www.data.go.kr")
        require(value.licenseReviewedBy.isNotBlank())
        require(value.attribution.isNotBlank())
    }
}
```

Implement `DefaultPublicationPolicy` in `PublicationPolicy.kt`:

```kotlin
class DefaultPublicationPolicy : PublicationPolicy {
    override fun requireAcquisitionAllowed(definition: ConnectorDefinition) {
        if (definition.releaseStatus == ReleaseStatus.DISABLED) {
            throw AcquisitionDenied("${definition.connectorId.value} is DISABLED")
        }
    }

    override fun requirePublicationAllowed(definition: ConnectorDefinition) {
        if (definition.releaseStatus != ReleaseStatus.PRODUCTION_APPROVED) {
            throw PublicationDenied("${definition.connectorId.value} must be PRODUCTION_APPROVED")
        }
        if (definition.licenseClass in setOf(
                LicenseClass.PUBLIC_NURI_2,
                LicenseClass.PUBLIC_NURI_3,
                LicenseClass.PUBLIC_NURI_4,
            )
        ) {
            throw PublicationDenied("${definition.licenseClass} is not commercially publishable")
        }
        if (definition.thirdPartyRights && definition.thirdPartyRightsApprovalRef.isNullOrBlank()) {
            throw PublicationDenied("third-party rights require a recorded approval reference")
        }
    }
}

class AcquisitionDenied(message: String) : IllegalStateException(message)
class PublicationDenied(message: String) : IllegalStateException(message)
class UnknownConnector(value: String) : NoSuchElementException(value)
```

- [ ] **Step 4: Add the exact governed connector records**

Create `public-connectors.yml`:

```yaml
connectors:
  - connectorId: hira.hospital-directory.v1
    agency: HIRA
    datasetId: "15001698"
    canonicalUrl: https://www.data.go.kr/data/15001698/openapi.do
    accessMethod: OFFICIAL_OPEN_API
    endpoint: https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList
    authParameter: ServiceKey
    secretRef: DATA_GO_KR_SERVICE_KEY
    format: XML
    releaseStatus: DEVELOPMENT_ONLY
    licenseClass: PUBLIC_NURI_1
    thirdPartyRights: true
    thirdPartyRightsApprovalRef: null
    licenseReviewedBy: data-platform-owner
    licenseReviewedAt: 2026-08-09
    attribution: "출처: 건강보험심사평가원 병원정보서비스"
    permittedUses: [provider_directory, source_attributed_comparison]
    prohibitedUses: [patient_identity_linkage, live_capacity_guarantee, paid_referral_ranking]
    allowedHosts: [apis.data.go.kr]
    freshFor: PT36H
    serveStaleFor: P7D
  - connectorId: hira.non-covered-price.v1
    agency: HIRA
    datasetId: "15001700"
    canonicalUrl: https://www.data.go.kr/data/15001700/openapi.do
    accessMethod: OFFICIAL_OPEN_API
    endpoint: https://apis.data.go.kr/B551182/nonPaymentDamtInfoService/getNonPaymentItemHospDtlList
    authParameter: ServiceKey
    secretRef: DATA_GO_KR_SERVICE_KEY
    format: XML
    releaseStatus: DEVELOPMENT_ONLY
    licenseClass: PUBLIC_NURI_1
    thirdPartyRights: true
    thirdPartyRightsApprovalRef: null
    licenseReviewedBy: data-platform-owner
    licenseReviewedAt: 2026-08-09
    attribution: "출처: 건강보험심사평가원 비급여진료비정보조회서비스"
    permittedUses: [non_covered_price_reference, source_attributed_comparison]
    prohibitedUses: [price_quote, final_bill_claim, provider_quality_ranking, paid_referral_ranking]
    allowedHosts: [apis.data.go.kr]
    freshFor: PT24H
    serveStaleFor: P7D
  - connectorId: kdca.vaccination-condition-codes.v1
    agency: KDCA
    datasetId: "15084296"
    canonicalUrl: https://www.data.go.kr/data/15084296/openapi.do
    accessMethod: OFFICIAL_OPEN_API
    endpoint: https://apis.data.go.kr/1790387/vcninfo/getCondVcnCd
    authParameter: ServiceKey
    secretRef: DATA_GO_KR_SERVICE_KEY
    format: XML
    releaseStatus: PRODUCTION_APPROVED
    licenseClass: UNRESTRICTED
    thirdPartyRights: false
    thirdPartyRightsApprovalRef: not-applicable
    licenseReviewedBy: data-platform-owner
    licenseReviewedAt: 2026-08-09
    attribution: "출처: 질병관리청 예방접종 대상 감염병 정보"
    permittedUses: [public_reference]
    prohibitedUses: [personalized_vaccination_advice, diagnosis]
    allowedHosts: [apis.data.go.kr]
    freshFor: P35D
    serveStaleFor: P90D
  - connectorId: mohw.facility-counts.v1
    agency: MOHW
    datasetId: "15098823"
    canonicalUrl: https://www.data.go.kr/data/15098823/openapi.do
    accessMethod: OFFICIAL_OPEN_API
    endpoint: https://apis.data.go.kr/1352000/ODMS_STAT_14/callStat14Api
    authParameter: serviceKey
    secretRef: DATA_GO_KR_SERVICE_KEY
    format: JSON
    releaseStatus: PRODUCTION_APPROVED
    licenseClass: UNRESTRICTED
    thirdPartyRights: false
    thirdPartyRightsApprovalRef: not-applicable
    licenseReviewedBy: data-platform-owner
    licenseReviewedAt: 2026-08-09
    attribution: "출처: 보건복지부 보건·복지현황 병원 및 의원 수"
    permittedUses: [regional_context]
    prohibitedUses: [current_capacity_claim, provider_quality_ranking]
    allowedHosts: [apis.data.go.kr]
    freshFor: P400D
    serveStaleFor: P550D
```

The YAML loader converts `freshFor` and `serveStaleFor` to `Duration` and rejects duplicate connector IDs.

- [ ] **Step 5: Run the registry and policy tests**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.ConnectorRegistryTest" --tests "*.PublicationPolicyTest"
```

Expected: `BUILD SUCCESSFUL`; the registry contains exactly four runtime connectors. Both HIRA acquisitions are allowed for fixture/development validation but both HIRA publications are denied independently; MOHW/KDCA publication is allowed; third-party rights require a connector-specific approval reference; Type 4 publication is denied.

- [ ] **Step 6: Commit connector governance**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/registry apps/core-api/src/main/resources/connectors apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/registry
git commit -m "feat(pub): govern official public connectors"
```

---

### Task 3: Create immutable bronze storage and append-only provenance tables

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/ProvenanceModels.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/Digests.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/ImmutablePayloadStore.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/S3ImmutablePayloadStore.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/PublicDataRepositories.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/JdbcPublicDataRepositories.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config/PublicDataPersistenceConfiguration.kt`
- Create: `apps/core-api/src/main/resources/db/publicdata-migration/V100__public_reference_schema.sql`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/provenance/ImmutableProvenanceIntegrationTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/SourceTestFixtures.kt`
- Create: `apps/core-api/src/test/resources/application-publicdata-test.yml`

**Interfaces:**
- Consumes: `ConnectorId`; FND's PostgreSQL 16.10/Flyway library pins but not its datasource or migration location; PUB-only S3 dependencies from Task 1; FND migration allocation `V1`-`V19` left untouched.
- Produces: `BronzeSnapshot`, `StoredPayload`, `ImmutablePayloadStore.put/read`; append-only repository ports for bronze, silver, gold, manifest, quarantine, source-state, recall, and active publication.

- [ ] **Step 1: Write the failing immutability integration test**

Create `ImmutableProvenanceIntegrationTest.kt` using a PostgreSQL Testcontainer and LocalStack S3 Testcontainer. The decisive assertions are:

```kotlin
@Testcontainers
@SpringBootTest(
    classes = [PublicDataApplication::class],
    properties = ["spring.config.name=application-publicdata"],
)
@ActiveProfiles("publicdata", "test")
class ImmutableProvenanceIntegrationTest(
    @Autowired private val store: ImmutablePayloadStore,
    @Autowired private val jdbc: JdbcTemplate,
) {
    @Test
    fun `same bytes are content addressed and never overwritten`() {
        val payload = acquired("<response><value>public</value></response>")
        val first = store.put(payload)
        val second = store.put(payload)

        assertThat(second.snapshot.objectKey).isEqualTo(first.snapshot.objectKey)
        assertThat(second.snapshot.sha256).isEqualTo(first.snapshot.sha256)
        assertThat(store.read(first.snapshot)).isEqualTo(payload.bytes)
    }

    @Test
    fun `bronze silver gold and event rows reject update and delete`() {
        val snapshot = store.put(acquired("<response/>"))

        assertThatThrownBy {
            jdbc.update(
                "update public_reference.bronze_snapshot set content_type='text/plain' where snapshot_id=?",
                snapshot.snapshot.snapshotId,
            )
        }.hasMessageContaining("append-only")

        assertThatThrownBy {
            jdbc.update(
                "delete from public_reference.bronze_snapshot where snapshot_id=?",
                snapshot.snapshot.snapshotId,
            )
        }.hasMessageContaining("append-only")
    }

    @Test
    fun `public schema has no personal identity columns`() {
        val columns = jdbc.queryForList(
            "select column_name from information_schema.columns where table_schema='public_reference'",
            String::class.java,
        )
        assertThat(columns).doesNotContain(
            "user_id", "patient_id", "subject_id", "consent_id", "resident_registration_number",
            "email", "phone_number", "document_id", "health_record_id", "genome_id",
        )
    }
}
```

Use a helper that returns an `AcquiredPayload` with connector `mohw.facility-counts.v1`, official source URI, redacted request fingerprint, XML content type, fixed `2026-08-09T00:00:00Z`, and the supplied bytes.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.ImmutableProvenanceIntegrationTest"
```

Expected: compilation fails because `ImmutablePayloadStore` and provenance models do not exist.

- [ ] **Step 3: Create the isolated append-only database schema**

Implement `V100__public_reference_schema.sql`, the first migration in PUB's exclusive `V100`-`V119` allocation. The migration creates only `public_reference` objects and includes this mutation guard:

```sql
create schema public_reference;

create function public_reference.reject_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'append-only relation % cannot be updated or deleted', tg_table_name;
end;
$$;

create table public_reference.bronze_snapshot (
  snapshot_id uuid primary key,
  connector_id text not null,
  object_key text not null unique,
  sha256 char(64) not null,
  request_fingerprint char(64) not null,
  content_type text not null,
  response_headers jsonb not null,
  retrieved_at timestamptz not null,
  data_class text not null default 'C0_PUBLIC' check (data_class = 'C0_PUBLIC'),
  unique (connector_id, sha256)
);

create table public_reference.silver_record_version (
  silver_id uuid primary key,
  connector_id text not null,
  source_key_hash char(64) not null,
  bronze_snapshot_id uuid not null references public_reference.bronze_snapshot(snapshot_id),
  original_json jsonb not null,
  normalized_json jsonb not null,
  source_published_at timestamptz,
  retrieved_at timestamptz not null,
  schema_hash char(64) not null,
  transform_version text not null,
  created_at timestamptz not null,
  data_class text not null default 'C0_PUBLIC' check (data_class = 'C0_PUBLIC')
);

create table public_reference.gold_fact_version (
  fact_id text primary key,
  connector_id text not null,
  subject_type text not null,
  source_key_hash char(64) not null,
  source_json jsonb not null,
  original_json jsonb not null,
  normalized_json jsonb not null,
  comparability text not null,
  caveats_json jsonb not null,
  transform_version text not null,
  schema_hash char(64) not null,
  created_at timestamptz not null,
  data_class text not null default 'C0_PUBLIC' check (data_class = 'C0_PUBLIC')
);

create table public_reference.publication_manifest (
  publication_id uuid primary key,
  connector_id text not null,
  fact_ids_json jsonb not null,
  created_at timestamptz not null,
  digest char(64) not null,
  signature text not null,
  signing_key_id text not null,
  unique (connector_id, digest)
);

create table public_reference.publication_pointer_event (
  event_id uuid primary key,
  connector_id text not null,
  from_publication_id uuid,
  to_publication_id uuid,
  reason text not null,
  occurred_at timestamptz not null
);

create table public_reference.active_publication (
  connector_id text primary key,
  publication_id uuid not null references public_reference.publication_manifest(publication_id),
  updated_at timestamptz not null
);

create table public_reference.quarantine_event (
  event_id uuid primary key,
  connector_id text not null,
  snapshot_id uuid not null references public_reference.bronze_snapshot(snapshot_id),
  schema_hash char(64) not null,
  reasons_json jsonb not null,
  occurred_at timestamptz not null
);

create table public_reference.source_state_event (
  event_id uuid primary key,
  connector_id text not null,
  status text not null,
  source_as_of timestamptz,
  retrieved_at timestamptz,
  notice_ko text not null,
  occurred_at timestamptz not null
);

create table public_reference.recall_event (
  event_id uuid primary key,
  connector_id text not null,
  publication_id uuid not null references public_reference.publication_manifest(publication_id),
  reason_code text not null,
  reason_ko text not null,
  requested_by text not null,
  effective_at timestamptz not null,
  occurred_at timestamptz not null
);

do $$
declare relation_name text;
begin
  foreach relation_name in array array[
    'bronze_snapshot', 'silver_record_version', 'gold_fact_version',
    'publication_manifest', 'publication_pointer_event', 'quarantine_event',
    'source_state_event', 'recall_event'
  ] loop
    execute format(
      'create trigger %I_append_only before update or delete on public_reference.%I for each row execute function public_reference.reject_mutation()',
      relation_name,
      relation_name
    );
  end loop;
end;
$$;
```

Only `active_publication` is mutable. `JdbcPublicDataRepositories.switchActivePublication` must insert `publication_pointer_event` and upsert `active_publication` in the same transaction.

Create `application-publicdata-test.yml`; it is loaded only as the `test` profile of config name `application-publicdata`. FND's `application-test.yml` remains untouched and is intentionally not loaded by the isolated C0 context:

```yaml
public-data:
  connector-registry: classpath:connectors/public-connectors.yml
  bronze-bucket: synthetic-public-bronze
  manifest-signing-key-id: synthetic-test-ed25519
  scheduling-enabled: false
  datasource:
    jdbc-url: jdbc:postgresql://127.0.0.1:1/synthetic_overridden_by_testcontainers
    username: synthetic
    password: synthetic
```

The test class registers its Testcontainers JDBC URL, username, password, and LocalStack endpoint dynamically. No static password, government service key, or production bucket name is placed in either test configuration file.

Create `PublicDataPersistenceConfiguration.kt` with validated `public-data.datasource.jdbc-url`, `username`, and `password` properties and these named beans:

```kotlin
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(PublicDataDataSourceProperties::class)
class PublicDataPersistenceConfiguration {
    @Bean("publicDataSource")
    fun publicDataSource(properties: PublicDataDataSourceProperties): DataSource =
        HikariDataSource(HikariConfig().apply {
            jdbcUrl = properties.jdbcUrl
            username = properties.username
            password = properties.password
            poolName = "public-reference"
            maximumPoolSize = 8
            isReadOnly = false
        })

    @Bean("publicDataFlyway", initMethod = "migrate")
    fun publicDataFlyway(@Qualifier("publicDataSource") dataSource: DataSource): Flyway =
        Flyway.configure()
            .dataSource(dataSource)
            .schemas("public")
            .defaultSchema("public")
            .locations("classpath:db/publicdata-migration")
            .table("flyway_schema_history_pub")
            .load()

    @Bean("publicDataJdbcTemplate")
    fun publicDataJdbcTemplate(
        @Qualifier("publicDataSource") dataSource: DataSource,
    ) = JdbcTemplate(dataSource)

    @Bean("publicDataNamedJdbcTemplate")
    fun publicDataNamedJdbcTemplate(
        @Qualifier("publicDataSource") dataSource: DataSource,
    ) = NamedParameterJdbcTemplate(dataSource)
}

@ConfigurationProperties("public-data.datasource")
@Validated
data class PublicDataDataSourceProperties(
    @field:NotBlank val jdbcUrl: String,
    @field:NotBlank val username: String,
    @field:NotBlank val password: String,
)
```

Every PUB JDBC repository injects `@Qualifier("publicDataNamedJdbcTemplate")`; tests that need scalar SQL inject `@Qualifier("publicDataJdbcTemplate")`. No PUB class injects FND's primary datasource/template. Auto Flyway is excluded only from `PublicDataApplication`; FND's `CoreApiApplication` and migrations are unchanged.

- [ ] **Step 4: Implement content-addressed bronze storage**

Implement the ledger models in `ProvenanceModels.kt`, repository ports in `PublicDataRepositories.kt`, and JDBC inserts/read queries in `JdbcPublicDataRepositories.kt`. Implement `S3ImmutablePayloadStore.put` with a deterministic key and S3 conditional create:

```kotlin
class S3ImmutablePayloadStore(
    private val s3: S3Client,
    private val bucket: String,
    private val bronzeRepository: BronzeRepository,
    private val clock: Clock,
) : ImmutablePayloadStore {
    override fun put(payload: AcquiredPayload): StoredPayload {
        val hash = sha256Hex(payload.bytes)
        val key = "bronze/${payload.connectorId.value}/${payload.retrievedAt.atZone(ZoneOffset.UTC).toLocalDate()}/$hash"
        try {
            s3.putObject(
                PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(payload.contentType)
                    .ifNoneMatch("*")
                    .metadata(mapOf("sha256" to hash, "data-class" to "C0_PUBLIC"))
                    .build(),
                RequestBody.fromBytes(payload.bytes),
            )
        } catch (exception: S3Exception) {
            if (exception.statusCode() != 412) throw exception
        }
        val snapshot = bronzeRepository.insertOrFind(
            BronzeSnapshot(
                UUID.randomUUID(), payload.connectorId, key, hash, payload.requestFingerprint,
                payload.contentType, payload.responseHeaders, payload.retrievedAt,
            ),
        )
        return StoredPayload(snapshot, payload.bytes.copyOf())
    }

    override fun read(snapshot: BronzeSnapshot): ByteArray =
        s3.getObjectAsBytes { it.bucket(bucket).key(snapshot.objectKey) }.asByteArray()
}
```

Create `Digests.kt` with `fun sha256Hex(bytes: ByteArray): String` and `fun sha256Hex(text: String): String = sha256Hex(text.toByteArray(StandardCharsets.UTF_8))`; the byte implementation uses `MessageDigest.getInstance("SHA-256")` and `HexFormat.of().formatHex(...)` for lower-case hexadecimal. `insertOrFind` returns the existing row for the same connector/checksum, so a repeated response is idempotent without mutating provenance.

Create `SourceTestFixtures.kt` with top-level functions `acquired(body: String)`, `acquiredPayload(contentType: String, body: String)`, and `stored(payload: AcquiredPayload)`. Every test snippet using those names imports `kr.co.genomecompanion.publicdata.support.*`. Values are fixed to connector `mohw.facility-counts.v1`, source URI `https://apis.data.go.kr/synthetic`, a 64-character synthetic request fingerprint, retrieval `2026-08-09T00:00:00Z`, allowlisted empty headers, and UTF-8 bytes. Later tasks extend this same file only with the exact source helpers named in their file list.

- [ ] **Step 5: Run the migration and immutability tests**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.ImmutableProvenanceIntegrationTest"
```

Expected: `BUILD SUCCESSFUL`; three tests pass; attempted update/delete operations fail with the trigger’s `append-only` message.

- [ ] **Step 6: Commit immutable provenance**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config/PublicDataPersistenceConfiguration.kt apps/core-api/src/main/resources/db/publicdata-migration/V100__public_reference_schema.sql apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/provenance apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/SourceTestFixtures.kt apps/core-api/src/test/resources/application-publicdata-test.yml
git commit -m "feat(pub): add immutable public provenance storage"
```

---

### Task 4: Build the official-source transport and acquire-before-parse boundary

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/acquire/OfficialSourceTransport.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/acquire/DataGoKrTransport.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/acquire/SecretsManagerSecretResolver.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/acquire/AcquisitionCoordinator.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/SecureXml.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/acquire/DataGoKrTransportTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/acquire/SecretsManagerSecretResolverTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/acquire/AcquisitionCoordinatorTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/SecureXmlTest.kt`
- Modify: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/SourceTestFixtures.kt`
- Create: `apps/core-api/src/test/resources/fixtures/kdca/vaccination-condition-codes-doctype.xml`

**Interfaces:**
- Consumes: `ConnectorDefinition`, `PublicationPolicy.requireAcquisitionAllowed`, and `ImmutablePayloadStore.put`.
- Produces: `OfficialApiRequest`, `AcquiredPayload`, `SecretResolver`, C0-only `SecretsManagerSecretResolver`, `OfficialSourceTransport.get`, `AcquisitionCoordinator.acquire`, and `SecureXml.parse`.

- [ ] **Step 1: Write failing tests for host, HTML, secret, and bronze controls**

Create `DataGoKrTransportTest.kt` around a `RestClient.Builder` bound to `MockRestServiceServer`:

```kotlin
class DataGoKrTransportTest {
    private val builder = RestClient.builder()
    private val server = MockRestServiceServer.bindTo(builder).build()
    private val secrets = SecretResolver { reference ->
        require(reference == "DATA_GO_KR_SERVICE_KEY")
        "encoded-government-key"
    }
    private val transport = DataGoKrTransport(builder, secrets, Clock.fixed(
        Instant.parse("2026-08-09T00:00:00Z"), ZoneOffset.UTC,
    ))

    @Test
    fun `adds the key for the official host but redacts it from provenance`() {
        val definition = fixtureDefinition(URI("https://apis.data.go.kr/fixture/items"))
        server.expect(requestTo("https://apis.data.go.kr/fixture/items?pageNo=1&serviceKey=encoded-government-key"))
            .andRespond(withSuccess("{\"response\":{}}", MediaType.APPLICATION_JSON))

        val result = transport.get(definition, OfficialApiRequest(
            definition.connectorId, definition.endpoint, mapOf("pageNo" to "1"), SourceFormat.JSON,
        ))

        assertThat(result.requestFingerprint).matches("[0-9a-f]{64}")
        assertThat(result.requestFingerprint).doesNotContain("encoded-government-key")
        assertThat(result.sourceUri.rawQuery).isNull()
        server.verify()
    }

    @Test
    fun `rejects catalog html instead of parsing or storing it`() {
        val definition = fixtureDefinition(URI("https://apis.data.go.kr/fixture/items"))
        server.expect(requestTo("https://apis.data.go.kr/fixture/items?serviceKey=encoded-government-key"))
            .andRespond(withSuccess("<html><body>catalog</body></html>", MediaType.TEXT_HTML))

        assertThatThrownBy {
            transport.get(definition, OfficialApiRequest(
                definition.connectorId, definition.endpoint, emptyMap(), SourceFormat.XML,
            ))
        }.isInstanceOf(UnexpectedSourceContent::class.java)
            .hasMessage("official source returned disallowed content type text/html")
    }

    @Test
    fun `rejects a request host not registered on the connector`() {
        val definition = fixtureDefinition(URI("https://apis.data.go.kr/fixture/items"))
        val request = OfficialApiRequest(
            definition.connectorId, URI("https://example.org/scrape"), emptyMap(), SourceFormat.XML,
        )
        assertThatThrownBy { transport.get(definition, request) }
            .isInstanceOf(OfficialEndpointViolation::class.java)
    }

    @Test
    fun `rejects declared and chunked bodies above 32 MiB before returning acquired bytes`() {
        val definition = fixtureDefinition(URI("https://apis.data.go.kr/fixture/items"))
        server.expect(requestTo("https://apis.data.go.kr/fixture/items?serviceKey=encoded-government-key"))
            .andRespond(withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_XML)
                .header(HttpHeaders.CONTENT_LENGTH, "33554433")
                .body(ByteArray(0)))
        val request = OfficialApiRequest(
            definition.connectorId, definition.endpoint, emptyMap(), SourceFormat.XML,
        )
        assertThatThrownBy { transport.get(definition, request) }
            .isInstanceOf(SourcePayloadTooLarge::class.java)

        val chunked = boundedChunkedResponse(totalBytes = 33_554_433)
        server.expect(requestTo("https://apis.data.go.kr/fixture/items?serviceKey=encoded-government-key"))
            .andRespond(chunked.responseCreator)
        assertThatThrownBy { transport.get(definition, request) }
            .isInstanceOf(SourcePayloadTooLarge::class.java)
        assertThat(chunked.bytesRead).isLessThanOrEqualTo(33_619_968)
    }
}
```

Create `AcquisitionCoordinatorTest.kt`:

```kotlin
class AcquisitionCoordinatorTest {
    @Test
    fun `persists bronze before returning bytes to an adapter`() {
        val calls = mutableListOf<String>()
        val transport = OfficialSourceTransport { _, _ ->
            calls += "fetch"
            acquiredPayload("application/xml", "<response/>")
        }
        val store = object : ImmutablePayloadStore {
            override fun put(payload: AcquiredPayload): StoredPayload {
                calls += "bronze"
                return stored(payload)
            }
            override fun read(snapshot: BronzeSnapshot): ByteArray = error("not used")
        }
        val coordinator = DefaultAcquisitionCoordinator(
            DefaultPublicationPolicy(), transport, store,
        )

        coordinator.acquire(productionFixture(), requestFixture())

        assertThat(calls).containsExactly("fetch", "bronze")
    }
}
```

Create `SecretsManagerSecretResolverTest.kt` with a mock `SecretsManagerClient`: resolving exactly `DATA_GO_KR_SERVICE_KEY` calls `getSecretValue` with the configured C0 secret ID and returns its `secretString`; any other symbolic reference fails before an AWS call; an empty/binary response fails closed; captured logs never contain the returned value or secret ID.

Create `SecureXmlTest.kt` with one ordinary XML parse assertion and one assertion that `fixtures/kdca/vaccination-condition-codes-doctype.xml` raises `UnsafeXmlDocument` before any external entity is resolved.

Extend `SourceTestFixtures.kt` with the exact top-level helpers used above: `fixtureDefinition(endpoint: URI)`, `productionFixture()`, and `requestFixture()` return complete immutable Task 2/ledger objects; `storedFixture(classpath: String)` loads UTF-8 bytes through `ClassPathResource` and delegates to `stored`; `registry()` loads only `connectors/public-connectors.yml`; and `loadContract(name: String)` delegates to the production `SchemaContractLoader` under `classpath:schemas/$name`. It also defines `boundedChunkedResponse(totalBytes: Long)` as a `MockRestResponseCreators.withSuccess()` response whose `InputStream` emits deterministic 64-KiB chunks, reports no content length, retains no full-body byte array, and records close; a sibling false-small response advertises one byte while emitting the requested count. Tests never construct a partial connector or use a network resource.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.DataGoKrTransportTest" --tests "*.SecretsManagerSecretResolverTest" --tests "*.AcquisitionCoordinatorTest" --tests "*.SecureXmlTest"
```

Expected: compilation fails because the acquisition and secure XML types are absent.

- [ ] **Step 3: Implement the official transport with a fetchable-URI allowlist**

Create the ledger request/response interfaces in `OfficialSourceTransport.kt`. Implement `DataGoKrTransport` so it compares `request.uri` to `definition.endpoint`, validates HTTPS and the allowed host, adds the secret only while building the outbound request, and preserves only allowlisted response headers:

```kotlin
class DataGoKrTransport(
    builder: RestClient.Builder,
    private val secretResolver: SecretResolver,
    private val clock: Clock,
) : OfficialSourceTransport {
    private companion object {
        const val MAX_SOURCE_BYTES: Long = 33_554_432
        const val COPY_BUFFER_BYTES = 65_536
    }
    private val client = builder.build()
    private val allowedMedia = setOf(
        MediaType.APPLICATION_JSON_VALUE,
        MediaType.APPLICATION_XML_VALUE,
        MediaType.TEXT_XML_VALUE,
        "application/octet-stream",
        "text/csv",
        "application/zip",
    )

    override fun get(definition: ConnectorDefinition, request: OfficialApiRequest): AcquiredPayload {
        requireOfficialEndpoint(definition, request)
        val secret = secretResolver.resolve(definition.secretRef)
        val outbound = UriComponentsBuilder.fromUri(request.uri)
            .apply { request.query.toSortedMap().forEach { (key, value) -> queryParam(key, value) } }
            .queryParam(definition.authParameter, secret)
            .build(true).toUri()
        val response = client.get().uri(outbound).exchange { _, raw ->
            val media = raw.headers.contentType?.toString()?.substringBefore(';')
                ?: throw UnexpectedSourceContent("official source omitted content type")
            if (media !in allowedMedia || media == MediaType.TEXT_HTML_VALUE) {
                throw UnexpectedSourceContent("official source returned disallowed content type $media")
            }
            val contentLengthValues = raw.headers[HttpHeaders.CONTENT_LENGTH].orEmpty()
            val advertisedLength = when {
                contentLengthValues.isEmpty() -> null
                contentLengthValues.size != 1 -> throw InvalidSourceContentLength()
                !Regex("^(?:0|[1-9][0-9]{0,10})$").matches(contentLengthValues.single()) ->
                    throw InvalidSourceContentLength()
                else -> contentLengthValues.single().toLong()
            }
            if (advertisedLength != null && advertisedLength > MAX_SOURCE_BYTES) {
                throw SourcePayloadTooLarge()
            }
            val bytes = raw.body.use { input ->
                val output = ByteArrayOutputStream(
                    advertisedLength?.toInt()?.coerceAtMost(COPY_BUFFER_BYTES) ?: COPY_BUFFER_BYTES,
                )
                val buffer = ByteArray(COPY_BUFFER_BYTES)
                var total = 0L
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    total += read
                    if (total > MAX_SOURCE_BYTES) throw SourcePayloadTooLarge()
                    output.write(buffer, 0, read)
                }
                output.toByteArray()
            }
            val headers = mapOf(
                "etag" to raw.headers.getFirst(HttpHeaders.ETAG),
                "last-modified" to raw.headers.getFirst(HttpHeaders.LAST_MODIFIED),
                "content-length" to raw.headers.getFirst(HttpHeaders.CONTENT_LENGTH),
            ).filterValues(Objects::nonNull).mapValues { it.value!! }
            Triple(media, bytes, headers)
        }
        val fingerprintInput = buildString {
            append(definition.connectorId.value).append('|').append(request.uri)
            request.query.toSortedMap().forEach { (key, value) -> append('|').append(key).append('=').append(value) }
        }.toByteArray(StandardCharsets.UTF_8)
        return AcquiredPayload(
            request.connectorId,
            request.uri,
            sha256Hex(fingerprintInput),
            response.first,
            response.second,
            clock.instant(),
            response.third,
        )
    }

    private fun requireOfficialEndpoint(definition: ConnectorDefinition, request: OfficialApiRequest) {
        if (request.uri != definition.endpoint || request.uri.scheme != "https" ||
            request.uri.host !in definition.allowedHosts || request.uri.path.endsWith(".do")) {
            throw OfficialEndpointViolation(definition.connectorId.value)
        }
    }
}
```

`SourcePayloadTooLarge` has the fixed content-free message `official source payload exceeds 33554432 bytes`; `InvalidSourceContentLength` has the fixed message `official source returned invalid content length`. The response stream closes on every exit. A missing or chunked `Content-Length` is permitted only through the same counted copy; a negative, malformed, conflicting, or declared-over-cap length fails before body allocation. Retry creates a fresh counter and never joins partial bodies. Tests cover exactly 33,554,432 bytes, 33,554,433 bytes, a false-small declared length followed by chunked overflow, zero-byte reads, mid-stream failure, and secret-free exception/log capture.

Configure connect timeout 5 seconds, read timeout 20 seconds, at most three attempts for HTTP 429/502/503/504, exponential delays of 250 ms and 500 ms plus injected bounded jitter, and no retry for authentication, schema, content-type, or other 4xx errors. Inject `Sleeper` and `JitterSource` so tests do not wait.

Create `SecretsManagerSecretResolver.kt`:

```kotlin
class SecretsManagerSecretResolver(
    private val client: SecretsManagerClient,
    private val dataGoKrSecret: VersionQualifiedSecretRef,
) : SecretResolver {
    override fun resolve(secretRef: String): String {
        if (secretRef != "DATA_GO_KR_SERVICE_KEY") throw UnknownSecretReference(secretRef)
        val response = client.getSecretValue {
            it.secretId(dataGoKrSecret.secretArn).versionId(dataGoKrSecret.versionId)
        }
        if (response.versionId() != dataGoKrSecret.versionId) throw SecretVersionMismatch()
        val value = response.secretString()
        if (value.isNullOrBlank()) throw MissingSecretValue("DATA_GO_KR_SERVICE_KEY")
        if (value.toByteArray(Charsets.UTF_8).size > 16_384) throw SecretValueTooLarge()
        return value
    }
}
```

`VersionQualifiedSecretRef.parse` accepts only the canonical `secret-arn#versionId=<VersionId>` value from `PUBLIC_DATA_GO_KR_SECRET_ID`, rejects a stage/bare name/bare ARN/duplicate delimiter/control/empty part, and never logs either coordinate. This class has no logger and no cache. The C0 IAM policy grants only exact-VersionId `secretsmanager:GetSecretValue` on the parsed secret ARN plus its context-bound decrypt; tests assert the request contains that VersionId, cap the response before any secondary copy/parse, and reject a mismatched response VersionId. No browser/client response includes the symbolic reference, ARN, VersionId, or value.

- [ ] **Step 4: Implement acquire-before-parse and XXE-safe XML**

Create `DefaultAcquisitionCoordinator`:

```kotlin
class DefaultAcquisitionCoordinator(
    private val publicationPolicy: PublicationPolicy,
    private val transport: OfficialSourceTransport,
    private val payloadStore: ImmutablePayloadStore,
) : AcquisitionCoordinator {
    override fun acquire(
        definition: ConnectorDefinition,
        request: OfficialApiRequest,
    ): StoredPayload {
        publicationPolicy.requireAcquisitionAllowed(definition)
        val acquired = transport.get(definition, request)
        return payloadStore.put(acquired)
    }
}
```

Create `SecureXml` with all external entity and DTD features disabled:

```kotlin
object SecureXml {
    fun parse(bytes: ByteArray): Document = try {
        val factory = DocumentBuilderFactory.newInstance().apply {
            setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
            setFeature("http://xml.org/sax/features/external-general-entities", false)
            setFeature("http://xml.org/sax/features/external-parameter-entities", false)
            setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false)
            isXIncludeAware = false
            isExpandEntityReferences = false
        }
        factory.newDocumentBuilder().parse(ByteArrayInputStream(bytes))
    } catch (exception: Exception) {
        throw UnsafeXmlDocument(exception)
    }
}
```

- [ ] **Step 5: Run acquisition and security tests**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.DataGoKrTransportTest" --tests "*.SecretsManagerSecretResolverTest" --tests "*.AcquisitionCoordinatorTest" --tests "*.SecureXmlTest"
```

Expected: `BUILD SUCCESSFUL`; the allowed official request succeeds, HTML/off-host requests fail, fingerprints omit the key, bronze occurs before parse, and the DTD fixture is rejected.

- [ ] **Step 6: Commit the official acquisition boundary**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/acquire apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/SecureXml.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/acquire apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/SecureXmlTest.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/SourceTestFixtures.kt apps/core-api/src/test/resources/fixtures/kdca/vaccination-condition-codes-doctype.xml
git commit -m "feat(pub): acquire only from governed official endpoints"
```

---

### Task 5: Implement source-faithful HIRA directory and non-covered-price adapters

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/SourceAdapter.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/SourceParsing.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/validation/SchemaContractLoader.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraHospitalDirectoryAdapter.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraNonCoveredPriceAdapter.kt`
- Create: `apps/core-api/src/main/resources/schemas/hira-hospital-directory-v1.json`
- Create: `apps/core-api/src/main/resources/schemas/hira-non-covered-price-v1.json`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraHospitalDirectoryAdapterTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraHospitalDirectoryLiveSmokeTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraNonCoveredPriceAdapterTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/HiraNonCoveredPriceLiveSmokeTest.kt`
- Create: `apps/core-api/src/test/resources/fixtures/hira/hospital-page-1.xml`
- Create: `apps/core-api/src/test/resources/fixtures/hira/hospital-page-2.xml`
- Create: `apps/core-api/src/test/resources/fixtures/hira/non-covered-price-page.xml`
- Create: `apps/core-api/src/test/resources/fixtures/hira/non-covered-price-invalid-amount.xml`

**Interfaces:**
- Consumes: `ConnectorRegistry.get`, `OfficialApiRequest`, `StoredPayload`, `SecureXml.parse`, and `HiraProviderKeyCatalog` populated only from an approved, signed, non-recalled HIRA directory publication.
- Produces: generic `SourceRecord`, `ParsedPage<R>`, and fan-out-capable `SourceAdapter<R>` from the interface ledger; `HiraProviderRecord`; `HiraNonCoveredPriceRecord`; directory and non-covered-price adapters; no public `ykiho`.

- [ ] **Step 1: Add the synthetic official-shape fixtures and failing adapter test**

Create `hospital-page-1.xml` with two synthetic providers and official field names:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
  <body>
    <items>
      <item>
        <ykiho>ENC_SYNTHETIC_A</ykiho><yadmNm>가나다 종합병원</yadmNm>
        <addr>서울특별시 중구 예시로 1</addr><telno>02-0000-0001</telno>
        <sidoCd>110000</sidoCd><sidoCdNm>서울</sidoCdNm>
        <sgguCd>110010</sgguCd><sgguCdNm>중구</sgguCdNm>
        <clCd>11</clCd><clCdNm>종합병원</clCdNm><estbDd>20000101</estbDd>
        <XPos>126.9780</XPos><YPos>37.5665</YPos>
      </item>
      <item>
        <ykiho>ENC_SYNTHETIC_B</ykiho><yadmNm>나라마 의원</yadmNm>
        <addr>서울특별시 중구 예시로 2</addr><telno>02-0000-0002</telno>
        <sidoCd>110000</sidoCd><sidoCdNm>서울</sidoCdNm>
        <sgguCd>110010</sgguCd><sgguCdNm>중구</sgguCdNm>
        <clCd>31</clCd><clCdNm>의원</clCdNm><estbDd>20100101</estbDd>
        <XPos>126.9781</XPos><YPos>37.5666</YPos>
      </item>
    </items>
    <numOfRows>2</numOfRows><pageNo>1</pageNo><totalCount>3</totalCount>
  </body>
</response>
```

Create `hospital-page-2.xml` with one provider, `pageNo` 2, `numOfRows` 2, and `totalCount` 3.

Create `HiraHospitalDirectoryAdapterTest.kt`:

```kotlin
class HiraHospitalDirectoryAdapterTest {
    private val adapter = HiraHospitalDirectoryAdapter(loadContract("hira-hospital-directory-v1.json"))
    private val definition = registry().get(ConnectorId("hira.hospital-directory.v1"))

    @Test
    fun `requests only the registered HIRA endpoint and parses source faithfully`() {
        val request = adapter.initialRequests(definition).single()
        assertThat(request.uri).isEqualTo(definition.endpoint)
        assertThat(request.query).containsEntry("pageNo", "1").containsEntry("numOfRows", "100")

        val page = adapter.parse(storedFixture("fixtures/hira/hospital-page-1.xml"))
        assertThat(page.totalCount).isEqualTo(3)
        assertThat(page.records.first()).isEqualTo(
            HiraProviderRecord(
                sourceKey = "ENC_SYNTHETIC_A",
                providerName = "가나다 종합병원",
                address = "서울특별시 중구 예시로 1",
                telephone = "02-0000-0001",
                regionCode = "110000",
                districtCode = "110010",
                providerTypeCode = "11",
                providerTypeName = "종합병원",
                establishedDate = LocalDate.parse("2000-01-01"),
                longitude = BigDecimal("126.9780"),
                latitude = BigDecimal("37.5665"),
                original = page.records.first().original,
            ),
        )
    }

    @Test
    fun `continues pagination until total count is covered`() {
        val first = adapter.parse(storedFixture("fixtures/hira/hospital-page-1.xml"))
        val firstRequest = adapter.initialRequests(definition).single()
        val next = adapter.nextRequest(definition, firstRequest, first)
        assertThat(next?.query).containsEntry("pageNo", "2")
        val last = adapter.parse(storedFixture("fixtures/hira/hospital-page-2.xml"))
        assertThat(adapter.nextRequest(definition, next!!, last)).isNull()
    }
}
```

- [ ] **Step 2: Run the HIRA adapter test to verify it fails**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.HiraHospitalDirectoryAdapterTest"
```

Expected: compilation fails because `SourceAdapter`, `HiraProviderRecord`, and `HiraHospitalDirectoryAdapter` are absent.

- [ ] **Step 3: Implement the paged adapter contract and HIRA parser**

Implement the generic ledger interface in `SourceAdapter.kt`. Add this source-faithful record and adapter core in `HiraHospitalDirectoryAdapter.kt`:

```kotlin
data class HiraProviderRecord(
    override val sourceKey: String,
    val providerName: String,
    val address: String,
    val telephone: String?,
    val regionCode: String,
    val districtCode: String,
    val providerTypeCode: String,
    val providerTypeName: String,
    val establishedDate: LocalDate?,
    val longitude: BigDecimal?,
    val latitude: BigDecimal?,
    override val original: Map<String, String?>,
) : SourceRecord

class HiraHospitalDirectoryAdapter(
    override val schemaContract: SchemaContract,
) : SourceAdapter<HiraProviderRecord> {
    override val connectorId = ConnectorId("hira.hospital-directory.v1")

    override fun initialRequests(definition: ConnectorDefinition) = sequenceOf(request(definition, 1))

    override fun nextRequest(
        definition: ConnectorDefinition,
        previousRequest: OfficialApiRequest,
        page: ParsedPage<HiraProviderRecord>,
    ): OfficialApiRequest? = if (page.pageNumber * page.pageSize < page.totalCount) {
        request(definition, page.pageNumber + 1)
    } else null

    private fun request(definition: ConnectorDefinition, page: Int) = OfficialApiRequest(
        connectorId, definition.endpoint,
        mapOf("pageNo" to page.toString(), "numOfRows" to "100"), SourceFormat.XML,
    )

    override fun parse(payload: StoredPayload): ParsedPage<HiraProviderRecord> {
        val document = SecureXml.parse(payload.bytes)
        require(text(document, "resultCode") == "00") { "HIRA resultCode is not 00" }
        val itemElements = elements(document, "item")
        val records = itemElements.map { item ->
            val original = childTextMap(item)
            HiraProviderRecord(
                sourceKey = original.required("ykiho"),
                providerName = original.required("yadmNm"),
                address = original.required("addr"),
                telephone = original["telno"],
                regionCode = original.required("sidoCd"),
                districtCode = original.required("sgguCd"),
                providerTypeCode = original.required("clCd"),
                providerTypeName = original.required("clCdNm"),
                establishedDate = original["estbDd"]?.takeIf(String::isNotBlank)?.let(::parseBasicDate),
                longitude = original["XPos"]?.toBigDecimalOrNull(),
                latitude = original["YPos"]?.toBigDecimalOrNull(),
                original = original,
            )
        }
        return ParsedPage(
            records,
            text(document, "pageNo").toInt(),
            text(document, "numOfRows").toInt(),
            text(document, "totalCount").toInt(),
            itemElements.flatMap { childTextMap(it).keys }.toSet(),
            null,
        )
    }
}
```

Create `SourceParsing.kt` with these exact total helpers used by every XML adapter: `text(document: Document, tag: String): String` requires exactly one nonblank element; `elements(document: Document, tag: String): List<Element>` returns only matching elements; `childTextMap(element: Element): Map<String,String?>` includes direct child elements only and trims text; `Map<String,String?>.required(name: String): String` rejects missing/blank values with `SourceParseException(name)`; and `parseBasicDate(value: String): LocalDate` uses `DateTimeFormatter.BASIC_ISO_DATE` and wraps `DateTimeParseException` as `SourceParseException`. Create `SchemaContractLoader` with `fun load(name: String): SchemaContract`; it reads only `classpath:schemas/$name` through a Jackson mapper configured with Kotlin support and `FAIL_ON_UNKNOWN_PROPERTIES=true`, then verifies the embedded connector ID, nonblank version, nonempty required/identity sets, `requiredFields subsetOf allowedFields`, unique consistency-rule reason codes, and that every consistency-rule key/value field belongs to `allowedFields`.

The adapter does not transform `ykiho` into a public identifier and does not log it. Its only use is the source-local identity input later hashed by the gold mapper.

- [ ] **Step 4: Add and load the HIRA schema contract**

Create `hira-hospital-directory-v1.json`:

```json
{
  "connectorId": "hira.hospital-directory.v1",
  "version": "hira.hospital-directory.schema.v1",
  "requiredFields": ["ykiho", "yadmNm", "addr", "sidoCd", "sgguCd", "clCd", "clCdNm"],
  "allowedFields": ["ykiho", "yadmNm", "addr", "telno", "sidoCd", "sidoCdNm", "sgguCd", "sgguCdNm", "emdongNm", "postNo", "clCd", "clCdNm", "estbDd", "XPos", "YPos"],
  "identityFields": ["ykiho"]
}
```

- [ ] **Step 5: Add the official-shape non-covered-price fixtures and failing adapter tests**

Create `non-covered-price-page.xml` from the official dataset 15001700 field names, using synthetic identifiers and values only:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
  <body>
    <items>
      <item>
        <ykiho>ENC_SYNTHETIC_A</ykiho><yadmNm>가나다 종합병원</yadmNm>
        <clCd>11</clCd><clCdNm>종합병원</clCdNm>
        <sidoCd>110000</sidoCd><sidoCdNm>서울</sidoCdNm>
        <sgguCd>110010</sgguCd><sgguCdNm>중구</sgguCdNm>
        <urlAddr>https://provider.invalid/non-covered</urlAddr><sno>240</sno>
        <npayCd>HE1180000</npayCd><npayKorNm>MRI진단료/근골격계/고관절</npayKorNm>
        <yadmNpayCdNm>Hip MRI</yadmNpayCdNm>
        <adtFrDd>20260101</adtFrDd><adtEndDd>99991231</adtEndDd><curAmt>739000</curAmt>
      </item>
    </items>
    <numOfRows>100</numOfRows><pageNo>1</pageNo><totalCount>1</totalCount>
  </body>
</response>
```

Create `non-covered-price-invalid-amount.xml` with the same envelope but `curAmt` equal to `739000원`; this must never be silently stripped or coerced.

Create `HiraNonCoveredPriceAdapterTest.kt`:

```kotlin
class HiraNonCoveredPriceAdapterTest {
    private val providerKeys = object : HiraProviderKeyCatalog {
        override fun approvedEncryptedProviderKeys() = sequenceOf("ENC_SYNTHETIC_A")
    }
    private val adapter = HiraNonCoveredPriceAdapter(
        providerKeys,
        loadContract("hira-non-covered-price-v1.json"),
    )
    private val definition = registry().get(ConnectorId("hira.non-covered-price.v1"))

    @Test
    fun `fans out only to approved directory keys and parses current amount faithfully`() {
        val request = adapter.initialRequests(definition).single()
        assertThat(request.uri).isEqualTo(definition.endpoint)
        assertThat(request.query).containsEntry("ykiho", "ENC_SYNTHETIC_A")
            .containsEntry("pageNo", "1").containsEntry("numOfRows", "100")

        val page = adapter.parse(storedFixture("fixtures/hira/non-covered-price-page.xml"))
        assertThat(page.records).containsExactly(
            HiraNonCoveredPriceRecord(
                providerSourceKey = "ENC_SYNTHETIC_A",
                providerName = "가나다 종합병원",
                providerTypeCode = "11",
                providerTypeName = "종합병원",
                regionCode = "110000",
                regionName = "서울",
                districtCode = "110010",
                districtName = "중구",
                serialNumber = "240",
                itemCode = "HE1180000",
                itemName = "MRI진단료/근골격계/고관절",
                providerItemName = "Hip MRI",
                effectiveFrom = LocalDate.parse("2026-01-01"),
                effectiveThrough = LocalDate.parse("9999-12-31"),
                currentAmountWon = 739_000L,
                original = page.records.single().original,
            ),
        )
    }

    @Test
    fun `rejects a non-integer amount instead of fabricating a price`() {
        assertThatThrownBy {
            adapter.parse(storedFixture("fixtures/hira/non-covered-price-invalid-amount.xml"))
        }.isInstanceOf(SourceParseException::class.java)
            .hasMessageContaining("curAmt")
    }
}
```

- [ ] **Step 6: Run the non-covered-price test to verify it fails**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.HiraNonCoveredPriceAdapterTest"
```

Expected: compilation fails because `HiraNonCoveredPriceRecord`, `HiraProviderKeyCatalog`, and `HiraNonCoveredPriceAdapter` do not exist.

- [ ] **Step 7: Implement the provider-key fan-out and price schema without a synthetic join**

Create `HiraNonCoveredPriceAdapter.kt`:

```kotlin
data class HiraNonCoveredPriceRecord(
    val providerSourceKey: String,
    val providerName: String,
    val providerTypeCode: String,
    val providerTypeName: String,
    val regionCode: String,
    val regionName: String,
    val districtCode: String,
    val districtName: String,
    val serialNumber: String,
    val itemCode: String,
    val itemName: String,
    val providerItemName: String?,
    val effectiveFrom: LocalDate,
    val effectiveThrough: LocalDate?,
    val currentAmountWon: Long,
    override val original: Map<String, String?>,
) : SourceRecord {
    override val sourceKey: String =
        listOf(providerSourceKey, serialNumber, itemCode, effectiveFrom).joinToString("|")
}

class HiraNonCoveredPriceAdapter(
    private val providerKeys: HiraProviderKeyCatalog,
    override val schemaContract: SchemaContract,
) : SourceAdapter<HiraNonCoveredPriceRecord> {
    override val connectorId = ConnectorId("hira.non-covered-price.v1")

    override fun initialRequests(definition: ConnectorDefinition): Sequence<OfficialApiRequest> =
        providerKeys.approvedEncryptedProviderKeys().distinct().sorted().map { ykiho ->
            request(definition, ykiho, 1)
        }

    override fun nextRequest(
        definition: ConnectorDefinition,
        previousRequest: OfficialApiRequest,
        page: ParsedPage<HiraNonCoveredPriceRecord>,
    ): OfficialApiRequest? = if (page.pageNumber * page.pageSize < page.totalCount) {
        request(definition, previousRequest.query.getValue("ykiho"), page.pageNumber + 1)
    } else null

    private fun request(definition: ConnectorDefinition, ykiho: String, page: Int) =
        OfficialApiRequest(
            connectorId,
            definition.endpoint,
            mapOf("ykiho" to ykiho, "pageNo" to page.toString(), "numOfRows" to "100"),
            SourceFormat.XML,
        )

    override fun parse(payload: StoredPayload): ParsedPage<HiraNonCoveredPriceRecord> {
        val document = SecureXml.parse(payload.bytes)
        if (text(document, "resultCode") != "00") throw SourceParseException("HIRA resultCode is not 00")
        val items = elements(document, "item")
        val records = items.map { element ->
            val original = childTextMap(element)
            val amount = original.required("curAmt").toLongOrNull()
                ?: throw SourceParseException("curAmt must be a whole-won integer")
            if (amount < 0) throw SourceParseException("curAmt must be nonnegative")
            HiraNonCoveredPriceRecord(
                providerSourceKey = original.required("ykiho"),
                providerName = original.required("yadmNm"),
                providerTypeCode = original.required("clCd"),
                providerTypeName = original.required("clCdNm"),
                regionCode = original.required("sidoCd"),
                regionName = original.required("sidoCdNm"),
                districtCode = original.required("sgguCd"),
                districtName = original.required("sgguCdNm"),
                serialNumber = original.required("sno"),
                itemCode = original.required("npayCd"),
                itemName = original.required("npayKorNm"),
                providerItemName = original["yadmNpayCdNm"]?.takeIf(String::isNotBlank),
                effectiveFrom = parseBasicDate(original.required("adtFrDd")),
                effectiveThrough = original["adtEndDd"]?.takeIf(String::isNotBlank)?.let(::parseBasicDate),
                currentAmountWon = amount,
                original = original,
            )
        }
        return ParsedPage(
            records,
            text(document, "pageNo").toInt(),
            text(document, "numOfRows").toInt(),
            text(document, "totalCount").toInt(),
            items.flatMap { childTextMap(it).keys }.toSet(),
            null,
        )
    }
}
```

Create `hira-non-covered-price-v1.json`:

```json
{
  "connectorId": "hira.non-covered-price.v1",
  "version": "hira.non-covered-price.schema.v1",
  "requiredFields": ["ykiho", "yadmNm", "clCd", "clCdNm", "sidoCd", "sidoCdNm", "sgguCd", "sgguCdNm", "sno", "npayCd", "npayKorNm", "adtFrDd", "curAmt"],
  "allowedFields": ["ykiho", "yadmNm", "clCd", "clCdNm", "sidoCd", "sidoCdNm", "sgguCd", "sgguCdNm", "urlAddr", "sno", "npayCd", "npayKorNm", "yadmNpayCdNm", "adtFrDd", "adtEndDd", "curAmt"],
  "identityFields": ["ykiho", "sno", "npayCd", "adtFrDd"],
  "consistencyRules": [
    {"keyField": "npayCd", "valueField": "npayKorNm", "reasonCode": "ITEM_NAME_CONFLICT"}
  ]
}
```

The key catalog reads only the active, signature-verified, non-recalled HIRA directory manifest. The raw `ykiho` is used only as a server-side HIRA request parameter and inside the pre-hash source key; it never enters a DTO, URL shown to a user, log, metric, or cross-agency join. The connector cannot publish unless both the directory seed and dataset 15001700 have their own production/rights approvals. `curAmt` remains a source field with the permanent caveat: “공개된 비급여 금액 정보이며 견적·최종 청구액·의료 질 평가가 아닙니다. 현재 금액은 의료기관에 확인하세요.” The consistency rule treats `npayCd` as the official item code and `npayKorNm` as its official item name; if one code carries more than one distinct trimmed official name anywhere in a run, the whole run is quarantined instead of selecting a name.

- [ ] **Step 8: Add an opt-in live contract smoke test**

Create `HiraHospitalDirectoryLiveSmokeTest.kt` with `@Tag("live-source")`. It reads `DATA_GO_KR_SERVICE_KEY`, uses `assumeTrue(key.isNotBlank())`, requests one row from the registered endpoint, stores it in a temporary bronze bucket, validates that `resultCode` is `00`, and never creates silver, gold, or an active publication. Create `HiraNonCoveredPriceLiveSmokeTest.kt` with the same safeguards; it accepts a masked operator-supplied `HIRA_TEST_YKIHO`, requests one dataset 15001700 page, validates shape only, and creates no silver/gold/publication. Neither test prints the key or `ykiho`.

Run routine tests:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.HiraHospitalDirectoryAdapterTest"
```

Expected: `BUILD SUCCESSFUL`; directory and non-covered-price fixture tests pass and the live test is excluded.

When a development key has been granted, run explicitly:

```powershell
$env:DATA_GO_KR_SERVICE_KEY = Read-Host -MaskInput "data.go.kr development key"
$env:HIRA_TEST_YKIHO = Read-Host -MaskInput "synthetic/test institution key approved for live shape validation"
.\gradlew.bat :apps:core-api:test -DincludeTags=live-source --tests "*.HiraHospitalDirectoryLiveSmokeTest"
.\gradlew.bat :apps:core-api:test -DincludeTags=live-source --tests "*.HiraNonCoveredPriceLiveSmokeTest"
Remove-Item Env:\DATA_GO_KR_SERVICE_KEY
Remove-Item Env:\HIRA_TEST_YKIHO -ErrorAction SilentlyContinue
```

Expected: each live smoke test passes or is skipped if its masked input is absent; no secret/source-local identifier is printed and no publication row is created.

- [ ] **Step 9: Commit both HIRA adapters**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/validation/SchemaContractLoader.kt apps/core-api/src/main/resources/schemas/hira-hospital-directory-v1.json apps/core-api/src/main/resources/schemas/hira-non-covered-price-v1.json apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/hira apps/core-api/src/test/resources/fixtures/hira
git commit -m "feat(pub): adapt HIRA directory and non-covered prices"
```

---

### Task 6: Implement the MOHW annual facility-count adapter

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/mohw/MohwFacilityCountAdapter.kt`
- Create: `apps/core-api/src/main/resources/schemas/mohw-facility-counts-v1.json`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/mohw/MohwFacilityCountAdapterTest.kt`
- Create: `apps/core-api/src/test/resources/fixtures/mohw/facility-counts-2024.json`
- Create: `apps/core-api/src/test/resources/fixtures/mohw/facility-counts-invalid-total.json`

**Interfaces:**
- Consumes: `SourceAdapter`, `ConnectorDefinition`, `OfficialApiRequest`, and `StoredPayload`.
- Produces: `MohwFacilityCountRecord` and `MohwFacilityCountAdapter`; source period is the official `year`, never retrieval year.

- [ ] **Step 1: Add the official-shape JSON fixture and failing adapter test**

Create `facility-counts-2024.json`:

```json
{
  "response": {
    "header": {"resultCode": "00", "resultMsg": "NORMAL SERVICE"},
    "body": {
      "numOfRows": 500,
      "pageNo": 1,
      "totalCount": 2,
      "items": [
        {"dvsd": "서울", "year": "2024", "hsptlGrhsp": "59", "hsptlGnrhsp": "228", "hsptlClhsp": "9783", "ttl": "19651"},
        {"dvsd": "부산", "year": "2024", "hsptlGrhsp": "29", "hsptlGnrhsp": "134", "hsptlClhsp": "2467", "ttl": "5260"}
      ]
    }
  }
}
```

Create `MohwFacilityCountAdapterTest.kt`:

```kotlin
class MohwFacilityCountAdapterTest {
    private val adapter = MohwFacilityCountAdapter(
        objectMapper(), loadContract("mohw-facility-counts-v1.json"),
    )
    private val definition = registry().get(ConnectorId("mohw.facility-counts.v1"))

    @Test
    fun `requests JSON and preserves the annual statistical definition`() {
        val request = adapter.initialRequests(definition).single()
        assertThat(request.query).containsEntry("apiType", "JSON")
            .containsEntry("pageNo", "1").containsEntry("numOfRows", "500")

        val page = adapter.parse(storedFixture("fixtures/mohw/facility-counts-2024.json"))
        assertThat(page.records.first()).isEqualTo(
            MohwFacilityCountRecord(
                sourceKey = "2024:서울", regionName = "서울", year = Year.of(2024),
                generalHospitals = 59, hospitals = 228, clinics = 9783, total = 19651,
                original = page.records.first().original,
            ),
        )
        assertThat(page.sourcePublishedAt).isNull()
    }

    @Test
    fun `does not describe annual totals as current capacity`() {
        val record = adapter.parse(storedFixture("fixtures/mohw/facility-counts-2024.json")).records.first()
        assertThat(record.original).containsEntry("year", "2024")
        assertThat(record.original.keys).doesNotContain("availableBeds", "liveCapacity")
    }
}
```

- [ ] **Step 2: Run the MOHW test to verify it fails**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.MohwFacilityCountAdapterTest"
```

Expected: compilation fails because the MOHW record and adapter are absent.

- [ ] **Step 3: Implement the MOHW request and parser**

Create `MohwFacilityCountAdapter.kt`:

```kotlin
data class MohwFacilityCountRecord(
    override val sourceKey: String,
    val regionName: String,
    val year: Year,
    val generalHospitals: Int?,
    val hospitals: Int?,
    val clinics: Int?,
    val total: Int?,
    override val original: Map<String, String?>,
) : SourceRecord

class MohwFacilityCountAdapter(
    private val mapper: ObjectMapper,
    override val schemaContract: SchemaContract,
) : SourceAdapter<MohwFacilityCountRecord> {
    override val connectorId = ConnectorId("mohw.facility-counts.v1")

    override fun initialRequests(definition: ConnectorDefinition) = sequenceOf(OfficialApiRequest(
        connectorId, definition.endpoint,
        mapOf("pageNo" to "1", "numOfRows" to "500", "apiType" to "JSON"),
        SourceFormat.JSON,
    ))

    override fun nextRequest(
        definition: ConnectorDefinition,
        previousRequest: OfficialApiRequest,
        page: ParsedPage<MohwFacilityCountRecord>,
    ): OfficialApiRequest? = if (page.pageNumber * page.pageSize < page.totalCount) {
        previousRequest.copy(query = previousRequest.query +
            ("pageNo" to (page.pageNumber + 1).toString()))
    } else null

    override fun parse(payload: StoredPayload): ParsedPage<MohwFacilityCountRecord> {
        val root = mapper.readTree(payload.bytes).path("response")
        require(root.path("header").path("resultCode").asText() == "00")
        val body = root.path("body")
        val items = body.path("items").toList()
        val records = items.map { item ->
            val original = item.fields().asSequence().associate { it.key to it.value.asText(null) }
            val year = Year.parse(original.required("year"))
            val region = original.required("dvsd")
            MohwFacilityCountRecord(
                "$year:$region", region, year,
                original.intOrNull("hsptlGrhsp"), original.intOrNull("hsptlGnrhsp"),
                original.intOrNull("hsptlClhsp"), original.intOrNull("ttl"), original,
            )
        }
        return ParsedPage(
            records, body.path("pageNo").asInt(), body.path("numOfRows").asInt(),
            body.path("totalCount").asInt(), items.flatMap { node ->
                node.fieldNames().asSequence().toList()
            }.toSet(), null,
        )
    }
}
```

- [ ] **Step 4: Add the MOHW schema contract and invalid-count fixture**

Create `mohw-facility-counts-v1.json`:

```json
{
  "connectorId": "mohw.facility-counts.v1",
  "version": "mohw.facility-counts.schema.v1",
  "requiredFields": ["dvsd", "year", "ttl"],
  "allowedFields": ["dvsd", "year", "sphspMntl", "hsptlGrhsp", "hsptlGnrhsp", "ormclOrmdc", "ttl", "mdwf", "sphspLpr", "dtlhplDntcl", "dtlhplDtlhp", "hsptlClhsp", "hsptlNrhsp", "afcln", "ormclOrmhs", "sphspTbcs"],
  "identityFields": ["dvsd", "year"]
}
```

Create `facility-counts-invalid-total.json` with `totalCount: 3` but only two records; Task 8 will prove this mismatch quarantines the run.

- [ ] **Step 5: Run the MOHW tests**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.MohwFacilityCountAdapterTest"
```

Expected: `BUILD SUCCESSFUL`; two tests pass and source year remains explicit.

- [ ] **Step 6: Commit the MOHW adapter**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/mohw apps/core-api/src/main/resources/schemas/mohw-facility-counts-v1.json apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/mohw apps/core-api/src/test/resources/fixtures/mohw
git commit -m "feat: adapt MOHW annual facility counts"
```

---

### Task 7: Implement the KDCA public vaccination-reference adapter

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/kdca/KdcaVaccinationConditionAdapter.kt`
- Create: `apps/core-api/src/main/resources/schemas/kdca-vaccination-condition-codes-v1.json`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/kdca/KdcaVaccinationConditionAdapterTest.kt`
- Create: `apps/core-api/src/test/resources/fixtures/kdca/vaccination-condition-codes.xml`

**Interfaces:**
- Consumes: `SourceAdapter`, `SecureXml`, and the production-approved KDCA connector definition.
- Produces: `KdcaVaccinationConditionRecord` and `KdcaVaccinationConditionAdapter`; facts remain `REFERENCE_ONLY` in Task 9.

- [ ] **Step 1: Add the synthetic official-shape XML fixture and failing test**

Create `vaccination-condition-codes.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE</resultMsg></header>
  <body>
    <items>
      <item><dataTime>20260801090000</dataTime><cd>01</cd><cdNm>결핵(BCG)</cdNm></item>
      <item><dataTime>20260801090000</dataTime><cd>02</cd><cdNm>B형간염</cdNm></item>
    </items>
    <numOfRows>2</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount>
  </body>
</response>
```

Create `KdcaVaccinationConditionAdapterTest.kt`:

```kotlin
class KdcaVaccinationConditionAdapterTest {
    private val adapter = KdcaVaccinationConditionAdapter(
        loadContract("kdca-vaccination-condition-codes-v1.json"),
    )
    private val definition = registry().get(ConnectorId("kdca.vaccination-condition-codes.v1"))

    @Test
    fun `uses the official KDCA endpoint and parses codes as reference only`() {
        val request = adapter.initialRequests(definition).single()
        assertThat(request.uri).isEqualTo(definition.endpoint)
        assertThat(request.query).isEmpty()

        val page = adapter.parse(storedFixture("fixtures/kdca/vaccination-condition-codes.xml"))
        assertThat(page.records).containsExactly(
            KdcaVaccinationConditionRecord(
                "01", "01", "결핵(BCG)", Instant.parse("2026-08-01T00:00:00Z"),
                page.records[0].original,
            ),
            KdcaVaccinationConditionRecord(
                "02", "02", "B형간염", Instant.parse("2026-08-01T00:00:00Z"),
                page.records[1].original,
            ),
        )
        assertThat(adapter.nextRequest(definition, request, page)).isNull()
    }
}
```

- [ ] **Step 2: Run the KDCA test to verify it fails**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.KdcaVaccinationConditionAdapterTest"
```

Expected: compilation fails because the KDCA record and adapter are absent.

- [ ] **Step 3: Implement the KDCA reference adapter**

Create `KdcaVaccinationConditionAdapter.kt`:

```kotlin
data class KdcaVaccinationConditionRecord(
    override val sourceKey: String,
    val code: String,
    val nameKo: String,
    val dataTime: Instant,
    override val original: Map<String, String?>,
) : SourceRecord

class KdcaVaccinationConditionAdapter(
    override val schemaContract: SchemaContract,
) : SourceAdapter<KdcaVaccinationConditionRecord> {
    override val connectorId = ConnectorId("kdca.vaccination-condition-codes.v1")

    override fun initialRequests(definition: ConnectorDefinition) = sequenceOf(OfficialApiRequest(
        connectorId, definition.endpoint, emptyMap(), SourceFormat.XML,
    ))

    override fun nextRequest(
        definition: ConnectorDefinition,
        previousRequest: OfficialApiRequest,
        page: ParsedPage<KdcaVaccinationConditionRecord>,
    ): OfficialApiRequest? = null

    override fun parse(payload: StoredPayload): ParsedPage<KdcaVaccinationConditionRecord> {
        val document = SecureXml.parse(payload.bytes)
        require(text(document, "resultCode") == "00")
        val items = elements(document, "item")
        val records = items.map { item ->
            val original = childTextMap(item)
            val sourceTime = LocalDateTime.parse(
                original.required("dataTime"), DateTimeFormatter.ofPattern("yyyyMMddHHmmss"),
            ).atZone(ZoneId.of("Asia/Seoul")).toInstant()
            KdcaVaccinationConditionRecord(
                original.required("cd"), original.required("cd"), original.required("cdNm"),
                sourceTime, original,
            )
        }
        return ParsedPage(
            records, text(document, "pageNo").toInt(), text(document, "numOfRows").toInt(),
            text(document, "totalCount").toInt(),
            items.flatMap { childTextMap(it).keys }.toSet(),
            records.maxOfOrNull { it.dataTime },
        )
    }
}
```

- [ ] **Step 4: Add the KDCA schema contract**

Create `kdca-vaccination-condition-codes-v1.json`:

```json
{
  "connectorId": "kdca.vaccination-condition-codes.v1",
  "version": "kdca.vaccination-condition-codes.schema.v1",
  "requiredFields": ["dataTime", "cd", "cdNm"],
  "allowedFields": ["dataTime", "cd", "cdNm"],
  "identityFields": ["cd"]
}
```

- [ ] **Step 5: Run KDCA and license-denial regression tests**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.KdcaVaccinationConditionAdapterTest" --tests "*.PublicationPolicyTest"
```

Expected: `BUILD SUCCESSFUL`; the unrestricted reference adapter passes and the Type 4 commercial-publication denial remains green.

- [ ] **Step 6: Commit the KDCA adapter**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/kdca apps/core-api/src/main/resources/schemas/kdca-vaccination-condition-codes-v1.json apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/adapter/kdca apps/core-api/src/test/resources/fixtures/kdca/vaccination-condition-codes.xml
git commit -m "feat: adapt KDCA vaccination references"
```

---

### Task 8: Detect schema drift and quarantine unsafe runs

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/validation/SchemaContract.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/validation/SchemaValidator.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/validation/QuarantineService.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/validation/SchemaDriftQuarantineIntegrationTest.kt`
- Create: `apps/core-api/src/test/resources/fixtures/hira/hospital-renamed-field.xml`
- Create: `apps/core-api/src/test/resources/fixtures/hira/non-covered-price-conflicting-item-name.xml`

**Interfaces:**
- Consumes: `ParsedPage`, source contracts from Tasks 5-7, and append-only quarantine/source-state repositories from Task 3.
- Produces: `SchemaContract`, `ValidationOutcome`, page-level `SchemaValidator.validate`, cross-page `SchemaValidator.validateBatch`, and `QuarantineService.record`/`recordBatch`; no quarantined input reaches silver or gold.

- [ ] **Step 1: Add drift fixtures and a failing quarantine integration test**

Create `hospital-renamed-field.xml` from the valid HIRA fixture but replace `yadmNm` with `hospitalName`. Create `non-covered-price-conflicting-item-name.xml` with two otherwise valid, uniquely keyed dataset `15001700` rows that share `npayCd=HE1180000` but carry different nonblank `npayKorNm` values. Create `SchemaDriftQuarantineIntegrationTest.kt`:

```kotlin
@SpringBootTest(
    classes = [PublicDataApplication::class],
    properties = ["spring.config.name=application-publicdata"],
)
@ActiveProfiles("publicdata", "test")
@Transactional
class SchemaDriftQuarantineIntegrationTest(
    @Autowired private val validator: SchemaValidator,
    @Autowired private val quarantine: QuarantineService,
    @Autowired private val jdbc: JdbcTemplate,
) {
    private val hira = HiraHospitalDirectoryAdapter(loadContract("hira-hospital-directory-v1.json"))
    private val mohw = MohwFacilityCountAdapter(
        objectMapper(), loadContract("mohw-facility-counts-v1.json"),
    )
    private val hiraPrice = HiraNonCoveredPriceAdapter(
        providerKeys = object : HiraProviderKeyCatalog {
            override fun approvedEncryptedProviderKeys(): Sequence<String> = emptySequence()
        },
        schemaContract = loadContract("hira-non-covered-price-v1.json"),
    )

    @Test
    fun `renamed required HIRA field quarantines bronze and produces no downstream rows`() {
        val stored = storedFixture("fixtures/hira/hospital-renamed-field.xml")
        val page = runCatching { hira.parse(stored) }.getOrElse { exception ->
            quarantine.recordParseFailure(stored.snapshot, "PARSE_ERROR:${exception::class.simpleName}")
            assertNoDownstreamRows()
            return
        }
        val outcome = validator.validate(page, hira.schemaContract)
        assertThat(outcome).isInstanceOf(ValidationOutcome.Quarantined::class.java)
        quarantine.record(stored.snapshot, outcome as ValidationOutcome.Quarantined)
        assertNoDownstreamRows()
    }

    @Test
    fun `count mismatch and duplicate keys quarantine rather than truncate`() {
        val stored = storedFixture("fixtures/mohw/facility-counts-invalid-total.json")
        val page = mohw.parse(stored)
        val outcome = validator.validate(page, mohw.schemaContract)
        assertThat((outcome as ValidationOutcome.Quarantined).reasons)
            .contains("COUNT_MISMATCH:expected=3:actual=2")
        quarantine.record(stored.snapshot, outcome)
        assertNoDownstreamRows()
    }

    @Test
    fun `one official item code with conflicting official names quarantines the whole batch`() {
        val stored = storedFixture("fixtures/hira/non-covered-price-conflicting-item-name.xml")
        val page = hiraPrice.parse(stored)
        val outcome = validator.validateBatch(listOf(page), hiraPrice.schemaContract)

        assertThat((outcome as ValidationOutcome.Quarantined).reasons)
            .singleElement().matches("ITEM_NAME_CONFLICT:[0-9a-f]{12}")
        quarantine.recordBatch(listOf(stored.snapshot), outcome)
        assertNoDownstreamRows()
    }

    private fun assertNoDownstreamRows() {
        assertThat(jdbc.queryForObject(
            "select count(*) from public_reference.silver_record_version", Long::class.java,
        )).isZero()
        assertThat(jdbc.queryForObject(
            "select count(*) from public_reference.gold_fact_version", Long::class.java,
        )).isZero()
        assertThat(jdbc.queryForObject(
            "select count(*) from public_reference.quarantine_event", Long::class.java,
        )).isEqualTo(1)
    }
}
```

- [ ] **Step 2: Run the drift tests to verify they fail**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.SchemaDriftQuarantineIntegrationTest"
```

Expected: compilation fails because validation and quarantine services are absent.

- [ ] **Step 3: Implement deterministic schema and distribution validation**

Implement `SchemaContract`, JSON loading, and ledger outcomes in `SchemaContract.kt`. Implement `DefaultSchemaValidator`:

```kotlin
class DefaultSchemaValidator : SchemaValidator {
    override fun validate(
        page: ParsedPage<out SourceRecord>,
        contract: SchemaContract,
    ): ValidationOutcome {
        val reasons = mutableListOf<String>()
        val missing = contract.requiredFields - page.observedFields
        val unexpected = page.observedFields - contract.allowedFields
        if (missing.isNotEmpty()) reasons += "MISSING_FIELDS:${missing.sorted().joinToString(",")}"
        if (unexpected.isNotEmpty()) reasons += "UNEXPECTED_FIELDS:${unexpected.sorted().joinToString(",")}"

        val expectedOnPage = minOf(
            page.pageSize,
            (page.totalCount - ((page.pageNumber - 1) * page.pageSize)).coerceAtLeast(0),
        )
        if (page.records.size != expectedOnPage) {
            reasons += "COUNT_MISMATCH:expected=$expectedOnPage:actual=${page.records.size}"
        }
        val duplicateKeys = page.records.groupingBy { it.sourceKey }.eachCount()
            .filterValues { it > 1 }.keys.sorted()
        if (duplicateKeys.isNotEmpty()) {
            reasons += "DUPLICATE_SOURCE_KEYS:${duplicateKeys.joinToString(",") { sha256Hex(it).take(12) }}"
        }
        if (page.records.any { it.sourceKey.isBlank() }) reasons += "EMPTY_SOURCE_KEY"

        val schemaHash = sha256Hex(
            contract.version + "\n" + page.observedFields.sorted().joinToString("\n"),
        )
        return if (reasons.isEmpty()) ValidationOutcome.Accepted(schemaHash)
        else ValidationOutcome.Quarantined(schemaHash, reasons.sorted())
    }

    override fun validateBatch(
        pages: List<ParsedPage<out SourceRecord>>,
        contract: SchemaContract,
    ): ValidationOutcome {
        val schemaHash = sha256Hex(
            contract.version + "\n" + pages.flatMap { it.observedFields }.toSortedSet().joinToString("\n"),
        )
        val reasons = pages.flatMap { page ->
            when (val outcome = validate(page, contract)) {
                is ValidationOutcome.Accepted -> emptyList()
                is ValidationOutcome.Quarantined -> outcome.reasons
            }
        }.toMutableList()
        val records = pages.flatMap { it.records }
        val duplicateKeys = records.groupingBy(SourceRecord::sourceKey).eachCount()
            .filterValues { it > 1 }.keys.sorted()
        if (duplicateKeys.isNotEmpty()) {
            reasons += "DUPLICATE_SOURCE_KEYS:" + duplicateKeys.joinToString(",") {
                sha256Hex(it).take(12)
            }
        }
        contract.consistencyRules.forEach { rule ->
            records.mapNotNull { record ->
                val key = record.original[rule.keyField]?.takeIf(String::isNotBlank)
                val value = record.original[rule.valueField]?.takeIf(String::isNotBlank)
                if (key == null || value == null) null else key to value
            }.groupBy({ it.first }, { it.second })
                .filterValues { values -> values.distinct().size > 1 }
                .keys.sorted()
                .forEach { conflictingKey ->
                    reasons += "${rule.reasonCode}:${sha256Hex(conflictingKey).take(12)}"
                }
        }
        return if (reasons.isEmpty()) ValidationOutcome.Accepted(schemaHash)
        else ValidationOutcome.Quarantined(schemaHash, reasons.distinct().sorted())
    }
}
```

Source values and source keys are never included verbatim in validation event messages. The validator additionally checks page number ≥ 1, page size in `1..500`, total count ≥ 0, finite coordinates, parseable official dates, nonnegative aggregate counts, nonnegative whole-won HIRA `curAmt`, and a stable `resultCode` success value supplied by each adapter. `validateBatch` runs across every provider seed and every page before mapping or persistence, so an `ITEM_NAME_CONFLICT` cannot be hidden on another HIRA request or page.

- [ ] **Step 4: Implement immutable quarantine recording**

Create `QuarantineService`:

```kotlin
class QuarantineService(
    private val repositories: PublicDataRepositories,
    private val clock: Clock,
) {
    @Transactional
    fun record(snapshot: BronzeSnapshot, outcome: ValidationOutcome.Quarantined) {
        recordBatch(listOf(snapshot), outcome)
    }

    @Transactional
    fun recordBatch(
        snapshots: List<BronzeSnapshot>,
        outcome: ValidationOutcome.Quarantined,
    ) {
        require(snapshots.isNotEmpty()) { "quarantine requires at least one bronze snapshot" }
        val occurredAt = clock.instant()
        snapshots.distinctBy(BronzeSnapshot::snapshotId).forEach { snapshot ->
            repositories.appendQuarantine(
                QuarantineEvent(
                    UUID.randomUUID(), snapshot.connectorId, snapshot.snapshotId,
                    outcome.schemaHash, outcome.reasons, occurredAt,
                ),
            )
        }
        val latest = snapshots.maxBy(BronzeSnapshot::retrievedAt)
        repositories.appendSourceState(
            SourceStateEvent(
                UUID.randomUUID(), latest.connectorId, SourceStatus.QUARANTINED,
                null, latest.retrievedAt,
                "공식 원본의 구조가 검증된 계약과 달라 새 버전을 게시하지 않았습니다.",
                occurredAt,
            ),
        )
    }

    @Transactional
    fun recordParseFailure(snapshot: BronzeSnapshot, safeReason: String) {
        record(snapshot, ValidationOutcome.Quarantined("0".repeat(64), listOf(safeReason)))
    }
}
```

- [ ] **Step 5: Run drift, count, and append-only tests**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.SchemaDriftQuarantineIntegrationTest" --tests "*.ImmutableProvenanceIntegrationTest"
```

Expected: `BUILD SUCCESSFUL`; renamed fields, count mismatches, and a conflicting official name for one non-covered item code append quarantine evidence, while silver and gold remain empty.

- [ ] **Step 6: Commit fail-closed drift handling**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/validation apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/validation apps/core-api/src/test/resources/fixtures/hira/hospital-renamed-field.xml apps/core-api/src/test/resources/fixtures/hira/non-covered-price-conflicting-item-name.xml
git commit -m "feat: quarantine unsafe public source drift"
```

---

### Task 9: Map silver/gold facts and publish signed manifests atomically

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/pipeline/PublicIngestionPipeline.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish/PublicFact.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish/PublicFactMappers.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/JdbcHiraProviderKeyCatalog.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish/ManifestSigner.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish/KmsManifestSigner.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish/PublicationService.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/PublicDataRepositories.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance/JdbcPublicDataRepositories.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/publish/PublicationServiceIntegrationTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/PublicationTestFixtures.kt`

**Interfaces:**
- Consumes: all connector, acquisition, adapter, validation, quarantine, and provenance interfaces through Task 8.
- Produces: directory, non-covered-price, MOHW, and KDCA `PublicFact` mappings; `PublicationManifest`; `ManifestSigner`; `PublicationService.publish`; `PublicIngestionPipeline.run`; and a server-only `HiraProviderKeyCatalog` that reads keys only through an active signed directory manifest. Later API tasks read only active signed gold facts.

- [ ] **Step 1: Write the failing publication tests**

Create `PublicationServiceIntegrationTest.kt`:

```kotlin
@SpringBootTest(
    classes = [PublicDataApplication::class],
    properties = ["spring.config.name=application-publicdata"],
)
@ActiveProfiles("publicdata", "test")
class PublicationServiceIntegrationTest(
    @Autowired private val service: PublicationService,
    @Autowired private val repositories: PublicDataRepositories,
    @Autowired private val jdbc: JdbcTemplate,
) {
    private val signer = TestEd25519ManifestSigner.fixed()

    @Test
    fun `publishes an append-only signed manifest and atomically activates it`() {
        val definition = approvedHiraFixture()
        val batch = mappedHiraBatch(definition)
        val manifest = service.publish(definition, batch.silver, batch.facts, signer)

        assertThat(repositories.activePublication(definition.connectorId)?.publicationId)
            .isEqualTo(manifest.publicationId)
        assertThatCode { signer.requireValid(manifest) }.doesNotThrowAnyException()
        assertThat(manifest.factIds).allMatch { it.startsWith("hira.hospital-directory.v1:") }
        assertThat(batch.facts).allSatisfy { fact ->
            assertThat(fact.sourceKeyHash).matches("[0-9a-f]{64}")
            assertThat(fact.original.toString()).doesNotContain("ENC_SYNTHETIC")
            assertThat(fact.comparability).isEqualTo(Comparability.DIRECTORY_FIELDS_ONLY)
            assertThat(fact.source.license.thirdPartyRights).isTrue()
            assertThat(fact.source.license.thirdPartyRightsApprovalRef)
                .isEqualTo("test-directory-rights-review-2026-08-09")
            assertThat(fact.source.license.reviewedAt).isEqualTo(LocalDate.parse("2026-08-09"))
        }
    }

    @Test
    fun `second publication preserves the first manifest and records the pointer switch`() {
        val definition = approvedHiraFixture()
        val first = service.publish(definition, mappedHiraBatch(definition).silver,
            mappedHiraBatch(definition).facts, signer)
        val secondBatch = mappedHiraBatch(definition, providerName = "가나다 새 이름")
        val second = service.publish(definition, secondBatch.silver, secondBatch.facts, signer)

        assertThat(second.publicationId).isNotEqualTo(first.publicationId)
        assertThat(jdbc.queryForObject(
            "select count(*) from public_reference.publication_manifest", Long::class.java,
        )).isEqualTo(2)
        assertThat(jdbc.queryForObject(
            "select count(*) from public_reference.publication_pointer_event", Long::class.java,
        )).isEqualTo(2)
    }

    @Test
    fun `development-only HIRA cannot create gold or a manifest`() {
        val definition = registry().get(ConnectorId("hira.hospital-directory.v1"))
        val batch = mappedHiraBatch(definition)
        assertThatThrownBy { service.publish(definition, batch.silver, batch.facts, signer) }
            .isInstanceOf(PublicationDenied::class.java)
        assertThat(repositories.activePublication(definition.connectorId)).isNull()
    }

    @Test
    fun `approved test price mapping preserves whole won amount and removes HIRA key`() {
        val definition = approvedHiraPriceFixture()
        val batch = mappedHiraPriceBatch(definition)
        service.publish(definition, batch.silver, batch.facts, signer)

        assertThat(batch.facts).allSatisfy { fact ->
            assertThat(fact.normalized["currentAmountWon"].longValue()).isEqualTo(739_000L)
            assertThat(fact.comparability)
                .isEqualTo(Comparability.NON_COVERED_PRICE_SAME_ITEM_AND_EFFECTIVE_PERIOD_ONLY)
            assertThat(fact.original.toString()).doesNotContain("ENC_SYNTHETIC")
            assertThat(fact.caveats).contains(
                "공개된 비급여 금액 정보이며 견적·최종 청구액·의료 질 평가가 아닙니다. 현재 금액은 의료기관에 확인하세요.",
            )
        }
    }
}
```

`approvedHiraFixture` and `approvedHiraPriceFixture` are test-only copies of their distinct governed definitions with `releaseStatus=PRODUCTION_APPROVED`, `thirdPartyRights=true`, distinct connector-specific approval references `test-directory-rights-review-2026-08-09` and `test-price-rights-review-2026-08-09`, reviewer `integration-test`, and review date `2026-08-09`; production YAML remains unchanged.

Create `PublicationTestFixtures.kt` with `data class MappedBatch(val silver: List<SilverRecordVersion>, val facts: List<PublicFact>)` and exact top-level helpers `approvedHiraFixture()`, `approvedHiraPriceFixture()`, `mappedHiraBatch(definition, providerName = "가나다 종합병원")`, `mappedHiraPriceBatch(definition)`, `kdcaTypeFourFixture()`, and `publishedManifest(label: String)`. `TestEd25519ManifestSigner.fixed()` implements both `ManifestSigner` and `ManifestVerifier` with one deterministic test keypair; it verifies canonical bytes and rejects any changed ID/fact/timestamp/digest/signature. All test files import `kr.co.genomecompanion.publicdata.support.*`; no test helper is compiled into main source.

- [ ] **Step 2: Run the publication test to verify it fails**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.PublicationServiceIntegrationTest"
```

Expected: compilation fails because public facts, manifest signing, mapping, and publication do not exist.

- [ ] **Step 3: Implement source-faithful silver records and public fact mappers**

Implement the ledger contracts in `PublicFact.kt`. Add `MappingContext` and mapper interface:

```kotlin
data class MappingContext(
    val definition: ConnectorDefinition,
    val snapshot: BronzeSnapshot,
    val schemaHash: String,
    val sourcePublishedAt: Instant?,
)

interface PublicFactMapper<R : SourceRecord> {
    val transformVersion: String
    fun map(record: R, context: MappingContext): PublicFact
}

interface PublicFactMapperRegistry {
    fun map(record: SourceRecord, context: MappingContext): PublicFact
}

data class AcceptedSourcePage<R : SourceRecord>(
    val stored: StoredPayload,
    val page: ParsedPage<R>,
    val schemaHash: String,
)

data class MappedIngestionBatch(
    val silver: List<SilverRecordVersion>,
    val facts: List<PublicFact>,
)
```

Implement the HIRA mapper in `PublicFactMappers.kt`:

```kotlin
class HiraProviderFactMapper(private val mapper: ObjectMapper) : PublicFactMapper<HiraProviderRecord> {
    override val transformVersion = "hira.hospital-directory.map.v1"

    override fun map(record: HiraProviderRecord, context: MappingContext): PublicFact {
        val sourceKeyHash = sha256Hex(record.sourceKey)
        val sourcePeriod = context.sourcePublishedAt?.toString() ?: "as-published-by-source"
        return PublicFact(
            factId = "${context.definition.connectorId.value}:${sourceKeyHash.take(24)}:$sourcePeriod",
            connectorId = context.definition.connectorId,
            subjectType = "provider_directory",
            sourceKeyHash = sourceKeyHash,
            source = provenance(context, sourcePeriod),
            original = mapper.valueToTree(record.original - "ykiho"),
            normalized = mapper.valueToTree(mapOf(
                "providerName" to record.providerName,
                "address" to record.address,
                "telephone" to record.telephone,
                "regionCode" to record.regionCode,
                "regionName" to record.original["sidoCdNm"],
                "districtCode" to record.districtCode,
                "providerTypeCode" to record.providerTypeCode,
                "providerTypeName" to record.providerTypeName,
                "establishedDate" to record.establishedDate?.toString(),
                "longitude" to record.longitude,
                "latitude" to record.latitude,
            )),
            comparability = Comparability.DIRECTORY_FIELDS_ONLY,
            caveats = listOf(
                "요양기관 신고 기준 정보입니다.",
                "현재 운영 여부와 진료 가능 여부는 기관에 직접 확인하세요.",
                "품질 순위나 진료 추천을 의미하지 않습니다.",
            ),
            transformVersion = transformVersion,
            schemaHash = context.schemaHash,
        )
    }
}
```

Add the distinct source-faithful price mapper; it neither joins a directory price nor computes an estimate:

```kotlin
class HiraNonCoveredPriceFactMapper(
    private val mapper: ObjectMapper,
) : PublicFactMapper<HiraNonCoveredPriceRecord> {
    override val transformVersion = "hira.non-covered-price.map.v1"

    override fun map(record: HiraNonCoveredPriceRecord, context: MappingContext): PublicFact {
        val sourceKeyHash = sha256Hex(record.sourceKey)
        val sourcePeriod = buildString {
            append(record.effectiveFrom)
            append("/")
            append(record.effectiveThrough ?: "open")
        }
        return PublicFact(
            factId = "${context.definition.connectorId.value}:${sourceKeyHash.take(24)}:$sourcePeriod",
            connectorId = context.definition.connectorId,
            subjectType = "non_covered_price",
            sourceKeyHash = sourceKeyHash,
            source = provenance(context, sourcePeriod),
            original = mapper.valueToTree(record.original - "ykiho"),
            normalized = mapper.valueToTree(mapOf(
                "providerName" to record.providerName,
                "providerTypeCode" to record.providerTypeCode,
                "providerTypeName" to record.providerTypeName,
                "regionCode" to record.regionCode,
                "regionName" to record.regionName,
                "districtCode" to record.districtCode,
                "districtName" to record.districtName,
                "itemCode" to record.itemCode,
                "itemName" to record.itemName,
                "providerItemName" to record.providerItemName,
                "effectiveFrom" to record.effectiveFrom.toString(),
                "effectiveThrough" to record.effectiveThrough?.toString(),
                "currentAmountWon" to record.currentAmountWon,
            )),
            comparability = Comparability.NON_COVERED_PRICE_SAME_ITEM_AND_EFFECTIVE_PERIOD_ONLY,
            caveats = listOf(
                "동일한 비급여 코드와 적용기간의 공개 금액만 나란히 표시합니다.",
                "공개된 비급여 금액 정보이며 견적·최종 청구액·의료 질 평가가 아닙니다. 현재 금액은 의료기관에 확인하세요.",
                "표시 순서는 추천·순위·의료기관 평가가 아닙니다.",
            ),
            transformVersion = transformVersion,
            schemaHash = context.schemaHash,
        )
    }
}
```

Implement corresponding mappers:

- MOHW uses subject `regional_facility_count`, source period `record.year.toString()`, `SAME_PERIOD_AND_DEFINITION_ONLY`, and caveats `연간 지역 통계이며 현재 수용 가능 인원이나 병상 현황이 아닙니다.` and `연도와 통계 정의가 같은 값만 비교하세요.`
- KDCA uses subject `vaccination_condition_reference`, source period `record.dataTime.toString()`, `REFERENCE_ONLY`, and caveats `감염병·접종 대상 코드 참고 정보이며 개인별 접종 권고가 아닙니다.` and `접종 필요성과 시기는 의료전문가 또는 공식 최신 지침으로 확인하세요.`

Persist full original source maps in silver. Persist only publication-safe original fields in gold. The registry maps `hira.non-covered-price.v1` only to `HiraNonCoveredPriceFactMapper`; attempting to map that connector with the directory mapper fails before a gold insert.

In `PublicFact.kt`, implement `provenance(context, sourcePeriod)` as a total constructor: agency/dataset/catalog/attribution come only from the governed definition; `SourceLicenseSnapshot` copies its license class, third-party-rights flag and approval reference, reviewer/date, permitted uses, and prohibited uses at mapping time; `publishedAt` is `context.sourcePublishedAt`; retrieval/checksum come only from `context.snapshot`; and the caller supplies the source-faithful period. No mapper can override those fields, and a later registry edit cannot rewrite the immutable license snapshot already stored in gold.

Implement `JdbcHiraProviderKeyCatalog` with a single read-only query that starts at `active_publication` for `hira.hospital-directory.v1`, verifies the manifest signature through `ManifestVerifier`, joins each manifest fact to `gold_fact_version.source_key_hash`, and selects the corresponding latest `silver_record_version.original_json ->> 'ykiho'`. It returns an empty sequence when there is no serveable signed directory manifest and never logs or caches returned values. Add an integration assertion that a recalled/unsigned directory publication returns no keys and therefore the price pipeline returns `PipelineResult.Skipped(..., "NO_APPROVED_REQUEST_SEEDS")` without an outbound call.

- [ ] **Step 4: Implement canonical manifest signing and atomic publication**

Implement `TestEd25519ManifestSigner` in test source and the production `KmsManifestSigner`:

```kotlin
class KmsManifestSigner(
    private val kms: KmsClient,
    private val keyId: String,
) : ManifestSigner, ManifestVerifier {
    override fun sign(canonicalManifest: ByteArray): SignatureEnvelope {
        val digest = MessageDigest.getInstance("SHA-256").digest(canonicalManifest)
        val response = kms.sign {
            it.keyId(keyId)
                .message(SdkBytes.fromByteArray(digest))
                .messageType(MessageType.DIGEST)
                .signingAlgorithm(SigningAlgorithmSpec.ECDSA_SHA_256)
        }
        return SignatureEnvelope(
            Base64.getEncoder().encodeToString(response.signature().asByteArray()),
            keyId,
            "ECDSA_SHA_256",
        )
    }

    override fun requireValid(manifest: PublicationManifest) {
        if (manifest.signingKeyId != keyId) throw InvalidManifestSignature(manifest.publicationId)
        val canonical = canonicalManifestBytes(
            manifest.publicationId,
            manifest.connectorId,
            manifest.factIds.sorted(),
            manifest.createdAt,
        )
        val digest = MessageDigest.getInstance("SHA-256").digest(canonical)
        if (sha256Hex(canonical) != manifest.digest) throw InvalidManifestSignature(manifest.publicationId)
        val verified = kms.verify {
            it.keyId(keyId)
                .message(SdkBytes.fromByteArray(digest))
                .messageType(MessageType.DIGEST)
                .signature(SdkBytes.fromByteArray(Base64.getDecoder().decode(manifest.signature)))
                .signingAlgorithm(SigningAlgorithmSpec.ECDSA_SHA_256)
        }.signatureValid()
        if (!verified) throw InvalidManifestSignature(manifest.publicationId)
    }
}
```

Implement `PublicationService` so the policy gate happens before any gold or manifest insert:

```kotlin
class PublicationService(
    private val policy: PublicationPolicy,
    private val repositories: PublicDataRepositories,
    private val clock: Clock,
) {
    @Transactional
    fun publish(
        definition: ConnectorDefinition,
        silver: List<SilverRecordVersion>,
        facts: List<PublicFact>,
        signer: ManifestSigner,
    ): PublicationManifest {
        policy.requirePublicationAllowed(definition)
        require(facts.isNotEmpty()) { "empty publication is denied" }
        repositories.appendSilver(silver)
        repositories.appendGold(facts)
        val publicationId = UUID.randomUUID()
        val createdAt = clock.instant()
        val canonical = canonicalManifestBytes(
            publicationId, definition.connectorId, facts.map { it.factId }.sorted(), createdAt,
        )
        val signature = signer.sign(canonical)
        val manifest = PublicationManifest(
            publicationId, definition.connectorId, facts.map { it.factId }.sorted(), createdAt,
            sha256Hex(canonical), signature.value, signature.keyId,
        )
        repositories.appendManifest(manifest)
        repositories.switchActivePublication(
            definition.connectorId, manifest.publicationId, "VALIDATED_PUBLICATION", createdAt,
        )
        return manifest
    }
}
```

Implement `canonicalManifestBytes(publicationId, connectorId, factIds, createdAt)` in `ManifestSigner.kt` as UTF-8 JSON with the exact property order `publicationId`, `connectorId`, `factIds`, `createdAt`; fact IDs are lexicographically sorted, timestamps use `Instant.toString()`, and Jackson writes no pretty-print whitespace. No platform-dependent whitespace or timestamp is generated outside the injected clock. Both signer and verifier call this same function.

- [ ] **Step 5: Implement the ingestion state machine**

Create `PublicIngestionPipeline.run(adapter)`:

```kotlin
sealed interface PipelineResult {
    data class Published(val manifest: PublicationManifest) : PipelineResult
    data class Quarantined(val connectorId: ConnectorId, val reasons: List<String>) : PipelineResult
    data class ValidatedDevelopmentOnly(val connectorId: ConnectorId, val recordCount: Int) : PipelineResult
    data class Skipped(val connectorId: ConnectorId, val reason: String) : PipelineResult
}

class PublicIngestionPipeline(
    private val registry: ConnectorRegistry,
    private val acquisition: AcquisitionCoordinator,
    private val validator: SchemaValidator,
    private val quarantine: QuarantineService,
    private val repositories: PublicDataRepositories,
    private val mappers: PublicFactMapperRegistry,
    private val publication: PublicationService,
    private val signer: ManifestSigner,
    private val clock: Clock,
) {
    fun <R : SourceRecord> run(adapter: SourceAdapter<R>): PipelineResult {
        val definition = registry.get(adapter.connectorId)
        val accepted = mutableListOf<AcceptedSourcePage<R>>()
        val initialRequests = adapter.initialRequests(definition).toList()
        if (initialRequests.isEmpty()) {
            return PipelineResult.Skipped(definition.connectorId, "NO_APPROVED_REQUEST_SEEDS")
        }
        for (initialRequest in initialRequests) {
            var request: OfficialApiRequest? = initialRequest
            while (request != null) {
                val currentRequest = request
                val stored = acquisition.acquire(definition, currentRequest)
                val page = try { adapter.parse(stored) } catch (exception: Exception) {
                    quarantine.recordParseFailure(stored.snapshot, "PARSE_ERROR:${exception::class.simpleName}")
                    return PipelineResult.Quarantined(definition.connectorId, listOf("PARSE_ERROR"))
                }
                when (val outcome = validator.validate(page, adapter.schemaContract)) {
                    is ValidationOutcome.Quarantined -> {
                        quarantine.record(stored.snapshot, outcome)
                        return PipelineResult.Quarantined(definition.connectorId, outcome.reasons)
                    }
                    is ValidationOutcome.Accepted -> accepted += AcceptedSourcePage(
                        stored, page, outcome.schemaHash,
                    )
                }
                request = adapter.nextRequest(definition, currentRequest, page)
            }
        }
        when (val batchOutcome = validator.validateBatch(accepted.map { it.page }, adapter.schemaContract)) {
            is ValidationOutcome.Quarantined -> {
                quarantine.recordBatch(accepted.map { it.stored.snapshot }, batchOutcome)
                return PipelineResult.Quarantined(definition.connectorId, batchOutcome.reasons)
            }
            is ValidationOutcome.Accepted -> Unit
        }
        val mapped = buildMappedBatch(definition, accepted, mappers, clock.instant())
        if (definition.releaseStatus != ReleaseStatus.PRODUCTION_APPROVED) {
            repositories.appendSilver(mapped.silver)
            return PipelineResult.ValidatedDevelopmentOnly(definition.connectorId, mapped.silver.size)
        }
        return PipelineResult.Published(
            publication.publish(definition, mapped.silver, mapped.facts, signer),
        )
    }
}
```

Implement `buildMappedBatch(definition, accepted, mappers, createdAt)` in `PublicIngestionPipeline.kt`. For every accepted record it builds `MappingContext(definition, stored.snapshot, schemaHash, page.sourcePublishedAt)`, invokes exactly one mapper selected by connector ID, then creates a `SilverRecordVersion` from the full `record.original`, the mapped fact's normalized JSON, SHA-256 source key, bronze snapshot ID/retrieval, mapped transform version, schema hash, and injected `createdAt`. It returns both lists in source-page/record order; manifest creation sorts fact IDs. The registry contains exactly the four connector-to-mapper bindings and throws `MissingPublicFactMapper` or `WrongSourceRecordType` before persistence. Page and whole-batch validation both complete before this function runs; `ITEM_NAME_CONFLICT` therefore retains every acquired bronze snapshot, appends quarantine evidence for the run, and writes no silver, gold, or manifest. Development-only facts exist only in memory while their silver records are retained after an accepted batch.

- [ ] **Step 6: Run publication, policy, and append-only regression tests**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.PublicationServiceIntegrationTest" --tests "*.PublicationPolicyTest" --tests "*.ImmutableProvenanceIntegrationTest"
```

Expected: `BUILD SUCCESSFUL`; signed activation, historical preservation, HIRA development denial, Type 4 denial, and append-only protections all pass.

- [ ] **Step 7: Commit the silver/gold publisher and pipeline**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/pipeline apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/publish apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/provenance apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/adapter/hira/JdbcHiraProviderKeyCatalog.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/publish apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/PublicationTestFixtures.kt
git commit -m "feat: publish signed public fact manifests"
```

---

### Task 10: Expose the provenance-complete public comparison API

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison/ComparisonModels.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison/ComparisonService.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison/PublicCursorCodec.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison/PublicComparisonController.kt`
- Create: `apps/core-api/src/main/resources/openapi/public-comparison.yaml`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/comparison/PublicComparisonControllerTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/ComparisonTestFixtures.kt`

**Interfaces:**
- Consumes: active `PublicationManifest`, active gold facts, source-state reads, and the ledger `ComparisonService` signatures.
- Produces: source-faithful provider `GET /v1/public/comparisons/providers`; official non-covered-item discovery `GET /v1/public/non-covered-items`; lead-wedge price `GET /v1/public/comparisons/non-covered-prices`; `GET /v1/public/facts/{factId}`; OpenAPI/Kotlin `ComparisonPage`, `NonCoveredItemPage`, `NonCoveredPricePage`, and `PublicFactResponse` contracts for the separately owned product UX.

**Frozen production UX handoff:**

| Route | `operationId` | Accepted query parameters | Response schema |
|---|---|---|---|
| `GET /v1/public/comparisons/providers` | `listPublicProviders` | `regionCode`, `providerType`, `page`, `size` | `ComparisonPage` |
| `GET /v1/public/non-covered-items` | `listNonCoveredItems` | required `query`; optional `cursor`, `size` (default `20`) | `NonCoveredItemPage` |
| `GET /v1/public/comparisons/non-covered-prices` | `listNonCoveredPrices` | required `itemCode`; optional `regionCode`, `providerType`, `sort`, `cursor`, `size` | `NonCoveredPricePage` |
| `GET /v1/public/facts/{factId}` | `getPublicFact` | none | `PublicFactResponse` |

`NonCoveredItemPage` fields are exactly `query`, `publication`, `availability`, `items`, `nextCursor`, and `caveats`; its `query` object fields are exactly `query`, `cursor`, and `size`; each `NonCoveredItem` fields are exactly `itemCode`, `itemName`, `source`, `transformVersion`, and `schemaHash`. `NonCoveredPricePage` fields remain exactly `query`, `publication`, `availability`, `items`, `nextCursor`, `methodologyVersion`, and `caveats`; each `NonCoveredPriceItem` remains the source-faithful fields defined in Step 3 and has its own `caveats`. No amount is added to `ComparisonPage` or `NonCoveredItemPage`.

- [ ] **Step 1: Write failing HTTP contract tests**

Create `PublicComparisonControllerTest.kt` with a mocked `ComparisonService` and fixed response fixture:

```kotlin
@WebMvcTest(PublicComparisonController::class)
@ContextConfiguration(classes = [PublicDataApplication::class])
@ActiveProfiles("publicdata", "test")
@TestPropertySource(properties = ["spring.config.name=application-publicdata"])
class PublicComparisonControllerTest(
    @Autowired private val mvc: MockMvc,
    @MockitoBean private val comparisonService: ComparisonService,
) {
    @Test
    fun `returns neutral provider rows with complete public provenance`() {
        whenever(comparisonService.compareProviders(any())).thenReturn(comparisonResponse())

        mvc.perform(get("/v1/public/comparisons/providers")
            .param("regionCode", "110000")
            .param("providerType", "11")
            .param("page", "0")
            .param("size", "20"))
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store, max-age=0"))
            .andExpect(header().string("Pragma", "no-cache"))
            .andExpect(jsonPath("$.items[0].providerName").value("가나다 종합병원"))
            .andExpect(jsonPath("$.items[0].comparability").value("DIRECTORY_FIELDS_ONLY"))
            .andExpect(jsonPath("$.items[0].source.agency").value("HIRA"))
            .andExpect(jsonPath("$.items[0].source.datasetId").value("15001698"))
            .andExpect(jsonPath("$.items[0].source.retrievedAt").exists())
            .andExpect(jsonPath("$.items[0].transformVersion").value("hira.hospital-directory.map.v1"))
            .andExpect(jsonPath("$.items[0].rank").doesNotExist())
            .andExpect(jsonPath("$.items[0].score").doesNotExist())
            .andExpect(content().string(not(containsString("ENC_SYNTHETIC"))))
    }

    @Test
    fun `returns source-faithful non-covered price rows with permanent caveats`() {
        whenever(comparisonService.compareNonCoveredPrices(any())).thenReturn(nonCoveredPriceResponse())

        mvc.perform(get("/v1/public/comparisons/non-covered-prices")
            .param("itemCode", "HE1180000")
            .param("regionCode", "110000")
            .param("sort", "AMOUNT_ASC")
            .param("size", "20"))
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store, max-age=0"))
            .andExpect(header().string("Pragma", "no-cache"))
            .andExpect(jsonPath("$.items[0].currentAmountWon").value(739000))
            .andExpect(jsonPath("$.items[0].currency").value("KRW"))
            .andExpect(jsonPath("$.items[0].source.datasetId").value("15001700"))
            .andExpect(jsonPath("$.items[0].itemCode").value("HE1180000"))
            .andExpect(jsonPath("$.items[0].comparability")
                .value("NON_COVERED_PRICE_SAME_ITEM_AND_EFFECTIVE_PERIOD_ONLY"))
            .andExpect(jsonPath("$.caveats[1]").value(containsString("견적")))
            .andExpect(jsonPath("$.items[0].providerId").doesNotExist())
            .andExpect(jsonPath("$.items[0].qualityScore").doesNotExist())
            .andExpect(content().string(not(containsString("ENC_SYNTHETIC"))))
    }

    @Test
    fun `discovers exact official non-covered item pairs without ranking`() {
        whenever(comparisonService.listNonCoveredItems(any())).thenReturn(nonCoveredItemResponse())

        mvc.perform(get("/v1/public/non-covered-items")
            .param("query", "MRI")
            .param("size", "20"))
            .andExpect(status().isOk)
            .andExpect(header().string("Cache-Control", "no-store, max-age=0"))
            .andExpect(header().string("Pragma", "no-cache"))
            .andExpect(jsonPath("$.query.query").value("MRI"))
            .andExpect(jsonPath("$.items[0].itemCode").value("HE1180000"))
            .andExpect(jsonPath("$.items[0].itemName").value("MRI진단료/근골격계/고관절"))
            .andExpect(jsonPath("$.items[0].source.datasetId").value("15001700"))
            .andExpect(jsonPath("$.items[0].source.thirdPartyRights").value(true))
            .andExpect(jsonPath("$.items[0].source.licenseReviewedAt").value("2026-08-09"))
            .andExpect(jsonPath("$.items[0].transformVersion")
                .value("hira.non-covered-price.map.v1"))
            .andExpect(jsonPath("$.nextCursor").doesNotExist())
            .andExpect(jsonPath("$.items[0].rank").doesNotExist())
            .andExpect(jsonPath("$.items[0].popularity").doesNotExist())
            .andExpect(jsonPath("$.items[0].recommendation").doesNotExist())
    }

    @Test
    fun `rejects personal and unknown query parameters`() {
        mvc.perform(get("/v1/public/comparisons/providers")
            .param("regionCode", "110000").param("userId", "person-1"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("UNSUPPORTED_PUBLIC_QUERY_PARAMETER"))

        mvc.perform(get("/v1/public/non-covered-items")
            .param("query", "MRI").param("patientId", "person-1"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("UNSUPPORTED_PUBLIC_QUERY_PARAMETER"))
    }

    @Test
    fun `validates bounded public filters`() {
        mvc.perform(get("/v1/public/comparisons/providers")
            .param("regionCode", "서울").param("page", "-1").param("size", "1000"))
            .andExpect(status().isBadRequest)

        mvc.perform(get("/v1/public/non-covered-items")
            .param("query", " ").param("size", "20"))
            .andExpect(status().isBadRequest)
        mvc.perform(get("/v1/public/non-covered-items")
            .param("query", "가".repeat(81)).param("size", "20"))
            .andExpect(status().isBadRequest)
    }
}
```

The fixture returns two alphabetically ordered providers, one matching MOHW annual regional context row, a signed publication ID, a `FRESH` availability block, attribution, source period, retrieval time, and caveats.

Create `ComparisonTestFixtures.kt` with top-level `comparisonResponse(): ComparisonPage`, `nonCoveredItemResponse(): NonCoveredItemPage`, and `nonCoveredPriceResponse(): NonCoveredPricePage`. All are complete constructor calls using fixed UUIDs/timestamps, official catalog URLs, 64-character synthetic hashes, all required caveats, and no source key. The item fixture contains exactly one official code/name pair and the page-level publication, availability, source/provenance, nullable cursor, and caveats fields. Later Task 11 extends this file with `connector(freshFor, serveStaleFor)` and overloaded `recallJson()` / `recallJson(manifest)`; Task 13 adds `OfficialFixtureSource` (a deterministic in-memory `OfficialSourceTransport` with `use(classpath)`), `TestAdapterSet(hiraDirectory, hiraPrice, mohw, kdca)`, and a `@TestConfiguration` that exposes those beans plus `productionConnectorRegistry`. The approved test registry overrides only the two HIRA status/review-reference fields and is unavailable outside test scope.

- [ ] **Step 2: Run the controller test to verify it fails**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.PublicComparisonControllerTest"
```

Expected: compilation fails because provider/item-discovery/price DTOs, service methods, cursor codec, and controller are absent.

- [ ] **Step 3: Define the public response without internal or personal identifiers**

Create `ComparisonModels.kt`:

```kotlin
data class ComparisonPage(
    val query: ProviderComparisonQuery,
    val publication: PublicationSummary,
    val availability: SourceAvailabilityDto,
    val items: List<ProviderComparisonItem>,
    val regionalContext: List<RegionalFacilityContext>,
)

data class NonCoveredItemPage(
    val query: NonCoveredItemQuery,
    val publication: PublicationSummary,
    val availability: SourceAvailabilityDto,
    val items: List<NonCoveredItem>,
    val nextCursor: String?,
    val caveats: List<String>,
)

data class NonCoveredPricePage(
    val query: NonCoveredPriceQuery,
    val publication: PublicationSummary,
    val availability: SourceAvailabilityDto,
    val items: List<NonCoveredPriceItem>,
    val nextCursor: String?,
    val methodologyVersion: String,
    val caveats: List<String>,
)

data class SourceAvailabilityDto(
    val connectorId: String,
    val status: SourceStatus,
    val sourceAsOf: Instant?,
    val retrievedAt: Instant?,
    val evaluatedAt: Instant,
    val noticeKo: String,
)

data class PublicationSummary(
    val publicationId: UUID,
    val createdAt: Instant,
    val digest: String,
    val signingKeyId: String,
)

data class ProviderComparisonItem(
    val factId: String,
    val providerName: String,
    val providerTypeCode: String,
    val providerTypeName: String,
    val address: String,
    val telephone: String?,
    val comparability: Comparability,
    val caveats: List<String>,
    val source: PublicSourceDto,
    val transformVersion: String,
    val schemaHash: String,
)

data class NonCoveredItem(
    val itemCode: String,
    val itemName: String,
    val source: PublicSourceDto,
    val transformVersion: String,
    val schemaHash: String,
)

data class NonCoveredPriceItem(
    val factId: String,
    val providerName: String,
    val providerTypeCode: String,
    val providerTypeName: String,
    val regionName: String,
    val districtName: String,
    val itemCode: String,
    val itemName: String,
    val providerItemName: String?,
    val effectiveFrom: LocalDate,
    val effectiveThrough: LocalDate?,
    val currentAmountWon: Long,
    val currency: String = "KRW",
    val comparability: Comparability,
    val caveats: List<String>,
    val source: PublicSourceDto,
    val transformVersion: String,
    val schemaHash: String,
)

data class RegionalFacilityContext(
    val factId: String,
    val regionName: String,
    val year: Int,
    val generalHospitals: Int?,
    val hospitals: Int?,
    val clinics: Int?,
    val total: Int?,
    val caveats: List<String>,
    val source: PublicSourceDto,
)

data class PublicSourceDto(
    val agency: Agency,
    val datasetId: String,
    val canonicalUrl: URI,
    val sourcePeriod: String,
    val publishedAt: Instant?,
    val retrievedAt: Instant,
    val bronzeSha256: String,
    val licenseClass: LicenseClass,
    val thirdPartyRights: Boolean,
    val licenseReviewedAt: LocalDate,
    val attribution: String,
)

data class PublicFactResponse(
    val factId: String,
    val subjectType: String,
    val source: PublicSourceDto,
    val original: JsonNode,
    val normalized: JsonNode,
    val comparability: Comparability,
    val caveats: List<String>,
    val transformVersion: String,
    val schemaHash: String,
)
```

Do not expose `sourceKeyHash`, `ykiho`, database IDs, object keys, response headers, rights-reviewer names/references, or secret references. `bronzeSha256` proves lineage without enabling object retrieval. `PublicSourceDto.licenseClass`, `thirdPartyRights`, and `licenseReviewedAt` are copied from the immutable gold `SourceLicenseSnapshot`, not the current mutable registry record. API availability maps `ConnectorId` to a plain string so OpenAPI and generated TypeScript have one unambiguous representation.

- [ ] **Step 4: Implement neutral comparison assembly**

Implement `DefaultComparisonService` in `ComparisonService.kt`:

```kotlin
class DefaultComparisonService(
    private val repositories: PublicDataRepositories,
    private val availabilityService: SourceAvailabilityService,
    private val cursorCodec: PublicCursorCodec,
) : ComparisonService {
    private data class NonCoveredItemCandidate(
        val representativeFact: PublicFact,
        val itemCode: String,
        val itemName: String,
    )

    override fun compareProviders(query: ProviderComparisonQuery): ComparisonPage {
        val connectorId = ConnectorId("hira.hospital-directory.v1")
        val manifest = repositories.requireServeableActiveManifest(connectorId)
        val availability = availabilityService.requireServeable(connectorId).toDto()
        val filteredFacts = repositories.facts(manifest.publicationId, "provider_directory")
            .asSequence()
            .filter { query.regionCode == null || it.normalized["regionCode"].asText() == query.regionCode }
            .filter { query.providerType == null || it.normalized["providerTypeCode"].asText() == query.providerType }
            .sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) {
                it.normalized["providerName"].asText()
            })
            .drop(query.page * query.size)
            .take(query.size)
            .toList()
        val providerItems = filteredFacts.map(::providerItem)
        val regionNames = filteredFacts.mapNotNull {
            it.normalized["regionName"]?.asText()?.takeIf(String::isNotBlank)
        }.toSet()
        val regionalContext = repositories.activeFacts(
            ConnectorId("mohw.facility-counts.v1"), "regional_facility_count",
        ).filter { it.normalized["regionName"].asText() in regionNames }.map(::regionalContext)
        return ComparisonPage(
            query, publicationSummary(manifest), availability, providerItems, regionalContext,
        )
    }

    override fun listNonCoveredItems(query: NonCoveredItemQuery): NonCoveredItemPage {
        val connectorId = ConnectorId("hira.non-covered-price.v1")
        val manifest = repositories.requireServeableActiveManifest(connectorId)
        val availability = availabilityService.requireServeable(connectorId).toDto()
        val term = query.query.trim()
        require(term.isNotEmpty() && term.length <= 80) { "query must contain 1..80 characters" }
        val candidates = repositories.facts(manifest.publicationId, "non_covered_price")
            .groupBy { it.normalized["itemCode"].asText() }
            .map { (itemCode, facts) ->
                val officialNames = facts.map { it.normalized["itemName"].asText() }.distinct()
                if (officialNames.size != 1) {
                    throw CorruptPublishedFact("conflicting official item name in active publication")
                }
                NonCoveredItemCandidate(
                    representativeFact = facts.minBy(PublicFact::factId),
                    itemCode = itemCode,
                    itemName = officialNames.single(),
                )
            }
            .filter { candidate ->
                candidate.itemName.contains(term, ignoreCase = true) ||
                    candidate.itemCode.contains(term, ignoreCase = true)
            }
            .sortedWith(compareBy<NonCoveredItemCandidate>({ it.itemName }, { it.itemCode }))
        val slice = cursorCodec.slice(
            publicationId = manifest.publicationId,
            ordered = candidates,
            cursor = query.cursor,
            size = query.size,
            factId = { it.representativeFact.factId },
        )
        return NonCoveredItemPage(
            query = query.copy(query = term),
            publication = publicationSummary(manifest),
            availability = availability,
            items = slice.items.map(::nonCoveredItem),
            nextCursor = slice.nextCursor,
            caveats = listOf(
                "공식 비급여 항목명과 코드의 검색 결과이며 인기·추천·순위를 의미하지 않습니다.",
                "검색은 공식 항목명 또는 코드의 단순 부분 일치이며 동의어·오탈자·의학적 적합성을 추론하지 않습니다.",
                "항목을 선택한 뒤 의료기관별 공개 금액을 조회하세요. 공개 금액은 견적·최종 청구액이 아니므로 현재 금액은 의료기관에 확인하세요.",
            ),
        )
    }

    override fun compareNonCoveredPrices(query: NonCoveredPriceQuery): NonCoveredPricePage {
        val connectorId = ConnectorId("hira.non-covered-price.v1")
        val manifest = repositories.requireServeableActiveManifest(connectorId)
        val availability = availabilityService.requireServeable(connectorId).toDto()
        val filtered = repositories.facts(manifest.publicationId, "non_covered_price")
            .asSequence()
            .filter { it.normalized["itemCode"].asText() == query.itemCode }
            .filter { query.regionCode == null || it.normalized["regionCode"].asText() == query.regionCode }
            .filter { query.providerType == null || it.normalized["providerTypeCode"].asText() == query.providerType }
            .sortedWith(priceComparator(query.sort))
            .toList()
        val slice = cursorCodec.slice(
            publicationId = manifest.publicationId,
            ordered = filtered,
            cursor = query.cursor,
            size = query.size,
            factId = PublicFact::factId,
        )
        return NonCoveredPricePage(
            query = query,
            publication = publicationSummary(manifest),
            availability = availability,
            items = slice.items.map(::nonCoveredPriceItem),
            nextCursor = slice.nextCursor,
            methodologyVersion = "hira.non-covered-price.comparison.v1",
            caveats = listOf(
                "동일한 비급여 코드와 적용기간의 공개 금액만 비교할 수 있습니다.",
                "공개된 비급여 금액 정보이며 견적·최종 청구액·의료 질 평가가 아닙니다. 현재 금액은 의료기관에 확인하세요.",
                "금액 정렬은 사용자가 선택한 표시 방식이며 추천 순위가 아닙니다.",
            ),
        )
    }

    override fun fact(factId: String): PublicFactResponse =
        publicFactResponse(repositories.requireActiveFact(factId))

    private fun priceComparator(sort: NonCoveredPriceSort): Comparator<PublicFact> = when (sort) {
        NonCoveredPriceSort.PROVIDER_NAME -> compareBy(String.CASE_INSENSITIVE_ORDER) {
            it.normalized["providerName"].asText()
        }.thenBy(PublicFact::factId)
        NonCoveredPriceSort.AMOUNT_ASC -> compareBy<PublicFact> {
            it.normalized["currentAmountWon"].longValue()
        }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.normalized["providerName"].asText() }
            .thenBy(PublicFact::factId)
        NonCoveredPriceSort.AMOUNT_DESC -> compareByDescending<PublicFact> {
            it.normalized["currentAmountWon"].longValue()
        }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.normalized["providerName"].asText() }
            .thenBy(PublicFact::factId)
    }
}
```

`SourceAvailability.toDto`, `providerItem`, `nonCoveredItem`, `nonCoveredPriceItem`, `regionalContext`, `publicationSummary`, and `publicFactResponse` are total mappers declared in `ComparisonService.kt`; each copies only fields present in the Task 10 DTOs and throws `CorruptPublishedFact` when a required normalized field is absent. `nonCoveredItem` returns the exact official code/name pair from the candidate plus the lexicographically smallest supporting fact's `source`, `transformVersion`, and `schemaHash`; the representative is only a deterministic provenance carrier and is never a popularity signal. Keep the normalized HIRA `regionName` field in the gold mapper so MOHW context joins by an exact official display name. A context mismatch returns an empty context list; it never uses fuzzy matching.

Item discovery compares the trimmed `query` by simple case-insensitive substring against official `itemName` or `itemCode`, returns the stored official strings without translation, synonym expansion, spell correction, or fuzzy matching, groups only by exact official item code, and sorts with Kotlin's platform-independent natural string order by exact `itemName` then exact `itemCode`. The Task 8 whole-batch consistency rule quarantines conflicting names before publication. The defensive active-manifest check above maps a legacy/corrupt conflict to `PUBLIC_SOURCE_UNAVAILABLE` and emits no guessed item.

Create `PublicCursorCodec.kt` with this fixed interface:

```kotlin
data class PublicCursorSlice<T>(val items: List<T>, val nextCursor: String?)

class PublicCursorCodec(private val mapper: ObjectMapper) {
    fun <T> slice(
        publicationId: UUID,
        ordered: List<T>,
        cursor: String?,
        size: Int,
        factId: (T) -> String,
    ): PublicCursorSlice<T>
}

class InvalidPublicCursor : IllegalArgumentException("invalid public cursor")
```

It URL-safe-base64 encodes canonical JSON containing only `{publicationId,factId}`. `slice` rejects malformed cursors, a cursor for another active publication, or a fact ID not present after current filters with `InvalidPublicCursor`; otherwise it starts after that fact and takes `size + 1` rows to determine `nextCursor`. It never encodes an amount, provider key, filter value, identity, or secret. Controller advice maps `InvalidPublicCursor` to HTTP 400 code `INVALID_PUBLIC_CURSOR`.

- [ ] **Step 5: Implement strict HTTP parameter and cache behavior**

Create `PublicComparisonController.kt` with a package-private `OncePerRequestFilter` whose path-specific allowlists are exact: provider endpoint `{regionCode,providerType,page,size}`, item-discovery endpoint `{query,cursor,size}`, price endpoint `{itemCode,regionCode,providerType,sort,cursor,size}`, and fact endpoint `{}`. Reject every other parameter before controller binding, including personal identifiers. Validate discovery `query` as required, nonblank, and `1..80` characters; validate `itemCode` with `^[A-Za-z0-9._-]{1,50}$`, `regionCode` with `^[0-9]{6}$`, `providerType` with `^[0-9]{2}$`, provider `page` in `0..5000`, each cursor as optional base64url text of at most 512 characters, and `size` in `1..100` with default `20`.

```kotlin
@RestController
@RequestMapping("/v1/public")
class PublicComparisonController(private val service: ComparisonService) {
    private fun <T> recallSafe(body: T): ResponseEntity<T> = ResponseEntity.ok()
        .header(HttpHeaders.CACHE_CONTROL, "no-store, max-age=0")
        .header(HttpHeaders.PRAGMA, "no-cache")
        .body(body)

    @GetMapping("/comparisons/providers")
    fun providers(
        @RequestParam(required = false) @Pattern(regexp = "^[0-9]{6}$") regionCode: String?,
        @RequestParam(required = false) @Pattern(regexp = "^[0-9]{2}$") providerType: String?,
        @RequestParam(defaultValue = "0") @Min(0) @Max(5000) page: Int,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) size: Int,
    ): ResponseEntity<ComparisonPage> {
        val body = service.compareProviders(ProviderComparisonQuery(regionCode, providerType, page, size))
        return recallSafe(body)
    }

    @GetMapping("/non-covered-items")
    fun nonCoveredItems(
        @RequestParam @NotBlank @Size(min = 1, max = 80) query: String,
        @RequestParam(required = false) @Size(max = 512) cursor: String?,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) size: Int,
    ): ResponseEntity<NonCoveredItemPage> {
        val body = service.listNonCoveredItems(
            NonCoveredItemQuery(query.trim(), cursor, size),
        )
        return recallSafe(body)
    }

    @GetMapping("/comparisons/non-covered-prices")
    fun nonCoveredPrices(
        @RequestParam @Pattern(regexp = "^[A-Za-z0-9._-]{1,50}$") itemCode: String,
        @RequestParam(required = false) @Pattern(regexp = "^[0-9]{6}$") regionCode: String?,
        @RequestParam(required = false) @Pattern(regexp = "^[0-9]{2}$") providerType: String?,
        @RequestParam(defaultValue = "PROVIDER_NAME") sort: NonCoveredPriceSort,
        @RequestParam(required = false) @Size(max = 512) cursor: String?,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) size: Int,
    ): ResponseEntity<NonCoveredPricePage> {
        val body = service.compareNonCoveredPrices(
            NonCoveredPriceQuery(itemCode, regionCode, providerType, sort, cursor, size),
        )
        return recallSafe(body)
    }

    @GetMapping("/facts/{factId}")
    fun fact(@PathVariable @Size(min = 16, max = 240) factId: String): ResponseEntity<PublicFactResponse> =
        recallSafe(service.fact(factId))
}
```

The OpenAPI 200 responses for all four public operations require both headers with those exact values. Controller tests cover provider, discovery, price, and fact responses. `FreshnessAndRecallIntegrationTest` performs one successful GET before recall and one after recall/rollback and requires both responses to carry the exact no-store headers; it also proves no `public`, `max-age>0`, `s-maxage`, `stale-if-error`, validator-only, or conditional-304 path exists. Product/preview clients retain `cache: "no-store"` as defense in depth.

Map validation to RFC 9457 problem details. Map no active or expired source and `CorruptPublishedFact` to HTTP 503 with code `PUBLIC_SOURCE_UNAVAILABLE`; never fall back to an unsigned or recalled manifest and never return a guessed official item name.

- [ ] **Step 6: Write and validate the OpenAPI contract**

Create `public-comparison.yaml` with OpenAPI 3.1.0, all four paths, the exact parameter constraints above, RFC 9457 errors, and required component schemas named `ComparisonPage`, `NonCoveredItemQuery`, `NonCoveredItem`, `NonCoveredItemPage`, `NonCoveredPricePage`, and `PublicFactResponse` whose fields match Kotlin exactly. Freeze operation IDs as `listPublicProviders` for `GET /v1/public/comparisons/providers`, `listNonCoveredItems` for `GET /v1/public/non-covered-items`, `listNonCoveredPrices` for `GET /v1/public/comparisons/non-covered-prices`, and `getPublicFact` for `GET /v1/public/facts/{factId}`; each name occurs exactly once. Provider GET 200 references `#/components/schemas/ComparisonPage`; discovery GET 200 references `#/components/schemas/NonCoveredItemPage`; price GET 200 references `#/components/schemas/NonCoveredPricePage`.

Freeze the discovery operation exactly: required query parameter `query` has `minLength: 1`, `maxLength: 80`, and a nonblank pattern; optional `cursor` is base64url text with `maxLength: 512`; `size` is an integer in `1..100` with `default: 20`; no other parameter is declared. `NonCoveredItemPage` requires exactly `query`, `publication`, `availability`, `items`, `nextCursor`, and `caveats`. Its `query` schema requires exactly `query`, `cursor`, and `size`. Each `NonCoveredItem` requires exactly `itemCode`, `itemName`, `source`, `transformVersion`, and `schemaHash`; both official strings are nonblank, `schemaHash` is 64 lowercase hex characters, and no popularity, rank, score, recommendation, personalization, or inferred medical-fit property exists. Set `additionalProperties: false` on all three discovery schemas. `nextCursor` is nullable. `caveats` is a required nonempty Korean string array containing the three permanent caveats from `DefaultComparisonService`.

`NonCoveredPricePage.items[].currency` is required and has the single value `KRW`; `currentAmountWon` is a nonnegative `int64`; `nextCursor` is nullable; `methodologyVersion` is required; and page/item `caveats` are required nonempty Korean string arrays. Every `PublicSourceDto` requires `agency`, `datasetId`, `canonicalUrl`, `sourcePeriod`, nullable `publishedAt`, `retrievedAt`, `bronzeSha256`, `licenseClass`, `thirdPartyRights`, `licenseReviewedAt`, and `attribution`. Include explicit schema exclusions: no ranking/quality score, quote/final-bill claim, personal identifier, raw source-local institution key, or current-capacity interpretation. These OpenAPI components are the sole production UX handoff contracts; production clients use Orval 8.24.0 plus Zod 4 runtime validation generated from this file rather than copying backend DTOs.

Add `org.openapi.generator` contract validation only as a test dependency or validate with `npx @redocly/cli lint` in CI. Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.PublicComparisonControllerTest"
```

Expected: `BUILD SUCCESSFUL`; provider, official item discovery, price, validation, and negative-parameter API tests pass. All responses contain provenance without popularity, ranking, quote, quality, personal, or encrypted source-key fields; discovery emits the exact official item code/name pair and the price response preserves `curAmt` as `currentAmountWon` with the permanent confirmation caveat.

- [ ] **Step 7: Commit the public comparison API**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison apps/core-api/src/main/resources/openapi apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/comparison apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/ComparisonTestFixtures.kt
git commit -m "feat(pub): expose provenance-first public comparisons"
```

---

### Task 11: Add freshness evaluation, quarantine visibility, and authenticated recall

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/SourceOperations.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/FreshnessMonitor.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/RecallService.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/InternalRecallController.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config/SecurityConfiguration.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config/PublicOperatorJwtConfiguration.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config/C0RouteIsolationFilter.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison/ComparisonService.kt`
- Modify: `apps/core-api/src/main/resources/openapi/public-comparison.yaml`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/operations/FreshnessAndRecallIntegrationTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/config/PublicDataJwtValidationTest.kt`
- Modify: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/ComparisonTestFixtures.kt`

**Interfaces:**
- Consumes: connector freshness policies, immutable source-state/recall events, active manifest pointers, and public comparison reads.
- Produces: `SourceAvailability`, `SourceAvailabilityService.requireServeable`, `RecallService.recall`, scheduled freshness metrics, and `POST /internal/v1/public-data/recalls` protected by `SCOPE_public-data.recall`.

- [ ] **Step 1: Write failing freshness and recall integration tests**

Create `FreshnessAndRecallIntegrationTest.kt` with fixed clock and two existing signed manifests. In the same RED step create `PublicDataJwtValidationTest.kt` with the locally signed RSA accepted vector and every signature/issuer/audience/client/azp/token-use/time/scope mutation specified below; it must exercise the real bearer decoder/filter rather than `jwt()` helpers:

```kotlin
@SpringBootTest(
    classes = [PublicDataApplication::class],
    properties = ["spring.config.name=application-publicdata"],
)
@AutoConfigureMockMvc
@ActiveProfiles("publicdata", "test")
class FreshnessAndRecallIntegrationTest(
    @Autowired private val freshness: SourceAvailabilityService,
    @Autowired private val recall: RecallService,
    @Autowired private val repositories: PublicDataRepositories,
    @Autowired private val mvc: MockMvc,
) {
    @Test
    fun `evaluates fresh stale and expired from the connector product policy`() {
        val definition = connector(freshFor = Duration.ofHours(24), serveStaleFor = Duration.ofDays(7))
        assertThat(freshness.evaluate(definition, Instant.parse("2026-08-08T12:00:00Z"),
            Instant.parse("2026-08-09T00:00:00Z")).status).isEqualTo(SourceStatus.FRESH)
        assertThat(freshness.evaluate(definition, Instant.parse("2026-08-07T00:00:00Z"),
            Instant.parse("2026-08-09T00:00:00Z")).status).isEqualTo(SourceStatus.STALE)
        assertThat(freshness.evaluate(definition, Instant.parse("2026-07-20T00:00:00Z"),
            Instant.parse("2026-08-09T00:00:00Z")).status).isEqualTo(SourceStatus.EXPIRED)
    }

    @Test
    fun `recall rolls back to the previous signed non-recalled manifest`() {
        val old = publishedManifest("old")
        val current = publishedManifest("current")
        val result = recall.recall(RecallCommand(
            current.connectorId, current.publicationId, "SOURCE_CORRECTION",
            "공식 원본 정정으로 현재 게시 버전을 회수합니다.", "operator-7",
            Instant.parse("2026-08-09T01:00:00Z"),
        ))
        assertThat(result.replacementPublicationId).isEqualTo(old.publicationId)
        assertThat(repositories.activePublication(current.connectorId)?.publicationId)
            .isEqualTo(old.publicationId)
        assertThat(freshness.requireServeable(current.connectorId).status)
            .isEqualTo(SourceStatus.RECALLED)
    }

    @Test
    fun `recall endpoint denies missing and wrong scope`() {
        val body = recallJson()
        mvc.perform(post("/internal/v1/public-data/recalls")
            .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized)
        mvc.perform(post("/internal/v1/public-data/recalls")
            .with(jwt().authorities(SimpleGrantedAuthority("SCOPE_public-data.read")))
            .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isForbidden)
    }

    @Test
    fun `authorized recall appends evidence and never deletes history`() {
        val current = publishedManifest("current")
        mvc.perform(post("/internal/v1/public-data/recalls")
            .with(jwt().jwt { it.subject("operator-7") }
                .authorities(SimpleGrantedAuthority("SCOPE_public-data.recall")))
            .contentType(MediaType.APPLICATION_JSON).content(recallJson(current)))
            .andExpect(status().isAccepted)
            .andExpect(jsonPath("$.recalledPublicationId").value(current.publicationId.toString()))
        assertThat(repositories.manifest(current.publicationId)).isNotNull()
        assertThat(repositories.isRecalled(current.publicationId)).isTrue()
    }
}
```

Consume FND's existing `spring-security-test` dependency; Task 1's PUB script adds no second version.

`PublicDataJwtValidationTest` drives the actual bearer-token filter with locally signed RSA JWTs and an injected decoder key; it does not use `jwt()` request post-processors for decoder cases. The sole accepted vector has exact issuer `https://operator-issuer.test.invalid`, `aud=["https://public-data-ops.genome-companion.kr"]`, `client_id="public-data-operator"`, `azp="public-data-operator"`, `token_use="access"`, scalar scope `public-data.recall`, and valid `iat/nbf/exp`. Independent vectors mutate signature, issuer, singleton audience, add a second audience, omit/change `client_id`, omit/change `azp`, use `token_use=id`, expire/not-yet-valid the token, use list/duplicate/bare/mixed/unknown scopes, or add a personal scope; every vector returns the same redacted 401 and never reaches the controller. A valid ingest token cannot reach recall and a valid recall token cannot reach ingest. The existing `jwt()` tests remain method-authorization unit tests only.

- [ ] **Step 2: Run the freshness/recall tests to verify they fail**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.FreshnessAndRecallIntegrationTest" --tests "*.PublicDataJwtValidationTest"
```

Expected RED: compilation fails because source operations, recall, exact operator-JWT properties/decoder/validators, and security configuration are absent; the JWT test cannot accept its sole valid vector.

- [ ] **Step 3: Implement freshness states and fail-closed serving**

Implement `SourceOperations.kt`:

```kotlin
class SourceAvailabilityService(
    private val registry: ConnectorRegistry,
    private val repositories: PublicDataRepositories,
    private val manifestVerifier: ManifestVerifier,
    private val clock: Clock,
) {
    fun evaluate(
        definition: ConnectorDefinition,
        retrievedAt: Instant,
        now: Instant,
    ): SourceAvailability {
        val measuredAge = Duration.between(retrievedAt, now)
        val age = if (measuredAge.isNegative) Duration.ZERO else measuredAge
        val status = when {
            age <= definition.freshnessPolicy.freshFor -> SourceStatus.FRESH
            age <= definition.freshnessPolicy.freshFor.plus(definition.freshnessPolicy.serveStaleFor) -> SourceStatus.STALE
            else -> SourceStatus.EXPIRED
        }
        val notice = when (status) {
            SourceStatus.FRESH -> "공식 출처에서 검증한 최신 게시 버전입니다."
            SourceStatus.STALE -> "새 원본 확인이 지연되어 마지막 검증 버전을 표시합니다. 기준 시각을 확인하세요."
            SourceStatus.EXPIRED -> "허용된 최신성 범위를 넘어 비교를 일시 중지했습니다."
            else -> error("override states are applied by requireServeable")
        }
        return SourceAvailability(definition.connectorId, status, null, retrievedAt, now, notice)
    }

    fun requireServeable(connectorId: ConnectorId): SourceAvailability {
        val definition = registry.get(connectorId)
        val state = repositories.latestSourceState(connectorId)
        if (state?.status == SourceStatus.DISABLED) {
            throw PublicSourceUnavailable(connectorId.value)
        }
        val active = repositories.activePublication(connectorId)
            ?: throw PublicSourceUnavailable(connectorId.value)
        if (repositories.isRecalled(active.publicationId)) throw PublicSourceUnavailable(connectorId.value)
        manifestVerifier.requireValid(active)
        val lastSuccess = repositories.publicationRetrieval(active.publicationId)
            ?: throw PublicSourceUnavailable(connectorId.value)
        val base = evaluate(definition, lastSuccess, clock.instant())
        if (base.status == SourceStatus.EXPIRED) throw PublicSourceUnavailable(connectorId.value)
        return when (state?.status) {
            SourceStatus.QUARANTINED -> base.copy(
                status = SourceStatus.QUARANTINED,
                noticeKo = "새 원본이 검증에 실패해 마지막 검증 버전을 표시합니다.",
            )
            SourceStatus.RECALLED -> base.copy(
                status = SourceStatus.RECALLED,
                noticeKo = "정정으로 이전의 서명된 검증 버전으로 되돌렸습니다. 회수 사유를 확인하세요.",
            )
            else -> base
        }
    }
}
```

`publicationRetrieval(publicationId)` is not an alias for connector-level latest success. Its single read-only JDBC query starts from that exact manifest, joins only its manifest-fact rows through gold/silver to the immutable bronze snapshots from the same accepted run, rejects an empty or mixed connector/run set, and returns the maximum page retrieval instant for that publication. It never consults a newer quarantined, recalled, or inactive run. The repository integration test creates a fresh recalled current publication and a predecessor outside `freshFor + serveStaleFor`; after rollback, `requireServeable` must throw `PublicSourceUnavailable`. A second predecessor inside the window remains serveable with `SourceStatus.RECALLED`. Mutation to `latestSuccessfulRetrieval(connectorId)` must fail that test.

`FreshnessMonitor` runs every 15 minutes, appends a source-state event only when the effective status changes, and emits `public_source_age_seconds`, `public_source_status`, `public_source_quarantine_total`, and `public_source_recall_total` with `connector_id` only. It never uses request parameters, provider names, payload fragments, or API keys as metric labels.

- [ ] **Step 4: Implement append-only recall and rollback**

Create `DefaultRecallService`:

```kotlin
class DefaultRecallService(
    private val repositories: PublicDataRepositories,
    private val manifestVerifier: ManifestVerifier,
    private val clock: Clock,
) : RecallService {
    @Transactional
    override fun recall(command: RecallCommand): RecallResult {
        val active = repositories.activePublication(command.connectorId)
            ?: throw RecallRejected("connector has no active publication")
        require(active.publicationId == command.publicationId) { "only the active publication can be recalled" }
        require(command.reasonCode in setOf(
            "SOURCE_CORRECTION", "SCHEMA_ERROR", "MAPPING_ERROR", "LICENSE_CHANGE", "SECURITY_EVENT",
        ))
        repositories.appendRecall(RecallEvent(
            UUID.randomUUID(), command.connectorId, command.publicationId,
            command.reasonCode, command.reasonKo, command.requestedBy,
            command.effectiveAt, clock.instant(),
        ))
        val replacement = repositories.previousNonRecalledManifest(
            command.connectorId, command.publicationId,
        )?.also(manifestVerifier::requireValid)
        if (replacement == null) {
            repositories.clearActivePublication(
                command.connectorId, "RECALL_WITHOUT_SAFE_REPLACEMENT", clock.instant(),
            )
            repositories.appendSourceState(SourceStateEvent(
                UUID.randomUUID(), command.connectorId, SourceStatus.RECALLED,
                null, null, "회수 후 안전한 이전 버전이 없어 공개를 중지했습니다.", clock.instant(),
            ))
        } else {
            repositories.switchActivePublication(
                command.connectorId, replacement.publicationId, "RECALL_ROLLBACK", clock.instant(),
            )
            repositories.appendSourceState(SourceStateEvent(
                UUID.randomUUID(), command.connectorId, SourceStatus.RECALLED,
                null, replacement.createdAt,
                "정정으로 이전 검증 버전으로 되돌렸습니다. 회수 사유를 확인하세요.", clock.instant(),
            ))
        }
        return RecallResult(command.publicationId, replacement?.publicationId, clock.instant())
    }
}
```

The comparison read path excludes recalled manifests even if an active pointer is corrupted. A database query and service-level assertion both enforce this.

- [ ] **Step 5: Protect the internal recall endpoint**

Implement `InternalRecallController` with a 202 response and a request body containing exact connector ID, publication UUID, enumerated reason code, Korean reason of 10–500 characters, and effective time. Populate `requestedBy` from JWT `sub`, never from the body.

```kotlin
@RestController
@RequestMapping("/internal/v1/public-data")
class InternalRecallController(private val recallService: RecallService) {
    @PostMapping("/recalls")
    @PreAuthorize("hasAuthority('SCOPE_public-data.recall')")
    fun recall(
        @AuthenticationPrincipal jwt: Jwt,
        @Valid @RequestBody body: RecallRequest,
    ): ResponseEntity<RecallResult> = ResponseEntity.accepted().body(
        recallService.recall(body.toCommand(jwt.subject)),
    )
}
```

`SecurityConfiguration` belongs only to `PublicDataApplication`: it permits unauthenticated `GET /v1/public/**`, requires the C0 operator JWT for `/internal/v1/public-data/**`, disables browser sessions and CSRF for the stateless API, and denies every unmatched route. `C0RouteIsolationFilter` runs before the security chain and returns a plain 404 for the exact forbidden personal prefixes `/v1/consents`, `/v1/records`, `/v1/documents`, `/v1/health-records`, and `/v1/genomes`; the startup test also proves no handler or bean from those modules exists, so the filter cannot conceal accidental bean loading.

`PublicOperatorJwtConfiguration.kt` is C0-owned and imports no FND personal security bean. `@ConfigurationProperties("public-data.operator-oidc")` requires nonblank HTTPS `issuer`, HTTPS `jwkSetUri`, URL-valued `audience`, and `authorizedPartyClientId`. Its `NimbusJwtDecoder` uses the fixed JWK URI and a `DelegatingOAuth2TokenValidator` comprising issuer/time validation plus exact validators for `aud == listOf(audience)`, scalar `client_id == authorizedPartyClientId`, scalar `azp == authorizedPartyClientId`, and scalar `token_use == "access"`. `StrictPublicOperatorScopeConverter` accepts a scalar ASCII-space-delimited scope only, rejects duplicates and any member outside `{public-data.ingest,public-data.recall}`, and maps them one-for-one to `SCOPE_public-data.ingest|recall`; it never accepts a caller-authored `SCOPE_` string. Decoder/converter failures return one content-free 401 problem. No issuer-only `JwtDecoders.fromIssuerLocation`, discovery fallback, personal `OidcProperties`, or default scope converter is permitted.

- [ ] **Step 6: Run freshness, recall, API, and immutability tests**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.FreshnessAndRecallIntegrationTest" --tests "*.PublicDataJwtValidationTest" --tests "*.PublicComparisonControllerTest" --tests "*.ImmutableProvenanceIntegrationTest"
```

Expected GREEN: `BUILD SUCCESSFUL`; freshness states transition deterministically, expired data fails closed, quarantine can serve only the last safe manifest, recall rolls back without deleting history, the exact JWT vector succeeds, every mutated JWT fails with the same content-free 401 before controller entry, and internal authorization returns 401/403/202 as expected.

- [ ] **Step 7: Commit freshness and recall controls**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/comparison/ComparisonService.kt apps/core-api/src/main/resources/openapi/public-comparison.yaml apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/operations apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/config/PublicDataJwtValidationTest.kt apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/ComparisonTestFixtures.kt
git commit -m "feat(pub): add public source freshness and recall"
```

---

### Task 12: Build an isolated Korean-first contract explorer

**Files:**
- Create: `tools/public-data-preview/package.json`
- Create: `tools/public-data-preview/package-lock.json`
- Create: `tools/public-data-preview/tsconfig.json`
- Create: `tools/public-data-preview/next.config.ts`
- Create: `tools/public-data-preview/postcss.config.mjs`
- Create: `tools/public-data-preview/eslint.config.mjs`
- Create: `tools/public-data-preview/.env.example`
- Create: `tools/public-data-preview/vitest.config.ts`
- Create: `tools/public-data-preview/vitest.setup.ts`
- Create: `tools/public-data-preview/playwright.config.ts`
- Create: `tools/public-data-preview/src/generated/public-comparison.ts`
- Create: `tools/public-data-preview/src/app/layout.tsx`
- Create: `tools/public-data-preview/src/app/globals.css`
- Create: `tools/public-data-preview/src/app/compare/page.tsx`
- Create: `tools/public-data-preview/src/components/ComparisonFilters.tsx`
- Create: `tools/public-data-preview/src/components/ProviderComparisonTable.tsx`
- Create: `tools/public-data-preview/src/components/SourceMasthead.tsx`
- Create: `tools/public-data-preview/src/components/FreshnessBanner.tsx`
- Create: `tools/public-data-preview/src/components/ProvenanceDetails.tsx`
- Create: `tools/public-data-preview/src/components/RegionalContext.tsx`
- Create: `tools/public-data-preview/src/lib/publicComparison.ts`
- Create: `tools/public-data-preview/src/lib/publicComparison.test.ts`
- Create: `tools/public-data-preview/src/components/ProviderComparisonTable.test.tsx`
- Create: `tools/public-data-preview/e2e/provider-comparison.spec.ts`
- Create: `tools/public-data-preview/e2e/fixtures/provider-comparison.json`

**Interfaces:**
- Consumes at runtime: `GET /v1/public/comparisons/providers` and its exact Task 10 response; consumes at compile time: the complete Task 10 OpenAPI document including `NonCoveredItemPage` and `NonCoveredPricePage`; Node.js 24 LTS.
- Produces: nonproduction `/compare`; `getProviderComparison(query: ProviderComparisonQuery): Promise<ComparisonPage>`; test-only/server-only `getNonCoveredItems(query: NonCoveredItemQuery): Promise<NonCoveredItemPage>` contract proof; generated `ComparisonPage`, `NonCoveredItemPage`, and `NonCoveredPricePage` types; source masthead, comparison table, freshness/recall banner, and fact provenance details. The explorer deliberately adds no discovery or price production UI and produces no file under `apps/web/**`.

- [ ] **Step 1: Generate the pinned Next.js application and test harness**

Run:

```powershell
npx create-next-app@16.3.0 tools/public-data-preview --typescript --tailwind --eslint --app --src-dir --use-npm --import-alias "@/*" --yes
Set-Location tools/public-data-preview
npm install server-only
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test @axe-core/playwright openapi-typescript @redocly/cli
npx playwright install chromium
Set-Location ..\..
```

Add scripts to `tools/public-data-preview/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "generate:contract": "openapi-typescript ../../apps/core-api/src/main/resources/openapi/public-comparison.yaml -o src/generated/public-comparison.ts",
    "check:contract": "npm run generate:contract && git diff --exit-code -- src/generated/public-comparison.ts"
  }
}
```

Create `.env.example`:

```dotenv
PUBLIC_DATA_API_BASE_URL=http://localhost:8080
```

Generate the contract before writing explorer code:

```powershell
npm run generate:contract
```

Expected: `src/generated/public-comparison.ts` contains `components["schemas"]["ComparisonPage"]`, `components["schemas"]["NonCoveredItemPage"]`, and `components["schemas"]["NonCoveredPricePage"]`; `npm run lint` can start and the lockfile pins Next.js 16.3.0 and all resolved versions. No browser-exposed environment variable contains `SERVICE_KEY` or a government credential.

- [ ] **Step 2: Write the failing typed-client tests**

Create `publicComparison.test.ts`:

```typescript
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { getNonCoveredItems, getProviderComparison } from "./publicComparison";
import type { NonCoveredItemPage } from "./publicComparison";

describe("getProviderComparison", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends only the four allowlisted public filters", async () => {
    const response = { items: [], regionalContext: [], availability: { status: "FRESH" } };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await getProviderComparison({ regionCode: "110000", providerType: "11", page: 0, size: 20 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/v1/public/comparisons/providers?regionCode=110000&providerType=11&page=0&size=20",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toMatch(/user|patient|subject|consent|health/i);
  });

  it("turns a 503 into a safe public-source unavailable result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: "PUBLIC_SOURCE_UNAVAILABLE" }), { status: 503 },
    )));
    await expect(getProviderComparison({ page: 0, size: 20 }))
      .rejects.toMatchObject({ code: "PUBLIC_SOURCE_UNAVAILABLE" });
  });

  it("uses only query cursor and size for official item discovery", async () => {
    const response = {
      query: { query: "MRI", cursor: null, size: 20 }, items: [], nextCursor: null,
      publication: {}, availability: {}, caveats: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getNonCoveredItems({ query: "MRI", cursor: null, size: 20 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/v1/public/non-covered-items?query=MRI&size=20",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toMatch(/user|patient|subject|consent|health/i);
  });
});

describe("generated UX handoff contracts", () => {
  it("freezes the exact non-covered item discovery field names", () => {
    expectTypeOf<keyof NonCoveredItemPage>().toEqualTypeOf<
      "query" | "publication" | "availability" | "items" | "nextCursor" | "caveats"
    >();
    expectTypeOf<keyof NonCoveredItemPage["query"]>().toEqualTypeOf<
      "query" | "cursor" | "size"
    >();
    expectTypeOf<keyof NonCoveredItemPage["items"][number]>().toEqualTypeOf<
      "itemCode" | "itemName" | "source" | "transformVersion" | "schemaHash"
    >();
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 3: Run the client test to verify it fails**

Run:

```powershell
Set-Location tools/public-data-preview
npm test -- src/lib/publicComparison.test.ts
Set-Location ..\..
```

Expected: test compilation fails because `publicComparison.ts` does not exist.

- [ ] **Step 4: Implement the server-only public API client**

Create `publicComparison.ts`:

```typescript
import "server-only";
import type { components } from "../generated/public-comparison";

export type ComparisonPage = components["schemas"]["ComparisonPage"];
export type NonCoveredItemPage = components["schemas"]["NonCoveredItemPage"];
export type NonCoveredPricePage = components["schemas"]["NonCoveredPricePage"];
export type ProviderComparisonQuery = ComparisonPage["query"];
export type NonCoveredItemQuery = NonCoveredItemPage["query"];
export type ProviderComparisonItem = ComparisonPage["items"][number];
export type SourceStatus = ComparisonPage["availability"]["status"];

export class PublicSourceError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

export async function getProviderComparison(
  query: ProviderComparisonQuery,
): Promise<ComparisonPage> {
  const baseUrl = process.env.PUBLIC_DATA_API_BASE_URL ?? "http://localhost:8080";
  const parameters = new URLSearchParams();
  if (query.regionCode) parameters.set("regionCode", query.regionCode);
  if (query.providerType) parameters.set("providerType", query.providerType);
  parameters.set("page", String(query.page));
  parameters.set("size", String(query.size));
  const response = await fetch(
    `${baseUrl}/v1/public/comparisons/providers?${parameters.toString()}`,
    { cache: "no-store", headers: { accept: "application/json" } },
  );
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({ code: "PUBLIC_SOURCE_UNAVAILABLE" }))) as { code?: string };
    throw new PublicSourceError(problem.code ?? "PUBLIC_SOURCE_UNAVAILABLE", response.status);
  }
  return (await response.json()) as ComparisonPage;
}

export async function getNonCoveredItems(
  query: NonCoveredItemQuery,
): Promise<NonCoveredItemPage> {
  const baseUrl = process.env.PUBLIC_DATA_API_BASE_URL ?? "http://localhost:8080";
  const parameters = new URLSearchParams({ query: query.query, size: String(query.size) });
  if (query.cursor) parameters.set("cursor", query.cursor);
  const response = await fetch(
    `${baseUrl}/v1/public/non-covered-items?${parameters.toString()}`,
    { cache: "no-store", headers: { accept: "application/json" } },
  );
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({ code: "PUBLIC_SOURCE_UNAVAILABLE" }))) as { code?: string };
    throw new PublicSourceError(problem.code ?? "PUBLIC_SOURCE_UNAVAILABLE", response.status);
  }
  return (await response.json()) as NonCoveredItemPage;
}
```

Run:

```powershell
Set-Location tools/public-data-preview
npm test -- src/lib/publicComparison.test.ts
Set-Location ..\..
```

Expected: three client tests plus the generated discovery-field type assertion pass; the item request contains only `query`, optional `cursor`, and `size` and targets the frozen `/v1/public/non-covered-items` route.

- [ ] **Step 5: Write the failing accessible-table and status tests**

Create `ProviderComparisonTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProviderComparisonTable } from "./ProviderComparisonTable";
import { FreshnessBanner } from "./FreshnessBanner";
import comparison from "../../e2e/fixtures/provider-comparison.json";

describe("public comparison presentation", () => {
  it("uses an accessible table and never labels a provider best", () => {
    render(<ProviderComparisonTable items={comparison.items} />);
    expect(screen.getByRole("table", { name: "의료기관 공식 정보 비교" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "의료기관" })).toBeVisible();
    expect(screen.getByText("가나다 종합병원")).toBeVisible();
    expect(screen.queryByText(/최고|추천 순위|점수/)).not.toBeInTheDocument();
    expect(screen.getAllByText("공식 원본 보기")[0]).toHaveAttribute(
      "href", "https://www.data.go.kr/data/15001698/openapi.do",
    );
  });

  it("states quarantine and recall in text rather than color alone", () => {
    const { rerender } = render(<FreshnessBanner availability={{
      ...comparison.availability,
      status: "QUARANTINED",
      noticeKo: "새 원본이 검증에 실패해 마지막 검증 버전을 표시합니다.",
    }} />);
    expect(screen.getByRole("status")).toHaveTextContent("검증 보류");
    rerender(<FreshnessBanner availability={{
      ...comparison.availability,
      status: "RECALLED",
      noticeKo: "정정으로 이전 검증 버전으로 되돌렸습니다.",
    }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("회수 및 이전 버전 복원");
  });
});
```

- [ ] **Step 6: Run the component test to verify it fails**

Run:

```powershell
Set-Location tools/public-data-preview
npm test -- src/components/ProviderComparisonTable.test.tsx
Set-Location ..\..
```

Expected: module resolution fails because the comparison components do not exist.

- [ ] **Step 7: Implement the Midnight Evidence Ledger components and page**

Create `FreshnessBanner.tsx` with exact Korean labels:

```tsx
import type { ComparisonPage } from "../lib/publicComparison";

const labels = {
  FRESH: "최신성 검증됨",
  STALE: "업데이트 지연 — 마지막 검증 버전",
  EXPIRED: "비교 일시 중지",
  QUARANTINED: "검증 보류 — 마지막 안전 버전",
  RECALLED: "회수 및 이전 버전 복원",
  DISABLED: "출처 비활성화",
} as const;

export function FreshnessBanner({ availability }: {
  availability: ComparisonPage["availability"];
}) {
  const urgent = availability.status === "RECALLED" || availability.status === "EXPIRED" ||
    availability.status === "DISABLED";
  return (
    <section role={urgent ? "alert" : "status"} data-status={availability.status} className="source-status">
      <strong>{labels[availability.status]}</strong>
      <p>{availability.noticeKo}</p>
      <p className="metadata">평가 시각 {new Date(availability.evaluatedAt).toLocaleString("ko-KR")}</p>
    </section>
  );
}
```

Create `ProviderComparisonTable.tsx` as a native table with caption, provider/type/address/contact/source columns, one row per item, and an expandable `ProvenanceDetails`. Do not create a numeric score, star rating, badge implying recommendation, booking button, or sponsored ordering.

```tsx
export function ProviderComparisonTable({ items }: { items: ProviderComparisonItem[] }) {
  return (
    <table aria-label="의료기관 공식 정보 비교" className="comparison-table">
      <caption>동일한 공식 목록 필드만 나란히 표시합니다. 품질 순위가 아닙니다.</caption>
      <thead><tr><th scope="col">의료기관</th><th scope="col">종류</th><th scope="col">주소</th><th scope="col">연락처</th><th scope="col">근거</th></tr></thead>
      <tbody>{items.map((item) => (
        <tr key={item.factId}>
          <th scope="row">{item.providerName}</th>
          <td>{item.providerTypeName}</td><td>{item.address}</td><td>{item.telephone ?? "공식 원본 미기재"}</td>
          <td><a href={item.source.canonicalUrl}>공식 원본 보기</a><ProvenanceDetails item={item} /></td>
        </tr>
      ))}</tbody>
    </table>
  );
}
```

`SourceMasthead` displays agency, dataset ID, source period, retrieved time, attribution, publication digest prefix, and link to the catalog. `ProvenanceDetails` displays transform version, schema hash prefix, bronze checksum prefix, comparability definition, and every caveat. It does not expose internal object keys. `RegionalContext` renders a separate table labeled `보건복지부 연간 지역 통계 맥락`, shows the source year, and always states `현재 수용 가능 인원이나 실시간 병상 현황이 아닙니다.`

Create `ComparisonFilters.tsx` as a GET form with select controls for region and provider type, hidden `page=0`, hidden `size=20`, and no free-text or identity field.

Create `compare/page.tsx` for Next.js 16’s asynchronous `searchParams`:

```tsx
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const query = {
    regionCode: typeof values.regionCode === "string" ? values.regionCode : undefined,
    providerType: typeof values.providerType === "string" ? values.providerType : undefined,
    page: 0,
    size: 20,
  };
  try {
    const comparison = await getProviderComparison(query);
    return <main>
      <h1>공식 의료기관 정보 비교</h1>
      <p>출처와 기준 시각을 먼저 보여주는 중립적 정보 화면입니다.</p>
      <ComparisonFilters query={query} />
      <FreshnessBanner availability={comparison.availability} />
      <SourceMasthead comparison={comparison} />
      <ProviderComparisonTable items={comparison.items} />
      <RegionalContext rows={comparison.regionalContext} />
    </main>;
  } catch (error) {
    if (error instanceof PublicSourceError) return <main><h1>공식 의료기관 정보 비교</h1>
      <section role="alert"><strong>비교를 일시 중지했습니다.</strong>
      <p>검증 가능한 공식 데이터가 준비되면 다시 표시합니다.</p></section></main>;
    throw error;
  }
}
```

Create `globals.css` with the approved tokens `#08080a`, `#101014`, `#f3f1ec`, `#bbb8b2`, `#34343a`, `#78dbe8`, and `#df6b72`; visible keyboard focus; responsive table overflow; text labels for every status; and `prefers-reduced-motion`. Use system Korean sans until a font-license review is recorded.

- [ ] **Step 8: Run unit, lint, and production build checks**

Run:

```powershell
Set-Location tools/public-data-preview
npm test
npm run lint
npm run build
Set-Location ..\..
```

Expected: all Vitest tests pass, ESLint reports no errors, and Next.js produces `/compare` successfully without requiring a government key.

- [ ] **Step 9: Commit the thin comparison web slice**

```powershell
git add tools/public-data-preview
git commit -m "feat: add public data contract explorer"
```

---

### Task 13: Wire scheduled/manual ingestion, prove the slice end to end, and add CI/runbooks

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/PublicIngestionScheduler.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations/InternalIngestionController.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config/PublicDataAwsConfiguration.kt`
- Create: `apps/core-api/src/main/resources/application-publicdata.yml`
- Modify: `apps/core-api/src/main/resources/openapi/public-comparison.yaml`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/boundary/PublicDataIsolationStartupTest.kt`
- Create: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/pipeline/PublicComparisonSliceIntegrationTest.kt`
- Modify: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/ComparisonTestFixtures.kt`
- Create: `tools/public-data-preview/e2e/mock-api.mjs`
- Modify: `tools/public-data-preview/e2e/provider-comparison.spec.ts` — extend the Task 12 contract/accessibility spec with the full-slice fixture server assertions.
- Modify: `tools/public-data-preview/e2e/fixtures/provider-comparison.json` — replace Task 12's contract fixture with the complete fixed Task 10 response used by the full slice.
- Modify: `tools/public-data-preview/playwright.config.ts`
- Create: `scripts/ci/public_data_acceptance.ps1`
- Modify only at the FND PUB marker: `.github/workflows/ci.yml`
- Create: `apps/core-api/Dockerfile.publicdata`, `apps/core-api/Dockerfile.publicdata.dockerignore`
- Create: `packages/contracts/jsonschema/public-data-image-handoff.schema.json`, `packages/contracts/fixtures/public-data-image-handoff.valid.json`
- Create: `scripts/release/public_data_image_release.py`, `scripts/release/test_public_data_image_release.py`
- Consume unchanged from FND: `tooling/fnd-workstream-release/pyproject.toml`, `tooling/fnd-workstream-release/uv.lock`, `scripts/ci/run_locked_uv.py`, and `scripts/release/fnd_workstream_aws.py`
- Modify only after the FND prerequisite lands: `.github/workflows/release.yml` between `BEGIN/END PUB RELEASE STEPS`
- Create: `docs/runbooks/public-data-ingestion.md`
- Create: `docs/runbooks/public-data-recall.md`

**Interfaces:**
- Consumes: FND's pinned build and CI PUB extension marker; the required FND-owned protected `pub_release` job/marker, signed-tag verifier, Buildx/BuildKit/base-image locks, security-tool installers, Cosign 3.0.6 installer/trusted root, public ECR repository, release role, Object-Lock evidence prefix, and post-marker verifier/projection; `PublicIngestionPipeline.run`; four governed adapters (two HIRA, MOHW, KDCA); C0 operator JWT security; provider/item-discovery/price public APIs; and the isolated preview components.
- Produces: isolated `publicDataBootJar` runtime with no personal credentials/beans/routes; scheduled and scoped manual ingestion; end-to-end proofs from official-shape bytes through provider, item-discovery, and price APIs; additive CI evidence; exact ingestion and recall operating procedures; one digest-addressed scanned/SBOM-bound keyless-signed C0 image; strict `public-data-image-handoff.v1`; and the sole `public_data_image_digest` passed to FND deployment. PUB produces no repository, role, service, state machine, network, or deployment mutation.

- [ ] **Step 1: Write the failing full-slice integration test**

Create `PublicComparisonSliceIntegrationTest.kt` with Testcontainers, fixed clock, in-memory official transport returning the committed synthetic fixtures, and two test-only HIRA definitions carrying approved status plus their distinct test rights-review references:

```kotlin
@SpringBootTest(
    classes = [PublicDataApplication::class],
    properties = ["spring.config.name=application-publicdata"],
)
@AutoConfigureMockMvc
@ActiveProfiles("publicdata", "test")
class PublicComparisonSliceIntegrationTest(
    @Autowired private val pipeline: PublicIngestionPipeline,
    @Autowired private val mvc: MockMvc,
    @Autowired private val repositories: PublicDataRepositories,
    @Autowired private val publicationPolicy: PublicationPolicy,
    @Autowired @Qualifier("productionConnectorRegistry") private val productionRegistry: ConnectorRegistry,
    @Autowired private val officialFixtureSource: OfficialFixtureSource,
    @Autowired private val adapters: TestAdapterSet,
) {
    @Test
    fun `official shape to bronze silver gold manifest API keeps full provenance`() {
        assertThat(pipeline.run(adapters.hiraDirectory)).isInstanceOf(PipelineResult.Published::class.java)
        assertThat(pipeline.run(adapters.hiraPrice)).isInstanceOf(PipelineResult.Published::class.java)
        assertThat(pipeline.run(adapters.mohw)).isInstanceOf(PipelineResult.Published::class.java)
        assertThat(pipeline.run(adapters.kdca)).isInstanceOf(PipelineResult.Published::class.java)

        mvc.perform(get("/v1/public/comparisons/providers")
            .param("regionCode", "110000").param("providerType", "11")
            .param("page", "0").param("size", "20"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].providerName").value("가나다 종합병원"))
            .andExpect(jsonPath("$.items[0].source.datasetId").value("15001698"))
            .andExpect(jsonPath("$.items[0].source.bronzeSha256").isString)
            .andExpect(jsonPath("$.regionalContext[0].year").value(2024))
            .andExpect(jsonPath("$.regionalContext[0].source.datasetId").value("15098823"))
            .andExpect(content().string(not(containsString("ENC_SYNTHETIC_A"))))
            .andExpect(content().string(not(containsString("patient"))))

        mvc.perform(get("/v1/public/non-covered-items")
            .param("query", "MRI").param("size", "20"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].itemCode").value("HE1180000"))
            .andExpect(jsonPath("$.items[0].itemName").value("MRI진단료/근골격계/고관절"))
            .andExpect(jsonPath("$.items[0].source.datasetId").value("15001700"))
            .andExpect(jsonPath("$.caveats[0]").value(containsString("추천")))
            .andExpect(jsonPath("$.items[0].popularity").doesNotExist())
            .andExpect(jsonPath("$.items[0].rank").doesNotExist())
            .andExpect(content().string(not(containsString("ENC_SYNTHETIC_A"))))

        mvc.perform(get("/v1/public/comparisons/non-covered-prices")
            .param("itemCode", "HE1180000").param("regionCode", "110000")
            .param("sort", "AMOUNT_ASC").param("size", "20"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].currentAmountWon").value(739000))
            .andExpect(jsonPath("$.items[0].currency").value("KRW"))
            .andExpect(jsonPath("$.items[0].source.datasetId").value("15001700"))
            .andExpect(jsonPath("$.caveats[1]").value(containsString("견적")))
            .andExpect(content().string(not(containsString("ENC_SYNTHETIC_A"))))
    }

    @Test
    fun `a drifted replacement retains bronze but leaves the active manifest unchanged`() {
        val first = pipeline.run(adapters.hiraDirectory) as PipelineResult.Published
        officialFixtureSource.use("fixtures/hira/hospital-renamed-field.xml")
        val second = pipeline.run(adapters.hiraDirectory)

        assertThat(second).isInstanceOf(PipelineResult.Quarantined::class.java)
        assertThat(repositories.activePublication(ConnectorId("hira.hospital-directory.v1"))?.publicationId)
            .isEqualTo(first.manifest.publicationId)
        assertThat(repositories.latestSourceState(ConnectorId("hira.hospital-directory.v1"))?.status)
            .isEqualTo(SourceStatus.QUARANTINED)
    }

    @Test
    fun `production registry still blocks both real HIRA definitions and type four fixture`() {
        listOf("hira.hospital-directory.v1", "hira.non-covered-price.v1").forEach { id ->
            assertThatThrownBy {
                publicationPolicy.requirePublicationAllowed(productionRegistry.get(ConnectorId(id)))
            }.isInstanceOf(PublicationDenied::class.java)
        }
        assertThatThrownBy { publicationPolicy.requirePublicationAllowed(kdcaTypeFourFixture()) }
            .isInstanceOf(PublicationDenied::class.java)
    }
}
```

Create `PublicDataIsolationStartupTest.kt` in the same red step:

```kotlin
@SpringBootTest(
    classes = [PublicDataApplication::class],
    properties = ["spring.config.name=application-publicdata"],
)
@AutoConfigureMockMvc
@ActiveProfiles("publicdata", "test")
class PublicDataIsolationStartupTest(
    @Autowired private val context: ApplicationContext,
    @Autowired private val mvc: MockMvc,
) {
    private val forbiddenPackages = listOf(
        ".identityaccount.", ".consentpurpose.", ".healthrecord.",
        ".documentintake.", ".exportdeletion.", ".genome.",
    )

    @Test
    fun `C0 starts with only the named public datasource and no personal beans or base config`() {
        assertThat(context.getBeansOfType(DataSource::class.java).keys)
            .containsExactly("publicDataSource")
        val beanTypes = context.beanDefinitionNames.mapNotNull(context::getType).map { it.name }
        assertThat(beanTypes).noneMatch { type -> forbiddenPackages.any(type::contains) }
        assertThat(context.environment.propertySources.map { it.name })
            .noneMatch { it.contains("[application.yml]") || it.contains("[application-test.yml]") }
    }

    @Test
    fun `representative personal routes are absent not merely unauthorized`() {
        listOf("/v1/consents", "/v1/records", "/v1/documents", "/v1/health-records", "/v1/genomes")
            .forEach { path -> mvc.perform(get(path)).andExpect(status().isNotFound) }
    }
}
```

The two approved HIRA overrides and fixture transport are Spring test beans and cannot be loaded by a non-test profile. `PublicDataIsolationStartupTest` is a production gate: if it cannot prove the exact datasource, bean, config-source, and 404 assertions, stop; do not deploy the shared core artifact. A separate FND-pinned Gradle deployment module must then be introduced in a separately reviewed plan/change before production.

- [ ] **Step 2: Run the full-slice test to verify it fails**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.PublicComparisonSliceIntegrationTest"
```

Expected: the slice context fails because runtime pipeline scheduling/configuration and the test fixture transport wiring are incomplete; the isolation test also fails until the dedicated datasource/config name and C0 route filter are wired.

- [ ] **Step 3: Wire only registered adapters to scheduled and manual ingestion**

Create `PublicIngestionScheduler.kt`:

```kotlin
@Component
@EnableScheduling
@ConditionalOnProperty(name = ["public-data.scheduling-enabled"], havingValue = "true")
class PublicIngestionScheduler(
    private val pipeline: PublicIngestionPipeline,
    adapters: List<SourceAdapter<out SourceRecord>>,
) {
    private val adaptersById = adapters.associateBy { it.connectorId }

    @Scheduled(cron = "\${public-data.ingestion.mohw-cron}", zone = "Asia/Seoul")
    fun ingestMohw() { run(ConnectorId("mohw.facility-counts.v1")) }

    @Scheduled(cron = "\${public-data.ingestion.kdca-cron}", zone = "Asia/Seoul")
    fun ingestKdca() { run(ConnectorId("kdca.vaccination-condition-codes.v1")) }

    fun run(connectorId: ConnectorId): PipelineResult {
        val adapter = adaptersById[connectorId] ?: throw UnknownConnector(connectorId.value)
        return runTyped(adapter)
    }

    @Suppress("UNCHECKED_CAST")
    private fun runTyped(adapter: SourceAdapter<out SourceRecord>): PipelineResult =
        pipeline.run(adapter as SourceAdapter<SourceRecord>)
}
```

Neither HIRA connector has a scheduled method while its production registry status is `DEVELOPMENT_ONLY`. Each can be invoked manually for development validation and returns `ValidatedDevelopmentOnly` without activating a manifest; the price connector returns `Skipped(NO_APPROVED_REQUEST_SEEDS)` until a serveable signed directory publication supplies server-only keys. A later rights-approved registry change must add scheduling in the same reviewed change; auto-approval of API access alone is insufficient.

Create `InternalIngestionController.kt`:

```kotlin
@RestController
@RequestMapping("/internal/v1/public-data")
class InternalIngestionController(private val scheduler: PublicIngestionScheduler) {
    @PostMapping("/ingestions/{connectorId}")
    @PreAuthorize("hasAuthority('SCOPE_public-data.ingest')")
    fun ingest(@PathVariable connectorId: String): ResponseEntity<PipelineResult> =
        ResponseEntity.accepted().body(scheduler.run(ConnectorId(connectorId)))
}
```

Add controller tests to the slice test: no token returns 401, wrong scope returns 403, and `SCOPE_public-data.ingest` returns 202. Unknown connector IDs return 404 without making an outbound request.

- [ ] **Step 4: Add the isolated C0 runtime configuration and startup gate**

Create `application-publicdata.yml`; do not touch FND's `application.yml`:

```yaml
spring:
  application:
    name: genome-companion-public-data
  jackson:
    deserialization:
      fail-on-unknown-properties: true
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: ${PUBLIC_DATA_OPERATOR_OIDC_ISSUER}
          jwk-set-uri: ${PUBLIC_DATA_OPERATOR_OIDC_JWK_SET_URI}
  task:
    scheduling:
      pool:
        size: 2

public-data:
  operator-oidc:
    issuer: ${PUBLIC_DATA_OPERATOR_OIDC_ISSUER}
    jwk-set-uri: ${PUBLIC_DATA_OPERATOR_OIDC_JWK_SET_URI}
    audience: ${PUBLIC_DATA_OPERATOR_OIDC_AUDIENCE}
    authorized-party-client-id: ${PUBLIC_DATA_OPERATOR_OIDC_CLIENT_ID}
  datasource:
    jdbc-url: ${PUBLIC_DATA_JDBC_URL}
    username: ${PUBLIC_DATA_DB_USERNAME}
    password: ${PUBLIC_DATA_DB_PASSWORD}
  connector-registry: classpath:connectors/public-connectors.yml
  government-secret-id: ${PUBLIC_DATA_GO_KR_SECRET_ID}
  bronze-bucket: ${PUBLIC_DATA_BRONZE_BUCKET}
  manifest-signing-key-id: ${PUBLIC_DATA_MANIFEST_KMS_KEY_ID}
  aws-region: ap-northeast-2
  scheduling-enabled: true
  ingestion:
    mohw-cron: "0 30 2 * * MON"
    kdca-cron: "0 45 2 * * *"

management:
  endpoints:
    web:
      exposure:
        include: health,prometheus
  endpoint:
    health:
      show-details: never
server:
  error:
    include-message: never
    include-stacktrace: never
```

Every `${PUBLIC_DATA_*}` environment reference above is mandatory outside the synthetic test profile; there is no local production default. The exact closed set is `PUBLIC_DATA_OPERATOR_OIDC_ISSUER`, `PUBLIC_DATA_OPERATOR_OIDC_JWK_SET_URI`, `PUBLIC_DATA_OPERATOR_OIDC_AUDIENCE`, `PUBLIC_DATA_OPERATOR_OIDC_CLIENT_ID`, `PUBLIC_DATA_JDBC_URL`, `PUBLIC_DATA_DB_USERNAME`, `PUBLIC_DATA_DB_PASSWORD`, `PUBLIC_DATA_GO_KR_SECRET_ID`, `PUBLIC_DATA_BRONZE_BUCKET`, and `PUBLIC_DATA_MANIFEST_KMS_KEY_ID`, byte-for-byte. The four operator-OIDC values come from the FND protected C0 identity projection and are byte-compared to the FND snapshot before deployment; dispatch input cannot override them. The three datasource values are exact-VersionId ECS JSON-key secret injections from the one FND public-datasource secret. `PUBLIC_DATA_GO_KR_SECRET_ID` is the FND canonical `secret-arn#versionId=<VersionId>` descriptor; `SecretsManagerSecretResolver` rejects a bare ARN/name or stage and calls only `GetSecretValue` with the parsed exact VersionId, a bounded response, and response-VersionId equality. The C0 task role can read only those exact secret versions, public bronze bucket, and public manifest key in `ap-northeast-2`. Its task definition contains no FND `DB_*`, generic/personal `OIDC_*`, personal Cognito, consent, document, record, personal-storage, quarantine-source, app-health KMS, or genome variable/permission. FND's deployment authority copies the fixed environment/secrets and changes only the independently verified image digest; it cannot accept a configuration override. `PublicDataIsolationStartupTest` enumerates all ten names, version semantics, and negative personal aliases. Deployment starts `public-data-api.jar` and the `PublicDataApplicationKt` main class only. Run the startup gate explicitly:

Create `PublicDataAwsConfiguration.kt` with `@ConfigurationProperties("public-data")` values `awsRegion`, `governmentSecretId`, `bronzeBucket`, and `manifestSigningKeyId`. Validation requires `awsRegion == "ap-northeast-2"` and nonblank resource identifiers. It creates qualified `publicDataS3`, `publicDataKms`, and `publicDataSecretsManager` clients with `DefaultCredentialsProvider`, plus `SecretsManagerSecretResolver`, `S3ImmutablePayloadStore`, and a `KmsManifestSigner`/`ManifestVerifier` using only those qualified clients. No PUB constructor may inject an unqualified AWS client. In test, `@TestConfiguration` replaces all three clients with LocalStack/in-memory implementations; no developer credential chain is used.

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.PublicDataIsolationStartupTest"
```

Expected: both tests pass; the only datasource bean is `publicDataSource`; no personal bean/config source is loaded; all five representative personal routes return 404. Any failure blocks C0 deployment and requires the separately reviewed module split described in Step 1.

- [ ] **Step 5: Run the complete backend slice**

Run:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.PublicComparisonSliceIntegrationTest"
.\gradlew.bat :apps:core-api:test
```

Expected: `BUILD SUCCESSFUL`; the slice proves directory, price, MOHW, and KDCA publication under synthetic approvals plus drift/policy denial; the full suite passes with both live-source tests excluded. The price API returns source `curAmt` as whole KRW with the permanent caveat, and the drift run retains bronze, appends quarantine, and leaves the prior manifest active.

- [ ] **Step 6: Add the browser fixture server and failing Playwright test**

Replace Task 12's `e2e/fixtures/provider-comparison.json` contents with a complete Task 10 response. Use fixed publication `11111111-1111-4111-8111-111111111111`, retrieval `2026-08-09T00:00:00Z`, one HIRA provider, one MOHW 2024 context row, official catalog URLs, all caveats, 64-character synthetic checksums, and no source-local key.

Create `e2e/mock-api.mjs`:

```javascript
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const fixture = await readFile(new URL("./fixtures/provider-comparison.json", import.meta.url));
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:4010");
  if (request.method === "GET" && url.pathname === "/v1/public/comparisons/providers") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(fixture);
    return;
  }
  response.writeHead(404, { "content-type": "application/problem+json" });
  response.end(JSON.stringify({ code: "NOT_FOUND" }));
});
server.listen(4010, "127.0.0.1");
```

Configure `playwright.config.ts` with two web servers: `node e2e/mock-api.mjs` on 4010 and `npm run dev -- --hostname 127.0.0.1 --port 3000` on 3000 with `PUBLIC_DATA_API_BASE_URL=http://127.0.0.1:4010`.

Extend Task 12's `provider-comparison.spec.ts`:

```typescript
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("shows source-first neutral comparison without personal collection", async ({ page }) => {
  await page.goto("/compare?regionCode=110000&providerType=11");
  await expect(page.getByRole("heading", { name: "공식 의료기관 정보 비교" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("최신성 검증됨");
  await expect(page.getByRole("table", { name: "의료기관 공식 정보 비교" })).toBeVisible();
  await expect(page.getByText("가나다 종합병원")).toBeVisible();
  await expect(page.getByText(/최고|추천 순위|점수/)).toHaveCount(0);
  await expect(page.locator("input[type=file], input[name=userId], input[name=patientId]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "공식 원본 보기" }).first())
    .toHaveAttribute("href", "https://www.data.go.kr/data/15001698/openapi.do");
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
```

- [ ] **Step 7: Run the browser test to verify it fails, then complete the fixture wiring**

Run before adding `mock-api.mjs` to the Playwright web-server configuration:

```powershell
Set-Location tools/public-data-preview
npm run test:e2e
Set-Location ..\..
```

Expected: FAIL because the server-rendered API call cannot reach port 4010.

Add the two-server Playwright configuration, then rerun the same command.

Expected: one Chromium test passes and axe reports zero violations.

- [ ] **Step 8: Create the exact ingestion runbook**

Create `docs/runbooks/public-data-ingestion.md` with these executable sections:

1. Verify the committed connector record and canonical official page.
2. Run fixture contracts:

```powershell
.\gradlew.bat :apps:core-api:test --tests "*.HiraHospitalDirectoryAdapterTest" --tests "*.HiraNonCoveredPriceAdapterTest" --tests "*.MohwFacilityCountAdapterTest" --tests "*.KdcaVaccinationConditionAdapterTest"
```

3. Trigger an approved connector with a short-lived scoped token:

```powershell
$OperatorToken = Read-Host -MaskInput "short-lived OIDC token with public-data.ingest scope"
$Headers = @{ Authorization = "Bearer $OperatorToken" }
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/internal/v1/public-data/ingestions/mohw.facility-counts.v1" -Headers $Headers
Remove-Variable OperatorToken
```

4. Verify the public result and lineage:

```powershell
$Comparison = Invoke-RestMethod -Uri "http://localhost:8080/v1/public/comparisons/providers?regionCode=110000&page=0&size=20"
$Comparison.publication
$Comparison.availability
$Comparison.items | Select-Object factId,providerName,transformVersion,schemaHash
$ItemPage = Invoke-RestMethod -Uri "http://localhost:8080/v1/public/non-covered-items?query=MRI&size=20"
$ItemPage.items | Select-Object itemCode,itemName,transformVersion,schemaHash
$ItemPage.caveats
$SelectedItemCode = $ItemPage.items[0].itemCode
$Prices = Invoke-RestMethod -Uri "http://localhost:8080/v1/public/comparisons/non-covered-prices?itemCode=$SelectedItemCode&regionCode=110000&sort=PROVIDER_NAME&size=20"
$Prices.items | Select-Object factId,providerName,itemCode,currentAmountWon,currency,effectiveFrom,effectiveThrough
$Prices.caveats
Remove-Variable SelectedItemCode
```

5. Query quarantine without payload content:

```powershell
$PsqlUrl = $env:PUBLIC_DATA_JDBC_URL -replace '^jdbc:', ''
psql $PsqlUrl -c "select connector_id, schema_hash, reasons_json, occurred_at from public_reference.quarantine_event order by occurred_at desc limit 20"
Remove-Variable PsqlUrl
```

6. Rotate the government key only through the FND-owned protected secret-rotation procedure. The operator supplies the new value through that procedure's masked secret input; the procedure creates a new immutable VersionId, updates the canonical `PUBLIC_DATA_GO_KR_SECRET_ID=secret-arn#versionId=<VersionId>` projection, deploys the fixed C0 task revision, proves the resolver requested that exact VersionId, and retires the previous version only after readiness. The runbook contains no ambient AWS CLI/SDK command and never asks an operator to paste or print the secret ID/value in a shell.

The runbook explicitly states that a failed or quarantined run must not be manually copied into silver/gold, both HIRA connectors remain non-publishable in their initial state, item discovery is a literal official-name/code lookup rather than popularity/ranking/recommendation, `currentAmountWon` is not a quote/final bill/quality signal, and no operator may substitute page scraping for an official endpoint or file.

- [ ] **Step 9: Create the exact recall runbook**

Create `docs/runbooks/public-data-recall.md` with this procedure:

```powershell
$Comparison = Invoke-RestMethod -Uri "http://localhost:8080/v1/public/comparisons/providers?regionCode=110000&page=0&size=20"
$OperatorToken = Read-Host -MaskInput "short-lived OIDC token with public-data.recall scope"
$RecallBody = @{
  connectorId = "hira.hospital-directory.v1"
  publicationId = $Comparison.publication.publicationId
  reasonCode = "SOURCE_CORRECTION"
  reasonKo = "공식 원본 정정으로 현재 게시 버전을 회수합니다."
  effectiveAt = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json
$RecallResult = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/internal/v1/public-data/recalls" -Headers @{ Authorization = "Bearer $OperatorToken" } -ContentType "application/json" -Body $RecallBody
Remove-Variable OperatorToken
$After = Invoke-RestMethod -Uri "http://localhost:8080/v1/public/comparisons/providers?regionCode=110000&page=0&size=20"
$RecallResult
$After.publication
$After.availability
```

The runbook requires two-person review for `LICENSE_CHANGE` and `SECURITY_EVENT`, capture of recalled/replacement publication IDs and reason, confirmation that the old manifest still exists but cannot be served, and restoration only by a newly validated signed publication. There is no “unrecall” update.

- [ ] **Step 10: Add PUB acceptance to FND's existing CI marker**

Create `scripts/ci/public_data_acceptance.ps1`:

```powershell
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $RepoRoot
try {
  $Migrations = Get-ChildItem -LiteralPath "apps/core-api/src/main/resources/db/publicdata-migration" -Filter "V*__*.sql"
  if ($Migrations.Name -notcontains "V100__public_reference_schema.sql") { throw "PUB V100 migration is missing" }
  foreach ($Migration in $Migrations) {
    if ($Migration.Name -notmatch '^V(10[0-9]|11[0-9])__') { throw "PUB migration outside V100-V119: $($Migration.Name)" }
  }

  $Gradle = if ($IsWindows) { ".\gradlew.bat" } else { "./gradlew" }
  & $Gradle :apps:core-api:test :apps:core-api:publicDataBootJar --no-daemon
  if ($LASTEXITCODE -ne 0) { throw "PUB Gradle verification failed" }

  & rg -n 'org\.jsoup|org\.selenium|com\.microsoft\.playwright' apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata
  if ($LASTEXITCODE -eq 0) { throw "scraping/browser dependency entered PUB" }
  if ($LASTEXITCODE -gt 1) { throw "rg scraping check failed" }
  & rg -n 'kr\.co\.genomecompanion\.(identityaccount|consentpurpose|healthrecord|documentintake|exportdeletion|genome)(\.|;)' apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata
  if ($LASTEXITCODE -eq 0) { throw "personal-plane dependency entered PUB" }
  if ($LASTEXITCODE -gt 1) { throw "rg personal-plane check failed" }

  $OpenApi = Get-Content -Raw -LiteralPath "apps/core-api/src/main/resources/openapi/public-comparison.yaml"
  foreach ($OperationId in "listPublicProviders", "listNonCoveredItems", "listNonCoveredPrices", "getPublicFact") {
    $Pattern = "operationId:\s+$([regex]::Escape($OperationId))\b"
    if ([regex]::Matches($OpenApi, $Pattern).Count -ne 1) {
      throw "OpenAPI operationId must occur exactly once: $OperationId"
    }
  }
  if ($OpenApi -notmatch '(?m)^  /v1/public/non-covered-items:\s*$') {
    throw "OpenAPI non-covered item discovery path is missing"
  }
  foreach ($SchemaName in "ComparisonPage", "NonCoveredItemQuery", "NonCoveredItem", "NonCoveredItemPage", "NonCoveredPricePage", "PublicFactResponse") {
    if ($OpenApi -notmatch "(?m)^    $([regex]::Escape($SchemaName)):\s*$") {
      throw "OpenAPI public schema is missing: $SchemaName"
    }
  }

  Push-Location "tools/public-data-preview"
  try {
    npm ci
    npm run check:contract
    npm run lint
    npm test
    npm run build
    npx playwright install --with-deps chromium
    npm run test:e2e
    npm exec redocly -- lint ../../apps/core-api/src/main/resources/openapi/public-comparison.yaml
    & rg -n --glob '!**/*.test.*' 'SERVICE_KEY|DATA_GO_KR|userId|patientId|subjectId|consentId|healthRecord' src
    if ($LASTEXITCODE -eq 0) { throw "secret or personal field entered preview runtime source" }
    if ($LASTEXITCODE -gt 1) { throw "rg preview boundary check failed" }
  } finally { Pop-Location }
} finally { Pop-Location }
```

In FND-owned `.github/workflows/ci.yml`, locate the exact `# BEGIN PUB EXTENSION` / `# END PUB EXTENSION` marker pair and insert only this step between them:

```yaml
      - name: PUB public-data acceptance
        shell: pwsh
        run: ./scripts/ci/public_data_acceptance.ps1
```

Do not add or edit workflow triggers, permissions, actions, jobs, release steps, OIDC, or security scanning. The acceptance script has no secret-backed live-source path; official live smoke tests remain an explicitly approved operator action.

- [ ] **Step 11: Populate the FND-owned protected PUB release marker and emit only a verified digest handoff**

This step is blocked until FND adds and tests the inert shell. FND owns the `pub_release` job, the protected `production-kr` environment, `permissions: {contents: read, id-token: write}`, signed annotated-tag checkout/verification, AWS credential setup, ECR repository and immutable-tag policy, release role, Object-Lock evidence bucket/prefix, Buildx/BuildKit/frontend/base-image locks, post-marker verifier, and the deployment projection. The shell exposes only FND-snapshot-derived `PUBLIC_DATA_REPOSITORY_URL`, `PUBLIC_DATA_RELEASE_EVIDENCE_BUCKET`, `PUBLIC_DATA_RELEASE_EVIDENCE_PREFIX`, `PUBLIC_DATA_BUILDX_BUILDER`, `PUBLIC_DATA_RUNTIME_IMAGE`, `FOUNDATION_OUTPUTS_SNAPSHOT_JSON`, `SIGNED_RELEASE_TAG_VERIFICATION_JSON`, and the exact signed-tag verification coordinate. `PUBLIC_DATA_RUNTIME_IMAGE` is the immutable Linux/amd64 repository@digest that byte-equals the snapshot runtime lock. It also installs the FND-owned `tooling/fnd-workstream-release` frozen environment; every ECR/S3-capable command must run through `python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen python ...`. It contains exactly one `# BEGIN PUB RELEASE STEPS` / `# END PUB RELEASE STEPS` pair. PUB may replace only the no-op lines inside that pair and has no Terraform, ECS, IAM, repository-management, tag-mutation, or deployment permission.

Write `test_public_data_image_release.py` first for the strict schema, self-digest, build-metadata/provenance bindings, conditional Object-Lock writes, exact-VersionId reads, four-output emission, container policy, exact FND boto3/botocore versions, and every rejection named below. Run `python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen python -m unittest scripts.release.test_public_data_image_release -v`; RED is the missing schema, Dockerfile, release module, or locked-client binding. Do not populate the protected marker until that named RED is observed.

Create `apps/core-api/Dockerfile.publicdata` as a digest-pinned Linux/amd64 two-stage image. The builder copies only locked Gradle inputs plus public-data sources and runs `:apps:core-api:publicDataBootJar`; the final stage uses the exact FND runtime-image digest, copies only `/app/public-data-api.jar`, removes inherited SUID/SGID bits in the single reviewed hardening command, sets numeric `USER 65532:65532`, and has exec-form `ENTRYPOINT ["java","-jar","/app/public-data-api.jar"]`. It contains no shell/package download in the final stage, personal configuration, test fixture, credential, compiler, or second JAR. `Dockerfile.publicdata.dockerignore` is an allowlist for those inputs. Container-policy tests inspect the Dockerfile, image contents, numeric user, entrypoint, setuid/setgid absence, and an isolated startup with `SPRING_CONFIG_NAME=application-publicdata`.

`public-data-image-handoff.schema.json` has `additionalProperties:false` and exactly `{schemaVersion:"public-data-image-handoff.v1",sourceSha,signedTag,tagVerificationSha256,repository,imageDigest,runtimeImageDigest,buildxSha256,buildkitImageDigest,dockerfileFrontendDigest,sbom:{key,versionId,sha256},provenance:{key,versionId,sha256},signatureBundle:{key,versionId,sha256},attestationBundle:{key,versionId,sha256},cosignVersion:"v3.0.6",createdAt,handoffSha256}`. Every digest is lowercase `sha256:`, the image is repository plus immutable digest rather than a tag, all object coordinates require an exact VersionId, and `handoffSha256` is SHA-256 over RFC 8785 canonical JSON omitting only itself. `public_data_image_release.py` strict-loads JSON without duplicate keys and has exactly `image-digest`, `build-provenance`, `build-handoff`, `verify-handoff`, and `upload-evidence` subcommands. It recomputes every local file digest and the self-digest and rejects an unexpected field, mutable image, wrong repository/source/tag/tool lock, absent VersionId, or path/symlink outside its supplied staging directory. It never signs, pushes, assumes a role, or deploys; only `upload-evidence` may write and exact-version re-read the FND-projected evidence prefix. Its tests mutate every field and boundary.

Replace only the FND marker body with these executable steps; FND setup provides Bash, Python 3.12.13, Java 21, Node 24 where required, the locked Docker daemon, and the exact environment values above:

```yaml
      # BEGIN PUB RELEASE STEPS
      - name: PUB verify, build, scan, push, sign, and hand off
        id: pub_image_handoff
        shell: bash
        env:
          DOCKER_CONFIG: ${{ runner.temp }}/pub-docker
        run: |
          set -Eeuo pipefail
          trap 'docker logout "${PUBLIC_DATA_REPOSITORY_URL%%/*}" >/dev/null 2>&1 || true; rm -rf -- "$DOCKER_CONFIG"' EXIT
          test "$GITHUB_SHA" = "$(git rev-parse 'HEAD^{commit}')"
          test -n "$PUBLIC_DATA_REPOSITORY_URL"
          test -n "$PUBLIC_DATA_RELEASE_EVIDENCE_BUCKET"
          test -n "$PUBLIC_DATA_RELEASE_EVIDENCE_PREFIX"
          test -n "$PUBLIC_DATA_RUNTIME_IMAGE"
          pwsh -File scripts/ci/public_data_acceptance.ps1
          bash scripts/ci/install_security_tools.sh
          python scripts/ci/install_buildx.py --destination build/tools/docker-cli-plugins
          export DOCKER_CLI_PLUGIN_EXTRA_DIRS="$GITHUB_WORKSPACE/build/tools/docker-cli-plugins"
          test "$(build/tools/docker-cli-plugins/docker-buildx version | awk '{print $2}')" = "v0.20.1"
          python scripts/ci/install_cosign.py --destination build/tools/cosign
          COSIGN="$GITHUB_WORKSPACE/build/tools/cosign/cosign"
          TRUSTED_ROOT="$GITHUB_WORKSPACE/build/tools/cosign/trusted_root.json"
          test "$($COSIGN version --json | python -c 'import json,sys; print(json.load(sys.stdin)["gitVersion"])')" = "v3.0.6"
          test -f "$TRUSTED_ROOT"
          build/tools/security/gitleaks detect --source . --no-banner --redact --exit-code 1
          build/tools/security/trivy fs --exit-code 1 --severity HIGH,CRITICAL --scanners vuln,secret,misconfig .
          mkdir -p "$DOCKER_CONFIG" build/release/public-data
          python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen \
            python scripts/release/fnd_workstream_aws.py ecr-login \
            --repository "$PUBLIC_DATA_REPOSITORY_URL" --docker-config "$DOCKER_CONFIG"
          SOURCE_TAG="$(git describe --tags --exact-match --match 'v[0-9]*.[0-9]*.[0-9]*')"
          IMAGE_TAG="${PUBLIC_DATA_REPOSITORY_URL}:${GITHUB_SHA}"
          docker buildx build --builder "$PUBLIC_DATA_BUILDX_BUILDER" --platform linux/amd64 \
            --file apps/core-api/Dockerfile.publicdata --provenance=false --sbom=false \
            --build-arg "PUBLIC_DATA_RUNTIME_IMAGE=$PUBLIC_DATA_RUNTIME_IMAGE" \
            --metadata-file build/release/public-data/build-metadata.json \
            --tag "$IMAGE_TAG" --load .
          build/tools/security/trivy image --exit-code 1 --severity HIGH,CRITICAL "$IMAGE_TAG"
          build/tools/security/trivy image --format cyclonedx --output build/release/public-data/sbom.cdx.json "$IMAGE_TAG"
          docker push "$IMAGE_TAG"
          IMAGE_DIGEST="$(python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen \
            python scripts/release/public_data_image_release.py image-digest \
            --metadata build/release/public-data/build-metadata.json \
            --repository "$PUBLIC_DATA_REPOSITORY_URL" --tag "$GITHUB_SHA" --region ap-northeast-2)"
          IMAGE_REF="${PUBLIC_DATA_REPOSITORY_URL}@${IMAGE_DIGEST}"
          python scripts/release/public_data_image_release.py build-provenance \
            --image "$IMAGE_REF" --source-sha "$GITHUB_SHA" --signed-tag "$SOURCE_TAG" \
            --foundation-snapshot "$FOUNDATION_OUTPUTS_SNAPSHOT_JSON" \
            --build-metadata build/release/public-data/build-metadata.json \
            --sbom build/release/public-data/sbom.cdx.json \
            --output build/release/public-data/provenance.json
          "$COSIGN" sign --yes --bundle build/release/public-data/signature.bundle.json \
            --new-bundle-format=true --use-signing-config=true "$IMAGE_REF"
          "$COSIGN" attest --yes --bundle build/release/public-data/attestation.bundle.json \
            --new-bundle-format=true --use-signing-config=true --type slsaprovenance \
            --predicate build/release/public-data/provenance.json "$IMAGE_REF"
          python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen \
            python scripts/release/public_data_image_release.py upload-evidence \
            --bucket "$PUBLIC_DATA_RELEASE_EVIDENCE_BUCKET" --prefix "$PUBLIC_DATA_RELEASE_EVIDENCE_PREFIX" \
            --source-sha "$GITHUB_SHA" --signed-tag "$SOURCE_TAG" \
            --repository "$PUBLIC_DATA_REPOSITORY_URL" --image-digest "$IMAGE_DIGEST" \
            --tag-verification "$SIGNED_RELEASE_TAG_VERIFICATION_JSON" \
            --foundation-snapshot "$FOUNDATION_OUTPUTS_SNAPSHOT_JSON" \
            --sbom build/release/public-data/sbom.cdx.json \
            --provenance build/release/public-data/provenance.json \
            --signature-bundle build/release/public-data/signature.bundle.json \
            --attestation-bundle build/release/public-data/attestation.bundle.json \
            --handoff build/release/public-data/handoff.json \
            --github-output "$GITHUB_OUTPUT"
      # END PUB RELEASE STEPS
```

The `image-digest`, `build-provenance`, and `upload-evidence` operational subcommands above are the orchestration modes of the same strict script; they accept exactly the displayed options. Every AWS-capable mode imports only the exact boto3/botocore versions locked by FND's `tooling/fnd-workstream-release`; no ambient SDK or executable is permitted. `image-digest` uses `ecr:BatchGetImage` for exactly the projected repository and just-pushed SHA tag, requires one Linux/amd64 OCI manifest, and cross-checks its config/layer/build-metadata identity before returning the registry digest. `upload-evidence` performs content-addressed pinned-boto3 `PutObject` calls with `IfNoneMatch="*"`, checksum SHA-256, and Object Lock retention, captures each returned VersionId, builds/verifies the handoff, uploads it the same way, exact-fetches all five VersionIds, and appends exactly `public_data_image_digest`, `public_data_handoff_key`, `public_data_handoff_version_id`, and `public_data_handoff_sha256` to the supplied existing `GITHUB_OUTPUT`. It rejects an absent Object-Lock result, unversioned write, prefix escape, existing-different object, registry/repository mismatch, newline/control output injection, or any non-`sha256:` digest. Tests assert the locked boto3/botocore versions, use fake botocore clients to prove exact-tag resolution, conditional writes, exact-version reads, retry idempotence, and no ambient repository/bucket/key selection, and reject raw `aws`, `aws.exe`, `s3api`, direct Docker credential piping, or an unwrapped ECR/S3-capable release invocation.

After the marker, FND—not PUB—exact-fetches the handoff and its four evidence coordinates and independently compares them to the signed-tag verification and protected snapshot. Using only FND's `/opt/gc/bin/cosign`, it first requires `cosign version --json` to report exactly `v3.0.6`, then runs `verify --offline=true --new-bundle-format=true --trusted-root /opt/gc/sigstore/trusted_root.json` and `verify-attestation --offline=true --new-bundle-format=true --trusted-root /opt/gc/sigstore/trusted_root.json --type slsaprovenance` against the exact image digest. It requires issuer `https://token.actions.githubusercontent.com` and the certificate identity formed byte-for-byte as `"https://github.com/" + snapshot.outputs.release_repository_owner + "/" + snapshot.outputs.release_repository_name + "/.github/workflows/release.yml@refs/tags/" + signedTagVerification.tag`, with no regex, caller-supplied owner/repository/tag/root, PATH Cosign, online verification, or legacy bundle. Only that verifier may project `public_data_image_digest` into the FND-owned deployment input; the job fails before deployment on any mismatch. Re-run the named unit test and an FND dry-run with fake ECR/S3/OIDC fixtures; GREEN requires every handoff assertion and the independent post-marker rejection matrix to pass without an ECS/Terraform call from PUB.

On a fresh account, the FND shell already exists at desired zero with its immutable placeholder and disabled route; PUB supplies no Terraform image input. The first independently verified handoff causes only FND's authority to register the fixed real C0 task and scale to two, with failure restoring zero. A later handoff must name the exact current digest and failure restores the exact prior revision/digest/count. The authority copies the ten-name environment/secret set byte-for-byte and changes only the image digest; PUB cannot supply an environment, secret, command, role, service, family, network, route, count, or rollback target.

- [ ] **Step 12: Run the full verification suite**

Run from the repository root:

```powershell
.\gradlew.bat :apps:core-api:clean :apps:core-api:test :apps:core-api:bootJar :apps:core-api:publicDataBootJar
Set-Location tools/public-data-preview
npm ci
npm run check:contract
npm run lint
npm test
npm run build
npm run test:e2e
npm exec redocly -- lint ../../apps/core-api/src/main/resources/openapi/public-comparison.yaml
Set-Location ..\..
pwsh -File scripts/ci/public_data_acceptance.ps1
python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen python -m unittest scripts.release.test_public_data_image_release -v
git diff --check
```

Expected:

- Gradle reports `BUILD SUCCESSFUL` with both live-source tests excluded; both `core-api.jar` and isolated `public-data-api.jar` build.
- Vitest and Playwright report all tests passing.
- Next.js completes a production build.
- Contract generation is clean; Redocly reports a valid OpenAPI contract with all four frozen operation IDs and no errors.
- The PUB acceptance script passes its migration-range, isolation, no-scraping, no-personal-plane, API, and preview checks.
- The image handoff tests pass, and the protected release dry-run proves exact FND tool locks, new-format Cosign 3.0.6 bundles, immutable digest, Object-Lock VersionIds, and four-output handoff without deployment authority.
- `git diff --check` produces no output.

- [ ] **Step 13: Commit the completed vertical slice evidence**

```powershell
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/operations apps/core-api/src/main/kotlin/kr/co/genomecompanion/publicdata/config/PublicDataAwsConfiguration.kt apps/core-api/src/main/resources/application-publicdata.yml apps/core-api/src/main/resources/openapi/public-comparison.yaml apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/boundary apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/pipeline apps/core-api/src/test/kotlin/kr/co/genomecompanion/publicdata/support/ComparisonTestFixtures.kt apps/core-api/Dockerfile.publicdata apps/core-api/Dockerfile.publicdata.dockerignore packages/contracts/jsonschema/public-data-image-handoff.schema.json packages/contracts/fixtures/public-data-image-handoff.valid.json tools/public-data-preview/e2e tools/public-data-preview/playwright.config.ts scripts/ci/public_data_acceptance.ps1 scripts/release/public_data_image_release.py scripts/release/test_public_data_image_release.py .github/workflows/ci.yml .github/workflows/release.yml docs/runbooks
git commit -m "test(pub): prove isolated public comparison slice"
```

---

## Acceptance checklist

- [ ] The production connector registry contains exactly four governed runtime source records (two HIRA, one MOHW, one KDCA) and no catalog-page fetch target.
- [ ] HIRA `15001698` can validate in development but cannot activate production gold while its committed state is `DEVELOPMENT_ONLY` with third-party rights.
- [ ] HIRA `15001700` can validate only from signed directory seed keys and cannot activate production gold without its own connector-specific rights approval; `curAmt` maps exactly to nonnegative whole-won `currentAmountWon` with no quote/final-bill/quality semantics.
- [ ] MOHW `15098823` and KDCA `15084296` publish only after the same registry policy, schema, provenance, signing, and freshness gates.
- [ ] KDCA Type 4 `15139178` remains a policy-denial fixture and cannot publish.
- [ ] Every acquired byte sequence is stored in bronze before parsing and addressed by SHA-256.
- [ ] Bronze, silver, gold, manifests, quarantine, source-state, pointer, and recall history are retained; mutations of append-only relations fail at the database.
- [ ] Schema drift, missing required fields, unexpected fields, duplicate identities, count mismatches, conflicting official `npayKorNm` values for one `npayCd`, unsafe XML, and disallowed content types produce quarantine and no new active version.
- [ ] Public provider results are alphabetically ordered after public filtering, never scored or presented as a recommendation.
- [ ] `GET /v1/public/non-covered-items` requires a nonblank `query` of `1..80` characters, accepts only `query`, opaque `cursor`, and bounded `size`, returns exact official item code/name pairs with publication/availability/source/provenance/caveats, deduplicates by code, and orders by official item name then code without popularity, recommendation, ranking, synonyms, or fuzzy inference.
- [ ] Non-covered-price results require an exact item code, preserve effective dates and KRW amount, default to provider-name order, and use amount order only after explicit `AMOUNT_ASC`/`AMOUNT_DESC`; neither order is a recommendation.
- [ ] Every returned item includes official agency, dataset, catalog URL, source period, retrieval time, license/attribution, bronze checksum, transform version, schema hash, comparability, and caveats.
- [ ] Stale and quarantine states identify the last safe version; expired, disabled, unsigned, and recalled-without-replacement states fail closed.
- [ ] Recall requires `SCOPE_public-data.recall`, records JWT subject, preserves the recalled manifest, and rolls back only to a signed non-recalled predecessor.
- [ ] Public API and web source contain no government key, personal identifier, account, consent, document, health record, genome, upload, or personal analytics field.
- [ ] Architecture and CI checks reject HTML scraping libraries and personal-plane imports in the public-data application.
- [ ] `PublicDataIsolationStartupTest` proves C0 loads only `application-publicdata`, exactly one `publicDataSource`, no personal bean package, and 404s for representative personal routes; only `public-data-api.jar` is deployable with the C0 identity.
- [ ] The protected FND `pub_release` shell builds only that C0 artifact, scans it, creates a CycloneDX SBOM and bound provenance, pushes/signs/attests the immutable digest with only FND-installed Cosign v3.0.6 new-format bundles, Object-Lock stores exact-Version evidence, and lets only the FND verifier project `public_data_image_digest`.
- [ ] The Korean web page renders source, freshness, caveats, and recall in accessible text, passes axe, and contains no “best,” recommendation score, booking, or referral action.
- [ ] The full Gradle, Vitest, ESLint, Next.js, Playwright, OpenAPI, and whitespace checks pass from a clean checkout.

## Execution handoff

Plan execution has two supported modes:

1. **Subagent-Driven (recommended):** use `superpowers:subagent-driven-development`, dispatch a fresh worker for each task, and perform specification and code-quality review before advancing.
2. **Inline Execution:** use `superpowers:executing-plans`, execute tasks in order, and stop at the test/commit checkpoint after each task for review.

Do not begin with HIRA production enablement. The first executable implementation work is Task 1; each HIRA connector's production status changes only through its own separately reviewed connector-record change after operational approval and connector-specific rights evidence exists.
