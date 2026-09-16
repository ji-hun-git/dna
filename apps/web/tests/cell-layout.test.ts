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
