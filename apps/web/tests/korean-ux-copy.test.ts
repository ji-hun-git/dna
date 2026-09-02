import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/format/korean-date";

const userFacingFiles = [
  "components/concept/HealthHomeConcept.tsx",
  "components/integrated/CandidateReview.tsx",
  "components/integrated/IntegratedDataControl.tsx",
  "components/integrated/IntegratedHealthExperience.tsx",
  "components/integrated/IntegratedRecords.tsx",
  "components/integrated/IntegratedShell.tsx",
  "components/integrated/VisitPreparation.tsx",
  "components/concept/RecordImportConcept.tsx",
  "components/connections/ConnectionExperience.tsx",
  "components/experience/HealthExperience.tsx",
  "components/privacy/DataControlCenter.tsx",
  "components/providers/PublicProviderExplorer.tsx",
  "components/records/EvidenceLens.tsx",
  "components/records/HealthTimeline.tsx",
] as const;

const forbiddenUserTerms = [
  "합성 시연",
  "합성 데모",
  "fixture",
  "PHI",
  "SYNTHETIC",
  "LIVE API",
  "ACTIVE PURPOSES",
  "HEALTH PROVIDERS",
  "SOURCE RETENTION",
  "PURPOSE BOUNDARIES",
  "Object Lock",
  "LOCAL AUDIT",
  "ACCOUNT DATA",
  "PRODUCTION READINESS",
  "ANTI-HACK",
  "EVIDENCE LENS",
  "VERIFIED RECORD",
  "SOURCE LEDGER",
  "NEXT CONNECTION",
  "합성 주소",
  "합성 항목",
  "합성 공개금액",
  "오케스트레이션",
  "삼성 건강검진",
  "강남세브란스",
] as const;

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Korean UX language boundary", () => {
  it.each(userFacingFiles)("keeps internal jargon and real institution names out of %s", (path) => {
    const content = source(path);
    for (const forbidden of forbiddenUserTerms) {
      expect(content, `${path} exposes ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("states the example, connection, and medical limits in direct Korean", () => {
    expect(source("components/concept/RecordImportConcept.tsx")).toContain(
      "선택한 파일에서 읽은 값은 아니에요",
    );
    expect(source("components/connections/ConnectionExperience.tsx")).toContain(
      "실제 계정이나 건강정보와 연결되지 않은 예시 화면이에요",
    );
    expect(source("components/records/EvidenceLens.tsx")).toContain(
      "아직 이 예시 기록을 만드는 데 사용하지 않았어요",
    );
    expect(source("components/concept/HealthHomeConcept.tsx")).toContain(
      "질환을 진단하거나 정상·비정상을 판단할 수 없어요",
    );
    expect(source("components/records/HealthTimeline.tsx")).toContain(
      "실제 파일이나 기관 API에서 가져온 기록이 아니에요",
    );
    expect(source("components/integrated/VisitPreparation.tsx")).toContain(
      "이 목록은 질문을 준비하기 위한 것이에요. 값의 의미나 건강 상태를 판단하지 않아요.",
    );
  });

  it("shows Korean dates without exposing ISO punctuation in visible copy", () => {
    expect(formatKoreanDate("2026-07-28")).toBe("2026. 7. 28.");
    expect(formatKoreanDateTime("2026-08-10 09:44")).toBe("2026. 8. 10. 09:44");
  });
});
