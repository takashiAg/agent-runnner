export type CheckpointState =
  | "running"
  | "ai_output_failed"
  | "patch_blocked"
  | "validation_failed"
  | "needs_human_approval"
  | "needs_human_input"
  | "needs_split"
  | "pr_created";

export type Checkpoint = {
  state: CheckpointState;
  issueNumber?: number;
  labels?: string[];
  branch?: string;
  worktree?: string;
  prUrl?: string;
  aiLevel?: string;
  risk?: string;
  lastFailureReason?: string;
  validationSummary?: string;
  updatedAt: string;
};

export const checkpointMarker = "<!-- label-triggered-ai-runner-checkpoint:v1 -->";

export function formatCheckpoint(checkpoint: Checkpoint): string {
  return [checkpointMarker, "", "```json", JSON.stringify(checkpoint, null, 2), "```"].join("\n");
}
