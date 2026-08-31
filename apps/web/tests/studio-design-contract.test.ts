import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "..");
const globals = readFileSync(resolve(webRoot, "app/globals.css"), "utf8");
const records = readFileSync(resolve(webRoot, "components/records/HealthTimeline.module.css"), "utf8");
const providers = readFileSync(resolve(webRoot, "components/providers/PublicProviderExplorer.module.css"), "utf8");

describe("neutral studio visual contract", () => {
  it("pins the shared shadcn-like surface and Toss-like Korean hierarchy", () => {
    expect(globals).toContain("--gc-studio-control: #18181b");
    expect(globals).toContain("--gc-studio-border: #e4e4e7");
    expect(globals).toContain("--gc-studio-accent: #3182f6");
    expect(globals).toContain("letter-spacing: -0.055em");
  });

  it("keeps the established responsive frame selectors intact", () => {
    expect(globals).toContain(".gc-health-home__hero {");
    expect(globals).toContain("grid-template-columns: minmax(0, 1.15fr) minmax(20rem, 0.85fr)");
    expect(records).toContain("grid-template-columns: minmax(0, 1.2fr) minmax(20rem, 0.8fr)");
    expect(providers).toContain("grid-template-columns: minmax(0, 1.3fr) minmax(21rem, 0.7fr)");
  });

  it("applies the neutral studio skin to every main product surface", () => {
    for (const stylesheet of [records, providers]) {
      expect(stylesheet).toContain("background: #fafafa");
      expect(stylesheet).toContain("border-radius: 20px");
      expect(stylesheet).toContain("outline-color: #3182f6");
    }
  });
});
