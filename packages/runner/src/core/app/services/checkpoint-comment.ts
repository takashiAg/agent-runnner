import { formatCheckpoint, type Checkpoint } from "../../domain/entity/checkpoint.js";
import type { IssueWorkflow } from "../ports/issue-workflow.js";

export async function commentCheckpoint(
  workflow: IssueWorkflow,
  checkpoint: Checkpoint
): Promise<void> {
  if (!checkpoint.issueNumber) return;
  await workflow.comment(checkpoint.issueNumber, formatCheckpoint(checkpoint));
}
