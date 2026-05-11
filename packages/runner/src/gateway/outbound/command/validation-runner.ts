import type { ValidationResult } from "../../../core/app/ports/validation.js";
import type { RunnerConfig } from "../../../core/app/config/runner-config.js";
import { execAllowlisted } from "./exec-allowlisted.js";

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
