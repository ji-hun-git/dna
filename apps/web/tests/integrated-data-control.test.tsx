import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { IntegratedDataControl } from "@/components/integrated/IntegratedDataControl";

const consentId = "89116f1a-2026-457e-8942-409ff8f8fc4f";
let consentStatus: "NOT_GRANTED" | "ACTIVE" | "REVOKED" = "ACTIVE";

const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json({
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b",
    subjectId: "synthetic-jason",
    status: "AUTHENTICATED",
    expiresAt: "2026-07-28T23:00:00Z",
  })),
  http.get("/api/foundation/consents/document-extraction", () => HttpResponse.json({
    consentId,
    purposeCode: "DOCUMENT_EXTRACTION",
    status: consentStatus,
  })),
  http.post("/api/foundation/consents/:consentId/revocation", () => {
    consentStatus = "REVOKED";
    return HttpResponse.json({ consentId, purposeCode: "DOCUMENT_EXTRACTION", status: consentStatus });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  consentStatus = "ACTIVE";
  document.cookie = "GC_CSRF=synthetic-data-control-csrf-value";
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

it("names the granted and revoked consent state in Korean, keeping the machine state in data-status", async () => {
  render(<IntegratedDataControl />);

  await waitFor(() => expect(screen.getAllByText("동의함")).toHaveLength(2));
  expect(screen.queryByText("ACTIVE")).toBeNull();
  expect(document.querySelector("[data-status='active']")).not.toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "동의 철회" }));

  await waitFor(() => expect(screen.getAllByText("철회함")).toHaveLength(2));
  expect(screen.queryByText("REVOKED")).toBeNull();
  expect(document.querySelector("[data-status='revoked']")).not.toBeNull();
});

it("names a consent the server has never granted in Korean", async () => {
  consentStatus = "NOT_GRANTED";

  render(<IntegratedDataControl />);

  await waitFor(() => expect(screen.getAllByText("동의 전")).toHaveLength(2));
  expect(screen.queryByText("NOT_GRANTED")).toBeNull();
});
