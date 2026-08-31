import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { ConnectionExperience } from "@/components/connections/ConnectionExperience";

afterEach(cleanup);

it("keeps identity and health-data consent visibly separate", async () => {
  const { container } = render(<ConnectionExperience />);

  expect(screen.getByRole("heading", { name: "필요한 정보만 연결해요" })).toBeVisible();
  expect(screen.getByText("로그인은 건강정보 제공 동의가 아니에요")).toBeVisible();
  expect(screen.getByRole("button", { name: "카카오 로그인 준비 중" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "네이버 로그인 준비 중" })).toBeDisabled();
  expect(screen.getByText("연결 준비 전")).toBeVisible();
  expect(screen.getByText("건강정보고속도로")).toBeVisible();
  expect(screen.getByText("비밀번호를 대신 받지 않아요")).toBeVisible();
  expect(screen.getByText("이메일이 같다는 이유만으로 계정을 합치지 않아요")).toBeVisible();
  expect(screen.getByRole("link", { name: /동의와 보관 설정 보기/ })).toHaveAttribute("href", "/data-control");
  expect(await axe(container)).toHaveNoViolations();
});

it("shows every formal MyHealthWay readiness gate without implying access is live", () => {
  render(<ConnectionExperience />);

  for (const gate of ["기관 등록", "테스트베드", "적합성 검증", "운영 전환", "개인정보·이용목적 심사"]) {
    expect(screen.getByText(gate)).toBeVisible();
  }
  expect(screen.getAllByText("미완료")).toHaveLength(5);
  expect(screen.queryByText("연결됨")).not.toBeInTheDocument();
});
