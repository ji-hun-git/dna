# Foundation lifecycle threat model

**Scope:** currently executable synthetic foundation slice only  
**Status:** reviewed locally on 2026-08-30  
**Real PHI:** prohibited

## Data flow and trust boundaries

| Boundary | Input | Current control | Remaining risk |
|---|---|---|---|
| Browser → Next origin | session request and API calls | isolated test origin and exact app-instance assertion | no production ingress/CSP/browser policy |
| Next → Spring | same-origin rewritten /api requests | server-only validated core origin; no Next authorization logic | production reverse proxy not implemented |
| Browser → Spring session | synthetic credential, cookie, CSRF | subject-specific credential hash, exact Origin, opaque token, hashed server storage, HttpOnly/SameSite cookie | local broker only; no rate limiting or MFA |
| Spring → PostgreSQL | identity, consent, metadata, candidates, records | parameterized JDBC, owner predicates, constraints, transactions, Flyway | broad runtime DB role; no RLS/TLS/backup |
| Spring → quarantine | allowlisted synthetic PDF | normalized UUID filename, bounded size, PDF magic, SHA-256 allowlist, rollback cleanup | local filesystem and synchronous inspection |
| Candidate → record | user-supplied confirmed value | PENDING state, active purpose consent, explicit confirmation, unique candidate record | no UI assurance or step-up authentication |
| Deletion → retained audit | resource deletion and proof | content deletion, session deletion, hashed subject/session, enumerated event types | retention policy and immutable audit store absent |

## Threats and current results

| Threat | Attack performed | Result | Status |
|---|---|---|---|
| Login CSRF | omit/mismatch Origin | 403 origin_denied | VERIFIED LOCALLY |
| Synthetic identity impersonation | wrong subject credential | 403 local_identity_denied; safe denial audit | VERIFIED LOCALLY |
| Session theft/replay | reuse session after deletion | 401 session_invalid | VERIFIED LOCALLY |
| CSRF | omit CSRF on state-changing document request | 403 csrf_denied; safe denial audit | VERIFIED LOCALLY |
| BOLA/IDOR | Bob confirms Alice candidate and reads Alice record | 404 without existence disclosure | VERIFIED LOCALLY |
| Consent bypass | repeat old request/confirmation after revocation | 403 active_consent_required | VERIFIED LOCALLY |
| Confirmation bypass | inspect record list before candidate confirmation | empty list | VERIFIED LOCALLY |
| Replay/duplicate write | repeat document and confirmation idempotency keys | same IDs; one record | VERIFIED LOCALLY |
| Malicious/unapproved file | PDF-like bytes with unapproved digest | REJECTED; extraction returns conflict | VERIFIED LOCALLY |
| Path traversal | server generates UUID filename and verifies normalized root | no client-controlled path | IMPLEMENTED |
| Transaction rollback loss of denial audit | trigger denied read | denial audit uses independent transaction | VERIFIED LOCALLY |
| Cross-runtime digest mismatch | compare Kotlin SHA-256 to standard vector and Node-driven browser fixture | both pass after signed-byte fix | VERIFIED LOCALLY |
| PHI in audit | inspect audit schema and values after lifecycle | no raw measurement/unit in audit fields | VERIFIED LOCALLY with synthetic values |
| Deletion failure | delete profile and query DB/object/session | zero retained record/document/session; object absent | VERIFIED LOCALLY |
| Parser exploitation/malware | arbitrary PDF parser attack | no parser exists; allowlisted fixture only | NOT IMPLEMENTED |
| SSRF | manipulate core API destination | origin parser allows HTTPS or HTTP loopback only | PARTIAL |
| Denial of service | oversized/chunked/concurrent upload stress | not executed | NOT IMPLEMENTED |
| Insider/admin abuse | privileged DB/object access | no admin surface, but no production role design | NOT IMPLEMENTED |
| Backup disclosure/restore | backup and restore drill | not executed | NOT IMPLEMENTED |
| Supply-chain compromise | production dependency audit and exact runtime checks | local checks pass; hosted monitoring absent | PARTIAL |

## Release interpretation

Passing this threat model means the named local attacks were exercised against synthetic data. It does not establish penetration-test completion, OWASP ASVS verification, ISMS-P certification, production security, or permission to handle real health information.

