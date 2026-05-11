import { describe, expect, it } from "vitest";
import { parseTaskPlanningOutput } from "../src/core/app/usecases/task-planner.js";

describe("parseTaskPlanningOutput", () => {
  it("parses task planning output", () => {
    const result = parseTaskPlanningOutput(
      JSON.stringify({
        summary: "split",
        tasks: [
          {
            title: "Implement API",
            body: "Do it",
            labels: ["type:task"],
            acceptance_criteria: ["works"],
            review_scope: "api"
          }
        ]
      })
    );
    expect(result.tasks).toHaveLength(1);
  });
});
