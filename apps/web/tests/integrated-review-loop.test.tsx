import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { IntegratedHealthExperience } from "@/components/integrated/IntegratedHealthExperience";
import type { ChangeSummary, FoundationCandidate, FoundationRecord } from "@/lib/foundation/client";
import { syntheticCandidates, syntheticDocumentId } from "./fixtures/foundation";

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
    const { value, observedOn } = await request.json() as { value: string; observedOn?: string };
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
      reviewDecision: value === target.value && (!observedOn || observedOn === target.observedOn) ? "CONFIRMED" : "CORRECTED",
      label: target.label,
      value,
      originalValue: target.value,
      unit: target.unit,
      observedOn: observedOn ?? target.observedOn,
      originalObservedOn: target.observedOn,
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
  changes = { items: [], newConcepts: [], unchangedCount: 0 };
  document.cookie = "GC_CSRF=synthetic-review-csrf-value";
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

it.each([
  "/api/foundation/session",
  "/api/foundation/records",
  "/api/foundation/documents/:documentId/candidates",
])("retries failed restoration at %s without offering a new demo identity", async (endpoint) => {
  let unavailable = true;
  const bootstrap = vi.fn(() => HttpResponse.json({}, { status: 500 }));
  server.use(
    http.post("/api/foundation/demo-session", bootstrap),
    http.get(endpoint, () => unavailable
      ? HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 503 })
      : undefined),
  );
  render(<IntegratedHealthExperience />);
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 응답하지 않아요");
  expect(screen.queryByRole("button", { name: "체험 시작" })).toBeNull();
  unavailable = false;
  await userEvent.click(screen.getByRole("button", { name: "체험 상태 다시 확인" }));
  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");
  expect(bootstrap).not.toHaveBeenCalled();
});

it("does not bootstrap twice when the first bootstrap succeeds but its following read fails", async () => {
  let issued = false;
  let unavailable = true;
  const session = {
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b",
    subjectId: "synthetic-bootstrap-recovery",
    status: "AUTHENTICATED",
    expiresAt: "2026-09-08T09:00:00Z",
  };
  const bootstrap = vi.fn(() => {
    issued = true;
    return HttpResponse.json({ ...session, csrfToken: "synthetic-recovery-csrf-value-000001" });
  });
  server.use(
    http.get("/api/foundation/session", () => issued ? HttpResponse.json(session)
      : HttpResponse.json({ code: "authentication_required" }, { status: 401 })),
    http.post("/api/foundation/demo-session", bootstrap),
    http.get("/api/foundation/records", () => unavailable
      ? HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 503 }) : undefined),
  );
  render(<IntegratedHealthExperience />);
  await userEvent.click(await screen.findByRole("button", { name: "체험 시작" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 응답하지 않아요");
  expect(screen.queryByRole("button", { name: "체험 시작" })).toBeNull();
  unavailable = false;
  await userEvent.click(screen.getByRole("button", { name: "체험 상태 다시 확인" }));
  expect(await screen.findByLabelText("검토 진행")).toHaveTextContent("1 / 3");
  expect(bootstrap).toHaveBeenCalledTimes(1);
});

it("offers a new demo only after the server reports an expired session", async () => {
  server.use(http.get("/api/foundation/session", () =>
    HttpResponse.json({ code: "session_expired" }, { status: 401 })));
  render(<IntegratedHealthExperience />);
  expect(await screen.findByRole("button", { name: "체험 시작" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "체험 상태 다시 확인" })).toBeNull();
  expect(screen.queryByLabelText("검토 진행")).toBeNull();
});

it("walks every candidate of one document before reporting the result", async () => {
  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");
  expect(screen.getByRole("heading", { level: 2, name: "총콜레스테롤" })).toBeVisible();
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "확인: 원문과 같아요" }));

  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3"));
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "값 수정" }));
  const correction = screen.getByLabelText("원문과 같은 값으로 수정");
  await userEvent.clear(correction);
  await userEvent.type(correction, "5.4");
  await userEvent.click(screen.getByRole("button", { name: "수정한 값 확인" }));

  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("3 / 3"));
  expect(screen.getByRole("heading", { level: 2, name: "비타민 D" })).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "제외: 이 항목 빼기" }));

  expect(await screen.findByText("저장 2개 · 제외 1개")).toBeVisible();
  expect(screen.getByText("원문과 같음")).toBeVisible();
  expect(screen.getByText("값을 수정함")).toBeVisible();
  expect(screen.queryByText("CONFIRMED")).toBeNull();
  expect(screen.queryByText("CORRECTED")).toBeNull();
  expect(screen.getByRole("link", { name: "진료 준비 목록 보기" })).toHaveAttribute("href", "/prepare");
  expect(screen.getByRole("link", { name: "저장된 기록 보기" })).toHaveAttribute("href", "/records");
});

it("resumes at the first candidate the person has not decided yet", async () => {
  candidates = candidates.map((candidate) => candidate.ordinal === 1
    ? { ...candidate, status: "CONFIRMED" }
    : candidate);

  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3");
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();
});

it("resumes an unfinished review after closing it without starting another import", async () => {
  render(<IntegratedHealthExperience />);
  await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" });
  await userEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(screen.queryByRole("button", { name: "결과지 추가" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "이어서 확인" }));
  expect(screen.getByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");
});

it("resumes the pending candidate directly after going back to processing", async () => {
  render(<IntegratedHealthExperience />);
  await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" });
  await userEvent.click(screen.getByRole("button", { name: "제외: 이 항목 빼기" }));
  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3"));
  await userEvent.click(screen.getByRole("button", { name: "이전" }));
  expect(screen.getByLabelText("서버 상태 코드")).toHaveTextContent("REVIEW_REQUIRED");
  await userEvent.click(screen.getByRole("button", { name: "이어서 확인" }));
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3");
  expect(records).toHaveLength(0);
  expect(candidates[0].status).toBe("EXCLUDED");
});

it("returns home from processing without offering a replacement import", async () => {
  render(<IntegratedHealthExperience />);
  await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" });
  await userEvent.click(screen.getByRole("button", { name: "이전" }));
  await userEvent.click(screen.getByRole("button", { name: "이전" }));
  expect(screen.queryByRole("button", { name: "7월 예시 결과지로 시작" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "이어서 확인" }));
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");
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

  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("1 / 3");

  fireEvent.load(screen.getByRole("img"));
  await userEvent.click(screen.getByRole("button", { name: "확인: 원문과 같아요" }));

  await waitFor(() => expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3"));
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("현재 처리 단계에서는 이 작업을 진행할 수 없어요.");
});

it("shows the review position label of the candidate in Korean", async () => {
  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible();
  expect(screen.getByText("확인 대기")).toBeVisible();
  expect(screen.queryByText("PENDING")).toBeNull();
});

it("says what the server is doing and keeps the raw status word inside a labelled code element", async () => {
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({
      document: {
        documentId: syntheticDocumentId,
        status: "SECURITY_INSPECTION",
        sha256: "a".repeat(64),
        contentLength: 2048,
        stateVersion: 2,
        previewAvailable: false,
        quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
      },
    })),
    http.get("/api/foundation/documents/:documentId", () => HttpResponse.json({
      documentId: syntheticDocumentId,
      status: "SECURITY_INSPECTION",
      sha256: "a".repeat(64),
      contentLength: 2048,
      stateVersion: 2,
      previewAvailable: false,
      quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
    })),
  );

  render(<IntegratedHealthExperience />);

  const documentState = await screen.findByText("문서 상태");
  expect(documentState.parentElement).toHaveTextContent(
    "격리된 작업자가 문서를 안전하게 확인하고 있어요 SECURITY_INSPECTION",
  );
  expect(screen.getByLabelText("서버 상태 코드")).toHaveTextContent("SECURITY_INSPECTION");
});

it("names the consent state in Korean before the person has agreed", async () => {
  server.use(
    http.get("/api/foundation/consents/document-extraction", () => HttpResponse.json({
      purposeCode: "DOCUMENT_EXTRACTION",
      status: "NOT_GRANTED",
    })),
    http.get("/api/foundation/documents/active", () => HttpResponse.json({})),
  );

  render(<IntegratedHealthExperience />);

  await userEvent.click(await screen.findByRole("button", { name: "결과지 추가" }));

  expect(screen.getByRole("heading", { name: "결과지에서 항목을 확인해도 될까요?" })).toBeVisible();
  expect(screen.getByText("동의 전")).toBeVisible();
  expect(screen.queryByText("NOT_GRANTED")).toBeNull();
});

it("shows the latest saved value's record row on the home screen with a humanised state, never the raw server enum", async () => {
  records = [{
    recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c40",
    recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50",
    candidateId: syntheticCandidates[0].candidateId,
    documentId: syntheticDocumentId,
    status: "CURRENT",
    reviewDecision: "CONFIRMED",
    label: "총콜레스테롤",
    value: "188",
    originalValue: "188",
    unit: "mg/dL",
    observedOn: "2026-07-28",
    originalObservedOn: "2026-07-28",
    confirmedAt: "2026-07-28T09:10:00Z",
    evidencePage: 1,
    sourceTextSha256: "b".repeat(64),
    documentSha256: "a".repeat(64),
  }];
  server.use(http.get("/api/foundation/documents/active", () => HttpResponse.json({})));

  render(<IntegratedHealthExperience />);

  // v5: the home screen is the alive-trajectory grid; the latest record now renders as a row
  // in the records panel's table (state column always "직접 확인함"), not a standalone metric
  // card, but a CURRENT record must still appear and the raw server enum must still never leak.
  expect(await screen.findByRole("heading", { name: "가장 최근에 확인한 값" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "총콜레스테롤" })).toBeVisible();
  expect(screen.getByRole("cell", { name: "직접 확인함" })).toBeVisible();
  expect(screen.queryByText("CURRENT")).toBeNull();
});

it("shows the abstention list instead of a review when the worker read no items", async () => {
  const completed = {
    documentId: syntheticDocumentId,
    sha256: "a".repeat(64),
    contentLength: 2048,
    stateVersion: 5,
    previewAvailable: true,
    quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
  };
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({ document: { ...completed, status: "EXTRACTION_RUNNING" } })),
    http.get("/api/foundation/documents/:documentId", () => HttpResponse.json({
      ...completed,
      status: "COMPLETED",
      abstentions: [{ label: "문서 전체", reason: "unreadable" }, { label: "LDL", reason: "ambiguous_value", evidencePage: 1 }],
    })),
    // The COMPLETED branch of poll() now fetches candidates (M5); this document truly has none.
    http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json([])),
  );
  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "이 결과지에서 읽을 수 있는 항목이 없었어요" }, { timeout: 5_000 })).toBeVisible();
  // An ambiguous row proves text was present, so the copy must not blame a scan.
  expect(screen.getByText("읽은 글자는 있지만 항목·값·단위를 확실히 맞출 수 없었어요. 아래 사유를 확인해 주세요.")).toBeVisible();
  const reasons = within(screen.getByRole("list", { name: "읽지 못한 항목" })).getAllByRole("listitem");
  expect(reasons[0]).toHaveTextContent("문서 전체");
  expect(reasons[0]).toHaveTextContent("글자 정보를 읽을 수 없음");
  expect(reasons[1]).toHaveTextContent("LDL");
  expect(reasons[1]).toHaveTextContent("값이 여러 개로 읽힘");
  expect(reasons[1]).toHaveTextContent("1쪽");
  expect(screen.queryByText("unreadable")).toBeNull();
  expect(screen.queryByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeNull();
});

it("shows the ambiguous-parse sentence instead of the scan sentence when the worker read text but matched no rows", async () => {
  const completed = {
    documentId: syntheticDocumentId,
    sha256: "a".repeat(64),
    contentLength: 2048,
    stateVersion: 5,
    previewAvailable: true,
    quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
  };
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({ document: { ...completed, status: "EXTRACTION_RUNNING" } })),
    http.get("/api/foundation/documents/:documentId", () => HttpResponse.json({
      ...completed,
      status: "COMPLETED",
      abstentions: [{ label: "결과지", reason: "unreadable", evidencePage: 1 }],
    })),
    http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json([])),
  );
  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "이 결과지에서 읽을 수 있는 항목이 없었어요" }, { timeout: 5_000 })).toBeVisible();
  expect(screen.getByText("읽은 글자는 있지만 항목·값·단위를 확실히 맞출 수 없었어요. 아래 사유를 확인해 주세요.")).toBeVisible();
  expect(screen.queryByText("글자 정보가 없는 파일(사진·스캔)은 아직 읽지 못해요.")).toBeNull();
});

it("shows the reviewed summary, not the zero-candidate screen, when polling finds a document completed elsewhere", async () => {
  const completed = {
    documentId: syntheticDocumentId,
    sha256: "a".repeat(64),
    contentLength: 2048,
    stateVersion: 5,
    previewAvailable: true,
    quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
  };
  const confirmed = syntheticCandidates.map((candidate) => ({ ...candidate, status: "CONFIRMED" as const }));
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({ document: { ...completed, status: "EXTRACTION_RUNNING" } })),
    http.get("/api/foundation/documents/:documentId", () => HttpResponse.json({ ...completed, status: "COMPLETED" })),
    http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json(confirmed.slice(0, 2))),
  );
  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "이 결과지 확인을 마쳤어요" }, { timeout: 5_000 })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "이 결과지에서 읽을 수 있는 항목이 없었어요" })).toBeNull();
});

it("reaches the zero-candidate screen when the active document is already completed on load", async () => {
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({
      document: {
        documentId: syntheticDocumentId,
        status: "COMPLETED",
        sha256: "a".repeat(64),
        contentLength: 2048,
        stateVersion: 6,
        previewAvailable: true,
        quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
        abstentions: [{ label: "스캔 페이지", reason: "unreadable", evidencePage: 1 }],
      },
    })),
    http.get("/api/foundation/documents/:documentId/candidates", () => HttpResponse.json([])),
  );

  render(<IntegratedHealthExperience />);

  expect(await screen.findByText("이 결과지에서 읽을 수 있는 항목이 없었어요")).toBeVisible();
  expect(screen.getByText("글자 정보를 읽을 수 없음")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "서버가 알려준 상태를 그대로 보여드려요" })).toBeNull();
});

it("shows 최근 변화 on the home screen only when the server reports items", async () => {
  server.use(http.get("/api/foundation/documents/active", () => HttpResponse.json({})));
  render(<IntegratedHealthExperience />);
  expect(await screen.findByRole("heading", { name: "아직 저장된 기록이 없어요" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "최근 변화" })).toBeNull();
  cleanup();

  changes = {
    latestDocument: {
      documentId: syntheticDocumentId,
      observedOn: "2026-07-28",
      completedAt: "2026-07-28T09:20:00Z",
      eventCount: 1,
    },
    items: [{
      conceptCode: "total-cholesterol",
      concept: "총콜레스테롤",
      unit: "mg/dL",
      latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
      previous: { eventId: "9c3e4f50-6172-4c8d-ae9f-1a2b3c4d5e60", value: "194", observedOn: "2026-01-15" },
    }],
    newConcepts: [],
    unchangedCount: 0,
  };
  render(<IntegratedHealthExperience />);
  expect(await screen.findByRole("heading", { name: "최근 변화" })).toBeVisible();
  expect(screen.getByTestId("change-item")).toHaveTextContent(
    "총콜레스테롤 · 이번 2026. 7. 28. 188 mg/dL · 이전 2026. 1. 15. 194 mg/dL",
  );
});

it("keeps the home screen working when /changes fails, hiding 최근 변화 instead of blocking restore", async () => {
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({})),
    http.get("/api/foundation/changes", () => HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 500 })),
  );
  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "아직 저장된 기록이 없어요" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "최근 변화" })).toBeNull();
  expect(screen.queryByText("체험 상태를 불러오지 못했어요")).toBeNull();
  expect(screen.queryByRole("button", { name: "체험 상태 다시 확인" })).toBeNull();
});

it("keeps the home screen working when /changes returns a schema-rejected body, hiding 최근 변화", async () => {
  server.use(
    http.get("/api/foundation/documents/active", () => HttpResponse.json({})),
    http.get("/api/foundation/changes", () => HttpResponse.json({
      items: [],
      newConcepts: [],
      unchangedCount: 0,
      unexpectedField: "should cause strict schema rejection",
    })),
  );
  render(<IntegratedHealthExperience />);

  expect(await screen.findByRole("heading", { name: "아직 저장된 기록이 없어요" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "최근 변화" })).toBeNull();
  expect(screen.queryByText("체험 상태를 불러오지 못했어요")).toBeNull();
  expect(screen.queryByRole("button", { name: "체험 상태 다시 확인" })).toBeNull();
});
