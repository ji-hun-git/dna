import { describe, expect, it, vi } from "vitest";
import {
  createFoundationClient,
  FoundationClientError,
} from "@/lib/foundation/client";
import { syntheticHealthEvent, syntheticSeries } from "./fixtures/foundation";

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
    sourceType: "DOCUMENT_TEXT_LAYER",
    extractionMethod: "native-text",
    conceptCode: "total-cholesterol",
    evidenceBox: { x: 0.08, y: 0.1, width: 0.3, height: 0.02 },
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

  it("reads health events and rejects interpretation fields", async () => {
    const fetcher = vi.fn(async () => jsonResponse([syntheticHealthEvent()]));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    const events = await client.getHealthEvents();

    expect(events).toHaveLength(1);
    expect(events[0].concept).toBe("총콜레스테롤");
    expect(events[0].source.previewAvailable).toBe(true);
    expect(events[0].conceptCode).toBe("total-cholesterol");
    const uncodedFetcher = vi.fn(async () => jsonResponse([{ ...syntheticHealthEvent(), conceptCode: undefined }]));
    const uncodedEvents = await createFoundationClient({ fetcher: uncodedFetcher, readCsrfToken: () => "csrf-value" }).getHealthEvents();
    expect(uncodedEvents[0].conceptCode).toBeUndefined();
    const badCodeFetcher = vi.fn(async () => jsonResponse([{ ...syntheticHealthEvent(), conceptCode: "Total Cholesterol" }]));
    await expect(createFoundationClient({ fetcher: badCodeFetcher, readCsrfToken: () => "csrf-value" }).getHealthEvents()).rejects.toThrow();

    const rejectingFetcher = vi.fn(async () => jsonResponse([
      { ...syntheticHealthEvent(), referenceRange: { high: 130 } },
    ]));
    const rejectingClient = createFoundationClient({ fetcher: rejectingFetcher, readCsrfToken: () => "csrf-value" });

    await expect(rejectingClient.getHealthEvents()).rejects.toThrow();

    const nestedRejectingFetcher = vi.fn(async () => jsonResponse([
      { ...syntheticHealthEvent(), source: { ...syntheticHealthEvent().source, direction: "high" } },
    ]));
    const nestedRejectingClient = createFoundationClient({ fetcher: nestedRejectingFetcher, readCsrfToken: () => "csrf-value" });

    await expect(nestedRejectingClient.getHealthEvents()).rejects.toThrow();
  });

  it("rejects a candidate that still claims the retired fixture method and accepts an uncoded one", async () => {
    const stale = vi.fn(async () => jsonResponse([syntheticCandidate({ sourceType: "SYNTHETIC_FIXED_FIXTURE", extractionMethod: "DETERMINISTIC_FOUNDATION_FIXTURE" })]));
    await expect(createFoundationClient({ fetcher: stale, readCsrfToken: () => "csrf-value" }).getCandidatesForDocument("e64ddaae-a326-4f23-88a9-05ac59a48625"))
      .rejects.toMatchObject({ code: "invalid_server_response" });

    const { conceptCode: _code, evidenceBox: _box, ...uncoded } = syntheticCandidate({ label: "알 수 없는 항목" });
    const fetcher = vi.fn(async () => jsonResponse([uncoded]));
    const [candidate] = await createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" }).getCandidatesForDocument("e64ddaae-a326-4f23-88a9-05ac59a48625");
    expect(candidate.conceptCode).toBeUndefined();
    expect(candidate.evidenceBox).toBeUndefined();
  });

  it("reads a completed document with its abstentions", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      documentId: "e64ddaae-a326-4f23-88a9-05ac59a48625",
      status: "COMPLETED",
      sha256: "a".repeat(64),
      contentLength: 2048,
      stateVersion: 6,
      previewAvailable: true,
      quarantineBoundary: "HOSTILE_DOCUMENT_TRUST_ZONE",
      abstentions: [{ label: "문서 전체", reason: "unreadable" }, { label: "LDL", reason: "ambiguous_value", evidencePage: 1 }],
    }));
    const document = await createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" }).getDocument("e64ddaae-a326-4f23-88a9-05ac59a48625");
    expect(document.abstentions?.map((item) => item.reason)).toEqual(["unreadable", "ambiguous_value"]);
    const bad = vi.fn(async () => jsonResponse({ ...(await (await fetcher()).json()), abstentions: [{ label: "x", reason: "low_confidence" }] }));
    await expect(createFoundationClient({ fetcher: bad, readCsrfToken: () => "csrf-value" }).getDocument("e64ddaae-a326-4f23-88a9-05ac59a48625")).rejects.toThrow();
  });

  it("accepts a change summary whose null members are omitted and refuses a judgement field", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ items: [], newConcepts: [], unchangedCount: 0 }));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getChanges()).resolves.toEqual({ items: [], newConcepts: [], unchangedCount: 0 });
    expect(fetcher).toHaveBeenCalledWith("/api/foundation/changes", expect.objectContaining({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }));

    const judging = createFoundationClient({
      fetcher: vi.fn(async () => jsonResponse({
        items: [{
          concept: "총콜레스테롤",
          unit: "mg/dL",
          latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
          direction: "down",
        }],
        newConcepts: [],
        unchangedCount: 0,
      })),
      readCsrfToken: () => "csrf-value",
    });
    await expect(judging.getChanges()).rejects.toMatchObject({ code: "invalid_server_response" });

    const withDelta = createFoundationClient({
      fetcher: vi.fn(async () => jsonResponse({
        items: [{
          concept: "총콜레스테롤",
          unit: "mg/dL",
          latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
          previous: { eventId: "9c3e4f50-6172-4c8d-ae9f-1a2b3c4d5e60", value: "194", observedOn: "2026-01-15" },
          delta: { absolute: "-6", percent: "-3.1" },
        }],
        newConcepts: [],
        unchangedCount: 0,
      })),
      readCsrfToken: () => "csrf-value",
    });
    await expect(withDelta.getChanges()).resolves.toMatchObject({ items: [{ delta: { absolute: "-6", percent: "-3.1" } }] });

    const deltaWithDirection = createFoundationClient({
      fetcher: vi.fn(async () => jsonResponse({
        items: [{
          concept: "총콜레스테롤",
          unit: "mg/dL",
          latest: { eventId: "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50", value: "188", observedOn: "2026-07-28" },
          previous: { eventId: "9c3e4f50-6172-4c8d-ae9f-1a2b3c4d5e60", value: "194", observedOn: "2026-01-15" },
          delta: { absolute: "-6", percent: "-3.1", direction: "down" },
        }],
        newConcepts: [],
        unchangedCount: 0,
      })),
      readCsrfToken: () => "csrf-value",
    });
    await expect(deltaWithDirection.getChanges()).rejects.toMatchObject({ code: "invalid_server_response" });
  });

  it("reads the measurement series with omitted derived keys and refuses a direction, a range or a null", async () => {
    const fetcher = vi.fn(async () => jsonResponse(syntheticSeries()));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    const loaded = await client.getSeries();
    expect(loaded.series.map((item) => item.concept)).toEqual(["당화혈색소", "비타민 D", "총콜레스테롤"]);
    expect(loaded.series[2].derived).toEqual({ lastDifference: { absolute: "-4", percent: "-2.1" }, per30Days: "-0.6" });
    expect(loaded.series[1].derived).toEqual({});
    expect(fetcher).toHaveBeenCalledWith("/api/foundation/series", expect.objectContaining({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    }));

    const base = syntheticSeries().series[2];
    for (const broken of [
      { ...base, direction: "down" },
      { ...base, referenceRangeText: "120-199" },
      { ...base, derived: { ...base.derived, slope: "-0.02" } },
      { ...base, derived: { ...base.derived, meanOfLast3: null } },
      { ...base, derived: { ...base.derived, per30Days: "-0.6 mg/dL" } },
      { ...base, points: [{ ...base.points[0], recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c40" }] },
      { ...base, points: [] },
    ]) {
      const rejecting = createFoundationClient({ fetcher: vi.fn(async () => jsonResponse({ series: [broken] })), readCsrfToken: () => "csrf-value" });
      await expect(rejecting.getSeries()).rejects.toMatchObject({ code: "invalid_server_response" });
    }
  });

  it("reads the consent list, grants a purpose with an idempotency key and refuses an unknown purpose", async () => {
    const list = [
      { purposeCode: "DOCUMENT_EXTRACTION", status: "NOT_GRANTED", policyVersion: "foundation-v1" },
      { consentId: "89116f1a-2026-457e-8942-409ff8f8fc4f", purposeCode: "RESEARCH_USE", status: "ACTIVE", policyVersion: "research-consent-policy.v1", grantedAt: "2026-07-28T09:00:00Z" },
      { purposeCode: "RESEARCH_CONTACT", status: "NOT_GRANTED", policyVersion: "research-contact-policy.v1" },
    ];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? jsonResponse(list[1], 201)
      : jsonResponse(list));
    const client = createFoundationClient({ fetcher, readCsrfToken: () => "csrf-value" });

    await expect(client.getConsents()).resolves.toHaveLength(3);
    await expect(client.grantConsent("RESEARCH_USE", "consent-000000000001")).resolves.toMatchObject({ status: "ACTIVE" });
    const [path, request] = fetcher.mock.calls[1] as unknown as [string, RequestInit];
    expect(path).toBe("/api/foundation/consents/RESEARCH_USE");
    expect(new Headers(request.headers).get("Idempotency-Key")).toBe("consent-000000000001");
    expect(new Headers(request.headers).get("X-GC-CSRF")).toBe("csrf-value");
    await expect(client.grantConsent("STUDY-1", "consent-000000000002")).rejects.toMatchObject({ code: "validation_error" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

