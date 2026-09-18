import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it, vi } from "vitest";
import { CandidateReview } from "@/components/integrated/CandidateReview";
import { syntheticCandidates } from "./fixtures/foundation";

afterEach(cleanup);

it("waits for the source image to load before allowing confirmation", () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);
  expect(screen.getByRole("button", {name: "확인: 원문과 같아요"})).toBeDisabled();
  expect(screen.getByRole("button", {name: "값 수정"})).toBeDisabled();
  fireEvent.load(screen.getByRole("img"));
  expect(screen.getByRole("button", {name: "확인: 원문과 같아요"})).toBeEnabled();
});

it("requires a successful reload after a failed source preview", async () => {
  render(<CandidateReview {...reviewProps()} />);
  fireEvent.error(screen.getByRole("img"));
  await userEvent.click(screen.getByRole("button", {name: "다시 불러오기"}));
  expect(screen.getByRole("button", {name: "확인: 원문과 같아요"})).toBeDisabled();
  fireEvent.load(screen.getByRole("img"));
  expect(screen.getByRole("button", {name: "확인: 원문과 같아요"})).toBeEnabled();
});

function reviewProps() {
  return {
    candidate: syntheticCandidates[0],
    previewUrl: "/api/foundation/documents/e64ddaae-a326-4f23-88a9-05ac59a48625/preview",
    busy: false,
    errorMessage: "",
    onConfirm: vi.fn(),
    onExclude: vi.fn(),
    onBack: vi.fn(),
    onClose: vi.fn(),
  };
}

it("shows the result-sheet label under the normalized name only when they differ", () => {
  const { rerender } = render(<CandidateReview {...reviewProps()} />);
  expect(screen.getByRole("heading", { level: 2, name: "총콜레스테롤" })).toBeVisible();
  expect(screen.getByTestId("original-label")).toHaveTextContent("결과지 표기: Cholesterol");
  rerender(<CandidateReview {...reviewProps()} candidate={{ ...syntheticCandidates[0], label: "혈당", conceptCode: "glucose", originalLabel: "혈당" }} />);
  expect(screen.queryByTestId("original-label")).toBeNull();
  const { originalLabel: _none, ...preV11 } = syntheticCandidates[0];
  rerender(<CandidateReview {...reviewProps()} candidate={preV11} />);
  expect(screen.queryByTestId("original-label")).toBeNull();
});

it("shows the review position of the candidate the server asked about", () => {
  render(<CandidateReview {...reviewProps()} candidate={syntheticCandidates[1]} />);

  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3");
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();
  expect(screen.getByText("2026. 7. 28.")).toBeVisible();
  expect(screen.getByText("확인 대기")).toBeVisible();
  expect(screen.queryByText("PENDING")).toBeNull();
});

it("confirms the untouched candidate value", async () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "확인: 원문과 같아요" }));

  expect(props.onConfirm).toHaveBeenCalledWith("188");
  expect(props.onExclude).not.toHaveBeenCalled();
});

it("sends a corrected value only after the person edits it", async () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "값 수정" }));
  const input = screen.getByLabelText("원문과 같은 값으로 수정");
  await userEvent.clear(input);
  await userEvent.type(input, "190");
  await userEvent.click(screen.getByRole("button", { name: "수정한 값 확인" }));

  expect(props.onConfirm).toHaveBeenCalledWith("190");
});

it("excludes the candidate without saving a record", async () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);

  await userEvent.click(screen.getByRole("button", { name: "제외: 이 항목 빼기" }));

  expect(props.onExclude).toHaveBeenCalledTimes(1);
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it("keeps the review screen accessible", async () => {
  const { container } = render(
    <CandidateReview {...reviewProps()} previewUrl="/api/foundation/documents/x/preview" />,
  );

  expect(await axe(container)).toHaveNoViolations();
});

it("does not confirm blindly when the source is missing or fails to load", async () => {
  const props = reviewProps();
  const {rerender} = render(<CandidateReview {...props} previewUrl={undefined} />);
  expect(screen.getByRole("button", {name:"확인: 원문과 같아요"})).toBeDisabled();
  rerender(<CandidateReview {...props} />);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("button", {name:"확인: 원문과 같아요"})).toBeDisabled();
  expect(screen.getByRole("button", {name:"값 수정"})).toBeDisabled();
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it("says the value was read from the document text layer, never from image recognition", () => {
  render(<CandidateReview {...reviewProps()} />);
  expect(screen.getByText("결과지의 글자 정보에서 읽은 값이에요. 이미지를 판독한 결과가 아니며, 확인하기 전까지 기록이 아니에요.")).toBeVisible();
  expect(screen.getAllByText("결과지 텍스트에서 읽은 값 · 문자 인식 아님").length).toBeGreaterThan(0);
  expect(screen.queryByText(/서버가 미리 정한 예시 값/)).toBeNull();
});

it("shows the evidence page and the normalized evidence box of the candidate", () => {
  render(<CandidateReview {...reviewProps()} candidate={{ ...syntheticCandidates[0], evidenceBox: { x: 0.08, y: 0.12, width: 0.3, height: 0.02 } }} />);
  expect(screen.getByText("근거 쪽수").nextElementSibling).toHaveTextContent("1쪽");
  expect(screen.getByText("근거 위치").nextElementSibling).toHaveTextContent("왼쪽 8% · 위 12% · 너비 30% · 높이 2%");
});

it("omits the evidence box row when the server sent none", () => {
  const { evidenceBox: _box, ...withoutBox } = syntheticCandidates[0];
  render(<CandidateReview {...reviewProps()} candidate={withoutBox} />);
  expect(screen.queryByText("근거 위치")).toBeNull();
});

it("sends a corrected exam date with the untouched value", async () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "검사일 수정" }));
  expect(screen.getByText("결과지에 적힌 검사일과 다르면 고쳐 주세요. 값의 의미는 판단하지 않아요.")).toBeVisible();
  const input = screen.getByLabelText("검사일 수정");
  expect(input).toHaveValue("2026-07-28");
  fireEvent.change(input, { target: { value: "2026-07-27" } });
  await userEvent.click(screen.getByRole("button", { name: "수정한 검사일 확인" }));

  expect(props.onConfirm).toHaveBeenCalledWith("188", "2026-07-27");
});

it("refuses a future or pre-1900 exam date and keeps the value untouched", async () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "검사일 수정" }));
  const input = screen.getByLabelText("검사일 수정");
  fireEvent.change(input, { target: { value: "2999-01-01" } });
  expect(screen.getByRole("button", { name: "수정한 검사일 확인" })).toBeDisabled();
  fireEvent.change(input, { target: { value: "1899-12-31" } });
  expect(screen.getByRole("button", { name: "수정한 검사일 확인" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.getByRole("button", { name: "검사일 수정" })).toBeVisible();
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it("does not offer the date form until the source image is visible", () => {
  render(<CandidateReview {...reviewProps()} />);
  expect(screen.getByRole("button", { name: "검사일 수정" })).toBeDisabled();
  fireEvent.load(screen.getByRole("img"));
  expect(screen.getByRole("button", { name: "검사일 수정" })).toBeEnabled();
});

it("announces a future exam date as an alert and marks the input invalid", async () => {
  render(<CandidateReview {...reviewProps()} />);
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "검사일 수정" }));
  const input = screen.getByLabelText("검사일 수정");
  expect(input).not.toHaveAttribute("aria-invalid", "true");

  fireEvent.change(input, { target: { value: "2999-01-01" } });
  expect(screen.getByRole("alert")).toHaveTextContent("오늘 이후 날짜는 쓸 수 없어요.");
  expect(input).toHaveAttribute("aria-invalid", "true");

  fireEvent.change(input, { target: { value: "2026-07-27" } });
  expect(screen.queryByRole("alert", { name: "" })).toBeNull();
  expect(screen.queryByText("오늘 이후 날짜는 쓸 수 없어요.")).toBeNull();
  expect(input).not.toHaveAttribute("aria-invalid", "true");
});

it("announces a pre-1900 exam date as an alert", async () => {
  render(<CandidateReview {...reviewProps()} />);
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "검사일 수정" }));
  const input = screen.getByLabelText("검사일 수정");
  fireEvent.change(input, { target: { value: "1899-12-31" } });

  expect(screen.getByRole("alert")).toHaveTextContent("1900년 이전 날짜는 쓸 수 없어요.");
  expect(input).toHaveAttribute("aria-invalid", "true");
});

it("links the invalid-date alert to the input via aria-describedby along with the help text", async () => {
  render(<CandidateReview {...reviewProps()} />);
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "검사일 수정" }));
  const input = screen.getByLabelText("검사일 수정");
  fireEvent.change(input, { target: { value: "2999-01-01" } });

  const describedBy = input.getAttribute("aria-describedby") ?? "";
  const alert = screen.getByRole("alert");
  expect(describedBy.split(/\s+/)).toContain(alert.id);
  expect(describedBy.split(/\s+/)).toContain("integrated-candidate-observed-on-help");
});

it("sends the untouched value alone when the exam date form is submitted without changing the date", async () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);
  fireEvent.load(screen.getByRole("img"));

  await userEvent.click(screen.getByRole("button", { name: "검사일 수정" }));
  await userEvent.click(screen.getByRole("button", { name: "수정한 검사일 확인" }));

  expect(props.onConfirm).toHaveBeenCalledWith("188");
  expect(props.onConfirm).not.toHaveBeenCalledWith("188", "2026-07-28");
});
