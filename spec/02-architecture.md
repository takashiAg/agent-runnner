# アーキテクチャ

## 原則

AI は planner / patch proposer / reviewer。実行主体ではない。

runner だけが以下を行う。

- GitHub API
- git 操作
- repository clone / worktree 作成
- patch 適用
- validation command 実行
- commit / push / PR 作成
- Issue / PR comment

## 処理フロー

```txt
GitHub Issue / PR
  ↓
runner
  - label / comment command を読む
  - repository を取得する
  - context を作る
  ↓
AI provider
  - context を読む
  - JSON を返す
  - command は実行しない
  ↓
runner
  - schema validation
  - safety check
  - patch apply / validation
  - comment / PR 作成
```

## AI provider

Codex CLI / Claude Code CLI は runner が子プロセスとして起動する。

ただし LLM には以下を許可しない。

- shell command
- git command
- filesystem write
- network access
- GitHub API
- secret / env 参照

AI output は JSON のみ。

## repository の扱い

checkout strategy:

- `fresh-clone`: MVP。実行ごとに clone する
- `bare-cache`: 大きい repo 向け。bare repo から worktree を作る
- `existing-local`: 開発用途

各 task は専用 worktree で処理する。

## 安全性

patch 適用前に確認する。

- unified diff である
- path が repository 内に収まる
- `..` / absolute path がない
- denylist に触れない
- binary patch ではない
- conflict marker がない
- max files / max lines を超えない

denylist 例:

- `.env`
- `.env.*`
- `**/secrets/**`
- `**/*secret*`
- `.github/workflows/deploy-*`
- `infra/production/**`
- `db/production/**`

## comment command

GitHub comment command は shell command ではない。runner の固定 workflow trigger。

- `/review`
- `/split-tasks`
- `/resolve-conflict`

allowlist 外は無視する。

## 並列実行

runner は並列実行できる。

初期値:

- global: 2
- per repository: 1

同じ Issue / PR / branch / worktree は二重実行しない。
