import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  medicalDocumentApprovalEnvelopeSchema,
  medicalDocumentApprovalProtectedHeaderSchema,
  medicalDocumentApprovalTrustAnchorSchema,
  verifySignedOciApproval,
} from "@/lib/medical-ai/approval-verifier";
import { canonicalJson, sha256Of } from "@/lib/medical-ai/offline-runner";
import { medicalDocumentOciApprovalSchema } from "@/lib/medical-ai/runner-contracts";

export function createSignedApprovalFixture(approvalInput: unknown) {
  const approval = medicalDocumentOciApprovalSchema.parse(approvalInput);
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const exported = publicKey.export({ format: "jwk" });
  const publicJwk = {
    kty: "EC" as const,
    crv: "P-256" as const,
    x: exported.x,
    y: exported.y,
    use: "sig" as const,
    alg: "ES256" as const,
    kid: "medical-oci-contract-test-key",
  };
  const trustAnchor = medicalDocumentApprovalTrustAnchorSchema.parse({
    schemaVersion: "medical-document-approval-trust-anchor.v1",
    purpose: "medical-document-oci-approval",
    publicJwk,
    state: "active",
    notBefore: "2026-08-12T00:00:00+09:00",
    notAfter: "2026-08-13T00:00:00+09:00",
  });
  const protectedHeader = medicalDocumentApprovalProtectedHeaderSchema.parse({
    alg: "ES256",
    kid: publicJwk.kid,
    typ: "application/gc.medical-document-oci-approval+json",
  });
  const protectedBase64Url = Buffer.from(canonicalJson(protectedHeader), "utf8").toString("base64url");
  const payloadBase64Url = Buffer.from(canonicalJson(approval), "utf8").toString("base64url");
  const signingInput = Buffer.from(`${protectedBase64Url}.${payloadBase64Url}`, "ascii");
  const signatureBase64Url = sign("sha256", signingInput, {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  const envelope = medicalDocumentApprovalEnvelopeSchema.parse({
    schemaVersion: "medical-document-oci-approval-envelope.v1",
    protectedBase64Url,
    payloadBase64Url,
    signatureBase64Url,
  });
  const objectBytes = Buffer.from(canonicalJson(envelope), "utf8");
  const objectSha256 = `sha256:${createHash("sha256").update(objectBytes).digest("hex")}`;
  const coordinate = {
    schemaVersion: "immutable-object-coordinate.v1",
    bucketName: "gc-test-medical-ai-approvals",
    key: `medical-ai/oci-approvals/${approval.approvalId}/${objectSha256.replace(":", "-")}.jws.json`,
    versionId: "contract-test-version-0001",
    objectSha256,
  };
  const expectedCoordinateSha256 = sha256Of(coordinate);
  const expectedTrustAnchorSha256 = sha256Of(trustAnchor);
  const verifiedAt = "2026-08-12T02:02:00+09:00";
  const verifiedApproval = verifySignedOciApproval({
    objectBytes,
    coordinate,
    expectedCoordinateSha256,
    trustAnchor,
    expectedTrustAnchorSha256,
    verifiedAt,
  });
  return {
    approval,
    envelope,
    objectBytes,
    coordinate,
    trustAnchor,
    expectedCoordinateSha256,
    expectedTrustAnchorSha256,
    verifiedAt,
    verifiedApproval,
  };
}
