import { describe, expect, it } from "vitest";
import { inspectPatch } from "../src/core/app/policy/patch-guard.js";
import { loadExampleConfig } from "./helpers.js";

describe("inspectPatch", () => {
  it("accepts a small unified diff", async () => {
    const config = await loadExampleConfig();
    const patch = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new"
    ].join("\n");
    const result = inspectPatch(patch, config);
    expect(result.safe).toBe(true);
    expect(result.files).toEqual(["src/a.ts"]);
  });

  it("blocks denylisted paths", async () => {
    const config = await loadExampleConfig();
    const patch = [
      "diff --git a/.env b/.env",
      "--- a/.env",
      "+++ b/.env",
      "@@ -1 +1 @@",
      "-A=1",
      "+A=2"
    ].join("\n");
    const result = inspectPatch(patch, config);
    expect(result.safe).toBe(false);
    expect(result.reasons.join("\n")).toContain("denylisted path");
  });
});
