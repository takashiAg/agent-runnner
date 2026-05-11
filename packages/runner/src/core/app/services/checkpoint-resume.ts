import {
  checkpointMarker,
  type Checkpoint,
  type CheckpointState
} from "../../domain/entity/checkpoint.js";

export type CheckpointComment = {
  body: string;
  id?: number | string;
  createdAt?: string;
  updatedAt?: string;
};

export type ParsedCheckpointComment = {
  checkpoint: Checkpoint;
  comment: CheckpointComment;
};

export type ResumeAction =
  | "resume-ai"
  | "retry-validation"
  | "resume-conflict"
  | "wait-for-human"
  | "split-tasks"
  | "none";

export type ResumeDecision = {
  canResume: boolean;
  state?: CheckpointState;
  action: ResumeAction;
  reasons: string[];
  checkpoint?: Checkpoint;
};

const checkpointStates = new Set<CheckpointState>([
  "running",
  "ai_output_failed",
  "patch_blocked",
  "validation_failed",
  "needs_human_approval",
  "needs_human_input",
  "needs_split",
  "pr_created"
]);

const checkpointJsonBlockPattern = /```(?:json)?\s*([\s\S]*?)```/i;

export function parseCheckpointComment(body: string): Checkpoint | null {
  const markerIndex = body.lastIndexOf(checkpointMarker);
  if (markerIndex < 0) return null;

  const afterMarker = body.slice(markerIndex + checkpointMarker.length);
  const jsonMatch = checkpointJsonBlockPattern.exec(afterMarker);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1] ?? "");
    return isCheckpoint(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseCheckpointComments(
  comments: CheckpointComment[]
): ParsedCheckpointComment[] {
  return comments.flatMap((comment) => {
    const checkpoint = parseCheckpointComment(comment.body);
    return checkpoint ? [{ checkpoint, comment }] : [];
  });
}

export function findLatestCheckpointComment(
  comments: CheckpointComment[]
): ParsedCheckpointComment | null {
  const parsed = parseCheckpointComments(comments);
  if (parsed.length === 0) return null;

  return parsed.sort((left, right) => checkpointSortTime(right) - checkpointSortTime(left))[0] ?? null;
}

export function decideCheckpointResume(checkpoint: Checkpoint | null): ResumeDecision {
  if (!checkpoint) {
    return {
      canResume: false,
      action: "none",
      reasons: ["checkpoint was not found"]
    };
  }

  switch (checkpoint.state) {
    case "running":
      return {
        canResume: false,
        state: checkpoint.state,
        action: "none",
        reasons: ["checkpoint is already running"],
        checkpoint
      };
    case "ai_output_failed":
      return {
        canResume: true,
        state: checkpoint.state,
        action: "resume-ai",
        reasons: [],
        checkpoint
      };
    case "patch_blocked":
      return {
        canResume: true,
        state: checkpoint.state,
        action: "resume-conflict",
        reasons: [],
        checkpoint
      };
    case "validation_failed":
      return {
        canResume: true,
        state: checkpoint.state,
        action: "retry-validation",
        reasons: [],
        checkpoint
      };
    case "needs_human_approval":
      return {
        canResume: false,
        state: checkpoint.state,
        action: "wait-for-human",
        reasons: ["checkpoint requires human approval"],
        checkpoint
      };
    case "needs_human_input":
      return {
        canResume: false,
        state: checkpoint.state,
        action: "wait-for-human",
        reasons: ["checkpoint requires human input"],
        checkpoint
      };
    case "needs_split":
      return {
        canResume: false,
        state: checkpoint.state,
        action: "split-tasks",
        reasons: ["checkpoint should be split into smaller tasks"],
        checkpoint
      };
    case "pr_created":
      return {
        canResume: false,
        state: checkpoint.state,
        action: "none",
        reasons: ["pull request has already been created"],
        checkpoint
      };
  }
}

function isCheckpoint(value: unknown): value is Checkpoint {
  if (!isRecord(value)) return false;
  if (typeof value.state !== "string" || !checkpointStates.has(value.state as CheckpointState)) {
    return false;
  }
  if (typeof value.updatedAt !== "string") return false;
  if ("issueNumber" in value && typeof value.issueNumber !== "number") return false;
  if ("labels" in value && !isStringArray(value.labels)) return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function checkpointSortTime(parsed: ParsedCheckpointComment): number {
  return Math.max(
    timestamp(parsed.checkpoint.updatedAt),
    timestamp(parsed.comment.updatedAt),
    timestamp(parsed.comment.createdAt)
  );
}

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}
