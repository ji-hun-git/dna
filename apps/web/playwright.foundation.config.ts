import { createHash } from "node:crypto";
import { defineConfig } from "@playwright/test";

const databaseUrl = process.env.GC_TEST_POSTGRES_URL;
const quarantineRoot = process.env.GC_TEST_QUARANTINE_ROOT;
if (!databaseUrl || !quarantineRoot) {
  throw new Error("GC_TEST_POSTGRES_URL and GC_TEST_QUARANTINE_ROOT are required");
}

function buildSyntheticPdf() {
  const content = "BT /F1 18 Tf 72 740 Td (Genome Companion synthetic fixture) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.7\n%GC-SYNTHETIC-ONLY\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

const fixtureBytes = buildSyntheticPdf();
const fixtureDigest = createHash("sha256").update(fixtureBytes).digest("hex");
const browserSubject = process.env.GC_BROWSER_SUBJECT ?? ("synthetic-browser-" + process.pid);
const browserCredential = process.env.GC_BROWSER_CREDENTIAL ??
  ("browser-foundation-credential-" + process.pid + "-0000000000000000");
const browserA11ySubject = process.env.GC_BROWSER_A11Y_SUBJECT ?? ("synthetic-browser-a11y-" + process.pid);
const browserA11yCredential = process.env.GC_BROWSER_A11Y_CREDENTIAL ??
  ("browser-a11y-foundation-credential-" + process.pid + "-000000000000");
const credentialDigest = createHash("sha256").update(browserCredential, "utf8").digest("hex");
const a11yCredentialDigest = createHash("sha256").update(browserA11yCredential, "utf8").digest("hex");
const webPort = 3138;
const apiPort = 8087;
const workerHealthPort = 8091;
const webOrigin = "http://127.0.0.1:" + webPort;
const apiOrigin = "http://127.0.0.1:" + apiPort;
const gradleCommand = process.platform === "win32"
  ? "..\\..\\gradlew.bat --project-dir ..\\.."
  : "bash ../../gradlew --project-dir ../..";
process.env.GC_BROWSER_SUBJECT = browserSubject;
process.env.GC_BROWSER_CREDENTIAL = browserCredential;
process.env.GC_BROWSER_A11Y_SUBJECT = browserA11ySubject;
process.env.GC_BROWSER_A11Y_CREDENTIAL = browserA11yCredential;
process.env.GC_BROWSER_FIXTURE_BASE64 = fixtureBytes.toString("base64");
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
        GC_FOUNDATION_DOCUMENT_BOUNDARY_ENABLED: "true",
        GC_DOCUMENT_WORKER_CREDENTIAL_SHA256: workerCredentialDigest,
        GC_ALLOW_SYNTHETIC_SCANNER_RESULTS: "true",
        GC_ALLOWED_ORIGIN: webOrigin,
        GC_FOUNDATION_SECURE_COOKIES: "false",
        GC_QUARANTINE_ROOT: quarantineRoot,
        GC_AUDIT_PEPPER: "foundation-browser-e2e-pepper-with-at-least-32-characters",
        GC_ALLOWED_DOCUMENT_SHA256: fixtureDigest,
        GC_FOUNDATION_LOCAL_IDENTITIES_0_SUBJECT_ID: browserSubject,
        GC_FOUNDATION_LOCAL_IDENTITIES_0_CREDENTIAL_SHA256: credentialDigest,
        GC_FOUNDATION_LOCAL_IDENTITIES_1_SUBJECT_ID: browserA11ySubject,
        GC_FOUNDATION_LOCAL_IDENTITIES_1_CREDENTIAL_SHA256: a11yCredentialDigest,
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
        GC_INTEGRATED_SYNTHETIC_UI: "true",
        GC_CORE_API_ORIGIN: apiOrigin,
        GC_BROWSER_SUBJECT: browserSubject,
        GC_BROWSER_CREDENTIAL: browserCredential,
        GC_BROWSER_A11Y_SUBJECT: browserA11ySubject,
        GC_BROWSER_A11Y_CREDENTIAL: browserA11yCredential,
        GC_BROWSER_FIXTURE_BASE64: fixtureBytes.toString("base64"),
      },
    },
  ],
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure",
  },
});
