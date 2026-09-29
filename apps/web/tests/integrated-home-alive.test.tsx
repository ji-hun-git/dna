import { cleanup, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { IntegratedHealthExperience } from "@/components/integrated/IntegratedHealthExperience";
import type { ChangeSummary, FoundationCandidate, FoundationRecord } from "@/lib/foundation/client";
import { syntheticRecord } from "./fixtures/foundation";

let candidates: FoundationCandidate[] = [];
let records: FoundationRecord[] = [];
let changes: ChangeSummary = { items: [], newConcepts: [], unchangedCount: 0 };

const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json({
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b",
    subjectId: "synthetic-jason",
    status: "AUTHENTICATED",
    expiresAt: "2026-07-28T23:00:00Z",
  })),
  http.get("/api/foundation/consents/document-extraction", () => HttpResponse.json({
    consentId: "89116f1a-2026-457e-8942-409ff8f8fc4f",
    purposeCode: "DOCUMENT_EXTRACTION",
    status: "ACTIVE",
  })),
  http.get("/api/foundation/records", () => HttpResponse.json(records)),
  http.get("/api/foundation/changes", () => HttpResponse.json(changes)),
  http.get("/api/foundation/documents/active", () => HttpResponse.json({})),
  http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json(candidates)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  candidates = [];
  records = [];
  changes = { items: [], newConcepts: [], unchangedCount: 0 };
  document.cookie = "GC_CSRF=synthetic-home-csrf-value";
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

it("renders the two action links as separate block elements, never run together inline", async () => {
  render(<IntegratedHealthExperience />);
  const dataControlLink = await screen.findByRole("link", { name: "동의와 삭제 상태 보기" });
  const prepareLink = screen.getByRole("link", { name: "진료 때 물어볼 내용 준비" });
  // Each link's own parent must be a block-level wrapper (its own <p> or list item), and the two
  // links must not share the same parent element the way inline run-together text would.
  expect(dataControlLink.parentElement).not.toBeNull();
  expect(prepareLink.parentElement).not.toBeNull();
  expect(dataControlLink.parentElement).not.toBe(prepareLink.parentElement);
  expect(["P", "LI"]).toContain(dataControlLink.parentElement!.tagName);
  expect(["P", "LI"]).toContain(prepareLink.parentElement!.tagName);
});

it("prioritizes saved records without a decorative chart or invented personal profile", async () => {
  records = [syntheticRecord()];
  const { rerender } = render(<IntegratedHealthExperience />);
  await screen.findByRole("heading", { name: "가장 최근에 확인한 값" });

  expect(document.querySelector("svg[role='img']")).toBeNull();
  expect(screen.queryByText("프로필 · 예시")).toBeNull();
  expect(screen.getByRole("region", { name: "내 기록 요약" })).toHaveTextContent("1");
  rerender(<IntegratedHealthExperience />);
  expect(screen.getByRole("table")).toBeInTheDocument();
});

it("gives an honest empty state with a useful next action and no example values", async () => {
  render(<IntegratedHealthExperience />);
  await screen.findByRole("heading", { name: "아직 저장된 기록이 없어요" });
  expect(screen.getByRole("button", { name: "결과지 추가" })).toBeEnabled();
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("region", { name: "내 기록 요약" })).toHaveTextContent("아직 없음");
});

it("sorts the home records table by exam date descending, not server insertion order", async () => {
  records = [
    syntheticRecord({
      recordId: "11111111-1111-4111-8111-111111111111",
      recordVersionId: "11111111-1111-4111-8111-111111111112",
      documentId: "11111111-1111-4111-8111-111111111113",
      label: "오래된 값", observedOn: "2025-01-20", confirmedAt: "2025-01-20T09:00:00Z",
      documentSha256: "a".repeat(64), sourceTextSha256: "a".repeat(64),
    }),
    syntheticRecord({
      recordId: "22222222-2222-4222-8222-222222222221",
      recordVersionId: "22222222-2222-4222-8222-222222222222",
      documentId: "22222222-2222-4222-8222-222222222223",
      label: "최신 값", observedOn: "2026-07-28", confirmedAt: "2026-07-28T09:00:00Z",
      documentSha256: "b".repeat(64), sourceTextSha256: "b".repeat(64),
    }),
  ];
  render(<IntegratedHealthExperience />);
  await screen.findByRole("heading", { name: "가장 최근에 확인한 값" });
  const table = screen.getByRole("table");
  const itemCells = within(table).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);
  expect(itemCells).toEqual(["최신 값", "오래된 값"]);
});
