import { z } from "zod";

const connectorDefinitionSchema = z.strictObject({
  source: z.enum(["aida", "dataon"]),
  enabled: z.literal(false),
  mode: z.literal("metadata-only"),
  secretEnvironmentName: z.enum(["AIDA_OPENAPI_KEY", "DATAON_OPENAPI_KEY"]),
  approvedOperations: z.array(z.enum(["search-metadata", "get-metadata-detail"])).length(2),
  fileDownloadAllowed: z.literal(false),
  activationGate: z.string().min(1).max(240),
});

export const researchConnectorActivationSchema = z.strictObject({
  schemaVersion: z.literal("research-connector-activation.v1"),
  source: z.enum(["aida", "dataon"]),
  mode: z.literal("metadata-only"),
  serverSideOnly: z.literal(true),
  termsReviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rightsRegisterId: z.string().regex(/^rights-[a-z0-9-]+$/),
  secretVersionReference: z.string().regex(/^aws-secretsmanager:\/\/[a-zA-Z0-9/_+=.@-]+\?versionId=[a-zA-Z0-9-]+$/),
  killSwitchEnabled: z.literal(true),
  personalDataAllowed: z.literal(false),
  fileDownloadAllowed: z.literal(false),
});

export const researchSourceConnectors = connectorDefinitionSchema.array().length(2).parse([
  {
    source: "aida",
    enabled: false,
    mode: "metadata-only",
    secretEnvironmentName: "AIDA_OPENAPI_KEY",
    approvedOperations: ["search-metadata", "get-metadata-detail"],
    fileDownloadAllowed: false,
    activationGate: "AIDA 이용 신청, 데이터별 라이선스 등록, 서버 전용 비밀키 VersionId, 차단 스위치가 모두 검증되어야 합니다.",
  },
  {
    source: "dataon",
    enabled: false,
    mode: "metadata-only",
    secretEnvironmentName: "DATAON_OPENAPI_KEY",
    approvedOperations: ["search-metadata", "get-metadata-detail"],
    fileDownloadAllowed: false,
    activationGate: "DataON 이용 승인, 등록 IP, 데이터별 권리 등록, 서버 전용 비밀키 VersionId, 차단 스위치가 모두 검증되어야 합니다.",
  },
]);
