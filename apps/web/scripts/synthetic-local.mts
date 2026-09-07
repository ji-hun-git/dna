/** Local synthetic workstation runner. Not a hosted deployment or production entrypoint. */
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { buildSyntheticResultPdf } from "../lib/foundation/synthetic-document.ts";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const repository = resolve(webRoot, "../..");
const origin = "http://127.0.0.1:3138";
const apiOrigin = "http://127.0.0.1:8087";

export function buildLocalPlan(input: Record<string, string | undefined>) {
  const databaseUrl = input.GC_LOCAL_POSTGRES_URL ?? "";
  const quarantineRoot = input.GC_LOCAL_QUARANTINE_ROOT ?? "";
  if (input.GC_LOCAL_SYNTHETIC_ONLY !== "yes") throw new Error("Set GC_LOCAL_SYNTHETIC_ONLY=yes only for a dedicated synthetic database.");
  if (!/^jdbc:postgresql:\/\/127\.0\.0\.1:[0-9]{1,5}\/[a-zA-Z0-9_]+$/.test(databaseUrl)) {
    throw new Error("GC_LOCAL_POSTGRES_URL must name a dedicated loopback PostgreSQL database without credentials or query parameters.");
  }
  if (!isAbsolute(quarantineRoot)) throw new Error("GC_LOCAL_QUARANTINE_ROOT must be an absolute synthetic working directory.");
  // Deliberate allowlist: no inherited provider, research, database or model configuration.
  const osNames = new Set(["path", "pathext", "systemroot", "windir", "comspec", "home", "userprofile", "localappdata", "appdata", "temp", "tmp", "java_home", "jdk_home", "gradle_user_home", "lang", "lc_all"]);
  const system = Object.fromEntries(Object.entries(input).filter(([key, value]) => osNames.has(key.toLowerCase()) && value !== undefined)) as Record<string, string>;
  const digest = (period: "2026-01" | "2026-07") => createHash("sha256").update(buildSyntheticResultPdf(period)).digest("hex");
  const workerCredential = randomBytes(32).toString("hex");
  const core: Record<string, string> = {
    ...system, SERVER_ADDRESS: "127.0.0.1", SERVER_PORT: "8087",
    GC_DATABASE_URL: databaseUrl, GC_DATABASE_USERNAME: "postgres", GC_DATABASE_PASSWORD: "",
    GC_FOUNDATION_ENABLED: "true", GC_FOUNDATION_DEMO_BOOTSTRAP_ENABLED: "true",
    GC_FOUNDATION_DOCUMENT_BOUNDARY_ENABLED: "true", GC_ALLOW_SYNTHETIC_SCANNER_RESULTS: "true",
    GC_DOCUMENT_WORKER_CREDENTIAL_SHA256: createHash("sha256").update(workerCredential).digest("hex"),
    GC_ALLOWED_ORIGIN: origin, GC_FOUNDATION_SECURE_COOKIES: "false", GC_QUARANTINE_ROOT: quarantineRoot,
    GC_AUDIT_PEPPER: "local-synthetic-only-audit-pepper-not-for-hosting",
    GC_ALLOWED_DOCUMENT_SHA256: [digest("2026-07"), digest("2026-01")].join(","),
    GC_FOUNDATION_SYNTHETIC_DOCUMENTS_0_SHA256: digest("2026-01"),
    GC_FOUNDATION_SYNTHETIC_DOCUMENTS_0_SET_ID: "checkup-2026-01",
  };
  const worker: Record<string, string> = {
    ...system, GC_WORKER_API_BASE_URL: apiOrigin, GC_WORKER_CREDENTIAL: workerCredential,
    GC_WORKER_ID: "local-synthetic-worker", GC_WORKER_ALLOW_SYNTHETIC_SCANNER: "true",
    GC_WORKER_IMAGE_DIGEST: "b".repeat(64), GC_WORKER_HEALTH_PORT: "8091",
  };
  const web: Record<string, string> = {...system, GC_CORE_API_ORIGIN: apiOrigin, GC_APPLICATION_INSTANCE_ID: "synthetic-local-unified"};
  return {core, worker, web};
}

async function assertFree(port: number) {
  await new Promise<void>((accept, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Local port ${port} is occupied; no existing process will be adopted or stopped.`)));
    server.listen(port, "127.0.0.1", () => server.close(() => accept()));
  });
}

async function run() {
  if (process.versions.node !== "24.20.0") throw new Error("Use the repository-pinned Node 24.20.0.");
  const plan = buildLocalPlan(process.env);
  for (const port of [8087, 8091, 3138]) await assertFree(port);
  const children: ChildProcess[] = [];
  let stopping = false;
  const stop = (code: number) => {
    if (stopping) return;
    stopping = true;
    for (const child of children.reverse()) {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {windowsHide: true, stdio: "ignore", timeout: 10_000});
      } else {
        try { process.kill(-child.pid, "SIGTERM"); } catch { /* Child already exited. */ }
      }
    }
    process.exit(code);
  };
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
  const start = (command: string, args: string[], cwd: string, env: Record<string, string>) => {
    const child = spawn(command, args, {cwd, env: {...env, NODE_ENV: "development"}, stdio: "inherit", windowsHide: true, detached: process.platform !== "win32"});
    children.push(child);
    child.once("error", () => stop(1));
    child.once("exit", () => { if (!stopping) stop(1); });
  };
  const startGradle = (task: string, env: Record<string, string>) => {
    if (process.platform === "win32") start("cmd.exe", ["/d", "/s", "/c", "gradlew.bat", task, "--no-daemon"], repository, env);
    else start("bash", ["./gradlew", task, "--no-daemon"], repository, env);
  };
  const ready = async (url: string) => {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      try { if ((await fetch(url, {signal: AbortSignal.timeout(2_000), redirect: "error"})).ok) return; } catch { /* Starting. */ }
      await delay(500);
    }
    throw new Error("A local synthetic service did not become ready within three minutes.");
  };
  try {
    console.info("Starting local synthetic API, then worker, then web. No real documents or accounts.");
    startGradle(":apps:core-api:bootRun", plan.core);
    await ready(apiOrigin + "/actuator/health");
    startGradle(":apps:document-worker:run", plan.worker);
    await ready("http://127.0.0.1:8091/healthz");
    start(process.execPath, [join(webRoot, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3138"], webRoot, plan.web);
    await ready(origin + "/healthz");
    console.info(`Synthetic product ready: ${origin} — Ctrl+C stops only these child processes; database/files are retained.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Local startup failed.");
    stop(1);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run().catch((error) => { console.error(error instanceof Error ? error.message : "Local configuration failed."); process.exitCode = 1; });
}
