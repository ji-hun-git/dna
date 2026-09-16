import { expect, it } from "vitest";
import { renderNativeTextReport } from "@/lib/medical-ai/native-text-report";
import type { MedicalDocumentSyntheticContractRegression } from "@/lib/medical-ai/evaluation";

const report: MedicalDocumentSyntheticContractRegression = {
  schemaVersion: "medical-document-synthetic-contract-regression.v1",
  evidenceLevel: "synthetic-contract-regression-only",
  productionAccuracyClaim: false,
  corpusId: "synthetic-ko-checkup-r1",
  pipelineId: "pdfbox-native-text",
  metrics: {
    documentCount: 24,
    expectedMeasurementCount: 176,
    returnedMeasurementCount: 176,
    exactMeasurementCount: 176,
    hallucinatedMeasurementCount: 0,
    fieldPrecision: 1,
    fieldRecall: 1,
    fieldF1: 1,
    criticalValueExactRate: 1,
    evidenceLocalizationRate: 1,
    requiredAbstentionRecall: 1,
    hallucinationRate: 0,
  },
  gate: { passed: true, failures: [], thresholds: { fieldF1: 1, criticalValueExactRate: 1, evidenceLocalizationRate: 1, hallucinationRate: 0, requiredAbstentionRecall: 1 } },
};

it("renders the gate metrics as a markdown table without an accuracy claim", () => {
  const markdown = renderNativeTextReport(report, "2026-09-16");
  expect(markdown).toContain("# Native-text benchmark — synthetic-ko-checkup-r1 (2026-09-16)");
  expect(markdown).toContain("| Documents | 24 |");
  expect(markdown).toContain("| Field F1 | 100.0% |");
  expect(markdown).toContain("| Required abstention recall | 100.0% |");
  expect(markdown).toContain("| Gate | PASS |");
  expect(markdown).toContain("Not a clinical, regulatory or production-accuracy claim");
  expect(markdown).not.toMatch(/diagnos|정상|비정상/);
});

it("names the failed thresholds when the gate fails", () => {
  const failed = { ...report, gate: { ...report.gate, passed: false, failures: ["field_f1_below_threshold"] } };
  expect(renderNativeTextReport(failed, "2026-09-16")).toContain("| Gate | FAIL: field_f1_below_threshold |");
});
