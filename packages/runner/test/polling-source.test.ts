import { describe, expect, it, vi } from "vitest";
import { pollGitHubWorkerEvents } from "../src/gateway/outbound/github/polling-source.js";
import { loadExampleConfig } from "./helpers.js";

describe("pollGitHubWorkerEvents", () => {
  it("maps labeled issues, comments, and pull requests to worker events", async () => {
    const config = await loadExampleConfig();
    const client = {
      rest: {
        issues: {
          listForRepo: vi
            .fn()
            .mockResolvedValueOnce({
              data: [
                {
                  number: 1,
                  updated_at: "2026-05-12T00:01:00Z",
                  labels: [{ name: "ai:ready" }]
                }
              ]
            })
            .mockResolvedValueOnce({
              data: [
                {
                  number: 2,
                  updated_at: "2026-05-12T00:02:00Z",
                  labels: [{ name: "ai:split-tasks" }]
                }
              ]
            }),
          listCommentsForRepo: vi.fn().mockResolvedValue({
            data: [
              {
                id: 10,
                issue_url: "https://api.github.com/repos/owner/name/issues/3",
                body: "/review",
                updated_at: "2026-05-12T00:03:00Z"
              }
            ]
          })
        },
        pulls: {
          list: vi.fn().mockResolvedValue({
            data: [
              {
                number: 4,
                created_at: "2026-05-12T00:04:00Z",
                updated_at: "2026-05-12T00:04:00Z"
              }
            ]
          })
        }
      }
    };

    const events = await pollGitHubWorkerEvents(client as never, config, {
      since: new Date("2026-05-12T00:00:00Z")
    });

    expect(events.map((event) => event.event)).toEqual([
      { kind: "issue-labeled", issueNumber: 1, labels: ["ai:ready"] },
      { kind: "issue-labeled", issueNumber: 2, labels: ["ai:split-tasks"] },
      { kind: "issue-comment", issueNumber: 3, body: "/review" },
      { kind: "pull-request-opened", prNumber: 4 }
    ]);
  });
});
