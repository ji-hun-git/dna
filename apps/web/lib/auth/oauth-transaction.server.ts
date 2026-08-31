import { createHash, randomBytes as nodeRandomBytes, timingSafeEqual } from "node:crypto";
import { createLocalJWKSet, errors as joseErrors, jwtVerify } from "jose";
import { z } from "zod";
import {
  getIdentityProviderContract,
  identityProviderIdSchema,
  type IdentityProviderId,
} from "./provider-contracts";

const base64UrlSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const allowedReturnPathSchema = z.enum(["/", "/health-history", "/settings/connections"]);

export const storedOAuthTransactionSchema = z.strictObject({
  schemaVersion: z.literal("oauth-transaction.v1"),
  transactionId: base64UrlSchema,
  provider: identityProviderIdSchema,
  stateSha256: sha256Schema,
  nonceSha256: sha256Schema.nullable(),
  codeVerifierSha256: sha256Schema,
  codeChallenge: base64UrlSchema,
  callbackUri: z.url().refine((value) => new URL(value).protocol === "https:"),
  returnPath: allowedReturnPathSchema,
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  consumedAt: z.string().datetime({ offset: true }).nullable(),
});

export const oauthTransactionSecretsSchema = z.strictObject({
  state: base64UrlSchema,
  nonce: base64UrlSchema.nullable(),
  codeVerifier: base64UrlSchema,
});

export const authorizationCallbackSchema = z.union([
  z.strictObject({
    code: z.string().min(1).max(2048),
    state: base64UrlSchema,
    error: z.null(),
  }),
  z.strictObject({
    code: z.null(),
    state: base64UrlSchema,
    error: z.string().min(1).max(120),
  }),
]);

export type StoredOAuthTransaction = z.infer<typeof storedOAuthTransactionSchema>;
export type OAuthTransactionSecrets = z.infer<typeof oauthTransactionSecretsSchema>;

type RandomSource = (size: number) => Uint8Array;

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}` as const;
}

function constantTimeStringEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function canonicalOrigin(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("app origin must be one canonical HTTPS origin");
  }
  return parsed.origin;
}

export function beginOAuthTransaction(input: {
  provider: IdentityProviderId;
  clientId: string;
  appOrigin: string;
  allowedAppOrigins: readonly string[];
  returnPath: z.input<typeof allowedReturnPathSchema>;
  now: Date;
  randomBytes?: RandomSource;
}) {
  const provider = getIdentityProviderContract(input.provider);
  const appOrigin = canonicalOrigin(input.appOrigin);
  const allowedOrigins = new Set(input.allowedAppOrigins.map(canonicalOrigin));
  if (!allowedOrigins.has(appOrigin)) {
    throw new Error("app origin is not in the protected allowlist");
  }
  if (!/^[A-Za-z0-9._-]{8,160}$/.test(input.clientId)) {
    throw new Error("client ID has an invalid shape");
  }

  const returnPath = allowedReturnPathSchema.parse(input.returnPath);
  const randomSource = input.randomBytes ?? ((size: number) => nodeRandomBytes(size));
  const transactionId = base64Url(randomSource(32));
  const state = base64Url(randomSource(32));
  const nonce = provider.nonceMode === "required" ? base64Url(randomSource(32)) : null;
  const codeVerifier = base64Url(randomSource(32));
  const codeChallenge = createHash("sha256").update(codeVerifier, "utf8").digest("base64url");
  const callbackUri = `${appOrigin}/api/auth/callback/${input.provider}`;
  const issuedAt = input.now.toISOString();
  const expiresAt = new Date(input.now.getTime() + 5 * 60 * 1000).toISOString();

  const authorizationUrl = new URL(provider.authorizationEndpoint);
  authorizationUrl.searchParams.set("response_type", provider.responseType);
  authorizationUrl.searchParams.set("client_id", input.clientId);
  authorizationUrl.searchParams.set("redirect_uri", callbackUri);
  authorizationUrl.searchParams.set("scope", provider.requiredScopes.join(" "));
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", provider.pkceMethod);
  if (nonce !== null) {
    authorizationUrl.searchParams.set("nonce", nonce);
  }

  return {
    authorizationUrl: authorizationUrl.toString(),
    record: storedOAuthTransactionSchema.parse({
      schemaVersion: "oauth-transaction.v1",
      transactionId,
      provider: input.provider,
      stateSha256: sha256(state),
      nonceSha256: nonce === null ? null : sha256(nonce),
      codeVerifierSha256: sha256(codeVerifier),
      codeChallenge,
      callbackUri,
      returnPath,
      issuedAt,
      expiresAt,
      consumedAt: null,
    }),
    secrets: oauthTransactionSecretsSchema.parse({ state, nonce, codeVerifier }),
  };
}

export type CallbackFailure =
  | "provider_error"
  | "transaction_expired"
  | "transaction_replay"
  | "state_mismatch"
  | "pkce_secret_mismatch";

export function validateAuthorizationCallback(input: {
  record: StoredOAuthTransaction;
  secrets: OAuthTransactionSecrets;
  callback: z.input<typeof authorizationCallbackSchema>;
  now: Date;
}): { ok: true; code: string; codeVerifier: string } | { ok: false; reason: CallbackFailure } {
  const record = storedOAuthTransactionSchema.parse(input.record);
  const secrets = oauthTransactionSecretsSchema.parse(input.secrets);
  const callback = authorizationCallbackSchema.parse(input.callback);

  if (record.consumedAt !== null) return { ok: false, reason: "transaction_replay" };
  if (input.now.getTime() > Date.parse(record.expiresAt)) return { ok: false, reason: "transaction_expired" };
  if (!constantTimeStringEqual(record.stateSha256, sha256(callback.state))) return { ok: false, reason: "state_mismatch" };
  if (!constantTimeStringEqual(record.stateSha256, sha256(secrets.state))) return { ok: false, reason: "state_mismatch" };
  if (!constantTimeStringEqual(record.codeVerifierSha256, sha256(secrets.codeVerifier))) {
    return { ok: false, reason: "pkce_secret_mismatch" };
  }
  if (callback.error !== null) return { ok: false, reason: "provider_error" };

  return { ok: true, code: callback.code, codeVerifier: secrets.codeVerifier };
}

const providerRsaJwkSchema = z.strictObject({
  kty: z.literal("RSA"),
  kid: z.string().min(1).max(160),
  use: z.literal("sig").optional(),
  alg: z.literal("RS256").optional(),
  n: z.string().min(64).max(2048),
  e: z.string().min(1).max(32),
});

export const providerJwksSchema = z.strictObject({
  keys: z.array(providerRsaJwkSchema).min(1).max(8),
}).superRefine((jwks, context) => {
  const keyIds = jwks.keys.map((key) => key.kid);
  if (new Set(keyIds).size !== keyIds.length) {
    context.addIssue({ code: "custom", message: "provider JWKS key IDs must be unique" });
  }
});

export type IdentityClaimFailure = "signature_invalid" | "issuer_mismatch" | "audience_mismatch" | "nonce_mismatch" | "token_time_invalid";

function classifyJwtFailure(error: unknown): IdentityClaimFailure {
  if (error instanceof joseErrors.JWTExpired) return "token_time_invalid";
  if (error instanceof joseErrors.JWTClaimValidationFailed) {
    if (error.claim === "iss") return "issuer_mismatch";
    if (error.claim === "aud") return "audience_mismatch";
    if (error.claim === "iat" || error.claim === "exp") return "token_time_invalid";
  }
  return "signature_invalid";
}

export async function verifyProviderIdToken(input: {
  provider: IdentityProviderId;
  clientId: string;
  expectedNonce: string | null;
  idToken: string;
  jwks: unknown;
  now: Date;
}): Promise<{ ok: true; accountKey: string } | { ok: false; reason: IdentityClaimFailure }> {
  const provider = getIdentityProviderContract(input.provider);
  const parsedJwks = providerJwksSchema.safeParse(input.jwks);
  if (!parsedJwks.success || input.idToken.length > 16_384) return { ok: false, reason: "signature_invalid" };

  try {
    const verified = await jwtVerify(input.idToken, createLocalJWKSet(parsedJwks.data), {
      algorithms: [provider.idTokenSigningAlgorithm],
      issuer: provider.issuer,
      audience: input.clientId,
      requiredClaims: ["sub", "iat", "exp"],
      clockTolerance: 60,
      maxTokenAge: "2h",
      currentDate: input.now,
    });
    const subject = z.string().min(1).max(255).safeParse(verified.payload.sub);
    const issuedAt = z.number().int().nonnegative().safeParse(verified.payload.iat);
    const expiresAt = z.number().int().positive().safeParse(verified.payload.exp);
    if (!subject.success || !issuedAt.success || !expiresAt.success || expiresAt.data - issuedAt.data > 2 * 60 * 60) {
      return { ok: false, reason: "token_time_invalid" };
    }
    if (provider.nonceMode === "required") {
      const nonce = base64UrlSchema.safeParse(verified.payload.nonce);
      if (input.expectedNonce === null || !nonce.success || !constantTimeStringEqual(nonce.data, input.expectedNonce)) {
        return { ok: false, reason: "nonce_mismatch" };
      }
    }
    return { ok: true, accountKey: `${provider.issuer}#${subject.data}` };
  } catch (error) {
    return { ok: false, reason: classifyJwtFailure(error) };
  }
}
