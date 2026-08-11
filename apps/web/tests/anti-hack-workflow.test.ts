// @vitest-environment node

import { expect, it } from "vitest";
import {
  authAttackSignalSchema,
  redactedSecurityEventSchema,
  runAntiHackWorkflow,
} from "@/lib/security/anti-hack-workflow.server";

const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const baseSignal = {
  schemaVersion: "auth-attack-signal.v1",
  provider: "kakao",
  observedAt: "2026-08-12T03:00:00.000Z",
  transactionId: "synthetic-transaction-12345",
  sessionId: "synthetic-session-12345",
  providerSubject: "synthetic-subject",
  sourceNetworkId: "synthetic-network-bucket",
} as const;

it("contains a forged identity, revokes the provider token, rotates the session, and emits only HMAC references", () => {
  const event = runAntiHackWorkflow({
    signal: { ...baseSignal, type: "signature_invalid" },
    pseudonymizationKey: key,
  });

  expect(redactedSecurityEventSchema.parse(event)).toEqual(event);
  expect(event).toMatchObject({
    risk: "critical",
    disposition: "block-and-revoke",
    actions: ["invalidate-transaction", "revoke-provider-token", "rotate-session", "emit-security-alert"],
    containsPersonalHealthData: false,
    containsRawCredential: false,
  });
  expect(event.transactionRef).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
  expect(JSON.stringify(event)).not.toContain(baseSignal.transactionId);
  expect(JSON.stringify(event)).not.toContain(baseSignal.sessionId);
  expect(JSON.stringify(event)).not.toContain(baseSignal.providerSubject);
});

it("freezes ambiguous account linking instead of merging identities by email", () => {
  const event = runAntiHackWorkflow({
    signal: { ...baseSignal, provider: "naver", type: "subject_link_collision" },
    pseudonymizationKey: key,
  });

  expect(event.disposition).toBe("freeze-account-link");
  expect(event.actions).toEqual([
    "invalidate-transaction",
    "freeze-account-link",
    "require-reauth",
    "emit-security-alert",
  ]);
});

it("challenges abusive retries and rejects raw credential fields or weak pseudonymization keys", () => {
  const event = runAntiHackWorkflow({
    signal: { ...baseSignal, type: "too_many_attempts" },
    pseudonymizationKey: key,
  });
  expect(event).toMatchObject({ risk: "high", disposition: "challenge" });

  expect(authAttackSignalSchema.safeParse({
    ...baseSignal,
    type: "token_exposure_detected",
    accessToken: "must-never-enter-the-event",
  }).success).toBe(false);
  expect(() => runAntiHackWorkflow({
    signal: { ...baseSignal, type: "state_mismatch" },
    pseudonymizationKey: new Uint8Array(16),
  })).toThrow("at least 256 bits");
});
