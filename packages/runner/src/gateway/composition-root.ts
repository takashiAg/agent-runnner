import type { RunOnceDependencies } from "../core/app/usecases/run-once.js";
import type { ReviewPrDependencies } from "../core/app/usecases/review-pr.js";
import type { SplitTasksDependencies } from "../core/app/usecases/split-tasks.js";
import type { RunnerSettings } from "../core/app/settings/runner-settings.js";
import { buildIssueContext } from "./outbound/ai/build-issue-context.js";
import { buildPrReviewContext } from "./outbound/ai/build-pr-review-context.js";
import { buildTaskPlanningContext } from "./outbound/ai/build-task-planning-context.js";
import { runAgentCli } from "./outbound/ai/agent-cli-gateway.js";
import { parseAiPatchOutput } from "../core/app/services/validate-ai-output.js";
import { inspectPatch } from "../core/app/policy/patch-guard.js";
import { runValidation } from "./outbound/command/validation-runner.js";
import { applyPatch } from "./outbound/git/apply-patch.js";
import { commitAndPushChanges } from "./outbound/git/git-publisher.js";
import { createGitHubClient } from "./outbound/github/github-client.js";
import { createCheckpointWorkflow } from "./outbound/github/checkpoint-workflow.js";
import { createIssueWorkflow } from "./outbound/github/issue-workflow.js";
import { createPullRequestReviewWorkflow } from "./outbound/github/pull-request-review-workflow.js";
import { createTaskPlanningWorkflow } from "./outbound/github/task-planning-workflow.js";
import { analyzeRepository } from "./outbound/repository/repository-analyzer.js";
import { checkoutRepository } from "./outbound/worktree/checkout-manager.js";
import { createWorktree } from "./outbound/worktree/worktree-manager.js";

export function createGitHubApi(config: RunnerSettings) {
  return createGitHubClient({
    token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "",
    repository: config.repository
  });
}

export function createRunOnceDependencies(config: RunnerSettings): RunOnceDependencies {
  const client = createGitHubApi(config);
  return {
    issueWorkflow: createIssueWorkflow(client, config),
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

export function createSplitTasksDependencies(config: RunnerSettings): SplitTasksDependencies {
  const workflow = createTaskPlanningWorkflow(createGitHubApi(config), config);
  return {
    buildTaskPlanningPrompt: buildTaskPlanningContext,
    requestTaskPlanning: runAgentCli,
    createTaskIssues: workflow.createTaskIssues,
    publishTaskPlan: workflow.publishTaskPlan
  };
}

export function createReviewPrDependencies(config: RunnerSettings): ReviewPrDependencies {
  return {
    reviewWorkflow: createPullRequestReviewWorkflow(createGitHubApi(config), config),
    runAgentCli,
    buildReviewPrompt: buildPrReviewContext
  };
}

export function createCheckpointDependencies(config: RunnerSettings) {
  return createCheckpointWorkflow(createGitHubApi(config), config);
}
