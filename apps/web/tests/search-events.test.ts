import { describe, expect, it } from "vitest";
import { searchEvents } from "@/lib/my-data/search-events";
import { syntheticHealthEvent } from "./fixtures/foundation";

const chol = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d51" });
const a1c = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d52", concept: "당화혈색소", unit: "%", conceptCode: "hba1c" });

describe("searchEvents", () => {
  it("returns no filter for an empty or whitespace query", () => {
    expect(searchEvents([chol, a1c], "")).toEqual({ matchedIds: null, count: 2 });
    expect(searchEvents([chol, a1c], "   ")).toEqual({ matchedIds: null, count: 2 });
    expect(searchEvents([chol, a1c], "\t　 ")).toEqual({ matchedIds: null, count: 2 });
  });

  it("matches the concept exactly after trimming and unicode normalisation", () => {
    const result = searchEvents([chol, a1c], " 총콜레스테롤 ".normalize("NFD"));
    expect([...result.matchedIds!]).toEqual([chol.eventId]);
    expect(result.count).toBe(1);
  });

  it("reports zero matches instead of falling back to everything", () => {
    expect(searchEvents([chol, a1c], "LDL")).toEqual({ matchedIds: new Set(), count: 0 });
  });

  it("folds Latin case before comparing, so HbA1c and hba1c are the same concept", () => {
    const latin = syntheticHealthEvent({ eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d53", concept: "HbA1c", unit: "%" });
    const result = searchEvents([chol, latin], "hba1c");
    expect([...result.matchedIds!]).toEqual([latin.eventId]);
    expect(result.count).toBe(1);
  });

  it("matches the concept code exactly so a dictionary key finds the same cells as its label", () => {
    const result = searchEvents([chol, a1c], "total-cholesterol");
    expect([...result.matchedIds!]).toEqual([chol.eventId]);
    expect(searchEvents([chol, a1c], "total")).toEqual({ matchedIds: new Set(), count: 0 });
  });
});
