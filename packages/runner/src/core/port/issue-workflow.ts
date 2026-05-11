import type { Issue } from "../domain/entity/issue.js";

export type GitHubIssue = Issue;

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
  pickReadyIssue(): Promise<GitHubIssue | null>;
  addLabels(issueNumber: number, labels: string[]): Promise<void>;
  removeLabels(issueNumber: number, labels: string[]): Promise<void>;
  comment(issueNumber: number, body: string): Promise<void>;
  createPullRequest(input: PullRequestInput): Promise<PullRequestResult>;
};
