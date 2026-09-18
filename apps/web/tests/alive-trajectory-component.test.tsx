import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it, vi } from "vitest";
import { AliveTrajectory } from "@/components/home/AliveTrajectory";
import { buildExamplePhases } from "@/lib/home/alive-home-data";
import { RINGS } from "@/lib/home/alive-example-data";
import { maxRingVerticalExtent, pathPoint, phaseRanges, T_END, createControlPoints, BASE_CONTROL_POINTS } from "@/lib/home/alive-trajectory";
import { FORBIDDEN_JUDGEMENT_WORDS } from "./fixtures/forbidden-words";

afterEach(cleanup);

function stubReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function clearReducedMotionStub() {
  // @ts-expect-error jsdom has no matchMedia; remove the stub so other tests see the default.
  delete window.matchMedia;
}


it("renders the example-data caption and the motion boundary sentence verbatim", () => {
  render(<AliveTrajectory />);
  expect(screen.getByText("예시 데이터 · 실제 사람의 기록이 아니에요")).toBeInTheDocument();
  expect(screen.getByText("선의 모양과 움직임은 건강 상태를 뜻하지 않아요.")).toBeInTheDocument();
});

it("is a single decorative role=img SVG with a Korean description and nothing focusable inside", () => {
  const { container } = render(<AliveTrajectory />);
  const svg = container.querySelector("svg");
  expect(svg).not.toBeNull();
  expect(svg).toHaveAttribute("role", "img");
  expect(svg?.getAttribute("aria-label")).toMatch(/[가-힣]/);
  expect(container.querySelectorAll("svg a, svg button, svg [tabindex]")).toHaveLength(0);
});

it("gives every example node a label of item, value and unit with no status word, and a formatted date", () => {
  const { container } = render(<AliveTrajectory />);
  const labels = Array.from(container.querySelectorAll("svg text:not([class])")).map((node) => node.textContent ?? "");
  expect(labels.length).toBeGreaterThan(0);
  for (const label of labels) {
    for (const forbidden of FORBIDDEN_JUDGEMENT_WORDS) {
      expect(label, `label "${label}" contains forbidden word "${forbidden}"`).not.toContain(forbidden);
    }
  }
  const dates = Array.from(container.querySelectorAll("svg text")).map((node) => node.textContent ?? "");
  expect(dates.some((text) => /^\d{4}\. \d{1,2}\. \d{1,2}\.$/.test(text))).toBe(true);
});

it("uses identical stroke and fill rules for every node regardless of item (no value encodes into colour or size class)", () => {
  const { container } = render(<AliveTrajectory />);
  const shapes = Array.from(container.querySelectorAll("svg circle, svg rect[stroke]"));
  const strokeWidths = new Set(shapes.map((shape) => shape.getAttribute("stroke-width")));
  const strokes = new Set(shapes.map((shape) => shape.getAttribute("stroke")));
  const fills = new Set(shapes.map((shape) => shape.getAttribute("fill")));
  expect(strokeWidths.size).toBe(1);
  expect(strokes.size).toBe(1);
  expect(fills.size).toBe(1);
});

it("renders a still, non-looping frame under prefers-reduced-motion", async () => {
  stubReducedMotion(true);
  const addSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");
  const removeSpy = vi.spyOn(HTMLElement.prototype, "removeEventListener");
  const { container } = render(<AliveTrajectory />);
  const root = container.firstElementChild as HTMLElement;
  expect(root).toHaveAttribute("data-reduced-motion", "true");
  // The `<defs><pattern>` background path has a constant `d` regardless of whether the loop
  // runs, so it would pass this test even with a live animation. Select the halo/axis path
  // instead: it is the one path whose `d` is actually recomputed every animation frame.
  const axis = container.querySelector('svg [data-role="axis"]');
  expect(axis).not.toBeNull();
  const firstD = axis?.getAttribute("d");
  expect(firstD).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 80));
  expect(axis?.getAttribute("d")).toBe(firstD);
  // No scroll-driven drum motion is left wired up on the component's own root once reduced
  // motion has settled: `usePrefersReducedMotion` starts false and flips true on its own first
  // effect, so the animation effect can transiently attach a "wheel" listener on its first,
  // stale-`reduced` run before its own cleanup removes it — net adds minus removes must be 0.
  // (React's event-delegation listeners on the render container are unrelated "wheel"
  // registrations on a different element, so this is scoped to `root` via `mock.instances`.)
  const countOn = (spy: typeof addSpy, type: string) =>
    spy.mock.calls.filter(([t], i) => t === type && spy.mock.instances[i] === root).length;
  expect(countOn(addSpy, "wheel") - countOn(removeSpy, "wheel")).toBe(0);
  addSpy.mockRestore();
  removeSpy.mockRestore();
  clearReducedMotionStub();
});

it("has no axe violations", async () => {
  const { container } = render(<AliveTrajectory />);
  expect(await axe(container)).toHaveNoViolations();
});

it("draws the axis as separate phase segments, each with its own dash pattern, with no tip marker, gate or arrowhead", () => {
  const { container } = render(<AliveTrajectory />);
  const svg = container.querySelector("svg")!;
  // The phases group sits between the halo and the flow-dash path; it holds one <path> per
  // phase plus a tick <line> and mono <text> label at each internal boundary.
  const phasePaths = Array.from(svg.querySelectorAll("g > path[stroke='#fff']")).filter(
    (p) => p.getAttribute("stroke-width") === "2" && p.parentElement?.tagName === "g",
  );
  expect(phasePaths.length).toBeGreaterThanOrEqual(4);
  const dashPatterns = new Set(phasePaths.map((p) => p.getAttribute("stroke-dasharray") ?? ""));
  // Not every segment uses the same dash pattern (solid vs dashed), and none of them uses colour.
  expect(dashPatterns.size).toBeGreaterThan(1);
  for (const p of phasePaths) expect(p.getAttribute("stroke")).toBe("#fff");

  const tickLines = svg.querySelectorAll("line");
  expect(tickLines.length).toBeGreaterThanOrEqual(3);

  // The horizontal time axis has no tip marker: nothing rotates a group to point along the
  // tangent at the path's end (that rotate(...) transform was only ever used by the old tip/gate).
  expect(svg.querySelector('g[transform*="rotate"]')).toBeNull();
});

it("labels each phase with a time period only, derived from the example rings' own dates", () => {
  render(<AliveTrajectory />);
  const { labels } = buildExamplePhases(RINGS);
  for (const label of labels) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
});

it("never lets a phase label box intersect any ring's bounding box for the example data", () => {
  // Reduced motion renders a deterministic still frame (springs sitting exactly at their base
  // targets), so the geometry below matches `renderStill`/`layoutPhaseSegment` exactly.
  stubReducedMotion(true);
  render(<AliveTrajectory />);

  const { labels, rings } = buildExamplePhases(RINGS);
  const ranges = phaseRanges(labels, T_END);
  const controlPoints = createControlPoints(BASE_CONTROL_POINTS, () => 0.5);
  const maxRx = maxRingVerticalExtent(rings);

  for (const range of ranges) {
    const tick = pathPoint(controlPoints, range.t0);
    const labelY = tick.y - maxRx - 24;
    // Every ring's bounding box (rotated onto the near-horizontal axis, so its vertical extent
    // is its own rx) must sit entirely below the label — i.e. its top edge is a larger y.
    for (const ring of rings) {
      const ringCenter = pathPoint(controlPoints, ring.t);
      const ringTop = ringCenter.y - ring.rx;
      expect(ringTop).toBeGreaterThan(labelY);
    }
  }
  clearReducedMotionStub();
});
