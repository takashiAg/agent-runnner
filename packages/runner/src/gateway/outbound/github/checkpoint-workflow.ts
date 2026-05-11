import type { Octokit } from "@octokit/rest";
import type { CheckpointComment } from "../../../core/app/services/checkpoint-resume.js";
import type { RunnerSettings } from "../../../core/app/settings/runner-settings.js";
import { splitRepository } from "./github-client.js";

export function createCheckpointWorkflow(
  client: Octokit,
  config: RunnerSettings
): {
  listIssueComments(issueNumber: number): Promise<CheckpointComment[]>;
  comment(issueNumber: number, body: string): Promise<void>;
} {
  const { owner, repo } = splitRepository(config.repository);
  return {
    async listIssueComments(issueNumber) {
      const response = await client.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100
      });
      return response.data.map((comment) => ({
        id: comment.id,
        body: comment.body ?? "",
        createdAt: comment.created_at,
        updatedAt: comment.updated_at
      }));
    },
    async comment(issueNumber, body) {
      await client.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
    }
  };
}
