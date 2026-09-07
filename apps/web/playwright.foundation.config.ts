import { createHash } from "node:crypto";
import { defineConfig } from "@playwright/test";
import { buildSyntheticResultPdf } from "./lib/foundation/synthetic-document";

const databaseUrl = process.env.GC_TEST_POSTGRES_URL;
const quarantineRoot = process.env.GC_TEST_QUARANTINE_ROOT;
if (!databaseUrl || !quarantineRoot) {
  throw new Error("GC_TEST_POSTGRES_URL and GC_TEST_QUARANTINE_ROOT are required");
}

const fixtureBytes = Buffer.from(buildSyntheticResultPdf("2026-07"));
const fixtureDigest = createHash("sha256").update(fixtureBytes).digest("hex");
// A second allow-listed document, bound below to the `checkup-2026-01` candidate
// set so the browser sees confirmed values from two different dates.
const secondFixtureBytes = Buffer.from(buildSyntheticResultPdf("2026-01"));
const secondFixtureDigest = createHash("sha256").update(secondFixtureBytes).digest("hex");
const webPort = 3138;
const apiPort = 8087;
const workerHealthPort = 8091;
const webOrigin = "http://127.0.0.1:" + webPort;
const apiOrigin = "http://127.0.0.1:" + apiPort;
const gradleCommand = process.platform === "win32"
  ? "..\\..\\gradlew.bat --project-dir ..\\.."
  : "bash ../../gradlew --project-dir ../..";
process.env.GC_BROWSER_FIXTURE_BASE64 = fixtureBytes.toString("base64");
process.env.GC_BROWSER_FIXTURE_2_BASE64 = secondFixtureBytes.toString("base64");
const workerCredential = "browser-document-worker-credential-000000000001";
const workerCredentialDigest = createHash("sha256").update(workerCredential, "utf8").digest("hex");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "foundation-lifecycle.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: [
    {
      command: `${gradleCommand} :apps:core-api:bootRun`,
      url: apiOrigin + "/actuator/health",
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        SERVER_ADDRESS: "127.0.0.1",
        SERVER_PORT: String(apiPort),
        GC_DATABASE_URL: databaseUrl,
        GC_DATABASE_USERNAME: "postgres",
        GC_DATABASE_PASSWORD: "",
        GC_FOUNDATION_ENABLED: "true",
        GC_FOUNDATION_DEMO_BOOTSTRAP_ENABLED: "true",
        GC_FOUNDATION_DOCUMENT_BOUNDARY_ENABLED: "true",
        GC_DOCUMENT_WORKER_CREDENTIAL_SHA256: workerCredentialDigest,
        GC_ALLOW_SYNTHETIC_SCANNER_RESULTS: "true",
        GC_ALLOWED_ORIGIN: webOrigin,
        GC_FOUNDATION_SECURE_COOKIES: "false",
        GC_QUARANTINE_ROOT: quarantineRoot,
        GC_AUDIT_PEPPER: "foundation-browser-e2e-pepper-with-at-least-32-characters",
        GC_ALLOWED_DOCUMENT_SHA256: [fixtureDigest, secondFixtureDigest].join(","),
        GC_FOUNDATION_SYNTHETIC_DOCUMENTS_0_SHA256: secondFixtureDigest,
        GC_FOUNDATION_SYNTHETIC_DOCUMENTS_0_SET_ID: "checkup-2026-01",
      },
    },
    {
      command: `${gradleCommand} :apps:document-worker:run`,
      url: `http://127.0.0.1:${workerHealthPort}/healthz`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        GC_WORKER_API_BASE_URL: apiOrigin,
        GC_WORKER_CREDENTIAL: workerCredential,
        GC_WORKER_ID: "playwright-document-worker",
        GC_WORKER_ALLOW_SYNTHETIC_SCANNER: "true",
        GC_WORKER_IMAGE_DIGEST: "b".repeat(64),
        GC_WORKER_FAIL_FIRST_EXTRACTION: "true",
        GC_WORKER_HEALTH_PORT: String(workerHealthPort),
      },
    },
    {
      command: "pnpm dev --hostname 127.0.0.1 --port " + webPort,
      url: webOrigin,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        GC_APPLICATION_INSTANCE_ID: "playwright-foundation-browser-e2e",
        GC_CORE_API_ORIGIN: apiOrigin,
        GC_BROWSER_FIXTURE_BASE64: fixtureBytes.toString("base64"),
        GC_BROWSER_FIXTURE_2_BASE64: secondFixtureBytes.toString("base64"),
      },
    },
  ],
  use: {
    screenshot: "only-on-failure",
    baseURL: webOrigin,
    trace: "retain-on-failure",
  },
});
