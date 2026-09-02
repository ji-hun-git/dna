import type {
  FoundationCandidate,
  FoundationConsent,
  FoundationRecord,
} from "@/lib/foundation/client";

/**
 * The single source of truth for turning a Spring enum into visible Korean.
 *
 * The server owns the state words; the product never invents a state the server
 * has not reported, and never adds a judgement to one. A value the map does not
 * know is shown exactly as the server sent it rather than silently dropped.
 */

export const candidateStatusLabels: Record<FoundationCandidate["status"], string> = {
  PENDING: "확인 대기",
  CONFIRMED: "확인함",
  EXCLUDED: "제외함",
};

export const consentStatusLabels: Record<FoundationConsent["status"], string> = {
  NOT_GRANTED: "동의 전",
  ACTIVE: "동의함",
  REVOKED: "철회함",
};

export const recordStatusLabels: Record<FoundationRecord["status"], string> = {
  CURRENT: "현재 값",
  SUPERSEDED: "이전 값",
};

export const reviewDecisionLabels: Record<FoundationRecord["reviewDecision"], string> = {
  CONFIRMED: "원문과 같음",
  CORRECTED: "값을 수정함",
};

/** Accepts any string so an unmapped future server value falls through unchanged. */
type Known<T extends string> = T | (string & {});

function labelled(map: Record<string, string>, value: string) {
  return map[value] ?? value;
}

export function labelCandidateStatus(status: Known<FoundationCandidate["status"]>) {
  return labelled(candidateStatusLabels, status);
}

export function labelConsentStatus(status: Known<FoundationConsent["status"]>) {
  return labelled(consentStatusLabels, status);
}

export function labelRecordStatus(status: Known<FoundationRecord["status"]>) {
  return labelled(recordStatusLabels, status);
}

export function labelReviewDecision(decision: Known<FoundationRecord["reviewDecision"]>) {
  return labelled(reviewDecisionLabels, decision);
}
