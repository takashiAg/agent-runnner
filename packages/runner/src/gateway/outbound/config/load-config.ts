import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { runnerConfigSchema, validateConfigProvider } from "./runner-config.js";
import type { RunnerSettings } from "../../../core/app/settings/runner-settings.js";

export async function loadConfig(path: string): Promise<RunnerSettings> {
  const raw = await readFile(path, "utf8");
  const parsed = YAML.parse(raw) as unknown;
  const config = runnerConfigSchema.parse(parsed);
  validateConfigProvider(config);
  return config;
}
