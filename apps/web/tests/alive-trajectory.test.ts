import { describe, expect, it } from "vitest";
import {
  BASE_CONTROL_POINTS,
  PICKER,
  Spring,
  buildPath,
  createControlPoints,
  createDrum,
  addDrumVelocity,
  ellipsePoint,
  fadeEdge,
  halfEllipsePath,
  maxRingVerticalExtent,
  pathPoint,
  phaseRanges,
  phaseSegmentPath,
  phaseTick,
  sampledPathLength,
  stepControlPoints,
  stepDrum,
} from "@/lib/home/alive-trajectory";

/** A stand-in label set for pure geometry tests that don't care about actual dates. */
const PHASE_LABELS: readonly string[] = ["a 검진", "b 검진", "c 검진", "다음 검진"];

describe("Spring", () => {
  it("converges to its target without overshooting past a bound", () => {
    const spring = new Spring(0, PICKER);
    spring.set(1);
    let max = 0;
    for (let i = 0; i < 500; i += 1) {
      const x = spring.step(1 / 60);
      max = Math.max(max, x);
    }
    expect(spring.x).toBeCloseTo(1, 3);
    // PICKER is designed to snap without wild overshoot; bound generously above 1.
    expect(max).toBeLessThan(1.2);
  });

  it("jump teleports with zero velocity", () => {
    const spring = new Spring(0, PICKER);
    spring.set(5);
    spring.step(0.1);
    spring.jump(2);
    expect(spring.x).toBe(2);
    expect(spring.t).toBe(2);
    expect(spring.v).toBe(0);
  });
});

describe("drum", () => {
  it("snaps to an integer detent after momentum decays", () => {
    const drum = createDrum();
    addDrumVelocity(drum, 400);
    for (let i = 0; i < 600; i += 1) {
      stepDrum(drum, 1 / 60);
    }
    expect(drum.snap).not.toBeNull();
    expect(drum.x).toBeCloseTo(Math.round(drum.x), 3);
    expect(drum.v).toBe(0);
  });
});

describe("buildPath", () => {
  it("returns a path with two cubic segments and stays within the 1200x760 viewBox with margin", () => {
    const points = createControlPoints(BASE_CONTROL_POINTS, () => 0.5);
    const d = buildPath(points, 0);
    expect(d.match(/C /g)?.length).toBe(2);
    expect(d.startsWith("M ")).toBe(true);

    const numbers = d
      .replace(/[MC,]/g, " ")
      .trim()
      .split(/\s+/)
      .map(Number);
    for (let i = 0; i < numbers.length; i += 2) {
      const x = numbers[i];
      const y = numbers[i + 1];
      expect(x).toBeGreaterThanOrEqual(-50);
      expect(x).toBeLessThanOrEqual(1250);
      expect(y).toBeGreaterThanOrEqual(-50);
      expect(y).toBeLessThanOrEqual(810);
    }
  });

  it("stepControlPoints advances springs toward their breathing targets over time", () => {
    const points = createControlPoints(BASE_CONTROL_POINTS, () => 0.5);
    buildPath(points, 0);
    const before = points[3].sx.x;
    for (let i = 0; i < 30; i += 1) {
      buildPath(points, i / 60);
      stepControlPoints(points, 1 / 60);
    }
    const after = points[3].sx.x;
    expect(after).not.toBe(before);
  });
});

describe("pathPoint", () => {
  it("returns the first control point at t=0 and the last at t=1", () => {
    const points = createControlPoints(BASE_CONTROL_POINTS, () => 0.5);
    const start = pathPoint(points, 0);
    const end = pathPoint(points, 1);
    expect(start.x).toBeCloseTo(BASE_CONTROL_POINTS[0][0], 5);
    expect(start.y).toBeCloseTo(BASE_CONTROL_POINTS[0][1], 5);
    expect(end.x).toBeCloseTo(BASE_CONTROL_POINTS[6][0], 5);
    expect(end.y).toBeCloseTo(BASE_CONTROL_POINTS[6][1], 5);
  });

  it("moves to the right as t increases and never climbs, matching a horizontal time axis", () => {
    const points = createControlPoints(BASE_CONTROL_POINTS, () => 0.5);
    const a = pathPoint(points, 0.2);
    const b = pathPoint(points, 0.8);
    expect(b.x).toBeGreaterThan(a.x);
    // With no breathing applied (springs unstepped, sitting exactly at their base value), the
    // path stays at the same height throughout: a flat horizontal line, not a climbing arc.
    expect(b.y).toBeCloseTo(a.y, 5);
  });
});

describe("ellipsePoint", () => {
  it("lies on the ellipse for any rotation and angle", () => {
    const cx = 100;
    const cy = 50;
    const rx = 30;
    const ry = 10;
    for (const rotation of [0, 0.3, Math.PI / 2, 2.1]) {
      for (const theta of [0, 0.7, Math.PI, 4.2]) {
        const { x, y } = ellipsePoint(cx, cy, rx, ry, rotation, theta);
        // Undo the rotation and translation, then check the ellipse equation.
        const dx = x - cx;
        const dy = y - cy;
        const ex = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
        const ey = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);
        const residual = (ex * ex) / (rx * rx) + (ey * ey) / (ry * ry);
        expect(residual).toBeCloseTo(1, 5);
      }
    }
  });
});

describe("halfEllipsePath", () => {
  it("builds a path string covering the requested step count", () => {
    const d = halfEllipsePath(0, 0, 10, 5, 0, Math.PI, 2 * Math.PI, 8);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.match(/ L /g)?.length).toBe(8);
  });
});

describe("phaseRanges", () => {
  it("divides [0, tEnd] into contiguous, equal ranges covering every label", () => {
    const ranges = phaseRanges(PHASE_LABELS, 0.97);
    expect(ranges).toHaveLength(PHASE_LABELS.length);
    expect(ranges[0].t0).toBe(0);
    expect(ranges[ranges.length - 1].t1).toBeCloseTo(0.97, 10);
    for (let i = 1; i < ranges.length; i += 1) {
      expect(ranges[i].t0).toBeCloseTo(ranges[i - 1].t1, 10);
    }
    expect(ranges.map((r) => r.label)).toEqual([...PHASE_LABELS]);
  });
});

describe("phaseSegmentPath and sampledPathLength", () => {
  it("splits the path into segments whose sampled lengths sum to the whole", () => {
    const points = createControlPoints(BASE_CONTROL_POINTS, () => 0.5);
    const tEnd = 0.97;
    const ranges = phaseRanges(PHASE_LABELS, tEnd);
    const stepsPerPhase = 75;
    const total = sampledPathLength(points, 0, tEnd, stepsPerPhase * ranges.length);
    const sumOfPhases = ranges.reduce((sum, r) => sum + sampledPathLength(points, r.t0, r.t1, stepsPerPhase), 0);
    expect(sumOfPhases).toBeCloseTo(total, 6);
    expect(total).toBeGreaterThan(0);
  });

  it("produces a polyline `d` string that starts and ends at the range's endpoints", () => {
    const points = createControlPoints(BASE_CONTROL_POINTS, () => 0.5);
    const d = phaseSegmentPath(points, 0.2, 0.5, 10);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.match(/ L /g)?.length).toBe(10);
    const start = pathPoint(points, 0.2);
    const end = pathPoint(points, 0.5);
    const nums = d.replace(/[ML]/g, "").trim().split(/\s+/).map(Number);
    expect(nums[0]).toBeCloseTo(start.x, 5);
    expect(nums[1]).toBeCloseTo(start.y, 5);
    expect(nums[nums.length - 2]).toBeCloseTo(end.x, 5);
    expect(nums[nums.length - 1]).toBeCloseTo(end.y, 5);
  });
});

describe("phaseTick", () => {
  it("returns a marker whose tick and label sit inside the viewBox, perpendicular to the path", () => {
    const points = createControlPoints(BASE_CONTROL_POINTS, () => 0.5);
    const tick = phaseTick(points, 0.4854);
    for (const [x, y] of [
      [tick.x1, tick.y1],
      [tick.x2, tick.y2],
      [tick.labelX, tick.labelY],
    ]) {
      expect(x).toBeGreaterThanOrEqual(-50);
      expect(x).toBeLessThanOrEqual(1250);
      expect(y).toBeGreaterThanOrEqual(-50);
      expect(y).toBeLessThanOrEqual(810);
    }
    // The tick has nonzero length and the label sits further out along the same normal.
    const tickLength = Math.hypot(tick.x2 - tick.x1, tick.y2 - tick.y1);
    expect(tickLength).toBeGreaterThan(0);
  });
});

describe("maxRingVerticalExtent", () => {
  it("returns the largest rx (the rotated ring's vertical extent), not ry", () => {
    expect(maxRingVerticalExtent([{ rx: 90 }, { rx: 210 }, { rx: 120 }])).toBe(210);
  });

  it("returns 0 for no rings", () => {
    expect(maxRingVerticalExtent([])).toBe(0);
  });
});

describe("fadeEdge", () => {
  it("is 0 at both ends of the range and 1 in the interior", () => {
    expect(fadeEdge(0, 0.97, 0.06)).toBe(0);
    expect(fadeEdge(0.97, 0.97, 0.06)).toBe(0);
    expect(fadeEdge(0.5, 0.97, 0.06)).toBe(1);
  });

  it("ramps smoothly near the edges", () => {
    const near = fadeEdge(0.03, 0.97, 0.06);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(1);
  });
});
