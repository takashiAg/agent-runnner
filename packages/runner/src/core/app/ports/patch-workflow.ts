import type { RunnerConfig } from "../config/runner-config.js";
import type { AiPatchOutput } from "../contract/ai-output.js";
import type { PatchGuardResult } from "../policy/patch-guard.js";

export type ParseAiPatchOutput = (raw: string) => AiPatchOutput;

export type InspectPatch = (patch: string, config: RunnerConfig) => PatchGuardResult;

export type ApplyPatch = (
  patch: string,
  options: { cwd: string }
) => Promise<{ ok: boolean; stderr: string }>;
