import type { RunnerSettings } from "../app/settings/runner-settings.js";

export type AgentCliResult = {
  stdout: string;
  stderr: string;
};

export type RunAgentCli = (
  prompt: string,
  config: RunnerSettings,
  options?: { cwd?: string }
) => Promise<AgentCliResult>;
