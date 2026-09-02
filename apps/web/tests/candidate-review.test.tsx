import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it, vi } from "vitest";
import { CandidateReview } from "@/components/integrated/CandidateReview";
import { syntheticCandidates } from "./fixtures/foundation";

afterEach(cleanup);

function reviewProps() {
  return {
    candidate: syntheticCandidates[0],
    busy: false,
    errorMessage: "",
    onConfirm: vi.fn(),
    onExclude: vi.fn(),
    onBack: vi.fn(),
    onClose: vi.fn(),
  };
}

it("shows the review position of the candidate the server asked about", () => {
  render(<CandidateReview {...reviewProps()} candidate={syntheticCandidates[1]} />);

  expect(screen.getByLabelText("검토 진행")).toHaveTextContent("2 / 3");
  expect(screen.getByRole("heading", { level: 2, name: "당화혈색소" })).toBeVisible();
  expect(screen.getByText("2026. 7. 28.")).toBeVisible();
});

it("confirms the untouched candidate value", async () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);

  await userEvent.click(screen.getByRole("button", { name: "원문과 같아요" }));

  expect(props.onConfirm).toHaveBeenCalledWith("188");
  expect(props.onExclude).not.toHaveBeenCalled();
});

it("sends a corrected value only after the person edits it", async () => {
  const props = reviewProps();
  render(<CandidateReview {...props} />);

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

  await userEvent.click(screen.getByRole("button", { name: "이 항목 빼기" }));

  expect(props.onExclude).toHaveBeenCalledTimes(1);
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it("keeps the review screen accessible", async () => {
  const { container } = render(
    <CandidateReview {...reviewProps()} previewUrl="/api/foundation/documents/x/preview" />,
  );

  expect(await axe(container)).toHaveNoViolations();
});
