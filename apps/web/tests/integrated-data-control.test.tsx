import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { IntegratedDataControl } from "@/components/integrated/IntegratedDataControl";

type PurposeCode = "DOCUMENT_EXTRACTION" | "RESEARCH_USE" | "RESEARCH_CONTACT";
type ConsentState = { consentId?: string; status: "NOT_GRANTED" | "ACTIVE" | "REVOKED" };

const documentConsentId = "89116f1a-2026-457e-8942-409ff8f8fc4f";
const policyVersions: Record<PurposeCode, string> = {
  DOCUMENT_EXTRACTION: "foundation-v1",
  RESEARCH_USE: "research-consent-policy.v1",
  RESEARCH_CONTACT: "research-contact-policy.v1",
};
let consents: Record<PurposeCode, ConsentState>;
let grantHeaders: Array<string | null> = [];
let revokedIds: string[] = [];

function row(purposeCode: PurposeCode) {
  const state = consents[purposeCode];
  return {
    consentId: state.consentId,
    purposeCode,
    status: state.status,
    policyVersion: policyVersions[purposeCode],
    grantedAt: state.consentId ? "2026-07-28T09:00:00Z" : undefined,
    revokedAt: state.status === "REVOKED" ? "2026-07-28T10:00:00Z" : undefined,
  };
}

const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json({
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b",
    subjectId: "synthetic-jason",
    status: "AUTHENTICATED",
    expiresAt: "2026-07-28T23:00:00Z",
  })),
  http.get("/api/foundation/consents", () => HttpResponse.json(
    (["DOCUMENT_EXTRACTION", "RESEARCH_USE", "RESEARCH_CONTACT"] as const).map(row),
  )),
  http.post("/api/foundation/consents/:purposeCode", ({ params, request }) => {
    const purposeCode = decodeURIComponent(String(params.purposeCode)) as PurposeCode;
    grantHeaders.push(request.headers.get("Idempotency-Key"));
    consents[purposeCode] = { consentId: crypto.randomUUID(), status: "ACTIVE" };
    return HttpResponse.json(row(purposeCode), { status: 201 });
  }),
  http.post("/api/foundation/consents/:consentId/revocation", ({ params }) => {
    const consentId = String(params.consentId);
    revokedIds.push(consentId);
    const purposeCode = (Object.keys(consents) as PurposeCode[]).find((code) => consents[code].consentId === consentId)!;
    consents[purposeCode] = { consentId, status: "REVOKED" };
    return HttpResponse.json({ consentId, purposeCode, status: "REVOKED" });
  }),
  http.get("/api/foundation/health-events", () => HttpResponse.json([])),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  consents = {
    DOCUMENT_EXTRACTION: { consentId: documentConsentId, status: "ACTIVE" },
    RESEARCH_USE: { status: "NOT_GRANTED" },
    RESEARCH_CONTACT: { status: "NOT_GRANTED" },
  };
  grantHeaders = [];
  revokedIds = [];
  document.cookie = "GC_CSRF=synthetic-data-control-csrf-value";
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

function purposeRow(purpose: string) {
  return within(document.querySelector(`article[data-purpose='${purpose}']`) as HTMLElement);
}

it("lists the four purposes in Korean with the fixed sentences and no raw enum", async () => {
  render(<IntegratedDataControl />);

  expect(await screen.findByRole("heading", { name: "서비스 제공(결과지 처리)" })).toBeVisible();
  for (const title of ["연구 활용", "연구 연락", "프로젝트별"]) {
    expect(screen.getByRole("heading", { name: title })).toBeVisible();
  }
  expect(screen.getByText("연구 동의 없이도 모든 기능을 쓸 수 있어요.", { exact: false })).toBeVisible();
  expect(screen.getByText("가명처리 후 연구에 쓰는 것에 대한 선택. 지금은 진행 중인 연구가 없어요.")).toBeVisible();
  expect(screen.getByText("적합한 연구가 있을 때 참여 제안을 받을지. 지금은 연락 채널이 없어요.")).toBeVisible();
  expect(screen.getByText("프로젝트가 생기면 여기서 개별로 물어요.")).toBeVisible();
  expect(purposeRow("DOCUMENT_EXTRACTION").getByText("동의함")).toBeVisible();
  expect(purposeRow("RESEARCH_USE").getByText("동의 전")).toBeVisible();
  expect(purposeRow("RESEARCH_CONTACT").getByText("동의 전")).toBeVisible();
  expect(screen.getByRole("button", { name: "결과지 처리 동의 철회" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "연구 활용 동의" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "연구 연락 동의" })).toBeEnabled();
  expect(screen.queryByText("ACTIVE")).toBeNull();
  expect(screen.queryByText("NOT_GRANTED")).toBeNull();
  expect(screen.queryByText("RESEARCH_USE")).toBeNull();
});

it("grants and revokes a research consent without touching the document consent", async () => {
  render(<IntegratedDataControl />);
  await screen.findByRole("button", { name: "연구 활용 동의" });

  await userEvent.click(screen.getByRole("button", { name: "연구 활용 동의" }));

  expect(await screen.findByRole("button", { name: "연구 활용 동의 철회" })).toBeEnabled();
  expect(purposeRow("RESEARCH_USE").getByText("동의함")).toBeVisible();
  expect(purposeRow("DOCUMENT_EXTRACTION").getByText("동의함")).toBeVisible();
  expect(purposeRow("RESEARCH_CONTACT").getByText("동의 전")).toBeVisible();
  expect(grantHeaders).toHaveLength(1);
  expect(grantHeaders[0]).toMatch(/^consent-[0-9a-f-]{36}$/);
  expect(screen.getByText("연구 활용 동의를 서버에 기록했어요.")).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "연구 활용 동의 철회" }));

  await waitFor(() => expect(purposeRow("RESEARCH_USE").getByText("철회함")).toBeVisible());
  expect(revokedIds).toEqual([consents.RESEARCH_USE.consentId]);
  expect(purposeRow("DOCUMENT_EXTRACTION").getByText("동의함")).toBeVisible();
  expect(screen.getByRole("button", { name: "결과지 처리 동의 철회" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "연구 활용 동의" })).toBeEnabled();
  expect(screen.queryByText("REVOKED")).toBeNull();
});

it("revokes the document consent from its own labelled button", async () => {
  render(<IntegratedDataControl />);

  await userEvent.click(await screen.findByRole("button", { name: "결과지 처리 동의 철회" }));

  await waitFor(() => expect(screen.getAllByText("철회함")).toHaveLength(2));
  expect(revokedIds).toEqual([documentConsentId]);
  expect(document.querySelector("article[data-purpose='DOCUMENT_EXTRACTION']")).toHaveAttribute("data-status", "revoked");
  expect(screen.getByText("결과지 처리 동의를 서버에서 철회했어요.")).toBeVisible();
  expect(screen.getByRole("button", { name: "결과지 처리 동의" })).toBeEnabled();
});

it("names a consent the server has never granted in Korean", async () => {
  consents.DOCUMENT_EXTRACTION = { status: "NOT_GRANTED" };

  render(<IntegratedDataControl />);

  await waitFor(() => expect(screen.getAllByText("동의 전")).toHaveLength(4));
  expect(screen.queryByText("NOT_GRANTED")).toBeNull();
  expect(document.querySelector("article[data-purpose='DOCUMENT_EXTRACTION']")).toHaveAttribute("data-status", "revoked");
});
