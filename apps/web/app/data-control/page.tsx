import type { Metadata } from "next";
import { DataControlCenter } from "@/components/privacy/DataControlCenter";

export const metadata: Metadata = {
  title: "데이터 관리",
  description: "목적별 동의와 원본 보관 설정, 변경 내역을 확인하는 예시 화면",
};

export default function DataControlPage() {
  return <DataControlCenter />;
}
