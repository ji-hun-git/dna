import { readFile } from "node:fs/promises";
import {
  admitOfflineRunnerResult,
  createOfflineRunnerJob,
  runDeterministicFixtureAdapter,
} from "../lib/medical-ai/offline-runner.ts";

const [manifest, runs] = await Promise.all([
  readFile("tests/fixtures/medical-ai/offline-runner.fixture-manifest.json", "utf8").then(JSON.parse),
  readFile("tests/fixtures/medical-ai/paddle-medgemma.reference-runs.json", "utf8").then(JSON.parse),
]);

const job = createOfflineRunnerJob({
  manifest,
  jobId: "job-checkup-cli-001",
  document: {
    documentId: "synthetic-checkup-001",
    documentSha256: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    documentType: "health-screening-lab-report",
    mimeType: "application/pdf",
    byteLength: 48_120,
    inputHandle: "job-input:checkup-cli-001",
  },
  outputHandle: "job-output:checkup-cli-001",
  requestedAt: "2026-08-12T01:31:00+09:00",
  expiresAt: "2026-08-12T01:41:00+09:00",
});
const result = runDeterministicFixtureAdapter({
  manifest,
  job,
  fixtureRun: runs[0],
  completedAt: "2026-08-12T01:32:00+09:00",
});
const admission = admitOfflineRunnerResult({ manifest, job, result });

process.stdout.write(`${JSON.stringify({ job, result, admission }, null, 2)}\n`);
