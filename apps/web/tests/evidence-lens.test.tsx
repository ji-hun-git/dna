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
};

it("shows exact source location, correction history, and a non-diagnostic boundary", async () => {
  const onBack = vi.fn();
  const { container } = render(<EvidenceLens record={correctedRecord} onBack={onBack} />);

  expect(screen.getByRole("heading", { name: "총콜레스테롤" })).toBeVisible();
  expect(screen.getAllByText("2쪽 · 검사결과 표 · 4행").length).toBeGreaterThan(0);
  expect(screen.getByText("188 → 190 mg/dL로 수정했어요.")).toBeVisible();
  expect(screen.getByRole("heading", { name: "이 화면은 진단 결과가 아니에요" })).toBeVisible();
  expect(screen.getByText(/sha256:7c91/)).toBeVisible();
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
