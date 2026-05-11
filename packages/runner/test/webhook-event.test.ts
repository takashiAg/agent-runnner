import { describe, expect, it } from "vitest";
import { parseGitHubWebhookEvent } from "../src/gateway/inbound/webhook-event.js";

describe("parseGitHubWebhookEvent", () => {
  it("parses issue label events", () => {
    expect(
      parseGitHubWebhookEvent({
        action: "labeled",
        issue: { number: 1, labels: [{ name: "ai:ready" }] }
      })
    ).toEqual({ kind: "issue-labeled", issueNumber: 1, labels: ["ai:ready"] });
  });

  it("parses issue comment events", () => {
    expect(
      parseGitHubWebhookEvent({
        action: "created",
        issue: { number: 2 },
        comment: { body: "/review" }
      })
    ).toEqual({ kind: "issue-comment", issueNumber: 2, body: "/review" });
  });

  it("parses pull request events", () => {
    expect(
      parseGitHubWebhookEvent({
        action: "opened",
        pull_request: { number: 3 }
      })
    ).toEqual({ kind: "pull-request-opened", prNumber: 3 });
  });
});
