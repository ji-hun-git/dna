import { z } from "zod";

const uuidSchema = z.string().uuid();
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._:-]{8,80}$/);
const confirmationBodySchema = z.object({ value: z.string().min(1).max(64), observedOn: z.string().date().optional() }).strict();
const conceptCodeSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

// One consent row per purpose. Research purposes are stored only; nothing in the product depends on them.
const consentPurposeCodeSchema = z.string().regex(/^(DOCUMENT_EXTRACTION|RESEARCH_USE|RESEARCH_CONTACT|PROJECT:[a-z0-9-]{1,40})$/);

// Where on the page the worker read a line: normalized 0..1, top-left origin. Display only.
const evidenceBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
}).strict();

// Why a row (or the whole file) produced no candidate. The reason list is closed.
const extractionAbstentionSchema = z.object({
  label: z.string().min(1).max(80),
  reason: z.enum(["unreadable", "ambiguous_value", "ambiguous_unit", "missing_evidence"]),
  evidencePage: z.number().int().positive().nullable().optional(),
}).strict();

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
  purposeCode: consentPurposeCodeSchema,
  status: z.enum(["NOT_GRANTED", "ACTIVE", "REVOKED"]),
}).strict();

const consentPurposeSchema = z.object({
  consentId: uuidSchema.nullable().optional(),
  purposeCode: consentPurposeCodeSchema,
  status: z.enum(["NOT_GRANTED", "ACTIVE", "REVOKED"]),
  policyVersion: z.string().min(1).max(40),
  grantedAt: z.string().datetime({ offset: true }).nullable().optional(),
  revokedAt: z.string().datetime({ offset: true }).nullable().optional(),
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
  abstentions: z.array(extractionAbstentionSchema).max(100).optional(),
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
  conceptCode: conceptCodeSchema.nullable().optional(),
  evidenceBox: evidenceBoxSchema.nullable().optional(),
  sourceType: z.literal("DOCUMENT_TEXT_LAYER"),
  extractionMethod: z.literal("native-text"),
  createdAt: z.string().datetime({ offset: true }),
  // One document yields several ordered candidates. `ordinal` is the review
  // position within `totalCandidates`, both 1-based and server-owned.
  ordinal: z.number().int().positive(),
  totalCandidates: z.number().int().positive(),
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
  // The parser's date; equals observedOn unless the person corrected the exam date on review.
  originalObservedOn: z.string().date(),
  confirmedAt: z.string().datetime({ offset: true }),
  correctionReason: z.string().min(1).max(200).nullable().optional(),
  evidencePage: z.number().int().positive(),
  sourceTextSha256: z.string().regex(/^[0-9a-f]{64}$/),
  documentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  conceptCode: conceptCodeSchema.nullable().optional(),
}).strict();

const healthEventSourceSchema = z.object({
  documentId: uuidSchema,
  page: z.number().int().positive(),
  documentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  sourceTextSha256: z.string().regex(/^[0-9a-f]{64}$/),
  previewAvailable: z.boolean(),
}).strict();

// A read-model over current records. `.strict()` is the boundary: a server
// that starts sending a reference range or a direction fails validation here.
const healthEventSchema = z.object({
  eventId: uuidSchema,
  recordId: uuidSchema,
  domain: z.enum(["lab"]),
  concept: z.string().min(1).max(80),
  // Dictionary key from the alias catalogue (null/omitted when the label matched nothing).
  conceptCode: conceptCodeSchema.nullable().optional(),
  value: z.string().min(1).max(64),
  unit: z.string().min(1).max(32),
  observedOn: z.string().date(),
  verification: z.enum(["verified", "uncertain"]),
  corrected: z.boolean(),
  confirmedAt: z.string().datetime({ offset: true }),
  originalValue: z.string().min(1).max(64),
  correctionReason: z.string().min(1).max(200).nullable().optional(),
  // The parser's exam date when the person corrected it on review; omitted when unchanged.
  originalObservedOn: z.string().date().nullable().optional(),
  source: healthEventSourceSchema,
}).strict();

const changeValueSchema = z.object({
  eventId: uuidSchema,
  value: z.string().min(1).max(64),
  observedOn: z.string().date(),
}).strict();

// The arithmetic difference between the two values: signed numbers in text, nothing else.
// `.strict()` is the boundary: a direction, colour or threshold key fails validation here.
const changeDeltaSchema = z.object({
  absolute: z.string().regex(/^[+-]?\d+(\.\d+)?$/),
  percent: z.string().regex(/^[+-]?\d+\.\d$/).nullable().optional(),
}).strict();

// This time's value beside the previous value of the same item, plus their arithmetic
// difference when both are numbers. `.strict()` is the boundary: a server that starts
// sending a direction or a range fails validation here. `previous`/`delta` are omitted
// when the server has none.
const changeItemSchema = z.object({
  conceptCode: conceptCodeSchema.nullable().optional(),
  concept: z.string().min(1).max(80),
  unit: z.string().min(1).max(32),
  latest: changeValueSchema,
  previous: changeValueSchema.nullable().optional(),
  delta: changeDeltaSchema.nullable().optional(),
}).strict();

const changeSummarySchema = z.object({
  // Omitted while the person has no completed document with current records.
  latestDocument: z.object({
    documentId: uuidSchema,
    observedOn: z.string().date(),
    completedAt: z.string().datetime({ offset: true }),
    eventCount: z.number().int().nonnegative(),
  }).strict().nullable().optional(),
  items: z.array(changeItemSchema).max(500),
  newConcepts: z.array(z.string().min(1).max(80)).max(500),
  unchangedCount: z.number().int().nonnegative(),
}).strict();

// One confirmed value in a series. No recordId, no range, no judgement: `.strict()` is the boundary.
const seriesPointSchema = z.object({
  eventId: uuidSchema,
  value: z.string().min(1).max(64),
  observedOn: z.string().date(),
  documentId: uuidSchema,
}).strict();

// Three numbers from subtraction and division, in time order. The server omits a key it cannot
// compute (Jackson non_null), so every key is optional and none is nullable; a slope, direction
// or forecast key fails validation here.
const seriesDerivedSchema = z.object({
  lastDifference: changeDeltaSchema.optional(),
  per30Days: z.string().regex(/^[+-]?\d+\.\d+$/).optional(),
  meanOfLast3: z.string().regex(/^-?\d+\.\d+$/).optional(),
}).strict();

const measurementSeriesSchema = z.object({
  conceptCode: conceptCodeSchema.optional(),
  concept: z.string().min(1).max(80),
  unit: z.string().min(1).max(32),
  points: z.array(seriesPointSchema).min(1).max(500),
  derived: seriesDerivedSchema,
}).strict();

const seriesResponseSchema = z.object({ series: z.array(measurementSeriesSchema).max(500) }).strict();

const deletionSchema = z.object({
  deletionId: uuidSchema,
  status: z.literal("COMPLETED"),
  auditEventTypes: z.array(z.string()),
  rawHealthValuesPresentInAudit: z.boolean(),
}).strict();

const problemSchema = z.object({ code: z.string().min(1).max(100) }).passthrough();

export type FoundationSession = z.infer<typeof sessionSchema>;
export type FoundationConsent = z.infer<typeof consentSchema>;
export type FoundationConsentPurpose = z.infer<typeof consentPurposeSchema>;
export type FoundationDocument = z.infer<typeof documentSchema>;
export type FoundationCandidate = z.infer<typeof candidateSchema>;
export type FoundationRecord = z.infer<typeof recordSchema>;
export type FoundationAbstention = z.infer<typeof extractionAbstentionSchema>;
export type FoundationEvidenceBox = z.infer<typeof evidenceBoxSchema>;
export type HealthEvent = z.infer<typeof healthEventSchema>;
export type FoundationDeletion = z.infer<typeof deletionSchema>;
export type ChangeSummary = z.infer<typeof changeSummarySchema>;
export type ChangeItem = z.infer<typeof changeItemSchema>;
export type SeriesResponse = z.infer<typeof seriesResponseSchema>;
export type MeasurementSeries = z.infer<typeof measurementSeriesSchema>;

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
    /** The untranslated `code` the server sent, when the failure came from a server response. */
    public readonly problemCode?: string,
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
        problem.success ? problem.data.code : undefined,
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

  function requirePurposeCode(value: string) {
    const parsed = consentPurposeCodeSchema.safeParse(value);
    if (!parsed.success) throw new FoundationClientError("validation_error", 0);
    return parsed.data;
  }

  return {
    getSession: () => request("/api/foundation/session", sessionSchema, { method: "GET" }),
    bootstrapDemo: () => request("/api/foundation/demo-session", issuedSessionSchema, { method: "POST" }),
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
    getConsents: () => request("/api/foundation/consents", z.array(consentPurposeSchema).max(50), { method: "GET" }),
    grantConsent: async (purposeCode: string, idempotencyKey: string) => request(
      `/api/foundation/consents/${encodeURIComponent(requirePurposeCode(purposeCode))}`,
      consentPurposeSchema,
      { method: "POST", headers: { "Idempotency-Key": requireIdempotencyKey(idempotencyKey) } },
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
    getCandidatesForDocument: async (documentId: string) => request(
      `/api/foundation/documents/${requireUuid(documentId)}/candidates`,
      z.array(candidateSchema),
      { method: "GET" },
    ),
    getCandidate: async (candidateId: string) => request(
      `/api/foundation/candidates/${requireUuid(candidateId)}`,
      candidateSchema,
      { method: "GET" },
    ),
    confirmCandidate: async (candidateId: string, value: string, idempotencyKey: string, observedOn?: string) => request(
      `/api/foundation/candidates/${requireUuid(candidateId)}/confirmation`,
      recordSchema,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requireIdempotencyKey(idempotencyKey),
        },
        body: JSON.stringify(confirmationBodySchema.parse({ value, observedOn })),
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
    getHealthEvents: () => request("/api/foundation/health-events", z.array(healthEventSchema), { method: "GET" }),
    getChanges: () => request("/api/foundation/changes", changeSummarySchema, { method: "GET" }),
    getSeries: () => request("/api/foundation/series", seriesResponseSchema, { method: "GET" }),
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
