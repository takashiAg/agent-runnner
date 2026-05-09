import type { RunnerConfig } from "../config/schema.js";

export type RoutedCommand =
  | { kind: "review"; command: "/review" }
  | { kind: "split-tasks"; command: "/split-tasks" }
  | { kind: "resolve-conflict"; command: "/resolve-conflict" };

const commandMap = {
  "/review": "review",
  "/split-tasks": "split-tasks",
  "/resolve-conflict": "resolve-conflict"
} as const;

export function routeCommentCommand(body: string, config: RunnerConfig): RoutedCommand | null {
  const allowlist = new Set(config.commentCommands.allowlist);
  const firstCommand = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^\/[a-z0-9-]+$/.test(line));

  if (!firstCommand || !allowlist.has(firstCommand)) return null;
  if (!(firstCommand in commandMap)) return null;
  const kind = commandMap[firstCommand as keyof typeof commandMap];
  return { kind, command: firstCommand as RoutedCommand["command"] } as RoutedCommand;
}

