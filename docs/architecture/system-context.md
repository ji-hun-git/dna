# System context

**Evidence date:** 2026-08-30  
**Scope:** executable local system with synthetic data only  
**Real PHI:** prohibited

## Executable context

```text
Browser
  |  UI pages and same-origin /api/foundation requests
  v
Next.js web (presentation only)
  |  validated rewrite when GC_CORE_API_ORIGIN is set
  v
Spring core API (session, authorization, consent, lifecycle authority)
  |                         |
  v                         v
PostgreSQL 16.15       Local quarantine directory
```

The browser E2E test executes this entire path with a digest-allowlisted synthetic PDF. Next has no `route.ts` handlers and does not own provider tokens, authorization decisions, consent, or durable health state.

## Component truth

| Component | Current capability | Status |
|---|---|---|
| `apps/web` | Six Korean-first product routes, synthetic UX, validated same-origin Spring rewrite | VERIFIED LOCALLY / DEMO ONLY |
| `apps/core-api/foundation` | Opaque session, Origin/CSRF checks, purpose grant, local quarantine, candidate confirmation, record reload, revocation, deletion, safe audit | VERIFIED LOCALLY with synthetic data |
| `identityaccount` | Strict JWT issuer/audience/client/claim boundary and Ed25519 workload-token contract | VERIFIED LOCALLY; external issuer DISABLED |
| `consentpurpose` | Durable purpose consent, subject-scoped reads, revoke outbox | VERIFIED LOCALLY with PostgreSQL |
| `audit` and telemetry | Hash-chained append-only schema, PHI-safe log facade and collector policy | VERIFIED LOCALLY; no production sink |
| `infra/modules/organization` | Seven-account AWS Organizations boundary and Seoul-region/security SCP tests | VERIFIED LOCALLY with OpenTofu; no AWS apply |
| Research evidence route | Offline DataON/AIDA metadata prototype in the web build | DEMO ONLY; separation NOT IMPLEMENTED |
| External providers | Kakao, Naver, MyHealthWay, DataON, AIDA, public health datasets | DISABLED / EXTERNAL GATE |
| OCR/model worker | No admitted production artifact or isolated worker | NOT IMPLEMENTED |

## Trust decisions

- Spring is the sole application/session/authorization authority.
- Next remains presentation and same-origin forwarding only.
- External provider tokens must never enter browser JavaScript.
- The research-data product must receive a separate build identity, network policy, and credentials before any PHI-capable environment exists.
- The local filesystem quarantine is test evidence, not a production object store.

See [ADR-001](ADR-001-application-trust-boundary.md), [data flow](data-flow.md), and the [release gate](../release/readiness.md).
