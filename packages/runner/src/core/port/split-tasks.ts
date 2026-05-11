import type { TaskPlanningOutput } from "../app/contract/ai-output.js";
import type { RunnerSettings } from "../app/settings/runner-settings.js";
import type { Issue } from "../domain/entity/issue.js";
import type { RepositoryAnalysis } from "../domain/value-object/repository-analysis.js";

export type TaskPlanningPromptInput = {
  issue: Pick<Issue, "number" | "title" | "body" | "labels">;
  analysis: RepositoryAnalysis;
  taskPlanning: RunnerSettings["taskPlanning"];
};

export type BuildTaskPlanningPrompt = (input: TaskPlanningPromptInput) => string;

export type RequestTaskPlanning = (
  prompt: string,
  config: RunnerSettings,
  options?: { cwd?: string }
) => Promise<{ stdout: string; stderr: string }>;

export type CreateTaskIssuesInput = {
  parentIssueNumber: number;
  plan: TaskPlanningOutput;
};

export type CreatedTaskIssue = {
  number: number;
  title: string;
  url: string;
};

export type CreateTaskIssues = (input: CreateTaskIssuesInput) => Promise<CreatedTaskIssue[]>;

export type PublishTaskPlanInput = {
  parentIssueNumber: number;
  plan: TaskPlanningOutput;
};

export type PublishedTaskPlan = {
  url?: string;
};

export type PublishTaskPlan = (input: PublishTaskPlanInput) => Promise<PublishedTaskPlan>;
