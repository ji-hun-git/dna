import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { IntegratedHealthExperience } from "@/components/integrated/IntegratedHealthExperience";
import type { FoundationCandidate, FoundationRecord } from "@/lib/foundation/client";
import { syntheticCandidates, syntheticDocumentId } from "./fixtures/foundation";

let candidates: FoundationCandidate[] = [];
let records: FoundationRecord[] = [];

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
  http.get("/api/foundation/documents/active", () => HttpResponse.json({
    document: {
      documentId: syntheticDocumentId,
      status: "REVIEW_REQUIRED",
      sha256: "a".repeat(64),
      contentLength: 2048,
      stateVersion: 4,
      previewAvailable: true,
      quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
    },
  })),
  http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json(candidates)),
  http.post("/api/foundation/candidates/:candidateId/confirmation", async ({ params, request }) => {
    const { value } = await request.json() as { value: string };
    const target = candidates.find((item) => item.candidateId === params.candidateId)!;
    candidates = candidates.map((item) => item.candidateId === target.candidateId
      ? { ...item, status: "CONFIRMED" }
      : item);
    const record: FoundationRecord = {
      recordId: crypto.randomUUID(),
      recordVersionId: crypto.randomUUID(),
      candidateId: target.candidateId,
      documentId: target.documentId,
      status: "CURRENT",
      reviewDecision: value === target.value ? "CONFIRMED" : "CORRECTED",
      label: target.label,
      value,
      originalValue: target.value,
      unit: target.unit,
      observedOn: target.observedOn,
      confirmedAt: "2026-07-28T09:20:00Z",
      evidencePage: target.evidencePage,
      sourceTextSha256: target.sourceTextSha256,
      documentSha256: target.documentSha256,
    };
    records = [...records, record];
    return HttpResponse.json(record, { status: 201 });
  }),
  http.post("/api/foundation/candidates/:candidateId/exclusion", ({ params }) => {
    candidates = candidates.map((item) => item.candidateId === params.candidateId
      ? { ...item, status: "EXCLUDED" }
      : item);
    return HttpResponse.json(candidates.find((item) => item.candidateId === params.candidateId));
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

beforeEach(() => {
  candidates = syntheticCandidates.map((candidate) => ({ ...candidate }));
  records = [];
  document.cookie = "GC_CSRF=synthetic-review-csrf-value";
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

it("walks every candidate of one document before reporting the result", async () => {
  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "이 합성 후보가 맞나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");
  expect(screen.getByRole("heading", { level: 2, name: "총콜레스테롤" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "원문과 같아요" }));

  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3"));
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "값 수정" }));
  const correction = screen.getByLabelText("원문과 같은 값으로 수정");
  await userEvent.clear(correction);
  await userEvent.type(correction, "5.4");
  await userEvent.click(screen.getByRole("button", { name: "수정한 값 확인" }));

  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("3 / 3"));
  expect(screen.getByRole("heading", { level: 2, name: "비타민 D" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "이 항목 빼기" }));

  expect(await screen.findByText("저장 2개 · 제외 1개")).toBeVisible();
  expect(screen.getByRole("link", { name: "진료 준비 목록 보기" })).toHaveAttribute("href", "/prepare");
  expect(screen.getByRole("link", { name: "저장된 기록 보기" })).toHaveAttribute("href", "/records");
});

it("resumes at the first candidate the person has not decided yet", async () => {
  candidates = candidates.map((candidate) => candidate.ordinal === 1
    ? { ...candidate, status: "CONFIRMED" }
    : candidate);

  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "이 합성 후보가 맞나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3");
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();
});

it("re-reads the server list when the server says the candidate is no longer pending", async () => {
  server.use(
    http.post("/api/foundation/candidates/:candidateId/confirmation", () => {
      candidates = candidates.map((item) => item.ordinal === 1
        ? { ...item, status: "CONFIRMED" }
        : item);
      return HttpResponse.json({ code: "candidate_not_pending" }, { status: 409 });
    }, { once: true }),
  );

  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "이 합성 후보가 맞나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");

  await userEvent.click(screen.getByRole("button", { name: "원문과 같아요" }));

  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3"));
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("현재 처리 단계에서는 이 작업을 진행할 수 없어요.");
});
