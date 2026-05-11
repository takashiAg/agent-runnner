export type PublishResult = {
  branch: string;
  baseBranch: string;
  commitSha: string;
};

export type CommitAndPushChanges = (options: {
  cwd: string;
  branch: string;
  baseBranch?: string;
  message: string;
}) => Promise<PublishResult>;
