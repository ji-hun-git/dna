import { cleanup, render, screen } from "@testing-library/react";
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
