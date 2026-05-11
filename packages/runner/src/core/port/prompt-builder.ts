import type { RepositoryAnalysis } from "../domain/value-object/repository-analysis.js";

export type IssuePromptInput = {
  title: string;
  body: string;
  labels: string[];
  analysis: RepositoryAnalysis;
};

export type BuildIssuePrompt = (input: IssuePromptInput) => string;
