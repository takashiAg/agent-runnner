import { Minimatch } from "minimatch";

export type PatchPolicyConfig = {
  patch: {
    maxFiles: number;
    maxLines: number;
    denylist: string[];
  };
};

export type PatchGuardResult = {
  safe: boolean;
  files: string[];
  reasons: string[];
};

const diffPathPattern = /^(?:---|\+\+\+) (?:a|b)\/(.+)$/gm;

export function inspectPatch(patch: string, config: PatchPolicyConfig): PatchGuardResult {
  const reasons: string[] = [];
  const files = extractPatchFiles(patch);

  if (!patch.trim().startsWith("diff --git") && !patch.includes("\n@@")) {
    reasons.push("patch is not a unified diff");
  }
  if (files.length > config.patch.maxFiles) {
    reasons.push(`patch touches too many files: ${files.length} > ${config.patch.maxFiles}`);
  }
  const lineCount = patch.split(/\r?\n/).length;
  if (lineCount > config.patch.maxLines) {
    reasons.push(`patch is too large: ${lineCount} > ${config.patch.maxLines}`);
  }
  if (/^GIT binary patch$/m.test(patch) || /^Binary files /m.test(patch)) {
    reasons.push("binary patch is not allowed");
  }
  if (/^(<<<<<<<|=======|>>>>>>>) /m.test(patch)) {
    reasons.push("patch contains conflict markers");
  }

  const denyMatchers = config.patch.denylist.map(
    (pattern) => new Minimatch(pattern, { dot: true })
  );
  for (const file of files) {
    if (file.startsWith("/") || file.split(/[\\/]/).includes("..")) {
      reasons.push(`unsafe path: ${file}`);
    }
    if (denyMatchers.some((matcher) => matcher.match(file))) {
      reasons.push(`denylisted path: ${file}`);
    }
  }

  return { safe: reasons.length === 0, files, reasons };
}

export function extractPatchFiles(patch: string): string[] {
  const files = new Set<string>();
  for (const match of patch.matchAll(diffPathPattern)) {
    const file = match[1];
    if (file && file !== "/dev/null") files.add(file);
  }
  return [...files].sort();
}
