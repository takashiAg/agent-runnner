# agent-runnner 設計

GitHub Issue / PR を起点に、AI が計画、task 分解、自動修正、観点別レビューを支援する runner。

AI はコマンドを実行しない。shell、git、GitHub API、network、filesystem write は runner だけが扱う。

## ドキュメント

- [01-product.md](./01-product.md)
  - 何を解決するアプリケーションか
- [02-architecture.md](./02-architecture.md)
  - runner、AI、GitHub、worktree の責務分離
- [03-implementation-plan.md](./03-implementation-plan.md)
  - pnpm monorepo での実装順序

## やらないこと

- LLM に command execution を渡さない
- 本番 deploy を自動化しない
- secret / credential / `.env` を触らない
- `risk:dangerous` を処理しない
- 判断が必要な conflict を勝手に解消しない
