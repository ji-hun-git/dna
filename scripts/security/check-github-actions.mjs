import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const failures = [];
const workflowDirectory = resolve(root, ".github/workflows");
const workflowNames = (await readdir(workflowDirectory))
  .filter((name) => /\.ya?ml$/.test(name))
  .sort();

for (const workflowName of workflowNames) {
  const workflow = await readFile(resolve(workflowDirectory, workflowName), "utf8");
  if (!/^permissions:\s*\{\}\s*$/m.test(workflow)) {
    failures.push(`${workflowName}: top-level permissions must default to empty`);
  }
  if (/\bpull_request_target\s*:/m.test(workflow)) {
    failures.push(`${workflowName}: pull_request_target is prohibited for untrusted repository code`);
  }

  for (const [index, line] of workflow.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*uses:\s*([^\s#]+)(?:\s+#\s*(.+))?$/);
    if (!match) continue;
    const reference = match[1];
    const annotation = match[2] ?? "";
    if (reference.startsWith("./")) continue;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}$/.test(reference)) {
      failures.push(
        `${workflowName} line ${index + 1}: remote action is not pinned to a full commit SHA`,
      );
    }
    if (!/\bv\d/.test(annotation)) {
      failures.push(
        `${workflowName} line ${index + 1}: pinned action lacks a human-readable version annotation`,
      );
    }
  }
}

const releaseWorkflowName = "publish-runtime-images.yml";
const releaseWorkflow = await readFile(resolve(workflowDirectory, releaseWorkflowName), "utf8");
const releaseRequirements = [
  [/^\s{4}environment:\s*synthetic-staging-registry\s*$/m, "protected environment is required"],
  [/^\s{6}actions:\s*read\s*$/m, "Actions read permission is required for exact-revision CI verification"],
  [/^\s{6}artifact-metadata:\s*write\s*$/m, "artifact metadata write permission is required"],
  [/^\s{6}attestations:\s*write\s*$/m, "attestation write permission is required"],
  [/^\s{6}id-token:\s*write\s*$/m, "OIDC permission is required"],
  [/^\s{6}packages:\s*write\s*$/m, "package write permission is required"],
  [/github\.ref == 'refs\/heads\/main'/, "publication must be restricted to main"],
  [/persist-credentials:\s*false/, "privileged checkout must not persist credentials"],
  [/source_sha must equal the current main revision/, "publication must bind source_sha to main HEAD"],
  [/no successful main push CI run/, "publication must require prior exact-revision CI"],
  [/cosign sign --yes/, "image signature generation is required"],
  [/cosign verify/, "image signature verification is required"],
  [/https:\/\/slsa\.dev\/provenance\/v1/, "SLSA provenance verification is required"],
  [/https:\/\/cyclonedx\.org\/bom/, "CycloneDX attestation verification is required"],
];

for (const [pattern, message] of releaseRequirements) {
  if (!pattern.test(releaseWorkflow)) failures.push(`${releaseWorkflowName}: ${message}`);
}

if ((releaseWorkflow.match(/push-to-registry:\s*true/g) ?? []).length !== 2) {
  failures.push(`${releaseWorkflowName}: exactly two signed OCI attestations must be published`);
}
if (/\b(?:latest|master)\b/.test(releaseWorkflow.match(/^\s*tags:\s*.*$/m)?.[0] ?? "")) {
  failures.push(`${releaseWorkflowName}: mutable release tags are prohibited`);
}
for (const secretReference of releaseWorkflow.matchAll(/secrets\.([A-Za-z0-9_]+)/g)) {
  if (secretReference[1] !== "GITHUB_TOKEN") {
    failures.push(`${releaseWorkflowName}: long-lived repository secrets are prohibited`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`github-actions-policy: FAIL ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("github-actions-policy: PASS\n");
}
