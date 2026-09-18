# Wave 6 — 디자인 시스템 (하나의 언어 · 하나의 내비게이션 · 사람 중심 카피) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every screen of `apps/web` on one dark, token-driven visual language (grid ground, 1px rules, mono metadata, patch badges, time-colour ribbons), make every destination reachable from one header and one mobile bar, move the import flow into URLs, split the 600-line `IntegratedHealthExperience` state machine into views and one hook, delete the dead concept components and the duplicated "studio refresh" CSS, and rewrite the copy so the first sentence is always the person's action — without changing one server contract or one safety boundary.

**Architecture:** The palette, type stacks, spacing and radii live in `packages/design-tokens/tokens.json` (regenerated `dist/tokens.css`, dark values); web-only composition tokens (grid image, time gradient, patch noise, shell heights) live in `apps/web/styles/tokens.css`; a ~15-class global primitive layer (`apps/web/styles/system.css`: `.gc-panel`, `.gc-button`, `.gc-meta`, `.gc-caption`, …) replaces `globals.css`, and every screen keeps its own CSS module. Fonts are vendored under `apps/web/public/fonts` with OFL licence files (Pixelify Sans through `next/font/local`; Noto Serif KR through a generated `@font-face` sheet because `next/font/local` cannot express per-file `unicode-range`). One hook, `useExperienceState(stage)`, owns session/consent/document/candidate state; `/`, `/import/consent`, `/import/source`, `/import/status`, `/import/review` render thin views over it, with `app/import/layout.tsx` keeping the hook mounted across the import stages. Tests move from source-string scans to rendered-text assertions plus axe on every screen and state; the forbidden-word source scan stays as a safety net; the browser lifecycle asserts geometry (never pixels).

**Tech Stack:** Next 16.3.3 (App Router, `next/font/local`) / React 19.2.8 / zod 4 / CSS Modules + plain PostCSS (autoprefixer; Tailwind removed) / vitest 4 + Testing Library + jest-axe + msw / Playwright 1.62 / pnpm 11.20.0, Node 24.20.0; `@gc/design-tokens` generated with `tsx`; fonts from `@fontsource/noto-serif-kr@5.3.0` and `@fontsource-variable/pixelify-sans@5.3.0` (both OFL-1.1, vendored, devDependencies only).

Spec: `docs/superpowers/specs/2026-09-18-wave6-design-system-design.md` (founder decisions 2026-09-18: dark everywhere; horizontal living axis stays as built; profile panel stays; no upward/direction language). Authority: `PROJECT_GUIDE.md` §6, `AGENTS.md`, `.claude/skills/gc-korean-copy`, `.claude/skills/gc-safe-change`. Previous wave: `docs/superpowers/plans/2026-09-17-wave5-concept-accuracy.md`, evidence `docs/status/2026-09-17/wave5.md`; the home/hero as built: branch `codex/wave11-alive-home` (commits `ea5f8c7` … `91ba611`).

## Global Constraints

- Toolchain: Node `24.20.0`, pnpm `11.20.0`. In every Git Bash shell first run `export PATH="$HOME/.gc-node24:$PATH"`. Repository root `C:/Users/Jason/Documents/genome-companion-korea-ux`. Web gates: `pnpm web:test`, `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`, `pnpm --dir apps/web build`. Browser: `export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'` and `export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'`, then `pnpm foundation:e2e` (ports 8087/8091/3138 must be free; it starts Spring, the worker and `next dev`). No JVM code changes in this wave; `./gradlew.bat` is not part of any task gate.
- Branch: `codex/wave12-design-system`, stacked on `codex/wave11-alive-home`. Never push to `main`. Never stage `apps/web/next-env.d.ts` (`next build`/`next dev` rewrite it; restore with `git checkout -- apps/web/next-env.d.ts`). Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Boundary (spec §1, verbatim intent): colour, weight, size, speed and direction never mean a value; the time gradient (`#1f5bff → #35c6b4 → #6fe06a → #c8f02a`, lime for fills only, ribbon end muted to `#9AA88A`) marks a position in time only; red `#e0231c` is the 앎 emblem colour only (never a value, warning or state — error boxes are ink on black, no red). No judgement/direction words (the scan in `apps/web/tests/korean-ux-copy.test.ts` plus `상승/하락/증가/감소/빨라/느려/좋아/나빠/추세/안정`). Reference ranges never shown. "trajectory"/"phase" mean result-sheet dates only. Next.js gains no API route, token or authorization rule; `release/readiness.json` unchanged; synthetic data only; no real names or institutions (profile is "예시 사용자").
- No API change: `apps/web/lib/foundation/client.ts` gains exactly two exported string constants (`HEALTH_EVENTS_EXPORT_PATH`, `HEALTH_EVENTS_FHIR_EXPORT_PATH`) and nothing else. Every zod schema, every fixture in `apps/web/tests/fixtures/foundation.ts` and every msw handler keeps its shape (Jackson omits nulls; optional keys stay `.optional()` inside `.strict()`).
- Fonts (spec §2, §8.6): every named face in any `font-family` is bundled or removed. Allowed names: `"Pretendard Variable"`, `Pretendard`, `"IBM Plex Mono"`, `"Noto Serif KR"`, `"Pixelify Sans"` (only via `var(--gc-font-pixel)`), plus generic keywords (`system-ui`, `ui-monospace`, `sans-serif`, `serif`, `monospace`). Zero runtime requests to a third-party host (`fonts.googleapis`, `typekit`, any `https://` in CSS). Font sources are the npm packages `@fontsource/noto-serif-kr@5.3.0` and `@fontsource-variable/pixelify-sans@5.3.0` (both present in the registry, checked 2026-09-18; both ship an OFL-1.1 `LICENSE`); the vendoring script records package, version and licence in `SOURCE.md` beside the files. If either package cannot be installed offline, the implementer removes that face's name from every stack and from `tokens.json` instead of leaving a silent fallback, and says so in the evidence.
- Mono stack is `var(--gc-type-mono)` and nothing else (`"IBM Plex Mono", ui-monospace, monospace`). `text-transform: uppercase` and `letter-spacing` may appear only inside the `.gc-meta--latin` rule of `apps/web/styles/system.css`, which is applied only to elements whose content is Latin letters/digits (counters like `1 / 3`, digests). `body` has no `letter-spacing`. No negative tracking anywhere. No `font-size` under 12px (`0.75rem`); the token is `--gc-type-meta: 12px`.
- Breakpoints: exactly one scale. Allowed media queries in `apps/web` CSS: `(max-width: 42rem)`, `(max-width: 56rem)`, `(min-width: 56.01rem)`, `(hover: hover)`, `(prefers-reduced-motion: reduce)`, `print`. Nothing else (no `720px`, `900px`, `34rem`, `52rem`, …).
- Copy (spec §5, `gc-korean-copy`): first sentence is the person's action; system explanations live only under `자세히` on 데이터 관리; one boundary sentence per screen as the bottom caption (`.gc-caption`), never repeated per card; terms: 결과지, 항목, 값, 검사일, 출처, 확인; "체험" only on the start screen (and the pre-authenticated restore screen, which is the start screen's failure state); screen titles 홈 / 나의 데이터 / 측정 이력 / 내 기록 / 진료 준비 / 데이터 관리. The retired-term table in Task 2 (`apps/web/lib/copy/terminology.ts`) is binding for every later task.
- Behaviour preservation: every existing vitest and the browser lifecycle keep their *meaning*. A test string changes only when the copy map of Task 2 changes that string, and every such change is listed in the task that makes it. Screenshots are geometry assertions, never `toHaveScreenshot` baselines (decision 3 below).
- CI renders with Linux fonts: every new text line gets `min-width: 0` and `overflow-wrap: anywhere`; tables stay inside a scrolling wrapper; every screen and every state passes the 320px `captureMatrix` (no horizontal overflow) at all seven viewports.
- Gates before finishing (Task 8): `pnpm security:runtime-policy`, `pnpm release:readiness:validate`, `pnpm auth-security:gate`, `pnpm security:github-actions-policy`, `pnpm web:test`, `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json`, `pnpm --dir apps/web build`, `pnpm --filter @gc/design-tokens test`, `pnpm foundation:e2e`, `git diff --quiet $(git merge-base HEAD codex/wave11-alive-home) -- release/readiness.json`.

### Decisions this plan makes where the spec is silent or conflicts with the code

1. **Palette lives in the package, composition tokens in the web.** Spec §2 names `apps/web/styles/tokens.css`. The repository already has `@gc/design-tokens` (owner of "design primitives" in `PROJECT_GUIDE.md`) generating `--gc-color-*`, `--gc-type-*`, `--gc-space-*`, `--gc-radius-*`. Re-declaring those names in the web with different values would be exactly the duplicated layer §8.3 removes. So `tokens.json` gets the dark values and the new colour groups (`emblem`, `time`, `grid`), and `apps/web/styles/tokens.css` holds only web-only compositions (`--gc-rule`, `--gc-grid-image`, `--gc-time-gradient`, `--gc-patch-noise`, shell/nav heights). The package's own contrast tests are updated to the dark pins.
2. **Noto Serif KR is loaded through a generated `@font-face` sheet, not `next/font/local`.** `next/font/local` has no per-file `unicode-range`; the Korean face ships as ~120 unicode-range slices, and a single-file variable TTF is ~15 MB. The slices are vendored from `@fontsource/noto-serif-kr` into `apps/web/public/fonts/noto-serif-kr/` (weight 400 only, woff2 only), and `apps/web/styles/fonts/noto-serif-kr.css` (generated by `apps/web/scripts/vendor-fonts.mts`) references them with relative `url(../../public/fonts/…)` so Next's asset pipeline emits them under `/_next/static/media/` — the same self-hosting path IBM Plex Mono already uses, and it needs no `public/` copy in the standalone Docker image. Pixelify Sans (one Latin variable file) goes through `next/font/local` with `variable: "--gc-font-pixel"`.
3. **No pixel baselines.** `toHaveScreenshot` baselines would have to be generated on the CI platform (Linux Chromium) — Playwright names them per platform — and the hero's control points are seeded with `Math.random()`, so two runs never match. The browser lifecycle keeps `page.screenshot(...)` captures as evidence and asserts geometry: overflow, target sizes, nav visibility, bottom bar not covering the CTA, cell minimum size, hero filling its stage with every node inside, contrast ratios computed from computed styles (`contrastReport`).
4. **Processing gets its own URL, `/import/status`.** Spec §8.4 lists `consent|source|review`; the existing tests require "이전" from the review to land on the server-status view (status code visible, "이어서 확인") and a second "이전" to land on the home with "이어서 확인" but no "결과지 추가". A status stage is the only way to keep that behaviour and keep browser back inside the flow.
5. **The home never auto-enters the review on load.** Today `IntegratedHealthExperience` jumps straight to the review view when the server has a pending document. With URL stages that jump from `/` would loop against "이전 → 홈". The home shows "이어서 확인" whenever a document is unfinished; deep links to `/import/review` and `/import/status` restore themselves from the server. The two vitest cases that relied on the jump ("retries failed restoration…", "does not bootstrap twice…") click "이어서 확인" after recovery; their meaning (no second bootstrap, resume at the pending candidate) is unchanged.
6. **The bottom caption is `position: sticky; bottom: 0` inside `<main>`** ("하단 고정 캡션"), sitting above the fixed mobile bar via `--gc-nav-height`; a second `position: fixed` element would fight the bar for the same pixels on 320px.
7. **Mobile bar is one row of five** (홈 · 나의 데이터 · 측정 이력 · 내 기록 · 데이터 관리), labels 12px, allowed to wrap to two lines inside a 56px-tall target; 진료 준비 is hidden in the bar (`data-mobile="false"`) and offered from the home panel and the desktop header. Each target at 320px is 59px wide (≥ 48).
8. **"직접 확인함" only on real records:** the records panel's state column says `예시` for the pre-login example rows and `직접 확인함` for the person's own records (`AliveEntryLayout` gains `rowState`).
9. **`components/evidence/*`, `lib/records/demo-health-timeline.ts`, `lib/imports/local-document.ts`, `lib/consent/demo-consent.ts`, `tests/fixtures/public.ts`, `e2e/korean-experience.spec.ts` and the six concept stories are deleted with the dead components** — nothing on a route imports them, and the stale Playwright spec asserts headings that no longer exist. `CandidateReview.stories.tsx` and `VisitPreparation.stories.tsx` stay.
10. **The "before" captures are taken in Task 1 Step 0** from the unchanged tree (two viewports × eight states, 16 PNGs) so Task 8 can pair them with "after"; full matrices stay in the CI artifact `foundation-browser-evidence`, not in git.

---

## File map

| Path | Responsibility |
|---|---|
| `packages/design-tokens/tokens.json`, `tests/tokens.test.ts`, `package.json`, `dist/*` (modify) | dark palette, `emblem`/`time`/`grid` colours, serif/pixel stacks, radius 0 + `patch`, `--gc-type-meta`; JSON export |
| `apps/web/styles/tokens.css` (create), `apps/web/styles/system.css` (create), `apps/web/styles/fonts/noto-serif-kr.css` (generated) | web composition tokens; global primitives; vendored serif faces |
| `apps/web/scripts/vendor-fonts.mts` (create), `apps/web/public/fonts/**` (create), `apps/web/lib/fonts/pixelify.ts` (create), `apps/web/font-bundle.ts`, `apps/web/app/layout.tsx`, `apps/web/tests/font-bundle.test.ts` (modify) | fonts |
| `apps/web/lib/motion/springs.ts`, `apps/web/lib/motion/reduced-motion.ts` (create); `apps/web/lib/home/alive-trajectory.ts` (modify); `apps/web/lib/my-data/reduced-motion.ts` (delete) | shared spring presets; synchronous reduced-motion |
| `apps/web/components/ui/Patch.tsx` + `Patch.module.css` + `tests/patch.test.tsx` (create); `apps/web/components/ui/EmptyState.tsx` (create, Task 4) | patch badge / card; empty state with preview |
| `apps/web/components/integrated/IntegratedShell.tsx` + `IntegratedShell.module.css` (rewrite); `apps/web/components/home/AliveShellTone.module.css` (delete); `apps/web/lib/copy/terminology.ts` (create) | shell, six destinations, mobile bar, copy map |
| `apps/web/lib/experience/use-experience-state.ts` (create); `apps/web/components/experience/{ImportFlowProvider,EntryView,RestoreFailedView,HomeView,ConsentView,SourceView,ProcessingView,ReviewStage,CompleteView}.tsx` + `Experience.module.css` (create); `apps/web/app/import/{layout,consent/page,source/page,status/page,review/page}.tsx` (create); `apps/web/components/integrated/IntegratedHealthExperience.tsx` (rewrite thin); `apps/web/tests/helpers/{router-mock.ts,app-harness.tsx}` (create); `apps/web/tests/integrated-review-loop.test.tsx` (rewrite) | split + URL-backed flow |
| `apps/web/components/my-data/*` + `MyData.module.css`, `components/my-data/history/*` + `History.module.css`, `components/integrated/{IntegratedRecords,RecordComparison,RecentChanges,IntegratedDataControl,VisitPreparation,CandidateReview}.tsx` + new modules `Records.module.css`, `DataControl.module.css`, `Prepare.module.css`, `Review.module.css`, `RecentChanges.module.css`; `lib/foundation/client.ts` (two constants) | screens on the system |
| dead: `components/concept/*`, `components/experience/HealthExperience.tsx`, `components/records/*`, `components/privacy/*`, `components/integrated/PrepareConceptNotice.tsx`, `components/evidence/*`, six stories, their tests and libs; `app/globals.css`; Tailwind deps; `postcss.config.mjs`; `tests/studio-design-contract.test.ts`; `components/connections/connections.css` (create, moved from globals) | cleanup |
| `apps/web/scripts/css-coverage.mts`, `apps/web/tests/css-coverage.test.ts`, `apps/web/tests/design-system-contract.test.ts` (create) | unreferenced-CSS report; contract |
| `apps/web/components/home/AliveTrajectory.tsx`, `AliveEntryLayout.tsx` + modules, tests (modify) | hero polish |
| `apps/web/tests/korean-ux-copy.test.ts` (rewrite), `apps/web/tests/screens-axe.test.tsx` (create), per-screen tests (modify) | copy + a11y + rendered assertions |
| `apps/web/e2e/foundation-lifecycle.spec.ts` (modify), `docs/status/2026-09-18/wave6.md` + `captures/` (create), `docs/roadmap/2026-09-02-roadmap.md`, `PROJECT_GUIDE.md`, `AGENTS.md`, `docs/quality/accessibility-test-matrix.md` (modify) | evidence |

---

### Task 1: Foundation — tokens, fonts, motion presets, `Patch`

**Files:**
- Modify: `packages/design-tokens/tokens.json`, `packages/design-tokens/tests/tokens.test.ts`, `packages/design-tokens/package.json` (add `"./tokens.json"` export); regenerate `packages/design-tokens/dist/{tokens.css,tokens.dart,tokens.manifest.json}` with `pnpm tokens`
- Create: `apps/web/styles/tokens.css`, `apps/web/styles/system.css`, `apps/web/scripts/vendor-fonts.mts`, `apps/web/lib/fonts/pixelify.ts`, `apps/web/lib/motion/springs.ts`, `apps/web/lib/motion/reduced-motion.ts`, `apps/web/components/ui/Patch.tsx`, `apps/web/components/ui/Patch.module.css`, `apps/web/tests/patch.test.tsx`, `apps/web/tests/design-system-contract.test.ts`
- Generated by the script: `apps/web/styles/fonts/noto-serif-kr.css`, `apps/web/public/fonts/noto-serif-kr/{*.woff2,LICENSE,SOURCE.md}`, `apps/web/public/fonts/pixelify-sans/{pixelify-sans-latin-wght-normal.woff2,LICENSE,SOURCE.md}`
- Modify: `apps/web/package.json` (devDependencies + `fonts:vendor` script), `apps/web/font-bundle.ts`, `apps/web/app/layout.tsx`, `apps/web/app/globals.css` (remove `body { letter-spacing }`), `apps/web/tests/font-bundle.test.ts`, `apps/web/lib/home/alive-trajectory.ts`, `apps/web/components/home/AliveTrajectory.tsx`, `apps/web/components/my-data/LivingCellCanvas.tsx`
- Delete: `apps/web/lib/my-data/reduced-motion.ts`
- Create: `docs/status/2026-09-18/captures/before/*.png` (Step 0)

**Interfaces:**
- Consumes: nothing.
- Produces (used by every later task): CSS custom properties `--gc-color-surface-{canvas,raised,soft,inverse}`, `--gc-color-text-{primary,secondary,tertiary,inverse}`, `--gc-color-line-{subtle,strong}`, `--gc-color-brand-{primary,deep,soft}`, `--gc-color-focus-ring`, `--gc-color-emblem`, `--gc-color-time-{start,mid,late,end,end-muted}`, `--gc-color-grid-{minor,major}`, `--gc-type-{sans,mono,serif,pixel,meta,bodySize,bodyLine}`, `--gc-space-{1,2,3,4,5,6,8,10,12}`, `--gc-radius-{sm,md,pill,patch}`, `--gc-grid-{minor,major}`, `--gc-target-minimum`, `--gc-motion-{fast,standard}`; web: `--gc-rule`, `--gc-rule-double`, `--gc-grid-image`, `--gc-grid-size`, `--gc-time-gradient`, `--gc-patch-noise`, `--gc-shell-height`, `--gc-nav-height`, `--gc-type-display`, `--gc-type-title`, `--gc-font-pixel` (set on `<html>`). Global classes: `.gc-grid-ground`, `.gc-panel`, `.gc-panel__eyebrow`, `.gc-meta`, `.gc-meta--latin`, `.gc-serif`, `.gc-pixel`, `.gc-button`, `.gc-button--primary`, `.gc-button--secondary`, `.gc-button--text`, `.gc-actions`, `.gc-facts`, `.gc-error`, `.gc-empty`, `.gc-field`, `.gc-caption`, `.gc-details`, `.gc-visually-hidden`, `.gc-center`. TS: `Patch({ variant?: "wordmark"|"badge"|"card"; meta?: readonly string[]; slogan?: readonly [string,string]; emblem?: boolean; children?; className? })`, `PATCH_SLOGAN`; `lib/motion/springs.ts` exports `SpringParams`, `Spring`, `PICKER`, `DRIFT`, `BREATH`, `DRAW`; `lib/motion/reduced-motion.ts` exports `REDUCED_MOTION_QUERY`, `prefersReducedMotion(): boolean`, `usePrefersReducedMotion(): boolean`; `lib/fonts/pixelify.ts` exports `pixelifySans` (`next/font/local` result; `pixelifySans.variable` is the class that defines `--gc-font-pixel`).

- [ ] **Step 0: Capture the "before" evidence from the unchanged tree**

```bash
export PATH="$HOME/.gc-node24:$PATH"
export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'
export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'
git status --porcelain            # must be empty
pnpm foundation:e2e               # expected: 3 passed
mkdir -p docs/status/2026-09-18/captures/before
for state in entry home review my-data history records prepare data-control; do
  for size in 320x720 1280x720; do
    find apps/web/test-results -name "${state}-${size}.png" -exec cp {} "docs/status/2026-09-18/captures/before/${state}-${size}.png" \;
  done
done
ls docs/status/2026-09-18/captures/before | wc -l      # expected: 16
git checkout -- apps/web/next-env.d.ts
git add docs/status/2026-09-18/captures/before
git commit -m "docs: Wave 6 before-captures from the alive-home tree (16 PNGs, two viewports)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 1: Write the failing package test (dark pins)**

Replace `packages/design-tokens/tests/tokens.test.ts` with:

```ts
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

describe("앎 dark design tokens (Wave 6)", () => {
  it("meets body, secondary, tertiary and focus contrast on the black canvas", () => {
    expect(tokens.color.surface.canvas).toBe("#000000");
    expect(contrast(tokens.color.text.primary, tokens.color.surface.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.color.text.secondary, tokens.color.surface.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.color.text.tertiary, tokens.color.surface.raised)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.color.focus.ring, tokens.color.surface.canvas)).toBeGreaterThanOrEqual(3);
    expect(contrast(tokens.color.text.primary, tokens.color.surface.raised)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the emblem red separate from every status colour and every status readable on the raised surface", () => {
    expect(tokens.color.emblem).toBe("#E0231C");
    expect(tokens.color.status.verified).not.toBe(tokens.color.status.danger);
    expect(contrast(tokens.color.status.verified, tokens.color.surface.raised)).toBeGreaterThanOrEqual(4.5);
    expect(tokens.target.minimum).toBe("44px");
    expect(Number.parseInt(tokens.motion.standard)).toBeLessThanOrEqual(200);
  });

  it("pins the time gradient (position in time only) with a muted ribbon end", () => {
    expect(tokens.color.time).toEqual({ start: "#1F5BFF", mid: "#35C6B4", late: "#6FE06A", end: "#C8F02A", "end-muted": "#9AA88A" });
    expect(contrast(tokens.color.time["end-muted"], tokens.color.surface.canvas)).toBeGreaterThanOrEqual(3);
  });

  it("pins the bundled faces and one mono stack", () => {
    expect(tokens.type.sans).toBe('"Pretendard Variable", Pretendard, system-ui, sans-serif');
    expect(tokens.type.mono).toBe('"IBM Plex Mono", ui-monospace, monospace');
    expect(tokens.type.serif).toBe('"Noto Serif KR", serif');
    expect(tokens.type.pixel).toBe('var(--gc-font-pixel, "IBM Plex Mono"), ui-monospace, monospace');
    expect(tokens.type.meta).toBe("12px");
  });

  it("has square corners everywhere except the patch badge, and a 40/200 grid", () => {
    expect(tokens.radius).toEqual({ sm: "0px", md: "0px", pill: "0px", patch: "10px" });
    expect(tokens.grid).toEqual({ minor: "40px", major: "200px" });
    expect(tokens.color.grid).toEqual({ minor: "rgba(255, 255, 255, 0.07)", major: "rgba(255, 255, 255, 0.14)" });
    expect(tokens.color.line).toEqual({ subtle: "rgba(255, 255, 255, 0.28)", strong: "rgba(255, 255, 255, 0.6)" });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `export PATH="$HOME/.gc-node24:$PATH" && pnpm --filter @gc/design-tokens test`
Expected: FAIL — `expected '#FAFAFA' to be '#000000'` (and the other new pins).

- [ ] **Step 3: Write the dark tokens and export the JSON**

Replace `packages/design-tokens/tokens.json` with:

```json
{
  "color": {
    "surface": { "canvas": "#000000", "raised": "#0B0B0B", "soft": "#151515", "inverse": "#F4F1E8" },
    "brand": { "primary": "#F4F1E8", "deep": "#FFFFFF", "soft": "#1C1C1C" },
    "text": { "primary": "#F4F1E8", "secondary": "#979590", "tertiary": "#8A8883", "inverse": "#000000" },
    "line": { "subtle": "rgba(255, 255, 255, 0.28)", "strong": "rgba(255, 255, 255, 0.6)" },
    "status": { "verified": "#35C6B4", "danger": "#E0231C", "warning": "#E6D36A", "unknown": "#8A8883" },
    "focus": { "ring": "#3182F6" },
    "emblem": "#E0231C",
    "time": { "start": "#1F5BFF", "mid": "#35C6B4", "late": "#6FE06A", "end": "#C8F02A", "end-muted": "#9AA88A" },
    "grid": { "minor": "rgba(255, 255, 255, 0.07)", "major": "rgba(255, 255, 255, 0.14)" }
  },
  "type": {
    "sans": "\"Pretendard Variable\", Pretendard, system-ui, sans-serif",
    "mono": "\"IBM Plex Mono\", ui-monospace, monospace",
    "serif": "\"Noto Serif KR\", serif",
    "pixel": "var(--gc-font-pixel, \"IBM Plex Mono\"), ui-monospace, monospace",
    "bodySize": "16px",
    "bodyLine": "1.6",
    "meta": "12px"
  },
  "space": { "1": "4px", "2": "8px", "3": "12px", "4": "16px", "5": "20px", "6": "24px", "8": "32px", "10": "40px", "12": "48px" },
  "radius": { "sm": "0px", "md": "0px", "pill": "0px", "patch": "10px" },
  "motion": { "fast": "100ms", "standard": "180ms" },
  "target": { "minimum": "44px" },
  "grid": { "minor": "40px", "major": "200px" }
}
```

`#979590` is `rgba(244,241,232,.62)` composited on black (the spec's secondary ink) written as hex so the contrast test can read it; `#8A8883` (tertiary) is 5.5:1 on black.

In `packages/design-tokens/package.json` add the JSON export so the web can read the time colours in TypeScript:

```json
  "exports": {
    "./tokens.css": "./dist/tokens.css",
    "./tokens.dart": "./dist/tokens.dart",
    "./manifest": "./dist/tokens.manifest.json",
    "./tokens.json": "./tokens.json"
  },
```

Regenerate and test:

```bash
pnpm tokens
pnpm --filter @gc/design-tokens test
grep -c -- '--gc-' packages/design-tokens/dist/tokens.css     # expected: 52
grep -- '--gc-color-time-end-muted\|--gc-radius-patch\|--gc-type-meta\|--gc-grid-major' packages/design-tokens/dist/tokens.css
```
Expected: tests PASS; the four greps each print their line.

- [ ] **Step 4: Web composition tokens and the global primitive layer**

Create `apps/web/styles/tokens.css`:

```css
/* Web-only composition tokens on top of @gc/design-tokens (palette, type, space, radius).
   Nothing here encodes a value: the time gradient is a position in time, the emblem red is a logo. */
:root {
  --gc-rule: 1px solid var(--gc-color-line-subtle);
  --gc-rule-double: 1.5px double var(--gc-color-line-strong);
  --gc-grid-image:
    linear-gradient(var(--gc-color-grid-major) 1px, transparent 1px),
    linear-gradient(90deg, var(--gc-color-grid-major) 1px, transparent 1px),
    linear-gradient(var(--gc-color-grid-minor) 1px, transparent 1px),
    linear-gradient(90deg, var(--gc-color-grid-minor) 1px, transparent 1px);
  --gc-grid-size:
    var(--gc-grid-major) var(--gc-grid-major),
    var(--gc-grid-major) var(--gc-grid-major),
    var(--gc-grid-minor) var(--gc-grid-minor),
    var(--gc-grid-minor) var(--gc-grid-minor);
  --gc-time-gradient: linear-gradient(90deg, var(--gc-color-time-start), var(--gc-color-time-mid) 55%, var(--gc-color-time-late) 80%, var(--gc-color-time-end-muted));
  --gc-patch-noise: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 3px);
  --gc-shell-height: 4rem;
  --gc-nav-height: 4.25rem;
  --gc-type-display: clamp(1.75rem, 3.2vw, 2.5rem);
  --gc-type-title: 1.25rem;
}
```

Create `apps/web/styles/system.css`:

```css
/* The global primitive layer: the only classes that exist outside a CSS module.
   Screens compose these; screen-specific rules live in their own *.module.css. */
html { color-scheme: dark; background: var(--gc-color-surface-canvas); scroll-behavior: smooth; }
body {
  margin: 0;
  color: var(--gc-color-text-primary);
  background: var(--gc-color-surface-canvas);
  font: var(--gc-type-bodySize) / var(--gc-type-bodyLine) var(--gc-type-sans);
  word-break: keep-all;
  overflow-wrap: anywhere;
}
h1, h2, h3, p, dl, dd, figure { margin: 0; min-width: 0; }
a { color: inherit; }
button, input { font: inherit; color: inherit; }
:focus-visible { outline: 3px solid var(--gc-color-focus-ring); outline-offset: 2px; }

/* Grid ground: 40px minor / 200px major lines on black. */
.gc-grid-ground {
  background-color: var(--gc-color-surface-canvas);
  background-image: var(--gc-grid-image);
  background-size: var(--gc-grid-size);
}

/* Mono metadata. Korean never gets uppercase or tracking; .gc-meta--latin is for Latin/digit-only content. */
.gc-meta { font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); line-height: 1.4; color: var(--gc-color-text-secondary); font-variant-numeric: tabular-nums; }
.gc-meta--latin { text-transform: uppercase; letter-spacing: 0.08em; }
.gc-serif { font-family: var(--gc-type-serif); font-weight: 400; }
.gc-pixel { font-family: var(--gc-type-pixel); font-variant-numeric: tabular-nums; }

.gc-panel { border: var(--gc-rule); background: var(--gc-color-surface-raised); padding: var(--gc-space-4); min-width: 0; overflow-wrap: anywhere; }
.gc-panel__eyebrow { display: block; margin: 0 0 var(--gc-space-2); font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); color: var(--gc-color-text-secondary); }
.gc-panel h1 { font-family: var(--gc-type-serif); font-weight: 400; font-size: var(--gc-type-display); line-height: 1.2; }
.gc-panel h2 { font-family: var(--gc-type-serif); font-weight: 400; font-size: var(--gc-type-title); line-height: 1.3; }
.gc-panel h1 + p, .gc-panel h2 + p { margin-top: var(--gc-space-2); color: var(--gc-color-text-secondary); }

.gc-button {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--gc-space-2);
  box-sizing: border-box; min-height: 48px; min-width: var(--gc-target-minimum); padding: 0 var(--gc-space-4);
  border: 1px solid var(--gc-color-text-primary); border-radius: var(--gc-radius-sm);
  background: transparent; color: var(--gc-color-text-primary); font-weight: 600; text-decoration: none; cursor: pointer;
  transition: background var(--gc-motion-fast) ease, color var(--gc-motion-fast) ease;
}
.gc-button--primary { background: var(--gc-color-text-primary); color: var(--gc-color-text-inverse); }
.gc-button--secondary { border-color: var(--gc-color-line-strong); }
.gc-button--text { border-color: transparent; text-decoration: underline; text-underline-offset: 0.2em; padding-inline: var(--gc-space-2); }
.gc-button:disabled { cursor: wait; opacity: 0.55; }
.gc-actions { display: flex; flex-wrap: wrap; gap: var(--gc-space-2); margin-top: var(--gc-space-4); }
.gc-actions > a, .gc-actions > button { min-width: 0; }

.gc-facts { display: grid; gap: 0; margin-top: var(--gc-space-4); border-top: var(--gc-rule); }
.gc-facts > div { display: grid; grid-template-columns: minmax(7rem, 0.6fr) 1.4fr; gap: var(--gc-space-3); padding: var(--gc-space-2) 0; border-bottom: var(--gc-rule); }
.gc-facts dt { color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.gc-facts dd { font-family: var(--gc-type-mono); overflow-wrap: anywhere; }
.gc-facts code { font-family: var(--gc-type-mono); }

/* Errors are ink on black with a solid rule: never red (red is the emblem only). */
.gc-error { margin-top: var(--gc-space-4); padding: var(--gc-space-3); border: 1px solid var(--gc-color-text-primary); background: var(--gc-color-surface-soft); line-height: 1.55; }
.gc-error a, .gc-error button { margin-left: var(--gc-space-2); }
.gc-empty { padding: var(--gc-space-6); border: 1px dashed var(--gc-color-line-strong); color: var(--gc-color-text-secondary); text-align: center; }

.gc-field { display: grid; gap: var(--gc-space-2); }
.gc-field input { min-height: 48px; padding: 0 var(--gc-space-3); border: 1px solid var(--gc-color-line-strong); border-radius: var(--gc-radius-sm); background: var(--gc-color-surface-canvas); color: var(--gc-color-text-primary); width: 100%; box-sizing: border-box; }

/* One boundary sentence per screen, pinned to the bottom of <main>. */
.gc-caption {
  position: sticky; bottom: 0; z-index: 5;
  margin-top: var(--gc-space-6); padding: var(--gc-space-2) var(--gc-space-4);
  border-top: var(--gc-rule); background: var(--gc-color-surface-canvas);
  color: var(--gc-color-text-secondary); font-size: 0.875rem;
}
.gc-details summary { cursor: pointer; min-height: var(--gc-target-minimum); display: list-item; align-content: center; }
.gc-visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.gc-center { min-height: 60vh; display: grid; place-items: center; padding: var(--gc-space-6) var(--gc-space-4); }

@media (max-width: 42rem) {
  .gc-caption { bottom: calc(var(--gc-nav-height) + env(safe-area-inset-bottom)); }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
@media print {
  .gc-caption, .gc-actions { display: none; }
}
```

In `apps/web/app/globals.css` delete the two-line rule `body {\n  letter-spacing: -0.018em;\n}` (inside the "Studio surface refresh" block). Nothing else in `globals.css` changes in this task.

- [ ] **Step 5: Vendor the fonts**

Add the packages (devDependencies — they are inputs to a script, not runtime imports):

```bash
pnpm --dir apps/web add -D @fontsource/noto-serif-kr@5.3.0 @fontsource-variable/pixelify-sans@5.3.0
```

If the registry is unreachable, stop here, remove `"serif"`/`"pixel"` from `tokens.json` and every `--gc-type-serif`/`--gc-type-pixel` use in this plan, and record it in the evidence (Global Constraints, fonts).

Add to `apps/web/package.json` scripts: `"fonts:vendor": "node scripts/vendor-fonts.mts"`.

Create `apps/web/scripts/vendor-fonts.mts`:

```ts
/**
 * Copies the two OFL display faces out of their npm packages into public/fonts (with LICENSE and
 * SOURCE.md) and writes styles/fonts/noto-serif-kr.css with relative urls, so the app never asks a
 * third-party host for a font. Deterministic: re-running produces identical files.
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const webRoot = resolve(import.meta.dirname, "..");
const fontsRoot = resolve(webRoot, "public/fonts");

function packageDir(name: string) {
  return dirname(require.resolve(`${name}/package.json`));
}

function assertOfl(licensePath: string, name: string) {
  const text = readFileSync(licensePath, "utf8");
  if (!text.includes("SIL Open Font License")) throw new Error(`${name}: LICENSE is not the SIL Open Font License`);
}

function writeSource(target: string, name: string, version: string, files: string[]) {
  writeFileSync(resolve(target, "SOURCE.md"), [
    `# ${name}`,
    "",
    `Source: npm package \`${name}@${version}\` (https://www.npmjs.com/package/${name}), copied by \`apps/web/scripts/vendor-fonts.mts\`.`,
    "Licence: SIL Open Font License 1.1 (`LICENSE` in this directory, copied verbatim from the package).",
    "No file here is requested from a third-party host at runtime; Next bundles them under /_next/static/media/.",
    "",
    "Files:",
    ...files.map((file) => `- ${file}`),
    "",
  ].join("\n"));
}

function vendorNotoSerifKr() {
  const name = "@fontsource/noto-serif-kr";
  const dir = packageDir(name);
  const version = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8")).version as string;
  const css = readFileSync(resolve(dir, "400.css"), "utf8");
  const target = resolve(fontsRoot, "noto-serif-kr");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const files = [...css.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)].map((match) => match[1]).sort();
  if (files.length === 0) throw new Error(`${name}: 400.css names no woff2 file`);
  for (const file of files) copyFileSync(resolve(dir, "files", file), resolve(target, file));
  assertOfl(resolve(dir, "LICENSE"), name);
  copyFileSync(resolve(dir, "LICENSE"), resolve(target, "LICENSE"));
  writeSource(target, name, version, files);
  const rewritten = css
    .replace(/,\s*url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, "")
    .replace(/url\(\.\/files\//g, "url(../../public/fonts/noto-serif-kr/");
  mkdirSync(resolve(webRoot, "styles/fonts"), { recursive: true });
  writeFileSync(
    resolve(webRoot, "styles/fonts/noto-serif-kr.css"),
    `/* Generated by scripts/vendor-fonts.mts from ${name}@${version} (weight 400, woff2 only). Do not edit. */\n${rewritten}`,
  );
  return files.length;
}

function vendorPixelifySans() {
  const name = "@fontsource-variable/pixelify-sans";
  const dir = packageDir(name);
  const version = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8")).version as string;
  const file = "pixelify-sans-latin-wght-normal.woff2";
  if (!readdirSync(resolve(dir, "files")).includes(file)) throw new Error(`${name}: ${file} missing`);
  const target = resolve(fontsRoot, "pixelify-sans");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  copyFileSync(resolve(dir, "files", file), resolve(target, file));
  assertOfl(resolve(dir, "LICENSE"), name);
  copyFileSync(resolve(dir, "LICENSE"), resolve(target, "LICENSE"));
  writeSource(target, name, version, [file]);
  return 1;
}

const serifCount = vendorNotoSerifKr();
const pixelCount = vendorPixelifySans();
console.log(`fonts:vendor noto-serif-kr=${serifCount} pixelify-sans=${pixelCount}`);
```

Run it:

```bash
pnpm --dir apps/web fonts:vendor
ls apps/web/public/fonts/noto-serif-kr | wc -l        # expected: N woff2 + LICENSE + SOURCE.md (N printed by the script)
head -3 apps/web/public/fonts/noto-serif-kr/LICENSE    # expected: "…SIL Open Font License, Version 1.1…"
grep -c '@font-face' apps/web/styles/fonts/noto-serif-kr.css   # expected: N
grep -c 'https\?://' apps/web/styles/fonts/noto-serif-kr.css   # expected: 0
```

Create `apps/web/lib/fonts/pixelify.ts`:

```ts
import localFont from "next/font/local";

/** Pixel numerals for display figures. Latin/digits only; Korean glyphs fall through to the mono stack. */
export const pixelifySans = localFont({
  src: "../../public/fonts/pixelify-sans/pixelify-sans-latin-wght-normal.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  variable: "--gc-font-pixel",
  fallback: ["IBM Plex Mono", "ui-monospace", "monospace"],
  adjustFontFallback: false,
});
```

Replace `apps/web/font-bundle.ts` with:

```ts
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./styles/fonts/noto-serif-kr.css";
```

Replace `apps/web/app/layout.tsx` with:

```tsx
import "../font-bundle";
import "@gc/design-tokens/tokens.css";
import "../styles/tokens.css";
import "./globals.css";
import "../styles/system.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pixelifySans } from "@/lib/fonts/pixelify";

export const metadata: Metadata = {
  title: {
    default: "앎 — 내 건강 기록의 출처까지",
    template: "%s · 앎",
  },
  description: "흩어진 건강 기록을 출처와 확인 이력까지 함께 관리하는 개인 건강 기록 서비스",
};

const applicationId = "genome-companion-korea-web";
const applicationInstance = process.env.GC_APPLICATION_INSTANCE_ID ?? "local-unverified-instance";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" className={pixelifySans.variable}>
      <body data-application-id={applicationId} data-application-instance={applicationInstance}>{children}</body>
    </html>
  );
}
```

(`./globals.css` stays imported until Task 5 deletes it; `system.css` is imported after it so the primitives win the cascade meanwhile.)

Replace `apps/web/tests/font-bundle.test.ts` with:

```ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(webRoot, path), "utf8");
const packageJson = JSON.parse(read("package.json"));

describe("bundled fonts (no third-party host, licences beside the files)", () => {
  it("pins every font package", () => {
    expect(packageJson.dependencies.pretendard).toBe("1.3.9");
    expect(packageJson.dependencies["@fontsource/ibm-plex-mono"]).toBe("5.3.0");
    expect(packageJson.devDependencies["@fontsource/noto-serif-kr"]).toBe("5.3.0");
    expect(packageJson.devDependencies["@fontsource-variable/pixelify-sans"]).toBe("5.3.0");
    expect(packageJson.scripts["fonts:vendor"]).toBe("node scripts/vendor-fonts.mts");
  });

  it("loads the Korean UI face as a dynamic subset and the mono weights locally", () => {
    const bundle = read("font-bundle.ts");
    expect(bundle).toContain("pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css");
    for (const weight of [400, 500, 600]) expect(bundle).toContain(`@fontsource/ibm-plex-mono/${weight}.css`);
    expect(bundle).toContain("./styles/fonts/noto-serif-kr.css");
  });

  it("vendors Noto Serif KR: every url resolves to a committed woff2, licence and source are present", () => {
    const sheet = read("styles/fonts/noto-serif-kr.css");
    const urls = [...sheet.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^\.\.\/\.\.\/public\/fonts\/noto-serif-kr\/[a-z0-9-]+\.woff2$/);
      expect(existsSync(resolve(webRoot, "styles/fonts", url))).toBe(true);
    }
    expect(sheet).not.toMatch(/format\('woff'\)/);
    expect(read("public/fonts/noto-serif-kr/LICENSE")).toContain("SIL Open Font License, Version 1.1");
    expect(read("public/fonts/noto-serif-kr/SOURCE.md")).toContain("@fontsource/noto-serif-kr@5.3.0");
  });

  it("vendors Pixelify Sans through next/font/local with its licence", () => {
    const dir = resolve(webRoot, "public/fonts/pixelify-sans");
    expect(readdirSync(dir).sort()).toEqual(["LICENSE", "SOURCE.md", "pixelify-sans-latin-wght-normal.woff2"]);
    expect(read("public/fonts/pixelify-sans/LICENSE")).toContain("SIL Open Font License, Version 1.1");
    const loader = read("lib/fonts/pixelify.ts");
    expect(loader).toContain('from "next/font/local"');
    expect(loader).toContain('"../../public/fonts/pixelify-sans/pixelify-sans-latin-wght-normal.woff2"');
    expect(loader).toContain('variable: "--gc-font-pixel"');
    expect(read("app/layout.tsx")).toContain("className={pixelifySans.variable}");
  });

  it("never names a remote font service", () => {
    const sources = ["font-bundle.ts", "styles/fonts/noto-serif-kr.css", "styles/tokens.css", "styles/system.css", "app/globals.css"]
      .filter((path) => existsSync(resolve(webRoot, path)))
      .map(read)
      .join("\n");
    expect(sources).not.toMatch(/fonts\.googleapis|use\.typekit|https?:\/\//);
  });
});
```

- [ ] **Step 6: Motion presets and synchronous reduced-motion**

Create `apps/web/lib/motion/springs.ts` (moved verbatim from `lib/home/alive-trajectory.ts`, plus the doc line):

```ts
/**
 * The three shared spring presets (spec §2) plus the draw-in preset the hero uses. Pure numbers and
 * a sub-stepped integrator; no DOM. Every preset is identical for every item: motion never encodes
 * a value.
 */
export type SpringParams = { mass: number; stiffness: number; damping: number };

/** Detent snap (iOS timer drum). */
export const PICKER: SpringParams = { mass: 0.8, stiffness: 260, damping: 34 };
/** Orbit phase smoothing. */
export const DRIFT: SpringParams = { mass: 1.4, stiffness: 36, damping: 15 };
/** Axis breathing: slow, slightly under-damped. */
export const BREATH: SpringParams = { mass: 2.0, stiffness: 18, damping: 9 };
/** Stroke draw-in. */
export const DRAW: SpringParams = { mass: 1.2, stiffness: 50, damping: 18 };

const SUB_STEP = 0.004;

/** A critically-ish damped spring integrated with fixed sub-steps. */
export class Spring {
  x: number;
  t: number;
  v: number;
  p: SpringParams;

  constructor(value: number, params: SpringParams) {
    this.x = value;
    this.t = value;
    this.v = 0;
    this.p = params;
  }

  /** Move the target the spring pulls toward. */
  set(target: number) {
    this.t = target;
  }

  /** Teleport to a value with zero velocity and the same target. */
  jump(value: number) {
    this.x = value;
    this.t = value;
    this.v = 0;
  }

  /** Advance by dt seconds (sub-stepped for stability) and return the new position. */
  step(dt: number): number {
    const n = Math.max(1, Math.ceil(dt / SUB_STEP));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      const acceleration = (-this.p.stiffness * (this.x - this.t) - this.p.damping * this.v) / this.p.mass;
      this.v += acceleration * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}
```

In `apps/web/lib/home/alive-trajectory.ts` delete everything from `export type SpringParams` through the end of the `Spring` class (the `SUB_STEP` constant included) and put at the top of the file:

```ts
import { BREATH, PICKER, Spring } from "@/lib/motion/springs";

export { BREATH, DRAW, DRIFT, PICKER, Spring, type SpringParams } from "@/lib/motion/springs";
```

(`tests/alive-trajectory.test.ts` keeps importing `Spring`/`PICKER` from `@/lib/home/alive-trajectory` and stays green.)

Create `apps/web/lib/motion/reduced-motion.ts`:

```ts
import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function mediaQuery() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

/** Read synchronously: the very first client render already knows the answer (no animated flash). */
export function prefersReducedMotion(): boolean {
  return mediaQuery()?.matches ?? false;
}

function subscribe(onChange: () => void) {
  const media = mediaQuery();
  if (!media) return () => {};
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** False on the server; the client's first committed render uses the real media-query value. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
```

Delete `apps/web/lib/my-data/reduced-motion.ts`. In `apps/web/components/home/AliveTrajectory.tsx` and `apps/web/components/my-data/LivingCellCanvas.tsx` change the import to `import { usePrefersReducedMotion } from "@/lib/motion/reduced-motion";`.

- [ ] **Step 7: Write the failing Patch test**

Create `apps/web/tests/patch.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { PATCH_SLOGAN, Patch } from "@/components/ui/Patch";
import { FORBIDDEN_JUDGEMENT_WORDS } from "./fixtures/forbidden-words";

afterEach(cleanup);

it("renders slash-separated metadata as separate spans, so a status word stays findable by itself", () => {
  render(<Patch variant="badge" meta={["앎", "예시 데이터"]} />);
  expect(screen.getByText("예시 데이터")).toBeVisible();
  expect(screen.getByText("앎", { selector: "[data-part='meta-item']" })).toBeVisible();
  expect(screen.getByText("/")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByTestId("patch")).toHaveAttribute("data-variant", "badge");
});

it("shows the red emblem only as a decorative mark and prints the two-line slogan verbatim on the card", () => {
  const { container } = render(<Patch variant="card" meta={["기록", "8"]} slogan={PATCH_SLOGAN} />);
  const emblem = container.querySelector("[data-part='emblem']");
  expect(emblem).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByText("값보다 먼저.")).toBeVisible();
  expect(screen.getByText("출처를 확인해요.")).toBeVisible();
  expect(container.querySelector("[data-part='mark']")).toHaveTextContent("앎");
});

it("hides the emblem on the badge by default and shows it when asked", () => {
  const badge = render(<Patch variant="badge" meta={["앎", "예시"]} />);
  expect(badge.container.querySelector("[data-part='emblem']")).toBeNull();
  cleanup();
  const wordmark = render(<Patch variant="wordmark" />);
  expect(wordmark.container.querySelector("[data-part='emblem']")).not.toBeNull();
});

it("contains no judgement word and passes axe in every variant", async () => {
  for (const variant of ["wordmark", "badge", "card"] as const) {
    const { container } = render(<Patch variant={variant} meta={["앎", "합성 체험"]} slogan={PATCH_SLOGAN}>본문</Patch>);
    for (const word of FORBIDDEN_JUDGEMENT_WORDS) expect(container.textContent).not.toContain(word);
    expect(await axe(container)).toHaveNoViolations();
    cleanup();
  }
});
```

Run: `pnpm --dir apps/web exec vitest run tests/patch.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/Patch'`.

- [ ] **Step 8: Implement `Patch`**

Create `apps/web/components/ui/Patch.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "@/components/ui/Patch.module.css";

export type PatchVariant = "wordmark" | "badge" | "card";

/** The two-line slogan from the embroidered patch reference (spec §3). Verbatim. */
export const PATCH_SLOGAN = ["값보다 먼저.", "출처를 확인해요."] as const;

export type PatchProps = {
  variant?: PatchVariant;
  /** Metadata items rendered as "a / b / c"; each item is its own span so tests and readers see it alone. */
  meta?: readonly string[];
  slogan?: readonly [string, string];
  /** The red 앎 emblem in a circle. Decorative (aria-hidden). Defaults on for wordmark and card. */
  emblem?: boolean;
  children?: ReactNode;
  className?: string;
};

/**
 * Black patch with cream stitching: wordmark (header), badge (status pill), card (empty states,
 * 진료 준비 cover). Texture is CSS only (noise gradient + double rule); no image. Nothing here
 * varies with a value.
 */
export function Patch({ variant = "badge", meta, slogan, emblem = variant !== "badge", children, className }: PatchProps) {
  return (
    <div className={[styles.patch, styles[variant], className].filter(Boolean).join(" ")} data-variant={variant} data-testid="patch">
      <span className={styles.top}>
        <span className={styles.mark} data-part="mark">앎</span>
        {emblem ? <span className={styles.emblem} data-part="emblem" aria-hidden="true">앎</span> : null}
      </span>
      {meta && meta.length > 0 ? (
        <span className={styles.meta}>
          {meta.map((item, index) => (
            <span key={`${item}-${index}`} className={styles.metaItem}>
              {index > 0 ? <span className={styles.slash} aria-hidden="true">/</span> : null}
              <span data-part="meta-item">{item}</span>
            </span>
          ))}
        </span>
      ) : null}
      {children}
      {slogan ? (
        <span className={styles.slogan}>
          <span>{slogan[0]}</span>
          <span>{slogan[1]}</span>
        </span>
      ) : null}
    </div>
  );
}
```

Create `apps/web/components/ui/Patch.module.css`:

```css
.patch {
  display: inline-grid;
  gap: var(--gc-space-2);
  min-width: 0;
  padding: var(--gc-space-2) var(--gc-space-3);
  border: var(--gc-rule-double);
  border-radius: var(--gc-radius-patch);
  background-color: var(--gc-color-surface-raised);
  background-image: var(--gc-patch-noise);
  color: var(--gc-color-text-primary);
  font-family: var(--gc-type-mono);
  font-size: var(--gc-type-meta);
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.badge { grid-auto-flow: column; align-items: center; gap: var(--gc-space-2); padding: var(--gc-space-1) var(--gc-space-3); }
.badge .top { display: none; }
.wordmark { grid-auto-flow: column; align-items: center; padding: var(--gc-space-1) var(--gc-space-2); }
.card { padding: var(--gc-space-4); gap: var(--gc-space-3); width: 100%; box-sizing: border-box; }
.top { display: inline-flex; align-items: center; justify-content: space-between; gap: var(--gc-space-2); }
.mark { font-family: var(--gc-type-serif); font-size: 1.125rem; line-height: 1; }
.card .mark { font-size: 1.5rem; }
.emblem {
  display: inline-grid; place-items: center; box-sizing: border-box;
  width: 1.375rem; height: 1.375rem;
  border: 1px solid var(--gc-color-line-strong); border-radius: 50%;
  color: var(--gc-color-emblem); font-family: var(--gc-type-serif); font-size: var(--gc-type-meta); line-height: 1;
}
.meta { display: inline-flex; flex-wrap: wrap; gap: var(--gc-space-1); color: var(--gc-color-text-secondary); }
.metaItem { display: inline-flex; gap: var(--gc-space-1); }
.slash { color: var(--gc-color-line-strong); }
.slogan { display: grid; font-family: var(--gc-type-sans); font-size: 0.875rem; line-height: 1.4; color: var(--gc-color-text-primary); }
```

Run: `pnpm --dir apps/web exec vitest run tests/patch.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Contract test, first version**

Create `apps/web/tests/design-system-contract.test.ts` (Task 5 extends it to the whole tree; this version checks the new files and the two things Task 1 already fixes):

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(webRoot, path), "utf8");

export const ALLOWED_FONT_NAMES = ["Pretendard Variable", "Pretendard", "IBM Plex Mono", "Noto Serif KR", "Pixelify Sans"];
export const ALLOWED_MEDIA = ["(max-width: 42rem)", "(max-width: 56rem)", "(min-width: 56.01rem)", "(hover: hover)", "(prefers-reduced-motion: reduce)", "print"];

describe("design-system contract (Task 1 scope)", () => {
  const files = ["styles/tokens.css", "styles/system.css", "components/ui/Patch.module.css"];

  it("declares the web composition tokens", () => {
    const tokens = read("styles/tokens.css");
    for (const name of ["--gc-rule", "--gc-rule-double", "--gc-grid-image", "--gc-grid-size", "--gc-time-gradient", "--gc-patch-noise", "--gc-shell-height", "--gc-nav-height", "--gc-type-display", "--gc-type-title"]) {
      expect(tokens).toContain(`${name}:`);
    }
  });

  it("uses uppercase and tracking only in .gc-meta--latin, and never a font under 12px", () => {
    for (const file of files) {
      const css = read(file);
      const rules = css.split("}");
      for (const rule of rules) {
        if (/text-transform:\s*uppercase|letter-spacing/.test(rule)) expect(rule, `${file}: ${rule.trim().slice(0, 60)}`).toContain(".gc-meta--latin");
        for (const match of rule.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)) {
          const px = match[2] === "px" ? Number(match[1]) : Number(match[1]) * 16;
          expect(px, `${file}: ${match[0]}`).toBeGreaterThanOrEqual(12);
        }
      }
    }
    expect(read("app/globals.css")).not.toMatch(/body\s*\{[^}]*letter-spacing/);
  });

  it("names only bundled faces and only the one breakpoint scale in the new files", () => {
    for (const file of files) {
      const css = read(file);
      for (const match of css.matchAll(/font-family:\s*([^;]+);/g)) {
        for (const quoted of match[1].matchAll(/"([^"]+)"/g)) expect(ALLOWED_FONT_NAMES, `${file}: ${quoted[1]}`).toContain(quoted[1]);
      }
      for (const match of css.matchAll(/@media\s+([^{]+)\{/g)) {
        expect(ALLOWED_MEDIA, `${file}: @media ${match[1].trim()}`).toContain(match[1].trim());
      }
    }
  });
});
```

- [ ] **Step 10: Run the web gates**

```bash
pnpm web:test
pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json
pnpm --dir apps/web build
git checkout -- apps/web/next-env.d.ts
```
Expected: all vitest files pass (the two tests replaced above plus `patch`, `design-system-contract`, `generated-token-consumption` — the latter still resolves every `--gc-*` reference in `globals.css` because every old name still exists in the regenerated `dist/tokens.css`); `tsc` clean; `next build` compiles with `/` … `/my-data/history` listed. `studio-design-contract.test.ts` still passes (`--gc-studio-*`, `-0.055em` on `.gc-demo-entry h1`, `.gc-health-home__hero {` are untouched until Task 5).

- [ ] **Step 11: Commit**

```bash
git add packages/design-tokens apps/web/styles apps/web/public/fonts apps/web/scripts/vendor-fonts.mts apps/web/lib/fonts apps/web/lib/motion apps/web/lib/home/alive-trajectory.ts apps/web/components/home/AliveTrajectory.tsx apps/web/components/my-data/LivingCellCanvas.tsx apps/web/components/ui apps/web/tests/patch.test.tsx apps/web/tests/design-system-contract.test.ts apps/web/tests/font-bundle.test.ts apps/web/font-bundle.ts apps/web/app/layout.tsx apps/web/app/globals.css apps/web/package.json pnpm-lock.yaml
git rm -q apps/web/lib/my-data/reduced-motion.ts
git commit -m "feat(web): Wave 6 foundation — dark tokens, vendored OFL faces, spring presets, Patch badge

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 2: Shell and navigation — six destinations, dark everywhere, mobile bar, copy-terminology map

**Files:**
- Rewrite: `apps/web/components/integrated/IntegratedShell.tsx`
- Create: `apps/web/components/integrated/IntegratedShell.module.css`, `apps/web/lib/copy/terminology.ts`, `apps/web/tests/terminology.test.ts`
- Delete: `apps/web/components/home/AliveShellTone.module.css`
- Modify: `apps/web/tests/integrated-shell.test.tsx`, `apps/web/components/integrated/IntegratedHealthExperience.tsx` (drop `tone="dark"` on both call sites), `apps/web/app/records/page.tsx` (metadata title), `apps/web/e2e/foundation-lifecycle.spec.ts`, `apps/web/app/globals.css` (delete the `.gc-shell*` rules)

**Interfaces:**
- Consumes: `Patch` (Task 1), tokens.
- Produces: `IntegratedShell({ current: IntegratedRoute; status?: string; children })` with `IntegratedRoute = "home" | "my-data" | "history" | "records" | "prepare" | "data-control"` (no `tone` prop any more); `SHELL_DESTINATIONS: ReadonlyArray<{ key: IntegratedRoute; href: string; label: string; mobile: boolean }>`; `lib/copy/terminology.ts` exports `TERMS`, `SCREEN_TITLES`, `NAV_LABELS`, `RETIRED_TERMS`, `SYSTEM_NOTE_TERMS`, `START_SCREEN_ONLY_TERMS`. Every screen renders its `<main>` as the direct child of the shell (`.page > main` receives the bottom-bar padding).

- [ ] **Step 1: Write the terminology map and its test**

Create `apps/web/lib/copy/terminology.ts`:

```ts
/**
 * The Wave 6 copy map (spec §5, §8.11, §8.15). Screens use the canonical words; the rendered-text
 * scan in tests/korean-ux-copy.test.ts rejects the retired ones. Every string change a later task
 * makes traces back to a row here.
 */
export const TERMS = {
  sheet: "결과지",
  item: "항목",
  value: "값",
  examDate: "검사일",
  source: "출처",
  confirm: "확인",
} as const;

export const SCREEN_TITLES = {
  home: "홈",
  myData: "나의 데이터",
  history: "측정 이력",
  records: "내 기록",
  prepare: "진료 준비",
  dataControl: "데이터 관리",
} as const;

export const NAV_LABELS = [
  SCREEN_TITLES.home,
  SCREEN_TITLES.myData,
  SCREEN_TITLES.history,
  SCREEN_TITLES.records,
  SCREEN_TITLES.prepare,
  SCREEN_TITLES.dataControl,
] as const;

/** Words that never reach a screen again, and what replaced them. */
export const RETIRED_TERMS: ReadonlyArray<{ retired: string; useInstead: string }> = [
  { retired: "합성 PDF", useInstead: "예시 결과지" },
  { retired: "합성 결과지", useInstead: "예시 결과지" },
  { retired: "합성 후보", useInstead: "확인할 항목" },
  { retired: "합성 기록", useInstead: "기록" },
  { retired: "합성 프로필", useInstead: "기록과 동의" },
  { retired: "후보", useInstead: "항목" },
  { retired: "내 데이터", useInstead: "나의 데이터 (화면 제목) / 데이터 관리 (화면 제목)" },
  { retired: "신뢰 경계", useInstead: "데이터 관리 › 자세히" },
  { retired: "서버 응답만 표시해요", useInstead: "데이터 관리 › 자세히" },
  { retired: "체험 중", useInstead: "예시 데이터" },
];

/** System explanations: allowed only inside the 데이터 관리 `자세히` block. */
export const SYSTEM_NOTE_TERMS = ["적대적", "격리", "OCR", "의료 AI", "외부 연결 0곳", "MyHealthWay", "비활성화"] as const;

/** Allowed on the start screen (pre-login entry and its restore-failed state) only. */
export const START_SCREEN_ONLY_TERMS = ["체험"] as const;
```

Create `apps/web/tests/terminology.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { NAV_LABELS, RETIRED_TERMS, SCREEN_TITLES, SYSTEM_NOTE_TERMS, TERMS } from "@/lib/copy/terminology";
import { SHELL_DESTINATIONS } from "@/components/integrated/IntegratedShell";

const webRoot = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(webRoot, path), "utf8");

it("names the six destinations in the canonical order and words", () => {
  expect(SHELL_DESTINATIONS.map((d) => d.label)).toEqual([...NAV_LABELS]);
  expect(SHELL_DESTINATIONS.map((d) => d.href)).toEqual(["/", "/my-data", "/my-data/history", "/records", "/prepare", "/data-control"]);
  expect(SHELL_DESTINATIONS.filter((d) => d.mobile).map((d) => d.label)).toEqual(["홈", "나의 데이터", "측정 이력", "내 기록", "데이터 관리"]);
});

it("keeps the page metadata titles on the canonical screen titles", () => {
  expect(read("app/my-data/page.tsx")).toContain(`title: "${SCREEN_TITLES.myData}"`);
  expect(read("app/my-data/history/page.tsx")).toContain(`title: "${SCREEN_TITLES.history}"`);
  expect(read("app/records/page.tsx")).toContain(`title: "${SCREEN_TITLES.records}"`);
  expect(read("app/prepare/page.tsx")).toContain(`title: "${SCREEN_TITLES.prepare}"`);
  expect(read("app/data-control/page.tsx")).toContain(`title: "${SCREEN_TITLES.dataControl}"`);
});

it("never retires a canonical term or a screen title", () => {
  const canonical = [...Object.values(TERMS), ...Object.values(SCREEN_TITLES)];
  for (const { retired } of RETIRED_TERMS) expect(canonical, retired).not.toContain(retired);
  for (const term of SYSTEM_NOTE_TERMS) expect(canonical, term).not.toContain(term);
});
```

Run: `pnpm --dir apps/web exec vitest run tests/terminology.test.ts`
Expected: FAIL — `SHELL_DESTINATIONS` is not exported (and `app/records/page.tsx` still says `건강 기록`).

- [ ] **Step 2: Write the failing shell test**

Replace `apps/web/tests/integrated-shell.test.tsx` with:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { IntegratedShell, SHELL_DESTINATIONS } from "@/components/integrated/IntegratedShell";

afterEach(cleanup);

it("offers every destination and marks exactly the current screen", () => {
  render(<IntegratedShell current="prepare"><main>본문</main></IntegratedShell>);
  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  expect(within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["홈", "/"],
    ["나의 데이터", "/my-data"],
    ["측정 이력", "/my-data/history"],
    ["내 기록", "/records"],
    ["진료 준비", "/prepare"],
    ["데이터 관리", "/data-control"],
  ]);
  expect(within(nav).getByRole("link", { name: "진료 준비" })).toHaveAttribute("aria-current", "page");
  expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  expect(screen.getByRole("link", { name: "앎 홈" })).toHaveAttribute("href", "/");
});

it("marks 홈 current on the home screen and 측정 이력 on the history screen", () => {
  const { rerender } = render(<IntegratedShell current="home"><main>본문</main></IntegratedShell>);
  const nav = () => screen.getByRole("navigation", { name: "주요 메뉴" });
  expect(within(nav()).getByRole("link", { name: "홈" })).toHaveAttribute("aria-current", "page");
  rerender(<IntegratedShell current="history"><main>본문</main></IntegratedShell>);
  expect(within(nav()).getByRole("link", { name: "측정 이력" })).toHaveAttribute("aria-current", "page");
  expect(within(nav()).getByRole("link", { name: "나의 데이터" })).not.toHaveAttribute("aria-current");
});

it("flags 진료 준비 as a desktop-only destination so the mobile bar holds five", () => {
  render(<IntegratedShell current="records"><main>본문</main></IntegratedShell>);
  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  expect(within(nav).getByRole("link", { name: "진료 준비" })).toHaveAttribute("data-mobile", "false");
  expect(nav.querySelectorAll('a[data-mobile="true"]')).toHaveLength(5);
  expect(SHELL_DESTINATIONS).toHaveLength(6);
});

it("shows the status badge only when the screen has one, as a patch with the word alone", () => {
  const { rerender } = render(
    <IntegratedShell current="records" status="예시 데이터"><main>본문</main></IntegratedShell>,
  );
  expect(screen.getByText("예시 데이터")).toBeVisible();
  expect(screen.getByTestId("patch-status-wrap").querySelector("[data-testid='patch']")).toHaveAttribute("data-variant", "badge");
  rerender(<IntegratedShell current="records"><main>본문</main></IntegratedShell>);
  expect(screen.queryByText("예시 데이터")).toBeNull();
});

it("pairs each written destination with a decorative, non-focusable line icon", () => {
  render(<IntegratedShell current="records"><main>본문</main></IntegratedShell>);
  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  for (const destination of SHELL_DESTINATIONS) {
    const link = within(nav).getByRole("link", { name: destination.label });
    expect(within(link).getByText(destination.label, { exact: true })).toBeVisible();
    const icon = link.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("focusable", "false");
    expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
  }
});

it("stays accessible on every route", async () => {
  for (const current of ["home", "my-data", "history", "records", "prepare", "data-control"] as const) {
    const { container } = render(
      <IntegratedShell current={current} status="예시 데이터"><main>본문</main></IntegratedShell>,
    );
    expect(await axe(container)).toHaveNoViolations();
    cleanup();
  }
});
```

Run: `pnpm --dir apps/web exec vitest run tests/integrated-shell.test.tsx`
Expected: FAIL (two links instead of six; `SHELL_DESTINATIONS` missing).

- [ ] **Step 3: Rewrite the shell**

Replace `apps/web/components/integrated/IntegratedShell.tsx` with:

```tsx
"use client";

import type { ReactNode } from "react";
import { Patch } from "@/components/ui/Patch";
import { SCREEN_TITLES } from "@/lib/copy/terminology";
import styles from "@/components/integrated/IntegratedShell.module.css";

export type IntegratedRoute = "home" | "my-data" | "history" | "records" | "prepare" | "data-control";

/** Every real destination, in header order. `mobile: false` keeps a link out of the bottom bar. */
export const SHELL_DESTINATIONS: ReadonlyArray<{ key: IntegratedRoute; href: string; label: string; mobile: boolean }> = [
  { key: "home", href: "/", label: SCREEN_TITLES.home, mobile: true },
  { key: "my-data", href: "/my-data", label: SCREEN_TITLES.myData, mobile: true },
  { key: "history", href: "/my-data/history", label: SCREEN_TITLES.history, mobile: true },
  { key: "records", href: "/records", label: SCREEN_TITLES.records, mobile: true },
  { key: "prepare", href: "/prepare", label: SCREEN_TITLES.prepare, mobile: false },
  { key: "data-control", href: "/data-control", label: SCREEN_TITLES.dataControl, mobile: true },
];

// 24px line drawings; the written label owns the accessible name. No icon points up or down.
const routeIconPaths: Record<IntegratedRoute, string> = {
  home: "M4 11l8-7 8 7v9h-5v-6H9v6H4z",
  "my-data": "M4 18h16M6 14h2v4H6zM10 10h2v8h-2zM14 12h2v6h-2zM18 6h2v12h-2z",
  history: "M4 12h16M8 9v6M12 9v6M16 9v6",
  records: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4",
  prepare: "M8 4h8v3H8zM6 7h12v13H6zM9 12h6M9 16h4",
  "data-control": "M4 6h5m4 0h7M4 12h9m4 0h3M4 18h3m4 0h9M9 4v4m4 2v4m-6 2v4",
};

type IntegratedShellProps = {
  current: IntegratedRoute;
  /** A state word for the badge ("예시 데이터", "예시 데이터로 체험"). Never a health value. */
  status?: string;
  children: ReactNode;
};

/**
 * The one app bar: patch wordmark, every destination, an optional status patch. Black on every
 * screen. Under 42rem the destinations become a fixed bottom bar of five; the page's <main> gets
 * the matching bottom padding so no CTA or body text is ever covered.
 */
export function IntegratedShell({ current, status, children }: IntegratedShellProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.bar}>
          <a className={styles.brand} href="/" aria-label="앎 홈">
            <Patch variant="wordmark" />
          </a>
          <nav className={styles.nav} aria-label="주요 메뉴">
            {SHELL_DESTINATIONS.map((destination) => (
              <a
                key={destination.key}
                href={destination.href}
                aria-current={destination.key === current ? "page" : undefined}
                data-mobile={destination.mobile ? "true" : "false"}
              >
                <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d={routeIconPaths[destination.key]} />
                </svg>
                <span>{destination.label}</span>
              </a>
            ))}
          </nav>
          {status ? (
            <div className={styles.status} data-testid="patch-status-wrap">
              <Patch variant="badge" meta={["앎", status]} className={styles.statusPatch} />
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}
```

Create `apps/web/components/integrated/IntegratedShell.module.css`:

```css
.page { min-height: 100dvh; display: flex; flex-direction: column; background: var(--gc-color-surface-canvas); color: var(--gc-color-text-primary); }
.page > main { flex: 1 1 auto; min-width: 0; }
.header { border-bottom: var(--gc-rule); background: var(--gc-color-surface-canvas); }
.bar {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--gc-space-4);
  box-sizing: border-box; width: min(100% - 2rem, 80rem); min-height: var(--gc-shell-height); margin-inline: auto;
}
.brand { display: inline-flex; min-height: var(--gc-target-minimum); align-items: center; text-decoration: none; }
.nav { display: flex; gap: var(--gc-space-1); min-width: 0; overflow-x: auto; scrollbar-width: none; }
.nav a {
  display: inline-flex; align-items: center; gap: var(--gc-space-2); box-sizing: border-box;
  min-height: 48px; min-width: 3rem; padding: 0 var(--gc-space-3);
  color: var(--gc-color-text-secondary); text-decoration: none; white-space: nowrap;
  border-bottom: 2px solid transparent; font-size: 0.9375rem; font-weight: 600;
}
.nav a[aria-current="page"] { color: var(--gc-color-text-primary); border-bottom-color: var(--gc-color-text-primary); }
@media (hover: hover) { .nav a:hover { color: var(--gc-color-text-primary); } }
.icon { width: 1.25rem; height: 1.25rem; flex: none; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
.status { justify-self: end; min-width: 0; }
.statusPatch { max-width: 100%; }

@media (max-width: 42rem) {
  .bar { grid-template-columns: auto minmax(0, 1fr); width: min(100% - 1.5rem, 80rem); }
  .status { grid-column: 2; }
  .nav {
    position: fixed; inset: auto 0 0 0; z-index: 20;
    display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0;
    box-sizing: border-box; min-height: var(--gc-nav-height);
    padding: var(--gc-space-1) var(--gc-space-2) max(var(--gc-space-1), env(safe-area-inset-bottom));
    border-top: var(--gc-rule); background: var(--gc-color-surface-canvas); overflow: visible;
  }
  .nav a {
    flex-direction: column; justify-content: center; gap: 2px;
    min-width: 0; min-height: 56px; padding: 4px 2px;
    font-size: var(--gc-type-meta); line-height: 1.25; font-weight: 600; white-space: normal; text-align: center;
    border-bottom: 0; border-top: 2px solid transparent; overflow-wrap: anywhere;
  }
  .nav a[aria-current="page"] { border-top-color: var(--gc-color-text-primary); }
  .nav a[data-mobile="false"] { display: none; }
  .page > main { padding-bottom: calc(var(--gc-nav-height) + var(--gc-space-6) + env(safe-area-inset-bottom)); }
}
@media print { .header { display: none; } }
```

Delete `apps/web/components/home/AliveShellTone.module.css`. In `apps/web/components/integrated/IntegratedHealthExperience.tsx` remove ` tone="dark"` from both `<IntegratedShell …>` call sites (`status="예시 데이터로 체험" tone="dark"` and `status={session ? "예시 데이터로 체험 중" : undefined} tone="dark"`). In `apps/web/app/records/page.tsx` change `title: "건강 기록"` to `title: "내 기록"`.

In `apps/web/app/globals.css` delete every rule whose selector mentions `gc-shell`: the block under `/* Shared integrated app bar … */` (`.gc-shell` … `.gc-shell a:focus-visible`), the `.gc-shell--unified …` and `.gc-shell__nav-icon` rules under `/* Unified working surfaces … */`, the `.gc-shell*` selectors inside the first `@media (max-width: 42rem) { … }` block (keep that block's `.gc-records-unified …` and `.gc-import[data-stage="review"] …` lines), `@media print { .gc-shell--unified { display: none; } }`, `.gc-shell + main { … }`, the `@media (max-width: 42rem) { .gc-shell__bar … .gc-shell__nav { justify-self: end; } }` block that follows it, and the `.gc-shell,` line in the final `@media print` block. Verify: `grep -c 'gc-shell' apps/web/app/globals.css` prints `0`.

Run: `pnpm --dir apps/web exec vitest run tests/integrated-shell.test.tsx tests/terminology.test.ts`
Expected: PASS.

- [ ] **Step 4: Update the browser lifecycle for six destinations**

In `apps/web/e2e/foundation-lifecycle.spec.ts`:

1. Add after the `viewports` constant:

```ts
const NAV_LABELS = ["홈", "나의 데이터", "측정 이력", "내 기록", "진료 준비", "데이터 관리"] as const;
const MOBILE_NAV_LABELS = NAV_LABELS.filter((label) => label !== "진료 준비");
```

2. In `captureMatrix`, replace the nav block (from `const nav = page.getByRole("navigation", { name: "주요 메뉴" });` through the closing brace of `if (await nav.count()) { … }`) with:

```ts
    const nav = page.getByRole("navigation", { name: "주요 메뉴" });
    if (await nav.count()) {
      // Every screen marks exactly one destination current (the home marks 홈).
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      const mobile = width <= 672;
      const visibleLabels = mobile ? MOBILE_NAV_LABELS : NAV_LABELS;
      await expect(nav.getByRole("link")).toHaveCount(visibleLabels.length);
      for (const label of visibleLabels) {
        const link = nav.getByRole("link", { name: label, exact: true });
        const target = await link.boundingBox();
        const icon = await link.locator("svg").boundingBox();
        const text = await link.locator("span").boundingBox();
        expect(target, `${state} ${width}: ${label} target`).not.toBeNull();
        expect(icon).not.toBeNull();
        expect(text).not.toBeNull();
        expect(target!.height).toBeGreaterThanOrEqual(mobile ? 56 : 48);
        expect(target!.width).toBeGreaterThanOrEqual(48);
        expect(target!.y).toBeGreaterThanOrEqual(0);
        expect(target!.y + target!.height).toBeLessThanOrEqual(height);
        expect(icon!.width).toBeGreaterThanOrEqual(20);
        expect(text!.x).toBeGreaterThanOrEqual(target!.x - 1);
        expect(text!.x + text!.width).toBeLessThanOrEqual(target!.x + target!.width + 1);
        if (mobile) expect(text!.y).toBeGreaterThanOrEqual(icon!.y + icon!.height);
      }
      if (mobile) {
        // The fixed bar never covers the primary action (§8.5).
        const bar = await nav.boundingBox();
        const firstButton = page.getByRole("main").getByRole("button").first();
        if (await firstButton.count()) {
          const box = await firstButton.boundingBox();
          if (box && box.y < height) expect(box.y + box.height).toBeLessThanOrEqual(bar!.y + 1);
        }
      }
    }
```

3. Replace the keyboard-navigation loop (`for (const [label, path] of [["나의 데이터", "/my-data"], ["데이터 관리", "/data-control"]]) { … }`) with:

```ts
  for (const [label, path] of [["나의 데이터", "/my-data"], ["측정 이력", "/my-data/history"], ["내 기록", "/records"], ["진료 준비", "/prepare"], ["데이터 관리", "/data-control"], ["홈", "/"]] as const) {
    const link = page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: label, exact: true });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new URL(path, page.url()).href);
    await expect(page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: label, exact: true }))
      .toHaveAttribute("aria-current", "page");
  }
```

and delete the block that follows it (`// These routes are still reachable, but no longer have their own top-level nav entry …` through its closing `}`).

4. Replace `await expect(page.getByRole("navigation", {name:"주요 메뉴"}).getByRole("link")).toHaveCount(2);` (inside the `/connections`, `/providers`, `/data-control` loop) with `await expect(page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "데이터 관리" })).toHaveAttribute("aria-current", "page");`.

- [ ] **Step 5: Run the gates and the lifecycle**

```bash
pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm --dir apps/web build
pnpm foundation:e2e
git checkout -- apps/web/next-env.d.ts
```
Expected: vitest green; `3 passed` in the lifecycle. If a 320px capture reports an overflow naming the nav or a link, the bar padding or the label font is the cause — never widen a viewport.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/integrated/IntegratedShell.tsx apps/web/components/integrated/IntegratedShell.module.css apps/web/lib/copy apps/web/tests/terminology.test.ts apps/web/tests/integrated-shell.test.tsx apps/web/components/integrated/IntegratedHealthExperience.tsx apps/web/app/records/page.tsx apps/web/app/globals.css apps/web/e2e/foundation-lifecycle.spec.ts
git rm -q apps/web/components/home/AliveShellTone.module.css
git commit -m "feat(web): one dark shell with every destination, a five-item mobile bar and the Wave 6 copy map

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 3: Split `IntegratedHealthExperience` into views + one hook; URL-backed import flow

**Files:**
- Create: `apps/web/lib/experience/use-experience-state.ts`, `apps/web/components/experience/ImportFlowProvider.tsx`, `apps/web/components/experience/EntryView.tsx`, `apps/web/components/experience/RestoreFailedView.tsx`, `apps/web/components/experience/HomeView.tsx`, `apps/web/components/experience/ConsentView.tsx`, `apps/web/components/experience/SourceView.tsx`, `apps/web/components/experience/ProcessingView.tsx`, `apps/web/components/experience/ReviewStage.tsx`, `apps/web/components/experience/CompleteView.tsx`, `apps/web/components/experience/Experience.module.css`, `apps/web/app/import/layout.tsx`, `apps/web/app/import/consent/page.tsx`, `apps/web/app/import/source/page.tsx`, `apps/web/app/import/status/page.tsx`, `apps/web/app/import/review/page.tsx`, `apps/web/tests/helpers/router-mock.ts`, `apps/web/tests/helpers/app-harness.tsx`
- Rewrite: `apps/web/components/integrated/IntegratedHealthExperience.tsx` (thin switch), `apps/web/tests/integrated-review-loop.test.tsx`
- Modify: `apps/web/components/integrated/CandidateReview.tsx` (copy only), `apps/web/tests/korean-ux-copy.test.ts` (file list + the strings this task changes), `apps/web/e2e/foundation-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `IntegratedShell` (Task 2), `Patch`, `AliveEntryLayout` (unchanged until Task 6), `CandidateReview` (unchanged props), `RecentChanges`, `buildHomePhases`/`homeIdentityCounts`, `buildSyntheticResultPdf`, `createFoundationClient`, `describeFoundationError`/`foundationShellState`, `describeAbstention`/`labelConsentStatus`/`labelReviewOutcome`, `shortDigest`, `formatKoreanDate`.
- Produces: `useExperienceState(stage: ExperienceStage): { state: ExperienceState; actions: ExperienceActions }`; types `ExperienceStage = "home" | ImportStage`, `ImportStage = "consent" | "source" | "status" | "review"`, `IMPORT_PATHS`, `HOME_PATH`, `ExperiencePhase` (union), `ExperienceState`, `ExperienceActions`, `processingCopy`, `pollableStates`; `ImportFlowProvider` + `useImportFlow()`; stage components `ConsentStage`, `SourceStage`, `ProcessingStage`, `ReviewStage` (context readers) and presentational `ConsentView`, `SourceView`, `ProcessingView`, `CompleteView`, `HomeView`, `EntryView`, `RestoreFailedView`; test helpers `router`, `resetRouter`, `currentPath`, `nextNavigationMock`, `renderApp(path)`.

Copy this task changes (each row is in the Task 2 map): "허용된 합성 PDF를 선택해 주세요" → "예시 결과지를 선택해 주세요"; eyebrow "1. 합성 결과지 선택" → "결과지 선택"; "이 단계에서는 서버가 미리 허용한 합성 PDF만 처리합니다." → "미리 준비된 예시 결과지 두 개를 확인할 수 있어요. 값을 읽는 방식은 실제 결과지와 같아요."; "합성 PDF 선택" → "내 파일에서 고르기"; input label "허용된 합성 PDF 선택" → "결과지 파일 선택"; privacy note → "미리 준비된 예시 결과지가 아니면 서버가 받지 않아요."; "이 통합 단계에서는 허용된 합성 PDF만 선택할 수 있어요." → "PDF 파일만 고를 수 있어요."; eyebrow "2. 서버 처리 상태" → "결과지 확인 준비"; heading "서버가 알려준 상태를 그대로 보여드려요" → "결과지를 읽고 있어요"; the `신뢰 경계 / 적대적 문서 격리 구역` row is removed (its sentence moves to 데이터 관리 › 자세히 in Task 4); "안전한 미리보기" → "미리보기" with "준비됨" / "아직 없음"; "다른 합성 PDF 선택" → "다른 결과지 선택"; consent lede → "결과지에서 항목을 읽어 직접 확인하는 목적에만 써요. 밖으로 보내지 않아요."; processing sentences: UPLOADING "결과지를 보내고 있어요", UNTRUSTED_OBJECT "파일을 받았어요. 아직 열지 않았어요", SECURITY_INSPECTION "파일을 검사하고 있어요", SECURITY_APPROVED "검사를 마쳤어요", EXTRACTION_QUEUED "글자를 읽을 차례를 기다리고 있어요", EXTRACTION_RUNNING "결과지의 글자를 읽고 있어요", REVIEW_REQUIRED "확인할 항목이 준비됐어요"; review eyebrow "3. 출처부터 확인 ·" → "출처 확인 ·"; "확인할 항목 · 예시 데이터" → "확인할 항목"; "결과지 원문 보기 · 예시 데이터" → "결과지 원문 보기"; "후보 근거값" → "원문 확인값"; complete: "저장한 값은 출처와 확인 버전을 함께 남겼어요. 제외한 항목은 건강 기록으로 만들지 않았습니다." → "저장한 값은 출처와 함께 남겼어요. 제외한 항목은 기록이 되지 않았어요."; saved-list "예시 데이터" span removed; links "저장된 기록 보기" → "내 기록 보기", "나의 데이터에서 한 칸씩 보기" → "나의 데이터 보기", "진료 준비 목록 보기" → "진료 준비 보기"; home eyebrow "예시 데이터로 체험" → "예시 데이터", `<strong>예시 데이터로 체험 중이에요</strong>` removed, "외부 기관 연결 0곳 · 직접 확인한 예시 기록 N개" → "직접 확인한 기록 N개", links "동의와 삭제 상태 보기" → "데이터 관리", "진료 때 물어볼 내용 준비" → "진료 준비"; the "현재 허용 범위" panel is removed; status badge "예시 데이터로 체험 중" → "예시 데이터"; hero caption "예시 데이터로 체험 중이에요" → default caption; records zero message → "결과지를 추가하고 값을 확인하면 여기에 쌓여요."; home boundary caption (once, bottom) "값의 의미나 건강 상태는 판단하지 않아요. 선의 모양과 색은 시간의 위치만 나타내요."

- [ ] **Step 1: The hook**

Create `apps/web/lib/experience/use-experience-state.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFoundationClient,
  FoundationClientError,
  sha256Blob,
  type ChangeSummary,
  type FoundationCandidate,
  type FoundationConsent,
  type FoundationDocument,
  type FoundationRecord,
  type FoundationSession,
} from "@/lib/foundation/client";
import { describeFoundationError, foundationShellState } from "@/lib/foundation/messages";

export type ImportStage = "consent" | "source" | "status" | "review";
export type ExperienceStage = "home" | ImportStage;

export const HOME_PATH = "/";
export const IMPORT_PATHS = {
  consent: "/import/consent",
  source: "/import/source",
  status: "/import/status",
  review: "/import/review",
} as const satisfies Record<ImportStage, string>;

export type ShellState =
  | "INITIALIZING_SESSION"
  | "AUTHENTICATED"
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "RESTORE_FAILED"
  | "AUTHORIZATION_DENIED";

type LocalProcessingState = "IDLE" | "HASHING" | "REQUESTING_UPLOAD" | "UPLOADING" | "UPLOAD_FINALIZING";
export type ProcessingState = LocalProcessingState | FoundationDocument["status"];

/** What the person sees for each server state: plain sentences, the raw code stays in a labelled <code>. */
export const processingCopy: Record<ProcessingState, string> = {
  IDLE: "대기 중",
  HASHING: "브라우저에서 파일 확인값을 계산하고 있어요",
  REQUESTING_UPLOAD: "서버에 업로드 요청을 만들고 있어요",
  UPLOADING: "결과지를 보내고 있어요",
  UPLOAD_FINALIZING: "서버가 받은 바이트와 요청 정보를 다시 맞추고 있어요",
  UPLOAD_PENDING: "업로드가 끝나기를 기다리고 있어요",
  UNTRUSTED_OBJECT: "파일을 받았어요. 아직 열지 않았어요",
  SECURITY_INSPECTION: "파일을 검사하고 있어요",
  SECURITY_REJECTED: "보안 정책에 따라 이 파일을 처리하지 않았어요",
  SECURITY_APPROVED: "검사를 마쳤어요",
  EXTRACTION_QUEUED: "글자를 읽을 차례를 기다리고 있어요",
  EXTRACTION_RUNNING: "결과지의 글자를 읽고 있어요",
  REVIEW_REQUIRED: "확인할 항목이 준비됐어요",
  COMPLETED: "이 문서의 사용자 확인이 끝났어요",
  DELETION_PENDING: "문서와 파생물을 지우고 있어요",
  DELETED: "문서와 파생물을 삭제했어요",
  FAILED_RETRYABLE: "일시적인 문제로 서버가 안전하게 다시 시도할 준비를 하고 있어요",
  FAILED_TERMINAL: "안전하게 계속할 수 없어 처리를 중단했어요",
};

export const pollableStates = new Set<FoundationDocument["status"]>([
  "UNTRUSTED_OBJECT",
  "SECURITY_INSPECTION",
  "SECURITY_APPROVED",
  "EXTRACTION_QUEUED",
  "EXTRACTION_RUNNING",
  "FAILED_RETRYABLE",
]);

export type ExperiencePhase =
  | { kind: "initializing" }
  | { kind: "signed-out"; expired: boolean }
  | { kind: "restore-failed" }
  | { kind: "loading" }
  | { kind: "home" }
  | { kind: "consent" }
  | { kind: "source" }
  | { kind: "status" }
  | { kind: "review"; candidate: FoundationCandidate }
  | { kind: "complete"; zeroCandidates: boolean };

export type ExperienceState = {
  phase: ExperiencePhase;
  shellState: ShellState;
  session?: FoundationSession;
  consent?: FoundationConsent;
  records: FoundationRecord[];
  changes?: ChangeSummary;
  processingState: ProcessingState;
  documentReceipt?: FoundationDocument;
  candidates: FoundationCandidate[];
  savedRecords: FoundationRecord[];
  activeCandidate?: FoundationCandidate;
  /** A document is mid-flow: a pending candidate, or a document the server is still processing. */
  unfinished: boolean;
  busy: boolean;
  errorMessage: string;
  pollingPaused: boolean;
};

export type ExperienceActions = {
  initialize: () => Promise<void>;
  signIn: () => Promise<void>;
  /** From the home: consent stage when consent is not ACTIVE, else the source stage. */
  beginImport: () => void;
  /** From the home or the status stage: the review when a candidate is pending, else the status stage. */
  resumeReview: () => void;
  grantConsent: () => Promise<void>;
  selectDocument: (file: File) => Promise<void>;
  confirmCandidate: (value: string, observedOn?: string) => Promise<void>;
  excludeCandidate: () => Promise<void>;
  retryPolling: () => void;
  /** Forget the finished document and go to the source stage for another one. */
  startAnother: () => void;
  goHome: () => void;
  goTo: (stage: ImportStage) => void;
};

function newIdempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * The one state machine behind the home and the four import stages. Server truth (session,
 * consent, records, active document, candidates) is restored on every mount, so each URL stage is
 * a deep link. Stage transitions are router navigations; decisions inside the review never push
 * history, so the browser's back button walks the stages, not the decisions.
 */
export function useExperienceState(stage: ExperienceStage): { state: ExperienceState; actions: ExperienceActions } {
  const router = useRouter();
  const client = useMemo(() => createFoundationClient(), []);
  const [shellState, setShellState] = useState<ShellState>("INITIALIZING_SESSION");
  const [session, setSession] = useState<FoundationSession>();
  const [consent, setConsent] = useState<FoundationConsent>();
  const [records, setRecords] = useState<FoundationRecord[]>([]);
  const [changes, setChanges] = useState<ChangeSummary>();
  const [truthLoaded, setTruthLoaded] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>("IDLE");
  const [documentReceipt, setDocumentReceipt] = useState<FoundationDocument>();
  const [candidates, setCandidates] = useState<FoundationCandidate[]>([]);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  const [savedRecords, setSavedRecords] = useState<FoundationRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pollingPaused, setPollingPaused] = useState(false);
  const [pollingNonce, setPollingNonce] = useState(0);

  const loadProductTruth = useCallback(async () => {
    // A failed or schema-rejected /changes read must not break the home: its own .catch()
    // isolates it, so the home simply hides "최근 변화".
    const [loadedConsent, loadedRecords, activity, loadedChanges] = await Promise.all([
      client.getDocumentConsent(),
      client.getRecords(),
      client.getActiveDocument(),
      client.getChanges().catch(() => undefined),
    ]);
    setConsent(loadedConsent);
    setRecords(loadedRecords);
    setChanges(loadedChanges);
    if (activity.document) {
      setDocumentReceipt(activity.document);
      setProcessingState(activity.document.status);
      if (activity.document.status === "REVIEW_REQUIRED" || activity.document.status === "COMPLETED") {
        const restored = await client.getCandidatesForDocument(activity.document.documentId);
        setCandidates(restored);
        setCandidatesLoaded(true);
      }
    } else {
      setDocumentReceipt(undefined);
      setCandidates([]);
      setCandidatesLoaded(false);
    }
    setTruthLoaded(true);
  }, [client]);

  const initialize = useCallback(async () => {
    setShellState("INITIALIZING_SESSION");
    setErrorMessage("");
    try {
      const restored = await client.getSession();
      setSession(restored);
      await loadProductTruth();
      setShellState("AUTHENTICATED");
    } catch (error) {
      const state = foundationShellState(error);
      if (state === "UNAUTHENTICATED" || state === "SESSION_EXPIRED") {
        setSession(undefined);
        setShellState(state);
      } else {
        // A failed read is not proof that the session is gone; never replace restoration with a
        // new demo-bootstrap POST.
        setShellState("RESTORE_FAILED");
      }
      if (state !== "UNAUTHENTICATED") setErrorMessage(describeFoundationError(error));
    }
  }, [client, loadProductTruth]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Polling runs only on the status stage; reaching a terminal state moves to the review stage.
  useEffect(() => {
    const documentId = documentReceipt?.documentId;
    const documentStatus = documentReceipt?.status;
    if (!documentId || !documentStatus || stage !== "status" || !pollableStates.has(documentStatus)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const poll = async () => {
      try {
        const current = await client.getDocument(documentId);
        if (cancelled) return;
        if (current.status === "REVIEW_REQUIRED" || current.status === "COMPLETED") {
          // Fetch the candidates before publishing the terminal status, so the status change never
          // cleans up this effect with the candidate request still in flight.
          const extracted = await client.getCandidatesForDocument(current.documentId);
          if (cancelled) return;
          setDocumentReceipt(current);
          setProcessingState(current.status);
          setPollingPaused(false);
          setErrorMessage("");
          setCandidates(extracted);
          setCandidatesLoaded(true);
          router.push(IMPORT_PATHS.review);
          return;
        }
        setDocumentReceipt(current);
        setProcessingState(current.status);
        setPollingPaused(false);
        setErrorMessage("");
        if (!pollableStates.has(current.status)) return;
        attempt += 1;
        timer = setTimeout(poll, Math.min(8_000, 750 * (2 ** Math.min(attempt, 4))));
      } catch (error) {
        if (cancelled) return;
        setPollingPaused(true);
        setErrorMessage(describeFoundationError(error));
        const nextShell = foundationShellState(error);
        if (nextShell === "SESSION_EXPIRED" || nextShell === "UNAUTHENTICATED") setShellState(nextShell);
      }
    };

    timer = setTimeout(poll, 600);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [client, documentReceipt?.documentId, documentReceipt?.status, pollingNonce, router, stage]);

  const activeCandidate = candidates.find((item) => item.status === "PENDING");
  const unfinished = !!activeCandidate || (!!documentReceipt && pollableStates.has(documentReceipt.status));

  // Stage guards: a stage that cannot be shown redirects to the stage that can (never to the home
  // from inside the flow, except when the session is gone).
  useEffect(() => {
    if (stage === "home") return;
    if (shellState === "UNAUTHENTICATED" || shellState === "SESSION_EXPIRED") {
      router.replace(HOME_PATH);
      return;
    }
    if (shellState !== "AUTHENTICATED" || !truthLoaded) return;
    if (stage === "source" && consent?.status !== "ACTIVE") {
      setErrorMessage("결과지 처리 동의를 먼저 확인해 주세요.");
      router.replace(IMPORT_PATHS.consent);
      return;
    }
    if ((stage === "status" || stage === "review") && !documentReceipt && processingState === "IDLE") {
      router.replace(IMPORT_PATHS.source);
      return;
    }
    if (stage === "review" && documentReceipt && pollableStates.has(documentReceipt.status)) router.replace(IMPORT_PATHS.status);
  }, [consent?.status, documentReceipt, processingState, router, shellState, stage, truthLoaded]);

  const phase = useMemo<ExperiencePhase>(() => {
    if (shellState === "INITIALIZING_SESSION") return { kind: "initializing" };
    if (shellState === "RESTORE_FAILED") return { kind: "restore-failed" };
    if (shellState !== "AUTHENTICATED") return { kind: "signed-out", expired: shellState === "SESSION_EXPIRED" };
    if (stage === "home") return { kind: "home" };
    if (stage === "consent") return { kind: "consent" };
    if (stage === "source") return { kind: "source" };
    if (stage === "status") return { kind: "status" };
    if (!documentReceipt || pollableStates.has(documentReceipt.status)) return { kind: "loading" };
    if (activeCandidate) return { kind: "review", candidate: activeCandidate };
    if (!candidatesLoaded) return { kind: "loading" };
    return { kind: "complete", zeroCandidates: candidates.length === 0 };
  }, [activeCandidate, candidates.length, candidatesLoaded, documentReceipt, shellState, stage]);

  const signIn = async () => {
    setBusy(true);
    setErrorMessage("");
    try {
      const issued = await client.bootstrapDemo();
      setSession(issued);
      await loadProductTruth();
      setShellState("AUTHENTICATED");
    } catch (error) {
      // A bootstrap response may have set cookies before a later read failed: re-read the current
      // session before offering another bootstrap.
      setShellState("RESTORE_FAILED");
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  const resetFlow = () => {
    setErrorMessage("");
    setDocumentReceipt(undefined);
    setCandidates([]);
    setCandidatesLoaded(false);
    setSavedRecords([]);
    setProcessingState("IDLE");
    setPollingPaused(false);
  };

  const beginImport = () => {
    router.push(consent?.status === "ACTIVE" ? IMPORT_PATHS.source : IMPORT_PATHS.consent);
  };

  const resumeReview = () => {
    router.push(activeCandidate ? IMPORT_PATHS.review : IMPORT_PATHS.status);
  };

  const grantConsent = async () => {
    setBusy(true);
    setErrorMessage("");
    try {
      const granted = await client.grantDocumentConsent();
      setConsent(granted);
      router.push(IMPORT_PATHS.source);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
      setShellState(foundationShellState(error));
    } finally {
      setBusy(false);
    }
  };

  const selectDocument = async (file: File) => {
    setErrorMessage("");
    if (file.type !== "application/pdf") {
      setErrorMessage("PDF 파일만 고를 수 있어요.");
      return;
    }
    if (file.size < 64 || file.size > 10_485_760) {
      setErrorMessage("PDF 크기는 64바이트 이상 10MB 이하여야 해요.");
      return;
    }
    if (!consent?.consentId || consent.status !== "ACTIVE") {
      setErrorMessage("결과지 처리 동의를 먼저 확인해 주세요.");
      router.replace(IMPORT_PATHS.consent);
      return;
    }
    setBusy(true);
    try {
      setProcessingState("HASHING");
      router.push(IMPORT_PATHS.status);
      const digest = await sha256Blob(file);
      setProcessingState("REQUESTING_UPLOAD");
      const ticket = await client.requestDocument(consent.consentId, file.size, digest, newIdempotencyKey("document"));
      setDocumentReceipt(ticket.document);
      setProcessingState("UPLOADING");
      const uploaded = await client.uploadDocument(ticket.uploadCapability, file);
      setDocumentReceipt(uploaded);
      setProcessingState("UPLOAD_FINALIZING");
      const finalized = await client.finalizeDocument(ticket.document.documentId);
      setDocumentReceipt(finalized);
      setProcessingState(finalized.status);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  // The next list is computed from the current `candidates` value so no view change happens inside
  // a state updater; the "complete" phase derives from the list having no PENDING item.
  const applyDecision = (decided: FoundationCandidate) => {
    setCandidates(candidates.map((item) => (item.candidateId === decided.candidateId ? decided : item)));
  };

  // The server rejects a decision on a candidate it no longer holds as PENDING: re-read its list so
  // the loop resumes from the server's truth instead of this browser's stale copy.
  const resyncAfterConflict = async (error: unknown) => {
    const stale = error instanceof FoundationClientError && error.problemCode === "candidate_not_pending";
    if (!stale || !documentReceipt) return;
    try {
      setCandidates(await client.getCandidatesForDocument(documentReceipt.documentId));
    } catch {
      // Keep the original message; the person can retry from the same screen.
    }
  };

  const confirmCandidate = async (value: string, observedOn?: string) => {
    if (!activeCandidate) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const record = await client.confirmCandidate(activeCandidate.candidateId, value, newIdempotencyKey("confirm"), observedOn);
      setSavedRecords((current) => [...current, record]);
      setRecords((current) => [...current.filter((item) => item.recordId !== record.recordId), record]);
      applyDecision({ ...activeCandidate, status: "CONFIRMED" });
    } catch (error) {
      await resyncAfterConflict(error);
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  const excludeCandidate = async () => {
    if (!activeCandidate) return;
    setBusy(true);
    setErrorMessage("");
    try {
      applyDecision(await client.excludeCandidate(activeCandidate.candidateId, newIdempotencyKey("exclude")));
    } catch (error) {
      await resyncAfterConflict(error);
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  const retryPolling = () => {
    setErrorMessage("");
    setPollingPaused(false);
    setPollingNonce((value) => value + 1);
  };

  const startAnother = () => {
    resetFlow();
    router.push(IMPORT_PATHS.source);
  };

  const goHome = () => router.push(HOME_PATH);
  const goTo = (target: ImportStage) => router.push(IMPORT_PATHS[target]);

  return {
    state: {
      phase,
      shellState,
      session,
      consent,
      records,
      changes,
      processingState,
      documentReceipt,
      candidates,
      savedRecords,
      activeCandidate,
      unfinished,
      busy,
      errorMessage,
      pollingPaused,
    },
    actions: {
      initialize,
      signIn,
      beginImport,
      resumeReview,
      grantConsent,
      selectDocument,
      confirmCandidate,
      excludeCandidate,
      retryPolling,
      startAnother,
      goHome,
      goTo,
    },
  };
}
```

- [ ] **Step 2: Provider and stage frame**

Create `apps/web/components/experience/ImportFlowProvider.tsx`:

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useExperienceState, type ExperienceActions, type ExperienceState, type ImportStage } from "@/lib/experience/use-experience-state";

type ImportFlow = { stage: ImportStage; state: ExperienceState; actions: ExperienceActions };

const ImportFlowContext = createContext<ImportFlow | null>(null);

const stages: ReadonlySet<string> = new Set(["consent", "source", "status", "review"]);

function stageFromPath(pathname: string | null): ImportStage {
  const last = pathname?.split("/").filter(Boolean).pop() ?? "consent";
  return (stages.has(last) ? last : "consent") as ImportStage;
}

/**
 * Mounted once by app/import/layout.tsx, so the hook (and the in-flight upload, the saved-record
 * list) survives navigation between the four stages. The home mounts its own instance.
 */
export function ImportFlowProvider({ children }: { children: ReactNode }) {
  const stage = stageFromPath(usePathname());
  const { state, actions } = useExperienceState(stage);
  return <ImportFlowContext.Provider value={{ stage, state, actions }}>{children}</ImportFlowContext.Provider>;
}

export function useImportFlow(): ImportFlow {
  const flow = useContext(ImportFlowContext);
  if (!flow) throw new Error("useImportFlow must be used under ImportFlowProvider");
  return flow;
}
```

Create `apps/web/components/experience/Experience.module.css`:

```css
/* Layout for the import stages and the home's quick panel. Colours and type come from tokens. */
.stage { width: min(100% - 2rem, 44rem); margin-inline: auto; padding: var(--gc-space-4) 0 var(--gc-space-10); min-width: 0; }
.stageBar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: var(--gc-shell-height); }
.stageBar > :last-child { justify-self: end; }
.stageMark { justify-self: center; }
.choices { display: grid; gap: var(--gc-space-2); margin-top: var(--gc-space-4); }
.choices .gcButton { width: 100%; }
.fileInput { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.list { display: grid; gap: var(--gc-space-2); margin: var(--gc-space-4) 0 0; padding: 0; list-style: none; }
.list li { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gc-space-2) var(--gc-space-3); padding: var(--gc-space-2) 0; border-bottom: var(--gc-rule); }
.list li span { color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.summary { margin-top: var(--gc-space-3); font-family: var(--gc-type-pixel); font-size: 1.5rem; }
.center { min-height: 60vh; display: grid; place-items: center; padding: var(--gc-space-6) var(--gc-space-4); }
.entry { position: relative; overflow: hidden; min-height: 100vh; min-width: 0; }
.entryCopy { position: relative; z-index: 1; max-width: 43rem; background: transparent; }
.entryCopy h1 { font-size: clamp(1.6rem, 1.8vw, 2.4rem); line-height: 1.18; }
.entryCopy .gcButton { width: 100%; margin-block: var(--gc-space-4); }
.limit { font-size: 0.875rem; color: var(--gc-color-text-secondary); }
.quick { position: relative; z-index: 1; background: transparent; }
.quick p { margin-top: var(--gc-space-2); }
.quickLinks { display: flex; flex-wrap: wrap; gap: var(--gc-space-3); margin-top: var(--gc-space-3); }
@media (max-width: 42rem) {
  .entryCopy { padding: var(--gc-space-3); }
  .entryCopy h1 { font-size: 1.7rem; line-height: 1.22; }
}
```

(`.gcButton` is never emitted by the module; the two rules that mention it are written as `.choices > a, .choices > button` and `.entryCopy > button` instead — replace those two selectors accordingly when creating the file: `.choices > a, .choices > button { width: 100%; }` and `.entryCopy > button { width: 100%; margin-block: var(--gc-space-4); }`.)

Add to the same file the shared stage frame component in `apps/web/components/experience/StageFrame.tsx`:

```tsx
import type { ReactNode } from "react";
import { Patch } from "@/components/ui/Patch";
import styles from "@/components/experience/Experience.module.css";

type StageFrameProps = {
  stage: "consent" | "source" | "status";
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
};

/** The import stages' own bar: 이전 · patch mark · 닫기 (the review keeps CandidateReview's bar). */
export function StageFrame({ stage, onBack, onClose, children }: StageFrameProps) {
  return (
    <main className={styles.stage} data-stage={stage}>
      <header className={styles.stageBar}>
        <button className="gc-button gc-button--text" type="button" onClick={onBack}>이전</button>
        <Patch variant="wordmark" className={styles.stageMark} />
        <button className="gc-button gc-button--text" type="button" onClick={onClose}>닫기</button>
      </header>
      {children}
    </main>
  );
}
```

Add `StageFrame.tsx` to the task's file list (create).

- [ ] **Step 3: The views**

Create `apps/web/components/experience/ConsentView.tsx`:

```tsx
"use client";

import { StageFrame } from "@/components/experience/StageFrame";
import { useImportFlow } from "@/components/experience/ImportFlowProvider";
import { labelConsentStatus } from "@/lib/format/status-labels";
import type { FoundationConsent } from "@/lib/foundation/client";

export type ConsentViewProps = {
  consentStatus: FoundationConsent["status"];
  busy: boolean;
  errorMessage: string;
  onCancel: () => void;
  onGrant: () => void;
  onNext: () => void;
};

export function ConsentView({ consentStatus, busy, errorMessage, onCancel, onGrant, onNext }: ConsentViewProps) {
  const active = consentStatus === "ACTIVE";
  return (
    <StageFrame stage="consent" onBack={onCancel} onClose={onCancel}>
      <section className="gc-panel" aria-labelledby="integrated-consent-title">
        <span className="gc-panel__eyebrow">목적별 동의</span>
        <h1 id="integrated-consent-title">결과지에서 항목을 확인해도 될까요?</h1>
        <p>결과지에서 항목을 읽어 직접 확인하는 목적에만 써요. 밖으로 보내지 않아요.</p>
        <dl className="gc-facts">
          <div><dt>목적</dt><dd>결과지 항목 확인</dd></div>
          <div><dt>현재 상태</dt><dd>{labelConsentStatus(consentStatus)}</dd></div>
          <div><dt>외부 제공</dt><dd>없음</dd></div>
        </dl>
        <div className="gc-actions">
          <button className="gc-button gc-button--secondary" type="button" onClick={onCancel}>취소</button>
          {active
            ? <button className="gc-button gc-button--primary" type="button" onClick={onNext}>결과지 선택으로</button>
            : <button className="gc-button gc-button--primary" type="button" onClick={onGrant} disabled={busy}>{busy ? "서버에 반영 중" : "이 목적에 동의"}</button>}
        </div>
        {errorMessage && <p className="gc-error" role="alert">{errorMessage}</p>}
      </section>
    </StageFrame>
  );
}

export function ConsentStage() {
  const { state, actions } = useImportFlow();
  if (state.phase.kind !== "consent") return <p className="gc-center" role="status">불러오는 중이에요.</p>;
  return (
    <ConsentView
      consentStatus={state.consent?.status ?? "NOT_GRANTED"}
      busy={state.busy}
      errorMessage={state.errorMessage}
      onCancel={actions.goHome}
      onGrant={() => void actions.grantConsent()}
      onNext={() => actions.goTo("source")}
    />
  );
}
```

Create `apps/web/components/experience/SourceView.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { StageFrame } from "@/components/experience/StageFrame";
import { useImportFlow } from "@/components/experience/ImportFlowProvider";
import { buildSyntheticResultPdf } from "@/lib/foundation/synthetic-document";
import styles from "@/components/experience/Experience.module.css";

export type SourceViewProps = {
  busy: boolean;
  errorMessage: string;
  onSelect: (file: File) => void;
  onBack: () => void;
  onClose: () => void;
};

/** The two prepared example sheets are the primary action (§8.13); the file picker is secondary. */
export function SourceView({ busy, errorMessage, onSelect, onBack, onClose }: SourceViewProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <StageFrame stage="source" onBack={onBack} onClose={onClose}>
      <section className="gc-panel" aria-labelledby="integrated-source-title">
        <span className="gc-panel__eyebrow">결과지 선택</span>
        <h1 id="integrated-source-title">예시 결과지를 선택해 주세요</h1>
        <p>미리 준비된 예시 결과지 두 개를 확인할 수 있어요. 값을 읽는 방식은 실제 결과지와 같아요.</p>
        <div className={styles.choices}>
          <button className="gc-button gc-button--primary" type="button" disabled={busy} onClick={() => onSelect(new File([buildSyntheticResultPdf("2026-07")], "gc-synthetic-2026-07.pdf", { type: "application/pdf" }))}>7월 예시 결과지로 시작</button>
          <button className="gc-button gc-button--primary" type="button" disabled={busy} onClick={() => onSelect(new File([buildSyntheticResultPdf("2026-01")], "gc-synthetic-2026-01.pdf", { type: "application/pdf" }))}>1월 예시 결과지로 시작</button>
        </div>
        <div className="gc-actions">
          <button className="gc-button gc-button--text" type="button" onClick={() => fileInput.current?.click()}>내 파일에서 고르기</button>
        </div>
        <input
          ref={fileInput}
          className={styles.fileInput}
          type="file"
          accept="application/pdf,.pdf"
          aria-label="결과지 파일 선택"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onSelect(file);
            event.currentTarget.value = "";
          }}
        />
        <p className="gc-meta">미리 준비된 예시 결과지가 아니면 서버가 받지 않아요.</p>
        {errorMessage && <p className="gc-error" role="alert">{errorMessage}</p>}
      </section>
    </StageFrame>
  );
}

export function SourceStage() {
  const { state, actions } = useImportFlow();
  if (state.phase.kind !== "source") return <p className="gc-center" role="status">불러오는 중이에요.</p>;
  return (
    <SourceView
      busy={state.busy}
      errorMessage={state.errorMessage}
      onSelect={(file) => void actions.selectDocument(file)}
      onBack={() => actions.goTo("consent")}
      onClose={actions.goHome}
    />
  );
}
```

Create `apps/web/components/experience/ProcessingView.tsx`:

```tsx
"use client";

import { StageFrame } from "@/components/experience/StageFrame";
import { useImportFlow } from "@/components/experience/ImportFlowProvider";
import { processingCopy, type ProcessingState } from "@/lib/experience/use-experience-state";
import { shortDigest } from "@/lib/format/short-digest";
import type { FoundationDocument } from "@/lib/foundation/client";

export type ProcessingViewProps = {
  processingState: ProcessingState;
  documentReceipt?: FoundationDocument;
  hasPendingCandidate: boolean;
  pollingPaused: boolean;
  busy: boolean;
  errorMessage: string;
  onResume: () => void;
  onRetry: () => void;
  onPickAnother: () => void;
  onBack: () => void;
  onClose: () => void;
};

/** The server's own state, in plain words; the raw code stays in a labelled <code>. */
export function ProcessingView({ processingState, documentReceipt, hasPendingCandidate, pollingPaused, busy, errorMessage, onResume, onRetry, onPickAnother, onBack, onClose }: ProcessingViewProps) {
  const terminal = processingState === "SECURITY_REJECTED" || processingState === "FAILED_TERMINAL";
  return (
    <StageFrame stage="status" onBack={onBack} onClose={onClose}>
      <section className="gc-panel" aria-labelledby="server-processing-title">
        <span className="gc-panel__eyebrow">결과지 확인 준비</span>
        <h1 id="server-processing-title">결과지를 읽고 있어요</h1>
        <p role="status" aria-live="polite">{processingCopy[processingState]}</p>
        {documentReceipt && (
          <dl className="gc-facts">
            <div><dt>문서 상태</dt><dd>{processingCopy[documentReceipt.status]} <code aria-label="서버 상태 코드">{documentReceipt.status}</code></dd></div>
            <div><dt>파일 확인값</dt><dd><code>{documentReceipt.sha256 ? shortDigest(documentReceipt.sha256) : "아직 없음"}</code></dd></div>
            <div><dt>미리보기</dt><dd>{documentReceipt.previewAvailable ? "준비됨" : "아직 없음"}</dd></div>
          </dl>
        )}
        <div className="gc-actions">
          {hasPendingCandidate && <button className="gc-button gc-button--primary" type="button" onClick={onResume} disabled={busy}>이어서 확인</button>}
          {pollingPaused && <button className="gc-button gc-button--secondary" type="button" onClick={onRetry}>상태 다시 확인</button>}
          {terminal && <button className="gc-button gc-button--secondary" type="button" onClick={onPickAnother}>다른 결과지 선택</button>}
        </div>
        {errorMessage && <p className="gc-error" role="alert">{errorMessage}</p>}
      </section>
    </StageFrame>
  );
}

export function ProcessingStage() {
  const { state, actions } = useImportFlow();
  if (state.phase.kind !== "status") return <p className="gc-center" role="status">불러오는 중이에요.</p>;
  return (
    <ProcessingView
      processingState={state.processingState}
      documentReceipt={state.documentReceipt}
      hasPendingCandidate={!!state.activeCandidate}
      pollingPaused={state.pollingPaused}
      busy={state.busy}
      errorMessage={state.errorMessage}
      onResume={() => actions.goTo("review")}
      onRetry={actions.retryPolling}
      onPickAnother={actions.startAnother}
      onBack={actions.goHome}
      onClose={actions.goHome}
    />
  );
}
```

Create `apps/web/components/experience/CompleteView.tsx`:

```tsx
import type { FoundationCandidate, FoundationDocument, FoundationRecord } from "@/lib/foundation/client";
import { describeAbstention, labelReviewOutcome } from "@/lib/format/status-labels";
import styles from "@/components/experience/Experience.module.css";

export type CompleteViewProps = {
  candidates: FoundationCandidate[];
  savedRecords: FoundationRecord[];
  documentReceipt?: FoundationDocument;
  onHome: () => void;
  onPickAnother: () => void;
};

/** After the last decision, or when the worker read nothing: what was saved, what was excluded. */
export function CompleteView({ candidates, savedRecords, documentReceipt, onHome, onPickAnother }: CompleteViewProps) {
  if (candidates.length === 0) {
    const abstentions = documentReceipt?.abstentions ?? [];
    // A file with no usable text layer is reported as one document-level "문서 전체" unreadable
    // abstention; every other shape means text was present, so the copy must not blame a scan.
    const scanLikeDocument = abstentions.length === 0 || abstentions.every((item) => item.reason === "unreadable" && item.label === "문서 전체");
    return (
      <main className={styles.stage} data-stage="complete">
        <section className="gc-panel" aria-labelledby="integrated-empty-title">
          <span className="gc-panel__eyebrow">결과지 확인 완료</span>
          <h1 id="integrated-empty-title">이 결과지에서 읽을 수 있는 항목이 없었어요</h1>
          <p role="status">
            {scanLikeDocument
              ? "글자 정보가 없는 파일(사진·스캔)은 아직 읽지 못해요."
              : "읽은 글자는 있지만 항목·값·단위를 확실히 맞출 수 없었어요. 아래 사유를 확인해 주세요."}
          </p>
          {abstentions.length > 0 && (
            <ul className={styles.list} aria-label="읽지 못한 항목">
              {abstentions.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  <span>{describeAbstention(item)}</span>
                  {item.evidencePage ? <span>{item.evidencePage}쪽</span> : null}
                </li>
              ))}
            </ul>
          )}
          <div className="gc-actions">
            <button className="gc-button gc-button--primary" type="button" onClick={onHome}>홈으로</button>
            <button className="gc-button gc-button--secondary" type="button" onClick={onPickAnother}>다른 결과지 선택</button>
          </div>
        </section>
      </main>
    );
  }
  const confirmedCount = candidates.filter((item) => item.status === "CONFIRMED").length;
  const excludedCount = candidates.filter((item) => item.status === "EXCLUDED").length;
  return (
    <main className={styles.stage} data-stage="complete">
      <section className="gc-panel" aria-labelledby="integrated-complete-title">
        <span className="gc-panel__eyebrow">결과지 확인 완료</span>
        <h1 id="integrated-complete-title">이 결과지 확인을 마쳤어요</h1>
        <p className={styles.summary} role="status">저장 {confirmedCount}개 · 제외 {excludedCount}개</p>
        <p>저장한 값은 출처와 함께 남겼어요. 제외한 항목은 기록이 되지 않았어요.</p>
        {savedRecords.length > 0 && (
          <ul className={styles.list} aria-label="저장한 항목">
            {savedRecords.map((record) => (
              <li key={record.recordVersionId}>
                <strong>{record.label}</strong>
                <span>{record.value} {record.unit}</span>
                <span>{labelReviewOutcome(record)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="gc-actions">
          <button className="gc-button gc-button--primary" type="button" onClick={onHome}>홈으로</button>
          <a className="gc-button gc-button--secondary" href="/records">내 기록 보기</a>
          <a className="gc-button gc-button--secondary" href="/my-data">나의 데이터 보기</a>
          <a className="gc-button gc-button--secondary" href="/prepare">진료 준비 보기</a>
        </div>
      </section>
    </main>
  );
}
```

Create `apps/web/components/experience/ReviewStage.tsx`:

```tsx
"use client";

import { CandidateReview } from "@/components/integrated/CandidateReview";
import { CompleteView } from "@/components/experience/CompleteView";
import { useImportFlow } from "@/components/experience/ImportFlowProvider";

/** /import/review: the pending candidate, or the completion summary once none is pending. */
export function ReviewStage() {
  const { state, actions } = useImportFlow();
  const { phase } = state;
  if (phase.kind === "review") {
    return (
      <CandidateReview
        candidate={phase.candidate}
        previewUrl={state.documentReceipt?.previewAvailable
          ? `/api/foundation/documents/${state.documentReceipt.documentId}/preview`
          : undefined}
        busy={state.busy}
        errorMessage={state.errorMessage}
        onConfirm={(value, observedOn) => void actions.confirmCandidate(value, observedOn)}
        onExclude={() => void actions.excludeCandidate()}
        onBack={() => actions.goTo("status")}
        onClose={actions.goHome}
      />
    );
  }
  if (phase.kind === "complete") {
    return (
      <CompleteView
        candidates={state.candidates}
        savedRecords={state.savedRecords}
        documentReceipt={state.documentReceipt}
        onHome={actions.goHome}
        onPickAnother={actions.startAnother}
      />
    );
  }
  return <p className="gc-center" role="status">불러오는 중이에요.</p>;
}
```

Create `apps/web/components/experience/EntryView.tsx`:

```tsx
import { AliveEntryLayout } from "@/components/home/AliveEntryLayout";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import styles from "@/components/experience/Experience.module.css";

export type EntryViewProps = { expired: boolean; busy: boolean; errorMessage: string; onSignIn: () => void };

/** The start screen: the only place "체험" is said. */
export function EntryView({ expired, busy, errorMessage, onSignIn }: EntryViewProps) {
  return (
    <IntegratedShell current="home" status="예시 데이터로 체험">
      <main className={styles.entry}>
        <AliveEntryLayout>
          <section className={`gc-panel ${styles.entryCopy}`} aria-labelledby="synthetic-login-title">
            <span className="gc-panel__eyebrow">체험 데이터로 시작하기</span>
            <h1 id="synthetic-login-title">흩어진 결과지를,<br />출처가 보이는<br />내 건강 기록으로.</h1>
            <p>결과지에 적힌 값을 직접 확인하고, 기록을 모아 다음 진료에서 물어볼 내용을 준비해 보세요.</p>
            <p><strong>실제 건강정보는 사용하지 않습니다.</strong></p>
            {expired && <p role="status"><strong>로그인 시간이 끝났어요.</strong></p>}
            <button className="gc-button gc-button--primary" type="button" onClick={onSignIn} disabled={busy}>{busy ? "체험을 준비하고 있어요" : "체험 시작"}</button>
            <p className={styles.limit}>이 브라우저의 체험 시간 동안 기록을 이어서 볼 수 있어요. 시간이 끝나거나 쿠키를 지우면 이전 체험에 다시 들어갈 수 없어요.</p>
            {errorMessage && <p className="gc-error" role="alert">{errorMessage}</p>}
          </section>
        </AliveEntryLayout>
      </main>
    </IntegratedShell>
  );
}
```

Create `apps/web/components/experience/RestoreFailedView.tsx`:

```tsx
import { IntegratedShell } from "@/components/integrated/IntegratedShell";

export type RestoreFailedViewProps = { busy: boolean; errorMessage: string; onRetry: () => void };

export function RestoreFailedView({ busy, errorMessage, onRetry }: RestoreFailedViewProps) {
  return (
    <IntegratedShell current="home" status="체험 상태 확인 필요">
      <main className="gc-center">
        <section className="gc-panel" aria-labelledby="restore-failed-title">
          <span className="gc-panel__eyebrow">예시 데이터 체험</span>
          <h1 id="restore-failed-title">체험 상태를 불러오지 못했어요</h1>
          <p>새 체험을 만들지 않고, 현재 로그인과 기록을 다시 확인해요.</p>
          {errorMessage && <p className="gc-error" role="alert">{errorMessage}</p>}
          <div className="gc-actions">
            <button className="gc-button gc-button--primary" type="button" disabled={busy} onClick={onRetry}>체험 상태 다시 확인</button>
          </div>
        </section>
      </main>
    </IntegratedShell>
  );
}
```

Create `apps/web/components/experience/HomeView.tsx`:

```tsx
import { AliveEntryLayout, type AliveIdentity } from "@/components/home/AliveEntryLayout";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { RecentChanges } from "@/components/integrated/RecentChanges";
import { buildHomePhases, homeIdentityCounts } from "@/lib/home/alive-home-data";
import type { ExperienceActions, ExperienceState } from "@/lib/experience/use-experience-state";
import styles from "@/components/experience/Experience.module.css";

export const HOME_BOUNDARY_CAPTION = "값의 의미나 건강 상태는 판단하지 않아요. 선의 모양과 색은 시간의 위치만 나타내요.";

/**
 * The logged-in home: the same alive-trajectory grid as the entry screen, fed with the person's
 * own records. One quick panel (the next action first), the profile panel, the records panel with
 * 최근 변화 under it, and one boundary caption at the bottom.
 */
export function HomeView({ state, actions }: { state: ExperienceState; actions: ExperienceActions }) {
  const currentRecords = state.records.filter((record) => record.status === "CURRENT");
  const latest = currentRecords.at(-1);
  const homePhases = buildHomePhases(currentRecords);
  const identityCounts = homeIdentityCounts(currentRecords);
  const homeIdentity: AliveIdentity = {
    name: "예시 사용자",
    age: 25,
    gender: "여성",
    lastResultDate: identityCounts.lastResultDate,
    recordCount: identityCounts.recordCount,
    resultSheetCount: identityCounts.resultSheetCount,
  };
  const homeRows = currentRecords.map((record) => ({
    item: record.label,
    value: record.value,
    unit: record.unit,
    observedOn: record.observedOn,
    shape: "circle" as const,
    size: 0,
    phase: 0,
  }));

  return (
    <IntegratedShell current="home" status="예시 데이터">
      <main className={styles.entry}>
        <AliveEntryLayout
          identity={homeIdentity}
          recordsTitle="직접 확인한 기록"
          recordsHeading={latest ? "가장 최근에 확인한 값" : "아직 저장된 기록이 없어요"}
          rows={homeRows}
          rowState="직접 확인함"
          recordsZeroMessage="결과지를 추가하고 값을 확인하면 여기에 쌓여요."
          recordsAction={{ label: "전체 기록 보기", href: "/records" }}
          belowRecords={state.changes ? <RecentChanges changes={state.changes} /> : null}
          rings={homePhases.rings}
          phaseLabels={homePhases.labels}
        >
          <section className={`gc-panel ${styles.quick}`} aria-label="빠른 실행">
            <span className="gc-panel__eyebrow">예시 데이터</span>
            <div className="gc-actions">
              <button
                className="gc-button gc-button--primary"
                type="button"
                onClick={state.unfinished ? actions.resumeReview : actions.beginImport}
              >
                {state.unfinished ? "이어서 확인" : "결과지 추가"}
              </button>
            </div>
            <p>직접 확인한 기록 {currentRecords.length}개</p>
            <div className={styles.quickLinks}>
              <a className="gc-button gc-button--text" href="/data-control">데이터 관리</a>
              <a className="gc-button gc-button--text" href="/prepare">진료 준비</a>
            </div>
            {state.errorMessage && <p className="gc-error" role="alert">{state.errorMessage}</p>}
          </section>
        </AliveEntryLayout>
        <p className="gc-caption">{HOME_BOUNDARY_CAPTION}</p>
      </main>
    </IntegratedShell>
  );
}
```

`rowState` does not exist on `AliveEntryLayout` yet (Task 6 adds it). For this task add the prop now, minimally, in `apps/web/components/home/AliveEntryLayout.tsx`: in `RecordsPanelProps` add `rowState: string;`, in `RecordsPanel` destructure `rowState` and render `<td>{rowState}</td>` instead of `<td>직접 확인함</td>`; in `AliveEntryLayoutProps` add `rowState?: string;`, default `rowState = "예시"`, and pass `rowState={rowState}` to `RecordsPanel`. Also delete the `currentPhaseIndex` prop from `AliveEntryLayoutProps` and its destructuring default; compute `const currentPhaseIndex = Math.max(0, rings.length - 1);` inside the component body after the destructuring (so nobody can hard-code it, §8.1). In `apps/web/tests/alive-entry-layout.test.tsx` change the expectation `expect(cells[3].textContent).toBe("직접 확인함");` to `expect(cells[3].textContent).toBe("예시");` and rename that test to `"renders a records table with Korean column headers and a state column that says 예시 for example rows"`.

Rewrite `apps/web/components/integrated/IntegratedHealthExperience.tsx`:

```tsx
"use client";

import { EntryView } from "@/components/experience/EntryView";
import { HomeView } from "@/components/experience/HomeView";
import { RestoreFailedView } from "@/components/experience/RestoreFailedView";
import { useExperienceState } from "@/lib/experience/use-experience-state";

/** The `/` route: entry, restore-failed, or the logged-in home. Import stages live under /import/*. */
export function IntegratedHealthExperience() {
  const { state, actions } = useExperienceState("home");
  switch (state.phase.kind) {
    case "initializing":
      return (
        <main className="gc-center" aria-busy="true">
          <p role="status">서버에서 로그인 상태를 확인하고 있어요.</p>
        </main>
      );
    case "restore-failed":
      return <RestoreFailedView busy={state.busy} errorMessage={state.errorMessage} onRetry={() => void actions.initialize()} />;
    case "signed-out":
      return <EntryView expired={state.phase.expired} busy={state.busy} errorMessage={state.errorMessage} onSignIn={() => void actions.signIn()} />;
    default:
      return <HomeView state={state} actions={actions} />;
  }
}
```

Routes — create `apps/web/app/import/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ImportFlowProvider } from "@/components/experience/ImportFlowProvider";

export const metadata: Metadata = { title: "결과지 추가" };

export default function ImportLayout({ children }: { children: ReactNode }) {
  return <ImportFlowProvider>{children}</ImportFlowProvider>;
}
```

`apps/web/app/import/consent/page.tsx`:

```tsx
import { ConsentStage } from "@/components/experience/ConsentView";

export default function ImportConsentPage() {
  return <ConsentStage />;
}
```

`apps/web/app/import/source/page.tsx`, `status/page.tsx`, `review/page.tsx` are the same shape with `SourceStage` (from `@/components/experience/SourceView`), `ProcessingStage` (from `@/components/experience/ProcessingView`) and `ReviewStage` (from `@/components/experience/ReviewStage`) respectively, named `ImportSourcePage`, `ImportStatusPage`, `ImportReviewPage`.

In `apps/web/components/integrated/CandidateReview.tsx` apply the copy rows: `3. 출처부터 확인 ·` → `출처 확인 ·`; `확인할 항목 · 예시 데이터` → `확인할 항목`; `결과지 원문 보기 · 예시 데이터` → `결과지 원문 보기`; `<dt>후보 근거값</dt>` → `<dt>원문 확인값</dt>`. Nothing else in that file changes in this task.

- [ ] **Step 4: Test helpers — an in-memory App Router**

Create `apps/web/tests/helpers/router-mock.ts` (no component imports; safe inside a `vi.mock` factory):

```ts
import { useSyncExternalStore } from "react";
import { vi } from "vitest";

const store = { path: "/", history: ["/"], listeners: new Set<() => void>() };

function commit(path: string) {
  store.path = path;
  for (const listener of store.listeners) listener();
}

export const router = {
  push: vi.fn((path: string) => { store.history.push(path); commit(path); }),
  replace: vi.fn((path: string) => { store.history[store.history.length - 1] = path; commit(path); }),
  back: vi.fn(() => { if (store.history.length > 1) store.history.pop(); commit(store.history[store.history.length - 1]); }),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export function resetRouter(path = "/") {
  store.history = [path];
  commit(path);
}

export function currentPath() {
  return store.path;
}

function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => { store.listeners.delete(listener); };
}

export function usePathnameMock() {
  return useSyncExternalStore(subscribe, () => store.path, () => store.path);
}

export const nextNavigationMock = {
  useRouter: () => router,
  usePathname: usePathnameMock,
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
};
```

Create `apps/web/tests/helpers/app-harness.tsx` (mirrors `app/`: the provider stays mounted across `/import/*`, the home is its own tree):

```tsx
import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { IntegratedHealthExperience } from "@/components/integrated/IntegratedHealthExperience";
import { ImportFlowProvider } from "@/components/experience/ImportFlowProvider";
import { ConsentStage } from "@/components/experience/ConsentView";
import { SourceStage } from "@/components/experience/SourceView";
import { ProcessingStage } from "@/components/experience/ProcessingView";
import { ReviewStage } from "@/components/experience/ReviewStage";
import { resetRouter, usePathnameMock } from "./router-mock";

const stages: Record<string, () => ReactNode> = {
  "/import/consent": () => <ConsentStage />,
  "/import/source": () => <SourceStage />,
  "/import/status": () => <ProcessingStage />,
  "/import/review": () => <ReviewStage />,
};

export function AppHarness() {
  const path = usePathnameMock();
  const stage = stages[path];
  if (stage) return <ImportFlowProvider>{stage()}</ImportFlowProvider>;
  return <IntegratedHealthExperience />;
}

export function renderApp(path = "/") {
  resetRouter(path);
  return render(<AppHarness />);
}
```

- [ ] **Step 5: Rewrite the review-loop test over the harness**

Replace `apps/web/tests/integrated-review-loop.test.tsx` with (handlers, fixtures and every assertion keep their meaning; only the entry point, the resume clicks and the copy rows of this task change):

```tsx
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { ChangeSummary, FoundationCandidate, FoundationRecord } from "@/lib/foundation/client";
import { syntheticCandidates, syntheticDocumentId } from "./fixtures/foundation";
import { currentPath, router } from "./helpers/router-mock";
import { renderApp } from "./helpers/app-harness";

vi.mock("next/navigation", async () => (await import("./helpers/router-mock")).nextNavigationMock);

let candidates: FoundationCandidate[] = [];
let records: FoundationRecord[] = [];
let changes: ChangeSummary = { items: [], newConcepts: [], unchangedCount: 0 };

const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json({
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b",
    subjectId: "synthetic-jason",
    status: "AUTHENTICATED",
    expiresAt: "2026-07-28T23:00:00Z",
  })),
  http.get("/api/foundation/consents/document-extraction", () => HttpResponse.json({
    consentId: "89116f1a-2026-457e-8942-409ff8f8fc4f",
    purposeCode: "DOCUMENT_EXTRACTION",
    status: "ACTIVE",
  })),
  http.get("/api/foundation/records", () => HttpResponse.json(records)),
  http.get("/api/foundation/changes", () => HttpResponse.json(changes)),
  http.get("/api/foundation/documents/active", () => HttpResponse.json({
    document: {
      documentId: syntheticDocumentId,
      status: "REVIEW_REQUIRED",
      sha256: "a".repeat(64),
      contentLength: 2048,
      stateVersion: 4,
      previewAvailable: true,
      quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
    },
  })),
  http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json(candidates)),
  http.post("/api/foundation/candidates/:candidateId/confirmation", async ({ params, request }) => {
    const { value, observedOn } = await request.json() as { value: string; observedOn?: string };
    const target = candidates.find((item) => item.candidateId === params.candidateId)!;
    candidates = candidates.map((item) => item.candidateId === target.candidateId
      ? { ...item, status: "CONFIRMED" }
      : item);
    const record: FoundationRecord = {
      recordId: crypto.randomUUID(),
      recordVersionId: crypto.randomUUID(),
      candidateId: target.candidateId,
      documentId: target.documentId,
      status: "CURRENT",
      reviewDecision: value === target.value && (!observedOn || observedOn === target.observedOn) ? "CONFIRMED" : "CORRECTED",
      label: target.label,
      value,
      originalValue: target.value,
      unit: target.unit,
      observedOn: observedOn ?? target.observedOn,
      originalObservedOn: target.observedOn,
      confirmedAt: "2026-07-28T09:20:00Z",
      evidencePage: target.evidencePage,
      sourceTextSha256: target.sourceTextSha256,
      documentSha256: target.documentSha256,
    };
    records = [...records, record];
    return HttpResponse.json(record, { status: 201 });
  }),
  http.post("/api/foundation/candidates/:candidateId/exclusion", ({ params }) => {
    candidates = candidates.map((item) => item.candidateId === params.candidateId
      ? { ...item, status: "EXCLUDED" }
      : item);
    return HttpResponse.json(candidates.find((item) => item.candidateId === params.candidateId));
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  candidates = syntheticCandidates.map((candidate) => ({ ...candidate }));
  records = [];
  changes = { items: [], newConcepts: [], unchangedCount: 0 };
  document.cookie = "GC_CSRF=synthetic-review-csrf-value";
  router.push.mockClear();
  router.replace.mockClear();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

const completedDocument = {
  documentId: syntheticDocumentId,
  sha256: "a".repeat(64),
  contentLength: 2048,
  stateVersion: 5,
  previewAvailable: true,
  quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
};

it.each([
  "/api/foundation/session",
  "/api/foundation/records",
  "/api/foundation/documents/:documentId/candidates",
])("retries failed restoration at %s without offering a new demo identity", async (endpoint) => {
  let unavailable = true;
  const bootstrap = vi.fn(() => HttpResponse.json({}, { status: 500 }));
  server.use(
    http.post("/api/foundation/demo-session", bootstrap),
    http.get(endpoint, () => unavailable
      ? HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 503 })
      : undefined),
  );
  renderApp("/");
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 응답하지 않아요");
  expect(screen.queryByRole("button", { name: "체험 시작" })).toBeNull();
  unavailable = false;
  await userEvent.click(screen.getByRole("button", { name: "체험 상태 다시 확인" }));
  // Decision 5: the home never jumps into the review by itself; it offers to resume.
  await userEvent.click(await screen.findByRole("button", { name: "이어서 확인" }));
  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");
  expect(currentPath()).toBe("/import/review");
  expect(bootstrap).not.toHaveBeenCalled();
});

it("does not bootstrap twice when the first bootstrap succeeds but its following read fails", async () => {
  let issued = false;
  let unavailable = true;
  const session = {
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b",
    subjectId: "synthetic-bootstrap-recovery",
    status: "AUTHENTICATED",
    expiresAt: "2026-09-08T09:00:00Z",
  };
  const bootstrap = vi.fn(() => {
    issued = true;
    return HttpResponse.json({ ...session, csrfToken: "synthetic-recovery-csrf-value-000001" });
  });
  server.use(
    http.get("/api/foundation/session", () => issued ? HttpResponse.json(session)
      : HttpResponse.json({ code: "authentication_required" }, { status: 401 })),
    http.post("/api/foundation/demo-session", bootstrap),
    http.get("/api/foundation/records", () => unavailable
      ? HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 503 }) : undefined),
  );
  renderApp("/");
  await userEvent.click(await screen.findByRole("button", { name: "체험 시작" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 응답하지 않아요");
  expect(screen.queryByRole("button", { name: "체험 시작" })).toBeNull();
  unavailable = false;
  await userEvent.click(screen.getByRole("button", { name: "체험 상태 다시 확인" }));
  await userEvent.click(await screen.findByRole("button", { name: "이어서 확인" }));
  expect(await screen.findByLabelText("검토 진행")).toHaveTextContent("1 / 3");
  expect(bootstrap).toHaveBeenCalledTimes(1);
});

it("offers a new demo only after the server reports an expired session", async () => {
  server.use(http.get("/api/foundation/session", () =>
    HttpResponse.json({ code: "session_expired" }, { status: 401 })));
  renderApp("/");
  expect(await screen.findByRole("button", { name: "체험 시작" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "체험 상태 다시 확인" })).toBeNull();
  expect(screen.queryByLabelText("검토 진행")).toBeNull();
});

it("sends a signed-out person from an import stage back to the start screen", async () => {
  server.use(http.get("/api/foundation/session", () =>
    HttpResponse.json({ code: "session_expired" }, { status: 401 })));
  renderApp("/import/review");
  expect(await screen.findByRole("button", { name: "체험 시작" })).toBeVisible();
  expect(currentPath()).toBe("/");
});

it("walks every candidate of one document before reporting the result", async () => {
  renderApp("/import/review");

  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");
  expect(screen.getByRole("heading", { level: 2, name: "총콜레스테롤" })).toBeVisible();
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "확인: 원문과 같아요" }));

  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3"));
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "값 수정" }));
  const correction = screen.getByLabelText("원문과 같은 값으로 수정");
  await userEvent.clear(correction);
  await userEvent.type(correction, "5.4");
  await userEvent.click(screen.getByRole("button", { name: "수정한 값 확인" }));

  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("3 / 3"));
  expect(screen.getByRole("heading", { level: 2, name: "비타민 D" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "제외: 이 항목 빼기" }));

  expect(await screen.findByText("저장 2개 · 제외 1개")).toBeVisible();
  expect(screen.getByText("원문과 같음")).toBeVisible();
  expect(screen.getByText("값을 수정함")).toBeVisible();
  expect(screen.queryByText("CONFIRMED")).toBeNull();
  expect(screen.queryByText("CORRECTED")).toBeNull();
  expect(screen.getByRole("link", { name: "진료 준비 보기" })).toHaveAttribute("href", "/prepare");
  expect(screen.getByRole("link", { name: "내 기록 보기" })).toHaveAttribute("href", "/records");
  // Decisions never push history: the review stayed one URL the whole way.
  expect(currentPath()).toBe("/import/review");
  expect(router.push).not.toHaveBeenCalled();
});

it("resumes at the first candidate the person has not decided yet", async () => {
  candidates = candidates.map((candidate) => candidate.ordinal === 1
    ? { ...candidate, status: "CONFIRMED" }
    : candidate);

  renderApp("/import/review");

  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3");
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();
});

it("resumes an unfinished review after closing it without starting another import", async () => {
  renderApp("/import/review");
  await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" });
  await userEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(currentPath()).toBe("/");
  expect(await screen.findByRole("button", { name: "이어서 확인" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "결과지 추가" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "이어서 확인" }));
  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");
});

it("resumes the pending candidate directly after going back to the status stage", async () => {
  renderApp("/import/review");
  await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" });
  await userEvent.click(screen.getByRole("button", { name: "제외: 이 항목 빼기" }));
  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3"));
  await userEvent.click(screen.getByRole("button", { name: "이전" }));
  expect(currentPath()).toBe("/import/status");
  expect(await screen.findByLabelText("서버 상태 코드")).toHaveTextContent("REVIEW_REQUIRED");
  await userEvent.click(screen.getByRole("button", { name: "이어서 확인" }));
  expect(await screen.findByLabelText("검토 진행")).toHaveTextContent("2 / 3");
  expect(records).toHaveLength(0);
  expect(candidates[0].status).toBe("EXCLUDED");
});

it("returns home from the status stage without offering a replacement import", async () => {
  renderApp("/import/review");
  await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" });
  await userEvent.click(screen.getByRole("button", { name: "이전" }));
  await screen.findByLabelText("서버 상태 코드");
  await userEvent.click(screen.getByRole("button", { name: "이전" }));
  expect(currentPath()).toBe("/");
  expect(await screen.findByRole("button", { name: "이어서 확인" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "7월 예시 결과지로 시작" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "이어서 확인" }));
  expect(await screen.findByLabelText("검토 진행")).toHaveTextContent("1 / 3");
});

it("re-reads the server list when the server says the candidate is no longer pending", async () => {
  server.use(
    http.post("/api/foundation/candidates/:candidateId/confirmation", () => {
      candidates = candidates.map((item) => item.ordinal === 1
        ? { ...item, status: "CONFIRMED" }
        : item);
      return HttpResponse.json({ code: "candidate_not_pending" }, { status: 409 });
    }, { once: true }),
  );

  renderApp("/import/review");

  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");

  fireEvent.load(screen.getByRole("img"));
  await userEvent.click(screen.getByRole("button", { name: "확인: 원문과 같아요" }));

  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3"));
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("현재 처리 단계에서는 이 작업을 진행할 수 없어요.");
});

it("shows the review position label of the candidate in Korean", async () => {
  renderApp("/import/review");

  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByText("확인 대기")).toBeVisible();
  expect(screen.queryByText("PENDING")).toBeNull();
});

it("says what the server is doing and keeps the raw status word inside a labelled code element", async () => {
  const inspecting = { ...completedDocument, status: "SECURITY_INSPECTION", stateVersion: 2, previewAvailable: false };
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({ document: inspecting })),
    http.get("/api/foundation/documents/:documentId", () => HttpResponse.json(inspecting)),
  );

  renderApp("/import/status");

  const documentState = await screen.findByText("문서 상태");
  expect(documentState.parentElement).toHaveTextContent("파일을 검사하고 있어요 SECURITY_INSPECTION");
  expect(screen.getByLabelText("서버 상태 코드")).toHaveTextContent("SECURITY_INSPECTION");
  expect(screen.getByRole("heading", { name: "결과지를 읽고 있어요" })).toBeVisible();
  expect(screen.queryByText(/격리|적대적|신뢰 경계/)).toBeNull();
});

it("names the consent state in Korean before the person has agreed", async () => {
  server.use(
    http.get("/api/foundation/consents/document-extraction", () => HttpResponse.json({
      purposeCode: "DOCUMENT_EXTRACTION",
      status: "NOT_GRANTED",
    })),
    http.get("/api/foundation/documents/active", () => HttpResponse.json({})),
  );

  renderApp("/");

  await userEvent.click(await screen.findByRole("button", { name: "결과지 추가" }));

  expect(currentPath()).toBe("/import/consent");
  expect(await screen.findByRole("heading", { name: "결과지에서 항목을 확인해도 될까요?" })).toBeVisible();
  expect(screen.getByText("동의 전")).toBeVisible();
  expect(screen.queryByText("NOT_GRANTED")).toBeNull();
});

it("goes straight to the source stage when consent is already active, and offers the two example sheets first", async () => {
  server.use(http.get("/api/foundation/documents/active", () => HttpResponse.json({})));
  renderApp("/");
  await userEvent.click(await screen.findByRole("button", { name: "결과지 추가" }));
  expect(currentPath()).toBe("/import/source");
  expect(await screen.findByRole("heading", { name: "예시 결과지를 선택해 주세요" })).toBeVisible();
  expect(screen.getByRole("button", { name: "7월 예시 결과지로 시작" })).toHaveClass("gc-button--primary");
  expect(screen.getByRole("button", { name: "내 파일에서 고르기" })).toHaveClass("gc-button--text");
  expect(screen.getByLabelText("결과지 파일 선택")).toHaveAttribute("accept", "application/pdf,.pdf");
});

it("sends the source stage back to consent when consent is not active", async () => {
  server.use(
    http.get("/api/foundation/consents/document-extraction", () => HttpResponse.json({ purposeCode: "DOCUMENT_EXTRACTION", status: "NOT_GRANTED" })),
    http.get("/api/foundation/documents/active", () => HttpResponse.json({})),
  );
  renderApp("/import/source");
  expect(await screen.findByRole("heading", { name: "결과지에서 항목을 확인해도 될까요?" })).toBeVisible();
  expect(currentPath()).toBe("/import/consent");
  expect(screen.getByRole("alert")).toHaveTextContent("결과지 처리 동의를 먼저 확인해 주세요.");
});

it("shows the latest saved value's record row on the home screen with a humanised state, never the raw server enum", async () => {
  records = [{
    recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c40",
    recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50",
    candidateId: syntheticCandidates[0].candidateId,
    documentId: syntheticDocumentId,
    status: "CURRENT",
    reviewDecision: "CONFIRMED",
    label: "총콜레스테롤",
    value: "188",
    originalValue: "188",
    unit: "mg/dL",
    observedOn: "2026-07-28",
    originalObservedOn: "2026-07-28",
    confirmedAt: "2026-07-28T09:10:00Z",
    evidencePage: 1,
    sourceTextSha256: "b".repeat(64),
    documentSha256: "a".repeat(64),
  }];
  server.use(http.get("/api/foundation/documents/active", () => HttpResponse.json({})));

  renderApp("/");

  expect(await screen.findByRole("heading", { name: "가장 최근에 확인한 값" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "총콜레스테롤" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "직접 확인함" })).toBeVisible();
  expect(screen.getByText("직접 확인한 기록 1개")).toBeVisible();
  expect(screen.queryByText("CURRENT")).toBeNull();
  expect(screen.queryByText(/외부 기관 연결|체험 중|현재 허용 범위/)).toBeNull();
});

it("shows the abstention list instead of a review when the worker read no items", async () => {
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({ document: { ...completedDocument, status: "EXTRACTION_RUNNING" } })),
    http.get("/api/foundation/documents/:documentId", () => HttpResponse.json({
      ...completedDocument,
      status: "COMPLETED",
      abstentions: [{ label: "문서 전체", reason: "unreadable" }, { label: "LDL", reason: "ambiguous_value", evidencePage: 1 }],
    })),
    http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json([])),
  );
  renderApp("/import/status");

  expect(await screen.findByRole("heading", { name: "이 결과지에서 읽을 수 있는 항목이 없었어요" }, { timeout: 5_000 })).toBeVisible();
  expect(currentPath()).toBe("/import/review");
  expect(screen.getByText("읽은 글자는 있지만 항목·값·단위를 확실히 맞출 수 없었어요. 아래 사유를 확인해 주세요.")).toBeVisible();
  const reasons = within(screen.getByRole("list", { name: "읽지 못한 항목" })).getAllByRole("listitem");
  expect(reasons[0]).toHaveTextContent("문서 전체");
  expect(reasons[0]).toHaveTextContent("글자 정보를 읽을 수 없음");
  expect(reasons[1]).toHaveTextContent("LDL");
  expect(reasons[1]).toHaveTextContent("값이 여러 개로 읽힘");
  expect(reasons[1]).toHaveTextContent("1쪽");
  expect(screen.queryByText("unreadable")).toBeNull();
  expect(screen.queryByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeNull();
});

it("shows the ambiguous-parse sentence instead of the scan sentence when the worker read text but matched no rows", async () => {
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({ document: { ...completedDocument, status: "EXTRACTION_RUNNING" } })),
    http.get("/api/foundation/documents/:documentId", () => HttpResponse.json({
      ...completedDocument,
      status: "COMPLETED",
      abstentions: [{ label: "결과지", reason: "unreadable", evidencePage: 1 }],
    })),
    http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json([])),
  );
  renderApp("/import/status");

  expect(await screen.findByRole("heading", { name: "이 결과지에서 읽을 수 있는 항목이 없었어요" }, { timeout: 5_000 })).toBeVisible();
  expect(screen.getByText("읽은 글자는 있지만 항목·값·단위를 확실히 맞출 수 없었어요. 아래 사유를 확인해 주세요.")).toBeVisible();
  expect(screen.queryByText("글자 정보가 없는 파일(사진·스캔)은 아직 읽지 못해요.")).toBeNull();
});

it("shows the reviewed summary, not the zero-candidate screen, when polling finds a document completed elsewhere", async () => {
  const confirmed = syntheticCandidates.map((candidate) => ({ ...candidate, status: "CONFIRMED" as const }));
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({ document: { ...completedDocument, status: "EXTRACTION_RUNNING" } })),
    http.get("/api/foundation/documents/:documentId", () => HttpResponse.json({ ...completedDocument, status: "COMPLETED" })),
    http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json(confirmed.slice(0, 2))),
  );
  renderApp("/import/status");

  expect(await screen.findByRole("heading", { name: "이 결과지 확인을 마쳤어요" }, { timeout: 5_000 })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "이 결과지에서 읽을 수 있는 항목이 없었어요" })).toBeNull();
});

it("reaches the zero-candidate screen when the active document is already completed on load", async () => {
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({
      document: { ...completedDocument, status: "COMPLETED", stateVersion: 6, abstentions: [{ label: "스캔 페이지", reason: "unreadable", evidencePage: 1 }] },
    })),
    http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json([])),
  );

  renderApp("/import/review");

  expect(await screen.findByText("이 결과지에서 읽을 수 있는 항목이 없었어요")).toBeVisible();
  expect(screen.getByText("글자 정보를 읽을 수 없음")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "결과지를 읽고 있어요" })).toBeNull();
});

it("redirects a review deep link to the status stage while the server is still processing", async () => {
  const running = { ...completedDocument, status: "EXTRACTION_RUNNING" };
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({ document: running })),
    http.get("/api/foundation/documents/:documentId", () => HttpResponse.json(running)),
  );
  renderApp("/import/review");
  expect(await screen.findByRole("heading", { name: "결과지를 읽고 있어요" })).toBeVisible();
  expect(currentPath()).toBe("/import/status");
});

it("shows 최근 변화 on the home screen only when the server reports items", async () => {
  server.use(http.get("/api/foundation/documents/active", () => HttpResponse.json({})));
  renderApp("/");
  expect(await screen.findByRole("heading", { name: "아직 저장된 기록이 없어요" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "최근 변화" })).toBeNull();
  cleanup();

  changes = {
    latestDocument: {
      documentId: syntheticDocumentId,
      observedOn: "2026-07-28",
      completedAt: "2026-07-28T09:20:00Z",
      eventCount: 1,
    },
    items: [{
      conceptCode: "total-cholesterol",
      concept: "총콜레스테롤",
      unit: "mg/dL",
      latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
      previous: { eventId: "9c3e4f50-6172-4c8d-ae9f-1a2b3c4d5e60", value: "194", observedOn: "2026-01-15" },
    }],
    newConcepts: [],
    unchangedCount: 0,
  };
  renderApp("/");
  expect(await screen.findByRole("heading", { name: "최근 변화" })).toBeVisible();
  expect(screen.getByTestId("change-item")).toHaveTextContent(
    "총콜레스테롤 · 이번 2026. 7. 28. 188 mg/dL · 이전 2026. 1. 15. 194 mg/dL",
  );
});

it("keeps the home screen working when /changes fails, hiding 최근 변화 instead of blocking restore", async () => {
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({})),
    http.get("/api/foundation/changes", () => HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 500 })),
  );
  renderApp("/");

  expect(await screen.findByRole("heading", { name: "아직 저장된 기록이 없어요" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "최근 변화" })).toBeNull();
  expect(screen.queryByText("체험 상태를 불러오지 못했어요")).toBeNull();
  expect(screen.queryByRole("button", { name: "체험 상태 다시 확인" })).toBeNull();
});

it("keeps the home screen working when /changes returns a schema-rejected body, hiding 최근 변화", async () => {
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({})),
    http.get("/api/foundation/changes", () => HttpResponse.json({
      items: [],
      newConcepts: [],
      unchangedCount: 0,
      unexpectedField: "should cause strict schema rejection",
    })),
  );
  renderApp("/");

  expect(await screen.findByRole("heading", { name: "아직 저장된 기록이 없어요" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "최근 변화" })).toBeNull();
  expect(screen.queryByText("체험 상태를 불러오지 못했어요")).toBeNull();
  expect(screen.queryByRole("button", { name: "체험 상태 다시 확인" })).toBeNull();
});

it("shows one boundary caption on the home, at the bottom, and no system explanation", async () => {
  server.use(http.get("/api/foundation/documents/active", () => HttpResponse.json({})));
  const { container } = renderApp("/");
  await screen.findByRole("heading", { name: "아직 저장된 기록이 없어요" });
  const captions = container.querySelectorAll(".gc-caption");
  expect(captions).toHaveLength(1);
  expect(captions[0]).toHaveTextContent("값의 의미나 건강 상태는 판단하지 않아요. 선의 모양과 색은 시간의 위치만 나타내요.");
  expect(container.textContent).not.toMatch(/OCR|MyHealthWay|격리|비활성화|외부 기관 연결/);
});
```

Run: `pnpm --dir apps/web exec vitest run tests/integrated-review-loop.test.tsx`
Expected: PASS (24 cases). If a case fails with "unhandled request" at `/api/foundation/documents/:documentId`, the status stage polled a non-pollable document — check `pollableStates` gating in the hook.

- [ ] **Step 6: Keep the copy scan honest for this task**

In `apps/web/tests/korean-ux-copy.test.ts`:

1. In `userFacingFiles` add `"components/experience/EntryView.tsx"`, `"components/experience/RestoreFailedView.tsx"`, `"components/experience/HomeView.tsx"`, `"components/experience/ConsentView.tsx"`, `"components/experience/SourceView.tsx"`, `"components/experience/ProcessingView.tsx"`, `"components/experience/CompleteView.tsx"`, `"components/experience/StageFrame.tsx"`, `"components/experience/ReviewStage.tsx"`, `"lib/experience/use-experience-state.ts"`, `"components/ui/Patch.tsx"`, `"components/integrated/IntegratedShell.tsx"`.
2. Every `source("components/integrated/IntegratedHealthExperience.tsx")` assertion now points at the file that holds the string: the three abstention sentences and `describeAbstention(item)` → `components/experience/CompleteView.tsx`; `not.toContain("{item.reason}")` and `not.toContain("labelAbstentionReason(item.reason)")` → same file; `<code aria-label="서버 상태 코드">{documentReceipt.status}</code>` and `{processingCopy[documentReceipt.status]} ` → `components/experience/ProcessingView.tsx`; `<RecentChanges changes={changes} />` → `components/experience/HomeView.tsx` with the string `<RecentChanges changes={state.changes} />`.
3. Add to `forbiddenUserTerms`: `"합성 PDF"`, `"합성 후보"`, `"적대적 문서 격리 구역"`, `"신뢰 경계"`.

Run: `pnpm --dir apps/web exec vitest run tests/korean-ux-copy.test.ts`
Expected: PASS.

- [ ] **Step 7: Browser lifecycle — URLs and the changed strings**

In `apps/web/e2e/foundation-lifecycle.spec.ts`, main test:

1. After `await page.getByRole("button", { name: "결과지 추가" }).click();` add `await expect(page).toHaveURL(/\/import\/consent$/);`. After the consent click, replace the source-heading expectation with:

```ts
  await expect(page).toHaveURL(/\/import\/source$/);
  await expect(page.getByRole("heading", { name: "예시 결과지를 선택해 주세요" })).toBeVisible();
  await captureMatrix(page, info, "import-source");
```

2. Replace `await expect(page.getByText("적대적 문서 격리 구역", { exact: true })).toBeVisible();` with:

```ts
  await expect(page).toHaveURL(/\/import\/status$/);
  await expect(page.getByRole("heading", { name: "결과지를 읽고 있어요" })).toBeVisible();
  await expect(page.getByText("적대적")).toHaveCount(0);
  await captureMatrix(page, info, "import-status");
```

3. After the review heading becomes visible add `await expect(page).toHaveURL(/\/import\/review$/);`.

4. Replace the 이전/이어서 확인 sequence (`await page.getByRole("button", { name: "이전", exact: true }).click(); await expect(page.getByLabel("서버 상태 코드")).toHaveText("REVIEW_REQUIRED"); … await expect(page.getByLabel("검토 진행")).toHaveText("2 / 3");` up to and including the second `toHaveText("2 / 3")`) with:

```ts
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await expect(page).toHaveURL(/\/import\/status$/);
  await expect(page.getByLabel("서버 상태 코드")).toHaveText("REVIEW_REQUIRED");
  await page.getByRole("button", { name: "이어서 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/import\/review$/);
  await expect(page.getByLabel("검토 진행")).toHaveText("2 / 3");
  // Browser back walks the stages, never a decision: review → status.
  await page.goBack();
  await expect(page).toHaveURL(/\/import\/status$/);
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "결과지 추가", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "이어서 확인", exact: true }).click();
  await expect(page.getByLabel("검토 진행")).toHaveText("2 / 3");
```

5. Before `await page.goto("/records")` (the first outage block) add `await captureMatrix(page, info, "import-complete");` right after `await expect(page.getByText("검사일을 수정함", { exact: true })).toBeVisible();`.

6. For the second document: after `await page.getByRole("button", { name: "결과지 추가" }).click();` replace the heading regex `/허용된 합성 PDF를\s*선택해 주세요/` with `"예시 결과지를 선택해 주세요"`.

Keyboard test (`for (const [zoom, width] …)`): replace `page.getByLabel("허용된 합성 PDF 선택")` with `page.getByLabel("결과지 파일 선택")`; replace `main[data-stage='processing'] [role='status']` with `main[data-stage='status'] [role='status']`; replace the regex `/보안 구역|안전하게 확인|다시 시도|미리보기/` with `/받았어요|검사하고|읽고 있어요|다시 시도|준비됐어요|기다리고/`; replace `page.getByRole("link", { name: "저장된 기록 보기" })` with `page.getByRole("link", { name: "내 기록 보기" })`.

- [ ] **Step 8: Gates, lifecycle, commit**

```bash
pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm --dir apps/web build
pnpm foundation:e2e
git checkout -- apps/web/next-env.d.ts
git add apps/web/lib/experience apps/web/components/experience apps/web/app/import apps/web/components/integrated/IntegratedHealthExperience.tsx apps/web/components/integrated/CandidateReview.tsx apps/web/components/home/AliveEntryLayout.tsx apps/web/tests/helpers apps/web/tests/integrated-review-loop.test.tsx apps/web/tests/alive-entry-layout.test.tsx apps/web/tests/korean-ux-copy.test.ts apps/web/e2e/foundation-lifecycle.spec.ts
git commit -m "refactor(web): split IntegratedHealthExperience into views over useExperienceState; import flow lives at /import/*

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Expected: `next build` lists `/import/consent`, `/import/source`, `/import/status`, `/import/review`; lifecycle `3 passed`.

---
### Task 4: Screens on the system — 나의 데이터, 측정 이력, 내 기록, 데이터 관리, 진료 준비

**Files:**
- Create: `apps/web/components/ui/EmptyState.tsx`, `apps/web/components/integrated/Records.module.css`, `apps/web/components/integrated/DataControl.module.css`, `apps/web/components/integrated/Prepare.module.css`, `apps/web/components/integrated/RecentChanges.module.css`
- Rewrite: `apps/web/components/my-data/MyData.module.css`, `apps/web/components/my-data/history/History.module.css`
- Modify: `apps/web/components/my-data/{MyData,LivingCellCanvas,HealthEventTable,EvidenceDrawer,CellTooltip}.tsx`, `apps/web/components/my-data/history/{MeasurementHistory,HistoryGraph}.tsx`, `apps/web/components/integrated/{IntegratedRecords,RecordComparison,RecentChanges,IntegratedDataControl,VisitPreparation}.tsx`, `apps/web/lib/foundation/client.ts`, `apps/web/app/data-control/page.tsx` (description only), tests `my-data.test.tsx`, `living-cell-canvas.test.tsx`, `measurement-history.test.tsx`, `integrated-records-grouping.test.tsx`, `integrated-data-control.test.tsx`, `visit-preparation.test.tsx`, `recent-changes.test.tsx`, `korean-ux-copy.test.ts`, `e2e/foundation-lifecycle.spec.ts`

**Interfaces:**
- Consumes: tokens, `system.css` classes, `Patch`, `IntegratedShell`, `SCREEN_TITLES`.
- Produces: `EmptyState({ title, body, actionHref?, actionLabel?, meta? })`; `HEALTH_EVENTS_EXPORT_PATH = "/api/foundation/health-events/export"`, `HEALTH_EVENTS_FHIR_EXPORT_PATH = "/api/foundation/health-events/export/fhir"` in `lib/foundation/client.ts`; `HISTORY_TIME_GRADIENT_STOPS` now read from `@gc/design-tokens/tokens.json` with the muted end; `LivingCellCanvas` cell size 14 / gap 4 inside a scrolling canvas; `HealthEventTable` renders the table (desktop) and a card list `aria-label="기록 목록"` (mobile) — both in the DOM, one hidden per breakpoint; data attributes `data-testid="record-group"` on records groups; `data-testid="system-notes"` on the 데이터 관리 `자세히` block.

Copy this task changes: my-data search label "내 데이터에서 항목 찾기" → "항목 찾기"; my-data empty "아직 확인한 기록이 없어요. 데이터 관리에서 결과지를 추가하면 여기에 한 칸씩 쌓여요." → title "아직 확인한 기록이 없어요" + body "결과지를 추가하고 값을 확인하면 여기에 한 칸씩 쌓여요." + button "결과지 추가"; history empty likewise (body "결과지를 추가해 값을 확인하면 여기에 항목별로 모여요."); history timebar gets a visible legend "색은 시간이에요. 왼쪽이 먼저, 오른쪽이 나중."; records: "서버에서 건강 기록을 불러오고 있어요." → "기록을 불러오고 있어요.", empty "아직 저장된 합성 기록이 없어요. 홈에서 허용된 합성 PDF를 확인해 주세요." → EmptyState (title "아직 확인한 기록이 없어요", body "결과지를 추가하고 값을 확인하면 날짜별로 여기에 모여요."), `<span>서버 응답만 표시해요</span>` removed, per-record `<span>예시 데이터</span>` removed, "후보 근거값" → "원문 확인값", the boundary section becomes the caption "값의 의미나 건강 상태는 판단하지 않아요."; RecordComparison "예시 데이터 · 직접 확인한 두 날짜의 값" → "직접 확인한 두 날짜의 값"; data-control h1 "내 데이터" → "데이터 관리", `<strong>예시 데이터 전용 · 실제 개인정보 없음</strong>` → status badge "예시 데이터", the summary numerals section and the top demo links are removed, purpose description "허용된 합성 PDF에 대해 문서 요청, 논리 격리, 검사, 합성 후보 확인을 허용합니다. 철회하면 새 결과지를 처리하지 않아요." → "결과지를 읽어 확인할 항목을 만드는 데 써요. 철회하면 새 결과지를 처리하지 않아요.", "합성 프로필을 삭제할까요?" → "기록과 동의를 모두 삭제할까요?", deletion lede → "결과지, 확인한 기록, 동의가 삭제되고 이 브라우저의 로그인도 끝나요.", "체험 데이터가 삭제됐고 이 브라우저의 체험도 끝났어요." → "기록이 삭제됐고 이 브라우저의 로그인도 끝났어요."; prepare source line "예시 데이터 · {date}" → "검사일 {date}", "기록으로 돌아가기" → "내 기록으로", question eyebrow "질문 N · 기록으로 만든 고정 질문" → "질문 N".

- [ ] **Step 1: `EmptyState` and the export constants**

Create `apps/web/components/ui/EmptyState.tsx`:

```tsx
import { Patch } from "@/components/ui/Patch";

export type EmptyStateProps = {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
  /** Patch metadata, e.g. ["기록", "0"]. */
  meta?: readonly string[];
};

/** Every empty state is the next action plus a preview: three dim example cells on the grid, then the button. */
export function EmptyState({ title, body, actionHref = "/import/source", actionLabel = "결과지 추가", meta = ["기록", "0"] }: EmptyStateProps) {
  return (
    <section className="gc-grid-ground" aria-labelledby="empty-state-title" data-testid="empty-state">
      <Patch variant="card" meta={meta}>
        <svg viewBox="0 0 120 32" width="120" height="32" aria-hidden="true" focusable="false" data-part="preview">
          <rect x="8" y="9" width="14" height="14" fill="none" stroke="currentColor" strokeOpacity="0.35" />
          <rect x="53" y="9" width="14" height="14" fill="none" stroke="currentColor" strokeOpacity="0.35" />
          <rect x="98" y="9" width="14" height="14" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        </svg>
        <h2 id="empty-state-title">{title}</h2>
        <p>{body}</p>
        <a className="gc-button gc-button--primary" href={actionHref}>{actionLabel}</a>
      </Patch>
    </section>
  );
}
```

In `apps/web/lib/foundation/client.ts` add after the `problemSchema` line:

```ts
/** The two download URLs the 데이터 관리 screen links to. The core sets the file name and headers. */
export const HEALTH_EVENTS_EXPORT_PATH = "/api/foundation/health-events/export";
export const HEALTH_EVENTS_FHIR_EXPORT_PATH = "/api/foundation/health-events/export/fhir";
```

- [ ] **Step 2: 나의 데이터 — failing tests first**

In `apps/web/tests/my-data.test.tsx`:
- every `"내 데이터에서 항목 찾기"` → `"항목 찾기"`;
- the empty-state expectation becomes `expect(await screen.findByRole("heading", { name: "아직 확인한 기록이 없어요" })).toBeVisible(); expect(screen.getByText("결과지를 추가하고 값을 확인하면 여기에 한 칸씩 쌓여요.")).toBeVisible(); expect(screen.getByRole("link", { name: "결과지 추가" })).toHaveAttribute("href", "/import/source");`;
- in "links to the measurement history…" keep `screen.getByRole("link", { name: "측정 이력" })` (it is the shell's link now) and add `expect(screen.queryByRole("navigation", { name: "나의 데이터 다른 보기" })).toBeNull();`;
- add:

```tsx
it("renders the same events as a card list for phones and keeps the table for wide screens", async () => {
  render(<MyData />);
  await screen.findByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
  const list = screen.getByRole("list", { name: "기록 목록" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  const first = within(list).getAllByRole("listitem")[0];
  expect(within(first).getAllByRole("term").map((term) => term.textContent)).toEqual(["값", "검사일", "확인"]);
  expect(within(first).getByRole("button", { name: /근거 보기$/ })).toBeVisible();
  expect(screen.getByRole("table", { name: "기록 목록" })).toBeInTheDocument();
});

it("keeps the canvas at least 14 CSS px per cell by letting the canvas scroll instead of shrinking", async () => {
  const { container } = render(<MyData />);
  await screen.findByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
  const svg = container.querySelector("figure svg")!;
  expect(svg.getAttribute("style")).toContain("min-width: 720px");
  expect(svg.querySelector("rect[data-cell]")).toHaveAttribute("width", "14");
  expect(container.querySelector("[data-scroll-canvas]")).not.toBeNull();
});
```

In `apps/web/tests/living-cell-canvas.test.tsx` nothing changes (no size is pinned there).

Run: `pnpm --dir apps/web exec vitest run tests/my-data.test.tsx` — Expected: FAIL on the new label, the empty state, the list and the size.

- [ ] **Step 3: 나의 데이터 — implement**

`apps/web/components/my-data/LivingCellCanvas.tsx`: set `const CELL = 14; const GAP = 4;`; wrap the `<svg>` in `<div className={styles.canvasScroll} data-scroll-canvas="">` and give the svg `style={{ minWidth: `${width}px` }}` (keep `width="100%"`); the figure keeps its caption. `apps/web/components/my-data/HealthEventTable.tsx` — replace the component body with:

```tsx
export function HealthEventTable({ events, selectedId, matchedIds, onSelect }: HealthEventTableProps) {
  const visible = matchedIds ? events.filter((event) => matchedIds.has(event.eventId)) : events;
  const stateOf = (event: HealthEvent) => `${event.corrected ? "직접 수정" : "직접 확인"}${event.verification === "uncertain" ? " · 출처 미리보기 없음" : ""}`;
  const evidenceLabel = (event: HealthEvent) => `${event.concept} ${event.value} ${event.unit}, ${formatKoreanDate(event.observedOn)} 근거 보기`;
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="기록 목록">
          <thead>
            <tr><th scope="col">항목</th><th scope="col">값</th><th scope="col">검사일</th><th scope="col">확인</th><th scope="col">근거</th></tr>
          </thead>
          <tbody>
            {visible.map((event) => (
              <tr key={event.eventId} aria-current={event.eventId === selectedId ? "true" : undefined}>
                <th scope="row">{event.concept}</th>
                <td className={styles.num}>{event.value} {event.unit}</td>
                <td>{formatKoreanDate(event.observedOn)}</td>
                <td>{stateOf(event)}</td>
                <td>
                  <button type="button" className="gc-button gc-button--secondary" onClick={(click) => onSelect(event.eventId, click.currentTarget)} aria-label={evidenceLabel(event)}>근거 보기</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* The same rows as two-column cards for phones (§8.14); CSS shows one of the two. */}
      <ul className={styles.cards} aria-label="기록 목록">
        {visible.map((event) => (
          <li key={event.eventId} aria-current={event.eventId === selectedId ? "true" : undefined}>
            <h3>{event.concept}</h3>
            <dl>
              <div><dt>값</dt><dd className={styles.num}>{event.value} {event.unit}</dd></div>
              <div><dt>검사일</dt><dd>{formatKoreanDate(event.observedOn)}</dd></div>
              <div><dt>확인</dt><dd>{stateOf(event)}</dd></div>
            </dl>
            <button type="button" className="gc-button gc-button--secondary" onClick={(click) => onSelect(event.eventId, click.currentTarget)} aria-label={evidenceLabel(event)}>근거 보기</button>
          </li>
        ))}
      </ul>
    </>
  );
}
```

(Add `import type { HealthEvent } from "@/lib/foundation/client";` — it is already imported.)

`apps/web/components/my-data/MyData.tsx`: import `EmptyState` and `SCREEN_TITLES`; status `"예시 데이터"`; `<main className={`${styles.page} gc-grid-ground`}>`; hero `<h1 id="my-data-title">{SCREEN_TITLES.myData}</h1>`; delete both `<nav className={styles.secondary} …>` blocks; the empty branch becomes `<EmptyState title="아직 확인한 기록이 없어요" body="결과지를 추가하고 값을 확인하면 여기에 한 칸씩 쌓여요." />`; the search label text `항목 찾기`; loading/error lines get `className="gc-meta"` / `className="gc-error"`; the retry button gets `className="gc-button gc-button--text"`; add `<p className="gc-caption">한 칸이 확인한 기록 하나예요. 값의 의미나 변화의 방향은 판단하지 않아요.</p>` as the last child of `<main>` and shorten the hero's third sentence to `칸을 고르면 값과 출처를 볼 수 있어요.` (the boundary now lives in the caption; keep the exact sentence `값의 의미나 변화의 방향은 판단하지 않아요.` inside the caption because `korean-ux-copy.test.ts` asserts it on this file). The `LivingCellCanvas` figcaption `한 칸 = 확인한 기록 하나. 값의 의미나 변화의 방향은 판단하지 않아요.` becomes `한 칸 = 확인한 기록 하나.` (one boundary sentence per screen).

`EvidenceDrawer.tsx`: the close button gets `className="gc-button gc-button--secondary"`; nothing else. `CellTooltip.tsx`: unchanged.

Replace `apps/web/components/my-data/MyData.module.css` with:

```css
.page { min-height: 100vh; color: var(--gc-color-text-primary); }
.shell { max-width: 1120px; margin: 0 auto; padding: var(--gc-space-6) var(--gc-space-4) var(--gc-space-10); min-width: 0; }
.hero { display: grid; gap: var(--gc-space-2); margin-bottom: var(--gc-space-6); }
.hero h1 { font-family: var(--gc-type-serif); font-weight: 400; font-size: var(--gc-type-display); line-height: 1.2; }
.hero p { color: var(--gc-color-text-secondary); }

.canvasWrap { position: relative; border: var(--gc-rule); background: var(--gc-color-surface-raised); padding: var(--gc-space-3); min-width: 0; }
.canvasScroll { overflow-x: auto; -webkit-overflow-scrolling: touch; min-width: 0; }
.canvas { display: block; width: 100%; height: auto; }
.axis line { stroke: var(--gc-color-line-strong); stroke-width: 1; }
.axis text { fill: var(--gc-color-text-secondary); font: var(--gc-type-meta) var(--gc-type-mono); }

.cell { cursor: pointer; color: var(--gc-color-text-primary); transition: opacity var(--gc-motion-standard) ease; }
.cell rect[data-cell] { fill: var(--gc-color-surface-soft); stroke: var(--gc-color-line-strong); stroke-width: 1; }
.cell[data-state="new"] rect[data-cell] { fill: var(--gc-color-surface-raised); stroke: var(--gc-color-text-primary); stroke-width: 1.5; }
.cell[data-state="query-related"] rect[data-cell] { fill: var(--gc-color-text-primary); stroke: var(--gc-color-text-primary); }
.cell rect[data-query-ring] { fill: none; stroke: var(--gc-color-text-primary); stroke-width: 1; stroke-dasharray: 2 1.5; }
.cell[data-state="selected"] rect[data-cell] { fill: var(--gc-color-text-primary); stroke: var(--gc-color-focus-ring); stroke-width: 2; }
.cell[data-dim="true"] { opacity: 0.28; }
.cell circle[data-corrected-mark] { fill: var(--gc-color-text-secondary); }
.cell:focus-visible { outline: none; }
.cell:focus-visible rect[data-cell] { stroke: var(--gc-color-focus-ring); stroke-width: 2.5; }

@keyframes gc-cell-arrive { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
.cellArrived { animation: gc-cell-arrive 420ms ease-out 1 both; transform-box: fill-box; transform-origin: center; }

.tooltip { position: absolute; transform: translate(-50%, -110%); display: grid; gap: 2px; padding: 6px 10px; background: var(--gc-color-surface-inverse); color: var(--gc-color-text-inverse); font: 0.8125rem var(--gc-type-mono); pointer-events: none; white-space: normal; max-width: min(240px, calc(100vw - 32px)); }
.caption { margin-top: var(--gc-space-2); color: var(--gc-color-text-secondary); font-size: 0.8125rem; }
.adjustedNotice { margin-top: var(--gc-space-1); color: var(--gc-color-text-secondary); font-size: 0.8125rem; min-width: 0; overflow-wrap: anywhere; }

.search { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gc-space-2); margin: var(--gc-space-6) 0; min-width: 0; }
.search input { width: 100%; min-width: 0; box-sizing: border-box; min-height: 48px; padding: 0 var(--gc-space-4); border: 1px solid var(--gc-color-line-strong); background: var(--gc-color-surface-canvas); color: var(--gc-color-text-primary); font: 1rem var(--gc-type-sans); }

.tableWrap { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
.table th, .table td { text-align: left; padding: var(--gc-space-2) var(--gc-space-3); border-bottom: var(--gc-rule); font-weight: 400; }
.table th[scope="col"] { color: var(--gc-color-text-secondary); font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); }
.num { font-family: var(--gc-type-mono); }
.table td.num { text-align: right; }
.table tr[aria-current="true"] td { background: var(--gc-color-surface-soft); }
.cards { display: none; list-style: none; margin: 0; padding: 0; gap: var(--gc-space-3); }
.cards li { border: var(--gc-rule); background: var(--gc-color-surface-raised); padding: var(--gc-space-3); display: grid; gap: var(--gc-space-2); min-width: 0; }
.cards li[aria-current="true"] { border-color: var(--gc-color-text-primary); }
.cards h3 { font-size: 1rem; font-weight: 600; }
.cards dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gc-space-1) var(--gc-space-3); }
.cards dl div { display: contents; }
.cards dt { color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.cards dd { min-width: 0; overflow-wrap: anywhere; }

.drawer { border: var(--gc-rule); background: var(--gc-color-surface-raised); padding: var(--gc-space-4); margin-top: var(--gc-space-4); display: grid; gap: var(--gc-space-3); min-width: 0; overflow-wrap: anywhere; }
.drawer header { display: flex; align-items: center; justify-content: space-between; gap: var(--gc-space-3); }
.drawer header h2 { font-family: var(--gc-type-serif); font-weight: 400; font-size: var(--gc-type-title); }
.drawer dl { display: grid; grid-template-columns: minmax(0, max-content) minmax(0, 1fr); gap: var(--gc-space-1) var(--gc-space-4); }
.drawer dt { color: var(--gc-color-text-secondary); }
.drawer dd { font-family: var(--gc-type-mono); overflow-wrap: anywhere; }
.drawer a { min-height: var(--gc-target-minimum); display: inline-flex; align-items: center; }

@media (max-width: 42rem) {
  .tableWrap { display: none; }
  .cards { display: grid; }
}
@media (prefers-reduced-motion: reduce) {
  .cell { transition: none; }
  .cellArrived { animation: none; }
}
```

Run: `pnpm --dir apps/web exec vitest run tests/my-data.test.tsx tests/living-cell-canvas.test.tsx tests/evidence-drawer.test.tsx` — Expected: PASS.

- [ ] **Step 4: 측정 이력 — failing tests, then implement**

In `apps/web/tests/measurement-history.test.tsx`:
- every `"var(--hist-ink)"` → `"var(--gc-color-text-primary)"`;
- in "draws every series' ribbon…" add after the timebar assertions: `expect(screen.getByText("색은 시간이에요. 왼쪽이 먼저, 오른쪽이 나중.")).toBeVisible(); expect(HISTORY_TIME_GRADIENT_STOPS[3].color).toBe("#9AA88A"); expect(HISTORY_TIME_GRADIENT_STOPS.map((stop) => stop.color)).not.toContain("#c8f02a");`;
- in "says so when there is nothing yet…" replace the sentence assertion with `expect(await screen.findByRole("heading", { name: "아직 확인한 기록이 없어요" })).toBeVisible(); expect(screen.getByText("결과지를 추가해 값을 확인하면 여기에 항목별로 모여요.")).toBeVisible();`;
- add:

```tsx
it("never grows the container from its own measurement (ResizeObserver → setState loop guard)", async () => {
  const observed: Array<ResizeObserverCallback> = [];
  class FakeResizeObserver { constructor(callback: ResizeObserverCallback) { observed.push(callback); } observe() {} disconnect() {} unobserve() {} }
  const original = globalThis.ResizeObserver;
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, writable: true, value: FakeResizeObserver });
  try {
    render(<MeasurementHistory />);
    await screen.findAllByTestId("history-series");
    const svg = document.querySelector("[data-testid='history-series'] svg")!;
    const before = svg.getAttribute("width");
    // A resize notification that reports the same width must not re-render a different width.
    for (const callback of observed) callback([{ contentRect: { width: Number(before) } } as ResizeObserverEntry], {} as ResizeObserver);
    expect(svg.getAttribute("width")).toBe(before);
  } finally {
    Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, writable: true, value: original });
  }
});
```

`apps/web/components/my-data/history/HistoryGraph.tsx`:
- replace the `HISTORY_TIME_GRADIENT_STOPS` block with:

```ts
import tokens from "@gc/design-tokens/tokens.json";

/**
 * The founder-approved time gradient: the same four stops for every series, left (earlier) to
 * right (later). It marks a position in time, never a value; the last stop is the muted end
 * (§8.9) so "later" never reads as "lime = good".
 */
export const HISTORY_TIME_GRADIENT_STOPS = [
  { offset: "0", color: tokens.color.time.start },
  { offset: ".55", color: tokens.color.time.mid },
  { offset: ".8", color: tokens.color.time.late },
  { offset: "1", color: tokens.color.time["end-muted"] },
] as const;
```

- replace `useContainerWidth` with:

```ts
function useContainerWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const apply = (measured: number) => {
      const next = Math.floor(measured);
      // Only a real change re-renders: the svg's own width attribute follows `width`, so echoing the
      // same number back would otherwise loop observer → setState → layout → observer.
      if (next > 0) setWidth((current) => (Math.abs(current - next) >= 1 ? next : current));
    };
    apply(element.getBoundingClientRect().width);
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
```

- every `"var(--hist-ink)"` → `"var(--gc-color-text-primary)"`.

`apps/web/components/my-data/history/MeasurementHistory.tsx`: import `EmptyState`; status `"예시 데이터"`; `<main className={`${styles.page} gc-grid-ground`}>`; remove the `<p><a href="/my-data">나의 데이터로 돌아가기</a></p>` line (the shell holds 나의 데이터); after the timebar `div` add `<p className={styles.legend}>색은 시간이에요. 왼쪽이 먼저, 오른쪽이 나중.</p>`; the empty branch becomes `<EmptyState title="아직 확인한 기록이 없어요" body="결과지를 추가해 값을 확인하면 여기에 항목별로 모여요." />`; loading/error classes as on 나의 데이터; the three derived `dd` get `className="gc-pixel"` in addition to their test ids (`<dd className="gc-pixel" data-testid="derived-last-difference">`); add `<p className="gc-caption">뺄셈과 나눗셈으로만 계산했어요. 의미는 판단하지 않아요.</p>` as the last child of `<main>` and remove that same sentence from the hero (the copy test asserts the sentence exists in this file; it now exists once, in the caption).

Replace `apps/web/components/my-data/history/History.module.css` with:

```css
/* The 측정 이력 screen on the global dark tokens (the wave-4 pilot's local palette is gone). */
.page { min-height: 100vh; color: var(--gc-color-text-primary); }
.shell { max-width: 1120px; margin: 0 auto; padding: var(--gc-space-6) var(--gc-space-4) var(--gc-space-10); display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gc-space-6); min-width: 0; }
.hero { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gc-space-2); min-width: 0; overflow-wrap: anywhere; }
.hero h1 { font: 400 var(--gc-type-display) / 1.2 var(--gc-type-serif); }
.hero p { color: var(--gc-color-text-secondary); }

.timebar { display: grid; gap: var(--gc-space-2); min-width: 0; margin-top: var(--gc-space-2); }
.timebarEnds { display: flex; justify-content: space-between; gap: var(--gc-space-3); min-width: 0; color: var(--gc-color-text-secondary); font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); }
.timebarBar { height: 12px; background-image: var(--gc-time-gradient); }
.legend { color: var(--gc-color-text-secondary); font-size: 0.875rem; }

.series { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--gc-space-3); min-width: 0; padding: var(--gc-space-4); border: var(--gc-rule); background: var(--gc-color-surface-raised); overflow-wrap: anywhere; }
.seriesHeader { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gc-space-2); min-width: 0; }
.seriesHeader h2 { font: 400 var(--gc-type-title) / 1.3 var(--gc-type-serif); }
.unit { color: var(--gc-color-text-secondary); font-family: var(--gc-type-mono); }

.graphWrap { width: 100%; min-width: 0; max-width: 100%; overflow: hidden; }
.graph { display: block; max-width: 100%; height: auto; }
/* Colour means position in time only and is identical for every series: the stroke is the shared
   linearGradient (HistoryGraph.tsx). These classes set shape only — never a colour. */
.ribbonBand { fill: none; stroke-opacity: 0.28; stroke-width: 26px; stroke-linecap: round; stroke-linejoin: round; }
.ribbonBody { fill: none; stroke-width: 13px; stroke-linecap: round; stroke-linejoin: round; }
.ribbonCentre { fill: none; stroke-opacity: 0.55; stroke-width: 1px; stroke-dasharray: 7 5; }
.ticks line { stroke: var(--gc-color-line-strong); stroke-width: 1; }
.ticks text { fill: var(--gc-color-text-secondary); font: var(--gc-type-meta) var(--gc-type-mono); }
.leader { stroke: var(--gc-color-text-primary); stroke-width: 1; }
.anchor { cursor: pointer; }
.anchor rect[data-hit] { fill: transparent; }
.anchor:focus-visible { outline: none; }
.anchor:focus-visible rect[data-anchor] { stroke: var(--gc-color-focus-ring); stroke-width: 3; }

.card { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gc-space-2) var(--gc-space-4); min-width: 0; margin-top: var(--gc-space-1); padding: var(--gc-space-3); border: var(--gc-rule); background: var(--gc-color-surface-soft); overflow-wrap: anywhere; }
.cardLabel { display: block; width: 100%; font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); color: var(--gc-color-text-secondary); }
.cardNumber { font: 700 1.375rem / 1.2 var(--gc-type-pixel); }
.card a, .table a { min-height: var(--gc-target-minimum); display: inline-flex; align-items: center; }
.note { margin-top: var(--gc-space-2); color: var(--gc-color-text-secondary); font-size: 0.8125rem; min-width: 0; overflow-wrap: anywhere; }

.derived { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: var(--gc-space-3); min-width: 0; }
.derived div { min-width: 0; }
.derived dt { color: var(--gc-color-text-secondary); font-size: 0.8125rem; }
.derived dd { font-size: 1.25rem; line-height: 1.3; overflow-wrap: anywhere; }

.tableWrap { width: 100%; max-width: 100%; min-width: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
.table th, .table td { text-align: left; padding: var(--gc-space-2) var(--gc-space-3); border-bottom: var(--gc-rule); font-weight: 400; }
.table th[scope="col"] { color: var(--gc-color-text-secondary); font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); }
.table .number { font-family: var(--gc-type-mono); text-align: right; }
.originalLabel { min-width: 0; overflow-wrap: anywhere; }
.visuallyHidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
```

Run: `pnpm --dir apps/web exec vitest run tests/measurement-history.test.tsx tests/history-layout.test.ts` — Expected: PASS.

- [ ] **Step 5: 내 기록 — failing tests, then implement**

In `apps/web/tests/integrated-records-grouping.test.tsx` add:

```tsx
it("has no KPI panel, no server-speak, one bottom caption, and groups the tests can find by id", async () => {
  const { container } = render(<IntegratedRecords />);
  await screen.findByRole("heading", { name: "현재 기록 3개" });
  expect(screen.queryByLabelText("서버 기록 상태")).toBeNull();
  expect(container.textContent).not.toMatch(/서버 응답만 표시해요|예시 데이터 전용|후보|합성|→/);
  expect(screen.getAllByTestId("record-group")).toHaveLength(2);
  const captions = container.querySelectorAll(".gc-caption");
  expect(captions).toHaveLength(1);
  expect(captions[0]).toHaveTextContent("값의 의미나 건강 상태는 판단하지 않아요.");
  expect(screen.getByRole("heading", { level: 1, name: "내 기록" })).toBeVisible();
});

it("offers 결과지 추가 as the empty state's action", async () => {
  server.use(http.get("/api/foundation/records", () => HttpResponse.json([])));
  render(<IntegratedRecords />);
  expect(await screen.findByRole("heading", { name: "아직 확인한 기록이 없어요" })).toBeVisible();
  expect(screen.getByRole("link", { name: "결과지 추가" })).toHaveAttribute("href", "/import/source");
});
```

and in "names the record state in Korean…" add `expect(screen.getAllByText("원문 확인값").length).toBeGreaterThan(0); expect(screen.queryByText("후보 근거값")).toBeNull();`.

Run: `pnpm --dir apps/web exec vitest run tests/integrated-records-grouping.test.tsx` — Expected: FAIL (KPI aside present, `record-group` missing).

Create `apps/web/components/integrated/Records.module.css`:

```css
.page { min-height: 100vh; color: var(--gc-color-text-primary); }
.shell { width: min(100% - 2rem, 70rem); margin-inline: auto; padding: var(--gc-space-6) 0 var(--gc-space-10); min-width: 0; }
.hero { display: grid; gap: var(--gc-space-2); margin-bottom: var(--gc-space-6); min-width: 0; }
.hero h1 { font: 400 var(--gc-type-display) / 1.2 var(--gc-type-serif); }
.hero p { color: var(--gc-color-text-secondary); }
.sectionHeading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--gc-space-2); margin: var(--gc-space-6) 0 var(--gc-space-3); }
.sectionHeading h2 { font: 400 var(--gc-type-title) / 1.3 var(--gc-type-serif); }
.group { margin-top: var(--gc-space-4); border: var(--gc-rule); background: var(--gc-color-surface-raised); padding: var(--gc-space-3) var(--gc-space-4); min-width: 0; }
.group h3 { padding-bottom: var(--gc-space-2); border-bottom: var(--gc-rule); color: var(--gc-color-text-secondary); font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); font-weight: 400; }
.group ol { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--gc-space-3); }
.record { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--gc-space-2) var(--gc-space-4); padding: var(--gc-space-3) 0; border-bottom: var(--gc-rule); min-width: 0; }
.record:focus-visible { outline: 3px solid var(--gc-color-focus-ring); outline-offset: 2px; }
.recordDate { display: grid; gap: 2px; font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); color: var(--gc-color-text-secondary); }
.recordValue { display: flex; align-items: baseline; gap: var(--gc-space-1); }
.recordValue strong { font: 400 1.5rem / 1.1 var(--gc-type-pixel); }
.recordValue span { color: var(--gc-color-text-secondary); font-family: var(--gc-type-mono); }
.recordSource { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--gc-space-1) var(--gc-space-3); color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.recordSource strong { color: var(--gc-color-text-primary); font-weight: 600; }
.recordOriginal { min-width: 0; overflow-wrap: anywhere; }
.record details { grid-column: 1 / -1; }
.record summary { cursor: pointer; min-height: var(--gc-target-minimum); display: list-item; align-content: center; }
.comparison { margin-top: var(--gc-space-4); padding: var(--gc-space-4); border: var(--gc-rule); background: var(--gc-color-surface-raised); min-width: 0; }
.comparison h2 { font: 400 var(--gc-type-title) / 1.3 var(--gc-type-serif); }
.comparisonNote { margin-top: var(--gc-space-2); color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.comparisonList { display: grid; gap: var(--gc-space-2); margin: var(--gc-space-3) 0 0; padding: 0; list-style: none; }
.comparisonList li { padding: var(--gc-space-2) 0; border-bottom: var(--gc-rule); font-variant-numeric: tabular-nums; line-height: 1.6; }
.correction { display: grid; gap: var(--gc-space-2); margin-top: var(--gc-space-3); max-width: 32rem; }
@media (max-width: 42rem) {
  .record { grid-template-columns: minmax(0, 1fr); }
}
```

`apps/web/components/integrated/IntegratedRecords.tsx`: replace `import styles from "@/components/records/HealthTimeline.module.css";` with `import styles from "@/components/integrated/Records.module.css";`, import `EmptyState` and `SCREEN_TITLES`; status `"예시 데이터"`; `<main className={`${styles.page} gc-grid-ground`}>`; the hero becomes:

```tsx
          <section className={styles.hero} aria-labelledby="integrated-records-title">
            <span className="gc-panel__eyebrow">직접 확인한 값과 출처</span>
            <h1 id="integrated-records-title">{SCREEN_TITLES.records}</h1>
            <p>날짜별로 모은 값과 출처를 살펴보세요. 직접 수정한 값은 원래 값과 함께 확인할 수 있어요.</p>
          </section>
```

(the `<aside className={styles.truthPanel} …>` is deleted); loading text `기록을 불러오고 있어요.` with `className="gc-meta"`; error `className="gc-error"` with the retry button `className="gc-button gc-button--text"`; the empty branch becomes `<EmptyState title="아직 확인한 기록이 없어요" body="결과지를 추가하고 값을 확인하면 날짜별로 여기에 모여요." />`; the history section header becomes `<header className={styles.sectionHeading}><div><span className="gc-panel__eyebrow">출처와 버전</span><h2 id="durable-history-title">현재 기록 {records.length}개</h2></div></header>`; each group `<section key={group.key} className={styles.group} data-testid="record-group" aria-labelledby={…}>`; each `<li … className={styles.record}>` with `styles.recordDate`, `styles.recordValue`, `styles.recordSource`, `styles.recordOriginal` replacing `historyDate`, `historyValue`, `historySource`, `historyOriginal`, and the `<span>예시 데이터</span>` removed; `<dt>후보 근거값</dt>` → `<dt>원문 확인값</dt>`; the correction form gets `className={`gc-field ${styles.correction}`}` and its buttons `gc-button gc-button--secondary` / `gc-button gc-button--primary`; "이 기록 수정" button `gc-button gc-button--text`; the trailing boundary `<section className={styles.boundary} …>` is replaced by `<p className="gc-caption">값의 의미나 건강 상태는 판단하지 않아요.</p>` as the last child of `<main>` (outside `.shell`).

`apps/web/components/integrated/RecordComparison.tsx`: import `styles from "@/components/integrated/Records.module.css"`; `className="gc-records-comparison"` → `className={styles.comparison}`, `gc-records-comparison__note` → `styles.comparisonNote`, `gc-records-comparison__list` → `styles.comparisonList`; `<p>예시 데이터 · 직접 확인한 두 날짜의 값</p>` → `<p className="gc-meta">직접 확인한 두 날짜의 값</p>`; the empty `<p className="gc-integrated-empty">` → `<p className="gc-empty">`.

Create `apps/web/components/integrated/RecentChanges.module.css`:

```css
.section { margin-top: var(--gc-space-4); padding-top: var(--gc-space-3); border-top: var(--gc-rule); min-width: 0; }
.heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--gc-space-2); }
.heading h2 { font: 400 1rem / 1.3 var(--gc-type-serif); }
.note { margin-top: var(--gc-space-2); color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.list { display: grid; gap: var(--gc-space-2); margin: var(--gc-space-3) 0 0; padding: 0; list-style: none; }
.list li { padding: var(--gc-space-2) 0; border-bottom: var(--gc-rule); font-size: 0.875rem; line-height: 1.5; }
```

`RecentChanges.tsx`: import that module; `gc-health-home__overview` → `styles.section`, `gc-health-home__section-heading` → `styles.heading`, `gc-records-comparison__note` → `styles.note`, `gc-review-saved` → `styles.list`; the two eyebrow/count texts get `className="gc-meta"`. `tests/recent-changes.test.tsx` needs no change (text-only assertions).

Run: `pnpm --dir apps/web exec vitest run tests/integrated-records-grouping.test.tsx tests/record-comparison.test.tsx tests/recent-changes.test.tsx` — Expected: PASS.

- [ ] **Step 6: 데이터 관리 — failing tests, then implement**

In `apps/web/tests/integrated-data-control.test.tsx` add:

```tsx
it("puts the real consent controls first, the demo screens last, and the system explanations under 자세히", async () => {
  const { container } = render(<IntegratedDataControl />);
  await screen.findByRole("heading", { name: "서비스 제공(결과지 처리)" });
  expect(screen.getByRole("heading", { level: 1, name: "데이터 관리" })).toBeVisible();
  const consentHeading = screen.getByRole("heading", { name: "목적별 동의" });
  const demoLinks = screen.getByRole("navigation", { name: "예시 화면" });
  expect(consentHeading.compareDocumentPosition(demoLinks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(demoLinks).getByRole("link", { name: "연결 상태 예시" })).toHaveAttribute("href", "/connections");
  expect(within(demoLinks).getByRole("link", { name: "공공정보 예시" })).toHaveAttribute("href", "/providers");
  // No KPI theatre: no big numeral, no "활성".
  expect(screen.queryByLabelText("현재 서버 데이터 상태")).toBeNull();
  expect(screen.queryByText("활성")).toBeNull();
  const notes = screen.getByTestId("system-notes");
  expect(notes.tagName).toBe("DETAILS");
  expect(within(notes).getByText("자세히")).toBeVisible();
  for (const sentence of [
    "외부 연결 0곳: 카카오·네이버·MyHealthWay는 연결하지 않아요.",
    "OCR·의료 AI를 쓰지 않아요. 결과지의 글자 정보만 읽어요.",
    "결과지는 승인 전까지 격리된 구역에서만 처리해요.",
    "화면에는 서버가 저장한 것만 표시해요.",
    "감사 기록에는 건강 수치를 남기지 않아요.",
  ]) expect(within(notes).getByText(sentence)).toBeInTheDocument();
  // Outside 자세히 no system-speak survives.
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("details").forEach((node) => node.remove());
  expect(clone.textContent).not.toMatch(/OCR|MyHealthWay|격리|비활성화|외부 연결|합성|후보/);
  expect(await axe(container)).toHaveNoViolations();
});
```

(add `import { axe } from "jest-axe";` to that file). Also, in "offers the export link…", add `expect(link).toHaveAttribute("href", HEALTH_EVENTS_EXPORT_PATH);` with `import { HEALTH_EVENTS_EXPORT_PATH, HEALTH_EVENTS_FHIR_EXPORT_PATH } from "@/lib/foundation/client";` and the FHIR equivalent in "offers a second export link…".

Run: `pnpm --dir apps/web exec vitest run tests/integrated-data-control.test.tsx` — Expected: FAIL.

Create `apps/web/components/integrated/DataControl.module.css`:

```css
.page { min-height: 100vh; color: var(--gc-color-text-primary); }
.shell { width: min(100% - 2rem, 64rem); margin-inline: auto; padding: var(--gc-space-6) 0 var(--gc-space-10); display: grid; gap: var(--gc-space-6); min-width: 0; }
.hero { display: grid; gap: var(--gc-space-2); min-width: 0; }
.hero h1 { font: 400 var(--gc-type-display) / 1.2 var(--gc-type-serif); }
.hero p { color: var(--gc-color-text-secondary); }
.section { border: var(--gc-rule); background: var(--gc-color-surface-raised); padding: var(--gc-space-4); min-width: 0; }
.section h2 { font: 400 var(--gc-type-title) / 1.3 var(--gc-type-serif); }
.section > header p { margin-top: var(--gc-space-2); color: var(--gc-color-text-secondary); }
.purposes { display: grid; gap: var(--gc-space-3); margin-top: var(--gc-space-4); }
.purpose { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--gc-space-3); padding: var(--gc-space-3) 0; border-top: var(--gc-rule); min-width: 0; }
.purpose h3 { font-size: 1rem; font-weight: 600; }
.purpose h3 + strong { display: block; margin-top: 2px; font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); font-weight: 400; color: var(--gc-color-text-secondary); }
.purpose p { margin-top: var(--gc-space-2); color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.purpose dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px var(--gc-space-3); margin-top: var(--gc-space-2); font-size: 0.875rem; }
.purpose dl div { display: contents; }
.purpose dt { color: var(--gc-color-text-secondary); }
.purpose button { align-self: start; }
.lock { grid-column: 1 / -1; color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.projects { display: grid; gap: var(--gc-space-2); margin: var(--gc-space-2) 0 0; padding: 0; list-style: none; }
.projects li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gc-space-2); }
.notes { margin-top: var(--gc-space-2); }
.notes ul { margin: var(--gc-space-2) 0 0; padding-left: 1.2em; color: var(--gc-color-text-secondary); font-size: 0.875rem; display: grid; gap: var(--gc-space-1); }
.demo { display: flex; flex-wrap: wrap; gap: var(--gc-space-3); }
.demo a { min-height: var(--gc-target-minimum); display: inline-flex; align-items: center; color: var(--gc-color-text-secondary); }
@media (max-width: 42rem) {
  .purpose { grid-template-columns: minmax(0, 1fr); }
}
```

Rewrite the JSX of `apps/web/components/integrated/IntegratedDataControl.tsx` (the hooks, `consentRows` sentences other than the first `description`, and every handler stay exactly as they are):

```tsx
  return (
    <IntegratedShell current="data-control" status="예시 데이터">
      <main className={`${styles.page} gc-grid-ground`}>
        <div className={styles.shell}>
          <section className={styles.hero} aria-labelledby="integrated-data-title">
            <span className="gc-panel__eyebrow">동의와 보관 상태</span>
            <h1 id="integrated-data-title">{SCREEN_TITLES.dataControl}</h1>
            <p>목적별 동의를 확인하고, 내 기록을 파일로 내보내거나, 확인한 기록을 삭제할 수 있어요.</p>
          </section>

          {loading && <p className="gc-meta" role="status">서버에서 동의 상태를 확인하고 있어요.</p>}
          {actionMessage && <p className="gc-meta" role="status" aria-live="polite">{actionMessage}</p>}
          {errorMessage && <p className="gc-error" role="alert">{errorMessage} {!session && <a href="/">홈에서 다시 로그인</a>}</p>}

          {!loading && session && (
            <>
              <section className={styles.section} aria-labelledby="server-consent-title">
                <header>
                  <span className="gc-panel__eyebrow">현재 동의 상태</span>
                  <h2 id="server-consent-title">목적별 동의</h2>
                  <p>연구 동의 없이도 모든 기능을 쓸 수 있어요. 연구 동의는 저장만 되고, 실제 활용 전에는 프로젝트별 동의를 다시 물어요.</p>
                </header>
                <div className={styles.purposes}>
                  {consentRows.map((row) => {
                    const consent = consentFor(row.purposeCode);
                    const status = consent?.status ?? "NOT_GRANTED";
                    return (
                      <article key={row.purposeCode} className={styles.purpose} data-purpose={row.purposeCode} data-status={status === "ACTIVE" ? "active" : "revoked"}>
                        <div>
                          <h3>{row.title}</h3>
                          <strong>{labelConsentStatus(status)}</strong>
                          <p>{row.description}</p>
                          <dl><div><dt>사용 목적</dt><dd>{row.purpose}</dd></div><div><dt>실제 외부 제공</dt><dd>없음</dd></div></dl>
                        </div>
                        {status === "ACTIVE" && consent?.consentId
                          ? <button className="gc-button gc-button--secondary" type="button" onClick={() => void revokeConsent(consent.consentId!, row.short, row.purposeCode)} disabled={busy}>{busyPurpose === row.purposeCode ? "철회 반영 중" : `${row.short} 동의 철회`}</button>
                          : <button className="gc-button gc-button--primary" type="button" onClick={() => void grantConsent(row.purposeCode, row.short)} disabled={busy}>{busyPurpose === row.purposeCode ? "동의 반영 중" : `${row.short} 동의`}</button>}
                      </article>
                    );
                  })}
                  <article className={styles.purpose} data-purpose="PROJECT" data-status={projectConsents.some((item) => item.status === "ACTIVE") ? "active" : "revoked"}>
                    <div>
                      <h3>프로젝트별</h3>
                      <strong>{projectConsents.length === 0 ? "아직 없음" : `${projectConsents.filter((item) => item.status === "ACTIVE").length}개 동의함`}</strong>
                      <p>프로젝트가 생기면 여기서 개별로 물어요.</p>
                      {projectConsents.length > 0 && (
                        <ul className={styles.projects} aria-label="프로젝트별 동의">
                          {projectConsents.map((item) => {
                            const name = item.purposeCode.slice(projectPrefix.length);
                            return (
                              <li key={item.purposeCode}>
                                <strong>{name}</strong>
                                <span>{labelConsentStatus(item.status)}</span>
                                {item.status === "ACTIVE" && item.consentId && (
                                  <button type="button" className="gc-button gc-button--secondary gc-data-control__project-revoke" onClick={() => void revokeConsent(item.consentId!, name, item.purposeCode)} disabled={busy}>
                                    {busyPurpose === item.purposeCode ? "철회 반영 중" : `${name} 동의 철회`}
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <span className={styles.lock}>지금은 물어볼 프로젝트가 없어요</span>
                  </article>
                </div>
              </section>

              <section className={styles.section} aria-labelledby="server-export-title">
                <span className="gc-panel__eyebrow">내 기록</span>
                <h2 id="server-export-title">내 기록 내보내기</h2>
                <p>브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요.</p>
                <div className="gc-actions">
                  {events.length > 0
                    ? <a className="gc-button gc-button--secondary" href={HEALTH_EVENTS_EXPORT_PATH} download>내 기록 내보내기(JSON)</a>
                    : <button className="gc-button gc-button--secondary" type="button" disabled>내 기록 내보내기(JSON)</button>}
                  {events.length > 0
                    ? <a className="gc-button gc-button--secondary" href={HEALTH_EVENTS_FHIR_EXPORT_PATH} download>내 기록 내보내기(FHIR)</a>
                    : <button className="gc-button gc-button--secondary" type="button" disabled>내 기록 내보내기(FHIR)</button>}
                </div>
                <p>다른 건강기록 도구가 읽을 수 있는 형식이에요.</p>
                {events.length === 0 && <p className="gc-empty">내보낼 기록이 없어요</p>}
              </section>

              <section className={styles.section} aria-labelledby="server-delete-title">
                <span className="gc-panel__eyebrow">확인한 기록</span>
                <h2 id="server-delete-title">계정과 데이터 모두 삭제</h2>
                <p>결과지와 확인한 기록을 삭제하고 이 로그인을 끝내요.</p>
                <div className="gc-actions"><button className="gc-button gc-button--secondary" type="button" onClick={() => setReviewingDeletion(true)} disabled={busy}>삭제 요청 검토</button></div>
              </section>

              {reviewingDeletion && (
                <section className={styles.section} aria-labelledby="delete-confirm-title">
                  <span className="gc-panel__eyebrow">삭제 확인</span>
                  <h2 id="delete-confirm-title">기록과 동의를 모두 삭제할까요?</h2>
                  <p>결과지, 확인한 기록, 동의가 삭제되고 이 브라우저의 로그인도 끝나요.</p>
                  <label><input type="checkbox" checked={confirmedDeletion} onChange={(event) => setConfirmedDeletion(event.target.checked)} /> 위 내용을 확인했습니다</label>
                  <div className="gc-actions"><button className="gc-button gc-button--secondary" type="button" onClick={() => { setReviewingDeletion(false); setConfirmedDeletion(false); }}>취소</button><button className="gc-button gc-button--primary" type="button" onClick={() => void deleteProfile()} disabled={!confirmedDeletion || busy}>{busy ? "삭제 상태 확인 중" : "서버에 삭제 요청"}</button></div>
                </section>
              )}

              <details className={`gc-details ${styles.notes}`} data-testid="system-notes">
                <summary>자세히</summary>
                <ul>
                  <li>외부 연결 0곳: 카카오·네이버·MyHealthWay는 연결하지 않아요.</li>
                  <li>OCR·의료 AI를 쓰지 않아요. 결과지의 글자 정보만 읽어요.</li>
                  <li>결과지는 승인 전까지 격리된 구역에서만 처리해요.</li>
                  <li>화면에는 서버가 저장한 것만 표시해요.</li>
                  <li>감사 기록에는 건강 수치를 남기지 않아요.</li>
                </ul>
              </details>

              <nav className={styles.demo} aria-label="예시 화면">
                <a href="/connections">연결 상태 예시</a>
                <a href="/providers">공공정보 예시</a>
              </nav>
            </>
          )}

          {deletion?.status === "COMPLETED" && (
            <section className={styles.section} aria-labelledby="delete-complete-title">
              <span className="gc-panel__eyebrow">서버 완료 상태</span>
              <h2 id="delete-complete-title">삭제가 완료됐어요</h2>
              <p role="status">기록이 삭제됐고 이 브라우저의 로그인도 끝났어요.</p>
              <dl className="gc-facts"><div><dt>삭제 ID</dt><dd><code>{deletion.deletionId}</code></dd></div><div><dt>감사에 건강 수치</dt><dd>{deletion.rawHealthValuesPresentInAudit ? "발견됨 · 중단 필요" : "없음"}</dd></div></dl>
              <div className="gc-actions"><a className="gc-button gc-button--primary" href="/">홈으로 돌아가기</a></div>
            </section>
          )}
        </div>
        <p className="gc-caption">동의와 삭제는 서버에 바로 반영돼요. 값의 의미나 건강 상태는 판단하지 않아요.</p>
      </main>
    </IntegratedShell>
  );
```

with the imports `import styles from "@/components/integrated/DataControl.module.css";`, `import { SCREEN_TITLES } from "@/lib/copy/terminology";` and `HEALTH_EVENTS_EXPORT_PATH, HEALTH_EVENTS_FHIR_EXPORT_PATH` added to the `@/lib/foundation/client` import; the first `consentRows[0].description` becomes `"결과지를 읽어 확인할 항목을 만드는 데 써요. 철회하면 새 결과지를 처리하지 않아요."`. (`gc-data-control__project-revoke` stays as a marker class for the existing test; it has no CSS.)

Run: `pnpm --dir apps/web exec vitest run tests/integrated-data-control.test.tsx` — Expected: PASS.

- [ ] **Step 7: 진료 준비**

In `apps/web/tests/visit-preparation.test.tsx`: `"예시 데이터 · 2026. 7. 28."` → `"검사일 2026. 7. 28."`; add to the first test `expect(screen.getByTestId("patch")).toHaveTextContent("진료 준비"); expect(screen.getByTestId("patch")).toHaveTextContent("기록 / 2"); expect(screen.getByText("값보다 먼저.")).toBeVisible();`.

Create `apps/web/components/integrated/Prepare.module.css`:

```css
.page { box-sizing: border-box; max-width: 48rem; min-height: 100vh; margin: 0 auto; padding: var(--gc-space-6) var(--gc-space-4) var(--gc-space-10); color: var(--gc-color-text-primary); }
.heading { display: grid; gap: var(--gc-space-2); margin-top: var(--gc-space-4); }
.heading h1 { font: 400 var(--gc-type-display) / 1.2 var(--gc-type-serif); }
.note { color: var(--gc-color-text-secondary); font-size: 0.9375rem; }
.list { list-style: none; margin: var(--gc-space-4) 0 0; padding: 0; display: grid; gap: var(--gc-space-3); }
.list article { border: var(--gc-rule); background: var(--gc-color-surface-raised); padding: var(--gc-space-4); min-width: 0; }
.list h2 { font: 400 var(--gc-type-title) / 1.3 var(--gc-type-serif); margin-top: var(--gc-space-1); }
.list article > p { margin-top: var(--gc-space-2); color: var(--gc-color-text-secondary); }
.sources { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gc-space-3); margin-top: var(--gc-space-3); }
.sources > :only-child { grid-column: 1 / -1; }
.source { padding-top: var(--gc-space-3); border-top: var(--gc-rule); min-width: 0; }
.value { display: flex; align-items: baseline; gap: var(--gc-space-1); margin-top: var(--gc-space-1); }
.value strong { font: 400 1.5rem / 1.1 var(--gc-type-pixel); }
.value span { color: var(--gc-color-text-secondary); font-family: var(--gc-type-mono); }
.source a { min-height: var(--gc-target-minimum); display: inline-flex; align-items: center; }
@media (max-width: 42rem) { .sources { grid-template-columns: minmax(0, 1fr); } }
@media print {
  .page { max-width: none; min-height: 0; padding: 0; color: #000; background: #fff; }
  .list article { break-inside: avoid; border-color: #000; background: #fff; }
}
```

`apps/web/components/integrated/VisitPreparation.tsx`: import `styles` from that module, `Patch`/`PATCH_SLOGAN`, `EmptyState`, `SCREEN_TITLES`; `<main className={styles.page}>`; before the `<header>` insert `<Patch variant="card" meta={[SCREEN_TITLES.prepare, `기록 / ${records.length}`, `질문 / ${questions.length}`]} slogan={PATCH_SLOGAN} />`; header → `className={styles.heading}` with `<span className="gc-panel__eyebrow">{SCREEN_TITLES.prepare}</span>` replacing `<p>진료 전 준비</p>` and both notes `className={styles.note}`; loading `className="gc-meta"`; the error `div` → `className="gc-error"` with the retry button `gc-button gc-button--text` and the actions wrapper `className="gc-actions"`; the empty section → `<EmptyState title="아직 확인한 기록이 없어요" body="결과지를 추가하고 항목을 직접 확인하면 여기에 질문 목록이 만들어져요." meta={[SCREEN_TITLES.prepare, "기록 / 0"]} />` (keep the sentence `아직 확인한 기록이 없어요` — the test asserts it); the actions `<div className="gc-actions">` with the print button `gc-button gc-button--primary` and the link `<a className="gc-button gc-button--text" href="/records">내 기록으로</a>`; `<ol className={styles.list}>`; per question `<span className="gc-panel__eyebrow">질문 {index + 1}</span>`, `styles.sources`, `styles.source`, `<p className="gc-meta">검사일 {formatKoreanDate(record.observedOn)}</p>`, `styles.value`, `<details className="gc-details">`. The `IntegratedVisitPreparation` status becomes `"예시 데이터"`. Add `<p className="gc-caption">{preparationNote}</p>` as the last child of `<main>` and remove the first `styles.note` paragraph from the header (the sentence stays once, in the caption; `exampleValueNote` stays in the header).

`tests/visit-preparation.test.tsx` asserts `preparationNote` by `getByText` — still found once (caption). The e2e asserts the same sentence visible — still true.

Run: `pnpm --dir apps/web exec vitest run tests/visit-preparation.test.tsx tests/preparation-context.test.ts` — Expected: PASS.

- [ ] **Step 8: Copy scan for this task and the lifecycle**

`apps/web/tests/korean-ux-copy.test.ts`: add `"components/ui/EmptyState.tsx"` to `userFacingFiles`; in "explains the export as a browser download…" replace the two `href="/api/foundation/health-events/export…"` assertions with `expect(control).toContain("href={HEALTH_EVENTS_EXPORT_PATH}")` and `expect(control).toContain("href={HEALTH_EVENTS_FHIR_EXPORT_PATH}")`; add to `forbiddenUserTerms`: `"합성 프로필"`, `"합성 결과지"`, `"서버 응답만 표시해요"`.

`apps/web/e2e/foundation-lifecycle.spec.ts`:
- `page.locator(".gc-records-group")` (three places) → `page.getByTestId("record-group")`; `page.locator(".gc-records-group h3")` → `page.getByTestId("record-group").getByRole("heading", { level: 3 })`.
- `page.getByRole("searchbox", { name: "내 데이터에서 항목 찾기" })` (two places) → `{ name: "항목 찾기" }`.
- The `/my-data` table assertion runs at 390px, where the table is hidden: replace `await expect(page.getByRole("table", { name: "기록 목록" }).getByRole("row")).toHaveCount(5 + 1);` with `await expect(page.getByRole("list", { name: "기록 목록" }).getByRole("listitem")).toHaveCount(5);` and, in `captureMatrix` under `if (state === "my-data")`, add:

```ts
      if (width <= 672) {
        await expect(page.getByRole("list", { name: "기록 목록" })).toBeVisible();
        await expect(page.getByRole("table", { name: "기록 목록" })).toBeHidden();
      } else {
        await expect(page.getByRole("table", { name: "기록 목록" })).toBeVisible();
        await expect(page.getByRole("list", { name: "기록 목록" })).toBeHidden();
      }
      const cell = page.getByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" }).locator("rect[data-cell]").first();
      const cellBox = await cell.boundingBox();
      expect(cellBox!.width, `${state} ${width}: cell width`).toBeGreaterThanOrEqual(14);
```

- On `/data-control`: after `await expect(page.getByRole("heading", { name: "서비스 제공(결과지 처리)" })).toBeVisible();` add:

```ts
  await expect(page.getByRole("heading", { level: 1, name: "데이터 관리" })).toBeVisible();
  await expect(page.getByText("적대적")).toHaveCount(0);
  await page.getByText("자세히", { exact: true }).click();
  await expect(page.getByText("외부 연결 0곳: 카카오·네이버·MyHealthWay는 연결하지 않아요.")).toBeVisible();
```

- The deletion end: `await expect(page.getByRole("heading", { name: "삭제가 완료됐어요" })).toBeVisible();` stays; `await expect(page.getByText("없음", { exact: true })).toBeVisible();` stays.

```bash
pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm --dir apps/web build
pnpm foundation:e2e
git checkout -- apps/web/next-env.d.ts
git add apps/web/components apps/web/lib/foundation/client.ts apps/web/tests apps/web/e2e/foundation-lifecycle.spec.ts
git commit -m "feat(web): 나의 데이터·측정 이력·내 기록·데이터 관리·진료 준비 on the dark token system; export URLs as client constants

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Expected: vitest green; lifecycle `3 passed` (the `studio-design-contract` test still passes because `HealthTimeline.module.css` and the providers module are untouched until Task 5).

---
### Task 5: Cleanup — dead components and stories, Tailwind out, `globals.css` folded into tokens/modules, one breakpoint scale, unreferenced-CSS report

**Files:**
- Delete: `apps/web/components/concept/HealthHomeConcept.tsx`, `apps/web/components/concept/RecordImportConcept.tsx`, `apps/web/components/experience/HealthExperience.tsx`, `apps/web/components/records/EvidenceLens.tsx`, `apps/web/components/records/HealthTimeline.tsx`, `apps/web/components/records/HealthTimeline.module.css`, `apps/web/components/privacy/DataControlCenter.tsx`, `apps/web/components/integrated/PrepareConceptNotice.tsx`, `apps/web/components/evidence/{EvidenceCard,SourceStrip,StatusLabel,UnitGrid}.tsx`, `apps/web/lib/records/demo-health-timeline.ts`, `apps/web/lib/imports/local-document.ts`, `apps/web/lib/consent/demo-consent.ts`, `apps/web/stories/{EvidenceCard,EvidenceLens,HealthExperience,HealthHomeConcept,HealthTimeline,RecordImportConcept}.stories.tsx`, `apps/web/tests/{health-experience,evidence-lens,health-timeline,health-home-concept,record-import-concept,data-control-center,evidence-components}.test.tsx`, `apps/web/tests/local-document.test.ts`, `apps/web/tests/fixtures/public.ts`, `apps/web/tests/studio-design-contract.test.ts`, `apps/web/e2e/korean-experience.spec.ts`, `apps/web/app/globals.css`, `apps/web/postcss.config.mjs`
- Create: `apps/web/components/integrated/Review.module.css`, `apps/web/components/connections/connections.css`, `apps/web/scripts/css-coverage.mts`, `apps/web/tests/css-coverage.test.ts`
- Modify: `apps/web/package.json` (remove `tailwindcss`, `@tailwindcss/postcss`), `apps/web/app/layout.tsx` (drop the `globals.css` import), `apps/web/.storybook/preview.ts`, `apps/web/components/integrated/CandidateReview.tsx`, `apps/web/components/connections/ConnectionExperience.tsx` (import the css), `apps/web/components/providers/PublicProviderExplorer.module.css` (colours → tokens), `apps/web/tests/design-system-contract.test.ts`, `apps/web/tests/generated-token-consumption.test.ts`, `apps/web/tests/korean-ux-copy.test.ts` (file list), `apps/web/tests/unified-product.test.tsx`

**Interfaces:**
- Consumes: everything Tasks 1–4 produced.
- Produces: `apps/web/scripts/css-coverage.mts` exporting `collectUnreferencedClasses(): Array<{ file: string; className: string }>` (and printing them when run as a script); `Review.module.css` classes `page, bar, shell, review, heading, lead, state, candidate, candidateLabel, candidateOriginal, value, source, evidence, preview, decisionBar, correction`; after this task no `.gc-*` class exists outside `styles/system.css`, no `globals.css`, no Tailwind, and every media query is on the one scale.

- [ ] **Step 1: The unreferenced-CSS report (script + test) — red first**

Create `apps/web/scripts/css-coverage.mts`:

```ts
/**
 * Lists CSS classes that no TS/TSX file references. Global classes (styles/*.css, connections.css)
 * count as used when the exact class name appears outside a word; module classes when
 * `<ident>.name` or `["name"]` appears. Run: `node scripts/css-coverage.mts` (prints JSON).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(import.meta.dirname, "..");
const skipDirs = new Set(["node_modules", ".next", "test-results", "storybook-static", "public", "fonts"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function collectUnreferencedClasses(): Array<{ file: string; className: string }> {
  const files = walk(webRoot);
  const cssFiles = files.filter((file) => file.endsWith(".css"));
  const code = files.filter((file) => /\.(tsx?|mts)$/.test(file) && !file.endsWith("css-coverage.mts")).map((file) => readFileSync(file, "utf8")).join("\n");
  const allCss = cssFiles.map((file) => readFileSync(file, "utf8")).join("\n");
  const report: Array<{ file: string; className: string }> = [];
  for (const file of cssFiles) {
    const css = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/url\([^)]*\)/g, "url()")
      .replace(/"[^"]*"|'[^']*'/g, '""');
    const isModule = file.endsWith(".module.css");
    const classes = new Set(Array.from(css.matchAll(/\.([A-Za-z_][\w-]*)/g), (match) => match[1]));
    for (const className of classes) {
      const escaped = escape(className);
      const used = isModule
        ? new RegExp(`[A-Za-z_$][\\w$]*\\.${escaped}(?![\\w-])|\\[["']${escaped}["']\\]`).test(code)
        : new RegExp(`(^|[^\\w-])${escaped}(?![\\w-])`).test(code) || new RegExp(`:global\\(\\.${escaped}\\)`).test(allCss);
      if (!used) report.push({ file: relative(webRoot, file).split(sep).join("/"), className });
    }
  }
  return report.sort((a, b) => a.file.localeCompare(b.file) || a.className.localeCompare(b.className));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = collectUnreferencedClasses();
  console.log(JSON.stringify({ unreferenced: report.length, classes: report }, null, 2));
}
```

Create `apps/web/tests/css-coverage.test.ts`:

```ts
import { expect, it } from "vitest";
import { collectUnreferencedClasses } from "../scripts/css-coverage.mts";

it("keeps every CSS class referenced by a component (unreferenced list is empty)", () => {
  expect(collectUnreferencedClasses()).toEqual([]);
});
```

Record the "before" list for the evidence, then run the test to see it fail:

```bash
node apps/web/scripts/css-coverage.mts > docs/status/2026-09-18/css-coverage-before.json
node -e "const r=require('./docs/status/2026-09-18/css-coverage-before.json');console.log(r.unreferenced)"
pnpm --dir apps/web exec vitest run tests/css-coverage.test.ts
```
Expected: a count in the hundreds (the concept/import/evidence-lens/data-control/studio families); the test FAILS.

- [ ] **Step 2: Delete the dead components, their stories, tests and libs; retire the stale specs**

```bash
git rm -q apps/web/components/concept/HealthHomeConcept.tsx apps/web/components/concept/RecordImportConcept.tsx \
  apps/web/components/experience/HealthExperience.tsx apps/web/components/records/EvidenceLens.tsx \
  apps/web/components/records/HealthTimeline.tsx apps/web/components/records/HealthTimeline.module.css \
  apps/web/components/privacy/DataControlCenter.tsx apps/web/components/integrated/PrepareConceptNotice.tsx \
  apps/web/components/evidence/EvidenceCard.tsx apps/web/components/evidence/SourceStrip.tsx \
  apps/web/components/evidence/StatusLabel.tsx apps/web/components/evidence/UnitGrid.tsx \
  apps/web/lib/records/demo-health-timeline.ts apps/web/lib/imports/local-document.ts apps/web/lib/consent/demo-consent.ts \
  apps/web/stories/EvidenceCard.stories.tsx apps/web/stories/EvidenceLens.stories.tsx apps/web/stories/HealthExperience.stories.tsx \
  apps/web/stories/HealthHomeConcept.stories.tsx apps/web/stories/HealthTimeline.stories.tsx apps/web/stories/RecordImportConcept.stories.tsx \
  apps/web/tests/health-experience.test.tsx apps/web/tests/evidence-lens.test.tsx apps/web/tests/health-timeline.test.tsx \
  apps/web/tests/health-home-concept.test.tsx apps/web/tests/record-import-concept.test.tsx apps/web/tests/data-control-center.test.tsx \
  apps/web/tests/evidence-components.test.tsx apps/web/tests/local-document.test.ts apps/web/tests/fixtures/public.ts \
  apps/web/tests/studio-design-contract.test.ts apps/web/e2e/korean-experience.spec.ts
git grep -n -E 'concept/|experience/HealthExperience|records/EvidenceLens|records/HealthTimeline|privacy/DataControlCenter|PrepareConceptNotice|components/evidence/|demo-health-timeline|imports/local-document|consent/demo-consent|fixtures/public' -- apps/web
```
Expected: the grep prints only `apps/web/tests/korean-ux-copy.test.ts` (file-list entries, fixed next) and `apps/web/tests/unified-product.test.tsx` (the regex that forbids these names — keep it).

In `apps/web/tests/korean-ux-copy.test.ts` remove from `userFacingFiles`: `components/concept/HealthHomeConcept.tsx`, `components/integrated/PrepareConceptNotice.tsx`, `components/concept/RecordImportConcept.tsx`, `components/experience/HealthExperience.tsx`, `components/privacy/DataControlCenter.tsx`, `components/records/EvidenceLens.tsx`, `components/records/HealthTimeline.tsx`; in "states the example, connection, and medical limits…" delete the four `expect(source(…)).toContain(…)` calls that read `RecordImportConcept.tsx`, `EvidenceLens.tsx`, `HealthHomeConcept.tsx`, `HealthTimeline.tsx` (Task 7 rewrites this test; here it only has to compile and pass).

- [ ] **Step 3: Tailwind out, `globals.css` folded away**

```bash
pnpm --dir apps/web remove tailwindcss @tailwindcss/postcss
git rm -q apps/web/postcss.config.mjs
```

(With no `postcss.config.*`, Next uses its built-in PostCSS pipeline — autoprefixer and CSS Modules keep working; `autoprefixer` stays in devDependencies for Storybook's Vite pipeline.)

Move the two remaining global families out of `globals.css`:

1. `CandidateReview` → create `apps/web/components/integrated/Review.module.css`:

```css
.page { min-height: 100vh; color: var(--gc-color-text-primary); }
.bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: min(100% - 2rem, 72rem); min-height: var(--gc-shell-height); margin-inline: auto; }
.bar > :last-child { justify-self: end; }
.bar > :nth-child(2) { justify-self: center; }
.shell { width: min(100% - 2rem, 62rem); margin-inline: auto; padding: var(--gc-space-4) 0 var(--gc-space-10); min-width: 0; }
.review { display: grid; gap: var(--gc-space-4); min-width: 0; }
.heading { display: grid; gap: var(--gc-space-2); min-width: 0; }
.heading h1 { font: 400 var(--gc-type-display) / 1.2 var(--gc-type-serif); word-break: keep-all; }
.lead { color: var(--gc-color-text-secondary); word-break: keep-all; }
.state { justify-self: start; }
.candidate { border: var(--gc-rule); background: var(--gc-color-surface-raised); padding: var(--gc-space-4); min-width: 0; overflow-wrap: anywhere; }
.candidate h2 { font: 400 var(--gc-type-title) / 1.3 var(--gc-type-serif); }
.candidateLabel { display: block; margin-bottom: var(--gc-space-1); }
.candidateOriginal { margin-top: var(--gc-space-1); color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.value { display: flex; align-items: baseline; gap: var(--gc-space-2); margin-top: var(--gc-space-2); }
.value strong { font: 400 2.5rem / 1 var(--gc-type-pixel); }
.value span { color: var(--gc-color-text-secondary); font-family: var(--gc-type-mono); }
.source { margin: var(--gc-space-2) 0 0; color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.candidate dl { margin-top: var(--gc-space-3); }
.candidate dd button { margin-left: var(--gc-space-2); }
.evidence { margin-top: var(--gc-space-2); }
.preview { display: grid; gap: var(--gc-space-2); }
.preview img { display: block; width: 100%; max-height: 32rem; object-fit: contain; object-position: top; background: #fff; border: var(--gc-rule); }
.preview figcaption { color: var(--gc-color-text-secondary); font-size: 0.875rem; }
.preview a { display: inline-flex; min-height: var(--gc-target-minimum); align-items: center; text-decoration: underline; }
.decisionBar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--gc-space-2); }
.decisionBar > button { width: 100%; min-width: 0; padding-inline: var(--gc-space-2); }
.correction { display: grid; gap: var(--gc-space-2); border: var(--gc-rule); background: var(--gc-color-surface-raised); padding: var(--gc-space-4); }
@media (max-width: 42rem) {
  .value strong { font-size: 2rem; }
  .preview img { max-height: 12rem; object-fit: cover; }
  .preview img:focus { max-height: none; }
}
```

In `CandidateReview.tsx` import `styles from "@/components/integrated/Review.module.css"` and map: `gc-import` + `data-stage="review"` → `className={styles.page} data-stage="review"`; `gc-import__appbar` → `styles.bar` with its three buttons/span: `<button className="gc-button gc-button--text" …>이전</button>`, `<span className="gc-meta">앎</span>` → replace with `<Patch variant="wordmark" />` (import `Patch`), `<button className="gc-button gc-button--text" …>닫기</button>`; `gc-import__shell` → `styles.shell`; `gc-import__review` → `styles.review`; `gc-import__review-heading` → `styles.heading`; `gc-import__eyebrow` → `gc-panel__eyebrow` (and the `gc-review-progress` span → `className="gc-meta gc-meta--latin"` — its content is `1 / 3`, digits only); `gc-import__lead` → `styles.lead`; `gc-import__review-state` → `className={`gc-meta ${styles.state}`}`; `gc-import__candidate` → `styles.candidate`; `gc-import__candidate-label` → `className={`gc-panel__eyebrow ${styles.candidateLabel}`}`; `gc-import__candidate-original` → `styles.candidateOriginal`; `gc-import__candidate-value` → `styles.value`; `gc-import__candidate-source` → `styles.source`; the candidate `<dl>` → `className="gc-facts"`; `gc-review-evidence` → `className={`gc-details ${styles.evidence}`}` (its inner `dl` → `gc-facts`); `gc-review-source` → `className="gc-details"`; `gc-import__safe-preview` → `styles.preview`; the "검사일 수정" text button → `gc-button gc-button--text`; both forms `gc-integrated-correction gc-review-decision-bar` → `className={`gc-field ${styles.correction}`}` with their `gc-integrated-actions` → `gc-actions` and buttons `gc-button gc-button--secondary` (취소) / `gc-button gc-button--primary` (submit); the decision `div` `gc-import__review-actions gc-review-decision-bar` → `styles.decisionBar` with buttons `gc-button gc-button--text` (제외), `gc-button gc-button--secondary` (수정), `gc-button gc-button--primary` (확인); the retry `<p role="status">` keeps its text and its button gets `gc-button gc-button--text`; `gc-integrated-error` → `gc-error`. Accessible names, ids, `aria-*`, `data-testid` and every visible string stay as they are.

2. `ConnectionExperience` → move its family out verbatim, then re-token:

```bash
awk '/^\.gc-connections \{/,/^\.gc-data-control \{/' apps/web/app/globals.css | sed '$d' > apps/web/components/connections/connections.css
grep -c 'gc-connections\|gc-provider-card' apps/web/components/connections/connections.css   # expected: > 40
```

Then in `connections.css` apply these replacements (sed, in order): `#f5f7fa` → `var(--gc-color-surface-canvas)`; `#fff` and `#ffffff` → `var(--gc-color-surface-raised)`; `#eef1f5`, `#f5f7f7`, `#e5f3f2` → `var(--gc-color-surface-soft)`; `#3b4047`, `#4a4f57` → `var(--gc-color-text-primary)`; `#626d7d`, `#687180`, `#697485`, `#737d8b`, `#77808d`, `#7a8492`, `#858c96`, `#8f969f`, `#969da7`, `#616c7b`, `#8aa6b0`, `#645c38` → `var(--gc-color-text-secondary)`; `#cbd2dc`, `#cfd5de`, `#dce1e8`, `#e4e7e9`, `#b1b7c0` → `var(--gc-color-line-subtle)`; `#fee500`, `#f0d96c` → `var(--gc-color-surface-soft)` (the Kakao yellow is not a brand we render); every `rgb(... / N%)` shadow → `none` (`box-shadow: none`); every `border-radius: <anything>` → `border-radius: var(--gc-radius-sm)`; every `letter-spacing: …;` line deleted; every `text-transform: uppercase;` line deleted; every `font-size` below `0.75rem`/`12px` → `var(--gc-type-meta)`; media queries `(max-width: 48rem)` → `(max-width: 56rem)` and `(max-width: 34rem)` → `(max-width: 42rem)`; any remaining `font-family` with a quoted name other than the allowed set → `var(--gc-type-mono)` or `var(--gc-type-sans)`. Add `import "@/components/connections/connections.css";` at the top of `ConnectionExperience.tsx`. Verify: `grep -c '#[0-9a-fA-F]\{3,6\}' apps/web/components/connections/connections.css` prints `0`.

3. `PublicProviderExplorer.module.css`: apply the same colour mapping (`#f8fafb`, `#f5f7f8`, `#fff` → surface tokens; `#17191d` → text primary; `#6d747c`, `#70777e`, `#687078`, `#327683` → text secondary; `#cbd3d8`, `#e4e4e7` → line subtle; `#18181b`, `#27272a` → text primary; `#3182f6` → focus ring; `#7dd3c7`, `#ecfdf3`, `#166534`, `#2563eb`, `#f4f4f5` → surface soft / text secondary as fits; `rgb(… / N%)` backgrounds → `var(--gc-color-surface-soft)`; shadows → `none`; radii → `var(--gc-radius-sm)`; `letter-spacing`/`uppercase` lines deleted; fonts under 12px → `var(--gc-type-meta)`; breakpoints onto the scale). Verify the same `grep -c` prints `0`.

4. Delete `apps/web/app/globals.css` and its import line in `apps/web/app/layout.tsx`:

```bash
git rm -q apps/web/app/globals.css
grep -rn "gc-\(integrated\|import\|review\|records\|prepare\|health-home\|demo-entry\|data-control\|evidence\|edit-dialog\|consent-dialog\|text-button\|source-preview\|unit-grid\|status-label\)" apps/web/components apps/web/app apps/web/lib apps/web/stories | grep -v 'gc-data-control__project-revoke'
```
Expected: no output. Any hit is a class that still needs its module (fix it before continuing). `SourcePreview.tsx` uses `gc-source-preview`: it has no module of its own, so give its `<figure>` `className="gc-panel"` and add one rule to `system.css`: `.gc-panel > img, .gc-panel figure img { display: block; width: 100%; max-height: 32rem; object-fit: contain; object-position: top; background: #fff; border: var(--gc-rule); }`.

`apps/web/.storybook/preview.ts` imports become `"../font-bundle"`, `"@gc/design-tokens/tokens.css"`, `"../styles/tokens.css"`, `"../styles/system.css"`; backgrounds: `default: "ground", values: [{ name: "ground", value: "#000000" }]`.

- [ ] **Step 4: Tests — the contract grows to the whole tree**

Replace `apps/web/tests/generated-token-consumption.test.ts` with:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "..");
const skip = new Set(["node_modules", ".next", "test-results", "storybook-static", "public", "fonts"]);
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) cssFiles(path, out);
    else if (name.endsWith(".css")) out.push(path);
  }
  return out;
}

describe("design-token consumption", () => {
  it("defines every --gc-* token any stylesheet references", () => {
    const definitions = new Set<string>();
    for (const file of [resolve(webRoot, "../../packages/design-tokens/dist/tokens.css"), resolve(webRoot, "styles/tokens.css")]) {
      for (const match of readFileSync(file, "utf8").matchAll(/(--gc-[A-Za-z0-9-]+)\s*:/g)) definitions.add(match[1]);
    }
    definitions.add("--gc-font-pixel"); // set on <html> by next/font/local (lib/fonts/pixelify.ts)
    const missing: string[] = [];
    for (const file of cssFiles(webRoot)) {
      for (const match of readFileSync(file, "utf8").matchAll(/var\((--gc-[A-Za-z0-9-]+)/g)) {
        if (!definitions.has(match[1])) missing.push(`${file}: ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
```

Replace `apps/web/tests/design-system-contract.test.ts` with the whole-tree version:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(webRoot, path), "utf8");
const skip = new Set(["node_modules", ".next", "test-results", "storybook-static", "public", "fonts"]);
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) cssFiles(path, out);
    else if (name.endsWith(".css")) out.push(path);
  }
  return out;
}
const files = cssFiles(webRoot).map((file) => relative(webRoot, file).split("\\").join("/"));

export const ALLOWED_FONT_NAMES = ["Pretendard Variable", "Pretendard", "IBM Plex Mono", "Noto Serif KR", "Pixelify Sans"];
export const ALLOWED_MEDIA = ["(max-width: 42rem)", "(max-width: 56rem)", "(min-width: 56.01rem)", "(hover: hover)", "(prefers-reduced-motion: reduce)", "print"];

describe("design-system contract", () => {
  it("has no globals.css, no Tailwind and no studio layer", () => {
    expect(existsSync(resolve(webRoot, "app/globals.css"))).toBe(false);
    expect(existsSync(resolve(webRoot, "postcss.config.mjs"))).toBe(false);
    const packageJson = JSON.parse(read("package.json"));
    expect(packageJson.devDependencies.tailwindcss).toBeUndefined();
    expect(packageJson.devDependencies["@tailwindcss/postcss"]).toBeUndefined();
    for (const file of files) {
      const css = read(file);
      expect(css, file).not.toMatch(/@import\s+["']tailwindcss|--gc-studio-|@source/);
    }
    expect(read("app/layout.tsx")).not.toContain("globals.css");
  });

  it("keeps global classes to styles/system.css and connections.css only", () => {
    for (const file of files) {
      if (file.endsWith(".module.css") || file === "styles/system.css" || file === "components/connections/connections.css" || file.startsWith("styles/fonts/") || file === "styles/tokens.css") continue;
      expect.fail(`${file} is a global stylesheet outside the allowed set`);
    }
    for (const file of files.filter((f) => f.endsWith(".module.css"))) {
      expect(read(file), `${file} defines a gc-* global class`).not.toMatch(/(^|[^\w:-])\.gc-[a-z]/m);
    }
  });

  it("uses uppercase and tracking only in .gc-meta--latin, never negative tracking, never a font under 12px", () => {
    for (const file of files) {
      const rules = read(file).replace(/\/\*[\s\S]*?\*\//g, "").split("}");
      for (const rule of rules) {
        if (/text-transform:\s*uppercase|letter-spacing/.test(rule)) expect(rule, `${file}: ${rule.trim().slice(0, 80)}`).toContain(".gc-meta--latin");
        expect(rule, `${file}: negative tracking`).not.toMatch(/letter-spacing:\s*-/);
        for (const match of rule.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)) {
          const px = match[2] === "px" ? Number(match[1]) : Number(match[1]) * 16;
          expect(px, `${file}: ${match[0]}`).toBeGreaterThanOrEqual(12);
        }
        for (const match of rule.matchAll(/font:\s*(?:\d+\s+)?([\d.]+)(px|rem)/g)) {
          const px = match[2] === "px" ? Number(match[1]) : Number(match[1]) * 16;
          expect(px, `${file}: ${match[0]}`).toBeGreaterThanOrEqual(12);
        }
      }
    }
  });

  it("names only bundled faces, one mono stack, and the one breakpoint scale", () => {
    for (const file of files) {
      const css = read(file);
      for (const match of css.matchAll(/font(?:-family)?:\s*([^;]+);/g)) {
        for (const quoted of match[1].matchAll(/"([^"]+)"/g)) expect(ALLOWED_FONT_NAMES, `${file}: ${quoted[1]}`).toContain(quoted[1]);
        if (/monospace/.test(match[1]) && !file.startsWith("styles/") && !file.includes("design-tokens")) expect.fail(`${file}: a mono stack outside var(--gc-type-mono): ${match[1]}`);
      }
      for (const match of css.matchAll(/@media\s+([^{]+)\{/g)) expect(ALLOWED_MEDIA, `${file}: @media ${match[1].trim()}`).toContain(match[1].trim());
    }
  });

  it("never colours by literal hex outside the token sources (red is the emblem token only)", () => {
    for (const file of files) {
      if (file === "styles/tokens.css" || file.startsWith("styles/fonts/")) continue;
      const css = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
      const literals = Array.from(css.matchAll(/#[0-9a-fA-F]{3,8}\b/g), (match) => match[0]).filter((hex) => hex.toLowerCase() !== "#fff" && hex.toLowerCase() !== "#ffffff" && hex.toLowerCase() !== "#000");
      expect(literals, `${file}: literal colours`).toEqual([]);
      expect(css, `${file}: status-danger must not colour a value`).not.toContain("--gc-color-status-danger");
    }
  });
});
```

(`#fff`/`#000` are allowed only for the two places that need them: the PDF preview's white paper and the print sheet.)

Run:

```bash
pnpm --dir apps/web exec vitest run tests/design-system-contract.test.ts tests/generated-token-consumption.test.ts tests/css-coverage.test.ts
```
Expected: FAIL only on classes/rules the previous steps have not yet cleaned — fix each named file until all three PASS. The `css-coverage` list must be `[]`: any class it names is either dead (delete the rule) or a typo between a module and its component (fix the reference).

Also update `apps/web/tests/unified-product.test.tsx` route list to `["", "records/", "prepare/", "data-control/", "my-data/", "my-data/history/"]` and keep the forbidden regex; for `my-data/` routes assert `expect(source).toContain("components/my-data/")` instead of `integrated/` (use `expect(source).toMatch(/components\/(integrated|my-data)\//)`).

- [ ] **Step 5: Gates, lifecycle, evidence file, commit**

```bash
pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm --dir apps/web build
pnpm --dir apps/web build-storybook
node apps/web/scripts/css-coverage.mts > docs/status/2026-09-18/css-coverage-after.json
pnpm foundation:e2e
git checkout -- apps/web/next-env.d.ts
rm -rf apps/web/storybook-static
git add -A apps/web docs/status/2026-09-18/css-coverage-before.json docs/status/2026-09-18/css-coverage-after.json pnpm-lock.yaml
git reset -q apps/web/next-env.d.ts
git commit -m "chore(web): delete dead concept components and stories, drop Tailwind and globals.css, one breakpoint scale, unreferenced-CSS report

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Expected: `css-coverage-after.json` reports `"unreferenced": 0`; Storybook builds with the two remaining stories; lifecycle `3 passed`.

---
### Task 6: Hero polish — fill the stage, nodes inside, no reparenting, one length measurement, synchronous reduced-motion, tokens in the layout

**Files:**
- Modify: `apps/web/components/home/AliveTrajectory.tsx`, `apps/web/components/home/AliveTrajectory.module.css`, `apps/web/components/home/AliveEntryLayout.tsx`, `apps/web/components/home/AliveEntryLayout.module.css`, `apps/web/tests/alive-trajectory-component.test.tsx`, `apps/web/tests/alive-entry-layout.test.tsx`, `apps/web/e2e/foundation-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `usePrefersReducedMotion` (Task 1), tokens, `rowState` (Task 3).
- Produces: `AliveTrajectory` with `data-view-box="W H"` on its root, `viewBox` following the measured stage aspect (width fixed at 1200), every node group created once in the front layer (`data-layer="front"`), `<ol aria-label="검진 시기">` for the phase strip, sections with `aria-labelledby` (region role) for the panels.

- [ ] **Step 1: Failing tests**

Append to `apps/web/tests/alive-trajectory-component.test.tsx`:

```tsx
it("sizes its viewBox to the stage it is given, so the composition fills the frame instead of floating in a letterbox", async () => {
  const original = SVGElement.prototype.getBoundingClientRect;
  SVGElement.prototype.getBoundingClientRect = () => ({ width: 600, height: 300, top: 0, left: 0, right: 600, bottom: 300, x: 0, y: 0, toJSON() { return {}; } });
  try {
    const { container } = render(<AliveTrajectory />);
    await waitFor(() => expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 1200 600"));
    expect(container.firstElementChild).toHaveAttribute("data-view-box", "1200 600");
    const [, , , h] = container.querySelector("svg")!.getAttribute("viewBox")!.split(" ").map(Number);
    // Every node centre is inside the frame: no ring leaks past an edge.
    for (const group of container.querySelectorAll("g[data-node]")) {
      const match = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(group.getAttribute("transform") ?? "");
      expect(match).not.toBeNull();
      expect(Number(match![1])).toBeGreaterThanOrEqual(0);
      expect(Number(match![1])).toBeLessThanOrEqual(1200);
      expect(Number(match![2])).toBeGreaterThanOrEqual(0);
      expect(Number(match![2])).toBeLessThanOrEqual(h);
    }
  } finally {
    SVGElement.prototype.getBoundingClientRect = original;
  }
});

it("never reparents a node between layers while animating (opacity carries depth)", async () => {
  const { container } = render(<AliveTrajectory />);
  const front = container.querySelector("g[data-layer='front']")!;
  const groups = Array.from(container.querySelectorAll("g[data-node]"));
  expect(groups.length).toBeGreaterThan(0);
  const appendChild = vi.spyOn(Element.prototype, "appendChild");
  await new Promise((resolve) => setTimeout(resolve, 120));
  expect(appendChild.mock.calls.filter(([node]) => (node as Element).hasAttribute?.("data-node"))).toHaveLength(0);
  for (const group of groups) expect(group.parentElement).toBe(front);
  appendChild.mockRestore();
});

it("measures the halo path length once per frame at most, and not at all in the still frame", async () => {
  stubReducedMotion(true);
  const getTotalLength = vi.fn(() => 3200);
  Object.defineProperty(SVGPathElement.prototype, "getTotalLength", { configurable: true, writable: true, value: getTotalLength });
  try {
    render(<AliveTrajectory />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getTotalLength).not.toHaveBeenCalled();
  } finally {
    // @ts-expect-error jsdom has no getTotalLength by default
    delete SVGPathElement.prototype.getTotalLength;
    clearReducedMotionStub();
  }
});

it("reads reduced motion synchronously on the first render (no animated first frame)", () => {
  stubReducedMotion(true);
  const rafSpy = vi.spyOn(window, "requestAnimationFrame");
  const { container } = render(<AliveTrajectory />);
  expect(container.firstElementChild).toHaveAttribute("data-reduced-motion", "true");
  expect(rafSpy).not.toHaveBeenCalled();
  rafSpy.mockRestore();
  clearReducedMotionStub();
});

it("keeps every phase label horizontal at 12px with a black halo", () => {
  const { container } = render(<AliveTrajectory />);
  const labels = Array.from(container.querySelectorAll("text[data-phase-label]"));
  expect(labels.length).toBeGreaterThanOrEqual(4);
  for (const label of labels) {
    expect(label).toHaveAttribute("font-size", "12");
    expect(label).toHaveAttribute("stroke", "#000");
    expect(label.getAttribute("transform")).toBeNull();
  }
});
```

(add `waitFor` to the Testing Library import.) In `apps/web/tests/alive-entry-layout.test.tsx` replace `container.querySelector("nav[aria-label='검진 시기']")` with `container.querySelector("ol[aria-label='검진 시기']")`, and append:

```tsx
it("labels its panels as regions (aria-labelledby only on elements with a role) and has no decorative nav", () => {
  const { container } = renderLayout();
  for (const element of container.querySelectorAll("[aria-labelledby]")) {
    expect(["SECTION", "NAV", "FORM", "TABLE", "FIGURE", "SVG", "DIV"]).toContain(element.tagName);
    if (element.tagName === "DIV") expect(element).toHaveAttribute("role");
  }
  expect(container.querySelector("nav")).toBeNull();
  expect(screen.getByRole("region", { name: "프로필 · 예시" })).toBeInTheDocument();
});
```

Run: `pnpm --dir apps/web exec vitest run tests/alive-trajectory-component.test.tsx tests/alive-entry-layout.test.tsx` — Expected: FAIL on the five new hero cases and the `ol`/region case.

- [ ] **Step 2: Hero implementation**

In `apps/web/components/home/AliveTrajectory.tsx` make these changes (everything not mentioned stays):

1. Imports: add `useState` to the React import; import `usePrefersReducedMotion` from `@/lib/motion/reduced-motion` (already done in Task 1).

2. Replace `const VIEW_H = 760;` with:

```ts
const VIEW_W = 1200;
const DEFAULT_VIEW_H = 760;
const MIN_VIEW_H = 420;
const MAX_VIEW_H = 1400;
/** Base y of the axis and the y of every base control point: the middle of the current frame. */
function baseControlPoints(viewH: number) {
  return BASE_CONTROL_POINTS.map(([x]) => [x, viewH / 2] as const);
}
```

3. In the component body, before the effect, add the stage measurement (measured once per resize, never per frame):

```tsx
  const [viewH, setViewH] = useState(DEFAULT_VIEW_H);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const apply = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const next = Math.round(Math.min(MAX_VIEW_H, Math.max(MIN_VIEW_H, (VIEW_W * rect.height) / rect.width)));
      setViewH((current) => (Math.abs(current - next) >= 2 ? next : current));
    };
    apply();
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(apply);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
```

4. In the main effect: `const controlPoints: ControlPoint[] = createControlPoints(baseControlPoints(viewH));`; add `viewH` to the effect's dependency array; the phase label `y` becomes `String(pathPointAtTick.y - Math.min(100, viewH * 0.14))` and the label element gets the attribute `"data-phase-label": ""`.

5. Node groups: create every group in `frontLayer` with `el(frontLayer, "g", { "data-node": "" })` (unchanged position) and **delete** the two lines `const layer = (near ? frontLayer : backLayer)!;` and `if (node.group.parentNode !== layer) layer.appendChild(node.group);` from `frame`. Depth stays expressed by `scale` and `opacity` exactly as now.

6. Edge clamp for labels: in both `renderStill` and `frame`, replace `const side = Math.cos(theta) >= 0 ? 1 : -1;` with `const side = x > VIEW_W - 160 ? -1 : x < 160 ? 1 : Math.cos(theta) >= 0 ? 1 : -1;` (computed after `x`).

7. Halo length: replace `const length = 3200; // stable approximate length; only used for the halo dash flourish.` with `const length = typeof halo!.getTotalLength === "function" ? halo!.getTotalLength() : 3200; // once per frame (§8.10)`.

8. Still frame first, then the loop: replace

```ts
    if (reduced) {
      renderStill();
    } else {
      frame(performance.now());
    }
```
with
```ts
    // The complete still composition is painted before any observer or loop exists (§8.1, §6):
    // a screenshot on the first frame already shows every ring, node and label.
    renderStill();
    if (!reduced) frame(performance.now());
```
and move the `IntersectionObserver` creation block to after this call (it only gates later frames).

9. The `<svg>` element: `viewBox={`0 0 ${VIEW_W} ${viewH}`}`, `preserveAspectRatio="xMidYMid meet"` (the viewBox now has the stage's own aspect, so `meet` fills it); the root `div` gets `data-view-box={`${VIEW_W} ${viewH}`}`; the two `<rect>` grid fills use `height={viewH}`; the back layer `<g ref={backLayerRef} data-layer="back" />` and front `<g ref={frontLayerRef} data-layer="front" />`.

10. `AliveTrajectory.module.css`: replace the two hard-coded font stacks: `.svg text { font-family: var(--gc-type-sans); }`, `.mono { font-family: var(--gc-type-mono); }`, `.caption { … font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); color: var(--gc-color-text-secondary); … }`, `.boundary { … font-size: var(--gc-type-meta); color: var(--gc-color-text-secondary); … }`; `--alive-bg`/`--alive-ink` → `var(--gc-color-surface-canvas)` / `var(--gc-color-text-primary)`; the `@media (max-width: 480px)` block → `@media (max-width: 42rem)`.

Run: `pnpm --dir apps/web exec vitest run tests/alive-trajectory-component.test.tsx tests/alive-trajectory.test.ts` — Expected: PASS.

- [ ] **Step 3: Layout on tokens, panels as regions, strip as a list**

In `apps/web/components/home/AliveEntryLayout.tsx`:
- `IdentityPanel`: `<section className={styles.panel} aria-labelledby="alive-identity-title">` with `<h2 className={styles.panelTitle} id="alive-identity-title">프로필 · 예시</h2>` (an `h2` in the mono meta style; tests query the text, not the tag).
- `RecordsPanel`: `<section className={styles.panel} aria-labelledby={titleId}>` with `<h2 className={styles.panelTitle} id={titleId}>{title}</h2>`; the optional `heading` stays a heading (`HomeView`'s test finds `getByRole("heading", { name: "가장 최근에 확인한 값" })`) as `<h3 className={styles.panelHeading}>{heading}</h3>`.
- `PhaseStrip`: `<ol className={styles.phaseStrip} aria-label="검진 시기">` with `<li className={styles.phaseStripItem} …>` items (same children).
- The `rowState` prop (Task 3) stays; the `currentPhaseIndex` derivation stays.

Replace `apps/web/components/home/AliveEntryLayout.module.css` with:

```css
/* Dense grid for the entry and home screens: tokens only, no local palette. */
.grid {
  position: relative; display: grid;
  grid-template-columns: 18% 1fr 24%;
  grid-template-areas: "left center right" "strip strip strip";
  grid-template-rows: 1fr auto;
  min-height: 100vh; gap: var(--gc-space-6);
  background: var(--gc-color-surface-canvas); color: var(--gc-color-text-primary); min-width: 0;
}
.left { grid-area: left; display: flex; flex-direction: column; gap: var(--gc-space-4); padding: var(--gc-space-4) 0 var(--gc-space-6) var(--gc-space-6); min-width: 0; overflow-wrap: anywhere; }
.copy { min-width: 0; overflow-wrap: anywhere; }
.center { grid-area: center; position: relative; min-height: 420px; min-width: 0; }
.right { grid-area: right; padding: var(--gc-space-6) var(--gc-space-6) var(--gc-space-6) 0; min-width: 0; overflow-wrap: anywhere; display: grid; align-content: start; gap: var(--gc-space-4); }
.strip { grid-area: strip; padding: 0 var(--gc-space-6) var(--gc-space-6); min-width: 0; }
.panel { border: var(--gc-rule); padding: var(--gc-space-3) var(--gc-space-4); min-width: 0; background: var(--gc-color-surface-raised); }
.panelTitle { font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); font-weight: 400; color: var(--gc-color-text-secondary); margin: 0 0 var(--gc-space-2); }
.panelHeading { font-size: 1rem; font-weight: 600; margin: 0 0 var(--gc-space-2); min-width: 0; overflow-wrap: anywhere; }
.panelAction { display: inline-flex; align-items: center; min-height: var(--gc-target-minimum); margin-top: var(--gc-space-2); font-size: 0.875rem; text-decoration: underline; text-underline-offset: 0.2em; }
.identityList { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 0; }
.identityList div { display: contents; }
.identityList dt, .identityList dd { margin: 0; padding: 6px 0; border-top: var(--gc-rule); font-size: 0.8125rem; min-width: 0; overflow-wrap: anywhere; }
.identityList div:first-child dt, .identityList div:first-child dd { border-top: none; }
.identityList dt { font-family: var(--gc-type-mono); color: var(--gc-color-text-secondary); padding-right: var(--gc-space-3); white-space: nowrap; }
.identityList dd { text-align: right; }
.identityNote { margin: var(--gc-space-2) 0 0; font-size: var(--gc-type-meta); line-height: 1.5; color: var(--gc-color-text-secondary); min-width: 0; overflow-wrap: anywhere; }
.tableWrap { overflow-x: auto; min-width: 0; }
.table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.table th, .table td { text-align: left; padding: 6px 8px 6px 0; border-top: var(--gc-rule); white-space: nowrap; }
.table thead th { border-top: none; border-bottom: var(--gc-rule); font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); color: var(--gc-color-text-secondary); font-weight: 400; }
.phaseStrip { display: flex; align-items: center; list-style: none; margin: 0; padding: var(--gc-space-2) 0 0; border-top: var(--gc-rule); gap: 0; }
.phaseStripItem { flex: 1 1 0; display: flex; align-items: center; gap: var(--gc-space-2); padding-right: var(--gc-space-3); min-width: 0; }
.phaseStripItem + .phaseStripItem { border-left: var(--gc-rule); padding-left: var(--gc-space-3); }
.phaseMarker { flex: 0 0 auto; width: 8px; height: 8px; border: 1px solid var(--gc-color-text-primary); background: transparent; }
.phaseMarkerCurrent { background: var(--gc-color-text-primary); }
.phaseStripLabel { font-family: var(--gc-type-mono); font-size: var(--gc-type-meta); color: var(--gc-color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

@media (max-width: 56rem) {
  .grid { display: flex; flex-direction: column; gap: var(--gc-space-4); }
  /* Height-first on portrait viewports: the hero takes the top of the first screen, and reserves
     the fixed bottom bar's height so the copy block's button stays reachable without scrolling. */
  .center { order: 1; height: calc(44vh - var(--gc-nav-height)); min-height: 200px; }
  .left { order: 2; padding: 0 var(--gc-space-4); }
  .right { order: 3; padding: 0 var(--gc-space-4); }
  .strip { order: 4; padding: 0 var(--gc-space-4) var(--gc-space-6); }
}
```

Run: `pnpm --dir apps/web exec vitest run tests/alive-entry-layout.test.tsx tests/integrated-review-loop.test.tsx` — Expected: PASS.

- [ ] **Step 4: Hero geometry in the browser**

In `captureMatrix` add, after the `if (state === "entry") { … }` block:

```ts
    if (state === "entry" || state === "home") {
      // §8.1: the hero fills its stage (no letterbox) and no node leaks past the frame.
      const hero = page.getByRole("img").first();
      const heroBox = await hero.boundingBox();
      const stageBox = await hero.locator("xpath=..").boundingBox();
      expect(heroBox).not.toBeNull();
      expect(stageBox).not.toBeNull();
      expect(Math.abs(heroBox!.width - (stageBox!.width - 48))).toBeLessThanOrEqual(2);
      expect(Math.abs(heroBox!.height - (stageBox!.height - 48))).toBeLessThanOrEqual(2);
      const leaked = await hero.evaluate((svg) => {
        const frame = svg.getBoundingClientRect();
        return Array.from(svg.querySelectorAll("g[data-node]")).filter((group) => {
          const box = (group as SVGGElement).getBoundingClientRect();
          return box.width > 0 && (box.left < frame.left - 1 || box.right > frame.right + 1 || box.top < frame.top - 1 || box.bottom > frame.bottom + 1);
        }).length;
      });
      expect(leaked, `${state} ${width}: nodes outside the hero frame`).toBe(0);
      const labelSizes = await hero.evaluate((svg) => Array.from(svg.querySelectorAll("text[data-phase-label]")).map((text) => getComputedStyle(text).fontSize));
      expect(labelSizes.length).toBeGreaterThanOrEqual(3);
      for (const size of labelSizes) expect(size).toBe("12px");
    }
```

```bash
pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm --dir apps/web build
pnpm foundation:e2e
git checkout -- apps/web/next-env.d.ts
git add apps/web/components/home apps/web/tests/alive-trajectory-component.test.tsx apps/web/tests/alive-entry-layout.test.tsx apps/web/e2e/foundation-lifecycle.spec.ts
git commit -m "feat(web): hero fills its stage with every node inside, no reparenting, one length read per frame, synchronous reduced motion

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 7: Copy pass, accessibility pass, tests from source scans to rendered assertions

**Files:**
- Rewrite: `apps/web/tests/korean-ux-copy.test.ts`
- Create: `apps/web/tests/screens-axe.test.tsx`, `apps/web/tests/helpers/screen-fixtures.ts`
- Modify: `apps/web/components/experience/CompleteView.tsx`, `apps/web/components/my-data/MyData.tsx`, `apps/web/components/my-data/history/HistoryGraph.tsx`, `apps/web/components/integrated/IntegratedRecords.tsx`, `apps/web/components/integrated/IntegratedDataControl.tsx`, `apps/web/components/connections/ConnectionExperience.tsx`, `apps/web/components/providers/PublicProviderExplorer.tsx` (only where the checks below name them)

**Interfaces:**
- Consumes: every screen, `RETIRED_TERMS`, `SYSTEM_NOTE_TERMS`, `START_SCREEN_ONLY_TERMS`, `FORBIDDEN_JUDGEMENT_WORDS`, the msw fixtures in `tests/fixtures/foundation.ts`, the router mock.
- Produces: `tests/helpers/screen-fixtures.ts` exporting `screenHandlers(state: "empty" | "filled" | "error")` (an msw handler array for every foundation endpoint the screens read) and `SCREENS` (name → render function + route + `startScreen` flag); the rendered-text safety net that every later wave reuses.

- [ ] **Step 1: Shared screen fixtures**

Create `apps/web/tests/helpers/screen-fixtures.ts`:

```ts
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { syntheticCandidates, syntheticDocumentId, syntheticHealthEvent, syntheticRecord, syntheticSeries } from "../fixtures/foundation";

export type ScreenState = "empty" | "filled" | "error";

const session = { sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b", subjectId: "synthetic-jason", status: "AUTHENTICATED", expiresAt: "2026-09-30T08:30:00Z" };
const consents = [
  { consentId: "89116f1a-2026-457e-8942-409ff8f8fc4f", purposeCode: "DOCUMENT_EXTRACTION", status: "ACTIVE", policyVersion: "foundation-v1", grantedAt: "2026-07-28T09:00:00Z" },
  { purposeCode: "RESEARCH_USE", status: "NOT_GRANTED", policyVersion: "research-consent-policy.v1" },
  { purposeCode: "RESEARCH_CONTACT", status: "NOT_GRANTED", policyVersion: "research-contact-policy.v1" },
];
const records = [
  syntheticRecord(),
  syntheticRecord({ recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c41", recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51", label: "총콜레스테롤", value: "194", originalValue: "194", observedOn: "2026-01-15", documentSha256: "e".repeat(64), confirmedAt: "2026-01-15T09:10:00Z" }),
];
const events = [syntheticHealthEvent(), syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51", observedOn: "2026-01-15", value: "194" })];
const failure = () => HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 503 });

/** Every read the screens make, for one of three states. Writes are never needed by the scans. */
export function screenHandlers(state: ScreenState) {
  const fail = state === "error";
  return [
    http.get("/api/foundation/session", () => HttpResponse.json(session)),
    http.get("/api/foundation/consents/document-extraction", () => HttpResponse.json(consents[0])),
    http.get("/api/foundation/consents", () => (fail ? failure() : HttpResponse.json(consents))),
    http.get("/api/foundation/records", () => (fail ? failure() : HttpResponse.json(state === "filled" ? records : []))),
    http.get("/api/foundation/health-events", () => (fail ? failure() : HttpResponse.json(state === "filled" ? events : []))),
    http.get("/api/foundation/series", () => (fail ? failure() : HttpResponse.json(state === "filled" ? syntheticSeries() : { series: [] }))),
    http.get("/api/foundation/changes", () => HttpResponse.json({ items: [], newConcepts: [], unchangedCount: 0 })),
    http.get("/api/foundation/documents/active", () => HttpResponse.json(state === "filled"
      ? { document: { documentId: syntheticDocumentId, status: "REVIEW_REQUIRED", sha256: "a".repeat(64), contentLength: 2048, stateVersion: 4, previewAvailable: true, quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE" } }
      : {})),
    http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json(state === "filled" ? syntheticCandidates : [])),
  ];
}

export type ScreenSpec = { name: string; path: string; startScreen: boolean; render: () => ReactNode };
```

- [ ] **Step 2: The rendered-text safety net and axe on every screen and state**

Replace `apps/web/tests/korean-ux-copy.test.ts` with (the source scan of forbidden terms stays, over the living files; every sentence assertion that a rendered test already covers is gone; the enum-render source scan and the date tests stay):

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/format/korean-date";
import { RETIRED_TERMS, SYSTEM_NOTE_TERMS } from "@/lib/copy/terminology";
import { FORBIDDEN_JUDGEMENT_WORDS } from "./fixtures/forbidden-words";

/** Every file that prints Korean to a person. New screens are added here (gc-korean-copy workflow). */
export const userFacingFiles = [
  "components/integrated/CandidateReview.tsx",
  "components/integrated/IntegratedDataControl.tsx",
  "components/integrated/IntegratedHealthExperience.tsx",
  "components/integrated/IntegratedRecords.tsx",
  "components/integrated/IntegratedShell.tsx",
  "components/integrated/RecordComparison.tsx",
  "components/integrated/RecentChanges.tsx",
  "components/integrated/VisitPreparation.tsx",
  "components/integrated/SourcePreview.tsx",
  "components/experience/EntryView.tsx",
  "components/experience/RestoreFailedView.tsx",
  "components/experience/HomeView.tsx",
  "components/experience/ConsentView.tsx",
  "components/experience/SourceView.tsx",
  "components/experience/ProcessingView.tsx",
  "components/experience/CompleteView.tsx",
  "components/experience/StageFrame.tsx",
  "components/experience/ReviewStage.tsx",
  "components/ui/Patch.tsx",
  "components/ui/EmptyState.tsx",
  "lib/experience/use-experience-state.ts",
  "lib/records/visit-questions.ts",
  "lib/format/status-labels.ts",
  "lib/format/original-label.ts",
  "lib/foundation/messages.ts",
  "components/connections/ConnectionExperience.tsx",
  "components/providers/PublicProviderExplorer.tsx",
  "components/my-data/LivingCellCanvas.tsx",
  "components/my-data/CellTooltip.tsx",
  "components/my-data/EvidenceDrawer.tsx",
  "components/my-data/MyData.tsx",
  "components/my-data/HealthEventTable.tsx",
  "components/my-data/history/MeasurementHistory.tsx",
  "components/my-data/history/HistoryGraph.tsx",
  "components/home/AliveTrajectory.tsx",
  "components/home/AliveEntryLayout.tsx",
  "lib/home/alive-example-data.ts",
  "lib/home/alive-home-data.ts",
] as const;

/** The safety net: internal jargon, real institutions, direction/speed/judgement words. */
export const forbiddenUserTerms = [
  "합성 시연", "합성 데모", "fixture", "PHI", "SYNTHETIC", "LIVE API", "ACTIVE PURPOSES", "HEALTH PROVIDERS",
  "SOURCE RETENTION", "PURPOSE BOUNDARIES", "Object Lock", "LOCAL AUDIT", "ACCOUNT DATA", "PRODUCTION READINESS",
  "ANTI-HACK", "EVIDENCE LENS", "VERIFIED RECORD", "SOURCE LEDGER", "NEXT CONNECTION", "합성 주소", "합성 항목",
  "합성 공개금액", "오케스트레이션", "삼성 건강검진", "강남세브란스",
  "상승", "하락", "증가", "감소", "빨라", "느려", "좋아", "나빠", "추세",
  "합성 PDF", "합성 후보", "합성 결과지", "합성 프로필", "적대적 문서 격리 구역", "신뢰 경계", "서버 응답만 표시해요", "미리 정한",
] as const;

const rawServerEnumRenders = ["{candidate.status}", '{consent?.status ?? "NOT_GRANTED"}', "{record.status}", "{record.reviewDecision}", "{latest.status}"] as const;

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Korean UX language boundary (source safety net)", () => {
  it.each(userFacingFiles)("keeps internal jargon, real institution names and direction words out of %s", (path) => {
    const content = source(path);
    for (const forbidden of forbiddenUserTerms) expect(content, `${path} exposes ${forbidden}`).not.toContain(forbidden);
  });

  it("labels every server enum in Korean instead of rendering it raw", () => {
    for (const path of userFacingFiles.filter((file) => file.startsWith("components/"))) {
      const content = source(path);
      for (const raw of rawServerEnumRenders) expect(content, `${path} renders ${raw} without a Korean label`).not.toContain(raw);
    }
  });

  it("keeps the retired terms and the system explanations out of every screen source except 데이터 관리", () => {
    for (const path of userFacingFiles) {
      const content = source(path);
      for (const { retired } of RETIRED_TERMS) expect(content, `${path} still says ${retired}`).not.toContain(retired);
      if (path !== "components/integrated/IntegratedDataControl.tsx" && path !== "components/connections/ConnectionExperience.tsx") {
        for (const term of SYSTEM_NOTE_TERMS) expect(content, `${path} explains the system (${term}) outside 데이터 관리 › 자세히`).not.toContain(term);
      }
    }
  });

  it("keeps the judgement blocklist itself intact", () => {
    expect(FORBIDDEN_JUDGEMENT_WORDS).toEqual(["정상", "비정상", "높음", "낮음", "위험", "주의", "권장", "상승", "하락", "증가", "감소", "좋아", "나빠", "추세", "안정"]);
  });

  it("shows Korean dates without exposing ISO punctuation in visible copy", () => {
    expect(formatKoreanDate("2026-07-28")).toBe("2026. 7. 28.");
    expect(formatKoreanDateTime("2026-08-10 09:44")).toBe("2026. 8. 10. 09:44");
    expect(formatKoreanDateTime("2026-09-16T06:52:59.605506Z")).toBe("2026. 9. 16. 15:52");
    expect(formatKoreanDateTime("2026-09-16T06:52:59+00:00")).toBe("2026. 9. 16. 15:52");
  });
});
```

Create `apps/web/tests/screens-axe.test.tsx` — every screen × every state: rendered-text scan (retired terms, system terms outside 자세히, judgement words, arrows, "체험" outside the start screen, one `.gc-caption`, no `role="status"` around a control, `aria-labelledby` only on role-bearing elements, no `nav` without a link) and axe:

```tsx
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { IntegratedHealthExperience } from "@/components/integrated/IntegratedHealthExperience";
import { IntegratedRecords } from "@/components/integrated/IntegratedRecords";
import { IntegratedDataControl } from "@/components/integrated/IntegratedDataControl";
import { IntegratedVisitPreparation } from "@/components/integrated/VisitPreparation";
import { MyData } from "@/components/my-data/MyData";
import { MeasurementHistory } from "@/components/my-data/history/MeasurementHistory";
import { ImportFlowProvider } from "@/components/experience/ImportFlowProvider";
import { ConsentStage } from "@/components/experience/ConsentView";
import { SourceStage } from "@/components/experience/SourceView";
import { ProcessingStage } from "@/components/experience/ProcessingView";
import { ReviewStage } from "@/components/experience/ReviewStage";
import { RETIRED_TERMS, START_SCREEN_ONLY_TERMS, SYSTEM_NOTE_TERMS } from "@/lib/copy/terminology";
import { FORBIDDEN_JUDGEMENT_WORDS } from "./fixtures/forbidden-words";
import { screenHandlers, type ScreenState } from "./helpers/screen-fixtures";
import { resetRouter } from "./helpers/router-mock";

vi.mock("next/navigation", async () => (await import("./helpers/router-mock")).nextNavigationMock);

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => { cleanup(); server.resetHandlers(); document.cookie = "GC_CSRF=; expires=Thu, 01 Jan 1970 00:00:00 GMT"; });

type Screen = { name: string; path: string; startScreen?: boolean; dataControl?: boolean; render: () => React.ReactElement; settled: () => Promise<unknown> };

const screens: Screen[] = [
  { name: "home", path: "/", render: () => <IntegratedHealthExperience />, settled: () => screen.findByRole("navigation", { name: "주요 메뉴" }) },
  { name: "import/consent", path: "/import/consent", render: () => <ImportFlowProvider><ConsentStage /></ImportFlowProvider>, settled: () => screen.findByRole("heading", { name: "결과지에서 항목을 확인해도 될까요?" }) },
  { name: "import/source", path: "/import/source", render: () => <ImportFlowProvider><SourceStage /></ImportFlowProvider>, settled: () => screen.findByRole("heading", { name: "예시 결과지를 선택해 주세요" }) },
  { name: "import/status", path: "/import/status", render: () => <ImportFlowProvider><ProcessingStage /></ImportFlowProvider>, settled: () => screen.findByRole("heading", { name: /결과지를 읽고 있어요|예시 결과지를 선택해 주세요/ }) },
  { name: "import/review", path: "/import/review", render: () => <ImportFlowProvider><ReviewStage /></ImportFlowProvider>, settled: () => screen.findByRole("heading", { name: /결과지에 이렇게 적혀 있나요\?|예시 결과지를 선택해 주세요/ }) },
  { name: "my-data", path: "/my-data", render: () => <MyData />, settled: () => screen.findByRole("heading", { level: 1, name: "나의 데이터" }) },
  { name: "history", path: "/my-data/history", render: () => <MeasurementHistory />, settled: () => screen.findByRole("heading", { level: 1, name: "측정 이력" }) },
  { name: "records", path: "/records", render: () => <IntegratedRecords />, settled: () => screen.findByRole("heading", { level: 1, name: "내 기록" }) },
  { name: "prepare", path: "/prepare", render: () => <IntegratedVisitPreparation />, settled: () => screen.findByRole("heading", { level: 1, name: "다음 진료에서 물어볼 것" }) },
  { name: "data-control", path: "/data-control", dataControl: true, render: () => <IntegratedDataControl />, settled: () => screen.findByRole("heading", { level: 1, name: "데이터 관리" }) },
];

const states: ScreenState[] = ["empty", "filled", "error"];

function textWithoutDetails(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("details").forEach((node) => node.remove());
  return clone.textContent ?? "";
}

describe.each(screens)("$name", (spec) => {
  it.each(states)("renders the %s state with clean copy, sound roles and no axe violation", async (state) => {
    server.use(...screenHandlers(state));
    document.cookie = "GC_CSRF=synthetic-screen-scan";
    resetRouter(spec.path);
    const { container } = render(spec.render());
    await spec.settled();
    // Loading lines settle: wait until no "불러오고" status remains, or the error alert is up.
    await waitFor(() => {
      const busy = Array.from(container.querySelectorAll("[role='status']")).some((node) => /불러오고|확인하고 있어요/.test(node.textContent ?? ""));
      if (busy && !container.querySelector("[role='alert']")) throw new Error("still loading");
    });

    const visible = textWithoutDetails(container);
    for (const { retired } of RETIRED_TERMS) expect(visible, `${spec.name}/${state} says ${retired}`).not.toContain(retired);
    for (const word of FORBIDDEN_JUDGEMENT_WORDS) expect(visible, `${spec.name}/${state} says ${word}`).not.toContain(word);
    expect(visible, `${spec.name}/${state} has an arrow`).not.toMatch(/[→↑↓▲▼]/);
    for (const term of SYSTEM_NOTE_TERMS) expect(visible, `${spec.name}/${state} explains the system (${term}) outside 자세히`).not.toContain(term);
    if (!spec.dataControl) for (const term of SYSTEM_NOTE_TERMS) expect(container.textContent, `${spec.name}/${state}: ${term} even under details`).not.toContain(term);
    if (!spec.startScreen && !(spec.name === "home" && state === "error")) {
      for (const term of START_SCREEN_ONLY_TERMS) expect(visible, `${spec.name}/${state} says ${term} off the start screen`).not.toContain(term);
    }

    // One boundary caption per screen (the import stages and the loading/error skeletons have none).
    const captions = container.querySelectorAll(".gc-caption");
    expect(captions.length, `${spec.name}/${state} captions`).toBeLessThanOrEqual(1);
    // role=status never wraps a control; aria-labelledby only on elements that have a role.
    for (const status of container.querySelectorAll("[role='status']")) expect(status.querySelector("a, button, input"), `${spec.name}/${state}: control inside role=status`).toBeNull();
    for (const element of container.querySelectorAll("[aria-labelledby]")) {
      const implicit = ["SECTION", "NAV", "FORM", "TABLE", "FIGURE", "SVG", "ARTICLE", "DIALOG", "H1", "H2", "H3", "INPUT"];
      if (!implicit.includes(element.tagName)) expect(element, `${spec.name}/${state}: aria-labelledby on a roleless ${element.tagName}`).toHaveAttribute("role");
    }
    for (const nav of container.querySelectorAll("nav")) expect(nav.querySelector("a"), `${spec.name}/${state}: decorative nav`).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

Run: `pnpm --dir apps/web exec vitest run tests/screens-axe.test.tsx tests/korean-ux-copy.test.ts`
Expected: some FAIL — the list below is what the scan is expected to catch; fix each in its component and re-run until green:
- `CompleteView`: the summary `<p role="status">` is fine; make sure no `role="status"` remains on a `<section>` (Task 3 already removed it; verify).
- `MyData`: the search `<p role="status" aria-label="검색 결과" aria-live="polite">` stays (it is a text-only status). The `<figure aria-label>` is fine. The `figcaption` must not repeat the boundary (Task 4).
- `HistoryGraph`: the selected-value card `role="group" aria-live="polite"` — keep `role="group"`, drop `aria-live` (a card that appears on the person's own click is not a live region; the anchor's `aria-describedby` already names it). Update `tests/measurement-history.test.tsx`: `expect(card).toHaveAttribute("aria-live", "polite")` → `expect(card).not.toHaveAttribute("aria-live")`.
- `IntegratedRecords`: the `<li tabIndex={-1}>` record rows are fine; `successMessage` `<p role="status" aria-live="polite">` stays.
- `ConnectionExperience` / `PublicProviderExplorer`: these two are not in `screens` (demo screens behind 데이터 관리 › 예시 화면); their own tests keep passing. If either source still contains a retired term (e.g. "합성"), fix the wording in place — the only sentence the existing tests pin verbatim are the ones listed in `tests/connection-experience.test.tsx` and `tests/public-provider-explorer.test.tsx`.
- Anything named "OCR"/"MyHealthWay" outside 데이터 관리: move it under that screen's `자세히`.

- [ ] **Step 3: Gates and commit**

```bash
pnpm web:test && pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json && pnpm --dir apps/web build
git checkout -- apps/web/next-env.d.ts
git add apps/web/tests apps/web/components
git commit -m "test(web): rendered-text copy scan and axe on every screen and state; status/aria-live and labelledby fixes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Browser matrix for every screen, contrast report, evidence, ledger lines

**Files:**
- Modify: `apps/web/e2e/foundation-lifecycle.spec.ts`, `docs/roadmap/2026-09-02-roadmap.md`, `PROJECT_GUIDE.md`, `AGENTS.md`, `docs/quality/accessibility-test-matrix.md`
- Create: `docs/status/2026-09-18/wave6.md`, `docs/status/2026-09-18/captures/after/*.png`, `docs/status/2026-09-18/contrast/*.json`

**Interfaces:**
- Consumes: everything.
- Produces: `contrastReport(page, info, state)` in the lifecycle (writes `contrast-<state>.json` and asserts WCAG AA per text node); the evidence document; the ledger lines.

- [ ] **Step 1: Contrast report and the full state list**

In `apps/web/e2e/foundation-lifecycle.spec.ts` add `import { writeFileSync } from "node:fs";` and, after `captureMatrix`:

```ts
/**
 * Computes the contrast of every visible text node against its first opaque ancestor background
 * (all surfaces are solid on this design), writes the table for the evidence document, and fails
 * on any line under WCAG AA (4.5:1, or 3:1 for large text) or under 12px.
 */
async function contrastReport(page: Page, info: TestInfo, state: string) {
  await page.setViewportSize({ width: 1280, height: 720 });
  const rows = await page.evaluate(() => {
    const parse = (value: string) => { const m = value.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p[3] ?? 1 }; };
    const lum = (rgb: number[]) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const bgOf = (el: Element) => { let node: Element | null = el; while (node) { const c = parse(getComputedStyle(node).backgroundColor); if (c && c.a > 0) return c.rgb; node = node.parentElement; } return [0, 0, 0]; };
    const out: Array<{ tag: string; text: string; fg: string; bg: string; ratio: number; size: number; weight: string }> = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.textContent?.trim() || el.closest("svg, [aria-hidden='true'], :disabled")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      seen.add(el);
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const [l1, l2] = [lum(fg.rgb), lum(bg)];
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      out.push({ tag: el.tagName.toLowerCase(), text: node.textContent.trim().slice(0, 40), fg: cs.color, bg: `rgb(${bg.join(", ")})`, ratio: Math.round(ratio * 100) / 100, size: Number.parseFloat(cs.fontSize), weight: cs.fontWeight });
    }
    return out;
  });
  writeFileSync(info.outputPath(`contrast-${state}.json`), JSON.stringify(rows, null, 2));
  const large = (row: { size: number; weight: string }) => row.size >= 24 || (row.size >= 18.66 && Number(row.weight) >= 700);
  expect(rows.filter((row) => row.ratio < (large(row) ? 3 : 4.5)), `${state}: text under WCAG AA`).toEqual([]);
  expect(rows.filter((row) => row.size < 12), `${state}: text under 12px`).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
}
```

Call `await contrastReport(page, info, state);` as the last line inside `captureMatrix` (before `await page.setViewportSize({width: 390, height: 844});`), so every captured state is also a contrast table. The states captured after Tasks 2–6 are: `entry`, `home`, `import-source`, `import-status`, `review`, `import-complete`, `my-data`, `history`, `records`, `prepare`, `connections`, `providers`, `data-control`. Add the consent stage: right after `await expect(page).toHaveURL(/\/import\/consent$/);` insert `await captureMatrix(page, info, "import-consent");`.

- [ ] **Step 2: Run every gate**

```bash
export PATH="$HOME/.gc-node24:$PATH"
export GC_TEST_POSTGRES_URL='jdbc:postgresql://127.0.0.1:5432/gc_test'
export GC_TEST_QUARANTINE_ROOT='C:/gc-synthetic-test/quarantine'
pnpm security:runtime-policy
pnpm release:readiness:validate
pnpm auth-security:gate
pnpm security:github-actions-policy
pnpm --filter @gc/design-tokens test
pnpm web:test
pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json
pnpm --dir apps/web build
pnpm foundation:e2e
git checkout -- apps/web/next-env.d.ts
git diff --quiet $(git merge-base HEAD codex/wave11-alive-home) -- release/readiness.json && echo "readiness unchanged"
```
Expected: every line PASS / green; `3 passed`; `readiness unchanged`.

- [ ] **Step 3: Collect the after-captures and the contrast tables**

```bash
mkdir -p docs/status/2026-09-18/captures/after docs/status/2026-09-18/contrast
for state in entry home review my-data history records prepare data-control; do
  for size in 320x720 1280x720; do
    find apps/web/test-results -name "${state}-${size}.png" -exec cp {} "docs/status/2026-09-18/captures/after/${state}-${size}.png" \;
  done
done
find apps/web/test-results -name 'contrast-*.json' -exec cp {} docs/status/2026-09-18/contrast/ \;
ls docs/status/2026-09-18/captures/after | wc -l      # expected: 16
ls docs/status/2026-09-18/contrast | wc -l            # expected: 14
```

- [ ] **Step 4: Evidence document**

Create `docs/status/2026-09-18/wave6.md` with this structure, filling every `<…>` from the actual runs (never from memory; a gate that was not run says "not run"):

```markdown
# Wave 6 evidence — design system (2026-09-18)

Branch `codex/wave12-design-system` (stacked on `codex/wave11-alive-home`). Synthetic only. Release remains NO_GO; `release/readiness.json` unchanged. No gate document: visual, structural and copy changes only (spec `docs/superpowers/specs/2026-09-18-wave6-design-system-design.md`); value meaning, direction and judgement stay prohibited and the tokens test, the rendered-text scan and the lifecycle assert it.

## What exists now

- **One language.** Palette in `packages/design-tokens/tokens.json` (black canvas, cream ink, 1px rules, emblem red for the logo only, time gradient with a muted end); web compositions in `apps/web/styles/tokens.css`; the primitive layer `apps/web/styles/system.css`; every screen in its own CSS module. `globals.css`, Tailwind and the "studio refresh" layer are gone. Radius 0 everywhere but the patch (10px). One breakpoint scale (42rem / 56rem).
- **Fonts.** Pretendard Variable (dynamic subset), IBM Plex Mono 400/500/600, Noto Serif KR 400 (<N> vendored woff2 slices) and Pixelify Sans (variable, Latin) — all bundled; sources and licences under `apps/web/public/fonts/*/SOURCE.md` and `LICENSE` (OFL-1.1). Zero third-party font requests (asserted in `tests/font-bundle.test.ts`).
- **Navigation.** One header with 홈 · 나의 데이터 · 측정 이력 · 내 기록 · 진료 준비 · 데이터 관리; a fixed five-item bottom bar under 42rem that never covers a CTA (asserted at 320/390/430).
- **Import flow at URLs.** `/import/consent|source|status|review` over one `useExperienceState` hook mounted by `app/import/layout.tsx`; "이전" walks the stages, browser back never leaves mid-review; the home resumes with "이어서 확인".
- **Screens.** 나의 데이터 (14px minimum cells in a scrolling canvas, card list under 42rem, empty state with preview), 측정 이력 (bundled serif/pixel faces, muted gradient end, "색은 시간" legend), 내 기록 (no KPI panel, no server-speak), 데이터 관리 (consent controls first, exports from `client.ts` constants, system explanations under 자세히, demo links last), 진료 준비 (patch cover).
- **Hero.** Fills its stage (viewBox follows the stage aspect), every node inside the frame, labels 12px with a black halo, no reparenting, one `getTotalLength` per frame, reduced motion read synchronously.
- **Copy.** First sentence is the action; one boundary caption per screen; terms 결과지/항목/값/검사일/출처/확인; retired terms listed in `apps/web/lib/copy/terminology.ts` and rejected by the rendered scan on every screen and state.
- **Tests.** <N> vitest files / <N> tests; axe on every screen × {empty, filled, error}; the browser lifecycle captures 14 states × 7 viewports, asserts geometry (overflow, targets, bar, cells, hero frame) and contrast, never pixels (decision 3 of the plan).

## Evidence (local, 2026-09-18)

| Gate | Result |
|---|---|
| `pnpm security:runtime-policy` | <paste last line> |
| `pnpm release:readiness:validate` | <paste last line; verdict unchanged> |
| `pnpm auth-security:gate` | <paste> |
| `pnpm security:github-actions-policy` | <paste> |
| `pnpm --filter @gc/design-tokens test` | <paste> |
| `pnpm web:test` | <Test Files N passed / Tests N passed> |
| `pnpm --dir apps/web exec tsc --noEmit -p tsconfig.json` | clean |
| `pnpm --dir apps/web build` | <routes listed incl. /import/*> |
| `pnpm foundation:e2e` | <3 passed (time)> |
| `git diff --quiet … release/readiness.json` | readiness unchanged |

`apps/web/next-env.d.ts` was regenerated by `next build`/`next dev` and restored after each run; never staged.

## Before / after captures

`captures/before/` (alive-home tree, Task 1 Step 0) and `captures/after/` (this branch): entry, home, review, my-data, history, records, prepare, data-control at 320×720 and 1280×720. Full 14-state × 7-viewport matrices are in the CI artifact `foundation-browser-evidence`.

## Contrast

Per-state tables in `contrast/contrast-<state>.json` (every visible text node: colour, background, ratio, size, weight; computed by `contrastReport` in the lifecycle). Minimum ratios per state:

| State | Lowest text ratio | Where | Non-text (rules on black) |
|---|---|---|---|
| entry | <n> | <element/text> | 1px rgba(255,255,255,.28) on #000 ≈ 1.9:1 — rules are decorative; every control has a ≥3:1 border (`--gc-color-line-strong` ≈ 4.4:1) |
| … one row per state … |

## Unreferenced CSS

`css-coverage-before.json`: <N> unreferenced classes (families: <list>). `css-coverage-after.json`: 0. `tests/css-coverage.test.ts` keeps it at 0.

## Copy map applied

<paste the RETIRED_TERMS table and the per-task "Copy this task changes" rows as one table: old → new → screen>

## Limits

No hosted run. Contrast is computed from computed styles on solid backgrounds; the hero's SVG text is excluded (white on black, 12px, halo). Pixel baselines were deliberately not added (plan decision 3). The two demo screens (`/connections`, `/providers`) were re-tokened but not redesigned; they remain reachable only from 데이터 관리 › 예시 화면. The founder's no-regulatory-review judgement applies to synthetic staging only.
```

- [ ] **Step 5: Ledger lines**

`docs/roadmap/2026-09-02-roadmap.md` — add after the A14 row:

```markdown
| A15 | Design system: one dark token language, six-destination shell with a five-item mobile bar, URL-backed import flow over one hook, dead concept components and Tailwind removed, bundled OFL display faces, rendered-text copy scan and axe on every screen and state | `docs/status/2026-09-18/wave6.md` | implemented locally |
```

`PROJECT_GUIDE.md` — in the §2 "Korean consumer web" row append: `Since Wave 6 every screen shares one dark token language and one navigation, the import flow lives at `/import/*`, and copy/a11y are asserted on the rendered screens (`docs/status/2026-09-18/wave6.md`).` and in the responsibility table's "Design primitives" row append: `(dark palette since Wave 6; web compositions in `apps/web/styles/tokens.css`)`.

`AGENTS.md` — in "Boundaries that end a task", extend the diagnosis bullet with: `Colour, size, weight, speed or direction that varies with a health value anywhere in the UI: stop (the time gradient means time only; red is the emblem only — `docs/status/2026-09-18/wave6.md`).`

`docs/quality/accessibility-test-matrix.md` — the "Contrast" row: `| Contrast | computed per text node in the browser lifecycle (`contrastReport`, AA thresholds) | high-contrast/forced-colors review | AUTOMATED (AA), forced-colors MANUAL PENDING |`.

- [ ] **Step 6: Commit and hand off**

```bash
git add apps/web/e2e/foundation-lifecycle.spec.ts docs/status/2026-09-18 docs/roadmap/2026-09-02-roadmap.md PROJECT_GUIDE.md AGENTS.md docs/quality/accessibility-test-matrix.md
git commit -m "docs: Wave 6 evidence — captures, contrast tables, unreferenced-CSS report, ledger lines

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git log --oneline codex/wave11-alive-home..HEAD    # expected: 9 commits (spec + 8 tasks)
git status --porcelain                            # expected: empty
```

Then push `codex/wave12-design-system` and open the PR against `codex/wave11-alive-home` (stacked) with the PR body ending in `🤖 Generated with [Claude Code](https://claude.com/claude-code)`; CI (`genome-companion-ci`) must be green before any merge.

---

## Spec coverage (self-review)

| Spec item | Task |
|---|---|
| §1 boundary (no value encoding, no judgement words, no ranges) | tokens test (T1), rendered scan + judgement list (T7), lifecycle `120-199`/arrow checks (T3, T8), `--gc-color-status-danger` never used (T5) |
| §2 tokens, grid, fonts bundled, motion presets, dark overrides removed | T1 (tokens, fonts, springs), T2 (`AliveShellTone` deleted), T4 (History module tokens removed) |
| §3 patch badge (wordmark, badge, empty state, 진료 준비 cover; CSS texture only) | T1 (`Patch`), T2 (header/status), T4 (`EmptyState`, prepare cover) |
| §4 header with every destination, five-item mobile bar, home unchanged, empty states with next action + preview | T2, T4 |
| §5 action-first copy, system notes under 자세히, one boundary caption, unified terms, 체험 only on start | T2 map, T3/T4 copy rows, T7 rendered scan |
| §6 split into views + one hook; globals → tokens/modules + coverage report; hero engine (length once, labels in node groups, still frame first); behaviour tests + axe everywhere | T3, T5, T6, T7 |
| §7 evidence (captures before/after, contrast table, unreferenced CSS, gates, status doc; readiness unchanged) | T1 Step 0, T5, T8 |
| §8.1 hero geometry/labels/no empty phase/fill stage/nodes inside/first frame | T6 (`currentPhaseIndex` removed in T3) |
| §8.2 example items backend-producible; 직접 확인함 only on real records | already lab/vital only (asserted by `alive-trajectory-component` labels); T3 `rowState` |
| §8.3 one language for shell/buttons/records/data-control/review; `.gc-button` once; studio layer and Tailwind gone; one breakpoint scale | T1 (`system.css`), T4, T5 |
| §8.4 import flow in shell + URLs; 이전 never bounces home; back stays in flow | T3 (decision 4) |
| §8.5 mobile bar five items, never covers CTA/body | T2 (+ geometry assertion) |
| §8.6 fonts bundled or unnamed; one mono stack; no uppercase/tracking on Korean; `body letter-spacing` gone | T1, T5 contract |
| §8.7 split; dead components/stories deleted; `IntegratedRecords` own module | T3, T4 (`Records.module.css`), T5 |
| §8.8 rendered-text tests; captures asserted (geometry, decision 3); status/aria-live cleanup; labelledby on roles; decorative nav removed; reduced-motion sync | T7, T8, T6, T1 |
| §8.9 no `→` in `RecordComparison`; gradient end muted + "색은 시간" legend | asserted T4/T7; T4 |
| §8.10 `getTotalLength` once/frame; no reparenting; `HistoryGraph` observer guard; Pretendard subset | T6, T4, T1 |
| §8.11 system explanations to 자세히; KPI panel and big numerals removed; titles unified | T4, T2 (`SCREEN_TITLES`) |
| §8.12 demo links secondary, consent first | T4 |
| §8.13 example sheets primary, file picker secondary | T3 (`SourceView`) |
| §8.14 `/my-data` cell minimum, search cards at 390 | T4 |
| §8.15 export URLs as `client.ts` constants; "0곳 외부 연결"/"OCR·의료 AI" only on 데이터 관리 | T4, T7 scan |
| §9 out of scope (light theme, API change, real profile, LLM) | none touched |
