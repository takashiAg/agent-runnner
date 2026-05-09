# Use Cases

## 目的

GitHub Issue や Pull Request に明示的な label または comment command を付けることで、AI が issue 整理、解決案の提案、task 分解、実装 patch 提案、PR レビューを支援できるようにする。

この仕組みは、AI にリポジトリ操作権限を渡さず、runner が制御層としてすべての実行を管理する前提で設計する。

## 主な利用者

- Issue を起票する開発者
- AI 実装を許可するメンテナー
- 生成された PR をレビューするレビュアー
- runner を運用するリポジトリ管理者

## 主要ユースケース

### コーディング準備フェーズ

`type:story` / `type:bug` が付いた Issue は、いきなり実装に入らず、まずコーディング準備フェーズとして扱う。

このフェーズには 2 つの出力がある。

- 解決案作成
  - 何をどう直すか、どこを見るべきか、未決事項は何かを整理する
- task 分解
  - 実装・レビューできる 1 PR 単位の task Issue に落とす

つまり、UC-01 は「方針を決める」、UC-02 は「作業単位に切る」。

### UC-01: story / bug Issue の解決案作成

開発者が GitHub Issue を作成し、`type:story` または `type:bug` label を付ける。必要に応じて `ai:ready` や `ai:level-0` を付ける。

runner は Issue の title、body、label、関連ファイル、repository policy を context として AI に渡す。AI は実装に入る前に、解決方針、影響範囲、確認すべき前提、想定 task を Issue comment として提案する。

bug の場合は、runner がリポジトリ内の関連コード、テスト、過去の変更、ディレクトリ構造を context として集める。AI はその context をもとに、原因候補、調査順、修正方針、回帰テスト方針を提案する。

期待結果:

- Issue に解決案がコメントされる
- 実装前に人間が方向性を確認できる
- 仕様不足がある場合は質問や不足情報が明示される
- bug の場合は、再現条件、原因候補、修正方針、テスト観点が整理される
- この時点では task Issue を作成しなくてもよい

### UC-02: story / bug Issue の task 分解

UC-01 の解決案をもとに、Issue comment または label で task 分解を依頼する。例として、Issue に `ai:split-tasks` label を付ける、または comment に `/split-tasks` を書く。

runner は対象 Issue の内容を AI に渡し、AI は story または bug に紐づく複数の task Issue 案を生成する。runner は設定に応じて、task Issue を自動作成するか、作成案を comment に出す。

task は PR レビューが簡単な範囲に収める。具体的には、1 task が 1 PR に対応し、レビュアーが差分の意図を短時間で追える粒度を目安にする。

runner はリポジトリ構造を読み、BE / FE / shared / infra / docs などの境界を推定する。モノレポの場合は、対象 package や app の単位を推定し、task が複数領域に広がりすぎないように分解する。

期待結果:

- story / bug Issue に紐づく task 案が生成される
- task は小さく、独立して実装・レビューしやすい単位になる
- 各 task に目的、完了条件、想定変更範囲、リスクが含まれる
- BE と FE を分けた方がよい場合は別 task になる
- モノレポでは package / app / workspace 単位が task に明記される
- 必要なら `type:task` Issue が作成される

### UC-02a: Issue 分解の相談支援

開発者が大きめの Issue に `/split-tasks` をコメントする、または `ai:split-tasks` label を付ける。

runner はリポジトリの構成、既存の実装パターン、関連テスト、境界となる package を読み、AI に issue 分解案を作らせる。AI は実装順序、依存関係、各 task の完了条件を返す。

期待結果:

- 親 Issue に分解案がコメントされる
- task ごとの実装対象とレビュー対象が明確になる
- 先に調査すべき task と実装 task が分かれる
- 分解が難しい場合は未決事項が列挙される

### UC-02b: リポジトリ内容に基づく bug 改修方針作成

開発者が bug Issue に `type:bug` と `ai:plan` を付ける。

runner は bug の説明だけでなく、関連しそうなコード、テスト、ログ断片、設定、routing、API schema、UI コンポーネントなどを context として収集する。AI はその情報から、原因候補、修正対象、検証方法、分割すべき task を提案する。

期待結果:

- bug の回収方針が Issue にコメントされる
- どのファイルや package を見るべきかが明示される
- 修正 task とテスト task が必要に応じて分かれる
- すぐ実装に入るべきか、先に調査 task を切るべきか判断できる

### UC-03: task Issue の自動 PR 作成

開発者またはメンテナーが Issue に `ai:ready`、`ai:level-2`、`risk:low` を付ける。

runner は Issue を pickup し、専用 branch / worktree を作成する。AI は context を読んで JSON patch を返す。runner は patch を検査し、allowlist された検証コマンドを実行し、成功した場合に PR を作成する。

実装時に Codex CLI または Claude Code CLI を使う場合でも、CLI は runner の子プロセスとして起動されるだけであり、LLM にコマンド実行権限は渡さない。AI は JSON patch を返し、worktree 上での patch 適用、検証、commit、push、PR 作成は runner が行う。

期待結果:

- Issue に処理状況がコメントされる
- PR が作成される
- Issue に `ai:pr-created` が付く

### UC-04: 中リスク Issue の厚めの検証付き PR 作成

Issue に `risk:medium` が付いている場合でも、自動 PR 作成は許可する。ただし runner は repo policy に従って、より広い validation command set を実行する。

期待結果:

- `risk:low` より多い検証が実行される
- 検証に失敗した場合は PR を作成しない

### UC-05: 高リスク Issue の patch 提案のみ

Issue に `risk:high` または `needs:human-approval` が付いている場合、runner は AI から patch を取得しても自動適用しない。

期待結果:

- Issue comment に summary、changed files、risk notes、approval の次手順が記録される
- patch は適用されない
- PR は作成されない

### UC-06: 相談・調査のみ

Issue に `ai:level-0` が付いている場合、AI はコード変更を提案せず、調査結果や実装方針だけを返す。

期待結果:

- Issue に調査結果コメントが追加される
- branch / worktree / PR は作成されない

### UC-07: patch 生成まで

Issue に `ai:level-1` が付いている場合、AI は patch を生成するが、runner は patch を適用しない。

期待結果:

- Issue に patch summary がコメントされる
- 人間が内容を確認できる
- PR は作成されない

### UC-08: タスクが大きすぎる場合の停止

AI が `requires_human_approval` または `block_reason` で、タスク分割が必要だと判断した場合、runner は処理を停止する。

期待結果:

- `ai:needs-split` が付く
- Issue に分割が必要な理由がコメントされる

### UC-09: 既存 PR がある場合の重複防止

同じ Issue 番号に対応する branch または PR が既に存在する場合、runner は重複 PR を作らない。

期待結果:

- 既存 PR に checkpoint を寄せる
- `ai:pr-created` を付ける
- 新規 PR は作成しない

### UC-10: PR 作成時の観点別レビュー

PR が作成または更新されたとき、runner は PR diff、関連 Issue、repository policy、テスト結果を context として AI に渡す。AI は PdM、PjM、テックリード、エンジニアの観点でレビュー結果を structured output として返す。

runner は AI の結果を PR comment または GitHub review comment として投稿する。

期待結果:

- PR に観点別レビューコメントが残る
- PdM 観点でユーザー価値や受け入れ条件を確認できる
- PjM 観点でスコープ、依存関係、リリースリスクを確認できる
- テックリード観点で設計、保守性、アーキテクチャ影響を確認できる
- エンジニア観点で実装、テスト、バグリスクを確認できる
- 重大な懸念がある場合は request changes 相当の状態にできる
- 問題がない場合も確認済みの観点が記録される

### UC-11: PR comment command による観点別レビュー実行

レビュアーまたは開発者が PR comment に `/review` を書く。

runner は comment command として `/review` を検出し、対象 PR の最新 diff を AI に渡して観点別レビューを実行する。これは shell command ではなく、GitHub comment を trigger とする runner の固定 workflow として扱う。

期待結果:

- PR に PdM / PjM / テックリード / エンジニア観点の comment が追加される
- `/review` を書いたユーザーと実行結果が trace できる
- allowlist された comment command 以外は無視される

### UC-12: CLI ツールとして配布して利用する

利用者は npm または Homebrew で runner CLI をインストールする。

例:

```txt
npm install -g label-triggered-ai-runner
brew install label-triggered-ai-runner
```

期待結果:

- clone しなくても CLI を利用できる
- `label-ai-runner --help` が動く
- config file を指定して GitHub repository に対して実行できる

### UC-13: 実行ごとに repository を取得して worktree で処理する

runner は対象 repository を実行時に取得し、専用 worktree 上で patch 適用、検証、PR 作成を行う。

初期方針では fresh clone を優先する。repository が大きい場合は bare repository cache を作り、そこから worktree を切る方式も選べるようにする。

期待結果:

- 実行環境に対象 repository が事前 clone されていなくても動く
- 各 task は独立した worktree で処理される
- 大きい repository では bare repository cache で clone cost を下げられる

### UC-14: conflict の自動解消と人間への確認

runner が patch 適用、base branch 更新、または PR branch rebase / merge の過程で conflict を検出する。

runner は安全に自動解消できる conflict だけを解消する。判断が必要な conflict の場合は、Issue または PR に自動コメントし、人間に「どちらの方針で進めるか」を確認して停止する。

期待結果:

- 単純な conflict は runner が自動解消して検証まで進める
- 解消に判断が必要な conflict は勝手に解消しない
- Issue / PR に conflict の場所、選択肢、推奨方針、次に付ける label または comment command が投稿される
- 人間の回答後に resume できる

## Issue 種別

### story

ユーザー価値や業務フローを表す Issue。通常はそのまま実装せず、複数の task に分解する。

期待される出力:

- 解決方針
- task 分解案
- 受け入れ条件
- リスク
- 未決事項

### bug

不具合を表す Issue。再現条件、期待動作、実際の動作、影響範囲を整理し、必要なら調査 task と修正 task に分ける。

期待される出力:

- 原因候補
- 調査手順
- 修正方針
- 回帰テスト観点
- task 分解案

### task

実装可能な最小単位の Issue。原則として 1 task は 1 PR に対応する。

期待される粒度:

- 変更範囲が明確
- 完了条件が明確
- PR review が簡単
- 依存 task が少ない
- production / secret / deploy 操作を含まない

## task 粒度の目安

task は「実装がすぐ終わる」ことよりも、「PR レビューが簡単で、安全に merge 判断できる」ことを優先する。

初期目安:

- 1 task = 1 PR
- 変更ファイル数は 12 files 以下を目安にする
- patch は 800 lines 以下を目安にする
- 1 つの責務または 1 つの bug fix に閉じる
- DB migration、deploy、secret 操作は別 task に分け、原則自動化対象外にする
- BE と FE の両方を触る場合は、API contract 変更 task と UI 反映 task に分けられるかを優先して検討する
- モノレポでは package / app / workspace をまたぐ変更を避け、またぐ場合は理由を task に明記する

この数値は初期値であり、repository policy で調整可能にする。

## 処理対象条件

runner は以下をすべて満たす Issue だけを処理する。

- open issue
- `ai:ready` が付いている
- `ai:running` が付いていない
- `ai:blocked` が付いていない
- `ai:pr-created` が付いていない
- `risk:dangerous` が付いていない
- repository allowlist に含まれている

Issue 整理や task 分解だけを行う workflow では、`ai:ready` の代わりに `ai:plan`、`ai:split-tasks`、または `/split-tasks` comment command を trigger にできる。

## 対象外

- 本番 deploy
- DB production 操作
- secret 更新
- credential 更新
- 大規模リファクタリング
- 複数 Issue をまたぐ実装変更
- repository policy が未定義の repo
- human approval が必要だが承認 flow が未実装の作業
