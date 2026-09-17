import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { MeasurementHistory } from "@/components/my-data/history/MeasurementHistory";
import { HISTORY_TIME_GRADIENT_STOPS } from "@/components/my-data/history/HistoryGraph";
import { syntheticSeries } from "./fixtures/foundation";

const session = { sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b", subjectId: "synthetic-jason", status: "AUTHENTICATED", expiresAt: "2026-08-30T08:30:00Z" };
const server = setupServer(
  http.get("/api/foundation/session", () => HttpResponse.json(session)),
  http.get("/api/foundation/series", () => HttpResponse.json(syntheticSeries())),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => { cleanup(); server.resetHandlers(); window.location.hash = ""; });

it("lists every series with its three computed numbers as text and the same numbers as a table", async () => {
  const { container } = render(<MeasurementHistory />);
  const sections = await screen.findAllByTestId("history-series");
  expect(sections.map((section) => within(section).getByRole("heading", { level: 2 }).textContent)).toEqual(["당화혈색소", "비타민 D", "총콜레스테롤"]);

  const cholesterol = within(sections[2]);
  expect(cholesterol.getByTestId("derived-last-difference")).toHaveTextContent(/^-4 mg\/dL \(-2\.1%\)$/);
  expect(cholesterol.getByTestId("derived-per-30-days")).toHaveTextContent(/^-0\.6 mg\/dL$/);
  expect(cholesterol.getByTestId("derived-mean-of-last-3")).toHaveTextContent(/^측정 3회부터 계산해요$/);
  const rows = within(cholesterol.getByRole("table", { name: "총콜레스테롤 측정 이력" })).getAllByRole("row");
  expect(rows.map((row) => row.textContent)).toEqual([
    "검사일값단위출처",
    "2026. 1. 15.194mg/dL출처 보기",
    "2026. 7. 28.190mg/dL출처 보기",
  ]);
  expect(cholesterol.getByRole("link", { name: "총콜레스테롤 190 mg/dL, 2026. 7. 28. 출처 보기" }))
    .toHaveAttribute("href", "/my-data#event-8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d65");

  // A %-unit series has no percent of a percent.
  expect(within(sections[0]).getByTestId("derived-last-difference")).toHaveTextContent(/^-0\.2 %$/);
  expect(within(sections[0]).getByTestId("derived-per-30-days")).toHaveTextContent(/^-0\.03 %$/);

  expect(screen.getByText("직접 확인한 값을 검사일 순서로 모았어요. 점은 확인한 값이고, 점 사이의 선은 값이 아니에요.")).toBeVisible();
  expect(screen.getByText("선의 모양이 건강 상태를 뜻하지 않아요. 색은 시간의 위치만 나타내요.")).toBeVisible();
  expect(screen.getByText("뺄셈과 나눗셈으로만 계산했어요. 의미는 판단하지 않아요.")).toBeVisible();
  for (const term of ["마지막 두 값의 차이", "30일로 환산한 차이", "최근 3회 평균"]) expect(cholesterol.getByText(term)).toBeVisible();
  expect(container.textContent).not.toMatch(/120-199|참고치|상승|하락|증가|감소|빨라|느려|좋아|나빠|추세|→|↑|↓/);
  expect(await axe(container)).toHaveNoViolations();
});

it("draws one labelled image per series with two or more points, with focusable anchors and straight lines only", async () => {
  const { container } = render(<MeasurementHistory />);
  const sections = await screen.findAllByTestId("history-series");

  const graph = within(sections[2]).getByRole("group", { name: "총콜레스테롤 mg/dL, 측정 2회, 2026. 1. 15.부터 2026. 7. 28.까지. 같은 값이 아래 표에 있어요." });
  expect(graph.tagName.toLowerCase()).toBe("svg");
  // Order "검사일 값 단위" (wave4-mockup-decision.md), no series name — the heading already names it.
  const anchors = within(sections[2]).getAllByRole("button", { name: /^2026\.\d{2}\.\d{2} \d+ mg\/dL$/ });
  expect(anchors.map((anchor) => anchor.getAttribute("aria-label"))).toEqual(["2026.01.15 194 mg/dL", "2026.07.28 190 mg/dL"]);
  anchors.forEach((anchor) => expect(anchor).toHaveAttribute("tabindex", "0"));
  const paths = [...sections[2].querySelectorAll("path[data-ribbon]")];
  expect(paths.length).toBeGreaterThan(0);
  paths.forEach((path) => expect(path.getAttribute("d")).toMatch(/^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+)+$/));
  expect(container.querySelector("[data-band], [data-threshold], [data-trend]")).toBeNull();

  // One point: the table only, and it says why.
  expect(within(sections[1]).queryByRole("img")).toBeNull();
  expect(within(sections[1]).getByText("측정이 한 번이라 그래프 없이 표만 보여드려요.")).toBeVisible();
  expect(within(sections[1]).getByRole("table", { name: "비타민 D 측정 이력" })).toBeVisible();
});

it("draws every series' ribbon with the same time gradient, never a per-series colour, and marks the fixed contrast in ink", async () => {
  const { container } = render(<MeasurementHistory />);
  const sections = await screen.findAllByTestId("history-series");

  // No token, class or attribute may map a colour to a series.
  expect(container.querySelector("[data-series-colour]")).toBeNull();
  expect(container.innerHTML).not.toMatch(/hist-series-\d/);

  for (const index of [0, 2]) { // both series with two or more points
    const section = sections[index];
    const gradients = [...section.querySelectorAll("linearGradient")];
    expect(gradients.length).toBeGreaterThan(0);
    const gradient = gradients[0];
    expect(gradient.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    const stops = [...gradient.querySelectorAll("stop")];
    expect(stops.map((stop) => [stop.getAttribute("offset"), stop.getAttribute("stop-color")]))
      .toEqual(HISTORY_TIME_GRADIENT_STOPS.map((stop) => [stop.offset, stop.color]));
    const gradientId = gradient.getAttribute("id");
    expect(gradientId).toBeTruthy();

    const band = section.querySelector('path[data-ribbon="band"]');
    const body = section.querySelector('path[data-ribbon="body"]');
    expect(band?.getAttribute("stroke")).toBe(`url(#${gradientId})`);
    expect(body?.getAttribute("stroke")).toBe(`url(#${gradientId})`);

    // The centre line and the anchors carry the non-colour, ≥3:1 contrast: fixed ink, never the gradient.
    const centre = section.querySelector('path[data-ribbon="centre"]');
    expect(centre?.getAttribute("stroke")).toBe("var(--hist-ink)");
    const anchorFills = [...section.querySelectorAll("rect[data-anchor]")].map((rect) => rect.getAttribute("fill"));
    expect(anchorFills.length).toBeGreaterThan(0);
    anchorFills.forEach((fill) => expect(fill).toBe("var(--hist-ink)"));
  }

  // Gradient ids are unique across series on the same page.
  const ids = [...container.querySelectorAll("linearGradient")].map((gradient) => gradient.getAttribute("id"));
  expect(new Set(ids).size).toBe(ids.length);

  expect(screen.getByText("선의 모양이 건강 상태를 뜻하지 않아요. 색은 시간의 위치만 나타내요.")).toBeVisible();
  const timebar = screen.getByTestId("history-timebar");
  expect(timebar).toHaveAttribute("aria-hidden", "true");
  expect(timebar).toHaveTextContent("2026. 1. 15. 먼저");
  expect(timebar).toHaveTextContent("나중 2026. 7. 28.");
  expect(await axe(container)).toHaveNoViolations();
});

it("opens an annotation card for the chosen anchor by click and by keyboard, and closes it again", async () => {
  render(<MeasurementHistory />);
  const section = within((await screen.findAllByTestId("history-series"))[2]);
  const anchor = section.getByRole("button", { name: "2026.07.28 190 mg/dL" });

  await userEvent.click(anchor);
  expect(anchor).toHaveAttribute("aria-pressed", "true");
  const card = section.getByRole("group", { name: "선택한 측정값" });
  // First line "YYYY.MM.DD 확인한 값" (wave4-mockup-decision.md), then the value.
  expect(card).toHaveTextContent("2026.07.28 확인한 값");
  expect(card).toHaveTextContent("190 mg/dL");
  expect(card).toHaveAttribute("aria-live", "polite");
  expect(anchor).toHaveAttribute("aria-describedby", card.id);
  // Selection is shown by the card, the leader line and aria-pressed — never by recolouring the anchor.
  expect(section.getByRole("button", { name: "2026.07.28 190 mg/dL" }).querySelector("rect[data-anchor]"))
    .toHaveAttribute("fill", "var(--hist-ink)");
  expect(within(card).getByRole("link", { name: "출처 보기" })).toHaveAttribute("href", "/my-data#event-8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d65");

  await userEvent.click(anchor);
  expect(section.queryByRole("group", { name: "선택한 측정값" })).toBeNull();
  anchor.focus();
  await userEvent.keyboard("{Enter}");
  expect(section.getByRole("group", { name: "선택한 측정값" })).toBeVisible();
  await userEvent.keyboard(" ");
  expect(section.queryByRole("group", { name: "선택한 측정값" })).toBeNull();
});

it("keeps the lede on the page even when the first drawable series is later in the list (I1)", async () => {
  server.use(http.get("/api/foundation/series", () => HttpResponse.json({
    series: [
      {
        conceptCode: "single",
        concept: "단일측정",
        unit: "mg/dL",
        points: [{ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4f10", value: "10", observedOn: "2026-01-01", documentId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4f11" }],
        derived: {},
      },
      {
        conceptCode: "drawn",
        concept: "그려지는측정",
        unit: "mg/dL",
        points: [
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4f12", value: "10", observedOn: "2026-01-01", documentId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4f11" },
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4f13", value: "12", observedOn: "2026-02-01", documentId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4f11" },
        ],
        derived: { lastDifference: { absolute: "2" } },
      },
    ],
  })));
  render(<MeasurementHistory />);
  await screen.findAllByTestId("history-series");
  expect(screen.getByText("직접 확인한 값을 검사일 순서로 모았어요. 점은 확인한 값이고, 점 사이의 선은 값이 아니에요.")).toBeVisible();
  expect(screen.getByText("선의 모양이 건강 상태를 뜻하지 않아요. 색은 시간의 위치만 나타내요.")).toBeVisible();
});

it("shares one x domain across series so the same exam date lands at the same x (I2)", async () => {
  render(<MeasurementHistory />);
  const sections = await screen.findAllByTestId("history-series");
  // 당화혈색소 and 총콜레스테롤 both have a point on 2026-01-15 (fixtures/foundation.ts).
  const hba1cAnchor = within(sections[0]).getByRole("button", { name: "2026.01.15 5.4 %" });
  const cholesterolAnchor = within(sections[2]).getByRole("button", { name: "2026.01.15 194 mg/dL" });
  const hba1cX = hba1cAnchor.querySelector("rect[data-anchor]")!.getAttribute("x");
  const cholesterolX = cholesterolAnchor.querySelector("rect[data-anchor]")!.getAttribute("x");
  expect(hba1cX).toBe(cholesterolX);
});

it("names the specific reason a number is missing, decided from the points themselves", async () => {
  server.use(http.get("/api/foundation/series", () => HttpResponse.json({
    series: [
      {
        conceptCode: "same-day",
        concept: "같은날검사",
        unit: "mg/dL",
        points: [
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4e01", value: "10", observedOn: "2026-07-28", documentId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4f01" },
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4e02", value: "12", observedOn: "2026-07-28", documentId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4f01" },
        ],
        derived: {},
      },
      {
        conceptCode: "short-gap",
        concept: "짧은간격검사",
        unit: "mg/dL",
        points: [
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4e03", value: "10", observedOn: "2026-07-01", documentId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4f01" },
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4e04", value: "12", observedOn: "2026-07-10", documentId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4f01" },
        ],
        derived: { lastDifference: { absolute: "2" } },
      },
    ],
  })));
  render(<MeasurementHistory />);
  const sections = await screen.findAllByTestId("history-series");
  expect(within(sections[0]).getByTestId("derived-last-difference")).toHaveTextContent("같은 날 측정이라 계산하지 않아요");
  expect(within(sections[0]).getByTestId("derived-per-30-days")).toHaveTextContent("측정 간격이 30일보다 짧아 계산하지 않아요");
  expect(within(sections[1]).getByTestId("derived-per-30-days")).toHaveTextContent("측정 간격이 30일보다 짧아 계산하지 않아요");
  expect(within(sections[1]).getByTestId("derived-mean-of-last-3")).toHaveTextContent("측정 3회부터 계산해요");
});

it("focuses the series that holds the event named in the hash", async () => {
  window.location.hash = "#event-8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d62";
  render(<MeasurementHistory />);
  await screen.findAllByTestId("history-series");
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toHaveFocus();
});

it("says so when there is nothing yet, and passes axe", async () => {
  server.use(http.get("/api/foundation/series", () => HttpResponse.json({ series: [] })));
  const { container } = render(<MeasurementHistory />);
  expect(await screen.findByText("아직 확인한 기록이 없어요. 결과지를 추가해 값을 확인하면 여기에 항목별로 모여요.")).toBeVisible();
  expect(screen.queryByTestId("history-series")).toBeNull();
  expect(await axe(container)).toHaveNoViolations();
});

it("shows a retryable error, recovers on retry, and sends an expired session home", async () => {
  let unavailable = true;
  server.use(http.get("/api/foundation/series", () => unavailable
    ? HttpResponse.json({ code: "retryable_dependency_failure" }, { status: 503 })
    : HttpResponse.json(syntheticSeries())));
  const { container } = render(<MeasurementHistory />);
  expect(await screen.findByRole("alert")).toHaveTextContent("잠시 응답하지 않아요");
  expect(await axe(container)).toHaveNoViolations();
  unavailable = false;
  await userEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
  expect(await screen.findAllByTestId("history-series")).toHaveLength(3);
  expect(screen.queryByRole("alert")).toBeNull();

  cleanup();
  server.use(http.get("/api/foundation/session", () => HttpResponse.json({ code: "session_invalid" }, { status: 401 })));
  render(<MeasurementHistory />);
  expect(await screen.findByRole("link", { name: "홈에서 다시 로그인" })).toHaveAttribute("href", "/");
});

it("rejects a server that starts sending a direction instead of showing it", async () => {
  const broken = syntheticSeries();
  server.use(http.get("/api/foundation/series", () => HttpResponse.json({ series: [{ ...broken.series[2], direction: "down" }] })));
  render(<MeasurementHistory />);
  expect(await screen.findByRole("alert")).toHaveTextContent("서버 응답 형식을 확인할 수 없어");
  expect(screen.queryByTestId("history-series")).toBeNull();
});
