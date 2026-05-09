# Label Triggered AI Runner Spec

このディレクトリは、README の構想を実装可能な設計書へ分解したものです。

## ドキュメント構成

- [01-use-cases.md](./01-use-cases.md)
  - 想定ユースケース、対象ユーザー、処理対象、対象外を定義する。
- [02-policy-and-prohibitions.md](./02-policy-and-prohibitions.md)
  - AI と runner の責務分離、禁止事項、安全性ルールを定義する。
- [03-system-design.md](./03-system-design.md)
  - 全体アーキテクチャ、主要コンポーネント、状態遷移を定義する。
- [04-pnpm-implementation-plan.md](./04-pnpm-implementation-plan.md)
  - pnpm で実装するためのパッケージ構成、タスク分解、実装順序を定義する。
- [05-agent-cli-execution-model.md](./05-agent-cli-execution-model.md)
  - Codex / Claude Code CLI を runner から使う場合の権限分離、worktree、並列実行を定義する。
- [06-repository-analysis.md](./06-repository-analysis.md)
  - リポジトリ内容から作業単位、BE/FE 境界、bug 改修方針、issue 分解を決める方針を定義する。
- [07-review-roles.md](./07-review-roles.md)
  - PdM、PjM、テックリード、エンジニアの観点で Issue / PR をレビューする方針を定義する。
- [08-distribution-and-checkout.md](./08-distribution-and-checkout.md)
  - npm / Homebrew 配布、fresh clone、bare repository cache、worktree 運用を定義する。

## MVP の到達点

MVP では、GitHub Issue に `ai:ready` label が付いたときに runner が処理を開始し、AI から JSON patch を受け取り、検証に通った場合のみ PR を作成する。

AI は patch proposer / planner / reviewer としてのみ扱い、コマンド実行、git 操作、GitHub API 呼び出し、ファイル書き込みは行わない。
