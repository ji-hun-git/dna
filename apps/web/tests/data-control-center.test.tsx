import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { DataControlCenter } from "@/components/privacy/DataControlCenter";
import { consentPurposeViewSchema, initialConsentPurposeViews } from "@/lib/consent/demo-consent";

afterEach(cleanup);

it("freezes three separate purpose contracts and rejects bundled or extra authority", () => {
  expect(initialConsentPurposeViews.map((purpose) => purpose.id)).toEqual([
    "build-personal-lab-timeline",
    "process-uploaded-document-in-kr-cloud",
    "retain-verified-source",
  ]);
  expect(consentPurposeViewSchema.safeParse({
    ...initialConsentPurposeViews[0],
    operations: ["COLLECT", "EXPLAIN", "RETAIN"],
    grantsAllHealthData: true,
  }).success).toBe(false);
});

it("renders purpose-bound consent and deletion defaults without implying a live backend", async () => {
  const { container } = render(<DataControlCenter />);

  expect(screen.getByRole("heading", { name: "내 데이터는 내가 정해요" })).toBeVisible();
  expect(screen.getByText("합성 시연 · 서버 반영 없음")).toBeVisible();
  expect(screen.getByText("결과지로 건강 기록 만들기")).toBeVisible();
  expect(screen.getByText("한국 클라우드에서 결과지 처리")).toBeVisible();
  expect(screen.getByText("원본 결과지 암호화 보관")).toBeVisible();
  expect(screen.getByText("확인 후 즉시 삭제")).toBeVisible();
  expect(screen.getAllByText("LAB_REPORT · MEDICAL_RECORD")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "전체 계정 데이터 삭제 실제 계정 연결 후 제공" })).toBeDisabled();
  expect(await axe(container)).toHaveNoViolations();
});

it("revokes only the selected local demo purpose and appends a redacted audit event", async () => {
  const user = userEvent.setup();
  render(<DataControlCenter />);

  await user.click(screen.getByRole("button", { name: "결과지로 건강 기록 만들기 동의 철회" }));
  const dialog = screen.getByRole("dialog", { name: "이 동의를 철회할까요?" });
  expect(within(dialog).getByText(/이 합성 화면에서만 상태가 바뀌어요/)).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "시연 동의 철회" }));

  expect(screen.getByText("철회됨")).toBeVisible();
  expect(screen.getByText("결과지 기록 목적 철회 · 합성 시연")).toBeVisible();
  expect(screen.queryByText(/이메일|전화번호|주민등록/)).not.toBeInTheDocument();
});
