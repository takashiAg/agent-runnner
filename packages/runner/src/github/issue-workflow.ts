import type { Octokit } from "@octokit/rest";
import type { RunnerConfig } from "../config/schema.js";
import { formatCheckpoint, type Checkpoint } from "../runner/checkpoint.js";
import { splitRepository } from "./github-client.js";

export type GitHubIssue = {
  number: number;
  title: string;
  body: string;
  labels: string[];
  htmlUrl: string;
};

export type PullRequestInput = {
  title: string;
  body: string;
  head: string;
  base: string;
};

export type PullRequestResult = {
  number: number;
  url: string;
};

export type IssueWorkflow = {
  pickReadyIssue(config: RunnerConfig): Promise<GitHubIssue | null>;
  addLabels(issueNumber: number, labels: string[]): Promise<void>;
  removeLabels(issueNumber: number, labels: string[]): Promise<void>;
  comment(issueNumber: number, body: string): Promise<void>;
  createPullRequest(input: PullRequestInput): Promise<PullRequestResult>;
};

type GitHubLabel = string | { name?: string | null };

const excludedPickupLabels = (config: RunnerConfig): string[] => [
  config.labels.running,
  config.labels.blocked,
  config.labels.prCreated
];

export function createIssueWorkflow(client: Octokit, config: RunnerConfig): IssueWorkflow {
  const { owner, repo } = splitRepository(config.repository);

  return {
    async pickReadyIssue(activeConfig) {
      const response = await client.rest.issues.listForRepo({
        owner,
        repo,
        state: "open",
        labels: activeConfig.labels.trigger,
        sort: "created",
        direction: "asc",
        per_page: 25
      });
      const issue = response.data.find((item) => {
        if ("pull_request" in item) return false;
        const labels = normalizeLabels(item.labels);
        return !excludedPickupLabels(activeConfig).some((label) => labels.includes(label));
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

export async function commentCheckpoint(
  workflow: IssueWorkflow,
  checkpoint: Checkpoint
): Promise<void> {
  if (!checkpoint.issueNumber) return;
  await workflow.comment(checkpoint.issueNumber, formatCheckpoint(checkpoint));
}

function normalizeLabels(labels: GitHubLabel[]): string[] {
  return labels
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter((label): label is string => Boolean(label));
}
