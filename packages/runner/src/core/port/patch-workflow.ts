import type { AiPatchOutput } from "../app/contract/ai-output.js";
import type { PatchGuardResult } from "../app/policy/patch-guard.js";
import type { RunnerSettings } from "../app/settings/runner-settings.js";

export type ParseAiPatchOutput = (raw: string) => AiPatchOutput;

export type InspectPatch = (patch: string, config: RunnerSettings) => PatchGuardResult;

export type ApplyPatch = (
  patch: string,
  options: { cwd: string }
) => Promise<{ ok: boolean; stderr: string }>;
