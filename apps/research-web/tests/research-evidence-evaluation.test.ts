import { describe, expect, it } from "vitest";
import corpus from "./fixtures/research-data/evidence-agent.corpus.json";
import { researchSourceSnapshotContracts } from "@/lib/research-data/source-contracts";
import { evaluateResearchEvidenceAgent, researchEvidenceEvaluationCorpusSchema } from "@/lib/research-data/evaluation";
import { offlineResearchCatalog } from "@/lib/research-data/offline-catalog";
import { auditResearchRightsRegistry, researchRightsRegistry, researchRightsRegistrySchema, verifyRegisteredResearchResource } from "@/lib/research-data/rights-registry.server";
import { mutateResearchResource } from "@/lib/research-data/source-integrity.server";

describe("research evidence reproducibility gate", () => {
  it("uses at least 30 strict synthetic cases with no personal data", () => {
    const parsed = researchEvidenceEvaluationCorpusSchema.parse(corpus);
    expect(parsed.containsPersonalData).toBe(false);
    expect(parsed.syntheticOnly).toBe(true);
    expect(parsed.retrievalCases.length + parsed.rightsCases.length + parsed.driftCases.length).toBeGreaterThanOrEqual(30);
    expect(researchEvidenceEvaluationCorpusSchema.safeParse({ ...corpus, patientRecord: "forbidden" }).success).toBe(false);
  });

  it("passes exact retrieval, rights, source-drift, and unsafe-use thresholds", () => {
    const report = evaluateResearchEvidenceAgent(corpus);
    expect(report.gate).toEqual(expect.objectContaining({ passed: true, failures: [] }));
    expect(report.metrics).toEqual(expect.objectContaining({
      totalCaseCount: 32,
      retrievalExactRate: 1,
      rightsDecisionExactRate: 1,
      driftBlockRecall: 1,
      stableSourceAcceptanceRate: 1,
      unsafeAllowCount: 0,
    }));
  });

  it("blocks every protected source-field mutation but accepts the reviewed snapshot", () => {
    expect(auditResearchRightsRegistry().every((entry) => entry.trusted)).toBe(true);
    const resource = offlineResearchCatalog.resources[0];
    expect(resource && verifyRegisteredResearchResource(resource).trusted).toBe(true);
    expect(resource && verifyRegisteredResearchResource(mutateResearchResource(resource, "license-class")).trusted).toBe(false);
    expect(resource && verifyRegisteredResearchResource(mutateResearchResource(resource, "source-url")).trusted).toBe(false);
  });

  it("requires unique rows and an explicit decision for every supported use", () => {
    expect(researchRightsRegistry.rows.map((row) => row.resourceId).toSorted()).toEqual(
      offlineResearchCatalog.resources.map((resource) => resource.id).toSorted(),
    );
    expect(researchRightsRegistry.rows.every((row) => new Set([...row.permittedUses, ...row.prohibitedUses]).size === 3)).toBe(true);
    expect(researchRightsRegistrySchema.safeParse({
      ...researchRightsRegistry,
      rows: [...researchRightsRegistry.rows, researchRightsRegistry.rows[0]],
    }).success).toBe(false);
  });

  it("truthfully records that provider wire payloads and API keys are not captured", () => {
    expect(researchSourceSnapshotContracts).toHaveLength(2);
    expect(researchSourceSnapshotContracts.every((contract) => contract.wireContractStatus === "pending-approved-key-capture")).toBe(true);
    expect(researchSourceSnapshotContracts.every((contract) => contract.wirePayloadCaptured === false && contract.apiKeyPresent === false)).toBe(true);
    expect(researchSourceSnapshotContracts.every((contract) => contract.fileDownloadIncluded === false && contract.liveApiCalls === 0)).toBe(true);
  });
});
