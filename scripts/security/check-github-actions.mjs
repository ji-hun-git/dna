import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workflowPath = resolve(root, ".github/workflows/ci.yml");
const workflow = await readFile(workflowPath, "utf8");
const failures = [];

if (!/^permissions:\s*\{\}\s*$/m.test(workflow)) {
  failures.push("top-level permissions must default to empty");
}
if (/\bpull_request_target\s*:/m.test(workflow)) {
  failures.push("pull_request_target is prohibited for untrusted repository code");
}

for (const [index, line] of workflow.split(/\r?\n/).entries()) {
  const match = line.match(/^\s*uses:\s*([^\s#]+)(?:\s+#\s*(.+))?$/);
  if (!match) continue;
  const reference = match[1];
  const annotation = match[2] ?? "";
  if (reference.startsWith("./")) continue;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}$/.test(reference)) {
    failures.push(`line ${index + 1}: remote action is not pinned to a full commit SHA`);
  }
  if (!/\bv\d/.test(annotation)) {
    failures.push(`line ${index + 1}: pinned action lacks a human-readable version annotation`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`github-actions-policy: FAIL ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("github-actions-policy: PASS\n");
}
