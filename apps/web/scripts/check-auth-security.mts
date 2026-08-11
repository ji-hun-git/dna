import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const roots = ["app", "components", "lib"].map((directory) => join(webRoot, directory));
const findings: Array<{ file: string; rule: string }> = [];
const rules = [
  { id: "AUTH-CLIENT-TOKEN-STORAGE", pattern: /(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|getItem)\s*\([^\n]*(?:token|jwt|session|auth|refresh)/i },
  { id: "AUTH-CREDENTIAL-LOGGING", pattern: /console\.(?:log|debug|info|warn)\s*\([^\n]*(?:authorization|cookie|access[_-]?token|refresh[_-]?token|client[_-]?secret)/i },
  { id: "AUTH-PUBLIC-SECRET", pattern: /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY)/ },
  { id: "AUTH-WILDCARD-CORS", pattern: /Access-Control-Allow-Origin[^\n]*["'`]\*["'`]/i },
  { id: "AUTH-UNSAFE-HTML", pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=/ },
] as const;

const providerHosts = /\b(?:kauth\.kakao\.com|kapi\.kakao\.com|nid\.naver\.com|openapi\.naver\.com)\b/;
const providerRegistry = "lib/auth/provider-contracts.ts";

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return files.flat();
}

for (const root of roots) {
  for (const file of await walk(root)) {
    if (![".ts", ".tsx", ".mts"].includes(extname(file))) continue;
    const source = await readFile(file, "utf8");
    const displayPath = relative(webRoot, file).replaceAll("\\", "/");
    for (const rule of rules) {
      if (rule.pattern.test(source)) findings.push({ file: displayPath, rule: rule.id });
    }
    if (displayPath !== providerRegistry && providerHosts.test(source)) {
      findings.push({ file: displayPath, rule: "AUTH-BYPASS-PROVIDER-REGISTRY" });
    }
    if (source.startsWith('"use client"') && /process\.env/.test(source)) {
      findings.push({ file: displayPath, rule: "AUTH-CLIENT-ENV" });
    }
  }
}

if (findings.length > 0) {
  for (const finding of findings) process.stderr.write(`${finding.rule} ${finding.file}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("auth-security-gate: PASS\n");
}
