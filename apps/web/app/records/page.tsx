import type { Metadata } from "next";
import { IntegratedRecords } from "@/components/integrated/IntegratedRecords";

export const metadata: Metadata = {
  title: "건강 기록",
  description: "예시 건강 기록의 값, 날짜, 출처, 직접 확인 이력을 함께 살펴보는 화면",
};

export default function RecordsPage() {
  return <IntegratedRecords />;
}
