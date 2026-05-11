export type RepositoryAnalysis = {
  packageManager: "pnpm" | "npm" | "yarn" | "bun" | "unknown";
  workspaces: string[];
  boundaries: Record<string, string[]>;
  splitHints: string[];
};
