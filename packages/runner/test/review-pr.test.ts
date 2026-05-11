import { describe, expect, it } from "vitest";
import { reviewPr, type ReviewPrDependencies } from "../src/core/app/usecases/review-pr.js";
import type { PullRequestReviewWorkflow } from "../src/core/port/review-pr.js";
import { buildPrReviewContext } from "../src/gateway/outbound/ai/build-pr-review-context.js";
import { loadExampleConfig } from "./helpers.js";

function createWorkflow(overrides: Partial<PullRequestReviewWorkflow> = {}): PullRequestReviewWorkflow {
  return {
    async getPullRequest() {
      return {
        number: 42,
        title: "Add runner review workflow",
        body: "Implements review-pr.",
        diff: "diff --git a/src/index.ts b/src/index.ts\n+export const ok = true;",
        labels: ["type:task"],
        htmlUrl: "https://github.com/owner/name/pull/42"
      };
    },
    async postReviewComment() {},
    ...overrides
  };
}

function createDependencies(overrides: Partial<ReviewPrDependencies> = {}): ReviewPrDependencies {
  return {
    reviewWorkflow: createWorkflow(),
    async runAgentCli() {
      return {
        stdout: JSON.stringify({
          summary: "Review completed.",
          role_reviews: [
            { role: "engineer", summary: "Implementation is coherent.", findings: [] },
            { role: "tech-lead", summary: "Architecture boundary is acceptable.", findings: [] }
          ],
          findings: [],
          test_gaps: [],
          approval_notes: ["Keep CLI wiring separate."],
          overall_decision: "comment"
        }),
        stderr: ""
      };
    },
    buildReviewPrompt: buildPrReviewContext,
    ...overrides
  };
}

describe("reviewPr", () => {
  it("builds review input from PR title, body, diff, labels, and configured roles", async () => {
    const config = await loadExampleConfig();
    const result = await reviewPr(
      { ...config, review: { ...config.review, roles: ["engineer", "tech-lead"] } },
      { prNumber: 42, dryRun: true },
      createDependencies()
    );

    expect(result.status).toBe("dry_run");
    expect(result.promptInput).toMatchObject({
      number: 42,
      title: "Add runner review workflow",
      body: "Implements review-pr.",
      labels: ["type:task"],
      roles: ["engineer", "tech-lead"]
    });
    expect(result.promptInput?.diff).toContain("diff --git");
  });

  it("posts a PR comment when AI output covers every configured review role", async () => {
    const config = await loadExampleConfig();
    const comments: Array<{ prNumber: number; body: string }> = [];
    const result = await reviewPr(
      { ...config, review: { ...config.review, roles: ["engineer", "tech-lead"] } },
      { prNumber: 42 },
      createDependencies({
        reviewWorkflow: createWorkflow({
          async postReviewComment(prNumber, body) {
            comments.push({ prNumber, body });
          }
        })
      })
    );

    expect(result.status).toBe("review_commented");
    expect(comments).toHaveLength(1);
    expect(comments[0]?.prNumber).toBe(42);
    expect(comments[0]?.body).toContain("## AI PR Review");
    expect(comments[0]?.body).toContain("### engineer");
    expect(comments[0]?.body).toContain("### tech-lead");
  });

  it("rejects AI output that omits a configured review role", async () => {
    const config = await loadExampleConfig();
    const comments: string[] = [];
    const result = await reviewPr(
      { ...config, review: { ...config.review, roles: ["engineer", "pdm"] } },
      { prNumber: 42 },
      createDependencies({
        async runAgentCli() {
          return {
            stdout: JSON.stringify({
              summary: "Review completed.",
              role_reviews: [
                { role: "engineer", summary: "Implementation is coherent.", findings: [] }
              ]
            }),
            stderr: ""
          };
        },
        reviewWorkflow: createWorkflow({
          async postReviewComment(_prNumber, body) {
            comments.push(body);
          }
        })
      })
    );

    expect(result.status).toBe("invalid_output");
    expect(result.reasons).toEqual(["missing configured review roles: pdm"]);
    expect(comments).toEqual([]);
  });
});
