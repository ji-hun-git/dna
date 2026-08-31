# Incident response

**Operational status:** NOT IMPLEMENTED in a hosted environment

## Current local signals

- Authentication, Origin, CSRF, authorization, consent, document, confirmation, deletion, and audit event types.
- Correlation filter and PHI-safe logging facade.
- Connector kill switches default to disabled.
- Application feature switches: `security.oidc.enabled`, `gc.consent.enabled`, `gc.workload-tokens.enabled`, and `gc.foundation.enabled`.

## Minimum production procedure

1. Detect and classify without copying health content into tickets or chat.
2. Contain: disable the affected connector/feature, revoke sessions/credentials, and restrict egress.
3. Preserve content-minimized immutable audit and deployment evidence.
4. Assess affected subjects, systems, processors, time window, and data classes.
5. Escalate to security, privacy, legal, clinical-safety, and executive owners as applicable.
6. Notify regulators/users only through the approved legal process and deadlines.
7. Recover from a known-good artifact and verify authorization, audit, and deletion invariants.
8. Run a blameless review, track remediation, and update tests/control evidence.

## Release blockers

No on-call roster, alert routing, severity policy, communications templates, forensic store, session-kill operation, regulatory decision tree, or incident exercise exists. Until those are implemented and rehearsed, incident response remains a release-blocking gap.
