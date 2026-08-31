import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateResearchEvidenceAgent } from "../lib/research-data/evaluation.ts";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const corpusPath = argument("--corpus") ?? "tests/fixtures/research-data/evidence-agent.corpus.json";
const corpus = await readFile(resolve(corpusPath), "utf8").then(JSON.parse);
const report = evaluateResearchEvidenceAgent(corpus);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.gate.passed) process.exitCode = 1;
