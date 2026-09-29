import { expect, it } from "vitest";
import { buildRecordCsv } from "@/lib/records/export-csv";
import { syntheticRecord } from "./fixtures/foundation";

it("exports only current confirmed records with their source and correction history", () => {
  const csv = buildRecordCsv([
    syntheticRecord({ status: "SUPERSEDED", value: "999" }),
    syntheticRecord({ reviewDecision: "CORRECTED", value: "190", originalValue: "188" }),
  ]);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  expect(csv).not.toContain('"999"');
  expect(csv).toContain('"190","mg/dL","188"');
  expect(csv).toContain('"사용자가 수정함"');
  expect(csv).toContain('"예시 데이터 · 개인 기록 정리본"');
  expect(csv).toContain('"' + "a".repeat(64) + '"');
  expect(csv.split("\r\n")).toHaveLength(3);
});

it("quotes delimiters and neutralizes spreadsheet formulas in every text cell", () => {
  const csv = buildRecordCsv([syntheticRecord({ label: '예시,"항목"', originalLabel: ' =1+1', unit: '@SUM(1)', value: '-1' })]);
  expect(csv).toContain('"예시,""항목"""');
  expect(csv).toContain('"\' =1+1"');
  expect(csv).toContain('"\'@SUM(1)"');
  expect(csv).toContain('"\'-1"');
});
