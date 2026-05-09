# Agent CLI Execution Model

## 目的

Codex CLI や Claude Code CLI を使って実装提案を生成しつつ、LLM にはコマンド実行権限を渡さない。

runner は Node.js + pnpm で実装し、agent CLI は AI provider adapter として子プロセス起動する。worktree の作成、patch 適用、検証、commit、push、PR 作成は runner だけが行う。

## 原則

- LLM はコマンドを実行しない
- LLM は git を実行しない
- LLM は filesystem write をしない
- LLM は GitHub API を呼ばない
- LLM は network access しない
- runner が agent CLI を起動する
- runner が worktree を管理する
- runner が allowlist command だけを実行する

## 実行フロー

```txt
runner
  ↓
worktree / branch 作成
  ↓
context 生成
  ↓
Codex CLI / Claude Code CLI 起動
  - stdin または context file を渡す
  - tools disabled
  - commands disabled
  - output JSON only
  ↓
runner
  - JSON schema validation
  - patch safety check
  - patch apply
  - conflict detect / auto resolve
  - validation
  - commit / push / PR
```

## agent CLI に渡す入力

渡してよいもの:

- Issue title
- Issue body
- labels
- repository structure summary
- selected source files
- selected test files
- repository policy
- forbidden operations
- output schema

渡さないもの:

- GitHub token
- local env
- secret
- credential
- `.env`
- unrelated large files
- runner internal state のうち認証情報を含むもの

## agent CLI の出力

agent CLI は structured JSON のみ返す。

実装用:

```json
{
  "summary": "変更内容の短い説明",
  "risk_notes": [],
  "assumptions": [],
  "changed_files": [],
  "patch": "unified diff text",
  "tests_to_run": [],
  "requires_human_approval": false,
  "block_reason": null
}
```

task 分解用:

```json
{
  "summary": "分解方針",
  "tasks": [],
  "open_questions": []
}
```

PR review 用:

```json
{
  "summary": "レビュー要約",
  "findings": [],
  "test_gaps": [],
  "approval_notes": []
}
```

## 禁止 output

以下を含む output は拒否する。

- shell command 実行指示
- git command 実行指示
- package install 指示
- file write 指示
- deploy 指示
- DB 操作指示
- secret 参照要求
- JSON 以外の本文

## 並列実行

runner は agent CLI を複数並列で起動できる。

config:

```yaml
concurrency:
  global: 2
  perRepository: 1
```

制約:

- 同じ Issue は同時実行しない
- 同じ PR は同時 review しない
- 同じ worktree は同時利用しない
- provider rate limit 時は backoff する
- timeout した run は失敗として checkpoint に残す

## worktree 方針

各 task Issue は専用 branch / worktree で処理する。

例:

```txt
branch: ai/issue-123
worktree: .agent-runner/worktrees/issue-123
```

runner は worktree 上で patch を適用し、検証、commit、push、PR 作成を行う。

LLM は worktree に直接書き込まない。

## Conflict

patch 適用や base branch 更新で conflict が発生した場合、runner が conflict resolver を実行する。

LLM は conflict の解消方針案を返してよいが、git command を実行しない。

runner は低リスクな conflict だけ自動解消する。判断が必要な場合は Issue / PR に質問コメントを残し、`needs_human_input` として停止する。
