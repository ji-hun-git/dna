import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(resolve(webRoot, "package.json"), "utf8"));
const globalCss = readFileSync(resolve(webRoot, "app/globals.css"), "utf8");
const fontBundle = readFileSync(resolve(webRoot, "font-bundle.ts"), "utf8");

describe("editorial font bundle", () => {
  it("pins both font families as local runtime dependencies", () => {
    expect(packageJson.dependencies["@fontsource/ibm-plex-sans-kr"]).toBe("5.3.0");
    expect(packageJson.dependencies["@fontsource/ibm-plex-mono"]).toBe("5.3.0");
  });

  it("loads every used weight locally and never calls a remote font service", () => {
    for (const weight of [400, 500, 600, 700]) {
      expect(fontBundle).toContain(`@fontsource/ibm-plex-sans-kr/${weight}.css`);
    }
    for (const weight of [400, 500, 600]) {
      expect(fontBundle).toContain(`@fontsource/ibm-plex-mono/${weight}.css`);
    }
    expect(`${fontBundle}\n${globalCss}`).not.toMatch(/fonts\.googleapis|use\.typekit|https?:\/\//);
  });
});
