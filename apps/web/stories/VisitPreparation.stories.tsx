import type { Meta, StoryObj } from "@storybook/react-vite";
import { VisitPreparation } from "@/components/integrated/VisitPreparation";
import type { FoundationRecord } from "@/lib/foundation/client";

const documentId = "e64ddaae-a326-4f23-88a9-05ac59a48625";

const baseRecord: FoundationRecord = {
  recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c40",
  recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50",
  candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b001",
  documentId,
  status: "CURRENT",
  reviewDecision: "CORRECTED",
  label: "총콜레스테롤",
  value: "190",
  originalValue: "188",
  unit: "mg/dL",
  observedOn: "2026-07-28",
  confirmedAt: "2026-07-28T09:10:00Z",
  evidencePage: 1,
  sourceTextSha256: "b".repeat(64),
  documentSha256: "a".repeat(64),
};

const secondRecord: FoundationRecord = {
  ...baseRecord,
  recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c41",
  recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51",
  candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b002",
  reviewDecision: "CONFIRMED",
  label: "당화혈색소",
  value: "6.1",
  originalValue: "6.1",
  unit: "%",
  sourceTextSha256: "c".repeat(64),
};

const meta = {
  title: "Integrated/Visit Preparation",
  component: VisitPreparation,
  parameters: { layout: "fullscreen" },
  args: {
    records: [baseRecord, secondRecord],
    loading: false,
    errorMessage: "",
    onPrint: () => {},
  },
} satisfies Meta<typeof VisitPreparation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 확인한기록두개: Story = { name: "확인한 기록 두 개" };

export const 기록없음: Story = {
  name: "기록 없음",
  args: { records: [] },
};
