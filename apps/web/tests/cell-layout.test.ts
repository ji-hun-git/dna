import { describe, expect, it } from "vitest";
import { buildTimeScale, layoutCells } from "@/lib/my-data/cell-layout";
import { syntheticHealthEvent } from "./fixtures/foundation";

const jan = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51", observedOn: "2026-01-15", value: "194" });
const jul = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d52", observedOn: "2026-07-28" });
const julB = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d53", observedOn: "2026-07-28", concept: "당화혈색소", value: "5.2", unit: "%" });

describe("buildTimeScale", () => {
  it("maps the earliest date to the left padding and the latest to the right edge", () => {
    const scale = buildTimeScale(["2026-07-28", "2026-01-15"], 400, 20);
    expect(scale.start).toBe("2026-01-15");
    expect(scale.end).toBe("2026-07-28");
    expect(scale.x("2026-01-15")).toBe(20);
    expect(scale.x("2026-07-28")).toBe(380);
    expect(scale.ticks.map((tick) => tick.label)).toEqual(["2026. 1.", "2026. 7."]);
  });

  it("centres a single date and gives one tick", () => {
    const scale = buildTimeScale(["2026-07-28"], 400, 20);
    expect(scale.x("2026-07-28")).toBe(200);
    expect(scale.ticks).toHaveLength(1);
  });
});

describe("layoutCells", () => {
  it("stacks same-day events upward and keeps one x per date", () => {
    const { cells } = layoutCells([jul, julB, jan], { width: 400, cellSize: 10, gap: 2, padding: 20 });
    const byId = new Map(cells.map((cell) => [cell.eventId, cell]));
    expect(byId.get(jul.eventId)!.x).toBe(byId.get(julB.eventId)!.x);
    // 당화혈색소 (julB) sorts before 총콜레스테롤 (jul) in Korean order, so julB sits
    // at the baseline (index 0) and jul is stacked 12px above it.
    expect(byId.get(julB.eventId)!.y - byId.get(jul.eventId)!.y).toBe(12);
    expect(byId.get(jan.eventId)!.x).toBeLessThan(byId.get(jul.eventId)!.x);
  });

  it("applies selected > query-related > new > idle and keeps uncertainty separate", () => {
    const uncertain = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d54", verification: "uncertain", source: { ...jul.source, previewAvailable: false } });
    const { cells } = layoutCells([jul, julB, uncertain], {
      width: 400, cellSize: 10, gap: 2, padding: 20,
      selectedId: jul.eventId,
      matchedIds: new Set([jul.eventId, julB.eventId]),
      newIds: new Set([julB.eventId, uncertain.eventId]),
    });
    const state = Object.fromEntries(cells.map((cell) => [cell.eventId, cell.state]));
    expect(state[jul.eventId]).toBe("selected");
    expect(state[julB.eventId]).toBe("query-related");
    expect(state[uncertain.eventId]).toBe("new");
    expect(cells.find((cell) => cell.eventId === uncertain.eventId)!.uncertain).toBe(true);
  });

  it("writes an accessible name with concept, value, unit and Korean date", () => {
    const { cells } = layoutCells([jan], { width: 400, cellSize: 10, gap: 2, padding: 20 });
    expect(cells[0].ariaLabel).toBe("총콜레스테롤 194 mg/dL, 2026. 1. 15.");
  });

  it("returns a height that fits the tallest day stack", () => {
    const { height } = layoutCells([jul, julB], { width: 400, cellSize: 10, gap: 2, padding: 20 });
    expect(height).toBe(20 + 2 * 12 + 20);
  });
});

function addDays(isoDate: string, days: number): string {
  const date = new Date(Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  ));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Reproduces the Wave 3 my-data drawer sequence: on a months-wide axis, two dates only one
// day apart (2026-07-27 and 2026-07-28) used to map to x-centres closer than one cell width,
// so their SVG rects overlapped and stole click/pointer events from each other.
describe("layoutCells keeps close-but-distinct dates from overlapping", () => {
  const options = { width: 720, cellSize: 10, gap: 3, padding: 24 };
  const julA = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d61", observedOn: "2026-07-28" });
  const julB = syntheticHealthEvent({
    eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d62",
    observedOn: "2026-07-27",
    concept: "당화혈색소",
    value: "5.2",
    unit: "%",
  });
  const january = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d63", observedOn: "2026-01-15", value: "194" });

  it("gives adjacent-day cells rects that do not overlap", () => {
    const { cells } = layoutCells([julA, julB, january], options);
    const byId = new Map(cells.map((cell) => [cell.eventId, cell]));
    const a = byId.get(julA.eventId)!;
    const b = byId.get(julB.eventId)!;
    // Rects at [x, x+cellSize) must not intersect: centres at least one cellSize apart.
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(options.cellSize);
  });

  it("keeps x strictly in date order after declumping", () => {
    const { cells } = layoutCells([julA, julB, january], options);
    const byId = new Map(cells.map((cell) => [cell.eventId, cell]));
    expect(byId.get(january.eventId)!.x).toBeLessThan(byId.get(julB.eventId)!.x);
    expect(byId.get(julB.eventId)!.x).toBeLessThan(byId.get(julA.eventId)!.x);
  });

  it("leaves same-day stacking behaviour unchanged", () => {
    const sameDayB = syntheticHealthEvent({
      eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d64",
      observedOn: "2026-07-28",
      concept: "당화혈색소",
      value: "5.2",
      unit: "%",
    });
    const { cells } = layoutCells([julA, sameDayB], options);
    const byId = new Map(cells.map((cell) => [cell.eventId, cell]));
    expect(byId.get(julA.eventId)!.x).toBe(byId.get(sameDayB.eventId)!.x);
    expect(byId.get(sameDayB.eventId)!.y - byId.get(julA.eventId)!.y).toBe(options.cellSize + options.gap);
  });
});

// Property-style: whatever the viewport width or how many distinct dates crowd together,
// every cell must stay fully inside the padded canvas, distinct dates must not overlap
// when the minimum spacing can fit inside that width, and the layout must be a pure,
// deterministic function of its inputs (no unbounded convergence loop).
describe("layoutCells stays in-bounds under crowding (property-style)", () => {
  const cellSize = 10;
  const gap = 3;
  const padding = 24;
  const step = cellSize + gap;

  for (const width of [320, 375, 1280]) {
    for (const count of [2, 5, 12]) {
      it(`bounds and spacing hold for ${count} consecutive-day events at ${width}px width`, () => {
        const events = Array.from({ length: count }, (_, index) => syntheticHealthEvent({
          eventId: `crowd-${width}-${count}-${index}`,
          observedOn: addDays("2026-01-01", index),
        }));
        const options = { width, cellSize, gap, padding };
        const { cells } = layoutCells(events, options);
        expect(cells).toHaveLength(count);

        const minX = padding + cellSize / 2;
        const maxX = width - padding - cellSize / 2;
        for (const cell of cells) {
          // cell.x is the rect's left corner (centre - cellSize / 2); the whole rect,
          // corner to corner, must stay inside the padded canvas.
          expect(cell.x).toBeGreaterThanOrEqual(minX - cellSize / 2 - 1e-6);
          expect(cell.x + cellSize).toBeLessThanOrEqual(maxX + cellSize / 2 + 1e-6);
          expect(cell.x).toBeGreaterThanOrEqual(-1e-6);
          expect(cell.x + cellSize).toBeLessThanOrEqual(width + 1e-6);
        }

        const centresInDateOrder = events.map((event) => cells.find((cell) => cell.eventId === event.eventId)!.x + cellSize / 2);
        // Date order is always preserved, fit or not.
        for (let i = 1; i < centresInDateOrder.length; i++) {
          expect(centresInDateOrder[i]).toBeGreaterThan(centresInDateOrder[i - 1] - 1e-9);
        }

        const availableSpan = maxX - minX;
        const requiredSpan = (count - 1) * step;
        if (requiredSpan <= availableSpan) {
          // Minimum spacing fits inside the available width: no two distinct-date cells overlap.
          for (let i = 1; i < centresInDateOrder.length; i++) {
            expect(centresInDateOrder[i] - centresInDateOrder[i - 1]).toBeGreaterThanOrEqual(step - 1e-9);
          }
        } else {
          // Degrade rule: when the minimum-spacing footprint cannot fit, cells are spread
          // evenly across the full available span instead (still in date order, still fully
          // inside the canvas) rather than clamped into an undefined pile-up or pushed
          // out of bounds.
          const expected = count === 1
            ? [(minX + maxX) / 2]
            : Array.from({ length: count }, (_, index) => minX + (index * availableSpan) / (count - 1));
          expected.forEach((value, index) => {
            expect(centresInDateOrder[index]).toBeCloseTo(value, 6);
          });
        }

        // Pure and deterministic: re-running with the same input gives the same output.
        const again = layoutCells(events, options);
        expect(again.cells.map((cell) => cell.x)).toEqual(cells.map((cell) => cell.x));
      });
    }
  }
});
