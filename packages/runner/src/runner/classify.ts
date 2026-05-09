import type { RunnerConfig } from "../config/schema.js";

export type IssueType = "story" | "bug" | "task" | "unknown";
export type AiLevel = "level-0" | "level-1" | "level-2" | "level-3";
export type Risk = "low" | "medium" | "high" | "dangerous" | "unknown";

export type IssueClassification = {
  issueType: IssueType;
  level: AiLevel;
  risk: Risk;
  action:
    | "plan"
    | "split-tasks"
    | "patch-only"
    | "apply-and-pr"
    | "block"
    | "ignore";
  reasons: string[];
};

export function classifyIssue(labels: string[], config: RunnerConfig): IssueClassification {
  const labelSet = new Set(labels);
  const issueType = getIssueType(labelSet, config);
  const level = getLevel(labelSet);
  const risk = getRisk(labelSet);
  const reasons: string[] = [];

  if (labelSet.has(config.labels.blocked) || labelSet.has(config.labels.prCreated)) {
    return { issueType, level, risk, action: "ignore", reasons: ["issue is terminal"] };
  }
  if (risk === "dangerous") {
    return { issueType, level, risk, action: "block", reasons: ["risk is dangerous"] };
  }
  if (labelSet.has(config.labels.splitTasks)) {
    return { issueType, level, risk, action: "split-tasks", reasons };
  }
  if (labelSet.has(config.labels.plan) || level === "level-0") {
    return { issueType, level, risk, action: "plan", reasons };
  }
  if (!labelSet.has(config.labels.trigger)) {
    return { issueType, level, risk, action: "ignore", reasons: ["missing trigger label"] };
  }
  if (risk === "high" || labelSet.has("needs:human-approval") || level === "level-1") {
    return { issueType, level, risk, action: "patch-only", reasons };
  }
  if (level === "level-2") {
    return { issueType, level, risk, action: "apply-and-pr", reasons };
  }
  reasons.push("level does not allow implementation");
  return { issueType, level, risk, action: "patch-only", reasons };
}

function getIssueType(labels: Set<string>, config: RunnerConfig): IssueType {
  if (labels.has(config.labels.story)) return "story";
  if (labels.has(config.labels.bug)) return "bug";
  if (labels.has(config.labels.task)) return "task";
  return "unknown";
}

function getLevel(labels: Set<string>): AiLevel {
  if (labels.has("ai:level-0")) return "level-0";
  if (labels.has("ai:level-1")) return "level-1";
  if (labels.has("ai:level-2")) return "level-2";
  if (labels.has("ai:level-3")) return "level-3";
  return "level-1";
}

function getRisk(labels: Set<string>): Risk {
  if (labels.has("risk:low")) return "low";
  if (labels.has("risk:medium")) return "medium";
  if (labels.has("risk:high")) return "high";
  if (labels.has("risk:dangerous")) return "dangerous";
  return "unknown";
}

