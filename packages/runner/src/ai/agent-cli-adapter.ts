import { execa } from "execa";
import type { RunnerConfig } from "../config/schema.js";

const commandRequestPattern =
  /\b(?:run|execute)\b.*\b(?:git|pnpm|npm|yarn|bash|sh|curl|docker|kubectl)\b/i;

export type AgentCliResult = {
  stdout: string;
  stderr: string;
};

export async function runAgentCli(
  prompt: string,
  config: RunnerConfig,
  options: { cwd?: string } = {}
): Promise<AgentCliResult> {
  const provider = config.ai.providers[config.ai.provider];
  if (!provider) throw new Error(`Unknown AI provider: ${config.ai.provider}`);

  const subprocess = execa(provider.command, provider.args, {
    cwd: options.cwd,
    input: prompt,
    timeout: config.ai.timeoutSeconds * 1000,
    reject: false
  });
  const result = await subprocess;

  if (result.timedOut) {
    throw new Error("agent CLI timed out");
  }
  if (result.exitCode !== 0) {
    throw new Error(`agent CLI failed with exit code ${result.exitCode}: ${result.stderr}`);
  }
  if (commandRequestPattern.test(result.stdout)) {
    throw new Error("agent output contains command execution request");
  }
  JSON.parse(result.stdout);
  return { stdout: result.stdout, stderr: result.stderr };
}

