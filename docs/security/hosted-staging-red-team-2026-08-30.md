# Hosted staging red-team judge — 2026-08-30

**Method:** independent read-only sub-agent review of the implementation worktree. No code was changed by the judge. The table was then reconciled with successful GitHub Actions run [33315069682](https://github.com/ji-hun-git/dna/actions/runs/33315069682) for commit `1037e50`. A `PASS` is limited to the executable synthetic CI boundary and is not hosted evidence.

| # | Claim | Result | Evidence summary |
|---:|---|---|---|
| 1 | Browser uses hosted backend | NOT TESTED | Playwright and the configured rewrite target loopback/dev runtimes. |
| 2 | Arbitrary real document is rejected | PASS | Intake requires an exact lowercase SHA-256 in the configured synthetic allowlist. |
| 3 | Quarantined object is unreadable before approval | PASS | Public API exposes metadata and approved PNG only; raw source requires an authenticated, unexpired worker lease. |
| 4 | Rejected object cannot reach extraction | PASS | Rejection becomes `SECURITY_REJECTED`; only approval creates the extraction job. |
| 5 | Inspected and processed bytes are identical | PASS | Upload, finalization, inspection, promotion and extraction independently verify the digest. |
| 6 | Upload capability replay is bounded | PARTIAL | Identical-byte replay is intentionally allowed only before finalization and before expiry; it is not one-time. |
| 7 | Replay cannot overwrite trusted state | PASS | Different-byte overwrite is denied and finalization revokes outstanding capability state. |
| 8 | Duplicate delivery cannot create duplicates | PASS | CI submitted the same leased extraction completion concurrently from two workers; PostgreSQL persisted exactly one completion, candidate and preview, and denied the stale duplicate. |
| 9 | Worker cannot reach arbitrary internet destinations | FAIL | The client constrains its API origin shape, but no deployed egress-deny control exists. |
| 10 | Worker cannot access unrelated data | FAIL | Reads are lease-scoped, but hosted task-role/object-IAM denial has not been proved. |
| 11 | Research runtime is denied health-plane access | NOT TESTED | Local source/build separation exists; hosted identity/network denial does not. |
| 12 | Cross-subject IDs cannot leak data | PASS | The PostgreSQL suite executed cross-subject candidate, record and query denials within the synthetic boundary. |
| 13 | Revoked consent cannot authorize processing | PASS | Revocation dead-letters active jobs, terminalizes documents, revokes capabilities and prevents lease/result lookup. |
| 14 | Deleted state cannot resurrect after restore | FAIL | No external deletion journal or tombstone replay exists. |
| 15 | DBA audit alteration is externally detectable | FAIL | Database mutation guards exist; a separately permissioned external anchor does not. |
| 16 | PHI-like values are absent from logs/traces | PARTIAL | Constrained logging code exists; hosted logs and traces have not been inspected. |
| 17 | Secrets are absent from runtime images | NOT TESTED | No production runtime image, layer inspection, signed SBOM or provenance exists. |
| 18 | Providers cannot activate accidentally | PARTIAL | Defaults and contracts are disabled; hosted deployment policy denial does not exist. |
| 19 | Restore works | FAIL | No fresh-environment restore, RPO or RTO evidence exists. |
| 20 | E2E targets the hosted deployment | FAIL | Current E2E launches local Spring, worker and Next processes. |
| 21 | Critical dependency vulnerabilities are resolved | PARTIAL | Both CodeQL analyses, Gitleaks and Trivy filesystem policy passed; no production image or deployed artifact exists to scan. |
| 22 | Accessibility-critical workflows operate | PARTIAL | Axe coverage and keyboard/200%-equivalent E2E passed; 400% and real screen-reader evidence are absent. |
| 23 | Production claims exceed evidence | PASS | `release/readiness.json` remains synthetic-only and `NO_GO`. |

## Blocking findings

Critical release blockers:

- No restore, fresh-environment recovery, or deletion replay.
- No external audit anchor.
- No hosted browser-to-backend evidence.

High blockers:

- No worker egress enforcement, workload identity, or unrelated-object IAM denial.
- No hosted research-plane denial.
- No hosted scanner isolation or operational official-signature update/feed evidence. CI proves only the checksum-pinned engine adapter with a harmless synthetic signature database.
- No runtime images, image-layer/secret inspection, or hosted observability evidence. CI security gates passed, but they are not hosted-runtime evidence.

Medium findings:

- Upload capability is deliberately replayable for identical bytes before finalization and expiry.
- Provider deployment gates, PHI-safe telemetry, production-image dependency coverage, and 400%/screen-reader accessibility remain partial.

No material Low finding changes the release decision.

## Final verdict

**HOSTED SYNTHETIC STAGING — NO-GO**

Real-data private beta remains prohibited.
