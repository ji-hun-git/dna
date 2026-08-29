# ADR-001: Application trust boundary

- **Status:** Accepted for foundation implementation
- **Decision date:** 2026-08-30
- **Applies to:** synthetic foundation work only
- **Real PHI:** prohibited

## Context

At decision time, the repository had a Next.js presentation application and a Spring Boot skeleton. TypeScript modules under `apps/web/lib` modeled OAuth, consent, model-runner, and research contracts, but there were no Next route handlers. Spring had three ports and no executable lifecycle. The implementation checkpoint below records what has changed since that baseline.

The DataON/AIDA evidence route is an offline public-metadata prototype. It does not belong inside the future personal-health-data credential or network boundary.

## Options considered

1. **Spring owns the public BFF and PHI plane; Next remains UI-only.** One authoritative security boundary and one server-side token owner.
2. **Next owns the public BFF; Spring is private.** Viable, but it would require moving the existing Spring domain direction behind a new TypeScript authority.
3. **Spring and Next are co-equal public backends.** Rejected because rules and credentials would be duplicated across two attack surfaces.

## Decision

Choose option 1.

| Responsibility | Authoritative owner |
|---|---|
| Browser rendering and interaction | Next.js `apps/web` |
| OAuth broker and provider tokens | Spring `apps/core-api` |
| Opaque application session | Spring |
| CSRF and origin enforcement | Spring |
| Object- and purpose-level authorization | Spring |
| Consent, documents, records, provenance, audit, deletion | Spring |
| PHI-capable persistence and object-store credentials | Spring and isolated ingestion worker only |
| DataON/AIDA research evidence | Separate research application/deployment |

Provider access and refresh tokens never enter browser JavaScript. The intended topology is one browser-visible origin at an ingress/reverse proxy, with UI and `/api` traffic routed behind that origin. Spring is the only public application authority behind the ingress; the future worker is private and receives narrowly scoped jobs.

The PHI trust boundary includes Spring, its session store, PostgreSQL, quarantine/approved object storage, and the isolated worker. Next static/browser code, public-data tooling, and the research evidence agent remain outside it and receive no PHI-plane credentials.

## Consequences

- `apps/web` must not add OAuth callbacks, provider token exchange, durable PHI writes, or independent authorization APIs.
- Existing TypeScript security modules remain **CONTRACT ONLY** until converted to backend-neutral test vectors or implemented authoritatively in Spring.
- Spring must centralize authorization rather than scattering ownership checks across controllers.
- The research evidence agent may stay in the monorepo for now, but must become a distinct build/deployment identity with separate credentials, logs, network policy, and data stores before any PHI-capable environment exists.
- Production same-origin ingress, object storage, and the ingestion worker are **NOT IMPLEMENTED**. Local Spring sessions and PostgreSQL are now implemented for synthetic verification only.

## Migration plan

1. Preserve the TypeScript contracts as adversarial fixtures; do not create Next API routes.
2. Implement a local identity broker substitute, opaque session, and central authorization service in Spring. **Completed locally for the foundation slice.**
3. Add PostgreSQL/Flyway and a synthetic-only consent-to-record schema. **Completed locally.**
4. Add quarantine object storage and a network-isolated deterministic worker.
5. Route one synthetic lifecycle through Spring and persistence; replace React-memory success states with server state. **Lifecycle verified; visible UI replacement remains open.**
6. Move `research-data` into its own application target and deny it PHI database/object-store credentials.
7. Add same-origin ingress only after the local vertical slice passes negative authorization and deletion tests.

## Evidence and enforcement

- UI-only route inventory: `apps/web/app/**/page.tsx`; there are no `route.ts` handlers.
- Current Spring capability and remaining gaps are recorded in `docs/status/2026-08-30/backend-report.md`.
- Current module boundary tests: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/architecture/ModuleBoundaryTest.kt`.
- Prohibited public/medical route tests: `apps/core-api/src/test/kotlin/kr/co/genomecompanion/architecture/ProhibitedRouteTest.kt`.
- External identity remains disabled in `apps/web/app/connections/page.tsx` and the tested experience it renders.

## Implementation checkpoint

The synthetic foundation now implements a partial form of this decision:

- Spring owns the opaque session, CSRF/origin enforcement, consent, owner-scoped authorization, document metadata, candidate/record persistence, audit, and deletion.
- Next has a configuration-only same-origin rewrite and no API route handler or duplicate authorization rule.
- PostgreSQL/Flyway and a local digest-allowlisted quarantine path are verified locally.

The isolated worker, production object store, ingress, production session infrastructure, external connectors, and research deployment separation remain not implemented. This ADR does not imply that those missing boundaries exist.
