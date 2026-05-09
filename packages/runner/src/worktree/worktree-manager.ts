import path from "node:path";
import { execa } from "execa";
import type { RunnerConfig } from "../config/schema.js";

export async function createWorktree(
  config: RunnerConfig,
  options: { repositoryPath: string; issueNumber: number }
): Promise<{ branch: string; worktreePath: string }> {
  const branch = `${config.branch.prefix}${options.issueNumber}`;
  const worktreePath = path.join(options.repositoryPath, config.worktree.root, `issue-${options.issueNumber}`);
  const result = await execa("git", ["worktree", "add", "-b", branch, worktreePath], {
    cwd: options.repositoryPath,
    reject: false
  });
  if (result.exitCode !== 0) {
    throw new Error(`git worktree add failed: ${result.stderr}`);
  }
  return { branch, worktreePath };
}

