import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HealthTimeline } from "@/components/records/HealthTimeline";

const meta = {
  title: "Concept/Health Timeline",
  component: HealthTimeline,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HealthTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExampleTimeline: Story = { name: "출처가 보이는 건강 기록" };

export const TwoHundredPercentText: Story = {
  name: "200% 텍스트",
  decorators: [(Story) => <div style={{ fontSize: "200%" }}><Story /></div>],
};
