import { expect, it, vi } from "vitest";
import { createFoundationClient } from "@/lib/foundation/client";
import { syntheticHealthEvent, syntheticRecord } from "./fixtures/foundation";

const cursor = "8b2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d50";
const page = (body: unknown, next?: string) => new Response(JSON.stringify(body), {
  headers: next ? { "X-GC-Next-After": next } : {},
});

it.each(["records", "health-events"] as const)("loads every %s page without losing the newest results", async (route) => {
  const item = route === "records" ? syntheticRecord() : syntheticHealthEvent();
  const newest = { ...item, observedOn: "2026-08-11", recordId: "7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c42" };
  const fetcher = vi.fn().mockResolvedValueOnce(page([item], cursor)).mockResolvedValueOnce(page([newest]));
  const client = createFoundationClient({ fetcher });
  const result = await (route === "records" ? client.getRecords() : client.getHealthEvents());
  expect(result).toHaveLength(2);
  expect(result[1]).toMatchObject({ recordId: newest.recordId, observedOn: "2026-08-11" });
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    `/api/foundation/${route}`, `/api/foundation/${route}?after=${cursor}`,
  ]);
});

it("rejects a failed later page instead of presenting a partial history as complete", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(page([syntheticRecord()], cursor))
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: "session_expired" }), { status: 401 }));
  await expect(createFoundationClient({ fetcher }).getRecords()).rejects.toMatchObject({ status: 401 });
});

it.each(["not-a-uuid", cursor])("rejects invalid or repeated continuation tokens: %s", async (next) => {
  const fetcher = vi.fn().mockImplementation(async () => page([syntheticRecord()], next));
  await expect(createFoundationClient({ fetcher }).getRecords()).rejects.toMatchObject({ code: "invalid_server_response" });
  expect(fetcher.mock.calls.length).toBeLessThanOrEqual(2);
});
