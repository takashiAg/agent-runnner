#!/usr/bin/env node
import { Command } from "commander";
import { runOnce } from "../../core/app/usecases/run-once.js";
import { routeCommentCommand } from "../../core/app/routing/command-router.js";
import { inspectPatch } from "../../core/app/policy/patch-guard.js";
import { loadConfig } from "../outbound/config/load-config.js";
import { createRunOnceDependencies } from "../composition-root.js";

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
  .description("Placeholder for task planning workflow")
  .requiredOption("-c, --config <path>", "config file path")
  .argument("<issue>", "issue number")
  .action(async (issue: string, options: { config: string }) => {
    await loadConfig(options.config);
    console.log(
      JSON.stringify({ ok: true, issue: Number(issue), status: "not_implemented" }, null, 2)
    );
  });

program
  .command("review-pr")
  .description("Placeholder for multi-role PR review workflow")
  .requiredOption("-c, --config <path>", "config file path")
  .argument("<pr>", "pull request number")
  .action(async (pr: string, options: { config: string }) => {
    await loadConfig(options.config);
    console.log(JSON.stringify({ ok: true, pr: Number(pr), status: "not_implemented" }, null, 2));
  });

program
  .command("resolve-conflict")
  .description("Placeholder for conflict resume workflow")
  .requiredOption("-c, --config <path>", "config file path")
  .argument("<issue>", "issue number")
  .action(async (issue: string, options: { config: string }) => {
    await loadConfig(options.config);
    console.log(
      JSON.stringify({ ok: true, issue: Number(issue), status: "not_implemented" }, null, 2)
    );
  });

await program.parseAsync(process.argv);
