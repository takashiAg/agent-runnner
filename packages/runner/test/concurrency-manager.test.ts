import { describe, expect, it } from "vitest";
import { ConcurrencyManager } from "../src/runner/concurrency-manager.js";

describe("ConcurrencyManager", () => {
  it("enforces global and duplicate limits", () => {
    const manager = new ConcurrencyManager({ global: 1, perRepository: 1 });
    const item = { id: "1", repository: "owner/name", issueOrPrKey: "issue-1" };
    expect(manager.start(item)).toBe(true);
    expect(manager.start({ id: "2", repository: "owner/name", issueOrPrKey: "issue-2" })).toBe(false);
    expect(manager.start(item)).toBe(false);
    manager.finish(item);
    expect(manager.start({ id: "2", repository: "owner/name", issueOrPrKey: "issue-2" })).toBe(true);
  });
});

