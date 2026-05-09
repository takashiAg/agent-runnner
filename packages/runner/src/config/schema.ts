import { z } from "zod";

const labelsSchema = z.object({
  trigger: z.string(),
  plan: z.string(),
  splitTasks: z.string(),
  running: z.string(),
  failed: z.string(),
  blocked: z.string(),
  prCreated: z.string(),
  needsSplit: z.string(),
  needsHumanInput: z.string(),
  story: z.string(),
  bug: z.string(),
  task: z.string()
});

const providerSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([])
});

export const runnerConfigSchema = z.object({
  repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/, "repository must be owner/name"),
  labels: labelsSchema,
  branch: z.object({
    prefix: z.string().min(1)
  }),
  checkout: z.object({
    strategy: z.enum(["fresh-clone", "bare-cache", "existing-local"]),
    cacheRoot: z.string(),
    cloneRoot: z.string(),
    bareRepositoryCache: z.boolean(),
    shallowClone: z.boolean(),
    fetchDepth: z.number().int().min(0)
  }),
  worktree: z.object({
    root: z.string()
  }),
  ai: z.object({
    provider: z.string().min(1),
    mode: z.enum(["patch-only"]),
    allowTools: z.literal(false),
    allowCommands: z.literal(false),
    output: z.literal("json"),
    timeoutSeconds: z.number().int().positive(),
    providers: z.record(z.string(), providerSchema)
  }),
  concurrency: z.object({
    global: z.number().int().positive(),
    perRepository: z.number().int().positive()
  }),
  patch: z.object({
    maxFiles: z.number().int().positive(),
    maxLines: z.number().int().positive(),
    denylist: z.array(z.string())
  }),
  conflict: z.object({
    autoResolve: z.boolean(),
    askWhenUnclear: z.boolean(),
    maxConflictFilesForAutoResolve: z.number().int().min(0),
    allowedAutoResolveKinds: z.array(
      z.enum(["context-shift", "formatting-only", "import-order"])
    ),
    blockedPaths: z.array(z.string())
  }),
  validation: z.object({
    commands: z.array(z.string()).min(1)
  }),
  commentCommands: z.object({
    allowlist: z.array(z.string().regex(/^\/[a-z0-9-]+$/))
  }),
  taskPlanning: z.object({
    autoCreateIssues: z.boolean(),
    maxTaskFiles: z.number().int().positive(),
    maxTaskPatchLines: z.number().int().positive(),
    requireOnePrPerTask: z.boolean(),
    splitByBoundaries: z.array(z.string())
  }),
  repositoryAnalysis: z.object({
    detectWorkspaces: z.boolean(),
    detectBoundaries: z.boolean(),
    includeFileTreeDepth: z.number().int().min(1),
    maxContextFiles: z.number().int().positive(),
    boundaryHints: z.record(z.string(), z.array(z.string()))
  }),
  review: z.object({
    autoReviewOnPrOpen: z.boolean(),
    autoReviewOnPrUpdate: z.boolean(),
    commentCommand: z.string().regex(/^\/[a-z0-9-]+$/),
    roles: z.array(z.enum(["pdm", "pjm", "tech-lead", "engineer"])).min(1)
  })
});

export type RunnerConfig = z.infer<typeof runnerConfigSchema>;

export function validateConfigProvider(config: RunnerConfig): void {
  if (!config.ai.providers[config.ai.provider]) {
    throw new Error(`Unknown AI provider: ${config.ai.provider}`);
  }
  if (config.concurrency.perRepository > config.concurrency.global) {
    throw new Error("concurrency.perRepository cannot exceed concurrency.global");
  }
}

