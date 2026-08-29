# Stop-ship security report — 2026-08-30

**Scope:** production-foundation iteration from audited commit 0605518

**Method:** dependency advisory verification, source inspection, negative tests, production build, and release-policy attack

**Real PHI:** not used and still prohibited

## Executive result

The known Next.js stop-ship version and broad local runtime declaration are remediated in source. The production audit reports no known vulnerable production dependency. Release remains fail-closed because no production runtime image or immutable image digest exists, and there is still no runtime identity, authorization, consent, persistence, document-security, deletion, or audit implementation.

## Findings

### SEC-001 — Critical — Next.js security release gap — remediated

- **Rule:** no unresolved Critical production dependency.
- **Location:** audited apps/web/package.json at commit 0605518; current apps/web/package.json:25.
- **Evidence:** the audited snapshot pinned Next.js 16.3.0. The August 2026 advisory affects versions from 16.0.0 below 16.3.3. Current code pins 16.3.3 and the regenerated lock resolves next@16.3.3.
- **Impact:** a vulnerable production framework would make all source-pattern security PASS labels insufficient for release.
- **Fix:** pin 16.3.3, regenerate the lockfile, run production audit, unit tests, build, and E2E.
- **Residual risk:** advisory currency is not automated in hosted CI yet. The machine-readable minimum is a snapshot, not a permanent claim that 16.3.3 will remain current.

### SEC-002 — High — Runtime and package-manager ambiguity — partially remediated

- **Rule:** production runtime must be exact, supported, and artifact-bound.
- **Location:** package.json:4-7, .node-version, .nvmrc, supply-chain/dependency-security-policy.json:11-32.
- **Evidence:** the audited declaration accepted any Node 24 release. Source now pins Node 24.20.0 and pnpm 11.20.0; the local Windows artifact SHA-256 matched the official checksum. security:runtime-policy passes only under the exact versions.
- **Impact:** patch-level drift can silently reintroduce known runtime issues and invalidate test/build evidence.
- **Fix:** exact source/tooling policy plus official artifact checksums.
- **Residual risk / mitigation:** production image is **NOT IMPLEMENTED** and has no digest. security:release-policy intentionally exits 1 until both are production verified. This remains release-blocking.

### SEC-003 — High — No enforceable sensitive-data backend — open

- **Rule:** identity, sessions, authorization, consent, PHI lifecycle, audit, and deletion must be runtime enforced.
- **Location:** apps/core-api/src/main/kotlin/kr/co/genomecompanion; docs/status/2026-08-30/backend-report.md.
- **Evidence:** Spring has three port interfaces and zero controllers, migrations, repositories, persistence adapters, or production transactions. Next has zero route handlers.
- **Impact:** no private-beta user, record, document, or authorization claim can be made; the current controls are contracts and UI behavior only.
- **Fix:** implement the synthetic Spring-owned BFF vertical slice defined by ADR-001 before feature expansion.
- **Mitigation:** external login and health connectors remain disabled; real PHI remains prohibited.

### SEC-004 — Medium — E2E could exercise an unrelated local application — remediated

- **Rule:** security and journey tests must prove the target application identity.
- **Location:** apps/web/playwright.config.ts:3-21, apps/web/app/layout.tsx:15-21, apps/web/e2e/korean-experience.spec.ts:3-9.
- **Evidence:** the old configuration could reuse any server on port 3000. The new configuration owns port 3137, never reuses a server, supplies a unique application instance, and every navigation asserts both application and instance IDs.
- **Impact:** false passes/failures could be attributed to the wrong system.
- **Fix:** isolated port plus runtime identity assertion. E2E passed 6/6 against the identified application.

### SEC-005 — Medium — Synthetic fixture result could be mistaken for medical accuracy — remediated

- **Rule:** evidence level must be explicit; synthetic regression must not imply clinical/model validation.
- **Location:** apps/web/lib/medical-ai/evaluation.ts:25-27, apps/web/tests/medical-document-evaluation.test.ts, apps/web/lib/medical-ai/policy.ts.
- **Evidence:** the previous schema and script used medical document evaluation language with perfect fixture metrics. The report now identifies itself as synthetic-contract-regression-only and sets productionAccuracyClaim: false; the UI says only that this synthetic contract regression passed.
- **Impact:** reviewers could overread perfect two-document fixture results as production evidence.
- **Fix:** rename the gate, schema, type, UI disclosure, and test assertions. Strict-output negative tests still reject diagnosis and normality keys.

### SEC-006 — Low — Generated design token reference typo — remediated

- **Rule:** UI security/safety disclosures must render through the intended shared design system.
- **Location:** apps/web/app/globals.css:17, apps/web/tests/generated-token-consumption.test.ts.
- **Evidence:** global CSS referenced an undefined --gc-type-body-line; the generated token is --gc-type-bodyLine.
- **Impact:** unintended typography fallback increased visual-regression risk for safety copy.
- **Fix:** correct the token and add a generated-token reference test. The test suite passes.

## Adversarial and negative checks

| Check | Outcome |
|---|---|
| Production dependency audit at High threshold | PASS — no known vulnerabilities found |
| Exact runtime check under Node 24.20.0 / pnpm 11.20.0 | PASS |
| Same runtime check with old global toolchain | FAIL CLOSED through package engines |
| Release check without verified image/digest | FAIL CLOSED as required |
| Unreviewed diagnosis/normality output keys | REJECTED by strict schema test |
| Unsafe medical fixture: wrong value, displaced evidence, hallucination, missed abstention | REJECTED by synthetic contract gate |
| E2E against unknown/reused server | PREVENTED by owned port and application-instance assertions |

## Verification boundary

No penetration test, DAST, production CSP validation, container scan, SBOM signature, deployed secret manager, backup/restore drill, or real OAuth/provider conformance was performed. These are open controls, not implied by the passing local checks.
