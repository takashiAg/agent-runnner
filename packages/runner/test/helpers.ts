import { loadConfig } from "../src/gateway/outbound/config/load-config.js";
import type { RunnerSettings } from "../src/core/app/settings/runner-settings.js";

export async function loadExampleConfig(): Promise<RunnerSettings> {
  return loadConfig("config/runner.example.yaml");
}
