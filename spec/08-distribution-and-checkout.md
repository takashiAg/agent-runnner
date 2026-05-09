# Distribution And Checkout

## 目的

runner を npm と Homebrew で配布し、利用者が repository を clone せずに CLI として使えるようにする。

対象 repository の取得は runner が行い、fresh clone または bare repository cache から worktree を作る。

## 配布方式

### npm

想定:

```txt
npm install -g label-triggered-ai-runner
```

binary:

```txt
label-ai-runner
```

package 条件:

- `type: module`
- `bin` に `dist/cli.js` を指定する
- `prepack` で build する
- config example を package に含める

### Homebrew

想定:

```txt
brew install label-triggered-ai-runner
```

方式:

- npm package を wrap する
- または GitHub release tarball を install する

Homebrew formula は Phase 3 で整備する。

## Repository Checkout Strategy

### fresh-clone

毎回 repository を clone する。

利点:

- 状態が分かりやすい
- cache 破損の影響を受けにくい
- MVP で実装しやすい

欠点:

- 大きい repository では遅い
- network と disk cost が大きい

### bare-cache

repository ごとに bare repository を cache し、run ごとに fetch して worktree を切る。

利点:

- clone cost を下げられる
- 大きい repository でも現実的
- 複数 task の並列実行と相性がよい

欠点:

- cache 管理が必要
- fetch / prune / lock の設計が必要
- cache 破損時の recovery が必要

### existing-local

既存 local repository を使う。

利点:

- 開発時に便利

欠点:

- ユーザーの作業ツリーと干渉しやすい
- daemon / CI 運用では非推奨

## 初期方針

MVP は `fresh-clone` を実装する。

Phase 3 で `bare-cache` を追加する。

config:

```yaml
checkout:
  strategy: fresh-clone
  cacheRoot: .agent-runner/cache
  cloneRoot: .agent-runner/repos
  bareRepositoryCache: false
  shallowClone: false
  fetchDepth: 0
```

## Worktree

各 task は専用 worktree で処理する。

```txt
.agent-runner/worktrees/issue-123
```

runner は worktree 上でのみ patch 適用、validation、commit を行う。

PR 作成後、worktree を残すか削除するかは config で制御する。

