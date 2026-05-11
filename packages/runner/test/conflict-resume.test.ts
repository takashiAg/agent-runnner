import { describe, expect, it } from "vitest";
import { decideConflictResume } from "../src/core/app/services/conflict-resume.js";
import { loadExampleConfig } from "./helpers.js";

describe("decideConflictResume", () => {
  it("allows auto resume when existing conflict policy allows the marker files", async () => {
    const config = await loadExampleConfig();

    const result = decideConflictResume(
      [
        {
          path: "src/index.ts",
          content: "<<<<<<< HEAD\nimport a\n=======\nimport b\n>>>>>>> branch\n",
          kind: "import-order"
        }
      ],
      config
    );

    expect(result).toMatchObject({
      canResume: true,
      action: "auto-resolve",
      reasons: []
    });
    expect(result.analysis.conflictFiles).toEqual(["src/index.ts"]);
  });

  it("asks for human input when conflict policy rejects the marker files", async () => {
    const config = await loadExampleConfig();

    const result = decideConflictResume(
      [
        {
          path: "src/auth.ts",
          content: "<<<<<<< HEAD\nold\n=======\nnew\n>>>>>>> branch\n",
          kind: "semantic"
        }
      ],
      config
    );

    expect(result.canResume).toBe(false);
    expect(result.action).toBe("ask-human");
    expect(result.reasons).toContain("conflict requires human judgement: src/auth.ts");
  });

  it("does not resume when no conflict markers are present", async () => {
    const config = await loadExampleConfig();

    const result = decideConflictResume(
      [{ path: "src/index.ts", content: "const value = 1;\n" }],
      config
    );

    expect(result).toMatchObject({
      canResume: false,
      action: "none",
      reasons: ["no conflict markers found"]
    });
  });
});
