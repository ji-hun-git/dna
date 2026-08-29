import { expect, it } from "vitest";
import { medicalDocumentRunSchema } from "@/lib/medical-ai/contracts";
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
