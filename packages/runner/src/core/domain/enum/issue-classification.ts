export enum IssueType {
  Story = "story",
  Bug = "bug",
  Task = "task",
  Unknown = "unknown"
}

export enum AiLevel {
  Level0 = "level-0",
  Level1 = "level-1",
  Level2 = "level-2",
  Level3 = "level-3"
}

export enum Risk {
  Low = "low",
  Medium = "medium",
  High = "high",
  Dangerous = "dangerous",
  Unknown = "unknown"
}

export enum IssueAction {
  Plan = "plan",
  SplitTasks = "split-tasks",
  PatchOnly = "patch-only",
  ApplyAndPr = "apply-and-pr",
  Block = "block",
  Ignore = "ignore"
}
