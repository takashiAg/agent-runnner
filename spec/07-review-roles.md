# Review Roles

## 目的

PR に対する AI review は、単にコード差分を指摘するだけではなく、PdM、PjM、テックリード、エンジニアが見る観点を分けて出す。

GitHub 上では PR comment または review comment として投稿するが、内容は役割別の意思決定支援として扱う。

## Role

### PdM

見る観点:

- ユーザー価値
- 受け入れ条件との一致
- 仕様漏れ
- UX 上の違和感
- メトリクスや利用者影響

出力例:

- 受け入れ条件を満たしているか
- 仕様確認が必要な点
- ユーザーに見える変更のリスク

### PjM

見る観点:

- スコープ管理
- 依存関係
- リリース順序
- rollout / rollback
- 関係者確認

出力例:

- 他 task との依存
- リリース前に必要な確認
- スコープが広がっていないか

### Tech Lead

見る観点:

- 設計の妥当性
- アーキテクチャ影響
- 境界の切り方
- 保守性
- セキュリティ / パフォーマンスリスク

出力例:

- 設計上の懸念
- BE / FE / shared の責務分離
- 将来の変更に耐えられるか

### Engineer

見る観点:

- 実装バグ
- テスト不足
- edge case
- 型・lint・build 影響
- 既存実装パターンとの整合

出力例:

- 具体的なコード指摘
- 追加すべきテスト
- regression risk

## Output Schema

```json
{
  "summary": "全体要約",
  "role_reviews": [
    {
      "role": "pdm",
      "summary": "PdM観点の要約",
      "findings": [
        {
          "severity": "medium",
          "title": "受け入れ条件の不足",
          "body": "具体的な懸念",
          "file": null,
          "line": null
        }
      ]
    }
  ],
  "overall_decision": "comment"
}
```

`overall_decision`:

- `approve`
- `comment`
- `request_changes`

## Comment 方針

初期実装では 1 つの PR comment に role ごとの結果をまとめる。

将来的には、エンジニア観点の具体的なコード指摘だけ GitHub review comment に変換する。

