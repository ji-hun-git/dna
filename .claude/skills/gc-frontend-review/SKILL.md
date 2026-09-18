---
name: gc-frontend-review
description: Use when reviewing, auditing or planning changes to apps/web — the adversarial checklist distilled from the 2026-09-18 front-end critique (visual consistency, IA, accessibility, code structure, performance, product truth) and the exact evidence to collect before calling a screen done.
---

# Front-end review checklist (앎)

Run this before opening a PR that touches `apps/web`, and as the brief for any reviewer agent. Findings need file:line or a capture filename plus a concrete user-visible failure.

## Evidence to collect first

- `pnpm foundation:e2e` captures for every state at 7 viewports (`apps/web/test-results/**/<state>-<w>x<h>.png`); open them with the Read tool. Screenshots are the ground truth; jsdom is not.
- `pnpm web:test`, `tsc --noEmit`, `next build`, axe on every state, the copy scan.

## 1 Visual consistency
- One system: dark tokens from `gc-visual-language`; no screen keeps its own palette, radius or font stack. Grep for hard-coded hex, `border-radius`, duplicated `.gc-*` selectors, per-screen `@font-face`.
- Hangul never uppercase/letter-spaced; no negative tracking on body.
- The stage fills its column (no letterboxed box with dead space); labels ≥ 12px on screen at 1440 and legible at 768.
- Nothing looks templated: no rounded-card grid with identical eyebrows/chips repeated per card.

## 2 UX / IA
- Navigation shows every destination; active state matches the page title; mobile bar has as many cells as items and never covers a CTA (320/390).
- Every empty state = next action + preview; no dead ends; "이전" goes to the previous step, not home; multi-step flows live in the URL so browser Back works.
- Copy: first sentence is the user's action; system explanations (quarantine, digests, server states) live under `자세히`; boundary sentence once per screen.
- Button hierarchy: one primary per screen; example actions before a generic file picker.

## 3 Accessibility
- Accessible names must not contradict the boundary (no "위로", no direction words).
- `role="status"`/`aria-live` only on short messages, never on whole sections; `aria-labelledby` only on elements with a role; no decorative `<nav>`.
- Focus order and visible focus; no `outline: 0`; sub-12px text is a finding.
- Reduced motion: initial value decided synchronously; still frame complete; no flash of motion.

## 4 Code structure
- No component over ~300 lines holding a view state machine; views are components; state in a typed union.
- Dead components/stories deleted, not kept alive by tests; CSS modules own their rules; globals hold tokens and resets only; one breakpoint scale; no unused framework imports (Tailwind).
- No side effects inside state updaters; no setState during render; stable React keys.

## 5 Performance
- Animation loops: one measurement per frame at most, no reparenting per frame, attribute writes batched, pause when hidden but never before the first complete frame.
- Fonts bundled and subset; no ResizeObserver → setState feedback loops.

## 6 Product truth
- Nothing on screen reads as a health judgement (rising path, green/red deltas, grades, "stable"); phases are dates.
- UI only claims what the backend does (no demo buttons above real controls; export links as constants in `client.ts`).
- Tests assert rendered behaviour, not source strings; captures asserted or at least reviewed; the copy scan stays as a safety net.

## Output format for reviewers
Group by the six headings, rank Critical / Important / Minor, end with a top-10 fix-first list and one paragraph on the biggest structural mistake.
