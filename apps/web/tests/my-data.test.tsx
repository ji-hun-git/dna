import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { MyData } from "@/components/my-data/MyData";
import { syntheticHealthEvent } from "./fixtures/foundation";

const events = [
  syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51", observedOn: "2026-01-15", value: "194" }),
  syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d52" }),
  syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d53", concept: "당화혈색소", value: "5.2", unit: "%" }),
];

const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json({
    sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b", subjectId: "synthetic-jason", status: "AUTHENTICATED", expiresAt: "2026-08-30T08:30:00Z",
  })),
  http.get("/api/foundation/health-events", () => HttpResponse.json(events)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => { cleanup(); server.resetHandlers(); });

it("loads events into cells and a table, and opens the drawer from either", async () => {
  const { container } = render(<MyData />);
  const figure = await screen.findByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
  expect(within(figure).getAllByRole("button")).toHaveLength(3);
  const table = screen.getByRole("table", { name: "기록 목록" });
  expect(within(table).getAllByRole("row")).toHaveLength(4);
  const januaryCell = within(figure).getByRole("button", { name: "총콜레스테롤 194 mg/dL, 2026. 1. 15." });
  await userEvent.click(januaryCell);
  expect(screen.getByRole("region", { name: "총콜레스테롤 근거" })).toHaveTextContent("194 mg/dL");
  expect(screen.getByRole("heading", { name: "총콜레스테롤 근거" })).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "근거 닫기" }));
  expect(screen.queryByRole("region", { name: "총콜레스테롤 근거" })).toBeNull();
  expect(januaryCell).toHaveFocus();
  await userEvent.click(within(table).getByRole("button", { name: "당화혈색소 5.2 %, 2026. 7. 28. 근거 보기" }));
  expect(screen.getByRole("region", { name: "당화혈색소 근거" })).toBeVisible();
  expect(within(table).getByRole("row", { name: /당화혈색소/ })).toHaveAttribute("aria-current", "true");
  expect(await axe(container)).toHaveNoViolations();
});

it("filters by exact concept and says so, including zero results", async () => {
  render(<MyData />);
  await screen.findByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
  const input = screen.getByRole("searchbox", { name: "내 데이터에서 항목 찾기" });
  await userEvent.type(input, "총콜레스테롤");
  expect(screen.getByRole("status", { name: "검색 결과" })).toHaveTextContent("총콜레스테롤 기록 2개");
  expect(screen.getByRole("button", { name: "당화혈색소 5.2 %, 2026. 7. 28." })).toHaveAttribute("data-dim", "true");
  await userEvent.clear(input);
  await userEvent.type(input, "LDL");
  expect(screen.getByRole("status", { name: "검색 결과" })).toHaveTextContent("LDL 기록이 없어요");
});

it("shows the empty state and the server error state honestly", async () => {
  server.use(http.get("/api/foundation/health-events", () => HttpResponse.json([])));
  const { unmount } = render(<MyData />);
  expect(await screen.findByText("아직 확인한 기록이 없어요. 데이터 관리에서 결과지를 추가하면 여기에 한 칸씩 쌓여요.")).toBeVisible();
  unmount();
  server.use(http.get("/api/foundation/health-events", () => HttpResponse.json({ code: "INTERNAL" }, { status: 500 })));
  render(<MyData />);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeVisible();
});

it("asks for sign-in instead of retrying when the session has expired", async () => {
  server.use(http.get("/api/foundation/session", () =>
    HttpResponse.json({ code: "session_expired" }, { status: 401 })));
  render(<MyData />);
  expect(await screen.findByRole("link", { name: "홈에서 다시 로그인" })).toHaveAttribute("href", "/");
  expect(screen.queryByRole("button", { name: "다시 불러오기" })).toBeNull();
});
