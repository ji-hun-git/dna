import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EvidenceLens } from "@/components/records/EvidenceLens";

const baseRecord = {
  id: "cholesterol",
  label: "총콜레스테롤",
  value: "188",
  originalValue: "188",
  unit: "mg/dL",
  reference: "120–199 mg/dL",
  sourceName: "예시 건강검진 결과지",
  observedAt: "2026-07-28",
  sourceLocation: "2쪽 · 검사결과 표 · 4행",
  sourceDigest: "sha256:7c91…42a8 · 예시 문서",
  extractedAt: "2026-08-10 09:41",
  confirmedAt: "2026-08-10 09:44",
  automation: {
    layoutModel: "PaddleOCR-VL 1.6",
    semanticModel: "MedGemma 1.5 4B",
    evaluationGate: "출시 전 의료 문서 평가를 통과해야 함",
    executionBoundary: "기기 안에서 오프라인으로 실행할 계획",
    artifactPolicy: "실행 프로그램과 모델의 파일 확인값이 모두 맞을 때만 사용",
    disposition: "자동 결과는 후보만 보여주고 사용자가 확인하기 전에는 저장하지 않음",
  },
};

const meta = {
  title: "Records/Evidence Lens",
  component: EvidenceLens,
  parameters: { layout: "fullscreen" },
  args: { record: baseRecord },
} satisfies Meta<typeof EvidenceLens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 원문과일치: Story = { name: "원문과 일치" };

export const 사용자가수정: Story = {
  name: "사용자가 수정",
  args: { record: { ...baseRecord, value: "190" } },
};

export const 긴한국어출처명: Story = {
  name: "긴 한국어 출처명",
  args: {
    record: {
      ...baseRecord,
      sourceName: "서울특별시 동부권역 건강검진센터 종합검진 결과 통보서",
      sourceDigest: "sha256:88b2e6061d8d150c5f828e0e46f1ea33… · 예시 문서",
    },
  },
};
