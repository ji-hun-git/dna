/**
 * Manual, local-only MedGemma 1.5 experiment over the synthetic Korean checkup corpus.
 * Not a CI step, not a gate. Talks only to http://127.0.0.1:11434. Run JSON stays under build/;
 * only the markdown summary is meant to be committed (docs/status/<today>/medgemma-local-experiment.md),
 * unless --limit is set, in which case the report is written under build/ instead — see resolveReportPath.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { medicalDocumentCorpusSchema } from "../lib/medical-ai/contracts.ts";
import {
  EXPERIMENT_PROTOCOL,
  MODEL_TAG,
  OLLAMA_ORIGIN,
  PIPELINE_ID,
  describeOllamaModel,
  pdfDigest,
  protocolDigest,
  runDocument,
  sha256Hex,
  toModelRun,
  type ChatFetch,
  type ConceptCatalogue,
} from "../lib/medical-ai/medgemma-experiment.ts";
import { renderMedgemmaExperimentReport } from "../lib/medical-ai/medgemma-report.ts";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const repository = resolve(webRoot, "../..");

function argument(name: string, argv: readonly string[] = process.argv) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

/** Parses --limit. Returns undefined when the flag is absent; throws when given but not a positive integer. */
export function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`--limit must be a positive integer, got ${JSON.stringify(raw)}`);
  return Number(raw);
}

/** Today's date as YYYY-MM-DD in Asia/Seoul, used for the default report directory. */
export function todayInSeoul(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Where the markdown report is written. An explicit --report always wins. A --limit run without
 * --report is never written to the canonical docs/status/<date> path (a partial run must not be
 * mistaken for the full experiment); it goes under apps/web/build/medgemma instead.
 */
export function resolveReportPath(options: { limit: number | undefined; reportArg: string | undefined; today: string; repositoryRoot: string; webRoot: string }): string {
  const { limit, reportArg, today, repositoryRoot, webRoot: root } = options;
  if (reportArg) return resolve(reportArg);
  if (limit !== undefined) return resolve(root, "build/medgemma", `medgemma-local-experiment-limit${limit}.md`);
  return resolve(repositoryRoot, "docs/status", today, "medgemma-local-experiment.md");
}

/** The title prefix and extra environment line marking a --limit run so it can never be mistaken for the full experiment. */
export function describeRunScope(options: { limit: number | undefined; evaluated: number; total: number }): { titlePrefix: string; extraEnvironment: [string, string][] } {
  if (options.limit === undefined) return { titlePrefix: "", extraEnvironment: [] };
  return {
    titlePrefix: "[제한 실행] ",
    extraEnvironment: [["실행 범위", `제한 실행 — ${options.evaluated} / ${options.total} 문서 (전체 실험 아님)`]],
  };
}

function gradle(args: string[]) {
  const result = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", ".\\gradlew.bat", ...args], { cwd: repository, stdio: "inherit", windowsHide: true })
    : spawnSync("./gradlew", args, { cwd: repository, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`gradle ${args.join(" ")} failed with status ${result.status}${result.error ? `: ${result.error.message}` : ""}`);
}

function output(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: repository, encoding: "utf8", windowsHide: true, timeout: 10_000 });
  return result.status === 0 ? result.stdout.trim() : "unavailable";
}

async function main() {
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete process.env[key];

  const font = resolve(webRoot, "node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf");
  const corpusDir = resolve(repository, "packages/korean-checkup-benchmark/build/corpus");
  const pagesDir = resolve(corpusDir, "pages");
  const conceptsPath = resolve(corpusDir, "concepts.json");
  const nativeRunsPath = resolve(corpusDir, "native-text-runs.json");
  const outDir = resolve(webRoot, "build/medgemma");
  const rawDir = resolve(outDir, "raw");

  const localFetch: ChatFetch = (url, init) => {
    if (!url.startsWith(`${OLLAMA_ORIGIN}/`)) throw new Error(`refusing ${url}`);
    return fetch(url, init);
  };

  let documentLimit: number | undefined;
  try {
    documentLimit = parseLimit(argument("--limit"));
  } catch (error) {
    console.error((error as Error).message);
    process.exit(2);
  }

  if (!existsSync(font)) throw new Error(`Pretendard font not found at ${font}; run pnpm install first.`);
  if (/\s/.test(repository)) throw new Error("The repository path must not contain whitespace (Gradle --args splits on spaces).");
  const startedAt = new Date().toISOString();
  mkdirSync(rawDir, { recursive: true });
  gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=generate --out ${corpusDir} --font ${font}`]);
  gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=run-native-text --corpus ${corpusDir} --out ${nativeRunsPath}`]);
  gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=render-pages --corpus ${corpusDir} --out ${pagesDir}`]);
  gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=export-concepts --out ${conceptsPath}`]);

  const corpusJsonBytes = readFileSync(resolve(corpusDir, "corpus.json"));
  const corpus = medicalDocumentCorpusSchema.parse(JSON.parse(corpusJsonBytes.toString("utf8")));
  const nativeRuns = JSON.parse(readFileSync(nativeRunsPath, "utf8")) as unknown[];
  const catalogue = JSON.parse(readFileSync(conceptsPath, "utf8")) as ConceptCatalogue;
  const pdfs = corpus.documents.map((document) => ({ documentId: document.documentId, bytes: readFileSync(resolve(corpusDir, `${document.documentId}.pdf`)) }));
  const corpusPdfDigest = pdfDigest(pdfs);
  if (!corpus.corpusId.endsWith(corpusPdfDigest.slice(0, 16))) throw new Error(`corpus.json corpusId ${corpus.corpusId} does not match the PDF digest ${corpusPdfDigest}`);
  const corpusJsonSha256 = sha256Hex(corpusJsonBytes);
  const corpusDigest = sha256Hex(`${corpusPdfDigest}\n${corpusJsonSha256}`);

  const model = await describeOllamaModel(localFetch);
  const models = {
    layout: { modelId: "pdfbox-render-150dpi", artifactSha256: "", executionMode: "offline-pinned" as const },
    semantic: { modelId: `medgemma1.5@ollama:${model.modelDigest.slice(0, 12)}`, artifactSha256: `sha256:${model.blobSha256}`, executionMode: "offline-pinned" as const },
  };

  const modelRuns: unknown[] = [];
  const documentOutcomes: { documentId: string; status: string; failure?: string; doneReason?: string; evalCount?: number; durationMs: number }[] = [];
  const documents = documentLimit ? corpus.documents.slice(0, documentLimit) : corpus.documents;
  for (const document of documents) {
    const pageFiles = readdirSync(pagesDir).filter((name) => name.startsWith(`${document.documentId}-p`) && name.endsWith(".png")).sort();
    const pages = pageFiles.map((name) => {
      const bytes = readFileSync(resolve(pagesDir, name));
      return { page: Number(/-p(\d+)\.png$/.exec(name)![1]), pngBase64: bytes.toString("base64"), sha256: sha256Hex(bytes) };
    });
    const layoutDigest = sha256Hex(pages.map((page) => page.sha256).join("\n"));
    process.stderr.write(`${document.documentId}: ${pages.length} page(s)\n`);
    const outcome = await runDocument({ documentId: document.documentId, pages }, { fetchImpl: localFetch });
    for (const page of outcome.pages) writeFileSync(resolve(rawDir, `${document.documentId}-p${page.page}.json`), page.rawContent);
    if (outcome.status !== "ok" && outcome.rawContent !== undefined) {
      writeFileSync(resolve(rawDir, `${document.documentId}-failed.json`), outcome.rawContent);
    }
    documentOutcomes.push({
      documentId: document.documentId,
      status: outcome.status,
      failure: outcome.failure,
      doneReason: outcome.doneReason,
      evalCount: outcome.evalCount,
      durationMs: outcome.durationMs,
    });
    const truncationNote = outcome.doneReason ? ` (done_reason=${outcome.doneReason}${outcome.evalCount !== undefined ? `, eval_count=${outcome.evalCount}` : ""})` : "";
    process.stderr.write(`  ${outcome.status} in ${Math.round(outcome.durationMs / 1000)} s${outcome.failure ? ` — ${outcome.failure}${truncationNote}` : ""}\n`);
    modelRuns.push(toModelRun({
      gold: document, outcome, catalogue, createdAt: new Date().toISOString(),
      models: { ...models, layout: { ...models.layout, artifactSha256: `sha256:${layoutDigest}` } },
    }));
  }
  writeFileSync(resolve(outDir, "medgemma-runs.json"), `${JSON.stringify(modelRuns, null, 2)}\n`);

  const reportCorpus = documentLimit ? { ...corpus, documents } : corpus;
  const reportDocumentIds = new Set(documents.map((document) => document.documentId));
  const reportNativeRuns = documentLimit ? nativeRuns.filter((run) => reportDocumentIds.has((run as { documentId: string }).documentId)) : nativeRuns;

  const doneReasonCounts = new Map<string, number>();
  for (const entry of documentOutcomes) {
    if (!entry.doneReason) continue;
    doneReasonCounts.set(entry.doneReason, (doneReasonCounts.get(entry.doneReason) ?? 0) + 1);
  }
  const doneReasonSummary = [...doneReasonCounts.entries()].map(([reason, count]) => `${reason}=${count}`).join(", ") || "none recorded";

  const scope = describeRunScope({ limit: documentLimit, evaluated: documents.length, total: corpus.documents.length });
  const finishedAt = new Date().toISOString();
  const environment: [string, string][] = [
    ["Run window", `${startedAt} → ${finishedAt}`],
    ["Ollama", `${model.version} at ${OLLAMA_ORIGIN}`],
    ["Model", `${MODEL_TAG} · id ${model.modelDigest} · blob sha256:${model.blobSha256}`],
    ["Protocol digest (prompt, schema, options)", protocolDigest()],
    ["Options", `think=${EXPERIMENT_PROTOCOL.think}, temperature=${EXPERIMENT_PROTOCOL.options.temperature}, seed=${EXPERIMENT_PROTOCOL.options.seed}, num_predict=${EXPERIMENT_PROTOCOL.options.num_predict}, num_ctx=${EXPERIMENT_PROTOCOL.options.num_ctx}, keep_alive=${EXPERIMENT_PROTOCOL.keepAlive}, document timeout ${EXPERIMENT_PROTOCOL.documentTimeoutMs / 1000} s`],
    ["Page rendering", `PDFBox 3.0.8 PDFRenderer ${EXPERIMENT_PROTOCOL.dpi} dpi PNG, one /api/chat call per page`],
    ["GPU / driver", output("nvidia-smi", ["--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"])],
    ["Node", process.version],
    ["Corpus", `${corpus.corpusId} (${documents.length} documents)`],
    ...scope.extraEnvironment,
    ["Corpus digest (sha256 of PDF digest + corpus.json sha256)", corpusDigest],
    ["corpus.json sha256", corpusJsonSha256],
    ["Script commit", output("git", ["rev-parse", "HEAD"])],
    ["done_reason on failed documents", doneReasonSummary],
    ["Run JSON", "apps/web/build/medgemma/medgemma-runs.json (not committed)"],
  ];
  const report = renderMedgemmaExperimentReport({
    generatedAt: todayInSeoul(),
    corpus: reportCorpus,
    titlePrefix: scope.titlePrefix,
    pipelines: [
      { label: "pdfbox-native-text", runs: reportNativeRuns, evidenceMeasurable: true, gated: true },
      { label: PIPELINE_ID, runs: modelRuns, evidenceMeasurable: false, gated: false },
    ],
    environment,
    documentOutcomes,
  });
  const reportPath = resolveReportPath({ limit: documentLimit, reportArg: argument("--report"), today: todayInSeoul(), repositoryRoot: repository, webRoot });
  mkdirSync(resolve(reportPath, ".."), { recursive: true });
  writeFileSync(reportPath, `${report}\n`);
  writeFileSync(resolve(outDir, "summary.json"), `${JSON.stringify({ environment, documentOutcomes }, null, 2)}\n`);
  process.stdout.write(`report written to ${reportPath}\n`);
}

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMainModule) {
  await main();
}
