import type { Octokit } from "@octokit/rest";
import type { Issue } from "../../../core/domain/entity/issue.js";
import type { RunnerSettings } from "../../../core/app/settings/runner-settings.js";
import { splitRepository } from "./github-client.js";

export function createIssueReader(
  client: Octokit,
  config: RunnerSettings
): {
  getIssue(issueNumber: number): Promise<Issue>;
} {
  const { owner, repo } = splitRepository(config.repository);
  return {
    async getIssue(issueNumber) {
      const response = await client.rest.issues.get({ owner, repo, issue_number: issueNumber });
      return {
        number: response.data.number,
        title: response.data.title,
        body: response.data.body ?? "",
        labels: response.data.labels
          .map((label) => (typeof label === "string" ? label : label.name))
          .filter((label): label is string => Boolean(label)),
        htmlUrl: response.data.html_url
      };
    }
  };
}
