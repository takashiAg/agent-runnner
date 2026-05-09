import type { RunnerConfig } from "../config/schema.js";
import { execAllowlisted } from "../util/exec-allowlisted.js";

export type ValidationResult = {
  ok: boolean;
  results: Array<{ command: string; exitCode: number; stdout: string; stderr: string }>;
};

export async function runValidation(config: RunnerConfig, cwd: string): Promise<ValidationResult> {
  const results = [];
  for (const command of config.validation.commands) {
    const result = await execAllowlisted(command, config.validation.commands, { cwd });
    results.push(result);
    if (result.exitCode !== 0) {
      return { ok: false, results };
    }
  }
  return { ok: true, results };
}

