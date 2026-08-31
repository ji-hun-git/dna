import { createHash } from "node:crypto";
import { researchResourceSchema, type ResearchResource } from "./contracts.ts";

export type SourceDriftMutation =
  | "none"
  | "title"
  | "doi"
  | "license-class"
  | "redistribution"
  | "source-url"
  | "quality-warning"
  | "access-state"
  | "data-type"
  | "source-platform"
  | "topic-codes";

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stableResearchResourceView(resourceInput: unknown) {
  const resource = researchResourceSchema.parse(resourceInput);
  const { retrievedAt: _retrievedAt, ...stable } = resource;
  return stable;
}

export function fingerprintResearchResource(resourceInput: unknown) {
  const canonical = canonicalize(stableResearchResourceView(resourceInput));
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

export function mutateResearchResource(resourceInput: unknown, mutation: SourceDriftMutation): ResearchResource {
  const resource = researchResourceSchema.parse(resourceInput);
  if (mutation === "none") return resource;
  if (mutation === "title") return researchResourceSchema.parse({ ...resource, title: `${resource.title} (변경됨)` });
  if (mutation === "doi") return researchResourceSchema.parse({ ...resource, doi: "10.23057/999" });
  if (mutation === "license-class") return researchResourceSchema.parse({ ...resource, licenseClass: "research-use-review-required" });
  if (mutation === "redistribution") return researchResourceSchema.parse({ ...resource, redistribution: "unknown" });
  if (mutation === "source-url") return researchResourceSchema.parse({ ...resource, sourceUrl: "https://example.invalid/changed-source" });
  if (mutation === "quality-warning") return researchResourceSchema.parse({ ...resource, qualityWarnings: [...resource.qualityWarnings, "합성 변경 감지 사례입니다."] });
  if (mutation === "access-state") return researchResourceSchema.parse({ ...resource, accessState: "public-metadata" });
  if (mutation === "data-type") return researchResourceSchema.parse({ ...resource, dataType: "metadata-api" });
  if (mutation === "source-platform") return researchResourceSchema.parse({ ...resource, sourcePlatform: resource.sourcePlatform === "aida" ? "dataon" : "aida" });
  return researchResourceSchema.parse({ ...resource, topicCodes: ["infectious-disease-events"] });
}
