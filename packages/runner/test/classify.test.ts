import { describe, expect, it } from "vitest";
import { classifyIssue } from "../src/core/domain/service/classify.js";
import { loadExampleConfig } from "./helpers.js";

describe("classifyIssue", () => {
  it("routes story planning", async () => {
    const config = await loadExampleConfig();
    const result = classifyIssue(["type:story", "ai:plan"], config);
    expect(result.action).toBe("plan");
    expect(result.issueType).toBe("story");
  });

  it("blocks dangerous risk", async () => {
    const config = await loadExampleConfig();
    const result = classifyIssue(["ai:ready", "ai:level-2", "risk:dangerous"], config);
    expect(result.action).toBe("block");
  });

  it("allows low risk level 2 to apply and PR", async () => {
    const config = await loadExampleConfig();
    const result = classifyIssue(["type:task", "ai:ready", "ai:level-2", "risk:low"], config);
    expect(result.action).toBe("apply-and-pr");
  });
});
