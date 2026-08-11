import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { HealthHomeConcept } from "@/components/concept/HealthHomeConcept";

const syntheticHome = {
  userName: "지훈",
  updatedAt: "2026-08-10",
  sourceCount: 4,
  recordCount: 17,
  pendingReviewCount: 3,
  metric: {
    name: "당화혈색소",
    value: "6.1",
    unit: "%",
    observedAt: "2026-07-28",
    delta: "이전 기록보다 0.2%p 낮아요",
    source: "삼성 건강검진 결과지",
    status: "verified" as const,
  },
  recentRecords: [
    { id: "record-1", label: "당화혈색소", value: "6.1%", source: "삼성 건강검진 결과지", observedAt: "2026-07-28" },
    { id: "record-2", label: "총콜레스테롤", value: "188 mg/dL", source: "삼성 건강검진 결과지", observedAt: "2026-07-28" },
  ],
};

afterEach(cleanup);

it("renders a calm, evidence-first health home", async () => {
  const { container } = render(<HealthHomeConcept {...syntheticHome} />);

  expect(screen.getByRole("heading", { name: "흩어진 건강 기록을 한눈에 모았어요" })).toBeVisible();
  expect(screen.getByRole("button", { name: /새 결과지 가져오기/ })).toBeVisible();
  expect(screen.getByText("확인을 기다리는 항목이 3개 있어요")).toBeVisible();
  expect(screen.getByText("검증됨")).toBeVisible();
  expect(screen.getAllByText(/삼성 건강검진 결과지/).length).toBeGreaterThanOrEqual(2);
  expect(screen.getByRole("img", { name: "최근 12개월 중 4개월에 출처가 확인된 측정 기록이 있어요" })).toBeVisible();
  expect(screen.getByText(/표시된 측정값과 변화만으로 질환을 진단할 수 없습니다/)).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});

it("removes the review interruption when nothing needs confirmation", () => {
  render(<HealthHomeConcept {...syntheticHome} pendingReviewCount={0} />);
  expect(screen.queryByText(/확인을 기다리는 항목/)).not.toBeInTheDocument();
});
