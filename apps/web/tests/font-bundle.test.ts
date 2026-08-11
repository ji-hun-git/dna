import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(resolve(webRoot, "package.json"), "utf8"));
const globalCss = readFileSync(resolve(webRoot, "app/globals.css"), "utf8");
const fontBundle = readFileSync(resolve(webRoot, "font-bundle.ts"), "utf8");

describe("health product font bundle", () => {
  it("pins the Korean variable UI face and numeric mono as local dependencies", () => {
    expect(packageJson.dependencies.pretendard).toBe("1.3.9");
    expect(packageJson.dependencies["@fontsource/ibm-plex-mono"]).toBe("5.3.0");
  });

  it("loads the complete variable range locally and never calls a remote font service", () => {
    expect(fontBundle).toContain("pretendard/dist/web/variable/pretendardvariable.css");
    expect(fontBundle).not.toContain("@fontsource/ibm-plex-sans-kr");
    for (const weight of [400, 500, 600]) {
      expect(fontBundle).toContain(`@fontsource/ibm-plex-mono/${weight}.css`);
    }
    expect(`${fontBundle}\n${globalCss}`).not.toMatch(/fonts\.googleapis|use\.typekit|https?:\/\//);
  });
});
