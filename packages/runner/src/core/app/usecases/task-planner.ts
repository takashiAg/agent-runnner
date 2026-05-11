import { taskPlanningOutputSchema, type TaskPlanningOutput } from "../contract/ai-output.js";

export function parseTaskPlanningOutput(raw: string): TaskPlanningOutput {
  return taskPlanningOutputSchema.parse(JSON.parse(raw));
}
