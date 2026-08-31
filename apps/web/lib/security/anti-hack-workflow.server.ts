import { createHmac } from "node:crypto";
import { z } from "zod";
import { identityProviderIdSchema } from "../auth/provider-contracts";

export const authAttackSignalTypeSchema = z.enum([
  "state_mismatch",
  "pkce_secret_mismatch",
  "nonce_mismatch",
  "signature_invalid",
  "issuer_mismatch",
  "audience_mismatch",
  "redirect_mismatch",
  "transaction_expired",
  "transaction_replay",
  "subject_link_collision",
  "too_many_attempts",
  "jwks_unavailable_or_stale",
  "webhook_signature_invalid",
  "token_exposure_detected",
  "provider_error",
]);

export const authAttackSignalSchema = z.strictObject({
  schemaVersion: z.literal("auth-attack-signal.v1"),
  type: authAttackSignalTypeSchema,
  provider: identityProviderIdSchema,
  observedAt: z.string().datetime({ offset: true }),
  transactionId: z.string().min(16).max(128),
  sessionId: z.string().min(16).max(256).nullable(),
  providerSubject: z.string().min(1).max(255).nullable(),
  sourceNetworkId: z.string().min(8).max(255).nullable(),
});

const classification = {
  state_mismatch: { risk: "high", disposition: "block", actions: ["invalidate-transaction", "rate-limit", "emit-security-event"] },
  pkce_secret_mismatch: { risk: "critical", disposition: "block-and-revoke", actions: ["invalidate-transaction", "revoke-provider-token", "rotate-session", "emit-security-alert"] },
  nonce_mismatch: { risk: "critical", disposition: "block-and-revoke", actions: ["invalidate-transaction", "revoke-provider-token", "rotate-session", "emit-security-alert"] },
  signature_invalid: { risk: "critical", disposition: "block-and-revoke", actions: ["invalidate-transaction", "revoke-provider-token", "rotate-session", "emit-security-alert"] },
  issuer_mismatch: { risk: "critical", disposition: "block-and-revoke", actions: ["invalidate-transaction", "revoke-provider-token", "rotate-session", "emit-security-alert"] },
  audience_mismatch: { risk: "critical", disposition: "block-and-revoke", actions: ["invalidate-transaction", "revoke-provider-token", "rotate-session", "emit-security-alert"] },
  redirect_mismatch: { risk: "critical", disposition: "block", actions: ["invalidate-transaction", "rotate-session", "emit-security-alert"] },
  transaction_expired: { risk: "medium", disposition: "block", actions: ["invalidate-transaction", "require-reauth", "emit-security-event"] },
  transaction_replay: { risk: "critical", disposition: "block-and-revoke", actions: ["invalidate-transaction", "revoke-provider-token", "rotate-session", "emit-security-alert"] },
  subject_link_collision: { risk: "critical", disposition: "freeze-account-link", actions: ["invalidate-transaction", "freeze-account-link", "require-reauth", "emit-security-alert"] },
  too_many_attempts: { risk: "high", disposition: "challenge", actions: ["rate-limit", "require-reauth", "emit-security-event"] },
  jwks_unavailable_or_stale: { risk: "high", disposition: "block", actions: ["invalidate-transaction", "emit-security-alert"] },
  webhook_signature_invalid: { risk: "critical", disposition: "block", actions: ["reject-webhook", "emit-security-alert"] },
  token_exposure_detected: { risk: "critical", disposition: "block-and-revoke", actions: ["revoke-provider-token", "rotate-session", "emit-security-alert"] },
  provider_error: { risk: "low", disposition: "fail-closed", actions: ["invalidate-transaction", "emit-security-event"] },
} as const;

export const redactedSecurityEventSchema = z.strictObject({
  schemaVersion: z.literal("redacted-auth-security-event.v1"),
  eventType: authAttackSignalTypeSchema,
  provider: identityProviderIdSchema,
  observedAt: z.string().datetime({ offset: true }),
  transactionRef: z.string().regex(/^hmac-sha256:[0-9a-f]{64}$/),
  sessionRef: z.string().regex(/^hmac-sha256:[0-9a-f]{64}$/).nullable(),
  subjectRef: z.string().regex(/^hmac-sha256:[0-9a-f]{64}$/).nullable(),
  networkRef: z.string().regex(/^hmac-sha256:[0-9a-f]{64}$/).nullable(),
  risk: z.enum(["low", "medium", "high", "critical"]),
  disposition: z.enum(["fail-closed", "block", "block-and-revoke", "challenge", "freeze-account-link"]),
  actions: z.array(z.enum([
    "invalidate-transaction",
    "revoke-provider-token",
    "rotate-session",
    "rate-limit",
    "require-reauth",
    "freeze-account-link",
    "reject-webhook",
    "emit-security-event",
    "emit-security-alert",
  ])).min(1),
  containsPersonalHealthData: z.literal(false),
  containsRawCredential: z.literal(false),
});

function pseudonymize(key: Uint8Array, domain: string, value: string | null) {
  if (value === null) return null;
  return `hmac-sha256:${createHmac("sha256", key).update(domain).update("\0").update(value).digest("hex")}` as const;
}

export function runAntiHackWorkflow(input: {
  signal: unknown;
  pseudonymizationKey: Uint8Array;
}) {
  const signal = authAttackSignalSchema.parse(input.signal);
  if (input.pseudonymizationKey.byteLength < 32) {
    throw new Error("pseudonymization key must contain at least 256 bits");
  }
  const decision = classification[signal.type];
  return redactedSecurityEventSchema.parse({
    schemaVersion: "redacted-auth-security-event.v1",
    eventType: signal.type,
    provider: signal.provider,
    observedAt: signal.observedAt,
    transactionRef: pseudonymize(input.pseudonymizationKey, "transaction", signal.transactionId),
    sessionRef: pseudonymize(input.pseudonymizationKey, "session", signal.sessionId),
    subjectRef: pseudonymize(input.pseudonymizationKey, "subject", signal.providerSubject),
    networkRef: pseudonymize(input.pseudonymizationKey, "network", signal.sourceNetworkId),
    risk: decision.risk,
    disposition: decision.disposition,
    actions: decision.actions,
    containsPersonalHealthData: false,
    containsRawCredential: false,
  });
}
