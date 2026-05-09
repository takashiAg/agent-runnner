# Repository Analysis

## 目的

Issue 分解、bug 改修方針、実装 task の粒度を、リポジトリの実際の構造に基づいて決める。

単に Issue 本文だけを見るのではなく、workspace、package、BE / FE 境界、既存テスト、関連ファイルを読んだうえで、PR レビューしやすい単位に落とし込む。

## Repository Analyzer の責務

- package manager を検出する
- `pnpm-workspace.yaml` を検出する
- workspace package / app を列挙する
- BE / FE / shared / infra / docs の境界を推定する
- Issue label から area を推定する
- Issue body のキーワードから関連ファイル候補を探す
- bug Issue で見るべき source / test / config を提案する
- task が複数境界にまたがる場合に split hint を返す

## 境界の例

backend:

- `apps/api/**`
- `packages/server/**`
- `src/server/**`
- `routes/**`
- `controllers/**`
- `repositories/**`

frontend:

- `apps/web/**`
- `packages/ui/**`
- `src/components/**`
- `src/pages/**`
- `src/app/**`

shared:

- `packages/shared/**`
- `packages/types/**`
- `src/types/**`

infra:

- `infra/**`
- `.github/workflows/**`
- `terraform/**`
- `k8s/**`

docs:

- `docs/**`
- `README.md`
- `spec/**`

## Issue 分解方針

story は原則 task に分解する。

分解時に見るもの:

- ユーザー価値
- 受け入れ条件
- BE / FE の分離可否
- API contract の有無
- DB migration の有無
- UI 変更の有無
- テスト単位
- rollout / deploy risk

task は 1 PR で実装・レビューできる単位にする。

## bug 改修方針

bug Issue では、AI に直接 patch を作らせる前に、必要に応じて改修方針を作る。

方針に含めるもの:

- 再現条件
- 期待動作
- 実際の動作
- 原因候補
- 関連ファイル候補
- 調査手順
- 修正方針
- 回帰テスト観点
- task 分解案

## BE / FE 分割の判断

BE と FE の両方を触る場合は、以下を検討する。

- API contract 変更だけで独立 task にできるか
- FE 表示変更だけで独立 task にできるか
- shared type 更新を先行 task にできるか
- E2E test は別 task にした方がレビューしやすいか

同じ PR に含めてよい例:

- 小さな type 変更と、それに伴う 1 箇所の UI 修正
- bug fix と、その直近の unit test

分けるべき例:

- API schema 変更と複数画面の UI 更新
- DB migration と UI 変更
- 認証・権限変更と画面改修
- infra / deploy 設定と application code

## task 粒度の判定

初期目安:

- 1 task = 1 PR
- 変更ファイル数 12 以下
- patch 800 lines 以下
- 1 つの責務に閉じる
- reviewer が差分の意図を追える

上限を超える場合は、AI は patch 生成ではなく task 分解を提案する。

