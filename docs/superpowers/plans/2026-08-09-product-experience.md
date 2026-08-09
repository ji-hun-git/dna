# Midnight Evidence Ledger Product Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an accessible Korean-first web and mobile product slice that makes official comparisons, verified health-record timelines, consent, provenance, retention, export, and deletion understandable in the approved Midnight Evidence Ledger visual language.

**Architecture:** A versioned token package is the single visual source for Next.js/Storybook and Flutter. The Seoul-hosted web BFF keeps OAuth tokens out of the browser and renders public comparison and authenticated record views from generated OpenAPI contracts. The deliberately offline Flutter application owns a separate, user-controlled SQLCipher vault; records enter it only through an explicit REC export-archive import or a fully reviewed on-device document flow. Server profile deletion and local-vault erasure are distinct actions and the copy boundary is always disclosed. Every data mark maps to a real value and every status has text/icon semantics in addition to color.

**Tech Stack:** Next.js 16.x, React 19, TypeScript 5.x strict mode, Tailwind CSS 4, Radix UI, Storybook 10.x, Vitest, Testing Library, Playwright, axe-core, Orval 8.24.0 with Zod 4 runtime schemas, Flutter 3.44.7, Dart 3.12+, Riverpod, go_router, Drift, `sqlite3` 3.5.1 with its `source: sqlcipher` native-assets hook, `flutter_secure_storage` 11.0.0, Tesseract 5.5.2 with a checksummed Korean model for the conditional offline OCR path

## Global Constraints

- The approved visual direction is `Midnight Evidence Ledger`: near-black background, off-white primary text, muted gray metadata, cyan only for verified/active meaning, and red only for safety/error meaning.
- Korean body content uses a readable Korean sans-serif; monospaced type is limited to metadata, identifiers, timestamps, and compact numeric labels.
- Dot grids, unit grids, sparklines, and marks encode real data and expose a text alternative; decorative pseudo-data is prohibited.
- Meaning never depends on color alone; every state includes a text label or icon with an accessible name.
- Body text contrast is at least 4.5:1, large text at least 3:1, focus indicators at least 3:1, and pointer targets are at least 44 by 44 CSS pixels.
- Respect `prefers-reduced-motion`; no essential information is animated and no transition exceeds 200 ms.
- Medical copy says source, retrieval date, applicable period, caveat, verification state, and uncertainty in plain Korean.
- The interface must not claim diagnosis, provider quality guarantees, personalized medication advice, or emergency assessment.
- No direct identifier, record value, genetic result, diagnosis term, or source document reference may enter application navigation URLs, browser history, referrers, analytics, crash reports, push messages, logs, or DOM snapshots committed to Git. The sole transport exception is the short-lived opaque object key already embedded by REC in its bounded presigned upload URL; it never enters navigation/history/referrer/log output and is sent only to the allowlisted quarantine host.
- No advertising SDK or user-level health targeting is permitted.
- Personal views require an authenticated personal-data session; public comparison pages call only the public-reference plane.
- Browser OAuth tokens are held only by the Seoul BFF. The browser receives one opaque host-only session cookie and short-lived, one-use same-origin CSRF tokens; it never receives an access or refresh token.
- Source-document retention defaults to immediate deletion after verified extraction; encrypted retention is a separate explicit opt-in.
- The mobile vault is an explicit second copy controlled by the user. A server reset cannot erase a device that never reconnects, so the product never claims remote erasure of an offline device and offers a separate local cryptographic-erasure action.
- The MVP mobile binary has no general network client and no Android `INTERNET` permission. On-device extraction is conditional on a benchmarked, bundled OCR build and always falls back to manual, local review.
- Visual review must compare against all five approved files under `product/visual-references/`; reuse their editorial grammar, not their factual content or exact composition.
- Avoid generic wellness gradients, glassmorphism, oversized rounded SaaS cards, decorative DNA helices, stock medical imagery, and gamified health scores. Use flat editorial planes, disciplined rules, compact provenance, generous negative space, and sharply bounded data marks.

---

## File Structure and Responsibilities

```text
packages/design-tokens/
  tokens.json                              Canonical semantic design tokens
  src/generate.ts                          Deterministic CSS/Dart token generator
  dist/tokens.css                          Generated web variables
  dist/tokens.dart                         Generated Flutter constants
  tests/tokens.test.ts                     Contrast and semantic-token tests
apps/web/
  app/(public)/compare/page.tsx             Public comparison route
  app/(private)/records/page.tsx            Verified timeline route
  app/(private)/settings/privacy/page.tsx   Consent/retention/export/delete route
  components/evidence/                      SourceStrip, UnitGrid, EvidenceCard
  components/privacy/                       ConsentReceipt, RetentionChoice
  orval.config.mjs                          Generated-client projects for PUB, REC, and FND contracts
  lib/api/generated/                        Generated Zod schemas and operation types; never hand-edited
  lib/api/public-client.server.ts           Public-plane wrapper with configured-origin enforcement
  lib/api/personal-client.server.ts         Server-only personal-plane client with generated validation
  lib/auth/                                 Opaque BFF session, PKCE, CSRF/origin, refresh, step-up policy
  app/auth/                                 Login, callback, step-up, and logout BFF routes
  app/v1/private/                           Fixed personal/consent BFF routes; never a generic proxy
  lib/telemetry/safe-events.ts              Closed analytics vocabulary
  stories/                                  Reviewable component states
  tests/                                    Unit and accessibility tests
  e2e/                                      Cross-route privacy and usability tests
apps/mobile/
  android/app/src/main/AndroidManifest.xml  Disable platform backup and omit INTERNET permission
  ios/Runner/Runner.entitlements            Complete data protection for private files
  ios/Runner/VaultFilePolicy.swift          Exclude DB, WAL, SHM, imports, and exports from backup
  lib/app.dart                              Riverpod/go_router application shell
  lib/design/tokens.g.dart                  Generated token import
  lib/api/generated/                        Deterministically generated REC timeline parser
  lib/vault/key_store.dart                  Device-keystore abstraction
  lib/vault/database.dart                   SQLCipher-backed Drift database
  lib/vault/export_importer.dart            Bounded, digest-verified REC archive import
  lib/features/records/                     Local timeline and source-state UI
  lib/features/local_intake/                Offline OCR/manual review with no server path
  lib/features/privacy/                     Consent, retention, export, delete UI
  test/                                     Widget, semantics, and vault tests
infra/modules/product-web/                  Seoul BFF, regional ALB/WAF, session table, KMS, alarms
```

The web clients consume exact OpenAPI contracts produced by the public-data, personal-record, and foundation plans. Orval generates Zod 4 schemas and operation types into `apps/web/lib/api/generated/`; wrappers add origin, session, and error-policy enforcement but never duplicate backend DTOs. A narrow build-time generator reads the same REC OpenAPI and produces the mobile `VerifiedTimeline` parser. The mobile importer accepts only REC's six required files plus its one explicitly optional retained-source entry and verifies the signature plus every manifest digest before an atomic import. Locally extracted candidates remain `local_review_required` until the user confirms every field; they never masquerade as server-verified records.

### Task 1: Create cross-platform semantic design tokens

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Generate: `pnpm-lock.yaml`
- Create: `packages/design-tokens/package.json`
- Create: `packages/design-tokens/tokens.json`
- Create: `packages/design-tokens/src/generate.ts`
- Create: `packages/design-tokens/tests/tokens.test.ts`
- Generate: `packages/design-tokens/dist/tokens.css`
- Generate: `packages/design-tokens/dist/tokens.dart`
- Generate: `packages/design-tokens/dist/tokens.manifest.json`

**Interfaces:**
- Consumes: semantic token JSON groups `color`, `type`, `space`, `radius`, `motion`, and `target`.
- Produces: CSS variables `--gc-color-*`, `--gc-space-*`; Dart class `GcTokens`; generation command `pnpm --filter @gc/design-tokens generate`.

- [ ] **Step 1: Scaffold the pinned workspace, then write the failing semantic and contrast test**

Create the root workspace files and `@gc/design-tokens` manifest shown in Step 3 first, with the test script and exact dev dependency pins but without `tokens.json` or generated output. Run `corepack enable`, `corepack prepare pnpm@11.20.0+sha512.9a6f330a95b66446ea088faf1521405a8a01f07fde7124cc9958dfed52d4bb436737e65b08f85f37b46fcba375092558ac51262b816844b22f63406ed166bfee --activate`, `pnpm install --lockfile-only`, then `pnpm install --frozen-lockfile`. This scaffolding establishes the test runner; it is not the implementation under test. Now add only the following failing test:

```typescript
// packages/design-tokens/tests/tokens.test.ts
import tokens from "../tokens.json" with { type: "json" };
import { describe, expect, it } from "vitest";

const luminance = (hex: string) => {
  const channels = hex.slice(1).match(/.{2}/g)!.map((part) => Number.parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

describe("Midnight Evidence Ledger tokens", () => {
  it("meets body and focus contrast gates", () => {
    expect(contrast(tokens.color.text.primary, tokens.color.surface.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.color.focus.ring, tokens.color.surface.canvas)).toBeGreaterThanOrEqual(3);
  });

  it("keeps verification and danger semantically distinct", () => {
    expect(tokens.color.status.verified).not.toBe(tokens.color.status.danger);
    expect(tokens.target.minimum).toBe("44px");
    expect(Number.parseInt(tokens.motion.standard)).toBeLessThanOrEqual(200);
  });
});
```

- [ ] **Step 2: Run and confirm the token file is absent for the intended reason**

Run: `pnpm --filter @gc/design-tokens test`

Expected: Vitest starts from the locked workspace and fails only while resolving `../tokens.json`; “workspace/package not found,” missing pnpm, or missing Vitest is an invalid RED state.

- [ ] **Step 3: Add the canonical token values**

```json
{
  "name":"genome-companion-korea",
  "private":true,
  "packageManager":"pnpm@11.20.0+sha512.9a6f330a95b66446ea088faf1521405a8a01f07fde7124cc9958dfed52d4bb436737e65b08f85f37b46fcba375092558ac51262b816844b22f63406ed166bfee",
  "engines":{"node":">=24 <25"},
  "scripts":{"tokens":"pnpm --filter @gc/design-tokens generate","web:test":"pnpm --filter @gc/web test"}
}
```

```yaml
packages:
  - "apps/web"
  - "packages/*"
```

```json
{
  "name":"@gc/design-tokens",
  "version":"0.1.0",
  "private":true,
  "type":"module",
  "exports":{"./tokens.css":"./dist/tokens.css","./tokens.dart":"./dist/tokens.dart","./manifest":"./dist/tokens.manifest.json"},
  "scripts":{"generate":"tsx src/generate.ts","test":"vitest run"},
  "devDependencies":{"tsx":"^4.20.0","typescript":"^5.9.0","vitest":"4.1.10"}
}
```

```json
{
  "color": {
    "surface": {"canvas":"#08090A","raised":"#111315","inverse":"#F2F0EA"},
    "text": {"primary":"#F2F0EA","secondary":"#A8AAAD","inverse":"#111315"},
    "line": {"subtle":"#2B2E31","strong":"#6F7479"},
    "status": {"verified":"#69E7F2","danger":"#FF6B6B","warning":"#F0C36A","unknown":"#A8AAAD"},
    "focus": {"ring":"#8CF3FA"}
  },
  "type": {
    "sans":"Pretendard Variable, Pretendard, Noto Sans KR, system-ui, sans-serif",
    "mono":"IBM Plex Mono, ui-monospace, SFMono-Regular, monospace",
    "bodySize":"16px",
    "bodyLine":"1.65"
  },
  "space":{"1":"4px","2":"8px","3":"12px","4":"16px","6":"24px","8":"32px","12":"48px"},
  "radius":{"sm":"2px","md":"6px"},
  "motion":{"fast":"100ms","standard":"180ms"},
  "target":{"minimum":"44px"}
}
```

- [ ] **Step 4: Implement deterministic CSS and Dart generation**

```typescript
// packages/design-tokens/src/generate.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceBytes = readFileSync(resolve(root, "tokens.json"));
const tokens = JSON.parse(sourceBytes.toString("utf8"));
const flatten = (value: unknown, path: string[] = []): Array<[string, string]> =>
  Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
    typeof item === "object" ? flatten(item, [...path, key]) : [[...path, key].join("-"), String(item)]],
  );
const entries = flatten(tokens);
const css = `:root {\n${entries.map(([k,v]) => `  --gc-${k}: ${v};`).join("\n")}\n}\n`;
const dartName = (key: string) => key.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const dart = `abstract final class GcTokens {\n${entries.map(([k,v]) => `  static const String ${dartName(k)} = '${v}';`).join("\n")}\n}\n`;
mkdirSync(resolve(root, "dist"), { recursive: true });
writeFileSync(resolve(root, "dist/tokens.css"), css);
writeFileSync(resolve(root, "dist/tokens.dart"), dart);
const sha256 = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const manifest = {
  schemaVersion: "design-token-manifest.v1",
  sourceSha256: sha256(sourceBytes),
  outputs: { "tokens.css": sha256(css), "tokens.dart": sha256(dart) },
};
writeFileSync(resolve(root, "dist/tokens.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
```

- [ ] **Step 5: Generate twice, byte-compare, test, and commit**

Run in PowerShell:

```powershell
corepack enable
corepack prepare pnpm@11.20.0+sha512.9a6f330a95b66446ea088faf1521405a8a01f07fde7124cc9958dfed52d4bb436737e65b08f85f37b46fcba375092558ac51262b816844b22f63406ed166bfee --activate
pnpm install --frozen-lockfile
pnpm --filter @gc/design-tokens generate
$firstCss = (Get-FileHash packages/design-tokens/dist/tokens.css -Algorithm SHA256).Hash
$firstDart = (Get-FileHash packages/design-tokens/dist/tokens.dart -Algorithm SHA256).Hash
$firstManifest = (Get-FileHash packages/design-tokens/dist/tokens.manifest.json -Algorithm SHA256).Hash
pnpm --filter @gc/design-tokens generate
if ($firstCss -ne (Get-FileHash packages/design-tokens/dist/tokens.css -Algorithm SHA256).Hash) { throw "nondeterministic CSS tokens" }
if ($firstDart -ne (Get-FileHash packages/design-tokens/dist/tokens.dart -Algorithm SHA256).Hash) { throw "nondeterministic Dart tokens" }
if ($firstManifest -ne (Get-FileHash packages/design-tokens/dist/tokens.manifest.json -Algorithm SHA256).Hash) { throw "nondeterministic token manifest" }
pnpm --filter @gc/design-tokens test
```

Expected: generation succeeds; the two independently calculated byte hashes remain identical; tests PASS. This proof does not rely on `git diff` seeing untracked generated files.

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml packages/design-tokens
git commit -m "feat(ui): add Midnight Evidence Ledger tokens"
```

### Task 2: Build the evidence component primitives in Storybook

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/.storybook/main.ts`
- Create: `apps/web/.storybook/preview.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/tests/setup.ts`
- Create: `apps/web/tests/vitest.d.ts`
- Create: `apps/web/components/evidence/SourceStrip.tsx`
- Create: `apps/web/components/evidence/EvidenceCard.tsx`
- Create: `apps/web/components/evidence/UnitGrid.tsx`
- Create: `apps/web/components/evidence/StatusLabel.tsx`
- Create: `apps/web/stories/EvidenceCard.stories.tsx`
- Create: `apps/web/tests/fixtures/public.ts`
- Test: `apps/web/tests/evidence-components.test.tsx`

**Interfaces:**
- Consumes: `EvidenceViewModel { title: string; value: string; status: "verified" | "stale" | "unknown"; sourceName: string; retrievedAt: string; applicablePeriod: string; caveat: string; units: readonly UnitMark[] }`.
- Produces: `EvidenceCard(props: EvidenceViewModel)`, `SourceStrip`, and `UnitGrid` with a visible/textual alternative and no medical assertion of their own.

- [ ] **Step 1: Write failing accessible-name and real-data tests**

First create `apps/web/package.json`, `tsconfig.json`, `vitest.config.ts`, `tests/setup.ts`, and `tests/vitest.d.ts` with the exact manifest/configuration bodies frozen in Step 3, but create none of the evidence components. Activate only the integrity-bound root `packageManager`, run `pnpm install --lockfile-only`, then `pnpm install --frozen-lockfile`. This is test-harness scaffolding, not the implementation under test. Now add the failing test:

```tsx
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { EvidenceCard } from "@/components/evidence/EvidenceCard";
import { verifiedPriceFixture } from "./fixtures/public";

it("renders provenance and a text alternative for every mark", async () => {
  const { container } = render(<EvidenceCard {...verifiedPriceFixture} />);
  expect(screen.getByText("검증됨")).toBeVisible();
  expect(screen.getByText(/조회일 2026-08-09/)).toBeVisible();
  expect(screen.getByRole("img", { name: /10개 중 7개/ })).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});
```

- [ ] **Step 2: Install the newly declared workspace and confirm missing components**

Run: `corepack enable && corepack prepare pnpm@11.20.0+sha512.9a6f330a95b66446ea088faf1521405a8a01f07fde7124cc9958dfed52d4bb436737e65b08f85f37b46fcba375092558ac51262b816844b22f63406ed166bfee --activate && pnpm install --frozen-lockfile && pnpm --filter @gc/web test -- evidence-components.test.tsx`

Expected: FAIL resolving `EvidenceCard`.

- [ ] **Step 3: Implement status and source primitives**

```json
{
  "name":"@gc/web",
  "version":"0.1.0",
  "private":true,
  "scripts":{"dev":"next dev","build":"next build","test":"vitest run","storybook":"storybook dev -p 6006","build-storybook":"storybook build","e2e":"playwright test"},
  "dependencies":{"@gc/design-tokens":"workspace:*","next":"16.3.0","react":"19.2.8","react-dom":"19.2.8","zod":"4.4.3","@radix-ui/react-dialog":"1.1.23"},
  "devDependencies":{"@playwright/test":"1.62.1","@storybook/addon-a11y":"10.5.7","@storybook/nextjs-vite":"10.5.7","@tailwindcss/postcss":"4.3.3","@testing-library/dom":"10.4.1","@testing-library/jest-dom":"6.8.0","@testing-library/react":"16.3.0","@testing-library/user-event":"14.6.1","@types/node":"24.0.0","@types/react":"19.2.0","@types/react-dom":"19.2.0","@vitejs/plugin-react":"6.0.0","@vitest/browser-playwright":"4.1.10","autoprefixer":"10.4.21","jest-axe":"11.0.0","jsdom":"27.0.0","msw":"2.12.0","postcss":"8.5.6","storybook":"10.5.7","tailwindcss":"4.3.3","typescript":"5.9.2","vite":"8.2.1","vitest":"4.1.10"}
}
```

Use these executable configuration bodies rather than placeholder prose:

```javascript
// apps/web/postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
```

```css
/* apps/web/app/globals.css */
@import "tailwindcss";
@source "../components/**/*.{ts,tsx}";
@source "../stories/**/*.{ts,tsx}";
html { color-scheme: dark; background: var(--gc-color-surface-canvas); }
body { margin: 0; color: var(--gc-color-text-primary); font-family: var(--gc-type-sans); }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
```

```typescript
// apps/web/vitest.config.ts
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"], restoreMocks: true },
});
```

```typescript
// apps/web/.storybook/main.ts
import type { StorybookConfig } from "@storybook/nextjs-vite";
const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: { name: "@storybook/nextjs-vite", options: {} },
};
export default config;
```

```typescript
// apps/web/tests/setup.ts
import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "jest-axe";
import { expect } from "vitest";
expect.extend(toHaveNoViolations);
```

`tests/vitest.d.ts` augments Vitest's `Assertion` with `jest-axe`'s `JestAxeMatchers`. `app/layout.tsx` imports `@gc/design-tokens/tokens.css` and `./globals.css`, sets `lang="ko"`, uses the Korean sans token for body copy, and contains no analytics script. Storybook `preview.ts` imports the same CSS, sets the `#08090A` background, and configures the a11y addon to fail CI on serious/critical violations.

```tsx
// apps/web/components/evidence/StatusLabel.tsx
const labels = { verified: "검증됨", stale: "업데이트 필요", unknown: "확인되지 않음" } as const;
export function StatusLabel({ status }: { status: keyof typeof labels }) {
  return <span data-status={status}><span aria-hidden="true">●</span> {labels[status]}</span>;
}

// apps/web/components/evidence/SourceStrip.tsx
export function SourceStrip(props: { sourceName: string; retrievedAt: string; applicablePeriod: string; caveat: string }) {
  return <footer className="font-mono text-xs text-secondary">
    <p>출처 {props.sourceName} · 조회일 {props.retrievedAt} · 적용기간 {props.applicablePeriod}</p>
    <p>{props.caveat}</p>
  </footer>;
}
```

- [ ] **Step 4: Implement data-bound unit marks and the composed card**

```tsx
// apps/web/components/evidence/UnitGrid.tsx
export type UnitMark = { id: string; active: boolean; label: string };
export function UnitGrid({ units }: { units: readonly UnitMark[] }) {
  const active = units.filter((unit) => unit.active).length;
  return <div role="img" aria-label={`${units.length}개 중 ${active}개`} className="grid grid-cols-10 gap-1">
    {units.map((unit) => <span key={unit.id} title={unit.label} data-active={unit.active} aria-hidden="true" />)}
  </div>;
}
```

`EvidenceCard` must use a semantic `<article>`, visible `<h2>`, `StatusLabel`, real value, `UnitGrid`, and `SourceStrip`. Add Storybook stories for verified, stale, unknown, long Korean source name, 200% zoom, and reduced motion.

```typescript
// apps/web/tests/fixtures/public.ts
import type { EvidenceViewModel } from "@/components/evidence/EvidenceCard";
export const verifiedPriceFixture: EvidenceViewModel = {
  title: "비급여 검사 금액",
  value: "70,000원",
  status: "verified",
  sourceName: "건강보험심사평가원",
  retrievedAt: "2026-08-09",
  applicablePeriod: "2026년 공개자료",
  caveat: "공개 금액은 실제 청구액이나 의료의 질을 보장하지 않습니다.",
  units: Array.from({ length: 10 }, (_, index) => ({ id: `unit-${index + 1}`, active: index < 7, label: `${index + 1}만원` })),
};
```

- [ ] **Step 5: Run tests and Storybook smoke build, then commit**

Run: `pnpm --filter @gc/web test -- evidence-components.test.tsx && pnpm --filter @gc/web build-storybook --quiet`

Expected: component tests PASS and static Storybook build succeeds.

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.ts apps/web/postcss.config.mjs apps/web/vitest.config.ts apps/web/playwright.config.ts apps/web/.storybook apps/web/app/layout.tsx apps/web/app/globals.css apps/web/components/evidence apps/web/stories apps/web/tests pnpm-lock.yaml
git commit -m "feat(ui): add accessible evidence components"
```

### Task 3: Deliver the public provider and non-covered-price comparison slice

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/orval.config.mjs`
- Generate: `apps/web/lib/api/generated/public.zod.ts`
- Create: `apps/web/lib/api/private-service-trust.server.ts`
- Create: `apps/web/lib/api/public-client.server.ts`
- Create: `apps/web/app/v1/public/item-discovery/route.ts`
- Create: `apps/web/app/v1/public/non-covered-prices/route.ts`
- Create: `apps/web/app/v1/public/providers/route.ts`
- Create: `apps/web/app/(public)/compare/page.tsx`
- Create: `apps/web/app/(public)/compare/ComparisonClient.tsx`
- Create: `apps/web/components/compare/FilterPanel.tsx`
- Create: `apps/web/components/compare/OfficialItemResults.tsx`
- Create: `apps/web/components/compare/NonCoveredPriceTable.tsx`
- Create: `apps/web/components/compare/ProviderDirectory.tsx`
- Test: `apps/web/tests/public-client.test.ts`
- Test: `apps/web/tests/public-contract-generation.test.ts`
- Test: `apps/web/e2e/compare.spec.ts`

**Interfaces:**
- Consumes without copying DTOs: PUB OpenAPI `apps/core-api/src/main/resources/openapi/public-comparison.yaml`; `listNonCoveredItems` (`GET /v1/public/non-covered-items?query&cursor&size -> NonCoveredItemPage`), `listNonCoveredPrices` (`GET /v1/public/comparisons/non-covered-prices?itemCode&regionCode&providerType&sort&cursor&size -> NonCoveredPricePage`), and `listPublicProviders` (`GET /v1/public/comparisons/providers?regionCode&providerType&page&size -> ComparisonPage`); FND `public_api_private_base_url=https://public-data.service.kr.internal`, public-data listener/certificate, private-service trust-bundle secret ARN/digest, and product-web client SG.
- Produces: Orval-generated strict Zod 4 schemas; server-only configured-origin fetches; same-origin POST BFF routes that accept only the exact public filters and never forward cookies, authorization, IP, user-agent, referrer, or arbitrary headers; item discovery → explicit item selection → price display; a separate provider directory; no sponsored default, quality score, recommendation, medical-suitability inference, or personal-session call.

- [ ] **Step 1: Write failing generated-contract and server-boundary tests**

```typescript
it("discovers official items using only the configured C0 origin and exact filters", async () => {
  server.use(http.get("https://public.test/v1/public/non-covered-items", ({ request }) => {
    const url = new URL(request.url);
    expect([...url.searchParams.keys()].sort()).toEqual(["query", "size"]);
    expect(request.headers.get("cookie")).toBeNull();
    expect(request.headers.get("authorization")).toBeNull();
    return HttpResponse.json(nonCoveredItemPageFixture);
  }));
  await discoverNonCoveredItems({ query: "초음파", size: 20 });
});

it("rejects hand-shaped data missing the generated provenance contract", () => {
  expect(() => NonCoveredItemPage.parse({ items: [{ itemCode: "HE118" }] })).toThrow();
});
```

`public-contract-generation.test.ts` reads the OpenAPI source and asserts the four stable PUB operation IDs (`listNonCoveredItems`, `listNonCoveredPrices`, `listPublicProviders`, `getPublicFact`), regenerates into a temporary directory, and byte-compares it with committed `public.zod.ts`. It also imports Orval v8's PascalCase generated `NonCoveredItemPage`, `NonCoveredPricePage`, and `ComparisonPage` exports; no handwritten response schema is allowed under `apps/web/lib/api`.

- [ ] **Step 2: Run and confirm missing client**

Run: `pnpm --filter @gc/web test -- public-client.test.ts public-contract-generation.test.ts`

Expected: FAIL because Orval configuration, generated schemas, and the server-only public client are absent.

- [ ] **Step 3: Generate strict Zod contracts from PUB OpenAPI**

Add `orval: 8.24.0` to dev dependencies and `"generate:contracts":"orval --config ./orval.config.mjs"`. Start the config with the PUB project; Tasks 4 and 5 add REC and FND projects without changing these settings:

```javascript
// apps/web/orval.config.mjs
import { defineConfig } from "orval";

const strictZod = (outputTarget, inputTarget) => ({
  input: { target: inputTarget },
  output: {
    mode: "single", client: "zod", target: outputTarget,
    override: { zod: {
      variant: "classic", version: 4, exactOptional: true,
      strict: { response: true, query: true, param: true, header: true, body: true },
      generate: { response: true, query: true, param: true, header: true, body: true },
      generateEachHttpStatus: true, generateReusableSchemas: true,
    } },
  },
});

export default defineConfig({
  publicZod: strictZod(
    "./lib/api/generated/public.zod.ts",
    "../core-api/src/main/resources/openapi/public-comparison.yaml",
  ),
});
```

Run: `pnpm --filter @gc/web generate:contracts && pnpm --filter @gc/web exec tsc --noEmit`.

Expected: generation succeeds under Zod 4, exports the three page schemas plus exact operation query/response schemas, and a second generation produces no diff.

- [ ] **Step 4: Implement server-only transport and no-history BFF routes**

`private-service-trust.server.ts` begins with `import "server-only"`, reads exactly `PRIVATE_SERVICE_TRUST_BUNDLE_SECRET_ARN` and `PRIVATE_SERVICE_TRUST_BUNDLE_SHA256`, obtains only that public PEM through the regional Secrets Manager endpoint, caps it at 32 KiB, requires one or more valid CA certificates and lowercase digest equality, and constructs a hostname-verifying Node TLS context with no proxy/environment CA/fallback. `public-client.server.ts` reads only `PUBLIC_API_PRIVATE_BASE_URL` (not a `NEXT_PUBLIC_*` value); production requires the exact `https://public-data.service.kr.internal` FND output with no alternate port/path/userinfo/query, while tests may inject `https://public.test`. It builds only the three fixed upstream paths, uses the pinned private-service TLS context, `credentials:"omit"`, sends no caller headers, applies a five-second abort timeout and a response-byte cap, and validates every 200 body with the generated schema before returning it. It maps trust/origin/upstream/schema failures to stable public errors with no response-body echo and has no API-Gateway/public-origin/NAT fallback.

Each same-origin route parses a strict Zod-generated request shape from JSON, rejects bodies above 1 KiB, and passes only the parsed fields. Free-text `query` and selected `itemCode` remain in in-memory UI state and POST bodies, never browser URLs/history, analytics, referrers, or server logs. `item-discovery` requires a nonblank 1–80-character query and size 1–100; price requires `itemCode` and allows only the OpenAPI region/provider/sort/cursor/size values; provider directory allows only its OpenAPI filters.

- [ ] **Step 5: Render source-faithful discovery, prices, and directory**

The first tab is “비급여 공개 금액”: search official item names/codes, show official results in deterministic order, require explicit selection, then request prices. The second tab is “의료기관 찾기” and never shows or implies a price. Preserve every PUB `publication`, `availability`, `source`, `transformVersion`, `schemaHash`, `methodologyVersion`, and page/item `caveats` field in the view model. Show `currentAmountWon` only as KRW and never as a quote/final bill or quality signal. The initial price sort is `PROVIDER_NAME`; `AMOUNT_ASC`/`AMOUNT_DESC` appear only as explicit user choices. Provider directory pagination remains page/size; discovery and price use only opaque cursors. No UI invents ranking, popularity, synonyms, typo correction, or medical fit.

- [ ] **Step 6: Add Playwright proof and commit**

```typescript
test("comparison remains usable by keyboard and exposes provenance", async ({ page }) => {
  await page.goto("/compare");
  await page.getByRole("button", { name: "필터 열기" }).press("Enter");
  await page.getByLabel("공식 비급여 항목 검색").fill("초음파");
  await page.getByRole("button", { name: "공식 항목 찾기" }).click();
  await page.getByRole("radio", { name: /HE118/ }).check();
  await page.getByRole("button", { name: "공개 금액 보기" }).click();
  await expect(page.getByText("비급여 금액은 의료의 질 평가가 아닙니다")).toBeVisible();
  await expect(page.getByRole("link", { name: /출처 보기/ }).first()).toHaveAttribute("href", /^https:\/\//);
  expect(page.url()).toBe("http://localhost:3000/compare");
});
```

Capture browser and mock-server requests and assert: no personal API call; no cookie/auth forwarding to C0; no free-text query/item code in the browser URL; discovery precedes price; the separate directory has no amount; stale/unavailable/caveat states remain keyboard- and screen-reader-usable.

Run: `pnpm --filter @gc/web generate:contracts && git diff --exit-code apps/web/lib/api/generated && pnpm --filter @gc/web test && pnpm --filter @gc/web exec playwright test e2e/compare.spec.ts`

Expected: generated-contract drift is zero; unit and browser tests PASS; public requests stay in the public plane and sensitive search state never enters a URL or log capture.

```bash
git add apps/web/package.json apps/web/orval.config.mjs apps/web/lib/api apps/web/app/v1/public/item-discovery apps/web/app/v1/public/non-covered-prices apps/web/app/v1/public/providers apps/web/app/'(public)' apps/web/components/compare apps/web/tests apps/web/e2e/compare.spec.ts pnpm-lock.yaml
git commit -m "feat(web): add transparent public comparison journey"
```

### Task 4: Build the Seoul BFF authentication boundary and generated private contracts

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/orval.config.mjs`
- Generate: `apps/web/lib/api/generated/personal.zod.ts`
- Generate: `apps/web/lib/api/generated/consent.zod.ts`
- Create: `apps/web/lib/auth/config.server.ts`
- Create: `apps/web/lib/auth/session-store.server.ts`
- Create: `apps/web/lib/auth/oauth.server.ts`
- Create: `apps/web/lib/auth/csrf.server.ts`
- Create: `apps/web/lib/auth/require-session.server.ts`
- Create: `apps/web/lib/api/personal-client.server.ts`
- Create: `apps/web/app/auth/login/route.ts`
- Create: `apps/web/app/auth/callback/route.ts`
- Create: `apps/web/app/auth/step-up/route.ts`
- Create: `apps/web/app/auth/csrf/route.ts`
- Create: `apps/web/app/auth/logout/route.ts`
- Create: `apps/web/proxy.ts`
- Test: `apps/web/tests/private-contract-generation.test.ts`
- Test: `apps/web/tests/oauth-session.test.ts`
- Test: `apps/web/tests/private-security-headers.test.ts`

**Interfaces:**
- Consumes without DTO copies: REC `packages/contracts/openapi/personal-record-v1.yaml`; FND `packages/contracts/openapi/consent-api-v1.yaml`; the FND Cognito issuer/client/scopes; FND `core_api_private_base_url=https://core-api.service.kr.internal`, core listener/certificate, the Task-3 pinned private-service trust loader, and product-web client SG; a Korea-only session-store port.
- Produces: strict generated REC/FND Zod 4 contracts; Authorization Code + PKCE BFF login; opaque server-side session; exact-origin CSRF enforcement; fixed-path authenticated upstream client; forced-dynamic/no-store private responses. The browser never receives an OAuth token and the BFF never accepts a caller-selected upstream URL.

- [ ] **Step 1: Write failing contract-drift, OAuth, cookie, and CSRF tests**

Tests must prove:

- generated REC contains exactly the operation IDs `createDocumentUploadTicket`, `completeDocumentUpload`, `getDocumentStatus`, `getDocumentReview`, `confirmDocumentFields`, `getRecordTimeline`, `getRecord`, `requestRecordExplanation`, `getRecordExplanationStatus`, `createRecordExport`, `getRecordExport`, `downloadRecordExport`, `resetProfile`, and `getRecordSources`;
- generated FND contains `getConsentOptions`, `grantConsent`, `listConsents`, and `revokeConsent`, and exports both `ConsentOptionsView` and `ConsentView` rather than UI-invented configuration/receipt types;
- login creates 256-bit `state`, `nonce`, PKCE verifier/challenge and a one-use 10-minute server transaction, then binds it to the initiating browser with a separate random `__Host-gc_login` host-only, Secure, HttpOnly, SameSite=Lax transaction handle; callback rejects missing/mismatched cookie, state/nonce/issuer/audience/PKCE mismatch, transferred callback, and replay;
- success rotates to a new random session handle and sets `__Host-gc_session` as `Secure; HttpOnly; SameSite=Lax; Path=/` with no `Domain`, while the access and rotating refresh tokens exist only in the server-side record;
- every mutation requires an exact configured `Origin` and a one-use 256-bit random `X-GC-CSRF` value issued by same-origin `GET /auth/csrf`; the server stores only `sha256(csrfToken)` in a nonce row bound to the session-handle hash, session version, and a 10-minute expiry. Absent/null/cross-origin/expired/replayed/old-session tokens fail before any upstream call;
- private pages and BFF responses include `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, a restrictive nonce-based CSP, and `frame-ancestors 'none'`.

- [ ] **Step 2: Install security dependencies and confirm RED**

Pin `oauth4webapi` 3.8.6, `jose` 6.2.3, `@aws-sdk/client-dynamodb` 3.1106.0, `@aws-sdk/lib-dynamodb` 3.1106.0, and `@aws-sdk/client-secrets-manager` 3.1106.0 to exact versions in the lock. Secrets Manager is used only to fetch FND's public private-service CA bundle by one exact ARN; there is no Cognito client secret, generic secret-read path, or direct KMS SDK client. DynamoDB encryption remains service-side, while the task role's sole KMS authorization is the later Task 10 `ViaService`/exact-SecretARN-bound decrypt that Secrets Manager requires for this one trust-bundle value. Run `pnpm install --frozen-lockfile`, then:

Run: `pnpm --filter @gc/web test -- private-contract-generation.test.ts oauth-session.test.ts private-security-headers.test.ts`

Expected: FAIL because the two generated projects and BFF boundary do not exist.

- [ ] **Step 3: Extend Orval from the two authoritative OpenAPI files**

Add projects without changing Task 3's strict settings:

```javascript
personalZod: strictZod(
  "./lib/api/generated/personal.zod.ts",
  "../../packages/contracts/openapi/personal-record-v1.yaml",
),
consentZod: strictZod(
  "./lib/api/generated/consent.zod.ts",
  "../../packages/contracts/openapi/consent-api-v1.yaml",
),
```

The generation test regenerates all three clients into a temporary directory and byte-compares committed output. It rejects any handwritten `VerifiedRecord`, `VerifiedTimeline`, `ConsentView`, export/reset, upload/review, or explanation response schema under `apps/web/`.

- [ ] **Step 4: Implement PKCE, opaque sessions, rotation, and step-up**

Use `oauth4webapi` for discovery/authorization/token processing and `jose` for explicit ID/access-token verification. Allow exactly the configured FND issuer, authorization endpoint, token endpoint, JWKS URI, public web client ID, URL resource `https://api.genome-companion.kr`, and environment-specific HTTPS callback; reject discovery redirect or host drift. Every base and step-up authorization request includes RFC 8707 `resource=https://api.genome-companion.kr`. The one-use login transaction and session rows live in a dedicated ap-northeast-2 DynamoDB table encrypted with its own KMS key and TTL enabled. Persist only token material, issuer/client metadata, scalar `auth_time`, exact qualified scopes, absolute/idle expiry, token-version, and coarse timestamps—never `amr` (Cognito does not attest it here), question, record, fact, source, consent contents, referrer, or IP. Hash the 256-bit browser handle with SHA-256 for the partition key.

Refresh uses a conditional token-version update so two concurrent refreshes cannot fork a rotating refresh token. `GET /auth/csrf` requires the session, generates a new 32-byte CSPRNG token, emits only its unpadded base64url `{csrfToken}` under `no-store`, and conditionally creates a separate row keyed by `sha256(csrfToken)` with the session-handle hash, session version, issued time, and 10-minute TTL; it never stores the token itself or sets a readable cookie. Mutation hashes the presented token, constant-time compares the canonical digest, checks the bound session/version/expiry, and conditionally deletes that exact nonce before upstream I/O, so replay loses. There is no CSRF MAC key or BFF secret-manager dependency. Concurrent tabs request independent tokens. Session rotation and logout invalidate/delete all outstanding nonce rows; tests cover 31/32/33-byte and noncanonical token inputs, concurrent tabs, refresh, step-up rotation, expiry, replay, delete races, and logout. Logout atomically deletes the row, expires all host-only cookies, and calls provider revocation where supported. Step-up starts a fresh browser-bound PKCE transaction with `prompt=login`, `max_age=0`, the base `openid https://api.genome-companion.kr/consent.read https://api.genome-companion.kr/consent.write` scopes, the same `resource` parameter, and exactly one server-chosen action scope—`https://api.genome-companion.kr/records.export` or `https://api.genome-companion.kr/profile.reset`; after callback, the BFF verifies that the **access token** has the exact issuer, URL `aud`, `client_id`, scalar `auth_time <= 300 seconds`, base scopes, and only the requested action scope, then rotates the session again. Assurance comes from this fresh token plus FND's deployed `mfa_configuration=ON`/local-user-only gate, not an invented token claim. Never derive assurance from the ID token alone and never trust a client-supplied scope/action pair.

- [ ] **Step 5: Implement a fixed-operation private upstream and page boundary**

`personal-client.server.ts` begins with `import "server-only"`. It accepts an internal enum of the REC/FND operations—not a URL or arbitrary method—maps each to its exact upstream path under `CORE_API_PRIVATE_BASE_URL`, and production requires exact `https://core-api.service.kr.internal` plus the Task-3 pinned TLS context. It attaches the session access token, uses a two-second connect/five-second total timeout (the export stream has its separately bounded transfer timeout), caps request and response bytes, validates successful bodies with generated schemas, refreshes once on an eligible token-expiry response, and otherwise returns a stable redacted error. It never forwards browser cookies, Origin, referrer, IP, user-agent, or caller headers, and has no API-Gateway/public-origin/NAT fallback.

Private layouts export `dynamic = "force-dynamic"`, `revalidate = 0`, call Next 16's documented `connection()` boundary before private data access, and never serialize token/session material into React Server Component payloads. Next 16 `proxy.ts` applies the private header set and redirects missing opaque sessions without putting the destination, record, or error detail in a query parameter.

- [ ] **Step 6: Verify and commit**

Run: `pnpm --filter @gc/web generate:contracts && git diff --exit-code apps/web/lib/api/generated && pnpm --filter @gc/web test -- private-contract-generation.test.ts oauth-session.test.ts private-security-headers.test.ts`

Expected: deterministic generation, one-use PKCE, cookie/rotation/CSRF negatives, fixed routes, and private cache/header tests PASS.

```bash
git add apps/web/package.json apps/web/orval.config.mjs apps/web/lib/api/generated apps/web/lib/api/personal-client.server.ts apps/web/lib/auth apps/web/app/auth apps/web/proxy.ts apps/web/tests pnpm-lock.yaml
git commit -m "feat(web): add token-isolating private BFF"
```

### Task 5: Deliver document review, verified timeline, and explanation status

**Files:**
- Create: `apps/web/app/(private)/records/new/page.tsx`
- Create: `apps/web/app/(private)/records/page.tsx`
- Create: `apps/web/app/v1/private/documents/upload-ticket/route.ts`
- Create: `apps/web/app/v1/private/documents/complete/route.ts`
- Create: `apps/web/app/v1/private/documents/status/route.ts`
- Create: `apps/web/app/v1/private/documents/review/route.ts`
- Create: `apps/web/app/v1/private/documents/confirm/route.ts`
- Create: `apps/web/app/v1/private/records/timeline/route.ts`
- Create: `apps/web/app/v1/private/records/detail/route.ts`
- Create: `apps/web/app/v1/private/records/explain/route.ts`
- Create: `apps/web/app/v1/private/records/explanation-status/route.ts`
- Create: `apps/web/components/records/DocumentIntake.tsx`
- Create: `apps/web/components/records/CandidateReview.tsx`
- Create: `apps/web/components/records/RecordTimeline.tsx`
- Create: `apps/web/components/records/FactDetailDialog.tsx`
- Create: `apps/web/components/records/ExplanationPanel.tsx`
- Test: `apps/web/tests/document-intake.test.tsx`
- Test: `apps/web/tests/record-timeline.test.tsx`
- Test: `apps/web/e2e/document-to-timeline.spec.ts`

**Interfaces:**
- Consumes through generated REC operations: `createDocumentUploadTicket` with public `BeginUploadRequest`, `completeDocumentUpload` with public `CompleteDocumentUploadRequest`, `getDocumentStatus`, `getDocumentReview`, `confirmDocumentFields` with public `ConfirmExtractionRequest`, `getRecordTimeline`, `getRecord`, `requestRecordExplanation`, and `getRecordExplanationStatus`; active generated FND `ConsentView` grants selected by purpose. The generated public requests never expose REC's internal caller-bearing command types; the BFF supplies only authenticated session context and the documented public fields.
- Produces: explicit cloud-processing/document-retention choice; direct-to-quarantine object upload without BFF file transit; complete candidate-by-candidate review; source-linked `VerifiedTimeline`; generated `CreateRecordExplanationRequest` and `ExplanationResponse`; visible `active|banner|regenerate|suppress` recall behavior. Browser-facing BFF paths are fixed POST endpoints so document, fact, record, response, question, value, and code never enter a browser URL or history.

- [ ] **Step 1: Write failing intake, full-review, timeline, and recall tests**

```tsx
it("labels verification and never turns a value into a diagnosis", () => {
  render(<RecordTimeline records={verifiedTimelineFixture.records} />);
  expect(screen.getAllByText("사용자 확인").length).toBeGreaterThan(0);
  expect(screen.getByText("이 변화만으로 질환을 진단할 수 없습니다.")).toBeVisible();
  expect(screen.queryByText(/당뇨병입니다/)).not.toBeInTheDocument();
});
```

Also prove that optional cloud/retention grants start unchecked; unsupported type/size fails before requesting a ticket; the browser's canonical hex checksum and S3 base64 checksum are deterministic and byte-equal representations; direct object PUT contains no BFF cookie, bearer token, filename, or header beyond REC's five exact required headers; missing/non-`*` `if-none-match`, checksum drift, absent/unexposed `x-amz-version-id`, a second/concurrent write, or a different completion replay fails; every review candidate requires exactly one explicit confirm/reject decision; an edited confirmation preserves the typed decimal as a string until the REC request; no `Accept all` action exists; and no verified timeline row appears before `confirmDocumentFields` succeeds.

- [ ] **Step 2: Run and confirm the private journey is absent**

Run: `pnpm --filter @gc/web test -- document-intake.test.tsx record-timeline.test.tsx`

Expected: FAIL resolving intake/review/timeline components and fixed BFF routes.

- [ ] **Step 3: Implement consent-bound upload and complete user review**

Use only generated schemas. The first screen explains two paths with equal weight: Korea-cloud processing or the offline mobile path from Task 8. Cloud intake requires an active `BUILD_PERSONAL_LAB_TIMELINE` grant and a separate active `PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD` grant; optional `RETAIN_VERIFIED_SOURCE` is never implied or preselected. Pass their IDs exactly as REC requires.

The browser accepts PDF/PNG/JPEG, 1 byte through 20 MiB, computes SHA-256 over the local bytes before any request, and submits generated `BeginUploadRequest` with exactly `{timelineConsentId,cloudProcessingConsentId,retentionConsentId,dataCategory,declaredMediaType,declaredBytes,declaredSha256,retentionChoice}`—never the file, local filename, caller, or subject identifier. `declaredSha256` is canonical `sha256:<64 lowercase hex>`; `dataCategory=LAB_REPORT|MEDICAL_RECORD` is bound to the selected consent grants; and `retentionChoice=DELETE_AFTER_VERIFICATION|RETAIN_ENCRYPTED_365_DAYS` is the cloud path's delete-after-verification default versus the user's explicit 365-day encrypted-retention opt-in. Tests require every consent to authorize the same category/processing choice and reject a substituted category, implicit retention default, or retained choice without the explicit opt-in. The browser derives the S3 base64 checksum only from those same digest bytes, byte-compares it with the returned `x-amz-checksum-sha256` required-header value, and PUTs bytes to the returned `uploadUri` using exactly all five `requiredHeaders` including `if-none-match:*`, `credentials:"omit"`, the exact byte count, and a five-minute abort; a test fails if the origin is not the expected quarantine upload host or a header is missing/extra. The BFF never receives file bytes and the REC controller derives the internal command's caller only from the authenticated principal. The browser reads the CORS-exposed nonempty `x-amz-version-id` response header, then calls `completeDocumentUpload` with generated `CompleteDocumentUploadRequest` exactly `{versionId,checksumSha256:declaredSha256}`. Missing/foreign VersionId, local byte mutation, checksum mismatch, duplicate completion with different bytes, or a replay/concurrent `409|412` fails without current-version discovery or another PUT. Only after successful completion does it poll `getDocumentStatus` with capped exponential backoff while the page is visible and stop at terminal/error/ten minutes.

`CandidateReview` overlays page/bounding-box context, shows OCR text/confidence as untrusted, requires the user to confirm or reject every candidate, validates decimal/unit/date locally for usability, and submits generated public `ConfirmExtractionRequest` with `expectedRevision`; it never sends the path `documentId` or internal `caller`, which REC derives from the route and authenticated principal. A revision conflict refetches and discards no user edits until the user explicitly chooses how to reconcile. The UI never silently confirms, normalizes, infers, or hides a low-confidence field.

- [ ] **Step 4: Render the exact generated timeline and explanation states**

`RecordTimeline` receives the generated `VerifiedTimeline`; no handwritten schema is permitted. Render decimal JSON losslessly as received, never convert units, order by the server order, format the instant for `Asia/Seoul`, and expose `sourceRef`, `sourceAvailable`, `confidence`, and `verificationStatus="user_verified"` with a fixed Korean non-diagnosis caveat. Fetch record detail and record sources only through fixed POST BFF routes. Do not invent freshness, reference ranges, diagnoses, or a quality score absent from REC.

```tsx
export function RecordTimeline({ records }: { records: readonly GeneratedVerifiedRecord[] }) {
  return <ol aria-label="검증된 건강 기록">
    {records.map((record) => <li key={record.factId}>
      <time dateTime={record.effectiveAt}>{formatSeoulDate(record.effectiveAt)}</time>
      <h2>{record.displayKo}</h2><p>{record.value} {record.unit}</p>
      <span>사용자 확인</span>
      <button aria-label={`${record.displayKo} 출처와 불확실성 보기`}>근거 보기</button>
    </li>)}
  </ol>;
}
```

Explanation selection is explicit, 1–20 unique `factId` values. The request contains exactly `{timelineConsentId,factIds,userQuestion}`; question length is 1–500 after trimming for blankness but the submitted text is unchanged. Render every claim with its citation IDs and the exact returned generator/policy/evidence-pack versions. Then query the status route: `banner` keeps content with a warning, `regenerate` hides old content behind a regenerate action, `suppress` removes claims and explains unavailability, and `active` changes nothing. Never ask the worker directly from the browser.

- [ ] **Step 5: Prove the complete browser journey and commit**

Playwright runs: explicit grants → ticket → cookie-free object PUT → completion → status → one decision per candidate → confirmation → timeline → detail → explanation → each recall state. It asserts `page.url()`, browser history, console, storage, public events, BFF access logs, and every **redacted/committed** test artifact contain none of the synthetic filename, document/fact/response IDs, source ref, OCR text, or question. The live DOM is allowed to contain the record value/code the user intentionally views, but the test reporter and snapshot serializer must replace them before persistence. It also proves the direct upload request has only the presigned required headers.

Run: `pnpm --filter @gc/web test && pnpm --filter @gc/web exec playwright test e2e/document-to-timeline.spec.ts`

Expected: the exact REC workflow completes, every candidate is explicitly decided, recall states are safe, and all privacy captures stay clean.

```bash
git add apps/web/app/'(private)'/records apps/web/app/v1/private/documents apps/web/app/v1/private/records apps/web/components/records apps/web/tests apps/web/e2e/document-to-timeline.spec.ts
git commit -m "feat(web): add reviewed document-to-timeline journey"
```

### Task 6: Make consent, retention, export, and deletion first-class product flows

**Files:**
- Create: `apps/web/app/(private)/settings/privacy/page.tsx`
- Create: `apps/web/app/v1/private/consent-options/route.ts`
- Create: `apps/web/app/v1/private/consents/list/route.ts`
- Create: `apps/web/app/v1/private/consents/grant/route.ts`
- Create: `apps/web/app/v1/private/consents/revoke/route.ts`
- Create: `apps/web/app/v1/private/record-sources/route.ts`
- Create: `apps/web/app/v1/private/exports/create/route.ts`
- Create: `apps/web/app/v1/private/exports/status/route.ts`
- Create: `apps/web/app/v1/private/exports/download/route.ts`
- Create: `apps/web/lib/api/verified-export-spool.server.ts`
- Create: `apps/web/app/v1/private/profile/reset/route.ts`
- Create: `apps/web/components/privacy/ConsentReceipt.tsx`
- Create: `apps/web/components/privacy/RetentionChoice.tsx`
- Create: `apps/web/components/privacy/ExportPanel.tsx`
- Create: `apps/web/components/privacy/ResetHealthProfileDialog.tsx`
- Test: `apps/web/tests/privacy-controls.test.tsx`
- Test: `apps/web/tests/verified-export-spool.test.ts`
- Test: `apps/web/e2e/privacy-lifecycle.spec.ts`

**Interfaces:**
- Consumes only generated contracts: FND `getConsentOptions`, `listConsents`, `grantConsent`, `revokeConsent`, `ConsentOptionsView`, and `ConsentView`; REC `getRecordSources`, `createRecordExport`, `getRecordExport`, `downloadRecordExport`, and `resetProfile`; Task 4 action-specific step-up.
- Produces: explicit purpose-level consent grants/revocations; retention represented truthfully as the presence or absence of an active `RETAIN_VERIFIED_SOURCE` grant; generated export/reset requests and receipts; a bounded verify-before-release archive spool; a separate local-vault warning. It does not invent `ConsentReceiptView`, `RetentionPolicy`, a deletion-challenge API, or fields absent from the producer contracts.

- [ ] **Step 1: Write failing default and dark-pattern tests**

```tsx
it("defaults to immediate source deletion and gives both choices equal prominence", () => {
  render(<RetentionChoice activeRetentionConsent={null} onChange={vi.fn()} />);
  expect(screen.getByRole("radio", { name: /확인 후 즉시 삭제/ })).toBeChecked();
  const labels = screen.getAllByRole("radio").map((node) => node.parentElement?.className);
  expect(new Set(labels).size).toBe(1);
});

it("requires the Korean destructive phrase", async () => {
  render(<ResetHealthProfileDialog challenge="내 데이터 영구 삭제" onConfirm={onConfirm} />);
  await userEvent.type(screen.getByLabelText("확인 문구"), "삭제");
  expect(screen.getByRole("button", { name: "영구 삭제" })).toBeDisabled();
});
```

`verified-export-spool.test.ts` uses an injected monotonic clock, chunk source, filesystem adapter, and response-commit spy. It proves a valid `50,331,648`-byte fixture is not committed until its final byte, exact length, and SHA-256 are verified; early EOF, byte `50,331,649`, a same-length mutation, wrong or duplicate digest header, connect timeout, idle timeout, total timeout, spool exhaustion, write/fsync failure, and upstream abort all return a stable error with zero browser headers/body bytes. It also proves a client disconnect after commit closes the reader and deletes the spool without logging its path, ticket, or digest.

- [ ] **Step 2: Run and confirm components are absent**

Run: `pnpm --filter @gc/web test -- privacy-controls.test.tsx verified-export-spool.test.ts`

Expected: FAIL resolving privacy components and the verified export spool.

- [ ] **Step 3: Implement the exact retention copy and lifecycle states**

Load `getConsentOptions` server-side through the fixed-operation client, validate the generated `ConsentOptionsView` including its SHA-256 shape, and render its notice URL/version, processor-set version, recipients, region, and duration ceilings before any grant control. FND already verifies the release-pinned configuration digest at core startup; UX does not invent a second undeclared digest channel. Version rollback within one BFF session, extra field, or unavailable options disables grant submission with a fixed retry message. Render every generated `ConsentView` proof field exactly: purpose, sources, data categories, operations, recipients, processor-set/notice versions, KR region, granted/expiry/revoked times, and signature receipt. Fixed UI builders create only these reviewed requests:

- `BUILD_PERSONAL_LAB_TIMELINE`: `USER_UPLOAD`, selected `LAB_REPORT|MEDICAL_RECORD`, exact `{COLLECT,EXPLAIN}`;
- `PROCESS_UPLOADED_DOCUMENT_IN_KR_CLOUD`: same selected source/category, exact `{COLLECT,EXTRACT,NORMALIZE}`;
- `RETAIN_VERIFIED_SOURCE`: `USER_UPLOAD`, selected category, exact `{RETAIN}`, expiry at most 365 days.

Recipients, processor-set version, notice version, region, and duration bounds come only from that generated, release-digest-pinned response—never hidden form values, browser storage, or caller input. The BFF reconstructs the grant request from a server-side purpose enum plus selected category and the current options; it ignores/rejects browser-supplied operation/recipient/version fields. Cloud processing and retention remain unchecked until the user acts. Revocation calls the exact consent ID and clearly distinguishes “stop future/queued processing” from deletion already in progress.

The immediate-delete option must say: “추출 결과를 확인하면 원본 파일을 즉시 삭제합니다. 검증된 구조화 기록과 삭제 영수증은 남습니다.” It is represented by **no active retention consent**, not a server policy object. The encrypted-retention option states 365-day maximum, Korea-region encryption/access scope, revocation deletion, backup-tombstone behavior, and the ability to turn it off; selecting it grants `RETAIN_VERIFIED_SOURCE`, while turning it off revokes that exact grant and then refreshes `getRecordSources` until the generated disposition shows the result. Both choices use equal visual weight.

- [ ] **Step 4: Implement exact export and server-reset flows with step-up**

Export first invokes Task 4 step-up for `records:export`, then submits exactly `{idempotencyKey,includeRetainedSource}` to `createRecordExport`. The retained-source toggle is disabled unless an active retention grant and an available source both exist. Poll `getRecordExport`; when `ready`, POST the generated 43-character ticket to the fixed BFF download route, which calls `downloadRecordExport` once over FND's direct private core URL. Before reading a body, the BFF requires REC's numeric `Content-Length` from `1` through `50,331,648`, exactly one case-insensitive `X-GC-Archive-SHA256` header matching `^sha256:[0-9a-f]{64}$` and the ready status, and exact `application/zip`; absent, duplicate, comma-folded, mixed-case-duplicate, malformed, or mismatched headers fail closed.

The route then acquires one of exactly two per-task spool permits and writes the upstream body to a single opaque, random-name file under `/var/lib/gc-export-spool` on Task 10's Fargate-ephemeral-storage-CMK-encrypted volume. `verified-export-spool.server.ts` opens with `O_CREAT|O_EXCL|O_NOFOLLOW`, mode `0600`, never follows or logs a path, never uses `mmap`, and checks `bytesWritten + chunk.length <= Content-Length <= 50,331,648` **before** each write. It hashes while writing, uses a two-second connect deadline, five-second monotonic idle deadline reset only by a nonempty body chunk, and 120-second monotonic total deadline from request dispatch through final `fsync`; timeout or abort cancels the upstream reader. After EOF it requires exact byte equality, exact lowercase digest equality with both REC header and ready status, and successful `fsync`, then closes the write handle. Only this fully verified state may commit browser headers and stream the read-only spool with backpressure. The response preserves the exact `Content-Length` and `X-GC-Archive-SHA256`, adds `Content-Disposition: attachment`, `Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`, and emits no object-store path, subject, or analytics. A same-length mutation therefore fails before browser headers rather than becoming an unverifiable pass-through.

Every exit closes handles and best-effort unlinks the spool; startup and a five-minute loop delete only regular files owned by the service UID in that one directory that are older than ten minutes and are not in the in-process active set. A task restart discards its encrypted ephemeral volume; the plan makes no physical-zeroization claim. Free space below `201,326,592` bytes, two active spools, unexpected directory ownership/mode, a symlink/non-regular entry, or janitor uncertainty makes readiness fail or returns retryable `503 export_spool_busy` before ticket redemption. An early/extra/mutated body, timeout, disconnect before commit, I/O error, or digest mismatch returns a redacted error with no browser body/header commit; disconnect after commit stops the read and deletes the spool. A 413 `export_too_large` is rendered before polling; an asynchronous `export_failed` never exposes partial bytes. Display only the archive/manifest digests and attestation `kid` exposed by the generated status; never invent them. The browser does not parse or retain the archive, and the 48 MiB path never traverses API Gateway.

Server profile reset invokes a separate `profile:reset` step-up, requires the literal Korean phrase `내 데이터 영구 삭제`, and submits exactly `{idempotencyKey,confirmationPhrase}` to `resetProfile`. After an accepted `ResetPersonalRecordProfileResponse`, delete the BFF session and render only its deletion request ID/status. Copy must say: “이 작업은 한국 서버의 프로필을 삭제합니다. 오프라인 모바일 보관함은 연결되지 않으므로 이 기기에서 별도로 삭제해야 합니다.” Do not claim that another offline device was remotely erased.

- [ ] **Step 5: Prove revoke/export/reset behavior through generated mocked contracts**

Playwright flow: list → grant cloud purpose → generated receipt → revoke → queued-work banner → grant/revoke retention → source disposition → export step-up/create/status/verify-before-release download → distinct reset step-up → exact phrase → accepted reset → session invalid. It tests scope confusion (`profile:reset` cannot export and vice versa), stale 301-second auth, CSRF/origin failures, idempotent replay, optional-source exclusion by default, zero response commit on every preverification failure, and cleanup on a post-commit browser disconnect.

Run: `pnpm --filter @gc/web test && pnpm --filter @gc/web exec playwright test e2e/privacy-lifecycle.spec.ts`

Expected: tests PASS, generated types are the sole DTO authority, screenshots show no optional consent preselected, preverification failures expose no archive byte, and server/local deletion claims remain distinct.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/'(private)'/settings apps/web/app/v1/private/consents apps/web/app/v1/private/consent-options apps/web/app/v1/private/record-sources apps/web/app/v1/private/exports apps/web/app/v1/private/profile apps/web/lib/api/verified-export-spool.server.ts apps/web/components/privacy apps/web/tests apps/web/e2e/privacy-lifecycle.spec.ts
git commit -m "feat(web): add transparent privacy lifecycle controls"
```

### Task 7: Create the encrypted offline Flutter vault and verified export importer

**Files:**
- Generate then review: `apps/mobile/.metadata`
- Create: `apps/mobile/pubspec.yaml`
- Generate: `apps/mobile/pubspec.lock`
- Generate then review: `apps/mobile/analysis_options.yaml`
- Generate then review: `apps/mobile/lib/main.dart`
- Generate then review: `apps/mobile/android/settings.gradle.kts`
- Generate then review: `apps/mobile/android/build.gradle.kts`
- Generate then review: `apps/mobile/android/app/build.gradle.kts`
- Create: `apps/mobile/android/app/src/main/AndroidManifest.xml`
- Generate then review: `apps/mobile/android/app/src/main/kotlin/kr/co/genomecompanion/mobile/MainActivity.kt`
- Create: `apps/mobile/android/app/src/main/res/xml/data_extraction_rules.xml`
- Generate then review: `apps/mobile/ios/Runner.xcodeproj/project.pbxproj`
- Generate then review: `apps/mobile/ios/Runner/Info.plist`
- Create: `apps/mobile/ios/Runner/Runner.entitlements`
- Create: `apps/mobile/ios/Runner/VaultFilePolicy.swift`
- Create: `apps/mobile/lib/app.dart`
- Create: `scripts/design/sync_mobile_tokens.ts`
- Generate: `apps/mobile/lib/design/tokens.g.dart`
- Create: `scripts/contracts/generate_verified_timeline_dart.ts`
- Generate: `apps/mobile/lib/api/generated/personal_record_contracts.g.dart`
- Generate: `apps/mobile/assets/trust/record-export-attestation-keys.json`
- Create: `packages/record-export-verifier/pubspec.yaml`
- Generate then review: `packages/record-export-verifier/lib/record_export_verifier.dart`
- Generate then review: `packages/record-export-verifier/android/build.gradle`
- Generate then review: `packages/record-export-verifier/android/src/main/kotlin/kr/co/genomecompanion/record_export_verifier/RecordExportVerifierPlugin.kt`
- Create: `packages/record-export-verifier/ios/record_export_verifier.podspec`
- Generate then review: `packages/record-export-verifier/ios/Classes/RecordExportVerifierPlugin.swift`
- Test: `packages/record-export-verifier/test/record_export_verifier_test.dart`
- Test: `apps/mobile/integration_test/record_export_verifier_test.dart`
- Create: `apps/mobile/lib/vault/key_store.dart`
- Create: `apps/mobile/lib/vault/secure_storage_adapter.dart`
- Create: `apps/mobile/lib/vault/vault_coordinator.dart`
- Create: `apps/mobile/lib/vault/database.dart`
- Create: `apps/mobile/lib/vault/migrations.dart`
- Generate: `apps/mobile/drift_schemas/schema_v1.json`
- Create: `apps/mobile/lib/vault/export_importer.dart`
- Create: `apps/mobile/lib/vault/archive_attestation.dart`
- Create: `apps/mobile/lib/features/records/record_timeline_screen.dart`
- Create: `apps/mobile/lib/features/privacy/privacy_screen.dart`
- Test: `apps/mobile/test/api/contract_generation_test.dart`
- Test: `apps/mobile/test/vault/key_store_test.dart`
- Test: `apps/mobile/test/vault/vault_coordinator_test.dart`
- Test: `apps/mobile/test/vault/database_test.dart`
- Test: `apps/mobile/test/vault/migrations_test.dart`
- Test: `apps/mobile/test/vault/export_importer_test.dart`
- Test: `apps/mobile/test/vault/platform_backup_policy_test.dart`
- Test: `apps/mobile/test/features/record_timeline_screen_test.dart`

**Interfaces:**
- Consumes: Task 1's exact generated Dart tokens; REC OpenAPI `VerifiedTimeline`/`VerifiedRecord`; REC `record-export-attestation.schema.json`, `record-export-key-registry.schema.json`, release key registry and exact attested archive entry set; Android platform `SHA256withECDSA`/P-256 verification and Apple CryptoKit P-256 verification through a narrow audited plugin; device-keystore `VaultKeyStore.getOrCreateKey() -> Future<Uint8List>`.
- Produces: deterministic generated Dart parser; bounded signed-archive importer; `RecordExportVerifier.verify(...)` with the same real P-256 golden vectors on Android/iOS; SQLCipher `GenomeCompanionVault`; device-bound 256-bit key; lossless decimal-text records; routes `/records`, `/import`, and `/privacy`; Android/iOS backup exclusion and file protection; no webview, HTTP client, local HTTP bridge, push, remote sync, or remote-wipe claim.

- [ ] **Step 1: Generate the pinned native app scaffold, then write failing key stability and plaintext-leak tests**

Run `flutter create --platforms=android,ios --org kr.co.genomecompanion --project-name mobile apps/mobile` with Flutter 3.44.7/Dart 3.12, then review and commit the complete generated host rather than hand-creating a partial app. Immediately pin Android namespace/application ID and iOS bundle identifier to `kr.co.genomecompanion.mobile`, replace the template app with `lib/main.dart -> runApp(const GenomeCompanionApp())`, and add a scaffold-drift test that asserts the Flutter version, package IDs, Gradle/Xcode host files, deployment targets, release signing placeholders, and absence of template counter code. Scaffolding is setup; the vault tests below remain RED.

```dart
test('creates one 256-bit key and reuses it', () async {
  final storage = MemorySecureStorage();
  final store = VaultKeyStore(storage);
  final first = await store.getOrCreateKey();
  final second = await store.getOrCreateKey();
  expect(first.length, 32);
  expect(second, first);
  expect(storage.writeCount, 1);
});

test('concurrent first opens converge on one key and one write', () async {
  final storage = DelayingMemorySecureStorage();
  final store = VaultKeyStore(storage);
  final keys = await Future.wait(List.generate(32, (_) => store.getOrCreateKey()));
  expect(keys.toSet().length, 1);
  expect(storage.writeCount, 1);
});

test('database bytes do not contain a synthetic record value', () async {
  final file = await createEncryptedFixture('SYNTHETIC-HBA1C-6.1');
  expect(await file.readAsString(encoding: latin1), isNot(contains('SYNTHETIC-HBA1C-6.1')));
});

test('wrong vault key cannot read the schema', () async {
  final fixture = await createEncryptedFixture('SYNTHETIC-HBA1C-6.1');
  await expectLater(readSchemaWithKey(fixture, Uint8List(32)), throwsA(isA<SqliteException>()));
});

test('a malformed stored key fails closed instead of replacing it', () async {
  final storage = MemorySecureStorage(initial: {'gc_vault_key_v1': 'AA'});
  await expectLater(VaultKeyStore(storage).getOrCreateKey(), throwsA(isA<VaultKeyCorrupt>()));
  expect(storage.writeCount, 0);
});

test('Android platform backup is disabled for the vault', () async {
  final manifest = await File('android/app/src/main/AndroidManifest.xml').readAsString();
  expect(manifest, contains('android:allowBackup="false"'));
  expect(manifest, isNot(contains('android.permission.INTERNET')));
});

test('iOS protects and excludes every SQLite sidecar and import temp file', () async {
  expect(await readEntitlements(), contains('NSFileProtectionComplete'));
  expect(await protectedSuffixes(), containsAll(['.sqlite', '.sqlite-wal', '.sqlite-shm', '.gc-export', '.import.tmp']));
});
```

Archive negatives cover duplicate names, path traversal, absolute paths, symlinks, unknown/missing entries, any non-STORED compression method, over-limit headers/entries/archive bytes, invalid UTF-8, duplicate JSON keys, non-canonical decimals, digest mismatch, unknown/current-window-invalid/retired-outside-window/revoked `kid`, bad/high-S JWS, and valid-signature/wrong-manifest bytes. No archive content is parsed into records until the attestation and all entry digests pass.

Scaffold `packages/record-export-verifier` with Flutter 3.44.7 using `flutter create --template=plugin --platforms=android,ios --org kr.co.genomecompanion`. The plugin has one binary interface: `verify({required Uint8List publicKeyX963, required Uint8List signingInput, required Uint8List rawLowSSignature}) -> Future<bool>`. Dart rejects anything except a 65-byte uncompressed `0x04||x||y` P-256 key, bounded signing input, and 64-byte raw `r||s`; it checks `1<=r<n`, `1<=s<=n/2` before crossing the channel. Android reconstructs secp256r1 with `AlgorithmParameters`/`ECPublicKeySpec`, converts the already bounded raw signature to minimal DER, and calls the platform `Signature.getInstance("SHA256withECDSA")`; iOS uses CryptoKit `P256.Signing.PublicKey(x963Representation:)` and `ECDSASignature(rawRepresentation:)`. The package has no third-party native crypto, storage, URL, HTTP, or telemetry dependency.

Unit plus real Android/iOS integration tests use REC's fixed ES256 golden archive vector and one-byte input/key/signature mutations, `r=0`, `s=0`, `r>=n`, high-S, malformed key, DER edge values, and repeated/concurrent calls. The test must execute the real native plugin on the pinned Android emulator and iOS simulator through a non-distributable test build; a mock method channel or Dart-only pass does not satisfy the gate. Because the approved distribution candidates are intentionally unsigned/no-codesign and therefore are not executable on those CI devices, the release gate does **not** claim to execute those archive bytes. Instead, the native test record carries the clean source SHA, sorted three-component native-source digest, native dependency-lock digest, toolchain tuple, and runtime-reported embedded build digest; the separate release-artifact audit extracts the same embedded build digest and aggregate record-export/local-OCR/SQLCipher ABI-symbol allowlist from the exact AAB and generic-device archive and byte-matches every bound value before binding that test record into release provenance. A release artifact built from different native component source, lock, toolchain, ABI/symbol set, or embedded digest fails. Unsupported provider/OS behavior fails import with a closed error—it never downgrades to an unverified row.

- [ ] **Step 2: Run and confirm missing vault types**

Run: `cd apps/mobile && flutter test test/vault`

Expected: compilation FAIL for missing generated parser, importer, `VaultKeyStore`, and database.

- [ ] **Step 3: Implement the keystore port and 32-byte key lifecycle**

```dart
// apps/mobile/lib/vault/key_store.dart
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

abstract interface class SecureStoragePort {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

bool constantTimeEquals(List<int> left, List<int> right) {
  if (left.length != right.length) return false;
  var difference = 0;
  for (var index = 0; index < left.length; index++) {
    difference |= left[index] ^ right[index];
  }
  return difference == 0;
}

final class VaultKeyStore {
  VaultKeyStore(this.storage);
  final SecureStoragePort storage;
  static const _name = 'gc_vault_key_v1';
  Future<Uint8List>? _singleFlight;
  Future<void>? _destruction;
  var _destroyed = false;
  var _epoch = 0;

  Future<Uint8List> getOrCreateKey() {
    if (_destroyed || _destruction != null) throw const VaultKeyStoreDestroyed();
    final epoch = _epoch;
    return _singleFlight ??= _loadOrCreate(epoch);
  }

  Uint8List _returnIfLive(Uint8List candidate, int epoch) {
    if (_destroyed || _destruction != null || epoch != _epoch) {
      candidate.fillRange(0, candidate.length, 0);
      throw const VaultKeyStoreDestroyed();
    }
    return candidate;
  }

  Future<Uint8List> _loadOrCreate(int epoch) async {
    final stored = await storage.read(_name);
    if (_destroyed || epoch != _epoch) throw const VaultKeyStoreDestroyed();
    if (stored != null) {
      try {
        final decoded = base64Url.decode(stored);
        if (decoded.length != 32) throw const FormatException('wrong key length');
        return _returnIfLive(Uint8List.fromList(decoded), epoch);
      } on FormatException {
        throw const VaultKeyCorrupt();
      }
    }
    final random = Random.secure();
    final key = Uint8List.fromList(List.generate(32, (_) => random.nextInt(256)));
    await storage.write(_name, base64UrlEncode(key));
    _returnIfLive(key, epoch);
    final confirmed = await storage.read(_name);
    _returnIfLive(key, epoch);
    final confirmedBytes = confirmed == null ? null : base64Url.decode(confirmed);
    if (confirmedBytes == null || !constantTimeEquals(confirmedBytes, key)) {
      key.fillRange(0, key.length, 0);
      throw const VaultKeyWriteFailed();
    }
    confirmedBytes.fillRange(0, confirmedBytes.length, 0);
    return _returnIfLive(key, epoch);
  }

  Future<void> destroyKey() => _destruction ??= _destroy();

  Future<void> _destroy() async {
    _destroyed = true;
    _epoch += 1;
    try { await _singleFlight; } catch (_) { /* deletion still wins */ }
    await storage.delete(_name);
    _singleFlight = null;
  }
}

final class VaultKeyCorrupt implements Exception {
  const VaultKeyCorrupt();
}

final class VaultKeyWriteFailed implements Exception {
  const VaultKeyWriteFailed();
}

final class VaultKeyStoreDestroyed implements Exception {
  const VaultKeyStoreDestroyed();
}
```

```dart
// apps/mobile/lib/vault/secure_storage_adapter.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'key_store.dart';

final class FlutterSecureStorageAdapter implements SecureStoragePort {
  const FlutterSecureStorageAdapter(this.storage);
  final FlutterSecureStorage storage;
  @override Future<String?> read(String key) => storage.read(key: key);
  @override Future<void> write(String key, String value) => storage.write(key: key, value: value);
  @override Future<void> delete(String key) => storage.delete(key: key);
}

const deviceSecureStorage = FlutterSecureStorage(
  aOptions: AndroidOptions(
    storageNamespace: 'gc_record_vault',
    resetOnError: false,
    migrateOnAlgorithmChange: true,
    migrateWithBackup: false,
  ),
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.unlocked_this_device,
    synchronizable: false,
  ),
);
```

`resetOnError: false` is deliberate: an unwrap or corruption error presents a recovery choice and never silently creates a replacement key that strands ciphertext. Construct exactly one `VaultKeyStore` in the Riverpod root; its single-flight future plus read-after-write verification resolves concurrent first opens. Every awaited read, write, and readback is followed by the epoch/destroy check before key return; a losing candidate is best-effort cleared and throws. Destruction synchronously advances the epoch and marks that instance unusable before awaiting any in-flight creation, then deletes the result, so destroy-vs-open cannot resurrect a key; reopening requires a newly constructed store after the old database is closed. `VaultCoordinator` is the sole database-opening/reset port: `beginReset()` synchronously closes its admission gate, bumps a vault epoch, waits for any already-admitted open to either finish or fail its post-key epoch check, closes/awaits the SQLCipher database and WAL/SHM cleanup, calls `destroyKey`, and leaves the old coordinator permanently closed. `open()` checks the coordinator epoch before key acquisition, after key acquisition, and after SQLCipher verification; if reset began, it clears its key copy, closes the executor, and throws without publishing a database handle. Tests pause each secure-storage read/write/readback and database-open phase, start reset, release the pause, and prove no caller receives a key and no SQL statement/database handle opens after reset admission closes. The Android defaults are RSA-OAEP key wrapping plus AES-GCM storage encryption; the namespace isolates both preferences and KeyStore aliases. `unlocked_this_device` keeps the iOS key device-bound and available only while unlocked, with iCloud Keychain synchronization disabled.

- [ ] **Step 4: Open Drift only after SQLCipher keying and cipher verification**

```dart
// apps/mobile/lib/vault/database.dart
import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
part 'database.g.dart';

class VerifiedRecords extends Table {
  TextColumn get factId => text()();
  TextColumn get code => text().withLength(min: 1, max: 64)();
  TextColumn get displayKo => text().withLength(min: 1, max: 120)();
  TextColumn get valueDecimal => text().withLength(min: 1, max: 96)();
  TextColumn get unit => text().withLength(min: 1, max: 32)();
  TextColumn get effectiveAt => text().withLength(min: 20, max: 40)();
  TextColumn get sourceRef => text()();
  TextColumn get confidenceDecimal => text().withLength(min: 1, max: 32)();
  BoolColumn get sourceAvailable => boolean()();
  TextColumn get verificationStatus => text().customConstraint("NOT NULL CHECK (verification_status = 'server_user_verified')")();
  TextColumn get provenanceKind => text().customConstraint("NOT NULL CHECK (provenance_kind = 'signed_rec_export')")();
  TextColumn get provenanceDigest => text().withLength(min: 71, max: 71)();
  TextColumn get exportId => text().withLength(min: 36, max: 36)();
  DateTimeColumn get importedAt => dateTime()();
  @override Set<Column<Object>> get primaryKey => {factId};
}

@DriftDatabase(tables: [VerifiedRecords])
class GenomeCompanionVault extends _$GenomeCompanionVault {
  GenomeCompanionVault(super.executor);
  @override int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) => m.createAll(),
    onUpgrade: (m, from, to) async {
      await transaction(() => runContiguousMigrations(m, from, to));
    },
    beforeOpen: (_) async {
      final result = await customSelect('PRAGMA integrity_check').getSingle();
      if (result.data.values.single != 'ok') throw StateError('vault_integrity_failed');
    },
  );
}

QueryExecutor openEncryptedVault(File file, List<int> key) {
  final hex = key.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  return NativeDatabase.createInBackground(file, setup: (db) {
    db.execute('PRAGMA key = "x\'$hex\'"');
    final version = db.select('PRAGMA cipher_version');
    if (version.isEmpty || (version.first.values.first as String?)?.isEmpty != false) {
      throw StateError('sqlcipher_unavailable');
    }
    db.select('SELECT count(*) FROM sqlite_master');
    db.execute('PRAGMA foreign_keys = ON');
    db.execute('PRAGMA secure_delete = ON');
  });
}
```

The generated REC mobile contract uses canonical decimal **strings** for `value` and `confidence`; it rejects exponent notation, leading plus/zero, negative zero, non-finite values, whitespace, and out-of-range confidence before database access. `valueDecimal` and `confidenceDecimal` are never converted to IEEE-754 `double`. `effectiveAt` must be an offset-aware RFC 3339 string and is normalized once to UTC text.

Export Drift schema snapshots for every release. Each version has a forward-only, contiguous migration test from every prior snapshot, with fixed fixture digests before/after. A migration failure rolls back the transaction and leaves the old ciphertext readable by the previous app binary; downgrades never mutate a newer schema. Destructive table recreation is forbidden without a separately approved data-preserving migration and recovery test.

Pin the mobile package and select the actual SQLCipher build supplied by `sqlite3` v3; do not add the inert `sqlcipher_flutter_libs` compatibility package:

```yaml
# apps/mobile/pubspec.yaml
name: genome_companion_mobile
description: Offline Genome Companion Korea record vault
publish_to: none
version: 0.1.0+1
environment:
  sdk: ">=3.12.0 <4.0.0"
  flutter: "3.44.7"
dependencies:
  flutter:
    sdk: flutter
  flutter_riverpod: 3.4.2
  go_router: 17.4.0
  drift: 2.34.3
  sqlite3: 3.5.1
  flutter_secure_storage: 11.0.0
  path_provider: 2.1.6
  file_picker: 11.0.2
  archive: 4.0.9
  crypto: 3.0.7
  record_export_verifier:
    path: ../../packages/record-export-verifier
dev_dependencies:
  flutter_test:
    sdk: flutter
  integration_test:
    sdk: flutter
  drift_dev: 2.34.5
  build_runner: 2.16.0
flutter:
  uses-material-design: true
  assets:
    - assets/trust/record-export-attestation-keys.json
hooks:
  user_defines:
    sqlite3:
      source: sqlcipher
```

`scripts/design/sync_mobile_tokens.ts` reads `packages/design-tokens/dist/tokens.dart`, verifies the Task 1 source SHA-256 stored beside the token build, writes `apps/mobile/lib/design/tokens.g.dart` byte-for-byte with a generated-source header, and supports `--check` by regenerating to a temporary file. It never maintains a second token value set. The contract generator similarly copies the reviewed REC key registry into `apps/mobile/assets/trust/` and emits its non-self-referential registry digest as a Dart constant; app startup rejects asset/constant drift.

Create the Android manifest with `android:allowBackup="false"`, `android:fullBackupContent="false"`, the deny-all data-extraction rule, and no `android.permission.INTERNET`; never opt vault, key preferences, imports, or exports into cloud/device-transfer backup. On iOS set default data protection to `NSFileProtectionComplete`, set the exclusion resource value on the database, WAL, SHM, temporary import, and temporary export files, and reapply both attributes whenever a sidecar is created. Run `dart run build_runner build --delete-conflicting-outputs`. CI inspects `PRAGMA cipher_version`, proves a wrong key cannot read `sqlite_master`, scans closed fixture bytes, rejects a malformed key without rewrite, and inspects merged Android/iOS release artifacts.

This first schema stores signed REC archive rows only as `server_user_verified`/`signed_rec_export`; Task 8 adds local rows in a separate table and migration, so a server snapshot replacement can never collide with or delete a local identifier. Local reset closes every connection, deletes the device-bound key first, deletes database/WAL/SHM/temp files, and verifies absence; it never attempts wear-unsafe flash overwrites. The user's original file selected from Downloads remains outside the app sandbox and is never claimed as deleted. Race tests cover get/get, get/destroy, destroy/get, repeated destroy, failed write/destroy, and confirm no destroyed store can return cached key material.

- [ ] **Step 5: Generate the REC parser and implement fail-closed archive import**

`generate_verified_timeline_dart.ts` loads REC OpenAPI, asserts the exact `VerifiedTimeline` and `VerifiedRecord` required/additional-properties/format/enum constraints, and emits a duplicate-key-rejecting UTF-8 parser with canonical decimal-string checks. The generator embeds the source schema SHA-256; CI regenerates into a temporary file and byte-compares it. No manually maintained mobile REC DTO is allowed.

REC Task 8 owns the only export-attestation producer and schema. The ZIP has exactly six required flat regular files: `manifest.json`, `manifest-attestation.jws`, `fhir-r4-bundle.json`, `timeline.json`, `consents.json`, and `source-dispositions.json`. It may have exactly one seventh `retained-source.bin` only when the signed manifest and disposition JSON both declare its byte length/digest/media type; no other entry is legal. The compact JWS protected header is exactly `{alg:"ES256",kid,typ:"GC-RECORD-EXPORT-ATTESTATION+JWS"}`; its additional-properties-false payload is exactly `{schemaVersion:"record-export-attestation.v1",exportId:<UUID>,manifestSha256:"sha256:<64 lowercase hex>",issuedAt:<aware UTC RFC3339>,expiresAt:<aware UTC RFC3339>,keyId:<same kid>}` with a 900-second interval. It signs the RFC 7515 `base64url(protected).base64url(RFC8785(payload))` input using FND's KMS P-256 key; the JWS signature segment is exactly 64-byte raw `r||s`. The importer enforces P-256 ranges and low-S in Dart, then requires the real Android/iOS `RecordExportVerifier` result over the exact ASCII compact-JWS signing input; there is no pure-Dart or unsupported-platform fallback.

The app consumes REC's exact `record-export-attestation.schema.json` and generated `record-export-attestation-keys.json`. It recomputes the registry digest as SHA-256 of canonical `{schemaVersion,registryVersion,generatedAt,entries}` excluding the digest field, compares the generated constant, and rejects rollback/equivocation. Exactly one `current` key is valid; `retired` verifies only when `issuedAt` is within `notBefore..notAfter`; `revoked` always fails. `expiresAt` describes server ticket/archive availability and must equal `issuedAt+900s`; an already downloaded authentic archive remains importable after that time. Root/key changes require a reviewed, code-signed app release; an archive-supplied key never extends trust.

`ExportImporter` rejects the picker file before reading if its length exceeds `50,331,648` bytes and keeps the same counting cap while streaming. It accepts only STORED entries and applies REC's exact caps: FHIR 16 MiB, timeline 8 MiB, consents 2 MiB, dispositions 1 MiB, optional retained source 20 MiB, manifest 64 KiB, and JWS 4 KiB. Before extracting content it rejects encrypted/multi-disk ZIPs, duplicates, directories, symlinks, absolute/backslash/`..` paths, unknown/missing names, compression, data descriptors that defeat limits, malformed central/local header disagreement, and trailing polyglot bytes. It strict-parses the bounded JWS, verifies protected header/payload/schema/key window/low-S ES256 signature, reads the raw canonical manifest, matches its SHA-256 to the signed payload, validates that the manifest lists exactly the four required payload entries plus the optional retained source with byte length and digest, and only then verifies each payload before parsing `timeline.json`. Only after the entire graph verifies does one SQLCipher transaction replace prior `rec_export` rows with the new authoritative snapshot while leaving `local_document` rows untouched and recording `exportId` plus the exact 71-character `sha256:<64 lowercase hex>` `manifestSha256` in `provenanceDigest` for idempotency. Parser, migration-snapshot, and database round-trip tests reject a raw 64-hex value, another prefix, uppercase hex, or truncation.

The app persists none of `fhir-r4-bundle.json`, `consents.json`, `source-dispositions.json`, optional `retained-source.bin`, the attestation, or manifest. It closes and deletes its protected sandbox copy in `finally`; it truthfully tells the user that the original picker file remains in Downloads/Files. Any failure writes no row and returns a closed Korean error code with no record content.

- [ ] **Step 6: Render the tokenized mobile timeline and privacy routes**

Use Riverpod providers for the vault and go_router routes. Imported rows say `서버 내보내기 · 사용자 확인 완료`; local rows say `이 기기에서 직접 확인` and never `server_user_verified`. The screen exposes source reference/availability, provenance digest prefix, verification label, imported time, unit-preserving value, and a fixed non-diagnosis caveat. It does not claim server freshness or retained-source status that the archive contract does not carry. Widget tests at text scale 2.0 find all buttons and no overflow exception.

- [ ] **Step 7: Run Flutter tests and commit**

Run: `pnpm exec tsx scripts/design/sync_mobile_tokens.ts --check && pnpm exec tsx scripts/contracts/generate_verified_timeline_dart.ts --check && cd apps/mobile && flutter pub get --enforce-lockfile && flutter test`

Expected: generated contract drift is zero; signature/ZIP adversarial corpus, vault races, corruption fail-closed, cryptographic erasure, Android/iOS release backup policy, encrypted-file scan, every historical Drift migration, widget semantics, and 200% text tests PASS.

```bash
git add scripts/design/sync_mobile_tokens.ts scripts/contracts/generate_verified_timeline_dart.ts apps/mobile packages/record-export-verifier
git commit -m "feat(mobile): add encrypted offline record vault"
```

### Task 8: Add the conditional zero-cloud document path

**Files:**
- Modify: `apps/mobile/pubspec.yaml`
- Modify: `apps/mobile/pubspec.lock`
- Create: `packages/local-ocr-native/pubspec.yaml`
- Generate then review: `packages/local-ocr-native/lib/local_ocr_native.dart`
- Generate then review: `packages/local-ocr-native/lib/src/local_ocr_native_bindings.g.dart`
- Generate then review: `packages/local-ocr-native/hook/build.dart`
- Generate then review: `packages/local-ocr-native/android/build.gradle`
- Create: `packages/local-ocr-native/android/CMakeLists.txt`
- Generate then review: `packages/local-ocr-native/android/src/main/kotlin/kr/co/genomecompanion/local_ocr_native/LocalOcrNativePlugin.kt`
- Create: `packages/local-ocr-native/ios/local_ocr_native.podspec`
- Generate then review: `packages/local-ocr-native/ios/Classes/LocalOcrNativePlugin.swift`
- Create: `packages/local-ocr-native/src/`
- Create: `packages/local-ocr-native/test/local_ocr_native_test.dart`
- Create: `packages/local-ocr-native/src/tests/local_ocr_native_test.cc`
- Create: `packages/local-ocr-native/tool/build_vendor_assets.dart`
- Create: `packages/local-ocr-native/vendor-manifest.json`
- Create: `packages/local-ocr-native/THIRD_PARTY_NOTICES.md`
- Create: `apps/mobile/assets/ocr/kor.traineddata`
- Create: `apps/mobile/assets/ocr/eng.traineddata`
- Create: `apps/mobile/assets/local-template-manifest.json`
- Modify: `apps/mobile/lib/vault/database.dart`
- Modify: `apps/mobile/lib/vault/migrations.dart`
- Generate: `apps/mobile/drift_schemas/schema_v2.json`
- Create: `apps/mobile/lib/features/local_intake/local_document_extractor.dart`
- Create: `apps/mobile/lib/features/local_intake/local_candidate_review.dart`
- Create: `apps/mobile/lib/features/local_intake/local_intake_screen.dart`
- Create: `apps/mobile/test/features/local_intake/local_document_extractor_test.dart`
- Create: `apps/mobile/test/features/local_intake/local_candidate_review_test.dart`
- Create: `apps/mobile/test/vault/local_record_migration_test.dart`
- Create: `apps/mobile/integration_test/no_network_local_intake_test.dart`
- Create: `scripts/mobile/benchmark_local_ocr.py`
- Create: `scripts/mobile/local-ocr-benchmark.schema.json`
- Create: `scripts/mobile/test_benchmark_local_ocr.py`
- Create: `scripts/mobile/audit_mobile_native_assets.py`

**Interfaces:**
- Consumes: local PNG/JPEG selected by the user; checksummed Tesseract 5.5.2/Leptonica 1.85.0 static builds; `tessdata_best` commit `e12c65a915945e4c28e237a9b52bc4a8f39a0cec` with Korean SHA-256 `f888d4038348a0c3d25151e7f452bda0d74ca275b18cab146798bcbb94084fff` and English SHA-256 `8280aed0782fe27257a68ea10fe7ef324ca0f8d85bd2fd145d1c2b560bcb66ba`; a release-reviewed supported-template manifest. PDF local intake is manual-only in MVP; PDF cloud intake remains available through Task 5 after consent.
- Produces: bounded on-device OCR/manual candidates, explicit per-field review, and only `locally_user_confirmed` SQLCipher rows. It has no cloud consent, server API, network permission, SDK analytics, automatic upload, or path that labels local output `server_user_verified`.

- [ ] **Step 1: Write failing offline, provenance, abstention, and full-review tests**

Prove image bytes, filename, OCR text, candidates, and confirmed values never leave the process or enter logs. All fixtures use synthetic reports. Tests require: byte/type/pixel/time limits; exact model/library SHA verification; unsupported layout abstention; no silent normalization; one confirm/reject decision per candidate; manual entry available when OCR is disabled or the source is PDF; the app's sandbox copy/cache are not retained; typed `ocr_review|manual_entry` provenance; manual rows have no invented standard code or confidence; local IDs cannot collide with server `factId`; v1→v2 migration preserves every signed row; and no route to the remote explanation worker.

The integration test boots with all network denied and completes image → OCR → review → local timeline. A static audit rejects Dart `dart:io` networking/HTTP packages, Android `INTERNET`, iOS networking frameworks in app/native plugin symbols, model download code, dynamic library download, URL literals outside legal notices, and Firebase/analytics/crash SDKs. Treat this as a release control, not a mathematical claim about the host OS.

- [ ] **Step 2: Scaffold the linkable FFI plugin, confirm RED, and freeze the native supply chain**

Run Flutter 3.44.7's `flutter create --template=plugin_ffi --platforms=android,ios --org kr.co.genomecompanion packages/local-ocr-native`, then replace its sample symbol with the narrow Dart API `extractRaster({required String sandboxPath, required String languageSet, required Duration deadline}) -> Future<NativeOcrResult>`. Keep the generated Android Gradle/CMake integration, iOS podspec/plugin registration, native-assets `hook/build.dart`, and generated FFI bindings; pin every generated host/tool version. A Dart integration test loads the actual release library on Android and iOS and calls a harmless `engineVersion()` symbol, while CTest/native tests exercise buffer-length, cancellation, timeout, and ownership semantics. Orphan source/CMake files that are not present in the final unsigned AAB and no-codesign Runner.app/archive fail the asset audit.

Run: `cd packages/local-ocr-native && flutter test && cd ../../apps/mobile && flutter test test/features/local_intake && cd ../.. && python scripts/mobile/audit_mobile_native_assets.py --app apps/mobile`

Expected: missing plugin/extractor/audit fails.

`vendor-manifest.json` pins immutable source archive URLs, tag/commit, SHA-256, license, build flags, minimum OS/ABI, compiler image digest, and resulting library/model SHA-256 for Tesseract, Leptonica, `kor.traineddata`, and `eng.traineddata`. CI builds from source with networking disabled after verified fetch, compares output manifests, runs license/SBOM scans, and ships the model inside the app—startup never downloads or updates it.

`local-ocr-benchmark.schema.json` freezes `schemaVersion="local-ocr-benchmark.v1"`, candidate/baseline build digests, device model, OS/build, ABI, model/native-library digests, warmup/sample counts, AAB/archive byte sizes, interactive-frame milliseconds, 20 MiB/25-megapixel processing milliseconds, peak RSS bytes, per-sample results, and pass/failure codes. Build the baseline at the same commit with the local OCR feature/assets disabled; candidate size delta must be `<=60 MiB` Android AAB and `<=50 MiB` iOS Runner.app/archive. On pinned API-35 x86_64/iPhone-16 iOS-18.5 CI devices, perform two warmups then ten cold starts: p95 candidate first-interactive-frame must be `<=3,000 ms` and its p95 regression versus baseline `<=500 ms`. Perform one warmup then five maximum-raster runs: every run and p95 must be `<=60,000 ms`, peak RSS `<=536,870,912` bytes, and there must be zero crash/timeout/incorrect-template admission.

Before a mobile release-signing plan can approve distribution, repeat the same protocol on named lab tiers `Pixel 7 / Android 15 / 8 GB` and `iPhone 14 / iOS 18.5 / 6 GB`, with the same thresholds and a reviewer-attested device inventory. `benchmark_local_ocr.py` strict-validates the versioned JSON, recomputes all percentiles/deltas from samples, exits nonzero for missing device evidence or any threshold failure, and never prints OCR text or report values. Emulator results gate CI reproducibility; real-device results gate distribution readiness.

Add the local path dependency and immutable assets explicitly:

```yaml
dependencies:
  local_ocr_native:
    path: ../../packages/local-ocr-native
flutter:
  assets:
    - assets/trust/record-export-attestation-keys.json
    - assets/ocr/kor.traineddata
    - assets/ocr/eng.traineddata
    - assets/local-template-manifest.json
```

`pubspec.lock` must resolve that local package and no PDF/network/OCR SDK package. Release tests inspect the final unsigned AAB and no-codesign Runner.app/archive for the exact two trained-data hashes and the native library build manifest.

- [ ] **Step 3: Implement bounded local extraction with mandatory abstention**

Accept PNG/JPEG, 1 byte through 20 MiB, at most 25 megapixels, and 60 seconds total; reject malformed metadata, decompression/pixel bombs, animation, and extra frames. For PDF, show manual entry without reading/importing the file and explain that consented Korea-cloud processing is the automated alternative. Copy an accepted raster into an `NSFileProtectionComplete`/no-backup sandbox temp file using an opaque name, compute SHA-256, and delete that copy in `finally`.

OCR produces text boxes only. A deterministic, versioned template matcher may propose label/value/unit/date candidates for a manifest-enabled synthetic-benchmarked layout; otherwise it returns `unsupported_layout` and opens manual entry. The release gate is 100% exact numeric/date/unit extraction for every admitted synthetic template, zero false admission across the unsupported corpus, and zero network. Failing a model/template/device gate disables OCR for that template and leaves manual local entry available.

- [ ] **Step 4: Require complete local review and provenance-first storage**

Show original crop, extracted text, bounding box, template/model version, and an editable proposed value. Do not provide “accept all.” Every candidate is explicitly confirmed or rejected; manual records require display label, canonical decimal string, the exact unit printed on the report, aware date/time, and a user-visible local source label. Attach a UCUM/standard-code mapping only when the signed template manifest contains that exact reviewed mapping; never ask the user to guess one and never assign a confidence to a manual row.

Migration v2 adds a separate `LocalConfirmedRecords` table—never extra local states in `VerifiedRecords`—with exactly: `localRecordId` UUIDv4 primary key; `localCode`; nullable `standardCode`; `displayKo`; `valueDecimal`; `sourceUnit`; `effectiveAt`; `localSourceLabel`; `provenanceKind`; nullable `sourceDocumentSha256`; nullable `ocrModelVersion`, `templateId`, `templateVersion`, and `mappingDigest`; and `confirmedAt`. `localCode` is generated by the app and is exactly either `urn:genome-companion:local:manual:<uuidv4>` or `urn:genome-companion:local:template:<lowercase-template-slug>:<lowercase-field-slug>`; it is never sent to REC or represented as LOINC. Manual rows require `provenanceKind=manual_entry`, null source/model/template/mapping/standard-code fields. OCR rows require `provenanceKind=ocr_review`, a 64-hex source digest, nonblank model/template versions, and populate `standardCode`/`mappingDigest` only together from the signed template mapping. A table CHECK enforces both shapes. There is deliberately no local confidence column.

One SQLCipher transaction stores the local row and increments no server-table generation. The v1→v2 migration only creates this table/index, byte-compares all prior `VerifiedRecords`, and is tested from the committed `schema_v1.json`; `schema_v2.json` becomes the new release snapshot. Server export import deletes/replaces only `VerifiedRecords`, while local reset deletes both tables through key destruction. PDF/no-file manual entry uses the manual shape; OCR uses the OCR shape. After commit, destroy OCR text, candidate buffers, raster pages, and the sandbox source.

Apply Android `FLAG_SECURE` on private screens and obscure the iOS app switcher while backgrounded. Copy must state that screenshot prevention depends on OS/device behavior and is not guaranteed; release acceptance tests supported OS versions without saying “never screenshot.”

- [ ] **Step 5: Benchmark, verify, and commit**

Run: `python -m unittest scripts.mobile.test_benchmark_local_ocr -v && python scripts/mobile/benchmark_local_ocr.py --schema scripts/mobile/local-ocr-benchmark.schema.json --fixtures apps/mobile/test/fixtures/local-intake --manifest apps/mobile/assets/local-template-manifest.json --baseline-artifacts evidence/ux/local-ocr-baseline --candidate-artifacts evidence/ux/local-ocr-candidate --output evidence/ux/local-ocr-benchmark.v1.json --require-ci-devices && python scripts/mobile/audit_mobile_native_assets.py --app apps/mobile && cd apps/mobile && flutter test && flutter test integration_test/no_network_local_intake_test.dart`

Expected: strict benchmark fixtures reject each missing/wrong metric and the real CI result validates with all numeric size/startup/RSS/processing gates; admitted templates meet exact gates; unsupported corpus abstains; offline journey passes; native/source/model/license hashes match; no unreviewed or server-labelled row is written. The command does not claim the separately required Pixel/iPhone distribution gate.

```bash
git add packages/local-ocr-native apps/mobile/assets apps/mobile/lib/features/local_intake apps/mobile/lib/vault/database.dart apps/mobile/lib/vault/migrations.dart apps/mobile/drift_schemas apps/mobile/test/features/local_intake apps/mobile/test/vault/local_record_migration_test.dart apps/mobile/integration_test scripts/mobile apps/mobile/pubspec.yaml apps/mobile/pubspec.lock
git commit -m "feat(mobile): add reviewed zero-cloud document intake"
```

### Task 9: Enforce closed telemetry, accessibility, and visual regression gates

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/app/v1/public/events/route.ts`
- Create: `apps/web/lib/http/read-bounded-stream.ts`
- Create: `apps/web/lib/telemetry/safe-events.ts`
- Create: `apps/web/lib/telemetry/safe-event-sink.ts`
- Create: `apps/web/instrumentation.ts`
- Create: `apps/web/tests/safe-events.test.ts`
- Test: `apps/web/tests/public-events-route.test.ts`
- Create: `apps/web/e2e/accessibility.spec.ts`
- Create: `apps/web/e2e/network-privacy.spec.ts`
- Create: `apps/web/e2e/visual.spec.ts`
- Create: `apps/mobile/test/accessibility/semantics_test.dart`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: event names `public_comparison_completed`, `public_source_detail_opened`, and `public_methodology_opened`; public count/timing properties only. Private-record lifecycle metrics are derived server-side from required domain events and are never emitted by a client analytics SDK.
- Produces: `trackSafeEvent(name: SafeEventName, properties: SafeEventProperties) -> void`, same-origin `POST /v1/public/events` with a stream-enforced 512-byte public-only body, a real fixed-cardinality OpenTelemetry meter/exporter installed at server startup, axe results, Playwright request capture, visual snapshots at 390x844 and 1440x900, Flutter semantics results.

- [ ] **Step 1: Write a compile-time closed analytics test and runtime denylist test**

```typescript
type SafeEventName = "public_comparison_completed" | "public_source_detail_opened" | "public_methodology_opened";
type SafeEventProperties = { durationBucket?: "lt_10s" | "10_59s" | "gte_60s"; itemCountBucket?: "0" | "1" | "2_5" | "gte_6" };

it("rejects every sensitive property name", () => {
  for (const key of ["name", "email", "phone", "residentNumber", "factCode", "factValue", "sourceRef", "diagnosis", "genotype"]) {
    expect(() => validateSafeProperties({ [key]: "synthetic-secret" })).toThrow("analytics_property_denied");
  }
});
```

- [ ] **Step 2: Run and confirm missing safe-event implementation**

Run: `pnpm --filter @gc/web test -- safe-events.test.ts`

Expected: FAIL resolving `safe-events`.

- [ ] **Step 3: Implement an allowlisted event mapper with no generic escape hatch**

```typescript
// apps/web/lib/telemetry/safe-events.ts
import { z } from "zod";

const SafeEventNameSchema = z.enum(["public_comparison_completed", "public_source_detail_opened", "public_methodology_opened"]);
const SafeEventPropertiesSchema = z.strictObject({
  durationBucket: z.enum(["lt_10s", "10_59s", "gte_60s"]).optional(),
  itemCountBucket: z.enum(["0", "1", "2_5", "gte_6"]).optional(),
});
export const SafePublicEventSchema = z.strictObject({ name: SafeEventNameSchema, properties: SafeEventPropertiesSchema });
export type SafeEventName = z.infer<typeof SafeEventNameSchema>;
export type SafeEventProperties = z.infer<typeof SafeEventPropertiesSchema>;
export type SafePublicEvent = z.infer<typeof SafePublicEventSchema>;
const allowedKeys = new Set(["durationBucket", "itemCountBucket"]);

export function validateSafeProperties(value: Record<string, unknown>): SafeEventProperties {
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) throw new Error("analytics_property_denied");
  const duration = value.durationBucket;
  const count = value.itemCountBucket;
  if (duration !== undefined && !["lt_10s", "10_59s", "gte_60s"].includes(String(duration))) throw new Error("analytics_property_denied");
  if (count !== undefined && !["0", "1", "2_5", "gte_6"].includes(String(count))) throw new Error("analytics_property_denied");
  return Object.freeze({ ...(duration === undefined ? {} : { durationBucket: duration }), ...(count === undefined ? {} : { itemCountBucket: count }) }) as SafeEventProperties;
}

export function trackSafeEvent(name: SafeEventName, properties: SafeEventProperties): void {
  const body = JSON.stringify(Object.freeze({ name, properties: validateSafeProperties(properties) }));
  void fetch("/v1/public/events", { method: "POST", credentials: "omit", keepalive: true, headers: { "content-type": "application/json" }, body });
}
```

Add exact compatible pins `@opentelemetry/api` 1.9.1, `@opentelemetry/sdk-metrics` 2.10.0, and `@opentelemetry/exporter-metrics-otlp-proto` 0.221.0 to `apps/web/package.json`; do not add a browser analytics SDK or logs/traces exporter. `instrumentation.ts` installs exactly one `MeterProvider`/periodic reader in the Node runtime and exports metrics only to Task 10's separately credentialed private collector service. Test startup with an in-memory metric reader so a no-op provider fails. Implement the same-origin route without passing the `NextRequest`, headers, cookie, IP, referrer, or user agent into the sink:

```typescript
// apps/web/app/v1/public/events/route.ts
import { NextRequest } from "next/server";
import { readBoundedStream, BodyLimitError } from "@/lib/http/read-bounded-stream";
import { SafePublicEventSchema } from "@/lib/telemetry/safe-events";
import { recordPublicEvent } from "@/lib/telemetry/safe-event-sink";

export async function POST(request: NextRequest): Promise<Response> {
  if (request.headers.get("content-type") !== "application/json" || request.body === null) {
    return Response.json({ code: "event_rejected" }, { status: 400 });
  }
  let raw: Uint8Array;
  try { raw = await readBoundedStream(request.body, { maxBytes: 512, totalMs: 1000, idleMs: 250 }); }
  catch (error) {
    return Response.json(
      { code: "event_rejected" },
      { status: error instanceof BodyLimitError && error.reason === "too_large" ? 413 : 400 },
    );
  }
  let unknownBody: unknown;
  try {
    unknownBody = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  }
  catch { return Response.json({ code: "event_rejected" }, { status: 400 }); }
  const parsed = SafePublicEventSchema.safeParse(unknownBody);
  if (!parsed.success) return Response.json({ code: "event_rejected" }, { status: 400 });
  recordPublicEvent(parsed.data);
  return new Response(null, { status: 204 });
}
```

```typescript
// apps/web/lib/telemetry/safe-event-sink.ts
import { metrics } from "@opentelemetry/api";
import type { SafePublicEvent } from "./safe-events";

const counter = metrics.getMeter("gc-public-ux", "1.0.0").createCounter("gc.public_ux.events");

export function recordPublicEvent(event: SafePublicEvent): void {
  counter.add(1, {
    event_name: event.name,
    duration_bucket: event.properties.durationBucket ?? "absent",
    item_count_bucket: event.properties.itemCountBucket ?? "absent",
  });
}
```

`readBoundedStream` checks each chunk against remaining capacity **before** appending, enforces both a one-second wall deadline and 250 ms idle deadline with monotonic time, observes request abort, cancels the reader in every limit/timeout/abort branch, removes timer/listener resources in `finally`, and coalesces only after EOF. `SafePublicEventSchema` is a strict Zod 4 object containing only the three event names and two closed bucket enums already shown. `safe-event-sink.ts` creates one OpenTelemetry counter with attributes `event_name`, `duration_bucket`, and `item_count_bucket`; all values are enum members, never raw values. Sink/export failure is isolated and never fails the user request. Rate limiting occurs at the regional web edge before this route. The route records only a coarse server timestamp through the metrics backend and never reads or persists client IP. Do not export a generic string-named tracking function. Tests send one 513-byte chunk, many chunks totalling 513, absent/false Content-Length, invalid UTF-8, an endless zero-byte/trickle stream, and aborted requests; every case is cancelled/rejected without allocating/appending beyond 512 bytes.

- [ ] **Step 4: Add automated UX release gates**

Playwright must run axe on public comparison, record timeline, and privacy settings; tab through every interactive element; emulate reduced motion; render Korean at 200% zoom; and capture all requests, response errors, console messages, URLs, and storage keys for a synthetic secret denylist. Flutter semantics tests must require Korean labels for every button and reject gesture-only controls.

- [ ] **Step 5: Add CI commands inside the owned marker and commit**

Replace only the three FND-owned no-op blocks below; do not edit another job or create a workflow. The pinned checkout and runner are foundation-owned.

```yaml
# BEGIN UX WORKSTREAM STEPS
- uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38
  with: { node-version: "24.17.0" }
- name: UX web locked gates
  run: |
    corepack enable
    corepack prepare pnpm@11.20.0+sha512.9a6f330a95b66446ea088faf1521405a8a01f07fde7124cc9958dfed52d4bb436737e65b08f85f37b46fcba375092558ac51262b816844b22f63406ed166bfee --activate
    test "$(node -p "require('./package.json').packageManager")" = "pnpm@11.20.0+sha512.9a6f330a95b66446ea088faf1521405a8a01f07fde7124cc9958dfed52d4bb436737e65b08f85f37b46fcba375092558ac51262b816844b22f63406ed166bfee"
    test "$(pnpm --version)" = "11.20.0"
    pnpm install --frozen-lockfile
    pnpm --filter @gc/web exec playwright install --with-deps chromium
    pnpm --filter @gc/web generate:contracts
    git diff --exit-code apps/web/lib/api/generated
    pnpm --filter @gc/design-tokens test
    pnpm --filter @gc/web test
    pnpm --filter @gc/web build
    pnpm --filter @gc/web build-storybook --quiet
    pnpm --filter @gc/web exec playwright test
# END UX WORKSTREAM STEPS

# BEGIN UX ANDROID WORKSTREAM STEPS
- uses: subosito/flutter-action@1a449444c387b1966244ae4d4f8c696479add0b2
  with: { flutter-version: "3.44.7", channel: stable, cache: true }
- name: UX Android locked gates
  run: |
    set -Eeuo pipefail
    python scripts/ci/install_android_sdk.py --profile api35-google-apis-x86_64 --destination build/tools/android-sdk --avd-destination build/tools/android-avd --avd-name gc_api35
    export ANDROID_SDK_ROOT="$GITHUB_WORKSPACE/build/tools/android-sdk"
    export ANDROID_HOME="$ANDROID_SDK_ROOT"
    export ANDROID_AVD_HOME="$GITHUB_WORKSPACE/build/tools/android-avd"
    EMULATOR="$ANDROID_SDK_ROOT/emulator/emulator"
    ADB="$ANDROID_SDK_ROOT/platform-tools/adb"
    nohup "$EMULATOR" -avd gc_api35 -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect > "$RUNNER_TEMP/gc-emulator.log" 2>&1 &
    if ! timeout 300 "$ADB" wait-for-device; then tail -c 65536 "$RUNNER_TEMP/gc-emulator.log" >&2; exit 1; fi
    BOOT_DEADLINE=$((SECONDS + 300))
    until test "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1; do
      if test "$SECONDS" -ge "$BOOT_DEADLINE"; then tail -c 65536 "$RUNNER_TEMP/gc-emulator.log" >&2; exit 1; fi
      sleep 2
    done
    cd apps/mobile
    flutter pub get --enforce-lockfile
    flutter test
    flutter test integration_test/record_export_verifier_test.dart -d emulator-5554 --flavor candidate
    cd ../..
    python scripts/mobile/audit_mobile_native_assets.py --app apps/mobile --require-record-export-verifier
# END UX ANDROID WORKSTREAM STEPS

# BEGIN UX IOS WORKSTREAM STEPS
- uses: subosito/flutter-action@1a449444c387b1966244ae4d4f8c696479add0b2
  with: { flutter-version: "3.44.7", channel: stable, cache: true }
- name: UX iOS locked gates
  run: |
    sudo xcode-select -s /Applications/Xcode_16.4.app
    DEVICE_UDID=$(xcrun simctl create gc-iphone16 com.apple.CoreSimulator.SimDeviceType.iPhone-16 com.apple.CoreSimulator.SimRuntime.iOS-18-5)
    xcrun simctl boot "$DEVICE_UDID"
    xcrun simctl bootstatus "$DEVICE_UDID" -b
    cd apps/mobile
    flutter pub get --enforce-lockfile
    flutter test
    flutter test integration_test/record_export_verifier_test.dart -d "$DEVICE_UDID"
    cd ../..
    python scripts/mobile/audit_mobile_native_assets.py --app apps/mobile --require-record-export-verifier
# END UX IOS WORKSTREAM STEPS
```

The Android job is `ubuntu-24.04`; the iOS job is `macos-15` with Xcode 16.4, both as frozen by FND. These workstream jobs run source/native integration gates only; Task 10 alone owns real unsigned/no-codesign candidate construction and artifact inspection. The web job owns contract generation because it has Node/pnpm; mobile jobs verify the committed generated Dart and token source digests at test startup. The workflow-security test rejects action-SHA or marker drift.

Run: `pnpm --filter @gc/design-tokens test && pnpm --filter @gc/web test && pnpm --filter @gc/web exec playwright test && cd apps/mobile && flutter test`

Expected: zero serious/critical axe violations, no sensitive fixture leak, visual snapshots approved at both viewports, all keyboard/semantics tests PASS, and no essential motion when reduced motion is enabled.

```bash
git add apps/web/app/v1/public/events apps/web/lib/http apps/web/lib/telemetry apps/web/instrumentation.ts apps/web/package.json apps/web/tests apps/web/e2e apps/mobile/test .github/workflows/ci.yml pnpm-lock.yaml
git commit -m "test(ui): gate privacy accessibility and visual quality"
```

### Task 10: Deploy the private web BFF in Seoul and produce evidence-bound unsigned mobile candidates

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/web/Dockerfile.dockerignore`
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/collector.Dockerfile`
- Create: `apps/web/collector.Dockerfile.dockerignore`
- Create: `apps/web/collector-config.yaml`
- Create: `supply-chain/ux-images.lock.json`
- Create: `infra/modules/product-web/variables.tf`
- Create: `infra/modules/product-web/main.tf`
- Create: `infra/modules/product-web/identity-contract.tf`
- Create: `infra/modules/product-web/session.tf`
- Create: `infra/modules/product-web/compute.tf`
- Create: `infra/modules/product-web/export-spool.tf`
- Create: `infra/modules/product-web/edge.tf`
- Create: `infra/modules/product-web/observability.tf`
- Create: `infra/modules/product-web/deployment.tf`
- Create: `infra/modules/product-web/outputs.tf`
- Create: `infra/modules/product-web/tests/product_web.tftest.hcl`
- Generate and commit: `infra/modules/product-web/.terraform.lock.hcl`
- Create: `infra/functions/product-web-deploy-harness/handler.py`
- Create: `infra/functions/product-web-deploy-harness/test_handler.py`
- Create: `scripts/release/build_product_web_deploy_harness.py`
- Create: `scripts/release/test_build_product_web_deploy_harness.py`
- Create: `infra/live/product-web-staging/main.tf`
- Create: `infra/live/product-web-staging/providers.tf`
- Create: `infra/live/product-web-staging/backend.tf`
- Create: `infra/live/product-web-staging/variables.tf`
- Create: `infra/live/product-web-staging/outputs.tf`
- Create: `infra/live/product-web-staging/.terraform.lock.hcl`
- Create: `infra/live/product-web-prod/main.tf`
- Create: `infra/live/product-web-prod/providers.tf`
- Create: `infra/live/product-web-prod/backend.tf`
- Create: `infra/live/product-web-prod/variables.tf`
- Create: `infra/live/product-web-prod/outputs.tf`
- Create: `infra/live/product-web-prod/.terraform.lock.hcl`
- Create: `packages/contracts/jsonschema/product-web-plan-bundle.schema.json`
- Create: `packages/contracts/fixtures/product-web-plan-bundle.valid.json`
- Create: `packages/contracts/jsonschema/product-web-staging-handoff.schema.json`
- Create: `packages/contracts/fixtures/product-web-staging-handoff.valid.json`
- Consume unchanged from FND: `packages/contracts/jsonschema/ux-deployment-authority-request.schema.json`
- Consume unchanged from FND: `packages/contracts/fixtures/ux-deployment-authority-request.valid.json`
- Consume unchanged from FND: `packages/contracts/jsonschema/ux-deployment-authority-result.schema.json`
- Consume unchanged from FND: `packages/contracts/fixtures/ux-deployment-authority-result.valid.json`
- Consume unchanged from FND: `packages/contracts/jsonschema/ux-deployment-authority-task-callback.schema.json`
- Consume unchanged from FND: `packages/contracts/fixtures/ux-deployment-authority-task-callback.valid.json`
- Consume unchanged from FND: `packages/contracts/jsonschema/product-web-deployment-result.schema.json`
- Consume unchanged from FND: `packages/contracts/fixtures/product-web-deployment-result.valid.json`
- Consume unchanged from FND: `packages/contracts/jsonschema/product-web-apply-receipt.schema.json`
- Consume unchanged from FND: `packages/contracts/fixtures/product-web-apply-receipt.valid.json`
- Create: `packages/contracts/jsonschema/product-mobile-candidate-manifest.schema.json`
- Create: `packages/contracts/fixtures/product-mobile-candidate-manifest.valid.json`
- Create: `packages/contracts/jsonschema/product-mobile-native-test-evidence.schema.json`
- Create: `packages/contracts/fixtures/product-mobile-native-test-evidence.valid.json`
- Create: `packages/contracts/jsonschema/product-mobile-build-identity.schema.json`
- Create: `packages/contracts/fixtures/product-mobile-build-identity.valid.json`
- Create: `scripts/release/verify_product_web_image.py`
- Create: `scripts/release/test_verify_product_web_image.py`
- Create: `scripts/release/product_web_release.py`
- Create: `scripts/release/test_product_web_release.py`
- Consume unchanged from FND: `scripts/release/ux_deployment_authority.py`
- Consume unchanged from FND: `scripts/release/test_ux_deployment_authority.py`
- Consume unchanged from FND: `supply-chain/fnd-ux-deployment-authority.lock.json`
- Consume unchanged from FND: `infra/ux-deployment-authority/.python-version`
- Consume unchanged from FND: `infra/ux-deployment-authority/pyproject.toml`
- Consume unchanged from FND: `infra/ux-deployment-authority/uv.lock`
- Create: `scripts/release/build_mobile_candidate_manifest.py`
- Create: `scripts/release/test_build_mobile_candidate_manifest.py`
- Create: `scripts/release/verify_mobile_release.py`
- Create: `scripts/release/test_verify_mobile_release.py`
- Create: `tooling/product-release/.python-version`
- Create: `tooling/product-release/pyproject.toml`
- Generate and commit: `tooling/product-release/uv.lock`
- Modify: `apps/mobile/android/app/build.gradle.kts`
- Modify: `apps/mobile/pubspec.yaml`
- Modify: `apps/mobile/integration_test/record_export_verifier_test.dart`
- Create: `apps/mobile/assets/generated/.gitkeep`
- Create: `apps/mobile/native-components.lock.json`
- Create: `apps/mobile/android/gradle.lockfile`
- Create: `apps/mobile/android/gradle/verification-metadata.xml`
- Modify: `apps/mobile/android/gradle.properties`
- Create: `apps/mobile/ios/Podfile.lock`
- Create: `apps/mobile/ios/Pod-artifacts.lock.json`
- Create: `scripts/release/verify_cocoapods_artifacts.py`
- Create: `scripts/release/test_verify_cocoapods_artifacts.py`
- Consume unchanged from FND: `scripts/ci/verify_signed_release_tag.py`
- Consume unchanged from FND: `scripts/ci/install_security_tools.sh`
- Consume unchanged from FND: `scripts/ci/install_cosign.py`
- Consume unchanged from FND: `scripts/tests/test_install_cosign.py`
- Consume unchanged from FND: `scripts/ci/verify_workflow_security.py`
- Consume unchanged from FND: `scripts/ci/run_locked_uv.py`
- Consume unchanged from FND: `scripts/ci/install_bundletool.py`
- Consume unchanged from FND: `scripts/ci/install_buildx.py`
- Consume unchanged from FND: `scripts/tests/test_install_buildx.py`
- Consume unchanged from FND: `scripts/ci/install_opentofu.py`
- Consume unchanged from FND: `scripts/tests/test_install_opentofu.py`
- Consume unchanged from FND: `scripts/ci/build_product_provider_mirror.py`
- Consume unchanged from FND: `scripts/tests/test_build_product_provider_mirror.py`
- Consume unchanged from FND: `supply-chain/tool-artifacts.lock.json`
- Consume unchanged from FND: `scripts/release/foundation_output_snapshot.py`
- Consume unchanged from FND: `governance/release/allowed-tag-signers.schema.json`
- Consume unchanged from FND: `governance/release/allowed-tag-signers.json`
- Consume unchanged from FND: `packages/contracts/jsonschema/foundation-public-output-snapshot.schema.json`
- Consume unchanged from FND: `packages/contracts/fixtures/foundation-public-output-snapshot.valid.json`
- Consume unchanged from FND: `packages/contracts/jsonschema/foundation-output-env-map.schema.json`
- Consume unchanged from FND: `packages/contracts/fixtures/foundation-output-env-map.valid.json`
- Consume unchanged from FND: `governance/foundation/ux-foundation-output-env-map.json`
- Consume unchanged from FND: `supply-chain.lock.json`
- Create: `ops/runbooks/product-web-deploy-rollback.md`
- Create: `ops/runbooks/bff-session-incident.md`
- Create: `ops/runbooks/mobile-release-and-key-rotation.md`
- Consume unchanged from FND: `packages/contracts/jsonschema/ux-staging-result.schema.json`
- Consume unchanged from FND: `packages/contracts/fixtures/ux-staging-result.valid.json`
- Consume unchanged from FND: `packages/contracts/jsonschema/ux-staging-fault-request.schema.json`
- Consume unchanged from FND: `packages/contracts/fixtures/ux-staging-fault-request.valid.json`
- Modify: `.github/workflows/release.yml` only inside FND's `UX WEB PLAN`, `UX WEB STAGING`, `UX WEB RELEASE`, `UX ANDROID RELEASE`, and `UX IOS RELEASE` marker pairs

**Interfaces:**
- Consumes from FND: exact `application_vpc_id`, typed sorted arrays `application_private_subnet_ids`, `application_edge_subnet_ids`, `application_network_firewall_endpoint_ids`, and `application_allowed_tls_sni`, and exact `application_ecs_cluster_arn`; exact `private_service_discovery_namespace_id`, `private_service_discovery_hosted_zone_id`, `private_service_discovery_namespace_name=service.kr.internal`, and both collector DNS names; every exact per-environment ALB/listener/target-group/SG/WAF/Cloud Map/smoke-alias/runtime-role output frozen by FND Task 7C; exact web DNS names, certificate ARNs/SANs, and `fargate_ephemeral_storage_kms_key_arn`; exact private core/C0 listener and trust-bundle outputs; exact Cognito/OIDC outputs and local-user/MFA-required public-PKCE contract; exact egress/firewall outputs; exact pairwise-distinct `ux_web_plan_workflow_role_arn`, `ux_web_staging_workflow_role_arn`, and `ux_web_release_workflow_role_arn`; exact evidence/backend/repository/boundary outputs; and the immutable foundation-snapshot coordinate. FND exact-fetches that snapshot, writes `build/foundation/foundation-output-snapshot.coordinate.json`, and projects only `ux-foundation-output-env-map.json` before each web marker. Typed arrays remain compact canonical JSON; Product invokes only `foundation_output_snapshot.py read-array` against the verified projection to materialize mode-0600 JSON inputs and never shell-splits/evaluates them. Product never reads Terraform state, lists a zone/namespace, requests or validates a certificate, or accepts caller-authored tfvars to discover a foundation value.
- The same FND projection names these required scalars byte-for-byte: `product_collector_staging_internal_dns_name=product-collector.staging.service.kr.internal`, `product_collector_internal_dns_name=product-collector.service.kr.internal`, `product_web_staging_smoke_security_group_id`, `product_web_production_smoke_security_group_id`, `private_service_trust_bundle_secret_arn -> PRIVATE_SERVICE_TRUST_BUNDLE_SECRET_ARN`, `private_service_trust_bundle_secret_version_id -> PRIVATE_SERVICE_TRUST_BUNDLE_SECRET_VERSION_ID`, and `private_service_trust_bundle_sha256 -> PRIVATE_SERVICE_TRUST_BUNDLE_SHA256`. The module supplies all three exact trust-bundle environment values to every BFF task definition and reads the public bundle only by that VersionId and digest. It creates no WAF request-log destination: aggregate WAF rule/action metrics and alarms use the fixed foundation observability contract, while per-request WAF logging is disabled.
- Deployment authority is exact, digest-pinned, and wholly FND-owned: `ux_web_deployment_authority_image_digest`, the two environment state-machine ARNs, and the four fence-table name/ARN outputs. Product consumes unchanged the FND authority request/result/callback and Product apply/deployment schemas/fixtures plus `ux_deployment_authority.py`; it excludes every state machine, authority task/role/SG/image, fence table, apply receipt writer, deployment-result writer, and live ECS/ELB pointer mutation from its code, plans, and state. A staging or production workflow can call only `StartExecution|DescribeExecution` on its exact projected state machine through the FND client; it never runs `tofu apply`, acquires a fence, writes an authority/apply/deployment/staging result, or mutates ECS/ELB directly.
- Produces: immutable Product BFF/collector task definitions and smoke-harness code consumed by the FND-owned regional services and deployment authority; a private Next standalone BFF with a bounded verify-before-release export spool on foundation-CMK-encrypted Fargate ephemeral storage; KMS-encrypted TTL session/CSRF state; a separate closed-schema collector task; signed-digest plan/handoff/provider-mirror inputs; and source-bound unsigned mobile candidates. It creates no ECS service, edge/listener/target group/SG/WAF/DNS/Cloud Map service, IAM role, state machine, fence, repository/backend/evidence bucket, or Cognito resource.

- [ ] **Step 1: Write failing infrastructure, identity-token, collector, and release-artifact tests**

Bootstrap only the test runner before RED: create `tooling/product-release/.python-version` and `pyproject.toml`, generate the reviewed lock once with `python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release`, then require `python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release --check && python scripts/ci/run_locked_uv.py -- sync --project tooling/product-release --frozen`. This installs no Product implementation; the following tests still fail for the missing module, schemas, and scripts.

Product's backend-free OpenTofu tests require region `ap-northeast-2`; task-definition and network inputs that permit no public task IP; ALB→BFF-only ingress; BFF→the two exact private core/C0 listeners, DynamoDB, exact FND domain-egress boundary, and private collector only; **no BFF CloudWatch-export, identity-admin, or Secrets Manager permission except `GetSecretValue` on the one public trust-bundle ARN/version, and no KMS permission except `kms:Decrypt` on `private_service_identity_secret_kms_key_arn` constrained by `kms:ViaService=secretsmanager.ap-northeast-2.amazonaws.com`, exact caller account, and `kms:EncryptionContext:SecretARN=private_service_trust_bundle_secret_arn`**; regional WAF; TLS 1.2+; no CloudFront/global private edge; session table TTL/PITR/customer-managed service-side KMS; least-privilege task roles; immutable ECR digests; read-only root/non-root UID; and separate non-PHI log/metric destinations. FND's service-shell/deployment-authority integration—not Product's backend-free module test—proves two healthy BFF tasks in distinct AZs, deployment circuit-breaker behavior, collector placement, and live desired counts. The BFF has no `app-health`, Fargate-storage, AMP-workspace, session-table, direct ciphertext, or other KMS access. The FND ECS cluster must already report the exact `fargate_ephemeral_storage_kms_key_arn`; Fargate, not the BFF role, holds the restricted storage grant. The BFF task requests 30 GiB ephemeral storage, mounts one writable bind volume only at `/var/lib/gc-export-spool`, sets directory mode `0700`/owner `65532`, allows exactly two 50,331,648-byte active spools plus `201,326,592` bytes reserved free space, and otherwise retains read-only root. Fargate bind mounts expose no `noexec,nosuid,nodev` option, and Fargate rejects both `dockerSecurityOptions` such as `no-new-privileges` and the `privileged` task-definition field, so the plan claims neither; the rendered definition must omit `privileged` and its effective mode must be non-privileged. Compensation is opaque non-executable data, numeric non-root UID, all supported Linux capabilities dropped, no setuid/setgid file in the locked image, no shell/interpreter path pointed at the spool, strict ZIP-only response handling, and image/runtime tests that never execute or load a spool path. The module must consume—not recreate or weaken—the named FND private-service/egress outputs, set `CORE_API_PRIVATE_BASE_URL`, `PUBLIC_API_PRIVATE_BASE_URL`, `PRIVATE_SERVICE_TRUST_BUNDLE_SECRET_ARN`, and `PRIVATE_SERVICE_TRUST_BUNDLE_SHA256` from them byte-for-byte, place every BFF ENI in an application subnet behind those firewall endpoint routes, and attach exactly both `application_egress_security_group_id` and `product_web_client_security_group_id`. No core, C0, AI, collector, one-shot, endpoint, or database ENI may receive the product-web client SG. Tests reject a missing/listener/hostname/trust/storage-key digest mismatch, API-Gateway origin, public NAT fallback, wildcard/domain drift, direct-NAT route, `fail_open`, writable root, spool outside the sole mount, setuid/setgid image file, executable/loadable spool path, wrong key/secret/context/service/account KMS decrypt, task-role Fargate/AMP/app-health KMS grant, unsupported security option, or added public egress/secret permission. Synthetic connectivity proves the exact private core/C0 SAN/chain/digest and environment Cognito `/oauth2/token`, `/oauth2/revoke`, issuer discovery/JWKS hosts plus required private endpoints pass; `example.com`, same-IP/wrong-SNI, literal IP, HTTP, QUIC, arbitrary DNS, DoH, and DoT fail. A boundary fixture receives exactly 50,331,648 bytes core→encrypted spool, verifies length/digest/fsync, and only then observes BFF response commit with bounded RSS and matching `X-GC-Archive-SHA256`; 50,331,649, API-Gateway routing, early EOF, extra byte, same-length mutation, timeout, spool exhaustion, or digest/header drift observes zero browser headers/body. Image tests strict-load `supply-chain/ux-images.lock.json`, resolve each tag/index and linux/amd64 manifest from the registry, and fail on tag, index, platform digest, Dockerfile `FROM`, entrypoint, build-context, authoritative-contract input, or final-image base-label drift.

Every BFF task-definition environment list contains all three byte-exact names together: `PRIVATE_SERVICE_TRUST_BUNDLE_SECRET_ARN`, `PRIVATE_SERVICE_TRUST_BUNDLE_SECRET_VERSION_ID`, and `PRIVATE_SERVICE_TRUST_BUNDLE_SHA256`. Startup calls `GetSecretValue` only with that exact VersionId and rejects an omitted/different VersionId or mutable stage lookup.

The image must pre-create `/var/lib/gc-export-spool` as a real directory owned by UID/GID `65532`, mode `0700`, and declare the exact matching Dockerfile `VOLUME`. ECS then initializes the anonymous bind volume from that reviewed path. Startup independently rejects a symlink, wrong owner/group/mode/device, insufficient capacity, or foreign entry before readiness. Image/task tests reject an absent/second/mismatched `VOLUME`, a root-owned mount, or a writable path anywhere else; this ownership bootstrap is required rather than assumed from task-definition prose.

The release tools are a separate locked project: `tooling/product-release/.python-version` is exactly `3.12.13`; `pyproject.toml` requires Python `==3.12.13`, pins `boto3==1.43.53` and `botocore==1.43.53`, and its uv 0.12.3 lock commits every transitive artifact hash. Every Product Python command runs only through FND's `python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python ...`; no protected marker invokes ambient packages, `pip`, bare `uv`, or an AWS CLI. Tests reject lock drift, unpinned imports, inherited Python/uv overrides, network-downloading a Python runtime, or direct invocation of an AWS-facing script.

Release-contract tests begin RED too. Product owns `product-web-plan-bundle.schema.json`, whose additional-properties-false object is exactly `{schemaVersion:"product-web-plan-bundle.v1",sourceSha,tagVerificationSha256,foundationSnapshot:{key,versionId,sha256},terraformLockSha256,deploymentHarness:{key,versionId,sha256},stagingFaultMode:"upstream_5xx_once",plans,createdAt,expiresAt,planBundleSha256}`. `plans` is the sorted exact two-row array `{environment:"staging"|"production",plan:{key,versionId,sha256},providerMirror:{key,versionId,sha256},showSha256,policySha256,priorState,postconditions}`. Each `priorState` is the FND-frozen additional-properties-false discriminated union: greenfield is exactly `{status:"absent",backendVersionId:null,lineageSha256:null,serial:null,knownStateSha256:null}` and existing state is exactly `{status:"present",backendVersionId,lineageSha256,serial,knownStateSha256}`. No empty string, zero serial, fabricated lineage, sentinel digest, mixed-null row, omitted discriminator, or extra key is valid. Each embedded additional-properties-false `postconditions` is exactly `{schemaVersion:"product-web-postconditions.v1",environment,resourceAddresses,knownValues,computedValues,postconditionsSha256}`: addresses and rows are sorted; each known row is `{jsonPointer,valueSha256}`; each computed row is `{jsonPointer,type,pattern,relation}` from a closed per-resource allowlist; and its self-digest omits only itself. The module and both committed live roots have the same provider-lock digest, expiry is exactly 24 hours, and the self-digest omits only itself.

Product also owns `product-web-staging-handoff.schema.json`, exactly `{schemaVersion:"product-web-staging-handoff.v1",sourceSha,tagVerificationSha256,foundationSnapshot:{key,versionId,sha256},terraformLockSha256,planBundle:{key,versionId,sha256},stagingFault:{key,versionId,sha256},bffImage:{repository,digest,signature:{key,versionId,sha256},attestation:{key,versionId,sha256},sbom:{key,versionId,sha256},provenance:{key,versionId,sha256}},collectorImage:{repository,digest,signature:{key,versionId,sha256},attestation:{key,versionId,sha256},sbom:{key,versionId,sha256},provenance:{key,versionId,sha256}},createdAt,expiresAt,handoffSha256}`; both image digests are `sha256:<64 lowercase hex>`, all coordinates are exact S3 key/VersionId/SHA triples, and `handoffSha256` hashes RFC 8785 bytes omitting only itself. No Product plan, image, Lambda, route, target, environment flag, or AWS resource implements the fault. The exact FND fault request authorizes only the FND Standard-workflow `InjectStagingSyntheticSmoke503` Pass state to emit one strict synthetic 503 into the real smoke Choice/catch edge after a healthy baseline; the same definition restores and verifies the prior pointers, clears only its execution-local boolean, re-promotes, and performs a real smoke. `verify-plan` rejects every Product fault resource and every production fault path. The 24-hour TTL bounds a same-day protected production approval; expiry requires a fresh plan and both later jobs check it immediately before mutation.

FND owns and Product consumes unchanged `ux-staging-result.v1`, exactly `{schemaVersion:"ux-staging-result.v1",sourceSha,tagVerificationSha256,handoff:{key,versionId,sha256},planBundle:{key,versionId,sha256},applyReceipt:{key,versionId,sha256},deploymentResult:{key,versionId,sha256},handoffSha256,planSha256,bffImageDigest,collectorImageDigest,smokeSha256,rollbackSha256,completedAt,resultSha256}`. Product exact-fetches both nested coordinates and verifies the same environment/request/source/handoff/plan/image-trust/candidate-prior/outcome chain before production promotion. The acyclic order is exactly `imageTrust -> applyReceipt -> deploymentResult -> stagingResult -> authorityResult`; a staging result never contains or references an authority result. Missing, swapped, cross-execution, cyclic, current-read, or digest-divergent nested coordinates fail.

FND owns and Product consumes unchanged `product-web-apply-receipt.v1` and `product-web-deployment-result.v1`. Product tests validate those exact bytes but Product has no serializer, writer, recovery branch, or state transition for either contract. `capture-state` is plan-time read-only evidence under the exact backend lock. It emits `status="absent"` only when the FND-defined exact-key absence proof succeeds, with all four remaining fields JSON null; otherwise it exact-version reads the bounded non-sensitive state and emits `status="present"` plus its real backend VersionId, lineage digest, serial, and known-state digest. `verify-plan` requires the saved-plan prior state to byte-equal that complete union and permits `absent` only with the closed first-install address/action set. `build-plan-bundle` embeds each verified union byte-for-byte in its matching environment row; neither command accepts a caller status, default, sentinel, or reconstructed field. Tests cover both statuses, a concurrent state appearance, historical/current ambiguity, every mixed-null/discriminator mutation, a greenfield non-first-install plan, and cross-environment row substitution. Only the digest-pinned FND authority image later exact-fetches the plan row and provider mirror, independently reproves the union under its lock, applies or recovers, proves postconditions, and writes the receipt. Product never applies or treats a current backend object as authority evidence.

Product consumes unchanged FND `ux-deployment-authority-request.v1`, exactly `{schemaVersion:"ux-deployment-authority-request.v1",environment,operation,handoff,planBundle,foundationSnapshot,stagingResult,faultRequest,authorizationExpiresAt,requestSha256}`, `ux-deployment-authority-result.v1`, exactly `{schemaVersion:"ux-deployment-authority-result.v1",requestSha256,environment,applyReceipt,deploymentResult,stagingResult,outcome,completedAt,resultSha256}`, and the FND-only callback `{schemaVersion:"ux-deployment-authority-task-callback.v1",requestSha256,applyReceipt,candidate:{bffTaskDefinitionArn,collectorTaskDefinitionArn,smokeFunctionVersionArn},observedStateSha256,callbackSha256}`. Product never creates, accepts from workflow input, logs, or sends callback/token bytes. Staging is only `operation="stage"` with exact handoff, plan-bundle, foundation-snapshot, and nonnull fault-request coordinates and `stagingResult=null`; production is only `operation="promote"` with the same upstream chain plus the exact successful FND staging-result coordinate and `faultRequest=null`. Every coordinate is exactly `{key,versionId,sha256}` and the two requests bind one source/tag/snapshot/plan/image chain.

`product_web_release.py` has only `ecr-login-password|image-ref|provenance|plan-vars|capture-state|verify-plan|build-plan-bundle|build-staging-fault-request|build-handoff|extract-handoff-fault|extract-staging-chain|recheck-expiry|source-sha|write-coordinate|emit-coordinate` subcommands. Its only AWS mutations are plan-job conditional uploads of the enumerated image evidence, locked provider mirror, saved plans, harness, bundle, fault request, and handoff. `write-coordinate` accepts only a complete protected predecessor triple and atomically emits canonical mode-0600 `{key,versionId,sha256}`. `extract-handoff-fault` exact-version fetches and fully verifies the protected handoff coordinate, then emits only its exact nested fault coordinate. `extract-staging-chain` exact-version fetches the FND staging result plus its nested apply receipt and deployment result, verifies the full acyclic image-trust/request/environment/source/handoff/plan/candidate-prior/outcome chain, then emits only the already verified handoff and plan-bundle coordinates. Both require the verified UX projection for the fixed evidence bucket and accept no bucket/current/List/default input. No Product subcommand applies, verifies an applied state, invokes a coordinator, writes a receipt/result, acquires a fence, or mutates ECS/ELB.

FND's unchanged `ux_deployment_authority.py stage|promote` is the sole staging/production workflow client and sole builder of the exact authority request. Both modes receive only `--handoff-coordinate`, `--plan-bundle-coordinate`, `--foundation-snapshot-coordinate`, and `--out-dir`; stage additionally receives `--fault-coordinate`, and promote additionally receives `--staging-result-coordinate`. The client selects only the matching projected FND state-machine ARN, calls only `StartExecution|DescribeExecution`, exact-fetches and verifies the authority result plus every nested apply/deployment/staging coordinate, and atomically emits the FND-frozen output files. A rerun after a lost response can only describe the same input-bound execution. Tests cover coordinate/environment/result swaps, expiry, current/List fallback, input/name collision, lost response, wrong state machine, callback/token leakage, and any Product attempt to apply, fence, write a result, or mutate a live pointer.

`plan-vars` accepts only FND's verified `ux-output-projection.json` plus `foundation-output-snapshot.coordinate.json`; it rejects the broader raw snapshot and every unprojected key. The four arrays enter only through FND `read-array` mode-0600 files and are rechecked before tfvars construction. In staging/production, the FND authority client exact-fetches only the transitive objects named by the strict request coordinates and never accepts a raw snapshot, caller-authored output value, or broader bucket access. Tests add an AI-only output, comma-split/list-string/unsorted array, substituted projection/map/coordinate, and prove Product cannot observe or use it.

Mobile-contract tests also begin RED. `product-mobile-candidate-manifest.v1` is exactly `{schemaVersion:"product-mobile-candidate-manifest.v1",platform,sourceSha,applicationId,artifactSha256,uploadEnvelopeSha256,dependencyLockSha256,recordExportRegistrySha256,nativeAssetManifestSha256,modelManifestSha256,sbomSha256,provenanceSha256,testEvidenceSha256,signingState,createdAt,manifestSha256}` with `platform=android|ios`, exact application ID `kr.co.genomecompanion.mobile`, `signingState=unsigned-aab|no-codesign-xcarchive`, and self-digest omitting only itself. Android `artifactSha256` and `uploadEnvelopeSha256` both hash the exact AAB bytes. iOS `artifactSha256` hashes a canonical sorted archive-tree manifest of relative POSIX path, file type, normalized mode, byte length/file SHA-256 for regular files, and relative target for safe symlinks; absolute or escaping links plus sockets/devices fail, and only filesystem mtime is ignored. Its separate `uploadEnvelopeSha256` hashes the exact uploaded ZIP bytes. The verifier safely extracts the ZIP into a fresh mode-0700 directory with hard byte/file/depth caps and proves it contains exactly one `Runner.xcarchive` whose canonical tree manifest equals `artifactSha256`; it rejects absolute/traversing names, escaping or absolute symlinks, hard links, sockets/devices, duplicate or case-colliding entries, extra roots, decompression bombs, and metadata/type drift. Thus the uploaded envelope cannot bind an unrelated archive. `build_mobile_candidate_manifest.py` has only `toolchain|build-identity|test-evidence|sbom|provenance|build`; it canonicalizes sorted input-lock hashes, refuses an untracked/mutated input or unknown tool, and never signs. Android tests require a sole `candidate` product flavor, `candidateRelease` signing configuration exactly null, Gradle dependency locking for every resolvable configuration, no signing property/environment read, and exact artifact `apps/mobile/build/app/outputs/bundle/candidateRelease/app-candidate-release.aab`; `jarsigner -verify -strict -certs` must return its documented unsigned result containing `jar is unsigned`, and the ZIP must contain no `META-INF/*.SF|*.RSA|*.DSA|*.EC`, signing block, upload/debug key, `INTERNET`, or unexpected application ID. A successful signature verification or a different verification error both fail. `apksigner` is not used to bless an AAB because it verifies APKs, not bundles. iOS tests require locked CocoaPods/Pods, the generic-device `xcodebuild archive` flags frozen below, exact archive `apps/mobile/build/ios/archive/Runner.xcarchive`, no `_CodeSignature`, embedded provisioning profile, development team, signing identity, `get-task-allow`, or signed nested framework, and exact bundle ID. Both tests inspect the real artifacts, not fixtures or Dart-only output, and reject omitted native P-256/SQLCipher/model assets, dependency-lock drift, network SDKs, backup-policy drift, debug symbols in shipped binaries, or a manifest whose hashes do not match bytes.

Android AAB inspection uses only FND-owned bundletool `1.18.1` installed by `python scripts/ci/install_bundletool.py --destination build/tools/bundletool` from the locked URL/size/SHA-256 row in `supply-chain/tool-artifacts.lock.json`; `verify_mobile_release.py` receives that exact JAR path, runs bounded `validate` and `dump manifest`, and rejects another parser/JAR/version/hash. `apps/mobile/native-components.lock.json` is additional-properties-false and has the sorted exact component IDs `record-export-verifier`, `local-ocr-native`, and `sqlcipher-runtime`. Each row embeds `{componentId,repositoryPaths,dependencyLockSelectors,androidLibraries,iosLibraries,requiredSymbols,forbiddenSymbols,abiVersion,sourceDigestRule,rowSha256}` with sorted unique arrays and a row self-digest; the SQLCipher row additionally binds the exact native package coordinates/checksums from both platform locks. This single reviewed file is the ABI/symbol allowlist—there is no missing external manifest for an implementer to invent. It rejects an absent/extra component, path alias, generated/vendor/cache input, dirty tracked source, library/symbol substitution, or a SQLCipher native coordinate not present in both platform lock graphs.

Before either platform's first release-gate test build, `build-identity` emits the exact additional-properties-false `product-mobile-build-identity.v1` bytes `{schemaVersion,platform,sourceSha,nativeComponentsSha256,dependencyLockSha256,toolchainManifestSha256,recordExportAbiSha256,localOcrAbiSha256,sqlcipherBindingSha256,identitySha256}` to the sole generated asset `apps/mobile/assets/generated/release-build-identity.json` with `O_CREAT|O_EXCL`, mode `0440`, and self-digest omitting only itself. `pubspec.yaml` includes only the directory `assets/generated/`; the repository contains only `.gitkeep` there and a committed identity file is forbidden. Ordinary analyze/unit/earlier-workstream runs do not require the identity. The Task 10 mobile integration commands set `GC_REQUIRE_RELEASE_BUILD_IDENTITY=1`, which makes a missing/malformed identity fail and makes the test read and emit those embedded bytes. The same untouched bytes enter that platform's debug/simulator test build and unsigned/no-codesign release build; the artifact verifier extracts them plus the three native ABI/symbol allowlists from the exact AAB/archive and byte-compares all digests. A missing, regenerated-between-builds, caller-authored, committed-placeholder, or non-matching identity fails.

`product-mobile-native-test-evidence.v1` is additional-properties-false and exactly `{schemaVersion,platform,sourceSha,nativeComponentsSha256,dependencyLockSha256,toolchainManifestSha256,bundletoolSha256,nativeBuildIdentitySha256,abiManifestSha256,goldenVectorSha256,mutationSuiteSha256,unitLogSha256,integrationLogSha256,completedAt,evidenceSha256}`; `platform=android|ios`, `bundletoolSha256` is the FND lock digest for Android and null for iOS, and the self-digest omits only itself. The real integration test emits exactly one bounded `GC_NATIVE_TEST_EVIDENCE_V1=<base64url RFC8785 JSON>` line containing the embedded build identity, aggregate ABI manifest, golden-vector digest, and closed mutation-suite digest; duplicate/malformed/extra records or a passing log without it fail. `test-evidence` exact-decodes that line, recomputes the clean component/source/lock/toolchain/log digests, strict-validates the shared fixture, and emits the canonical record. `build_mobile_candidate_manifest.py toolchain` is the only toolchain-manifest producer: for Android it exact-verifies FND's `android-sdk-install-receipt.json`, locked archive rows, absolute SDK/AVD paths, Temurin, Flutter, Gradle, and bundletool; for iOS it exact-verifies the FND-pinned Xcode build, Flutter, CocoaPods, Swift, and Clang. It accepts no caller version override and writes bounded canonical bytes. The release-artifact verifier's byte comparison makes a debug/simulator execution evidence for the same source/toolchain identity, not a false claim that the unsigned/no-codesign distribution bytes ran.

The Android lock ceremony runs `./gradlew :app:dependencies --write-locks --write-verification-metadata sha256` from the reviewed clean tree, commits `gradle.lockfile` plus strict `gradle/verification-metadata.xml`, then reruns with dependency verification `strict` and no metadata update. The iOS ceremony pins CocoaPods `1.16.2`, runs the initial reviewed `pod install`, and creates `Pod-artifacts.lock.json` as a sorted additional-properties-false map of every pod name/version/spec checksum/source URL-or-commit/archive SHA-256/license; subsequent `pod install --deployment` plus `verify_cocoapods_artifacts.py` requires byte-identical `Podfile.lock`, sandbox `Manifest.lock`, podspec/source/archive bytes, and no unpinned CDN/git branch/local path. Both ceremonies are reviewer-only lock creation; protected candidate jobs are verification-only and network-fetch a dependency only through its exact locked URL/hash.

A separately authorized, human-observed nonproduction identity gate—not the unattended deployment harness—redeems one fresh PKCE authorization code after the reviewer performs TOTP and proves the **access token** has exact issuer, `client_id`, `token_use=access`, single URL audience `https://api.genome-companion.kr`, numeric scalar `auth_time`, `openid`, and only exact qualified resource scopes. It stores no reusable password, TOTP seed, code, or token in GitHub, Terraform, a fixture, or release evidence; only aggregate pass/fail and contract digests may be retained. Base login has `https://api.genome-companion.kr/consent.read` and `.consent.write`; step-up has the base resource scopes plus exactly one of `.records.export` or `.profile.reset`; every authorize request includes `resource=https://api.genome-companion.kr`. Wrong client, missing/extra audience, both action scopes, stale auth, ID-token substitution, bare/unknown scope, or transferred/replayed browser transaction fails. The automated deployment smoke is deliberately limited to unauthenticated redirects, PKCE parameter shape, callback rejection, no-store/CSRF behavior, and private upstream health; it cannot manufacture or redeem a code. A separate FND deployment test proves `mfa_configuration=ON`, TOTP-only, and no external IdP; this plan never expects or manufactures `amr` or `region` token claims.

Collector adversarial tests send raw OTLP from a BFF-SG fixture containing an unknown metric, log/trace, unknown attribute, raw string, synthetic fact value, or out-of-enum attribute and prove it is dropped before export. Traffic from any other SG is denied. Only `gc.public_ux.events` with the three exact attributes/enums may reach the CloudWatch metric exporter, and only the collector task role can export it.

- [ ] **Step 2: Confirm RED**

Run: `python -m unittest scripts.tests.test_install_opentofu -v && test ! -e build/tools/opentofu-red && python scripts/ci/install_opentofu.py --destination build/tools/opentofu-red && test "$(build/tools/opentofu-red/tofu version | sed -n '1p')" = 'OpenTofu v1.10.6' && python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release --check && python scripts/ci/run_locked_uv.py -- lock --project infra/ux-deployment-authority --check && build/tools/opentofu-red/tofu -chdir=infra/modules/product-web init -backend=false && build/tools/opentofu-red/tofu -chdir=infra/modules/product-web test && python -m unittest scripts.tests.test_build_product_provider_mirror -v && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python -m unittest scripts.release.test_verify_product_web_image scripts.release.test_product_web_release scripts.release.test_build_product_web_deploy_harness scripts.release.test_build_mobile_candidate_manifest scripts.release.test_verify_mobile_release scripts.release.test_verify_cocoapods_artifacts -v && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python -m unittest discover -s infra/functions/product-web-deploy-harness -p "test_*.py" -v && python scripts/ci/run_locked_uv.py -- run --project infra/ux-deployment-authority --frozen pytest scripts/release/test_ux_deployment_authority.py -q && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python scripts/release/verify_product_web_image.py --help && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python scripts/release/product_web_release.py --help && python scripts/ci/run_locked_uv.py -- run --project infra/ux-deployment-authority --frozen python scripts/release/ux_deployment_authority.py --help && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python scripts/release/build_product_web_deploy_harness.py --help && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python scripts/release/build_mobile_candidate_manifest.py --help && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python scripts/release/verify_mobile_release.py --help && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python scripts/release/verify_cocoapods_artifacts.py --help`

Expected: module/image verifier is absent and tests fail.

- [ ] **Step 3: Validate the FND identity seam and provision only session state**

Recheck the already bootstrapped release-tool lock with `python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release --check`; this and every subsequent protected command are check/run-only and must not update that lock.

`identity-contract.tf` accepts, but never creates or mutates, FND outputs `oidc_issuer`, `oidc_jwk_set_uri`, `oidc_audience`, `oidc_client_id`, authorization/token endpoints, and environment callback/logout URIs. Preconditions require the URL audience and one exact environment mapping: dev callback/logout `https://app.dev.genome-companion.kr/auth/callback` and `https://app.dev.genome-companion.kr/`; prod callback/logout `https://app.genome-companion.kr/auth/callback` and `https://app.genome-companion.kr/`. The client must be public/non-secret. An integration test describes the FND pool/client and blocks unless local users only, `mfa_configuration=ON`, TOTP enabled, no SMS/external IdP, code flow/PKCE, no client secret, five-minute access/ID tokens, revocation, and the four URL-resource scopes match. Product-web has no `aws_cognito_*` resource and no Lambda trigger.

Create one DynamoDB table with partition/sort keys for hashed login/session/CSRF handles, TTL, PITR, deletion protection, point-in-time alarms, customer-managed KMS encryption performed transparently by DynamoDB, and no stream/export/global replica. FND precreates the separate non-application deployment-fence table for this environment; Product can neither place it in state nor read/write it. The BFF task role has condition-scoped CRUD only on the session table/index and no access to the deployment-fence table; it receives no direct KMS decrypt, Cognito administration, client secret, or identity-mutation permission. Only the FND deployment-authority state-machine role may conditionally read/write its one fence item. No session value enters Terraform state, environment output, logs, metrics, crash dumps, or browser storage. `export-spool.tf` asserts the FND ECS cluster's managed-storage configuration equals the consumed single-Region key ARN, configures the 30 GiB task volume/mount and two-permit/timeout environment constants, and grants no task-role KMS action. Run the session/spool plus foundation-fence-exclusion OpenTofu tests immediately after this change before adding compute.

The two live roots are independent Product states over the same module and immutable image inputs. `product-web-staging` uses backend key `product-web/staging/terraform.tfstate`; `product-web-prod` uses `product-web/production/terraform.tfstate`; both accept only the FND-owned backend bucket/lock table and never create or import them. The module and roots commit one byte-identical provider lock; CI rejects another digest/source/version/checksum, local backend, workspace, `-target`, `-replace`, refresh suppression, or state-key crossover. FND precreates the repositories, evidence/backend storage, all per-environment services/edge/network/DNS/WAF/Cloud Map resources, runtime/smoke roles, authority task and state-machine roles, state machines, and fences. Product consumes those exact projected IDs/ARNs and creates no IAM resource or control-plane duplicate. Its saved plans contain only the two ECS task definitions, qualified smoke Lambda function/alias, session table/runtime CMK, fixed application/EMF log groups, and four fixed aggregate alarms allowed by FND policy; they exclude every ECS service, state machine, fence, authority task/image/role/SG, live pointer, and FND-owned resource. The plan role alone may read both prior states, take/release plan locks, push the two repositories, and conditionally upload the enumerated immutable plan-chain objects. Staging/release roles cannot access a backend or `tofu apply`; they exact-read only their approved transitive chain and call only their matching FND state machine. No Product role can pass a role, write an apply/deployment/staging/authority result, or mutate ECS/ELB directly.

Generate all three locks only after `python -m unittest scripts.tests.test_install_opentofu -v && test ! -e build/tools/opentofu-lock && python scripts/ci/install_opentofu.py --destination build/tools/opentofu-lock`, then run the pinned binary: `TOFU="$PWD/build/tools/opentofu-lock/tofu"; test -x "$TOFU"; test "$("$TOFU" version | sed -n '1p')" = 'OpenTofu v1.10.6'; for ROOT in infra/modules/product-web infra/live/product-web-staging infra/live/product-web-prod; do "$TOFU" -chdir="$ROOT" providers lock -platform=linux_amd64 -platform=windows_amd64 -platform=darwin_arm64; done`. Then require `cmp --silent infra/modules/product-web/.terraform.lock.hcl infra/live/product-web-staging/.terraform.lock.hcl && cmp --silent infra/modules/product-web/.terraform.lock.hcl infra/live/product-web-prod/.terraform.lock.hcl` before the first saved plan. No implementation step may generate or refresh a lock inside a protected release job.

- [ ] **Step 4: Build the hardened BFF image and separate closed collector service**

Both Product Dockerfiles and image records consume FND's sole container-builder contract unchanged: Buildx `0.20.1`, builder `gc-ux-plan`, BuildKit index `sha256:c457984bd29f04d6acc90c8d9e717afe3922ae14665f3187e0096976fe37b1c8`, linux/amd64 manifest `sha256:8c8514715aab54e12f65b6a38a219084ab926d49c52d519ac17a8e79befb9c75`, Dockerfile frontend index `sha256:dbbd5e059e8a07ff7ea6233b213b36aa516b4c53c645f1817a4dd18b83cbea56`, and frontend linux/amd64 manifest `sha256:4611ea7b7d89ce41ec5c63df83076ccec3fe8daa32a2d9c96e5decb72e9a8d67`. FND installs and bootstraps it before the Product marker. Product rehashes the plugin/index receipts and binds all four digests into both image records and provenance; a default/host builder, mutable syntax tag, wrong platform, or missing receipt fails before build/push.

Freeze this UX-owned lock; both index and linux/amd64 manifest are required because the build accepts an OCI index while ECS runs linux/amd64:

```json
{
  "schemaVersion": "ux-oci-lock.v1",
  "resolvedAt": "2026-08-08T18:25:24Z",
  "images": {
    "nodeBuildRuntime": {
      "reference": "docker.io/library/node:24.17-bookworm-slim",
      "indexDigest": "sha256:862263c612aa437e3037674b85419622a9d93bff80aa1eee5398dfe686375532",
      "linuxAmd64Digest": "sha256:5d33add4a73ccf344c582ccb0cf5c7adb26596b3e82e9cfc859e75febc7843c4"
    }
  }
}
```

`apps/web/Dockerfile.dockerignore` allows only the root workspace manifests/lock, `apps/web/**`, `packages/design-tokens/**`, the exact PUB OpenAPI `apps/core-api/src/main/resources/openapi/public-comparison.yaml`, and `packages/contracts/openapi/**` plus its referenced `packages/contracts/jsonschema/**`; it denies every other `apps/core-api` path, `.git`, `.env*`, keys, evidence, fixtures, research/source-materials, uploads, test archives, mobile assets, Terraform state, and every other path. The image test builds from a clean tracked checkout, deletes or mutates each authoritative input in turn and proves generation/build fails, then proves no contract source is copied into the runtime image. Build Next standalone with this exact multi-stage body (the release verifier passes the same locked index digest and checks the resolved amd64 manifest):

Task 10 updates `apps/web/next.config.ts` to keep all existing reviewed settings and add exactly `output: "standalone"` plus `outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url))`; no dynamic environment branch may change either value. A clean monorepo build must produce `.next/standalone/apps/web/server.js`, `.next/static`, and the reviewed `public` tree. Tests delete or relocate each output, change the tracing root, introduce an absolute host path, or include a workspace outside the closed build context and require failure.

```dockerfile
# syntax=docker/dockerfile:1.7.0@sha256:dbbd5e059e8a07ff7ea6233b213b36aa516b4c53c645f1817a4dd18b83cbea56
ARG NODE_IMAGE="docker.io/library/node:24.17-bookworm-slim@sha256:862263c612aa437e3037674b85419622a9d93bff80aa1eee5398dfe686375532"
FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.20.0+sha512.9a6f330a95b66446ea088faf1521405a8a01f07fde7124cc9958dfed52d4bb436737e65b08f85f37b46fcba375092558ac51262b816844b22f63406ed166bfee --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
RUN pnpm install --frozen-lockfile --filter @gc/web... --filter @gc/design-tokens...
COPY apps/web apps/web
COPY packages/design-tokens packages/design-tokens
COPY apps/core-api/src/main/resources/openapi/public-comparison.yaml apps/core-api/src/main/resources/openapi/public-comparison.yaml
COPY packages/contracts/openapi packages/contracts/openapi
COPY packages/contracts/jsonschema packages/contracts/jsonschema
RUN pnpm --filter @gc/design-tokens generate && pnpm --filter @gc/web generate:contracts && pnpm --filter @gc/web build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=65532:65532 /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=65532:65532 /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=65532:65532 /workspace/apps/web/public ./apps/web/public
RUN install -d -o 65532 -g 65532 -m 0700 /var/lib/gc-export-spool
RUN find / -xdev -type f \( -perm -4000 -o -perm -2000 \) -exec chmod a-s {} + \
 && ! find / -xdev -type f \( -perm -4000 -o -perm -2000 \) -print -quit | grep -q .
VOLUME ["/var/lib/gc-export-spool"]
USER 65532:65532
EXPOSE 3000
ENTRYPOINT ["node", "apps/web/server.js"]
```

The verifier proves the build context contains no denied file, the final image uses the UX-owned locked Node linux/amd64 base, runs the exact numeric UID/GID and entrypoint, contains only standalone/static/public output plus the empty pre-owned spool seed directory, declares exactly that one `VOLUME`, and has no source map, package-manager cache, shell-written secret, setuid/setgid file, or other writable application directory. ECS supplies read-only root and dropped supported capabilities; no unsupported Fargate tmpfs or mount-option claim exists. The runtime receives no AWS credential beyond its own task role.

Build the collector with this exact body. Its reference/index/platform tuple comes only from FND root `supply-chain.lock.json.shared_oci_images.otelCollectorContrib`; `supply-chain/ux-images.lock.json` must not duplicate it:

```dockerfile
# syntax=docker/dockerfile:1.7.0@sha256:dbbd5e059e8a07ff7ea6233b213b36aa516b4c53c645f1817a4dd18b83cbea56
ARG COLLECTOR_IMAGE="docker.io/otel/opentelemetry-collector-contrib:0.153.0@sha256:93aad750175cbf1a973ae1c5886c3371f4d800f61be25cdd26870b8441ffe9fa"
FROM ${COLLECTOR_IMAGE}
COPY --chown=10001:10001 collector-config.yaml /etc/otelcol-contrib/config.yaml
USER 10001:10001
EXPOSE 4317 8888
ENTRYPOINT ["/otelcol-contrib"]
CMD ["--config=/etc/otelcol-contrib/config.yaml"]
```

The collector build context is exactly `apps/web`; `collector.Dockerfile.dockerignore` denies everything and re-allows only `collector-config.yaml`. Its clean-checkout test fails if another file enters the context or if the config is missing. The BFF build context remains the repository root because Orval must regenerate from the authoritative FND/REC/PUB schemas copied above.

`collector-config.yaml` has only an OTLP/gRPC receiver on `0.0.0.0:4317` with 1 MiB receive cap; memory limiter; filter/transform processors; a bounded batch; and the AWS EMF/CloudWatch metric exporter through its VPC endpoint. There is exactly one `metrics` pipeline and no logs/traces/profiles pipeline. The filter drops any metric except `gc.public_ux.events`, any attribute key except `event_name|duration_bucket|item_count_bucket`, any event outside `public_comparison_completed|public_source_detail_opened|public_methodology_opened`, any duration outside `absent|lt_10s|10_59s|gte_60s`, and any count outside `absent|0|1|2_5|gte_6`; the transform deletes all resource attributes except fixed `service.name=gc-product-web`, release digest, and environment. Export uses namespace `GenomeCompanion/PublicUX`, fixed dimension set, no high-cardinality rollup, sending queue disabled, retry capped at 5 seconds/30 seconds elapsed, and 2-second timeout. Collector self-telemetry exposes only aggregate accepted/dropped/exporter counters on private TCP 8888. Its collector SG admits 4317 only from the matching-environment BFF SG and admits 8888 only from the exact matching-environment deployment-smoke SG; there is no loopback-only claim, public listener, CloudWatch query permission, or other client/port. The smoke harness reads fixed metric names with a 2-second timeout, records only before/after integer deltas, and rejects reset/wrap/missing/extra labels.

The pinned `awsemf` exporter writes EMF through CloudWatch Logs rather than a generic metric API. Product therefore creates exactly one log group `/gc/ux/<environment>/public-events-emf`, retention 30 days, no subscription/export, and one fixed stream `gc-product-collector-<environment>`; the exporter sets those two names, `namespace: GenomeCompanion/PublicUX`, `dimension_rollup_option: NoDimensionRollup`, `retain_initial_value_of_delta_metric: true`, `log_retention: 0`, and `resource_to_telemetry_conversion.enabled: false`. `skip_create_log_group` is true. The collector task role has only `logs:CreateLogStream|logs:DescribeLogStreams|logs:PutLogEvents` on that exact group/stream through the regional Logs VPC endpoint; it cannot `CreateLogGroup`, write `/metrics/default`, choose another stream/namespace, or read/query logs. The execution role remains separate. Tests run the pinned exporter against a fake Logs API and prove the first sparse delta is retained, the exact EMF namespace/dimensions are produced, and default-group, rollup, extra field, other stream, and direct CloudWatch metric API paths fail.

Deploy it as a **different ECS task/service**, not a sidecar: its ENI, FND-owned security group, execution role, and CloudWatch metric-export task role are distinct. Its private h2c OTLP/gRPC receiver accepts only matching BFF-SG ingress on 4317, and its private HTTP self-metrics endpoint accepts only the matching FND smoke SG on 8888; no public/NAT route exists. The staging BFF receives only `http://product-collector.staging.service.kr.internal:4317`; production receives only `http://product-collector.service.kr.internal:4317`. Each Product live root consumes its exact precreated FND Cloud Map registry ARN and cannot create, update, list, recreate, delete, or write a namespace/service/record. The collector accepts only the closed aggregate schema above, so no personal or health value may rely on transport secrecy. Raw-OTLP adversarial integration runs against the built locked-digest collector and asserts unknown content never reaches the fake/CloudWatch sink; configuration-text inspection alone is insufficient.

Attach the Product services only to the exact FND-owned regional ALB/listener/target-group/Route 53/WAF/SG outputs. Product plans cannot create or mutate those resources or their live pointers. ALB access logs and WAF request logging remain disabled because their fixed records can retain OAuth callback or request metadata; only native aggregate rule/action metrics and the four Product alarms enter the FND observability path. BFF application logs use fixed event codes and never raw URL/header. Private routes return no-store headers end to end. BFF egress is SG-limited to the exact FND private core/C0 listener SGs through the foundation-owned product-web client SG, DynamoDB/Secrets Manager private endpoints, the separate collector SG, and FND's fail-closed Network Firewall/DNS Firewall path for the exact Cognito hosts; it has no API-Gateway upstream, generic NAT, wildcard host, or direct-internet rule. Startup verifies the pinned trust bundle, private endpoints, foundation bindings, spool, and cluster-key evidence and stays unready on drift. Only the collector role exports metrics; alarms use no subject or health dimensions.

The phrase “security-account WAF aggregates” above means only WAF's native CloudWatch rule/action metrics and alarms through the fixed FND cross-account observability contract. Both ALB access logs and WAF request logs remain disabled; no URI, query, header, cookie, client IP, country, fingerprint, or per-request WAF record is retained or exported. Product can configure only fixed metric names/alarms for its two tagged web ACLs and cannot create a request-log destination or weaken this boundary.

- [ ] **Step 5: Fill only the five protected UX release marker blocks**

The Foundation skeleton owns each job, exact tool/credential/setup order, fresh foundation projection, and cross-job outputs. Its pre-marker setup exports `TOFU=$GITHUB_WORKSPACE/build/tools/opentofu/tofu`; every protected marker `init|validate|test|plan|show` invocation uses quoted `"$TOFU"` and never resolves `tofu` through `PATH`. A workflow-source mutation test replaces each quoted invocation in turn with bare `tofu` (and with an alternate absolute path) and requires `verify_workflow_security.py` to reject it before execution. The fixed `ux_handoff` step emits the existing handoff and plan triples; staging exact-fetches the handoff only to derive its nested fault coordinate. The fixed `ux_staging_result` step emits only the verified FND staging-result triple; production exact-fetches that result only to derive its nested handoff and plan-bundle coordinates. Thus the current FND six-output plan seam and three-output staging seam remain unchanged, while both authority calls receive the exact complete chain with no artifact, List/current/latest, or caller-supplied fallback.

```yaml
# BEGIN UX WEB PLAN STEPS
- id: ux_handoff
  name: Build, attest, plan, and publish exact UX handoff
  shell: bash
  run: |
    set -Eeuo pipefail
    umask 077
    test -z "$(git status --porcelain=v1 --untracked-files=all)"
    test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
    mkdir -p build/ux-plan build/ux-release-inputs
    python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release --check
    product_python() { python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python "$@"; }
    product_python scripts/ci/verify_signed_release_tag.py --tag "$GITHUB_REF_NAME" --source-sha "$GITHUB_SHA" --registry governance/release/allowed-tag-signers.json --out build/ux-plan/tag-verification.json
    product_python scripts/release/build_product_web_deploy_harness.py --source infra/functions/product-web-deploy-harness --out build/ux-release-inputs/product-web-deploy-harness.zip --manifest-out build/ux-plan/product-web-deploy-harness.json
    corepack enable
    corepack prepare pnpm@11.20.0+sha512.9a6f330a95b66446ea088faf1521405a8a01f07fde7124cc9958dfed52d4bb436737e65b08f85f37b46fcba375092558ac51262b816844b22f63406ed166bfee --activate
    test "$(pnpm --version)" = "11.20.0"
    pnpm install --frozen-lockfile
    pnpm --filter @gc/design-tokens generate
    pnpm --filter @gc/design-tokens test
    pnpm --filter @gc/web generate:contracts
    git diff --exit-code packages/design-tokens/dist apps/web/lib/api/generated
    pnpm --filter @gc/web test
    pnpm --filter @gc/web build
    pnpm --filter @gc/web build-storybook --quiet
    pnpm --filter @gc/web exec playwright install --with-deps chromium
    pnpm --filter @gc/web exec playwright test
    bash scripts/ci/install_security_tools.sh
    python scripts/ci/install_cosign.py --destination build/tools/cosign
    COSIGN="$PWD/build/tools/cosign/cosign"
    test -x "$COSIGN"
    test "$("$COSIGN" version --json | python -c 'import json,sys; print(json.load(sys.stdin)["gitVersion"])')" = 'v3.0.6'
    build/tools/security/gitleaks detect --no-banner --redact --exit-code 1 --source .
    build/tools/security/trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --exit-code 1 --format json --output build/ux-plan/repository-trivy.json .
    REGISTRY="${UX_WEB_REPOSITORY_URL%%/*}"
    test "$REGISTRY" = "${UX_COLLECTOR_REPOSITORY_URL%%/*}"
    export DOCKER_CONFIG="$RUNNER_TEMP/gc-ux-docker-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
    case "$DOCKER_CONFIG" in "$RUNNER_TEMP"/gc-ux-docker-*) ;; *) exit 1 ;; esac
    install -d -m 0700 "$DOCKER_CONFIG"
    cleanup_docker_auth() {
      docker logout "$REGISTRY" >/dev/null 2>&1 || true
      rm -rf -- "$DOCKER_CONFIG"
    }
    trap cleanup_docker_auth EXIT
    product_python scripts/release/product_web_release.py ecr-login-password --registry "$REGISTRY" | docker login --username AWS --password-stdin "$REGISTRY"
    test -f "$DOCKER_CONFIG/config.json"
    ! grep -Eq 'credsStore|credHelpers' "$DOCKER_CONFIG/config.json"
    IMAGE_TAG="plan-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
    test -x "$DOCKER_CLI_PLUGIN_EXTRA_DIRS/docker-buildx"
    test -f build/tools/buildkit-index.json
    docker buildx build --builder gc-ux-plan --platform linux/amd64 --pull --metadata-file build/ux-plan/bff-build-metadata.json --tag "$UX_WEB_REPOSITORY_URL:$IMAGE_TAG" --push -f apps/web/Dockerfile .
    docker buildx build --builder gc-ux-plan --platform linux/amd64 --pull --metadata-file build/ux-plan/collector-build-metadata.json --tag "$UX_COLLECTOR_REPOSITORY_URL:$IMAGE_TAG" --push -f apps/web/collector.Dockerfile apps/web
    product_python scripts/release/verify_product_web_image.py record --role bff --repository "$UX_WEB_REPOSITORY_URL" --tag "$IMAGE_TAG" --metadata build/ux-plan/bff-build-metadata.json --lock supply-chain/ux-images.lock.json --buildx "$DOCKER_CLI_PLUGIN_EXTRA_DIRS/docker-buildx" --buildkit-index build/tools/buildkit-index.json --dockerfile-frontend-index sha256:dbbd5e059e8a07ff7ea6233b213b36aa516b4c53c645f1817a4dd18b83cbea56 --dockerfile-frontend-linux-amd64 sha256:4611ea7b7d89ce41ec5c63df83076ccec3fe8daa32a2d9c96e5decb72e9a8d67 --out build/ux-plan/bff-image.json
    product_python scripts/release/verify_product_web_image.py record --role collector --repository "$UX_COLLECTOR_REPOSITORY_URL" --tag "$IMAGE_TAG" --metadata build/ux-plan/collector-build-metadata.json --lock supply-chain.lock.json --shared-entry otelCollectorContrib --buildx "$DOCKER_CLI_PLUGIN_EXTRA_DIRS/docker-buildx" --buildkit-index build/tools/buildkit-index.json --dockerfile-frontend-index sha256:dbbd5e059e8a07ff7ea6233b213b36aa516b4c53c645f1817a4dd18b83cbea56 --dockerfile-frontend-linux-amd64 sha256:4611ea7b7d89ce41ec5c63df83076ccec3fe8daa32a2d9c96e5decb72e9a8d67 --out build/ux-plan/collector-image.json
    BFF_REF="$(product_python scripts/release/product_web_release.py image-ref --record build/ux-plan/bff-image.json)"
    COLLECTOR_REF="$(product_python scripts/release/product_web_release.py image-ref --record build/ux-plan/collector-image.json)"
    build/tools/security/trivy image --severity HIGH,CRITICAL --exit-code 1 --format cyclonedx --output build/ux-plan/bff.cdx.json "$BFF_REF"
    build/tools/security/trivy image --severity HIGH,CRITICAL --exit-code 1 --format cyclonedx --output build/ux-plan/collector.cdx.json "$COLLECTOR_REF"
    product_python scripts/release/product_web_release.py provenance --role bff --source-sha "$GITHUB_SHA" --image-record build/ux-plan/bff-image.json --sbom build/ux-plan/bff.cdx.json --owner-lock supply-chain/ux-images.lock.json --buildx "$DOCKER_CLI_PLUGIN_EXTRA_DIRS/docker-buildx" --buildkit-index build/tools/buildkit-index.json --out build/ux-plan/bff-provenance.json
    product_python scripts/release/product_web_release.py provenance --role collector --source-sha "$GITHUB_SHA" --image-record build/ux-plan/collector-image.json --sbom build/ux-plan/collector.cdx.json --owner-lock supply-chain.lock.json --shared-entry otelCollectorContrib --buildx "$DOCKER_CLI_PLUGIN_EXTRA_DIRS/docker-buildx" --buildkit-index build/tools/buildkit-index.json --out build/ux-plan/collector-provenance.json
    "$COSIGN" sign --yes --new-bundle-format=true --use-signing-config=true --bundle build/ux-plan/bff-signature.bundle "$BFF_REF"
    "$COSIGN" attest --yes --new-bundle-format=true --use-signing-config=true --bundle build/ux-plan/bff-provenance.bundle --predicate build/ux-plan/bff-provenance.json --type slsaprovenance "$BFF_REF"
    "$COSIGN" sign --yes --new-bundle-format=true --use-signing-config=true --bundle build/ux-plan/collector-signature.bundle "$COLLECTOR_REF"
    "$COSIGN" attest --yes --new-bundle-format=true --use-signing-config=true --bundle build/ux-plan/collector-provenance.bundle --predicate build/ux-plan/collector-provenance.json --type slsaprovenance "$COLLECTOR_REF"
    cmp --silent infra/modules/product-web/.terraform.lock.hcl infra/live/product-web-staging/.terraform.lock.hcl
    cmp --silent infra/modules/product-web/.terraform.lock.hcl infra/live/product-web-prod/.terraform.lock.hcl
    python -m unittest scripts.tests.test_build_product_provider_mirror -v
    python scripts/ci/build_product_provider_mirror.py --destination build/ux-plan/provider-mirror
    test -f build/ux-plan/provider-mirror/product-web-linux-amd64.zip
    test -f build/ux-plan/provider-mirror/provider-mirror-receipt.json
    for ROOT in infra/live/product-web-staging infra/live/product-web-prod; do
      test "$(sha256sum "$ROOT/.terraform.lock.hcl" | cut -d' ' -f1)" = "$(sha256sum infra/modules/product-web/.terraform.lock.hcl | cut -d' ' -f1)"
      "$TOFU" -chdir="$ROOT" init -input=false -lockfile=readonly -backend-config="bucket=$UX_WEB_BACKEND_BUCKET_NAME" -backend-config="dynamodb_table=$UX_WEB_BACKEND_LOCK_TABLE_NAME"
      "$TOFU" -chdir="$ROOT" validate
    done
    "$TOFU" -chdir=infra/modules/product-web init -backend=false -lockfile=readonly
    "$TOFU" -chdir=infra/modules/product-web test
    for NAME in APPLICATION_PRIVATE_SUBNET_IDS APPLICATION_EDGE_SUBNET_IDS APPLICATION_NETWORK_FIREWALL_ENDPOINT_IDS APPLICATION_ALLOWED_TLS_SNI; do
      python scripts/ci/run_locked_uv.py -- run --project infra/functions/private-identity-rotation --frozen python scripts/release/foundation_output_snapshot.py read-array --projection build/foundation/ux-output-projection.json --environment-name "$NAME" --out "build/ux-plan/${NAME}.json"
    done
    product_python scripts/release/product_web_release.py plan-vars --foundation-projection build/foundation/ux-output-projection.json --foundation-coordinate build/foundation/foundation-output-snapshot.coordinate.json --application-private-subnet-ids build/ux-plan/APPLICATION_PRIVATE_SUBNET_IDS.json --application-edge-subnet-ids build/ux-plan/APPLICATION_EDGE_SUBNET_IDS.json --network-firewall-endpoint-ids build/ux-plan/APPLICATION_NETWORK_FIREWALL_ENDPOINT_IDS.json --allowed-tls-sni build/ux-plan/APPLICATION_ALLOWED_TLS_SNI.json --bff-record build/ux-plan/bff-image.json --collector-record build/ux-plan/collector-image.json --deployment-harness build/ux-release-inputs/product-web-deploy-harness.zip --staging-fault-mode upstream_5xx_once --out build/ux-plan/release.auto.tfvars.json
    product_python scripts/release/product_web_release.py capture-state --environment staging --live-root infra/live/product-web-staging --out build/ux-plan/staging-prior-state.json
    product_python scripts/release/product_web_release.py capture-state --environment production --live-root infra/live/product-web-prod --out build/ux-plan/production-prior-state.json
    "$TOFU" -chdir=infra/live/product-web-staging plan -input=false -lock=true -var-file=../../../build/ux-plan/release.auto.tfvars.json -out=../../../build/ux-plan/staging.tfplan
    "$TOFU" -chdir=infra/live/product-web-prod plan -input=false -lock=true -var-file=../../../build/ux-plan/release.auto.tfvars.json -out=../../../build/ux-plan/production.tfplan
    "$TOFU" -chdir=infra/live/product-web-staging show -json ../../../build/ux-plan/staging.tfplan > build/ux-plan/staging.show.json
    "$TOFU" -chdir=infra/live/product-web-prod show -json ../../../build/ux-plan/production.tfplan > build/ux-plan/production.show.json
    product_python scripts/release/product_web_release.py verify-plan --environment staging --show build/ux-plan/staging.show.json --prior-state build/ux-plan/staging-prior-state.json --out build/ux-plan/staging-policy.json --postconditions-out build/ux-plan/staging-postconditions.json
    product_python scripts/release/product_web_release.py verify-plan --environment production --show build/ux-plan/production.show.json --prior-state build/ux-plan/production-prior-state.json --out build/ux-plan/production-policy.json --postconditions-out build/ux-plan/production-postconditions.json
    product_python scripts/release/product_web_release.py build-plan-bundle --tag-verification build/ux-plan/tag-verification.json --foundation-coordinate build/foundation/foundation-output-snapshot.coordinate.json --terraform-lock infra/live/product-web-staging/.terraform.lock.hcl --deployment-harness build/ux-release-inputs/product-web-deploy-harness.zip --provider-mirror build/ux-plan/provider-mirror/product-web-linux-amd64.zip --provider-mirror-receipt build/ux-plan/provider-mirror/provider-mirror-receipt.json --staging-fault-mode upstream_5xx_once --staging-plan build/ux-plan/staging.tfplan --staging-show build/ux-plan/staging.show.json --staging-policy build/ux-plan/staging-policy.json --staging-prior-state build/ux-plan/staging-prior-state.json --staging-postconditions build/ux-plan/staging-postconditions.json --production-plan build/ux-plan/production.tfplan --production-show build/ux-plan/production.show.json --production-policy build/ux-plan/production-policy.json --production-prior-state build/ux-plan/production-prior-state.json --production-postconditions build/ux-plan/production-postconditions.json --out build/ux-plan/plan-bundle.json --coordinate-out build/ux-plan/plan-bundle.coordinate.json
    product_python scripts/release/product_web_release.py build-staging-fault-request --source-sha "$GITHUB_SHA" --plan-bundle build/ux-plan/plan-bundle.json --fault-mode upstream_5xx_once --max-fault-seconds 30 --out build/ux-plan/staging-fault-request.json --coordinate-out build/ux-plan/staging-fault-request.coordinate.json
    product_python scripts/release/product_web_release.py build-handoff --tag-verification build/ux-plan/tag-verification.json --foundation-coordinate build/foundation/foundation-output-snapshot.coordinate.json --terraform-lock infra/live/product-web-staging/.terraform.lock.hcl --plan-bundle build/ux-plan/plan-bundle.coordinate.json --staging-fault build/ux-plan/staging-fault-request.coordinate.json --bff-record build/ux-plan/bff-image.json --bff-signature build/ux-plan/bff-signature.bundle --bff-attestation build/ux-plan/bff-provenance.bundle --bff-sbom build/ux-plan/bff.cdx.json --bff-provenance build/ux-plan/bff-provenance.json --collector-record build/ux-plan/collector-image.json --collector-signature build/ux-plan/collector-signature.bundle --collector-attestation build/ux-plan/collector-provenance.bundle --collector-sbom build/ux-plan/collector.cdx.json --collector-provenance build/ux-plan/collector-provenance.json --out build/ux-plan/handoff.json --coordinate-out build/ux-plan/handoff.coordinate.json
    product_python scripts/release/product_web_release.py emit-coordinate --coordinate build/ux-plan/handoff.coordinate.json --github-output "$GITHUB_OUTPUT" --prefix handoff
    product_python scripts/release/product_web_release.py emit-coordinate --coordinate build/ux-plan/plan-bundle.coordinate.json --github-output "$GITHUB_OUTPUT" --prefix plan
# END UX WEB PLAN STEPS
```

`verify-plan` accepts only the two closed live roots. Its exact per-environment allowlist is the FND-frozen Product set: two ECS task definitions, qualified smoke Lambda function/alias, session table/runtime CMK and alias, fixed application/EMF log groups, and four aggregate alarms. Every ECS service, edge/listener/target-group/SG/WAF/DNS/Cloud Map/IAM/state-machine/fence/authority/backend/repository/evidence resource is an immutable input and forbidden plan address; live pointers are never planned. It rejects every provisioner, executable provider/hook, unapproved data source, mutable tag, cross-environment binding, public task IP, or trust/session/spool weakening and parses the full configuration tree. The FND builder creates the official unchanged linux/amd64 AWS-provider ZIP from the byte-equal locks; Product verifies the builder tests/receipt, and `build-plan-bundle` conditionally uploads that exact ZIP first at `providers/product-web-linux-amd64.zip`, captures its VersionId/SHA-256, and binds that byte-identical coordinate into both plan rows before uploading the harness and plans. `build-handoff` exact-fetches all image/bundle inputs before its one Object-Lock write. The plan role cannot apply or mutate ECS/ELB; duplicate/repacked provider ownership fails.

```yaml
# BEGIN UX WEB STAGING STEPS
- id: ux_staging_result
  name: Invoke and verify the exact FND staging authority
  shell: bash
  run: |
    set -Eeuo pipefail
    umask 077
    mkdir -p build/ux-staging/authority
    python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release --check
    python scripts/ci/run_locked_uv.py -- lock --project infra/ux-deployment-authority --check
    product_python() { python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python "$@"; }
    authority_python() { python scripts/ci/run_locked_uv.py -- run --project infra/ux-deployment-authority --frozen python "$@"; }
    product_python scripts/release/product_web_release.py write-coordinate --key "$UX_HANDOFF_KEY" --version-id "$UX_HANDOFF_VERSION_ID" --sha256 "$UX_HANDOFF_SHA256" --out build/ux-staging/handoff.coordinate.json
    product_python scripts/release/product_web_release.py write-coordinate --key "$UX_PLAN_KEY" --version-id "$UX_PLAN_VERSION_ID" --sha256 "$UX_PLAN_SHA256" --out build/ux-staging/plan-bundle.coordinate.json
    product_python scripts/release/product_web_release.py extract-handoff-fault --handoff-coordinate build/ux-staging/handoff.coordinate.json --foundation-projection build/foundation/ux-output-projection.json --out build/ux-staging/fault.coordinate.json
    authority_python scripts/release/ux_deployment_authority.py stage --handoff-coordinate build/ux-staging/handoff.coordinate.json --plan-bundle-coordinate build/ux-staging/plan-bundle.coordinate.json --foundation-snapshot-coordinate build/foundation/foundation-output-snapshot.coordinate.json --fault-coordinate build/ux-staging/fault.coordinate.json --out-dir build/ux-staging/authority
    product_python scripts/release/product_web_release.py emit-coordinate --coordinate build/ux-staging/authority/staging-result.coordinate.json --github-output "$GITHUB_OUTPUT" --prefix staging_result
# END UX WEB STAGING STEPS
```

The FND client constructs the exact staging authority request, starts/describes only `ux_web_staging_deployment_state_machine_arn`, and exact-fetches/verifies the returned authority result, apply receipt, deployment result, and `ux-staging-result.v1`. The FND state machine alone applies or recovers the saved plan, owns the fence, shifts staging 5% then 25% then 100%, runs aggregate smokes and the bounded `upstream_5xx_once` rollback drill, restores the exact prior live pointers on failure, and writes terminal evidence. Product receives only the verified staging-result coordinate and never touches production state or either live pointer.

```yaml
# BEGIN UX WEB RELEASE STEPS
- name: Invoke and verify the exact FND production authority
  shell: bash
  run: |
    set -Eeuo pipefail
    umask 077
    mkdir -p build/ux-release/authority
    python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release --check
    python scripts/ci/run_locked_uv.py -- lock --project infra/ux-deployment-authority --check
    product_python() { python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python "$@"; }
    authority_python() { python scripts/ci/run_locked_uv.py -- run --project infra/ux-deployment-authority --frozen python "$@"; }
    product_python scripts/release/product_web_release.py write-coordinate --key "$UX_STAGING_RESULT_KEY" --version-id "$UX_STAGING_RESULT_VERSION_ID" --sha256 "$UX_STAGING_RESULT_SHA256" --out build/ux-release/staging-result.coordinate.json
    product_python scripts/release/product_web_release.py extract-staging-chain --staging-result-coordinate build/ux-release/staging-result.coordinate.json --foundation-projection build/foundation/ux-output-projection.json --handoff-out build/ux-release/handoff.coordinate.json --plan-bundle-out build/ux-release/plan-bundle.coordinate.json
    authority_python scripts/release/ux_deployment_authority.py promote --handoff-coordinate build/ux-release/handoff.coordinate.json --plan-bundle-coordinate build/ux-release/plan-bundle.coordinate.json --foundation-snapshot-coordinate build/foundation/foundation-output-snapshot.coordinate.json --staging-result-coordinate build/ux-release/staging-result.coordinate.json --out-dir build/ux-release/authority
    test -f build/ux-release/authority/result.json
    test -f build/ux-release/authority/deployment-result.coordinate.json
# END UX WEB RELEASE STEPS
```

Production passes the exact plan handoff plus the exact FND staging-result coordinate to the FND client. The client rebuilds the exact `operation="promote"` request, starts/describes only `ux_web_production_deployment_state_machine_arn`, and exact-fetches/verifies the authority result and nested receipt/deployment result. The FND state machine alone applies or recovers the production saved plan, owns the production fence, smokes and shifts the live pointer, restores on catch/timeout, and writes terminal evidence. Caller loss reruns the deterministic client against the same execution; no Product resume mode or second state machine exists. The protected `production-kr` approval authorizes only these already bound bytes.

`build_product_web_deploy_harness.py` produces a deterministic Python 3.12 ZIP from the one Product smoke handler and records file/digest/runtime metadata. The saved plan may create/update only the qualified function/alias from that ZIP; it creates no coordinator. The Lambda receives only FND state-machine-written request context and fixed environment resource IDs. Its closed modes are `smoke|assert-state`; it sends hard-coded synthetic requests, validates only aggregate shapes and collector deltas, and returns bounded aggregate booleans/digests—never bodies, tokens, cookies, URLs, headers, identifiers, fact values, terminal bytes, or a callback token. The FND-owned smoke role can connect only to its environment BFF/collector SGs and write no object. Only the FND state-machine role invokes the alias and writes deployment/staging/authority results; Product does not own the state-machine definition, fence, result builder, role policy, or failure branches.

For Android, replace the generated debug-signing fallback with this exact release boundary; the test parses the Gradle model as well as the source, so merely matching text does not pass:

```kotlin
android {
    flavorDimensions += "distribution"
    productFlavors {
        create("candidate") { dimension = "distribution" }
    }
    buildTypes {
        getByName("release") { signingConfig = null }
    }
}

androidComponents.beforeVariants(androidComponents.selector().withBuildType("release")) { variant ->
    variant.enable = variant.productFlavors == listOf("distribution" to "candidate")
}

dependencyLocking { lockAllConfigurations() }
```

There is exactly one `candidate` distribution flavor, every other release variant is disabled, and the release build contains no keystore path, `signing.properties`, environment lookup, upload key, or debug-signing fallback. The artifact path is fixed by AGP/Flutter and verified rather than searched. For iOS, the macOS image must expose CocoaPods exactly `1.16.2` and `Podfile.lock` pins the resolved native graph; a runner-image drift fails before installation. The job has no keychain-import, certificate/profile download, automatic signing, development team, or export/upload command. Fill the mobile markers exactly:

The emulator integration run uses only `candidateDebug`, signed by the ephemeral standard debug key solely so Android can install it; its evidence is test-only and that APK is never uploaded. The separately built `candidateRelease` AAB has `signingConfig=null` and is the only Android candidate artifact. Likewise, the iOS simulator integration runs Debug because simulators cannot run a Release-mode Flutter test; only the subsequent generic-device Release `.xcarchive` is candidate evidence, and it is audited no-codesign.

```yaml
# BEGIN UX ANDROID RELEASE STEPS
- name: Build and audit unsigned Android candidate
  shell: bash
  run: |
    set -Eeuo pipefail
    umask 077
    mkdir -p build/mobile
    python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release --check
    product_python() { python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python "$@"; }
    python scripts/ci/install_bundletool.py --destination build/tools/bundletool
    BUNDLETOOL_JAR=build/tools/bundletool/bundletool-all-1.18.1.jar
    test -n "${ANDROID_SDK_ROOT:-}" && test -n "${ANDROID_AVD_HOME:-}"
    test "$ANDROID_HOME" = "$ANDROID_SDK_ROOT"
    test -f "$ANDROID_SDK_ROOT/android-sdk-install-receipt.json"
    EMULATOR="$ANDROID_SDK_ROOT/emulator/emulator"
    ADB="$ANDROID_SDK_ROOT/platform-tools/adb"
    test -x "$EMULATOR" && test -x "$ADB"
    product_python scripts/release/build_mobile_candidate_manifest.py toolchain --platform android --foundation-lock supply-chain/tool-artifacts.lock.json --foundation-install-receipt "$ANDROID_SDK_ROOT/android-sdk-install-receipt.json" --bundletool "$BUNDLETOOL_JAR" --out build/mobile/android-toolchain.json
    product_python scripts/release/build_mobile_candidate_manifest.py build-identity --platform android --source-sha "$GITHUB_SHA" --native-components apps/mobile/native-components.lock.json --dependency-lock apps/mobile/pubspec.lock --dependency-lock apps/mobile/android/gradle.lockfile --dependency-lock apps/mobile/android/gradle/verification-metadata.xml --dependency-lock apps/mobile/android/gradle.properties --toolchain-manifest build/mobile/android-toolchain.json --out apps/mobile/assets/generated/release-build-identity.json
    nohup "$EMULATOR" -avd gc_api35 -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect > "$RUNNER_TEMP/gc-emulator.log" 2>&1 &
    EMULATOR_PID=$!
    cleanup_android_emulator() {
      "$ADB" -s emulator-5554 emu kill >/dev/null 2>&1 || true
      kill "$EMULATOR_PID" >/dev/null 2>&1 || true
    }
    trap cleanup_android_emulator EXIT
    if ! timeout 300 "$ADB" wait-for-device; then tail -c 65536 "$RUNNER_TEMP/gc-emulator.log" >&2; exit 1; fi
    BOOT_DEADLINE=$((SECONDS + 300))
    until test "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1; do
      if test "$SECONDS" -ge "$BOOT_DEADLINE"; then tail -c 65536 "$RUNNER_TEMP/gc-emulator.log" >&2; exit 1; fi
      sleep 2
    done
    pushd apps/mobile
    flutter pub get --enforce-lockfile
    flutter analyze --fatal-infos
    flutter test 2>&1 | tee ../../build/mobile/android-unit.log
    flutter test integration_test/record_export_verifier_test.dart -d emulator-5554 --flavor candidate --dart-define=GC_REQUIRE_RELEASE_BUILD_IDENTITY=1 2>&1 | tee ../../build/mobile/android-integration.log
    flutter pub deps --json > ../../build/mobile/android-dart-deps.json
    ./android/gradlew -p android --dependency-verification strict :app:dependencies
    flutter build appbundle --release --flavor candidate
    git diff --exit-code pubspec.lock android/gradle.lockfile android/gradle/verification-metadata.xml android/gradle.properties android/app/build.gradle.kts
    popd
    java -jar "$BUNDLETOOL_JAR" validate --bundle apps/mobile/build/app/outputs/bundle/candidateRelease/app-candidate-release.aab
    java -jar "$BUNDLETOOL_JAR" dump manifest --bundle apps/mobile/build/app/outputs/bundle/candidateRelease/app-candidate-release.aab > build/mobile/android-aab-manifest.xml
    product_python scripts/release/build_mobile_candidate_manifest.py test-evidence --platform android --source-sha "$GITHUB_SHA" --native-components apps/mobile/native-components.lock.json --build-identity apps/mobile/assets/generated/release-build-identity.json --dependency-lock apps/mobile/pubspec.lock --dependency-lock apps/mobile/android/gradle.lockfile --dependency-lock apps/mobile/android/gradle/verification-metadata.xml --dependency-lock apps/mobile/android/gradle.properties --toolchain-manifest build/mobile/android-toolchain.json --bundletool "$BUNDLETOOL_JAR" --log build/mobile/android-unit.log --log build/mobile/android-integration.log --out build/mobile/android-tests.json
    product_python scripts/release/verify_mobile_release.py android --artifact apps/mobile/build/app/outputs/bundle/candidateRelease/app-candidate-release.aab --bundletool "$BUNDLETOOL_JAR" --manifest-dump build/mobile/android-aab-manifest.xml --application-id kr.co.genomecompanion.mobile --native-components apps/mobile/native-components.lock.json --build-identity apps/mobile/assets/generated/release-build-identity.json --test-evidence build/mobile/android-tests.json --require-unsigned
    product_python scripts/release/build_mobile_candidate_manifest.py sbom --platform android --dart-deps build/mobile/android-dart-deps.json --dependency-lock apps/mobile/pubspec.lock --dependency-lock apps/mobile/android/gradle.lockfile --dependency-lock apps/mobile/android/gradle/verification-metadata.xml --dependency-lock apps/mobile/android/gradle.properties --toolchain-manifest build/mobile/android-toolchain.json --out build/mobile/android.cdx.json
    product_python scripts/release/build_mobile_candidate_manifest.py provenance --platform android --source-sha "$GITHUB_SHA" --artifact apps/mobile/build/app/outputs/bundle/candidateRelease/app-candidate-release.aab --native-components apps/mobile/native-components.lock.json --build-identity apps/mobile/assets/generated/release-build-identity.json --dependency-lock apps/mobile/pubspec.lock --dependency-lock apps/mobile/android/gradle.lockfile --dependency-lock apps/mobile/android/gradle/verification-metadata.xml --dependency-lock apps/mobile/android/gradle.properties --toolchain-manifest build/mobile/android-toolchain.json --sbom build/mobile/android.cdx.json --test-evidence build/mobile/android-tests.json --out build/mobile/android-provenance.json
    product_python scripts/release/build_mobile_candidate_manifest.py build --platform android --source-sha "$GITHUB_SHA" --artifact apps/mobile/build/app/outputs/bundle/candidateRelease/app-candidate-release.aab --upload-envelope apps/mobile/build/app/outputs/bundle/candidateRelease/app-candidate-release.aab --native-components apps/mobile/native-components.lock.json --build-identity apps/mobile/assets/generated/release-build-identity.json --dependency-lock apps/mobile/pubspec.lock --dependency-lock apps/mobile/android/gradle.lockfile --dependency-lock apps/mobile/android/gradle/verification-metadata.xml --dependency-lock apps/mobile/android/gradle.properties --record-export-registry apps/mobile/assets/record-export-key-registry.json --native-assets apps/mobile/assets/native-asset-manifest.json --models apps/mobile/assets/local-template-manifest.json --toolchain-manifest build/mobile/android-toolchain.json --sbom build/mobile/android.cdx.json --provenance build/mobile/android-provenance.json --test-evidence build/mobile/android-tests.json --out build/mobile/android-candidate-manifest.json
    product_python scripts/release/verify_mobile_release.py manifest --manifest build/mobile/android-candidate-manifest.json --artifact apps/mobile/build/app/outputs/bundle/candidateRelease/app-candidate-release.aab --upload-envelope apps/mobile/build/app/outputs/bundle/candidateRelease/app-candidate-release.aab --sbom build/mobile/android.cdx.json --provenance build/mobile/android-provenance.json --test-evidence build/mobile/android-tests.json
- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
  with:
    name: ux-android-unsigned-candidate-${{ github.sha }}
    path: |
      apps/mobile/build/app/outputs/bundle/candidateRelease/app-candidate-release.aab
      build/mobile/android-candidate-manifest.json
      build/mobile/android.cdx.json
      build/mobile/android-provenance.json
      build/mobile/android-tests.json
      build/mobile/android-toolchain.json
    if-no-files-found: error
    retention-days: 7
    compression-level: 0
    overwrite: false
# END UX ANDROID RELEASE STEPS

# BEGIN UX IOS RELEASE STEPS
- name: Build and audit no-codesign iOS candidate
  shell: bash
  run: |
    set -Eeuo pipefail
    umask 077
    mkdir -p build/mobile
    python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release --check
    product_python() { python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python "$@"; }
    product_python scripts/release/build_mobile_candidate_manifest.py toolchain --platform ios --pod-artifacts-lock apps/mobile/ios/Pod-artifacts.lock.json --out build/mobile/ios-toolchain.json
    product_python scripts/release/build_mobile_candidate_manifest.py build-identity --platform ios --source-sha "$GITHUB_SHA" --native-components apps/mobile/native-components.lock.json --dependency-lock apps/mobile/pubspec.lock --dependency-lock apps/mobile/ios/Podfile.lock --dependency-lock apps/mobile/ios/Pod-artifacts.lock.json --toolchain-manifest build/mobile/ios-toolchain.json --out apps/mobile/assets/generated/release-build-identity.json
    DEVICE_UDID="$(xcrun simctl create gc-iphone16 com.apple.CoreSimulator.SimDeviceType.iPhone-16 com.apple.CoreSimulator.SimRuntime.iOS-18-5)"
    trap 'xcrun simctl shutdown "$DEVICE_UDID" >/dev/null 2>&1 || true; xcrun simctl delete "$DEVICE_UDID" >/dev/null 2>&1 || true' EXIT
    xcrun simctl boot "$DEVICE_UDID"
    xcrun simctl bootstatus "$DEVICE_UDID" -b
    pushd apps/mobile
    flutter pub get --enforce-lockfile
    flutter analyze --fatal-infos
    flutter test 2>&1 | tee ../../build/mobile/ios-unit.log
    flutter test integration_test/record_export_verifier_test.dart -d "$DEVICE_UDID" --dart-define=GC_REQUIRE_RELEASE_BUILD_IDENTITY=1 2>&1 | tee ../../build/mobile/ios-integration.log
    flutter pub deps --json > ../../build/mobile/ios-dart-deps.json
    test "$(pod --version)" = "1.16.2"
    flutter build ios --release --no-codesign --config-only
    pod install --project-directory=ios --deployment
    popd
    product_python scripts/release/verify_cocoapods_artifacts.py --podfile-lock apps/mobile/ios/Podfile.lock --sandbox-manifest apps/mobile/ios/Pods/Manifest.lock --artifact-lock apps/mobile/ios/Pod-artifacts.lock.json --pods-root apps/mobile/ios/Pods
    pushd apps/mobile
    xcodebuild -workspace ios/Runner.xcworkspace -scheme Runner -configuration Release -destination 'generic/platform=iOS' -archivePath "$PWD/build/ios/archive/Runner.xcarchive" archive CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" EXPANDED_CODE_SIGN_IDENTITY="" PROVISIONING_PROFILE_SPECIFIER="" DEVELOPMENT_TEAM=""
    git diff --exit-code pubspec.lock ios/Podfile.lock ios/Pod-artifacts.lock.json
    popd
    product_python scripts/release/build_mobile_candidate_manifest.py test-evidence --platform ios --source-sha "$GITHUB_SHA" --native-components apps/mobile/native-components.lock.json --build-identity apps/mobile/assets/generated/release-build-identity.json --dependency-lock apps/mobile/pubspec.lock --dependency-lock apps/mobile/ios/Podfile.lock --dependency-lock apps/mobile/ios/Pod-artifacts.lock.json --toolchain-manifest build/mobile/ios-toolchain.json --log build/mobile/ios-unit.log --log build/mobile/ios-integration.log --out build/mobile/ios-tests.json
    product_python scripts/release/verify_mobile_release.py ios --artifact apps/mobile/build/ios/archive/Runner.xcarchive --application-id kr.co.genomecompanion.mobile --native-components apps/mobile/native-components.lock.json --build-identity apps/mobile/assets/generated/release-build-identity.json --test-evidence build/mobile/ios-tests.json --require-no-codesign
    product_python scripts/release/build_mobile_candidate_manifest.py sbom --platform ios --dart-deps build/mobile/ios-dart-deps.json --dependency-lock apps/mobile/pubspec.lock --dependency-lock apps/mobile/ios/Podfile.lock --dependency-lock apps/mobile/ios/Pod-artifacts.lock.json --toolchain-manifest build/mobile/ios-toolchain.json --out build/mobile/ios.cdx.json
    product_python scripts/release/build_mobile_candidate_manifest.py provenance --platform ios --source-sha "$GITHUB_SHA" --artifact apps/mobile/build/ios/archive/Runner.xcarchive --native-components apps/mobile/native-components.lock.json --build-identity apps/mobile/assets/generated/release-build-identity.json --dependency-lock apps/mobile/pubspec.lock --dependency-lock apps/mobile/ios/Podfile.lock --dependency-lock apps/mobile/ios/Pod-artifacts.lock.json --toolchain-manifest build/mobile/ios-toolchain.json --sbom build/mobile/ios.cdx.json --test-evidence build/mobile/ios-tests.json --out build/mobile/ios-provenance.json
    COPYFILE_DISABLE=1 ditto --norsrc -c -k --keepParent apps/mobile/build/ios/archive/Runner.xcarchive build/mobile/Runner.xcarchive.zip
    product_python scripts/release/build_mobile_candidate_manifest.py build --platform ios --source-sha "$GITHUB_SHA" --artifact apps/mobile/build/ios/archive/Runner.xcarchive --upload-envelope build/mobile/Runner.xcarchive.zip --native-components apps/mobile/native-components.lock.json --build-identity apps/mobile/assets/generated/release-build-identity.json --dependency-lock apps/mobile/pubspec.lock --dependency-lock apps/mobile/ios/Podfile.lock --dependency-lock apps/mobile/ios/Pod-artifacts.lock.json --record-export-registry apps/mobile/assets/record-export-key-registry.json --native-assets apps/mobile/assets/native-asset-manifest.json --models apps/mobile/assets/local-template-manifest.json --toolchain-manifest build/mobile/ios-toolchain.json --sbom build/mobile/ios.cdx.json --provenance build/mobile/ios-provenance.json --test-evidence build/mobile/ios-tests.json --out build/mobile/ios-candidate-manifest.json
    product_python scripts/release/verify_mobile_release.py manifest --manifest build/mobile/ios-candidate-manifest.json --artifact apps/mobile/build/ios/archive/Runner.xcarchive --upload-envelope build/mobile/Runner.xcarchive.zip --sbom build/mobile/ios.cdx.json --provenance build/mobile/ios-provenance.json --test-evidence build/mobile/ios-tests.json
- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
  with:
    name: ux-ios-no-codesign-candidate-${{ github.sha }}
    path: |
      build/mobile/Runner.xcarchive.zip
      build/mobile/ios-candidate-manifest.json
      build/mobile/ios.cdx.json
      build/mobile/ios-provenance.json
      build/mobile/ios-tests.json
      build/mobile/ios-toolchain.json
    if-no-files-found: error
    retention-days: 7
    compression-level: 0
    overwrite: false
# END UX IOS RELEASE STEPS
```

The mobile verifier requires the exact application/bundle ID, schema/self-digest, SBOM/provenance, exact native/model hashes, no Android `INTERNET` permission/network SDK, Android backup/data-extraction policy, iOS data protection/no-backup attributes, SQLCipher and native P-256 verifier linkage, no debug entitlement, symbol stripping, dependency licenses, and the full offline integration suite. The iOS envelope must be created with `COPYFILE_DISABLE=1 ditto --norsrc`; verification rejects any `__MACOSX/`, AppleDouble `._*`, resource-fork, FinderInfo, or other extra metadata entry before comparing the one archive tree. Any distribution signature is a hard failure. The uploaded seven-day GitHub artifacts are internal review candidates, not signed/distributable packages and not a store publication. Upload-key/certificate/profile custody, non-exportable signing or ephemeral signing-runner design, rotation/revocation, store identities, signed-candidate verification, phased rollout, user messaging, and external reviewer submission remain deferred to a separate founder-approved mobile-signing/release specification and plan.

- [ ] **Step 6: Run the offline image, collector, IaC, and candidate-fixture gate**

Run (pinned Linux/amd64 repository gate): `test "${CI:-}" = true && test "${RUNNER_OS:-}" = Linux && test "$(uname -s)" = Linux && test "$(uname -m)" = x86_64 && python -m unittest scripts.tests.test_install_opentofu -v && test ! -e build/tools/opentofu-gate && python scripts/ci/install_opentofu.py --destination build/tools/opentofu-gate && test "$(build/tools/opentofu-gate/tofu version | sed -n '1p')" = 'OpenTofu v1.10.6' && python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release --check && python scripts/ci/run_locked_uv.py -- lock --project infra/ux-deployment-authority --check && pnpm --filter @gc/web build && build/tools/opentofu-gate/tofu fmt -check -recursive infra/modules/product-web infra/live/product-web-staging infra/live/product-web-prod && build/tools/opentofu-gate/tofu -chdir=infra/modules/product-web init -backend=false -lockfile=readonly && build/tools/opentofu-gate/tofu -chdir=infra/modules/product-web test && build/tools/opentofu-gate/tofu -chdir=infra/live/product-web-staging init -backend=false -lockfile=readonly && build/tools/opentofu-gate/tofu -chdir=infra/live/product-web-staging validate && build/tools/opentofu-gate/tofu -chdir=infra/live/product-web-prod init -backend=false -lockfile=readonly && build/tools/opentofu-gate/tofu -chdir=infra/live/product-web-prod validate && python -m unittest scripts.tests.test_build_product_provider_mirror -v && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python -m unittest scripts.release.test_verify_product_web_image scripts.release.test_product_web_release scripts.release.test_build_product_web_deploy_harness scripts.release.test_build_mobile_candidate_manifest scripts.release.test_verify_mobile_release scripts.release.test_verify_cocoapods_artifacts -v && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python -m unittest discover -s infra/functions/product-web-deploy-harness -p "test_*.py" -v && python scripts/ci/run_locked_uv.py -- run --project infra/ux-deployment-authority --frozen pytest scripts/release/test_ux_deployment_authority.py -q && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python scripts/release/verify_mobile_release.py fixtures --schema packages/contracts/jsonschema/product-mobile-candidate-manifest.schema.json --test-evidence-schema packages/contracts/jsonschema/product-mobile-native-test-evidence.schema.json --build-identity-schema packages/contracts/jsonschema/product-mobile-build-identity.schema.json && python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python scripts/ci/verify_workflow_security.py && pnpm --filter @gc/web exec playwright test e2e/private-boundary.spec.ts`.

Run the OCI gate only through the exact `UX WEB PLAN` marker above on FND's pinned `ubuntu-24.04` amd64 job after its locked Buildx/BuildKit bootstrap. That gate performs both `--builder gc-ux-plan` builds, image scans, image-record/provenance checks, and pushes; Windows/macOS hosts fail closed instead of using Docker or materializing a Linux-only tool context.

Expected: pinned Linux/amd64 image/IaC/token/collector/mobile-candidate fixture controls PASS. This command produces **no** claim about a live canary, signing service, production, or store publication.

- [ ] **Step 7: Run an authorized staging canary and forced rollback drill**

Only from the FND-owned `ux_web_staging` job, pass the exact handoff/plan/snapshot/fault coordinates to FND `ux_deployment_authority.py stage`. The client constructs the strict request, and only the matching FND state machine applies, fences, smokes, shifts, rolls back, and emits the exact verified `ux-staging-result.v1` coordinate. Production later passes that exact coordinate with the same handoff/plan/snapshot chain to `promote`; no Product command applies a plan or mutates a live pointer. The runbook records the verified FND authority/result digests, alarms, timestamps, reviewer, rollback result, and zero-PHI log scan.

- [ ] **Step 8: Commit the deployment and release extension plan implementation**

```bash
git add apps/web/Dockerfile apps/web/Dockerfile.dockerignore apps/web/next.config.ts apps/web/collector.Dockerfile apps/web/collector.Dockerfile.dockerignore apps/web/collector-config.yaml supply-chain/ux-images.lock.json infra/modules/product-web tooling/product-release infra/functions/product-web-deploy-harness infra/live/product-web-staging infra/live/product-web-prod packages/contracts/jsonschema/product-web-plan-bundle.schema.json packages/contracts/fixtures/product-web-plan-bundle.valid.json packages/contracts/jsonschema/product-web-staging-handoff.schema.json packages/contracts/fixtures/product-web-staging-handoff.valid.json packages/contracts/jsonschema/product-mobile-candidate-manifest.schema.json packages/contracts/fixtures/product-mobile-candidate-manifest.valid.json packages/contracts/jsonschema/product-mobile-native-test-evidence.schema.json packages/contracts/fixtures/product-mobile-native-test-evidence.valid.json packages/contracts/jsonschema/product-mobile-build-identity.schema.json packages/contracts/fixtures/product-mobile-build-identity.valid.json scripts/release/product_web_release.py scripts/release/test_product_web_release.py scripts/release/build_product_web_deploy_harness.py scripts/release/test_build_product_web_deploy_harness.py scripts/release/verify_product_web_image.py scripts/release/test_verify_product_web_image.py scripts/release/build_mobile_candidate_manifest.py scripts/release/test_build_mobile_candidate_manifest.py scripts/release/verify_mobile_release.py scripts/release/test_verify_mobile_release.py scripts/release/verify_cocoapods_artifacts.py scripts/release/test_verify_cocoapods_artifacts.py apps/mobile/pubspec.yaml apps/mobile/integration_test/record_export_verifier_test.dart apps/mobile/native-components.lock.json apps/mobile/assets/generated/.gitkeep apps/mobile/android/app/build.gradle.kts apps/mobile/android/gradle.lockfile apps/mobile/android/gradle/verification-metadata.xml apps/mobile/android/gradle.properties apps/mobile/ios/Podfile.lock apps/mobile/ios/Pod-artifacts.lock.json ops/runbooks/product-web-deploy-rollback.md ops/runbooks/bff-session-incident.md ops/runbooks/mobile-release-and-key-rotation.md .github/workflows/release.yml
git commit -m "feat(platform): deploy Seoul product BFF safely"
```

## Plan Acceptance Gate

Run the platform-neutral local/repository portion from the root with the pinned runtimes:

```powershell
python scripts/ci/run_locked_uv.py -- lock --project tooling/product-release --check
if ($LASTEXITCODE -ne 0) { throw "locked Product release environment failed" }
python scripts/ci/run_locked_uv.py -- lock --project infra/ux-deployment-authority --check
if ($LASTEXITCODE -ne 0) { throw "locked FND UX deployment-authority environment failed" }
function Invoke-ProductPython {
  & python scripts/ci/run_locked_uv.py -- run --project tooling/product-release --frozen python @args
  if ($LASTEXITCODE -ne 0) { throw "Product Python command failed: $args" }
}
corepack enable
corepack prepare pnpm@11.20.0+sha512.9a6f330a95b66446ea088faf1521405a8a01f07fde7124cc9958dfed52d4bb436737e65b08f85f37b46fcba375092558ac51262b816844b22f63406ed166bfee --activate
pnpm install --frozen-lockfile
pnpm --filter @gc/design-tokens generate
pnpm --filter @gc/design-tokens test
pnpm --filter @gc/web generate:contracts
pnpm exec tsx scripts/design/sync_mobile_tokens.ts --check
pnpm exec tsx scripts/contracts/generate_verified_timeline_dart.ts --check
git diff --exit-code packages/design-tokens/dist apps/web/lib/api/generated apps/mobile/lib/design apps/mobile/lib/api/generated
pnpm --filter @gc/web test
pnpm --filter @gc/web build
pnpm --filter @gc/web build-storybook --quiet
pnpm --filter @gc/web exec playwright test
Push-Location apps/mobile
flutter pub get --enforce-lockfile
flutter analyze --fatal-infos
flutter test
Pop-Location
Invoke-ProductPython scripts/mobile/benchmark_local_ocr.py --schema scripts/mobile/local-ocr-benchmark.schema.json --fixtures apps/mobile/test/fixtures/local-intake --manifest apps/mobile/assets/local-template-manifest.json --baseline-artifacts evidence/ux/local-ocr-baseline --candidate-artifacts evidence/ux/local-ocr-candidate --output evidence/ux/local-ocr-benchmark.v1.json --require-ci-devices
Invoke-ProductPython scripts/mobile/audit_mobile_native_assets.py --app apps/mobile
Write-Host "OCI and OpenTofu gates run only in the pinned Linux/amd64 companion block; this platform-neutral gate does not use a host/default builder or a Linux-only tool installer."
python -m unittest scripts.tests.test_build_product_provider_mirror -v
Invoke-ProductPython -m unittest scripts.release.test_verify_product_web_image scripts.release.test_product_web_release scripts.release.test_build_product_web_deploy_harness scripts.release.test_build_mobile_candidate_manifest scripts.release.test_verify_mobile_release scripts.release.test_verify_cocoapods_artifacts -v
Invoke-ProductPython -m unittest discover -s infra/functions/product-web-deploy-harness -p "test_*.py" -v
python scripts/ci/run_locked_uv.py -- run --project infra/ux-deployment-authority --frozen pytest scripts/release/test_ux_deployment_authority.py -q
Invoke-ProductPython scripts/release/verify_mobile_release.py fixtures --schema packages/contracts/jsonschema/product-mobile-candidate-manifest.schema.json --test-evidence-schema packages/contracts/jsonschema/product-mobile-native-test-evidence.schema.json --build-identity-schema packages/contracts/jsonschema/product-mobile-build-identity.schema.json
Invoke-ProductPython scripts/ci/verify_workflow_security.py
```

Run the IaC companion only on the pinned Linux/amd64 CI job, using a destination not shared with any earlier plan block:

```bash
test "${CI:-}" = "true"
test "${RUNNER_OS:-}" = "Linux"
test "$(uname -s)" = "Linux"
test "$(uname -m)" = "x86_64"
python -m unittest scripts.tests.test_install_opentofu -v
test ! -e build/tools/opentofu-product-acceptance
python scripts/ci/install_opentofu.py --destination build/tools/opentofu-product-acceptance
PRODUCT_TOFU="$PWD/build/tools/opentofu-product-acceptance/tofu"
test "$("$PRODUCT_TOFU" version | sed -n '1p')" = "OpenTofu v1.10.6"
"$PRODUCT_TOFU" fmt -check -recursive infra/modules/product-web infra/live/product-web-staging infra/live/product-web-prod
"$PRODUCT_TOFU" -chdir=infra/modules/product-web init -backend=false -lockfile=readonly
"$PRODUCT_TOFU" -chdir=infra/modules/product-web test
"$PRODUCT_TOFU" -chdir=infra/live/product-web-staging init -backend=false -lockfile=readonly
"$PRODUCT_TOFU" -chdir=infra/live/product-web-staging validate
"$PRODUCT_TOFU" -chdir=infra/live/product-web-prod init -backend=false -lockfile=readonly
"$PRODUCT_TOFU" -chdir=infra/live/product-web-prod validate
```

This workstream is complete only when every command exits 0; token/output manifests are byte-deterministic; generated contracts match PUB/FND/REC exactly; web and Flutter consume the same semantic values; public and personal clients never cross origins; every visible fact exposes source/freshness/verification/caveat; source deletion is the default without coercive styling; all critical journeys work by keyboard and screen reader at 200% text; reduced motion is honored; network/URL/storage captures contain no synthetic sensitive marker; the signed REC export fixture imports offline; Android/iOS artifacts prove encryption/backup/no-network controls; and founder visual review confirms the product resembles the approved niche editorial references while remaining readable in Korean. Live staging canary/rollback and protected signing evidence are additional release gates from Task 10 Step 7; local commands never stand in for them.
