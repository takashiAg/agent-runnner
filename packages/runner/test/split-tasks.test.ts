import { describe, expect, it } from "vitest";
import {
  splitTasks,
  type SplitTasksDependencies
} from "../src/core/app/usecases/split-tasks.js";
import { loadExampleConfig } from "./helpers.js";

function createDependencies(
  overrides: Partial<SplitTasksDependencies> = {}
): SplitTasksDependencies {
  return {
    buildTaskPlanningPrompt(input) {
      return JSON.stringify(input);
    },
    async requestTaskPlanning() {
      return {
        stdout: JSON.stringify({
          parent_issue: 123,
          summary: "Split into frontend and runner tasks.",
          tasks: [
            {
              title: "Update runner workflow",
              body: "Implement the runner-side changes.",
              labels: ["type:task"],
              acceptance_criteria: ["runner tests pass"],
              review_scope: "runner",
              estimated_files: ["packages/runner/src/core/app/usecases/split-tasks.ts"],
              risk_notes: []
            }
          ],
          open_questions: []
        }),
        stderr: ""
      };
    },
    async createTaskIssues() {
      return [
        {
          number: 456,
          title: "Update runner workflow",
          url: "https://github.com/owner/name/issues/456"
        }
      ];
    },
    async publishTaskPlan() {
      return { url: "https://github.com/owner/name/issues/123#issuecomment-1" };
    },
    ...overrides
  };
}

const issue = {
  number: 123,
  title: "Split the workflow",
  body: "Please split this issue into concrete implementation tasks.",
  labels: ["ai:split-tasks", "type:story"]
};

const analysis = {
  packageManager: "pnpm" as const,
  workspaces: ["packages/*"],
  boundaries: {
    runner: ["packages/runner/src/**"]
  },
  splitHints: ["separate core usecase work from gateway wiring"]
};

describe("splitTasks", () => {
  it("builds a task planning prompt from issue, repository analysis, and settings", async () => {
    const config = await loadExampleConfig();
    let promptInput: unknown;
    let requestedPrompt = "";

    await splitTasks(
      config,
      { issue, analysis, cwd: "/tmp/repo" },
      createDependencies({
        buildTaskPlanningPrompt(input) {
          promptInput = input;
          return "task-planning-prompt";
        },
        async requestTaskPlanning(prompt, _config, options) {
          requestedPrompt = `${prompt}:${options?.cwd}`;
          return {
            stdout: JSON.stringify({
              summary: "Split task",
              tasks: [
                {
                  title: "Implement split-tasks",
                  body: "Add the core usecase.",
                  labels: ["type:task"],
                  acceptance_criteria: ["tests pass"],
                  review_scope: "runner"
                }
              ],
              open_questions: []
            }),
            stderr: ""
          };
        }
      })
    );

    expect(promptInput).toEqual({
      issue,
      analysis,
      taskPlanning: config.taskPlanning
    });
    expect(requestedPrompt).toBe("task-planning-prompt:/tmp/repo");
  });

  it("creates task issues through a port when autoCreateIssues is enabled", async () => {
    const config = await loadExampleConfig();
    const calls: string[] = [];

    const result = await splitTasks(
      {
        ...config,
        taskPlanning: { ...config.taskPlanning, autoCreateIssues: true }
      },
      { issue, analysis },
      createDependencies({
        async createTaskIssues(input) {
          calls.push(`create:${input.parentIssueNumber}:${input.plan.tasks.length}`);
          return [
            {
              number: 456,
              title: input.plan.tasks[0]?.title ?? "task",
              url: "https://github.com/owner/name/issues/456"
            }
          ];
        },
        async publishTaskPlan() {
          calls.push("publish");
          return {};
        }
      })
    );

    expect(result.status).toBe("issues_created");
    expect(result.createdIssues).toHaveLength(1);
    expect(calls).toEqual(["create:123:1"]);
  });

  it("publishes the plan through a port when autoCreateIssues is disabled", async () => {
    const config = await loadExampleConfig();
    const calls: string[] = [];

    const result = await splitTasks(
      {
        ...config,
        taskPlanning: { ...config.taskPlanning, autoCreateIssues: false }
      },
      { issue, analysis },
      createDependencies({
        async createTaskIssues() {
          calls.push("create");
          return [];
        },
        async publishTaskPlan(input) {
          calls.push(`publish:${input.parentIssueNumber}:${input.plan.summary}`);
          return { url: "https://github.com/owner/name/issues/123#issuecomment-1" };
        }
      })
    );

    expect(result.status).toBe("plan_published");
    expect(result.publishedPlan.url).toContain("#issuecomment-1");
    expect(calls).toEqual(["publish:123:Split into frontend and runner tasks."]);
  });
});
