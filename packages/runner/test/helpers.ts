import { loadConfig } from "../src/gateway/outbound/config/load-config.js";
import type { RunnerConfig } from "../src/core/app/config/runner-config.js";

export async function loadExampleConfig(): Promise<RunnerConfig> {
  return loadConfig("config/runner.example.yaml");
}
