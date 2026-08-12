import type { Metadata } from "next";
import { ResearchEvidenceAgent } from "@/components/research-data/ResearchEvidenceAgent";

export const metadata: Metadata = {
  title: "연구근거 에이전트",
  description: "DataON과 AIDA의 공개 연구자료를 출처, DOI, 이용 조건, 품질 경고와 함께 탐색하는 안전한 시제품입니다.",
};

export default function ResearchDataPage() {
  return <ResearchEvidenceAgent />;
}
