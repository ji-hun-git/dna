import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { HealthExperience } from "@/components/experience/HealthExperience";

afterEach(cleanup);

it("moves from a local PDF receipt through explicit per-item decisions and saves only confirmed records", async () => {
  const user = userEvent.setup();
  const { container } = render(<HealthExperience />);

  await user.click(screen.getAllByRole("button", { name: "결과지 추가" })[0]);
  expect(screen.getByRole("heading", { name: /결과지가\s*어디에 있나요/ })).toBeVisible();

  await user.upload(
    screen.getByLabelText("기기에서 결과지 선택"),
    new File(["synthetic health result"], "synthetic-result.pdf", { type: "application/pdf" }),
  );
  expect(await screen.findByRole("heading", { name: /파일 확인을\s*마쳤어요/ })).toBeVisible();
  expect(screen.getByText("예시 화면이에요")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "예시 항목 3개 확인하기" }));
  expect(screen.getByRole("heading", { name: "이 값이 맞나요?" })).toBeVisible();
  expect(screen.getByText("3. 항목 확인 · 1 / 3")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "원문과 같아요" }));
  expect(screen.getByRole("heading", { name: "총콜레스테롤" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "값 수정" }));
  const input = screen.getByRole("textbox", { name: "총콜레스테롤 값" });
  await user.clear(input);
  await user.type(input, "190");
  await user.click(screen.getByRole("button", { name: "수정한 값 저장" }));
  expect(screen.getByRole("heading", { name: "비타민 D" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "이 항목 빼기" }));
  expect(screen.getByRole("heading", { name: /예시 항목 2개를\s*확인했어요/ })).toBeVisible();
  expect(screen.getByText("1개")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "시연 화면에 추가" }));
  expect(screen.getByText("확인한 항목 2개를 추가했어요")).toBeVisible();
  expect(screen.queryByText(/아직 확인하지 않은 항목/)).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});

it("rejects non-numeric corrections and keeps the current item open", async () => {
  const user = userEvent.setup();
  render(<HealthExperience />);
  await user.click(screen.getAllByRole("button", { name: "결과지 추가" })[0]);
  await user.upload(
    screen.getByLabelText("기기에서 결과지 선택"),
    new File(["synthetic health result"], "synthetic-result.pdf", { type: "application/pdf" }),
  );
  await screen.findByRole("heading", { name: /파일 확인을\s*마쳤어요/ });
  await user.click(screen.getByRole("button", { name: "예시 항목 3개 확인하기" }));
  await user.click(screen.getByRole("button", { name: "값 수정" }));

  const input = screen.getByRole("textbox", { name: "당화혈색소 값" });
  await user.clear(input);
  await user.type(input, "육점일");
  await user.click(screen.getByRole("button", { name: "수정한 값 저장" }));

  expect(screen.getByRole("alert")).toHaveTextContent("숫자로 입력해 주세요. 예: 6.1");
  expect(screen.getByRole("dialog", { name: "값 수정" })).toBeVisible();
  expect(await axe(document.body)).toHaveNoViolations();
});

it("rejects unsupported and oversized local files before any review value appears", async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<HealthExperience />);
  await user.click(screen.getAllByRole("button", { name: "결과지 추가" })[0]);

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

it("continues the pending example review from the home call to action", async () => {
  const user = userEvent.setup();
  render(<HealthExperience />);

  await user.click(screen.getByRole("button", { name: "이어서 확인" }));

  expect(screen.getByRole("heading", { name: "이 값이 맞나요?" })).toBeVisible();
  expect(screen.getByText("3. 항목 확인 · 1 / 3")).toBeVisible();
});
