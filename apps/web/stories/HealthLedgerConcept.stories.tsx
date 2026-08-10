import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HealthLedgerConcept } from "@/components/concept/HealthLedgerConcept";

const syntheticLedger = {
  profileLabel: "나의 건강 기록",
  updatedAt: "2026-08-10",
  metric: {
    name: "당화혈색소",
    value: "6.1",
    unit: "%",
    observedAt: "2026-07-28",
    delta: "지난 기록보다 0.2%p 낮음",
    status: "verified" as const,
  },
  observations: [
    { id: "obs-1", monthIndex: 3, date: "2022-02-14", value: "6.8", source: "합성 건강검진 결과지" },
    { id: "obs-2", monthIndex: 20, date: "2023-07-18", value: "6.6", source: "합성 건강검진 결과지" },
    { id: "obs-3", monthIndex: 43, date: "2025-06-25", value: "6.3", source: "합성 건강검진 결과지" },
    { id: "obs-4", monthIndex: 56, date: "2026-07-28", value: "6.1", source: "합성 건강검진 결과지" },
  ],
};

const meta = {
  title: "Concept/Evidence Field",
  component: HealthLedgerConcept,
  parameters: { layout: "fullscreen" },
  args: syntheticLedger,
} satisfies Meta<typeof HealthLedgerConcept>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VerifiedFiveYearLedger: Story = {
  name: "시간 위의 증거",
};

export const TwoHundredPercentText: Story = {
  name: "200% 텍스트",
  decorators: [
    (Story) => (
      <div style={{ fontSize: "200%" }}>
        <Story />
      </div>
    ),
  ],
};
