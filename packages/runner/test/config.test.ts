import { describe, expect, it } from "vitest";
import { loadExampleConfig } from "./helpers.js";

describe("config", () => {
  it("loads example config", async () => {
    const config = await loadExampleConfig();
    expect(config.repository).toBe("owner/name");
    expect(config.ai.allowCommands).toBe(false);
    expect(config.commentCommands.allowlist).toContain("/review");
  });
});

