import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it, vi } from "vitest";
import { VisitPreparation } from "@/components/integrated/VisitPreparation";
import { syntheticRecord } from "./fixtures/foundation";

afterEach(cleanup);

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
