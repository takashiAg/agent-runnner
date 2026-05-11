import { describe, expect, it } from "vitest";
import { routeCommentCommand } from "../src/core/domain/service/command-router.js";
import { loadExampleConfig } from "./helpers.js";

describe("routeCommentCommand", () => {
  it("routes review command", async () => {
    const config = await loadExampleConfig();
    expect(routeCommentCommand("/review", config)).toEqual({
      kind: "review",
      command: "/review"
    });
  });

  it("ignores unknown commands", async () => {
    const config = await loadExampleConfig();
    expect(routeCommentCommand("/deploy", config)).toBeNull();
  });

  it("does not treat shell text as a command", async () => {
    const config = await loadExampleConfig();
    expect(routeCommentCommand("please run git status", config)).toBeNull();
  });
});
