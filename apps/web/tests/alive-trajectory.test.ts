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
  pathPoint,
  stepControlPoints,
  stepDrum,
} from "@/lib/home/alive-trajectory";

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

  it("moves up and to the right as t increases, matching a curving-up arrow", () => {
    const points = createControlPoints(BASE_CONTROL_POINTS, () => 0.5);
    const a = pathPoint(points, 0.2);
    const b = pathPoint(points, 0.8);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeLessThan(a.y);
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
