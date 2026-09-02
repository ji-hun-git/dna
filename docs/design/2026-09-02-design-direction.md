# Design direction — integrated synthetic screens

**Date:** 2026-09-02 · **Scope:** `apps/web` integrated views only. Presentation, no data flow.

## 1. The system we already have

`packages/design-tokens/tokens.json` is the source: zinc neutrals (`#FAFAFA` canvas, `#18181B`
brand, `#52525B` secondary text), teal `verified` `#007F7B`, red `danger`, amber `warning`,
grey `unknown`, focus ring `#3182F6`, Pretendard for text, IBM Plex Mono for digests and server
status words, a 4→48px space scale, radii 10/20/pill, 100/180ms motion, and a 44px minimum
target. `app/globals.css` consumes them as `--gc-*` variables behind BEM-ish `gc-*` classes.
Status colour is reserved for **server state**, never for a health value; that holds today and
must keep holding.

## 2. Where the integrated screens drift

1. **Four different app bars.** `gc-health-home__appbar`, the `HealthTimeline.module.css`
   `.appbar` reused by `IntegratedRecords`, `gc-data-control__appbar`, and no bar at all on
   `/prepare`. Three different nav treatments, two brand chip sizes, two brand hrefs (`#home`
   vs `/`).
2. **`진료 준비` is unreachable from navigation.** Only the completion screen links to it.
3. **Nav targets are ~38px tall**, under the 44px token.
4. **`/prepare` contrast:** `.gc-prepare__value span` `#707987` on white is 4.27:1 and
   `.gc-prepare dt` `#74746f` is 4.70:1 — one fails AA, one is on the line.
5. **The import brand mark is unstyled.** `CandidateReview`/source/processing render a bare
   `<span>앎</span>`, but `.gc-import__appbar` only styles `a > span`.
6. **Print** hid the home bar and prepare actions only; nothing else.
7. **Under 42rem the home nav disappears entirely** with no replacement.

## 3. Component inventory

| Component | Role | State |
|---|---|---|
| `IntegratedHealthExperience` | shell + home/consent/source/processing/complete | owns all data |
| `CandidateReview` | one candidate, `n / N` progress | presentational |
| `IntegratedRecords` | records by date and document | owns data |
| `VisitPreparation` | printable question list | presentational |
| `IntegratedVisitPreparation` | loads records for the sheet | owns data |
| `IntegratedDataControl` | consent and deletion state | owns data |
| `IntegratedShell` *(new)* | brand, four-item nav, status pill | presentational |

## 4. Bounded changes applied

- Added `IntegratedShell`; replaced the duplicated headers on home, records, data control, and
  added one to the prepare wrapper. Four links, `aria-current="page"`, one status pill.
- New `.gc-shell*` rules: 44px nav and brand targets, focus ring from `--gc-color-focus-ring`,
  nav stays visible and scrolls instead of disappearing on small screens.
- Kept the `/connections` link by moving it into the data-control 외부 연결 card.
- `.gc-review-progress` is now a neutral zinc pill with tabular numerals; `.gc-review-summary`
  uses tabular numerals; record group headings get a divider and breathing room.
- Contrast: `/prepare` unit and term text moved to `--gc-color-text-secondary` (7.7:1).
- Styled the import brand mark; print now hides the shell, both nav bars and every action row.
- Added `tests/integrated-shell.test.tsx` (route contract plus jest-axe) and Storybook stories
  for `CandidateReview` (pending, correcting, last of three) and `VisitPreparation` (two records,
  empty).

## 5. Left for later

Mobile bottom navigation for the integrated home; unifying `HealthTimeline.module.css` and
`gc-data-control__*` onto the shared surface tokens; the hard-coded hex values still scattered
through `globals.css`; 400% zoom and screen-reader passes named in the release ladder.
