import { expect, it } from "vitest";
import { offlineRunnerManifestSchema } from "@/lib/medical-ai/runner-contracts";
import {
  admitOfflineRunnerResult,
  createOfflineRunnerJob,
  runDeterministicFixtureAdapter,
} from "@/lib/medical-ai/offline-runner";
import manifest from "./fixtures/medical-ai/offline-runner.fixture-manifest.json";
import referenceRuns from "./fixtures/medical-ai/paddle-medgemma.reference-runs.json";

function fixtureJob() {
  return createOfflineRunnerJob({
    manifest,
    jobId: "job-checkup-001",
    document: {
      documentId: "synthetic-checkup-001",
      documentSha256: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      documentType: "health-screening-lab-report",
      mimeType: "application/pdf",
      byteLength: 48_120,
      inputHandle: "job-input:checkup-001",
    },
    outputHandle: "job-output:checkup-001",
    requestedAt: "2026-08-12T01:31:00+09:00",
    expiresAt: "2026-08-12T01:41:00+09:00",
  });
}

it("admits a digest-bound, network-free fixture result only as a human-confirmation candidate", () => {
  const job = fixtureJob();
  const result = runDeterministicFixtureAdapter({
    manifest,
    job,
    fixtureRun: referenceRuns[0],
    completedAt: "2026-08-12T01:32:00+09:00",
  });
  const admission = admitOfflineRunnerResult({ manifest, job, result });

  expect(admission).toMatchObject({
    status: "awaiting-human-confirmation",
    candidateCount: 3,
    abstentionCount: 1,
    executionBoundary: {
      networkMode: "none",
      inputMount: "read-only",
      outputMount: "write-only",
    },
  });
});

it("rejects latest tags, network access, extra environment variables, and oversized inputs", () => {
  expect(offlineRunnerManifestSchema.safeParse({ ...manifest, runnerImage: "local-fixture/medical-document-runner:latest" }).success).toBe(false);
  expect(offlineRunnerManifestSchema.safeParse({
    ...manifest,
    execution: { ...manifest.execution, networkMode: "bridge" },
  }).success).toBe(false);
  expect(offlineRunnerManifestSchema.safeParse({
    ...manifest,
    execution: { ...manifest.execution, environmentAllowlist: [...manifest.execution.environmentAllowlist, "HF_TOKEN"] },
  }).success).toBe(false);
  expect(() => createOfflineRunnerJob({
    manifest,
    jobId: "job-too-large",
    document: {
      documentId: "synthetic-checkup-001",
      documentSha256: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      documentType: "health-screening-lab-report",
      mimeType: "application/pdf",
      byteLength: manifest.execution.maxInputBytes + 1,
      inputHandle: "job-input:too-large",
    },
    outputHandle: "job-output:too-large",
    requestedAt: "2026-08-12T01:31:00+09:00",
    expiresAt: "2026-08-12T01:41:00+09:00",
  })).toThrow("input cap");
});

it("rejects model substitution, output mutation, expiry, and fixture execution under a production manifest", () => {
  const job = fixtureJob();
  const substitutedRun = structuredClone(referenceRuns[0]);
  substitutedRun.models.semantic.artifactSha256 = "sha256:9999999999999999999999999999999999999999999999999999999999999999";
  expect(() => runDeterministicFixtureAdapter({
    manifest,
    job,
    fixtureRun: substitutedRun,
    completedAt: "2026-08-12T01:32:00+09:00",
  })).toThrow("model artifacts");

  const result = runDeterministicFixtureAdapter({
    manifest,
    job,
    fixtureRun: referenceRuns[0],
    completedAt: "2026-08-12T01:32:00+09:00",
  });
  expect(() => admitOfflineRunnerResult({
    manifest,
    job,
    result: { ...result, outputSha256: "sha256:9999999999999999999999999999999999999999999999999999999999999999" },
  })).toThrow("output digest");
  expect(() => admitOfflineRunnerResult({
    manifest,
    job,
    result: { ...result, completedAt: "2026-08-12T01:42:00+09:00" },
  })).toThrow("outside the job window");
  expect(() => admitOfflineRunnerResult({
    manifest,
    job,
    result: { ...result, completedAt: "2026-08-12T01:30:59+09:00" },
  })).toThrow("outside the job window");
  expect(() => admitOfflineRunnerResult({
    manifest,
    job: { ...job, output: { ...job.output, maxBytes: job.output.maxBytes - 1 } },
    result,
  })).toThrow("job caps");
  expect(() => runDeterministicFixtureAdapter({
    manifest: { ...manifest, approvalStatus: "production-reviewed" },
    job,
    fixtureRun: referenceRuns[0],
    completedAt: "2026-08-12T01:32:00+09:00",
  })).toThrow("fixture adapter is forbidden");
});
