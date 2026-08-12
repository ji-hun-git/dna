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
  sourceName: "예시 건강검진 결과지",
  observedAt: "2026-07-28",
  sourceLocation: "2쪽 · 검사결과 표 · 4행",
  sourceDigest: "sha256:7c91…42a8 · 예시 문서",
  extractedAt: "2026-08-10 09:41",
  confirmedAt: "2026-08-10 09:44",
  automation: {
    layoutModel: "PaddleOCR-VL 1.6",
    semanticModel: "MedGemma 1.5 4B",
    evaluationGate: "출시 전 의료 문서 평가를 통과해야 함",
    executionBoundary: "기기 안에서 오프라인으로 실행할 계획",
    artifactPolicy: "실행 프로그램과 모델의 파일 확인값이 모두 맞을 때만 사용",
    disposition: "자동 결과는 후보만 보여주고 사용자가 확인하기 전에는 저장하지 않음",
  },
};

it("shows exact source location, correction history, and a non-diagnostic boundary", async () => {
  const onBack = vi.fn();
  const { container } = render(<EvidenceLens record={correctedRecord} onBack={onBack} />);

  expect(screen.getByRole("heading", { name: "총콜레스테롤" })).toBeVisible();
  expect(screen.getAllByText("2쪽 · 검사결과 표 · 4행").length).toBeGreaterThan(0);
  expect(screen.getByText("188에서 190 mg/dL로 수정하는 예시예요.")).toBeVisible();
  expect(screen.getByRole("heading", { name: "이 화면은 진단 결과가 아니에요" })).toBeVisible();
  expect(screen.getByText(/sha256:7c91/)).toBeVisible();
  await userEvent.click(screen.getByText("검토 중인 자동 처리 계획 보기"));
  expect(screen.getByText("아래 도구는 아직 이 예시 기록을 만드는 데 사용하지 않았어요.")).toBeVisible();
  expect(screen.getByText("PaddleOCR-VL 1.6")).toBeVisible();
  expect(screen.getByText("MedGemma 1.5 4B")).toBeVisible();
  expect(screen.getByText("출시 전 의료 문서 평가를 통과해야 함")).toBeVisible();
  expect(screen.getByText("기기 안에서 오프라인으로 실행할 계획")).toBeVisible();
  expect(screen.getByText("실행 프로그램과 모델의 파일 확인값이 모두 맞을 때만 사용")).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();

  await userEvent.click(screen.getByRole("button", { name: "홈으로 돌아가기" }));
  expect(onBack).toHaveBeenCalledOnce();
});

it("opens the evidence lens from a recent health record and returns home", async () => {
  const user = userEvent.setup();
  render(<HealthExperience />);

  await user.click(screen.getByRole("button", { name: "총콜레스테롤 188 mg/dL 자세히 보기" }));
  expect(screen.getByRole("heading", { name: "이 값의 출처를 확인해요" })).toBeVisible();
  expect(screen.getAllByText("사용자가 원문과 같다고 확인함").length).toBeGreaterThan(0);

  await user.click(screen.getByRole("button", { name: "홈으로 돌아가기" }));
  expect(screen.getByRole("heading", { name: /건강 기록을/ })).toBeVisible();
});
