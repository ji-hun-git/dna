import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

async function readText(path) {
  return (await readFile(resolve(root, path), "utf8")).trim();
}

const [policy, rootPackage, webPackage, nodeVersion, nvmVersion] = await Promise.all([
  readJson("supply-chain/dependency-security-policy.json"),
  readJson("package.json"),
  readJson("apps/web/package.json"),
  readText(".node-version"),
  readText(".nvmrc"),
]);

const failures = [];
const expectedNode = policy.runtime.node.exactVersion;
const expectedPnpm = policy.packageManager.exactVersion;
const expectedNext = policy.frameworks.next.exactVersion;

function requireEqual(label, actual, expected) {
  if (actual !== expected) failures.push(`${label}: expected ${expected}, received ${actual ?? "missing"}`);
}

requireEqual("running Node", process.versions.node, expectedNode);
requireEqual("package engines.node", rootPackage.engines?.node, expectedNode);
requireEqual("package engines.pnpm", rootPackage.engines?.pnpm, expectedPnpm);
requireEqual(".node-version", nodeVersion, expectedNode);
requireEqual(".nvmrc", nvmVersion, expectedNode);
requireEqual("web Next.js", webPackage.dependencies?.next, expectedNext);

const packageManagerVersion = String(rootPackage.packageManager ?? "").match(/^pnpm@([^+]+)/)?.[1];
requireEqual("packageManager pnpm", packageManagerVersion, expectedPnpm);

if (process.argv.includes("--release")) {
  if (policy.runtime.productionImage.status !== "PRODUCTION_VERIFIED") {
    failures.push("production runtime image is not PRODUCTION_VERIFIED");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(policy.runtime.productionImage.digest ?? "")) {
    failures.push("production runtime image digest is absent or invalid");
  }
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`runtime-policy: FAIL ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`runtime-policy: PASS node=${expectedNode} pnpm=${expectedPnpm} next=${expectedNext}\n`);
}
