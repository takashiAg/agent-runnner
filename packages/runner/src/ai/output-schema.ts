import { z } from "zod";

const relativePathSchema = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith("/"), "absolute paths are not allowed")
  .refine((path) => !path.split(/[\\/]/).includes(".."), "path traversal is not allowed");

export const aiPatchOutputSchema = z.object({
  summary: z.string().min(1),
  risk_notes: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  changed_files: z.array(relativePathSchema),
  patch: z.string(),
  tests_to_run: z.array(z.string()).default([]),
  requires_human_approval: z.boolean(),
  block_reason: z.string().nullable()
});

export type AiPatchOutput = z.infer<typeof aiPatchOutputSchema>;

export const taskPlanningOutputSchema = z.object({
  parent_issue: z.number().int().positive().optional(),
  summary: z.string().min(1),
  tasks: z.array(
    z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      labels: z.array(z.string()),
      acceptance_criteria: z.array(z.string()),
      review_scope: z.string(),
      estimated_files: z.array(relativePathSchema).default([]),
      risk_notes: z.array(z.string()).default([])
    })
  ),
  open_questions: z.array(z.string()).default([])
});

export type TaskPlanningOutput = z.infer<typeof taskPlanningOutputSchema>;

