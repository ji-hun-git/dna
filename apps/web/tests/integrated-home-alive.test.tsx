import { cleanup, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { IntegratedHealthExperience } from "@/components/integrated/IntegratedHealthExperience";
import type { ChangeSummary, FoundationCandidate, FoundationRecord } from "@/lib/foundation/client";
import { syntheticDocumentId, syntheticRecord } from "./fixtures/foundation";

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

it("does not restart the hero effect when re-rendering the home with the same records", async () => {
  records = [syntheticRecord()];
  const { rerender } = render(<IntegratedHealthExperience />);
  await screen.findByRole("heading", { name: "가장 최근에 확인한 값" });

  const svg = document.querySelector("svg[role='img']")!;
  const axis = svg.querySelector('[data-role="axis"]')!;
  const firstD = axis.getAttribute("d");
  expect(firstD).toBeTruthy();

  // Re-rendering with an unrelated prop change (there are none on this component, so re-render
  // with the exact same element) must not tear down and recreate the hero's SVG subtree: the
  // same DOM node instance should still be there afterward, proving buildHomePhases/
  // homeIdentityCounts were memoised rather than rebuilt into fresh array identities every time.
  rerender(<IntegratedHealthExperience />);
  const svgAfter = document.querySelector("svg[role='img']")!;
  const axisAfter = svgAfter.querySelector('[data-role="axis"]')!;
  expect(axisAfter).toBe(axis);
});

it("shows no current-phase marker on the phase strip when there are no records", async () => {
  render(<IntegratedHealthExperience />);
  await screen.findByRole("heading", { name: "아직 저장된 기록이 없어요" });
  const strip = document.querySelector("nav[aria-label='검진 시기']")!;
  expect(within(strip as HTMLElement).getByText(/다음 결과지/)).toBeInTheDocument();
  // No phase item is marked current: the marker text (" · 현재") never appears anywhere in the
  // strip when there is no ring at all (the trailing open phase alone must not claim it).
  expect(within(strip as HTMLElement).queryByText(/· 현재/)).toBeNull();
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
