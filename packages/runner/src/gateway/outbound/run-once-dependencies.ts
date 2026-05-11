import type { RunnerConfig } from "../../core/app/config/runner-config.js";
import type { RunOnceDependencies } from "../../core/app/usecases/run-once.js";
import { runAgentCli } from "./ai/agent-cli-gateway.js";
import { parseAiPatchOutput } from "../../core/app/services/validate-ai-output.js";
import { inspectPatch } from "../../core/app/policy/patch-guard.js";
import { runValidation } from "./command/validation-runner.js";
import { applyPatch } from "./git/apply-patch.js";
import { commitAndPushChanges } from "./git/git-publisher.js";
import { createGitHubClient } from "./github/github-client.js";
import { createIssueWorkflow } from "./github/issue-workflow.js";
import { analyzeRepository } from "./repository/repository-analyzer.js";
import { checkoutRepository } from "./worktree/checkout-manager.js";
import { createWorktree } from "./worktree/worktree-manager.js";

export function createRunOnceDependencies(config: RunnerConfig): RunOnceDependencies {
  return {
    issueWorkflow: createIssueWorkflow(
      createGitHubClient({
        token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "",
        repository: config.repository
      }),
      config
    ),
    analyzeRepository,
    checkoutRepository,
    createWorktree,
    runAgentCli,
    parseAiPatchOutput,
    inspectPatch,
    applyPatch,
    runValidation,
    commitAndPushChanges
  };
}
