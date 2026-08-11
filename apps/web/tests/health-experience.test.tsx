import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { HealthExperience } from "@/components/experience/HealthExperience";

afterEach(cleanup);

it("moves from home through explicit per-item decisions and saves only confirmed records", async () => {
  const user = userEvent.setup();
  const { container } = render(<HealthExperience />);

  await user.click(screen.getByRole("button", { name: /새 결과지 가져오기/ }));
  expect(screen.getByRole("heading", { name: /어떤 결과지를\s*가져올까요/ })).toBeVisible();

  await user.click(screen.getByRole("button", { name: /이 기기에 있어요/ }));
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
  await user.click(screen.getByRole("button", { name: /이 기기에 있어요/ }));
  await user.click(screen.getByRole("button", { name: "수정할게요" }));

  const input = screen.getByRole("textbox", { name: "당화혈색소 값" });
  await user.clear(input);
  await user.type(input, "육점일");
  await user.click(screen.getByRole("button", { name: "수정값 저장" }));

  expect(screen.getByRole("alert")).toHaveTextContent("숫자만 입력해 주세요.");
  expect(screen.getByRole("dialog", { name: "수치를 수정할까요?" })).toBeVisible();
  expect(await axe(document.body)).toHaveNoViolations();
});
