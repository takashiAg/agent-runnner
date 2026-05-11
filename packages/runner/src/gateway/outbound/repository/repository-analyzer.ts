import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { Minimatch } from "minimatch";
import type { RepositoryAnalysis } from "../../../core/app/ports/repository.js";
import type { RunnerConfig } from "../../../core/app/config/runner-config.js";

export type Boundary = "backend" | "frontend" | "shared" | "infra" | "docs" | string;

export async function analyzeRepository(
  root: string,
  config: RunnerConfig
): Promise<RepositoryAnalysis> {
  const packageManager = await detectPackageManager(root);
  const workspaces = config.repositoryAnalysis.detectWorkspaces
    ? await detectPnpmWorkspaces(root)
    : [];
  const boundaries = config.repositoryAnalysis.detectBoundaries
    ? await detectBoundaries(root, config)
    : {};
  const splitHints = buildSplitHints(boundaries);

  return { packageManager, workspaces, boundaries, splitHints };
}

async function detectPackageManager(root: string): Promise<RepositoryAnalysis["packageManager"]> {
  const files = await safeReadDir(root);
  if (files.includes("pnpm-lock.yaml") || files.includes("pnpm-workspace.yaml")) return "pnpm";
  if (files.includes("package-lock.json")) return "npm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("bun.lockb") || files.includes("bun.lock")) return "bun";
  return "unknown";
}

async function detectPnpmWorkspaces(root: string): Promise<string[]> {
  const workspacePath = path.join(root, "pnpm-workspace.yaml");
  try {
    const raw = await readFile(workspacePath, "utf8");
    const parsed = YAML.parse(raw) as { packages?: string[] } | null;
    return parsed?.packages ?? [];
  } catch {
    return [];
  }
}

async function detectBoundaries(
  root: string,
  config: RunnerConfig
): Promise<Record<string, string[]>> {
  const files = await listFiles(root, config.repositoryAnalysis.includeFileTreeDepth);
  const result: Record<string, string[]> = {};

  for (const [boundary, patterns] of Object.entries(config.repositoryAnalysis.boundaryHints)) {
    const matchers = patterns.map((pattern) => new Minimatch(pattern, { dot: true }));
    const matched = files.filter((file) => matchers.some((matcher) => matcher.match(file)));
    if (matched.length > 0) {
      result[boundary] = matched.slice(0, config.repositoryAnalysis.maxContextFiles);
    }
  }
  return result;
}

function buildSplitHints(boundaries: Record<string, string[]>): string[] {
  const active = Object.entries(boundaries)
    .filter(([, files]) => files.length > 0)
    .map(([name]) => name);
  if (active.includes("backend") && active.includes("frontend")) {
    return ["backend and frontend changes should be split when possible"];
  }
  return [];
}

async function listFiles(root: string, maxDepth: number): Promise<string[]> {
  const output: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    const entries = await safeReadDir(dir);
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
      const fullPath = path.join(dir, entry);
      const relativePath = path.relative(root, fullPath).replaceAll(path.sep, "/");
      const info = await stat(fullPath).catch(() => null);
      if (!info) continue;
      if (info.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else if (info.isFile()) {
        output.push(relativePath);
      }
    }
  }

  await walk(root, 1);
  return output.sort();
}

async function safeReadDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
