import { describe, expect, it } from "vitest";
import { reviewOutputSchema } from "../src/core/app/contract/review-output.js";

describe("reviewOutputSchema", () => {
  it("parses multi-role review output", () => {
    const result = reviewOutputSchema.parse({
      summary: "ok",
      role_reviews: [{ role: "engineer", summary: "looks fine", findings: [] }]
    });
    expect(result.overall_decision).toBe("comment");
  });
});
