import { describe, expect, it, vi } from "vitest";
import {
  createFoundationClient,
  FoundationClientError,
} from "@/lib/foundation/client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": status >= 400 ? "application/problem+json" : "application/json" },
  });
}

function syntheticCandidate(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b001",
    documentId: "e64ddaae-a326-4f23-88a9-05ac59a48625",
    status: "PENDING",
    label: "총콜레스테롤",
    value: "188",
    unit: "mg/dL",
    observedOn: "2026-07-28",
    evidencePage: 1,
    sourceTextSha256: "b".repeat(64),
    documentSha256: "a".repeat(64),
    sourceType: "SYNTHETIC_FIXED_FIXTURE",
    extractionMethod: "DETERMINISTIC_FOUNDATION_FIXTURE",
    createdAt: "2026-08-30T08:00:00Z",
    ordinal: 1,
    totalCandidates: 3,
    ...overrides,
  };
}

describe("foundation same-origin client", () => {
  it("restores a validated server session without caching or exposing credentials", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      sessionId: "ca9d1f51-b0b6-4d12-a5c1-05938e2c1c9b",
      subjectId: "synthetic-jason",
      status: "AUTHENTICATED",
      expiresAt: "2026-08-30T08:30:00Z",
    }));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getSession()).resolves.toMatchObject({
      subjectId: "synthetic-jason",
      status: "AUTHENTICATED",
    });
    expect(fetcher).toHaveBeenCalledWith("/api/foundation/session", expect.objectContaining({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }));
  });

  it("attaches the synchronizer CSRF value to a fixed same-origin mutation", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      consentId: "89116f1a-2026-457e-8942-409ff8f8fc4f",
      purposeCode: "DOCUMENT_EXTRACTION",
      status: "ACTIVE",
    }, 201));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await client.grantDocumentConsent();

    const [path, request] = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit | undefined];
    expect(path).toBe("/api/foundation/consents/document-extraction");
    expect(request).toMatchObject({ method: "POST", credentials: "include", cache: "no-store" });
    expect(new Headers(request?.headers).get("X-GC-CSRF")).toBe("csrf-value");
  });

  it("accepts the truthful NOT_GRANTED consent shape when null fields are omitted", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      purposeCode: "DOCUMENT_EXTRACTION",
      status: "NOT_GRANTED",
    }));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getDocumentConsent()).resolves.toEqual({
      purposeCode: "DOCUMENT_EXTRACTION",
      status: "NOT_GRANTED",
    });
  });

  it("accepts the truthful empty active-document shape when null fields are omitted", async () => {
    const fetcher = vi.fn(async () => jsonResponse({}));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getActiveDocument()).resolves.toEqual({});
  });

  it("accepts only a digest-bound bounded upload capability", async () => {
    const documentId = "e64ddaae-a326-4f23-88a9-05ac59a48625";
    const capabilityId = "8df1e2d3-9f19-4dd0-91bc-0566dc36f9d0";
    const digest = "a".repeat(64);
    const fetcher = vi.fn(async () => jsonResponse({
      document: {
        documentId,
        status: "UPLOAD_PENDING",
        stateVersion: 0,
        previewAvailable: false,
        quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
      },
      uploadCapability: {
        capabilityId,
        method: "PUT",
        uploadPath: `/api/foundation/documents/${documentId}/content`,
        expiresAt: "2026-08-30T08:05:00Z",
        expectedLength: 64,
        expectedSha256: digest,
        requiredHeaders: {
          "Content-Type": "application/pdf",
          "X-GC-Upload-Capability-Id": capabilityId,
          "X-GC-Upload-Capability": "bounded-synthetic-capability-value-0001",
        },
        replaySemantics: "REUSABLE_BEFORE_FINALIZATION_UNTIL_EXPIRY_SAME_OBJECT_SAME_BYTES_ONLY",
      },
    }, 201));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.requestDocument(
      "89116f1a-2026-457e-8942-409ff8f8fc4f",
      64,
      digest,
      "document-test-key",
    )).resolves.toMatchObject({ document: { documentId, status: "UPLOAD_PENDING" } });
  });

  it("fails closed before a mutation when the CSRF value is unavailable", async () => {
    const fetcher = vi.fn();
    const client = createFoundationClient({ fetcher, readCsrfToken: () => null });

    await expect(client.grantDocumentConsent()).rejects.toMatchObject({ code: "csrf_unavailable" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps an expired server session to the stable application error vocabulary", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ code: "session_invalid" }, 401));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getRecords()).rejects.toEqual(
      expect.objectContaining<Partial<FoundationClientError>>({ code: "session_expired", status: 401 }),
    );
  });

  it("rejects malformed successful responses instead of trusting TypeScript types", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ sessionId: "not-a-uuid", status: "AUTHENTICATED" }));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getSession()).rejects.toMatchObject({ code: "invalid_server_response" });
  });

  it("rejects attacker-shaped resource identifiers before constructing a request path", async () => {
    const fetcher = vi.fn();
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getRecord("../../another-user")).rejects.toMatchObject({ code: "validation_error" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reads every ordered candidate of a document with its review position", async () => {
    const documentId = "e64ddaae-a326-4f23-88a9-05ac59a48625";
    const fetcher = vi.fn(async () => jsonResponse([
      syntheticCandidate({ candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b001", ordinal: 1, label: "총콜레스테롤", value: "188", unit: "mg/dL" }),
      syntheticCandidate({ candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b002", ordinal: 2, label: "당화혈색소", value: "6.1", unit: "%" }),
      syntheticCandidate({ candidateId: "3f5b0f0a-2d31-4a5f-9d54-2f4bd5f1b003", ordinal: 3, label: "비타민 D", value: "31", unit: "ng/mL" }),
    ]));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    const candidates = await client.getCandidatesForDocument(documentId);

    expect(candidates.map((candidate) => candidate.ordinal)).toEqual([1, 2, 3]);
    expect(candidates[1]).toMatchObject({ value: "6.1", totalCandidates: 3 });
    expect(fetcher).toHaveBeenCalledWith(
      `/api/foundation/documents/${documentId}/candidates`,
      expect.objectContaining({ method: "GET", credentials: "include", cache: "no-store" }),
    );
  });

  it("rejects a candidate list that omits the review position", async () => {
    const { ordinal: _ordinal, ...withoutOrdinal } = syntheticCandidate({ ordinal: 1 });
    const fetcher = vi.fn(async () => jsonResponse([withoutOrdinal]));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getCandidatesForDocument("e64ddaae-a326-4f23-88a9-05ac59a48625"))
      .rejects.toMatchObject({ code: "invalid_server_response" });
  });

  it("keeps the single-candidate endpoint bound to the same validated shape", async () => {
    const fetcher = vi.fn(async () => jsonResponse(syntheticCandidate({ ordinal: 2 })));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getCandidateForDocument("e64ddaae-a326-4f23-88a9-05ac59a48625"))
      .resolves.toMatchObject({ ordinal: 2, totalCandidates: 3 });
  });
});

