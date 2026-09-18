import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it, vi } from "vitest";
import { AliveTrajectory } from "@/components/home/AliveTrajectory";

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

const FORBIDDEN_JUDGEMENT_WORDS = [
  "정상",
  "비정상",
  "높음",
  "낮음",
  "위험",
  "상승",
  "하락",
  "좋아",
  "나빠",
  "추세",
  "안정",
];

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
  const { container } = render(<AliveTrajectory />);
  const root = container.firstElementChild as HTMLElement;
  expect(root).toHaveAttribute("data-reduced-motion", "true");
  const arrow = container.querySelector("svg path");
  const firstD = arrow?.getAttribute("d");
  expect(firstD).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 80));
  expect(arrow?.getAttribute("d")).toBe(firstD);
  clearReducedMotionStub();
});

it("has no axe violations", async () => {
  const { container } = render(<AliveTrajectory />);
  expect(await axe(container)).toHaveNoViolations();
});
