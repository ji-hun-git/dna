# Genome Companion — Integrated Synthetic Product exit report

## CURRENT HEAD

- Branch: `codex/integrated-synthetic-product`
- Baseline: `54f9bf958c176989a5dea03f6bf391a1fa3e10fc`
- Evidence snapshot: the atomic Git checkpoint containing this report. Use `git log -1 --format=%H` to resolve its non-self-referential commit ID.
- Scope: local executable stack, allowlisted synthetic PDF only. No deployment, external account mutation, provider integration, or real PHI processing occurred.

## FILES CHANGED

- Spring authority: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/foundation/**`
- Durable schema: `apps/core-api/src/main/resources/db/migration/V4__integrated_synthetic_product.sql`
- KR Core boundary: `apps/core-api/src/main/kotlin/kr/co/genomecompanion/interoperability/**`, matching tests, and the pinned package under `apps/core-api/src/main/resources/fhir-packages/`
- Health product client and visible UX: `apps/web/components/integrated/**`, `apps/web/lib/foundation/**`, integrated page selectors, styles, tests, and Playwright configuration
- Research trust plane: research route, components, libraries, fixtures, scripts, and tests moved into the new `apps/research-web` package
- Workspace/build policy: root and application package manifests, workspace definition, Gradle dependency catalog/lock, and pnpm lockfile
- Architecture/evidence: the integration contract, system context, research separation ADR material, research product boundary, and this report

## ARCHITECTURAL DECISIONS

1. The fixed authority chain is `Browser → Next presentation/same-origin forwarding → Spring authority → PostgreSQL`.
2. Next does not authorize or independently persist health facts. Spring owns session, Origin/CSRF enforcement, consent, object authorization, lifecycle transitions, audit, and deletion.
3. `QUARANTINED` is explicitly a logical development state for an allowlisted local synthetic file, not a hostile-file security quarantine boundary.
4. The DataON/AIDA evidence product is now the separate `@gc/research-web` build and application identity. Health and research builds reject the other plane's credentials.
5. FHIR structural validity, KR Core validity, local import support, MyHealthWay conformance, and clinical correctness remain separate verdicts.

## DATABASE CHANGES

- Candidate state now supports deterministic `PENDING`, `CONFIRMED`, and `EXCLUDED` review outcomes.
- `gc_health_record_version` preserves every confirmed/corrected value and links superseding versions.
- A partial unique index enforces exactly one `CURRENT` version per record.
- Correction creates a new version and marks the previous version `SUPERSEDED`; it never silently overwrites the old fact.
- Existing record rows are backfilled into one current version.
- Consent, session, document, candidate, record, audit, deletion, and source-object lifecycle remain PostgreSQL-authoritative for this local synthetic path.

## API CONTRACT CHANGES

- Added authoritative session reconstruction, current consent read/grant/revoke, intake read, candidate read/exclude/confirm, record list/detail/correction, and profile deletion behavior under `/api/foundation`.
- Object reads and writes derive the subject from the opaque session; a caller-supplied subject does not expand authority.
- Critical mutations require the expected Origin, synchronizer CSRF value, and idempotency key where replay can duplicate work.
- The client validates responses and maps the coherent error vocabulary into direct Korean messages without exposing stacks or raw internal values.
- The full transition-to-HTTP-to-database-to-audit map is recorded in `integrated-synthetic-product-contract.md`.

## VISIBLE UX CHANGES

- `/` now has a feature-flagged integrated synthetic journey that reconstructs server session state on refresh.
- Visible consent, intake, inspection, extraction, review, correction/confirmation/exclusion, and completion states come from validated Spring responses rather than timers.
- `/records` loads durable current records and provenance from PostgreSQL and preserves them across a hard reload.
- `/data-control` performs durable consent revocation and deletion and displays the backend's actual lifecycle result.
- Korean copy distinguishes missing/expired authentication, missing/revoked consent, conflicts, invalid transitions, rejected uploads, retryable failures, and internal failure.
- The existing visual frame remains intact; this iteration integrated truth rather than redesigning the product.

## NEGATIVE AUTHORIZATION RESULTS

The real PostgreSQL integration suite proves fail-closed behavior for missing authentication, invalid login Origin, bad credentials, missing CSRF, cross-subject candidate confirmation, cross-subject consent revocation, cross-subject record read/correction, guessed record IDs, modified subject parameters, revoked consent, expired sessions, stale mutations after deletion, and unsupported HTTP methods. Direct API calls do not bypass these decisions.

Audit rows remain append-only under the application database role and contain event identifiers/digests rather than raw health values. This is tamper-evident database protection, not a production immutable audit sink.

## ASYNC/FAILURE TEST RESULTS

- Duplicate confirmation, duplicate exclusion, duplicate correction, and repeated deletion paths are deterministic/idempotent where contracted.
- Confirmation after exclusion, malformed transitions, stale correction after deletion, rejected document digests, and revoked-consent operations fail closed.
- Processing labels advance only after authoritative server transitions; exact percentage progress is not fabricated.
- Full Spring result: 58 tests discovered, 56 executed successfully, 2 conditionally skipped, 0 failures. The skips are the legacy environment-gated consent repository test and the externally generated Synthea fixture test; the new PostgreSQL lifecycle suite executed and passed.
- Browser lifecycle result: 2 passed, 0 failed.

## ACCESSIBILITY RESULTS

- Critical async completion, correction, revocation, and deletion state uses persistent page content and `role="status"`/`aria-live="polite"` where appropriate; it is not toast-only.
- The second Playwright path performs login, consent, upload, evidence inspection, candidate correction, provenance opening, revocation, and deletion using keyboard activation.
- A 640 CSS-pixel viewport exercises the 200% zoom equivalent layout without losing required operations or introducing horizontal-operation loss.

## EXACT TEST COMMANDS

Runtime commands used exact Node `24.20.0` and pnpm `11.20.0` through the npm execution wrapper.

```powershell
npm exec --yes --package=node@24.20.0 --package=pnpm@11.20.0 -- pnpm auth-security:gate
npm exec --yes --package=node@24.20.0 --package=pnpm@11.20.0 -- pnpm research-evidence:gate
npm exec --yes --package=node@24.20.0 --package=pnpm@11.20.0 -- pnpm security:runtime-policy
npm exec --yes --package=node@24.20.0 --package=pnpm@11.20.0 -- pnpm security:production-audit

$env:GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:55432/gc_integrated_product'
$env:GC_TEST_QUARANTINE_ROOT='C:\Users\Jason\AppData\Local\Temp\gc-foundation-postgres-integration-integrated'
.\gradlew.bat :apps:core-api:test --rerun-tasks --no-daemon

npm exec --yes --package=node@24.20.0 --package=pnpm@11.20.0 -- pnpm --filter @gc/web test
npm exec --yes --package=node@24.20.0 --package=pnpm@11.20.0 -- pnpm --filter @gc/web build
npm exec --yes --package=node@24.20.0 --package=pnpm@11.20.0 -- pnpm --filter @gc/research-web test
npm exec --yes --package=node@24.20.0 --package=pnpm@11.20.0 -- pnpm --filter @gc/research-web build

$env:GC_TEST_QUARANTINE_ROOT='C:\Users\Jason\AppData\Local\Temp\gc-foundation-browser-e2e-integrated'
npm exec --yes --package=node@24.20.0 --package=pnpm@11.20.0 -- pnpm foundation:e2e

npm exec --yes --package=node@24.20.0 --package=pnpm@11.20.0 -- pnpm release:readiness
git diff --check
```

Observed results:

- Health unit tests: 23 files, 84 tests passed; production build passed with no research route.
- Research unit tests: 4 files, 14 tests passed; production build passed with only `/` and `/healthz`.
- KR Core boundary tests are included in the successful Spring suite.
- Auth security, research evidence, and runtime policy gates passed.
- Production dependency audit found no known vulnerabilities.
- `release:readiness` intentionally returned `NO_GO` for hosted/production release because six non-local gates are not PASS.

## KNOWN LIMITATIONS

- No hosted deployment, production ingress, production session infrastructure, secrets runtime, observability stack, immutable runtime image, or signed provenance exists.
- No hostile-file quarantine, MIME/malware/content inspection boundary, isolated extraction worker, or production object store exists.
- No backup/restore drill or hosted recovery evidence exists.
- No real PHI was accepted or processed.
- MyHealthWay conformance is `NOT IMPLEMENTED`; clinical correctness is `NOT ASSERTED`.
- Kakao, Naver, MyHealthWay, NHIS/HIRA/MFDS personal integrations, OCR, and medical AI are disabled/not implemented.
- The KR Core package boundary is pinned and exercised offline, but it is not wired into canonical record persistence and does not imply interoperability or clinical validity.
- The research application is physically separated at package/build/application/credential-policy level locally; separate hosted account, subnet, runtime role, log sink, DNS, and storage evidence does not exist.
- Two-tab conflicting confirmation was covered through server idempotency/conflict behavior, not a dedicated simultaneous two-browser-tab Playwright race.

## EXTERNAL GATES

- Privacy/legal/intended-use review and MFDS applicability determination
- Hosted security architecture and evidence: isolated storage/worker, SAST/secret/container/IaC/license gates, SBOM signing, audit sink, backup and restore
- Approved Kakao/Naver/MyHealthWay/provider registrations and sandbox contracts, in a later phase only
- Rights-cleared DataON/AIDA credentials and hosted research isolation, if the research connector is activated later
- Real-data authorization and an independently approved real-data test plan

## RELEASE VERDICT

**INTEGRATED SYNTHETIC PRODUCT — GO**

This verdict applies only to the tested local, allowlisted synthetic vertical slice. `HOSTED SYNTHETIC STAGING — NO-GO` and `REAL-DATA PRIVATE BETA — NO-GO` remain unchanged.
