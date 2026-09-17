import type { FoundationCandidate, FoundationRecord, HealthEvent, SeriesResponse } from "@/lib/foundation/client";

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
    sourceType: "DOCUMENT_TEXT_LAYER",
    extractionMethod: "native-text",
    conceptCode: "total-cholesterol",
    evidenceBox: { x: 0.08, y: 0.1, width: 0.3, height: 0.02 },
    createdAt: "2026-07-28T09:00:00Z",
    ordinal: 1,
    totalCandidates: 3,
  },
  {
    candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b002",
    documentId,
    status: "PENDING",
    label: "당화혈색소",
    value: "5.2",
    unit: "%",
    observedOn: "2026-07-28",
    evidencePage: 1,
    sourceTextSha256: "c".repeat(64),
    documentSha256,
    sourceType: "DOCUMENT_TEXT_LAYER",
    extractionMethod: "native-text",
    conceptCode: "hba1c",
    evidenceBox: { x: 0.08, y: 0.14, width: 0.2, height: 0.02 },
    createdAt: "2026-07-28T09:00:01Z",
    ordinal: 2,
    totalCandidates: 3,
  },
  {
    candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b003",
    documentId,
    status: "PENDING",
    label: "비타민 D",
    value: "42",
    unit: "ng/mL",
    observedOn: "2026-07-28",
    evidencePage: 1,
    sourceTextSha256: "d".repeat(64),
    documentSha256,
    sourceType: "DOCUMENT_TEXT_LAYER",
    extractionMethod: "native-text",
    conceptCode: "vitamin-d",
    evidenceBox: { x: 0.08, y: 0.18, width: 0.25, height: 0.02 },
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
    originalObservedOn: "2026-07-28",
    confirmedAt: "2026-07-28T09:10:00Z",
    evidencePage: 1,
    sourceTextSha256: "b".repeat(64),
    documentSha256,
    conceptCode: "total-cholesterol",
    ...overrides,
  };
}

export const syntheticDocumentId = documentId;
export const syntheticDocumentSha256 = documentSha256;

export function syntheticHealthEvent(overrides: Partial<HealthEvent> = {}): HealthEvent {
  return {
    eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50",
    recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c40",
    domain: "lab",
    concept: "총콜레스테롤",
    conceptCode: "total-cholesterol",
    value: "188",
    unit: "mg/dL",
    observedOn: "2026-07-28",
    verification: "verified",
    corrected: false,
    confirmedAt: "2026-07-28T09:10:00Z",
    originalValue: "188",
    source: {
      documentId,
      page: 1,
      documentSha256,
      sourceTextSha256: "b".repeat(64),
      previewAvailable: true,
    },
    ...overrides,
  };
}

const januaryDocumentId = "f75eebbf-b437-4034-99ba-16bd6ab59736";

/**
 * What GET /api/foundation/series returns after the e2e lifecycle: July uploaded first
 * (총콜레스테롤 corrected to 190, 당화혈색소 re-dated to 07-27, 비타민 D excluded), January second.
 * Null members are omitted exactly as the server omits them (Jackson non_null).
 */
export function syntheticSeries(): SeriesResponse {
  return {
    series: [
      {
        conceptCode: "hba1c",
        concept: "당화혈색소",
        unit: "%",
        points: [
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d61", value: "5.4", observedOn: "2026-01-15", documentId: januaryDocumentId },
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d62", value: "5.2", observedOn: "2026-07-27", documentId },
        ],
        derived: { lastDifference: { absolute: "-0.2" }, per30Days: "-0.03" },
      },
      {
        conceptCode: "vitamin-d",
        concept: "비타민 D",
        unit: "ng/mL",
        points: [
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d63", value: "45", observedOn: "2026-01-15", documentId: januaryDocumentId },
        ],
        derived: {},
      },
      {
        conceptCode: "total-cholesterol",
        concept: "총콜레스테롤",
        unit: "mg/dL",
        points: [
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d64", value: "194", observedOn: "2026-01-15", documentId: januaryDocumentId },
          { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d65", value: "190", observedOn: "2026-07-28", documentId },
        ],
        derived: { lastDifference: { absolute: "-4", percent: "-2.1" }, per30Days: "-0.6" },
      },
    ],
  };
}
