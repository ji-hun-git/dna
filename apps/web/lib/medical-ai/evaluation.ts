import {
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
};

export const candidateAdmissionThresholds: MedicalDocumentGateThresholds = {
  fieldF1: 1,
  criticalValueExactRate: 1,
  evidenceLocalizationRate: 1,
  hallucinationRate: 0,
  requiredAbstentionRecall: 1,
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
  const failures: string[] = [];

  if (fieldF1 < thresholds.fieldF1) failures.push("field_f1_below_threshold");
  if (criticalValueExactRate < thresholds.criticalValueExactRate) failures.push("critical_value_exact_rate_below_threshold");
  if (evidenceLocalizationRate < thresholds.evidenceLocalizationRate) failures.push("evidence_localization_rate_below_threshold");
  if (requiredAbstentionRecall < thresholds.requiredAbstentionRecall) failures.push("required_abstention_recall_below_threshold");
  if (hallucinationRate > thresholds.hallucinationRate) failures.push("hallucination_rate_above_threshold");

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
    },
    gate: { passed: failures.length === 0, failures, thresholds },
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
