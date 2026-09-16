/**
 * Manual, local-only MedGemma 1.5 experiment over the synthetic Korean checkup corpus.
 * Not a CI step, not a gate. Talks only to http://127.0.0.1:11434. Run JSON stays under build/;
 * only the markdown summary is meant to be committed (docs/status/2026-09-17/medgemma-local-experiment.md).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete process.env[key];

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const repository = resolve(webRoot, "../..");
const font = resolve(webRoot, "node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf");
const corpusDir = resolve(repository, "packages/korean-checkup-benchmark/build/corpus");
const pagesDir = resolve(corpusDir, "pages");
const conceptsPath = resolve(corpusDir, "concepts.json");
const nativeRunsPath = resolve(corpusDir, "native-text-runs.json");
const outDir = resolve(webRoot, "build/medgemma");
const rawDir = resolve(outDir, "raw");

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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

const localFetch: ChatFetch = (url, init) => {
  if (!url.startsWith(`${OLLAMA_ORIGIN}/`)) throw new Error(`refusing ${url}`);
  return fetch(url, init);
};

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
const documentOutcomes: { documentId: string; status: string; failure?: string; durationMs: number }[] = [];
const limitArg = argument("--limit");
const documentLimit = limitArg ? Number(limitArg) : undefined;
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
  documentOutcomes.push({ documentId: document.documentId, status: outcome.status, failure: outcome.failure, durationMs: outcome.durationMs });
  process.stderr.write(`  ${outcome.status} in ${Math.round(outcome.durationMs / 1000)} s${outcome.failure ? ` — ${outcome.failure}` : ""}\n`);
  modelRuns.push(toModelRun({
    gold: document, outcome, catalogue, createdAt: new Date().toISOString(),
    models: { ...models, layout: { ...models.layout, artifactSha256: `sha256:${layoutDigest}` } },
  }));
}
writeFileSync(resolve(outDir, "medgemma-runs.json"), `${JSON.stringify(modelRuns, null, 2)}\n`);

const reportCorpus = documentLimit ? { ...corpus, documents } : corpus;
const reportDocumentIds = new Set(documents.map((document) => document.documentId));
const reportNativeRuns = documentLimit ? nativeRuns.filter((run) => reportDocumentIds.has((run as { documentId: string }).documentId)) : nativeRuns;

const finishedAt = new Date().toISOString();
const environment: [string, string][] = [
  ["Run window", `${startedAt} → ${finishedAt}`],
  ["Ollama", `${model.version} at ${OLLAMA_ORIGIN}`],
  ["Model", `${MODEL_TAG} · id ${model.modelDigest} · blob sha256:${model.blobSha256}`],
  ["Protocol digest (prompt, schema, options)", protocolDigest()],
  ["Options", `think=${EXPERIMENT_PROTOCOL.think}, temperature=${EXPERIMENT_PROTOCOL.options.temperature}, seed=${EXPERIMENT_PROTOCOL.options.seed}, num_predict=${EXPERIMENT_PROTOCOL.options.num_predict}, keep_alive=${EXPERIMENT_PROTOCOL.keepAlive}, document timeout ${EXPERIMENT_PROTOCOL.documentTimeoutMs / 1000} s`],
  ["Page rendering", `PDFBox 3.0.8 PDFRenderer ${EXPERIMENT_PROTOCOL.dpi} dpi PNG, one /api/chat call per page`],
  ["GPU / driver", output("nvidia-smi", ["--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"])],
  ["Node", process.version],
  ["Corpus", `${corpus.corpusId} (${corpus.documents.length} documents)`],
  ["Corpus digest (sha256 of PDF digest + corpus.json sha256)", corpusDigest],
  ["corpus.json sha256", corpusJsonSha256],
  ["Script commit", output("git", ["rev-parse", "HEAD"])],
  ["Run JSON", "apps/web/build/medgemma/medgemma-runs.json (not committed)"],
];
const report = renderMedgemmaExperimentReport({
  generatedAt: finishedAt.slice(0, 10),
  corpus: reportCorpus,
  pipelines: [
    { label: "pdfbox-native-text", runs: reportNativeRuns, evidenceMeasurable: true, gated: true },
    { label: PIPELINE_ID, runs: modelRuns, evidenceMeasurable: false, gated: false },
  ],
  environment,
  documentOutcomes,
});
const reportPath = resolve(argument("--report") ?? resolve(repository, "docs/status/2026-09-17/medgemma-local-experiment.md"));
mkdirSync(resolve(reportPath, ".."), { recursive: true });
writeFileSync(reportPath, `${report}\n`);
writeFileSync(resolve(outDir, "summary.json"), `${JSON.stringify({ environment, documentOutcomes }, null, 2)}\n`);
process.stdout.write(`report written to ${reportPath}\n`);
