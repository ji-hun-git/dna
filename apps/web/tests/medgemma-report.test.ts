// @vitest-environment node
import { expect, it } from "vitest";
import { breakdownByDocument, renderMedgemmaExperimentReport } from "@/lib/medical-ai/medgemma-report";
import corpus from "./fixtures/medical-ai/synthetic-korean-lab.corpus.json";
import referenceRuns from "./fixtures/medical-ai/paddle-medgemma.reference-runs.json";
import unsafeRuns from "./fixtures/medical-ai/unsafe-general-vlm.runs.json";

it("breaks every expected field down into exact, wrong, missing or hallucinated per document", () => {
  const exact = breakdownByDocument(corpus, referenceRuns);
  expect(exact.map((document) => document.exact)).toEqual(exact.map((document) => document.expected));
  expect(exact.flatMap((document) => document.fields).every((field) => field.outcome === "정확")).toBe(true);

  const unsafe = breakdownByDocument(corpus, unsafeRuns);
  expect(unsafe.reduce((sum, document) => sum + document.hallucinated, 0)).toBe(1);
  expect(unsafe.flatMap((document) => document.fields).some((field) => field.outcome === "오답" || field.outcome === "누락")).toBe(true);
  expect(unsafe.flatMap((document) => document.fields).some((field) => field.outcome === "환각")).toBe(true);
});

it("renders the side-by-side report with the model localization column marked not measurable and no threshold verdict for the model", () => {
  const markdown = renderMedgemmaExperimentReport({
    generatedAt: "2026-09-17",
    corpus,
    pipelines: [
      { label: "pdfbox-native-text", runs: referenceRuns, evidenceMeasurable: true, gated: true },
      { label: "ollama-medgemma-1.5-4b-page-image", runs: unsafeRuns, evidenceMeasurable: false, gated: false },
    ],
    environment: [["Ollama", "0.34.1"], ["Model", "medgemma1.5:latest (433252621ab1…)"], ["Corpus", "synthetic-ko-checkup-r2-0123456789abcdef"]],
    documentOutcomes: [{ documentId: corpus.documents[0].documentId, status: "ok", durationMs: 1234 }, { documentId: corpus.documents[1].documentId, status: "unreadable", failure: "AbortError: timeout", durationMs: 180000 }],
  });
  expect(markdown).toContain("# MedGemma 1.5 local synthetic experiment — synthetic-ko-lab-v1 (2026-09-17)");
  expect(markdown).toContain("| Metric | pdfbox-native-text | ollama-medgemma-1.5-4b-page-image |");
  expect(markdown).toContain("측정 불가 (페이지 전체 박스)");
  expect(markdown).toContain("| Gate | PASS | 게이트 아님 (evidence only) |");
  expect(markdown).toContain("| Ollama | 0.34.1 |");
  expect(markdown).toContain("AbortError: timeout");
  expect(markdown).toContain("## 문서별");
  expect(markdown).toContain("## 항목별");
  expect(markdown).toContain("Not a clinical, regulatory or production-accuracy claim");
  expect(markdown).not.toMatch(/diagnos|정상\b|비정상/);
});
