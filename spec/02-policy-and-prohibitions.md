# Policy And Prohibitions

## 基本方針

このシステムでは、AI と runner の責務を明確に分離する。

AI は patch proposer / planner / reviewer であり、実行主体ではない。AI は runner から渡された text context を読み、schema に従った JSON output を返すだけにする。

runner は制御層であり、GitHub API、git 操作、patch 適用、検証、PR 作成、label 更新、checkpoint 保存を担当する。

Codex CLI や Claude Code CLI を使う場合も、CLI は AI provider adapter として runner が起動する。LLM 側に shell、git、filesystem write、network access の tool を渡してはならない。

## AI に許可しないこと

AI provider / agent には以下を許可しない。

- shell command の実行
- git command の実行
- package install
- test 実行
- build 実行
- network access
- GitHub API 呼び出し
- filesystem write
- secret / env の参照
- deploy
- DB 操作

AI には tool / command execution を渡さない。

## Agent CLI 利用時の制約

Codex CLI / Claude Code CLI を使う場合は、以下を守る。

- runner が CLI を子プロセスとして起動する
- CLI には runner が作った context file または stdin だけを渡す
- CLI には shell / git / filesystem write / network tool を許可しない
- CLI の作業ディレクトリは原則 repository root ではなく、一時 context directory にする
- CLI が返せるのは structured JSON output のみ
- CLI がファイルを書いた場合は失敗扱いにする
- CLI が command 実行を要求した場合は失敗扱いにする
- CLI timeout を設定する
- CLI stdout / stderr は secret scan してから checkpoint や comment に要約する

## Conflict 解消方針

runner は conflict を検出し、repository policy に従って自動解消を試みてもよい。

ただし、自動解消できるのは以下のような低リスクなものに限る。

- patch context のずれが小さく、同じ変更を再適用できる
- generated file や snapshot など、repo policy で自動再生成が許可されている
- format 変更だけの衝突
- import order のような機械的な衝突

自動解消してはいけないもの:

- business logic の分岐判断が必要
- public API contract の変更判断が必要
- DB migration の順序判断が必要
- auth / permission / security に関わる
- deleted file と modified file の衝突
- 同じ箇所に別々の意味の変更が入っている

判断が必要な場合、runner は `needs_human_input` 状態にして Issue / PR に質問コメントを残す。

AI は conflict 解消の方針案を返してよいが、git merge / rebase / checkout などの command は実行しない。実際の conflict 解消操作は runner だけが行う。

## AI Output の扱い

AI output は JSON のみ受け付ける。

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
- `tests_to_run` は参考情報としてのみ扱う
- runner は `tests_to_run` を直接実行しない
- `requires_human_approval = true` の場合、patch 適用前に停止する
- `block_reason` がある場合、Issue に理由をコメントして停止する

## runner が実行してよいこと

runner は以下を担当する。

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
- Issue comment
- label 更新
- checkpoint 保存
- Codex CLI / Claude Code CLI の起動
- 並列実行数の制御
- conflict 検出
- policy に沿った conflict 自動解消
- conflict 判断が必要な場合の Issue / PR comment 作成

## runner が自動実行しないこと

- 破壊的操作
- 本番操作
- secret 操作
- deploy
- production DB 操作
- `risk:dangerous` の処理
- `risk:high` の patch 自動適用
- AI output に含まれる command の実行
- Issue body に書かれた command の実行
- PR comment に書かれた command の実行

ただし、`/review` や `/split-tasks` のような GitHub comment command は shell command ではなく、runner が事前定義した workflow trigger として扱う。runner は allowlist された comment command だけを解釈し、任意の文字列や引数を OS command として実行しない。

## Comment Command 方針

PR comment / Issue comment で使える command は runner config の allowlist で定義する。

初期 command:

- `/review`
  - 対象 PR の AI review を実行する
- `/split-tasks`
  - 対象 Issue を story / bug に紐づく task に分解する
- `/resolve-conflict`
  - 人間が選んだ方針に基づいて conflict 解消 workflow を resume する

制約:

- comment command は shell command ではない
- command 名は完全一致で判定する
- 未定義 command は無視する
- command の任意引数は MVP では扱わない
- `/resolve-conflict` の詳細引数は Phase 2 以降で扱う
- command 実行者の権限を GitHub permission で確認する
- command の実行結果は Issue / PR comment に残す

## Patch 安全性要件

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

## denylist path

初期 denylist:

- `.env`
- `.env.*`
- `**/secrets/**`
- `**/*secret*`
- `.github/workflows/deploy-*`
- `infra/production/**`
- `db/production/**`

## Validation Command 方針

runner は repo ごとの config に定義された command のみ実行する。

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

重要事項:

- AI が提案した command は実行しない
- Issue body に書かれた command は実行しない
- PR comment に書かれた command は実行しない
- runner config の allowlist だけを実行する

## 並列実行方針

runner は複数 Issue / PR を並列に処理できる。ただし、並列数は config で固定する。

制約:

- 同じ Issue は同時に 1 run だけ処理する
- 同じ branch / worktree は同時に 1 run だけ使う
- repository ごとの最大並列数を超えない
- global の最大並列数を超えない
- rate limit と token 使用量を考慮して backoff する
- `ai:running` label と checkpoint を lock として扱う

初期値:

- global concurrency: 2
- per repository concurrency: 1
