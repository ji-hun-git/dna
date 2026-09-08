import { expect, it } from "vitest";
import { buildVisitQuestions } from "@/lib/records/visit-questions";
import { syntheticRecord } from "./fixtures/foundation";

it("bounds questions to three and carries exact current record lineage", () => {
  const records = Array.from({ length: 5 }, (_, index) => syntheticRecord({
    recordId: `record-${index}`, label: `예시 항목 ${index}`,
  }));
  const questions = buildVisitQuestions(records);
  expect(questions).toHaveLength(3);
  expect(questions.every((q) => q.sourceRecordIds.length > 0)).toBe(true);
  expect(questions.flatMap((q) => q.sourceRecordIds).every((id) => records.some((r) => r.recordId === id))).toBe(true);
});

it("uses current corrected values, never superseded values or mismatched units", () => {
  const current = syntheticRecord({ recordId: "current", reviewDecision: "CORRECTED" });
  const older = syntheticRecord({ recordId: "older", observedOn: "2026-01-15" });
  const superseded = syntheticRecord({ recordId: "retired", status: "SUPERSEDED" });
  const questions = buildVisitQuestions([current, older, superseded]);
  expect(questions).toHaveLength(1);
  expect(questions[0].sourceRecordIds).toEqual(["older", "current"]);
  expect(questions[0].text).toContain("이전 결과와 함께");
  expect(buildVisitQuestions([superseded])).toEqual([]);
  expect(buildVisitQuestions([current, { ...older, unit: "%" }])).toHaveLength(2);
});

it("has no output for missing records and a deterministic order", () => {
  expect(buildVisitQuestions([])).toEqual([]);
  const records = [syntheticRecord({recordId: "a"}), syntheticRecord({recordId: "b", observedOn: "2026-01-15"})];
  expect(buildVisitQuestions(records)).toEqual(buildVisitQuestions([...records].reverse()));
});
