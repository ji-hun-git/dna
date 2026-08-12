import { z } from "zod";
import { researchAgentQuerySchema } from "./contracts.ts";
import { runResearchEvidenceAgent } from "./evidence-agent.ts";
import { offlineResearchCatalog } from "./offline-catalog.ts";
import {
  evaluateRegisteredResearchUse,
  researchUseSchema,
  verifyRegisteredResearchResource,
} from "./rights-registry.server.ts";
import {
  mutateResearchResource,
  type SourceDriftMutation,
} from "./source-integrity.server.ts";

const retrievalCaseSchema = z.strictObject({
  caseId: z.string().regex(/^retrieval-[a-z0-9-]+$/),
  query: researchAgentQuerySchema,
  expectedResourceIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(10),
});

const rightsCaseSchema = z.strictObject({
  caseId: z.string().regex(/^rights-[a-z0-9-]+$/),
  resourceId: z.string().regex(/^[a-z0-9-]+$/),
  proposedUse: researchUseSchema,
  expectedDecision: z.enum(["allowed", "blocked"]),
});

const driftMutationSchema = z.enum([
  "none",
  "title",
  "doi",
  "license-class",
  "redistribution",
  "source-url",
  "quality-warning",
  "access-state",
  "data-type",
  "source-platform",
  "topic-codes",
]);

const driftCaseSchema = z.strictObject({
  caseId: z.string().regex(/^drift-[a-z0-9-]+$/),
  resourceId: z.string().regex(/^[a-z0-9-]+$/),
  mutation: driftMutationSchema,
  expectedBlocked: z.boolean(),
});

export const researchEvidenceEvaluationCorpusSchema = z.strictObject({
  schemaVersion: z.literal("research-evidence-evaluation-corpus.v1"),
  corpusId: z.string().regex(/^synthetic-research-[a-z0-9.-]+$/),
  syntheticOnly: z.literal(true),
  containsPersonalData: z.literal(false),
  retrievalCases: z.array(retrievalCaseSchema).min(9).max(100),
  rightsCases: z.array(rightsCaseSchema).min(12).max(100),
  driftCases: z.array(driftCaseSchema).min(11).max(100),
}).superRefine((corpus, context) => {
  const ids = [...corpus.retrievalCases, ...corpus.rightsCases, ...corpus.driftCases].map((item) => item.caseId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "evaluation case IDs must be unique" });
  if (ids.length < 30) context.addIssue({ code: "custom", message: "at least 30 evaluation cases are required" });
});

export const researchEvidenceGateThresholds = {
  retrievalExactRate: 1,
  rightsDecisionExactRate: 1,
  driftBlockRecall: 1,
  stableSourceAcceptanceRate: 1,
  unsafeAllowCount: 0,
} as const;

export const researchEvidenceEvaluationReportSchema = z.strictObject({
  schemaVersion: z.literal("research-evidence-evaluation.v1"),
  corpusId: z.string().regex(/^synthetic-research-[a-z0-9.-]+$/),
  metrics: z.strictObject({
    totalCaseCount: z.number().int().min(30).max(300),
    retrievalExactRate: z.number().min(0).max(1),
    rightsDecisionExactRate: z.number().min(0).max(1),
    driftBlockRecall: z.number().min(0).max(1),
    stableSourceAcceptanceRate: z.number().min(0).max(1),
    unsafeAllowCount: z.number().int().min(0).max(300),
  }),
  gate: z.strictObject({
    passed: z.boolean(),
    failures: z.array(z.string().regex(/^[a-z0-9_]+$/)).max(5),
    thresholds: z.strictObject({
      retrievalExactRate: z.literal(1),
      rightsDecisionExactRate: z.literal(1),
      driftBlockRecall: z.literal(1),
      stableSourceAcceptanceRate: z.literal(1),
      unsafeAllowCount: z.literal(0),
    }),
  }),
});

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 1 : numerator / denominator;
}

function findResource(resourceId: string) {
  const resource = offlineResearchCatalog.resources.find((candidate) => candidate.id === resourceId);
  if (!resource) throw new Error(`unknown research resource: ${resourceId}`);
  return resource;
}

export function evaluateResearchEvidenceAgent(corpusInput: unknown) {
  const corpus = researchEvidenceEvaluationCorpusSchema.parse(corpusInput);
  let retrievalExactCount = 0;
  let rightsExactCount = 0;
  let driftBlockedCount = 0;
  let driftExpectedBlockedCount = 0;
  let stableAcceptedCount = 0;
  let stableExpectedCount = 0;
  let unsafeAllowCount = 0;

  for (const evaluationCase of corpus.retrievalCases) {
    const actual = runResearchEvidenceAgent(evaluationCase.query).resources.map((item) => item.resource.id);
    if (JSON.stringify(actual) === JSON.stringify(evaluationCase.expectedResourceIds)) retrievalExactCount += 1;
  }

  for (const evaluationCase of corpus.rightsCases) {
    const actual = evaluateRegisteredResearchUse(findResource(evaluationCase.resourceId), evaluationCase.proposedUse).decision;
    if (actual === evaluationCase.expectedDecision) rightsExactCount += 1;
    if (evaluationCase.expectedDecision === "blocked" && actual === "allowed") unsafeAllowCount += 1;
  }

  for (const evaluationCase of corpus.driftCases) {
    const mutated = mutateResearchResource(findResource(evaluationCase.resourceId), evaluationCase.mutation as SourceDriftMutation);
    const actualBlocked = !verifyRegisteredResearchResource(mutated).trusted;
    if (evaluationCase.expectedBlocked) {
      driftExpectedBlockedCount += 1;
      if (actualBlocked) driftBlockedCount += 1;
      else unsafeAllowCount += 1;
    } else {
      stableExpectedCount += 1;
      if (!actualBlocked) stableAcceptedCount += 1;
    }
  }

  const metrics = {
    totalCaseCount: corpus.retrievalCases.length + corpus.rightsCases.length + corpus.driftCases.length,
    retrievalExactRate: ratio(retrievalExactCount, corpus.retrievalCases.length),
    rightsDecisionExactRate: ratio(rightsExactCount, corpus.rightsCases.length),
    driftBlockRecall: ratio(driftBlockedCount, driftExpectedBlockedCount),
    stableSourceAcceptanceRate: ratio(stableAcceptedCount, stableExpectedCount),
    unsafeAllowCount,
  };
  const failures: string[] = [];
  if (metrics.retrievalExactRate < researchEvidenceGateThresholds.retrievalExactRate) failures.push("retrieval_exact_rate_below_threshold");
  if (metrics.rightsDecisionExactRate < researchEvidenceGateThresholds.rightsDecisionExactRate) failures.push("rights_decision_exact_rate_below_threshold");
  if (metrics.driftBlockRecall < researchEvidenceGateThresholds.driftBlockRecall) failures.push("drift_block_recall_below_threshold");
  if (metrics.stableSourceAcceptanceRate < researchEvidenceGateThresholds.stableSourceAcceptanceRate) failures.push("stable_source_acceptance_rate_below_threshold");
  if (metrics.unsafeAllowCount > researchEvidenceGateThresholds.unsafeAllowCount) failures.push("unsafe_allow_count_above_threshold");

  return researchEvidenceEvaluationReportSchema.parse({
    schemaVersion: "research-evidence-evaluation.v1" as const,
    corpusId: corpus.corpusId,
    metrics,
    gate: { passed: failures.length === 0, failures, thresholds: researchEvidenceGateThresholds },
  });
}
