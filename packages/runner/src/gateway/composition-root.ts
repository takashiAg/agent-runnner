import type { RunOnceDependencies } from "../core/app/usecases/run-once.js";
import type { RunnerSettings } from "../core/app/settings/runner-settings.js";
import { buildIssueContext } from "./outbound/ai/build-issue-context.js";
import { runAgentCli } from "./outbound/ai/agent-cli-gateway.js";
import { parseAiPatchOutput } from "../core/app/services/validate-ai-output.js";
import { inspectPatch } from "../core/app/policy/patch-guard.js";
import { runValidation } from "./outbound/command/validation-runner.js";
import { applyPatch } from "./outbound/git/apply-patch.js";
import { commitAndPushChanges } from "./outbound/git/git-publisher.js";
import { createGitHubClient } from "./outbound/github/github-client.js";
import { createIssueWorkflow } from "./outbound/github/issue-workflow.js";
import { analyzeRepository } from "./outbound/repository/repository-analyzer.js";
import { checkoutRepository } from "./outbound/worktree/checkout-manager.js";
import { createWorktree } from "./outbound/worktree/worktree-manager.js";

export function createRunOnceDependencies(config: RunnerSettings): RunOnceDependencies {
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
    commitAndPushChanges,
    buildIssuePrompt: buildIssueContext
  };
}
