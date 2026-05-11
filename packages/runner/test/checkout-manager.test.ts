import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import { checkoutRepository } from "../src/gateway/outbound/worktree/checkout-manager.js";
import type { RunnerSettings } from "../src/core/app/settings/runner-settings.js";
import { loadExampleConfig } from "./helpers.js";

async function createTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "checkout-manager-"));
}

function withCheckout(
  config: RunnerSettings,
  checkout: Partial<RunnerSettings["checkout"]>
): RunnerSettings {
  return {
    ...config,
    checkout: {
      ...config.checkout,
      ...checkout
    }
  };
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execa("git", args, { cwd, reject: false });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

async function createSourceRepository(root: string): Promise<string> {
  const source = path.join(root, "source");
  await git(root, ["init", source]);
  await writeFile(path.join(source, "README.md"), "hello\n");
  await git(source, ["add", "README.md"]);
  await git(source, [
    "-c",
    "user.name=test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "init"
  ]);
  return source;
}

function cacheDirectoryName(remoteUrl: string): string {
  return `${remoteUrl.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")}.git`;
}

describe("checkoutRepository", () => {
  it("clones through a bare cache for bare-cache strategy", async () => {
    const root = await createTempDir();
    const source = await createSourceRepository(root);
    const config = withCheckout(await loadExampleConfig(), {
      strategy: "bare-cache",
      cacheRoot: "cache",
      cloneRoot: "clones"
    });

    const result = await checkoutRepository(config, {
      remoteUrl: source,
      runId: "run-1",
      cwd: root
    });

    expect(result.strategy).toBe("bare-cache");
    expect(result.repositoryPath).toBe(path.join(root, "clones", "run-1"));
    expect(await git(result.repositoryPath, ["rev-parse", "--is-inside-work-tree"])).toBe("true");
    expect(
      await git(path.join(root, "cache", cacheDirectoryName(source)), [
        "rev-parse",
        "--is-bare-repository"
      ])
    ).toBe("true");
  });

  it("uses a clean local repository for existing-local strategy", async () => {
    const root = await createTempDir();
    const source = await createSourceRepository(root);
    const local = path.join(root, "local");
    await git(root, ["clone", source, local]);
    const config = withCheckout(await loadExampleConfig(), {
      strategy: "existing-local"
    });

    const result = await checkoutRepository(config, {
      remoteUrl: source,
      runId: "ignored",
      cwd: local
    });

    expect(result).toEqual({ repositoryPath: local, strategy: "existing-local" });
  });

  it("rejects dirty local repositories for existing-local strategy", async () => {
    const root = await createTempDir();
    const source = await createSourceRepository(root);
    const local = path.join(root, "local");
    await git(root, ["clone", source, local]);
    await writeFile(path.join(local, "dirty.txt"), "dirty\n");
    const config = withCheckout(await loadExampleConfig(), {
      strategy: "existing-local"
    });

    await expect(
      checkoutRepository(config, {
        remoteUrl: source,
        runId: "ignored",
        cwd: local
      })
    ).rejects.toThrow("clean worktree");
  });
});
