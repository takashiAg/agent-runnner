import { Octokit } from "@octokit/rest";

export type GitHubClientOptions = {
  token: string;
  repository: string;
};

export function createGitHubClient(options: GitHubClientOptions): Octokit {
  if (!options.token) throw new Error("GitHub token is required");
  return new Octokit({ auth: options.token });
}

export function splitRepository(repository: string): { owner: string; repo: string } {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error(`Invalid repository: ${repository}`);
  return { owner, repo };
}

