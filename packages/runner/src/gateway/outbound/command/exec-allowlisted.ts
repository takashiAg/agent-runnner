import { execa } from "execa";

export async function execAllowlisted(
  command: string,
  allowlist: string[],
  options: { cwd: string; timeoutMs?: number }
): Promise<{ command: string; exitCode: number; stdout: string; stderr: string }> {
  if (!allowlist.includes(command)) {
    throw new Error(`Command is not allowlisted: ${command}`);
  }
  const [file, ...args] = command.split(/\s+/);
  if (!file) throw new Error("Empty command");
  const result = await execa(file, args, {
    cwd: options.cwd,
    timeout: options.timeoutMs ?? 10 * 60 * 1000,
    reject: false
  });
  return {
    command,
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr
  };
}
