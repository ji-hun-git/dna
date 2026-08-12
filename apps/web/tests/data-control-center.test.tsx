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
  expect(screen.getByText("예시 화면 · 서버에는 반영되지 않아요")).toBeVisible();
  expect(screen.getByText("결과지로 건강 기록 만들기")).toBeVisible();
  expect(screen.getByText("한국 내 서버에서 결과지 읽기")).toBeVisible();
  expect(screen.getByText("원본 결과지 암호화 보관")).toBeVisible();
  expect(screen.getByText("확인 후 바로 삭제")).toBeVisible();
  expect(screen.getAllByText("검사 결과지 · 진료 기록")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "계정과 데이터 모두 삭제 아직 사용할 수 없음" })).toBeDisabled();
  expect(await axe(container)).toHaveNoViolations();
});

it("revokes only the selected local demo purpose and appends a redacted audit event", async () => {
  const user = userEvent.setup();
  render(<DataControlCenter />);

  await user.click(screen.getByRole("button", { name: "결과지로 건강 기록 만들기 동의 철회" }));
  const dialog = screen.getByRole("dialog", { name: "이 동의를 철회할까요?" });
  expect(within(dialog).getByText(/이 예시 화면에서만 바뀌며/)).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "동의 철회" }));

  expect(screen.getByText("철회됨")).toBeVisible();
  expect(screen.getByText("결과지 기록 동의를 철회함 · 예시")).toBeVisible();
  expect(screen.queryByText(/이메일|전화번호|주민등록/)).not.toBeInTheDocument();
});
