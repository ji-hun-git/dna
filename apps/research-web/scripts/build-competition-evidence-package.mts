import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildCompetitionEvidencePackage,
  serializeCompetitionEvidencePackage,
} from "../lib/research-data/competition-evidence-package.server.ts";

function requiredArgument(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing required argument: ${name}`);
  return value;
}

function optionalArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const trackId = requiredArgument("--track");
if (trackId !== "dataon-aida-2026" && trackId !== "daejeon-public-data-2026") {
  throw new Error("--track must be dataon-aida-2026 or daejeon-public-data-2026");
}
const packageDate = requiredArgument("--package-date");
const outputPath = resolve(requiredArgument("--out"));
if (!outputPath.endsWith(".json")) throw new Error("--out must end in .json");
const corpusPath = resolve(optionalArgument("--corpus") ?? "tests/fixtures/research-data/evidence-agent.corpus.json");
const evaluationCorpus = JSON.parse(await readFile(corpusPath, "utf8"));

const evidencePackage = buildCompetitionEvidencePackage({
  trackId,
  packageDate,
  evaluationCorpus,
  sampleQuery: {
    schemaVersion: "research-evidence-query.v1",
    topicCode: "biomedical-literature",
    intent: "compare-fitness",
    personalData: false,
    diagnosticUse: false,
  },
});

await writeFile(outputPath, serializeCompetitionEvidencePackage(evidencePackage), { encoding: "utf8", flag: "wx" });
process.stdout.write(`${outputPath}\t${evidencePackage.packageSha256}\n`);
