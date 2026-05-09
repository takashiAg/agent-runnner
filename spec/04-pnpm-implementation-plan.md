# pnpm Implementation Plan

## 前提

実装は TypeScript + pnpm workspace で進める。

CLI、公式サイト、将来の補助 package を分けられるよう、最初から monorepo 構成にする。

## 推奨ディレクトリ構成

```txt
.
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── packages
│   └── runner
│       ├── package.json
│       ├── src
│       ├── test
│       └── config
│           └── runner.example.yaml
├── apps
│   └── gh-pages
│       ├── package.json
│       ├── index.html
│       └── src
│           ├── main.ts
│           └── styles.css
├── .github
│   └── workflows
│       └── pages.yml
└── spec
```

## 初期 package 方針

```json
{
  "name": "label-triggered-ai-runner",
  "private": true,
  "type": "module",
  "bin": {
    "label-ai-runner": "./dist/cli.js"
  },
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --write .",
    "prepack": "pnpm build"
  }
}
```

想定 dependencies:

- `@octokit/rest`
- `commander`
- `zod`
- `yaml`
- `execa`
- `minimatch`

想定 devDependencies:

- `typescript`
- `tsx`
- `vitest`
- `eslint`
- `prettier`
- `@types/node`

## CLI

初期 CLI は `run-once` のみ実装する。

```txt
pnpm dev run-once --config config/runner.example.yaml
```

将来的な command:

```txt
pnpm dev poll --config config/runner.yaml
pnpm dev worker --config config/runner.yaml --concurrency 2
pnpm dev run-issue 123 --config config/runner.yaml
pnpm dev split-tasks 123 --config config/runner.yaml
pnpm dev review-pr 456 --config config/runner.yaml
pnpm dev resolve-conflict 123 --config config/runner.yaml
pnpm dev validate-patch ./patch.diff --config config/runner.yaml
```

配布後の command:

```txt
label-ai-runner run-once --config config/runner.yaml
label-ai-runner worker --config config/runner.yaml --concurrency 2
label-ai-runner review-pr 456 --config config/runner.yaml
```

## Config Schema

初期 config:

```yaml
repository: owner/name

labels:
  trigger: ai:ready
  plan: ai:plan
  splitTasks: ai:split-tasks
  running: ai:running
  failed: ai:failed
  blocked: ai:blocked
  prCreated: ai:pr-created
  needsSplit: ai:needs-split
  needsHumanInput: ai:needs-human-input
  story: type:story
  bug: type:bug
  task: type:task

branch:
  prefix: ai/issue-

checkout:
  strategy: fresh-clone
  cacheRoot: .agent-runner/cache
  cloneRoot: .agent-runner/repos
  bareRepositoryCache: false
  shallowClone: false
  fetchDepth: 0

worktree:
  root: .agent-runner/worktrees

ai:
  provider: codex-cli
  mode: patch-only
  allowTools: false
  allowCommands: false
  output: json
  timeoutSeconds: 600
  providers:
    codex-cli:
      command: codex
      args:
        - exec
        - --json
    claude-code-cli:
      command: claude
      args:
        - --output-format
        - json

concurrency:
  global: 2
  perRepository: 1

patch:
  maxFiles: 12
  maxLines: 800
  denylist:
    - .env
    - .env.*
    - "**/secrets/**"
    - "**/*secret*"
    - ".github/workflows/deploy-*"
    - "infra/production/**"
    - "db/production/**"

conflict:
  autoResolve: true
  askWhenUnclear: true
  maxConflictFilesForAutoResolve: 3
  allowedAutoResolveKinds:
    - context-shift
    - formatting-only
    - import-order
  blockedPaths:
    - infra/**
    - db/**
    - "**/*auth*"
    - "**/*permission*"

validation:
  commands:
    - git diff --check
    - pnpm test:contracts
    - pnpm lint
    - pnpm typecheck
    - pnpm test
    - pnpm build

commentCommands:
  allowlist:
    - /review
    - /split-tasks
    - /resolve-conflict

taskPlanning:
  autoCreateIssues: false
  maxTaskFiles: 12
  maxTaskPatchLines: 800
  requireOnePrPerTask: true
  splitByBoundaries:
    - backend
    - frontend
    - shared
    - docs
    - infra

repositoryAnalysis:
  detectWorkspaces: true
  detectBoundaries: true
  includeFileTreeDepth: 3
  maxContextFiles: 40
  boundaryHints:
    backend:
      - apps/api/**
      - packages/server/**
      - src/server/**
    frontend:
      - apps/web/**
      - packages/ui/**
      - src/components/**

review:
  autoReviewOnPrOpen: true
  autoReviewOnPrUpdate: false
  commentCommand: /review
  roles:
    - pdm
    - pjm
    - tech-lead
    - engineer
```

`checkout.strategy` は以下を想定する。

- `fresh-clone`
  - run ごとに repository を clone する。単純で隔離しやすいが、大きい repository では重い。
- `bare-cache`
  - repository ごとに bare repository cache を作り、fetch 後に worktree を切る。高速だが cache 管理が必要。
- `existing-local`
  - 既存 local repository を使う。開発用途向けで、CI / daemon 運用では非推奨。

## 実装ステップ

### Step 1: pnpm / TypeScript 基盤

作るもの:

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `src/cli.ts`
- `config/runner.example.yaml`

完了条件:

- `pnpm install` が通る
- `pnpm typecheck` が通る
- `pnpm dev --help` が動く

### Step 2: Config Loader

作るもの:

- `src/config/load-config.ts`
- `src/config/schema.ts`

実装内容:

- YAML 読み込み
- zod schema validation
- denylist / validation command の config 化
- AI provider CLI 設定の validation
- concurrency 設定の validation
- repository analysis 設定の validation

テスト:

- 必須項目不足で失敗する
- example config が成功する

### Step 2.5: Repository Analyzer

作るもの:

- `src/repository/repository-analyzer.ts`

実装内容:

- `package.json`、`pnpm-workspace.yaml`、workspace package を読む
- BE / FE / shared / infra / docs の境界候補を推定する
- Issue label / body から関連 area を推定する
- bug Issue の関連 source / test / config 候補を抽出する
- task が複数境界にまたがる場合に split hint を返す

テスト:

- pnpm workspace を検出する
- backend / frontend の path hint を分類する
- monorepo package 単位を抽出する
- 複数境界にまたがる task に split hint を返す

### Step 2.6: Concurrency Manager

作るもの:

- `src/runner/concurrency-manager.ts`

実装内容:

- global concurrency を制御する
- repository concurrency を制御する
- Issue / branch / worktree の二重実行を防ぐ
- queue item の状態を管理する

テスト:

- global 上限を超えて実行しない
- repository 上限を超えて実行しない
- 同じ Issue を二重実行しない

### Step 3: Label Classifier

作るもの:

- `src/runner/classify.ts`

実装内容:

- labels から level / risk を決定する
- labels から issue type を決定する
- `risk:dangerous` を block する
- `risk:high` / `needs:human-approval` を patch only にする
- `type:story` / `type:bug` を task planning 候補にする
- `type:task` を実装候補にする

テスト:

- `ai:level-0`
- `ai:level-1`
- `ai:level-2`
- `risk:high`
- `risk:dangerous`
- `type:story`
- `type:bug`
- `type:task`

### Step 3.5: Comment Command Router

作るもの:

- `src/runner/command-router.ts`

実装内容:

- Issue / PR comment から allowlist command を抽出する
- `/review` を PR review workflow に map する
- `/split-tasks` を task split workflow に map する
- 未定義 command を無視する
- comment author の permission check 結果を受け取れる interface にする

テスト:

- `/review` を認識する
- `/split-tasks` を認識する
- 未定義 command を無視する
- 文中の任意 command 文字列を OS command として扱わない

### Step 4: AI Output Schema

作るもの:

- `src/ai/output-schema.ts`
- `src/patch/validate-output.ts`

実装内容:

- AI output JSON の zod schema
- path validation
- absolute path 禁止
- `..` 禁止
- `block_reason` 判定

テスト:

- 正常 JSON
- command 混入
- absolute path
- path traversal
- `requires_human_approval`
- `block_reason`

### Step 4.5: Agent CLI Adapter

作るもの:

- `src/ai/agent-cli-adapter.ts`

実装内容:

- Codex CLI / Claude Code CLI を provider として起動する
- context を stdin または context file で渡す
- tool / command execution を無効化する起動引数を config から適用する
- timeout する
- stdout から JSON output を取り出す
- CLI が command 実行や file write をした痕跡があれば失敗にする

注意:

- LLM はコマンドを実行しない
- runner が CLI プロセスを起動することと、LLM が shell command を実行することを分けて扱う
- patch 適用、検証、commit、push、PR 作成は runner だけが行う

テスト:

- 正常 JSON を parse できる
- JSON 以外を失敗にする
- timeout を失敗にする
- command 実行要求を含む output を拒否する

### Step 5: Patch Guard

作るもの:

- `src/patch/patch-guard.ts`

実装内容:

- unified diff の file path 抽出
- denylist match
- maxFiles / maxLines
- conflict marker scan
- binary patch 検出

テスト:

- denylist path が block される
- file 数上限を超えると block される
- conflict marker が block される
- binary patch が block される

### Step 6: GitHub Client

作るもの:

- `src/github/github-client.ts`

実装内容:

- Issue search
- label add / remove
- comment create / update
- PR existence check
- PR create

注意:

- GitHub token は env から読むが、AI context には含めない
- API adapter は unit test しやすい interface にする

### Step 7: Worktree Manager

作るもの:

- `src/worktree/checkout-manager.ts`
- `src/worktree/conflict-resolver.ts`
- `src/worktree/worktree-manager.ts`
- `src/patch/apply-patch.ts`

実装内容:

- repository fresh clone
- bare repository cache の作成 / fetch
- branch 作成
- worktree 作成
- patch apply
- conflict detect
- policy に沿った conflict auto resolve
- commit
- push

注意:

- shell command は runner 内の固定処理としてのみ実行する
- AI output 由来の command は使わない
- 初期実装は `fresh-clone` を優先する
- repository が大きい場合に備えて `bare-cache` を拡張可能にする

### Step 7.5: Conflict Resolver

作るもの:

- `src/worktree/conflict-resolver.ts`

実装内容:

- patch apply 失敗時に conflict を分類する
- worktree 内の conflict marker を検出する
- conflict file の path を denylist / blockedPaths と照合する
- `context-shift`、`formatting-only`、`import-order` のような低リスク conflict だけ自動解消する
- 判断が必要な場合は `needs_human_input` checkpoint を作る
- Issue / PR に質問コメントを生成する
- `/resolve-conflict` で resume できる入力を保存する

質問コメントに含めるもの:

- conflict の発生場所
- 何と何が衝突しているか
- runner の推奨方針
- 人間が選べる選択肢
- resume 用 comment command または label

テスト:

- conflict marker を検出する
- blocked path の conflict を自動解消しない
- file 数上限を超える conflict を自動解消しない
- 判断が必要な conflict で質問コメント案を返す

### Step 8: Validation Runner

作るもの:

- `src/validation/validation-runner.ts`
- `src/util/exec-allowlisted.ts`

実装内容:

- config に定義された validation command のみ実行
- timeout
- stdout / stderr 要約
- exit code 判定

テスト:

- config 外 command を拒否する
- failed command の summary を返す

### Step 9: Orchestration

作るもの:

- `src/runner/run-once.ts`
- `src/runner/checkpoint.ts`
- `src/context/build-context.ts`
- `src/ai/ai-client.ts`

実装内容:

- pickup
- lock
- classify
- context build
- AI call
- output validation
- patch guard
- patch apply
- validation
- commit / push / PR
- label update
- checkpoint update

### Step 10: Task Planner

作るもの:

- `src/planner/task-planner.ts`

実装内容:

- `type:story` / `type:bug` Issue の task 分解 context を作る
- Repository Analyzer の結果を context に含める
- AI に task planning 用 schema を要求する
- task の粒度を config に照らして検査する
- BE / FE / package 境界をまたぐ task に split hint を付ける
- bug の場合は調査 task、修正 task、回帰テスト task に分けるか判断する
- `autoCreateIssues: false` の場合は Issue comment に task 案を出す
- `autoCreateIssues: true` の場合は task Issue を作成する

task output の初期 schema:

```json
{
  "parent_issue": 123,
  "summary": "分解方針",
  "tasks": [
    {
      "title": "task title",
      "body": "task body",
      "labels": ["type:task", "ai:ready", "risk:low"],
      "acceptance_criteria": ["完了条件"],
      "review_scope": "PRレビューで確認する範囲",
      "estimated_files": ["src/example.ts"],
      "risk_notes": []
    }
  ],
  "open_questions": []
}
```

### Step 11: Multi Role Reviewer

作るもの:

- `src/context/build-pr-review-context.ts`
- `src/review/multi-role-reviewer.ts`
- `src/review/review-output-schema.ts`

実装内容:

- PR diff と関連 Issue を取得する
- AI に review 用 schema を要求する
- PdM / PjM / Tech Lead / Engineer の観点を分ける
- finding の severity を検証する
- PR comment または review comment として投稿する
- `/review` comment command から実行できるようにする

review output の初期 schema:

```json
{
  "summary": "レビュー要約",
  "role_reviews": [
    {
      "role": "tech-lead",
      "summary": "観点別要約",
      "findings": []
    }
  ],
  "findings": [
    {
      "severity": "high",
      "file": "src/example.ts",
      "line": 10,
      "title": "問題の短い説明",
      "body": "具体的な指摘",
      "suggestion": "修正案"
    }
  ],
  "test_gaps": ["不足しているテスト"],
  "approval_notes": ["問題ないと判断した観点"]
}
```

### Step 12: Package Distribution

作るもの:

- package `bin` 設定
- npm publish 用 package metadata
- Homebrew formula template
- release build workflow

実装内容:

- `pnpm build` で `dist/cli.js` を生成する
- `label-ai-runner` command として実行できる
- npm package として公開できる形にする
- Homebrew formula から npm package または release tarball を install できる形にする

完了条件:

- `npm pack` が通る
- unpack 後に `label-ai-runner --help` が動く
- Homebrew formula の設計が docs にある

## MVP 完了条件

- `pnpm dev run-once --config config/runner.yaml` で 1 Issue を処理できる
- Node.js + pnpm で runner を起動できる
- Codex CLI または Claude Code CLI を provider adapter として起動できる
- AI には tool execution を渡さない
- LLM はコマンドを実行しない
- `risk:dangerous` は block される
- `risk:high` は patch 適用されない
- denylist path を含む patch は block される
- validation 失敗時に PR を作らない
- 成功時に PR が作成される
- checkpoint comment が更新される
- concurrency 設定に従って自動実行数を制御できる
- fresh clone から worktree を作って PR 作成まで進められる

## Phase 2 完了条件

- `type:story` / `type:bug` Issue に解決案をコメントできる
- `/split-tasks` で task 分解案を作れる
- task は `type:task` として 1 PR 単位の粒度になる
- repository structure から BE / FE / package 境界を読んで task を分けられる
- bug Issue に対して、リポジトリ内容に基づいた調査・修正・検証方針を提案できる
- PR 作成時に AI review comment を投稿できる
- PR comment の `/review` で再レビューできる
- allowlist 外 comment command は無視される
- conflict で悩みどころがある場合に Issue / PR へ質問コメントを出せる
- `/resolve-conflict` で conflict 解消 workflow を resume できる

## Phase 3 完了条件

- npm package として配布できる
- Homebrew formula で install できる
- bare repository cache から worktree を作れる
- 大きい repository でも clone cost を抑えられる

## 実装時の優先順位

最初に外部 API へ接続せず、純粋関数で検証できる部分から作る。

1. config schema
2. repository analyzer
3. concurrency manager
4. label classifier
5. comment command router
6. AI output schema
7. agent CLI adapter
8. patch guard
9. review output schema
10. task planning output schema
11. checkpoint formatter
12. GitHub client
13. checkout manager
14. worktree manager
15. conflict resolver
16. validation runner
17. run-once orchestration
18. task planner
19. multi role reviewer
20. package distribution

この順序にすると、危険な実行部分に入る前に安全性の中核をテストできる。
