import { reviewOutputSchema, type ReviewOutput } from "../contract/review-output.js";

export function parseReviewOutput(raw: string): ReviewOutput {
  return reviewOutputSchema.parse(JSON.parse(raw));
}
