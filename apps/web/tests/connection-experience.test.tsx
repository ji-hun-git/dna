import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { ConnectionExperience } from "@/components/connections/ConnectionExperience";

afterEach(cleanup);

it("keeps identity and health-data consent visibly separate", async () => {
  const { container } = render(<ConnectionExperience />);

  expect(screen.getByRole("heading", { name: "연결은 내가 허용한 만큼만" })).toBeVisible();
  expect(screen.getByText("로그인은 건강정보 제공 동의가 아니에요")).toBeVisible();
  expect(screen.getByRole("button", { name: "카카오 로그인 준비 중" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "네이버 로그인 준비 중" })).toBeDisabled();
  expect(screen.getByText("기관 승인 대기")).toBeVisible();
  expect(screen.getByText("건강정보고속도로 · MyHealthWay")).toBeVisible();
  expect(screen.getByText("비밀번호를 대신 받지 않아요")).toBeVisible();
  expect(screen.getByText("이메일만으로 계정을 합치지 않아요")).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});

it("shows every formal MyHealthWay readiness gate without implying access is live", () => {
  render(<ConnectionExperience />);

  for (const gate of ["기관 등록", "테스트베드", "적합성 검증", "운영 전환", "개인정보·이용목적 심사"]) {
    expect(screen.getByText(gate)).toBeVisible();
  }
  expect(screen.queryByText("연결됨")).not.toBeInTheDocument();
});
