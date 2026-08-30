# Research runtime separation

**Evidence date:** 2026-08-30
**Scope:** local builds; synthetic/public metadata only
**Hosted deployment:** not implemented

## Local trust-plane proof

| Boundary | Health product | Research product |
|---|---|---|
| Package | `@gc/web` | `@gc/research-web` |
| Application ID | `genome-companion-korea-web` | `genome-companion-research-web` |
| Readiness identity | `/healthz` → `health-product` | `/healthz` → `public-research` |
| Durable health API | same-origin Spring rewrite when explicitly configured | none |
| Research implementation | absent | offline public-metadata modules |
| Credentials refused | AIDA, DataON, research DB/storage | health DB, audit, quarantine, session identity and health object storage |
| Personal health data | integrated synthetic path only | not accepted |

The health build contains no `/research-data` route, research component, research library or research connector. The research build contains no health API client, `GC_SESSION`/`GC_CSRF` contract or Spring origin. Each Next configuration fails closed if credentials from the other trust plane are present.

## What this proves

- Separate source package, dependency graph and production build output.
- Separate application/readiness identity.
- No research credential is required by the health runtime.
- No current or named future health database, quarantine or object-store credential is accepted by the research runtime.
- DataON/AIDA connectors remain disabled and metadata-only.

## What this does not prove

- Separate hosted accounts, subnets, runtime roles, log sinks, DNS names or storage.
- Cloud network denial between the two products.
- Production secret-manager policies or workload identity.

Those controls remain mandatory gates for hosted synthetic staging. Local build separation is not a hosted security claim.
