import { z } from "zod";

const uuidSchema = z.string().uuid();
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._:-]{8,80}$/);

const sessionSchema = z.object({
  sessionId: uuidSchema,
  subjectId: z.string().regex(/^synthetic-[a-z0-9-]+$/),
  status: z.literal("AUTHENTICATED"),
  expiresAt: z.string().datetime({ offset: true }),
}).strict();

const issuedSessionSchema = sessionSchema.extend({ csrfToken: z.string().min(32).max(256) }).strict();

const consentSchema = z.object({
  // The API deliberately omits null JSON properties. NOT_GRANTED therefore has
  // no consentId, while ACTIVE and REVOKED carry a UUID.
  consentId: uuidSchema.nullable().optional(),
  purposeCode: z.literal("DOCUMENT_EXTRACTION"),
  status: z.enum(["NOT_GRANTED", "ACTIVE", "REVOKED"]),
}).strict();

const documentSchema = z.object({
  documentId: uuidSchema,
  status: z.enum([
    "UPLOAD_PENDING",
    "UNTRUSTED_OBJECT",
    "SECURITY_INSPECTION",
    "SECURITY_REJECTED",
    "SECURITY_APPROVED",
    "EXTRACTION_QUEUED",
    "EXTRACTION_RUNNING",
    "REVIEW_REQUIRED",
    "COMPLETED",
    "DELETION_PENDING",
    "DELETED",
    "FAILED_RETRYABLE",
    "FAILED_TERMINAL",
  ]),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
  contentLength: z.number().int().nonnegative().nullable().optional(),
  stateVersion: z.number().int().nonnegative(),
  failureCode: z.string().regex(/^[a-z0-9_]{3,80}$/).nullable().optional(),
  previewAvailable: z.boolean(),
  quarantineBoundary: z.literal("HOSTILE_DOCUMENT_TRUST_ZONE"),
}).strict();

const uploadCapabilitySchema = z.object({
  capabilityId: uuidSchema,
  method: z.literal("PUT"),
  uploadPath: z.string().regex(/^\/api\/foundation\/documents\/[0-9a-f-]{36}\/content$/),
  expiresAt: z.string().datetime({ offset: true }),
  expectedLength: z.number().int().min(64).max(10_485_760),
  expectedSha256: z.string().regex(/^[0-9a-f]{64}$/),
  requiredHeaders: z.object({
    "Content-Type": z.literal("application/pdf"),
    "X-GC-Upload-Capability-Id": uuidSchema,
    "X-GC-Upload-Capability": z.string().min(32).max(256),
  }).strict(),
  replaySemantics: z.literal("REUSABLE_BEFORE_FINALIZATION_UNTIL_EXPIRY_SAME_OBJECT_SAME_BYTES_ONLY"),
}).strict();

const documentTicketSchema = z.object({
  document: documentSchema,
  uploadCapability: uploadCapabilitySchema,
}).strict();

// Spring omits null properties. A subject without an active document therefore
// receives `{}`, while an active lifecycle receives a validated document.
const documentActivitySchema = z.object({ document: documentSchema.nullable().optional() }).strict();

const candidateSchema = z.object({
  candidateId: uuidSchema,
  documentId: uuidSchema,
  status: z.enum(["PENDING", "CONFIRMED", "EXCLUDED"]),
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(64),
  unit: z.string().min(1).max(32),
  observedOn: z.string().date(),
  evidencePage: z.number().int().positive(),
  sourceTextSha256: z.string().regex(/^[0-9a-f]{64}$/),
  documentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  sourceType: z.literal("SYNTHETIC_FIXED_FIXTURE"),
  extractionMethod: z.literal("DETERMINISTIC_FOUNDATION_FIXTURE"),
  createdAt: z.string().datetime({ offset: true }),
}).strict();

const recordSchema = z.object({
  recordId: uuidSchema,
  recordVersionId: uuidSchema,
  supersedesVersionId: uuidSchema.nullable().optional(),
  candidateId: uuidSchema,
  documentId: uuidSchema,
  status: z.enum(["CURRENT", "SUPERSEDED"]),
  reviewDecision: z.enum(["CONFIRMED", "CORRECTED"]),
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(64),
  originalValue: z.string().min(1).max(64),
  unit: z.string().min(1).max(32),
  observedOn: z.string().date(),
  confirmedAt: z.string().datetime({ offset: true }),
  correctionReason: z.string().min(1).max(200).nullable().optional(),
  evidencePage: z.number().int().positive(),
  sourceTextSha256: z.string().regex(/^[0-9a-f]{64}$/),
  documentSha256: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

const deletionSchema = z.object({
  deletionId: uuidSchema,
  status: z.literal("COMPLETED"),
  auditEventTypes: z.array(z.string()),
  rawHealthValuesPresentInAudit: z.boolean(),
}).strict();

const problemSchema = z.object({ code: z.string().min(1).max(100) }).passthrough();

export type FoundationSession = z.infer<typeof sessionSchema>;
export type FoundationConsent = z.infer<typeof consentSchema>;
export type FoundationDocument = z.infer<typeof documentSchema>;
export type FoundationCandidate = z.infer<typeof candidateSchema>;
export type FoundationRecord = z.infer<typeof recordSchema>;
export type FoundationDeletion = z.infer<typeof deletionSchema>;

export type FoundationErrorCode =
  | "authentication_required"
  | "session_expired"
  | "forbidden"
  | "consent_required"
  | "consent_revoked"
  | "resource_not_found"
  | "conflict"
  | "invalid_state_transition"
  | "validation_error"
  | "upload_rejected"
  | "processing_failed"
  | "retryable_dependency_failure"
  | "rate_limited"
  | "internal_error"
  | "invalid_server_response"
  | "csrf_unavailable"
  | "network_unavailable";

export class FoundationClientError extends Error {
  constructor(
    public readonly code: FoundationErrorCode,
    public readonly status: number,
  ) {
    super(code);
    this.name = "FoundationClientError";
  }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type FoundationClientOptions = {
  fetcher?: Fetcher;
  readCsrfToken?: () => string | null;
};

function browserCsrfToken() {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("GC_CSRF="));
  return entry ? decodeURIComponent(entry.slice("GC_CSRF=".length)) : null;
}

function mapProblem(code: string, status: number): FoundationErrorCode {
  if (code === "session_required") return "authentication_required";
  if (code === "session_invalid") return "session_expired";
  if (["local_identity_denied", "origin_denied", "csrf_denied", "foundation_principal_missing"].includes(code)) {
    return "forbidden";
  }
  if (code === "active_consent_required") return "consent_required";
  if (code === "consent_revoked") return "consent_revoked";
  if (code.endsWith("_not_found")) return "resource_not_found";
  if (code === "document_rejected" || code === "pdf_required" || code === "document_size_invalid") {
    return "upload_rejected";
  }
  if (code.startsWith("document_not_") || code.endsWith("_not_pending") || code === "document_state_changed") {
    return "invalid_state_transition";
  }
  if (code.includes("conflict") || code === "document_already_uploaded") return "conflict";
  if (code === "rate_limited") return "rate_limited";
  if (code === "processing_failed") return "processing_failed";
  if (code === "retryable_dependency_failure") return "retryable_dependency_failure";
  if (status === 400 || code.endsWith("_invalid")) return "validation_error";
  if (status === 401) return "authentication_required";
  if (status === 403) return "forbidden";
  if (status === 404) return "resource_not_found";
  if (status === 409) return "conflict";
  return "internal_error";
}

export function createFoundationClient(options: FoundationClientOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const readCsrfToken = options.readCsrfToken ?? browserCsrfToken;

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
    mutation = false,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (mutation) {
      const csrf = readCsrfToken();
      if (!csrf) throw new FoundationClientError("csrf_unavailable", 0);
      headers.set("X-GC-CSRF", csrf);
    }
    let response: Response;
    try {
      response = await fetcher(path, {
        ...init,
        headers,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
      });
    } catch {
      throw new FoundationClientError("network_unavailable", 0);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new FoundationClientError(response.ok ? "invalid_server_response" : "internal_error", response.status);
    }
    if (!response.ok) {
      const problem = problemSchema.safeParse(body);
      throw new FoundationClientError(
        mapProblem(problem.success ? problem.data.code : "internal_error", response.status),
        response.status,
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new FoundationClientError("invalid_server_response", response.status);
    return parsed.data;
  }

  function requireUuid(value: string) {
    const parsed = uuidSchema.safeParse(value);
    if (!parsed.success) throw new FoundationClientError("validation_error", 0);
    return parsed.data;
  }

  function requireIdempotencyKey(value: string) {
    const parsed = idempotencyKeySchema.safeParse(value);
    if (!parsed.success) throw new FoundationClientError("validation_error", 0);
    return parsed.data;
  }

  return {
    getSession: () => request("/api/foundation/session", sessionSchema, { method: "GET" }),
    createSession: (subjectId: string, credential: string) => request(
      "/api/foundation/session",
      issuedSessionSchema,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, credential }),
      },
    ),
    getDocumentConsent: () => request(
      "/api/foundation/consents/document-extraction",
      consentSchema,
      { method: "GET" },
    ),
    grantDocumentConsent: () => request(
      "/api/foundation/consents/document-extraction",
      consentSchema,
      { method: "POST" },
      true,
    ),
    requestDocument: async (
      consentId: string,
      contentLength: number,
      sha256: string,
      idempotencyKey: string,
    ) => request(
      "/api/foundation/documents",
      documentTicketSchema,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requireIdempotencyKey(idempotencyKey),
        },
        body: JSON.stringify({
          consentId: requireUuid(consentId),
          mediaType: "application/pdf",
          contentLength,
          sha256,
        }),
      },
      true,
    ),
    uploadDocument: async (
      capability: z.infer<typeof uploadCapabilitySchema>,
      content: Blob | ArrayBuffer | Uint8Array,
    ) => request(
      capability.uploadPath,
      documentSchema,
      { method: "PUT", headers: capability.requiredHeaders, body: content as BodyInit },
      true,
    ),
    finalizeDocument: async (documentId: string) => request(
      `/api/foundation/documents/${requireUuid(documentId)}/finalization`,
      documentSchema,
      { method: "POST" },
      true,
    ),
    getDocument: async (documentId: string) => request(
      `/api/foundation/documents/${requireUuid(documentId)}`,
      documentSchema,
      { method: "GET" },
    ),
    getActiveDocument: async () => request(
      "/api/foundation/documents/active",
      documentActivitySchema,
      { method: "GET" },
    ),
    getCandidateForDocument: async (documentId: string) => request(
      `/api/foundation/documents/${requireUuid(documentId)}/candidate`,
      candidateSchema,
      { method: "GET" },
    ),
    getCandidate: async (candidateId: string) => request(
      `/api/foundation/candidates/${requireUuid(candidateId)}`,
      candidateSchema,
      { method: "GET" },
    ),
    confirmCandidate: async (candidateId: string, value: string, idempotencyKey: string) => request(
      `/api/foundation/candidates/${requireUuid(candidateId)}/confirmation`,
      recordSchema,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requireIdempotencyKey(idempotencyKey),
        },
        body: JSON.stringify({ value }),
      },
      true,
    ),
    excludeCandidate: async (candidateId: string, idempotencyKey: string) => request(
      `/api/foundation/candidates/${requireUuid(candidateId)}/exclusion`,
      candidateSchema,
      { method: "POST", headers: { "Idempotency-Key": requireIdempotencyKey(idempotencyKey) } },
      true,
    ),
    getRecords: () => request("/api/foundation/records", z.array(recordSchema), { method: "GET" }),
    getRecord: async (recordId: string) => request(
      `/api/foundation/records/${requireUuid(recordId)}`,
      recordSchema,
      { method: "GET" },
    ),
    correctRecord: async (recordId: string, value: string, reason: string, idempotencyKey: string) => request(
      `/api/foundation/records/${requireUuid(recordId)}/corrections`,
      recordSchema,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requireIdempotencyKey(idempotencyKey),
        },
        body: JSON.stringify({ value, reason }),
      },
      true,
    ),
    revokeConsent: async (consentId: string) => request(
      `/api/foundation/consents/${requireUuid(consentId)}/revocation`,
      consentSchema,
      { method: "POST" },
      true,
    ),
    deleteProfile: () => request("/api/foundation/profile", deletionSchema, { method: "DELETE" }, true),
  };
}

export async function sha256Blob(content: Blob): Promise<string> {
  if (content.size > 10_485_760) throw new FoundationClientError("validation_error", 0);
  const digest = await crypto.subtle.digest("SHA-256", await content.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type FoundationClient = ReturnType<typeof createFoundationClient>;
