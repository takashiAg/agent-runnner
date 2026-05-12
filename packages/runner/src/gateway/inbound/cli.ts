#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { Command } from "commander";
import { splitTasks } from "../../core/app/usecases/split-tasks.js";
import { reviewPr } from "../../core/app/usecases/review-pr.js";
import { runOnce } from "../../core/app/usecases/run-once.js";
import {
  decideCheckpointResume,
  findLatestCheckpointComment
} from "../../core/app/services/checkpoint-resume.js";
import { routeWorkerEvent } from "../../core/app/usecases/worker.js";
import type { WorkerAction } from "../../core/app/usecases/worker.js";
import { routeCommentCommand } from "../../core/app/routing/command-router.js";
import { inspectPatch } from "../../core/app/policy/patch-guard.js";
import type { RunnerSettings } from "../../core/app/settings/runner-settings.js";
import { loadConfig } from "../outbound/config/load-config.js";
import { analyzeRepository } from "../outbound/repository/repository-analyzer.js";
import { createIssueReader } from "../outbound/github/issue-reader.js";
import { pollGitHubWorkerEvents } from "../outbound/github/polling-source.js";
import { parseGitHubWebhookEvent } from "./webhook-event.js";
import {
  createCheckpointDependencies,
  createGitHubApi,
  createReviewPrDependencies,
  createRunOnceDependencies,
  createSplitTasksDependencies
} from "../composition-root.js";

const program = new Command();

program
  .name("label-ai-runner")
  .description(
    "Label-triggered AI runner for GitHub issue planning, task splitting, implementation, and review workflows."
  )
  .version("0.1.0");

program
  .command("config-check")
  .description("Validate runner config")
  .requiredOption("-c, --config <path>", "config file path")
  .action(async (options: { config: string }) => {
    const config = await loadConfig(options.config);
    console.log(JSON.stringify({ ok: true, repository: config.repository }, null, 2));
  });

program
  .command("run-once")
  .description("Run one label-triggered orchestration pass")
  .requiredOption("-c, --config <path>", "config file path")
  .option("--repo-root <path>", "local repository root for analysis", process.cwd())
  .option(
    "--remote-url <url>",
    "repository remote URL; defaults to https://github.com/<owner>/<repo>.git"
  )
  .option("--base-branch <branch>", "base branch for created pull requests", "main")
  .option("--dry-run", "pick and analyze without labels, checkout, AI, patch, or PR")
  .action(
    async (options: {
      config: string;
      repoRoot: string;
      remoteUrl?: string;
      baseBranch?: string;
      dryRun?: boolean;
    }) => {
      const config = await loadConfig(options.config);
      const dependencies = createRunOnceDependencies(config);
      const result = await runOnce(
        config,
        {
          repoRoot: options.repoRoot,
          remoteUrl: options.remoteUrl,
          baseBranch: options.baseBranch,
          dryRun: options.dryRun
        },
        dependencies
      );
      console.log(JSON.stringify(result, null, 2));
    }
  );

program
  .command("route-comment")
  .description("Route a GitHub comment command without executing it")
  .requiredOption("-c, --config <path>", "config file path")
  .argument("<body>", "comment body")
  .action(async (body: string, options: { config: string }) => {
    const config = await loadConfig(options.config);
    console.log(JSON.stringify(routeCommentCommand(body, config), null, 2));
  });

program
  .command("validate-patch")
  .description("Validate a unified diff against patch safety policy")
  .requiredOption("-c, --config <path>", "config file path")
  .argument("<patch>", "patch text")
  .action(async (patch: string, options: { config: string }) => {
    const config = await loadConfig(options.config);
    console.log(JSON.stringify(inspectPatch(patch, config), null, 2));
  });

program
  .command("split-tasks")
  .description("Generate a task split plan for an issue")
  .requiredOption("-c, --config <path>", "config file path")
  .option("--repo-root <path>", "local repository root for analysis", process.cwd())
  .option("--cwd <path>", "working directory passed to the AI provider")
  .argument("<issue>", "issue number")
  .action(async (issue: string, options: { config: string; repoRoot: string; cwd?: string }) => {
    const config = await loadConfig(options.config);
    const client = createGitHubApi(config);
    const issueReader = createIssueReader(client, config);
    const [issueDetails, analysis] = await Promise.all([
      issueReader.getIssue(Number(issue)),
      analyzeRepository(options.repoRoot, config)
    ]);
    const result = await splitTasks(
      config,
      { issue: issueDetails, analysis, cwd: options.cwd },
      createSplitTasksDependencies(config)
    );
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("review-pr")
  .description("Run multi-role PR review workflow")
  .requiredOption("-c, --config <path>", "config file path")
  .option("--dry-run", "build review input without calling the AI provider or commenting")
  .argument("<pr>", "pull request number")
  .action(async (pr: string, options: { config: string; dryRun?: boolean }) => {
    const config = await loadConfig(options.config);
    const result = await reviewPr(
      config,
      { prNumber: Number(pr), dryRun: options.dryRun },
      createReviewPrDependencies(config)
    );
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("resolve-conflict")
  .description("Inspect checkpoint state and decide conflict resume behavior")
  .requiredOption("-c, --config <path>", "config file path")
  .argument("<issue>", "issue number")
  .action(async (issue: string, options: { config: string }) => {
    const config = await loadConfig(options.config);
    const checkpointWorkflow = createCheckpointDependencies(config);
    const latest = findLatestCheckpointComment(
      await checkpointWorkflow.listIssueComments(Number(issue))
    );
    const decision = decideCheckpointResume(latest?.checkpoint ?? null);
    if (!decision.canResume) {
      await checkpointWorkflow.comment(
        Number(issue),
        ["resolve-conflict stopped.", "", ...decision.reasons.map((reason) => `- ${reason}`)].join(
          "\n"
        )
      );
    }
    console.log(JSON.stringify({ ok: true, issue: Number(issue), decision }, null, 2));
  });

program
  .command("handle-webhook")
  .description("Handle a GitHub webhook payload with the runner worker")
  .requiredOption("-c, --config <path>", "config file path")
  .requiredOption("--event <path>", "path to a GitHub webhook JSON payload")
  .option("--repo-root <path>", "local repository root for analysis", process.cwd())
  .action(async (options: { config: string; event: string; repoRoot: string }) => {
    const config = await loadConfig(options.config);
    const payload = JSON.parse(await readFile(options.event, "utf8")) as unknown;
    const event = parseGitHubWebhookEvent(payload as never);
    const action: WorkerAction = event
      ? routeWorkerEvent(config, event)
      : { kind: "ignore", reason: "unsupported webhook event" };
    const result = await executeWorkerAction(config, action, { repoRoot: options.repoRoot });
    console.log(JSON.stringify({ ok: true, event, action, result }, null, 2));
  });

program
  .command("worker")
  .description("Run a long-lived GitHub webhook worker")
  .requiredOption("-c, --config <path>", "config file path")
  .option("--host <host>", "host to bind", "0.0.0.0")
  .option("--port <port>", "port to bind", "3000")
  .option("--repo-root <path>", "local repository root for analysis", process.cwd())
  .action(async (options: { config: string; host: string; port: string; repoRoot: string }) => {
    const config = await loadConfig(options.config);
    const port = Number(options.port);
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(`Invalid worker port: ${options.port}`);
    }

    const server = createServer(async (request, response) => {
      await handleWorkerRequest(config, request, response, { repoRoot: options.repoRoot });
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, options.host, () => {
        server.off("error", reject);
        console.log(JSON.stringify({ ok: true, worker: "listening", host: options.host, port }));
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      const shutdown = () => server.close(() => resolve());
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    });
  });

program
  .command("poll")
  .description("Run one GitHub polling pass without exposing an incoming webhook")
  .requiredOption("-c, --config <path>", "config file path")
  .option("--repo-root <path>", "local repository root for analysis", process.cwd())
  .option("--state <path>", "polling state file", ".agent-runner/poll-state.json")
  .option("--since <iso>", "override polling cursor with an ISO timestamp")
  .action(async (options: { config: string; repoRoot: string; state: string; since?: string }) => {
    const config = await loadConfig(options.config);
    const result = await runPollingPass(config, {
      repoRoot: options.repoRoot,
      statePath: options.state,
      since: options.since
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("poll-worker")
  .description("Run a long-lived GitHub polling worker without exposing an incoming webhook")
  .requiredOption("-c, --config <path>", "config file path")
  .option("--repo-root <path>", "local repository root for analysis", process.cwd())
  .option("--state <path>", "polling state file", ".agent-runner/poll-state.json")
  .option("--interval-seconds <seconds>", "polling interval", "60")
  .option("--since <iso>", "override polling cursor for the first pass with an ISO timestamp")
  .action(
    async (options: {
      config: string;
      repoRoot: string;
      state: string;
      intervalSeconds: string;
      since?: string;
    }) => {
      const config = await loadConfig(options.config);
      const intervalSeconds = Number(options.intervalSeconds);
      if (!Number.isInteger(intervalSeconds) || intervalSeconds <= 0) {
        throw new Error(`Invalid polling interval: ${options.intervalSeconds}`);
      }

      let firstSince = options.since;
      console.log(
        JSON.stringify({
          ok: true,
          worker: "polling",
          intervalSeconds,
          statePath: options.state
        })
      );

      while (true) {
        const result = await runPollingPass(config, {
          repoRoot: options.repoRoot,
          statePath: options.state,
          since: firstSince
        });
        firstSince = undefined;
        console.log(JSON.stringify(result));
        await sleep(intervalSeconds * 1000);
      }
    }
  );

await program.parseAsync(process.argv);

async function handleWorkerRequest(
  config: RunnerSettings,
  request: IncomingMessage,
  response: ServerResponse,
  options: { repoRoot: string }
): Promise<void> {
  if (request.method === "GET" && request.url === "/healthz") {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method !== "POST" || request.url !== "/webhook") {
    sendJson(response, 404, { ok: false, error: "not_found" });
    return;
  }

  try {
    const payload = JSON.parse(await readRequestBody(request)) as unknown;
    const event = parseGitHubWebhookEvent(payload as never);
    const action: WorkerAction = event
      ? routeWorkerEvent(config, event)
      : { kind: "ignore", reason: "unsupported webhook event" };
    const result = await executeWorkerAction(config, action, options);
    sendJson(response, 200, { ok: true, event, action, result });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function executeWorkerAction(
  config: RunnerSettings,
  action: WorkerAction,
  options: { repoRoot: string }
): Promise<unknown> {
  switch (action.kind) {
    case "run-once":
      return runOnce(config, { repoRoot: options.repoRoot }, createRunOnceDependencies(config));
    case "split-tasks": {
      const client = createGitHubApi(config);
      const issueReader = createIssueReader(client, config);
      const [issue, analysis] = await Promise.all([
        issueReader.getIssue(action.issueNumber),
        analyzeRepository(options.repoRoot, config)
      ]);
      return splitTasks(config, { issue, analysis }, createSplitTasksDependencies(config));
    }
    case "review-pr":
      return reviewPr(config, { prNumber: action.prNumber }, createReviewPrDependencies(config));
    case "resolve-conflict": {
      const checkpointWorkflow = createCheckpointDependencies(config);
      const latest = findLatestCheckpointComment(
        await checkpointWorkflow.listIssueComments(action.issueNumber)
      );
      return decideCheckpointResume(latest?.checkpoint ?? null);
    }
    case "ignore":
      return { skipped: true, reason: action.reason };
  }
}

type PollState = {
  since: string;
  handledEventIds: string[];
};

async function runPollingPass(
  config: RunnerSettings,
  options: { repoRoot: string; statePath: string; since?: string }
): Promise<{
  ok: true;
  since: string;
  nextSince: string;
  received: number;
  handled: Array<{ id: string; action: WorkerAction; result: unknown }>;
}> {
  const state = await readPollState(options.statePath);
  const since = parseSince(options.since ?? state?.since);
  const nextSince = new Date();
  const handledIds = new Set(state?.handledEventIds ?? []);
  const client = createGitHubApi(config);
  const events = await pollGitHubWorkerEvents(client, config, { since });
  const handled: Array<{ id: string; action: WorkerAction; result: unknown }> = [];

  for (const polledEvent of events) {
    if (handledIds.has(polledEvent.id)) continue;
    const action = routeWorkerEvent(config, polledEvent.event);
    const result = await executeWorkerAction(config, action, { repoRoot: options.repoRoot });
    handled.push({ id: polledEvent.id, action, result });
    handledIds.add(polledEvent.id);
  }

  await writePollState(options.statePath, {
    since: nextSince.toISOString(),
    handledEventIds: [...handledIds].slice(-500)
  });

  return {
    ok: true,
    since: since.toISOString(),
    nextSince: nextSince.toISOString(),
    received: events.length,
    handled
  };
}

function parseSince(value: string | undefined): Date {
  if (!value) return new Date();
  const since = new Date(value);
  if (Number.isNaN(since.getTime())) throw new Error(`Invalid polling cursor: ${value}`);
  return since;
}

async function readPollState(statePath: string): Promise<PollState | null> {
  try {
    return JSON.parse(await readFile(statePath, "utf8")) as PollState;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function writePollState(statePath: string, state: PollState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
}
