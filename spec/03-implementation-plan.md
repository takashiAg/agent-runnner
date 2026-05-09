# 実装計画

## monorepo 構成

```txt
.
├── packages/runner
│   └── label-ai-runner CLI
├── apps/gh-pages
│   └── official site
└── spec
```

## package

`packages/runner`

```txt
label-ai-runner --help
```

主な modules:

- config loader
- label classifier
- comment command router
- repository analyzer
- agent CLI adapter
- patch guard
- conflict resolver
- validation runner
- GitHub client
- worktree manager

## 設定例

```yaml
repository: owner/name

ai:
  provider: codex-cli
  allowTools: false
  allowCommands: false
  output: json

concurrency:
  global: 2
  perRepository: 1

checkout:
  strategy: fresh-clone

patch:
  maxFiles: 12
  maxLines: 800

review:
  roles:
    - pdm
    - pjm
    - tech-lead
    - engineer
```

## フェーズ

### Phase 1: 安全な中核

- pnpm monorepo
- CLI
- config schema
- label classifier
- command router
- repository analyzer
- AI output schema
- patch guard
- conflict resolver
- tests

### Phase 2: GitHub workflow

- Issue pickup
- label lock
- checkpoint comment
- task planning comment
- PR review comment
- GitHub comment command handling

### Phase 3: 実装 runner

- repository checkout
- worktree creation
- agent CLI invocation
- patch apply
- validation
- commit / push / PR

### Phase 4: 配布

- npm package
- Homebrew formula
- GitHub Pages site
- release workflow

## 検証

```txt
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
