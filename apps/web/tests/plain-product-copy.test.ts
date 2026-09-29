import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("keeps slogans and internal processing jargon out of the live record workflow", () => {
  const paths = [
    "components/home/RecordWorkspace.tsx",
    "components/integrated/IntegratedShell.tsx",
    "components/integrated/IntegratedHealthExperience.tsx",
    "components/integrated/IntegratedDataControl.tsx",
    "components/integrated/CandidateReview.tsx",
    "components/integrated/VisitPreparation.tsx",
  ];
  const retired = ["나를 알아가는 기록", "한 장씩 모으고", "첫 결과지부터 차근차근", "궁금했던 것,", "신뢰 경계", "적대적 문서 격리 구역", "승인된 바이트", "합성 후보", "기록으로 만든 고정 질문", "삭제 요청 검토"];
  for (const path of paths) {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    for (const phrase of retired) expect(source, `${path}: ${phrase}`).not.toContain(phrase);
  }
});
