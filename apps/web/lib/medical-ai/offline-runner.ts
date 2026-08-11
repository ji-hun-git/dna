import { createHash } from "node:crypto";
import {
  offlineRunnerJobSchema,
  offlineRunnerManifestSchema,
  offlineRunnerResultSchema,
  type OfflineRunnerJob,
  type OfflineRunnerManifest,
  type OfflineRunnerResult,
} from "./runner-contracts.ts";
import { medicalDocumentRunSchema, type MedicalDocumentRun } from "./contracts.ts";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

export function sha256Of(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function createOfflineRunnerJob(args: {
  manifest: unknown;
  jobId: string;
  document: {
    documentId: string;
    documentSha256: string;
    documentType: "health-screening-lab-report" | "public-health-lab-report";
    mimeType: "application/pdf" | "image/png" | "image/jpeg";
    byteLength: number;
    inputHandle: string;
  };
  outputHandle: string;
  requestedAt: string;
  expiresAt: string;
}): OfflineRunnerJob {
  const manifest = offlineRunnerManifestSchema.parse(args.manifest);
  if (args.document.byteLength > manifest.execution.maxInputBytes) throw new Error("document exceeds pinned runner input cap");

  return offlineRunnerJobSchema.parse({
    schemaVersion: "medical-document-runner-job.v1",
    jobId: args.jobId,
    manifestSha256: sha256Of(manifest),
    input: {
      ...args.document,
      language: "ko-KR",
      synthetic: true,
    },
    output: {
      outputHandle: args.outputHandle,
      maxBytes: manifest.execution.maxOutputBytes,
    },
    requestedAt: args.requestedAt,
    expiresAt: args.expiresAt,
  });
}

function assertRunMatchesManifest(manifest: OfflineRunnerManifest, job: OfflineRunnerJob, run: MedicalDocumentRun) {
  if (run.pipelineId !== manifest.pipelineId) throw new Error("run pipeline does not match manifest");
  if (run.models.layout.modelId !== manifest.models.layout.modelId
    || run.models.layout.artifactSha256 !== manifest.models.layout.artifactSha256
    || run.models.semantic.modelId !== manifest.models.semantic.modelId
    || run.models.semantic.artifactSha256 !== manifest.models.semantic.artifactSha256) {
    throw new Error("run model artifacts do not match manifest");
  }
  if (run.documentId !== job.input.documentId
    || run.documentSha256 !== job.input.documentSha256
    || run.documentType !== job.input.documentType
    || run.language !== job.input.language
    || run.synthetic !== job.input.synthetic) {
    throw new Error("run document binding does not match job");
  }
}

export function runDeterministicFixtureAdapter(args: {
  manifest: unknown;
  job: unknown;
  fixtureRun: unknown;
  completedAt: string;
}): OfflineRunnerResult {
  const manifest = offlineRunnerManifestSchema.parse(args.manifest);
  const job = offlineRunnerJobSchema.parse(args.job);
  const run = medicalDocumentRunSchema.parse(args.fixtureRun);
  if (manifest.approvalStatus !== "fixture-only") throw new Error("fixture adapter is forbidden for production-reviewed manifests");
  if (job.manifestSha256 !== sha256Of(manifest)) throw new Error("job manifest digest mismatch");
  if (job.input.byteLength > manifest.execution.maxInputBytes
    || job.output.maxBytes !== manifest.execution.maxOutputBytes) {
    throw new Error("runner job caps do not match manifest");
  }
  assertRunMatchesManifest(manifest, job, run);
  if (Buffer.byteLength(canonicalJson(run), "utf8") > job.output.maxBytes) {
    throw new Error("runner output exceeds pinned cap");
  }

  return offlineRunnerResultSchema.parse({
    schemaVersion: "medical-document-runner-result.v1",
    jobId: job.jobId,
    manifestSha256: job.manifestSha256,
    requestSha256: sha256Of(job),
    outputSha256: sha256Of(run),
    completedAt: args.completedAt,
    run,
  });
}

export function admitOfflineRunnerResult(args: {
  manifest: unknown;
  job: unknown;
  result: unknown;
}) {
  const manifest = offlineRunnerManifestSchema.parse(args.manifest);
  const job = offlineRunnerJobSchema.parse(args.job);
  const result = offlineRunnerResultSchema.parse(args.result);

  if (manifest.evaluationApproval.approvedFor !== "candidate-only") throw new Error("pipeline is not approved for candidate extraction");
  if (job.manifestSha256 !== sha256Of(manifest) || result.manifestSha256 !== job.manifestSha256) {
    throw new Error("manifest binding mismatch");
  }
  if (job.input.byteLength > manifest.execution.maxInputBytes
    || job.output.maxBytes !== manifest.execution.maxOutputBytes) {
    throw new Error("runner job caps do not match manifest");
  }
  if (result.jobId !== job.jobId || result.requestSha256 !== sha256Of(job)) throw new Error("runner request binding mismatch");
  if (result.outputSha256 !== sha256Of(result.run)) throw new Error("runner output digest mismatch");
  if (Buffer.byteLength(canonicalJson(result.run), "utf8") > job.output.maxBytes) {
    throw new Error("runner output exceeds pinned cap");
  }
  if (Date.parse(result.completedAt) < Date.parse(job.requestedAt)
    || Date.parse(result.completedAt) > Date.parse(job.expiresAt)) {
    throw new Error("runner result completed outside the job window");
  }
  if (result.run.candidates.length === 0 && result.run.abstentions.length === 0) throw new Error("empty runner result is not admissible");
  assertRunMatchesManifest(manifest, job, result.run);

  return {
    schemaVersion: "medical-document-candidate-admission.v1" as const,
    status: "awaiting-human-confirmation" as const,
    jobId: job.jobId,
    pipelineId: manifest.pipelineId,
    manifestSha256: job.manifestSha256,
    outputSha256: result.outputSha256,
    candidateCount: result.run.candidates.length,
    abstentionCount: result.run.abstentions.length,
    executionBoundary: {
      networkMode: manifest.execution.networkMode,
      inputMount: manifest.execution.inputMount,
      outputMount: manifest.execution.outputMount,
    },
  };
}
