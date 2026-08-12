import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecordImportConcept } from "@/components/concept/RecordImportConcept";

const syntheticImport = {
  sourceName: "예시 건강검진 결과지",
  observedAt: "2026-07-28",
  currentItem: 4,
  totalItems: 12,
  candidate: {
    label: "당화혈색소",
    value: "6.1",
    unit: "%",
    reference: "4.0–5.6 %",
  },
};

const documentReceipt = {
  format: "PDF" as const,
  byteLength: 248_320,
  sizeLabel: "243 KB",
  sha256: `sha256:${"5d9fbc80d047f8a25538970b".padEnd(64, "7")}` as const,
  processingBoundary: "local-synthetic-fixture" as const,
};

const meta = {
  title: "Concept/Record Import",
  component: RecordImportConcept,
  parameters: { layout: "fullscreen" },
  args: { ...syntheticImport, stage: "source" },
} satisfies Meta<typeof RecordImportConcept>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ChooseSource: Story = { name: "결과지 선택" };

export const LocalProcessingReceipt: Story = {
  name: "로컬 처리 영수증",
  args: { stage: "processing", documentReceipt },
};

export const ReviewOneItem: Story = {
  name: "항목 하나씩 확인",
  args: { stage: "review" },
};

export const ReadyToSave: Story = {
  name: "기록 준비 완료",
  args: { stage: "complete" },
};

export const TwoHundredPercentText: Story = {
  name: "200% 텍스트",
  args: { stage: "review" },
  decorators: [(Story) => <div style={{ fontSize: "200%" }}><Story /></div>],
};
