import type {
  FoundationAbstention,
  FoundationCandidate,
  FoundationConsent,
  FoundationRecord,
} from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";

/**
 * The shared map for the integrated screens (a few components keep their own longer sentences) for turning a Spring enum into visible Korean.
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

export const abstentionReasonLabels: Record<FoundationAbstention["reason"], string> = {
  unreadable: "글자 정보를 읽을 수 없음",
  ambiguous_value: "값이 여러 개로 읽힘",
  ambiguous_unit: "단위를 확정할 수 없음",
  missing_evidence: "검사일을 찾지 못함",
  qualified_value: "부등호가 붙은 값이라 숫자로 확정하지 않음",
  qualitative: "음성·양성 같은 판정 결과라 값으로 저장하지 않음",
  previous_column: "이전 결과 칸의 값이라 이번 결과지 값으로 쓰지 않음",
};

export function labelAbstentionReason(reason: Known<FoundationAbstention["reason"]>) {
  return labelled(abstentionReasonLabels, reason);
}

/** The worker reports two different labelled dates as one document-level ambiguous_value abstention. */
export const documentDateConflictLabel = "검사일이 둘 이상이라 확실하지 않음";

export function describeAbstention(abstention: Pick<FoundationAbstention, "label" | "reason">) {
  if (abstention.label === "문서 전체" && abstention.reason === "ambiguous_value") return documentDateConflictLabel;
  return labelAbstentionReason(abstention.reason);
}

type ReviewedRecord = Pick<FoundationRecord, "reviewDecision" | "value" | "originalValue" | "observedOn" | "originalObservedOn">;

function correctedParts(record: ReviewedRecord) {
  return {
    value: record.reviewDecision === "CORRECTED" && record.value !== record.originalValue,
    date: record.reviewDecision === "CORRECTED" && record.observedOn !== record.originalObservedOn,
  };
}

/** Short outcome for the review summary list. */
export function labelReviewOutcome(record: ReviewedRecord) {
  const { value, date } = correctedParts(record);
  if (value && date) return "값과 검사일을 수정함";
  if (date) return "검사일을 수정함";
  if (value || record.reviewDecision === "CORRECTED") return "값을 수정함";
  return "원문과 같음";
}

/** Full sentence for the records screen; the original date is shown so the correction stays inspectable. */
export function describeReviewDecision(record: ReviewedRecord) {
  const { value, date } = correctedParts(record);
  const originalDate = formatKoreanDate(record.originalObservedOn);
  if (value && date) return `사용자가 값과 검사일을 수정함 · 원래 ${originalDate}`;
  if (date) return `사용자가 검사일을 수정함 · 원래 ${originalDate}`;
  if (value || record.reviewDecision === "CORRECTED") return "사용자가 값을 수정함";
  return "사용자가 원문과 같다고 확인함";
}
