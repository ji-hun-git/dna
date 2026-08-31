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
    source: "예시 건강검진 결과지",
    status: "verified" as const,
  },
  recentRecords: [
    { id: "record-1", label: "당화혈색소", value: "6.1%", source: "예시 건강검진 결과지", observedAt: "2026-07-28" },
    { id: "record-2", label: "총콜레스테롤", value: "188 mg/dL", source: "예시 건강검진 결과지", observedAt: "2026-07-28" },
  ],
};

afterEach(cleanup);

it("renders a calm, evidence-first health home", async () => {
  const { container } = render(<HealthHomeConcept {...syntheticHome} />);

  expect(screen.getByRole("heading", { name: /건강 기록을\s*한곳에서 확인하세요/ })).toBeVisible();
  expect(screen.getAllByRole("button", { name: /결과지 추가/ })[0]).toBeVisible();
  expect(screen.getByRole("link", { name: "전체 기록 보기" })).toHaveAttribute("href", "/records");
  expect(screen.getByRole("link", { name: /시간에 따른 변화 보기/ })).toHaveAttribute("href", "/records");
  expect(screen.getByRole("link", { name: /연결 준비 상태 보기/ })).toHaveAttribute("href", "/connections");
  expect(screen.getByRole("link", { name: "데이터 관리 열기" })).toHaveAttribute("href", "/data-control");
  expect(screen.getByRole("link", { name: /비급여 금액 찾아보기/ })).toHaveAttribute("href", "/providers");
  expect(screen.getByText("아직 확인하지 않은 항목이 3개 있어요")).toBeVisible();
  expect(screen.getByText("직접 확인")).toBeVisible();
  expect(screen.getAllByText(/예시 건강검진 결과지/).length).toBeGreaterThanOrEqual(2);
  expect(screen.getByRole("img", { name: "최근 12개월 중 4개월에 출처가 확인된 측정 기록이 있어요" })).toBeVisible();
  expect(screen.getByText(/이 화면의 값만으로 질환을 진단하거나 정상·비정상을 판단할 수 없어요/)).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});

it("removes the review interruption when nothing needs confirmation", () => {
  render(<HealthHomeConcept {...syntheticHome} pendingReviewCount={0} />);
  expect(screen.queryByText(/아직 확인하지 않은 항목/)).not.toBeInTheDocument();
});
