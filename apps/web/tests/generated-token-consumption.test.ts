import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "..");
const generatedTokenCss = readFileSync(resolve(webRoot, "../../packages/design-tokens/dist/tokens.css"), "utf8");
const globalCss = readFileSync(resolve(webRoot, "app/globals.css"), "utf8");
const generatedNamespaces = ["color", "type", "space", "radius", "motion", "target"];

describe("generated design-token consumption", () => {
  it("defines every generated token referenced by the global stylesheet", () => {
    const definitions = new Set(Array.from(
      generatedTokenCss.matchAll(/(--gc-[A-Za-z0-9-]+)\s*:/g),
      (match) => match[1],
    ));
    const references = new Set(Array.from(
      globalCss.matchAll(/var\((--gc-[A-Za-z0-9-]+)/g),
      (match) => match[1],
    ).filter((token) => generatedNamespaces.some((namespace) => token.startsWith(`--gc-${namespace}-`))));
    const missing = Array.from(references).filter((token) => !definitions.has(token)).sort();

    expect(missing).toEqual([]);
  });
});
