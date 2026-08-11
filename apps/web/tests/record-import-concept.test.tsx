import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { RecordImportConcept } from "@/components/concept/RecordImportConcept";

const documentReceipt = {
  format: "PDF" as const,
  byteLength: 2048,
  sizeLabel: "2 KB",
  sha256: `sha256:${"a".repeat(64)}` as const,
  processingBoundary: "local-synthetic-fixture" as const,
};

const syntheticImport = {
  sourceName: "삼성 건강검진 결과지",
  observedAt: "2026-07-28",
  currentItem: 4,
  totalItems: 12,
  candidate: {
    label: "당화혈색소",
    value: "6.1",
    unit: "%",
    reference: "4.0–5.6 %",
  },
};

afterEach(cleanup);

it("asks one easy source question without committing data", async () => {
  const { container } = render(<RecordImportConcept {...syntheticImport} stage="source" />);

  expect(screen.getByRole("heading", { name: /어떤 결과지를\s*가져올까요\?/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /이 기기에 있어요/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /종이로 가지고 있어요/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /병원에서 바로 연결할게요/ })).toBeVisible();
  expect(screen.getByLabelText("기기에서 결과지 선택")).toHaveAttribute("accept", expect.stringContaining("application/pdf"));
  expect(screen.getByText(/직접 확인하기 전에는 건강 기록에 반영되지 않아요/)).toBeVisible();
  expect(screen.getByRole("progressbar", { name: "결과지 가져오기 진행률" })).toHaveAttribute("aria-valuenow", "1");
  expect(await axe(container)).toHaveNoViolations();
});

it("shows a local processing receipt without presenting fixture values as real OCR", async () => {
  const { container } = render(
    <RecordImportConcept {...syntheticImport} stage="processing" documentReceipt={documentReceipt} />,
  );

  expect(screen.getByRole("heading", { name: /검토할 항목을\s*안전하게 나눴어요/ })).toBeVisible();
  expect(screen.getByLabelText("로컬 파일 처리 영수증")).toHaveTextContent("LOCAL RECEIPT · SYNTHETIC");
  expect(screen.getByText("합성 데모예요")).toBeVisible();
  expect(screen.getByText(/실제 결과가 아닙니다/)).toBeVisible();
  expect(screen.getByRole("button", { name: "12개 항목 검토 시작" })).toBeVisible();
  expect(screen.getByRole("progressbar", { name: "결과지 가져오기 진행률" })).toHaveAttribute("aria-valuenow", "2");
  expect(await axe(container)).toHaveNoViolations();
});

it("reviews exactly one candidate with visible provenance and three explicit decisions", async () => {
  const { container } = render(<RecordImportConcept {...syntheticImport} stage="review" />);

  expect(screen.getByRole("heading", { name: "이 수치가 맞나요?" })).toBeVisible();
  expect(screen.getByRole("img", { name: /삼성 건강검진 결과지에서 찾은 당화혈색소 원본 영역/ })).toBeVisible();
  expect(screen.getByText("2026-07-28")).toBeVisible();
  expect(screen.getAllByText("삼성 건강검진 결과지").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole("button", { name: "맞아요" })).toBeVisible();
  expect(screen.getByRole("button", { name: "수정할게요" })).toBeVisible();
  expect(screen.getByRole("button", { name: "기록에서 제외" })).toBeVisible();
  expect(screen.queryByText(/모두 확인|전체 승인/)).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "결과지 가져오기 진행률" })).toHaveAttribute("aria-valuenow", "3");
  expect(await axe(container)).toHaveNoViolations();
});

it("requires one final save after review is complete", () => {
  render(<RecordImportConcept {...syntheticImport} stage="complete" />);
  expect(screen.getByRole("heading", { name: /12개 항목을\s*기록할 준비가 됐어요/ })).toBeVisible();
  expect(screen.getByRole("button", { name: "건강 기록에 추가" })).toBeVisible();
  expect(screen.getByText(/추가한 수치만으로 질환을 진단하지 않아요/)).toBeVisible();
});
