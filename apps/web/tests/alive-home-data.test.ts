import { describe, expect, it } from "vitest";
import { NEXT_RESULT_PHASE_LABEL, buildHomePhases, homeIdentityCounts, type HomeRecordLike } from "@/lib/home/alive-home-data";

function record(over: Partial<HomeRecordLike>): HomeRecordLike {
  return { documentId: "doc-1", label: "총콜레스테롤", value: "188", unit: "mg/dL", observedOn: "2026-07-28", ...over };
}

describe("buildHomePhases", () => {
  it("returns only the trailing open phase and no rings when there are no records", () => {
    const result = buildHomePhases([]);
    expect(result.labels).toEqual([NEXT_RESULT_PHASE_LABEL]);
    expect(result.rings).toHaveLength(0);
    expect(result.overflowByRing).toHaveLength(0);
  });

  it("groups records by document, orders phases by exam date, and appends the open phase", () => {
    const records: HomeRecordLike[] = [
      record({ documentId: "doc-2", observedOn: "2026-07-28", label: "비타민 D", value: "31.2", unit: "ng/mL" }),
      record({ documentId: "doc-1", observedOn: "2025-01-20", label: "체질량지수", value: "23.4", unit: "" }),
    ];
    const result = buildHomePhases(records);
    expect(result.labels).toEqual(["2025. 1. 20. 결과지", "2026. 7. 28. 결과지", NEXT_RESULT_PHASE_LABEL]);
    expect(result.rings).toHaveLength(2);
    expect(result.rings[0].nodes.map((n) => n.item)).toEqual(["체질량지수"]);
    expect(result.rings[1].nodes.map((n) => n.item)).toEqual(["비타민 D"]);
  });

  it("spreads ring positions across the trajectory in phase order", () => {
    const records: HomeRecordLike[] = [
      record({ documentId: "doc-1", observedOn: "2025-01-01" }),
      record({ documentId: "doc-2", observedOn: "2026-01-01" }),
    ];
    const { rings } = buildHomePhases(records);
    expect(rings[0].t).toBeGreaterThan(0);
    expect(rings[1].t).toBeGreaterThan(rings[0].t);
    expect(rings[1].t).toBeLessThan(0.97);
  });

  it("caps a document's nodes at four and folds the rest into a single +N개 marker, never dropping them", () => {
    const records: HomeRecordLike[] = Array.from({ length: 6 }, (_, i) =>
      record({ label: `항목${i}`, value: String(i), observedOn: "2026-07-28" }),
    );
    const { rings, overflowByRing } = buildHomePhases(records);
    expect(rings).toHaveLength(1);
    expect(rings[0].nodes).toHaveLength(5); // 4 real + 1 marker
    expect(rings[0].nodes.at(-1)?.item).toBe("+2개");
    expect(overflowByRing).toEqual([{ ringIndex: 0, count: 2 }]);
  });

  it("gives every node (including the overflow marker) the same shape/size vocabulary as the example dataset", () => {
    const records: HomeRecordLike[] = [record({})];
    const { rings } = buildHomePhases(records);
    for (const node of rings[0].nodes) {
      expect(["circle", "squircle"]).toContain(node.shape);
      expect(typeof node.size).toBe("number");
    }
  });
});

describe("homeIdentityCounts", () => {
  it("reports zero counts and no last date with no records", () => {
    expect(homeIdentityCounts([])).toEqual({ recordCount: 0, resultSheetCount: 0, lastResultDate: null });
  });

  it("counts records and distinct documents, and finds the latest exam date", () => {
    const records: HomeRecordLike[] = [
      record({ documentId: "doc-1", observedOn: "2025-01-20" }),
      record({ documentId: "doc-1", observedOn: "2025-01-20" }),
      record({ documentId: "doc-2", observedOn: "2026-07-28" }),
    ];
    expect(homeIdentityCounts(records)).toEqual({ recordCount: 3, resultSheetCount: 2, lastResultDate: "2026-07-28" });
  });
});
