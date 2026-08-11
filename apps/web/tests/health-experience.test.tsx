import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { HealthExperience } from "@/components/experience/HealthExperience";

afterEach(cleanup);

it("moves from a local PDF receipt through explicit per-item decisions and saves only confirmed records", async () => {
  const user = userEvent.setup();
  const { container } = render(<HealthExperience />);

  await user.click(screen.getByRole("button", { name: /새 결과지 가져오기/ }));
  expect(screen.getByRole("heading", { name: /어떤 결과지를\s*가져올까요/ })).toBeVisible();

  await user.upload(
    screen.getByLabelText("기기에서 결과지 선택"),
    new File(["synthetic health result"], "synthetic-result.pdf", { type: "application/pdf" }),
  );
  expect(await screen.findByRole("heading", { name: /검토할 항목을\s*안전하게 나눴어요/ })).toBeVisible();
  expect(screen.getByText("합성 데모예요")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "3개 항목 검토 시작" }));
  expect(screen.getByRole("heading", { name: "이 수치가 맞나요?" })).toBeVisible();
  expect(screen.getByText("항목 1 / 3")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "맞아요" }));
  expect(screen.getByRole("heading", { name: "총콜레스테롤" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "수정할게요" }));
  const input = screen.getByRole("textbox", { name: "총콜레스테롤 값" });
  await user.clear(input);
  await user.type(input, "190");
  await user.click(screen.getByRole("button", { name: "수정값 저장" }));
  expect(screen.getByRole("heading", { name: "비타민 D" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "기록에서 제외" }));
  expect(screen.getByRole("heading", { name: /2개 항목을\s*기록할 준비가 됐어요/ })).toBeVisible();
  expect(screen.getByText("1개")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "건강 기록에 추가" }));
  expect(screen.getByText("2개 항목을 건강 기록에 추가했어요")).toBeVisible();
  expect(screen.queryByText(/확인을 기다리는 항목/)).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});

it("rejects non-numeric corrections and keeps the current item open", async () => {
  const user = userEvent.setup();
  render(<HealthExperience />);
  await user.click(screen.getByRole("button", { name: /새 결과지 가져오기/ }));
  await user.upload(
    screen.getByLabelText("기기에서 결과지 선택"),
    new File(["synthetic health result"], "synthetic-result.pdf", { type: "application/pdf" }),
  );
  await screen.findByRole("heading", { name: /검토할 항목을\s*안전하게 나눴어요/ });
  await user.click(screen.getByRole("button", { name: "3개 항목 검토 시작" }));
  await user.click(screen.getByRole("button", { name: "수정할게요" }));

  const input = screen.getByRole("textbox", { name: "당화혈색소 값" });
  await user.clear(input);
  await user.type(input, "육점일");
  await user.click(screen.getByRole("button", { name: "수정값 저장" }));

  expect(screen.getByRole("alert")).toHaveTextContent("숫자만 입력해 주세요.");
  expect(screen.getByRole("dialog", { name: "수치를 수정할까요?" })).toBeVisible();
  expect(await axe(document.body)).toHaveNoViolations();
});

it("rejects unsupported and oversized local files before any review value appears", async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<HealthExperience />);
  await user.click(screen.getByRole("button", { name: /새 결과지 가져오기/ }));

  const input = screen.getByLabelText("기기에서 결과지 선택");
  await user.upload(input, new File(["not a result"], "notes.txt", { type: "text/plain" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("PDF, PNG, JPEG 파일만 선택할 수 있어요.");
  expect(screen.queryByText("당화혈색소")).not.toBeInTheDocument();

  await user.upload(
    input,
    new File([new Uint8Array(20 * 1024 * 1024 + 1)], "too-large.pdf", { type: "application/pdf" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("파일은 20MB 이하여야 해요.");
});
