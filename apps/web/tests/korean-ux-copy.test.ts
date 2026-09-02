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
  "components/integrated/RecordComparison.tsx",
  "components/integrated/PrepareConceptNotice.tsx",
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

// The server enums must never reach the screen unlabelled. Each entry is the
// exact JSX a component would use to print the raw word: CORRECTED, REVOKED and
// NOT_GRANTED are server states, not Korean copy.
const rawServerEnumRenders = [
  "{candidate.status}",
  '{consent?.status ?? "NOT_GRANTED"}',
  "{record.status}",
  "{record.reviewDecision}",
  "{latest.status}",
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
    expect(source("components/integrated/VisitPreparation.tsx")).toContain(
      "이 값은 서버가 미리 정한 예시 값이에요. 실제 파일이나 기관에서 가져오지 않았어요.",
    );
  });

  it("labels every server enum in Korean instead of rendering it raw", () => {
    const integratedFiles = userFacingFiles.filter((path) => path.startsWith("components/integrated/"));
    expect(integratedFiles.length).toBeGreaterThan(0);
    for (const path of integratedFiles) {
      const content = source(path);
      for (const raw of rawServerEnumRenders) {
        expect(content, `${path} renders ${raw} without a Korean label`).not.toContain(raw);
      }
    }
  });

  it("states the comparison limit in the words the reader sees", () => {
    expect(source("components/integrated/RecordComparison.tsx")).toContain(
      "같은 항목의 두 날짜 값을 그대로 나란히 둔 목록이에요. 변화의 의미는 판단하지 않아요.",
    );
    expect(source("components/integrated/RecordComparison.tsx")).toContain(
      "두 날짜 이상 확인한 항목이 아직 없어요.",
    );
  });

  it("keeps the server status word out of visible copy unless it is labelled as a code", () => {
    const content = source("components/integrated/IntegratedHealthExperience.tsx");
    expect(content).toContain('<code aria-label="서버 상태 코드">{documentReceipt.status}</code>');
    expect(content).toContain("{processingCopy[documentReceipt.status]} ");
  });

  it("shows Korean dates without exposing ISO punctuation in visible copy", () => {
    expect(formatKoreanDate("2026-07-28")).toBe("2026. 7. 28.");
    expect(formatKoreanDateTime("2026-08-10 09:44")).toBe("2026. 8. 10. 09:44");
  });
});
