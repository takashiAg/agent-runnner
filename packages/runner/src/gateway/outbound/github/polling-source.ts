import type { Octokit } from "@octokit/rest";
import type { WorkerEvent } from "../../../core/app/usecases/worker.js";
import type { RunnerSettings } from "../../../core/app/settings/runner-settings.js";
import { splitRepository } from "./github-client.js";

export type PolledWorkerEvent = {
  id: string;
  updatedAt: string;
  event: WorkerEvent;
};

export async function pollGitHubWorkerEvents(
  client: Octokit,
  config: RunnerSettings,
  options: { since: Date }
): Promise<PolledWorkerEvent[]> {
  const { owner, repo } = splitRepository(config.repository);
  const [triggerIssues, splitIssues, comments, pulls] = await Promise.all([
    listIssuesWithLabel(client, owner, repo, config.labels.trigger, options.since),
    listIssuesWithLabel(client, owner, repo, config.labels.splitTasks, options.since),
    client.rest.issues.listCommentsForRepo({
      owner,
      repo,
      since: options.since.toISOString(),
      per_page: 100
    }),
    client.rest.pulls.list({
      owner,
      repo,
      state: "open",
      sort: "updated",
      direction: "desc",
      per_page: 100
    })
  ]);

  return [
    ...triggerIssues.data.map((issue) => issueLabelEvent(issue, config.labels.trigger)),
    ...splitIssues.data.map((issue) => issueLabelEvent(issue, config.labels.splitTasks)),
    ...comments.data.map((comment) => ({
      id: `issue-comment:${comment.id}`,
      updatedAt: comment.updated_at,
      event: {
        kind: "issue-comment" as const,
        issueNumber: issueNumberFromUrl(comment.issue_url),
        body: comment.body ?? ""
      }
    })),
    ...pulls.data
      .filter((pull) => new Date(pull.updated_at).getTime() >= options.since.getTime())
      .map((pull) => ({
        id: `pull-request:${pull.number}:${pull.updated_at}`,
        updatedAt: pull.updated_at,
        event:
          new Date(pull.created_at).getTime() >= options.since.getTime()
            ? ({
                kind: "pull-request-opened" as const,
                prNumber: pull.number
              } satisfies WorkerEvent)
            : ({
                kind: "pull-request-updated" as const,
                prNumber: pull.number
              } satisfies WorkerEvent)
      }))
  ].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
}

async function listIssuesWithLabel(
  client: Octokit,
  owner: string,
  repo: string,
  label: string,
  since: Date
) {
  return client.rest.issues.listForRepo({
    owner,
    repo,
    state: "open",
    labels: label,
    since: since.toISOString(),
    per_page: 100
  });
}

function issueLabelEvent(
  issue: {
    number: number;
    updated_at: string;
    labels: Array<string | { name?: string | null }>;
  },
  label: string
): PolledWorkerEvent {
  return {
    id: `issue:${issue.number}:label:${label}:${issue.updated_at}`,
    updatedAt: issue.updated_at,
    event: {
      kind: "issue-labeled",
      issueNumber: issue.number,
      labels: issue.labels
        .map((item) => (typeof item === "string" ? item : item.name))
        .filter((item): item is string => Boolean(item))
    }
  };
}

function issueNumberFromUrl(url: string): number {
  const issueNumber = Number(url.split("/").at(-1));
  if (!Number.isInteger(issueNumber)) throw new Error(`Invalid issue URL: ${url}`);
  return issueNumber;
}
