import type { RunnerSettings } from "../app/settings/runner-settings.js";

export type ValidationResult = {
  ok: boolean;
  results: Array<{ command: string; exitCode: number; stdout: string; stderr: string }>;
};

export type RunValidation = (config: RunnerSettings, cwd: string) => Promise<ValidationResult>;
