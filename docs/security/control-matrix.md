# Security control matrix

This matrix maps controls to executable evidence. It is not an ISMS-P certification or an OWASP ASVS attestation.

| Control | Standard | Threat | Implementation | Test/runtime evidence | Owner | Status | Exception | Last review |
|---|---|---|---|---|---|---|---|---|
| Exact patched web runtime | NIST SSDF PW.4/RV.1 | known-vulnerable dependency | Node 24.20.0, pnpm 11.20.0, Next 16.3.3 policy | `check-runtime-policy.mjs`; production audit | Engineering | VERIFIED LOCALLY | none | 2026-08-30 |
| Browser token isolation | OAuth browser BCP | token theft | Spring trust-boundary ADR; no Next auth routes | auth source gate; route inventory | Security | PARTIAL | external broker absent | 2026-08-30 |
| Session and CSRF | OWASP ASVS session/CSRF | replay, login CSRF | opaque hashed session, exact Origin, CSRF hash | foundation PostgreSQL + browser E2E | Backend | VERIFIED LOCALLY | synthetic broker only | 2026-08-30 |
| Object authorization | OWASP API1 | BOLA/IDOR | subject predicates and non-disclosing 404 | Alice/Bob negative tests | Backend | VERIFIED LOCALLY | foundation endpoints only | 2026-08-30 |
| Purpose consent | PIPA sensitive-data principle; FHIR Consent semantics | processing beyond consent | exact purpose/category/operation grant and durable revoke | consent PostgreSQL integration | Privacy/Backend | VERIFIED LOCALLY | legal basis review pending | 2026-08-30 |
| Hostile file gate | OWASP ASVS file handling | parser exploit/malware | size, magic, digest allowlist, generated path | rejected-digest and extraction-block tests | Security | PARTIAL | no malware scanner/worker | 2026-08-30 |
| Human confirmation | medical-safety policy | model output becomes fact | candidate PENDING state and explicit confirmation | confirmation-bypass test | Product/Clinical | VERIFIED LOCALLY | synthetic extraction only | 2026-08-30 |
| Audit integrity | OWASP ASVS logging; ISMS-P mapping target | repudiation/tampering | content-free events, hash chain, DB no-update/delete trigger | PHI-safe tests and mutation rejection | Security | PARTIAL | no production immutable sink | 2026-08-30 |
| Deletion/session kill | privacy lifecycle | retained data, stale access | transactional synthetic deletion and session revocation | DB/browser lifecycle tests | Privacy/Backend | VERIFIED LOCALLY | backups and mandated retention unresolved | 2026-08-30 |
| Cloud account isolation | NIST SSDF PO.5 | blast radius/region drift | seven accounts, three OUs, Seoul SCP, tamper SCP | OpenTofu 1.10.6 tests 3/3 | Platform | VERIFIED LOCALLY | no AWS apply | 2026-08-30 |
| Backup and restore | availability/recovery | loss/corruption | no implementation | no drill | Platform | NOT IMPLEMENTED | none | 2026-08-30 |
| External connectors | least privilege/data minimization | credential/data compromise | flags disabled | UI/contracts only | Integration owner | EXTERNAL GATE | none | 2026-08-30 |
