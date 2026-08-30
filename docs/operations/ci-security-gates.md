# CI security gates

**Scope:** synthetic-only source and build evidence. Passing this workflow does not authorize deployment, real documents, provider credentials, or PHI.

| Gate | Purpose | Owner | Failure threshold | Exception process |
|---|---|---|---|---|
| Locked install and runtime policy | Prevent runtime and dependency drift | Platform engineering | Any lockfile or exact-version mismatch fails | Time-bounded, founder-approved change with updated policy and evidence |
| Product/research tests and builds | Preserve runtime separation and executable contracts | Product engineering | Any test, type check, or production build failure fails | No skip on protected branches; fix or revert |
| PostgreSQL/Flyway lifecycle | Prove schema and authoritative lifecycle on a real database engine | Backend engineering | Any migration, authorization, retry, revocation, or deletion test failure fails | No exception for release candidates |
| Browser lifecycle | Prove browser → Spring → isolated worker behavior with an allowlisted synthetic PDF | Product security | Any E2E or accessibility assertion failure fails | No exception for the hostile-document milestone |
| CodeQL | Detect Java/Kotlin and JavaScript/TypeScript security defects | Product security | Workflow/analyzer failure or repository policy violation fails | Document finding, owner, mitigation, expiry, and review approval |
| Gitleaks | Reject committed credentials and sensitive tokens | Product security | Any unallowlisted finding fails | Rotate/revoke first; allowlist only a proven synthetic false positive |
| Trivy filesystem | Detect Critical/High dependency findings, committed secrets, supported misconfiguration, and license findings | Supply-chain owner | Any unfixed Critical/High finding in configured scanners fails | Risk acceptance must name artifact/version, mitigation, expiry, and approver |
| CycloneDX SBOM | Preserve a reviewable JVM component inventory | Supply-chain owner | Missing SBOM artifact fails | No exception; repair generation/upload |

## Deliberate non-claims

- The workflow does not scan a production container because no production runtime image exists. The release gate remains failed.
- Filesystem misconfiguration scanning is not proof that hosted IAM, network egress, TLS, KMS, or object-store separation exists.
- The PostgreSQL service is disposable CI infrastructure, not backup/restore evidence.
- The lifecycle browser test uses an explicit test-only synthetic scanner result. It is not evidence that ClamAV was installed or exercised.
- CodeQL availability depends on repository licensing/permissions. An unavailable analyzer is a failed gate, not a pass.
