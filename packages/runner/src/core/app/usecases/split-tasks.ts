import type { TaskPlanningOutput } from "../contract/ai-output.js";
import type { RunnerSettings } from "../settings/runner-settings.js";
import type { Issue } from "../../domain/entity/issue.js";
import type { RepositoryAnalysis } from "../../domain/value-object/repository-analysis.js";
import type {
  BuildTaskPlanningPrompt,
  CreateTaskIssues,
  CreatedTaskIssue,
  PublishTaskPlan,
  PublishedTaskPlan,
  RequestTaskPlanning
} from "../../port/split-tasks.js";
import { parseTaskPlanningOutput } from "./task-planner.js";

export type SplitTasksInput = {
  issue: Pick<Issue, "number" | "title" | "body" | "labels">;
  analysis: RepositoryAnalysis;
  cwd?: string;
};

export type SplitTasksResult =
  | {
      ok: true;
      status: "issues_created";
      plan: TaskPlanningOutput;
      createdIssues: CreatedTaskIssue[];
    }
  | {
      ok: true;
      status: "plan_published";
      plan: TaskPlanningOutput;
      publishedPlan: PublishedTaskPlan;
    };

export type SplitTasksDependencies = {
  buildTaskPlanningPrompt: BuildTaskPlanningPrompt;
  requestTaskPlanning: RequestTaskPlanning;
  parseTaskPlanningOutput?: (raw: string) => TaskPlanningOutput;
  createTaskIssues: CreateTaskIssues;
  publishTaskPlan: PublishTaskPlan;
};

export async function splitTasks(
  config: RunnerSettings,
  input: SplitTasksInput,
  dependencies: SplitTasksDependencies
): Promise<SplitTasksResult> {
  const prompt = dependencies.buildTaskPlanningPrompt({
    issue: input.issue,
    analysis: input.analysis,
    taskPlanning: config.taskPlanning
  });
  const agentResult = await dependencies.requestTaskPlanning(prompt, config, { cwd: input.cwd });
  const parse = dependencies.parseTaskPlanningOutput ?? parseTaskPlanningOutput;
  const plan = parse(agentResult.stdout);

  if (config.taskPlanning.autoCreateIssues) {
    const createdIssues = await dependencies.createTaskIssues({
      parentIssueNumber: input.issue.number,
      plan
    });
    return {
      ok: true,
      status: "issues_created",
      plan,
      createdIssues
    };
  }

  const publishedPlan = await dependencies.publishTaskPlan({
    parentIssueNumber: input.issue.number,
    plan
  });
  return {
    ok: true,
    status: "plan_published",
    plan,
    publishedPlan
  };
}
