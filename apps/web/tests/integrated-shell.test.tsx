import { cleanup, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";

afterEach(cleanup);

it("offers two destinations and marks the group the current screen belongs to", () => {
  render(<IntegratedShell current="prepare"><main>본문</main></IntegratedShell>);
  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  expect(within(nav).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
    ["나의 데이터", "/my-data"],
    ["데이터 관리", "/data-control"],
  ]);
  expect(within(nav).getByRole("link", { name: "나의 데이터" })).toHaveAttribute("aria-current", "page");
  expect(within(nav).getByRole("link", { name: "데이터 관리" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("link", { name: "앎 건강 홈" })).toHaveAttribute("href", "/");
});

it("marks nothing current on the entry screen", () => {
  render(<IntegratedShell current="home"><main>본문</main></IntegratedShell>);
  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
});

it("shows the server status pill only when the screen has one", () => {
  const { rerender } = render(
    <IntegratedShell current="records" status="서버 저장 합성 기록"><main>본문</main></IntegratedShell>,
  );
  expect(screen.getByText("서버 저장 합성 기록")).toBeVisible();

  rerender(<IntegratedShell current="records"><main>본문</main></IntegratedShell>);
  expect(screen.queryByText("서버 저장 합성 기록")).toBeNull();
});

it("pairs each written destination with a decorative, non-focusable line icon", () => {
  render(<IntegratedShell current="records"><main>본문</main></IntegratedShell>);

  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  for (const label of ["나의 데이터", "데이터 관리"]) {
    const link = within(nav).getByRole("link", { name: label });
    expect(within(link).getByText(label, { exact: true })).toBeVisible();
    const icon = link.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("focusable", "false");
    expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
  }
  expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
});

it("stays accessible on every route", async () => {
  for (const current of ["home", "records", "prepare", "data-control"] as const) {
    const { container } = render(
      <IntegratedShell current={current} status="서버 상태"><main>본문</main></IntegratedShell>,
    );
    expect(await axe(container)).toHaveNoViolations();
    cleanup();
  }
});
