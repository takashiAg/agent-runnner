import type { TaskPlanningPromptInput } from "../../../core/port/split-tasks.js";

export function buildTaskPlanningContext(input: TaskPlanningPromptInput): string {
  return JSON.stringify(
    {
      kind: "task-planning-context",
      issue: input.issue,
      repositoryAnalysis: input.analysis,
      taskPlanning: input.taskPlanning
    },
    null,
    2
  );
}
