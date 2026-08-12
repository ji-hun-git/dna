import type { Metadata } from "next";
import { DataControlCenter } from "@/components/privacy/DataControlCenter";

export const metadata: Metadata = {
  title: "내 데이터 제어",
  description: "목적별 동의, 원본 보관, 철회와 변경 이력을 직접 확인합니다.",
};

export default function DataControlPage() {
  return <DataControlCenter />;
}
