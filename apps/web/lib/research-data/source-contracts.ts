import { z } from "zod";
import aidaSnapshot from "../../tests/fixtures/research-data/aida.public-metadata.snapshot.json" with { type: "json" };
import dataonSnapshot from "../../tests/fixtures/research-data/dataon.public-metadata.snapshot.json" with { type: "json" };

export const researchSourceSnapshotContractSchema = z.strictObject({
  schemaVersion: z.literal("research-source-snapshot-contract.v1"),
  source: z.enum(["aida", "dataon"]),
  normalizationMode: z.literal("public-metadata-page"),
  wireContractStatus: z.literal("pending-approved-key-capture"),
  wirePayloadCaptured: z.literal(false),
  apiKeyPresent: z.literal(false),
  liveApiCalls: z.literal(0),
  documentedOperations: z.array(z.enum(["search-metadata", "get-metadata-detail"])).length(2),
  fileDownloadIncluded: z.literal(false),
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resourceIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(20),
});

export const researchSourceSnapshotContracts = researchSourceSnapshotContractSchema.array().length(2).parse([
  aidaSnapshot,
  dataonSnapshot,
]);
