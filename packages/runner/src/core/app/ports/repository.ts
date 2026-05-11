import type { RepositoryAnalysis } from "../../domain/value-object/repository-analysis.js";
import type { RunnerConfig } from "../config/runner-config.js";

export type { RepositoryAnalysis };

export type AnalyzeRepository = (root: string, config: RunnerConfig) => Promise<RepositoryAnalysis>;

export type CheckoutRepository = (
  config: RunnerConfig,
  options: { remoteUrl: string; runId: string; cwd: string }
) => Promise<{
  repositoryPath: string;
  strategy: RunnerConfig["checkout"]["strategy"];
}>;

export type CreateWorktree = (
  config: RunnerConfig,
  options: { repositoryPath: string; issueNumber: number }
) => Promise<{ branch: string; worktreePath: string }>;
