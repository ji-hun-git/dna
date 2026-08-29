# Frontend report

## Current stack

| Layer | Current implementation |
|---|---|
| Framework | Next.js `16.3.3`, App Router, React `19.2.8`, TypeScript `5.9.2` |
| Runtime/tooling | exact Node `24.20.0`, exact pnpm `11.20.0`, Turbopack production build |
| Styling | Tailwind CSS `4.3.3`, one large global stylesheet, three CSS Modules, generated `@gc/design-tokens` package |
| UI primitive | Radix Dialog for correction and consent confirmation dialogs |
| Fonts | Locally bundled Pretendard Variable for Korean UI; locally bundled IBM Plex Mono 400/500/600 for numerical and evidence-ledger details |
| Testing | Vitest, Testing Library, jest-axe, Storybook with a11y addon, Playwright |

The production build prerenders every current page as static content. There are no server-rendered account pages and no Next.js API route handlers. A validated configuration-only rewrite can forward `/api/foundation` to Spring; Next does not authorize or persist the request.

## Route inventory

| Route | Current experience | Data/state source | Status |
|---|---|---|---|
| `/` | Health home, recent metrics, result-document selection, example candidate review, correction/exclusion, evidence lens | React memory state plus fixed synthetic candidates | **Demo only** |
| `/records` | Longitudinal HbA1c, cholesterol, and vitamin-D views with source and confirmation history | Strict synthetic timeline object | **Demo only** |
| `/providers` | Region/type filtering and provider/non-covered-price comparison tables | Four synthetic providers and three synthetic price rows; `liveApiCalls: 0` | **Demo only** |
| `/connections` | Kakao, Naver, and Health Information Highway readiness explanation | Static safe-state UI; sign-in buttons disabled | **Contract/demo only** |
| `/data-control` | Purpose-by-purpose consent view, local revocation dialog, retention explanation, deletion boundary | React memory state and synthetic audit events | **Demo only** |
| `/research-data` | DataON/AIDA public research-metadata ranking, rights warnings, and competition tracks | Offline metadata snapshot dated 2026-08-12 | **Verified offline prototype** |

## Main user journey

The strongest implemented flow is the local result-document prototype:

1. The user selects a PDF, PNG, or JPEG file up to 20 MiB.
2. Browser code reads the bytes, verifies a short format signature, and computes SHA-256 locally.
3. No upload occurs and no OCR is executed.
4. The next screen clearly says the displayed measurements are example candidates, not values extracted from the selected file.
5. The user confirms, edits, or excludes each example item.
6. Confirmed counts and edited example values return to the home screen in React state.

Reloading the visible demo clears its React state. A separate browser foundation test proves a durable Spring/PostgreSQL lifecycle through the Next rewrite, but the visible product screens are not yet wired to it.

## Design and UI state

The current visual language is consistently applied across the core health, import, evidence, connection, and data-control surfaces:

- quiet neutral canvas and white raised cards;
- restrained 1 px borders and low elevation;
- 10 px controls and 20 px primary surfaces;
- black primary controls with blue reserved for focus/action emphasis;
- large, tightly tracked Korean headlines;
- monospaced source, status, digest, date, and numerical labels;
- explicit text labels instead of color-only health meaning;
- responsive mobile bottom navigation and reduced-motion handling.

The established frame remains intact while the final CSS layer applies a shadcn-like neutral surface system and Toss-influenced Korean reading rhythm. The design is implemented in code, not only in mockups.

## Accessibility and Korean UX

Verified local coverage includes:

- semantic headings, tables, captions, labels, details, dialogs, and status text;
- keyboard/focus-visible styles;
- reduced-motion media handling;
- 200% text Storybook cases and an E2E overflow assertion;
- jest-axe checks in component tests;
- direct Korean copy tests for demo, connection, and medical boundaries;
- Korean date formatting in visible UI;
- text alternatives for evidence marks and charts.

This is meaningful automated coverage, not a substitute for a manual screen-reader, keyboard-only, low-vision, and real-device audit.

## What is not frontend-complete

- There is no authenticated application shell or visible server-owned session state.
- There are no loading, retry, partial-data, token-expiry, provider-outage, or backend-conflict states connected to real services.
- There is no production upload progress, quarantine result, OCR job status, or server-confirmed save state.
- Visible consent revocation and deletion do not reach the durable Spring lifecycle yet.
- Public provider results and research results do not refresh from a live connector.
- Analytics, support tooling, notification settings, account recovery, export, and real deletion experiences are not implemented.
- There is no visual-regression baseline or supported-browser matrix.

## Maintainability findings

| Finding | Impact | Recommended action |
|---|---|---|
| `apps/web/app/globals.css` is 3,949 lines | Cross-page changes can create hidden cascade regressions | Continue moving route-specific styles to CSS Modules and keep only tokens/reset/shared primitives global |
| Global styles and three CSS Modules use different organization patterns | Slows component ownership and visual regression diagnosis | Establish a documented component/style boundary before adding more screens |
| Storybook bundles the full Pretendard variable font and reports chunks above 500 kB | Storybook load is heavier; production impact was not measured in this audit | Measure actual production assets and subset/split only if Korean glyph coverage remains correct |

The earlier token mismatch and wrong-server E2E findings are closed: generated-token consumption is tested, regular E2E owns port 3137 without reuse, foundation E2E owns port 3138, and both assert the application identity.

## Frontend verdict

The frontend is suitable for founder demos, UX research with synthetic data, copy review, and continued component development. It is not suitable for real user onboarding or health-data processing until authenticated backend vertical slices replace the in-memory fixtures and the production security/privacy gates are met.
