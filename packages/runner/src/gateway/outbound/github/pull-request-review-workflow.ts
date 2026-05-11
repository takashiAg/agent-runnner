import type { Octokit } from "@octokit/rest";
import type { PullRequestReviewWorkflow } from "../../../core/port/review-pr.js";
import type { RunnerSettings } from "../../../core/app/settings/runner-settings.js";
import { splitRepository } from "./github-client.js";

export function createPullRequestReviewWorkflow(
  client: Octokit,
  config: RunnerSettings
): PullRequestReviewWorkflow {
  const { owner, repo } = splitRepository(config.repository);

  return {
    async getPullRequest(prNumber) {
      const [pr, files] = await Promise.all([
        client.rest.pulls.get({ owner, repo, pull_number: prNumber }),
        client.rest.pulls.listFiles({ owner, repo, pull_number: prNumber, per_page: 100 })
      ]);
      return {
        number: pr.data.number,
        title: pr.data.title,
        body: pr.data.body ?? "",
        labels: pr.data.labels.map((label) => label.name),
        htmlUrl: pr.data.html_url,
        diff: files.data
          .map((file) =>
            [`diff --git a/${file.filename} b/${file.filename}`, file.patch ?? ""].join("\n")
          )
          .join("\n")
      };
    },

    async postReviewComment(prNumber, body) {
      await client.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
    }
  };
}
