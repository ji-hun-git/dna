import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { PublicProviderExplorer } from "@/components/providers/PublicProviderExplorer";
import {
  providerDemoRecordSchema,
  publicProviderDemo,
  publicProviderDemoSchema,
} from "@/lib/public-data/demo-public-provider";

afterEach(cleanup);

it("freezes a strict synthetic-only contract and records zero live API calls", () => {
  expect(publicProviderDemo.liveApiCalls).toBe(0);
  expect(publicProviderDemo.environment).toBe("synthetic-demo");
  expect(publicProviderDemo.sources.every((source) => source.connectionState === "not-connected")).toBe(true);
  expect(publicProviderDemo.providers.every((provider) => provider.disclosure === "synthetic-not-a-real-provider")).toBe(true);
  expect(publicProviderDemo.prices.every((price) => price.itemCode.startsWith("DEMO-"))).toBe(true);
  expect(providerDemoRecordSchema.safeParse({
    ...publicProviderDemo.providers[0],
    rating: 5,
    recommendedForUser: true,
  }).success).toBe(false);
  expect(publicProviderDemoSchema.safeParse({
    ...publicProviderDemo,
    liveApiCalls: 1,
  }).success).toBe(false);
});

it("renders the source-first boundary accessibly without presenting live or recommended care", async () => {
  const { container } = render(<PublicProviderExplorer />);

  expect(screen.getByRole("heading", { name: /공개 의료정보를\s*출처와 함께 살펴봐요/ })).toBeVisible();
  expect(screen.getByText("아직 공공 API와 연결되지 않았어요")).toBeVisible();
  expect(screen.getByText(/실시간 요청 0건/)).toBeVisible();
  expect(screen.getByRole("table", { name: "예시 의료기관 정보 비교" })).toBeVisible();
  expect(screen.getAllByText("예시").length).toBeGreaterThan(0);
  expect(screen.getByText("추천, 순위, 예약 기능은 없어요")).toBeVisible();
  expect(screen.getByRole("button", { name: /공식 연동 준비 중/ })).toBeDisabled();
  expect(screen.queryByText(/최고 병원|별점|사용자 맞춤 추천/)).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});

it("filters neutral provider rows and switches to explicitly synthetic price structure", async () => {
  const user = userEvent.setup();
  render(<PublicProviderExplorer />);

  await user.selectOptions(screen.getByRole("combobox", { name: "지역" }), "부산");
  const providerTable = screen.getByRole("table", { name: "예시 의료기관 정보 비교" });
  expect(within(providerTable).getByText("다온부산병원")).toBeVisible();
  expect(within(providerTable).queryByText("가나다종합병원")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /비급여 항목·금액/ }));
  const priceTable = screen.getByRole("table", { name: "예시 비급여 금액 비교" });
  expect(within(priceTable).getByText("₩530,000")).toBeVisible();
  expect(within(priceTable).getAllByText("예시 금액").length).toBeGreaterThan(0);
  await user.click(within(priceTable).getByText("금액 안내"));
  expect(within(priceTable).getByText(/실제 가격이나 최종 청구액, 의료의 질을 뜻하지 않습니다/)).toBeVisible();
});
