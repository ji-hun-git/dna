import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readiness = JSON.parse(await readFile(resolve(root, "release/readiness.json"), "utf8"));
const allowedStatuses = new Set(["PASS", "FAIL", "PARTIAL", "EXTERNAL_GATE", "DISABLED"]);
const failures = [];

if (readiness.schemaVersion !== "release-readiness.v1") {
  failures.push("unsupported readiness schema");
}
if (!Array.isArray(readiness.gates) || readiness.gates.length === 0) {
  failures.push("readiness gates are missing");
}

for (const gate of readiness.gates ?? []) {
  if (!allowedStatuses.has(gate.status)) failures.push("invalid status for " + gate.id);
  if (!gate.id || !gate.evidence) failures.push("gate is missing id or evidence");
}

const blockers = (readiness.gates ?? []).filter(
  (gate) => gate.blocking === true && gate.status !== "PASS",
);
if (blockers.length > 0 && readiness.verdict !== "NO_GO") {
  failures.push("verdict must be NO_GO while blocking gates remain");
}
if (blockers.length === 0 && readiness.verdict !== "GO") {
  failures.push("verdict must be GO when every blocking gate passes");
}

for (const gate of readiness.gates ?? []) {
  process.stdout.write(
    "release-readiness: " + gate.status + " " + gate.id + " — " + gate.evidence + "\n",
  );
}
for (const failure of failures) process.stderr.write("release-readiness: INVALID " + failure + "\n");

if (failures.length > 0) {
  process.exitCode = 2;
} else if (blockers.length > 0) {
  process.stderr.write(
    "release-readiness: NO_GO " + blockers.length + " blocking gate(s) are not PASS\n",
  );
  process.exitCode = 1;
} else {
  process.stdout.write("release-readiness: GO\n");
}
