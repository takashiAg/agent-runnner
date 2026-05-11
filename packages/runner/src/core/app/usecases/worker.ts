import { routeCommentCommand } from "../routing/command-router.js";
import type { RunnerSettings } from "../settings/runner-settings.js";

export type WorkerEvent =
  | { kind: "issue-labeled"; issueNumber: number; labels: string[] }
  | { kind: "issue-comment"; issueNumber: number; body: string }
  | { kind: "pull-request-opened"; prNumber: number }
  | { kind: "pull-request-updated"; prNumber: number };

export type WorkerAction =
  | { kind: "run-once"; issueNumber?: number }
  | { kind: "split-tasks"; issueNumber: number }
  | { kind: "resolve-conflict"; issueNumber: number }
  | { kind: "review-pr"; prNumber: number }
  | { kind: "ignore"; reason: string };

export function routeWorkerEvent(config: RunnerSettings, event: WorkerEvent): WorkerAction {
  switch (event.kind) {
    case "issue-labeled":
      if (event.labels.includes(config.labels.trigger)) {
        return { kind: "run-once", issueNumber: event.issueNumber };
      }
      if (event.labels.includes(config.labels.splitTasks)) {
        return { kind: "split-tasks", issueNumber: event.issueNumber };
      }
      return { kind: "ignore", reason: "issue labels do not trigger runner" };
    case "issue-comment": {
      const command = routeCommentCommand(event.body, config);
      if (!command) return { kind: "ignore", reason: "comment does not contain a runner command" };
      if (command.kind === "review") return { kind: "review-pr", prNumber: event.issueNumber };
      if (command.kind === "split-tasks")
        return { kind: "split-tasks", issueNumber: event.issueNumber };
      return { kind: "resolve-conflict", issueNumber: event.issueNumber };
    }
    case "pull-request-opened":
      return config.review.autoReviewOnPrOpen
        ? { kind: "review-pr", prNumber: event.prNumber }
        : { kind: "ignore", reason: "auto review on PR open is disabled" };
    case "pull-request-updated":
      return config.review.autoReviewOnPrUpdate
        ? { kind: "review-pr", prNumber: event.prNumber }
        : { kind: "ignore", reason: "auto review on PR update is disabled" };
  }
}
