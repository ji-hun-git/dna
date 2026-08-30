import { createHash } from "node:crypto";
import { defineConfig } from "@playwright/test";

const databaseUrl = process.env.GC_TEST_POSTGRES_URL;
const quarantineRoot = process.env.GC_TEST_QUARANTINE_ROOT;
if (!databaseUrl || !quarantineRoot) {
  throw new Error("GC_TEST_POSTGRES_URL and GC_TEST_QUARANTINE_ROOT are required");
}

const fixtureText = "%PDF-1.7\nGenome Companion browser synthetic fixture only\n%%EOF\n";
const fixtureDigest = createHash("sha256").update(fixtureText, "utf8").digest("hex");
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
const webOrigin = "http://127.0.0.1:" + webPort;
const apiOrigin = "http://127.0.0.1:" + apiPort;
process.env.GC_BROWSER_SUBJECT = browserSubject;
process.env.GC_BROWSER_CREDENTIAL = browserCredential;
process.env.GC_BROWSER_A11Y_SUBJECT = browserA11ySubject;
process.env.GC_BROWSER_A11Y_CREDENTIAL = browserA11yCredential;
process.env.GC_BROWSER_FIXTURE_TEXT = fixtureText;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "foundation-lifecycle.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  webServer: [
    {
      command: "..\\..\\gradlew.bat --project-dir ..\\.. :apps:core-api:bootRun",
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
        GC_BROWSER_FIXTURE_TEXT: fixtureText,
      },
    },
  ],
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure",
  },
});
