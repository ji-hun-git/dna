# Data flow

**Status:** current executable synthetic path plus explicitly absent production paths

## Durable synthetic lifecycle

```text
local credential
  -> opaque application session + CSRF token
  -> purpose consent
  -> upload request
  -> digest-allowlisted synthetic PDF in local quarantine
  -> deterministic inspection and real ClamAV adapter contract
  -> leased extraction job processed by the separate worker
  -> candidate with source page/digest
  -> explicit user confirmation
  -> durable record + provenance
  -> reload from PostgreSQL
  -> consent revocation
  -> prohibited operations denied
  -> deletion request
  -> record/document/session deletion + content-free audit evidence
```

Evidence: `FoundationLifecyclePostgresIntegrationTest.kt` and `foundation-lifecycle.spec.ts`.

## Authentication and consent boundary

```text
JWT caller (synthetic test issuer)
  -> Spring resource-server validation
  -> normalized principal/scopes
  -> method authorization
  -> exact purpose/data/operation consent
  -> subject-scoped JDBC query
  -> consent row + idempotent revoke outbox
```

Provider login and health-data authorization are separate future flows. Kakao/Naver identity will not grant MyHealthWay or application processing consent.

## Data stores

| Store | Current content | Current protection | Production gap |
|---|---|---|---|
| PostgreSQL | synthetic subjects, sessions, consent, document metadata, candidates, records, deletion, audit, outbox | constraints, parameterized SQL, transactions, subject predicates | TLS/roles/RLS/backup/restore/managed encryption absent |
| Local trust zones | allowlisted synthetic PDF fixtures and safe previews | generated UUID path, normalized roots, size/type/digest gate, exact-byte rehash, ClamAV adapter and worker contract | hosted object storage, official-signature operations, IAM and network isolation absent |
| Browser | UI state and opaque cookie only | no provider tokens or durable PHI path | production CSP/session edge evidence absent |
| Logs | correlation and enumerated safe events | request details disabled; PHI-safe facade | centralized immutable production sink absent |

## Explicitly absent flows

- No Kakao/Naver authorization callback or token exchange.
- No MyHealthWay request.
- No live DataON/AIDA or public-health connector.
- No unrestricted real-document parser, hosted operational malware-signature feed, OCR/model inference, or GPU worker.
- No production export, backup, restore, support, analytics, or administrator access path.
