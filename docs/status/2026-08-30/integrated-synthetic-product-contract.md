# Integrated Synthetic Product contract

**Milestone:** Integrated Synthetic Product
**Baseline:** `54f9bf958c176989a5dea03f6bf391a1fa3e10fc`
**Data boundary:** allowlisted synthetic PDF only; no PHI, provider credential, external account, or deployment
**Authority:** Browser/Next presentation → same-origin rewrite → Spring domain authority → PostgreSQL

This contract freezes feature expansion until the visible Korean product is a truthful client of the existing durable synthetic lifecycle. Next.js presents and forwards. Spring authenticates, authorizes, validates transitions, and owns mutations. PostgreSQL is the durable source of application truth.

## Vocabulary invariants

- `QUARANTINED` in this milestone means a **logical development state** backed by a local allowlisted file. It is not a hostile-file security quarantine boundary.
- The audit trail is **database-protected, hash-chained, and tamper-evident**. It is not described as immutable until it is anchored outside the database administrative trust domain.
- `FHIR structurally valid`, `KR Core valid`, `supported by import policy`, `MyHealthWay conformant`, and `clinically correct` are separate verdicts.
- Kakao, Naver, MyHealthWay, OCR/model execution, production infrastructure, and real health data remain disabled.

## Authoritative transition map

| User-visible transition | HTTP operation | Spring authority | PostgreSQL mutation/read | Safe audit event | Required failure state |
|---|---|---|---|---|---|
| Initialize application | `GET /api/foundation/session` | active opaque session | active session read | none | `authentication_required` / `session_expired` |
| Synthetic sign-in | `POST /api/foundation/session` | allowlisted synthetic identity | subject + session insert | `SESSION_CREATED` | `forbidden` |
| Load document consent | `GET /api/foundation/consents/document-extraction` | subject ownership | latest consent read | none | `authentication_required` |
| Grant document consent | `POST /api/foundation/consents/document-extraction` | session + Origin + CSRF | active consent insert/read | `CONSENT_GRANTED` | `forbidden` / `validation_error` |
| Request intake | `POST /api/foundation/documents` | active purpose consent + idempotency | document request insert | `DOCUMENT_REQUESTED` | `consent_required` / `consent_revoked` / `conflict` |
| Upload allowlisted fixture | `PUT /api/foundation/documents/{id}/content` | owner + consent + bounded media | document becomes `QUARANTINED` | `DOCUMENT_QUARANTINED` | `upload_rejected` / `conflict` |
| Read intake state | `GET /api/foundation/documents/{id}` | owner | document read | denied access only | `resource_not_found` |
| Inspect fixture | `POST /api/foundation/documents/{id}/inspection` | owner + consent + digest allowlist | `INSPECTED` or `REJECTED` | inspected/rejected event | `invalid_state_transition` |
| Extract candidate | `POST /api/foundation/documents/{id}/extraction` | owner + consent + inspected state | job + candidate insert | `CANDIDATE_CREATED` | `invalid_state_transition` |
| Inspect candidate/source | `GET /api/foundation/candidates/{id}` | owner | candidate + source metadata read | denied access only | `resource_not_found` |
| Confirm/correct candidate | `POST /api/foundation/candidates/{id}/confirmation` | owner + consent + idempotency | candidate decision + record/version insert | `CANDIDATE_CONFIRMED` or `CANDIDATE_CORRECTED` | `conflict` |
| Exclude candidate | `POST /api/foundation/candidates/{id}/exclusion` | owner + consent + idempotency | candidate becomes `EXCLUDED` | `CANDIDATE_EXCLUDED` | `conflict` |
| Load Health History | `GET /api/foundation/records` | owner from session, never request subject | records/current versions read | denied access only | `authentication_required` |
| Inspect record provenance | `GET /api/foundation/records/{id}` | object-level owner check | joined record/candidate/document read | denied access only | `resource_not_found` |
| Correct saved record | `POST /api/foundation/records/{id}/corrections` | owner + consent + idempotency | prior version superseded; new current version inserted | `RECORD_CORRECTED` | `conflict` |
| Revoke consent | `POST /api/foundation/consents/{id}/revocation` | object-level owner check | consent becomes `REVOKED` | `CONSENT_REVOKED` | `resource_not_found` |
| Request profile deletion | `DELETE /api/foundation/profile` | active session + Origin + CSRF | synthetic profile lifecycle deleted; completion receipt retained | request + completion events | `session_expired` |

## Browser state contract

The browser may show in-flight states only while the corresponding request is unresolved. Durable labels (`QUARANTINED`, `INSPECTED`, `REVIEW_REQUIRED`, `REVOKED`, `COMPLETED`) must come from a validated Spring response. There is no timer-driven fake progress.

The authenticated shell distinguishes:

- `INITIALIZING_SESSION`
- `AUTHENTICATED`
- `UNAUTHENTICATED`
- `SESSION_EXPIRED`
- `AUTHORIZATION_DENIED`

Critical state changes use the opaque HttpOnly session cookie, an Origin check, the synchronizer CSRF value, and an idempotency key where replay could duplicate a resource. No token is stored in Web Storage.

## Release boundary

Passing this contract can yield at most `INTEGRATED SYNTHETIC PRODUCT — GO`. Hosted staging, hostile-file quarantine, production OCR, external providers, real-data beta, and production remain separate NO-GO gates.
