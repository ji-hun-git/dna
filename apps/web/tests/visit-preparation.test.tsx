import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { IntegratedVisitPreparation, VisitPreparation } from "@/components/integrated/VisitPreparation";
import { syntheticRecord } from "./fixtures/foundation";

const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json({
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b",
    subjectId: "synthetic-visit-recovery",
    status: "AUTHENTICATED",
    expiresAt: "2026-09-08T08:30:00Z",
  })),
  http.get("/api/foundation/records", () => HttpResponse.json(preparedRecords)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
});

const preparedRecords = [
  syntheticRecord({
    recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c40",
    recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50",
    label: "총콜레스테롤",
    value: "190",
    originalValue: "188",
    unit: "mg/dL",
    reviewDecision: "CORRECTED",
  }),
  syntheticRecord({
    recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c41",
    recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51",
    label: "당화혈색소",
    value: "5.2",
    originalValue: "5.2",
    unit: "%",
  }),
];

it("creates one grounded question per topic, capped at three total", () => {
  render(<VisitPreparation records={preparedRecords} loading={false} errorMessage="" onPrint={vi.fn()} />);

  expect(screen.getByRole("heading", { level: 1, name: "다음 진료에서 물어볼 것" })).toBeVisible();
  expect(screen.getByText(
    "이 목록은 질문을 준비하기 위한 것이에요. 값의 의미나 건강 상태를 판단하지 않아요.",
  )).toBeVisible();
  expect(screen.getByText(
    "이 값은 서버가 미리 정한 예시 값이에요. 실제 파일이나 기관에서 가져오지 않았어요.",
  )).toBeVisible();

  const items = screen.getAllByRole("article");
  expect(items).toHaveLength(2);
  expect(screen.getAllByRole("link", { name: "이 질문의 출처 보기" })).toHaveLength(2);
  const corrected = items.find((item) => item.textContent?.includes("190"))!;
  expect(within(corrected).getByText("190")).toBeVisible();
  expect(within(corrected).getByText("예시 데이터 · 2026. 7. 28.")).toBeVisible();
  within(corrected).getByText("확인 정보").parentElement!.setAttribute("open", "");
  expect(within(corrected).getByText("1쪽")).toBeVisible();
  expect(within(corrected).getByText("사용자가 값을 수정함")).toBeVisible();
});

it("offers a printable sheet without judging the values", async () => {
  const onPrint = vi.fn();
  render(<VisitPreparation records={preparedRecords} loading={false} errorMessage="" onPrint={onPrint} />);

  await userEvent.click(screen.getByRole("button", { name: "인쇄하기" }));

  expect(onPrint).toHaveBeenCalledTimes(1);
});

it("explains the empty list and points back to the home screen", () => {
  render(<VisitPreparation records={[]} loading={false} errorMessage="" onPrint={vi.fn()} />);

  expect(screen.getByText("아직 확인한 기록이 없어요")).toBeVisible();
  expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
  expect(screen.queryByRole("article")).toBeNull();
});

it("stays accessible with and without records", async () => {
  const filled = render(
    <VisitPreparation records={preparedRecords} loading={false} errorMessage="" onPrint={vi.fn()} />,
  );
  expect(await axe(filled.container)).toHaveNoViolations();
  cleanup();

  const empty = render(<VisitPreparation records={[]} loading={false} errorMessage="" onPrint={vi.fn()} />);
  expect(await axe(empty.container)).toHaveNoViolations();
});

it("recovers the visit sheet from a read outage before enabling print", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  server.use(http.get("/api/foundation/records", () =>
    HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 503 })));
  render(<IntegratedVisitPreparation />);
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 응답하지 않아요");
  expect(screen.queryByRole("link", { name: "홈에서 다시 로그인" })).toBeNull();
  expect(screen.queryByRole("button", { name: "인쇄하기" })).toBeNull();
  expect(screen.queryByText("아직 확인한 기록이 없어요")).toBeNull();

  server.resetHandlers();
  await userEvent.click(screen.getByRole("button", { name: "질문 목록 다시 불러오기" }));
  expect(await screen.findAllByRole("article")).toHaveLength(2);
  expect(screen.queryByRole("alert")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "인쇄하기" }));
  expect(print).toHaveBeenCalledTimes(1);
});

it("rechecks the session on retry and stops before reading if it expired", async () => {
  const reads = vi.fn(() => HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 503 }));
  server.use(http.get("/api/foundation/records", reads));
  render(<IntegratedVisitPreparation />);
  await screen.findByRole("alert");
  expect(reads).toHaveBeenCalledTimes(1);
  server.use(http.get("/api/foundation/session", () =>
    HttpResponse.json({ code: "session_expired" }, { status: 401 })));

  await userEvent.click(screen.getByRole("button", { name: "질문 목록 다시 불러오기" }));
  expect(await screen.findByRole("link", { name: "홈에서 다시 로그인" })).toHaveAttribute("href", "/");
  expect(screen.queryByRole("button", { name: "질문 목록 다시 불러오기" })).toBeNull();
  expect(screen.queryByRole("button", { name: "인쇄하기" })).toBeNull();
  expect(reads).toHaveBeenCalledTimes(1);
});

it("requires sign-in when the records response rejects an expired session", async () => {
  server.use(http.get("/api/foundation/records", () =>
    HttpResponse.json({ code: "session_expired" }, { status: 401 })));
  render(<IntegratedVisitPreparation />);
  expect(await screen.findByRole("link", { name: "홈에서 다시 로그인" })).toHaveAttribute("href", "/");
  expect(screen.queryByRole("button", { name: "질문 목록 다시 불러오기" })).toBeNull();
  expect(screen.queryByRole("article")).toBeNull();
});

it.each([
  { loading: true, errorMessage: "" },
  { loading: false, errorMessage: "서버에 연결하지 못했어요." },
])("does not print stale supplied values while loading or failed: %j", ({ loading, errorMessage }) => {
  render(<VisitPreparation records={preparedRecords} loading={loading} errorMessage={errorMessage} onPrint={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "인쇄하기" })).toBeNull();
  expect(screen.queryByRole("article")).toBeNull();
  expect(screen.queryByText("아직 확인한 기록이 없어요")).toBeNull();
});
