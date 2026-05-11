import { Minimatch } from "minimatch";

export type ConflictKind = "context-shift" | "formatting-only" | "import-order" | "semantic";

export type ConflictPolicyConfig = {
  conflict: {
    autoResolve: boolean;
    maxConflictFilesForAutoResolve: number;
    blockedPaths: string[];
    allowedAutoResolveKinds: ConflictKind[];
  };
};

export type ConflictAnalysis = {
  canAutoResolve: boolean;
  conflictFiles: string[];
  reasons: string[];
  questionComment?: string;
};

const conflictMarkerPattern = /^(<<<<<<<|=======|>>>>>>>) /m;

export function analyzeConflict(
  files: Array<{ path: string; content: string; kind?: ConflictKind }>,
  config: ConflictPolicyConfig
): ConflictAnalysis {
  const conflictFiles = files
    .filter((file) => conflictMarkerPattern.test(file.content))
    .map((file) => file.path)
    .sort();
  const reasons: string[] = [];

  if (conflictFiles.length === 0) {
    return { canAutoResolve: false, conflictFiles, reasons: ["no conflict markers found"] };
  }
  if (!config.conflict.autoResolve) {
    reasons.push("auto resolve is disabled");
  }
  if (conflictFiles.length > config.conflict.maxConflictFilesForAutoResolve) {
    reasons.push("too many conflict files for auto resolve");
  }

  const blockedMatchers = config.conflict.blockedPaths.map(
    (pattern) => new Minimatch(pattern, { dot: true })
  );
  for (const file of conflictFiles) {
    if (blockedMatchers.some((matcher) => matcher.match(file))) {
      reasons.push(`blocked conflict path: ${file}`);
    }
  }

  for (const file of files.filter((item) => conflictFiles.includes(item.path))) {
    const kind = file.kind ?? "semantic";
    if (!config.conflict.allowedAutoResolveKinds.includes(kind)) {
      reasons.push(`conflict requires human judgement: ${file.path}`);
    }
  }

  const canAutoResolve = reasons.length === 0;
  return {
    canAutoResolve,
    conflictFiles,
    reasons,
    questionComment: canAutoResolve
      ? undefined
      : buildConflictQuestionComment(conflictFiles, reasons)
  };
}

export function buildConflictQuestionComment(conflictFiles: string[], reasons: string[]): string {
  return [
    "Conflict の自動解消で判断が必要です。",
    "",
    "対象ファイル:",
    ...conflictFiles.map((file) => `- \`${file}\``),
    "",
    "停止理由:",
    ...reasons.map((reason) => `- ${reason}`),
    "",
    "進め方をコメントしてください。",
    "",
    "- `/resolve-conflict` で runner が保存済みの方針に従って再開",
    "- 方針が決められない場合は人間が手動で branch を更新"
  ].join("\n");
}
