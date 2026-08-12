import type { Metadata } from "next";
import { PublicProviderExplorer } from "@/components/providers/PublicProviderExplorer";

export const metadata: Metadata = {
  title: "공공 의료정보 탐색 시연",
  description: "실제 API 연결 전, 합성 데이터로 검증하는 출처 우선 의료기관·비급여 정보 탐색 화면",
};

export default function ProvidersPage() {
  return <PublicProviderExplorer />;
}
