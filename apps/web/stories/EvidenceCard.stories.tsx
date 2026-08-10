import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EvidenceCard } from "@/components/evidence/EvidenceCard";
import { verifiedPriceFixture } from "@/tests/fixtures/public";

const meta = {
  title: "Evidence/EvidenceCard",
  component: EvidenceCard,
  parameters: { layout: "centered" },
  args: verifiedPriceFixture,
} satisfies Meta<typeof EvidenceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {
  name: "검증됨",
};

export const Stale: Story = {
  name: "업데이트 필요",
  args: {
    status: "stale",
    caveat: "공개자료의 적용기간이 지나 최신 여부를 다시 확인해야 합니다.",
  },
};

export const Unknown: Story = {
  name: "확인되지 않음",
  args: {
    value: "확인 필요",
    status: "unknown",
    caveat: "현재 자료만으로는 금액을 확인할 수 없습니다.",
    units: verifiedPriceFixture.units.map((unit) => ({ ...unit, active: false })),
  },
};

export const LongKoreanSourceName: Story = {
  name: "긴 한국어 출처명",
  args: {
    sourceName: "국민건강보험공단 건강검진 결과 공개자료 제공 및 검증 담당부서",
  },
};

export const TwoHundredPercentText: Story = {
  name: "200% 텍스트",
  decorators: [
    (Story) => (
      <div style={{ width: "min(calc(100dvw - 3rem), 42rem)", fontSize: "200%" }}>
        <Story />
      </div>
    ),
  ],
};

export const ReducedMotion: Story = {
  name: "모션 줄이기",
  parameters: {
    reducedMotion: "reduce",
    docs: {
      description: {
        story: "필수 정보에는 애니메이션을 사용하지 않으며, reduced-motion 환경에서도 동일하게 읽힙니다.",
      },
    },
  },
};
