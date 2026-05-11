import type { RunnerSettings } from "../app/settings/runner-settings.js";

export type ReviewRole = RunnerSettings["review"]["roles"][number];

export type PullRequestReviewTarget = {
  number: number;
  title: string;
  body: string;
  diff: string;
  labels: string[];
  htmlUrl?: string;
};

export type PullRequestReviewPromptInput = PullRequestReviewTarget & {
  roles: ReviewRole[];
};

export type PullRequestReviewWorkflow = {
  getPullRequest(prNumber: number): Promise<PullRequestReviewTarget>;
  postReviewComment(prNumber: number, body: string): Promise<void>;
};

export type BuildPullRequestReviewPrompt = (input: PullRequestReviewPromptInput) => string;
