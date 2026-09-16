// @vitest-environment node
import { describe, expect, it } from "vitest";
import { describeRunScope, parseLimit, resolveReportPath, todayInSeoul } from "../scripts/medgemma-local-experiment.mts";

describe("parseLimit", () => {
  it("returns undefined when --limit is absent", () => {
    expect(parseLimit(undefined)).toBeUndefined();
  });

  it("accepts a positive integer", () => {
    expect(parseLimit("3")).toBe(3);
    expect(parseLimit("1")).toBe(1);
  });

  it.each(["0", "-1", "1.5", "abc", "", " 3", "3 "])("rejects %j", (raw) => {
    expect(() => parseLimit(raw)).toThrow(/--limit must be a positive integer/);
  });
});

describe("todayInSeoul", () => {
  it("formats the given date as YYYY-MM-DD in the Asia/Seoul timezone", () => {
    // 2026-01-01T15:30:00Z is 2026-01-02 00:30 in Seoul (UTC+9) — crosses the date line.
    expect(todayInSeoul(new Date("2026-01-01T15:30:00Z"))).toBe("2026-01-02");
    expect(todayInSeoul(new Date("2026-09-17T01:00:00Z"))).toBe("2026-09-17");
  });
});

describe("resolveReportPath", () => {
  const repositoryRoot = "/repo";
  const webRoot = "/repo/apps/web";

  it("honors an explicit --report over everything else", () => {
    const path = resolveReportPath({ limit: 2, reportArg: "custom/out.md", today: "2026-09-17", repositoryRoot, webRoot });
    expect(path.replace(/\\/g, "/")).toMatch(/custom\/out\.md$/);
  });

  it("defaults a --limit run to build/medgemma, never the canonical docs/status path", () => {
    const path = resolveReportPath({ limit: 5, reportArg: undefined, today: "2026-09-17", repositoryRoot, webRoot });
    const normalized = path.replace(/\\/g, "/");
    expect(normalized).toMatch(/\/repo\/apps\/web\/build\/medgemma\/medgemma-local-experiment-limit5\.md$/);
    expect(normalized).not.toContain("docs/status");
  });

  it("defaults a full run (no --limit) to docs/status/<today>", () => {
    const path = resolveReportPath({ limit: undefined, reportArg: undefined, today: "2026-09-17", repositoryRoot, webRoot });
    const normalized = path.replace(/\\/g, "/");
    expect(normalized).toMatch(/\/repo\/docs\/status\/2026-09-17\/medgemma-local-experiment\.md$/);
  });
});

describe("describeRunScope", () => {
  it("adds no title prefix or environment line for a full run", () => {
    expect(describeRunScope({ limit: undefined, evaluated: 25, total: 25 })).toEqual({ titlePrefix: "", extraEnvironment: [] });
  });

  it("labels a limited run so it can't be mistaken for the full experiment", () => {
    const scope = describeRunScope({ limit: 3, evaluated: 3, total: 25 });
    expect(scope.titlePrefix).toBe("[제한 실행] ");
    expect(scope.extraEnvironment).toEqual([["실행 범위", "제한 실행 — 3 / 25 문서 (전체 실험 아님)"]]);
  });
});
