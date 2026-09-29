# 앎 product UI contract

The live product uses one light working surface. A route is a different task within the same product, not a new visual theme. This contract applies to `apps/web` live routes, including entry and focused document review. Isolated concept stories are not product navigation.

## Navigation

Primary destinations, in the same order on every shell: **홈 → 나의 데이터 → 진료 준비 → 데이터 관리**. Desktop places them in a 196px left navigation rail; widths up to 800px use four bottom destinations with room reserved below the content. The current destination has a written label, icon and `aria-current`.

The data section always offers **한눈에 보기 → 기록 목록 → 측정 이력**. Each has its own active state. The overview and item history are views of confirmed records, not different data products. Upload starts from home; empty-state copy must lead there. Document selection/review is a focused task with explicit previous/close controls and a consistent surface, rather than a second navigation system.

## Visual source of truth

- `apps/web/app/product.css` owns the live product palette, 68rem maximum content width, 16–32px page gutter, heading scale, shared cards and controls. It is scoped to the product body; presentation tokens carry no health interpretation.
- `IntegratedShell` owns primary navigation and record-view navigation. Do not recreate menus per route.
- Route headers use `gc-page-heading`; content wrappers use `gc-page-content` (or the existing centrally mapped management/preparation wrappers).
- Body text uses the shared sans-serif family. Monospaced text is reserved for values and identifiers. Use the shared warm-white canvas, ink text and restrained olive accent. A page must not introduce a competing visual theme.
- Home prioritizes the record ledger and source-document counts. A decorative graph or invented profile must not occupy the main workspace. Actions come first in mobile reading order. Errors and controls use the same light surface as the other pages, with a minimum 44px target.
- Graph colour meanings, original text, confirmation controls and server-owned state remain governed by the existing intended-use and authorization rules.

## Review before shipping

Run the web tests/build and real foundation browser suite. The existing capture matrix checks seven widths (320–1920px), all four navigation targets, page overflow, shared backgrounds, and the visible upload/review controls. Inspect mobile and desktop captures of different routes together. Keyboard/reflow tests are not a real screen-reader audit.

Keep errors readable on their actual background, retain reduced-motion support, and preserve the clean printable visit sheet. Changes to one screen must not add a route-specific theme that breaks the next screen in the journey.

## Reference-led direction (2026-09-29)

See [reference study](reference-study-2026-09-29.md) for inspected sources, adopted principles and rejected patterns. Use space, type and fine separators to establish hierarchy; cards are reserved for grouped tasks rather than wrapping every paragraph. Counts reflect stored records, never health scores. The signed-out example ledger must be explicitly labelled and must not leak into an authenticated empty state.
