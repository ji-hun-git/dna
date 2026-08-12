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
  sourceName: "예시 건강검진 결과지",
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

  expect(screen.getByRole("heading", { name: /결과지가\s*어디에 있나요\?/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /기기에서 파일 선택/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /종이 결과지 촬영/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /기관에서 가져오기/ })).toBeVisible();
  expect(screen.getByLabelText("기기에서 결과지 선택")).toHaveAttribute("accept", expect.stringContaining("application/pdf"));
  expect(screen.getByText(/직접 확인한 항목만 화면에 반영합니다/)).toBeVisible();
  expect(screen.getByRole("progressbar", { name: "결과지 가져오기 진행률" })).toHaveAttribute("aria-valuenow", "1");
  expect(await axe(container)).toHaveNoViolations();
});

it("shows a local processing receipt without presenting fixture values as real OCR", async () => {
  const { container } = render(
    <RecordImportConcept {...syntheticImport} stage="processing" documentReceipt={documentReceipt} />,
  );

  expect(screen.getByRole("heading", { name: /파일 확인을\s*마쳤어요/ })).toBeVisible();
  expect(screen.getByLabelText("파일 확인 결과")).toHaveTextContent("파일 확인 결과 · 예시");
  expect(screen.getByText("예시 화면이에요")).toBeVisible();
  expect(screen.getByText(/파일에서 검사 수치를 읽는 기능은 아직 연결하지 않았습니다/)).toBeVisible();
  expect(screen.getByRole("button", { name: "예시 항목 12개 확인하기" })).toBeVisible();
  expect(screen.getByRole("progressbar", { name: "결과지 가져오기 진행률" })).toHaveAttribute("aria-valuenow", "2");
  expect(await axe(container)).toHaveNoViolations();
});

it("reviews exactly one candidate with visible provenance and three explicit decisions", async () => {
  const { container } = render(<RecordImportConcept {...syntheticImport} stage="review" />);

  expect(screen.getByRole("heading", { name: "이 값이 맞나요?" })).toBeVisible();
  expect(screen.getByRole("img", { name: /예시 건강검진 결과지 형식으로 만든 당화혈색소 예시 영역/ })).toBeVisible();
  expect(screen.getByText("2026. 7. 28.")).toBeVisible();
  expect(screen.getAllByText("예시 건강검진 결과지").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole("button", { name: "원문과 같아요" })).toBeVisible();
  expect(screen.getByRole("button", { name: "값 수정" })).toBeVisible();
  expect(screen.getByRole("button", { name: "이 항목 빼기" })).toBeVisible();
  expect(screen.queryByText(/모두 확인|전체 승인/)).not.toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "결과지 가져오기 진행률" })).toHaveAttribute("aria-valuenow", "3");
  expect(await axe(container)).toHaveNoViolations();
});

it("requires one final save after review is complete", () => {
  render(<RecordImportConcept {...syntheticImport} stage="complete" />);
  expect(screen.getByRole("heading", { name: /예시 항목 12개를\s*확인했어요/ })).toBeVisible();
  expect(screen.getByRole("button", { name: "시연 화면에 추가" })).toBeVisible();
  expect(screen.getByText(/이 값만으로 건강 상태나 질환을 판단할 수 없어요/)).toBeVisible();
});
