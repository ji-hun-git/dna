# CI security gates

**Scope:** synthetic-only source and build evidence. Passing this workflow does not authorize deployment, real documents, provider credentials, or PHI.

| Gate | Purpose | Owner | Failure threshold | Exception process |
|---|---|---|---|---|
| Locked install and runtime policy | Prevent runtime and dependency drift | Platform engineering | Any lockfile or exact-version mismatch fails | Time-bounded, founder-approved change with updated policy and evidence |
| Product/research tests and builds | Preserve runtime separation and executable contracts | Product engineering | Any test, type check, or production build failure fails | No skip on protected branches; fix or revert |
| PostgreSQL/Flyway lifecycle | Prove schema and authoritative lifecycle on a real database engine | Backend engineering | Any migration, authorization, retry, revocation, or deletion test failure fails | No exception for release candidates |
| ClamAV command adapter | Prove the checksum-pinned real engine, exact-version check, clean exit and malware-detection exit through the worker adapter | Product security | Download checksum/version mismatch, unavailable engine, clean rejection, or synthetic-marker approval fails | No exception for the hostile-document milestone |
| Browser lifecycle | Prove browser → Spring → isolated worker behavior with an allowlisted synthetic PDF | Product security | Any E2E or accessibility assertion failure fails | No exception for the hostile-document milestone |
| CodeQL | Detect Java/Kotlin and JavaScript/TypeScript security defects | Product security | Workflow/analyzer failure or repository policy violation fails | Document finding, owner, mitigation, expiry, and review approval |
| Gitleaks | Reject committed credentials and sensitive tokens | Product security | Any unallowlisted finding fails | Rotate/revoke first; allowlist only a proven synthetic false positive |
| Trivy filesystem | Detect Critical/High dependency findings, committed secrets, supported misconfiguration, and license findings | Supply-chain owner | Any unfixed Critical/High finding in configured scanners fails | Risk acceptance must name artifact/version, mitigation, expiry, and approver |
| CycloneDX SBOM | Preserve a reviewable JVM component inventory | Supply-chain owner | Missing SBOM artifact fails | No exception; repair generation/upload |
| Runtime image matrix | Build isolated web/core/worker Linux images, reject root users, smoke-test runtimes, scan images and preserve image IDs/manifests/SBOMs | Supply-chain owner | Build, identity, non-root, SBOM upload or unresolved Critical/High image finding fails | No exception for hosted-staging candidates |

## Exact platform exclusion

The Trivy policy excludes one exact license result only: `@img/sharp-win32-x64` with
`Apache-2.0 AND LGPL-3.0-or-later` in `pnpm-lock.yaml`. Next.js records optional
Sharp binaries for multiple operating systems, while the hosted-staging artifact
is Linux-only; the Windows binary is therefore absent from that artifact. The
Rego rule binds the scanner type, package name, file path, and complete SPDX
expression. A package rename, license change, target change, or production-image
introduction fails closed and requires a new review. This is synthetic-staging
scope only; production license approval remains absent. Owner: supply-chain.
Review expiry: 2026-09-30.

## Deliberate non-claims

- The workflow builds and scans local CI runtime-image candidates, but does not push, sign, attest or deploy them. Local Docker image IDs are not registry repository digests, so the runtime-image release gate cannot be PASS.
- Filesystem misconfiguration scanning is not proof that hosted IAM, network egress, TLS, KMS, or object-store separation exists.
- The PostgreSQL service is disposable CI infrastructure, not backup/restore evidence.
- The lifecycle browser test uses an explicit test-only synthetic scanner result. A separate CI integration test exercises the real ClamAV 1.5.4 command adapter with a harmless synthetic SHA-256 signature database; neither test proves a hosted scanner or an operational official-signature update feed.
- CodeQL availability depends on repository licensing/permissions. An unavailable analyzer is a failed gate, not a pass.
