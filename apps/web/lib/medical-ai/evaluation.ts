import { z } from "zod";
import {
  extractionAbstentionSchema,
  medicalDocumentCorpusSchema,
  medicalDocumentRunSchema,
  type MedicalDocumentCorpus,
  type MedicalDocumentRun,
} from "./contracts.ts";

export type MedicalDocumentGateThresholds = {
  fieldF1: number;
  criticalValueExactRate: number;
  evidenceLocalizationRate: number;
  hallucinationRate: number;
  requiredAbstentionRecall: number;
  referenceRangeAccuracy: number;
  conceptAccuracy: number;
};

export const candidateAdmissionThresholds: MedicalDocumentGateThresholds = {
  fieldF1: 1,
  criticalValueExactRate: 1,
  evidenceLocalizationRate: 1,
  hallucinationRate: 0,
  requiredAbstentionRecall: 1,
  referenceRangeAccuracy: 1,
  conceptAccuracy: 1,
};

export type MedicalDocumentSyntheticContractRegression = {
  schemaVersion: "medical-document-synthetic-contract-regression.v1";
  evidenceLevel: "synthetic-contract-regression-only";
  productionAccuracyClaim: false;
  corpusId: string;
  pipelineId: string;
  metrics: {
    documentCount: number;
    expectedMeasurementCount: number;
    returnedMeasurementCount: number;
    exactMeasurementCount: number;
    hallucinatedMeasurementCount: number;
    fieldPrecision: number;
    fieldRecall: number;
    fieldF1: number;
    criticalValueExactRate: number;
    evidenceLocalizationRate: number;
    requiredAbstentionRecall: number;
    hallucinationRate: number;
    referenceRangeAccuracy: number;
    conceptAccuracy: number;
  };
  gate: {
    passed: boolean;
    failures: string[];
    thresholds: MedicalDocumentGateThresholds;
  };
};

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 1 : numerator / denominator;
}

function intersectionOverUnion(
  expected: { x: number; y: number; width: number; height: number },
  actual: { x: number; y: number; width: number; height: number },
) {
  const left = Math.max(expected.x, actual.x);
  const top = Math.max(expected.y, actual.y);
  const right = Math.min(expected.x + expected.width, actual.x + actual.width);
  const bottom = Math.min(expected.y + expected.height, actual.y + actual.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = expected.width * expected.height + actual.width * actual.height - intersection;
  return union === 0 ? 0 : intersection / union;
}

function exactField(expected: MedicalDocumentCorpus["documents"][number]["expectedMeasurements"][number], actual: MedicalDocumentRun["candidates"][number]) {
  return expected.label === actual.label
    && expected.value === actual.value
    && expected.unit === actual.unit
    && expected.observedAt === actual.observedAt
    && (expected.referenceRange ?? "") === (actual.referenceRange ?? "");
}

function criticalValueExact(expected: MedicalDocumentCorpus["documents"][number]["expectedMeasurements"][number], actual: MedicalDocumentRun["candidates"][number]) {
  return expected.value === actual.value
    && expected.unit === actual.unit
    && expected.observedAt === actual.observedAt;
}

export function evaluateMedicalDocumentPipeline(
  corpusInput: unknown,
  runsInput: readonly unknown[],
  thresholds = candidateAdmissionThresholds,
): MedicalDocumentSyntheticContractRegression {
  const corpus = medicalDocumentCorpusSchema.parse(corpusInput);
  const runs = runsInput.map((run) => medicalDocumentRunSchema.parse(run));
  const pipelineIds = new Set(runs.map((run) => run.pipelineId));
  if (pipelineIds.size !== 1) throw new Error("one evaluation may contain exactly one pipeline ID");
  const pipelineId = runs[0]?.pipelineId;
  if (!pipelineId) throw new Error("at least one pipeline run is required");

  const runByDocument = new Map(runs.map((run) => [run.documentId, run]));
  if (runByDocument.size !== runs.length) throw new Error("each document may have exactly one run");
  if (runs.some((run) => !corpus.documents.some((document) => document.documentId === run.documentId))) {
    throw new Error("runs for documents outside the corpus are forbidden");
  }

  let expectedMeasurementCount = 0;
  let returnedMeasurementCount = 0;
  let exactMeasurementCount = 0;
  let criticalValueExactCount = 0;
  let localizedEvidenceCount = 0;
  let hallucinatedMeasurementCount = 0;
  let requiredAbstentionCount = 0;
  let correctAbstentionCount = 0;
  let matchedMeasurementCount = 0;
  let referenceRangeMatchCount = 0;
  let conceptExpectedCount = 0;
  let conceptMatchCount = 0;

  for (const document of corpus.documents) {
    const run = runByDocument.get(document.documentId);
    if (!run) throw new Error(`missing run for ${document.documentId}`);
    if (run.documentSha256 !== document.documentSha256 || run.documentType !== document.documentType || run.language !== document.language) {
      throw new Error(`document binding mismatch for ${document.documentId}`);
    }

    expectedMeasurementCount += document.expectedMeasurements.length;
    returnedMeasurementCount += run.candidates.length;
    requiredAbstentionCount += document.requiredAbstentions.length;

    const expectedById = new Map(document.expectedMeasurements.map((field) => [field.fieldId, field]));
    for (const candidate of run.candidates) {
      const expected = expectedById.get(candidate.fieldId);
      if (!expected) {
        hallucinatedMeasurementCount += 1;
        continue;
      }
      matchedMeasurementCount += 1;
      if ((expected.expectedReferenceRangeText ?? null) === (candidate.referenceRangeText ?? null)) referenceRangeMatchCount += 1;
      if (expected.expectedNoConcept || expected.expectedConceptCode !== undefined) {
        conceptExpectedCount += 1;
        const wanted = expected.expectedNoConcept ? null : expected.expectedConceptCode ?? null;
        if ((candidate.conceptCode ?? null) === wanted) conceptMatchCount += 1;
      }
      if (exactField(expected, candidate)) exactMeasurementCount += 1;
      if (criticalValueExact(expected, candidate)) criticalValueExactCount += 1;
      if (
        expected.evidence.page === candidate.evidence.page
        && expected.evidence.blockId === candidate.evidence.blockId
        && expected.evidence.sourceTextSha256 === candidate.evidence.sourceTextSha256
        && intersectionOverUnion(expected.evidence.box, candidate.evidence.box) >= 0.8
      ) localizedEvidenceCount += 1;
    }

    for (const expectedAbstention of document.requiredAbstentions) {
      const actual = run.abstentions.find((item) => item.fieldId === expectedAbstention.fieldId);
      if (actual && expectedAbstention.acceptedReasons.includes(actual.reason)) correctAbstentionCount += 1;
    }
  }

  const fieldPrecision = ratio(exactMeasurementCount, returnedMeasurementCount);
  const fieldRecall = ratio(exactMeasurementCount, expectedMeasurementCount);
  const fieldF1 = fieldPrecision + fieldRecall === 0 ? 0 : (2 * fieldPrecision * fieldRecall) / (fieldPrecision + fieldRecall);
  const criticalValueExactRate = ratio(criticalValueExactCount, expectedMeasurementCount);
  const evidenceLocalizationRate = ratio(localizedEvidenceCount, expectedMeasurementCount);
  const requiredAbstentionRecall = ratio(correctAbstentionCount, requiredAbstentionCount);
  const hallucinationRate = returnedMeasurementCount === 0 ? 0 : hallucinatedMeasurementCount / returnedMeasurementCount;
  const referenceRangeAccuracy = ratio(referenceRangeMatchCount, matchedMeasurementCount);
  const conceptAccuracy = ratio(conceptMatchCount, conceptExpectedCount);
  const failures: string[] = [];

  if (fieldF1 < thresholds.fieldF1) failures.push("field_f1_below_threshold");
  if (criticalValueExactRate < thresholds.criticalValueExactRate) failures.push("critical_value_exact_rate_below_threshold");
  if (evidenceLocalizationRate < thresholds.evidenceLocalizationRate) failures.push("evidence_localization_rate_below_threshold");
  if (requiredAbstentionRecall < thresholds.requiredAbstentionRecall) failures.push("required_abstention_recall_below_threshold");
  if (hallucinationRate > thresholds.hallucinationRate) failures.push("hallucination_rate_above_threshold");
  if (referenceRangeAccuracy < thresholds.referenceRangeAccuracy) failures.push("reference_range_accuracy_below_threshold");
  if (conceptAccuracy < thresholds.conceptAccuracy) failures.push("concept_accuracy_below_threshold");

  return {
    schemaVersion: "medical-document-synthetic-contract-regression.v1",
    evidenceLevel: "synthetic-contract-regression-only",
    productionAccuracyClaim: false,
    corpusId: corpus.corpusId,
    pipelineId,
    metrics: {
      documentCount: corpus.documents.length,
      expectedMeasurementCount,
      returnedMeasurementCount,
      exactMeasurementCount,
      hallucinatedMeasurementCount,
      fieldPrecision,
      fieldRecall,
      fieldF1,
      criticalValueExactRate,
      evidenceLocalizationRate,
      requiredAbstentionRecall,
      hallucinationRate,
      referenceRangeAccuracy,
      conceptAccuracy,
    },
    gate: { passed: failures.length === 0, failures, thresholds },
  };
}

export const handLabelledExpectationSchema = z.strictObject({
  schemaVersion: z.literal("hand-labelled-expectation.v1"),
  documentId: z.string().regex(/^synthetic-hand-[a-z0-9-]+$/),
  layout: z.string().min(1).max(240),
  observedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  candidates: z.array(z.strictObject({
    label: z.string().min(1).max(80),
    value: z.string().min(1).max(64),
    unit: z.string().min(1).max(32),
    conceptCode: z.string().regex(/^[a-z0-9-]{1,64}$/).nullable().optional(),
  })).max(100),
  abstentions: z.array(z.strictObject({ label: z.string().min(1).max(80), reason: extractionAbstentionSchema.shape.reason })).max(100),
});

export const handLabelledCorpusSchema = z.strictObject({
  corpusId: z.string().regex(/^synthetic-ko-hand-labelled-[0-9a-f]{16}$/),
  documents: z.array(z.strictObject({
    documentId: z.string(),
    documentSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    expected: handLabelledExpectationSchema,
  })).min(1),
});

export type HandLabelledReport = {
  schemaVersion: "hand-labelled-report.v1";
  corpusId: string;
  expectedCandidates: number;
  matchedCandidates: number;
  expectedAbstentions: number;
  matchedAbstentions: number;
  hallucinatedCandidates: number;
  candidateAccuracy: number;
  abstentionAccuracy: number;
  handLabelledAccuracy: number;
  floor: number;
  passed: boolean;
};

/**
 * Regression floor: the measured value, from docs/status/2026-09-18/wave7.md
 * (corpusId synthetic-ko-hand-labelled-4b20bf06922a7e0a, re-measured 2026-09-18 after Task 13
 * review fix 1 completed the nhis-notice gold set with the three previously-missing
 * `previous_column` abstentions for 신장, 체중 and 혈압). Never rounded up — a future improvement
 * in the parser can raise this constant, a regression must not silently pass.
 */
export const handLabelledFloor = 0.8695652173913043;

export function evaluateHandLabelled(corpusInput: unknown, runsInput: readonly unknown[], floor = handLabelledFloor): HandLabelledReport {
  const corpus = handLabelledCorpusSchema.parse(corpusInput);
  const runs = runsInput.map((run) => medicalDocumentRunSchema.parse(run));
  let expectedCandidates = 0;
  let matchedCandidates = 0;
  let expectedAbstentions = 0;
  let matchedAbstentions = 0;
  let hallucinated = 0;
  for (const document of corpus.documents) {
    const run = runs.find((candidate) => candidate.documentId === document.documentId);
    if (!run) throw new Error(`missing run for ${document.documentId}`);
    if (run.documentSha256 !== document.documentSha256) throw new Error(`document binding mismatch for ${document.documentId}`);
    const expected = document.expected;
    expectedCandidates += expected.candidates.length;
    expectedAbstentions += expected.abstentions.length;
    for (const candidate of expected.candidates) {
      const hit = run.candidates.find((actual) => actual.label === candidate.label && actual.value === candidate.value && actual.unit === candidate.unit
        && (expected.observedOn === null || actual.observedAt === expected.observedOn)
        && (candidate.conceptCode === undefined || (actual.conceptCode ?? null) === candidate.conceptCode));
      if (hit) matchedCandidates += 1;
    }
    for (const actual of run.candidates) {
      if (!expected.candidates.some((candidate) => candidate.label === actual.label && candidate.value === actual.value && candidate.unit === actual.unit)) hallucinated += 1;
    }
    for (const abstention of expected.abstentions) {
      if (run.abstentions.some((actual) => actual.label === abstention.label && actual.reason === abstention.reason)) matchedAbstentions += 1;
    }
  }
  const candidateAccuracy = ratio(matchedCandidates, expectedCandidates);
  const abstentionAccuracy = ratio(matchedAbstentions, expectedAbstentions);
  const handLabelledAccuracy = ratio(matchedCandidates + matchedAbstentions, expectedCandidates + expectedAbstentions);
  return {
    schemaVersion: "hand-labelled-report.v1",
    corpusId: corpus.corpusId,
    expectedCandidates,
    matchedCandidates,
    expectedAbstentions,
    matchedAbstentions,
    hallucinatedCandidates: hallucinated,
    candidateAccuracy,
    abstentionAccuracy,
    handLabelledAccuracy,
    floor,
    passed: handLabelledAccuracy >= floor && hallucinated === 0,
  };
}

export function compareMedicalDocumentPipelines(
  corpusInput: unknown,
  pipelineRuns: readonly { label: string; runs: readonly unknown[] }[],
) {
  return pipelineRuns
    .map(({ label, runs }) => ({ label, report: evaluateMedicalDocumentPipeline(corpusInput, runs) }))
    .sort((a, b) => Number(b.report.gate.passed) - Number(a.report.gate.passed)
      || b.report.metrics.fieldF1 - a.report.metrics.fieldF1
      || a.report.metrics.hallucinationRate - b.report.metrics.hallucinationRate);
}
