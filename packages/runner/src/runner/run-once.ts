import type { RunnerConfig } from "../config/schema.js";
import { analyzeRepository } from "../repository/repository-analyzer.js";

export type RunOnceResult = {
  ok: true;
  mode: "dry-run";
  repository: string;
  analysis: Awaited<ReturnType<typeof analyzeRepository>>;
  next: string[];
};

export async function runOnce(
  config: RunnerConfig,
  options: { repoRoot: string }
): Promise<RunOnceResult> {
  const analysis = await analyzeRepository(options.repoRoot, config);
  return {
    ok: true,
    mode: "dry-run",
    repository: config.repository,
    analysis,
    next: [
      "Implement GitHub issue pickup",
      "Implement checkout manager",
      "Wire agent CLI adapter into patch workflow",
      "Add PR creation after validation"
    ]
  };
}

