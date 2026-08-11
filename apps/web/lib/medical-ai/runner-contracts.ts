import { z } from "zod";
import { medicalDocumentRunSchema, pinnedModelSchema } from "./contracts.ts";

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const offlineRunnerManifestSchema = z.strictObject({
  schemaVersion: z.literal("medical-document-runner-manifest.v1"),
  manifestId: z.string().regex(/^runner-[a-z0-9.-]+$/),
  pipelineId: z.string().regex(/^[a-z0-9.-]+$/),
  approvalStatus: z.enum(["fixture-only", "production-reviewed"]),
  runnerImage: z.string().regex(/^[a-z0-9./-]+@sha256:[0-9a-f]{64}$/),
  models: z.strictObject({
    layout: pinnedModelSchema,
    semantic: pinnedModelSchema,
  }),
  execution: z.strictObject({
    networkMode: z.literal("none"),
    inputMount: z.literal("read-only"),
    outputMount: z.literal("write-only"),
    environmentAllowlist: z.tuple([
      z.literal("GC_JOB_ID"),
      z.literal("GC_INPUT_HANDLE"),
      z.literal("GC_OUTPUT_HANDLE"),
    ]),
    maxInputBytes: z.number().int().positive().max(20 * 1024 * 1024),
    maxOutputBytes: z.number().int().positive().max(2 * 1024 * 1024),
    maxRuntimeSeconds: z.number().int().positive().max(900),
  }),
  evaluationApproval: z.strictObject({
    schemaVersion: z.literal("medical-document-evaluation-approval.v1"),
    corpusId: z.string().regex(/^synthetic-ko-[a-z0-9.-]+$/),
    reportSha256: sha256Schema,
    approvedFor: z.literal("candidate-only"),
    approvedAt: z.string().datetime({ offset: true }),
  }),
  outputPolicy: z.strictObject({
    measurements: z.literal("candidate-only"),
    diagnoses: z.literal("forbidden"),
    normality: z.literal("forbidden"),
    treatmentRecommendations: z.literal("forbidden"),
    patientManagement: z.literal("forbidden"),
  }),
});

export const offlineRunnerJobSchema = z.strictObject({
  schemaVersion: z.literal("medical-document-runner-job.v1"),
  jobId: z.string().regex(/^job-[a-z0-9-]+$/),
  manifestSha256: sha256Schema,
  input: z.strictObject({
    documentId: z.string().regex(/^synthetic-[a-z0-9-]+$/),
    documentSha256: sha256Schema,
    documentType: z.enum(["health-screening-lab-report", "public-health-lab-report"]),
    language: z.literal("ko-KR"),
    mimeType: z.enum(["application/pdf", "image/png", "image/jpeg"]),
    byteLength: z.number().int().positive(),
    inputHandle: z.string().regex(/^job-input:[a-z0-9-]+$/),
    synthetic: z.literal(true),
  }),
  output: z.strictObject({
    outputHandle: z.string().regex(/^job-output:[a-z0-9-]+$/),
    maxBytes: z.number().int().positive(),
  }),
  requestedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
}).superRefine((job, context) => {
  const requestedAt = Date.parse(job.requestedAt);
  const expiresAt = Date.parse(job.expiresAt);
  if (expiresAt <= requestedAt || expiresAt - requestedAt > 15 * 60 * 1000) {
    context.addIssue({ code: "custom", message: "runner job expiry must be within 15 minutes" });
  }
});

export const offlineRunnerResultSchema = z.strictObject({
  schemaVersion: z.literal("medical-document-runner-result.v1"),
  jobId: z.string().regex(/^job-[a-z0-9-]+$/),
  manifestSha256: sha256Schema,
  requestSha256: sha256Schema,
  outputSha256: sha256Schema,
  completedAt: z.string().datetime({ offset: true }),
  run: medicalDocumentRunSchema,
});

export type OfflineRunnerManifest = z.infer<typeof offlineRunnerManifestSchema>;
export type OfflineRunnerJob = z.infer<typeof offlineRunnerJobSchema>;
export type OfflineRunnerResult = z.infer<typeof offlineRunnerResultSchema>;
