import type { RepositoryAnalysis } from "../domain/value-object/repository-analysis.js";
import type { RunnerSettings } from "../app/settings/runner-settings.js";

export type { RepositoryAnalysis };

export type AnalyzeRepository = (
  root: string,
  config: RunnerSettings
) => Promise<RepositoryAnalysis>;

export type CheckoutRepository = (
  config: RunnerSettings,
  options: { remoteUrl: string; runId: string; cwd: string }
) => Promise<{
  repositoryPath: string;
  strategy: RunnerSettings["checkout"]["strategy"];
}>;

export type CreateWorktree = (
  config: RunnerSettings,
  options: { repositoryPath: string; issueNumber: number }
) => Promise<{ branch: string; worktreePath: string }>;
