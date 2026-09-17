// @vitest-environment node
import { expect, it } from "vitest";
import { buildLocalPlan } from "../scripts/synthetic-local.mts";

it("rejects missing or remote database targets and non-absolute quarantine paths", () => {
  expect(() => buildLocalPlan({})).toThrow();
  expect(() => buildLocalPlan({GC_LOCAL_SYNTHETIC_ONLY: "yes", GC_LOCAL_POSTGRES_URL: "jdbc:postgresql://example.com:5432/demo", GC_LOCAL_QUARANTINE_ROOT: "/tmp/demo"})).toThrow();
  expect(() => buildLocalPlan({GC_LOCAL_SYNTHETIC_ONLY: "yes", GC_LOCAL_POSTGRES_URL: "jdbc:postgresql://127.0.0.1:5432/demo", GC_LOCAL_QUARANTINE_ROOT: "relative"})).toThrow();
});

it("isolates runtime environment and enables only the bounded local synthetic path", () => {
  const plan = buildLocalPlan({GC_LOCAL_SYNTHETIC_ONLY: "yes", GC_LOCAL_POSTGRES_URL: "jdbc:postgresql://127.0.0.1:5432/demo", GC_LOCAL_QUARANTINE_ROOT: process.cwd(), GC_AIDA_API_KEY: "must-not-propagate", GC_DATABASE_PASSWORD: "must-not-propagate"});
  expect(plan.core.GC_FOUNDATION_DEMO_BOOTSTRAP_ENABLED).toBe("true");
  expect(plan.core.GC_ALLOWED_DOCUMENT_SHA256.split(",")).toHaveLength(2);
  expect(plan.core.GC_DATABASE_PASSWORD).toBe("");
  expect(plan.worker).not.toHaveProperty("GC_DATABASE_URL");
  expect(plan.web).not.toHaveProperty("GC_DATABASE_URL");
  for (const env of [plan.core, plan.worker, plan.web]) expect(env).not.toHaveProperty("GC_AIDA_API_KEY");
});
