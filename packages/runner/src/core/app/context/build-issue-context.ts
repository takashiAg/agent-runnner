import type { RepositoryAnalysis } from "../ports/repository.js";

export function buildIssueContext(input: {
  title: string;
  body: string;
  labels: string[];
  analysis: RepositoryAnalysis;
}): string {
  return JSON.stringify(
    {
      kind: "issue-context",
      title: input.title,
      body: input.body,
      labels: input.labels,
      repositoryAnalysis: input.analysis
    },
    null,
    2
  );
}
