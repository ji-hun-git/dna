import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it, vi } from "vitest";
import { LivingCellCanvas } from "@/components/my-data/LivingCellCanvas";
import { syntheticHealthEvent } from "./fixtures/foundation";

afterEach(cleanup);

const jan = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51", observedOn: "2026-01-15", value: "194" });
const jul = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d52" });
const shaky = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d53", concept: "비타민 D", unit: "ng/mL", value: "42", verification: "uncertain", source: { ...jul.source, previewAvailable: false } });

it("renders one focusable, named cell per event and nothing decorative", async () => {
  const { container } = render(<LivingCellCanvas events={[jan, jul, shaky]} matchedIds={null} newIds={new Set()} onSelect={() => {}} />);
  const figure = screen.getByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
  const cells = within(figure).getAllByRole("button");
  expect(cells).toHaveLength(3);
  expect(cells.map((cell) => cell.getAttribute("aria-label"))).toContain("총콜레스테롤 194 mg/dL, 2026. 1. 15.");
  expect(container.querySelectorAll("rect[data-cell]")).toHaveLength(3);
  expect(await axe(container)).toHaveNoViolations();
});

it("shows the position-adjusted notice only when declumping actually moved a cell", () => {
  const julAdjacent = syntheticHealthEvent({
    eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d55",
    observedOn: "2026-07-27",
    concept: "당화혈색소",
    unit: "%",
    value: "5.2",
  });
  const { getByTestId } = render(
    <LivingCellCanvas events={[jan, jul, julAdjacent]} matchedIds={null} newIds={new Set()} onSelect={() => {}} />,
  );
  expect(getByTestId("cell-adjusted-notice")).toHaveTextContent(
    "셀이 겹치지 않도록 위치를 조금 옮겼어요. 정확한 날짜는 셀을 선택해 확인해 주세요.",
  );
  cleanup();

  // A single distinct date (jul and shaky both default to 2026-07-28) centres at width/2,
  // comfortably inside bounds, so nothing is nudged off its raw time-scale position.
  const { queryByTestId } = render(
    <LivingCellCanvas events={[jul, shaky]} matchedIds={null} newIds={new Set()} onSelect={() => {}} />,
  );
  expect(queryByTestId("cell-adjusted-notice")).toBeNull();
});

it("marks selection, query match and uncertainty with data attributes, not colour alone", () => {
  render(<LivingCellCanvas events={[jan, jul, shaky]} selectedId={jul.eventId} matchedIds={new Set([jan.eventId])} newIds={new Set()} onSelect={() => {}} />);
  const selected = screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL, 2026. 7. 28." });
  expect(selected).toHaveAttribute("aria-pressed", "true");
  expect(selected).toHaveAttribute("data-state", "selected");
  expect(screen.getByRole("button", { name: "총콜레스테롤 194 mg/dL, 2026. 1. 15." })).toHaveAttribute("data-state", "query-related");
  const uncertain = screen.getByRole("button", { name: "비타민 D 42 ng/mL, 2026. 7. 28. (출처 미리보기 없음)" });
  expect(uncertain).toHaveAttribute("data-uncertain", "true");
  expect(uncertain.querySelector("[data-hatch]")).not.toBeNull();
  expect(screen.getByRole("button", { name: "총콜레스테롤 194 mg/dL, 2026. 1. 15." }).querySelector("[data-query-ring]")).not.toBeNull();
  expect(selected.querySelector("[data-query-ring]")).toBeNull();
});

it("selects with click and with Enter, and shows the tooltip for the hovered cell", async () => {
  const onSelect = vi.fn();
  render(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={new Set()} onSelect={onSelect} />);
  const cell = screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL, 2026. 7. 28." });
  await userEvent.click(cell);
  expect(onSelect).toHaveBeenCalledWith(jul.eventId, expect.any(Element));
  cell.focus();
  await userEvent.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledTimes(2);
  await userEvent.hover(cell);
  expect(screen.getByRole("tooltip")).toHaveTextContent("총콜레스테롤");
  expect(screen.getByRole("tooltip")).toHaveTextContent("188 mg/dL");
  expect(screen.getByRole("tooltip")).toHaveTextContent("2026. 7. 28.");
});

it("keeps the tooltip for a focused cell when the pointer leaves it", async () => {
  render(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={new Set()} onSelect={() => {}} />);
  const cell = screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL, 2026. 7. 28." });
  cell.focus();
  await userEvent.hover(cell);
  await userEvent.unhover(cell);
  expect(screen.getByRole("tooltip")).toHaveTextContent("총콜레스테롤");
  expect(cell).toHaveAttribute("aria-describedby", `cell-tip-${jul.eventId}`);
  fireEvent.blur(cell);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

it("draws one axis tick per month present in the data", () => {
  render(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={new Set()} onSelect={() => {}} />);
  expect(screen.getByText("2026. 1.")).toBeInTheDocument();
  expect(screen.getByText("2026. 7.")).toBeInTheDocument();
});

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

it("plays the arrival animation once for a new cell and not under prefers-reduced-motion", () => {
  stubReducedMotion(false);
  const animated = render(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={new Set([jul.eventId])} onSelect={() => {}} />);
  const newCell = screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL, 2026. 7. 28." });
  expect(newCell).toHaveAttribute("data-state", "new");
  expect(newCell).toHaveAttribute("data-arrived", "true");
  expect(newCell.getAttribute("class")).toMatch(/cellArrived/);
  expect(screen.getByRole("button", { name: "총콜레스테롤 194 mg/dL, 2026. 1. 15." })).not.toHaveAttribute("data-arrived");
  animated.unmount();

  stubReducedMotion(true);
  render(<LivingCellCanvas events={[jan, jul]} matchedIds={null} newIds={new Set([jul.eventId])} onSelect={() => {}} />);
  const still = screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL, 2026. 7. 28." });
  expect(still).toHaveAttribute("data-state", "new");
  expect(still).not.toHaveAttribute("data-arrived");
  expect(still.getAttribute("class")).not.toMatch(/cellArrived/);
  // @ts-expect-error jsdom has no matchMedia; remove the stub so other tests see the default.
  delete window.matchMedia;
});
