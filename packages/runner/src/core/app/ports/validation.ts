import type { RunnerConfig } from "../config/runner-config.js";

export type ValidationResult = {
  ok: boolean;
  results: Array<{ command: string; exitCode: number; stdout: string; stderr: string }>;
};

export type RunValidation = (config: RunnerConfig, cwd: string) => Promise<ValidationResult>;
