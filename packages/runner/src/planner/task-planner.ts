import { taskPlanningOutputSchema, type TaskPlanningOutput } from "../ai/output-schema.js";

export function parseTaskPlanningOutput(raw: string): TaskPlanningOutput {
  return taskPlanningOutputSchema.parse(JSON.parse(raw));
}

