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
  "components/integrated/RecentChanges.tsx",
  "components/integrated/PrepareConceptNotice.tsx",
  "components/integrated/VisitPreparation.tsx",
  "components/integrated/SourcePreview.tsx",
  "lib/records/visit-questions.ts",
  "components/concept/RecordImportConcept.tsx",
  "components/connections/ConnectionExperience.tsx",
  "components/experience/HealthExperience.tsx",
  "components/privacy/DataControlCenter.tsx",
  "components/providers/PublicProviderExplorer.tsx",
  "components/records/EvidenceLens.tsx",
  "components/records/HealthTimeline.tsx",
  "components/my-data/LivingCellCanvas.tsx",
  "components/my-data/CellTooltip.tsx",
  "components/my-data/EvidenceDrawer.tsx",
  "components/my-data/MyData.tsx",
  "components/my-data/HealthEventTable.tsx",
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
  // Direction words: the product states two values and their arithmetic difference, never a trend.
  "상승",
  "하락",
  "증가",
  "감소",
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
      "이 값은 예시 결과지의 글자 정보에서 읽어 직접 확인한 값이에요. 실제 기관에서 가져오지 않았어요.",
    );
    expect(source("components/my-data/MyData.tsx")).toContain("값의 의미나 변화의 방향은 판단하지 않아요.");
  });

  it("tells the reviewer the candidate came from the text layer, not from image recognition, and never from a fixture", () => {
    const review = source("components/integrated/CandidateReview.tsx");
    expect(review).toContain("결과지의 글자 정보에서 읽은 값이에요. 이미지를 판독한 결과가 아니며, 확인하기 전까지 기록이 아니에요.");
    expect(review).toContain("결과지 텍스트에서 읽은 값 · 문자 인식 아님");
    expect(review).not.toContain("서버가 미리 정한 예시 값");
    const experience = source("components/integrated/IntegratedHealthExperience.tsx");
    expect(experience).toContain("이 결과지에서 읽을 수 있는 항목이 없었어요");
    expect(experience).toContain("글자 정보가 없는 파일(사진·스캔)은 아직 읽지 못해요.");
    expect(experience).toContain("읽은 글자는 있지만 항목·값·단위를 확실히 맞출 수 없었어요. 아래 사유를 확인해 주세요.");
    expect(experience).not.toContain("{item.reason}");
    for (const path of userFacingFiles) expect(source(path), `${path} still calls the value a fixture`).not.toContain("서버가 미리 정한 예시 값");
    for (const path of userFacingFiles) expect(source(path), `${path} still contains retired preset-example copy`).not.toContain("미리 정한");
  });

  it("describes a document whose labelled dates disagree without a raw reason code", () => {
    expect(source("lib/format/status-labels.ts")).toContain("검사일이 둘 이상이라 확실하지 않음");
    expect(source("components/integrated/IntegratedHealthExperience.tsx")).toContain("describeAbstention(item)");
    expect(source("components/integrated/IntegratedHealthExperience.tsx")).not.toContain("labelAbstentionReason(item.reason)");
  });

  it("describes the recent changes as two values without a judgement", () => {
    const recent = source("components/integrated/RecentChanges.tsx");
    expect(recent).toContain("최근 변화");
    expect(recent).toContain("새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요.");
    expect(recent).not.toContain("→");
    expect(recent).toContain("두 값의 차이:");
    expect(recent).not.toMatch(/[↑↓▲▼]/);
    expect(recent).not.toContain("color");
    expect(source("components/integrated/IntegratedHealthExperience.tsx")).toContain("<RecentChanges changes={changes} />");
  });

  it("labels every server enum in Korean instead of rendering it raw", () => {
    const integratedFiles = userFacingFiles.filter(
      (path) => path.startsWith("components/integrated/") || path.startsWith("components/my-data/"),
    );
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
    // The server sends confirmation instants as ISO 8601 with fractional seconds
    // and a zone. They must land on screen as Korean local time, never raw.
    expect(formatKoreanDateTime("2026-09-16T06:52:59.605506Z")).toBe("2026. 9. 16. 15:52");
    expect(formatKoreanDateTime("2026-09-16T06:52:59+00:00")).toBe("2026. 9. 16. 15:52");
  });

  it("asks for the exam date correction without judging the value", () => {
    const review = source("components/integrated/CandidateReview.tsx");
    expect(review).toContain("검사일 수정");
    expect(review).toContain("결과지에 적힌 검사일과 다르면 고쳐 주세요. 값의 의미는 판단하지 않아요.");
    expect(source("lib/format/status-labels.ts")).toContain("사용자가 검사일을 수정함 · 원래 ");
    expect(source("components/integrated/IntegratedRecords.tsx")).toContain("describeReviewDecision(record)");
  });

  it("states that research consent is optional, stored only, and asked again per project", () => {
    const control = source("components/integrated/IntegratedDataControl.tsx");
    for (const sentence of [
      "연구 동의 없이도 모든 기능을 쓸 수 있어요.",
      "실제 활용 전에는 프로젝트별 동의를 다시 물어요.",
      "가명처리 후 연구에 쓰는 것에 대한 선택. 지금은 진행 중인 연구가 없어요.",
      "적합한 연구가 있을 때 참여 제안을 받을지. 지금은 연락 채널이 없어요.",
      "프로젝트가 생기면 여기서 개별로 물어요.",
    ]) {
      expect(control, `data control lacks: ${sentence}`).toContain(sentence);
    }
    expect(control).not.toContain("{consent.status}");
    expect(control).not.toContain("{status}</strong>");
  });

  it("explains the export as a browser download with no server copy", () => {
    const control = source("components/integrated/IntegratedDataControl.tsx");
    expect(control).toContain('href="/api/foundation/health-events/export"');
    expect(control).toContain("내 기록 내보내기(JSON)");
    expect(control).toContain("브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요.");
    expect(control).toContain("내보낼 기록이 없어요");
    expect(control).not.toContain("/api/export");
  });
});
