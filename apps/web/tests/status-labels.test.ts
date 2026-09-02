import { describe, expect, it } from "vitest";
import {
  candidateStatusLabels,
  consentStatusLabels,
  labelCandidateStatus,
  labelConsentStatus,
  labelRecordStatus,
  labelReviewDecision,
  recordStatusLabels,
  reviewDecisionLabels,
} from "@/lib/format/status-labels";

describe("server enum to Korean label map", () => {
  it("labels every candidate status the server can send", () => {
    expect(candidateStatusLabels).toEqual({
      PENDING: "확인 대기",
      CONFIRMED: "확인함",
      EXCLUDED: "제외함",
    });
    expect(labelCandidateStatus("PENDING")).toBe("확인 대기");
    expect(labelCandidateStatus("CONFIRMED")).toBe("확인함");
    expect(labelCandidateStatus("EXCLUDED")).toBe("제외함");
  });

  it("labels every consent status the server can send", () => {
    expect(consentStatusLabels).toEqual({
      NOT_GRANTED: "동의 전",
      ACTIVE: "동의함",
      REVOKED: "철회함",
    });
    expect(labelConsentStatus("NOT_GRANTED")).toBe("동의 전");
    expect(labelConsentStatus("ACTIVE")).toBe("동의함");
    expect(labelConsentStatus("REVOKED")).toBe("철회함");
  });

  it("labels every record status the server can send", () => {
    expect(recordStatusLabels).toEqual({ CURRENT: "현재 값", SUPERSEDED: "이전 값" });
    expect(labelRecordStatus("CURRENT")).toBe("현재 값");
    expect(labelRecordStatus("SUPERSEDED")).toBe("이전 값");
  });

  it("labels every review decision the server can send", () => {
    expect(reviewDecisionLabels).toEqual({ CONFIRMED: "원문과 같음", CORRECTED: "값을 수정함" });
    expect(labelReviewDecision("CONFIRMED")).toBe("원문과 같음");
    expect(labelReviewDecision("CORRECTED")).toBe("값을 수정함");
  });

  it("falls back to the raw server value when the map does not know it", () => {
    expect(labelCandidateStatus("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(labelConsentStatus("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(labelRecordStatus("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(labelReviewDecision("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });

  it("never renders a label that judges the value", () => {
    const judgements = ["정상", "비정상", "높음", "낮음", "위험", "주의", "권장"];
    const labels = [
      ...Object.values(candidateStatusLabels),
      ...Object.values(consentStatusLabels),
      ...Object.values(recordStatusLabels),
      ...Object.values(reviewDecisionLabels),
    ];
    for (const label of labels) {
      for (const judgement of judgements) {
        expect(label, `${label} judges the value`).not.toContain(judgement);
      }
      expect(label).not.toMatch(/[A-Za-z_]/);
    }
  });
});
