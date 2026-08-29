import { expect, test, type Page } from "@playwright/test";

type BrowserApiResult = {
  status: number;
  body: Record<string, unknown> | Array<Record<string, unknown>>;
};

async function browserApi(
  page: Page,
  path: string,
  options: {
    method?: string;
    csrf?: string;
    idempotencyKey?: string;
    contentType?: string;
    body?: string;
  } = {},
): Promise<BrowserApiResult> {
  return page.evaluate(async ({ path: target, options: requestOptions }) => {
    const headers = new Headers();
    if (requestOptions.csrf) headers.set("X-GC-CSRF", requestOptions.csrf);
    if (requestOptions.idempotencyKey) headers.set("Idempotency-Key", requestOptions.idempotencyKey);
    if (requestOptions.contentType) headers.set("Content-Type", requestOptions.contentType);
    const response = await fetch(target, {
      method: requestOptions.method ?? "GET",
      headers,
      body: requestOptions.body,
      credentials: "include",
      cache: "no-store",
    });
    return {
      status: response.status,
      body: await response.json(),
    };
  }, { path, options });
}

test("browser persists reloads revokes and deletes the synthetic lifecycle", async ({ page }) => {
  const subjectId = process.env.GC_BROWSER_SUBJECT!;
  const credential = process.env.GC_BROWSER_CREDENTIAL!;
  const fixtureText = process.env.GC_BROWSER_FIXTURE_TEXT!;
  const runKey = String(process.pid);

  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute(
    "data-application-instance",
    "playwright-foundation-browser-e2e",
  );

  const session = await browserApi(page, "/api/foundation/session", {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify({ subjectId, credential }),
  });
  expect(session.status, JSON.stringify(session.body)).toBe(201);
  const csrf = String((session.body as Record<string, unknown>).csrfToken);

  const consent = await browserApi(page, "/api/foundation/consents/document-extraction", {
    method: "POST",
    csrf,
  });
  expect(consent.status).toBe(201);
  const consentId = String((consent.body as Record<string, unknown>).consentId);

  const documentTicket = await browserApi(page, "/api/foundation/documents", {
    method: "POST",
    csrf,
    idempotencyKey: "browser-document-" + runKey,
    contentType: "application/json",
    body: JSON.stringify({
      consentId,
      mediaType: "application/pdf",
      contentLength: new TextEncoder().encode(fixtureText).byteLength,
    }),
  });
  expect(documentTicket.status).toBe(201);
  const document = (documentTicket.body as Record<string, unknown>).document as Record<string, unknown>;
  const documentId = String(document.documentId);

  const upload = await browserApi(page, "/api/foundation/documents/" + documentId + "/content", {
    method: "PUT",
    csrf,
    contentType: "application/pdf",
    body: fixtureText,
  });
  expect(upload.status).toBe(200);
  expect((upload.body as Record<string, unknown>).status).toBe("QUARANTINED");

  const inspection = await browserApi(page, "/api/foundation/documents/" + documentId + "/inspection", {
    method: "POST",
    csrf,
  });
  expect(inspection.status).toBe(200);
  expect((inspection.body as Record<string, unknown>).status).toBe("INSPECTED");

  const extraction = await browserApi(page, "/api/foundation/documents/" + documentId + "/extraction", {
    method: "POST",
    csrf,
  });
  expect(extraction.status).toBe(201);
  const candidateId = String((extraction.body as Record<string, unknown>).candidateId);

  const emptyRecords = await browserApi(page, "/api/foundation/records");
  expect(emptyRecords.status).toBe(200);
  expect(emptyRecords.body).toEqual([]);

  const confirmation = await browserApi(
    page,
    "/api/foundation/candidates/" + candidateId + "/confirmation",
    {
      method: "POST",
      csrf,
      idempotencyKey: "browser-confirm-" + runKey,
      contentType: "application/json",
      body: JSON.stringify({ value: "190" }),
    },
  );
  expect(confirmation.status).toBe(201);
  const recordId = String((confirmation.body as Record<string, unknown>).recordId);

  await page.reload();
  const durableRecord = await browserApi(page, "/api/foundation/records/" + recordId);
  expect(durableRecord.status).toBe(200);
  expect(durableRecord.body).toMatchObject({
    recordId,
    candidateId,
    documentId,
    value: "190",
    unit: "mg/dL",
  });

  const revocation = await browserApi(page, "/api/foundation/consents/" + consentId + "/revocation", {
    method: "POST",
    csrf,
  });
  expect(revocation.status).toBe(200);

  const blockedAfterRevocation = await browserApi(page, "/api/foundation/documents", {
    method: "POST",
    csrf,
    idempotencyKey: "browser-after-revoke-" + runKey,
    contentType: "application/json",
    body: JSON.stringify({
      consentId,
      mediaType: "application/pdf",
      contentLength: new TextEncoder().encode(fixtureText).byteLength,
    }),
  });
  expect(blockedAfterRevocation.status).toBe(403);
  expect(blockedAfterRevocation.body).toMatchObject({ code: "active_consent_required" });

  const deletion = await browserApi(page, "/api/foundation/profile", {
    method: "DELETE",
    csrf,
  });
  expect(deletion.status).toBe(200);
  expect(deletion.body).toMatchObject({
    status: "COMPLETED",
    rawHealthValuesPresentInAudit: false,
  });

  const oldSession = await browserApi(page, "/api/foundation/records");
  expect(oldSession.status).toBe(401);
  expect(oldSession.body).toMatchObject({ code: "session_invalid" });
});
