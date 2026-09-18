import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { EvidenceDrawer } from "@/components/my-data/EvidenceDrawer";
import { syntheticHealthEvent } from "./fixtures/foundation";
import { shortDigest } from "@/lib/format/short-digest";

afterEach(cleanup);

it("shows source, page, digests and confirmation time for a verified event", () => {
  const event = syntheticHealthEvent();
  render(<EvidenceDrawer event={event} onClose={() => {}} />);
  const region = screen.getByRole("region", { name: "총콜레스테롤 근거" });
  expect(region).toHaveTextContent("188 mg/dL");
  expect(region).toHaveTextContent("2026. 7. 28.");
  expect(region).toHaveTextContent("1쪽");
  expect(region).toHaveTextContent("직접 확인한 값");
  expect(screen.getByRole("img", { name: /미리보기/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "기록 목록에서 이 값 보기" })).toHaveAttribute("href", `/records#record-${event.recordId}`);
  expect(region).toHaveTextContent(shortDigest(event.source.documentSha256));
  expect(region).toHaveTextContent(shortDigest(event.source.sourceTextSha256));
});

it("shows the result-sheet label when it differs, nothing when it is the same, and says so when it was never kept", () => {
  const { rerender } = render(<EvidenceDrawer event={syntheticHealthEvent()} onClose={() => {}} />);
  expect(screen.getByTestId("original-label")).toHaveTextContent("결과지 표기: Cholesterol");
  rerender(<EvidenceDrawer event={syntheticHealthEvent({ concept: "혈당", conceptCode: "glucose", originalLabel: "혈당" })} onClose={() => {}} />);
  expect(screen.queryByTestId("original-label")).toBeNull();
  expect(screen.queryByText("이 기록은 결과지 표기를 보존하기 전에 저장됐어요.")).toBeNull();
  const { originalLabel: _none, ...preV11 } = syntheticHealthEvent();
  rerender(<EvidenceDrawer event={preV11} onClose={() => {}} />);
  expect(screen.queryByTestId("original-label")).toBeNull();
  expect(screen.getByText("이 기록은 결과지 표기를 보존하기 전에 저장됐어요.")).toBeVisible();
});

it("explains a missing preview instead of hiding it, and lists the correction history for a corrected value", () => {
  const event = syntheticHealthEvent({
    verification: "uncertain",
    corrected: true,
    value: "190",
    originalValue: "188",
    correctionReason: "원문 재확인",
    observedOn: "2026-07-27",
    originalObservedOn: "2026-07-28",
    source: { ...syntheticHealthEvent().source, previewAvailable: false },
  });
  render(<EvidenceDrawer event={event} onClose={() => {}} />);
  expect(screen.getByText("출처 미리보기를 지금은 볼 수 없어요. 값은 그대로 두고, 출처 상태만 표시해요.")).toBeVisible();
  expect(screen.getByText("직접 수정한 값")).toBeVisible();
  expect(screen.queryByRole("img")).toBeNull();
  const history = screen.getByText("수정 이력").nextElementSibling;
  expect(history).toHaveTextContent("원래 값 188 mg/dL · 이유: 원문 재확인 · 원래 검사일 2026. 7. 28.");
  expect(document.body.textContent).not.toMatch(/증가|감소|상승|하락|정상|비정상/);
});

it("says 수정 없음 when nothing was corrected, and lists only the date when only the exam date changed", () => {
  render(<EvidenceDrawer event={syntheticHealthEvent()} onClose={() => {}} />);
  expect(screen.getByText("수정 이력").nextElementSibling).toHaveTextContent("수정 없음");
  cleanup();
  const dateOnly = syntheticHealthEvent({ corrected: true, observedOn: "2026-07-27", originalObservedOn: "2026-07-28" });
  render(<EvidenceDrawer event={dateOnly} onClose={() => {}} />);
  expect(screen.getByText("수정 이력").nextElementSibling).toHaveTextContent("원래 검사일 2026. 7. 28.");
  expect(screen.getByText("수정 이력").nextElementSibling).not.toHaveTextContent("원래 값");
});

it("closes from the button", async () => {
  const onClose = vi.fn();
  render(<EvidenceDrawer event={syntheticHealthEvent()} onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "근거 닫기" }));
  expect(onClose).toHaveBeenCalled();
});

it("links to the measurement history of this item", () => {
  render(<EvidenceDrawer event={syntheticHealthEvent()} onClose={() => {}} />);
  expect(screen.getByRole("link", { name: "이 항목의 측정 이력 보기" }))
    .toHaveAttribute("href", "/my-data/history#event-8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50");
});
