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

it("explains a missing preview instead of hiding it, and names a corrected value", () => {
  const event = syntheticHealthEvent({ verification: "uncertain", corrected: true, source: { ...syntheticHealthEvent().source, previewAvailable: false } });
  render(<EvidenceDrawer event={event} onClose={() => {}} />);
  expect(screen.getByText("출처 미리보기를 지금은 볼 수 없어요. 값은 그대로 두고, 출처 상태만 표시해요.")).toBeVisible();
  expect(screen.getByText("직접 수정한 값")).toBeVisible();
  expect(screen.queryByRole("img")).toBeNull();
});

it("closes from the button", async () => {
  const onClose = vi.fn();
  render(<EvidenceDrawer event={syntheticHealthEvent()} onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "근거 닫기" }));
  expect(onClose).toHaveBeenCalled();
});
