import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateMedicalDocumentPipeline } from "../lib/medical-ai/evaluation.ts";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const corpusPath = argument("--corpus") ?? "tests/fixtures/medical-ai/synthetic-korean-lab.corpus.json";
const runsPath = argument("--runs") ?? "tests/fixtures/medical-ai/paddle-medgemma.reference-runs.json";

const [corpus, runs] = await Promise.all([
  readFile(resolve(corpusPath), "utf8").then(JSON.parse),
  readFile(resolve(runsPath), "utf8").then(JSON.parse),
]);

const report = evaluateMedicalDocumentPipeline(corpus, runs);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.gate.passed) process.exitCode = 1;
