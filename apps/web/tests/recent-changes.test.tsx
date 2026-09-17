import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { RecentChanges } from "@/components/integrated/RecentChanges";
import type { ChangeSummary } from "@/lib/foundation/client";

const summary: ChangeSummary = {
  latestDocument: {
    documentId: "e64ddaae-a326-4f23-88a9-05ac59a48625",
    observedOn: "2026-07-28",
    completedAt: "2026-07-28T09:20:00Z",
    eventCount: 2,
  },
  items: [
    {
      conceptCode: "total-cholesterol",
      concept: "총콜레스테롤",
      unit: "mg/dL",
      latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
      previous: { eventId: "9c3e4f50-6172-4c8d-ae9f-1a2b3c4d5e60", value: "194", observedOn: "2026-01-15" },
      delta: { absolute: "-6", percent: "-3.1" },
    },
    {
      conceptCode: "vitamin-d",
      concept: "비타민 D",
      unit: "ng/mL",
      latest: { eventId: "ad4f5061-7283-4d9e-bfa0-2b3c4d5e6f70", value: "42", observedOn: "2026-07-28" },
      previous: null,
    },
  ],
  newConcepts: ["비타민 D"],
  unchangedCount: 1,
};

afterEach(cleanup);

it("states this time's value and the previous value of each item side by side without judging", () => {
  render(<RecentChanges changes={summary} />);

  expect(screen.getByRole("heading", { name: "최근 변화" })).toBeVisible();
  expect(screen.getByText("새 결과지 · 2026. 7. 28.")).toBeVisible();
  expect(screen.getByText("새 기록 2개")).toBeVisible();
  expect(screen.getByText("새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요.")).toBeVisible();
  expect(screen.getAllByTestId("change-item").map((item) => item.textContent)).toEqual([
    "총콜레스테롤 · 이번 2026. 7. 28. 188 mg/dL · 이전 2026. 1. 15. 194 mg/dL",
    "비타민 D · 이번 2026. 7. 28. 42 ng/mL · 이전 값 없음",
  ]);
  expect(screen.getByText("이전 값이 없는 항목: 비타민 D")).toBeVisible();
  expect(document.body.textContent).not.toMatch(/→|↑|↓|증가|감소|상승|하락|정상|비정상|위험/);
});

it("states the arithmetic difference as a signed number with no direction, colour or icon", () => {
  render(<RecentChanges changes={summary} />);

  const deltas = screen.getAllByTestId("change-delta");
  expect(deltas.map((line) => line.textContent)).toEqual(["두 값의 차이: -6 mg/dL (-3.1%)"]);
  expect(screen.getAllByTestId("change-item").map((item) => item.textContent)).toEqual([
    "총콜레스테롤 · 이번 2026. 7. 28. 188 mg/dL · 이전 2026. 1. 15. 194 mg/dL",
    "비타민 D · 이번 2026. 7. 28. 42 ng/mL · 이전 값 없음",
  ]);
  expect(deltas[0].querySelector("svg, img, [style]")).toBeNull();
  expect(document.body.textContent).not.toMatch(/→|↑|↓|▲|▼|증가|감소|상승|하락|높|낮|정상|비정상|위험/);
});

it("omits the percentage when the previous value was zero and the whole line when there is no delta", () => {
  const zeroPrevious: ChangeSummary = {
    ...summary,
    items: [
      { ...summary.items[0], delta: { absolute: "+12", percent: null } },
      { ...summary.items[1] },
    ],
  };
  render(<RecentChanges changes={zeroPrevious} />);
  expect(screen.getAllByTestId("change-delta").map((line) => line.textContent)).toEqual(["두 값의 차이: +12 mg/dL"]);
});

it("renders nothing without a latest document or without items", () => {
  const empty = render(<RecentChanges changes={{ items: [], newConcepts: [], unchangedCount: 0 }} />);
  expect(empty.container).toBeEmptyDOMElement();
  cleanup();
  const noItems = render(<RecentChanges changes={{ ...summary, items: [], newConcepts: [] }} />);
  expect(noItems.container).toBeEmptyDOMElement();
});
