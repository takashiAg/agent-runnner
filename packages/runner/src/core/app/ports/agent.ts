import type { RunnerConfig } from "../config/runner-config.js";

export type AgentCliResult = {
  stdout: string;
  stderr: string;
};

export type RunAgentCli = (
  prompt: string,
  config: RunnerConfig,
  options?: { cwd?: string }
) => Promise<AgentCliResult>;
