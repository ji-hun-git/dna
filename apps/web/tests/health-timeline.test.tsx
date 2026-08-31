import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, expect, it } from "vitest";
import { HealthTimeline } from "@/components/records/HealthTimeline";
import { demoHealthTimeline, demoHealthTimelineSchema } from "@/lib/records/demo-health-timeline";

afterEach(cleanup);

it("freezes an example-only, source-bound longitudinal record contract", () => {
  expect(demoHealthTimeline.realRecordCount).toBe(0);
  expect(demoHealthTimeline.metrics).toHaveLength(3);
  expect(demoHealthTimeline.metrics.flatMap((metric) => metric.records)).toHaveLength(7);
  expect(demoHealthTimeline.metrics.every((metric) => (
    metric.records.every((record) => record.sourceName.startsWith("예시 "))
  ))).toBe(true);
  expect(demoHealthTimelineSchema.safeParse({ ...demoHealthTimeline, realRecordCount: 1 }).success).toBe(false);
  expect(demoHealthTimelineSchema.safeParse({
    ...demoHealthTimeline,
    metrics: demoHealthTimeline.metrics.map((metric, metricIndex) => metricIndex === 0 ? {
      ...metric,
      records: metric.records.map((record, recordIndex) => recordIndex === 0
        ? { ...record, sourceName: "실제 병원 결과지" }
        : record),
    } : metric),
  }).success).toBe(false);
});

it("shows changes, source, and confirmation history without implying diagnosis", async () => {
  const user = userEvent.setup();
  const { container } = render(<HealthTimeline />);

  expect(screen.getByRole("heading", { name: /시간이 지나며\s*무엇이 바뀌었는지 확인하세요/ })).toBeVisible();
  expect(screen.getByText("실제 파일이나 기관 API에서 가져온 기록이 아니에요")).toBeVisible();
  expect(screen.getByRole("img", { name: /당화혈색소 예시 기록/ })).toBeVisible();
  expect(screen.getByText("이전 예시 기록보다 0.2%p 낮아요")).toBeVisible();
  expect(screen.getAllByText("직접 확인").length).toBeGreaterThan(0);

  await user.click(screen.getByRole("button", { name: /총콜레스테롤.*188/ }));
  const selectedMetric = screen.getByRole("article", { name: "총콜레스테롤" });
  expect(within(selectedMetric).getAllByText("188").length).toBeGreaterThan(0);
  expect(within(selectedMetric).getByText("이전 예시 기록보다 6 mg/dL 낮아요")).toBeVisible();
  expect(screen.getByRole("img", { name: /총콜레스테롤 예시 기록/ })).toBeVisible();

  await user.click(screen.getAllByText("출처와 확인 이력 보기")[0]);
  expect(screen.getAllByText("사용자가 예시 값을 수정해 확인함").length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "이 화면은 진단 결과가 아니에요" })).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});
