// @vitest-environment node

import { createHash } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { expect, it } from "vitest";
import {
  beginOAuthTransaction,
  validateAuthorizationCallback,
  verifyProviderIdToken,
} from "@/lib/auth/oauth-transaction.server";

function deterministicRandom() {
  let cursor = 1;
  return (size: number) => {
    const bytes = Uint8Array.from({ length: size }, (_, index) => (cursor + index) % 256);
    cursor += size;
    return bytes;
  };
}

const now = new Date("2026-08-12T03:00:00.000Z");

it("builds a five-minute Kakao transaction with exact callback, state, nonce, and S256 PKCE", () => {
  const transaction = beginOAuthTransaction({
    provider: "kakao",
    clientId: "synthetic-kakao-client",
    appOrigin: "https://app.genome-companion.kr",
    allowedAppOrigins: ["https://app.genome-companion.kr"],
    returnPath: "/health-history",
    now,
    randomBytes: deterministicRandom(),
  });
  const url = new URL(transaction.authorizationUrl);

  expect(url.origin + url.pathname).toBe("https://kauth.kakao.com/oauth/authorize");
  expect(url.searchParams.get("redirect_uri")).toBe("https://app.genome-companion.kr/api/auth/callback/kakao");
  expect(url.searchParams.get("scope")).toBe("openid");
  expect(url.searchParams.get("state")).toBe(transaction.secrets.state);
  expect(url.searchParams.get("nonce")).toBe(transaction.secrets.nonce);
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toBe(
    createHash("sha256").update(transaction.secrets.codeVerifier).digest("base64url"),
  );
  expect(Date.parse(transaction.record.expiresAt) - Date.parse(transaction.record.issuedAt)).toBe(300_000);
  expect(JSON.stringify(transaction.record)).not.toContain(transaction.secrets.state);
  expect(JSON.stringify(transaction.record)).not.toContain(transaction.secrets.codeVerifier);
});

it("uses Naver's live OIDC discovery endpoints and S256 PKCE without inventing an undocumented nonce", () => {
  const transaction = beginOAuthTransaction({
    provider: "naver",
    clientId: "synthetic-naver-client",
    appOrigin: "https://app.genome-companion.kr",
    allowedAppOrigins: ["https://app.genome-companion.kr"],
    returnPath: "/settings/connections",
    now,
    randomBytes: deterministicRandom(),
  });
  const url = new URL(transaction.authorizationUrl);

  expect(url.origin + url.pathname).toBe("https://nid.naver.com/oauth2/authorize");
  expect(url.searchParams.get("scope")).toBe("openid");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.has("nonce")).toBe(false);
  expect(transaction.secrets.nonce).toBeNull();
});

it("accepts only a cryptographically verified Naver OIDC identity and does not use profile email as an account key", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  const jwks = { keys: [{ ...publicJwk, kid: "naver-synthetic-key", use: "sig", alg: "RS256" }] };
  const token = await new SignJWT({ email: "must-not-be-an-account-key@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "naver-synthetic-key" })
    .setIssuer("https://nid.naver.com")
    .setAudience("synthetic-naver-client")
    .setSubject("pairwise-synthetic-subject")
    .setIssuedAt(Math.floor(now.getTime() / 1000) - 10)
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 600)
    .sign(privateKey);

  await expect(verifyProviderIdToken({
    provider: "naver",
    clientId: "synthetic-naver-client",
    expectedNonce: null,
    idToken: token,
    jwks,
    now,
  })).resolves.toEqual({ ok: true, accountKey: "https://nid.naver.com#pairwise-synthetic-subject" });
});

it("fails closed on state, PKCE secret, expiry, replay, provider error, and origin drift", () => {
  const transaction = beginOAuthTransaction({
    provider: "kakao",
    clientId: "synthetic-kakao-client",
    appOrigin: "https://app.genome-companion.kr",
    allowedAppOrigins: ["https://app.genome-companion.kr"],
    returnPath: "/",
    now,
    randomBytes: deterministicRandom(),
  });
  const successCallback = { code: "synthetic-code", state: transaction.secrets.state, error: null } as const;

  expect(validateAuthorizationCallback({ ...transaction, callback: successCallback, now })).toEqual({
    ok: true,
    code: "synthetic-code",
    codeVerifier: transaction.secrets.codeVerifier,
  });
  expect(validateAuthorizationCallback({
    ...transaction,
    callback: { ...successCallback, state: "A".repeat(43) },
    now,
  })).toEqual({ ok: false, reason: "state_mismatch" });
  expect(validateAuthorizationCallback({
    record: transaction.record,
    secrets: { ...transaction.secrets, codeVerifier: "B".repeat(43) },
    callback: successCallback,
    now,
  })).toEqual({ ok: false, reason: "pkce_secret_mismatch" });
  expect(validateAuthorizationCallback({
    ...transaction,
    callback: successCallback,
    now: new Date("2026-08-12T03:05:00.001Z"),
  })).toEqual({ ok: false, reason: "transaction_expired" });
  expect(validateAuthorizationCallback({
    record: { ...transaction.record, consumedAt: "2026-08-12T03:01:00.000Z" },
    secrets: transaction.secrets,
    callback: successCallback,
    now,
  })).toEqual({ ok: false, reason: "transaction_replay" });
  expect(validateAuthorizationCallback({
    ...transaction,
    callback: { code: null, state: transaction.secrets.state, error: "access_denied" },
    now,
  })).toEqual({ ok: false, reason: "provider_error" });
  expect(() => beginOAuthTransaction({
    provider: "naver",
    clientId: "synthetic-naver-client",
    appOrigin: "https://evil.example",
    allowedAppOrigins: ["https://app.genome-companion.kr"],
    returnPath: "/",
    now,
    randomBytes: deterministicRandom(),
  })).toThrow("app origin is not in the protected allowlist");
});

it("accepts only a cryptographically verified, issuer/audience/time/nonce-bound Kakao identity", async () => {
  const nonce = "C".repeat(43);
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  const jwks = { keys: [{ ...publicJwk, kid: "synthetic-key", use: "sig", alg: "RS256" }] };
  const sign = (overrides: Record<string, unknown> = {}) => new SignJWT({ nonce, ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "synthetic-key" })
    .setIssuer("https://kauth.kakao.com")
    .setAudience("synthetic-kakao-client")
    .setSubject("synthetic-subject")
    .setIssuedAt(Math.floor(now.getTime() / 1000) - 10)
    .setExpirationTime(Math.floor(now.getTime() / 1000) + 600)
    .sign(privateKey);
  const token = await sign();

  await expect(verifyProviderIdToken({
    provider: "kakao",
    clientId: "synthetic-kakao-client",
    expectedNonce: nonce,
    idToken: token,
    jwks,
    now,
  })).resolves.toEqual({ ok: true, accountKey: "https://kauth.kakao.com#synthetic-subject" });

  const { publicKey: wrongPublicKey } = await generateKeyPair("RS256", { extractable: true });
  const wrongJwk = await exportJWK(wrongPublicKey);
  const mutations = [
    { token, jwks: { keys: [{ ...wrongJwk, kid: "synthetic-key", use: "sig", alg: "RS256" }] }, expectedNonce: nonce, clientId: "synthetic-kakao-client", reason: "signature_invalid" },
    { token, jwks, expectedNonce: nonce, clientId: "another-client", reason: "audience_mismatch" },
    { token, jwks, expectedNonce: "D".repeat(43), clientId: "synthetic-kakao-client", reason: "nonce_mismatch" },
    { token: await new SignJWT({ nonce }).setProtectedHeader({ alg: "RS256", kid: "synthetic-key" }).setIssuer("https://evil.example").setAudience("synthetic-kakao-client").setSubject("synthetic-subject").setIssuedAt(Math.floor(now.getTime() / 1000) - 10).setExpirationTime(Math.floor(now.getTime() / 1000) + 600).sign(privateKey), jwks, expectedNonce: nonce, clientId: "synthetic-kakao-client", reason: "issuer_mismatch" },
    { token: await new SignJWT({ nonce }).setProtectedHeader({ alg: "RS256", kid: "synthetic-key" }).setIssuer("https://kauth.kakao.com").setAudience("synthetic-kakao-client").setSubject("synthetic-subject").setIssuedAt(Math.floor(now.getTime() / 1000) - 9000).setExpirationTime(Math.floor(now.getTime() / 1000)).sign(privateKey), jwks, expectedNonce: nonce, clientId: "synthetic-kakao-client", reason: "token_time_invalid" },
  ] as const;
  for (const mutation of mutations) {
    await expect(verifyProviderIdToken({
      provider: "kakao",
      clientId: mutation.clientId,
      expectedNonce: mutation.expectedNonce,
      idToken: mutation.token,
      jwks: mutation.jwks,
      now,
    })).resolves.toEqual({ ok: false, reason: mutation.reason });
  }
});
