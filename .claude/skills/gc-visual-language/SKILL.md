---
name: gc-visual-language
description: Use when designing or restyling any 앎 screen, component, mockup or hero — the founder-approved visual language (dark ground, ruled panels, mono metadata, patch badge, time-colour ribbons, orthogonal wiring), the reference sets behind it, and the safety rules that no visual choice may break.
---

# 앎 visual language

## Overview

The founder chose the direction from four reference sets (2026-09-17/18) and approved two mockups. This skill is the durable record so the massive front-end update starts from the same place. The spec for the update is `docs/superpowers/specs/2026-09-18-wave6-design-system-design.md` (plan beside it).

## Reference sets (descriptions; images are not stored)

1. **Refold ribbons** — light dotted grid, flowing ribbons blue→teal→lime with a dashed centre line merging into one trunk, serif headline with one blue line, pixel numerals, uppercase mono labels, beige annotation cards on square anchors with leader lines. Approved for the 측정 이력 pilot (mockup `.superpowers/sdd/wave4-mockup.html` if present, decision notes `wave4-mockup-decision.md`).
2. **Ryvn wiring** — orthogonal wiring diagram with square nodes and X markers, black mono label chips with white uppercase text, numbered section markers `01 [MISSION]`, bold grotesque statement; dark variant with a white isometric wireframe network.
3. **Dark dashboards + TRAJECTORY** — near-black product dashboards (rounded dark cards, big numerals, mono labels, sparklines, dashed average line with a chip, hover tables), a "1 square = 1 person" waffle, the founder's sketch of a path with elliptical orbits carrying boxes, and the pitch-black landing prompt (coordinate grid, mono labels, spring physics "Apple timer drum smooth").
4. **Embroidered patch** — black woven ground, cream stitched mono uppercase, slash-separated metadata (`UNIT / FL-04`), rounded patch border with an inner rule, one red emblem, two-line slogan.

Founder verdicts: dark everywhere (2026-09-18); the trajectory is a **horizontal** living time axis, never an upward arc, no arrowhead or target; the profile panel stays (future home of the person's own profile); the 2026-09-16 dark gradient mockup was rejected as "too AI-like".

## Tokens (from the approved mockups; make these the global tokens)

- Ground `#000000`; panel `#0b0b0b`; rule `rgba(255,255,255,.28)`; ink `#f4f1e8`; soft ink `rgba(244,241,232,.62)`; emblem red `#e0231c` (identity only).
- Time gradient `#1f5bff` → `#35c6b4` (55%) → `#6fe06a` (80%) → `#c8f02a`; lime is fill only (fails text contrast).
- Grid 40px at `.07`, 200px at `.14`. Panels: 1px rules, radius 0; only the patch badge is rounded (10px).
- Type: Pretendard Variable (body), IBM Plex Mono (Latin/numerals/metadata only), Noto Serif KR (display), Pixelify Sans (figures). Bundle every named face under `apps/web/public/fonts` with its OFL licence via `next/font/local`; never a runtime request to a font host; **never `text-transform: uppercase` or letter-spacing on Hangul**.
- Motion presets in `apps/web/lib/home/alive-trajectory.ts`: PICKER m0.8 k260 c34 (drum snap), DRIFT m1.4 k36 c15 (orbits), BREATH m2.0 k18 c9 (path); wheel = momentum → snap to detent; `prefers-reduced-motion` = complete still frame, decided synchronously from `matchMedia` before the first render.

## Safety rules a visual choice may never break (PROJECT_GUIDE §6, intended-use decisions)

- Colour, size, weight, speed, direction, ordering and motion never encode a value or a judgement. Colour = position in time or identity. No arrows, no up/down glyphs (`↑↓▲▼→←` are banned by the copy scan), no reference bands, no fitted lines, no projections.
- Phases are dates (`2026. 1. 15. 검진`, `다음 결과지`), never conditions or life stages.
- Example data is labelled 예시 and uses no real-looking names or institutions. Only items the backend can produce appear as "직접 확인함".
- The boundary sentence appears once per screen: `선의 모양과 움직임은 건강 상태를 뜻하지 않아요.` (hero) / `값의 의미나 변화의 방향은 판단하지 않아요.` (data screens).
- Everything survives 320px under Linux fonts (`minmax(0,1fr)`, `min-width:0`, `overflow-wrap:anywhere`, table wrappers); the e2e `captureMatrix` names offending elements.

## Workflow for any screen

1. Start from the tokens above; read the Wave 6 spec §8 list before touching a screen it names.
2. Mockup first for a new composition (publish an artifact, get the founder's verdict, record it under `.superpowers/sdd/`), then implement with `gc-safe-change` and `gc-korean-copy`.
3. Show the page complete at rest (no draw-in from zero, no observer-gated first frame).
4. Verify with the Playwright captures at all seven viewports and open them with the Read tool; never trust jsdom for layout.
