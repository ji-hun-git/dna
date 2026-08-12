import { z } from "zod";

const metricIdSchema = z.enum(["hba1c", "total-cholesterol", "vitamin-d"]);

const timelineRecordSchema = z.strictObject({
  id: z.string().regex(/^demo-record-[a-z0-9-]+$/),
  observedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().finite().nonnegative(),
  displayValue: z.string().min(1).max(20),
  sourceName: z.string().startsWith("예시 "),
  sourceLocation: z.string().min(1).max(80),
  confirmationNote: z.enum([
    "사용자가 원문과 같다고 확인함",
    "사용자가 예시 값을 수정해 확인함",
  ]),
  sourceDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
});

const timelineMetricSchema = z.strictObject({
  id: metricIdSchema,
  label: z.string().min(1).max(30),
  unit: z.string().min(1).max(20),
  referenceText: z.string().min(1).max(60),
  records: z.array(timelineRecordSchema).min(2).max(12),
}).superRefine((metric, context) => {
  const dates = metric.records.map((record) => record.observedAt);
  const sortedDates = [...dates].sort();
  if (new Set(metric.records.map((record) => record.id)).size !== metric.records.length) {
    context.addIssue({ code: "custom", message: "timeline record ids must be unique" });
  }
  if (dates.some((date, index) => date !== sortedDates[index])) {
    context.addIssue({ code: "custom", message: "timeline records must be oldest first" });
  }
});

export const demoHealthTimelineSchema = z.strictObject({
  schemaVersion: z.literal("demo-health-timeline.v1"),
  environment: z.literal("synthetic-demo"),
  realRecordCount: z.literal(0),
  metrics: z.array(timelineMetricSchema).length(3),
});

const digest = (character: string) => `sha256:${character.repeat(64)}`;

export const demoHealthTimeline = demoHealthTimelineSchema.parse({
  schemaVersion: "demo-health-timeline.v1",
  environment: "synthetic-demo",
  realRecordCount: 0,
  metrics: [
    {
      id: "hba1c",
      label: "당화혈색소",
      unit: "%",
      referenceText: "예시 결과지 참고치 · 4.0–5.6 %",
      records: [
        {
          id: "demo-record-hba1c-20250807",
          observedAt: "2025-08-07",
          value: 6.4,
          displayValue: "6.4",
          sourceName: "예시 도심 건강검진 결과지",
          sourceLocation: "2쪽 · 검사결과 표 · 4행",
          confirmationNote: "사용자가 원문과 같다고 확인함",
          sourceDigest: digest("1"),
        },
        {
          id: "demo-record-hba1c-20260123",
          observedAt: "2026-01-23",
          value: 6.3,
          displayValue: "6.3",
          sourceName: "예시 지역 건강검진 결과지",
          sourceLocation: "3쪽 · 혈액검사 표 · 2행",
          confirmationNote: "사용자가 원문과 같다고 확인함",
          sourceDigest: digest("2"),
        },
        {
          id: "demo-record-hba1c-20260728",
          observedAt: "2026-07-28",
          value: 6.1,
          displayValue: "6.1",
          sourceName: "예시 건강검진 결과지",
          sourceLocation: "2쪽 · 검사결과 표 · 4행",
          confirmationNote: "사용자가 원문과 같다고 확인함",
          sourceDigest: digest("3"),
        },
      ],
    },
    {
      id: "total-cholesterol",
      label: "총콜레스테롤",
      unit: "mg/dL",
      referenceText: "예시 결과지 참고치 · 120–199 mg/dL",
      records: [
        {
          id: "demo-record-cholesterol-20250807",
          observedAt: "2025-08-07",
          value: 194,
          displayValue: "194",
          sourceName: "예시 도심 건강검진 결과지",
          sourceLocation: "2쪽 · 검사결과 표 · 5행",
          confirmationNote: "사용자가 원문과 같다고 확인함",
          sourceDigest: digest("4"),
        },
        {
          id: "demo-record-cholesterol-20260728",
          observedAt: "2026-07-28",
          value: 188,
          displayValue: "188",
          sourceName: "예시 건강검진 결과지",
          sourceLocation: "2쪽 · 검사결과 표 · 5행",
          confirmationNote: "사용자가 예시 값을 수정해 확인함",
          sourceDigest: digest("5"),
        },
      ],
    },
    {
      id: "vitamin-d",
      label: "비타민 D",
      unit: "ng/mL",
      referenceText: "예시 결과지 참고치 · 30–100 ng/mL",
      records: [
        {
          id: "demo-record-vitamin-d-20250807",
          observedAt: "2025-08-07",
          value: 24,
          displayValue: "24",
          sourceName: "예시 도심 건강검진 결과지",
          sourceLocation: "2쪽 · 검사결과 표 · 8행",
          confirmationNote: "사용자가 원문과 같다고 확인함",
          sourceDigest: digest("6"),
        },
        {
          id: "demo-record-vitamin-d-20260412",
          observedAt: "2026-04-12",
          value: 31,
          displayValue: "31",
          sourceName: "예시 대학병원 검사 결과",
          sourceLocation: "1쪽 · 혈액검사 표 · 7행",
          confirmationNote: "사용자가 원문과 같다고 확인함",
          sourceDigest: digest("7"),
        },
      ],
    },
  ],
});

export type DemoHealthMetric = (typeof demoHealthTimeline.metrics)[number];
