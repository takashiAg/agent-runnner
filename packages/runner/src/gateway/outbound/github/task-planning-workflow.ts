import type { Octokit } from "@octokit/rest";
import type { TaskPlanningOutput } from "../../../core/app/contract/ai-output.js";
import type {
  CreateTaskIssues,
  PublishTaskPlan,
  CreatedTaskIssue
} from "../../../core/port/split-tasks.js";
import type { RunnerSettings } from "../../../core/app/settings/runner-settings.js";
import { splitRepository } from "./github-client.js";

export function createTaskPlanningWorkflow(
  client: Octokit,
  config: RunnerSettings
): {
  createTaskIssues: CreateTaskIssues;
  publishTaskPlan: PublishTaskPlan;
} {
  const { owner, repo } = splitRepository(config.repository);

  return {
    async createTaskIssues(input) {
      const created: CreatedTaskIssue[] = [];
      for (const task of input.plan.tasks) {
        const response = await client.rest.issues.create({
          owner,
          repo,
          title: task.title,
          labels: task.labels,
          body: [
            task.body,
            "",
            `Parent issue: #${input.parentIssueNumber}`,
            "",
            "Acceptance criteria:",
            ...task.acceptance_criteria.map((item) => `- ${item}`),
            "",
            `Review scope: ${task.review_scope}`,
            "",
            "Estimated files:",
            ...(task.estimated_files.length > 0
              ? task.estimated_files.map((file) => `- \`${file}\``)
              : ["- not specified"]),
            "",
            "Risk notes:",
            ...(task.risk_notes.length > 0
              ? task.risk_notes.map((note) => `- ${note}`)
              : ["- none"])
          ].join("\n")
        });
        created.push({
          number: response.data.number,
          title: response.data.title,
          url: response.data.html_url
        });
      }
      return created;
    },

    async publishTaskPlan(input) {
      const response = await client.rest.issues.createComment({
        owner,
        repo,
        issue_number: input.parentIssueNumber,
        body: formatTaskPlan(input.plan.summary, input.plan.tasks, input.plan.open_questions)
      });
      return { url: response.data.html_url };
    }
  };
}

function formatTaskPlan(
  summary: string,
  tasks: TaskPlanningOutput["tasks"],
  openQuestions: string[]
): string {
  return [
    "## Task split proposal",
    "",
    summary,
    "",
    ...tasks.flatMap((task, index) => [
      `### ${index + 1}. ${task.title}`,
      "",
      task.body,
      "",
      "Acceptance criteria:",
      ...task.acceptance_criteria.map((item) => `- ${item}`),
      "",
      `Review scope: ${task.review_scope}`,
      ""
    ]),
    "## Open questions",
    ...(openQuestions.length > 0 ? openQuestions.map((question) => `- ${question}`) : ["- none"])
  ].join("\n");
}
