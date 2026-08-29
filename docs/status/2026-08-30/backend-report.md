# Backend and server-logic report

## Runtime inventory

The repository contains two different kinds of backend work. They must not be confused.

1. `apps/core-api`: a Kotlin/Spring Boot application skeleton intended to become the personal health-record core.
2. `apps/web/lib`: tested TypeScript contracts and deterministic safety logic, some marked server-only, but not exposed through HTTP routes or connected to production infrastructure.

## Kotlin/Spring core API

### What exists

- Java 21 toolchain and Kotlin/Spring Boot build.
- Spring Web, Security, OAuth2 resource server, Actuator, JDBC, Validation, Flyway, PostgreSQL, HAPI FHIR R4, ArchUnit, and Testcontainers dependencies.
- A bootable `CoreApiApplication` with one cached HAPI FHIR R4 context bean.
- A component-scan exclusion that keeps the public-data package out of the personal-data application.
- Three public port contracts:
  - `DocumentIntakePort.requestUpload`
  - `HealthRecordQuery.findBySubjectAndId`
  - `ProfileDeletionPort.requestDeletion`
- Architecture tests for public/personal module separation and absent prohibited medical/genomic/referral/training routes.

### What does not exist

- REST controllers or mapped product endpoints: **0**.
- Implementations of the three port interfaces: **0**.
- Database migrations or SQL schemas: **0**.
- Entities, repositories, transactions, or production datasource configuration: **0**.
- Implemented identity/account, consent, authorization, audit, export, deletion, document, or health-record modules beyond the three interfaces.
- FHIR resource parsing, validation, persistence, search, versioning, or provenance endpoints.
- Object storage, malware scanning, work queue, OCR worker, notification worker, or scheduled deletion jobs.

Declaring JDBC, Flyway, PostgreSQL, and HAPI FHIR dependencies does not make these systems operational. The smoke tests explicitly exclude datasource and Flyway autoconfiguration.

## TypeScript server and domain modules

| Module | Executable local capability | Production connection |
|---|---|---|
| OAuth transaction | Creates bounded state/nonce/PKCE material; validates callback state, expiry, replay marker, and PKCE secret; verifies bounded local JWKS ID tokens | **None.** No start/callback route, token exchange, transaction store, session cookie, provider client, or account store |
| Anti-hack workflow | Strict attack-signal schema, risk/disposition mapping, HMAC-redacted event construction | **None.** Actions such as revoke, rotate, rate-limit, alert, and freeze are returned as instructions, not performed by infrastructure |
| Local document inspection | Browser-side size/type/signature checks and SHA-256 receipt | **None.** No upload, quarantine, scan, OCR, or persisted receipt |
| Medical document evaluation | Scores strict synthetic extraction runs and enforces exact candidate-only thresholds | **Synthetic fixture only** |
| Offline/OCI medical runner | Builds digest-bound, network-free job contracts and verifies signed immutable approvals | **No Docker runtime, downloaded weights, reviewed artifacts, or real inference path** |
| Research evidence agent | Deterministic offline ranking, rights decisions, source fingerprints, drift blocks, and evidence package | **Offline snapshot only.** Live AIDA/DataON connectors are disabled |
| Public provider data | Strict schema for synthetic provider and price rows | **No HIRA/NHIS/MOHW network adapter** |
| Consent and record views | Strict synthetic view models | **No durable consent ledger or record service** |

There are **zero** `app/**/route.ts` handlers. The server-marked libraries therefore remain internal code and test harnesses rather than an application backend.

## Data architecture state

| Capability | Current state |
|---|---|
| Relational database | Not implemented |
| Schema migrations | Not implemented |
| Object/document storage | Not implemented |
| Session/transaction store | Not implemented |
| Cache/rate-limit store | Not implemented |
| Queue/job orchestration | Not implemented |
| Audit-event persistence | Not implemented |
| Backup/restore/deletion tombstones | Not implemented |
| Observability pipeline | Not implemented |
| Secrets manager integration | Contract references only |

No real personal health information should enter this repository or application in its current state.

## Boundary strengths already present

- Public research/public-provider data and personal record concepts are kept logically separate.
- Medical extraction output is modeled as a candidate awaiting human confirmation, not clinical truth.
- OAuth account identity is issuer plus subject, not profile email.
- Research rights default to blocked or metadata-only.
- Prohibited diagnosis, prescription, raw-genome, referral-commission, and user-data-training routes are tested as absent.

These are good invariants to preserve when real services are added.

## Backend verdict

The backend is not an MVP backend yet. It is a solid set of domain seams, security contracts, and testable safety invariants around a bootable Spring shell. The next meaningful milestone is one complete, synthetic end-to-end vertical slice with real local persistence—not additional disconnected interfaces.

