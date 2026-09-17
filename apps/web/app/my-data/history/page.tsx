import type { Metadata } from "next";
import { MeasurementHistory } from "@/components/my-data/history/MeasurementHistory";

export const metadata: Metadata = {
  title: "측정 이력",
  description: "같은 항목의 확인한 값을 검사일 순서로 모아 표와 그래프로 보는 화면",
};

export default function MeasurementHistoryPage() {
  return <MeasurementHistory />;
}
