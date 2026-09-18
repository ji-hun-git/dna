import { expect, it } from "vitest";
import { medicalDocumentGoldSchema, medicalDocumentRunSchema } from "@/lib/medical-ai/contracts";
import {
  compareMedicalDocumentPipelines,
  evaluateMedicalDocumentPipeline,
} from "@/lib/medical-ai/evaluation";
import corpus from "./fixtures/medical-ai/synthetic-korean-lab.corpus.json";
import referenceRuns from "./fixtures/medical-ai/paddle-medgemma.reference-runs.json";
import unsafeRuns from "./fixtures/medical-ai/unsafe-general-vlm.runs.json";

it("admits only an exact candidate-only pipeline with localized evidence and required abstentions", () => {
  const report = evaluateMedicalDocumentPipeline(corpus, referenceRuns);

  expect(report).toMatchObject({
    schemaVersion: "medical-document-synthetic-contract-regression.v1",
    evidenceLevel: "synthetic-contract-regression-only",
    productionAccuracyClaim: false,
  });
  expect(report.pipelineId).toBe("paddleocr-vl-1.6.medgemma-1.5-4b");
  expect(report.metrics).toMatchObject({
    documentCount: 2,
    expectedMeasurementCount: 6,
    exactMeasurementCount: 6,
    hallucinatedMeasurementCount: 0,
    fieldF1: 1,
    criticalValueExactRate: 1,
    evidenceLocalizationRate: 1,
    requiredAbstentionRecall: 1,
    hallucinationRate: 0,
  });
  expect(report.gate).toMatchObject({ passed: true, failures: [] });
});

it("fails a confident wrong value, displaced evidence, hallucinated field, and missing abstention", () => {
  const report = evaluateMedicalDocumentPipeline(corpus, unsafeRuns);

  expect(report.gate.passed).toBe(false);
  expect(report.metrics.hallucinatedMeasurementCount).toBe(1);
  expect(report.gate.failures).toEqual(expect.arrayContaining([
    "field_f1_below_threshold",
    "critical_value_exact_rate_below_threshold",
    "evidence_localization_rate_below_threshold",
    "required_abstention_recall_below_threshold",
    "hallucination_rate_above_threshold",
  ]));
});

it("ranks the admitted pipeline first without turning model confidence into clinical truth", () => {
  const comparison = compareMedicalDocumentPipelines(corpus, [
    { label: "검토하지 않은 범용 VLM", runs: unsafeRuns },
    { label: "PaddleOCR-VL + MedGemma 후보 파이프라인", runs: referenceRuns },
  ]);

  expect(comparison.map((entry) => entry.label)).toEqual([
    "PaddleOCR-VL + MedGemma 후보 파이프라인",
    "검토하지 않은 범용 VLM",
  ]);
  expect(comparison[0].report.gate.passed).toBe(true);
});

it("rejects diagnosis-like annotations and every unreviewed extra output key", () => {
  const runWithClinicalJudgment = structuredClone(referenceRuns[0]) as unknown as {
    candidates: Array<Record<string, unknown>>;
  };
  runWithClinicalJudgment.candidates[0].normality = "abnormal";
  runWithClinicalJudgment.candidates[0].diagnosis = "당뇨병 의심";

  const parsed = medicalDocumentRunSchema.safeParse(runWithClinicalJudgment);
  expect(parsed.success).toBe(false);
});

it("accepts a gold document that only requires abstentions and rejects one that expects nothing", () => {
  const scanOnly = {
    ...corpus.documents[0],
    documentId: "synthetic-scan-001",
    expectedMeasurements: [],
    requiredAbstentions: [{ fieldId: "document", label: "문서 전체", acceptedReasons: ["unreadable"] }],
  };
  expect(medicalDocumentGoldSchema.safeParse(scanOnly).success).toBe(true);
  expect(medicalDocumentGoldSchema.safeParse({ ...scanOnly, requiredAbstentions: [] }).success).toBe(false);
});

it("scores reference-range text carried verbatim and fails the gate when it drifts", () => {
  const baseline = evaluateMedicalDocumentPipeline(corpus, referenceRuns);
  expect(baseline.metrics.referenceRangeAccuracy).toBe(1);
  expect(baseline.gate.thresholds.referenceRangeAccuracy).toBe(1);

  const goldWithRange = structuredClone(corpus) as unknown as { documents: Array<{ documentId: string; expectedMeasurements: Array<Record<string, unknown>> }> };
  const runsWithRange = structuredClone(referenceRuns) as unknown as Array<{ documentId: string; candidates: Array<Record<string, unknown>> }>;
  const firstRun = runsWithRange[0];
  const firstCandidate = firstRun.candidates[0];
  const goldDocument = goldWithRange.documents.find((document) => document.documentId === firstRun.documentId)!;
  const goldField = goldDocument.expectedMeasurements.find((field) => field.fieldId === firstCandidate.fieldId)!;
  goldField.expectedReferenceRangeText = "70-99";
  firstCandidate.referenceRangeText = "70-99";
  const matching = evaluateMedicalDocumentPipeline(goldWithRange, runsWithRange);
  expect(matching.metrics.referenceRangeAccuracy).toBe(1);
  expect(matching.metrics.fieldF1).toBe(1);
  expect(matching.gate.passed).toBe(true);

  firstCandidate.referenceRangeText = "70-100";
  const drifted = evaluateMedicalDocumentPipeline(goldWithRange, runsWithRange);
  expect(drifted.metrics.referenceRangeAccuracy).toBeLessThan(1);
  expect(drifted.metrics.fieldF1).toBe(1);
  expect(drifted.gate.passed).toBe(false);
  expect(drifted.gate.failures).toEqual(["reference_range_accuracy_below_threshold"]);

  delete firstCandidate.referenceRangeText;
  const missing = evaluateMedicalDocumentPipeline(goldWithRange, runsWithRange);
  expect(missing.metrics.referenceRangeAccuracy).toBeLessThan(1);
  expect(missing.gate.failures).toEqual(["reference_range_accuracy_below_threshold"]);
});

it("rejects reference-range text that is not a bare range body", () => {
  const run = structuredClone(referenceRuns[0]) as unknown as { candidates: Array<Record<string, unknown>> };
  run.candidates[0].referenceRangeText = "normal 70-99";
  expect(medicalDocumentRunSchema.safeParse(run).success).toBe(false);
  run.candidates[0].referenceRangeText = "≤5.6";
  expect(medicalDocumentRunSchema.safeParse(run).success).toBe(true);
  const gold = structuredClone(corpus.documents[0]) as unknown as { expectedMeasurements: Array<Record<string, unknown>> };
  gold.expectedMeasurements[0].referenceRangeText = "70-99";
  expect(medicalDocumentGoldSchema.safeParse(gold).success).toBe(false);
  gold.expectedMeasurements[0] = { ...gold.expectedMeasurements[0], expectedReferenceRangeText: "70-99" };
  delete gold.expectedMeasurements[0].referenceRangeText;
  expect(medicalDocumentGoldSchema.safeParse(gold).success).toBe(true);
});

it("scores the concept code against gold, counts an expected no-concept row, and fails the gate when it drifts", () => {
  const baseline = evaluateMedicalDocumentPipeline(corpus, referenceRuns);
  expect(baseline.metrics.conceptAccuracy).toBe(1);
  expect(baseline.gate.thresholds.conceptAccuracy).toBe(1);

  const gold = structuredClone(corpus) as unknown as { documents: Array<{ documentId: string; expectedMeasurements: Array<Record<string, unknown>> }> };
  const runs = structuredClone(referenceRuns) as unknown as Array<{ documentId: string; candidates: Array<Record<string, unknown>> }>;
  const run = runs[0];
  const [first, second] = run.candidates;
  const fields = gold.documents.find((document) => document.documentId === run.documentId)!.expectedMeasurements;
  fields.find((field) => field.fieldId === first.fieldId)!.expectedConceptCode = "glucose";
  fields.find((field) => field.fieldId === second.fieldId)!.expectedNoConcept = true;
  first.conceptCode = "glucose";
  const matching = evaluateMedicalDocumentPipeline(gold, runs);
  expect(matching.metrics.conceptAccuracy).toBe(1);
  expect(matching.gate.passed).toBe(true);

  first.conceptCode = "fasting-glucose";
  const drifted = evaluateMedicalDocumentPipeline(gold, runs);
  expect(drifted.metrics.conceptAccuracy).toBe(0.5);
  expect(drifted.metrics.fieldF1).toBe(1);
  expect(drifted.gate.failures).toEqual(["concept_accuracy_below_threshold"]);

  first.conceptCode = "glucose";
  second.conceptCode = "uric-acid";
  expect(evaluateMedicalDocumentPipeline(gold, runs).gate.failures).toEqual(["concept_accuracy_below_threshold"]);
});
