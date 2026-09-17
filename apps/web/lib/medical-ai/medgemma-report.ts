import { medicalDocumentCorpusSchema, medicalDocumentRunSchema } from "./contracts.ts";
import { compareMedicalDocumentPipelines, type MedicalDocumentSyntheticContractRegression } from "./evaluation.ts";

export type FieldOutcome = { fieldId: string; label: string; expected: string; actual: string; outcome: "정확" | "오답" | "누락" | "환각" };
export type DocumentBreakdown = {
  documentId: string; expected: number; exact: number; wrong: number; missing: number; hallucinated: number;
  abstentionsRequired: number; abstentionsMet: number; fields: FieldOutcome[];
};

function shown(field: { value: string; unit: string; observedAt: string }) {
  return `${field.value} ${field.unit} @ ${field.observedAt}`;
}

/** Per-document, per-field outcome using the evaluator's exact-field rule (label, value, unit, observedAt). */
export function breakdownByDocument(corpusInput: unknown, runsInput: readonly unknown[]): DocumentBreakdown[] {
  const corpus = medicalDocumentCorpusSchema.parse(corpusInput);
  const runs = new Map(runsInput.map((run) => medicalDocumentRunSchema.parse(run)).map((run) => [run.documentId, run]));
  return corpus.documents.map((document) => {
    const run = runs.get(document.documentId);
    const candidates = run?.candidates ?? [];
    const byId = new Map(candidates.map((candidate) => [candidate.fieldId, candidate]));
    const fields: FieldOutcome[] = document.expectedMeasurements.map((expected) => {
      const actual = byId.get(expected.fieldId);
      if (!actual) return { fieldId: expected.fieldId, label: expected.label, expected: shown(expected), actual: "—", outcome: "누락" };
      const exact = actual.label === expected.label && actual.value === expected.value && actual.unit === expected.unit && actual.observedAt === expected.observedAt;
      return { fieldId: expected.fieldId, label: expected.label, expected: shown(expected), actual: `${actual.label}: ${shown(actual)}`, outcome: exact ? "정확" : "오답" };
    });
    const expectedIds = new Set(document.expectedMeasurements.map((field) => field.fieldId));
    for (const candidate of candidates) {
      if (!expectedIds.has(candidate.fieldId)) fields.push({ fieldId: candidate.fieldId, label: candidate.label, expected: "—", actual: `${candidate.label}: ${shown(candidate)}`, outcome: "환각" });
    }
    const abstentionsMet = document.requiredAbstentions.filter((required) => {
      const actual = run?.abstentions.find((item) => item.fieldId === required.fieldId);
      return !!actual && required.acceptedReasons.includes(actual.reason);
    }).length;
    return {
      documentId: document.documentId,
      expected: document.expectedMeasurements.length,
      exact: fields.filter((field) => field.outcome === "정확").length,
      wrong: fields.filter((field) => field.outcome === "오답").length,
      missing: fields.filter((field) => field.outcome === "누락").length,
      hallucinated: fields.filter((field) => field.outcome === "환각").length,
      abstentionsRequired: document.requiredAbstentions.length,
      abstentionsMet,
      fields,
    };
  });
}

export type ReportPipeline = { label: string; runs: readonly unknown[]; evidenceMeasurable: boolean; gated: boolean };
export type ReportInput = {
  generatedAt: string;
  corpus: unknown;
  pipelines: readonly ReportPipeline[];
  environment: readonly (readonly [string, string])[];
  documentOutcomes: readonly { documentId: string; status: string; failure?: string; durationMs: number }[];
  /** Prepended to the report title, e.g. "[제한 실행] " for a --limit run. Empty/omitted for a full run. */
  titlePrefix?: string;
};

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function metricRow(name: string, reports: { pipeline: ReportPipeline; report: MedicalDocumentSyntheticContractRegression }[], cell: (entry: { pipeline: ReportPipeline; report: MedicalDocumentSyntheticContractRegression }) => string) {
  return `| ${name} | ${reports.map(cell).join(" | ")} |`;
}

/** Markdown evidence for docs/status/<date>/medgemma-local-experiment.md. Metrics only; no interpretation of the values. */
export function renderMedgemmaExperimentReport(input: ReportInput) {
  const corpus = medicalDocumentCorpusSchema.parse(input.corpus);
  const compared = compareMedicalDocumentPipelines(input.corpus, input.pipelines.map(({ label, runs }) => ({ label, runs })));
  const reports = input.pipelines.map((pipeline) => ({ pipeline, report: compared.find((entry) => entry.label === pipeline.label)!.report }));
  const header = `| Metric | ${reports.map((entry) => entry.pipeline.label).join(" | ")} |`;
  const divider = `|---|${reports.map(() => "---").join("|")}|`;
  const lines = [
    `# ${input.titlePrefix ?? ""}MedGemma 1.5 local synthetic experiment — ${corpus.corpusId} (${input.generatedAt})`,
    "",
    "Bounded local evaluation approved in `governance/founder-medgemma-local-evaluation-approval-2026-09-16.md`. The model saw only synthetic page images rendered from the generated corpus and was asked to transcribe label, value, unit and the labelled exam date; it was told not to judge anything. Its output never entered product code and is not stored as a record. Not a clinical, regulatory or production-accuracy claim (`synthetic-contract-regression-only`). Thresholds are shown for the parser gate only; for the model they are evidence, not a verdict.",
    "",
    "## 실행 환경",
    "",
    "| Pin | Value |",
    "|---|---|",
    ...input.environment.map(([key, value]) => `| ${key} | ${value} |`),
    "",
    "## 나란히 (same corpus, same evaluator)",
    "",
    header,
    divider,
    metricRow("Documents", reports, (entry) => String(entry.report.metrics.documentCount)),
    metricRow("Expected measurements", reports, (entry) => String(entry.report.metrics.expectedMeasurementCount)),
    metricRow("Returned measurements", reports, (entry) => String(entry.report.metrics.returnedMeasurementCount)),
    metricRow("Exact measurements", reports, (entry) => String(entry.report.metrics.exactMeasurementCount)),
    metricRow("Field precision", reports, (entry) => percent(entry.report.metrics.fieldPrecision)),
    metricRow("Field recall", reports, (entry) => percent(entry.report.metrics.fieldRecall)),
    metricRow("Field F1", reports, (entry) => percent(entry.report.metrics.fieldF1)),
    metricRow("Critical value exact", reports, (entry) => percent(entry.report.metrics.criticalValueExactRate)),
    metricRow("Evidence localization (IoU ≥ 0.8)", reports, (entry) => entry.pipeline.evidenceMeasurable ? percent(entry.report.metrics.evidenceLocalizationRate) : "측정 불가 (페이지 전체 박스)"),
    metricRow("Required abstention recall", reports, (entry) => percent(entry.report.metrics.requiredAbstentionRecall)),
    metricRow("Hallucinated measurements", reports, (entry) => `${entry.report.metrics.hallucinatedMeasurementCount} (${percent(entry.report.metrics.hallucinationRate)})`),
    metricRow("Reference-range text carried verbatim", reports, (entry) => percent(entry.report.metrics.referenceRangeAccuracy)),
    metricRow("Gate", reports, (entry) => entry.pipeline.gated ? (entry.report.gate.passed ? "PASS" : `FAIL: ${entry.report.gate.failures.join(", ")}`) : "게이트 아님 (evidence only)"),
    "",
    "Delta rows are read left to right; the model column is descriptive. Evidence localization cannot be measured for the model because it returns no box (every candidate cites the whole page).",
    "",
  ];
  const breakdowns = reports.map((entry) => ({ entry, byDocument: breakdownByDocument(input.corpus, entry.pipeline.runs) }));
  lines.push("## 문서별", "", `| Document | ${reports.map((entry) => `${entry.pipeline.label} 정확/기대 · 오답 · 누락 · 환각 · 보류`).join(" | ")} | 모델 실행 |`, `|---|${reports.map(() => "---").join("|")}|---|`);
  for (const document of corpus.documents) {
    const cells = breakdowns.map(({ byDocument }) => {
      const row = byDocument.find((item) => item.documentId === document.documentId)!;
      return `${row.exact}/${row.expected} · ${row.wrong} · ${row.missing} · ${row.hallucinated} · ${row.abstentionsMet}/${row.abstentionsRequired}`;
    });
    const outcome = input.documentOutcomes.find((item) => item.documentId === document.documentId);
    const status = outcome ? `${outcome.status} (${Math.round(outcome.durationMs / 1000)} s)${outcome.failure ? ` — ${outcome.failure}` : ""}` : "—";
    lines.push(`| ${document.documentId} | ${cells.join(" | ")} | ${status} |`);
  }
  lines.push("", "## 항목별", "");
  for (const { entry, byDocument } of breakdowns) {
    lines.push(`### ${entry.pipeline.label}`, "", "| Document | Field | Expected | Returned | Outcome |", "|---|---|---|---|---|");
    for (const document of byDocument) {
      for (const field of document.fields) lines.push(`| ${document.documentId} | ${field.fieldId} (${field.label}) | ${field.expected} | ${field.actual} | ${field.outcome} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
