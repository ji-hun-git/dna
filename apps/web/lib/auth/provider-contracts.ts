import { z } from "zod";

const httpsUrlSchema = z.url().refine((value) => new URL(value).protocol === "https:", {
  message: "provider endpoints must use HTTPS",
});

export const identityProviderIdSchema = z.enum(["kakao", "naver"]);
export type IdentityProviderId = z.infer<typeof identityProviderIdSchema>;

export const identityProviderContractSchema = z.strictObject({
  schemaVersion: z.literal("identity-provider-contract.v1"),
  id: identityProviderIdSchema,
  releaseStatus: z.literal("contract-only-external-registration-required"),
  protocol: z.literal("oidc-authorization-code"),
  issuer: httpsUrlSchema,
  authorizationEndpoint: httpsUrlSchema,
  tokenEndpoint: httpsUrlSchema,
  userInfoEndpoint: httpsUrlSchema,
  jwksUri: httpsUrlSchema,
  tokenRevocationEndpoint: httpsUrlSchema.nullable(),
  idTokenSigningAlgorithm: z.literal("RS256"),
  responseType: z.literal("code"),
  pkceMethod: z.literal("S256"),
  stateRequired: z.literal(true),
  nonceMode: z.enum(["required", "provider-guide-does-not-document"]),
  requiredScopes: z.tuple([z.literal("openid")]),
  accountKey: z.literal("issuer-and-subject"),
  profilePolicy: z.literal("subject-only-unless-separately-consented"),
  allowedEgressHosts: z.array(z.string().min(1)).min(1).max(3),
});

export type IdentityProviderContract = z.infer<typeof identityProviderContractSchema>;

export const identityProviderContracts = {
  kakao: identityProviderContractSchema.parse({
    schemaVersion: "identity-provider-contract.v1",
    id: "kakao",
    releaseStatus: "contract-only-external-registration-required",
    protocol: "oidc-authorization-code",
    issuer: "https://kauth.kakao.com",
    authorizationEndpoint: "https://kauth.kakao.com/oauth/authorize",
    tokenEndpoint: "https://kauth.kakao.com/oauth/token",
    userInfoEndpoint: "https://kapi.kakao.com/v1/oidc/userinfo",
    jwksUri: "https://kauth.kakao.com/.well-known/jwks.json",
    tokenRevocationEndpoint: null,
    idTokenSigningAlgorithm: "RS256",
    responseType: "code",
    pkceMethod: "S256",
    stateRequired: true,
    nonceMode: "required",
    requiredScopes: ["openid"],
    accountKey: "issuer-and-subject",
    profilePolicy: "subject-only-unless-separately-consented",
    allowedEgressHosts: ["kauth.kakao.com", "kapi.kakao.com"],
  }),
  naver: identityProviderContractSchema.parse({
    schemaVersion: "identity-provider-contract.v1",
    id: "naver",
    releaseStatus: "contract-only-external-registration-required",
    protocol: "oidc-authorization-code",
    issuer: "https://nid.naver.com",
    authorizationEndpoint: "https://nid.naver.com/oauth2/authorize",
    tokenEndpoint: "https://nid.naver.com/oauth2/token",
    userInfoEndpoint: "https://openapi.naver.com/v1/nid/me",
    jwksUri: "https://nid.naver.com/oauth2/jwks",
    tokenRevocationEndpoint: "https://nid.naver.com/oauth2.0/revoke",
    idTokenSigningAlgorithm: "RS256",
    responseType: "code",
    pkceMethod: "S256",
    stateRequired: true,
    nonceMode: "provider-guide-does-not-document",
    requiredScopes: ["openid"],
    accountKey: "issuer-and-subject",
    profilePolicy: "subject-only-unless-separately-consented",
    allowedEgressHosts: ["nid.naver.com", "openapi.naver.com"],
  }),
} as const satisfies Record<IdentityProviderId, IdentityProviderContract>;

export const healthAccessConnectorSchema = z.strictObject({
  schemaVersion: z.literal("health-access-connector.v1"),
  id: z.literal("myhealthway"),
  userFacingName: z.literal("건강정보 고속도로"),
  status: z.literal("disabled-pending-formal-approval"),
  personalRecordRoute: z.literal("myhealthway-formal-onboarding"),
  directNhisCredentialLogin: z.literal(false),
  scrapingAllowed: z.literal(false),
  sharedCredentialAllowed: z.literal(false),
  requiredGates: z.tuple([
    z.literal("organization-registration"),
    z.literal("testbed-approval"),
    z.literal("conformity-approval"),
    z.literal("production-transition-approval"),
    z.literal("privacy-and-intended-use-review"),
  ]),
  supportedDataPlane: z.literal("korea-personal-data-plane"),
  exchangeStandard: z.literal("FHIR"),
});

export const healthAccessConnector = healthAccessConnectorSchema.parse({
  schemaVersion: "health-access-connector.v1",
  id: "myhealthway",
  userFacingName: "건강정보 고속도로",
  status: "disabled-pending-formal-approval",
  personalRecordRoute: "myhealthway-formal-onboarding",
  directNhisCredentialLogin: false,
  scrapingAllowed: false,
  sharedCredentialAllowed: false,
  requiredGates: [
    "organization-registration",
    "testbed-approval",
    "conformity-approval",
    "production-transition-approval",
    "privacy-and-intended-use-review",
  ],
  supportedDataPlane: "korea-personal-data-plane",
  exchangeStandard: "FHIR",
});

export function getIdentityProviderContract(provider: IdentityProviderId) {
  return identityProviderContracts[provider];
}
