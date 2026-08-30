import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  competitionTrackSchema,
  researchAgentQuerySchema,
  researchAgentResultSchema,
  researchCatalogSchema,
} from "./contracts.ts";
import { runResearchEvidenceAgent } from "./evidence-agent.ts";
import {
  evaluateResearchEvidenceAgent,
  researchEvidenceEvaluationReportSchema,
} from "./evaluation.ts";
import { competitionTracks, offlineResearchCatalog } from "./offline-catalog.ts";
import {
  auditResearchRightsRegistry,
  researchRightsRegistry,
  researchRightsRegistrySchema,
} from "./rights-registry.server.ts";
import {
  researchSourceSnapshotContractSchema,
  researchSourceSnapshotContracts,
} from "./source-contracts.ts";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);

const packageCoreSchema = z.strictObject({
  schemaVersion: z.literal("competition-evidence-package.v1"),
  packageDate: isoDateSchema,
  track: competitionTrackSchema,
  evidenceMode: z.literal("offline-public-metadata"),
  containsPersonalData: z.literal(false),
  containsRawRecords: z.literal(false),
  liveApiCalls: z.literal(0),
  fileDownloads: z.literal(0),
  catalog: researchCatalogSchema,
  sourceContracts: z.array(researchSourceSnapshotContractSchema).length(2),
  rightsRegistry: researchRightsRegistrySchema,
  rightsAudit: z.array(z.strictObject({
    resourceId: z.string().regex(/^[a-z0-9-]+$/),
    trusted: z.literal(true),
    action: z.literal("keep"),
    reason: z.literal("fingerprint_matches"),
    expectedFingerprint: sha256Schema,
    actualFingerprint: sha256Schema,
  })).min(1).max(100),
  evaluation: researchEvidenceEvaluationReportSchema,
  sampleQuery: researchAgentQuerySchema,
  sampleResult: researchAgentResultSchema,
  notices: z.tuple([
    z.literal("공개 메타데이터와 합성 평가 결과만 포함합니다."),
    z.literal("원문 파일, 모델 가중치, API 키, 개인정보, 건강정보는 포함하지 않습니다."),
    z.literal("진단·치료·개인 건강 조언 또는 공모전 제출 자격을 보증하지 않습니다."),
  ]),
});

export const competitionEvidencePackageSchema = packageCoreSchema.extend({
  packageSha256: sha256Schema,
});

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .toSorted(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown) {
  return `sha256:${createHash("sha256").update(canonicalize(value), "utf8").digest("hex")}` as const;
}

function equalDigest(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function buildCompetitionEvidencePackage(input: {
  trackId: z.input<typeof competitionTrackSchema>["id"];
  packageDate: string;
  evaluationCorpus: unknown;
  sampleQuery: z.input<typeof researchAgentQuerySchema>;
}) {
  const track = competitionTracks.find((candidate) => candidate.id === input.trackId);
  if (!track) throw new Error(`unknown competition track: ${input.trackId}`);
  const evaluation = evaluateResearchEvidenceAgent(input.evaluationCorpus);
  if (!evaluation.gate.passed) throw new Error("research evidence evaluation gate did not pass");

  const core = packageCoreSchema.parse({
    schemaVersion: "competition-evidence-package.v1",
    packageDate: input.packageDate,
    track,
    evidenceMode: "offline-public-metadata",
    containsPersonalData: false,
    containsRawRecords: false,
    liveApiCalls: 0,
    fileDownloads: 0,
    catalog: offlineResearchCatalog,
    sourceContracts: researchSourceSnapshotContracts,
    rightsRegistry: researchRightsRegistry,
    rightsAudit: auditResearchRightsRegistry(),
    evaluation,
    sampleQuery: input.sampleQuery,
    sampleResult: runResearchEvidenceAgent(researchAgentQuerySchema.parse(input.sampleQuery)),
    notices: [
      "공개 메타데이터와 합성 평가 결과만 포함합니다.",
      "원문 파일, 모델 가중치, API 키, 개인정보, 건강정보는 포함하지 않습니다.",
      "진단·치료·개인 건강 조언 또는 공모전 제출 자격을 보증하지 않습니다.",
    ],
  });

  return competitionEvidencePackageSchema.parse({ ...core, packageSha256: digest(core) });
}

export function verifyCompetitionEvidencePackage(input: unknown) {
  const parsed = competitionEvidencePackageSchema.parse(input);
  const { packageSha256, ...core } = parsed;
  return equalDigest(packageSha256, digest(packageCoreSchema.parse(core)));
}

export function serializeCompetitionEvidencePackage(input: unknown) {
  const parsed = competitionEvidencePackageSchema.parse(input);
  if (!verifyCompetitionEvidencePackage(parsed)) throw new Error("competition evidence package digest mismatch");
  return `${JSON.stringify(parsed, null, 2)}\n`;
}
