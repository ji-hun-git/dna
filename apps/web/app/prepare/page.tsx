import type { Metadata } from "next";
import { IntegratedVisitPreparation } from "@/components/integrated/VisitPreparation";

export const metadata: Metadata = {
  title: "진료 준비",
  description: "직접 확인한 기록 옆에 다음 진료에서 물어볼 질문을 함께 두는 화면",
};

export default function PreparePage() {
  return <IntegratedVisitPreparation />;
}
