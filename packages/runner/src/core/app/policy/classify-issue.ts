import { AiLevel, IssueAction, IssueType, Risk } from "../../domain/enum/issue-classification.js";

export type IssueClassificationConfig = {
  labels: {
    blocked: string;
    prCreated: string;
    splitTasks: string;
    plan: string;
    trigger: string;
    story: string;
    bug: string;
    task: string;
  };
};

export type IssueClassification = {
  issueType: IssueType;
  level: AiLevel;
  risk: Risk;
  action: IssueAction;
  reasons: string[];
};

export function classifyIssue(
  labels: string[],
  config: IssueClassificationConfig
): IssueClassification {
  const labelSet = new Set(labels);
  const issueType = getIssueType(labelSet, config);
  const level = getLevel(labelSet);
  const risk = getRisk(labelSet);
  const reasons: string[] = [];

  if (labelSet.has(config.labels.blocked) || labelSet.has(config.labels.prCreated)) {
    return { issueType, level, risk, action: IssueAction.Ignore, reasons: ["issue is terminal"] };
  }
  if (risk === Risk.Dangerous) {
    return { issueType, level, risk, action: IssueAction.Block, reasons: ["risk is dangerous"] };
  }
  if (labelSet.has(config.labels.splitTasks)) {
    return { issueType, level, risk, action: IssueAction.SplitTasks, reasons };
  }
  if (labelSet.has(config.labels.plan) || level === AiLevel.Level0) {
    return { issueType, level, risk, action: IssueAction.Plan, reasons };
  }
  if (!labelSet.has(config.labels.trigger)) {
    return {
      issueType,
      level,
      risk,
      action: IssueAction.Ignore,
      reasons: ["missing trigger label"]
    };
  }
  if (risk === Risk.High || labelSet.has("needs:human-approval") || level === AiLevel.Level1) {
    return { issueType, level, risk, action: IssueAction.PatchOnly, reasons };
  }
  if (level === AiLevel.Level2) {
    return { issueType, level, risk, action: IssueAction.ApplyAndPr, reasons };
  }
  reasons.push("level does not allow implementation");
  return { issueType, level, risk, action: IssueAction.PatchOnly, reasons };
}

function getIssueType(labels: Set<string>, config: IssueClassificationConfig): IssueType {
  if (labels.has(config.labels.story)) return IssueType.Story;
  if (labels.has(config.labels.bug)) return IssueType.Bug;
  if (labels.has(config.labels.task)) return IssueType.Task;
  return IssueType.Unknown;
}

function getLevel(labels: Set<string>): AiLevel {
  if (labels.has("ai:level-0")) return AiLevel.Level0;
  if (labels.has("ai:level-1")) return AiLevel.Level1;
  if (labels.has("ai:level-2")) return AiLevel.Level2;
  if (labels.has("ai:level-3")) return AiLevel.Level3;
  return AiLevel.Level1;
}

function getRisk(labels: Set<string>): Risk {
  if (labels.has("risk:low")) return Risk.Low;
  if (labels.has("risk:medium")) return Risk.Medium;
  if (labels.has("risk:high")) return Risk.High;
  if (labels.has("risk:dangerous")) return Risk.Dangerous;
  return Risk.Unknown;
}
