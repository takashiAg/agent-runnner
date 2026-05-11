import {
  analyzeConflict,
  type ConflictAnalysis,
  type ConflictKind,
  type ConflictPolicyConfig
} from "../policy/conflict-resolver.js";

export type ConflictMarkerFile = {
  path: string;
  content: string;
  kind?: ConflictKind;
};

export type ConflictResumeDecision = {
  canResume: boolean;
  action: "auto-resolve" | "ask-human" | "none";
  analysis: ConflictAnalysis;
  reasons: string[];
};

export function decideConflictResume(
  files: ConflictMarkerFile[],
  config: ConflictPolicyConfig
): ConflictResumeDecision {
  const analysis = analyzeConflict(files, config);

  if (analysis.conflictFiles.length === 0) {
    return {
      canResume: false,
      action: "none",
      analysis,
      reasons: analysis.reasons
    };
  }

  if (!analysis.canAutoResolve) {
    return {
      canResume: false,
      action: "ask-human",
      analysis,
      reasons: analysis.reasons
    };
  }

  return {
    canResume: true,
    action: "auto-resolve",
    analysis,
    reasons: []
  };
}
