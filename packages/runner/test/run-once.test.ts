import { describe, expect, it } from "vitest";
import { runOnce, type RunOnceDependencies } from "../src/core/app/usecases/run-once.js";
import type { IssueWorkflow } from "../src/core/app/ports/issue-workflow.js";
import { parseAiPatchOutput } from "../src/core/app/services/validate-ai-output.js";
import { loadExampleConfig } from "./helpers.js";

function createWorkflow(overrides: Partial<IssueWorkflow> = {}): IssueWorkflow {
  return {
    async pickReadyIssue() {
      return {
        number: 123,
        title: "Fix greeting",
        body: "Please update greeting.",
        labels: ["ai:ready", "type:task"],
        htmlUrl: "https://github.com/owner/name/issues/123"
      };
    },
    async addLabels() {},
    async removeLabels() {},
    async comment() {},
    async createPullRequest() {
      return { number: 456, url: "https://github.com/owner/name/pull/456" };
    },
    ...overrides
  };
}

function createDependencies(overrides: Partial<RunOnceDependencies> = {}): RunOnceDependencies {
  return {
    issueWorkflow: createWorkflow(),
    async analyzeRepository() {
      return {
        packageManager: "pnpm",
        workspaces: ["packages/*"],
        boundaries: {},
        splitHints: []
      };
    },
    async checkoutRepository() {
      return { repositoryPath: "/tmp/repo", strategy: "fresh-clone" };
    },
    async createWorktree() {
      return {
        branch: "ai/issue-123",
        worktreePath: "/tmp/repo/.agent-runner/worktrees/issue-123"
      };
    },
    async runAgentCli() {
      return {
        stdout: JSON.stringify({
          summary: "Updated greeting.",
          risk_notes: [],
          assumptions: [],
          changed_files: ["src/greeting.ts"],
          patch: [
            "diff --git a/src/greeting.ts b/src/greeting.ts",
            "--- a/src/greeting.ts",
            "+++ b/src/greeting.ts",
            "@@ -1 +1 @@",
            "-hello",
            "+hello world"
          ].join("\n"),
          tests_to_run: [],
          requires_human_approval: false,
          block_reason: null
        }),
        stderr: ""
      };
    },
    async applyPatch() {
      return { ok: true, stderr: "" };
    },
    parseAiPatchOutput,
    inspectPatch() {
      return { safe: true, files: ["src/greeting.ts"], reasons: [] };
    },
    async runValidation() {
      return { ok: true, results: [] };
    },
    async commitAndPushChanges() {
      return { branch: "ai/issue-123", baseBranch: "main", commitSha: "abc123" };
    },
    now: () => new Date("2026-05-12T00:00:00.000Z"),
    ...overrides
  };
}

describe("runOnce", () => {
  it("returns no_issue when no ready issue is available", async () => {
    const config = await loadExampleConfig();
    const result = await runOnce(
      config,
      { repoRoot: process.cwd() },
      createDependencies({
        issueWorkflow: createWorkflow({
          async pickReadyIssue() {
            return null;
          }
        })
      })
    );

    expect(result.status).toBe("no_issue");
  });

  it("creates a PR after AI patch, patch guard, apply, validation, and publish succeed", async () => {
    const config = await loadExampleConfig();
    const calls: string[] = [];
    const workflow = createWorkflow({
      async addLabels(_issueNumber, labels) {
        calls.push(`add:${labels.join(",")}`);
      },
      async removeLabels(_issueNumber, labels) {
        calls.push(`remove:${labels.join(",")}`);
      },
      async createPullRequest(input) {
        calls.push(`pr:${input.head}:${input.base}`);
        return { number: 456, url: "https://github.com/owner/name/pull/456" };
      }
    });

    const result = await runOnce(
      config,
      { repoRoot: process.cwd(), baseBranch: "main" },
      createDependencies({ issueWorkflow: workflow })
    );

    expect(result.status).toBe("pr_created");
    expect(result.pr?.number).toBe(456);
    expect(calls).toContain("add:ai:running");
    expect(calls).toContain("remove:ai:ready");
    expect(calls).toContain("pr:ai/issue-123:main");
    expect(calls).toContain("add:ai:pr-created");
  });

  it("blocks and comments a checkpoint when patch guard rejects AI output", async () => {
    const config = await loadExampleConfig();
    const comments: string[] = [];
    const result = await runOnce(
      config,
      { repoRoot: process.cwd() },
      createDependencies({
        issueWorkflow: createWorkflow({
          async comment(_issueNumber, body) {
            comments.push(body);
          }
        }),
        inspectPatch() {
          return { safe: false, files: [".env"], reasons: ["denylisted path: .env"] };
        }
      })
    );

    expect(result.status).toBe("blocked");
    expect(result.reasons).toEqual(["denylisted path: .env"]);
    expect(comments.join("\n")).toContain("label-triggered-ai-runner-checkpoint");
    expect(comments.join("\n")).toContain("patch_blocked");
  });
});
