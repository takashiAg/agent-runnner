# プロダクト

## 目的

`agent-runnner` は、GitHub Issue / PR workflow に AI を組み込む Node.js CLI。

Issue を整理し、実装しやすい task に分け、worktree 上で patch を検証し、PR まで進める。PR では PdM、PjM、Tech Lead、Engineer の観点でレビュー支援する。

## 主なユースケース

### 1. Issue の方針整理

`type:story` / `type:bug` の Issue に対して、実装前の解決方針をコメントする。

出力:

- 何を解決するか
- どのコードを見るべきか
- 未決事項
- bug の原因候補
- 検証方針

### 2. task 分解

story / bug を、1 PR でレビューしやすい `type:task` に分解する。

分解時は repository を読み、BE / FE / shared / infra / docs、monorepo package 境界を考慮する。

### 3. patch 提案

`ai:ready` が付いた task Issue から専用 worktree を作り、AI に patch を提案させる。

runner は patch を検査し、allowlist された検証だけを実行する。検証が通った場合だけ commit / push / PR 作成を行う。

### 4. 観点別レビュー

PR に対して以下の観点をコメントする。

- PdM: ユーザー価値、受け入れ条件
- PjM: スコープ、依存関係、リリースリスク
- Tech Lead: 設計、保守性、境界
- Engineer: 実装、テスト、バグリスク

### 5. conflict 対応

runner は低リスク conflict だけ自動解消する。

判断が必要な場合は Issue / PR に質問コメントを残し、`ai:needs-human-input` として停止する。

## 主な label

- `type:story`
- `type:bug`
- `type:task`
- `ai:ready`
- `ai:plan`
- `ai:split-tasks`
- `ai:running`
- `ai:failed`
- `ai:blocked`
- `ai:pr-created`
- `ai:needs-human-input`
- `risk:low`
- `risk:medium`
- `risk:high`
- `risk:dangerous`
