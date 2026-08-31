# System threat model

**Status:** reviewed for the executable local architecture on 2026-08-30  
**Production penetration test:** NOT IMPLEMENTED

The attack-specific evidence for the synthetic lifecycle is in [foundation-threat-model.md](foundation-threat-model.md). This document tracks the wider system boundaries.

## Assets and trust boundaries

| Boundary | Sensitive asset | Principal threats | Current control | Status |
|---|---|---|---|---|
| Browser / Next | session cookie, user intent | XSS, CSRF, token leakage, wrong-origin forwarding | HttpOnly cookie, exact Origin, CSRF, validated rewrite, source scanner | PARTIAL |
| Spring API | authority decisions | BOLA, purpose bypass, privilege escalation, replay | subject-scoped SQL, exact purpose checks, idempotency, deny-by-default routes | VERIFIED LOCALLY |
| OIDC boundary | account identity | issuer/audience mix-up, malformed claims, stale/replayed tokens | strict validators and normalized scopes | VERIFIED LOCALLY; provider EXTERNAL GATE |
| PostgreSQL | lifecycle state and audit | injection, overbroad role, tampering, backup disclosure | parameterized JDBC, constraints, append-only trigger | PARTIAL |
| Quarantine / worker | hostile documents | malformed PDF, parser RCE, malware, SSRF, model compromise | exact synthetic digest allowlist only | HIGH residual risk |
| Build / dependencies | release integrity | vulnerable dependency, secret leak, artifact substitution | exact runtime policy, production audit, SBOM task, digest-bound model contract | PARTIAL |
| AWS organization | accounts, logs, backups | region drift, audit disabling, account collapse | tested OUs, account set and SCPs | VERIFIED LOCALLY; no cloud apply |
| Operators/admin | privileged access | insider abuse, silent impersonation, excessive support access | no admin surface exists | NOT IMPLEMENTED |
| External connectors | provider credentials/data | compromise, schema drift, quota abuse, privacy misuse | disabled flags and contracts | DISABLED |

## Required adversarial coverage

Locally exercised: wrong Origin/credential, missing CSRF, BOLA, wrong JWT scope, cross-subject consent access, revoked consent, replay/idempotency, unapproved document, confirmation bypass, old-session replay, audit mutation, and deletion retry.

Still required before real-data beta: malformed document corpus, parser sandbox escape, SSRF/egress, concurrency and revocation races, rate-limit/DoS, backup disclosure, restore corruption, secret rotation, provider compromise, admin abuse, DAST, and independent penetration testing.

## Release rule

Any Critical dependency, authorization bypass, audit-loss path, unisolated arbitrary document parser, failed restore, or external connector without approval is release blocking. Passing local synthetic attacks does not authorize PHI.
