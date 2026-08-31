# Data classification

## Classes

| Class | Examples | Allowed current environments | Logging rule | Storage rule |
|---|---|---|---|---|
| C0 Public | published provider metadata, public research metadata | local prototype | source IDs and freshness allowed | public store allowed with rights record |
| C1 Internal | build metadata, synthetic test IDs, non-secret config | local/dev | bounded operational fields | repository or internal systems |
| C2 Personal identifier | provider issuer/subject, account/session linkage | no production environment exists | digest only in security events | encrypted controlled store when authorized |
| C3 Sensitive health data | lab value, source document, diagnosis-related content | synthetic fixtures only | never in ordinary logs/audit payloads | real data prohibited until release gates pass |
| C4 Secret/key | OAuth client secret, signing key, DB password, API key | process-local test values only | never | future secret manager/workload identity only |

Synthetic content must be unmistakably synthetic and must not be copied from a real person. A filename, identifier, free-text note, image, or support attachment can raise the classification even when its surrounding record is lower.

## Handling rules

- Browser JavaScript receives no provider access/refresh token or C4 value.
- C3 documents enter only quarantine, never the research/public-data plane.
- Audit events use enumerated types and digests; raw measurement values and units are forbidden.
- Research/DataON/AIDA credentials may never reach the PHI plane, and PHI-plane credentials may never reach the research deployment.
- Classification downgrade requires explicit review; deletion does not permit deletion of legally required security evidence without an approved retention basis.

Current verdict: only C0, C1, and controlled synthetic analogues of C2/C3 are authorized.
