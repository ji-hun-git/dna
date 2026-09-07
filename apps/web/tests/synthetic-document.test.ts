import { expect, it } from "vitest";
import { buildSyntheticResultPdf } from "@/lib/foundation/synthetic-document";

it("puts the fixed catalogue values in inspectable synthetic source bytes", () => {
  const july = new TextDecoder().decode(buildSyntheticResultPdf("2026-07"));
  const january = new TextDecoder().decode(buildSyntheticResultPdf("2026-01"));
  expect(july).toContain("%GC-SYNTHETIC-ONLY");
  for (const text of ["Cholesterol: 188 mg/dL", "HbA1c: 5.2 %", "Vitamin D: 42 ng/mL", "2026-07-28"]) expect(july).toContain(text);
  for (const text of ["Cholesterol: 194 mg/dL", "HbA1c: 5.4 %", "Vitamin D: 45 ng/mL", "2026-01-15"]) expect(january).toContain(text);
  expect(buildSyntheticResultPdf("2026-07")).toEqual(buildSyntheticResultPdf("2026-07"));
});
