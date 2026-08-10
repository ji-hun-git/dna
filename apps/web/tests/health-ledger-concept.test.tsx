import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { expect, it } from "vitest";
import { HealthLedgerConcept } from "@/components/concept/HealthLedgerConcept";

const syntheticLedger = {
  profileLabel: "나의 건강 기록",
  updatedAt: "2026-08-10",
  metric: {
    name: "당화혈색소",
    value: "6.1",
    unit: "%",
    observedAt: "2026-07-28",
    delta: "지난 기록보다 0.2%p 낮음",
    status: "verified" as const,
  },
  observations: [
    { id: "obs-1", monthIndex: 3, date: "2022-02-14", value: "6.8", source: "합성 건강검진 결과지" },
    { id: "obs-2", monthIndex: 20, date: "2023-07-18", value: "6.6", source: "합성 건강검진 결과지" },
    { id: "obs-3", monthIndex: 43, date: "2025-06-25", value: "6.3", source: "합성 건강검진 결과지" },
    { id: "obs-4", monthIndex: 56, date: "2026-07-28", value: "6.1", source: "합성 건강검진 결과지" },
  ],
};

it("renders an evidence-first five-year health ledger", async () => {
  const { container } = render(<HealthLedgerConcept {...syntheticLedger} />);

  expect(screen.getByRole("heading", { name: "시간 위의 증거" })).toBeVisible();
  expect(screen.getAllByText("6.1")).toHaveLength(2);
  expect(screen.getByText("검증됨")).toBeVisible();
  expect(screen.getByText(/측정값은 진단이 아닙니다/)).toBeVisible();
  expect(screen.getAllByText(/합성 건강검진 결과지/)).toHaveLength(4);
  expect(screen.getByRole("img", { name: "최근 5년 60개월 중 검진 기록이 연결된 달 4개" })).toBeVisible();
  expect(screen.getAllByTestId("ledger-mark")).toHaveLength(60);
  expect(container.querySelectorAll('[data-state="observed"]')).toHaveLength(4);
  expect(await axe(container)).toHaveNoViolations();
});
