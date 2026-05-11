import { execa } from "execa";

export async function applyPatch(
  patch: string,
  options: { cwd: string }
): Promise<{ ok: boolean; stderr: string }> {
  const result = await execa("git", ["apply", "--whitespace=fix", "-"], {
    cwd: options.cwd,
    input: patch,
    reject: false
  });
  return { ok: result.exitCode === 0, stderr: result.stderr };
}
