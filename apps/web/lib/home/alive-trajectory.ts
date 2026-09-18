/**
 * Pure physics and geometry for the "alive trajectory" hero (pre-login entry screen). No DOM,
 * no timers: the component owns the single requestAnimationFrame loop and writes SVG attributes
 * imperatively from these functions' return values. Kept pure and unit-tested so the motion model
 * (ported from .superpowers/sdd/alive-home-reference.html) can be verified without a browser.
 *
 * Nothing here encodes a health value by colour, size, speed or direction: every spring constant,
 * ring stroke and node motion is identical regardless of which example item it carries.
 */

export type SpringParams = { mass: number; stiffness: number; damping: number };

/** Detent snap (iOS timer drum). */
export const PICKER: SpringParams = { mass: 0.8, stiffness: 260, damping: 34 };
/** Orbit phase smoothing. */
export const DRIFT: SpringParams = { mass: 1.4, stiffness: 36, damping: 15 };
/** Arrow breathing: slow, slightly under-damped. */
export const BREATH: SpringParams = { mass: 2.0, stiffness: 18, damping: 9 };
/** Stroke draw-in. */
export const DRAW: SpringParams = { mass: 1.2, stiffness: 50, damping: 18 };

const SUB_STEP = 0.004;

/** A critically-ish damped spring integrated with fixed sub-steps, matching the reference. */
export class Spring {
  x: number;
  t: number;
  v: number;
  p: SpringParams;

  constructor(value: number, params: SpringParams) {
    this.x = value;
    this.t = value;
    this.v = 0;
    this.p = params;
  }

  /** Move the target the spring pulls toward. */
  set(target: number) {
    this.t = target;
  }

  /** Teleport to a value with zero velocity and the same target. */
  jump(value: number) {
    this.x = value;
    this.t = value;
    this.v = 0;
  }

  /** Advance by dt seconds (sub-stepped for stability) and return the new position. */
  step(dt: number): number {
    const n = Math.max(1, Math.ceil(dt / SUB_STEP));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      const acceleration = (-this.p.stiffness * (this.x - this.t) - this.p.damping * this.v) / this.p.mass;
      this.v += acceleration * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

// ---------- drum (scroll momentum → detent snap) ----------

export const DRUM_TICKS = 24;
export const DRUM_FRICTION_TAU = 0.55;
export const DRUM_SNAP_VELOCITY = 0.6;

export type DrumState = {
  x: number;
  v: number;
  snap: Spring | null;
};

export function createDrum(): DrumState {
  return { x: 0, v: 0, snap: null };
}

/** A wheel/scroll event adds velocity to the drum; sign only sets direction, magnitude is capped. */
export function addDrumVelocity(drum: DrumState, deltaY: number) {
  drum.v += Math.sign(deltaY) * Math.min(6, Math.abs(deltaY) / 40) * 6;
  drum.snap = null;
}

/**
 * Advance the drum by dt seconds: while moving fast, friction bleeds velocity; once it drops
 * below the snap threshold, a spring pulls it to the nearest integer detent. Returns the drum's
 * position in fractional turns (x / DRUM_TICKS).
 */
export function stepDrum(drum: DrumState, dt: number): number {
  if (Math.abs(drum.v) > DRUM_SNAP_VELOCITY || (drum.snap === null && drum.v !== 0)) {
    drum.x += drum.v * dt;
    drum.v *= Math.exp(-dt / DRUM_FRICTION_TAU);
    drum.snap = null;
    if (Math.abs(drum.v) <= DRUM_SNAP_VELOCITY) {
      drum.snap = new Spring(drum.x, PICKER);
      drum.snap.set(Math.round(drum.x));
      drum.v = 0;
    }
  } else if (drum.snap) {
    drum.x = drum.snap.step(dt);
  }
  return drum.x / DRUM_TICKS;
}

// ---------- breathing control points and path ----------

export type ControlPoint = {
  x: number;
  y: number;
  sx: Spring;
  sy: Spring;
  /** Wander frequency and phase, fixed per point so the breathing is stable but not synchronized. */
  fx: number;
  fy: number;
  px: number;
  py: number;
};

/** Base control points for the curving-up-and-to-the-right arrow, in the reference's 1200x760 viewBox. */
export const BASE_CONTROL_POINTS: ReadonlyArray<readonly [number, number]> = [
  [90, 690],
  [330, 690],
  [470, 560],
  [640, 400],
  [810, 240],
  [900, 172],
  [1060, 108],
];

export function createControlPoints(
  base: ReadonlyArray<readonly [number, number]> = BASE_CONTROL_POINTS,
  random: () => number = Math.random,
): ControlPoint[] {
  return base.map(([x, y]) => ({
    x,
    y,
    sx: new Spring(x, BREATH),
    sy: new Spring(y, BREATH),
    fx: 0.11 + random() * 0.09,
    fy: 0.08 + random() * 0.08,
    px: random() * 6.28,
    py: random() * 6.28,
  }));
}

/**
 * Sets each control point's spring target to a point wandering around its base position, and
 * returns the two-cubic-segment path string through the (unstepped) spring positions. Call
 * `.step(dt)` on each point's sx/sy separately to actually advance them; this only sets targets
 * and reads current positions, so it is safe to call before or after stepping.
 */
export function buildPath(points: ReadonlyArray<ControlPoint>, time: number): string {
  const p = points.map((c, i) => {
    const amp = i === 0 || i === points.length - 1 ? 6 : 16;
    c.sx.set(c.x + amp * Math.sin(time * c.fx * 6.28 + c.px));
    c.sy.set(c.y + amp * Math.sin(time * c.fy * 6.28 + c.py));
    return [c.sx.x, c.sy.x] as const;
  });
  const [p0, p1, p2, p3, p4, p5, p6] = p;
  return (
    `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]} ` +
    `C ${p4[0]} ${p4[1]}, ${p5[0]} ${p5[1]}, ${p6[0]} ${p6[1]}`
  );
}

/** Advance every control point's springs by dt. */
export function stepControlPoints(points: ReadonlyArray<ControlPoint>, dt: number) {
  for (const c of points) {
    c.sx.step(dt);
    c.sy.step(dt);
  }
}

/**
 * A point (and tangent angle) on the two-cubic-segment arrow path at parameter t in [0, 1],
 * evaluated directly from the control points' current spring positions (De Casteljau / the
 * standard cubic Bezier formula) rather than a DOM path measurement — this keeps the geometry
 * usable in environments (like the unit test runner) that do not implement
 * `SVGPathElement.getPointAtLength`.
 */
export function pathPoint(points: ReadonlyArray<ControlPoint>, t: number): Point2D & { angle: number } {
  const clamped = Math.min(Math.max(t, 0), 1);
  const first = clamped <= 0.5;
  const localT = first ? clamped / 0.5 : (clamped - 0.5) / 0.5;
  const [p0, p1, p2, p3] = first
    ? [points[0], points[1], points[2], points[3]]
    : [points[3], points[4], points[5], points[6]];
  const a0 = { x: p0.sx.x, y: p0.sy.x };
  const a1 = { x: p1.sx.x, y: p1.sy.x };
  const a2 = { x: p2.sx.x, y: p2.sy.x };
  const a3 = { x: p3.sx.x, y: p3.sy.x };
  const u = 1 - localT;
  const x = u * u * u * a0.x + 3 * u * u * localT * a1.x + 3 * u * localT * localT * a2.x + localT * localT * localT * a3.x;
  const y = u * u * u * a0.y + 3 * u * u * localT * a1.y + 3 * u * localT * localT * a2.y + localT * localT * localT * a3.y;
  const dx = 3 * u * u * (a1.x - a0.x) + 6 * u * localT * (a2.x - a1.x) + 3 * localT * localT * (a3.x - a2.x);
  const dy = 3 * u * u * (a1.y - a0.y) + 6 * u * localT * (a2.y - a1.y) + 3 * localT * localT * (a3.y - a2.y);
  return { x, y, angle: Math.atan2(dy, dx) };
}

// ---------- ellipse geometry ----------

export type Point2D = { x: number; y: number };

/** A point on an ellipse centred at (cx, cy) with radii (rx, ry), rotated by `rotation` radians,
 * at parameter angle `theta`. */
export function ellipsePoint(cx: number, cy: number, rx: number, ry: number, rotation: number, theta: number): Point2D {
  const ex = rx * Math.cos(theta);
  const ey = ry * Math.sin(theta);
  return {
    x: cx + ex * Math.cos(rotation) - ey * Math.sin(rotation),
    y: cy + ex * Math.sin(rotation) + ey * Math.cos(rotation),
  };
}

/** A half-ellipse path (arc from a0 to a1) as an SVG path `d` string, straddling the trajectory. */
export function halfEllipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number,
  a0: number,
  a1: number,
  steps: number,
): string {
  let d = "";
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const point = ellipsePoint(cx, cy, rx, ry, rotation, a);
    d += `${i ? " L " : "M "}${point.x} ${point.y}`;
  }
  return d;
}

// ---------- phases (checkup periods, never life-stage or health-stage words) ----------

/** Time periods only. Never a life-stage or health-stage word. */
export const PHASE_LABELS: readonly string[] = ["2024 검진", "2025 검진", "2026 검진", "다음 검진"];

export type PhaseRange = { label: string; t0: number; t1: number };

/** Divides [0, tEnd] into `labels.length` equal, contiguous ranges. */
export function phaseRanges(labels: readonly string[], tEnd: number): PhaseRange[] {
  const n = labels.length;
  return labels.map((label, i) => ({ label, t0: (tEnd * i) / n, t1: (tEnd * (i + 1)) / n }));
}

/**
 * A sampled polyline `d` string for the arrow path restricted to [t0, t1], so each phase can be
 * drawn as its own <path> with its own dash pattern while still tracing the same breathing curve.
 */
export function phaseSegmentPath(points: ReadonlyArray<ControlPoint>, t0: number, t1: number, steps = 24): string {
  let d = "";
  for (let i = 0; i <= steps; i += 1) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const p = pathPoint(points, t);
    d += `${i ? " L " : "M "}${p.x} ${p.y}`;
  }
  return d;
}

/** Sampled arc length of the curve over [t0, t1], using `steps` straight-line segments. */
export function sampledPathLength(points: ReadonlyArray<ControlPoint>, t0: number, t1: number, steps: number): number {
  let length = 0;
  let prev = pathPoint(points, t0);
  for (let i = 1; i <= steps; i += 1) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const point = pathPoint(points, t);
    length += Math.hypot(point.x - prev.x, point.y - prev.y);
    prev = point;
  }
  return length;
}

export type PhaseTick = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  angleDeg: number;
};

/**
 * A short tick perpendicular to the path at parameter `t`, plus a label anchor further out along
 * the same normal so the mono phase label never overlaps the path or a ring.
 */
export function phaseTick(points: ReadonlyArray<ControlPoint>, t: number, tickLength = 18, labelOffset = 16): PhaseTick {
  const p = pathPoint(points, t);
  const nx = -Math.sin(p.angle);
  const ny = Math.cos(p.angle);
  return {
    x1: p.x - (nx * tickLength) / 2,
    y1: p.y - (ny * tickLength) / 2,
    x2: p.x + (nx * tickLength) / 2,
    y2: p.y + (ny * tickLength) / 2,
    labelX: p.x + nx * (tickLength / 2 + labelOffset),
    labelY: p.y + ny * (tickLength / 2 + labelOffset),
    angleDeg: (p.angle * 180) / Math.PI,
  };
}

// ---------- fade edge ----------

/**
 * 0 at both ends of [0, 1], 1 in the interior, ramping over `edge` at each side. Used so a ring
 * fades in/out as it nears the start or end of the trajectory instead of popping.
 */
export function fadeEdge(t: number, end: number, edge: number): number {
  const fromStart = t / edge;
  const fromEnd = (end - t) / edge;
  return Math.max(0, Math.min(fromStart, fromEnd, 1));
}
