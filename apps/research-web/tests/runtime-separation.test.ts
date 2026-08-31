import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const researchRoot = resolve(import.meta.dirname, "..");
const stylesheet = readFileSync(
  resolve(researchRoot, "components/research-data/ResearchEvidenceAgent.module.css"),
  "utf8",
);

describe("public research runtime identity", () => {
  it("preserves the established research studio frame in its own build", () => {
    expect(stylesheet).toContain("grid-template-columns: minmax(0, 1.35fr) minmax(20rem, .65fr)");
    expect(stylesheet).toContain("outline-color: #3182f6");
  });

  it("contains no health API client, session cookie, or PHI database contract", () => {
    const packageJson = readFileSync(resolve(researchRoot, "package.json"), "utf8");
    const config = readFileSync(resolve(researchRoot, "next.config.ts"), "utf8");
    expect(packageJson).not.toMatch(/jose|playwright|foundation/i);
    expect(config).not.toMatch(/GC_CORE_API_ORIGIN|GC_SESSION|GC_CSRF/);
    expect(config).toContain("GC_DATABASE_URL");
    expect(config).toContain("Research runtime refuses health credentials");
  });
});
