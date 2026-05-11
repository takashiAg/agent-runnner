import path from "node:path";
import { mkdir } from "node:fs/promises";
import { execa } from "execa";
import type { RunnerSettings } from "../../../core/app/settings/runner-settings.js";

export type CheckoutResult = {
  repositoryPath: string;
  strategy: RunnerSettings["checkout"]["strategy"];
};

export async function checkoutRepository(
  config: RunnerSettings,
  options: { remoteUrl: string; runId: string; cwd: string }
): Promise<CheckoutResult> {
  if (config.checkout.strategy === "existing-local") {
    await assertExistingLocalRepository(options.cwd, options.remoteUrl);
    return { repositoryPath: options.cwd, strategy: config.checkout.strategy };
  }

  const repositoryPath = path.join(options.cwd, config.checkout.cloneRoot, options.runId);
  if (config.checkout.strategy === "fresh-clone") {
    await cloneRepository(config, options.remoteUrl, repositoryPath, options.cwd);
    return { repositoryPath, strategy: config.checkout.strategy };
  }

  const cachePath = path.join(
    options.cwd,
    config.checkout.cacheRoot,
    cacheDirectoryName(options.remoteUrl)
  );
  await updateBareCache(config, options.remoteUrl, cachePath, options.cwd);
  await cloneRepository(config, cachePath, repositoryPath, options.cwd);

  return { repositoryPath, strategy: config.checkout.strategy };
}

async function cloneRepository(
  config: RunnerSettings,
  remoteUrl: string,
  repositoryPath: string,
  cwd: string
): Promise<void> {
  const args = ["clone"];
  if (config.checkout.shallowClone) {
    args.push("--depth", String(config.checkout.fetchDepth || 1));
  }
  args.push(remoteUrl, repositoryPath);
  const result = await execa("git", args, { cwd, reject: false });
  if (result.exitCode !== 0) {
    throw new Error(`git clone failed: ${result.stderr}`);
  }
}

async function updateBareCache(
  config: RunnerSettings,
  remoteUrl: string,
  cachePath: string,
  cwd: string
): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true });
  const isExistingCache = await isGitRepository(cachePath, true);
  if (!isExistingCache) {
    const args = ["clone", "--bare"];
    if (config.checkout.shallowClone) {
      args.push("--depth", String(config.checkout.fetchDepth || 1));
    }
    args.push(remoteUrl, cachePath);
    const result = await execa("git", args, { cwd, reject: false });
    if (result.exitCode !== 0) {
      throw new Error(`git clone --bare failed: ${result.stderr}`);
    }
    return;
  }

  const remoteResult = await execa("git", ["remote", "get-url", "origin"], {
    cwd: cachePath,
    reject: false
  });
  if (remoteResult.exitCode !== 0 || !sameRemote(remoteResult.stdout.trim(), remoteUrl)) {
    throw new Error("bare cache remote does not match requested remote");
  }

  const fetchArgs = ["fetch", "--prune", "origin"];
  if (config.checkout.shallowClone) {
    fetchArgs.push("--depth", String(config.checkout.fetchDepth || 1));
  }
  const fetchResult = await execa("git", fetchArgs, { cwd: cachePath, reject: false });
  if (fetchResult.exitCode !== 0) {
    throw new Error(`git fetch failed: ${fetchResult.stderr}`);
  }
}

async function assertExistingLocalRepository(
  repositoryPath: string,
  remoteUrl: string
): Promise<void> {
  if (!(await isGitRepository(repositoryPath, false))) {
    throw new Error("existing-local checkout requires a git repository");
  }

  const status = await execa("git", ["status", "--porcelain"], {
    cwd: repositoryPath,
    reject: false
  });
  if (status.exitCode !== 0) {
    throw new Error(`git status failed: ${status.stderr}`);
  }
  if (status.stdout.trim()) {
    throw new Error("existing-local checkout requires a clean worktree");
  }

  const remote = await execa("git", ["remote", "get-url", "origin"], {
    cwd: repositoryPath,
    reject: false
  });
  if (remote.exitCode !== 0) {
    throw new Error("existing-local checkout requires an origin remote");
  }
  if (!sameRemote(remote.stdout.trim(), remoteUrl)) {
    throw new Error("existing-local origin remote does not match requested remote");
  }
}

async function isGitRepository(repositoryPath: string, bare: boolean): Promise<boolean> {
  const args = bare
    ? ["rev-parse", "--is-bare-repository"]
    : ["rev-parse", "--is-inside-work-tree"];
  try {
    const result = await execa("git", args, { cwd: repositoryPath, reject: false });
    return result.exitCode === 0 && result.stdout.trim() === "true";
  } catch {
    return false;
  }
}

function cacheDirectoryName(remoteUrl: string): string {
  return `${remoteUrl.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")}.git`;
}

function sameRemote(actual: string, expected: string): boolean {
  return normalizeRemote(actual) === normalizeRemote(expected);
}

function normalizeRemote(remoteUrl: string): string {
  return remoteUrl.replace(/\.git$/, "").replace(/\/$/, "");
}
