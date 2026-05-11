import { describe, expect, it } from "vitest";
import { formatCheckpoint, type Checkpoint } from "../src/core/domain/entity/checkpoint.js";
import {
  decideCheckpointResume,
  findLatestCheckpointComment,
  parseCheckpointComment
} from "../src/core/app/services/checkpoint-resume.js";

describe("checkpoint resume", () => {
  it("parses checkpoint JSON from a marker comment", () => {
    const checkpoint = checkpointFixture({ state: "validation_failed" });

    expect(parseCheckpointComment(formatCheckpoint(checkpoint))).toEqual(checkpoint);
  });

  it("selects the newest checkpoint from comment history", () => {
    const oldCheckpoint = checkpointFixture({
      state: "ai_output_failed",
      updatedAt: "2026-05-12T00:00:00.000Z"
    });
    const newCheckpoint = checkpointFixture({
      state: "validation_failed",
      updatedAt: "2026-05-12T01:00:00.000Z"
    });

    const result = findLatestCheckpointComment([
      { id: 1, body: formatCheckpoint(oldCheckpoint) },
      { id: 2, body: "plain comment" },
      { id: 3, body: formatCheckpoint(newCheckpoint) }
    ]);

    expect(result?.checkpoint).toEqual(newCheckpoint);
    expect(result?.comment.id).toBe(3);
  });

  it("returns resume decisions for resumable states", () => {
    expect(decideCheckpointResume(checkpointFixture({ state: "ai_output_failed" }))).toMatchObject({
      canResume: true,
      action: "resume-ai"
    });
    expect(decideCheckpointResume(checkpointFixture({ state: "patch_blocked" }))).toMatchObject({
      canResume: true,
      action: "resume-conflict"
    });
    expect(decideCheckpointResume(checkpointFixture({ state: "validation_failed" }))).toMatchObject({
      canResume: true,
      action: "retry-validation"
    });
  });

  it("returns non-resume decisions for terminal or human states", () => {
    expect(decideCheckpointResume(checkpointFixture({ state: "running" }))).toMatchObject({
      canResume: false,
      action: "none"
    });
    expect(decideCheckpointResume(checkpointFixture({ state: "needs_human_input" }))).toMatchObject({
      canResume: false,
      action: "wait-for-human"
    });
    expect(decideCheckpointResume(checkpointFixture({ state: "needs_human_approval" }))).toMatchObject({
      canResume: false,
      action: "wait-for-human"
    });
    expect(decideCheckpointResume(checkpointFixture({ state: "needs_split" }))).toMatchObject({
      canResume: false,
      action: "split-tasks"
    });
    expect(decideCheckpointResume(checkpointFixture({ state: "pr_created" }))).toMatchObject({
      canResume: false,
      action: "none"
    });
  });
});

function checkpointFixture(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    state: "running",
    issueNumber: 12,
    labels: ["ai:ready"],
    branch: "ai/issue-12",
    worktree: "/tmp/worktree",
    updatedAt: "2026-05-12T00:00:00.000Z",
    ...overrides
  };
}
