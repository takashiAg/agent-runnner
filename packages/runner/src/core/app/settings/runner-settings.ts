export type RunnerSettings = {
  repository: string;
  labels: {
    trigger: string;
    plan: string;
    splitTasks: string;
    running: string;
    failed: string;
    blocked: string;
    prCreated: string;
    needsSplit: string;
    needsHumanInput: string;
    story: string;
    bug: string;
    task: string;
  };
  branch: {
    prefix: string;
  };
  checkout: {
    strategy: "fresh-clone" | "bare-cache" | "existing-local";
    cacheRoot: string;
    cloneRoot: string;
    bareRepositoryCache: boolean;
    shallowClone: boolean;
    fetchDepth: number;
  };
  worktree: {
    root: string;
  };
  ai: {
    provider: string;
    mode: "patch-only";
    allowTools: false;
    allowCommands: false;
    output: "json";
    timeoutSeconds: number;
    providers: Record<string, { command: string; args: string[] }>;
  };
  concurrency: {
    global: number;
    perRepository: number;
  };
  patch: {
    maxFiles: number;
    maxLines: number;
    denylist: string[];
  };
  conflict: {
    autoResolve: boolean;
    askWhenUnclear: boolean;
    maxConflictFilesForAutoResolve: number;
    allowedAutoResolveKinds: Array<"context-shift" | "formatting-only" | "import-order">;
    blockedPaths: string[];
  };
  validation: {
    commands: string[];
  };
  commentCommands: {
    allowlist: string[];
  };
  taskPlanning: {
    autoCreateIssues: boolean;
    maxTaskFiles: number;
    maxTaskPatchLines: number;
    requireOnePrPerTask: boolean;
    splitByBoundaries: string[];
  };
  repositoryAnalysis: {
    detectWorkspaces: boolean;
    detectBoundaries: boolean;
    includeFileTreeDepth: number;
    maxContextFiles: number;
    boundaryHints: Record<string, string[]>;
  };
  review: {
    autoReviewOnPrOpen: boolean;
    autoReviewOnPrUpdate: boolean;
    commentCommand: string;
    roles: Array<"pdm" | "pjm" | "tech-lead" | "engineer">;
  };
};
