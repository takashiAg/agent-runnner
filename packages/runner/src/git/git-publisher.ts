import { execa } from "execa";

export type PublishResult = {
  branch: string;
  baseBranch: string;
  commitSha: string;
};

export async function commitAndPushChanges(options: {
  cwd: string;
  branch: string;
  baseBranch?: string;
  message: string;
}): Promise<PublishResult> {
  const baseBranch = options.baseBranch ?? "main";
  await runGit(options.cwd, ["add", "--all"]);

  const status = await runGit(options.cwd, ["status", "--porcelain"]);
  if (!status.stdout.trim()) {
    throw new Error("no changes to commit");
  }

  await runGit(options.cwd, ["commit", "-m", options.message]);
  const revParse = await runGit(options.cwd, ["rev-parse", "HEAD"]);
  await runGit(options.cwd, ["push", "--set-upstream", "origin", options.branch]);

  return {
    branch: options.branch,
    baseBranch,
    commitSha: revParse.stdout.trim()
  };
}

async function runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  const result = await execa("git", args, { cwd, reject: false });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return { stdout: result.stdout, stderr: result.stderr };
}
