import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HealthExperience } from "@/components/experience/HealthExperience";

const meta = {
  title: "Experience/Health Journey",
  component: HealthExperience,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof HealthExperience>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractiveJourney: Story = { name: "홈부터 기록 저장까지" };
