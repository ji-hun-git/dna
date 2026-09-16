// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  EXPERIMENT_PROTOCOL,
  OLLAMA_ORIGIN,
  PAGE_BOX,
  PIPELINE_ID,
  aliasKey,
  askModelForPage,
  assertLocalOllamaUrl,
  conceptCodeFor,
  describeOllamaModel,
  pdfDigest,
  protocolDigest,
  runDocument,
  toModelRun,
  type ChatFetch,
  type ConceptCatalogue,
} from "@/lib/medical-ai/medgemma-experiment";
import { medicalDocumentRunSchema } from "@/lib/medical-ai/contracts";

const catalogue: ConceptCatalogue = [
  { conceptCode: "total-cholesterol", displayKo: "총콜레스테롤", aliases: ["콜레스테롤", "Total Cholesterol", "Cholesterol"] },
  { conceptCode: "hba1c", displayKo: "당화혈색소", aliases: ["HbA1c"] },
];

const models = {
  layout: { modelId: "pdfbox-render-150dpi", artifactSha256: `sha256:${"1".repeat(64)}`, executionMode: "offline-pinned" as const },
  semantic: { modelId: "medgemma1.5@ollama:433252621ab1", artifactSha256: `sha256:${"a".repeat(64)}`, executionMode: "offline-pinned" as const },
};

const gold = { documentId: "synthetic-nhis-table-v0", documentSha256: `sha256:${"d".repeat(64)}`, documentType: "health-screening-lab-report" as const };

function chatReply(content: unknown, status = 200): Response {
  return new Response(JSON.stringify({ model: "medgemma1.5:latest", message: { role: "assistant", content: JSON.stringify(content) }, done: true, eval_count: 12 }), { status, headers: { "content-type": "application/json" } });
}

describe("protocol", () => {
  it("pins the prompt, schema and parameters and hashes them", () => {
    expect(EXPERIMENT_PROTOCOL.model).toBe("medgemma1.5:latest");
    expect(EXPERIMENT_PROTOCOL.think).toBe(false);
    expect(EXPERIMENT_PROTOCOL.options.temperature).toBe(0);
    expect(EXPERIMENT_PROTOCOL.documentTimeoutMs).toBe(180_000);
    expect(EXPERIMENT_PROTOCOL.systemPrompt).toContain("판단하지");
    expect(EXPERIMENT_PROTOCOL.systemPrompt).not.toMatch(/진단해|정상인지|위험도를 평가/);
    expect(protocolDigest()).toBe(createHash("sha256").update(JSON.stringify(EXPERIMENT_PROTOCOL)).digest("hex"));
    expect(Object.isFrozen(EXPERIMENT_PROTOCOL)).toBe(true);
  });

  it("refuses any origin other than the local Ollama server", () => {
    expect(() => assertLocalOllamaUrl(`${OLLAMA_ORIGIN}/api/chat`)).not.toThrow();
    expect(() => assertLocalOllamaUrl("http://localhost:11434/api/chat")).toThrow(/127\.0\.0\.1:11434/);
    expect(() => assertLocalOllamaUrl("https://ollama.example.com/api/chat")).toThrow();
    expect(() => assertLocalOllamaUrl("http://127.0.0.1:11434.example.com/api/chat")).toThrow();
  });
});

describe("Ollama client", () => {
  it("sends one page image with the pinned protocol and parses the reply", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fetchImpl: ChatFetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return chatReply({ observedOn: "2026-07-28", rows: [{ label: "총콜레스테롤", value: "188", unit: "mg/dL", referenceRange: "150-199", page: 1 }], abstentions: [] });
    };

    const result = await askModelForPage({ documentId: gold.documentId, page: 1, pngBase64: "iVBORw0KGgo=" }, { fetchImpl, timeoutMs: 5_000 });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://127.0.0.1:11434/api/chat");
    expect(calls[0].body).toMatchObject({ model: "medgemma1.5:latest", stream: false, think: false, keep_alive: EXPERIMENT_PROTOCOL.keepAlive, format: EXPERIMENT_PROTOCOL.format, options: EXPERIMENT_PROTOCOL.options });
    const messages = calls[0].body.messages as { role: string; content: string; images?: string[] }[];
    expect(messages[0]).toEqual({ role: "system", content: EXPERIMENT_PROTOCOL.systemPrompt });
    expect(messages[1].images).toEqual(["iVBORw0KGgo="]);
    expect(result.observedOn).toBe("2026-07-28");
    expect(result.rows).toEqual([{ label: "총콜레스테롤", value: "188", unit: "mg/dL", observedOn: undefined }]);
    expect(JSON.stringify(result.rows)).not.toContain("referenceRange");
  });

  it("reads the version, model digest and blob digest from the local server", async () => {
    const fetchImpl: ChatFetch = async (url) => {
      if (url.endsWith("/api/version")) return Response.json({ version: "0.34.1" });
      if (url.endsWith("/api/tags")) return Response.json({ models: [{ name: "medgemma1.5:latest", digest: "433252621ab154668b5d8be6aff6c1b771bacba045e46e6193da8d6ad1630f2c" }] });
      if (url.endsWith("/api/show")) return Response.json({ modelfile: `# Modelfile\nFROM C:\\Users\\x\\.ollama\\models\\blobs\\sha256-${"a".repeat(64)}\n` });
      throw new Error(`unexpected ${url}`);
    };
    await expect(describeOllamaModel(fetchImpl)).resolves.toEqual({ version: "0.34.1", modelDigest: "433252621ab154668b5d8be6aff6c1b771bacba045e46e6193da8d6ad1630f2c", blobSha256: "a".repeat(64) });
  });

  it("fails the model lookup when the tag is missing", async () => {
    const fetchImpl: ChatFetch = async (url) => url.endsWith("/api/version") ? Response.json({ version: "0.34.1" }) : Response.json({ models: [] });
    await expect(describeOllamaModel(fetchImpl)).rejects.toThrow(/medgemma1\.5:latest/);
  });
});

describe("runDocument", () => {
  it("merges pages in order and reuses the first page-level date for later pages", async () => {
    const fetchImpl: ChatFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: { images?: string[] }[] };
      return body.messages[1].images?.[0] === "p1"
        ? chatReply({ observedOn: "2026-07-28", rows: [], abstentions: [] })
        : chatReply({ observedOn: "", rows: [{ label: "HbA1c", value: "5.2", unit: "%" }], abstentions: [{ label: "LDL", reason: "ambiguous_value" }] });
    });
    const outcome = await runDocument({ documentId: gold.documentId, pages: [{ page: 1, pngBase64: "p1" }, { page: 2, pngBase64: "p2" }] }, { fetchImpl });
    expect(outcome.status).toBe("ok");
    expect(outcome.pages.map((page) => page.page)).toEqual([1, 2]);
    const run = toModelRun({ gold, outcome, catalogue, createdAt: "2026-09-17T09:00:00Z", models });
    expect(run.candidates).toEqual([{
      semanticRole: "measurement", fieldId: "hba1c", label: "HbA1c", value: "5.2", unit: "%", observedAt: "2026-07-28", confidence: 1,
      evidence: { page: 2, blockId: "block-row-01", box: PAGE_BOX, sourceTextSha256: `sha256:${createHash("sha256").update("HbA1c 5.2 %").digest("hex")}` },
    }]);
    expect(run.abstentions).toEqual([{ fieldId: "ldl", label: "LDL", reason: "ambiguous_value" }]);
  });

  it("marks the whole document unreadable on a timeout, an HTTP error or unparseable JSON", async () => {
    const hang: ChatFetch = (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    const timedOut = await runDocument({ documentId: gold.documentId, pages: [{ page: 1, pngBase64: "p1" }] }, { fetchImpl: hang, documentTimeoutMs: 20 });
    expect(timedOut.status).toBe("unreadable");
    expect(timedOut.failure).toMatch(/abort|timeout/i);

    const failing: ChatFetch = async () => new Response("busy", { status: 503 });
    expect((await runDocument({ documentId: gold.documentId, pages: [{ page: 1, pngBase64: "p1" }] }, { fetchImpl: failing })).status).toBe("unreadable");

    const garbage: ChatFetch = async () => new Response(JSON.stringify({ message: { content: "not json" } }), { status: 200 });
    const outcome = await runDocument({ documentId: gold.documentId, pages: [{ page: 1, pngBase64: "p1" }] }, { fetchImpl: garbage });
    expect(outcome.status).toBe("unreadable");
    const run = toModelRun({ gold, outcome, catalogue, createdAt: "2026-09-17T09:00:00Z", models });
    expect(run.candidates).toEqual([]);
    expect(run.abstentions).toEqual([{ fieldId: "document", label: "문서 전체", reason: "unreadable" }]);
  });
});

describe("toModelRun", () => {
  const page = (rows: unknown[], abstentions: unknown[] = [], observedOn = "2026-07-28") =>
    ({ page: 1, observedOn, rows: rows as never, abstentions: abstentions as never, rawContent: "", durationMs: 1 });
  const outcomeWith = (rows: unknown[], abstentions: unknown[] = [], observedOn = "2026-07-28") =>
    ({ documentId: gold.documentId, status: "ok" as const, pages: [page(rows, abstentions, observedOn)], durationMs: 1 });

  it("normalizes labels through the catalogue aliases and keeps the printed label", () => {
    expect(aliasKey(" Total Cholesterol: ")).toBe("totalcholesterol");
    expect(conceptCodeFor("총 콜레스테롤", catalogue)).toBe("total-cholesterol");
    expect(conceptCodeFor("cholesterol：", catalogue)).toBe("total-cholesterol");
    expect(conceptCodeFor("알 수 없는 항목", catalogue)).toBeUndefined();
    const run = toModelRun({ gold, outcome: outcomeWith([{ label: "Total Cholesterol", value: "188", unit: "mg/dL" }, { label: "총콜레스테롤", value: "189", unit: "mg/dL" }, { label: "???", value: "1", unit: "x" }]), catalogue, createdAt: "2026-09-17T09:00:00Z", models });
    expect(run.candidates.map((candidate) => [candidate.fieldId, candidate.label])).toEqual([["total-cholesterol", "Total Cholesterol"], ["total-cholesterol-2", "총콜레스테롤"], ["unknown-3", "???"]]);
    expect(run.pipelineId).toBe(PIPELINE_ID);
    expect(run.runId).toBe("run-medgemma-nhis-table-v0");
    expect(run.documentSha256).toBe(gold.documentSha256);
    expect(medicalDocumentRunSchema.safeParse(run).success).toBe(true);
  });

  it("turns rows without a date, an empty value or unit, or over-long fields into abstentions", () => {
    const run = toModelRun({
      gold,
      outcome: outcomeWith([
        { label: "HbA1c", value: "5.2", unit: "%", observedOn: "2026-07-27" },
        { label: "Cholesterol", value: "188", unit: "mg/dL" },
        { label: "Empty", value: "", unit: "mg/dL" },
        { label: "NoUnit", value: "7", unit: " " },
        { label: "x".repeat(81), value: "1", unit: "u" },
      ], [{ label: "Blurry", reason: "not-a-reason" }], ""),
      catalogue, createdAt: "2026-09-17T09:00:00Z", models,
    });
    expect(run.candidates.map((candidate) => [candidate.fieldId, candidate.observedAt])).toEqual([["hba1c", "2026-07-27"]]);
    expect(run.abstentions).toEqual([
      { fieldId: "total-cholesterol", label: "Cholesterol", reason: "missing_evidence" },
      { fieldId: "empty", label: "Empty", reason: "ambiguous_value" },
      { fieldId: "nounit", label: "NoUnit", reason: "ambiguous_unit" },
      { fieldId: "x".repeat(80), label: "x".repeat(80), reason: "unreadable" },
      { fieldId: "blurry", label: "Blurry", reason: "unreadable" },
    ]);
    expect(JSON.stringify(run)).not.toContain("referenceRange");
  });

  it("computes the PDF digest the way the Kotlin corpus writer does", () => {
    const entries = [{ documentId: "synthetic-a", bytes: new TextEncoder().encode("A") }, { documentId: "synthetic-b", bytes: new TextEncoder().encode("B") }];
    const expected = createHash("sha256").update(entries.map((entry) => `${entry.documentId} ${createHash("sha256").update(entry.bytes).digest("hex")}`).join("\n")).digest("hex");
    expect(pdfDigest(entries)).toBe(expected);
  });
});
