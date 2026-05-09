import { z } from "zod";

const severitySchema = z.enum(["low", "medium", "high", "critical"]);
const roleSchema = z.enum(["pdm", "pjm", "tech-lead", "engineer"]);

const findingSchema = z.object({
  severity: severitySchema,
  file: z.string().nullable().default(null),
  line: z.number().int().positive().nullable().default(null),
  title: z.string().min(1),
  body: z.string().min(1),
  suggestion: z.string().nullable().default(null)
});

export const reviewOutputSchema = z.object({
  summary: z.string().min(1),
  role_reviews: z.array(
    z.object({
      role: roleSchema,
      summary: z.string().min(1),
      findings: z.array(findingSchema).default([])
    })
  ),
  findings: z.array(findingSchema).default([]),
  test_gaps: z.array(z.string()).default([]),
  approval_notes: z.array(z.string()).default([]),
  overall_decision: z.enum(["approve", "comment", "request_changes"]).default("comment")
});

export type ReviewOutput = z.infer<typeof reviewOutputSchema>;

