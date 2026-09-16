/**
 * Bounded local MedGemma experiment (founder approval 2026-09-16). Pure functions used by
 * scripts/medgemma-local-experiment.mts. Nothing here is imported by product code: the model
 * proposes transcriptions of synthetic pages that are scored and reported, never stored as records.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { medicalDocumentRunSchema, type MedicalDocumentRun } from "./contracts.ts";

export const OLLAMA_ORIGIN = "http://127.0.0.1:11434";
export const MODEL_TAG = "medgemma1.5:latest";
export const PIPELINE_ID = "ollama-medgemma-1.5-4b-page-image";
export const DOCUMENT_LABEL = "문서 전체";
/** The model returns no box, so every candidate cites the whole page; localization is not measurable. */
export const PAGE_BOX = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });

const ABSTENTION_REASONS = ["unreadable", "ambiguous_value", "ambiguous_unit", "missing_evidence"] as const;
type AbstentionReason = (typeof ABSTENTION_REASONS)[number];

/** JSON Schema handed to Ollama's `format`. Only transcription fields; no interpretation field exists. */
const MODEL_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    observedOn: { type: "string", description: "검사일·검진일·채취일·Date 라벨이 붙은 날짜만 YYYY-MM-DD. 없으면 빈 문자열." },
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          unit: { type: "string" },
          observedOn: { type: "string" },
          page: { type: "integer" },
        },
        required: ["label", "value", "unit"],
      },
    },
    abstentions: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, reason: { type: "string", enum: [...ABSTENTION_REASONS] } },
        required: ["label", "reason"],
      },
    },
  },
  required: ["observedOn", "rows", "abstentions"],
} as const;

export const EXPERIMENT_PROTOCOL = Object.freeze({
  model: MODEL_TAG,
  systemPrompt: [
    "너는 한국어 건강검진 결과지 페이지 이미지를 그대로 옮겨 적는 필사 도구다.",
    "보이는 검사 항목마다 항목 이름(label), 결과 값(value), 단위(unit)를 인쇄된 글자 그대로 적는다. 값을 계산하거나 단위를 바꾸지 않는다.",
    "페이지에 검사일·검진일·채취일·Date 라벨이 붙은 날짜가 보이면 observedOn에 YYYY-MM-DD로 적고, 없으면 빈 문자열로 둔다. 생년월일·발급일 같은 다른 날짜는 검사일로 쓰지 않는다.",
    "판단하지 않는다: 정상/비정상, 참고치, 위험, 진단, 치료, 해석을 어떤 필드에도 쓰지 않는다. 참고치 열은 옮겨 적지 않는다.",
    "읽을 수 없거나 값이 둘 이상이거나 단위가 불분명한 항목은 rows에 넣지 말고 abstentions에 label과 reason(unreadable, ambiguous_value, ambiguous_unit, missing_evidence)으로 적는다.",
    "페이지에 없는 항목을 지어내지 않는다. 항목이 하나도 없으면 rows를 빈 배열로 둔다.",
    "주어진 JSON 스키마에 맞는 JSON만 출력한다.",
  ].join("\n"),
  userPrompt: "이 페이지에 인쇄된 검사 항목·값·단위와 라벨이 붙은 검사일을 그대로 옮겨 적어 주세요.",
  format: MODEL_RESPONSE_JSON_SCHEMA,
  think: false,
  keepAlive: "10m",
  options: Object.freeze({ temperature: 0, seed: 7, num_predict: 2048 }),
  documentTimeoutMs: 180_000,
  dpi: 150,
});

export function sha256Hex(input: string | Uint8Array) {
  return createHash("sha256").update(input).digest("hex");
}

export function protocolDigest() {
  return sha256Hex(JSON.stringify(EXPERIMENT_PROTOCOL));
}

/** Same rule as CorpusWriter.pdfDigest: sha256 over "<documentId> <sha256(pdf)>" lines joined by "\n". */
export function pdfDigest(entries: readonly { documentId: string; bytes: Uint8Array }[]) {
  return sha256Hex(entries.map((entry) => `${entry.documentId} ${sha256Hex(entry.bytes)}`).join("\n"));
}

export type ChatFetch = (input: string, init?: RequestInit) => Promise<Response>;

export function assertLocalOllamaUrl(url: string) {
  if (!url.startsWith(`${OLLAMA_ORIGIN}/`)) throw new Error(`refusing to contact ${url}: only ${OLLAMA_ORIGIN} is allowed`);
}

async function localJson<T>(fetchImpl: ChatFetch, path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const url = `${OLLAMA_ORIGIN}${path}`;
  assertLocalOllamaUrl(url);
  const response = await fetchImpl(url, { ...init, redirect: "error" });
  assertLocalOllamaUrl(response.url || url);
  if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  return schema.parse(await response.json());
}

export async function describeOllamaModel(fetchImpl: ChatFetch) {
  const { version } = await localJson(fetchImpl, "/api/version", z.looseObject({ version: z.string() }));
  const tags = await localJson(fetchImpl, "/api/tags", z.looseObject({ models: z.array(z.looseObject({ name: z.string(), digest: z.string() })) }));
  const model = tags.models.find((entry) => entry.name === MODEL_TAG);
  if (!model) throw new Error(`${MODEL_TAG} is not pulled on the local Ollama server`);
  const show = await localJson(fetchImpl, "/api/show", z.looseObject({ modelfile: z.string() }), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL_TAG }),
  });
  const blob = /sha256[-:]([0-9a-f]{64})/.exec(show.modelfile);
  if (!blob) throw new Error("the Ollama modelfile names no sha256 blob");
  return { version, modelDigest: model.digest, blobSha256: blob[1] };
}

const modelRowSchema = z.looseObject({ label: z.string(), value: z.string(), unit: z.string(), observedOn: z.string().optional() });
const modelAbstentionSchema = z.looseObject({ label: z.string(), reason: z.string() });
export const modelPageResponseSchema = z.looseObject({
  observedOn: z.string().default(""),
  rows: z.array(modelRowSchema).default([]),
  abstentions: z.array(modelAbstentionSchema).default([]),
});
const chatResponseSchema = z.looseObject({ message: z.looseObject({ content: z.string() }) });

export type ModelRow = { label: string; value: string; unit: string; observedOn?: string };
export type ModelAbstention = { label: string; reason: string };
export type ModelPageResult = { page: number; observedOn: string; rows: ModelRow[]; abstentions: ModelAbstention[]; rawContent: string; durationMs: number };

/** One `/api/chat` call for one page image. Every extra key the model emits (e.g. referenceRange) is dropped here. */
export async function askModelForPage(
  input: { documentId: string; page: number; pngBase64: string },
  deps: { fetchImpl: ChatFetch; timeoutMs: number },
): Promise<ModelPageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  const started = Date.now();
  try {
    const url = `${OLLAMA_ORIGIN}/api/chat`;
    assertLocalOllamaUrl(url);
    const response = await deps.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      redirect: "error",
      body: JSON.stringify({
        model: EXPERIMENT_PROTOCOL.model,
        stream: false,
        think: EXPERIMENT_PROTOCOL.think,
        keep_alive: EXPERIMENT_PROTOCOL.keepAlive,
        format: EXPERIMENT_PROTOCOL.format,
        options: EXPERIMENT_PROTOCOL.options,
        messages: [
          { role: "system", content: EXPERIMENT_PROTOCOL.systemPrompt },
          { role: "user", content: EXPERIMENT_PROTOCOL.userPrompt, images: [input.pngBase64] },
        ],
      }),
    });
    assertLocalOllamaUrl(response.url || url);
    if (!response.ok) throw new Error(`/api/chat responded ${response.status} for ${input.documentId} p${input.page}`);
    const rawContent = chatResponseSchema.parse(await response.json()).message.content;
    const parsed = modelPageResponseSchema.parse(JSON.parse(rawContent));
    return {
      page: input.page,
      observedOn: parsed.observedOn.trim(),
      rows: parsed.rows.map((row) => ({ label: row.label, value: row.value, unit: row.unit, observedOn: row.observedOn })),
      abstentions: parsed.abstentions.map((abstention) => ({ label: abstention.label, reason: abstention.reason })),
      rawContent,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export type DocumentOutcome = { documentId: string; status: "ok" | "unreadable"; failure?: string; pages: ModelPageResult[]; durationMs: number };

/** One call per page within one document budget; any failure makes the whole document unreadable. */
export async function runDocument(
  input: { documentId: string; pages: readonly { page: number; pngBase64: string }[] },
  deps: { fetchImpl: ChatFetch; documentTimeoutMs?: number; now?: () => number },
): Promise<DocumentOutcome> {
  const now = deps.now ?? Date.now;
  const started = now();
  const deadline = started + (deps.documentTimeoutMs ?? EXPERIMENT_PROTOCOL.documentTimeoutMs);
  const pages: ModelPageResult[] = [];
  for (const page of [...input.pages].sort((a, b) => a.page - b.page)) {
    const remaining = deadline - now();
    if (remaining <= 0) return { documentId: input.documentId, status: "unreadable", failure: "document timeout before page " + page.page, pages, durationMs: now() - started };
    try {
      pages.push(await askModelForPage({ documentId: input.documentId, page: page.page, pngBase64: page.pngBase64 }, { fetchImpl: deps.fetchImpl, timeoutMs: remaining }));
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return { documentId: input.documentId, status: "unreadable", failure: message, pages, durationMs: now() - started };
    }
  }
  return { documentId: input.documentId, status: "ok", pages, durationMs: now() - started };
}

export type ConceptCatalogue = readonly { conceptCode: string; displayKo: string; aliases: readonly string[] }[];

/** Mirror of MedicalConceptCatalogue.aliasKey: NFC, trim, drop trailing colons, lowercase, remove whitespace. */
export function aliasKey(label: string) {
  return label.normalize("NFC").trim().replace(/[:：]+$/, "").toLowerCase().replace(/\s+/g, "");
}

export function conceptCodeFor(label: string, catalogue: ConceptCatalogue) {
  const key = aliasKey(label);
  return catalogue.find((concept) => [concept.displayKo, ...concept.aliases].some((alias) => aliasKey(alias) === key))?.conceptCode;
}

function slug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function uniqueFieldId(base: string, used: Set<string>) {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}-${suffix++}`;
  used.add(candidate);
  return candidate;
}

function fieldIdFor(label: string, index: number, catalogue: ConceptCatalogue, used: Set<string>) {
  const base = label === DOCUMENT_LABEL ? "document" : conceptCodeFor(label, catalogue) ?? (slug(label) || `unknown-${index}`);
  return uniqueFieldId(base, used);
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const LIMITS = { label: 80, value: 64, unit: 32, rows: 100 };

export type PinnedModel = { modelId: string; artifactSha256: string; executionMode: "offline-pinned" };

export function toModelRun(input: {
  gold: { documentId: string; documentSha256: string; documentType: "health-screening-lab-report" | "public-health-lab-report" };
  outcome: DocumentOutcome;
  catalogue: ConceptCatalogue;
  createdAt: string;
  models: { layout: PinnedModel; semantic: PinnedModel };
}): MedicalDocumentRun {
  const used = new Set<string>();
  const candidates: MedicalDocumentRun["candidates"] = [];
  const abstentions: MedicalDocumentRun["abstentions"] = [];
  const abstain = (label: string, index: number, reason: AbstentionReason) => {
    if (abstentions.length >= LIMITS.rows) return;
    const shown = label.trim().slice(0, LIMITS.label) || DOCUMENT_LABEL;
    abstentions.push({ fieldId: fieldIdFor(shown, index, input.catalogue, used), label: shown, reason });
  };

  if (input.outcome.status !== "ok") {
    abstain(DOCUMENT_LABEL, 1, "unreadable");
  } else {
    const documentObservedOn = input.outcome.pages.map((page) => page.observedOn).find((date) => isoDate.test(date));
    let index = 0;
    for (const page of input.outcome.pages) {
      for (const row of page.rows) {
        index += 1;
        const label = row.label.trim();
        const value = row.value.trim();
        const unit = row.unit.trim();
        const rowDate = row.observedOn?.trim();
        const observedAt = rowDate && isoDate.test(rowDate) ? rowDate : documentObservedOn;
        if (label.length > LIMITS.label || value.length > LIMITS.value || unit.length > LIMITS.unit || label.length === 0) {
          abstain(label, index, "unreadable");
        } else if (value.length === 0) {
          abstain(label, index, "ambiguous_value");
        } else if (unit.length === 0) {
          abstain(label, index, "ambiguous_unit");
        } else if (!observedAt) {
          abstain(label, index, "missing_evidence");
        } else if (candidates.length < LIMITS.rows) {
          candidates.push({
            semanticRole: "measurement",
            fieldId: fieldIdFor(label, index, input.catalogue, used),
            label,
            value,
            unit,
            observedAt,
            confidence: 1,
            evidence: {
              page: page.page,
              blockId: `block-row-${String(candidates.length + 1).padStart(2, "0")}`,
              box: { ...PAGE_BOX },
              sourceTextSha256: `sha256:${sha256Hex(`${label} ${value} ${unit}`)}`,
            },
          });
        }
      }
      for (const abstention of page.abstentions) {
        index += 1;
        const reason = (ABSTENTION_REASONS as readonly string[]).includes(abstention.reason) ? abstention.reason as AbstentionReason : "unreadable";
        abstain(abstention.label, index, reason);
      }
    }
  }

  return medicalDocumentRunSchema.parse({
    schemaVersion: "medical-document-run.v1",
    pipelineId: PIPELINE_ID,
    runId: `run-medgemma-${input.gold.documentId.replace(/^synthetic-/, "")}`,
    documentId: input.gold.documentId,
    documentSha256: input.gold.documentSha256,
    documentType: input.gold.documentType,
    language: "ko-KR",
    synthetic: true,
    createdAt: input.createdAt,
    models: input.models,
    candidates,
    abstentions,
  });
}
