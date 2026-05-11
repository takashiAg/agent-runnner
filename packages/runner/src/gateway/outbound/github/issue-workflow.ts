import type { Octokit } from "@octokit/rest";
import type { IssueWorkflow } from "../../../core/app/ports/issue-workflow.js";
import type { RunnerConfig } from "../../../core/app/config/runner-config.js";
import { splitRepository } from "./github-client.js";

type GitHubLabel = string | { name?: string | null };

const excludedPickupLabels = (config: RunnerConfig): string[] => [
  config.labels.running,
  config.labels.blocked,
  config.labels.prCreated
];

export function createIssueWorkflow(client: Octokit, config: RunnerConfig): IssueWorkflow {
  const { owner, repo } = splitRepository(config.repository);

  return {
    async pickReadyIssue() {
      const response = await client.rest.issues.listForRepo({
        owner,
        repo,
        state: "open",
        labels: config.labels.trigger,
        sort: "created",
        direction: "asc",
        per_page: 25
      });
      const issue = response.data.find((item) => {
        if ("pull_request" in item) return false;
        const labels = normalizeLabels(item.labels);
        return !excludedPickupLabels(config).some((label) => labels.includes(label));
      });
      if (!issue) return null;
      return {
        number: issue.number,
        title: issue.title,
        body: issue.body ?? "",
        labels: normalizeLabels(issue.labels),
        htmlUrl: issue.html_url
      };
    },

    async addLabels(issueNumber, labels) {
      if (labels.length === 0) return;
      await client.rest.issues.addLabels({ owner, repo, issue_number: issueNumber, labels });
    },

    async removeLabels(issueNumber, labels) {
      for (const label of labels) {
        await client.rest.issues.removeLabel({
          owner,
          repo,
          issue_number: issueNumber,
          name: label
        });
      }
    },

    async comment(issueNumber, body) {
      await client.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
    },

    async createPullRequest(input) {
      const response = await client.rest.pulls.create({
        owner,
        repo,
        title: input.title,
        body: input.body,
        head: input.head,
        base: input.base
      });
      return { number: response.data.number, url: response.data.html_url };
    }
  };
}

function normalizeLabels(labels: GitHubLabel[]): string[] {
  return labels
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter((label): label is string => Boolean(label));
}
