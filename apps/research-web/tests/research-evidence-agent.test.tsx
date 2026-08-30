import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it } from "vitest";
import { ResearchEvidenceAgent } from "@/components/research-data/ResearchEvidenceAgent";
import {
  researchAgentQuerySchema,
  researchResourceSchema,
} from "@/lib/research-data/contracts";
import { decideResearchRights, runResearchEvidenceAgent } from "@/lib/research-data/evidence-agent";
import { offlineResearchCatalog } from "@/lib/research-data/offline-catalog";
import { researchConnectorActivationSchema, researchSourceConnectors } from "@/lib/research-data/connectors";

afterEach(cleanup);

describe("research evidence agent contracts", () => {
  it("accepts only non-personal research discovery inputs", () => {
    expect(researchAgentQuerySchema.safeParse({
      schemaVersion: "research-evidence-query.v1",
      topicCode: "life-science-terminology",
      intent: "discover-resources",
      personalData: false,
      diagnosticUse: false,
    }).success).toBe(true);

    expect(researchAgentQuerySchema.safeParse({
      schemaVersion: "research-evidence-query.v1",
      topicCode: "life-science-terminology",
      intent: "discover-resources",
      personalData: true,
      diagnosticUse: false,
      patientSymptoms: "fever",
    }).success).toBe(false);
  });

  it("keeps the snapshot metadata-only and blocks unreviewed rights", () => {
    expect(offlineResearchCatalog.liveApiCalls).toBe(0);
    expect(offlineResearchCatalog.containsPersonalData).toBe(false);
    expect(offlineResearchCatalog.resources.every((resource) => resource.containsRawRecords === false)).toBe(true);

    const terminology = offlineResearchCatalog.resources.find((resource) => resource.id === "aida-life-science-terms");
    const infection = offlineResearchCatalog.resources.find((resource) => resource.id === "aida-infectious-disease-events");
    expect(terminology && decideResearchRights(terminology)).toBe("metadata-only");
    expect(infection && decideResearchRights(infection)).toBe("blocked-pending-rights-review");
    expect(researchResourceSchema.safeParse({ ...terminology, diagnosticUse: true }).success).toBe(false);
  });

  it("returns a deterministic provenance-first ranking without a diagnostic answer", () => {
    const result = runResearchEvidenceAgent({
      schemaVersion: "research-evidence-query.v1",
      topicCode: "biomedical-literature",
      intent: "compare-fitness",
      personalData: false,
      diagnosticUse: false,
    });
    expect(result.liveApiCalls).toBe(0);
    expect(result.boundary).toContain("진단");
    expect(result.resources.map((item) => item.resource.id)).toEqual([
      "aida-life-science-terms",
      "aida-infectious-disease-events",
      "aida-medibio-deberta",
      "dataon-research-data-api",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/patient|treatmentRecommendation|diagnosisCode/);
  });

  it("keeps both external connectors disabled until exact server-side approvals exist", () => {
    expect(researchSourceConnectors.every((connector) => connector.enabled === false)).toBe(true);
    expect(researchSourceConnectors.every((connector) => connector.fileDownloadAllowed === false)).toBe(true);
    expect(researchConnectorActivationSchema.safeParse({
      schemaVersion: "research-connector-activation.v1",
      source: "aida",
      mode: "metadata-only",
      serverSideOnly: true,
      termsReviewedAt: "2026-08-12",
      rightsRegisterId: "rights-aida-metadata-v1",
      secretVersionReference: "aws-secretsmanager://gc/research/aida?versionId=version-1",
      killSwitchEnabled: true,
      personalDataAllowed: false,
      fileDownloadAllowed: false,
    }).success).toBe(true);
    expect(researchConnectorActivationSchema.safeParse({
      schemaVersion: "research-connector-activation.v1",
      source: "aida",
      mode: "metadata-only",
      serverSideOnly: false,
      rawApiKey: "do-not-accept-inline-secrets",
      fileDownloadAllowed: true,
    }).success).toBe(false);
  });
});

it("renders the Korean research workflow and both competition gates accessibly", async () => {
  const user = userEvent.setup();
  const { container } = render(<ResearchEvidenceAgent />);

  expect(screen.getByRole("heading", { name: /찾는 것보다\s*쓸 수 있는지가\s*더 중요합니다/ })).toBeVisible();
  expect(screen.getByText("진단하지 않습니다")).toBeVisible();
  expect(screen.getByText("실시간 외부 API 호출 0건")).toBeVisible();
  expect(screen.getByText("2026.09.04")).toBeVisible();
  expect(screen.getByText("2026.08.31")).toBeVisible();
  expect(screen.getByText("참가자격 확인 필요")).toBeVisible();
  expect(screen.getByText("생명과학분야 전문용어 개체 인식 데이터셋")).toBeVisible();

  await user.click(screen.getByRole("button", { name: /감염병 사건/ }));
  expect(screen.getByText("해외 감염병 발생 이벤트 데이터셋")).toBeVisible();
  expect(screen.queryByText("생명과학분야 전문용어 개체 인식 데이터셋")).not.toBeInTheDocument();
  expect(await axe(container)).toHaveNoViolations();
});
