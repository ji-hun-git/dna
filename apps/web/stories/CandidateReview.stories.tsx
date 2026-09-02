import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { CandidateReview } from "@/components/integrated/CandidateReview";
import type { FoundationCandidate } from "@/lib/foundation/client";

const documentId = "e64ddaae-a326-4f23-88a9-05ac59a48625";

const firstCandidate: FoundationCandidate = {
  candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b001",
  documentId,
  status: "PENDING",
  label: "총콜레스테롤",
  value: "188",
  unit: "mg/dL",
  observedOn: "2026-07-28",
  evidencePage: 1,
  sourceTextSha256: "b".repeat(64),
  documentSha256: "a".repeat(64),
  sourceType: "SYNTHETIC_FIXED_FIXTURE",
  extractionMethod: "DETERMINISTIC_FOUNDATION_FIXTURE",
  createdAt: "2026-07-28T09:00:00Z",
  ordinal: 1,
  totalCandidates: 3,
};

const meta = {
  title: "Integrated/Candidate Review",
  component: CandidateReview,
  parameters: { layout: "fullscreen" },
  args: {
    candidate: firstCandidate,
    busy: false,
    errorMessage: "",
    onConfirm: () => {},
    onExclude: () => {},
    onBack: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof CandidateReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 확인대기: Story = { name: "확인 대기 · 1 / 3" };

export const 값수정중: Story = {
  name: "값 수정 중",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "값 수정" }));
  },
};

export const 마지막후보: Story = {
  name: "마지막 후보 · 3 / 3",
  args: {
    candidate: {
      ...firstCandidate,
      candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b003",
      label: "비타민 D",
      value: "31",
      unit: "ng/mL",
      sourceTextSha256: "d".repeat(64),
      createdAt: "2026-07-28T09:00:02Z",
      ordinal: 3,
      totalCandidates: 3,
    },
  },
};
