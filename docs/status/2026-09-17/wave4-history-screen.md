# Wave 4 follow-up evidence — 측정 이력 screen (2026-09-17)

Branch `codex/wave9-history-screen`, stacked on PR #12. Synthetic only. Release remains NO_GO; `release/readiness.json` is unchanged. This note supersedes the "parked" statements in `docs/status/2026-09-17/wave4.md` for the screen only; everything else in that document stands.

## Why it was parked and what changed

Wave 4 shipped the series API and parked the screen until the founder had looked at a mockup. Asked "측정 이력 목업을 보셨나요?", the founder answered **"이 방향으로 구현"** (mockup: https://claude.ai/artifact/ApGNxjRga5x2jXg5dWASPq). The screen is built under `governance/intended-use-decision-measurement-history-2026-09-17.md` (gate (c): history, three computed numbers, a plain graph of the person's own values).

## What exists now

- **Route `/my-data/history`**, reached from a "측정 이력" link at the top of 내 데이터 and from "이 항목의 측정 이력 보기" in the evidence drawer (`/my-data/history#event-<id>` scrolls to and focuses that series). "출처 보기" links back to `/my-data#event-<id>`, which opens that event's drawer. Global navigation keeps its two destinations. Next.js gained no API route, token or authorization rule.
- **Graph rules.** Pure geometry in `apps/web/lib/my-data/history-layout.ts`: the y scale is the series' own minimum to maximum (an all-equal series is one flat line); points are joined by straight segments only; ribbon width is fixed; ticks sit only at real exam dates. One page-wide date domain drives every series' x positions, the gradient and the time bar, so the same date has the same position and colour in every series. Colour means position in time only. When anchors are nudged apart the screen says so. A series with one point, or with any non-numeric value, draws no graph and shows the table with a sentence saying why.
- **Three numbers** from the API, shown as numbers and units only: "마지막 두 값의 차이", "30일로 환산한 차이", "최근 3회 평균". A missing number shows its specific reason, decided from the points: fewer than two measurements, a same-day pair, a gap under 30 days, or fewer than three measurements.
- **Always on the page:** "직접 확인한 값을 검사일 순서로 모았어요. 점은 확인한 값이고, 점 사이의 선은 값이 아니에요." and "선의 모양이 건강 상태를 뜻하지 않아요. 색은 시간의 위치만 나타내요."; under the numbers "뺄셈과 나눗셈으로만 계산했어요. 의미는 판단하지 않아요."
- **Accessibility.** Anchors are keyboard-focusable buttons named "검사일 값 단위"; selecting one shows an annotation card that is announced politely; the same values are in a table under every series; the ink centre line and black anchors carry non-text contrast, the coloured ribbon is decorative; the screen has no motion.
- **Pilot isolation.** The visual tokens (dotted ground, ink, rule, card, time gradient, serif and mono stacks) are scoped to this screen's CSS module. No global style, dependency or font file changed.

## Evidence (local, 2026-09-17)

| Gate | Result |
|---|---|
| web:test | 52 files / 339 tests passed |
| tsc --noEmit | clean |
| apps/web build | compiled; `/my-data/history` listed |
| foundation:e2e | 3 passed, including the 측정 이력 steps (series headings, three numbers, table, anchor name, annotation card, drawer round trip, `120-199` absent) and the screen in the 320px overflow matrix |

Core, worker and benchmark code are untouched on this branch.

## Review

One implementation task with a combined task and whole-branch review. Two fix rounds: the ribbon first used a colour per series instead of the approved shared time gradient; then the review found that the "line is not data" sentence could disappear, that colour and x were relative to each series instead of the page, that an unparsable value was skipped silently, and that several approved strings were not verbatim. All are fixed with tests.

## Limits

- **Fonts are not bundled.** The approved mockup uses a Korean serif and a pixel numeral face. This branch adds no font files, so titles fall back to the system serif and figures to the app's existing mono face. Self-hosting the two faces (both OFL) belongs to the app-wide rollout.
- The graph is a display of the person's own confirmed values. It makes no statement about direction, speed or meaning, shows no reference band, fitted line or projection, and the founder's no-regulatory-review judgement applies to synthetic staging only and must be revisited before real PHI.
- Series grouping still inherits the concept catalogue's loose aliases until the concept-accuracy wave lands.
- No hosted run.
