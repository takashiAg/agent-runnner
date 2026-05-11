import type { WorkerEvent } from "../../core/app/usecases/worker.js";

type GitHubWebhookPayload = {
  action?: string;
  issue?: {
    number: number;
    labels?: Array<string | { name?: string | null }>;
  };
  pull_request?: {
    number: number;
  };
  comment?: {
    body?: string;
  };
};

export function parseGitHubWebhookEvent(payload: GitHubWebhookPayload): WorkerEvent | null {
  if (payload.issue && payload.action === "labeled") {
    return {
      kind: "issue-labeled",
      issueNumber: payload.issue.number,
      labels: normalizeLabels(payload.issue.labels ?? [])
    };
  }
  if (payload.issue && payload.comment && payload.action === "created") {
    return {
      kind: "issue-comment",
      issueNumber: payload.issue.number,
      body: payload.comment.body ?? ""
    };
  }
  if (payload.pull_request && payload.action === "opened") {
    return { kind: "pull-request-opened", prNumber: payload.pull_request.number };
  }
  if (
    payload.pull_request &&
    ["synchronize", "reopened", "ready_for_review"].includes(payload.action ?? "")
  ) {
    return { kind: "pull-request-updated", prNumber: payload.pull_request.number };
  }
  return null;
}

function normalizeLabels(labels: Array<string | { name?: string | null }>): string[] {
  return labels
    .map((label) => (typeof label === "string" ? label : label.name))
    .filter((label): label is string => Boolean(label));
}
