# Production-foundation stop-ship iteration

## A. Repository truth

Before this iteration, branch codex/dataon-aida-evidence-agent at 0605518 contained a polished six-route synthetic Next.js application, a Spring skeleton with three ports, zero application controllers, zero migrations, zero repositories, and no production/deployment configuration. Next.js was pinned to 16.3.0; Node allowed the broad range from 24 up to but excluding 25. DataON/AIDA lived as an offline route and TypeScript library inside the web application. The first E2E audit could mistakenly reuse another app on port 3000.

A safe report checkpoint was committed as 65bba2c before implementation. Work continues on codex/production-foundation.

## B. Decisions made

1. Spring is the only future PHI backend/BFF, session owner, token owner, and authorization owner.
2. Next.js remains UI-only and receives no provider access/refresh token or durable PHI authority.
3. DataON/AIDA becomes a separate research application/deployment boundary and receives no PHI-plane credentials.
4. Real PHI remains prohibited; the next product milestone is one durable synthetic lifecycle, not another screen.
5. Current medical fixtures are named as synthetic contract regression, never model-accuracy evidence.

Decision record: docs/architecture/ADR-001-application-trust-boundary.md.

## C. Changes

### Supply chain and runtime

- Patched Next.js from 16.3.0 to 16.3.3 and regenerated pnpm-lock.yaml.
- Pinned Node 24.20.0 and pnpm 11.20.0 in package metadata, .node-version, and .nvmrc.
- Added supply-chain/dependency-security-policy.json, exact official artifact hashes, a no-exception registry, runtime verification, production audit, and release-policy commands.
- Release policy requires a production-verified image and immutable SHA-256 digest; neither has been invented.

### Test integrity and UI reliability

- Moved Playwright to owned port 3137, disabled server reuse, and asserted application ID plus instance ID on every journey.
- Corrected the generated typography token and added a test that every generated token referenced by global CSS exists.

### Medical evidence truthfulness

- Renamed the gate to medical-ai:synthetic-contract-gate.
- Added evidenceLevel: synthetic-contract-regression-only and productionAccuracyClaim: false to the output.
- Updated user-visible Korean copy so a two-document fixture cannot sound like medical-model validation.
- Added the intended-use matrix and mapped prohibitions to current executable tests.

## D. Security attack results

- Old global Node/pnpm versions were rejected by engines: fail closed.
- A missing production image and digest were rejected by security:release-policy: fail closed.
- Wrong-value, displaced-evidence, hallucinated-field, missed-abstention, diagnosis-key, and normality-key fixtures were rejected.
- Unrelated port-3000 application reuse is no longer possible under the default E2E configuration.
- Detailed results: docs/security/stop-ship-security-report-2026-08-30.md.

## E. Verification

Executed under the verified Node 24.20.0 / pnpm 11.20.0 toolchain:

| Command | Result |
|---|---|
| node scripts/security/check-runtime-policy.mjs | PASS |
| pnpm audit --prod --audit-level high | PASS — no known vulnerabilities |
| pnpm --filter @gc/web test | PASS — 24 files, 86 tests |
| pnpm --filter @gc/web build | PASS — 8 static pages generated |
| pnpm --filter @gc/web build-storybook | PASS with existing large-chunk warning |
| pnpm --filter @gc/web e2e | PASS — 6/6 on identified port-3137 app |
| gradlew.bat :apps:core-api:test | PASS |
| pnpm auth-security:gate | PASS |
| pnpm medical-ai:synthetic-contract-gate | PASS as synthetic contract only |
| pnpm research-evidence:gate | PASS as offline synthetic research contract only |
| node scripts/security/check-runtime-policy.mjs --release | EXPECTED FAIL — production image/digest absent |

## F. Current architecture

Only the Next.js static synthetic UI and its local/offline contract libraries are executable as product behavior. Spring still boots and runs architecture tests but serves no application endpoint. There is no session store, database schema, object store, ingestion worker, queue, audit store, deletion workflow, ingress, or deployed environment.

The ADR describes the selected future boundary; it does not falsely label that boundary implemented.

## G. Remaining external gates

- Kakao and Naver developer applications, approved redirect URIs, credentials, provider review, and live conformance.
- MyHealthWay organization eligibility/designation, testbed, conformity, vulnerability-remediation evidence, and production approval.
- HIRA/NHIS/public-data rights and provider approval for any live data source.
- DataON/AIDA dataset/API rights confirmation and competition submission conditions in the separated research context.
- Privacy/legal review, intended-use approval, MFDS applicability decision, security assessment, and real-data authorization.

All remain **EXTERNAL GATE** or **DISABLED**.

## H. Remaining blockers

### Critical

- None known in installed production JavaScript dependencies at this checkpoint; continuous advisory monitoring is not yet implemented.

### High

- No runtime identity/session/authorization/consent enforcement.
- No PostgreSQL/Flyway durable lifecycle or object quarantine/worker.
- No persistent provenance, audit, revocation, export, deletion, or restore evidence.
- No production-like synthetic staging, immutable production image, deployment security, or operational evidence.
- Research evidence is not yet physically separated into its own application/deployment.

### Medium

- No hosted CI SCA/secret/SAST/license/SBOM gate.
- No production CSP/header, DAST, browser matrix, performance budget, or manual accessibility audit.
- Global CSS remains large and Storybook emits large-chunk warnings.

### Low

- Exact local toolchain activation is documented by version files but not bootstrapped by a repository-owned setup command.

## I. Release verdict

**PRIVATE BETA NO-GO**

The local synthetic founder demo remains usable, but there is no authorization to process real PHI, activate external providers, deploy publicly, or call this a private beta. The next implementation is the Spring-owned durable synthetic vertical slice.
