# Verification and release-readiness report

## Checks executed on 2026-08-30

| Check | Result | Evidence |
|---|---:|---|
| Web unit/component/contract tests | **PASS** | 23 test files, 85 tests passed |
| Next.js production build | **PASS** | TypeScript passed; generation completed 8/8; route manifest lists six product routes plus `_not-found` |
| Storybook production build | **PASS with warning** | Six story files built; Vite warned about chunks above 500 kB |
| Playwright E2E on isolated port 3100 | **PASS** | 6/6 Korean experience tests passed |
| Kotlin/Spring tests | **PASS** | Gradle build successful; smoke and architecture test sources present |
| Auth/security source gate | **PASS** | No forbidden client credential-storage/logging/public-secret/wildcard-CORS/unsafe-HTML/provider-host bypass pattern found |
| Medical-document synthetic gate | **PASS** | 2 synthetic documents, 6/6 exact measurements, zero hallucinations, required abstention recall 1.0 |
| Research-evidence synthetic gate | **PASS** | 32 cases; exact retrieval/rights/drift/stable-source metrics 1.0; unsafe allow count 0 |

## E2E environment finding

The first standard `pnpm --filter @gc/web e2e` run failed 6/6 because `playwright.config.ts` reused an unrelated HAZIEL development server already listening on port 3000. Error snapshots showed the HAZIEL interface, not this project.

The existing process was not stopped. The tests were rerun with a temporary equivalent config on isolated port 3100, where all 6 tests passed. The temporary config was removed afterward.

This demonstrates two separate facts:

1. The audited user journeys pass against the correct application.
2. The default local test configuration is susceptible to false failures or, worse, false results when another service owns port 3000.

The configuration should use a project-specific port or verify application identity before reusing a server.

## Covered journeys

- Home to pending example review.
- Local PDF signature rejection/acceptance, candidate confirmation/edit/exclusion, and demo save.
- Mobile public-provider filtering and price-boundary explanation.
- Local-only consent revocation and disabled real deletion.
- Disabled Kakao/Naver and MyHealthWay readiness truth.
- Mobile longitudinal record selection, source history, 200% text, and horizontal-overflow checks.

## Not verified in this audit

- Real browsers beyond the installed Playwright engine configuration.
- Visual pixel regression against approved screenshots.
- Performance budgets, Core Web Vitals, memory, or large-file stress.
- Network fault injection, provider outage, or API schema drift against live services.
- A real database, migration, backup, restore, export, deletion, queue, or object store.
- Real Kakao/Naver OIDC conformance.
- MyHealthWay or public healthcare API conformance.
- Real OCR/model accuracy, Korean clinical corpus evaluation, or GPU runtime.
- Production CSP/headers, DAST, SAST, dependency scanning, container scanning, SBOM signing, or penetration test.
- Mobile apps; no mobile implementation was part of this frontend/backend audit.

## Known findings

| Severity | Finding | Release effect |
|---|---|---|
| High | There is no functional production backend or durable authorization/data layer | Blocks beta and production |
| High | External identity, health, public-data, and research connectors are not live | Blocks connected-user claims |
| High | No production deployment/security operational evidence exists | Blocks production |
| Medium | Default E2E can reuse the wrong port-3000 application | Must be fixed before CI/local results are trusted |
| Medium | Global CSS is 3,949 lines with broad cascade ownership | Raises UI regression risk |
| Low | Body references `--gc-type-body-line`, but generated token is `--gc-type-bodyLine` | Fix to restore the intended shared line-height token |
| Low | Storybook reports large chunks, including the full variable font asset | Measure and optimize if it affects review speed or production assets |

## Release verdict

| Target | Verdict |
|---|---|
| Local synthetic founder demo | **GO** |
| Moderated UX testing with no real personal data | **GO**, with an explicit synthetic-data script |
| Public static showcase that cannot accept user data | **Conditional**, after copy/legal/brand and hosting authorization |
| Private beta with accounts or real health documents | **NO-GO** |
| Production health-data service | **NO-GO** |
