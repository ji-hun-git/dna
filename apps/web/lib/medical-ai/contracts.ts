import { z } from "zod";

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const evidenceBoxSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).refine((box) => box.x + box.width <= 1 && box.y + box.height <= 1, {
  message: "evidence box must stay within the normalized page",
});

export const evidenceLocationSchema = z.strictObject({
  page: z.number().int().positive(),
  blockId: z.string().regex(/^block-[a-z0-9-]+$/),
  box: evidenceBoxSchema,
  sourceTextSha256: sha256Schema,
});

export const extractedMeasurementSchema = z.strictObject({
  semanticRole: z.literal("measurement"),
  fieldId: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(64),
  unit: z.string().min(1).max(32),
  observedAt: dateSchema,
  referenceRange: z.string().min(1).max(80).optional(),
  confidence: z.number().min(0).max(1),
  evidence: evidenceLocationSchema,
});

export const expectedMeasurementSchema = extractedMeasurementSchema.omit({ confidence: true });

export const extractionAbstentionSchema = z.strictObject({
  fieldId: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(80),
  reason: z.enum(["unreadable", "ambiguous_value", "ambiguous_unit", "missing_evidence"]),
  evidence: evidenceLocationSchema.optional(),
});

export const pinnedModelSchema = z.strictObject({
  modelId: z.string().min(1).max(120),
  artifactSha256: sha256Schema,
  executionMode: z.literal("offline-pinned"),
});

export const medicalDocumentRunSchema = z.strictObject({
  schemaVersion: z.literal("medical-document-run.v1"),
  pipelineId: z.string().regex(/^[a-z0-9.-]+$/),
  runId: z.string().regex(/^run-[a-z0-9-]+$/),
  documentId: z.string().regex(/^synthetic-[a-z0-9-]+$/),
  documentSha256: sha256Schema,
  documentType: z.enum(["health-screening-lab-report", "public-health-lab-report"]),
  language: z.literal("ko-KR"),
  synthetic: z.literal(true),
  createdAt: z.string().datetime({ offset: true }),
  models: z.strictObject({
    layout: pinnedModelSchema,
    semantic: pinnedModelSchema,
  }),
  candidates: z.array(extractedMeasurementSchema).max(100),
  abstentions: z.array(extractionAbstentionSchema).max(100),
}).superRefine((run, context) => {
  const ids = [...run.candidates.map((field) => field.fieldId), ...run.abstentions.map((field) => field.fieldId)];
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "candidate and abstention field IDs must be unique" });
  }
});

export const medicalDocumentGoldSchema = z.strictObject({
  documentId: z.string().regex(/^synthetic-[a-z0-9-]+$/),
  documentSha256: sha256Schema,
  documentType: z.enum(["health-screening-lab-report", "public-health-lab-report"]),
  language: z.literal("ko-KR"),
  synthetic: z.literal(true),
  expectedMeasurements: z.array(expectedMeasurementSchema).min(1).max(100),
  requiredAbstentions: z.array(z.strictObject({
    fieldId: z.string().regex(/^[a-z0-9-]+$/),
    label: z.string().min(1).max(80),
    acceptedReasons: z.array(extractionAbstentionSchema.shape.reason).min(1),
  })).max(100),
}).superRefine((document, context) => {
  const ids = [
    ...document.expectedMeasurements.map((field) => field.fieldId),
    ...document.requiredAbstentions.map((field) => field.fieldId),
  ];
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "gold measurement and abstention field IDs must be unique" });
  }
});

export const medicalDocumentCorpusSchema = z.strictObject({
  schemaVersion: z.literal("medical-document-corpus.v1"),
  corpusId: z.string().regex(/^synthetic-ko-[a-z0-9.-]+$/),
  description: z.string().min(1).max(240),
  syntheticOnly: z.literal(true),
  documents: z.array(medicalDocumentGoldSchema).min(1).max(500),
}).superRefine((corpus, context) => {
  const ids = corpus.documents.map((document) => document.documentId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "corpus document IDs must be unique" });
  }
});

export type MedicalDocumentCorpus = z.infer<typeof medicalDocumentCorpusSchema>;
export type MedicalDocumentRun = z.infer<typeof medicalDocumentRunSchema>;
