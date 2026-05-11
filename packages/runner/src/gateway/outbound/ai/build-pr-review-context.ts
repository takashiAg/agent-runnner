export function buildPrReviewContext(input: {
  title: string;
  body: string;
  diff: string;
  labels: string[];
}): string {
  return JSON.stringify(
    {
      kind: "pr-review-context",
      title: input.title,
      body: input.body,
      diff: input.diff,
      labels: input.labels
    },
    null,
    2
  );
}
