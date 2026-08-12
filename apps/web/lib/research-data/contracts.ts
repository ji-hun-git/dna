import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const researchTopicSchema = z.enum([
  "life-science-terminology",
  "infectious-disease-events",
  "biomedical-literature",
]);

export const researchResourceSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  resourceKind: z.enum(["dataset", "model", "catalog"]),
  sourcePlatform: z.enum(["aida", "dataon"]),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(360),
  topicCodes: z.array(researchTopicSchema).min(1).max(3),
  language: z.enum(["ko", "en", "ko-en", "not-applicable"]),
  dataType: z.enum(["json", "model-weights", "metadata-api"]),
  sourceUrl: z.string().url(),
  doi: z.string().regex(/^10\.23057\/\d+$/).optional(),
  publishedAt: isoDateSchema.optional(),
  retrievedAt: isoDateSchema,
  accessState: z.enum([
    "public-metadata",
    "account-approval-required",
    "api-and-ip-approval-required",
  ]),
  licenseClass: z.enum([
    "noncommercial-attribution-no-redistribution",
    "research-use-review-required",
    "metadata-api-approval-required",
    "model-license-review-required",
  ]),
  redistribution: z.enum(["prohibited", "metadata-only", "unknown"]),
  qualityWarnings: z.array(z.string().min(1).max(220)).min(1).max(5),
  containsRawRecords: z.literal(false),
  diagnosticUse: z.literal(false),
});

export const researchCatalogSchema = z.strictObject({
  schemaVersion: z.literal("research-metadata-catalog.v1"),
  snapshotDate: isoDateSchema,
  liveApiCalls: z.literal(0),
  containsPersonalData: z.literal(false),
  resources: z.array(researchResourceSchema).min(1).max(50),
});

export const researchAgentQuerySchema = z.strictObject({
  schemaVersion: z.literal("research-evidence-query.v1"),
  topicCode: researchTopicSchema,
  intent: z.enum(["discover-resources", "compare-fitness", "identify-data-gaps"]),
  personalData: z.literal(false),
  diagnosticUse: z.literal(false),
});

export const rightsDecisionSchema = z.enum([
  "metadata-only",
  "research-prototype-only",
  "blocked-pending-rights-review",
]);

export const rankedResearchResourceSchema = z.strictObject({
  resource: researchResourceSchema,
  score: z.number().int().min(0).max(100),
  rightsDecision: rightsDecisionSchema,
  reasons: z.array(z.string().min(1).max(140)).min(1).max(4),
});

export const researchAgentResultSchema = z.strictObject({
  schemaVersion: z.literal("research-evidence-result.v1"),
  generatedFrom: z.literal("offline-public-metadata"),
  liveApiCalls: z.literal(0),
  query: researchAgentQuerySchema,
  resources: z.array(rankedResearchResourceSchema).max(50),
  abstained: z.boolean(),
  boundary: z.literal("연구자료 탐색 전용 · 진단, 치료, 개인별 건강 조언 아님"),
});

export const competitionTrackSchema = z.strictObject({
  id: z.enum(["dataon-aida-2026", "daejeon-public-data-2026"]),
  title: z.string().min(1).max(100),
  organizer: z.string().min(1).max(160),
  submissionDeadline: isoDateSchema,
  proposedEntry: z.string().min(1).max(180),
  readiness: z.enum(["building", "blocked-on-eligibility"]),
  hardGate: z.string().min(1).max(240),
});

export type ResearchAgentQuery = z.infer<typeof researchAgentQuerySchema>;
export type ResearchResource = z.infer<typeof researchResourceSchema>;
export type RightsDecision = z.infer<typeof rightsDecisionSchema>;
