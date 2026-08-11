import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it, vi } from "vitest";
import { EvidenceLens } from "@/components/records/EvidenceLens";
import { HealthExperience } from "@/components/experience/HealthExperience";

afterEach(cleanup);

const correctedRecord = {
  id: "cholesterol",
  label: "총콜레스테롤",
  value: "190",
  originalValue: "188",
  unit: "mg/dL",
  reference: "120–199 mg/dL",
  sourceName: "삼성 건강검진 결과지",
  observedAt: "2026-07-28",
  sourceLocation: "2쪽 · 검사결과 표 · 4행",
  sourceDigest: "sha256:7c91…42a8 · 합성 시연 문서",
  extractedAt: "2026-08-10 09:41",
  confirmedAt: "2026-08-10 09:44",
  automation: {
    layoutModel: "PaddleOCR-VL 1.6",
    semanticModel: "MedGemma 1.5 4B",
    evaluationGate: "medical-document-eval.v1",
    executionBoundary: "오프라인 실행 · 네트워크 없음",
    artifactPolicy: "runner와 모델의 SHA-256이 모두 일치해야 실행",
    disposition: "자동 결과는 후보로만 제시하고 사람의 확인 전에는 저장하지 않음",
  },
};

it("shows exact source location, correction history, and a non-diagnostic boundary", async () => {
  const onBack = vi.fn();
  const { container } = render(<EvidenceLens record={correctedRecord} onBack={onBack} />);

  expect(screen.getByRole("heading", { name: "총콜레스테롤" })).toBeVisible();
  expect(screen.getAllByText("2쪽 · 검사결과 표 · 4행").length).toBeGreaterThan(0);
  expect(screen.getByText("188 → 190 mg/dL로 수정했어요.")).toBeVisible();
  expect(screen.getByRole("heading", { name: "이 화면은 진단 결과가 아니에요" })).toBeVisible();
  expect(screen.getByText(/sha256:7c91/)).toBeVisible();
  await userEvent.click(screen.getByText("자동 추출 방법 보기"));
  expect(screen.getByText("PaddleOCR-VL 1.6")).toBeVisible();
  expect(screen.getByText("MedGemma 1.5 4B")).toBeVisible();
  expect(screen.getByText("medical-document-eval.v1")).toBeVisible();
  expect(screen.getByText("오프라인 실행 · 네트워크 없음")).toBeVisible();
  expect(screen.getByText("runner와 모델의 SHA-256이 모두 일치해야 실행")).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();

  await userEvent.click(screen.getByRole("button", { name: "건강 기록으로 돌아가기" }));
  expect(onBack).toHaveBeenCalledOnce();
});

it("opens the evidence lens from a recent health record and returns home", async () => {
  const user = userEvent.setup();
  render(<HealthExperience />);

  await user.click(screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL 자세히 보기" }));
  expect(screen.getByRole("heading", { name: "이 값은 어디에서 왔을까요?" })).toBeVisible();
  expect(screen.getByText("원문과 일치 확인")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "건강 기록으로 돌아가기" }));
  expect(screen.getByRole("heading", { name: /흩어진 건강 기록을/ })).toBeVisible();
});
