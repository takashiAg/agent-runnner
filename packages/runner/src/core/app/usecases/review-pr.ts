import type { ReviewOutput } from "../contract/review-output.js";
import { parseReviewOutput } from "./multi-role-reviewer.js";
import type { RunnerSettings } from "../settings/runner-settings.js";
import type { RunAgentCli } from "../../port/agent.js";
import type {
  BuildPullRequestReviewPrompt,
  PullRequestReviewPromptInput,
  PullRequestReviewTarget,
  PullRequestReviewWorkflow,
  ReviewRole
} from "../../port/review-pr.js";

export type ReviewPrDependencies = {
  reviewWorkflow: PullRequestReviewWorkflow;
  runAgentCli: RunAgentCli;
  buildReviewPrompt: BuildPullRequestReviewPrompt;
};

export type ReviewPrResult = {
  ok: true;
  repository: string;
  pr: Pick<PullRequestReviewTarget, "number" | "title" | "htmlUrl">;
  roles: ReviewRole[];
  status: "dry_run" | "review_commented" | "invalid_output";
  promptInput?: PullRequestReviewPromptInput;
  review?: ReviewOutput;
  reasons?: string[];
};

export async function reviewPr(
  config: RunnerSettings,
  options: { prNumber: number; dryRun?: boolean },
  dependencies: ReviewPrDependencies
): Promise<ReviewPrResult> {
  const pr = await dependencies.reviewWorkflow.getPullRequest(options.prNumber);
  const roles = [...config.review.roles];
  const promptInput: PullRequestReviewPromptInput = {
    ...pr,
    roles
  };

  if (options.dryRun) {
    return {
      ok: true,
      repository: config.repository,
      pr: summarizePullRequest(pr),
      roles,
      status: "dry_run",
      promptInput
    };
  }

  const prompt = dependencies.buildReviewPrompt(promptInput);
  const agentResult = await dependencies.runAgentCli(prompt, config);
  const review = parseReviewOutput(agentResult.stdout);
  const roleValidation = validateConfiguredRoles(review, roles);

  if (roleValidation.length > 0) {
    return {
      ok: true,
      repository: config.repository,
      pr: summarizePullRequest(pr),
      roles,
      status: "invalid_output",
      review,
      reasons: roleValidation
    };
  }

  await dependencies.reviewWorkflow.postReviewComment(pr.number, formatReviewComment(review));

  return {
    ok: true,
    repository: config.repository,
    pr: summarizePullRequest(pr),
    roles,
    status: "review_commented",
    review
  };
}

function validateConfiguredRoles(review: ReviewOutput, configuredRoles: ReviewRole[]): string[] {
  const configured = new Set(configuredRoles);
  const reviewed = new Set(review.role_reviews.map((roleReview) => roleReview.role));
  const unexpected = [...reviewed].filter((role) => !configured.has(role));
  const missing = configuredRoles.filter((role) => !reviewed.has(role));
  const reasons: string[] = [];

  if (unexpected.length > 0) {
    reasons.push(`unexpected review roles: ${unexpected.join(", ")}`);
  }
  if (missing.length > 0) {
    reasons.push(`missing configured review roles: ${missing.join(", ")}`);
  }

  return reasons;
}

function formatReviewComment(review: ReviewOutput): string {
  const lines = [
    "## AI PR Review",
    "",
    `Decision: \`${review.overall_decision}\``,
    "",
    review.summary,
    ""
  ];

  for (const roleReview of review.role_reviews) {
    lines.push(`### ${roleReview.role}`, "", roleReview.summary, "");
    for (const finding of roleReview.findings) {
      const location = finding.file
        ? ` (${finding.file}${finding.line ? `:${finding.line}` : ""})`
        : "";
      lines.push(`- **${finding.severity}** ${finding.title}${location}: ${finding.body}`);
      if (finding.suggestion) {
        lines.push(`  Suggestion: ${finding.suggestion}`);
      }
    }
    if (roleReview.findings.length === 0) {
      lines.push("- No findings.");
    }
    lines.push("");
  }

  if (review.findings.length > 0) {
    lines.push("### Cross-role Findings", "");
    for (const finding of review.findings) {
      const location = finding.file
        ? ` (${finding.file}${finding.line ? `:${finding.line}` : ""})`
        : "";
      lines.push(`- **${finding.severity}** ${finding.title}${location}: ${finding.body}`);
    }
    lines.push("");
  }

  if (review.test_gaps.length > 0) {
    lines.push("### Test Gaps", "", ...review.test_gaps.map((gap) => `- ${gap}`), "");
  }

  if (review.approval_notes.length > 0) {
    lines.push(
      "### Approval Notes",
      "",
      ...review.approval_notes.map((note) => `- ${note}`),
      ""
    );
  }

  return lines.join("\n").trimEnd();
}

function summarizePullRequest(
  pr: PullRequestReviewTarget
): Pick<PullRequestReviewTarget, "number" | "title" | "htmlUrl"> {
  return {
    number: pr.number,
    title: pr.title,
    htmlUrl: pr.htmlUrl
  };
}
