import { describe, expect, it } from "vitest";
import { compareRecords } from "@/lib/records/compare-records";
import { syntheticRecord } from "./fixtures/foundation";

const januaryDocument = "1".repeat(64);
const julyDocument = "7".repeat(64);

function januaryRecord(overrides: Parameters<typeof syntheticRecord>[0] = {}) {
  return syntheticRecord({
    observedOn: "2026-01-15",
    documentSha256: januaryDocument,
    confirmedAt: "2026-01-15T09:10:00Z",
    ...overrides,
  });
}

function julyRecord(overrides: Parameters<typeof syntheticRecord>[0] = {}) {
  return syntheticRecord({
    observedOn: "2026-07-28",
    documentSha256: julyDocument,
    confirmedAt: "2026-07-28T09:10:00Z",
    ...overrides,
  });
}

describe("compareRecords", () => {
  it("pairs the earliest and the latest date of the same item", () => {
    const comparisons = compareRecords([
      julyRecord({ recordId: "a1", label: "총콜레스테롤", value: "190", unit: "mg/dL" }),
      januaryRecord({ recordId: "a2", label: "총콜레스테롤", value: "194", unit: "mg/dL" }),
    ]);

    expect(comparisons).toEqual([
      {
        label: "총콜레스테롤",
        unit: "mg/dL",
        earlier: { observedOn: "2026-01-15", value: "194" },
        later: { observedOn: "2026-07-28", value: "190" },
      },
    ]);
  });

  it("leaves out an item that only has one date", () => {
    const comparisons = compareRecords([
      januaryRecord({ recordId: "b1", label: "비타민 D", value: "38", unit: "ng/mL" }),
    ]);

    expect(comparisons).toEqual([]);
  });

  it("leaves out an item confirmed twice on the same date", () => {
    const comparisons = compareRecords([
      julyRecord({ recordId: "c1", label: "당화혈색소", value: "5.2", unit: "%" }),
      julyRecord({
        recordId: "c2",
        label: "당화혈색소",
        value: "5.3",
        unit: "%",
        documentSha256: "2".repeat(64),
        confirmedAt: "2026-07-28T10:10:00Z",
      }),
    ]);

    expect(comparisons).toEqual([]);
  });

  it("uses the current value of a corrected record, not the original one", () => {
    const comparisons = compareRecords([
      januaryRecord({ recordId: "d1", label: "총콜레스테롤", value: "194", originalValue: "194" }),
      julyRecord({
        recordId: "d2",
        label: "총콜레스테롤",
        value: "190",
        originalValue: "188",
        reviewDecision: "CORRECTED",
      }),
    ]);

    expect(comparisons[0].later).toEqual({ observedOn: "2026-07-28", value: "190" });
    expect(comparisons[0].earlier).toEqual({ observedOn: "2026-01-15", value: "194" });
  });

  it("ignores superseded versions so only the current value is compared", () => {
    const comparisons = compareRecords([
      januaryRecord({ recordId: "e1", label: "총콜레스테롤", value: "194" }),
      julyRecord({ recordId: "e2", label: "총콜레스테롤", value: "188", status: "SUPERSEDED" }),
      julyRecord({
        recordId: "e2",
        recordVersionId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d99",
        label: "총콜레스테롤",
        value: "190",
        confirmedAt: "2026-07-28T11:10:00Z",
      }),
    ]);

    expect(comparisons).toEqual([
      {
        label: "총콜레스테롤",
        unit: "mg/dL",
        earlier: { observedOn: "2026-01-15", value: "194" },
        later: { observedOn: "2026-07-28", value: "190" },
      },
    ]);
  });

  it("sorts the comparisons by label and skips items without a second date", () => {
    const comparisons = compareRecords([
      julyRecord({ recordId: "f1", label: "총콜레스테롤", value: "190", unit: "mg/dL" }),
      julyRecord({ recordId: "f2", label: "당화혈색소", value: "5.2", unit: "%" }),
      januaryRecord({ recordId: "f3", label: "총콜레스테롤", value: "194", unit: "mg/dL" }),
      januaryRecord({ recordId: "f4", label: "당화혈색소", value: "5.4", unit: "%" }),
      januaryRecord({ recordId: "f5", label: "비타민 D", value: "38", unit: "ng/mL" }),
    ]);

    expect(comparisons.map((comparison) => comparison.label)).toEqual(["당화혈색소", "총콜레스테롤"]);
    expect(comparisons[0]).toEqual({
      label: "당화혈색소",
      unit: "%",
      earlier: { observedOn: "2026-01-15", value: "5.4" },
      later: { observedOn: "2026-07-28", value: "5.2" },
    });
  });

  it("returns nothing for an empty record list", () => {
    expect(compareRecords([])).toEqual([]);
  });
});
