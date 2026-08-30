import { z } from "zod";
import { offlineResearchCatalog } from "./offline-catalog.ts";
import { rightsDecisionSchema, type ResearchResource } from "./contracts.ts";
import { fingerprintResearchResource } from "./source-integrity.server.ts";

export const researchUseSchema = z.enum(["metadata-display", "source-file-download", "model-execution"]);
export type ResearchUse = z.infer<typeof researchUseSchema>;

const rightsRegistryRowSchema = z.strictObject({
  resourceId: z.string().regex(/^[a-z0-9-]+$/),
  expectedFingerprint: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  reuseDecision: rightsDecisionSchema,
  permittedUses: z.array(researchUseSchema).min(1).max(3),
  prohibitedUses: z.array(researchUseSchema).min(1).max(3),
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextReviewAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reviewerRole: z.literal("research-rights-reviewer"),
  termsUrl: z.string().url(),
  note: z.string().min(1).max(280),
}).superRefine((row, context) => {
  const uses = [...row.permittedUses, ...row.prohibitedUses];
  if (new Set(uses).size !== uses.length) context.addIssue({ code: "custom", message: "permitted and prohibited uses must be disjoint" });
  if (new Set(uses).size !== researchUseSchema.options.length) context.addIssue({ code: "custom", message: "every research use must be explicitly permitted or prohibited" });
  if (row.reuseDecision !== "research-prototype-only" && row.permittedUses.some((use) => use !== "metadata-display")) {
    context.addIssue({ code: "custom", message: "metadata-only or blocked rows may permit only metadata display" });
  }
});

export const researchRightsRegistrySchema = z.strictObject({
  schemaVersion: z.literal("research-rights-registry.v1"),
  registryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  defaultDecision: z.literal("blocked-pending-rights-review"),
  rows: z.array(rightsRegistryRowSchema).min(1).max(100),
}).superRefine((registry, context) => {
  const ids = registry.rows.map((row) => row.resourceId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "rights registry resource IDs must be unique" });
});

export const researchRightsRegistry = researchRightsRegistrySchema.parse({
  schemaVersion: "research-rights-registry.v1",
  registryDate: "2026-08-12",
  defaultDecision: "blocked-pending-rights-review",
  rows: [
    {
      resourceId: "aida-life-science-terms",
      expectedFingerprint: "sha256:526fd298bf3b933ce790fb1ca5f7bf5d1212429cbb4b3d1b40b35a3938d9cc37",
      reuseDecision: "metadata-only",
      permittedUses: ["metadata-display"],
      prohibitedUses: ["source-file-download", "model-execution"],
      reviewedAt: "2026-08-12",
      nextReviewAt: "2026-09-04",
      reviewerRole: "research-rights-reviewer",
      termsUrl: "https://aida.kisti.re.kr/data/95cc8200-c3b1-4c77-ab49-a311ad703ab9",
      note: "비영리·출처표기·재배포 금지이므로 공개 메타데이터 표시만 허용합니다.",
    },
    {
      resourceId: "aida-infectious-disease-events",
      expectedFingerprint: "sha256:03111a7004517b800d5810fa6be31687c7d7596739775213504d0fbbc27448db",
      reuseDecision: "blocked-pending-rights-review",
      permittedUses: ["metadata-display"],
      prohibitedUses: ["source-file-download", "model-execution"],
      reviewedAt: "2026-08-12",
      nextReviewAt: "2026-09-04",
      reviewerRole: "research-rights-reviewer",
      termsUrl: "https://aida.kisti.re.kr/data/913d6e64-10fa-4682-ac98-1879a83e7c88",
      note: "공개 상세 페이지에서 원문 재사용 범위를 확정하지 못해 메타데이터 외 사용을 차단합니다.",
    },
    {
      resourceId: "aida-medibio-deberta",
      expectedFingerprint: "sha256:f79cbfa553a01e666c92e0f3b1eee7d3b0001e1effe3ac538dd7777279b0feb0",
      reuseDecision: "blocked-pending-rights-review",
      permittedUses: ["metadata-display"],
      prohibitedUses: ["source-file-download", "model-execution"],
      reviewedAt: "2026-08-12",
      nextReviewAt: "2026-09-04",
      reviewerRole: "research-rights-reviewer",
      termsUrl: "https://aida.kisti.re.kr/model/052e095a-3573-4144-b687-52b19d66b5fc",
      note: "모델 라이선스와 독립 평가가 완료되기 전까지 가중치 다운로드와 실행을 차단합니다.",
    },
    {
      resourceId: "dataon-research-data-api",
      expectedFingerprint: "sha256:a5d9802c83be62f89b3ed2d9ee72c960ad208fe2b2da394f08447f8ac1d4ccc1",
      reuseDecision: "metadata-only",
      permittedUses: ["metadata-display"],
      prohibitedUses: ["source-file-download", "model-execution"],
      reviewedAt: "2026-08-12",
      nextReviewAt: "2026-09-04",
      reviewerRole: "research-rights-reviewer",
      termsUrl: "https://dataon.gitbook.io/dataon-user-guide/sharing/openapi/api",
      note: "승인된 검색·상세조회 계약만 대상으로 하며 원문 파일 사용은 포함하지 않습니다.",
    },
  ],
});

export function verifyRegisteredResearchResource(resource: ResearchResource) {
  const row = researchRightsRegistry.rows.find((candidate) => candidate.resourceId === resource.id);
  const actualFingerprint = fingerprintResearchResource(resource);
  if (!row) return { trusted: false, action: "block" as const, reason: "missing_registry_row", actualFingerprint };
  if (row.expectedFingerprint !== actualFingerprint) {
    return { trusted: false, action: "block" as const, reason: "source_fingerprint_changed", expectedFingerprint: row.expectedFingerprint, actualFingerprint };
  }
  return { trusted: true, action: "keep" as const, reason: "fingerprint_matches", expectedFingerprint: row.expectedFingerprint, actualFingerprint };
}

export function evaluateRegisteredResearchUse(resource: ResearchResource, proposedUse: ResearchUse) {
  const integrity = verifyRegisteredResearchResource(resource);
  if (!integrity.trusted) return { decision: "blocked" as const, reason: integrity.reason };
  const row = researchRightsRegistry.rows.find((candidate) => candidate.resourceId === resource.id);
  if (!row || row.prohibitedUses.includes(proposedUse) || !row.permittedUses.includes(proposedUse)) {
    return { decision: "blocked" as const, reason: "use_not_permitted" };
  }
  return { decision: "allowed" as const, reason: "registered_use_permitted" };
}

export function auditResearchRightsRegistry() {
  return offlineResearchCatalog.resources.map((resource) => ({ resourceId: resource.id, ...verifyRegisteredResearchResource(resource) }));
}
