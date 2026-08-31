import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { z } from "zod";
import {
  medicalDocumentOciApprovalSchema,
  type MedicalDocumentOciApproval,
} from "./runner-contracts.ts";
import { canonicalJson, sha256Of } from "./offline-runner.ts";

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const base64UrlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);

export const medicalDocumentApprovalPublicJwkSchema = z.strictObject({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  y: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  use: z.literal("sig"),
  alg: z.literal("ES256"),
  kid: z.string().regex(/^medical-oci-[a-z0-9-]+$/),
});

export const medicalDocumentApprovalTrustAnchorSchema = z.strictObject({
  schemaVersion: z.literal("medical-document-approval-trust-anchor.v1"),
  purpose: z.literal("medical-document-oci-approval"),
  publicJwk: medicalDocumentApprovalPublicJwkSchema,
  state: z.literal("active"),
  notBefore: z.string().datetime({ offset: true }),
  notAfter: z.string().datetime({ offset: true }),
}).superRefine((anchor, context) => {
  if (Date.parse(anchor.notAfter) <= Date.parse(anchor.notBefore)) {
    context.addIssue({ code: "custom", message: "approval trust-anchor window is invalid" });
  }
});

export const medicalDocumentApprovalProtectedHeaderSchema = z.strictObject({
  alg: z.literal("ES256"),
  kid: z.string().regex(/^medical-oci-[a-z0-9-]+$/),
  typ: z.literal("application/gc.medical-document-oci-approval+json"),
});

export const medicalDocumentApprovalEnvelopeSchema = z.strictObject({
  schemaVersion: z.literal("medical-document-oci-approval-envelope.v1"),
  protectedBase64Url: base64UrlSchema.max(2_048),
  payloadBase64Url: base64UrlSchema.max(24_576),
  signatureBase64Url: base64UrlSchema.length(86),
});

export const immutableApprovalCoordinateSchema = z.strictObject({
  schemaVersion: z.literal("immutable-object-coordinate.v1"),
  bucketName: z.string().regex(/^[a-z0-9](?:[a-z0-9.-]{1,61}[a-z0-9])$/),
  key: z.string().regex(/^medical-ai\/oci-approvals\/oci-approval-[a-z0-9-]+\/sha256-[0-9a-f]{64}\.jws\.json$/),
  versionId: z.string().min(1).max(1024).refine(
    (value) => value !== "null" && !/[\0-\x20\x7f]/.test(value),
    "VersionId must be an opaque non-null exact version",
  ),
  objectSha256: sha256Schema,
});

const verifiedApprovalBrand: unique symbol = Symbol("verified-medical-document-oci-approval");
export type VerifiedOciApproval = Readonly<{
  approval: MedicalDocumentOciApproval;
  coordinate: z.infer<typeof immutableApprovalCoordinateSchema>;
  trustAnchorSha256: `sha256:${string}`;
  verifiedAt: string;
  [verifiedApprovalBrand]: true;
}>;

function decodeCanonicalBase64Url(value: string): Buffer {
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length === 0 || decoded.toString("base64url") !== value) throw new Error("approval envelope contains noncanonical base64url");
  return decoded;
}

function parseCanonicalJson<T>(bytes: Buffer, schema: z.ZodType<T>, label: string): T {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error(`${label} is not valid UTF-8`);
  const parsed = schema.parse(JSON.parse(text));
  if (canonicalJson(parsed) !== text) throw new Error(`${label} is not canonical JSON`);
  return parsed;
}

export function verifySignedOciApproval(args: {
  objectBytes: Uint8Array;
  coordinate: unknown;
  expectedCoordinateSha256: string;
  trustAnchor: unknown;
  expectedTrustAnchorSha256: string;
  verifiedAt: string;
}): VerifiedOciApproval {
  const objectBytes = Buffer.from(args.objectBytes);
  if (objectBytes.length === 0 || objectBytes.length > 32_768) throw new Error("approval envelope exceeds its byte cap");
  const coordinate = immutableApprovalCoordinateSchema.parse(args.coordinate);
  const trustAnchor = medicalDocumentApprovalTrustAnchorSchema.parse(args.trustAnchor);
  const canonicalVerifiedAt = z.string().datetime({ offset: true }).parse(args.verifiedAt);
  const verifiedAt = Date.parse(canonicalVerifiedAt);
  if (sha256Of(coordinate) !== args.expectedCoordinateSha256) throw new Error("approval coordinate digest mismatch");
  if (sha256Of(trustAnchor) !== args.expectedTrustAnchorSha256) throw new Error("approval trust-anchor digest mismatch");
  if (verifiedAt < Date.parse(trustAnchor.notBefore) || verifiedAt > Date.parse(trustAnchor.notAfter)) {
    throw new Error("approval trust anchor is outside its validity window");
  }

  const envelope = parseCanonicalJson(objectBytes, medicalDocumentApprovalEnvelopeSchema, "approval envelope");
  const protectedBytes = decodeCanonicalBase64Url(envelope.protectedBase64Url);
  const payloadBytes = decodeCanonicalBase64Url(envelope.payloadBase64Url);
  const signature = decodeCanonicalBase64Url(envelope.signatureBase64Url);
  if (signature.length !== 64) throw new Error("ES256 signature must use a 64-byte P1363 encoding");
  const protectedHeader = parseCanonicalJson(protectedBytes, medicalDocumentApprovalProtectedHeaderSchema, "approval protected header");
  const approval = parseCanonicalJson(payloadBytes, medicalDocumentOciApprovalSchema, "approval payload");

  if (protectedHeader.kid !== trustAnchor.publicJwk.kid) throw new Error("approval signing key ID does not match the trust anchor");
  if (verifiedAt < Date.parse(approval.approvedAt) || verifiedAt > Date.parse(approval.expiresAt)) {
    throw new Error("OCI approval is outside its validity window");
  }

  const objectDigest = `sha256:${createHash("sha256").update(objectBytes).digest("hex")}` as `sha256:${string}`;
  if (coordinate.objectSha256 !== objectDigest) throw new Error("approval object digest mismatch");
  const expectedKey = `medical-ai/oci-approvals/${approval.approvalId}/${objectDigest.replace(":", "-")}.jws.json`;
  if (coordinate.key !== expectedKey) throw new Error("approval object key does not match its payload and digest");

  const publicKey = createPublicKey({
    key: {
      kty: trustAnchor.publicJwk.kty,
      crv: trustAnchor.publicJwk.crv,
      x: trustAnchor.publicJwk.x,
      y: trustAnchor.publicJwk.y,
    },
    format: "jwk",
  });
  const signingInput = Buffer.from(`${envelope.protectedBase64Url}.${envelope.payloadBase64Url}`, "ascii");
  if (!verifySignature("sha256", signingInput, { key: publicKey, dsaEncoding: "ieee-p1363" }, signature)) {
    throw new Error("approval signature verification failed");
  }

  return Object.freeze({
    approval: Object.freeze(approval),
    coordinate: Object.freeze(coordinate),
    trustAnchorSha256: args.expectedTrustAnchorSha256 as `sha256:${string}`,
    verifiedAt: canonicalVerifiedAt,
    [verifiedApprovalBrand]: true as const,
  });
}

export function unwrapVerifiedOciApproval(value: unknown): VerifiedOciApproval {
  if (!value || typeof value !== "object" || (value as Partial<VerifiedOciApproval>)[verifiedApprovalBrand] !== true) {
    throw new Error("OCI invocation requires an authenticated approval envelope");
  }
  return value as VerifiedOciApproval;
}
