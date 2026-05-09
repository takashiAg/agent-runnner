# System Design

## 全体像

```txt
GitHub Issue
  ↓
label: ai:ready / ai:plan / ai:split-tasks
comment: /split-tasks
  ↓
runner
  - issue pickup
  - lock
  - worktree / branch 作成
  - context 収集
  ↓
AI patch proposer
  - context を読む
  - 変更方針を書く
  - JSON patch output を返す
  - コマンドは実行しない
  - Codex CLI / Claude Code CLI を使う場合も tool は持たない
  ↓
runner
  - output schema validation
  - patch safety check
  - patch apply
  - conflict detect / auto resolve
  - validation command 実行
  - commit / push
  - PR 作成
  - issue comment / label 更新
```

PR review workflow は Issue workflow と入口が異なる。

```txt
GitHub Pull Request
  ↓
opened / synchronize / comment: /review
  ↓
runner
  - PR context 収集
  - diff 収集
  - policy 収集
  ↓
AI multi-role reviewer
  - diff を読む
  - PdM / PjM / Tech Lead / Engineer 観点を返す
  - コマンドは実行しない
  ↓
runner
  - output schema validation
  - PR comment / review comment 投稿
```

## コンポーネント

### Runner CLI

Node.js + pnpm script から実行する CLI。

責務:

- config 読み込み
- GitHub issue polling
- GitHub PR polling
- comment command pickup
- Issue lock
- concurrency control
- workflow orchestration
- checkpoint 更新

### GitHub Client

GitHub API を扱う adapter。

責務:

- Issue 検索
- PR 検索
- label 操作
- comment 作成 / 更新
- branch / PR 存在確認
- PR 作成
- PR diff 取得
- PR review comment 作成

### Worktree Manager

git 操作を扱う adapter。

責務:

- repository clone
- bare repository cache の管理
- branch 作成
- worktree 作成
- patch 適用
- conflict 状態の検出
- diff 確認
- commit / push

### Conflict Resolver

patch 適用、base branch 更新、PR branch 更新で発生した conflict を扱う。

責務:

- conflict file の検出
- conflict marker の検出
- 自動解消できる conflict の分類
- policy に沿った自動解消
- AI に conflict context を渡して方針案を取得
- 判断が必要な conflict の質問コメント生成
- human input 後の resume

### Agent CLI Adapter

Codex CLI / Claude Code CLI を AI provider として起動する adapter。

責務:

- provider 種別の切り替え
- context file / stdin の受け渡し
- no-tool / no-command mode の強制
- timeout
- stdout / stderr 取得
- structured JSON output の抽出
- CLI が command 実行や file write を行っていないことの検査

### Context Builder

AI に渡す context を構築する。

含めるもの:

- issue title
- issue body
- labels
- repository policy
- relevant docs
- selected source files
- repository structure summary
- workspace / package summary
- BE / FE boundary summary
- test policy
- forbidden operations
- output schema

PR review で含めるもの:

- PR title
- PR body
- PR diff
- linked issue
- labels
- validation result
- repository review policy

含めないもの:

- secret
- local env
- token
- private credential
- unrelated large files

### Repository Analyzer

対象 repository の構造を読み、Issue / PR の作業単位を決めるための context を作る。

責務:

- package manager と workspace 構成の検出
- monorepo package / app の検出
- BE / FE / shared / infra / docs の境界推定
- test command 候補の収集
- ownership / area label の推定
- bug に関連する source / test / config の候補抽出
- task が 1 PR に収まるかの粒度評価

### AI Client

tool execution なしで AI provider を呼び出す。

責務:

- prompt / context の送信
- JSON response の取得
- response timeout の扱い

### Command Router

GitHub comment command を workflow に変換する。

責務:

- allowlist command の判定
- `/review` の PR review workflow 起動
- `/split-tasks` の task split workflow 起動
- `/resolve-conflict` の conflict resume workflow 起動
- command 実行者の permission check
- 未定義 command の無視

### Task Planner

story / bug Issue を task に分解する。

責務:

- story / bug の目的整理
- task 候補生成
- task 粒度チェック
- task Issue 作成案の生成
- 設定に応じた task Issue 自動作成
- BE / FE / package 境界に基づく分解
- bug の調査 task と修正 task の分離

### Multi Role Reviewer

PR diff を AI に渡して、PdM / PjM / Tech Lead / Engineer の観点別 review output を作る。

責務:

- PR context の構築
- review output schema validation
- role ごとの finding 分類
- finding の重要度分類
- PR comment / review comment への変換

### Output Validator

AI output を schema validation する。

責務:

- JSON parse
- required field validation
- path validation
- `requires_human_approval` / `block_reason` 判定

### Patch Guard

patch 適用前の安全性検査を行う。

責務:

- unified diff parse
- path traversal 検出
- denylist path 検出
- binary file 変更検出
- conflict marker 検出
- patch size / changed files 上限確認

### Validation Runner

repo config に定義された allowlist command を実行する。

責務:

- command 実行
- stdout / stderr 要約
- exit code 判定
- timeout

### Concurrency Manager

自動実行の並列数を制御する。

責務:

- global concurrency limit
- repository concurrency limit
- same issue / branch / worktree の二重実行防止
- queue 管理
- rate limit backoff

### Distribution

CLI は npm package と Homebrew formula で配布できるようにする。

想定 binary:

- `label-ai-runner`

配布時も実装言語は Node.js とし、npm package の `bin` と Homebrew formula から同じ CLI entrypoint を呼ぶ。

## 状態遷移

```txt
ready
  ↓
running
  ├─ ai_output_failed
  ├─ patch_blocked
  ├─ needs_human_approval
  ├─ needs_split
  ├─ needs_human_input
  ├─ validation_failed
  └─ pr_created
```

並列実行中でも、各 Issue / PR は独立した checkpoint を持つ。同じ Issue に対する二重実行は `ai:running` と checkpoint で防ぐ。

## Label 状態

### Trigger

- `ai:ready`
- `ai:plan`
- `ai:split-tasks`

### Processing

- `ai:running`

### Terminal

- `ai:failed`
- `ai:blocked`
- `ai:pr-created`
- `ai:needs-split`
- `ai:needs-human-input`

## Level

- `ai:level-0`
  - comment only
- `ai:level-1`
  - patch generation only
- `ai:level-2`
  - patch apply + validation + PR
- `ai:level-3`
  - future workflow runner candidate

## Type

- `type:story`
  - ユーザー価値や業務フローを表す Issue
- `type:bug`
  - 不具合を表す Issue
- `type:task`
  - 1 PR で実装・レビューできる単位の Issue

## Risk

- `risk:low`
  - auto PR allowed
- `risk:medium`
  - auto PR allowed with stronger validation
- `risk:high`
  - patch generation only
- `risk:dangerous`
  - block

## Comment Commands

- `/review`
  - PR review workflow を起動する
- `/split-tasks`
  - Issue task split workflow を起動する
- `/resolve-conflict`
  - conflict 解消方針がコメントされた後に resume する

comment command は shell command ではない。runner が固定 workflow に map できるものだけを処理する。

## Checkpoint

Issue に runner checkpoint comment を 1 つ持つ。

識別子:

```html
<!-- label-triggered-ai-runner-checkpoint:v1 -->
```

記録する内容:

- state
- issue number
- labels
- branch
- worktree
- PR URL
- AI level
- risk
- last failure reason
- validation summary
- updated at
