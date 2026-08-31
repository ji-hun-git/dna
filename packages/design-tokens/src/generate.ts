import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceBytes = readFileSync(resolve(root, "tokens.json"));
const tokens = JSON.parse(sourceBytes.toString("utf8"));
const flatten = (value: unknown, path: string[] = []): Array<[string, string]> =>
  Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
    typeof item === "object" ? flatten(item, [...path, key]) : [[[...path, key].join("-"), String(item)]],
  );
const entries = flatten(tokens);
const css = `:root {\n${entries.map(([k,v]) => `  --gc-${k}: ${v};`).join("\n")}\n}\n`;
const dartName = (key: string) => key.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const dart = `abstract final class GcTokens {\n${entries.map(([k,v]) => `  static const String ${dartName(k)} = '${v}';`).join("\n")}\n}\n`;
mkdirSync(resolve(root, "dist"), { recursive: true });
writeFileSync(resolve(root, "dist/tokens.css"), css);
writeFileSync(resolve(root, "dist/tokens.dart"), dart);
const sha256 = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const manifest = {
  schemaVersion: "design-token-manifest.v1",
  sourceSha256: sha256(sourceBytes),
  outputs: { "tokens.css": sha256(css), "tokens.dart": sha256(dart) },
};
writeFileSync(resolve(root, "dist/tokens.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
