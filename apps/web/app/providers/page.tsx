import type { Metadata } from "next";
import { PublicProviderExplorer } from "@/components/providers/PublicProviderExplorer";

export const metadata: Metadata = {
  title: "공공 의료정보 예시",
  description: "실제 API 연결 전, 예시 데이터로 의료기관과 비급여 정보 화면을 확인합니다.",
};

export default function ProvidersPage() {
  return <PublicProviderExplorer />;
}
