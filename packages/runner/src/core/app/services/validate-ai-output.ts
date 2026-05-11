import { aiPatchOutputSchema, type AiPatchOutput } from "../contract/ai-output.js";

const forbiddenCommandPattern =
  /\b(?:sh|bash|zsh|git|pnpm|npm|yarn|bun|curl|wget|docker|kubectl|terraform)\b/i;

export function parseAiPatchOutput(raw: string): AiPatchOutput {
  const parsed = JSON.parse(raw) as unknown;
  const output = aiPatchOutputSchema.parse(parsed);

  for (const testCommand of output.tests_to_run) {
    if (forbiddenCommandPattern.test(testCommand)) {
      // tests_to_run is informational, but keep explicit execution payloads out of the schema.
      throw new Error(`tests_to_run contains command-like text: ${testCommand}`);
    }
  }

  return output;
}
