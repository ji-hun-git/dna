import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { IntegratedRecords } from "@/components/integrated/IntegratedRecords";
import { syntheticRecord } from "./fixtures/foundation";

const olderDocumentSha256 = "e".repeat(64);

const records = [
  syntheticRecord({
    recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c40",
    recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50",
    label: "총콜레스테롤",
    value: "188",
    originalValue: "188",
    unit: "mg/dL",
    observedOn: "2026-07-28",
    documentSha256: olderDocumentSha256,
  }),
  syntheticRecord({
    recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c41",
    recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51",
    label: "당화혈색소",
    value: "6.1",
    originalValue: "6.1",
    unit: "%",
    observedOn: "2026-07-28",
    documentSha256: olderDocumentSha256,
  }),
  syntheticRecord({
    recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c42",
    recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d52",
    label: "비타민 D",
    value: "31",
    originalValue: "31",
    unit: "ng/mL",
    observedOn: "2026-08-11",
  }),
];

const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json({
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b",
    subjectId: "synthetic-jason",
    status: "AUTHENTICATED",
    expiresAt: "2026-08-30T08:30:00Z",
  })),
  http.get("/api/foundation/records", () => HttpResponse.json(records)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

it("groups records by the day and the document they came from, newest first", async () => {
  render(<IntegratedRecords />);

  expect(await screen.findByRole("heading", { name: "현재 기록 3개" })).toBeVisible();
  const groupHeadings = screen.getAllByRole("heading", { level: 3 });
  expect(groupHeadings.map((heading) => heading.textContent)).toEqual([
    "2026. 8. 11. · 결과지 aaaaaaaaaaaa…aaaaaaaa",
    "2026. 7. 28. · 결과지 eeeeeeeeeeee…eeeeeeee",
  ]);
  expect(screen.getAllByTestId("durable-record")).toHaveLength(3);
});

it("keeps every group reachable and accessible", async () => {
  const { container } = render(<IntegratedRecords />);

  await screen.findByRole("heading", { name: "현재 기록 3개" });
  expect(await axe(container)).toHaveNoViolations();
});

const twoDateRecords = [
  syntheticRecord({
    recordId: "9c1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c50",
    recordVersionId: "9d2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d60",
    label: "총콜레스테롤",
    value: "190",
    originalValue: "188",
    reviewDecision: "CORRECTED",
    unit: "mg/dL",
    observedOn: "2026-07-28",
    confirmedAt: "2026-07-28T09:10:00Z",
  }),
  syntheticRecord({
    recordId: "9c1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c51",
    recordVersionId: "9d2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d61",
    label: "총콜레스테롤",
    value: "194",
    originalValue: "194",
    unit: "mg/dL",
    observedOn: "2026-01-15",
    documentSha256: olderDocumentSha256,
    confirmedAt: "2026-01-15T09:10:00Z",
  }),
  syntheticRecord({
    recordId: "9c1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c52",
    recordVersionId: "9d2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d62",
    label: "비타민 D",
    value: "38",
    originalValue: "38",
    unit: "ng/mL",
    observedOn: "2026-01-15",
    documentSha256: olderDocumentSha256,
    confirmedAt: "2026-01-15T09:10:01Z",
  }),
];

it("puts the two dated values of the same item above the groups", async () => {
  server.use(http.get("/api/foundation/records", () => HttpResponse.json(twoDateRecords)));

  render(<IntegratedRecords />);

  expect(await screen.findByRole("heading", { name: "날짜별로 본 내 기록" })).toBeVisible();
  expect(screen.getByText(
    "같은 항목의 두 날짜 값을 그대로 나란히 둔 목록이에요. 변화의 의미는 판단하지 않아요.",
  )).toBeVisible();
  const items = screen.getAllByTestId("record-comparison-item");
  expect(items.map((item) => item.textContent)).toEqual([
    "총콜레스테롤 · 2026. 1. 15. 194 mg/dL → 2026. 7. 28. 190 mg/dL",
  ]);
});

it("hides the comparison entirely while every item has a single date", async () => {
  render(<IntegratedRecords />);

  await screen.findByRole("heading", { name: "현재 기록 3개" });
  expect(screen.queryByRole("heading", { name: "날짜별로 본 내 기록" })).toBeNull();
  expect(screen.queryAllByTestId("record-comparison-item")).toHaveLength(0);
});

it("names the record state in Korean instead of the server enum", async () => {
  const user = userEvent.setup();
  render(<IntegratedRecords />);

  await screen.findByRole("heading", { name: "현재 기록 3개" });
  await user.click(screen.getAllByText("출처와 버전 보기")[0]);

  expect(screen.getAllByText("현재 값")[0]).toBeVisible();
  expect(screen.queryByText("CURRENT")).toBeNull();
});

it("keeps the comparison and the groups accessible together", async () => {
  server.use(http.get("/api/foundation/records", () => HttpResponse.json(twoDateRecords)));

  const { container } = render(<IntegratedRecords />);

  await screen.findByRole("heading", { name: "날짜별로 본 내 기록" });
  expect(await axe(container)).toHaveNoViolations();
});
