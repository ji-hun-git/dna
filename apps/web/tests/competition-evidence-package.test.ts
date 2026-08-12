import { describe, expect, it } from "vitest";
import corpus from "./fixtures/research-data/evidence-agent.corpus.json";
import {
  buildCompetitionEvidencePackage,
  serializeCompetitionEvidencePackage,
  verifyCompetitionEvidencePackage,
} from "@/lib/research-data/competition-evidence-package.server";

const input = {
  trackId: "dataon-aida-2026" as const,
  packageDate: "2026-08-12",
  evaluationCorpus: corpus,
  sampleQuery: {
    schemaVersion: "research-evidence-query.v1" as const,
    topicCode: "biomedical-literature" as const,
    intent: "compare-fitness" as const,
    personalData: false as const,
    diagnosticUse: false as const,
  },
};

describe("competition evidence package", () => {
  it("builds byte-stable, self-verifying evidence from only offline public metadata", () => {
    const first = buildCompetitionEvidencePackage(input);
    const second = buildCompetitionEvidencePackage(input);

    expect(first).toEqual(second);
    expect(serializeCompetitionEvidencePackage(first)).toBe(serializeCompetitionEvidencePackage(second));
    expect(verifyCompetitionEvidencePackage(first)).toBe(true);
    expect(first).toMatchObject({
      evidenceMode: "offline-public-metadata",
      containsPersonalData: false,
      containsRawRecords: false,
      liveApiCalls: 0,
      fileDownloads: 0,
    });
    expect(first.evaluation.gate).toEqual(expect.objectContaining({ passed: true, failures: [] }));
    expect(first.rightsAudit.every((entry) => entry.trusted)).toBe(true);
  });

  it("rejects tampering and contains no credential or patient payload fields", () => {
    const evidencePackage = buildCompetitionEvidencePackage(input);
    expect(verifyCompetitionEvidencePackage({ ...evidencePackage, packageDate: "2026-08-13" })).toBe(false);
    const serialized = JSON.stringify(evidencePackage);
    expect(serialized).not.toMatch(/"(?:client_secret|access_token|refresh_token|patient|residentRegistration)"\s*:/i);
    expect(serialized).not.toMatch(/"apiKeyPresent"\s*:\s*true|secretEnvironmentName|secretVersionReference/i);
  });
});
