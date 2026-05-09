import { reviewOutputSchema, type ReviewOutput } from "./review-output-schema.js";

export function parseReviewOutput(raw: string): ReviewOutput {
  return reviewOutputSchema.parse(JSON.parse(raw));
}

