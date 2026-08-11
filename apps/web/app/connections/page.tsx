import { ConnectionExperience } from "@/components/connections/ConnectionExperience";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 데이터 연결",
  description: "카카오·네이버 로그인과 건강정보 연결 동의를 분리해 안전하게 관리합니다.",
};

export default function ConnectionsPage() {
  return <ConnectionExperience />;
}
