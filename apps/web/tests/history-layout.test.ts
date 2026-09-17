// @vitest-environment node
import { describe, expect, it } from "vitest";
import { HISTORY_LAYOUT_DEFAULTS, layoutHistory, parseHistoryValue, type HistoryPointInput } from "@/lib/my-data/history-layout";

const point = (index: number, value: string, observedOn: string): HistoryPointInput => ({
  eventId: `8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c${String(4000 + index)}`, value, observedOn,
});
const at = (width: number) => ({ ...HISTORY_LAYOUT_DEFAULTS, width });
const three = [point(1, "194", "2026-01-15"), point(2, "188", "2026-04-15"), point(3, "190", "2026-07-28")];
const crowded = [point(1, "5.4", "2026-01-15"), point(2, "5.2", "2026-07-27"), point(3, "5.3", "2026-07-28")];
const monthly = Array.from({ length: 12 }, (_, index) => point(index, String(180 + index), `2026-${String(index + 1).padStart(2, "0")}-10`));
const daily = Array.from({ length: 14 }, (_, index) => point(index, String(100 + (index % 3)), `2026-07-${String(index + 1).padStart(2, "0")}`));

describe("history layout", () => {
  it("parses plain numbers and thousands commas, nothing else", () => {
    expect(parseHistoryValue("194")).toBe(194);
    expect(parseHistoryValue("6,200")).toBe(6200);
    expect(parseHistoryValue("-0.5")).toBe(-0.5);
    expect(parseHistoryValue("음성")).toBeNull();
    expect(parseHistoryValue("1e3")).toBeNull();
  });

  it("scales y to the series' own minimum and maximum only", () => {
    const layout = layoutHistory(three, at(720));
    const { height, paddingY } = HISTORY_LAYOUT_DEFAULTS;
    expect(layout.drawable).toBe(true);
    expect(layout.flat).toBe(false);
    expect([layout.min, layout.max]).toEqual([188, 194]);
    expect(layout.anchors.map((anchor) => anchor.value)).toEqual(["194", "188", "190"]);
    expect(layout.anchors[0].y).toBe(paddingY);                    // own maximum at the top
    expect(layout.anchors[1].y).toBe(height - paddingY);           // own minimum at the bottom
    expect(layout.anchors[2].y).toBeCloseTo(paddingY + ((194 - 190) / 6) * (height - 2 * paddingY), 1);
  });

  it("draws a flat middle line when every value is equal and nothing for fewer than two numeric points", () => {
    const flat = layoutHistory([point(1, "5.2", "2026-01-15"), point(2, "5.2", "2026-07-28")], at(375));
    expect(flat.flat).toBe(true);
    expect(new Set(flat.anchors.map((anchor) => anchor.y))).toEqual(new Set([HISTORY_LAYOUT_DEFAULTS.height / 2]));

    for (const points of [[], [point(1, "194", "2026-01-15")], [point(1, "194", "2026-01-15"), point(2, "음성", "2026-07-28")]]) {
      const none = layoutHistory(points, at(375));
      expect(none).toMatchObject({ drawable: false, anchors: [], segments: [], ticks: [], path: "", adjusted: false, min: null, max: null });
    }
    // Any non-numeric value anywhere in the series: no plot at all, not a line silently drawn
    // across the gap where that value should have been.
    expect(layoutHistory([...three, point(4, "음성", "2026-08-01")], at(720)))
      .toMatchObject({ drawable: false, anchors: [], segments: [], ticks: [], path: "" });
  });

  it("joins neighbouring anchors with straight segments only", () => {
    const layout = layoutHistory(three, at(720));
    expect(layout.segments).toHaveLength(2);
    layout.segments.forEach((segment, index) => {
      expect([segment.x1, segment.y1]).toEqual([layout.anchors[index].x, layout.anchors[index].y]);
      expect([segment.x2, segment.y2]).toEqual([layout.anchors[index + 1].x, layout.anchors[index + 1].y]);
    });
    expect(layout.path).toMatch(/^M-?[\d.]+,-?[\d.]+( L-?[\d.]+,-?[\d.]+)+$/);
    expect(layout.path).not.toMatch(/[CQSTAcqsta]/);
  });

  it.each([320, 375, 1280])("keeps every anchor's hit box inside the %ipx drawing and apart from its neighbours", (width) => {
    for (const points of [three, crowded, monthly, daily]) {
      const layout = layoutHistory(points, at(width));
      const half = HISTORY_LAYOUT_DEFAULTS.hitSize / 2;
      for (const anchor of layout.anchors) {
        expect(anchor.x - half).toBeGreaterThanOrEqual(0);
        expect(anchor.x + half).toBeLessThanOrEqual(width);
        expect(anchor.y - half).toBeGreaterThanOrEqual(0);
        expect(anchor.y + half).toBeLessThanOrEqual(HISTORY_LAYOUT_DEFAULTS.height);
      }
      const xs = layout.anchors.map((anchor) => anchor.x);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
      const inner = width - 2 * HISTORY_LAYOUT_DEFAULTS.paddingX;
      if ((points.length - 1) * HISTORY_LAYOUT_DEFAULTS.minGap <= inner) {
        for (let index = 1; index < xs.length; index += 1) expect(xs[index] - xs[index - 1]).toBeGreaterThanOrEqual(HISTORY_LAYOUT_DEFAULTS.minGap - 0.01);
      }
    }
  });

  it("places x by exam date and says when it had to nudge a point", () => {
    const wide = layoutHistory(three, at(1280));
    const { paddingX } = HISTORY_LAYOUT_DEFAULTS;
    expect(wide.adjusted).toBe(false);
    expect(wide.anchors[0].x).toBe(paddingX);
    expect(wide.anchors[2].x).toBe(1280 - paddingX);
    // 2026-01-15 → 04-15 is 90 of 194 days.
    expect(wide.anchors[1].x).toBeCloseTo(paddingX + (90 / 194) * (1280 - 2 * paddingX), 1);

    expect(layoutHistory(crowded, at(320)).adjusted).toBe(true);   // 07-27 and 07-28 would overlap
    const sameDay = layoutHistory([point(1, "1", "2026-07-28"), point(2, "2", "2026-07-28")], at(320));
    expect(sameDay.adjusted).toBe(true);
    expect(sameDay.anchors[1].x).toBeGreaterThan(sameDay.anchors[0].x);
  });

  it("puts axis ticks only at real exam dates and always labels the first and the last", () => {
    const layout = layoutHistory(monthly, at(320));
    expect(layout.ticks.map((tick) => tick.observedOn)).toEqual(monthly.map((item) => item.observedOn));
    expect(layout.ticks[0].labelled).toBe(true);
    expect(layout.ticks[layout.ticks.length - 1].labelled).toBe(true);
    const labelled = layout.ticks.filter((tick) => tick.labelled).map((tick) => tick.x);
    for (let index = 1; index < labelled.length; index += 1) expect(labelled[index] - labelled[index - 1]).toBeGreaterThanOrEqual(HISTORY_LAYOUT_DEFAULTS.minLabelGap);
    const sameDay = layoutHistory([point(1, "1", "2026-07-28"), point(2, "2", "2026-07-28")], at(320));
    expect(sameDay.ticks).toHaveLength(1);
  });

  it("is deterministic and independent of input order", () => {
    expect(layoutHistory(crowded, at(320))).toEqual(layoutHistory(crowded, at(320)));
    expect(layoutHistory([...monthly].reverse(), at(375))).toEqual(layoutHistory(monthly, at(375)));
  });

  it("keeps same-day points in the server's input order, not sorted by event id", () => {
    // eventId "…4001" would sort before "…4002" alphabetically; input order says the other way.
    const points = [point(2, "2", "2026-07-28"), point(1, "1", "2026-07-28")];
    const layout = layoutHistory(points, at(320));
    expect(layout.anchors.map((anchor) => anchor.value)).toEqual(["2", "1"]);
  });

  it("shares one x domain across every series on the page, so the same date is the same x fraction everywhere (I2)", () => {
    for (const width of [320, 375, 1280]) {
      const domain = { domainStart: "2025-01-01", domainEnd: "2026-08-15" };
      const options = { ...at(width), ...domain };
      const short = [point(1, "10", "2026-07-28"), point(2, "12", "2026-08-15")];
      const long = [point(1, "5", "2025-01-01"), point(2, "6", "2026-07-28"), point(3, "7", "2026-08-15")];
      const shortLayout = layoutHistory(short, options);
      const longLayout = layoutHistory(long, options);
      // The shared date 2026-07-28 must land at the same x in both series.
      const shortShared = shortLayout.anchors.find((anchor) => anchor.observedOn === "2026-07-28")!;
      const longShared = longLayout.anchors.find((anchor) => anchor.observedOn === "2026-07-28")!;
      expect(shortShared.x).toBeCloseTo(longShared.x, 1);
      // The domain's own start/end land at the padded edges for the series that reaches them.
      expect(longLayout.anchors[0].x).toBe(HISTORY_LAYOUT_DEFAULTS.paddingX);
      expect(longLayout.anchors[2].x).toBe(width - HISTORY_LAYOUT_DEFAULTS.paddingX);
      // Bounds and nudging still hold under a shared domain.
      const half = HISTORY_LAYOUT_DEFAULTS.hitSize / 2;
      for (const layout of [shortLayout, longLayout]) {
        for (const anchor of layout.anchors) {
          expect(anchor.x - half).toBeGreaterThanOrEqual(0);
          expect(anchor.x + half).toBeLessThanOrEqual(width);
        }
      }
    }
    // A series whose points share one date still gets a real (non-arbitrary) x position under a
    // shared domain, rather than the own-domain "cannot divide by zero span" even-spacing fallback.
    const domain = { domainStart: "2025-01-01", domainEnd: "2026-08-15" };
    const sameDayUnderSharedDomain = layoutHistory(
      [point(1, "1", "2026-07-28"), point(2, "2", "2026-07-28")],
      { ...at(1280), ...domain },
    );
    const expectedX = HISTORY_LAYOUT_DEFAULTS.paddingX
      + ((Date.UTC(2026, 6, 28) - Date.UTC(2025, 0, 1)) / (Date.UTC(2026, 7, 15) - Date.UTC(2025, 0, 1)))
      * (1280 - 2 * HISTORY_LAYOUT_DEFAULTS.paddingX);
    expect(sameDayUnderSharedDomain.anchors[0].x).toBeCloseTo(expectedX, 0);
    expect(sameDayUnderSharedDomain.adjusted).toBe(true); // still nudged apart so both are visible
  });
});
