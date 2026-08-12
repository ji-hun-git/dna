import {
  rankedResearchResourceSchema,
  researchAgentQuerySchema,
  researchAgentResultSchema,
  type ResearchAgentQuery,
  type ResearchResource,
  type RightsDecision,
} from "./contracts";
import { offlineResearchCatalog } from "./offline-catalog";

export function decideResearchRights(resource: ResearchResource): RightsDecision {
  if (resource.redistribution === "prohibited" || resource.redistribution === "metadata-only") {
    return "metadata-only";
  }

  if (resource.licenseClass === "research-use-review-required") {
    return "blocked-pending-rights-review";
  }

  return "blocked-pending-rights-review";
}

function scoreResource(resource: ResearchResource, query: ResearchAgentQuery) {
  let score = resource.topicCodes.includes(query.topicCode) ? 60 : 0;
  if (resource.doi) score += 15;
  if (resource.sourcePlatform === "aida") score += 10;
  if (resource.resourceKind === "catalog") score += 5;
  if (decideResearchRights(resource) === "metadata-only") score += 10;
  return Math.min(score, 100);
}

function reasonsFor(resource: ResearchResource, query: ResearchAgentQuery, rightsDecision: RightsDecision) {
  const reasons = [
    resource.topicCodes.includes(query.topicCode) ? "선택한 연구 주제와 직접 연결됩니다." : "인접 연구자료로만 연결됩니다.",
    resource.doi ? `DOI ${resource.doi}로 출처를 고정할 수 있습니다.` : "공식 카탈로그 URL로 출처를 고정합니다.",
  ];

  if (rightsDecision === "metadata-only") {
    reasons.push("현재는 원문이 아니라 공개 메타데이터만 표시할 수 있습니다.");
  } else {
    reasons.push("라이선스와 원문 사용 범위를 확인하기 전에는 다운로드·학습을 막습니다.");
  }

  return reasons;
}

export function runResearchEvidenceAgent(input: ResearchAgentQuery) {
  const query = researchAgentQuerySchema.parse(input);
  const resources = offlineResearchCatalog.resources
    .filter((resource) => resource.topicCodes.includes(query.topicCode))
    .map((resource) => {
      const rightsDecision = decideResearchRights(resource);
      return rankedResearchResourceSchema.parse({
        resource,
        score: scoreResource(resource, query),
        rightsDecision,
        reasons: reasonsFor(resource, query, rightsDecision),
      });
    })
    .toSorted((left, right) => right.score - left.score || left.resource.id.localeCompare(right.resource.id));

  return researchAgentResultSchema.parse({
    schemaVersion: "research-evidence-result.v1",
    generatedFrom: "offline-public-metadata",
    liveApiCalls: 0,
    query,
    resources,
    abstained: resources.length === 0,
    boundary: "연구자료 탐색 전용 · 진단, 치료, 개인별 건강 조언 아님",
  });
}
