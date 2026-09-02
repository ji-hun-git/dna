import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { RecordComparison } from "@/components/integrated/RecordComparison";
import type { RecordComparison as RecordComparisonEntry } from "@/lib/records/compare-records";

afterEach(cleanup);

const comparisons: RecordComparisonEntry[] = [
  {
    label: "당화혈색소",
    unit: "%",
    earlier: { observedOn: "2026-01-15", value: "5.4" },
    later: { observedOn: "2026-07-28", value: "5.2" },
  },
  {
    label: "총콜레스테롤",
    unit: "mg/dL",
    earlier: { observedOn: "2026-01-15", value: "194" },
    later: { observedOn: "2026-07-28", value: "190" },
  },
];

it("puts the two dated values of one item side by side in Korean", () => {
  render(<RecordComparison comparisons={comparisons} />);

  expect(screen.getByRole("heading", { name: "날짜별로 본 내 기록" })).toBeVisible();
  expect(screen.getByText(
    "같은 항목의 두 날짜 값을 그대로 나란히 둔 목록이에요. 변화의 의미는 판단하지 않아요.",
  )).toBeVisible();

  const items = screen.getAllByTestId("record-comparison-item");
  expect(items.map((item) => item.textContent)).toEqual([
    "당화혈색소 · 2026. 1. 15. 5.4 % → 2026. 7. 28. 5.2 %",
    "총콜레스테롤 · 2026. 1. 15. 194 mg/dL → 2026. 7. 28. 190 mg/dL",
  ]);
});

it("shows Korean dates instead of the raw server date strings", () => {
  render(<RecordComparison comparisons={comparisons} />);

  for (const item of screen.getAllByTestId("record-comparison-item")) {
    expect(item.textContent).not.toContain("2026-01-15");
    expect(item.textContent).not.toContain("2026-07-28");
  }
});

it("explains the empty list without judging anything", () => {
  render(<RecordComparison comparisons={[]} />);

  expect(screen.getByText("두 날짜 이상 확인한 항목이 아직 없어요.")).toBeVisible();
  expect(screen.queryAllByTestId("record-comparison-item")).toHaveLength(0);
});

it("stays accessible with and without comparisons", async () => {
  const filled = render(<RecordComparison comparisons={comparisons} />);
  expect(await axe(filled.container)).toHaveNoViolations();
  cleanup();

  const empty = render(<RecordComparison comparisons={[]} />);
  expect(await axe(empty.container)).toHaveNoViolations();
});
