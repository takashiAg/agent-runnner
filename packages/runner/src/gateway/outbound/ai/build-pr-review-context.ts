import type { PullRequestReviewPromptInput } from "../../../core/port/review-pr.js";

export function buildPrReviewContext(input: PullRequestReviewPromptInput): string {
  return JSON.stringify(
    {
      kind: "pr-review-context",
      number: input.number,
      title: input.title,
      body: input.body,
      diff: input.diff,
      labels: input.labels,
      roles: input.roles
    },
    null,
    2
  );
}
