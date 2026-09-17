// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("has one server-backed product regardless of obsolete demo flags", () => {
  for (const route of ["", "records/", "prepare/", "data-control/"]) {
    const source = readFileSync(new URL(`../app/${route}page.tsx`, import.meta.url), "utf8");
    expect(source).not.toContain("GC_INTEGRATED_SYNTHETIC_UI");
    expect(source).not.toContain("process.env");
    expect(source).not.toMatch(/experience\/HealthExperience|HealthTimeline|PrepareConceptNotice|DataControlCenter/);
    expect(source).toContain("integrated/");
  }
});
