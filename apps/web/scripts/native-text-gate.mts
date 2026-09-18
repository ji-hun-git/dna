/** Generates the synthetic Korean checkup corpus, runs the worker's native-text provider and scores it. Synthetic only. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateHandLabelled, evaluateMedicalDocumentPipeline } from "../lib/medical-ai/evaluation.ts";
import { renderNativeTextReport } from "../lib/medical-ai/native-text-report.ts";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const repository = resolve(webRoot, "../..");
const font = resolve(webRoot, "node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf");
const corpusDir = resolve(repository, "packages/korean-checkup-benchmark/build/corpus");
const runsPath = resolve(corpusDir, "native-text-runs.json");
const handLabelledDir = resolve(repository, "packages/korean-checkup-benchmark/build/hand-labelled");
const handLabelledRunsPath = resolve(handLabelledDir, "runs.json");

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

if (!existsSync(font)) throw new Error(`Pretendard font not found at ${font}; run pnpm install first.`);
if (/\s/.test(repository)) throw new Error("The repository path must not contain whitespace (Gradle --args splits on spaces).");
mkdirSync(corpusDir, { recursive: true });
gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=generate --out ${corpusDir} --font ${font}`]);
gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=run-native-text --corpus ${corpusDir} --out ${runsPath}`]);

const corpus = JSON.parse(readFileSync(resolve(corpusDir, "corpus.json"), "utf8"));
const runs = JSON.parse(readFileSync(runsPath, "utf8"));
const report = evaluateMedicalDocumentPipeline(corpus, runs);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.gate.passed) process.exitCode = 1;

mkdirSync(handLabelledDir, { recursive: true });
gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=generate-hand-labelled --out ${handLabelledDir} --font ${font}`]);
gradle([":packages:korean-checkup-benchmark:run", "--no-daemon", "-q", `--args=run-hand-labelled --corpus ${handLabelledDir} --out ${handLabelledRunsPath}`]);

const handLabelledCorpus = JSON.parse(readFileSync(resolve(handLabelledDir, "hand-labelled.json"), "utf8"));
const handLabelledRuns = JSON.parse(readFileSync(handLabelledRunsPath, "utf8"));
const handLabelledReport = evaluateHandLabelled(handLabelledCorpus, handLabelledRuns);
process.stdout.write(`${JSON.stringify(handLabelledReport, null, 2)}\n`);
if (!handLabelledReport.passed) process.exitCode = 1;

const reportPath = argument("--report");
if (reportPath) writeFileSync(resolve(reportPath), renderNativeTextReport(report, new Date().toISOString().slice(0, 10), handLabelledReport));
