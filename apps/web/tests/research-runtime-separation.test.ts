import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const healthRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(healthRoot, "../..");
const researchRoot = resolve(repositoryRoot, "apps/research-web");

describe("health and research runtime separation", () => {
  it("does not ship the research route or implementation in the health application", () => {
    expect(existsSync(resolve(healthRoot, "app/research-data"))).toBe(false);
    expect(existsSync(resolve(healthRoot, "components/research-data"))).toBe(false);
    expect(existsSync(resolve(healthRoot, "lib/research-data"))).toBe(false);
  });

  it("uses a separate package, application identity, readiness route, and credential policy", () => {
    expect(JSON.parse(readFileSync(resolve(researchRoot, "package.json"), "utf8")).name)
      .toBe("@gc/research-web");
    expect(readFileSync(resolve(researchRoot, "app/layout.tsx"), "utf8"))
      .toContain("genome-companion-research-web");
    expect(readFileSync(resolve(researchRoot, "app/healthz/route.ts"), "utf8"))
      .toContain('trustPlane: "public-research"');
    expect(readFileSync(resolve(researchRoot, "next.config.ts"), "utf8"))
      .toContain("Research runtime refuses health credentials");
    expect(readFileSync(resolve(healthRoot, "next.config.ts"), "utf8"))
      .toContain("Health runtime refuses research credentials");
  });
});
