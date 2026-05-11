import { readFile } from "node:fs/promises";
import YAML from "yaml";
import {
  runnerConfigSchema,
  type RunnerConfig,
  validateConfigProvider
} from "../../../core/app/config/runner-config.js";

export async function loadConfig(path: string): Promise<RunnerConfig> {
  const raw = await readFile(path, "utf8");
  const parsed = YAML.parse(raw) as unknown;
  const config = runnerConfigSchema.parse(parsed);
  validateConfigProvider(config);
  return config;
}
