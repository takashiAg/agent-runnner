import { describe, expect, it } from "vitest";
import { analyzeConflict } from "../src/worktree/conflict-resolver.js";
import { loadExampleConfig } from "./helpers.js";

describe("analyzeConflict", () => {
  it("asks for human input on semantic conflict", async () => {
    const config = await loadExampleConfig();
    const result = analyzeConflict(
      [
        {
          path: "src/auth.ts",
          content: "<<<<<<< HEAD\nold\n=======\nnew\n>>>>>>> branch\n",
          kind: "semantic"
        }
      ],
      config
    );
    expect(result.canAutoResolve).toBe(false);
    expect(result.questionComment).toContain("Conflict");
  });

  it("allows low-risk import-order conflicts", async () => {
    const config = await loadExampleConfig();
    const result = analyzeConflict(
      [
        {
          path: "src/index.ts",
          content: "<<<<<<< HEAD\nimport a\n=======\nimport b\n>>>>>>> branch\n",
          kind: "import-order"
        }
      ],
      config
    );
    expect(result.canAutoResolve).toBe(true);
  });
});

