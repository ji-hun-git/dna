import type { Meta, StoryObj } from "@storybook/react-vite";
import { HealthHomeConcept } from "@/components/concept/HealthHomeConcept";

const syntheticHome = {
  userName: "지훈",
  updatedAt: "2026-08-10",
  sourceCount: 4,
  recordCount: 17,
  pendingReviewCount: 3,
  metric: {
    name: "당화혈색소",
    value: "6.1",
    unit: "%",
    observedAt: "2026-07-28",
    delta: "이전 기록보다 0.2%p 낮아요",
    source: "예시 건강검진 결과지",
    status: "verified" as const,
  },
  recentRecords: [
    { id: "record-1", label: "당화혈색소", value: "6.1%", source: "예시 건강검진 결과지", observedAt: "2026-07-28" },
    { id: "record-2", label: "총콜레스테롤", value: "188 mg/dL", source: "예시 건강검진 결과지", observedAt: "2026-07-28" },
    { id: "record-3", label: "비타민 D", value: "31 ng/mL", source: "예시 대학병원 검사 결과", observedAt: "2026-04-12" },
  ],
};

const meta = {
  title: "Concept/Health Home",
  component: HealthHomeConcept,
  parameters: { layout: "fullscreen" },
  args: syntheticHome,
} satisfies Meta<typeof HealthHomeConcept>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConnectedRecords: Story = { name: "연결된 건강 기록" };

export const NoPendingReview: Story = {
  name: "확인할 항목 없음",
  args: { pendingReviewCount: 0 },
};

export const TwoHundredPercentText: Story = {
  name: "200% 텍스트",
  decorators: [(Story) => <div style={{ fontSize: "200%" }}><Story /></div>],
};
