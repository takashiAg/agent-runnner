import path from "node:path";
import { execa } from "execa";
import type { RunnerConfig } from "../config/schema.js";

export type CheckoutResult = {
  repositoryPath: string;
  strategy: RunnerConfig["checkout"]["strategy"];
};

export async function checkoutRepository(
  config: RunnerConfig,
  options: { remoteUrl: string; runId: string; cwd: string }
): Promise<CheckoutResult> {
  if (config.checkout.strategy !== "fresh-clone") {
    throw new Error(`Checkout strategy is not implemented yet: ${config.checkout.strategy}`);
  }

  const repositoryPath = path.join(options.cwd, config.checkout.cloneRoot, options.runId);
  const args = ["clone"];
  if (config.checkout.shallowClone) {
    args.push("--depth", String(config.checkout.fetchDepth || 1));
  }
  args.push(options.remoteUrl, repositoryPath);
  const result = await execa("git", args, { cwd: options.cwd, reject: false });
  if (result.exitCode !== 0) {
    throw new Error(`git clone failed: ${result.stderr}`);
  }
  return { repositoryPath, strategy: config.checkout.strategy };
}

