import { expect, it } from "vitest";
import {
  healthAccessConnector,
  healthAccessConnectorSchema,
  identityProviderContractSchema,
  identityProviderContracts,
} from "@/lib/auth/provider-contracts";

it("pins Kakao and Naver to their live OIDC discovery contracts with server-only secrets", () => {
  for (const contract of Object.values(identityProviderContracts)) {
    expect(identityProviderContractSchema.parse(contract)).toEqual(contract);
    expect(contract.protocol).toBe("oidc-authorization-code");
    expect(contract.pkceMethod).toBe("S256");
    expect(contract.stateRequired).toBe(true);
    expect(contract.requiredScopes).toEqual(["openid"]);
    expect(contract.accountKey).toBe("issuer-and-subject");
    expect(contract.tokenEndpointAuthMethod).toBe("client_secret_post");
    expect(contract.clientSecretStorage).toBe("server-secret-manager-only");
    expect(contract.browserTokenStorage).toBe("forbidden");

    const endpointHosts = [
      contract.issuer,
      contract.discoveryUri,
      contract.authorizationEndpoint,
      contract.tokenEndpoint,
      contract.userInfoEndpoint,
      contract.jwksUri,
      contract.tokenRevocationEndpoint,
    ].filter((value): value is string => value !== null).map((value) => new URL(value).hostname);
    expect(endpointHosts.every((host) => contract.allowedEgressHosts.includes(host))).toBe(true);
  }

  expect(identityProviderContracts.kakao.nonceMode).toBe("required");
  expect(identityProviderContracts.naver.discoveryUri).toBe("https://nid.naver.com/.well-known/openid-configuration");
  expect(identityProviderContracts.naver.authorizationEndpoint).toBe("https://nid.naver.com/oauth2/authorize");
  expect(identityProviderContracts.naver.tokenEndpoint).toBe("https://nid.naver.com/oauth2/token");
  expect(identityProviderContracts.naver.tokenRevocationEndpoint).toBe("https://nid.naver.com/oauth2.0/revoke");
});

it("keeps personal health access disabled until the formal MyHealthWay approval chain completes", () => {
  expect(healthAccessConnectorSchema.parse(healthAccessConnector)).toEqual(healthAccessConnector);
  expect(healthAccessConnector).toMatchObject({
    id: "myhealthway",
    status: "disabled-pending-formal-approval",
    directNhisCredentialLogin: false,
    scrapingAllowed: false,
    sharedCredentialAllowed: false,
    supportedDataPlane: "korea-personal-data-plane",
  });
  expect(healthAccessConnector.requiredGates).toEqual([
    "organization-registration",
    "testbed-approval",
    "conformity-approval",
    "production-transition-approval",
    "privacy-and-intended-use-review",
  ]);
});

it("rejects extra provider fields that could smuggle a client secret or arbitrary endpoint", () => {
  expect(identityProviderContractSchema.safeParse({
    ...identityProviderContracts.kakao,
    clientSecret: "must-not-enter-a-browser-contract",
  }).success).toBe(false);
  expect(identityProviderContractSchema.safeParse({
    ...identityProviderContracts.naver,
    tokenEndpoint: "http://127.0.0.1/token",
  }).success).toBe(false);
});
