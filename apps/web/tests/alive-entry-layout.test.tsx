import { cleanup, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { AliveEntryLayout } from "@/components/home/AliveEntryLayout";
import { FORBIDDEN_JUDGEMENT_WORDS } from "./fixtures/forbidden-words";

afterEach(cleanup);

function renderLayout() {
  return render(
    <AliveEntryLayout>
      <section aria-labelledby="copy-title">
        <h1 id="copy-title">체험 시작</h1>
        <p>copy content</p>
      </section>
    </AliveEntryLayout>,
  );
}

it("renders an identity definition list with the required example rows and the profile-is-example sentence", () => {
  const { container } = renderLayout();
  const dl = container.querySelector("dl")!;
  expect(dl).toBeInTheDocument();
  const rows = within(dl).getAllByRole("term");
  expect(rows.map((dt) => dt.textContent)).toEqual(["이름", "나이", "성별", "최근 결과지", "기록", "결과지"]);
  const scope = within(dl);
  expect(scope.getByText("예시 사용자")).toBeInTheDocument();
  expect(scope.getByText("25")).toBeInTheDocument();
  expect(scope.getByText("여성")).toBeInTheDocument();
  expect(scope.getByText("2026. 7. 28.")).toBeInTheDocument();
  expect(scope.getByText("6개")).toBeInTheDocument();
  expect(scope.getByText("3개")).toBeInTheDocument();
  expect(screen.getByText("이 프로필은 예시이며 실제 사람의 정보가 아니에요.")).toBeInTheDocument();
});

it("renders a records table with Korean column headers and a state column that only ever says 직접 확인함", () => {
  const { container } = renderLayout();
  const table = container.querySelector("table")!;
  expect(table).toBeInTheDocument();
  const headers = within(table).getAllByRole("columnheader").map((th) => th.textContent);
  expect(headers).toEqual(["항목", "값", "검사일", "상태"]);
  const bodyRows = within(table).getAllByRole("row").slice(1);
  expect(bodyRows.length).toBeGreaterThan(0);
  for (const row of bodyRows) {
    const cells = within(row).getAllByRole("cell");
    expect(cells).toHaveLength(4);
    expect(cells[3].textContent).toBe("직접 확인함");
  }
});

it("renders one phase label per example ring (derived from its dates) plus a trailing open phase, with exactly one current-phase marker on the last dated phase", () => {
  const { container } = renderLayout();
  const strip = container.querySelector("nav[aria-label='검진 시기']")!;
  expect(strip).toBeInTheDocument();
  const items = within(strip as HTMLElement).getAllByText(/검진/);
  // 4 example rings -> 4 dated phases, derived from their own node dates, plus "다음 검진".
  expect(items.length).toBe(5);
  expect(within(strip as HTMLElement).getByText("다음 검진")).toBeInTheDocument();
  const currentMarkers = container.querySelectorAll('[class*="phaseMarkerCurrent"]');
  expect(currentMarkers).toHaveLength(1);
  // The current marker sits on the last phase that has a ring, never the trailing open phase.
  expect(currentMarkers[0].parentElement?.textContent).not.toContain("다음 검진");
});

it("contains no forbidden judgement word anywhere in the rendered layout", () => {
  const { container } = renderLayout();
  const text = container.textContent ?? "";
  for (const forbidden of FORBIDDEN_JUDGEMENT_WORDS) {
    expect(text, `layout text contains forbidden word "${forbidden}"`).not.toContain(forbidden);
  }
});

it("has no axe violations", async () => {
  const { container } = renderLayout();
  expect(await axe(container)).toHaveNoViolations();
});
