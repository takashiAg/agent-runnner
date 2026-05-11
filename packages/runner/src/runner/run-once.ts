import type { RunnerConfig } from "../config/schema.js";
import { buildIssueContext } from "../context/build-context.js";
import { createGitHubClient } from "../github/github-client.js";
import {
  commentCheckpoint,
  createIssueWorkflow,
  type GitHubIssue,
  type IssueWorkflow
} from "../github/issue-workflow.js";
import { commitAndPushChanges, type PublishResult } from "../git/git-publisher.js";
import { runAgentCli } from "../ai/agent-cli-adapter.js";
import { parseAiPatchOutput } from "../patch/validate-output.js";
import { inspectPatch } from "../patch/patch-guard.js";
import { applyPatch } from "../patch/apply-patch.js";
import { runValidation, type ValidationResult } from "../validation/validation-runner.js";
import { analyzeRepository } from "../repository/repository-analyzer.js";
import { checkoutRepository } from "../worktree/checkout-manager.js";
import { createWorktree } from "../worktree/worktree-manager.js";
import type { Checkpoint } from "./checkpoint.js";

export type RunOnceResult = {
  ok: true;
  mode: "dry-run" | "executed";
  repository: string;
  issue?: Pick<GitHubIssue, "number" | "title" | "htmlUrl">;
  analysis?: Awaited<ReturnType<typeof analyzeRepository>>;
  branch?: string;
  worktree?: string;
  pr?: {
    number: number;
    url: string;
  };
  status:
    | "no_issue"
    | "dry_run"
    | "blocked"
    | "needs_human_approval"
    | "validation_failed"
    | "pr_created";
  reasons?: string[];
  validation?: ValidationResult;
};

export type RunOnceDependencies = {
  issueWorkflow?: IssueWorkflow;
  analyzeRepository?: typeof analyzeRepository;
  checkoutRepository?: typeof checkoutRepository;
  createWorktree?: typeof createWorktree;
  runAgentCli?: typeof runAgentCli;
  parseAiPatchOutput?: typeof parseAiPatchOutput;
  inspectPatch?: typeof inspectPatch;
  applyPatch?: typeof applyPatch;
  runValidation?: typeof runValidation;
  commitAndPushChanges?: typeof commitAndPushChanges;
  now?: () => Date;
};

export async function runOnce(
  config: RunnerConfig,
  options: { repoRoot: string; remoteUrl?: string; baseBranch?: string; dryRun?: boolean },
  dependencies: RunOnceDependencies = {}
): Promise<RunOnceResult> {
  const deps = resolveDependencies(config, dependencies);
  const issue = await deps.issueWorkflow.pickReadyIssue(config);
  if (!issue) {
    return {
      ok: true,
      mode: options.dryRun ? "dry-run" : "executed",
      repository: config.repository,
      status: "no_issue"
    };
  }

  const analysis = await deps.analyzeRepository(options.repoRoot, config);
  if (options.dryRun) {
    return {
      ok: true,
      mode: "dry-run",
      repository: config.repository,
      issue: summarizeIssue(issue),
      analysis,
      status: "dry_run"
    };
  }

  await deps.issueWorkflow.addLabels(issue.number, [config.labels.running]);
  await deps.issueWorkflow.removeLabels(issue.number, [config.labels.trigger]);

  const startedAt = deps.now().toISOString();
  let branch: string | undefined;
  let worktree: string | undefined;

  try {
    const checkout = await deps.checkoutRepository(config, {
      remoteUrl: options.remoteUrl ?? githubRemoteUrl(config.repository),
      runId: `issue-${issue.number}-${Date.now()}`,
      cwd: options.repoRoot
    });
    const createdWorktree = await deps.createWorktree(config, {
      repositoryPath: checkout.repositoryPath,
      issueNumber: issue.number
    });
    branch = createdWorktree.branch;
    worktree = createdWorktree.worktreePath;

    const context = buildIssueContext({
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
      analysis
    });
    const agentResult = await deps.runAgentCli(context, config, { cwd: worktree });
    const aiOutput = deps.parseAiPatchOutput(agentResult.stdout);

    if (aiOutput.block_reason) {
      await failIssue(deps.issueWorkflow, config, {
        state: "needs_human_input",
        issueNumber: issue.number,
        labels: issue.labels,
        branch,
        worktree,
        lastFailureReason: aiOutput.block_reason,
        updatedAt: deps.now().toISOString()
      });
      return {
        ok: true,
        mode: "executed",
        repository: config.repository,
        issue: summarizeIssue(issue),
        analysis,
        branch,
        worktree,
        status: "blocked",
        reasons: [aiOutput.block_reason]
      };
    }

    if (aiOutput.requires_human_approval) {
      await deps.issueWorkflow.comment(
        issue.number,
        buildHumanApprovalComment(aiOutput.summary, aiOutput.risk_notes)
      );
      await failIssue(deps.issueWorkflow, config, {
        state: "needs_human_approval",
        issueNumber: issue.number,
        labels: issue.labels,
        branch,
        worktree,
        lastFailureReason: "AI output requires human approval",
        updatedAt: deps.now().toISOString()
      });
      return {
        ok: true,
        mode: "executed",
        repository: config.repository,
        issue: summarizeIssue(issue),
        analysis,
        branch,
        worktree,
        status: "needs_human_approval",
        reasons: aiOutput.risk_notes
      };
    }

    const patchInspection = deps.inspectPatch(aiOutput.patch, config);
    if (!patchInspection.safe) {
      await failIssue(deps.issueWorkflow, config, {
        state: "patch_blocked",
        issueNumber: issue.number,
        labels: issue.labels,
        branch,
        worktree,
        lastFailureReason: patchInspection.reasons.join("; "),
        updatedAt: deps.now().toISOString()
      });
      return {
        ok: true,
        mode: "executed",
        repository: config.repository,
        issue: summarizeIssue(issue),
        analysis,
        branch,
        worktree,
        status: "blocked",
        reasons: patchInspection.reasons
      };
    }

    const applyResult = await deps.applyPatch(aiOutput.patch, { cwd: worktree });
    if (!applyResult.ok) {
      await failIssue(deps.issueWorkflow, config, {
        state: "patch_blocked",
        issueNumber: issue.number,
        labels: issue.labels,
        branch,
        worktree,
        lastFailureReason: applyResult.stderr,
        updatedAt: deps.now().toISOString()
      });
      return {
        ok: true,
        mode: "executed",
        repository: config.repository,
        issue: summarizeIssue(issue),
        analysis,
        branch,
        worktree,
        status: "blocked",
        reasons: [applyResult.stderr]
      };
    }

    const validation = await deps.runValidation(config, worktree);
    if (!validation.ok) {
      await failIssue(deps.issueWorkflow, config, {
        state: "validation_failed",
        issueNumber: issue.number,
        labels: issue.labels,
        branch,
        worktree,
        lastFailureReason: summarizeValidation(validation),
        validationSummary: summarizeValidation(validation),
        updatedAt: deps.now().toISOString()
      });
      return {
        ok: true,
        mode: "executed",
        repository: config.repository,
        issue: summarizeIssue(issue),
        analysis,
        branch,
        worktree,
        status: "validation_failed",
        validation
      };
    }

    const publish = await deps.commitAndPushChanges({
      cwd: worktree,
      branch,
      baseBranch: options.baseBranch,
      message: `Fix issue #${issue.number}: ${issue.title}`
    });
    const pr = await createPullRequest(deps.issueWorkflow, issue, aiOutput.summary, publish);
    await deps.issueWorkflow.addLabels(issue.number, [config.labels.prCreated]);
    await deps.issueWorkflow.removeLabels(issue.number, [
      config.labels.running,
      config.labels.failed
    ]);
    await commentCheckpoint(deps.issueWorkflow, {
      state: "pr_created",
      issueNumber: issue.number,
      labels: issue.labels,
      branch,
      worktree,
      prUrl: pr.url,
      updatedAt: deps.now().toISOString()
    });

    return {
      ok: true,
      mode: "executed",
      repository: config.repository,
      issue: summarizeIssue(issue),
      analysis,
      branch,
      worktree,
      status: "pr_created",
      pr
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failIssue(deps.issueWorkflow, config, {
      state: "ai_output_failed",
      issueNumber: issue.number,
      labels: issue.labels,
      branch,
      worktree,
      lastFailureReason: message,
      updatedAt: startedAt
    });
    return {
      ok: true,
      mode: "executed",
      repository: config.repository,
      issue: summarizeIssue(issue),
      analysis,
      branch,
      worktree,
      status: "blocked",
      reasons: [message]
    };
  }
}

function resolveDependencies(
  config: RunnerConfig,
  dependencies: RunOnceDependencies
): Required<RunOnceDependencies> {
  return {
    issueWorkflow:
      dependencies.issueWorkflow ??
      createIssueWorkflow(
        createGitHubClient({
          token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "",
          repository: config.repository
        }),
        config
      ),
    analyzeRepository: dependencies.analyzeRepository ?? analyzeRepository,
    checkoutRepository: dependencies.checkoutRepository ?? checkoutRepository,
    createWorktree: dependencies.createWorktree ?? createWorktree,
    runAgentCli: dependencies.runAgentCli ?? runAgentCli,
    parseAiPatchOutput: dependencies.parseAiPatchOutput ?? parseAiPatchOutput,
    inspectPatch: dependencies.inspectPatch ?? inspectPatch,
    applyPatch: dependencies.applyPatch ?? applyPatch,
    runValidation: dependencies.runValidation ?? runValidation,
    commitAndPushChanges: dependencies.commitAndPushChanges ?? commitAndPushChanges,
    now: dependencies.now ?? (() => new Date())
  };
}

async function createPullRequest(
  workflow: IssueWorkflow,
  issue: GitHubIssue,
  summary: string,
  publish: PublishResult
): Promise<{ number: number; url: string }> {
  return workflow.createPullRequest({
    title: `Fix #${issue.number}: ${issue.title}`,
    head: publish.branch,
    base: publish.baseBranch,
    body: [
      `Closes #${issue.number}.`,
      "",
      "Summary:",
      summary,
      "",
      `Commit: ${publish.commitSha}`
    ].join("\n")
  });
}

async function failIssue(
  workflow: IssueWorkflow,
  config: RunnerConfig,
  checkpoint: Checkpoint
): Promise<void> {
  if (!checkpoint.issueNumber) return;
  await workflow.addLabels(checkpoint.issueNumber, [config.labels.failed]);
  await workflow.removeLabels(checkpoint.issueNumber, [config.labels.running]);
  await commentCheckpoint(workflow, checkpoint);
}

function summarizeIssue(issue: GitHubIssue): Pick<GitHubIssue, "number" | "title" | "htmlUrl"> {
  return { number: issue.number, title: issue.title, htmlUrl: issue.htmlUrl };
}

function githubRemoteUrl(repository: string): string {
  return `https://github.com/${repository}.git`;
}

function buildHumanApprovalComment(summary: string, riskNotes: string[]): string {
  return [
    "AI output requires human approval before applying the patch.",
    "",
    `Summary: ${summary}`,
    "",
    "Risk notes:",
    ...(riskNotes.length > 0 ? riskNotes.map((note) => `- ${note}`) : ["- none"])
  ].join("\n");
}

function summarizeValidation(validation: ValidationResult): string {
  const failed = validation.results.find((result) => result.exitCode !== 0);
  if (!failed) return "validation failed";
  return `${failed.command} failed with exit code ${failed.exitCode}`;
}
