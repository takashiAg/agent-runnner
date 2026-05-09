import { loadConfig } from "../src/config/load-config.js";
import type { RunnerConfig } from "../src/config/schema.js";

export async function loadExampleConfig(): Promise<RunnerConfig> {
  return loadConfig("config/runner.example.yaml");
}

