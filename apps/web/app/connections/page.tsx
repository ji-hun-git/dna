import { ConnectionExperience } from "@/components/connections/ConnectionExperience";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "데이터 연결",
  description: "로그인과 건강정보 연결 동의를 나눠서 확인하는 예시 화면",
};

export default function ConnectionsPage() {
  return <ConnectionExperience />;
}
