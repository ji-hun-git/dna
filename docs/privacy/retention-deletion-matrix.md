# Retention and deletion matrix

This is an engineering control inventory, not legal advice. Production periods and lawful bases require Korean privacy counsel and the designated privacy owner.

| Data set | Current location | User deletion behavior | Retained evidence | Production status |
|---|---|---|---|---|
| Account/identity link | synthetic `gc_subject` | row removed | subject digest in safe audit | VERIFIED LOCALLY |
| Session | `gc_session` | revoked/removed; old cookie fails | session digest/event type | VERIFIED LOCALLY |
| Consent | foundation consent row | removed during profile deletion | grant/revoke event type; separate durable consent module retains revoke state in its own test | PARTIAL |
| Source document | local quarantine path | file and metadata removed | digest/event type only | VERIFIED LOCALLY for one fixture |
| Extraction/candidate/record | PostgreSQL | rows removed | lifecycle event names | VERIFIED LOCALLY |
| Outbox | `platform_outbox` | no user-deletion integration | revoke event | NOT IMPLEMENTED for profile deletion |
| Security audit | `gc_audit_event`, `security_audit_event` | not user-editable; content-free evidence retained | hashes, purpose/event/outcome metadata | PARTIAL; legal period unset |
| Application logs | local console | no deletion workflow | correlation and safe fields only by policy | PARTIAL |
| Backups/replicas/caches/search | absent | none | none | NOT IMPLEMENTED |
| External providers/processors | disabled | none | none | EXTERNAL GATE |

Before real-data beta, define and approve: retention basis/period per data class, legal hold, backup expiry, restore-time deletion replay, connector erasure/unlink behavior, proof-of-deletion format, failed-job retry/dead-letter handling, and the owner for every store.
