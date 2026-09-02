import type { FoundationCandidate, FoundationRecord } from "@/lib/foundation/client";

const documentId = "e64ddaae-a326-4f23-88a9-05ac59a48625";
const documentSha256 = "a".repeat(64);

/** The three ordered candidates a single allowlisted synthetic document yields. */
export const syntheticCandidates: FoundationCandidate[] = [
  {
    candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b001",
    documentId,
    status: "PENDING",
    label: "총콜레스테롤",
    value: "188",
    unit: "mg/dL",
    observedOn: "2026-07-28",
    evidencePage: 1,
    sourceTextSha256: "b".repeat(64),
    documentSha256,
    sourceType: "SYNTHETIC_FIXED_FIXTURE",
    extractionMethod: "DETERMINISTIC_FOUNDATION_FIXTURE",
    createdAt: "2026-07-28T09:00:00Z",
    ordinal: 1,
    totalCandidates: 3,
  },
  {
    candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b002",
    documentId,
    status: "PENDING",
    label: "당화혈색소",
    value: "6.1",
    unit: "%",
    observedOn: "2026-07-28",
    evidencePage: 1,
    sourceTextSha256: "c".repeat(64),
    documentSha256,
    sourceType: "SYNTHETIC_FIXED_FIXTURE",
    extractionMethod: "DETERMINISTIC_FOUNDATION_FIXTURE",
    createdAt: "2026-07-28T09:00:01Z",
    ordinal: 2,
    totalCandidates: 3,
  },
  {
    candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b003",
    documentId,
    status: "PENDING",
    label: "비타민 D",
    value: "31",
    unit: "ng/mL",
    observedOn: "2026-07-28",
    evidencePage: 1,
    sourceTextSha256: "d".repeat(64),
    documentSha256,
    sourceType: "SYNTHETIC_FIXED_FIXTURE",
    extractionMethod: "DETERMINISTIC_FOUNDATION_FIXTURE",
    createdAt: "2026-07-28T09:00:02Z",
    ordinal: 3,
    totalCandidates: 3,
  },
];

export function syntheticRecord(overrides: Partial<FoundationRecord> = {}): FoundationRecord {
  return {
    recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c40",
    recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50",
    candidateId: syntheticCandidates[0].candidateId,
    documentId,
    status: "CURRENT",
    reviewDecision: "CONFIRMED",
    label: "총콜레스테롤",
    value: "188",
    originalValue: "188",
    unit: "mg/dL",
    observedOn: "2026-07-28",
    confirmedAt: "2026-07-28T09:10:00Z",
    evidencePage: 1,
    sourceTextSha256: "b".repeat(64),
    documentSha256,
    ...overrides,
  };
}

export const syntheticDocumentId = documentId;
export const syntheticDocumentSha256 = documentSha256;
