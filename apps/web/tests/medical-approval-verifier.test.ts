import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  immutableApprovalCoordinateSchema,
  unwrapVerifiedOciApproval,
  verifySignedOciApproval,
} from "@/lib/medical-ai/approval-verifier";
import { canonicalJson, sha256Of } from "@/lib/medical-ai/offline-runner";
import { medicalDocumentOciApprovalSchema } from "@/lib/medical-ai/runner-contracts";
import { createSignedApprovalFixture } from "./helpers/signed-oci-approval";

const digest = (character: string) => `sha256:${character.repeat(64)}`;

function approval() {
  return {
    schemaVersion: "medical-document-oci-approval.v1",
    approvalId: "oci-approval-signature-test",
    manifestSha256: digest("1"),
    runnerImage: `registry.example/gc/medical-runner@${digest("2")}`,
    layoutReceiptSha256: digest("3"),
    semanticReceiptSha256: digest("4"),
    approvedUse: "candidate-extraction-evaluation-only",
    approvalAuthority: "founder-approved-workflow",
    approvedAt: "2026-08-12T02:00:00+09:00",
    expiresAt: "2026-08-12T03:00:00+09:00",
  };
}

function rebindObject(fixture: ReturnType<typeof createSignedApprovalFixture>, envelope: unknown) {
  const objectBytes = Buffer.from(canonicalJson(envelope), "utf8");
  const objectSha256 = `sha256:${createHash("sha256").update(objectBytes).digest("hex")}`;
  const coordinate = {
    ...fixture.coordinate,
    key: `medical-ai/oci-approvals/${fixture.approval.approvalId}/${objectSha256.replace(":", "-")}.jws.json`,
    objectSha256,
  };
  return { objectBytes, coordinate, expectedCoordinateSha256: sha256Of(coordinate) };
}

it("authenticates a canonical ES256 approval at an exact immutable coordinate", () => {
  const fixture = createSignedApprovalFixture(approval());
  expect(unwrapVerifiedOciApproval(fixture.verifiedApproval)).toMatchObject({
    approval: { approvalId: "oci-approval-signature-test" },
    coordinate: fixture.coordinate,
    trustAnchorSha256: fixture.expectedTrustAnchorSha256,
  });
  expect(() => unwrapVerifiedOciApproval(fixture.approval)).toThrow("authenticated approval envelope");
});

it("rejects exact-Version substitution, trust-anchor substitution, and expired approval", () => {
  const fixture = createSignedApprovalFixture(approval());
  expect(() => verifySignedOciApproval({
    ...fixture,
    coordinate: { ...fixture.coordinate, versionId: "different-version" },
  })).toThrow("coordinate digest");
  expect(() => verifySignedOciApproval({
    ...fixture,
    expectedTrustAnchorSha256: digest("9"),
  })).toThrow("trust-anchor digest");
  expect(() => verifySignedOciApproval({
    ...fixture,
    verifiedAt: "2026-08-12T03:00:01+09:00",
  })).toThrow("approval is outside");
  expect(immutableApprovalCoordinateSchema.safeParse({
    ...fixture.coordinate,
    versionId: "null",
  }).success).toBe(false);
});

it("rejects signature tamper, a foreign signing key, and noncanonical envelope bytes", () => {
  const fixture = createSignedApprovalFixture(approval());
  const tamperedSignature = Buffer.from(fixture.envelope.signatureBase64Url, "base64url");
  tamperedSignature[0] ^= 1;
  const tamperedEnvelope = {
    ...fixture.envelope,
    signatureBase64Url: tamperedSignature.toString("base64url"),
  };
  const tampered = rebindObject(fixture, tamperedEnvelope);
  expect(() => verifySignedOciApproval({
    ...fixture,
    ...tampered,
  })).toThrow("signature verification failed");

  const foreign = createSignedApprovalFixture(approval());
  expect(() => verifySignedOciApproval({
    ...fixture,
    trustAnchor: foreign.trustAnchor,
    expectedTrustAnchorSha256: foreign.expectedTrustAnchorSha256,
  })).toThrow("signature verification failed");

  const noncanonicalBytes = Buffer.from(`${JSON.stringify(fixture.envelope, null, 2)}\n`, "utf8");
  const noncanonicalSha = `sha256:${createHash("sha256").update(noncanonicalBytes).digest("hex")}`;
  const noncanonicalCoordinate = {
    ...fixture.coordinate,
    key: `medical-ai/oci-approvals/${fixture.approval.approvalId}/${noncanonicalSha.replace(":", "-")}.jws.json`,
    objectSha256: noncanonicalSha,
  };
  expect(() => verifySignedOciApproval({
    ...fixture,
    objectBytes: noncanonicalBytes,
    coordinate: noncanonicalCoordinate,
    expectedCoordinateSha256: sha256Of(noncanonicalCoordinate),
  })).toThrow("not canonical JSON");
});

it("rejects approval windows longer than 24 hours", () => {
  expect(medicalDocumentOciApprovalSchema.safeParse({
    ...approval(),
    expiresAt: "2026-08-13T02:00:01+09:00",
  }).success).toBe(false);
  const fixture = createSignedApprovalFixture(approval());
  expect(() => verifySignedOciApproval({
    ...fixture,
    objectBytes: Buffer.alloc(32_769, "x"),
  })).toThrow("byte cap");
});
