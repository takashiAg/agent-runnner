import type { ValidationResult } from "../../../core/port/validation.js";
import type { RunnerSettings } from "../../../core/app/settings/runner-settings.js";
import { execAllowlisted } from "./exec-allowlisted.js";

export async function runValidation(
  config: RunnerSettings,
  cwd: string
): Promise<ValidationResult> {
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
