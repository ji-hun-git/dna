import { defineConfig } from "@playwright/test";

const applicationInstance = "playwright-genome-companion-korea-web";
const testPort = 3137;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${testPort}`,
    url: `http://127.0.0.1:${testPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      GC_APPLICATION_INSTANCE_ID: applicationInstance,
    } as Record<string, string>,
  },
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    trace: "retain-on-failure",
  },
});
