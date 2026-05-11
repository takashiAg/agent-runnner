import { describe, expect, it } from "vitest";
import { routeWorkerEvent } from "../src/core/app/usecases/worker.js";
import { loadExampleConfig } from "./helpers.js";

describe("routeWorkerEvent", () => {
  it("routes ready labels to run-once", async () => {
    const config = await loadExampleConfig();
    expect(
      routeWorkerEvent(config, {
        kind: "issue-labeled",
        issueNumber: 12,
        labels: ["ai:ready"]
      })
    ).toEqual({ kind: "run-once", issueNumber: 12 });
  });

  it("routes comment commands", async () => {
    const config = await loadExampleConfig();
    expect(
      routeWorkerEvent(config, {
        kind: "issue-comment",
        issueNumber: 12,
        body: "/split-tasks"
      })
    ).toEqual({ kind: "split-tasks", issueNumber: 12 });
  });

  it("routes PR opened events when auto review is enabled", async () => {
    const config = await loadExampleConfig();
    expect(routeWorkerEvent(config, { kind: "pull-request-opened", prNumber: 5 })).toEqual({
      kind: "review-pr",
      prNumber: 5
    });
  });
});
