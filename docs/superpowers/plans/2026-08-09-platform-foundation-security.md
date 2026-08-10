# Platform Foundation and Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a test-first Korea-only platform foundation that can accept sensitive health workloads only after its identity, consent, telemetry, deployment, supply-chain, backup, restore, deletion, and compliance-control evidence has been produced and independently reviewable.

**Architecture:** Build one pinned Kotlin/Spring Boot modular-monolith project whose personal `core-api.jar` and PUB-owned `publicDataBootJar` are separate deployable artifacts behind separate private ECS Fargate services in an AWS Seoul multi-account environment. The personal bootstrap is authenticated; the C0 `PublicDataApplication` scans only `publicdata`, loads only `application-publicdata`, and receives a distinct runtime identity. WAF/API Gateway, PostgreSQL, purpose-specific KMS keys, and strongly separated organization, security, log, workload, research, and backup accounts protect the personal plane. The first increment stores only account, consent, security-audit, and deletion-control data; later product modules consume the narrow ports defined here. Korean personal data never leaves `ap-northeast-2`, document cloud processing requires explicit consent, MyHealthWay remains post-MVP, source documents are deleted immediately after verification, and a future US launch receives a separate data plane.

**Tech Stack:** Eclipse Temurin 21.0.8+9, Kotlin 2.2.20, Gradle 8.14.3, Spring Boot 3.5.7, HAPI FHIR 8.10.1, PostgreSQL 16.10, Flyway, JUnit 5, ArchUnit 1.4.1, Testcontainers 1.21.3, Python 3.12.13, uv 0.12.3, boto3 1.43.53, cryptography 50.0.0, pytest 9.1.1, OpenTelemetry, OpenTofu 1.10.6, AWS Organizations/IAM/KMS/VPC/API Gateway/ECS/RDS/S3/CloudTrail/Config/GuardDuty/Security Hub/Backup/Amazon Managed Service for Prometheus, GitHub Actions OIDC, Trivy 0.66.0, Gitleaks 8.28.0, Cosign 3.0.6, and CycloneDX.

## Global Constraints

- Source design: `docs/superpowers/specs/2026-08-08-genome-companion-program-design.md`; decisions 1–8 are approved.
- Shared monorepo version contract: Eclipse Temurin 21.0.8+9, Kotlin 2.2.20, Gradle 8.14.3, Spring Boot 3.5.7, HAPI FHIR 8.10.1, ArchUnit 1.4.1, Testcontainers 1.21.3, PostgreSQL 16.10, Python 3.12.13, uv 0.12.3, boto3 1.43.53, cryptography 50.0.0, pytest 9.1.1, OpenTofu 1.10.6, AWS provider 6.10.0, Trivy 0.66.0, Gitleaks 8.28.0, and Cosign 3.0.6. The root catalog, Spring Boot BOM, committed Gradle lockfile, and each explicit uv project/lock are the dependency contracts; UX, AI, PUB, and REC may change shared pins only through one reviewed root-level dependency PR and cannot override versions in workstream builds.
- Flyway migration ownership is disjoint: foundation owns `V1`–`V19`, PUB owns `V100`–`V119`, and REC owns `V200`–`V219`. CI rejects duplicates or migrations outside the owning workstream's range.
- Lead product is the annual-checkup/record companion; no diagnosis, prescribing, autonomous referral, raw genomics, family delegation, advertising SDK, or model training on personal data enters this plan.
- HAPI FHIR is the only selected FHIR core. This foundation proves HAPI R4 startup; KR Core profiles and clinical resources arrive in a separate clinical-data plan.
- Building the personal timeline requires the exact `BUILD_PERSONAL_LAB_TIMELINE` operation set `{COLLECT, EXPLAIN}`. Upload/cloud extraction additionally requires a distinct, active `PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD` grant with the exact set `{COLLECT, EXTRACT, NORMALIZE}` and the declared Korean processor set; neither grant substitutes for the other. Retained source storage requires a separate reversible `RETAIN_VERIFIED_SOURCE`/`RETAIN` grant; it is absent by default, so the source is deleted at verification completion with a 24-hour lifecycle backstop.
- MyHealthWay is not launch-critical and has no connector or credential in this plan.
- All personal-health infrastructure, logs, backups, support access, and keys remain in AWS Seoul (`ap-northeast-2`). No overseas replication, support path, CDN, LLM, or disaster-recovery copy is allowed.
- C0 public data and C2/C3 personal data use different accounts, storage, keys, identities, logs, and lifecycle policies. C4 genetic data has no server API or storage resource.
- Foundation reserves one C0 seam and does not create a competing bootstrap or query contract: PUB owns exactly `kr.co.genomecompanion.publicdata.PublicDataApplication`, `publicDataBootJar` (`public-data-api.jar`), and `application-publicdata`. The foundation architecture rule applies when PUB adds the package, and production remains disabled until PUB's `PublicDataIsolationStartupTest` proves no personal beans/routes/config. The C0 ECS identity uses only `PUBLIC_DATA_*` credentials and cannot read or reach the personal plane.
- Only synthetic records may be used in development, tests, CI, deployment smoke tests, and restore exercises until counsel, privacy, MFDS, and founder release gates are recorded.
- TLS 1.3 is preferred and TLS 1.2 is the minimum. Compute and databases have no public IP. Long-lived cloud credentials are prohibited.
- Every personal request is authenticated and authorized by subject, object, action, purpose, consent, region, and time. Network location is never an authorization fact.
- `EXPORT_RECORDS` and `RESET_PROFILE` require their distinct scope plus a KR-plane JWT whose `auth_time` is no more than five minutes old. The issuer deployment itself is release-gated to Cognito `mfa_configuration=ON`, local Cognito users only, no federated IdPs, and TOTP enrollment; the API does not invent an `amr` claim that Cognito cannot attest per session. Authorization never logs or returns the raw token.
- Core-to-worker authorization uses 120-second Ed25519 JWTs. A service token has `iss=genome-companion-core-api`, `aud=explanation-worker`, `sub=core-api`, `iat`, and `exp`; a consent-bound purpose token has the same `iss`/`aud`/`iat`/`exp` plus unique `jti`, opaque `sub`, and `purpose=personal_record_explanation`. Neither token contains a Cognito subject, consent text, or health value.
- Logs and telemetry contain no request or response body, report text, lab value, genetic trait, free-text question, email, phone, name, raw subject identifier, token, cookie, upload key, or signed URL.
- Consent revocation is grant-scoped, not profile-scoped. `consent.revoked.v1` may delete only artifacts attributable to that consent ID and purpose; only an explicit profile reset uses `ProfileScope` and can erase the whole profile.
- Audit controls are described as tamper-evident and tamper-resistant, never tamper-proof. Immutable stores contain only pseudonymous security metadata and signed digests, not medical content.
- Do not claim end-to-end encryption for server-processed data. The server path uses TLS plus envelope encryption; true E2EE is reserved for a later endpoint-only design.
- MVP service objectives are RPO at most 15 minutes and RTO at most 4 hours. Database PITR is 14 days; cross-account recovery points expire after 30 days; active-system deletion completes within 24 hours; restored data is subject to deletion-tombstone replay before serving traffic.
- Production changes require two-person review. Critical internet-facing or actively exploited findings are fixed or isolated within 24 hours, other critical findings within 72 hours, and high findings within 14 days.
- Do not apply organization or production OpenTofu from a developer workstation. CI plans with read-only roles; a protected production environment performs apply with short-lived OIDC credentials and human approval.
- Every use of uv consumes the foundation-owned `supply-chain/tool-artifacts.lock.json` and `scripts/ci/install_uv.py`; `pip install uv`, an unverified release archive, a mutable installer URL, and a duplicate workstream uv lock are prohibited.
- AI governance signing is a Seoul-only foundation security service for public governance bytes only. It accepts no PHI, URL, caller-selected key ARN, private-key input, arbitrary domain, or network provider, and it never places private key bytes in Step Functions state, OpenTofu state, an environment variable, a file, a log, or a result.

---

## Approved decision translation

| Founder decision | Foundation consequence |
|---|---|
| Checkup/record companion leads | The API has no genome, diagnosis, prescription, or referral route. |
| Consumer-paid/fixed-fee model | Entitlement is outside this foundation and cannot read health modules when added. |
| Explicit-consent cloud processing | `BUILD_PERSONAL_LAB_TIMELINE` is exactly `{COLLECT, EXPLAIN}`; cloud processing is separately `{COLLECT, EXTRACT, NORMALIZE}`; verified-source retention is separately `{RETAIN}`. Upload requires both the timeline and cloud grants, while retention remains independently reversible. |
| HAPI FHIR selected | HAPI 8.10.1 R4 startup is pinned; no Medplum dependency is admitted. |
| MyHealthWay after MVP | No MyHealthWay network route, secret, scope, or connector exists. |
| Immediate source deletion | Verification emits deletion immediately unless an active, separately revocable `RETAIN_VERIFIED_SOURCE` grant exists; S3 expires missed objects after 24 hours. |
| Korea-only personal plane | All C2/C3 resources and recovery points are region-locked to Seoul. |
| Midnight Evidence Ledger approved | UI implementation is outside this platform plan; API error and provenance contracts remain accessible and deterministic. |

## File map

Every path below is relative to the repository root. No existing planning artifact is modified during implementation.

### Repository and build

| Path | Responsibility |
|---|---|
| `.editorconfig` | UTF-8, LF, final newline, Kotlin/YAML/HCL indentation. |
| `.gitattributes` | Normalize text and mark the Gradle wrapper JAR binary. |
| `.gitignore` | Preserve existing entries and append build, OpenTofu state, local-secret, test-artifact, and generated-evidence exclusions. |
| `settings.gradle.kts` | Declare the monorepo and the `apps:core-api` build. |
| `build.gradle.kts` | Pin shared plugins and group/version policy. |
| `gradle/libs.versions.toml` | Single version catalog for application and test dependencies. |
| `gradle/wrapper/gradle-wrapper.properties` | Pin Gradle 8.14.3 and its distribution checksum. |
| `gradle/wrapper/gradle-wrapper.jar` | Generated Gradle bootstrap binary. |
| `gradlew` | Generated POSIX wrapper. |
| `gradlew.bat` | Generated Windows wrapper. |
| `scripts/tests/test_repository_layout.py` | Verify required roots, pinning, and absence of local state/secrets. |
| `scripts/tests/test_install_uv.py` | Prove the uv installer enforces the foundation lock, exact archive shape, host, size, and SHA-256. |
| `scripts/ci/install_uv.py` | Install uv 0.12.3 only from one platform row in the foundation artifact lock. |
| `scripts/tests/test_install_bundletool.py` | Prove the bundletool installer enforces the foundation lock, exact GitHub asset host/size/SHA-256, and atomic jar placement. |
| `scripts/ci/install_bundletool.py` | Install bundletool 1.18.1 only from the FND-owned immutable artifact row. |
| `scripts/tests/test_install_android_sdk.py` | Prove the Android SDK/AVD installer accepts only the locked Linux API 35 profile and verifies every archive before extraction. |
| `scripts/ci/install_android_sdk.py` | Install the exact API 35 platform/build tools/emulator/google_apis x86_64 image and create either approved CI AVD without `sdkmanager`. |
| `scripts/tests/test_install_buildx.py` | Prove the Buildx installer and UX builder use only the locked binary, BuildKit image, and Dockerfile frontend digests. |
| `scripts/ci/install_buildx.py` | Install Docker Buildx 0.20.1 as one verified CLI plugin on Linux amd64. |
| `scripts/tests/test_install_opentofu.py` | Prove the OpenTofu installer accepts only the locked 1.10.6 Linux amd64 release archive. |
| `scripts/ci/install_opentofu.py` | Install the OpenTofu 1.10.6 binary used inside the FND UX deployment authority image. |
| `scripts/tests/test_build_product_provider_mirror.py` | Prove the Product plan can materialize only the AWS provider package pinned by the two byte-equal OpenTofu lockfiles. |
| `scripts/ci/build_product_provider_mirror.py` | Verify and stage the one offline linux/amd64 AWS provider package consumed by the FND UX deployment authority. |
| `supply-chain/tool-artifacts.lock.json` | FND-owned exact uv, bundletool, Android SDK, Buildx, BuildKit, Dockerfile-frontend, OpenTofu, Cosign/trusted-root, and AWS-provider versions/URLs/sizes/platform manifests/checksums. |
| `infra/modules/.gitkeep` | Preserve the infrastructure root until Task 6 adds modules. |
| `ops/.gitkeep` | Preserve the operations root until Task 5 adds collector policy. |

### Core API and module contracts

| Path | Responsibility |
|---|---|
| `apps/core-api/build.gradle.kts` | Kotlin/Spring/HAPI/test dependencies and deterministic JAR name. |
| `apps/core-api/gradle.lockfile` | Exact resolved dependency graph shared by every JVM workstream. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/CoreApiApplication.kt` | Personal-plane application entry point; never used by the PUB artifact. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/healthrecord/api/HealthRecordQuery.kt` | Future consented-record read port. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/documentintake/api/DocumentIntakePort.kt` | Future quarantine/verification port constructed only from dual-grant authorization evidence. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion/api/ProfileDeletionPort.kt` | Stable profile-deletion request port. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/ApplicationSmokeTest.kt` | Prove Spring and HAPI R4 start together. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/architecture/ModuleBoundaryTest.kt` | Enforce module/data-plane imports and logging restrictions. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/architecture/ProhibitedRouteTest.kt` | Fail if excluded medical/genomic routes appear. |

### Identity, consent, and persistence

| Path | Responsibility |
|---|---|
| `apps/core-api/src/main/resources/application.yml` | Fail-closed runtime settings; no payload logging. |
| `apps/core-api/src/test/resources/application-test.yml` | Offline test issuer/JWK configuration and synthetic database settings. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/api/CallerPrincipal.kt` | Typed authenticated subject, scopes, and KR region. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/OidcProperties.kt` | Validated issuer, JWK URI, and audience properties. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/AudienceValidator.kt` | Reject tokens for another client. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/JwtConfiguration.kt` | Build issuer/audience-validating decoder. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/SecurityConfiguration.kt` | Stateless deny-by-default HTTP policy. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/CallerPrincipalResolver.kt` | Convert verified JWT authentication to `CallerPrincipal`. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/api/SensitiveActionAuthorizer.kt` | Step-up contract for export and profile reset. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/JwtSensitiveActionAuthorizer.kt` | Require action scope, fresh `auth_time`, exact issuer/client/resource, and KR-plane binding. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/SensitiveActionProblemHandler.kt` | Stable RFC 9457 assurance problem for UX step-up handling. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/SecurityConfigurationTest.kt` | Negative and positive JWT/API tests. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/SensitiveActionAuthorizerTest.kt` | Reject stale, weak, wrong-scope, wrong-region, or unvalidated sensitive actions. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/SensitiveActionProblemHandlerTest.kt` | Lock the 403 code and assurance metadata without token echo. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/workload/WorkloadTokenContracts.kt` | Exact Ed25519 service/purpose JWT contract for bounded workers. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/workload/Ed25519WorkloadTokenIssuer.kt` | Sign short-lived worker JWTs from a secret-injected PKCS#8 key. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/WorkloadTokenIssuerTest.kt` | Verify signature, claim shape, opaque subject, and 120-second lifetime. |
| `packages/contracts/jsonschema/signed-workload-jwks-release.schema.json` | FND-owned signed public-key release consumed read-only by AI workers. |
| `packages/contracts/jsonschema/workload-jwks-root-registry.schema.json` | Strict monotonic public registry for broker-owned workload-release roots. |
| `packages/contracts/jsonschema/signed-workload-jwks-root-registry.schema.json` | Prefixed broker-signature wrapper for the workload root registry. |
| `scripts/security/build_workload_jwks_documents.py` | Deterministically build public-only release and registry documents; never accepts a private key. |
| `scripts/security/workload_jwks_ceremony.py` | Stage, dual-approve, broker-sign, verify, and atomically publish workload key releases. |
| `scripts/security/verify_workload_jwks_release.py` | Verify broker root, exact prefix, signature, sequence/digest, roles, and transition. |
| `governance/cryptographic/workload-jwks-public-input.json` | Reviewed public workload key rows; no signing key material. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/api/ConsentContracts.kt` | Public grant/list/revoke and purpose-authorization types. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/domain/ConsentGrant.kt` | Consent aggregate and revocation rules. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/application/ConsentApplicationService.kt` | Transactional consent and outbox use cases. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/application/ConsentReceiptSigner.kt` | Canonical SHA-256 receipt generation. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/application/ConsentBoundPurposeTokenAdapter.kt` | Require active `EXPLAIN` consent before issuing an AI purpose token. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/adapter/in/web/ConsentController.kt` | `/v1/consents` endpoints; subject comes only from JWT. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/adapter/out/jdbc/ConsentJdbcRepository.kt` | Subject-scoped PostgreSQL persistence. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/outbox/OutboxContracts.kt` | Durable domain-event write/read contracts. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/outbox/OutboxJdbcRepository.kt` | PostgreSQL outbox adapter. |
| `apps/core-api/src/main/resources/db/migration/V1__fnd_consent_and_outbox.sql` | Consent and outbox schema, constraints, and indexes. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose/ConsentApplicationServiceTest.kt` | Grant, expiry, authorization, idempotent revocation, and receipt tests. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose/ConsentBoundPurposeTokenAdapterTest.kt` | Prove only active explanation consent can mint an opaque worker token. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose/ConsentControllerTest.kt` | Subject isolation and HTTP contract tests. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose/ConsentJdbcRepositoryTest.kt` | Testcontainers persistence and isolation tests. |
| `packages/contracts/openapi/consent-api-v1.yaml` | Foundation-owned OpenAPI 3.1 source for generated consent clients and sensitive-action problem types. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/contract/ConsentOpenApiContractTest.kt` | Keep operation IDs, native enums, receipt fields, scopes, and step-up assurance in sync. |

### PHI-safe telemetry and audit

| Path | Responsibility |
|---|---|
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/telemetry/SafeTelemetry.kt` | Closed telemetry event and attribute vocabulary. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/telemetry/PhiSafeLogger.kt` | Fixed-message structured logging with safe MDC keys only. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/telemetry/CorrelationFilter.kt` | Generate/validate correlation IDs without logging headers or bodies. |
| `apps/core-api/src/main/resources/logback-spring.xml` | Emit the allowlisted structured log fields. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/audit/api/AuditContracts.kt` | Pseudonymous security-audit event contract. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/audit/application/AuditChain.kt` | Canonical event hashing and chain verification. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/audit/adapter/out/jdbc/AuditJdbcRepository.kt` | Append-only audit persistence. |
| `apps/core-api/src/main/resources/db/migration/V2__fnd_security_audit.sql` | Append-only audit table and mutation-denial trigger. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/platform/telemetry/PhiSafeLoggerTest.kt` | Prove prohibited values cannot enter application logs. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/audit/AuditChainTest.kt` | Prove mutation, deletion, and reordering are detected. |
| `ops/otel/collector.yaml` | Collector-side attribute allowlist and region-local exporters. |
| `ops/otel/test_collector_policy.py` | Parse and verify the collector policy. |

### AWS/OpenTofu

| Path | Responsibility |
|---|---|
| `infra/versions.tf` | Pin OpenTofu and AWS provider versions. |
| `infra/modules/organization/variables.tf` | Existing management account and seven member-account inputs. |
| `infra/modules/organization/main.tf` | OUs and security/workload/research member accounts. |
| `infra/modules/organization/scp.tf` | Seoul region lock and security-service tamper guardrails. |
| `infra/modules/organization/outputs.tf` | Sensitive account-ID map for downstream stacks. |
| `infra/modules/organization/tests/organization.tftest.hcl` | Mock-provider organization assertions. |
| `infra/live/organization/main.tf` | Management-account composition root. |
| `infra/live/organization/variables.tf` | Account email map and management account ID. |
| `infra/live/organization/backend.tf` | Partial encrypted S3 state backend. |
| `infra/modules/kr-foundation/variables.tf` | Seoul runtime contract and validation. |
| `infra/modules/kr-foundation/network.tf` | Three-AZ VPC, edge, private app, isolated worker, and endpoint subnets. |
| `infra/modules/kr-foundation/identity.tf` | MFA-required Cognito pool, foundation-owned public web PKCE client/URL resource server, and API JWT authorizer. |
| `infra/modules/kr-foundation/kms.tf` | Purpose-separated app, quarantine, audit, backup, Fargate-ephemeral, explanation-telemetry, service-identity-secret, and export-attestation keys. |
| `infra/modules/kr-foundation/storage.tf` | Quarantine/staging, optional retained-source, and audit buckets with distinct lifecycle controls. |
| `infra/modules/kr-foundation/database.tf` | Private encrypted multi-AZ PostgreSQL and Secrets Manager credentials. |
| `infra/modules/kr-foundation/compute.tf` | ECR, ECS Fargate, internal load balancer, and least-privilege task roles. |
| `infra/modules/kr-foundation/edge.tf` | WAF, API Gateway, JWT routes, throttling, and access-log policy. |
| `infra/modules/kr-foundation/security.tf` | CloudTrail, Config, GuardDuty/Security Hub delegation, alarms, and log export. |
| `infra/modules/kr-foundation/ai-telemetry.tf` | One KMS-backed 90-day AMP workspace, private APS/STS endpoints, and the RemoteWrite-only collector trust seam. |
| `infra/modules/kr-foundation/backup.tf` | PITR, cross-account AWS Backup plan/vault copy, and retention. |
| `infra/modules/kr-foundation/outputs.tf` | Issuer, JWK URI, audience, API URL, repository URL, and resource identifiers. |
| `infra/modules/kr-foundation/tests/security.tftest.hcl` | Mock-provider region, encryption, network, identity, retention, and backup assertions. |
| `infra/modules/kr-foundation/tests/ai_telemetry.tftest.hcl` | AMP key/retention/workspace, private endpoint, collector role/boundary, and AI output assertions. |
| `infra/live/kr-prod/main.tf` | Production module composition and cross-account providers. |
| `infra/live/kr-prod/providers.tf` | OIDC-assumed workload, log, security, and backup roles. |
| `infra/live/kr-prod/backend.tf` | Partial encrypted and locked state backend. |
| `infra/live/kr-prod/variables.tf` | Account IDs, DNS/certificate, image digest, and alert destinations. |
| `infra/live/kr-prod/outputs.tf` | Non-secret deployment outputs. |

### CI, release, deletion, and operations

| Path | Responsibility |
|---|---|
| `.github/workflows/ci.yml` | Foundation tests/scans plus stable web, AI, PUB, REC, Android, iOS, and conditional GEN extension markers on explicitly pinned runners. |
| `.github/workflows/release.yml` | Protected OIDC build/push/sign/deploy with immutable image digest. |
| `.github/dependabot.yml` | Weekly Gradle, GitHub Actions, and container update PRs. |
| `scripts/ci/verify_workflow_security.py` | Reject tag-based actions, broad permissions, static AWS keys, and unsafe triggers. |
| `scripts/ci/verify_migration_ranges.py` | Enforce unique Flyway versions and FND/PUB/REC ownership ranges. |
| `scripts/ci/install_security_tools.sh` | Install pinned Go-module versions of Trivy and Gitleaks; Cosign is installed only by the hash-locked Task 1 installer. |
| `scripts/ci/foundation_acceptance.py` | Run the complete local/CI foundation evidence suite. |
| `apps/core-api/Dockerfile` | Non-root, read-only-compatible runtime image using a digest-resolved base. |
| `supply-chain.lock.json` | Foundation-owned core base/tool pins plus shared OCI bases consumed by more than one workstream. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion/api/DeletionContracts.kt` | Deletion state, target, receipt, and eraser interfaces. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion/application/DeletionOrchestrator.kt` | Idempotent active-store deletion and evidence aggregation. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion/application/ConsentRevokedHandler.kt` | Convert durable revocation events to deletion requests. |
| `apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion/adapter/out/jdbc/DeletionJdbcRepository.kt` | Requests, target evidence, and tombstones. |
| `apps/core-api/src/main/resources/db/migration/V3__fnd_deletion_control.sql` | Deletion request/evidence/tombstone schema. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/exportdeletion/DeletionOrchestratorTest.kt` | Idempotency, failure, SLO, and receipt tests. |
| `ops/restore/test_replay_deletion_tombstones.py` | Prove a restored subject is re-deleted before readiness. |
| `ops/restore/replay_deletion_tombstones.py` | Reapply deletion tombstones to a restored database. |
| `ops/restore/verify_restore.py` | Measure RPO/RTO and assert no service-ready marker precedes replay. |
| `ops/runbooks/backup-restore.md` | Quarterly Seoul restore procedure and evidence fields. |
| `ops/runbooks/deletion.md` | Active deletion, backup aging, failed processor, and restore behavior. |
| `ops/runbooks/security-incident.md` | Token/key revocation, evidence preservation, containment, and notification decision points. |
| `governance/compliance/control-matrix.schema.json` | Machine-readable required fields and applicability vocabulary for control evidence. |
| `governance/compliance/control-matrix.yaml` | Reviewer-sized PIPA/ISMS-P/NIST/OWASP/SSDF/SLSA evidence and residual-gap register. |
| `apps/core-api/src/test/kotlin/kr/co/genomecompanion/compliance/ControlMatrixContractTest.kt` | Validate schema-required fields, evidence paths, dates, framework coverage, and no automatic-compliance claim. |

---

### Task 1: Bootstrap the pinned monorepo build

**Files:**
- Create: `.editorconfig`
- Create: `.gitattributes`
- Modify: `.gitignore`
- Create: `settings.gradle.kts`
- Create: `build.gradle.kts`
- Create: `gradle/libs.versions.toml`
- Create: `gradle/wrapper/gradle-wrapper.properties`
- Create: `gradle/wrapper/gradle-wrapper.jar`
- Create: `gradlew`
- Create: `gradlew.bat`
- Create: `apps/core-api/build.gradle.kts`
- Create: `apps/core-api/gradle.lockfile`
- Create: `supply-chain/tool-artifacts.lock.json`
- Create: `scripts/ci/install_uv.py`
- Create: `scripts/ci/run_locked_uv.py`
- Create: `scripts/ci/install_bundletool.py`
- Create: `scripts/ci/install_android_sdk.py`
- Create: `scripts/ci/install_buildx.py`
- Create: `scripts/ci/install_opentofu.py`
- Create: `scripts/ci/install_cosign.py`
- Create: `scripts/ci/build_product_provider_mirror.py`
- Test: `scripts/tests/test_repository_layout.py`
- Test: `scripts/tests/test_install_uv.py`
- Test: `scripts/tests/test_run_locked_uv.py`
- Test: `scripts/tests/test_install_bundletool.py`
- Test: `scripts/tests/test_install_android_sdk.py`
- Test: `scripts/tests/test_install_buildx.py`
- Test: `scripts/tests/test_install_opentofu.py`
- Test: `scripts/tests/test_install_cosign.py`
- Test: `scripts/tests/test_build_product_provider_mirror.py`

**Interfaces:**
- Consumes: Approved stack versions and repository root.
- Produces: Gradle project `:apps:core-api`; Java 21 toolchain; dependency aliases `libs.spring.boot`, `libs.hapi.base`, `libs.hapi.r4`, `libs.archunit`, and `libs.testcontainers.postgresql`; the sole raw uv installation interface `python scripts/ci/install_uv.py --platform auto --destination build/tools/uv`; the sole workstream execution interface demonstrated by `python scripts/ci/run_locked_uv.py -- --version`, with every later uv argument passed only after the literal `--`; the sole bundletool installation interface `python scripts/ci/install_bundletool.py --destination build/tools/bundletool`; the sole Android CI SDK/AVD interface `python scripts/ci/install_android_sdk.py --profile api35-google-apis-x86_64 --destination build/tools/android-sdk --avd-destination build/tools/android-avd --avd-name gc_api35`; the sole Buildx interface `python scripts/ci/install_buildx.py --destination build/tools/docker-cli-plugins`; the sole OpenTofu binary interface `python scripts/ci/install_opentofu.py --destination build/tools/opentofu`; the sole offline Sigstore verification interface `python scripts/ci/install_cosign.py --destination build/tools/cosign`; and the sole Product offline-provider interface `python scripts/ci/build_product_provider_mirror.py --destination build/tools/product-provider-mirror`, all backed by `supply-chain/tool-artifacts.lock.json`.

- [ ] **Step 1: Write the failing repository-layout test**

```python
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


class RepositoryLayoutTest(unittest.TestCase):
    def test_required_foundation_paths_exist(self) -> None:
        required = (
            "settings.gradle.kts",
            "build.gradle.kts",
            "gradle/libs.versions.toml",
            "gradle/wrapper/gradle-wrapper.properties",
            "apps/core-api/build.gradle.kts",
            "apps/core-api/gradle.lockfile",
            "infra/modules",
            "ops",
        )
        missing = [path for path in required if not (ROOT / path).exists()]
        self.assertEqual([], missing)

    def test_gradle_distribution_is_version_and_checksum_pinned(self) -> None:
        text = (ROOT / "gradle/wrapper/gradle-wrapper.properties").read_text()
        self.assertIn("gradle-8.14.3-bin.zip", text)
        self.assertRegex(text, r"distributionSha256Sum=[0-9a-f]{64}")

    def test_repository_does_not_track_local_state_or_secret_files(self) -> None:
        ignore = (ROOT / ".gitignore").read_text()
        for pattern in (".env", "*.tfstate", "*.tfvars", "build/", ".gradle/"):
            self.assertIn(pattern, ignore)

    def test_uv_installer_and_lock_are_foundation_owned(self) -> None:
        self.assertTrue((ROOT / "scripts/ci/install_uv.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/run_locked_uv.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/install_bundletool.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/install_android_sdk.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/install_buildx.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/install_opentofu.py").is_file())
        self.assertTrue((ROOT / "scripts/ci/build_product_provider_mirror.py").is_file())
        self.assertTrue((ROOT / "supply-chain/tool-artifacts.lock.json").is_file())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the layout test and confirm the red state**

Run: `python -m unittest scripts.tests.test_repository_layout -v`

Expected: FAIL listing the missing Gradle/root paths and the missing FND uv installer, locked runner, bundletool installer, Android SDK installer, Buildx installer, and lock.

- [ ] **Step 3: Add the minimal pinned Gradle build**

Create `settings.gradle.kts`:

```kotlin
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { mavenCentral() }
}

rootProject.name = "genome-companion-korea"
include(":apps:core-api")
```

Create `gradle/libs.versions.toml`:

```toml
[versions]
kotlin = "2.2.20"
spring-boot = "3.5.7"
spring-dependency-management = "1.1.7"
hapi-fhir = "8.10.1"
archunit = "1.4.1"
testcontainers = "1.21.3"
cyclonedx = "2.3.1"

[libraries]
spring-web = { module = "org.springframework.boot:spring-boot-starter-web" }
spring-security = { module = "org.springframework.boot:spring-boot-starter-security" }
spring-oauth2-resource-server = { module = "org.springframework.boot:spring-boot-starter-oauth2-resource-server" }
spring-actuator = { module = "org.springframework.boot:spring-boot-starter-actuator" }
spring-jdbc = { module = "org.springframework.boot:spring-boot-starter-jdbc" }
spring-validation = { module = "org.springframework.boot:spring-boot-starter-validation" }
jackson-kotlin = { module = "com.fasterxml.jackson.module:jackson-module-kotlin" }
flyway-core = { module = "org.flywaydb:flyway-core" }
flyway-postgresql = { module = "org.flywaydb:flyway-database-postgresql" }
postgresql = { module = "org.postgresql:postgresql" }
hapi-base = { module = "ca.uhn.hapi.fhir:hapi-fhir-base", version.ref = "hapi-fhir" }
hapi-r4 = { module = "ca.uhn.hapi.fhir:hapi-fhir-structures-r4", version.ref = "hapi-fhir" }
spring-test = { module = "org.springframework.boot:spring-boot-starter-test" }
spring-security-test = { module = "org.springframework.security:spring-security-test" }
archunit = { module = "com.tngtech.archunit:archunit-junit5", version.ref = "archunit" }
testcontainers-junit = { module = "org.testcontainers:junit-jupiter", version.ref = "testcontainers" }
testcontainers-postgresql = { module = "org.testcontainers:postgresql", version.ref = "testcontainers" }

[plugins]
kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
kotlin-spring = { id = "org.jetbrains.kotlin.plugin.spring", version.ref = "kotlin" }
spring-boot = { id = "org.springframework.boot", version.ref = "spring-boot" }
spring-dependency-management = { id = "io.spring.dependency-management", version.ref = "spring-dependency-management" }
cyclonedx = { id = "org.cyclonedx.bom", version.ref = "cyclonedx" }
```

Create root `build.gradle.kts`:

```kotlin
plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.spring) apply false
    alias(libs.plugins.spring.boot) apply false
    alias(libs.plugins.spring.dependency.management) apply false
    alias(libs.plugins.cyclonedx) apply false
}

allprojects {
    group = "kr.co.genomecompanion"
    version = "0.1.0-SNAPSHOT"
}
```

Create `apps/core-api/build.gradle.kts`:

```kotlin
plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
    alias(libs.plugins.spring.dependency.management)
    alias(libs.plugins.cyclonedx)
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
        vendor = JvmVendorSpec.ADOPTIUM
    }
}

kotlin {
    compilerOptions {
        freeCompilerArgs.add("-Xjsr305=strict")
        allWarningsAsErrors.set(true)
    }
}

dependencies {
    implementation(libs.spring.web)
    implementation(libs.spring.security)
    implementation(libs.spring.oauth2.resource.server)
    implementation(libs.spring.actuator)
    implementation(libs.spring.jdbc)
    implementation(libs.spring.validation)
    implementation(libs.jackson.kotlin)
    implementation(libs.flyway.core)
    implementation(libs.flyway.postgresql)
    implementation(libs.hapi.base)
    implementation(libs.hapi.r4)
    runtimeOnly(libs.postgresql)
    testImplementation(libs.spring.test)
    testImplementation(libs.spring.security.test)
    testImplementation(libs.archunit)
    testImplementation(libs.testcontainers.junit)
    testImplementation(libs.testcontainers.postgresql)
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    systemProperty("user.timezone", "UTC")
}

dependencyLocking { lockAllConfigurations() }

tasks.bootJar { archiveFileName.set("core-api.jar") }
```

Generate the wrapper with Gradle 8.14.3, then set this exact checksum in `gradle-wrapper.properties`:

```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.14.3-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
distributionSha256Sum=bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531
```

Create `infra/modules/.gitkeep` and `ops/.gitkeep` so the required roots exist. Preserve every existing `.gitignore` entry and append only missing `.env`, `*.tfstate`, `*.tfstate.*`, `*.tfvars`, `.terraform/`, `.gradle/`, `build/`, `out/`, `.idea/`, and generated `evidence/` entries. Run `./gradlew :apps:core-api:dependencies --write-locks` once to create `apps/core-api/gradle.lockfile`; never hand-edit it.

Create `supply-chain/tool-artifacts.lock.json` with this exact restricted JSON; decimal `size` is the exact response body length (after the one permitted GitHub release-asset redirect for uv/bundletool/Buildx, with no redirect for Android), and every Android SHA-256 below is independently computed over the exact upstream archive in addition to Google's published SHA-1:

```json
{
  "schema_version": 1,
  "uv": {
    "version": "0.12.3",
    "artifacts": {
      "linux-x86_64": {
        "url": "https://github.com/astral-sh/uv/releases/download/0.12.3/uv-x86_64-unknown-linux-gnu.tar.gz",
        "size": 21721441,
        "sha256": "600cf9a742aca00d292673b16b5acffaa7b8c269a364ad0c2e79498dcb1fe101"
      },
      "macos-arm64": {
        "url": "https://github.com/astral-sh/uv/releases/download/0.12.3/uv-aarch64-apple-darwin.tar.gz",
        "size": 17686637,
        "sha256": "546f7f8a6c70ff13a3a9d2bc958db3427298cebf3e0cb756f9177133b7068843"
      },
      "macos-x86_64": {
        "url": "https://github.com/astral-sh/uv/releases/download/0.12.3/uv-x86_64-apple-darwin.tar.gz",
        "size": 19547702,
        "sha256": "4c9f52262a14da336e4a42ed24992d12d0c956acde87619e4611d321dffa602b"
      },
      "windows-x86_64": {
        "url": "https://github.com/astral-sh/uv/releases/download/0.12.3/uv-x86_64-pc-windows-msvc.zip",
        "size": 19013455,
        "sha256": "b23350c79e8ad0192b8124af13a0f17e8d4e4549524785e1aef389ae5a06990e"
      }
    }
  },
  "bundletool": {
    "version": "1.18.1",
    "artifact": {
      "url": "https://github.com/google/bundletool/releases/download/1.18.1/bundletool-all-1.18.1.jar",
      "size": 32505571,
      "sha256": "675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c"
    }
  },
  "android_sdk": {
    "profile": "api35-google-apis-x86_64",
    "host": "linux-x86_64",
    "packages": [
      {
        "package": "cmdline-tools;22.0",
        "revision": "22.0",
        "archiveRoot": "cmdline-tools",
        "installPath": "cmdline-tools/22.0",
        "url": "https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip",
        "size": 181833628,
        "sha1": "040d3996a65543d22ec4bf73e4c37aa37a8d4af4",
        "sha256": "4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583"
      },
      {
        "package": "platform-tools",
        "revision": "37.0.1",
        "archiveRoot": "platform-tools",
        "installPath": "platform-tools",
        "url": "https://dl.google.com/android/repository/platform-tools_r37.0.1-linux.zip",
        "size": 9054187,
        "sha1": "477254aa5f903c15cf51001717bdf347fb6b53e0",
        "sha256": "d230f13842f60f782a8645f9c813f8f845bf36089ea7289f28c48f17979313f1"
      },
      {
        "package": "platforms;android-35",
        "revision": "2",
        "archiveRoot": "android-35",
        "installPath": "platforms/android-35",
        "url": "https://dl.google.com/android/repository/platform-35_r02.zip",
        "size": 64273788,
        "sha1": "0bb560a90a7a2cbd0dd8348224d518b638fe7949",
        "sha256": "0988cacad01b38a18a47bac14a0695f246bc76c1b06c0eeb8eb0dc825ab0c8e0"
      },
      {
        "package": "build-tools;35.0.0",
        "revision": "35.0.0",
        "archiveRoot": "android-15",
        "installPath": "build-tools/35.0.0",
        "url": "https://dl.google.com/android/repository/build-tools_r35_linux.zip",
        "size": 61958799,
        "sha1": "2cfaa0bbb2336e9ec18ed3ecea84fa2e2af607bc",
        "sha256": "bd3a4966912eb8b30ed0d00b0cda6b6543b949d5ffe00bea54c04c81e1561d88"
      },
      {
        "package": "emulator",
        "revision": "37.2.3",
        "archiveRoot": "emulator",
        "installPath": "emulator",
        "url": "https://dl.google.com/android/repository/emulator-linux_x64-15982021.zip",
        "size": 349322634,
        "sha1": "d1b84716dcec2284bdcf34df0aac421409aedce1",
        "sha256": "e0293bda3babce81f5bc5f8f05a11427c510ac88f509a4fba1f0b312f083c5a1"
      },
      {
        "package": "system-images;android-35;google_apis;x86_64",
        "revision": "9",
        "archiveRoot": "x86_64",
        "installPath": "system-images/android-35/google_apis/x86_64",
        "url": "https://dl.google.com/android/repository/sys-img/google_apis/x86_64-35_r09.zip",
        "size": 1738815903,
        "sha1": "0103e6dab21290c4b9d16550a3ce99476f884eef",
        "sha256": "c67b9ba0ff5bc0eb6d046871bfa228af14d4d47b02f0cdae94f048e511b7566e"
      }
    ]
  },
  "container_builder": {
    "host": "linux-x86_64",
    "buildx": {
      "version": "0.20.1",
      "url": "https://github.com/docker/buildx/releases/download/v0.20.1/buildx-v0.20.1.linux-amd64",
      "size": 65241240,
      "sha256": "8c38f60308a895fa570f1410e453c5de11aafd65a99fa99965d96d24b6225a78"
    },
    "buildkit": {
      "reference": "docker.io/moby/buildkit:v0.20.2",
      "ociIndex": "sha256:c457984bd29f04d6acc90c8d9e717afe3922ae14665f3187e0096976fe37b1c8",
      "linuxAmd64Manifest": "sha256:8c8514715aab54e12f65b6a38a219084ab926d49c52d519ac17a8e79befb9c75"
    },
    "dockerfileFrontend": {
      "reference": "docker.io/docker/dockerfile:1.7.0",
      "ociIndex": "sha256:dbbd5e059e8a07ff7ea6233b213b36aa516b4c53c645f1817a4dd18b83cbea56",
      "linuxAmd64Manifest": "sha256:4611ea7b7d89ce41ec5c63df83076ccec3fe8daa32a2d9c96e5decb72e9a8d67"
    }
  },
  "opentofu": {
    "version": "1.10.6",
    "host": "linux-x86_64",
    "url": "https://github.com/opentofu/opentofu/releases/download/v1.10.6/tofu_1.10.6_linux_amd64.zip",
    "size": 26721174,
    "sha256": "15b7bed76420b50da3e121769c43341df8cd57d751ca14e6dbe9c850124c6dac"
  },
  "cosign": {
    "version": "3.0.6",
    "host": "linux-x86_64",
    "url": "https://github.com/sigstore/cosign/releases/download/v3.0.6/cosign-linux-amd64",
    "size": 135178161,
    "sha256": "c956e5dfcac53d52bcf058360d579472f0c1d2d9b69f55209e256fe7783f4c74",
    "trustedRoot": {
      "tufSnapshotVersion": 165,
      "tufTargetsVersion": 14,
      "url": "https://tuf-repo-cdn.sigstore.dev/targets/6494e21ea73fa7ee769f85f57d5a3e6a08725eae1e38c755fc3517c9e6bc0b66.trusted_root.json",
      "size": 6787,
      "sha256": "6494e21ea73fa7ee769f85f57d5a3e6a08725eae1e38c755fc3517c9e6bc0b66"
    }
  },
  "terraformProviderAws": {
    "source": "registry.opentofu.org/hashicorp/aws",
    "version": "6.10.0",
    "host": "linux_amd64",
    "url": "https://releases.hashicorp.com/terraform-provider-aws/6.10.0/terraform-provider-aws_6.10.0_linux_amd64.zip",
    "size": 174725689,
    "sha256": "3c92efebaf635372bf7283e04fc667d59b0ff3cf1aacd011fc484a11f70954d9",
    "binary": "terraform-provider-aws_v6.10.0_x5"
  }
}
```

`install_uv.py` has only `--platform auto|linux-x86_64|macos-arm64|macos-x86_64|windows-x86_64`, `--destination`, and optional `--archive` arguments. It strict-loads the fixed lock with duplicate-key rejection, maps `auto` from the exact OS/architecture tuple, downloads to a newly created temporary directory with a 60-second total timeout, permits only the initial `github.com` URL and its HTTPS redirect to `release-assets.githubusercontent.com`, caps the stream at `size + 1`, and requires exact size and SHA-256 before parsing. It accepts only the upstream locked archive shape: one regular top-level directory containing exactly `uv` and `uvx` on Linux/macOS, or exactly the three regular root entries `uv.exe`, `uvw.exe`, and `uvx.exe` on Windows. The Windows GUI launcher `uvw.exe` is validated as part of the locked archive but is not installed. It rejects links, devices, duplicate names, absolute paths, `..`, any other entry, or compression bombs, and copies only `uv`/`uvx` as flat destination files with mode `0755`. `--archive` performs the identical validation without network and is the only container/offline path. It executes the installed binary with `--version` and requires the locked version token `uv 0.12.3` plus only uv's bounded upstream build-metadata tuple when present; the already verified exact artifact size and SHA-256 remain authoritative. It fsyncs, atomically renames the destination, and deletes the archive/temp tree on success or failure. It accepts no caller URL, version, size, hash, extraction member, or redirect host.

`test_install_uv.py` builds bounded in-memory tar/ZIP fixtures and monkeypatches download/process calls. It covers every platform row, exact success, wrong host/redirect/size/hash/version, unsupported platform, truncated/oversized body, duplicate JSON key, duplicate archive member, extra file, symlink, device, absolute/traversal path, nested second directory, executable mismatch, existing destination, and cleanup after failure. The test scans all tracked workflow/Dockerfile/plan command snippets and fails on `pip install uv`, `pipx install uv`, Astral's shell installer, or a workstream-owned uv artifact lock.

`run_locked_uv.py` resolves the repository from its own real path, strict-loads the same lock with duplicate-key rejection, requires the host interpreter to report exactly Python `3.12.13`, maps the exact host platform, and allows arguments only after one literal `--`. It invokes only sibling `install_uv.py` with the locked `--platform` and a repository-fixed `build/tools/uv/<platform>` cache; on first use it installs atomically, and on every use it independently installs the same hash-verified archive into a fresh temporary directory and byte-compares SHA-256/size/mode of `uv` and `uvx` with the cache before execution. It requires stdout `uv 0.12.3`, deletes the verification tree, rehashes the selected binary immediately before and after the child, and fails on mutation. The child environment removes every inherited `UV_*`, `PYTHONHOME`, `PYTHONPATH`, `VIRTUAL_ENV`, proxy, and certificate override, sets only `UV_PYTHON_DOWNLOADS=never`, preserves no caller-supplied PATH override, and executes the absolute verified binary without modifying PATH. It accepts no caller URL/platform/cache/binary/version/hash/environment key and no arguments before `--`; empty args, nested installer, shell command, cache symlink, wrong owner/mode, or changed binary fails. `test_run_locked_uv.py` covers repo relocation, all platform names, Python/version drift, lock/installer/cache mutation, reparse/symlink race, env clearing, no-PATH behavior, no-download enforcement, argument fidelity, child exit propagation, and cleanup.

`install_bundletool.py` has only required `--destination` and optional `--archive` arguments. It resolves the repository from its own real path, duplicate-key strict-loads only the fixed `bundletool` row above, creates a private temporary directory, and either downloads the exact URL or reads the caller-supplied offline archive. Network mode permits only the initial `https://github.com/google/bundletool/releases/download/1.18.1/bundletool-all-1.18.1.jar` request and its HTTPS redirect to `release-assets.githubusercontent.com`; it rejects every other redirect/host/scheme, caps the stream at `32505572` bytes, requires exact size and SHA-256 before treating bytes as a jar, and uses a 60-second total timeout. It rejects a ZIP/JAR with duplicate names, absolute or `..` paths, links, devices, an entry larger than 16 MiB, more than 16384 entries, or more than 96 MiB expanded bytes; requires a valid manifest and the expected bundletool main-class/version metadata; then writes exactly `bundletool-all-1.18.1.jar` with mode `0644`, fsyncs, and atomically renames a previously absent destination. The 16384-member cap is the smallest reviewed power-of-two bound above the exact locked JAR's 14327 members. It accepts no URL/version/size/hash/output filename/redirect override, never executes the jar, and deletes every partial archive/tree on success or failure. `test_install_bundletool.py` covers exact network/offline success plus wrong initial/redirect host, scheme, size, digest, version metadata, duplicate/traversal/oversized entry, ZIP bomb, existing/symlink destination, partial download, timeout, caller override, and cleanup. GEN consumes this installer and lock unchanged; it may not add a second bundletool pin or download path.

`install_android_sdk.py` has exactly `--profile api35-google-apis-x86_64 --destination <new-dir> --avd-destination <new-dir> --avd-name gc_api35|gc_genetics_api35` plus optional `--archive-dir <verified-offline-dir>`. It runs only on Linux x86_64 under Python 3.12.13 and duplicate-key strict-loads the one `android_sdk` profile above. Network mode fetches exactly the six listed HTTPS URLs from `dl.google.com`, permits no redirect, uses a 15-minute aggregate/ten-minute per-object deadline, caps each stream at its locked `size + 1`, and requires exact size, upstream SHA-1, and independently reviewed SHA-256 before opening any ZIP. Offline mode requires exactly six regular files named by the locked URL basenames and performs identical checks. Extraction rejects duplicate/case-colliding members, links/devices, absolute/drive/`..` paths, entries outside the one locked `archiveRoot`, more than 40,000 members, any member over 3 GiB, or total expansion over 12 GiB; it maps only that root to the locked `installPath`, validates each installed `package.xml`/`source.properties` package ID and revision, executable modes, emulator/adb/apksigner versions, API/ABI/tag, and a complete system image, then fsyncs and atomically renames the absent SDK directory. It never invokes `sdkmanager`, accepts a license prompt, consults repository XML, inherits an ambient SDK path/proxy, or accepts a caller URL/package/revision/hash/root/path/device/profile override.

After the SDK is immutable, the same installer invokes only its verified `cmdline-tools/22.0/bin/avdmanager` with fixed package `system-images;android-35;google_apis;x86_64`, fixed device `pixel_7`, the selected one of the two allowlisted AVD names, isolated `ANDROID_SDK_ROOT=ANDROID_HOME=<destination>` and `ANDROID_AVD_HOME=<avd-destination>`, and literal `no\n` stdin. It rejects any network attempt/output, validates the resulting config points only to the locked image, API 35, `google_apis`, and x86_64 with snapshots disabled, writes `android-sdk-install-receipt.json` binding every archive digest plus SDK/AVD tree digests, and removes all archives/temp trees on success or failure. `test_install_android_sdk.py` uses bounded synthetic ZIPs and process/network fakes to cover all six rows, exact online/offline success, host/profile/name/revision/path/version drift, missing/extra archive, redirect, size/SHA-1/SHA-256 mismatch, ZIP attacks/bombs, partial extraction, ambient SDK/proxy, `sdkmanager` execution, license prompt, AVD package/device/name substitution, network attempt, receipt mutation, existing/symlink destination, and cleanup. It scans Product, GEN, and workflow marker commands and fails any `sdkmanager`, `--licenses`, mutable `cmdline-tools/latest`, unverified Android download, or AVD created outside this interface. Product and GEN consume `install_android_sdk.py`, `install_bundletool.py`, and the lock unchanged.

`install_buildx.py` has only required `--destination <new-dir>` and optional `--binary <offline-file>` arguments, runs only under Python 3.12.13 on Linux x86_64, and duplicate-key strict-loads the `container_builder` row. Network mode permits only the exact GitHub Buildx 0.20.1 URL and one HTTPS redirect to `release-assets.githubusercontent.com`, caps the body at `65241241` bytes, and requires exact size/SHA-256 before writing one `docker-buildx` mode-`0755` plugin; offline mode performs the same validation. It invokes the plugin's `version`, requires 0.20.1, rehashes before and after, fsyncs/atomically renames, and accepts no version/URL/hash/name/path/platform override. The UX plan job exports only this directory through `DOCKER_CLI_PLUGIN_EXTRA_DIRS`, creates one builder `gc-ux-plan` with driver image `docker.io/moby/buildkit:v0.20.2@sha256:c457984bd29f04d6acc90c8d9e717afe3922ae14665f3187e0096976fe37b1c8`, inspects the pulled linux/amd64 manifest and requires `sha256:8c8514715aab54e12f65b6a38a219084ab926d49c52d519ac17a8e79befb9c75`, and permits no default/host builder. Every Product Dockerfile begins exactly `# syntax=docker/dockerfile:1.7.0@sha256:dbbd5e059e8a07ff7ea6233b213b36aa516b4c53c645f1817a4dd18b83cbea56`; provenance records that index plus linux/amd64 manifest `sha256:4611ea7b7d89ce41ec5c63df83076ccec3fe8daa32a2d9c96e5decb72e9a8d67`, the Buildx binary digest, and both BuildKit digests. `test_install_buildx.py` covers online/offline success, host/redirect/size/hash/version/mode/destination mutation, plugin rehash race, default builder fallback, tag-only/wrong-platform BuildKit or frontend, Dockerfile syntax drift, missing provenance fields, and cleanup; the workflow verifier rejects `docker build`, ambient `docker buildx`, `# syntax=docker/dockerfile:1.7`, or any builder/frontend value outside this lock.

`install_opentofu.py` has only required `--destination <new-dir>` and optional `--archive <offline-file>` arguments and runs only under Python 3.12.13 on Linux x86_64. It strict-loads the one `opentofu` row, permits only the exact GitHub URL plus one `release-assets.githubusercontent.com` redirect, caps at `26721175` bytes, and requires exact size/SHA-256 before parsing. The ZIP must contain exactly four regular root entries `CHANGELOG.md`, `LICENSE`, `README.md`, and `tofu`, no duplicate/link/device/path trick, and bounded expansion; it installs only `tofu` mode `0755`, requires exact `OpenTofu v1.10.6` output, rehashes before/after, fsyncs/atomically renames, and accepts no URL/version/hash/member/path/platform override. `test_install_opentofu.py` covers network/offline success, redirect/size/hash/member/mode/version/platform/destination mutation, symlink/race/partial write, and cleanup. Container builds may only `COPY` a preverified `build/tools/opentofu/tofu`; no Dockerfile downloads OpenTofu or executes an installer over the network.

`install_cosign.py` has only required `--destination <new-dir>` plus optional paired `--binary <offline-file> --trusted-root <offline-file>` arguments and runs only under Python 3.12.13 on Linux x86_64. It strict-loads the one `cosign` row, permits only the exact GitHub binary URL plus one `release-assets.githubusercontent.com` redirect and the exact hash-addressed Sigstore TUF target URL with no redirect, caps each stream at its locked size plus one, and verifies size/SHA-256 before writing. It installs exactly `cosign` mode `0755` and `trusted_root.json` mode `0444`, rejects JSON duplicate keys/noncanonical UTF-8 or a trusted-root media type/schema without Fulcio certificate authorities and Rekor transparency-log keys, parses `cosign version --json` as exactly `v3.0.6`, rehashes both files before/after, fsyncs/atomically renames, and accepts no URL/version/hash/root/member/path/platform/TUF-refresh override. `test_install_cosign.py` covers online/offline success, redirect/size/hash/version/root-schema/TUF-version/platform/destination mutation, symlink/race/partial write, and cleanup. It also executes fixed local CLI fixtures proving that `sign` and `attest` accept `--bundle --new-bundle-format=true`, and that `verify` plus `verify-attestation` accept the locked-root/offline flags; an unknown/deprecated flag or a legacy bundle must fail. CI and container builds may only consume these two preverified files; no `cosign initialize`, TUF/network refresh, Go build, PATH binary, or alternate trust root is allowed in a verification boundary.

`build_product_provider_mirror.py` has only required `--destination <new-dir>` and optional `--archive <offline-file>` arguments; it resolves the repository itself and accepts no lockfile, provider, URL, version, platform, path, checksum, or registry override. It runs only under Python 3.12.13 on Linux x86_64, requires the staging and production Product `.terraform.lock.hcl` files to be byte-identical, requires their sole provider tuple `registry.opentofu.org/hashicorp/aws` 6.10.0/linux_amd64 and locked `zh:3c92efebaf635372bf7283e04fc667d59b0ff3cf1aacd011fc484a11f70954d9`, then strict-loads the FND `terraformProviderAws` row. Network mode permits only its exact `releases.hashicorp.com` HTTPS URL with no redirect, caps at `174725690` bytes, and requires exact size/SHA-256 before ZIP parsing; offline mode performs the same checks. The provider ZIP must contain only regular `LICENSE.txt` and `terraform-provider-aws_v6.10.0_x5`, with exact executable version output, no duplicate/link/device/path/compression trick. The script preserves the exact official ZIP bytes as `product-web-linux-amd64.zip`, writes canonical `provider-mirror-receipt.json` binding both lockfile digest, source/version/platform, archive size/digest, and binary digest, fsyncs, atomically renames, and deletes all temporary bytes. The Product plan job conditionally uploads only that unchanged ZIP to full exact evidence key `ux/plan/<sourceSha>/<sourceSetSha256>/providers/product-web-linux-amd64.zip` and binds the returned key/VersionId/SHA-256 in both plan rows; the two path variables are derived only from the verified source/source-set bytes already used for every sibling plan object. It cannot call `tofu providers mirror`, install another provider, or repack the archive. `test_build_product_provider_mirror.py` covers online/offline success, lockfile inequality/provider/source/version/platform/zh drift, redirect/size/hash/member/version/mode/path attacks, destination race, response loss, full-key substitution, and scanning every Product/workflow command for a second provider-download path.

Linux OCI/container gates run only on pinned `ubuntu-24.04` amd64 jobs. Before BuildKit receives a context, that job asserts `Linux-x86_64` and runs `python scripts/ci/run_locked_uv.py -- --version`; the locked runner invokes the installer with `--platform linux-x86_64`, atomically populates or independently re-verifies `build/tools/uv/linux-x86_64`, and proves exact `uv 0.12.3`. The Docker build may copy only that verified `uv` after rehashing it against `supply-chain/tool-artifacts.lock.json`. Windows and macOS hosts may run host unit/contract tests but must fail with `linux OCI preparation requires ubuntu-24.04 amd64` rather than populate a Linux context from a host cache. Tests mutate host/platform/destination/archive/binary and prove no Dockerfile downloads uv or copies `auto`, Windows, or macOS artifacts.

- [ ] **Step 4: Run bootstrap verification**

Run:

```bash
python -m unittest scripts.tests.test_repository_layout -v
python -m unittest scripts.tests.test_install_uv -v
python -m unittest scripts.tests.test_run_locked_uv -v
python -m unittest scripts.tests.test_install_bundletool -v
python -m unittest scripts.tests.test_install_android_sdk -v
python -m unittest scripts.tests.test_install_buildx -v
python -m unittest scripts.tests.test_install_opentofu -v
python -m unittest scripts.tests.test_install_cosign -v
python -m unittest scripts.tests.test_build_product_provider_mirror -v
python scripts/ci/install_uv.py --platform auto --destination build/tools/uv
python -c "from pathlib import Path; import os, subprocess; p=Path('build/tools/uv')/('uv.exe' if os.name=='nt' else 'uv'); subprocess.run([str(p),'--version'],check=True)"
python scripts/ci/run_locked_uv.py -- --version
python scripts/ci/install_bundletool.py --destination build/tools/bundletool
python -c "from pathlib import Path; import hashlib; p=Path('build/tools/bundletool/bundletool-all-1.18.1.jar'); assert p.stat().st_size==32505571; assert hashlib.sha256(p.read_bytes()).hexdigest()=='675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c'"
python scripts/ci/install_android_sdk.py --profile api35-google-apis-x86_64 --destination build/tools/android-sdk --avd-destination build/tools/android-avd --avd-name gc_api35
build/tools/android-sdk/platform-tools/adb version | grep -Eq '^Version 37\.0\.1(-|$)'
test -f build/tools/android-sdk/android-sdk-install-receipt.json
python scripts/ci/install_buildx.py --destination build/tools/docker-cli-plugins
build/tools/docker-cli-plugins/docker-buildx version | grep -F 'v0.20.1'
python scripts/ci/install_opentofu.py --destination build/tools/opentofu
test "$(build/tools/opentofu/tofu version | sed -n '1p')" = 'OpenTofu v1.10.6'
python scripts/ci/install_cosign.py --destination build/tools/cosign
test "$(build/tools/cosign/cosign version --json | python -c 'import json,sys; print(json.load(sys.stdin)["gitVersion"])')" = 'v3.0.6'
test "$(sha256sum build/tools/cosign/trusted_root.json | cut -d' ' -f1)" = '6494e21ea73fa7ee769f85f57d5a3e6a08725eae1e38c755fc3517c9e6bc0b66'
java -version
./gradlew --no-daemon projects
./gradlew --no-daemon :apps:core-api:dependencyInsight --dependency hapi-fhir-base --configuration runtimeClasspath
```

Expected: repository, uv-installer, locked-runner, bundletool-installer, Android-SDK-installer, Buildx-installer, OpenTofu-installer, Cosign/trusted-root installer, and provider-mirror tests PASS; both raw installer and locked runner report exactly `uv 0.12.3`; runner proves `UV_PYTHON_DOWNLOADS=never` and no PATH mutation; bundletool and all six Android archives have the exact locked sizes/digests, the installed profile reports platform-tools 37.0.1/API 35/build-tools 35.0.0/emulator 37.2.3/google_apis x86_64 revision 9, Buildx reports 0.20.1, OpenTofu reports 1.10.6, Cosign reports v3.0.6 against the exact hash-addressed trusted root and passes the fixed new-format CLI fixtures, the provider fixture proves the exact AWS 6.10.0 linux/amd64 package contract, and no alternate downloader exists; Java reports Eclipse Temurin `21.0.8`; Gradle lists `:apps:core-api`; dependency insight resolves `hapi-fhir-base:8.10.1` and no Medplum artifact.

- [ ] **Step 5: Commit the bootstrap**

```bash
git add .editorconfig .gitattributes .gitignore settings.gradle.kts build.gradle.kts gradle gradlew gradlew.bat apps/core-api/build.gradle.kts apps/core-api/gradle.lockfile scripts/tests/test_repository_layout.py scripts/tests/test_install_uv.py scripts/tests/test_run_locked_uv.py scripts/tests/test_install_bundletool.py scripts/tests/test_install_android_sdk.py scripts/tests/test_install_buildx.py scripts/tests/test_install_opentofu.py scripts/tests/test_install_cosign.py scripts/tests/test_build_product_provider_mirror.py scripts/ci/install_uv.py scripts/ci/run_locked_uv.py scripts/ci/install_bundletool.py scripts/ci/install_android_sdk.py scripts/ci/install_buildx.py scripts/ci/install_opentofu.py scripts/ci/install_cosign.py scripts/ci/build_product_provider_mirror.py supply-chain/tool-artifacts.lock.json infra/modules/.gitkeep ops/.gitkeep
git commit -m "build: bootstrap pinned platform monorepo"
```

---

### Task 2: Establish the modular monolith and fail-closed API skeleton

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/CoreApiApplication.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/healthrecord/api/HealthRecordQuery.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/documentintake/api/DocumentIntakePort.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion/api/ProfileDeletionPort.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/ApplicationSmokeTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/architecture/ModuleBoundaryTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/architecture/ProhibitedRouteTest.kt`

**Interfaces:**
- Consumes: Gradle project `:apps:core-api` from Task 1.
- Produces: `HealthRecordQuery.findBySubjectAndId(String, String): HealthRecordSummary?`; `DocumentIntakePort.requestUpload(AuthorizedDocumentRequest): UploadTicket`; `ProfileDeletionPort.requestDeletion(ProfileDeletionCommand): UUID`; HAPI `FhirContext` R4 bean; and the permanent ArchUnit seam that prevents any later `publicdata` class from importing a personal module. PUB, not FND, produces the single C0 bootstrap and query/API contracts.

- [ ] **Step 1: Write failing smoke and architecture tests**

```kotlin
@SpringBootTest(
    properties = [
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
    ],
)
@ActiveProfiles("test")
class ApplicationSmokeTest(
    @Autowired private val fhirContext: FhirContext,
) {
    @Test
    fun `application exposes exactly an R4 FHIR context`() {
        assertThat(fhirContext.version.version).isEqualTo(FhirVersionEnum.R4)
    }

    @Test
    fun `personal bootstrap permanently excludes the PUB package`() {
        val scan = CoreApiApplication::class.java.getAnnotation(ComponentScan::class.java)
        val excludedPatterns = scan.excludeFilters.flatMap { it.pattern.asList() }
        assertThat(excludedPatterns)
            .containsExactly("kr\\.co\\.genomecompanion\\.publicdata(?:\\..*)?")
    }
}
```

```kotlin
@AnalyzeClasses(packages = ["kr.co.genomecompanion"])
class ModuleBoundaryTest {
    @ArchTest
    val publicDataCannotReadPersonalModules: ArchRule = noClasses()
        .that().resideInAPackage("..publicdata..")
        .should().dependOnClassesThat().resideInAnyPackage(
            "..identityaccount..",
            "..healthrecord..",
            "..documentintake..",
            "..consentpurpose..",
            "..exportdeletion..",
        )

    @ArchTest
    val moduleInternalsAreNotImportedAcrossModules: ArchRule = noClasses()
        .that().resideInAPackage("kr.co.genomecompanion.(*)..")
        .should().dependOnClassesThat().resideInAPackage("kr.co.genomecompanion.(*)..adapter..")
}
```

```kotlin
@SpringBootTest(
    properties = [
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
    ],
)
@ActiveProfiles("test")
class ProhibitedRouteTest(
    @Autowired private val mappings: RequestMappingHandlerMapping,
) {
    @Test
    fun `medical genomic referral and training routes are absent`() {
        val routes = mappings.handlerMethods.keys
            .flatMap { it.pathPatternsCondition?.patternValues.orEmpty() }
            .toSet()
        val prohibited = setOf(
            "/upload-genome",
            "/diagnose",
            "/prescribe",
            "/change-medication",
            "/refer-patient-for-commission",
            "/train-model-on-user-data",
        )
        assertThat(routes).noneMatch { route -> prohibited.any(route::contains) }
        assertThat(routes).noneMatch { it.startsWith("/v1/public/") }
    }
}
```

- [ ] **Step 2: Run the tests and confirm the red state**

Run: `./gradlew --no-daemon :apps:core-api:test --tests '*ApplicationSmokeTest' --tests '*ModuleBoundaryTest' --tests '*ProhibitedRouteTest'`

Expected: compilation FAIL because `CoreApiApplication`, `FhirContext`, and the three personal module ports do not exist.

- [ ] **Step 3: Implement the smallest application and stable ports**

```kotlin
@SpringBootApplication
@ComponentScan(
    basePackages = ["kr.co.genomecompanion"],
    excludeFilters = [
        ComponentScan.Filter(type = FilterType.CUSTOM, classes = [TypeExcludeFilter::class]),
        ComponentScan.Filter(type = FilterType.CUSTOM, classes = [AutoConfigurationExcludeFilter::class]),
        ComponentScan.Filter(
            type = FilterType.REGEX,
            pattern = ["kr\\.co\\.genomecompanion\\.publicdata(?:\\..*)?"],
        ),
    ],
)
class CoreApiApplication {
    @Bean
    fun fhirContext(): FhirContext = FhirContext.forR4Cached()
}

fun main(args: Array<String>) {
    runApplication<CoreApiApplication>(*args)
}
```

```kotlin
package kr.co.genomecompanion.documentintake.api

import java.net.URI
import java.time.Instant
import java.util.UUID

data class AuthorizedDocumentRequest(
    val subjectId: String,
    val timelineConsentId: UUID,
    val cloudConsentId: UUID,
    val mediaType: String,
    val contentLength: Long,
) {
    init {
        require(timelineConsentId != cloudConsentId)
    }
}

data class UploadTicket(
    val documentId: UUID,
    val uploadUri: URI,
    val expiresAt: Instant,
)

fun interface DocumentIntakePort {
    fun requestUpload(request: AuthorizedDocumentRequest): UploadTicket
}
```

```kotlin
package kr.co.genomecompanion.healthrecord.api

import java.time.Instant

data class HealthRecordSummary(
    val resourceId: String,
    val resourceType: String,
    val sourceDocumentId: String,
    val recordedAt: Instant,
)

fun interface HealthRecordQuery {
    fun findBySubjectAndId(subjectId: String, resourceId: String): HealthRecordSummary?
}
```

```kotlin
package kr.co.genomecompanion.exportdeletion.api

import java.util.UUID

data class ProfileDeletionCommand(
    val subjectId: String,
    val sourceEventId: UUID,
)

fun interface ProfileDeletionPort {
    fun requestDeletion(command: ProfileDeletionCommand): UUID
}
```

Keep all adapters absent; these are dependency-direction anchors, not fake storage implementations. This task intentionally creates no class, configuration file, query port, controller, or JAR task under `publicdata`. PUB adds the only `PublicDataApplication`, `PublicDataModuleConfiguration`, `publicDataBootJar`, `application-publicdata`, and C0 API/query contracts. The personal bootstrap's permanent component-scan exclusion prevents those classes/routes from entering `core-api.jar` runtime, while the foundation-owned ArchUnit rule becomes non-vacuous as soon as PUB classes compile and prevents them from importing `identityaccount`, `consentpurpose`, `documentintake`, `healthrecord`, or `exportdeletion`.

- [ ] **Step 4: Prove startup, boundaries, and excluded routes**

Run: `./gradlew --no-daemon :apps:core-api:test`

Expected: PASS; the personal bootstrap exposes HAPI R4, its scan excludes `publicdata`, no excluded or `/v1/public/**` endpoint is mapped, and the reserved `publicdata` rule is present. After PUB lands, the same test suite must also evaluate that package plus PUB's `PublicDataIsolationStartupTest`; neither artifact can load the other's beans/routes and no alternate FND C0 bootstrap exists.

- [ ] **Step 5: Commit the application boundary**

```bash
git add apps/core-api/src/main apps/core-api/src/test
git commit -m "feat: establish modular core API boundary"
```

---

### Task 3: Enforce OIDC identity and deny-by-default HTTP access

**Files:**
- Create: `apps/core-api/src/main/resources/application.yml`
- Create: `apps/core-api/src/test/resources/application-test.yml`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/api/CallerPrincipal.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/OidcProperties.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/AudienceValidator.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/JwtConfiguration.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/StrictJwtAuthenticationConverter.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/SecurityConfiguration.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/CallerPrincipalResolver.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/api/SensitiveActionAuthorizer.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/JwtSensitiveActionAuthorizer.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/security/SensitiveActionProblemHandler.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/workload/WorkloadTokenContracts.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount/workload/Ed25519WorkloadTokenIssuer.kt`
- Modify: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/architecture/ModuleBoundaryTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/SecurityConfigurationTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/SensitiveActionAuthorizerTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/SensitiveActionProblemHandlerTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/WorkloadTokenIssuerTest.kt`
- Create: `packages/contracts/jsonschema/signed-workload-jwks-release.schema.json`
- Create: `packages/contracts/jsonschema/workload-jwks-root-registry.schema.json`
- Create: `packages/contracts/jsonschema/signed-workload-jwks-root-registry.schema.json`
- Create: `packages/contracts/jsonschema/workload-jwks-keygen-request.schema.json`
- Create: `packages/contracts/jsonschema/workload-jwks-keygen-result.schema.json`
- Create: `packages/contracts/jsonschema/workload-jwks-prepared-pair.schema.json`
- Create: `packages/contracts/fixtures/workload-jwks-release.valid.json`
- Create: `packages/contracts/fixtures/workload-jwks-root-registry.valid.json`
- Create: `packages/contracts/fixtures/workload-jwks-keygen-result.valid.json`
- Create: `packages/contracts/fixtures/workload-jwks-prepared-pair.valid.json`
- Create: `governance/cryptographic/workload-jwks-public-input.json`
- Create: `scripts/security/build_workload_jwks_documents.py`
- Create: `scripts/security/workload_jwks_ceremony.py`
- Create: `scripts/security/verify_workload_jwks_release.py`
- Test: `scripts/tests/test_workload_jwks_release.py`
- Test: `scripts/tests/test_workload_jwks_ceremony.py`

**Interfaces:**
- Consumes: Cognito-compatible `OIDC_ISSUER`, `OIDC_JWK_SET_URI`, fixed access-token resource audience `OIDC_AUDIENCE=https://api.genome-companion.kr`, and exact foundation-owned `OIDC_CLIENT_ID`; verified Spring `JwtAuthenticationToken`; secret-injected Ed25519 PKCS#8 workload-token private key and `kid`; and, for the later production ceremony only, Tasks 7B/7C exact generic broker roles/state machine/buckets/root bundle plus `workload_jwks_release_secret_arn`.
- Produces: `CallerPrincipal(subjectId: String, scopes: Set<String>, region: DataRegion)`; `CallerPrincipalResolver.resolve(Authentication): CallerPrincipal`; `SensitiveActionAuthorizer.requireAuthorized(Authentication, SensitiveAction): SensitiveActionAuthorization` for exactly `EXPORT_RECORDS` and `RESET_PROFILE`; RFC 9457 `SensitiveActionProblem` with stable denial code and `SensitiveActionAssuranceRequirement`; HTTP 401 for missing/invalid JWT and 403 for missing scope; `WorkloadTokenIssuer.issueServiceToken(): SignedJwt`; `issuePurposeToken(OpaqueSubjectRef, UUID, WorkerPurpose): SignedJwt`; strict public-only workload keygen request/result, release, root-registry, and pre-plan `workload-jwks-prepared-pair.v1` documents; broker request/receipt/result verification; the FND-owned atomic signed envelope at `workload_jwks_release_secret_arn`; and protected workload prepared-pair/public VersionId/digest outputs consumed read-only by AI.

- [ ] **Step 1: Write failing security tests**

```kotlin
@SpringBootTest(
    properties = [
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
    ],
)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityConfigurationTest(
    @Autowired private val mvc: MockMvc,
) {
    @Test
    fun `readiness is public but all v1 routes require a bearer token`() {
        mvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk)
        mvc.perform(get("/v1/not-mapped")).andExpect(status().isUnauthorized)
    }

    @Test
    fun `resource audience validator rejects a token for another API`() {
        val token = Jwt.withTokenValue("synthetic-token")
            .header("alg", "none")
            .subject("cognito-subject-7")
            .audience(listOf("https://other-api.invalid"))
            .issuer("https://issuer.test.invalid")
            .issuedAt(Instant.parse("2026-08-09T00:00:00Z"))
            .expiresAt(Instant.parse("2026-08-09T00:05:00Z"))
            .build()
        assertThat(AudienceValidator("https://api.genome-companion.kr").validate(token).hasErrors()).isTrue()
    }

    @Test
    fun `verified token reaches routing without exposing its subject`() {
        mvc.perform(
            get("/v1/not-mapped").with(
                jwt().jwt {
                    it.subject("cognito-subject-7")
                    it.audience(listOf("https://api.genome-companion.kr"))
                    it.claim("client_id", "synthetic-web-client")
                    it.claim("scope", "https://api.genome-companion.kr/consent.read")
                    it.issuer("https://issuer.test.invalid")
                },
            ),
        ).andExpect(status().isNotFound)
    }
}
```

Write the step-up tests against already validated Spring authentication. They deliberately never inspect or print `Jwt.tokenValue`:

```kotlin
class SensitiveActionAuthorizerTest {
    private val now = Instant.parse("2026-08-09T00:05:00Z")
    private val authorizer = JwtSensitiveActionAuthorizer(
        CallerPrincipalResolver(),
        Clock.fixed(now, ZoneOffset.UTC),
    )

    @ParameterizedTest
    @EnumSource(SensitiveAction::class)
    fun `fresh strong KR authentication authorizes only its action scope`(action: SensitiveAction) {
        val authorization = authorizer.requireAuthorized(
            authentication(action.requiredScope, now.minusSeconds(299)),
            action,
        )

        assertThat(authorization.principal.subjectId).isEqualTo("cognito-subject-7")
        assertThat(authorization.principal.region).isEqualTo(DataRegion.KR)
        assertThat(authorization.action).isEqualTo(action)
    }

    @Test
    fun `missing scope or stale authentication is denied`() {
        val validScope = SensitiveAction.EXPORT_RECORDS.requiredScope
        val denied = listOf(
            authentication("consent:read", now.minusSeconds(60)),
            authentication(validScope, now.minusSeconds(301)),
        )
        denied.forEach { candidate ->
            assertThatThrownBy {
                authorizer.requireAuthorized(candidate, SensitiveAction.EXPORT_RECORDS)
            }.isInstanceOf(SensitiveActionDeniedException::class.java)
        }
    }

    @Test
    fun `export scope cannot authorize profile reset`() {
        val failure = assertThrows<SensitiveActionDeniedException> {
            authorizer.requireAuthorized(
                authentication("records:export", now.minusSeconds(60)),
                SensitiveAction.RESET_PROFILE,
            )
        }
        assertThat(failure.denial).isEqualTo(SensitiveActionDenial.INSUFFICIENT_ACTION_SCOPE)
    }

    @Test
    fun `unvalidated authentication type is denied`() {
        val unvalidated = UsernamePasswordAuthenticationToken("cognito-subject-7", "never-log-this")
        assertThatThrownBy {
            authorizer.requireAuthorized(unvalidated, SensitiveAction.RESET_PROFILE)
        }.isInstanceOf(SensitiveActionDeniedException::class.java)
    }

    private fun authentication(scope: String, authTime: Instant): Authentication {
        val jwt = Jwt.withTokenValue("synthetic-token-never-logged")
            .header("alg", "RS256")
            .subject("cognito-subject-7")
            .issuer("https://issuer.test.invalid")
            .audience(listOf("https://api.genome-companion.kr"))
            .claim("client_id", "synthetic-web-client")
            .issuedAt(now.minusSeconds(360))
            .expiresAt(now.plusSeconds(300))
            .claim("scope", when (scope) {
                "consent:read" -> "https://api.genome-companion.kr/consent.read"
                "records:export" -> "https://api.genome-companion.kr/records.export"
                "profile:reset" -> "https://api.genome-companion.kr/profile.reset"
                else -> scope
            })
            .claim("auth_time", authTime.epochSecond)
            .build()
        return StrictJwtAuthenticationConverter().convert(jwt)
    }
}
```

Extend `ModuleBoundaryTest` so this authorization path cannot acquire a logging dependency:

```kotlin
@ArchTest
val sensitiveActionAuthorizationCannotLogTokens: ArchRule = noClasses()
    .that().haveSimpleName("JwtSensitiveActionAuthorizer")
    .should().dependOnClassesThat().resideInAnyPackage(
        "org.slf4j..",
        "org.apache.logging..",
        "java.util.logging..",
    )
```

```kotlin
class SensitiveActionProblemHandlerTest {
    @Test
    fun `recent authentication denial returns stable assurance without token material`() {
        val response = SensitiveActionProblemHandler().handle(
            SensitiveActionDeniedException(
                SensitiveAction.RESET_PROFILE,
                SensitiveActionDenial.RECENT_AUTHENTICATION_REQUIRED,
            ),
        )
        val problem = requireNotNull(response.body)
        val assurance = problem.properties?.get("assurance") as SensitiveActionAssuranceRequirement

        assertThat(response.statusCode.value()).isEqualTo(403)
        assertThat(response.headers.cacheControl).isEqualTo("no-store")
        assertThat(problem.type.toString()).isEqualTo("https://api.genome-companion.kr/problems/sensitive-action")
        assertThat(problem.properties).containsEntry("code", "recent_authentication_required")
        assertThat(assurance.action).isEqualTo(SensitiveAction.RESET_PROFILE)
        assertThat(assurance.requiredScope).isEqualTo("profile:reset")
        assertThat(assurance.maxAuthAgeSeconds).isEqualTo(300)
        assertThat(assurance.assurancePolicy).isEqualTo("cognito_mfa_required_pool")
        assertThat(problem.toString()).doesNotContain("synthetic-token", "cognito-subject")
    }
}
```

```kotlin
class WorkloadTokenIssuerTest {
    private val mapper = ObjectMapper()
    private val keyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
    private val clock = Clock.fixed(Instant.parse("2026-08-09T00:00:00Z"), ZoneOffset.UTC)
    private val issuer = Ed25519WorkloadTokenIssuer("purpose-2026-08", keyPair.private, mapper, clock)

    @Test
    fun `service token has only the worker service claims and a valid Ed25519 signature`() {
        val token = issuer.issueServiceToken()
        val claims = claims(token)

        assertThat(verify(token)).isTrue()
        assertThat(claims["iss"].asText()).isEqualTo("genome-companion-core-api")
        assertThat(claims["aud"].asText()).isEqualTo("explanation-worker")
        assertThat(claims["sub"].asText()).isEqualTo("core-api")
        assertThat(claims["exp"].asLong() - claims["iat"].asLong()).isEqualTo(120)
        assertThat(claims.has("jti")).isFalse()
        assertThat(claims.has("purpose")).isFalse()
    }

    @Test
    fun `purpose token uses an opaque subject and the exact explanation purpose`() {
        val token = issuer.issuePurposeToken(
            OpaqueSubjectRef("sub_AAAAAAAAAAAAAAAAAAAAAA"),
            UUID.fromString("00000000-0000-0000-0000-000000000019"),
            WorkerPurpose.PERSONAL_RECORD_EXPLANATION,
        )
        val claims = claims(token)

        assertThat(verify(token)).isTrue()
        assertThat(claims["sub"].asText()).isEqualTo("sub_AAAAAAAAAAAAAAAAAAAAAA")
        assertThat(claims["jti"].asText()).isEqualTo("00000000-0000-0000-0000-000000000019")
        assertThat(claims["purpose"].asText()).isEqualTo("personal_record_explanation")
        assertThat(claims.toString()).doesNotContain("cognito-subject", "subject-17")
    }

    private fun claims(token: SignedJwt): JsonNode =
        mapper.readTree(Base64.getUrlDecoder().decode(token.compact.split('.')[1]))

    private fun verify(token: SignedJwt): Boolean {
        val parts = token.compact.split('.')
        return Signature.getInstance("Ed25519").run {
            initVerify(keyPair.public)
            update("${parts[0]}.${parts[1]}".toByteArray(StandardCharsets.US_ASCII))
            verify(Base64.getUrlDecoder().decode(parts[2]))
        }
    }
}
```

Add decoder/converter contract vectors that drive the actual security filter and a `@PreAuthorize("hasAuthority('SCOPE_consent:read')")` probe: one token with scalar `aud=https://api.genome-companion.kr`, exact `client_id`, scalar `sub`, numeric `auth_time`, and qualified `https://api.genome-companion.kr/consent.read` reaches the probe. Separate tokens with an audience array containing an extra value, list-valued `scope`, duplicate/bare/unknown/mixed scope, blank/list `sub`, list `client_id`, or boolean/string `auth_time` return the same redacted 401/403 and never 500. A qualified `consent.write` token cannot reach the read probe. The test also asserts `CallerPrincipal.scopes` and Spring authorities are derived from the same converter result.

- [ ] **Step 2: Run the security test and confirm the red state**

Run: `./gradlew --no-daemon :apps:core-api:test --tests '*SecurityConfigurationTest' --tests '*SensitiveActionAuthorizerTest' --tests '*SensitiveActionProblemHandlerTest' --tests '*WorkloadTokenIssuerTest' --tests '*ModuleBoundaryTest' && python -m unittest scripts.tests.test_workload_jwks_release scripts.tests.test_workload_jwks_ceremony -v`

Expected: FAIL because the default Spring login/basic-auth behavior does not implement the bearer-token contract, the caller/step-up/workload-token types are absent, and the strict public-only workload document/registry/broker-ceremony builders do not exist.

- [ ] **Step 3: Add the minimal JWT and principal implementation**

```kotlin
package kr.co.genomecompanion.identityaccount.api

enum class DataRegion { KR }

data class CallerPrincipal(
    val subjectId: String,
    val scopes: Set<String>,
    val region: DataRegion = DataRegion.KR,
)
```

```kotlin
@ConfigurationProperties("security.oidc")
@Validated
data class OidcProperties(
    @field:NotBlank val issuer: String,
    @field:NotBlank val jwkSetUri: String,
    @field:NotBlank val audience: String,
    @field:NotBlank val clientId: String,
)

class AudienceValidator(private val audience: String) : OAuth2TokenValidator<Jwt> {
    override fun validate(token: Jwt): OAuth2TokenValidatorResult =
        if (token.audience == listOf(audience)) OAuth2TokenValidatorResult.success()
        else OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "invalid audience", null))
}

class ClientIdValidator(private val clientId: String) : OAuth2TokenValidator<Jwt> {
    override fun validate(token: Jwt): OAuth2TokenValidatorResult =
        if (token.claims["client_id"] is String && token.claims["client_id"] == clientId)
            OAuth2TokenValidatorResult.success()
        else OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "invalid client", null))
}

class CognitoClaimShapeValidator : OAuth2TokenValidator<Jwt> {
    private val allowedScopes = setOf(
        "openid",
        "https://api.genome-companion.kr/consent.read",
        "https://api.genome-companion.kr/consent.write",
        "https://api.genome-companion.kr/records.export",
        "https://api.genome-companion.kr/profile.reset",
    )
    override fun validate(token: Jwt): OAuth2TokenValidatorResult {
        val subject = token.claims["sub"] as? String
        val rawScope = token.claims["scope"] as? String
        val authTime = token.claims["auth_time"]
        val scopes = rawScope?.split(' ')?.filter(String::isNotBlank).orEmpty()
        val valid = !subject.isNullOrBlank() && !rawScope.isNullOrBlank() &&
            (authTime is Number || authTime is Instant) &&
            scopes.size == scopes.toSet().size && scopes.all(allowedScopes::contains)
        return if (valid) OAuth2TokenValidatorResult.success()
        else OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "invalid claim shape", null))
    }
}

class StrictJwtAuthenticationConverter : Converter<Jwt, AbstractAuthenticationToken> {
    private val scopeMap = mapOf(
        "https://api.genome-companion.kr/consent.read" to "SCOPE_consent:read",
        "https://api.genome-companion.kr/consent.write" to "SCOPE_consent:write",
        "https://api.genome-companion.kr/records.export" to "SCOPE_records:export",
        "https://api.genome-companion.kr/profile.reset" to "SCOPE_profile:reset",
    )
    private val nonAuthorityScopes = setOf("openid")
    override fun convert(jwt: Jwt): AbstractAuthenticationToken {
        val subject = jwt.claims["sub"] as? String ?: invalidToken()
        val rawScope = jwt.claims["scope"] as? String ?: invalidToken()
        val presented = rawScope.split(' ').filter(String::isNotBlank)
        if (subject.isBlank() || presented.size != presented.toSet().size ||
            presented.any { it !in scopeMap && it !in nonAuthorityScopes }) invalidToken()
        return JwtAuthenticationToken(
            jwt,
            presented.mapNotNull(scopeMap::get).map(::SimpleGrantedAuthority),
            subject,
        )
    }
    private fun invalidToken(): Nothing = throw OAuth2AuthenticationException(
        BearerTokenErrors.invalidToken("invalid claim shape"),
    )
}
```

```kotlin
@Configuration
@EnableConfigurationProperties(OidcProperties::class)
class JwtConfiguration {
    @Bean
    fun utcClock(): Clock = Clock.systemUTC()

    @Bean
    fun jwtDecoder(properties: OidcProperties): JwtDecoder {
        val decoder = NimbusJwtDecoder.withJwkSetUri(properties.jwkSetUri).build()
        decoder.setJwtValidator(
            DelegatingOAuth2TokenValidator(
                JwtValidators.createDefaultWithIssuer(properties.issuer),
                AudienceValidator(properties.audience),
                ClientIdValidator(properties.clientId),
                CognitoClaimShapeValidator(),
            ),
        )
        return decoder
    }
}

@Configuration
@EnableMethodSecurity
class SecurityConfiguration(
    private val objectMapper: ObjectMapper,
    private val strictJwtAuthenticationConverter: StrictJwtAuthenticationConverter,
) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain = http
        .csrf { it.disable() }
        .httpBasic { it.disable() }
        .formLogin { it.disable() }
        .requestCache { it.disable() }
        .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
        .authorizeHttpRequests {
            it.requestMatchers("/actuator/health/liveness", "/actuator/health/readiness").permitAll()
                .requestMatchers("/v1/**").authenticated()
                .anyRequest().denyAll()
        }
        .oauth2ResourceServer { resource ->
            resource.jwt { it.jwtAuthenticationConverter(strictJwtAuthenticationConverter) }
            resource.authenticationEntryPoint { _, response, _ -> writeProblem(response, 401, "Unauthorized") }
        }
        .exceptionHandling {
            it.accessDeniedHandler { _, response, _ -> writeProblem(response, 403, "Forbidden") }
        }
        .build()

    private fun writeProblem(response: HttpServletResponse, status: Int, title: String) {
        response.status = status
        response.contentType = MediaType.APPLICATION_PROBLEM_JSON_VALUE
        objectMapper.writeValue(
            response.outputStream,
            ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(status), title),
        )
    }
}

@Component
class CallerPrincipalResolver {
    fun resolve(authentication: Authentication): CallerPrincipal {
        val token = (authentication as? JwtAuthenticationToken)?.token
            ?: throw AccessDeniedException("verified JWT required")
        val subject = token.claims["sub"] as? String ?: throw AccessDeniedException("invalid subject")
        val scopes = authentication.authorities.map { authority ->
            require(authority.authority.startsWith("SCOPE_")) { "unsupported authority" }
            authority.authority.removePrefix("SCOPE_")
        }.toSet()
        return CallerPrincipal(subject, scopes, DataRegion.KR)
    }
}
```

Add the narrow sensitive-action port and its JWT adapter. It accepts only the already validated `JwtAuthenticationToken`, derives the subject internally, and returns no raw claims or token value:

```kotlin
package kr.co.genomecompanion.identityaccount.api

enum class SensitiveAction(val requiredScope: String) {
    EXPORT_RECORDS("records:export"),
    RESET_PROFILE("profile:reset"),
}

data class SensitiveActionAuthorization(
    val principal: CallerPrincipal,
    val action: SensitiveAction,
    val authenticatedAt: Instant,
    val assurancePolicy: String,
)

data class SensitiveActionAssuranceRequirement(
    val action: SensitiveAction,
    val requiredScope: String,
    val maxAuthAgeSeconds: Long,
    val assurancePolicy: String,
    val region: DataRegion,
) {
    companion object {
        fun forAction(action: SensitiveAction) = SensitiveActionAssuranceRequirement(
            action = action,
            requiredScope = action.requiredScope,
            maxAuthAgeSeconds = 300,
            assurancePolicy = "cognito_mfa_required_pool",
            region = DataRegion.KR,
        )
    }
}

enum class SensitiveActionDenial(val code: String) {
    RECENT_AUTHENTICATION_REQUIRED("recent_authentication_required"),
    INSUFFICIENT_ACTION_SCOPE("insufficient_action_scope"),
    SENSITIVE_ACTION_DENIED("sensitive_action_denied"),
}

fun interface SensitiveActionAuthorizer {
    fun requireAuthorized(
        authentication: Authentication,
        action: SensitiveAction,
    ): SensitiveActionAuthorization
}

class SensitiveActionDeniedException(
    val action: SensitiveAction,
    val denial: SensitiveActionDenial,
) : AccessDeniedException("sensitive action denied")
```

```kotlin
package kr.co.genomecompanion.identityaccount.security

@Component
class JwtSensitiveActionAuthorizer(
    private val principalResolver: CallerPrincipalResolver,
    private val clock: Clock,
) : SensitiveActionAuthorizer {
    companion object {
        private val MAX_AGE = Duration.ofMinutes(5)
        private const val ASSURANCE_POLICY = "cognito_mfa_required_pool"
    }

    override fun requireAuthorized(
        authentication: Authentication,
        action: SensitiveAction,
    ): SensitiveActionAuthorization {
        val jwtAuthentication = authentication as? JwtAuthenticationToken
            ?: denied(action, SensitiveActionDenial.SENSITIVE_ACTION_DENIED)
        if (!jwtAuthentication.isAuthenticated) denied(action, SensitiveActionDenial.SENSITIVE_ACTION_DENIED)
        val token = jwtAuthentication.token
        val principal = try {
            principalResolver.resolve(jwtAuthentication)
        } catch (_: RuntimeException) {
            denied(action, SensitiveActionDenial.SENSITIVE_ACTION_DENIED)
        }
        if (principal.subjectId.isBlank() || principal.region != DataRegion.KR) {
            denied(action, SensitiveActionDenial.SENSITIVE_ACTION_DENIED)
        }
        if (action.requiredScope !in principal.scopes) denied(action, SensitiveActionDenial.INSUFFICIENT_ACTION_SCOPE)

        val authTime = when (val claim = token.claims["auth_time"]) {
            is Instant -> claim
            is Number -> Instant.ofEpochSecond(claim.toLong())
            else -> denied(action, SensitiveActionDenial.RECENT_AUTHENTICATION_REQUIRED)
        }
        val age = Duration.between(authTime, clock.instant())
        if (age.isNegative || age > MAX_AGE) denied(action, SensitiveActionDenial.RECENT_AUTHENTICATION_REQUIRED)

        return SensitiveActionAuthorization(principal, action, authTime, ASSURANCE_POLICY)
    }

    private fun denied(action: SensitiveAction, denial: SensitiveActionDenial): Nothing =
        throw SensitiveActionDeniedException(action, denial)
}
```

Map every denial to the same non-sensitive RFC 9457 shape; the code tells UX whether a fresh Cognito login plus required TOTP ceremony can resolve it:

```kotlin
package kr.co.genomecompanion.identityaccount.security

@RestControllerAdvice
class SensitiveActionProblemHandler {
    @ExceptionHandler(SensitiveActionDeniedException::class)
    fun handle(exception: SensitiveActionDeniedException): ResponseEntity<ProblemDetail> {
        val problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.FORBIDDEN,
            "Sensitive action requirements are not satisfied.",
        )
        problem.type = URI.create("https://api.genome-companion.kr/problems/sensitive-action")
        problem.title = "Sensitive action not authorized"
        problem.setProperty("code", exception.denial.code)
        problem.setProperty("assurance", SensitiveActionAssuranceRequirement.forAction(exception.action))
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .cacheControl(CacheControl.noStore())
            .body(problem)
    }
}
```

The adapter has no logger and never formats `Authentication`, `Jwt`, claims, credentials, or token values. REC export/profile-reset controllers consume only `SensitiveActionAuthorization.principal`; a request body subject is never accepted. A fresh MFA for `EXPORT_RECORDS` cannot authorize `RESET_PROFILE` without the distinct `profile:reset` scope.

Use this exact bounded-worker token contract and signer:

```kotlin
@JvmInline
value class SignedJwt(val compact: String)

@JvmInline
value class OpaqueSubjectRef(val value: String) {
    init {
        require(value.matches(Regex("^sub_[A-Za-z0-9_-]{22,64}$")))
    }
}

enum class WorkerPurpose(val claimValue: String) {
    PERSONAL_RECORD_EXPLANATION("personal_record_explanation"),
}

interface WorkloadTokenIssuer {
    fun issueServiceToken(): SignedJwt
    fun issuePurposeToken(subject: OpaqueSubjectRef, jti: UUID, purpose: WorkerPurpose): SignedJwt
}

object Ed25519PrivateKeyDecoder {
    fun fromPkcs8Base64(encoded: String): PrivateKey = KeyFactory.getInstance("Ed25519")
        .generatePrivate(PKCS8EncodedKeySpec(Base64.getDecoder().decode(encoded)))
}
```

```kotlin
class Ed25519WorkloadTokenIssuer(
    private val keyId: String,
    private val privateKey: PrivateKey,
    private val mapper: ObjectMapper,
    private val clock: Clock,
) : WorkloadTokenIssuer {
    companion object {
        private const val ISSUER = "genome-companion-core-api"
        private const val AUDIENCE = "explanation-worker"
        private const val LIFETIME_SECONDS = 120L
    }

    override fun issueServiceToken(): SignedJwt = sign(
        linkedMapOf<String, Any>(
            "iss" to ISSUER,
            "aud" to AUDIENCE,
            "sub" to "core-api",
        ),
    )

    override fun issuePurposeToken(
        subject: OpaqueSubjectRef,
        jti: UUID,
        purpose: WorkerPurpose,
    ): SignedJwt = sign(
        linkedMapOf<String, Any>(
            "iss" to ISSUER,
            "aud" to AUDIENCE,
            "sub" to subject.value,
            "jti" to jti.toString(),
            "purpose" to purpose.claimValue,
        ),
    )

    private fun sign(baseClaims: LinkedHashMap<String, Any>): SignedJwt {
        val issuedAt = clock.instant().epochSecond
        val claims = LinkedHashMap(baseClaims).apply {
            put("iat", issuedAt)
            put("exp", issuedAt + LIFETIME_SECONDS)
        }
        val header = linkedMapOf("alg" to "EdDSA", "kid" to keyId, "typ" to "JWT")
        val encoder = Base64.getUrlEncoder().withoutPadding()
        val signingInput = listOf(header, claims)
            .joinToString(".") { encoder.encodeToString(mapper.writeValueAsBytes(it)) }
        val signature = Signature.getInstance("Ed25519").run {
            initSign(privateKey)
            update(signingInput.toByteArray(StandardCharsets.US_ASCII))
            sign()
        }
        return SignedJwt("$signingInput.${encoder.encodeToString(signature)}")
    }
}

@Configuration
@Profile("!test")
class WorkloadTokenConfiguration {
    @Bean
    fun workloadTokenIssuer(
        @Value("\${WORKLOAD_TOKEN_KEY_ID}") keyId: String,
        @Value("\${WORKLOAD_TOKEN_PRIVATE_PKCS8_B64}") privateKey: String,
        mapper: ObjectMapper,
        clock: Clock,
    ): WorkloadTokenIssuer = Ed25519WorkloadTokenIssuer(
        keyId,
        Ed25519PrivateKeyDecoder.fromPkcs8Base64(privateKey),
        mapper,
        clock,
    )
}
```

The stable production bean reads one active `WORKLOAD_TOKEN_KEY_ID` and `WORKLOAD_TOKEN_PRIVATE_PKCS8_B64` from personal ECS secret injection. During the bounded rotation window, a new core task revision may additionally receive one exact-version next key plus the FND promotion-anchor table/key; it strongly reads the one conditional active anchor before every signing operation and chooses only the anchored `activeSignerKeyId`. Absence, stale fence, unknown key ID, or anchor/key-Version mismatch fails signing closed. The private values are never placed in a Spring property dump, log, build artifact, OpenTofu state, worker environment, or C0 task. The public document is strict and versioned: `{schemaVersion:"workload-jwks.v1",sequence,generatedAt,keys,documentDigest}` with at most one `previous`, one `current`, and one `next` Ed25519 key; `documentDigest` hashes RFC 8785 canonical `{schemaVersion,sequence,generatedAt,keys}` and excludes itself. Every `keys[]` row has exactly `{kty:"OKP",crv:"Ed25519",alg:"EdDSA",use:"sig",kid,x,role,notBefore,notAfter}` with `additionalProperties=false`; `kid` matches `^workload-[A-Za-z0-9_-]{1,64}$`, `x` matches `^[A-Za-z0-9_-]{43}$` and decodes to exactly 32 bytes, `role` is exactly `previous|current|next`, and `notBefore`/`notAfter` are UTC `Z` RFC 3339 instants with `notBefore < notAfter`. Key IDs, public material, and roles are unique. A row is eligible to verify only while `notBefore <= now < notAfter`; role controls the staged rotation set but never extends the interval. FND/security—not AI—wraps the document exactly as `{document,signatureBase64Url,releaseKeyId}` under `signed-workload-jwks-release.schema.json`. The Task 7B broker domain `workload-jwks-release` signs exactly the ASCII prefix `GC-WORKLOAD-JWKS-RELEASE-V1\0` followed by the exact RFC 8785 UTF-8 document bytes. A bare-document signature or another domain prefix is invalid. AI receives only the signed wrapper and FND public registry; it owns no builder, publisher, broker role, or private root.

The root-registry public document is exactly `{schemaVersion:"workload-jwks-root-registry.v1",sequence,generatedAt,roots,registryDigest}`. `registryDigest` hashes RFC 8785 bytes omitting only itself; sorted unique rows are exactly `{releaseKeyId,publicKeyRawBase64Url,publicKeySha256,notBefore,notAfter,state}` with state `next|active|retired|revoked`. Its strict signed wrapper is exactly `{registry,signatureBase64Url,registrySigningKeyId}` and the Task 7B `workload-jwks-root-registry` domain signs `GC-WORKLOAD-JWKS-ROOT-REGISTRY-V1\0 || RFC8785(registry)`. Trust bootstraps from the separately ceremony-created, second-apply-pinned FND broker public root bundle—not from a self-signed registry. The first registry may be produced only after that broker ceremony. Rotation publishes a higher registry with the release-domain next key, requires both broker results plus distinct domain/security OIDC receipts, proves every worker trusts active+next, then activates the new release key and later retires the old row. `workload_jwks_root_registry_sha256` is the lowercase `sha256:` digest of the exact signed-registry wrapper bytes; lower/equivocating sequence, first-seen retired key, revoked key, missing broker-bundle root, or cross-domain signature fails. Builders take public JSON only, run twice and byte-compare, mutate every covered field, reject duplicate keys/noncanonical encodings, and expose no private-key parameter.

Production key material is created before either public document and never comes from `workload-jwks-public-input.json`. That file is a strict public policy template only: `{schemaVersion:"workload-jwks-public-input.v1",issuer,audience,tokenLifetimeSeconds,desiredRole,notBefore,notAfter,sourceSha,inputDigest}`; it contains no `kid`, `x`, private bytes, Secret ARN, or VersionId. `workload-jwks-keygen-request.v1` is exactly `{schemaVersion,requestId,operation,expectedActiveFence,notBefore,notAfter,sourceSha,requestedAt,expiresAt,requestSha256}`, where `operation=initial|rotate`, expiry is at most 15 minutes, initial requires fence 0/absent ACTIVE, rotate requires the exact current fence, and the self-digest omits only itself. The FND no-NAT `prepare-key` state-machine mode runs a one-shot memory-only Ed25519 generator, writes one strict private Secret version through Secrets Manager under `app_health_kms_key_arn`, derives its public key, sample-signs/verifies `GC-WORKLOAD-KEY-CORRESPONDENCE-V1\0 || requestSha256`, wipes mutable buffers best-effort, destroys the task, and writes an Object-Lock result exactly `{schemaVersion:"workload-jwks-keygen-result.v1",requestSha256,kid,publicKeyRawBase64Url,publicKeySha256,privateKeyVersionIdSha256,notBefore,notAfter,executedAt,resultSha256}`. No output/state/log/env/file contains the private value or raw VersionId; the private coordinate is stored only in the conditional internal candidate row. The public builder exact-fetches that result and constructs both documents from its `kid/x/times`; `stage` resolves the internal row, re-derives public bytes from the exact secret VersionId, repeats the correspondence proof, and rejects a changed/missing/orphaned mapping. Abort/expiry deletes only an unused key version after proving no candidate, task definition, reservation, or ACTIVE row references it. Fixed fixtures/mutations cover mismatched public/private key, reused bytes/kid, wrong fence/time/source, leaked VersionId/private field, partial write, retry/equivocation, and cleanup.

Workload rotation uses a staged public trust snapshot and one atomic signer-authority transaction. Before any release reservation, `workload_jwks_ceremony.py` deterministically builds the public release and registry, uploads exact-version immutable bytes through `ai_artifact_signing_publisher_role_arn`, constructs each generic core, pauses for one domain-owner and one security receipt from the disjoint workflows, invokes only `ai_artifact_signing_state_machine_arn`, exact-fetches each Object-Lock result, verifies the exact-Version broker bundle/key/prefix/signature locally, constructs both wrappers, and emits only immutable `workload-jwks-prepared-pair.v1`. That pre-plan ceremony cannot write the runtime-control table, an active set, a release reservation, signer `ACTIVE`, or a mutable Secret stage. After an approved `first_install|workload_key` reservation, the FND promotion state machine's `stage` mode exact-fetches the prepared pair, resolves and re-verifies the private-key VersionId already created by `prepare-key`, conditionally writes one non-active candidate row binding all three coordinates/sequence/prior fence/core inputs, and atomically writes `control#artifact#workload-jwks` plus the complete six-domain `control#artifact-active-set` with workload status `staged`; it never generates or replaces private key material. Secret labels are non-authoritative retriable bookkeeping. AI deploys only workers pinned to both candidate public VersionIds/digests after `workloadStageTerminal`; they validate that exact staged dual-key snapshot, retain the prior current verification key on upgrades, refuse first-install user traffic, and produce the FND-schema two-snapshot quorum. Before `StartExecution`, the release client writes one immutable promotion intent, conditionally binds its deterministic execution name and request digest into the same-fence release reservation, and stores separate `workloadPromotionIntent` progress; the promotion state machine rejects every mutation unless that intent, reservation digest, fencing-token digest, staged active-set digest, and `recoveryOwnerRunId=null` still match. For an upgrade, `promote` exact-fetches the quorum, registers and deploys a dual-key core revision with exact old/candidate private-key VersionIds, proves two stable core readiness observations, and rechecks worker quorum. For `releaseKind=first_install`, there is no old key or prior core revision: it deploys a candidate-only core revision, proves the same readiness, and a pre-transaction failure returns core and AI services to zero. Only then does one cross-table DynamoDB transaction create/replace signer `ACTIVE`, mark the same workload artifact row `active`, publish the next-fence active set, and record the promotion terminal. Core signs nothing if its strongly consistent signer-anchor read is absent/stale and begins using the new key only after that transaction. An upgrade failure before the transaction restores the prior core revision while leaving the bounded staged dual-key public residue for exact retry or higher-sequence correction; a failure after it never restores the prior worker/public/signer tuple and requires a higher-sequence corrective promotion. Component `AWSCURRENT` labels move afterward idempotently and do not authorize runtime behavior. The release keeps old/new public/private versions for at least 150 seconds and until all references drain. Lower/equivocating sequence, illegal status/fence, duplicate role/kid, unknown key shape, changed receipt/result, task-definition/quorum drift, signing before the transaction, early retirement, or failure after any individual secret/key/label/service write fails closed. Worker verification accepts only `alg=EdDSA`, a bounded `kid` in the verified document, exact issuer/audience, expiration with at most 30 seconds skew, and endpoint token type. PUB's separate `PublicDataApplication` scans only `kr.co.genomecompanion.publicdata` and loads only `application-publicdata`, so none of these personal configurations can enter C0.

This disables HTTP basic, form login, request caching, server sessions, and CSRF; permits only readiness/liveness; requires authentication for `/v1/**`; denies every unmatched route; and returns RFC 9457 JSON without echoing headers or tokens. The strict authentication converter recognizes `openid` as the sole non-authority scope, drops it, and maps the four exact Cognito-qualified resource scopes to the four internal `SCOPE_*` authorities once; both method security and `CallerPrincipalResolver` consume that same result. It rejects `profile`, `email`, multi-valued/non-string audience, blank/non-string `sub` or `client_id`, list/bare/duplicate/mixed/unknown scope, and boolean/non-numeric `auth_time` as stable invalid-token responses rather than conversion exceptions. Spring has already validated issuer, the single URL-valued API resource audience, and the exact web `client_id`; a caller cannot invent an internal authority string.

Use this production configuration:

```yaml
security:
  oidc:
    issuer: ${OIDC_ISSUER}
    jwk-set-uri: ${OIDC_JWK_SET_URI}
    audience: ${OIDC_AUDIENCE}
    client-id: ${OIDC_CLIENT_ID}
server:
  forward-headers-strategy: framework
  error:
    include-message: never
    include-binding-errors: never
management:
  endpoints:
    web:
      exposure:
        include: health,prometheus
  endpoint:
    health:
      probes:
        enabled: true
spring:
  mvc:
    log-request-details: false
  lifecycle:
    timeout-per-shutdown-phase: 30s
```

Use this offline test configuration so startup never performs network discovery:

```yaml
security:
  oidc:
    issuer: https://issuer.test.invalid
    jwk-set-uri: https://issuer.test.invalid/.well-known/jwks.json
    audience: https://api.genome-companion.kr
    client-id: synthetic-web-client
```

- [ ] **Step 4: Run positive and negative authentication tests**

Run: `./gradlew --no-daemon :apps:core-api:test --tests '*SecurityConfigurationTest' --tests '*SensitiveActionAuthorizerTest' --tests '*SensitiveActionProblemHandlerTest' --tests '*WorkloadTokenIssuerTest' --tests '*ApplicationSmokeTest' --tests '*ModuleBoundaryTest' && python -m unittest scripts.tests.test_workload_jwks_release scripts.tests.test_workload_jwks_ceremony -v`

Expected: PASS; readiness is 200, anonymous `/v1` is 401, wrong resource audience or `client_id` is rejected, a valid synthetic JWT reaches the router and receives 404; sensitive actions require their exact foundation-normalized scope, KR-plane binding, and `auth_time` no more than five minutes old without a logging dependency; recent-auth denial returns the stable 403 assurance policy without token/subject material; both worker-token signatures/claim sets match the 120-second contract; public release/registry bytes are deterministic; both fixed prefixes including the NUL byte verify; bare/cross-domain signatures fail; and the test-only broker result/receipt vectors match Task 7B schemas. This does not claim production publication before Tasks 7B/7C exist.

- [ ] **Step 5: Commit identity enforcement**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/identityaccount apps/core-api/src/main/resources/application.yml apps/core-api/src/test apps/core-api/src/test/resources/application-test.yml packages/contracts/jsonschema/signed-workload-jwks-release.schema.json packages/contracts/jsonschema/workload-jwks-root-registry.schema.json packages/contracts/jsonschema/signed-workload-jwks-root-registry.schema.json packages/contracts/jsonschema/workload-jwks-keygen-request.schema.json packages/contracts/jsonschema/workload-jwks-keygen-result.schema.json packages/contracts/jsonschema/workload-jwks-prepared-pair.schema.json packages/contracts/fixtures/workload-jwks-release.valid.json packages/contracts/fixtures/workload-jwks-root-registry.valid.json packages/contracts/fixtures/workload-jwks-keygen-result.valid.json packages/contracts/fixtures/workload-jwks-prepared-pair.valid.json scripts/security/build_workload_jwks_documents.py scripts/security/workload_jwks_ceremony.py scripts/security/verify_workload_jwks_release.py scripts/tests/test_workload_jwks_release.py scripts/tests/test_workload_jwks_ceremony.py governance/cryptographic/workload-jwks-public-input.json
git commit -m "feat: enforce OIDC identity at the API boundary"
```

- [ ] **Step 6: Freeze the production publication checkpoint without dispatching it**

`workload-jwks-prepared-pair.v1` is the strict pre-plan public handoff and is exactly `{schemaVersion,sequence,registry:{secretArn,versionId,sha256,signingResult:{key,versionId,sha256}},release:{secretArn,versionId,sha256,signingResult:{key,versionId,sha256}},candidateSignerKeyVersionIdSha256,keygenResult:{key,versionId,sha256},rootBundle:{secretArn,versionId,sha256},preparedAt,preparedPairSha256}` with `additionalProperties:false`. It binds the two immutable public Secret versions and broker results, the nonsecret digest of the matching private-key VersionId, keygen correspondence result, exact root-bundle coordinate, and sequence; the self-digest omits only itself. It contains no release reservation/fence, active-set digest/status, worker quorum, signer ACTIVE claim, private VersionId/value, or mutable stage. Mutations confuse neither this schema nor `workload-jwks-public-stage-result.v1`.

Task 3 ends with deterministic builders, strict verifiers, and test-only broker vectors only. Production workload-JWKS preparation is deliberately deferred to Task 8 Step 6, after Task 7B has created the generic signer package/workflows, Task 7C has created the empty secrets and promotion state machine, and Task 8 has committed and verified every protected workflow. That checkpoint may produce only the immutable `workload-jwks-prepared-pair.v1`; it cannot write the runtime-control table, `AWSCURRENT`, a release reservation, an active set, or signer ACTIVE. Task 3 itself must not dispatch a workflow or fabricate a production coordinate. Its tests require `workload_jwks_ceremony.py` to reject production subcommands without exact Task 7C outputs and the immutable Task 8 workflow-verification record; the authorized prepared-pair → post-reservation stage → worker quorum → promote lifecycle occurs only inside a later approved release.

---

### Task 4: Add durable consent receipts and purpose authorization

**Files:**
- Create: `packages/contracts/openapi/consent-api-v1.yaml`
- Modify: `gradle/libs.versions.toml`
- Modify: `apps/core-api/build.gradle.kts`
- Modify: `apps/core-api/gradle.lockfile`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/api/ConsentContracts.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/domain/ConsentGrant.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/application/ConsentApplicationService.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/application/ConsentReceiptSigner.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/application/ConsentOptionsService.kt`
- Create: `apps/core-api/src/main/resources/consent/consent-options-v1.json`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/application/ConsentBoundPurposeTokenAdapter.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/adapter/in/web/ConsentController.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/adapter/in/web/ConsentOptionsController.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose/adapter/out/jdbc/ConsentJdbcRepository.kt`
- Modify: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/documentintake/api/DocumentIntakePort.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/outbox/OutboxContracts.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/outbox/OutboxJdbcRepository.kt`
- Create: `apps/core-api/src/main/resources/db/migration/V1__fnd_consent_and_outbox.sql`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose/ConsentApplicationServiceTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose/ConsentBoundPurposeTokenAdapterTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose/ConsentControllerTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose/ConsentOptionsServiceTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose/ConsentJdbcRepositoryTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/contract/ConsentOpenApiContractTest.kt`

**Interfaces:**
- Consumes: `CallerPrincipal.subjectId`, secret-backed `SubjectPseudonymizer.digest(String): String`, Task 3 `WorkloadTokenIssuer`, database transaction, and injected `Clock`.
- Produces: `ConsentOptionsService.current(): ConsentOptionsView`; `ConsentService.grant(CallerPrincipal, GrantConsentCommand): ConsentView`; `list(CallerPrincipal): List<ConsentView>`; `revoke(CallerPrincipal, UUID): ConsentView`; `PurposeAuthorizer.requireAllowed(PurposeAccessRequest): ConsentAuthorization`; `DocumentUploadConsentGate.requireAllowed(DocumentUploadConsentRequest): DocumentUploadConsentAuthorization`; `ConsentBoundPurposeTokenAdapter.issue(ExplanationPurposeTokenRequest): SignedJwt`; durable outbox event `consent.revoked.v1`; OpenAPI 3.1 operations `getConsentOptions`, `grantConsent`, `listConsents`, and `revokeConsent`, which UX consumes for generated types.

- [ ] **Step 1: Write failing domain/application tests**

```kotlin
class ConsentApplicationServiceTest {
    private val clock = Clock.fixed(Instant.parse("2026-08-09T00:00:00Z"), ZoneOffset.UTC)
    private val repository = InMemoryConsentRepository()
    private val outbox = InMemoryOutboxRepository()
    private val pseudonymizer = SubjectPseudonymizer { "hmac256:" + "a".repeat(64) }
    private val service = ConsentApplicationService(repository, outbox, ConsentReceiptSigner(), pseudonymizer, clock)
    private val uploadGate = DualGrantDocumentUploadConsentGate(service)
    private val caller = CallerPrincipal("subject-17", setOf("consent:write"))

    @Test
    fun `timeline grant authorizes collection and explanation but not cloud processing or retention`() {
        val view = service.grant(
            caller,
            GrantConsentCommand(
                purpose = ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
                sources = setOf(DataSource.USER_UPLOAD),
                dataCategories = setOf(DataCategory.LAB_REPORT),
                operations = setOf(ConsentOperation.COLLECT, ConsentOperation.EXPLAIN),
                recipients = setOf("genome-companion-korea"),
                processorSetVersion = "kr-core-2026-08",
                noticeVersion = "privacy-notice-ko-v1",
                expiresAt = null,
            ),
        )

        assertThat(service.requireAllowed(PurposeAccessRequest(caller, view.consentId, ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE, DataCategory.LAB_REPORT, ConsentOperation.COLLECT, clock.instant())).allowed).isTrue()
        assertThat(service.requireAllowed(PurposeAccessRequest(caller, view.consentId, ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE, DataCategory.LAB_REPORT, ConsentOperation.EXPLAIN, clock.instant())).allowed).isTrue()
        assertThatThrownBy {
            service.requireAllowed(PurposeAccessRequest(caller, view.consentId, ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD, DataCategory.LAB_REPORT, ConsentOperation.COLLECT, clock.instant()))
        }.isInstanceOf(ConsentDeniedException::class.java)
        assertThatThrownBy {
            service.requireAllowed(PurposeAccessRequest(caller, view.consentId, ConsentPurpose.RETAIN_VERIFIED_SOURCE, DataCategory.LAB_REPORT, ConsentOperation.RETAIN, clock.instant()))
        }.isInstanceOf(ConsentDeniedException::class.java)
        assertThatThrownBy {
            service.grant(caller, validCommand().copy(operations = setOf(ConsentOperation.COLLECT)))
        }.isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `document upload requires distinct active timeline and cloud grants`() {
        val timeline = service.grant(caller, validCommand())
        assertThatThrownBy {
            uploadGate.requireAllowed(
                DocumentUploadConsentRequest(
                    caller,
                    timeline.consentId,
                    timeline.consentId,
                    DataCategory.LAB_REPORT,
                    clock.instant(),
                ),
            )
        }.isInstanceOf(ConsentDeniedException::class.java)

        val cloud = service.grant(caller, cloudCommand())
        val authorization = uploadGate.requireAllowed(
            DocumentUploadConsentRequest(
                caller,
                timeline.consentId,
                cloud.consentId,
                DataCategory.LAB_REPORT,
                clock.instant(),
            ),
        )
        assertThat(authorization.timelineConsentId).isEqualTo(timeline.consentId)
        assertThat(authorization.cloudConsentId).isEqualTo(cloud.consentId)
        assertThat(authorization.subjectId).isEqualTo(caller.subjectId)
    }

    @Test
    fun `cloud and retention grants are separate explicit and retention is reversible`() {
        val cloud = service.grant(caller, cloudCommand())
        assertThat(cloud.operations).containsExactlyInAnyOrder(
            ConsentOperation.COLLECT,
            ConsentOperation.EXTRACT,
            ConsentOperation.NORMALIZE,
        )
        assertThat(service.list(caller)).noneMatch { it.purpose == ConsentPurpose.RETAIN_VERIFIED_SOURCE }

        val retention = service.grant(caller, retentionCommand())
        assertThat(service.requireAllowed(PurposeAccessRequest(caller, retention.consentId, ConsentPurpose.RETAIN_VERIFIED_SOURCE, DataCategory.LAB_REPORT, ConsentOperation.RETAIN, clock.instant())).allowed).isTrue()
        service.revoke(caller, retention.consentId)
        assertThatThrownBy {
            service.requireAllowed(PurposeAccessRequest(caller, retention.consentId, ConsentPurpose.RETAIN_VERIFIED_SOURCE, DataCategory.LAB_REPORT, ConsentOperation.RETAIN, clock.instant()))
        }.isInstanceOf(ConsentDeniedException::class.java)
    }

    @Test
    fun `revocation is idempotent and creates one durable event`() {
        val granted = service.grant(caller, validCommand())
        service.revoke(caller, granted.consentId)
        service.revoke(caller, granted.consentId)
        assertThat(outbox.events("consent.revoked.v1")).hasSize(1)
    }

    private fun validCommand() = GrantConsentCommand(
        purpose = ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
        sources = setOf(DataSource.USER_UPLOAD),
        dataCategories = setOf(DataCategory.LAB_REPORT),
        operations = setOf(ConsentOperation.COLLECT, ConsentOperation.EXPLAIN),
        recipients = setOf("genome-companion-korea"),
        processorSetVersion = "kr-core-2026-08",
        noticeVersion = "privacy-notice-ko-v1",
        expiresAt = null,
    )

    private fun cloudCommand() = GrantConsentCommand(
        purpose = ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
        sources = setOf(DataSource.USER_UPLOAD),
        dataCategories = setOf(DataCategory.LAB_REPORT),
        operations = setOf(ConsentOperation.COLLECT, ConsentOperation.EXTRACT, ConsentOperation.NORMALIZE),
        recipients = setOf("genome-companion-korea"),
        processorSetVersion = "kr-processors-2026-08",
        noticeVersion = "privacy-notice-ko-v1",
        expiresAt = Instant.parse("2026-08-10T00:00:00Z"),
    )

    private fun retentionCommand() = GrantConsentCommand(
        purpose = ConsentPurpose.RETAIN_VERIFIED_SOURCE,
        sources = setOf(DataSource.USER_UPLOAD),
        dataCategories = setOf(DataCategory.LAB_REPORT),
        operations = setOf(ConsentOperation.RETAIN),
        recipients = setOf("genome-companion-korea"),
        processorSetVersion = "kr-storage-2026-08",
        noticeVersion = "privacy-notice-ko-v1",
        expiresAt = Instant.parse("2027-08-09T00:00:00Z"),
    )

    private class InMemoryConsentRepository : ConsentRepository {
        private val rows = linkedMapOf<UUID, ConsentGrant>()
        override fun insert(grant: ConsentGrant): ConsentGrant = grant.also { rows[it.consentId] = it }
        override fun save(grant: ConsentGrant): ConsentGrant = grant.also { rows[it.consentId] = it }
        override fun findByIdForSubject(consentId: UUID, subjectId: String): ConsentGrant? =
            rows[consentId]?.takeIf { it.subjectId == subjectId }
        override fun listBySubject(subjectId: String): List<ConsentGrant> =
            rows.values.filter { it.subjectId == subjectId }
    }

    private class InMemoryOutboxRepository : OutboxRepository {
        private val rows = linkedMapOf<UUID, OutboxEvent>()
        override fun insert(event: OutboxEvent): Boolean = rows.putIfAbsent(event.eventId, event) == null
        fun events(type: String): List<OutboxEvent> = rows.values.filter { it.eventType == type }
    }
}
```

```kotlin
class ConsentBoundPurposeTokenAdapterTest {
    @Test
    fun `active explain consent is translated to the exact AI purpose-token contract`() {
        val caller = CallerPrincipal("cognito-subject-7", setOf("explanation:request"))
        val consentId = UUID.fromString("00000000-0000-0000-0000-000000000020")
        val jti = UUID.fromString("00000000-0000-0000-0000-000000000021")
        val authorizationRequests = mutableListOf<PurposeAccessRequest>()
        val authorizer = PurposeAuthorizer { request ->
            authorizationRequests += request
            ConsentAuthorization(true, request.consentId, request.caller.subjectId, DataRegion.KR, request.purpose)
        }
        val issuer = RecordingWorkloadTokenIssuer()
        val adapter = ConsentBoundPurposeTokenAdapter(
            authorizer = authorizer,
            tokenIssuer = issuer,
            subjectRefs = OpaqueSubjectRefFactory { OpaqueSubjectRef("sub_AAAAAAAAAAAAAAAAAAAAAA") },
            clock = Clock.fixed(Instant.parse("2026-08-09T00:00:00Z"), ZoneOffset.UTC),
        )

        val token = adapter.issue(
            ExplanationPurposeTokenRequest(caller, consentId, DataCategory.LAB_REPORT, jti),
        )

        assertThat(token.compact).isEqualTo("signed-purpose-token")
        assertThat(authorizationRequests.single().operation).isEqualTo(ConsentOperation.EXPLAIN)
        assertThat(issuer.lastPurpose).isEqualTo(WorkerPurpose.PERSONAL_RECORD_EXPLANATION)
        assertThat(issuer.lastSubject).isEqualTo(OpaqueSubjectRef("sub_AAAAAAAAAAAAAAAAAAAAAA"))
        assertThat(issuer.lastJti).isEqualTo(jti)
    }

    private class RecordingWorkloadTokenIssuer : WorkloadTokenIssuer {
        var lastSubject: OpaqueSubjectRef? = null
        var lastJti: UUID? = null
        var lastPurpose: WorkerPurpose? = null
        override fun issueServiceToken() = SignedJwt("signed-service-token")
        override fun issuePurposeToken(subject: OpaqueSubjectRef, jti: UUID, purpose: WorkerPurpose): SignedJwt {
            lastSubject = subject
            lastJti = jti
            lastPurpose = purpose
            return SignedJwt("signed-purpose-token")
        }
    }
}
```

Write the OpenAPI contract test before creating the file. It compares generated-client inputs to the native Kotlin enums instead of maintaining a second hand-written assertion list:

```kotlin
package kr.co.genomecompanion.contract

class ConsentOpenApiContractTest {
    private val repository = Path.of("../..").toAbsolutePath().normalize()
    private val api = ObjectMapper(YAMLFactory()).registerKotlinModule().readTree(
        repository.resolve("packages/contracts/openapi/consent-api-v1.yaml").toFile(),
    )

    @Test
    fun `consent operation ids and scopes are stable for generated clients`() {
        assertThat(api.path("openapi").asText()).isEqualTo("3.1.0")
        assertThat(api.at("/paths/~1v1~1consents/post/operationId").asText()).isEqualTo("grantConsent")
        assertThat(api.at("/paths/~1v1~1consents/get/operationId").asText()).isEqualTo("listConsents")
        assertThat(api.at("/paths/~1v1~1consents~1{consentId}/delete/operationId").asText()).isEqualTo("revokeConsent")
        assertThat(strings("/paths/~1v1~1consents/post/security/0/oauth2")).containsExactly("consent:write")
        assertThat(strings("/paths/~1v1~1consents/get/security/0/oauth2")).containsExactly("consent:read")
        assertThat(strings("/paths/~1v1~1consents~1{consentId}/delete/security/0/oauth2")).containsExactly("consent:write")
        assertThat(api.at("/paths/~1v1~1consent-options/get/operationId").asText()).isEqualTo("getConsentOptions")
        assertThat(strings("/paths/~1v1~1consent-options/get/security/0/oauth2")).containsExactly("consent:read")
    }

    @Test
    fun `schemas match native enums request response and receipt`() {
        assertThat(strings("/components/schemas/ConsentPurpose/enum"))
            .containsExactlyElementsOf(ConsentPurpose.entries.map { it.name })
        assertThat(strings("/components/schemas/ConsentOperation/enum"))
            .containsExactlyElementsOf(ConsentOperation.entries.map { it.name })
        assertThat(strings("/components/schemas/DataCategory/enum"))
            .containsExactlyElementsOf(DataCategory.entries.map { it.name })
        assertThat(strings("/components/schemas/DataSource/enum"))
            .containsExactlyElementsOf(DataSource.entries.map { it.name })
        assertThat(strings("/components/schemas/GrantConsentRequest/required")).containsExactlyInAnyOrder(
            "purpose", "sources", "dataCategories", "operations", "recipients",
            "processorSetVersion", "noticeVersion", "expiresAt",
        )
        assertThat(strings("/components/schemas/ConsentView/required")).containsExactlyInAnyOrder(
            "consentId", "purpose", "sources", "dataCategories", "operations", "recipients",
            "processorSetVersion", "noticeVersion", "region",
            "grantedAt", "expiresAt", "revokedAt", "signatureReceipt",
        )
        assertThat(strings("/components/schemas/ConsentOptionsView/required")).containsExactlyInAnyOrder(
            "processorSetVersion", "noticeVersion", "recipients", "region",
            "cloudProcessingMaxHours", "retentionMaxDays", "noticeUrl", "effectiveAt", "configurationDigest",
        )
        assertThat(api.at("/components/schemas/ConsentView/properties/signatureReceipt/pattern").asText())
            .isEqualTo("^sha256:[0-9a-f]{64}$")
    }

    @Test
    fun `sensitive action assurance and problem remain machine readable`() {
        assertThat(strings("/components/schemas/SensitiveAction/enum"))
            .containsExactlyElementsOf(SensitiveAction.entries.map { it.name })
        assertThat(api.at("/components/schemas/SensitiveActionAssuranceRequirement/properties/maxAuthAgeSeconds/const").asLong())
            .isEqualTo(300)
        assertThat(api.at("/components/schemas/SensitiveActionAssuranceRequirement/properties/assurancePolicy/const").asText())
            .isEqualTo("cognito_mfa_required_pool")
        assertThat(api.at("/components/schemas/SensitiveActionAssuranceRequirement/properties/region/const").asText())
            .isEqualTo("KR")
        assertThat(strings("/components/schemas/SensitiveActionProblem/properties/code/enum"))
            .containsExactlyElementsOf(SensitiveActionDenial.entries.map { it.code })
        assertThat(api.at("/components/responses/RecentSensitiveActionRequired/x-http-status").asInt()).isEqualTo(403)
    }

    private fun strings(pointer: String): List<String> = api.at(pointer).map { it.asText() }
}
```

The controller test must prove that a caller cannot put another subject in the JSON body, cannot list another subject's grants, receives 403 without `consent:write`, and receives 404 rather than a cross-subject existence oracle when revoking another user's UUID.

- [ ] **Step 2: Run consent tests and confirm the red state**

Run: `./gradlew --no-daemon :apps:core-api:test --tests '*ConsentApplicationServiceTest' --tests '*ConsentBoundPurposeTokenAdapterTest' --tests '*ConsentControllerTest' --tests '*ConsentOpenApiContractTest'`

Expected: compilation FAIL for absent consent types/service and YAML parser, then file-not-found once compilation dependencies exist but the OpenAPI contract has not yet been created.

- [ ] **Step 3: Implement exact contracts and transaction rules**

Add the Spring Boot BOM-managed YAML parser to the shared catalog and test configuration, then refresh the committed lock; UX and later workstreams must not add a second OpenAPI/YAML version:

```toml
jackson-yaml = { module = "com.fasterxml.jackson.dataformat:jackson-dataformat-yaml" }
```

```kotlin
testImplementation(libs.jackson.yaml)
```

Run: `./gradlew :apps:core-api:dependencies --write-locks`

Expected: only `apps/core-api/gradle.lockfile` changes, adding the Spring Boot 3.5.7 BOM-selected YAML parser and its exact transitive versions.

```kotlin
enum class ConsentPurpose {
    BUILD_PERSONAL_LAB_TIMELINE,
    PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
    RETAIN_VERIFIED_SOURCE,
}
enum class DataSource { USER_UPLOAD }
enum class DataCategory { LAB_REPORT, MEDICAL_RECORD }
enum class ConsentOperation { COLLECT, EXTRACT, NORMALIZE, EXPLAIN, RETAIN }
class ConsentDeniedException : AccessDeniedException("consent denied")

fun interface SubjectPseudonymizer {
    fun digest(subjectId: String): String
}

interface ConsentRepository {
    fun insert(grant: ConsentGrant): ConsentGrant
    fun save(grant: ConsentGrant): ConsentGrant
    fun findByIdForSubject(consentId: UUID, subjectId: String): ConsentGrant?
    fun listBySubject(subjectId: String): List<ConsentGrant>
}

data class OutboxEvent(
    val eventId: UUID,
    val eventType: String,
    val aggregateId: UUID,
    val payload: String,
    val occurredAt: Instant,
)

fun interface OutboxRepository {
    fun insert(event: OutboxEvent): Boolean
}

data class GrantConsentCommand(
    val purpose: ConsentPurpose,
    val sources: Set<DataSource>,
    val dataCategories: Set<DataCategory>,
    val operations: Set<ConsentOperation>,
    val recipients: Set<String>,
    val processorSetVersion: String,
    val noticeVersion: String,
    val expiresAt: Instant?,
)

object ConsentGrantPolicy {
    private val exactOperations = mapOf(
        ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE to setOf(
            ConsentOperation.COLLECT,
            ConsentOperation.EXPLAIN,
        ),
        ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD to setOf(
            ConsentOperation.COLLECT,
            ConsentOperation.EXTRACT,
            ConsentOperation.NORMALIZE,
        ),
        ConsentPurpose.RETAIN_VERIFIED_SOURCE to setOf(ConsentOperation.RETAIN),
    )

    fun requireValid(command: GrantConsentCommand, now: Instant) {
        require(command.operations == exactOperations.getValue(command.purpose)) {
            "operations do not match the selected consent purpose"
        }
        require(command.sources == setOf(DataSource.USER_UPLOAD))
        require(command.dataCategories.isNotEmpty())
        require(command.recipients == setOf("genome-companion-korea"))
        if (command.purpose == ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD) {
            require(command.processorSetVersion.startsWith("kr-processors-")) {
                "cloud processing requires the versioned Korean processor set"
            }
            require(command.expiresAt != null && command.expiresAt > now && command.expiresAt <= now.plus(Duration.ofHours(24))) {
                "cloud processing consent must expire within 24 hours"
            }
        }
        if (command.purpose == ConsentPurpose.RETAIN_VERIFIED_SOURCE) {
            require(command.expiresAt != null && command.expiresAt > now && command.expiresAt <= now.plus(Duration.ofDays(365))) {
                "verified source retention must expire within 365 days"
            }
        }
    }
}

data class PurposeAccessRequest(
    val caller: CallerPrincipal,
    val consentId: UUID,
    val purpose: ConsentPurpose,
    val dataCategory: DataCategory,
    val operation: ConsentOperation,
    val at: Instant,
)

data class ConsentAuthorization(
    val allowed: Boolean,
    val consentId: UUID,
    val subjectId: String,
    val region: DataRegion,
    val purpose: ConsentPurpose,
)

data class ConsentView(
    val consentId: UUID,
    val purpose: ConsentPurpose,
    val sources: Set<DataSource>,
    val dataCategories: Set<DataCategory>,
    val operations: Set<ConsentOperation>,
    val recipients: Set<String>,
    val processorSetVersion: String,
    val noticeVersion: String,
    val region: DataRegion,
    val grantedAt: Instant,
    val expiresAt: Instant?,
    val revokedAt: Instant?,
    val signatureReceipt: String,
)

data class ConsentOptionsView(
    val processorSetVersion: String,
    val noticeVersion: String,
    val recipients: Set<String>,
    val region: DataRegion,
    val cloudProcessingMaxHours: Int,
    val retentionMaxDays: Int,
    val noticeUrl: URI,
    val effectiveAt: Instant,
    val configurationDigest: String,
)

fun interface ConsentOptionsService {
    /** Returns a release-pinned, subject-free configuration; it never accepts caller-provided versions. */
    fun current(): ConsentOptionsView
}

interface ConsentService {
    fun grant(caller: CallerPrincipal, command: GrantConsentCommand): ConsentView
    fun list(caller: CallerPrincipal): List<ConsentView>
    fun revoke(caller: CallerPrincipal, consentId: UUID): ConsentView
}

fun interface PurposeAuthorizer {
    fun requireAllowed(request: PurposeAccessRequest): ConsentAuthorization
}

data class DocumentUploadConsentRequest(
    val caller: CallerPrincipal,
    val timelineConsentId: UUID,
    val cloudConsentId: UUID,
    val dataCategory: DataCategory,
    val at: Instant,
)

data class DocumentUploadConsentAuthorization(
    val subjectId: String,
    val timelineConsentId: UUID,
    val cloudConsentId: UUID,
    val dataCategory: DataCategory,
    val region: DataRegion,
)

fun interface DocumentUploadConsentGate {
    fun requireAllowed(request: DocumentUploadConsentRequest): DocumentUploadConsentAuthorization
}

class DualGrantDocumentUploadConsentGate(
    private val purposeAuthorizer: PurposeAuthorizer,
) : DocumentUploadConsentGate {
    override fun requireAllowed(request: DocumentUploadConsentRequest): DocumentUploadConsentAuthorization {
        if (request.timelineConsentId == request.cloudConsentId) throw ConsentDeniedException()
        val timeline = purposeAuthorizer.requireAllowed(
            PurposeAccessRequest(
                request.caller,
                request.timelineConsentId,
                ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
                request.dataCategory,
                ConsentOperation.COLLECT,
                request.at,
            ),
        )
        val cloud = purposeAuthorizer.requireAllowed(
            PurposeAccessRequest(
                request.caller,
                request.cloudConsentId,
                ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
                request.dataCategory,
                ConsentOperation.COLLECT,
                request.at,
            ),
        )
        if (timeline.subjectId != cloud.subjectId || timeline.region != DataRegion.KR || cloud.region != DataRegion.KR) {
            throw ConsentDeniedException()
        }
        return DocumentUploadConsentAuthorization(
            timeline.subjectId,
            request.timelineConsentId,
            request.cloudConsentId,
            request.dataCategory,
            DataRegion.KR,
        )
    }
}
```

Replace the Task 2 intake DTO with the final compile-time handoff. REC cannot construct an authorized upload from request-body grant IDs; it must first call `DocumentUploadConsentGate` and pass its return value:

```kotlin
package kr.co.genomecompanion.documentintake.api

import kr.co.genomecompanion.consentpurpose.api.DocumentUploadConsentAuthorization

data class AuthorizedDocumentRequest(
    val authorization: DocumentUploadConsentAuthorization,
    val mediaType: String,
    val contentLength: Long,
)

fun interface DocumentIntakePort {
    fun requestUpload(request: AuthorizedDocumentRequest): UploadTicket
}
```

Continue the consent API implementation:

```kotlin

fun interface OpaqueSubjectRefFactory {
    fun fromSubjectId(subjectId: String): OpaqueSubjectRef
}

data class ExplanationPurposeTokenRequest(
    val caller: CallerPrincipal,
    val consentId: UUID,
    val dataCategory: DataCategory,
    val jti: UUID,
)

class ConsentBoundPurposeTokenAdapter(
    private val authorizer: PurposeAuthorizer,
    private val tokenIssuer: WorkloadTokenIssuer,
    private val subjectRefs: OpaqueSubjectRefFactory,
    private val clock: Clock,
) {
    fun issue(request: ExplanationPurposeTokenRequest): SignedJwt {
        authorizer.requireAllowed(
            PurposeAccessRequest(
                caller = request.caller,
                consentId = request.consentId,
                purpose = ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
                dataCategory = request.dataCategory,
                operation = ConsentOperation.EXPLAIN,
                at = clock.instant(),
            ),
        )
        return tokenIssuer.issuePurposeToken(
            subjectRefs.fromSubjectId(request.caller.subjectId),
            request.jti,
            WorkerPurpose.PERSONAL_RECORD_EXPLANATION,
        )
    }
}

class HmacOpaqueSubjectRefFactory(
    private val pseudonymizer: SubjectPseudonymizer,
) : OpaqueSubjectRefFactory {
    override fun fromSubjectId(subjectId: String): OpaqueSubjectRef {
        val hmacDigest = pseudonymizer.digest(subjectId)
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest("explanation-worker:personal_record_explanation:$hmacDigest".toByteArray(StandardCharsets.US_ASCII))
        val encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        return OpaqueSubjectRef("sub_$encoded")
    }
}

data class ConsentGrant(
    val consentId: UUID,
    val subjectId: String,
    val subjectDigest: String,
    val purpose: ConsentPurpose,
    val sources: Set<DataSource>,
    val dataCategories: Set<DataCategory>,
    val operations: Set<ConsentOperation>,
    val recipients: Set<String>,
    val region: DataRegion,
    val processorSetVersion: String,
    val noticeVersion: String,
    val grantedAt: Instant,
    val expiresAt: Instant?,
    val revokedAt: Instant?,
    val signatureReceipt: String,
)
```

Expose only the subject-free command at the HTTP boundary:

```kotlin
@RestController
@RequestMapping("/v1/consents")
class ConsentController(
    private val service: ConsentService,
    private val principals: CallerPrincipalResolver,
) {
    @PostMapping
    @PreAuthorize("hasAuthority('SCOPE_consent:write')")
    fun grant(authentication: Authentication, @Valid @RequestBody command: GrantConsentCommand): ConsentView =
        service.grant(principals.resolve(authentication), command)

    @GetMapping
    @PreAuthorize("hasAuthority('SCOPE_consent:read')")
    fun list(authentication: Authentication): List<ConsentView> =
        service.list(principals.resolve(authentication))

    @DeleteMapping("/{consentId}")
    @PreAuthorize("hasAuthority('SCOPE_consent:write')")
    fun revoke(authentication: Authentication, @PathVariable consentId: UUID): ConsentView =
        service.revoke(principals.resolve(authentication), consentId)
}
```

Expose the subject-free options through a separate authenticated controller so the route cannot inherit `/v1/consents`. `ReleasePinnedConsentOptionsService` loads one classpath JSON artifact, rejects duplicate keys/additional fields, and verifies `configurationDigest = sha256(RFC8785({processorSetVersion,noticeVersion,recipients,region,cloudProcessingMaxHours,retentionMaxDays,noticeUrl,effectiveAt}))`; the digest field itself is excluded, avoiding self-reference. The expected digest is a build-time constant generated and byte-compared by the Task 4 contract test. Startup rejects mismatch, lower version, or same-version/different-digest equivocation and returns only the frozen values. The current release fixes recipients to `["genome-companion-korea"]`, region to `KR`, cloud processing to 24 hours, retention to 365 days, and an HTTPS Korean notice URL. A request cannot override any field.

```kotlin
@RestController
class ConsentOptionsController(
    private val options: ConsentOptionsService,
) {
    @GetMapping("/v1/consent-options")
    @PreAuthorize("hasAuthority('SCOPE_consent:read')")
    fun current(): ConsentOptionsView = options.current()
}
```

Create the foundation-owned OpenAPI source at the shared contract root. It includes the subject-free options operation plus the three implemented receipt operations; sensitive-action types are reusable components for REC's later export/reset paths:

```yaml
openapi: 3.1.0
jsonSchemaDialect: https://json-schema.org/draft/2020-12/schema
info:
  title: Genome Companion Korea Consent API
  version: 1.0.0
paths:
  /v1/consent-options:
    get:
      operationId: getConsentOptions
      tags: [Consent]
      security:
        - oauth2: [consent:read]
      responses:
        '200':
          description: Release-pinned consent notice and processor options
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ConsentOptionsView'
        '401':
          $ref: '#/components/responses/ProblemResponse'
        '403':
          $ref: '#/components/responses/ProblemResponse'
  /v1/consents:
    post:
      operationId: grantConsent
      tags: [Consent]
      security:
        - oauth2: [consent:write]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GrantConsentRequest'
      responses:
        '200':
          description: Consent receipt created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ConsentView'
        '400':
          $ref: '#/components/responses/ProblemResponse'
        '401':
          $ref: '#/components/responses/ProblemResponse'
        '403':
          $ref: '#/components/responses/ProblemResponse'
    get:
      operationId: listConsents
      tags: [Consent]
      security:
        - oauth2: [consent:read]
      responses:
        '200':
          description: Subject-bound consent receipts
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ConsentView'
        '401':
          $ref: '#/components/responses/ProblemResponse'
        '403':
          $ref: '#/components/responses/ProblemResponse'
  /v1/consents/{consentId}:
    delete:
      operationId: revokeConsent
      tags: [Consent]
      security:
        - oauth2: [consent:write]
      parameters:
        - name: consentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Idempotently revoked consent receipt
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ConsentView'
        '401':
          $ref: '#/components/responses/ProblemResponse'
        '403':
          $ref: '#/components/responses/ProblemResponse'
        '404':
          $ref: '#/components/responses/ProblemResponse'
components:
  securitySchemes:
    oauth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.genome-companion.kr/oauth2/authorize
          tokenUrl: https://auth.genome-companion.kr/oauth2/token
          scopes:
            consent:read: Read the authenticated subject's consent receipts
            consent:write: Grant or revoke the authenticated subject's consent
  responses:
    ProblemResponse:
      description: Request rejected without sensitive-data echo
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/Problem'
    RecentSensitiveActionRequired:
      x-http-status: 403
      description: Sensitive action assurance or action scope is not satisfied
      headers:
        Cache-Control:
          required: true
          schema:
            type: string
            const: no-store
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/SensitiveActionProblem'
  schemas:
    ConsentPurpose:
      type: string
      enum:
        - BUILD_PERSONAL_LAB_TIMELINE
        - PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD
        - RETAIN_VERIFIED_SOURCE
    DataSource:
      type: string
      enum: [USER_UPLOAD]
    DataCategory:
      type: string
      enum: [LAB_REPORT, MEDICAL_RECORD]
    ConsentOperation:
      type: string
      enum: [COLLECT, EXTRACT, NORMALIZE, EXPLAIN, RETAIN]
    GrantConsentRequest:
      type: object
      additionalProperties: false
      required:
        - purpose
        - sources
        - dataCategories
        - operations
        - recipients
        - processorSetVersion
        - noticeVersion
        - expiresAt
      properties:
        purpose:
          $ref: '#/components/schemas/ConsentPurpose'
        sources:
          type: array
          minItems: 1
          uniqueItems: true
          items:
            $ref: '#/components/schemas/DataSource'
        dataCategories:
          type: array
          minItems: 1
          uniqueItems: true
          items:
            $ref: '#/components/schemas/DataCategory'
        operations:
          type: array
          minItems: 1
          uniqueItems: true
          items:
            $ref: '#/components/schemas/ConsentOperation'
        recipients:
          type: array
          minItems: 1
          uniqueItems: true
          items:
            type: string
            minLength: 3
            maxLength: 64
        processorSetVersion:
          type: string
          minLength: 8
          maxLength: 32
        noticeVersion:
          type: string
          minLength: 8
          maxLength: 64
        expiresAt:
          type: [string, 'null']
          format: date-time
    ConsentOptionsView:
      type: object
      additionalProperties: false
      required:
        - processorSetVersion
        - noticeVersion
        - recipients
        - region
        - cloudProcessingMaxHours
        - retentionMaxDays
        - noticeUrl
        - effectiveAt
        - configurationDigest
      properties:
        processorSetVersion:
          type: string
          minLength: 8
          maxLength: 32
        noticeVersion:
          type: string
          minLength: 8
          maxLength: 64
        recipients:
          type: array
          minItems: 1
          uniqueItems: true
          items:
            type: string
            minLength: 3
            maxLength: 64
        region:
          type: string
          const: KR
        cloudProcessingMaxHours:
          type: integer
          const: 24
        retentionMaxDays:
          type: integer
          const: 365
        noticeUrl:
          type: string
          format: uri
          pattern: '^https://'
        effectiveAt:
          type: string
          format: date-time
        configurationDigest:
          type: string
          pattern: '^sha256:[0-9a-f]{64}$'
    ConsentView:
      type: object
      additionalProperties: false
      required:
        - consentId
        - purpose
        - sources
        - dataCategories
        - operations
        - recipients
        - processorSetVersion
        - noticeVersion
        - region
        - grantedAt
        - expiresAt
        - revokedAt
        - signatureReceipt
      properties:
        consentId:
          type: string
          format: uuid
        purpose:
          $ref: '#/components/schemas/ConsentPurpose'
        sources:
          type: array
          minItems: 1
          uniqueItems: true
          items:
            $ref: '#/components/schemas/DataSource'
        dataCategories:
          type: array
          uniqueItems: true
          items:
            $ref: '#/components/schemas/DataCategory'
        operations:
          type: array
          uniqueItems: true
          items:
            $ref: '#/components/schemas/ConsentOperation'
        recipients:
          type: array
          minItems: 1
          uniqueItems: true
          items:
            type: string
            minLength: 3
            maxLength: 64
        processorSetVersion:
          type: string
          minLength: 8
          maxLength: 32
        noticeVersion:
          type: string
          minLength: 8
          maxLength: 64
        region:
          type: string
          const: KR
        grantedAt:
          type: string
          format: date-time
        expiresAt:
          type: [string, 'null']
          format: date-time
        revokedAt:
          type: [string, 'null']
          format: date-time
        signatureReceipt:
          type: string
          pattern: '^sha256:[0-9a-f]{64}$'
    Problem:
      type: object
      additionalProperties: true
      required: [type, title, status, detail]
      properties:
        type:
          type: string
          format: uri
        title:
          type: string
        status:
          type: integer
          minimum: 400
          maximum: 599
        detail:
          type: string
    SensitiveAction:
      type: string
      enum: [EXPORT_RECORDS, RESET_PROFILE]
    SensitiveActionAssuranceRequirement:
      type: object
      additionalProperties: false
      required: [action, requiredScope, maxAuthAgeSeconds, assurancePolicy, region]
      properties:
        action:
          $ref: '#/components/schemas/SensitiveAction'
        requiredScope:
          type: string
          enum: [records:export, profile:reset]
        maxAuthAgeSeconds:
          type: integer
          const: 300
        assurancePolicy:
          type: string
          const: cognito_mfa_required_pool
        region:
          type: string
          const: KR
    SensitiveActionProblem:
      type: object
      additionalProperties: false
      required: [type, title, status, detail, code, assurance]
      properties:
        type:
          type: string
          const: https://api.genome-companion.kr/problems/sensitive-action
        title:
          type: string
          const: Sensitive action not authorized
        status:
          type: integer
          const: 403
        detail:
          type: string
          const: Sensitive action requirements are not satisfied.
        code:
          type: string
          enum:
            - recent_authentication_required
            - insufficient_action_scope
            - sensitive_action_denied
        assurance:
          $ref: '#/components/schemas/SensitiveActionAssuranceRequirement'
```

UX Orval generation consumes only `packages/contracts/openapi/consent-api-v1.yaml`; UX must not hand-copy consent DTOs, enums, operation IDs, receipt fields, or the sensitive-action problem. The contract file is foundation-owned, so a schema change and its Kotlin contract-test change land atomically before generated UX clients are refreshed.

`ConsentApplicationService` implements both `ConsentService` and `PurposeAuthorizer`. Its `grant` method calls `ConsentGrantPolicy.requireValid(command, clock.instant())` before signing or writing, and rejects a processor-set version, notice version, recipient, region, or duration that differs from `ConsentOptionsService.current()`. It never creates a cloud or retention grant implicitly. A timeline grant is valid only with both `COLLECT` and `EXPLAIN`; a cloud-processing grant is valid only with all three cloud operations and must expire within 24 hours; a retention grant must have a non-null expiry no later than 365 days after grant, and renewal creates a new receipt rather than silently extending the old one. `DualGrantDocumentUploadConsentGate` is the only foundation authorization port for REC upload and checks two distinct active grant IDs: timeline/`COLLECT` and cloud/`COLLECT`; the exact-operation policy proves the latter grant also contains `EXTRACT` and `NORMALIZE`. `ConsentGrant.authorize` must fail if subject, region, purpose, category, operation, expiry, or revocation does not match. `ConsentReceiptSigner` hashes RFC 8785 canonical UTF-8 over the complete immutable receipt in this exact field set: `consentId`, opaque subject digest (never returned), `purpose`, sorted `sources`, sorted `dataCategories`, sorted `operations`, sorted `recipients`, `processorSetVersion`, `noticeVersion`, `region`, `grantedAt`, nullable `expiresAt`, and nullable `revokedAt`; it returns `sha256:` plus 64 lowercase hexadecimal characters. Tests mutate each field independently and prove the receipt changes, while sorted-set permutations do not. The transaction that sets `revoked_at` also inserts one outbox row with event ID equal to `UUID.nameUUIDFromBytes("consent.revoked.v1:{consentId}".toByteArray())`; the database unique key makes retries idempotent. Its encrypted outbox payload contains only `consent_id`, `subject_id`, `purpose`, `occurred_at`, and schema version `consent.revoked.v1`, so the deletion handler can create the exact consent scope without inferring it.

The migration must use this shape:

```sql
create table consent_grant (
    consent_id uuid primary key,
    subject_id varchar(128) not null,
    subject_digest char(72) not null,
    purpose varchar(64) not null,
    sources jsonb not null,
    data_categories jsonb not null,
    operations jsonb not null,
    recipients jsonb not null,
    region char(2) not null check (region = 'KR'),
    processor_set_version varchar(32) not null,
    notice_version varchar(64) not null,
    granted_at timestamptz not null,
    expires_at timestamptz null,
    revoked_at timestamptz null,
    signature_receipt char(71) not null,
    check (jsonb_array_length(sources) > 0),
    check (jsonb_array_length(data_categories) > 0),
    check (jsonb_array_length(operations) > 0)
);
create index consent_grant_subject_idx on consent_grant(subject_id, granted_at desc);
create index consent_grant_subject_digest_idx on consent_grant(subject_digest);

create table platform_outbox (
    event_id uuid primary key,
    event_type varchar(80) not null,
    aggregate_id uuid not null,
    payload jsonb not null,
    occurred_at timestamptz not null,
    published_at timestamptz null,
    attempts integer not null default 0 check (attempts >= 0)
);
create index platform_outbox_unpublished_idx on platform_outbox(occurred_at) where published_at is null;
```

- [ ] **Step 4: Add PostgreSQL isolation tests and run the complete consent slice**

Run: `./gradlew --no-daemon :apps:core-api:test --tests '*Consent*'`

Expected: PASS. Testcontainers proves subject-scoped reads, one revocation outbox event, complete-field stable receipt hashing, no authorization after revocation or expiry, upload denial unless distinct timeline and cloud grants are active, and purpose-token issuance only after an active `EXPLAIN` authorization with an opaque subject reference. The options artifact is duplicate-key/additional-field/rollback checked and its digest is deterministic. The OpenAPI 3.1 test locks `getConsentOptions`, `grantConsent`, `listConsents`, and `revokeConsent`, native enums/options/receipt fields, OAuth scopes, and the 300-second sensitive-action assurance problem at the shared Orval contract root.

- [ ] **Step 5: Commit consent and purpose enforcement**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/consentpurpose apps/core-api/src/main/kotlin/kr/co/genomecompanion/documentintake/api/DocumentIntakePort.kt apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/outbox apps/core-api/src/main/resources/consent/consent-options-v1.json apps/core-api/src/main/resources/db/migration/V1__fnd_consent_and_outbox.sql apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose apps/core-api/src/test/kotlin/kr/co/genomecompanion/contract/ConsentOpenApiContractTest.kt packages/contracts/openapi/consent-api-v1.yaml gradle/libs.versions.toml apps/core-api/build.gradle.kts apps/core-api/gradle.lockfile
git commit -m "feat: add durable consent and purpose authorization"
```

---

### Task 5: Make telemetry PHI-safe and audit events tamper-evident

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/telemetry/SafeTelemetry.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/telemetry/PhiSafeLogger.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/telemetry/CorrelationFilter.kt`
- Create: `apps/core-api/src/main/resources/logback-spring.xml`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/audit/api/AuditContracts.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/audit/application/AuditChain.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/audit/adapter/out/jdbc/AuditJdbcRepository.kt`
- Create: `apps/core-api/src/main/resources/db/migration/V2__fnd_security_audit.sql`
- Create: `ops/otel/collector.yaml`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/platform/telemetry/PhiSafeLoggerTest.kt`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/audit/AuditChainTest.kt`
- Test: `ops/otel/test_collector_policy.py`
- Modify: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/architecture/ModuleBoundaryTest.kt`

**Interfaces:**
- Consumes: `CallerPrincipal`, Task 4 secret-backed `SubjectPseudonymizer`, fixed event enums, correlation UUID, and JDBC transaction.
- Produces: `PhiSafeLogger.emit(TelemetryEvent, SafeTelemetryContext)`; `SecurityAuditAppender.append(NewSecurityAuditEvent): StoredSecurityAuditEvent`; `AuditChainVerifier.verify(List<StoredSecurityAuditEvent>): AuditVerification`.

- [ ] **Step 1: Write failing leakage and chain-integrity tests**

```kotlin
class PhiSafeLoggerTest {
    private val testLogger = LoggerFactory.getLogger("phi-safe-test") as ch.qos.logback.classic.Logger
    private val phiSafeLogger = PhiSafeLogger(testLogger)

    @Test
    fun `logger emits fixed event and safe context without sensitive values`() {
        val appender = ListAppender<ILoggingEvent>().also { it.start() }
        testLogger.addAppender(appender)

        phiSafeLogger.emit(
            TelemetryEvent.CONSENT_GRANTED,
            SafeTelemetryContext(
                correlationId = UUID.fromString("00000000-0000-0000-0000-000000000017"),
                routeTemplate = "/v1/consents",
                statusClass = "2xx",
                latencyMs = 12,
            ),
        )

        val rendered = appender.list.joinToString("\n") { it.formattedMessage + it.mdcPropertyMap }
        assertThat(rendered).contains("consent_granted")
        assertThat(rendered).doesNotContain("subject-17", "홍길동", "LDL", "140 mg/dL", "Bearer")
    }
}
```

```kotlin
class AuditChainTest {
    private val hasher = AuditChainHasher()
    private val verifier = AuditChainVerifier(hasher)

    @Test
    fun `verification detects mutation deletion and reordering`() {
        val chain = hasher.seal(listOf(newEvent(1), newEvent(2)))

        assertThat(verifier.verify(chain).valid).isTrue()
        assertThat(verifier.verify(chain.drop(1)).reason).isEqualTo(AuditFailure.GAP)
        assertThat(verifier.verify(chain.reversed()).reason).isEqualTo(AuditFailure.ORDER)
        val mutated = chain.toMutableList().also {
            it[1] = it[1].copy(event = it[1].event.copy(outcome = AuditOutcome.DENIED))
        }
        assertThat(verifier.verify(mutated).reason).isEqualTo(AuditFailure.HASH_MISMATCH)
    }

    private fun newEvent(number: Int) = NewSecurityAuditEvent(
        eventId = UUID.nameUUIDFromBytes("audit-$number".toByteArray()),
        eventType = SecurityAuditType.CONSENT_CHANGED,
        actorDigest = "hmac256:" + number.toString().padStart(64, '0'),
        resourceDigest = null,
        purpose = "build_personal_lab_timeline",
        outcome = AuditOutcome.ALLOWED,
        correlationId = UUID.nameUUIDFromBytes("correlation-$number".toByteArray()),
        occurredAt = Instant.parse("2026-08-09T00:00:0${number}Z"),
    )
}
```

- [ ] **Step 2: Run the telemetry/audit tests and confirm the red state**

Run: `./gradlew --no-daemon :apps:core-api:test --tests '*PhiSafeLoggerTest' --tests '*AuditChainTest'`

Expected: compilation FAIL because the typed logger and audit chain do not exist.

- [ ] **Step 3: Implement a closed event vocabulary and append-only audit chain**

```kotlin
enum class TelemetryEvent(val code: String) {
    HTTP_REQUEST_COMPLETED("http_request_completed"),
    AUTHENTICATION_DENIED("authentication_denied"),
    AUTHORIZATION_DENIED("authorization_denied"),
    CONSENT_GRANTED("consent_granted"),
    CONSENT_REVOKED("consent_revoked"),
    DELETION_COMPLETED("deletion_completed"),
}

data class SafeTelemetryContext(
    val correlationId: UUID,
    val routeTemplate: String?,
    val statusClass: String?,
    val latencyMs: Long?,
)
```

`PhiSafeLogger` accepts no `String message`, throwable message, attribute map, principal, URL, header, body, object key, or domain object. It renders only `TelemetryEvent.code` and the four typed fields above. `CorrelationFilter` accepts an inbound `X-Correlation-ID` only when it parses as a UUID; otherwise it generates a UUID. It never copies arbitrary request headers to MDC.

```kotlin
enum class SecurityAuditType { CONSENT_CHANGED, AUTHORIZATION_DECISION, DELETION_CHANGED, PRIVILEGED_ACCESS }
enum class AuditOutcome { ALLOWED, DENIED, SUCCEEDED, FAILED }
enum class AuditFailure { GAP, ORDER, HASH_MISMATCH }

data class NewSecurityAuditEvent(
    val eventId: UUID,
    val eventType: SecurityAuditType,
    val actorDigest: String,
    val resourceDigest: String?,
    val purpose: String?,
    val outcome: AuditOutcome,
    val correlationId: UUID,
    val occurredAt: Instant,
)

data class StoredSecurityAuditEvent(
    val sequence: Long,
    val event: NewSecurityAuditEvent,
    val previousHash: String,
    val eventHash: String,
)

data class AuditVerification(
    val valid: Boolean,
    val reason: AuditFailure?,
    val verifiedCount: Int,
)

class AuditChainHasher {
    companion object { const val GENESIS = "0".repeat(64) }

    fun seal(events: List<NewSecurityAuditEvent>): List<StoredSecurityAuditEvent> {
        var previous = GENESIS
        return events.mapIndexed { index, event ->
            val sequence = index.toLong() + 1
            val hash = hash(sequence, event, previous)
            StoredSecurityAuditEvent(sequence, event, previous, hash).also { previous = hash }
        }
    }

    fun hash(sequence: Long, event: NewSecurityAuditEvent, previousHash: String): String {
        val canonical = listOf(
            sequence.toString(), event.eventId.toString(), event.eventType.name,
            event.actorDigest, event.resourceDigest.orEmpty(), event.purpose.orEmpty(),
            event.outcome.name, event.correlationId.toString(), event.occurredAt.toString(), previousHash,
        ).joinToString("\u001f")
        return MessageDigest.getInstance("SHA-256")
            .digest(canonical.toByteArray(StandardCharsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }
}

class AuditChainVerifier(private val hasher: AuditChainHasher) {
    fun verify(events: List<StoredSecurityAuditEvent>): AuditVerification {
        if (events.map { it.sequence } != events.map { it.sequence }.sorted()) {
            return AuditVerification(false, AuditFailure.ORDER, 0)
        }
        var previous = AuditChainHasher.GENESIS
        events.forEachIndexed { index, stored ->
            if (stored.sequence != index.toLong() + 1) {
                return AuditVerification(false, AuditFailure.GAP, index)
            }
            val expected = hasher.hash(stored.sequence, stored.event, previous)
            if (stored.previousHash != previous || stored.eventHash != expected) {
                return AuditVerification(false, AuditFailure.HASH_MISMATCH, index)
            }
            previous = stored.eventHash
        }
        return AuditVerification(true, null, events.size)
    }
}
```

Hash the UTF-8 bytes of an explicitly ordered canonical representation containing every field plus `previousHash` with SHA-256. A daily signer added at deployment signs the latest digest; the chain alone is detection evidence, not proof against a privileged attacker.

The audit migration must revoke update/delete at both application and database levels:

```sql
create table security_audit_event (
    sequence bigint generated always as identity primary key,
    event_id uuid not null unique,
    event_type varchar(64) not null,
    actor_digest char(72) not null,
    resource_digest char(72) null,
    purpose varchar(64) null,
    outcome varchar(16) not null,
    correlation_id uuid not null,
    occurred_at timestamptz not null,
    previous_hash char(64) not null,
    event_hash char(64) not null unique
);

create function reject_security_audit_mutation() returns trigger language plpgsql as $$
begin
    raise exception 'security audit rows are append-only';
end;
$$;

create trigger security_audit_no_update_delete
before update or delete on security_audit_event
for each row execute function reject_security_audit_mutation();
```

The OpenTelemetry collector must call `keep_keys` for span/resource attributes and retain only service name/version, deployment environment, route template, method, status code, latency, AWS region/AZ, correlation ID, and fixed error class. Exporters must target a Seoul endpoint. Add an architecture rule that prohibits direct `org.slf4j.Logger` and `LoggerFactory` dependencies outside `..platform.telemetry..`.

- [ ] **Step 4: Run application and collector policy tests**

Run:

```bash
./gradlew --no-daemon :apps:core-api:test --tests '*PhiSafeLoggerTest' --tests '*AuditChainTest' --tests '*ModuleBoundaryTest'
python -m unittest ops.otel.test_collector_policy -v
```

Expected: PASS. The collector test confirms `keep_keys` exists, prohibited body/header/query attributes are deleted, and no exporter endpoint is outside `ap-northeast-2` configuration.

- [ ] **Step 5: Commit telemetry and audit controls**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/platform/telemetry apps/core-api/src/main/kotlin/kr/co/genomecompanion/audit apps/core-api/src/main/resources/logback-spring.xml apps/core-api/src/main/resources/db/migration/V2__fnd_security_audit.sql apps/core-api/src/test/kotlin/kr/co/genomecompanion/platform/telemetry apps/core-api/src/test/kotlin/kr/co/genomecompanion/audit apps/core-api/src/test/kotlin/kr/co/genomecompanion/architecture/ModuleBoundaryTest.kt ops/otel
git commit -m "feat: enforce PHI-safe telemetry and audit chains"
```

---

### Task 6: Codify the eight-account AWS organization and region guardrails

**Files:**
- Create: `infra/versions.tf`
- Create: `infra/modules/organization/variables.tf`
- Create: `infra/modules/organization/main.tf`
- Create: `infra/modules/organization/scp.tf`
- Create: `infra/modules/organization/outputs.tf`
- Test: `infra/modules/organization/tests/organization.tftest.hcl`
- Create: `infra/live/organization/main.tf`
- Create: `infra/live/organization/variables.tf`
- Create: `infra/live/organization/backend.tf`

**Interfaces:**
- Consumes: existing `management_account_id: string`; `account_emails: map(string)` with keys `security`, `log_archive`, `shared_services`, `nonprod`, `prod_kr`, `research`, and `backup`.
- Produces: sensitive `account_ids: map(string)` with the existing management account plus seven members; OUs `Security`, `Workloads`, and `Research`; attached Seoul-region and security-service protection SCPs.

- [ ] **Step 1: Write failing OpenTofu organization tests**

```hcl
mock_provider "aws" {}

run "organization_has_exact_account_boundaries" {
  command = plan

  variables {
    management_account_id = "111111111111"
    account_emails = {
      security        = "aws-security@example.invalid"
      log_archive     = "aws-log-archive@example.invalid"
      shared_services = "aws-shared@example.invalid"
      nonprod         = "aws-nonprod@example.invalid"
      prod_kr         = "aws-prod-kr@example.invalid"
      research        = "aws-research@example.invalid"
      backup          = "aws-backup@example.invalid"
    }
  }

  assert {
    condition     = length(aws_organizations_account.member) == 7
    error_message = "Exactly seven member accounts must accompany the existing management account."
  }

  assert {
    condition     = strcontains(aws_organizations_policy.region_lock.content, "ap-northeast-2")
    error_message = "The workload region lock must allow Seoul."
  }

  assert {
    condition     = strcontains(aws_organizations_policy.security_tamper_guard.content, "cloudtrail:StopLogging")
    error_message = "Member accounts must not disable organization audit logging."
  }
}
```

- [ ] **Step 2: Run the organization test and confirm the red state**

Run:

```bash
build/tools/opentofu/tofu -chdir=infra/modules/organization init -backend=false
build/tools/opentofu/tofu -chdir=infra/modules/organization test
```

Expected: FAIL because organization resources and policies are absent.

- [ ] **Step 3: Implement OUs, accounts, and SCPs**

Pin the root:

```hcl
terraform {
  required_version = "= 1.10.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.10.0"
    }
  }
}
```

The organization module must create the three OUs, seven member accounts, and an output map. The region SCP denies requested regions other than `ap-northeast-2`, with only AWS global services required for IAM, Organizations, Route 53, CloudFront for C0 public content, billing, and support exempted. Attach the region SCP to workload and research OUs, not the management account. A second SCP denies `cloudtrail:StopLogging`, `cloudtrail:DeleteTrail`, `config:StopConfigurationRecorder`, GuardDuty/Security Hub disablement, KMS key-schedule shortening, backup-vault deletion, and S3 public-access-block removal in the security/log/backup OU. Keep break-glass changes in management with two-person approval rather than adding a bypass role to member accounts.

The live composition uses a partial backend:

```hcl
terraform {
  backend "s3" {
    encrypt        = true
    use_lockfile   = true
    key            = "organization/terraform.tfstate"
    region         = "ap-northeast-2"
  }
}
```

Bucket name and management-account role ARN arrive only through protected CI backend arguments; they are not committed.

- [ ] **Step 4: Validate formatting, policy JSON, and organization tests**

Run:

```bash
build/tools/opentofu/tofu fmt -check -recursive infra
build/tools/opentofu/tofu -chdir=infra/modules/organization validate
build/tools/opentofu/tofu -chdir=infra/modules/organization test
```

Expected: all commands exit 0; seven member accounts, three OUs, Seoul region lock, and security-tamper actions are asserted.

- [ ] **Step 5: Commit the organization baseline without applying it**

```bash
git add infra/versions.tf infra/modules/organization infra/live/organization
git commit -m "feat: codify AWS account and region guardrails"
```

---

### Task 7A: Build the reproducible telemetry identity canary and UX deployment-authority artifacts

**Files:**
- Create: `supply-chain.lock.json`
- Create: `supply-chain/fnd-telemetry-bootstrap.lock.json`
- Create: `infra/telemetry-bootstrap/.python-version`
- Create: `infra/telemetry-bootstrap/pyproject.toml`
- Generate: `infra/telemetry-bootstrap/uv.lock`
- Create: `infra/telemetry-bootstrap/Dockerfile`
- Create: `infra/telemetry-bootstrap/config/collector-candidate.yaml`
- Create: `infra/telemetry-bootstrap/config/client-candidate.yaml`
- Create: `infra/telemetry-bootstrap/src/gc_telemetry_bootstrap/__init__.py`
- Create: `infra/telemetry-bootstrap/src/gc_telemetry_bootstrap/contracts.py`
- Create: `infra/telemetry-bootstrap/src/gc_telemetry_bootstrap/identity.py`
- Create: `infra/telemetry-bootstrap/src/gc_telemetry_bootstrap/entrypoint.py`
- Test: `infra/telemetry-bootstrap/tests/test_contracts.py`
- Test: `infra/telemetry-bootstrap/tests/test_identity.py`
- Test: `infra/telemetry-bootstrap/tests/test_entrypoint.py`
- Create: `packages/contracts/jsonschema/otel-identity-rotation-start.schema.json`
- Create: `packages/contracts/jsonschema/otel-identity-canary-result.schema.json`
- Create: `packages/contracts/jsonschema/otel-identity-rotation-result.schema.json`
- Create: `scripts/release/build_telemetry_bootstrap_image.py`
- Test: `scripts/release/test_build_telemetry_bootstrap_image.py`
- Create: `supply-chain/fnd-ux-deployment-authority.lock.json`
- Create: `infra/ux-deployment-authority/.python-version`
- Create: `infra/ux-deployment-authority/pyproject.toml`
- Generate: `infra/ux-deployment-authority/uv.lock`
- Create: `infra/ux-deployment-authority/Dockerfile`
- Create: `infra/ux-deployment-authority/src/gc_ux_deployment_authority/__init__.py`
- Create: `infra/ux-deployment-authority/src/gc_ux_deployment_authority/contracts.py`
- Create: `infra/ux-deployment-authority/src/gc_ux_deployment_authority/plan_policy.py`
- Create: `infra/ux-deployment-authority/src/gc_ux_deployment_authority/apply.py`
- Create: `infra/ux-deployment-authority/src/gc_ux_deployment_authority/entrypoint.py`
- Test: `infra/ux-deployment-authority/tests/test_contracts.py`
- Test: `infra/ux-deployment-authority/tests/test_plan_policy.py`
- Test: `infra/ux-deployment-authority/tests/test_apply.py`
- Test: `infra/ux-deployment-authority/tests/test_entrypoint.py`
- Create: `packages/contracts/jsonschema/ux-deployment-authority-request.schema.json`
- Create: `packages/contracts/jsonschema/ux-deployment-authority-result.schema.json`
- Create: `packages/contracts/jsonschema/ux-deployment-authority-task-callback.schema.json`
- Create: `packages/contracts/jsonschema/product-web-apply-receipt.schema.json`
- Create: `packages/contracts/jsonschema/product-web-image-trust-verification.schema.json`
- Create: `packages/contracts/jsonschema/product-web-deployment-result.schema.json`
- Create: `packages/contracts/jsonschema/ux-synthetic-smoke-result.schema.json`
- Create: `packages/contracts/fixtures/ux-deployment-authority-request.valid.json`
- Create: `packages/contracts/fixtures/ux-deployment-authority-result.valid.json`
- Create: `packages/contracts/fixtures/ux-deployment-authority-task-callback.valid.json`
- Create: `packages/contracts/fixtures/product-web-apply-receipt.valid.json`
- Create: `packages/contracts/fixtures/product-web-image-trust-verification.valid.json`
- Create: `packages/contracts/fixtures/product-web-deployment-result.valid.json`
- Create: `packages/contracts/fixtures/ux-synthetic-smoke-result.valid.json`
- Create: `scripts/release/build_ux_deployment_authority_image.py`
- Test: `scripts/release/test_build_ux_deployment_authority_image.py`
- Create: `scripts/release/ux_deployment_authority.py`
- Test: `scripts/release/test_ux_deployment_authority.py`

**Interfaces:**
- Consumes: Task 1 locked uv, OpenTofu, and Cosign/trusted-root installers plus `supply-chain/tool-artifacts.lock.json`; Python 3.12.13; uv 0.12.3; OpenTofu 1.10.6; Cosign 3.0.6; boto3 1.43.53; cryptography 50.0.0; the exact FND root-lock entries `python312SlimBookworm` and `otelCollectorContrib`; four candidate secret VersionIds/digests generated internally by Task 7C; fixed AMP RemoteWrite endpoint; fixed collector DNS SAN and worker URI SAN.
- Produces: one FND-owned linux/amd64 telemetry image with closed commands `collector-candidate` and `client-candidate`; `otel-identity-rotation-start.v1`; `otel-identity-canary-result.v1`; `otel-identity-rotation-result.v1`; one separate FND-owned linux/amd64 UX deployment-authority image with only closed `apply` and `verify` commands; strict deployment-authority request/result, Product apply-receipt, and Product deployment-result schemas/fixtures; reproducible image/SBOM/license/provenance inputs; and deployment inputs `telemetry_bootstrap_image_digest` and `ux_web_deployment_authority_image_digest`, each matching `^sha256:[0-9a-f]{64}$`.

- [ ] **Step 1: Create the locked test harness and failing contract/image tests**

Pin `.python-version` to `3.12.13`. `pyproject.toml` requires Python `==3.12.13`, runtime dependencies `boto3==1.43.53` and `cryptography==50.0.0`, and development dependency `pytest==9.1.1`; generate `uv.lock` with uv 0.12.3 and commit every hash. Add strict JSON-schema tests plus this minimum contract test before implementation:

```python
def test_canary_result_binds_real_mtls_and_amp_export(valid_result):
    assert valid_result["tlsVersion"] == "TLSv1.3"
    assert valid_result["serverDnsSan"] == "otel-collector.monitoring.svc.kr.internal"
    assert valid_result["clientUriSan"] == "spiffe://genome-companion.kr/kr-prod/explanation-worker-otel"
    assert valid_result["metricName"] == "gc_fnd_telemetry_identity_canary"
    assert valid_result["acceptedMetricPoints"] >= 1
    assert valid_result["exporterSentMetricPointsDelta"] >= 1
    assert valid_result["exporterFailedMetricPointsDelta"] == 0
    assert valid_result["ampRemoteWriteStatus"] == "accepted"
```

`otel-identity-rotation-start.v1` is exactly `{schemaVersion,requestId,mode,expectedCurrentManifestDigest,requestedAt,expiresAt,requestSha256}`. `requestId` is lowercase UUIDv4; `mode` is `bootstrap|rotate`; bootstrap alone requires `expectedCurrentManifestDigest=null`, while rotate requires `sha256:<64 lowercase hex>`; UTC times end in `Z`, the validity window is at most ten minutes, and `requestSha256` hashes RFC 8785 canonical bytes omitting only itself. This is the complete GitHub-to-state-machine input: it contains no ARN, secret name/value, VersionId, endpoint, image, task definition, command, environment override, or health data.

`otel-identity-canary-result.v1` is exactly `{schemaVersion,requestSha256,executionArnSha256,imageDigest,identityEpoch,candidates,collectorTaskDefinitionArn,clientTaskDefinitionArn,collectorTaskArnSha256,clientTaskArnSha256,tlsVersion,serverDnsSan,clientUriSan,metricName,canaryIdSha256,acceptedMetricPoints,exporterSentMetricPointsDelta,exporterFailedMetricPointsDelta,ampRemoteWriteStatus,startedAt,completedAt,resultSha256}`. `candidates` has exactly `collectorServer`, `workerClient`, `serverCa`, and `clientCa`; leaf rows are `{versionId,secretSha256,caEpoch}` and CA rows are `{versionId,bundleSha256,caEpoch}`. All four epochs equal `identityEpoch`; task/execution/canary identifiers are SHA-256 digests rather than raw ARNs/IDs; `resultSha256` hashes canonical bytes omitting only itself. Success requires TLS 1.3, the two exact SANs, metric name `gc_fnd_telemetry_identity_canary`, at least one accepted/sent point, zero failed points, and `ampRemoteWriteStatus="accepted"`.

`otel-identity-rotation-result.v1` is exactly `{schemaVersion,requestSha256,mode,executionArnSha256,canaryEvidence:{key,versionId,sha256},promotedManifest:{versionId,manifestDigest,sequence,identityEpoch},bootstrapTaskDefinitions:{collector,client},runtimeDeployment,outcome,completedAt,resultSha256}`. `runtimeDeployment` is exactly `{collectorTaskDefinitionArn,workerTaskDefinitionArn,collectorReadyManifestDigest,workerReadyManifestDigest,priorDrainedAt}`; all five values are null in bootstrap mode and all are nonnull in a successful rotate mode. `outcome` is `promoted|restored|rejected`. The result hash omits only itself. Bootstrap binds the two one-shot task definitions and initial manifest coordinate without pretending AI services already exist; rotate additionally binds the exact runtime revisions/readiness/drain or the immediate-predecessor restore.

Tests reject duplicate keys, extra/missing fields, floats, noncanonical hashes/base64, mixed epochs, wrong SAN/EKU, TLS 1.2 downgrade, zero points, a failed exporter point, raw task/execution ARN in evidence, self-hash drift, bootstrap with a prior digest, rotation without one, a runtime field in bootstrap, and null runtime fields in a promoted rotation.

- [ ] **Step 2: Run the telemetry artifact tests and confirm the red state**

Run:

```bash
test "$(uname -s)-$(uname -m)" = "Linux-x86_64"
python scripts/ci/run_locked_uv.py -- --version
python scripts/ci/run_locked_uv.py -- sync --project infra/telemetry-bootstrap --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/telemetry-bootstrap --frozen pytest infra/telemetry-bootstrap/tests scripts/release/test_build_telemetry_bootstrap_image.py -q
```

Expected: FAIL because the strict contracts, two-mode entry point, configs, Dockerfile, lock verifier, and image builder do not exist.

- [ ] **Step 3: Implement the two-task real-network canary and immutable image contract**

Create the FND root `supply-chain.lock.json` now, before any image build. Its complete shared-image portion is:

```json
{
  "schema_version": 3,
  "runtime_base": {
    "reference": "docker.io/library/eclipse-temurin:21.0.8_9-jre",
    "index_digest": "sha256:66bb900643426ad01996d25bada7d56751913f9cec3b827fcb715d2ec9a0fbfc",
    "linux_amd64_digest": "sha256:54c86420ec14be32efd8659e348eddaf1a26fb19f5766e29161c4bbbd0fec1c3"
  },
  "shared_oci_images": {
    "otelCollectorContrib": {
      "reference": "docker.io/otel/opentelemetry-collector-contrib:0.153.0",
      "index_digest": "sha256:93aad750175cbf1a973ae1c5886c3371f4d800f61be25cdd26870b8441ffe9fa",
      "linux_amd64_digest": "sha256:388054389612c69d0387ecac256338e4086f6cf072fc8feafb6ce7968dc6946c"
    },
    "python312SlimBookworm": {
      "reference": "docker.io/library/python:3.12.13-slim-bookworm",
      "index_digest": "sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
      "linux_amd64_digest": "sha256:6e13e65c55e33adf203d77ee371cf8bf5d81bd4902ef07565721f46bf44917af"
    }
  },
  "tools": {
    "cosign": "v3.0.6",
    "gitleaks": "v8.28.0",
    "trivy": "v0.66.0"
  }
}
```

`Dockerfile` uses the two linux/amd64 **manifest** digests above in `FROM --platform=linux/amd64`, never their tag or index digest. It copies `/otelcol-contrib` from the OTel stage. The Python build stage receives only the uv binary previously verified by Task 1 and a frozen wheel/cache context produced by the build script; it never runs pip, Curl, a shell installer, or a network uv install. The final stage contains only the exact Python runtime, frozen venv, OTel binary, two configs, and package. Before `USER 65532:65532`, it runs exactly:

```dockerfile
RUN find / -xdev -type f \( -perm -4000 -o -perm -2000 \) -exec chmod a-s {} + \
 && ! find / -xdev -type f \( -perm -4000 -o -perm -2000 \) -print -quit | grep -q .
```

The final root filesystem is read-only. `/run/gc-otel` is an image-declared, owner-initialized `0700` volume backed at runtime by the cluster's FND CMK-encrypted Fargate ephemeral storage. The task definitions omit unsupported `privileged` and `dockerSecurityOptions` fields, set `linuxParameters.capabilities.drop=["ALL"]`, and set no public IP. The Debian package database and `/bin/sh` may remain so SBOM and vulnerability results are truthful, but the exec-form entrypoint never invokes a shell; the built-image denylist rejects `curl`, `wget`, `ssh`, `scp`, `nc`, `ncat`, and `socat`, and the image accepts no health-data input.

`entrypoint.py` accepts only `collector-candidate` or `client-candidate`. It strict-loads fixed environment names written only by the Task 7C state machine, fetches the exact candidate VersionIds, caps each Secrets Manager value at 64 KiB, verifies every schema/digest/epoch/SAN/EKU/validity field, rejects proxy variables, creates only `/run/gc-otel/{leaf.pem,leaf-key.pem,ca.pem}` as regular non-symlink files with mode `0400`, and deletes them on every exit. It never logs a secret field or raw task/execution ARN. `collector-candidate` launches the locked OTel binary with the fixed server config, accepts OTLP/gRPC only on 4317 from the client-canary SG, exports only to the fixed AMP endpoint through SigV4, exposes collector self-metrics only on loopback, and reports success only after the exact canary resource digest appears and `otelcol_exporter_sent_metric_points` increases by at least one while `otelcol_exporter_send_failed_metric_points` remains zero. `client-candidate` starts a locked hostmetrics pipeline carrying only the random canary digest, connects to the state-machine-discovered collector private ENI IP while enforcing `server_name_override=otel-collector.monitoring.svc.kr.internal`, presents the candidate client leaf, waits for an OTLP success, and exits. These are distinct ECS tasks/ENIs; a localhost-only test cannot satisfy the gate.

`build_telemetry_bootstrap_image.py` accepts only `--check-reproducible`, `--verify-image IMAGE_DIGEST`, or `--fixtures-only`. It verifies both root-lock entries and every source/uv-lock/config hash recorded in `supply-chain/fnd-telemetry-bootstrap.lock.json`, stages the preverified uv binary, builds twice in separate temporary contexts for linux/amd64, byte-compares exported OCI layouts, verifies the final platform/base/binary digests, SBOM and licenses, scans the built filesystem for SUID/SGID files and prohibited binaries, and emits provenance binding Git commit, root/tool/owner-lock digests, both base index/platform digests, source tree, SBOM, and result digest. Mutable/tag-only `FROM`, cross-owner duplicate base, missing provenance, a dependency absent from the frozen lock, any entrypoint/config shell invocation, a denylisted remote diagnostic binary, setuid/setgid file, unexpected native library, or different OTel binary fails; the expected Debian `/bin/sh` and package database remain visible to SBOM/scans and are not falsely rejected.

- [ ] **Step 4: Run the telemetry artifact tests and reproducibility gate**

Run:

```bash
python scripts/ci/run_locked_uv.py -- lock --project infra/telemetry-bootstrap --check
python scripts/ci/run_locked_uv.py -- sync --project infra/telemetry-bootstrap --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/telemetry-bootstrap --frozen pytest infra/telemetry-bootstrap/tests scripts/release/test_build_telemetry_bootstrap_image.py -q
python scripts/ci/run_locked_uv.py -- run --project infra/telemetry-bootstrap --frozen python scripts/release/build_telemetry_bootstrap_image.py --check-reproducible
```

Expected: all tests pass; two OCI layouts are byte-identical; the final image is linux/amd64, non-root, read-only-compatible, capability-free, SUID/SGID-free, and bound to the two root-lock platform digests; canary negative vectors fail closed.

- [ ] **Step 5: Write the failing UX deployment-authority contract and trust-boundary tests**

Pin the second project to the same Python/uv versions and to runtime `boto3==1.43.53`; it has no OpenTofu Python wrapper dependency. FND owns all four shared schemas and fixtures. `ux-deployment-authority-request.v1` is exactly `{schemaVersion:"ux-deployment-authority-request.v1",environment,operation,handoff,planBundle,foundationSnapshot,stagingResult,faultRequest,authorizationExpiresAt,requestSha256}` with `additionalProperties:false`, maximum RFC 8785 canonical size 3,072 bytes, and a self-digest omitting only itself; every coordinate is exactly `{key,versionId,sha256}`. `environment=staging|production`; staging requires `operation="stage"`, a nonnull FND `ux-staging-fault-request.v1` coordinate, and `stagingResult=null`; production requires `operation="promote"`, a nonnull FND `ux-staging-result.v1` coordinate, and `faultRequest=null`. The handoff, plan-bundle, and foundation-snapshot coordinates are always required, their fetched bytes must cross-bind one source/tag/snapshot, and the server must start before the canonical UTC `Z` authorization expiry. No request contains a bucket, ARN, command, image, role, backend, state-machine, task definition, resource list, inline plan, timestamp override, rollback operation, or provider address.

Each fetched `product-web-plan-bundle.v1` row must additionally contain exact `providerMirror:{key,versionId,sha256}` beside `plan`; its already embedded strict `postconditions` manifest is the sole complete planned-state postcondition contract. The provider mirror is the unchanged official AWS-provider ZIP conditionally stored at full key `ux/plan/<sourceSha>/<sourceSetSha256>/providers/product-web-linux-amd64.zip` by the FND builder from the same two byte-equal committed `.terraform.lock.hcl` files; its exact source/version/platform/archive/binary values are the FND tool-lock row and its key/VersionId/SHA-256 is byte-identical in both plan rows. No repack, plugin installer, network fallback, alternate platform, provider outside the fixed Product live roots, or path/link/device/duplicate member is valid.

Before it may lock or apply a backend, the FND authority exact-fetches the handoff's two image rows and all eight signature/attestation/SBOM/provenance coordinates. The plan job must have emitted both the image-signature statement and SLSA attestation as Cosign 3.0.6 new-format Sigstore bundles using `--bundle --new-bundle-format=true --use-signing-config=true`. Through the private ECR API/DKR endpoints, the authority resolves the exact digest's OCI 1.1 referrers, requires exactly the two expected bundle layers for each role, and byte-compares their canonical bundle bytes/digests with the exact-Version S3 bundle coordinates before cryptographic verification. It then invokes only `/opt/gc/bin/cosign` v3.0.6: `verify --offline=true --new-bundle-format=true --trusted-root /opt/gc/sigstore/trusted_root.json` for the image-signature predicate and `verify-attestation --offline=true --new-bundle-format=true --trusted-root /opt/gc/sigstore/trusted_root.json --type slsaprovenance` for the provenance predicate, both against the immutable repository digest, exact issuer `https://token.actions.githubusercontent.com`, and one exact certificate identity constructed byte-for-byte as `"https://github.com/" + foundationSnapshot.outputs.release_repository_owner + "/" + foundationSnapshot.outputs.release_repository_name + "/.github/workflows/release.yml@refs/tags/" + signedReleaseTagVerification.tag`. `--offline=true` forbids Rekor/Fulcio/TUF access but does not replace the explicitly permitted private ECR referrer fetch. The two repository components come only from the already exact-fetched protected FND snapshot and the tag comes only from the exact-fetched valid `signed-release-tag-verification.v1`; no workflow input, environment/context string, Git remote, certificate field, caller body, case normalization, wildcard, or regular expression may contribute. It accepts no regex identity, caller root/issuer/repository/tag/bundle, extra/missing/referrer-mismatched bundle, online Rekor/Fulcio/TUF lookup, ambient Cosign cache, or successful verification lacking the bundle's Fulcio chain and Rekor inclusion proof under the locked trusted root. It then independently parses exactly one Cosign image-signature DSSE statement and one SLSA DSSE statement per role and requires exact subject repository/digest, source SHA/tag/workflow identity, FND Buildx/BuildKit/frontend/base and owner/root-lock digests, builder identity, SBOM digest, and byte-equal provenance coordinate; it rejects a second statement/subject, mutable tag, substituted owner/name/tag/workflow/repository/bundle/SBOM/provenance, expired/not-yet-valid certificate, untrusted root/log key, missing inclusion proof, or valid signature over different bytes. Fixed end-to-end CLI fixtures and mutations swap each flag/bundle/referrer/owner/name byte, case, separator, workflow path, tag, snapshot coordinate, and tag-verification coordinate and prove failure occurs before image-trust publication, backend lock, or apply.

The deterministic verification record is exactly `{schemaVersion:"product-web-image-trust-verification.v1",sourceSha,tagVerificationSha256,issuer,identity,cosignSha256,trustedRootSha256,images,verificationSha256}` with `additionalProperties:false`; `images` is exactly two rows sorted by `role`, each `{role:"bff"|"collector",repository,digest,signatureBundleSha256,attestationBundleSha256,sbomSha256,provenanceSha256,statementSha256}`. It contains no clock or caller value and self-hashes while omitting only `verificationSha256`. The authority conditionally stores it at `ux/image-trust/<environment>/<verificationSha256>.json`, recovers a lost response only through byte-identical retry, verified 412, one exact-key Head, and exact-Version Get, and binds its returned `{key,versionId,sha256}` in the apply receipt. Thus a retry is byte-identical and a candidate-authored diagnostic cannot stand in for FND verification.

`product-web-apply-receipt.v1` is exactly `{schemaVersion:"product-web-apply-receipt.v1",environment,plan:{key,versionId,sha256},planBundleSha256,foundationSnapshot:{key,versionId,sha256},imageTrust:{key,versionId,sha256},priorState,resultingState:{backendVersionId,lineageSha256,serial,observedStateSha256},postconditionsSha256,disposition:"converged",receiptSha256}`. `priorState` is an additional-properties-false discriminated union: greenfield is exactly `{status:"absent",backendVersionId:null,lineageSha256:null,serial:null,knownStateSha256:null}` and existing state is exactly `{status:"present",backendVersionId,lineageSha256,serial,knownStateSha256}`. `absent` is legal only when the plan row contains the byte-identical discriminator, an exact-key backend Head under the held lock proves no current or historical version, and the plan's complete address set is the approved first-install set; the result must create one nonempty backend VersionId and lineage, have serial at least 1, and satisfy every postcondition. `present` requires unchanged lineage, a strictly greater resulting serial, and a different backend VersionId. The image-trust coordinate must exact-fetch the FND record just verified for these handoff bytes. The self-digest omits only itself. Initial success and an ambiguous/lost response converge to identical bytes at fixed key `ux/apply-receipt/<environment>/<planSha256>.json`; there is no `already_applied` discriminator or digest-derived receipt-key variant.

`product-web-deployment-result.v1` is exactly `{schemaVersion:"product-web-deployment-result.v1",requestSha256,executionArnSha256,environment,outcome,failureStage,final:{bffSlot,bffTaskDefinitionArn,collectorTaskDefinitionArn,bffWeight},smokeSha256,rollbackSha256,completedAt,resultSha256}` with `additionalProperties:false`. A promoted final requires `bffSlot="blue"|"green"`, two same-account/region exact Product revision ARNs, and `bffWeight=100`; a rolled-back upgrade final must byte-equal the recorded nonnull prior tuple; a rolled-back first-install final alone is exactly `{bffSlot:null,bffTaskDefinitionArn:null,collectorTaskDefinitionArn:null,bffWeight:0}` with both BFF slots and collector desired count zero. `outcome="promoted"` requires `failureStage=null`, candidate final tuple, nonnull smoke digest, and null rollback digest; `outcome="rolled_back"` requires `failureStage=before_smoke|smoke|traffic_shift`, exact prior/greenfield final tuple, nonnull rollback digest, and a null smoke digest only for `before_smoke`. The self-digest omits only itself. `ux-deployment-authority-result.v1` is exactly `{schemaVersion:"ux-deployment-authority-result.v1",requestSha256,environment,applyReceipt:{key,versionId,sha256},deploymentResult:{key,versionId,sha256},stagingResult,outcome,completedAt,resultSha256}`; `outcome=validated|promoted|rolled_back`. A successful staging execution alone has `outcome="validated"` plus nonnull exact `stagingResult:{key,versionId,sha256}`; a successful production execution has `outcome="promoted"` and `stagingResult=null`; any catch has `outcome="rolled_back"` and null staging result. Every coordinate exact-fetches and cross-binds the request/outcome/environment, and the self-digest omits only itself.

The authority task callback is FND-owned and exactly `{schemaVersion:"ux-deployment-authority-task-callback.v1",requestSha256,applyReceipt:{key,versionId,sha256},candidate:{bffTaskDefinitionArn,collectorTaskDefinitionArn,smokeFunctionVersionArn},observedStateSha256,callbackSha256}` with `additionalProperties:false`, maximum canonical size 4 KiB, and a self-digest omitting only itself. Candidate ARNs must be provider-observed, plan/postcondition-bound, same account/region/environment, exact Product families/function, and immutable task revision/qualified version; no caller field can supply them. The callback has no token/backend/state/body/log/health/timestamp datum. The outer Standard state machine invokes only its environment's FND task definition with `ecs:runTask.waitForTaskToken`; it base64url-encodes the exact at-most-3,072-byte request into state-machine-written `GC_UX_AUTHORITY_REQUEST_B64` and supplies the generated token only as `GC_SFN_TASK_TOKEN`. These are the only two task overrides, and the complete rendered ECS `overrides` JSON (including keys/escaping/token) must be at most 8,192 characters before RunTask. Callers cannot provide either name/value or any command/image/role/network override. The task decodes/recanonicalizes/re-hashes the request, never logs either value, holds the token only in a mutable in-memory buffer, sends `SendTaskHeartbeat` every 30 seconds while holding the backend lock, and may call only `states:SendTaskHeartbeat|SendTaskSuccess|SendTaskFailure` through the private Seoul Step Functions interface endpoint. Success carries only the strict callback; failure carries one fixed non-sensitive error code and request digest. Result/staging/deployment `completedAt` values derive later from the outer Step Functions context and never enter the callback or receipt. A lost callback response causes the same outer task state to resolve if AWS accepted it or its catchable Task timeout to retry one freshly tokenized task against the same request; the rerun must converge on the byte-identical fixed-key receipt/candidate tuple. Invalid/expired/replayed tokens, missed heartbeat, changed callback/request/candidate, two distinct receipts, callback after fence loss, timeout after the bounded retry, or task exit without callback enters the outer catch path and restores/terminalizes. Task token/env/log/core-dump leakage and `DescribeExecution|StartExecution|StopExecution` from the task are denied and mutation-tested.

`ux_deployment_authority.py stage|promote` is the only workflow client. Both modes require `--handoff-coordinate`, `--plan-bundle-coordinate`, `--foundation-snapshot-coordinate`, and `--out-dir`; `stage` additionally requires `--fault-coordinate`, while `promote` additionally requires `--staging-result-coordinate`, and every other combination fails. It strict-loads each local coordinate record, the verified foundation snapshot, and fixed environment state-machine ARN; constructs the exact request with server-bounded expiry inherited from the handoff; uses deterministic execution name `sha256("ux-web-authority\0" || environment || requestSha256)`; calls only `StartExecution|DescribeExecution` on that one snapshot ARN; polls within 600 seconds while preserving caller cancellation semantics; exact-fetches the returned Object-Lock result and every nested receipt/result; and atomically writes `request.json`, `result.json`, `result.coordinate.json`, `apply-receipt.coordinate.json`, `deployment-result.coordinate.json`, plus `staging-result.coordinate.json` only for successful stage. It accepts no ARN/bucket/key/body/command/image/role/backend/timeout/rollback override and cannot apply or mutate an AWS resource itself. A lost caller reruns with identical coordinates/name and may only Describe the existing execution. Tests cover all coordinate swaps, name/input collision, lost Start/Describe response, timeout, wrong state-machine/output/result, cross-environment read, current/List fallback, output race, and log leakage.

Tests start RED for strict schema vectors, archive extraction, plan policy, apply ambiguity, Sigstore trust, and orchestration boundaries. They mutate every field/null rule/digest/VersionId/expiry/environment, provider/member/lock/platform, planned address/action/tag/boundary, absent/present discriminator, prior lineage/serial, computed postcondition, fixed receipt key/disposition, response-loss branch, and result coordinate. Sigstore vectors mutate role/repository/digest, issuer/identity/tag/workflow, Fulcio chain, Rekor proof/key, trusted-root/Cosign bytes, DSSE subject/predicate/SBOM/provenance, bundle count/format, image-trust key and digest, and prove no backend lock/apply occurs before both rows pass. They also prove that a GitHub role, Product container, or caller-selected command cannot acquire the fence, run OpenTofu, write a trust record/receipt, mutate ECS/ELB, or terminalize.

- [ ] **Step 6: Implement the digest-pinned authority image and offline saved-plan apply**

`Dockerfile` starts from the exact root `python312SlimBookworm` linux/amd64 manifest digest and `COPY`s only the Task 1 preverified `build/tools/opentofu/tofu`, `build/tools/cosign/cosign`, `build/tools/cosign/trusted_root.json`, the frozen Python environment, and package. It never downloads OpenTofu/providers/Sigstore material or runs pip. Before `USER 65532:65532`, it strips and proves absence of SUID/SGID files; the final task is UID/GID 65532, read-only root, capability-drop `ALL`, no shell entrypoint, no EFS, and a bounded encrypted ephemeral workspace erased on every exit. `build_ux_deployment_authority_image.py` verifies OpenTofu, Cosign, and the trusted-root bytes against the FND artifact lock, builds two isolated linux/amd64 OCI layouts, byte-compares them, scans filesystem/SBOM/licenses, and records source/root/tool/uv/provider-policy/Sigstore/schema/result digests in `supply-chain/fnd-ux-deployment-authority.lock.json`. The only runtime verbs are `apply` and `verify`; task overrides cannot replace command, image, role, network, path, root, issuer, identity, or environment.

`entrypoint.py apply` receives only the state-machine-written canonical request in `GC_UX_AUTHORITY_REQUEST_B64`, its one task token, and fixed task-definition environment. It decodes/recomputes the request; exact-fetches the handoff, both complete image-evidence sets, plan bundle, saved plan, provider ZIP, snapshot, optional staging result/fault, and backend state discriminator; completes the locked offline Cosign/Fulcio/Rekor verification and immutable image-trust record above before acquiring the backend lock; safe-validates/materializes the raw provider archive into the fixed offline filesystem-mirror layout; runs `tofu show -json` with locked OpenTofu 1.10.6; and independently enforces the complete environment-specific address/action/tag/boundary policy. It rejects provisioners, `external`, `local`, `file`, `null`, `terraform_data`, executable data sources, local-exec/remote-exec, apply-time code, provider/plugin/Sigstore download, plan/state/backend/root/identity override, a resource outside the closed Product set, and every mutation of FND state-machine/fence/authority/network/cluster/zone/namespace/certificate/repository/evidence/backend resources.

Only after the outer state machine owns and heartbeats the exact fence does the task lock the matching backend and run `tofu apply -input=false -auto-approve <exact-saved-plan>`. It has no public route/NAT/proxy; provider calls traverse only FND endpoint policies. If the call succeeds, returns ambiguously, loses its response, or a same-plan retry sees stale prior state, the task holds the backend lock and accepts only a complete current state satisfying every embedded known/computed postcondition, exact address set, source/snapshot/image/tag relationship, and absence of drift/extra resources. It then constructs the single path-independent `disposition="converged"` receipt. The receipt Put uses checksum/`If-None-Match:*`; response loss permits only byte-identical retry, verified 412, one exact-key Head, and exact-Version Get/revalidation. Partial/different/later state, an existing nonidentical receipt, or inability to prove the original plan caused the complete converged state fails closed.

- [ ] **Step 7: Run both image gates and trust-boundary mutation suites**

Run:

```bash
test "$(uname -s)-$(uname -m)" = "Linux-x86_64"
python scripts/ci/run_locked_uv.py -- lock --project infra/ux-deployment-authority --check
python scripts/ci/run_locked_uv.py -- sync --project infra/ux-deployment-authority --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/ux-deployment-authority --frozen pytest infra/ux-deployment-authority/tests scripts/release/test_build_ux_deployment_authority_image.py scripts/release/test_ux_deployment_authority.py -q
python scripts/ci/install_opentofu.py --destination build/tools/opentofu
python scripts/ci/install_cosign.py --destination build/tools/cosign
python scripts/ci/run_locked_uv.py -- run --project infra/ux-deployment-authority --frozen python scripts/release/build_ux_deployment_authority_image.py --opentofu build/tools/opentofu/tofu --cosign build/tools/cosign/cosign --trusted-root build/tools/cosign/trusted_root.json --check-reproducible
```

Expected: every schema/policy/ambiguity/fence mutation passes fail-closed; two authority OCI layouts are byte-identical and linux/amd64; OpenTofu is exactly 1.10.6; the image is non-root/read-only-compatible/capability-free/SUID-free, has no public-network installer or alternate command, and emits one immutable `ux_web_deployment_authority_image_digest`.

- [ ] **Step 8: Commit both foundation-owned immutable artifacts**

```bash
git add supply-chain.lock.json supply-chain/fnd-telemetry-bootstrap.lock.json supply-chain/fnd-ux-deployment-authority.lock.json infra/telemetry-bootstrap infra/ux-deployment-authority packages/contracts/jsonschema/otel-identity-rotation-start.schema.json packages/contracts/jsonschema/otel-identity-canary-result.schema.json packages/contracts/jsonschema/otel-identity-rotation-result.schema.json packages/contracts/jsonschema/ux-deployment-authority-request.schema.json packages/contracts/jsonschema/ux-deployment-authority-result.schema.json packages/contracts/jsonschema/ux-deployment-authority-task-callback.schema.json packages/contracts/jsonschema/product-web-apply-receipt.schema.json packages/contracts/jsonschema/product-web-image-trust-verification.schema.json packages/contracts/jsonschema/product-web-deployment-result.schema.json packages/contracts/jsonschema/ux-synthetic-smoke-result.schema.json packages/contracts/fixtures/ux-deployment-authority-request.valid.json packages/contracts/fixtures/ux-deployment-authority-result.valid.json packages/contracts/fixtures/ux-deployment-authority-task-callback.valid.json packages/contracts/fixtures/product-web-apply-receipt.valid.json packages/contracts/fixtures/product-web-image-trust-verification.valid.json packages/contracts/fixtures/product-web-deployment-result.valid.json packages/contracts/fixtures/ux-synthetic-smoke-result.valid.json scripts/release/build_telemetry_bootstrap_image.py scripts/release/test_build_telemetry_bootstrap_image.py scripts/release/build_ux_deployment_authority_image.py scripts/release/test_build_ux_deployment_authority_image.py scripts/release/ux_deployment_authority.py scripts/release/test_ux_deployment_authority.py
git commit -m "build: add foundation deployment authority artifacts"
```

---

### Task 7B: Build the FND-owned Seoul AI governance signer package

**Files:**
- Create: `infra/functions/ai-artifact-signer/.python-version`
- Create: `infra/functions/ai-artifact-signer/pyproject.toml`
- Generate: `infra/functions/ai-artifact-signer/uv.lock`
- Create: `infra/functions/ai-artifact-signer/Dockerfile.signer`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/__init__.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/contracts.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/domains.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/approval_handler.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/plan_request_handler.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/release_identity_handler.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/release_authorization_handler.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/release_postcondition_handler.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/evaluation_anchor_handler.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/sign_handler.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/key_ceremony_handler.py`
- Create: `infra/functions/ai-artifact-signer/src/gc_ai_artifact_signer/key_ceremony_broker_handler.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_contracts.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_domains.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_approval_handler.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_plan_request_handler.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_release_identity_handler.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_release_authorization_handler.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_release_postcondition_handler.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_evaluation_anchor_handler.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_sign_handler.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_key_ceremony_handler.py`
- Test: `infra/functions/ai-artifact-signer/tests/test_key_ceremony_broker_handler.py`
- Create: `packages/contracts/jsonschema/ai-artifact-signing-request-core.schema.json`
- Create: `packages/contracts/jsonschema/ai-artifact-signing-proposal.schema.json`
- Create: `packages/contracts/jsonschema/ai-artifact-signing-approval-receipt.schema.json`
- Create: `packages/contracts/jsonschema/ai-artifact-signing-request.schema.json`
- Create: `packages/contracts/jsonschema/ai-artifact-signing-result.schema.json`
- Create: `packages/contracts/jsonschema/ai-ed25519-signing-key.schema.json`
- Create: `packages/contracts/jsonschema/ai-artifact-signing-root-bundle.schema.json`
- Create: `packages/contracts/jsonschema/ai-artifact-key-ceremony-core.schema.json`
- Create: `packages/contracts/jsonschema/ai-artifact-key-ceremony-approval-receipt.schema.json`
- Create: `packages/contracts/jsonschema/ai-artifact-key-ceremony-request.schema.json`
- Create: `packages/contracts/jsonschema/ai-artifact-key-ceremony-result.schema.json`
- Create: `packages/contracts/fixtures/ai-artifact-signing-approval-receipt.valid.json`
- Create: `packages/contracts/fixtures/ai-artifact-signing-proposal.valid.json`
- Create: `packages/contracts/fixtures/ai-artifact-signing-root-bundle.valid.json`
- Create: `packages/contracts/fixtures/ai-artifact-key-ceremony.valid.json`
- Create: `packages/contracts/jsonschema/ai-production-plan-request.schema.json`
- Create: `packages/contracts/jsonschema/ai-production-plan-approval-receipt.schema.json`
- Create: `packages/contracts/jsonschema/ai-promotion-intent.schema.json`
- Create: `packages/contracts/jsonschema/ai-promotion-intent-draft.schema.json`
- Create: `packages/contracts/jsonschema/ai-promotion-source.schema.json`
- Create: `packages/contracts/jsonschema/ai-release-workflow-identity.schema.json`
- Create: `packages/contracts/jsonschema/ai-production-evaluation-request.schema.json`
- Create: `packages/contracts/jsonschema/ai-production-evaluation-verification.schema.json`
- Create: `packages/contracts/jsonschema/ai-production-eval-registry-anchor.schema.json`
- Create: `packages/contracts/jsonschema/ai-production-eval-bundle-anchor.schema.json`
- Create: `packages/contracts/jsonschema/ai-production-evaluation-bootstrap-request.schema.json`
- Create: `packages/contracts/jsonschema/ai-production-evaluation-bootstrap-result.schema.json`
- Create: `packages/contracts/jsonschema/ai-release-authorization-verification.schema.json`
- Create: `packages/contracts/jsonschema/ai-release-postcondition-verification.schema.json`
- Create: `packages/contracts/fixtures/ai-production-plan-approval-receipt.valid.json`
- Create: `packages/contracts/fixtures/ai-promotion-intent.valid.json`
- Create: `packages/contracts/fixtures/ai-promotion-intent-draft.valid.json`
- Create: `packages/contracts/fixtures/ai-promotion-source.valid.json`
- Create: `packages/contracts/fixtures/ai-release-workflow-identity.valid.json`
- Create: `packages/contracts/fixtures/ai-production-evaluation-request.valid.json`
- Create: `packages/contracts/fixtures/ai-production-evaluation-verification.valid.json`
- Create: `packages/contracts/fixtures/ai-production-eval-registry-anchor.valid.json`
- Create: `packages/contracts/fixtures/ai-production-eval-bundle-anchor.valid.json`
- Create: `packages/contracts/fixtures/ai-production-evaluation-bootstrap-request.valid.json`
- Create: `packages/contracts/fixtures/ai-production-evaluation-bootstrap-result.valid.json`
- Create: `packages/contracts/fixtures/ai-release-authorization-verification.valid.json`
- Create: `packages/contracts/fixtures/ai-release-postcondition-verification.valid.json`
- Create: `scripts/security/fixtures/ai-production-plan-approval-receipt.invalid.json`
- Create: `scripts/release/build_ai_artifact_signer_image.py`
- Test: `scripts/release/test_build_ai_artifact_signer_image.py`
- Create: `scripts/release/build_ai_artifact_approval_zip.py`
- Test: `scripts/release/test_build_ai_artifact_approval_zip.py`
- Create: `scripts/security/ai_artifact_key_ceremony.py`
- Test: `scripts/tests/test_ai_artifact_key_ceremony.py`
- Create: `scripts/security/ai_artifact_signing_ceremony.py`
- Test: `scripts/tests/test_ai_artifact_signing_ceremony.py`
- Create: `scripts/security/ai_release_workflow_identity.py`
- Test: `scripts/tests/test_ai_release_workflow_identity.py`
- Create: `scripts/security/ai_promotion_intent.py`
- Test: `scripts/tests/test_ai_promotion_intent.py`
- Create: `scripts/release/ai_release_authority.py`
- Test: `scripts/tests/test_ai_release_authority.py`
- Create: `scripts/security/ai_production_evaluation_bootstrap.py`
- Test: `scripts/tests/test_ai_production_evaluation_bootstrap.py`
- Create: `supply-chain/fnd-ai-artifact-signer.lock.json`

**Interfaces:**
- Consumes: Task 1 uv installer/lock; Python 3.12.13; uv 0.12.3; boto3 1.43.53; cryptography 50.0.0; pytest 9.1.1; immutable exact-version S3 core/approval/input/registry coordinates; fixed FND buckets, key-secret containers, domain map, KMS key, state table, and Object-Lock result prefix supplied only by Task 7C.
- Produces: reproducible keyless approval/plan/release-authority Lambda ZIP plus isolated signer/key-ceremony Fargate image/SBOM/license/provenance digests; strict artifact proposal/request/partial-receipt/result/key/root-bundle, key-ceremony, AI production-plan request/approval, production-evaluation anchor/bootstrap, release-authorization, and release-postcondition schemas with shared fixtures; keyless fixed handlers plus closed one-shot `sign` and `key-ceremony` image commands; twelve fixed domain/prefix/key/approval/cap policies; deployment inputs `ai_artifact_signer_image_digest`, `ai_artifact_approval_zip_sha256`, and `ai_release_authority_client_sha256`; and no private-key output.

- [ ] **Step 1: Write the failing signer contract, domain, lifecycle, and key-safety tests**

The immutable source proposal is FND-owned and exactly `{schemaVersion:"ai-artifact-signing-proposal.v1",requestId,domain,keyId,sequence,input,expectedRegistry,outputKey,requestedAt,expiresAt,proposalSha256}` with `additionalProperties=false`. `input` and a nonnull `expectedRegistry` are exactly `{key,versionId,sha256}`; registry may be null only for a key-registry domain. `domain` is one of the closed twelve, `sequence` is 0 through 2,147,483,647, all keys match fixed content-addressed prefixes, timestamps are canonical UTC `Z`, and `requestedAt < expiresAt <= requestedAt + 60 minutes`. The object is at most 16 KiB/depth 8, contains no identity, ARN, bucket, provider, private bytes, or caller-selected prefix, and `proposalSha256` is lowercase `sha256:` over RFC 8785 bytes omitting only itself. `packages/contracts/fixtures/ai-artifact-signing-proposal.valid.json` is the shared FND/AI byte fixture. The stage alias exact-fetches the proposal and separate immutable evidence coordinates, validates both, maps the proposal fields byte-for-byte into core, caps core expiry at the earlier proposal expiry or 15 minutes from execution, and writes one content-addressed core. The staged core is exactly `{schemaVersion:"ai-artifact-signing-request-core.v1",requestId,domain,keyId,sequence,input,expectedRegistry,outputKey,expiresAt}`. The generic broker binds but does not interpret an AI-prevalidated sequence. Core bytes are RFC 8785 canonical and `requestCoreSha256=sha256:<64hex>` hashes the exact bytes.

Each approval producer emits one immutable receipt exactly `{schemaVersion:"ai-artifact-signing-approval-receipt.v1",requestCoreSha256,domain,keyId,sequence,inputSha256,outputKey,expiresAt,approvalRole,approverSubject,approvedAt,evidenceSha256,issuerRoleArn,oidc,receiptSha256}`. `oidc` is exactly `{actorId,runId,runAttempt,repositoryId,workflowRef,workflowSha,ref,environment,issuer,audience,expiresAt,jti}` and contains only freshly signature-verified GitHub OIDC claims. `receiptSha256` hashes RFC 8785 canonical receipt bytes omitting only itself. The producer recomputes the core and copies every bound scalar from it; no request value can override verified OIDC or role fields. Full Step Functions input is exactly `{schemaVersion:"ai-artifact-signing-request.v1",core:{key,versionId,sha256},approvals:{domainOwner:{key,versionId,sha256},security:{key,versionId,sha256}},requestCoreSha256,requestSha256}`; `requestSha256` hashes canonical full-request bytes omitting only itself. Both approval coordinates are required and distinct; no null, singular, inline, or omitted approval form exists. The broker cross-checks every core-bound field and requires distinct approval roles, subjects, actor IDs, issuer roles, workflow refs, workflow SHAs, run IDs, and JWT `jti` values. `packages/contracts/fixtures/ai-artifact-signing-approval-receipt.valid.json` is the one shared canonical core/two-receipt/full-request/result test vector consumed byte-for-byte by FND and AI.

FND also owns the cross-run production-plan approval bytes so the earlier keyless verifier never depends on later AI code. The strict plan request is exactly `{schemaVersion:"ai-production-plan-request.v1",requestId,sourceSha,signedTag,promotionIntent,foundationSnapshot,planActorId,planRunId,planRunAttempt,createdAt,expiresAt,images,terraformPlan,releaseBundle,requestSha256}`; `promotionIntent` and `foundationSnapshot` are exact `{key,versionId,sha256}` coordinates, `images` is exactly two role-discriminated immutable image records, `terraformPlan` and `releaseBundle` are exact coordinates in `ai_release_evidence_bucket_name`, expiry is at most four hours, and the self-digest omits only itself. The plan publisher exact-fetches the protected snapshot used to project its environment, proves its coordinate/digest equals `foundationSnapshot`, and writes the request before both the promotion intent and request expiry. Each plan verifier accepts only the request coordinate plus its fresh OIDC token, exact-fetches the promotion intent/snapshot/request/plan/release bytes, and writes exactly `{schemaVersion:"ai-production-plan-approval-receipt.v1",request,requestSha256,promotionIntentSha256,foundationSnapshotSha256,sourceSha,signedTag,workerImageDigest,collectorImageDigest,terraformPlanSha256,planActorId,approvalRole,approverSubject,approvedAt,expiresAt,issuerRoleArn,oidc,receiptSha256}`. `approvalRole` is `domain_owner|security_release`; the protected workflow/environment/team/issuer-role split is the review evidence and is derived from the verified OIDC token, never a caller coordinate; every plan-derived scalar is recomputed; the self-digest omits only itself. It writes once to `ai-plan-approvals/{approvalRole}/{requestSha256}/{receiptSha256}.json`. The two fixed modes have distinct audience/workflow/environment/issuer/actor/replay/receipt partitions and accept no caller-authored identity, evidence, or plan field. Receipt verification, reservation, sealed recovery manifest, approval-use transaction, and terminal evidence bind the exact request/promotion/snapshot digests. Release exact-fetches/projects that same snapshot and reserves before request/receipts expire; after same-fence reservation, the sealed manifest keeps immutable bindings through bounded deployment/recovery. `packages/contracts/fixtures/ai-production-plan-approval-receipt.valid.json` is the shared byte fixture AI consumes unchanged; invalid vectors mutate every snapshot and identity binding.

`ai-promotion-source.v1` is exactly `{schemaVersion:"ai-promotion-source.v1",repositoryId,sourceSha,signedTag,tagVerification:{key,versionId,sha256},createdAt,sourceDigest}` with `additionalProperties:false`; repository/run-independent scalars are canonical, `sourceSha` is 40 lowercase hex, the tag is annotated SemVer, the coordinate exact-fetches the FND tag-verification record, and the self-digest omits only itself. `ai-promotion-intent.v1` is the only plan discriminator and is exactly `{schemaVersion:"ai-promotion-intent.v1",releaseKind,source,artifactAuthorizations,workloadPreparedPair,firstInstallState,requestedAt,expiresAt,intentSha256}` with `additionalProperties:false`. Every coordinate is exactly `{key,versionId,sha256}`; `source` is a nullable coordinate to strict `ai-promotion-source.v1`; `artifactAuthorizations` is sorted by `domain` and each row is exactly `{domain,proposal,signingResult,signedEnvelope}`, with three exact coordinates and domain drawn from the five non-workload artifact domains. The publisher exact-fetches each proposal→dual receipts→broker result→signed envelope chain, checks domain/prefix/input/result/envelope digests and active root key, and rejects a proposal without its completed signed result. `workloadPreparedPair` is a nullable coordinate to strict `workload-jwks-prepared-pair.v1`. `firstInstallState` is null outside first install; for `releaseKind=first_install` it is exactly `{kind,fiveRowSetSha256}`. `kind=empty` requires `fiveRowSetSha256=null`; `kind=resumable_five` requires the canonical digest of exactly the five matching active non-workload artifact rows and no other row/set/signer/service state. The FND intent publisher derives this nested object from strongly consistent exact-key reads and service descriptions: it accepts only fully empty state or five rows whose domains, authorization/envelope digests, source-set digest, status, and fence byte-match the five authorization chains in this intent, while the workload row, active set, signer `ACTIVE`, and live service counts are absent/zero. A subset, extra/different row, existing active set/signer, or service drift fails and requires a separately approved cleanup; caller/draft cannot choose the discriminator or digest. `releaseKind=first_install` requires source, exactly five authorization rows, prepared pair, and that derived state; `image_only` requires only source; `artifact_hot` requires exactly one completed authorization and null source/prepared pair/state; `workload_key` requires only prepared pair. All prohibited fields are null/empty as specified, UTC `Z` expiry is after request and at most four hours, object size/depth are 24 KiB/10, and `intentSha256` hashes RFC 8785 bytes omitting only itself. The plan-request publisher must create the request while server time is before intent expiry and records `request.createdAt <= intent.expiresAt`; approvals later verify that historical inequality and the request's own four-hour expiry, not the then-current intent clock. Release must reserve before request/receipt expiry; after reservation, the sealed immutable digest remains valid only for that fence. Plan preflight, hot-promotion evidence, recovery manifest, and terminal evidence exact-fetch the intent and repeat `firstInstallState`/its digest; they reject a state change except the same-fence idempotent progression authorized by it. It contains no inline body, ARN, image digest, actor, role, unreviewed mode payload, or mutable pointer. Wrong variant/null mix, proposal/result/envelope mismatch, extra/duplicate domain, changed source/prepared pair/state, clock boundary, replay, or release-kind substitution fails.

The signed source tree contains one strict `governance/ai/promotion-intent-draft.json`, validated as `ai-promotion-intent-draft.v1` exactly `{schemaVersion,releaseKind,artifactAuthorizations,workloadPreparedPair,validForSeconds,draftSha256}`. Its authorization/prepared-pair rows are byte-identical to the final intent, `validForSeconds` is an integer from 900 through 14400, and its self-digest omits only itself; it has no source/tag/identity/time/ARN/body. `ai_promotion_intent.py publish --signed-tag "$AI_SIGNED_TAG" --snapshot build/foundation/foundation-outputs.json --tag-verification-out build/promotion/tag-verification.coordinate.json --source-out build/promotion/source.coordinate.json --intent-out build/promotion/intent.coordinate.json` is the sole pre-plan producer. From a clean full-tag checkout it independently verifies the annotated SSH tag and peeled commit and reads the draft only through exact Git object path `<peeledCommit>:governance/ai/promotion-intent-draft.json`, never the caller worktree. It exact-fetches every draft coordinate, publishes the tag-verification record, constructs/publishes `ai-promotion-source.v1`, then constructs/publishes `ai-promotion-intent.v1` with server time and the draft duration. All three writes use checksum, Object Lock, content-addressed keys, and `If-None-Match:*`; output is only the three coordinates. The CLI accepts no draft path, source SHA, repository ID, timestamp, bucket/prefix/role, or inline coordinate/body override; those derive from Git/tag/snapshot/signed draft. Its separate `verify` mode requires only `--intent-key`, `--intent-version-id`, `--intent-sha256`, `--snapshot`, `--expected-checkout-sha`, and `--out-dir`; it exact-fetches the intent, source, and tag-verification VersionIds, recomputes every nested digest and expiry/source relationship, requires the source SHA to equal both the expected clean checkout and peeled signed-tag target, and atomically emits canonical `intent.json`, `source.json`, `tag-verification.json`, `source-sha.txt`, and `signed-tag.txt`. It accepts no ambient tag/source/body/current-version fallback. Fixed tests cover dirty/wrong checkout, worktree-vs-tag draft substitution, lightweight/wrong signer tag, draft/source mismatch, incomplete artifact-signing chain, expired/replayed coordinate, mutable version, clock bounds, output symlink/race, and partial/equivocating writes.

FND—not candidate AI code—owns production evaluation, release authorization, and final postcondition authority. The FND-owned evaluation request is exactly `{schemaVersion:"ai-production-evaluation-request.v1",promotionIntent,foundationSnapshot,workerImageDigest,corpus,bundle,registry,caseSetSha256,requestedAt,requestSha256}` and the result is exactly `{schemaVersion:"ai-production-evaluation-verification.v1",requestSha256,workerImageDigest,corpusSha256,bundleSha256,registrySha256,blindedInputSha256,candidateOutputSha256,scoreSummarySha256,passed,startedAt,completedAt,verificationSha256}`; coordinates are exact `{key,versionId,sha256}`, both schemas have `additionalProperties:false`, and each self-digest omits only itself. `ai_release_authority.py evaluate --snapshot build/foundation/foundation-outputs.json --request build/ai/production-eval-request.json --out-dir build/ai/production-eval` exact-fetches and verifies the signed corpus/bundle/registry through the pinned public root bundle, materializes a gold-free/minimized input projection, and launches the digest-only candidate with network disabled, read-only root, cap-drop `ALL`, no-new-privileges, bounded tmpfs/CPU/memory/PIDs, and mounts containing only that blinded projection plus fixed runtime data. Blinding is request-scoped and deterministic: for each reviewed case, `candidateCaseId = Trunc128(SHA256("GC-AI-EVAL-BLIND-V1\0" || requestSha256 || reviewedCaseId))`; tokens are sorted deterministically, any collision fails closed, an exact approved-request rerun must reproduce identical blinded-input and candidate-output digests, and a different `requestSha256` must change every candidate identifier. The candidate never receives `reviewedCaseId`, the mapping, labels, answer keys, or the full bundle. The FND harness—not candidate code—retains the full signed bundle/gold labels, scores the canonical candidate output, writes the strict verification to Object Lock, and emits only `verification.json` plus `verification.coordinate.json`; it rejects Docker socket/image/tag/mount/network/runtime overrides. Candidate `run_prod_eval_containers.py`, `verify_ai_*`, and reports are diagnostics only. Tests cover exact-request rerun equality, cross-request unlinkability, sort-order stability, truncation/collision rejection, and every forbidden gold/mapping mount or output.

The production-evaluation catalog has one FND-owned, dual-approved bootstrap authority; no AI workflow or protected variable may create or advance it. `ai-production-eval-registry-anchor.v1` is exactly `{schemaVersion:"ai-production-eval-registry-anchor.v1",registry:{bucket,key,versionId,sha256},rootBundle:{secretArn,versionId,sha256},sequence,updatedAt,anchorSha256}` and `ai-production-eval-bundle-anchor.v1` is exactly `{schemaVersion:"ai-production-eval-bundle-anchor.v1",bundle:{bucket,key,versionId,sha256},corpus:{bucket,key,versionId,sha256},registrySha256,sequence,updatedAt,anchorSha256}`. Every object is `additionalProperties:false`; S3 coordinates include the fixed Seoul bucket, content-addressed key, AWS-returned VersionId, and lowercase `sha256:` digest; the root coordinate includes the exact FND Secrets Manager ARN, VersionId, and digest; sequence is a positive integer; timestamps are server-derived UTC `Z`; and each self-digest hashes RFC 8785 bytes omitting only itself. These schema and fixture bytes are the canonical contracts consumed unchanged by AI.

The immutable bootstrap request is exactly `{schemaVersion:"ai-production-evaluation-bootstrap-request.v1",registry:{object,proposal,domainApproval,securityApproval,signingResult,signedEnvelope},bundle:{object,proposal,domainApproval,securityApproval,signingResult,signedEnvelope},corpus:{object,proposal,domainApproval,securityApproval,signingResult,signedEnvelope},rootBundle,foundationSnapshot,expectedRegistryAnchorSha256,expectedBundleAnchorSha256,requestedAt,expiresAt,requestSha256}`. Every named artifact field is an exact coordinate; `rootBundle` is the exact secret tuple above; `foundationSnapshot` is an exact `{key,versionId,sha256}` coordinate; expected anchor digests are both null only for first bootstrap and otherwise both nonnull; expiry is at most 30 minutes; and the self-digest omits only itself. The three rows must respectively prove the complete generic signing chains for `ai-eval-key-registry`, `ai-eval-bundle`, and `ai-eval-corpus`, including distinct domain-owner/security receipts. The authority exact-fetches every VersionId, verifies the FND public root bundle and fixed domain prefixes locally, rejects test IDs/prefixes/buckets, proves bundle → registry and corpus → bundle relationships, requires the root tuple to byte-equal the approved snapshot, and derives both new anchors and their common server time. Bootstrap conditionally creates both absent keys in one `TransactWriteItems`; rotation requires both expected digests, exactly `sequence+1`, unchanged first-seen key history, and conditionally replaces both keys in one transaction. Rollback, sequence gaps, partial/equivocating chains, `AWSCURRENT`, List/Query/Scan, caller timestamps, cross-domain signatures, reused receipt actors/runs, or one-key writes fail before mutation.

The result is exactly `{schemaVersion:"ai-production-evaluation-bootstrap-result.v1",requestSha256,registryAnchorSha256,bundleAnchorSha256,registrySequence,bundleSequence,outcome,completedAt,resultSha256}` where `outcome` is `created|advanced`, both sequence values equal the committed anchors, `completedAt` equals their `updatedAt`, and the self-digest omits only itself. The fixed alias invocation is exactly `{request:{key,versionId,sha256},oidcToken}` and returns only `{result:{key,versionId,sha256}}`. It freshly verifies the dedicated protected workflow OIDC identity, writes the result once under `ai-production-evaluation-bootstrap-results/<requestSha256>/<resultSha256>.json` with checksum/Object Lock/`If-None-Match:*`, and on retry accepts only the byte-identical already-anchored transaction/result. `ai_production_evaluation_bootstrap.py` has only `project-dispatch|prepare|invoke|verify|emit-coordinate`. `project-dispatch` receives the eighteen workflow scalars, enforces strict key/VersionId/digest grammar plus fixed production prefixes, and writes six exact additional-properties-false `{key,versionId,sha256}` coordinate files with `O_CREAT|O_EXCL|O_NOFOLLOW`, mode `0440`, fsync, and re-read. `prepare` accepts only those six exact ceremony coordinate files and the verified foundation snapshot, exact-fetches their complete chains, constructs rather than accepts expected state/time/digests, uploads one canonical request, and writes its exact coordinate. `invoke` obtains a fresh custom-audience GitHub OIDC token, invokes only the qualified alias from the snapshot, and accepts only the result coordinate. `verify` exact-fetches the request/result and strongly re-reads both committed anchors. `emit-coordinate` revalidates the result coordinate and emits only one escaped `result_coordinate=<compact canonical JSON>` line to `GITHUB_OUTPUT` plus the same fenced JSON to `GITHUB_STEP_SUMMARY`; it rejects control/newline/fence injection, extra fields, or output above 1 KiB and never emits a body, ARN, bucket, actor, or server response. Tests cover initial creation, higher-sequence rotation, identical response loss, every nested mutation, all eighteen scalar mappings, coordinate-file mode/path/symlink/reuse, dual-approval separation, root/snapshot drift, partial transaction, stale/equivocating state, test material, current/list fallback, output injection, and result substitution.

`ai-release-authorization-verification.v1` is exactly `{schemaVersion,releaseId,request,domainApproval,securityApproval,promotionIntent,foundationSnapshot,workflowIdentity,sourceSha,signedTag,workerImageDigest,collectorImageDigest,terraformPlanSha256,releaseBundleSha256,productionEvaluationVerificationSha256,authorizedAt,expiresAt,authorizationSha256}`. Every named object is an exact `{key,versionId,sha256}` coordinate where applicable; `releaseId` is derived only as `<verified OIDC runId>-<verified OIDC runAttempt>`; all scalar values are recomputed from exact bytes; expiry is no later than the request/receipts; and the self-digest omits only itself. The fixed authorization alias accepts only `{request,domainApproval,securityApproval,workflowIdentity,foundationSnapshot}` coordinates, exact-fetches and strict-validates the entire request→two independent receipts→intent/source/tag→snapshot→plan→release-bundle→FND production-evaluation verification chain, reruns all FND generic schema/digest/role/actor/expiry/one-use checks, and writes one Object-Locked authorization. Candidate code cannot authorize, reserve, terminalize, or substitute a byte.

`ai-release-postcondition-verification.v1` is exactly `{schemaVersion,releaseId,authorizationSha256,reservationSha256,deployRecordSha256,foundationSnapshotSha256,artifactActiveSetSha256,collectorFinalSha256,workerFinalSha256,telemetryProbeResultSha256,workloadStageTerminalSha256,workloadPromotionTerminalSha256,outcome,verifiedAt,verificationSha256}` with `additionalProperties:false`; the two workload fields are nullable only when the authorized release kind does not use them, `outcome` is exactly `released`, and the self-digest omits only itself. The fixed postcondition alias accepts only `{authorization,deployRecord}` coordinates, exact-fetches them, strongly reads the same-fence reservation/control rows and live ECS/target state, independently verifies the complete mode-specific stage/promotion/recall/telemetry/result-pointer chain, writes this Object-Locked verification, and alone executes the approval-use/release-terminal/reservation-delete transaction. It fails without terminalizing on any missing, stale, candidate-authored, mismatched, or ambiguous evidence. Outside its isolated `evaluate` harness, `ai_release_authority.py authorize|finalize|recover` is a thin closed client: it strict-loads only the verified FND snapshot, invokes only the qualified authorization/postcondition aliases or recovery state machine in that snapshot, exact-fetches their returned coordinates, and emits canonical files; it accepts no alias/ARN/bucket/table/role/mode override. Its exact source digest is `ai_release_authority_client_sha256`; every workflow checks that digest before execution. Tests mutate every field, nested coordinate, actor/role/workflow/snapshot/source/eval/service/fence/stage/recall/probe binding, blinded/gold mount, network/cap/resource option, client hash, response, and terminal race.

Result is exactly `{schemaVersion:"ai-artifact-signing-result.v1",requestSha256,domain,keyId,inputSha256,signatureBase64Url,publicKeySha256,signingKeyVersionId,executedAt,executionArnSha256,resultSha256}`; `resultSha256` hashes canonical bytes omitting only itself. A key secret is exactly `{schemaVersion:"ai-ed25519-signing-key.v1",purpose,keyId,privateKeyPkcs8Base64,publicKeyRawBase64Url,notBefore,notAfter,state}`, where state is `next|active|retired|revoked`, encodings are canonical, public/private bytes match, and the key is in-window. The public bundle is exactly `{schemaVersion:"ai-artifact-signing-root-bundle.v1",sequence,generatedAt,keys,bundleSha256}`; sorted unique rows are exactly `{domain,purpose,keyId,publicKeyRawBase64Url,publicKeySha256,notBefore,notAfter,state}`, and the bundle digest omits only itself. Valid transitions are absent→next, next→active, active→retired|revoked, and retired→revoked; every reverse/skip/reused-material transition fails.

The key ceremony has a separate closed wire contract. Its core is exactly `{schemaVersion:"ai-artifact-key-ceremony-core.v1",requestId,operation,domains,expectedBundle,requestedAt,expiresAt}`. `operation` is `bootstrap-all|rotate-one|revoke-one`; `domains` is a sorted unique array with exactly all twelve table domains for `bootstrap-all` and exactly one table domain otherwise; `expectedBundle` is null only for bootstrap and otherwise is exactly `{sequence,versionId,bundleSha256}`. The ceremony-core digest is `sha256:` plus lowercase SHA-256 of the exact RFC 8785 bytes. Each of two independent producers writes one receipt exactly `{schemaVersion:"ai-artifact-key-ceremony-approval-receipt.v1",ceremonyCoreSha256,operation,domains,expectedBundleSequence,expectedBundleSha256,approvalRole,approverSubject,approvedAt,evidenceSha256,issuerRoleArn,oidc,receiptSha256}`; `expectedBundleSequence` and `expectedBundleSha256` are both null only for bootstrap, `oidc` has the same exact signed-claim shape and validation as an artifact receipt, roles are exactly `key_custodian` and `security_release`, and the self-digest omits only `receiptSha256`. The full state-machine request is exactly `{schemaVersion:"ai-artifact-key-ceremony-request.v1",core:{key,versionId,sha256},approvals:{keyCustodian:{key,versionId,sha256},security:{key,versionId,sha256}},ceremonyCoreSha256,requestSha256}`; both receipt coordinates are mandatory, exact-version, distinct, and the full-request digest omits only itself.

The ceremony result is exactly `{schemaVersion:"ai-artifact-key-ceremony-result.v1",requestSha256,operation,domains,previousBundle,intermediateBundle,finalBundle,changedKeys,executedAt,executionArnSha256,resultSha256}`. Every nonnull bundle coordinate is exactly `{sequence,versionId,bundleSha256}`; `previousBundle` is null only at bootstrap; `intermediateBundle` is required for bootstrap/rotation and null for revocation; `finalBundle` is always nonnull. `changedKeys` is sorted and has one row per affected domain exactly `{domain,keyId,secretVersionId,publicKeySha256,fromState,toState}` with nullable `fromState` only for bootstrap and states from the frozen enum. The result self-digest omits only `resultSha256`. Bootstrap publishes all twelve unique keys as `next` in sequence 1, performs isolated sample sign/local-verify for every fixed prefix and exact public bundle, then publishes the same keys as `active` in sequence 2. Rotation publishes the new key as `next` at expected sequence + 1, verifies old/new public readiness and fixed-prefix sample signatures, then publishes new `active` plus old `retired` at expected sequence + 2. Revocation publishes the named active/retired key as `revoked` at expected sequence + 1 and never selects a replacement implicitly. Every state, bundle coordinate, secret VersionId, request/result digest, and one-use operation is conditionally anchored; partial publish, reused key bytes, skipped sequence, replay with changed bytes, or a single/same-actor approval fails. `packages/contracts/fixtures/ai-artifact-key-ceremony.valid.json` fixes canonical bootstrap, rotation, revocation, mutation, and rollback bytes.

Freeze this complete table in `domains.py` and fixed vectors:

| Domain | Signature prefix before exact canonical input | Required domain-owner role | Input cap |
|---|---|---|---:|
| `evidence-pack` | `GC-EVIDENCE-PACK-V1\0` | `clinical_scientific` | 524288 |
| `evidence-key-registry` | `GC-EVIDENCE-KEY-REGISTRY-V1\0` | `release_owner` | 65536 |
| `ai-runtime-control` | `GC-AI-RUNTIME-CONTROL-V1\0` | `clinical_safety` | 65536 |
| `ai-runtime-control-key-registry` | `GC-AI-RUNTIME-CONTROL-KEY-REGISTRY-V1\0` | `release_owner` | 65536 |
| `evidence-recall-notice` | empty bytes | `clinical_safety` | 16384 |
| `evidence-recall-release` | empty bytes | `clinical_safety` | 2097152 |
| `evidence-recall-key-registry` | `GC-EVIDENCE-RECALL-KEY-REGISTRY-V1\0` | `release_owner` | 65536 |
| `ai-eval-corpus` | `GC-AI-EVAL-CORPUS-V1\0` | `clinical_safety` | 262144 |
| `ai-eval-bundle` | `GC-AI-EVAL-BUNDLE-V1\0` | `release_owner` | 2097152 |
| `ai-eval-key-registry` | `GC-AI-EVAL-KEY-REGISTRY-V1\0` | `release_owner` | 65536 |
| `workload-jwks-release` | `GC-WORKLOAD-JWKS-RELEASE-V1\0` | `release_owner` | 65536 |
| `workload-jwks-root-registry` | `GC-WORKLOAD-JWKS-ROOT-REGISTRY-V1\0` | `release_owner` | 65536 |

Each domain maps internally to one distinct fixed Secrets Manager container/purpose; no request carries a secret ARN, provider, prefix, bucket, KMS key, region, or key material. Every request requires the table's domain-owner receipt plus a `security_release` receipt. A non-registry domain requires `expectedRegistry`; a registry domain requires null. `outputKey` must equal `results/<domain>/<requestId>.json`; input and receipt keys must match their fixed content-addressed prefixes. Expiry is UTC `Z`, no more than 15 minutes after both receipts, and not expired at execution.

Tests instrument `open`, `pathlib.Path.open`, `tempfile`, subprocess, environment mutation, logging, Lambda return, exception text, and mocked AWS/Step Functions calls. They fail if PKCS#8/public key/signature input/private bytes enter a file, env, state, log, metric, trace, exception, or result. Mutations cover every field/digest, duplicate key, unknown domain/role, role alias, reused subject/issuer role/workflow run, wrong evidence digest, wrong registry nullability, cross-domain key/prefix/signature, oversized input, symlink-like key, output-key drift, expired/future request, inactive/out-of-window key, noncanonical encoding, self-hash recursion, direct KMS decrypt/sign, arbitrary ARN/provider, and result equivocation.

The keyless approval-verifier tests use signed fixed JWT vectors. They require issuer `https://token.actions.githubusercontent.com`; discovery URL `https://token.actions.githubusercontent.com/.well-known/openid-configuration`; discovered JWKS URL exactly `https://token.actions.githubusercontent.com/.well-known/jwks`; HTTPS with no redirect; 8 KiB discovery, 64 KiB JWKS, 8 KiB JWT, at most eight unique RSA keys, `RS256`, exact audience per approval producer, and current `exp`. Only freshly signature-verified claims `actor_id`, `run_id`, `run_attempt`, `repository_id`, `workflow_ref`, `workflow_sha`, `ref`, `environment`, `aud`, `iss`, `exp`, and `jti` may derive receipt fields. `workflow_ref` must equal the exact ordinary caller workflow path plus protected ref, and `workflow_sha` must be the exact trusted 40-hex commit; `job_workflow_ref` is neither required nor accepted because no reusable workflow exists. Actor/run/role never comes from request JSON, a session name, display name, environment reviewer assumption, or mutable repository variable. Cache lifetime is `min(300, max-age)` seconds; unknown/reused `kid`/`jti`, repeated JWT digest/run/attempt, discovery/JWKS host drift, key-set equivocation, stale cache after refresh failure, missing/duplicate claim, wrong repository/ref/workflow/workflow SHA/environment/audience, nonnumeric actor/run/attempt, or actor not in the FND-pinned disjoint role registry fails closed. Tests prove no actor/principal/team appears in both domain-owner and security-release allowlists and no role can invoke both producer Lambdas.

Artifact/key approval aliases accept one additional-properties-false invocation object exactly `{coordinate,evidenceCoordinate,oidcToken}`. Plan-approval aliases accept exactly `{coordinate,oidcToken}` because their fixed protected workflow/role/team separation is the approval evidence; no `evidenceCoordinate` is accepted in plan mode. Coordinates are exactly `{key,versionId,sha256}`, keys match the alias's hard-coded content-addressed prefix, each fetched object is at most 64 KiB, and `oidcToken` is at most 8 KiB. Approval aliases respond only `{receipt:{key,versionId,sha256}}`; the plan-request publisher has its own closed producer request and responds only `{request:{key,versionId,sha256}}`; the release-identity alias uses only `{oidcToken}`; and the two release-authority aliases use only the fixed coordinate objects specified above. The publisher alias exact-fetches the immutable promotion intent, plan draft, snapshot, and release evidence, derives `planActorId`, `planRunId`, and `planRunAttempt` only from the verified OIDC token, constructs the exact FND plan request, and writes it once; caller actor/run/request fields are prohibited. Approval aliases exact-fetch the core/request and, only for artifact/key mode, the evidence coordinate, then emit only their fixed receipt role. Tests invoke all twelve aliases through their real handler configuration and reject wrong/unqualified alias, caller mode/role/actor/run/evidence in plan mode, missing evidence in artifact mode, wrong audience/workflow SHA/environment/prefix/VersionId/digest, oversized token/object, cross-alias replay, or response extras. `ai_artifact_signing_ceremony.py` is the only generic artifact client: `stage` exact-fetches immutable source/core bytes, recomputes every digest, and writes one content-addressed core through the publisher role; `approve-domain` and `approve-security` invoke only their fixed aliases; `invoke` constructs the strict two-receipt request and starts only `ai_artifact_signing_state_machine_arn`; and `verify` exact-fetches the immutable result and verifies the fixed prefix/public root bundle locally. It accepts no bucket, state-machine, alias, role, prefix, provider, secret ARN, or private-key argument; those values come only from strict exact-digest FND outputs.

- [ ] **Step 2: Run the signer tests and confirm the red state**

Run:

```bash
python scripts/ci/run_locked_uv.py -- sync --project infra/functions/ai-artifact-signer --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen pytest infra/functions/ai-artifact-signer/tests scripts/release/test_build_ai_artifact_signer_image.py scripts/release/test_build_ai_artifact_approval_zip.py scripts/tests/test_ai_artifact_key_ceremony.py scripts/tests/test_ai_artifact_signing_ceremony.py scripts/tests/test_ai_release_workflow_identity.py scripts/tests/test_ai_promotion_intent.py scripts/tests/test_ai_release_authority.py scripts/tests/test_ai_production_evaluation_bootstrap.py -q
```

Expected: FAIL because the strict schemas/domain map/handlers and reproducible ZIP builder do not exist.

- [ ] **Step 3: Implement in-memory signing, local verification, and protected key lifecycle**

Eleven non-VPC keyless functions use the same minimal ZIP: nine immutable OIDC-verifying aliases with fixed handler/configuration, distinct execution roles, audiences, workflows, environments, actor allowlists, and output prefixes for artifact domain/security approval, production-plan domain/security approval, key-ceremony custodian/security approval, plan-request publication, and release-workflow identity verification, and production-evaluation bootstrap; plus the fixed release-authorization and release-postcondition aliases. A twelfth immutable broker alias is closed to key-ceremony invocation and cannot verify OIDC or mint a receipt. Artifact/key approval receives exact core/evidence coordinates and a GitHub OIDC JWT; plan approval receives only the request coordinate and JWT; release authority receives only its frozen coordinate request. The OIDC functions server-verify the JWT, derive rather than accept subject/run/issuer role, recompute every bound field, write exactly one content-addressed receipt/identity record with `If-None-Match:*`, conditionally record the JWT/actor/run/request replay key, and return only its coordinate. Release-authority functions exact-fetch approved inputs and use strongly consistent read or one closed terminal transaction only; they cannot deploy or accept an action/resource override. All functions have no VPC attachment, Secrets Manager/private-key permission, arbitrary URL, redirect, proxy, or generic HTTP client surface beyond OIDC handlers' hard-coded discovery/JWKS GETs. Domain, security, key-custodian, plan-request, release-identity, evaluation-bootstrap, authorization, and postcondition principals/configurations are disjoint where required, and OpenTofu rejects any prohibited intersection.

The one-shot `sign` Fargate task receives only the strict full request from the state machine. It fetches core and both receipts from the fixed staging bucket by exact key **and VersionId**, caps each at 16 KiB, recomputes object/self/full-request digests and all cross-bound fields, and requires the exact domain-owner role plus `security_release`, distinct verified actor IDs, distinct issuer-role ARNs, and distinct workflow runs. It fetches exact input and optional registry coordinates only as opaque bytes, enforces the fixed generic byte cap, and binds their digests; FND does **not** parse or assert an AI-owned payload schema, registry sequence, or scientific policy. It maps domain+keyId internally to one exact key-secret ARN/version, reads it only through Secrets Manager in the isolated subnet, requires an active in-window key for a first-seen request, signs `fixedPrefix || exactInputBytes` in process, and locally verifies the 64-byte Ed25519 signature before constructing the result. It writes the canonical result once to the fixed Object-Lock result bucket with `If-None-Match:*`, records `(domain,keyId,sequence,requestSha256,inputSha256,resultSha256,resultVersionId)` through a DynamoDB conditional transaction, best-effort overwrites mutable key/input buffers, drops references, and exits so Fargate destroys the task and its FND-CMK-encrypted ephemeral storage. Private bytes never enter a file, env, state, log, metric, trace, exception, or result; no impossible total-memory-zeroization claim is made. An exact idempotent retry returns the existing byte-identical coordinate without loading/signing again. A retired key can serve only that already anchored result; it cannot sign a first-seen/backdated request. Revoked material signs nothing; immutable historical results remain readable as provenance.

The one-shot `key-ceremony` Fargate command uses a separate task role and is invoked only by an unexported security-account ceremony state machine. Its closed operations are `bootstrap-all`, `rotate-one`, and `revoke-one`; the first succeeds exactly once for the complete twelve-domain set, while later operations require a higher bundle sequence, exact current bundle digest, unexpired two-receipt security ceremony, and one fixed domain. It generates Ed25519 keys in process, locally verifies public/private correspondence, writes one exact key-secret version, publishes a higher public bundle version, records the transition transactionally, best-effort wipes mutable buffers, and exits/destroys its encrypted task storage. Active/new, retired, and revoked transitions are monotonic; public material is never reused across purposes. Bootstrap/rotation/revocation results contain only public hashes/VersionIds. Backups cover encrypted key secret versions and immutable public/result artifacts; restore is accepted only after bundle/secret/public-key correspondence, state-table anchor, active-window, and sample local-verify drills pass.

`Dockerfile.signer` uses only the root `python312SlimBookworm` linux/amd64 manifest digest, the preverified uv binary, frozen wheels, numeric user `65532:65532`, read-only-compatible paths, an exec-form entrypoint that never invokes the Debian shell, a denylist for remote diagnostic clients, and the same SUID/SGID stripping assertion as Task 7A. `build_ai_artifact_signer_image.py` builds/export-compares two OCI layouts, verifies packages/SBOM/licenses/base/result/provenance and scans SUID/SGID/capability/prohibited-file state. `build_ai_artifact_approval_zip.py` installs only `contracts.py`, `domains.py`, `approval_handler.py`, `plan_request_handler.py`, `release_identity_handler.py`, `release_authorization_handler.py`, `release_postcondition_handler.py`, `evaluation_anchor_handler.py`, `key_ceremony_broker_handler.py`, and their locked dependencies into a normalized ZIP; it rejects `sign_handler.py`, `key_ceremony_handler.py`, private-key APIs/files, `.pyc`, tests, caches, any handler outside this nine-file allowlist, or native libraries absent from the lock. Both builders use the preverified uv binary, never pip, and build twice/byte-compare. `supply-chain/fnd-ai-artifact-signer.lock.json` binds the root/tool lock digests, Python/uv/direct dependencies, every wheel/source hash, source/config/schema/domain-map/client digests, image/ZIP/SBOM/license/provenance inputs, and exact entry points.

- [ ] **Step 4: Run signer, reproducibility, and secret-sink checks**

Run:

```bash
python scripts/ci/run_locked_uv.py -- lock --project infra/functions/ai-artifact-signer --check
python scripts/ci/run_locked_uv.py -- sync --project infra/functions/ai-artifact-signer --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen pytest infra/functions/ai-artifact-signer/tests scripts/release/test_build_ai_artifact_signer_image.py scripts/release/test_build_ai_artifact_approval_zip.py scripts/tests/test_ai_artifact_key_ceremony.py scripts/tests/test_ai_artifact_signing_ceremony.py scripts/tests/test_ai_release_workflow_identity.py scripts/tests/test_ai_promotion_intent.py scripts/tests/test_ai_release_authority.py scripts/tests/test_ai_production_evaluation_bootstrap.py -q
test "$(uname -s)-$(uname -m)" = "Linux-x86_64"
python scripts/ci/run_locked_uv.py -- --version
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/release/build_ai_artifact_signer_image.py --check-reproducible
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/release/build_ai_artifact_approval_zip.py --check-reproducible
```

Expected: all tests pass; OCI and approval-ZIP double builds are byte-identical; every domain/prefix/dual-receipt/cap vector passes; cross-domain, lifecycle, OIDC/replay, rollback, equivocation, file/env/log/state/private-key leaks fail.

- [ ] **Step 5: Commit the signer package and contracts**

```bash
git add infra/functions/ai-artifact-signer packages/contracts/jsonschema/ai-artifact-signing-proposal.schema.json packages/contracts/jsonschema/ai-artifact-signing-request-core.schema.json packages/contracts/jsonschema/ai-artifact-signing-approval-receipt.schema.json packages/contracts/jsonschema/ai-artifact-signing-request.schema.json packages/contracts/jsonschema/ai-artifact-signing-result.schema.json packages/contracts/jsonschema/ai-ed25519-signing-key.schema.json packages/contracts/jsonschema/ai-artifact-signing-root-bundle.schema.json packages/contracts/jsonschema/ai-artifact-key-ceremony-core.schema.json packages/contracts/jsonschema/ai-artifact-key-ceremony-approval-receipt.schema.json packages/contracts/jsonschema/ai-artifact-key-ceremony-request.schema.json packages/contracts/jsonschema/ai-artifact-key-ceremony-result.schema.json packages/contracts/jsonschema/ai-production-plan-request.schema.json packages/contracts/jsonschema/ai-production-plan-approval-receipt.schema.json packages/contracts/jsonschema/ai-promotion-intent.schema.json packages/contracts/jsonschema/ai-promotion-intent-draft.schema.json packages/contracts/jsonschema/ai-promotion-source.schema.json packages/contracts/jsonschema/ai-release-workflow-identity.schema.json packages/contracts/jsonschema/ai-production-evaluation-request.schema.json packages/contracts/jsonschema/ai-production-evaluation-verification.schema.json packages/contracts/jsonschema/ai-release-authorization-verification.schema.json packages/contracts/jsonschema/ai-release-postcondition-verification.schema.json packages/contracts/fixtures/ai-artifact-signing-proposal.valid.json packages/contracts/fixtures/ai-artifact-signing-approval-receipt.valid.json packages/contracts/fixtures/ai-artifact-key-ceremony.valid.json packages/contracts/fixtures/ai-production-plan-approval-receipt.valid.json packages/contracts/fixtures/ai-promotion-intent.valid.json packages/contracts/fixtures/ai-promotion-intent-draft.valid.json packages/contracts/fixtures/ai-promotion-source.valid.json packages/contracts/fixtures/ai-release-workflow-identity.valid.json packages/contracts/fixtures/ai-production-evaluation-request.valid.json packages/contracts/fixtures/ai-production-evaluation-verification.valid.json packages/contracts/fixtures/ai-release-authorization-verification.valid.json packages/contracts/fixtures/ai-release-postcondition-verification.valid.json scripts/security/fixtures/ai-production-plan-approval-receipt.invalid.json scripts/release/build_ai_artifact_signer_image.py scripts/release/test_build_ai_artifact_signer_image.py scripts/release/build_ai_artifact_approval_zip.py scripts/release/test_build_ai_artifact_approval_zip.py supply-chain/fnd-ai-artifact-signer.lock.json
git add packages/contracts/fixtures/ai-artifact-signing-root-bundle.valid.json scripts/security/ai_artifact_key_ceremony.py scripts/tests/test_ai_artifact_key_ceremony.py scripts/security/ai_artifact_signing_ceremony.py scripts/tests/test_ai_artifact_signing_ceremony.py scripts/security/ai_release_workflow_identity.py scripts/tests/test_ai_release_workflow_identity.py scripts/security/ai_promotion_intent.py scripts/tests/test_ai_promotion_intent.py scripts/release/ai_release_authority.py scripts/tests/test_ai_release_authority.py
git add packages/contracts/jsonschema/ai-production-eval-registry-anchor.schema.json packages/contracts/jsonschema/ai-production-eval-bundle-anchor.schema.json packages/contracts/jsonschema/ai-production-evaluation-bootstrap-request.schema.json packages/contracts/jsonschema/ai-production-evaluation-bootstrap-result.schema.json packages/contracts/fixtures/ai-production-eval-registry-anchor.valid.json packages/contracts/fixtures/ai-production-eval-bundle-anchor.valid.json packages/contracts/fixtures/ai-production-evaluation-bootstrap-request.valid.json packages/contracts/fixtures/ai-production-evaluation-bootstrap-result.valid.json scripts/security/ai_production_evaluation_bootstrap.py scripts/tests/test_ai_production_evaluation_bootstrap.py
git commit -m "feat: add closed Seoul AI artifact signer"
```

---

### Task 7C: Build the encrypted three-AZ Seoul runtime foundation

**Files:**
- Create: `infra/modules/kr-foundation/variables.tf`
- Create: `infra/modules/kr-foundation/network.tf`
- Create: `infra/modules/kr-foundation/application-egress.tf`
- Create: `infra/modules/kr-foundation/dns-firewall.tf`
- Create: `infra/modules/kr-foundation/service-identity.tf`
- Create: `infra/modules/kr-foundation/identity-rotation.tf`
- Create: `infra/modules/kr-foundation/ai-telemetry.tf`
- Create: `infra/modules/kr-foundation/telemetry-bootstrap.tf`
- Create: `infra/modules/kr-foundation/ai-artifact-signing.tf`
- Create: `infra/modules/kr-foundation/ai-runtime-control.tf`
- Create: `infra/modules/kr-foundation/ai-production-evaluation-bootstrap.tf`
- Create: `infra/modules/kr-foundation/ai-release-recovery.tf`
- Create: `infra/modules/kr-foundation/ux-deployment-authority.tf`
- Create: `infra/modules/kr-foundation/pub-rec-release.tf`
- Create: `infra/modules/kr-foundation/identity.tf`
- Create: `infra/modules/kr-foundation/kms.tf`
- Create: `infra/modules/kr-foundation/storage.tf`
- Create: `infra/modules/kr-foundation/database.tf`
- Create: `infra/modules/kr-foundation/compute.tf`
- Create: `infra/modules/kr-foundation/edge.tf`
- Create: `infra/modules/kr-foundation/security.tf`
- Create: `infra/modules/kr-foundation/outputs.tf`
- Test: `infra/modules/kr-foundation/tests/security.tftest.hcl`
- Test: `infra/modules/kr-foundation/tests/application_egress.tftest.hcl`
- Test: `infra/modules/kr-foundation/tests/service_identity.tftest.hcl`
- Test: `infra/modules/kr-foundation/tests/ai_telemetry.tftest.hcl`
- Test: `infra/modules/kr-foundation/tests/telemetry_bootstrap.tftest.hcl`
- Test: `infra/modules/kr-foundation/tests/ai_artifact_signing.tftest.hcl`
- Test: `infra/modules/kr-foundation/tests/ai_runtime_control.tftest.hcl`
- Test: `infra/modules/kr-foundation/tests/ai_production_evaluation_bootstrap.tftest.hcl`
- Test: `infra/modules/kr-foundation/tests/ai_release_recovery.tftest.hcl`
- Test: `infra/modules/kr-foundation/tests/ux_deployment_authority.tftest.hcl`
- Test: `infra/modules/kr-foundation/tests/pub_rec_release.tftest.hcl`
- Create: `infra/functions/private-identity-rotation/.python-version`
- Create: `infra/functions/private-identity-rotation/pyproject.toml`
- Generate: `infra/functions/private-identity-rotation/uv.lock`
- Create: `infra/functions/private-identity-rotation/src/gc_identity_rotation/__init__.py`
- Create: `infra/functions/private-identity-rotation/src/gc_identity_rotation/contracts.py`
- Create: `infra/functions/private-identity-rotation/src/gc_identity_rotation/pca.py`
- Create: `infra/functions/private-identity-rotation/src/gc_identity_rotation/recall_handler.py`
- Create: `infra/functions/private-identity-rotation/src/gc_identity_rotation/telemetry_handler.py`
- Test: `infra/functions/private-identity-rotation/tests/test_contracts.py`
- Test: `infra/functions/private-identity-rotation/tests/test_recall_handler.py`
- Test: `infra/functions/private-identity-rotation/tests/test_telemetry_handler.py`
- Create: `scripts/release/build_private_identity_rotation_zip.py`
- Test: `scripts/release/test_build_private_identity_rotation_zip.py`
- Create: `supply-chain/fnd-functions.lock.json`
- Create: `packages/contracts/jsonschema/otel-server-identity.schema.json`
- Create: `packages/contracts/jsonschema/otel-client-identity.schema.json`
- Create: `packages/contracts/jsonschema/otel-ca-epoch.schema.json`
- Create: `packages/contracts/jsonschema/otel-identity-promotion.schema.json`
- Create: `packages/contracts/jsonschema/otel-identity-bootstrap-handoff.schema.json`
- Create: `packages/contracts/fixtures/otel-identity-bootstrap-handoff.valid.json`
- Create: `packages/contracts/jsonschema/verified-otel-identity-bootstrap-handoff.schema.json`
- Create: `packages/contracts/fixtures/verified-otel-identity-bootstrap-handoff.valid.json`
- Create: `packages/contracts/jsonschema/workload-jwks-public-stage-request.schema.json`
- Create: `packages/contracts/jsonschema/workload-jwks-public-stage-result.schema.json`
- Create: `packages/contracts/fixtures/workload-jwks-public-stage-request.valid.json`
- Create: `packages/contracts/fixtures/workload-jwks-public-stage-result.valid.json`
- Create: `packages/contracts/jsonschema/workload-jwks-promotion-request.schema.json`
- Create: `packages/contracts/fixtures/workload-jwks-promotion-request.valid.json`
- Create: `packages/contracts/jsonschema/workload-jwks-promotion-result.schema.json`
- Create: `packages/contracts/fixtures/workload-jwks-promotion-result.valid.json`
- Create: `packages/contracts/jsonschema/workload-key-quorum-result.schema.json`
- Create: `packages/contracts/fixtures/workload-key-quorum-result.valid.json`
- Create: `packages/contracts/jsonschema/workload-key-readiness.schema.json`
- Create: `packages/contracts/fixtures/workload-key-readiness.valid.json`
- Create: `packages/contracts/jsonschema/ai-release-reservation.schema.json`
- Create: `packages/contracts/fixtures/ai-release-reservation.valid.json`
- Create: `packages/contracts/jsonschema/ai-release-recovery-manifest.schema.json`
- Create: `packages/contracts/fixtures/ai-release-recovery-manifest.valid.json`
- Create: `packages/contracts/jsonschema/ai-release-recovery-result.schema.json`
- Create: `packages/contracts/fixtures/ai-release-recovery-result.valid.json`
- Create: `packages/contracts/jsonschema/ai-one-shot-result-pointer.schema.json`
- Create: `packages/contracts/fixtures/ai-one-shot-result-pointer.valid.json`
- Create: `packages/contracts/jsonschema/ai-telemetry-probe-control.schema.json`
- Create: `packages/contracts/fixtures/ai-telemetry-probe-control.valid.json`
- Create: `packages/contracts/jsonschema/ai-artifact-active-set.schema.json`
- Create: `packages/contracts/fixtures/ai-artifact-active-set.valid.json`
- Create: `packages/contracts/jsonschema/foundation-public-output-snapshot.schema.json`
- Create: `packages/contracts/fixtures/foundation-public-output-snapshot.valid.json`
- Create: `packages/contracts/jsonschema/foundation-output-env-map.schema.json`
- Create: `packages/contracts/fixtures/foundation-output-env-map.valid.json`
- Create: `governance/foundation/ai-foundation-output-env-map.json`
- Create: `governance/foundation/ux-foundation-output-env-map.json`
- Create: `governance/foundation/pub-foundation-output-env-map.json`
- Create: `governance/foundation/rec-foundation-output-env-map.json`
- Create: `infra/functions/ai-release-recovery/.python-version`
- Create: `infra/functions/ai-release-recovery/pyproject.toml`
- Generate: `infra/functions/ai-release-recovery/uv.lock`
- Create: `infra/functions/ai-release-recovery/Dockerfile`
- Create: `infra/functions/ai-release-recovery/src/gc_ai_release_recovery/__init__.py`
- Create: `infra/functions/ai-release-recovery/src/gc_ai_release_recovery/contracts.py`
- Create: `infra/functions/ai-release-recovery/src/gc_ai_release_recovery/handler.py`
- Test: `infra/functions/ai-release-recovery/tests/test_contracts.py`
- Test: `infra/functions/ai-release-recovery/tests/test_handler.py`
- Create: `scripts/release/build_ai_release_recovery_image.py`
- Test: `scripts/release/test_build_ai_release_recovery_image.py`
- Create: `packages/contracts/jsonschema/service-client-identity.schema.json`
- Create: `infra/live/kr-prod/main.tf`
- Create: `infra/live/kr-prod/providers.tf`
- Create: `infra/live/kr-prod/backend.tf`
- Create: `infra/live/kr-prod/variables.tf`
- Create: `infra/live/kr-prod/outputs.tf`
- Create: `ops/runbooks/application-egress-change.md`
- Create: `ops/runbooks/private-service-certificate-rotation.md`
- Create: `ops/runbooks/telemetry-identity-rotation.md`
- Create: `ops/runbooks/ai-artifact-signing.md`
- Create: `scripts/release/verify_telemetry_identity_evidence.py`
- Test: `scripts/release/test_verify_telemetry_identity_evidence.py`
- Create: `scripts/release/telemetry_identity_bootstrap.py`
- Test: `scripts/release/test_telemetry_identity_bootstrap.py`
- Create: `scripts/release/verify_ai_artifact_signing_bootstrap.py`
- Test: `scripts/release/test_verify_ai_artifact_signing_bootstrap.py`
- Create: `scripts/release/foundation_output_snapshot.py`
- Test: `scripts/release/test_foundation_output_snapshot.py`
- Create: `scripts/release/publish_rec_document_worker_jwks.py`
- Test: `scripts/release/test_publish_rec_document_worker_jwks.py`
- Create: `infra/functions/pub-rec-deployment-authority/.python-version`
- Create: `infra/functions/pub-rec-deployment-authority/pyproject.toml`
- Generate: `infra/functions/pub-rec-deployment-authority/uv.lock`
- Create: `infra/functions/pub-rec-deployment-authority/src/gc_pub_rec_deployment_authority/__init__.py`
- Create: `infra/functions/pub-rec-deployment-authority/src/gc_pub_rec_deployment_authority/contracts.py`
- Create: `infra/functions/pub-rec-deployment-authority/src/gc_pub_rec_deployment_authority/handler.py`
- Test: `infra/functions/pub-rec-deployment-authority/tests/test_contracts.py`
- Test: `infra/functions/pub-rec-deployment-authority/tests/test_handler.py`
- Create: `scripts/release/build_pub_rec_deployment_authority_zip.py`
- Test: `scripts/release/test_build_pub_rec_deployment_authority_zip.py`
- Create: `scripts/release/verify_pub_rec_image_handoff.py`
- Test: `scripts/release/test_verify_pub_rec_image_handoff.py`
- Create: `tooling/fnd-workstream-release/.python-version`
- Create: `tooling/fnd-workstream-release/pyproject.toml`
- Generate: `tooling/fnd-workstream-release/uv.lock`
- Create: `scripts/release/fnd_workstream_aws.py`
- Test: `scripts/release/test_fnd_workstream_aws.py`
- Create: `scripts/release/fnd_workstream_deploy.py`
- Test: `scripts/release/test_fnd_workstream_deploy.py`
- Create: `packages/contracts/jsonschema/fnd-workstream-image-deployment-request.schema.json`
- Create: `packages/contracts/fixtures/fnd-workstream-image-deployment-request.valid.json`
- Create: `packages/contracts/jsonschema/fnd-workstream-image-deployment-result.schema.json`
- Create: `packages/contracts/fixtures/fnd-workstream-image-deployment-result.valid.json`

**Interfaces:**
- Consumes: Task 6 `account_ids`; Task 7A immutable `telemetry_bootstrap_image_digest`, immutable `ux_web_deployment_authority_image_digest`, shared Java runtime and Python linux/amd64 base digests, and the immutable FND placeholder digest; Task 7B immutable `ai_artifact_signer_image_digest`, `ai_artifact_approval_zip_sha256`, and `ai_release_authority_client_sha256`; `certificate_arn`; `alert_topic_arn`; immutable personal `core_api_image_digest` matching `^sha256:[0-9a-f]{64}$`; database migration image digest; approved DNS name; protected disjoint domain-owner/security actor-ID registries; and, only for reviewed post-ceremony metadata applies, exact public signer-root, telemetry handoff, and immutable workload prepared-pair registry/release VersionId/SHA-256 coordinates. No PUB-built image digest or public enable flag is a first-apply input.
- Produces: identity/API outputs `oidc_issuer`, `oidc_jwk_set_uri`, `oidc_audience=https://api.genome-companion.kr`, `oidc_client_id`, distinct `public_data_operator_oidc_issuer`, `public_data_operator_oidc_jwk_set_uri`, `public_data_operator_oidc_audience=https://public-data-ops.genome-companion.kr`, `public_data_operator_oidc_client_id`, `api_base_url`, `core_api_private_base_url`, `core_api_private_listener_arn`, `public_api_private_base_url`, `public_api_private_listener_arn`, `product_web_client_security_group_id`, `core_api_repository_url`, `public_data_repository_url`, and `rec_document_worker_repository_url`.
- Produces: exact UX placement/DNS outputs `application_vpc_id`, sorted arrays `application_private_subnet_ids` and `application_edge_subnet_ids`, `application_ecs_cluster_arn`, `private_service_discovery_namespace_id`, `private_service_discovery_hosted_zone_id`, `private_service_discovery_namespace_name=service.kr.internal`, `product_collector_staging_internal_dns_name=product-collector.staging.service.kr.internal`, `product_collector_internal_dns_name=product-collector.service.kr.internal` (the canonical production name), `product_web_staging_smoke_security_group_id`, `product_web_production_smoke_security_group_id`, `product_web_hosted_zone_id`, `product_web_staging_dns_name=app.dev.genome-companion.kr`, `product_web_production_dns_name=app.genome-companion.kr`, `product_web_staging_certificate_arn`, `product_web_staging_certificate_dns_san=app.dev.genome-companion.kr`, `product_web_production_certificate_arn`, and `product_web_production_certificate_dns_san=app.genome-companion.kr`. For each exact `<environment>=staging|production`, it also exports `product_web_<environment>_alb_arn`, `product_web_<environment>_alb_dns_name`, `product_web_<environment>_alb_zone_id`, `product_web_<environment>_https_listener_arn`, `product_web_<environment>_bff_listener_rule_arn`, `product_web_<environment>_bff_blue_target_group_arn`, `product_web_<environment>_bff_green_target_group_arn`, `product_web_<environment>_collector_target_group_arn`, `product_web_<environment>_bff_blue_service_arn`, `product_web_<environment>_bff_green_service_arn`, `product_web_<environment>_collector_service_arn`, `product_web_<environment>_alb_security_group_id`, `product_web_<environment>_bff_security_group_id`, `product_web_<environment>_collector_security_group_id`, `product_web_<environment>_waf_acl_arn`, `product_web_<environment>_collector_service_registry_arn`, `product_web_<environment>_smoke_role_arn`, `product_web_<environment>_bff_task_role_arn`, `product_web_<environment>_bff_execution_role_arn`, `product_web_<environment>_collector_task_role_arn`, and `product_web_<environment>_collector_execution_role_arn`.
- Produces: exact UX deployment-authority outputs `ux_web_deployment_authority_image_digest`, `ux_web_staging_deployment_state_machine_arn`, `ux_web_production_deployment_state_machine_arn`, `ux_web_staging_deploy_fence_table_name`, `ux_web_staging_deploy_fence_table_arn`, `ux_web_production_deploy_fence_table_name`, `ux_web_production_deploy_fence_table_arn`, `ux_web_staging_deployment_authority_task_role_arn`, `ux_web_staging_deployment_authority_task_family_prefix`, `ux_web_staging_deployment_authority_security_group_id`, `ux_web_production_deployment_authority_task_role_arn`, `ux_web_production_deployment_authority_task_family_prefix`, and `ux_web_production_deployment_authority_security_group_id`. Execution roles and state-machine roles are distinct per environment, FND-owned, and deliberately not caller outputs.
- Produces: key/storage outputs `app_health_kms_key_arn`, `fargate_ephemeral_storage_kms_key_arn`, `explanation_telemetry_amp_kms_key_arn`, `private_service_identity_secret_kms_key_arn`, `ai_artifact_signing_key_kms_key_arn`, `record_export_attestation_key_arn` and its public key, quarantine/staging/retained-source bucket names, database secret ARN, private workload-token signing secret ARN, backup selections, `public_api_task_role_arn`, and `public_api_security_group_id`.
- Produces: egress/endpoint outputs `application_egress_security_group_id`, `application_network_firewall_policy_arn`, `application_network_firewall_endpoint_ids`, `application_dns_firewall_rule_group_id`, `application_allowed_tls_sni`, `ecs_control_plane_vpc_endpoint_id`, `elasticloadbalancing_vpc_endpoint_id`, `lambda_vpc_endpoint_id`, `cloudwatch_monitoring_vpc_endpoint_id`, `kms_vpc_endpoint_id`, `step_functions_vpc_endpoint_id`, `dynamodb_gateway_vpc_endpoint_id`, `private_ca_vpc_endpoint_id`, `aps_workspaces_vpc_endpoint_id`, `regional_sts_vpc_endpoint_id`, `secrets_manager_vpc_endpoint_id`, `ecr_api_vpc_endpoint_id`, `ecr_dkr_vpc_endpoint_id`, `cloudwatch_logs_vpc_endpoint_id`, `s3_gateway_vpc_endpoint_id`, `control_plane_endpoint_security_group_id`, `runtime_endpoint_security_group_id`, `ai_telemetry_endpoint_security_group_id`, `explanation_telemetry_collector_client_security_group_id`, and `identity_rotation_security_group_id`.
- Produces: service-identity outputs `private_service_ca_arn`, `private_service_trust_bundle_s3_uri`, `private_service_trust_bundle_secret_arn`, `private_service_trust_bundle_secret_version_id`, `private_service_trust_bundle_sha256`, the exact private AI/REC outputs below, `recall_probe_client_identity_secret_arn`, `recall_probe_client_identity_uri_san`, `recall_client_ca_bundle_sha256`, `recall_client_crl_s3_uri`, `recall_client_crl_bucket_name`, `recall_client_crl_key`, `recall_client_crl_version_id`, and `recall_client_crl_sha256`.
- Produces: telemetry outputs `otel_collector_server_identity_secret_arn`, `otel_worker_client_identity_secret_arn`, `otel_server_ca_epoch_secret_arn`, `otel_client_ca_epoch_secret_arn`, `otel_identity_promotion_manifest_secret_arn`, `otel_identity_promotion_manifest_schema_sha256`, `telemetry_identity_rotation_state_machine_arn`, `telemetry_identity_rotation_state_machine_role_arn`, `telemetry_identity_rotation_evidence_bucket_name`, `explanation_telemetry_amp_workspace_id`, `explanation_telemetry_amp_workspace_arn`, `explanation_telemetry_amp_remote_write_endpoint`, `explanation_telemetry_amp_retention_days=90`, `explanation_telemetry_collector_task_role_arn`, and `explanation_telemetry_collector_task_role_name`. The post-apply ceremony—not OpenTofu—produces the protected telemetry handoff key/VersionId/SHA and its verified summary.
- Produces: signer/release outputs `ai_artifact_signing_state_machine_arn`, `ai_artifact_signing_staging_bucket_name`, `ai_artifact_signing_result_bucket_name`, `ai_artifact_signing_key_kms_key_arn`, `ai_artifact_signing_public_root_bundle_secret_arn`, `ai_artifact_signing_public_root_bundle_version_id`, `ai_artifact_signing_public_root_bundle_sha256`, `ai_artifact_signing_publisher_role_arn`, `ai_artifact_signing_invoker_role_arn`, `ai_artifact_signing_domain_approval_role_arn`, `ai_artifact_signing_security_approval_role_arn`, `ai_artifact_key_ceremony_stage_workflow_role_arn`, `ai_artifact_key_custodian_approval_workflow_role_arn`, `ai_artifact_key_security_approval_workflow_role_arn`, `ai_artifact_key_ceremony_invoke_workflow_role_arn`, `ai_release_evidence_bucket_name`, `ai_production_evaluation_bootstrap_function_alias_arn`, `ai_production_evaluation_bootstrap_workflow_role_arn`, `ai_promotion_intent_workflow_role_arn`, `ai_plan_workflow_role_arn`, `ai_plan_domain_approval_workflow_role_arn`, `ai_plan_security_approval_workflow_role_arn`, `ai_release_workflow_role_arn`, `ai_release_recovery_workflow_role_arn`, `ai_release_recovery_state_machine_arn`, `ai_release_recovery_state_machine_role_arn`, `ai_release_recovery_handler_image_digest`, `ai_release_authority_client_sha256`, `ai_foundation_outputs_snapshot_bucket_name`, `ai_foundation_outputs_snapshot_key`, `ai_foundation_outputs_snapshot_version_id`, and `ai_foundation_outputs_snapshot_sha256`; all roles are distinct. No live telemetry epoch/CA/manifest scalar is exported; immutable coordinates are evidence, not runtime inputs.
- Produces: PUB/REC release/runtime outputs `pub_release_workflow_role_arn`, `rec_document_worker_release_workflow_role_arn`, `public_data_release_evidence_bucket`, `public_data_release_evidence_prefix=public-data-image-evidence/`, `rec_document_worker_release_evidence_bucket`, `rec_document_worker_release_evidence_prefix=rec-document-worker-image-evidence/`, `public_data_buildx_builder`, `rec_document_worker_buildx_builder`, `public_data_runtime_image`, `rec_document_worker_python_runtime_image`, `rec_document_worker_service_arn`, `rec_document_worker_target_group_arn`, `rec_document_worker_private_listener_arn`, `rec_document_worker_security_group_id`, `rec_document_core_authorization_signing_key_arn`, `rec_document_core_authorization_jwk_secret_arn`, `rec_document_core_authorization_jwk_secret_version_id`, `rec_document_core_authorization_jwk_sha256`, `rec_document_worker_result_signing_key_arn`, `rec_document_worker_result_jwk_secret_arn`, `rec_document_worker_result_jwk_secret_version_id`, `rec_document_worker_result_jwk_sha256`, `pub_rec_deployment_authority_state_machine_arn`, `pub_rec_deployment_authority_workflow_role_arn`, and `pub_rec_deployment_evidence_bucket_name`. Repository/runtime values are immutable repository@digest or locked builder identities; prefixes are fixed literals; none is a mutable task-definition selector. JWK coordinates identify nonsecret public verification material at one exact version/digest; private key material never leaves KMS.
- Produces only during the first-apply bootstrap: `rec_document_jwk_publisher_role_arn`. It is excluded from the public-output snapshot, may be assumed only by the separately authorized Task 8 foundation ceremony identity, and is destroyed by the reviewed second apply after both exact public-JWK versions are pinned. This milestone exposes no rotation/recreation switch for that role.

The exact workload-release outputs are `workload_jwks_release_secret_arn`, `workload_jwks_release_version_id`, and `workload_jwks_release_sha256` for the FND-published signed envelope; `workload_jwks_root_registry_secret_arn`, `workload_jwks_root_registry_version_id`, and `workload_jwks_root_registry_sha256` for the separately broker-signed registry envelope; and `workload_jwks_prepared_pair_key`, `workload_jwks_prepared_pair_version_id`, and `workload_jwks_prepared_pair_sha256` for the immutable pre-plan `workload-jwks-prepared-pair.v1`. All are pinned only by the reviewed metadata apply after the public versions exist and are tested byte-for-byte against the AI consumer; none implies a release reservation, runtime-control stage, active set, signer ACTIVE state, or mutable Secret stage.

The twelve callable keyless outputs are exact immutable alias ARNs `ai_plan_request_publisher_function_alias_arn`, `ai_release_identity_verifier_alias_arn`, `ai_release_authorization_verifier_alias_arn`, `ai_release_postcondition_verifier_alias_arn`, `ai_artifact_domain_approval_verifier_alias_arn`, `ai_artifact_security_approval_verifier_alias_arn`, `ai_plan_domain_approval_verifier_alias_arn`, `ai_plan_security_approval_verifier_alias_arn`, `ai_artifact_key_custodian_approval_verifier_alias_arn`, `ai_artifact_key_security_approval_verifier_alias_arn`, and `ai_artifact_key_ceremony_broker_alias_arn`, and `ai_production_evaluation_bootstrap_function_alias_arn`. Each alias pins the same reviewed ZIP digest but a distinct function version, hard-coded mode/audience/workflow/environment/prefix, and execution role; every OIDC workflow role may invoke only its matching alias and no caller-selected mode, `$LATEST`, unqualified ARN, or other function. The evaluation-bootstrap workflow role may invoke only its evaluation-bootstrap alias; it cannot sign, approve, plan, release, or mutate another control key. The release workflow role may invoke only its identity, authorization, and postcondition aliases; authorization has read-only exact-version/live-read permissions, while postcondition alone has the closed same-fence terminal transaction. The broker alias accepts only an exact-version ceremony core plus the two fixed receipt coordinates, invokes the unexported ceremony state machine, and returns only its immutable result coordinate; it cannot accept a state-machine ARN, operation override, key/domain bytes, or private output.

`ai_release_identity_verifier_alias_arn` is hard-coded to `.github/workflows/release.yml`, job `ai_release`, environment `production-kr`, repository ID, protected tag ref, and audience `gc-ai-release-identity`; only `ai_release_workflow_role_arn` may invoke it. Its request is exactly `{oidcToken}` with a 16 KiB cap and no caller identity/workflow field. It freshly verifies issuer/discovery/JWKS and the signed `repository_id`, `workflow_ref`, 40-hex `workflow_sha`, `ref`, `environment`, `actor_id`, `run_id`, `run_attempt`, `aud`, `iss`, `exp`, and `jti` claims under the same bounded-cache/replay rules as approval handlers. It Object-Lock writes exactly `{schemaVersion:"ai-release-workflow-identity.v1",workflowSha,repositoryId,runId,runAttempt,identitySha256}` under `release-workflow-identities/<workflowSha>/<runId>/<runAttempt>/<identitySha256>.json`, where IDs are canonical positive-decimal strings and the self-digest omits only itself, then returns only `{key,versionId,sha256}`. The release client exact-fetches that coordinate into `build/ai-release-workflow-identity.json`, validates against the shared schema/fixture, and derives `build/trusted-workflow-sha.txt` only from `workflowSha`; request/context/local checkout/candidate bytes can never supply it. Tests reject a wrong alias/audience/workflow/ref/environment/repository, missing or stale OIDC claim/JWK, replayed `jti`, caller-authored identity, response substitution, mutable/current-version read, and any local SHA not equal to the verified record.

`ai_release_workflow_identity.py capture --snapshot build/foundation-outputs.json --out build/ai-release-workflow-identity.json --sha-out build/trusted-workflow-sha.txt --coordinate-out build/ai-release-workflow-identity.coordinate.json` is the sole client. It accepts no alias, bucket, audience, workflow, actor/run, token, or SHA argument. It strict-loads the already verified snapshot, requests a fresh GitHub OIDC token only from the runner's `ACTIONS_ID_TOKEN_REQUEST_URL` using `ACTIONS_ID_TOKEN_REQUEST_TOKEN` with the fixed audience, caps the response, invokes only the snapshot's qualified alias, exact-fetches only its returned Object-Lock VersionId from the snapshot evidence bucket, validates the canonical record/self-digest and current run/repository scalar equality, writes all three outputs atomically with modes `0600`, and clears the token/response buffers best-effort. It never prints or logs the token. Tests stub HTTP/Lambda/S3 and cover missing/duplicate environment, redirect/proxy, wrong audience/alias/bucket/version/digest/run/repository, response overflow, forged local object, symlink/output race, token/log leakage, and cleanup.

`ai_release_authorization_verifier_alias_arn` and `ai_release_postcondition_verifier_alias_arn` are two further immutable qualified versions of the reviewed ZIP. Their execution roles, result prefixes, replay partitions, CloudWatch log groups, and permissions are disjoint from approval, identity, key, and deploy roles. Authorization may exact-version read only objects transitively named by its request, strongly read the fixed control rows, and write its content-addressed authorization prefix. Postcondition may exact-version read only its authorization/deploy-record chain, describe the two fixed services/targets, strongly read exact result/control rows, write its verification prefix, and execute only the one conditioned approval-use/terminal/reservation transaction. It cannot update ECS/ELB, sign, approve, plan, fetch private keys, or accept an ARN/table/bucket/key/action override. The module pins both schema digests and `ai_release_authority_client_sha256`, and tests mutate ZIP/client/schema digest, alias qualification, execution-role collapse, object prefix, live-read scope, transaction condition, duplicate finalization, and cross-release replay.

Workload promotion additionally exports `workload_jwks_promotion_state_machine_arn` and `workload_jwks_promotion_state_machine_role_arn`. Private AI/REC connectivity outputs are exactly `explanation_worker_private_base_url=https://explanation-worker.service.kr.internal`, `explanation_worker_listener_arn`, `explanation_worker_listener_security_group_id`, `explanation_worker_internal_certificate_arn`, `explanation_worker_internal_certificate_dns_san=explanation-worker.service.kr.internal`, `core_api_security_group_id`, `ai_release_smoke_security_group_id`, `ai_release_telemetry_probe_security_group_id`, `records_recall_private_base_url=https://records.service.kr.internal`, `records_recall_listener_arn`, `records_recall_listener_security_group_id`, `records_recall_internal_certificate_arn`, and `records_recall_internal_certificate_dns_san=records.service.kr.internal`; tests reject any alias, wildcard SAN, shared client SG, or public listener. The prewired explanation-worker listener admits TLS only from `core_api_security_group_id` and the empty foundation-owned `ai_release_smoke_security_group_id`; only the fixed service-smoke task family may attach that smoke SG. It rejects probe/worker/collector/public/general runtime SGs and has no alternate rule or caller-controlled weight. Separately, the collector SG admits TCP 8888 only from `ai_release_telemetry_probe_security_group_id`, and only the telemetry-probe family may attach that probe SG; every other source/port is denied. The REC recall listener admits mTLS only from the dedicated AI recall-delivery SG and never from core/public/collector/smoke/probe SGs.

Release-policy outputs also include distinct `ux_web_plan_workflow_role_arn`, `ux_web_staging_workflow_role_arn`, and `ux_web_release_workflow_role_arn`; `ux_deployment_permissions_boundary_arn`; `ux_release_evidence_bucket_name`, `ux_web_backend_bucket_name`, `ux_web_backend_lock_table_name`, `ux_web_repository_url`, `ux_collector_repository_url`, both `product_web_*_smoke_security_group_id` values, both `ux_web_*_deployment_state_machine_arn` values, all four `ux_web_*_deploy_fence_table_{name,arn}` values, and `ux_web_deployment_authority_image_digest`; generic byte-equal snapshot aliases `foundation_outputs_snapshot_bucket_name`, `foundation_outputs_snapshot_key`, `foundation_outputs_snapshot_version_id`, and `foundation_outputs_snapshot_sha256`; `ai_release_backend_bucket_name`, `ai_release_backend_lock_table_name`, `ai_runtime_control_table_name`, `ai_runtime_control_table_arn`, `ai_worker_repository_url`, `ai_collector_repository_url`, `ai_runtime_cluster_arn`, `ai_worker_service_arn`, `ai_collector_service_arn`, `ai_worker_target_group_arn`, `ai_collector_target_group_arn`, `ai_worker_task_role_arn`, the single canonical `explanation_telemetry_collector_task_role_arn`, `ai_runtime_execution_role_arn`, `ai_release_permissions_boundary_arn`, `ai_worker_efs_file_system_id`, `ai_worker_efs_access_point_arn`, `ai_publisher_efs_access_point_arn`, `ai_worker_security_group_id`, and `ai_collector_security_group_id`. The exact forward one-shot triples are `ai_publisher_task_role_arn` / `ai_publisher_task_family_prefix` / `ai_publisher_security_group_id`, `ai_release_service_smoke_task_role_arn` / `ai_release_service_smoke_task_family_prefix` / `ai_release_smoke_security_group_id`, `ai_release_telemetry_probe_task_role_arn` / `ai_release_telemetry_probe_task_family_prefix` / `ai_release_telemetry_probe_security_group_id`, `ai_workload_key_quorum_task_role_arn` / `ai_workload_key_quorum_task_family_prefix` / `ai_workload_key_quorum_security_group_id`, `ai_recall_quorum_task_role_arn` / `ai_recall_quorum_task_family_prefix` / `ai_recall_quorum_security_group_id`, `ai_recall_delivery_task_role_arn` / `ai_recall_delivery_task_family_prefix` / `ai_recall_delivery_security_group_id`, and `ai_release_rollback_task_role_arn` / `ai_release_rollback_task_family_prefix` / `ai_release_rollback_security_group_id`. Every role/family/SG is distinct unless an exact listener rule above names it; `ai_collector_task_role_arn` is not an output or alias. These are authorization coordinates, not authority to create a second foundation resource.

Foundation precreates the three UX storage coordinates and two ECR repositories before any Product plan. `ux_release_evidence_bucket_name` is Seoul-only, versioned, public-access-blocked, TLS-only, KMS-encrypted, and Object Lock COMPLIANCE-retained for 365 days; every object uses checksum, exact VersionId, and `If-None-Match:*`. Under `ux/plan/<sourceSha>/<sourceSetSha256>/`, the plan role may conditionally Put and exact-version read only `plans/staging.tfplan`, `plans/production.tfplan`, `providers/product-web-linux-amd64.zip`, `harness/product-web-smoke-harness.zip`, the two image signature/attestation/SBOM/provenance objects, `product-web-plan-bundle.json`, `product-web-staging-handoff.json`, and `ux-staging-fault-request.json`. The provider object must byte-equal the FND builder output and both plan rows bind the same coordinate. Staging/release workflow roles may exact-version read only their approved transitive chain and call only their environment's FND state machine; they cannot access a backend, apply, Put a receipt/result, or mutate AWS resources.

The FND authority task alone exact-fetches image evidence, writes `ux/image-trust/<environment>/<verificationSha256>.json`, then reads/locks its environment's state key and conditionally writes the strict fixed-key receipt `ux/apply-receipt/<environment>/<planSha256>.json` with the sole `disposition="converged"`. The FND state-machine role alone conditionally writes `ux/staging/<sourceSha>/<resultSha256>/ux-staging-result.json`, `ux/deploy-result/<environment>/<requestSha256>/<resultSha256>.json`, and `ux/authority-result/<environment>/<requestSha256>/<resultSha256>.json`. Each writer uses checksum/`If-None-Match:*`; after response loss only, it may retry identical bytes to the identical precomputed key, require 412, Head that key once, and exact-Version Get/revalidate bytes/digest/schema. No List/current/Delete/unconditioned Put, second Head, alternate key, or nonidentical existing object is accepted. `completedAt` in deployment, staging, and authority results is the outer execution's single server-derived start/terminal clock value passed only by the FND definition; neither callback, image-trust record, nor apply receipt contains or derives a clock. The backend bucket is versioned/KMS-private and its lock table has PITR/deletion protection; only the authority task gets its environment key and conditional lock actions. Both ECR repositories remain immutable/scanned/KMS-encrypted; plan alone pushes, and authority/runtime roles receive digest-scoped pull only. Tests mutate every filename/VersionId/digest/clock/key/trust/receipt byte, response-loss ordering, backend environment, provider package, and ECR action.

FND precreates every UX resource whose control plane is unavailable to a no-NAT Seoul task. Per environment it owns the ALB, redirect/HTTPS listener and weighted BFF rule, independent blue/green BFF target groups and zero-desired service slots, collector target group and zero-desired service shell, ALB/BFF/collector/smoke SGs, WAF ACL with aggregate metrics only, exact A/AAAA alias, collector Cloud Map service registry, both DNS names, certificates, five Product runtime roles (`smoke`, BFF task/execution, collector task/execution), the FND authority task/execution/state-machine roles, state machine, task definition, and fence table. Initially both BFF slots and collector are zero; the rule is deterministically blue=100/green=0 but both groups are empty, so the public endpoint is unavailable. There is no Product `deploy-role` or Product coordinator. All these ARNs/IDs are immutable snapshot outputs; Product plans must treat them as inputs and cannot create/update/delete/pass their FND authority/edge/network/DNS/WAF/role/service/fence objects. FND role policies already scope the smoke function and task definitions to deterministic names, repositories, log groups, session table, trust bundle, cluster, services, target groups, SGs, and service registry, so no IAM API call occurs during Product apply.

The Product saved plans may contain only the two ECS task definitions, qualified smoke Lambda function/alias `gc-ux-web-<environment>-smoke-harness:live`, session table `gc-ux-web-<environment>-sessions`, runtime CMK/alias `alias/gc-ux-web-<environment>-runtime`, fixed application/EMF log groups, and four fixed aggregate alarms. Every address/action/tag/image/role/SG/TG/service-registry reference is closed by the FND plan policy. ECS services, IAM, EC2/VPC/SG, Route53, WAF, ACM, Cloud Map service creation, ALB/listener/rule/TG creation, state machine, fence, authority task, backend, repository, evidence store, provider/provisioner/local execution, replacement, and destroy actions are forbidden in both plans. A founder-approved teardown is separate and not created here.

The authority task's no-NAT action/endpoint matrix is closed to: S3 `GetObject|GetObjectVersion|PutObject` on its exact evidence/backend keys through the S3 gateway endpoint, where `GetObject` is granted only on deterministic response-loss result keys so the SDK may issue one body-free `HeadObject` and code rejects an unversioned body read; DynamoDB conditional lock/session-table create/update/describe plus `UpdateTimeToLive|UpdateContinuousBackups` through the DynamoDB gateway endpoint; KMS create/alias/describe/grant only for the deterministic runtime key through the KMS endpoint; ECS `RegisterTaskDefinition|DescribeTaskDefinition` only the two Product families through the ECS endpoint; Lambda create/update/publish/alias only the fixed smoke function through the Lambda endpoint; Logs create/retention/associate/describe only fixed groups through the Logs endpoint; CloudWatch `PutMetricAlarm|DescribeAlarms` only four names through the monitoring endpoint; STS `GetCallerIdentity` through the regional endpoint; Step Functions `SendTaskHeartbeat|SendTaskSuccess|SendTaskFailure` only for its callback token; and `iam:PassRole` only the five FND-precreated Product roles as a service authorization condition on ECS/Lambda calls. It has read-only ECS service and ELB target/rule descriptions for postcondition verification. Endpoint policies bind the exact environment task role/resources/actions. IAM, Route53, WAF, ACM, Cloud Map, EC2, public registry, provider download, service mutation, and every other control-plane API are absent from its IAM and endpoint set. The outer FND state-machine role—not the task—gets only fence conditional writes, `ecs:RunTask|DescribeTasks|StopTask` for its fixed authority family, `iam:PassRole` for exactly the matching authority task role and execution role with `iam:PassedToService=ecs-tasks.amazonaws.com`, `ecs:UpdateService|DescribeServices` for the three fixed runtime service slots, task-token orchestration, fixed ELB describe/modify/register/deregister actions on the three target groups/one rule, one qualified smoke invocation, and exact result writes; workflows get only `StartExecution|DescribeExecution` on one state machine. IAM/schema tests reject the nonexistent `s3:HeadObject` IAM action, `s3:GetObject` on any nondeterministic key or any unversioned body fetch, another PassRole target/service, and a missing task/execution-role pass grant.

Each FND deployment-fence table has partition key fixed to its one environment, PAY_PER_REQUEST, PITR/deletion protection, TTL attribute `expiresAt` enabled by FND (cleanup only, never authorization), no stream/export/global replica, and the FND app-health CMK. Its sole item is exactly `{schemaVersion:"product-web-deployment-fence.v1",environment,requestSha256,executionArnSha256,ownerTokenSha256,heartbeatAt,recoveryEligibleAt,expiresAt,status,fenceSha256}`; status is `claimed|terminal`. The Standard definition deliberately has no top-level `TimeoutSeconds`, because an execution timeout cannot be caught for rollback. Instead every Task/Map/Parallel state has a catchable timeout and retry cap, the callback Task has 30-second heartbeat/180-second timeout, every wait/poll has a fixed maximum count, and a server-clock guard before every loop routes to the same catch when elapsed time reaches 600 seconds. Thus every definition path is finite and catchable. It claims the fence before any backend/apply/resource call, rechecks and heartbeats it before and after every wait/mutation/callback, and never treats expiry alone as ownership.

The exact outer sequence is: strict-validate request and exact-fetch its complete chain; conditional fence claim; strongly describe the blue/green rule/services and record either greenfield-null prior or the unique 100%-weighted healthy active slot; `ecs:runTask.waitForTaskToken` against the fixed digest-pinned authority definition; strict callback and exact apply-receipt/candidate verification; update the collector shell and only the inactive BFF service slot to those callback task-definition ARNs; wait for exact candidate target membership while retaining 100% prior traffic (or zero traffic on first install); invoke only the callback's verified `gc-ux-web-<environment>-smoke-harness:live` version against the candidate target; shift the precreated weighted rule through fixed candidate `5→25→100` values with health/smoke gates; drain the prior BFF slot after 100%; run the staging-only synthetic-failure branch below; write the staging/deployment/authority result chain; mark terminal and release the fence. First install deterministically chooses blue and on failure returns both slots/collector to zero with the empty rule; upgrades choose the opposite of the recorded active slot and on failure restore its exact task revision/count/100% weight plus the prior collector revision. Any failure/caller loss follows the definition-owned catch, stops the authority task if still running, restores and strongly verifies that exact prior/greenfield tuple, writes rolled-back terminal/result, and terminalizes the fence. Ambiguous active slots, mixed weights, task callback, receipt, candidate, smoke, target, traffic, terminal, or result state fails closed. The fixed smoke role/SG can reach only matching BFF and collector TCP 8888 and returns only aggregate counters; it cannot access S3/state/fence/secret or mutate AWS. Mutation tests cover claim-before-apply, greenfield and blue↔green upgrades, every crash boundary, heartbeats, live-overlap, callback loss/replay, exact restore, TTL/PITR, response loss, and cross-environment endpoint/action denial.

`faultMode="upstream_5xx_once"` is implemented entirely by a named FND Standard-workflow state, not a Product resource or public request path. After one healthy staging promotion and recorded candidate/prior state, `InjectStagingSyntheticSmoke503` requires the exact unexpired fault coordinate and `faultInjected=false`, sets that execution-local boolean true, and emits the fixed strict synthetic smoke result `{schemaVersion:"ux-synthetic-smoke-result.v1",requestSha256,statusCode:503,faultRequestSha256,synthetic:true,resultSha256}` into the same Choice/catch edge used for a real smoke 5xx. The catch must restore the recorded prior service revisions/weights and verify them; the workflow then clears only its execution-local fault flag, re-promotes the verified candidate, invokes the real smoke function, and writes the staging result binding both real-smoke and rollback digests. There is no fault Lambda, endpoint, target, WAF rule, task environment flag, app route, or production branch; a second injection, production request, network 5xx claim, caller flag, or residue fails. This drill proves the FND coordinator's explicit catch/restore behavior, not ECS circuit-breaker behavior or a live upstream failure.

Foundation owns and precreates the public zone, two exact A/AAAA aliases, two regional ALBs/listeners/target groups, DNS validation, distinct Seoul certificates, VPC/subnets/cluster, private namespace/zone, and both collector service registries. The exact public aliases always target their matching FND ALB; the private names are fixed to `product-collector.staging.service.kr.internal` and `product-collector.service.kr.internal`, and Product ECS services may attach only the matching exported registry ARN. Plan/staging/release roles have no ACM/Route53/Cloud Map/WAF/EC2 authority or discovery path. Both private names are DNS-firewall allowlisted and collision/cross-environment registration fails. FND precreates all ALB/BFF/collector/smoke SGs; matching smoke→BFF health port and smoke→collector TCP 8888 are the only smoke ingress, with every public/cross-environment/alternate source denied. Tests require three distinct-AZ private and edge IDs, exact output/zone/SAN/alias/TG/listener/registry relationships, certificate issuance, service registration membership, collector counter deltas, and denial of every Product mutation to these shells.

Native WAF request logging is disabled: no Firehose, CloudWatch Logs destination, subscription, logging configuration, request-sampling export, or per-request WAF retention exists or is an output. FND precreates each exact ACL and enables only native aggregate CloudWatch metrics for closed rule/action names, with FND-owned cross-account aggregate observability and alarms containing no client IP, country, URI, header, query, cookie, or request sample. No Product or authority role has `wafv2:CreateWebACL|UpdateWebACL|AssociateWebACL|PutLoggingConfiguration|DeleteLoggingConfiguration`. Snapshot/map/IAM/module tests reject every WAF request-log output/destination/sample/sink/customer dimension or WAF mutation while proving aggregate allow/block/count metrics and alarms remain enabled.

The fresh-runner handoff is one immutable `foundation-public-output-snapshot.v1`, not a local `tofu output` file. It is exactly `{schemaVersion:"foundation-public-output-snapshot.v1",sourceSha,tagVerificationSha256,applyReceipts,outputs,createdAt,snapshotSha256}` with `additionalProperties=false`; `applyReceipts` is the sorted exact three-coordinate list for the first, second, and workload-metadata applies, and `outputs` is an additional-properties-false object enumerating every non-sensitive output named by this Task 7C Interfaces section except the eight self-referential `ai_foundation_outputs_snapshot_*|foundation_outputs_snapshot_*` values. That allowlist includes the protected scalar strings `release_repository_owner` and `release_repository_name`: owner is 1–39 ASCII characters matching `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`; name is 1–100 ASCII characters matching `^[A-Za-z0-9._-]{1,100}$` and is neither `.` nor `..`. Both values are set only by the reviewed foundation metadata apply, are immutable for the snapshot sequence, and are cross-checked against the repository bound in the FND GitHub OIDC trust policy; neither workflow nor caller may override them. Secret values, private key material, live credentials, arbitrary Terraform output, and unknown key are forbidden. `snapshotSha256` is lowercase `sha256:` over RFC 8785 bytes omitting only itself. `foundation_output_snapshot.py publish` exact-fetches and verifies the three apply receipts, strict-parses the final local output JSON, projects only that schema allowlist, writes once with checksum and Object Lock under `foundation-output-snapshots/<sourceSha>/<snapshotSha256>.json`, writes the same canonical bytes to its required `--snapshot-out`, and returns `{key,versionId,sha256}` at `--out`; `fetch` accepts only the four protected snapshot scalars, exact-fetches/caps/hashes/validates all receipts and emits canonical snapshot bytes. A reviewed fourth **metadata-only** apply pins both byte-equal snapshot output-name sets and no other resource; the bucket is created in the first apply. Its protected-environment export sets the exact coordinate for fresh AI and UX runners, whose roles may only `s3:GetObjectVersion` for that VersionId. No runner may fall back to local files, `AWSCURRENT`, bucket listing, Terraform state, or caller-assembled output JSON. Tests mutate an output name/value, repository owner/name grammar/case/separator/OIDC-policy binding, alias equality, omitted apply receipt, self-reference, VersionId/digest/source/tag, unknown/sensitive field, fourth-apply resource diff, and local-file fallback.

`governance/foundation/ai-foundation-output-env-map.json` and `governance/foundation/ux-foundation-output-env-map.json` are the only projection maps and each strict-validates as exactly `{schemaVersion:"foundation-output-env-map.v1",snapshotSchemaSha256,mappings,mapSha256}`. `mappings` is sorted by `outputName`; every row is exactly `{outputName,environmentName}`; `environmentName` is byte-for-byte the ASCII-uppercase form of the snake-case name (for example `ai_runtime_cluster_arn -> AI_RUNTIME_CLUSTER_ARN`). A mapped snapshot value is normally one strict scalar. Exactly four mapped output names—`application_private_subnet_ids`, `application_edge_subnet_ids`, `application_network_firewall_endpoint_ids`, and `application_allowed_tls_sni`—are instead sorted, unique, nonempty JSON arrays of bounded strings; their `GITHUB_ENV` value is the RFC 8785 compact JSON array with no whitespace, and downstream code must JSON-decode the complete value rather than split or shell-evaluate it. The UX map includes `application_vpc_id`, those four typed arrays, `application_ecs_cluster_arn`, both exact collector DNS names, both Product smoke SG IDs, all public/private DNS/namespace/certificate outputs, `private_service_trust_bundle_secret_arn|version_id|sha256`, and only the remaining listener/Cognito/egress/KMS/backend/evidence/repository/boundary outputs required by Product; every environment name is the exact uppercase output name, including `PRIVATE_SERVICE_TRUST_BUNDLE_SECRET_VERSION_ID`, and it contains no AI signer/private-key/recovery output or WAF request-log coordinate. No caller prefix, alias, omission, duplicate output/env/array entry, unsorted array, Terraform list string, comma-split encoding, or extra row is valid; `mapSha256` omits only itself. `foundation_output_snapshot.py project-github-env` requires `--snapshot`, `--expected-snapshot-sha256`, `--map`, `--github-env`, and `--out`; it first re-verifies the canonical snapshot/self-digest/apply receipts, proves its digest equals the approved handoff/plan/recovery evidence, validates the entire map and every mapped scalar/typed array, then writes a strict typed-JSON summary and appends all `NAME=value\n` records to the supplied existing regular `GITHUB_ENV` file in one locked/fsynced append. Values containing CR/LF/NUL/control bytes, GitHub command syntax, invalid ARN/URL/digest/ID grammar, or missing/extra map/schema fields fail before any append. `foundation_output_snapshot.py read-array --projection <verified-summary> --environment-name <one-of-four-array-names> --out <path>` is the sole parser: it rechecks the projection self-digest, requires the exact uppercase name, writes the canonical JSON array mode `0600`, and accepts no delimiter/default/index/inline value. Each privileged AI or UX plan/staging/release/recovery marker begins by `fetch` from its four protected snapshot aliases and then `project-github-env`; every script receives foundation coordinates only from those projected names. The four generic `foundation_outputs_snapshot_*` outputs and protected `FOUNDATION_OUTPUTS_SNAPSHOT_*` values are byte-equal aliases of the existing `ai_foundation_outputs_snapshot_*` coordinate and both alias sets are excluded from the snapshot body to avoid self-reference. The workflow verifier also requires each `workflow_dispatch.inputs.*` value to be mapped exactly once into a fixed step `env:` key, prohibits ambient/duplicate fallback, and proves function aliases and snapshot coordinates come only from protected `vars.*`, never dispatch input.
`foundation_output_snapshot.py write-coordinate` requires exactly `--bucket`, `--key`, `--version-id`, `--sha256`, and `--out`, applies the same grammar/host/prefix checks as `fetch`, and atomically writes mode-`0600` canonical `{key,versionId,sha256}` bytes with no bucket field. All three UX jobs call it from the four protected aliases before `fetch`, producing `build/foundation/foundation-output-snapshot.coordinate.json`; Product binds that exact file into its handoff/plan/staging result and never reconstructs a coordinate in a marker. Tests reject a missing file, protected-value/coordinate mismatch, symlink/race, controls/newlines, current/list fallback, or marker-written coordinate.

`foundation_output_snapshot.py project-ai-self-coordinate-env` requires exactly `--bucket`, `--key`, `--version-id`, `--sha256`, `--github-env`, and `--out`; applies the same protected-coordinate grammar, host, prefix, and exact-Version checks as `fetch`; appends exactly `AI_FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME`, `AI_FOUNDATION_OUTPUTS_SNAPSHOT_KEY`, `AI_FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID`, and `AI_FOUNDATION_OUTPUTS_SNAPSHOT_SHA256` in one locked/fsynced write; and writes a mode-`0600` canonical self-digested projection summary. It accepts no caller prefix/name/file/body, refuses a duplicate or preexisting target name, and is the only bridge for the deliberately self-excluded snapshot aliases. The FND-owned `ai-plan` and `ai-release` pre-marker steps call it immediately after exact `fetch`/`project-github-env`; AI marker code consumes those four names unchanged. Tests reject omission, substitution, controls/newlines, a current/List fallback, alternate environment name, marker-side reconstruction, and a release or plan marker reached before this projection.

For avoidance of projection shorthand, the three private-trust mappings are exactly `private_service_trust_bundle_secret_arn -> PRIVATE_SERVICE_TRUST_BUNDLE_SECRET_ARN`, `private_service_trust_bundle_secret_version_id -> PRIVATE_SERVICE_TRUST_BUNDLE_SECRET_VERSION_ID`, and `private_service_trust_bundle_sha256 -> PRIVATE_SERVICE_TRUST_BUNDLE_SHA256`; Product must supply all three together to every BFF task definition and never infer a VersionId from a stage.

`pub-foundation-output-env-map.json` and `rec-foundation-output-env-map.json` use the same strict schema and uppercase rule. PUB maps exactly `public_data_repository_url`, `public_data_release_evidence_bucket`, `public_data_release_evidence_prefix`, `public_data_buildx_builder`, `public_data_runtime_image`, `public_data_operator_oidc_issuer`, `public_data_operator_oidc_jwk_set_uri`, `public_data_operator_oidc_audience`, `public_data_operator_oidc_client_id`, `release_repository_owner`, and `release_repository_name`. REC maps exactly `rec_document_worker_repository_url`, `rec_document_worker_release_evidence_bucket`, `rec_document_worker_release_evidence_prefix`, `rec_document_worker_buildx_builder`, `rec_document_worker_python_runtime_image`, `release_repository_owner`, and `release_repository_name`. The release bootstrap separately exports the already exact-fetched canonical snapshot file path as `FOUNDATION_OUTPUTS_SNAPSHOT_JSON` and signed-tag record path as `SIGNED_RELEASE_TAG_VERIFICATION_JSON`; neither path or its bytes comes from marker code. The maps contain no ECS service/task/role/SG, deployment-authority ARN, CRL/trust material, secret, bucket prefix override, or caller-selected value. Map tests require the exact closed rows, canonical order, environment names `PUBLIC_DATA_*` or `REC_DOCUMENT_WORKER_*` implied by the output names, byte-equality to the snapshot, and rejection of a missing/extra/duplicate/renamed row or control-character output.

The same script's `project-dispatch-env` subcommand accepts only `--profile ai-promotion-intent|ai-plan|ai-plan-domain-approval|ai-plan-security-approval|ai-release|ai-release-recovery`, `--github-env`, and `--out`; all values arrive through a foundation-owned step `env:` block whose keys begin `GC_INPUT_`. The exact output maps are: promotion-intent → `AI_SIGNED_TAG`; `ai-plan` → only `AI_PROMOTION_INTENT_KEY`, `AI_PROMOTION_INTENT_VERSION_ID`, `AI_PROMOTION_INTENT_SHA256`; either approval → `AI_PLAN_REQUEST_KEY`, `AI_PLAN_REQUEST_VERSION_ID`, `AI_PLAN_REQUEST_SHA256`; `ai-release` → those request names plus `AI_PLAN_DOMAIN_RECEIPT_KEY|VERSION_ID|SHA256` and `AI_PLAN_SECURITY_RECEIPT_KEY|VERSION_ID|SHA256`; recovery → `AI_RELEASE_ID`. The plan exact-fetches the verified intent/source/tag-verification chain and derives signed tag/source only from those bytes; it has no signed-tag input or ambient fallback. The projector requires the complete profile and no other `GC_INPUT_*`, validates tag/key/VersionId/lowercase `sha256:`/release-ID grammar, rejects CR/LF/NUL/control/GitHub-command bytes and duplicate output names, then performs one locked/fsynced append and emits a self-digested summary. Marker code may read only those `AI_*` projected names; `${{ inputs.* }}`/`${{ github.event.inputs.* }}` appears only in that foundation-owned env block. Tests mutate every missing/extra/swapped input, profile, shell metacharacter, multiline value, environment collision, partial append, signed-tag injection into `ai-plan`, and direct input interpolation.

- [ ] **Step 1: Write failing infrastructure security assertions**

```hcl
mock_provider "aws" {}

run "kr_runtime_is_private_encrypted_and_region_bound" {
  command = plan

  variables {
    region                    = "ap-northeast-2"
    environment               = "prod-kr"
    certificate_arn           = "arn:aws:acm:ap-northeast-2:666666666666:certificate/00000000-0000-0000-0000-000000000001"
    alert_topic_arn           = "arn:aws:sns:ap-northeast-2:222222222222:security-alerts"
    core_api_image_digest     = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    public_data_placeholder_image_digest = "sha256:2222222222222222222222222222222222222222222222222222222222222222"
    database_migration_digest = "sha256:1111111111111111111111111111111111111111111111111111111111111111"
    telemetry_bootstrap_image_digest = "sha256:3333333333333333333333333333333333333333333333333333333333333333"
    ai_artifact_signer_image_digest  = "sha256:4444444444444444444444444444444444444444444444444444444444444444"
    ai_artifact_approval_zip_sha256  = "sha256:5555555555555555555555555555555555555555555555555555555555555555"
    api_domain_name           = "api.kr.example.invalid"
    log_archive_account_id    = "333333333333"
    backup_account_id         = "888888888888"
  }

  assert {
    condition     = aws_db_instance.primary.publicly_accessible == false && aws_db_instance.primary.multi_az
    error_message = "PostgreSQL must be private and multi-AZ."
  }

  assert {
    condition     = aws_ecs_service.core_api.network_configuration[0].assign_public_ip == false
    error_message = "Core API tasks must not receive public IPs."
  }

  assert {
    condition     = aws_ecs_service.public_api.network_configuration[0].assign_public_ip == false
    error_message = "Public C0 tasks must not receive public IPs."
  }

  assert {
    condition = (
      length(aws_networkfirewall_firewall.application.firewall_status[0].sync_states) >= 2 &&
      aws_networkfirewall_firewall_policy.application.firewall_policy[0].stateful_engine_options[0].rule_order == "STRICT_ORDER" &&
      aws_route53_resolver_firewall_config.application.fail_open == "DISABLED" &&
      toset(local.application_allowed_tls_sni) == toset([
        aws_cognito_user_pool_domain.product_web.domain,
        "cognito-idp.ap-northeast-2.amazonaws.com"
      ])
    )
    error_message = "Application internet egress must traverse a two-AZ fail-closed firewall and exact Cognito/JWKS allowlist."
  }

  assert {
    condition = (
      aws_acmpca_certificate_authority.private_service.type == "SUBORDINATE" &&
      aws_acm_certificate.core_internal.domain_name == "core-api.service.kr.internal" &&
      aws_acm_certificate.public_data_internal.domain_name == "public-data.service.kr.internal" &&
      aws_acm_certificate.rec_internal.domain_name == "records.service.kr.internal" &&
      aws_acm_certificate.ai_internal.domain_name == "explanation-worker.service.kr.internal" &&
      aws_secretsmanager_secret.recall_probe_client.name == "/genome-companion/prod-kr/service-identity/ai-recall-ack-probe" &&
      aws_secretsmanager_secret.otel_collector_server.name == "/genome-companion/prod-kr/service-identity/otel-collector-server" &&
      aws_secretsmanager_secret.otel_worker_client.name == "/genome-companion/prod-kr/service-identity/explanation-worker-otel-client"
    )
    error_message = "Internal REC/AI listeners and the recall probe must use the dedicated private service-identity hierarchy."
  }

  assert {
    condition = (
      endswith(jsondecode(aws_ecs_task_definition.public_api_placeholder.container_definitions)[0].image, "@${var.public_data_placeholder_image_digest}") &&
      aws_ecs_service.public_api.desired_count == 0 &&
      jsondecode(aws_ecs_task_definition.public_api_placeholder.container_definitions)[0].command == ["/bin/false"]
    )
    error_message = "C0 first apply must use the inert digest-pinned placeholder at desired count zero."
  }

  assert {
    condition = alltrue([
      for item in try(jsondecode(aws_ecs_task_definition.public_api_placeholder.container_definitions)[0].secrets, []) :
      startswith(item.name, "PUBLIC_DATA_") &&
      !contains(["DATABASE_SECRET_ARN", "WORKLOAD_TOKEN_KEY_ID", "WORKLOAD_TOKEN_PRIVATE_PKCS8_B64"], item.name) &&
      !startswith(item.valueFrom, aws_secretsmanager_secret.database.arn) &&
      !startswith(item.valueFrom, aws_secretsmanager_secret.workload_signing.arn)
    ])
    error_message = "The public task must receive no personal database or workload-signing secret."
  }

  assert {
    condition = (
      aws_iam_role.public_api_task.permissions_boundary == aws_iam_policy.public_api_boundary.arn &&
      strcontains(data.aws_iam_policy_document.public_api_boundary.json, "DenyPersonalPlane") &&
      strcontains(data.aws_iam_policy_document.public_api_boundary.json, aws_secretsmanager_secret.database.arn) &&
      strcontains(data.aws_iam_policy_document.public_api_boundary.json, aws_secretsmanager_secret.workload_signing.arn)
    )
    error_message = "The public task boundary must deny the personal database and signing-key plane."
  }

  assert {
    condition = (
      aws_vpc_security_group_egress_rule.public_api_https.referenced_security_group_id == aws_security_group.vpc_endpoints.id &&
      aws_vpc_security_group_ingress_rule.database_from_core.referenced_security_group_id == aws_security_group.core_api.id &&
      aws_vpc_security_group_ingress_rule.database_from_core.referenced_security_group_id != aws_security_group.public_api.id
    )
    error_message = "Public C0 may reach platform endpoints but not the personal database security group."
  }

  assert {
    condition = (
      aws_apigatewayv2_route.public_api.authorization_type == "NONE" &&
      aws_apigatewayv2_route.personal_api.authorization_type == "JWT"
    )
    error_message = "Only the C0 route may be public; personal routes retain the JWT authorizer."
  }

  assert {
    condition     = length(aws_kms_key.purpose) == 9
    error_message = "Eight symmetric purpose keys plus the P-256 record-export key must be distinct; AI artifact signing cannot reuse service-identity or app-health."
  }

  assert {
    condition = (
      jsondecode(aws_ecs_task_definition.telemetry_identity_collector.container_definitions)[0].image == "${aws_ecr_repository.telemetry_bootstrap.repository_url}@${var.telemetry_bootstrap_image_digest}" &&
      jsondecode(aws_ecs_task_definition.telemetry_identity_client.container_definitions)[0].image == "${aws_ecr_repository.telemetry_bootstrap.repository_url}@${var.telemetry_bootstrap_image_digest}" &&
      aws_ecs_service.telemetry_identity_bootstrap.desired_count == 0 &&
      aws_sfn_state_machine.telemetry_identity_rotation.role_arn == aws_iam_role.telemetry_identity_rotation.arn
    )
    error_message = "Telemetry bootstrap must be digest-pinned, dormant at rest, and callable only through its fixed state machine."
  }

  assert {
    condition = (
      jsondecode(aws_ecs_task_definition.ai_artifact_signer.container_definitions)[0].image == "${aws_ecr_repository.ai_artifact_signer.repository_url}@${var.ai_artifact_signer_image_digest}" &&
      aws_kms_alias.ai_artifact_signing.name == "alias/genome-companion/prod-kr/ai-artifact-signing-keys" &&
      aws_kms_key.purpose["ai-artifact-signing-keys"].arn != aws_kms_key.purpose["service-identity-secrets"].arn &&
      aws_iam_role.ai_artifact_domain_approval.arn != aws_iam_role.ai_artifact_security_approval.arn &&
      aws_iam_role.ai_artifact_publisher.arn != aws_iam_role.ai_artifact_invoker.arn
    )
    error_message = "The AI signer requires a dedicated CMK, digest-pinned one-shot task, and non-collapsible publisher/approval/invoker roles."
  }

  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.quarantine.rule[0].expiration[0].days == 1
    error_message = "Quarantine must have a 24-hour deletion backstop."
  }

  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.retained_source.rule[0].expiration[0].days == 365
    error_message = "Explicitly retained source objects must still have a 365-day hard ceiling."
  }

  assert {
    condition = (
      aws_cognito_user_pool_client.product_web.allowed_oauth_flows == toset(["code"]) &&
      aws_cognito_user_pool_client.product_web.generate_secret == false &&
      aws_cognito_resource_server.core_api.identifier == "https://api.genome-companion.kr" &&
      aws_cognito_user_pool.personal.mfa_configuration == "ON" &&
      length(var.external_identity_providers) == 0
    )
    error_message = "The sole web client must be public PKCE, URL-resource bound, local-user-only, and backed by required MFA."
  }
}
```

Write the rotation-package tests before implementation. They must monkeypatch `open`, `pathlib.Path.open`, `tempfile`, and subprocess APIs to fail on any private-key/CSR/certificate filesystem write; capture every logger and AWS-call argument; and prove no PEM, passphrase, CSR, certificate, serial, subject, SAN, or secret value reaches logs. Fixed-vector tests require strict additional-properties-false validation against all five shared service-client/OTel schemas, P-256 keys, PKCS#8 PEM, exact SAN/EKU, UTC `Z` times, maximum 24-hour leaves, monotonically increasing CA epoch and manifest sequence, and the exact digest domains. Handler tests fake ACM PCA, Secrets Manager, ECS, and Step Functions to prove four explicit candidate VersionIds → real canary evidence → one atomic promotion-manifest stage move → task-definition pin/force-new-deployment/readiness → old drain. Failure may publish a higher-sequence restore manifest only for the exact immediate-predecessor rows retained under `GCOTELPREVIOUS`; an older anchor, a missing/unlabelled/deleted predecessor, mixed VersionIds, stale scalar output, same-sequence equivocation, or a stage rewind fails. Tests also exercise more than 100 historical versions and prove current/previous labels are retained until every deployment/task-definition/release reservation is terminal. Recall and telemetry functions retain separate entry points, roles, secret allowlists, PCA templates, and cannot issue for each other's SAN/purpose.

Write the recovery/control tests before their implementation too. They strict-validate the three FND-owned release schemas and shared fixtures; kill recovery before and after every exact S3, DynamoDB, ECS, and target-health call; prove the independently pinned FND recovery handler never imports or executes an AI candidate module; and require a byte-identical idempotent `restored|zeroed` result. Infrastructure tests require PITR/SSE on the one precreated runtime-control table, TTL as alerting cleanup only, the exact closed `request#`/`control#` keys frozen below, a digest-pinned recovery task with no candidate override, and a telemetry-probe role limited to ECS/target describes, one AMP `QueryMetrics`, collector TCP 8888 through only the probe SG, and one evidence prefix. Mutations cover another image/task/role/SG/table/key/fence/release, stale heartbeat, a second recovery owner, forward deployment, ACTIVE workload promotion, terminal coexistence, missing evidence, and every prohibited role collapse.

- [ ] **Step 2: Run the foundation test and confirm the red state**

Run:

```bash
test "$(python --version)" = "Python 3.12.13"
python scripts/ci/run_locked_uv.py -- --version
python scripts/ci/run_locked_uv.py -- sync --project infra/functions/private-identity-rotation --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen pytest infra/functions/private-identity-rotation/tests scripts/release/test_build_private_identity_rotation_zip.py -q
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen pytest scripts/release/test_publish_rec_document_worker_jwks.py -q
python scripts/ci/run_locked_uv.py -- sync --project infra/functions/ai-release-recovery --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-release-recovery --frozen pytest infra/functions/ai-release-recovery/tests scripts/release/test_build_ai_release_recovery_image.py -q
build/tools/opentofu/tofu -chdir=infra/modules/kr-foundation init -backend=false
build/tools/opentofu/tofu -chdir=infra/modules/kr-foundation test
```

Expected: FAIL because the strict rotation contracts/handlers/package builder, REC public-JWK publisher, and Seoul resources do not exist.

- [ ] **Step 3: Implement and lock the two-purpose private-identity rotation package**

Pin `.python-version` to `3.12.13` and use uv `0.12.3`. `pyproject.toml` pins runtime dependencies `boto3==1.43.53` and `cryptography==50.0.0`, and development dependency `pytest==9.1.1`; `uv.lock` must contain hashes for every transitive wheel/source. `contracts.py` implements strict size/depth/key/type/time/digest validation without YAML. `pca.py` holds only total, bounded adapters for in-memory P-256 generation, CSR creation, ACM PCA issue/poll, certificate/chain verification, canonical JSON, and conditional Secrets Manager version-stage writes. `recall_handler.py` and `telemetry_handler.py` are separate Lambda entry points with distinct closed command enums; neither accepts an arbitrary ARN, SAN, template, secret name, duration, stage, or log field from an event.

`build_private_identity_rotation_zip.py` runs uv with `--frozen`, installs only locked manylinux x86_64 wheels into a clean temporary staging directory, normalizes file order/mode/time, rejects `.pyc`, tests, caches, native libraries outside the lock, or unexpected top-level paths, and emits a byte-reproducible ZIP, SHA-256, CycloneDX SBOM, license report, and SLSA provenance. `supply-chain/fnd-functions.lock.json` pins Python `3.12.13`, uv `0.12.3`, every direct dependency/version/license, package ZIP digest, and handler source-tree digest. Build twice into different temporary roots and byte-compare; scan with the foundation's pinned Trivy/Gitleaks policy. Terraform accepts only that exact ZIP digest and deploys two functions with different entry points and least-privilege roles. No function layer, ambient runtime SDK, network package install, or unpinned artifact is used.

Run: `python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen pytest infra/functions/private-identity-rotation/tests scripts/release/test_build_private_identity_rotation_zip.py -q && python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/build_private_identity_rotation_zip.py --check-reproducible`

Expected: tests PASS; two builds are byte-identical; schema/file-I/O/log/role/canary/rollback negatives pass; the ZIP/SBOM/provenance digests match the lock.

- [ ] **Step 4: Implement and lock the independent AI release-recovery task**

Pin Python `3.12.13`, uv `0.12.3`, `boto3==1.43.53`, `botocore==1.43.53`, and `pytest==9.1.1`; build from the Task 7A shared Python linux/amd64 manifest digest. `build_ai_release_recovery_image.py` uses only `scripts/ci/run_locked_uv.py`, builds twice into isolated OCI layouts, rejects network install/mutable base/extra path, strips and scans all SUID/SGID bits, emits SBOM/licenses/provenance, and records `ai_release_recovery_handler_image_digest`. The final task runs as UID/GID 65532 with read-only root, `linuxParameters.capabilities.drop=["ALL"]`, no unsupported privilege/security-option fields, no EFS, no shell entrypoint, and a closed `recover` command; it is never built from or overridden by a release candidate.

All three schemas use `additionalProperties:false`, bounded UTC `Z` timestamps, canonical lowercase hashes, and RFC 8785 self-digests. `ai-release-reservation.v1` is exactly `{schemaVersion,releaseId,fencingToken,state,releaseAuthorization,recoveryManifest,progress,createdAt,expiresAt,heartbeatAt,recoveryEligibleAt,recoveryOwnerRunId,reservationSha256}`; `releaseId` matches `^[1-9][0-9]{0,19}-[1-9][0-9]{0,9}$`, `fencingToken` is unpadded base64url for 32 random bytes, `state` is `reserved|deploying|finalizing`, `releaseAuthorization` and `recoveryManifest` are exact coordinates, and `progress` is exactly `{appliedPlan,bootstrapActivation,collectorTransition,workloadStageIntent,workloadStageTerminal,workerTransition,privateSmoke,telemetryProbeTrigger,telemetryProbeResult,workloadPromotionIntent,workloadPromotionTerminal,finalize}` with null-or-coordinate values. The reservation CAS exact-fetches the FND authorization, derives the same `releaseId`, and binds its digest before any approval-use row or recovery manifest is consumed. `workloadStageIntent` and `workloadStageTerminal` are allowed only for `first_install|workload_key`, each is write-once under the same fence, and terminal must bind the exact intent. `heartbeatAt` and `recoveryEligibleAt` advance in one same-fence CAS with `recoveryEligibleAt=heartbeatAt+10 minutes`; the self-digest omits only itself. `ai-release-recovery-manifest.v1` is exactly `{schemaVersion,releaseId,sourceSha,trustedWorkflowSha,releaseAuthorization,foundationSnapshot,request,terraformPlan,releaseBundle,domainApproval,securityApproval,preflight,productionEvaluationRequest,productionEvaluationVerification,telemetryBootstrapHandoff,hotPromotionEvidence,images,priorServices,recoveryTask,createdAt,manifestSha256}`; every artifact field including `releaseAuthorization`, `foundationSnapshot`, `productionEvaluationRequest`, and `productionEvaluationVerification` is an exact immutable coordinate, request and both receipts must name its SHA-256, `images` binds worker/collector digests, `priorServices` binds both fixed service/target/task-definition/image/desired-count tuples, and `trustedWorkflowSha` comes only from the freshly server-verified GitHub OIDC `workflow_sha` claim for the FND-pinned release skeleton—never from local checkout or candidate input. `recoveryTask` is exactly `{handlerImageDigest}` equal to FND output `ai_release_recovery_handler_image_digest`. `ai-release-recovery-result.v1` is exactly `{schemaVersion,releaseId,fencingTokenSha256,recoveryOwnerRunId,recoveryAction,releaseAuthorizationSha256,foundationSnapshotSha256,workloadStageTerminal,workloadPromotionTerminal,workerFinal,collectorFinal,zeroVerified,startedAt,completedAt,resultSha256}` with `recoveryAction=restored|zeroed`; no AI-supplied handler/task ARN is accepted. Reservation, every forward mutator, release terminal, and recovery exact-fetch the same authorization coordinate and reject any digest unequal to request/receipts/manifest/reservation/current protected coordinate.

The forward release refreshes `heartbeatAt` at least every 60 seconds during every plan apply, task/service wait, stage, promotion, smoke, probe, and finalization poll using the exact fence and `recoveryOwnerRunId=null`; it fails closed before its next mutation if that CAS fails and stops heartbeats before the terminal transaction. `handler.py` may claim only when server time is at or after the atomically stored `recoveryEligibleAt`. An untouched `reserved` row is recoverable only when every progress field is null and live services/targets byte-match `priorServices`; recovery then performs a no-op zero/prior-state verification and terminalizes it so the singleton cannot deadlock. A `reserved` row with any progress or drift is invalid. For `deploying|finalizing`, the outer recovery state-machine role—not the isolated handler—independently resolves the deterministic stage execution from `workloadStageIntent` and promotion execution from `workloadPromotionIntent`, calls `DescribeExecution`, bounded-waits or `StopExecution`, and re-reads each terminal plus the staged active-set and strongly consistent signer ACTIVE anchor before invoking the no-network handler. Every stage/promotion state checks the release fence and `recoveryOwnerRunId=null`; once recovery owns the row, a late start or mutation fails. Missing execution after its bounded intent window is treated as not-started, while an execution/result/staged-set/ACTIVE ambiguity forces zero. A committed stage without promotion is safe but nonterminal: recovery records/binds the stage terminal if unambiguous, zeros first install or restores the prior upgrade service, leaves the staged public residue for exact retry/higher-sequence correction, and never marks signer authority active. If a matching ACTIVE promotion terminal exists, restoration is forbidden, both services are zeroed, and `requiresCorrectiveWorkloadPromotion=true` is bound into `workloadPromotionTerminal`; otherwise bounded restore may precede zero fallback. The handler receives only a strict resolved decision plus exact stage/promotion/ACTIVE coordinates and has no Step Functions endpoint or permission. The state machine—not GitHub—runs the immutable task, rechecks final service/target state, writes one terminal `{outcome:"recovered",recoveryAction:"restored"|"zeroed",reservationSha256,recoveryResultSha256,fencingTokenSha256,evidenceSha256}`, and removes the reservation transactionally. Best-effort retry returns the exact same result/terminal. Tests race each heartbeat with recovery, lose the runner before/after both intents and both `StartExecution` calls and around every later CAS, skew runner clocks, inject ambiguous stage/promotion/ACTIVE results, and prove exactly one owner can mutate. Run:

```bash
python scripts/ci/run_locked_uv.py -- lock --project infra/functions/ai-release-recovery --check
python scripts/ci/run_locked_uv.py -- sync --project infra/functions/ai-release-recovery --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-release-recovery --frozen pytest infra/functions/ai-release-recovery/tests scripts/release/test_build_ai_release_recovery_image.py -q
test "$(uname -s)-$(uname -m)" = "Linux-x86_64"
python scripts/ci/run_locked_uv.py -- --version
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-release-recovery --frozen python scripts/release/build_ai_release_recovery_image.py --check-reproducible
```

Expected: two OCI layouts are identical and every crash/race/ACTIVE-promotion/candidate-image mutation fails closed or reaches one byte-identical recovered terminal.

- [ ] **Step 5: Implement the minimum secure runtime**

Use these validated module inputs:

```hcl
variable "region" {
  type    = string
  default = "ap-northeast-2"
  validation {
    condition     = var.region == "ap-northeast-2"
    error_message = "Korean personal infrastructure is restricted to ap-northeast-2."
  }
}

variable "core_api_image_digest" {
  type = string
  validation {
    condition     = can(regex("^sha256:[0-9a-f]{64}$", var.core_api_image_digest))
    error_message = "Core API deployment requires an immutable sha256 image digest."
  }
}

variable "public_data_placeholder_image_digest" {
  type        = string
  description = "Digest-pinned inert FND placeholder used only by the zero-count C0 shell."
  validation {
    condition     = can(regex("^sha256:[0-9a-f]{64}$", var.public_data_placeholder_image_digest))
    error_message = "The inert public-data shell requires an immutable FND placeholder digest."
  }
}

variable "external_identity_providers" {
  type        = set(string)
  default     = []
  description = "MVP invariant: empty. Any federation is a separately reviewed identity-model change."
  validation {
    condition     = length(var.external_identity_providers) == 0
    error_message = "The Korea MVP accepts only the MFA-required local Cognito user directory."
  }
}
```

Implement these exact invariants:

1. VPC `10.20.0.0/16` across three available Seoul AZs. Edge, private application, isolated worker, and database subnet groups are separate. ECS and RDS have no public IP. Isolated workers have no default internet route. Every application-subnet default route traverses an AZ-local AWS Network Firewall endpoint before an AZ-local NAT gateway; there is no application-subnet route directly to NAT or an internet gateway. At least two AZ egress paths must be healthy before deployment. The stateful engine uses `STRICT_ORDER`, stateless default `aws:forward_to_sfe`, stateful default drop, TCP 443 only, and an exact `TLS_SNI` allowlist derived from the environment's Cognito user-pool-domain hostname plus `cognito-idp.ap-northeast-2.amazonaws.com`. Wildcards, HTTP, QUIC/UDP 443, direct literal-IP TLS, domain fronting, and a different SNI on the same resolved address fail closed. Route 53 Resolver DNS Firewall associates the application VPC with an exact allow list for those two names, the concrete private service-discovery records `core-api.service.kr.internal`, `public-data.service.kr.internal`, `records.service.kr.internal`, `explanation-worker.service.kr.internal`, `product-collector.staging.service.kr.internal`, `product-collector.service.kr.internal`, and `otel-collector.monitoring.svc.kr.internal`, and required VPC endpoint private DNS names, then a final `*` `BLOCK/NODATA` rule; it does not allow the parent `service.kr.internal` or `monitoring.svc.kr.internal` wildcard. Positive tests resolve each exact private record from only its authorized subnet/SG; negative tests block a sibling label, parent wildcard, trailing-label variant, public answer, or task that lacks the corresponding listener ingress. `fail_open=DISABLED`, outbound UDP/TCP 53 is permitted only to the VPC resolver, and DoH/DoT is blocked. The application egress security group reaches the firewall path only on TCP 443 and approved internal SGs. Network Firewall flow/alert logs and DNS block logs go to the security account with 90-day hot/365-day archive retention and record only time, rule/action, domain/SNI, protocol, and IP metadata—never TLS payload, OAuth query, headers, code, state, token, or health content. A reviewed allowlist change requires the exact FQDN, official source, owner, expiry/review date, synthetic positive/negative probe, and cost impact; no catch-all public connector rule exists. Two NAT gateways plus two firewall endpoints are an explicit MVP high-availability cost accepted in the infrastructure budget and covered by spend/anomaly alarms.
2. Interface/gateway endpoints cover S3, DynamoDB, ECR API/DKR, CloudWatch Logs, CloudWatch monitoring, KMS, Lambda, Step Functions, Secrets Manager, SQS, regional STS (`com.amazonaws.ap-northeast-2.sts`), Systems Manager, ECS control plane (`com.amazonaws.ap-northeast-2.ecs`), Elastic Load Balancing (`com.amazonaws.ap-northeast-2.elasticloadbalancing`), Amazon Managed Service for Prometheus workspaces (`com.amazonaws.ap-northeast-2.aps-workspaces`), and AWS Private CA (`com.amazonaws.ap-northeast-2.acm-pca`). Endpoint policies restrict exact account, named principal, action, and resource—an IAM allow alone is insufficient. The UX authority cells are exactly the Task 7A/7C matrix: its task SG reaches only S3/DynamoDB/KMS/ECS/ELB/Lambda/Logs/monitoring/regional-STS/Step-Functions endpoints; the task role receives only its environment resources/actions and `SendTaskSuccess|SendTaskFailure`; the outer state-machine role alone runs/stops that task and mutates the fixed ECS/ELB targets. No IAM, Route53, WAF, ACM, Cloud Map, EC2, public provider registry, NAT, proxy, or public endpoint is reachable. The remaining ECS endpoint matrix permits: workload- and recall-quorum roles only `ListTasks|DescribeTasks|DescribeServices` on the one cluster and fixed worker service; telemetry-probe only `DescribeTasks|DescribeServices` on the fixed worker/collector services; and FND recovery only its closed actions. APS permits RemoteWrite/QueryMetrics only to their named roles/workspace; DynamoDB mirrors the exact key/action maps; S3/ECR/Logs/Secrets/KMS policies name exact roles/resources/contexts. Endpoint SGs accept 443 only from matching named SGs. Protected GitHub jobs call only public Step Functions `StartExecution|DescribeExecution`; they get no VPC/data-plane permission. Tests exercise every matrix cell and reject a missing endpoint, wrong role/resource/action/SG/key, proxy/public fallback, wildcard, or privilege crossover.
3. Eleven purpose-separated KMS keys: symmetric `app-health`, `quarantine-source`, `audit`, `backup`, `fargate-ephemeral-storage`, `explanation-telemetry`, `service-identity-secrets`, and `ai-artifact-signing-keys`, plus asymmetric `record-export-attestation`, `rec-document-core-authorization-signing`, and `rec-document-worker-result-signing` (each `ECC_NIST_P256`, `SIGN_VERIFY`, `ECDSA_SHA_256`). Automatic rotation is enabled for all eight symmetric keys. The record-export asymmetric purpose follows its separately frozen explicit rotation. This milestone bootstraps and pins one exact version of each REC asymmetric purpose but deliberately does not implement their replacement ceremony; any REC signing-key rotation is release-blocked until a separately approved `rec-document-signing-key-rotation` implementation plan defines candidate publication, dual-verifier rollout, signer switching, probes, rollback, and retirement. `explanation-telemetry` encrypts only AMP; `service-identity-secrets` only private trust/recall/OTel identity artifacts; `ai-artifact-signing-keys` only the twelve private Ed25519 key containers; `app-health` the workload-token private bundle plus the three public verification secrets; and each REC asymmetric key only its named request or result signature direction. None is shared with health records, logs, sessions, documents, Fargate storage, or another workspace.

Every identity-secret decrypt requires the exact purpose key, `kms:ViaService=secretsmanager.ap-northeast-2.amazonaws.com`, exact caller account, and exact `kms:EncryptionContext:SecretARN` allowlist; direct ciphertext decrypt fails. The signer one-shot role alone may decrypt the twelve private containers through the dedicated signing key. Publisher, approval, invoker, AI runtime, service-identity, and health roles cannot decrypt/administer it. The precreated `ai_worker_task_role_arn` may exact-Version-read only `ai_artifact_signing_public_root_bundle_secret_arn`, `workload_jwks_root_registry_secret_arn`, and `workload_jwks_release_secret_arn`, with `app_health_kms_key_arn` ViaService/caller/each exact public-SecretARN conditions; it has no list/stage polling or private-container/signing-key permission. OpenTofu creates containers/policies but never key material or versions in state. The core reads only its active workload-token private bundle. Tests mutate every key, role, version, secret ARN, context, service, and account.

The single-Region `fargate-ephemeral-storage` key is set on the cluster's `fargateEphemeralStorageKmsKeyId`. Its policy gives `fargate.amazonaws.com` only `kms:GenerateDataKeyWithoutPlaintext` with exact `kms:EncryptionContext:aws:ecs:clusterAccount` and `aws:ecs:clusterName` equality, and `kms:CreateGrant` with `kms:GrantIsForAWSResource=true`, `ForAllValues:StringEquals kms:GrantOperations=[Decrypt]`, the same exact context, and Fargate as retiring principal. The foundation deployment operator has only `kms:DescribeKey`; no task/execution role gets this key. Tests prove new tasks report it, wrong/alias/multi-Region/disabled keys and missing/wrong context/grant conditions fail without claiming already-running tasks stop. Deletion windows are 30 days; application roles cannot administer keys. The core export role alone may `kms:Sign` with the P-256 attestation key and can never obtain private material or alter/delete the key.
4. S3 public access blocks are enabled on every bucket. Quarantine/staging expires after one day and rejects objects without SSE-KMS, exact content length, the declared SHA-256 checksum, an application-issued random UUID prefix, and signed `If-None-Match:*`. Versioning is enabled on the quarantine, staging, and retained-source buckets solely so every worker source, sanitized output, and retained copy is bound to the nonempty VersionId returned by its create-only write; the bucket policy requires `s3:if-none-match` on `PutObject`, while IAM denies unversioned/current-version reads, `ListBucket`, ordinary `DeleteObject`, and a second version at an existing key. Verification permanently deletes the exact staging `DeleteObjectVersion` immediately unless a separate active `RETAIN_VERIFIED_SOURCE` grant exists. Only then may the application create a unique-key copy in the distinct retained-source bucket, capture its VersionId, attach consent ID/purpose/expiry metadata, and record that exact tuple in the deletion registry; revocation permanently deletes every registry-bound version with `DeleteObjectVersion`, never a delete marker or discovered current version. One-day quarantine/staging lifecycle rules remove incomplete or fault-stranded versions, and retained-source versions have a 365-day hard ceiling; tests prove immediate exact-version deletion leaves no current, noncurrent, or marker copy for the tuple. Audit stores only pseudonymous events/digests and has 365-day Object Lock governance retention with a dedicated log-account writer.
   The quarantine bucket's sole CORS rule allows origin `https://app.genome-companion.kr`, method `PUT`, headers `content-type`, `if-none-match`, `x-amz-checksum-sha256`, `x-amz-server-side-encryption`, and `x-amz-server-side-encryption-aws-kms-key-id`, exposes only `etag`, `x-amz-checksum-sha256`, and `x-amz-version-id`, and has `max_age_seconds=300`. It has no wildcard origin/header, GET/POST/DELETE method, or credentials mode. Module tests issue synthetic preflights and reject a foreign/null origin, extra method/header, missing or non-`*` conditional header, missing checksum, second/concurrent write (`412|409`), and credentialed request. REC's presigned `requiredHeaders` and UX direct PUT must match this CORS allowlist byte-for-byte; deployment blocks on drift.
5. PostgreSQL 16.10 uses `db.t4g.medium`, multi-AZ, encrypted storage, TLS enforcement, 14-day PITR, deletion protection, no public endpoint, Secrets Manager-managed credentials, and a parameter group that logs connections and privilege/schema changes without statement values.
6. ECR has immutable tags, enhanced scan-on-push, and lifecycle rules that retain deployed digests. The personal ECS service uses Fargate, two tasks minimum across AZs, read-only root filesystem, non-root UID `65532`, no privilege, explicit CPU/memory, health checks, and a distinct execution role/task role. In stable state it injects the active `WORKLOAD_TOKEN_KEY_ID` and `WORKLOAD_TOKEN_PRIVATE_PKCS8_B64` from one exact secret VersionId. A rotation revision may additionally inject one exact next key VersionId and the fixed DynamoDB active-anchor key; its task role gets only strongly consistent `GetItem` on that key. It never receives a caller-selected table/key, and startup/signing fails if active/next key material, anchor fence, or public-pair digests disagree. No private value is exposed in OpenTofu outputs.
7. Foundation—not product-web—owns the Cognito user pool, URL-identified resource server, and sole MVP app client. The pool is local-user-only with `mfa_configuration=ON`, TOTP software-token MFA, recovery codes, verified email recovery, no SMS factor, no social/SAML/OIDC federation, deletion protection, advanced security mode, and an integration test against `DescribeUserPool`; it does not synthesize `amr`. The public web client uses authorization code plus PKCE S256, `generate_secret=false`, no implicit/client-credentials flow, exact environment callback/logout allowlists (`https://app.genome-companion.kr/auth/callback` and `/` in prod; isolated `https://app.dev.genome-companion.kr/...` in dev), five-minute access/ID tokens, one-day rotating refresh tokens, token revocation, and scopes `openid` plus the four resource scopes under identifier `https://api.genome-companion.kr`. Every authorize and step-up request includes RFC 8707 `resource=https://api.genome-companion.kr`; therefore the access token has that exact URL-valued `aud`. API Gateway and the personal application validate issuer/resource audience, and the application additionally validates the exact `client_id`. `CallerPrincipalResolver` maps only the exact qualified strings `https://api.genome-companion.kr/consent.read`, `.consent.write`, `.records.export`, and `.profile.reset` to the four internal colon scopes; unknown, duplicate, unqualified, or mixed qualified/bare inputs fail. A sensitive step-up uses `prompt=login`, a new PKCE transaction, the base scopes plus exactly one action scope, and the API relies on the fresh `auth_time` plus the release-attested MFA-required issuer configuration. The more-specific C0 `/v1/public/**` route has no bearer requirement and can target only the `PublicDataApplication` service; it cannot fall through to a personal handler.

7A. FND creates a distinct workforce-only C0 operator OIDC authority and exports only `public_data_operator_oidc_issuer`, `public_data_operator_oidc_jwk_set_uri`, `public_data_operator_oidc_audience=https://public-data-ops.genome-companion.kr`, and `public_data_operator_oidc_client_id`. It has a separate user pool/directory, resource server, no consumer app client, five-minute access tokens, MFA required, no federation/client-credentials/implicit flow, and exactly two qualified scopes `public-data.ingest` and `public-data.recall`. Its access tokens contain the exact singleton audience, exact scalar `client_id` and `azp` equal to the operator client, `token_use=access`, and only the requested allowlisted scope. The consumer/personal issuer, client, audience, scopes, refresh tokens, and subject directory can never mint or satisfy a C0 operator token. The C0 real task revision receives the four outputs only as `PUBLIC_DATA_OPERATOR_OIDC_ISSUER`, `PUBLIC_DATA_OPERATOR_OIDC_JWK_SET_URI`, `PUBLIC_DATA_OPERATOR_OIDC_AUDIENCE`, and `PUBLIC_DATA_OPERATOR_OIDC_CLIENT_ID`; no personal `OIDC_*` value is injected. Identity/task/snapshot tests exchange a synthetic operator grant, validate the exact claims, and reject personal issuer/client/audience/scope, dual audience, wrong/omitted azp/client/token_use, bare/mixed/unknown scope, and cross-directory subject before the internal controller.
8. WAF enables AWS managed common, known-bad-input, and IP-reputation rules plus a 1,000 requests per five-minute per-IP rate rule. API access logs contain only request ID, route key, status, response length, integration status, and latency.
9. CloudTrail is multi-region for global control-plane coverage but delivers only to the Korean log account; data events cover the sensitive buckets and KMS keys. Config, GuardDuty, Security Hub, root use, CloudTrail stop, KMS disable, public bucket/database, and break-glass events alarm to the security account.
10. `compute.tf` always creates an inert C0 shell on the first apply: immutable repository, fixed family/execution/task roles/log group/SG/listener/target/API route, digest-pinned FND placeholder revision, and `aws_ecs_service.public_api.desired_count=0`. The placeholder is never run and need not contain `public-data-api.jar`; the public feature route remains disabled/unhealthy until the FND deployment authority records a verified PUB first install. No PUB digest or enable boolean is a Terraform first-apply input. The authority alone registers the first real revision, requiring exactly `java -jar /app/public-data-api.jar`, `SPRING_PROFILES_ACTIVE=publicdata`, and `SPRING_CONFIG_NAME=application-publicdata`, then scales to two healthy AZ-separated tasks. A separate public execution role pulls only the repository and writes its dedicated non-PHI log group. Every injected application secret name starts `PUBLIC_DATA_`; `public_api_task` can read only the dedicated public datasource, data.go.kr secret, public bronze bucket, and public manifest key. Its mandatory `DenyPersonalPlane` boundary denies personal database/signing secrets, KMS keys, and buckets. No `DB_*`, workload-signing, Cognito, consent, document, record, quarantine, or personal-storage value is injected.

The first real C0 task revision has the exact closed ten-name application configuration set `PUBLIC_DATA_OPERATOR_OIDC_ISSUER`, `PUBLIC_DATA_OPERATOR_OIDC_JWK_SET_URI`, `PUBLIC_DATA_OPERATOR_OIDC_AUDIENCE`, `PUBLIC_DATA_OPERATOR_OIDC_CLIENT_ID`, `PUBLIC_DATA_JDBC_URL`, `PUBLIC_DATA_DB_USERNAME`, `PUBLIC_DATA_DB_PASSWORD`, `PUBLIC_DATA_GO_KR_SECRET_ID`, `PUBLIC_DATA_BRONZE_BUCKET`, and `PUBLIC_DATA_MANIFEST_KMS_KEY_ID`; a missing, extra, renamed, duplicate, lowercase, personal-plane alias, or `DATABASE_*`/generic `OIDC_*` name fails registration. The four OIDC values, bronze bucket, and manifest-key value are nonsecret snapshot scalars. `PUBLIC_DATA_JDBC_URL`, `PUBLIC_DATA_DB_USERNAME`, and `PUBLIC_DATA_DB_PASSWORD` are ECS secret injections from the exact JSON keys `jdbcUrl`, `username`, and `password` of one dedicated public-datasource Secrets Manager ARN and one snapshot-pinned VersionId; each `valueFrom` uses the exact JSON-key plus empty stage plus exact VersionId form and never `AWSCURRENT`. `PUBLIC_DATA_GO_KR_SECRET_ID` is a nonsecret, canonical version-qualified descriptor `secret-arn#versionId=<VersionId>` for the dedicated data.go.kr secret; the PUB resolver must split it, call `GetSecretValue(SecretId=secret-arn,VersionId=VersionId)`, cap and digest-validate the returned bytes, and reject a stage, bare ARN/name, second delimiter, or mismatched response VersionId. Task/endpoint IAM permits only those two exact secret ARNs and VersionIds plus their context-bound KMS decrypts. The deployment authority copies this fixed ten-name configuration from the FND shell, may change only the verified image digest and authority-owned task revision/count, and rejects any caller-provided environment, secret, command, role, family, network, or count override. OpenTofu and authority tests enumerate the ten names byte-for-byte, validate all secret/version forms, and prove personal aliases and mutable-stage retrieval fail.
11. The public task has its own security group. Its minimum foundation egress reaches exact endpoints/DNS/approved connector path but never the personal PostgreSQL SG. The fixed API route can target only the otherwise empty public target group and returns unavailable while desired count is zero; personal `/v1/**` remains on the personal target. First-install verification failure restores desired zero. Upgrade failure restores the exact prior task definition/digest/count; a successful terminal never silently rolls back. The C0 datastore remains a distinct secret/subnet/SG/key/`PUBLIC_DATA_*` configuration and cannot reuse `DATABASE_*`. Terraform ignores only the authority-owned task-definition/desired-count fields after shell creation and tests reject drift in every other service/listener/role/network attribute.
12. `service-identity.tf` creates a dedicated subordinate ACM Private CA whose root/cross-account custody is in the security account, publishes one versioned PEM trust bundle both to the immutable security-artifact bucket for ALB trust stores and to a read-only versioned Secrets Manager value for application clients, and exposes only the CA ARN, S3 URI, secret ARN, exact `private_service_trust_bundle_secret_version_id`, and lowercase SHA-256 digest. Every BFF task definition pins all three Secret coordinates and calls `GetSecretValue` with that exact VersionId; it rejects `AWSCURRENT`, an omitted/different VersionId, or bytes whose digest differs, and its role has service/context-bound decrypt only for that container/version. ACM-managed server certificates bind only `core-api.service.kr.internal`, `public-data.service.kr.internal`, `records.service.kr.internal`, and `explanation-worker.service.kr.internal` to separate internal TLS listeners. Foundation creates an empty `product_web_client` security group with no ingress/egress rule of its own; core and public-data listener target SGs accept TLS only from that SG. UX attaches it, alongside the separate application-egress SG, only to BFF ENIs; FND tests reject its attachment to core, C0, AI, collector, one-shot, endpoint, or database resources. The ordinary core and public-data listeners expose the exact private base URLs; BFF validates hostname/chain against the pinned trust-bundle VersionId and digest and calls the separate personal or C0 target without traversing API Gateway or public NAT. The core listener carries all personal operations, including the bounded 48 MiB record-export stream. A release integration sends an exact 50,331,648-byte synthetic archive through core → private ALB → BFF, verifies streaming/backpressure/digest and bounded memory, and proves 50,331,649 bytes fails before browser commit; the public/API-Gateway target cannot route the download operation. The locked `recall_handler` Lambda with a dedicated role generates the P-256 key and CSR entirely in process, calls the client-auth-only PCA template with validity at most 24 hours and the sole URI SAN `spiffe://genome-companion.kr/kr-prod/ai-recall-ack-probe`, verifies the returned chain/SAN/EKU, and writes exact additional-properties-false JSON `{schemaVersion:"service-client-identity.v1",certificatePem,privateKeyPem,chainPem,serialNumber,notBefore,notAfter,uriSan:"spiffe://genome-companion.kr/kr-prod/ai-recall-ack-probe",eku:"clientAuth",caBundleSha256}` directly to the KMS-encrypted `AWSPENDING` value at `recall_probe_client_identity_secret_arn`. The URI SAN output repeats that exact string; `caBundleSha256` equals the exact `recall_client_ca_bundle_sha256` output and follows `^sha256:[0-9a-f]{64}$`. It never writes a key, CSR, certificate, or passphrase to `/tmp` or another filesystem and makes no impossible memory-zeroization guarantee; source/integration tests instrument file APIs and scan the reproducible Lambda ZIP/logs to prove no private-key file/log value is created. The role cannot issue server certificates, choose a different SAN/template, export a CA key, or read health data. Rotation begins at 12 hours, keeps current and previous material for a maximum two-hour overlap, and removes the previous version only after the AI probe and REC listener readiness checks pass. The REC internal listener uses mTLS `verify` mode with the pinned trust-store and exact versioned `recall_client_crl_s3_uri`/`recall_client_crl_sha256` object and routes only `PUT /internal/v1/evidence-recall/registry`, `PUT /internal/v1/evidence-recall/notices/{noticeId}`, and `GET /internal/v1/evidence-recall/notices/{noticeId}/ack`; every other method/path returns 404 before the application. Body caps are 64 KiB for the registry, 16 KiB for a notice, and no body for GET. ALB verify mode overwrites the reserved `X-Amzn-Mtls-Clientcert-*` headers and forwards the URL-encoded leaf certificate, serial, issuer, subject, and validity; REC ignores the scalar summaries for authorization, strictly decodes the leaf, and independently requires the exact URI SAN, clientAuth EKU, pinned chain, non-revoked serial, validity window, method, and path. A test sends spoofed `X-Amzn-Mtls-*` inputs and proves the target receives only the ALB-produced certificate identity. Missing/stale CRL, expired/future certificate, wrong SAN, serverAuth-only certificate, old trust digest, route/body-cap mismatch, or rotation overlap beyond two hours fails closed. The AI recall-delivery task may read only this one client secret and connect only to the REC listener SG. The regular public/personal edge does not route `/internal/**`, and no other task role, security group, or certificate can reach that listener.

The CRL identity is not merely an S3 URI/digest. FND stores one DER CRL as a versioned Seoul object and exports its exact `recall_client_crl_bucket_name`, `recall_client_crl_key`, `recall_client_crl_version_id`, and `recall_client_crl_sha256`; `recall_client_crl_s3_uri` is derived from the same bucket/key and is never reparsed by REC. The personal core task definition injects exactly seven fixed nonsecret values: `REC_RECALL_TRUST_BUNDLE_SECRET_ARN=private_service_trust_bundle_secret_arn`, `REC_RECALL_TRUST_BUNDLE_VERSION_ID=private_service_trust_bundle_secret_version_id`, `REC_RECALL_TRUST_BUNDLE_SHA256=private_service_trust_bundle_sha256`, `REC_RECALL_CRL_BUCKET_NAME=recall_client_crl_bucket_name`, `REC_RECALL_CRL_KEY=recall_client_crl_key`, `REC_RECALL_CRL_VERSION_ID=recall_client_crl_version_id`, and `REC_RECALL_CRL_SHA256=recall_client_crl_sha256`. All seven are required together and come only from the applied foundation snapshot; no task override, stage label, URI parse, default, or application-discovered value is legal.

The core task role gets only `secretsmanager:GetSecretValue` on the exact trust-bundle secret and only when the request names the exact VersionId, `s3:GetObjectVersion` on the exact CRL object with `s3:VersionId == recall_client_crl_version_id`, and the minimum `kms:Decrypt` grants constrained by `kms:ViaService`, caller account, encryption context, secret ARN, and S3 object ARN. It gets no `AWSCURRENT`, `s3:GetObject`, `s3:ListBucket`, other secret/object/version/region, write, CA issue/export, or KMS administration permission. Endpoint policies mirror those exact resources/actions. Rotation first creates and validates the new CRL object VersionId, then registers/deploys one core task revision carrying the complete new seven-value tuple, waits for every target ready against that tuple, and only then removes the prior CRL/trust overlap; an absent/stale/mixed tuple keeps readiness false. OpenTofu tests mutate each env value, VersionId/action/resource/condition/context and prove failure before application traffic.

13. Closed AI telemetry uses four immutable-version Secrets Manager artifacts plus one atomic promotion-manifest secret and never the recall-probe identity. The collector leaf value is exact additional-properties-false JSON `{schemaVersion:"otel-server-identity.v1",certificatePem,privateKeyPem,chainPem,serialNumber,notBefore,notAfter,dnsSan:"otel-collector.monitoring.svc.kr.internal",eku:"serverAuth",caEpoch}`. The worker leaf value is exact JSON `{schemaVersion:"otel-client-identity.v1",certificatePem,privateKeyPem,chainPem,serialNumber,notBefore,notAfter,uriSan:"spiffe://genome-companion.kr/kr-prod/explanation-worker-otel",eku:"clientAuth",caEpoch}`. Each CA value uses exact JSON `{schemaVersion:"otel-ca-epoch.v1",purpose,epoch,notBefore,notAfter,currentCaPem,previousCaPem,currentCaSha256,previousCaSha256,bundleSha256}` where `purpose` is respectively `server-trust` or `client-auth`, `epoch` is an integer at least one, UTC times end in `Z`, and the two previous fields are nullable together. A CA artifact contains no private key, SAN, or leaf fields; each CA digest is `sha256:` plus lowercase SHA-256 over exact PEM bytes, while `bundleSha256` covers RFC 8785 canonical JSON of the entire object omitting only `bundleSha256`. The four container outputs are exactly `otel_collector_server_identity_secret_arn`, `otel_worker_client_identity_secret_arn`, `otel_server_ca_epoch_secret_arn`, and `otel_client_ca_epoch_secret_arn`; S3 may retain immutable evidence copies, but neither runtime reads S3, a mutable scalar epoch/digest, or a leaf schema for a CA artifact.

`otel_identity_promotion_manifest_secret_arn` is the only live telemetry-identity anchor. Its `AWSCURRENT` value strict-validates against the release-pinned `otel_identity_promotion_manifest_schema_sha256` and is exactly `{schemaVersion:"otel-identity-promotion.v1",sequence,identityEpoch,mode,restoresManifestDigest,promotedAt,collectorServer,workerClient,serverCa,clientCa,manifestDigest}`. `sequence` and `identityEpoch` are integers at least one; `mode` is `forward|restore`; times are UTC `Z`. `collectorServer` and `workerClient` are exactly `{secretArn,versionId,secretSha256,caEpoch}`; `serverCa` and `clientCa` are exactly `{secretArn,versionId,bundleSha256,caEpoch}`. Every secret ARN must equal its fixed foundation output, VersionIds are canonical AWS IDs of 32–64 characters, all digests match `^sha256:[0-9a-f]{64}$`, and all four `caEpoch` values equal `identityEpoch`. `manifestDigest` is SHA-256 over RFC 8785 canonical JSON of the manifest omitting only `manifestDigest`. A forward manifest requires `restoresManifestDigest=null`, sequence and epoch advance, and new candidate rows. A restore never moves a stage backward: it uses a higher manifest sequence, sets `restoresManifestDigest` to the **immediate predecessor** manifest digest recorded by the state machine, and repeats that predecessor's four rows byte-for-byte. Runtime anti-rollback state rejects a lower/equal-different sequence, any ancient/non-predecessor anchor, or an unlabelled/deleted/mutated predecessor.

The collector server leaf has only the stated DNS SAN and `serverAuth`; the explanation-worker leaf is issued only from the one-purpose telemetry client CA and has only the stated URI SAN and `clientAuth`. The worker bootstrap validates its own leaf fields before use and validates the collector server hostname/chain. The stock collector TLS layer is relied on only for the dedicated client-CA chain/EKU trust and does **not** claim client-SAN or CRL authorization; SG ingress allows only explanation-worker task ENIs, and no other workload receives that CA. Both leaves are P-256 and valid for at most 24 hours. The locked `telemetry_handler` writes four same-epoch candidate versions under `GCOTELCANDIDATE` and validates their hashes; the digest-pinned collector/client canary tasks read those explicit VersionIds for a real cross-ENI bidirectional mTLS metric probe. Only then does the state machine relabel the four prior rows `GCOTELPREVIOUS`, the four candidates `GCOTELCURRENT`, create and verify one higher promotion-manifest version, and atomically move **that manifest's** `AWSCURRENT`/`AWSPREVIOUS` stages. Collector and worker task definitions receive the exact manifest VersionId/digest, read it first, verify schema/self-digest/monotonic anchor, and then fetch all four artifacts by exact `VersionId`—never by leaf-secret stages. The state machine forces new deployments, waits for readiness/reconnect on that manifest digest, and drains prior tasks within 30 minutes. Canary failure removes candidate labels and publishes no manifest. A partial deployment may publish a higher-sequence `mode="restore"` manifest only for the immediate predecessor while its four `GCOTELPREVIOUS` versions still exist; it never rewinds a stage or relies on stale OpenTofu output. Current and predecessor labels remain on every referenced version until all collector/worker deployments, ECS task-definition reservations, and AI release reservations naming them are terminal; only then may the state machine remove obsolete labels. It enumerates references before cleanup and fails rather than dereference a deleted/unlabelled version, protecting runtime recovery from Secrets Manager's 100-version cleanup. A role compromise rotates the whole dedicated client-CA epoch rather than pretending the stock collector enforces a CRL. Wrong server hostname, wrong EKU/chain, expired/future leaf, schema confusion, CA reuse across recall or another workload, mixed epochs, stale/mixed VersionId, rollback/equivocation, overlap beyond 30 minutes, or missing expiry alarm blocks deployment. Each task reads one task-definition-pinned manifest once at bootstrap and is replaced on rotation; no post-`execve` polling claim exists. The no-filesystem-key-generation and no-secret-log tests apply to every candidate, manifest, restore, label-retention, and cleanup path.

14. Foundation owns exactly one explanation-telemetry AMP workspace in `ap-northeast-2`, its purpose-separated `explanation-telemetry` KMS key, its `aws_prometheus_workspace_configuration`, the collector trust role, and both private telemetry endpoints. `retention_period_in_days` is exactly `90`; an AWS-owned/default key, foreign-region workspace, second workspace, public endpoint, query/list/manage action, or retention drift fails the module test. `explanation_telemetry_amp_remote_write_endpoint` is derived only as `https://aps-workspaces.ap-northeast-2.amazonaws.com/workspaces/{explanation_telemetry_amp_workspace_id}/api/v1/remote_write` and is not caller-configurable. AMP needs three service-created KMS grants. Because the workspace ARN does not exist before creation, the key's create-time statement is limited to the one named foundation deploy role, `kms:CreateGrant|DescribeKey|GenerateDataKey|Decrypt`, `kms:ViaService=aps.ap-northeast-2.amazonaws.com`, exact `kms:CallerAccount`, and `kms:GrantIsForAWSResource=true`; that role can create only the one tagged workspace with the exact key/alias and cannot use the key directly. A separate verifier statement gives that same role only `kms:ListGrants` on this key—never `RetireGrant|RevokeGrant` in steady state. Before any collector starts, the protected apply paginates `ListGrants` to exhaustion with a monotonic 30-second total/five-second capped-backoff eventual-consistency deadline, records exactly three AMP grants, requires grantee/retiring service `aps.ap-northeast-2.amazonaws.com`, allows only the required subsets of `GenerateDataKey|Decrypt|DescribeKey`, and requires the grant constraint `kms:EncryptionContext:aws:aps:arn=explanation_telemetry_amp_workspace_arn`. Timeout, repeated pagination token, missing/extra grant, other workspace context, operator principal, other operation, revoke, key disable, or grant drift blocks readiness and alarms from CloudTrail; revocation is never used as routine rollback because AWS warns it can make workspace data permanently inaccessible. The foundation-created collector role trusts only `ecs-tasks.amazonaws.com`, has a permissions boundary denying all AMP actions except `aps:RemoteWrite` on the exact workspace, and has no health, log, query, workspace-management, Fargate-key, AMP-key, or STS-session-creation permission. FND exports both its ARN and name and itself creates and attaches the sole `gc-ai-telemetry-runtime-read-v1` policy, limited by that boundary to fixed-version telemetry-secret reads, conditional `service-identity-secrets` decrypt, and named control-item reads; AI may neither attach nor mutate a policy, trust, boundary, workspace, endpoint policy, or role name. The collector client SG can reach DNS, Secrets Manager/runtime image/log endpoints, and the private APS/regional-STS endpoint SGs only; it has no NAT/public fallback. `telemetry_identity_rotation_state_machine_arn` is the sole callable workflow. Its `telemetry_identity_rotation_state_machine_role_arn` may register worker/collector task-definition revisions that change only the pinned promotion-manifest VersionId/digest, update only those two services, wait for readiness, and restore the prior exact task definitions; image, command, network, task/execution role, secret ARN, or other environment mutation is denied. The protected GitHub role can only `states:StartExecution|DescribeExecution` for that state-machine ARN with bounded digest-only input and cannot pass or assume its service role. Tests compare rendered IAM/key/grant/endpoint policies, bounded `ListGrants` behavior, service/task-definition diffs, workspace configuration, KMS key ID, endpoint private DNS, SG attachments, and every exported name byte-for-byte with the AI consumer contract.

15. `telemetry-bootstrap.tf` accepts only `telemetry_bootstrap_image_digest` matching `^sha256:[0-9a-f]{64}$`, creates one immutable ECR repository and two task definitions whose images are exactly `repository_url@digest`, commands are exactly `collector-candidate` and `client-candidate`, and keeps the foundation-owned bootstrap service at `desired_count=0`. Both definitions use Fargate platform `1.4.0`, numeric UID `65532`, read-only root, `linuxParameters.capabilities.drop=["ALL"]`, omit unsupported `privileged`/`dockerSecurityOptions`, use 20 GiB ephemeral storage encrypted by `fargate_ephemeral_storage_kms_key_arn`, and log only to their fixed 30-day non-PHI groups. The execution role can pull that one digest and write those groups. The collector task role reads only the exact candidate collector/server-CA/client-CA VersionIds and calls only `aps:RemoteWrite` on the one workspace; the client role reads only the exact worker/server-CA VersionIds and has no AMP permission. Distinct collector/client SGs have no public IP, route, NAT, proxy, or CIDR egress: client→collector TCP 4317 is the only cross-task rule, and each task reaches only DNS plus its exact ECR API/DKR, S3, Logs, Secrets Manager, regional STS, and APS endpoint SGs needed by its role. The state machine—not the caller—discovers the collector ENI, supplies the fixed candidate coordinates/digests and canary digest as bounded task overrides, waits at most five minutes per task, stops both tasks on every branch, strict-validates the Task 7A result, writes it once to the Object-Lock evidence bucket, then performs the label/manifest transaction. Bootstrap requires no prior AI task definition, emits null runtime deployment fields and the initial manifest VersionId/digest/sequence, and leaves both AI services at zero; rotate requires exact current collector/worker revisions, updates collector first then worker, waits for both exact manifest-digest readiness reports, and drains the prior revisions. Tests assert IAM/SG/task definitions, cross-ENI TLS, AMP sent/failed deltas, cleanup on timeout, first-install ordering, immediate-predecessor-only restore, 100-version retention, and result-schema bytes.

16. `ai-artifact-signing.tf` accepts only the Task 7B image/ZIP digests and creates: immutable-versioned public-input staging and Object-Lock-compliance result buckets; a PITR/SSE DynamoDB replay/state table; twelve empty purpose-named Ed25519 key Secret containers plus one public-root-bundle container; the dedicated `ai-artifact-signing-keys` CMK; twelve fixed-config non-VPC functions and twelve immutable aliases from the exact ZIP; isolated one-shot `sign` and `key-ceremony` Fargate task definitions from the exact image; the exported signing state machine; and a separate unexported key-ceremony state machine. Each function alias has a distinct execution role and hard-coded mode/audience/workflow/environment/prefix; each GitHub workflow role may invoke only its named alias, while the four key-ceremony workflow roles are mutually non-assumable and cannot cross stage, approve, or invoke. The one-shot definitions use numeric UID `65532`, read-only root, `linuxParameters.capabilities.drop=["ALL"]`, omit unsupported privilege/security-option fields, use FND-CMK encrypted ephemeral storage, and run with no service/desired count. Their isolated-subnet SG has no NAT/default route/public IP/proxy and TCP 443 only to the fixed ECR API/DKR, S3, Logs, Secrets Manager, and regional STS endpoints. The signing task role reads exactly one internally mapped key VersionId and exact-version staged bytes, writes no bucket object directly, and cannot call KMS except indirectly through Secrets Manager under the dedicated key conditions; the state-machine role alone conditionally anchors replay state and writes the canonical result VersionId. Key ceremony has its own role/container allowlist and cannot read health/service-identity secrets.

The staging bucket rejects PHI tags, objects over the per-contract caps, non-content-addressed keys, missing SHA-256 checksum, overwrite, unencrypted upload, or any writer except `ai_artifact_signing_publisher_role_arn` and the two receipt producers. The result bucket has versioning, public-access block, Object Lock compliance retention, and only the state-machine result writer; invokers get one exact result coordinate after `StartExecution|DescribeExecution`. Publisher, invoker, domain approval, security approval, signer, key ceremony, plan, plan-approval, and release roles are all pairwise distinct, cannot assume/pass one another, and are mutation-tested for cross-permission. The two approval Lambdas use different audiences, workflows, environments, principals, actor registries, IAM roles, replay partitions, and receipt prefixes; neither can write the other's receipt or read a private key/result. The dedicated CMK allows only Secrets Manager in `ap-northeast-2`, exact account, exact twelve `SecretARN` contexts, and signer/key-ceremony roles; it is never the service-identity/app-health/AMP/Fargate key.

First apply creates only empty containers, roles, buckets, tables, state machines, task definitions, and outputs; every AI service remains `desired_count=0`, and no root digest is guessed. A protected two-receipt `bootstrap-all` ceremony then creates/publishes sequences 1 and 2 and returns the exact public bundle VersionId/SHA-256. The second apply exact-fetches that coordinate, checks ceremony state, exports the VersionId/SHA-256, and enables artifact requests. Rotation/revocation use the exact ceremony schemas, two independent OIDC-derived receipts, one-use anchors, Object-Lock results, backup/restore drills, and no private output.

The module provisions `workload_jwks_root_registry_secret_arn`, `workload_jwks_release_secret_arn`, the workload private-key container, the core service/task roles and task-family allowlist, and the closed promotion state machine plus its private DynamoDB candidate/`ACTIVE`/intent table. The pre-plan Task 8 ceremony creates and metadata-pins only immutable public Secret versions plus `workload_jwks_prepared_pair_*`; it cannot mutate the runtime-control table because no release reservation/fence exists yet. During an approved `first_install|workload_key` release, `stage` exact-fetches that prepared pair, re-verifies its complete broker/keygen/public/private chain, writes the non-active candidate row, and uses the reservation fence to transactionally write `control#artifact#workload-jwks` plus the six-domain active set as `staged`. Candidate workers pinned to that public pair exact-read the staged snapshot and emit the FND-owned two-snapshot quorum. Before starting `promote`, release stores the immutable intent/execution name under the same fence and reservation `workloadPromotionIntent`; the state machine rechecks intent, staged-set digest, and `recoveryOwnerRunId=null` before every mutation. It owns the first-install candidate-only or upgrade old+candidate core revision/readiness, rechecks worker quorum, then performs the single cross-table transaction that creates/replaces signer `ACTIVE`, changes the workload row/set to `active`, and records `workloadPromotionTerminal`. Pre-transaction failure zeroes first install or restores the prior upgrade core and leaves a safe staged public residue; post-transaction failure never restores the old tuple and requires a higher-sequence correction. Secret labels remain bookkeeping, and referenced versions remain through the 150-second drain and all task/reservation references. Tests cover schema confusion between prepared-pair/public-stage, empty first install, rotation, staged retry/supersession, recovery ownership, every write/service/readiness/transaction boundary, and every exact output.

`workload-jwks-public-stage-request.v1` is exactly `{schemaVersion,requestId,releaseKind,release:{releaseId,reservationSha256,fencingTokenSha256},preparedPair:{key,versionId,sha256},expectedCurrentActiveSetSha256,expectedSignerFence,requestedAt,expiresAt,requestSha256}` with `additionalProperties:false`. `releaseKind` is only `first_install|workload_key`; first install requires `expectedCurrentActiveSetSha256=null` and fence 0, while workload-key requires the exact current active-set digest and signer fence; expiry is at most ten minutes and the self-digest omits only itself. Its deterministic execution name is lowercase hex `sha256("workload-stage\0" || requestSha256 || releaseId)`, derived after hashing and never caller supplied. Before `StartExecution`, release Object-Lock writes this request, then same-fence CAS stores its coordinate in `workloadStageIntent`; only then may it start the fixed state machine. `workload-jwks-public-stage-result.v1` is exactly `{schemaVersion,requestSha256,preparedPairSha256,artifactRowSha256,stagedActiveSetSha256,signerFence,sequence,executionArnSha256,completedAt,resultSha256}`; it is Object-Locked, self-digested, and its coordinate is same-fence CAS-written once to `workloadStageTerminal`. A repeated request returns the identical result; another prepared pair/request at the same fence is equivocation.

`workload_jwks_promotion_state_machine_arn` has only closed `prepare-key|stage|promote|abort` modes. `prepare-key` validates `workload-jwks-keygen-request.v1`, runs the isolated generator, stores the private VersionId only in its conditional internal row, and returns only the public Object-Lock result described in Task 3. `stage` exact-fetches the authorized prepared-pair result plus its broker/keygen evidence, strict-verifies both wrappers, resolves and correspondence-checks the already-created private version, writes the two immutable public candidate versions if not already present, conditionally anchors the complete triple in a non-active row, and transactionally writes the workload artifact row and six-domain active set with workload status `staged`. It returns the exact public-stage result above and never changes signer `ACTIVE` authority. Each live candidate worker exact-validates that staged row/set and writes only PHI-free `workload-key-readiness.v1`; the AI no-NAT quorum task captures the FND-schema two stable snapshots. `promote` input is exactly `{schemaVersion:"workload-jwks-promotion-request.v1",requestId,releaseKind,release:{releaseId,reservationSha256,fencingTokenSha256},intent:{key,versionId,sha256,executionName},stage:{key,versionId,sha256},quorum:{key,versionId,sha256},expectedCurrentRegistrySha256,expectedCurrentReleaseSha256,expectedCurrentFence,expectedStagedActiveSetSha256,requestedAt,expiresAt,requestSha256}`. The intent is immutable before `StartExecution`, `executionName=sha256("workload-promote\0" || requestSha256 || releaseId)` in lowercase hex, and reservation progress must byte-equal its coordinate. On `releaseKind=first_install`, both expected digests are JSON null and signer fence is 0 with no ACTIVE row; later both digests are nonnull and the fence exactly matches ACTIVE; mixed-null is invalid. `expectedStagedActiveSetSha256` equals `workloadStageTerminal.stagedActiveSetSha256`. Every mutating state exact-checks both stage intent/terminal, release fence, promotion intent, staged public set, and absent recovery owner. The state machine exact-fetches stage/quorum, recomputes membership, then uses a first-install candidate-only or upgrade old+candidate core revision. Both require two core observations 30 seconds apart, recheck worker quorum, and execute one cross-table DynamoDB transaction that creates/replaces signer `ACTIVE`, marks the same workload artifact `active`, writes the complete next-fence active set, and records the promotion terminal. The Object-Locked terminal is strict `workload-jwks-promotion-result.v1` exactly `{schemaVersion,requestSha256,stageResultSha256,quorumResultSha256,releaseId,priorSignerFence,newSignerFence,signerActiveSha256,activeSetSha256,coreReadinessSha256,outcome,requiresCorrectiveWorkloadPromotion,executionArnSha256,completedAt,resultSha256}`; `outcome` is `promoted|committed_requires_correction`, the boolean is false/true respectively, the two fences are bounded monotonic integers, and the self-digest omits only itself. Its coordinate is same-fence CAS-written once to `workloadPromotionTerminal`; another result at that intent/fence is equivocation. A first-install pre-transaction failure proves core/AI counts zero; an upgrade pre-transaction failure restores prior core while leaving safe staged public residue, and neither writes a promotion terminal. A post-transaction failure never restores the old tuple and records the `committed_requires_correction` terminal. Core strongly reads signer `ACTIVE` before every sign. Label moves/drain are bookkeeping. `abort` deletes only an unreferenced candidate key/version and never rewinds a staged public set. The AI workflow role may write the two exact intents/progress coordinates, `StartExecution|DescribeExecution`, and exact-read results only; recovery may `DescribeExecution|StopExecution` both deterministic executions. Only the FND state-machine role may write signer/public anchors or deploy core. Fault tests cover lost runner before/after each intent/start/terminal, first-install and upgrade, recovery ownership, staged residue, equivocation, and every transaction boundary.

The personal application task receives only `OIDC_ISSUER`, `OIDC_JWK_SET_URI`, `OIDC_AUDIENCE=https://api.genome-companion.kr`, `OIDC_CLIENT_ID`, the injected workload signing key/key ID, database secret ARN, region, purpose-specific bucket/key identifiers, and the seven exact REC recall trust/CRL values frozen above. It receives no organization, public worker-key publication, log-retention, backup-vault, or KMS-administration permission. The public task receives none of those personal values. C0 first install is release-blocked unless PUB's `PublicPlaneArchitectureTest`, `PublicDataIsolationStartupTest`, `publicDataBootJar`, and public-data acceptance suite pass and FND independently verifies the exact handoff/digest; only the deployment authority terminal makes two real tasks healthy.

The FND-owned `workload-key-readiness.schema.json` permits exactly `{taskArnSha256,taskDefinitionArn,imageDigest,registrySequence,registrySha256,releaseSequence,releaseDocumentDigest,observedAt,expiresAt}` with `additionalProperties=false`. Digests are canonical lowercase `sha256:`, task ARN is represented only by its digest, sequences are bounded nonnegative integers, times are UTC `Z`, and expiry is exactly 90 seconds after observation. The worker derives task identity/image from the link-local ECS metadata endpoint and sequence/digests from its verified immutable snapshot; no caller/environment supplies them. The shared fixture/mutations are exercised by FND promotion tests and consumed unchanged by AI.

`workload-key-quorum-result.v1` is FND-owned and exact: `{schemaVersion:"workload-key-quorum-result.v1",stageResultSha256,registryVersionId,registrySha256,releaseVersionId,releaseSha256,releaseSequence,releaseDocumentDigest,serviceArnSha256,taskFamily,imageDigest,snapshots,expiresAt,resultSha256}`. `snapshots` is exactly two records sorted by `observedAt`, at least 30 seconds apart, each exactly `{observedAt,desiredCount,runningCount,healthyTargetCount,tasks}`; tasks are sorted/unique and exactly `{taskArnSha256,taskDefinitionArn,imageDigest,readinessObservedAt,readinessExpiresAt}`. Both snapshots require identical complete membership, desired=running=healthy counts, unexpired readiness, no PHI, result expiry no more than five minutes, and a self-digest omitting only itself. The promotion state machine re-reads live ECS service/tasks and target health after exact-fetching the immutable result and rejects any count, family, image, task definition, membership, expiry, stage, or digest drift. The shared fixture is consumed unchanged by AI.

The second approved signer apply exports `ai_artifact_signing_public_root_bundle_version_id` in addition to its secret ARN/SHA-256. This public verification bundle is encrypted under `app_health_kms_key_arn`, never the private `ai_artifact_signing_key_kms_key_arn`. Every FND verifier, workload registry ceremony, and downstream task/workflow exact-fetches that VersionId and validates the exact digest; no `AWSCURRENT` read is authorized. IAM permits `GetSecretValue` only for that public container plus required VersionId and `kms:ViaService=secretsmanager.ap-northeast-2.amazonaws.com`, exact account, and exact `SecretARN` context; it permits no read of any twelve private signer-key containers. Rotation keeps current/previous bundle coordinates while reservations reference them and tests version substitution, stage polling, rollback/equivocation, wrong CMK/context/private-key-container access, and premature cleanup.

The telemetry rotation result's `canaryEvidence:{key,versionId,sha256}` is an authenticated exact coordinate in `telemetry_identity_rotation_evidence_bucket_name`. `ai_release_workflow_role_arn` may `s3:GetObjectVersion` only for the returned key/VersionId and has no list/current-version read; a locked verifier caps, hashes, strict-parses, and cross-checks request/image/candidate/task/metric/TLS/result digests before accepting state-machine success. Missing permission, delete marker, wrong VersionId/bucket/digest, incomplete body, or success without verified evidence fails release.

`telemetry_identity_bootstrap.py` is the sole production client. Its closed subcommands are `prepare`, `start`, `wait`, `assemble-second-apply`, `record-apply`, `publish-handoff`, `coordinate-field`, and `project-ai-plan-env`. `prepare` consumes the clean signed source SHA, first-apply output digest, exact canary image digest, four empty identity-secret ARNs, AMP workspace/role, and state-machine ARN from strict FND outputs and writes one bounded additional-properties-false bootstrap request; it accepts no caller ARN, secret VersionId, CA/key bytes, task definition, service, network, or result field. `start` may call only the exact exported rotation state machine with that request digest; `wait` polls only its returned execution ARN with a five-minute deadline, rejects any other machine/execution/source, exact-fetches the immutable rotation-result and canary coordinates, and writes their public coordinates. `assemble-second-apply` combines only the independently verified signer-root coordinate, returned initial manifest coordinate, and `publish_rec_document_worker_jwks.py`'s strict two-JWK variable file into one strict saved variable file; it rejects a missing/extra variable, an enabled publisher, or a JWK coordinate not bound to the same first-apply/source receipt. `record-apply` hashes the saved plan and successful apply outputs and writes one Object-Lock apply receipt; `publish-handoff` exact-fetches all four evidence coordinates, writes once under `telemetry-bootstrap-handoffs/<sourceSha>/<handoffSha256>.json`, and returns only the coordinate. `coordinate-field` strict-parses one local public coordinate and prints exactly one allowlisted scalar `bucket|key|versionId|sha256`; it rejects extra fields, noncanonical bytes, or another field name. `project-ai-plan-env` accepts only the protected handoff key, VersionId, handoff SHA-256, verification SHA-256, the exact `GITHUB_ENV` path, and one absent summary output; it validates the fixed handoff prefix, scalar caps, nonempty VersionId, lowercase digests, UTF-8/control/newline safety, and appends exactly the four `TELEMETRY_IDENTITY_BOOTSTRAP_*` names while writing a canonical PHI-free projection digest. It rejects a duplicate/preexisting name, missing protected value, alternate environment key, caller file/body, or substitution. Tests stub every AWS call and fail wrong ARN/source/digest, timeout, result success without stopped canaries, output injection, replay/equivocation, mutable version, missing plan receipt, or any secret/log/body leakage.

After the initial rotation succeeds and the second foundation apply pins only the manifest coordinate, FND writes one Object-Locked handoff exactly `{schemaVersion:"otel-identity-bootstrap-handoff.v1",rotationResult:{key,versionId,sha256},manifest:{secretArn,versionId,sha256,sequence},canaryEvidence:{key,versionId,sha256},foundationApplyReceipt:{key,versionId,sha256},completedAt,handoffSha256}`. Every coordinate is additional-properties-false and exact-version; `handoffSha256` is lowercase `sha256:` over RFC 8785 bytes omitting only itself. `verify_telemetry_identity_evidence.py` accepts only `--bucket`, `--key`, `--version-id`, `--sha256`, `--foundation-outputs`, and optional `--expected-verification-sha256`; the ceremony omits the optional check to create the reviewed summary, while every protected consumer requires it and byte-compares the canonical summary self-digest; it caps and exact-fetches all four referenced objects, verifies rotation/manifest/canary/apply digests and sequence, proves collector-client TLS plus AMP remote-write evidence, and emits a strict summary exactly `{schemaVersion:"verified-otel-identity-bootstrap-handoff.v1",handoff:{key,versionId,sha256},manifest:{secretArn,versionId,sha256,sequence},canaryEvidence:{key,versionId,sha256},foundationApplyReceipt:{key,versionId,sha256},verifiedAt,verificationSha256}` whose self-digest omits only itself. The verified handoff key/VersionId/SHA and summary digest become separately protected release-environment values after review; they are never Terraform variables, resources, state, or outputs. AI gets exact-version read of that coordinate and its referenced public evidence only, never list/AWSCURRENT/secret-key access. Both shared schemas/fixtures and mutations cover protected expected-digest omission/substitution, missing, wrong-version, rollback/equivocation, self-digest, cross-bucket, stale sequence, and success-without-canary cases.

16A. `ai-production-evaluation-bootstrap.tf` creates one qualified `ai_production_evaluation_bootstrap_function_alias_arn`, its dedicated execution role, and the distinct `ai_production_evaluation_bootstrap_workflow_role_arn`. The alias pins the Task 7B ZIP digest and exact handler `gc_ai_artifact_signer.evaluation_anchor_handler.handler`, and hard-codes repository ID, protected tag ref, `.github/workflows/ai-production-evaluation-bootstrap.yml`, environment `ai-production-evaluation-bootstrap-kr`, audience `gc-ai-production-evaluation-bootstrap-v1`, exact request/result prefixes, root-bundle container, runtime-control table, and the two literal keys `control#evaluation#registry` and `control#evaluation#bundle`. Its execution role may exact-Version read only the named registry/bundle/corpus, their complete proposal/receipt/signing-result/envelope chains, the approved foundation snapshot, and the public root bundle; strongly `GetItem` and transactionally `Put` only those two evaluation anchors; and checksum/Object-Lock write only the deterministic bootstrap result. It cannot Query/Scan/List, read a current object/secret, touch a test prefix, sign, approve, mutate an artifact/service/reservation/terminal/approval-use key, or invoke another function. KMS permissions are service/context-bound to those exact objects and the public root secret; no private signer-key container is readable.

The workflow role's AWS trust binds only the exact repository/ref/workflow SHA/environment and `aud=sts.amazonaws.com` and may exact-Version read the ceremony coordinates, strongly read only the two existing anchors, publish only one canonical bootstrap request under `ai-production-evaluation-bootstrap-requests/<requestSha256>.json`, and invoke only the qualified bootstrap alias. It has no DynamoDB write, signer, plan, release, service, PassRole, List, current-version, or arbitrary prefix permission. The alias separately validates a fresh GitHub OIDC token with `aud=gc-ai-production-evaluation-bootstrap-v1`, performs the single two-key transaction, and owns the immutable result. `outputs.tf`, both live wrappers, `foundation-public-output-snapshot.schema.json`, its fixture, and both byte-equal output allowlists contain exactly `ai_production_evaluation_bootstrap_function_alias_arn` and `ai_production_evaluation_bootstrap_workflow_role_arn`; they contain no anchor value, sequence, digest, dynamic bucket/key, or current-version selector. `ai_runtime_control_table_name|arn` remains the sole table output, and the closed table-key assertion names both literal evaluation keys exactly once. OpenTofu, IAM, output-projection, endpoint, schema, and handler tests byte-compare the AI-owned consumer fixtures and mutate every role/key/action/prefix/VersionId/sequence/actor/workflow/root/result boundary. The initial bootstrap is required before `ai-plan`; a rotation is the same closed higher-sequence protocol. No `AI_PROD_EVAL_*` environment value or Terraform live-anchor output exists.

17. FND—not the later AI plan—precreates the inert AI runtime shells so every exported ARN exists at the first apply. It creates the exact worker/collector ECS services, explanation-worker internal TLS listener/target group/certificate/SG, collector private service-discovery record/SG, encrypted worker EFS file system/access points/mount targets, readiness table, log groups, task/execution roles, and permissions boundary. Both services are valid but `desired_count=0` and initially reference digest-pinned FND placeholder task definitions from `telemetry_bootstrap_image_digest`; those definitions are never run and contain no health secret or production command. The private explanation-worker listener is prewired 100% to the otherwise empty worker target group from the first apply, admits only `core_api_security_group_id` plus the two fixed smoke/probe SGs, and returns unavailable while desired count is zero and the core feature flag is disabled. AI needs only `UpdateService` to make approved healthy worker targets reachable and never mutates a listener/rule/weight. The collector has no ALB; it is reached only through its exact private DNS/service-discovery name and SG. The worker shell permits exactly one read-only access-point mount of the reviewed `/releases` tree; the collector has no EFS and its later task definition may use one anonymous in-task TLS volume; only the publisher one-shot may mount the matching writable publisher access point and every other one-shot is volume-free. AI may register only boundary/tag/digest-constrained revisions in the explicit worker, collector, and forward one-shot families and call `UpdateService` only on these two service ARNs after an approved plan. `ai_release_workflow_role_arn` has no `CreateService`, `DeleteService`, ELB listener/target-group/SG/EFS/DynamoDB-resource mutation, or foundation OpenTofu permission. Tests prove every output ARN exists at plan time, both services are zero, the worker listener has exactly the fixed target/certificate/SGs and no alternate rule/weight, placeholders are digest-pinned and unreachable, collector has no listener, publisher promotion is visible through the worker read-only AP, cross-role writes/traversal fail, rollback to zero makes the worker unavailable, and the AI plan cannot recreate, rename, import, or destroy a shell.

18. `ai-runtime-control.tf` precreates the sole `ai_runtime_control_table_name|arn` before any AI plan. It uses `PAY_PER_REQUEST`, PITR, deletion protection, `app_health_kms_key_arn`, strongly consistent reads, and TTL only for alarmed janitorial eligibility—not authorization. The complete closed key map is `request#<requestMac>` plus exactly `control#artifact#<domain>`, `control#artifact-lease#<domain>`, `control#evaluation#registry`, `control#evaluation#bundle`, `control#workload-readiness#<taskArnSha256>`, `control#recall-registry-ready#<taskArnSha256>`, singleton `control#telemetry-probe`, singleton `control#release-reservation`, `control#release-terminal#<releaseId>`, `control#plan-approval-use#domain#<receiptSha256>`, `control#plan-approval-use#security#<receiptSha256>`, and singleton `control#artifact-active-set`; no other `request#`, `control#`, or top-level reservation/terminal/artifact/evaluation prefix exists. `<domain>` is exactly `policy|evidence|runtime-control|evidence-recall-registry|evidence-recall|workload-jwks`.

The FND-owned `ai-artifact-active-set.schema.json` exact object is `{schemaVersion:"ai-artifact-active-set.v1",fence,priorAggregateSha256,domains,activatedAt,activeSetSha256}` with `additionalProperties:false`. `fence` is a nonnegative safe integer; `priorAggregateSha256` is JSON null only for the unique genesis transition at fence 0 and otherwise is the immediately preceding `activeSetSha256`; `domains` is exactly six rows sorted bytewise by `domain`, each exactly `{domain,sequence,artifactSha256,status}` with the closed domain enum above, unique domain, nonnegative safe sequence, canonical lowercase `sha256:` digest, and `status=staged|active`; `activatedAt` is UTC `Z`; and `activeSetSha256` hashes RFC 8785 bytes omitting only itself. The five non-workload domains are always `active`; only `workload-jwks` may be `staged`, and only while its public dual-key snapshot is installed but the separate signer `ACTIVE` authority still names the prior key or is absent on first install. Genesis creates all six rows plus the set in one DynamoDB transaction; every later stage/promotion condition-checks the prior aggregate/fence and atomically replaces exactly the changed domain row plus the complete next-fence active set. Missing/mixed domains, an unchanged or skipped fence, stale prior aggregate, duplicate/reordered row, illegal staged domain, partial transaction, rollback, and same-fence equivocation fail. The valid fixture is consumed unchanged by AI.

`control#artifact#workload-jwks` is exactly the monotonic public snapshot `(sequence,documentDigest,releaseKeyId,rootRegistryDigest,rootBundleDigest,status,updatedAt,stateDigest)`, where `status=staged|active`; the separate FND promotion table's strongly consistent `ACTIVE` row remains the sole signer authority. `stage` uses one DynamoDB transaction to create/replace this row as `staged` and create/CAS the complete next-fence active set whose workload row is also `staged`; on first install the other five already approved artifact rows participate in this unique genesis set. Candidate workers may start only from task definitions pinned to the staged registry/release VersionIds and digests, strongly read that exact staged row/set, validate the dual-key document, and emit readiness; first-install core traffic remains disabled and upgrade candidates continue accepting the prior current key. `promote` rechecks two-snapshot worker/core readiness and uses one cross-table `TransactWriteItems` call to CAS the separate signer `ACTIVE` authority, mark the exact same workload row `active`, and publish the next-fence active set with workload status `active`. A partial signer/public transition is impossible. Before this CAS, failure leaves a bounded, safe staged public residue: the old signer remains authoritative (or no signer exists on first install), first-install services are zeroed, upgrade service is restored if necessary, and only an exact same-stage retry or higher-sequence corrective stage may proceed. After CAS, recovery never restores the prior signer/public tuple and requires a higher-sequence correction.

The redacted singleton probe item is exactly `{schemaVersion:"ai-telemetry-probe-control.v1",releaseIdSha256,trigger:{key,versionId,sha256},workerTaskDefinitionArnSha256,workerImageDigest,telemetryManifestSha256,windowStart,windowEnd,expiresAt,controlSha256}` with `additionalProperties=false`, UTC `Z` bounds, expiry no later than terminal plus five minutes, and a self-digest omitting only itself. Release CAS-creates it only while holding the matching singleton reservation and after the immutable trigger is stored; a worker may strongly `GetItem` only `control#telemetry-probe`, never the reservation, raw release ID/fence, other coordinate, Query, or Scan, and rejects any task-definition/image/manifest/window mismatch. Terminal and rollback conditionally delete it; TTL is only a backstop. Every mutation is a conditional transaction with a canonical digest and monotonic fence. `ai_plan_workflow_role_arn` may only strongly consistent `GetItem` on the two evaluation keys, `control#artifact-active-set`, and the exact six artifact keys and active-set digest named by protected `ai-plan-kr`, plus `s3:GetObjectVersion` for that environment's exact evaluation/artifact coordinates; it cannot query/scan/list/write or choose a bucket/table/key prefix. Publisher and FND workload-promotion roles alone conditionally write `control#artifact#<domain>` and atomically CAS `control#artifact-active-set` with every domain activation; no partial domain/active-set update is valid. The worker role may strongly read only all six exact artifact keys, `control#artifact-active-set`, and `control#telemetry-probe`; it may conditionally write only its own derived `control#workload-readiness#<taskArnSha256>` and, when REC authorizes that exact runtime, its own derived `control#recall-registry-ready#<taskArnSha256>` row. It cannot write any artifact/active-set/probe/reservation/terminal/evaluation/approval-use/lease row, read reservation/fence/evaluation/approval-use/lease, or read another task's readiness. Publisher, worker-readiness, quorum, release, and recovery roles otherwise get only the individually enumerated keys/actions required by their fixed mode; quorum derives exact readiness keys from twice-stable ECS membership and cannot Query/Scan. The recovery state machine gets the matching reservation, per-release terminal, two same-release approval-use rows, read-only evaluation tuples, and the singleton probe item only while it binds that same release; it cannot advance evaluation/probe state. IAM, DynamoDB endpoint policy, both active-set/probe schemas and fixtures, and mutation tests enumerate this byte-for-byte map; no GitHub plan or approval role may mutate the table.

19. Foundation creates `ai_publisher_efs_access_point_arn` over the same reviewed `/releases` tree as the worker access point but with a distinct publisher POSIX identity and IAM authorization. Only the publisher has `ClientWrite`; workers have only `ClientMount` and read-only mount flags. The publisher writes under `/releases/.staging/<releaseId>`, fsyncs and verifies every signed artifact, atomically renames one complete generation to `/releases/generations/<digest>`, then conditionally updates the tiny `active` manifest; no worker can see a partial generation or traverse another path. Foundation also creates fixed forward one-shot family prefixes for publisher, service-smoke, telemetry-probe, workload/recall quorum, recall delivery, and rollback. An approved release may register only those families plus worker/collector, only with the mandatory boundary/tags and exact plan/reservation image digests, and may pass only their fixed task/execution roles; unscopable `ecs:RegisterTaskDefinition` is condition-guarded by family prefix, source-account, boundary, image-provenance tag, release ID, and request digest, then independently checked from CloudTrail before use. The production collector exposes only its stock internal Prometheus endpoint on `0.0.0.0:8888`; its SG admits that port only from `ai_release_telemetry_probe_security_group_id`, and no user/resource labels are exported there. The telemetry probe role can only describe the two AI services/tasks, call `aps:QueryMetrics` on `explanation_telemetry_amp_workspace_arn`, connect to collector TCP 8888 from that probe SG, and `PutObject` with checksum/If-None-Match under the one release evidence prefix. During the exact redacted probe window it records before/after `otelcol_exporter_sent_metric_points` and `otelcol_exporter_send_failed_metric_points`, requires sent to increase and failed not to increase, and independently queries AMP for `genome_companion_release_probe_total` bound to the trigger digest; it cannot reach the worker listener, remote-write, read health/EFS/secrets/reservation/fence, update services, or assume another role. Foundation also attaches `gc-ai-telemetry-runtime-read-v1` to the canonical collector role: exact-Version `GetSecretValue` only on the four OTel leaf/CA secrets and promotion-manifest secret, with required VersionId/digest pin and service/context-bound decrypt; AI never attaches or mutates this FND role. SG/endpoint tests deny every other source/port, an absent/redacted-control mismatch, counter reset/decrease/failure increase, AMP absence, and any user/resource label.

20. `ux-deployment-authority.tf` accepts only `ux_web_deployment_authority_image_digest`, creates the immutable authority ECR/task definition, two Standard state machines, two fence tables, distinct task/execution/state-machine roles and SGs, five Product runtime roles per environment, and every fixed edge/DNS/WAF/network shell enumerated above. The authority task definition is exactly `repository_url@digest`, has no service/desired count/public IP/NAT, uses Fargate 1.4.0, UID/GID 65532, read-only root, cap-drop `ALL`, 20 GiB FND-CMK ephemeral storage, closed entrypoint, and only the two FND environment overrides from `runTask.waitForTaskToken`. State-machine definitions and IAM are byte-hashed in tests; execution input/callback/output schemas are pinned; workflow roles can only Start/Describe; the task can only callback through `step_functions_vpc_endpoint_id`; and no Product plan can address these resources. First apply creates empty edge/runtime shells and roles; later authority executions create/update only the closed Product resources under the fence. Tests cover exact outputs, five roles, endpoint matrix, callback/lost-callback, TTL/PITR, claim-before-apply, greenfield apply, retry convergence, staging drill, production promotion, every catch/restore boundary, and denial of unsupported/public control planes.

The greenfield release has one closed `releaseKind=first_install`, distinct from the ordinary `image_only|artifact_hot|workload_key` values and not a circular requirement for already-active artifacts. Its request binds all five approved baseline artifact authorization chains, the exact FND `workload_jwks_prepared_pair_*` coordinate, and derived `firstInstallState`. It is eligible only for `kind=empty` (all six artifact rows, active set, signer `ACTIVE`, and active generation absent) or `kind=resumable_five` (exactly the same five fully verified non-workload rows/source-set digest already durable, with workload row/active set/signer absent); both require fence 0, both services/targets zero, and no conflicting generation. It reserves first and rechecks that exact state under the fence; applies only allowed AI task definitions/policies without changing service pointers/counts. From `empty`, publisher writes/exact-verifies the five EFS artifacts and their five active rows; from `resumable_five`, it exact-verifies and reuses those rows without rewriting them. Release then persists `workloadStageIntent`, invokes FND `stage`, and only its transaction adds the workload row as `staged` plus the genesis six-domain active set. After `workloadStageTerminal`, it starts collector and candidate workers, obtains quorum, persists promotion intent, invokes FND `promote`, and that state machine atomically creates signer `ACTIVE` and changes the workload row/set to `active` before telemetry verification and permanent terminalization. For first stage/promotion the current aggregate/digests are null and signer fence is 0; nonnull current values are required later and mixed-null is invalid. Fault tests resume after each of the five row writes, accept only the exact complete same-source five-row set, and reject a partial/different/extra row, worker start before stage terminal, a preexisting set/signer, state-discriminator substitution, schema confusion, unsigned/test artifact, mixed/null upgrade, first-install replay, AP privilege crossover, or AI mutation of FND resources/roles.

Every forward one-shot is launched with one server-generated `requestMac` and can conditionally write only its exact `request#<requestMac>` item after Object-Lock `PutObject`. That item is exactly `{schemaVersion:"ai-one-shot-result-pointer.v1",requestMac,releaseId,kind,taskArnSha256,result:{key,versionId,sha256},status:"succeeded"|"failed",completedAt,expiresAt,itemDigest}` with a self-digest and no PHI. The launcher knows the request key in advance, strongly `GetItem`s only it, exact-fetches the returned VersionId, and verifies task/family/image/request/release/result bindings; it never lists a bucket, polls a mutable stage, scans/queries the table, or trusts ECS exit text as evidence. Each task role may `PutItem` once only for its fixed kind and request condition. Wrong task, changed result, replay, missing Object Lock, exit-without-pointer, pointer-without-object, or a second result fails. IAM and endpoint tests cover publisher, service-smoke, telemetry-probe, workload/recall quorum, recall delivery, and rollback independently.

Recovery's terminal transaction is also exact: it condition-checks the two `control#plan-approval-use#...` rows named by the sealed manifest, marks each terminal for the same release/fence, proves `control#evaluation#registry` and `control#evaluation#bundle` still equal their reserved tuples without advancing them, writes the one release terminal, and deletes the singleton reservation. Recovery gets no other approval/evaluation key or update; mutation tests prove it cannot reuse an approval, advance evaluation state, or terminalize another release.

21. `pub-rec-release.tf` creates two immutable-tag ECR repositories, two checksum/Object-Lock evidence prefixes, distinct `pub_release_workflow_role_arn` and `rec_document_worker_release_workflow_role_arn`, and one FND-only deployment authority. Each release role trusts only the exact repository ID, signed tag ref, `.github/workflows/release.yml` workflow SHA, `production-kr` environment, and GitHub OIDC audience; gets ECR authorization plus layer upload/`PutImage`/exact `BatchGetImage` only for its one repository; and may checksum/conditional-put plus exact-VersionId-read only its one evidence prefix. Neither can create/delete/change a repository, overwrite an immutable tag, list a bucket, address another prefix, pass a role, register/update an ECS task/service, invoke Terraform/OpenTofu, call the deployment authority, or assume another role. Evidence buckets have versioning, compliance Object Lock, KMS encryption, public-access block, owner enforcement, and deny non-TLS/non-checksum/non-retained writes.

`tooling/fnd-workstream-release` is the sole AWS release-client runtime for both marker bodies and pins Python `3.12.13`, boto3 `1.43.53`, botocore `1.43.53`, and all transitives/hashes in `uv.lock`. Every ECR/S3-capable marker command runs only as `python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen python ...`; raw `aws`, `aws.exe`, `s3api`, ambient boto modules, PATH SDK wrappers, shell credentials, and a second lock/project are rejected. `fnd_workstream_aws.py ecr-login` accepts exactly `--repository` and `--docker-config`, validates the projected Seoul ECR URL/account, calls pinned boto3 `get_authorization_token`, decodes exactly `AWS:<password>` in memory, invokes fixed `/usr/bin/docker login --username AWS --password-stdin <registry>` without printing the password, and clears the buffer/reference on exit without claiming guaranteed memory zeroization. Workstream `image-digest` and `upload-evidence` subcommands import the same locked boto3/botocore: exact-tag `BatchGetImage`; checksum/Object-Lock `PutObject` with `IfNoneMatch="*"`; and `GetObject` with exact VersionId. Fake-botocore tests assert SDK/package versions and mutate region/repository/tag/bucket/prefix/VersionId/checksum/retention, credentials, retry, response size, duplicate object, and output injection; `verify_workflow_security.py` rejects any ambient AWS executable or unwrapped release-client invocation inside either marker.

The REC runtime shell is fully inert at the first apply: `rec_document_worker_service_arn` has `desired_count=0`, a digest-pinned FND placeholder task definition that is never run, no public IP/NAT/default route/ECS Exec, a private TLS listener/certificate/target group for `records-worker.service.kr.internal`, and ingress only from the core task SG. FND owns two purpose-specific nonexportable KMS `ECC_NIST_P256` `SIGN_VERIFY` keys. Core alone gets `kms:Sign` with `kms:SigningAlgorithm=ECDSA_SHA_256` on `rec_document_core_authorization_signing_key_arn`; worker alone gets the same action/algorithm on `rec_document_worker_result_signing_key_arn`. Neither role gets decrypt, data-key, key administration, the other key, or a caller-selected algorithm. A one-shot FND key publisher alone gets `kms:GetPublicKey` on exactly both keys plus `secretsmanager:PutSecretValue` on exactly the two precreated public-JWK secrets; it validates `ECC_NIST_P256/SIGN_VERIFY`, converts the DER SubjectPublicKeyInfo to strict JWK `{kty:"EC",crv:"P-256",x,y,use:"sig",alg:"ES256",kid:<exact-key-arn>}`, canonicalizes/digests it, records the exact VersionId, and then loses all permission. No runtime gets `GetPublicKey` or `PutSecretValue`. Core receives fixed nonsecret `REC_DOCUMENT_CORE_AUTH_SIGNING_KEY_ARN`; worker receives fixed nonsecret `REC_DOCUMENT_WORKER_RESULT_SIGNING_KEY_ARN`. Worker execution injects the exact core JWK VersionId as `REC_DOCUMENT_CORE_AUTH_JWK_JSON` plus fixed nonsecret `REC_DOCUMENT_CORE_AUTH_JWK_VERSION_ID` and `REC_DOCUMENT_CORE_AUTH_JWK_SHA256`; core execution injects the exact worker JWK as `REC_DOCUMENT_WORKER_RESULT_JWK_JSON` plus its VersionId/digest. Runtime byte-compares signer ARN to `kid`, digest-validates the injected JSON, and calls Sign only with `MessageType=DIGEST` plus `ECDSA_SHA_256`; task roles cannot read a mutable stage or secret.

`publish_rec_document_worker_jwks.py` is the sole executable publisher and has only `verify-vars`, `publish`, and `verify-after-apply`. `verify-vars` accepts exactly `--expected enabled|disabled` and `--vars`, strict-parses the whole auto-tfvars object without printing it, and requires the literal boolean `rec_document_jwk_publisher_enabled` to be present and equal to the fixed command expectation; enabled additionally requires all four JWK VersionId/digest inputs null, while disabled rejects a publisher ARN/resource output. `publish` accepts exactly `--foundation-outputs`, `--tag-verification`, and an absent `--out-dir`; strict-parses the first-apply keys, secret ARNs, and bootstrap-only publisher-role ARN; requires every prior JWK coordinate absent; assumes only that role; performs exactly two `GetPublicKey` calls and two `PutSecretValue` calls; and sets each Secrets Manager `ClientRequestToken` to the deterministic 64-lowercase-hex digest of the signed source, purpose, key ARN, secret ARN, and canonical JWK. The token is the exact future VersionId, so retry after response loss exact-reads the known VersionId and accepts only byte-identical JWK bytes. Before returning, it exact-Version reads both values and repeats the DER-to-JWK correspondence check. It emits mode-`0600` canonical public JWKs plus `rec-jwk-finalize.auto.tfvars.json` containing only the two exact VersionId/digest pairs and `rec_document_jwk_publisher_enabled=false`; it emits no session credential, DER, signature, private value, current-stage selector, caller ARN, or rotate mode. `verify-after-apply` accepts exactly `--foundation-outputs`, `--bootstrap-dir`, and an absent `--out`; exact-Version reads both JWKs, byte-compares their canonical bytes/digests/kids to the already correspondence-verified bootstrap artifacts, proves the bootstrap role/output and its trust/policies are absent, and writes one PHI-free verification receipt. The reviewed second apply is limited to pinning those four public coordinates alongside the signer-root/telemetry coordinates and deleting the publisher role; no runtime resource or key changes. Unit/fake-AWS/OpenTofu tests cover the exact variable gate, DER curve/type/use, fixed-width x/y encoding, canonical JWK, deterministic VersionId, lost response, cross-key/secret swap, altered tag/source, extra AWS call, role persistence, `AWSCURRENT`/List/rotate fallback, private/log leakage, and retry equivocation.

`infra/modules/kr-foundation/variables.tf` and the live root declare `rec_document_jwk_publisher_enabled` as `type=bool, default=false`. The module may create the role/trust/policy only when that value is true and all four JWK VersionId/digest inputs are null; it must have zero such resources and no role output when false. The separately held first-apply `protected.auto.tfvars.json` is the sole file that sets the literal to true. `telemetry_identity_bootstrap.py assemble-second-apply`, `workload_jwks_ceremony.py assemble-metadata-apply`, and `foundation_output_snapshot.py assemble-metadata-apply` each require their input chain to prove the publisher completed, emit the literal false, and reject omission or true. Every second/third/fourth saved-plan policy test requires the role/trust/policy destroy-or-absent state and forbids recreation; the default is therefore fail-closed, not an implicit bootstrap retry.

Core creates an initial signed request containing an exact-VersionId source GET plus a unique destination key, maximum bytes, SSE-KMS key, and create-only condition, but no impossible output length/checksum/PUT URL. After processing, worker signs a computed length/checksum upload-ticket request to exact core route `POST /internal/v1/document-jobs/{workflowId}/upload-ticket`; core rechecks durable consent/purpose state and returns an at-most-five-minute signed PUT URL bound to those values. The worker captures S3's assigned destination VersionId in its signed result, and core exact-version HEAD/GET verifies it before transition. The worker SG can reach only DNS, the Seoul S3 gateway prefix, KMS `Sign` through the exact interface-endpoint policy, and TLS to the core listener for that one bounded route; core listener routing returns 404 for every other worker-origin method/path. Launch-only ECR/Logs/Secrets endpoints are isolated to bootstrap. Task definitions are Linux/amd64, numeric `65532:65532`, read-only root, cap-drop `ALL`, fixed entrypoint/health command, and no caller override. SG/mTLS is transport only: request/ticket/result authorization requires exact signatures, issuer/audience/kid, issued/expiry/skew, authorization-decision digest, workflow, and single-use nonce.

The signature identities are fixed: core request issuer/audience `urn:genome-companion:core:document-worker-authorizer` / `urn:genome-companion:document-worker`; worker ticket issuer/audience `urn:genome-companion:document-worker` / `urn:genome-companion:core:document-worker-upload-ticket`; core ticket response audience `urn:genome-companion:document-worker-upload-ticket`; and worker result audience `urn:genome-companion:core:document-worker-result`. Disable/revocation immediately makes readiness false. This plan intentionally implements only genesis keys and rejects any candidate/previous REC signing tuple, publisher-role recreation, or signer-key change; a separately reviewed successor plan named `rec-document-signing-key-rotation` is mandatory before the first REC signing-key replacement and must add the dual-verifier/signer/probe/rollback/retirement path before changing either key. OpenTofu/IAM/runtime tests mutate every key ARN, JWK byte/VersionId/digest/kid, algorithm, issuer/audience, endpoint/action, attempted rotate/previous tuple, signature encoding, expiry/replay, consent race, PUT cap/checksum, returned VersionId, and response-loss retry.

`fnd-workstream-image-deployment-request.v1` is exactly `{schemaVersion:"fnd-workstream-image-deployment-request.v1",requestId,domain,sourceSha,signedTag,handoff:{key,versionId,sha256},imageDigest,expectedCurrentDigest,requestedAt,expiresAt,requestSha256}` with `domain=public_data|rec_document_worker`, additional properties false, expiry at most ten minutes, canonical UUIDv4/times/digests, nullable `expectedCurrentDigest` only for first install, and a self-digest omitting only itself. `verify_pub_rec_image_handoff.py` exact-VersionId fetches the owner schema handoff plus its four evidence coordinates, byte-compares source/tag/repository/runtime/Buildx/BuildKit/frontend/lock fields to the FND snapshot and signed-tag record, resolves exact OCI 1.1 referrers, and uses only `/opt/gc/bin/cosign` after an exact JSON version check for `v3.0.6`. It performs `verify --offline=true --new-bundle-format=true --trusted-root /opt/gc/sigstore/trusted_root.json` and `verify-attestation --offline=true --new-bundle-format=true --trusted-root /opt/gc/sigstore/trusted_root.json --type slsaprovenance` with issuer `https://token.actions.githubusercontent.com` and certificate identity constructed only from snapshot owner/name plus verified tag. It accepts no PATH Cosign, legacy/online bundle, regex/caller identity/root, mutable ref, extra referrer/statement, or valid signature over different provenance/SBOM bytes.

Only the FND post-marker step may create the request and invoke `pub_rec_deployment_authority_state_machine_arn`; marker/release roles cannot. `fnd_workstream_deploy.py` runs only inside the locked FND workstream-release project and has exact `prepare`, `start`, and `wait` subcommands: `prepare` consumes the locally verified handoff summary plus fixed domain/snapshot/tag records and emits the canonical request; `start` calls only the projected state-machine ARN; `wait` polls only the returned execution ARN, exact-VersionId fetches the terminal, and validates every request/domain/digest/task/count binding. It accepts no service/family/role/SG/command/count/region/bucket or free-form JSON option. The authority exact-fetches the verified handoff/evidence, CAS-reserves `(domain,currentDigest,requestSha256)`, copies the fixed FND task definition while changing only the one repository digest, registers only the preowned family/roles/SGs/entrypoint, updates only the fixed service, and waits for two stable private healthy tasks. PUB uses the existing C0 service and preserves its fixed `public-data-api.jar` command/config/deny-personal boundary. REC moves its zero shell to desired count two across AZs only after verification. On pre-terminal failure it restores the exact prior task definition/count, or desired zero for first REC install; after a successful terminal it never silently rolls back and requires a higher signed digest request. `fnd-workstream-image-deployment-result.v1` is exactly `{schemaVersion:"fnd-workstream-image-deployment-result.v1",requestSha256,domain,priorImageDigest,newImageDigest,priorTaskDefinitionArnSha256,newTaskDefinitionArnSha256,desiredCount,healthyCount,outcome,completedAt,resultSha256}` with `outcome=deployed|restored_zero|rolled_back`, exact domain counts, Object-Lock persistence, and self-digest omitting only itself. Stable retry returns the same result; same request ID/different digest or same current state/different request is equivocation. State-machine/IAM/fault tests interrupt every transition, prove caller-loss recovery and no mixed digest, and reject caller-selected service/family/role/SG/command/count/network or direct workflow deployment.

- [ ] **Step 6: Validate all runtime security assertions**

Run:

```bash
test "$(python --version)" = "Python 3.12.13"
python scripts/ci/run_locked_uv.py -- --version
python scripts/ci/run_locked_uv.py -- sync --project infra/functions/private-identity-rotation --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen pytest infra/functions/private-identity-rotation/tests scripts/release/test_build_private_identity_rotation_zip.py -q
python scripts/ci/run_locked_uv.py -- sync --project infra/functions/ai-release-recovery --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-release-recovery --frozen pytest infra/functions/ai-release-recovery/tests scripts/release/test_build_ai_release_recovery_image.py -q
test "$(uname -s)-$(uname -m)" = "Linux-x86_64"
python scripts/ci/run_locked_uv.py -- --version
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-release-recovery --frozen python scripts/release/build_ai_release_recovery_image.py --check-reproducible
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/build_private_identity_rotation_zip.py --check-reproducible
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen pytest scripts/release/test_verify_telemetry_identity_evidence.py scripts/release/test_verify_ai_artifact_signing_bootstrap.py -q
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen pytest scripts/release/test_telemetry_identity_bootstrap.py -q
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen pytest scripts/release/test_foundation_output_snapshot.py -q
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen pytest scripts/release/test_publish_rec_document_worker_jwks.py -q
python scripts/ci/run_locked_uv.py -- sync --project tooling/fnd-workstream-release --frozen
python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen pytest scripts/release/test_fnd_workstream_aws.py scripts/release/test_verify_pub_rec_image_handoff.py scripts/release/test_fnd_workstream_deploy.py -q
python scripts/ci/run_locked_uv.py -- sync --project infra/functions/pub-rec-deployment-authority --frozen
python scripts/ci/run_locked_uv.py -- run --project infra/functions/pub-rec-deployment-authority --frozen pytest infra/functions/pub-rec-deployment-authority/tests scripts/release/test_build_pub_rec_deployment_authority_zip.py -q
python scripts/ci/run_locked_uv.py -- run --project infra/functions/pub-rec-deployment-authority --frozen python scripts/release/build_pub_rec_deployment_authority_zip.py --check-reproducible
build/tools/opentofu/tofu fmt -check -recursive infra
build/tools/opentofu/tofu -chdir=infra/modules/kr-foundation validate
build/tools/opentofu/tofu -chdir=infra/modules/kr-foundation test
build/tools/opentofu/tofu -chdir=infra/live/kr-prod init -backend=false
build/tools/opentofu/tofu -chdir=infra/live/kr-prod validate
```

Expected: all commands exit 0. Tests assert Seoul-only region, three AZs, private compute/database, eight separated symmetric keys plus the three purpose-separated P-256 signing keys and least-privilege signers, cluster-level CMK encryption for Fargate ephemeral storage without unrelated task-role KMS access, exact service-identity-secret KMS conditions, encrypted exact-Version worker buckets with permanent tuple deletion and one-day quarantine/staging backstop, separate retained-source storage with a 365-day ceiling, an MFA-required/local-user-only/public-PKCE web identity with URL resource audience and exact client ID, digest-only images, security-account log delivery, and a public service that starts `public-data-api.jar` with `application-publicdata`, accepts exactly the frozen ten `PUBLIC_DATA_*` names/secret versions, rejects every personal alias/permission, and cannot reach the personal database. The PUB/REC tests additionally prove distinct immutable ECR/evidence/release roles, pinned boto3/botocore with no ambient AWS CLI, exact Cosign v3.0.6 offline verification, digest-only authority requests, the REC zero/no-NAT/private-TLS shell, the two purpose-specific ES256 KMS signer/JWK exact-version/digest seams and split upload-ticket protocol, rollback/zero restoration, and the complete seven-value trust/CRL core projection with exact-Version Secret/S3/KMS IAM. `application_egress.tftest.hcl` additionally proves both AZ firewall/NAT paths, exact TLS-SNI and DNS rules, no direct NAT route, endpoint-only AWS dependencies including ECS, ELB, APS workspaces, regional STS, Secrets Manager, ECR API/DKR, S3, Logs, and Private CA, disabled fail-open, log redaction fields, wrong-SNI/direct-IP/HTTP/QUIC/DoH/DoT denials, exact Cognito token/revoke/JWKS successes, single-AZ-failure continuity, and alarms for a firewall endpoint, NAT, DNS Firewall, or spend anomaly. `service_identity.tftest.hcl` proves exact core/public-data/REC/AI and telemetry server identities, dedicated telemetry client-CA epoch/SG isolation, exact bootstrap EKUs, 24-hour leaves, recall two-hour versus telemetry 30-minute overlap bounds, candidate-probe/stage-move/force-deploy/rollback order, no private-key filesystem write, 48 MiB direct-private core streaming without API Gateway, all three exact recall routes and byte caps, 404 for every other internal method/path, caller-header overwrite, and denial of a wrong, expired, future, cross-purpose, or server-only certificate. `ai_telemetry.tftest.hcl` proves one Seoul workspace, exact KMS key and three context-constrained service grants, 90-day retention, derived private remote-write endpoint, RemoteWrite-only collector role/boundary, exact APS/STS/Secrets/runtime endpoint policies and SG attachments, CloudTrail grant/key alarms, and the rotation role's manifest-only task-definition/service update boundary.

The same GREEN gate asserts every exact AI signer/approval/release/recovery/workload/one-shot output, the twelve qualified alias ARNs, both prepared-pair and post-reservation stage/promotion schemas/fixtures, the complete runtime-control key map, and the FND-owned authority-client digest. Its UX tests assert the three workflow-role ARNs; both state-machine/fence/authority-task output sets; exact VPC/private+edge subnet/ECS-cluster/public-zone/private-namespace+zone/DNS/certificate/SAN/ALB/listener/TG/SG/WAF/service-registry outputs; five exact FND-precreated Product roles per environment; the four canonical typed arrays and locked parser; evidence/backend/repository/snapshot/boundary outputs; the provider ZIP and closed plan-object allowlist; exact-Version-only transitive reads; disjoint terminal/result prefixes; absence of request-object/direct-apply permissions; endpoint/KMS restrictions; task-token callback; and caller-loss-safe rollback. Each test mutates one ARN/name/tag/boundary/prefix/VersionId/digest/action/context/array element/order and must fail.

- [ ] **Step 7: Commit the Seoul foundation without applying it**

```bash
git add infra/modules/kr-foundation infra/functions/private-identity-rotation infra/functions/ai-release-recovery infra/live/kr-prod governance/foundation/ai-foundation-output-env-map.json governance/foundation/ux-foundation-output-env-map.json packages/contracts/jsonschema/foundation-output-env-map.schema.json packages/contracts/fixtures/foundation-output-env-map.valid.json packages/contracts/jsonschema/otel-server-identity.schema.json packages/contracts/jsonschema/otel-client-identity.schema.json packages/contracts/jsonschema/otel-ca-epoch.schema.json packages/contracts/jsonschema/otel-identity-promotion.schema.json packages/contracts/jsonschema/otel-identity-bootstrap-handoff.schema.json packages/contracts/fixtures/otel-identity-bootstrap-handoff.valid.json packages/contracts/jsonschema/verified-otel-identity-bootstrap-handoff.schema.json packages/contracts/fixtures/verified-otel-identity-bootstrap-handoff.valid.json packages/contracts/jsonschema/service-client-identity.schema.json packages/contracts/jsonschema/workload-jwks-public-stage-request.schema.json packages/contracts/jsonschema/workload-jwks-public-stage-result.schema.json packages/contracts/fixtures/workload-jwks-public-stage-request.valid.json packages/contracts/fixtures/workload-jwks-public-stage-result.valid.json packages/contracts/jsonschema/workload-jwks-promotion-request.schema.json packages/contracts/fixtures/workload-jwks-promotion-request.valid.json packages/contracts/jsonschema/workload-jwks-promotion-result.schema.json packages/contracts/fixtures/workload-jwks-promotion-result.valid.json packages/contracts/jsonschema/workload-key-quorum-result.schema.json packages/contracts/fixtures/workload-key-quorum-result.valid.json packages/contracts/jsonschema/workload-key-readiness.schema.json packages/contracts/fixtures/workload-key-readiness.valid.json packages/contracts/jsonschema/ai-release-reservation.schema.json packages/contracts/fixtures/ai-release-reservation.valid.json packages/contracts/jsonschema/ai-release-recovery-manifest.schema.json packages/contracts/fixtures/ai-release-recovery-manifest.valid.json packages/contracts/jsonschema/ai-release-recovery-result.schema.json packages/contracts/fixtures/ai-release-recovery-result.valid.json packages/contracts/jsonschema/ai-one-shot-result-pointer.schema.json packages/contracts/fixtures/ai-one-shot-result-pointer.valid.json packages/contracts/jsonschema/ai-telemetry-probe-control.schema.json packages/contracts/fixtures/ai-telemetry-probe-control.valid.json packages/contracts/jsonschema/ai-artifact-active-set.schema.json packages/contracts/fixtures/ai-artifact-active-set.valid.json packages/contracts/jsonschema/foundation-public-output-snapshot.schema.json packages/contracts/fixtures/foundation-public-output-snapshot.valid.json scripts/release/build_private_identity_rotation_zip.py scripts/release/test_build_private_identity_rotation_zip.py scripts/release/build_ai_release_recovery_image.py scripts/release/test_build_ai_release_recovery_image.py scripts/release/verify_telemetry_identity_evidence.py scripts/release/test_verify_telemetry_identity_evidence.py scripts/release/telemetry_identity_bootstrap.py scripts/release/test_telemetry_identity_bootstrap.py scripts/release/verify_ai_artifact_signing_bootstrap.py scripts/release/test_verify_ai_artifact_signing_bootstrap.py scripts/release/foundation_output_snapshot.py scripts/release/test_foundation_output_snapshot.py scripts/release/publish_rec_document_worker_jwks.py scripts/release/test_publish_rec_document_worker_jwks.py supply-chain/fnd-functions.lock.json ops/runbooks/application-egress-change.md ops/runbooks/private-service-certificate-rotation.md ops/runbooks/telemetry-identity-rotation.md ops/runbooks/ai-artifact-signing.md
git add packages/contracts/jsonschema/workload-key-quorum-result.schema.json packages/contracts/fixtures/workload-key-quorum-result.valid.json packages/contracts/jsonschema/workload-key-readiness.schema.json packages/contracts/fixtures/workload-key-readiness.valid.json
git add packages/contracts/jsonschema/ai-release-reservation.schema.json packages/contracts/fixtures/ai-release-reservation.valid.json packages/contracts/jsonschema/ai-release-recovery-manifest.schema.json packages/contracts/fixtures/ai-release-recovery-manifest.valid.json packages/contracts/jsonschema/ai-release-recovery-result.schema.json packages/contracts/fixtures/ai-release-recovery-result.valid.json packages/contracts/jsonschema/ai-one-shot-result-pointer.schema.json packages/contracts/fixtures/ai-one-shot-result-pointer.valid.json infra/functions/ai-release-recovery scripts/release/build_ai_release_recovery_image.py scripts/release/test_build_ai_release_recovery_image.py
git add infra/modules/kr-foundation/pub-rec-release.tf infra/modules/kr-foundation/tests/pub_rec_release.tftest.hcl infra/functions/pub-rec-deployment-authority tooling/fnd-workstream-release governance/foundation/pub-foundation-output-env-map.json governance/foundation/rec-foundation-output-env-map.json scripts/release/build_pub_rec_deployment_authority_zip.py scripts/release/test_build_pub_rec_deployment_authority_zip.py scripts/release/fnd_workstream_aws.py scripts/release/test_fnd_workstream_aws.py scripts/release/fnd_workstream_deploy.py scripts/release/test_fnd_workstream_deploy.py scripts/release/verify_pub_rec_image_handoff.py scripts/release/test_verify_pub_rec_image_handoff.py packages/contracts/jsonschema/fnd-workstream-image-deployment-request.schema.json packages/contracts/fixtures/fnd-workstream-image-deployment-request.valid.json packages/contracts/jsonschema/fnd-workstream-image-deployment-result.schema.json packages/contracts/fixtures/fnd-workstream-image-deployment-result.valid.json
git commit -m "feat: add private AWS Seoul runtime foundation"
```

---

### Task 8: Gate builds and releases on software-supply-chain evidence

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `.github/workflows/ai-promotion-intent.yml`
- Create: `.github/workflows/ai-plan.yml`
- Create: `.github/workflows/ai-plan-domain-approve.yml`
- Create: `.github/workflows/ai-plan-security-approve.yml`
- Create: `.github/workflows/ai-production-evaluation-bootstrap.yml`
- Create: `.github/workflows/ai-release-recovery.yml`
- Create: `.github/workflows/ai-artifact-signing-stage.yml`
- Create: `.github/workflows/ai-artifact-signing-domain-approve.yml`
- Create: `.github/workflows/ai-artifact-signing-security-approve.yml`
- Create: `.github/workflows/ai-artifact-signing-invoke.yml`
- Create: `.github/workflows/ai-artifact-key-ceremony-stage.yml`
- Create: `.github/workflows/ai-artifact-key-custodian-approve.yml`
- Create: `.github/workflows/ai-artifact-key-security-approve.yml`
- Create: `.github/workflows/ai-artifact-key-ceremony-invoke.yml`
- Create: `.github/dependabot.yml`
- Create: `scripts/ci/verify_workflow_security.py`
- Test: `scripts/tests/test_verify_workflow_security.py`
- Create: `scripts/ci/verify_migration_ranges.py`
- Create: `scripts/ci/verify_signed_release_tag.py`
- Create: `scripts/ci/install_security_tools.sh`
- Create: `governance/release/allowed-tag-signers.schema.json`
- Create: `governance/release/allowed-tag-signers.json`
- Create: `governance/ai/promotion-intent-draft.json`
- Create: `packages/contracts/jsonschema/ux-staging-result.schema.json`
- Create: `packages/contracts/fixtures/ux-staging-result.valid.json`
- Create: `packages/contracts/jsonschema/ux-staging-fault-request.schema.json`
- Create: `packages/contracts/fixtures/ux-staging-fault-request.valid.json`
- Consume unchanged from Task 1: `supply-chain/tool-artifacts.lock.json`, `scripts/ci/install_android_sdk.py`, `scripts/ci/install_bundletool.py`, `scripts/ci/install_buildx.py`, `scripts/tests/test_install_android_sdk.py`, `scripts/tests/test_install_bundletool.py`, and `scripts/tests/test_install_buildx.py`
- Test: `scripts/tests/test_verify_signed_release_tag.py`
- Create: `apps/core-api/Dockerfile`
- Consume unchanged from Task 7A: `supply-chain.lock.json`
- Consume unchanged from Task 7C: `governance/foundation/pub-foundation-output-env-map.json`, `governance/foundation/rec-foundation-output-env-map.json`, `tooling/fnd-workstream-release/uv.lock`, `scripts/release/fnd_workstream_aws.py`, and `scripts/release/verify_pub_rec_image_handoff.py`
- Modify: `apps/core-api/build.gradle.kts`
- Test: `scripts/ci/verify_workflow_security.py`

**Interfaces:**
- Consumes: checked-out Git commit SHA; SSH-signed annotated SemVer tag; GitHub OIDC identity; protected `ux-plan-kr`, `staging-kr`, AI plan/artifact/key-ceremony role-specific approval environments, dedicated `ai-production-evaluation-bootstrap-kr`, and `production-kr`; exact FND workflow roles, snapshot coordinate, projection maps, permissions boundaries, and immutable function aliases; Task 7C ECR/runtime outputs; Task 1's immutable Android API 35 SDK/AVD, bundletool, Buildx, BuildKit, and Dockerfile-frontend contracts; official Go module checksums.
- Produces: shared base jobs `foundation_contract`, `foundation_app`, `foundation_iac`, and `foundation_supply_chain`; named CI step-extension jobs `ux_workstream` (web/Ubuntu), `ux_android_workstream` (Ubuntu), `ux_ios_workstream` (macOS), `ai_workstream` (Ubuntu), `pub_workstream` (Ubuntu), `rec_workstream` (Ubuntu), `gen_android_workstream` (Ubuntu), and `gen_ios_workstream` (macOS); distinct protected `pub_release` and `rec_document_worker_release` jobs with exact owner markers and FND post-marker verification/deployment; distinct `ux_web_plan`, `ux_web_staging`, `ux_web_release`, `ux_android_release`, and `ux_ios_release` jobs plus strict `ux-staging-result.v1` and plan-bound `ux-staging-fault-request.v1` contracts; cross-run `ai_promotion_intent`, `ai_plan`, `ai_plan_domain_approval`, `ai_plan_security_approval`, `ai_release`, `ai_production_evaluation_bootstrap`, and `ai_release_recovery` jobs; four generic artifact-signing jobs and four key-ceremony jobs defined below; exact tag-verification record; protected conditional GEN Android/iOS release jobs; tested personal JAR, CycloneDX SBOM, Trivy/Gitleaks reports, digest-referenced OCI image, Cosign bundle/signature, provenance containing source/base/result digests, and deployment input `core_api_image_digest`. PUB owns only the commands inside its release marker and emits the candidate `public_data_image_digest`; REC owns only its marker commands and candidate `rec_document_worker_image_digest`; FND independently verifies and alone invokes the digest-only deployment authority.

- [ ] **Step 1: Write the failing workflow-security verifier and mutation tests**

```python
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[2]
SHA = re.compile(r"^[0-9a-f]{40}$")
ACTION = re.compile(r"^\s*-\s+uses:\s+[^@\s]+@([^\s#]+)", re.MULTILINE)


def verify(path: Path) -> list[str]:
    text = path.read_text()
    errors: list[str] = []
    if "pull_request_target:" in text:
        errors.append(f"{path}: pull_request_target is prohibited")
    for reference in ACTION.findall(text):
        if not SHA.fullmatch(reference):
            errors.append(f"{path}: action is not SHA pinned: {reference}")
    for prohibited in (
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "permissions: write-all",
        "contents: write",
        "actions: write",
    ):
        if prohibited in text:
            errors.append(f"{path}: prohibited workflow text: {prohibited}")
    marker_pairs = {
        "ci.yml": (
            ("# BEGIN UX WORKSTREAM STEPS", "# END UX WORKSTREAM STEPS"),
            ("# BEGIN UX ANDROID WORKSTREAM STEPS", "# END UX ANDROID WORKSTREAM STEPS"),
            ("# BEGIN UX IOS WORKSTREAM STEPS", "# END UX IOS WORKSTREAM STEPS"),
            ("# BEGIN AI WORKSTREAM STEPS", "# END AI WORKSTREAM STEPS"),
            ("# BEGIN PUB EXTENSION", "# END PUB EXTENSION"),
            ("# BEGIN REC WORKSTREAM STEPS", "# END REC WORKSTREAM STEPS"),
            ("# BEGIN GEN ANDROID WORKSTREAM STEPS", "# END GEN ANDROID WORKSTREAM STEPS"),
            ("# BEGIN GEN IOS WORKSTREAM STEPS", "# END GEN IOS WORKSTREAM STEPS"),
        ),
        "release.yml": (
            ("# BEGIN UX WEB PLAN STEPS", "# END UX WEB PLAN STEPS"),
            ("# BEGIN UX WEB STAGING STEPS", "# END UX WEB STAGING STEPS"),
            ("# BEGIN UX WEB RELEASE STEPS", "# END UX WEB RELEASE STEPS"),
            ("# BEGIN UX ANDROID RELEASE STEPS", "# END UX ANDROID RELEASE STEPS"),
            ("# BEGIN UX IOS RELEASE STEPS", "# END UX IOS RELEASE STEPS"),
            ("# BEGIN AI RELEASE STEPS", "# END AI RELEASE STEPS"),
            ("# BEGIN PUB RELEASE STEPS", "# END PUB RELEASE STEPS"),
            ("# BEGIN REC DOCUMENT WORKER RELEASE STEPS", "# END REC DOCUMENT WORKER RELEASE STEPS"),
            ("# BEGIN GEN ANDROID RELEASE STEPS", "# END GEN ANDROID RELEASE STEPS"),
            ("# BEGIN GEN IOS RELEASE STEPS", "# END GEN IOS RELEASE STEPS"),
        ),
        "ai-plan.yml": (("# BEGIN AI PLAN STEPS", "# END AI PLAN STEPS"),),
        "ai-plan-domain-approve.yml": (("# BEGIN AI PLAN DOMAIN APPROVAL STEPS", "# END AI PLAN DOMAIN APPROVAL STEPS"),),
        "ai-plan-security-approve.yml": (("# BEGIN AI PLAN SECURITY APPROVAL STEPS", "# END AI PLAN SECURITY APPROVAL STEPS"),),
        "ai-release-recovery.yml": (("# BEGIN AI RELEASE RECOVERY STEPS", "# END AI RELEASE RECOVERY STEPS"),),
        "ai-artifact-signing-stage.yml": (("# BEGIN AI ARTIFACT SIGNING STAGE STEPS", "# END AI ARTIFACT SIGNING STAGE STEPS"),),
        "ai-artifact-signing-domain-approve.yml": (("# BEGIN AI ARTIFACT SIGNING DOMAIN APPROVAL STEPS", "# END AI ARTIFACT SIGNING DOMAIN APPROVAL STEPS"),),
        "ai-artifact-signing-security-approve.yml": (("# BEGIN AI ARTIFACT SIGNING SECURITY APPROVAL STEPS", "# END AI ARTIFACT SIGNING SECURITY APPROVAL STEPS"),),
        "ai-artifact-signing-invoke.yml": (("# BEGIN AI ARTIFACT SIGNING INVOKE STEPS", "# END AI ARTIFACT SIGNING INVOKE STEPS"),),
        "ai-artifact-key-ceremony-stage.yml": (("# BEGIN AI ARTIFACT KEY CEREMONY STAGE STEPS", "# END AI ARTIFACT KEY CEREMONY STAGE STEPS"),),
        "ai-artifact-key-custodian-approve.yml": (("# BEGIN AI ARTIFACT KEY CUSTODIAN APPROVAL STEPS", "# END AI ARTIFACT KEY CUSTODIAN APPROVAL STEPS"),),
        "ai-artifact-key-security-approve.yml": (("# BEGIN AI ARTIFACT KEY SECURITY APPROVAL STEPS", "# END AI ARTIFACT KEY SECURITY APPROVAL STEPS"),),
        "ai-artifact-key-ceremony-invoke.yml": (("# BEGIN AI ARTIFACT KEY CEREMONY INVOKE STEPS", "# END AI ARTIFACT KEY CEREMONY INVOKE STEPS"),),
    }
    for begin, end in marker_pairs.get(path.name, ()):
        if text.count(begin) != 1 or text.count(end) != 1:
            errors.append(f"{path}: marker pair {begin!r}/{end!r} must appear exactly once")
    return errors


workflows = sorted((ROOT / ".github/workflows").glob("*.yml"))
problems = [] if workflows else ["no CI or release workflow exists"]
for workflow in workflows:
    problems.extend(verify(workflow))
if problems:
    print("\n".join(problems))
    sys.exit(1)
```

Before GREEN, extend the verifier with structural assertions for the exact four PUB/REC candidate/finalize jobs, both marker pairs, four-output mappings, pinned action/setup/credential/projection order, distinct release-versus-authority roles, locked FND workstream-release invocation, no raw `aws|aws.exe|s3api`, exact `/opt/gc/bin/cosign` v3.0.6 post-marker verifier, same-source `needs`, and absence of ECS/OpenTofu/deployment commands from both marker jobs. Mutations delete or duplicate each marker/job/output, swap domains/roles/maps, move credentials or verification after a marker, insert ambient AWS/Cosign, let a candidate call the authority, let finalize push/build, or bypass `verify_pub_rec_image_handoff.py`; each must fail. RED is the missing four jobs/markers and supporting Task 7C outputs.

Create `verify_migration_ranges.py` with a shared all-files mode and an owner mode used by workstream extension jobs:

```python
from argparse import ArgumentParser
from collections import Counter
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]
MIGRATION_ROOT = ROOT / "apps/core-api/src/main/resources/db/migration"
MIGRATION = re.compile(r"^V([0-9]+)__[a-z0-9_]+\.sql$")
RANGES = {"FND": range(1, 20), "PUB": range(100, 120), "REC": range(200, 220)}


def migration_version(path: Path) -> int:
    match = MIGRATION.fullmatch(path.name)
    if match is None:
        raise ValueError(f"invalid Flyway filename: {path}")
    return int(match.group(1))


def all_migrations() -> list[Path]:
    return sorted(MIGRATION_ROOT.glob("V*__*.sql"))


def changed_migrations(base: str) -> list[Path]:
    output = subprocess.check_output(
        ["git", "diff", "--name-only", f"{base}...HEAD", "--", str(MIGRATION_ROOT.relative_to(ROOT))],
        cwd=ROOT,
        text=True,
    )
    return [ROOT / line for line in output.splitlines() if line]


parser = ArgumentParser()
parser.add_argument("--all", action="store_true")
parser.add_argument("--owner", choices=sorted(RANGES))
parser.add_argument("--base")
args = parser.parse_args()
if args.all == (args.owner is not None):
    parser.error("choose exactly one of --all or --owner")
paths = all_migrations() if args.all else changed_migrations(args.base or "HEAD^1")
versions = [migration_version(path) for path in paths]
errors = [f"duplicate Flyway version V{version}" for version, count in Counter(versions).items() if count > 1]
if args.all:
    allowed = set().union(*(set(values) for values in RANGES.values()))
    errors.extend(f"unreserved Flyway version V{version}" for version in versions if version not in allowed)
else:
    allowed = set(RANGES[args.owner])
    errors.extend(f"{args.owner} cannot create Flyway V{version}" for version in versions if version not in allowed)
if errors:
    print("\n".join(errors))
    sys.exit(1)
```

- [ ] **Step 2: Run the verifier and confirm the red state**

Run:

```bash
python -m unittest scripts.tests.test_verify_workflow_security -v
python scripts/ci/verify_workflow_security.py
python scripts/ci/verify_migration_ranges.py --all
```

Expected: the dedicated workflow mutation suite and workflow verification are RED because the complete fixed bootstrap workflow is absent, while migration-range verification exits 0 for the FND `V1`–`V3` files and would reject a duplicate or unreserved version.

- [ ] **Step 3: Add pinned CI and protected release workflows**

Use these action commit SHAs, resolved from the official repositories on 2026-08-09 and updated only by reviewed PR:

```yaml
- uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
- uses: actions/setup-java@cf277c60eb25467037889841efdb72551f06f6c3
- uses: gradle/actions/wrapper-validation@0b6dd653ba04f4f93bf581ec31e66cbd7dcb644d
- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
- uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093
- uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
- uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38
- uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1
- uses: subosito/flutter-action@1a449444c387b1966244ae4d4f8c696479add0b2
- uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
```

The pinned `actions/setup-java` step uses `distribution: temurin`, `java-version: "21.0.8+9"`, and `cache: gradle`; no workstream setup step selects a different JDK.

Every privileged AWS job has a foundation-owned credential step after its trusted checkout and any foundation-owned pinned runtime setup, and before projection or its extension marker. The exact order is checkout → pinned setup-python/setup-Java/other required runtime step(s) → one credential step → foundation projection/identity step(s) → marker; jobs needing no runtime setup place credentials directly after checkout. The credential step uses only `aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c`, `aws-region: ap-northeast-2`, `audience: sts.amazonaws.com`, `mask-aws-account-id: true`, its one exact protected-environment `*_WORKFLOW_ROLE_ARN`, and `role-session-name: gc-<job-id>-${{ github.run_id }}-${{ github.run_attempt }}`; role ARN, region, audience, duration, or session name cannot be supplied by dispatch input or marker code. Plan/UX staging/UX release/recovery roles use `role-duration-seconds: 3600`, approval/stage/invoke/key-ceremony roles use `1800`, and `ai_release_workflow_role_arn` alone uses `7200` because its job timeout is 90 minutes. IAM sets and tests exact `max_session_duration` of 3600, 1800, or 7200 respectively; no job silently relies on the AWS 3600-second default or reacquires a different role. `verify_workflow_security.py` parses every privileged workflow and rejects a missing/reordered/unpinned credential step, `${{ inputs.* }}` role/region/audience/duration, cross-role use, a session longer than the role maximum, credentials before checkout/runtime setup, credentials after projection/marker begins, or any second credential action.

Every release/plan starts from one SSH-signed **annotated** tag whose ref matches `^refs/tags/v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`; lightweight tags, prerelease/build suffixes, and ambient GPG/SSH keyrings fail. `allowed-tag-signers.json` strict-validates against the additional-properties-false schema and is exactly `{schemaVersion:"allowed-tag-signers.v1",sequence,generatedAt,previousRegistryDigest,signers,registryAuthorization,registryDigest}`. Sorted unique signer rows are exactly `{principal,publicKey,publicKeyFingerprint,status,notBefore,notAfter}`; `status` is `active|retired|revoked`, fingerprints are canonical SHA256 SSH fingerprints, and times are UTC `Z`. `registryDigest` hashes RFC 8785 bytes omitting only itself. The initial registry digest is a literal reviewed constant in `verify_signed_release_tag.py`. A higher registry must name the exact prior digest and include `registryAuthorization:{principal,signatureBase64}` where the prior active signer signs `GC-TAG-SIGNER-REGISTRY-V1\0 || RFC8785(registry omitting registryAuthorization and registryDigest)`; lower/equivocating sequence, skipped predecessor, first-seen retired signer, revoked signer, reused public key/principal, or invalid authorization fails. Updating the schema/initial pin/registry requires the release-owner and security CODEOWNERS review in one dedicated PR.

`verify_signed_release_tag.py` accepts only `--tag`, `--source-sha`, `--registry`, and `--out`; rejects duplicate JSON keys and size/depth/count overflow; materializes a `0600` temporary allowed-signers file from active registry rows; invokes exact repository Git using `git -c gpg.format=ssh -c gpg.ssh.allowedSignersFile=<verified-temp> verify-tag --raw -- <tag>` with no ambient config/keyring; and independently checks the tag object is annotated, its peeled commit equals the checked-out 40-hex source SHA, signer principal/fingerprint are one active in-window registry row, and tagger time is in-window. It writes exactly `{schemaVersion:"signed-release-tag-verification.v1",tag,sourceSha,signerPrincipal,signerRegistryDigest,verificationSha256}` where the self-digest omits only itself. `test_verify_signed_release_tag.py` uses fixed SSH vectors and covers wrong object/target/ref/principal/key/time, lightweight/multi-signature tag, parser injection, ambient config, retired anchored history versus retired/revoked first-seen tag, registry rollback/equivocation/rotation, and mutation of every result field. AI plan stores this exact record and cannot substitute `github.actor` for tag identity.

`ci.yml` owns only the four `foundation_*` jobs. It also establishes the eight no-op extension jobs named above. Every job depends on `foundation_contract`, checks out with the pinned checkout SHA, has explicit `timeout-minutes`, and starts with zero permissions beyond `contents: read`. Ubuntu jobs use `ubuntu-24.04`; iOS jobs use `macos-15`. Workstream plans may replace only their own no-op line between these exact marker pairs:

```yaml
# BEGIN UX WORKSTREAM STEPS
- name: UX extension point
  run: "true"
# END UX WORKSTREAM STEPS

# BEGIN UX ANDROID WORKSTREAM STEPS
- name: UX Android extension point
  run: "true"
# END UX ANDROID WORKSTREAM STEPS

# BEGIN UX IOS WORKSTREAM STEPS
- name: UX iOS extension point
  run: "true"
# END UX IOS WORKSTREAM STEPS

# BEGIN AI WORKSTREAM STEPS
- name: AI extension point
  run: "true"
# END AI WORKSTREAM STEPS

# BEGIN PUB EXTENSION
- name: PUB extension point
  run: "true"
# END PUB EXTENSION

# BEGIN REC WORKSTREAM STEPS
- name: REC extension point
  run: "true"
# END REC WORKSTREAM STEPS

# BEGIN GEN ANDROID WORKSTREAM STEPS
- name: Conditional GEN Android extension point
  run: "true"
# END GEN ANDROID WORKSTREAM STEPS

# BEGIN GEN IOS WORKSTREAM STEPS
- name: Conditional GEN iOS extension point
  run: "true"
# END GEN IOS WORKSTREAM STEPS
```

UX, AI, PUB, REC, and conditional GEN replace only their own no-op line or append steps between their marker pair. Foundation does not specify or stage their commands. PUB and REC extension jobs call `verify_migration_ranges.py --owner PUB --base "$PR_BASE_SHA"` and `--owner REC --base "$PR_BASE_SHA"` respectively; the foundation base job runs the all-files collision check. The workflow-security verifier rejects a Flutter step outside the pinned Android/macOS jobs, an iOS build outside `macos-15`, an unpinned setup action, Corepack/pnpm without the root lockfile, or a GEN step when its signed G0 gate input is absent.

`release.yml` remains foundation-owned and defines exact no-op extension jobs with marker pairs `BEGIN/END UX WEB PLAN STEPS`, `BEGIN/END UX WEB STAGING STEPS`, `BEGIN/END UX WEB RELEASE STEPS`, `BEGIN/END UX ANDROID RELEASE STEPS`, `BEGIN/END UX IOS RELEASE STEPS`, `BEGIN/END AI RELEASE STEPS`, `BEGIN/END GEN ANDROID RELEASE STEPS`, and `BEGIN/END GEN IOS RELEASE STEPS`. Web/AI jobs deploy only immutable signed digests after foundation evidence; mobile jobs produce source-bound, dependency-locked **unsigned Android AAB and no-codesign iOS archive/app candidates** plus provenance and never claim bit reproducibility, distribution readiness, or store publication. Upload-key/certificate/profile custody, signing runners, Apple/Google account authorization, revocation/rotation, notarization where applicable, and store submission require a separate founder-approved mobile-signing/release plan. iOS release runs only on `macos-15`; conditional GEN jobs additionally require the machine-verified G0 artifact digest. A local `tofu test` or fixture is never deployment evidence.

The same foundation-owned file also defines protected candidate jobs `pub_release` and `rec_document_worker_release` plus FND-only `pub_release_finalize` and `rec_document_worker_release_finalize`. All four run only for the verified signed SemVer tag, on `ubuntu-24.04`, in `production-kr`, with `contents:read`, `id-token:write`, fixed concurrency, `fetch-depth:0`, `fetch-tags:true`, and `persist-credentials:false`. Candidate jobs use their distinct release workflow roles and cannot invoke/deploy; finalize jobs use only `pub_rec_deployment_authority_workflow_role_arn`, cannot push/write candidate evidence, and exact-fetch the four Object-Lock coordinate scalars emitted by their one `needs` job. Every job repeats signed-tag verification and exact foundation-snapshot fetch; candidate jobs project only their closed PUB/REC map. The snapshot/tag files are fixed at `build/foundation-output-snapshot.json` and `build/signed-release-tag-verification.json`, exported as `FOUNDATION_OUTPUTS_SNAPSHOT_JSON` and `SIGNED_RELEASE_TAG_VERIFICATION_JSON`. Before either marker, FND runs `python scripts/ci/run_locked_uv.py -- --version`, syncs `tooling/fnd-workstream-release --frozen`, and proves pinned boto3/botocore versions; markers cannot install or choose an AWS client.

The job/marker/output skeleton is exact:

```yaml
pub_release:
  runs-on: ubuntu-24.04
  timeout-minutes: 60
  environment: production-kr
  permissions: {contents: read, id-token: write}
  concurrency: {group: pub-release-kr, cancel-in-progress: false}
  outputs:
    image_digest: ${{ steps.pub_image_handoff.outputs.public_data_image_digest }}
    handoff_key: ${{ steps.pub_image_handoff.outputs.public_data_handoff_key }}
    handoff_version_id: ${{ steps.pub_image_handoff.outputs.public_data_handoff_version_id }}
    handoff_sha256: ${{ steps.pub_image_handoff.outputs.public_data_handoff_sha256 }}
  steps:
    # FND checkout, Python 3.12.13, Java 21.0.8+9, credential, signed-tag,
    # exact snapshot fetch/project, locked-uv, Buildx/BuildKit bootstrap
    # BEGIN PUB RELEASE STEPS
    - name: PUB release extension point
      id: pub_image_handoff
      run: "true"
    # END PUB RELEASE STEPS

rec_document_worker_release:
  runs-on: ubuntu-24.04
  timeout-minutes: 60
  environment: production-kr
  permissions: {contents: read, id-token: write}
  concurrency: {group: rec-document-worker-release-kr, cancel-in-progress: false}
  outputs:
    image_digest: ${{ steps.rec_document_worker_handoff.outputs.rec_document_worker_image_digest }}
    handoff_key: ${{ steps.rec_document_worker_handoff.outputs.rec_document_worker_handoff_key }}
    handoff_version_id: ${{ steps.rec_document_worker_handoff.outputs.rec_document_worker_handoff_version_id }}
    handoff_sha256: ${{ steps.rec_document_worker_handoff.outputs.rec_document_worker_handoff_sha256 }}
  steps:
    # FND checkout, Python 3.12.13, credential, signed-tag, exact snapshot
    # fetch/project, locked-uv, Buildx/BuildKit bootstrap
    # BEGIN REC DOCUMENT WORKER RELEASE STEPS
    - name: REC document worker release extension point
      id: rec_document_worker_handoff
      run: "true"
    # END REC DOCUMENT WORKER RELEASE STEPS
```

Comments above abbreviate only FND-owned steps, not their contracts: `verify_workflow_security.py` requires the exact pinned action SHAs/order/options already frozen in this task, exact role session names `gc-pub-release-${{ github.run_id }}-${{ github.run_attempt }}` and `gc-rec-document-worker-release-${{ github.run_id }}-${{ github.run_attempt }}`, role duration 3600, the two exact map paths, fixed file paths, no second credential action, and markers after all bootstrap checks. It also requires each finalize job to depend on exactly its candidate job, checkout the same `github.sha`, verify its four nonempty outputs against allowed grammar, re-fetch the same snapshot/tag, assume only `pub_rec_deployment_authority_workflow_role_arn`, run locked `verify_pub_rec_image_handoff.py`, then locked `fnd_workstream_deploy.py prepare`, `start`, and `wait`. Finalize accepts no artifact download, mutable S3 read, caller/dispatch value, AWS CLI, repository push, or direct ECS/OpenTofu command. A missing/duplicate marker, marker step outside its job, candidate authority invocation, finalize image build/push, cross-domain handoff, or bypassable post-marker verification fails the workflow-security test.

Foundation pre-creates this exact UX web topology. Product may edit exactly the three web marker bodies shown here and its separately frozen Android/iOS marker bodies—five UX markers total:

```yaml
ux_web_plan:
  name: UX web immutable build and plan
  if: ${{ github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v') }}
  runs-on: ubuntu-24.04
  timeout-minutes: 60
  environment: ux-plan-kr
  permissions:
    actions: read
    contents: read
    id-token: write
  concurrency:
    group: ux-web-plan-kr
    cancel-in-progress: false
  outputs:
    handoff_key: ${{ steps.ux_handoff.outputs.handoff_key }}
    handoff_version_id: ${{ steps.ux_handoff.outputs.handoff_version_id }}
    handoff_sha256: ${{ steps.ux_handoff.outputs.handoff_sha256 }}
    plan_key: ${{ steps.ux_handoff.outputs.plan_key }}
    plan_version_id: ${{ steps.ux_handoff.outputs.plan_version_id }}
    plan_sha256: ${{ steps.ux_handoff.outputs.plan_sha256 }}
  steps:
    - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
    - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
      with: {python-version: "3.12.13", cache: ""}
    - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38
      with: {node-version: "24.17.0"}
    - name: Install locked OpenTofu for saved-plan production
      run: |
        python scripts/ci/install_opentofu.py --destination "$GITHUB_WORKSPACE/build/tools/opentofu"
        test "$("$GITHUB_WORKSPACE/build/tools/opentofu/tofu" version | sed -n '1p')" = 'OpenTofu v1.10.6'
        printf 'TOFU=%s\n' "$GITHUB_WORKSPACE/build/tools/opentofu/tofu" >> "$GITHUB_ENV"
    - name: Install locked Buildx and bootstrap the digest-pinned BuildKit builder
      run: |
        python scripts/ci/install_buildx.py --destination "$GITHUB_WORKSPACE/build/tools/docker-cli-plugins"
        export DOCKER_CLI_PLUGIN_EXTRA_DIRS="$GITHUB_WORKSPACE/build/tools/docker-cli-plugins"
        printf 'DOCKER_CLI_PLUGIN_EXTRA_DIRS=%s\n' "$DOCKER_CLI_PLUGIN_EXTRA_DIRS" >> "$GITHUB_ENV"
        docker buildx create --name gc-ux-plan --driver docker-container --driver-opt image=docker.io/moby/buildkit:v0.20.2@sha256:c457984bd29f04d6acc90c8d9e717afe3922ae14665f3187e0096976fe37b1c8 --use
        docker buildx inspect --bootstrap gc-ux-plan
        docker buildx imagetools inspect docker.io/moby/buildkit:v0.20.2@sha256:c457984bd29f04d6acc90c8d9e717afe3922ae14665f3187e0096976fe37b1c8 --raw > build/tools/buildkit-index.json
        python -c "import json; x=json.load(open('build/tools/buildkit-index.json',encoding='utf-8')); rows=[m for m in x['manifests'] if m['platform'].get('architecture')=='amd64' and m['platform'].get('os')=='linux']; assert len(rows)==1 and rows[0]['digest']=='sha256:8c8514715aab54e12f65b6a38a219084ab926d49c52d519ac17a8e79befb9c75'"
        python scripts/ci/install_buildx.py --destination build/tools/buildx-reverify
        cmp "$DOCKER_CLI_PLUGIN_EXTRA_DIRS/docker-buildx" build/tools/buildx-reverify/docker-buildx
        docker buildx version | grep -F 'v0.20.1'
    - uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
      with:
        role-to-assume: ${{ vars.UX_WEB_PLAN_WORKFLOW_ROLE_ARN }}
        aws-region: ap-northeast-2
        audience: sts.amazonaws.com
        mask-aws-account-id: true
        role-duration-seconds: 3600
        role-session-name: gc-ux-web-plan-${{ github.run_id }}-${{ github.run_attempt }}
    - name: Exact-fetch and project foundation outputs for UX plan
      env:
        GC_SNAPSHOT_BUCKET: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME }}
        GC_SNAPSHOT_KEY: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_KEY }}
        GC_SNAPSHOT_VERSION_ID: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID }}
        GC_SNAPSHOT_SHA256: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_SHA256 }}
      run: |
        mkdir -p build/foundation
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py write-coordinate --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --out build/foundation/foundation-output-snapshot.coordinate.json
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py fetch --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --out build/foundation/foundation-outputs.json
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-github-env --snapshot build/foundation/foundation-outputs.json --expected-snapshot-sha256 "$GC_SNAPSHOT_SHA256" --map governance/foundation/ux-foundation-output-env-map.json --github-env "$GITHUB_ENV" --out build/foundation/ux-output-projection.json
    # BEGIN UX WEB PLAN STEPS
    - id: ux_handoff
      name: UX web plan extension point
      run: "true"
    # END UX WEB PLAN STEPS

ux_web_staging:
  name: UX web staging apply and canary
  needs: [ux_web_plan]
  if: ${{ needs.ux_web_plan.result == 'success' }}
  runs-on: ubuntu-24.04
  timeout-minutes: 60
  environment: staging-kr
  permissions:
    actions: read
    contents: read
    id-token: write
  concurrency:
    group: ux-web-staging-kr
    cancel-in-progress: false
  env:
    UX_HANDOFF_KEY: ${{ needs.ux_web_plan.outputs.handoff_key }}
    UX_HANDOFF_VERSION_ID: ${{ needs.ux_web_plan.outputs.handoff_version_id }}
    UX_HANDOFF_SHA256: ${{ needs.ux_web_plan.outputs.handoff_sha256 }}
    UX_PLAN_KEY: ${{ needs.ux_web_plan.outputs.plan_key }}
    UX_PLAN_VERSION_ID: ${{ needs.ux_web_plan.outputs.plan_version_id }}
    UX_PLAN_SHA256: ${{ needs.ux_web_plan.outputs.plan_sha256 }}
  outputs:
    handoff_key: ${{ needs.ux_web_plan.outputs.handoff_key }}
    handoff_version_id: ${{ needs.ux_web_plan.outputs.handoff_version_id }}
    handoff_sha256: ${{ needs.ux_web_plan.outputs.handoff_sha256 }}
    plan_key: ${{ needs.ux_web_plan.outputs.plan_key }}
    plan_version_id: ${{ needs.ux_web_plan.outputs.plan_version_id }}
    plan_sha256: ${{ needs.ux_web_plan.outputs.plan_sha256 }}
    staging_result_key: ${{ steps.ux_staging_result.outputs.staging_result_key }}
    staging_result_version_id: ${{ steps.ux_staging_result.outputs.staging_result_version_id }}
    staging_result_sha256: ${{ steps.ux_staging_result.outputs.staging_result_sha256 }}
  steps:
    - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
    - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
      with: {python-version: "3.12.13", cache: ""}
    - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38
      with: {node-version: "24.17.0"}
    - uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
      with:
        role-to-assume: ${{ vars.UX_WEB_STAGING_WORKFLOW_ROLE_ARN }}
        aws-region: ap-northeast-2
        audience: sts.amazonaws.com
        mask-aws-account-id: true
        role-duration-seconds: 3600
        role-session-name: gc-ux-web-staging-${{ github.run_id }}-${{ github.run_attempt }}
    - name: Exact-fetch and project foundation outputs for UX staging
      env:
        GC_SNAPSHOT_BUCKET: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME }}
        GC_SNAPSHOT_KEY: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_KEY }}
        GC_SNAPSHOT_VERSION_ID: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID }}
        GC_SNAPSHOT_SHA256: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_SHA256 }}
      run: |
        mkdir -p build/foundation
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py write-coordinate --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --out build/foundation/foundation-output-snapshot.coordinate.json
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py fetch --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --out build/foundation/foundation-outputs.json
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-github-env --snapshot build/foundation/foundation-outputs.json --expected-snapshot-sha256 "$GC_SNAPSHOT_SHA256" --map governance/foundation/ux-foundation-output-env-map.json --github-env "$GITHUB_ENV" --out build/foundation/ux-output-projection.json
    # BEGIN UX WEB STAGING STEPS
    - id: ux_staging_result
      name: UX web staging extension point
      run: "true"
    # END UX WEB STAGING STEPS

ux_web_release:
  name: UX web production promotion
  needs: [ux_web_staging]
  if: ${{ needs.ux_web_staging.result == 'success' }}
  runs-on: ubuntu-24.04
  timeout-minutes: 45
  environment: production-kr
  permissions:
    contents: read
    id-token: write
  concurrency:
    group: ux-web-release-kr-prod
    cancel-in-progress: false
  env:
    UX_HANDOFF_KEY: ${{ needs.ux_web_staging.outputs.handoff_key }}
    UX_HANDOFF_VERSION_ID: ${{ needs.ux_web_staging.outputs.handoff_version_id }}
    UX_HANDOFF_SHA256: ${{ needs.ux_web_staging.outputs.handoff_sha256 }}
    UX_PLAN_KEY: ${{ needs.ux_web_staging.outputs.plan_key }}
    UX_PLAN_VERSION_ID: ${{ needs.ux_web_staging.outputs.plan_version_id }}
    UX_PLAN_SHA256: ${{ needs.ux_web_staging.outputs.plan_sha256 }}
    UX_STAGING_RESULT_KEY: ${{ needs.ux_web_staging.outputs.staging_result_key }}
    UX_STAGING_RESULT_VERSION_ID: ${{ needs.ux_web_staging.outputs.staging_result_version_id }}
    UX_STAGING_RESULT_SHA256: ${{ needs.ux_web_staging.outputs.staging_result_sha256 }}
  steps:
    - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
    - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
      with: {python-version: "3.12.13", cache: ""}
    - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38
      with: {node-version: "24.17.0"}
    - uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
      with:
        role-to-assume: ${{ vars.UX_WEB_RELEASE_WORKFLOW_ROLE_ARN }}
        aws-region: ap-northeast-2
        audience: sts.amazonaws.com
        mask-aws-account-id: true
        role-duration-seconds: 3600
        role-session-name: gc-ux-web-release-${{ github.run_id }}-${{ github.run_attempt }}
    - name: Exact-fetch and project foundation outputs for UX release
      env:
        GC_SNAPSHOT_BUCKET: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME }}
        GC_SNAPSHOT_KEY: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_KEY }}
        GC_SNAPSHOT_VERSION_ID: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID }}
        GC_SNAPSHOT_SHA256: ${{ vars.FOUNDATION_OUTPUTS_SNAPSHOT_SHA256 }}
      run: |
        mkdir -p build/foundation
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py write-coordinate --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --out build/foundation/foundation-output-snapshot.coordinate.json
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py fetch --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --out build/foundation/foundation-outputs.json
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-github-env --snapshot build/foundation/foundation-outputs.json --expected-snapshot-sha256 "$GC_SNAPSHOT_SHA256" --map governance/foundation/ux-foundation-output-env-map.json --github-env "$GITHUB_ENV" --out build/foundation/ux-output-projection.json
    # BEGIN UX WEB RELEASE STEPS
    - name: UX web production extension point
      run: "true"
    # END UX WEB RELEASE STEPS

ux_android_release:
  name: UX Android unsigned candidate
  needs: [ux_web_release]
  if: ${{ needs.ux_web_release.result == 'success' }}
  runs-on: ubuntu-24.04
  timeout-minutes: 60
  environment: production-kr
  permissions: {contents: read}
  concurrency: {group: ux-android-release-kr, cancel-in-progress: false}
  steps:
    - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
    - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
      with: {python-version: "3.12.13", cache: ""}
    - uses: actions/setup-java@cf277c60eb25467037889841efdb72551f06f6c3
      with: {distribution: temurin, java-version: "21.0.8+9", cache: gradle}
    - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38
      with: {node-version: "24.17.0"}
    - uses: subosito/flutter-action@1a449444c387b1966244ae4d4f8c696479add0b2
      with: {flutter-version: "3.44.7", channel: stable, cache: true}
    - name: Install locked Android API 35 SDK and Product AVD
      run: |
        python scripts/ci/install_android_sdk.py --profile api35-google-apis-x86_64 --destination "$GITHUB_WORKSPACE/build/tools/android-sdk" --avd-destination "$GITHUB_WORKSPACE/build/tools/android-avd" --avd-name gc_api35
        printf 'ANDROID_SDK_ROOT=%s\nANDROID_HOME=%s\nANDROID_AVD_HOME=%s\n' "$GITHUB_WORKSPACE/build/tools/android-sdk" "$GITHUB_WORKSPACE/build/tools/android-sdk" "$GITHUB_WORKSPACE/build/tools/android-avd" >> "$GITHUB_ENV"
    # BEGIN UX ANDROID RELEASE STEPS
    - name: UX Android release extension point
      run: "true"
    # END UX ANDROID RELEASE STEPS

ux_ios_release:
  name: UX iOS no-codesign candidate
  needs: [ux_web_release]
  if: ${{ needs.ux_web_release.result == 'success' }}
  runs-on: macos-15
  timeout-minutes: 60
  environment: production-kr
  permissions: {contents: read}
  concurrency: {group: ux-ios-release-kr, cancel-in-progress: false}
  steps:
    - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
    - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
      with: {python-version: "3.12.13", cache: ""}
    - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38
      with: {node-version: "24.17.0"}
    - uses: subosito/flutter-action@1a449444c387b1966244ae4d4f8c696479add0b2
      with: {flutter-version: "3.44.7", channel: stable, cache: true}
    - name: Require Xcode 16.4
      run: test "$(xcodebuild -version | tr '\n' ' ')" = "Xcode 16.4 Build version 16F6 "
    # BEGIN UX IOS RELEASE STEPS
    - name: UX iOS release extension point
      run: "true"
    # END UX IOS RELEASE STEPS
```

`ux_web_plan` alone assumes `ux_web_plan_workflow_role_arn`; it builds/pushes/signs only the two FND repository images with the FND-installed Cosign/new-format bundle contract, invokes the FND provider builder, uploads the unchanged provider ZIP, and writes the immutable plan bundle/handoff/fault objects, but has no backend/apply/deploy permission. Its fixed marker step ID `ux_handoff` emits only the six nonempty handoff/plan-bundle coordinate scalars shown; the fault coordinate is nested in the verified handoff and is deliberately not a job output or ambient environment value. `ux_web_staging` receives those six values only through FND mapping, exact-fetches the handoff to derive its nested fault coordinate, and calls `ux_deployment_authority.py stage`; the FND state machine owns apply, healthy baseline, the normative `InjectStagingSyntheticSmoke503` Pass state, exact-prior rollback proof, re-promotion, and the Object-Locked `ux-staging-result.v1`. A single synthetic 5xx is never claimed to trip ECS deployment circuit breaker. The staging object is exactly `{schemaVersion:"ux-staging-result.v1",sourceSha,tagVerificationSha256,handoff:{key,versionId,sha256},planBundle:{key,versionId,sha256},applyReceipt:{key,versionId,sha256},deploymentResult:{key,versionId,sha256},handoffSha256,planSha256,bffImageDigest,collectorImageDigest,smokeSha256,rollbackSha256,completedAt,resultSha256}`. The state machine creates it only after the current execution's image-trust-bound apply receipt and deployment terminal exist; both nested coordinates exact-fetch and cross-bind the same environment, request, source, handoff, plan, candidate/prior tuple, and outcome. This produces the acyclic chain `imageTrust -> applyReceipt -> deploymentResult -> stagingResult -> authorityResult`; an authority result may reference the staging result, but a staging result never references an authority result. Its fixed `ux_staging_result` step only copies the verified FND-returned staging coordinate to job outputs. `ux_web_release` receives the pass-through handoff/plan coordinates plus that result triple, exact-fetches both nested authority coordinates and their full trust/postcondition chain, and calls only `ux_deployment_authority.py promote`; it has no evidence Put/Delete/List, backend access, OpenTofu execution, or direct AWS mutation. FND schema/fixture, state-machine IAM, client, response-loss, and mutation tests reject a missing/swapped/cross-execution nested coordinate, a digest cycle, or production promotion without the complete prior chain.

The staging failure drill is plan-bound rather than a mutable fixture image. `ux-staging-fault-request.v1` is exactly `{schemaVersion,sourceSha,planSha256,faultMode,maxFaultSeconds,expiresAt,requestSha256}` with `additionalProperties=false`, `faultMode="upstream_5xx_once"`, `maxFaultSeconds` from 1 through 60, UTC `Z` expiry within the staging window, and a self-digest omitting only itself. Plan writes it once and binds its coordinate in the handoff; staging exact-fetches it, and only the FND definition's `InjectStagingSyntheticSmoke503` Pass state may produce the one strict synthetic 503 at the smoke-result boundary after a healthy baseline. No Product artifact or AWS resource implements a fault path. The same-definition catch must restore/verify prior state before re-promotion and real smoke. Caller booleans, alternate mode/image/command, production use, second injection, expired replay, network-upstream claim, or missing rollback evidence fails.

The two deployment coordinators are the FND-owned Standard state machines exported above; Product owns no state machine, deploy role, fence, authority task, service shell, or rollback API. Per environment Product owns only the qualified smoke function, immutable task-definition revisions, session table/runtime CMK, application/EMF log groups, and four alarms, while FND precreates and owns the BFF blue/green plus collector services, its smoke/BFF-task/BFF-execution/collector-task/collector-execution roles, and all edge/network shells. BFF/collector execution roles pull only their approved repository digest and write only fixed groups. BFF task reads only its exact-Version trust bundle and environment session table. The collector task uses pinned awsemf with log group `/gc/ux/<environment>/public-events-emf`, stream `gc-product-collector-<environment>`, namespace `GenomeCompanion/PublicUX`, `NoDimensionRollup`, `retain_initial_value_of_delta_metric=true`, and `skip_create_log_group=true`; its role has only `logs:CreateLogStream|DescribeLogStreams|PutLogEvents` on that exact group/stream through the Logs endpoint, with `CreateLogGroup`, `/metrics/default`, another stream, and every generic CloudWatch metric API denied. It exposes aggregate accepted/dropped self-metrics on 8888 only to the matching FND smoke SG. No runtime role can assume/pass a role or mutate AWS.

Both workflow markers call only the FND `ux_deployment_authority.py` client: staging passes exact handoff/plan-bundle/snapshot/fault coordinates and production passes exact handoff/plan-bundle/snapshot/staging-result coordinates. The fixed client chooses the projected state-machine ARN, constructs stable request bytes, and returns the verified result chain; no Product `apply-or-verify` or canary script is authoritative or directly invoked by the workflow. The staging marker's fixed `ux_staging_result` step emits the exact FND-created staging-result coordinate; production has no result writer. Workflow IAM is exact `states:StartExecution|DescribeExecution` plus exact-Version evidence reads only. Verifier tests require FND ownership, five precreated Product roles, provider ZIP binding, callback/token channel, claim-before-apply order, result/staging transitive chain, EMF settings/IAM, no WAF request log, and denial of direct OpenTofu/ECS/ELB/IAM/Route53/WAF/Lambda/DDB/KMS mutation.

`ux_android_release` and `ux_ios_release` are concrete foundation-owned jobs, not prose markers. Both require successful `ux_web_release`, the protected `production-kr` environment, full/tagged checkout with credential persistence disabled, Python 3.12.13, Node 24.17.0, Flutter 3.44.7, locked dependencies, and one ordered marker pair. Android additionally pins Temurin 21.0.8+9 on `ubuntu-24.04`; before its marker, FND invokes the sole locked installer to materialize API 35/platform revision 2, build-tools 35.0.0, platform-tools 37.0.1, emulator 37.2.3, google_apis x86_64 image revision 9, and AVD `gc_api35`, then exports only those absolute SDK/AVD paths. The marker may start the locked emulator, use those tools, and invoke FND's unchanged `install_bundletool.py` once into a new destination, but may not invoke `sdkmanager`, accept licenses, download/install another Android component, use `cmdline-tools/latest`, or change the AVD/profile. iOS runs only on `macos-15` and fails unless Xcode is exactly 16.4 (build 16F6). All pinned runtime setup remains outside Product-editable markers. Neither job has `id-token:write`, AWS credentials, store credential, signing identity, upload/notarize/publish permission, nor a claim of bit reproducibility. The verifier rejects a missing job/marker/setup pin, runner drift, retained checkout credentials, mutable/network-fetched tool outside a FND locked installer, signed/store artifact action, or Product edit outside the five UX marker bodies.

Foundation also pre-creates the generic signing and signer-key ceremony workflows required by Task 3 before any AI workstream exists. They are ordinary `workflow_dispatch` workflows, never `workflow_call`; each has `permissions:{}` at workflow scope, one `ubuntu-24.04` job, a 15-minute timeout (30 minutes for either invoke job), `contents:read` plus `id-token:write`, a pinned checkout with exactly `fetch-depth:0`, `fetch-tags:true`, and `persist-credentials:false`, a distinct protected environment/concurrency group, and exactly one FND-owned marker body. Their exact contracts are:

| File | Job ID / marker | Protected environment / assumed role | Exact dispatch inputs |
|---|---|---|---|
| `.github/workflows/ai-artifact-signing-stage.yml` | `ai_artifact_signing_stage`; `BEGIN/END AI ARTIFACT SIGNING STAGE STEPS` | `ai-artifact-signing-stage-kr`; `ai_artifact_signing_publisher_role_arn` | `source_key`, `source_version_id`, `source_sha256`, `evidence_key`, `evidence_version_id`, `evidence_sha256`; `source_*` is always an exact `ai-artifact-signing-proposal.v1` coordinate |
| `.github/workflows/ai-artifact-signing-domain-approve.yml` | `ai_artifact_signing_domain_approval`; `BEGIN/END AI ARTIFACT SIGNING DOMAIN APPROVAL STEPS` | `ai-artifact-signing-domain-approval-kr`; `ai_artifact_signing_domain_approval_role_arn` | `core_key`, `core_version_id`, `core_sha256`, `evidence_key`, `evidence_version_id`, `evidence_sha256` |
| `.github/workflows/ai-artifact-signing-security-approve.yml` | `ai_artifact_signing_security_approval`; `BEGIN/END AI ARTIFACT SIGNING SECURITY APPROVAL STEPS` | `ai-artifact-signing-security-approval-kr`; `ai_artifact_signing_security_approval_role_arn` | the identical six coordinate scalars |
| `.github/workflows/ai-artifact-signing-invoke.yml` | `ai_artifact_signing_invoke`; `BEGIN/END AI ARTIFACT SIGNING INVOKE STEPS` | `ai-artifact-signing-invoke-kr`; `ai_artifact_signing_invoker_role_arn` | exact `core_*`, `domain_receipt_*`, and `security_receipt_*` key/VersionId/SHA-256 triples |
| `.github/workflows/ai-artifact-key-ceremony-stage.yml` | `ai_artifact_key_ceremony_stage`; `BEGIN/END AI ARTIFACT KEY CEREMONY STAGE STEPS` | `ai-artifact-key-ceremony-stage-kr`; `ai_artifact_key_ceremony_stage_workflow_role_arn` | `operation`, `domain`, `expected_bundle_version_id`, `expected_bundle_sha256`, `evidence_key`, `evidence_version_id`, `evidence_sha256` |
| `.github/workflows/ai-artifact-key-custodian-approve.yml` | `ai_artifact_key_custodian_approval`; `BEGIN/END AI ARTIFACT KEY CUSTODIAN APPROVAL STEPS` | `ai-artifact-key-custodian-approval-kr`; `ai_artifact_key_custodian_approval_workflow_role_arn` | exact `core_*` and `evidence_*` triples |
| `.github/workflows/ai-artifact-key-security-approve.yml` | `ai_artifact_key_security_approval`; `BEGIN/END AI ARTIFACT KEY SECURITY APPROVAL STEPS` | `ai-artifact-key-security-approval-kr`; `ai_artifact_key_security_approval_workflow_role_arn` | exact `core_*` and `evidence_*` triples |
| `.github/workflows/ai-artifact-key-ceremony-invoke.yml` | `ai_artifact_key_ceremony_invoke`; `BEGIN/END AI ARTIFACT KEY CEREMONY INVOKE STEPS` | `ai-artifact-key-ceremony-invoke-kr`; `ai_artifact_key_ceremony_invoke_workflow_role_arn` | exact `core_*`, `key_custodian_receipt_*`, and `security_receipt_*` triples |

Every `*_key` matches a closed content-addressed prefix, every VersionId and lowercase `sha256:` digest is mandatory, and no input accepts JSON, an ARN, actor/run, mode, prefix, bucket, provider, or private bytes. For key bootstrap `operation=bootstrap-all`, `domain=all`, and both expected-bundle scalars are the exact empty string that the stage handler alone maps to JSON null; rotation/revocation require one table domain and nonempty current VersionId/digest. Stage bodies call only the closed `stage` subcommand of `scripts/security/ai_artifact_signing_ceremony.py` or `scripts/security/ai_artifact_key_ceremony.py`, using the table's exact projected scalar names; approval bodies obtain a fresh OIDC token for their hard-coded audience and invoke only their fixed immutable alias; invoke bodies call only the corresponding closed `invoke` or `verify` subcommand. The key invoke role can invoke only `ai_artifact_key_ceremony_broker_alias_arn`, never Step Functions directly. Each run writes one immutable coordinate record with source SHA/workflow SHA/run attempt; later workflows exact-fetch rather than use GitHub artifacts or `needs`. Domain, security, custodian, stage, and invoke principals are disjoint, approval actors differ, and neither approval role can stage/invoke. `verify_workflow_security.py` asserts every file/job/input/environment/role/marker/concurrency tuple, fixed alias call, no same-run chain, and no caller-authored identity or unqualified function.

All eight generic signing/key-ceremony jobs perform the same foundation-owned pre-marker bootstrap: pinned `actions/checkout` with full tags and `persist-credentials:false`, pinned `actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1` with `python-version: 3.12.13`, the exact fixed AWS credential step, and then `python scripts/ci/run_locked_uv.py -- --version` before any ceremony command. They never use ambient `python`, bare `uv`, a managed Python download, a caller-selected interpreter, or a setup step inside the editable marker. `verify_workflow_security.py` rejects any of those eight files when setup-python is missing/reordered, the patch differs, `UV_PYTHON_DOWNLOADS=never` is not enforced by the launcher, or a marker begins before the verified launcher check.

Each of these eight workflow skeletons contains the exact pinned credential step described above, with `role-to-assume` fixed to the table's role through its protected environment variable, 1,800-second duration, Seoul region, STS audience, and job-derived session name. Its first marker step declares an explicit `env:` mapping for every table input using the same uppercase scalar name and invokes the closed CLI with only those names; no body reads `${{ github.event.inputs.* }}` directly, an ambient duplicate, or an unprojected foundation output. The verifier mutation-tests every role/input/alias/session mapping and rejects a missing configure step, wrong role, second assume, caller ARN, input interpolation outside that one env block, or marker access before the mapping.

Foundation owns the pre-plan causality boundary too; an AI plan can consume only an intent created from the draft committed under the same verified tag:

```yaml
# .github/workflows/ai-promotion-intent.yml
on:
  workflow_dispatch:
    inputs:
      signed_tag: {required: true, type: string}
permissions: {}
jobs:
  ai_promotion_intent:
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    environment: ai-promotion-intent-kr
    permissions: {contents: read, id-token: write}
    concurrency: {group: ai-promotion-intent-kr, cancel-in-progress: false}
    outputs:
      promotion_intent_key: ${{ steps.promotion.outputs.promotion_intent_key }}
      promotion_intent_version_id: ${{ steps.promotion.outputs.promotion_intent_version_id }}
      promotion_intent_sha256: ${{ steps.promotion.outputs.promotion_intent_sha256 }}
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
      - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
        with: {python-version: "3.12.13", cache: ""}
      - uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
        with:
          role-to-assume: ${{ vars.AI_PROMOTION_INTENT_WORKFLOW_ROLE_ARN }}
          aws-region: ap-northeast-2
          audience: sts.amazonaws.com
          role-session-name: gc-ai-promotion-intent-${{ github.run_id }}-${{ github.run_attempt }}
          role-duration-seconds: 3600
          mask-aws-account-id: true
      - name: Exact-fetch foundation outputs and project signed tag
        env:
          GC_SNAPSHOT_BUCKET: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME }}
          GC_SNAPSHOT_KEY: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_KEY }}
          GC_SNAPSHOT_VERSION_ID: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID }}
          GC_SNAPSHOT_SHA256: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_SHA256 }}
          GC_INPUT_SIGNED_TAG: ${{ inputs.signed_tag }}
        run: |
          mkdir -p build/foundation build/promotion
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py fetch --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --out build/foundation/foundation-outputs.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-github-env --snapshot build/foundation/foundation-outputs.json --expected-snapshot-sha256 "$GC_SNAPSHOT_SHA256" --map governance/foundation/ai-foundation-output-env-map.json --github-env "$GITHUB_ENV" --out build/foundation/output-projection.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-dispatch-env --profile ai-promotion-intent --github-env "$GITHUB_ENV" --out build/foundation/input-projection.json
      - name: Publish immutable promotion intent from signed source draft
        id: promotion
        run: |
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_promotion_intent.py publish --signed-tag "$AI_SIGNED_TAG" --snapshot build/foundation/foundation-outputs.json --tag-verification-out build/promotion/tag-verification.coordinate.json --source-out build/promotion/source.coordinate.json --intent-out build/promotion/intent.coordinate.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_promotion_intent.py emit-handoff --intent build/promotion/intent.coordinate.json --github-output "$GITHUB_OUTPUT" --step-summary "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: ai-promotion-intent-coordinate-${{ github.run_id }}-${{ github.run_attempt }}
          path: build/promotion/intent.coordinate.json
          if-no-files-found: error
          retention-days: 7
```

`ai_promotion_intent_workflow_role_arn` trusts only this exact workflow/repository/ref/environment and may exact-version read the protected foundation snapshot plus the closed governance/signing/prepared-pair prefixes referenced by the signed draft, and may checksum/Object-Lock write only tag-verification, promotion-source, and promotion-intent content-addressed prefixes. It cannot list, choose `AWSCURRENT`, sign, approve, plan, push an image, reserve, deploy, or write control state. `emit-handoff` strict-validates the local coordinate then appends only `promotion_intent_key`, `promotion_intent_version_id`, and `promotion_intent_sha256` to the supplied existing `GITHUB_OUTPUT` and a nonsecret canonical three-line summary to `GITHUB_STEP_SUMMARY`, rejecting controls/newlines/symlinks/duplicates; the uploaded coordinate is convenience only. The operator dispatches `ai-plan` with those exact scalars, and `ai-plan` exact-fetches the Object-Lock VersionId/digest. Workflow tests require the exact job/input/runner/timeout/environment/permissions/concurrency/checkout/Python/credential/projection/output commands and reject another draft path, worktree draft, unpeeled tag, caller source/time, missing/duplicate coordinate, output injection, or mutable result.

The AI plan boundary uses three separate foundation-owned workflow files plus `release.yml`. Their ordinary jobs—not reusable workflows—are exactly:

```yaml
# .github/workflows/ai-plan.yml
on:
  workflow_dispatch:
    inputs:
      promotion_intent_key: {required: true, type: string}
      promotion_intent_version_id: {required: true, type: string}
      promotion_intent_sha256: {required: true, type: string}
permissions: {}
jobs:
  ai_plan:
    runs-on: ubuntu-24.04
    timeout-minutes: 45
    environment: ai-plan-kr
    permissions: {contents: read, id-token: write}
    concurrency: {group: ai-plan-kr, cancel-in-progress: false}
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
      - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
        with: {python-version: "3.12.13", cache: ""}
      - uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
        with:
          role-to-assume: ${{ vars.AI_PLAN_WORKFLOW_ROLE_ARN }}
          aws-region: ap-northeast-2
          audience: sts.amazonaws.com
          role-session-name: gc-ai-plan-${{ github.run_id }}-${{ github.run_attempt }}
          role-duration-seconds: 3600
          mask-aws-account-id: true
      - name: Exact-fetch foundation outputs and project plan inputs
        env:
          GC_SNAPSHOT_BUCKET: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME }}
          GC_SNAPSHOT_KEY: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_KEY }}
          GC_SNAPSHOT_VERSION_ID: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID }}
          GC_SNAPSHOT_SHA256: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_SHA256 }}
          GC_INPUT_PROMOTION_INTENT_KEY: ${{ inputs.promotion_intent_key }}
          GC_INPUT_PROMOTION_INTENT_VERSION_ID: ${{ inputs.promotion_intent_version_id }}
          GC_INPUT_PROMOTION_INTENT_SHA256: ${{ inputs.promotion_intent_sha256 }}
        run: |
          mkdir -p build/foundation
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py fetch --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --out build/foundation/foundation-outputs.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-github-env --snapshot build/foundation/foundation-outputs.json --expected-snapshot-sha256 "$GC_SNAPSHOT_SHA256" --map governance/foundation/ai-foundation-output-env-map.json --github-env "$GITHUB_ENV" --out build/foundation/output-projection.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-ai-self-coordinate-env --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --github-env "$GITHUB_ENV" --out build/foundation/self-coordinate-projection.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-dispatch-env --profile ai-plan --github-env "$GITHUB_ENV" --out build/foundation/input-projection.json
      - name: Project protected telemetry bootstrap handoff
        env:
          GC_TELEMETRY_HANDOFF_KEY: ${{ vars.TELEMETRY_IDENTITY_BOOTSTRAP_HANDOFF_KEY }}
          GC_TELEMETRY_HANDOFF_VERSION_ID: ${{ vars.TELEMETRY_IDENTITY_BOOTSTRAP_HANDOFF_VERSION_ID }}
          GC_TELEMETRY_HANDOFF_SHA256: ${{ vars.TELEMETRY_IDENTITY_BOOTSTRAP_HANDOFF_SHA256 }}
          GC_TELEMETRY_VERIFICATION_SHA256: ${{ vars.TELEMETRY_IDENTITY_BOOTSTRAP_VERIFICATION_SHA256 }}
        run: |
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py project-ai-plan-env \
            --handoff-key "$GC_TELEMETRY_HANDOFF_KEY" \
            --handoff-version-id "$GC_TELEMETRY_HANDOFF_VERSION_ID" \
            --handoff-sha256 "$GC_TELEMETRY_HANDOFF_SHA256" \
            --verification-sha256 "$GC_TELEMETRY_VERIFICATION_SHA256" \
            --github-env "$GITHUB_ENV" \
            --out build/foundation/telemetry-bootstrap-projection.json
      - name: Verify promotion intent, source, and signed tag from exact bytes
        run: |
          test "sha256:$(sha256sum scripts/release/ai_release_authority.py | cut -d' ' -f1)" = "$AI_RELEASE_AUTHORITY_CLIENT_SHA256"
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_promotion_intent.py verify --intent-key "$AI_PROMOTION_INTENT_KEY" --intent-version-id "$AI_PROMOTION_INTENT_VERSION_ID" --intent-sha256 "$AI_PROMOTION_INTENT_SHA256" --snapshot build/foundation/foundation-outputs.json --expected-checkout-sha "$(git rev-parse HEAD)" --out-dir build/promotion/verified
      # BEGIN AI PLAN STEPS
      - name: AI plan extension point
        run: "true"
      # END AI PLAN STEPS
```

The workflow-security and telemetry-bootstrap tests require this exact four-variable `env:` map, the single `project-ai-plan-env` call before the AI marker, the absent canonical projection output, and byte-equality between the protected verification digest and the later verifier summary. They remove or substitute every mapping, introduce control/newline/duplicate values, rename a destination variable, or bypass the projector and require failure; no `${{ vars.* }}` expression for these values may appear inside the AI-owned marker.

```yaml
# .github/workflows/ai-plan-domain-approve.yml
on:
  workflow_dispatch:
    inputs:
      request_key: {required: true, type: string}
      request_version_id: {required: true, type: string}
      request_sha256: {required: true, type: string}
permissions: {}
jobs:
  ai_plan_domain_approval:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    environment: ai-plan-domain-approval-kr
    permissions: {contents: read, id-token: write}
    concurrency: {group: ai-plan-domain-approval-kr, cancel-in-progress: false}
    env:
      AI_PLAN_DOMAIN_APPROVAL_VERIFIER_ALIAS_ARN: ${{ vars.AI_PLAN_DOMAIN_APPROVAL_VERIFIER_ALIAS_ARN }}
      AI_PLAN_DOMAIN_APPROVAL_OIDC_AUDIENCE: gc-ai-plan-domain-approval-v1
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
      - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
        with: {python-version: "3.12.13", cache: ""}
      - uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
        with:
          role-to-assume: ${{ vars.AI_PLAN_DOMAIN_APPROVAL_WORKFLOW_ROLE_ARN }}
          aws-region: ap-northeast-2
          audience: sts.amazonaws.com
          role-session-name: gc-ai-plan-domain-approval-${{ github.run_id }}-${{ github.run_attempt }}
          role-duration-seconds: 1800
          mask-aws-account-id: true
      - name: Project exact plan-request inputs
        env:
          GC_INPUT_REQUEST_KEY: ${{ inputs.request_key }}
          GC_INPUT_REQUEST_VERSION_ID: ${{ inputs.request_version_id }}
          GC_INPUT_REQUEST_SHA256: ${{ inputs.request_sha256 }}
        run: |
          mkdir -p build
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-dispatch-env --profile ai-plan-domain-approval --github-env "$GITHUB_ENV" --out build/ai-plan-domain-input-projection.json
      # BEGIN AI PLAN DOMAIN APPROVAL STEPS
      - name: AI plan domain approval extension point
        run: "true"
      # END AI PLAN DOMAIN APPROVAL STEPS
```

```yaml
# .github/workflows/ai-plan-security-approve.yml
on:
  workflow_dispatch:
    inputs:
      request_key: {required: true, type: string}
      request_version_id: {required: true, type: string}
      request_sha256: {required: true, type: string}
permissions: {}
jobs:
  ai_plan_security_approval:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    environment: ai-plan-security-approval-kr
    permissions: {contents: read, id-token: write}
    concurrency: {group: ai-plan-security-approval-kr, cancel-in-progress: false}
    env:
      AI_PLAN_SECURITY_APPROVAL_VERIFIER_ALIAS_ARN: ${{ vars.AI_PLAN_SECURITY_APPROVAL_VERIFIER_ALIAS_ARN }}
      AI_PLAN_SECURITY_APPROVAL_OIDC_AUDIENCE: gc-ai-plan-security-approval-v1
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
      - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
        with: {python-version: "3.12.13", cache: ""}
      - uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
        with:
          role-to-assume: ${{ vars.AI_PLAN_SECURITY_APPROVAL_WORKFLOW_ROLE_ARN }}
          aws-region: ap-northeast-2
          audience: sts.amazonaws.com
          role-session-name: gc-ai-plan-security-approval-${{ github.run_id }}-${{ github.run_attempt }}
          role-duration-seconds: 1800
          mask-aws-account-id: true
      - name: Project exact plan-request inputs
        env:
          GC_INPUT_REQUEST_KEY: ${{ inputs.request_key }}
          GC_INPUT_REQUEST_VERSION_ID: ${{ inputs.request_version_id }}
          GC_INPUT_REQUEST_SHA256: ${{ inputs.request_sha256 }}
        run: |
          mkdir -p build
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-dispatch-env --profile ai-plan-security-approval --github-env "$GITHUB_ENV" --out build/ai-plan-security-input-projection.json
      # BEGIN AI PLAN SECURITY APPROVAL STEPS
      - name: AI plan security approval extension point
        run: "true"
      # END AI PLAN SECURITY APPROVAL STEPS
```

The production-evaluation bootstrap is wholly FND-owned; it has no AI-editable marker. Its dispatch surface is six immutable result/envelope coordinates, never artifact bodies, bucket names, root values, state, expected sequence, or timestamps:

```yaml
# .github/workflows/ai-production-evaluation-bootstrap.yml
on:
  workflow_dispatch:
    inputs:
      registry_result_key: {required: true, type: string}
      registry_result_version_id: {required: true, type: string}
      registry_result_sha256: {required: true, type: string}
      registry_envelope_key: {required: true, type: string}
      registry_envelope_version_id: {required: true, type: string}
      registry_envelope_sha256: {required: true, type: string}
      bundle_result_key: {required: true, type: string}
      bundle_result_version_id: {required: true, type: string}
      bundle_result_sha256: {required: true, type: string}
      bundle_envelope_key: {required: true, type: string}
      bundle_envelope_version_id: {required: true, type: string}
      bundle_envelope_sha256: {required: true, type: string}
      corpus_result_key: {required: true, type: string}
      corpus_result_version_id: {required: true, type: string}
      corpus_result_sha256: {required: true, type: string}
      corpus_envelope_key: {required: true, type: string}
      corpus_envelope_version_id: {required: true, type: string}
      corpus_envelope_sha256: {required: true, type: string}
permissions: {}
jobs:
  ai_production_evaluation_bootstrap:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    environment: ai-production-evaluation-bootstrap-kr
    permissions: {contents: read, id-token: write}
    concurrency: {group: ai-production-evaluation-bootstrap-kr, cancel-in-progress: false}
    env:
      UV_PYTHON_DOWNLOADS: never
      AI_PRODUCTION_EVALUATION_BOOTSTRAP_OIDC_AUDIENCE: gc-ai-production-evaluation-bootstrap-v1
      AI_FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME }}
      AI_FOUNDATION_OUTPUTS_SNAPSHOT_KEY: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_KEY }}
      AI_FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID }}
      AI_FOUNDATION_OUTPUTS_SNAPSHOT_SHA256: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_SHA256 }}
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
      - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
        with: {python-version: "3.12.13", cache: ""}
      - name: Install the FND-locked uv runtime
        shell: bash
        run: |
          set -Eeuo pipefail
          test "$(python --version 2>&1)" = "Python 3.12.13"
          test "$(uname -s)-$(uname -m)" = "Linux-x86_64"
          export UV_PYTHON_DOWNLOADS=never
          python scripts/ci/install_uv.py --platform linux-x86_64 --destination build/tools/uv/linux-x86_64
          python scripts/ci/run_locked_uv.py -- --version
      - uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
        with:
          role-to-assume: ${{ vars.AI_PRODUCTION_EVALUATION_BOOTSTRAP_WORKFLOW_ROLE_ARN }}
          aws-region: ap-northeast-2
          audience: sts.amazonaws.com
          role-session-name: gc-ai-production-evaluation-bootstrap-${{ github.run_id }}-${{ github.run_attempt }}
          role-duration-seconds: 1800
          mask-aws-account-id: true
      - name: Prepare, invoke, and verify the fixed bootstrap authority
        env:
          GC_REGISTRY_RESULT_KEY: ${{ inputs.registry_result_key }}
          GC_REGISTRY_RESULT_VERSION_ID: ${{ inputs.registry_result_version_id }}
          GC_REGISTRY_RESULT_SHA256: ${{ inputs.registry_result_sha256 }}
          GC_REGISTRY_ENVELOPE_KEY: ${{ inputs.registry_envelope_key }}
          GC_REGISTRY_ENVELOPE_VERSION_ID: ${{ inputs.registry_envelope_version_id }}
          GC_REGISTRY_ENVELOPE_SHA256: ${{ inputs.registry_envelope_sha256 }}
          GC_BUNDLE_RESULT_KEY: ${{ inputs.bundle_result_key }}
          GC_BUNDLE_RESULT_VERSION_ID: ${{ inputs.bundle_result_version_id }}
          GC_BUNDLE_RESULT_SHA256: ${{ inputs.bundle_result_sha256 }}
          GC_BUNDLE_ENVELOPE_KEY: ${{ inputs.bundle_envelope_key }}
          GC_BUNDLE_ENVELOPE_VERSION_ID: ${{ inputs.bundle_envelope_version_id }}
          GC_BUNDLE_ENVELOPE_SHA256: ${{ inputs.bundle_envelope_sha256 }}
          GC_CORPUS_RESULT_KEY: ${{ inputs.corpus_result_key }}
          GC_CORPUS_RESULT_VERSION_ID: ${{ inputs.corpus_result_version_id }}
          GC_CORPUS_RESULT_SHA256: ${{ inputs.corpus_result_sha256 }}
          GC_CORPUS_ENVELOPE_KEY: ${{ inputs.corpus_envelope_key }}
          GC_CORPUS_ENVELOPE_VERSION_ID: ${{ inputs.corpus_envelope_version_id }}
          GC_CORPUS_ENVELOPE_SHA256: ${{ inputs.corpus_envelope_sha256 }}
        shell: bash
        run: |
          set -Eeuo pipefail
          test "$(python --version 2>&1)" = "Python 3.12.13"
          mkdir -p build/foundation build/security/ai-production-evaluation-bootstrap
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py fetch --bucket "$AI_FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME" --key "$AI_FOUNDATION_OUTPUTS_SNAPSHOT_KEY" --version-id "$AI_FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID" --sha256 "$AI_FOUNDATION_OUTPUTS_SNAPSHOT_SHA256" --out build/foundation/foundation-outputs.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_production_evaluation_bootstrap.py project-dispatch --registry-result-key "$GC_REGISTRY_RESULT_KEY" --registry-result-version-id "$GC_REGISTRY_RESULT_VERSION_ID" --registry-result-sha256 "$GC_REGISTRY_RESULT_SHA256" --registry-envelope-key "$GC_REGISTRY_ENVELOPE_KEY" --registry-envelope-version-id "$GC_REGISTRY_ENVELOPE_VERSION_ID" --registry-envelope-sha256 "$GC_REGISTRY_ENVELOPE_SHA256" --bundle-result-key "$GC_BUNDLE_RESULT_KEY" --bundle-result-version-id "$GC_BUNDLE_RESULT_VERSION_ID" --bundle-result-sha256 "$GC_BUNDLE_RESULT_SHA256" --bundle-envelope-key "$GC_BUNDLE_ENVELOPE_KEY" --bundle-envelope-version-id "$GC_BUNDLE_ENVELOPE_VERSION_ID" --bundle-envelope-sha256 "$GC_BUNDLE_ENVELOPE_SHA256" --corpus-result-key "$GC_CORPUS_RESULT_KEY" --corpus-result-version-id "$GC_CORPUS_RESULT_VERSION_ID" --corpus-result-sha256 "$GC_CORPUS_RESULT_SHA256" --corpus-envelope-key "$GC_CORPUS_ENVELOPE_KEY" --corpus-envelope-version-id "$GC_CORPUS_ENVELOPE_VERSION_ID" --corpus-envelope-sha256 "$GC_CORPUS_ENVELOPE_SHA256" --out-dir build/security/ai-production-evaluation-bootstrap/dispatch
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_production_evaluation_bootstrap.py prepare --snapshot build/foundation/foundation-outputs.json --registry-result-coordinate build/security/ai-production-evaluation-bootstrap/dispatch/registry-result.coordinate.json --registry-envelope-coordinate build/security/ai-production-evaluation-bootstrap/dispatch/registry-envelope.coordinate.json --bundle-result-coordinate build/security/ai-production-evaluation-bootstrap/dispatch/bundle-result.coordinate.json --bundle-envelope-coordinate build/security/ai-production-evaluation-bootstrap/dispatch/bundle-envelope.coordinate.json --corpus-result-coordinate build/security/ai-production-evaluation-bootstrap/dispatch/corpus-result.coordinate.json --corpus-envelope-coordinate build/security/ai-production-evaluation-bootstrap/dispatch/corpus-envelope.coordinate.json --out-dir build/security/ai-production-evaluation-bootstrap
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_production_evaluation_bootstrap.py invoke --snapshot build/foundation/foundation-outputs.json --request-coordinate build/security/ai-production-evaluation-bootstrap/request.coordinate.json --oidc-audience "$AI_PRODUCTION_EVALUATION_BOOTSTRAP_OIDC_AUDIENCE" --out build/security/ai-production-evaluation-bootstrap/result.coordinate.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_production_evaluation_bootstrap.py verify --snapshot build/foundation/foundation-outputs.json --request-coordinate build/security/ai-production-evaluation-bootstrap/request.coordinate.json --result-coordinate build/security/ai-production-evaluation-bootstrap/result.coordinate.json --out build/security/ai-production-evaluation-bootstrap/verified-result.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_production_evaluation_bootstrap.py emit-coordinate --coordinate build/security/ai-production-evaluation-bootstrap/result.coordinate.json --github-output "$GITHUB_OUTPUT" --step-summary "$GITHUB_STEP_SUMMARY"
```

The workflow verifier requires all eighteen inputs to be mapped exactly once into `project-dispatch`, all six generated coordinate files to be consumed exactly once by `prepare`, the snapshot and workflow role to come only from protected variables, the qualified alias to come only from that exact-fetched snapshot, the OIDC audience and workflow identity to be fixed, the locked uv installer to precede credentials on the empty runner, and `project-dispatch` → `prepare` → `invoke` → `verify` → `emit-coordinate` to be contiguous. It rejects an input bucket/ARN/state/sequence/time/body, a marker, another command, missing exact-Version argument, current/List fallback, artifact/test prefix, alternate alias/role, a client/uv invocation before locked installation, or an output containing anything beyond the PHI-free result coordinate. `test_verify_workflow_security.py` creates valid and one-mutation workflow trees and covers every input count/name/mapping, action SHA, job/environment/permission/concurrency value, setup/install/credential order, protected variable, command/subcommand/path/order, marker absence, forbidden ambient alias, output sink, and prohibited permission.

Each OIDC trust binds exact repository ID, protected ref/environment, ordinary `workflow_ref` path@ref, exact 40-hex `workflow_sha`, audience, and job environment. `ai_promotion_intent_workflow_role_arn` may strongly `GetItem` only the six exact artifact keys and active-set key, strongly read the workload signer anchor, and describe only the two fixed AI services/targets to derive `firstInstallState`; it cannot list/scan, write state, update a service, invoke promotion, or accept a caller-selected key. `ai_plan_workflow_role_arn` may exact-version read only the three-input promotion-intent coordinate, the protected control keys, and exact-version S3 inputs enumerated in Task 7C; push immutable digest-addressed worker/collector images only to `ai_worker_repository_url` and `ai_collector_repository_url` (`GetAuthorizationToken` plus layer-upload/`PutImage` on those two repositories); and write one immutable plan/request/evidence set under its exact prefix. It cannot list/select another intent, create/change/delete a repository or tag rule, write control state, approve, reserve, or deploy. The domain/security workflow roles can exact-read that intent/request and invoke only their fixed keyless verifier mode; their teams/principals, audiences, environments, receipt prefixes, and replay partitions are disjoint. Neither can plan, sign, deploy, or write the other receipt. Workflow inputs are only exact coordinate scalars; actor/run/attempt/workflow identity comes solely from the freshly verified OIDC token.

For the fourth cross-run boundary, `release.yml` also has `workflow_dispatch` inputs `request_key`, `request_version_id`, `request_sha256`, `domain_receipt_key`, `domain_receipt_version_id`, `domain_receipt_sha256`, `security_receipt_key`, `security_receipt_version_id`, and `security_receipt_sha256`. The exact request bytes supply the already approved plan/release-bundle coordinates, keeping the interface within GitHub's bounded inputs. Foundation creates the AI job; AI may replace only its marker body:

```yaml
ai_release:
  name: AI release evidence and deploy
  if: ${{ github.event_name == 'workflow_dispatch' }}
  runs-on: ubuntu-24.04
  timeout-minutes: 90
  environment: production-kr
  permissions:
    contents: read
    id-token: write
  concurrency:
    group: ai-release-kr-prod
    cancel-in-progress: false
  steps:
    - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
    - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
      with: {python-version: "3.12.13", cache: ""}
    - uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
      with:
        role-to-assume: ${{ vars.AI_RELEASE_WORKFLOW_ROLE_ARN }}
        aws-region: ap-northeast-2
        audience: sts.amazonaws.com
        role-session-name: gc-ai-release-${{ github.run_id }}-${{ github.run_attempt }}
        role-duration-seconds: 7200
        mask-aws-account-id: true
    - name: Exact-fetch foundation outputs and project release inputs
      env:
        GC_SNAPSHOT_BUCKET: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME }}
        GC_SNAPSHOT_KEY: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_KEY }}
        GC_SNAPSHOT_VERSION_ID: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID }}
        GC_SNAPSHOT_SHA256: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_SHA256 }}
        GC_INPUT_REQUEST_KEY: ${{ inputs.request_key }}
        GC_INPUT_REQUEST_VERSION_ID: ${{ inputs.request_version_id }}
        GC_INPUT_REQUEST_SHA256: ${{ inputs.request_sha256 }}
        GC_INPUT_DOMAIN_RECEIPT_KEY: ${{ inputs.domain_receipt_key }}
        GC_INPUT_DOMAIN_RECEIPT_VERSION_ID: ${{ inputs.domain_receipt_version_id }}
        GC_INPUT_DOMAIN_RECEIPT_SHA256: ${{ inputs.domain_receipt_sha256 }}
        GC_INPUT_SECURITY_RECEIPT_KEY: ${{ inputs.security_receipt_key }}
        GC_INPUT_SECURITY_RECEIPT_VERSION_ID: ${{ inputs.security_receipt_version_id }}
        GC_INPUT_SECURITY_RECEIPT_SHA256: ${{ inputs.security_receipt_sha256 }}
      run: |
        mkdir -p build/foundation
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py fetch --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --out build/foundation/foundation-outputs.json
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-github-env --snapshot build/foundation/foundation-outputs.json --expected-snapshot-sha256 "$GC_SNAPSHOT_SHA256" --map governance/foundation/ai-foundation-output-env-map.json --github-env "$GITHUB_ENV" --out build/foundation/output-projection.json
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-ai-self-coordinate-env --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --github-env "$GITHUB_ENV" --out build/foundation/self-coordinate-projection.json
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-dispatch-env --profile ai-release --github-env "$GITHUB_ENV" --out build/foundation/input-projection.json
    - name: Capture server-verified release workflow identity
      run: python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_release_workflow_identity.py capture --snapshot build/foundation/foundation-outputs.json --out build/ai-release-workflow-identity.json --sha-out build/trusted-workflow-sha.txt --coordinate-out build/ai-release-workflow-identity.coordinate.json
    - name: Obtain FND authoritative release authorization
      run: |
        test "sha256:$(sha256sum scripts/release/ai_release_authority.py | cut -d' ' -f1)" = "$AI_RELEASE_AUTHORITY_CLIENT_SHA256"
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/release/ai_release_authority.py authorize --snapshot build/foundation/foundation-outputs.json --request-key "$AI_PLAN_REQUEST_KEY" --request-version-id "$AI_PLAN_REQUEST_VERSION_ID" --request-sha256 "$AI_PLAN_REQUEST_SHA256" --domain-receipt-key "$AI_PLAN_DOMAIN_RECEIPT_KEY" --domain-receipt-version-id "$AI_PLAN_DOMAIN_RECEIPT_VERSION_ID" --domain-receipt-sha256 "$AI_PLAN_DOMAIN_RECEIPT_SHA256" --security-receipt-key "$AI_PLAN_SECURITY_RECEIPT_KEY" --security-receipt-version-id "$AI_PLAN_SECURITY_RECEIPT_VERSION_ID" --security-receipt-sha256 "$AI_PLAN_SECURITY_RECEIPT_SHA256" --workflow-identity-coordinate build/ai-release-workflow-identity.coordinate.json --out-dir build/ai-release/authorization --github-env "$GITHUB_ENV"
    # BEGIN AI RELEASE STEPS
    - id: ai_deploy_record
      name: AI release extension point
      run: "true"
    # END AI RELEASE STEPS
    - name: FND authoritative postcondition verification and terminal transaction
      env:
        GC_DEPLOY_RECORD_KEY: ${{ steps.ai_deploy_record.outputs.deploy_record_key }}
        GC_DEPLOY_RECORD_VERSION_ID: ${{ steps.ai_deploy_record.outputs.deploy_record_version_id }}
        GC_DEPLOY_RECORD_SHA256: ${{ steps.ai_deploy_record.outputs.deploy_record_sha256 }}
      run: |
        test "sha256:$(sha256sum scripts/release/ai_release_authority.py | cut -d' ' -f1)" = "$AI_RELEASE_AUTHORITY_CLIENT_SHA256"
        python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/release/ai_release_authority.py finalize --snapshot build/foundation/foundation-outputs.json --authorization-coordinate build/ai-release/authorization/authorization.coordinate.json --deploy-record-key "$GC_DEPLOY_RECORD_KEY" --deploy-record-version-id "$GC_DEPLOY_RECORD_VERSION_ID" --deploy-record-sha256 "$GC_DEPLOY_RECORD_SHA256" --out-dir build/ai-release/postcondition
```

The foundation-owned `ai-release` dispatch projector emits exactly `AI_PLAN_REQUEST_KEY|VERSION_ID|SHA256`, `AI_PLAN_DOMAIN_RECEIPT_KEY|VERSION_ID|SHA256`, and `AI_PLAN_SECURITY_RECEIPT_KEY|VERSION_ID|SHA256`. Authorization appends exactly `AI_RELEASE_AUTHORIZATION_KEY|VERSION_ID|SHA256`; the AI marker may read those values but cannot rewrite them. Its fixed step ID `ai_deploy_record` must emit exactly nonempty `deploy_record_key`, `deploy_record_version_id`, and `deploy_record_sha256`; the foundation post-marker step maps only those three outputs and no marker expression can skip it. `verify_workflow_security.py` rejects a missing/reordered client-hash check, intent verification, authorization/finalize call, fixed step ID/output, terminal action inside the marker, or candidate verifier treated as authoritative.

`ai_release_workflow_role_arn` exact-fetches only the request, plan, release bundle, two receipts, signing results, authorization, stage/quorum results, result-pointer items, deploy record, and terminal evidence named by approved bytes. It can invoke only its three qualified identity/authorization/postcondition aliases; apply only that policy-checked OpenTofu plan to AI-owned task-definition/policy/alarm/evidence resources in the fixed backend; pass exactly `ai_worker_task_role_arn`, `explanation_telemetry_collector_task_role_arn`, `ai_runtime_execution_role_arn`, and the seven named forward one-shot task roles; register only the exact worker, collector, publisher, service-smoke, telemetry-probe, workload-quorum, recall-quorum, recall-delivery, and rollback family prefixes under the mandatory boundary/tags/digests; update/describe only the exact worker/collector services; run/describe/stop only those forward families; read their exact target health/result-pointer keys; and call only the exact telemetry/workload stage/promotion state-machine modes. It cannot build, create/modify a plan or approval, invoke the artifact signer, read a private key, create a repository/service/listener/table/AP/role, mutate FND identity/network/KMS/AMP/buckets/roles, or deploy another service. Applying the approved plan never changes an existing service pointer or desired count—`first_install` happens to begin from both FND placeholders at zero, while upgrades preserve their recorded live state. Every `first_install|image_only|artifact_hot|workload_key` release rolls and re-proves the approved collector and worker candidates; no release kind may terminalize against an unchanged fleet. The fenced common prefix is authoritative authorization → reservation/heartbeat verification → exact plan apply. Artifact activation is mode-discriminated: each non-recall artifact may publish directly from its approved chain, but every recall notice/release/registry first persists a delivery intent, runs only `ai_recall_delivery_task_family_prefix`, exact-verifies the durable REC receipt, and only then lets the publisher CAS its AI artifact row/active set. A registry activation additionally waits until the candidate fleet is ready, then runs the recall quorum and records the signed rotation result; neither quorum nor a later delivery can excuse pre-activation delivery. For `first_install|workload_key`, release next persists `workloadStageIntent`, invokes FND `stage`, and requires `workloadStageTerminal` before worker start. The common runtime proof is collector update/readiness → worker update/readiness → private service smoke; then any post-rollout recall-registry quorum, followed by `workloadPromotionIntent`/FND `promote`/`workloadPromotionTerminal` for `first_install|workload_key`, then telemetry-probe trigger/result → immutable deploy record → FND postcondition alias terminal transaction. Rollback reverses only its own recorded transitions or proves both services/targets zero. Tests mutate every repository/ARN/tag/pass-role/action/family, plan digest, authority coordinate, heartbeat/fence, first-install state, recall delivery-before-activation order, stage-before-worker order, service order, target, result pointer, probe/promotion, release kind, unchanged-fleet shortcut, candidate terminal attempt, and rollback branch.

For approved-digest local evaluation, `ai_release_workflow_role_arn` alone gets `ecr:GetAuthorizationToken` plus `ecr:BatchGetImage|GetDownloadUrlForLayer|BatchCheckLayerAvailability` on `ai_worker_repository_url`; policy inputs and the release verifier bind the one approved image digest. It has no layer upload, `PutImage`, tag mutation, collector-repository pull, or action on another repository. The first-install flow stages the signed workload public snapshot before candidate worker readiness, and FND promotion performs the signer/public-active transaction after quorum; an upgrade preserves prior live service state until each fenced transition. IAM/workflow tests mutate the repository, digest, ECR action, and order.

Any AI-owned `ai-control-promote.yml` or `ai-recall-promote.yml` is an unprivileged proposal/evidence producer only: it has `permissions:{contents:read}`, no `id-token:write`, environment, AWS role, control-table write, EFS, ECS, signer, or promotion-state-machine permission. Actual artifact/recall publication and every control-state CAS run only inside this FND-owned `ai_release` job under the approved request and reservation. `verify_workflow_security.py` rejects any standalone workflow with AWS/OIDC mutation authority or any second role that can promote the same domain.

Foundation owns a separate crash-recovery path; forward release cannot reclaim or replace it:

```yaml
# .github/workflows/ai-release-recovery.yml
on:
  workflow_dispatch:
    inputs:
      release_id: {required: true, type: string}
permissions: {}
jobs:
  ai_release_recovery:
    runs-on: ubuntu-24.04
    timeout-minutes: 45
    environment: production-recovery-kr
    permissions: {contents: read, id-token: write}
    concurrency: {group: ai-release-recovery-kr-prod, cancel-in-progress: false}
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
      - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
        with: {python-version: "3.12.13", cache: ""}
      - uses: aws-actions/configure-aws-credentials@ff717079ee2060e4bcee96c4779b553acc87447c
        with:
          role-to-assume: ${{ vars.AI_RELEASE_RECOVERY_WORKFLOW_ROLE_ARN }}
          aws-region: ap-northeast-2
          audience: sts.amazonaws.com
          role-session-name: gc-ai-release-recovery-${{ github.run_id }}-${{ github.run_attempt }}
          role-duration-seconds: 3600
          mask-aws-account-id: true
      - name: Exact-fetch foundation outputs and project recovery input
        env:
          GC_SNAPSHOT_BUCKET: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME }}
          GC_SNAPSHOT_KEY: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_KEY }}
          GC_SNAPSHOT_VERSION_ID: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID }}
          GC_SNAPSHOT_SHA256: ${{ vars.AI_FOUNDATION_OUTPUTS_SNAPSHOT_SHA256 }}
          GC_INPUT_RELEASE_ID: ${{ inputs.release_id }}
        run: |
          mkdir -p build/foundation
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py fetch --bucket "$GC_SNAPSHOT_BUCKET" --key "$GC_SNAPSHOT_KEY" --version-id "$GC_SNAPSHOT_VERSION_ID" --sha256 "$GC_SNAPSHOT_SHA256" --out build/foundation/foundation-outputs.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-github-env --snapshot build/foundation/foundation-outputs.json --expected-snapshot-sha256 "$GC_SNAPSHOT_SHA256" --map governance/foundation/ai-foundation-output-env-map.json --github-env "$GITHUB_ENV" --out build/foundation/output-projection.json
          python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-dispatch-env --profile ai-release-recovery --github-env "$GITHUB_ENV" --out build/foundation/input-projection.json
      # BEGIN AI RELEASE RECOVERY STEPS
      - name: AI release recovery extension point
        run: "true"
      # END AI RELEASE RECOVERY STEPS
```

`release_id` is the exact original `${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}` string and the only input; it must match `^[1-9][0-9]{0,19}-[1-9][0-9]{0,9}$`. On an initial recovery it must byte-equal the singleton reservation plus sealed manifest/plan; an existing terminal is required and compared only for an idempotent retry. `ai_release_recovery_workflow_role_arn` may call `states:StartExecution|DescribeExecution` only on `ai_release_recovery_state_machine_arn`; it has no ECS, S3 data-plane, DynamoDB, signing, planning, approval, or Lambda/task override permission. The state machine strongly reads the original FND-schema reservation, claims recovery under its existing fencing token only after the atomically stored heartbeat deadline, exact-fetches the sealed FND-schema recovery manifest, and runs only the independently FND-built task whose image equals `ai_release_recovery_handler_image_digest`; no candidate image, command, family, role, SG, bucket, service, or target is caller input. An eligible untouched `reserved` row with all progress null and unchanged prior services is no-op terminalized; any other reserved row fails. The handler may stop fixed forward one-shots, reverse recorded collector/worker transitions, or set both exact services to zero. If the workload `ACTIVE` anchor advanced to the reservation's candidate fence, restoration is forbidden: it zeros both services and records that a higher-sequence corrective workload promotion is required. The state machine writes exactly one terminal with `outcome:"recovered"`, `recoveryAction:"restored"|"zeroed"`, and exact reservation/result/fence/evidence digests before removing the reservation transactionally. It cannot reclaim/replace a reservation, advance a release fence, build/plan/sign/approve, register a task definition, select another release, or perform forward deployment. Idempotent retry returns the same recovery result and terminal. Workflow/IAM tests kill the original runner and recovery task before/after every transition and reject a live heartbeat, changed/missing coordinates, another release/fence/image, candidate recovery code, forward action, unqualified state machine, cross-role assumption, ACTIVE-anchor restore, and a second terminal outcome.

`verify_workflow_security.py` requires exactly one `ai_release` job and one `ai_release_recovery` job, one ordered marker pair apiece, the nine release dispatch inputs and sole recovery `release_id`, exact timeout/environment/permissions/concurrency, distinct plan/domain/security/release/recovery role ARNs and actors, and no AI plan/approval/deploy/recovery step elsewhere. It also requires the FND-owned plan and release pre-marker steps to exact-fetch the protected snapshot and complete `project-github-env` plus `project-ai-self-coordinate-env` before their markers, with each of the four self-coordinate values sourced only from the corresponding `GC_SNAPSHOT_*` binding. Every privileged plan, approval, signing, ceremony, staging, recovery, or release checkout must have `fetch-depth:0`, `fetch-tags:true`, and `persist-credentials:false`; the verifier rejects a default/shallow checkout, retained credential helper/token, candidate SHA that differs from the peeled signed-tag source, same-run `needs`, artifact handoff in place of exact-version S3, caller-authored identity, missing/reordered/substituted self-coordinate projection, missing Object Lock, or a release/recovery job with prohibited build/plan/approval/signing/forward permission.

Foundation also pre-creates the exact two conditional GEN candidate jobs consumed by the GEN plan; genetics may edit only their marker bodies:

```yaml
gen_android_release:
  name: Conditional GEN Android candidate evidence
  if: ${{ vars.GENETICS_G0_ENABLED == 'true' }}
  runs-on: ubuntu-24.04
  timeout-minutes: 90
  environment: production-kr
  permissions:
    actions: read
    contents: read
  concurrency:
    group: gen-android-release-kr-prod
    cancel-in-progress: false
  steps:
    - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
    # BEGIN GEN ANDROID RELEASE STEPS
    - name: Conditional GEN Android release extension point
      run: "true"
    # END GEN ANDROID RELEASE STEPS

gen_ios_release:
  name: Conditional GEN iOS candidate evidence
  if: ${{ vars.GENETICS_G0_ENABLED == 'true' }}
  runs-on: macos-15
  timeout-minutes: 90
  environment: production-kr
  permissions:
    actions: read
    contents: read
  concurrency:
    group: gen-ios-release-kr-prod
    cancel-in-progress: false
  steps:
    - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
      with: {fetch-depth: 0, fetch-tags: true, persist-credentials: false}
    # BEGIN GEN IOS RELEASE STEPS
    - name: Conditional GEN iOS release extension point
      run: "true"
    # END GEN IOS RELEASE STEPS
```

The protected environment supplies only the public reviewed G0 gate/trust/envelope/candidate values, safety sequence/envelope/candidate values, and—only for an authorized rerun—the release ID/envelope/candidate values. Neither job has `id-token:write`, AWS credentials, mobile signing secret, store credential, repository write, or app-store/deployment permission. `actions:read` is limited to the exact preliminary run/artifact IDs bound by the verified release manifest; it cannot list or choose another candidate in marker code. The only upload is the pinned GitHub evidence action, first under a clearly preliminary name and later under an authorized name after seven-role verification; it is not distribution. `verify_workflow_security.py` requires these exact jobs/runners/environments/timeouts/permissions/concurrency/checkout options and marker pairs, all protected values, pinned upload/download actions, and the preliminary-versus-authorized branch; it rejects a GEN step elsewhere, arbitrary artifact/run selection, any signing/store/deployment command, or repository/AWS write authority.

CI has `contents: read`, no `id-token`, no repository write, no fork-secret access, and runs:

```bash
python -m unittest discover -s scripts/tests -v
python scripts/ci/verify_workflow_security.py
python scripts/ci/verify_migration_ranges.py --all
./gradlew --no-daemon clean check cyclonedxBom
build/tools/opentofu/tofu fmt -check -recursive infra
build/tools/opentofu/tofu -chdir=infra/modules/organization init -backend=false
build/tools/opentofu/tofu -chdir=infra/modules/organization test
build/tools/opentofu/tofu -chdir=infra/modules/kr-foundation init -backend=false
build/tools/opentofu/tofu -chdir=infra/modules/kr-foundation test
scripts/ci/install_security_tools.sh
build/tools/security/gitleaks detect --source . --no-banner --redact --exit-code 1
build/tools/security/trivy fs --scanners vuln,secret,misconfig,license --severity HIGH,CRITICAL --exit-code 1 .
```

`install_security_tools.sh` resolves the repository root, creates only mode-`0755` `build/tools/security`, sets `GOBIN` to that absolute directory for these exact scanner modules and versions, and checks Go module sums plus exact version output. It rejects `GOBIN`/`GOPATH`/PATH overrides, a symlink/non-directory destination, another module/version, or a binary outside that directory; an existing destination is accepted only when a temporary rebuild byte-compares with both exact installed binaries, so reruns are idempotent without trusting leftovers. Cosign is installed separately by the Task 1 hash-locked installer and is never built from a mutable Go toolchain in a release boundary; every caller invokes all three tools by their exact repository-local paths:

```bash
install -d -m 0755 build/tools/security
GOBIN="$PWD/build/tools/security" go install github.com/aquasecurity/trivy/cmd/trivy@v0.66.0
GOBIN="$PWD/build/tools/security" go install github.com/zricethezav/gitleaks/v8@v8.28.0
test "$(build/tools/security/trivy --version | sed -n '1p')" = 'Version: 0.66.0'
test "$(build/tools/security/gitleaks version)" = '8.28.0'
python scripts/ci/install_cosign.py --destination build/tools/cosign
```

Task 7A is the sole writer of root `supply-chain.lock.json`; Task 8 consumes and verifies its exact `schema_version: 3` bytes. The canonical `runtime_base` tuple is `docker.io/library/eclipse-temurin:21.0.8_9-jre`, OCI index `sha256:66bb900643426ad01996d25bada7d56751913f9cec3b827fcb715d2ec9a0fbfc`, linux/amd64 manifest `sha256:54c86420ec14be32efd8659e348eddaf1a26fb19f5766e29161c4bbbd0fec1c3`; the shared OTel and Python tuples are exactly the Task 7A entries. Task 8 may add only the already frozen `tools` values through a reviewed lock update that preserves schema, runtime, and shared entries; it never rewrites a schema-2 or tag-only variant. Foundation owns this root lock and the lock schema/verifier. A base used by two or more workstreams appears exactly once under root shared entries; its reference is forbidden in every owner lock, and each consumer provenance names the root-lock digest plus entry name/index/platform digests. A unique base gets exactly one owner lock. `verify_workflow_security.py` discovers all locks, rejects duplicate references, mutable-tag-only `FROM`, tag/index/platform drift, cross-owner edits, an unreferenced entry, or provenance missing the relevant lock digest.

The release workflow runs only on a signed `v*` tag after CI, uses `permissions: {contents: read, id-token: write}`, and is bound to the protected `production-kr` environment. It verifies the registry tag still resolves to the locked index and linux/amd64 manifest, builds directly from the locked platform manifest (never from tag or index), records tag/index/platform/result digests in provenance, pushes by commit SHA, and passes only the result digest to OpenTofu:

```dockerfile
ARG BASE_IMAGE="docker.io/library/eclipse-temurin@sha256:54c86420ec14be32efd8659e348eddaf1a26fb19f5766e29161c4bbbd0fec1c3"
FROM --platform=linux/amd64 ${BASE_IMAGE}
WORKDIR /app
COPY --chown=65532:65532 build/libs/core-api.jar /app/core-api.jar
RUN find / -xdev -type f \( -perm -4000 -o -perm -2000 \) -exec chmod a-s {} + \
 && ! find / -xdev -type f \( -perm -4000 -o -perm -2000 \) -print -quit | grep -q .
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-Djava.security.egd=file:/dev/urandom", "-jar", "/app/core-api.jar"]
```

Before push, run Trivy against the built image and an image-filesystem assertion that no SUID/SGID bit remains. Core, C0, telemetry-canary, signer, and every other FND task definition is non-root, read-only-root, sets `linuxParameters.capabilities.drop=["ALL"]`, and omits the unsupported `privileged` and `dockerSecurityOptions` fields entirely. After push, use only `build/tools/cosign/cosign` to create new-format keyless signature and `slsaprovenance` attestation bundles for the immutable digest, with the exact release workflow identity and both bundle coordinates committed to the handoff. Before any UX saved-plan apply, the FND authority performs the independent locked-root offline verification frozen in Task 7A; candidate/Product verification is diagnostic only.

- [ ] **Step 4: Run workflow, build, scan, and SBOM checks locally**

Run:

```bash
python -m unittest scripts.tests.test_verify_workflow_security -v
python scripts/ci/verify_workflow_security.py
python scripts/ci/verify_migration_ranges.py --all
python -m unittest scripts.tests.test_verify_signed_release_tag -v
python scripts/ci/run_locked_uv.py -- sync --project tooling/fnd-workstream-release --frozen
python scripts/ci/run_locked_uv.py -- run --project tooling/fnd-workstream-release --frozen pytest scripts/release/test_fnd_workstream_aws.py scripts/release/test_verify_pub_rec_image_handoff.py scripts/release/test_fnd_workstream_deploy.py -q
./gradlew --no-daemon clean check cyclonedxBom
scripts/ci/install_security_tools.sh
build/tools/security/gitleaks detect --source . --no-banner --redact --exit-code 1
build/tools/security/trivy fs --scanners vuln,secret,misconfig,license --severity HIGH,CRITICAL --exit-code 1 .
```

Expected: all commands exit 0; `apps/core-api/build/reports/bom.json` exists; no action uses a mutable tag; no workflow accepts static AWS keys; scans have no unowned high/critical failure; both candidate jobs expose only their exact four immutable outputs; both finalize jobs independently verify then invoke only the FND authority; and neither marker contains an ambient AWS CLI, direct deployment, PATH Cosign, or unwrapped boto client.

- [ ] **Step 5: Commit the supply-chain gates**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml .github/workflows/ai-promotion-intent.yml .github/workflows/ai-plan.yml .github/workflows/ai-plan-domain-approve.yml .github/workflows/ai-plan-security-approve.yml .github/workflows/ai-production-evaluation-bootstrap.yml .github/workflows/ai-release-recovery.yml .github/workflows/ai-artifact-signing-stage.yml .github/workflows/ai-artifact-signing-domain-approve.yml .github/workflows/ai-artifact-signing-security-approve.yml .github/workflows/ai-artifact-signing-invoke.yml .github/workflows/ai-artifact-key-ceremony-stage.yml .github/workflows/ai-artifact-key-custodian-approve.yml .github/workflows/ai-artifact-key-security-approve.yml .github/workflows/ai-artifact-key-ceremony-invoke.yml .github/dependabot.yml apps/core-api/Dockerfile apps/core-api/build.gradle.kts scripts/ci/verify_workflow_security.py scripts/tests/test_verify_workflow_security.py scripts/ci/verify_migration_ranges.py scripts/ci/verify_signed_release_tag.py scripts/ci/install_security_tools.sh scripts/tests/test_verify_signed_release_tag.py governance/release/allowed-tag-signers.schema.json governance/release/allowed-tag-signers.json governance/ai/promotion-intent-draft.json supply-chain.lock.json
git add packages/contracts/jsonschema/ux-staging-result.schema.json packages/contracts/fixtures/ux-staging-result.valid.json packages/contracts/jsonschema/ux-staging-fault-request.schema.json packages/contracts/fixtures/ux-staging-fault-request.valid.json
git commit -m "ci: gate releases on signed supply-chain evidence"
```

- [ ] **Step 6: Run the post-workflow bootstrap checkpoint only under separately authorized production roles**

This is the sole executable owner of the production ceremonies deferred by Task 3. It is an external-state checkpoint, not part of an ordinary local implementation run. Start only from the signed Task 8 commit containing all workflow files, with a clean worktree and the exact peeled tag source:

```bash
test -z "$(git status --porcelain=v1 --untracked-files=all)"
python scripts/ci/verify_signed_release_tag.py --tag "$(git describe --tags --exact-match)" --source-sha "$(git rev-parse HEAD)" --registry governance/release/allowed-tag-signers.json --out build/security/task8-tag-verification.json
python scripts/ci/verify_workflow_security.py
TOFU="$PWD/build/tools/opentofu/tofu"
test -x "$TOFU"
test "$("$TOFU" version | sed -n '1p')" = 'OpenTofu v1.10.6'
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/publish_rec_document_worker_jwks.py verify-vars --expected enabled --vars infra/live/kr-prod/protected.auto.tfvars.json
"$TOFU" -chdir=infra/live/kr-prod plan -input=false -lock=true -out=../../../build/security/fnd-first-apply.tfplan -var-file=protected.auto.tfvars.json
```

**STOP** for the separately authorized foundation apply reviewer. After the saved-plan digest is approved, apply that exact plan and record its immutable receipt; the first apply must create only inert shells/empty signing containers and leave both AI services at zero:

```bash
"$TOFU" -chdir=infra/live/kr-prod apply -input=false ../../../build/security/fnd-first-apply.tfplan
"$TOFU" -chdir=infra/live/kr-prod output -json > build/security/fnd-first-apply-outputs.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py record-apply --phase first --saved-plan build/security/fnd-first-apply.tfplan --foundation-outputs build/security/fnd-first-apply-outputs.json --tag-verification build/security/task8-tag-verification.json --out build/security/fnd-first-apply-receipt.coordinate.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/publish_rec_document_worker_jwks.py publish --foundation-outputs build/security/fnd-first-apply-outputs.json --tag-verification build/security/task8-tag-verification.json --out-dir build/security/rec-document-jwk-bootstrap
```

Prepare the twelve-key broker bootstrap from those exact outputs:

```bash
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_artifact_key_ceremony.py prepare --operation bootstrap-all --foundation-outputs build/security/fnd-first-apply-outputs.json --apply-receipt build/security/fnd-first-apply-receipt.coordinate.json --out-dir build/security/ai-artifact-key-bootstrap
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_artifact_key_ceremony.py verify-dispatch --workflow ai-artifact-key-ceremony-stage.yml --request build/security/ai-artifact-key-bootstrap/stage-dispatch.json
```

Dispatch `ai-artifact-key-ceremony-stage.yml` with exactly `stage-dispatch.json`. **STOP:** independent key-custodian and security-release actors dispatch their fixed approval workflows from disjoint environments and export only their immutable coordinate JSON to `build/security/ai-artifact-key-bootstrap/key-custodian-receipt.coordinate.json` and `security-receipt.coordinate.json`. Continue only after:

```bash
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_artifact_key_ceremony.py assemble-invoke --ceremony-dir build/security/ai-artifact-key-bootstrap --out build/security/ai-artifact-key-bootstrap/invoke-dispatch.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_artifact_key_ceremony.py verify-dispatch --workflow ai-artifact-key-ceremony-invoke.yml --request build/security/ai-artifact-key-bootstrap/invoke-dispatch.json
```

Dispatch only `ai-artifact-key-ceremony-invoke.yml`, place its public result coordinate at `build/security/ai-artifact-key-bootstrap/result.coordinate.json`, and verify both bootstrap sequences plus a local sample signature for all twelve prefixes:

```bash
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/ai_artifact_key_ceremony.py verify-result --ceremony-dir build/security/ai-artifact-key-bootstrap --result-coordinate build/security/ai-artifact-key-bootstrap/result.coordinate.json --out build/security/ai-artifact-key-bootstrap/signer-second-apply.auto.tfvars.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/release/verify_ai_artifact_signing_bootstrap.py --foundation-outputs build/security/fnd-first-apply-outputs.json --ceremony-result build/security/ai-artifact-key-bootstrap/result.coordinate.json --second-apply-vars build/security/ai-artifact-key-bootstrap/signer-second-apply.auto.tfvars.json
```

In parallel, run the actual telemetry bootstrap canary through the closed state-machine client:

```bash
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py prepare --foundation-outputs build/security/fnd-first-apply-outputs.json --apply-receipt build/security/fnd-first-apply-receipt.coordinate.json --tag-verification build/security/task8-tag-verification.json --out-dir build/security/telemetry-bootstrap
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py start --request build/security/telemetry-bootstrap/request.json --out build/security/telemetry-bootstrap/execution.coordinate.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py wait --request build/security/telemetry-bootstrap/request.json --execution build/security/telemetry-bootstrap/execution.coordinate.json --out-dir build/security/telemetry-bootstrap
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py assemble-second-apply --signer-vars build/security/ai-artifact-key-bootstrap/signer-second-apply.auto.tfvars.json --rotation-result build/security/telemetry-bootstrap/rotation-result.coordinate.json --rec-jwk-vars build/security/rec-document-jwk-bootstrap/rec-jwk-finalize.auto.tfvars.json --foundation-outputs build/security/fnd-first-apply-outputs.json --out build/security/fnd-second-apply.auto.tfvars.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/publish_rec_document_worker_jwks.py verify-vars --expected disabled --vars build/security/fnd-second-apply.auto.tfvars.json
"$TOFU" -chdir=infra/live/kr-prod plan -input=false -lock=true -out=../../../build/security/fnd-second-apply.tfplan -var-file=../../../build/security/fnd-second-apply.auto.tfvars.json
```

**STOP** for independent review of the saved second plan. It may pin only the verified signer-root VersionId/SHA, initial telemetry-manifest VersionId/SHA, the two REC public-JWK VersionId/SHA pairs, exact-version read policies, and their outputs, and it must delete the bootstrap-only REC JWK publisher role/trust/policy. Then apply, verify publisher retirement, record, publish, and independently verify the handoff using the verifier's exact five-argument contract:

```bash
"$TOFU" -chdir=infra/live/kr-prod apply -input=false ../../../build/security/fnd-second-apply.tfplan
"$TOFU" -chdir=infra/live/kr-prod output -json > build/security/fnd-second-apply-outputs.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/publish_rec_document_worker_jwks.py verify-after-apply --foundation-outputs build/security/fnd-second-apply-outputs.json --bootstrap-dir build/security/rec-document-jwk-bootstrap --out build/security/rec-document-jwk-bootstrap/verification-receipt.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py record-apply --phase second --saved-plan build/security/fnd-second-apply.tfplan --foundation-outputs build/security/fnd-second-apply-outputs.json --tag-verification build/security/task8-tag-verification.json --out build/security/fnd-second-apply-receipt.coordinate.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py publish-handoff --rotation-result build/security/telemetry-bootstrap/rotation-result.coordinate.json --manifest build/security/telemetry-bootstrap/manifest.coordinate.json --canary-evidence build/security/telemetry-bootstrap/canary-evidence.coordinate.json --apply-receipt build/security/fnd-second-apply-receipt.coordinate.json --foundation-outputs build/security/fnd-second-apply-outputs.json --out build/security/telemetry-bootstrap/handoff.coordinate.json
HANDOFF_BUCKET="$(python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py coordinate-field --coordinate build/security/telemetry-bootstrap/handoff.coordinate.json --field bucket)"
HANDOFF_KEY="$(python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py coordinate-field --coordinate build/security/telemetry-bootstrap/handoff.coordinate.json --field key)"
HANDOFF_VERSION="$(python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py coordinate-field --coordinate build/security/telemetry-bootstrap/handoff.coordinate.json --field versionId)"
HANDOFF_SHA="$(python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/telemetry_identity_bootstrap.py coordinate-field --coordinate build/security/telemetry-bootstrap/handoff.coordinate.json --field sha256)"
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/verify_telemetry_identity_evidence.py --bucket "$HANDOFF_BUCKET" --key "$HANDOFF_KEY" --version-id "$HANDOFF_VERSION" --sha256 "$HANDOFF_SHA" --foundation-outputs build/security/fnd-second-apply-outputs.json > build/security/telemetry-bootstrap/verified-handoff.json
```

**STOP** for the protected release-environment owner to compare `verified-handoff.json` with the exact Object-Lock coordinate and set only `TELEMETRY_IDENTITY_BOOTSTRAP_HANDOFF_KEY`, `TELEMETRY_IDENTITY_BOOTSTRAP_HANDOFF_VERSION_ID`, `TELEMETRY_IDENTITY_BOOTSTRAP_HANDOFF_SHA256`, and `TELEMETRY_IDENTITY_BOOTSTRAP_VERIFICATION_SHA256`; the last value is byte-equal to the strict summary's `verificationSha256`, not a caller-computed file hash. The owner records the environment audit event; the FND pre-marker maps all four through `project-ai-plan-env`, and no AI marker, Terraform apply, or caller derives or rewrites them.

Now generate the initial workload key without export, then prepare and sign—but do not promote—the initial public pair. The keygen client calls only the exact promotion state machine and receives only an immutable public result coordinate; `prepare` emits two strict FND `ai-artifact-signing-proposal.v1` objects from that result. The four generic approval runs and two invoke runs use only their exact workflow inputs/aliases:

```bash
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/workload_jwks_ceremony.py prepare-keygen --public-input governance/cryptographic/workload-jwks-public-input.json --foundation-outputs build/security/fnd-second-apply-outputs.json --out build/workload-jwks/keygen-request.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/workload_jwks_ceremony.py start-keygen --request build/workload-jwks/keygen-request.json --foundation-outputs build/security/fnd-second-apply-outputs.json --out build/workload-jwks/keygen-execution.coordinate.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/workload_jwks_ceremony.py wait-keygen --request build/workload-jwks/keygen-request.json --execution build/workload-jwks/keygen-execution.coordinate.json --foundation-outputs build/security/fnd-second-apply-outputs.json --out build/workload-jwks/keygen-result.coordinate.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/workload_jwks_ceremony.py prepare --public-input governance/cryptographic/workload-jwks-public-input.json --keygen-result-coordinate build/workload-jwks/keygen-result.coordinate.json --root-bundle-coordinate build/security/ai-artifact-key-bootstrap/result.coordinate.json --foundation-outputs build/security/fnd-second-apply-outputs.json --out build/workload-jwks
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/workload_jwks_ceremony.py verify-proposals --work-dir build/workload-jwks --schema packages/contracts/jsonschema/ai-artifact-signing-proposal.schema.json
```

Dispatch `ai-artifact-signing-stage.yml`, then the disjoint domain/security approval workflows, then `ai-artifact-signing-invoke.yml` separately for `workload-jwks-root-registry` and `workload-jwks-release`; exact coordinate JSON files live only under `build/workload-jwks/coordinates/<domain>/`. After both immutable signer results exist:

```bash
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/workload_jwks_ceremony.py assemble --work-dir build/workload-jwks --foundation-outputs build/security/fnd-second-apply-outputs.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/workload_jwks_ceremony.py publish-prepared-pair --work-dir build/workload-jwks --foundation-outputs build/security/fnd-second-apply-outputs.json --out-coordinate build/workload-jwks/prepared-pair.coordinate.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/workload_jwks_ceremony.py verify-prepared-pair --prepared-pair-coordinate build/workload-jwks/prepared-pair.coordinate.json --foundation-outputs build/security/fnd-second-apply-outputs.json
```

The workload versions now exist, so create a third, metadata-only saved plan that pins only their immutable output coordinates. It may not change a bucket, secret, key, role, table, task definition, service, route, listener, or security group:

```bash
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/workload_jwks_ceremony.py assemble-metadata-apply --prepared-pair-coordinate build/workload-jwks/prepared-pair.coordinate.json --foundation-outputs build/security/fnd-second-apply-outputs.json --out build/security/fnd-workload-metadata.auto.tfvars.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/publish_rec_document_worker_jwks.py verify-vars --expected disabled --vars build/security/fnd-workload-metadata.auto.tfvars.json
"$TOFU" -chdir=infra/live/kr-prod plan -input=false -lock=true -out=../../../build/security/fnd-workload-metadata.tfplan -var-file=../../../build/security/fnd-workload-metadata.auto.tfvars.json
```

**STOP** for a different foundation reviewer to approve the saved-plan digest and its machine-checked output-only resource diff. Then:

```bash
"$TOFU" -chdir=infra/live/kr-prod apply -input=false ../../../build/security/fnd-workload-metadata.tfplan
"$TOFU" -chdir=infra/live/kr-prod output -json > build/security/fnd-final-outputs.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/ai-artifact-signer --frozen python scripts/security/workload_jwks_ceremony.py verify-metadata-apply --prepared-pair-coordinate build/workload-jwks/prepared-pair.coordinate.json --saved-plan build/security/fnd-workload-metadata.tfplan --foundation-outputs build/security/fnd-final-outputs.json --out build/workload-jwks/metadata-apply-receipt.json
```

Publish the final public-output snapshot from the exact third-apply bytes, then use a fourth saved plan whose machine-checked diff contains only the three snapshot coordinate output values:

```bash
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py publish --source-sha "$(git rev-parse HEAD)" --tag-verification build/security/task8-tag-verification.json --first-apply-receipt build/security/fnd-first-apply-receipt.coordinate.json --second-apply-receipt build/security/fnd-second-apply-receipt.coordinate.json --workload-apply-receipt build/workload-jwks/metadata-apply-receipt.json --foundation-outputs build/security/fnd-final-outputs.json --snapshot-out build/security/foundation-output-snapshot.expected.json --out build/security/foundation-output-snapshot.coordinate.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py assemble-metadata-apply --coordinate build/security/foundation-output-snapshot.coordinate.json --out build/security/fnd-output-snapshot.auto.tfvars.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/publish_rec_document_worker_jwks.py verify-vars --expected disabled --vars build/security/fnd-output-snapshot.auto.tfvars.json
"$TOFU" -chdir=infra/live/kr-prod plan -input=false -lock=true -out=../../../build/security/fnd-output-snapshot.tfplan -var-file=../../../build/security/fnd-output-snapshot.auto.tfvars.json
```

**STOP** for an independent reviewer to approve the saved-plan digest and the assertion that no resource or preexisting output changes. Then apply and exact-fetch the snapshot through the same interface a fresh AI runner uses:

```bash
"$TOFU" -chdir=infra/live/kr-prod apply -input=false ../../../build/security/fnd-output-snapshot.tfplan
"$TOFU" -chdir=infra/live/kr-prod output -json > build/security/fnd-published-outputs.json
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py verify-metadata-apply --coordinate build/security/foundation-output-snapshot.coordinate.json --saved-plan build/security/fnd-output-snapshot.tfplan --foundation-outputs build/security/fnd-published-outputs.json --out build/security/foundation-output-snapshot-apply-receipt.json
SNAPSHOT_BUCKET="$(python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py output-field --foundation-outputs build/security/fnd-published-outputs.json --name ai_foundation_outputs_snapshot_bucket_name)"
SNAPSHOT_KEY="$(python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py output-field --foundation-outputs build/security/fnd-published-outputs.json --name ai_foundation_outputs_snapshot_key)"
SNAPSHOT_VERSION="$(python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py output-field --foundation-outputs build/security/fnd-published-outputs.json --name ai_foundation_outputs_snapshot_version_id)"
SNAPSHOT_SHA="$(python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py output-field --foundation-outputs build/security/fnd-published-outputs.json --name ai_foundation_outputs_snapshot_sha256)"
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py fetch --bucket "$SNAPSHOT_BUCKET" --key "$SNAPSHOT_KEY" --version-id "$SNAPSHOT_VERSION" --sha256 "$SNAPSHOT_SHA" --out build/security/foundation-outputs-fresh.json
cmp build/security/foundation-outputs-fresh.json build/security/foundation-output-snapshot.expected.json
: > build/security/github-env.projection
python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py project-github-env --snapshot build/security/foundation-outputs-fresh.json --expected-snapshot-sha256 "$SNAPSHOT_SHA" --map governance/foundation/ai-foundation-output-env-map.json --github-env build/security/github-env.projection --out build/security/foundation-output-projection-summary.json
```

**STOP** for the protected-environment owner to set only `AI_FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME`, `AI_FOUNDATION_OUTPUTS_SNAPSHOT_KEY`, `AI_FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID`, and `AI_FOUNDATION_OUTPUTS_SNAPSHOT_SHA256` from those exact outputs in `ai-plan-kr`, `ai-production-evaluation-bootstrap-kr`, `production-kr`, and `production-recovery-kr`, and the byte-equal aliases `FOUNDATION_OUTPUTS_SNAPSHOT_BUCKET_NAME`, `FOUNDATION_OUTPUTS_SNAPSHOT_KEY`, `FOUNDATION_OUTPUTS_SNAPSHOT_VERSION_ID`, and `FOUNDATION_OUTPUTS_SNAPSHOT_SHA256` in `ux-plan-kr`, `staging-kr`, and `production-kr`. In `ai-production-evaluation-bootstrap-kr` the owner additionally sets only `AI_PRODUCTION_EVALUATION_BOOTSTRAP_WORKFLOW_ROLE_ARN` from the same snapshot; the workflow derives its qualified function alias from the exact-fetched snapshot and accepts no ambient alias. The export check rejects any alias mismatch. Fresh jobs reconstruct `foundation-outputs.json` only by exact `fetch`; they never inherit this ceremony's local filesystem. **STOP at the prepared, non-active public pair.** FND cannot fabricate an AI worker quorum before the real candidate worker exists. The first approved AI release exact-fetches the pinned prepared pair, performs the approved post-reservation `stage` transaction, and only after `workloadStageTerminal` deploys the candidate worker pair, emits the FND-owned readiness/quorum bytes, writes the same-fence promotion intent before `StartExecution`, and invokes `promote`; the promotion state machine owns the candidate-only first-install or dual-key upgrade core deploy/readiness/rollback and only its single active-anchor CAS authorizes the new pair/key. Secret label moves are retriable bookkeeping. Expected: signer bundle sequence 2 has twelve active keys; telemetry handoff is Object-Locked, independently verified, and protected outside Terraform; both AI services remain at zero; the exact prepared-pair coordinates and public-output snapshot are pinned by metadata-only applies but no runtime workload row/active set/signer `ACTIVE` exists or changes; and no test key, same-actor approval, unverified workflow coordinate, cross-secret atomicity claim, or private key enters GitHub, files, state, logs, or CLI arguments.

Keep `ai-plan-kr` disabled until the reviewed production registry, bundle, and corpus have each completed their generic FND signing ceremony. Dispatch only `.github/workflows/ai-production-evaluation-bootstrap.yml` with the six returned signing-result/signed-envelope coordinates. Its fresh runner installs and re-verifies the locked uv runtime, projects all eighteen scalars into six local coordinate files, exact-fetches the snapshot and all signing chains, invokes the fixed alias with fresh OIDC, verifies both strong reads after the two-key transaction, and emits only `result_coordinate` in the protected step summary. The protected owner exact-compares that coordinate with the immutable `ai-production-evaluation-bootstrap-result.v1` and enables `ai-plan-kr` only when `outcome=created|advanced`, both sequences and digests equal the two committed anchors, and no test prefix or current-version selector appears. Rotation repeats the same workflow with the next complete three-chain set; no AI job ever runs this bootstrap.

---

### Task 9: Implement idempotent revocation-driven deletion

**Files:**
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion/api/DeletionContracts.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion/application/DeletionOrchestrator.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion/application/ConsentRevokedHandler.kt`
- Create: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion/adapter/out/jdbc/DeletionJdbcRepository.kt`
- Create: `apps/core-api/src/main/resources/db/migration/V3__fnd_deletion_control.sql`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/exportdeletion/DeletionOrchestratorTest.kt`

**Interfaces:**
- Consumes: Task 4 `consent.revoked.v1`; `Clock`; registered `SubjectDataEraser` implementations; database transaction.
- Produces: `DeletionService.request(DeletionCommand): DeletionRequest`; `run(UUID): DeletionReceipt`; durable `DeletionTombstone`; Task 2 `ProfileDeletionPort.requestDeletion(ProfileDeletionCommand)` adapter.

- [ ] **Step 1: Write the failing idempotency and evidence tests**

```kotlin
class DeletionOrchestratorTest {
    private val fixedClock = Clock.fixed(Instant.parse("2026-08-09T00:00:00Z"), ZoneOffset.UTC)
    private val pseudonymizer = SubjectPseudonymizer { "hmac256:" + "b".repeat(64) }
    private lateinit var repository: InMemoryDeletionRepository

    @BeforeEach
    fun resetRepository() {
        repository = InMemoryDeletionRepository()
    }

    @Test
    fun `revocation creates one deletion and all active targets must return evidence`() {
        val erasers = listOf(
            RecordingEraser("consent-links", DeletionTarget.CONSENT_SUBJECT_LINK),
            RecordingEraser("document-objects", DeletionTarget.USER_OBJECTS),
            RecordingEraser("personal-records", DeletionTarget.USER_OBJECTS),
            RecordingEraser("hapi-fhir", DeletionTarget.USER_OBJECTS),
            RecordingEraser("workflow-state", DeletionTarget.WORKFLOW_STATE),
            RecordingEraser("exports", DeletionTarget.EXPORTS),
        )
        val service = DeletionOrchestrator(repository, erasers, pseudonymizer, fixedClock)
        val command = DeletionCommand(
            subject = DeletionSubject("subject-17"),
            scope = ConsentScope(
                UUID.fromString("00000000-0000-0000-0000-000000000117"),
                ConsentPurpose.PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD,
            ),
            reason = DeletionReason.CONSENT_REVOKED,
            sourceEventId = UUID.fromString("00000000-0000-0000-0000-000000000017"),
        )

        val first = service.request(command)
        val second = service.request(command)
        val receipt = service.run(first.requestId)

        assertThat(second.requestId).isEqualTo(first.requestId)
        assertThat(receipt.state).isEqualTo(DeletionState.COMPLETED)
        assertThat(receipt.targets.map { it.eraserId }).containsExactlyInAnyOrderElementsOf(erasers.map { it.eraserId })
        assertThat(receipt.targets.count { it.target == DeletionTarget.USER_OBJECTS }).isEqualTo(3)
        assertThat(erasers).allMatch { it.scopes.single() == command.scope }
        assertThat(receipt.completedAt).isNotNull()
        assertThat(receipt.completedAt!!).isBeforeOrEqualTo(first.requestedAt.plus(Duration.ofHours(24)))
    }

    @Test
    fun `one failed target prevents a completion receipt and remains retryable`() {
        val service = DeletionOrchestrator(
            repository,
            listOf(FailingEraser("document-objects", DeletionTarget.USER_OBJECTS)),
            pseudonymizer,
            fixedClock,
        )
        val request = service.request(
            DeletionCommand(
                subject = DeletionSubject("subject-18"),
                scope = ProfileScope,
                reason = DeletionReason.PROFILE_RESET,
                sourceEventId = UUID.fromString("00000000-0000-0000-0000-000000000018"),
            ),
        )
        val result = service.run(request.requestId)
        assertThat(result.state).isEqualTo(DeletionState.RETRY_REQUIRED)
        assertThat(repository.findTombstone(request.subjectDigest, ProfileScope)).isNull()
    }

    @Test
    fun `consent scope removes only that grants artifacts and preserves unrelated profile data`() {
        val revoked = ConsentScope(
            UUID.fromString("00000000-0000-0000-0000-000000000127"),
            ConsentPurpose.RETAIN_VERIFIED_SOURCE,
        )
        val unrelated = ConsentScope(
            UUID.fromString("00000000-0000-0000-0000-000000000128"),
            ConsentPurpose.BUILD_PERSONAL_LAB_TIMELINE,
        )
        val eraser = ScopedArtifactEraser(mutableSetOf(revoked, unrelated, ProfileScope))
        val service = DeletionOrchestrator(repository, listOf(eraser), pseudonymizer, fixedClock)
        val request = service.request(
            DeletionCommand(
                subject = DeletionSubject("subject-19"),
                scope = revoked,
                reason = DeletionReason.CONSENT_REVOKED,
                sourceEventId = UUID.fromString("00000000-0000-0000-0000-000000000129"),
            ),
        )

        service.run(request.requestId)

        assertThat(eraser.artifacts).doesNotContain(revoked)
        assertThat(eraser.artifacts).containsExactlyInAnyOrder(unrelated, ProfileScope)
    }

    private class RecordingEraser(
        override val eraserId: String,
        override val target: DeletionTarget,
    ) : SubjectDataEraser {
        val scopes = mutableListOf<DeletionScope>()
        override fun erase(subject: DeletionSubject, scope: DeletionScope, requestId: UUID): DeletionEvidence {
            scopes += scope
            return DeletionEvidence(
            eraserId = eraserId,
            target = target,
            completedAt = Instant.parse("2026-08-09T00:00:01Z"),
            resultDigest = "sha256:" + eraserId.replace("-", "0").padEnd(64, '0').take(64),
        )
        }
    }

    private class FailingEraser(
        override val eraserId: String,
        override val target: DeletionTarget,
    ) : SubjectDataEraser {
        override fun erase(subject: DeletionSubject, scope: DeletionScope, requestId: UUID): DeletionEvidence =
            throw DeletionTargetException(target)
    }

    private class ScopedArtifactEraser(
        val artifacts: MutableSet<DeletionScope>,
    ) : SubjectDataEraser {
        override val eraserId = "scope-isolation-fixture"
        override val target = DeletionTarget.USER_OBJECTS
        override fun erase(subject: DeletionSubject, scope: DeletionScope, requestId: UUID): DeletionEvidence {
            when (scope) {
                is ConsentScope -> artifacts.remove(scope)
                ProfileScope -> artifacts.clear()
            }
            return DeletionEvidence(
                eraserId,
                target,
                Instant.parse("2026-08-09T00:00:01Z"),
                "sha256:" + "d".repeat(64),
            )
        }
    }

    private class InMemoryDeletionRepository : DeletionRepository {
        private val requests = linkedMapOf<UUID, DeletionRequest>()
        private val targetEvidence = linkedMapOf<UUID, MutableList<DeletionEvidence>>()
        private val tombstones = linkedMapOf<Pair<String, DeletionScope>, DeletionTombstone>()

        override fun findBySourceEventId(sourceEventId: UUID): DeletionRequest? =
            requests.values.singleOrNull { it.sourceEventId == sourceEventId }
        override fun insert(request: DeletionRequest): DeletionRequest = request.also { requests[it.requestId] = it }
        override fun lock(requestId: UUID): DeletionRequest = requireNotNull(requests[requestId])
        override fun saveState(requestId: UUID, state: DeletionState, completedAt: Instant?): DeletionRequest =
            requireNotNull(requests[requestId]).copy(state = state, completedAt = completedAt).also {
                requests[requestId] = it
            }
        override fun evidence(requestId: UUID): List<DeletionEvidence> = targetEvidence[requestId].orEmpty()
        override fun saveEvidence(requestId: UUID, evidence: DeletionEvidence) {
            targetEvidence.getOrPut(requestId, ::mutableListOf).removeIf { it.eraserId == evidence.eraserId }
            targetEvidence.getValue(requestId).add(evidence)
        }
        override fun saveTombstone(tombstone: DeletionTombstone) {
            tombstones[tombstone.subjectDigest to tombstone.scope] = tombstone
        }
        override fun findTombstone(subjectDigest: String, scope: DeletionScope): DeletionTombstone? =
            tombstones[subjectDigest to scope]
    }
}
```

- [ ] **Step 2: Run deletion tests and confirm the red state**

Run: `./gradlew --no-daemon :apps:core-api:test --tests '*DeletionOrchestratorTest'`

Expected: compilation FAIL because deletion contracts and orchestration do not exist.

- [ ] **Step 3: Implement deletion state, evidence, and tombstones**

```kotlin
enum class DeletionTarget {
    CONSENT_SUBJECT_LINK,
    USER_OBJECTS,
    WORKFLOW_STATE,
    EXPORTS,
}

enum class DeletionState { REQUESTED, RUNNING, RETRY_REQUIRED, COMPLETED }
enum class DeletionReason { CONSENT_REVOKED, PROFILE_RESET }

data class DeletionSubject(val subjectId: String)

sealed interface DeletionScope

data class ConsentScope(
    val consentId: UUID,
    val purpose: ConsentPurpose,
) : DeletionScope

data object ProfileScope : DeletionScope

data class DeletionCommand(
    val subject: DeletionSubject,
    val scope: DeletionScope,
    val reason: DeletionReason,
    val sourceEventId: UUID,
)

data class DeletionRequest(
    val requestId: UUID,
    val sourceEventId: UUID,
    val subjectId: String?,
    val subjectDigest: String,
    val scope: DeletionScope,
    val requestedAt: Instant,
    val deadlineAt: Instant,
    val state: DeletionState,
    val completedAt: Instant?,
)

interface SubjectDataEraser {
    val eraserId: String
    val target: DeletionTarget
    fun erase(subject: DeletionSubject, scope: DeletionScope, requestId: UUID): DeletionEvidence
}

data class DeletionEvidence(
    val eraserId: String,
    val target: DeletionTarget,
    val completedAt: Instant,
    val resultDigest: String,
)

data class DeletionReceipt(
    val requestId: UUID,
    val state: DeletionState,
    val targets: List<DeletionEvidence>,
    val completedAt: Instant?,
)

data class DeletionTombstone(
    val subjectDigest: String,
    val scope: DeletionScope,
    val latestRequestId: UUID,
    val deletedAt: Instant,
    val backupExpiryAt: Instant,
    val receiptDigest: String,
)

interface DeletionRepository {
    fun findBySourceEventId(sourceEventId: UUID): DeletionRequest?
    fun insert(request: DeletionRequest): DeletionRequest
    fun lock(requestId: UUID): DeletionRequest
    fun saveState(requestId: UUID, state: DeletionState, completedAt: Instant?): DeletionRequest
    fun evidence(requestId: UUID): List<DeletionEvidence>
    fun saveEvidence(requestId: UUID, evidence: DeletionEvidence)
    fun saveTombstone(tombstone: DeletionTombstone)
    fun findTombstone(subjectDigest: String, scope: DeletionScope): DeletionTombstone?
}
```

`DeletionOrchestrator` validates at startup that every `eraserId` matches `^[a-z][a-z0-9-]{2,63}$` and is globally unique, then indexes handlers by `eraserId`; it never indexes by `DeletionTarget`. Multiple erasers may share a target. `request` uses `sourceEventId` as the idempotency key, stores the raw subject only in the encrypted active request row, and stores the HMAC digest plus sealed scope in the long-lived tombstone. It rejects `CONSENT_REVOKED` unless the scope is `ConsentScope` and rejects `PROFILE_RESET` unless the scope is `ProfileScope`. `run` locks the request, passes the exact scope to every registered eraser, hashes each eraser's non-medical result, clears the raw subject from the request, and marks `COMPLETED` only after all required eraser IDs succeed. Retry reuses the same request and skips eraser IDs with valid stored evidence. `ProfileDeletionPort` maps its `ProfileDeletionCommand.sourceEventId` into `DeletionCommand(source, ProfileScope, PROFILE_RESET, sourceEventId)`. `ConsentRevokedHandler` maps the Task 4 outbox `consent_id` and `purpose` into `ConsentScope`; it never requests `ProfileScope`. REC can later register `personal-records`, `document-objects`, and `hapi-fhir` without adding a foundation enum value, and each must implement both scope branches explicitly.

The migration must include:

```sql
create table deletion_request (
    request_id uuid primary key,
    source_event_id uuid not null unique,
    subject_id varchar(128) null,
    subject_digest char(72) not null,
    scope_type varchar(16) not null check (scope_type in ('CONSENT', 'PROFILE')),
    consent_id uuid null,
    consent_purpose varchar(64) null,
    scope_key char(71) not null,
    reason varchar(32) not null,
    state varchar(24) not null,
    requested_at timestamptz not null,
    deadline_at timestamptz not null,
    completed_at timestamptz null,
    check (
        (scope_type = 'CONSENT' and consent_id is not null and consent_purpose is not null) or
        (scope_type = 'PROFILE' and consent_id is null and consent_purpose is null)
    )
);

create table deletion_target_evidence (
    request_id uuid not null references deletion_request(request_id),
    eraser_id varchar(64) not null,
    target varchar(40) not null,
    completed_at timestamptz not null,
    result_digest char(71) not null,
    primary key(request_id, eraser_id),
    check (eraser_id ~ '^[a-z][a-z0-9-]{2,63}$')
);

create table deletion_tombstone (
    subject_digest char(72) not null,
    scope_key char(71) not null,
    scope_type varchar(16) not null,
    consent_id uuid null,
    consent_purpose varchar(64) null,
    latest_request_id uuid not null references deletion_request(request_id),
    deleted_at timestamptz not null,
    backup_expiry_at timestamptz not null,
    receipt_digest char(71) not null,
    primary key(subject_digest, scope_key)
);
```

`ConsentRevokedHandler` claims `consent.revoked.v1` outbox rows with `FOR UPDATE SKIP LOCKED`, constructs `ConsentScope(consentId, purpose)`, creates the scoped deletion request in the same database transaction, and marks the event published only after the request is durable. Revocation immediately prevents that grant's future processing even while its physical deletion retries; it does not revoke other grants or erase the profile. The consent receipt is retained with its subject link replaced by the tombstone digest; it contains no medical values.

- [ ] **Step 4: Run unit and PostgreSQL deletion tests**

Run: `./gradlew --no-daemon :apps:core-api:test --tests '*Deletion*' --tests '*Consent*'`

Expected: PASS. Duplicate revocation produces one request, failures remain retryable, completion requires evidence from every unique eraser ID, three handlers sharing `USER_OBJECTS` all execute, consent-scoped erasure preserves unrelated grants/profile artifacts, profile reset uses only `ProfileScope`, raw subject is cleared on completion, and `backup_expiry_at` equals `deleted_at + 30 days`.

- [ ] **Step 5: Commit active-system deletion**

```bash
git add apps/core-api/src/main/kotlin/kr/co/genomecompanion/exportdeletion apps/core-api/src/main/resources/db/migration/V3__fnd_deletion_control.sql apps/core-api/src/test/kotlin/kr/co/genomecompanion/exportdeletion
git commit -m "feat: orchestrate revocation-driven deletion"
```

---

### Task 10: Prove backup isolation, restore readiness, and tombstone replay

**Files:**
- Create: `infra/modules/kr-foundation/backup.tf`
- Modify: `infra/modules/kr-foundation/tests/security.tftest.hcl`
- Create: `ops/restore/replay_deletion_tombstones.py`
- Create: `ops/restore/verify_restore.py`
- Test: `ops/restore/test_replay_deletion_tombstones.py`
- Create: `ops/runbooks/backup-restore.md`
- Create: `ops/runbooks/deletion.md`
- Create: `ops/runbooks/security-incident.md`
- Create: `scripts/ci/foundation_acceptance.py`

**Interfaces:**
- Consumes: Task 7 RDS ARN/bucket ARNs/backup account; Task 9 signed deletion-tombstone export; isolated restored database endpoint; synthetic restore fixture.
- Produces: 14-day PITR; daily cross-account copy retained 30 days in Seoul; restore verification JSON with measured RPO/RTO; a readiness marker written only after migration, chain verification, and tombstone replay.

- [ ] **Step 1: Write failing restore/deletion replay and IaC retention tests**

```python
from datetime import datetime, timezone
import unittest

from ops.restore.replay_deletion_tombstones import Tombstone, replay_before_readiness


class FakeRestoredStore:
    def __init__(self) -> None:
        self.artifacts = {
            ("hmac256:" + "b" * 64, "sha256:" + "1" * 64),
            ("hmac256:" + "b" * 64, "sha256:" + "2" * 64),
        }
        self.ready = False

    def erase_by_scope(self, subject_digest: str, scope_key: str) -> int:
        key = (subject_digest, scope_key)
        existed = key in self.artifacts
        self.artifacts.discard(key)
        return int(existed)

    def mark_ready(self) -> None:
        self.ready = True


class RestoreTombstoneReplayTest(unittest.TestCase):
    def test_restored_rows_remain_unavailable_until_later_tombstones_are_replayed(self) -> None:
        store = FakeRestoredStore()
        tombstone = Tombstone(
            subject_digest="hmac256:" + "b" * 64,
            scope_key="sha256:" + "1" * 64,
            scope_type="CONSENT",
            consent_id="00000000-0000-0000-0000-000000000127",
            consent_purpose="RETAIN_VERIFIED_SOURCE",
            deleted_at=datetime(2026, 8, 9, 3, 0, tzinfo=timezone.utc),
            receipt_digest="sha256:" + "c" * 64,
        )

        self.assertFalse(store.ready)
        evidence = replay_before_readiness(
            store=store,
            tombstones=[tombstone],
            restore_point=datetime(2026, 8, 9, 2, 0, tzinfo=timezone.utc),
        )

        self.assertEqual(1, evidence.rows_erased)
        self.assertNotIn(("hmac256:" + "b" * 64, "sha256:" + "1" * 64), store.artifacts)
        self.assertIn(("hmac256:" + "b" * 64, "sha256:" + "2" * 64), store.artifacts)
        self.assertTrue(store.ready)


if __name__ == "__main__":
    unittest.main()
```

Extend `security.tftest.hcl` with assertions that RDS PITR is 14 days, backup copies target the backup account, lifecycle deletion is 30 days, vault-lock minimum and maximum retention are both 30 days, and the vault/key cannot be administered by the application role.

- [ ] **Step 2: Run restore and backup tests and confirm the red state**

Run:

```bash
python -m unittest ops.restore.test_replay_deletion_tombstones -v
build/tools/opentofu/tofu -chdir=infra/modules/kr-foundation test
```

Expected: Python import FAIL for absent replay/readiness types and the OpenTofu test FAIL for absent backup plan/vault-lock assertions.

- [ ] **Step 3: Implement backup and restore gates**

`backup.tf` must select encrypted RDS and user-object resources by explicit ARN, not broad tags. Run continuous RDS recovery plus one daily cross-account copy to the backup account, retained exactly 30 days. The backup vault uses a separate KMS key, a 72-hour Vault Lock changeable period, minimum retention 30 days, and maximum retention 30 days. The application role has no backup permission. User-object buckets do not use indefinite Object Lock; audit manifests/digests use the separate 365-day metadata policy.

`replay_deletion_tombstones.py` accepts only these required arguments:

```text
--database-url
--tombstone-manifest
--manifest-signature
--verification-key
--restore-point-time
--evidence-output
```

Its testable core is:

```python
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from typing import Protocol, Sequence


@dataclass(frozen=True)
class Tombstone:
    subject_digest: str
    scope_key: str
    scope_type: str
    consent_id: str | None
    consent_purpose: str | None
    deleted_at: datetime
    receipt_digest: str


@dataclass(frozen=True)
class ReplayEvidence:
    tombstones_applied: int
    rows_erased: int
    evidence_digest: str


class RestoredStore(Protocol):
    def erase_by_scope(self, subject_digest: str, scope_key: str) -> int:
        raise NotImplementedError

    def mark_ready(self) -> None:
        raise NotImplementedError


def replay_before_readiness(
    store: RestoredStore,
    tombstones: Sequence[Tombstone],
    restore_point: datetime,
) -> ReplayEvidence:
    selected = sorted(
        (item for item in tombstones if item.deleted_at > restore_point),
        key=lambda item: (item.deleted_at, item.subject_digest),
    )
    rows_erased = sum(store.erase_by_scope(item.subject_digest, item.scope_key) for item in selected)
    digest_input = "\n".join(f"{item.scope_key}:{item.receipt_digest}" for item in selected).encode()
    evidence = ReplayEvidence(len(selected), rows_erased, "sha256:" + sha256(digest_input).hexdigest())
    store.mark_ready()
    return evidence
```

It verifies the signature, validates the scope-type/consent-field constraint, selects tombstones newer than the restore point, invokes registered eraser SQL functions with both subject digest and scope key, writes no subject or health value to stdout, and emits counts plus SHA-256 evidence to the supplied evidence file. A consent tombstone deletes only that consent scope; a profile tombstone deletes every scope for the subject. `verify_restore.py` fails unless schema migrations pass, the audit chain verifies, every selected scoped tombstone has zero matching rows after replay, synthetic canaries pass, measured RPO is at most 15 minutes, measured RTO is at most 4 hours, and the restored environment has no production DNS/queue subscription. Only then does it write `restore-ready.json`.

The runbooks must name roles rather than people, include exact AWS CLI read-only discovery commands, require two-person authorization before restore promotion, and state:

- quarterly full restore and evidence review;
- twice-yearly dependency/region outage exercise;
- Korean data remains in Seoul;
- active deletion target is 24 hours;
- backups age out within 30 days;
- a restored backup is never attached to production before tombstone replay;
- incident preservation never copies C3 data into tickets, chat, email, or foreign forensic services;
- logs are tamper-evident/resistant, not tamper-proof.

Create `scripts/ci/foundation_acceptance.py` to run, in order, repository tests, Gradle tests, SBOM generation, OpenTofu format/validate/tests, workflow-security verification, OpenTelemetry policy tests, Gitleaks, and Trivy. It emits a JSON summary containing command, exit code, duration, Git commit, and artifact digest, but no environment dump.

- [ ] **Step 4: Run the complete foundation acceptance suite**

Run:

```bash
python scripts/ci/foundation_acceptance.py
git diff --check
```

Expected: exit 0; generated evidence records all checks as PASS; RPO/RTO assertions are present; no tracked secret/state file exists; no prohibited endpoint, PHI telemetry attribute, unsigned release path, public compute/database, non-Seoul personal-data resource, or deletion-before-restore gap is detected.

- [ ] **Step 5: Commit backup, restore, deletion, and incident foundations**

```bash
git add infra/modules/kr-foundation/backup.tf infra/modules/kr-foundation/tests/security.tftest.hcl ops/restore ops/runbooks scripts/ci/foundation_acceptance.py
git commit -m "feat: prove backup restore and deletion recovery"
```

---

### Task 11: Publish machine-checked compliance and control evidence

**Files:**
- Create: `governance/compliance/control-matrix.schema.json`
- Create: `governance/compliance/control-matrix.yaml`
- Test: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/compliance/ControlMatrixContractTest.kt`

**Interfaces:**
- Consumes: Evidence paths produced by Tasks 3–10; official framework/law URLs; reviewer role names; ISO-8601 review dates.
- Produces: `control-matrix.yaml` rows with `control_id`, `framework`, `requirement`, `applicability`, `owner`, `evidence_paths`, `review_date`, `residual_gap`, and `source_urls`; machine-checked assurance statement that the matrix does not assert automatic compliance or certification.

- [ ] **Step 1: Write the failing matrix contract test**

```kotlin
class ControlMatrixContractTest {
    private val repository = Path.of("../..").toAbsolutePath().normalize()
    private val json = ObjectMapper()
    private val yaml = ObjectMapper(YAMLFactory()).registerKotlinModule()

    @Test
    fun `every control is reviewer-owned evidenced dated applicable and gap-aware`() {
        val schema = json.readTree(repository.resolve("governance/compliance/control-matrix.schema.json").toFile())
        val matrix = yaml.readTree(repository.resolve("governance/compliance/control-matrix.yaml").toFile())
        val required = schema.at("/properties/controls/items/required").map(JsonNode::asText).toSet()
        val applicability = schema.at("/properties/controls/items/properties/applicability/enum")
            .map(JsonNode::asText)
            .toSet()

        assertThat(matrix["automatic_compliance_claim"].asBoolean()).isFalse()
        assertThat(matrix["assurance_statement"].asText()).contains("does not assert automatic compliance")
        matrix["controls"].forEach { row ->
            assertThat(row.fieldNames().asSequence().toSet()).containsAll(required)
            assertThat(applicability).contains(row["applicability"].asText())
            assertThat(row["owner"].asText()).isNotBlank()
            assertThat(row["residual_gap"].asText()).isNotBlank()
            LocalDate.parse(row["review_date"].asText())
            row["evidence_paths"].forEach { evidence ->
                assertThat(repository.resolve(evidence.asText())).exists()
            }
        }
    }

    @Test
    fun `required current and future frameworks have truthful applicability`() {
        val matrix = yaml.readTree(repository.resolve("governance/compliance/control-matrix.yaml").toFile())
        val rows = matrix["controls"].associateBy { it["control_id"].asText() }
        assertThat(rows.keys).contains(
            "PIPA-SENSITIVE-CONSENT",
            "PIPA-KR-RESIDENCY-PROCESSORS",
            "PIPA-RIGHTS-DELETION",
            "PIPA-BREACH-RESPONSE",
            "ISMSP-READINESS",
            "NIST-ZT-800-207",
            "OWASP-ASVS",
            "NIST-SSDF",
            "SLSA-PROVENANCE",
            "HIPAA-FUTURE-US-ROLE",
        )
        assertThat(rows.getValue("HIPAA-FUTURE-US-ROLE")["applicability"].asText())
            .isEqualTo("future_us_role_assessment")
        assertThat(rows.getValue("HIPAA-FUTURE-US-ROLE")["residual_gap"].asText())
            .contains("not a current certification")
    }
}
```

- [ ] **Step 2: Run the contract test and confirm the red state**

Run: `./gradlew --no-daemon :apps:core-api:test --tests '*ControlMatrixContractTest'`

Expected: FAIL because the schema and matrix files do not exist.

- [ ] **Step 3: Create the schema and reviewer-sized control matrix**

Reuse the BOM-managed `jackson-yaml` test dependency and committed lock added by Task 4 for the consent OpenAPI contract. This task makes no dependency or lockfile change.

Create this complete schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Genome Companion Korea Control Evidence Matrix",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "assurance_statement", "automatic_compliance_claim", "last_reviewed", "controls"],
  "properties": {
    "schema_version": { "const": 1 },
    "assurance_statement": { "type": "string", "minLength": 40 },
    "automatic_compliance_claim": { "const": false },
    "last_reviewed": { "type": "string", "format": "date" },
    "controls": {
      "type": "array",
      "minItems": 10,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["control_id", "framework", "requirement", "applicability", "owner", "evidence_paths", "review_date", "residual_gap", "source_urls"],
        "properties": {
          "control_id": { "type": "string", "pattern": "^[A-Z0-9-]+$" },
          "framework": { "type": "string", "minLength": 3 },
          "requirement": { "type": "string", "minLength": 20 },
          "applicability": {
            "enum": ["current_law_likely_applicable", "certification_readiness", "security_best_practice", "future_us_role_assessment"]
          },
          "owner": { "type": "string", "minLength": 3 },
          "evidence_paths": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 3 } },
          "review_date": { "type": "string", "format": "date" },
          "residual_gap": { "type": "string", "minLength": 15 },
          "source_urls": { "type": "array", "minItems": 1, "items": { "type": "string", "format": "uri" } }
        }
      }
    }
  }
}
```

Create `control-matrix.yaml` with these complete baseline rows; evidence paths may be added but none may be removed without security/privacy-owner approval:

```yaml
schema_version: 1
assurance_statement: "This matrix maps planned and tested evidence; it does not assert automatic compliance, legal approval, or certification."
automatic_compliance_claim: false
last_reviewed: "2026-08-09"
controls:
  - control_id: PIPA-SENSITIVE-CONSENT
    framework: Korean PIPA sensitive-data lifecycle
    requirement: Separate explicit grants bind sensitive-data purpose, operation, processor set, expiry, and revocation.
    applicability: current_law_likely_applicable
    owner: Privacy Lead
    evidence_paths: ["apps/core-api/src/test/kotlin/kr/co/genomecompanion/consentpurpose/ConsentApplicationServiceTest.kt"]
    review_date: "2026-09-30"
    residual_gap: Korean privacy counsel must approve final notices, lawful bases, processor terms, and production network behavior.
    source_urls: ["https://law.go.kr/LSW/lsInfoP.do?lsiSeq=270351"]
  - control_id: PIPA-KR-RESIDENCY-PROCESSORS
    framework: Korean PIPA overseas-transfer and processor controls
    requirement: Personal workloads, support, telemetry, keys, and backups remain in Seoul with a versioned Korean processor set.
    applicability: current_law_likely_applicable
    owner: Privacy Lead
    evidence_paths: ["infra/modules/kr-foundation/tests/security.tftest.hcl"]
    review_date: "2026-09-30"
    residual_gap: Service-by-service subprocessor and remote-support verification remains required before every production release.
    source_urls: ["https://www.pipc.go.kr/np/default/page.do?mCode=D060040010"]
  - control_id: PIPA-RIGHTS-DELETION
    framework: Korean PIPA rights retention and deletion
    requirement: Revocation is consent-scoped, profile reset is explicit, active deletion is evidenced, and restore replays scoped tombstones.
    applicability: current_law_likely_applicable
    owner: Privacy Engineering Lead
    evidence_paths: ["apps/core-api/src/test/kotlin/kr/co/genomecompanion/exportdeletion/DeletionOrchestratorTest.kt", "apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/SensitiveActionAuthorizerTest.kt", "ops/runbooks/deletion.md"]
    review_date: "2026-09-30"
    residual_gap: Counsel must approve disclosed active-system and 30-day backup aging periods and any legally required retention segregation.
    source_urls: ["https://www.law.go.kr/LSW/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1020398651"]
  - control_id: PIPA-BREACH-RESPONSE
    framework: Korean personal-information breach response
    requirement: Incident roles preserve evidence, revoke access, classify sensitive-data impact, and support Korean notification decisions.
    applicability: current_law_likely_applicable
    owner: Security Incident Commander
    evidence_paths: ["ops/runbooks/security-incident.md"]
    review_date: "2026-09-30"
    residual_gap: Named counsel regulator and user-notification contacts plus a completed tabletop are required before beta.
    source_urls: ["https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=C020010000&nttId=8868"]
  - control_id: ISMSP-READINESS
    framework: ISMS-P readiness
    requirement: Risk access incident continuity privacy and supplier evidence is retained from foundation release onward.
    applicability: certification_readiness
    owner: Security Governance Lead
    evidence_paths: ["governance/compliance/control-matrix.yaml", "scripts/ci/foundation_acceptance.py"]
    review_date: "2026-12-31"
    residual_gap: Current mandatory-scope thresholds require annual legal review and no ISMS-P certification is claimed by this matrix.
    source_urls: ["https://www.isms-p.or.kr/cert/aply/selectCertTrgtDetail.do"]
  - control_id: NIST-ZT-800-207
    framework: NIST SP 800-207 Zero Trust
    requirement: Consumer workforce and workload requests authenticate explicitly and authorize least privilege without network trust.
    applicability: security_best_practice
    owner: Platform Security Lead
    evidence_paths: ["apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/SecurityConfigurationTest.kt", "apps/core-api/src/test/kotlin/kr/co/genomecompanion/identityaccount/SensitiveActionAuthorizerTest.kt", "infra/modules/kr-foundation/tests/security.tftest.hcl"]
    review_date: "2026-09-30"
    residual_gap: Workforce device posture just-in-time privilege and production break-glass exercises remain beta gates.
    source_urls: ["https://csrc.nist.gov/pubs/sp/800/207/final"]
  - control_id: OWASP-ASVS
    framework: OWASP Application Security Verification Standard
    requirement: Authentication authorization validation error handling logging and API boundaries receive repeatable negative tests.
    applicability: security_best_practice
    owner: Application Security Lead
    evidence_paths: ["apps/core-api/src/test/kotlin/kr/co/genomecompanion/architecture/ModuleBoundaryTest.kt", ".github/workflows/ci.yml"]
    review_date: "2026-09-30"
    residual_gap: A version-pinned ASVS requirement-by-requirement review and independent authenticated penetration test remain before beta.
    source_urls: ["https://owasp.org/www-project-application-security-verification-standard/"]
  - control_id: NIST-SSDF
    framework: NIST SP 800-218 Secure Software Development Framework
    requirement: Protected review scanning dependency pinning SBOM vulnerability handling and release evidence gate every change.
    applicability: security_best_practice
    owner: Application Security Lead
    evidence_paths: [".github/workflows/ci.yml", "scripts/ci/verify_workflow_security.py"]
    review_date: "2026-09-30"
    residual_gap: Production vulnerability disclosure coordinated response exercise and measured patch-SLA evidence remain before beta.
    source_urls: ["https://csrc.nist.gov/pubs/sp/800/218/final"]
  - control_id: SLSA-PROVENANCE
    framework: SLSA build and provenance controls
    requirement: Releases bind source base image SBOM result digest identity signature and provenance before protected deployment.
    applicability: security_best_practice
    owner: Release Engineering Lead
    evidence_paths: [".github/workflows/release.yml", "supply-chain.lock.json"]
    review_date: "2026-09-30"
    residual_gap: Achieved SLSA level must be independently assessed against the final hosted builder and cannot be inferred from a signature alone.
    source_urls: ["https://slsa.dev/spec/v1.1/"]
  - control_id: HIPAA-FUTURE-US-ROLE
    framework: HIPAA future US role assessment
    requirement: A separate US data plane receives covered-entity business-associate contract and data-flow analysis before US processing.
    applicability: future_us_role_assessment
    owner: US Privacy Counsel
    evidence_paths: ["docs/superpowers/specs/2026-08-08-genome-companion-program-design.md"]
    review_date: "2027-03-31"
    residual_gap: HIPAA role BAA state-law and FTC analysis is not performed here and is not a current certification or Korea launch claim.
    source_urls: ["https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html"]
```

- [ ] **Step 4: Validate matrix structure, evidence existence, and applicability language**

Run:

```bash
./gradlew --no-daemon :apps:core-api:test --tests '*ControlMatrixContractTest'
python scripts/ci/foundation_acceptance.py
```

Expected: PASS. All ten baseline rows contain the required reviewer fields, every evidence path exists, dates parse, all required frameworks are present, HIPAA is future-role-only, and automatic compliance/certification remains false.

- [ ] **Step 5: Commit the control-evidence deliverable**

```bash
git add governance/compliance/control-matrix.schema.json governance/compliance/control-matrix.yaml apps/core-api/src/test/kotlin/kr/co/genomecompanion/compliance/ControlMatrixContractTest.kt
git commit -m "docs: add machine-checked control evidence matrix"
```

---

## Final release-evidence checklist

Run this only after all eleven task commits exist:

```bash
python scripts/ci/foundation_acceptance.py
./gradlew --no-daemon :apps:core-api:test
build/tools/opentofu/tofu fmt -check -recursive infra
build/tools/opentofu/tofu -chdir=infra/modules/organization test
build/tools/opentofu/tofu -chdir=infra/modules/kr-foundation test
git diff --check
git status --short
```

Expected results:

- Every command exits 0.
- `git status --short` is empty.
- HAPI resolves once at 8.10.1; Medplum, Kubernetes, genomic parsers, LLM SDKs, advertising SDKs, and MyHealthWay connectors are absent.
- Root version pins match the shared monorepo contract, and Flyway versions are unique within the reserved FND/PUB/REC ranges.
- Anonymous and wrong-audience personal API requests fail closed.
- Ed25519 service and purpose JWTs have the exact AI claim contracts, valid signatures, opaque purpose subjects, unique purpose `jti`, and 120-second lifetimes.
- Timeline `{COLLECT, EXPLAIN}`, Korean cloud processing `{COLLECT, EXTRACT, NORMALIZE}`, and verified-source retention `{RETAIN}` are separate subject/purpose/region-scoped grants; upload requires both timeline and cloud grants, and retention is absent by default and reversible.
- Export and profile reset use distinct scopes and reject unvalidated, stale, weak-method, or non-KR authentication without logging raw tokens.
- `packages/contracts/openapi/consent-api-v1.yaml` is OpenAPI 3.1, exposes exactly `getConsentOptions`, `grantConsent`, `listConsents`, and `revokeConsent`, matches the native consent/options/receipt enums, and carries the 300-second sensitive-action assurance problem used by generated UX clients.
- Audit chain mutation/reordering/deletion tests pass without placing PHI in the chain.
- PHI-safe telemetry tests and collector allowlist tests pass.
- AWS plans show eight accounts, Seoul-only personal resources, three AZs, private compute/database, distinct KMS keys, protected log/backup accounts, and a separate `PublicDataApplication` service with no personal credentials, grants, routes, or database reachability.
- CI has no mutable action references or long-lived AWS key path; SBOM, scan, signature, provenance, and immutable image digest are required for release.
- Active deletion completes or remains visibly retryable; completion never hides a failed eraser ID, multiple handlers may share a target, consent revocation preserves unrelated grants/profile data, and only profile reset uses `ProfileScope`.
- Restores cannot become ready until scoped tombstones newer than the recovery point are replayed and verified without widening a consent deletion into a profile deletion.
- The control matrix has current PIPA duties, ISMS-P readiness, NIST Zero Trust, OWASP ASVS, NIST SSDF, SLSA, and future-US HIPAA role rows with owners, evidence, review dates, applicability, and residual gaps; it asserts no automatic compliance or certification.
- No documentation or UI claim calls the platform tamper-proof or calls server-side envelope encryption E2EE.

## Execution boundaries

- Stop before any real AWS organization/account creation or production apply unless the founder separately authorizes that external state change and supplies approved account emails, domains, certificates, alert destinations, OIDC roles, and backend configuration through the protected deployment environment.
- Stop before starting core/worker traffic until the FND `prepare-key` no-NAT state machine has generated and correspondence-verified the non-exportable Ed25519 key VersionId, both public documents have passed the twelve-domain broker's independent domain/security approval workflows, the exact pair has been staged without changing ACTIVE, candidate workers have produced the two-snapshot quorum, and the FND promotion state machine has completed its candidate-only first-install (or dual-key upgrade) core readiness → single ACTIVE CAS → 150-second drain drill. Private key material never enters OpenTofu state, repository history, a workflow, or an operator CLI.
- Stop before processing any real health data until Korean privacy/healthcare counsel, MFDS intended-use review, processor/transfer inventory, incident contacts, and beta privacy artifacts are approved.
- A future US plane, clinical/FHIR resources, document parser, public-data connectors, user interface, payment, MyHealthWay, genetic wallet, AI explanation worker, and regulated module each require a separate implementation plan.

## Implementation handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-09-platform-foundation-security.md`.

Two execution options:

1. **Subagent-Driven (recommended):** use `superpowers:subagent-driven-development`, dispatch a fresh implementation agent per task, and run specification then quality review between commits.
2. **Inline Execution:** use `superpowers:executing-plans`, implement in bounded batches, and stop at the review checkpoints before organization or production changes.
