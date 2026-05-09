# Label Triggered AI 実装基盤 設計書

## Repository

このリポジトリは pnpm workspace の monorepo として構成する。

```txt
.
├── packages/runner
│   └── label-ai-runner CLI package
├── apps/gh-pages
│   └── GitHub Pages で公開する公式サイト
└── spec
    └── 設計書
```

主なコマンド:

```txt
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm dev:site
pnpm dev:runner -- --help
```

## 目的

GitHub Issue に特定の label が付いたら、AI が実装案と patch を生成し、runner が検証して PR を作る仕組みを作る。

この設計では、AI はコマンドを実行しない。  
AI は shell、git、GitHub API、network、filesystem write を直接使わない。AI の役割は、runner が渡した context を読んで、変更案と patch を返すことに限定する。

## 基本方針

- 入口は GitHub Issue の label とする
- AI 実行対象は明示的に label が付いた issue だけにする
- AI は「patch proposer」として扱う
- コマンド実行、git 操作、検証、PR 作成は runner だけが行う
- runner が実行できるコマンドは allowlist で固定する
- 破壊的操作、本番操作、secret 操作は自動実行しない
- 失敗時は issue に理由をコメントして止める
- resume できるよう checkpoint を残す

## 全体像

```txt
GitHub Issue
  ↓
label: ai:ready
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
  - patch を返す
  - コマンドは実行しない
  ↓
runner
  - patch 検査
  - patch 適用
  - allowlist された検証コマンド実行
  - commit / push
  - PR 作成
  - issue comment / label 更新
```

## Label 設計

最小構成では label だけで制御する。

### Trigger

- `ai:ready`
  - runner が pickup する対象

### Lock / State

- `ai:running`
  - runner が処理中

- `ai:failed`
  - AI 生成、patch 適用、検証のいずれかで失敗

- `ai:blocked`
  - 仕様不足、危険操作、権限不足、既存 worktree 不整合などで停止

- `ai:pr-created`
  - PR 作成済み

- `ai:needs-split`
  - task が大きすぎるため分割が必要

### Level / Risk

- `ai:level-0`
  - 相談・調査のみ。コード変更しない

- `ai:level-1`
  - patch 生成まで。PR は作らない

- `ai:level-2`
  - patch 適用、検証、PR 作成まで許可

- `ai:level-3`
  - 複数 agent workflow を使う候補。ただし AI はコマンド実行しない

- `risk:low`
  - 自動 PR 可

- `risk:medium`
  - 自動 PR 可。ただし検証を厚くする

- `risk:high`
  - patch 生成まで。人間承認後に runner が適用

- `risk:dangerous`
  - plan のみ。patch 適用しない

### 任意の補助 label

- `area:frontend`
- `area:backend`
- `area:docs`
- `type:bug`
- `type:task`
- `type:chore`
- `needs:human-approval`

## Pickup 条件

runner は以下をすべて満たす issue だけを処理する。

- open issue
- `ai:ready` が付いている
- `ai:running` が付いていない
- `ai:blocked` が付いていない
- `ai:pr-created` が付いていない
- `risk:dangerous` が付いていない
- 対象 repository の allowlist に含まれている

`risk:high` または `needs:human-approval` が付いている場合は、原則として patch 生成までで止める。

## AI が絶対にやらないこと

AI provider / agent には以下を許可しない。

- shell command の実行
- git command の実行
- package install
- test 実行
- build 実行
- network access
- GitHub API 呼び出し
- file write
- secret / env の参照
- deploy
- DB 操作

AI は runner から渡された text context だけを入力にして、structured output を返す。

## Runner だけがやること

runner は制御層として以下を担当する。

- GitHub issue / label の取得
- `ai:running` label の付与
- branch / worktree の作成
- context file の作成
- AI provider の呼び出し
- AI output の schema validation
- patch の安全性検査
- patch 適用
- allowlist された検証コマンドの実行
- commit
- push
- PR 作成
- issue comment
- label 更新
- checkpoint 保存

runner が実行するコマンドは固定する。AI output に含まれる command は無視するか、schema validation で拒否する。

## AI Output Schema

AI は JSON だけを返す。

```json
{
  "summary": "変更内容の短い説明",
  "risk_notes": ["注意点"],
  "assumptions": ["前提"],
  "changed_files": ["path/to/file.ts"],
  "patch": "unified diff text",
  "tests_to_run": ["pnpm test:contracts"],
  "requires_human_approval": false,
  "block_reason": null
}
```

制約:

- `patch` は unified diff のみ
- `changed_files` は repository 内の相対 path のみ
- absolute path は禁止
- `..` を含む path は禁止
- `.env`、secret、credential、deploy 設定は原則変更禁止
- `tests_to_run` は参考情報。runner はこの値を直接実行しない
- `requires_human_approval = true` の場合、runner は patch 適用前に停止する
- `block_reason` がある場合、runner は issue にコメントして停止する

## Patch 安全性検査

runner は patch 適用前に以下を確認する。

- unified diff として parse できる
- 対象 path が repository 内に収まる
- denylist path に触れていない
- binary file を変更しない
- lockfile 変更を許可する task か確認する
- migration / deploy / secret 系 path を変更しない
- conflict marker を含まない
- patch サイズが上限以下
- 変更 file 数が上限以下

denylist 例:

- `.env`
- `.env.*`
- `**/secrets/**`
- `**/*secret*`
- `.github/workflows/deploy-*`
- `infra/production/**`
- `db/production/**`

## Validation Command Allowlist

runner は repo ごとに allowlist された検証だけを実行する。

例:

```txt
git diff --check
conflict marker scan
pnpm test:contracts
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

重要:

- AI が提案した command は実行しない
- issue body に書かれた command も実行しない
- PR comment に書かれた command も実行しない
- runner config にある allowlist だけを実行する

## 実行フロー

### 1. Poll

runner が定期的に GitHub issue を検索する。

条件:

```txt
is:issue is:open label:ai:ready -label:ai:running -label:ai:blocked -label:ai:pr-created
```

### 2. Lock

対象 issue に `ai:running` を付ける。  
同時に checkpoint comment を作る。

### 3. Classify

label から AI level と risk を読む。

- `risk:dangerous`: block
- `risk:high`: plan / patch generation only
- `ai:level-0`: comment only
- `ai:level-1`: patch generation only
- `ai:level-2`: patch apply + validation + PR
- `ai:level-3`: workflow runner を使う候補

### 4. Prepare Worktree

runner が専用 branch / worktree を作る。

例:

```txt
branch: ai/issue-123
worktree: .agent-runner/worktrees/issue-123
```

### 5. Build Context

runner が AI に渡す context を作る。

含めるもの:

- issue title
- issue body
- labels
- repository policy
- relevant docs
- selected source files
- test policy
- forbidden operations
- output schema

含めないもの:

- secret
- local env
- token
- private credential
- unrelated large files

### 6. Ask AI For Patch

runner が AI provider を呼ぶ。  
この呼び出しでは AI に tool / command execution を渡さない。

AI は JSON output を返すだけ。

### 7. Validate AI Output

runner が schema と patch を検査する。

失敗したら:

- `ai:failed` を付ける
- `ai:running` を外す
- issue に failure reason をコメントする

### 8. Apply Patch

`ai:level-2` かつ risk が許容範囲の場合だけ patch を適用する。  
`ai:level-1`、`risk:high`、`needs:human-approval` では patch を適用せず、issue に patch summary をコメントして止める。

### 9. Validate

runner が allowlist された検証コマンドを実行する。

失敗したら:

- PR は作らない
- branch / worktree は残す
- issue に失敗 command と要約をコメントする
- `ai:failed` を付ける

### 10. Commit / Push / PR

検証が通ったら runner が commit / push / PR 作成を行う。

PR title:

```txt
#<issue-number>: <issue-title>
```

PR body には以下を含める。

- issue link
- AI generated summary
- validation result
- risk notes
- human review points

### 11. Complete

成功時:

- `ai:running` を外す
- `ai:ready` を外す
- `ai:pr-created` を付ける
- checkpoint を `pr_created` に更新する

## Failure Handling

### AI output invalid

- `ai:failed`
- failure comment
- patch は適用しない

### Patch unsafe

- `ai:blocked`
- unsafe path / reason を comment
- patch は適用しない

### Validation failed

- `ai:failed`
- failed command summary を comment
- worktree は残す

### Task too large

AI が `requires_human_approval` または `block_reason` で分割を提案する。  
runner は `ai:needs-split` を付ける。

### Existing PR

同じ issue の branch / PR が存在する場合:

- duplicate PR は作らない
- `ai:pr-created` に寄せる
- checkpoint を更新する

## Checkpoint

issue に runner checkpoint comment を 1 つ持つ。

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

state:

- `running`
- `ai_output_failed`
- `patch_blocked`
- `validation_failed`
- `needs_human_approval`
- `needs_split`
- `pr_created`

## Human Approval

人間承認が必要な場合、runner は patch を適用せずに issue comment で止める。

comment に含めるもの:

- AI summary
- changed files
- risk notes
- patch artifact への参照
- 次に人間が付ける label

承認 label の案:

- `ai:approved-to-apply`
- `ai:approved-to-pr`

ただし MVP では、承認 flow は作らず `risk:high` は常に block でもよい。

## Agent Workflow 層

MVP では runner から AI provider を直接呼ぶ。

```txt
runner
  ↓
AI provider without tools
  ↓
JSON patch output
```

発展形では TAKT などの workflow runner を Agent workflow 層に入れられる。

```txt
runner
  ↓
Agent workflow runner
  - planner
  - patch proposer
  - reviewer
  ↓
JSON patch output
```

この場合も、AI に command execution は渡さない。  
workflow runner を使う場合でも、実行できるのは runner 側の固定処理だけにする。

## MVP Scope

最初に作る範囲。

- `ai:ready` label の issue pickup
- `ai:running` lock
- worktree 作成
- context 生成
- AI から JSON patch を取得
- patch schema validation
- patch safety check
- patch apply
- fixed validation command 実行
- commit / push / PR 作成
- issue comment
- label 更新
- checkpoint

MVP でやらないこと。

- 複数 agent workflow
- 自動 split issue 作成
- high risk task の自動適用
- production deploy
- secret 操作
- AI 提案 command の実行

## 設定ファイル案

```yaml
repository: owner/name

labels:
  trigger: ai:ready
  running: ai:running
  failed: ai:failed
  blocked: ai:blocked
  prCreated: ai:pr-created
  needsSplit: ai:needs-split

branch:
  prefix: ai/issue-

worktree:
  root: .agent-runner/worktrees

ai:
  mode: patch-only
  allowTools: false
  output: json

patch:
  maxFiles: 12
  maxLines: 800
  denylist:
    - .env
    - .env.*
    - "**/secrets/**"
    - ".github/workflows/deploy-*"

validation:
  commands:
    - git diff --check
    - pnpm test:contracts
    - pnpm lint
    - pnpm typecheck
    - pnpm test
    - pnpm build
```

## 未決事項

1. trigger label を `ai:ready` にするか別名にするか
2. `risk:high` を patch 生成までにするか、承認 label で適用可能にするか
3. patch artifact を issue comment に直接載せるか、file として保存するか
4. validation command を repo 固定にするか、area label ごとに変えるか
5. PR 作成後に `ai:ready` を外すか残すか
6. TAKT を MVP から入れるか、直接 AI provider 呼び出しで始めるか
